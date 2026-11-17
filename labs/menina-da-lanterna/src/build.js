/**
 * A Menina da Lanterna — construções de Vale-da-Bruma (geometria de verdade + PBR).
 *
 * Tudo aqui gera geometria em metros, com UV em escala de mundo, e despeja num
 * `Batch` (uma malha por material para o vale inteiro → poucos draw calls):
 *
 *   addHouse      casa de enxaimel: soco de pedra, paredes com espessura e vãos
 *                 recortados, vigas, janelas com caixilho/folhas, porta, telhado de
 *                 palha ou telha com beiral, caibros e chaminé externa de pedra
 *   addWell       poço de pedra com sarilho e cobertura
 *   addLanternPost poste rústico com braço para a lanterna pendurada
 *   addBridge     ponte de madeira em arco (tabuleiro, longarinas, guarda-corpo)
 *   addWheel      roda-d'água do moinho
 *   brambleGeometry / rootGeometry / archGeometry   sarças, raízes e o oco da árvore
 *
 * Convenção das casas: origem no chão, no centro da planta; frente = +Z; cumeeira ao longo de X.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applyWorldUV, seeded, fbm2 } from '../../shared/gfx/core.js';
import { pbrMaterial } from '../../shared/gfx/assets.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

/** Matriz TRS (rotação em ordem XYZ). */
export function trs(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, out = new THREE.Matrix4()) {
    _e.set(rx, ry, rz, 'YXZ');
    return out.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s);
}

/** Aplica TRS à geometria (encadeável). */
function at(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return geo.applyMatrix4(trs(x, y, z, rx, ry, rz, _m));
}

function clean(g) {
    const o = g.index ? g.toNonIndexed() : g;
    for (const name of Object.keys(o.attributes)) {
        if (name !== 'position' && name !== 'normal' && name !== 'uv') o.deleteAttribute(name);
    }
    if (!o.attributes.normal) o.computeVertexNormals();
    if (!o.attributes.uv) o.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(o.attributes.position.count * 2), 2));
    return o;
}

/** Junta geometrias por material: `add(chave, geometria, matriz?)` e depois `build(materiais)`. */
export class Batch {
    constructor() {
        this.map = new Map();
    }

    add(key, geo, matrix = null) {
        const g = clean(geo);
        if (matrix) g.applyMatrix4(matrix);
        if (!this.map.has(key)) this.map.set(key, []);
        this.map.get(key).push(g);
        return this;
    }

    /** Despeja outro lote dentro deste, transformado por `matrix`. */
    merge(other, matrix) {
        for (const [key, list] of other.map) {
            for (const g of list) this.add(key, g, matrix);
        }
        return this;
    }

    geometry(key) {
        const list = this.map.get(key);
        return list?.length ? mergeGeometries(list, false) : null;
    }

    build(materials, { castShadow = true, receiveShadow = true, name = 'lote' } = {}) {
        const group = new THREE.Group();
        group.name = name;
        for (const [key, list] of this.map) {
            if (!list.length || !materials[key]) continue;
            const mesh = new THREE.Mesh(mergeGeometries(list, false), materials[key]);
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            mesh.name = `${name}:${key}`;
            group.add(mesh);
            for (const g of list) g.dispose();
        }
        return group;
    }
}

let mats = null;
/** Materiais PBR compartilhados (UV em metros: 1 repetição a cada `escala` m, definida na geometria). */
export function materials() {
    if (mats) return mats;
    const gain = (m, k) => {
        m.color.multiplyScalar(k);
        return m;
    };
    mats = {
        plaster: pbrMaterial('plastered_wall_04', { color: 0xe6dcc6, normalScale: 1.1 }),
        plasterB: pbrMaterial('rough_plaster_03', { color: 0xd9cdb4, normalScale: 1.0 }),
        timber: gain(pbrMaterial('dark_wooden_planks', { color: 0xffffff, normalScale: 1.2 }), 1.35),
        planks: gain(pbrMaterial('weathered_brown_planks', { color: 0xffffff }), 1.15),
        oak: pbrMaterial('oak_wood_planks', { color: 0xd8c4a0 }),
        stone: pbrMaterial('medieval_blocks_02', { color: 0xd0cabd, normalScale: 1.3 }),
        slate: pbrMaterial('castle_wall_slates', { color: 0xcfcac0, normalScale: 1.3 }),
        mossy: pbrMaterial('mossy_cobblestone', { color: 0xc8cdbc, normalScale: 1.2 }),
        thatch: gain(pbrMaterial('thatch_roof_angled', { color: 0xffffff, normalScale: 1.6 }), 2.1),
        tiles: pbrMaterial('clay_roof_tiles_02', { color: 0xd8c2b4, normalScale: 1.3 }),
        roofSlate: pbrMaterial('roof_slates_02', { color: 0xc9cdd4, normalScale: 1.2 }),
        bark: gain(pbrMaterial('bark_brown_02', { color: 0xffffff, normalScale: 1.4 }), 1.9),
        iron: new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.55, metalness: 0.85 }),
        rope: new THREE.MeshStandardMaterial({ color: 0x8a7350, roughness: 1 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 1 })
    };
    mats.thatch.side = THREE.DoubleSide;
    for (const m of Object.values(mats)) m.envMapIntensity = 0.7;
    return mats;
}

// ───────────────────────────────────────────────────────────────────────────
// Peças
// ───────────────────────────────────────────────────────────────────────────

