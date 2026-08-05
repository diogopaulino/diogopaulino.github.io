// art/mapart.js — o mapa de Santos usado como hub (320x224), tiles + decor + marcadores.
// Teto: ~260 linhas.

import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { bakeSunsetSky } from './backdrops.js';

// Grid estilizado (não geográfico) 40x28 — cada char = tile 8x8.
// ~ mar, . areia, = canal, # quadra, - rua, * jardim, ^ encosta, | píer
const ROWS = [
    '^^^^^^^^^^..........................###',
    '^^^^^^^^^....................############',
    '^^^^^^^^......................############',
    '^^^^^^.........................############',
    '^^^^............................############',
    '................=..............############',
    '................=..........................',
    '****............=..........................',
    '****............=..............------------',
    '................=..............#-##-##-##-#',
    '................=..............#-##-##-##-#',
    '................=..............------------',
    '................=..............#-##-##-##-#',
    '....########....=..........................',
    '....########....=..........................',
    '....########....=..............****........',
    '....########....=..............****........',
    '................=...........................',
    '................=...........................',
    '................=...........................',
    '~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '................................||||.......',
    '................................||||.......',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~'
].map((r) => r.padEnd(44, '.').slice(0, 40));

const TILE_COLORS = {
    '~': ['9', 'a'], '.': ['g', 'h'], '=': ['b', 'c'], '#': ['n', 'o'],
    '-': ['n', 'p'], '*': ['j', 'k'], '^': ['i', 'j'], '|': ['e', 'f']
};

export const MARKERS = [
    { id: 'surf', x: 320, y: 172, label: 'QUEBRA-MAR SURF' },
    { id: 'ciclovia', x: 236, y: 116, label: 'CICLOVIA DA ORLA' },
    { id: 'pastel', x: 320, y: 78, label: 'DELIVERY DE PASTEL' },
    { id: 'canal', x: 146, y: 96, label: 'PUÇÁ NO CANAL 3' },
    { id: 'morro', x: 40, y: 60, label: 'SUBIDA DO MORRO' }
];

function tileColor(ch, x, y) {
    const pair = TILE_COLORS[ch] || ['0', '0'];
    return SVC[(x + y) % 5 === 0 ? pair[1] : pair[0]];
}

export function bakeHubBackground(rng) {
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;

    const sky = bakeSunsetSky(W, 96);
    g.drawImage(sky, 0, 0);

    const tileSize = 8;
    for (let y = 0; y < ROWS.length; y++) {
        for (let x = 0; x < ROWS[y].length; x++) {
            const ch = ROWS[y][x];
            if (ch === ' ') continue;
            g.fillStyle = tileColor(ch, x, y);
            g.fillRect(x * tileSize, 96 + y * tileSize * 0.5, tileSize, tileSize * 0.5 + 1);
        }
    }
    return cv;
}

export function bakeHubDecor(sprites) {
    const items = [
        { sprite: 'palm', x: 30, y: 170 },
        { sprite: 'palm', x: 60, y: 178 },
        { sprite: 'palm', x: 270, y: 150 },
        { sprite: 'kombi', x: 210, y: 108 }
    ];
    return items;
}
