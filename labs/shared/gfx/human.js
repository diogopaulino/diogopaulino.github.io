/**
 * gfx/human — personagem humano procedural com esqueleto (SkinnedMesh, 17 ossos).
 *
 * Modelagem: o corpo é "torneado" por anéis elípticos (loft) ao longo de tronco,
 * braços, pernas e pés; cada anel carrega cor (pele/roupa) e pesos de skin para
 * até 2 ossos, então as juntas dobram suaves. Rosto, cabelo, chapéu e mãos são
 * peças rígidas fundidas na mesma malha (1 draw call por pessoa, ~1,6 mil vértices).
 *
 * Proporção: 7,5 cabeças, 1,75 m (escala por `height`). Frente = +Z, esquerda = +X.
 *
 * Animação procedural (sem clipes): ciclo de marcha por fase φ (2 passos = 2π)
 *   coxa   = −A·sin φ                (A ≈ 0,45 rad andando, 0,95 correndo)
 *   joelho = K·max(0, cos φ)^1.5     (flexão só no balanço)
 *   braço  = +0,6·A·sin φ (oposto à perna), pelve gira ±0,08 rad, tronco compensa
 *   quadril sobe/desce |sin φ|·2 cm — o suficiente para tirar o ar de "boneco".
 */
import * as THREE from 'three';
import { clamp, lerp } from './core.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const AX = V(1, 0, 0);
const AY = V(0, 1, 0);
const AZ = V(0, 0, 1);

// ossos: [nome, pai, x, y, z] em repouso (m)
const BONES = [
    ['hips', -1, 0, 0.96, 0],
    ['spine', 0, 0, 1.08, 0],
    ['chest', 1, 0, 1.26, 0],
    ['neck', 2, 0, 1.47, 0.005],
    ['head', 3, 0, 1.55, 0.012],
    ['armL', 2, 0.188, 1.425, 0],
    ['foreL', 5, 0.2, 1.14, 0],
    ['handL', 6, 0.205, 0.885, 0.008],
    ['armR', 2, -0.188, 1.425, 0],
    ['foreR', 8, -0.2, 1.14, 0],
    ['handR', 9, -0.205, 0.885, 0.008],
    ['thighL', 0, 0.09, 0.915, 0],
    ['shinL', 11, 0.095, 0.5, 0.004],
    ['footL', 12, 0.095, 0.085, -0.008],
    ['thighR', 0, -0.09, 0.915, 0],
    ['shinR', 14, -0.095, 0.5, 0.004],
    ['footR', 15, -0.095, 0.085, -0.008]
];
const B = Object.fromEntries(BONES.map((b, i) => [b[0], i]));

class Builder {
    constructor() {
        this.pos = [];
        this.col = [];
        this.si = [];
        this.sw = [];
        this.idx = [];
    }

    vert(p, color, w) {
        this.pos.push(p.x, p.y, p.z);
        this.col.push(color.r, color.g, color.b);
        const b0 = w[0];
        const b1 = w.length > 2 ? w[2] : w[0];
        const w0 = w.length > 2 ? w[1] : 1;
        this.si.push(b0, b1, 0, 0);
        this.sw.push(w0, 1 - w0, 0, 0);
        return this.pos.length / 3 - 1;
    }

    /**
     * Loft de anéis. Anel: { c:Vector3, a?, b?, ra, rb, col, w:[osso, peso, osso2?], n? (superelipse) }
     */
    loft(rings, segs, { capStart = true, capEnd = true } = {}) {
        const starts = [];
        const p = V(0, 0, 0);
        for (const r of rings) {
            const a = r.a || AX;
            const b = r.b || AZ;
            const n = r.n || 2;
            starts.push(this.pos.length / 3);
            for (let i = 0; i < segs; i++) {
                const t = (i / segs) * Math.PI * 2;
                let cx = Math.cos(t);
                let sx = Math.sin(t);
                if (n !== 2) {
                    cx = Math.sign(cx) * Math.pow(Math.abs(cx), 2 / n);
                    sx = Math.sign(sx) * Math.pow(Math.abs(sx), 2 / n);
                }
                p.copy(r.c).addScaledVector(a, cx * r.ra).addScaledVector(b, sx * r.rb);
                if (r.minY !== undefined && p.y < r.minY) p.y = r.minY;
                this.vert(p, r.col, r.w);
            }
        }
        const dir = V(0, 0, 0).subVectors(rings[rings.length - 1].c, rings[0].c);
        const nrm = V(0, 0, 0).crossVectors(rings[0].a || AX, rings[0].b || AZ);
        const flip = dir.dot(nrm) > 0;
        const tri = (a, b, c) => (flip ? this.idx.push(a, c, b) : this.idx.push(a, b, c));
        for (let r = 0; r < rings.length - 1; r++) {
            const s0 = starts[r];
            const s1 = starts[r + 1];
            for (let i = 0; i < segs; i++) {
                const j = (i + 1) % segs;
                tri(s0 + i, s1 + i, s0 + j);
                tri(s0 + j, s1 + i, s1 + j);
            }
        }
        if (capStart) {
            const r = rings[0];
            const c = this.vert(r.c, r.col, r.w);
            for (let i = 0; i < segs; i++) tri(c, starts[0] + i, starts[0] + ((i + 1) % segs));
        }
        if (capEnd) {
            const r = rings[rings.length - 1];
            const c = this.vert(r.c, r.col, r.w);
            const s = starts[starts.length - 1];
            for (let i = 0; i < segs; i++) tri(c, s + ((i + 1) % segs), s + i);
        }
    }