let uvSalt = 0;
let lowDetail = false;
/** Tier low: vigas sem chanfro (12 triângulos em vez de ~100). */
export function setLowDetail(v) {
    lowDetail = v;
}
/** Viga chanfrada ao longo de X (veio da madeira corre pelo comprimento). */
export function beam(len, w = 0.14, h = 0.14, uv = 1.5) {
    const r = Math.min(0.014, w * 0.3, h * 0.3);
    const g = lowDetail ? new THREE.BoxGeometry(len, h, w) : new RoundedBoxGeometry(len, h, w, 1, r);
    uvSalt = (uvSalt + 0.37) % 1;
    return applyWorldUV(g, uv, uvSalt);
}

/** Bloco reto com UV de mundo. */
export function slab(w, h, d, uv = 2) {
    return applyWorldUV(new THREE.BoxGeometry(w, h, d), uv);
}

/** Viga entre dois pontos (qualquer direção). */
function beamBetween(a, b, w = 0.12, h = 0.12, uv = 1.5) {
    const d = new THREE.Vector3().subVectors(b, a);
    const len = d.length();
    const g = beam(len, w, h, uv);
    _q.setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize());
    g.applyMatrix4(_m.compose(_p.addVectors(a, b).multiplyScalar(0.5), _q, _s));
    return g;
}

