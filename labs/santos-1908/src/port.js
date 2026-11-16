/**
 * port — cais do café (P01–P08): muralha de cantaria, faixa de paralelepípedo com
 * trilhos embutidos, armazéns de tijolo numerados (o 14 diante do Kasato — D06),
 * guindastes a vapor de pórtico (P05), sacas de 60 kg, barris, cabeços, lampiões
 * a gás, prancha de desembarque e espias que aparecem depois da atracação.
 *
 * Armazém (tipologia fotográfica ~1902–1908, P06): 62 × 22 m, parede de 7,6 m,
 * telhado de duas águas em telha capa-canal com lanternim, pilastras a cada 7,75 m,
 * 4 portões em arco por fachada e marquise de zinco sobre a faixa do cais.
 */
import * as THREE from 'three';
import { textureSet } from '../../shared/gfx/textures.js';
import { createParticles } from '../../shared/gfx/particles.js';
import { seeded } from '../../shared/gfx/core.js';
import { LAYOUT } from './config.js';
import { Batch, box, rbox, cyl, bar, cable, lathe, P, gableRoof, signTexture, instances } from './kit.js';

const Y = LAYOUT.quayY;
export const WAREHOUSES = [-3, -2, -1, 0, 1, 2, 3].map((i) => ({ z: i * (LAYOUT.whLen + LAYOUT.whGap), number: 14 + i }));
export const CRANES = [-128, -84, 100, 144, 196];

function archFrame(w, h, t = 0.35, depth = 0.3) {
    const r = w / 2;
    const s = new THREE.Shape();
    s.moveTo(-r - t, 0);
    s.lineTo(-r - t, h - r);
    s.absarc(0, h - r, r + t, Math.PI, 0, true);
    s.lineTo(r + t, 0);
    s.lineTo(r, 0);
    s.lineTo(r, h - r);
    s.absarc(0, h - r, r, 0, Math.PI, false);
    s.lineTo(-r, 0);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
}

function archPanel(w, h, depth = 0.1) {
    const r = w / 2;
    const s = new THREE.Shape();
    s.moveTo(-r, 0);
    s.lineTo(-r, h - r);
    s.absarc(0, h - r, r, Math.PI, 0, true);
    s.lineTo(r, 0);
    s.closePath();
    return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 8 });
}

/** Coloca uma peça modelada no plano XY (frente +Z) numa fachada que olha para ±X. */
function onFacade(g, x, y, z, faceNegX) {
    g.rotateY(faceNegX ? -Math.PI / 2 : Math.PI / 2);
    g.translate(x, y, z);
    return g;
}

