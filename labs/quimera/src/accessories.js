/**
 * Acessórios. O Group nasce na origem; character.js encaixa
 * em grip / ombro / costas conforme `userData.attach`.
 *
 * attach:
 *   grip     — mão direita (padrão)
 *   shoulder — ombro esquerdo (papagaio)
 *   back     — costas (katana, tanque)
 */

import { makeCtx, tagSlot, glass } from './kit.js?v=4';
import * as THREE from 'three';

function build(kit, attach, fn) {
    const ctx = makeCtx(kit);
    fn(ctx);
    ctx.group.userData.attach = attach;
    return tagSlot(ctx.group, 'accessory');
}

/**
 * Estandarte do viking: a ponta da direita abre em duas caudas.
 * O vão entre elas recua cerca de 12 cm.
 */
const VIKING_BANNER = (() => {
    const p = [
        [-0.11, 0.11],
        [0.03, 0.11],
        [0.13, 0.05],
        [0.01, 0.00],
        [0.13, -0.05],
        [0.03, -0.11],
        [-0.11, -0.11]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.003,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.014);
    return g;
})();

/**
 * Painel do astronauta: a prancheta sobe num clipe no meio, cerca de 10 cm.
 */
const ASTRO_PAD = (() => {
    const p = [
        [-0.09, -0.06],
        [0.09, -0.06],
        [0.09, 0.04],
        [0.035, 0.04],
        [0.02, 0.09],
        [0, 0.14],
        [-0.02, 0.09],
        [-0.035, 0.04],
        [-0.09, 0.04]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.003,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.008);
    return g;
})();

/**
 * Machado do guerreiro: o gume abre para a direita e a barba
 * desce cerca de 11 cm abaixo do olho. O chifre de cima sobe
 * cerca de 11 cm acima do poll.
 */
const WARRIOR_AXE = (() => {
    const p = [
        [-0.055, 0.02],
        [-0.01, 0.035],
        [0.035, 0.13],
        [0.115, 0.04],
        [0.13, -0.02],
        [0.05, -0.13],
        [0.0, -0.02],
        [-0.055, -0.025]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.003,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.016);
    return g;
})();

/**
 * Boca da ferramenta do robô: o lado direito abre em duas garras.
 * O fundo do vão recua cerca de 11 cm em relação às pontas.
 */
const ROBOT_JAW = (() => {
    const p = [
        [-0.07, 0.055],
        [0.02, 0.055],
        [0.09, 0.048],
        [0.09, 0.022],
        [-0.02, 0.018],
        [-0.02, -0.018],
        [0.09, -0.022],
        [0.09, -0.048],
        [0.02, -0.055],
        [-0.07, -0.055]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.003,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.025);
    return g;
})();

/**
 * Bainha do ninja: a boca é mais alta que o corpo e a ponta fecha no outro lado.
 * O perfil nasce no plano XY (comprimento em X) e gira para o comprimento ficar em Z.
 */
const NINJA_SAYA = (() => {
    const p = [
        [-0.31, 0.055],
        [-0.28, 0.04],
        [-0.24, 0.032],
        [0.20, 0.03],
        [0.27, 0.038],
        [0.32, 0],
        [0.27, -0.038],
        [0.20, -0.03],
        [-0.24, -0.032],
        [-0.28, -0.04],
        [-0.31, -0.055]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.004,
        bevelSize: 0.003,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.025);
    g.rotateY(-Math.PI / 2);
    return g;
})();

/**
 * Lâmina do samurai: o fio sobe na ponta e o beijo da kissaki
 * recua cerca de 11 cm. O comprimento nasce em X e gira para Z.
 */
const SAMURAI_BLADE = (() => {
    const p = [
        [-0.35, 0.032],
        [-0.30, 0.02],
        [0.24, 0.018],
        [0.30, 0.012],
        [0.36, -0.022],
        [0.25, -0.034],
        [-0.30, -0.03],
        [-0.35, -0.02]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.003,
        bevelSize: 0.002,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.02);
    g.rotateY(-Math.PI / 2);
    return g;
})();