/** Tubo orgânico ao longo de uma curva, com raio variável r(t) e UV em metros. */
export function tube(points, radiusFn, { radial = 8, segs = null, uv = 1.2, wobble = 0, seed = 1 } = {}) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const n = segs ?? Math.max(4, Math.round(curve.getLength() / 0.22));
    const frames = curve.computeFrenetFrames(n, false);
    const pos = [];
    const uvs = [];
    const idx = [];
    const length = curve.getLength();
    const rnd = seeded(seed * 53 + 7);
    const off = rnd() * 10;
    const P = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        curve.getPointAt(t, P);
        const r = radiusFn(t);
        const N = frames.normals[i];
        const B = frames.binormals[i];
        for (let j = 0; j <= radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            const k = 1 + wobble * (fbm2(t * length * 1.7 + off, (j % radial) * 1.3 + off, 2) - 0.5) * 2;
            const cx = Math.cos(a) * r * k;
            const cy = Math.sin(a) * r * k;
            pos.push(P.x + N.x * cx + B.x * cy, P.y + N.y * cx + B.y * cy, P.z + N.z * cx + B.z * cy);
            uvs.push((t * length) / uv, (j / radial) * Math.max(1, Math.round((r * 6.283) / uv)));
        }
    }
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < radial; j++) {
            const a = i * (radial + 1) + j;
            const b = a + radial + 1;
            idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

// ───────────────────────────────────────────────────────────────────────────
// Casa de enxaimel
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parede com espessura e vãos recortados (Shape + furos → ExtrudeGeometry).
 * Coordenadas da parede: x ao longo, y para cima (0 = base), face externa em z = 0.
 */
function wallGeometry(len, h, gable, openings, thick, uv) {
    const s = new THREE.Shape();
    s.moveTo(-len / 2, 0);
    s.lineTo(len / 2, 0);
    s.lineTo(len / 2, h);
    if (gable > 0) s.lineTo(0, h + gable);
    s.lineTo(-len / 2, h);
    s.closePath();
    for (const o of openings) {
        const hole = new THREE.Path();
        hole.moveTo(o.x - o.w / 2, o.y);
        hole.lineTo(o.x - o.w / 2, o.y + o.h);
        hole.lineTo(o.x + o.w / 2, o.y + o.h);
        hole.lineTo(o.x + o.w / 2, o.y);
        hole.closePath();
        s.holes.push(hole);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -thick);
    return applyWorldUV(g, uv, uvSalt);
}

/** Água do telhado: laje com espessura, beiral e (na palha) superfície irregular. Local: x = cumeeira, z = desce a água. */
function roofSlab(len, slope, thick, kind, rnd) {
    const sx = Math.max(6, Math.round(len / 0.6));
    const sz = Math.max(4, Math.round(slope / 0.55));
    const g = new THREE.BoxGeometry(len, thick, slope, sx, 1, sz);
    g.translate(0, thick / 2, slope / 2);
    const pos = g.attributes.position;
    const ox = rnd() * 50;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const top = y > thick * 0.5;
        const t = z / slope;
        if (kind === 'thatch') {
            // palha: barriga suave, topo ondulado, beiral arredondado e desfiado
            y -= 0.07 * Math.sin(Math.PI * t) + 0.05 * Math.sin((x / len + 0.5) * Math.PI);
            if (top) y += (fbm2(x * 1.1 + ox, z * 1.1, 3) - 0.5) * 0.16;
            y -= 0.22 * Math.max(0, t - 0.82) / 0.18 * (top ? 1 : 0.35);
            if (t > 0.99) z += (fbm2(x * 2.3 + ox, 3.1, 2) - 0.5) * 0.22;
            if (Math.abs(x) > len / 2 - 0.01 && top) y -= 0.08;
        } else {
            // telha/ardósia: leve selado de madeiramento antigo
            y -= 0.05 * Math.sin(Math.PI * t) * (0.6 + 0.4 * Math.sin((x / len + 0.5) * Math.PI));
            if (top) y += (fbm2(x * 0.7 + ox, z * 0.7, 2) - 0.5) * 0.04;
        }
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return applyWorldUV(g, kind === 'thatch' ? 1.5 : 2.2, rnd());
}

/**
 * Acrescenta uma casa ao lote.
 *
 * @param {Batch} batch
 * @param {THREE.Matrix4} matrix   posição/rotação no mundo
 * @param {object} o
 *   W, D            planta (m)            H      pé-direito acima do soco      roofH  altura da cumeeira sobre o beiral
 *   roof            'thatch'|'tiles'|'slate'     wall   'plaster'|'plasterB'|'stone'|'slate'
 *   chimney         −1 | 0 | 1  (lado da empena; 0 = sem)       seed
 *   windows         { front, back, side }  quantidades
 * @returns {{ glass: BufferGeometry, windows: Vector3[], door: Vector3, chimneyTop: Vector3|null, ridge: number }}
 *          (posições já no mundo)
 */
export function addHouse(batch, matrix, o = {}) {
    const {
        W = 6.4, D = 5, H = 2.5, roofH = 2.4, roof = 'thatch', wall = 'plaster', chimney = 1, seed = 1,
        plinth = 0.55, frame = true, doorX = 0, shutters = true, thick = wall === 'stone' || wall === 'slate' ? 0.4 : 0.22
    } = o;
    const rnd = seeded(seed * 97 + 3);
    const local = new Batch();
    const glassGeos = [];
    const windowPts = [];
    const y0 = plinth;
    const eave = y0 + H;
    const ridge = eave + roofH;
    const wuv = wall === 'stone' || wall === 'slate' ? 2.4 : 2.6;

    // soco de pedra (afunda 0,5 m para acompanhar o terreno)
    local.add('stone', at(slab(W + 0.16, plinth + 0.5, D + 0.16, 2.2), 0, (plinth - 0.5) / 2, 0));

    // vãos por parede
    const win = (x, w = 0.95, h = 1.05, y = 0.95) => ({ x, y, w, h, kind: 'window' });
    const frontOpen = [{ x: doorX, y: 0, w: 1.05, h: 2.02, kind: 'door' }];
    const wf = o.windows?.front ?? 2;
    // uma janela no meio de cada trecho livre ao lado da porta
    const spans = [[-W / 2 + 0.45, doorX - 0.85], [doorX + 0.85, W / 2 - 0.45]];
    let placed = 0;
    for (const [a, b] of spans) {
        if (b - a >= 1.5 && placed < wf) {
            frontOpen.push(win((a + b) / 2, Math.min(1.0, b - a - 0.6)));
            placed++;
        }
    }
    const backOpen = [];
    const wb = o.windows?.back ?? 1;
    for (let i = 0; i < wb; i++) backOpen.push(win((i - (wb - 1) / 2) * 2.4 + (rnd() - 0.5) * 0.4));
    const gableWin = { x: 0, y: H + 0.16, w: 0.5, h: 0.5, kind: 'window' };
    const sideOpenR = chimney === 1 ? [] : [win(0.2, 0.9), gableWin];
    const sideOpenL = chimney === -1 ? [] : [win(-0.3, 0.9), gableWin];

    const walls = [
        { len: W, gable: 0, open: frontOpen, m: trs(0, y0, D / 2, 0, 0, 0) },
        { len: W, gable: 0, open: backOpen, m: trs(0, y0, -D / 2, 0, Math.PI, 0) },
        { len: D, gable: roofH, open: sideOpenR, m: trs(W / 2, y0, 0, 0, Math.PI / 2, 0) },
        { len: D, gable: roofH, open: sideOpenL, m: trs(-W / 2, y0, 0, 0, -Math.PI / 2, 0) }
    ];

    const tw = 0.16; // largura das vigas
    const proud = 0.035;
    for (const w of walls) {
        const part = new Batch();
        part.add(wall, wallGeometry(w.len, H, w.gable, w.open, thick, wuv));
        const zc = proud - 0.06;
        const bz = (g) => g.translate(0, 0, zc);
        if (frame) {
            // baldrame, frechal, esteios de canto e travessa
            part.add('timber', bz(at(beam(w.len + 0.06, 0.13, tw + 0.04), 0, tw / 2, 0)));
            part.add('timber', bz(at(beam(w.len + 0.06, 0.13, tw), 0, H - tw / 2, 0)));
            for (const sx of [-1, 1]) {
                part.add('timber', bz(at(beam(H, 0.13, tw + 0.03), sx * (w.len / 2 - tw / 2), H / 2, 0, 0, 0, Math.PI / 2)));
            }
            // mãos-francesas nos cantos, quando não há vão no caminho
            for (const sx of [-1, 1]) {
                const x0 = sx * (w.len / 2 - tw);
                const x1 = sx * (w.len / 2 - 1.15);
                const blocked = w.open.some((op) => Math.abs(op.x - (x0 + x1) / 2) < op.w / 2 + 0.55 && op.y < 1.4);
                if (!blocked) {
                    part.add('timber', bz(beamBetween(new THREE.Vector3(x1, tw, 0), new THREE.Vector3(x0, 1.35, 0), 0.12, 0.12)));
                }
            }
            // esteios intermediários onde a parede é longa e cega
            const nPosts = Math.max(0, Math.round(w.len / 1.6) - 1);
            for (let i = 1; i <= nPosts; i++) {
                const x = -w.len / 2 + (i * w.len) / (nPosts + 1);
                if (w.open.some((op) => Math.abs(op.x - x) < op.w / 2 + 0.16)) continue;
                part.add('timber', bz(at(beam(H - tw * 2, 0.12, 0.13), x, H / 2, 0, 0, 0, Math.PI / 2)));
            }
            if (w.gable > 0) {
                // empena: travessa a 55 % e pendural dali até a cumeeira
                const yy = H + w.gable * 0.55;
                part.add('timber', bz(at(beam(w.gable * 0.45 - 0.1, 0.12, 0.13), 0, H + w.gable * 0.775 - 0.05, 0, 0, 0, Math.PI / 2)));
                part.add('timber', bz(at(beam(w.len * 0.45 - 0.1, 0.12, 0.12), 0, yy, 0)));
            }
        }
        for (const op of w.open) {
            const cx = op.x;
            const cy = op.y + op.h / 2;
            if (op.kind === 'door') {
                // marco e verga
                for (const sx of [-1, 1]) {
                    part.add('timber', at(beam(op.h + 0.1, 0.2, 0.15), cx + sx * (op.w / 2 + 0.07), op.h / 2, proud - 0.07, 0, 0, Math.PI / 2));
                }
                part.add('timber', at(beam(op.w + 0.5, 0.22, 0.2), cx, op.h + 0.09, proud - 0.06));
                // folha de tábuas verticais, recuada no vão
                const leaf = at(beam(op.h, 0.06, op.w, 1.1), cx, op.h / 2, -thick * 0.45, 0, 0, Math.PI / 2);
                part.add('planks', leaf);
                for (const hy of [0.42, op.h - 0.42]) {
                    part.add('iron', at(slab(op.w * 0.78, 0.06, 0.02), cx - op.w * 0.08, hy, -thick * 0.45 + 0.04));
                }
                const ring = new THREE.TorusGeometry(0.07, 0.012, 6, 14);
                part.add('iron', at(ring, cx + op.w * 0.3, 1.02, -thick * 0.45 + 0.06));
                // degraus de pedra
                part.add('slate', at(slab(op.w + 0.7, 0.2, 0.55, 1.6), cx, -0.1, 0.3));
                part.add('slate', at(slab(op.w + 1.2, 0.2, 0.5, 1.6), cx, -0.32, 0.72));
            } else {
                // caixilho, pinázios, peitoril, vidro recuado e folhas de madeira
                const fw = 0.08;
                for (const sx of [-1, 1]) {
                    part.add('timber', at(beam(op.h + fw * 2, 0.16, fw), cx + sx * (op.w / 2 + fw / 2), cy, proud - 0.06, 0, 0, Math.PI / 2));
                }
                part.add('timber', at(beam(op.w + fw * 2 + 0.1, 0.18, fw + 0.02), cx, op.y + op.h + fw / 2, proud - 0.05));
                part.add('timber', at(beam(op.w + fw * 2 + 0.22, 0.26, 0.07), cx, op.y - 0.035, proud + 0.01));
                const gz = -thick + 0.05;
                part.add('timber', at(beam(op.h, 0.045, 0.035), cx, cy, gz + 0.02, 0, 0, Math.PI / 2));
                part.add('timber', at(beam(op.w, 0.045, 0.035), cx, cy + op.h * 0.12, gz + 0.02));
                const pane = new THREE.PlaneGeometry(op.w, op.h);
                glassGeos.push(clean(pane).applyMatrix4(trs(cx, cy, gz)).applyMatrix4(w.m).applyMatrix4(matrix));
                windowPts.push(new THREE.Vector3(cx, cy, 0.25).applyMatrix4(w.m).applyMatrix4(matrix));
                if (shutters && op.w > 0.7 && op.h > 0.8) {
                    for (const sx of [-1, 1]) {
                        const sw = op.w / 2;
                        const sh = at(beam(op.h, 0.035, sw, 1.0), 0, 0, 0, 0, 0, Math.PI / 2);
                        sh.applyMatrix4(trs(sx * sw * 0.5, 0, 0, 0, sx * (0.12 + rnd() * 0.25), 0));
                        part.add('planks', sh.applyMatrix4(trs(cx + sx * (op.w / 2 + fw + 0.01), cy, proud + 0.02)));
                    }
                }
            }
        }
        local.merge(part, w.m);
    }

    // telhado: duas águas + caibros aparentes + tábuas de empena + cumeeira
    const og = 0.5; // beiral nas empenas
    const oe = 0.62; // beiral nas fachadas
    const pitch = Math.atan2(roofH, D / 2);
    const slope = Math.hypot(D / 2, roofH) + oe;
    const rt = roof === 'thatch' ? 0.36 : 0.15;
    const rk = roof === 'slate' ? 'roofSlate' : roof;
    const len = W + og * 2;
    for (const s of [0, 1]) {
        const g = roofSlab(len, slope, rt, roof, rnd);
        g.applyMatrix4(trs(0, ridge + 0.02, 0, pitch, s * Math.PI, 0));
        local.add(rk, g);
        const nr = Math.max(4, Math.round(len / 0.85));
        for (let i = 0; i <= nr; i++) {
            const x = -len / 2 + 0.1 + (i * (len - 0.2)) / nr;
            const r = at(beam(slope - 0.04, 0.09, 0.12), 0, -0.07, slope / 2, 0, Math.PI / 2, 0);
            r.applyMatrix4(trs(x, ridge + 0.02, 0, pitch, s * Math.PI, 0));
            local.add('timber', r);
        }
        for (const sx of [-1, 1]) {
            const b = at(beam(slope + 0.05, 0.05, rt + 0.2), 0, rt * 0.3, slope / 2, 0, Math.PI / 2, 0);
            b.applyMatrix4(trs(sx * (len / 2 + 0.01), ridge + 0.02, 0, pitch, s * Math.PI, 0));
            local.add(roof === 'thatch' ? 'timber' : 'planks', b);
        }
    }
    if (roof === 'thatch') {
        // rolo de cumeeira
        const roll = new THREE.CylinderGeometry(0.3, 0.3, len + 0.1, 12, 10);
        const pp = roll.attributes.position;
        for (let i = 0; i < pp.count; i++) {
            const k = 1 + (fbm2(pp.getY(i) * 1.6 + seed, pp.getX(i) * 3 + pp.getZ(i) * 2, 2) - 0.5) * 0.5;
            pp.setXYZ(i, pp.getX(i) * k * 1.25, pp.getY(i), pp.getZ(i) * k * 0.8);
        }
        roll.computeVertexNormals();
        local.add('thatch', at(applyWorldUV(roll, 1.5), 0, ridge + rt * 0.75, 0, 0, 0, Math.PI / 2));
    } else {
        // capas de cumeeira (meias-canas sobrepostas)
        const n = Math.round(len / 0.42);
        for (let i = 0; i < n; i++) {
            const cap = new THREE.CylinderGeometry(0.13, 0.15, 0.48, 8, 1, true, -Math.PI / 2, Math.PI);
            cap.rotateZ(Math.PI / 2);
            applyWorldUV(cap, 1.2);
            local.add(rk, at(cap, -len / 2 + 0.24 + i * 0.42, ridge + rt + 0.03 + (i % 2) * 0.012, 0, 0, 0, 0.03));
        }
    }

    // chaminé externa de pedra na empena
    let chimneyTop = null;
    if (chimney) {
        const cx = chimney * (W / 2 + 0.34);
        const base = slab(0.86, eave + 0.4, 1.5, 2);
        const stack = slab(0.72, ridge + 1.05 - (eave - 0.1), 0.86, 2);
        const jitter = (g, k) => {
            const pp = g.attributes.position;
            for (let i = 0; i < pp.count; i++) {
                const yy = pp.getY(i);
                pp.setXYZ(i, pp.getX(i) * (1 - k * (yy > 0 ? 1 : 0)), yy, pp.getZ(i) * (1 - k * 1.6 * (yy > 0 ? 1 : 0)));
            }
            g.computeVertexNormals();
            return g;
        };
        local.add('slate', at(jitter(base, 0.1), cx, (eave + 0.4) / 2 - 0.2, 0.2));
        local.add('slate', at(jitter(stack, 0.06), cx - chimney * 0.04, (ridge + 1.05 + eave - 0.1) / 2, 0.2));
        local.add('slate', at(slab(0.92, 0.12, 1.02, 1.5), cx - chimney * 0.04, ridge + 1.1, 0.2));
        const pot = new THREE.CylinderGeometry(0.13, 0.17, 0.42, 10, 1, true);
        applyWorldUV(pot, 1);
        local.add('tiles', at(pot, cx - chimney * 0.04, ridge + 1.36, 0.2));
        chimneyTop = new THREE.Vector3(cx - chimney * 0.04, ridge + 1.6, 0.2).applyMatrix4(matrix);
    }

    batch.merge(local, matrix);
    return {
        glass: glassGeos.length ? mergeGeometries(glassGeos, false) : null,
        windows: windowPts,
        door: new THREE.Vector3(doorX, y0 + 1, D / 2 + 1.1).applyMatrix4(matrix),
        chimneyTop,
        ridge,
        W,
        D
    };
}

let glassTex = null;
/** Mapa de emissão das janelas: brilho de fogo ao fundo, cortina e sombra de caixilho. */
function windowTexture() {
    if (glassTex) return glassTex;
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 86, 6, 64, 70, 96);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, '#ffd9a0');
    grad.addColorStop(0.8, '#b86a2c');
    grad.addColorStop(1, '#5a2c12');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    // cortinas recolhidas
    g.fillStyle = 'rgba(70, 30, 14, 0.55)';
    g.beginPath();
    g.moveTo(0, 0);
    g.quadraticCurveTo(34, 40, 10, 128);
    g.lineTo(0, 128);
    g.fill();
    g.beginPath();
    g.moveTo(128, 0);
    g.quadraticCurveTo(94, 40, 118, 128);
    g.lineTo(128, 128);
    g.fill();
    // vidro em losangos
    g.strokeStyle = 'rgba(40, 20, 10, 0.5)';
    g.lineWidth = 1.5;
    for (let i = -128; i < 256; i += 22) {
        g.beginPath();
        g.moveTo(i, 0);
        g.lineTo(i + 128, 128);
        g.moveTo(i + 128, 0);
        g.lineTo(i, 128);
        g.stroke();
    }
    glassTex = new THREE.CanvasTexture(c);
    glassTex.colorSpace = THREE.SRGBColorSpace;
    return glassTex;
}

