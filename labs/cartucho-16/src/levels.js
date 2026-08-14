/**
 * Fases geradas por um carimbo de tiles — 14 linhas (224 px) de altura.
 * Caracteres: ver ENTITY_CHARS / SOLID em config.js.
 */

import { ENTITY_CHARS } from './config.js';

const H = 14;

function grid(width) {
    return Array.from({ length: H }, () => Array(width).fill('.'));
}

function fill(g, x, y, w, h, ch) {
    const W = g[0].length;
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) {
            const xx = x + i;
            const yy = y + j;
            if (yy >= 0 && yy < H && xx >= 0 && xx < W) g[yy][xx] = ch;
        }
    }
}

function put(g, x, y, ch) {
    if (y >= 0 && y < H && x >= 0 && x < g[0].length) g[y][x] = ch;
}

function ground(g, x0, x1, y = 12) {
    fill(g, x0, y, x1 - x0 + 1, H - y, '#');
}

function gap(g, x, w, y = 12) {
    fill(g, x, y, w, H - y, '.');
}

function plat(g, x, y, w, ch = '=') {
    fill(g, x, y, w, 1, ch);
}

function pipe(g, x, baseY, h, piranha = false) {
    for (let i = 0; i < h; i++) put(g, x, baseY - i, 'p');
    for (let i = 0; i < h; i++) put(g, x + 1, baseY - i, 'p');
    if (piranha) put(g, x, baseY - h, 'g');
}

function stairs(g, x, y, n, dir = 1) {
    for (let i = 0; i < n; i++) fill(g, x + i * dir, y - i, n - i, 1, '#');
}

function coins(g, x, y, n, step = 2) {
    for (let i = 0; i < n; i++) put(g, x + i * step, y, 'c');
}

function toTiles(g) {
    return g.map((row) => row.join(''));
}

function parse(tiles, signs = {}, blocks = {}) {
    const solids = tiles.map((row) => row.split(''));
    const entities = [];
    let spawn = { x: 32, y: 160 };
    let width = solids[0].length;

    for (let y = 0; y < solids.length; y++) {
        for (let x = 0; x < width; x++) {
            const ch = solids[y][x];
            const kind = ENTITY_CHARS[ch];
            if (!kind) continue;
            const px = x * 16;
            const py = y * 16;
            if (kind === 'spawn') {
                spawn = { x: px + 3, y: py + 2 };
                solids[y][x] = '.';
            } else if (kind === 'sign') {
                entities.push({ type: 'sign', x: px, y: py, w: 16, h: 16, text: signs[`${x},${y}`] || '...' });
                solids[y][x] = '.';
            } else if (kind === 'crystal') {
                entities.push({ type: 'crystal', x: px + 2, y: py, w: 12, h: 16 });
                solids[y][x] = '.';
            } else if (kind === 'boss') {
                entities.push({ type: 'boss', x: px, y: py - 16, w: 32, h: 32, hp: 12, maxHp: 12, vx: 0.6, facing: -1, phase: 0, timer: 0 });
                solids[y][x] = '.';
            } else if (kind === 'mover') {
                entities.push({ type: 'mover', x: px, y: py, w: 48, h: 8, vx: 0.7, minX: px - 32, maxX: px + 80, origin: py });
                solids[y][x] = '.';
            } else {
                const ent = { type: kind, x: px, y: py, w: 16, h: 16, vx: kind === 'walker' || kind === 'armored' ? (px < 80 ? 0.45 : -0.45) : 0, vy: 0, hp: kind === 'armored' ? 2 : 1, facing: -1, alive: true };
                if (kind === 'flyer') {
                    ent.y0 = py;
                    ent.vx = 0.55;
                    ent.h = 12;
                }
                if (kind === 'piranha') {
                    ent.x = px;
                    ent.y0 = py + 16;
                    ent.y = py + 16;
                    ent.timer = 40;
                    ent.h = 16;
                }
                if (kind === 'spring') ent.h = 16;
                if (kind === 'pot') ent.hp = 1;
                entities.push(ent);
                solids[y][x] = '.';
            }
        }
    }

    const secrets = {};
    for (const key of Object.keys(blocks)) secrets[key] = blocks[key];

    return { tiles: solids.map((r) => r.join('')), solids, entities, spawn, width, height: H, secrets, signs };
}

