/**
 * Quimera — eixo ACESSÓRIO.
 *
 * Cada kit prende um ou mais itens aos sockets do hero.js (mão, costas, cintura) e diz como
 * o personagem os apresenta (`pose`):
 *   present  antebraço dobrado à frente, item erguido na altura do peito
 *   staff    braço adiantado segurando um cajado apoiado no chão
 *   hold     modo `hold` do hero.js (lanterna erguida)
 *   low      braço solto ao lado (espada, âncora, laço)
 *   free     mãos livres (item nas costas ou no ombro)
 *
 * Eixos do socket da mão: origem no punho fechado, +Y sai pelo lado do polegar (direção de
 * lâmina/cabo). Itens que precisam ficar no prumo (frasco, frigideira, cajado, âncora) usam
 * `upright` — mantêm a orientação do personagem e só acompanham a posição da mão.
 * Medidas em metros do adulto canônico (presos com worldScale:false).
 */
import * as THREE from 'three';
import { TAU, lerp, smooth, revolve, blob, tube, surface, extrude, shapeOf, pill, xf, mesh, group, loop } from './sculpt.js';
import { starShape } from './heads.js';

/** Prende à mão direita mantendo o prumo; character.js realinha depois de sobrepor o braço. */
const up = (hero, obj) => {
    obj.userData.upright = true;
    hero.attach('handR', obj, { worldScale: false, upright: true });
    return obj;
};
const tag = (o) => {
    o.traverse((c) => {
        c.userData.slot = 'accessory';
    });
    return o;
};

/** Katana: lâmina curva de seção em losango (sori de 2,5 cm), tsuba, cabo trançado. Cabo em −Y…0, lâmina em +Y. */
function katana(B, K, { sheath = false } = {}) {
    const L = 0.7;
    const curve = (t) => -0.03 * t * t;
    const blade = surface(4, 24, (u, v, p) => {
        const t = v;
        const w = 0.014 * (1 - 0.35 * smooth(0.85, 1, t)) * (1 - smooth(0.93, 1, t));
        const c = [[0, w], [0.0032, 0], [0, -w], [-0.0032, 0], [0, w]][Math.round(u * 4)];
        p.set(c[0] * (1 - smooth(0.9, 1, t)), 0.03 + t * L, curve(t) + c[1] + 0.006 * smooth(0.9, 1, t));
    });
    const scab = tube(Array.from({ length: 9 }, (_, i) => [0, 0.03 + (i / 8) * (L + 0.02), curve(i / 8)]), 0.0125, { segs: 12, sx: 0.55, sz: 1.5, steps: 24 });
    const tsuba = xf(revolve([[0, -0.003], [0.034, -0.003], [0.036, 0], [0.034, 0.003], [0, 0.003]], { segs: 28, sz: 0.85 }), { p: [0, 0.028, 0] });
    const grip = tube([[0, -0.19, 0.004], [0, 0.026, 0]], 0.0125, { segs: 12, sx: 0.7, sz: 1.25, cap: 0.4 });
    const wraps = Array.from({ length: 9 }, (_, i) => xf(loop((a) => [Math.cos(a) * 0.0105, 0.004 * Math.sin(a * 2), Math.sin(a) * 0.017], 0.0022, 14), { p: [0, -0.17 + i * 0.022, 0.003] }));
    return group(
        mesh(sheath ? scab : blade, sheath ? B.paint(0x15151b, 0.25, 0.9) : B.metal(0xe4e8ee, 0.14, { clean: true })),
        mesh([tsuba], B.metal(K.accent, 0.3)),
        mesh(grip, B.leather(0x16161a)),
        mesh(wraps, B.cloth(sheath ? K.accent : K.primary), { shadow: false })
    );
}

