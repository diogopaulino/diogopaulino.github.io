/**
 * João e o Pé de Feijão — construções e objetos modelados em three.js.
 *
 * Tudo aqui é geometria de verdade (paredes com espessura e vãos recortados,
 * vigas chanfradas, palha com beiral, cantaria) com materiais PBR de
 * `gfx/assets.js` e UV em metros (`applyWorldUV`). Cada construtor devolve um
 * `THREE.Group` com a origem no chão; peças do mesmo material são fundidas em
 * uma malha só (1 draw call por material).
 *
 * Convenções: frente = +Z local, medidas em metros.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldUV, fbm2, seeded } from '../../shared/gfx/core.js';
import { pbrMaterial, pbrSet, loadModel } from '../../shared/gfx/assets.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/* ------------------------------------------------------------------ */
/* Materiais (cache por chave: N casas compartilham os mesmos)         */
/* ------------------------------------------------------------------ */

const matCache = new Map();
function mat(key, make) {
    if (!matCache.has(key)) matCache.set(key, make());
    return matCache.get(key);
}

export const MAT = {
    /* Reboco caiado: só o relevo (normal + AO/rugosidade) de rough_plaster_03 — o albedo do conjunto é escuro demais para cal. */
    plaster: () => mat('plaster', () => {
        const set = pbrSet('rough_plaster_03');
        const m = new THREE.MeshStandardMaterial({ color: 0xefe3c8, normalMap: set.normalMap, roughnessMap: set.roughnessMap, aoMap: set.aoMap, roughness: 1 });
        m.normalScale.set(1.4, 1.4);
        return m;
    }),
    timber: () => mat('timber', () => {
        const m = pbrMaterial('dark_wooden_planks', { color: 0xc8aa8a, normalScale: 1.2 });
        m.color.multiplyScalar(2.1); // a textura é bem escura: ganho > 1 para a viga ler como carvalho velho
        return m;
    }),
    planks: () => mat('planks', () => {
        const m = pbrMaterial('weathered_brown_planks', { color: 0xd9c8ae, normalScale: 1.1 });
        m.color.multiplyScalar(1.9);
        return m;
    }),
    oak: () => mat('oak', () => pbrMaterial('oak_wood_planks', { color: 0xcaa67a })),
    thatch: () => mat('thatch', () => {
        const m = pbrMaterial('thatch_roof_angled', { color: 0xf0dca8, normalScale: 1.5 });
        m.color.multiplyScalar(1.5);
        return m;
    }),
    fieldstone: () => mat('fieldstone', () => pbrMaterial('mossy_cobblestone', { color: 0xd8d2c6, normalScale: 1.4 })),
    cobble: () => mat('cobble', () => pbrMaterial('cobblestone_floor_08', { color: 0xd6cfc2, normalScale: 1.2 })),
    blocks: () => mat('blocks', () => pbrMaterial('medieval_blocks_02', { color: 0xe6e0d6, normalScale: 1.3 })),
    slates: () => mat('slates', () => pbrMaterial('castle_wall_slates', { color: 0xd9d4cc, normalScale: 1.2 })),
    roofSlate: () => mat('roofSlate', () => pbrMaterial('roof_slates_02', { color: 0x9aa4b4, normalScale: 1.3 })),
    floorSlate: () => mat('floorSlate', () => pbrMaterial('slate_floor_02', { color: 0xcfc8be, normalScale: 1.1, roughness: 0.9 })),
    iron: () => mat('iron', () => pbrMaterial('rusty_metal_02', { color: 0x6a625c, metal: true, roughness: 0.9 })),
    cloth: (color) => mat(`cloth:${color}`, () => pbrMaterial('fabric_pattern_07', {
        color, normalScale: 0.8, side: THREE.DoubleSide, repeat: 2
    })),
    burlap: () => mat('burlap', () => pbrMaterial('fabric_pattern_07', { color: 0xb89c6a, normalScale: 1.6, repeat: 3 })),
    rope: () => mat('rope', () => new THREE.MeshStandardMaterial({ color: 0xa88c5c, roughness: 0.95 })),
    /* Ouro polido: metal 1, rugosidade baixa — o reflexo vem do IBL do palco. */
    gold: () => mat('gold', () => new THREE.MeshStandardMaterial({
        color: 0xffc64a, metalness: 1, roughness: 0.24, envMapIntensity: 1.6
    })),
    goldSoft: () => mat('goldSoft', () => new THREE.MeshStandardMaterial({
        color: 0xf2b23a, metalness: 1, roughness: 0.42, envMapIntensity: 1.3
    })),
    water: () => mat('water', () => new THREE.MeshStandardMaterial({
        color: 0x2f5a62, roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.86
    })),
    /* Vidro da janela: escuro de dia, âmbar aceso à noite (emissiveIntensity). */
    windowGlow: () => mat('windowGlow', () => new THREE.MeshStandardMaterial({
        color: 0x0e0b08, roughness: 0.3, emissive: 0xffb45a, emissiveIntensity: 0
    })),
    ember: () => mat('ember', () => new THREE.MeshStandardMaterial({
        color: 0x1a0f08, roughness: 0.9, emissive: 0xff5a14, emissiveIntensity: 2.4
    })),
    flame: () => mat('flame', () => new THREE.MeshBasicMaterial({ color: 0xffc070 }))
};

/* ------------------------------------------------------------------ */
/* Ajudantes de geometria                                              */
/* ------------------------------------------------------------------ */

/** Aplica TRS e devolve a geometria (encadeável). */
function xf(geo, px = 0, py = 0, pz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _e.set(rx, ry, rz);
    _m.compose(_p.set(px, py, pz), _q.setFromEuler(_e), _s.set(sx, sy, sz));
    geo.applyMatrix4(_m);
    return geo;
}

/** Funde geometrias (indexadas ou não) e projeta UV em metros / `uvScale`. */
function fuse(list, uvScale = 1) {
    const flat = list.map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        for (const k of Object.keys(n.attributes)) {
            if (k !== 'position' && k !== 'normal' && k !== 'uv') n.deleteAttribute(k);
        }
        if (!n.attributes.normal) n.computeVertexNormals();
        if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
        return n;
    });
    const g = mergeGeometries(flat, false);
    if (uvScale) applyWorldUV(g, uvScale);
    return g;
}

function mesh(geo, material, { cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

/**
 * Viga chanfrada: seção retangular w×h com cantos cortados (chanfro `c`),
 * extrudada ao longo de +Z por `len`, centrada na seção e no comprimento.
 */
function beam(w, h, len, c = Math.min(w, h) * 0.14) {
    const s = new THREE.Shape();
    const x = w / 2;
    const y = h / 2;
    s.moveTo(-x + c, -y);
    s.lineTo(x - c, -y);
    s.lineTo(x, -y + c);
    s.lineTo(x, y - c);
    s.lineTo(x - c, y);
    s.lineTo(-x + c, y);
    s.lineTo(-x, y - c);
    s.lineTo(-x, -y + c);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, steps: 1 });
    g.translate(0, 0, -len / 2);
    return g;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
/** Viga entre dois pontos (o eixo Z da viga é girado para a direção a→b). */
function beamBetween(a, b, w, h) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    const g = beam(w, h, len);
    _m.makeRotationFromQuaternion(_q.setFromUnitVectors(Z_AXIS, d.divideScalar(len || 1)));
    g.applyMatrix4(_m);
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    return g;
}

/**
 * Parede com espessura e vãos recortados. Elevação no plano XY (x ∈ [−w/2, w/2],
 * y ∈ [0, h]), espessura `t` centrada em Z. `gable` > 0 acrescenta a empena
 * (triângulo até h + gable). Vãos: { x, y, w, h, arch } (y = base do vão;
 * `arch` = raio do arco pleno no topo).
 */