function pradaria() {
    const W = 92;
    const g = grid(W);
    ground(g, 0, W - 1);
    put(g, 2, 11, 's');
    put(g, 6, 10, '@');
    coins(g, 8, 9, 4);
    put(g, 18, 11, 'e');
    fill(g, 16, 9, 1, 1, '?');
    fill(g, 17, 9, 1, 1, 'B');
    fill(g, 18, 9, 1, 1, '?');
    put(g, 17, 5, 'c');
    gap(g, 22, 3);
    plat(g, 23, 9, 3);
    put(g, 24, 8, 'c');
    pipe(g, 28, 11, 3, true);
    put(g, 32, 11, 'e');
    coins(g, 34, 8, 5);
    plat(g, 40, 8, 5);
    put(g, 41, 7, '?');
    put(g, 43, 7, '*');
    put(g, 42, 11, 'e');
    gap(g, 48, 4);
    plat(g, 49, 10, 2);
    plat(g, 52, 8, 3);
    put(g, 53, 7, '1');
    fill(g, 56, 10, 4, 2, '#');
    fill(g, 58, 8, 3, 4, '#');
    fill(g, 60, 6, 3, 6, '#');
    put(g, 61, 5, 'h');
    put(g, 64, 11, 'e');
    pipe(g, 67, 11, 2);
    coins(g, 70, 9, 4);
    put(g, 74, 11, 'e');
    fill(g, 78, 10, 8, 2, '#');
    fill(g, 80, 8, 6, 4, '#');
    fill(g, 82, 6, 5, 6, '#');
    put(g, 84, 5, 'x');
    put(g, 86, 5, 'c');
    put(g, 87, 5, 'c');
    return parse(toTiles(g), { '6,10': 'BEM-VINDO A 1994. PISE NOS COGUMELOS!' }, { '16,9': 'coin', '18,9': 'coin', '41,7': 'heart' });
}

function loop() {
    const W = 100;
    const g = grid(W);
    ground(g, 0, W - 1);
    put(g, 2, 11, 's');
    put(g, 5, 10, '@');
    for (let i = 0; i < 8; i++) put(g, 8 + i * 2, 9, 'o');
    put(g, 14, 11, 'e');
    fill(g, 18, 11, 6, 1, '>');
    put(g, 22, 9, '^');
    plat(g, 26, 7, 4);
    for (let i = 0; i < 4; i++) put(g, 26 + i, 6, 'o');
    gap(g, 30, 5);
    plat(g, 31, 10, 2);
    put(g, 32, 9, '^');
    plat(g, 36, 8, 3);
    put(g, 37, 7, 'o');
    put(g, 40, 11, 'e');
    put(g, 44, 8, 'f');
    coins(g, 46, 6, 6);
    fill(g, 52, 11, 8, 1, '>');
    put(g, 58, 9, '^');
    gap(g, 60, 6);
    plat(g, 61, 9, 3);
    plat(g, 66, 7, 4);
    put(g, 67, 6, '*');
    put(g, 72, 11, 'e');
    put(g, 75, 11, 'e');
    pipe(g, 78, 11, 2);
    for (let i = 0; i < 6; i++) put(g, 82 + i, 9, 'o');
    put(g, 88, 9, '^');
    fill(g, 90, 10, 8, 2, '#');
    fill(g, 91, 8, 7, 4, '#');
    put(g, 93, 7, 'x');
    put(g, 95, 7, 'h');
    return parse(toTiles(g), { '5,10': 'ANELIS TE PROTEGEM. SEGA... QUASE.' });
}

function templo() {
    const W = 88;
    const g = grid(W);
    ground(g, 0, W - 1);
    fill(g, 0, 0, W, 3, 'H');
    put(g, 2, 11, 's');
    put(g, 5, 10, '@');
    put(g, 7, 11, 'q');
    put(g, 8, 11, 'q');
    put(g, 12, 11, 'k');
    put(g, 16, 9, 'u');
    put(g, 17, 9, 'u');
    fill(g, 20, 8, 1, 4, '|');
    plat(g, 20, 8, 6, 'H');
    put(g, 23, 7, 'h');
    put(g, 24, 4, 'f');
    gap(g, 28, 3);
    fill(g, 32, 6, 1, 6, '|');
    plat(g, 32, 6, 5, 'H');
    put(g, 34, 5, 'u');
    put(g, 36, 11, 'k');
    put(g, 40, 11, 'q');
    put(g, 42, 8, 'f');
    coins(g, 44, 9, 4);
    fill(g, 50, 4, 8, 1, 'H');
    fill(g, 50, 4, 1, 8, '|');
    put(g, 53, 3, '*');
    put(g, 56, 11, 'k');
    put(g, 58, 11, 'k');
    fill(g, 62, 9, 4, 3, 'H');
    put(g, 63, 8, 'q');
    gap(g, 68, 2);
    fill(g, 70, 9, 1, 3, '|');
    plat(g, 70, 9, 4, 'H');
    fill(g, 72, 7, 1, 5, '|');
    plat(g, 72, 7, 8, 'H');
    put(g, 76, 6, 'x');
    put(g, 78, 6, 'u');
    put(g, 80, 6, 'u');
    return parse(toTiles(g), { '5,10': 'ITS DANGEROUS TO GO ALONE! ATK=ESPADA' });
}

