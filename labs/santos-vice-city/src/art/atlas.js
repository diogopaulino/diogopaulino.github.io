// art/atlas.js — todos os sprites do jogo em string-art, registrados num SpriteRegistry.
// Teto: ~550 linhas.

import { SpriteRegistry } from '../core/sprites.js';
import { sub } from '../core/palette.js';

export function buildAtlas() {
    const reg = new SpriteRegistry();

    // ---------- UI ----------
    const uiPal = sub({ r: 'B', g: 'r', y: 'A', k: '0' });
    reg.add('ui', 'heart', [
        '.rr.rr.',
        'rrrrrrr',
        'rrrrrrr',
        '.rrrrr.',
        '..rrr..',
        '...r...'
    ], sub({ r: 'B' }), { ox: 3, oy: 3 });

    reg.add('ui', 'heart_empty', [
        '.oo.oo.',
        'o.....o',
        'o.....o',
        '.o...o.',
        '..o.o..',
        '...o...'
    ], sub({ o: 'o' }), { ox: 3, oy: 3 });

    reg.add('ui', 'star', [
        '...A...',
        '..AAA..',
        'AAAAAAA',
        '.AAAAA.',
        'AA.A.AA',
        'A.....A'
    ], sub({ A: 'A' }), { ox: 3, oy: 3 });

    for (const [id, ch] of [['bronze', 'f'], ['prata', 'q'], ['ouro', 'A'], ['platina', 'y']]) {
        reg.add('ui', `medal_${id}`, [
            '.mmm.',
            'mCCCm',
            'CCCCC',
            'CCCCC',
            '.mCm.'
        ], sub({ m: '0', C: ch }), { ox: 2, oy: 2 });
    }

    reg.add('ui', 'arrow_down', [
        '.A.',
        'AAA',
        '.A.'
    ], sub({ A: 'A' }), { ox: 1, oy: 0 });

    // ---------- MAPA / HUB ----------
    reg.add('map', 'marker_surf', [
        '..cc..',
        '.cdcd.',
        'cddddc',
        '.cccc.',
        '..99..'
    ], sub({ c: 'c', d: 'd', 9: '9' }), { ox: 3, oy: 4 });

    reg.add('map', 'marker_ciclovia', [
        '.k..k.',
        'kmmmmk',
        '.mggm.',
        'k.mm.k'
    ], sub({ k: '0', m: 'n', g: 'q' }), { ox: 3, oy: 3 });

    reg.add('map', 'marker_pastel', [
        '.gggg.',
        'g6666g',
        'g6ss6g',
        'g6666g',
        '.gggg.'
    ], sub({ g: 'g', 6: '6', s: 's' }), { ox: 2, oy: 4 });

    reg.add('map', 'marker_canal', [
        '..0...',
        '..0...',
        '.000..',
        'aabbaa',
        'bbaabb'
    ], sub({ 0: '0', a: 'a', b: 'b' }), { ox: 3, oy: 4 });

    reg.add('map', 'marker_morro', [
        '...j..',
        '..jjj.',
        '.jjjjj',
        'jjjjjj',
        'kkkkkk'
    ], sub({ j: 'j', k: 'k' }), { ox: 3, oy: 4 });

    reg.add('map', 'palm', [
        '..k.k..',
        '.kkkkk.',
        '..kkk..',
        '...D...',
        '...D...',
        '..DDD..',
        '...D...',
        '...D...'
    ], sub({ k: 'l', D: 'D' }), { ox: 3, oy: 7 });

    reg.add('map', 'kombi', [
        '.mmmmmmmmmm.',
        'mCCCCCCCCCCm',
        'mCyyyyyyyCCm',
        'mCCCCCCCCCCm',
        '.0mmmmmmm0..'
    ], sub({ m: '0', C: 'r', y: 'y', 0: 'F' }), { ox: 6, oy: 4 });

    // ---------- CICLOVIA ----------
    const bikePal = sub({ f: 'B', r: 'v', c: 'D', m: '0', k: '0' });
    reg.add('ciclovia', 'bike', [
        '..kk..',
        '.rrrv.',
        '.rccr.',
        'kmm..k',
        'k.mm.k'
    ], bikePal, { ox: 3, oy: 4, flip: true });

    reg.add('ciclovia', 'ped_phone', [
        '..vv..',
        '.vvvv.',
        '.wCwC.',
        'wCCCCw',
        '.CCCC.',
        '.C..C.',
        '.p..p.'
    ], sub({ v: 'v', w: 'w', C: 'C', p: 'n' }), { ox: 3, oy: 6, flip: true });

    reg.add('ciclovia', 'ped_runner', [
        '..vv..',
        '.vvvv.',
        '.wHwH.',
        'wHHHHw',
        '.HHHH.',
        '.H..p.',
        'p...H.'
    ], sub({ v: 'v', w: 'w', H: 'H', p: 'n' }), { ox: 3, oy: 6, flip: true });

    reg.add('ciclovia', 'dog', [
        '..kk.',
        'kkkke',
        'k..k.',
        'k..k.'
    ], sub({ k: 'D', e: 'e' }), { ox: 2, oy: 3 });

    reg.add('ciclovia', 'cone', [
        '.A.',
        'AAA',
        'B0B',
        'nnn'
    ], sub({ A: '6', B: 'E', n: 'n' }), { ox: 1, oy: 3 });

    reg.add('ciclovia', 'puddle', [
        '.cccc.',
        'cccccc',
        '.cccc.'
    ], sub({ c: 'c' }), { ox: 3, oy: 1 });

    reg.add('ciclovia', 'coco_cart', [
        '.gggggg.',
        'geeeeeeg',
        'g.f..f.g',
        '.oo..oo.'
    ], sub({ g: 'g', e: 'e', f: 'f', o: 'm' }), { ox: 4, oy: 3 });

    reg.add('ciclovia', 'coco', [
        '.ee.',
        'egge',
        'egge',
        '.ee.'
    ], sub({ e: 'e', g: 'g' }), { ox: 2, oy: 2 });

    reg.add('ciclovia', 'kmsign', [
        '.pp..',
        'ppppp',
        '.EEE.',
        '.p.p.',
        '.p.p.'
    ], sub({ p: 'p', E: 'E' }), { ox: 2, oy: 4 });

    // ---------- SURF ----------
    reg.addStrip('surf', 'surfer', 2, (i) => ({
        rows: i === 0 ? [
            '..vv..',
            '.wwvv.',
            'x.ww.x',
            '.xwwx.',
            '..ee..',
            'gggggg'
        ] : [
            '.vv...',
            'wwvv..',
            'x.ww.x',
            '.xwwx.',
            '..ee..',
            'gggggg'
        ],
        pal: sub({ v: 'v', w: 'w', x: 'x', e: 'e', g: 'g' })
    }), { ox: 3, oy: 5, flip: true });

    reg.add('surf', 'isopor', [
        '.rrrr.',
        'rr..rr',
        '.rrrr.'
    ], sub({ r: 'r' }), { ox: 3, oy: 2 });

    // ---------- PASTEL ----------
    reg.add('pastel', 'scooter', [
        '...oo...',
        '..oCCo..',
        '.oCyyCo.',
        'ooCCCCoo',
        '..k..k..'
    ], sub({ o: '0', C: 'B', y: '8', k: '0' }), { ox: 4, oy: 4 });

    reg.add('pastel', 'car', [
        '.CCCCCC.',
        'CCCCCCCC',
        'CyyyyyyC',
        'C000000C',
        '.k....k.'
    ], sub({ C: 'C', y: 'y', 0: '0', k: 'F' }), { ox: 4, oy: 4 });

    reg.add('pastel', 'bus', [
        '.rrrrrrrrrr.',
        'rrrrrrrrrrrr',
        'ryyyyyyyyyyR',
        'r0000000000r',
        '.k........k.'
    ], sub({ r: 'B', y: 'y', 0: '0', k: 'F' }), { ox: 6, oy: 4 });

    reg.add('pastel', 'pothole', [
        '.mmm.',
        'mm0mm',
        '.mmm.'
    ], sub({ m: 'n', 0: 'F' }), { ox: 2, oy: 1 });

    // ---------- CANAL ----------
    reg.add('canal', 'angler', [
        '..vv..',
        '.wCwC.',
        'wCCCCw',
        '.CCCC.',
        '.n..n.'
    ], sub({ v: 'v', w: 'w', C: 'C', n: 'n' }), { ox: 3, oy: 4 });

    reg.add('canal', 'chinelo', ['ee', 'gg'], sub({ e: 'e', g: 'g' }), { ox: 1, oy: 1 });
    reg.add('canal', 'bola', ['.rr.', 'rEEr', 'rEEr', '.rr.'], sub({ r: 'B', E: 'E' }), { ox: 2, oy: 2 });
    reg.add('canal', 'peixe', ['.ccc.', 'cbbbc', '.ccc.'], sub({ c: 'c', b: 'b' }), { ox: 2, oy: 1 });
    reg.add('canal', 'siri', ['e.e', 'eee', 'e.e'], sub({ e: 'B' }), { ox: 1, oy: 1 });
    reg.add('canal', 'capivara', [
        '.jjjjj.',
        'jjjjjjj',
        'jjjjjjj',
        's.....s'
    ], sub({ j: 'e', s: '0' }), { ox: 3, oy: 3 });
    reg.add('canal', 'trash', ['.gg.', 'gggg', '.gg.'], sub({ g: 'o' }), { ox: 2, oy: 1 });

    // ---------- MORRO ----------
    reg.addStrip('morro', 'climber', 2, (i) => ({
        rows: i === 0 ? [
            '.vv.',
            'wCwC',
            'CCCC',
            'CB.C',
            'k..k'
        ] : [
            '.vv.',
            'wCwC',
            'CCCC',
            'C.Bk',
            'k..k'
        ],
        pal: sub({ v: 'v', w: 'w', C: 'C', B: '9', k: 'n' })
    }), { ox: 2, oy: 4 });

    reg.add('morro', 'gato', ['.k.', 'kkk'], sub({ k: 'n' }), { ox: 1, oy: 1 });
    reg.add('morro', 'moto', ['.CC.', 'CyyC', 'k..k'], sub({ C: 'C', y: 'y', k: 'F' }), { ox: 2, oy: 2 });
    reg.add('morro', 'funicular', [
        '.rrrrrr.',
        'rEEEEEEr',
        'rrrrrrrr'
    ], sub({ r: 'B', E: 'E' }), { ox: 4, oy: 2 });

    return reg.build();
}
