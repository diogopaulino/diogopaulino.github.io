// art/atlas.js — monta todos os sprites do jogo em atlases empacotados.
//
// Nada aqui vem de arquivo de imagem: equipamentos e cenário são rasterizados por código a
// partir das primitivas de `raster.js`, e os atletas vêm do compositor de `figure.js`. O atlas
// é reconstruído quando o jogador troca de patrocinador — são poucos milhares de pixels, o
// custo é imperceptível e evita ter que tintar sprites em tempo de desenho.

import { SVC } from '../core/palette.js';
import { SpriteRegistry } from '../core/sprites.js';
import { makeBuf, fillRect, fillDisc, fillEllipse, ring, line, toRows, put } from './raster.js';
import { buildFigure, POSES } from './figure.js';
import { SPONSORS } from '../game/config.js';

/** Paleta completa como mapa char->cor: props usam chars direto da paleta mestra. */
const FULL = SVC;

/** Helper: registra um buffer procedural no registry. */
function addBuf(reg, group, name, buf, opts = {}) {
    reg.add(group, name, toRows(buf), FULL, opts);
}

// ---------------------------------------------------------------------------
// Equipamentos
// ---------------------------------------------------------------------------

function makeSurfboard(color = 'E', stripe = 'x') {
    const buf = makeBuf(34, 7);
    fillEllipse(buf, 17, 3, 16, 2, color);
    // bico mais fino que o rabo — leitura de prancha, não de charuto
    for (let y = 0; y < 7; y++) { put(buf, 33, y, ' '); put(buf, 32, y, ' '); }
    fillEllipse(buf, 15, 3, 14, 2, color);
    line(buf, 6, 3, 26, 3, 1, stripe);
    fillRect(buf, 4, 4, 3, 3, 'n'); // quilha
    return buf;
}

function makeSkateDeck() {
    const buf = makeBuf(24, 8);
    fillEllipse(buf, 12, 2, 11, 2, 'D');
    fillRect(buf, 2, 1, 20, 3, 'D');
    fillRect(buf, 2, 1, 20, 1, 'M');
    // trucks + rodas
    fillRect(buf, 5, 4, 3, 2, 'p');
    fillRect(buf, 16, 4, 3, 2, 'p');
    fillDisc(buf, 6, 6, 2, 'A');
    fillDisc(buf, 17, 6, 2, 'A');
    return buf;
}

function makeBall(r, main, spot) {
    const size = r * 2 + 1;
    const buf = makeBuf(size, size);
    fillDisc(buf, r, r, r, main);
    fillDisc(buf, r - Math.max(1, r / 3), r - Math.max(1, r / 3), Math.max(1, Math.floor(r / 2.4)), spot);
    return buf;
}

function makeRacket() {
    const buf = makeBuf(12, 18);
    fillEllipse(buf, 6, 6, 5, 6, 'f');   // madeira
    fillEllipse(buf, 6, 6, 3, 4, 'g');   // miolo mais claro
    fillRect(buf, 5, 12, 3, 6, 'D');     // cabo
    fillRect(buf, 5, 15, 3, 2, 'x');     // grip
    return buf;
}

function makeBike() {
    const buf = makeBuf(30, 20);
    ring(buf, 6, 13, 6, 2, 'm');
    ring(buf, 23, 13, 6, 2, 'm');
    fillDisc(buf, 6, 13, 1, 'p');
    fillDisc(buf, 23, 13, 1, 'p');
    line(buf, 6, 13, 15, 12, 2, 'x');    // quadro
    line(buf, 15, 12, 23, 13, 2, 'x');
    line(buf, 15, 12, 13, 5, 2, 'x');    // canote
    line(buf, 23, 13, 21, 4, 2, 'z');    // garfo/guidão
    fillRect(buf, 11, 4, 6, 2, 'D');     // selim
    fillRect(buf, 18, 3, 7, 2, 'D');     // guidão
    fillDisc(buf, 15, 13, 2, 'A');       // coroa
    return buf;
}

function makeCanoe() {
    const buf = makeBuf(64, 20);
    // casco principal
    fillEllipse(buf, 30, 11, 28, 4, 'E');
    fillEllipse(buf, 30, 10, 26, 3, 'C');
    fillRect(buf, 6, 8, 48, 2, 'E');
    // braço + flutuador (ama) da canoa havaiana — é o que a diferencia de uma canoa comum
    line(buf, 22, 12, 18, 17, 2, 'M');
    line(buf, 40, 12, 44, 17, 2, 'M');
    fillEllipse(buf, 31, 18, 20, 1, 'A');
    return buf;
}

