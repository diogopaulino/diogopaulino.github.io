// art/scenery.js — camadas de fundo pré-renderizadas.
//
// Os fundos são gradientes ditherizados e silhuetas com muito detalhe por pixel: redesenhar
// isso a cada frame custaria caro. Cada camada é rasterizada UMA vez para um canvas offscreen
// no boot e depois só é blitada com deslocamento de parallax — o custo por frame vira um
// punhado de drawImage.
//
// Referências locais são de propósito: os prédios tortos da Ponta da Praia, o Monte Serrat com
// o funicular, o Quebra-Mar avançando na água. É Santos, não uma praia genérica.

import { SVC, ditherGradient } from '../core/palette.js';
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
    g.fillRect(x | 0, y | 0, w | 0, h | 0);
}

/**
 * Céu de pôr do sol "vice": rampa noite -> magenta -> laranja -> creme, com o sol listrado
 * característico do visual outrun e um banco de nuvens em silhueta.
 */
function makeSky(sunY = 118, sunR = 34) {
    const { cv, g } = canvas(W, H);
    ditherGradient(g, 0, 0, W, sunY + sunR, ['1', '2', '3', '4', '5', '6', '7', '8'], SVC);

    // sol com faixas horizontais (as barras crescem em direção à base)
    const cx = W * 0.62;
    for (let dy = -sunR; dy <= sunR; dy++) {
        const halfW = Math.sqrt(Math.max(0, sunR * sunR - dy * dy));
        const yy = sunY + dy;
        const t = (dy + sunR) / (2 * sunR);
        const band = Math.floor((yy + 400) / (3 + t * 6)) % 2 === 0;
        if (t > 0.45 && band) continue;   // corte das listras só na metade de baixo
        const ch = t < 0.3 ? '8' : t < 0.6 ? '7' : '6';
        px(g, cx - halfW, yy, halfW * 2, 1, ch);
    }

    // nuvens finas em silhueta contra o sol
    const bands = [[24, 0.5, 120], [44, 0.8, 90], [70, 0.35, 150], [92, 0.6, 70]];
    for (const [y, alpha, len] of bands) {
        g.globalAlpha = alpha;
        for (let i = 0; i < 4; i++) {
            const x = (i * 97 + y * 3) % W;
            px(g, x, y, len * 0.4, 2, '3');
            px(g, x + 12, y + 2, len * 0.25, 1, '4');
        }
        g.globalAlpha = 1;
    }
    return cv;
}

/**
 * Skyline de Santos em silhueta, tileável na horizontal.
 * Alguns prédios saem propositalmente inclinados — os "prédios tortos" da Ponta da Praia,
 * que afundaram em solo de areia sem fundação profunda e viraram cartão-postal involuntário.
 */
function makeSkyline(width = 640, height = 78, tint = '2', tintTop = '3') {
    const { cv, g } = canvas(width, height);
    let x = 0;
    let seed = 7;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    while (x < width) {
        const bw = 12 + Math.floor(rnd() * 22);
        const bh = 22 + Math.floor(rnd() * (height - 26));
        const lean = rnd() < 0.22 ? (rnd() < 0.5 ? -1 : 1) : 0;   // ~1 em 5 prédios inclina

        for (let row = 0; row < bh; row++) {
            const y = height - 1 - row;
            const shift = lean ? Math.round(lean * row * 0.14) : 0;
            px(g, x + shift, y, bw, 1, row > bh - 6 ? tintTop : tint);
        }
        // janelas acesas
        for (let wy = 4; wy < bh - 6; wy += 5) {
            for (let wx = 2; wx < bw - 2; wx += 4) {
                if (rnd() < 0.42) {
                    const y = height - 1 - wy;
                    const shift = lean ? Math.round(lean * wy * 0.14) : 0;
                    px(g, x + wx + shift, y, 2, 2, rnd() < 0.7 ? '8' : 'A');
                }
            }
        }
        x += bw + 2 + Math.floor(rnd() * 5);
    }
    return cv;
}

