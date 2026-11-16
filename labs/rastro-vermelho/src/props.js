/**
 * Construções e adereços de faroeste modelados por peças (tábuas, ripas, caibros,
 * colunas, telhas de madeira) e fundidos por material — cada povoado custa poucos
 * draw calls. Tudo em coordenadas locais do povoado (three: +Z₃ = sul, de onde o
 * cavaleiro chega); `gy(x, z)` devolve a altura local do terreno para apoiar as peças.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyWorldUV, place, seeded } from '../../shared/gfx/core.js';
import { pbr, textureSet } from '../../shared/gfx/textures.js';

export function createMaterials() {
    const M = {
        planks: pbr('woodPlanks', { color: 0xd0bb9c, roughness: 0.95, normalScale: 1.4 }),
        darkWood: pbr('woodPlanks', { color: 0x7a6048, roughness: 0.9, normalScale: 1.2 }),
        paint: pbr('woodPlanks', { color: 0x8f4a38, roughness: 0.88, normalScale: 1.1 }),
        cream: pbr('woodPlanks', { color: 0xc9bfa2, roughness: 0.9, normalScale: 1.0 }),
        shingle: pbr('woodPlanks', { color: 0x4d4238, roughness: 1, normalScale: 2.2 }),
        stone: pbr('rock', { color: 0xb3a590, roughness: 1, normalScale: 1.6 }),
        canvas: pbr('burlap', { color: 0xe9dcc0, roughness: 0.95, side: THREE.DoubleSide, normalScale: 0.7 }),
        blanket: pbr('cloth', { color: 0x9a3528, roughness: 0.95 }),
        bark: pbr('barkTree', { color: 0x8d7a66, roughness: 1, normalScale: 1.5 }),
        iron: new THREE.MeshStandardMaterial({ color: 0x2c2a28, roughness: 0.55, metalness: 0.85 }),
        rust: pbr('corrugated', { color: 0x8a5a40, roughness: 0.8, metalness: 0.5 }),
        rope: new THREE.MeshStandardMaterial({ color: 0x8c7650, roughness: 1 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.15, metalness: 0.2, emissive: 0xffa540, emissiveIntensity: 0.5 }),
        dark: new THREE.MeshStandardMaterial({ color: 0x0b0907, roughness: 1 }),
        ember: new THREE.MeshStandardMaterial({ color: 0x1a0c06, roughness: 1, emissive: 0xff5a14, emissiveIntensity: 3 }),
        char: new THREE.MeshStandardMaterial({ color: 0x1c1613, roughness: 1 })
    };
    // escala das UVs de mundo (m por repetição) de cada material
    M.uv = new Map([[M.planks, 1.6], [M.darkWood, 1.6], [M.paint, 1.6], [M.cream, 1.6], [M.shingle, 0.9], [M.stone, 1.4], [M.canvas, 0.7], [M.blanket, 0.5], [M.bark, 0.8], [M.rust, 0.6]]);
    return M;
}

/** Acumula geometrias por material e funde tudo no final. */
export class Batch {
    constructor(M) { this.M = M; this.by = new Map(); }
    add(mat, geo) {
        if (!this.by.has(mat)) this.by.set(mat, []);
        this.by.get(mat).push(geo);
        return geo;
    }
    box(mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) { return this.add(mat, place(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz)); }
    cyl(mat, rt, rb, h, x, y, z, rx = 0, ry = 0, rz = 0, seg = 12) { return this.add(mat, place(new THREE.CylinderGeometry(rt, rb, h, seg), x, y, z, rx, ry, rz)); }
    /** Viga entre dois pontos (seção w×w). */
    beam(mat, ax, ay, az, bx, by, bz, w = 0.1) {
        const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz);
        const g = new THREE.BoxGeometry(w, a.distanceTo(b), w);
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
        g.applyQuaternion(q);
        const c = a.add(b).multiplyScalar(0.5);
        g.translate(c.x, c.y, c.z);
        return this.add(mat, g);
    }
    build({ castShadow = true } = {}) {
        const group = new THREE.Group();
        for (const [mat, list] of this.by) {
            const norm = list.map((g) => {
                const out = g.index ? g.toNonIndexed() : g;
                for (const name of Object.keys(out.attributes)) if (name !== 'position' && name !== 'normal') out.deleteAttribute(name);
                return out;
            });
            const geo = mergeGeometries(norm, false);
            applyWorldUV(geo, this.M.uv.get(mat) || 1);
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = castShadow && mat !== this.M.glass && mat !== this.M.ember;
            mesh.receiveShadow = true;
            group.add(mesh);
        }
        return group;
    }
}

