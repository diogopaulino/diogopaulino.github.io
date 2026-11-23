/**
 * Estaleiro do River Knight: drakkar (jogador e inimigos), balsa de troncos,
 * canhões de bronze, escudos, remos, vela e tripulação.
 *
 * Tudo é malha gerada por código (lofts e varreduras com normais suaves) sobre
 * os materiais PBR de `materials.js`. Convenções:
 *   · proa em +Z, convés plano em y = deckY, origem do casco na linha da amurada
 *     a meia-nau (o jogo põe a raiz ~0,95 m acima da água);
 *   · UV em metros; no casco cada fiada cobre exatamente uma tábua da textura;
 *   · geometria estática é fundida por material; remos, escudos e canhões são
 *     InstancedMesh; a tripulação é `createHero` (gfx/hero.js).
 *
 * FORMA DO CASCO (t ∈ [−1, 1] ao longo do comprimento L; s ∈ [0, 1] da quilha à amurada):
 *   afil(t)   = (1 − t²)^fullness                       (0,42 no drakkar: pontas finas)
 *   meiaBoca  = max(0,07; (B/2)·afil)
 *   calado    = D·(0,55 + 0,45·afil)
 *   tosamento = R·|t|^2,6                               (a amurada sobe nas pontas)
 *   seção:  x = meiaBoca·sin(s·π/2),  y = tosamento − calado·cos(s·π/2)^1,25
 * CASCO TRINCADO: a seção é dividida em fiadas; cada tábua é deslocada para fora
 * ao longo da normal da seção — `e` (espessura) na borda de baixo, 0 na de cima —
 * e começa um pouco abaixo da fiada anterior (sobreposição), formando o degrau.
 *
 * REMADA (fase φ, a mesma do modo `row` do herói: k = ½ + ½·cos φ, k = 1 na pegada):
 *   varredura  θ = −lado · 0,45 · cos φ        (pá à proa em φ = 0, à popa em φ = π)
 *   mergulho   δ = 0,25 + 0,11 · sin φ         (pá na água enquanto sin φ > 0)
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHero } from '../../shared/gfx/hero.js';
import { loadModel } from '../../shared/gfx/assets.js';
import { plankWood, darkWood, oakWood, barkWood, bronze, iron, plain, glow } from './materials.js?v=60';
import { sailTexture } from './textures.js?v=60';

const PI = Math.PI;
const TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const XAXIS = V(1, 0, 0);

/** Lado (m) de uma repetição da textura de tábuas do casco — ver `plankWood(cor, PLANK_TILE)`. */
const PLANK_TILE = 2.4;
/** A textura weathered_brown_planks tem 13 tábuas por repetição. */
const PLANKS_PER_TILE = 13;

/** Uniformes globais do tecido (velas e flâmulas): avançados por `parts.animate`. */
export const CLOTH = { uTime: { value: 0 }, uWind: { value: 1 } };

/* ================================================================== */
/* Utilitários de malha                                                */
/* ================================================================== */

/**
 * Loft entre anéis (cada anel = lista de Vector3 com o mesmo tamanho). Os anéis
 * giram no sentido anti-horário em torno do avanço → normais para fora.
 * UV em metros: u = comprimento acumulado, v = perímetro acumulado.
 */
export function ringLoft(rings, { closed = true, capStart = false, capEnd = false, flip = false } = {}) {
    const n = rings[0].length;
    const cols = closed ? n + 1 : n;
    const pos = [];
    const uv = [];
    const idx = [];
    const c0 = V();
    const c1 = V();
    let u = 0;
    for (let i = 0; i < rings.length; i++) {
        c1.set(0, 0, 0);
        for (const p of rings[i]) c1.add(p);
        c1.multiplyScalar(1 / n);
        if (i > 0) u += c1.distanceTo(c0);
        c0.copy(c1);
        let v = 0;
        for (let j = 0; j < cols; j++) {
            const p = rings[i][j % n];
            if (j > 0) v += p.distanceTo(rings[i][(j - 1) % n]);
            pos.push(p.x, p.y, p.z);
            uv.push(u, v);
        }
    }
    for (let i = 0; i < rings.length - 1; i++) {
        for (let j = 0; j < cols - 1; j++) {
            const a = i * cols + j;
            const b = a + 1;
            const c = a + cols;
            const d = c + 1;
            if (flip) idx.push(a, c, b, b, c, d);
            else idx.push(a, b, c, b, d, c);
        }
    }
    const cap = (ring, reverse) => {
        const base = pos.length / 3;
        c1.set(0, 0, 0);
        for (const p of ring) c1.add(p);
        c1.multiplyScalar(1 / n);
        pos.push(c1.x, c1.y, c1.z);
        uv.push(0, 0);
        for (const p of ring) {
            pos.push(p.x, p.y, p.z);
            uv.push(p.x - c1.x + p.z - c1.z, p.y - c1.y);
        }
        for (let j = 0; j < n; j++) {
            const a = base + 1 + j;
            const b = base + 1 + ((j + 1) % n);
            if (reverse !== flip) idx.push(base, b, a);
            else idx.push(base, a, b);
        }
    };
    if (capStart) cap(rings[0], true);
    if (capEnd) cap(rings[rings.length - 1], false);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/**
 * Varre uma seção (super)elíptica ao longo de um caminho.
 * @param {THREE.Vector3[]} pts          caminho
 * @param {(u:number)=>number|number[]} radius  raio em u ∈ [0,1]; [rx, ry] achata (rx = lateral, ry = "para cima" da seção)
 * @param {object} [o]  sides, planar (caminho no plano YZ: lateral = eixo X), exp (expoente da superelipse; 2 = elipse), caps
 */
export function tube(pts, radius, { sides = 10, planar = false, exp = 2, capStart = true, capEnd = true, roll = 0 } = {}) {
    const rings = [];
    const T = V();
    const N = V();
    const B = V();
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        T.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
        if (planar) N.copy(XAXIS);
        else {
            N.crossVectors(UP, T);
            if (N.lengthSq() < 1e-4) N.copy(XAXIS);
            N.normalize();
        }
        B.crossVectors(T, N).normalize();
        const r = typeof radius === 'function' ? radius(i / (n - 1), i) : radius;
        const rx = Array.isArray(r) ? r[0] : r;
        const ry = Array.isArray(r) ? r[1] : r;
        const ring = [];
        for (let j = 0; j < sides; j++) {
            const a = (j / sides) * TAU + roll;
            let ca = Math.cos(a);
            let sa = Math.sin(a);
            if (exp !== 2) {
                ca = Math.sign(ca) * Math.pow(Math.abs(ca), 2 / exp);
                sa = Math.sign(sa) * Math.pow(Math.abs(sa), 2 / exp);
            }
            ring.push(V().copy(pts[i]).addScaledVector(N, ca * rx).addScaledVector(B, sa * ry));
        }
        rings.push(ring);
    }
    return ringLoft(rings, { capStart, capEnd });
}

/** Reamostra pontos de controle por Catmull-Rom centrípeta. */
export function smoothPath(points, segments) {
    return new THREE.CatmullRomCurve3(points, false, 'centripetal').getPoints(segments);
}

/** Corda/cabo entre dois pontos com barriga (catenária aproximada por parábola). */
export function rope(a, b, sag = 0.12, r = 0.022) {
    const pts = [];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = V().lerpVectors(a, b, t);
        p.y -= sag * 4 * t * (1 - t);
        pts.push(p);
    }
    return tube(pts, r, { sides: 5, capStart: false, capEnd: false });
}

/** Caixa com UV em metros (tábuas e vigas). O veio corre pelo eixo mais longo. */
export function plank(w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    const p = g.attributes.position;
    const nrm = g.attributes.normal;
    const uv = g.attributes.uv;
    const long = w >= h && w >= d ? 0 : d >= h ? 2 : 1;
    for (let i = 0; i < p.count; i++) {
        const c = [p.getX(i), p.getY(i), p.getZ(i)];
        const ax = Math.abs(nrm.getX(i)) > 0.5 ? 0 : Math.abs(nrm.getY(i)) > 0.5 ? 1 : 2;
        // u = eixo longo (ou o primeiro eixo livre), v = o outro eixo da face
        const free = [0, 1, 2].filter((k) => k !== ax);
        const ui = free.includes(long) ? long : free[0];
        const vi = free.find((k) => k !== ui);
        uv.setXY(i, c[ui] + x * 0.37 + z * 0.61, c[vi] + y * 0.53);
    }
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, z);
    return g;
}

/** Funde uma lista de geometrias (mesmos atributos: position/normal/uv). */
export function fuse(list) {
    const clean = [];
    for (const src of list) {
        if (!src) continue;
        // mergeGeometries exige tudo indexado ou tudo não indexado: normaliza para não indexado
        const g = src.index ? src.toNonIndexed() : src;
        if (g !== src) src.dispose();
        if (!g.attributes.normal) g.computeVertexNormals();
        for (const name of Object.keys(g.attributes)) {
            if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
        }
        clean.push(g);
    }
    if (!clean.length) return new THREE.BufferGeometry();
    const merged = mergeGeometries(clean, false);
    for (const g of clean) g.dispose();
    return merged;
}

/** Espelha em Z uma geometria NÃO indexada (troca dois vértices de cada triângulo para manter as faces para fora). */
export function mirrorZ(g) {
    for (const name of Object.keys(g.attributes)) {
        const a = g.attributes[name];
        const n = a.itemSize;
        const arr = a.array;
        for (let i = 0; i < a.count; i += 3) {
            for (let c = 0; c < n; c++) {
                const tmp = arr[(i + 1) * n + c];
                arr[(i + 1) * n + c] = arr[(i + 2) * n + c];
                arr[(i + 2) * n + c] = tmp;
            }
        }
        if (name === 'position' || name === 'normal') for (let i = 0; i < a.count; i++) arr[i * n + 2] *= -1;
        a.needsUpdate = true;
    }
    return g;
}

