/**
 * Jurassic — efeitos: partículas em pool (poeira, lama, faíscas), chuva e poças.
 *
 * PARTÍCULAS — um único THREE.Points com N vagas reutilizadas (sem alocação por
 * quadro). Cada vaga integra  p += v·dt,  v.y −= g·dt,  v *= e^(−arrasto·dt)  e
 * some com  α = α0·(1 − idade/vida)^1,5. A cor sai pré-multiplicada: partículas
 * "aditivas" (faíscas) escrevem alfa 0 e só somam luz; as demais cobrem o fundo.
 *
 * CHUVA — riscos (LineSegments) sem estado: a gota i cai em laço dentro de uma
 * caixa de 44×26×44 m que acompanha a câmera:
 *   p = câmera + mod(semente·caixa + (vento, −queda)·t − câmera, caixa) − caixa/2
 *
 * ORÇAMENTO — `burst` partículas novas por quadro no máximo (o excedente é
 * descartado em vez de reciclar vagas ainda visíveis) e, sem nenhuma viva, o
 * quadro não reenvia os buffers à GPU.
 *
 * MARCADOR DO OBJETIVO — coluna de luz âmbar (cilindro aberto, aditivo, sem
 * névoa) com anel pulsante no chão sobre o próximo animal do diário:
 *   α(y) = (1 − y)^1,1 · 0,45 · opacidade (cor em HDR),   anel: escala 1 + 0,25·frac(t·0,6)
 * Some perto do animal (já se vê o bicho) e reaparece de longe.
 *
 * POÇAS — discos irregulares instanciados nos sulcos da trilha; a opacidade
 * acompanha a umidade acumulada (sobe em ~8 s de chuva, seca em ~25 s).
 */

import * as THREE from 'three';
import { seeded, fbm2 } from '../../shared/gfx/core.js';

export function createParticles(count, burst = 40) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 4);
    const size = new Float32Array(count);
    const vel = new Float32Array(count * 3);
    const life = new Float32Array(count);
    const span = new Float32Array(count);
    const base = new Float32Array(count * 6); // r g b alfa0 tamanho0 crescimento
    const phys = new Float32Array(count * 3); // gravidade, arrasto, aditivo
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: { uScale: { value: 600 }, uLight: { value: new THREE.Color(1, 1, 1) } },
        vertexShader: /* glsl */ `
            attribute vec4 aColor; attribute float aSize;
            uniform float uScale;
            varying vec4 vColor;
            void main() {
                vColor = aColor;
                vec4 mv = modelViewMatrix * vec4(position, 1.0);
                gl_PointSize = aSize * uScale / max(0.1, -mv.z);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uLight;
            varying vec4 vColor;
            void main() {
                vec2 c = gl_PointCoord - 0.5;
                float a = smoothstep(0.5, 0.12, length(c));
                float add = step(1.5, vColor.a);            // alfa ≥ 2 marca partícula aditiva
                float alpha = a * (vColor.a - 2.0 * add);
                vec3 rgb = vColor.rgb * mix(uLight, vec3(1.0), add) * alpha;
                gl_FragColor = vec4(rgb, alpha * (1.0 - add));
            }`
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 20;
    let cursor = 0;
    let budget = burst;
    let alive = 0;
    let wasAlive = 0;

    return {
        object: points,
        material: mat,
        /**
         * Emite uma partícula. `additive` = faísca (soma luz, ignora a luz ambiente).
         */
        emit(x, y, z, vx, vy, vz, r, g, b, alpha, sz, grow, ttl, gravity = 0, drag = 1, additive = false) {
            if (budget <= 0) return false;
            budget--;
            const i = cursor;
            cursor = (cursor + 1) % count;
            pos[i * 3] = x;
            pos[i * 3 + 1] = y;
            pos[i * 3 + 2] = z;
            vel[i * 3] = vx;
            vel[i * 3 + 1] = vy;
            vel[i * 3 + 2] = vz;
            base[i * 6] = r;
            base[i * 6 + 1] = g;
            base[i * 6 + 2] = b;
            base[i * 6 + 3] = alpha;
            base[i * 6 + 4] = sz;
            base[i * 6 + 5] = grow;
            phys[i * 3] = gravity;
            phys[i * 3 + 1] = drag;
            phys[i * 3 + 2] = additive ? 1 : 0;
            life[i] = 0;
            span[i] = ttl;
            alive++;
            return true;
        },
        update(dt, viewportHeight, fov) {
            mat.uniforms.uScale.value = viewportHeight / (2 * Math.tan((fov * Math.PI) / 360));
            budget = burst;
            // nada vivo agora nem no quadro anterior: nem percorre nem reenvia os buffers
            if (alive === 0 && wasAlive === 0) return;
            wasAlive = alive;
            alive = 0;
            for (let i = 0; i < count; i++) {
                if (span[i] <= 0) continue;
                life[i] += dt;
                const k = life[i] / span[i];
                if (k >= 1) {
                    span[i] = 0;
                    col[i * 4 + 3] = 0;
                    size[i] = 0;
                    continue;
                }
                alive++;
                const d = Math.exp(-phys[i * 3 + 1] * dt);
                vel[i * 3] *= d;
                vel[i * 3 + 1] = vel[i * 3 + 1] * d - phys[i * 3] * dt;
                vel[i * 3 + 2] *= d;
                pos[i * 3] += vel[i * 3] * dt;
                pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
                pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
                col[i * 4] = base[i * 6];
                col[i * 4 + 1] = base[i * 6 + 1];
                col[i * 4 + 2] = base[i * 6 + 2];
                col[i * 4 + 3] = base[i * 6 + 3] * Math.pow(1 - k, 1.5) * Math.min(1, k * 12) + phys[i * 3 + 2] * 2;
                size[i] = base[i * 6 + 4] + base[i * 6 + 5] * k;
            }
            geo.attributes.position.needsUpdate = true;
            geo.attributes.aColor.needsUpdate = true;
            geo.attributes.aSize.needsUpdate = true;
        }
    };
}