/**
 * Cabo do robô: a empunhadura engrossa no meio cerca de 11 cm
 * em relação às pontas. O torno fica centrado no eixo do cabo.
 */
const ROBOT_GRIP = (() => {
    const pts = [
        new THREE.Vector2(0.028, 0),
        new THREE.Vector2(0.034, 0.04),
        new THREE.Vector2(0.07, 0.1),
        new THREE.Vector2(0.082, 0.15),
        new THREE.Vector2(0.05, 0.21),
        new THREE.Vector2(0.028, 0.28)
    ];
    const g = new THREE.LatheGeometry(pts, 14);
    g.translate(0, -0.14, 0);
    return g;
})();

/**
 * Pomo do machado: a barriga é cerca de 11 cm mais larga que o pescoço.
 * O torno fica centrado onde estava o cubo.
 */
const WARRIOR_POMMEL = (() => {
    const pts = [
        new THREE.Vector2(0.016, 0),
        new THREE.Vector2(0.04, 0.012),
        new THREE.Vector2(0.07, 0.035),
        new THREE.Vector2(0.072, 0.05),
        new THREE.Vector2(0.04, 0.066),
        new THREE.Vector2(0.016, 0.08)
    ];
    const g = new THREE.LatheGeometry(pts, 14);
    g.translate(0, -0.04, 0);
    return g;
})();

/**
 * Cabo da prancheta: a empunhadura engrossa no meio cerca de 11 cm
 * em relação às pontas. O torno fica centrado no eixo do cabo.
 */
const ASTRO_HANDLE = (() => {
    const pts = [
        new THREE.Vector2(0.016, 0),
        new THREE.Vector2(0.02, 0.08),
        new THREE.Vector2(0.055, 0.16),
        new THREE.Vector2(0.072, 0.22),
        new THREE.Vector2(0.04, 0.32),
        new THREE.Vector2(0.016, 0.42)
    ];
    const g = new THREE.LatheGeometry(pts, 12);
    g.translate(0, -0.21, 0);
    return g;
})();

/**
 * Pena do pirata: a ponta fecha no alto e o cano fica estreito
 * embaixo. A barriga abre cerca de 11 cm a mais que o cano.
 */
const PIRATE_FEATHER = (() => {
    const p = [
        [0, 0.10],
        [0.03, 0.055],
        [0.065, 0.02],
        [0.022, -0.02],
        [0.008, -0.055],
        [-0.008, -0.055],
        [-0.022, -0.02],
        [-0.065, 0.02],
        [-0.03, 0.055]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.016,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 1,
        curveSegments: 2
    });
    g.translate(0, 0, -0.008);
    return g;
})();

/**
 * Tsuba do ninja: oval mais largo que alto, com a fenda do
 * nakago no meio (cerca de 9 cm de vão).
 */
const NINJA_TSUBA = (() => {
    const s = new THREE.Shape();
    const ring = [
        [0.09, 0],
        [0.078, 0.035],
        [0.045, 0.061],
        [0, 0.07],
        [-0.045, 0.061],
        [-0.078, 0.035],
        [-0.09, 0],
        [-0.078, -0.035],
        [-0.045, -0.061],
        [0, -0.07],
        [0.045, -0.061],
        [0.078, -0.035]
    ];
    s.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) s.lineTo(ring[i][0], ring[i][1]);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.045, -0.016);
    hole.lineTo(-0.045, 0.016);
    hole.lineTo(0.045, 0.016);
    hole.lineTo(0.045, -0.016);
    hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.028,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 1,
        curveSegments: 2
    });
    g.translate(0, 0, -0.014);
    return g;
})();

/**
 * Gema da fada: a culet fecha numa ponta, a cintura é a parte mais
 * larga e a mesa de cima fica mais estreita. Altura cerca de 5 cm.
 */
const FAIRY_GEM = (() => {
    const g = new THREE.LatheGeometry([
        new THREE.Vector2(0.002, 0),
        new THREE.Vector2(0.012, 0.008),
        new THREE.Vector2(0.022, 0.016),
        new THREE.Vector2(0.026, 0.022),
        new THREE.Vector2(0.018, 0.032),
        new THREE.Vector2(0.012, 0.042),
        new THREE.Vector2(0.012, 0.048)
    ], 12);
    g.translate(0, -0.024, 0);
    g.computeVertexNormals();
    return g;
})();

