/**
 * city — Santos de 1908 atrás do cais: sobrados coloniais em fita, Alfândega (P07),
 * igreja de duas torres diante da praça, capela do Monte Serrat no alto do morro
 * e a Estação do Valongo da SPR (V01).
 *
 * Sobrado: caixa de reboco tingido + embasamento + cimalha + telhado de 4 águas.
 * Vãos são instanciados (1 draw call por tipo): moldura + vidro, folhas de veneziana
 * abertas, porta em arco e sacada de ferro. Regra de fachada: vão a cada ~1,9 m;
 * térreo alterna porta/janela; pavimentos superiores recebem sacada em 1 de cada 2 vãos.
 */
import * as THREE from 'three';
import { seeded, paint } from '../../shared/gfx/core.js';
import { createPalmKit, createTreeKit, instanceKit } from '../../shared/gfx/flora.js';
import { LAYOUT } from './config.js';
import { landHeight } from './world.js';
import { Batch, box, rbox, cyl, bar, lathe, P, gableRoof, hipRoof, signTexture, instances } from './kit.js';

const Y = LAYOUT.quayY;
const WALLS = [0xf2ead8, 0xe6c88e, 0xe2b4a4, 0xb9c6cc, 0xf6f2e8, 0xd6cba8, 0xe8d2a2, 0xc2d0b4, 0xe9dcc0, 0xd9a878];
const SHUT = [0x2e5a48, 0x2a4a6a, 0x6a3a2a, 0x3a3a3a, 0x7a6a3a, 0x24503a];

function merged(parts) {
    // funde peças [geo, cor] num único BufferGeometry não indexado com cor de vértice
    const out = new THREE.BufferGeometry();
    const arrs = { position: [], normal: [], color: [] };
    for (const [g, c] of parts) {
        const n = g.index ? g.toNonIndexed() : g;
        paint(n, c);
        for (const k of Object.keys(arrs)) arrs[k].push(n.attributes[k].array);
    }
    for (const [k, list] of Object.entries(arrs)) {
        const total = list.reduce((a, b) => a + b.length, 0);
        const arr = new Float32Array(total);
        let o = 0;
        for (const a of list) {
            arr.set(a, o);
            o += a.length;
        }
        out.setAttribute(k, new THREE.BufferAttribute(arr, 3));
    }
    return out;
}

// Unidades de fachada: plano da parede em x = 0, para fora = −X, base em y = 0
const cube = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const UNITS = {
    window: () => merged([
        [cube(0.1, 1.9, 1.24, -0.03, -0.1, 0), 0xf4efe2],
        [cube(0.04, 1.6, 0.94, -0.085, 0.05, 0), 0x141c22],
        [cube(0.2, 0.09, 1.36, -0.08, -0.14, 0), 0xe2dccf]
    ]),
    shutters: () => merged([
        [new THREE.PlaneGeometry(0.46, 1.6).rotateY(-Math.PI / 2).translate(-0.045, 0.85, 0.86), 0xffffff],
        [new THREE.PlaneGeometry(0.46, 1.6).rotateY(-Math.PI / 2).translate(-0.045, 0.85, -0.86), 0xffffff]
    ]),
    door: () => merged([
        [cube(0.05, 2.7, 1.2, -0.085, 0, 0), 0xffffff],
        [cube(0.04, 0.5, 1.2, -0.1, 2.2, 0), 0x141c22]
    ]),
    balcony: () => {
        const parts = [[cube(0.7, 0.1, 1.9, -0.35, -0.12, 0), 0xe2dccf], [cube(0.03, 0.03, 1.9, -0.68, 0.82, 0), 0x1c1e22]];
        // balaústres como lâminas finas (2 triângulos cada) — milhares de sacadas na cidade
        for (let i = 0; i <= 6; i++) parts.push([new THREE.PlaneGeometry(0.03, 0.86).rotateY(-Math.PI / 2).translate(-0.68, 0.41, -0.92 + i * 0.307), 0x1c1e22]);
        for (const z of [-0.94, 0.94]) parts.push([new THREE.PlaneGeometry(0.66, 0.035).translate(-0.35, 0.82, z), 0x1c1e22]);
        return merged(parts);
    }
};

