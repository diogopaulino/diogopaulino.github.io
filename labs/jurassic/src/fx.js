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
 * POÇAS — discos irregulares instanciados nos sulcos da trilha; a opacidade
 * acompanha a umidade acumulada (sobe em ~8 s de chuva, seca em ~25 s).
 */

import * as THREE from 'three';
import { seeded, fbm2 } from '../../shared/gfx/core.js';

export function createParticles(count) {
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

    return {
        object: points,
        material: mat,
        /**
         * Emite uma partícula. `additive` = faísca (soma luz, ignora a luz ambiente).
         */
        emit(x, y, z, vx, vy, vz, r, g, b, alpha, sz, grow, ttl, gravity = 0, drag = 1, additive = false) {
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
        },
        update(dt, viewportHeight, fov) {
            mat.uniforms.uScale.value = viewportHeight / (2 * Math.tan((fov * Math.PI) / 360));
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