    /** Peça rígida (BufferGeometry) presa a um osso, com cor única. */
    rigid(geo, color, bone) {
        const g = geo.index ? geo : geo;
        const base = this.pos.length / 3;
        const p = g.attributes.position;
        const w = [bone];
        const v = V(0, 0, 0);
        for (let i = 0; i < p.count; i++) this.vert(v.fromBufferAttribute(p, i), color, w);
        if (g.index) {
            for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
        } else {
            for (let i = 0; i < p.count; i++) this.idx.push(base + i);
        }
        geo.dispose();
    }

    build() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
        geo.setIndex(this.idx);
        geo.computeVertexNormals();
        return geo;
    }
}

function ellipsoid(rx, ry, rz, x, y, z, ws = 10, hs = 8) {
    const g = new THREE.SphereGeometry(1, ws, hs);
    g.scale(rx, ry, rz);
    g.translate(x, y, z);
    return g;
}

function boxAt(w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
    g.translate(x, y, z);
    return g;
}

const DEFAULTS = {
    height: 1.75,
    build: 1,          // 0.85 magro … 1.25 forte
    female: false,
    child: false,
    skin: 0xc68e62,
    hair: 0x241710,
    hairStyle: 'short', // short | long | bun | bald
    top: 'tee',         // tee | tank | long | jacket | none | bikini | kimono
    topColor: 0x2c6ea0,
    bottom: 'shorts',   // shorts | bermuda | pants | rolled | swim | skirt | kimono
    bottomColor: 0x2a303a,
    shoes: 'sneaker',   // sneaker | sandal | barefoot | boot
    shoeColor: 0xe8e4dc,
    hat: 'none',        // none | cap | straw | fedora | bowler | kepi | scarf
    hatColor: 0xd8c9a0,
    accent: 0x8a2a2a,   // faixa (obi), fita do chapéu
    detail: 1           // 1 = multidão, 2 = herói
};

let sharedMaterial = null;
export function humanMaterial() {
    if (!sharedMaterial) {
        sharedMaterial = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.78,
            metalness: 0,
            envMapIntensity: 0.85
        });
        sharedMaterial.name = 'gfxHuman';
    }
    return sharedMaterial;
}

/**
 * Cria uma pessoa. Retorna { object (SkinnedMesh), bones, height, opts, state }.
 */