function wall(w, h, t, holes = [], gable = 0) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(w / 2, h);
    if (gable > 0) s.lineTo(0, h + gable);
    s.lineTo(-w / 2, h);
    s.closePath();
    for (const o of holes) {
        const p = new THREE.Path();
        const x0 = o.x - o.w / 2;
        const x1 = o.x + o.w / 2;
        p.moveTo(x0, o.y);
        if (o.arch) {
            p.lineTo(x0, o.y + o.h - o.w / 2);
            p.absarc(o.x, o.y + o.h - o.w / 2, o.w / 2, Math.PI, 0, true);
            p.lineTo(x1, o.y);
        } else {
            p.lineTo(x0, o.y + o.h);
            p.lineTo(x1, o.y + o.h);
            p.lineTo(x1, o.y);
        }
        p.closePath();
        s.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -t / 2);
    return g;
}

/**
 * Desloca vértices por ruído função só da posição (vértices coincidentes
 * recebem o mesmo deslocamento → sem frestas em arestas vivas):
 *   p += amp · (n(p.yz), n(p.zx), n(p.xy)) − ½
 */
function roughen(geo, amp = 0.04, freq = 1.7, seed = 0) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        pos.setXYZ(
            i,
            x + (fbm2(y * freq + seed, z * freq - seed, 2) - 0.5) * 2 * amp,
            y + (fbm2(z * freq + 7 + seed, x * freq + 3, 2) - 0.5) * 2 * amp,
            z + (fbm2(x * freq - 5, y * freq + 11 + seed, 2) - 0.5) * 2 * amp
        );
    }
    geo.computeVertexNormals();
    return geo;
}

/** Sólido de revolução a partir de um perfil [[raio, y], …]. */
function lathe(profile, segs = 20) {
    return new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), segs);
}

/** Tubo ao longo de pontos (Catmull-Rom). */
function tube(points, radius, segs = 24, radial = 8, closed = false) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))), closed);
    return new THREE.TubeGeometry(curve, segs, radius, radial, closed);
}

/* ------------------------------------------------------------------ */
/* Cabana do João                                                       */
/* ------------------------------------------------------------------ */

export const COTTAGE = { w: 6.8, d: 4.8, h: 2.45, rise: 2.35, t: 0.3, doorX: 0.95 };

/**
 * Cabana de camponês: soco de pedra, paredes de reboco com enxaimel, porta e
 * janelas recortadas, telhado de palha com beiral e cumeeira, chaminé de pedra.
 * @returns {THREE.Group} userData: { chimneyTop: Vector3 (local), half: [hx, hz], glow: material }
 */
