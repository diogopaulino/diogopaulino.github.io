/**
 * Jurassic — utilitários de modelagem procedural (malhas com normais suaves).
 *
 * Tudo aqui devolve BufferGeometry indexada, com normal e UV, pronta para
 * `mergeGeometries`. Nada de primitiva crua à vista: as peças do parque e do
 * jipe são lofts (anéis ligados), tubos ao longo de curvas e caixas chanfradas.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** Aplica translação/rotação/escala e devolve a própria geometria. */
export function xf(g, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
    g.applyMatrix4(_m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)));
    return g;
}

/** Caixa com arestas arredondadas (raio r). */
export function rbox(w, h, d, r = 0.03, seg = 3) {
    return new RoundedBoxGeometry(w, h, d, Math.min(seg, 2), Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}

/**
 * Loft: liga anéis fechados de mesmo número de pontos.
 * @param {Array<Array<[number,number,number]>>} rings  anéis em ordem; cada ponto [x, y, z]
 * @param {{capStart?:boolean, capEnd?:boolean, uvScale?:number}} [o]
 * UV: u = comprimento de arco ao redor do anel / uvScale, v = distância acumulada entre anéis / uvScale.
 */
export function loft(rings, { capStart = true, capEnd = true, uvScale = 1 } = {}) {
    const n = rings[0].length;
    const pos = [];
    const uv = [];
    const idx = [];
    let v = 0;
    for (let r = 0; r < rings.length; r++) {
        const ring = rings[r];
        if (r > 0) {
            const a = rings[r - 1][0];
            const b = ring[0];
            v += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        }
        let u = 0;
        for (let i = 0; i <= n; i++) {
            const p = ring[i % n];
            if (i > 0) {
                const q = ring[i - 1];
                u += Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
            }
            pos.push(p[0], p[1], p[2]);
            uv.push(u / uvScale, v / uvScale);
        }
    }
    const row = n + 1;
    for (let r = 0; r < rings.length - 1; r++) {
        for (let i = 0; i < n; i++) {
            const a = r * row + i;
            const b = a + 1;
            const c = a + row;
            const d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
    }
    const cap = (ring, flip) => {
        const base = pos.length / 3;
        let cx = 0;
        let cy = 0;
        let cz = 0;
        for (const p of ring) {
            cx += p[0];
            cy += p[1];
            cz += p[2];
        }
        cx /= n;
        cy /= n;
        cz /= n;
        pos.push(cx, cy, cz);
        uv.push(0.5, 0.5);
        for (const p of ring) {
            pos.push(p[0], p[1], p[2]);
            uv.push(0.5 + (p[0] - cx) / uvScale, 0.5 + (p[2] - cz + p[1] - cy) / uvScale);
        }
        for (let i = 0; i < n; i++) {
            const a = base + 1 + i;
            const b = base + 1 + ((i + 1) % n);
            if (flip) idx.push(base, a, b);
            else idx.push(base, b, a);
        }
    };
    if (capStart) cap(rings[0], false);
    if (capEnd) cap(rings[rings.length - 1], true);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    fixSeam(g, rings.length, row);
    return g;
}

/** Iguala as normais da costura (primeiro e último vértice de cada anel). */
function fixSeam(g, rings, row) {
    const nr = g.attributes.normal;
    for (let r = 0; r < rings; r++) {
        const a = r * row;
        const b = a + row - 1;
        const x = nr.getX(a) + nr.getX(b);
        const y = nr.getY(a) + nr.getY(b);
        const z = nr.getZ(a) + nr.getZ(b);
        const l = Math.hypot(x, y, z) || 1;
        nr.setXYZ(a, x / l, y / l, z / l);
        nr.setXYZ(b, x / l, y / l, z / l);
    }
}

/**
 * Anel superelíptico no plano XZ (y constante):  |x/a|^e + |z/b|^e = 1.
 * e = 2 círculo/elipse · e = 4–6 quadrado de cantos arredondados.
 */
export function ringXZ(y, a, b, n = 20, e = 2, cx = 0, cz = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const c = Math.cos(t);
        const s = Math.sin(t);
        out.push([cx + a * Math.sign(c) * Math.abs(c) ** (2 / e), y, cz + b * Math.sign(s) * Math.abs(s) ** (2 / e)]);
    }
    return out;
}

/** Anel superelíptico no plano XY (z constante), centrado em (cx, cy). */
export function ringXY(z, a, b, n = 20, e = 2, cx = 0, cy = 0) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const c = Math.cos(t);
        const s = Math.sin(t);
        // sentido horário visto de +Z: com z crescente as faces do loft apontam para fora
        out.push([cx + a * Math.sign(c) * Math.abs(c) ** (2 / e), cy - b * Math.sign(s) * Math.abs(s) ** (2 / e), z]);
    }
    return out;
}

/** Coluna/poste: lista de [y, meiaLarguraX, meiaLarguraZ, expoente?, cx?, cz?] → loft vertical. */
export function column(stations, n = 16, opts) {
    return loft(stations.map(([y, a, b, e = 4, cx = 0, cz = 0]) => ringXZ(y, a, b, n, e, cx, cz)), opts);
}

/** Tubo ao longo de pontos (Catmull-Rom). `tension` 0 = quase reto entre pontos. */
export function pipe(points, radius = 0.03, radial = 8, tubular = null, closed = false, tension = 0.5) {
    const pts = points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])));
    if (pts.length === 2) {
        const len = pts[0].distanceTo(pts[1]);
        const g = new THREE.CylinderGeometry(radius, radius, len, radial, 1, false);
        g.translate(0, len / 2, 0);
        _q.setFromUnitVectors(_p.set(0, 1, 0), _s.copy(pts[1]).sub(pts[0]).normalize());
        g.applyMatrix4(_m.makeRotationFromQuaternion(_q).setPosition(pts[0]));
        return g;
    }
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', tension);
    return new THREE.TubeGeometry(curve, tubular ?? Math.max(4, pts.length * 5), radius, radial, closed);
}

/** Sólido de revolução em torno de Y a partir de [raio, y]. */
export function lathe(profile, seg = 32) {
    const g = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg);
    g.computeVertexNormals();
    return g;
}

/** Funde geometrias (descarta atributos que não existem em todas). */
export function merge(list) {
    const flat = list.filter(Boolean).map((g) => {
        const out = g.index ? g : g.clone();
        for (const name of Object.keys(out.attributes)) {
            if (name !== 'position' && name !== 'normal' && name !== 'uv') out.deleteAttribute(name);
        }
        if (!out.attributes.uv) {
            out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
        }
        if (!out.attributes.normal) out.computeVertexNormals();
        return out.index ? out : indexed(out);
    });
    const g = mergeGeometries(flat, false);
    for (const f of flat) f.dispose();
    return g;
}

function indexed(g) {
    const n = g.attributes.position.count;
    const idx = new Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    g.setIndex(idx);
    return g;
}

/** Mesh com sombra ligada. */
export function mesh(geometry, material, { cast = true, receive = true, name = '' } = {}) {
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    if (name) m.name = name;
    return m;
}

/** Textura de canvas em sRGB, com mipmaps e anisotropia. */
export function canvasTexture(w, h, draw, { repeat = false } = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
}
