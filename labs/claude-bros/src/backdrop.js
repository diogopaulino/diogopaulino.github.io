/* Claude Bros — planos de fundo em 3D de verdade (a paralaxe sai da perspectiva):
 *
 *   z ≈ +30 … −12   lago/rio (água com reflexo do céu e ondulação em duas camadas)
 *   z ≈ −12 … −88   colinas gramadas com árvores instanciadas (vento)
 *   z ≈ −95 … −330  serra enevoada (ruído de cristas, cores por altitude)
 *   z ≈ −60 … −230  nuvens: cartões macios (fBm) iluminados pelo sol, à deriva
 *
 * Água: MeshStandardMaterial de rugosidade baixa; o mapa de normais (gerado de
 * um campo de altura fBm tileável) é amostrado duas vezes, com escalas e
 * velocidades diferentes, e somado:  n = normalize(n1(uv + v1·t) + n2(1,7·uv − v2·t)).
 */
import * as THREE from 'three';
import { pbrMaterial } from '../../shared/gfx/assets.js';
import { createTreeKit, instanceKit } from '../../shared/gfx/flora.js';
import { createParticles } from '../../shared/gfx/particles.js';
import { fbm2, ridged2, seeded, smoothstep } from '../../shared/gfx/core.js';
import { WATER_LEVEL } from './config.js';
import { Z_BACK, greenify } from './terrain.js';

function waterNormalTexture(size = 256) {
    const h = new Float32Array(size * size);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) h[x + y * size] = fbm2((x / size) * 8, (y / size) * 8, 4, 8, 3);
    }
    const data = new Uint8Array(size * size * 4);
    const at = (x, y) => h[((x + size) % size) + ((y + size) % size) * size];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (at(x + 1, y) - at(x - 1, y)) * 5;
            const dy = (at(x, y + 1) - at(x, y - 1)) * 5;
            const l = Math.hypot(dx, dy, 1);
            const i = (x + y * size) * 4;
            data[i] = (-dx / l * 0.5 + 0.5) * 255;
            data[i + 1] = (-dy / l * 0.5 + 0.5) * 255;
            data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
            data[i + 3] = 255;
        }
    }
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
}

/** Altura das colinas do segundo plano (m). */
export function hillHeight(x, z) {
    const rise = smoothstep(-9, -21, z);
    const far = smoothstep(-12, -48, z);
    return -3.3 + rise * (1.1 + 1.2 * fbm2(x * 0.09, z * 0.09, 3, 0, 5) + 4.2 * far * fbm2(x * 0.03 + 4, z * 0.035, 4, 0, 8));
}

