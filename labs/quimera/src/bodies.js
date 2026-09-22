/**
 * Corpos dos 14 kits. Pés em y = 0; pescoço em LAYOUT.NECK_Y.
 */

import { makeCtx, clothedBody, tagSlot, glass } from './kit.js?v=4';
import { wingMembrane, limbGeometry, shoeMesh } from '../../shared/realism.js';
import * as THREE from 'three';

/**
 * Avental do chef: painel na frente das pernas.
 * A barra é mais larga que a cintura e a bainha ondula — não é um bloco.
 * Extrusão em +Z; a prega sai um pouco à frente do pano.
 */
const CHEF_APRON = (() => {
    const s = new THREE.Shape();
    const p = [
        [-0.15, 0.16],
        [-0.19, 0.05],
        [-0.25, -0.05],
        [-0.28, -0.16],
        [-0.14, -0.11],
        [0, -0.19],
        [0.14, -0.11],
        [0.28, -0.16],
        [0.25, -0.05],
        [0.19, 0.05],
        [0.15, 0.16]
    ];
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.055,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.008,
        bevelSegments: 1,
        curveSegments: 4
    });
    g.translate(0, 0, -0.028);
    return g;
})();

const CHEF_PLEAT = (() => {
    const s = new THREE.Shape();
    const p = [
        [-0.035, 0.14],
        [-0.055, 0],
        [-0.03, -0.15],
        [0.03, -0.15],
        [0.055, 0],
        [0.035, 0.14]
    ];
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.028, bevelEnabled: false });
    g.translate(0, 0, 0.02);
    return g;
})();

/** Jaleco: bainha larga embaixo, cintura estreita em cima. Y do torno cresce. */
const LAB_COAT = new THREE.LatheGeometry([
    new THREE.Vector2(0.22, 0),
    new THREE.Vector2(0.27, 0.03),
    new THREE.Vector2(0.25, 0.08),
    new THREE.Vector2(0.21, 0.16),
    new THREE.Vector2(0.17, 0.23),
    new THREE.Vector2(0.15, 0.29)
], 16);

/**
 * Perneira: painel com a borda de fora recortada em franjas (~9–11 cm).
 * side 1 = direita. O espelho inverte a ordem para o contorno continuar anti-horário.
 */
function chapGeometry(side) {
    const raw = [
        [-0.08, 0.21],
        [0.04, 0.21],
        [0.12, 0.08],
        [0.03, 0.00],
        [0.13, -0.08],
        [0.02, -0.14],
        [0.11, -0.21],
        [-0.08, -0.21]
    ];
    const p = raw.map(([x, y]) => [x * side, y]);
    if (side < 0) p.reverse();
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.025);
    return g;
}

const CHAP_R = chapGeometry(1);
const CHAP_L = chapGeometry(-1);

/**
 * Capa: estreita no pescoço, larga na barra, com o centro da bainha mais baixo.
 * A prega sai para −Z, o lado de fora das costas.
 */
function capeGeometry({ height = 0.7, neck = 0.12, hem = 0.36 } = {}) {
    const top = height / 2;
    const bot = -height / 2;
    const p = [
        [-neck, top],
        [-neck * 1.7, top * 0.45],
        [-hem * 0.82, 0],
        [-hem, bot + height * 0.12],
        [-hem * 0.5, bot + height * 0.04],
        [0, bot - height * 0.06],
        [hem * 0.5, bot + height * 0.04],
        [hem, bot + height * 0.12],
        [hem * 0.82, 0],
        [neck * 1.7, top * 0.45],
        [neck, top]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.045,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.022);
    return g;
}

function capePleat(height) {
    const top = height / 2 - 0.03;
    const bot = -height / 2 + 0.02;
    const p = [
        [-0.045, top],
        [-0.08, 0],
        [-0.04, bot],
        [0.04, bot],
        [0.08, 0],
        [0.045, top]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false });
    g.translate(0, 0, -0.09);
    return g;
}