export function createHuman(options = {}) {
    const o = { ...DEFAULTS, ...options };
    const bld = new Builder();
    const segT = o.detail > 1 ? 20 : 14;
    const segL = o.detail > 1 ? 14 : 10;

    const skin = new THREE.Color(o.skin);
    const skinDark = skin.clone().multiplyScalar(0.72);
    const hair = new THREE.Color(o.hair);
    const topC = new THREE.Color(o.topColor);
    const botC = new THREE.Color(o.bottomColor);
    const shoeC = new THREE.Color(o.shoeColor);
    const hatC = new THREE.Color(o.hatColor);
    const accent = new THREE.Color(o.accent);

    const g = o.build;
    const fem = o.female;
    const shoulderK = fem ? 0.9 : 1.0;
    const hipK = fem ? 1.07 : 1.0;
    const waistK = (fem ? 0.86 : 1.0) * Math.pow(g, 1.4);

    const bareTorso = o.top === 'none' || o.top === 'bikini';
    const robe = o.top === 'kimono';
    const topInfl = o.top === 'jacket' ? 0.016 : robe ? 0.02 : bareTorso ? 0 : 0.007;
    const torsoCol = (y) => {
        if (o.top === 'bikini' && y > 1.24 && y < 1.36) return topC;
        if (bareTorso) return skin;
        if (o.top === 'tank' && y > 1.43) return skin;
        return topC;
    };
    // cós: até onde a calça/short sobe e a camisa desce
    const waistY = 0.99;
    const shirtHem = bareTorso ? 9 : o.top === 'jacket' ? 0.86 : 0.93;

    // ---------- tronco + pescoço ----------
    const T = [
        // y, rx, rz, zOff, n(superelipse)
        [0.86, 0.118 * hipK, 0.1, -0.004, 2.3],
        [0.9, 0.158 * hipK * g, 0.112 * g, -0.004, 2.4],
        [0.96, 0.168 * hipK * g, 0.118 * g, -0.002, 2.4],
        [1.03, 0.152 * waistK, 0.108 * waistK, 0.002, 2.3],
        [1.09, 0.142 * waistK, 0.1 * waistK, 0.004, 2.3],
        [1.18, 0.152 * g * shoulderK, 0.106 * g, 0.008, 2.4],
        [1.26, 0.166 * g * shoulderK, 0.116 * g + (fem ? 0.014 : 0), fem ? 0.02 : 0.012, 2.5],
        [1.33, 0.175 * g * shoulderK, 0.118 * g + (fem ? 0.012 : 0), fem ? 0.016 : 0.01, 2.5],
        [1.4, 0.178 * shoulderK * g, 0.104 * g, 0.004, 2.6],
        [1.44, 0.15 * shoulderK, 0.09, 0.002, 2.4],
        [1.468, 0.082, 0.07, 0.004, 2.1],
        [1.49, 0.056, 0.058, 0.008, 2],
        [1.53, 0.052, 0.056, 0.012, 2]
    ];
    const torsoW = (y) => {
        if (y < 1.0) return [B.hips];
        if (y < 1.1) return [B.hips, clamp((1.1 - y) / 0.1, 0, 1), B.spine];
        if (y < 1.24) return [B.spine, clamp((1.24 - y) / 0.14, 0, 1), B.chest];
        if (y < 1.45) return [B.chest];
        if (y < 1.5) return [B.chest, clamp((1.5 - y) / 0.05, 0, 1), B.neck];
        return [B.neck, 0.6, B.head];
    };
    const torsoRings = [];
    for (const [y, rx, rz, zo, n] of T) {
        const clothed = y <= 1.455 && !bareTorso && y >= shirtHem - 0.001;
        const pantsHere = y < waistY && (o.bottom !== 'none');
        let col = y > 1.455 ? skin : torsoCol(y);
        let infl = clothed ? topInfl : 0;
        if (y < shirtHem && pantsHere) {
            col = botC;
            infl = 0.006;
        } else if (bareTorso && pantsHere && y < waistY) {
            col = botC;
            infl = 0.005;
        }
        torsoRings.push({ c: V(0, y, zo), ra: rx + infl, rb: rz + infl, n, col, w: torsoW(y) });
    }
    bld.loft(torsoRings, segT, { capStart: true, capEnd: false });
    // barra da camisa por cima do cós (dá a sobreposição de tecido)
    if (!bareTorso && !robe && o.bottom !== 'skirt') {
        const y0 = shirtHem;
        const ref = T.find((t) => t[0] >= y0) || T[2];
        bld.loft([
            { c: V(0, y0 - 0.035, ref[3]), ra: ref[1] + topInfl + 0.006, rb: ref[2] + topInfl + 0.006, n: 2.4, col: topC, w: [B.hips] },
            { c: V(0, y0 + 0.05, ref[3]), ra: ref[1] + topInfl + 0.004, rb: ref[2] + topInfl + 0.004, n: 2.4, col: topC, w: [B.hips, 0.6, B.spine] }
        ], segT, { capStart: false, capEnd: false });
    }

    // ---------- cabeça ----------
    const hs = o.child ? 1.12 : 1;
    const H = [
        [1.53, 0.05, 0.058, 0.014],
        [1.552, 0.064, 0.08, 0.02],
        [1.585, 0.071, 0.091, 0.022],
        [1.62, 0.0755, 0.096, 0.02],
        [1.655, 0.078, 0.098, 0.016],
        [1.69, 0.0775, 0.097, 0.012],
        [1.718, 0.07, 0.089, 0.008],
        [1.738, 0.054, 0.07, 0.006],
        [1.749, 0.03, 0.04, 0.004]
    ];
    bld.loft(H.map(([y, rx, rz, zo]) => ({
        c: V(0, 1.53 + (y - 1.53) * hs, zo), ra: rx * hs, rb: rz * hs, col: skin, w: [B.head]
    })), segT, { capStart: false, capEnd: true });
    const headTop = 1.53 + (1.75 - 1.53) * hs;
    const hy = (y) => 1.53 + (y - 1.53) * hs;

    // rosto
    bld.rigid(ellipsoid(0.011 * hs, 0.018 * hs, 0.014 * hs, 0, hy(1.628), 0.108 * hs, 6, 5), skin, B.head); // nariz
    for (const s of [1, -1]) {
        bld.rigid(ellipsoid(0.0125 * hs, 0.0075 * hs, 0.005, s * 0.031 * hs, hy(1.662), 0.094 * hs, 6, 4), new THREE.Color(0xf2efe8), B.head);
        bld.rigid(ellipsoid(0.0062 * hs, 0.0066 * hs, 0.004, s * 0.031 * hs, hy(1.662), 0.0975 * hs, 6, 4), new THREE.Color(0x1c130d), B.head);
        bld.rigid(boxAt(0.03 * hs, 0.0055, 0.006, s * 0.032 * hs, hy(1.681), 0.096 * hs, 0, 0, s * -0.1), hair, B.head); // sobrancelha
        bld.rigid(ellipsoid(0.008, 0.022 * hs, 0.013, s * 0.08 * hs, hy(1.652), 0.008, 5, 5), skinDark, B.head); // orelha
    }
    bld.rigid(boxAt(0.036 * hs, 0.006, 0.006, 0, hy(1.592), 0.094 * hs), new THREE.Color(0x7a3a34), B.head); // boca

    // cabelo: calota de elipsoide inclinada (linha do cabelo sobe na testa, desce na nuca)
    if (o.hairStyle !== 'bald') {
        const tilt = -0.42;
        const cap = new THREE.SphereGeometry(1, segT, 7, 0, Math.PI * 2, 0, Math.PI * 0.56);
        cap.scale(0.0865 * hs, 0.104 * hs, 0.109 * hs);
        cap.rotateX(tilt);
        cap.translate(0, hy(1.662), 0.008);
        bld.rigid(cap, hair, B.head);
        if (o.hairStyle === 'long') {
            bld.loft([
                { c: V(0, hy(1.66), -0.045), ra: 0.082 * hs, rb: 0.06, col: hair, w: [B.head] },
                { c: V(0, hy(1.56), -0.05), ra: 0.086 * hs, rb: 0.05, col: hair, w: [B.head] },
                { c: V(0, 1.44, -0.07), ra: 0.09, rb: 0.035, col: hair, w: [B.head, 0.5, B.chest] },
                { c: V(0, 1.33, -0.085), ra: 0.07, rb: 0.022, col: hair, w: [B.chest] }
            ], segL, { capStart: false, capEnd: true });
        } else if (o.hairStyle === 'bun') {
            bld.rigid(ellipsoid(0.042, 0.042, 0.042, 0, hy(1.7), -0.095 * hs, 8, 6), hair, B.head);
        }
    }

    // chapéus
    const brim = (r0, r1, y, drop = 0) => {
        const gg = new THREE.LatheGeometry([
            new THREE.Vector2(r0, -0.007), new THREE.Vector2(r1, -drop - 0.007),
            new THREE.Vector2(r1, -drop), new THREE.Vector2(r0, 0)
        ], 18);
        gg.translate(0, y, 0.006);
        return gg;
    };
    const crown = (rb, rt, h, y) => {
        const gg = new THREE.CylinderGeometry(rt, rb, h, 16, 1);
        gg.translate(0, y + h / 2, 0.006);
        return gg;
    };
    const hatY = hy(1.705);
    if (o.hat === 'cap') {
        const dome = new THREE.SphereGeometry(0.09 * hs, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
        dome.scale(1, 0.72, 1.12);
        dome.translate(0, hatY - 0.012, 0.006);
        bld.rigid(dome, hatC, B.head);
        bld.rigid(boxAt(0.12 * hs, 0.008, 0.085, 0, hatY - 0.006, 0.135 * hs, 0.14), hatC, B.head);
    } else if (o.hat === 'straw') {
        bld.rigid(crown(0.088 * hs, 0.076 * hs, 0.075, hatY), hatC, B.head);
        bld.rigid(brim(0.085 * hs, 0.21, hatY + 0.006, 0.03), hatC, B.head);
        bld.rigid(crown(0.09 * hs, 0.089 * hs, 0.016, hatY + 0.004), accent, B.head);
    } else if (o.hat === 'fedora' || o.hat === 'bowler') {
        if (o.hat === 'bowler') {
            const dome = new THREE.SphereGeometry(0.09 * hs, 14, 6, 0, Math.PI * 2, 0, Math.PI * 0.5);
            dome.scale(1, 0.95, 1.1);
            dome.translate(0, hatY, 0.006);
            bld.rigid(dome, hatC, B.head);
        } else {
            bld.rigid(crown(0.09 * hs, 0.078 * hs, 0.095, hatY), hatC, B.head);
        }
        bld.rigid(brim(0.086 * hs, 0.145, hatY + 0.006, -0.008), hatC, B.head);
        bld.rigid(crown(0.092 * hs, 0.091 * hs, 0.02, hatY + 0.004), accent, B.head);
    } else if (o.hat === 'kepi') {
        bld.rigid(crown(0.088 * hs, 0.082 * hs, 0.07, hatY - 0.004), hatC, B.head);
        bld.rigid(boxAt(0.11, 0.007, 0.06, 0, hatY, 0.12, 0.2), new THREE.Color(0x15151a), B.head);
    } else if (o.hat === 'scarf') {
        const dome = new THREE.SphereGeometry(0.089 * hs, 14, 7, 0, Math.PI * 2, 0, Math.PI * 0.62);
        dome.scale(1, 1.1, 1.14);
        dome.rotateX(-0.3);
        dome.translate(0, hy(1.652), 0);
        bld.rigid(dome, hatC, B.head);
    }

    // ---------- braços ----------
    const sleeveEnd = o.top === 'tee' ? 1.27 : (o.top === 'long' || o.top === 'jacket' || robe) ? 0.905 : 9;
    const sleeveInfl = o.top === 'jacket' ? 0.011 : robe ? 0.03 : 0.004;
    const armK = Math.pow(g, 0.8) * (fem ? 0.9 : 1);
    for (const s of [1, -1]) {
        const arm = s > 0 ? B.armL : B.armR;
        const fore = s > 0 ? B.foreL : B.foreR;
        const hand = s > 0 ? B.handL : B.handR;
        const A = [
            // y, x, r, w
            [1.44, 0.168, 0.04, [B.chest, 0.6, arm]],
            [1.412, 0.186, 0.05, [arm, 0.75, B.chest]],
            [1.36, 0.193, 0.049, [arm]],
            [1.29, 0.197, 0.046, [arm]],
            [1.2, 0.199, 0.04, [arm]],
            [1.16, 0.2, 0.037, [arm, 0.6, fore]],
            [1.125, 0.201, 0.037, [fore, 0.6, arm]],
            [1.07, 0.202, 0.039, [fore]],
            [0.98, 0.204, 0.032, [fore]],
            [0.915, 0.205, 0.026, [fore]],
            [0.89, 0.205, 0.0245, [fore, 0.5, hand]]
        ];
        const rings = [];
        for (const [y, x, r, w] of A) {
            const sl = y >= sleeveEnd && !bareTorso && o.top !== 'tank';
            const rr = r * (y > 0.95 ? armK : 1) + (sl ? sleeveInfl * (robe ? clamp((1.45 - y) / 0.4, 0.25, 1) : 1) : 0);
            const col = sl ? topC : skin;
            const last = rings[rings.length - 1];
            if (last && last.col !== col) {
                // bainha da manga: anel duplicado
                rings.push({ c: V(s * x, y + 0.004, 0), ra: last.ra, rb: last.rb, col: last.col, w });
                bld.loft(rings.splice(0), segL, { capStart: false, capEnd: true });
            }
            rings.push({ c: V(s * x, y, 0), ra: rr, rb: rr, col, w });
        }
        bld.loft(rings, segL, { capStart: false, capEnd: false });
        // mão: palma chata + dedos + polegar
        bld.loft([
            { c: V(s * 0.205, 0.89, 0.004), ra: 0.02, rb: 0.027, col: skin, w: [hand] },
            { c: V(s * 0.206, 0.85, 0.008), ra: 0.016, rb: 0.04, col: skin, w: [hand] },
            { c: V(s * 0.206, 0.805, 0.012), ra: 0.014, rb: 0.038, col: skin, w: [hand] },
            { c: V(s * 0.204, 0.765, 0.016), ra: 0.011, rb: 0.031, col: skin, w: [hand] },
            { c: V(s * 0.2, 0.735, 0.02), ra: 0.007, rb: 0.02, col: skin, w: [hand] }
        ], segL, { capStart: false, capEnd: true });
        bld.rigid(ellipsoid(0.01, 0.03, 0.011, s * 0.2, 0.83, 0.05, 5, 4), skin, hand);
    }

    // ---------- pernas ----------
    const legEnd = { shorts: 0.63, bermuda: 0.5, pants: 0.1, rolled: 0.3, swim: 0.84, skirt: 0.84, kimono: 0.84, none: 9 }[o.bottom] ?? 0.63;
    const legInfl = o.bottom === 'pants' || o.bottom === 'rolled' ? 0.011 : o.bottom === 'swim' ? 0.003 : 0.014;
    const legK = Math.pow(g, 0.7) * (fem ? 1.04 : 1);
    for (const s of [1, -1]) {
        const thigh = s > 0 ? B.thighL : B.thighR;
        const shin = s > 0 ? B.shinL : B.shinR;
        const foot = s > 0 ? B.footL : B.footR;
        const L = [
            // y, x, r, z, w
            [0.915, 0.088, 0.088, 0, [B.hips, 0.6, thigh]],
            [0.86, 0.09, 0.084, 0, [thigh, 0.75, B.hips]],
            [0.76, 0.092, 0.074, 0.004, [thigh]],
            [0.64, 0.094, 0.061, 0.004, [thigh]],
            [0.55, 0.095, 0.051, 0.004, [thigh, 0.65, shin]],
            [0.5, 0.095, 0.049, 0.006, [shin, 0.5, thigh]],
            [0.45, 0.095, 0.049, 0, [shin, 0.75, thigh]],
            [0.39, 0.095, 0.052, -0.01, [shin]],
            [0.28, 0.095, 0.042, -0.006, [shin]],
            [0.16, 0.095, 0.034, -0.004, [shin]],
            [0.095, 0.095, 0.033, -0.006, [shin, 0.5, foot]]
        ];
        const rings = [];
        for (const [y, x, r, z, w] of L) {
            const cl = y >= legEnd;
            const rr = r * (y > 0.3 ? legK : 1) + (cl ? legInfl : 0);
            const col = cl ? botC : skin;
            const last = rings[rings.length - 1];
            if (last && last.col !== col) {
                rings.push({ c: V(s * x, y + 0.004, z), ra: last.ra, rb: last.rb, col: last.col, w });
                bld.loft(rings.splice(0), segL, { capStart: false, capEnd: true });
            }
            rings.push({ c: V(s * x, y, z), ra: rr, rb: rr, col, w });
        }
        bld.loft(rings, segL, { capStart: false, capEnd: true });

        // pé / calçado (loft ao longo de Z)
        const bare = o.shoes === 'barefoot';
        const fc = bare ? skin : o.shoes === 'sandal' ? skin : shoeC;
        const k = bare ? 0.88 : 1;
        const F = [
            [-0.07, 0.03, 0.03, 0.04],
            [-0.045, 0.04, 0.05, 0.052],
            [0.0, 0.043, 0.058, 0.058],
            [0.05, 0.047, 0.042, 0.044],
            [0.115, 0.049, 0.03, 0.032],
            [0.165, 0.042, 0.022, 0.024],
            [0.19, 0.024, 0.014, 0.017]
        ];
        bld.loft(F.map(([z, rx, ry, cy]) => ({
            c: V(s * 0.097, cy * k, z * k), a: AX, b: AY, ra: rx * k, rb: ry * k, col: fc, w: [foot], minY: 0.002
        })), segL, { capStart: true, capEnd: true });
        if (o.shoes === 'sandal' || o.shoes === 'sneaker' || o.shoes === 'boot') {
            const soleCol = o.shoes === 'sandal' ? shoeC : new THREE.Color(o.shoes === 'boot' ? 0x15120f : 0xf2f0ea);
            bld.rigid(boxAt(0.094, 0.014, 0.265, s * 0.097, 0.007, 0.055), soleCol, foot);
            if (o.shoes === 'sandal') bld.rigid(boxAt(0.1, 0.012, 0.022, s * 0.097, 0.058, 0.07, -0.5), shoeC, foot);
        }
    }

    // ---------- saia / quimono ----------
    if (o.bottom === 'skirt' || o.bottom === 'kimono') {
        const hem = o.bottom === 'kimono' ? 0.16 : 0.52;
        const flare = o.bottom === 'kimono' ? 0.02 : 0.07;
        const col = o.bottom === 'kimono' ? topC : botC;
        const top = waistY + 0.03;
        const rings = [];
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const y = lerp(top, hem, t);
            const w = t < 0.25 ? [B.hips] : [B.hips, 0.72 - t * 0.35, t < 0.6 ? B.thighL : B.shinL];
            rings.push({
                c: V(0, y, 0.004 + t * 0.012),
                ra: (0.15 + flare * Math.pow(t, 0.8)) * hipK * Math.pow(g, 0.7),
                rb: (0.112 + flare * 1.1 * Math.pow(t, 0.8)) * Math.pow(g, 0.7),
                n: 2.3,
                col,
                // pesos alternam entre as coxas para a barra acompanhar o passo
                w: t < 0.25 ? [B.hips] : [B.hips, 0.78 - t * 0.28, i % 2 ? B.thighL : B.thighR]
            });
            void w;
        }
        bld.loft(rings, segT, { capStart: false, capEnd: false });
        if (o.bottom === 'kimono') {
            bld.loft([
                { c: V(0, 1.0, 0.004), ra: 0.158 * hipK, rb: 0.118, n: 2.3, col: accent, w: [B.hips, 0.5, B.spine] },
                { c: V(0, 1.13, 0.006), ra: 0.156, rb: 0.116, n: 2.3, col: accent, w: [B.spine] }
            ], segT, { capStart: false, capEnd: false });
        }
    }

    // ---------- esqueleto ----------
    const geometry = bld.build();
    const scale = (o.height / 1.75) * (o.child ? 1 : 1);
    const bones = BONES.map(([name]) => {
        const b = new THREE.Bone();
        b.name = name;
        return b;
    });
    BONES.forEach(([, parent, x, y, z], i) => {
        if (parent < 0) bones[i].position.set(x, y, z);
        else {
            const p = BONES[parent];
            bones[i].position.set(x - p[2], y - p[3], z - p[4]);
            bones[parent].add(bones[i]);
        }
    });
    const mesh = new THREE.SkinnedMesh(geometry, humanMaterial());
    mesh.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.name = 'gfxHuman';
    // esfera de culling folgada (a pose muda; evita recálculo por frame)
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.9, 0), 1.35);
    geometry.boundingBox = new THREE.Box3(new THREE.Vector3(-0.9, 0, -0.9), new THREE.Vector3(0.9, 2, 0.9));

    const named = Object.fromEntries(bones.map((b) => [b.name, b]));
    return {
        object: mesh,
        bones: named,
        height: o.height,
        headTop: headTop * scale,
        hipsRest: 0.96,
        opts: o
    };
}

