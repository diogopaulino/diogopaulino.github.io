/**
 * Terreno do Rastro Vermelho — malha por blocos, material de camadas e capim.
 *
 * Convenção de eixos: a simulação (simulation.js) usa x/z com o norte em +z e
 * guinada yaw = atan2(dx, dz). O three.js é destro, então o mundo é desenhado com
 *   X₃ = x,   Z₃ = −z,   rotação.y = π − yaw   (modelos com a frente em +Z)
 * Assim "D" continua virando para a direita e a altura vem sempre de
 * terrainHeight(x, z) — a mesma função que move o cavalo e posiciona o cenário.
 *
 * Camadas do chão (peso por vértice em aSplat, quebrado por ruído no fragmento):
 *   x = capim (bioma), y = distância assinada ao eixo da trilha (m),
 *   z = cânion (terra vermelha), w = terreiro batido dos povoados.
 *   rocha entra por inclinação: w_rocha = smoothstep(0,16; 0,36; 1 − n.y)
 *   sulcos de carroça: faixas escuras a ±0,8 m do eixo da trilha.
 */
import * as THREE from 'three';
import { GLSL_NOISE, seeded } from '../../shared/gfx/core.js';
import { textureSet } from '../../shared/gfx/textures.js';
import { wind } from '../../shared/gfx/flora.js';
import { terrainHeight, roadX, LANDMARKS, clamp } from './simulation.js';

export const CHUNK = 96;
/** Altura do terreno em coordenadas do three (Z₃ = −z). */
export const hAt = (x, z3) => terrainHeight(x, -z3);

const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** Pesos de bioma em coordenadas da simulação. Mesma regra do HUD (biomeAt), com bordas suaves. */
export function biome(x, z) {
    const canyon = sstep(600, 655, z) * (1 - sstep(840, 895, z));
    const serra = sstep(-80, -125, x) * (1 - canyon);
    const north = sstep(860, 930, z);
    const vale = sstep(390, 450, z) * (1 - canyon) * (1 - north);
    let yard = 0;
    for (const p of LANDMARKS) yard = Math.max(yard, 1 - sstep(9, 22, Math.hypot(x - p.x, z - p.z)));
    const grass = (1 - canyon * 0.9) * (1 - north * 0.45) * (1 - serra * 0.35) * (1 - yard);
    return { canyon, serra, north, vale, yard, grass };
}

