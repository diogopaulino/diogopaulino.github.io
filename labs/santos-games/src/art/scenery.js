// art/scenery.js — fundos pré-renderizados: Santos ensolarado estilo California Games MD.

import { SVC, SUN_X, ditherGradient } from '../core/palette.js';
import { W, H } from '../core/pixel.js';

function canvas(w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    g.imageSmoothingEnabled = false;
    return { cv, g };
}

function px(g, x, y, w, h, ch) {
    const col = SVC[ch];
    if (!col) return;
    g.fillStyle = col;
    g.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0));
}

function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

/** Céu diurno com sol listrado (cartucho 16-bit). */
function makeSky(sunY = 52, sunR = 28) {
    const { cv, g } = canvas(W, H);
    ditherGradient(g, 0, 0, W, sunY + sunR + 36, ['3', '4', '5', '5', '7', '8', 'h'], SVC);

    const cx = Math.round(W * SUN_X);

    for (let r = sunR + 12; r > sunR; r--) {
        const ch = r > sunR + 8 ? '7' : r > sunR + 4 ? '8' : 'h';
        for (let a = 0; a < 360; a += 4) {
            const rad = a * Math.PI / 180;
            px(g, cx + Math.cos(rad) * r, sunY - Math.sin(rad) * r, 1, 1, ch);
        }
    }

    for (let dy = -sunR; dy <= sunR; dy++) {
        const halfW = Math.sqrt(Math.max(0, sunR * sunR - dy * dy));
        const yy = sunY + dy;
        const t = (dy + sunR) / (2 * sunR);
        const band = Math.floor((yy + 400) / (3 + t * 5)) % 2 === 0;
        if (t > 0.4 && band) continue;
        const ch = t < 0.28 ? 'h' : t < 0.5 ? '8' : t < 0.72 ? '7' : '6';
        px(g, cx - halfW, yy, halfW * 2, 1, ch);
    }

    // nuvens brancas empilhadas
    const rnd = seeded(4242);
    for (let i = 0; i < 7; i++) {
        const x = Math.round(rnd() * W);
        const y = 10 + Math.round(rnd() * 36);
        const w = 28 + Math.round(rnd() * 42);
        px(g, x + 6, y - 2, w - 12, 1, 'r');
        px(g, x + 2, y, w - 4, 2, 'r');
        px(g, x, y + 2, w, 2, 'q');
        px(g, x + 8, y + 4, w - 16, 1, 'p');
    }
    return cv;
}

/** Céu de pódio / noite suave (teal profundo + estrelas). */
function makeStarfield(width = W, height = 120) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 0, width, height, ['0', '1', '2', '3'], SVC);
    const rnd = seeded(5);
    for (let i = 0; i < 110; i++) {
        const x = Math.floor(rnd() * width);
        const y = Math.floor(rnd() * height * 0.82);
        const r = rnd();
        px(g, x, y, 1, 1, r < 0.2 ? 'E' : r < 0.55 ? 'q' : 'o');
        if (r < 0.06) {
            px(g, x - 1, y, 1, 1, 'p'); px(g, x + 1, y, 1, 1, 'p');
            px(g, x, y - 1, 1, 1, 'p'); px(g, x, y + 1, 1, 1, 'p');
        }
    }
    return cv;
}

/**
 * Skyline diurno de Santos — prédios claros da orla, alguns inclinados (Ponta da Praia).
 */
function makeSkyline(width = 640, height = 78, body = 'q', edge = 'r', seed = 7) {
    const { cv, g } = canvas(width, height);
    let x = 0;
    const rnd = seeded(seed);

    while (x < width) {
        const bw = 12 + Math.floor(rnd() * 22);
        const bh = 22 + Math.floor(rnd() * (height - 26));
        const lean = rnd() < 0.2 ? (rnd() < 0.5 ? -1 : 1) : 0;

        for (let row = 0; row < bh; row++) {
            const y = height - 1 - row;
            const shift = lean ? Math.round(lean * row * 0.14) : 0;
            const shade = row > bh - 5 ? edge : (row % 7 === 0 ? 'p' : body);
            px(g, x + shift, y, bw, 1, shade);
            px(g, x + shift + bw - 1, y, 1, 1, edge);
        }

        const topY = height - bh;
        const crown = rnd();
        if (crown < 0.34) px(g, x + 3, topY - 4, 5, 4, edge);
        else if (crown < 0.6) px(g, x + Math.floor(bw / 2), topY - 7, 1, 7, 'o');

        // janelas escuras de dia + algumas com ar-condicionado
        for (let wy = 4; wy < bh - 6; wy += 5) {
            for (let wx = 2; wx < bw - 2; wx += 4) {
                if (rnd() < 0.55) {
                    const y = height - 1 - wy;
                    const shift = lean ? Math.round(lean * wy * 0.14) : 0;
                    px(g, x + wx + shift, y, 2, 2, rnd() < 0.15 ? 'y' : '3');
                }
            }
        }
        x += bw + 2 + Math.floor(rnd() * 5);
    }
    return cv;
}

