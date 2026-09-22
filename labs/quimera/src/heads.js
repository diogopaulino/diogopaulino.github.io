/**
 * Cabeças dos 14 kits. Cada Group nasce centrado na origem;
 * character.js posiciona em LAYOUT.HEAD_Y.
 */

import { makeCtx, addFace, tagSlot, glass } from './kit.js?v=4';
import { headGeometry } from '../../shared/realism.js';
import * as THREE from 'three';

/**
 * Aba do elmo samurai: as pontas sobem e o meio desce cerca de 10 cm.
 */
const SAMURAI_BRIM = (() => {
    const p = [
        [-0.25, 0.06],
        [-0.16, 0.00],
        [0, -0.04],
        [0.16, 0.00],
        [0.25, 0.06],
        [0.25, 0.11],
        [0.16, 0.05],
        [0, 0.01],
        [-0.16, 0.05],
        [-0.25, 0.11]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.005,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.03);
    return g;
})();

/**
 * Máscara do samurai (menpo): o nariz sobe cerca de 9 cm e o queixo
 * desce cerca de 10 cm abaixo das laterais.
 */
const SAMURAI_PLATE = (() => {
    const p = [
        [-0.18, 0.02],
        [-0.06, 0.035],
        [-0.025, 0.07],
        [0, 0.11],
        [0.025, 0.07],
        [0.06, 0.035],
        [0.18, 0.02],
        [0.18, -0.03],
        [0.07, -0.03],
        [0.02, -0.08],
        [0, -0.13],
        [-0.02, -0.08],
        [-0.07, -0.03],
        [-0.18, -0.03]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.055,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.004,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.022);
    return g;
})();

/**
 * Testeira do guerreiro: a barra desce numa ponta no meio, cerca de 10 cm.
 */
const WARRIOR_BROW = (() => {
    const p = [
        [-0.18, 0.045],
        [0.18, 0.045],
        [0.18, -0.02],
        [0.07, -0.02],
        [0.02, -0.08],
        [0, -0.12],
        [-0.02, -0.08],
        [-0.07, -0.02],
        [-0.18, -0.02]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.045,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.004,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.018);
    return g;
})();

/**
 * Crista do elmo: vista de lado, o pico sobe cerca de 16 cm acima da base.
 * Extrusão em +Z (espessura); rotation.y = PI/2 põe o perfil no plano lateral.
 */
const WARRIOR_CREST = (() => {
    const p = [
        [-0.13, 0.00],
        [-0.07, 0.05],
        [0.00, 0.16],
        [0.06, 0.08],
        [0.13, 0.02],
        [0.14, 0.00],
        [0.08, -0.035],
        [0.00, -0.035],
        [-0.11, -0.035]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.045,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.004,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.022);
    return g;
})();

/**
 * Visor do robô: as pontas ficam baixas e o centro sobe cerca de 10 cm.
 */
const ROBOT_VISOR = (() => {
    const p = [
        [-0.21, -0.03],
        [-0.21, 0.02],
        [-0.10, 0.05],
        [0, 0.12],
        [0.10, 0.05],
        [0.21, 0.02],
        [0.21, -0.03],
        [0.10, -0.05],
        [0, -0.02],
        [-0.10, -0.05]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.005,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.02);
    return g;
})();

/**
 * Máscara do ninja: o nariz desce cerca de 7 cm e o queixo termina em ponta.
 */
const NINJA_MASK = (() => {
    const p = [
        [-0.20, 0.06],
        [-0.08, 0.07],
        [0, 0.00],
        [0.08, 0.07],
        [0.20, 0.06],
        [0.18, -0.01],
        [0.07, -0.06],
        [0, -0.13],
        [-0.07, -0.06],
        [-0.18, -0.01]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.004,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.015);
    return g;
})();

function build(kit, fn, { skull = true } = {}) {
    const ctx = makeCtx(kit);
    if (skull) ctx.add.mesh(headGeometry(ctx.L.HEAD_R, 'human'), ctx.mats.skin);
    fn(ctx);
    return tagSlot(ctx.group, 'head');
}

