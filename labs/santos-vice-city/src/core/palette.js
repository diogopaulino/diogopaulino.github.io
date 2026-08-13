// core/palette.js — paleta mestra 16-bit (48 cores) indexada por char, + matriz de dithering.
// Teto: ~120 linhas.

/** Paleta mestra "SVC" — pôr do sol vice-city, mar, areia, verde, concreto, pele, neon. */
export const SVC = {
    ' ': null, '.': null, // transparente

    // noite / contorno
    '0': '#0d0a1a', '1': '#1b1233', '2': '#2e1b4d',

    // rampa pôr do sol (a "vice" ramp)
    '3': '#5a2a63', '4': '#93316b', '5': '#d94f6a',
    '6': '#f97a4d', '7': '#ffb35c', '8': '#ffe28a',

    // mar
    '9': '#0b3d5c', 'a': '#12607f', 'b': '#1a8ba3', 'c': '#3fb8c4', 'd': '#8fe3dc',

    // areia
    'e': '#7a5638', 'f': '#b98a52', 'g': '#e0bd82', 'h': '#f5e3b6',

    // verde (jardins, morro)
    'i': '#123d2a', 'j': '#1e6b3c', 'k': '#37a04f', 'l': '#7ed36a',

    // concreto / cidade
    'm': '#2a2a38', 'n': '#454a5c', 'o': '#6b7386', 'p': '#9aa3b5', 'q': '#cdd3e0', 'r': '#f2f4fb',

    // pele (5 tons)
    's': '#5a3320', 't': '#8a5334', 'u': '#c08457', 'v': '#e8b088', 'w': '#f6d8bd',

    // neon
    'x': '#ff2fa0', 'y': '#00f0ff', 'z': '#b74dff', 'A': '#ffe600',

    // utilitários
    'B': '#e03a2f', 'C': '#2b6ad6', 'D': '#3a2417', 'E': '#ffffff', 'F': '#000000',
    'G': '#ff9dc4', 'H': '#7cf0a0', 'I': '#c8382f', 'J': '#f0f0ff',

    // extra utilitário para roupas/variação
    'K': '#f4a300', 'L': '#00897b', 'M': '#6d4c41', 'N': '#8e24aa',

    // rampas complementares abertas na revisão 16-bit: mar profundo, espuma, areia molhada,
    // sombra de sprite e dois neons secundários para o HUD
    'O': '#062a42', 'P': '#c9f5ef', 'Q': '#5c4630', 'R': '#9d7047',
    'S': '#1a1626', 'T': '#3a2f52', 'U': '#ff5d8f', 'V': '#6ef2c0'
};

/** Coluna do sol no céu — mar, reflexo e brilhos se alinham a ela. */
export const SUN_X = 0.62;

/**
 * Constrói um sub-conjunto de paleta com aliases legíveis para um sprite específico.
 * Ex.: sub({ o:'g', b:'f', s:'6', k:'0' }) -> mapeia char 'o' para a cor SVC['g'], etc.
 */
export function sub(map) {
    const pal = { ' ': null, '.': null };
    for (const k in map) pal[k] = SVC[map[k]];
    return pal;
}

/** Matriz Bayer 4x4 normalizada em [0,1) — para dithering de gradientes/transições. */
export const BAYER4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
].map((row) => row.map((v) => v / 16));

export function bayerThreshold(x, y) {
    return BAYER4[y & 3][x & 3];
}

/**
 * Desenha um gradiente vertical ditherizado dentro de (x,y,w,h) usando uma rampa de chars.
 * ramp: array de chars da paleta em ordem (escuro -> claro).
 */
export function ditherGradient(ctx, x, y, w, h, ramp, pal) {
    const steps = ramp.length - 1;
    for (let ry = 0; ry < h; ry++) {
        const t = h <= 1 ? 0 : ry / (h - 1);
        const pos = t * steps;
        const idx = Math.min(steps - 1, Math.floor(pos));
        const frac = pos - idx;
        for (let rx = 0; rx < w; rx++) {
            const thresh = bayerThreshold(rx, ry);
            const useUpper = frac > thresh;
            const ch = ramp[useUpper ? idx + 1 : idx];
            const col = pal ? pal[ch] : SVC[ch];
            if (!col) continue;
            ctx.fillStyle = col;
            ctx.fillRect(x + rx, y + ry, 1, 1);
        }
    }
}
