/**
 * Cabeças dos 14 kits. Cada Group nasce centrado na origem;
 * character.js posiciona em LAYOUT.HEAD_Y.
 */

import { makeCtx, addFace, tagSlot, glass } from './kit.js';

function build(kit, fn, { skull = true } = {}) {
    const ctx = makeCtx(kit);
    if (skull) ctx.add.sphere(ctx.L.HEAD_R, ctx.mats.skin);
    fn(ctx);
    return tagSlot(ctx.group, 'head');
}

const HEADS = {
    pirate: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.sphere(0.31, mats.primary, [0, 0.08, 0], null, [1.02, 0.52, 1.02]);
        add.sphere(0.07, mats.primary, [-0.24, 0.14, -0.16]);
        add.sphere(0.055, mats.primary, [-0.30, 0.08, -0.12]);
        add.box(0.16, 0.08, 0.04, mats.dark, [0.12, 0.05, 0.26], [0.2, 0.4, 0]);
        add.cyl(0.01, 0.01, 0.58, mats.dark, [0, 0.12, 0.08], [0, 0, 1.05]);
        add.sphere(0.16, mats.dark, [0, -0.22, 0.1], null, [1.15, 0.65, 0.85]);
        add.torus(0.04, 0.008, mats.accent, [0.28, -0.05, 0.1], [1.2, 0, 0.2]);
    }),

    sailor: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.cyl(0.24, 0.26, 0.12, mats.white, [0, 0.26, 0]);
        add.cyl(0.32, 0.32, 0.035, mats.white, [0, 0.20, 0]);
        add.box(0.08, 0.12, 0.02, mats.primary, [0, 0.22, 0.26]);
        add.sphere(0.12, mats.dark, [0, 0.02, -0.22], null, [1.4, 0.5, 0.7]);
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
        add.sphere(0.32, mats.accent, [0, 0.06, 0], null, [1.05, 0.85, 1.05]);
        add.box(0.06, 0.28, 0.22, mats.primary, [0, 0.28, 0], null, null, 0.02);
        add.box(0.34, 0.08, 0.08, mats.secondary, [0, 0.02, 0.22], null, null, 0.02);
        add.box(0.12, 0.1, 0.18, mats.secondary, [0, -0.08, 0.22]);
        add.sphere(0.1, mats.dark, [0, -0.18, 0.12], null, [1.3, 0.45, 0.7]);
    }),

    wizard: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.cone(0.22, 0.72, mats.primary, [0, 0.52, -0.04], [-0.18, 0, 0]);
        add.cyl(0.30, 0.30, 0.05, mats.accent, [0, 0.22, 0]);
        add.sphere(0.04, mats.glow, [0, 0.86, -0.14]);
        add.sphere(0.18, mats.white, [0, -0.22, 0.1], null, [1.15, 0.85, 0.9]);
        add.sphere(0.05, mats.white, [0, -0.08, 0.28]);
    }),

    ninja: (kit) => build(kit, (ctx) => {
        const { add, mats, group } = ctx;
        add.sphere(0.305, mats.primary);
        add.box(0.42, 0.1, 0.28, mats.white, [0, 0.05, 0.08], null, [1, 1, 0.7], 0.04);
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
        add.sphere(0.22, mats.white, [0, 0.64, 0], null, [1, 0.55, 1]);
        add.box(0.16, 0.04, 0.04, mats.dark, [0, -0.06, 0.27]);
        add.sphere(0.03, mats.dark, [-0.07, -0.06, 0.27]);
        add.sphere(0.03, mats.dark, [0.07, -0.06, 0.27]);
    }),

    robot: (kit) => build(kit, (ctx) => {
        const { add, mats, group } = ctx;
        add.box(0.52, 0.44, 0.44, mats.primary, [0, 0.02, 0], null, null, 0.06);
        add.box(0.40, 0.14, 0.08, mats.dark, [0, 0.06, 0.20], null, null, 0.03);
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
        add.sphere(0.32, mats.accent, [0, 0.08, 0], null, [1.05, 0.8, 1.05]);
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
        add.sphere(0.33, mats.secondary, [0, 0.08, 0], null, [1.08, 0.78, 1.08]);
        add.box(0.5, 0.08, 0.18, mats.primary, [0, 0.12, 0.1], [0.15, 0, 0]);
        add.torus(0.1, 0.02, mats.accent, [0, 0.32, 0.04], [Math.PI / 2, 0, 0]);
        add.box(0.08, 0.16, 0.04, mats.accent, [0, 0.40, 0.04]);
        add.box(0.36, 0.1, 0.08, mats.secondary, [0, -0.02, 0.22]);
    }),

    scientist: (kit) => build(kit, (ctx) => {
        const { add, mats } = ctx;
        addFace(ctx);
        add.sphere(0.22, mats.white, [0, 0.16, -0.04], null, [1.35, 0.85, 1.1]);
        add.sphere(0.08, mats.white, [-0.22, 0.22, 0.04]);
        add.sphere(0.07, mats.white, [0.2, 0.26, 0]);
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