const HEADS = {
    pirate: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.lathe([[0.05, 0.02], [0.3, 0.06], [0.28, 0.16], [0.08, 0.22]], mats.primary, [0, 0.02, 0]);
        add.sphere(0.07, mats.primary, [-0.24, 0.14, -0.16]);
        add.sphere(0.055, mats.primary, [-0.30, 0.08, -0.12]);
        add.box(0.16, 0.08, 0.04, mats.dark, [0.12, 0.05, 0.26], [0.2, 0.4, 0]);
        add.cyl(0.01, 0.01, 0.58, mats.dark, [0, 0.12, 0.08], [0, 0, 1.05]);
        add.lathe([[0.04, 0], [0.14, 0.02], [0.1, 0.1], [0.03, 0.16]], mats.dark, [0, -0.28, 0.12]);
        add.torus(0.04, 0.008, mats.accent, [0.28, -0.05, 0.1], [1.2, 0, 0.2]);
    }),

    sailor: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.cyl(0.24, 0.26, 0.12, mats.white, [0, 0.26, 0]);
        add.cyl(0.32, 0.32, 0.035, mats.white, [0, 0.20, 0]);
        add.box(0.08, 0.12, 0.02, mats.primary, [0, 0.22, 0.26]);
        add.lathe([[0.02, 0], [0.08, 0.04], [0.05, 0.14], [0.015, 0.22]], mats.dark, [0, -0.02, -0.2], [0.4, 0, 0]);
    }),

    astronaut: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.cyl(0.28, 0.30, 0.12, mats.secondary, [0, -0.18, 0]);
        add.sphere(0.36, glass(0x9ad4ea), [0, 0.04, 0.04]);
        add.torus(0.30, 0.03, mats.secondary, [0, -0.02, 0.02], [Math.PI / 2, 0, 0]);
        add.box(0.07, 0.04, 0.05, mats.accent, [0.30, 0.1, 0]);
        add.cyl(0.018, 0.018, 0.14, mats.secondary, [0.34, 0.2, 0]);
        add.sphere(0.03, mats.glow, [0.34, 0.28, 0]);
    }),

    warrior: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx, { smile: false });
        add.lathe([[0.1, -0.16], [0.3, -0.02], [0.32, 0.12], [0.18, 0.26], [0.06, 0.34]], mats.accent, [0, -0.02, 0]);
        const crest = add.mesh(WARRIOR_CREST, mats.primary, [0, 0.24, 0], [0, Math.PI / 2, 0]);
        crest.name = 'warriorCrest';
        const brow = add.mesh(WARRIOR_BROW, mats.secondary, [0, 0.02, 0.22]);
        brow.name = 'warriorBrow';
        add.box(0.12, 0.1, 0.18, mats.secondary, [0, -0.08, 0.22]);
        add.sphere(0.1, mats.dark, [0, -0.18, 0.12], null, [1.3, 0.45, 0.7]);
    }),

    wizard: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.lathe([[0.24, 0], [0.28, 0.06], [0.14, 0.28], [0.06, 0.52], [0.015, 0.74]], mats.primary, [0, 0.16, -0.04], [-0.18, 0, 0]);
        add.cyl(0.30, 0.30, 0.05, mats.accent, [0, 0.22, 0]);
        add.sphere(0.04, mats.glow, [0, 0.86, -0.14]);
        add.lathe([[0.03, 0], [0.16, 0.04], [0.12, 0.16], [0.04, 0.26]], mats.white, [0, -0.34, 0.08]);
        add.sphere(0.05, mats.white, [0, -0.08, 0.28]);
    }),

    ninja: (kit) => build(kit, (ctx) => {
        const { add, mats, group } = ctx;
        add.mesh(headGeometry(ctx.L.HEAD_R, 'human'), mats.primary);
        const mask = add.mesh(NINJA_MASK, mats.white, [0, 0.06, 0.20]);
        mask.name = 'ninjaMask';
        add.sphere(0.026, mats.iris, [-0.08, 0.05, 0.26]);
        add.sphere(0.026, mats.iris, [0.08, 0.05, 0.26]);
        add.sphere(0.01, mats.dark, [-0.074, 0.054, 0.284]);
        add.sphere(0.01, mats.dark, [0.086, 0.054, 0.284]);
        add.box(0.22, 0.04, 0.04, mats.accent, [0, 0.18, 0.18]);
        group.userData.lids = [];
    }, { skull: false }),

    chef: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.cyl(0.16, 0.18, 0.12, mats.white, [0, 0.28, 0]);
        add.cyl(0.22, 0.20, 0.28, mats.white, [0, 0.50, 0]);
        add.lathe([[0.04, 0], [0.2, 0.03], [0.22, 0.1], [0.08, 0.16]], mats.white, [0, 0.58, 0]);
        add.box(0.16, 0.04, 0.04, mats.dark, [0, -0.06, 0.27]);
        add.sphere(0.03, mats.dark, [-0.07, -0.06, 0.27]);
        add.sphere(0.03, mats.dark, [0.07, -0.06, 0.27]);
    }),

    robot: (kit) => build(kit, (ctx) => {
        const { add, mats, group } = ctx;
        add.lathe([[0.14, -0.18], [0.26, -0.04], [0.26, 0.12], [0.16, 0.24], [0.06, 0.3]], mats.primary, [0, -0.02, 0]);
        const visor = add.mesh(ROBOT_VISOR, mats.dark, [0, 0.06, 0.20]);
        visor.name = 'robotVisor';
        add.sphere(0.045, mats.glow, [-0.1, 0.06, 0.24]);
        add.sphere(0.045, mats.glow, [0.1, 0.06, 0.24]);
        add.box(0.18, 0.04, 0.04, mats.trim, [0, -0.08, 0.22]);
        add.cyl(0.03, 0.03, 0.16, mats.secondary, [0.18, 0.30, 0]);
        add.sphere(0.05, mats.glow, [0.18, 0.40, 0]);
        add.cyl(0.12, 0.14, 0.1, mats.secondary, [0, -0.24, 0]);
        group.userData.lids = [];
    }, { skull: false }),

    explorer: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.cyl(0.28, 0.30, 0.1, mats.primary, [0, 0.22, 0]);
        add.cyl(0.38, 0.38, 0.03, mats.primary, [0, 0.18, 0.02]);
        add.torus(0.07, 0.012, mats.dark, [-0.09, 0.04, 0.26], [0, 0, 0.1]);
        add.torus(0.07, 0.012, mats.dark, [0.09, 0.04, 0.26], [0, 0, -0.1]);
        add.cyl(0.008, 0.008, 0.06, mats.dark, [0, 0.04, 0.26], [0, 0, Math.PI / 2]);
    }),

    cowboy: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.cyl(0.22, 0.24, 0.14, mats.secondary, [0, 0.28, 0]);
        add.cyl(0.42, 0.40, 0.04, mats.secondary, [0, 0.20, 0], [0.12, 0, 0]);
        add.box(0.18, 0.03, 0.03, mats.accent, [0, 0.22, 0.22]);
        add.box(0.18, 0.035, 0.04, mats.dark, [0, -0.08, 0.26]);
    }),

    viking: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx, { smile: false });
        add.lathe([[0.12, -0.12], [0.3, 0.02], [0.28, 0.16], [0.14, 0.28], [0.04, 0.34]], mats.accent, [0, 0.02, 0]);
        add.cone(0.05, 0.22, mats.trim, [-0.32, 0.38, -0.02], [0, 0, 0.45]);
        add.cone(0.05, 0.22, mats.trim, [0.32, 0.38, -0.02], [0, 0, -0.45]);
        add.sphere(0.07, mats.trim, [-0.30, 0.22, -0.02], null, [0.7, 1.1, 0.5]);
        add.sphere(0.07, mats.trim, [0.30, 0.22, -0.02], null, [0.7, 1.1, 0.5]);
        add.sphere(0.16, mats.primary, [0, -0.22, 0.1], null, [1.2, 0.7, 0.85]);
        add.cap(0.03, 0.16, mats.primary, [-0.16, -0.28, 0.12], [0.4, 0, 0.3]);
        add.cap(0.03, 0.16, mats.primary, [0.16, -0.28, 0.12], [0.4, 0, -0.3]);
    }),

    fairy: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.torus(0.22, 0.025, mats.primary, [0, 0.22, 0], [Math.PI / 2, 0, 0]);
        add.sphere(0.05, mats.accent, [0, 0.34, 0.08]);
        add.sphere(0.04, mats.secondary, [-0.16, 0.28, 0.06]);
        add.sphere(0.04, mats.secondary, [0.16, 0.28, 0.06]);
        add.sphere(0.12, mats.primary, [0, 0.16, -0.18], null, [1.4, 0.7, 0.8]);
        add.sphere(0.025, mats.gum, [-0.16, -0.04, 0.24]);
        add.sphere(0.025, mats.gum, [0.16, -0.04, 0.24]);
    }),

    samurai: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx, { smile: false });
        add.lathe([[0.14, -0.1], [0.32, 0.02], [0.3, 0.16], [0.12, 0.26], [0.04, 0.32]], mats.secondary, [0, 0.02, 0]);
        const brim = add.mesh(SAMURAI_BRIM, mats.primary, [0, 0.12, 0.1], [0.15, 0, 0]);
        brim.name = 'samuraiBrim';
        add.torus(0.1, 0.02, mats.accent, [0, 0.32, 0.04], [Math.PI / 2, 0, 0]);
        add.box(0.08, 0.16, 0.04, mats.accent, [0, 0.40, 0.04]);
        const plate = add.mesh(SAMURAI_PLATE, mats.secondary, [0, -0.02, 0.22]);
        plate.name = 'samuraiPlate';
    }),

    scientist: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.lathe([[0.04, 0], [0.18, 0.04], [0.2, 0.12], [0.06, 0.2]], mats.white, [0, 0.08, -0.1]);
        add.lathe([[0.02, 0], [0.07, 0.03], [0.04, 0.1]], mats.white, [-0.2, 0.16, 0.02]);
        add.lathe([[0.02, 0], [0.06, 0.03], [0.035, 0.09]], mats.white, [0.18, 0.2, 0]);
        add.torus(0.08, 0.014, mats.secondary, [-0.1, 0.08, 0.26], [0.1, 0, 0]);
        add.torus(0.08, 0.014, mats.secondary, [0.1, 0.08, 0.26], [0.1, 0, 0]);
        add.cyl(0.01, 0.01, 0.08, mats.secondary, [0, 0.08, 0.26], [0, 0, Math.PI / 2]);
        add.torus(0.08, 0.012, mats.dark, [0, 0.22, 0.1], [0.6, 0, 0]);
    })
};

export function buildHead(kit) {
    const fn = HEADS[kit.id] || HEADS.pirate;
    return fn(kit);
}
