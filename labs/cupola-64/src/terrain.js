/**
 * Terreno da Ilha da Cúpola: malha densa com normais analíticas, material "splat"
 * (grama, calçamento, areia e rocha misturados por altura/inclinação), grama e flores
 * instanciadas com vento e pedras modeladas.
 *
 * Pesos do splat (por vértice, refinados por ruído no fragmento):
 *   rocha    = smoothstep(0.20, 0.42, 1 − n.y)  ∪  cota alta da montanha
 *   areia    = (1 − smoothstep(0.30, 1.00, y)) · costa   (praia; leito das lagoas)
 *   calçada  = trilha (|x − meandro| < 2) ∪ largo do castelo (d < 8)
 *   grama    = o que sobra
 * Praia molhada: abaixo de y = nível da água + 0.5 a cor escurece e a rugosidade cai.
 * Normal: mapas de normal das camadas planas + relevo de rocha por derivada de tela
 * (dFdx/dFdy da luminância, técnica de bump mapping de Mikkelsen).
 */
import * as THREE from 'three';
import { textureSet } from '../../shared/gfx/textures.js';
import { wind } from '../../shared/gfx/flora.js';
import { seeded, fbm2, ridged2, smoothstep, clamp, GLSL_NOISE, applyWorldUV } from '../../shared/gfx/core.js';
import { ISLAND } from './config.js?v=14';
import { surfaceAt, GORGE } from './utils.js?v=13';

const SIZE = 124;

/** Normal analítica por diferenças centrais: n = normalize(−∂h/∂x, 1, −∂h/∂z). */
export function normalAt(x, z, out, e = 0.3) {
    const dx = (surfaceAt(x + e, z) - surfaceAt(x - e, z)) / (2 * e);
    const dz = (surfaceAt(x, z + e) - surfaceAt(x, z - e)) / (2 * e);
    const il = 1 / Math.hypot(dx, 1, dz);
    return out.set(-dx * il, il, -dz * il);
}

/** Meandro da trilha que liga a praia ao portão. */
const pathCenter = (z) => (fbm2(z * 0.16 + 3.1, 7.3, 2) - 0.5) * 2.2 * smoothstep(20, 12, z);

/** Pesos [grama, calçada, areia, rocha] em (x, z). */
export function splatAt(x, z, y, ny, out) {
    const n = fbm2(x * 0.17 + 40, z * 0.17 + 40, 3);
    const md = Math.hypot(x - 3, z + 26);
    let rock = smoothstep(0.2, 0.42, 1 - ny + (n - 0.5) * 0.14);
    if (md < 20) rock = Math.max(rock, smoothstep(9.5, 14, y + (n - 0.5) * 3.5));
    // areia só perto da costa (ou no leito das lagoas): baixadas do interior continuam gramadas
    const coast = smoothstep(27, 36, Math.hypot(x, z) + (n - 0.5) * 6);
    const sand = (1 - smoothstep(0.3, 1.0, y + (n - 0.5) * 0.5)) * Math.max(coast, 1 - smoothstep(-0.25, 0.1, y));
    let path = (1 - smoothstep(1.35, 2.3, Math.abs(x - pathCenter(z)) + (n - 0.5) * 0.9))
        * smoothstep(-1.5, 2.5, z) * (1 - smoothstep(19, 22, z));
    const cd = Math.hypot(x, z - 25);
    path = Math.max(path, 1 - smoothstep(7.4, 9.4, cd + (n - 0.5) * 2.4));
    const r = rock;
    const s = sand * (1 - r);
    const p = path * (1 - r) * (1 - sand);
    out[0] = Math.max(0, 1 - r - s - p);
    out[1] = p;
    out[2] = s;
    out[3] = r;
    return out;
}

