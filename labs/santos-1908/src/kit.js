/**
 * kit — materiais PBR do lab e ajudantes de modelagem.
 *
 * Batch: junta geometrias por material e funde tudo no final (1 draw call por
 * material por módulo). Cada peça entra já posicionada, com UV em metros
 * (applyWorldUV) e cor de vértice, então o custo de cena fica previsível.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { pbr } from '../../shared/gfx/textures.js';
import { applyWorldUV, paint, normalizeForMerge } from '../../shared/gfx/core.js';

export function createMats() {
    const std = (color, roughness = 0.7, metalness = 0, extra = {}) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, vertexColors: true, ...extra });
    return {
        brick: pbr('brick', { vertexColors: true }),
        ashlar: pbr('ashlar', { vertexColors: true }),
        cobble: pbr('cobble', { vertexColors: true }),
        // 'plasterOld' do kit fica manchado demais à distância; usamos o reboco limpo tingido
        plaster: pbr('plaster', { vertexColors: true }),
        plasterClean: pbr('plaster', { vertexColors: true }),
        roof: pbr('roofTile', { vertexColors: true }),
        wood: pbr('woodPlanks', { vertexColors: true }),
        hull: pbr('hull', { vertexColors: true, metalness: 0.25, side: THREE.DoubleSide }),
        steel: pbr('hull', { vertexColors: true, metalness: 0.3 }),
        zinc: pbr('corrugated', { vertexColors: true, metalness: 0.55, side: THREE.DoubleSide }),
        burlap: pbr('burlap', { vertexColors: true }),
        canvas: pbr('cloth', { vertexColors: true, side: THREE.DoubleSide }),
        earth: pbr('earth', { vertexColors: true }),
        rock: pbr('rock', { vertexColors: true }),
        iron: std(0xffffff, 0.55, 0.65),
        paint: std(0xffffff, 0.6, 0.05),
        brass: std(0xffffff, 0.32, 0.9),
        glass: std(0xffffff, 0.12, 0.35, { envMapIntensity: 1.4 }),
        rope: std(0xffffff, 0.95, 0),
        glow: new THREE.MeshStandardMaterial({ color: 0x2a2014, emissive: 0xffb45a, emissiveIntensity: 0.22, roughness: 0.4 })
    };
}

export class Batch {
    constructor(mats) {
        this.mats = mats;
        this.bins = new Map();
    }

    /**
     * @param {string} key      material (chave de createMats)
     * @param {THREE.BufferGeometry} geo  já em coordenadas finais do grupo
     * @param {number} [color]  cor de vértice (tinge o mapa)
     * @param {number} [uv]     escala do UV de mundo em metros (0 = mantém UV próprio)
     */
    add(key, geo, color = 0xffffff, uv = 0) {
        if (!geo) return this;
        if (uv > 0) applyWorldUV(geo, uv);
        if (!geo.attributes.color) paint(geo, color);
        if (!this.bins.has(key)) this.bins.set(key, []);
        this.bins.get(key).push(geo);
        return this;
    }

    build(parent, { cast = true, receive = true, name = 'batch' } = {}) {
        const group = parent || new THREE.Group();
        for (const [key, list] of this.bins) {
            const merged = mergeGeometries(normalizeForMerge(list));
            list.forEach((g) => g.dispose());
            if (!merged) continue;
            merged.computeBoundingSphere();
            const mesh = new THREE.Mesh(merged, this.mats[key]);
            mesh.castShadow = cast;
            mesh.receiveShadow = receive;
            mesh.name = `${name}:${key}`;
            group.add(mesh);
        }
        this.bins.clear();
        return group;
    }
}

// ---------- geometria ----------
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

/** Caixa com base em y (não centrada em Y). */
export function box(w, h, d, x = 0, y = 0, z = 0, ry = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return g;
}

/** Caixa chanfrada (base em y). */
export function rbox(w, h, d, x = 0, y = 0, z = 0, r = 0.06, ry = 0) {
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
    g.translate(0, h / 2, 0);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return g;
}

/** Cilindro/tronco de cone com base em y. */
export function cyl(r0, r1, h, x = 0, y = 0, z = 0, seg = 12, open = false) {
    const g = new THREE.CylinderGeometry(r1, r0, h, seg, 1, open);
    g.translate(x, y + h / 2, z);
    return g;
}

/** Barra cilíndrica entre dois pontos. */
export function bar(a, b, r = 0.05, seg = 6, r2 = r) {
    const d = _v.subVectors(b, a);
    const len = d.length();
    const g = new THREE.CylinderGeometry(r2, r, len, seg, 1);
    _q.setFromUnitVectors(UP, d.clone().normalize());
    _m.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), _q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(_m);
    return g;
}

export const P = (x, y, z) => new THREE.Vector3(x, y, z);

/** Cabo em catenária entre dois pontos (flecha `sag`). */
export function cable(a, b, sag = 1, r = 0.04, n = 8) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        p.y -= Math.sin(t * Math.PI) * sag;
        pts.push(p);
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), n, r, 5, false);
}

/** Torneado: perfil [[raio, y], …]. */
export function lathe(profile, seg = 16, x = 0, y = 0, z = 0) {
    const g = new THREE.LatheGeometry(profile.map(([r, yy]) => new THREE.Vector2(r, yy)), seg);
    g.translate(x, y, z);
    return g;
}

export function xform(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, s = 1) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(s, s, s));
    g.applyMatrix4(_m);
    return g;
}