function mesh(geometry, material, { cast = true, receive = true, name = '' } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.name = name;
    return m;
}

/* ================================================================== */
/* Forma do casco                                                      */
/* ================================================================== */

const _sec = { hw: 0, dep: 0, sheer: 0, z: 0 };

/** Seção do casco em t ∈ [−1, 1] (objeto reutilizado). */
export function hullSection(d, t) {
    const taper = Math.pow(Math.max(0, 1 - t * t), d.fullness);
    _sec.hw = Math.max(0.07, (d.beam / 2) * taper);
    _sec.dep = d.depth * (0.55 + 0.45 * taper);
    _sec.sheer = d.rise * Math.pow(Math.abs(t), 2.6);
    _sec.z = (t * d.length) / 2;
    return _sec;
}

/** Ponto da seção (lado ±1), deslocado `off` m ao longo da normal externa. */
function hullPoint(d, t, s, off, side, out) {
    const { hw, dep, sheer, z } = hullSection(d, t);
    const ang = s * PI * 0.5;
    const sa = Math.sin(ang);
    const ca = Math.max(0, Math.cos(ang));
    const x = hw * sa;
    const y = sheer - dep * Math.pow(ca, 1.25);
    let tx = hw * ca;
    let ty = dep * 1.25 * Math.pow(ca, 0.25) * sa;
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    return out.set(side * (x + ty * off), y - tx * off, z);
}

/** Meia-largura interna do casco na altura y (0 se o fundo já subiu acima de y). */
export function hullHalfWidthAt(d, t, y) {
    const { hw, dep, sheer } = hullSection(d, t);
    const c = (sheer - y) / dep;
    if (c >= 1 || c <= 0) return c <= 0 ? hw : 0;
    const ca = Math.pow(c, 0.8);
    return hw * Math.sqrt(Math.max(0, 1 - ca * ca));
}

export function hullDims({ length = 15, beam = 3.6, depth = 1.6, rise = 2.0, fullness = 0.42 } = {}) {
    return { length, beam, depth, rise, fullness };
}

/**
 * Costado trincado: `strakes` fiadas por bordo, cada uma com 4 fileiras de
 * vértices (aresta inferior, face externa embaixo, meio, borda de cima).
 */
export function clinkerHullGeometry(d, { strakes = 7, rings = 44, thickness = 0.034 } = {}) {
    const parts = [];
    const p = V();
    const overlap = 0.35 / strakes;
    for (const side of [1, -1]) {
        for (let j = 0; j < strakes; j++) {
            const s0 = Math.max(0, j / strakes - (j > 0 ? overlap : 0));
            const s1 = (j + 1) / strakes;
            const rows = [
                [s0, 0],
                [s0, thickness],
                [(s0 + s1) / 2, thickness * 0.55],
                [s1, 0]
            ];
            const pos = [];
            const uv = [];
            const idx = [];
            for (let r = 0; r <= rings; r++) {
                const t = (r / rings) * 2 - 1;
                // nas pontas as tábuas afinam para morrer na roda de proa
                const fade = clamp((1 - Math.abs(t)) * 9, 0.15, 1);
                for (let k = 0; k < rows.length; k++) {
                    hullPoint(d, t, rows[k][0], rows[k][1] * fade, side, p);
                    pos.push(p.x, p.y, p.z);
                    const board = j + (k === 0 ? 0.04 : k === 1 ? 0.1 : k === 2 ? 0.5 : 0.94);
                    uv.push(p.z + j * 1.7, (PLANK_TILE * board) / PLANKS_PER_TILE);
                }
            }
            const nk = rows.length;
            for (let r = 0; r < rings; r++) {
                for (let k = 0; k < nk - 1; k++) {
                    const a = r * nk + k;
                    const b = a + 1;
                    const c = a + nk;
                    const e = c + 1;
                    if (side > 0) idx.push(a, b, c, b, e, c);
                    else idx.push(a, c, b, b, c, e);
                }
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
            g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
            g.setIndex(idx);
            g.computeVertexNormals();
            parts.push(g);
        }
    }
    return fuse(parts);
}

/** Convés plano em `deckY`, recortado pela forma interna do casco. UV: tábuas ao longo de Z. */
export function deckGeometry(d, deckY, { rings = 40, inset = 0.02, tMin = -1, tMax = 1 } = {}) {
    const pos = [];
    const uv = [];
    const idx = [];
    const cols = 5;
    let rows = 0;
    for (let r = 0; r <= rings; r++) {
        const t = lerp(tMin, tMax, r / rings);
        const w = Math.max(0, hullHalfWidthAt(d, t, deckY) - inset);
        if (w <= 0.01 && (r === 0 || r === rings)) continue;
        const z = (t * d.length) / 2;
        for (let c = 0; c < cols; c++) {
            const x = (c / (cols - 1) * 2 - 1) * w;
            pos.push(x, deckY, z);
            uv.push(z, x);
        }
        rows++;
    }
    for (let r = 0; r < rows - 1; r++) {
        for (let c = 0; c < cols - 1; c++) {
            const a = r * cols + c;
            idx.push(a, a + cols, a + 1, a + 1, a + cols, a + cols + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/** Cavernas (costelas) internas acima do convés + verdugo da amurada + quilha. */
function hullFramingGeometry(d, deckY, { ribs = 13, span = 0.78, gunwale = [0.075, 0.055] } = {}) {
    const list = [];
    const p = V();
    // cavernas
    for (let i = 0; i < ribs; i++) {
        const t = -span + (i / (ribs - 1)) * 2 * span;
        const { dep, sheer } = hullSection(d, t);
        const c = clamp((sheer - deckY) / dep, 0, 1);
        const sDeck = c >= 1 ? 0 : Math.acos(Math.pow(c, 0.8)) / (PI / 2);
        for (const side of [1, -1]) {
            const rings = [];
            const steps = 6;
            for (let k = 0; k <= steps; k++) {
                const s = lerp(Math.max(0, sDeck - 0.04), 0.985, k / steps);
                const a = hullPoint(d, t, s, -0.012, side, p).clone();
                const b = hullPoint(d, t, s, -0.105, side, p).clone();
                const h = 0.045;
                const ring = side > 0
                    ? [V(a.x, a.y, a.z - h), V(b.x, b.y, b.z - h), V(b.x, b.y, b.z + h), V(a.x, a.y, a.z + h)]
                    : [V(a.x, a.y, a.z + h), V(b.x, b.y, b.z + h), V(b.x, b.y, b.z - h), V(a.x, a.y, a.z - h)];
                rings.push(ring);
            }
            list.push(ringLoft(rings, { capEnd: true }));
        }
    }
    // verdugo: corre pela linha do tosamento, de ponta a ponta
    for (const side of [1, -1]) {
        const pts = [];
        for (let r = 0; r <= 40; r++) {
            const t = (r / 40) * 1.96 - 0.98;
            hullPoint(d, t, 1, 0.01, side, p);
            pts.push(V(p.x, p.y + 0.025, p.z));
        }
        list.push(tube(pts, gunwale, { sides: 6, exp: 3 }));
    }
    // quilha: acompanha o fundo
    {
        const pts = [];
        for (let r = 0; r <= 40; r++) {
            const t = (r / 40) * 2 - 1;
            const { dep, sheer, z } = hullSection(d, t);
            pts.push(V(0, sheer - dep - 0.06, z));
        }
        list.push(tube(pts, [0.07 * (d.beam / 3.6) + 0.02, 0.13], { sides: 6, planar: true, exp: 3 }));
    }
    return fuse(list);
}

/* ================================================================== */
/* Cabeça de dragão e cauda (entalhe de proa e popa)                   */
/* ================================================================== */

/**
 * Proa esculpida: roda de proa → pescoço em S → crânio → focinho, com mandíbula
 * aberta, chifres, crista dorsal, dentes e olhos. Devolve { wood, gilt, eyes }
 * (geometrias já no referencial do navio).
 * Coordenadas do entalhe em (altura, avanço) a partir do topo da roda de proa.
 */
function dragonHeadGeometry(d, scale = 1) {
    const end = hullSection(d, 1);
    const y0 = end.sheer;
    const z0 = end.z;
    const k = scale;
    const P = (h, f, x = 0) => V(x * k, y0 + h * k, z0 + f * k);
    const wood = [];
    const gilt = [];

    // roda de proa + pescoço + crânio + focinho (um loft só, seção variável)
    const spine = smoothPath([
        P(-1.05, -0.02), P(-0.5, 0.0), P(0.0, 0.04), P(0.65, 0.2), P(1.25, 0.26), P(1.8, 0.14),
        P(2.2, 0.12), P(2.5, 0.3), P(2.66, 0.62), P(2.68, 0.98), P(2.58, 1.3), P(2.5, 1.52), P(2.47, 1.6)
    ], 46);
    const neckR = (u) => {
        // u: 0 base da roda … ~0,62 nuca … 1 ponta do focinho
        if (u < 0.6) return [lerp(0.085, 0.13, u / 0.6) * k, lerp(0.15, 0.18, u / 0.6) * k];
        if (u < 0.76) {
            const a = (u - 0.6) / 0.16;
            const e = a * a * (3 - 2 * a);
            return [lerp(0.13, 0.215, e) * k, lerp(0.18, 0.2, e) * k];
        }
        const a = (u - 0.76) / 0.24;
        const round = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, a - 0.82) / 0.18, 2)));
        return [lerp(0.215, 0.105, Math.pow(a, 0.8)) * k * round + 0.004, lerp(0.2, 0.085, Math.pow(a, 0.7)) * k * round + 0.004];
    };
    wood.push(tube(spine, neckR, { sides: 14, planar: true, exp: 2.4 }));

    // mandíbula inferior (aberta ~22°)
    const jaw = smoothPath([P(2.42, 0.5), P(2.3, 0.8), P(2.14, 1.12), P(2.04, 1.38), P(2.02, 1.47)], 14);
    wood.push(tube(jaw, (u) => {
        const round = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, u - 0.8) / 0.2, 2)));
        return [lerp(0.17, 0.085, u) * k * round + 0.004, lerp(0.075, 0.04, u) * k * round + 0.004];
    }, { sides: 10, planar: true, exp: 2.4 }));

    // arcadas (sobrancelhas) e narinas: pequenos lofts sobre o crânio
    for (const side of [1, -1]) {
        const brow = smoothPath([P(2.74, 0.66, side * 0.12), P(2.83, 0.82, side * 0.19), P(2.8, 1.0, side * 0.17), P(2.72, 1.1, side * 0.13)], 8);
        wood.push(tube(brow, (u) => (0.05 * Math.sin(u * PI) + 0.012) * k, { sides: 7 }));
        const nostril = smoothPath([P(2.56, 1.38, side * 0.05), P(2.61, 1.47, side * 0.07), P(2.57, 1.55, side * 0.06)], 5);
        wood.push(tube(nostril, (u) => (0.028 * Math.sin(u * PI) + 0.008) * k, { sides: 6 }));
        // barbela/orelha em leque atrás da mandíbula
        const fin = smoothPath([P(2.5, 0.42, side * 0.19), P(2.62, 0.2, side * 0.34), P(2.86, 0.02, side * 0.42)], 6);
        wood.push(tube(fin, (u) => [0.012 * k, (0.11 * (1 - u) + 0.01) * k], { sides: 6 }));

        // chifres: varredura afilada para trás
        const horn = smoothPath([
            P(2.8, 0.56, side * 0.12), P(3.02, 0.4, side * 0.2), P(3.3, 0.12, side * 0.27), P(3.62, -0.02, side * 0.25), P(3.86, 0.1, side * 0.2)
        ], 12);
        gilt.push(tube(horn, (u) => (0.062 * (1 - u * 0.92) + 0.004) * k, { sides: 8 }));
    }

    // dentes (cones pequenos, superiores e inferiores) e espinhos da crista
    const tooth = (h, f, x, len, down) => {
        const g = new THREE.ConeGeometry(0.022 * k, len * k, 6);
        if (down) g.rotateX(PI);
        g.translate(x * k, y0 + h * k, z0 + f * k);
        gilt.push(g);
    };
    for (let i = 0; i < 5; i++) {
        const a = i / 4;
        for (const side of [1, -1]) {
            tooth(lerp(2.53, 2.41, a), lerp(0.86, 1.46, a), side * lerp(0.15, 0.07, a), 0.1 - a * 0.03, true);
            tooth(lerp(2.3, 2.1, a), lerp(0.84, 1.36, a), side * lerp(0.13, 0.06, a), 0.085 - a * 0.025, false);
        }
    }
    // crista dorsal: espinhos achatados ao longo da nuca (lado de trás do pescoço)
    const T = V();
    for (let i = 4; i < 30; i += 2) {
        const pt = spine[i];
        T.copy(spine[i + 1]).sub(spine[i - 1]).normalize();
        // "trás" do pescoço = −B, com B = T × X
        const bx = 0;
        const by = -T.z;
        const bz = T.y;
        const r = neckR(i / 46);
        const h = (0.12 + 0.1 * Math.sin((i / 30) * PI)) * k;
        const g = new THREE.ConeGeometry(0.075 * k, h, 5);
        g.scale(0.35, 1, 1);
        // eixo Y do cone → direção −B
        const dir = V(-bx, -by, -bz).normalize();
        g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir));
        g.translate(pt.x + dir.x * (r[1] + h * 0.38), pt.y + dir.y * (r[1] + h * 0.38), pt.z + dir.z * (r[1] + h * 0.38));
        gilt.push(g);
    }
    // colar de bronze na base do pescoço
    const collar = new THREE.TorusGeometry(0.2 * k, 0.035 * k, 6, 16);
    collar.scale(0.72, 1, 1);
    collar.rotateX(PI / 2);
    collar.rotateX(-0.15);
    collar.translate(0, y0 + 0.3 * k, z0 + 0.1 * k);
    gilt.push(collar);

    // olhos: globos encaixados sob a arcada
    const eyes = [];
    for (const side of [1, -1]) {
        const e = new THREE.SphereGeometry(0.045 * k, 10, 8);
        e.translate(side * 0.165 * k, y0 + 2.7 * k, z0 + 0.86 * k);
        eyes.push(e);
    }
    return { wood: fuse(wood), gilt: fuse(gilt), eyes: fuse(eyes) };
}

