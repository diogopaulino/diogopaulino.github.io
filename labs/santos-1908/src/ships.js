/**
 * ships — estaleiro procedural: casco lofteado por balizas + vapores, veleiros,
 * rebocador e catraias.
 *
 * Casco (coordenadas locais: +Z proa, +X bombordo, y = 0 na linha d'água):
 *   s = (z + L/2) / L ∈ [0 popa, 1 proa]
 *   meia-boca no convés  b(s) = B/2 · fProa(s) · fPopa(s)
 *     fProa = 1 − ((s − 0.72)/0.28)^2.2      (entrada fina, roda de proa a prumo — K03)
 *     fPopa = √(1 − (1 − s/0.12)²)            (popa elíptica de contra-almeida)
 *   baliza: x(u) = b · sin(min(1, u/uc)·π/2)^e,  y(u) = yQuilha + (yBorda − yQuilha)·u
 *     a meio-navio uc = 0.42, e = 0.5 (fundo chato, bojo redondo);
 *     nas extremidades uc → 1, e → 1.25 (seções em V)
 *   tosamento: y += tosaProa·((s−0.5)/0.5)² + tosaPopa·((0.5−s)/0.5)²
 *   a quilha sobe sob a contra-almeida (s < 0.13) e arredonda no pé de roda (s > 0.96).
 */
import * as THREE from 'three';
import { clamp, lerp, smoothstep, seeded, paint } from '../../shared/gfx/core.js';
import { Batch, box, rbox, cyl, bar, cable, lathe, xform, P, signTexture, instances } from './kit.js';

export function makeHull({
    L, B, draft, freeboard, bulwark = 1.1, sheerFwd = 1.5, sheerAft = 0.9,
    fcsle = null, poop = null, stations = 56, pts = 9,
    bottom = 0x5e2620, side = 0x17171a, strake = null, bootTop = 0.5
}) {
    const fc = fcsle ? fcsle.from : 2;
    const pp = poop ? poop.to : -1;
    const sheer = (s) => sheerFwd * Math.pow(clamp((s - 0.5) / 0.5, 0, 1), 2) + sheerAft * Math.pow(clamp((0.5 - s) / 0.5, 0, 1), 2);
    const deckY = (s) => freeboard + sheer(s) + (s >= fc ? fcsle.h : 0) + (s <= pp ? poop.h : 0);
    const topY = (s) => deckY(s) + (s >= fc || s <= pp ? 0.12 : bulwark);
    const halfB = (s) => {
        const fb = 1 - Math.pow(clamp((s - 0.72) / 0.28, 0, 1), 2.2);
        const fa = Math.sqrt(Math.max(0, 1 - Math.pow(1 - clamp(s / 0.12, 0, 1), 2)));
        return (B / 2) * fb * fa;
    };
    const keelY = (s) => {
        const counter = Math.pow(smoothstep(0.13, 0, s), 1.4);
        const fore = smoothstep(0.955, 1, s);
        return lerp(lerp(-draft, 1.5, counter), -draft * 0.55, fore);
    };
    const fine = (s) => Math.max(smoothstep(0.7, 1, s), smoothstep(0.22, 0, s));
    const xAt = (s, u) => {
        const f = fine(s);
        const uc = lerp(0.42, 1, f);
        const e = lerp(0.5, 1.25, f);
        return halfB(s) * Math.pow(Math.sin((Math.min(1, u / uc) * Math.PI) / 2), e);
    };

    // estações: uniformes + degraus do castelo/tombadilho
    const ss = [];
    for (let i = 0; i <= stations; i++) ss.push(i / stations);
    for (const b of [fc, pp]) if (b > 0 && b < 1) ss.push(b - 0.0015, b + 0.0015);
    ss.sort((a, b) => a - b);

    const ring = pts * 2 + 1;
    const pos = [];
    const uv = [];
    const col = [];
    const cB = new THREE.Color(bottom);
    const cS = new THREE.Color(side);
    const cK = new THREE.Color(strake ?? side);
    for (const s of ss) {
        const z = (s - 0.5) * L;
        const yk = keelY(s);
        const yt = topY(s);
        let girth = 0;
        let px = 0;
        let py = 0;
        for (let j = 0; j < ring; j++) {
            const sideSign = j <= pts ? 1 : -1;
            const u = j <= pts ? 1 - j / pts : (j - pts) / pts;
            const x = xAt(s, u) * sideSign;
            const y = yk + (yt - yk) * u;
            if (j > 0) girth += Math.hypot(x - px, y - py);
            px = x;
            py = y;
            pos.push(x, y, z);
            uv.push(z / 6, girth / 6);
            const c = y < bootTop ? cB : y > yt - 0.55 ? cK : cS;
            col.push(c.r, c.g, c.b);
        }
    }
    const idx = [];
    for (let i = 0; i < ss.length - 1; i++) {
        for (let j = 0; j < ring - 1; j++) {
            const a = i * ring + j;
            const b = a + ring;
            idx.push(a, a + 1, b, a + 1, b + 1, b);
        }
    }
    const hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    hull.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    hull.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    hull.setIndex(idx);
    hull.computeVertexNormals();

    // convés (tábuas correm no comprimento)
    const dp = [];
    for (let i = 0; i < ss.length - 1; i++) {
        const s0 = ss[i];
        const s1 = ss[i + 1];
        if (s1 - s0 < 0.004) continue;
        const z0 = (s0 - 0.5) * L;
        const z1 = (s1 - 0.5) * L;
        const sm = (s0 + s1) / 2;
        const y0 = deckY(sm > fc ? Math.max(s0, fc + 0.002) : sm < pp ? Math.min(s0, pp - 0.002) : clamp(s0, pp + 0.002, fc - 0.002));
        const y1 = deckY(sm > fc ? Math.max(s1, fc + 0.002) : sm < pp ? Math.min(s1, pp - 0.002) : clamp(s1, pp + 0.002, fc - 0.002));
        const b0 = xAt(s0, (y0 - keelY(s0)) / (topY(s0) - keelY(s0))) * 0.985;
        const b1 = xAt(s1, (y1 - keelY(s1)) / (topY(s1) - keelY(s1))) * 0.985;
        dp.push(b0, y0, z0, -b0, y0, z0, b1, y1, z1, -b0, y0, z0, -b1, y1, z1, b1, y1, z1);
    }
    const deck = new THREE.BufferGeometry();
    deck.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
    deck.computeVertexNormals();

    const sOf = (z) => clamp(z / L + 0.5, 0, 1);
    return {
        hull,
        deck,
        L,
        B,
        fcZ: (fc - 0.5) * L,
        poopZ: (pp - 0.5) * L,
        deckYAt: (z) => deckY(sOf(z)),
        topYAt: (z) => topY(sOf(z)),
        /** meia-boca do costado na altura y */
        halfBAt: (z, y) => {
            const s = sOf(z);
            const yk = keelY(s);
            return xAt(s, clamp((y - yk) / (topY(s) - yk), 0, 1));
        }
    };
}