export function createCity(ctx) {
    const { scene, mats, quality } = ctx;
    const rnd = seeded(1867);
    const bt = new Batch(mats);
    const inst = { window: [], shutters: [], door: [], balcony: [] };

    /** Vãos numa fachada. x = plano da parede; face = −1 (olha −X) ou +1. */
    const facade = (x, z0, z1, floors, fh, shut, face, groundDoors = true, bayW = 1.95) => {
        const n = Math.max(1, Math.floor((z1 - z0 - 0.8) / bayW));
        const step = (z1 - z0) / n;
        const ry = face < 0 ? 0 : Math.PI;
        for (let f = 0; f < floors; f++) {
            for (let i = 0; i < n; i++) {
                const z = z0 + (i + 0.5) * step;
                const y = Y + 0.6 + f * fh;
                if (f === 0 && groundDoors && (i + (n > 2 ? 1 : 0)) % 2 === 0) {
                    inst.door.push({ x, y: Y + 0.02, z, ry, c: shut });
                } else {
                    inst.window.push({ x, y: y + 0.75, z, ry });
                    if (rnd() < 0.8) inst.shutters.push({ x, y: y + 0.75, z, ry, c: shut });
                    if (f > 0 && face < 0 && i % 2 === 0) inst.balcony.push({ x, y: y + 0.6, z, ry });
                }
            }
        }
    };

    const sobrado = (x0, z0, wz, dx, floors) => {
        const fh = 3.5;
        const H = floors * fh + 0.7;
        const xc = x0 + dx / 2;
        const zc = z0 + wz / 2;
        const wall = WALLS[Math.floor(rnd() * WALLS.length)];
        const shut = SHUT[Math.floor(rnd() * SHUT.length)];
        bt.add('plaster', box(dx, H, wz - 0.05, xc, Y, zc), wall, 3.2);
        bt.add('ashlar', box(dx + 0.14, 0.7, wz + 0.04, xc, Y, zc), 0xcfc8ba, 2.4);
        bt.add('plasterClean', box(dx + 0.36, 0.34, wz + 0.2, xc, Y + H - 0.1, zc), 0xf4efe2, 3);
        if (floors > 1) bt.add('plasterClean', box(dx + 0.2, 0.16, wz + 0.08, xc, Y + fh + 0.55, zc), 0xf4efe2, 3);
        const rise = 1.9 + rnd() * 0.9;
        const roof = wz >= dx ? hipRoof(wz, dx, rise).rotateY(Math.PI / 2) : hipRoof(dx, wz, rise);
        bt.add('roof', roof.translate(xc, Y + H + 0.24, zc), [0xffffff, 0xf2e2d2, 0xe2d2c2][Math.floor(rnd() * 3)]);
        if (rnd() < 0.3) bt.add('brick', box(0.6, 1.5, 0.6, xc + (rnd() - 0.5) * dx * 0.5, Y + H + rise * 0.5, zc + (rnd() - 0.5) * wz * 0.4), 0xd8c8b8, 1.7);
        facade(x0, z0, z0 + wz, floors, fh, shut, -1);
        facade(x0 + dx, z0, z0 + wz, floors, fh, shut, 1, false, 2.6);
    };

    // ---------- malha urbana ----------
    const RES = [[-198, -132, 0], [94, 148, 1], [258, 344, 0]]; // zonas reservadas [z0, z1, até a fileira r]
    const reserved = (z0, z1, r) => RES.some(([a, b, rr]) => r <= rr && z1 > a && z0 < b);
    for (let r = 0; r < quality.cityRows; r++) {
        const x0 = LAYOUT.cityX + r * 30;
        let z = -440 + rnd() * 6;
        let run = 0;
        while (z < 430) {
            const wz = (r === 0 ? 7.5 : 9) + rnd() * (r === 0 ? 7 : 11);
            const floors = r === 0 ? (rnd() < 0.6 ? 2 : 3) : rnd() < 0.3 ? 1 : rnd() < 0.8 ? 2 : 3;
            const dx = 14 + rnd() * 5;
            // não construir dentro do morro
            const hill = landHeight(x0 + dx, z + wz / 2) > 5;
            if (!reserved(z, z + wz, r) && !hill) sobrado(x0 + (r ? rnd() * 1.5 : 0), z, wz, dx, floors);
            z += wz + 0.1;
            if (++run >= 5 + Math.floor(rnd() * 3)) {
                z += 9;
                run = 0;
            }
        }
    }

    // ---------- Alfândega (P07) ----------
    {
        const x0 = 68;
        const zc = -165;
        const w = 26;
        const len = 56;
        const H = 11.4;
        const col = 0xe6cf98;
        bt.add('plaster', box(w, H, len, x0 + w / 2, Y, zc), col, 3.2);
        bt.add('ashlar', box(w + 0.3, 1.4, len + 0.3, x0 + w / 2, Y, zc), 0xcfc8ba, 2.4);
        bt.add('plasterClean', box(w + 0.7, 0.5, len + 0.7, x0 + w / 2, Y + H - 0.2, zc), 0xf6f2e8, 3);
        bt.add('plasterClean', box(w + 0.3, 0.26, len + 0.3, x0 + w / 2, Y + 5.6, zc), 0xf6f2e8, 3);
        bt.add('roof', hipRoof(len, w, 3.2).rotateY(Math.PI / 2).translate(x0 + w / 2, Y + H + 0.3, zc), 0xffffff);
        // corpo central com frontão e pilastras
        bt.add('plaster', box(2.2, H + 1.2, 17, x0 - 1.0, Y, zc), col, 3.2);
        const ped = gableRoof(17, 2.4, 3.0, 0.3, true);
        bt.add('roof', ped.roof.translate(x0 - 1.0, Y + H + 1.2, zc), 0xffffff);
        bt.add('plasterClean', ped.gables.translate(x0 - 1.0, Y + H + 1.2, zc), 0xf6f2e8, 3);
        for (const dz of [-7.6, -2.6, 2.6, 7.6]) bt.add('plasterClean', box(0.5, H, 0.9, x0 - 2.2, Y + 0.6, zc + dz), 0xf6f2e8, 3);
        bt.add('ashlar', box(3.4, 0.6, 12, x0 - 3.2, Y, zc), 0xcfc8ba, 2.4);
        facade(x0, zc - len / 2, zc - 9, 2, 5.2, 0x4a3a2a, -1, false, 2.6);
        facade(x0, zc + 9, zc + len / 2, 2, 5.2, 0x4a3a2a, -1, false, 2.6);
        facade(x0 - 2.1, zc - 7, zc + 7, 2, 5.2, 0x4a3a2a, -1, true, 4.6);
        facade(x0 + w, zc - len / 2, zc + len / 2, 2, 5.2, 0x4a3a2a, 1, false, 3.2);
        bt.add('paint', bar(P(x0 - 1, Y + H + 4, zc), P(x0 - 1, Y + H + 9.5, zc), 0.07, 5), 0xe8e4da);
    }

    // ---------- igreja de duas torres diante da praça ----------
    {
        const xf = 101;
        const zc = 121;
        const white = 0xf4f0e6;
        bt.add('plasterClean', box(34, 13, 15, xf + 17, Y, zc), white, 3.2);
        const g = gableRoof(15, 34, 5, 0.5, true);
        bt.add('roof', g.roof.translate(xf + 17, Y + 13, zc), 0xffffff);
        bt.add('plasterClean', g.gables.translate(xf + 17, Y + 13, zc), white, 3.2);
        bt.add('ashlar', box(34.3, 1.2, 15.3, xf + 17, Y, zc), 0xcfc8ba, 2.4);
        for (const s of [1, -1]) {
            const tz = zc + s * 10;
            bt.add('plasterClean', box(5.4, 22, 5.4, xf + 2.7, Y, tz), white, 3.2);
            for (const yy of [9, 15, 21.6]) bt.add('ashlar', box(5.9, 0.4, 5.9, xf + 2.7, Y + yy, tz), 0xd9d2c4, 2.4);
            // sineiras (vãos escuros nas 4 faces)
            bt.add('paint', box(5.46, 3.2, 1.5, xf + 2.7, Y + 16.6, tz), 0x15171a);
            bt.add('paint', box(1.5, 3.2, 5.46, xf + 2.7, Y + 16.6, tz), 0x15171a);
            bt.add('plasterClean', lathe([[2.9, 0], [3.1, 0.5], [2.5, 1.9], [1.3, 3.3], [0.55, 4.3], [0.3, 5.5], [0, 5.8]], 10, xf + 2.7, Y + 22, tz), 0xe8e2d2);
            bt.add('iron', box(0.1, 1.5, 0.1, xf + 2.7, Y + 27.7, tz), 0x1c1e22);
            bt.add('iron', box(0.1, 0.1, 0.8, xf + 2.7, Y + 28.6, tz), 0x1c1e22);
        }
        // fachada: portal, óculo, pilastras de cantaria
        const fr = new THREE.TorusGeometry(1.2, 0.2, 6, 18).rotateY(Math.PI / 2).translate(xf - 0.05, Y + 10.2, zc);
        bt.add('ashlar', fr, 0xd9d2c4);
        bt.add('glass', new THREE.CircleGeometry(1.2, 18).rotateY(-Math.PI / 2).translate(xf - 0.03, Y + 10.2, zc), 0x1c2a36);
        bt.add('ashlar', box(0.35, 6.4, 4.2, xf - 0.1, Y, zc), 0xd9d2c4, 2.4);
        bt.add('wood', box(0.2, 5.4, 3.0, xf - 0.26, Y, zc), 0x4a3424, 1.6);
        for (const dz of [-7.2, 7.2]) bt.add('ashlar', box(0.4, 13, 0.9, xf - 0.1, Y, zc + dz), 0xd9d2c4, 2.4);
        bt.add('ashlar', box(5, 0.5, 9, xf - 2.6, Y, zc), 0xcfc8ba, 2.4); // adro
    }

    // ---------- capela do Monte Serrat ----------
    {
        const hx = 520;
        const hz = 60;
        const hy = landHeight(hx, hz) - 1.2;
        bt.add('plasterClean', box(16, 7, 9, hx, hy, hz), 0xf6f2e8, 3.2);
        const g = gableRoof(9, 16, 3, 0.4, true);
        bt.add('roof', g.roof.translate(hx, hy + 7, hz), 0xffffff);
        bt.add('plasterClean', g.gables.translate(hx, hy + 7, hz), 0xf6f2e8, 3.2);
        bt.add('plasterClean', box(4, 13, 4, hx - 8, hy, hz), 0xf6f2e8, 3.2);
        bt.add('plasterClean', lathe([[2.2, 0], [2.3, 0.4], [1.2, 2.4], [0.3, 3.8], [0, 4.2]], 8, hx - 8, hy + 13, hz), 0xe8e2d2);
        bt.add('ashlar', box(24, 2.4, 16, hx - 2, hy - 2.2, hz), 0xbfb8a8, 2.4);
    }

    // ---------- Estação do Valongo (SPR, fachada de 1899 — V01) ----------
    {
        const x0 = 62.4;
        const zc = LAYOUT.valongoZ;
        const w = 17;
        const len = 52;
        const H = 10.8;
        const col = 0xe0c08a;
        bt.add('plaster', box(w, H, len, x0 + w / 2, Y, zc), col, 3.2);
        bt.add('ashlar', box(w + 0.3, 1.2, len + 0.3, x0 + w / 2, Y, zc), 0xcfc8ba, 2.4);
        bt.add('plasterClean', box(w + 0.6, 0.45, len + 0.6, x0 + w / 2, Y + H - 0.2, zc), 0xf6f2e8, 3);
        bt.add('plasterClean', box(w + 0.3, 0.24, len + 0.3, x0 + w / 2, Y + 5.3, zc), 0xf6f2e8, 3);
        bt.add('roof', hipRoof(len, w, 3.6).rotateY(Math.PI / 2).translate(x0 + w / 2, Y + H + 0.25, zc), 0xe8dccc);
        // torre do relógio
        bt.add('plaster', box(6.4, 20, 6.4, x0 + 2.4, Y, zc), col, 3.2);
        for (const yy of [10.8, 15.4, 19.6]) bt.add('plasterClean', box(6.9, 0.4, 6.9, x0 + 2.4, Y + yy, zc), 0xf6f2e8, 3);
        bt.add('zinc', lathe([[4.3, 0], [3.3, 1.4], [2.2, 3.6], [1.0, 5.4], [0.2, 6.6], [0, 7.6]], 4, x0 + 2.4, Y + 20, zc).rotateY(0), 0x7a8288);
        bt.add('iron', bar(P(x0 + 2.4, Y + 27.4, zc), P(x0 + 2.4, Y + 30, zc), 0.05, 4), 0x1c1e22);
        // plataforma e marquise de ferro e zinco sobre a via
        bt.add('ashlar', box(5.6, 0.95, len + 14, x0 - 2.8, Y, zc), 0xcfc8ba, 2.4);
        const can = box(6.6, 0.07, len + 12, 0, 0, 0);
        can.rotateZ(-0.12);
        can.translate(x0 - 3.0, Y + 5.6, zc);
        bt.add('zinc', can, 0xb8bcc0, 1.4);
        for (let z = zc - len / 2 - 5; z <= zc + len / 2 + 5; z += 6.2) {
            bt.add('iron', lathe([[0.16, 0], [0.11, 0.3], [0.08, 3.9], [0.16, 4.2], [0.1, 4.35]], 8, x0 - 5.2, Y + 0.95, z), 0x24382e);
            bt.add('iron', bar(P(x0 - 5.2, Y + 4.9, z), P(x0, Y + 5.6, z), 0.045, 4), 0x24382e);
            bt.add('iron', bar(P(x0 - 5.2, Y + 4.2, z), P(x0 - 3.6, Y + 5.2, z), 0.03, 4), 0x24382e);
        }
        facade(x0, zc - len / 2, zc - 4, 2, 5.0, 0x3a4a3a, -1, true, 2.9);
        facade(x0, zc + 4, zc + len / 2, 2, 5.0, 0x3a4a3a, -1, true, 2.9);
        facade(x0 + w, zc - len / 2, zc + len / 2, 2, 5.0, 0x3a4a3a, 1, true, 3.1);
        // relógio e letreiro
        const clock = (() => {
            const c = document.createElement('canvas');
            c.width = c.height = 128;
            const g = c.getContext('2d');
            g.fillStyle = '#f4efe2';
            g.beginPath();
            g.arc(64, 64, 60, 0, 7);
            g.fill();
            g.strokeStyle = '#1c1a17';
            g.lineWidth = 6;
            g.stroke();
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2;
                g.fillStyle = '#1c1a17';
                g.fillRect(64 + Math.cos(a) * 48 - 2, 64 + Math.sin(a) * 48 - 2, 5, 5);
            }
            // 9h30 (D05)
            g.lineCap = 'round';
            g.lineWidth = 6;
            g.beginPath();
            g.moveTo(64, 64);
            g.lineTo(64 + Math.cos(Math.PI * 1.25) * 28, 64 + Math.sin(Math.PI * 1.25) * 28);
            g.stroke();
            g.lineWidth = 4;
            g.beginPath();
            g.moveTo(64, 64);
            g.lineTo(64, 110);
            g.stroke();
            const t = new THREE.CanvasTexture(c);
            t.colorSpace = THREE.SRGBColorSpace;
            return new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.5, roughness: 0.6 });
        })();
        for (const [dx, dz, ry] of [[-3.25, 0, -Math.PI / 2], [0, 3.25, 0], [0, -3.25, Math.PI]]) {
            const m = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), clock);
            m.position.set(x0 + 2.4 + dx, Y + 17.5, zc + dz);
            m.rotation.y = ry;
            scene.add(m);
        }
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.3), new THREE.MeshStandardMaterial({
            map: signTexture('S. P. R. — SANTOS', { w: 1024, h: 128, font: 'bold 70px Georgia, serif' }), roughness: 0.8
        }));
        sign.position.set(x0 - 0.12, Y + 6.4, zc + 13);
        sign.rotation.y = -Math.PI / 2;
        scene.add(sign);
    }

    // ---------- praça: chafariz, bancos, palmeiras imperiais ----------
    bt.add('ashlar', lathe([[3.2, 0], [3.2, 0.5], [2.9, 0.55], [2.9, 0.2], [0.5, 0.2], [0.4, 1.6], [1.3, 1.8], [1.3, 1.95], [0.3, 2.0], [0.2, 2.9], [0, 3.0]], 20, 82, Y, 121), 0xd9d2c4);
    for (const [bx, bz] of [[74, 108], [74, 134], [90, 108], [90, 134]]) {
        bt.add('wood', box(0.5, 0.08, 2.2, bx, Y + 0.45, bz), 0x5a4634);
        bt.add('iron', box(0.45, 0.45, 0.08, bx, Y, bz - 0.9), 0x1c1e22);
        bt.add('iron', box(0.45, 0.45, 0.08, bx, Y, bz + 0.9), 0x1c1e22);
    }
    scene.add(bt.build(null, { name: 'city' }));

    scene.add(instances(UNITS.window(), mats.paint, inst.window, { cast: false }));
    scene.add(instances(UNITS.shutters(), mats.paint, inst.shutters, { cast: false }));
    scene.add(instances(UNITS.door(), mats.paint, inst.door, { cast: false }));
    scene.add(instances(UNITS.balcony(), mats.paint, inst.balcony, { cast: quality.id === 'high' }));

    const palms = [];
    for (const z of [100, 114, 128, 142]) for (const x of [70, 94]) palms.push({ x, y: Y, z, scale: 0.9 + rnd() * 0.2, rot: rnd() * 6 });
    scene.add(instanceKit(createPalmKit({ kind: 'imperial', seed: 3 }), palms));
    const trees = [];
    for (let i = 0; i < quality.trees; i++) {
        const z = -420 + rnd() * 840;
        if (reserved(z - 5, z + 5, 0)) continue;
        trees.push({ x: 64.2, y: Y, z, scale: 0.55 + rnd() * 0.25, rot: rnd() * 6 });
    }
    trees.push({ x: 78, y: Y, z: 104, scale: 0.8, rot: 1 }, { x: 86, y: Y, z: 139, scale: 0.85, rot: 2 });
    scene.add(instanceKit(createTreeKit({ kind: 'round', seed: 8 }), trees));

    void rbox;
    void cyl;
    return { update() {} };
}
