// art/figure.js — compositor procedural de atleta 16-bit.
//
// Autorar à mão todas as poses de seis modalidades (surfe, skate, altinha, BMX, frescobol e
// remo) em string-art daria centenas de sprites e um inferno de manutenção. Em vez disso o
// atleta é montado a partir de um esqueleto simples: quadril -> tronco -> cabeça, mais quatro
// membros descritos por ângulo/comprimento. Cada pose vira ~6 números, e trocar o uniforme do
// patrocinador é só trocar duas cores da paleta.

import { SVC } from '../core/palette.js';
import { makeBuf, fillRect, fillDisc, line, tip, toRows, flipRows, put } from './raster.js';

/**
 * Desenha um membro de dois segmentos (braço: ombro/cotovelo/mão; perna: quadril/joelho/pé).
 * Ângulos são absolutos em graus; devolve a ponta para pendurar equipamento nela.
 */
function twoBone(buf, ox, oy, a1, l1, a2, l2, thick, ch) {
    const joint = tip(ox, oy, a1, l1);
    line(buf, ox, oy, joint.x, joint.y, thick, ch);
    const end = tip(joint.x, joint.y, a2, l2);
    line(buf, joint.x, joint.y, end.x, end.y, thick, ch);
    return { joint, end };
}

/**
 * Postura neutra. Ângulos em graus no plano cartesiano (0 = direita, 90 = cima).
 * Uma pose só precisa declarar o que muda em relação a isto.
 */
const NEUTRAL = {
    lean: 0,               // inclinação do tronco (graus, + = para trás)
    crouch: 0,             // quanto o quadril desce (px)
    headTilt: 0,           // deslocamento horizontal da cabeça (px)
    armFront: [-60, -70],  // [ângulo do braço, ângulo do antebraço]
    armBack: [-115, -95],
    legFront: [-70, -85],
    legBack: [-100, -88],
    armLen: [7, 6],
    legLen: [8, 7],
    hair: 'short'
};

export const FIGURE_W = 26;
// Altura folgada de propósito: as poses mais esticadas (perna estendida do chute, corpo
// esparramado da queda) precisam caber inteiras, senão o desenho é cortado no meio.
export const FIGURE_H = 36;

/**
 * Rasteriza um atleta e devolve { rows, pal, anchors } no formato de `core/sprites.bake`.
 * @param {object} pose  desvios da postura neutra
 * @param {object} kit   { shirt, trim, skin, hair } em chars da paleta mestra
 * @param {object} opts  { flip }
 */
export function buildFigure(pose = {}, kit = {}, opts = {}) {
    const p = { ...NEUTRAL, ...pose };
    const buf = makeBuf(FIGURE_W, FIGURE_H);

    const shirt = kit.shirt || 'c';
    const trim = kit.trim || 'y';
    const skin = kit.skin || 'u';
    const hair = kit.hair || '0';

    // Âncora: quadril no centro-baixo, deixando espaço embaixo para prancha/skate/bicicleta.
    const hipX = FIGURE_W / 2;
    const hipY = FIGURE_H - 18 + p.crouch;

    const torsoAngle = 90 + p.lean;
    const chest = tip(hipX, hipY, torsoAngle, 9);

    // Membros de trás primeiro: ficam por baixo do tronco na sobreposição.
    twoBone(buf, hipX, hipY, p.legBack[0], p.legLen[0], p.legBack[1], p.legLen[1], 3, skin);
    twoBone(buf, chest.x, chest.y - 1, p.armBack[0], p.armLen[0], p.armBack[1], p.armLen[1], 2, skin);

    // Tronco: camisa do patrocinador com uma faixa mais clara no meio.
    line(buf, hipX, hipY, chest.x, chest.y, 6, shirt);
    line(buf, hipX, hipY, chest.x, chest.y, 2, trim);

    // Cabeça + cabelo (meia-lua superior).
    const headC = tip(chest.x + p.headTilt, chest.y, torsoAngle, 4);
    fillDisc(buf, headC.x, headC.y, 3, skin);
    if (p.hair !== 'none') {
        for (let i = -3; i <= 3; i++) {
            for (let j = -3; j <= 0; j++) {
                if (i * i + j * j <= 10) put(buf, headC.x + i, headC.y + j, hair);
            }
        }
        if (p.hair === 'long') fillRect(buf, headC.x - 3, headC.y, 2, 5, hair);
    }

    // Membros da frente por cima.
    const legF = twoBone(buf, hipX, hipY, p.legFront[0], p.legLen[0], p.legFront[1], p.legLen[1], 3, skin);
    const armF = twoBone(buf, chest.x, chest.y - 1, p.armFront[0], p.armLen[0], p.armFront[1], p.armLen[1], 2, skin);

    const rows = opts.flip ? flipRows(toRows(buf)) : toRows(buf);

    // Linha mais baixa com tinta: é ela, e não a altura do buffer, que define onde ficam os
    // "pés" do sprite. Ancorar pela altura fixa fazia o atleta flutuar em umas poses e afundar
    // em outras, porque cada pose ocupa uma fatia diferente do buffer.
    let bottom = FIGURE_H - 1;
    for (let y = FIGURE_H - 1; y >= 0; y--) {
        if (rows[y].trim() !== '') { bottom = y; break; }
    }

    const pal = { ' ': null };
    for (const ch of [shirt, trim, skin, hair]) pal[ch] = SVC[ch];

    const mirror = (pt) => (opts.flip ? { x: FIGURE_W - 1 - pt.x, y: pt.y } : pt);
    return {
        rows,
        pal,
        bottom,
        // Pontos de ancoragem em coordenadas do sprite — quem chama pendura raquete/remo aqui.
        anchors: {
            hand: mirror(armF.end),
            foot: mirror(legF.end),
            hip: mirror({ x: hipX, y: hipY }),
            head: mirror(headC)
        }
    };
}