function makeMorro(width = 320, height = 96) {
    const { cv, g } = canvas(width, height);
    const peak = width * 0.5;
    const rnd = seeded(19);
    for (let x = 0; x < width; x++) {
        const d = Math.abs(x - peak) / (width * 0.5);
        const bump = Math.sin(x * 0.13) * 2 + Math.sin(x * 0.041) * 3;
        const top = Math.round(height - (1 - d * d) * (height - 8) - 4 - bump);
        for (let y = top; y < height; y++) {
            const rel = y - top;
            const shade = rel < 3 ? 'k' : rel < 10 ? 'j' : 'i';
            px(g, x, y, 1, 1, shade);
        }
        px(g, x, height - 6, 1, 6, '1');
        if (rnd() < 0.16) px(g, x, top + 4 + Math.floor(rnd() * 12), 1, 2, 'l');
    }
    for (let t = 0; t < 46; t++) {
        const x = Math.round(peak + 10 + t * 1.5);
        const y = Math.round(height - 6 - t * 1.55);
        px(g, x, y, 2, 1, 'p');
        if (t % 6 === 0) px(g, x - 1, y - 1, 4, 1, 'o');
    }
    const capY = Math.round(height * 0.06);
    px(g, peak - 4, capY + 2, 9, 7, 'r');
    px(g, peak - 4, capY + 2, 9, 1, 'E');
    px(g, peak - 1, capY - 3, 2, 6, 'q');
    px(g, peak - 3, capY - 1, 6, 1, 'q');
    return cv;
}

function makeSea(width = W, height = 70) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 0, width, height, ['9', 'a', 'b', 'c'], SVC);

    const rnd = seeded(77);
    for (let y = 2; y < height; y += 3) {
        const t = y / height;
        const count = Math.round(6 + t * 10);
        for (let i = 0; i < count; i++) {
            const x = Math.floor(rnd() * width);
            const len = Math.round(3 + t * 9 + rnd() * 4);
            px(g, x, y, len, 1, t < 0.4 ? 'b' : 'c');
        }
    }

    const cx = Math.round(width * SUN_X);
    for (let y = 0; y < height; y++) {
        const t = y / height;
        const fadeIn = Math.min(1, y / 10);
        if (rnd() < 0.25 + t * 0.25 + (1 - fadeIn) * 0.6) continue;
        const spread = 2 + t * 13;
        const len = Math.max(1, Math.round((1 - t * 0.55) * (2 + rnd() * 5)));
        const x = cx + Math.round((rnd() - 0.5) * spread * 2) - len / 2;
        px(g, x, y, len, 1, t < 0.3 ? 'h' : t < 0.6 ? '8' : '7');
    }
    return cv;
}

function makeSand(width = W, height = 60) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 6, width, height - 6, ['h', 'g', 'f', 'e'], SVC);

    const rnd = seeded(91);
    px(g, 0, 0, width, 6, 'R');
    for (let x = 0; x < width; x++) {
        const wob = Math.round(Math.sin(x * 0.09) * 1.5 + Math.sin(x * 0.31) * 1);
        px(g, x, 0, 1, 3 + wob, 'Q');
        px(g, x, 5 + wob, 1, 2, 'g');
        if (rnd() < 0.1) px(g, x, 1 + wob, 1, 1, 'd');
    }

    for (let i = 0; i < width * 2.2; i++) {
        const x = Math.floor(rnd() * width);
        const y = 7 + Math.floor(rnd() * (height - 8));
        px(g, x, y, 1, 1, rnd() < 0.5 ? 'e' : 'h');
    }
    for (let i = 0; i < 26; i++) {
        const x = Math.floor(rnd() * width);
        const y = 12 + Math.floor(rnd() * (height - 16));
        px(g, x, y, 2, 1, 'h');
        px(g, x, y + 1, 2, 1, 'f');
    }
    return cv;
}

function makeBreakwater(width = 200, height = 40) {
    const { cv, g } = canvas(width, height);
    const rnd = seeded(33);
    for (let x = 0; x < width; x++) {
        const t = x / width;
        const h = Math.round(4 + (1 - t) * 14);
        const y = Math.round(height - h - t * 6);
        for (let j = 0; j < h; j++) {
            const r = rnd();
            const ch = j === 0 ? 'p' : j < h * 0.4 ? (r < 0.4 ? 'o' : 'n') : (r < 0.4 ? 'n' : 'm');
            px(g, x, y + j, 1, 1, ch);
        }
        if (rnd() < 0.12) px(g, x, y + h - 1, 2, 2, 'P');
    }
    return cv;
}