const ACC = {
    /** Arara no ombro esquerdo: corpo, cabeça, bico curvo, asas dobradas e cauda longa. Balança e vira a cabeça. */
    pirate({ B, A, add }) {
        const red = B.feather(0xc8281e, { roughness: 0.55 });
        const body = xf(blob(0.042, 0.065, 0.045, { segs: 20, rings: 14, deform: (p) => {
            p.z -= 0.012 * (p.y / 0.065) ** 2;
        } }), { r: [0.3, 0, 0] });
        const head = new THREE.Group();
        head.position.set(0, 0.07, 0.018);
        head.add(mesh(blob(0.03, 0.031, 0.033, { segs: 18, rings: 12 }), red));
        head.add(mesh(tube([[0, 0.006, 0.026], [0, 0.004, 0.046], [0, -0.012, 0.055], [0, -0.026, 0.047]], (t) => 0.013 * (1 - 0.8 * t), { segs: 10, sz: 0.75 }), B.paint(0xe9dfc2, 0.35, 0.5)));
        head.add(mesh(tube([[0, -0.012, 0.024], [0, -0.02, 0.038], [0, -0.024, 0.043]], (t) => 0.008 * (1 - 0.6 * t), { segs: 8 }), B.paint(0x1a1818, 0.4, 0.4)));
        for (const sd of [-1, 1]) {
            head.add(mesh(xf(blob(0.011, 0.012, 0.004, { segs: 10, rings: 6 }), { r: [0, sd * 1.1, 0], p: [sd * 0.024, 0.006, 0.018] }), B.paint(0xf2efe6, 0.6, 0.1), { shadow: false }));
            head.add(mesh(xf(blob(0.004, 0.004, 0.003, { segs: 8, rings: 6 }), { p: [sd * 0.0275, 0.007, 0.021] }), B.paint(0x0a0a0a, 0.1, 1), { shadow: false }));
        }
        const wings = [-1, 1].map((sd) => surface(6, 10, (u, v, p) => {
            const w = 0.03 * Math.sin(Math.PI * Math.pow(v, 0.6));
            p.set(sd * (0.04 + 0.006 * Math.sin(u * 3)), 0.04 - v * 0.14, -0.012 - v * 0.05 + (u - 0.5) * 2 * w);
        }));
        const tail = [0, 1, 2].map((i) => surface(4, 8, (u, v, p) => {
            p.set((u - 0.5) * 0.03 * (1 - v * 0.7) + (i - 1) * 0.012 * v, -0.04 - v * (0.2 - Math.abs(i - 1) * 0.04), -0.03 - v * 0.09 - 0.003 * i);
        }));
        const feet = [-1, 1].map((sd) => tube([[sd * 0.016, -0.05, 0.01], [sd * 0.018, -0.068, 0.022], [sd * 0.018, -0.074, 0.04]], 0.0045, { segs: 6 }));
        const bird = group(mesh(body, red), head, mesh([wings[0], wings[1]], B.feather(0x1f5fc0, { roughness: 0.5 })),
            mesh([tail[0], tail[2]], B.feather(0x1f5fc0, { roughness: 0.5 })), mesh([tail[1]], red), mesh(feet, B.paint(0x3a3632, 0.6, 0.1)),
            mesh(xf(blob(0.03, 0.035, 0.02, { segs: 14, rings: 10 }), { p: [0, -0.005, 0.03] }), B.feather(0xf0c020, { roughness: 0.55 })));
        const p = new THREE.Vector3();
        A.chest.point(p, 1.45, 0.9, 0.004);
        const holder = new THREE.Group();
        holder.add(bird);
        bird.position.y = 0.076;
        bird.rotation.y = -0.35;
        add('chest', tag(holder), p);
        return { pose: 'free', update: (t) => {
            bird.position.y = 0.076 + Math.sin(t * 2.1) * 0.003;
            head.rotation.y = Math.sin(t * 0.7) * 0.5 + Math.sin(t * 3.1) * 0.06;
            head.rotation.z = Math.sin(t * 0.9 + 1) * 0.18;
        } };
    },
    /** Âncora de ferro pendurada pela argola: haste, cepo com esferas, braços em arco e duas unhas. */
    sailor({ B, hero }) {
        const iron = B.metal(0x4a4f57, 0.5);
        const shank = tube([[0, -0.03, 0], [0, -0.5, 0]], (t) => 0.014 + 0.006 * t, { segs: 12 });
        const ringG = xf(loop((a) => [Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0], 0.008, 24), { p: [0, 0.012, 0] });
        const stock = tube([[-0.13, -0.09, 0], [0.13, -0.09, 0]], 0.011, { segs: 10 });
        const balls = [-1, 1].map((sd) => xf(blob(0.02, 0.02, 0.02, { segs: 12, rings: 8 }), { p: [sd * 0.135, -0.09, 0] }));
        const arms = tube(Array.from({ length: 13 }, (_, i) => {
            const a = lerp(-1.25, 1.25, i / 12);
            return [Math.sin(a) * 0.2, -0.33 - Math.cos(a) * 0.2, 0];
        }), (t) => 0.017 - 0.006 * Math.abs(t * 2 - 1), { segs: 12, steps: 36 });
        const flukes = [-1, 1].map((sd) => xf(extrude(shapeOf([[0, 0.065], [0.04, 0], [0, -0.03], [-0.04, 0]]), { depth: 0.014, bevel: 0.005 }), { r: [0, 0, -sd * 1.2], p: [sd * 0.19, -0.385, 0] }));
        const rope = Array.from({ length: 5 }, (_, i) => xf(loop((a) => [Math.cos(a) * 0.021, 0, Math.sin(a) * 0.021], 0.005, 16), { p: [0, -0.045 - i * 0.011, 0] }));
        const g = tag(group(mesh([shank, ringG, stock, ...balls, arms, ...flukes], iron), mesh(rope, B.cloth(0xcdb98a))));
        g.rotation.y = 0.5;
        up(hero, g);
        return { pose: 'low' };
    },
    /** Mochila a jato: casco branco, dois propulsores com bocal e chama que pulsa (escala 1 ± 0,18). */
    astronaut({ B, K, hero }) {
        const shellG = xf(pill(0.3, 0.42, 0.13, { n: 4, round: 0.4 }), { p: [0, -0.04, 0.085] });
        const panel = xf(pill(0.14, 0.2, 0.02, { n: 5 }), { p: [0, 0.0, 0.152] });
        const thr = [];
        const noz = [];
        const flames = [];
        for (const sd of [-1, 1]) {
            thr.push(xf(revolve([[0, 0.2], [0.04, 0.19], [0.05, 0.15], [0.05, -0.16], [0.042, -0.2], [0, -0.2]], { segs: 24 }), { p: [sd * 0.175, -0.05, 0.085] }));
            noz.push(xf(revolve([[0.03, 0], [0.036, -0.012], [0.05, -0.06], [0.052, -0.064], [0.044, -0.06], [0.03, -0.012], [0.024, 0]], { segs: 24 }), { p: [sd * 0.175, -0.25, 0.085] }));
            const f = mesh(revolve([[0, 0], [0.03, -0.01], [0.036, -0.05], [0.022, -0.13], [0, -0.22]], { segs: 16 }), B.glow(0xffa040, 5, 0x000000), { shadow: false });
            f.position.set(sd * 0.175, -0.3, 0.085);
            flames.push(f);
        }
        const led = xf(blob(0.012, 0.012, 0.006, { segs: 10, rings: 6 }), { p: [0, 0.07, 0.164] });
        const g = tag(group(mesh([shellG, ...thr], B.paint(K.primary, 0.42, 0.5)), mesh(panel, B.paint(0x20262e, 0.25, 0.8)),
            mesh(noz, B.metal(K.secondary, 0.4)), mesh(led, B.glow(K.accent, 3), { shadow: false }), ...flames));
        hero.attach('back', g, { worldScale: false });
        return { pose: 'free', view: 'back', update: (t) => {
            flames.forEach((f, i) => {
                const k = 1 + 0.18 * Math.sin(t * 31 + i * 2) + 0.1 * Math.sin(t * 47 + i);
                f.scale.set(1, k, 1);
            });
        } };
    },
    /** Espada e escudo fotogramétricos (assets.js) — o escudo liga a guarda do braço esquerdo. */
    warrior({ hero }) {
        hero.equip({ handR: 'sword', handL: 'shield' }).then((o) => Object.values(o).forEach(tag));
        return { pose: 'low' };
    },
    /** Cajado: madeira retorcida, três garras e orbe que pulsa (emissivo 2 ± 0,8). Fica apoiado no chão. */
    wizard({ B, K, hero }) {
        const wood = tube(Array.from({ length: 10 }, (_, i) => [0.012 * Math.sin(i * 1.3), -1.02 + i * 0.19, 0.012 * Math.cos(i * 1.7)]), (t) => 0.017 - 0.004 * t + 0.003 * Math.sin(t * 40), { segs: 12, steps: 60 });
        const claws = [0, 1, 2].map((i) => {
            const a = (i / 3) * TAU;
            return tube([[0, 0.68, 0], [Math.cos(a) * 0.05, 0.73, Math.sin(a) * 0.05], [Math.cos(a) * 0.062, 0.79, Math.sin(a) * 0.062], [Math.cos(a) * 0.03, 0.85, Math.sin(a) * 0.03]], (t) => 0.009 * (1 - 0.7 * t), { segs: 8 });
        });
        const bands = [0.1, 0.62].map((y) => xf(loop((a) => [Math.cos(a) * 0.017, 0, Math.sin(a) * 0.017], 0.005, 18, { sx: 2 }), { p: [0, y, 0] }));
        const orbM = B.glow(0x9a6aff, 2.4, 0x1a1030);
        const orb = mesh(blob(0.045, 0.045, 0.045, { segs: 24, rings: 16 }), orbM, { shadow: false });
        orb.position.y = 0.79;
        const g = tag(group(mesh([wood, ...claws], B.wood(0xffffff, { dark: true, rep: 5 })), mesh(bands, B.metal(K.accent, 0.28)), orb));
        up(hero, g);
        return { pose: 'staff', staff: g, update: (t) => {
            orb.scale.setScalar(1 + 0.05 * Math.sin(t * 2.4));
        } };
    },
    /** Katana embainhada nas costas e shuriken de quatro pontas na mão. */
    ninja({ B, K, hero }) {
        const k = katana(B, K, { sheath: true });
        k.rotation.set(0, 0, 2.5);
        k.position.set(0.16, 0.2, 0.05);
        hero.attach('back', tag(k), { worldScale: false });
        const star = group(mesh(extrude(starShape(4, 0.06, 0.018), { depth: 0.006, bevel: 0.0025 }), B.metal(0xb8bec8, 0.25, { clean: true })),
            mesh(xf(loop((a) => [Math.cos(a) * 0.012, Math.sin(a) * 0.012, 0], 0.0035, 16), {}), B.metal(0x3a3c42, 0.4)));
        star.position.set(0, 0.055, 0);
        star.rotation.y = Math.PI / 2;
        hero.attach('handR', tag(star), { worldScale: false });
        return { pose: 'present', view: 'back', update: (t) => {
            star.rotation.x = t * 1.2;
        } };
    },
    /** Frigideira de ferro com ovo frito (clara ondulada e gema brilhante). */
    chef({ B, hero }) {
        const pan = xf(revolve([[0, 0.004], [0.1, 0.004], [0.118, 0.012], [0.132, 0.04], [0.137, 0.042], [0.136, 0.036], [0.122, 0.006], [0.104, -0.004], [0, -0.004]], { segs: 48 }), { p: [0, 0, 0.21] });
        const handle = tube([[0, 0.03, 0.08], [0, 0.036, 0.0], [0, 0.03, -0.09]], (t) => 0.012 - 0.003 * Math.abs(t * 2 - 1), { segs: 10, sx: 0.7, sz: 1.3 });
        const white = xf(revolve([[0, 0.008], [0.04, 0.008], [0.062, 0.005], [0.07, 0.0], [0, 0]], { segs: 36, deform: (p, a) => {
            const k = 1 + 0.16 * Math.sin(a * 3 + 1) + 0.08 * Math.sin(a * 7);
            p.x *= k;
            p.z *= k;
        } }), { p: [0.008, 0.005, 0.2] });
        const yolk = xf(blob(0.024, 0.014, 0.024, { segs: 18, rings: 10 }), { p: [0.0, 0.016, 0.195] });
        const g = tag(group(mesh(pan, B.metal(0x2a2c30, 0.5)), mesh(handle, B.wood(0xffffff, { dark: true, rep: 6 })),
            mesh(white, B.paint(0xfbf9f2, 0.35, 0.6)), mesh(yolk, B.paint(0xf5a81c, 0.18, 1))));
        g.rotation.y = -0.25;
        up(hero, g);
        return { pose: 'present' };
    },
    /** Chave de boca grande: uma ponta aberta, outra em anel sextavado, corpo chanfrado. */
    robot({ B, hero }) {
        const sh = new THREE.Shape();
        sh.moveTo(-0.014, -0.13);
        sh.lineTo(0.014, -0.13);
        sh.lineTo(0.016, 0.1);
        sh.bezierCurveTo(0.05, 0.11, 0.058, 0.16, 0.036, 0.19);
        sh.lineTo(0.018, 0.176);
        sh.lineTo(0.018, 0.14);
        sh.lineTo(-0.018, 0.14);
        sh.lineTo(-0.018, 0.176);
        sh.lineTo(-0.036, 0.19);
        sh.bezierCurveTo(-0.058, 0.16, -0.05, 0.11, -0.016, 0.1);
        sh.lineTo(-0.014, -0.13);
        const head = new THREE.Shape();
        head.absarc(0, -0.16, 0.04, 0, TAU, false);
        const hole = new THREE.Path();
        for (let i = 0; i < 6; i++) hole[i ? 'lineTo' : 'moveTo'](Math.cos((i / 6) * TAU) * 0.021, -0.16 + Math.sin((i / 6) * TAU) * 0.021);
        hole.closePath();
        head.holes.push(hole);
        const g = tag(group(mesh([extrude(sh, { depth: 0.012, bevel: 0.004 }), extrude(head, { depth: 0.014, bevel: 0.004 })], B.metal(0xc4c9d0, 0.3))));
        g.position.y = 0.06;
        g.rotation.y = Math.PI / 2;
        hero.attach('handR', g, { worldScale: false });
        return { pose: 'present' };
    },
    /** Lanterna de madeira erguida (glTF) e mochila de lona com saco de dormir nas costas. */
    explorer({ B, K, hero }) {
        hero.equip({ handR: 'lantern' }).then((o) => Object.values(o).forEach(tag));
        const pack = xf(pill(0.27, 0.36, 0.15, { n: 3.2, round: 0.5 }), { p: [0, -0.08, 0.095] });
        const flap = surface(12, 8, (u, v, p) => {
            p.set((u - 0.5) * 0.25, 0.09 - 0.012 * (2 * u - 1) ** 2 - v * 0.02, 0.03 + v * 0.14);
            if (v > 0.8) p.y -= (v - 0.8) * 0.5;
        });
        const roll = tube([[-0.17, 0.135, 0.09], [0.17, 0.135, 0.09]], 0.055, { segs: 20, cap: 0.3 });
        const straps = [-0.09, 0.09].map((x) => xf(loop((a) => [0, Math.cos(a) * 0.06, Math.sin(a) * 0.06], 0.006, 20, { sz: 2.2 }), { p: [x, 0.135, 0.09] }));
        const pocket = xf(pill(0.16, 0.13, 0.05, { n: 3.5 }), { p: [0, -0.15, 0.175] });
        const g = tag(group(mesh([pack, pocket], B.cloth(K.secondary, { roughness: 0.9 })), mesh(flap, B.leather(K.accent, { albedo: true })),
            mesh(roll, B.cloth(0xb0603a, { denim: true })), mesh(straps, B.leather(0x3a281c))));
        hero.attach('back', g, { worldScale: false });
        return { pose: 'hold', view: 'back' };
    },
    /** Laço: cinco voltas de corda levemente desencontradas e uma ponta solta com nó. */
    cowboy({ B, hero }) {
        const coils = Array.from({ length: 5 }, (_, i) => loop((a) => [Math.cos(a) * (0.12 + 0.006 * Math.sin(a * 3 + i)) + i * 0.004 - 0.008, -0.13 + Math.sin(a) * (0.125 + 0.004 * i), (i - 2) * 0.009 + 0.004 * Math.sin(a * 2 + i)], 0.0062, 40));
        const tailR = tube([[0.02, -0.25, 0], [0.05, -0.34, 0.02], [0.03, -0.43, 0.0], [0.06, -0.5, 0.01]], 0.006, { segs: 8 });
        const knot = xf(blob(0.012, 0.016, 0.012, { segs: 10, rings: 8 }), { p: [0.06, -0.5, 0.01] });
        const g = tag(mesh([...coils, tailR, knot], B.cloth(0xc9ad74, { roughness: 0.9 })));
        const h = group(g);
        h.rotation.y = 1.2;
        up(hero, tag(h));
        return { pose: 'low' };
    },
    /** Machado (glTF) na direita e escudo redondo de tábuas com bossa e aro de ferro na esquerda. */
    viking({ B, K, hero }) {
        hero.equip({ handR: 'axe' }).then((o) => Object.values(o).forEach(tag));
        const disc = revolve([[0, 0.016], [0.06, 0.016], [0.3, 0.008], [0.31, 0.0], [0.3, -0.008], [0, -0.01]], { segs: 56 });
        const rim = loop((a) => [Math.cos(a) * 0.308, 0, Math.sin(a) * 0.308], 0.013, 56, { sx: 1.2 });
        const boss = xf(revolve([[0, 0.05], [0.03, 0.045], [0.055, 0.022], [0.07, 0.004], [0.085, 0], [0.085, -0.004], [0, -0.004]], { segs: 32 }), { p: [0, 0.016, 0] });
        const rivets = Array.from({ length: 8 }, (_, i) => xf(blob(0.008, 0.005, 0.008, { segs: 8, rings: 6 }), { p: [Math.cos((i / 8) * TAU) * 0.26, 0.014, Math.sin((i / 8) * TAU) * 0.26] }));
        const g = tag(group(mesh(disc, B.wood(0xd8a070, { rep: 2.5 })), mesh([rim, boss, ...rivets], B.metal(0x8a9098, 0.42))));
        g.rotation.x = Math.PI / 2;
        g.position.set(0, -0.02, 0.05);
        hero.attach('handL', group(g), { worldScale: false });
        hero.guardL = true;
        return { pose: 'low' };
    },
    /** Varinha: haste fina com espiral dourada e estrela de cinco pontas que brilha e gira. */
    fairy({ B, K, hero }) {
        const rod = tube([[0, -0.08, 0], [0, 0.3, 0]], (t) => 0.006 - 0.002 * t, { segs: 10 });
        const spiral = tube(Array.from({ length: 30 }, (_, i) => [Math.cos(i * 0.9) * 0.0075, -0.06 + i * 0.012, Math.sin(i * 0.9) * 0.0075]), 0.0016, { segs: 6, steps: 90 });
        const star = mesh(extrude(starShape(5, 0.05, 0.022), { depth: 0.014, bevel: 0.005 }), B.glow(K.accent, 2.6, 0x8a7a20), { shadow: false });
        star.position.y = 0.34;
        const g = tag(group(mesh(rod, B.paint(0xfaf4ea, 0.3, 0.7)), mesh(spiral, B.metal(0xe0b84a, 0.25, { clean: true }), { shadow: false }), star));
        g.rotation.set(0.25, 0, -0.2);
        up(hero, group(g));
        return { pose: 'present', update: (t) => {
            star.rotation.y = t * 1.6;
            star.scale.setScalar(1 + 0.08 * Math.sin(t * 5));
        } };
    },
    /** Katana desembainhada na mão e bainha laqueada na cintura. */
    samurai({ B, K, hero }) {
        const k = katana(B, K);
        k.rotation.y = Math.PI;
        hero.attach('handR', tag(k), { worldScale: false });
        const s = katana(B, K, { sheath: true });
        s.rotation.set(Math.PI + 0.5, 0, -0.1);
        s.position.set(0.03, 0.03, 0.02);
        hero.attach('hipL', tag(s), { worldScale: false });
        return { pose: 'low' };
    },
    /** Erlenmeyer de vidro (transmissão) com líquido verde luminoso e bolhas que sobem. */
    scientist({ B, K, hero }) {
        const prof = [[0, 0], [0.06, 0], [0.066, 0.008], [0.058, 0.03], [0.022, 0.115], [0.018, 0.13], [0.018, 0.17], [0.022, 0.174], [0.018, 0.176]];
        const glassM = mesh(revolve(prof, { segs: 40 }), B.glass(0xd8fff0, { thickness: 0.006, tint: 0.1, opacity: 0.22 }), { shadow: false });
        glassM.renderOrder = 3;
        const liquid = mesh(revolve([[0, 0.004], [0.056, 0.004], [0.061, 0.01], [0.054, 0.03], [0.036, 0.075], [0, 0.076]], { segs: 32 }), B.glow(K.accent, 1.3, 0x1a6a48), { shadow: false });
        const bubbles = [0, 1, 2, 3].map((i) => {
            const b = mesh(blob(0.005, 0.005, 0.005, { segs: 8, rings: 6 }), B.glow(0xd8fff0, 2.4), { shadow: false });
            b.userData.i = i;
            return b;
        });
        const g = tag(group(liquid, ...bubbles, glassM));
        g.position.y = -0.14;
        up(hero, group(g));
        return { pose: 'present', update: (t) => {
            for (const b of bubbles) {
                const k = (t * 0.45 + b.userData.i * 0.27) % 1;
                b.position.set(Math.sin(b.userData.i * 2.4 + t) * 0.012 * (1 - k), 0.07 + k * 0.1, Math.cos(b.userData.i * 1.7) * 0.01 * (1 - k));
                b.scale.setScalar(0.6 + k);
            }
        } };
    }
};

/**
 * Monta o acessório do kit. ctx: { B, K, A, hero, add(osso, obj, pos) }.
 * @returns {{ pose: string, update?: (t:number)=>void, staff?: THREE.Object3D }}
 */
export function buildAccessory(kit, ctx) {
    return ACC[kit.id](ctx);
}