/** Popa: cadaste que sobe e se enrola em voluta (cauda do dragão), com espinhos. */
function sternTailGeometry(d, scale = 1) {
    const end = hullSection(d, -1);
    const y0 = end.sheer;
    const z0 = end.z;
    const k = scale;
    const ctrl = [V(0, y0 - 1.05 * k, z0 + 0.02 * k), V(0, y0 - 0.4 * k, z0), V(0, y0 + 0.3 * k, z0 - 0.06 * k), V(0, y0 + 1.0 * k, z0 - 0.2 * k)];
    // voluta: espiral de raio decrescente, enrolando para dentro (rumo à proa)
    const cy = y0 + 1.72 * k;
    const cz = z0 + 0.18 * k;
    const turns = 1.6;
    for (let i = 0; i <= 16; i++) {
        const a = i / 16;
        const ang = PI - a * turns * TAU;                // começa atrás (−Z) e sobe girando
        const r = lerp(0.62, 0.1, Math.pow(a, 0.8)) * k;
        ctrl.push(V(0, cy + Math.sin(ang) * r, cz + Math.cos(ang) * r));
    }
    const path = smoothPath(ctrl, 70);
    const wood = tube(path, (u) => [lerp(0.085, 0.03, Math.pow(u, 1.4)) * k, lerp(0.15, 0.045, Math.pow(u, 1.2)) * k], { sides: 10, planar: true, exp: 2.4 });
    const gilt = [];
    const tip = path[path.length - 1];
    const fin = new THREE.ConeGeometry(0.11 * k, 0.3 * k, 5);
    fin.scale(0.3, 1, 1);
    fin.rotateX(PI / 2);
    fin.translate(tip.x, tip.y, tip.z + 0.1 * k);
    gilt.push(fin);
    const band = new THREE.TorusGeometry(0.17 * k, 0.03 * k, 6, 14);
    band.scale(0.7, 1, 1);
    band.rotateX(PI / 2);
    band.translate(0, y0 + 0.35 * k, z0 - 0.07 * k);
    gilt.push(band);
    return { wood, gilt: fuse(gilt) };
}

/* ================================================================== */
/* Escudos                                                             */
/* ================================================================== */

let shieldTex = null;
/** Pintura neutra (tons de cinza) — a cor vem do `instanceColor` de cada escudo. */
function shieldPaintTexture() {
    if (shieldTex) return shieldTex;
    const size = 256;
    const el = document.createElement('canvas');
    el.width = el.height = size;
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(0, 0, size, size);
    // quartos alternados
    ctx.fillStyle = '#8c8c8c';
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.arc(size / 2, size / 2, size, 0, PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size / 2, size / 2);
    ctx.arc(size / 2, size / 2, size, PI, PI * 1.5);
    ctx.closePath();
    ctx.fill();
    // tábuas, riscos e desgaste da borda
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = '#000';
    for (let x = 22; x < size; x += 36) ctx.fillRect(x, 0, 2, size);
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 90; i++) {
        const x = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        const y = (Math.sin(i * 78.233) * 12543.123) % 1;
        ctx.fillRect(Math.abs(x) * size, Math.abs(y) * size, 1 + (i % 3), 6 + (i % 9));
    }
    ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    shieldTex = new THREE.CanvasTexture(el);
    shieldTex.colorSpace = THREE.SRGBColorSpace;
    shieldTex.anisotropy = 4;
    return shieldTex;
}

let shieldGeo = null;
function shieldGeometries() {
    if (shieldGeo) return shieldGeo;
    const R = 0.43;
    // tábua: disco levemente abaulado (face em +Y, depois gira para +X)
    const board = new THREE.LatheGeometry([
        new THREE.Vector2(0, 0.05), new THREE.Vector2(R * 0.5, 0.042), new THREE.Vector2(R * 0.9, 0.02),
        new THREE.Vector2(R, 0.0), new THREE.Vector2(R, -0.022), new THREE.Vector2(0, -0.022)
    ], 28);
    const p = board.attributes.position;
    const uv = board.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * R) + 0.5, p.getZ(i) / (2 * R) + 0.5);
    board.rotateZ(-PI / 2);
    // ferragens: aro + umbo com aba + rebites
    const metal = [];
    const rim = new THREE.TorusGeometry(R, 0.02, 6, 28);
    rim.rotateY(PI / 2);
    metal.push(rim);
    const umbo = new THREE.LatheGeometry([
        new THREE.Vector2(0, 0.105), new THREE.Vector2(0.04, 0.098), new THREE.Vector2(0.075, 0.07), new THREE.Vector2(0.09, 0.03),
        new THREE.Vector2(0.125, 0.022), new THREE.Vector2(0.13, 0.0)
    ], 14);
    umbo.translate(0, 0.045, 0);
    umbo.rotateZ(-PI / 2);
    metal.push(umbo);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const rivet = new THREE.SphereGeometry(0.018, 6, 4);
        rivet.translate(0.03, Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78);
        metal.push(rivet);
    }
    shieldGeo = { board, metal: fuse(metal) };
    return shieldGeo;
}