function terrainMaterial(low) {
    const grass = textureSet('grass');
    const cobble = textureSet('cobble');
    const sand = textureSet('sand');
    const rock = textureSet('rock');
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 0.85 });
    mat.name = 'cupolaTerrain';
    const uniforms = {
        tGrass: { value: grass.map }, tGrassN: { value: grass.normalMap },
        tPath: { value: cobble.map }, tPathN: { value: cobble.normalMap },
        tSand: { value: sand.map }, tSandN: { value: sand.normalMap },
        tRock: { value: rock.map },
        uWaterY: { value: ISLAND.waterY }
    };
    if (low) mat.defines = { ...(mat.defines || {}), CUPOLA_LOW: '' };
    mat.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
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
                uniform sampler2D tGrass, tGrassN, tPath, tPathN, tSand, tSandN, tRock;
                uniform float uWaterY;
                varying vec4 vSplat;
                varying vec3 vWPos;
                varying vec3 vWNor;
                vec4 cuW;
                float cuWet;
                float cuRockH;`)
            .replace('#include <map_fragment>', /* glsl */ `
                {
                    vec2 p = vWPos.xz;
                    vec3 wn = normalize(vWNor);
                    float macro = gfxFbm(p * 0.055);
                    float fine = gfxNoise(p * 1.7);
                    // quebra as fronteiras entre camadas com ruído e afia a mistura
                    vec4 w = vSplat;
                    w.x *= 0.55 + 0.9 * fine;
                    w.y *= 0.6 + 0.8 * gfxNoise(p * 2.3 + 9.0);
                    w.z *= 0.7 + 0.6 * gfxNoise(p * 1.1 + 4.0);
                    w.w *= 0.7 + 0.6 * macro;
                    w = pow(max(w, 0.0), vec4(2.2));
                    w /= max(dot(w, vec4(1.0)), 1e-4);
                    cuW = w;

                    // grama em duas escalas (mata a repetição) + manchas secas/trevo
                    vec3 g = texture2D(tGrass, p * 0.42).rgb * 0.62 + texture2D(tGrass, p * 0.087 + 0.37).rgb * 0.5;
                    g *= mix(vec3(0.72, 0.98, 0.52), vec3(1.22, 1.16, 0.62), smoothstep(0.3, 0.72, macro));
                    g *= 0.86 + 0.28 * gfxNoise(p * 0.31 + 20.0);
                    vec3 c = texture2D(tPath, p * 0.36).rgb * vec3(1.04, 0.96, 0.86);
                    vec3 s = texture2D(tSand, p * 0.3).rgb * mix(vec3(0.84, 0.75, 0.58), vec3(0.93, 0.85, 0.68), macro);
                    // rocha triplanar (paredes da gruta e encostas não esticam)
                    vec3 bw = pow(abs(wn), vec3(4.0));
                    bw /= bw.x + bw.y + bw.z;
                    vec3 r = texture2D(tRock, vWPos.zy * 0.3).rgb * bw.x
                           + texture2D(tRock, vWPos.xz * 0.3).rgb * bw.y
                           + texture2D(tRock, vWPos.xy * 0.3).rgb * bw.z;
                    // estratos e tom quente da pedra da ilha
                    float strata = 0.86 + 0.2 * gfxNoise(vec2(vWPos.y * 2.6 + macro * 3.0, p.x * 0.05 + p.y * 0.07));
                    r *= vec3(1.08, 0.98, 0.86) * strata * mix(0.86, 1.14, macro);
                    cuRockH = dot(r, vec3(0.333));

                    vec3 col = g * w.x + c * w.y + s * w.z + r * w.w;
                    cuWet = 1.0 - smoothstep(uWaterY + 0.03, uWaterY + 0.52, vWPos.y + (fine - 0.5) * 0.12);
                    col *= mix(1.0, 0.55, cuWet);
                    // oclusão suave ao pé das encostas e dentro da gruta
                    diffuseColor.rgb *= col;
                }`)
            .replace('#include <roughnessmap_fragment>', /* glsl */ `
                float roughnessFactor = dot(cuW, vec4(0.9, 0.78, 0.92, 0.88));
                roughnessFactor = mix(roughnessFactor, 0.2, cuWet * 0.85);`)
            .replace('#include <normal_fragment_maps>', /* glsl */ `
                {
                    vec2 p = vWPos.xz;
                    vec3 wn = normalize(vWNor);
                    #ifndef CUPOLA_LOW
                    vec3 tn = (texture2D(tGrassN, p * 0.42).xyz * 2.0 - 1.0) * cuW.x * 0.9
                            + (texture2D(tPathN, p * 0.36).xyz * 2.0 - 1.0) * cuW.y * 1.25
                            + (texture2D(tSandN, p * 0.3).xyz * 2.0 - 1.0) * cuW.z * (1.0 - cuWet * 0.7);
                    wn = normalize(wn + vec3(tn.x, 0.0, -tn.y) * 0.9);
                    #endif
                    normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
                    // relevo da rocha: gradiente de altura em espaço de tela (Mikkelsen)
                    vec3 sx = dFdx(-vViewPosition);
                    vec3 sy = dFdy(-vViewPosition);
                    vec3 r1 = cross(sy, normal);
                    vec3 r2 = cross(normal, sx);
                    float det = dot(sx, r1);
                    float hgt = cuRockH * cuW.w * 0.085;
                    vec3 grad = sign(det) * (dFdx(hgt) * r1 + dFdy(hgt) * r2);
                    normal = normalize(abs(det) * normal - grad);
                }`);
    };
    mat.customProgramCacheKey = () => `cupolaTerrain:${low}`;
    return mat;
}

function buildGround(q) {
    const segs = q.terrain;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const splat = new Float32Array(pos.count * 4);
    const n = new THREE.Vector3();
    const w = [0, 0, 0, 0];
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = surfaceAt(x, z);
        pos.setY(i, y);
        normalAt(x, z, n, 0.28);
        nor.setXYZ(i, n.x, n.y, n.z);
        splatAt(x, z, y, n.y, w);
        splat.set(w, i * 4);
    }
    geo.setAttribute('aSplat', new THREE.BufferAttribute(splat, 4));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new THREE.Mesh(geo, terrainMaterial(q.id === 'low'));
    mesh.receiveShadow = true;
    mesh.castShadow = true; // a montanha projeta sombra na ilha
    mesh.name = 'ground';
    return mesh;
}

/** Vento compartilhado com a flora do kit (mesmos uniforms → tudo balança junto). */
function applyBladeWind(material, key) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = wind.uWindTime;
        shader.uniforms.uWindStrength = wind.uWindStrength;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                attribute float aWind;
                uniform float uWindTime;
                uniform float uWindStrength;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vec3 cuIP = instanceMatrix[3].xyz;
                float cuPh = cuIP.x * 0.61 + cuIP.z * 0.47;
                float cuWv = aWind * uWindStrength;
                // rajada larga que atravessa a ilha + tremor individual
                float cuGust = sin(uWindTime * 0.9 + cuIP.x * 0.12 + cuIP.z * 0.09) * 0.5 + 0.5;
                transformed.x += (sin(uWindTime * 1.9 + cuPh) * 0.07 + cuGust * 0.16) * cuWv;
                transformed.z += (cos(uWindTime * 1.6 + cuPh * 1.3) * 0.06 + cuGust * 0.1) * cuWv;
                transformed.y -= cuGust * 0.05 * cuWv;`);
    };
    material.customProgramCacheKey = () => `cupolaBlade:${key}`;
    return material;
}