function cidadela() {
    const W = 96;
    const g = grid(W);
    ground(g, 0, W - 1);
    put(g, 2, 11, 's');
    put(g, 5, 10, '@');
    fill(g, 10, 11, 3, 1, '!');
    plat(g, 10, 9, 4);
    put(g, 12, 8, 'c');
    put(g, 16, 8, 'f');
    put(g, 20, 11, 'e');
    pipe(g, 24, 11, 3, true);
    fill(g, 28, 11, 4, 1, '!');
    plat(g, 28, 8, 5);
    put(g, 30, 7, 'h');
    put(g, 32, 4, 'f');
    put(g, 36, 11, 'k');
    put(g, 41, 9, 'm');
    gap(g, 42, 6);
    plat(g, 44, 7, 4);
    put(g, 45, 6, 'c');
    put(g, 47, 6, 'c');
    fill(g, 52, 11, 5, 1, '!');
    plat(g, 52, 8, 6);
    put(g, 54, 3, 'f');
    put(g, 56, 7, '*');
    put(g, 60, 11, 'e');
    put(g, 64, 11, 'e');
    fill(g, 68, 6, 1, 6, '|');
    plat(g, 68, 6, 6);
    put(g, 70, 5, '1');
    gap(g, 74, 4);
    plat(g, 75, 9, 3);
    fill(g, 80, 10, 10, 2, '#');
    fill(g, 82, 8, 8, 4, '#');
    fill(g, 84, 6, 8, 6, '#');
    put(g, 88, 5, 'x');
    put(g, 90, 5, 'c');
    return parse(toTiles(g), { '5,10': 'SEGURE ATK = CHARGE. SHIFT = DASH.' });
}

function castelo() {
    const W = 94;
    const g = grid(W);
    ground(g, 0, W - 1);
    fill(g, 0, 0, W, 2, 'H');
    put(g, 2, 11, 's');
    put(g, 5, 10, '@');
    put(g, 8, 10, 'v');
    put(g, 12, 8, 'f');
    put(g, 16, 11, 'e');
    fill(g, 20, 6, 1, 6, '|');
    plat(g, 20, 6, 5, 'H');
    put(g, 22, 5, 'v');
    put(g, 24, 5, 'h');
    put(g, 28, 4, 'f');
    gap(g, 30, 3);
    fill(g, 30, 12, 3, 2, '~');
    plat(g, 34, 9, 4, 'H');
    put(g, 36, 8, 'c');
    put(g, 40, 11, 'k');
    put(g, 44, 8, 'f');
    put(g, 46, 10, 'v');
    fill(g, 50, 5, 1, 7, '|');
    plat(g, 50, 5, 6, 'H');
    put(g, 52, 4, '*');
    put(g, 54, 11, 'e');
    fill(g, 58, 11, 4, 1, '!');
    plat(g, 58, 8, 5);
    put(g, 60, 3, 'f');
    gap(g, 66, 4);
    fill(g, 66, 12, 4, 2, '~');
    plat(g, 67, 9, 2);
    fill(g, 72, 8, 1, 4, '|');
    plat(g, 72, 8, 10, 'H');
    put(g, 76, 7, 'x');
    put(g, 78, 7, 'v');
    put(g, 80, 7, 'h');
    return parse(toTiles(g), { '5,10': 'O CHICOTE ALCANCA MAIS. SUBA AS ESCADAS.' });
}

function nucleo() {
    const W = 28;
    const g = grid(W);
    ground(g, 0, W - 1);
    fill(g, 0, 0, W, 2, 'H');
    fill(g, 0, 2, 1, 10, 'H');
    fill(g, W - 1, 2, 1, 10, 'H');
    put(g, 3, 11, 's');
    put(g, 13, 9, 'd');
    plat(g, 8, 8, 3);
    plat(g, 17, 8, 3);
    put(g, 6, 11, 'c');
    put(g, 21, 11, 'h');
    return parse(toTiles(g));
}

export const LEVELS = {
    pradaria: { build: pradaria, worldIndex: 0 },
    loop: { build: loop, worldIndex: 1 },
    templo: { build: templo, worldIndex: 2 },
    cidadela: { build: cidadela, worldIndex: 3 },
    castelo: { build: castelo, worldIndex: 4 },
    nucleo: { build: nucleo, worldIndex: 5 },
};