let terrainMat = null;
export function terrainMaterial(tier) {
    if (terrainMat) return terrainMat;
    const loader = new THREE.TextureLoader();
    const tex = (url, srgb) => {
        const t = loader.load(url);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.anisotropy = tier === 'low' ? 2 : 8;
        if (srgb) t.colorSpace = THREE.SRGBColorSpace;
        return t;
    };
    const dirt = tex('assets/ground-albedo.webp', true);
    const dirtN = tex('assets/ground-normal.webp');
    const dirtR = tex('assets/ground-roughness.webp');
    const rock = tex('assets/rock-albedo.webp', true);
    const grass = textureSet('grass').map;
    const mat = new THREE.MeshStandardMaterial({ map: dirt, normalMap: dirtN, roughnessMap: dirtR, roughness: 1, metalness: 0, envMapIntensity: 0.7 });
    mat.normalScale.set(0.7, 0.7);
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.tRock = { value: rock };
        shader.uniforms.tGrass = { value: grass };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                attribute vec4 aSplat;
                varying vec4 vSplat;
                varying vec3 vWPos;
                varying vec3 vWNor;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vSplat = aSplat;
                vWPos = position;
                vWNor = normal;`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                ${GLSL_NOISE}
                uniform sampler2D tRock, tGrass;
                varying vec4 vSplat;
                varying vec3 vWPos;
                varying vec3 vWNor;
                float rvRough;`)
            .replace('#include <map_fragment>', /* glsl */ `
                {
                    vec2 p = vWPos.xz;
                    vec3 wn = normalize(vWNor);
                    float macro = gfxFbm(p * 0.018);
                    float mid = gfxNoise(p * 0.21 + 7.0);
                    float fine = gfxNoise(p * 1.6);

                    // terra seca em duas escalas (mata a repetição do azulejo)
                    vec3 d = texture2D(map, vMapUv).rgb * 0.62 + texture2D(map, vMapUv * 0.19 + 0.31).rgb * 0.5;
                    vec3 prairie = d * mix(vec3(1.05, 0.9, 0.68), vec3(1.2, 1.0, 0.72), macro);
                    vec3 red = d * mix(vec3(1.5, 0.82, 0.5), vec3(1.72, 1.0, 0.6), mid);
                    vec3 soil = mix(prairie, red, vSplat.z);

                    // capim seco / pasto: dourado ↔ oliva em manchas largas
                    vec3 g = texture2D(tGrass, p * 0.33).rgb * 0.62 + texture2D(tGrass, p * 0.061 + 0.4).rgb * 0.5;
                    float gl = 0.3 + 1.9 * dot(g, vec3(0.3, 0.5, 0.2));
                    g = gl * mix(vec3(0.8, 0.6, 0.27), vec3(0.5, 0.5, 0.22), smoothstep(0.32, 0.68, macro + (mid - 0.5) * 0.3));
                    // touceiras escuras e falhas de terra aparecendo entre o capim
                    g *= 0.6 + 0.6 * gfxNoise(p * 3.7 + 11.0);
                    g = mix(g, d * vec3(0.98, 0.82, 0.58), 0.45 * smoothstep(0.42, 0.72, gfxNoise(p * 0.9 + 3.0)));
                    float gw = vSplat.x * smoothstep(0.22, 0.6, mid * 0.55 + fine * 0.45 + vSplat.x * 0.35);

                    // rocha triplanar nas encostas
                    vec3 bw = pow(abs(wn), vec3(4.0));
                    bw /= bw.x + bw.y + bw.z;
                    vec3 r = texture2D(tRock, vWPos.zy * 0.16).rgb * bw.x
                           + texture2D(tRock, vWPos.xz * 0.16).rgb * bw.y
                           + texture2D(tRock, vWPos.xy * 0.16).rgb * bw.z;
                    r *= mix(vec3(1.0, 0.94, 0.86), vec3(1.5, 0.9, 0.62), vSplat.z) * (0.85 + 0.3 * macro);
                    float rw = smoothstep(0.16, 0.36, (1.0 - wn.y) + (fine - 0.5) * 0.09);

                    // trilha batida + sulcos de roda + capim ralo no meio
                    float rd = abs(vSplat.y);
                    float road = 1.0 - smoothstep(1.9, 3.9, rd + (mid - 0.5) * 1.5);
                    vec3 roadCol = soil * vec3(1.2, 1.12, 1.0) * (0.92 + 0.16 * fine);
                    float rut = (1.0 - smoothstep(0.08, 0.42, abs(rd - 0.82 + (mid - 0.5) * 0.25))) * road;
                    roadCol *= 1.0 - 0.3 * rut;
                    float crown = (1.0 - smoothstep(0.0, 0.4, rd)) * smoothstep(0.5, 0.75, fine) * 0.5;
                    roadCol = mix(roadCol, g * 0.9, crown);
                    float yard = vSplat.w * smoothstep(0.2, 0.7, vSplat.w + (fine - 0.5) * 0.5);

                    vec3 col = mix(soil, g, gw);
                    col = mix(col, soil * vec3(1.1, 1.04, 0.95), yard);
                    col = mix(col, r, rw * (1.0 - road));
                    col = mix(col, roadCol, road);
                    rvRough = mix(mix(0.96, 0.88, gw), 0.98, road);
                    diffuseColor.rgb *= col;
                }`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                roughnessFactor = max(roughnessFactor, 0.55) * rvRough;`);
    };
    mat.customProgramCacheKey = () => 'rvTerrain';
    terrainMat = mat;
    return mat;
}

/** Malha de terreno cobrindo [x0,x0+size]×[z0,z0+size] em coordenadas do three. */
export function terrainGeometry(x0, z0, size, segments, drop = 0) {
    const n = segments + 1;
    const pos = new Float32Array(n * n * 3);
    const nor = new Float32Array(n * n * 3);
    const uv = new Float32Array(n * n * 2);
    const splat = new Float32Array(n * n * 4);
    const step = size / segments;
    const e = Math.min(0.6, step * 0.5);
    let i = 0;
    for (let iz = 0; iz < n; iz++) {
        for (let ix = 0; ix < n; ix++, i++) {
            const x = x0 + ix * step;
            const z3 = z0 + iz * step;
            const z = -z3;
            const y = terrainHeight(x, z);
            pos[i * 3] = x; pos[i * 3 + 1] = y - drop; pos[i * 3 + 2] = z3;
            // normal por diferença central: n ∝ (h(x−e) − h(x+e), 2e, h(z₃−e) − h(z₃+e))
            const dx = terrainHeight(x - e, z) - terrainHeight(x + e, z);
            const dz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
            const l = Math.hypot(dx, 2 * e, dz);
            nor[i * 3] = dx / l; nor[i * 3 + 1] = 2 * e / l; nor[i * 3 + 2] = dz / l;
            uv[i * 2] = x / 9; uv[i * 2 + 1] = z3 / 9;
            const b = biome(x, z);
            splat[i * 4] = b.grass;
            splat[i * 4 + 1] = clamp(x - roadX(z), -30, 30);
            splat[i * 4 + 2] = b.canyon;
            splat[i * 4 + 3] = b.yard;
        }
    }
    const idx = new (n * n > 65535 ? Uint32Array : Uint16Array)(segments * segments * 6);
    let k = 0;
    for (let iz = 0; iz < segments; iz++) {
        for (let ix = 0; ix < segments; ix++) {
            const a = iz * n + ix, b = a + 1, c = a + n, d = c + 1;
            idx[k++] = a; idx[k++] = c; idx[k++] = b;
            idx[k++] = b; idx[k++] = c; idx[k++] = d;
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
}

/**
 * Capim em anel: N tufos numa grade toroidal de lado L que acompanha o cavaleiro.
 * Cada tufo tem um deslocamento fixo (ox, oz) ∈ [0, L)²; sua posição é
 *   p = o + L·round((centro − o) / L)
 * de modo que só os tufos que "dão a volta" são recalculados (≈ 0,5 % por quadro a galope).
 * Densidade por bioma/trilha decide se o tufo aparece; a borda do anel some por escala.
 */
export class GrassRing {
    constructor(scene, count, size = 84) {
        this.count = count;
        this.L = size;
        const rnd = seeded(4242);
        this.ox = new Float32Array(count);
        this.oz = new Float32Array(count);
        this.cx = new Int32Array(count).fill(1e9);
        this.cz = new Int32Array(count).fill(1e9);
        this.seed = new Float32Array(count);
        for (let i = 0; i < count; i++) { this.ox[i] = rnd() * size; this.oz[i] = rnd() * size; this.seed[i] = rnd(); }
        this.uniforms = { uCenter: { value: new THREE.Vector3() }, uRadius: { value: size * 0.5 } };
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, envMapIntensity: 0.5 });
        mat.onBeforeCompile = (shader) => {
            shader.uniforms.uWindTime = wind.uWindTime;
            shader.uniforms.uWindStrength = wind.uWindStrength;
            shader.uniforms.uCenter = this.uniforms.uCenter;
            shader.uniforms.uRadius = this.uniforms.uRadius;
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', `#include <common>
                    attribute float aWind;
                    uniform float uWindTime, uWindStrength, uRadius;
                    uniform vec3 uCenter;`)
                .replace('#include <begin_vertex>', `#include <begin_vertex>
                    vec3 rvIP = instanceMatrix[3].xyz;
                    float rvD = distance(rvIP.xz, uCenter.xz);
                    transformed *= 1.0 - smoothstep(uRadius * 0.62, uRadius * 0.98, rvD);
                    float rvPh = rvIP.x * 0.61 + rvIP.z * 0.47;
                    float rvW = aWind * uWindStrength;
                    float rvGust = sin(uWindTime * 0.8 + rvIP.x * 0.07 + rvIP.z * 0.05) * 0.5 + 0.5;
                    transformed.x += (sin(uWindTime * 2.1 + rvPh) * 0.05 + rvGust * 0.16) * rvW;
                    transformed.z += (cos(uWindTime * 1.7 + rvPh * 1.3) * 0.04 + rvGust * 0.08) * rvW;
                    transformed.y -= rvGust * 0.04 * rvW;`);
            // lâmina de duas faces com a mesma normal (quase vertical): o verso não escurece
            shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
                float faceDirection = 1.0;
                vec3 normal = normalize(vNormal);
                vec3 nonPerturbedNormal = normal;`);
        };
        mat.customProgramCacheKey = () => 'rvGrass';
        this.mesh = new THREE.InstancedMesh(tuftGeometry(), mat, count);
        this.mesh.frustumCulled = false;
        this.mesh.receiveShadow = true;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this._m = new THREE.Matrix4();
        this._q = new THREE.Quaternion();
        this._s = new THREE.Vector3();
        this._p = new THREE.Vector3();
        this._y = new THREE.Vector3(0, 1, 0);
        scene.add(this.mesh);
    }

    /** x, z₃: centro (cavaleiro) em coordenadas do three. */
    update(x, z3) {
        const L = this.L;
        let dirty = false;
        this.uniforms.uCenter.value.set(x, 0, z3);
        for (let i = 0; i < this.count; i++) {
            const kx = Math.round((x - this.ox[i]) / L), kz = Math.round((z3 - this.oz[i]) / L);
            if (kx === this.cx[i] && kz === this.cz[i]) continue;
            this.cx[i] = kx; this.cz[i] = kz;
            const px = this.ox[i] + kx * L, pz = this.oz[i] + kz * L;
            const b = biome(px, -pz);
            const rd = Math.abs(px - roadX(-pz));
            const s = this.seed[i];
            const show = rd > 2.6 && s < b.grass * 0.95 + 0.06 && b.yard < 0.5;
            const sc = show ? (0.7 + s * 1.5) * (1 + b.vale * 0.35) : 0;
            this._p.set(px, hAt(px, pz) - 0.02, pz);
            this._q.setFromAxisAngle(this._y, s * 40);
            this._s.set(sc, sc * (0.8 + ((s * 7) % 1) * 0.6), sc);
            this._m.compose(this._p, this._q, this._s);
            this.mesh.setMatrixAt(i, this._m);
            dirty = true;
        }
        if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
    }
}