function warehouse(bt, zc, signs, number) {
    const { whX0: x0, whX1: x1, whLen: len } = LAYOUT;
    const xc = (x0 + x1) / 2;
    const w = x1 - x0;
    const H = 7.6;
    bt.add('brick', box(w, H, len, xc, Y, zc), 0xffffff, 1.7);
    bt.add('ashlar', box(w + 0.3, 1.0, len + 0.3, xc, Y, zc), 0xd8d2c6, 2.4);
    bt.add('plaster', box(w + 0.5, 0.55, len + 0.5, xc, Y + H, zc), 0xe6dcc6, 3);
    // pilastras
    for (let i = 0; i <= 8; i++) {
        const z = zc - len / 2 + (i * len) / 8;
        for (const x of [x0 - 0.12, x1 + 0.12]) bt.add('brick', box(0.4, H, 0.8, x, Y, z), 0xf2e2d2, 1.7);
    }
    for (const z of [zc - len / 2 - 0.12, zc + len / 2 + 0.12]) {
        for (const x of [x0, xc - 5.5, xc + 5.5, x1]) bt.add('brick', box(0.8, H, 0.4, x, Y, z), 0xf2e2d2, 1.7);
    }
    // telhado + lanternim
    const { roof, gables } = gableRoof(w, len, 5.2, 0.9);
    bt.add('roof', roof.translate(xc, Y + H + 0.55, zc), 0xffffff);
    bt.add('brick', gables.translate(xc, Y + H + 0.55, zc), 0xffffff, 1.7);
    bt.add('wood', box(3.2, 1.3, len - 10, xc, Y + H + 0.55 + 4.3, zc), 0x5a4a38, 2);
    const l = gableRoof(3.2, len - 10, 0.9, 0.5);
    bt.add('roof', l.roof.translate(xc, Y + H + 0.55 + 5.6, zc), 0xffffff);
    bt.add('wood', l.gables.translate(xc, Y + H + 0.55 + 5.6, zc), 0x5a4a38, 2);
    // óculo e placa nas empenas
    for (const s of [1, -1]) {
        const o = new THREE.TorusGeometry(0.9, 0.18, 6, 16);
        o.translate(xc, Y + H + 2.6, zc + s * (len / 2 + 0.05));
        bt.add('plaster', o, 0xe6dcc6);
        const d = new THREE.CircleGeometry(0.9, 16);
        if (s < 0) d.rotateY(Math.PI);
        d.translate(xc, Y + H + 2.6, zc + s * (len / 2 + 0.03));
        bt.add('paint', d, 0x1a1c1e);
    }
    // portões em arco (cais e rua) e janelas altas
    const doorZ = [-27, -9.5, 9.5, 27];
    for (const faceNegX of [true, false]) {
        const x = faceNegX ? x0 : x1;
        const out = faceNegX ? -1 : 1;
        for (const dz of doorZ) {
            bt.add('ashlar', onFacade(archFrame(4.2, 5.2, 0.4, 0.34), x + out * 0.02, Y, zc + dz, faceNegX), 0xe2dccf, 2.4);
            bt.add('wood', onFacade(archPanel(4.2, 5.2, 0.12), x + out * 0.05, Y, zc + dz, faceNegX), 0x39503f, 1.6);
        }
        for (let i = 0; i < 8; i++) {
            const z = zc - len / 2 + ((i + 0.5) * len) / 8;
            if (doorZ.some((dz) => Math.abs(zc + dz - z) < 3.2)) continue;
            bt.add('ashlar', onFacade(archFrame(1.5, 2.2, 0.22, 0.26), x + out * 0.02, Y + 3.6, z, faceNegX), 0xe2dccf, 2.4);
            bt.add('glass', onFacade(archPanel(1.5, 2.2, 0.06), x + out * 0.03, Y + 3.6, z, faceNegX), 0x1c2a30);
        }
    }
    // marquise de zinco sobre o cais, em mãos-francesas de ferro
    const can = box(4.4, 0.06, len - 2, 0, 0, 0);
    can.rotateZ(0.2);
    can.translate(x0 - 2.1, Y + 5.75, zc);
    bt.add('zinc', can, 0xb8bcc0, 1.4);
    for (let i = 0; i <= 8; i++) {
        const z = zc - len / 2 + 1 + (i * (len - 2)) / 8;
        bt.add('iron', bar(P(x0, Y + 4.4, z), P(x0 - 4.1, Y + 5.3, z), 0.05, 4), 0x24262a);
        bt.add('iron', bar(P(x0, Y + 6.1, z), P(x0 - 4.1, Y + 5.4, z), 0.04, 4), 0x24262a);
    }
    signs.push({ text: `Nº ${number}`, x: x0 - 0.45, y: Y + 6.75, z: zc, ry: -Math.PI / 2, w: number === 14 ? 4.2 : 3, h: number === 14 ? 1.7 : 1.2 });
    signs.push({ text: `Nº ${number}`, x: xc, y: Y + H + 0.3, z: zc - len / 2 - 0.35, ry: Math.PI, w: 3, h: 1.2 });
    signs.push({ text: `Nº ${number}`, x: xc, y: Y + H + 0.3, z: zc + len / 2 + 0.35, ry: 0, w: 3, h: 1.2 });
}