const SHIELD_COLORS = {
    warm: [0xb23a2e, 0xd9b45a, 0x2f5a8a, 0xe6dcc0, 0x8a2a22, 0x3d6b4a, 0xc98a2e],
    dark: [0x5a1418, 0x2a2428, 0x7a1a1a, 0x3a3a40, 0x1c1a1e, 0x8a2a1a]
};

/** Fileira de escudos redondos pendurados na amurada (2 draw calls: tábuas + ferragens). */
function buildShields(d, { perSide = 7, span = 0.62, palette = 'warm', scale = 1, drop = 0.3 } = {}) {
    const { board, metal } = shieldGeometries();
    const count = perSide * 2;
    const paint = new THREE.MeshStandardMaterial({ map: shieldPaintTexture(), roughness: 0.78, metalness: 0 });
    const boards = new THREE.InstancedMesh(board, paint, count);
    const metals = new THREE.InstancedMesh(metal, iron(0xa8a39a), count);
    const dummy = new THREE.Object3D();
    const p = V();
    const p2 = V();
    const color = new THREE.Color();
    const cols = SHIELD_COLORS[palette] || SHIELD_COLORS.warm;
    let i = 0;
    for (const side of [1, -1]) {
        for (let n = 0; n < perSide; n++) {
            const t = -span + (n / (perSide - 1)) * 2 * span + 0.035;
            hullPoint(d, t, 0.9, 0.09, side, p);
            hullPoint(d, t + 0.02, 0.9, 0.09, side, p2);
            const yaw = Math.atan2(p2.x - p.x, p2.z - p.z);      // tangente do costado
            dummy.position.set(p.x, hullSection(d, t).sheer - drop * scale, p.z);
            dummy.rotation.set(0, yaw + (side > 0 ? 0 : PI), 0);
            dummy.rotateZ(side * 0 - 0.1);
            dummy.scale.setScalar(scale);
            dummy.updateMatrix();
            boards.setMatrixAt(i, dummy.matrix);
            metals.setMatrixAt(i, dummy.matrix);
            boards.setColorAt(i, color.setHex(cols[(n * 3 + (side > 0 ? 0 : 2)) % cols.length]));
            i++;
        }
    }
    boards.castShadow = metals.castShadow = true;
    boards.receiveShadow = true;
    boards.name = 'shieldBoards';
    metals.name = 'shieldIron';
    return [boards, metals];
}

/* ================================================================== */
/* Remos                                                               */
/* ================================================================== */

const oarGeoCache = new Map();
/** Remo ao longo de +X: punho em x = −inboard, tolete em 0, pá até x = reach. */
function oarGeometry(reach = 3.6, inboard = 0.95) {
    const key = `${reach}|${inboard}`;
    if (oarGeoCache.has(key)) return oarGeoCache.get(key);
    const pts = [];
    const n = 22;
    for (let i = 0; i <= n; i++) pts.push(V(lerp(-inboard, reach, i / n), 0, 0));
    const total = reach + inboard;
    const g = tube(pts, (u) => {
        const x = -inboard + u * total;
        const blade = clamp((x - reach * 0.7) / (reach * 0.12), 0, 1);
        const b = blade * blade * (3 - 2 * blade);
        const tip = Math.sqrt(Math.max(0, 1 - Math.pow(clamp((x - reach * 0.93) / (reach * 0.07), 0, 1), 2)));
        const grip = x < -inboard + 0.3 ? 0.008 : 0;
        return [lerp(0.034, 0.014, b) * tip + 0.003, (lerp(0.034, 0.105, b) + grip) * tip + 0.003];
    }, { sides: 8 });
    oarGeoCache.set(key, g);
    return g;
}

/* ================================================================== */
/* Canhões                                                             */
/* ================================================================== */

let cannonGeo = null;
/**
 * Canhão de bordo: cano de bronze (perfil torneado: cascavel, culatra, reforços,
 * bolada, tulipa e alma furada) com munhões, sobre carreta naval de madeira
 * (falcas em degraus, soleira, eixos e quatro rodas). Boca em +Z.
 */
function cannonGeometries() {
    if (cannonGeo) return cannonGeo;
    const S = 1.08;
    const prof = [
        [0, -0.6], [0.04, -0.6], [0.06, -0.565], [0.045, -0.525], [0.032, -0.5], [0.1, -0.475], [0.127, -0.445],
        [0.127, -0.4], [0.113, -0.39], [0.109, -0.1], [0.12, -0.09], [0.12, -0.055], [0.101, -0.045], [0.091, 0.35],
        [0.1, 0.36], [0.1, 0.39], [0.086, 0.4], [0.079, 0.62], [0.098, 0.665], [0.106, 0.7], [0.097, 0.725],
        [0.056, 0.725], [0.056, 0.45], [0, 0.45]
    ].map(([r, y]) => new THREE.Vector2(r * S, y * S));
    const barrel = new THREE.LatheGeometry(prof, 18);
    barrel.rotateX(PI / 2);                                  // eixo Y → +Z
    const trunnion = new THREE.CylinderGeometry(0.042 * S, 0.042 * S, 0.36 * S, 10);
    trunnion.rotateZ(PI / 2);
    trunnion.translate(0, -0.02 * S, -0.07 * S);
    const barrelGeo = fuse([barrel, trunnion]);
    barrelGeo.translate(0, 0.5, 0.1);

    // carreta
    const wood = [];
    const cheek = new THREE.Shape();
    // perfil lateral (z, y): degraus descendo para trás
    cheek.moveTo(0.42, 0.0);
    cheek.lineTo(0.42, 0.3);
    cheek.lineTo(0.2, 0.34);
    cheek.lineTo(0.02, 0.3);
    cheek.lineTo(-0.16, 0.3);
    cheek.lineTo(-0.16, 0.22);
    cheek.lineTo(-0.36, 0.22);
    cheek.lineTo(-0.36, 0.14);
    cheek.lineTo(-0.56, 0.14);
    cheek.lineTo(-0.56, 0.0);
    cheek.closePath();
    for (const side of [1, -1]) {
        const c = new THREE.ExtrudeGeometry(cheek, { depth: 0.065, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 });
        c.rotateY(-PI / 2);                                 // (x,y) do shape → (z,y)
        c.translate(side * 0.155 + 0.0325, 0.06, 0);
        wood.push(c);
    }
    wood.push(plank(0.3, 0.05, 0.9, 0, 0.085, -0.07));       // soleira
    wood.push(plank(0.5, 0.07, 0.09, 0, 0.05, 0.27));        // eixo dianteiro
    wood.push(plank(0.5, 0.07, 0.09, 0, 0.05, -0.42));       // eixo traseiro
    const wheelProf = [[0.02, 0.036], [0.05, 0.04], [0.06, 0.03], [0.1, 0.03], [0.118, 0.036], [0.118, -0.036], [0.1, -0.03], [0.06, -0.03], [0.05, -0.04], [0.02, -0.036]]
        .map(([r, y]) => new THREE.Vector2(r, y));
    for (const sx of [1, -1]) {
        for (const z of [0.27, -0.42]) {
            const w = new THREE.LatheGeometry(wheelProf, 14);
            w.rotateZ(PI / 2);
            w.translate(sx * 0.25, 0.05 + (z < 0 ? -0.012 : 0.0), z);
            wood.push(w);
        }
    }
    // cunha de pontaria sob a culatra
    wood.push(plank(0.12, 0.05, 0.22, 0, 0.19, -0.3, 0.18));
    const carriage = fuse(wood);
    carriage.translate(0, 0.07, 0);
    cannonGeo = { barrel: barrelGeo, carriage, muzzle: V(0, 0.5, 0.1 + 0.73 * S) };
    return cannonGeo;
}

let flashTex = null;
function flashTexture() {
    if (flashTex) return flashTex;
    const size = 128;
    const el = document.createElement('canvas');
    el.width = el.height = size;
    const ctx = el.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,250,225,1)');
    g.addColorStop(0.18, 'rgba(255,214,130,0.95)');
    g.addColorStop(0.45, 'rgba(255,128,40,0.5)');
    g.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    // línguas radiais
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(size / 2, size / 2);
    for (let i = 0; i < 9; i++) {
        ctx.rotate(TAU / 9 + i * 0.13);
        const lg = ctx.createLinearGradient(0, 0, size / 2, 0);
        lg.addColorStop(0, 'rgba(255,230,170,0.7)');
        lg.addColorStop(1, 'rgba(255,120,30,0)');
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.moveTo(0, -5);
        ctx.lineTo(size / 2, 0);
        ctx.lineTo(0, 5);
        ctx.fill();
    }
    flashTex = new THREE.CanvasTexture(el);
    flashTex.colorSpace = THREE.SRGBColorSpace;
    return flashTex;
}

/** Clarão de boca: três quads cruzados, aditivos (um por navio; some em ~0,08 s). */
function buildMuzzleFlash() {
    const quads = [];
    for (let i = 0; i < 2; i++) {
        const q = new THREE.PlaneGeometry(1, 1);
        q.translate(0, 0, 0);
        q.rotateY(PI / 2);
        q.rotateZ((i * PI) / 2);
        q.translate(0, 0, 0.42);
        quads.push(q);
    }
    const front = new THREE.PlaneGeometry(0.9, 0.9);
    front.translate(0, 0, 0.25);
    quads.push(front);
    const m = new THREE.Mesh(fuse(quads), new THREE.MeshBasicMaterial({
        map: flashTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        side: THREE.DoubleSide, toneMapped: false, color: new THREE.Color(2.2, 1.9, 1.4), fog: false
    }));
    m.visible = false;
    m.renderOrder = 5;
    m.name = 'muzzleFlash';
    return m;
}

/* ================================================================== */
/* Vela, mastro e cordame                                              */
/* ================================================================== */