/** Material de vidraça de uma casa: escuro e espelhado apagado; emissivo quente quando `emissiveIntensity` sobe. */
export function glassMaterial() {
    return new THREE.MeshStandardMaterial({
        color: 0x1a2230, roughness: 0.18, metalness: 0.1, envMapIntensity: 1.2,
        emissive: 0xffa040, emissiveMap: windowTexture(), emissiveIntensity: 0
    });
}

// ───────────────────────────────────────────────────────────────────────────
// Poço
// ───────────────────────────────────────────────────────────────────────────

/** Poço de pedra com sarilho, corda e cobertura de tábuas. Origem no chão. Raio externo ≈ 0,95 m. */
export function addWell(batch, matrix) {
    const local = new Batch();
    const profile = [[0.6, -0.9], [0.6, 0.78], [0.66, 0.9], [0.9, 0.9], [0.95, 0.8], [0.97, -0.4]];
    const seg = 22;
    const pos = [];
    const uv = [];
    const idx = [];
    for (let i = 0; i < profile.length; i++) {
        for (let j = 0; j <= seg; j++) {
            const a = (j / seg) * Math.PI * 2;
            const jit = i >= 2 && i <= 4 ? 1 + (fbm2((j % seg) * 0.9, i * 2.1, 2) - 0.5) * 0.09 : 1;
            const r = profile[i][0] * jit;
            pos.push(Math.cos(a) * r, profile[i][1], Math.sin(a) * r);
            uv.push((a * 0.9) / 1.6, (profile[i][1] + (i === 2 || i === 3 ? profile[i][0] : 0)) / 1.6);
        }
    }
    for (let i = 0; i < profile.length - 1; i++) {
        for (let j = 0; j < seg; j++) {
            const a = i * (seg + 1) + j;
            const b = a + seg + 1;
            idx.push(a, a + 1, b, b, a + 1, b + 1);
        }
    }
    const ring = new THREE.BufferGeometry();
    ring.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    ring.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    ring.setIndex(idx);
    ring.computeVertexNormals();
    local.add('mossy', ring);
    const water = new THREE.CircleGeometry(0.6, 20);
    water.rotateX(-Math.PI / 2);
    local.add('dark', at(water, 0, 0.05, 0));
    // esteios, travessa, sarilho
    for (const s of [-1, 1]) {
        local.add('timber', at(beam(2.5, 0.15, 0.15), s * 1.02, 1.1, 0, 0, 0, Math.PI / 2 + s * 0.02));
        local.add('timber', beamBetween(new THREE.Vector3(s * 1.02, 2.0, 0), new THREE.Vector3(s * 0.55, 2.38, 0), 0.09, 0.09));
    }
    local.add('timber', at(beam(2.5, 0.14, 0.14), 0, 2.36, 0));
    const drum = new THREE.CylinderGeometry(0.1, 0.1, 1.86, 10);
    local.add('oak', at(applyWorldUV(drum, 1), 0, 1.62, 0, 0, 0, Math.PI / 2));
    const crank = new THREE.TorusGeometry(0.18, 0.016, 6, 12, Math.PI * 1.5);
    local.add('iron', at(crank, 1.16, 1.62, 0, 0, Math.PI / 2, 0));
    const rope = new THREE.CylinderGeometry(0.014, 0.014, 0.62, 5);
    local.add('rope', at(rope, 0.1, 1.3, 0));
    const coil = new THREE.CylinderGeometry(0.115, 0.115, 0.32, 10);
    local.add('rope', at(coil, 0.1, 1.62, 0, 0, 0, Math.PI / 2));
    // cobertura de tábuas em duas águas
    for (const s of [0, 1]) {
        const g = at(slab(2.9, 0.05, 1.05, 1.2), 0, 0.025, 0.5);
        g.applyMatrix4(trs(0, 2.98, 0, 0.62, s * Math.PI, 0));
        local.add('planks', g);
    }
    local.add('timber', at(beam(2.96, 0.1, 0.1), 0, 3.0, 0));
    batch.merge(local, matrix);
    return { bucket: new THREE.Vector3(0.1, 0.92, 0).applyMatrix4(matrix) };
}