function ventCowl(bt, x, y, z, h, r, ry = 0) {
    bt.add('paint', cyl(r, r * 0.9, h, x, y, z, 10), 0xd9c08a);
    const head = new THREE.SphereGeometry(r * 1.9, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62);
    head.rotateX(Math.PI / 2);
    head.rotateY(ry);
    head.translate(x, y + h + r * 0.5, z);
    bt.add('paint', head, 0xd9c08a);
    const mouth = new THREE.CircleGeometry(r * 1.55, 10);
    mouth.rotateY(ry);
    mouth.translate(x + Math.sin(ry) * r * 0.55, y + h + r * 0.5, z + Math.cos(ry) * r * 0.55);
    bt.add('paint', mouth, 0x8a2a22);
}

function railing(bt, pts, h = 1.0, color = 0xe8e4da, closed = false) {
    const n = pts.length;
    for (let i = 0; i < n; i++) {
        const a = pts[i];
        bt.add('paint', bar(a, P(a.x, a.y + h, a.z), 0.028, 4), color);
        const b = pts[(i + 1) % n];
        if (i === n - 1 && !closed) break;
        for (const k of [1, 0.5]) bt.add('paint', bar(P(a.x, a.y + h * k, a.z), P(b.x, b.y + h * k, b.z), 0.022, 4), color);
    }
}

function porthole() {
    const ring = new THREE.TorusGeometry(0.2, 0.045, 5, 12);
    paint(ring, 0xb08a48);
    const glass = new THREE.CircleGeometry(0.19, 12);
    paint(glass, 0x101820);
    const b = new Batch({});
    const out = new THREE.BufferGeometry();
    void b;
    // fundir manualmente (mesmo layout)
    const g1 = ring.toNonIndexed();
    const g2 = glass.toNonIndexed();
    const cat = (name, size) => {
        const a = g1.attributes[name].array;
        const c = g2.attributes[name].array;
        const arr = new Float32Array(a.length + c.length);
        arr.set(a);
        arr.set(c, a.length);
        out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    };
    cat('position', 3);
    cat('normal', 3);
    cat('color', 3);
    out.rotateY(Math.PI / 2); // olha para +X
    return out;
}

function windowUnit(w = 0.7, h = 0.9) {
    const frame = new THREE.BoxGeometry(0.06, h + 0.12, w + 0.12).toNonIndexed();
    paint(frame, 0x6a4a2a);
    const glass = new THREE.BoxGeometry(0.075, h, w).toNonIndexed();
    paint(glass, 0x121a22);
    const out = new THREE.BufferGeometry();
    for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3]]) {
        const a = frame.attributes[name].array;
        const c = glass.attributes[name].array;
        const arr = new Float32Array(a.length + c.length);
        arr.set(a);
        arr.set(c, a.length);
        out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return out;
}