/**
 * Material de tecido animado na GPU. Deslocamento em z (normal ao pano):
 *   dz = aFlutter · vento · [0,07·sin(2,1x + 3,1t) + 0,04·sin(3,3y − 4,3t + x)]
 * `aFlutter` = 0 na verga e nos punhos presos, 1 no meio da esteira solta.
 * A normal recebe a derivada analítica de dz para o sombreado acompanhar as rugas.
 */
export function clothMaterial({ map = null, alphaMap = null, color = 0xffffff, key = 'cloth' } = {}) {
    const m = new THREE.MeshStandardMaterial({
        map, color, roughness: 0.92, metalness: 0, side: THREE.DoubleSide,
        alphaMap, alphaTest: alphaMap ? 0.5 : 0, emissive: 0x000000
    });
    m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = CLOTH.uTime;
        shader.uniforms.uWind = CLOTH.uWind;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float aFlutter;\nuniform float uTime;\nuniform float uWind;')
            .replace('#include <beginnormal_vertex>', /* glsl */ `
                #include <beginnormal_vertex>
                float rkF = aFlutter * uWind;
                float rkA = position.x * 2.1 + uTime * 3.1;
                float rkB = position.y * 3.3 - uTime * 4.3 + position.x;
                objectNormal.x -= rkF * (0.147 * cos(rkA) + 0.04 * cos(rkB));
                objectNormal.y -= rkF * 0.132 * cos(rkB);
                objectNormal = normalize(objectNormal);
            `)
            .replace('#include <begin_vertex>', /* glsl */ `
                #include <begin_vertex>
                transformed.z += rkF * (0.07 * sin(rkA) + 0.04 * sin(rkB));
            `);
    };
    m.customProgramCacheKey = () => `rk-${key}-${alphaMap ? 'a' : 'o'}`;
    return m;
}

/**
 * Pano de vela quadrada: largura w, altura h, topo em y = 0 (verga), já com
 * barriga para +Z e esteira (borda de baixo) em arco.
 *   barriga(u, v) = B · (1 − (2u−1)²) · (0,25 + 0,75·sin(π·v^0,85))
 */
export function sailGeometry(w, h, { belly = 0.55, sx = 18, sy = 12 } = {}) {
    const g = new THREE.PlaneGeometry(w, h, sx, sy);
    g.translate(0, -h / 2, 0);
    const p = g.attributes.position;
    const flutter = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
        const u = p.getX(i) / w + 0.5;
        const v = Math.max(0, -p.getY(i) / h);    // 0 na verga, 1 na esteira
        const e = 1 - Math.pow(2 * u - 1, 2);
        p.setZ(i, belly * e * (0.25 + 0.75 * Math.sin(PI * Math.pow(v, 0.85))) * (0.35 + 0.65 * v));
        p.setY(i, p.getY(i) + 0.22 * e * v * v);
        flutter[i] = v * (1 - Math.pow(Math.abs(2 * u - 1), 3) * v);
    }
    g.setAttribute('aFlutter', new THREE.BufferAttribute(flutter, 1));
    g.computeVertexNormals();
    return g;
}

/* ================================================================== */
/* Tripulação                                                          */
/* ================================================================== */

/**
 * Tripulação de um navio. Cada tripulante é um `createHero`; papéis:
 *   'rower'  — sentado, modo `row` com a fase do remo (sincronizado);
 *   'stand'  — modo base (idle/hold/block…) + ação de disparo único por `play()`.
 * `update(dt, fase, override)` — override força um modo em todos (ex.: 'fall' ao afundar).
 */
export class Crew {
    constructor(parent) {
        this.parent = parent;
        this.list = [];
    }

    add(preset, { x = 0, y = 0, z = 0, rotY = 0, detail = 1, role = 'stand', mode = 'idle', scale = 1, phase = 0, options = null } = {}) {
        const hero = createHero({ preset, detail, ...(options || {}) });
        hero.object.position.set(x, y, z);
        hero.object.rotation.y = rotY;
        hero.object.scale.setScalar(scale);
        this.parent.add(hero.object);
        const entry = {
            hero, role, baseMode: mode, phase, onceMode: null, onceT: 0, onceDur: 0, lower: false,
            state: { mode, speed: 1, phase: undefined, upper: null, upperPhase: 0, amount: undefined, duration: undefined },
            home: V(x, y, z), homeRot: rotY
        };
        this.list.push(entry);
        return entry;
    }

    /** Dispara uma ação curta (attack, hit, cheer…) sobre o modo base. `full` troca o corpo todo. */
    play(entry, mode, duration = 0.6, full = false) {
        if (!entry) return;
        entry.onceMode = mode;
        entry.onceT = 0;
        entry.onceDur = duration;
        entry.lower = full;
    }

    update(dt, rowPhase = 0, override = null) {
        for (let i = 0; i < this.list.length; i++) {
            const e = this.list[i];
            const st = e.state;
            st.phase = undefined;
            st.upper = null;
            st.duration = undefined;
            if (override) {
                st.mode = override;
            } else if (e.role === 'rower') {
                st.mode = 'row';
                st.phase = rowPhase + e.phase;
            } else {
                st.mode = e.baseMode;
                if (e.onceDur > 0) {
                    e.onceT += dt;
                    const k = Math.min(1, e.onceT / e.onceDur);
                    if (e.lower) {
                        st.mode = e.onceMode;
                        st.phase = k;
                    } else {
                        st.upper = e.onceMode;
                        st.upperPhase = k;
                    }
                    if (k >= 1) e.onceDur = 0;
                }
            }
            e.hero.update(dt, st);
        }
    }

    /** Devolve todos aos postos (ao reciclar o navio do pool). */
    reset() {
        for (const e of this.list) {
            e.hero.object.position.copy(e.home);
            e.hero.object.rotation.set(0, e.homeRot, 0);
            e.onceDur = 0;
        }
    }

    setVisible(v) {
        for (const e of this.list) e.hero.object.visible = v;
    }

    dispose() {
        for (const e of this.list) e.hero.dispose();
        this.list.length = 0;
    }
}

/* ================================================================== */
/* Drakkar                                                             */
/* ================================================================== */

const _m = new THREE.Matrix4();
const _dummy = new THREE.Object3D();

/** Altura do banco de remo acima do convés (a pelve do herói em `row` fica ~0,3 m do chão). */
const BENCH_H = 0.22;

/**
 * Drakkar completo.
 *
 * @param {object} o
 * @param {number} [o.length] [o.beam]
 * @param {number} [o.hullColor]     multiplica a textura de tábuas do costado
 * @param {string} [o.sailBase] [o.sailStripe] [o.emblem]   ver `sailTexture`
 * @param {boolean} [o.shields] [o.oars] [o.dragon] [o.lantern] [o.cannons] [o.cargo]
 * @param {boolean} [o.lanternLight] ignorado: a luz vem de `fireLights` (quem anima o navio pede)
 * @param {null|{preset?:string, presets?:string[], rowers?:number, detail?:number}} [o.crew]  remadores
 * @param {'low'|'medium'|'high'} [o.tier]   reduz anéis/segmentos em 'low'
 * @param {'warm'|'dark'} [o.palette]        cores dos escudos e do entalhe
 * @returns {{ group: THREE.Group, parts: object }}  ver `parts` no fim da função
 */