/**
 * Ponte do binóculo: a haste fica estreita e a roda de foco
 * no meio abre cerca de 6 cm.
 */
const EXPLORER_BRIDGE = (() => {
    const p = [
        [-0.012, -0.045],
        [-0.012, -0.022],
        [-0.026, -0.016],
        [-0.032, 0],
        [-0.026, 0.016],
        [-0.012, 0.022],
        [-0.012, 0.045],
        [0.012, 0.045],
        [0.012, 0.022],
        [0.026, 0.016],
        [0.032, 0],
        [0.026, -0.016],
        [0.012, -0.022],
        [0.012, -0.045]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 1,
        curveSegments: 2
    });
    g.translate(0, 0, -0.03);
    return g;
})();

/**
 * Ponteira da haste do viking: a boca que entra no cabo é estreita,
 * a gola abre no meio e a ponta de baixo fecha.
 */
const VIKING_FERRULE = (() => {
    const g = new THREE.LatheGeometry([
        new THREE.Vector2(0.002, 0),
        new THREE.Vector2(0.008, 0.014),
        new THREE.Vector2(0.014, 0.03),
        new THREE.Vector2(0.02, 0.044),
        new THREE.Vector2(0.032, 0.056),
        new THREE.Vector2(0.024, 0.066),
        new THREE.Vector2(0.016, 0.08)
    ], 12);
    g.translate(0, -0.04, 0);
    g.computeVertexNormals();
    return g;
})();