export function buildCottage() {
    const { w, d, h, rise, t, doorX } = COTTAGE;
    const g = new THREE.Group();
    g.name = 'cabana';
    const base = 0.35; // topo do soco de pedra

    // --- soco de pedra (desce 0,7 m para cobrir desnível do terreno)
    const plinth = roughen(new THREE.BoxGeometry(w + 0.36, 1.05, d + 0.36, 14, 3, 10), 0.035, 2.3, 4);
    plinth.translate(0, base - 0.525, 0);
    const step = roughen(new THREE.BoxGeometry(1.5, 0.3, 0.7, 5, 1, 3), 0.03, 3, 9);
    step.translate(doorX, 0.1, d / 2 + 0.5);

    // --- paredes de reboco
    const front = wall(w, h, t, [
        { x: doorX, y: 0, w: 1.02, h: 1.95 },
        { x: -1.75, y: 0.95, w: 0.95, h: 0.95 }
    ]);
    xf(front, 0, base, d / 2 - t / 2);
    const back = wall(w, h, t, [{ x: 1.3, y: 0.95, w: 0.95, h: 0.95 }]);
    xf(back, 0, base, -d / 2 + t / 2, 0, Math.PI, 0);
    const sideR = wall(d - t * 2, h, t, [{ x: 0, y: 1.0, w: 0.8, h: 0.85 }], rise * ((d - t * 2) / d));
    xf(sideR, w / 2 - t / 2, base, 0, 0, Math.PI / 2, 0);
    const sideL = wall(d - t * 2, h, t, [], rise * ((d - t * 2) / d));
    xf(sideL, -w / 2 + t / 2, base, 0, 0, -Math.PI / 2, 0);
    g.add(mesh(fuse([front, back, sideR, sideL], 2.2), MAT.plaster()));

    // --- enxaimel: frechal, baldrame, esteios, travessas, mãos-francesas
    const tim = [];
    const zf = d / 2 + 0.02;
    const zb = -d / 2 - 0.02;
    const bw = 0.17;
    const addH = (x0, x1, y, z, hh = bw) => tim.push(xf(beam(0.12, hh, Math.abs(x1 - x0)), (x0 + x1) / 2, y, z, 0, Math.PI / 2, 0));
    const addV = (x, y0, y1, z, ww = bw) => tim.push(xf(beam(ww, 0.12, y1 - y0), x, (y0 + y1) / 2, z, Math.PI / 2, 0, 0));
    for (const z of [zf, zb]) {
        addH(-w / 2, w / 2, base + 0.09, z);
        addH(-w / 2 - 0.25, w / 2 + 0.25, base + h - 0.09, z, 0.2);
        for (const x of [-w / 2 + 0.09, w / 2 - 0.09]) addV(x, base, base + h, z, 0.2);
    }
    // frente: esteios de porta/janela e travessa do meio
    addV(doorX - 0.62, base, base + h, zf);
    addV(doorX + 0.62, base, base + h, zf);
    addH(doorX - 0.62, doorX + 0.62, base + 2.04, zf);
    addV(-1.75 - 0.58, base, base + h, zf);
    addV(-1.75 + 0.58, base, base + h, zf);
    addH(-1.75 - 0.58, -1.75 + 0.58, base + 0.86, zf, 0.14);
    addH(-1.75 - 0.58, -1.75 + 0.58, base + 1.99, zf, 0.14);
    addH(-w / 2, -1.75 - 0.58, base + 1.25, zf, 0.13);
    addH(-1.75 + 0.58, doorX - 0.62, base + 1.25, zf, 0.13);
    addH(doorX + 0.62, w / 2, base + 1.25, zf, 0.13);
    tim.push(beamBetween(new THREE.Vector3(doorX + 0.7, base + 0.2, zf), new THREE.Vector3(w / 2 - 0.15, base + 1.2, zf), 0.12, 0.13));
    // fundos
    addV(1.3 - 0.58, base, base + h, zb);
    addV(1.3 + 0.58, base, base + h, zb);
    addH(1.3 - 0.58, 1.3 + 0.58, base + 0.86, zb, 0.14);
    addH(1.3 - 0.58, 1.3 + 0.58, base + 1.99, zb, 0.14);
    addH(-w / 2, 1.3 - 0.58, base + 1.25, zb, 0.13);
    addV(-1.2, base, base + h, zb);
    // laterais: esteios, travessa e tesoura da empena
    for (const sx of [-1, 1]) {
        const x = sx * (w / 2 + 0.02);
        const addZ = (z0, z1, y, hh = bw) => tim.push(xf(beam(0.12, hh, Math.abs(z1 - z0)), x, y, (z0 + z1) / 2));
        const addVz = (z, y0, y1) => tim.push(xf(beam(0.12, bw, y1 - y0), x, (y0 + y1) / 2, z, Math.PI / 2, 0, 0));
        addZ(-d / 2, d / 2, base + 0.09);
        addZ(-d / 2, d / 2, base + h - 0.09, 0.2);
        addZ(-d / 2, d / 2, base + 1.25, 0.13);
        addVz(-d / 2 + 0.09, base, base + h);
        addVz(d / 2 - 0.09, base, base + h);
        addVz(0, base + h, base + h + rise - 0.25);
        if (sx > 0) {
            addVz(-0.5, base, base + h);
            addVz(0.5, base, base + h);
        } else addVz(0.9, base, base + h);
        tim.push(beamBetween(new THREE.Vector3(x, base + h + 0.05, -d / 2 + 0.2), new THREE.Vector3(x, base + h + rise - 0.2, 0), 0.12, 0.16));
        tim.push(beamBetween(new THREE.Vector3(x, base + h + 0.05, d / 2 - 0.2), new THREE.Vector3(x, base + h + rise - 0.2, 0), 0.12, 0.16));
    }
    // caibros aparentes sob o beiral
    for (let i = 0; i <= 8; i++) {
        const x = -w / 2 - 0.3 + (i / 8) * (w + 0.6);
        for (const sz of [-1, 1]) {
            tim.push(beamBetween(
                new THREE.Vector3(x, base + h + rise - 0.14, 0),
                new THREE.Vector3(x, base + h - 0.34, sz * (d / 2 + 0.52)), 0.09, 0.11
            ));
        }
    }
    // caixilhos das janelas (montante + travessa) e folhas (venezianas de tábua)
    const frame = (cx, cy, ww, hh, z, ry) => {
        const parts = [
            xf(beam(0.07, 0.05, hh), 0, cy, 0, Math.PI / 2, 0, 0),
            xf(beam(0.05, 0.07, ww), 0, cy, 0, 0, Math.PI / 2, 0)
        ];
        for (const p of parts) tim.push(xf(p, 0, 0, 0, 0, ry, 0).translate(cx, 0, z));
    };
    frame(-1.75, base + 1.425, 0.95, 0.95, d / 2 - 0.1, 0);
    frame(1.3, base + 1.425, 0.95, 0.95, -d / 2 + 0.1, 0);
    tim.push(xf(beam(0.07, 0.05, 0.85), w / 2 - 0.1, base + 1.425, 0, Math.PI / 2, 0, 0));
    tim.push(xf(beam(0.05, 0.07, 0.8), w / 2 - 0.1, base + 1.425, 0));
    g.add(mesh(fuse(tim, 1.1), MAT.timber()));

    // --- telhado de palha: duas águas grossas com beiral irregular + cumeeira
    const thatch = [];
    const run = d / 2 + 0.62;
    const slopeLen = Math.hypot(run, rise * (run / (d / 2)));
    const ang = Math.atan2(rise, d / 2);
    const roofLen = w + 1.1;
    for (const sz of [-1, 1]) {
        const slab = new THREE.BoxGeometry(roofLen, 0.34, slopeLen, 26, 2, 12);
        const pos = slab.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const edge = z / (slopeLen / 2); // +1 no beiral
            // beiral desfiado e leve barriga da palha
            const rag = edge > 0.92 ? (fbm2(x * 2.6 + sz * 9, 3.1, 2) - 0.5) * 0.22 : 0;
            const belly = Math.sin((edge * 0.5 + 0.5) * Math.PI) * 0.05;
            const side = Math.abs(x) > roofLen / 2 - 0.05 ? (fbm2(z * 2.2, x, 2) - 0.5) * 0.16 : 0;
            pos.setXYZ(i, x + side, pos.getY(i) + belly * (pos.getY(i) > 0 ? 1 : 0) + (fbm2(x * 1.3, z * 1.3 + sz * 5, 2) - 0.5) * 0.05, z + rag);
        }
        slab.computeVertexNormals();
        // z local +: desce a água; gira para a inclinação e leva até a cumeeira
        xf(slab, 0, 0, slopeLen / 2 - 0.12, 0, 0, 0);
        xf(slab, 0, base + h + rise + 0.2, 0, ang, 0, 0);
        if (sz < 0) xf(slab, 0, 0, 0, 0, Math.PI, 0);
        thatch.push(slab);
    }
    const ridge = new THREE.CylinderGeometry(0.3, 0.3, roofLen + 0.1, 12, 18, false);
    roughen(ridge, 0.04, 2.4, 2);
    xf(ridge, 0, base + h + rise + 0.2, 0, 0, 0, Math.PI / 2, 1, 1, 1.25);
    thatch.push(ridge);
    g.add(mesh(fuse(thatch, 1.6), MAT.thatch()));

    // --- chaminé de pedra encostada na empena esquerda
    const chim = [];
    const cx = -w / 2 - 0.36;
    const stack = roughen(new THREE.BoxGeometry(1.25, 3.3, 1.5, 5, 10, 6), 0.045, 2.1, 6);
    stack.translate(cx, 1.35, -0.3);
    const neck = roughen(new THREE.BoxGeometry(0.82, 2.9, 0.9, 4, 8, 4), 0.035, 2.4, 3);
    neck.translate(cx + 0.12, 4.3, -0.3);
    const cap = roughen(new THREE.BoxGeometry(1.04, 0.2, 1.12, 4, 1, 4), 0.02, 3, 1);
    cap.translate(cx + 0.12, 5.82, -0.3);
    chim.push(plinth, step, stack, neck, cap);
    g.add(mesh(fuse(chim, 1.5), MAT.fieldstone()));

    // --- porta de tábuas entreaberta (dobradiça na ombreira esquerda)
    const door = new THREE.Group();
    const leaf = [];
    for (let i = 0; i < 5; i++) leaf.push(xf(beam(0.19, 0.055, 1.9, 0.012), 0.1 + i * 0.196, 0.95, 0, Math.PI / 2, 0, 0));
    leaf.push(xf(beam(0.1, 0.03, 0.92), 0.5, 0.42, 0.04, 0, Math.PI / 2, 0));
    leaf.push(xf(beam(0.1, 0.03, 0.92), 0.5, 1.5, 0.04, 0, Math.PI / 2, 0));
    door.add(mesh(fuse(leaf, 0.9), MAT.oak()));
    const hw = [
        xf(new THREE.TorusGeometry(0.06, 0.012, 6, 14), 0.86, 1.0, 0.07),
        xf(new THREE.BoxGeometry(0.42, 0.045, 0.012), 0.21, 0.42, 0.062),
        xf(new THREE.BoxGeometry(0.42, 0.045, 0.012), 0.21, 1.5, 0.062)
    ];
    door.add(mesh(fuse(hw, 0.4), MAT.iron()));
    door.position.set(doorX - 0.5, base, d / 2 - 0.2);
    door.rotation.y = -0.42;
    g.add(door);

    // venezianas abertas, rentes à parede
    const shut = [];
    const shutter = (cx2, z, flip) => {
        for (const sx of [-1, 1]) {
            for (let i = 0; i < 3; i++) {
                shut.push(xf(beam(0.15, 0.03, 0.95, 0.008), cx2 + sx * (0.56 + 0.08 + i * 0.155), base + 1.425, z + flip * 0.03, Math.PI / 2, 0, 0));
            }
            shut.push(xf(beam(0.05, 0.02, 0.44), cx2 + sx * (0.56 + 0.235), base + 1.7, z + flip * 0.055, 0, Math.PI / 2, 0));
            shut.push(xf(beam(0.05, 0.02, 0.44), cx2 + sx * (0.56 + 0.235), base + 1.15, z + flip * 0.055, 0, Math.PI / 2, 0));
        }
    };
    shutter(-1.75, d / 2 + 0.03, 1);
    shutter(1.3, -d / 2 - 0.03, -1);
    g.add(mesh(fuse(shut, 0.8), MAT.planks()));

    // --- "vidro": plano âmbar atrás dos caixilhos + fundo escuro do interior
    const glow = [
        xf(new THREE.PlaneGeometry(0.95, 0.95), -1.75, base + 1.425, d / 2 - 0.16),
        xf(new THREE.PlaneGeometry(0.95, 0.95), 1.3, base + 1.425, -d / 2 + 0.16, 0, Math.PI, 0),
        xf(new THREE.PlaneGeometry(0.8, 0.85), w / 2 - 0.16, base + 1.425, 0, 0, Math.PI / 2, 0),
        xf(new THREE.PlaneGeometry(1.0, 1.95), doorX, base + 0.975, d / 2 - 0.5)
    ];
    const glass = mesh(fuse(glow, 0), MAT.windowGlow(), { cast: false, receive: false });
    g.add(glass);

    g.userData.chimneyTop = new THREE.Vector3(cx + 0.12, 5.95, -0.3);
    g.userData.half = [w / 2 + 0.55, d / 2 + 0.3];
    g.userData.glow = MAT.windowGlow();
    return g;
}