/** Tufo: lâminas afiladas de 2 segmentos, curvadas para fora; cor base→ponta no vértice. */
function tuftGeometry(blades = 6, seed = 1) {
    const rnd = seeded(seed);
    const pos = [];
    const nor = [];
    const col = [];
    const wnd = [];
    const idx = [];
    const base = new THREE.Color(0x245c18);
    const tip = new THREE.Color(0x7fbf3a);
    const c = new THREE.Color();
    for (let b = 0; b < blades; b++) {
        const a = (b / blades) * Math.PI * 2 + rnd() * 0.9;
        const dirX = Math.cos(a);
        const dirZ = Math.sin(a);
        const px = -dirZ;
        const pz = dirX;
        const h = 0.2 + rnd() * 0.24;
        const wd = 0.016 + rnd() * 0.012;
        const lean = 0.06 + rnd() * 0.16;
        const off = rnd() * 0.12;
        const o = pos.length / 3;
        const rows = [[0, 1], [0.5, 0.72], [1, 0]];
        for (const [t, wk] of rows) {
            const out = off + lean * t * t;
            const cx = dirX * out;
            const cz = dirZ * out;
            const y = h * t;
            const half = wd * wk;
            c.copy(base).lerp(tip, t * (0.75 + rnd() * 0.25));
            const push = (sx) => {
                pos.push(cx + px * half * sx, y, cz + pz * half * sx);
                // normal quase vertical: a grama recebe a mesma luz do chão (sem serrilhar o sombreamento)
                nor.push(dirX * 0.25, 0.95, dirZ * 0.25);
                col.push(c.r, c.g, c.b);
                wnd.push(t * t);
            };
            if (wk > 0) {
                push(-1);
                push(1);
            } else {
                push(0);
            }
        }
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2, o + 2, o + 3, o + 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(wnd, 1));
    g.setIndex(idx);
    return g;
}