function makePaddle() {
    const buf = makeBuf(6, 22);
    fillRect(buf, 2, 0, 2, 15, 'M');
    fillEllipse(buf, 3, 18, 2, 4, 'E');
    return buf;
}

// ---------------------------------------------------------------------------
// Cenário e obstáculos
// ---------------------------------------------------------------------------

function makePalm() {
    const buf = makeBuf(34, 46);
    // tronco levemente curvo
    for (let y = 0; y < 34; y++) {
        const x = 17 + Math.round(Math.sin(y * 0.05) * 3);
        fillRect(buf, x - 1, 45 - y, 3, 1, y % 4 === 0 ? 'D' : 'e');
    }
    const topX = 17 + Math.round(Math.sin(33 * 0.05) * 3);
    const topY = 12;
    // folhas: seis arcos saindo do topo
    const leaves = [[-1, 0.15], [1, 0.15], [-1, 0.55], [1, 0.55], [-1, 0.95], [1, 0.95]];
    for (const [dir, droop] of leaves) {
        for (let t = 0; t <= 14; t++) {
            const x = topX + dir * t;
            const y = topY + Math.round(droop * t * t * 0.08) - 2;
            fillRect(buf, x, y, 2, 2, t < 8 ? 'k' : 'j');
            if (t > 3 && t < 12) {
                fillRect(buf, x, y - 2, 1, 1, 'l');
                fillRect(buf, x, y + 2, 1, 1, 'i');
            }
        }
    }
    fillDisc(buf, topX, topY + 2, 2, 'e');
    return buf;
}

function makeUmbrella() {
    const buf = makeBuf(30, 30);
    fillRect(buf, 14, 6, 2, 24, 'f');
    for (let i = 0; i < 5; i++) {
        const c = i % 2 === 0 ? 'B' : 'E';
        fillEllipse(buf, 15, 8, 14 - i * 2.4, 7 - i * 1.2, c);
    }
    fillRect(buf, 0, 9, 30, 22, ' ');   // corta a metade de baixo do "domo"
    fillRect(buf, 14, 9, 2, 21, 'f');
    return buf;
}

function makeBuoy() {
    const buf = makeBuf(14, 20);
    fillEllipse(buf, 7, 14, 6, 5, 'K');
    fillEllipse(buf, 7, 12, 6, 2, 'E');
    fillRect(buf, 6, 2, 2, 8, 'p');
    fillDisc(buf, 7, 2, 2, 'B');
    return buf;
}

function makeCone() {
    const buf = makeBuf(12, 14);
    for (let y = 0; y < 11; y++) {
        const w = Math.round(1 + y * 0.55);
        fillRect(buf, 6 - w, 13 - y, w * 2, 1, y > 4 && y < 7 ? 'E' : 'K');
    }
    fillRect(buf, 1, 12, 10, 2, 'K');
    return buf;
}

function makeCoco() {
    const buf = makeBuf(10, 10);
    fillDisc(buf, 5, 5, 4, 'M');
    fillDisc(buf, 4, 4, 2, 'e');
    return buf;
}

function makeDog() {
    const buf = makeBuf(20, 14);
    fillEllipse(buf, 9, 7, 7, 3, 'f');   // corpo
    fillDisc(buf, 16, 5, 3, 'f');        // cabeça
    fillRect(buf, 18, 3, 2, 2, 'e');     // orelha
    put(buf, 18, 5, '0');                // olho
    fillRect(buf, 4, 9, 2, 4, 'f');      // patas
    fillRect(buf, 8, 9, 2, 4, 'f');
    fillRect(buf, 12, 9, 2, 4, 'f');
    line(buf, 3, 6, 0, 2, 2, 'f');       // rabo
    return buf;
}

function makeBench() {
    const buf = makeBuf(26, 14);
    fillRect(buf, 0, 4, 26, 3, 'e');
    fillRect(buf, 0, 0, 26, 2, 'f');
    fillRect(buf, 2, 7, 2, 7, 'n');
    fillRect(buf, 22, 7, 2, 7, 'n');
    return buf;
}

function makePothole() {
    const buf = makeBuf(24, 8);
    fillEllipse(buf, 12, 4, 11, 3, '0');
    fillEllipse(buf, 12, 3, 9, 2, 'm');
    return buf;
}

function makeGull(frame) {
    const buf = makeBuf(14, 9);
    const up = frame === 0;
    fillEllipse(buf, 7, 5, 3, 1, 'E');
    if (up) {
        line(buf, 5, 5, 1, 1, 1, 'E');
        line(buf, 9, 5, 13, 1, 1, 'E');
    } else {
        line(buf, 5, 5, 1, 7, 1, 'E');
        line(buf, 9, 5, 13, 7, 1, 'E');
    }
    put(buf, 10, 4, 'A');
    return buf;
}