/* ------------------------------------------------------------------ */
/* Poço de pedra                                                        */
/* ------------------------------------------------------------------ */

/** Poço: anel de pedra irregular, cobertura de palha em duas águas, sarilho e corda. O balde (glTF) entra depois. */
export function buildWell() {
    const g = new THREE.Group();
    g.name = 'poco';
    const ring = lathe([[0.62, 0], [0.98, 0], [1.0, 0.25], [0.95, 0.82], [0.98, 0.9], [0.66, 0.92], [0.62, 0.8], [0.62, 0]], 22);
    roughen(ring, 0.04, 2.6, 5);
    const flag = roughen(new THREE.CylinderGeometry(1.45, 1.55, 0.1, 18, 1), 0.03, 2, 2);
    flag.translate(0, 0.02, 0);
    g.add(mesh(fuse([ring, flag], 1.2), MAT.fieldstone()));

    const wood = [];
    for (const sx of [-1, 1]) {
        wood.push(xf(beam(0.15, 0.15, 2.5), sx * 0.9, 1.25, 0, Math.PI / 2, 0, 0));
        wood.push(beamBetween(new THREE.Vector3(sx * 0.9, 2.45, 0), new THREE.Vector3(sx * 0.9, 2.02, 0.72), 0.1, 0.1));
        wood.push(beamBetween(new THREE.Vector3(sx * 0.9, 2.45, 0), new THREE.Vector3(sx * 0.9, 2.02, -0.72), 0.1, 0.1));
    }
    wood.push(xf(beam(0.13, 0.13, 2.1), 0, 2.5, 0, 0, Math.PI / 2, 0));
    // sarilho (eixo torneado) + manivela
    const axle = lathe([[0.03, -0.95], [0.05, -0.9], [0.11, -0.7], [0.11, 0.7], [0.05, 0.9], [0.03, 0.98]], 12);
    wood.push(xf(axle, 0, 1.62, 0, 0, 0, Math.PI / 2));
    wood.push(xf(beam(0.05, 0.05, 0.36), 1.02, 1.46, 0, Math.PI / 2, 0, 0));
    wood.push(xf(beam(0.05, 0.05, 0.22), 1.12, 1.3, 0, 0, Math.PI / 2, 0));
    g.add(mesh(fuse(wood, 0.9), MAT.timber()));

    const roof = [];
    for (const sz of [-1, 1]) {
        const slab = new THREE.BoxGeometry(2.5, 0.16, 1.05, 10, 1, 5);
        roughen(slab, 0.03, 3, sz + 3);
        xf(slab, 0, 0, 0.5, 0, 0, 0);
        xf(slab, 0, 2.62, 0, 0.56, 0, 0);
        if (sz < 0) xf(slab, 0, 0, 0, 0, Math.PI, 0);
        roof.push(slab);
    }
    g.add(mesh(fuse(roof, 1.2), MAT.thatch()));

    // corda enrolada no sarilho e descendo ao balde
    const rope = [];
    for (let i = 0; i < 5; i++) rope.push(xf(new THREE.TorusGeometry(0.125, 0.018, 6, 16), -0.2 + i * 0.045, 1.62, 0, 0, Math.PI / 2, 0));
    rope.push(tube([[0, 1.5, 0.12], [0.02, 1.25, 0.2], [0.05, 1.02, 0.42], [0.1, 0.96, 0.62]], 0.016, 10, 6));
    g.add(mesh(fuse(rope, 0), MAT.rope()));

    const water = mesh(xf(new THREE.CircleGeometry(0.62, 20), 0, 0.42, 0, -Math.PI / 2, 0, 0), MAT.water(), { cast: false });
    g.add(water);
    return g;
}

/* ------------------------------------------------------------------ */
/* Arco da estrada da feira                                             */
/* ------------------------------------------------------------------ */

function signTexture(text) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#a07a4c';
    x.fillRect(0, 0, 512, 160);
    for (let i = 0; i < 60; i++) {
        x.fillStyle = `rgba(${40 + Math.random() * 40}, ${24 + Math.random() * 20}, 10, ${0.08 + Math.random() * 0.1})`;
        x.fillRect(0, Math.random() * 160, 512, 1 + Math.random() * 3);
    }
    x.font = '700 96px "Fraunces", Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#2a170a';
    x.fillText(text, 256, 86);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

/** Pórtico de madeira com placa "FEIRA" pendurada por correntes de corda. */
export function buildGateArch() {
    const g = new THREE.Group();
    g.name = 'arcoFeira';
    const span = 2.4;
    const wood = [];
    for (const sx of [-1, 1]) {
        const post = roughen(xf(beam(0.3, 0.3, 3.9, 0.05), sx * span, 1.75, 0, Math.PI / 2, 0, 0), 0.012, 3, sx);
        wood.push(post);
        wood.push(beamBetween(new THREE.Vector3(sx * span, 2.5, 0), new THREE.Vector3(sx * (span - 0.95), 3.42, 0), 0.14, 0.14));
        wood.push(xf(roughen(new THREE.CylinderGeometry(0.34, 0.4, 0.4, 10, 2), 0.03, 3, 2), sx * span, 0.12, 0));
    }
    // travessa levemente arqueada
    const top = [];
    for (let i = 0; i <= 12; i++) {
        const u = i / 12;
        top.push(new THREE.Vector3((u - 0.5) * (span * 2 + 1.1), 3.52 + Math.sin(u * Math.PI) * 0.24, 0));
    }
    const arc = tube(top, 0.17, 24, 8);
    arc.scale(1, 1, 0.8);
    wood.push(arc);
    g.add(mesh(fuse(wood, 1.0), MAT.timber()));

    const sign = new THREE.Mesh(
        xf(new THREE.BoxGeometry(2.3, 0.72, 0.07), 0, 2.78, 0),
        new THREE.MeshStandardMaterial({ map: signTexture('FEIRA'), roughness: 0.85 })
    );
    sign.castShadow = true;
    g.add(sign);
    const rope = [];
    for (const sx of [-1, 1]) rope.push(tube([[sx * 0.95, 3.6, 0], [sx * 0.96, 3.3, 0], [sx * 0.95, 3.12, 0]], 0.02, 4, 6));
    g.add(mesh(fuse(rope, 0), MAT.rope()));
    return g;
}

/* ------------------------------------------------------------------ */
/* Poste de lampião da estrada                                          */
/* ------------------------------------------------------------------ */

/** Poste torto com braço; a lanterna (glTF) é pendurada em userData.hook (posição local). */
export function buildLampPost(seed = 1) {
    const rnd = seeded(seed * 17 + 3);
    const g = new THREE.Group();
    const lean = (rnd() - 0.5) * 0.12;
    const post = tube([[0, -0.3, 0], [lean * 0.4, 0.8, 0], [lean, 1.7, 0.01], [lean * 1.2, 2.35, 0]], 0.065, 10, 7);
    const arm = tube([[lean * 1.2, 2.2, 0], [lean * 1.2 + 0.25, 2.34, 0], [lean * 1.2 + 0.5, 2.3, 0]], 0.035, 6, 6);
    g.add(mesh(fuse([post, arm], 0.6), MAT.timber()));
    g.userData.hook = new THREE.Vector3(lean * 1.2 + 0.48, 2.27, 0);
    return g;
}

/* ------------------------------------------------------------------ */
/* Barraca de feira                                                     */
/* ------------------------------------------------------------------ */

/**
 * Barraca: bancada de tábuas sobre cavaletes, quatro esteios e toldo de lona
 * com barriga e barra em bicos. `props` lista onde ficam os produtos (locais).
 * @returns {THREE.Group} userData.props = [{ model, x, y, z, ry, s }]
 */