/** Guindaste a vapor de pórtico (1ª geração — P05). Tudo em 2 malhas: pórtico fixo + lança giratória. */
function steamCrane(mats, z) {
    const group = new THREE.Group();
    const bt = new Batch(mats);
    const xa = 2.6;
    const xb = 7.6;
    const ph = 6.4;
    const dark = 0x2c3034;
    for (const x of [xa, xb]) {
        for (const dz of [-2.4, 2.4]) {
            bt.add('paint', bar(P(x, Y, z + dz), P(x + (x === xa ? 0.35 : -0.35), Y + ph, z + dz * 0.8), 0.17, 6), dark);
            bt.add('paint', box(0.7, 0.35, 0.9, x, Y, z + dz), 0x1c1e22);
        }
        bt.add('paint', bar(P(x, Y + 0.5, z - 2.4), P(x, Y + ph - 0.4, z + 2.0), 0.07, 4), dark);
        bt.add('paint', bar(P(x, Y + 0.5, z + 2.4), P(x, Y + ph - 0.4, z - 2.0), 0.07, 4), dark);
    }
    for (const dz of [-2.0, 2.0]) {
        bt.add('paint', bar(P(xa + 0.35, Y + ph - 1.3, z + dz), P(xb - 0.35, Y + ph - 1.3, z + dz), 0.09, 4), dark);
        bt.add('paint', bar(P(xa + 0.3, Y + ph - 1.3, z + dz), P((xa + xb) / 2, Y + ph, z + dz), 0.06, 4), dark);
        bt.add('paint', bar(P(xb - 0.3, Y + ph - 1.3, z + dz), P((xa + xb) / 2, Y + ph, z + dz), 0.06, 4), dark);
    }
    bt.add('paint', rbox(5.8, 0.4, 5.2, (xa + xb) / 2, Y + ph, z, 0.06), 0x3a3e42);
    bt.add('paint', lathe([[1.9, 0], [1.9, 0.18], [1.6, 0.3], [1.6, 0.4]], 20, (xa + xb) / 2, Y + ph + 0.4, z), 0x1c1e22);
    // escada de marinheiro
    for (let i = 0; i < 11; i++) bt.add('paint', box(0.5, 0.03, 0.03, xb + 0.25, Y + 0.5 + i * 0.55, z + 2.4), dark);
    group.add(bt.build(null, { name: 'crane' }));

    const sl = new Batch(mats);
    const c = 0x4a5a52; // verde-ferro de oficina
    sl.add('paint', rbox(3.2, 3.0, 3.8, 0, 0.4, -0.6, 0.08), c);
    const roof = new THREE.CylinderGeometry(2.3, 2.3, 4.2, 12, 1, false, -0.75, 1.5);
    roof.rotateX(Math.PI / 2);
    roof.rotateZ(Math.PI);
    roof.translate(0, 1.32, -0.6);
    sl.add('paint', roof, 0x8a8e90);
    // caldeira vertical + chaminé
    sl.add('paint', cyl(0.62, 0.62, 3.0, 0, 0.4, -3.1, 12), 0x1c1e22);
    sl.add('paint', lathe([[0.62, 3.0], [0.3, 3.4], [0.2, 3.5], [0.2, 5.6], [0.26, 5.7]], 10, 0, 0.4, -3.1), 0x1c1e22);
    sl.add('paint', rbox(2.6, 1.0, 1.3, 0, 0.4, -4.4, 0.06), 0x24262a); // contrapeso
    for (const s of [1, -1]) {
        sl.add('paint', box(0.03, 0.9, 1.1, s * 1.62, 1.7, -0.2), 0x121a20);
        sl.add('paint', box(0.03, 0.9, 1.1, s * 1.62, 1.7, -1.5), 0x121a20);
    }
    // lança treliçada
    const len = 15;
    const ang = 0.92;
    const tip = P(0, 0.9 + Math.sin(ang) * len, 1.2 + Math.cos(ang) * len);
    for (const s of [1, -1]) {
        sl.add('paint', bar(P(s * 0.9, 0.9, 1.2), P(s * 0.22, tip.y, tip.z), 0.1, 5, 0.07), c);
        sl.add('paint', bar(P(s * 0.9, 2.2, 0.9), P(s * 0.22, tip.y + 0.2, tip.z - 0.3), 0.07, 4, 0.05), c);
    }
    for (let i = 1; i < 9; i++) {
        const t = i / 9;
        const a = P(0.9 - 0.68 * t, 0.9 + (tip.y - 0.9) * t, 1.2 + (tip.z - 1.2) * t);
        const b = P(-(0.9 - 0.68 * (t + 0.1)), 0.9 + (tip.y - 0.9) * (t + 0.1), 1.2 + (tip.z - 1.2) * (t + 0.1));
        sl.add('paint', bar(a, b, 0.035, 3), c);
        sl.add('paint', bar(P(-a.x, a.y, a.z), P(-b.x, b.y, b.z), 0.035, 3), c);
    }
    sl.add('paint', new THREE.CylinderGeometry(0.4, 0.4, 0.2, 12).rotateZ(Math.PI / 2).translate(0, tip.y, tip.z), 0x1c1e22);
    sl.add('paint', bar(P(0, 3.4, -1.0), P(0, tip.y + 0.3, tip.z), 0.025, 3), 0x15151a);
    const hookY = -ph + 3.6;
    sl.add('paint', bar(P(0, tip.y, tip.z + 0.2), P(0, hookY + 1.2, tip.z + 0.2), 0.022, 3), 0x15151a);
    sl.add('paint', new THREE.SphereGeometry(0.24, 8, 6).translate(0, hookY + 1.1, tip.z + 0.2), 0x1c1e22);
    // lingada de sacas
    for (let i = 0; i < 4; i++) {
        const g = new THREE.SphereGeometry(0.5, 8, 6);
        g.scale(0.74, 0.3, 0.5);
        g.translate((i % 2) * 0.5 - 0.25, hookY + 0.2 + Math.floor(i / 2) * 0.32, tip.z + 0.2);
        sl.add('paint', g, 0xa58a5c);
    }
    for (const s of [1, -1]) sl.add('paint', bar(P(0, hookY + 1.0, tip.z + 0.2), P(s * 0.55, hookY + 0.15, tip.z + 0.2), 0.015, 3), 0x15151a);
    const slew = sl.build(null, { name: 'slew' });
    slew.position.set((xa + xb) / 2, Y + ph + 0.4, z);
    group.add(slew);
    return { group, slew, stack: new THREE.Vector3((xa + xb) / 2, Y + ph + 0.8 + 5.6, z) };
}

