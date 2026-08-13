// art/figure.js — atleta 16-bit limpo (contorno + silhueta legível estilo California Games).

import { SVC } from '../core/palette.js';
import { makeBuf, fillRect, fillDisc, line, tip, toRows, flipRows, put } from './raster.js';

function twoBone(buf, ox, oy, a1, l1, a2, l2, thick, ch) {
    const joint = tip(ox, oy, a1, l1);
    line(buf, ox, oy, joint.x, joint.y, thick, ch);
    const end = tip(joint.x, joint.y, a2, l2);
    line(buf, joint.x, joint.y, end.x, end.y, thick, ch);
    return { joint, end };
}

/** Contorno preto 1px ao redor de pixels opacos — leitura MD clássica. */
function outline(buf, ink = '0') {
    const { w, h, data } = buf;
    const mark = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i++) {
        if (data[i] && data[i] !== ' ' && data[i] !== '.') mark[i] = 1;
    }
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (mark[y * w + x]) continue;
            let near = false;
            for (let dy = -1; dy <= 1 && !near; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    if (!dx && !dy) continue;
                    const nx = x + dx, ny = y + dy;
                    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
                    if (mark[ny * w + nx]) { near = true; break; }
                }
            }
            if (near) put(buf, x, y, ink);
        }
    }
}

const NEUTRAL = {
    lean: 0,
    crouch: 0,
    headTilt: 0,
    armFront: [-60, -70],
    armBack: [-115, -95],
    legFront: [-70, -85],
    legBack: [-100, -88],
    armLen: [7, 6],
    legLen: [8, 7],
    hair: 'short'
};

export const FIGURE_W = 26;
export const FIGURE_H = 36;

export function buildFigure(pose = {}, kit = {}, opts = {}) {
    const p = { ...NEUTRAL, ...pose };
    const buf = makeBuf(FIGURE_W, FIGURE_H);

    const shirt = kit.shirt || 'c';
    const trim = kit.trim || 'y';
    const skin = kit.skin || 'u';
    const hair = kit.hair || '0';
    const shorts = kit.shorts || '2';

    const hipX = FIGURE_W / 2;
    const hipY = FIGURE_H - 18 + p.crouch;

    const torsoAngle = 90 + p.lean;
    const chest = tip(hipX, hipY, torsoAngle, 9);

    // pernas
    twoBone(buf, hipX, hipY, p.legBack[0], p.legLen[0], p.legBack[1], p.legLen[1], 3, skin);
    const legF = twoBone(buf, hipX, hipY, p.legFront[0], p.legLen[0], p.legFront[1], p.legLen[1], 3, skin);
    // bermuda
    fillRect(buf, hipX - 4, hipY - 1, 8, 4, shorts);
    fillRect(buf, hipX - 3, hipY, 6, 2, shirt);

    // braço de trás
    twoBone(buf, chest.x, chest.y - 1, p.armBack[0], p.armLen[0], p.armBack[1], p.armLen[1], 2, skin);

    // tronco
    line(buf, hipX, hipY, chest.x, chest.y, 6, shirt);
    line(buf, hipX, hipY - 1, chest.x, chest.y - 1, 2, trim);

    // cabeça
    const headC = tip(chest.x + p.headTilt, chest.y, torsoAngle, 4);
    fillDisc(buf, headC.x, headC.y, 3, skin);
    put(buf, headC.x + (opts.flip ? -1 : 1), headC.y, '0');
    if (p.hair !== 'none') {
        for (let i = -3; i <= 3; i++) {
            for (let j = -3; j <= 0; j++) {
                if (i * i + j * j <= 10) put(buf, headC.x + i, headC.y + j, hair);
            }
        }
        if (p.hair === 'long') fillRect(buf, headC.x - 3, headC.y, 2, 5, hair);
    }

    const armF = twoBone(buf, chest.x, chest.y - 1, p.armFront[0], p.armLen[0], p.armFront[1], p.armLen[1], 2, skin);

    outline(buf, '0');

    const rows = opts.flip ? flipRows(toRows(buf)) : toRows(buf);

    let bottom = FIGURE_H - 1;
    for (let y = FIGURE_H - 1; y >= 0; y--) {
        if (rows[y].trim() !== '') { bottom = y; break; }
    }

    const pal = { ' ': null };
    for (const ch of [shirt, trim, skin, hair, shorts, '0']) pal[ch] = SVC[ch];

    const mirror = (pt) => (opts.flip ? { x: FIGURE_W - 1 - pt.x, y: pt.y } : pt);
    return {
        rows,
        pal,
        bottom,
        anchors: {
            hand: mirror(armF.end),
            foot: mirror(legF.end),
            hip: mirror({ x: hipX, y: hipY }),
            head: mirror(headC)
        }
    };
}

