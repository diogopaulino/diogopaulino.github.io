// core/font.js — fonte bitmap 5×7 desenhada à mão, no padrão dos cartuchos 16-bit.
//
// A versão anterior rasterizava Arial com o motor do Canvas e reduzia por maioria de subpixels.
// Era conveniente, mas o downsample destruía as formas: 'M' virava 'W', minúsculas viravam
// borrões e "MENU PRINCIPAL" saía ilegível. Num jogo que se propõe a parecer Mega Drive, a
// fonte é metade da identidade visual — então cada glifo agora é desenhado pixel a pixel.
//
// Anatomia da célula (5 px de largura útil, 6 de avanço; 12 linhas de altura):
//
//   linha 0..1   acento (agudo, grave, circunflexo, til, trema)
//   linha 2..8   corpo da letra — 5×7, a caixa clássica de fonte de arcade
//   linha 9..10  descendentes (g, j, p, q, y), cedilha e vírgula
//
// A célula inteira é desenhada com deslocamento vertical de -1 px em relação ao (x, y) pedido,
// de forma que o corpo continue caindo exatamente onde a fonte antiga o punha — nenhuma tela
// precisou ser reposicionada por causa da troca.

import { SVC } from './palette.js';

const GW = 5;            // largura desenhável do glifo
const CELL_W = 6;        // avanço em modo monoespaçado (glifo + 1 px de respiro)
const CELL_H = 9;        // altura de referência para o cálculo de linhas
const ATLAS_H = 12;      // altura real da célula no atlas (acento + corpo + descendente)
const BODY_TOP = 2;      // linha do atlas onde o corpo começa
const DRAW_DY = -1;      // deslocamento ao desenhar, para o corpo cair em y+1 (como antes)

/**
 * Resolve uma cor recebida por text()/textBig(): aceita tanto um char de 1 letra
 * da paleta mestra ("A", "q", "x"…) quanto uma cor CSS já pronta ("#ffe600").
 */
export function resolveColor(color) {
    if (!color) return '#ffffff';
    if (color.length === 1 && Object.prototype.hasOwnProperty.call(SVC, color)) {
        return SVC[color] || '#ffffff';
    }
    return color;
}

// ---------------------------------------------------------------------------
// Corpos: 7 linhas de 5 colunas. '#' pinta, qualquer outro char é transparente.
// ---------------------------------------------------------------------------