/** Poses das seis provas. Os nomes descrevem a leitura em tela, não o esqueleto. */
export const POSES = {
    // --- surfe: base baixa, braços abertos para equilíbrio ---
    surfCrouch: { crouch: 3, lean: -14, armFront: [-20, 10], armBack: [-160, 170], legFront: [-55, -110], legBack: [-125, -70] },
    surfCarve: { crouch: 4, lean: -30, armFront: [0, 30], armBack: [-170, 150], legFront: [-45, -115], legBack: [-135, -60] },
    surfAir: { crouch: 1, lean: 10, armFront: [30, 60], armBack: [150, 120], legFront: [-60, -40], legBack: [-110, -50], armLen: [7, 7] },
    surfTube: { crouch: 6, lean: -8, armFront: [10, 40], armBack: [-165, -150], legFront: [-60, -115], legBack: [-120, -75] },
    surfWipe: { crouch: -4, lean: 60, armFront: [80, 130], armBack: [110, 60], legFront: [-20, 30], legBack: [-150, -170] },

    // --- skate ---
    skatePump: { crouch: 4, lean: -16, armFront: [-30, -10], armBack: [-150, -170], legFront: [-60, -110], legBack: [-120, -70] },
    skateAir: { crouch: 2, lean: 0, armFront: [40, 80], armBack: [140, 100], legFront: [-70, -30], legBack: [-110, -40] },
    skateGrab: { crouch: 6, lean: -20, armFront: [-55, -100], armBack: [140, 110], legFront: [-70, -105], legBack: [-115, -80] },
    skateLand: { crouch: 5, lean: -10, armFront: [-10, 20], armBack: [-170, 160], legFront: [-65, -105], legBack: [-115, -75] },
    skateBail: { crouch: -3, lean: 45, armFront: [70, 120], armBack: [120, 80], legFront: [-30, 20], legBack: [-160, 170] },

    // --- altinha ---
    ballIdle: { crouch: 0, lean: -4, armFront: [-50, -30], armBack: [-130, -150], legFront: [-80, -88], legBack: [-100, -90] },
    ballKick: { crouch: 1, lean: -18, armFront: [-20, 20], armBack: [-160, 160], legFront: [-25, -5], legBack: [-115, -85] },
    ballHead: { crouch: -2, lean: 18, armFront: [40, 70], armBack: [140, 110], legFront: [-75, -95], legBack: [-105, -85] },
    ballChest: { crouch: 1, lean: 12, armFront: [-10, 40], armBack: [-170, 140], legFront: [-80, -90], legBack: [-100, -88] },

    // --- BMX (tronco bem à frente, mãos no guidão) ---
    bikeRide: { crouch: 3, lean: -34, armFront: [-14, -8], armBack: [-24, -12], legFront: [-70, -100], legBack: [-110, -80] },
    bikeAir: { crouch: 2, lean: -26, armFront: [-10, -5], armBack: [-20, -10], legFront: [-55, -70], legBack: [-125, -60] },
    bikeTrick: { crouch: 0, lean: -10, armFront: [10, 30], armBack: [-30, -20], legFront: [-40, 10], legBack: [-140, -160] },
    bikeCrash: { crouch: -5, lean: 55, armFront: [90, 140], armBack: [110, 70], legFront: [-10, 40], legBack: [-170, 160] },

    // --- frescobol ---
    racketReady: { crouch: 1, lean: -6, armFront: [-40, -10], armBack: [-140, -160], legFront: [-72, -92], legBack: [-108, -88] },
    racketSwing: { crouch: 2, lean: -20, armFront: [25, 55], armBack: [-150, -170], legFront: [-60, -100], legBack: [-120, -80] },
    racketReach: { crouch: -1, lean: -10, armFront: [60, 85], armBack: [-140, -160], legFront: [-70, -85], legBack: [-105, -95] },

    // --- canoa (sentado, remando) ---
    rowCatch: { crouch: 8, lean: -40, armFront: [-5, 20], armBack: [-25, 5], legFront: [-30, -60], legBack: [-40, -70], armLen: [8, 7] },
    rowPull: { crouch: 8, lean: -66, armFront: [-160, -140], armBack: [-175, -155], legFront: [-30, -60], legBack: [-40, -70], armLen: [8, 7] }
};