/** Flor: haste + 6 pétalas em leque + miolo. Cor das pétalas vem da instância. */
function flowerGeometry() {
    const pos = [];
    const nor = [];
    const col = [];
    const wnd = [];
    const idx = [];
    const H = 0.34;
    // haste (lâmina dupla cruzada)
    for (const [dx, dz] of [[0.012, 0], [0, 0.012]]) {
        const o = pos.length / 3;
        pos.push(-dx, 0, -dz, dx, 0, dz, -dx, H, -dz, dx, H, dz);
        for (let i = 0; i < 4; i++) {
            nor.push(0, 1, 0);
            col.push(0.22, 0.42, 0.14);
            wnd.push(i < 2 ? 0 : 1);
        }
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
    // corola levemente cônica
    const o = pos.length / 3;
    pos.push(0, H + 0.012, 0);
    nor.push(0, 1, 0);
    col.push(1.0, 0.82, 0.2);
    wnd.push(1);
    const P = 6;
    for (let i = 0; i < P; i++) {
        const a0 = (i / P) * Math.PI * 2;
        const a1 = a0 + (Math.PI * 2 / P) * 0.5;
        const a2 = a0 + (Math.PI * 2 / P) * 0.92;
        const R = 0.075;
        pos.push(Math.cos(a0) * 0.02, H + 0.01, Math.sin(a0) * 0.02);
        pos.push(Math.cos(a1) * R, H + 0.035, Math.sin(a1) * R);
        pos.push(Math.cos(a2) * 0.02, H + 0.01, Math.sin(a2) * 0.02);
        for (let k = 0; k < 3; k++) {
            nor.push(0, 1, 0);
            col.push(1, 1, 1);
            wnd.push(1);
        }
        const b = o + 1 + i * 3;
        idx.push(b, b + 2, b + 1, o, b + 2, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(wnd, 1));
    g.setIndex(idx);
    return g;
}

/** Pedra: icosaedro subdividido deformado por fbm + cristas, base achatada. */
export function rockGeometry(seed = 1, detail = 3) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const pos = g.attributes.position;
    const rnd = seeded(seed * 17 + 5);
    const sx = 0.8 + rnd() * 0.5;
    const sy = 0.55 + rnd() * 0.35;
    const sz = 0.8 + rnd() * 0.5;
    const ox = rnd() * 50;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).normalize();
        const u = Math.atan2(v.z, v.x) * 1.3 + ox;
        const w = v.y * 2.2 + ox;
        let d = 1 + (fbm2(u * 1.2, w * 1.2, 4, 0, seed) - 0.5) * 0.55 + (ridged2(u * 0.8, w * 0.8, 3, 0, seed + 3) - 0.5) * 0.3;
        // facetas: planos de corte suaves dão o aspecto lascado
        d = Math.min(d, 1.12 - Math.max(0, v.x * 0.6 + v.y * 0.5 - 0.55) * 0.9);
        v.multiplyScalar(d);
        v.set(v.x * sx, Math.max(v.y * sy, -0.22), v.z * sz);
        pos.setXYZ(i, v.x, v.y + 0.18, v.z);
    }
    g.computeVertexNormals();
    // IcosahedronGeometry é não indexada: solda as normais por posição para ficar lisa
    smoothNormals(g);
    applyWorldUV(g, 1.4);
    return g;
}

/** Média das normais de vértices coincidentes (geometrias não indexadas). */
export function smoothNormals(g) {
    const pos = g.attributes.position;
    const nor = g.attributes.normal;
    const map = new Map();
    const key = (i) => `${Math.round(pos.getX(i) * 400)},${Math.round(pos.getY(i) * 400)},${Math.round(pos.getZ(i) * 400)}`;
    for (let i = 0; i < pos.count; i++) {
        const k = key(i);
        let a = map.get(k);
        if (!a) map.set(k, (a = [0, 0, 0]));
        a[0] += nor.getX(i);
        a[1] += nor.getY(i);
        a[2] += nor.getZ(i);
    }
    for (let i = 0; i < pos.count; i++) {
        const a = map.get(key(i));
        const il = 1 / (Math.hypot(a[0], a[1], a[2]) || 1);
        nor.setXYZ(i, a[0] * il, a[1] * il, a[2] * il);
    }
    return g;
}