const ACCESSORIES = {
    pirate: (kit) => build(kit, 'shoulder', ({ add, mats }) => {
        add.sphere(0.09, mats.accent, [0, 0.04, 0]);
        add.sphere(0.055, mats.primary, [0.08, 0.02, 0.04]);
        add.cone(0.03, 0.1, mats.accent, [0.14, 0.0, 0.06], [0, 0, -1.2]);
        add.sphere(0.018, mats.dark, [0.1, 0.04, 0.08]);
        add.sphere(0.03, mats.primary, [0, -0.06, -0.04]);
        const featherL = add.mesh(PIRATE_FEATHER, mats.primary, [-0.06, 0.08, 0], [0, 0, 0.5]);
        featherL.name = 'pirateFeatherL';
        const featherR = add.mesh(PIRATE_FEATHER, mats.primary, [0.04, 0.08, -0.04], [0, 0, -0.4]);
        featherR.name = 'pirateFeatherR';
    }),

    sailor: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.035, 0.04, 0.28, mats.secondary, [0, 0.06, 0], [0.6, 0, 0.4]);
        add.cyl(0.06, 0.07, 0.08, mats.accent, [0, 0.22, 0.08], [0.6, 0, 0.4]);
        add.cyl(0.02, 0.05, 0.06, mats.dark, [0, 0.28, 0.12], [0.6, 0, 0.4]);
    }),

    astronaut: (kit) => build(kit, 'grip', ({ add, mats }) => {
        const handle = add.mesh(ASTRO_HANDLE, mats.secondary, [0, 0.2, 0], [0.2, 0, 0.3]);
        handle.name = 'astroHandle';
        const pad = add.mesh(ASTRO_PAD, mats.primary, [0.02, 0.38, 0.04], [0.2, 0.4, 0.1]);
        pad.name = 'astroPad';
        add.box(0.08, 0.08, 0.01, mats.accent, [0.02, 0.38, 0.055]);
        add.sphere(0.03, mats.glow, [0.02, 0.38, 0.07]);
    }),

    warrior: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.025, 0.025, 0.42, mats.accent, [0, 0.18, 0], [0.15, 0, 0.4]);
        const axe = add.mesh(WARRIOR_AXE, mats.secondary, [0.02, 0.40, 0.08], [0.15, 0, 0.4]);
        axe.name = 'warriorAxe';
        const pommel = add.mesh(WARRIOR_POMMEL, mats.primary, [0, 0.02, 0]);
        pommel.name = 'warriorPommel';
        add.cyl(0.14, 0.14, 0.04, mats.secondary, [-0.22, 0.12, 0.04], [1.2, 0.4, 0]);
        add.cyl(0.04, 0.04, 0.08, mats.accent, [-0.22, 0.12, 0.04], [1.2, 0.4, 0]);
    }),

    wizard: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.02, 0.03, 0.7, mats.cloth, [0, 0.28, 0], [0.25, 0, 0.2]);
        add.sphere(0.07, mats.glow, [0.04, 0.64, 0.08]);
        add.torus(0.09, 0.012, mats.accent, [0.04, 0.64, 0.08], [Math.PI / 2, 0, 0]);
    }),

    ninja: (kit) => build(kit, 'back', ({ add, mats }) => {
        const saya = add.mesh(NINJA_SAYA, mats.accent, [0.12, 0.08, 0], [0, 0.5, 0.15]);
        saya.name = 'ninjaSaya';
        add.cyl(0.025, 0.03, 0.16, mats.primary, [0.12, -0.18, 0.04], [0, 0.5, 0.15]);
        const tsuba = add.mesh(NINJA_TSUBA, mats.trim, [0.12, -0.1, 0.02]);
        tsuba.name = 'ninjaTsuba';
    }),

    chef: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.14, 0.12, 0.06, mats.secondary, [0, 0.08, 0]);
        add.cyl(0.02, 0.02, 0.16, mats.dark, [0.12, 0.08, -0.02], [0, 0, 1.1]);
        add.sphere(0.05, mats.white, [0, 0.14, 0], null, [1.2, 0.45, 1.2]);
        add.sphere(0.03, mats.accent, [0.04, 0.16, 0.02]);
    }),

    robot: (kit) => build(kit, 'grip', ({ add, mats }) => {
        const grip = add.mesh(ROBOT_GRIP, mats.primary, [0, 0.14, 0], [0.3, 0, 0.2]);
        grip.name = 'robotGrip';
        const jaw = add.mesh(ROBOT_JAW, mats.secondary, [0.02, 0.28, 0.04], [0.3, 0, 0.2]);
        jaw.name = 'robotJaw';
        const jawLow = add.mesh(ROBOT_JAW, mats.secondary, [0.02, 0.04, 0], [0.3, 0, 0.2]);
        jawLow.name = 'robotJawLow';
        add.cyl(0.015, 0.015, 0.08, mats.accent, [0.1, 0.28, 0.06]);
    }),

    explorer: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.06, 0.06, 0.1, mats.dark, [-0.05, 0.1, 0], [1.2, 0, 0]);
        add.cyl(0.06, 0.06, 0.1, mats.dark, [0.05, 0.1, 0], [1.2, 0, 0]);
        const bridge = add.mesh(EXPLORER_BRIDGE, mats.secondary, [0, 0.1, 0]);
        bridge.name = 'explorerBridge';
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
        const banner = add.mesh(VIKING_BANNER, mats.accent, [0.04, 0.48, 0.1], [0.2, 0.3, 0.2]);
        banner.name = 'vikingBanner';
        const ferrule = add.mesh(VIKING_FERRULE, mats.secondary, [0, 0.02, 0]);
        ferrule.name = 'vikingFerrule';
    }),

    fairy: (kit) => build(kit, 'grip', ({ add, mats }) => {
        add.cyl(0.012, 0.016, 0.42, mats.trim, [0, 0.2, 0], [0.3, 0, 0.2]);
        add.sphere(0.06, mats.glow, [0.04, 0.42, 0.08]);
        const gem = add.mesh(FAIRY_GEM, mats.accent, [0.04, 0.50, 0.11]);
        gem.name = 'fairyGem';
    }),

    samurai: (kit) => build(kit, 'back', ({ add, mats }) => {
        const blade = add.mesh(SAMURAI_BLADE, mats.accent, [0.16, 0.1, 0], [0.1, 0.6, 0.1]);
        blade.name = 'samuraiBlade';
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
