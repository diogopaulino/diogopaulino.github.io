// art/raster.js — primitivas de rasterização em grade de chars.
//
// Todo o desenho procedural do jogo (atleta, equipamentos, cenários) trabalha sobre um buffer
// de caracteres: cada char é um índice na paleta mestra e ' ' é transparente. Depois o buffer
// vira linhas de string e passa por `core/sprites.bake`, que é quem realmente pinta pixels.
// Trabalhar em chars mantém o pipeline igual ao da string-art escrita à mão e deixa qualquer
// sprite inspecionável como texto.

export const DEG = Math.PI / 180;

export function makeBuf(w, h, fill = ' ') {
    return { w, h, data: new Array(w * h).fill(fill) };
}

export function put(buf, x, y, ch) {
    const px = x | 0, py = y | 0;
    if (px < 0 || py < 0 || px >= buf.w || py >= buf.h) return;
    buf.data[py * buf.w + px] = ch;
}

export function get(buf, x, y) {
    const px = x | 0, py = y | 0;
    if (px < 0 || py < 0 || px >= buf.w || py >= buf.h) return ' ';
    return buf.data[py * buf.w + px];
}

export function fillRect(buf, x, y, w, h, ch) {
    for (let j = 0; j < h; j++) {
        for (let i = 0; i < w; i++) put(buf, x + i, y + j, ch);
    }
}

export function fillDisc(buf, cx, cy, r, ch) {
    const r2 = r * r;
    for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
            if (i * i + j * j <= r2) put(buf, cx + i, cy + j, ch);
        }
    }
}

/** Anel (roda de bicicleta, boia) — disco cheio menos o miolo. */
export function ring(buf, cx, cy, r, thick, ch) {
    const outer = r * r;
    const inner = Math.max(0, r - thick) * Math.max(0, r - thick);
    for (let j = -r; j <= r; j++) {
        for (let i = -r; i <= r; i++) {
            const d = i * i + j * j;
            if (d <= outer && d >= inner) put(buf, cx + i, cy + j, ch);
        }
    }
}

/** Elipse cheia — casco de canoa, corpos arredondados. */
export function fillEllipse(buf, cx, cy, rx, ry, ch) {
    for (let j = -ry; j <= ry; j++) {
        for (let i = -rx; i <= rx; i++) {
            const nx = i / (rx || 1), ny = j / (ry || 1);
            if (nx * nx + ny * ny <= 1) put(buf, cx + i, cy + j, ch);
        }
    }
}

/** Linha grossa (Bresenham + pincel quadrado). Devolve o ponto final. */
export function line(buf, x0, y0, x1, y1, thick, ch) {
    let x = Math.round(x0), y = Math.round(y0);
    const ex = Math.round(x1), ey = Math.round(y1);
    const dx = Math.abs(ex - x), dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
    let err = dx + dy;
    const half = Math.floor(thick / 2);
    let guard = 0;
    for (;;) {
        fillRect(buf, x - half, y - half, thick, thick, ch);
        if ((x === ex && y === ey) || guard++ > 1024) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
    }
    return { x: ex, y: ey };
}

/** Ponto a `len` px de (x,y) no ângulo dado (graus, 0 = direita, 90 = cima). */
export function tip(x, y, angleDeg, len) {
    const a = angleDeg * DEG;
    return { x: x + Math.cos(a) * len, y: y - Math.sin(a) * len };
}

/** Buffer -> array de strings de largura uniforme (formato aceito por sprites.bake). */
export function toRows(buf) {
    const rows = [];
    for (let y = 0; y < buf.h; y++) rows.push(buf.data.slice(y * buf.w, y * buf.w + buf.w).join(''));
    return rows;
}

/** Espelha horizontalmente um array de linhas. */
export function flipRows(rows) {
    return rows.map((r) => r.split('').reverse().join(''));
}

/**
 * Normaliza string-art escrita à mão: preenche as linhas curtas com espaço até a maior largura.
 * Evita a classe de bug mais chata desse pipeline — uma linha com um char a menos derrubava o
 * bake inteiro com exceção.
 */
export function padRows(rows) {
    const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    return rows.map((r) => r.padEnd(w, ' '));
}
