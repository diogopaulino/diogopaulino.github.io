// core/palette.js — paleta Mega Drive limpa (cores saturadas, contraste alto, poucos tons mudos).

/** Paleta mestra — California Games / Santos, leitura clara em 320×224. */
export const SVC = {
    ' ': null, '.': null,

    // preto / painéis (cinza-azul frio, sem roxo)
    '0': '#000000', '1': '#101820', '2': '#203040',

    // céu diurno (azul limpo → sol)
    '3': '#2868a0', '4': '#4890c8', '5': '#78c0e8',
    '6': '#f07828', '7': '#f0a830', '8': '#f0d848',

    // mar
    '9': '#003858', 'a': '#006888', 'b': '#0090a8', 'c': '#20c0b0', 'd': '#68e0d0',

    // areia
    'e': '#805028', 'f': '#c08840', 'g': '#e0b868', 'h': '#f0e0b0',

    // verde
    'i': '#084018', 'j': '#187028', 'k': '#28a830', 'l': '#58e040',

    // cidade / UI cinza
    'm': '#282838', 'n': '#484858', 'o': '#707088', 'p': '#a0a0b8', 'q': '#d0d0e0', 'r': '#f0f0f8',

    // pele
    's': '#603020', 't': '#905038', 'u': '#c88858', 'v': '#e8b080', 'w': '#f0d0b0',

    // acentos (coral / teal / ouro)
    'x': '#f05040', 'y': '#38c8b8', 'z': '#f0c040', 'A': '#f0e020',

    // utilitários
    'B': '#e02820', 'C': '#2868d0', 'D': '#382818', 'E': '#ffffff', 'F': '#000000',
    'G': '#f090b0', 'H': '#60e880', 'I': '#c02820', 'J': '#e8e8f8',

    'K': '#f09800', 'L': '#089880', 'M': '#684838', 'N': '#f06848',

    'O': '#002838', 'P': '#c0f0e8', 'Q': '#584830', 'R': '#987048',
    'S': '#080810', 'T': '#182838', 'U': '#f06848', 'V': '#58e8b0'
};

export const SUN_X = 0.7;

export function sub(map) {
    const pal = { ' ': null, '.': null };
    for (const k in map) pal[k] = SVC[map[k]];
    return pal;
}

export const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
].map((row) => row.map((v) => v / 16));

export function bayerThreshold(x, y) {
    return BAYER4[y & 3][x & 3];
}

export function ditherGradient(ctx, x, y, w, h, ramp, pal) {
    const steps = ramp.length - 1;
    for (let ry = 0; ry < h; ry++) {
        const t = h <= 1 ? 0 : ry / (h - 1);
        const pos = t * steps;
        const idx = Math.min(steps - 1, Math.floor(pos));
        const frac = pos - idx;
        const a = ramp[idx];
        const b = ramp[idx + 1] || a;
        for (let rx = 0; rx < w; rx++) {
            const pick = bayerThreshold(x + rx, y + ry) < frac ? b : a;
            const col = pal[pick];
            if (!col) continue;
            ctx.fillStyle = col;
            ctx.fillRect(x + rx, y + ry, 1, 1);
        }
    }
}