/** Letreiro pintado à mão: fundo creme gasto, moldura e letras serifadas. */
function signTexture(label) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#d8c9a3'; g.fillRect(0, 0, 512, 128);
    const rnd = seeded(label.length * 31 + label.charCodeAt(0));
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${60 + rnd() * 60},${40 + rnd() * 40},${20 + rnd() * 30},${rnd() * 0.08})`; g.fillRect(rnd() * 512, rnd() * 128, 1 + rnd() * 60, 1 + rnd() * 2); }
    g.strokeStyle = '#5a2d1e'; g.lineWidth = 6; g.strokeRect(9, 9, 494, 110);
    g.lineWidth = 2; g.strokeRect(18, 18, 476, 92);
    g.fillStyle = '#3a1e14'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let size = 66;
    do { g.font = `bold ${size}px Georgia, "Times New Roman", serif`; size -= 4; } while (g.measureText(label).width > 430 && size > 20);
    g.fillText(label, 256, 68);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    return t;
}

/**
 * Casa de tábua-e-ripa com fachada falsa, alpendre, telhado de duas águas e letreiro.
 * Frente em +Z. Retorna os extras não fundíveis (letreiro) como meshes em `out`.
 */
export function building(B, out, gy, { x, z, w, d, label, trim = 'darkWood', body = 'planks', falseFront = true, chimney = true }) {
    const M = B.M, y0 = gy(x, z), fl = y0 + 0.4, H = 2.9, t = 0.12, pitch = 0.52;
    const body_ = M[body], trim_ = M[trim];
    B.box(M.stone, w + 0.5, 0.7, d + 0.5, x, y0 + 0.05, z);
    // paredes
    B.box(body_, w, H, t, x, fl + H / 2, z - d / 2);
    B.box(body_, w, H, t, x, fl + H / 2, z + d / 2);
    for (const s of [-1, 1]) B.box(body_, t, H, d, x + s * w / 2, fl + H / 2, z);
    // ripas mata-junta + cunhais
    for (let bx = -w / 2 + 0.42; bx < w / 2 - 0.2; bx += 0.42) { B.box(body_, 0.05, H, 0.03, x + bx, fl + H / 2, z + d / 2 + t / 2 + 0.012); B.box(body_, 0.05, H, 0.03, x + bx, fl + H / 2, z - d / 2 - t / 2 - 0.012); }
    for (let bz = -d / 2 + 0.42; bz < d / 2 - 0.2; bz += 0.42) for (const s of [-1, 1]) B.box(body_, 0.03, H, 0.05, x + s * (w / 2 + t / 2 + 0.012), fl + H / 2, z + bz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box(trim_, 0.16, H + 0.1, 0.16, x + sx * w / 2, fl + H / 2, z + sz * d / 2);
    B.box(trim_, w + 0.2, 0.14, 0.2, x, fl + 0.07, z + d / 2);
    // telhado de duas águas (cumeeira ao longo de Z) + empenas
    const rise = Math.tan(pitch) * (w / 2);
    const slab = (w / 2 + 0.4) / Math.cos(pitch);
    // o beiral só avança nos fundos: na frente o telhado morre atrás da fachada falsa
    const rl = falseFront ? d + 0.35 : d + 0.7, rz = falseFront ? z - 0.2 : z;
    for (const s of [-1, 1]) B.box(M.shingle, slab, 0.09, rl, x + s * (w / 4 + 0.06), fl + H + rise / 2 + 0.03, rz, 0, 0, -s * pitch);
    B.box(trim_, 0.14, 0.12, rl + 0.04, x, fl + H + rise + 0.06, rz);
    const gable = new THREE.Shape([new THREE.Vector2(-w / 2, 0), new THREE.Vector2(w / 2, 0), new THREE.Vector2(0, rise)]);
    for (const sz of [-1, 1]) B.add(body_, place(new THREE.ExtrudeGeometry(gable, { depth: t, bevelEnabled: false }), x, fl + H, z + sz * d / 2 - t / 2));
    const fz = z + d / 2 + t / 2;
    if (falseFront) {
        // fachada falsa: platibanda acima do telhado, cornija e frontão
        const fh = rise + 0.75;
        B.box(body_, w + 0.1, fh, t, x, fl + H + fh / 2, fz + 0.02);
        for (let bx = -w / 2 + 0.42; bx < w / 2 - 0.2; bx += 0.42) B.box(body_, 0.05, fh, 0.03, x + bx, fl + H + fh / 2, fz + 0.09);
        B.box(trim_, w + 0.5, 0.16, 0.36, x, fl + H + fh + 0.08, fz + 0.05);
        B.box(trim_, w + 0.3, 0.1, 0.24, x, fl + H + fh - 0.12, fz + 0.06);
        B.box(trim_, w * 0.42, 0.34, 0.2, x, fl + H + fh + 0.33, fz + 0.03);
        B.box(trim_, w * 0.48, 0.1, 0.3, x, fl + H + fh + 0.55, fz + 0.04);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.66, w * 0.66 / 4), new THREE.MeshStandardMaterial({ map: signTexture(label), roughness: 0.9 }));
        sign.position.set(x, fl + H + fh * 0.5, fz + 0.1);
        sign.castShadow = false;
        out.push(sign);
        B.box(trim_, w * 0.66 + 0.12, w * 0.66 / 4 + 0.12, 0.04, x, fl + H + fh * 0.5, fz + 0.075);
    }
    // porta almofadada
    B.box(trim_, 1.26, 2.22, 0.08, x, fl + 1.11, fz + 0.01);
    B.box(M.paint, 1.06, 2.08, 0.07, x, fl + 1.06, fz + 0.045);
    for (const [px, py, ph] of [[-0.25, 1.5, 0.9], [0.25, 1.5, 0.9], [-0.25, 0.5, 0.7], [0.25, 0.5, 0.7]]) B.box(trim_, 0.36, ph, 0.03, x + px, fl + py, fz + 0.075);
    B.add(M.iron, place(new THREE.SphereGeometry(0.035, 8, 6), x + 0.42, fl + 1.05, fz + 0.11));
    // janelas de guilhotina
    for (const s of [-1, 1]) {
        const wx = x + s * w * 0.31;
        B.box(M.glass, 0.86, 1.16, 0.03, wx, fl + 1.62, fz + 0.012);
        B.box(trim_, 1.06, 0.1, 0.1, wx, fl + 2.24, fz + 0.04);
        B.box(trim_, 1.14, 0.08, 0.16, wx, fl + 1.0, fz + 0.06);
        for (const e of [-1, 1]) B.box(trim_, 0.1, 1.2, 0.09, wx + e * 0.48, fl + 1.62, fz + 0.04);
        B.box(M.cream, 0.035, 1.16, 0.045, wx, fl + 1.62, fz + 0.035);
        B.box(M.cream, 0.86, 0.045, 0.05, wx, fl + 1.62, fz + 0.04);
        B.box(M.glass, 0.7, 0.9, 0.03, x + s * (w / 2 + t / 2), fl + 1.65, z, 0, Math.PI / 2, 0);
        for (const e of [-1, 1]) B.box(trim_, 0.07, 1.0, 0.08, x + s * (w / 2 + t / 2 + 0.01), fl + 1.65, z + e * 0.39, 0, 0, 0);
        B.box(trim_, 0.1, 0.08, 0.92, x + s * (w / 2 + t / 2 + 0.01), fl + 2.16, z);
        B.box(trim_, 0.14, 0.07, 0.96, x + s * (w / 2 + t / 2 + 0.02), fl + 1.16, z);
    }
    // alpendre: tablado, degraus, colunas torneadas, guarda-corpo e água-furtada
    const pd = 2.0, pz = fz + pd / 2;
    B.box(M.planks, w + 0.7, 0.14, pd, x, fl - 0.07, pz);
    B.box(M.stone, w + 0.5, 0.5, pd - 0.2, x, y0 + 0.1, pz);
    for (let i = 0; i < 2; i++) B.box(M.planks, 1.8, 0.13, 0.36, x, fl - 0.2 - i * 0.16, fz + pd + 0.16 + i * 0.34);
    const posts = Math.max(4, Math.round(w / 1.9) + 1);
    for (let i = 0; i < posts; i++) {
        const px = x - w / 2 - 0.2 + (i / (posts - 1)) * (w + 0.4), pzz = fz + pd - 0.14;
        B.cyl(trim_, 0.055, 0.07, 2.36, px, fl + 1.18, pzz, 0, 0, 0, 10);
        B.box(trim_, 0.18, 0.2, 0.18, px, fl + 0.1, pzz);
        B.box(trim_, 0.2, 0.1, 0.2, px, fl + 2.32, pzz);
        for (const e of [-1, 1]) if (i + e >= 0 && i + e < posts) B.beam(trim_, px, fl + 2.0, pzz, px + e * 0.32, fl + 2.3, pzz, 0.05);
        if (i < posts - 1) {
            const nx = x - w / 2 - 0.2 + ((i + 1) / (posts - 1)) * (w + 0.4);
            const mid = (px + nx) / 2;
            if (Math.abs(mid - x) > 1.0) {
                B.box(trim_, nx - px, 0.07, 0.09, mid, fl + 0.92, pzz);
                B.box(trim_, nx - px, 0.06, 0.06, mid, fl + 0.2, pzz);
                for (let bx = px + 0.18; bx < nx - 0.1; bx += 0.18) B.box(M.cream, 0.035, 0.68, 0.035, bx, fl + 0.56, pzz);
            }
        }
    }
    B.box(trim_, w + 0.7, 0.14, 0.12, x, fl + 2.42, fz + pd - 0.14);
    B.box(M.shingle, w + 1.0, 0.08, pd + 0.5, x, fl + 2.72, pz + 0.05, 0.2, 0, 0);
    for (let i = 0; i <= 6; i++) B.beam(trim_, x - w / 2 - 0.3 + (i / 6) * (w + 0.6), fl + 2.9, fz, x - w / 2 - 0.3 + (i / 6) * (w + 0.6), fl + 2.46, fz + pd + 0.2, 0.07);
    if (chimney) {
        const cx = x + w * 0.24, cz = z - d * 0.2;
        B.cyl(M.iron, 0.09, 0.09, 1.5, cx, fl + H + rise * 0.5 + 0.7, cz, 0, 0, 0, 10);
        B.cyl(M.iron, 0.17, 0.02, 0.12, cx, fl + H + rise * 0.5 + 1.5, cz, 0, 0, 0, 10);
        B.cyl(M.iron, 0.11, 0.11, 0.05, cx, fl + H + rise * 0.5 + 1.42, cz, 0, 0, 0, 10);
    }
    return { porchY: fl, frontZ: fz, top: fl + H + rise };
}

/** Caixa-d'água: tanque de aduelas com cintas de ferro sobre torre contraventada. */
export function waterTower(B, gy, x, z) {
    const M = B.M, y0 = gy(x, z), h = 5.2, sp = 1.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        B.beam(M.darkWood, x + sx * sp * 1.25, y0 - 0.2, z + sz * sp * 1.25, x + sx * sp * 0.85, y0 + h, z + sz * sp * 0.85, 0.2);
    }
    for (const lvl of [0.3, 0.62]) {
        const k = THREE.MathUtils.lerp(1.25, 0.85, lvl) * sp, y = y0 + h * lvl;
        for (const s of [-1, 1]) { B.beam(M.darkWood, x - k, y, z + s * k, x + k, y, z + s * k, 0.11); B.beam(M.darkWood, x + s * k, y, z - k, x + s * k, y, z + k, 0.11); }
    }
    for (const s of [-1, 1]) {
        B.beam(M.darkWood, x - sp * 1.2, y0 + 0.3, z + s * sp * 1.2, x + sp * 0.98, y0 + h * 0.6, z + s * sp * 0.98, 0.07);
        B.beam(M.darkWood, x + sp * 1.2, y0 + 0.3, z + s * sp * 1.2, x - sp * 0.98, y0 + h * 0.6, z + s * sp * 0.98, 0.07);
        B.beam(M.darkWood, x + s * sp * 1.2, y0 + 0.3, z - sp * 1.2, x + s * sp * 0.98, y0 + h * 0.6, z + sp * 0.98, 0.07);
        B.beam(M.darkWood, x + s * sp * 1.2, y0 + 0.3, z + sp * 1.2, x + s * sp * 0.98, y0 + h * 0.6, z - sp * 0.98, 0.07);
    }
    B.box(M.planks, sp * 2.5, 0.14, sp * 2.5, x, y0 + h + 0.07, z);
    for (let i = -2; i <= 2; i++) B.box(M.darkWood, sp * 2.4, 0.16, 0.12, x, y0 + h - 0.08, z + i * 0.65);
    B.cyl(M.planks, 1.42, 1.3, 2.3, x, y0 + h + 1.29, z, 0, 0, 0, 24);
    for (const by of [0.35, 1.15, 1.95]) B.add(M.iron, place(new THREE.TorusGeometry(1.33 + by * 0.045, 0.025, 6, 32), x, y0 + h + 0.14 + by, z, Math.PI / 2));
    B.add(M.shingle, place(new THREE.ConeGeometry(1.7, 0.95, 16), x, y0 + h + 2.9, z));
    B.cyl(M.iron, 0.04, 0.04, 0.5, x, y0 + h + 3.55, z);
    B.beam(M.rust, x + 1.3, y0 + h + 0.5, z, x + 2.3, y0 + h - 0.6, z, 0.09);
    for (let i = 0; i < 12; i++) B.box(M.darkWood, 0.5, 0.05, 0.07, x - sp * 1.1 + (i / 12) * 0.2, y0 + 0.35 + i * 0.42, z + sp * (1.27 - (i / 12) * 0.4));
}

/** Cata-vento de rancho: torre treliçada, roda de pás (gira) e leme. */
export function windmill(B, gy, x, z) {
    const M = B.M, y0 = gy(x, z), h = 7.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.beam(M.darkWood, x + sx * 1.1, y0 - 0.2, z + sz * 1.1, x + sx * 0.22, y0 + h, z + sz * 0.22, 0.12);
    for (let l = 0; l < 5; l++) {
        const a = l / 5, b = (l + 1) / 5, ka = THREE.MathUtils.lerp(1.1, 0.22, a), kb = THREE.MathUtils.lerp(1.1, 0.22, b), ya = y0 + h * a, yb = y0 + h * b;
        for (const s of [-1, 1]) {
            B.beam(M.darkWood, x - ka, ya, z + s * ka, x + kb, yb, z + s * kb, 0.05);
            B.beam(M.darkWood, x + s * ka, ya, z - ka, x + s * kb, yb, z + kb, 0.05);
            B.beam(M.darkWood, x - kb, yb, z + s * kb, x + kb, yb, z + s * kb, 0.06);
            B.beam(M.darkWood, x + s * kb, yb, z - kb, x + s * kb, yb, z + kb, 0.06);
        }
    }
    B.box(M.planks, 1.0, 0.08, 1.0, x, y0 + h - 0.9, z);
    const parts = [];
    for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const blade = place(new THREE.BoxGeometry(0.3, 1.05, 0.015), 0, 0.85, 0, 0, 0.5, 0);
        parts.push(place(blade, 0, 0, 0, 0, 0, a));
    }
    parts.push(place(new THREE.TorusGeometry(1.36, 0.02, 5, 32), 0, 0, 0), place(new THREE.TorusGeometry(0.45, 0.02, 5, 20), 0, 0, 0), place(new THREE.CylinderGeometry(0.09, 0.09, 0.22, 10), 0, 0, 0, Math.PI / 2));
    const wheel = new THREE.Mesh(mergeGeometries(parts.map((g) => g.toNonIndexed())), M.rust);
    wheel.position.set(x, y0 + h + 0.25, z + 0.55);
    wheel.castShadow = true;
    B.box(M.iron, 0.1, 0.1, 1.9, x, y0 + h + 0.25, z - 0.35);
    B.box(M.rust, 0.02, 0.8, 1.0, x, y0 + h + 0.3, z - 1.55);
    return wheel;
}

/** Cerca de mourões: tábuas levemente tortas acompanhando o terreno. */
export function fence(B, gy, pts, { rails = 2, gate = -1 } = {}) {
    const M = B.M, rnd = seeded(pts.length * 17 + Math.round(pts[0][0] * 10));
    for (let i = 0; i < pts.length; i++) {
        const [x, z] = pts[i], y = gy(x, z), hgt = 1.25 + rnd() * 0.12;
        B.cyl(M.bark, 0.06, 0.08, hgt + 0.3, x + (rnd() - 0.5) * 0.04, y + hgt / 2 - 0.15, z, (rnd() - 0.5) * 0.08, 0, (rnd() - 0.5) * 0.08, 7);
        if (i === pts.length - 1 || i === gate) continue;
        const [nx, nz] = pts[i + 1], ny = gy(nx, nz);
        for (let r = 0; r < rails; r++) {
            const hh = 0.45 + r * (0.62 / Math.max(1, rails - 1)) + (rnd() - 0.5) * 0.05;
            B.beam(M.planks, x, y + hh + (rnd() - 0.5) * 0.05, z, nx, ny + hh + (rnd() - 0.5) * 0.05, nz, 0.085);
        }
    }
}

/** Palanque para amarrar cavalos. */
export function hitchingPost(B, gy, x, z, len = 2.6, ry = 0) {
    const M = B.M, dx = Math.cos(ry) * len / 2, dz = -Math.sin(ry) * len / 2;
    for (const s of [-1, 1]) B.cyl(M.bark, 0.07, 0.085, 1.4, x + s * dx, gy(x + s * dx, z + s * dz) + 0.55, z + s * dz, 0, 0, 0, 8);
    B.beam(M.bark, x - dx * 1.15, gy(x, z) + 1.12, z - dz * 1.15, x + dx * 1.15, gy(x, z) + 1.12, z + dz * 1.15, 0.1);
}

function wheelGeo(r) {
    const parts = [new THREE.TorusGeometry(r, r * 0.06, 6, 24), place(new THREE.CylinderGeometry(r * 0.16, r * 0.16, r * 0.28, 10), 0, 0, 0, Math.PI / 2)];
    for (let i = 0; i < 12; i++) parts.push(place(new THREE.BoxGeometry(r * 0.07, r * 0.95, r * 0.07), 0, r * 0.5, 0, 0, 0, 0).applyMatrix4(new THREE.Matrix4().makeRotationZ((i / 12) * Math.PI * 2)));
    return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

/** Carroção: caçamba de tábuas, rodas raiadas, timão e (opcional) toldo de lona em arcos. */
export function wagon(B, gy, x, z, ry = 0, covered = true) {
    const M = B.M, y0 = gy(x, z), m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y0, z);
    const A = (mat, g) => B.add(mat, g.applyMatrix4(m));
    A(M.planks, place(new THREE.BoxGeometry(1.5, 0.1, 3.3), 0, 1.0, 0));
    for (const s of [-1, 1]) {
        A(M.planks, place(new THREE.BoxGeometry(0.06, 0.62, 3.3), s * 0.75, 1.34, 0));
        for (let i = -2; i <= 2; i++) A(M.darkWood, place(new THREE.BoxGeometry(0.05, 0.7, 0.07), s * 0.79, 1.34, i * 0.72));
        A(M.planks, place(new THREE.BoxGeometry(1.5, 0.62, 0.06), 0, 1.34, s * 1.65));
    }
    for (const sz of [-1, 1]) {
        const r = sz > 0 ? 0.52 : 0.62;
        A(M.iron, place(new THREE.CylinderGeometry(0.05, 0.05, 1.9, 8), 0, r, sz * 1.15, 0, 0, Math.PI / 2));
        for (const sx of [-1, 1]) A(M.darkWood, place(wheelGeo(r), sx * 0.93, r, sz * 1.15, 0, Math.PI / 2, 0));
        A(M.darkWood, place(new THREE.BoxGeometry(1.3, 0.14, 0.14), 0, r + 0.2, sz * 1.15));
        A(M.darkWood, place(new THREE.BoxGeometry(0.12, 1.0 - r - 0.2, 0.12), 0, (1.0 + r + 0.2) / 2, sz * 1.15));
    }
    A(M.darkWood, place(new THREE.BoxGeometry(0.09, 0.09, 2.6), 0, 0.5, 2.85, 0.14));
    A(M.planks, place(new THREE.BoxGeometry(1.2, 0.07, 0.4), 0, 1.75, 1.35));
    if (covered) {
        // toldo: superfície de meio-cilindro com as bocas franzidas
        const segU = 14, segV = 8, pos = [], idx = [];
        for (let v = 0; v <= segV; v++) for (let u = 0; u <= segU; u++) {
            const a = (u / segU) * Math.PI, zz = -1.75 + (v / segV) * 3.5;
            const pinch = 1 - 0.1 * Math.pow(Math.abs(v / segV - 0.5) * 2, 3), sag = 1 - 0.035 * Math.abs(Math.sin((v / segV) * Math.PI * 4));
            pos.push(Math.cos(a) * 0.84 * pinch, 1.62 + Math.sin(a) * 1.15 * pinch * sag, zz);
        }
        for (let v = 0; v < segV; v++) for (let u = 0; u < segU; u++) { const a = v * (segU + 1) + u, b = a + 1, c = a + segU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        A(M.canvas, g);
        for (let i = 0; i <= 4; i++) A(M.darkWood, place(new THREE.TorusGeometry(0.85, 0.022, 5, 16, Math.PI), 0, 1.62, -1.7 + i * 0.85, 0, 0, 0).applyMatrix4(new THREE.Matrix4().makeScale(1, 1.36, 1).setPosition(0, -0.58, 0)));
    }
}

/** Barraca de lona tipo "A" com cumeeira cedendo, abas abertas, esteios, estais e espeques. */
export function tent(B, gy, x, z, ry = 0) {
    const M = B.M, y0 = gy(x, z), m = new THREE.Matrix4().makeRotationY(ry).setPosition(x, y0, z);
    const A = (mat, g) => B.add(mat, g.applyMatrix4(m));
    const W = 1.7, Hh = 2.1, L = 3.8, segU = 12, segV = 10, pos = [], idx = [];
    const prof = (u, v) => {
        const au = Math.abs(u), sagV = 0.1 * Math.sin(v * Math.PI), belly = 0.11 * Math.sin(au * Math.PI) * (0.6 + 0.4 * Math.sin(v * Math.PI));
        return [u * W * (1 + 0.03 * Math.sin(v * Math.PI * 5)), Math.max(0, Hh * (1 - au) - sagV * (1 - au) - belly), (v - 0.5) * L];
    };
    for (let v = 0; v <= segV; v++) for (let u = 0; u <= segU; u++) pos.push(...prof((u / segU) * 2 - 1, v / segV));
    for (let v = 0; v < segV; v++) for (let u = 0; u < segU; u++) { const a = v * (segU + 1) + u, b = a + 1, c = a + segU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    // fundo fechado
    const o = pos.length / 3;
    pos.push(-W, 0, -L / 2, W, 0, -L / 2, 0, Hh, -L / 2);
    idx.push(o, o + 1, o + 2);
    // abas da frente abertas para os lados
    for (const s of [-1, 1]) {
        const q = pos.length / 3;
        pos.push(s * W, 0, L / 2, s * W * 0.72, 0, L / 2 + 0.75, 0, Hh, L / 2, s * W * 0.3, Hh * 0.55, L / 2 + 0.3);
        idx.push(q, q + 1, q + 3, q, q + 3, q + 2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    A(M.canvas, g);
    for (const s of [-1, 1]) A(M.bark, place(new THREE.CylinderGeometry(0.035, 0.045, Hh + 0.25, 7), 0, (Hh + 0.25) / 2, s * (L / 2 + 0.02)));
    A(M.bark, place(new THREE.CylinderGeometry(0.03, 0.03, L + 0.3, 7), 0, Hh - 0.02, 0, Math.PI / 2));
    for (const sx of [-1, 1]) for (const vz of [-0.5, 0, 0.5]) {
        const a = new THREE.Vector3(sx * W, 0.02, vz * L), b = new THREE.Vector3(sx * (W + 0.75), 0, vz * L);
        const gg = new THREE.CylinderGeometry(0.008, 0.008, a.distanceTo(new THREE.Vector3(sx * W * 0.9, 0.35, vz * L)) + 0.8, 4);
        gg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(new THREE.Vector3(sx * W * 0.8, 0.5, vz * L)).normalize()));
        gg.translate((a.x + b.x) / 2 - sx * 0.1, 0.22, vz * L);
        A(M.rope, gg);
        A(M.bark, place(new THREE.CylinderGeometry(0.02, 0.012, 0.3, 5), b.x, 0.08, b.z, 0, 0, -sx * 0.4));
    }
    // saco de dormir e manta enrolada lá dentro
    A(M.blanket, place(new THREE.CapsuleGeometry(0.16, 1.5, 4, 10), 0.45, 0.14, -0.3, Math.PI / 2, 0, 0, 1.6, 1, 0.5));
    A(M.canvas, place(new THREE.CylinderGeometry(0.14, 0.14, 0.55, 12), -0.6, 0.15, -1.2, 0, 0, Math.PI / 2));
}

/** Lenha da fogueira: toras em tipi sobre o leito de brasas. */
export function campfireLogs(B, x, y, z) {
    const M = B.M;
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.3;
        B.add(i % 2 ? M.char : M.bark, place(place(new THREE.CylinderGeometry(0.045, 0.06, 0.85, 7), 0, 0.3, 0.22, -0.62), x, y, z, 0, a, 0));
    }
    B.add(M.ember, place(new THREE.CylinderGeometry(0.34, 0.4, 0.07, 12), x, y + 0.03, z));
    for (let i = 0; i < 6; i++) B.add(M.ember, place(new THREE.IcosahedronGeometry(0.06 + (i % 3) * 0.015, 0), x + Math.cos(i * 2.1) * 0.2, y + 0.08, z + Math.sin(i * 2.1) * 0.2));
}

/** Torre de vigia do posto: plataforma, guarda-corpo, telhado e escada. */
export function watchtower(B, gy, x, z) {
    const M = B.M, y0 = gy(x, z), h = 4.4, s = 1.1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.beam(M.bark, x + sx * s * 1.15, y0 - 0.2, z + sz * s * 1.15, x + sx * s, y0 + h + 2.3, z + sz * s, 0.16);
    for (const e of [-1, 1]) {
        B.beam(M.darkWood, x - s * 1.12, y0 + 0.4, z + e * s * 1.1, x + s * 1.03, y0 + h - 0.3, z + e * s * 1.03, 0.07);
        B.beam(M.darkWood, x + s * 1.12, y0 + 0.4, z + e * s * 1.1, x - s * 1.03, y0 + h - 0.3, z + e * s * 1.03, 0.07);
        B.beam(M.darkWood, x + e * s * 1.1, y0 + 0.4, z - s * 1.12, x + e * s * 1.03, y0 + h - 0.3, z + s * 1.03, 0.07);
    }
    B.box(M.planks, s * 2.6, 0.1, s * 2.6, x, y0 + h, z);
    for (const e of [-1, 1]) {
        B.box(M.planks, s * 2.6, 0.08, 0.08, x, y0 + h + 1.0, z + e * s * 1.25);
        B.box(M.planks, s * 2.6, 0.5, 0.04, x, y0 + h + 0.4, z + e * s * 1.25);
        B.box(M.planks, 0.08, 0.08, s * 2.6, x + e * s * 1.25, y0 + h + 1.0, z);
        if (e < 0) B.box(M.planks, 0.04, 0.5, s * 2.6, x + e * s * 1.25, y0 + h + 0.4, z);
    }
    B.box(M.shingle, s * 3.1, 0.08, s * 1.7, x, y0 + h + 2.55, z + s * 0.75, 0.3);
    B.box(M.shingle, s * 3.1, 0.08, s * 1.7, x, y0 + h + 2.55, z - s * 0.75, -0.3);
    for (const e of [-1, 1]) B.beam(M.bark, x + s * 1.35 + 0.5, y0, z + e * 0.25, x + s * 1.3, y0 + h + 0.9, z + e * 0.25, 0.07);
    for (let i = 1; i < 11; i++) B.box(M.bark, 0.05, 0.05, 0.56, x + s * 1.35 + 0.5 - (i / 11) * 0.5, y0 + i * 0.42, z);
}

/** Boca da mina: quadros de escoramento, galeria escura, trilhos, dormentes e vagonete. */
export function mineEntrance(B, gy, x, z) {
    const M = B.M, y0 = gy(x, z);
    for (let i = 0; i < 4; i++) {
        const zz = z - i * 1.15, k = 1 - i * 0.04;
        for (const s of [-1, 1]) B.beam(M.bark, x + s * 1.35 * k, y0 - 0.1, zz, x + s * 1.1 * k, y0 + 2.5 * k, zz, 0.22);
        B.beam(M.bark, x - 1.45 * k, y0 + 2.55 * k, zz, x + 1.45 * k, y0 + 2.55 * k, zz, 0.24);
        if (i < 3) for (let j = -2; j <= 2; j++) B.box(M.planks, 0.42, 0.05, 1.15, x + j * 0.48 * k, y0 + 2.7 * k, zz - 0.57);
    }
    B.box(M.dark, 2.6, 2.6, 0.1, x, y0 + 1.25, z - 3.6);
    B.box(M.dark, 0.1, 2.6, 3.4, x - 1.42, y0 + 1.25, z - 1.9);
    B.box(M.dark, 0.1, 2.6, 3.4, x + 1.42, y0 + 1.25, z - 1.9);
    for (const s of [-1, 1]) B.box(M.iron, 0.06, 0.08, 9, x + s * 0.4, y0 + 0.1, z + 1.7);
    for (let i = 0; i < 12; i++) B.box(M.darkWood, 1.3, 0.07, 0.17, x, y0 + 0.035, z - 2.6 + i * 0.75);
    // vagonete
    const cz = z + 4.2;
    const tub = new THREE.CylinderGeometry(0.62, 0.42, 0.75, 4, 1, true);
    tub.rotateY(Math.PI / 4); tub.scale(1, 1, 1.45);
    B.add(M.rust, place(tub, x, y0 + 0.78, cz));
    B.box(M.rust, 0.6, 0.05, 0.86, x, y0 + 0.42, cz);
    B.box(M.iron, 0.9, 0.08, 1.3, x, y0 + 0.34, cz);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.cyl(M.iron, 0.16, 0.16, 0.06, x + sx * 0.4, y0 + 0.26, cz + sz * 0.42, 0, 0, Math.PI / 2, 12);
    for (let i = 0; i < 7; i++) B.add(M.stone, place(new THREE.IcosahedronGeometry(0.2 + (i % 3) * 0.05, 1), x + Math.cos(i * 1.9) * 0.22, y0 + 1.1 + (i % 2) * 0.1, cz + Math.sin(i * 2.3) * 0.38, i, i * 2, 0));
}

/**
 * Saguaro: colunas caneladas lofteadas ao longo de curvas (tronco + braços em cotovelo).
 * Raio de cada anel: r(θ) = R·(1 + 0,1·cos(costelas·θ)); a cor de vértice escurece no sulco.
 */
export function cactusGeometry(seed = 1) {
    const rnd = seeded(seed * 97 + 3), ribs = 14, seg = ribs * 2;
    const pos = [], col = [], idx = [];
    const cA = new THREE.Color(0x4f6a34), cB = new THREE.Color(0x2c4220), c = new THREE.Color();
    const column = (curve, R, rings) => {
        const base = pos.length / 3;
        const up = new THREE.Vector3(0, 1, 0), T = new THREE.Vector3(), N = new THREE.Vector3(), Bn = new THREE.Vector3(), P = new THREE.Vector3();
        for (let i = 0; i <= rings; i++) {
            const t = i / rings;
            curve.getPoint(t, P); curve.getTangent(t, T);
            N.crossVectors(Math.abs(T.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : up, T).normalize(); Bn.crossVectors(T, N).normalize();
            // ponta arredondada + leve cintura na base
            const end = Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, (t - 0.9) / 0.1), 2)));
            const r = R * (t > 0.9 ? end : 1) * (0.9 + 0.1 * Math.min(1, t * 6));
            for (let j = 0; j < seg; j++) {
                const a = (j / seg) * Math.PI * 2, rib = Math.cos(ribs * a), rr = r * (1 + 0.1 * rib);
                pos.push(P.x + (N.x * Math.cos(a) + Bn.x * Math.sin(a)) * rr, P.y + (N.y * Math.cos(a) + Bn.y * Math.sin(a)) * rr, P.z + (N.z * Math.cos(a) + Bn.z * Math.sin(a)) * rr);
                c.copy(cB).lerp(cA, rib * 0.5 + 0.5).multiplyScalar(0.85 + 0.2 * t);
                col.push(c.r, c.g, c.b);
            }
        }
        for (let i = 0; i < rings; i++) for (let j = 0; j < seg; j++) {
            const a = base + i * seg + j, b = base + i * seg + ((j + 1) % seg), d = a + seg, e = b + seg;
            idx.push(a, b, d, b, e, d);
        }
    };
    const H = 4.2 + rnd() * 2.4, R = 0.26 + rnd() * 0.07;
    column(new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.3, 0), new THREE.Vector3(0.03, H * 0.5, 0.02), new THREE.Vector3(0, H, 0)]), R, 18);
    const arms = Math.floor(rnd() * 3.4);
    for (let i = 0; i < arms; i++) {
        const a = rnd() * Math.PI * 2, y = H * (0.35 + rnd() * 0.25), out = 0.75 + rnd() * 0.45, hgt = 1.0 + rnd() * 1.6, dx = Math.cos(a), dz = Math.sin(a);
        column(new THREE.CatmullRomCurve3([new THREE.Vector3(dx * R * 0.5, y, dz * R * 0.5), new THREE.Vector3(dx * out * 0.75, y + 0.05, dz * out * 0.75), new THREE.Vector3(dx * out, y + 0.45, dz * out), new THREE.Vector3(dx * out, y + hgt, dz * out)], false, 'catmullrom', 0.35), R * 0.68, 16);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
}

/** Mesa/meseta distante: cilindro irregular com paredão em estratos e saia de tálus. */
export function mesaGeometry(seed, radius, height) {
    const rnd = seeded(seed * 53 + 11), seg = 40, rows = 14;
    const pos = [], col = [], idx = [];
    const lobes = [rnd() * 6, rnd() * 6, rnd() * 6];
    const c = new THREE.Color(), bands = [0xa85432, 0xc97a4a, 0x8a3f28, 0xd49566, 0xb0603a, 0x9a4a30, 0xcf8a58];
    for (let r = 0; r <= rows; r++) {
        const t = r / rows;
        // perfil: tálus (0–0,35) abre em rampa; paredão quase vertical; topo chanfrado
        const k = t < 0.35 ? THREE.MathUtils.lerp(1.9, 1.08, Math.pow(t / 0.35, 0.7)) : t > 0.93 ? THREE.MathUtils.lerp(1.0, 0.9, (t - 0.93) / 0.07) : THREE.MathUtils.lerp(1.08, 1.0, (t - 0.35) / 0.58);
        for (let j = 0; j <= seg; j++) {
            const a = (j / seg) * Math.PI * 2;
            const wob = 1 + 0.16 * Math.sin(a * 2 + lobes[0]) + 0.09 * Math.sin(a * 5 + lobes[1]) + 0.05 * Math.sin(a * 11 + lobes[2] + t * 3);
            const ledge = t > 0.35 ? 0.03 * Math.sin(t * 40 + a * 3) : 0;
            const rr = radius * k * (wob + ledge);
            pos.push(Math.cos(a) * rr, t * height - 4, Math.sin(a) * rr);
            c.set(bands[Math.floor(t * 9 + Math.sin(a * 3 + lobes[0]) * 0.4 + 7) % bands.length]);
            if (t < 0.35) c.lerp(new THREE.Color(0xa8704a), 0.7);
            c.multiplyScalar(0.8 + 0.3 * rnd());
            col.push(c.r, c.g, c.b);
        }
    }
    for (let r = 0; r < rows; r++) for (let j = 0; j < seg; j++) { const a = r * (seg + 1) + j, b = a + 1, d = a + seg + 1, e = d + 1; idx.push(a, d, b, b, d, e); }
    const top = pos.length / 3;
    pos.push(0, height - 4 + radius * 0.02, 0); col.push(0.62, 0.42, 0.28);
    for (let j = 0; j < seg; j++) idx.push(top, rows * (seg + 1) + j + 1, rows * (seg + 1) + j);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

export { textureSet };