function makeSpray(size) {
    const buf = makeBuf(size, size);
    const r = (size - 1) / 2;
    fillDisc(buf, r, r, r, 'E');
    fillDisc(buf, r, r, Math.max(0, r - 1), 'd');
    return buf;
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function makeMedal(rim) {
    const buf = makeBuf(16, 20);
    fillRect(buf, 4, 0, 3, 7, 'B');   // fita
    fillRect(buf, 9, 0, 3, 7, 'C');
    fillDisc(buf, 8, 13, 6, rim);
    fillDisc(buf, 8, 13, 4, 'h');
    fillDisc(buf, 8, 13, 3, rim);
    return buf;
}

function makeStar() {
    const buf = makeBuf(11, 11);
    const pts = [[5, 0], [5, 10], [0, 5], [10, 5], [2, 2], [8, 8], [8, 2], [2, 8]];
    for (const [x, y] of pts) line(buf, 5, 5, x, y, 1, 'A');
    fillDisc(buf, 5, 5, 2, '8');
    return buf;
}

function makeCursor() {
    const buf = makeBuf(9, 11);
    for (let y = 0; y < 11; y++) {
        const w = Math.max(0, 5 - Math.abs(y - 5));
        fillRect(buf, 1, y, w, 1, 'A');
    }
    return buf;
}

/** Emblema do patrocinador: um ícone simples de 26x26 por marca. */
function makeSponsorLogo(kind, shirt, trim) {
    const buf = makeBuf(28, 28);
    fillDisc(buf, 14, 14, 13, shirt);
    ring(buf, 14, 14, 13, 2, trim);
    switch (kind) {
        case 'wave':
            for (let x = 3; x < 25; x++) {
                const y = 16 + Math.round(Math.sin((x - 3) * 0.5) * 4);
                fillRect(buf, x, y, 1, 3, 'E');
            }
            fillDisc(buf, 19, 9, 3, '8');
            break;
        case 'skate':
            fillEllipse(buf, 14, 13, 10, 2, 'E');
            fillDisc(buf, 8, 17, 2, '0');
            fillDisc(buf, 20, 17, 2, '0');
            break;
        case 'ball':
            fillDisc(buf, 14, 14, 7, 'E');
            fillDisc(buf, 12, 12, 3, '0');
            break;
        case 'bike':
            ring(buf, 8, 17, 5, 2, 'E');
            ring(buf, 20, 17, 5, 2, 'E');
            line(buf, 8, 17, 15, 9, 2, 'E');
            line(buf, 15, 9, 20, 17, 2, 'E');
            break;
        case 'racket':
            fillEllipse(buf, 13, 11, 6, 7, 'E');
            fillEllipse(buf, 13, 11, 4, 5, shirt);
            fillRect(buf, 12, 18, 3, 7, 'E');
            break;
        case 'canoe':
            fillEllipse(buf, 14, 16, 11, 3, 'E');
            line(buf, 10, 13, 18, 5, 2, 'E');
            break;
        default:
            break;
    }
    return buf;
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------

/** Poses de atleta que cada prova pede, agrupadas por prefixo do nome do sprite. */
const FIGURE_SET = {
    surf: ['surfCrouch', 'surfCarve', 'surfAir', 'surfTube', 'surfWipe'],
    skate: ['skatePump', 'skateAir', 'skateGrab', 'skateLand', 'skateBail'],
    ball: ['ballIdle', 'ballKick', 'ballHead', 'ballChest'],
    bike: ['bikeRide', 'bikeAir', 'bikeTrick', 'bikeCrash'],
    racket: ['racketReady', 'racketSwing', 'racketReach'],
    row: ['rowCatch', 'rowPull']
};

/**
 * Constrói o atlas completo.
 * @param {object} kit  uniforme do atleta { shirt, trim, skin, hair }
 */
export function buildAtlas(kit = {}) {
    const reg = new SpriteRegistry();
    const playerKit = { shirt: 'c', trim: 'y', skin: 'u', hair: '0', ...kit };

    // --- atletas: uma versão normal e uma espelhada de cada pose ---
    for (const group of Object.keys(FIGURE_SET)) {
        for (const poseName of FIGURE_SET[group]) {
            const fig = buildFigure(POSES[poseName], playerKit);
            reg.add('chars', poseName, fig.rows, fig.pal, { ox: 13, oy: fig.bottom + 1 });
            const flipped = buildFigure(POSES[poseName], playerKit, { flip: true });
            reg.add('chars', poseName + '_flip', flipped.rows, flipped.pal,
                { ox: 13, oy: flipped.bottom + 1 });
        }
    }

    // --- rivais/figurantes: mesmo esqueleto, uniformes diferentes, para povoar o cenário ---
    const crowdKits = [
        { shirt: 'B', trim: 'h', skin: 't', hair: '0' },
        { shirt: 'k', trim: 'A', skin: 'w', hair: 'e' },
        { shirt: 'z', trim: 'G', skin: 's', hair: '0' },
        { shirt: 'A', trim: 'B', skin: 'v', hair: 'D' }
    ];
    crowdKits.forEach((ck, i) => {
        const idle = buildFigure(POSES.ballIdle, ck);
        reg.add('chars', `crowd#${i}`, idle.rows, idle.pal, { ox: 13, oy: idle.bottom + 1 });
        const cheer = buildFigure({ ...POSES.ballIdle, armFront: [70, 95], armBack: [110, 85] }, ck);
        reg.add('chars', `cheer#${i}`, cheer.rows, cheer.pal, { ox: 13, oy: cheer.bottom + 1 });
        const rowPose = buildFigure(POSES.rowPull, ck);
        reg.add('chars', `rowRival#${i}`, rowPose.rows, rowPose.pal, { ox: 13, oy: rowPose.bottom + 1 });
    });

    // --- equipamentos ---
    addBuf(reg, 'props', 'board', makeSurfboard('E', playerKit.shirt), { ox: 17, oy: 4, flip: true });
    addBuf(reg, 'props', 'deck', makeSkateDeck(), { ox: 12, oy: 4 });
    addBuf(reg, 'props', 'ballBig', makeBall(6, 'E', 'x'), { ox: 6, oy: 6 });
    addBuf(reg, 'props', 'ballSmall', makeBall(3, 'A', 'B'), { ox: 3, oy: 3 });
    addBuf(reg, 'props', 'racket', makeRacket(), { ox: 6, oy: 17 });
    addBuf(reg, 'props', 'bike', makeBike(), { ox: 15, oy: 19 });
    addBuf(reg, 'props', 'canoe', makeCanoe(), { ox: 32, oy: 14 });
    addBuf(reg, 'props', 'paddle', makePaddle(), { ox: 3, oy: 11 });

    // --- cenário ---
    addBuf(reg, 'scene', 'palm', makePalm(), { ox: 17, oy: 46 });
    addBuf(reg, 'scene', 'umbrella', makeUmbrella(), { ox: 15, oy: 30 });
    addBuf(reg, 'scene', 'buoy', makeBuoy(), { ox: 7, oy: 19 });
    addBuf(reg, 'scene', 'cone', makeCone(), { ox: 6, oy: 14 });
    addBuf(reg, 'scene', 'coco', makeCoco(), { ox: 5, oy: 9 });
    addBuf(reg, 'scene', 'dog', makeDog(), { ox: 10, oy: 13 });
    addBuf(reg, 'scene', 'bench', makeBench(), { ox: 13, oy: 14 });
    addBuf(reg, 'scene', 'pothole', makePothole(), { ox: 12, oy: 7 });
    addBuf(reg, 'scene', 'gull#0', makeGull(0), { ox: 7, oy: 4 });
    addBuf(reg, 'scene', 'gull#1', makeGull(1), { ox: 7, oy: 4 });

    // --- partículas ---
    for (let i = 0; i < 3; i++) {
        addBuf(reg, 'fx', `spray#${i}`, makeSpray(3 + i * 2), { ox: 1 + i, oy: 1 + i });
    }

    // --- UI ---
    addBuf(reg, 'ui', 'medal_gold', makeMedal('8'), { ox: 8, oy: 20 });
    addBuf(reg, 'ui', 'medal_silver', makeMedal('q'), { ox: 8, oy: 20 });
    addBuf(reg, 'ui', 'medal_bronze', makeMedal('6'), { ox: 8, oy: 20 });
    addBuf(reg, 'ui', 'star', makeStar(), { ox: 5, oy: 5 });
    addBuf(reg, 'ui', 'cursor', makeCursor(), { ox: 0, oy: 5 });

    // Emblemas dos patrocinadores: cada um nas SUAS cores, não nas do uniforme atual —
    // a tela de escolha mostra os seis lado a lado e eles precisam se distinguir entre si.
    for (const sp of SPONSORS) {
        addBuf(reg, 'ui', `logo_${sp.id}`, makeSponsorLogo(sp.logo, sp.kit.shirt, sp.kit.trim), { ox: 14, oy: 14 });
    }

    return reg.build();
}