/**
 * Gola de marinheiro: a barra desce nas pontas dos ombros e sobe no pescoço.
 * Queda de cerca de 19 cm entre o alto e a ponta.
 */
const SAILOR_COLLAR = (() => {
    const p = [
        [-0.27, 0.07],
        [-0.27, 0.00],
        [-0.18, -0.12],
        [-0.08, 0.01],
        [0.00, 0.05],
        [0.08, 0.01],
        [0.18, -0.12],
        [0.27, 0.00],
        [0.27, 0.07]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.04,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.02);
    return g;
})();

const SAILOR_FLAP = capeGeometry({ height: 0.36, neck: 0.11, hem: 0.24 });

/**
 * Peitilho do marinheiro: V no pescoço e a barra mais baixa no centro.
 * O V desce cerca de 9 cm; o meio da barra, cerca de 6 cm.
 */
const SAILOR_BIB = (() => {
    const p = [
        [-0.11, 0.07],
        [-0.04, 0.02],
        [0, -0.02],
        [0.04, 0.02],
        [0.11, 0.07],
        [0.12, -0.02],
        [0.07, -0.09],
        [0, -0.15],
        [-0.07, -0.09],
        [-0.12, -0.02]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.004,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.012);
    return g;
})();

/** Tanque da mochila: fundo e topo arredondados, barriga no meio. Y cresce. */
const PACK_TANK = new THREE.LatheGeometry([
    new THREE.Vector2(0.05, 0),
    new THREE.Vector2(0.13, 0.04),
    new THREE.Vector2(0.17, 0.12),
    new THREE.Vector2(0.18, 0.22),
    new THREE.Vector2(0.16, 0.32),
    new THREE.Vector2(0.10, 0.38),
    new THREE.Vector2(0.04, 0.42)
], 16);

/**
 * Ombreira do samurai: sobe no pescoço e desce nas pontas.
 * O arco do alto tem cerca de 13 cm.
 */
/**
 * Bolsa do explorador: mais larga embaixo, fundo arredondado.
 * A aba cobre o alto e desce no centro.
 */
const EXPLORER_BAG = (() => {
    const p = [
        [-0.08, 0.09],
        [-0.12, 0.02],
        [-0.14, -0.04],
        [-0.08, -0.10],
        [0, -0.16],
        [0.08, -0.10],
        [0.14, -0.04],
        [0.12, 0.02],
        [0.08, 0.09]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.1,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.05);
    return g;
})();