export function buildLongship({
    length = 15,
    beam = 3.6,
    hullColor = 0xffffff,
    sailBase = '#ded1b0',
    sailStripe = '#a02f2f',
    emblem = 'cross',
    shields = true,
    oars = true,
    dragon = true,
    lantern = true,
    lanternLight = true,       // eslint-disable-line no-unused-vars
    cannons = false,
    cargo = false,
    crew = null,
    tier = 'high',
    palette = 'warm',
    oarsPerSide = 3
} = {}) {
    const group = new THREE.Group();
    const k = length / 15;                       // escala das peças em relação ao drakkar do jogador
    const low = tier === 'low';
    const d = hullDims({ length, beam, depth: 1.6 * Math.min(1.25, Math.max(0.85, k)), rise: 2.0 * Math.max(0.8, Math.min(1.2, k)) });
    const deckY = -0.5;
    const parts = {
        oars: [], shields: [], lights: [], cannons: [], crew: null, rowPhase: 0, dims: d, deckY,
        seats: [], time: 0
    };

    // ---- costado trincado (material próprio: a fúria e o pisca mexem no emissivo) ----
    const hullMat = plankWood(hullColor, PLANK_TILE).clone();
    hullMat.side = THREE.DoubleSide;
    hullMat.emissive = new THREE.Color(0x000000);
    const hull = mesh(clinkerHullGeometry(d, { strakes: low ? 5 : 7, rings: low ? 28 : 46 }), hullMat, { name: 'hull' });
    group.add(hull);
    parts.hull = hull;

    // ---- convés ----
    const deck = mesh(deckGeometry(d, deckY, { rings: low ? 24 : 40 }), darkWood(0xd8c8b4, 2.2), { cast: false, name: 'deck' });
    group.add(deck);

    // ---- estrutura de carvalho: cavernas, verdugo, quilha, bancos, mastro, verga ----
    const oak = [hullFramingGeometry(d, deckY, { ribs: low ? 7 : 13 })];
    const carved = [];
    const gilt = [];

    // posições dos remos (t ao longo do casco) e bancos
    const oarT = [];
    for (let i = 0; i < oarsPerSide; i++) oarT.push(oarsPerSide === 1 ? 0 : -0.16 + (i / (oarsPerSide - 1)) * 0.72);
    if (cannons) {
        // com canhões, os remadores ficam entre as peças
        oarT.length = 0;
        oarT.push(-0.16, 0.21, 0.56);
    }
    for (const t of oarT) {
        const w = hullHalfWidthAt(d, t, deckY + BENCH_H);
        const z = (t * length) / 2;
        oak.push(plank(w * 2 - 0.06, 0.05, 0.3, 0, deckY + BENCH_H, z));
        oak.push(plank(0.06, BENCH_H, 0.26, 0, deckY + BENCH_H / 2, z));
    }

    // tombadilho: estrado elevado na popa, onde fica o timoneiro
    const poopY = deckY + 0.42;
    const poopT = [-0.84, -0.5];
    {
        const g = deckGeometry(d, poopY, { rings: 10, tMin: poopT[0], tMax: poopT[1] });
        oak.push(g);
        const wFront = hullHalfWidthAt(d, poopT[1], deckY + 0.2);
        oak.push(plank(wFront * 2 - 0.05, 0.44, 0.06, 0, deckY + 0.21, (poopT[1] * length) / 2));
        oak.push(plank(0.7, 0.06, 0.3, 0, deckY + 0.2, (poopT[1] * length) / 2 + 0.2));   // degrau
    }
    parts.poopY = poopY;

    // mastro e verga
    const mastZ = 0.06 * length;
    const mastTop = 6.9 * k + 0.3;
    const yardY = 5.9 * k + 0.2;
    const sailW = 4.5 * k + 0.3;
    const sailH = 3.3 * k + 0.2;
    {
        const pts = [];
        for (let i = 0; i <= 10; i++) pts.push(V(0, lerp(deckY - 0.1, mastTop, i / 10), mastZ));
        oak.push(tube(pts, (u) => lerp(0.13, 0.075, u) * (0.6 + 0.4 * k), { sides: 10 }));
        oak.push(plank(0.5, 0.12, 0.7, 0, deckY + 0.06, mastZ));            // enora (calço do mastro)
        const yard = [];
        for (let i = 0; i <= 10; i++) yard.push(V(lerp(-sailW / 2 - 0.3, sailW / 2 + 0.3, i / 10), yardY, mastZ + 0.16));
        oak.push(tube(yard, (u) => (0.045 + 0.035 * Math.sin(u * PI)) * (0.6 + 0.4 * k), { sides: 8 }));
    }

    // ---- entalhes: dragão na proa, voluta na popa ----
    let eyesGeo = null;
    const headScale = 0.82 * (0.55 + 0.45 * k);
    if (dragon) {
        const head = dragonHeadGeometry(d, headScale);
        carved.push(head.wood);
        gilt.push(head.gilt);
        eyesGeo = head.eyes;
    } else {
        // roda de proa simples, em voluta (a cauda da popa espelhada)
        const tail = sternTailGeometry(d, headScale * 0.8);
        tail.wood = mirrorZ(fuse([tail.wood]));
        mirrorZ(tail.gilt);
        carved.push(tail.wood);
        gilt.push(tail.gilt);
    }
    {
        const tail = sternTailGeometry(d, headScale);
        carved.push(tail.wood);
        gilt.push(tail.gilt);
    }

    // ---- leme lateral (remo de governo a boreste da popa) ----
    const rudderT = -0.66;
    const rudder = new THREE.Group();
    {
        const sec = hullSection(d, rudderT);
        const rx = sec.hw + 0.14;
        const blade = [];
        for (let i = 0; i <= 14; i++) blade.push(V(0, lerp(1.25, -2.15, i / 14), 0));
        const g = tube(blade, (u) => {
            const b = clamp((u - 0.35) / 0.2, 0, 1);
            const tip = Math.sqrt(Math.max(0, 1 - Math.pow(clamp((u - 0.9) / 0.1, 0, 1), 2)));
            return [lerp(0.045, 0.028, b) * tip + 0.004, lerp(0.05, 0.3, b * b * (3 - 2 * b)) * tip + 0.004];
        }, { sides: 8 });
        // cana do leme: do topo da madre para dentro do barco
        const tiller = tube([V(0, 1.15, 0), V(-0.5, 1.08, 0.03), V(-1.05, 1.0, 0.05)], (u) => lerp(0.04, 0.028, u), { sides: 7 });
        const rm = mesh(fuse([g, tiller]), oakWood(0xcdb89a), { name: 'rudder' });
        rudder.add(rm);
        rudder.position.set(rx, sec.sheer - 0.35, sec.z);
        // rotation.y positivo roda a pá — o player.js aplica −yaw·1,8
        group.add(rudder);
        // braçadeira do leme no costado
        gilt.push(new THREE.TorusGeometry(0.075, 0.022, 6, 10).rotateX(PI / 2).translate(rx, sec.sheer - 0.3, sec.z));
    }
    parts.rudder = rudder;
    parts.helm = { x: hullSection(d, rudderT).hw - 1.0, y: poopY, z: hullSection(d, rudderT).z - 0.1 };

    // ---- cordame ----
    const ropes = [];
    {
        const top = V(0, mastTop - 0.15, mastZ);
        const bow = hullSection(d, 0.97);
        ropes.push(rope(top, V(0, bow.sheer + 0.25, bow.z), 0.1));
        const st = hullSection(d, -0.97);
        ropes.push(rope(top, V(0, st.sheer + 0.25, st.z), 0.1));
        for (const side of [1, -1]) {
            for (const dz of [-1.5, 1.3]) {
                const t = (mastZ + dz * k) / (length / 2);
                const s = hullSection(d, t);
                ropes.push(rope(V(0, mastTop - 0.5, mastZ), V(side * s.hw, s.sheer + 0.06, s.z), 0.03));
            }
            // braços da verga e escotas da vela
            const tb = (mastZ - 3.6 * k) / (length / 2);
            const sb = hullSection(d, tb);
            ropes.push(rope(V(side * (sailW / 2 + 0.25), yardY, mastZ + 0.16), V(side * sb.hw, sb.sheer + 0.06, sb.z), 0.22));
            const tc = (mastZ - 1.9 * k) / (length / 2);
            const sc = hullSection(d, tc);
            ropes.push(rope(V(side * sailW / 2, yardY - sailH + 0.02, mastZ + 0.36), V(side * sc.hw, sc.sheer + 0.06, sc.z), 0.1));
            // amantilhos (topo do mastro → pontas da verga)
            ropes.push(rope(V(0, mastTop - 0.2, mastZ + 0.05), V(side * (sailW / 2 + 0.2), yardY + 0.05, mastZ + 0.16), 0.02, 0.016));
        }
        // amarração da vela na verga (voltas de cabo)
        for (let i = 0; i <= 8; i++) {
            const x = lerp(-sailW / 2, sailW / 2, i / 8);
            ropes.push(new THREE.TorusGeometry(0.075, 0.016, 5, 8).rotateY(PI / 2).translate(x, yardY, mastZ + 0.16));
        }
    }

    group.add(mesh(fuse(oak), oakWood(0xb9a488), { name: 'framing' }));
    group.add(mesh(fuse(carved), darkWood(palette === 'dark' ? 0x8a7a70 : 0xe8cfa8, 1.4), { name: 'carving' }));
    group.add(mesh(fuse(gilt), bronze(palette === 'dark' ? 0x8a8078 : 0xd8a94a, 0.36), { name: 'gilt' }));
    group.add(mesh(fuse(ropes), plain(0x5a4a36, 0.95), { cast: false, name: 'rigging' }));
    if (eyesGeo) {
        const eyes = mesh(eyesGeo, glow(palette === 'dark' ? 0xff3a1a : 0xffb030, palette === 'dark' ? 5 : 3), { cast: false, name: 'eyes' });
        group.add(eyes);
        parts.eyes = eyes;
    }

    // ---- vela ----
    const sailMat = clothMaterial({ map: sailTexture({ base: sailBase, stripe: sailStripe, emblem }), key: 'sail' });
    const sail = mesh(sailGeometry(sailW, sailH, { belly: 0.5 * k + 0.1, sx: low ? 10 : 18, sy: low ? 7 : 12 }), sailMat, { name: 'sail' });
    sail.position.set(0, yardY - 0.06, mastZ + 0.2);
    group.add(sail);
    parts.sail = sail;
    parts.mast = { z: mastZ, top: mastTop, yardY, sailW, sailH };

    // ---- escudos ----
    if (shields) {
        const sh = buildShields(d, { perSide: low ? 5 : 7, palette, scale: 0.85 + 0.15 * k });
        group.add(sh[0], sh[1]);
        parts.shields = sh;
    }

    // ---- remos (1 draw call; os Object3D em parts.oars guardam o estado de cada remo) ----
    let oarMesh = null;
    if (oars) {
        const reach = 3.6 * (0.7 + 0.3 * k);
        const list = [];
        for (const side of [1, -1]) {
            for (let i = 0; i < oarT.length; i++) {
                const t = oarT[i];
                const sec = hullSection(d, t);
                const pivot = new THREE.Object3D();
                pivot.rotation.order = 'YZX';
                pivot.position.set(side * (sec.hw + 0.02), sec.sheer + 0.085, sec.z);
                pivot.userData.side = side;
                pivot.userData.phase = i * 0.22;
                pivot.userData.baseRoll = 0;
                list.push(pivot);
            }
        }
        oarMesh = new THREE.InstancedMesh(oarGeometry(reach, 0.95), oakWood(0xc9b08a), list.length);
        oarMesh.castShadow = true;
        oarMesh.frustumCulled = false;
        oarMesh.name = 'oars';
        group.add(oarMesh);
        parts.oars = list;
        parts.oarMesh = oarMesh;
        // assentos dos remadores (um por remo)
        for (const pivot of list) {
            parts.seats.push({
                x: pivot.position.x - pivot.userData.side * 0.92, y: deckY, z: pivot.position.z + 0.12,
                phase: pivot.userData.phase
            });
        }
    }

    // ---- canhões (2 draw calls: bronze + carretas) ----
    let barrelMesh = null;
    let carriageMesh = null;
    let flash = null;
    if (cannons) {
        const geo = cannonGeometries();
        const spots = [];
        for (const side of [1, -1]) {
            for (const t of [-0.35, 0.02, 0.39]) {
                const w = hullHalfWidthAt(d, t, deckY);
                spots.push({ side, aim: 'broadside', x: side * (w - 0.78), z: (t * length) / 2, ry: side * PI / 2, y: deckY + 0.42 });
            }
        }
        spots.push({ side: 0, aim: 'bow', x: 0, z: 0.7 * length / 2, ry: 0, y: deckY + 0.6 });
        barrelMesh = new THREE.InstancedMesh(geo.barrel, bronze(), spots.length);
        carriageMesh = new THREE.InstancedMesh(geo.carriage, oakWood(0x9a7f62, 1.2), spots.length);
        barrelMesh.castShadow = carriageMesh.castShadow = true;
        carriageMesh.receiveShadow = true;
        barrelMesh.frustumCulled = carriageMesh.frustumCulled = false;
        barrelMesh.name = 'cannonBarrels';
        carriageMesh.name = 'cannonCarriages';
        group.add(barrelMesh, carriageMesh);
        const blocks = [];
        for (let i = 0; i < spots.length; i++) {
            const s = spots[i];
            const gun = new THREE.Object3D();
            gun.position.set(s.x, s.y, s.z);
            gun.rotation.y = s.ry;
            gun.userData.side = s.side;
            gun.userData.aim = s.aim;
            gun.userData.muzzleLocal = geo.muzzle.clone();
            gun.userData.index = i;
            gun.userData.recoil = 0;          // deslocamento atual (m, para trás)
            gun.userData.recoilV = 0;         // velocidade (m/s)
            gun.userData.home = gun.position.clone();
            gun.userData.back = V(-Math.sin(s.ry), 0, -Math.cos(s.ry));
            gun.updateMatrix();
            group.add(gun);
            parts.cannons.push(gun);
            // estrado sob cada peça (o canhão atira por cima da amurada)
            blocks.push(plank(0.74, s.y - deckY, 1.3, 0, 0, 0).applyMatrix4(_m.makeRotationY(s.ry)).translate(s.x, deckY + (s.y - deckY) / 2, s.z));
        }
        group.add(mesh(fuse(blocks), darkWood(0xbfae98, 2.2), { name: 'gunDecks' }));
        flash = buildMuzzleFlash();
        group.add(flash);
        parts.flash = flash;
    }

    // ---- lanterna de popa ----
    if (lantern) {
        const st = hullSection(d, -0.9);
        const lx = 0;
        const ly = st.sheer + 1.15;
        const lz = st.z + 0.55;
        const hook = tube(smoothPath([V(0, st.sheer + 0.2, st.z - 0.1), V(0, ly + 0.5, st.z + 0.15), V(0, ly + 0.55, lz), V(0, ly + 0.36, lz)], 12), 0.022, { sides: 6, planar: true });
        const cage = [hook];
        const body = new THREE.LatheGeometry([[0, 0.36], [0.05, 0.34], [0.07, 0.27], [0.125, 0.25], [0.11, 0.22], [0.11, 0.2]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
        cage.push(body);
        const base = new THREE.LatheGeometry([[0.11, 0.0], [0.125, -0.02], [0.1, -0.05], [0, -0.06]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
        cage.push(base);
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * TAU + PI / 4;
            cage.push(tube([V(Math.cos(a) * 0.105, 0, Math.sin(a) * 0.105), V(Math.cos(a) * 0.105, 0.21, Math.sin(a) * 0.105)], 0.009, { sides: 4 }));
        }
        for (let i = 1; i < cage.length; i++) cage[i].translate(lx, ly, lz);
        group.add(mesh(fuse(cage), iron(0x8f8a80), { name: 'lantern' }));
        const flameGeo = new THREE.LatheGeometry([[0, 0.17], [0.022, 0.13], [0.045, 0.07], [0.04, 0.03], [0, 0.015]].map(([r, y]) => new THREE.Vector2(r, y)), 8);
        const flame = mesh(flameGeo, glow(0xffb45a, 6), { cast: false, name: 'lanternFlame' });
        flame.position.set(lx, ly, lz);
        group.add(flame);
        parts.lantern = flame;
        parts.lanternFlame = flame;
    }

    // ---- carga no convés (assets fotogramétricos; entram quando carregarem) ----
    if (cargo) {
        const put = (name, opts, x, z, ry = 0, tilt = 0) => loadModel(name, opts).then((obj) => {
            if (!obj) return;
            obj.position.set(x, deckY, z);
            obj.rotation.set(tilt, ry, 0);
            obj.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = true;
                    c.receiveShadow = true;
                }
            });
            group.add(obj);
        });
        put('wine_barrel_01', { height: 0.72 }, -0.45, mastZ - 0.75, 0.4);
        put('wine_barrel_01', { height: 0.72 }, 0.42, mastZ - 0.85, 1.9);
        put('wooden_crate_01', { height: 0.5 }, 0.0, mastZ - 1.45, 0.3);
    }

    // ---- tripulação: remadores ----
    if (crew && parts.seats.length) {
        const rig = new Crew(group);
        const n = Math.min(crew.rowers ?? parts.seats.length, parts.seats.length);
        const presets = crew.presets || [crew.preset || 'peasant'];
        // preenche primeiro os assentos alternando os bordos
        const order = parts.seats.map((s, i) => i).sort((a, b) => (a % oarT.length) - (b % oarT.length));
        for (let i = 0; i < n; i++) {
            const seat = parts.seats[order[i]];
            rig.add(presets[i % presets.length], {
                x: seat.x, y: seat.y, z: seat.z, rotY: PI, detail: crew.detail ?? 1, role: 'rower', phase: seat.phase,
                options: crew.options?.[i % (crew.options?.length || 1)] || null
            });
        }
        parts.crew = rig;
    }

    /* ---------------------------------------------------------------- */
    /* Animação                                                          */
    /* ---------------------------------------------------------------- */

    const flashState = { t: 0 };

    /**
     * Anima remos, remadores, vela, canhões (recuo) e clarão.
     * @param {number} dt
     * @param {number} time
     * @param {object} [a]
     * @param {number} [a.rowRate]    velocidade angular da remada (rad/s); 0 = remos recolhidos na água
     * @param {number} [a.speedRatio] 0–1, enfuna a vela
     * @param {number} [a.steer]      −1…1 (reservado: a verga acompanha o rumo)
     * @param {number} [a.wind]       força do pano (padrão 1)
     * @param {string|null} [a.crewMode] força um modo em toda a tripulação (ex.: 'fall')
     */
    parts.animate = (dt, time, a = EMPTY) => {
        const rowRate = a.rowRate ?? 3;
        parts.time = time;
        parts.rowPhase += dt * rowRate;
        CLOTH.uTime.value = time;
        CLOTH.uWind.value = a.wind ?? 1;

        if (oarMesh) {
            const list = parts.oars;
            for (let i = 0; i < list.length; i++) {
                const o = list[i];
                const ph = parts.rowPhase + o.userData.phase;
                o.rotation.y = (o.userData.side > 0 ? 0 : PI) - o.userData.side * 0.45 * Math.cos(ph);
                o.rotation.z = -(0.25 + 0.11 * Math.sin(ph));
                o.rotation.x = 0;
                o.updateMatrix();
                oarMesh.setMatrixAt(i, o.matrix);
            }
            oarMesh.instanceMatrix.needsUpdate = true;
        }

        if (barrelMesh) {
            // recuo: mola amortecida  x'' = −k·x − c·x'  (k = 90 s⁻², c = 11 s⁻¹ → volta em ~0,5 s sem oscilar)
            let dirty = false;
            for (let i = 0; i < parts.cannons.length; i++) {
                const g = parts.cannons[i];
                const u = g.userData;
                if (u.recoil === 0 && u.recoilV === 0 && u.placed) continue;
                u.recoilV += (-90 * u.recoil - 11 * u.recoilV) * dt;
                u.recoil += u.recoilV * dt;
                if (Math.abs(u.recoil) < 0.002 && Math.abs(u.recoilV) < 0.02) {
                    u.recoil = 0;
                    u.recoilV = 0;
                }
                g.position.copy(u.home).addScaledVector(u.back, Math.max(0, u.recoil));
                g.updateMatrix();
                barrelMesh.setMatrixAt(i, g.matrix);
                carriageMesh.setMatrixAt(i, g.matrix);
                u.placed = true;
                dirty = true;
            }
            if (dirty) {
                barrelMesh.instanceMatrix.needsUpdate = true;
                carriageMesh.instanceMatrix.needsUpdate = true;
            }
            if (flash.visible) {
                flashState.t -= dt;
                if (flashState.t <= 0) flash.visible = false;
                else flash.scale.setScalar(1.2 + (0.09 - flashState.t) * 14);
            }
        }

        if (parts.lanternFlame) {
            const s = 0.85 + Math.sin(time * 8.5) * 0.15;
            parts.lanternFlame.scale.set(s, s * 1.3, s);
        }

        if (parts.crew) parts.crew.update(dt, parts.rowPhase, a.crewMode || null);
    };

    /**
     * Dispara o canhão `gun` (um dos `parts.cannons`): recuo + clarão de boca.
     * Quem chama cuida da bala, da fumaça e da luz (`fireLights.request`).
     */
    parts.fireGun = (gun) => {
        if (!gun || !barrelMesh) return;
        gun.userData.recoilV = 5.2;           // m/s para trás → pico de ~0,33 m
        flash.position.copy(gun.userData.home).add(_dummy.position.copy(gun.userData.muzzleLocal).applyEuler(gun.rotation));
        flash.rotation.set(0, gun.rotation.y, Math.random() * TAU);
        flash.visible = true;
        flashState.t = 0.085;
    };

    /** Emissivo do casco e da vela (fúria, pisca de dano). */
    parts.setEmissive = (r, g, b) => {
        hullMat.emissive.setRGB(r, g, b);
        sailMat.emissive.setRGB(r * 0.6, g * 0.6, b * 0.6);
    };

    parts.dispose = () => {
        parts.crew?.dispose();
        group.traverse((c) => {
            if (c.isInstancedMesh) c.dispose();
        });
        hullMat.dispose();
        sailMat.dispose();
    };

    parts.animate(0, 0, { rowRate: 0 });
    group.userData.parts = parts;
    return { group, parts };
}