const _rot = (bone, x = 0, y = 0, z = 0) => bone.rotation.set(x, y, z);

/**
 * Posa a pessoa. `mode`: idle | walk | run | carry | cycle | sit | lean | wave | talk
 * @param {object} h      retorno de createHuman
 * @param {string} mode
 * @param {number} phase  fase do ciclo (rad); para idle, use o tempo em segundos
 * @param {number} amount 0..1 (mistura com repouso; em walk, comprimento do passo)
 */
export function poseHuman(h, mode = 'idle', phase = 0, amount = 1) {
    const b = h.bones;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    let hipsY = h.hipsRest;
    let hipsX = 0;

    if (mode === 'walk' || mode === 'run' || mode === 'carry') {
        const run = mode === 'run';
        const A = (run ? 0.95 : 0.46) * amount;
        const K = (run ? 1.75 : 1.02) * amount;
        const kneeL = K * Math.pow(Math.max(0, c), 1.5) + (run ? 0.22 : 0.06);
        const kneeR = K * Math.pow(Math.max(0, -c), 1.5) + (run ? 0.22 : 0.06);
        const thL = -A * s - (run ? 0.18 : 0.02);
        const thR = A * s - (run ? 0.18 : 0.02);
        _rot(b.thighL, thL, 0, 0.015);
        _rot(b.thighR, thR, 0, -0.015);
        _rot(b.shinL, kneeL);
        _rot(b.shinR, kneeR);
        _rot(b.footL, -(thL + kneeL) * 0.55 + (run ? 0.15 : 0));
        _rot(b.footR, -(thR + kneeR) * 0.55 + (run ? 0.15 : 0));
        hipsY -= Math.abs(s) * (run ? 0.045 : 0.02) * amount + (run ? 0.03 : 0.004);
        hipsX = s * 0.012 * amount;
        _rot(b.hips, run ? 0.2 : 0.035, s * 0.085 * amount, -s * 0.03 * amount);
        _rot(b.spine, run ? 0.06 : 0.02, -s * 0.07 * amount, s * 0.025 * amount);
        _rot(b.chest, 0.02, -s * 0.07 * amount, 0);
        _rot(b.neck, run ? -0.1 : -0.02, s * 0.05 * amount, 0);
        _rot(b.head, run ? -0.12 : -0.03, s * 0.03 * amount, 0);
        if (mode === 'carry') {
            // saca no ombro direito: braço direito ergue e segura, esquerdo equilibra
            _rot(b.armR, -2.55, 0, -0.42);
            _rot(b.foreR, -1.05, 0, 0.5);
            _rot(b.handR, -0.2, 0, 0);
            _rot(b.armL, 0.25 * A * s + 0.1, 0, 0.16);
            _rot(b.foreL, -0.3);
            _rot(b.handL);
            _rot(b.spine, 0.16, -s * 0.03, 0.06);
            _rot(b.neck, -0.1, 0, -0.12);
        } else {
            const AA = (run ? 1.05 : 0.5) * amount;
            const el = run ? 1.45 : 0.22;
            _rot(b.armL, AA * s + (run ? 0.1 : 0), 0, 0.07);
            _rot(b.armR, -AA * s + (run ? 0.1 : 0), 0, -0.07);
            _rot(b.foreL, -(el + 0.25 * Math.max(0, -s) * amount));
            _rot(b.foreR, -(el + 0.25 * Math.max(0, s) * amount));
            _rot(b.handL, 0, 0, 0.05);
            _rot(b.handR, 0, 0, -0.05);
        }
    } else if (mode === 'cycle') {
        // pedalada: pés em círculo (aproximação de IK de 2 ossos por senoides defasadas)
        const thL = -1.18 + 0.4 * c;
        const thR = -1.18 - 0.4 * c;
        _rot(b.thighL, thL, 0, 0.05);
        _rot(b.thighR, thR, 0, -0.05);
        _rot(b.shinL, 1.32 - 0.48 * s);
        _rot(b.shinR, 1.32 + 0.48 * s);
        _rot(b.footL, -0.25 + 0.2 * s);
        _rot(b.footR, -0.25 - 0.2 * s);
        _rot(b.hips, 0.42, 0, s * 0.02);
        _rot(b.spine, 0.2, 0, 0);
        _rot(b.chest, 0.12, 0, 0);
        _rot(b.neck, -0.3, 0, 0);
        _rot(b.head, -0.32, 0, 0);
        _rot(b.armL, -0.82, 0, 0.14);
        _rot(b.armR, -0.82, 0, -0.14);
        _rot(b.foreL, -0.28, 0, -0.1);
        _rot(b.foreR, -0.28, 0, 0.1);
        _rot(b.handL, -0.4);
        _rot(b.handR, -0.4);
    } else if (mode === 'sit') {
        _rot(b.thighL, -1.5, 0, 0.08);
        _rot(b.thighR, -1.5, 0, -0.08);
        _rot(b.shinL, 1.45);
        _rot(b.shinR, 1.45);
        _rot(b.footL, 0.05);
        _rot(b.footR, 0.05);
        _rot(b.hips, -0.08, 0, 0);
        _rot(b.spine, 0.1 + Math.sin(phase * 0.7) * 0.015, 0, 0);
        _rot(b.chest, 0.06, 0, 0);
        _rot(b.neck, -0.05, Math.sin(phase * 0.23) * 0.3, 0);
        _rot(b.head, -0.05, Math.sin(phase * 0.23) * 0.15, 0);
        _rot(b.armL, -0.45, 0, 0.1);
        _rot(b.armR, -0.45, 0, -0.1);
        _rot(b.foreL, -0.75);
        _rot(b.foreR, -0.75);
        _rot(b.handL);
        _rot(b.handR);
        hipsY = 0.52;
    } else if (mode === 'lean') {
        // debruçado na amurada, olhando o porto
        const sway = Math.sin(phase * 0.6) * 0.02;
        _rot(b.thighL, -0.08, 0, 0.03);
        _rot(b.thighR, 0.1, 0, -0.03);
        _rot(b.shinL, 0.06);
        _rot(b.shinR, 0.12);
        _rot(b.footL, 0.02);
        _rot(b.footR, -0.2);
        _rot(b.hips, 0.12, 0, sway);
        _rot(b.spine, 0.22, 0, -sway);
        _rot(b.chest, 0.14, 0, 0);
        _rot(b.neck, -0.25, Math.sin(phase * 0.21) * 0.35, 0);
        _rot(b.head, -0.12, Math.sin(phase * 0.21) * 0.2, 0);
        _rot(b.armL, -0.72, 0, 0.2);
        _rot(b.armR, -0.72, 0, -0.2);
        _rot(b.foreL, -1.05, 0, -0.35);
        _rot(b.foreR, -1.05, 0, 0.35);
        _rot(b.handL);
        _rot(b.handR);
        hipsY -= 0.01;
    } else {
        // idle / talk / wave: respiração, troca de peso, olhar em volta
        const br = Math.sin(phase * 1.3);
        const sw = Math.sin(phase * 0.37);
        _rot(b.thighL, -0.03, 0, 0.035 + sw * 0.012);
        _rot(b.thighR, 0.03, 0, -0.035 + sw * 0.012);
        _rot(b.shinL, 0.05);
        _rot(b.shinR, 0.04);
        _rot(b.footL, -0.02);
        _rot(b.footR, -0.06);
        _rot(b.hips, 0, 0, -sw * 0.02);
        _rot(b.spine, 0.02 + br * 0.008, 0, sw * 0.02);
        _rot(b.chest, 0.02 + br * 0.012, 0, 0);
        _rot(b.neck, -0.03, Math.sin(phase * 0.19) * 0.28, 0);
        _rot(b.head, -0.02, Math.sin(phase * 0.19) * 0.22, 0);
        _rot(b.armL, 0.04 + br * 0.01, 0, 0.075);
        _rot(b.armR, 0.04 + br * 0.01, 0, -0.075);
        _rot(b.foreL, -0.14);
        _rot(b.foreR, -0.14);
        _rot(b.handL, 0, 0, 0.05);
        _rot(b.handR, 0, 0, -0.05);
        if (mode === 'talk') {
            _rot(b.armR, -0.5 + Math.sin(phase * 2.1) * 0.12, 0, -0.18);
            _rot(b.foreR, -1.25 + Math.sin(phase * 3.3) * 0.3);
        } else if (mode === 'wave') {
            _rot(b.armR, 0, 0, -2.75 + Math.sin(phase * 4.2) * 0.12);
            _rot(b.foreR, 0, 0, -0.35 + Math.sin(phase * 8.4) * 0.38);
        }
        hipsX = sw * 0.012;
    }
    b.hips.position.y = hipsY;
    b.hips.position.x = hipsX;
}

/** Paletas úteis para variar multidões. */
export const SKIN_TONES = [0xf0c8a4, 0xe2b48c, 0xc68e62, 0xa9744c, 0x8a5a3a, 0x6a4129, 0x4e2f1e];
export const HAIR_TONES = [0x120c08, 0x241710, 0x3b2616, 0x5a3a1e, 0x8a6a3a, 0xb8b0a6, 0x1a1a1c];