/**
 * Telhado de duas águas. Cumeeira ao longo de Z (ou X se ridgeX).
 * UV: u = ao longo da cumeeira, v = descida da água (telha capa-canal corre para o beiral).
 * Retorna { roof, gables } — empenas vão no material da parede.
 */
export function gableRoof(span, len, rise, over = 0.6, ridgeX = false) {
    const hs = span / 2 + over;
    const hl = len / 2 + over;
    const slope = Math.hypot(hs, rise * (hs / (span / 2)));
    const yEave = -rise * (over / (span / 2));
    const pos = [];
    const uv = [];
    const quad = (a, b, c, d, uvs) => {
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
        uv.push(...uvs[0], ...uvs[1], ...uvs[2], ...uvs[0], ...uvs[2], ...uvs[3]);
    };
    const U = (2 * hl) / 2.4;
    const Vv = slope / 2.4;
    // água +X
    quad([0, rise, -hl], [0, rise, hl], [hs, yEave, hl], [hs, yEave, -hl], [[0, 0], [U, 0], [U, Vv], [0, Vv]]);
    // água −X
    quad([0, rise, hl], [0, rise, -hl], [-hs, yEave, -hl], [-hs, yEave, hl], [[0, 0], [U, 0], [U, Vv], [0, Vv]]);
    const roof = new THREE.BufferGeometry();
    roof.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    roof.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    roof.computeVertexNormals();
    const gp = [];
    const h2 = span / 2;
    const l2 = len / 2;
    gp.push(-h2, 0, l2, h2, 0, l2, 0, rise, l2, h2, 0, -l2, -h2, 0, -l2, 0, rise, -l2);
    const gables = new THREE.BufferGeometry();
    gables.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    gables.computeVertexNormals();
    if (ridgeX) {
        roof.rotateY(Math.PI / 2);
        gables.rotateY(Math.PI / 2);
    }
    return { roof, gables };
}

/** Telhado de quatro águas (sobrados). UV por água, como acima. */
export function hipRoof(w, d, rise, over = 0.45) {
    const hw = w / 2 + over;
    const hd = d / 2 + over;
    const ridge = Math.max(0, (w - d) / 2);
    const pos = [];
    const uv = [];
    const tri = (a, b, c, ua, ub, uc) => {
        pos.push(...a, ...b, ...c);
        uv.push(...ua, ...ub, ...uc);
    };
    const s = 2.4;
    const A = [-hw, 0, hd];
    const B = [hw, 0, hd];
    const C = [hw, 0, -hd];
    const D = [-hw, 0, -hd];
    const R0 = [-ridge, rise, 0];
    const R1 = [ridge, rise, 0];
    const sl = Math.hypot(hd, rise) / s;
    // frente e fundo (trapézios)
    tri(A, B, R1, [0, sl], [(2 * hw) / s, sl], [(hw + ridge) / s, 0]);
    tri(A, R1, R0, [0, sl], [(hw + ridge) / s, 0], [(hw - ridge) / s, 0]);
    tri(C, D, R0, [0, sl], [(2 * hw) / s, sl], [(hw + ridge) / s, 0]);
    tri(C, R0, R1, [0, sl], [(hw + ridge) / s, 0], [(hw - ridge) / s, 0]);
    // laterais (triângulos)
    tri(B, C, R1, [0, sl], [(2 * hd) / s, sl], [hd / s, 0]);
    tri(D, A, R0, [0, sl], [(2 * hd) / s, sl], [hd / s, 0]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
}

/** Placa com texto (canvas) — numeração de armazém, nome do navio, letreiros. */
export function signTexture(text, { w = 256, h = 128, bg = '#e9e2cf', fg = '#1c1a17', font = 'bold 84px Georgia, serif', border = true } = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (bg) {
        g.fillStyle = bg;
        g.fillRect(0, 0, w, h);
    }
    if (border) {
        g.strokeStyle = fg;
        g.lineWidth = 6;
        g.strokeRect(6, 6, w - 12, h - 12);
    }
    g.fillStyle = fg;
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
}

export function signMesh(text, width, height, opts = {}) {
    const tex = signTexture(text, opts);
    const m = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8, transparent: !opts.bg && opts.bg !== undefined, alphaTest: opts.bg ? 0 : 0.4 })
    );
    return m;
}

const _im = new THREE.Matrix4();
const _ip = new THREE.Vector3();
const _iq = new THREE.Quaternion();
const _is = new THREE.Vector3();
const _ie = new THREE.Euler();
/** InstancedMesh a partir de [{x,y,z,ry,rx,rz,s,sx,sy,sz}]. */
export function instances(geo, mat, list, { cast = true, receive = true, colors = null } = {}) {
    // material com vertexColors exige o atributo (sem ele o WebGL lê preto)
    if (mat.vertexColors && !geo.attributes.color) paint(geo, 0xffffff);
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const col = new THREE.Color();
    list.forEach((p, i) => {
        _ip.set(p.x, p.y || 0, p.z);
        _ie.set(p.rx || 0, p.ry || 0, p.rz || 0);
        _iq.setFromEuler(_ie);
        const s = p.s ?? 1;
        _is.set(p.sx ?? s, p.sy ?? s, p.sz ?? s);
        _im.compose(_ip, _iq, _is);
        mesh.setMatrixAt(i, _im);
        if (colors || p.c !== undefined) mesh.setColorAt(i, col.set(p.c ?? colors[i % colors.length]));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    mesh.computeBoundingSphere();
    return mesh;
}
