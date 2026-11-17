/**
 * Castelo Estelar — arquitetura original, modelada peça a peça e fundida por material.
 *
 * Silhueta assimétrica (nada de eixo central): torre de menagem alta à direita,
 * com galeria em mísulas, tambor recuado e agulha; torre esguia "da Lua" à esquerda,
 * ligada à menagem por uma ponte em arco que passa sobre o telhado do salão;
 * salão nobre com vitrais e contrafortes; capela com rosácea e abside; portaria
 * com duas torretas; muralha poligonal de sete torres, com adarve, mísulas e ameias.
 *
 * Convenções
 *   - unidades em metros; y = 0 é o nível do platô (o grupo é posto em y = PLATEAU_Y);
 *   - rotação ry leva o +Z local para (sin ry, 0, cos ry) — a normal "para fora";
 *   - UV em metros: sólidos de revolução usam u = arco (nº inteiro de repetições) e
 *     v = comprimento do perfil; o resto usa projeção por face (ver `faceUV`).
 *
 * Custo: ~10 draw calls de malha fundida + portão/porta glTF + bandeiras + vidros.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbrMaterial, loadModel } from '../../shared/gfx/assets.js';
import { seeded } from '../../shared/gfx/core.js';
import { glassAtlas, bannerTexture } from './textures.js';

const TAU = Math.PI * 2;
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);

/** Direção do vento (as bandeiras voam todas para o mesmo lado). */
export const WIND = new THREE.Vector3(0.93, 0, 0.37).normalize();

/** Aplica rotação (YXZ) + translação a uma geometria e a devolve. */
function xf(geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    geo.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _s));
    return geo;
}

/**
 * UV por face, em metros / `scale`:
 *   faces deitadas (|n.y| > 0,7): (x, z)
 *   faces em pé: u = p · t, com t = (−n.z, 0, n.x)/|…| (tangente horizontal), v = y
 * Assim uma parede em qualquer ângulo recebe a fiada de pedra sem esticar.
 */
function faceUV(geo, scale) {
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const nx = nor.getX(i);
        const ny = nor.getY(i);
        const nz = nor.getZ(i);
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        if (Math.abs(ny) > 0.7) {
            uv[i * 2] = x / scale;
            uv[i * 2 + 1] = z / scale;
        } else {
            const l = Math.hypot(nx, nz) || 1;
            uv[i * 2] = (x * (-nz / l) + z * (nx / l)) / scale;
            uv[i * 2 + 1] = y / scale;
        }
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geo;
}

/**
 * Sólido de revolução com UV em metros.
 *   u = (i / segs) · round(2π·r_ref / tex)      (repetições inteiras: sem emenda)
 *   v = comprimento acumulado do perfil / tex
 * `flat` deixa as faces planas (telhados facetados de ardósia).
 */
function lathe(profile, segs, { tex = 3, flat = false, phiStart = 0, phiLength = TAU, rRef = null } = {}) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0005), y));
    const g = new THREE.LatheGeometry(pts, segs, phiStart, phiLength);
    const n = pts.length;
    const cum = [0];
    let rMax = 0;
    for (let j = 1; j < n; j++) cum.push(cum[j - 1] + pts[j].distanceTo(pts[j - 1]));
    for (const p of pts) rMax = Math.max(rMax, p.x);
    const reps = Math.max(1, Math.round((TAU * (rRef ?? rMax)) / tex)) * (phiLength / TAU);
    const uv = g.attributes.uv;
    for (let i = 0; i <= segs; i++) {
        for (let j = 0; j < n; j++) uv.setXY(i * n + j, (i / segs) * reps, cum[j] / tex);
    }
    if (!flat) return g.toNonIndexed();
    const out = g.toNonIndexed();
    out.computeVertexNormals();
    return out;
}

function box(w, h, d) {
    return new THREE.BoxGeometry(w, h, d).toNonIndexed();
}

/**
 * Arco ogival (gótico) como caminho 2D: ombreiras retas até a imposta e dois
 * arcos de raio = largura, centrados na imposta oposta (arco equilátero):
 *   altura do arco = w · √3/2
 * `rect` > 0 troca por verga reta; `round` faz um círculo de raio w/2.
 */
function archPath(x, y, w, h, kind = 'gothic') {
    const p = new THREE.Path();
    if (kind === 'round') {
        p.absarc(x, y + h / 2, w / 2, 0, TAU, false);
        return p;
    }
    if (kind === 'rect') {
        p.moveTo(x - w / 2, y);
        p.lineTo(x + w / 2, y);
        p.lineTo(x + w / 2, y + h);
        p.lineTo(x - w / 2, y + h);
        p.closePath();
        return p;
    }
    const rise = Math.min(h * 0.6, w * 0.866);
    const ys = y + h - rise;
    p.moveTo(x - w / 2, y);
    p.lineTo(x + w / 2, y);
    p.lineTo(x + w / 2, ys);
    p.quadraticCurveTo(x + w / 2, ys + rise * 0.62, x, y + h);
    p.quadraticCurveTo(x - w / 2, ys + rise * 0.62, x - w / 2, ys);
    p.closePath();
    return p;
}

function archShape(x, y, w, h, kind) {
    const s = new THREE.Shape();
    const p = archPath(x, y, w, h, kind);
    s.curves = p.curves;
    s.currentPoint = p.currentPoint;
    return s;
}

const ATLAS = { lattice: [0, 0], stained: [0.5, 0], rose: [0, 0.5], house: [0.5, 0.5] };

/** Coletor de geometrias por material + vidros, bandeiras, luzes falsas e âncoras. */
class Builder {
    constructor(seed = 11) {
        this.rnd = seeded(seed);
        const keys = ['stone', 'block', 'slate', 'gold', 'wood', 'iron', 'dark', 'plaster', 'tile'];
        this.b = Object.fromEntries(keys.map((k) => [k, []]));
        this.pre = Object.fromEntries(keys.map((k) => [k, []]));
        this.glass = [];
        this.flags = [];
        this.lamps = [];
    }

    /** Geometria que ainda vai receber UV por face. */
    add(bucket, geo) {
        this.b[bucket].push(geo);
        return geo;
    }

    /** Geometria que já tem UV próprio (sólidos de revolução). */
    addUV(bucket, geo) {
        this.pre[bucket].push(geo);
        return geo;
    }

    box(bucket, w, h, d, x, y, z, ry = 0, rx = 0, rz = 0) {
        return this.add(bucket, xf(box(w, h, d), x, y, z, ry, rx, rz));
    }

    /**
     * Vidro de janela: forma do vão, UV no quadrante do atlas, semente de
     * acendimento (a janela acende quando `uGlow` passa de 0,85·seed).
     */
    glassPane(x, y, w, h, kind, tex, place, seed = this.rnd()) {
        const g = new THREE.ShapeGeometry(archShape(x, y, w, h, kind), 6).toNonIndexed();
        const pos = g.attributes.position;
        const uv = g.attributes.uv;
        const [qx, qy] = ATLAS[tex];
        for (let i = 0; i < pos.count; i++) {
            const u = (pos.getX(i) - (x - w / 2)) / w;
            const v = (pos.getY(i) - y) / h;
            uv.setXY(i, qx + 0.012 + u * 0.476, qy + 0.012 + v * 0.476);
        }
        const seeds = new Float32Array(pos.count).fill(seed);
        g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
        g.deleteAttribute('normal');
        place(g);
        this.glass.push(g);
    }