let _porthole = null;
let _window = null;

/**
 * Vapor de três ilhas (castelo, ponte/casario central, tombadilho).
 * spec.detail: 2 = Kasato Maru (completo), 1 = figurante.
 */
export function buildSteamer(mats, spec) {
    const {
        L, B, draft = 7, freeboard = 4.4, detail = 1, name = null,
        hullSide = 0x0f0f11, hullBottom = 0x5e2620, strake = null,
        house = 0xece7da, funnel = 0x1c1c1e, funnelBand = 0xe6e0d0, funnelBase = 0xcaa458,
        seed = 1
    } = spec;
    const k = L / 123.4; // escala de arranjo geral relativa ao Kasato
    const rnd = seeded(seed);
    const h = makeHull({
        L, B, draft, freeboard, fcsle: { from: 0.855, h: 2.5 * Math.min(1, k + 0.15) }, poop: { to: 0.115, h: 2.4 * Math.min(1, k + 0.15) },
        bottom: hullBottom, side: hullSide, strake, stations: detail > 1 ? 64 : 40, pts: detail > 1 ? 10 : 7
    });
    const group = new THREE.Group();
    const bt = new Batch(mats);
    bt.add('hull', h.hull);
    bt.add('wood', h.deck, 0xc9b48e, 2.4);

    const dy = h.deckYAt(0);
    const Z = (v) => v * k;
    const hb = (z, y) => h.halfBAt(z, y);

    // anteparas dos degraus (castelo e tombadilho)
    bt.add('steel', box(hb(h.fcZ, dy + 1) * 1.96, h.deckYAt(h.fcZ + 1) - dy, 0.14, 0, dy, h.fcZ), house, 3);
    bt.add('steel', box(hb(h.poopZ, dy + 1) * 1.96, h.deckYAt(h.poopZ - 1) - dy, 0.14, 0, dy, h.poopZ), house, 3);

    // ---------- casario central ----------
    const mh0 = Z(-26);
    const mh1 = Z(6);
    const t1 = 2.5;
    const t2 = 2.4;
    const w1 = B - 1.7;
    bt.add('steel', rbox(w1, t1, mh1 - mh0, 0, dy, (mh0 + mh1) / 2, 0.08), house, 3);
    const bdY = dy + t1; // convés das baleeiras
    bt.add('wood', box(B - 0.1, 0.16, mh1 - mh0 + 2.4, 0, bdY, (mh0 + mh1) / 2), 0xc9b48e, 2.4);
    const o0 = Z(-21);
    const o1 = Z(2);
    bt.add('steel', rbox(B * 0.55, t2, o1 - o0, 0, bdY + 0.16, (o0 + o1) / 2, 0.08), house, 3);
    const topY = bdY + 0.16 + t2;
    bt.add('paint', box(B * 0.55 + 0.9, 0.12, o1 - o0 + 0.9, 0, topY, (o0 + o1) / 2), 0xd8d2c2);
    // pés-direitos do convés das baleeiras
    for (let z = mh0 + 1; z < mh1 + 1; z += 3.2 * Math.max(0.8, k)) {
        for (const s of [1, -1]) bt.add('paint', cyl(0.05, 0.05, t1, s * (B / 2 - 0.25), dy, z, 5), 0xe8e4da);
    }
    // gaiuta da praça de máquinas
    bt.add('steel', rbox(3.2 * k + 1, 0.9, 4 * k + 1, 0, topY + 0.12, Z(-15), 0.06), 0x6a4a2a, 2);

    // chaminé (única — K03), caimento de 4° para ré
    const fz = Z(-7);
    const fr = 1.75 * Math.max(0.6, Math.sqrt(k));
    const fh = 11.5 * Math.max(0.62, k);
    const fun = new Batch(mats);
    fun.add('paint', lathe([[fr * 1.12, 0], [fr * 1.12, 0.5], [fr, 0.7], [fr, fh * 0.56]], 20), funnelBase);
    fun.add('paint', lathe([[fr, fh * 0.56], [fr, fh * 0.66]], 20), funnelBand);
    fun.add('paint', lathe([[fr, fh * 0.66], [fr, fh - 0.25], [fr * 1.06, fh - 0.2], [fr * 1.06, fh], [fr * 0.9, fh], [fr * 0.9, fh - 1.2]], 20), funnel);
    fun.add('brass', cyl(0.07, 0.07, fh * 0.8, 0, 0.3, fr + 0.14, 5), 0xc8a050);
    const funG = fun.build(null, { name: 'funnel' });
    funG.position.set(0, topY + 0.12, fz);
    funG.rotation.x = -0.07;
    funG.scale.set(1, 1, 1.12);
    group.add(funG);
    const funnelTop = new THREE.Vector3(0, topY + 0.12 + fh * Math.cos(0.07), fz - fh * Math.sin(0.07));
    // estais da chaminé
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
        bt.add('rope', bar(P(sx * fr * 0.8, topY + fh * 0.72, fz - 0.6), P(sx * B * 0.27, topY + 0.1, fz + sz * 4.2 * k), 0.022, 3), 0x1a1a1a);
    }
    // ventiladores
    ventCowl(bt, 2.6 * k + 0.4, topY + 0.1, Z(-1.5), 2.3, 0.36, 0);
    ventCowl(bt, -2.6 * k - 0.4, topY + 0.1, Z(-1.5), 2.3, 0.36, 0);
    ventCowl(bt, 2.4 * k + 0.4, topY + 0.1, Z(-12.5), 2.0, 0.32, 0.5);
    ventCowl(bt, -2.4 * k - 0.4, topY + 0.1, Z(-12.5), 2.0, 0.32, -0.5);

    // ---------- ponte de comando (separada — K03) ----------
    const b0 = Z(10);
    const b1 = Z(17);
    bt.add('steel', rbox(B * 0.72, t1, b1 - b0, 0, dy, (b0 + b1) / 2, 0.08), house, 3);
    bt.add('wood', box(B + 0.5, 0.15, b1 - b0 + 1.2, 0, dy + t1, (b0 + b1) / 2), 0xc9b48e, 2.4);
    const whY = dy + t1 + 0.15;
    bt.add('wood', rbox(B * 0.42, 2.3, (b1 - b0) * 0.62, 0, whY, (b0 + b1) / 2 - 0.5, 0.06), 0x9a6a3c, 1.2);
    bt.add('paint', box(B * 0.42 + 0.7, 0.1, (b1 - b0) * 0.62 + 0.7, 0, whY + 2.3, (b0 + b1) / 2 - 0.5), 0xd8d2c2);
    // lona do passadiço (quebra-vento)
    for (const s of [1, -1]) {
        bt.add('canvas', box(B * 0.29, 1.0, 0.04, s * B * 0.36, whY, b1 + 0.45), 0xe6dfcc, 1.5);
    }
    if (detail > 1) {
        railing(bt, [P(B / 2 + 0.2, whY, b0 - 0.5), P(B / 2 + 0.2, whY, b1 + 0.5)], 1.0);
        railing(bt, [P(-B / 2 - 0.2, whY, b0 - 0.5), P(-B / 2 - 0.2, whY, b1 + 0.5)], 1.0);
        bt.add('brass', lathe([[0.16, 0], [0.12, 0.9], [0.2, 1.0], [0.2, 1.15], [0, 1.25]], 10, 0, whY + 2.4, (b0 + b1) / 2), 0xc8a050);
    }

    // ---------- escotilhas, guinchos, mastros ----------
    const hatch = (z, len = 4.6) => {
        bt.add('steel', box(5 * Math.max(0.7, k), 0.9, len * Math.max(0.7, k), 0, dy, z), 0x3a3c40, 3);
        bt.add('canvas', rbox(5.2 * Math.max(0.7, k), 0.3, (len + 0.2) * Math.max(0.7, k), 0, dy + 0.85, z, 0.12), 0x9a8f72, 1.5);
    };
    const winch = (z) => {
        for (const s of [1, -1]) {
            const d = new THREE.CylinderGeometry(0.34, 0.34, 0.9, 10);
            d.rotateZ(Math.PI / 2);
            d.translate(s * 1.5, dy + 0.55, z);
            bt.add('iron', d, 0x2a2c30);
            bt.add('iron', box(0.5, 0.5, 0.9, s * 1.5, dy, z), 0x33363a);
        }
    };
    const mast = (z, top) => {
        const rake = -0.05;
        const base = P(0, dy, z);
        const head = P(0, dy + top, z + Math.tan(rake) * top);
        const mid = P(0, dy + top * 0.7, z + Math.tan(rake) * top * 0.7);
        bt.add('paint', bar(base, mid, 0.34 * Math.sqrt(k), 10, 0.24 * Math.sqrt(k)), 0xc9a45c);
        bt.add('paint', bar(mid, head, 0.2 * Math.sqrt(k), 8, 0.09), 0xc9a45c);
        bt.add('paint', box(2.6 * k, 0.1, 0.5, 0, mid.y - 0.2, mid.z - 0.25), 0xc9a45c);
        bt.add('brass', new THREE.SphereGeometry(0.14, 6, 5).translate(head.x, head.y + 0.1, head.z), 0xc8a050);
        // enxárcias (3 por bordo)
        for (const s of [1, -1]) {
            for (let i = 0; i < 3; i++) {
                const zz = z - 1.2 + i * 1.5;
                bt.add('rope', bar(mid, P(s * hb(zz, dy + 1), h.topYAt(zz), zz), 0.028, 3), 0x15151a);
            }
        }
        return { base, head, mid };
    };
    const derrick = (m, dir, len) => {
        const foot = P(0, m.base.y + 2.2, m.base.z + dir * 0.45);
        const tip = P(dir * 0.0, foot.y + len * 0.62, foot.z + dir * len * 0.78);
        for (const s of [0.9, -0.9]) {
            const f = P(s * 0.35, foot.y, foot.z);
            const t = P(s * 2.2 * k, tip.y - s * 0.4, tip.z);
            bt.add('paint', bar(f, t, 0.13, 6, 0.09), 0xc9a45c);
            bt.add('rope', bar(t, P(0, m.mid.y, m.mid.z), 0.02, 3), 0x15151a);
            bt.add('rope', bar(t, P(t.x, dy + 1.4, t.z), 0.018, 3), 0x15151a);
            bt.add('iron', new THREE.SphereGeometry(0.16, 6, 5).translate(t.x, dy + 1.3, t.z), 0x2a2c30);
        }
    };
    const mastH = 25 * Math.max(0.7, k);
    hatch(Z(23));
    hatch(Z(38), 4.2);
    hatch(Z(-32));
    hatch(Z(-43), 4.2);
    winch(Z(28));
    winch(Z(-35.5));
    const fm = mast(Z(30.5), mastH);
    const mm = mast(Z(-37.5), mastH);
    derrick(fm, 1, 10 * k);
    derrick(fm, -1, 9 * k);
    derrick(mm, 1, 9 * k);
    derrick(mm, -1, 9 * k);
    // estais longitudinais
    const stem = P(0, h.deckYAt(L / 2 - 0.5) + 0.3, L / 2 - 0.6);
    const taff = P(0, h.deckYAt(-L / 2 + 2) + 0.3, -L / 2 + 2.2);
    bt.add('rope', bar(fm.head, stem, 0.03, 3), 0x15151a);
    bt.add('rope', bar(mm.head, taff, 0.03, 3), 0x15151a);
    bt.add('rope', cable(fm.head, mm.head, 1.6, 0.02, 10), 0x15151a);

    // ---------- castelo e tombadilho ----------
    const fcY = h.deckYAt(L / 2 - 4);
    bt.add('iron', lathe([[0.55, 0], [0.5, 0.25], [0.3, 0.4], [0.34, 0.9], [0.5, 1.0], [0.46, 1.15], [0, 1.2]], 12, 0, fcY, L / 2 - 9 * k), 0x2a2c30); // cabrestante
    bt.add('iron', box(2.6 * k, 0.7, 1.6, 0, fcY, L / 2 - 13 * k), 0x2a2c30); // molinete
    for (const s of [1, -1]) {
        bt.add('iron', lathe([[0.22, 0], [0.2, 0.45], [0.3, 0.55], [0, 0.6]], 8, s * (hb(L / 2 - 12, fcY) - 0.7), fcY, L / 2 - 12 * k), 0x2a2c30);
        bt.add('iron', lathe([[0.22, 0], [0.2, 0.45], [0.3, 0.55], [0, 0.6]], 8, s * (hb(-L / 2 + 8, dy + 3) - 0.7), h.deckYAt(-L / 2 + 8), -L / 2 + 8 * k), 0x2a2c30);
        // âncora no escovém
        const ax = s * (hb(L / 2 - 7 * k, fcY - 1.6) + 0.08);
        bt.add('iron', box(0.14, 1.9, 0.22, ax, fcY - 2.9, L / 2 - 7 * k), 0x1c1c1e);
        bt.add('iron', box(0.16, 0.3, 1.5, ax, fcY - 3.0, L / 2 - 7 * k), 0x1c1c1e);
    }
    const poopY = h.deckYAt(-L / 2 + 6);
    bt.add('steel', rbox(B * 0.36, 2.1, 5 * k + 1, 0, poopY, -L / 2 + 9.5 * k, 0.06), house, 3); // casa do leme
    bt.add('paint', bar(P(0, poopY, -L / 2 + 1.6), P(0, poopY + 4.6, -L / 2 + 1.0), 0.05, 5), 0xe8e4da); // pau da bandeira
    // guarda-corpos do castelo e do tombadilho
    const edge = (z0, z1, step) => {
        const a = [];
        for (let z = z0; z <= z1 + 0.01; z += step) a.push(z);
        return a;
    };
    const stepR = detail > 1 ? 2.2 : 3.4;
    for (const s of [1, -1]) {
        railing(bt, edge(h.fcZ + 0.4, L / 2 - 1.2, stepR).map((z) => P(s * (hb(z, h.deckYAt(z)) - 0.06), h.deckYAt(z), z)), 1.0);
        railing(bt, edge(-L / 2 + 1.8, h.poopZ - 0.4, stepR).map((z) => P(s * (hb(z, h.deckYAt(z)) - 0.06), h.deckYAt(z), z)), 1.0);
        railing(bt, edge(mh0 - 1, mh1 + 1, stepR + 0.6).map((z) => P(s * (B / 2 - 0.12), bdY + 0.16, z)), 1.0);
    }

    // ---------- baleeiras em turcos ----------
    const boatZ = [Z(-22), Z(-14), Z(-3)];
    const lb = makeHull({ L: 7.6 * Math.max(0.75, k), B: 2.3, draft: 0.55, freeboard: 0.5, bulwark: 0.05, sheerFwd: 0.22, sheerAft: 0.22, stations: 14, pts: 5, bottom: 0xece7da, side: 0xece7da });
    for (const z of boatZ) {
        for (const s of [1, -1]) {
            const x = s * (B / 2 - 1.45);
            const y = bdY + 0.16 + 1.05;
            bt.add('paint', lb.hull.clone().translate(x, y, z), 0xece7da);
            bt.add('canvas', rbox(2.1, 0.22, lb.L * 0.9, x, y + 0.5, z, 0.1), 0xb8ad90, 1.5);
            for (const dz of [-2.2, 2.2]) {
                const curve = new THREE.CatmullRomCurve3([
                    P(x - s * 0.9, bdY + 0.16, z + dz), P(x - s * 0.9, y + 1.0, z + dz), P(x - s * 0.55, y + 1.75, z + dz), P(x + s * 0.2, y + 1.9, z + dz)
                ]);
                bt.add('iron', new THREE.TubeGeometry(curve, 8, 0.055, 5), 0x2a2c30);
                bt.add('rope', bar(P(x + s * 0.2, y + 1.9, z + dz), P(x, y + 0.55, z + dz), 0.015, 3), 0x15151a);
                bt.add('wood', box(0.9, 0.3, 0.16, x, bdY + 0.16, z + dz * 0.6), 0x6a4a2a);
            }
        }
    }
    lb.hull.dispose();
    lb.deck.dispose();

    group.add(bt.build(null, { name: `steamer:${seed}` }));

    // ---------- vigias e janelas (instanciadas) ----------
    _porthole ||= porthole();
    _window ||= windowUnit();
    const ph = [];
    const stepP = detail > 1 ? 3.1 : 4.6;
    for (let z = -L / 2 + 10 * k; z < L / 2 - 9 * k; z += stepP) {
        for (const s of [1, -1]) {
            const y = freeboard - 1.7;
            ph.push({ x: s * (hb(z, y) + 0.03), y, z, ry: s > 0 ? 0 : Math.PI });
            if (z > h.fcZ + 2 || z < h.poopZ - 2) {
                const y2 = h.deckYAt(z) - 1.2;
                ph.push({ x: s * (hb(z, y2) + 0.03), y: y2, z, ry: s > 0 ? 0 : Math.PI });
            }
        }
    }
    group.add(instances(_porthole, mats.brass, ph, { cast: false, receive: false }));
    const wn = [];
    for (let z = mh0 + 1.4; z < mh1 - 0.8; z += 2.3) {
        for (const s of [1, -1]) {
            wn.push({ x: s * (w1 / 2 + 0.01), y: dy + 1.45, z });
            if (z > o0 + 0.8 && z < o1 - 0.8) wn.push({ x: s * (B * 0.275 + 0.01), y: bdY + 1.55, z });
        }
    }
    for (let z = b0 + 1.2; z < b1 - 0.8; z += 2.1) for (const s of [1, -1]) wn.push({ x: s * (B * 0.36 + 0.01), y: dy + 1.45, z });
    // janelas frontais da casa do leme
    for (let x = -B * 0.17; x <= B * 0.17 + 0.01; x += B * 0.085) {
        wn.push({ x, y: whY + 1.5, z: (b0 + b1) / 2 - 0.5 + (b1 - b0) * 0.31 + 0.01, ry: Math.PI / 2 });
    }
    group.add(instances(_window, mats.paint, wn, { cast: false, receive: false }));

    // ---------- nome e bandeiras ----------
    if (name) {
        const tex = signTexture(name, { w: 1024, h: 128, bg: null, fg: '#f2efe6', font: 'bold 92px Georgia, serif', border: false });
        const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.35, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 });
        for (const s of [1, -1]) {
            const z = L / 2 - 13;
            const y = h.deckYAt(z) - 1.25;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.1), mat);
            const dbdz = (hb(z + 1, y) - hb(z - 1, y)) / 2;
            m.position.set(s * (hb(z, y) + 0.06), y, z);
            m.rotation.y = s * (Math.PI / 2 - Math.atan(dbdz) * 1) ;
            if (s < 0) m.rotation.y = -Math.PI / 2 - Math.atan(dbdz);
            else m.rotation.y = Math.PI / 2 + Math.atan(dbdz);
            group.add(m);
        }
    }
    const flag = (draw, w, hgt, pos) => {
        const c = document.createElement('canvas');
        c.width = 192;
        c.height = 128;
        draw(c.getContext('2d'));
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        const g = new THREE.PlaneGeometry(w, hgt, 8, 2);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 3.2) * 0.12 * (p.getX(i) / w + 0.5));
        g.translate(-w / 2, 0, 0);
        g.rotateY(Math.PI / 2);
        const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }));
        m.position.copy(pos);
        group.add(m);
        return m;
    };
    if (detail > 1) {
        // Hinomaru à popa (navio japonês — D04)
        flag((g) => {
            g.fillStyle = '#f4f1ea';
            g.fillRect(0, 0, 192, 128);
            g.fillStyle = '#b8222c';
            g.beginPath();
            g.arc(96, 64, 38, 0, Math.PI * 2);
            g.fill();
        }, 2.6, 1.7, P(0, poopY + 3.7, -L / 2 + 1.05));
    }

    // pontos de amurada para passageiros (bombordo = lado do cais)
    const spots = [];
    const addRun = (z0, z1, yFn, xFn, kind) => {
        for (let z = z0; z <= z1; z += 0.95) spots.push({ x: xFn(z), y: yFn(z), z, kind });
    };
    addRun(h.poopZ + 2.5, mh0 - 1.5, () => dy, (z) => hb(z, dy + 1) - 0.42, 'well');
    addRun(b1 + 1.5, h.fcZ - 2, () => dy, (z) => hb(z, dy + 1) - 0.42, 'well');
    addRun(mh0, mh1, () => bdY + 0.16, () => B / 2 - 0.5, 'boat');
    addRun(h.fcZ + 2, L / 2 - 9, (z) => h.deckYAt(z), (z) => hb(z, h.deckYAt(z)) - 0.45, 'fcsle');
    addRun(-L / 2 + 5, h.poopZ - 1.5, (z) => h.deckYAt(z), (z) => hb(z, h.deckYAt(z)) - 0.45, 'poop');

    return { group, hull: h, funnelTop, spots, deckY: dy, boatDeckY: bdY + 0.16, bridgeY: whY, fore: fm, main: mm };
}