export const POSES = {
    surfCrouch: { crouch: 3, lean: -14, armFront: [-20, 10], armBack: [-160, 170], legFront: [-55, -110], legBack: [-125, -70] },
    surfCarve: { crouch: 4, lean: -30, armFront: [0, 30], armBack: [-170, 150], legFront: [-45, -115], legBack: [-135, -60] },
    surfAir: { crouch: 1, lean: 10, armFront: [30, 60], armBack: [150, 120], legFront: [-60, -40], legBack: [-110, -50], armLen: [7, 7] },
    surfTube: { crouch: 6, lean: -8, armFront: [10, 40], armBack: [-165, -150], legFront: [-60, -115], legBack: [-120, -75] },
    surfWipe: { crouch: -4, lean: 60, armFront: [80, 130], armBack: [110, 60], legFront: [-20, 30], legBack: [-150, -170] },

    skatePump: { crouch: 4, lean: -16, armFront: [-30, -10], armBack: [-150, -170], legFront: [-60, -110], legBack: [-120, -70] },
    skateAir: { crouch: 2, lean: 0, armFront: [40, 80], armBack: [140, 100], legFront: [-70, -30], legBack: [-110, -40] },
    skateGrab: { crouch: 6, lean: -20, armFront: [-55, -100], armBack: [140, 110], legFront: [-70, -105], legBack: [-115, -80] },
    skateLand: { crouch: 5, lean: -10, armFront: [-10, 20], armBack: [-170, 160], legFront: [-65, -105], legBack: [-115, -75] },
    skateBail: { crouch: -3, lean: 45, armFront: [70, 120], armBack: [120, 80], legFront: [-30, 20], legBack: [-160, 170] },

    ballIdle: { crouch: 0, lean: -4, armFront: [-50, -30], armBack: [-130, -150], legFront: [-80, -88], legBack: [-100, -90] },
    ballKick: { crouch: 1, lean: -18, armFront: [-20, 20], armBack: [-160, 160], legFront: [-25, -5], legBack: [-115, -85] },
    ballHead: { crouch: -2, lean: 18, armFront: [40, 70], armBack: [140, 110], legFront: [-75, -95], legBack: [-105, -85] },
    ballChest: { crouch: 1, lean: 12, armFront: [-10, 40], armBack: [-170, 140], legFront: [-80, -90], legBack: [-100, -88] },

    bikeRide: { crouch: 3, lean: -34, armFront: [-14, -8], armBack: [-24, -12], legFront: [-70, -100], legBack: [-110, -80] },
    bikeAir: { crouch: 2, lean: -26, armFront: [-10, -5], armBack: [-20, -10], legFront: [-55, -70], legBack: [-125, -60] },
    bikeTrick: { crouch: 0, lean: -10, armFront: [10, 30], armBack: [-30, -20], legFront: [-40, 10], legBack: [-140, -160] },
    bikeCrash: { crouch: -5, lean: 55, armFront: [90, 140], armBack: [110, 70], legFront: [-10, 40], legBack: [-170, 160] },

    racketReady: { crouch: 1, lean: -6, armFront: [-40, -10], armBack: [-140, -160], legFront: [-72, -92], legBack: [-108, -88] },
    racketSwing: { crouch: 2, lean: -20, armFront: [25, 55], armBack: [-150, -170], legFront: [-60, -100], legBack: [-120, -80] },
    racketReach: { crouch: -1, lean: -10, armFront: [60, 85], armBack: [-140, -160], legFront: [-70, -85], legBack: [-105, -95] },

    rowCatch: { crouch: 8, lean: -40, armFront: [-5, 20], armBack: [-25, 5], legFront: [-30, -60], legBack: [-40, -70], armLen: [8, 7] },
    rowPull: { crouch: 8, lean: -66, armFront: [-160, -140], armBack: [-175, -155], legFront: [-30, -60], legBack: [-40, -70], armLen: [8, 7] }
};