const EXPLORER_FLAP = (() => {
    const p = [
        [-0.11, 0.08],
        [0.11, 0.08],
        [0.12, 0.00],
        [0.04, -0.06],
        [0, -0.08],
        [-0.04, -0.06],
        [-0.12, 0.00]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
    g.translate(0, 0, 0.04);
    return g;
})();

/**
 * Cinto do viking: a fivela sobe no centro.
 * O alto do meio fica cerca de 10 cm acima das pontas.
 */
const VIKING_BELT = (() => {
    const p = [
        [-0.26, -0.05],
        [-0.26, 0.02],
        [-0.14, 0.04],
        [-0.06, 0.11],
        [0, 0.12],
        [0.06, 0.11],
        [0.14, 0.04],
        [0.26, 0.02],
        [0.26, -0.05],
        [0.12, -0.07],
        [0, -0.04],
        [-0.12, -0.07]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.05,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.025);
    return g;
})();

/**
 * Joelheira do guerreiro: estreita no alto e embaixo, larga no meio.
 * A largura no centro passa de 16 cm; as pontas fecham.
 */
const WARRIOR_KNEE = (() => {
    const p = [
        [0, 0.09],
        [-0.045, 0.07],
        [-0.085, 0.01],
        [-0.07, -0.05],
        [-0.035, -0.08],
        [0, -0.095],
        [0.035, -0.08],
        [0.07, -0.05],
        [0.085, 0.01],
        [0.045, 0.07]
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
 * Couraça do guerreiro: ombros estreitos, peito largo e ponta na barriga.
 * A ponta fica cerca de 8 cm abaixo dos cantos laterais.
 */
const WARRIOR_PLATE = (() => {
    const p = [
        [0, 0.16],
        [-0.07, 0.11],
        [-0.13, 0.02],
        [-0.12, -0.04],
        [-0.07, -0.10],
        [0, -0.18],
        [0.07, -0.10],
        [0.12, -0.04],
        [0.13, 0.02],
        [0.07, 0.11]
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
 * Placa do peito do astronauta: estreita no alto, larga no meio
 * e com o fundo mais baixo no centro.
 */
const ASTRO_PLATE = (() => {
    const p = [
        [0, 0.12],
        [-0.07, 0.08],
        [-0.13, 0.00],
        [-0.14, -0.06],
        [-0.08, -0.11],
        [0, -0.17],
        [0.08, -0.11],
        [0.14, -0.06],
        [0.13, 0.00],
        [0.07, 0.08]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.045,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.005,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.012);
    return g;
})();

/**
 * Lapela do pirata: larga no ombro e em ponta na barra.
 * A ponta fica cerca de 7 cm abaixo dos cantos de baixo.
 */
const PIRATE_LAPEL = (() => {
    const p = [
        [-0.09, 0.11],
        [0.09, 0.11],
        [0.10, 0.02],
        [0.05, -0.06],
        [0.00, -0.13],
        [-0.05, -0.04],
        [-0.09, 0.03]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.004,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.012);
    return g;
})();

/**
 * Faixa do pirata: pano que desce na frente e termina em duas pontas.
 * O meio da barra fica cerca de 8 cm acima das pontas.
 */
const PIRATE_SASH = (() => {
    const p = [
        [-0.08, 0.18],
        [0.09, 0.18],
        [0.10, 0.06],
        [0.06, -0.02],
        [0.09, -0.14],
        [0.00, -0.06],
        [-0.06, -0.14],
        [-0.09, 0.02]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.04,
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
 * Bota do astronauta, vista de lado: a sola passa da gáspea
 * cerca de 7 cm na frente e 6 cm no calcanhar.
 * Extrusão em +Z (largura); rotation.y = -PI/2 aponta a biqueira para +Z.
 */
const ASTRO_BOOT = (() => {
    const p = [
        [-0.11, 0.00],
        [0.17, 0.00],
        [0.17, 0.04],
        [0.10, 0.055],
        [0.06, 0.10],
        [0.00, 0.14],
        [-0.045, 0.16],
        [-0.055, 0.09],
        [-0.05, 0.05],
        [-0.11, 0.04]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.16,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 4
    });
    g.translate(0, 0, -0.08);
    return g;
})();

/**
 * Fecho do mago: as pontas ficam baixas e o centro sobe cerca de 10 cm.
 */
const WIZARD_CLASP = (() => {
    const p = [
        [-0.14, -0.04],
        [-0.14, 0.03],
        [-0.06, 0.04],
        [0, 0.13],
        [0.06, 0.04],
        [0.14, 0.03],
        [0.14, -0.04],
        [0.06, -0.03],
        [0, 0.01],
        [-0.06, -0.03]
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
 * Colete do cowboy: cava mais baixa que o ombro e ponta na barra.
 * A cava desce cerca de 6 cm; a ponta fica cerca de 10 cm abaixo dos cantos.
 */
const COWBOY_VEST = (() => {
    const p = [
        [-0.09, 0.11],
        [0.05, 0.11],
        [0.10, 0.05],
        [0.09, -0.04],
        [0.03, -0.11],
        [0.00, -0.15],
        [-0.05, -0.05],
        [-0.09, 0.02]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.005,
        bevelSize: 0.004,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.012);
    return g;
})();

/**
 * Bota de cowboy: salto alto, arco levantado e biqueira em ponta.
 * A ponta fica cerca de 7 cm à frente da gáspea.
 * Extrusão em +Z; rotation.y = -PI/2 aponta a biqueira para +Z.
 */
const COWBOY_BOOT = (() => {
    const p = [
        [-0.09, 0.00],
        [-0.02, 0.00],
        [-0.02, 0.06],
        [0.06, 0.065],
        [0.13, 0.04],
        [0.21, 0.015],
        [0.14, 0.055],
        [0.06, 0.08],
        [0.00, 0.12],
        [-0.055, 0.14],
        [-0.08, 0.08],
        [-0.09, 0.045]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.14,
        bevelEnabled: true,
        bevelThickness: 0.006,
        bevelSize: 0.005,
        bevelSegments: 1,
        curveSegments: 4
    });
    g.translate(0, 0, -0.07);
    return g;
})();

/**
 * Obi do ninja: as bordas saem e o meio aperta cerca de 8 cm no raio.
 * Y do torno cresce.
 */
const NINJA_OBI = new THREE.LatheGeometry([
    new THREE.Vector2(0.16, 0),
    new THREE.Vector2(0.26, 0.02),
    new THREE.Vector2(0.18, 0.06),
    new THREE.Vector2(0.26, 0.10),
    new THREE.Vector2(0.16, 0.12)
], 18);

/** Faixa do chef: as bordas saem e o meio aperta. Y do torno cresce. */
const CHEF_BELT = new THREE.LatheGeometry([
    new THREE.Vector2(0.20, 0),
    new THREE.Vector2(0.27, 0.025),
    new THREE.Vector2(0.21, 0.07),
    new THREE.Vector2(0.27, 0.115),
    new THREE.Vector2(0.20, 0.14)
], 18);

const SAMURAI_YOKE = (() => {
    const p = [
        [-0.35, -0.12],
        [-0.35, -0.05],
        [-0.20, 0.02],
        [-0.08, 0.07],
        [0, 0.08],
        [0.08, 0.07],
        [0.20, 0.02],
        [0.35, -0.05],
        [0.35, -0.12],
        [0.20, -0.06],
        [0, 0.02],
        [-0.20, -0.06]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.06,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.006,
        bevelSegments: 1,
        curveSegments: 3
    });
    g.translate(0, 0, -0.03);
    return g;
})();

/**
 * Placa do peito do samurai: a barra desce numa ponta, cerca de 11 cm.
 */
const SAMURAI_LAME = (() => {
    const p = [
        [-0.055, 0.11],
        [0.055, 0.11],
        [0.055, -0.01],
        [0.02, -0.07],
        [0, -0.12],
        [-0.02, -0.07],
        [-0.055, -0.01]
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

const WARRIOR_CAPE = capeGeometry({ height: 0.7, neck: 0.12, hem: 0.36 });
const WARRIOR_PLEAT = capePleat(0.7);
const VIKING_CAPE = capeGeometry({ height: 0.55, neck: 0.11, hem: 0.30 });
const VIKING_PLEAT = capePleat(0.55);

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
            add.lathe([[0.2, 0], [0.32, 0.1], [0.3, 0.34], [0.2, 0.56], [0.14, 0.68]], mats.primary, [0, 0.48, -0.02]);
            const sash = add.mesh(PIRATE_SASH, mats.accent, [-0.02, 0.46, 0.34]);
            sash.name = 'pirateSash';
            const lapel = add.mesh(PIRATE_LAPEL, mats.trim, [0.14, 0.92, 0.18]);
            lapel.name = 'pirateLapel';
            add.sphere(0.05, mats.accent, [0.14, 0.92, 0.22]);
        }
    }),

    sailor: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            const collar = add.mesh(SAILOR_COLLAR, mats.white, [0, 1.06, 0.12]);
            collar.name = 'sailorCollar';
            const flap = add.mesh(SAILOR_FLAP, mats.white, [0, 0.98, -0.16], [0.35, 0, 0]);
            flap.name = 'sailorFlap';
            const bib = add.mesh(SAILOR_BIB, mats.white, [0, 1.02, 0.18]);
            bib.name = 'sailorBib';
            add.box(0.08, 0.42, 0.02, mats.white, [-0.12, 0.86, 0.18]);
            add.box(0.08, 0.42, 0.02, mats.white, [0.12, 0.86, 0.18]);
            add.box(0.08, 0.42, 0.02, mats.white, [0, 0.86, 0.18]);
            add.box(0.16, 0.16, 0.02, mats.accent, [0, 1.02, 0.20]);
        }
    }),

    astronaut: (kit) => build(kit, {
        options: { torso: null, hand: null, boot: null },
        detail: ({ add, mats }) => {
            add.lathe([[0.18, 0], [0.3, 0.1], [0.28, 0.34], [0.18, 0.52], [0.12, 0.62]], mats.primary, [0, 0.54, 0]);
            const plate = add.mesh(ASTRO_PLATE, mats.secondary, [0, 0.92, 0.24]);
            plate.name = 'astroPlate';
            const pack = add.mesh(PACK_TANK, mats.secondary, [0, 0.69, -0.36]);
            pack.name = 'astroPack';
            add.cyl(0.05, 0.05, 0.16, mats.accent, [-0.12, 1.12, -0.28]);
            add.cyl(0.05, 0.05, 0.16, mats.accent, [0.12, 1.12, -0.28]);
            add.torus(0.12, 0.025, mats.accent, [0, 1.16, 0.02], [Math.PI / 2, 0, 0]);
            for (const sx of [-1, 1]) {
                const boot = add.mesh(ASTRO_BOOT, mats.secondary, [sx * 0.12, 0, 0.02], [0, -Math.PI / 2, 0]);
                boot.name = 'astroBoot';
            }
        }
    }),

    warrior: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.lathe([[0.16, 0], [0.28, 0.06], [0.26, 0.28], [0.16, 0.46], [0.1, 0.5]], mats.secondary, [0, 0.66, 0.02]);
            const plate = add.mesh(WARRIOR_PLATE, mats.accent, [0, 0.92, 0.20]);
            plate.name = 'warriorPlate';
            const cape = add.mesh(WARRIOR_CAPE, mats.primary, [0, 0.78, -0.22], [0.15, 0, 0]);
            cape.name = 'warriorCape';
            const pleat = add.mesh(WARRIOR_PLEAT, mats.accent, [0, 0.78, -0.22], [0.15, 0, 0]);
            pleat.name = 'warriorPleat';
            add.cyl(0.1, 0.1, 0.08, mats.secondary, [-0.36, 1.06, 0]);
            add.cyl(0.1, 0.1, 0.08, mats.secondary, [0.36, 1.06, 0]);
            for (const sx of [-1, 1]) {
                const knee = add.mesh(WARRIOR_KNEE, mats.secondary, [sx * 0.12, 0.22, 0.08]);
                knee.name = 'warriorKnee';
            }
        }
    }),

    wizard: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.lathe([[0.22, 0], [0.52, 0.12], [0.4, 0.48], [0.26, 0.9], [0.16, 1.15]], mats.primary, [0, 0.05, 0]);
            const clasp = add.mesh(WIZARD_CLASP, mats.accent, [0, 1.0, 0.16]);
            clasp.name = 'wizardClasp';
            add.sphere(0.04, mats.glow, [-0.16, 0.7, 0.22]);
            add.sphere(0.035, mats.glow, [0.18, 0.55, 0.2]);
            add.sphere(0.03, mats.glow, [0.08, 0.4, 0.24]);
        }
    }),

    ninja: (kit) => build(kit, {
        options: { hand: null },
        detail: ({ add, mats }) => {
            const obi = add.mesh(NINJA_OBI, mats.accent, [0, 0.52, 0]);
            obi.name = 'ninjaObi';
            add.box(0.1, 0.18, 0.04, mats.trim, [0.16, 0.58, 0.14]);
            add.cap(0.06, 0.18, mats.primary, [-0.12, 0.18, 0]);
            add.cap(0.06, 0.18, mats.primary, [0.12, 0.18, 0]);
        }
    }),

    chef: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.lathe([[0.16, 0], [0.28, 0.08], [0.26, 0.28], [0.16, 0.48], [0.1, 0.56]], mats.white, [0, 0.56, 0.02]);
            add.box(0.08, 0.36, 0.02, mats.dark, [-0.1, 0.86, 0.19]);
            add.box(0.08, 0.36, 0.02, mats.dark, [0.1, 0.86, 0.19]);
            const belt = add.mesh(CHEF_BELT, mats.white, [0, 0.49, 0]);
            belt.name = 'chefBelt';
            const apron = add.mesh(CHEF_APRON, mats.secondary, [0, 0.32, 0.1]);
            apron.name = 'chefApron';
            const pleat = add.mesh(CHEF_PLEAT, mats.white, [0, 0.32, 0.1]);
            pleat.name = 'chefPleat';
            add.box(0.06, 0.32, 0.02, mats.white, [-0.1, 0.32, 0.15]);
            add.box(0.06, 0.32, 0.02, mats.white, [0.1, 0.32, 0.15]);
        }
    }),

    robot: (kit) => build(kit, {
        options: { skipBase: true },
        detail: ({ add, mats, group }) => {
            add.cyl(0.08, 0.09, 0.12, mats.secondary, [0, 1.18, 0]);
            const chest = add.lathe([[0.16, 0], [0.26, 0.08], [0.24, 0.28], [0.16, 0.46], [0.1, 0.52]], mats.primary, [0, 0.62, 0]);
            chest.name = 'robotChest';
            add.box(0.22, 0.16, 0.06, mats.glow, [0, 0.92, 0.20], null, null, 0.02);
            const hip = add.lathe([
                [0.08, 0], [0.16, 0.03], [0.2, 0.08], [0.16, 0.13], [0.1, 0.17]
            ], mats.secondary, [0, 0.46, 0]);
            hip.name = 'robotHip';
            const thigh = limbGeometry({ length: 0.38, r0: 0.09, r1: 0.05, bulge: 0.022, bulgeAt: 0.32, seg: 10, rings: 8 });
            const arm = limbGeometry({ length: 0.42, r0: 0.065, r1: 0.04, bulge: 0.014, seg: 10, rings: 8 });
            for (const sx of [-1, 1]) {
                const leg = add.mesh(thigh, mats.primary, [sx * 0.12, 0.48, 0]);
                leg.name = 'robotLeg';
                const boot = shoeMesh(mats.secondary, { length: 0.2, width: 0.1, height: 0.08 });
                boot.name = 'robotBoot';
                boot.position.set(sx * 0.12, 0.02, 0.05);
                boot.rotation.y = -Math.PI / 2;
                group.add(boot);
                const limb = add.mesh(arm, mats.primary, [sx * 0.22, 0.92, 0.02], [0.15, 0, sx * 0.65]);
                limb.name = 'robotArm';
            }
            add.sphere(0.09, mats.secondary, [-0.46, 0.58, 0.06]);
            add.sphere(0.09, mats.secondary, [0.46, 0.58, 0.06]);
        }
    }),

    explorer: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            const bag = add.mesh(EXPLORER_BAG, mats.accent, [-0.28, 0.72, 0.04], [0, 0.4, 0.15]);
            bag.name = 'explorerBag';
            const flap = add.mesh(EXPLORER_FLAP, mats.secondary, [-0.28, 0.72, 0.04], [0, 0.4, 0.15]);
            flap.name = 'explorerFlap';
            add.box(0.16, 0.04, 0.12, mats.primary, [0, 0.98, 0.18]);
            add.box(0.1, 0.1, 0.08, mats.secondary, [0.16, 0.58, 0.16]);
        }
    }),

    cowboy: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.lathe([[0.16, 0], [0.26, 0.06], [0.24, 0.2], [0.14, 0.34]], mats.primary, [0, 0.78, 0.02]);
            const vest = add.mesh(COWBOY_VEST, mats.secondary, [0.12, 0.92, 0.16]);
            vest.name = 'cowboyVest';
            const chapL = add.mesh(CHAP_L, mats.secondary, [-0.16, 0.32, 0.06]);
            chapL.name = 'cowboyChap';
            const chapR = add.mesh(CHAP_R, mats.secondary, [0.16, 0.32, 0.06]);
            chapR.name = 'cowboyChap';
            for (const sx of [-1, 1]) {
                const boot = add.mesh(COWBOY_BOOT, mats.accent, [sx * 0.12, 0, 0.04], [0, -Math.PI / 2, 0]);
                boot.name = 'cowboyBoot';
            }
        }
    }),

    viking: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.lathe([[0.18, 0], [0.3, 0.08], [0.26, 0.28], [0.18, 0.46]], mats.cloth, [0, 0.62, 0]);
            const belt = add.mesh(VIKING_BELT, mats.trim, [0, 0.70, 0.16]);
            belt.name = 'vikingBelt';
            const cape = add.mesh(VIKING_CAPE, mats.primary, [0, 0.78, -0.22], [0.2, 0, 0]);
            cape.name = 'vikingCape';
            const pleat = add.mesh(VIKING_PLEAT, mats.accent, [0, 0.78, -0.22], [0.2, 0, 0]);
            pleat.name = 'vikingPleat';
            add.sphere(0.12, mats.trim, [-0.28, 0.55, 0.12]);
            add.sphere(0.12, mats.trim, [0.28, 0.55, 0.12]);
        }
    }),

    fairy: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats, group }) => {
            add.lathe([[0.16, 0], [0.4, 0.08], [0.32, 0.32], [0.18, 0.62]], mats.primary, [0, 0.2, 0]);
            add.torus(0.22, 0.03, mats.trim, [0, 0.88, 0], [Math.PI / 2, 0, 0]);
            const wingMat = glass(0xd8f0ff);
            wingMat.side = THREE.DoubleSide;
            const petal = (x, rotY) => {
                const m = add.mesh(
                    wingMembrane({ span: 0.46, chord: 0.32 }),
                    wingMat,
                    [x, 0.95, -0.18],
                    [0.3, rotY + (x < 0 ? Math.PI : 0), 0]
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
            add.lathe([[0.2, 0], [0.32, 0.04], [0.3, 0.14], [0.16, 0.26]], mats.primary, [0, 0.9, 0]);
            add.lathe([[0.14, 0], [0.24, 0.06], [0.22, 0.22], [0.14, 0.38]], mats.secondary, [0, 0.58, 0]);
            add.lathe([[0.16, 0], [0.28, 0.04], [0.24, 0.16], [0.14, 0.26]], mats.cloth, [0, 0.28, 0]);
            const lame = add.mesh(SAMURAI_LAME, mats.accent, [0, 0.86, 0.18]);
            lame.name = 'samuraiLame';
            const yoke = add.mesh(SAMURAI_YOKE, mats.primary, [0, 1.08, 0.04]);
            yoke.name = 'samuraiYoke';
        }
    }),

    scientist: (kit) => build(kit, {
        options: {},
        detail: ({ add, mats }) => {
            add.lathe([[0.16, 0], [0.3, 0.08], [0.28, 0.4], [0.18, 0.68]], mats.white, [0, 0.42, 0]);
            add.box(0.16, 0.08, 0.04, mats.secondary, [0, 1.02, 0.20]);
            add.box(0.1, 0.1, 0.08, mats.accent, [0.22, 0.70, 0.16], null, null, 0.02);
            const coat = add.mesh(LAB_COAT, mats.secondary, [0, 0.18, 0]);
            coat.name = 'labCoat';
        }
    })
};

export function buildBody(kit) {
    const fn = BODIES[kit.id] || BODIES.pirate;
    return fn(kit);
}