export function createPort(ctx, world) {
    const { scene, mats, quality } = ctx;
    const { quayZ0: z0, quayZ1: z1 } = LAYOUT;
    const len = z1 - z0;
    const zm = (z0 + z1) / 2;
    const rnd = seeded(14);
    const bt = new Batch(mats);

    // muralha, coroamento e pavimento
    bt.add('ashlar', box(1.4, 9.4, len, 0.7, Y - 9.4, zm), 0xbfb8a8, 2.6);
    bt.add('ashlar', rbox(1.5, 0.36, len, 0.72, Y - 0.06, zm, 0.08), 0xe2dccf, 2.6);
    bt.add('ashlar', box(1.4, 9.4, 3, 0.7, Y - 9.4, z0 - 1.5), 0xbfb8a8, 2.6);
    const ground = new THREE.PlaneGeometry(520, 1010, 1, 1);
    ground.rotateX(-Math.PI / 2);
    ground.translate(261.4, Y, zm + 30);
    bt.add('cobble', ground, 0xd9d2c4, 2.8);
    // trilhos embutidos: 2 vias no cais (bitola larga de 1,60 m da SPR — P08) + via da rua
    for (const cx of [5.1, 11.2, LAYOUT.streetX, LAYOUT.streetX - 4.2]) {
        for (const s of [-0.8, 0.8]) bt.add('iron', box(0.07, 0.07, len - 20, cx + s, Y - 0.02, zm), 0x3a3c40);
    }
    // caminho de rolamento dos guindastes
    for (const cx of [2.6, 7.6]) bt.add('iron', box(0.1, 0.06, len - 60, cx, Y - 0.015, zm), 0x2a2c30);

    const signs = [];
    for (const w of WAREHOUSES) warehouse(bt, w.z, signs, w.number);

    // Armazém de Bagagem / guarda-moria (P07) na ponta SE: bloco baixo de alvenaria
    bt.add('plaster', box(16, 6.2, 30, 34, Y, -300), 0xe2d2b0, 3);
    const gb = gableRoof(16, 30, 3.4, 0.7);
    bt.add('roof', gb.roof.translate(34, Y + 6.2, -300), 0xffffff);
    bt.add('plaster', gb.gables.translate(34, Y + 6.2, -300), 0xe2d2b0, 3);
    scene.add(bt.build(null, { name: 'port' }));

    // placas numeradas (1 material por texto distinto)
    const signMats = new Map();
    for (const s of signs) {
        if (!signMats.has(s.text)) {
            signMats.set(s.text, new THREE.MeshStandardMaterial({ map: signTexture(s.text, { font: 'bold 78px Georgia, serif' }), roughness: 0.8 }));
        }
        const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), signMats.get(s.text));
        m.position.set(s.x, s.y, s.z);
        m.rotation.y = s.ry;
        scene.add(m);
    }

    // defensas de madeira, cabeços, lampiões (instanciados)
    const fend = [];
    const boll = [];
    for (let z = z0 + 4; z < z1; z += 7) fend.push({ x: -0.12, y: Y - 4.6, z });
    for (let z = z0 + 9; z < z1; z += 18) boll.push({ x: 0.85, y: Y + 0.3, z });
    const fg = box(0.34, 4.8, 0.34);
    scene.add(instances(fg, mats.wood, fend, { cast: false, colors: [0x5a4634] }));
    const bg = lathe([[0.36, 0], [0.3, 0.1], [0.24, 0.5], [0.34, 0.66], [0.36, 0.78], [0.2, 0.86], [0, 0.88]], 12);
    scene.add(instances(bg, mats.iron, boll, { colors: [0x24262a] }));

    const lamps = [];
    for (let z = z0 + 30; z < z1; z += 37) lamps.push({ x: 22.4, y: Y, z });
    for (let z = z0 + 12; z < z1 + 80; z += 29) lamps.push({ x: 47.3, y: Y, z }, { x: 63.4, y: Y, z: z + 14 });
    const post = lathe([[0.2, 0], [0.16, 0.25], [0.09, 0.5], [0.07, 3.3], [0.12, 3.4], [0.05, 3.5]], 8);
    scene.add(instances(post, mats.iron, lamps, { colors: [0x1c2a24] }));
    const lant = lathe([[0.05, 3.5], [0.18, 3.62], [0.24, 4.05], [0.3, 4.1], [0.04, 4.36], [0, 4.4]], 6);
    scene.add(instances(lant, mats.glow, lamps, { cast: false }));

    // ---------- sacas de café (60 kg — P03), barris e caixotes ----------
    const sackGeo = new THREE.SphereGeometry(0.5, 8, 6);
    {
        const p = sackGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i) * 2;
            const y = p.getY(i) * 2;
            const z = p.getZ(i) * 2;
            const sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.62);
            p.setXYZ(i, sq(x) * 0.4, sq(y) * 0.14, sq(z) * 0.27);
        }
        sackGeo.computeVertexNormals();
    }
    const sacks = [];
    const pile = (cx, cz, nx, nz, layers, ry = 0) => {
        for (let l = 0; l < layers; l++) {
            for (let i = 0; i < nx - (l > 2 ? 1 : 0); i++) {
                for (let j = 0; j < nz; j++) {
                    if (sacks.length >= quality.sacks) return;
                    const ox = (i - (nx - 1) / 2) * 0.82 + (l % 2) * 0.2;
                    const oz = (j - (nz - 1) / 2) * 0.56;
                    const c = Math.cos(ry);
                    const s = Math.sin(ry);
                    sacks.push({
                        x: cx + ox * c + oz * s, y: Y + 0.13 + l * 0.25, z: cz - ox * s + oz * c,
                        ry: ry + (rnd() - 0.5) * 0.25 + (l % 2 ? Math.PI / 2 : 0) * 0, rz: (rnd() - 0.5) * 0.08,
                        c: [0xffffff, 0xf0e6d2, 0xe2d6bc, 0xfff6e2][Math.floor(rnd() * 4)]
                    });
                }
            }
        }
    };
    // pilhas diante dos portões e junto aos guindastes (fora da faixa da câmera x 11–14)
    for (const w of WAREHOUSES) {
        for (const dz of [-27, -9.5, 9.5, 27]) pile(21.2, w.z + dz + 4.2, 3, 5, 5 + Math.floor(rnd() * 3), Math.PI / 2);
    }
    for (const cz of CRANES) pile(8.9, cz + 6.5, 3, 4, 4, 0.2);
    pile(8.6, -70, 4, 5, 6, 0.1);
    pile(8.4, 150, 4, 5, 6, -0.1);
    scene.add(instances(sackGeo, mats.burlap, sacks));

    const barrels = [];
    const crates = [];
    for (let i = 0; i < 46; i++) {
        const z = z0 + 40 + rnd() * (len - 120);
        const cl = Math.floor(rnd() * 3);
        for (let k = 0; k <= cl; k++) {
            if (rnd() < 0.5) barrels.push({ x: 19.5 + rnd() * 1.6, y: Y, z: z + k * 0.8, ry: rnd() * 6 });
            else crates.push({ x: 19.6 + rnd() * 1.4, y: Y, z: z + k * 1.15, ry: (rnd() - 0.5) * 0.4, s: 0.8 + rnd() * 0.5 });
        }
    }
    const barrel = lathe([[0.26, 0], [0.33, 0.25], [0.36, 0.48], [0.33, 0.72], [0.26, 0.96], [0, 0.96]], 12);
    scene.add(instances(barrel, mats.wood, barrels, { colors: [0x8a6a44, 0x7a5a38, 0x9a7a52] }));
    scene.add(instances(rbox(1, 0.8, 0.8, 0, 0, 0, 0.03), mats.wood, crates, { colors: [0xb89a6a, 0xa88a5a, 0xc8aa7a] }));

    // ---------- guindastes a vapor ----------
    const cranes = CRANES.map((z, i) => {
        const c = steamCrane(mats, z);
        c.phase = i * 1.7;
        scene.add(c.group);
        return c;
    });
    const steam = [0, 2, 3].map((i) => {
        const p = createParticles({
            count: 26, life: 4.5, origin: cranes[i].stack, spread: new THREE.Vector3(0.15, 0.05, 0.15),
            velocity: new THREE.Vector3(0.5, 2.0, 0.3), turbulence: 0.8, size: [0.5, 4.5], color: 0xf2efe8, opacity: 0.42
        });
        scene.add(p.mesh);
        return { p, crane: cranes[i] };
    });

    // ---------- depois da atracação: prancha, espias e defensas ----------
    const after = new THREE.Group();
    const ab = new Batch(mats);
    const dk = 4.4 + 0.85; // convés do poço de ré + borda falsa
    const gA = P(2.6, Y, -44.5);
    const gB = P(-1.15, dk + 0.25, -35.5);
    const dir = new THREE.Vector3().subVectors(gB, gA);
    const gl = dir.length();
    const plank = box(1.15, 0.09, gl + 0.3, 0, 0, 0);
    plank.lookAt(dir.clone().normalize());
    plank.translate((gA.x + gB.x) / 2, (gA.y + gB.y) / 2 - 0.02, (gA.z + gB.z) / 2);
    ab.add('wood', plank, 0xa98a5c, 1.2);
    const side = new THREE.Vector3(-dir.z, 0, dir.x).normalize().multiplyScalar(0.55);
    for (const s of [1, -1]) {
        const a = gA.clone().addScaledVector(side, s);
        const b = gB.clone().addScaledVector(side, s);
        ab.add('rope', bar(P(a.x, a.y + 1, a.z), P(b.x, b.y + 1, b.z), 0.02, 4), 0xc8b88a);
        for (let i = 0; i <= 5; i++) {
            const p = a.clone().lerp(b, i / 5);
            ab.add('paint', bar(p, P(p.x, p.y + 1, p.z), 0.022, 4), 0xe8e4da);
        }
        for (let i = 1; i < 12; i++) {
            const p = gA.clone().lerp(gB, i / 12);
            if (s > 0) ab.add('wood', box(1.1, 0.035, 0.05, p.x, p.y + 0.07, p.z, Math.atan2(dir.x, dir.z)), 0x7a6040);
        }
    }
    // espias: proa e popa → cabeços (catenárias)
    const fc = 8.2;
    const lines = [
        [P(-1.6, fc, 56), P(0.85, Y + 0.7, 81)], [P(-1.2, fc - 0.4, 50), P(0.85, Y + 0.7, 63)],
        [P(-2.2, 7.0, -57), P(0.85, Y + 0.7, -81)], [P(-1.3, 6.9, -52), P(0.85, Y + 0.7, -63)]
    ];
    for (const [a, b] of lines) ab.add('rope', cable(a, b, 1.1, 0.045, 10), 0x9a8a62);
    after.add(ab.build(null, { name: 'after' }));
    after.visible = false;
    scene.add(after);

    void world;
    void textureSet;
    return {
        cranes,
        update(t) {
            for (const c of cranes) c.slew.rotation.y = -Math.PI / 2 + Math.sin(t * 0.11 + c.phase) * 0.9 - 0.3;
            for (const s of steam) s.p.update(t);
            after.visible = t >= 112.5;
        }
    };
}
