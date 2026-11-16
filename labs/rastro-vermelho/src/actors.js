/**
 * Cavalo, arreios, cavaleiro e gente da fronteira.
 *
 * Cavalo: horse.glb (Quaternius, CC0) com esqueleto e 13 clipes. A malha original é
 * facetada; aqui as normais são recalculadas por posição: cada vértice recebe a média
 * (ponderada por área) das faces que tocam o mesmo ponto e cujo ângulo com a sua face é
 * menor que ~63° (cos > 0,45) — arestas vivas de casco e orelha sobrevivem.
 * Pelagem: sem UVs, o pelo é procedural no espaço de repouso (manchas largas, estrias
 * finas ao longo do corpo, "meias" escuras nas pernas) + sheen de veludo.
 *
 * Marcha: passo e galope tocam sempre, misturados pelo peso
 *   w_galope = smoothstep(4,5 → 8 m/s),  w_parado = 1 − smoothstep(0,05 → 0,6 m/s)
 * e a velocidade do clipe segue o chão: ciclos/s = v / passada
 *   (passada ≈ 1,9 m ao passo, 6,6 m ao galope) — os cascos não patinam.
 *
 * Pessoas: gfx/human (SkinnedMesh de 17 ossos) vestidas com peças presas aos ossos —
 * chapéu de aba curva e copa vincada, lenço, cinturão, coldre, revólver, esporas.
 */
import * as THREE from 'three';
import { createHead } from './head.js?v=3';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { GLSL_NOISE, place, seeded } from '../../shared/gfx/core.js';
import { createHuman, poseHuman } from '../../shared/gfx/human.js';
import { loadGLTF } from './assets.js?v=14';
import { clamp, damp } from './simulation.js';

const HORSE_SCALE = 0.44; // modelo tem ~5,3 u de comprimento → cavalo de ~2,5 m, cernelha ≈ 1,55 m
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const merge = (list) => mergeGeometries(list.map((g) => { const o = g.index ? g.toNonIndexed() : g; for (const n of Object.keys(o.attributes)) if (n !== 'position' && n !== 'normal') o.deleteAttribute(n); return o; }));

/**
 * Tesselação curva (PN triangles, Vlachos et al. 2001) do cavalo low-poly.
 * Cada passe divide o triângulo em 4; o ponto médio de cada aresta sai da cúbica de Bézier
 * definida pelos extremos e suas normais suaves:
 *   b210 = (2·P1 + P2 − ((P2−P1)·N1)·N1) / 3      b120 = (2·P2 + P1 − ((P1−P2)·N2)·N2) / 3
 *   M    = (P1 + 3·b210 + 3·b120 + P2) / 8
 * As normais são a média (ponderada por área) de todas as faces que tocam a mesma posição,
 * então arestas compartilhadas geram o mesmo ponto — sem frestas entre primitivas.
 * Pesos de skin do ponto médio: média dos dois extremos, 4 maiores influências, renormalizados.
 */
function tessellate(meshes, passes = 2) {
    const key = (x, y, z) => `${Math.round(x * 4e4)},${Math.round(y * 4e4)},${Math.round(z * 4e4)}`;
    let data = meshes.map((m) => {
        const g = m.geometry, p = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, idx = g.index;
        const n = idx ? idx.count : p.count;
        const pos = new Float32Array(n * 3), ji = new Uint16Array(n * 4), jw = new Float32Array(n * 4);
        for (let k = 0; k < n; k++) {
            const i = idx ? idx.getX(k) : k;
            pos[k * 3] = p.getX(i); pos[k * 3 + 1] = p.getY(i); pos[k * 3 + 2] = p.getZ(i);
            for (let c = 0; c < 4; c++) { ji[k * 4 + c] = si.getComponent(i, c); jw[k * 4 + c] = sw.getComponent(i, c); }
        }
        return { pos, ji, jw };
    });
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    for (let pass = 0; pass < passes; pass++) {
        const acc = new Map();
        for (const d of data) {
            for (let f = 0; f < d.pos.length; f += 9) {
                a.fromArray(d.pos, f); b.fromArray(d.pos, f + 3); c.fromArray(d.pos, f + 6);
                n.crossVectors(b.sub(a), c.sub(a));
                for (let v = 0; v < 3; v++) {
                    const k = key(d.pos[f + v * 3], d.pos[f + v * 3 + 1], d.pos[f + v * 3 + 2]);
                    const e = acc.get(k);
                    if (e) e.add(n); else acc.set(k, n.clone());
                }
            }
        }
        for (const v of acc.values()) v.normalize();
        const N = (pos, o) => acc.get(key(pos[o], pos[o + 1], pos[o + 2]));
        data = data.map((d) => {
            const tris = d.pos.length / 9;
            const pos = new Float32Array(tris * 36), ji = new Uint16Array(tris * 48), jw = new Float32Array(tris * 48);
            const P = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
            const W = [null, null, null, null, null, null];
            const mid = (i0, i1, f, out) => {
                const p1 = P[i0], p2 = P[i1], n1 = N(d.pos, f + i0 * 3), n2 = N(d.pos, f + i1 * 3);
                const w12 = b.subVectors(p2, p1).dot(n1), w21 = -b.dot(n2);
                // M = (P1 + P2)/2 − (w12·N1 + w21·N2)/8
                out.addVectors(p1, p2).multiplyScalar(0.5).addScaledVector(n1, -w12 / 8).addScaledVector(n2, -w21 / 8);
            };
            const skin = (v, f) => { const o = (f / 3 + v) * 4, m = new Map(); for (let c = 0; c < 4; c++) if (d.jw[o + c] > 0) m.set(d.ji[o + c], d.jw[o + c]); return m; };
            const blend = (m1, m2) => { const m = new Map(); for (const [k, w] of m1) m.set(k, w * 0.5); for (const [k, w] of m2) m.set(k, (m.get(k) || 0) + w * 0.5); return m; };
            let o = 0;
            const emit = (i) => {
                P[i].toArray(pos, o * 3);
                const top = [...W[i]].sort((x, y) => y[1] - x[1]).slice(0, 4);
                const sum = top.reduce((t, e) => t + e[1], 0) || 1;
                top.forEach((e, c) => { ji[o * 4 + c] = e[0]; jw[o * 4 + c] = e[1] / sum; });
                o++;
            };
            for (let f = 0; f < d.pos.length; f += 9) {
                for (let v = 0; v < 3; v++) { P[v].fromArray(d.pos, f + v * 3); W[v] = skin(v, f); }
                mid(0, 1, f, P[3]); mid(1, 2, f, P[4]); mid(2, 0, f, P[5]);
                W[3] = blend(W[0], W[1]); W[4] = blend(W[1], W[2]); W[5] = blend(W[2], W[0]);
                for (const i of [0, 3, 5, 3, 1, 4, 5, 4, 2, 3, 4, 5]) emit(i);
            }
            return { pos, ji, jw };
        });
    }
    meshes.forEach((m, i) => {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(data[i].pos, 3));
        g.setAttribute('skinIndex', new THREE.BufferAttribute(data[i].ji, 4));
        g.setAttribute('skinWeight', new THREE.BufferAttribute(data[i].jw, 4));
        m.geometry.dispose();
        m.geometry = g;
    });
}