/**
 * Faixa de calçadão limpa (poucas linhas) — leitura Mega Drive, sem grade synthwave.
 */
export function drawBoardwalk(ctx, y0, h, t, colorH = 'y', colorV = 'c') {
    const horizonY = y0;
    ctx.fillStyle = SVC['g'];
    ctx.fillRect(0, horizonY, W, h);

    // ciclovia vermelha
    ctx.fillStyle = SVC['B'];
    ctx.beginPath();
    ctx.moveTo(W / 2 - 3, horizonY);
    ctx.lineTo(W / 2 - 36, y0 + h);
    ctx.lineTo(W / 2 + 36, y0 + h);
    ctx.lineTo(W / 2 + 3, horizonY);
    ctx.closePath();
    ctx.fill();

    // linhas de perspectiva (poucas, limpas)
    ctx.strokeStyle = SVC['e'];
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -6; i <= 6; i++) {
        if (i === 0) continue;
        ctx.moveTo(W / 2 + i * 4 + 0.5, horizonY + 0.5);
        ctx.lineTo(W / 2 + i * 40 + 0.5, y0 + h + 0.5);
    }
    ctx.stroke();

    for (let i = 0; i < 8; i++) {
        const p = ((i / 8) + (t * 0.15 % 1)) % 1;
        const yy = horizonY + Math.pow(p, 2.1) * h;
        ctx.fillStyle = SVC[p > 0.55 ? colorH : colorV];
        ctx.fillRect(0, Math.round(yy), W, 1);
    }
}

/** Alias legado — menus antigos ainda importam drawNeonGrid. */
export function drawNeonGrid(ctx, y0, h, t, colorH = 'y', colorV = 'c') {
    drawBoardwalk(ctx, y0, h, t, colorH, colorV);
}

export function drawWater(px2, x, y, w, h, t, scroll = 0) {
    const bands = ['b', 'a', '9', 'O'];
    for (let i = 0; i < h; i++) {
        const p = i / h;
        const idx = Math.min(bands.length - 1, Math.floor(p * bands.length));
        px2.rect(x, y + i, w, 1, SVC[bands[idx]]);
    }
    for (let i = 0; i < 22; i++) {
        const p = ((i * 0.137 + t * 0.05) % 1);
        const yy = y + Math.round(p * p * h);
        const len = 4 + Math.round(p * 12);
        const xx = x + (((i * 71 - scroll * (0.3 + p)) % (w + 40)) + w + 40) % (w + 40) - 20;
        px2.rect(xx, yy, len, 1, SVC[p < 0.45 ? 'b' : 'c']);
    }
}

export function drawShoreFoam(px2, y, t, width = W) {
    for (let x = 0; x < width; x++) {
        const wob = Math.sin(x * 0.11 + t * 1.6) * 2 + Math.sin(x * 0.037 - t) * 1.5;
        px2.rect(x, y + wob, 1, 2, SVC['P']);
        px2.rect(x, y + wob + 2, 1, 1, SVC['d']);
        if ((x + Math.floor(t * 12)) % 13 < 2) px2.rect(x, y + wob - 1, 1, 1, SVC['E']);
    }
}

export function drawShadow(px2, cx, cy, rx, alpha = 0.4) {
    const ctx = px2.ctx;
    ctx.globalAlpha = alpha;
    px2.rect(cx - rx, cy, rx * 2, 2, SVC['S']);
    px2.rect(cx - rx * 0.6, cy - 1, rx * 1.2, 1, SVC['S']);
    px2.rect(cx - rx * 0.6, cy + 2, rx * 1.2, 1, SVC['S']);
    ctx.globalAlpha = 1;
}

export function buildScenery() {
    return {
        sky: makeSky(),
        skyNight: makeStarfield(W, 140),
        skyline: makeSkyline(640, 78, 'q', 'r', 7),
        skylineFar: makeSkyline(640, 54, 'p', 'q', 23),
        morro: makeMorro(320, 96),
        sea: makeSea(W, 70),
        seaFar: makeSea(W, 40),
        sand: makeSand(W, 60),
        breakwater: makeBreakwater(200, 40)
    };
}

export function tile(ctx, image, offsetX, y, width = W) {
    const iw = image.width;
    let x = -(((offsetX % iw) + iw) % iw);
    while (x < width) {
        ctx.drawImage(image, Math.round(x), Math.round(y));
        x += iw;
    }
}
