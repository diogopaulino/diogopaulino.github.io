/**
 * Corpos dos 14 kits. Pés em y = 0; pescoço em LAYOUT.NECK_Y.
 */

import { makeCtx, clothedBody, tagSlot, glass } from './kit.js';

function build(kit, extras) {
    const ctx = makeCtx(kit);
    clothedBody(ctx, extras.options || {});
    if (extras.detail) extras.detail(ctx);
    return tagSlot(ctx.group, 'body');
}

const BODIES = {
    pirate: (kit) => build(kit, {
        options: { torso: null, pelvis: null, leg: null },
        detail: ({ add, mats }) => {
            add.box(0.62, 0.7, 0.4, mats.primary, [0, 0.82, -0.04], null, null, 0.08);
            add.box(0.56, 0.08, 0.38, mats.accent, [0, 0.58, 0.02], null, null, 0.03);
            add.box(0.18, 0.22, 0.04, mats.trim, [0.14, 0.92, 0.18]);
            add.sphere(0.05, mats.accent, [0.14, 0.92, 0.22]);
        }
    }),

    sailor: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.box(0.54, 0.12, 0.38, mats.white, [0, 1.08, 0.02], null, null, 0.04);
            add.box(0.22, 0.18, 0.04, mats.white, [0, 1.02, 0.18]);
            add.box(0.08, 0.42, 0.02, mats.white, [-0.12, 0.86, 0.18]);
            add.box(0.08, 0.42, 0.02, mats.white, [0.12, 0.86, 0.18]);
            add.box(0.08, 0.42, 0.02, mats.white, [0, 0.86, 0.18]);
            add.box(0.16, 0.16, 0.02, mats.accent, [0, 1.02, 0.20]);
        }
    }),

    astronaut: (kit) => build(kit, {
        options: { torso: null, hand: null, boot: null },
        detail: ({ add, mats }) => {
            add.box(0.58, 0.64, 0.42, mats.primary, [0, 0.86, 0], null, null, 0.1);
            add.box(0.28, 0.22, 0.08, mats.secondary, [0, 0.92, 0.22], null, null, 0.04);
            add.box(0.36, 0.42, 0.18, mats.secondary, [0, 0.90, -0.28], null, null, 0.06);
            add.cyl(0.05, 0.05, 0.16, mats.accent, [-0.12, 1.12, -0.28]);
            add.cyl(0.05, 0.05, 0.16, mats.accent, [0.12, 1.12, -0.28]);
            add.torus(0.12, 0.025, mats.accent, [0, 1.16, 0.02], [Math.PI / 2, 0, 0]);
            add.box(0.18, 0.14, 0.22, mats.secondary, [-0.12, 0.08, 0.04], null, null, 0.04);
            add.box(0.18, 0.14, 0.22, mats.secondary, [0.12, 0.08, 0.04], null, null, 0.04);
        }
    }),

    warrior: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.box(0.56, 0.5, 0.38, mats.secondary, [0, 0.90, 0], null, null, 0.06);
            add.box(0.18, 0.28, 0.06, mats.accent, [0, 0.92, 0.20]);
            add.box(0.5, 0.7, 0.08, mats.primary, [0, 0.78, -0.22], [0.15, 0, 0], null, 0.04);
            add.cyl(0.1, 0.1, 0.08, mats.secondary, [-0.36, 1.06, 0]);
            add.cyl(0.1, 0.1, 0.08, mats.secondary, [0.36, 1.06, 0]);
            add.box(0.14, 0.16, 0.16, mats.secondary, [-0.12, 0.22, 0.04]);
            add.box(0.14, 0.16, 0.16, mats.secondary, [0.12, 0.22, 0.04]);
        }
    }),

    wizard: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.cone(0.55, 1.15, mats.primary, [0, 0.62, 0]);
            add.box(0.2, 0.08, 0.08, mats.accent, [0, 1.0, 0.16]);
            add.sphere(0.04, mats.glow, [-0.16, 0.7, 0.22]);
            add.sphere(0.035, mats.glow, [0.18, 0.55, 0.2]);
            add.sphere(0.03, mats.glow, [0.08, 0.4, 0.24]);
        }
    }),

    ninja: (kit) => build(kit, {
        options: { hand: null },
        detail: ({ add, mats }) => {
            add.box(0.22, 0.08, 0.36, mats.accent, [0, 0.58, 0], null, null, 0.03);
            add.box(0.1, 0.18, 0.04, mats.trim, [0.16, 0.58, 0.14]);
            add.cap(0.06, 0.18, mats.primary, [-0.12, 0.18, 0]);
            add.cap(0.06, 0.18, mats.primary, [0.12, 0.18, 0]);
        }
    }),

    chef: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.box(0.54, 0.58, 0.36, mats.white, [0, 0.86, 0], null, null, 0.06);
            add.box(0.08, 0.36, 0.02, mats.dark, [-0.1, 0.86, 0.19]);
            add.box(0.08, 0.36, 0.02, mats.dark, [0.1, 0.86, 0.19]);
            add.box(0.5, 0.14, 0.38, mats.white, [0, 0.56, 0], null, null, 0.04);
            add.box(0.48, 0.32, 0.34, mats.secondary, [0, 0.32, 0], null, [1, 1, 1], 0.04);
            add.box(0.06, 0.32, 0.02, mats.white, [-0.1, 0.32, 0.18]);
            add.box(0.06, 0.32, 0.02, mats.white, [0, 0.32, 0.18]);
            add.box(0.06, 0.32, 0.02, mats.white, [0.1, 0.32, 0.18]);
        }
    }),

    robot: (kit) => build(kit, {
        options: { skipBase: true },
        detail: ({ add, mats }) => {
            add.cyl(0.08, 0.09, 0.12, mats.secondary, [0, 1.18, 0]);
            add.box(0.5, 0.52, 0.38, mats.primary, [0, 0.88, 0], null, null, 0.06);
            add.box(0.22, 0.16, 0.06, mats.glow, [0, 0.92, 0.20], null, null, 0.02);
            add.box(0.36, 0.16, 0.3, mats.secondary, [0, 0.54, 0], null, null, 0.04);
            add.box(0.16, 0.32, 0.16, mats.primary, [-0.12, 0.28, 0], null, null, 0.03);
            add.box(0.16, 0.32, 0.16, mats.primary, [0.12, 0.28, 0], null, null, 0.03);
            add.box(0.18, 0.1, 0.22, mats.secondary, [-0.12, 0.08, 0.02], null, null, 0.03);
            add.box(0.18, 0.1, 0.22, mats.secondary, [0.12, 0.08, 0.02], null, null, 0.03);
            add.cap(0.07, 0.32, mats.primary, [-0.36, 0.82, 0.02], [0, 0, 0.28]);
            add.cap(0.07, 0.32, mats.primary, [0.36, 0.82, 0.02], [0, 0, -0.28]);
            add.sphere(0.09, mats.secondary, [-0.50, 0.58, 0.08]);
            add.sphere(0.09, mats.secondary, [0.50, 0.58, 0.08]);
        }
    }),

    explorer: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.box(0.28, 0.22, 0.12, mats.accent, [-0.28, 0.72, 0.04], [0, 0.4, 0.15], null, 0.04);
            add.box(0.16, 0.04, 0.12, mats.primary, [0, 0.98, 0.18]);
            add.box(0.1, 0.1, 0.08, mats.secondary, [0.16, 0.58, 0.16]);
        }
    }),

    cowboy: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.box(0.5, 0.36, 0.34, mats.primary, [0, 0.96, 0], null, null, 0.05);
            add.box(0.18, 0.22, 0.04, mats.secondary, [0.12, 0.92, 0.16]);
            add.box(0.22, 0.42, 0.22, mats.secondary, [-0.16, 0.32, 0.04], null, null, 0.04);
            add.box(0.22, 0.42, 0.22, mats.secondary, [0.16, 0.32, 0.04], null, null, 0.04);
            add.box(0.16, 0.08, 0.26, mats.accent, [-0.12, 0.08, 0.06], null, null, 0.03);
            add.box(0.16, 0.08, 0.26, mats.accent, [0.12, 0.08, 0.06], null, null, 0.03);
        }
    }),

    viking: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.box(0.58, 0.5, 0.4, mats.cloth, [0, 0.86, 0], null, null, 0.08);
            add.box(0.52, 0.12, 0.12, mats.trim, [0, 0.70, 0.16], null, null, 0.03);
            add.box(0.48, 0.55, 0.12, mats.primary, [0, 0.78, -0.22], [0.2, 0, 0], null, 0.05);
            add.sphere(0.12, mats.trim, [-0.28, 0.55, 0.12]);
            add.sphere(0.12, mats.trim, [0.28, 0.55, 0.12]);
        }
    }),

    fairy: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats, group }) => {
            add.cone(0.42, 0.7, mats.primary, [0, 0.55, 0]);
            add.torus(0.22, 0.03, mats.trim, [0, 0.88, 0], [Math.PI / 2, 0, 0]);
            const wingMat = glass(0xd8f0ff);
            const petal = (x, rotY) => {
                const m = add.box(
                    0.18, 0.42, 0.04, wingMat,
                    [x, 0.95, -0.18],
                    [0.3, rotY, 0.4 * Math.sign(x) || 0.4],
                    null, 0.08
                );
                m.castShadow = false;
                return m;
            };
            group.userData.wings = [
                petal(-0.16, 0.5),
                petal(0.16, -0.5),
                petal(-0.22, 0.9),
                petal(0.22, -0.9)
            ];
        }
    }),

    samurai: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.box(0.62, 0.28, 0.42, mats.primary, [0, 1.02, 0], null, null, 0.05);
            add.box(0.48, 0.4, 0.34, mats.secondary, [0, 0.78, 0], null, null, 0.05);
            add.box(0.54, 0.28, 0.34, mats.cloth, [0, 0.42, 0], null, null, 0.06);
            add.box(0.08, 0.22, 0.04, mats.accent, [0, 0.86, 0.18]);
            add.box(0.7, 0.08, 0.18, mats.primary, [0, 1.08, 0], null, null, 0.03);
        }
    }),

    scientist: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.box(0.58, 0.72, 0.4, mats.white, [0, 0.78, 0], null, null, 0.06);
            add.box(0.16, 0.08, 0.04, mats.secondary, [0, 1.02, 0.20]);
            add.box(0.1, 0.1, 0.08, mats.accent, [0.22, 0.70, 0.16], null, null, 0.02);
            add.box(0.48, 0.28, 0.34, mats.secondary, [0, 0.32, 0], null, null, 0.04);
        }
    })
};

export function buildBody(kit) {
    const fn = BODIES[kit.id] || BODIES.pirate;
    return fn(kit);
}
