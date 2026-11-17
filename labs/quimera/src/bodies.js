/**
 * Quimera — eixo CORPO.
 *
 * Cada kit define (1) roupa, armadura, cores, calçado e biotipo nas opções do hero.js e
 * (2) peças rígidas modeladas aqui, presas aos ossos e assentadas na superfície medida do
 * corpo (ver anatomy.js): gola de marinheiro, painel do traje espacial, asas da fada,
 * saiote e ombreiras do samurai, coldre, crachá…
 *
 * Convenção das peças: geometria em coordenadas de repouso do corpo; `ctx.add(osso, mesh)`
 * converte para o espaço do osso. Lado esquerdo do personagem = +X.
 */
import * as THREE from 'three';
import { TAU, lerp, smooth, revolve, blob, tube, surface, extrude, shapeOf, pill, xf, mesh, group, loop } from './sculpt.js';
import { starShape } from './heads.js';

const _p = new THREE.Vector3();

/** Pano assentado no tórax: do polar inner(a) ao outer(a), com folga `off`. */
function drape(shell, inner, outer, off, nu = 56, nv = 8, fold = 0) {
    return surface(nu, nv, (u, v, p) => {
        const a = (u - 0.5) * TAU;
        shell.point(p, a, lerp(inner(a), outer(a), v), off + fold * Math.sin(a * 9 + v * 3) * v);
    });
}
/** Cordão/aro assentado na casca no polar fn(a). */
function cord(shell, polar, r, off = 0.004, opts = {}) {
    return loop((t) => {
        const a = t - Math.PI;
        shell.point(_p, a, typeof polar === 'function' ? polar(a) : polar, off);
        return [_p.x, _p.y, _p.z];
    }, r, 48, opts);
}
/** Aro em volta de um membro (braço, coxa) a uma fração t do osso. */
function band(A, bone, t, r, grow = 0.004, opts = {}) {
    const L = A.limb(bone, t);
    return loop((a) => [L.center.x + Math.cos(a) * (L.radius + grow), L.center.y, L.center.z + Math.sin(a) * (L.radius + grow)], r, 24, opts);
}