    /**
     * Pano de parede com vãos recortados (ExtrudeGeometry com furos).
     * Local: x ao longo, y para cima, face externa em z = 0 e interna em z = −t.
     * holes: [{ x, y, w, h, kind, tex, seed, frame }]
     * `gable` > 0 acrescenta a empena triangular (cumeeira em y = h + gable).
     */
    slab(bucket, w, h, t, holes, x, y, z, ry, { gable = 0, glassDepth = 0.6 } = {}) {
        const s = new THREE.Shape();
        s.moveTo(-w / 2, 0);
        s.lineTo(w / 2, 0);
        s.lineTo(w / 2, h);
        if (gable > 0) s.lineTo(0, h + gable);
        s.lineTo(-w / 2, h);
        s.closePath();
        for (const o of holes) s.holes.push(archPath(o.x, o.y, o.w, o.h, o.kind));
        const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false, curveSegments: 7 });
        g.translate(0, 0, -t);
        this.add(bucket, xf(g, x, y, z, ry));
        for (const o of holes) {
            if (o.tex) {
                this.glassPane(o.x, o.y, o.w, o.h, o.kind, o.tex, (gg) => {
                    gg.translate(0, 0, -t * glassDepth);
                    xf(gg, x, y, z, ry);
                }, o.seed);
            }
            if (o.kind !== 'round' && o.w > 1.3 && o.tex) {
                // mainel central e travessa de pedra
                this.add('block', xf(xf(box(0.16, o.h * 0.9, 0.22), o.x, o.y + o.h * 0.45, -t * 0.42), x, y, z, ry));
                this.add('block', xf(xf(box(o.w, 0.14, 0.22), o.x, o.y + o.h * 0.5, -t * 0.42), x, y, z, ry));
            }
            if (o.frame !== false) {
                // moldura saliente (arquivolta) em volta do vão
                const f = archShape(o.x, o.y - (o.kind === 'round' ? 0.14 : 0), o.w + 0.36, o.h + (o.kind === 'round' ? 0.28 : 0.2), o.kind);
                f.holes.push(archPath(o.x, o.y, o.w, o.h, o.kind));
                const fg = new THREE.ExtrudeGeometry(f, { depth: 0.14, bevelEnabled: false, curveSegments: 7 });
                this.add('block', xf(fg, x, y, z, ry));
            }
        }
    }

    /** Janela aplicada em torre redonda: moldura saliente + vidro + peitoril. */
    towerWindow(cx, cz, r, a, y, w, h, tex = 'lattice', seed) {
        const ox = Math.sin(a);
        const oz = Math.cos(a);
        const f = archShape(0, 0, w + 0.4, h + 0.26, 'gothic');
        f.holes.push(archPath(0, 0.06, w, h, 'gothic'));
        const fg = new THREE.ExtrudeGeometry(f, { depth: 0.3, bevelEnabled: false, curveSegments: 6 });
        this.add('block', xf(fg, cx + ox * (r - 0.14), y, cz + oz * (r - 0.14), a));
        this.box('block', w + 0.6, 0.14, 0.42, cx + ox * (r + 0.05), y - 0.05, cz + oz * (r + 0.05), a);
        this.glassPane(0, 0.06, w, h, 'gothic', tex, (g) => xf(g, cx + ox * (r + 0.035), y, cz + oz * (r + 0.035), a), seed);
    }

    /** Anel de merlões sobre um parapeito circular. */
    merlonRing(cx, cz, r, y, { h = 0.9, t = 0.4, pitch = 1.7 } = {}) {
        const n = Math.max(6, Math.round((TAU * r) / pitch));
        const w = ((TAU * r) / n) * 0.56;
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            this.box('stone', w, h, t, cx + Math.sin(a) * r, y + h / 2, cz + Math.cos(a) * r, a);
            this.box('block', w + 0.1, 0.1, t + 0.1, cx + Math.sin(a) * r, y + h + 0.05, cz + Math.cos(a) * r, a);
        }
    }

    /** Anel de mísulas (cachorros) sob um ressalto. */
    corbelRing(cx, cz, r, y, { h = 0.6, d = 0.5, pitch = 0.95 } = {}) {
        const n = Math.max(8, Math.round((TAU * r) / pitch));
        for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            this.box('block', 0.3, h, d, cx + Math.sin(a) * r, y + h / 2, cz + Math.cos(a) * r, a, 0.32);
        }
    }

    /** Remate dourado: disco, colo, esfera e agulha. Devolve a altura do topo. */
    finial(x, y, z, s = 1) {
        const prof = [[0.02, 0], [0.2, 0.04], [0.08, 0.3], [0.2, 0.46], [0.27, 0.62], [0.2, 0.78], [0.06, 0.92], [0.035, 1.7], [0.0, 1.85]]
            .map(([r, yy]) => [r * s, yy * s]);
        this.addUV('gold', xf(lathe(prof, 10, { tex: 1 }), x, y, z));
        return y + 1.85 * s;
    }

    /** Mastro + estandarte (o pano é animado no shader). */
    flag(x, y, z, { pole = 2.6, len = 2.2, hgt = 1.1 } = {}) {
        this.addUV('iron', xf(lathe([[0.045, 0], [0.035, pole], [0.0, pole + 0.02]], 6, { tex: 1 }), x, y, z));
        this.addUV('gold', xf(lathe([[0.0, 0], [0.09, 0.06], [0.09, 0.16], [0.0, 0.24]], 8, { tex: 1 }), x, y + pole, z));
        this.flags.push({ x, y: y + pole - 0.08, z, len, hgt, phase: this.rnd() * TAU });
    }

    /** Luz falsa (ponto aditivo com halo): tochas, lampiões, braseiros. */
    lamp(x, y, z, size = 1, color = 0xffb054) {
        this.lamps.push({ x, y, z, size, color });
    }

    /**
     * Torre redonda.
     *   perfil: sapata em talude (1,22·r) → fuste r → ressalto em mísulas (r + 0,5)
     *   roof > 0: cone facetado de ardósia com beiral em sino; senão, terraço com ameias.
     */
    tower({ x, z, r, h, roof = 0, facets = 12, flag = false, windows = [], base = -6, segs = 28, corbels = true, finialScale = 1 }) {
        const prof = [[r * 1.22, base], [r * 1.07, 0.9], [r, 2.1], [r, h - 1.7], [r + 0.5, h - 0.85], [r + 0.5, h]];
        if (roof > 0) {
            prof.push([r + 0.5, h + 0.2], [r + 1.0, h + 0.08]);
        } else {
            prof.push([r + 0.5, h + 0.95], [r + 0.12, h + 0.95], [r + 0.12, h + 0.06], [0, h + 0.06]);
        }
        this.addUV('stone', xf(lathe(prof, segs, { rRef: r }), x, 0, z));
        // cordões de pedra
        for (const yy of [2.1, h - 2.5]) {
            this.addUV('block', xf(lathe([[r + 0.02, yy], [r + 0.2, yy + 0.08], [r + 0.2, yy + 0.3], [r + 0.02, yy + 0.4]], segs, { rRef: r }), x, 0, z));
        }
        if (corbels) this.corbelRing(x, z, r + 0.3, h - 1.55, { h: 0.62, d: 0.55 });
        let top = h + 0.95;
        if (roof > 0) {
            const rp = [[r + 1.05, h + 0.05], [r + 0.6, h + 0.7], [r * 0.56, h + 0.1 + roof * 0.5], [0.12, h + 0.1 + roof]];
            this.addUV('slate', xf(lathe(rp, facets, { tex: 2.4, flat: true, rRef: r }), x, 0, z, 0.2));
            top = this.finial(x, h + roof - 0.05, z, finialScale);
            if (flag) this.flag(x, top - 0.3, z);
        } else {
            this.merlonRing(x, z, r + 0.31, h + 0.95);
            if (flag) {
                this.flag(x, h + 0.06, z, { pole: 5.2, len: 2.6, hgt: 1.3 });
                top = h + 5.3;
            }
        }
        for (const w of windows) this.towerWindow(x, z, r, w.a, w.y, w.w ?? 0.8, w.h ?? 1.9, w.tex ?? 'lattice', w.seed);
        return top;
    }

    /**
     * Telhado de duas águas com espessura: perfil em "V" invertido extrudado.
     * Local: cumeeira ao longo de +Z (comprimento L), vão W em X, altura H.
     */
    gableRoof(W, H, L, x, y, z, ry, { over = 0.7, thick = 0.28, bucket = 'slate' } = {}) {
        const k = H / (W / 2);
        const s = new THREE.Shape();
        s.moveTo(-W / 2 - over, -over * k);
        s.lineTo(0, H);
        s.lineTo(W / 2 + over, -over * k);
        s.lineTo(W / 2 + over, -over * k - thick);
        s.lineTo(0, H - thick * 1.6);
        s.lineTo(-W / 2 - over, -over * k - thick);
        s.closePath();
        const g = new THREE.ExtrudeGeometry(s, { depth: L, bevelEnabled: false });
        g.translate(0, 0, -L / 2);
        this.add(bucket, xf(g, x, y, z, ry));
        // cumeeira de pedra
        this.box(bucket === 'slate' ? 'block' : bucket, 0.34, 0.26, L + 0.1, x, y + H + 0.05, z, ry);
    }

    /** Pináculo gótico (agulha de 4 faces) sobre contraforte. */
    pinnacle(x, y, z, s = 1) {
        const prof = [[0.42, 0], [0.42, 0.9], [0.56, 1.0], [0.56, 1.15], [0.3, 1.3], [0.0, 3.1]].map(([r, yy]) => [r * s, yy * s]);
        this.addUV('block', xf(lathe(prof, 4, { tex: 1.5, flat: true }), x, y, z, Math.PI / 4));
        this.addUV('gold', xf(lathe([[0, 0], [0.1, 0.08], [0.0, 0.34]], 6, { tex: 1 }), x, y + 3.05 * s, z));
    }

    /** Contraforte escalonado encostado a uma parede (z local = para fora). */
    buttress(x, y, z, ry, h, { w = 0.95, d = 1.1, pin = false } = {}) {
        const ox = Math.sin(ry);
        const oz = Math.cos(ry);
        this.box('block', w, h * 0.55, d, x + ox * d * 0.5, y + h * 0.275, z + oz * d * 0.5, ry);
        this.box('block', w * 0.85, h * 0.45, d * 0.62, x + ox * d * 0.31, y + h * 0.775, z + oz * d * 0.31, ry);
        // chapéus inclinados
        this.box('block', w + 0.08, 0.14, d * 0.6, x + ox * d * 0.78, y + h * 0.55 + 0.12, z + oz * d * 0.78, ry, 0.6);
        this.box('block', w * 0.9, 0.14, d * 0.8, x + ox * d * 0.32, y + h + 0.1, z + oz * d * 0.32, ry, 0.55);
        if (pin) this.pinnacle(x + ox * 0.25, y + h + 0.1, z + oz * 0.25, 0.8);
    }

    /** Funde tudo: devolve { [bucket]: BufferGeometry }. */
    merged(scales) {
        const out = {};
        for (const key of Object.keys(this.b)) {
            const list = [];
            if (this.b[key].length) {
                const tri = mergeGeometries(this.b[key].map(strip));
                faceUV(tri, scales[key] ?? 3);
                list.push(tri);
            }
            for (const g of this.pre[key]) list.push(strip(g));
            if (!list.length) continue;
            out[key] = list.length === 1 ? list[0] : mergeGeometries(list);
            for (const g of this.b[key]) g.dispose();
            for (const g of this.pre[key]) g.dispose();
        }
        return out;
    }
}