/** Veleiro de três mastros com velas ferradas (galera/barca de carga). */
export function buildSailer(mats, { L = 46, B = 8.6, seed = 1, side = 0x1e2a24, masts = 3 } = {}) {
    const h = makeHull({ L, B, draft: 3.6, freeboard: 2.3, bulwark: 0.9, sheerFwd: 1.5, sheerAft: 1.0, stations: 30, pts: 7, side, strake: 0xe6e0d0, bottom: 0x4e3a2a });
    const bt = new Batch(mats);
    bt.add('hull', h.hull);
    bt.add('wood', h.deck, 0xbfa77e, 2.4);
    const dy = h.deckYAt(0);
    bt.add('wood', rbox(B * 0.42, 1.7, L * 0.13, 0, dy, -L * 0.18, 0.06), 0x8a6238, 1.2);
    bt.add('wood', rbox(B * 0.36, 1.5, L * 0.09, 0, dy, L * 0.16, 0.06), 0xd8d0bc, 1.2);
    // gurupés
    bt.add('paint', bar(P(0, h.deckYAt(L / 2 - 1) + 0.5, L / 2 - 2), P(0, h.deckYAt(L / 2) + 3.6, L / 2 + 9), 0.2, 6, 0.09), 0x7a5a36);
    const zs = masts === 3 ? [L * 0.3, 0, -L * 0.3] : [L * 0.2, -L * 0.18];
    const tops = [];
    zs.forEach((z, i) => {
        const H = (i === zs.length - 1 ? 0.62 : 0.74) * L;
        const base = P(0, dy, z);
        const top = P(0, dy + H, z - H * 0.03);
        bt.add('paint', bar(base, P(0, dy + H * 0.55, z - H * 0.016), 0.26, 8, 0.19), 0xc9a45c);
        bt.add('paint', bar(P(0, dy + H * 0.55, z - H * 0.016), top, 0.17, 6, 0.06), 0xc9a45c);
        tops.push(top);
        const last = i === zs.length - 1;
        if (!last) {
            [0.3, 0.5, 0.68, 0.84].forEach((f, j) => {
                const yy = dy + H * f;
                const half = (B * 1.25) * (1 - j * 0.17);
                bt.add('paint', bar(P(-half, yy, z - H * f * 0.03 + 0.3), P(half, yy, z - H * f * 0.03 + 0.3), 0.11, 6, 0.11), 0x3a2c1e);
                // vela ferrada sobre a verga
                const sail = new THREE.CylinderGeometry(0.2, 0.2, half * 1.8, 7);
                sail.rotateZ(Math.PI / 2);
                sail.translate(0, yy + 0.22, z - H * f * 0.03 + 0.3);
                bt.add('canvas', sail, 0xe2dccb, 1.2);
                for (const s of [1, -1]) bt.add('rope', bar(P(s * half, yy, z + 0.3), P(0, yy + H * 0.14, z - H * f * 0.03), 0.015, 3), 0x15151a);
            });
        } else {
            const boomY = dy + 2.6;
            bt.add('paint', bar(P(0, boomY, z - 0.3), P(0, boomY + 0.4, z - L * 0.24), 0.12, 6), 0x3a2c1e);
            bt.add('paint', bar(P(0, dy + H * 0.56, z - 0.3), P(0, dy + H * 0.72, z - L * 0.17), 0.1, 6), 0x3a2c1e);
            const sail = new THREE.CylinderGeometry(0.24, 0.2, L * 0.22, 7);
            sail.rotateX(Math.PI / 2);
            sail.translate(0, boomY + 0.5, z - L * 0.125);
            bt.add('canvas', sail, 0xe2dccb, 1.2);
        }
        for (const s of [1, -1]) for (let q = 0; q < 3; q++) {
            const zz = z - 1.4 + q * 1.1;
            bt.add('rope', bar(P(0, dy + H * 0.55, z), P(s * h.halfBAt(zz, dy + 0.9), h.topYAt(zz), zz), 0.024, 3), 0x15151a);
        }
    });
    bt.add('rope', bar(tops[0], P(0, h.deckYAt(L / 2) + 3.4, L / 2 + 8.4), 0.025, 3), 0x15151a);
    for (let i = 0; i < tops.length - 1; i++) bt.add('rope', bar(tops[i], P(0, dy + 3, zs[i + 1] + 0.5), 0.02, 3), 0x15151a);
    bt.add('rope', bar(tops[tops.length - 1], P(0, h.deckYAt(-L / 2 + 1) + 0.4, -L / 2 + 1), 0.022, 3), 0x15151a);
    void seed;
    return { group: bt.build(null, { name: 'sailer' }), hull: h };
}