const EXTRAS = {
    /** Dragonas douradas: prato abaulado com franja canelada de 3,5 cm. */
    pirate({ B, K, A, add }) {
        for (const sd of [-1, 1]) {
            A.chest.point(_p, sd * 1.5, 0.98, 0.006);
            const g = revolve([[0, 0.012], [0.03, 0.011], [0.05, 0.004], [0.056, -0.004, 1], [0.058, -0.02], [0.056, -0.036], [0.05, -0.034], [0.05, -0.006]],
                { segs: 48, deform: (p, a, k) => {
                    const f = 1 + 0.05 * Math.sin(a * 22) * smooth(0.45, 0.6, k);
                    p.x *= f;
                    p.z *= f * 0.85;
                } });
            add('chest', mesh(xf(g, { r: [0, 0, -sd * 0.4], p: [_p.x + sd * 0.01, _p.y + 0.004, _p.z] }), B.metal(K.accent, 0.3)));
        }
    },
    /** Gola de marinheiro: V na frente (o decote desce até o polar 1,25) e aba quadrada nas costas. */
    sailor({ B, K, A, add }) {
        const inner = (a) => 0.52 + 0.72 * Math.exp(-((a / 0.55) ** 2));
        const outer = (a) => lerp(1.3, 1.52, smooth(1.9, 2.5, Math.abs(a))) - 0.18 * smooth(0.5, 1.5, Math.abs(a)) * (1 - smooth(1.6, 2.2, Math.abs(a)));
        add('chest', mesh(drape(A.chest, inner, outer, 0.009), B.cloth(0xf4f1ea, { sheen: 0.3 })));
        add('chest', mesh([cord(A.chest, (a) => outer(a) - 0.03, 0.0028, 0.012), cord(A.chest, (a) => outer(a) - 0.055, 0.0022, 0.012)], B.cloth(K.primary)));
        A.chest.point(_p, 0, 1.3, 0.016);
        const knot = xf(blob(0.016, 0.02, 0.012, { segs: 14, rings: 10 }), { p: [_p.x, _p.y, _p.z] });
        const tails = [-1, 1].map((sd) => surface(2, 8, (u, v, p) => {
            p.set(_p.x + sd * (0.006 + 0.02 * v) + (u - 0.5) * (0.018 + 0.012 * v), _p.y - 0.012 - 0.085 * v, A.frontZ(0, _p.y - 0.02 - 0.085 * v) + 0.012 - 0.004 * v);
        }));
        add('chest', mesh([knot, ...tails], B.cloth(K.accent, { sheen: 0.5 })));
    },
    /** Traje espacial: aro do pescoço, unidade de controle no peito e faixas laranja nos braços. */
    astronaut({ B, K, A, add }) {
        add('chest', mesh(cord(A.chest, 0.6, 0.016, 0.004, { sx: 0.8 }), B.metal(K.secondary, 0.35)));
        const cy = A.J.chest.y + 0.035;
        const z = A.frontZ(0, cy) + 0.012;
        const box = xf(pill(0.17, 0.115, 0.05, { n: 5, round: 0.3 }), { p: [0, cy, z] });
        const face = xf(pill(0.13, 0.075, 0.012, { n: 6, round: 0.3 }), { p: [0, cy + 0.004, z + 0.024] });
        const knob = xf(revolve([[0, 0], [0.012, 0], [0.013, 0.008], [0.009, 0.012], [0, 0.012]], { segs: 18 }), { r: [Math.PI / 2, 0, 0], p: [0.04, cy + 0.008, z + 0.03] });
        const ports = [-1, 1].map((sd) => xf(revolve([[0, 0], [0.011, 0], [0.012, 0.016], [0.008, 0.02], [0, 0.02]], { segs: 16 }), { r: [Math.PI, 0, 0], p: [sd * 0.05, cy - 0.057, z] }));
        add('chest', mesh(box, B.paint(K.primary, 0.45, 0.4)));
        add('chest', mesh([face], B.paint(0x20262e, 0.25, 0.8)));
        add('chest', mesh([knob, ...ports], B.metal(K.secondary, 0.35)));
        const leds = [0, 1, 2].map((i) => xf(blob(0.006, 0.006, 0.004, { segs: 10, rings: 6 }), { p: [-0.045 + i * 0.022, cy + 0.008, z + 0.031] }));
        add('chest', mesh(leds.slice(0, 2), B.glow(K.accent, 3), { shadow: false }));
        add('chest', mesh(leds.slice(2), B.glow(0x5ad0ff, 3), { shadow: false }));
        for (const s of ['L', 'R']) add(`arm${s}`, mesh(band(A, `arm${s}`, 0.42, 0.006, 0.004, { sx: 3 }), B.cloth(K.accent)));
    },
    warrior() {},
    /** Amuleto do mago: corrente que desce dos ombros ao esterno e gema engastada. */
    wizard({ B, K, A, add }) {
        const pol = (a) => lerp(1.22, 0.6, smooth(0.2, 2.2, Math.abs(a)));
        add('chest', mesh(cord(A.chest, pol, 0.0026, 0.006), B.metal(K.accent, 0.25, { clean: true }), { shadow: false }));
        A.chest.point(_p, 0, 1.25, 0.012);
        const bezel = xf(revolve([[0, 0], [0.019, 0], [0.021, 0.004], [0.016, 0.008], [0, 0.007]], { segs: 24 }), { r: [Math.PI / 2, 0, 0], p: [_p.x, _p.y - 0.012, _p.z] });
        add('chest', mesh(bezel, B.metal(K.accent, 0.25)));
        add('chest', mesh(xf(blob(0.013, 0.013, 0.008, { segs: 16, rings: 10 }), { p: [_p.x, _p.y - 0.012, _p.z + 0.008] }), B.glow(0x9a6aff, 2.6), { shadow: false }));
    },
    /** Ninja: faixas nos antebraços e bolsa de kunais presa à coxa direita. */
    ninja({ B, K, A, add }) {
        for (const s of ['L', 'R']) {
            add(`fore${s}`, mesh([0.25, 0.4, 0.55, 0.7].map((t) => band(A, `fore${s}`, t, 0.006, 0.003, { sx: 2.2 })), B.cloth(K.trim)));
        }
        const L = A.limb('thighR', 0.3);
        const x = L.center.x - L.radius - 0.012;
        add('thighR', mesh(xf(pill(0.03, 0.1, 0.07, { n: 4 }), { p: [x, L.center.y, L.center.z] }), B.leather(0x1c1a1c)));
        add('thighR', mesh([-0.03, 0.03].map((dy) => loop((a) => [L.center.x + Math.cos(a) * (L.radius + 0.004), L.center.y + dy, L.center.z + Math.sin(a) * (L.radius + 0.004)], 0.005, 24, { sx: 2 })), B.leather(0x2a2224)));
        const kunai = [-0.016, 0.016].map((dz) => tube([[x - 0.004, L.center.y + 0.04, L.center.z + dz], [x - 0.004, L.center.y + 0.085, L.center.z + dz]], 0.0045, { segs: 8 }));
        const rings = [-0.016, 0.016].map((dz) => xf(loop((a) => [0, Math.cos(a) * 0.01, Math.sin(a) * 0.01], 0.0025, 16), { p: [x - 0.004, L.center.y + 0.097, L.center.z + dz] }));
        add('thighR', mesh([...kunai, ...rings], B.metal(0x8a9098, 0.4)));
    },
    /** Dólmã do chef: duas fileiras de botões e lenço vermelho no pescoço. */
    chef({ B, K, A, add }) {
        const btn = [];
        for (const sd of [-1, 1]) {
            for (let i = 0; i < 4; i++) {
                const y = A.J.chest.y + 0.075 - i * 0.05;
                btn.push(xf(revolve([[0, 0], [0.008, 0], [0.009, 0.003], [0.005, 0.006], [0, 0.006]], { segs: 14 }), { r: [Math.PI / 2, 0, 0], p: [sd * 0.038, y, A.frontZ(sd * 0.038, y) + 0.001] }));
            }
        }
        add('chest', mesh(btn, B.paint(K.trim, 0.35, 0.6), { shadow: false }));
        add('chest', mesh(drape(A.chest, () => 0.5, (a) => 0.72 + 0.4 * Math.exp(-((a / 0.4) ** 2)), 0.01, 48, 6, 0.004), B.cloth(K.accent, { sheen: 0.5 })));
    },
    /** Robô: painel do peito com medidor em anel e LEDs; faróis nos ombros. */
    robot({ B, K, A, add }) {
        const cy = A.J.chest.y + 0.03;
        const plate = surface(16, 10, (u, v, p) => {
            const x = (u - 0.5) * 0.17;
            const y = cy + (v - 0.5) * 0.11;
            const e = Math.min(u, 1 - u, v, 1 - v);
            p.set(x, y, A.frontZ(x * 0.6, y) + 0.01 - 0.008 * smooth(0.1, 0, e));
        });
        add('chest', mesh(plate, B.paint(0x0b0e13, 0.15, 1)));
        const z = A.frontZ(0, cy) + 0.012;
        const gauge = xf(loop((a) => [Math.cos(a) * 0.026, Math.sin(a) * 0.026, 0], 0.004, 28), { p: [-0.035, cy, z] });
        const core = xf(blob(0.012, 0.012, 0.004, { segs: 14, rings: 8 }), { p: [-0.035, cy, z] });
        add('chest', mesh([gauge, core], B.glow(K.accent, 3.2), { shadow: false }));
        const bars = [0, 1, 2].map((i) => xf(pill(0.05 - i * 0.012, 0.007, 0.004, { n: 3 }), { p: [0.035 - i * 0.006, cy + 0.025 - i * 0.022, z] }));
        add('chest', mesh(bars, B.glow(K.trim, 2.6), { shadow: false }));
        for (const sd of [-1, 1]) {
            A.chest.point(_p, sd * 1.5, 0.95, 0.006);
            add('chest', mesh(xf(revolve([[0, 0], [0.022, 0], [0.024, 0.008], [0.018, 0.012], [0, 0.012]], { segs: 20 }), { p: [_p.x, _p.y, _p.z] }), B.metal(K.secondary, 0.4)));
            add('chest', mesh(xf(blob(0.014, 0.01, 0.014, { segs: 14, rings: 8 }), { p: [_p.x, _p.y + 0.014, _p.z] }), B.glow(K.trim, 2.8), { shadow: false }));
        }
    },
    /** Explorador: lenço no pescoço, duas bolsas no cinto e cantil na cintura. */
    explorer({ B, K, A, add }) {
        add('chest', mesh(drape(A.chest, () => 0.5, (a) => 0.74 + 0.36 * Math.exp(-((a / 0.45) ** 2)), 0.01, 48, 6, 0.004), B.cloth(K.secondary, { sheen: 0.3 })));
        const pol = 1.5;
        for (const az of [-0.62, 0.62]) {
            A.hips.point(_p, az, pol, 0.02);
            add('hips', mesh(xf(pill(0.07, 0.075, 0.035, { n: 4 }), { r: [0, az, 0], p: [_p.x, _p.y - 0.03, _p.z] }), B.leather(K.accent, { albedo: true })));
        }
        A.hips.point(_p, 1.75, pol, 0.03);
        const flask = xf(revolve([[0, -0.06], [0.04, -0.058], [0.052, -0.03], [0.052, 0.02], [0.036, 0.046], [0.014, 0.054, 1], [0.014, 0.07], [0.017, 0.072], [0.017, 0.084], [0, 0.085]], { segs: 32, sz: 0.5 }),
            { r: [0, 1.75, 0], p: [_p.x, _p.y - 0.06, _p.z] });
        add('hips', mesh(flask, B.paint(0x5d6b45, 0.5, 0.2)));
    },
    /** Cowboy: bandana em triângulo, estrela de xerife e coldre com revólver na direita. */
    cowboy({ B, K, A, add }) {
        add('chest', mesh(drape(A.chest, () => 0.5, (a) => 0.72 + 0.6 * Math.exp(-((a / 0.5) ** 2)), 0.011, 48, 7, 0.005), B.cloth(0xb0322a, { sheen: 0.4 })));
        const sy = A.J.chest.y + 0.04;
        const star = xf(extrude(starShape(6, 0.024, 0.012), { depth: 0.005, bevel: 0.0016 }), { p: [0.07, sy, A.frontZ(0.07, sy) + 0.005] });
        add('chest', mesh(star, B.metal(0xe0c060, 0.25), { shadow: false }));
        A.hips.point(_p, -1.7, 1.55, 0.022);
        const hx = _p.x;
        const hy = _p.y - 0.11;
        const hz = _p.z;
        const holster = xf(pill(0.04, 0.17, 0.085, { n: 3, deform: (p) => {
            const k = smooth(0.08, -0.08, p.y);
            p.z *= 1 - 0.4 * k;
        } }), { r: [0.2, 0, 0], p: [hx, hy, hz] });
        add('hips', mesh(holster, B.leather(K.primary, { albedo: true })));
        const grip = tube([[hx, hy + 0.07, hz + 0.01], [hx, hy + 0.11, hz - 0.012], [hx, hy + 0.14, hz - 0.05]], (t) => 0.016 - 0.003 * t, { segs: 12, sz: 0.7 });
        add('hips', mesh(grip, B.wood(0xffffff, { dark: true })));
        add('hips', mesh(xf(pill(0.022, 0.03, 0.05, { n: 3 }), { p: [hx, hy + 0.085, hz + 0.02] }), B.metal(0x70757c, 0.35)));
    },
    /** Viking: broches de ouro nas clavículas ligados por corrente e argolas de bronze nos braços. */
    viking({ B, K, A, add }) {
        const pts = [];
        for (const sd of [-1, 1]) {
            A.chest.point(_p, sd * 0.6, 0.98, 0.014);
            pts.push(_p.clone());
            add('chest', mesh(xf(revolve([[0, 0], [0.026, 0], [0.029, 0.005], [0.02, 0.011], [0.008, 0.016], [0, 0.017]], { segs: 28 }), { r: [Math.PI / 2 - 0.5, 0, 0], p: [_p.x, _p.y, _p.z] }), B.metal(0xd4a640, 0.28)));
        }
        const mid = pts[0].clone().lerp(pts[1], 0.5);
        mid.y -= 0.045;
        mid.z = A.frontZ(0, mid.y) + 0.014;
        add('chest', mesh(tube([pts[0], mid, pts[1]], 0.003, { segs: 6, steps: 16 }), B.metal(0xd4a640, 0.28, { clean: true }), { shadow: false }));
        for (const s of ['L', 'R']) add(`arm${s}`, mesh([0.5, 0.56].map((t) => band(A, `arm${s}`, t, 0.0065, 0.003)), B.metal(0xa8793a, 0.36)));
    },
    /**
     * Asas da fada: dois pares de membranas translúcidas (contorno w(u) = W·sen(π·u^0,8)),
     * com três nervuras. Batem em torno do eixo vertical: θ = θ0 + 0,3·sen(9t) (ver update).
     */
    fairy({ B, K, hero }) {
        const root = new THREE.Group();
        const wings = [];
        for (const sd of [-1, 1]) {
            for (const lower of [0, 1]) {
                const len = lower ? 0.34 : 0.56;
                const W = lower ? 0.1 : 0.13;
                const tilt = lower ? -0.75 : 0.5;
                const pt = (u, v, p) => {
                    const w = W * Math.sin(Math.PI * Math.pow(u, 0.8));
                    const x = u * len;
                    const y = v * w + 0.25 * w * u;
                    p.set(sd * (x * Math.cos(tilt) - y * Math.sin(tilt)), x * Math.sin(tilt) + y * Math.cos(tilt), 0.03 * Math.sin(u * 2.4) + 0.012 * v * v);
                };
                const membrane = surface(18, 8, (u, v, p) => pt(u, v * 2 - 1, p));
                const veins = [-0.45, 0, 0.5].map((vv) => {
                    const pts = [];
                    for (let i = 0; i <= 8; i++) {
                        const q = new THREE.Vector3();
                        pt(0.02 + (i / 8) * 0.9, vv, q);
                        pts.push(q);
                    }
                    return tube(pts, (t) => 0.003 * (1 - 0.7 * t), { segs: 6, steps: 16 });
                });
                const g = group(
                    mesh(membrane, B.feather(lower ? K.secondary : K.trim, { roughness: 0.25, opacity: 0.55, emissive: lower ? K.secondary : K.primary, glow: 0.35 }), { shadow: false }),
                    mesh(veins, B.glow(0xfff2c0, 1.4, 0x8a7a40), { shadow: false })
                );
                g.position.set(sd * 0.03, lower ? -0.03 : 0.03, 0.015);
                g.userData.sd = sd;
                g.userData.lower = lower;
                root.add(g);
                wings.push(g);
            }
        }
        // mesmo referencial do socket das costas, mas preso direto ao osso (o socket fica livre para o acessório)
        const sk = hero.sockets.back;
        root.position.copy(sk.position);
        root.quaternion.copy(sk.quaternion);
        sk.parent.add(root);
        return (t) => {
            for (const w of wings) {
                const f = Math.sin(t * 9 + w.userData.lower * 0.9) * 0.3 + Math.sin(t * 1.3) * 0.12;
                w.rotation.y = w.userData.sd * (-0.55 - f);
            }
        };
    },
    /**
     * Samurai: saiote (kusazuri) de cinco painéis com quatro lâminas cada, pendurados na
     * cintura, e ombreiras (sode) de cinco lâminas presas aos braços. Cada lâmina sobrepõe
     * a de baixo em degrau de 4 mm, com cordão dourado na emenda.
     */
    samurai({ B, K, A, add }) {
        const lac = B.paint(K.primary, 0.3, 0.8, { side: THREE.DoubleSide });
        const gold = B.metal(K.accent, 0.26, { clean: true });
        const y0 = A.J.hips.y + 0.05;
        const plates = [];
        const laces = [];
        for (const az of [-0.5, 0.5, -1.62, 1.62, Math.PI]) {
            const half = az === Math.PI ? 0.5 : 0.36;
            const at = (u, t, p) => {
                const a = az + (u - 0.5) * 2 * half;
                const r = A.hips.radius(a, 1.5) + 0.014 + 0.05 * t + 0.004 * Math.floor(t * 3.999);
                p.set(Math.sin(a) * r, y0 - t * 0.27, Math.cos(a) * r);
            };
            plates.push(surface(12, 16, (u, v, p) => at(u, v, p)));
            for (let i = 1; i < 4; i++) {
                const pts = [];
                for (let k = 0; k <= 8; k++) {
                    const q = new THREE.Vector3();
                    at(k / 8, i / 4 + 0.001, q);
                    pts.push(q);
                }
                laces.push(tube(pts, 0.0028, { segs: 6, steps: 12 }));
            }
        }
        add('hips', mesh(plates, lac));
        add('hips', mesh(laces, gold, { shadow: false }));
        for (const sd of [-1, 1]) {
            const s = sd > 0 ? 'L' : 'R';
            const L = A.limb(`arm${s}`, 0.3);
            const top = A.J[`arm${s}`].y + 0.045;
            const at = (u, t, p) => {
                const a = (u - 0.5) * 2.2;
                const r = L.radius + 0.024 + 0.02 * t + 0.003 * Math.floor(t * 4.999);
                p.set(L.center.x + sd * Math.cos(a) * r, top - t * 0.2, L.center.z + Math.sin(a) * r);
            };
            add(`arm${s}`, mesh(surface(12, 15, (u, v, p) => at(u, v, p)), lac));
            const lc = [];
            for (let i = 1; i < 5; i++) {
                const pts = [];
                for (let k = 0; k <= 8; k++) {
                    const q = new THREE.Vector3();
                    at(k / 8, i / 5 + 0.001, q);
                    pts.push(q);
                }
                lc.push(tube(pts, 0.0026, { segs: 6, steps: 12 }));
            }
            add(`arm${s}`, mesh(lc, gold, { shadow: false }));
        }
    },
    /** Jaleco do cientista: bolso com três canetas à esquerda e crachá à direita. */
    scientist({ B, K, A, add }) {
        const py = A.J.chest.y + 0.01;
        const pocket = surface(8, 8, (u, v, p) => {
            const x = 0.065 + (u - 0.5) * 0.06;
            const y = py - v * 0.07 + 0.012 * v * (2 * u - 1) ** 2;
            p.set(x, y, A.frontZ(x, y) + 0.004 + 0.004 * Math.sin(v * Math.PI));
        });
        add('chest', mesh(pocket, B.cloth(0xe4e1d8, { sheen: 0.2 })));
        [0x2a5ac8, 0xc83a3a, 0x202024].forEach((c, i) => {
            const x = 0.048 + i * 0.017;
            const z = A.frontZ(x, py) + 0.008;
            add('chest', mesh(tube([[x, py - 0.03, z], [x, py + 0.028, z]], 0.0038, { segs: 8 }), B.paint(c, 0.3, 0.7), { shadow: false }));
        });
        const by = A.J.chest.y;
        const bz = A.frontZ(-0.07, by) + 0.006;
        const sh = shapeOf([[-0.024, -0.034], [0.024, -0.034], [0.024, 0.034], [-0.024, 0.034]], { curved: false });
        add('chest', mesh(xf(extrude(sh, { depth: 0.003, bevel: 0.001 }), { p: [-0.07, by - 0.02, bz] }), B.paint(0xf6f6f2, 0.4, 0.5), { shadow: false }));
        add('chest', mesh(xf(pill(0.044, 0.014, 0.003, { n: 6 }), { p: [-0.07, by + 0.004, bz + 0.002] }), B.paint(K.secondary, 0.4, 0.5), { shadow: false }));
        add('chest', mesh(xf(pill(0.012, 0.016, 0.006, { n: 4 }), { p: [-0.07, by + 0.02, bz + 0.001] }), B.metal(0xb0b4ba, 0.3), { shadow: false }));
    }
};