const EMPTY = {};

/* ================================================================== */
/* Balsa de troncos                                                    */
/* ================================================================== */

/**
 * Balsa inimiga: troncos amarrados, paliçada de estacas na proa (+Z), mastro
 * curto com flâmula rasgada, braseiro e postos para a tripulação.
 * Origem na linha d'água (o jogo põe a raiz ~0,35 m acima da água).
 */
export function buildRaft({ tier = 'high' } = {}) {
    const group = new THREE.Group();
    const low = tier === 'low';
    const logs = [];
    const wood = [];
    const ropes = [];
    const hash = (n) => {
        const s = Math.sin(n * 127.1 + 31.7) * 43758.5453;
        return s - Math.floor(s);
    };
    const log = (x, y, z0, z1, r, seed, sides = 9) => {
        const pts = [];
        for (let i = 0; i <= 6; i++) {
            const t = i / 6;
            pts.push(V(x + (hash(seed + i) - 0.5) * 0.06, y + (hash(seed + i + 9) - 0.5) * 0.05, lerp(z0, z1, t)));
        }
        return tube(pts, (u) => r * (0.9 + 0.14 * hash(seed + Math.round(u * 6) * 3)), { sides });
    };
    // convés: 9 troncos lado a lado
    const n = 9;
    for (let i = 0; i < n; i++) {
        const x = (i - (n - 1) / 2) * 0.56;
        logs.push(log(x, 0, -4.3 + hash(i) * 0.5, 4.2 - hash(i + 5) * 0.6, 0.27 + hash(i + 2) * 0.05, i * 17, low ? 7 : 9));
    }
    // travessas amarradas por cima
    for (const z of [-3.2, -0.2, 2.9]) {
        const pts = [];
        for (let i = 0; i <= 4; i++) pts.push(V(lerp(-2.75, 2.75, i / 4), 0.36, z));
        logs.push(tube(pts, 0.15, { sides: 8 }));
        for (let i = 0; i < n; i += 2) {
            const x = (i - (n - 1) / 2) * 0.56;
            ropes.push(new THREE.TorusGeometry(0.2, 0.03, 5, 10).rotateY(PI / 2).rotateZ(0.5).translate(x + 0.28, 0.3, z));
        }
    }
    // paliçada na proa: estacas apontadas, alturas irregulares, com seteiras
    for (let i = 0; i < 11; i++) {
        const x = (i - 5) * 0.5;
        if (i === 3 || i === 7) continue;                  // seteiras
        const h = 1.75 + hash(i + 40) * 0.5;
        const pts = [V(x, 0.2, 3.55), V(x + (hash(i) - 0.5) * 0.05, 0.2 + h * 0.5, 3.6), V(x, 0.2 + h, 3.66)];
        logs.push(tube(pts, (u) => (u > 0.8 ? lerp(0.17, 0.015, (u - 0.8) / 0.2) : 0.17), { sides: 7 }));
    }
    for (const y of [0.85, 1.5]) wood.push(plank(5.3, 0.12, 0.08, 0, y, 3.44));
    // escoras da paliçada
    for (const x of [-1.9, 1.9]) wood.push(plank(0.1, 0.1, 1.9, x, 0.95, 2.75, -0.82));
    // mastro curto + verga da flâmula
    {
        const pts = [];
        for (let i = 0; i <= 6; i++) pts.push(V(0, lerp(0.2, 4.6, i / 6), -1.2));
        logs.push(tube(pts, (u) => lerp(0.11, 0.07, u), { sides: 8 }));
        wood.push(plank(1.5, 0.07, 0.07, 0, 4.3, -1.14));
    }
    // caixotes/abrigo: estrado baixo na popa
    wood.push(plank(2.2, 0.08, 1.4, 0, 0.42, -3.1));
    for (const sx of [-1, 1]) wood.push(plank(0.1, 0.9, 0.1, sx * 1.0, 0.85, -3.7));
    wood.push(plank(2.3, 0.07, 0.1, 0, 1.3, -3.7));

    const hullMat = barkWood(1.5, 1.4).clone();
    hullMat.emissive = new THREE.Color(0);
    const hull = mesh(fuse(logs), hullMat, { name: 'raftLogs' });
    group.add(hull);
    group.add(mesh(fuse(wood), darkWood(0xa89684, 2), { name: 'raftPlanks' }));
    group.add(mesh(fuse(ropes), plain(0x6a583e, 0.95), { cast: false, name: 'raftRopes' }));

    // braseiro: bacia de ferro sobre tripé, brasas emissivas
    const braz = [];
    braz.push(new THREE.LatheGeometry([[0, 0.0], [0.2, 0.02], [0.3, 0.12], [0.33, 0.24], [0.3, 0.25], [0.26, 0.14], [0, 0.1]].map(([r, y]) => new THREE.Vector2(r, y)), 12).translate(0, 0.95, 0));
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        braz.push(tube([V(Math.cos(a) * 0.32, 0.25, Math.sin(a) * 0.32), V(Math.cos(a) * 0.1, 0.97, Math.sin(a) * 0.1)], 0.022, { sides: 5 }));
    }
    const brazier = mesh(fuse(braz), iron(0x6a655e), { name: 'brazier' });
    brazier.position.set(1.5, 0.15, 1.6);
    group.add(brazier);
    const coals = mesh(new THREE.LatheGeometry([[0, 0.2], [0.1, 0.17], [0.24, 0.1], [0.27, 0.04], [0, 0.03]].map(([r, y]) => new THREE.Vector2(r, y)), 10), glow(0xff6a1e, 5), { cast: false, name: 'coals' });
    coals.position.set(1.5, 1.2, 1.6);
    group.add(coals);

    // flâmula rasgada
    const banner = mesh(sailGeometry(1.3, 2.1, { belly: 0.12, sx: 8, sy: 8 }), clothMaterial({ map: sailTexture({ base: '#241d28', stripe: '#8b1d1d', emblem: 'rune' }), alphaMap: tornAlphaTexture(), key: 'banner' }), { name: 'banner' });
    banner.position.set(0, 4.26, -1.1);
    group.add(banner);

    const parts = {
        hull, oars: [], cannons: [], shields: [], lights: [], rowPhase: 0, time: 0,
        fire: V(1.5, 1.45, 1.6),                 // ponto do braseiro (local) para luz/fagulhas
        posts: [                                 // postos da tripulação (local)
            { x: -1.1, y: 0.3, z: 2.6, rotY: 0, role: 'archer' },
            { x: 0.5, y: 0.3, z: 2.5, rotY: 0, role: 'archer' },
            { x: 0.2, y: 0.47, z: -3.0, rotY: 0, role: 'poler' }
        ],
        crew: null
    };
    parts.animate = (dt, time, a = EMPTY) => {
        parts.time = time;
        CLOTH.uTime.value = time;
        CLOTH.uWind.value = a.wind ?? 1;
        const s = 0.9 + Math.sin(time * 9.3) * 0.1;
        coals.scale.set(s, s * 1.1, s);
        if (parts.crew) parts.crew.update(dt, 0, a.crewMode || null);
    };
    parts.setEmissive = (r, g, b) => hullMat.emissive.setRGB(r, g, b);
    parts.dispose = () => {
        parts.crew?.dispose();
        hullMat.dispose();
    };
    group.userData.parts = parts;
    return { group, parts };
}