/** Deixa só position/normal/uv (não indexado) para a fusão. */
function strip(g) {
    const out = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(out.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name);
    }
    if (!out.attributes.uv) out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
    if (!out.attributes.normal) out.computeVertexNormals();
    return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Materiais
// ═══════════════════════════════════════════════════════════════════════════

function makeMaterials() {
    return {
        // cantaria clara: o albedo de castle_brick_02_white é escuro, então fica só o relevo
        // (normal + AO/rugosidade) dos conjuntos, com cor própria
        stone: pbrMaterial('castle_brick_02_white', { map: null, color: 0xd8d0c0, normalScale: 1.3 }),
        block: pbrMaterial('medieval_blocks_02', { map: null, color: 0xc4bcad, normalScale: 1.4 }),
        slate: pbrMaterial('roof_slates_02', { color: 0x93a3bd, normalScale: 1.2, roughness: 0.85 }),
        wood: pbrMaterial('dark_wooden_planks', { color: 0xcbb69a }),
        gold: new THREE.MeshStandardMaterial({ color: 0xe0ad45, metalness: 1, roughness: 0.3, emissive: 0x4a3208, emissiveIntensity: 0.5 }),
        iron: new THREE.MeshStandardMaterial({ color: 0x23262c, metalness: 0.85, roughness: 0.5 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x06070a, roughness: 1, metalness: 0 }),
        plaster: pbrMaterial('plastered_wall_04', { color: 0xe6dcc8 }),
        tile: pbrMaterial('clay_roof_tiles_02', { color: 0xc9a48c })
    };
}

/**
 * Vidro das janelas — emissivo, sem luz da cena:
 *   aceso = smoothstep(0,85·s, 0,85·s + 0,12, uGlow)        (s = semente da janela)
 *   cor   = mix(frio · reflexo da lua, atlas · uGain · tremor, aceso)
 * O tremor (±6 %) imita vela/lareira; `uGain` fica abaixo de 1,6 para o bloom
 * não comer a treliça.
 */
function makeGlassMaterial() {
    return new THREE.ShaderMaterial({
        name: 'castleGlass',
        uniforms: {
            uAtlas: { value: glassAtlas() },
            uGlow: { value: 0 },
            uGain: { value: 1.25 },
            uTime: { value: 0 },
            uCold: { value: new THREE.Color(0.012, 0.02, 0.04) }
        },
        vertexShader: /* glsl */ `
            attribute float aSeed;
            varying vec2 vUv;
            varying float vSeed;
            void main() {
                vUv = uv;
                vSeed = aSeed;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform sampler2D uAtlas;
            uniform float uGlow, uGain, uTime;
            uniform vec3 uCold;
            varying vec2 vUv;
            varying float vSeed;
            void main() {
                vec3 tex = texture2D(uAtlas, vUv).rgb;
                float lit = smoothstep(vSeed * 0.85, vSeed * 0.85 + 0.12, uGlow);
                float flick = 0.94 + 0.06 * sin(uTime * (2.0 + vSeed * 5.0) + vSeed * 40.0);
                float lum = dot(tex, vec3(0.3, 0.6, 0.1));
                vec3 warm = tex * uGain * flick;
                vec3 cold = uCold * (0.5 + lum);
                gl_FragColor = vec4(mix(cold, warm, lit), 1.0);
            }
        `,
        side: THREE.DoubleSide
    });
}

/**
 * Estandartes: pano animado no vértice (MeshStandardMaterial estendido).
 *   onda(u) = 0,75·sin(6,5u − 5,2t + φ) + 0,35·sin(11u − 7,9t + 1,7φ + 2v)
 *   p' = p + N·onda·A(u)·L − ŷ·0,18·u²·L,     A(u) = u·(0,22 + 0,1·sin(0,7t + φ))
 *   normal ≈ normalize(N − W·∂onda/∂u·A)       (u = 0 no mastro, que não se move)
 * N = perpendicular horizontal ao vento W; L = comprimento do pano.
 */
