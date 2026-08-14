/**
 * Acessórios. O Group nasce na origem; character.js encaixa
 * em grip / ombro / costas conforme `userData.attach`.
 *
 * attach:
 *   grip     — mão direita (padrão)
 *   shoulder — ombro esquerdo (papagaio)
 *   back     — costas (katana, tanque)
 */

import { makeCtx, tagSlot, glass } from './kit.js';

function build(kit, attach, fn) {
    const ctx = makeCtx(kit);
    fn(ctx);
    ctx.group.userData.attach = attach;
    return tagSlot(ctx.group, 'accessory');
}

const ACCESSORIES = {
    pirate: (kit) => build(kit, 'shoulder', ({ add, mats }) => {
        add.sphere(0.09, mats.accent, [0, 0.04, 0]);
        add.sphere(0.055, mats.primary, [0.08, 0.02, 0.04]);
        add.cone(0.03, 0.1, mats.accent, [0.14, 0.0, 0.06], [0, 0, -1.2]);
        add.sphere(0.018, mats.dark, [0.1, 0.04, 0.08]);
        add.sphere(0.03, mats.primary, [0, -0.06, -0.04]);
        add.box(0.04, 0.08, 0.02, mats.primary, [-0.06, 0.08, 0], [0, 0, 0.5]);
        add.box(0.04, 0.08, 0.02, mats.primary, [0.04, 0.08, -0.04], [0, 0, -0.4]);
    }),

    sailor: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.035, 0.04, 0.28, mats.secondary, [0, 0.06, 0], [0.6, 0, 0.4]);
        add.cyl(0.06, 0.07, 0.08, mats.accent, [0, 0.22, 0.08], [0.6, 0, 0.4]);
        add.cyl(0.02, 0.05, 0.06, mats.dark, [0, 0.28, 0.12], [0.6, 0, 0.4]);
    }),

    astronaut: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.box(0.04, 0.42, 0.04, mats.secondary, [0, 0.2, 0], [0.2, 0, 0.3]);
        add.box(0.18, 0.12, 0.02, mats.primary, [0.02, 0.38, 0.04], [0.2, 0.4, 0.1]);
        add.box(0.08, 0.08, 0.01, mats.accent, [0.02, 0.38, 0.055]);
        add.sphere(0.03, mats.glow, [0.02, 0.38, 0.07]);
    }),

    warrior: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.025, 0.025, 0.42, mats.accent, [0, 0.18, 0], [0.15, 0, 0.4]);
        add.box(0.06, 0.14, 0.02, mats.secondary, [0.02, 0.40, 0.08], [0.15, 0, 0.4]);
        add.box(0.08, 0.08, 0.08, mats.primary, [0, 0.02, 0], null, null, 0.02);
        add.cyl(0.14, 0.14, 0.04, mats.secondary, [-0.22, 0.12, 0.04], [1.2, 0.4, 0]);
        add.cyl(0.04, 0.04, 0.08, mats.accent, [-0.22, 0.12, 0.04], [1.2, 0.4, 0]);
    }),

    wizard: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.02, 0.03, 0.7, mats.cloth, [0, 0.28, 0], [0.25, 0, 0.2]);
        add.sphere(0.07, mats.glow, [0.04, 0.64, 0.08]);
        add.torus(0.09, 0.012, mats.accent, [0.04, 0.64, 0.08], [Math.PI / 2, 0, 0]);
    }),

    ninja: (kit) => build(kit, 'back', ({ add, mats }) => {
        add.box(0.05, 0.08, 0.62, mats.accent, [0.12, 0.08, 0], [0, 0.5, 0.15], null, 0.01);
        add.cyl(0.025, 0.03, 0.16, mats.primary, [0.12, -0.18, 0.04], [0, 0.5, 0.15]);
        add.box(0.08, 0.04, 0.08, mats.trim, [0.12, -0.1, 0.02]);
    }),

    chef: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.14, 0.12, 0.06, mats.secondary, [0, 0.08, 0]);
        add.cyl(0.02, 0.02, 0.16, mats.dark, [0.12, 0.08, -0.02], [0, 0, 1.1]);
        add.sphere(0.05, mats.white, [0, 0.14, 0], null, [1.2, 0.45, 1.2]);
        add.sphere(0.03, mats.accent, [0.04, 0.16, 0.02]);
    }),

    robot: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.box(0.06, 0.28, 0.06, mats.primary, [0, 0.14, 0], [0.3, 0, 0.2], null, 0.02);
        add.box(0.14, 0.06, 0.08, mats.secondary, [0.02, 0.28, 0.04], [0.3, 0, 0.2], null, 0.02);
        add.box(0.14, 0.06, 0.08, mats.secondary, [0.02, 0.04, 0], [0.3, 0, 0.2], null, 0.02);
        add.cyl(0.015, 0.015, 0.08, mats.accent, [0.1, 0.28, 0.06]);
    }),

    explorer: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.06, 0.06, 0.1, mats.dark, [-0.05, 0.1, 0], [1.2, 0, 0]);
        add.cyl(0.06, 0.06, 0.1, mats.dark, [0.05, 0.1, 0], [1.2, 0, 0]);
        add.box(0.04, 0.04, 0.08, mats.secondary, [0, 0.1, 0]);
        add.cyl(0.045, 0.045, 0.04, glass(0x88a0c0), [-0.05, 0.16, 0.02], [1.2, 0, 0]);
        add.cyl(0.045, 0.045, 0.04, glass(0x88a0c0), [0.05, 0.16, 0.02], [1.2, 0, 0]);
    }),

    cowboy: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.torus(0.12, 0.018, mats.secondary, [0, 0.12, 0], [0.4, 0, 0.2]);
        add.cyl(0.02, 0.02, 0.22, mats.secondary, [0.12, 0.02, 0.04], [0.2, 0, 1.1]);
        add.sphere(0.03, mats.accent, [0.22, -0.04, 0.06]);
    }),

    viking: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.025, 0.03, 0.5, mats.cloth, [0, 0.22, 0], [0.2, 0, 0.35]);
        add.box(0.22, 0.22, 0.04, mats.accent, [0.04, 0.48, 0.1], [0.2, 0.3, 0.2], null, 0.02);
        add.box(0.04, 0.08, 0.04, mats.secondary, [0, 0.02, 0]);
    }),

    fairy: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.012, 0.016, 0.42, mats.trim, [0, 0.2, 0], [0.3, 0, 0.2]);
        add.sphere(0.06, mats.glow, [0.04, 0.42, 0.08]);
        add.box(0.04, 0.04, 0.04, mats.accent, [0.04, 0.42, 0.08], [0.7, 0.4, 0.2]);
    }),

    samurai: (kit) => build(kit, 'back', ({ add, mats }) => {
        add.box(0.045, 0.08, 0.7, mats.accent, [0.16, 0.1, 0], [0.1, 0.6, 0.1], null, 0.01);
        add.cyl(0.03, 0.035, 0.18, mats.primary, [0.16, -0.22, 0.06], [0.1, 0.6, 0.1]);
        add.torus(0.05, 0.01, mats.trim, [0.16, -0.12, 0.04], [Math.PI / 2, 0.6, 0]);
    }),

    scientist: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.05, 0.06, 0.16, glass(0xa8e8c8), [0, 0.14, 0], [0.2, 0, 0.2]);
        add.cyl(0.025, 0.03, 0.06, mats.white, [0, 0.24, 0.02], [0.2, 0, 0.2]);
        add.sphere(0.035, mats.glow, [0, 0.1, 0], null, [1, 0.8, 1]);
        add.sphere(0.02, mats.glow, [0.02, 0.16, 0.02]);
        add.cyl(0.015, 0.015, 0.1, mats.secondary, [0.08, 0.08, 0], [0, 0, 1.0]);
    })
};

export function buildAccessory(kit) {
    const fn = ACCESSORIES[kit.id] || ACCESSORIES.pirate;
    return fn(kit);
}