let tornTex = null;
/** Máscara alfa de pano rasgado: borda de baixo em farrapos e alguns furos. */
export function tornAlphaTexture() {
    if (tornTex) return tornTex;
    const size = 256;
    const el = document.createElement('canvas');
    el.width = el.height = size;
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = '#000';
    const h = (n) => {
        const s = Math.sin(n * 91.7 + 13.1) * 43758.5453;
        return s - Math.floor(s);
    };
    // farrapos na borda de baixo (v = 0 fica embaixo na textura → y = size)
    ctx.beginPath();
    ctx.moveTo(0, size);
    for (let i = 0; i <= 24; i++) {
        const x = (i / 24) * size;
        const depth = (i % 2 ? 0.05 : 0.2) + h(i) * 0.18;
        ctx.lineTo(x, size - depth * size);
    }
    ctx.lineTo(size, size);
    ctx.closePath();
    ctx.fill();
    // rasgos laterais e furos
    for (let i = 0; i < 7; i++) {
        const x = h(i + 30) * size;
        const y = (0.25 + h(i + 60) * 0.6) * size;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(h(i + 80) * PI);
        ctx.beginPath();
        ctx.ellipse(0, 0, 4 + h(i + 5) * 9, 12 + h(i + 7) * 26, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
    }
    tornTex = new THREE.CanvasTexture(el);
    tornTex.anisotropy = 4;
    return tornTex;
}

/** Custo de um objeto (triângulos e draw calls visíveis) — usado nos testes. */
export function measure(root) {
    let tris = 0;
    let draws = 0;
    root.traverse((o) => {
        if (!(o.isMesh || o.isSkinnedMesh) || !o.visible) return;
        const g = o.geometry;
        const n = (g.index ? g.index.count : g.attributes.position.count) / 3;
        tris += n * (o.isInstancedMesh ? o.count : 1);
        draws += Array.isArray(o.material) ? o.material.length : 1;
    });
    return { tris: Math.round(tris), draws };
}