function makeFlagMesh(flags) {
    const N = new THREE.Vector3(-WIND.z, 0, WIND.x);
    const sx = 14;
    const sy = 5;
    const per = (sx + 1) * (sy + 1);
    const pos = new Float32Array(flags.length * per * 3);
    const uv = new Float32Array(flags.length * per * 2);
    const aux = new Float32Array(flags.length * per * 2);
    const nor = new Float32Array(flags.length * per * 3);
    const idx = [];
    flags.forEach((f, k) => {
        for (let j = 0; j <= sy; j++) {
            for (let i = 0; i <= sx; i++) {
                const o = k * per + j * (sx + 1) + i;
                const u = i / sx;
                const v = j / sy;
                pos[o * 3] = f.x + WIND.x * u * f.len;
                pos[o * 3 + 1] = f.y - v * f.hgt;
                pos[o * 3 + 2] = f.z + WIND.z * u * f.len;
                uv[o * 2] = u;
                uv[o * 2 + 1] = 1 - v;
                aux[o * 2] = f.phase;
                aux[o * 2 + 1] = f.len;
                nor[o * 3] = N.x;
                nor[o * 3 + 2] = N.z;
            }
        }
        for (let j = 0; j < sy; j++) {
            for (let i = 0; i < sx; i++) {
                const a = k * per + j * (sx + 1) + i;
                idx.push(a, a + sx + 1, a + 1, a + 1, a + sx + 1, a + sx + 2);
            }
        }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setAttribute('aFlag', new THREE.BufferAttribute(aux, 2));
    geo.setIndex(idx);
    const time = { value: 0 };
    const mat = new THREE.MeshStandardMaterial({
        map: bannerTexture(), side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.82, metalness: 0
    });
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = time;
        shader.uniforms.uFlagN = { value: N };
        shader.uniforms.uFlagW = { value: WIND };
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', /* glsl */ `#include <common>
                attribute vec2 aFlag;
                uniform float uTime;
                uniform vec3 uFlagN, uFlagW;`)
            .replace('#include <beginnormal_vertex>', /* glsl */ `
                float fu = uv.x;
                float fph = aFlag.x;
                float fa1 = fu * 6.5 - uTime * 5.2 + fph;
                float fa2 = fu * 11.0 - uTime * 7.9 + fph * 1.7 + uv.y * 2.0;
                float fAmp = fu * (0.22 + 0.1 * sin(uTime * 0.7 + fph));
                float fWave = 0.75 * sin(fa1) + 0.35 * sin(fa2);
                float fSlope = (0.75 * 6.5 * cos(fa1) + 0.35 * 11.0 * cos(fa2)) * fAmp;
                vec3 objectNormal = normalize(uFlagN - uFlagW * fSlope);
                #ifdef USE_TANGENT
                vec3 objectTangent = vec3(tangent.xyz);
                #endif`)
            .replace('#include <begin_vertex>', /* glsl */ `
                vec3 transformed = position + uFlagN * fWave * fAmp * aFlag.y
                    - vec3(0.0, 1.0, 0.0) * fu * fu * 0.18 * aFlag.y;`);
    };
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'bandeiras';
    mesh.frustumCulled = false;
    return { mesh, time };
}

// ═══════════════════════════════════════════════════════════════════════════
// Partes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lanço de muralha de A a B: corpo, soco em pedra maior, cordão, adarve com
 * parapeito em mísulas (balanço de 25 cm), merlões com capeamento, contrafortes
 * e seteiras.
 */
function curtain(B, ax, az, bx, bz, { h = 7.5, t = 2.0 } = {}) {
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    const cx = (ax + bx) / 2;
    const cz = (az + bz) / 2;
    let ox = dz / len;
    let oz = -dx / len;
    if (ox * cx + oz * cz < 0) {
        ox = -ox;
        oz = -oz;
    }
    const ry = Math.atan2(ox, oz);
    const tx = Math.cos(ry);
    const tz = -Math.sin(ry);
    const at = (u, v, w) => [cx + tx * u + ox * w, v, cz + tz * u + oz * w];
    const put = (bucket, bw, bh, bd, u, v, w, rx = 0) => B.box(bucket, bw, bh, bd, ...at(u, v, w), ry, rx);

    put('stone', len, h + 6, t, 0, (h - 6) / 2, 0);
    put('block', len, 7.4, t + 0.7, 0, -2.3, 0);
    put('block', len, 0.16, t + 0.9, 0, 1.46, 0, 0);
    put('block', len, 0.3, t + 0.3, 0, h - 1.0, 0);
    // parapeito externo em balanço + interno baixo
    put('stone', len, 0.95, 0.4, 0, h + 0.47, t / 2 + 0.05);
    put('stone', len, 0.8, 0.26, 0, h + 0.4, -t / 2 + 0.13);
    put('block', len, 0.12, 2.5, 0, h - 0.02, 0.06);
    const nCorb = Math.floor(len / 0.95);
    for (let i = 0; i < nCorb; i++) {
        const u = -len / 2 + (i + 0.5) * (len / nCorb);
        put('block', 0.3, 0.5, 0.42, u, h - 0.36, t / 2 + 0.12, 0.3);
    }
    const nMer = Math.max(2, Math.floor(len / 1.9));
    for (let i = 0; i < nMer; i++) {
        const u = -len / 2 + (i + 0.5) * (len / nMer);
        put('stone', 1.0, 0.9, 0.4, u, h + 1.4, t / 2 + 0.05);
        put('block', 1.1, 0.1, 0.52, u, h + 1.9, t / 2 + 0.05);
    }
    const nBut = Math.max(1, Math.round(len / 7.5));
    for (let i = 0; i < nBut; i++) {
        const u = -len / 2 + (i + 0.5) * (len / nBut);
        const [px, , pz] = at(u, 0, t / 2);
        B.buttress(px, -6, pz, ry, 10.5, { w: 1.15, d: 1.3 });
        // seteiras entre contrafortes
        for (const du of [-1.9, 1.9]) {
            if (Math.abs(u + du) > len / 2 - 1.2) continue;
            put('dark', 0.16, 1.5, 0.06, u + du, 4.3, t / 2 + 0.005);
            put('dark', 0.5, 0.16, 0.06, u + du, 4.3, t / 2 + 0.005);
        }
    }
}

/** Portaria: bloco com passagem ogival, torretas, mata-cães e pavilhão de ardósia. */
function gatehouse(B, R) {
    const zf = 27.6; // face frontal
    const zb = 20.4; // face posterior
    const W = 8.6;
    const H = 12;
    const arch = { x: 0, y: 6, w: 4.2, h: 6.0, kind: 'gothic', frame: true };
    // y = −6 é a base do pano; o vão começa no nível do pátio (y local 6)
    B.slab('stone', W, H + 6, 1.5, [arch, { x: 0, y: 14.4, w: 1.3, h: 2.5, kind: 'gothic', tex: 'stained', seed: 0.2 },
        { x: -2.7, y: 14.9, w: 0.7, h: 1.7, kind: 'gothic', tex: 'lattice' }, { x: 2.7, y: 14.9, w: 0.7, h: 1.7, kind: 'gothic', tex: 'lattice' }],
    0, -6, zf, 0);
    B.slab('stone', W, H + 6, 1.5, [{ ...arch, frame: false }], 0, -6, zb, Math.PI);
    for (const s of [-1, 1]) {
        B.box('stone', 1.6, H + 6, zf - zb - 3, s * (W / 2 - 0.8), H / 2 - 3, (zf + zb) / 2);
    }
    // interior da passagem: abóbada escura e piso de laje
    B.box('dark', W - 3.2, 0.3, zf - zb - 3, 0, 6.3, (zf + zb) / 2);
    B.box('block', W - 3.2, 0.3, zf - zb + 3, 0, -0.14, (zf + zb) / 2 + 1.5);
    // degraus/soleira e soco
    for (const s of [-1, 1]) B.box('block', 2.4, 7.2, zf - zb + 0.8, s * (W / 2 - 0.8), -2.4, (zf + zb) / 2);
    B.box('block', W + 0.5, 0.34, zf - zb + 0.5, 0, H - 2.6, (zf + zb) / 2);
    // mata-cães: mísulas + parapeito em balanço nas quatro faces
    const ring = [[0, zf + 0.3, W + 0.6, 0], [0, zb - 0.3, W + 0.6, Math.PI], [W / 2 + 0.3, (zf + zb) / 2, zf - zb + 0.6, Math.PI / 2], [-W / 2 - 0.3, (zf + zb) / 2, zf - zb + 0.6, -Math.PI / 2]];
    for (const [x, z, len, ry] of ring) {
        const tx = Math.cos(ry);
        const tz = -Math.sin(ry);
        const n = Math.floor(len / 0.95);
        for (let i = 0; i < n; i++) {
            const u = -len / 2 + (i + 0.5) * (len / n);
            B.box('block', 0.32, 0.7, 0.55, x + tx * u - Math.sin(ry) * 0.12, H - 0.4, z + tz * u - Math.cos(ry) * 0.12, ry, 0.3);
        }
        B.box('stone', len, 1.0, 0.4, x, H + 0.5, z, ry);
        const nm = Math.floor(len / 1.8);
        for (let i = 0; i < nm; i++) {
            const u = -len / 2 + (i + 0.5) * (len / nm);
            B.box('stone', 0.95, 0.9, 0.4, x + tx * u, H + 1.45, z + tz * u, ry);
            B.box('block', 1.05, 0.1, 0.52, x + tx * u, H + 1.95, z + tz * u, ry);
        }
    }
    B.box('block', W + 0.6, 0.2, zf - zb + 0.6, 0, H - 0.05, (zf + zb) / 2);
    // pavilhão de ardósia de quatro águas, recuado atrás das ameias
    B.addUV('slate', xf(lathe([[4.3, 0], [3.6, 0.8], [1.5, 4.2], [0.14, 6.4]], 4, { tex: 2.4, flat: true }), 0, H + 0.1, (zf + zb) / 2, Math.PI / 4));
    const top = B.finial(0, H + 6.4, (zf + zb) / 2, 1.1);
    B.flag(0, top - 0.3, (zf + zb) / 2, { len: 2.8, hgt: 1.4, pole: 3 });
    // torretas que ladeiam a porta
    for (const s of [-1, 1]) {
        B.tower({
            x: s * 5.7, z: 26.3, r: 2.3, h: 15.2, roof: 6.6, facets: 10,
            windows: [{ a: s * 0.5, y: 5.2 }, { a: s * 0.35, y: 9.6 }, { a: s * 0.9, y: 12.2, w: 0.7, h: 1.5 }]
        });
        // archotes ao lado do portal
        B.box('iron', 0.1, 0.1, 0.6, s * 2.75, 4.3, zf + 0.3);
        B.addUV('iron', xf(lathe([[0.05, 0], [0.2, 0.3], [0.22, 0.42]], 6, { tex: 1 }), s * 2.75, 4.2, zf + 0.6));
        B.lamp(s * 2.75, 4.85, zf + 0.6, 1.5, 0xff9a3a);
    }
    // brasão: estrela dourada de oito pontas sobre o arco
    const star = starShape(0.62, 0.26, 8);
    const sg = new THREE.ExtrudeGeometry(star, { depth: 0.1, bevelEnabled: false });
    B.add('gold', xf(sg, 0, 7.15, zf + 0.02));
    // luz quente no fundo da passagem (porta entreaberta)
    B.lamp(0, 3.2, zb + 2.4, 2.4, 0xffa040);
    R.gate = { x: 0, z: zf, zBack: zb, width: arch.w, height: arch.h };
}

function starShape(r1, r0, points) {
    const s = new THREE.Shape();
    for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * TAU + Math.PI / 2;
        const r = i % 2 ? r0 : r1;
        if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    return s;
}

/** Salão nobre: quatro vitrais altos, contrafortes com pináculos, trapeiras e chaminés. */
function greatHall(B) {
    const cx = -6.5;
    const cz = -2;
    const L = 17;
    const W = 10;
    const H = 13;
    const t = 1.2;
    const RH = 7.2;
    const wins = [-5.4, -1.8, 1.8, 5.4].map((x, i) => ({ x, y: 6.2, w: 1.7, h: 6.0, kind: 'gothic', tex: 'stained', seed: 0.3 + i * 0.07 }));
    const low = [-5.4, -1.8, 5.4].map((x) => ({ x, y: 2.2, w: 0.9, h: 2.2, kind: 'gothic', tex: 'lattice' }));
    B.slab('stone', L, H + 1, t, [...wins, ...low, { x: 1.8, y: 1, w: 1.7, h: 3.4, kind: 'gothic', frame: true }], cx, -1, cz + W / 2, 0);
    B.box('wood', 1.7, 3.4, 0.14, cx + 1.8, 1.7, cz + W / 2 - 0.5);
    B.slab('stone', L, H + 1, t, [-5, 0, 5].map((x) => ({ x, y: 7, w: 1.2, h: 4, kind: 'gothic', tex: 'stained' })), cx, -1, cz - W / 2, Math.PI);
    // empenas (a oeste, com janela alta; a leste, cega — encosta na menagem)
    B.slab('stone', W - 0.01, H + 1, t, [{ x: 0, y: 7, w: 2.0, h: 5.4, kind: 'gothic', tex: 'stained', seed: 0.42 },
        { x: 0, y: 15.4, w: 1.2, h: 1.2, kind: 'round', tex: 'rose', seed: 0.6 }], cx - L / 2, -1, cz, -Math.PI / 2, { gable: RH });
    B.slab('stone', W - 0.01, H + 1, t, [], cx + L / 2, -1, cz, Math.PI / 2, { gable: RH });
    B.gableRoof(W, RH, L + 1.2, cx, H, cz, Math.PI / 2, { over: 0.8 });
    B.box('block', L + 0.6, 0.3, W + 0.6, cx, H - 0.25, cz);
    // contrafortes com pináculos entre os vitrais
    for (const x of [-8.1, -3.6, 0, 3.6, 8.1]) B.buttress(cx + x, -1, cz + W / 2, 0, 13.2, { pin: true, d: 1.25 });
    for (const x of [-7.5, -2.5, 2.5]) B.buttress(cx + x, -1, cz - W / 2, Math.PI, 12, { d: 1.0 });
    // trapeiras na água sul
    const k = RH / (W / 2);
    for (const x of [-4.6, 0, 4.6]) {
        const dy = 2.3;
        const zs = cz + W / 2 - dy / k;
        B.slab('stone', 1.7, 1.5, 0.3, [{ x: 0, y: 0.25, w: 0.8, h: 1.45, kind: 'gothic', tex: 'lattice', frame: false }], cx + x, H + dy, zs + 0.5, 0, { gable: 1.1 });
        B.box('stone', 1.7, 1.5, 1.6, cx + x, H + dy + 0.75, zs - 0.45);
        B.gableRoof(1.7, 1.1, 2.5, cx + x, H + dy + 1.5, zs - 0.55, 0, { over: 0.22, thick: 0.14 });
    }
    // chaminés
    for (const [x, z] of [[-5.5, -1.6], [3.4, -2.6]]) {
        B.box('stone', 1.0, 4.6, 1.0, cx + x, H + RH - 0.4, cz + z);
        B.box('block', 1.25, 0.25, 1.25, cx + x, H + RH + 1.95, cz + z);
        B.box('block', 0.8, 0.5, 0.8, cx + x, H + RH + 2.3, cz + z);
    }
    B.finial(cx - L / 2 - 0.3, H + RH + 0.1, cz, 0.9);
    // torreta em balanço (guarita) no canto sudoeste
    const bx = cx - L / 2 - 0.1;
    const bz = cz + W / 2 + 0.1;
    B.addUV('stone', xf(lathe([[0.15, 7.6], [0.6, 8.6], [1.1, 9.6], [1.1, 15.2], [1.35, 15.5], [1.6, 15.42]], 14, { rRef: 1.1 }), bx, 0, bz));
    B.addUV('slate', xf(lathe([[1.62, 15.4], [1.25, 15.9], [0.6, 17.4], [0.08, 19.4]], 8, { tex: 2.4, flat: true }), bx, 0, bz));
    B.finial(bx, 19.3, bz, 0.6);
    B.towerWindow(bx, bz, 1.1, 0.5, 11.6, 0.55, 1.4);
    B.towerWindow(bx, bz, 1.1, -1.9, 12.6, 0.55, 1.4);
}

/**
 * Torre de menagem: fuste de 4,6 m de raio, galeria em mísulas, tambor recuado
 * com janelas, agulha facetada de 14 m e a estrela dourada no topo.
 */
function donjon(B, R) {
    const x = 8.5;
    const z = -7;
    const r = 4.6;
    B.addUV('stone', xf(lathe([[r * 1.24, -6], [r * 1.08, 1], [r, 2.4], [r, 28.6], [r + 1.1, 30.4], [r + 1.1, 31.4], [r + 0.72, 31.4], [r + 0.72, 30.5], [0, 30.5]], 36, { rRef: r }), x, 0, z));
    for (const yy of [2.4, 12.2, 21.4, 27.6]) {
        B.addUV('block', xf(lathe([[r + 0.02, yy], [r + 0.22, yy + 0.08], [r + 0.22, yy + 0.32], [r + 0.02, yy + 0.42]], 36, { rRef: r }), x, 0, z));
    }
    B.corbelRing(x, z, r + 0.55, 28.9, { h: 1.0, d: 0.9, pitch: 0.9 });
    B.merlonRing(x, z, r + 0.91, 31.4, { h: 1.0, pitch: 1.8 });
    // tambor recuado
    const r2 = 3.5;
    B.addUV('stone', xf(lathe([[r2, 30.5], [r2, 36.4], [r2 + 0.45, 37.0], [r2 + 0.45, 37.3], [r2 + 1.0, 37.16]], 30, { rRef: r2 }), x, 0, z));
    B.corbelRing(x, z, r2 + 0.25, 36.3, { h: 0.6, d: 0.5 });
    B.addUV('slate', xf(lathe([[r2 + 1.05, 37.14], [r2 + 0.5, 37.9], [r2 * 0.62, 41.4], [r2 * 0.3, 46.4], [0.14, 51.4]], 12, { tex: 2.4, flat: true, rRef: r2 }), x, 0, z, 0.13));
    // lucarnas na agulha (quatro)
    for (let i = 0; i < 4; i++) {
        const a = i * (TAU / 4) + 0.5;
        const rr = 3.5;
        B.slab('stone', 1.0, 1.0, 0.4, [{ x: 0, y: 0.15, w: 0.5, h: 1.05, kind: 'gothic', tex: 'lattice', frame: false, seed: 0.75 }],
            x + Math.sin(a) * rr, 39.0, z + Math.cos(a) * rr, a, { gable: 0.7 });
        B.box('stone', 1.0, 1.0, 1.3, x + Math.sin(a) * (rr - 0.8), 39.5, z + Math.cos(a) * (rr - 0.8), a);
        B.gableRoof(1.0, 0.7, 1.9, x + Math.sin(a) * (rr - 0.75), 40.0, z + Math.cos(a) * (rr - 0.75), a, { over: 0.16, thick: 0.1 });
    }
    // janelas em espiral pelo fuste + coroa de janelas no tambor
    const rnd = seeded(5);
    for (let i = 0; i < 13; i++) {
        const a = 0.25 + i * 0.83;
        const y = 4.6 + i * 1.82;
        B.towerWindow(x, z, r, a, y, 0.9, 2.1, i % 4 === 2 ? 'stained' : 'lattice', 0.15 + rnd() * 0.7);
    }
    for (let i = 0; i < 8; i++) B.towerWindow(x, z, r2, i * (TAU / 8) + 0.2, 32.4, 0.9, 2.6, i % 2 ? 'lattice' : 'stained', 0.55 + rnd() * 0.3);
    const top = B.finial(x, 51.3, z, 1.5);
    R.star.set(x, top + 0.9, z);
    B.flag(x, top - 1.6, z, { pole: 0.4, len: 3.4, hgt: 1.6 });
    // torre da escada, colada à menagem e mais alta que a galeria
    const a = 2.25;
    const sx = x + Math.sin(a) * (r + 0.7);
    const sz = z + Math.cos(a) * (r + 0.7);
    B.tower({
        x: sx, z: sz, r: 1.55, h: 38.2, roof: 5.4, facets: 8, segs: 18, corbels: false, finialScale: 0.7,
        windows: [8, 14, 20, 26, 32, 36].map((y, i) => ({ a: a + (i % 2 ? 0.7 : -0.5), y, w: 0.5, h: 1.3 }))
    });
    R.donjon = { x, z, r, top: top + 0.9, gallery: 31.4 };
}

/** Torre da Lua: esguia, com lanterna envidraçada em balanço e agulha fina. */
function moonTower(B, R) {
    const x = -17.5;
    const z = -9;
    const r = 2.5;
    B.addUV('stone', xf(lathe([[r * 1.24, -6], [r * 1.08, 1], [r, 2.2], [r, 23.2], [r + 0.9, 25.0], [r + 0.9, 29.2], [r + 1.2, 29.6], [r + 1.2, 29.8], [r + 1.7, 29.66]], 28, { rRef: r }), x, 0, z));
    for (const yy of [2.2, 11.4, 20.4]) {
        B.addUV('block', xf(lathe([[r + 0.02, yy], [r + 0.2, yy + 0.08], [r + 0.2, yy + 0.3], [r + 0.02, yy + 0.4]], 28, { rRef: r }), x, 0, z));
    }
    B.corbelRing(x, z, r + 0.45, 23.6, { h: 0.9, d: 0.8, pitch: 0.85 });
    B.addUV('slate', xf(lathe([[r + 1.75, 29.64], [r + 1.1, 30.4], [r * 0.7, 33.4], [r * 0.3, 37.2], [0.1, 40.6]], 10, { tex: 2.4, flat: true, rRef: r }), x, 0, z));
    for (let i = 0; i < 8; i++) B.towerWindow(x, z, r + 0.9, i * (TAU / 8), 25.6, 1.0, 3.0, i % 2 ? 'stained' : 'lattice', 0.35 + i * 0.05);
    const rnd = seeded(8);
    for (let i = 0; i < 8; i++) B.towerWindow(x, z, r, 0.9 + i * 1.1, 4.4 + i * 2.25, 0.7, 1.8, 'lattice', 0.2 + rnd() * 0.6);
    const top = B.finial(x, 40.5, z, 1.1);
    B.flag(x, top - 0.3, z, { len: 2.6, hgt: 1.25 });
    R.moonTower = { x, z, r, top };
}

/**
 * Ponte alta entre a Torre da Lua e a menagem: um único arco abatido,
 *   intradorso y(u) = y_imp + f·(1 − (2u/L)²)        (parábola, flecha f)
 * com parapeito ameado dos dois lados.
 */
function skyBridge(B) {
    const x0 = -15.3;
    const x1 = 4.2;
    const z = -8.2;
    const L = x1 - x0;
    const cx = (x0 + x1) / 2;
    const deck = 24.2;
    const s = new THREE.Shape();
    s.moveTo(-L / 2, 17.2);
    const n = 18;
    for (let i = 1; i <= n; i++) {
        const u = -L / 2 + (i / n) * L;
        s.lineTo(u, 17.2 + 5.6 * (1 - Math.pow((2 * u) / L, 2)));
    }
    s.lineTo(L / 2, deck);
    s.lineTo(-L / 2, deck);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 1.7, bevelEnabled: false });
    g.translate(0, 0, -0.85);
    B.add('stone', xf(g, cx, 0, z));
    B.box('block', L, 0.2, 2.1, cx, deck + 0.02, z);
    for (const sgn of [-1, 1]) {
        B.box('stone', L, 0.85, 0.28, cx, deck + 0.5, z + sgn * 0.9);
        const nm = Math.floor(L / 1.5);
        for (let i = 0; i < nm; i++) {
            B.box('stone', 0.75, 0.55, 0.28, x0 + (i + 0.5) * (L / nm), deck + 1.2, z + sgn * 0.9);
        }
    }
    B.lamp(cx, deck + 1.4, z, 1.1, 0xffb060);
}