export function createRain(count) {
    const seeds = new Float32Array(count * 2 * 4);
    const rnd = seeded(5);
    for (let i = 0; i < count; i++) {
        const a = rnd();
        const b = rnd();
        const c = rnd();
        for (let k = 0; k < 2; k++) {
            const o = (i * 2 + k) * 4;
            seeds[o] = a;
            seeds[o + 1] = b;
            seeds[o + 2] = c;
            seeds[o + 3] = k; // 0 = ponta de cima, 1 = ponta de baixo
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        uniforms: { uTime: { value: 0 }, uAmount: { value: 0 }, uCam: { value: new THREE.Vector3() }, uColor: { value: new THREE.Color(0.7, 0.78, 0.85) } },
        vertexShader: /* glsl */ `
            attribute vec4 aSeed;
            uniform float uTime; uniform vec3 uCam;
            varying float vA;
            const vec3 BOX = vec3(44.0, 26.0, 44.0);
            void main() {
                vec3 fall = vec3(2.6, -19.0 - aSeed.x * 6.0, 1.1);
                vec3 p = aSeed.xyz * BOX + fall * uTime;
                p = uCam + mod(p - uCam, BOX) - BOX * 0.5;
                p += normalize(fall) * aSeed.w * (0.55 + aSeed.y * 0.5);
                vec4 mv = modelViewMatrix * vec4(p, 1.0);
                vA = (1.0 - aSeed.w * 0.6) * smoothstep(22.0, 12.0, -mv.z) * smoothstep(0.6, 2.5, -mv.z);
                gl_Position = projectionMatrix * mv;
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uColor; uniform float uAmount;
            varying float vA;
            void main() { gl_FragColor = vec4(uColor, vA * 0.42 * uAmount); }`
    });
    const lines = new THREE.LineSegments(geo, mat);
    lines.frustumCulled = false;
    lines.renderOrder = 21;
    lines.visible = false;
    return {
        object: lines,
        update(t, camera, amount, light) {
            lines.visible = amount > 0.01;
            if (!lines.visible) return;
            mat.uniforms.uTime.value = t;
            mat.uniforms.uAmount.value = amount;
            mat.uniforms.uCam.value.copy(camera.position);
            mat.uniforms.uColor.value.setRGB(0.7 * light, 0.78 * light, 0.86 * light);
        }
    };
}