// ───────────────────────────────────────────────────────────────────────────
// Poste de lanterna (trilha)
// ───────────────────────────────────────────────────────────────────────────

/** Poste torto com braço, mão-francesa e gancho. Devolve o ponto (mundo) onde a lanterna pendura. */
export function addLanternPost(batch, matrix, seed = 1) {
    const rnd = seeded(seed * 31 + 5);
    const local = new Batch();
    const lean = (rnd() - 0.5) * 0.08;
    local.add('timber', at(beam(3.1, 0.16, 0.16), 0, 1.25, 0, 0, 0, Math.PI / 2 + lean));
    local.add('timber', at(beam(1.0, 0.1, 0.11), 0.42, 2.5, 0, 0, 0, 0.06));
    local.add('timber', beamBetween(new THREE.Vector3(0.04, 1.95, 0), new THREE.Vector3(0.6, 2.46, 0), 0.08, 0.08));
    const hook = new THREE.TorusGeometry(0.045, 0.01, 5, 10);
    local.add('iron', at(hook, 0.82, 2.42, 0));
    local.add('iron', at(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 5), 0.82, 2.3, 0));
    // pedras calçando o pé
    for (let i = 0; i < 4; i++) {
        const a = rnd() * 6.28;
        const st = new THREE.IcosahedronGeometry(0.16 + rnd() * 0.08, 1);
        applyWorldUV(st, 0.8);
        local.add('mossy', at(st, Math.cos(a) * 0.22, 0.02, Math.sin(a) * 0.22, rnd(), rnd(), rnd()));
    }
    batch.merge(local, matrix);
    return new THREE.Vector3(0.82, 2.2, 0).applyMatrix4(matrix);
}