/** Capela: rosácea na empena sul, lancetas, abside de meia-volta e agulha (flecha). */
function chapel(B) {
    const cx = 14.6;
    const cz = 9.2;
    const W = 6.4;
    const L = 11;
    const H = 8.6;
    const RH = 5.2;
    B.slab('stone', W, H + 1, 1.0, [{ x: 0, y: 5.4, w: 3.0, h: 3.0, kind: 'round', tex: 'rose', seed: 0.5 },
        { x: 0, y: 1, w: 1.5, h: 2.9, kind: 'gothic', frame: true }], cx, -1, cz + L / 2, 0, { gable: RH });
    B.box('wood', 1.5, 2.9, 0.12, cx, 1.45, cz + L / 2 - 0.45);
    B.slab('stone', W, H + 1, 1.0, [], cx, -1, cz - L / 2, Math.PI, { gable: RH });
    for (const s of [-1, 1]) {
        B.slab('stone', L - 0.01, H + 1, 1.0, [-3.3, 0, 3.3].map((x, i) => ({ x, y: 3.4, w: 1.0, h: 4.0, kind: 'gothic', tex: 'stained', seed: 0.45 + i * 0.05 })),
            cx + s * W / 2, -1, cz, s * Math.PI / 2);
        for (const u of [-5.2, -1.65, 1.65, 5.2]) B.buttress(cx + s * W / 2, -1, cz + u, s * Math.PI / 2, 8.8, { w: 0.8, d: 0.95, pin: Math.abs(u) > 4 });
    }
    B.gableRoof(W, RH, L + 0.9, cx, H, cz, 0, { over: 0.6 });
    // abside: meio cilindro + meia cúpula facetada
    B.addUV('stone', xf(lathe([[3.1, -1], [3.1, 6.6], [3.4, 6.9], [3.6, 6.84]], 14, { phiStart: Math.PI / 2, phiLength: Math.PI, rRef: 3.1 }), cx, 0, cz - L / 2));
    B.addUV('slate', xf(lathe([[3.65, 6.82], [3.2, 7.4], [1.8, 9.6], [0.1, 11.4]], 6, { tex: 2.4, flat: true, phiStart: Math.PI / 2, phiLength: Math.PI }), cx, 0, cz - L / 2));
    for (const a of [Math.PI * 0.75, Math.PI, Math.PI * 1.25]) B.towerWindow(cx, cz - L / 2, 3.1, a, 2.6, 0.8, 3.0, 'stained', 0.5);
    // flecha sobre a cumeeira
    B.addUV('block', xf(lathe([[0.75, 0], [0.75, 1.5], [0.95, 1.6], [0.95, 1.8]], 8, { tex: 1.5, flat: true }), cx, H + RH - 0.6, cz + 1.5, Math.PI / 8));
    B.addUV('slate', xf(lathe([[1.0, 0], [0.7, 0.5], [0.3, 3.4], [0.05, 6.8]], 8, { tex: 2.2, flat: true }), cx, H + RH + 1.15, cz + 1.5, Math.PI / 8));
    B.finial(cx, H + RH + 7.9, cz + 1.5, 0.7);
    B.pinnacle(cx, H + RH - 0.1, cz + L / 2 - 0.4, 0.7);
}