/** Monte Serrat: silhueta do morro com o traçado do funicular e a capela no topo. */
function makeMorro(width = 320, height = 96) {
    const { cv, g } = canvas(width, height);
    const peak = width * 0.5;
    for (let x = 0; x < width; x++) {
        const d = Math.abs(x - peak) / (width * 0.5);
        const top = Math.round(height - (1 - d * d) * (height - 8) - 4);
        for (let y = top; y < height; y++) {
            const shade = y < top + 6 ? 'j' : y < top + 22 ? 'i' : '1';
            px(g, x, y, 1, 1, shade);
        }
    }
    // trilho do funicular subindo pela encosta direita
    for (let t = 0; t < 46; t++) {
        const x = Math.round(peak + 10 + t * 1.5);
        const y = Math.round(height - 6 - t * 1.55);
        px(g, x, y, 2, 1, 'p');
        if (t % 6 === 0) px(g, x - 1, y - 1, 4, 1, 'o');
    }
    // capela no topo
    px(g, peak - 4, height * 0.06 + 2, 9, 7, 'q');
    px(g, peak - 1, height * 0.06 - 3, 2, 6, 'q');
    px(g, peak - 3, height * 0.06 - 1, 6, 1, 'q');
    return cv;
}

/** Faixa de mar com bandas ditherizadas — usada como base nas provas de água. */
function makeSea(width = W, height = 70) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 0, width, height, ['9', 'a', 'b', 'c'], SVC);
    // reflexo do sol: coluna cintilante
    for (let y = 0; y < height; y += 2) {
        const w = 3 + ((y * 7) % 11);
        px(g, width * 0.62 - w / 2, y, w, 1, y % 4 === 0 ? '8' : '7');
    }
    return cv;
}

/** Faixa de areia com granulado. */
function makeSand(width = W, height = 60) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 0, width, height, ['h', 'g', 'f', 'e'], SVC);
    let seed = 91;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < width * 3; i++) {
        const x = Math.floor(rnd() * width);
        const y = Math.floor(rnd() * height);
        px(g, x, y, 1, 1, rnd() < 0.5 ? 'e' : 'h');
    }
    return cv;
}

/** Quebra-Mar: espinha de pedras entrando no mar, em perspectiva. */
function makeBreakwater(width = 200, height = 40) {
    const { cv, g } = canvas(width, height);
    let seed = 33;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let x = 0; x < width; x++) {
        const t = x / width;
        const h = Math.round(4 + (1 - t) * 14);
        const y = Math.round(height - h - t * 6);
        for (let j = 0; j < h; j++) {
            px(g, x, y + j, 1, 1, rnd() < 0.3 ? 'n' : rnd() < 0.6 ? 'm' : 'o');
        }
    }
    return cv;
}

/** Céu noturno com estrelas — usado no pódio e na tela de título. */
function makeStarfield(width = W, height = 120) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 0, width, height, ['0', '1', '2', '3'], SVC);
    let seed = 5;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let i = 0; i < 110; i++) {
        const x = Math.floor(rnd() * width);
        const y = Math.floor(rnd() * height * 0.8);
        px(g, x, y, 1, 1, rnd() < 0.25 ? 'E' : rnd() < 0.6 ? 'q' : 'o');
    }
    return cv;
}

/**
 * Grade neon em perspectiva (piso do título/pódio). Devolve uma função de desenho em vez de
 * um canvas porque ela anima: as linhas horizontais rolam em direção ao observador.
 */
export function drawNeonGrid(ctx, y0, h, t, colorH = 'x', colorV = 'z') {
    const horizonY = y0;
    ctx.fillStyle = SVC[colorV];
    for (let i = -10; i <= 10; i++) {
        const xBottom = W / 2 + i * 46;
        ctx.beginPath();
        ctx.moveTo(W / 2 + i * 3, horizonY);
        ctx.lineTo(xBottom, y0 + h);
        ctx.strokeStyle = SVC[colorV];
        ctx.stroke();
    }
    ctx.fillStyle = SVC[colorH];
    for (let i = 0; i < 14; i++) {
        const p = ((i / 14) + (t * 0.25 % 1)) % 1;
        const yy = horizonY + Math.pow(p, 2.2) * h;
        ctx.fillRect(0, Math.round(yy), W, 1);
    }
}

/**
 * Constrói e memoiza todas as camadas. Chamado uma vez no boot; cada prova escolhe as
 * camadas que usa e o parallax que aplica.
 */
export function buildScenery() {
    return {
        sky: makeSky(),
        skyNight: makeStarfield(W, 140),
        skyline: makeSkyline(640, 78, '2', '3'),
        skylineFar: makeSkyline(640, 54, '1', '2'),
        morro: makeMorro(320, 96),
        sea: makeSea(W, 70),
        sand: makeSand(W, 60),
        breakwater: makeBreakwater(200, 40)
    };
}

/** Blit tileável horizontal — usado pelas camadas de parallax. */
export function tile(ctx, image, offsetX, y, width = W) {
    const iw = image.width;
    let x = -(((offsetX % iw) + iw) % iw);
    while (x < width) {
        ctx.drawImage(image, Math.round(x), Math.round(y));
        x += iw;
    }
}