/** Opções de roupa/biotipo do hero.js por kit. */
export const BODIES = {
    pirate: { build: 0.3, height: 1.8, top: 'shirt', sleeves: 'puff', topColor: 0xe8d9b0, vest: 0x6b1d2a, bottom: 'breeches', bottomColor: 0x232838, shoes: 'tall', shoeColor: 0x1e1612, belt: 0x8e1c26, buckle: 0xc9a227 },
    sailor: { build: 0.1, height: 1.76, top: 'shirt', sleeves: 'long', topColor: 0x1d3a6e, trimColor: 0xf2f0ea, bottom: 'pants', bottomColor: 0xf2f0ea, shoes: 'shoes', shoeColor: 0x16161a, belt: null },
    astronaut: { build: 0.2, height: 1.8, proportions: { bulk: 1.22, depth: 1.16 }, top: 'shirt', sleeves: 'long', topColor: 0xe8e4dc, trimColor: 0xc45c2a, bottom: 'pants', bottomColor: 0xe2ded6, shoes: 'tall', shoeColor: 0xbdb9b1, gloves: 'leather', gloveColor: 0x6a7380, belt: 0x6a7380, buckle: 0xd4783a },
    warrior: { build: 0.7, height: 1.86, top: 'mail', bottom: 'pants', bottomColor: 0x2a2a30, armor: 'plate', armorColor: 0xb8bec8, cape: 'short', capeColor: 0x7a1f22, trimColor: 0xc9a227, belt: 0x3a2618 },
    wizard: { build: -0.2, height: 1.8, top: 'robe', sleeves: 'wide', topColor: 0x3a2a6e, trimColor: 0xd4b85a, bottom: 'none', shoes: 'shoes', belt: 0x6a4a2a, mantle: true, cape: 'long', capeColor: 0x1e1838 },
    ninja: { build: 0.1, height: 1.74, top: 'tunic', sleeves: 'long', topColor: 0x1c1c24, trimColor: 0x5a1a1a, bottom: 'pants', bottomColor: 0x202028, shoes: 'shoes', shoeColor: 0x121216, belt: 0xa33a3a, buckle: 0x7a2a2a, gloves: 'leather', gloveColor: 0x141418 },
    chef: { fat: 0.55, build: 0.1, height: 1.74, top: 'shirt', sleeves: 'long', topColor: 0xf4f1ea, bottom: 'pants', bottomColor: 0x2a2a32, shoes: 'shoes', shoeColor: 0x18181c, apron: 0xe6e0d2, belt: null },
    robot: { build: 0.5, height: 1.84, top: 'mail', armor: 'plate', armorColor: 0x8a929c, bottom: 'pants', bottomColor: 0x2a3038, gloves: 'gauntlet', shoes: 'sabatons', belt: 0x2a3038, buckle: 0x3ad0e8 },
    explorer: { build: 0.2, height: 1.78, top: 'shirt', sleeves: 'short', topColor: 0xcdb47c, vest: 0x4a5a38, bottom: 'shorts', bottomColor: 0xa98c58, shoes: 'tall', shoeColor: 0x6b3a22, belt: 0x6b3a22 },
    cowboy: { build: 0.3, height: 1.82, top: 'shirt', sleeves: 'long', topColor: 0xc9b48a, vest: 0x6b3a22, bottom: 'pants', bottomColor: 0x3d4a6e, fabricTex: 'denim_fabric', shoes: 'boots', shoeColor: 0x4a2a18, belt: 0x2a1a12, buckle: 0xd8d2c4 },
    viking: { build: 0.9, height: 1.9, top: 'tunic', sleeves: 'short', topColor: 0x6b3a22, trimColor: 0xd8c8b0, bottom: 'pants', bottomColor: 0x4a3020, shoes: 'tall', shoeColor: 0x3a281c, armor: 'leather', mantle: true, fur: true, cape: 'short', capeColor: 0x4a3020, belt: 0x2e2018, buckle: 0xb8bec8 },
    fairy: { sex: 'f', build: -0.4, height: 1.6, top: 'dress', sleeves: 'puff', topColor: 0xe8a0c4, trimColor: 0xd0f0e8, bottom: 'none', shoes: 'barefoot', belt: 0xb8e0d0, buckle: 0xf0e070 },
    samurai: { build: 0.4, height: 1.78, top: 'tunic', sleeves: 'wide', topColor: 0x2a2a38, trimColor: 0xc9a227, bottom: 'pants', bottomColor: 0x1c1c22, armor: 'half', armorColor: 0x8a1d2a, shoes: 'shoes', shoeColor: 0x2a2018, belt: 0xc9a227, gloves: 'leather', gloveColor: 0x1c1c22 },
    scientist: { build: -0.3, height: 1.76, top: 'tunic', sleeves: 'long', topColor: 0xf2f0ea, trimColor: 0xd9d6ce, bottom: 'pants', bottomColor: 0x3a4a5a, shoes: 'shoes', shoeColor: 0x2a2420, belt: null }
};

export function bodyOptions(kit) {
    return BODIES[kit.id];
}

/** Monta as peças do corpo; devolve a função de animação (ou null). ctx: { B, K, A, hero, add }. */
export function buildBodyExtras(kit, ctx) {
    return EXTRAS[kit.id](ctx) || null;
}
