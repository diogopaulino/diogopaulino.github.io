/**
 * Modelos da Ilha da Cúpola — tudo procedural, mas modelado de verdade: perfis torneados
 * (LatheGeometry), extrusões chanfradas, tubos ao longo de curvas e malhas deformadas por
 * ruído, fundidos por material (poucos draw calls) e pintados por cor de vértice.
 *
 * Convenções:
 *   - 1 unidade = 1 m; origem dos modelos no chão (y = 0), frente em +Z.
 *   - Perfis de torno sempre de baixo para cima (normais para fora).
 *   - UVs em metros (applyWorldUV / latheUV) para as texturas PBR do kit não esticarem.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { textureSet } from '../../shared/gfx/textures.js';
import { wind } from '../../shared/gfx/flora.js';
import { applyWorldUV, paint, place, normalizeForMerge, seeded, fbm2 } from '../../shared/gfx/core.js';
import { rockGeometry, rockMaterial, smoothNormals } from './terrain.js?v=15';

const V2 = (x, y) => new THREE.Vector2(x, y);
const cache = new Map();
const cached = (key, make) => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
};

// ------------------------------------------------------------------ materiais

function texMat(name, { normalScale = 1, ...opts } = {}) {
    const set = textureSet(name);
    const Ctor = opts.clearcoat || opts.sheen ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    const m = new Ctor({
        map: set.map, normalMap: set.normalMap, roughnessMap: set.roughnessMap,
        roughness: 1, metalness: 0, vertexColors: true, ...opts
    });
    m.normalScale.set(normalScale, normalScale);
    return m;
}

/** Materiais compartilhados (uma instância por tipo → shaders e draw calls enxutos). */
export const MAT = {
    // a cantaria do kit é granito cinza (albedo ~0,45): o ganho de cor devolve o pêssego claro do castelo
    get stone() { return cached('m:stone', () => { const m = texMat('ashlar', { normalScale: 1.25, envMapIntensity: 0.9 }); m.color.setRGB(2.0, 1.74, 1.6); return m; }); },
    get roof() { return cached('m:roof', () => texMat('roofTile', { normalScale: 1.2, envMapIntensity: 0.9 })); },
    get wood() { return cached('m:wood', () => texMat('woodPlanks', { normalScale: 1.1, envMapIntensity: 0.8 })); },
    get plaster() { return cached('m:plaster', () => texMat('plaster', { envMapIntensity: 0.9 })); },
    get grass() { return cached('m:grass', () => texMat('grass', { envMapIntensity: 0.7 })); },
    get rock() { return cached('m:rock', () => { const m = rockMaterial(0xffffff); m.vertexColors = true; return m; }); },
    get gold() {
        return cached('m:gold', () => new THREE.MeshStandardMaterial({
            color: 0xffc64a, metalness: 1, roughness: 0.24, envMapIntensity: 1.35,
            emissive: 0x4a2a00, emissiveIntensity: 0.35
        }));
    },
    get iron() { return cached('m:iron', () => new THREE.MeshStandardMaterial({ color: 0x2c2d33, metalness: 0.9, roughness: 0.42 })); },
    /** tinta/vinil fosco com cor de vértice (personagens e adereços) */
    get matte() { return cached('m:matte', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.85 })); },
    /** verniz brilhante com cor de vértice (olhos, botas, bomba) */
    get gloss() {
        return cached('m:gloss', () => new THREE.MeshPhysicalMaterial({
            vertexColors: true, roughness: 0.3, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.1
        }));
    },
    /** vidro de janela aceso por dentro */
    get window() {
        return cached('m:window', () => new THREE.MeshStandardMaterial({
            color: 0x1c2436, emissive: 0xffb45e, emissiveIntensity: 1.5, roughness: 0.12, metalness: 0.2
        }));
    },
    get lamp() { return cached('m:lamp', () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 1.7, 0.7) })); }
};

/** Vitral: gomos coloridos com chumbo entre as peças. mode 'rose' (rosácea) ou 'dome' (painéis). */
function stainedGlass(mode) {
    return cached(`vitral:${mode}`, () => {
        const S = 512;
        const c = document.createElement('canvas');
        c.width = c.height = S;
        const g = c.getContext('2d');
        const jewel = ['#e63946', '#ffb703', '#2a9d8f', '#3a86ff', '#8338ec', '#ff7b54', '#06d6a0', '#ffd166'];
        g.fillStyle = '#17110d';
        g.fillRect(0, 0, S, S);
        if (mode === 'rose') {
            const cx = S / 2;
            const rings = [[236, 150, 12], [146, 78, 8], [74, 0, 6]];
            rings.forEach(([r1, r0, n], ri) => {
                for (let i = 0; i < n; i++) {
                    const a0 = (i / n) * Math.PI * 2 + ri * 0.26;
                    const a1 = a0 + (Math.PI * 2) / n;
                    const mid = (a0 + a1) / 2;
                    g.beginPath();
                    g.moveTo(cx + Math.cos(a0) * r0, cx + Math.sin(a0) * r0);
                    g.quadraticCurveTo(cx + Math.cos(a0) * r1, cx + Math.sin(a0) * r1, cx + Math.cos(mid) * (r1 + 4), cx + Math.sin(mid) * (r1 + 4));
                    g.quadraticCurveTo(cx + Math.cos(a1) * r1, cx + Math.sin(a1) * r1, cx + Math.cos(a1) * r0, cx + Math.sin(a1) * r0);
                    g.closePath();
                    const col = jewel[(i * 3 + ri * 2) % jewel.length];
                    const gr = g.createRadialGradient(cx, cx, r0, cx, cx, r1);
                    gr.addColorStop(0, col);
                    gr.addColorStop(1, '#fff6d8');
                    g.fillStyle = ri === 2 ? '#ffd166' : gr;
                    g.fill();
                    g.lineWidth = 9;
                    g.strokeStyle = '#17110d';
                    g.stroke();
                }
            });
            // estrela central
            g.beginPath();
            for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
                const r = i % 2 ? 22 : 52;
                g.lineTo(cx + Math.cos(a) * r, cx + Math.sin(a) * r);
            }
            g.closePath();
            g.fillStyle = '#fff3b0';
            g.fill();
            g.lineWidth = 6;
            g.stroke();
        } else {
            // 16 gomos × 4 faixas; u dá a volta na cúpula, v sobe até o lanternim
            const cols = 16;
            const rows = 4;
            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    g.fillStyle = jewel[(i + j * 3) % jewel.length];
                    g.globalAlpha = 0.82 + ((i * 7 + j * 3) % 5) * 0.045;
                    g.fillRect((i * S) / cols, (j * S) / rows, S / cols, S / rows);
                    // losango claro no meio de cada painel
                    g.globalAlpha = 0.55;
                    g.fillStyle = '#fff6d8';
                    g.beginPath();
                    const px = ((i + 0.5) * S) / cols;
                    const py = ((j + 0.5) * S) / rows;
                    g.moveTo(px, py - 34);
                    g.lineTo(px + 9, py);
                    g.lineTo(px, py + 34);
                    g.lineTo(px - 9, py);
                    g.fill();
                }
            }
            g.globalAlpha = 1;
            g.strokeStyle = '#17110d';
            g.lineWidth = 6;
            for (let i = 0; i <= cols; i++) { g.beginPath(); g.moveTo((i * S) / cols, 0); g.lineTo((i * S) / cols, S); g.stroke(); }
            for (let j = 0; j <= rows; j++) { g.beginPath(); g.moveTo(0, (j * S) / rows); g.lineTo(S, (j * S) / rows); g.stroke(); }
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
        t.wrapS = THREE.RepeatWrapping;
        return new THREE.MeshStandardMaterial({
            map: t, emissiveMap: t, emissive: 0xffffff, emissiveIntensity: mode === 'rose' ? 1.25 : 0.85,
            roughness: 0.14, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 1.2
        });
    });
}

/** Estandarte/bandeira coral com estrela dourada. */
function bannerTexture() {
    return cached('banner', () => {
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 256;
        const g = c.getContext('2d');
        const gr = g.createLinearGradient(0, 0, 0, 256);
        gr.addColorStop(0, '#ff7a5c');
        gr.addColorStop(1, '#d94a3a');
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 256);
        g.fillStyle = '#ffd35a';
        g.fillRect(0, 0, 128, 12);
        g.fillRect(0, 244, 128, 12);
        g.fillRect(0, 0, 8, 256);
        g.fillRect(120, 0, 8, 256);
        g.beginPath();
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
            const r = i % 2 ? 17 : 40;
            g.lineTo(64 + Math.cos(a) * r, 118 + Math.sin(a) * r);
        }
        g.closePath();
        g.fill();
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
    });
}