export function buildBackdrop(scene, sky, terrain, quality) {
    const group = new THREE.Group();
    group.name = 'backdrop';
    const time = { value: 0 };

    /* ---- água ---- */
    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(700, 180, 1, 1).rotateX(-Math.PI / 2),
        new THREE.MeshStandardMaterial({ color: 0x1b4f52, roughness: 0.1, metalness: 0, normalMap: waterNormalTexture(), envMapIntensity: 1.15 })
    );
    water.material.normalScale.set(0.55, 0.55);
    water.material.normalMap.repeat.set(90, 24);
    water.material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = time;
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform float uTime;')
            .replace('#include <normal_fragment_maps>', `
                vec3 mapN = texture2D(normalMap, vNormalMapUv + vec2(uTime * 0.022, uTime * 0.013)).xyz * 2.0 - 1.0;
                mapN += texture2D(normalMap, vNormalMapUv * 1.7 - vec2(uTime * 0.016, -uTime * 0.021)).xyz * 2.0 - 1.0;
                mapN = normalize(mapN);
                mapN.xy *= normalScale;
                normal = normalize(tbn * mapN);`);
    };
    water.position.set(45, WATER_LEVEL, -45);
    water.receiveShadow = true;
    group.add(water);

    /* ---- colinas ---- */
    const hills = new THREE.PlaneGeometry(300, 82, 150, 41).rotateX(-Math.PI / 2);
    hills.translate(45, 0, -49);
    {
        const pos = hills.attributes.position;
        const col = new Float32Array(pos.count * 3);
        const uv = hills.attributes.uv;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            pos.setY(i, hillHeight(x, z));
            uv.setXY(i, x / 9, z / 9);
            // manchas de capim mais claro/seco e mais escuro, para o campo não virar um carpete
            const n = fbm2(x * 0.06, z * 0.06, 3, 0, 12);
            const dry = smoothstep(0.52, 0.72, fbm2(x * 0.11 + 9, z * 0.14, 3, 0, 31));
            col[i * 3] = 0.6 + n * 0.5 + dry * 0.55;
            col[i * 3 + 1] = 0.78 + n * 0.4 + dry * 0.12;
            col[i * 3 + 2] = 0.55 + n * 0.35 - dry * 0.1;
        }
        hills.setAttribute('color', new THREE.BufferAttribute(col, 3));
        hills.computeVertexNormals();
    }
    const hillMesh = new THREE.Mesh(hills, greenify(pbrMaterial('aerial_grass_rock', { vertexColors: true, normalScale: 1.3, envMapIntensity: 0.5 }), [0.12, 0.3, 0.06], 0.7));
    hillMesh.receiveShadow = true;
    group.add(hillMesh);

    /* ---- serra ---- */
    const range = new THREE.PlaneGeometry(700, 240, 175, 60).rotateX(-Math.PI / 2);
    range.translate(45, 0, -213);
    {
        const pos = range.attributes.position;
        const col = new Float32Array(pos.count * 3);
        const c = new THREE.Color();
        const low = new THREE.Color(0x3d5c3a);
        const rock = new THREE.Color(0x7d766c);
        const snow = new THREE.Color(0xe9edf2);
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const env = smoothstep(-93, -175, z) * (1 - 0.35 * smoothstep(-260, -333, z));
            const y = -3 + env * (3 + 27 * ridged2(x * 0.0085 + 3, z * 0.0085, 5, 0, 21) * (0.6 + 0.6 * fbm2(x * 0.004, 1.5, 2, 0, 4)));
            pos.setY(i, y);
            const n = fbm2(x * 0.05, z * 0.05, 3, 0, 2);
            c.copy(low).lerp(rock, smoothstep(6, 14, y + n * 6)).lerp(snow, smoothstep(17, 24, y + n * 5));
            col[i * 3] = c.r;
            col[i * 3 + 1] = c.g;
            col[i * 3 + 2] = c.b;
        }
        range.setAttribute('color', new THREE.BufferAttribute(col, 3));
        range.computeVertexNormals();
    }
    const rangeMesh = new THREE.Mesh(range, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, envMapIntensity: 0.6 }));
    group.add(rangeMesh);

    /* ---- árvores (kit de flora compartilhado, com vento) ---- */
    const rnd = seeded(404);
    const kits = [
        createTreeKit({ kind: 'round', seed: 2 }),
        createTreeKit({ kind: 'round', seed: 7 }),
        createTreeKit({ kind: 'ipe', seed: 3, flowerColor: '#f29a52' }),
        createTreeKit({ kind: 'amendoeira', seed: 5 })
    ];
    const near = kits.map(() => []);
    const far = kits.map(() => []);
    for (const isl of terrain.islands) {
        const n = Math.round((isl.x1 - isl.x0) * 0.07 * quality.trees);
        for (let i = 0; i < n; i++) {
            const x = rnd.range(isl.x0 + 1.2, isl.x1 - 1.2);
            const z = rnd.range(Z_BACK + 1.0, -4.3);
            near[rnd.int(0, 3)].push({ x, y: isl.height(x, z) - 0.1, z, scale: rnd.range(0.3, 0.44), rot: rnd() * 6.283 });
        }
    }
    const farCount = Math.round(48 * quality.trees);
    for (let i = 0; i < farCount; i++) {
        const x = rnd.range(-70, 160);
        const z = rnd.range(-78, -15);
        const y = hillHeight(x, z);
        if (y < WATER_LEVEL + 0.5) continue;
        far[rnd.int(0, 3)].push({ x, y: y - 0.2, z, scale: rnd.range(0.38, 0.72), rot: rnd() * 6.283 });
    }
    kits.forEach((kit, i) => {
        if (near[i].length) group.add(instanceKit(kit, near[i], { castShadow: quality.propShadows, receiveShadow: true }));
        if (far[i].length) group.add(instanceKit(kit, far[i], { castShadow: false, receiveShadow: false }));
    });

    /* ---- nuvens ---- */
    const N = quality.clouds;
    const quad = new THREE.PlaneGeometry(1, 1);
    const cg = new THREE.InstancedBufferGeometry();
    cg.index = quad.index;
    cg.setAttribute('position', quad.attributes.position);
    cg.setAttribute('uv', quad.attributes.uv);
    const off = new Float32Array(N * 4);
    const scl = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
        off[i * 4] = rnd.range(-250, 350);
        off[i * 4 + 1] = rnd.range(22, 52);
        off[i * 4 + 2] = rnd.range(-235, -90);
        off[i * 4 + 3] = rnd() * 100;
        const w = rnd.range(55, 120);
        scl[i * 2] = w;
        scl[i * 2 + 1] = w * rnd.range(0.26, 0.4);
    }
    cg.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 4));
    cg.setAttribute('aScale', new THREE.InstancedBufferAttribute(scl, 2));
    cg.instanceCount = N;
    cg.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const cloudMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uTime: time, uLit: sky.uniforms.uCloudLit, uShade: sky.uniforms.uCloudShade, uHaze: { value: sky.horizonColor } },
        vertexShader: /* glsl */ `
            attribute vec4 aOffset;
            attribute vec2 aScale;
            uniform float uTime;
            varying vec2 vUv;
            varying float vSeed;
            varying float vFar;
            void main() {
                vec3 p = aOffset.xyz;
                p.x = mod(p.x + uTime * 0.9 + 250.0, 600.0) - 250.0;
                p.xy += position.xy * aScale;
                vUv = uv;
                vSeed = aOffset.w;
                vFar = smoothstep(90.0, 240.0, -aOffset.z);
                gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
            }`,
        fragmentShader: /* glsl */ `
            uniform vec3 uLit, uShade, uHaze;
            uniform float uTime;
            varying vec2 vUv;
            varying float vSeed;
            varying float vFar;
            float h(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
            float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
            float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
            void main() {
                vec2 c = vUv - vec2(0.5, 0.42);
                // base achatada, topo em couve-flor
                float body = 1.0 - length(c * vec2(2.0, c.y < 0.0 ? 4.6 : 2.5));
                float puff = fbm(vUv * vec2(5.0, 2.6) + vSeed + vec2(uTime * 0.004, 0.0));
                float d = body + (puff - 0.5) * 0.95;
                float a = smoothstep(0.02, 0.34, d);
                if (a < 0.004) discard;
                float lightTop = smoothstep(-0.25, 0.5, c.y + (puff - 0.5) * 0.5) * (0.55 + 0.45 * smoothstep(0.0, 0.5, d));
                vec3 col = mix(uShade * 1.9 + uLit * 0.12, uLit * 1.15, lightTop);
                col = mix(col, uHaze, vFar * 0.55);
                gl_FragColor = vec4(col, a * (0.94 - vFar * 0.3));
            }`
    });
    const clouds = new THREE.Mesh(cg, cloudMat);
    clouds.frustumCulled = false;
    clouds.renderOrder = 950;
    group.add(clouds);

    /* ---- névoa subindo dos vãos ---- */
    const mists = [];
    const grounds = terrain.level.grounds;
    for (let i = 0; i < grounds.length - 1; i++) {
        const cx = (grounds[i].x1 + grounds[i + 1].x0) / 2;
        const wdt = grounds[i + 1].x0 - grounds[i].x1;
        const mist = createParticles({
            count: 10, life: 7,
            origin: new THREE.Vector3(cx, WATER_LEVEL + 0.2, -1.5),
            spread: new THREE.Vector3(wdt * 0.4, 0.1, 3.5),
            velocity: new THREE.Vector3(0.05, 0.22, 0),
            velocitySpread: new THREE.Vector3(0.12, 0.08, 0.1),
            turbulence: 0.5, size: [1.2, 3.6], color: 0xffffff, opacity: 0.11
        });
        group.add(mist.mesh);
        mists.push(mist);
    }

    scene.add(group);
    return {
        group,
        water,
        update(t) {
            time.value = t;
            for (const m of mists) m.update(t);
        },
        /** A névoa pega a cor do céu no horizonte (muda com o tema). */
        tint(color) {
            for (const m of mists) m.uniforms.uColor.value.copy(color);
        }
    };
}