export function buildStall(color = 0xc43a2a, seed = 1) {
    const rnd = seeded(seed * 29 + 1);
    const g = new THREE.Group();
    g.name = 'barraca';
    const W = 2.8;
    const D = 1.5;
    const wood = [];
    for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
            const hh = sz < 0 ? 2.5 : 2.15;
            wood.push(xf(roughen(beam(0.1, 0.1, hh + 0.2), 0.006, 4, sx + sz), sx * (W / 2), hh / 2 - 0.1, sz * (D / 2), Math.PI / 2, 0, 0));
        }
        wood.push(beamBetween(new THREE.Vector3(sx * (W / 2), 2.44, -D / 2), new THREE.Vector3(sx * (W / 2), 2.1, D / 2), 0.07, 0.07));
        // cavalete
        wood.push(beamBetween(new THREE.Vector3(sx * (W / 2 - 0.3), 0, -D / 2 + 0.2), new THREE.Vector3(sx * (W / 2 - 0.3), 0.86, 0), 0.07, 0.07));
        wood.push(beamBetween(new THREE.Vector3(sx * (W / 2 - 0.3), 0, D / 2 - 0.2), new THREE.Vector3(sx * (W / 2 - 0.3), 0.86, 0), 0.07, 0.07));
    }
    wood.push(xf(beam(0.07, 0.07, W), 0, 2.46, -D / 2, 0, Math.PI / 2, 0));
    wood.push(xf(beam(0.07, 0.07, W), 0, 2.12, D / 2, 0, Math.PI / 2, 0));
    g.add(mesh(fuse(wood, 0.8), MAT.timber()));

    const top = [];
    for (let i = 0; i < 5; i++) top.push(xf(beam(0.28, 0.05, W + 0.3, 0.01), 0, 0.9, -0.58 + i * 0.29, 0, Math.PI / 2, 0));
    g.add(mesh(fuse(top, 0.9), MAT.planks()));

    // toldo: grade 14×8 com barriga (parábola nos dois eixos) e barra em bicos na frente
    const cloth = new THREE.PlaneGeometry(W + 0.5, D + 0.7, 14, 8);
    const pos = cloth.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) / (W + 0.5) + 0.5;
        const v = pos.getY(i) / (D + 0.7) + 0.5; // 0 = frente
        const sag = Math.sin(u * Math.PI) * Math.sin(v * Math.PI) * 0.14;
        let y = 2.16 + v * 0.36 - sag;
        let z = (0.5 - v) * (D + 0.7);
        if (v < 0.01) {
            y -= 0.2 + Math.abs(Math.sin(u * Math.PI * 7)) * 0.16;
            z += 0.03;
        }
        pos.setXYZ(i, pos.getX(i), y, z);
    }
    cloth.computeVertexNormals();
    g.add(mesh(cloth, MAT.cloth(color)));

    const y = 0.93;
    g.userData.props = [
        { model: 'wooden_crate_01', x: -0.75, y, z: -0.1, ry: 0.2 + rnd() * 0.4, s: 0.9 },
        { model: 'wicker_basket_01', x: 0.25, y, z: 0.12, ry: rnd() * 3, s: 1.5 },
        { model: 'wine_barrel_01', x: W / 2 + 0.55, y: 0, z: 0.2 + rnd() * 0.3, ry: rnd() * 3, s: 0.95 },
        { model: 'wooden_crate_01', x: -W / 2 - 0.45, y: 0, z: -0.3, ry: rnd() * 3, s: 1.15 }
    ];
    // maçãs dentro dos cestos e sobre a bancada
    for (let i = 0; i < 4; i++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * 0.16;
        const bx = 0.25;
        const bz = 0.12;
        g.userData.props.push({ model: 'food_apple_01', x: bx + Math.cos(a) * r, y: y + 0.1 + rnd() * 0.05, z: bz + Math.sin(a) * r * 0.8, ry: a, s: 1.25 });
    }
    return g;
}

/* ------------------------------------------------------------------ */
/* Carroça do mercador                                                  */
/* ------------------------------------------------------------------ */

function wheel(R = 0.62) {
    const parts = [];
    const rim = new THREE.TorusGeometry(R, 0.055, 8, 28);
    rim.scale(1, 1, 1.5);
    parts.push(rim);
    parts.push(xf(lathe([[0, -0.13], [0.07, -0.13], [0.12, -0.06], [0.12, 0.06], [0.07, 0.13], [0, 0.13]], 12), 0, 0, 0, Math.PI / 2, 0, 0));
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        parts.push(xf(beam(0.05, 0.035, R - 0.1, 0.008), Math.cos(a) * (R / 2 + 0.03), Math.sin(a) * (R / 2 + 0.03), 0, Math.PI / 2, 0, a - Math.PI / 2));
    }
    return parts;
}

/** Carroça de duas rodas com varais, caixa de tábuas e toldo violeta em arcos (a carga glTF entra depois). */
export function buildCart(color = 0x7a3aaa) {
    const g = new THREE.Group();
    g.name = 'carroca';
    const wood = [];
    const L = 2.6;
    const Wd = 1.4;
    for (let i = 0; i < 5; i++) wood.push(xf(beam(0.27, 0.05, L, 0.01), -0.56 + i * 0.28, 0.82, 0));
    for (const sx of [-1, 1]) {
        for (let i = 0; i < 2; i++) wood.push(xf(beam(0.04, 0.2, L, 0.01), sx * (Wd / 2), 0.98 + i * 0.22, 0));
        for (const z of [-L / 2 + 0.08, 0, L / 2 - 0.08]) wood.push(xf(beam(0.07, 0.07, 0.62), sx * (Wd / 2 + 0.03), 1.08, z, Math.PI / 2, 0, 0));
        // varal
        wood.push(tube([[sx * 0.5, 0.78, L / 2], [sx * 0.5, 0.72, L / 2 + 0.9], [sx * 0.46, 0.5, L / 2 + 1.7], [sx * 0.44, 0.22, L / 2 + 2.2]], 0.045, 10, 7));
        for (const p of wheel()) wood.push(xf(p, sx * (Wd / 2 + 0.2), 0.62, -0.15, 0, Math.PI / 2, 0));
    }
    for (const z of [-L / 2, L / 2]) {
        for (let i = 0; i < 2; i++) wood.push(xf(beam(0.04, 0.2, Wd, 0.01), 0, 0.98 + i * 0.22, z, 0, Math.PI / 2, 0));
    }
    wood.push(xf(lathe([[0, -0.86], [0.05, -0.86], [0.05, 0.86], [0, 0.86]], 8), 0, 0.62, -0.15, 0, 0, Math.PI / 2));
    wood.push(xf(beam(0.08, 0.08, 0.7), 0, 0.36, L / 2 - 0.3, Math.PI / 2, 0, 0));
    g.add(mesh(fuse(wood, 0.9), MAT.planks()));

    // toldo em túnel sobre três arcos
    const hoops = [];
    for (const z of [-L / 2 + 0.1, 0, L / 2 - 0.1]) {
        const pts = [];
        for (let i = 0; i <= 10; i++) {
            const a = (i / 10) * Math.PI;
            pts.push(new THREE.Vector3(Math.cos(a) * (Wd / 2), 1.2 + Math.sin(a) * 0.95, z));
        }
        hoops.push(tube(pts, 0.03, 14, 6));
    }
    g.add(mesh(fuse(hoops, 0.6), MAT.timber()));
    const cloth = new THREE.PlaneGeometry(1, 1, 16, 8);
    const pos = cloth.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) + 0.5;
        const v = pos.getY(i) + 0.5;
        const a = u * Math.PI;
        const sag = 1 - Math.abs(Math.sin(v * Math.PI * 2)) * 0.05;
        pos.setXYZ(i, Math.cos(a) * (Wd / 2 + 0.04) * sag, 1.2 + Math.sin(a) * 0.99 * sag - (u < 0.03 || u > 0.97 ? 0.12 : 0), (v - 0.5) * (L + 0.25));
    }
    cloth.computeVertexNormals();
    g.add(mesh(cloth, MAT.cloth(color)));
    return g;
}