/**
 * Tecido ao vento. aWind (0 preso → 1 solto) escala a onda viajante:
 *   Δn = sin(k·s − ω·t + φ) · A · aWind,  s = distância ao longo do pano.
 * `axis` é o eixo local do deslocamento ('z' para panos no plano XY).
 */
function clothMaterial(key = 'banner') {
    return cached(`cloth:${key}`, () => {
        const set = textureSet('cloth');
        const m = new THREE.MeshStandardMaterial({
            map: bannerTexture(), normalMap: set.normalMap, roughness: 0.82, side: THREE.DoubleSide, envMapIntensity: 0.8
        });
        m.normalScale.set(0.5, 0.5);
        m.onBeforeCompile = (shader) => {
            shader.uniforms.uWindTime = wind.uWindTime;
            shader.uniforms.uWindStrength = wind.uWindStrength;
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', `#include <common>
                    attribute float aWind;
                    uniform float uWindTime;
                    uniform float uWindStrength;`)
                .replace('#include <begin_vertex>', `#include <begin_vertex>
                    float cuPh = modelMatrix[3].x * 0.7 + modelMatrix[3].z * 0.4;
                    float cuS = aWind * (0.6 + 0.5 * uWindStrength);
                    transformed.z += sin(aWind * 5.5 - uWindTime * 4.2 + cuPh) * 0.16 * cuS
                                   + sin(aWind * 11.0 - uWindTime * 7.1 + cuPh * 2.0) * 0.045 * cuS;
                    transformed.y += sin(aWind * 4.0 - uWindTime * 3.1 + cuPh) * 0.03 * cuS;`);
        };
        m.customProgramCacheKey = () => 'cupolaCloth';
        return m;
    });
}

// ------------------------------------------------------------------ geometria utilitária

/** Laje retangular chanfrada: base em y = 0, topo em y = h. */
function slab(w, d, h, bevel = 0.05) {
    const b = Math.min(bevel, h * 0.45, w * 0.2, d * 0.2);
    const s = new THREE.Shape();
    const hw = w / 2 - b;
    const hd = d / 2 - b;
    s.moveTo(-hw, -hd);
    s.lineTo(hw, -hd);
    s.lineTo(hw, hd);
    s.lineTo(-hw, hd);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: h - b * 2, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, b, 0);
    return g;
}

/** Torno com UV em metros: u = volta (repete inteiro), v = altura / escala. */
function lathe(points, segs = 32, radius = 1, scale = 2, phiStart = 0, phiLength = Math.PI * 2) {
    const g = new THREE.LatheGeometry(points, segs, phiStart, phiLength);
    const uv = g.attributes.uv;
    const pos = g.attributes.position;
    const rep = Math.max(1, Math.round((2 * Math.PI * radius) / scale));
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * rep, pos.getY(i) / scale);
    return g;
}

/** Cápsula afilada pendurada em −Y: raio r0 no topo (y = 0) e r1 na ponta (y = −len). */
function limb(r0, r1, len, segs = 14) {
    const pts = [];
    const cap = 5;
    for (let i = 0; i <= cap; i++) {
        const a = (i / cap) * Math.PI * 0.5;
        pts.push(V2(Math.max(0.0005, Math.sin(a) * r1), -len - Math.cos(a) * r1));
    }
    for (let i = cap; i >= 0; i--) {
        const a = (i / cap) * Math.PI * 0.5;
        pts.push(V2(Math.max(0.0005, Math.sin(a) * r0), Math.cos(a) * r0));
    }
    return new THREE.LatheGeometry(pts, segs);
}

function ellipsoid(rx, ry, rz, w = 18, h = 12) {
    const g = new THREE.SphereGeometry(1, w, h);
    g.scale(rx, ry, rz);
    return g;
}

/** Estrela de 5 pontas gordinha (pontas arredondadas por curvas quadráticas). */
function starShape(R = 0.5, r = 0.24, round = 0.5) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
        const rad = i % 2 ? r : R;
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    const s = new THREE.Shape();
    const mid = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    for (let i = 0; i < 10; i++) {
        const prev = pts[(i + 9) % 10];
        const cur = pts[i];
        const next = pts[(i + 1) % 10];
        const k = i % 2 ? round * 0.35 : round;
        const a = mid(cur, prev, k * 0.5);
        const b = mid(cur, next, k * 0.5);
        if (i === 0) s.moveTo(a[0], a[1]);
        else s.lineTo(a[0], a[1]);
        s.quadraticCurveTo(cur[0], cur[1], b[0], b[1]);
    }
    s.closePath();
    return s;
}

function starGeometry(R, depth, bevel) {
    const g = new THREE.ExtrudeGeometry(starShape(R, R * 0.5, 0.55), {
        depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 6
    });
    g.translate(0, 0, -depth / 2);
    return g;
}

/** Coletor: junta geometrias por material e devolve um grupo com 1 mesh por material. */
class Kit {
    constructor() {
        this.bins = new Map();
    }

    /** uvScale > 0 → reprojeta UVs em metros depois de posicionar. */
    add(key, geometry, color = 0xffffff, uvScale = 0) {
        if (uvScale) applyWorldUV(geometry, uvScale);
        paint(geometry, color);
        if (!this.bins.has(key)) this.bins.set(key, []);
        this.bins.get(key).push(geometry);
        return this;
    }

    build(materials, { castShadow = true, receiveShadow = true } = {}) {
        const group = new THREE.Group();
        for (const [key, list] of this.bins) {
            const geo = mergeGeometries(normalizeForMerge(list));
            for (const g of list) g.dispose();
            const mesh = new THREE.Mesh(geo, materials[key]);
            mesh.name = key;
            mesh.castShadow = castShadow && !materials[key].isMeshBasicMaterial;
            mesh.receiveShadow = receiveShadow;
            group.add(mesh);
        }
        return group;
    }
}

/** Pano subdividido com aWind crescendo ao longo de `along` ('x' ou 'y'), preso na origem. */
function clothGeometry(w, h, along = 'y') {
    const g = new THREE.PlaneGeometry(w, h, along === 'x' ? 14 : 6, along === 'y' ? 14 : 6);
    const pos = g.attributes.position;
    const a = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
        a[i] = along === 'y' ? (h / 2 - pos.getY(i)) / h : (pos.getX(i) + w / 2) / w;
    }
    g.setAttribute('aWind', new THREE.BufferAttribute(a, 1));
    if (along === 'y') g.translate(0, -h / 2, 0);
    else g.translate(w / 2, 0, 0);
    return g;
}

// ------------------------------------------------------------------ Nico

const SKIN = 0xffcda4;
const TEAL = 0x1fa596;
const TEAL_D = 0x157a70;
const CREAM = 0xfff1dc;
const CORAL = 0xff6a4d;
const HAIR = 0x5a2f16;
const BOOT = 0x5b3320;
const GLOVE = 0xfbf7ee;

/**
 * Nico — herói de vinil articulado: quadril → tronco, cabeça, braços (ombro/cotovelo/mão)
 * e pernas (quadril/joelho/pé). Cada segmento é uma malha lisa fundida; as juntas se
 * sobrepõem em cápsulas para não abrir frestas quando dobram.
 * Altura ≈ 1,28 m (cabeça grande, proporção de 2,6 cabeças).
 */
export function createNico() {
    const root = new THREE.Group();
    root.name = 'nico';
    root.rotation.order = 'YXZ';

    // pivô do salto mortal (centro de massa) e escala global
    const tilt = new THREE.Group();
    tilt.position.y = 0.62;
    root.add(tilt);
    const rig = new THREE.Group();
    rig.position.y = -0.62;
    rig.scale.setScalar(0.92);
    tilt.add(rig);

    const hips = new THREE.Group();
    hips.name = 'hips';
    hips.position.y = 0.47;
    rig.add(hips);

    const mk = (kit, mats = { matte: MAT.matte, gloss: MAT.gloss, gold: MAT.gold }) => kit.build(mats);
    const Z = 0.86; // achatamento do tronco em profundidade

    // ---- tronco: camisa creme + macacão teal (calça, peitilho e alças) + botões dourados
    const torso = new Kit();
    const shirt = new THREE.LatheGeometry([
        V2(0.001, -0.02), V2(0.1, -0.015), V2(0.172, 0.03), V2(0.2, 0.1), V2(0.204, 0.18), V2(0.19, 0.27),
        V2(0.166, 0.34), V2(0.13, 0.39), V2(0.08, 0.425), V2(0.05, 0.44), V2(0.001, 0.445)
    ], 28);
    shirt.scale(1, 1, Z);
    torso.add('matte', shirt, CREAM);
    const pants = new THREE.LatheGeometry([
        V2(0.001, -0.03), V2(0.106, -0.024), V2(0.18, 0.024), V2(0.209, 0.1), V2(0.213, 0.18), V2(0.201, 0.248), V2(0.19, 0.25)
    ], 28);
    pants.scale(1, 1, Z);
    torso.add('matte', pants, TEAL);
    const bibPts = [V2(0.2, 0.24), V2(0.198, 0.27), V2(0.176, 0.335), V2(0.152, 0.365), V2(0.14, 0.366)];
    for (const [phi, wd] of [[0, 1.05], [Math.PI, 0.9]]) {
        const bib = new THREE.LatheGeometry(bibPts, 10, phi - wd / 2, wd);
        bib.scale(1.03, 1, Z * 1.03);
        torso.add('matte', bib, TEAL);
    }
    for (const sx of [-1, 1]) {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(sx * 0.082, 0.345, 0.142), new THREE.Vector3(sx * 0.105, 0.405, 0.085),
            new THREE.Vector3(sx * 0.112, 0.43, 0.0), new THREE.Vector3(sx * 0.1, 0.4, -0.09), new THREE.Vector3(sx * 0.075, 0.34, -0.135)
        ]);
        const strap = new THREE.TubeGeometry(curve, 16, 0.024, 6, false);
        torso.add('matte', strap, TEAL_D);
        torso.add('gold', place(new THREE.SphereGeometry(0.03, 14, 10), sx * 0.082, 0.34, 0.155, 0, 0, 0, 1, 1, 0.6));
    }
    // bolso do peitilho
    torso.add('matte', place(slab(0.1, 0.02, 0.07, 0.008), 0, 0.258, 0.168, -0.26), TEAL_D);
    const torsoMesh = mk(torso);
    hips.add(torsoMesh);

    // ---- cabeça
    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 0.47;
    hips.add(head);
    const hk = new Kit();
    const HR = 0.26;
    const skull = new THREE.SphereGeometry(HR, 36, 26);
    {
        const p = skull.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const y = p.getY(i);
            // queixo: afunila embaixo; bochechas: leve volume na frente
            const k = y < 0 ? 1 - 0.14 * (y / HR) ** 2 : 1;
            const cheek = y < 0.02 && p.getZ(i) > 0 ? 1 + 0.045 * Math.max(0, 1 - Math.abs(y + 0.07) / 0.1) : 1;
            p.setXYZ(i, p.getX(i) * k * cheek, y * 0.96, p.getZ(i) * k * 0.97);
        }
        skull.computeVertexNormals();
        skull.translate(0, 0.2, 0);
    }
    hk.add('matte', skull, SKIN);
    hk.add('matte', place(limb(0.07, 0.065, 0.06, 12), 0, 0.03, 0), SKIN); // pescoço
    for (const sx of [-1, 1]) {
        hk.add('matte', place(ellipsoid(0.03, 0.055, 0.045), sx * 0.252, 0.19, -0.01, 0, 0, sx * -0.15), SKIN);
        hk.add('matte', place(ellipsoid(0.014, 0.032, 0.026), sx * 0.266, 0.19, 0.0), 0xf2a988);
        // bochecha corada
        hk.add('matte', place(ellipsoid(0.052, 0.036, 0.012), sx * 0.15, 0.125, 0.208, 0.1, sx * 0.62, 0), 0xffab98);
        // sobrancelha
        hk.add('matte', place(limb(0.011, 0.009, 0.075, 8), sx * 0.05, 0.312, 0.232, 0.25, 0, sx * (Math.PI / 2 + 0.18)), HAIR);
        // costeleta e franja saindo do boné
        hk.add('matte', place(ellipsoid(0.03, 0.07, 0.04), sx * 0.232, 0.22, 0.06), HAIR);
        hk.add('matte', place(ellipsoid(0.07, 0.035, 0.03), sx * 0.085, 0.365, 0.2, 0.35, sx * 0.4, sx * -0.25), HAIR);
    }
    hk.add('matte', place(ellipsoid(0.038, 0.034, 0.036), 0, 0.165, 0.262), 0xffbc94); // nariz
    // sorriso: arco de toro aberto para cima
    hk.add('matte', place(new THREE.TorusGeometry(0.07, 0.0115, 8, 18, Math.PI * 0.62), 0, 0.142, 0.225, -0.3, 0, Math.PI + Math.PI * 0.19), 0x8a2f24);
    // cabelo atrás
    const backHair = new THREE.SphereGeometry(HR * 1.045, 24, 14, Math.PI * 1.08, Math.PI * 0.84, Math.PI * 0.3, Math.PI * 0.46);
    backHair.translate(0, 0.2, 0);
    hk.add('matte', backHair, HAIR);
    // boné: copa em gomos, aba curva, botão
    const crown = new THREE.SphereGeometry(HR * 1.075, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    crown.scale(1, 0.82, 1.02);
    crown.translate(0, 0.318, -0.005);
    hk.add('matte', crown, CORAL);
    hk.add('matte', place(new THREE.TorusGeometry(HR * 1.07, 0.016, 8, 36), 0, 0.322, -0.005, Math.PI / 2), 0xe0523a);
    hk.add('matte', place(ellipsoid(0.035, 0.02, 0.035), 0, 0.548, -0.005), 0xe0523a);
    {
        const s = new THREE.Shape();
        s.moveTo(-0.2, 0);
        s.quadraticCurveTo(-0.19, 0.2, 0, 0.23);
        s.quadraticCurveTo(0.19, 0.2, 0.2, 0);
        s.quadraticCurveTo(0, 0.06, -0.2, 0);
        const brim = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 2, curveSegments: 10 });
        // curva a aba para baixo nas laterais
        const p = brim.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) + p.getX(i) * p.getX(i) * 1.4);
        brim.computeVertexNormals();
        brim.rotateX(Math.PI / 2 + 0.2);
        brim.translate(0, 0.34, 0.2);
        hk.add('matte', brim, CORAL);
    }
    head.add(mk(hk));

    // olhos (grupo separado para piscar): esclera, íris, pupila e brilho
    const eyes = new THREE.Group();
    eyes.position.y = 0.205;
    const ek = new Kit();
    for (const sx of [-1, 1]) {
        const yaw = sx * 0.37;
        const dx = Math.sin(yaw);
        const dz = Math.cos(yaw);
        const R0 = HR * 0.955;
        const at = (r, up = 0, side = 0) => [dx * r + dz * side, up, dz * r - dx * side];
        ek.add('gloss', place(ellipsoid(0.062, 0.084, 0.024, 20, 14), ...at(R0), 0, yaw, 0), 0xffffff);
        ek.add('gloss', place(ellipsoid(0.031, 0.042, 0.012, 18, 12), ...at(R0 + 0.017, -0.008, -sx * 0.008), 0, yaw, 0), 0x3d7a34);
        ek.add('gloss', place(ellipsoid(0.017, 0.024, 0.008, 14, 10), ...at(R0 + 0.025, -0.008, -sx * 0.008), 0, yaw, 0), 0x12100e);
        ek.add('gloss', place(ellipsoid(0.011, 0.013, 0.004, 8, 6), ...at(R0 + 0.033, 0.018, 0.014), 0, yaw, 0), 0xffffff);
    }
    eyes.add(mk(ek));
    head.add(eyes);

    const emblem = new THREE.Mesh(cached('nico:emblem', () => starGeometry(0.058, 0.012, 0.01)), MAT.gold);
    emblem.position.set(0, 0.428, 0.26);
    emblem.rotation.x = -0.38;
    emblem.castShadow = true;
    head.add(emblem);

    // ---- braços
    function arm(sx) {
        const shoulder = new THREE.Group();
        shoulder.position.set(sx * 0.2, 0.365, 0);
        const uk = new Kit();
        uk.add('matte', limb(0.06, 0.05, 0.14), CREAM);
        uk.add('matte', place(new THREE.TorusGeometry(0.05, 0.014, 6, 16), 0, -0.13, 0, Math.PI / 2), 0xf0dcc0); // barra da manga
        shoulder.add(mk(uk));
        const elbow = new THREE.Group();
        elbow.position.y = -0.15;
        shoulder.add(elbow);
        const fk = new Kit();
        fk.add('matte', limb(0.046, 0.04, 0.12), SKIN);
        elbow.add(mk(fk));
        const hand = new THREE.Group();
        hand.position.y = -0.14;
        elbow.add(hand);
        const gk = new Kit();
        gk.add('matte', place(new THREE.TorusGeometry(0.046, 0.02, 8, 16), 0, 0.005, 0, Math.PI / 2), GLOVE); // punho
        gk.add('matte', place(ellipsoid(0.058, 0.066, 0.05), 0, -0.055, 0), GLOVE);
        for (let i = 0; i < 3; i++) gk.add('matte', place(limb(0.02, 0.017, 0.04, 8), -0.03 + i * 0.03, -0.09, 0.008), GLOVE);
        gk.add('matte', place(limb(0.021, 0.018, 0.04, 8), sx * -0.05, -0.04, 0.02, 0, 0, sx * -0.9), GLOVE); // polegar
        hand.add(mk(gk));
        hips.add(shoulder);
        return { shoulder, elbow, hand };
    }

    // ---- pernas
    function leg(sx) {
        const hip = new THREE.Group();
        hip.position.set(sx * 0.095, 0.02, 0);
        const tk = new Kit();
        tk.add('matte', limb(0.09, 0.072, 0.17), TEAL);
        hip.add(mk(tk));
        const knee = new THREE.Group();
        knee.position.y = -0.19;
        hip.add(knee);
        const sk = new Kit();
        sk.add('matte', limb(0.07, 0.062, 0.14), TEAL);
        sk.add('matte', place(new THREE.TorusGeometry(0.064, 0.017, 6, 16), 0, -0.145, 0, Math.PI / 2), TEAL_D); // barra dobrada
        knee.add(mk(sk));
        const foot = new THREE.Group();
        foot.position.y = -0.18;
        knee.add(foot);
        const bk = new Kit();
        const upper = ellipsoid(0.078, 0.07, 0.125, 18, 12);
        {
            const p = upper.attributes.position;
            for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -0.035));
            upper.computeVertexNormals();
        }
        bk.add('gloss', place(upper, 0, -0.03, 0.04), BOOT);
        bk.add('gloss', place(ellipsoid(0.068, 0.05, 0.07), 0, -0.005, -0.005), BOOT); // cano
        bk.add('matte', place(slab(0.17, 0.27, 0.03, 0.014), 0, -0.095, 0.04), 0x2a1a12); // sola
        bk.add('matte', place(ellipsoid(0.06, 0.012, 0.03), 0, -0.012, 0.085, -0.5), 0xe9d9b8); // cadarço
        foot.add(mk(bk));
        hips.add(hip);
        return { hip, knee, foot };
    }

    const parts = {
        tilt, rig, hips, torso: torsoMesh, head, eyes, emblem,
        armL: arm(-1), armR: arm(1), legL: leg(-1), legR: leg(1)
    };
    root.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
        }
    });

    // sombra de contato (fica no chão; o Player a posiciona sob o Nico)
    const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.5, 1.5),
        new THREE.MeshBasicMaterial({
            map: cached('blob', () => {
                const c = document.createElement('canvas');
                c.width = c.height = 128;
                const g = c.getContext('2d');
                const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
                gr.addColorStop(0, 'rgba(0,0,0,0.62)');
                gr.addColorStop(0.55, 'rgba(0,0,0,0.26)');
                gr.addColorStop(1, 'rgba(0,0,0,0)');
                g.fillStyle = gr;
                g.fillRect(0, 0, 128, 128);
                return new THREE.CanvasTexture(c);
            }),
            transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
        })
    );
    shadow.geometry.rotateX(-Math.PI / 2);
    shadow.renderOrder = 2;
    shadow.name = 'nicoShadow';
    parts.shadow = shadow;

    return { root, parts };
}

// ------------------------------------------------------------------ castelo

/** Janela em arco pleno: moldura de pedra, vidro aceso, peitoril e pinázio. Frente em +Z, base em y = 0. */
function archWindow(K, w, h, x, y, z, ry, { door = false } = {}) {
    const r = w / 2;
    const spring = h - r;
    const arch = (ww, hh, inset = 0) => {
        const rr = ww / 2;
        const s = new THREE.Shape();
        s.moveTo(-rr, inset);
        s.lineTo(rr, inset);
        s.lineTo(rr, hh - rr);
        s.absarc(0, hh - rr, rr, 0, Math.PI, false);
        s.closePath();
        return s;
    };
    const frameShape = arch(w + 0.26, h + 0.13, -0.13);
    frameShape.holes.push(arch(w, h, 0));
    const frame = new THREE.ExtrudeGeometry(frameShape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 1, curveSegments: 10 });
    const put = (g) => place(g, x, y, z, 0, ry, 0);
    K.add('stone', put(frame), 0xfdeadb, 1.6);
    const pane = new THREE.ShapeGeometry(arch(w, h), 10);
    pane.translate(0, 0, 0.04);
    K.add(door ? 'wood' : 'window', put(pane), door ? 0x9a6a48 : 0xffffff, door ? 1.2 : 0);
    if (!door) {
        K.add('iron', put(place(new THREE.BoxGeometry(0.035, h, 0.03), 0, h / 2, 0.06)));
        K.add('iron', put(place(new THREE.BoxGeometry(w, 0.035, 0.03), 0, spring, 0.06)));
        K.add('stone', put(place(slab(w + 0.4, 0.28, 0.1, 0.03), 0, -0.1, 0.1)), 0xfdeadb, 1.6);
    } else {
        K.add('iron', put(place(new THREE.BoxGeometry(w, 0.07, 0.03), 0, h * 0.28, 0.06)));
        K.add('iron', put(place(new THREE.BoxGeometry(w, 0.07, 0.03), 0, spring, 0.06)));
        K.add('gold', put(place(new THREE.TorusGeometry(0.07, 0.016, 6, 14), w * 0.26, h * 0.42, 0.08)));
    }
}

/**
 * Castelo da Cúpola. Corpo 9,4 × 7,8 m com 7,2 m de altura (telhado caminhável),
 * quatro torres de canto com coruchéu de telha, corpo do portão com rosácea de vitral,
 * ameias em balanço sobre mísulas e, no terraço, a rotunda: tambor + 8 colunas +
 * cúpula de vitral com nervuras douradas. Atrás, um mirante sobre pilares.
 * Frente em +Z (o World gira o grupo para o portão olhar a trilha).
 */
export function createCastle() {
    const K = new Kit();
    const PEACH = 0xf6cdb8;
    const TRIM = 0xfff0e2;
    const BASE = 0xd9ab95;
    const ROOF = 0xff9d8c;
    const U = 2.4; // metros por repetição da cantaria

    // corpo, plinto, friso e cornija
    K.add('stone', place(new THREE.BoxGeometry(9.4, 7.2, 7.8), 0, 3.6, 0), PEACH, U);
    K.add('stone', slab(10.0, 8.4, 0.9, 0.2), BASE, U);
    K.add('stone', place(slab(9.7, 8.1, 0.24, 0.08), 0, 3.5, 0), TRIM, U);
    K.add('stone', place(slab(10.3, 8.7, 0.38, 0.1), 0, 6.82, 0), TRIM, U);

    // mísulas + parapeito + ameias em balanço (fora da área caminhável do terraço)
    const edge = (len, cx, cz, ry) => {
        const n = Math.floor(len / 0.82);
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n - 0.5;
            const lx = t * len;
            const g = place(slab(0.26, 0.34, 0.32, 0.05), lx, 6.5, 0.1);
            K.add('stone', place(g, cx, 0, cz, 0, ry, 0), TRIM, U);
        }
        K.add('stone', place(place(new THREE.BoxGeometry(len, 0.5, 0.36), 0, 7.45, 0.3), cx, 0, cz, 0, ry, 0), PEACH, U);
        const m = Math.floor(len / 1.16);
        for (let i = 0; i < m; i++) {
            const lx = ((i + 0.5) / m - 0.5) * len;
            K.add('stone', place(place(slab(0.64, 0.4, 0.52, 0.05), lx, 7.7, 0.3), cx, 0, cz, 0, ry, 0), TRIM, U);
        }
    };
    edge(5.9, 0, 3.9, 0);
    edge(5.9, 0, -3.9, Math.PI);
    edge(4.4, 4.7, 0, Math.PI / 2);
    edge(4.4, -4.7, 0, -Math.PI / 2);

    // torres de canto
    const towerPts = [
        V2(1.74, 0), V2(1.74, 0.55), V2(1.52, 0.95), V2(1.46, 3.4), V2(1.54, 3.5), V2(1.54, 3.72), V2(1.46, 3.82),
        V2(1.45, 8.3), V2(1.6, 8.75), V2(1.76, 8.95), V2(1.76, 9.55), V2(1.5, 9.56)
    ];
    const roofPts = [V2(1.3, 9.4), V2(2.1, 9.5), V2(1.95, 9.74), V2(1.5, 10.4), V2(0.92, 11.5), V2(0.42, 12.6), V2(0.1, 13.3), V2(0.02, 13.45)];
    const finialPts = [V2(0.001, 13.3), V2(0.13, 13.36), V2(0.07, 13.5), V2(0.05, 13.75), V2(0.15, 13.9), V2(0.16, 14.0), V2(0.05, 14.14), V2(0.025, 14.7), V2(0.001, 14.72)];
    const corners = [[-4.7, 3.9], [4.7, 3.9], [-4.7, -3.9], [4.7, -3.9]];
    const pennants = [];
    for (const [tx, tz] of corners) {
        K.add('stone', place(lathe(towerPts, 40, 1.46, U), tx, 0, tz), PEACH);
        K.add('roof', place(lathe(roofPts, 40, 1.4, 1.5), tx, 0, tz), ROOF);
        K.add('gold', place(new THREE.LatheGeometry(finialPts, 14), tx, 0, tz));
        // seteiras voltadas para fora
        const out = Math.atan2(tx, tz);
        for (const [dy, da] of [[5.1, 0], [7.2, 0.9], [2.6, -0.9]]) {
            const a = out + da * Math.sign(tx * tz || 1);
            archWindow(K, 0.42, 1.0, tx + Math.sin(a) * 1.42, dy, tz + Math.cos(a) * 1.42, a);
        }
        pennants.push([tx, 14.42, tz]);
    }

    // corpo do portão
    K.add('stone', place(new THREE.BoxGeometry(3.9, 6.5, 0.8), 0, 3.25, 4.3), PEACH, U);
    K.add('stone', place(slab(4.2, 1.1, 0.28, 0.08), 0, 6.5, 4.3), TRIM, U);
    for (const lx of [-1.6, -0.53, 0.53, 1.6]) K.add('stone', place(slab(0.62, 0.5, 0.5, 0.05), lx, 6.78, 4.45), TRIM, U);
    K.add('stone', place(slab(4.3, 1.2, 0.5, 0.12), 0, 0, 4.35), BASE, U);
    // portão em arco: aduelas, folhas de madeira, ferragens
    {
        const w = 2.3;
        const h = 3.4;
        const arch = (ww, hh, y0 = 0) => {
            const rr = ww / 2;
            const s = new THREE.Shape();
            s.moveTo(-rr, y0);
            s.lineTo(rr, y0);
            s.lineTo(rr, hh - rr);
            s.absarc(0, hh - rr, rr, 0, Math.PI, false);
            s.closePath();
            return s;
        };
        const ringShape = arch(w + 0.76, h + 0.38, -0.3);
        ringShape.holes.push(arch(w, h, 0));
        const ring = new THREE.ExtrudeGeometry(ringShape, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 2, curveSegments: 16 });
        K.add('stone', place(ring, 0, 0, 4.68), TRIM, 1.5);
        K.add('stone', place(slab(0.5, 0.36, 0.62, 0.06), 0, h + 0.02, 4.84), 0xffe0a8, 1.5); // pedra-chave
        const door = new THREE.ExtrudeGeometry(arch(w, h), { depth: 0.1, bevelEnabled: false, curveSegments: 16 });
        K.add('wood', place(door, 0, 0, 4.62), 0x8c5a3c, 1.1);
        for (const y of [0.7, 1.75, 2.6]) K.add('iron', place(new THREE.BoxGeometry(w - 0.1, 0.12, 0.05), 0, y, 4.75));
        K.add('iron', place(new THREE.BoxGeometry(0.05, h - 0.1, 0.05), 0, h / 2 - 0.05, 4.75));
        for (const sx of [-1, 1]) {
            K.add('gold', place(new THREE.TorusGeometry(0.13, 0.026, 8, 18), sx * 0.34, 1.45, 4.79));
            for (const y of [0.7, 1.75, 2.6]) {
                for (const lx of [0.3, 0.72, 1.02]) K.add('gold', place(new THREE.SphereGeometry(0.04, 8, 6), sx * lx, y, 4.78));
            }
            // lanternas de ferro
            K.add('iron', place(new THREE.BoxGeometry(0.06, 0.06, 0.4), sx * 1.72, 2.7, 4.9));
            K.add('iron', place(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 6), sx * 1.72, 2.52, 5.08));
            K.add('lamp', place(new THREE.CylinderGeometry(0.1, 0.075, 0.26, 6), sx * 1.72, 2.26, 5.08));
            K.add('iron', place(new THREE.ConeGeometry(0.15, 0.12, 6), sx * 1.72, 2.44, 5.08));
            K.add('iron', place(new THREE.CylinderGeometry(0.085, 0.1, 0.04, 6), sx * 1.72, 2.12, 5.08));
        }
    }
    // rosácea
    K.add('stone', place(new THREE.TorusGeometry(1.0, 0.12, 10, 44), 0, 5.05, 4.72), TRIM);
    K.add('rose', place(new THREE.CircleGeometry(0.96, 48), 0, 5.05, 4.73));

    // janelas
    for (const sx of [-1, 1]) {
        archWindow(K, 0.66, 1.25, sx * 2.6, 1.9, 3.9, 0);
        archWindow(K, 0.66, 1.25, sx * 2.6, 4.4, 3.9, 0);
        for (const z of [-1.7, 0, 1.7]) archWindow(K, 0.7, 1.35, sx * 4.7, 4.35, z, sx * Math.PI / 2);
        for (const z of [-0.85, 0.85]) archWindow(K, 0.6, 1.1, sx * 4.7, 1.9, z, sx * Math.PI / 2);
        archWindow(K, 0.7, 1.35, sx * 2.3, 4.35, -3.9, Math.PI);
        archWindow(K, 0.7, 1.35, sx * 0.85, 4.35, -3.9, Math.PI);
    }
    archWindow(K, 1.2, 2.1, 0, 1.56, -3.9, Math.PI, { door: true }); // poterna do mirante

    // escadaria em leque na frente
    for (const [r, top] of [[3.5, 0.1], [2.75, 0.22], [2.05, 0.34]]) {
        const st = new THREE.CylinderGeometry(r, r + 0.05, 1.4, 44, 1, false, -Math.PI / 2, Math.PI);
        K.add('stone', place(st, 0, top - 0.7, 4.7), TRIM, U);
    }

    // rotunda: tambor, colunas, entablamento
    K.add('stone', lathe([V2(0.001, 7.15), V2(2.6, 7.15), V2(2.6, 7.42), V2(2.42, 7.52), V2(2.42, 8.2), V2(2.54, 8.3), V2(2.54, 8.4), V2(0.001, 8.4)], 48, 2.4, U), TRIM);
    const colPts = [V2(0.001, 0), V2(0.21, 0), V2(0.21, 0.1), V2(0.15, 0.18), V2(0.125, 0.3), V2(0.118, 1.3), V2(0.125, 2.16), V2(0.16, 2.24), V2(0.21, 2.3), V2(0.21, 2.42), V2(0.001, 2.42)];
    for (let i = 0; i < 8; i++) {
        const a = (i + 0.5) / 8 * Math.PI * 2;
        K.add('stone', place(lathe(colPts, 14, 0.13, 1.2), Math.sin(a) * 2.08, 8.4, Math.cos(a) * 2.08), 0xfff6ee);
    }
    K.add('stone', lathe([V2(1.84, 10.82), V2(2.36, 10.82), V2(2.46, 10.95), V2(2.46, 11.2), V2(2.32, 11.32), V2(1.84, 11.32), V2(1.84, 10.82)], 48, 2.3, U), TRIM);
    // cúpula de vitral + nervuras e lanternim dourados
    const dome = new THREE.SphereGeometry(2.24, 48, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    dome.scale(1, 0.94, 1);
    K.add('dome', place(dome, 0, 11.32, 0));
    K.add('gold', place(new THREE.TorusGeometry(2.27, 0.075, 8, 48), 0, 11.34, 0, Math.PI / 2));
    for (let i = 0; i < 8; i++) {
        const rib = new THREE.TorusGeometry(2.27, 0.05, 6, 14, Math.PI / 2);
        rib.scale(1, 0.94, 1);
        K.add('gold', place(rib, 0, 11.32, 0, 0, (i / 8) * Math.PI * 2, 0));
    }
    K.add('gold', new THREE.LatheGeometry([V2(0.001, 13.34), V2(0.42, 13.36), V2(0.36, 13.52), V2(0.16, 13.66), V2(0.2, 13.84), V2(0.2, 13.92), V2(0.08, 14.1), V2(0.04, 14.5), V2(0.001, 14.52)], 16));

    // mirante nos fundos: tabuleiro sobre pilares, balaústres e dois lampiões
    K.add('stone', place(slab(3.5, 9.9, 0.34, 0.08), 0, 1.22, -8.78), TRIM, U);
    for (const z of [-6.4, -9.8, -13.2]) {
        K.add('stone', place(new THREE.BoxGeometry(2.9, 5.0, 0.8), 0, -1.26, z), PEACH, U);
        K.add('stone', place(slab(3.2, 1.1, 0.24, 0.07), 0, 1.0, z), BASE, U);
    }
    const balPts = [V2(0.001, 0), V2(0.075, 0), V2(0.075, 0.05), V2(0.04, 0.1), V2(0.07, 0.28), V2(0.035, 0.5), V2(0.06, 0.58), V2(0.001, 0.58)];
    const rail = (x0, z0, x1, z1) => {
        const len = Math.hypot(x1 - x0, z1 - z0);
        const n = Math.max(2, Math.round(len / 0.42));
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            K.add('stone', place(new THREE.LatheGeometry(balPts, 8), x0 + (x1 - x0) * t, 1.56, z0 + (z1 - z0) * t), TRIM);
        }
        const g = slab(len + 0.2, 0.2, 0.1, 0.03);
        K.add('stone', place(g, (x0 + x1) / 2, 2.14, (z0 + z1) / 2, 0, Math.atan2(-(z1 - z0), x1 - x0), 0), TRIM, U);
    };
    rail(-1.6, -4.4, -1.6, -13.55);
    rail(1.6, -4.4, 1.6, -13.55);
    rail(-1.6, -13.55, 1.6, -13.55);
    for (const sx of [-1, 1]) {
        K.add('iron', place(new THREE.CylinderGeometry(0.035, 0.05, 1.5, 8), sx * 1.6, 2.94, -13.55));
        K.add('lamp', place(new THREE.SphereGeometry(0.14, 12, 10), sx * 1.6, 3.8, -13.55));
        K.add('iron', place(new THREE.ConeGeometry(0.2, 0.14, 8), sx * 1.6, 3.98, -13.55));
    }

    const g = K.build({
        stone: MAT.stone, roof: MAT.roof, wood: MAT.wood, gold: MAT.gold, iron: MAT.iron,
        window: MAT.window, lamp: MAT.lamp, rose: stainedGlass('rose'), dome: stainedGlass('dome')
    });
    g.name = 'castle';
    g.getObjectByName('dome').castShadow = false;

    // estrela do lanternim (gira) + flâmulas nas torres + estandartes no portão
    const star = new THREE.Mesh(cached('star:geo', () => starGeometry(0.42, 0.14, 0.09)), starMaterial());
    star.position.set(0, 15.0, 0);
    star.scale.setScalar(0.85);
    star.name = 'cupolaStar';
    g.add(star);
    const cloth = clothMaterial();
    for (const [x, y, z] of pennants) {
        const p = new THREE.Mesh(cached('pennant', () => {
            const pg = clothGeometry(1.25, 0.5, 'x');
            const pos = pg.attributes.position;
            // flâmula: afunila até a ponta
            for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) * (1 - (pos.getX(i) / 1.25) * 0.85));
            const uv = pg.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.2 + uv.getY(i) * 0.6, 0.72 + uv.getX(i) * 0.2);
            return pg;
        }), cloth);
        p.position.set(x, y, z);
        p.rotation.y = 0.5;
        g.add(p);
    }
    for (const sx of [-1, 1]) {
        const b = new THREE.Mesh(cached('bannerGeo', () => clothGeometry(0.72, 2.3, 'y')), cloth);
        b.position.set(sx * 1.42, 6.2, 4.76);
        g.add(b);
        const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 8), MAT.gold);
        rod.rotation.z = Math.PI / 2;
        rod.position.set(sx * 1.42, 6.22, 4.76);
        g.add(rod);
    }
    return g;
}

// ------------------------------------------------------------------ coletáveis

function starMaterial() {
    return cached('m:star', () => new THREE.MeshPhysicalMaterial({
        color: 0xffc928, metalness: 0.85, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.1,
        emissive: 0xff9a10, emissiveIntensity: 0.75, envMapIntensity: 1.4
    }));
}

function glowTexture() {
    return cached('glowTex', () => {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        gr.addColorStop(0, 'rgba(255,244,200,1)');
        gr.addColorStop(0.25, 'rgba(255,214,110,0.55)');
        gr.addColorStop(0.6, 'rgba(255,170,40,0.14)');
        gr.addColorStop(1, 'rgba(255,150,20,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 128, 128);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    });
}

/** Estrela da Cúpola: corpo dourado gordinho e lapidado, olhos e halo aditivo. */
export function createStar() {
    const g = new THREE.Group();
    g.name = 'star';
    const body = new THREE.Mesh(cached('star:geo', () => starGeometry(0.42, 0.14, 0.09)), starMaterial());
    body.castShadow = true;
    g.add(body);
    const eyes = new Kit();
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            eyes.add('gloss', place(ellipsoid(0.034, 0.075, 0.02, 12, 8), sx * 0.085, 0.02, sz * 0.158), 0x15110c);
            eyes.add('gloss', place(ellipsoid(0.011, 0.018, 0.008, 6, 5), sx * 0.085 + 0.008, 0.055, sz * 0.172), 0xffffff);
        }
    }
    g.add(eyes.build({ gloss: MAT.gloss }, { castShadow: false }));
    const halo = new THREE.Sprite(cached('m:halo', () => new THREE.SpriteMaterial({
        map: glowTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false
    })));
    halo.scale.setScalar(2.6);
    halo.name = 'halo';
    g.add(halo);
    return g;
}

/** Moeda cunhada: borda em bisel, campo rebaixado e estrela em relevo nas duas faces. */
function coinGeometry() {
    return cached('coin:geo', () => {
        const rim = new THREE.LatheGeometry([
            V2(0.001, -0.03), V2(0.27, -0.03), V2(0.3, -0.05), V2(0.355, -0.05), V2(0.38, -0.028),
            V2(0.38, 0.028), V2(0.355, 0.05), V2(0.3, 0.05), V2(0.27, 0.03), V2(0.001, 0.03)
        ], 40);
        rim.rotateX(Math.PI / 2);
        const list = [rim];
        for (const s of [-1, 1]) {
            const st = starGeometry(0.17, 0.012, 0.012);
            st.translate(0, 0, s * 0.034);
            list.push(st);
        }
        const g = mergeGeometries(normalizeForMerge(list, { keepColor: false }));
        g.computeBoundingSphere();
        return g;
    });
}

export function createCoin(red = false) {
    const mat = cached(red ? 'm:coinR' : 'm:coinY', () => new THREE.MeshStandardMaterial(red
        ? { color: 0xff3b3b, metalness: 1, roughness: 0.26, emissive: 0x7a0808, emissiveIntensity: 0.7, envMapIntensity: 1.4 }
        : { color: 0xffc533, metalness: 1, roughness: 0.22, emissive: 0x5a3200, emissiveIntensity: 0.55, envMapIntensity: 1.4 }));
    const m = new THREE.Mesh(coinGeometry(), mat);
    m.castShadow = false;
    return m;
}

// ------------------------------------------------------------------ inimigos

/** Fungo andarilho: chapéu coral pintado, haste creme, olhos zangados e pezinhos. */
export function createFungus() {
    const geo = cached('fungus:geo', () => {
        const K = new Kit();
        K.add('m', new THREE.LatheGeometry([
            V2(0.001, 0.06), V2(0.2, 0.07), V2(0.27, 0.16), V2(0.29, 0.3), V2(0.25, 0.44), V2(0.19, 0.52), V2(0.001, 0.54)
        ], 24), 0xfdf0d6);
        const cap = new THREE.LatheGeometry([
            V2(0.001, 0.42), V2(0.2, 0.42), V2(0.4, 0.44), V2(0.5, 0.5), V2(0.53, 0.58), V2(0.5, 0.7), V2(0.4, 0.82), V2(0.24, 0.9), V2(0.08, 0.93), V2(0.001, 0.935)
        ], 28);
        K.add('m', cap, 0xe8452f);
        // pintas brancas assentadas no chapéu
        const rnd = seeded(9);
        for (let i = 0; i < 9; i++) {
            const a = (i / 9) * Math.PI * 2 + rnd() * 0.4;
            const up = i % 3 === 0 ? 0.86 : 0.7 + rnd() * 0.1;
            const rr = up > 0.8 ? 0.2 : 0.46;
            K.add('m', place(ellipsoid(0.085, 0.03, 0.085, 10, 6), Math.sin(a) * rr, up + (up > 0.8 ? 0.03 : 0), Math.cos(a) * rr,
                Math.cos(a) * (up > 0.8 ? 0.4 : 1.1), 0, -Math.sin(a) * (up > 0.8 ? 0.4 : 1.1)), 0xfff6e6);
        }
        for (const sx of [-1, 1]) {
            K.add('m', place(ellipsoid(0.055, 0.075, 0.03, 12, 8), sx * 0.1, 0.33, 0.262, 0, sx * 0.3, 0), 0xffffff);
            K.add('m', place(ellipsoid(0.026, 0.038, 0.014, 10, 6), sx * 0.098, 0.32, 0.287, 0, sx * 0.3, 0), 0x16110c);
            K.add('m', place(limb(0.018, 0.014, 0.1, 6), sx * 0.04, 0.425, 0.275, 0, 0, sx * (Math.PI / 2 + 0.45)), 0x3a2012); // sobrancelha brava
            K.add('m', place(ellipsoid(0.1, 0.07, 0.14, 12, 8), sx * 0.15, 0.06, 0.05), 0x7a4a26);
        }
        K.add('m', place(new THREE.TorusGeometry(0.05, 0.012, 6, 12, Math.PI), 0, 0.2, 0.275, 0.1, 0, 0), 0x6a2418); // boca carrancuda
        const group = K.build({ m: MAT.matte });
        return group.children[0].geometry;
    });
    const m = new THREE.Mesh(geo, cached('m:fungus', () => new THREE.MeshPhysicalMaterial({
        vertexColors: true, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.9
    })));
    m.name = 'fungus';
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

/** Bomba-rei: esfera de ferro envernizada, coroa, bigode, luvas, botas, chave de corda e pavio. */
export function createKingBomb() {
    const g = new THREE.Group();
    g.name = 'king';
    const K = new Kit();
    K.add('gloss', place(new THREE.SphereGeometry(1.35, 48, 36), 0, 1.5, 0), 0x1c1d24);
    // aro e tampa do pavio
    K.add('iron', place(new THREE.CylinderGeometry(0.34, 0.4, 0.22, 20), 0, 2.84, 0));
    // olhos e sobrancelhas
    for (const sx of [-1, 1]) {
        const yaw = sx * 0.3;
        K.add('gloss', place(ellipsoid(0.2, 0.3, 0.07, 18, 12), Math.sin(yaw) * 1.3, 1.86, Math.cos(yaw) * 1.3, -0.15, yaw, 0), 0xffffff);
        K.add('gloss', place(ellipsoid(0.085, 0.13, 0.04, 12, 8), Math.sin(yaw) * 1.355, 1.82, Math.cos(yaw) * 1.355, -0.15, yaw, 0), 0x0e0c0a);
        K.add('matte', place(limb(0.06, 0.04, 0.34, 8), sx * 0.16, 2.3, 1.16, 0.2, 0, sx * (Math.PI / 2 + 0.38)), 0xfff3d8);
        // bigode
        K.add('matte', place(limb(0.085, 0.02, 0.5, 10), sx * 0.04, 1.42, 1.34, 0, 0, sx * (Math.PI / 2 - 0.35)), 0xfff3d8);
        // braços e luvas
        K.add('matte', place(limb(0.15, 0.13, 0.5, 12), sx * 1.22, 1.75, 0.15, 0, 0, sx * 1.0), 0xe9b23a);
        K.add('matte', place(ellipsoid(0.3, 0.28, 0.26), sx * 1.82, 1.3, 0.2), 0xfbf7ee);
        K.add('matte', place(new THREE.TorusGeometry(0.2, 0.07, 8, 16), sx * 1.66, 1.42, 0.18, Math.PI / 2, 0, sx * 0.9), 0xfbf7ee);
        // botas
        const boot = ellipsoid(0.34, 0.26, 0.5, 18, 12);
        const p = boot.attributes.position;
        for (let i = 0; i < p.count; i++) p.setY(i, Math.max(p.getY(i), -0.12));
        boot.computeVertexNormals();
        K.add('gloss', place(boot, sx * 0.55, 0.12, 0.2), 0xd2452f);
        K.add('matte', place(slab(0.66, 0.98, 0.07, 0.03), sx * 0.55, 0, 0.2), 0x3a2416);
    }
    // chave de corda nas costas
    K.add('gold', place(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 10), 0, 1.6, -1.55, Math.PI / 2));
    for (const sx of [-1, 1]) K.add('gold', place(new THREE.TorusGeometry(0.26, 0.07, 8, 18), sx * 0.27, 1.6, -1.85, 0, Math.PI / 2, 0));
    // coroa: aro + 5 pontas com pérolas
    K.add('gold', place(new THREE.LatheGeometry([V2(0.52, 0), V2(0.6, 0.04), V2(0.58, 0.12), V2(0.6, 0.32), V2(0.54, 0.32), V2(0.52, 0)], 24), 0, 2.86, 0));
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        K.add('gold', place(new THREE.ConeGeometry(0.17, 0.42, 4), Math.sin(a) * 0.56, 3.36, Math.cos(a) * 0.56, 0, a + Math.PI / 4, 0));
        K.add('gloss', place(new THREE.SphereGeometry(0.075, 10, 8), Math.sin(a) * 0.56, 3.6, Math.cos(a) * 0.56), i % 2 ? 0xe63946 : 0x3a86ff);
    }
    // pavio
    const fuse = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 2.9, 0), new THREE.Vector3(0.05, 3.3, -0.02), new THREE.Vector3(0.22, 3.62, -0.05), new THREE.Vector3(0.42, 3.74, -0.05)
    ]), 12, 0.05, 6, false);
    K.add('matte', fuse, 0xd9c7a0);
    const built = K.build({ gloss: MAT.gloss, matte: MAT.matte, gold: MAT.gold, iron: MAT.iron });
    g.add(built);
    const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 1.6, 0.4) }));
    spark.position.set(0.44, 3.76, -0.05);
    spark.name = 'spark';
    g.add(spark);
    return g;
}

// ------------------------------------------------------------------ cenário

/** Canhão de bronze sobre carreta de madeira com rodas raiadas. O cano se chama 'barrel'. */
export function createCannon() {
    const g = new THREE.Group();
    const K = new Kit();
    // carreta: duas falcas recortadas + eixo + rodas
    const cheek = new THREE.Shape();
    cheek.moveTo(-0.95, 0.32);
    cheek.lineTo(0.75, 0.32);
    cheek.lineTo(0.75, 1.02);
    cheek.quadraticCurveTo(0.45, 1.12, 0.2, 0.92);
    cheek.lineTo(-0.2, 0.72);
    cheek.lineTo(-0.95, 0.56);
    cheek.closePath();
    for (const sx of [-1, 1]) {
        const c = new THREE.ExtrudeGeometry(cheek, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 1 });
        c.translate(0, 0, -0.07);
        c.rotateY(-Math.PI / 2);
        K.add('wood', place(c, sx * 0.48, 0, 0), 0xa8744e, 0.9);
        for (const z of [0.42, -0.62]) {
            K.add('wood', place(new THREE.TorusGeometry(0.33, 0.07, 8, 22), sx * 0.66, 0.4, z, 0, Math.PI / 2, 0), 0x7a5236, 0.9);
            K.add('iron', place(new THREE.TorusGeometry(0.4, 0.025, 6, 22), sx * 0.66, 0.4, z, 0, Math.PI / 2, 0));
            K.add('iron', place(new THREE.CylinderGeometry(0.085, 0.085, 0.16, 10), sx * 0.66, 0.4, z, 0, 0, Math.PI / 2));
            for (let i = 0; i < 4; i++) {
                K.add('wood', place(new THREE.BoxGeometry(0.05, 0.62, 0.05), sx * 0.66, 0.4, z, (i / 4) * Math.PI, 0, 0), 0x7a5236, 0.9);
            }
        }
    }
    for (const z of [0.42, -0.62]) K.add('iron', place(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 8), 0, 0.4, z, 0, 0, Math.PI / 2));
    K.add('wood', place(slab(0.86, 1.5, 0.12, 0.02), 0, 0.3, -0.1), 0x8c5f40, 0.9);
    K.add('iron', place(new THREE.CylinderGeometry(0.08, 0.08, 1.2, 12), 0, 1.02, 0.28, 0, 0, Math.PI / 2)); // munhões
    g.add(K.build({ wood: MAT.wood, iron: MAT.iron }));

    // cano torneado: culatra com cascavel, reforços e boca alargada
    const barrelGeo = cached('cannon:barrel', () => new THREE.LatheGeometry([
        V2(0.001, -1.2), V2(0.12, -1.19), V2(0.17, -1.1), V2(0.1, -0.98), V2(0.3, -0.92), V2(0.47, -0.84), V2(0.5, -0.55),
        V2(0.54, -0.5), V2(0.54, -0.42), V2(0.48, -0.38), V2(0.44, 0.12), V2(0.49, 0.16), V2(0.49, 0.22), V2(0.42, 0.26),
        V2(0.38, 0.92), V2(0.46, 1.06), V2(0.52, 1.14), V2(0.52, 1.24), V2(0.35, 1.24), V2(0.31, 0.6), V2(0.001, 0.58)
    ], 36));
    const barrel = new THREE.Mesh(barrelGeo, cached('m:bronze', () => new THREE.MeshStandardMaterial({
        color: 0x3a3c44, metalness: 1, roughness: 0.34, envMapIntensity: 1.2
    })));
    barrel.rotation.x = Math.PI / 2 - Math.PI / 2.6;
    barrel.position.set(0, 1.12, 0.5);
    barrel.name = 'barrel';
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.06, 12, 36), MAT.gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.2;
    barrel.add(rim);
    const band = rim.clone();
    band.position.y = -0.46;
    band.scale.setScalar(1.1);
    barrel.add(band);
    g.add(barrel);
    return g;
}

/** Mastro do cume com bandeira ao vento. */
export function createFlag() {
    const g = new THREE.Group();
    const K = new Kit();
    K.add('iron', place(new THREE.CylinderGeometry(0.045, 0.065, 3.6, 12), 0, 1.8, 0));
    K.add('gold', place(new THREE.SphereGeometry(0.11, 14, 10), 0, 3.68, 0));
    K.add('stone', new THREE.LatheGeometry([V2(0.001, 0), V2(0.42, 0), V2(0.42, 0.1), V2(0.26, 0.2), V2(0.2, 0.42), V2(0.001, 0.42)], 16), 0xfff0e2);
    g.add(K.build({ iron: MAT.iron, gold: MAT.gold, stone: MAT.stone }));
    const cloth = new THREE.Mesh(cached('flagGeo', () => {
        const fg = clothGeometry(1.6, 0.95, 'x');
        const uv = fg.attributes.uv;
        // gira o estandarte: a estrela fica de pé na bandeira deitada
        for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getY(i), 0.24 + uv.getX(i) * 0.44);
        return fg;
    }), clothMaterial());
    cloth.position.set(0.05, 3.05, 0);
    cloth.name = 'cloth';
    cloth.castShadow = true;
    g.add(cloth);
    return g;
}

/** Deque flutuante: tábuas com moldura, cantoneiras douradas e um bloco de rocha por baixo. Origem no centro da laje. */
export function createFloatDeck(w, h, d, seed = 1) {
    const K = new Kit();
    K.add('wood', place(slab(w, d, h, 0.04), 0, -h / 2, 0), 0xd9a06a, 1.5);
    const fr = 0.16;
    for (const [fw, fd, fx, fz] of [[w + fr, fr, 0, d / 2], [w + fr, fr, 0, -d / 2], [fr, d + fr, w / 2, 0], [fr, d + fr, -w / 2, 0]]) {
        K.add('wood', place(slab(fw, fd, h + 0.06, 0.03), fx, -h / 2 - 0.05, fz), 0x8a5a3a, 1.5);
    }
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            K.add('gold', place(slab(0.3, 0.3, h + 0.1, 0.04), sx * w / 2, -h / 2 - 0.06, sz * d / 2));
            K.add('gold', place(new THREE.SphereGeometry(0.09, 10, 8), sx * w / 2, h / 2 + 0.07, sz * d / 2));
        }
    }
    const rock = rockGeometry(seed + 20, 4).clone();
    K.add('rock', place(rock, 0, -h / 2 + 0.02, 0, Math.PI, seed, 0, w * 0.44, 0.7 + w * 0.26, d * 0.44), 0xd9c9b4);
    const g = K.build({ wood: MAT.wood, gold: MAT.gold, rock: MAT.rock });
    return g;
}

/** Laje de rocha (degraus da montanha / pontes sobre a gruta). Topo plano em +h/2. */
export function createLedge(w, h, d, seed = 1) {
    const depth = h + 0.9;
    const geo = new THREE.BoxGeometry(w, depth, d, 10, 4, 10);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const below = (depth / 2 - y) / depth; // 0 no topo → 1 embaixo
        const n = fbm2(x * 1.3 + seed * 9, z * 1.3 + y * 0.9, 3) - 0.5;
        const taper = 1 - below * below * 0.35;
        pos.setXYZ(i, x * taper + n * 0.22 * Math.min(1, below * 3), y - (below > 0.9 ? Math.abs(n) * 0.4 : 0), z * taper + n * 0.22 * Math.min(1, below * 3));
    }
    geo.translate(0, h / 2 - depth / 2, 0);
    geo.computeVertexNormals();
    const K = new Kit();
    K.add('rock', smoothNormals(geo.toNonIndexed()), 0xe2d2bc, 1.3);
    const g = K.build({ rock: MAT.rock });
    return g;
}

/** Ilha no céu: tampo gramado, cone de rocha e um coreto aberto onde mora a estrela. Origem no centro do tampo (h). */
export function createSkyIsland(w, h) {
    const R = w * 0.56;
    const K = new Kit();
    const top = new THREE.CylinderGeometry(R, R * 0.97, h, 40, 1);
    K.add('grass', top, 0xc8e08a, 2.2);
    const under = new THREE.LatheGeometry([V2(0.001, -4.6), V2(0.5, -3.9), V2(1.2, -2.6), V2(R * 0.72, -1.2), V2(R * 0.96, -0.4), V2(R * 0.99, -h / 2 + 0.02)], 28);
    {
        const p = under.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const a = Math.atan2(p.getZ(i), p.getX(i));
            const y = p.getY(i);
            const k = 1 + (fbm2(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + y * 0.8, 3) - 0.5) * 0.5 * Math.min(1, -y * 0.8);
            p.setXYZ(i, p.getX(i) * k, y, p.getZ(i) * k);
        }
        under.computeVertexNormals();
    }
    K.add('rock', under, 0xd9c9b4, 1.3);
    // coreto: base, 6 colunas de madeira, anel e coruchéu de telha
    const y0 = h / 2;
    K.add('stone', place(new THREE.CylinderGeometry(1.75, 1.85, 0.16, 24), 0, y0 + 0.08, 0), 0xfff0e2, 2);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        K.add('wood', place(new THREE.CylinderGeometry(0.075, 0.09, 2.3, 8), Math.sin(a) * 1.5, y0 + 1.3, Math.cos(a) * 1.5), 0x9a6a48, 1);
    }
    K.add('wood', place(new THREE.TorusGeometry(1.5, 0.09, 8, 28), 0, y0 + 2.42, 0, Math.PI / 2), 0x8a5a3a);
    K.add('roof', place(lathe([V2(1.6, 0), V2(2.0, 0.02), V2(1.7, 0.32), V2(1.0, 1.0), V2(0.4, 1.7), V2(0.06, 2.2), V2(0.02, 2.25)], 28, 1.4, 1.5), 0, y0 + 2.42, 0), 0xff9d8c);
    K.add('gold', place(new THREE.LatheGeometry([V2(0.001, 0), V2(0.1, 0.02), V2(0.05, 0.14), V2(0.12, 0.3), V2(0.03, 0.44), V2(0.001, 0.7)], 10), 0, y0 + 4.6, 0));
    const g = K.build({ grass: MAT.grass, rock: MAT.rock, stone: MAT.stone, wood: MAT.wood, roof: MAT.roof, gold: MAT.gold });
    return g;
}

/** Arco de rocha que marca a boca da gruta. Vão livre de 3,4 m; origem no chão. */
export function createCaveEntrance() {
    const shape = new THREE.Shape();
    shape.moveTo(-3.0, -0.6);
    shape.lineTo(3.0, -0.6);
    shape.lineTo(2.7, 2.9);
    shape.quadraticCurveTo(1.7, 3.9, 0, 4.0);
    shape.quadraticCurveTo(-1.7, 3.9, -2.7, 2.9);
    shape.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-1.7, -0.6);
    hole.lineTo(1.7, -0.6);
    hole.lineTo(1.7, 1.4);
    hole.absarc(0, 1.4, 1.7, 0, Math.PI, false);
    hole.closePath();
    shape.holes.push(hole);
    const ex = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.18, bevelSegments: 3, curveSegments: 18, steps: 4 });
    ex.translate(0, 0, -0.75);
    const pos = ex.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const n = fbm2(x * 0.9 + 3, y * 0.9 + z * 0.7, 3) - 0.5;
        // só a face externa racha; o vão continua liso para o Nico passar
        const outer = Math.min(1, Math.max(0, (Math.hypot(x, Math.max(0, y - 1.4)) - 1.9) / 0.6));
        pos.setXYZ(i, x + n * 0.5 * outer, y + n * 0.35 * outer, z + n * 0.25);
    }
    ex.computeVertexNormals();
    const K = new Kit();
    K.add('rock', smoothNormals(ex), 0xcbb9a2, 1.3);
    K.add('lamp', place(new THREE.SphereGeometry(0.13, 10, 8), 0, 3.05, 0.95));
    K.add('iron', place(new THREE.ConeGeometry(0.2, 0.16, 8), 0, 3.24, 0.95));
    K.add('iron', place(new THREE.CylinderGeometry(0.015, 0.015, 0.45, 5), 0, 3.52, 0.95));
    const g = K.build({ rock: MAT.rock, lamp: MAT.lamp, iron: MAT.iron });
    return g;
}