const BODY = {
    ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],

    // --- caixa alta ---
    A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
    D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
    E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
    F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
    G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
    H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
    I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
    J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
    M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
    N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
    Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
    R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
    X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
    Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
    Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

    // --- caixa baixa (altura de x = 5 linhas, ascendentes sobem até o topo do corpo) ---
    a: ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
    b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
    c: ['.....', '.....', '.###.', '#....', '#....', '#....', '.###.'],
    d: ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
    e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
    f: ['..##.', '.#...', '####.', '.#...', '.#...', '.#...', '.#...'],
    g: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####'],
    h: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
    i: ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
    j: ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '...#.'],
    k: ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
    l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    m: ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
    n: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
    o: ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
    p: ['.....', '.....', '####.', '#...#', '#...#', '#...#', '####.'],
    q: ['.....', '.....', '.####', '#...#', '#...#', '#...#', '.####'],
    r: ['.....', '.....', '#.##.', '##...', '#....', '#....', '#....'],
    s: ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
    t: ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
    u: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
    v: ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
    w: ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
    x: ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    y: ['.....', '.....', '#...#', '#...#', '#...#', '#...#', '.####'],
    z: ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],

    // --- dígitos ---
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],

    // --- pontuação ---
    '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
    '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
    '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '#####', '.#.#.', '.....'],
    $: ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
    '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
    '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
    "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
    '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
    ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
    '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
    '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
    ',': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
    '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
    '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
    '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
    ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
    ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
    '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
    '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
    '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
    '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
    '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
    '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
    '\\': ['#....', '#....', '.#...', '..#..', '...#.', '....#', '....#'],
    ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
    '^': ['..#..', '.#.#.', '#...#', '.....', '.....', '.....', '.....'],
    _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
    '`': ['.#...', '..#..', '.....', '.....', '.....', '.....', '.....'],
    '{': ['...##', '..#..', '..#..', '.##..', '..#..', '..#..', '...##'],
    '|': ['..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
    '}': ['##...', '..#..', '..#..', '..##.', '..#..', '..#..', '##...'],
    '~': ['.....', '.....', '.##.#', '#..##', '.....', '.....', '.....'],

    // --- sinais que o jogo usa como separador ou decoração ---
    '·': ['.....', '.....', '.....', '.##..', '.##..', '.....', '.....'],
    '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
    º: ['.##..', '#..#.', '#..#.', '.##..', '.....', '.....', '.....'],
    '°': ['.##..', '#..#.', '.##..', '.....', '.....', '.....', '.....'],
    ª: ['.###.', '#..#.', '####.', '.....', '####.', '.....', '.....'],
    '—': ['.....', '.....', '.....', '.....', '#####', '.....', '.....'],
    '…': ['.....', '.....', '.....', '.....', '.....', '.....', '#.#.#'],
    '♥': ['.....', '.#.#.', '#####', '#####', '.###.', '.###.', '..#..'],
    '★': ['..#..', '..#..', '#####', '.###.', '.#.#.', '##.##', '.....'],
    '●': ['.....', '.###.', '#####', '#####', '#####', '.###.', '.....'],
    '○': ['.....', '.###.', '#...#', '#...#', '#...#', '.###.', '.....'],
    '◆': ['..#..', '.###.', '#####', '#####', '.###.', '..#..', '.....'],
    '▲': ['.....', '..#..', '..#..', '.###.', '.###.', '#####', '#####'],
    '▼': ['.....', '#####', '#####', '.###.', '.###.', '..#..', '..#..'],
    '◀': ['...#.', '..##.', '.###.', '####.', '.###.', '..##.', '...#.'],
    '▶': ['.#...', '.##..', '.###.', '.####', '.###.', '.##..', '.#...']
};

/** Caudas desenhadas abaixo do corpo (linhas 9 e 10 do atlas). */
const TAIL = {
    g: ['....#', '.###.'],
    j: ['#..#.', '.##..'],
    p: ['#....', '#....'],
    q: ['....#', '....#'],
    y: ['....#', '.###.'],
    ',': ['.#...', '#....'],
    ';': ['.#...', '.....']
};

/** Marcas diacríticas, 2 linhas, desenhadas acima do corpo. */
const MARK = {
    acute: ['...#.', '..#..'],
    grave: ['.#...', '..#..'],
    circ: ['..#..', '.#.#.'],
    tilde: ['.##.#', '#..##'],
    diaer: ['.#.#.', '.....']
};

const CEDILLA = ['...#.', '..##.'];

/**
 * Acentuados = corpo de outra letra + marca.
 * Em caixa baixa a marca desce 2 linhas, para encostar na altura de x em vez de flutuar.
 */
const ACCENTED = {
    Á: ['A', 'acute'], À: ['A', 'grave'], Â: ['A', 'circ'], Ã: ['A', 'tilde'],
    É: ['E', 'acute'], Ê: ['E', 'circ'],
    Í: ['I', 'acute'],
    Ó: ['O', 'acute'], Ô: ['O', 'circ'], Õ: ['O', 'tilde'],
    Ú: ['U', 'acute'], Ü: ['U', 'diaer'],
    Ñ: ['N', 'tilde'],
    Ç: ['C', null],
    á: ['a', 'acute'], à: ['a', 'grave'], â: ['a', 'circ'], ã: ['a', 'tilde'],
    é: ['e', 'acute'], ê: ['e', 'circ'],
    í: ['i', 'acute'],
    ó: ['o', 'acute'], ô: ['o', 'circ'], õ: ['o', 'tilde'],
    ú: ['u', 'acute'], ü: ['u', 'diaer'],
    ñ: ['n', 'tilde'],
    ç: ['c', null]
};

const LOWER_MARK_DROP = 2;   // acento de minúscula desce 2 linhas
const CHARS = Object.keys(BODY).concat(Object.keys(ACCENTED));
const COLS = 16;

function isLower(ch) { return ch >= 'a' && ch <= 'z'; }

// ---------------------------------------------------------------------------