// ───────────────────────────────────────────────────────────────────────────
// Ponte de madeira
// ───────────────────────────────────────────────────────────────────────────

export const BRIDGE = { length: 13, width: 2.1, rise: 0.75 };
/** Altura do tabuleiro em arco:  y(x) = rise·(1 − (2x/L)²)  (x local, −L/2..L/2). */
export const bridgeDeckY = (x) => BRIDGE.rise * (1 - (2 * x / BRIDGE.length) ** 2);

/** Ponte em arco ao longo de X local. Devolve um lote próprio (para o material de revelação). */
export function bridgeBatch(seed = 3) {
    const rnd = seeded(seed * 17 + 1);
    const { length: L, width: Wd } = BRIDGE;
    const b = new Batch();
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const n = Math.round(L / 0.24);
    for (let i = 0; i < n; i++) {
        const x = -L / 2 + (i + 0.5) * (L / n);
        const slopeA = Math.atan(-8 * BRIDGE.rise * x / (L * L));
        const g = at(beam(Wd + (rnd() - 0.5) * 0.14, 0.2, 0.06, 1.2), 0, 0, 0, 0, Math.PI / 2, 0);
        b.add('planks', at(g, x, bridgeDeckY(x) + 0.03 + (rnd() - 0.5) * 0.012, (rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.03, slopeA));
    }
    const segs = 10;
    for (const sz of [-1, 1]) {
        for (let i = 0; i < segs; i++) {
            const x0 = -L / 2 + (i * L) / segs;
            const x1 = x0 + L / segs;
            // longarina e corrimão acompanhando o arco
            b.add('timber', beamBetween(P(x0, bridgeDeckY(x0) - 0.14, sz * (Wd / 2 - 0.25)), P(x1, bridgeDeckY(x1) - 0.14, sz * (Wd / 2 - 0.25)), 0.16, 0.24));
            b.add('timber', beamBetween(P(x0, bridgeDeckY(x0) + 1.02, sz * (Wd / 2 - 0.06)), P(x1, bridgeDeckY(x1) + 1.02, sz * (Wd / 2 - 0.06)), 0.11, 0.09));
            b.add('timber', beamBetween(P(x0, bridgeDeckY(x0) + 0.55, sz * (Wd / 2 - 0.06)), P(x1, bridgeDeckY(x1) + 0.55, sz * (Wd / 2 - 0.06)), 0.06, 0.06));
        }
        for (let i = 0; i <= 6; i++) {
            const x = -L / 2 + 0.25 + (i * (L - 0.5)) / 6;
            const tall = i === 0 || i === 6;
            const h = (tall ? 1.5 : 1.12) + 0.9;
            b.add('timber', at(beam(h, 0.13, 0.13), x, bridgeDeckY(x) + h / 2 - 0.9, sz * (Wd / 2 - 0.06), 0, 0, Math.PI / 2));
        }
    }
    // cavaletes de apoio dentro d'água
    for (const x of [-L * 0.22, L * 0.22]) {
        for (const sz of [-1, 1]) {
            b.add('timber', at(beam(2.6, 0.2, 0.2), x, bridgeDeckY(x) - 1.45, sz * (Wd / 2 - 0.3), 0, 0, Math.PI / 2 + sz * 0.0));
        }
        b.add('timber', at(beam(Wd, 0.16, 0.16), x, bridgeDeckY(x) - 0.34, 0, 0, Math.PI / 2, 0));
    }
    return b;
}

// ───────────────────────────────────────────────────────────────────────────
// Roda-d'água
// ───────────────────────────────────────────────────────────────────────────

/** Roda-d'água (raio R, largura w) girando em torno do eixo Z local. Geometria única de madeira. */
export function wheelGeometry(R = 2.3, w = 1.0) {
    const b = new Batch();
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const n = 16;
    for (const sz of [-1, 1]) {
        const z = sz * w * 0.5;
        for (let i = 0; i < n; i++) {
            const a0 = (i / n) * Math.PI * 2;
            const a1 = ((i + 1) / n) * Math.PI * 2;
            for (const r of [R, R * 0.72]) {
                b.add('t', beamBetween(P(Math.cos(a0) * r, Math.sin(a0) * r, z), P(Math.cos(a1) * r, Math.sin(a1) * r, z), 0.1, 0.16));
            }
        }
        for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2;
            b.add('t', beamBetween(P(Math.cos(a) * 0.2, Math.sin(a) * 0.2, z), P(Math.cos(a) * R, Math.sin(a) * R, z), 0.09, 0.12));
        }
    }
    for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * Math.PI * 2;
        const g = at(beam(w + 0.16, 0.04, R * 0.3, 1.1), 0, 0, 0, 0, Math.PI / 2, 0);
        // pá radial: tábua no plano que contém o eixo
        g.applyMatrix4(trs(Math.cos(a) * R * 0.87, Math.sin(a) * R * 0.87, 0, 0, 0, a + Math.PI / 2));
        b.add('t', g);
    }
    const axle = new THREE.CylinderGeometry(0.2, 0.2, w + 1.6, 10);
    b.add('t', at(applyWorldUV(axle, 1.2), 0, 0, -0.5, Math.PI / 2, 0, 0));
    return b.geometry('t');
}