/** Casa da guarda (ala oeste): pedra, empena e chaminé, janelas pequenas acesas. */
function guardHouse(B) {
    const cx = -16.6;
    const cz = 10.4;
    const W = 7;
    const L = 8.4;
    const H = 5.6;
    const RH = 3.9;
    B.slab('stone', W, H + 1, 0.8, [{ x: -1.6, y: 2.4, w: 0.9, h: 1.7, kind: 'gothic', tex: 'lattice' }, { x: 1.6, y: 2.4, w: 0.9, h: 1.7, kind: 'gothic', tex: 'lattice' },
        { x: 0, y: 5.6, w: 0.8, h: 1.5, kind: 'gothic', tex: 'lattice' }], cx, -1, cz + L / 2, 0, { gable: RH });
    B.slab('stone', W, H + 1, 0.8, [], cx, -1, cz - L / 2, Math.PI, { gable: RH });
    B.slab('stone', L - 0.01, H + 1, 0.8, [{ x: -2, y: 2.4, w: 0.9, h: 1.7, kind: 'gothic', tex: 'lattice' }, { x: 1.6, y: 1, w: 1.3, h: 2.6, kind: 'gothic' }], cx + W / 2, -1, cz, Math.PI / 2);
    B.box('wood', 1.3, 2.6, 0.1, cx + W / 2 - 0.35, 1.3, cz + 1.6, Math.PI / 2);
    B.slab('stone', L - 0.01, H + 1, 0.8, [], cx - W / 2, -1, cz, -Math.PI / 2);
    B.gableRoof(W, RH, L + 0.8, cx, H, cz, 0, { over: 0.5, thick: 0.22 });
    B.box('stone', 0.9, 3.4, 0.9, cx - 1.8, H + RH - 0.6, cz - 1.5);
    B.box('block', 1.1, 0.2, 1.1, cx - 1.8, H + RH + 1.15, cz - 1.5);
    B.lamp(cx + W / 2 + 0.5, 3.1, cz + 0.2, 1.2, 0xffa448);
}