/** Rebocador a vapor. */
export function buildTug(mats) {
    const L = 24;
    const B = 5.8;
    const h = makeHull({ L, B, draft: 2.3, freeboard: 1.2, bulwark: 0.7, sheerFwd: 1.1, sheerAft: 0.3, stations: 26, pts: 7, side: 0x1c1c1e, strake: 0x8a2a22, bottom: 0x4e2a22 });
    const bt = new Batch(mats);
    bt.add('hull', h.hull);
    bt.add('wood', h.deck, 0xb49a70, 2.4);
    const dy = h.deckYAt(0);
    bt.add('wood', rbox(3.2, 2.0, 8, 0, dy, 1.5, 0.08), 0x9a6a3c, 1.2);
    bt.add('wood', rbox(2.6, 1.9, 2.8, 0, dy + 2.0, 4.2, 0.08), 0xd8d0bc, 1.2);
    bt.add('paint', box(3.2, 0.1, 3.4, 0, dy + 3.9, 4.2), 0xd8d2c2);
    const funnelTop = P(0, dy + 2 + 5.6, -0.9);
    const f = lathe([[0.62, 0], [0.55, 0.3], [0.52, 4.6], [0.58, 4.65], [0.58, 5.6], [0.46, 5.6], [0.46, 4.8]], 14, 0, dy + 2, -0.5);
    xform(f, 0, 0, 0, -0.07);
    bt.add('paint', f, 0x1c1c1e);
    bt.add('paint', bar(P(0, dy + 3.9, 5.2), P(0, dy + 9.5, 4.8), 0.08, 5, 0.04), 0xc9a45c);
    bt.add('iron', lathe([[0.3, 0], [0.26, 0.5], [0.4, 0.62], [0, 0.7]], 8, 0, dy, -6), 0x2a2c30);
    // defensa de proa de cabo
    bt.add('rope', new THREE.TorusGeometry(0.5, 0.22, 6, 10).rotateY(Math.PI / 2).translate(0, dy + 0.4, L / 2 - 0.2), 0x7a6a4a);
    return { group: bt.build(null, { name: 'tug' }), hull: h, funnelTop };
}

/** Catraia a remo (bote de serviço do estuário). */
export function buildCanoe(mats) {
    const L = 6.6;
    const h = makeHull({ L, B: 1.6, draft: 0.3, freeboard: 0.42, bulwark: 0.08, sheerFwd: 0.25, sheerAft: 0.2, stations: 14, pts: 5, side: 0x2e4a52, strake: 0xe6e0d0, bottom: 0x3a2c22, bootTop: 0.05 });
    const bt = new Batch(mats);
    bt.add('hull', h.hull);
    bt.add('wood', h.deck.clone().translate(0, -0.3, 0).scale(0.9, 1, 0.9), 0x8a6a44, 1.2);
    for (const z of [-1.2, 0.3, 1.7]) bt.add('wood', box(1.36, 0.05, 0.26, 0, 0.36, z), 0x9a7a50);
    h.deck.dispose();
    return { group: bt.build(null, { name: 'canoe' }), hull: h };
}