// ───────────────────────────────────────────────────────────────────────────
// Sarças, raízes e o oco
// ───────────────────────────────────────────────────────────────────────────

/** Domo de sarças (raio r): arcos retorcidos + espinhos. Uma geometria. */
export function brambleGeometry(r = 1.05, seed = 7) {
    const rnd = seeded(seed * 41 + 9);
    const geos = [];
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    for (let i = 0; i < 11; i++) {
        const a = (i / 11) * Math.PI * 2 + rnd() * 0.4;
        const b = a + Math.PI * (0.7 + rnd() * 0.6);
        const h = r * (0.75 + rnd() * 0.45);
        const pts = [];
        const steps = 7;
        for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const ang = a + (b - a) * t;
            const rad = r * (1 - 0.55 * Math.sin(Math.PI * t)) * (0.92 + rnd() * 0.16);
            pts.push(P(Math.cos(ang) * rad, Math.sin(Math.PI * t) * h + (rnd() - 0.5) * 0.08 - (k === 0 || k === steps ? 0.12 : 0), Math.sin(ang) * rad));
        }
        const g = tube(pts, (t) => 0.028 + 0.022 * Math.sin(Math.PI * t), { radial: 5, uv: 0.5, wobble: 0.25, seed: seed + i });
        geos.push(clean(g));
        // espinhos
        const curve = new THREE.CatmullRomCurve3(pts);
        for (let k = 0; k < 9; k++) {
            const p = curve.getPointAt(0.08 + rnd() * 0.84);
            const th = new THREE.ConeGeometry(0.014, 0.09, 4);
            th.translate(0, 0.045, 0);
            geos.push(clean(th).applyMatrix4(trs(p.x, p.y, p.z, rnd() * 6, rnd() * 6, rnd() * 6)));
        }
    }
    return mergeGeometries(geos, false);
}