/** Touceira: três moitas de lâminas afiladas curvadas para fora; base oliva → ponta palha. */
function tuftGeometry(clumps = 3, blades = 7) {
    const rnd = seeded(77);
    const pos = [], nor = [], col = [], wnd = [], idx = [];
    const base = new THREE.Color(0x4f5326), tip = new THREE.Color(0xd2bd7a), c = new THREE.Color();
    for (let k = 0; k < clumps; k++) {
        const ca = rnd() * 6.28, cr = k ? 0.22 + rnd() * 0.3 : 0, ox = Math.cos(ca) * cr, oz = Math.sin(ca) * cr, cs = k ? 0.6 + rnd() * 0.5 : 1;
        for (let b = 0; b < blades; b++) {
            const a = (b / blades) * Math.PI * 2 + rnd() * 0.9;
            const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx;
            const h = (0.26 + rnd() * 0.5) * cs, wd = 0.011 + rnd() * 0.011, lean = 0.05 + rnd() * 0.26, off = rnd() * 0.09;
            const o = pos.length / 3;
            const rows = [[0, 1], [0.38, 0.85], [0.72, 0.55], [1, 0]];
            for (const [t, wk] of rows) {
                const out = off + lean * t * t, y = h * t, half = wd * wk;
                c.copy(base).lerp(tip, Math.pow(t, 0.7) * (0.65 + rnd() * 0.35));
                const push = (sx) => {
                    pos.push(ox + dx * out + px * half * sx, y, oz + dz * out + pz * half * sx);
                    nor.push(dx * 0.2, 0.96, dz * 0.2);
                    col.push(c.r, c.g, c.b);
                    wnd.push(t * t);
                };
                if (wk > 0) { push(-1); push(1); } else push(0);
            }
            idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2, o + 2, o + 3, o + 4, o + 3, o + 5, o + 4, o + 4, o + 5, o + 6);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aWind', new THREE.Float32BufferAttribute(wnd, 1));
    geo.setIndex(idx);
    return geo;
}