/* ------------------------------------------------------------------ */
/* Chafariz da praça                                                    */
/* ------------------------------------------------------------------ */

export function buildFountain() {
    const g = new THREE.Group();
    g.name = 'chafariz';
    const basin = lathe([[1.15, 0], [1.72, 0], [1.76, 0.12], [1.66, 0.2], [1.7, 0.62], [1.78, 0.7], [1.74, 0.78], [1.42, 0.78], [1.38, 0.3], [0, 0.26]], 28);
    roughen(basin, 0.022, 2.4, 8);
    const pillar = lathe([[0.4, 0.2], [0.34, 0.5], [0.2, 0.7], [0.17, 1.3], [0.26, 1.42], [0.62, 1.5], [0.7, 1.6], [0.66, 1.66], [0.2, 1.62], [0.14, 1.8], [0.2, 1.98], [0.1, 2.12], [0, 2.14]], 20);
    roughen(pillar, 0.012, 3, 1);
    g.add(mesh(fuse([basin, pillar], 1.3), MAT.cobble()));
    const water = mesh(xf(new THREE.CircleGeometry(1.4, 28), 0, 0.62, 0, -Math.PI / 2, 0, 0), MAT.water(), { cast: false });
    const bowl = mesh(xf(new THREE.CircleGeometry(0.62, 20), 0, 1.6, 0, -Math.PI / 2, 0, 0), MAT.water(), { cast: false });
    g.add(water, bowl);
    return g;
}

/* ------------------------------------------------------------------ */
/* Horta e lenha                                                        */
/* ------------------------------------------------------------------ */

/** Pilha de lenha rachada (toras em meia-cana empilhadas) — fica ao lado do toco do machado. */
export function buildWoodpile(seed = 3) {
    const rnd = seeded(seed * 41);
    const logs = [];
    for (let row = 0; row < 4; row++) {
        const n = 6 - row;
        for (let i = 0; i < n; i++) {
            const r = 0.1 + rnd() * 0.035;
            const log = new THREE.CylinderGeometry(r, r * (0.9 + rnd() * 0.1), 0.95 + rnd() * 0.12, 9, 3, false, 0, Math.PI * (1.1 + rnd() * 0.9));
            roughen(log, 0.01, 6, i + row);
            logs.push(xf(log, (i - (n - 1) / 2) * 0.235 + (rnd() - 0.5) * 0.03, 0.11 + row * 0.19, (rnd() - 0.5) * 0.08, Math.PI / 2, 0, rnd() * 6));
        }
    }
    const m = mat('firewood', () => {
        const mm = pbrMaterial('bark_brown_02', { color: 0xc9b08c, normalScale: 1.2 });
        mm.color.multiplyScalar(1.8);
        return mm;
    });
    const g = new THREE.Group();
    g.add(mesh(fuse(logs, 0.5), m));
    return g;
}

/** Canteiros da horta: leiras de terra revolvida (meias-canas irregulares). As plantas entram por dispersão. */
export function buildGardenBeds(rows = 4, len = 4.2) {
    const beds = [];
    for (let i = 0; i < rows; i++) {
        const bed = new THREE.CylinderGeometry(0.36, 0.36, len, 12, 14);
        roughen(bed, 0.05, 2.8, i * 3);
        // leira = cilindro deitado, achatado e meio enterrado
        xf(bed, 0, 0, 0, Math.PI / 2, 0, 0, 1, 0.5, 1);
        beds.push(bed.translate((i - (rows - 1) / 2) * 0.9, -0.04, 0));
    }
    const m = mat('soil', () => pbrMaterial('brown_mud_leaves_01', { color: 0x8a6f58, normalScale: 1.4 }));
    const g = new THREE.Group();
    g.add(mesh(fuse(beds, 0.9), m, { cast: false }));
    return g;
}

/* ------------------------------------------------------------------ */
/* Tesouros                                                             */
/* ------------------------------------------------------------------ */

/** Moeda: disco torneado com borda saliente. */
function coinGeo() {
    return lathe([[0, 0], [0.058, 0], [0.062, 0.004], [0.062, 0.012], [0.058, 0.016], [0.05, 0.013], [0, 0.013]], 14);
}

/**
 * Saco de ouro: corpo de aniagem torneado com pregas (ruído na revolução),
 * gola amarrada por corda, boca aberta cheia de moedas e moedas caídas em volta.
 * `s` = escala (o saco do gigante é do tamanho do João).
 */
export function buildGoldBag(s = 1) {
    const g = new THREE.Group();
    g.name = 'sacoOuro';
    const body = lathe([[0, 0], [0.3, 0.01], [0.43, 0.1], [0.47, 0.28], [0.42, 0.5], [0.27, 0.68], [0.17, 0.76], [0.2, 0.86], [0.28, 0.93], [0.26, 0.95], [0.16, 0.84]], 28);
    const pos = body.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const a = Math.atan2(z, x);
        // pregas verticais mais fundas perto da gola + abaulado irregular do conteúdo
        const fold = Math.sin(a * 9 + y * 3) * 0.035 * THREE.MathUtils.smoothstep(y, 0.35, 0.8);
        const lump = (fbm2(Math.cos(a) * 1.5 + 4, y * 3 + Math.sin(a) * 1.5, 2) - 0.5) * 0.09 * (1 - THREE.MathUtils.smoothstep(y, 0.5, 0.8));
        const k = 1 + fold + lump;
        pos.setXYZ(i, x * k, y, z * k);
    }
    body.computeVertexNormals();
    g.add(mesh(body, MAT.burlap()));

    const tie = xf(new THREE.TorusGeometry(0.185, 0.022, 7, 20), 0, 0.77, 0, Math.PI / 2, 0, 0);
    const tail = tube([[0.18, 0.77, 0.02], [0.3, 0.7, 0.08], [0.33, 0.52, 0.1], [0.3, 0.4, 0.14]], 0.016, 8, 6);
    g.add(mesh(fuse([tie, tail], 0), MAT.rope()));

    // moedas: montinho na boca + espalhadas no chão (uma malha só)
    const rnd = seeded(77);
    const coins = [];
    for (let i = 0; i < 26; i++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.sqrt(rnd()) * 0.16;
        coins.push(xf(coinGeo(), Math.cos(a) * r, 0.84 + rnd() * 0.07 - r * 0.2, Math.sin(a) * r, (rnd() - 0.5) * 1.2, rnd() * 6, (rnd() - 0.5) * 1.2));
    }
    for (let i = 0; i < 22; i++) {
        const a = rnd() * Math.PI * 2;
        const r = 0.5 + rnd() * 0.5;
        const flat = rnd() < 0.75;
        coins.push(xf(coinGeo(), Math.cos(a) * r, flat ? 0.002 + (rnd() < 0.3 ? 0.016 : 0) : 0.06, Math.sin(a) * r, flat ? 0 : Math.PI / 2 - 0.3, rnd() * 6, 0));
    }
    g.add(mesh(fuse(coins, 0), MAT.gold()));
    g.scale.setScalar(s);
    return g;
}

/** Ovo de ouro: revolução de perfil ovoide r(t) = R·sin(πt)·(1 + 0,22·cos(πt)) — mais largo na base. */
export function eggGeometry(R = 0.085, H = 0.23) {
    const prof = [];
    for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        prof.push([Math.max(0, R * Math.sin(Math.PI * t) * (1 + 0.22 * Math.cos(Math.PI * t))), t * H]);
    }
    return lathe(prof, 20);
}