export class BitmapFont {
    constructor() {
        this.masks = new Map();   // char -> Uint8Array (GW * ATLAS_H)
        this.adv = new Map();     // char -> avanço em modo proporcional
        this.atlas = null;        // máscara branca, um glifo por célula
        this.index = new Map();   // char -> {x, y}
        this.tintCache = new Map();
        this.rampCache = new Map();
        this.cols = COLS;
    }

    build() {
        for (const ch of CHARS) this.masks.set(ch, this._rasterize(ch));

        const rows = Math.ceil(CHARS.length / COLS);
        this.atlas = document.createElement('canvas');
        this.atlas.width = COLS * CELL_W;
        this.atlas.height = rows * ATLAS_H;
        const g = this.atlas.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = '#fff';

        CHARS.forEach((ch, i) => {
            const cx = (i % COLS) * CELL_W;
            const cy = Math.floor(i / COLS) * ATLAS_H;
            this.index.set(ch, { x: cx, y: cy });
            const mask = this.masks.get(ch);
            let maxX = -1;
            for (let y = 0; y < ATLAS_H; y++) {
                for (let x = 0; x < GW; x++) {
                    if (!mask[y * GW + x]) continue;
                    g.fillRect(cx + x, cy + y, 1, 1);
                    if (x > maxX) maxX = x;
                }
            }
            // avanço proporcional: tinta + 1 px de respiro; o espaço vale 3 px
            this.adv.set(ch, ch === ' ' ? 3 : maxX + 2);
        });

        return this;
    }

    /** Monta a máscara de um glifo: acento (se houver) + corpo + cauda. */
    _rasterize(ch) {
        const mask = new Uint8Array(GW * ATLAS_H);
        const accent = ACCENTED[ch];
        const baseChar = accent ? accent[0] : ch;
        const body = BODY[baseChar];
        if (!body) return mask;

        const paint = (rows, top) => {
            for (let y = 0; y < rows.length; y++) {
                const line = rows[y];
                const ry = top + y;
                if (ry < 0 || ry >= ATLAS_H) continue;
                for (let x = 0; x < GW; x++) {
                    if (line[x] === '#') mask[ry * GW + x] = 1;
                }
            }
        };

        paint(body, BODY_TOP);
        if (TAIL[baseChar]) paint(TAIL[baseChar], BODY_TOP + 7);
        if (accent && accent[1]) {
            paint(MARK[accent[1]], isLower(baseChar) ? LOWER_MARK_DROP : 0);
        }
        if (ch === 'Ç' || ch === 'ç') paint(CEDILLA, BODY_TOP + 7);
        return mask;
    }

    /** Atlas tingido de uma cor sólida, memoizado. */
    _tinted(color) {
        const hit = this.tintCache.get(color);
        if (hit) return hit;
        const cv = document.createElement('canvas');
        cv.width = this.atlas.width;
        cv.height = this.atlas.height;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = color;
        g.fillRect(0, 0, cv.width, cv.height);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(this.atlas, 0, 0);
        this.tintCache.set(color, cv);
        return cv;
    }

    /**
     * Atlas com rampa vertical: cada linha do corpo recebe uma cor da lista.
     * É o truque de logotipo dos cartuchos 16-bit — letra clara em cima, quente embaixo —
     * e sai de graça porque todas as células têm a mesma altura.
     */
    _ramped(ramp) {
        const key = ramp.join('|');
        const hit = this.rampCache.get(key);
        if (hit) return hit;
        const cv = document.createElement('canvas');
        cv.width = this.atlas.width;
        cv.height = this.atlas.height;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        const rows = Math.ceil(CHARS.length / COLS);
        for (let cell = 0; cell < rows; cell++) {
            for (let y = 0; y < ATLAS_H; y++) {
                const t = (y - BODY_TOP) / 6;
                const idx = Math.max(0, Math.min(ramp.length - 1, Math.round(t * (ramp.length - 1))));
                g.fillStyle = resolveColor(ramp[idx]);
                g.fillRect(0, cell * ATLAS_H + y, cv.width, 1);
            }
        }
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(this.atlas, 0, 0);
        this.rampCache.set(key, cv);
        return cv;
    }