/**
 * Raiz que sai do chão, arqueia e se enrola (berço do broto de luz das raízes do cap. IV).
 * Devolve { geometry, bulb: Vector3 } em coordenadas locais (origem no chão).
 */
export function rootCradle(seed = 1) {
    const rnd = seeded(seed * 71 + 2);
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const geos = [];
    // raiz principal em caracol
    const main = [];
    for (let k = 0; k <= 12; k++) {
        const t = k / 12;
        const a = -1.2 + t * 4.4;
        const rad = 0.75 * (1 - t * 0.72);
        main.push(P(Math.cos(a) * rad - 0.2, -0.3 + Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 0.95 - Math.max(0, t - 0.75) * 0.9, Math.sin(a) * rad));
    }
    geos.push(clean(tube(main, (t) => 0.2 * (1 - t) + 0.045, { radial: 8, uv: 0.9, wobble: 0.18, seed })));
    // raízes menores rastejando
    for (let i = 0; i < 4; i++) {
        const a = rnd() * 6.28;
        const len = 1.2 + rnd() * 1.4;
        const pts = [];
        for (let k = 0; k <= 5; k++) {
            const t = k / 5;
            pts.push(P(Math.cos(a + t * (rnd() - 0.5)) * (0.3 + t * len), 0.14 * Math.sin(Math.PI * t) - 0.1 + (rnd() - 0.5) * 0.05, Math.sin(a + t * (rnd() - 0.5)) * (0.3 + t * len)));
        }
        geos.push(clean(tube(pts, (t) => 0.11 * (1 - t) + 0.02, { radial: 6, uv: 0.9, wobble: 0.2, seed: seed + i + 3 })));
    }
    const end = main[main.length - 1];
    return { geometry: mergeGeometries(geos, false), bulb: P(end.x + 0.02, end.y + 0.3, end.z) };
}

/** Raízes-contraforte de uma árvore gigante: tubos que descem do tronco e mergulham na terra. */
export function buttressRoots(trunkR = 1.6, count = 9, seed = 3, heightFn = () => 0) {
    const rnd = seeded(seed * 13 + 1);
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const geos = [];
    for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + (rnd() - 0.5) * 0.4;
        const len = 4.5 + rnd() * 5;
        const bend = (rnd() - 0.5) * 0.9;
        const pts = [];
        for (let k = 0; k <= 7; k++) {
            const t = k / 7;
            const ang = a + bend * t * t;
            const rad = trunkR * 0.55 + t * len;
            const x = Math.cos(ang) * rad;
            const z = Math.sin(ang) * rad;
            const lift = (1 - t) ** 2 * 2.6 + 0.22 * Math.sin(t * 9 + i) * (1 - t);
            pts.push(P(x, heightFn(x, z) + lift - 0.12 - t * 0.35, z));
        }
        geos.push(clean(tube(pts, (t) => (0.62 * (1 - t) ** 1.4 + 0.09) * (0.8 + rnd() * 0.3), { radial: 9, uv: 1.4, wobble: 0.22, seed: seed + i })));
    }
    return mergeGeometries(geos, false);
}

/** Moldura do oco: duas raízes grossas que se encontram em ogiva. Altura h, vão w. */
export function hollowArch(w = 1.5, h = 2.5, seed = 5) {
    const P = (x, y, z) => new THREE.Vector3(x, y, z);
    const geos = [];
    for (const s of [-1, 1]) {
        const pts = [];
        for (let k = 0; k <= 8; k++) {
            const t = k / 8;
            const x = s * (w / 2 + 0.25) * Math.cos(t * Math.PI * 0.5) ** 0.8;
            pts.push(P(x, -0.3 + (h + 0.5) * Math.sin(t * Math.PI * 0.5), 0.05 * Math.sin(t * 5 + s)));
        }
        geos.push(clean(tube(pts, (t) => 0.3 * (1 - t * 0.55), { radial: 9, uv: 1.2, wobble: 0.2, seed: seed + s })));
    }
    return mergeGeometries(geos, false);
}

/** Miolo luminoso do oco (ogiva). */
export function hollowCore(w = 1.5, h = 2.5) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.quadraticCurveTo(w / 2, h * 0.7, 0, h);
    s.quadraticCurveTo(-w / 2, h * 0.7, -w / 2, 0);
    return new THREE.ShapeGeometry(s, 10);
}