/** Ninho de palha trançada (toros irregulares empilhados) com ovos de ouro. A galinha fica em cima. */
export function buildNest(s = 1) {
    const g = new THREE.Group();
    g.name = 'ninho';
    const rnd = seeded(5);
    const straw = [];
    for (let i = 0; i < 7; i++) {
        const R = 0.5 + Math.sin(i / 6 * Math.PI) * 0.16;
        const ring = new THREE.TorusGeometry(R, 0.075, 6, 26);
        roughen(ring, 0.035, 5, i);
        straw.push(xf(ring, (rnd() - 0.5) * 0.03, 0.07 + i * 0.062, (rnd() - 0.5) * 0.03, Math.PI / 2, 0, rnd()));
    }
    const pad = roughen(new THREE.CylinderGeometry(0.5, 0.42, 0.12, 16, 1), 0.03, 4, 2);
    pad.translate(0, 0.1, 0);
    straw.push(pad);
    g.add(mesh(fuse(straw, 0.5), MAT.thatch()));
    const eggs = [];
    for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + 0.4;
        eggs.push(xf(eggGeometry(), Math.cos(a) * 0.28, 0.2, Math.sin(a) * 0.28, 1.2 + rnd() * 0.5, a, 0));
    }
    eggs.push(xf(eggGeometry(), 0.86, 0.085, 0.3, Math.PI / 2, 0.4, 0));
    g.add(mesh(fuse(eggs, 0), MAT.gold()));
    g.scale.setScalar(s);
    return g;
}

/**
 * Harpa dourada: coluna torneada, braço em S (tubo ao longo de spline) com
 * voluta, caixa de ressonância afilada e 16 cordas. Altura ≈ 1,9 m × `s`.
 * @returns {THREE.Group} userData.strings = Mesh das cordas (vibra quando canta)
 */
export function buildHarp(s = 1) {
    const g = new THREE.Group();
    g.name = 'harpa';
    const gold = [];
    // coluna (pilar da frente)
    const column = lathe([[0.075, 0], [0.11, 0.03], [0.1, 0.1], [0.05, 0.16], [0.042, 0.8], [0.05, 1.5], [0.075, 1.6], [0.06, 1.66], [0.085, 1.74], [0.05, 1.8], [0, 1.82]], 14);
    gold.push(xf(column, 0.52, 0.06, 0));
    // braço em S, da coluna ao topo da caixa
    const neckPts = [[0.52, 1.82, 0], [0.34, 1.95, 0], [0.1, 1.86, 0], [-0.1, 1.62, 0], [-0.3, 1.5, 0], [-0.46, 1.58, 0]];
    gold.push(tube(neckPts, 0.05, 30, 9));
    // voluta no topo da coluna
    const scroll = [];
    for (let i = 0; i <= 26; i++) {
        const a = (i / 26) * Math.PI * 3.2;
        const r = 0.15 * (1 - i / 30);
        scroll.push(new THREE.Vector3(0.6 + Math.cos(a) * r, 1.9 + Math.sin(a) * r, 0));
    }
    gold.push(tube(scroll, 0.028, 40, 7));
    // caixa de ressonância: tronco afilado inclinado (seção em D)
    const box = new THREE.CylinderGeometry(0.075, 0.17, 1.62, 12, 6, false, 0, Math.PI);
    xf(box, 0, 0, 0, 0, Math.PI / 2, 0);
    xf(box, -0.36, 0.86, 0, 0, 0, -0.2);
    gold.push(box);
    // base em sapata
    const foot = lathe([[0, 0], [0.34, 0], [0.36, 0.03], [0.3, 0.07], [0.12, 0.1], [0, 0.1]], 20);
    gold.push(xf(foot, 0.12, 0, 0, 0, 0, 0, 1.5, 1, 0.75));
    g.add(mesh(fuse(gold, 0), MAT.gold()));

    // cordas: do braço (curva) até a caixa (reta inclinada)
    const curve = new THREE.CatmullRomCurve3(neckPts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    const strings = [];
    for (let i = 0; i < 16; i++) {
        const u = 0.14 + (i / 15) * 0.8;
        const top = curve.getPoint(u);
        const bx = 0.4 - (i / 15) * 0.86;
        const by = 0.14 + ((0.4 - bx) / 0.86) * 1.25 * 0.92;
        const len = top.y - by;
        const st = new THREE.CylinderGeometry(0.0035, 0.0035, len, 4, 1);
        const dx = top.x - bx;
        strings.push(xf(st, (top.x + bx) / 2, (top.y + by) / 2, 0, 0, 0, -Math.atan2(dx, len)));
    }
    const sm = mesh(fuse(strings, 0), mat('strings', () => new THREE.MeshStandardMaterial({
        color: 0xfff1c4, metalness: 1, roughness: 0.18, emissive: 0xffd27a, emissiveIntensity: 0.25
    })), { cast: false });
    g.add(sm);
    g.userData.strings = sm;
    g.scale.setScalar(s);
    return g;
}

/* ------------------------------------------------------------------ */
/* Castelo do gigante                                                   */
/* ------------------------------------------------------------------ */

/** Medidas do salão (interior). Tudo em escala de gigante: a porta tem 11 m. */
export const HALL = {
    x0: -15, x1: 15, z0: -22, z1: 20, h: 15, t: 2.2, floor: 0.25,
    door: { w: 6.6, h: 10.6 }
};

/** Torre redonda com mísulas, ameias e telhado cônico de ardósia. */
function towerParts(x, z, R, H, stone, slate) {
    const body = lathe([[R * 1.08, -3], [R * 1.05, 0], [R, 1.2], [R, H - 1.6], [R * 1.14, H - 0.9], [R * 1.14, H], [R * 0.86, H], [R * 0.86, H - 0.5]], 22);
    roughen(body, 0.05, 0.9, x + z);
    stone.push(body.translate(x, 0, z));
    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const merlon = roughen(new THREE.BoxGeometry(R * 0.4, 1.3, 0.55, 2, 2, 1), 0.03, 1.5, i);
        stone.push(xf(merlon, x + Math.cos(a) * R * 1.0, H + 0.65, z + Math.sin(a) * R * 1.0, 0, -a + Math.PI / 2, 0));
    }
    const cone = lathe([[R * 1.02, H + 0.9], [R * 0.98, H + 1.2], [R * 0.5, H + 5.2], [0.12, H + 9.4], [0, H + 9.6]], 20);
    slate.push(cone.translate(x, 0, z));
}

/**
 * Salão do gigante: quatro paredes de cantaria com 2,2 m de espessura, vão da
 * porta em arco, janelas altas em arco nas laterais, torres nos cantos,
 * ameias, telhado de ardósia em duas águas sobre tesouras, piso de lajes e
 * lareira com chaminé. A porta (glTF) é montada à parte.
 * @returns {THREE.Group} userData: { hearth: Vector3, chandelier: Vector3 }
 */