function smoothNormals(meshes) {
    const acc = new Map();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    const key = (p, i) => `${Math.round(p.getX(i) * 4e4)},${Math.round(p.getY(i) * 4e4)},${Math.round(p.getZ(i) * 4e4)}`;
    const faces = [];
    for (const m of meshes) {
        const g = m.geometry, p = g.attributes.position, idx = g.index;
        const count = idx ? idx.count : p.count;
        const fn = new Float32Array(p.count * 3);
        for (let f = 0; f < count; f += 3) {
            const i0 = idx ? idx.getX(f) : f, i1 = idx ? idx.getX(f + 1) : f + 1, i2 = idx ? idx.getX(f + 2) : f + 2;
            a.fromBufferAttribute(p, i0); b.fromBufferAttribute(p, i1); c.fromBufferAttribute(p, i2);
            n.crossVectors(b.sub(a), c.sub(a)); // módulo = 2·área
            for (const i of [i0, i1, i2]) {
                const k = key(p, i);
                if (!acc.has(k)) acc.set(k, []);
                acc.get(k).push(n.x, n.y, n.z);
                fn[i * 3] += n.x; fn[i * 3 + 1] += n.y; fn[i * 3 + 2] += n.z;
            }
        }
        faces.push(fn);
    }
    meshes.forEach((m, mi) => {
        const p = m.geometry.attributes.position, fn = faces[mi], out = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) {
            const list = acc.get(key(p, i));
            a.set(fn[i * 3], fn[i * 3 + 1], fn[i * 3 + 2]).normalize();
            n.set(0, 0, 0);
            if (list) for (let j = 0; j < list.length; j += 3) {
                b.set(list[j], list[j + 1], list[j + 2]);
                const len = b.length();
                if (len > 0 && b.dot(a) / len > 0.45) n.add(b);
            }
            if (n.lengthSq() === 0) n.copy(a);
            n.normalize();
            out[i * 3] = n.x; out[i * 3 + 1] = n.y; out[i * 3 + 2] = n.z;
        }
        m.geometry.setAttribute('normal', new THREE.BufferAttribute(out, 3));
    });
}

const COATS = {
    bay: { main: 0x4c2a15, points: 0x0c0907, hair: 0x0a0807, sock: 0.85 },
    grey: { main: 0x8d8880, points: 0x3a3836, hair: 0x2a2826, sock: 0.5 },
    palomino: { main: 0xa87838, points: 0x8a6230, hair: 0xd8c8a0, sock: 0.0 }
};