    charWidth(ch, mono) {
        if (mono) return CELL_W;
        return this.adv.get(ch) ?? CELL_W;
    }

    measure(str, opts = {}) {
        const mono = opts.mono !== false;
        let w = 0;
        for (const ch of str) w += this.charWidth(ch, mono) + (mono ? 0 : 1);
        return mono ? w : Math.max(0, w - 1);
    }

    /** Altura de uma linha de texto — usada por quem empilha texto sem chutar constantes. */
    lineHeight(scale = 1) { return CELL_H * scale; }

    wrap(str, maxW, opts = {}) {
        const words = String(str).split(' ');
        const lines = [];
        let cur = '';
        for (const word of words) {
            const trial = cur ? cur + ' ' + word : word;
            if (this.measure(trial, opts) > maxW && cur) {
                lines.push(cur);
                cur = word;
            } else {
                cur = trial;
            }
        }
        if (cur) lines.push(cur);
        return lines;
    }

    /**
     * Desenha texto no ctx.
     * opts: { color, shadow, outline, ramp, align, mono, scale, alpha, wave }
     * - `ramp`: array de chars/cores para o degradê vertical do glifo.
     * - `outline`: cor de contorno em 4 direções (mais barato que as 8 do textBig).
     */
    text(ctx, str, x, y, opts = {}) {
        const s = String(str);
        const scale = opts.scale || 1;
        const mono = opts.mono !== false;
        const align = opts.align || 'left';
        const w = this.measure(s, { mono }) * scale;
        let drawX = x;
        if (align === 'center') drawX = Math.round(x - w / 2);
        else if (align === 'right') drawX = Math.round(x - w);

        if (opts.alpha != null) ctx.globalAlpha = opts.alpha;

        if (opts.outline) {
            const oc = resolveColor(opts.outline);
            const d = scale;
            this._draw(ctx, s, drawX - d, y, oc, mono, scale, opts.wave);
            this._draw(ctx, s, drawX + d, y, oc, mono, scale, opts.wave);
            this._draw(ctx, s, drawX, y - d, oc, mono, scale, opts.wave);
            this._draw(ctx, s, drawX, y + d, oc, mono, scale, opts.wave);
        }
        if (opts.shadow) {
            this._draw(ctx, s, drawX + scale, y + scale, resolveColor(opts.shadow), mono, scale, opts.wave);
        }

        const paint = opts.ramp ? this._ramped(opts.ramp) : this._tinted(resolveColor(opts.color));
        this._draw(ctx, s, drawX, y, paint, mono, scale, opts.wave);

        if (opts.alpha != null) ctx.globalAlpha = 1;
        return w;
    }

    /** `paint` pode ser uma cor (string) ou um canvas de atlas já pronto. */
    _draw(ctx, str, x, y, paint, mono, scale, wave) {
        const atlas = typeof paint === 'string' ? this._tinted(paint) : paint;
        const top = y + DRAW_DY * scale;
        let cx = x;
        let i = 0;
        for (const ch of str) {
            const pos = this.index.get(ch) || this.index.get(ch.toUpperCase()) || this.index.get('?');
            const yOff = wave ? Math.sin(i * 0.6 + wave.t * (wave.speed || 6)) * (wave.amp || 1) : 0;
            ctx.drawImage(
                atlas, pos.x, pos.y, CELL_W, ATLAS_H,
                Math.round(cx), Math.round(top + yOff * scale),
                CELL_W * scale, ATLAS_H * scale
            );
            cx += (this.charWidth(ch, mono) + (mono ? 0 : 1)) * scale;
            i++;
        }
    }

    /**
     * Título grande com contorno em 8 direções — tela de título, resultados, pódio.
     * Aceita `ramp` para o preenchimento em degradê.
     */
    textBig(ctx, str, x, y, opts = {}) {
        const scale = opts.scale || 3;
        const outline = opts.outlineColor || '#000000';
        const align = opts.align || 'center';
        const base = { ...opts, scale, align, shadow: null, outline: null };
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                this.text(ctx, str, x + dx * scale, y + dy * scale,
                    { ...base, color: outline, ramp: null });
            }
        }
        return this.text(ctx, str, x, y, base);
    }
}

export function createFont() {
    return new BitmapFont().build();
}