export function buildCastleHall() {
    const { x0, x1, z0, z1, h, t, floor, door } = HALL;
    const g = new THREE.Group();
    g.name = 'salao';
    const W = x1 - x0;
    const D = z1 - z0;
    const cz = (z0 + z1) / 2;
    const stone = [];
    const slate = [];

    // paredes (elevação → extrusão). A frente tem o vão da porta; laterais têm janelas em arco.
    const front = wall(W + t * 2, h, t, [{ x: 0, y: floor, w: door.w, h: door.h, arch: true }]);
    stone.push(xf(front, 0, 0, z1 + t / 2));
    const back = wall(W + t * 2, h, t, [{ x: 0, y: 8.2, w: 3.2, h: 5.2, arch: true }]);
    stone.push(xf(back, 0, 0, z0 - t / 2, 0, Math.PI, 0));
    const sideHoles = [-13, -4.5, 4.5, 13].map((x) => ({ x, y: 6.4, w: 2.6, h: 6.6, arch: true }));
    const east = wall(D, h, t, sideHoles);
    stone.push(xf(east, x1 + t / 2, 0, cz, 0, Math.PI / 2, 0));
    // oeste: a lareira ocupa o meio; janelas só nas pontas
    const west = wall(D, h, t, [sideHoles[0], sideHoles[3]]);
    stone.push(xf(west, x0 - t / 2, 0, cz, 0, -Math.PI / 2, 0));
    // empenas sobre frente e fundos
    for (const [z, ry] of [[z1 + t / 2, 0], [z0 - t / 2, Math.PI]]) {
        const gab = wall(W + t * 2, 0.01, t, [], 7.2);
        stone.push(xf(gab, 0, h - 0.01, z, 0, ry, 0));
    }
    // ameias ao longo das laterais
    for (const x of [x0 - t / 2, x1 + t / 2]) {
        for (let i = 0; i < 12; i++) {
            const merlon = roughen(new THREE.BoxGeometry(t * 0.9, 1.5, 1.9, 2, 2, 2), 0.04, 1.2, i);
            stone.push(merlon.translate(x + Math.sign(x) * 0.5, h + 0.75, z0 + 2.2 + i * (D - 4.4) / 11));
        }
    }
    // soco externo que mergulha na nuvem
    const skirt = roughen(new THREE.BoxGeometry(W + t * 2 + 1.2, 5, D + t * 2 + 1.2, 16, 3, 20), 0.08, 0.7, 3);
    skirt.translate(0, -2.5 + 0.02, cz);
    stone.push(skirt);
    // degraus da entrada
    for (let i = 0; i < 3; i++) {
        const st = roughen(new THREE.BoxGeometry(door.w + 3 - i * 0.6, 0.14, 1.3, 8, 1, 2), 0.02, 1.5, i);
        stone.push(st.translate(0, 0.02 + i * 0.07, z1 + t + 0.6 + (2 - i) * 0.9));
    }
    // torres nos quatro cantos
    for (const [tx, tz] of [[x0 - t / 2, z1 + t / 2], [x1 + t / 2, z1 + t / 2], [x0 - t / 2, z0 - t / 2], [x1 + t / 2, z0 - t / 2]]) {
        towerParts(tx, tz, 3.4, h + 4.5, stone, slate);
    }
    g.add(mesh(fuse(stone, 3.2), MAT.blocks()));

    // telhado: duas águas de ardósia com espessura
    const half = W / 2 + t + 0.8;
    const rise = 7.6;
    const sl = Math.hypot(half, rise);
    const ang = Math.atan2(rise, half);
    for (const sx of [-1, 1]) {
        const slab = new THREE.BoxGeometry(sl, 0.5, D + t * 2 + 1.6, 1, 1, 1);
        xf(slab, sl / 2, 0, 0, 0, 0, 0);
        xf(slab, 0, 0, 0, 0, 0, -ang);
        if (sx < 0) xf(slab, 0, 0, 0, 0, Math.PI, 0);
        slate.push(slab.translate(0, h + rise + 0.1, cz));
    }
    g.add(mesh(fuse(slate, 2.4), MAT.roofSlate()));

    // tesouras de madeira aparentes (tirante + pernas + pendural) a cada 7 m
    const tim = [];
    for (let i = 0; i < 7; i++) {
        const z = z0 + 0.5 + i * (D - 1) / 6;
        tim.push(xf(beam(0.7, 0.8, W + 1), 0, h - 0.3, z, 0, Math.PI / 2, 0));
        tim.push(beamBetween(new THREE.Vector3(-W / 2, h, z), new THREE.Vector3(0, h + rise - 1.2, z), 0.55, 0.6));
        tim.push(beamBetween(new THREE.Vector3(W / 2, h, z), new THREE.Vector3(0, h + rise - 1.2, z), 0.55, 0.6));
        tim.push(xf(beam(0.5, 0.5, rise - 1.4), 0, h + (rise - 1.4) / 2, z, Math.PI / 2, 0, 0));
    }
    for (const x of [-W / 4, 0, W / 4]) tim.push(xf(beam(0.4, 0.45, D), x, h + (x === 0 ? rise - 1.1 : rise / 2 - 0.5), cz));
    g.add(mesh(fuse(tim, 2.2), MAT.timber()));

    // piso de lajes
    const slab = new THREE.BoxGeometry(W, floor + 0.5, D + t, 1, 1, 1);
    slab.translate(0, floor - (floor + 0.5) / 2, cz + t / 2);
    g.add(mesh(fuse([slab], 3.4), MAT.floorSlate(), { cast: false }));

    // --- lareira na parede oeste: boca em arco, coifa afunilada, soleira
    const hz = -6;
    const fp = [];
    const mouth = wall(11, 9.2, 2.4, [{ x: 0, y: 0, w: 6.4, h: 6, arch: true }]);
    fp.push(xf(mouth, x0 + 1.2, floor, hz, 0, Math.PI / 2, 0));
    const hood = new THREE.CylinderGeometry(2.2, 5.6, 5.4, 4, 3, false, Math.PI / 4);
    hood.scale(0.55, 1, 1);
    roughen(hood, 0.05, 0.9, 12);
    fp.push(hood.translate(x0 + 1.25, floor + 9.2 + 2.7, hz));
    const mantel = roughen(new THREE.BoxGeometry(3.4, 0.7, 12.2, 4, 1, 12), 0.04, 1.1, 5);
    fp.push(mantel.translate(x0 + 1.5, floor + 9.2, hz));
    const hearthSlab = roughen(new THREE.BoxGeometry(5.2, 0.3, 9.4, 6, 1, 10), 0.03, 1.2, 8);
    fp.push(hearthSlab.translate(x0 + 2.4, floor + 0.12, hz));
    // fundo da fornalha (escuro de fuligem vem do AO; o brilho vem da luz pontual)
    const backWall = new THREE.BoxGeometry(0.4, 6.2, 6.6);
    fp.push(backWall.translate(x0 + 0.2, floor + 3.1, hz));
    g.add(mesh(fuse(fp, 2.6), MAT.slates()));

    // toras em brasa
    const logs = [];
    const rnd = seeded(9);
    for (let i = 0; i < 6; i++) {
        const log = new THREE.CylinderGeometry(0.34, 0.4, 3.4 + rnd(), 9, 4);
        roughen(log, 0.05, 2.5, i);
        logs.push(xf(log, x0 + 1.5 + rnd() * 0.5, floor + 0.55 + (i > 2 ? 0.55 : 0), hz + (i % 3 - 1) * 0.9 + (rnd() - 0.5) * 0.3, Math.PI / 2 + (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.8, 0));
    }
    g.add(mesh(fuse(logs, 0.8), MAT.ember(), { cast: false }));

    // ferragens: argolas de tocha nas paredes
    g.userData.hearth = new THREE.Vector3(x0 + 2.0, floor + 1.4, hz);
    g.userData.chandelier = new THREE.Vector3(0, 12.6, -1);
    return g;
}

/**
 * Banquinho de três pés em escala de gigante (assento torneado + pés abertos):
 * pedestal da harpa e do saco de ouro.
 */
export function buildStool(R = 1.3, H = 1.1) {
    const g = new THREE.Group();
    const parts = [xf(lathe([[0, 0], [R * 0.92, 0], [R, 0.06], [R, 0.2], [R * 0.9, 0.26], [0, 0.26]], 24), 0, H - 0.26, 0)];
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.3;
        parts.push(tube([[Math.cos(a) * R * 0.5, H - 0.2, Math.sin(a) * R * 0.5], [Math.cos(a) * R * 0.7, H * 0.45, Math.sin(a) * R * 0.7], [Math.cos(a) * R * 0.88, 0, Math.sin(a) * R * 0.88]], 0.13, 6, 8));
    }
    g.add(mesh(fuse(parts, 1.2), MAT.oak()));
    return g;
}

/* ------------------------------------------------------------------ */
/* Props glTF                                                            */
/* ------------------------------------------------------------------ */

/** Carrega um prop, liga sombras e devolve o grupo (ou null se a rede falhar — o jogo segue sem ele). */
export async function prop(name, opts = {}) {
    const o = await loadModel(name, opts);
    if (!o) return null;
    o.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
    return o;
}
