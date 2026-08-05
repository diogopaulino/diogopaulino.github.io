/* ==========================================================================
   Ravi 1·2·3 — fonte bitmap 5×7 (caixa alta, com acentos pt-BR)
   --------------------------------------------------------------------------
   Caixa alta só, como nos jogos DOS da época. Cada glifo vive numa célula de
   5×11: linhas 0–1 para o acento, 2–8 para a letra, 9–10 para a cedilha.
   Um atlas é assado por cor na primeira vez que aquela cor é usada; depois
   escrever texto é só uma sequência de drawImage.
   ========================================================================== */

import { PAL } from './assets.js';
import { makeSurface } from './screen.js';

const CW = 5;   // largura do glifo
const CH = 11;  // altura da célula (acento + corpo + cedilha)
const BODY = 2; // linha onde o corpo começa
export const ADV = 6;         // avanço horizontal (glifo + 1px de espaço)
export const LINE = 10;       // altura de linha
export const TOP = BODY;      // deslocamento do corpo dentro da célula

/* Corpo de cada glifo: 7 linhas de 5 colunas. */
const BODIES = {
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
  'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],

  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],

  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'],
  ':': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.....'],
  ';': ['.....', '..#..', '..#..', '.....', '..#..', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '/': ['....#', '....#', '...#.', '..#..', '.#...', '#....', '#....'],
  "'": ['..#..', '..#..', '.....', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '·': ['.....', '.....', '.....', '..#..', '.....', '.....', '.....'],
  '×': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  '%': ['##..#', '##.#.', '..#..', '.#...', '#.##.', '..##.', '.....'],
  '*': ['.....', '#.#.#', '.###.', '#####', '.###.', '#.#.#', '.....'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####']
};

/* Marcas diacríticas, 2 linhas de 5 colunas, desenhadas acima do corpo. */
const MARKS = {
  acute: ['...#.', '..#..'],
  grave: ['.#...', '..#..'],
  circ: ['..#..', '.#.#.'],
  tilde: ['.##.#', '#..#.'],
  diaer: ['.#.#.', '.....']
};

/* Cedilha, 2 linhas desenhadas abaixo do corpo. */
const CEDILLA = ['...#.', '..##.'];

/* Letras acentuadas montadas a partir da base + marca. */
const ACCENTED = {
  'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'],
  'É': ['E', 'acute'], 'Ê': ['E', 'circ'],
  'Í': ['I', 'acute'],
  'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'],
  'Ú': ['U', 'acute'], 'Ü': ['U', 'diaer'],
  'Ç': ['C', null]
};

/* Ordem fixa dos glifos no atlas. */
const ORDER = Object.keys(BODIES).concat(Object.keys(ACCENTED));
const INDEX = new Map(ORDER.map((c, i) => [c, i]));
const COLS = 16;

const atlases = new Map();

/** Assa (ou devolve do cache) o atlas completo numa cor da paleta. */
function getAtlas(colorIndex) {
  let atlas = atlases.get(colorIndex);
  if (atlas) return atlas;

  const rows = Math.ceil(ORDER.length / COLS);
  const s = makeSurface(COLS * CW, rows * CH);
  s.ctx.fillStyle = PAL[colorIndex] || PAL[1];

  for (let i = 0; i < ORDER.length; i++) {
    const ch = ORDER[i];
    const ox = (i % COLS) * CW;
    const oy = Math.floor(i / COLS) * CH;
    const pair = ACCENTED[ch];
    const body = BODIES[pair ? pair[0] : ch];
    if (!body) continue;

    for (let y = 0; y < body.length; y++) {
      const line = body[y];
      for (let x = 0; x < CW; x++) {
        if (line[x] === '#') s.ctx.fillRect(ox + x, oy + BODY + y, 1, 1);
      }
    }
    if (pair && pair[1]) {
      const mark = MARKS[pair[1]];
      for (let y = 0; y < mark.length; y++) {
        for (let x = 0; x < CW; x++) {
          if (mark[y][x] === '#') s.ctx.fillRect(ox + x, oy + y, 1, 1);
        }
      }
    }
    if (ch === 'Ç') {
      for (let y = 0; y < CEDILLA.length; y++) {
        for (let x = 0; x < CW; x++) {
          if (CEDILLA[y][x] === '#') s.ctx.fillRect(ox + x, oy + BODY + 7 + y, 1, 1);
        }
      }
    }
  }

  atlas = { canvas: s.canvas };
  atlases.set(colorIndex, atlas);
  return atlas;
}

/** Largura em pixels que um texto vai ocupar numa dada escala. */
export function measure(text, scale = 1) {
  const n = String(text).length;
  return n ? (n * ADV - 1) * scale : 0;
}

/**
 * Escreve texto. (x, y) é o canto superior esquerdo do corpo das letras —
 * acentos sobem 2px acima disso.
 * opts: { scale, shadow } — shadow é um índice de paleta desenhado 1px abaixo/direita.
 */
export function text(ctx, str, x, y, colorIndex = 1, opts = {}) {
  const scale = opts.scale || 1;
  const s = String(str).toUpperCase();

  if (opts.shadow !== undefined && opts.shadow !== null) {
    draw(ctx, s, x + scale, y + scale, opts.shadow, scale);
  }
  draw(ctx, s, x, y, colorIndex, scale);
  return measure(s, scale);
}

function draw(ctx, s, x, y, colorIndex, scale) {
  const atlas = getAtlas(colorIndex);
  const top = y - BODY * scale;
  for (let i = 0; i < s.length; i++) {
    const gi = INDEX.get(s[i]);
    if (gi === undefined) continue;
    const sx = (gi % COLS) * CW;
    const sy = Math.floor(gi / COLS) * CH;
    ctx.drawImage(
      atlas.canvas,
      sx, sy, CW, CH,
      (x + i * ADV * scale) | 0, top | 0,
      CW * scale, CH * scale
    );
  }
}

/** Escreve centrado em torno de cx. */
export function textCenter(ctx, str, cx, y, colorIndex = 1, opts = {}) {
  const w = measure(String(str), opts.scale || 1);
  return text(ctx, str, Math.round(cx - w / 2), y, colorIndex, opts);
}

/**
 * Quebra um texto em linhas que caibam em `maxWidth` pixels.
 * Usado pela barra de fala, que tem largura fixa.
 */
export function wrap(str, maxWidth, scale = 1) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate, scale) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}