/** Poças nos sulcos das trilhas. `wet` 0..1 controla a opacidade. */
export function createPuddles(world, count) {
    const rnd = seeded(31);
    const shape = [];
    const N = 22;
    for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        const r = 0.7 + fbm2(Math.cos(a) * 1.3 + 4, Math.sin(a) * 1.3 + 2, 2) * 0.6;
        shape.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const geo = new THREE.ShapeGeometry(new THREE.Shape(shape), 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x2c2218, roughness: 0.02, metalness: 0, envMapIntensity: 1.6, transparent: true, opacity: 0,
        depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const d = new THREE.Object3D();
    const p = new THREE.Vector3();
    const tg = new THREE.Vector3();
    const n = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
        const road = world.roads[i % 5 === 4 ? 1 + (i % 3) : 0];
        road.pointAt(rnd(), p);
        road.tangentAt(rnd(), tg);
        const side = (rnd() < 0.5 ? -1 : 1) * (0.55 + rnd() * 0.5);
        const x = p.x - tg.z * side + (rnd() - 0.5) * 0.4;
        const z = p.z + tg.x * side + (rnd() - 0.5) * 0.4;
        world.terrain.normalAt(x, z, n);
        d.position.set(x, world.heightAt(x, z) + 0.035, z);
        d.quaternion.setFromUnitVectors(up, n);
        d.rotateY(rnd() * 6.28);
        d.scale.set(0.5 + rnd() * 0.9, 1, 0.35 + rnd() * 0.5);
        d.updateMatrix();
        mesh.setMatrixAt(i, d.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.receiveShadow = true;
    mesh.visible = false;
    mesh.renderOrder = 2;
    return {
        object: mesh,
        update(wet) {
            mesh.visible = wet > 0.02;
            mat.opacity = Math.min(0.9, wet * 0.95);
        }
    };
}

/**
 * Marcador do objetivo (ver cabeçalho). `update(t, x, y, z, opacity)`; opacity 0 esconde.
 */
export function createBeacon() {
    const group = new THREE.Group();
    group.name = 'objectiveBeacon';
    const beamGeo = new THREE.CylinderGeometry(1.1, 2.2, 60, 16, 1, true);
    beamGeo.translate(0, 30, 0);
    const beamMat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
        // cor em HDR (> 1): o pós do palco tem exposição e tone mapping, um âmbar 1.0 some na névoa
        uniforms: { uOpacity: { value: 0 }, uColor: { value: new THREE.Color(8, 3.8, 0.7) } },
        vertexShader: /* glsl */ `
            varying float vY; varying vec3 vN; varying vec3 vV;
            void main() {
                vY = uv.y;
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vN = normalize(mat3(modelMatrix) * normal);
                vV = normalize(cameraPosition - wp.xyz);
                gl_Position = projectionMatrix * viewMatrix * wp;
            }`,
        fragmentShader: /* glsl */ `
            uniform float uOpacity; uniform vec3 uColor;
            varying float vY; varying vec3 vN; varying vec3 vV;
            void main() {
                float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.6);
                float a = pow(1.0 - vY, 1.1) * 0.45 * uOpacity * (0.35 + 0.65 * (1.0 - rim));
                gl_FragColor = vec4(uColor * a, a);
            }`
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.frustumCulled = false;
    beam.renderOrder = 22;
    const ringGeo = new THREE.RingGeometry(2.6, 3.1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(3, 1.75, 0.45), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.renderOrder = 22;
    ring.position.y = 0.25;
    group.add(beam, ring);
    group.visible = false;
    return {
        object: group,
        update(t, x, y, z, opacity) {
            group.visible = opacity > 0.01;
            if (!group.visible) return;
            group.position.set(x, y, z);
            beamMat.uniforms.uOpacity.value = opacity;
            const k = (t * 0.6) % 1;
            ring.scale.setScalar(1 + k * 0.25);
            ringMat.opacity = opacity * 0.8 * (1 - k);
        }
    };
}