// ═══════════════════════════════════════════════════════════════════════════
// Castelo
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {{ tier: string }} o
 * @returns {{ group, glass, flagTime, lamps, anchors, ready, setGlow(k), update(t) }}
 *   anchors (coordenadas locais do castelo): star, donjon, moonTower, gate
 */
export function createCastle({ tier = 'high' } = {}) {
    const B = new Builder(31);
    const R = { star: new THREE.Vector3(), gate: null, donjon: null, moonTower: null };

    // --- muralha: polígono irregular com torres nos vértices ---
    const T = [
        { x: -21, z: 19, r: 3.0, h: 12.6, roof: 6.6, flag: true },
        { x: 19.5, z: 20, r: 3.4, h: 11.2, roof: 0, flag: true },
        { x: 26, z: 5, r: 2.6, h: 13.2, roof: 6.0 },
        { x: 22, z: -13.5, r: 3.0, h: 15.6, roof: 7.6, flag: true },
        { x: 5.5, z: -23.5, r: 2.7, h: 11.6, roof: 0 },
        { x: -15, z: -20.5, r: 3.2, h: 14.2, roof: 7.0 },
        { x: -26, z: -4, r: 2.8, h: 16.8, roof: 8.2, flag: true }
    ];
    const rnd = seeded(3);
    for (const t of T) {
        const out = Math.atan2(t.x, t.z);
        const windows = [
            { a: out + 0.5, y: 4.8 }, { a: out - 0.6, y: 7.4 }, { a: out + 0.1, y: t.h - 3.6, w: 0.7, h: 1.6 },
            { a: out + Math.PI * 0.9, y: 8.6 }
        ].map((w) => ({ ...w, seed: 0.1 + rnd() * 0.8 }));
        B.tower({ ...t, windows, facets: 10 + ((t.r * 10) % 3 | 0) });
    }
    const gl = { x: -5.7, z: 26.3 };
    const gr = { x: 5.7, z: 26.3 };
    const loop = [[T[0], gl], [gr, T[1]], [T[1], T[2]], [T[2], T[3]], [T[3], T[4]], [T[4], T[5]], [T[5], T[6]], [T[6], T[0]]];
    for (const [a, b] of loop) {
        // encurta o lanço para morrer dentro das torres
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        const ra = (a.r ?? 2.3) * 0.6;
        const rb = (b.r ?? 2.3) * 0.6;
        curtain(B, a.x + (dx / len) * ra, a.z + (dz / len) * ra, b.x - (dx / len) * rb, b.z - (dz / len) * rb);
    }
    // braseiros no adarve
    for (const t of [T[1], T[4]]) B.lamp(t.x, t.h + 1.3, t.z, 1.6, 0xff8a30);

    gatehouse(B, R);
    greatHall(B);
    donjon(B, R);
    moonTower(B, R);
    skyBridge(B);
    chapel(B);
    guardHouse(B);

    // --- materiais e malhas fundidas ---
    const mats = makeMaterials();
    const scales = { stone: 3.2, block: 2.6, slate: 2.4, wood: 2, gold: 1, iron: 1, dark: 1 };
    const geos = B.merged(scales);
    const group = new THREE.Group();
    group.name = 'castelo';
    for (const [key, geo] of Object.entries(geos)) {
        const mesh = new THREE.Mesh(geo, mats[key]);
        mesh.name = `castelo:${key}`;
        mesh.castShadow = key !== 'dark';
        mesh.receiveShadow = true;
        group.add(mesh);
    }

    // --- vidros ---
    const glassMat = makeGlassMaterial();
    const glass = new THREE.Mesh(mergeGeometries(B.glass), glassMat);
    glass.name = 'castelo:vidros';
    group.add(glass);
    for (const g of B.glass) g.dispose();

    // --- bandeiras ---
    const flags = makeFlagMesh(B.flags);
    group.add(flags.mesh);

    // --- estrela do topo (malha própria: acende quando a fada a toca) ---
    const starGeo = new THREE.ExtrudeGeometry(starShape(1.25, 0.5, 8), { depth: 0.22, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 1 });
    starGeo.translate(0, 0, -0.11);
    const starMat = new THREE.MeshStandardMaterial({ color: 0xf2c45a, metalness: 1, roughness: 0.22, emissive: 0xffd27a, emissiveIntensity: 0.06 });
    const star = new THREE.Mesh(starGeo, starMat);
    star.position.copy(R.star);
    star.name = 'castelo:estrela';
    group.add(star);

    // --- portão de ferro e porta de madeira (glTF fotogramétrico) ---
    const ready = Promise.all([
        tier === 'low' ? null : loadModel('large_iron_gate', { width: R.gate.width + 0.2 }),
        loadModel('large_castle_door', { width: R.gate.width + 0.1 })
    ]).then(([gate, door]) => {
        for (const m of [gate, door]) {
            m?.traverse((o) => {
                if (o.isMesh) {
                    o.castShadow = false;
                    o.receiveShadow = true;
                }
            });
        }
        if (gate) {
            gate.position.set(0, 0.02, R.gate.z - 0.75);
            group.add(gate);
        }
        if (door) {
            door.position.set(0, 0.02, R.gate.zBack + 0.8);
            group.add(door);
        }
    });

    return {
        group,
        star,
        lamps: B.lamps,
        anchors: R,
        ready,
        /** k ∈ [0, 1]: fração de janelas acesas. */
        setGlow(k) {
            glassMat.uniforms.uGlow.value = k;
        },
        /** Brilho da estrela do topo (0 apagada … 1 acesa). */
        setStar(k) {
            starMat.emissiveIntensity = 0.06 + k * 2.2;
        },
        update(t) {
            flags.time.value = t;
            glassMat.uniforms.uTime.value = t;
            star.rotation.y = t * 0.4;
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Ponte de pedra sobre o lago
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Viaduto de pedra em arcos de volta perfeita, com tabuleiro em rampa.
 *   tabuleiro: y(u) = ay + (by − ay)·u/L
 *   arco i: raio = vão/2, imposta em y(u_i) − folga − raio (nunca abaixo de 0,6 m da água)
 * Pilares descem até `floor` (abaixo do leito), com talha-mares em cunha.
 *
 * @returns {{ group, lamps: Array<{x,y,z,size,color}> }}  (coordenadas de mundo)
 */
export function createStoneBridge({ ax, az, ay, bx, bz, by, floor = -9, width = 4.4, spans = 9 }) {
    const B = new Builder(57);
    const dx = bx - ax;
    const dz = bz - az;
    const L = Math.hypot(dx, dz);
    const ry = Math.atan2(-dz, dx); // +X local → direção A→B
    const deckY = (u) => ay + ((by - ay) * u) / L;
    const pier = 2.3;
    const abut = 4.5;
    const span = (L - 2 * abut - pier * (spans - 1)) / spans;
    const s = new THREE.Shape();
    s.moveTo(0, floor);
    s.lineTo(abut, floor);
    let u = abut;
    for (let i = 0; i < spans; i++) {
        const r = span / 2;
        const ys = Math.max(0.6, deckY(u + r) - 1.25 - r);
        s.lineTo(u, ys);
        s.absarc(u + r, ys, r, Math.PI, 0, true);
        s.lineTo(u + span, floor);
        u += span;
        if (i < spans - 1) {
            s.lineTo(u + pier, floor);
            u += pier;
        }
    }
    s.lineTo(L, floor);
    s.lineTo(L, deckY(L));
    s.lineTo(0, deckY(0));
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: false, curveSegments: 10 });
    g.translate(0, 0, -width / 2);
    B.add('stone', xf(g, ax, 0, az, ry));

    const world = (uu, y, w) => [ax + Math.cos(ry) * uu + Math.sin(ry) * w, y, az - Math.sin(ry) * uu + Math.cos(ry) * w];
    const slope = Math.atan2(by - ay, L);
    // tabuleiro (lajes), cordão e parapeitos acompanham a rampa
    B.box('block', L, 0.22, width + 0.5, ...world(L / 2, deckY(L / 2) + 0.02, 0), ry, 0, slope);
    for (const sgn of [-1, 1]) {
        B.box('stone', L, 1.0, 0.4, ...world(L / 2, deckY(L / 2) + 0.6, sgn * (width / 2 + 0.02)), ry, 0, slope);
        B.box('block', L, 0.14, 0.56, ...world(L / 2, deckY(L / 2) + 1.14, sgn * (width / 2 + 0.02)), ry, 0, slope);
    }
    // talha-mares e lampiões sobre cada pilar
    const lamps = [];
    u = abut + span;
    for (let i = 0; i < spans - 1; i++) {
        const uc = u + pier / 2;
        for (const sgn of [-1, 1]) {
            const [px, , pz] = world(uc, 0, sgn * (width / 2 + 0.2));
            B.addUV('block', xf(lathe([[1.5, floor], [1.5, deckY(uc) - 3.4], [0.2, deckY(uc) - 1.6]], 3, { tex: 2.4, flat: true }), px, 0, pz, ry + (sgn > 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI / 6));
        }
        if (i % 2 === 0) {
            for (const sgn of [-1, 1]) {
                const [lx, ly, lz] = world(uc, deckY(uc) + 1.2, sgn * (width / 2 + 0.02));
                B.addUV('iron', xf(lathe([[0.09, 0], [0.05, 0.2], [0.04, 2.3], [0.16, 2.4], [0.16, 2.44]], 6, { tex: 1 }), lx, ly, lz));
                B.box('iron', 0.34, 0.06, 0.34, lx, ly + 2.98, lz);
                B.addUV('iron', xf(lathe([[0.2, 0], [0.0, 0.22]], 4, { tex: 1, flat: true }), lx, ly + 3.0, lz, Math.PI / 4));
                lamps.push({ x: lx, y: ly + 2.7, z: lz, size: 1.25, color: 0xffb25a });
            }
        }
        u += pier + span;
    }
    const mats = makeMaterials();
    const geos = B.merged({ stone: 3.2, block: 2.6 });
    const group = new THREE.Group();
    group.name = 'ponte';
    for (const [key, geo] of Object.entries(geos)) {
        const mesh = new THREE.Mesh(geo, mats[key]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
    return { group, lamps, length: L, deckY, world };
}

// ═══════════════════════════════════════════════════════════════════════════
// Aldeia distante
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Casario de enxaimel na margem leste: reboco, vigas de madeira, telha de barro,
 * chaminés e janelas acesas; uma igrejinha com torre sineira fecha o conjunto.
 * Fica a ~150–250 m da câmera: a geometria é simples, mas tem empena, beiral e
 * vãos recortados de verdade.
 *
 * @param {Array<{x,y,z,ry,w,l,h,church?}>} houses  (coordenadas de mundo; y = chão)
 * @returns {{ group, lamps }}
 */
export function createHamlet(houses) {
    const B = new Builder(91);
    for (const o of houses) {
        const { x, y, z, ry, w, l, h } = o;
        const c = Math.cos(ry);
        const s = Math.sin(ry);
        const at = (u, v, d) => [x + c * u + s * d, y + v, z - s * u + c * d];
        const rh = w * 0.62;
        const win = (wx, wy) => ({ x: wx, y: wy, w: 0.8, h: 1.0, kind: 'rect', tex: 'house', frame: false, seed: B.rnd() * 0.4 });
        const front = [win(-w * 0.26, 2.3), win(w * 0.26, 2.3)];
        if (h > 4.2) front.push(win(0, 4.6));
        // empenas (frente/fundo) e panos laterais; 1,5 m enterrado para acompanhar o declive
        B.slab(o.church ? 'stone' : 'plaster', w, h + 1.5, 0.35, front, ...at(0, -1.5, l / 2), ry, { gable: rh });
        B.slab(o.church ? 'stone' : 'plaster', w, h + 1.5, 0.35, [win(0, 2.4)], ...at(0, -1.5, -l / 2), ry + Math.PI, { gable: rh });
        const side = [];
        for (let i = 0; i < Math.max(1, Math.round(l / 3.2)); i++) side.push(win(-l / 2 + (i + 0.5) * (l / Math.max(1, Math.round(l / 3.2))), 2.3));
        B.slab(o.church ? 'stone' : 'plaster', l - 0.02, h + 1.5, 0.35, side, ...at(w / 2, -1.5, 0), ry + Math.PI / 2);
        B.slab(o.church ? 'stone' : 'plaster', l - 0.02, h + 1.5, 0.35, side.map((q) => ({ ...q, seed: B.rnd() * 0.4 })), ...at(-w / 2, -1.5, 0), ry - Math.PI / 2);
        B.gableRoof(w, rh, l + 0.9, ...at(0, h, 0), ry, { over: 0.5, thick: 0.2, bucket: 'tile' });
        if (!o.church) {
            // enxaimel: cunhais, frechal e travessas
            for (const sx of [-1, 1]) {
                for (const sz of [-1, 1]) B.box('wood', 0.24, h + 0.2, 0.24, ...at(sx * (w / 2 - 0.02), h / 2, sz * (l / 2 - 0.02)), ry);
                B.box('wood', 0.2, 0.22, l, ...at(sx * (w / 2 + 0.02), h * 0.52, 0), ry);
            }
            for (const sz of [-1, 1]) {
                B.box('wood', w, 0.22, 0.2, ...at(0, h * 0.52, sz * (l / 2 + 0.02)), ry);
                B.box('wood', w, 0.22, 0.2, ...at(0, h, sz * (l / 2 + 0.02)), ry);
            }
            B.box('block', 0.8, rh + 1.6, 0.8, ...at(w * 0.2, h + rh * 0.5, -l * 0.2), ry);
            B.box('wood', 0.9, 1.9, 0.1, ...at(0, 0.95, l / 2 + 0.03), ry);
            B.lamp(...at(0.9, 2.2, l / 2 + 0.5), 0.9, 0xffa040);
        } else {
            // torre sineira com agulha de telha
            const [tx, ty, tz] = at(0, 0, l / 2 + 1.6);
            B.box('stone', 3.2, h + rh + 6, 3.2, tx, ty + (h + rh + 6) / 2 - 1.5, tz, ry);
            B.addUV('tile', xf(lathe([[2.5, 0], [1.9, 0.7], [0.6, 4.6], [0.05, 7.4]], 4, { tex: 2.2, flat: true }), tx, ty + h + rh + 4.4, tz, ry + Math.PI / 4));
            B.finial(tx, ty + h + rh + 11.7, tz, 0.7);
            B.glassPane(0, 0, 0.9, 1.6, 'gothic', 'lattice', (g) => xf(g, ...at(0, h + rh + 1.4, l / 2 + 3.22), ry), 0.2);
            B.lamp(tx, ty + h + rh + 2.2, tz + 1.7, 1.2, 0xffb860);
        }
    }
    const mats = makeMaterials();
    const geos = B.merged({ plaster: 3, tile: 2.2, wood: 2, block: 2.6, stone: 3.2 });
    const group = new THREE.Group();
    group.name = 'aldeia';
    for (const [key, geo] of Object.entries(geos)) {
        const mesh = new THREE.Mesh(geo, mats[key]);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
    }
    const glassMat = makeGlassMaterial();
    glassMat.uniforms.uGlow.value = 1;
    glassMat.uniforms.uGain.value = 1.5;
    if (B.glass.length) group.add(new THREE.Mesh(mergeGeometries(B.glass), glassMat));
    return { group, lamps: B.lamps, glass: glassMat };
}