function coatMaterials(meshes, coat) {
    const cfg = COATS[coat];
    const main = new THREE.Color(cfg.main);
    const cache = new Map();
    for (const m of meshes) {
        const name = m.material.name;
        if (!cache.has(name)) {
            let mat;
            if (name.startsWith('Main')) {
                const col = main.clone();
                if (name === 'Main_Dark') col.multiplyScalar(0.72);
                if (name === 'Main_Light') col.multiplyScalar(1.22);
                mat = new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.6, metalness: 0, sheen: 0.35, sheenRoughness: 0.5, sheenColor: main.clone().lerp(new THREE.Color(0xffe2b8), 0.3), envMapIntensity: 0.7 });
                mat.onBeforeCompile = (shader) => {
                    shader.uniforms.uSock = { value: cfg.sock };
                    shader.uniforms.uPoints = { value: new THREE.Color(cfg.points) };
                    shader.vertexShader = shader.vertexShader
                        .replace('#include <common>', `#include <common>\nattribute vec3 aRest;\nvarying vec3 vRest;`)
                        .replace('#include <begin_vertex>', `#include <begin_vertex>\nvRest = aRest;`);
                    shader.fragmentShader = shader.fragmentShader
                        .replace('#include <common>', `#include <common>\n${GLSL_NOISE}\nuniform float uSock;\nuniform vec3 uPoints;\nvarying vec3 vRest;\nfloat rvHair;`)
                        .replace('#include <color_fragment>', `#include <color_fragment>
                            float rvDapple = gfxFbm(vRest.zy * 1.1 + vRest.x * 0.7);
                            rvHair = gfxNoise(vec2(vRest.z * 46.0 + vRest.x * 30.0, vRest.y * 7.0 + vRest.x * 5.0));
                            diffuseColor.rgb *= (0.78 + 0.42 * rvDapple) * (0.9 + 0.2 * rvHair);
                            float rvLeg = (1.0 - smoothstep(0.55, 1.75, vRest.y + rvDapple * 0.4)) * uSock;
                            diffuseColor.rgb = mix(diffuseColor.rgb, uPoints, rvLeg);`)
                        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(0.48, 0.72, rvHair);`);
                };
                mat.customProgramCacheKey = () => 'rvCoat';
            } else if (name === 'Hair') mat = new THREE.MeshPhysicalMaterial({ color: cfg.hair, roughness: 0.42, sheen: 0.8, sheenRoughness: 0.3, sheenColor: 0x6a5a4a, envMapIntensity: 0.9 });
            else if (name === 'Hooves') mat = new THREE.MeshStandardMaterial({ color: 0x1c1814, roughness: 0.45 });
            else if (name === 'Muzzle') mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.points).lerp(main, 0.2), roughness: 0.55 });
            else if (name === 'Eye_Black') mat = new THREE.MeshStandardMaterial({ color: 0x050403, roughness: 0.08, envMapIntensity: 1.6 });
            else mat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.3 });
            mat.name = name;
            mat.side = THREE.FrontSide;
            cache.set(name, mat);
        }
        m.material = cache.get(name);
        m.castShadow = true;
        m.receiveShadow = true;
        m.frustumCulled = false;
    }
}

let horseSource = null;
async function horseAsset() {
    if (!horseSource) {
        const gltf = await loadGLTF('assets/horse.glb');
        const meshes = [];
        gltf.scene.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
        tessellate(meshes, 2);
        smoothNormals(meshes);
        // posição de repouso em unidades do modelo (a quantização meshopt vive nas matrizes de bind):
        // serve ao pelo procedural e para medir dorso/focinho
        gltf.scene.updateMatrixWorld(true);
        const v = new THREE.Vector3();
        for (const m of meshes) {
            m.skeleton.update();
            const n = m.geometry.attributes.position.count, rest = new Float32Array(n * 3);
            for (let i = 0; i < n; i++) { m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld); rest[i * 3] = v.x; rest[i * 3 + 1] = v.y; rest[i * 3 + 2] = v.z; }
            m.geometry.setAttribute('aRest', new THREE.BufferAttribute(rest, 3));
        }
        horseSource = gltf;
    }
    return horseSource;
}

/** Instância de cavalo: { root (Group, frente +Z, metros), mixer, actions, bones, info }. */
export async function createHorse(coat = 'bay') {
    const gltf = await horseAsset();
    const model = SkeletonUtils.clone(gltf.scene);
    const meshes = [];
    const bones = {};
    model.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); if (o.isBone) bones[o.name] = o; });
    coatMaterials(meshes, coat);
    model.scale.setScalar(HORSE_SCALE);
    const root = new THREE.Group();
    root.add(model);
    root.updateMatrixWorld(true);
    // mede o dorso e o focinho na pose de repouso (metros, espaço do cavalo)
    const v = new THREE.Vector3();
    const info = { backY: 0, bellyY: 9, halfW: 0, seatZ: 0.2, muzzle: new THREE.Box3(), top: 0, nose: 0 };
    for (const m of meshes) {
        const p = m.geometry.attributes.aRest;
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).multiplyScalar(HORSE_SCALE);
            info.top = Math.max(info.top, v.y); info.nose = Math.max(info.nose, v.z);
        }
    }
    for (const m of meshes) {
        const p = m.geometry.attributes.aRest;
        for (let i = 0; i < p.count; i++) {
            v.fromBufferAttribute(p, i).multiplyScalar(HORSE_SCALE);
            if (Math.abs(v.x) < 0.1 && Math.abs(v.z - info.seatZ) < 0.3) info.backY = Math.max(info.backY, v.y);
            if (Math.abs(v.z - info.seatZ) < 0.2 && v.y > 0.8) { info.halfW = Math.max(info.halfW, Math.abs(v.x)); if (Math.abs(v.x) < 0.1) info.bellyY = Math.min(info.bellyY, v.y); }
            if (v.z > info.nose - 0.16) info.muzzle.expandByPoint(v);
        }
    }
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    return { root, model, mixer, actions, bones, info, meshes };
}

const leather = new THREE.MeshStandardMaterial({ color: 0x33200f, roughness: 0.62, metalness: 0.02 });
const leatherDark = new THREE.MeshStandardMaterial({ color: 0x22140c, roughness: 0.55 });
const steel = new THREE.MeshStandardMaterial({ color: 0x8c8c8a, roughness: 0.32, metalness: 0.9 });
const gunmetal = new THREE.MeshStandardMaterial({ color: 0x25262a, roughness: 0.35, metalness: 0.85 });
const felt = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, side: THREE.DoubleSide });

function blanketTexture() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256;
    const g = c.getContext('2d');
    const bands = ['#7a2a20', '#7a2a20', '#d9c7a0', '#27323a', '#d9c7a0', '#7a2a20', '#b8862e', '#7a2a20', '#27323a', '#7a2a20'];
    bands.forEach((col, i) => { g.fillStyle = col; g.fillRect(0, (i / bands.length) * 256, 64, 256 / bands.length + 1); });
    for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * 64, Math.random() * 256, 1, 3); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}

/** Superfície que veste o dorso: x = a·sin θ, y = −b·(1 − cos θ), com relevo extra lift(θ, z). */
function drape(a, b, th, z0, z1, lift = () => 0, segU = 18, segV = 10, th0 = -th) {
    const pos = [], uv = [], idx = [];
    for (let j = 0; j <= segV; j++) for (let i = 0; i <= segU; i++) {
        const u = i / segU, v = j / segV, t = th0 + (th - th0) * u, z = z0 + (z1 - z0) * v;
        pos.push(a * Math.sin(t), -b * (1 - Math.cos(t)) + lift(t / th, v), z);
        uv.push(v, u);
    }
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) { const p = j * (segU + 1) + i, q = p + 1, r = p + segU + 1, s = r + 1; idx.push(p, q, r, q, s, r); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
}

/** Arreios de vaqueiro presos ao osso do dorso; devolve { group, seat (Object3D do assento) }. */
export function createTack(horse, { bags = true } = {}) {
    const { info } = horse;
    const tack = new THREE.Group();
    // seção do costado ≈ elipse: semi-largura medida na malha, semi-altura = metade de dorso→barriga
    const a = info.halfW + 0.012, b = (info.backY - info.bellyY) * 0.5, y = info.backY, z = info.seatZ;
    const add = (geo, mat, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = true; tack.add(m); return m; };
    const blanket = add(drape(a + 0.012, b, 1.2, -0.42, 0.4), new THREE.MeshStandardMaterial({ map: blanketTexture(), roughness: 0.95, side: THREE.DoubleSide }));
    blanket.position.set(0, y + 0.012, z);
    // assento: sobe na frente (arção) e atrás (patilha)
    const seatLift = (u, v) => 0.03 + 0.1 * sstep(0.72, 1, v) * (1 - u * u * 0.6) + 0.12 * sstep(0.3, 0, v) * (1 - u * u * 0.3) - 0.012 * Math.sin(v * Math.PI);
    const seat = add(drape(a + 0.02, b, 0.92, -0.3, 0.3, seatLift, 16, 12), new THREE.MeshStandardMaterial({ color: 0x3a2411, roughness: 0.5, side: THREE.DoubleSide }));
    seat.position.set(0, y + 0.014, z);
    const parts = [];
    // pito e arção
    parts.push(place(new THREE.CylinderGeometry(0.022, 0.03, 0.1, 10), 0, y + 0.19, z + 0.3, 0.35));
    parts.push(place(new THREE.SphereGeometry(0.04, 12, 8), 0, y + 0.245, z + 0.32, 0, 0, 0, 1, 0.55, 1));
    parts.push(place(new THREE.SphereGeometry(0.1, 14, 8), 0, y + 0.085, z + 0.27, 0, 0, 0, 1.15, 0.5, 0.42));
    // patilha (encosto) em arco
    parts.push(place(new THREE.TorusGeometry(0.2, 0.035, 8, 16, Math.PI), 0, y + 0.03, z - 0.3, -0.35, 0, 0, 1.12, 0.75, 1));
    for (const s of [-1, 1]) {
        // saia e aba (fender) curvas, coladas ao costado; o loro desce até o estribo
        const skirt = drape(a + 0.028, b, s * 1.32, -0.24, 0.24, (u, v) => -0.02 * Math.pow(Math.abs(v - 0.5) * 2, 3), 6, 6, s * 0.85);
        const fender = drape(a + 0.04, b * 1.04, s * 1.72, 0.0, 0.17, (u, v) => 0.0, 8, 3, s * 1.1);
        for (const d of [skirt, fender]) { d.translate(0, y + 0.014, z); parts.push(d); }
    }
    // barrigueira
    parts.push(place(new THREE.TorusGeometry(1, 0.045, 6, 28), 0, y - b, z + 0.1, 0, 0, 0, a + 0.004, b + 0.012, 0.35));
    const lm = add(merge(parts), leather); lm.material = leather.clone(); lm.material.side = THREE.DoubleSide;
    // estribos: criados aqui, posicionados sob as botas do cavaleiro em fitStirrups()
    const stirrups = [-1, 1].map((s) => {
        const g = new THREE.Group();
        const iron = new THREE.Mesh(merge([place(new THREE.TorusGeometry(0.058, 0.01, 6, 14), 0, 0.052, 0, 0, Math.PI / 2, 0), place(new THREE.BoxGeometry(0.05, 0.012, 0.11), 0, 0, 0)]), steel);
        const strap = new THREE.Mesh(place(new THREE.BoxGeometry(0.012, 1, 0.03), 0, 0.5, 0), lm.material);
        iron.castShadow = strap.castShadow = true;
        g.add(iron, strap); g.userData = { strap, side: s };
        tack.add(g);
        return g;
    });
    if (bags) {
        const bag = [];
        for (const s of [-1, 1]) {
            bag.push(place(new THREE.CapsuleGeometry(0.11, 0.12, 4, 10), s * (a + 0.03), y - 0.22, z - 0.52, 0, 0, s * 0.3, 0.55, 1.1, 1.25));
            bag.push(place(new THREE.BoxGeometry(0.02, 0.16, 0.2), s * (a + 0.075), y - 0.14, z - 0.52, 0, 0, s * 0.3));
        }
        bag.push(place(new THREE.BoxGeometry(0.5, 0.02, 0.2), 0, y + 0.03, z - 0.5));
        add(merge(bag), leatherDark);
        const roll = add(place(new THREE.CylinderGeometry(0.085, 0.085, 0.6, 14), 0, y + 0.12, z - 0.44, 0, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x6b6046, roughness: 1 }));
        roll.castShadow = true;
        add(merge([place(new THREE.TorusGeometry(0.088, 0.008, 5, 14), -0.18, y + 0.12, z - 0.44, 0, Math.PI / 2), place(new THREE.TorusGeometry(0.088, 0.008, 5, 14), 0.18, y + 0.12, z - 0.44, 0, Math.PI / 2)]), leatherDark);
    }
    // cabeçada: focinheira + testeira presas à cabeça, argolas do freio para as rédeas
    const mz = info.muzzle, mc = mz.getCenter(new THREE.Vector3()), ms = mz.getSize(new THREE.Vector3());
    const head = new THREE.Group();
    const nb = new THREE.Mesh(place(new THREE.TorusGeometry(1, 0.06, 6, 20), 0, 0, 0, 0.5), leatherDark);
    nb.scale.set(ms.x * 0.56, ms.y * 0.6, ms.x * 0.56);
    nb.position.set(0, mc.y + 0.02, mz.min.z - 0.12);
    head.add(nb);
    const bitL = new THREE.Object3D(), bitR = new THREE.Object3D();
    bitL.position.set(ms.x * 0.5, mc.y - 0.04, mz.min.z - 0.1);
    bitR.position.set(-ms.x * 0.5, mc.y - 0.04, mz.min.z - 0.1);
    head.add(bitL, bitR);
    horse.root.add(tack, head);
    horse.root.updateMatrixWorld(true);
    (horse.bones.Torso || horse.bones.Body).attach(tack);
    (horse.bones.Head || horse.bones.Neck3).attach(head);
    /** Põe cada estribo sob o pé (posição no espaço dos arreios) e estica o loro até a aba da sela. */
    const fitStirrups = (footL, footR) => {
        stirrups.forEach((g, i) => {
            const f = i ? footR : footL;
            g.position.set(f.x, f.y - 0.075, f.z + 0.03);
            const top = y - b * 0.55 - g.position.y;
            g.userData.strap.scale.y = Math.max(0.05, top - 0.1);
            g.userData.strap.position.y = 0.1;
        });
    };
    if (!bags) for (const g of stirrups) g.position.set(g.userData.side * (a + 0.07), y - 0.8, z + 0.09), g.userData.strap.scale.y = 0.4, g.userData.strap.position.y = 0.1;
    return { tack, head, bitL, bitR, seatY: y + 0.05, seatZ: z, fitStirrups };
}

/** Chapéu de vaqueiro: copa torneada com vinco duplo, aba que levanta nas laterais. */
function hatGeometry() {
    const pts = [[0.094, 0], [0.092, 0.045], [0.086, 0.09], [0.072, 0.114], [0.04, 0.124], [0, 0.125]].map(([r, y]) => new THREE.Vector2(r, y));
    const crown = new THREE.LatheGeometry(pts, 28);
    const p = crown.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        if (y > 0.055) {
            const k = (y - 0.055) / 0.07;
            p.setY(i, y - k * (0.03 * Math.exp(-(x * x) / 0.0012) - 0.012 * Math.exp(-Math.pow(Math.abs(x) - 0.045, 2) / 0.0008)));
            p.setX(i, x * (1 - k * 0.22 * Math.max(0, z) / 0.09));
        }
        p.setZ(i, z * 1.16);
    }
    const brim = new THREE.RingGeometry(0.088, 0.225, 40, 5);
    brim.rotateX(-Math.PI / 2);
    const q = brim.attributes.position;
    for (let i = 0; i < q.count; i++) {
        const x = q.getX(i), z = q.getZ(i) * 1.12, r = Math.hypot(x, z), e = sstep(0.09, 0.225, r);
        q.setZ(i, z);
        q.setY(i, 0.002 + e * e * (0.05 * (x * x) / 0.05 - 0.03 * (z * z) / 0.064));
    }
    const band = place(new THREE.CylinderGeometry(0.0935, 0.0955, 0.014, 28, 1, true), 0, 0.011, 0, 0, 0, 0, 1, 1, 1.16);
    crown.computeVertexNormals(); brim.computeVertexNormals();
    return { felt: merge([crown, brim]), band };
}

function revolverGeometry() {
    // cano ao longo de −Y (direção dos dedos), coronha para −Z
    const g = [
        place(new THREE.CylinderGeometry(0.0085, 0.0095, 0.16, 8), 0, -0.13, 0.012),
        place(new THREE.BoxGeometry(0.014, 0.15, 0.008), 0, -0.125, 0.0),
        place(new THREE.CylinderGeometry(0.021, 0.021, 0.05, 10), 0, -0.03, 0.006),
        place(new THREE.BoxGeometry(0.018, 0.085, 0.04), 0, -0.02, 0.0),
        place(new THREE.BoxGeometry(0.01, 0.022, 0.014), 0, 0.022, 0.022, 0.5),
        place(new THREE.TorusGeometry(0.016, 0.003, 4, 10), 0, -0.022, -0.028, 0, Math.PI / 2)
    ];
    const grip = place(new THREE.BoxGeometry(0.022, 0.045, 0.095), 0, 0.03, -0.05, 0.42);
    return { metal: merge(g), grip };
}

let gear = null;
function gearKit() {
    if (!gear) gear = { hat: hatGeometry(), gun: revolverGeometry() };
    return gear;
}

/**
 * Veste uma pessoa do kit com roupa de fronteira. Devolve { hat, gun, holsterGun }.
 * mask = lenço cobrindo o rosto (bandido).
 */
function dress(h, { hatColor = 0x3a2a1c, bandColor = 0x1a120c, scarfColor = 0x8e3027, mask = false, armed = true, belt = true, stubble = false, mustache = false, eyes = 0x4a3020 } = {}) {
    const b = h.bones, kit = gearKit(), out = {};
    // A cabeça-manequim do kit colapsa (osso em escala 1/1000) e dá lugar à cabeça esculpida,
    // pendurada num proxy de escala inversa: segue a rotação do osso em tamanho real.
    const HEAD_EPS = 1e-3;
    b.head.scale.setScalar(HEAD_EPS);
    const headProxy = new THREE.Group();
    headProxy.scale.setScalar(1 / HEAD_EPS);
    b.head.add(headProxy);
    headProxy.add(createHead({ skin: h.opts.skin, hair: h.opts.hair, eyes, stubble, mustache: mustache && !mask }));
    const hat = new THREE.Group();
    const hm = new THREE.Mesh(kit.hat.felt, felt(hatColor)); hm.castShadow = true;
    hat.add(hm, new THREE.Mesh(kit.hat.band, new THREE.MeshStandardMaterial({ color: bandColor, roughness: 0.6 })));
    hat.position.set(0, 0.168, -0.006); hat.rotation.x = -0.06;
    headProxy.add(hat); out.hat = hat;
    const scarfMat = new THREE.MeshStandardMaterial({ color: scarfColor, roughness: 0.9, side: THREE.DoubleSide });
    const scarf = [place(new THREE.TorusGeometry(0.066, 0.02, 6, 16), 0, 0.0, 0.004, Math.PI / 2 - 0.25, 0, 0, 1, 1.12, 1)];
    scarf.push(place(new THREE.ConeGeometry(0.075, 0.13, 3, 1, true), 0, -0.07, 0.068, Math.PI + 0.25, Math.PI / 3, 0, 1, 1, 0.35));
    const sc = new THREE.Mesh(merge(scarf), scarfMat); sc.castShadow = true; b.neck.add(sc);
    if (mask) {
        const mk = new THREE.Mesh(place(new THREE.SphereGeometry(0.086, 18, 10, 0, Math.PI * 2, Math.PI * 0.4, Math.PI * 0.4), 0, 0.088, 0.018, 0, 0, 0, 0.98, 1.05, 1.36), scarfMat);
        headProxy.add(mk);
    }
    if (belt) {
        const bl = [place(new THREE.TorusGeometry(1, 0.11, 6, 22), 0, 0.045, 0.0, Math.PI / 2, 0, 0, 0.165, 0.118, 0.2), place(new THREE.BoxGeometry(0.045, 0.04, 0.012), 0, 0.045, 0.125)];
        const blm = new THREE.Mesh(merge(bl), leatherDark); b.hips.add(blm);
        const holster = new THREE.Mesh(merge([place(new THREE.BoxGeometry(0.04, 0.17, 0.065), -0.085, -0.1, 0.0, 0, 0, -0.06), place(new THREE.BoxGeometry(0.02, 0.06, 0.03), -0.09, 0.0, 0.0)]), leather);
        b.thighR.add(holster);
    }
    if (armed) {
        const gun = new THREE.Group();
        gun.add(new THREE.Mesh(kit.gun.metal, gunmetal), new THREE.Mesh(kit.gun.grip, new THREE.MeshStandardMaterial({ color: 0x5a3018, roughness: 0.5 })));
        gun.position.set(0.0, -0.085, 0.03);
        b.handR.add(gun); out.gun = gun;
        out.muzzle = new THREE.Object3D(); out.muzzle.position.set(0, -0.215, 0.012); gun.add(out.muzzle);
    }
    return out;
}

const R = (bone, x = 0, y = 0, z = 0) => bone.rotation.set(x, y, z);

/**
 * Pose montada. Quadril no assento, coxas abraçando o costado, calcanhares baixos.
 * aim ∈ [0,1] ergue o braço direito na direção `aimYaw` (rad, relativa ao cavalo) e `aimPitch`.
 */
function poseRider(h, t, speed, lean, aim, aimYaw, aimPitch) {
    const b = h.bones, g = clamp(speed / 14, 0, 1), bob = Math.sin(t) * 0.5 + 0.5;
    R(b.thighL, -1.12, 0, 0.5); R(b.thighR, -1.12, 0, -0.5);
    R(b.shinL, 1.28 - g * 0.12, 0, 0); R(b.shinR, 1.28 - g * 0.12, 0, 0);
    R(b.footL, -0.22, 0.25, 0); R(b.footR, -0.22, -0.25, 0);
    R(b.hips, 0.04 + g * 0.2 + bob * 0.03 * g, 0, lean * 0.6);
    R(b.spine, 0.06 + g * 0.1 - bob * 0.04 * g, -aimYaw * 0.25 * aim, lean * 0.5);
    R(b.chest, 0.04 + g * 0.06, -aimYaw * 0.3 * aim, 0);
    R(b.neck, -0.1 - g * 0.16, -aimYaw * 0.25 * aim, -lean * 0.4);
    R(b.head, -0.06 - g * 0.12, -aimYaw * 0.2 * aim, -lean * 0.4);
    // mão esquerda nas rédeas, à frente do arção
    R(b.armL, -0.52 - g * 0.22 + bob * 0.05 * g, 0, 0.02); R(b.foreL, -1.05 + bob * 0.08 * g, 0, -0.42); R(b.handL, -0.1, 0, 0);
    // direita: descansa na coxa ou aponta
    const ax = THREE.MathUtils.lerp(-0.34, -1.5 + aimPitch, aim), ay = THREE.MathUtils.lerp(0, -aimYaw * 0.3, aim), az = THREE.MathUtils.lerp(-0.1, -0.08, aim);
    R(b.armR, ax, ay, az); R(b.foreR, THREE.MathUtils.lerp(-0.95, -0.08, aim), 0, THREE.MathUtils.lerp(0.3, 0, aim)); R(b.handR, 0, 0, 0);
    b.hips.position.set(0, h.hipsRest, 0);
}

/** Cavalo do jogador com arreios e cavaleiro. API: root, update(dt, speed, steer, aim), muzzleWorld(v). */
export async function createMount() {
    const horse = await createHorse('bay');
    const tack = createTack(horse);
    const rider = createHuman({ height: 1.8, build: 1.05, skin: 0xb98a66, hair: 0x2a1a10, top: 'jacket', topColor: 0x6a5842, bottom: 'pants', bottomColor: 0x34383c, shoes: 'boot', shoeColor: 0x2b1c12, hat: 'none', detail: 2 });
    const kit = dress(rider, { hatColor: 0x4a3c2c, scarfColor: 0x9a2e22, stubble: true, mustache: true });
    const s = rider.object.scale.x;
    rider.object.position.set(0, tack.seatY + 0.085 - rider.hipsRest * s, tack.seatZ - 0.03);
    tack.tack.add(rider.object);
    rider.object.frustumCulled = false;
    // rédeas: duas linhas do freio até a mão esquerda, recalculadas a cada quadro
    const reinGeo = new THREE.BufferGeometry();
    const reinPos = new Float32Array(2 * 12 * 3);
    reinGeo.setAttribute('position', new THREE.BufferAttribute(reinPos, 3).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let k = 0; k < 2; k++) for (let i = 0; i < 11; i++) idx.push(k * 12 + i, k * 12 + i + 1);
    reinGeo.setIndex(idx);
    const reins = new THREE.LineSegments(reinGeo, new THREE.LineBasicMaterial({ color: 0x1c110a }));
    reins.frustumCulled = false;
    horse.root.add(reins);

    // pés no estribo: posa uma vez, lê a posição das botas no espaço dos arreios
    poseRider(rider, 0, 0, 0, 0, 0, 0);
    horse.root.updateMatrixWorld(true);
    const tinv = new THREE.Matrix4().copy(tack.tack.matrixWorld).invert();
    tack.fitStirrups(rider.bones.footL.getWorldPosition(new THREE.Vector3()).applyMatrix4(tinv), rider.bones.footR.getWorldPosition(new THREE.Vector3()).applyMatrix4(tinv));
    for (const n of ['Idle', 'Walk', 'Gallop']) { horse.actions[n].play(); horse.actions[n].setEffectiveWeight(n === 'Idle' ? 1 : 0); }
    const st = { wIdle: 1, wGallop: 0, t: 0, aim: 0, lean: 0 };
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), inv = new THREE.Matrix4();
    const api = {
        root: horse.root, horse, rider, kit, state: st,
        update(dt, speed, steer, aiming, aimYaw = 0, aimPitch = 0) {
            const wIdle = 1 - sstep(0.05, 0.6, speed), wGallop = sstep(4.5, 8, speed);
            st.wIdle = damp(st.wIdle, wIdle, 8, dt); st.wGallop = damp(st.wGallop, wGallop, 5, dt);
            const move = 1 - st.wIdle;
            horse.actions.Idle.setEffectiveWeight(st.wIdle);
            horse.actions.Walk.setEffectiveWeight(move * (1 - st.wGallop));
            horse.actions.Gallop.setEffectiveWeight(move * st.wGallop);
            // ciclos/s = v / passada; duração dos clipes: passo 1,167 s, galope 0,6 s
            horse.actions.Walk.setEffectiveTimeScale(clamp((speed / 1.9) * 1.167, 0.6, 2.4));
            horse.actions.Gallop.setEffectiveTimeScale(clamp((speed / 6.6) * 0.6, 0.75, 1.7));
            horse.mixer.update(dt);
            st.t += dt * (speed > 6 ? clamp(speed / 6.6, 0.75, 1.7) * Math.PI * 2 / 0.6 : 3 + speed);
            st.aim = damp(st.aim, aiming ? 1 : 0, aiming ? 18 : 5, dt);
            st.lean = damp(st.lean, -steer * 0.1 * clamp(speed / 9, 0, 1), 5, dt);
            poseRider(rider, st.t, speed, st.lean, st.aim, aimYaw, aimPitch);
            horse.root.updateMatrixWorld(true);
            inv.copy(horse.root.matrixWorld).invert();
            rider.bones.handL.getWorldPosition(pb).applyMatrix4(inv);
            pb.y -= 0.08;
            [tack.bitL, tack.bitR].forEach((bit, k) => {
                bit.getWorldPosition(pa).applyMatrix4(inv);
                for (let i = 0; i < 12; i++) {
                    const u = i / 11, sag = Math.sin(u * Math.PI) * 0.13;
                    reinPos[(k * 12 + i) * 3] = pa.x + (pb.x - pa.x) * u + (k ? -1 : 1) * Math.sin(u * Math.PI) * 0.05;
                    reinPos[(k * 12 + i) * 3 + 1] = pa.y + (pb.y - pa.y) * u - sag;
                    reinPos[(k * 12 + i) * 3 + 2] = pa.z + (pb.z - pa.z) * u;
                }
            });
            reinGeo.attributes.position.needsUpdate = true;
        },
        muzzleWorld(v) { return kit.muzzle.getWorldPosition(v); }
    };
    return api;
}

const OUTLAWS = [
    { topColor: 0x2c2622, bottomColor: 0x262422, hatColor: 0x161310, scarfColor: 0x7a1f1a, skin: 0xa9744c },
    { topColor: 0x3b3329, bottomColor: 0x2a2620, hatColor: 0x2a2018, scarfColor: 0x1e2a36, skin: 0xc68e62 },
    { topColor: 0x4a2f24, bottomColor: 0x1f1d1c, hatColor: 0x1c1814, scarfColor: 0x5a5030, skin: 0x8a5a3a },
    { topColor: 0x25282c, bottomColor: 0x2c2520, hatColor: 0x33271c, scarfColor: 0x7a1f1a, skin: 0xe2b48c }
];

/** Fora-da-lei a pé. update(dt, warning, dead) cuida de mira e queda. */
export function createOutlaw(i = 0) {
    const o = OUTLAWS[i % OUTLAWS.length];
    const h = createHuman({ height: 1.72 + (i % 3) * 0.04, build: 1 + (i % 2) * 0.1, skin: o.skin, hair: 0x1a120c, top: 'jacket', topColor: o.topColor, bottom: 'pants', bottomColor: o.bottomColor, shoes: 'boot', shoeColor: 0x1c1410, hat: 'none', detail: 2 });
    const kit = dress(h, { hatColor: o.hatColor, scarfColor: o.scarfColor, mask: true, stubble: i % 2 === 0, eyes: [0x2a1c12, 0x4a5a5c, 0x3a2a18][i % 3] });
    const root = new THREE.Group();
    root.add(h.object);
    const st = { aim: 0, fall: 0, t: i * 1.7 };
    return {
        root, human: h, kit,
        update(dt, warning, dead) {
            st.t += dt;
            st.aim = damp(st.aim, warning ? 1 : 0.25, 9, dt);
            if (dead) st.fall = Math.min(1, st.fall + dt * 2.6); else st.fall = 0;
            poseHuman(h, 'idle', st.t);
            const b = h.bones;
            R(b.armR, THREE.MathUtils.lerp(-0.25, -1.48, st.aim), 0, -0.1);
            R(b.foreR, THREE.MathUtils.lerp(-0.7, -0.06, st.aim), 0, 0);
            R(b.thighL, -0.12, 0, 0.1); R(b.thighR, 0.14, 0, -0.1); R(b.shinR, 0.12);
            // queda: tomba para trás com um quique amortecido
            const f = st.fall, e = f * f * (3 - 2 * f);
            h.object.rotation.x = -e * 1.5 + Math.sin(f * Math.PI) * 0.12 * (1 - f);
            h.object.position.y = e * 0.13;
            if (f > 0) { R(b.armL, -0.4 * e, 0, 1.2 * e); R(b.armR, -0.3, 0, -1.1 * e); R(b.thighL, -0.3 * e, 0, 0.2); R(b.shinL, 0.6 * e); }
        },
        muzzleWorld(v) { return kit.muzzle.getWorldPosition(v); }
    };
}

const FOLK = [
    { top: 'long', topColor: 0x8a8f96, bottom: 'pants', bottomColor: 0x3a3028, hatColor: 0x5a4a38, scarfColor: 0x2a4a5a, skin: 0xc68e62 },
    { top: 'jacket', topColor: 0x5a4636, bottom: 'pants', bottomColor: 0x2e2a26, hatColor: 0x8a7a5c, scarfColor: 0x8e3027, skin: 0x8a5a3a },
    { top: 'long', topColor: 0x9a4a3a, bottom: 'pants', bottomColor: 0x40382e, hatColor: 0x2c2018, scarfColor: 0xc9b070, skin: 0xe2b48c },
    { top: 'jacket', topColor: 0x3d4a3a, bottom: 'pants', bottomColor: 0x2a2622, hatColor: 0x4a3a28, scarfColor: 0x7a2a20, skin: 0xa9744c }
];

/** Morador/companheiro de acampamento (sem arma). mode: sit | idle | talk | lean. */
export function createFolk(i = 0, mode = 'idle') {
    const o = FOLK[i % FOLK.length];
    const h = createHuman({ height: 1.7 + (i % 4) * 0.03, build: 0.95 + (i % 3) * 0.08, skin: o.skin, hair: i % 2 ? 0x5a3a1e : 0x241710, top: o.top, topColor: o.topColor, bottom: o.bottom, bottomColor: o.bottomColor, shoes: 'boot', shoeColor: 0x2a1c12, hat: 'none', detail: 2 });
    dress(h, { hatColor: o.hatColor, scarfColor: o.scarfColor, armed: false, belt: i % 2 === 0, stubble: i % 3 === 0, mustache: i % 2 === 1, eyes: [0x4a3020, 0x52605e, 0x2a1c12][i % 3] });
    const t0 = seeded(i + 5)() * 10;
    return { root: h.object, human: h, update(t) { poseHuman(h, mode, t + t0); } };
}

/** Cavalo amarrado (sem cavaleiro), pastando ou parado. */
export async function createTetheredHorse(coat, clip = 'Idle_2', saddled = true) {
    const horse = await createHorse(coat);
    if (saddled) createTack(horse, { bags: false });
    const action = horse.actions[clip] || horse.actions.Idle;
    action.play();
    horse.mixer.update(Math.random() * 3);
    return { root: horse.root, update(dt) { horse.mixer.update(dt); } };
}