export function rockMaterial(tint = 0xd9c9b4) {
    const set = textureSet('rock');
    const m = new THREE.MeshStandardMaterial({
        color: tint, map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap,
        roughness: 1, metalness: 0, envMapIntensity: 0.8
    });
    m.normalScale.set(1.3, 1.3);
    return m;
}

/**
 * @param {object} q tier de qualidade
 * @param {(x:number,z:number)=>boolean} blocked áreas sem vegetação (castelo, plataformas no chão…)
 */
export function createTerrain(q, blocked = () => false) {
    const root = new THREE.Group();
    root.name = 'terrain';
    const ground = buildGround(q);
    root.add(ground);

    const rnd = seeded(2064);
    const n = new THREE.Vector3();
    const w = [0, 0, 0, 0];
    const m4 = new THREE.Matrix4();
    const q4 = new THREE.Quaternion();
    const e = new THREE.Euler();
    const sv = new THREE.Vector3();
    const pv = new THREE.Vector3();
    const color = new THREE.Color();
    const inGorge = (x, z) => x > GORGE.x0 - 0.6 && x < GORGE.x1 + 0.6 && z > GORGE.z0 - 0.6 && z < -15;

    // ---- grama: tufos em células (cada célula é um InstancedMesh → frustum culling por setor)
    const CELLS = 5;
    const cellSize = 96 / CELLS;
    const buckets = Array.from({ length: CELLS * CELLS }, () => []);
    const flowers = [];
    let tries = 0;
    let placed = 0;
    const target = q.grass;
    while (placed < target && tries < target * 6) {
        tries++;
        const a = rnd() * Math.PI * 2;
        const rr = Math.sqrt(rnd()) * 46;
        const x = Math.cos(a) * rr;
        const z = Math.sin(a) * rr;
        if (blocked(x, z) || inGorge(x, z)) continue;
        const y = surfaceAt(x, z);
        normalAt(x, z, n);
        splatAt(x, z, y, n.y, w);
        // densidade segue o peso de grama e manchas de ruído (clareiras naturais)
        const patch = fbm2(x * 0.21 + 9, z * 0.21 + 3, 3);
        if (w[0] < 0.55 || rnd() > w[0] * (0.35 + patch * 0.9)) continue;
        const cx = clamp(Math.floor((x + 48) / cellSize), 0, CELLS - 1);
        const cz = clamp(Math.floor((z + 48) / cellSize), 0, CELLS - 1);
        const s = 0.7 + rnd() * 0.5 + patch * 0.45;
        buckets[cz * CELLS + cx].push({ x, y: y - 0.02, z, s, rot: rnd() * 6.283, tone: patch + (rnd() - 0.5) * 0.3 });
        placed++;
        if (flowers.length < q.flowers && rnd() < 0.09 && patch > 0.42) {
            flowers.push({ x: x + rnd() * 0.3, y, z: z + rnd() * 0.3, s: 0.8 + rnd() * 0.7, rot: rnd() * 6.283, kind: Math.floor(fbm2(x * 0.09, z * 0.09, 2) * 7 + rnd() * 1.4) % 4 });
        }
    }
    // tier baixo (celular): tufos de 6–7 lâminas em vez de 9–10 — ~35 % menos triângulos de grama
    const tufts = q.id === 'low' ? [tuftGeometry(6, 11), tuftGeometry(7, 23)] : [tuftGeometry(9, 11), tuftGeometry(10, 23)];
    const grassMat = applyBladeWind(new THREE.MeshStandardMaterial({
        vertexColors: true, side: THREE.DoubleSide, roughness: 0.78, metalness: 0, envMapIntensity: 0.55
    }), 'grass');
    const grassGroup = new THREE.Group();
    grassGroup.name = 'grass';
    buckets.forEach((list, bi) => {
        if (!list.length) return;
        const mesh = new THREE.InstancedMesh(tufts[bi % 2], grassMat, list.length);
        list.forEach((p, i) => {
            e.set(0, p.rot, 0);
            q4.setFromEuler(e);
            m4.compose(pv.set(p.x, p.y, p.z), q4, sv.set(p.s, p.s * (0.8 + (p.tone % 1) * 0.5), p.s));
            mesh.setMatrixAt(i, m4);
            const t = clamp(p.tone, 0, 1);
            color.setRGB(0.8 + t * 0.45, 0.9 + t * 0.15, 0.6 + (1 - t) * 0.3);
            mesh.setColorAt(i, color);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.computeBoundingSphere();
        grassGroup.add(mesh);
    });
    root.add(grassGroup);

    // ---- flores
    if (flowers.length) {
        const palette = [0xffffff, 0xffd84a, 0xff7fa8, 0xb48cff];
        const fm = new THREE.InstancedMesh(flowerGeometry(), applyBladeWind(new THREE.MeshStandardMaterial({
            vertexColors: true, side: THREE.DoubleSide, roughness: 0.6, envMapIntensity: 0.6
        }), 'flower'), flowers.length);
        flowers.forEach((p, i) => {
            e.set((rnd() - 0.5) * 0.3, p.rot, (rnd() - 0.5) * 0.3);
            q4.setFromEuler(e);
            m4.compose(pv.set(p.x, p.y, p.z), q4, sv.setScalar(p.s));
            fm.setMatrixAt(i, m4);
            fm.setColorAt(i, color.setHex(palette[p.kind]));
        });
        fm.instanceMatrix.needsUpdate = true;
        fm.instanceColor.needsUpdate = true;
        fm.receiveShadow = true;
        fm.computeBoundingSphere();
        fm.name = 'flowers';
        root.add(fm);
    }

    // ---- pedras: 3 moldes instanciados; as grandes viram obstáculo
    const solids = [];
    const rockSpots = [];
    const rockRnd = seeded(77);
    const addRock = (x, z, s, big = false) => {
        if (blocked(x, z) || inGorge(x, z)) return;
        const y = surfaceAt(x, z);
        rockSpots.push({ x, y, z, s, rot: rockRnd() * 6.283, tilt: (rockRnd() - 0.5) * 0.5, v: Math.floor(rockRnd() * 3) });
        if (big) solids.push({ x, z, r: s * 0.8 });
    };
    // matacões fixos (mesmos lugares em todos os tiers: colisão não depende da qualidade)
    for (const [x, z, s] of [[-21, -9, 1.5], [24, -17, 1.7], [-26, 20, 1.3], [27, 24, 1.4], [-6, -27, 1.6], [15, -27, 1.8], [-30, -6, 1.2], [34, 8, 1.3]]) {
        addRock(x, z, s, true);
    }
    const scatter = Math.round(150 * q.rocks);
    for (let i = 0; i < scatter; i++) {
        const a = rockRnd() * Math.PI * 2;
        // metade no sopé da montanha, metade espalhada/na praia
        const onMount = i % 2 === 0;
        const rr = onMount ? 6 + rockRnd() * 13 : 8 + Math.sqrt(rockRnd()) * 38;
        const x = (onMount ? 3 : 0) + Math.cos(a) * rr;
        const z = (onMount ? -26 : 0) + Math.sin(a) * rr;
        if (Math.hypot(x, z) > 47) continue;
        if (Math.abs(x - pathCenter(z)) < 2.6 && z > 0 && z < 22) continue;
        addRock(x, z, 0.14 + rockRnd() * rockRnd() * 0.55);
    }
    const rockMat = rockMaterial();
    for (let v = 0; v < 3; v++) {
        const list = rockSpots.filter((r) => r.v === v);
        if (!list.length) continue;
        const mesh = new THREE.InstancedMesh(rockGeometry(v + 1, q.id === 'low' ? 3 : 6), rockMat, list.length);
        list.forEach((p, i) => {
            e.set(p.tilt, p.rot, p.tilt * 0.6);
            q4.setFromEuler(e);
            m4.compose(pv.set(p.x, p.y - p.s * 0.12, p.z), q4, sv.setScalar(p.s));
            mesh.setMatrixAt(i, m4);
            const k = 0.82 + rockRnd() * 0.3;
            mesh.setColorAt(i, color.setRGB(k, k * 0.97, k * 0.92));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.computeBoundingSphere();
        root.add(mesh);
    }

    return { root, ground, solids, pathCenter };
}
