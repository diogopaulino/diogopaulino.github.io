// art/scenery.js — camadas de fundo pré-renderizadas.
//
// Os fundos são gradientes ditherizados e silhuetas com muito detalhe por pixel: redesenhar
// isso a cada frame custaria caro. Cada camada é rasterizada UMA vez para um canvas offscreen
// no boot e depois só é blitada com deslocamento de parallax — o custo por frame vira um
// punhado de drawImage.
//
// Referências locais são de propósito: os prédios tortos da Ponta da Praia, o Monte Serrat com
// o funicular, o Quebra-Mar avançando na água. É Santos, não uma praia genérica.
//
// Tudo que é "brilho do sol" (a coluna cintilante no mar, o reflexo na areia molhada) nasce da
// mesma constante SUN_X. Antes cada camada escolhia a sua e o resultado era uma coluna amarela
// solta no meio da água, sem sol nenhum acima dela.

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

/** Gerador determinístico local — cada camada tem a sua semente e sai igual todo boot. */
function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
}

// ---------------------------------------------------------------------------
// Céu
// ---------------------------------------------------------------------------

/**
 * Céu de pôr do sol "vice": rampa noite -> magenta -> laranja -> creme, com o sol listrado
 * característico do visual outrun e bancos de nuvem em duas tintas.
 */
function makeSky(sunY = 118, sunR = 34) {
    const { cv, g } = canvas(W, H);
    ditherGradient(g, 0, 0, W, sunY + sunR + 24, ['1', '2', '3', '4', '5', '6', '7', '8'], SVC);

    const cx = Math.round(W * SUN_X);

    // halo: o sol não corta o céu num círculo duro, ele sangra em volta
    for (let r = sunR + 14; r > sunR; r--) {
        const ch = r > sunR + 9 ? '5' : r > sunR + 4 ? '6' : '7';
        for (let a = 0; a < 360; a += 3) {
            const rad = a * Math.PI / 180;
            px(g, cx + Math.cos(rad) * r, sunY - Math.sin(rad) * r, 1, 1, ch);
        }
    }

    // disco com faixas horizontais: finas em cima, grossas embaixo
    for (let dy = -sunR; dy <= sunR; dy++) {
        const halfW = Math.sqrt(Math.max(0, sunR * sunR - dy * dy));
        const yy = sunY + dy;
        const t = (dy + sunR) / (2 * sunR);
        const band = Math.floor((yy + 400) / (3 + t * 6)) % 2 === 0;
        if (t > 0.45 && band) continue;
        const ch = t < 0.26 ? 'h' : t < 0.44 ? '8' : t < 0.68 ? '7' : '6';
        px(g, cx - halfW, yy, halfW * 2, 1, ch);
    }

    // Nuvens: quatro linhas de larguras diferentes empilhadas formam um banco achatado, com o
    // topo aceso pelo sol e a barriga na sombra. Barras retas de 2 px, que era o desenho
    // anterior, liam como riscos horizontais soltos no céu — não como nuvem.
    const rnd = seeded(4242);
    const bands = [[18, 96, '3', '5'], [38, 74, '3', '6'], [62, 124, '4', '7'], [86, 58, '4', '7']];
    for (const [y, len, dark, lit] of bands) {
        for (let i = 0; i < 5; i++) {
            const x = Math.round(rnd() * W);
            const w = Math.round(len * (0.45 + rnd() * 0.5));
            const bulge = Math.round(w * (0.25 + rnd() * 0.2));
            px(g, x + bulge, y - 2, w - bulge * 2, 1, lit);
            px(g, x + Math.round(bulge * 0.5), y - 1, w - bulge, 1, lit);
            px(g, x, y, w, 1, dark);
            px(g, x + 3, y + 1, w - 6, 1, dark);
            px(g, x + Math.round(w * 0.35), y + 2, Math.round(w * 0.3), 1, dark);
        }
    }
    return cv;
}

/** Céu noturno com estrelas — usado no pódio e na tela de título. */
function makeStarfield(width = W, height = 120) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 0, width, height, ['0', '1', '2', '3'], SVC);
    const rnd = seeded(5);
    for (let i = 0; i < 130; i++) {
        const x = Math.floor(rnd() * width);
        const y = Math.floor(rnd() * height * 0.82);
        const r = rnd();
        px(g, x, y, 1, 1, r < 0.2 ? 'E' : r < 0.55 ? 'q' : 'o');
        // as mais brilhantes ganham um cruzamento de 1 px, que é o que faz "estrela"
        if (r < 0.06) {
            px(g, x - 1, y, 1, 1, 'p'); px(g, x + 1, y, 1, 1, 'p');
            px(g, x, y - 1, 1, 1, 'p'); px(g, x, y + 1, 1, 1, 'p');
        }
    }
    return cv;
}

// ---------------------------------------------------------------------------
// Cidade
// ---------------------------------------------------------------------------

/**
 * Skyline de Santos em silhueta, tileável na horizontal.
 * Alguns prédios saem propositalmente inclinados — os "prédios tortos" da Ponta da Praia,
 * que afundaram em solo de areia sem fundação profunda e viraram cartão-postal involuntário.
 */
function makeSkyline(width = 640, height = 78, tint = '2', tintTop = '3', seed = 7) {
    const { cv, g } = canvas(width, height);
    let x = 0;
    const rnd = seeded(seed);

    while (x < width) {
        const bw = 12 + Math.floor(rnd() * 22);
        const bh = 22 + Math.floor(rnd() * (height - 26));
        const lean = rnd() < 0.22 ? (rnd() < 0.5 ? -1 : 1) : 0;   // ~1 em 5 prédios inclina

        for (let row = 0; row < bh; row++) {
            const y = height - 1 - row;
            const shift = lean ? Math.round(lean * row * 0.14) : 0;
            px(g, x + shift, y, bw, 1, row > bh - 6 ? tintTop : tint);
            // aresta iluminada no lado que dá para o sol
            px(g, x + shift + bw - 1, y, 1, 1, tintTop);
        }

        // coroamento: caixa d'água, casa de máquinas ou antena
        const topY = height - bh;
        const crown = rnd();
        if (crown < 0.34) px(g, x + 3, topY - 4, 5, 4, tintTop);
        else if (crown < 0.6) px(g, x + Math.floor(bw / 2), topY - 7, 1, 7, tintTop);

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
    const rnd = seeded(19);
    for (let x = 0; x < width; x++) {
        const d = Math.abs(x - peak) / (width * 0.5);
        // ruído baixo no contorno: um morro perfeitamente parabólico lê como colina de desenho
        const bump = Math.sin(x * 0.13) * 2 + Math.sin(x * 0.041) * 3;
        const top = Math.round(height - (1 - d * d) * (height - 8) - 4 - bump);
        for (let y = top; y < height; y++) {
            const rel = y - top;
            // O corpo do morro continua sendo mata, só que na sombra. Fechar o miolo em roxo
            // escuro, como antes, fazia o Monte Serrat parecer um buraco atrás da cidade.
            const shade = rel < 3 ? 'k' : rel < 10 ? 'j' : rel < 30 ? 'i' : 'i';
            px(g, x, y, 1, 1, shade);
        }
        // sombra na base, onde o morro encontra a cidade
        px(g, x, height - 6, 1, 6, '1');
        // manchas de mata mais clara na encosta virada para o sol
        if (rnd() < 0.16) px(g, x, top + 4 + Math.floor(rnd() * 12), 1, 2, 'j');
    }
    // trilho do funicular subindo pela encosta direita
    for (let t = 0; t < 46; t++) {
        const x = Math.round(peak + 10 + t * 1.5);
        const y = Math.round(height - 6 - t * 1.55);
        px(g, x, y, 2, 1, 'p');
        if (t % 6 === 0) px(g, x - 1, y - 1, 4, 1, 'o');
    }
    // capela no topo
    const capY = Math.round(height * 0.06);
    px(g, peak - 4, capY + 2, 9, 7, 'q');
    px(g, peak - 4, capY + 2, 9, 1, 'r');
    px(g, peak - 1, capY - 3, 2, 6, 'q');
    px(g, peak - 3, capY - 1, 6, 1, 'q');
    return cv;
}

// ---------------------------------------------------------------------------
// Mar e areia
// ---------------------------------------------------------------------------

/**
 * Faixa de mar: gradiente ditherizado + cristas horizontais + a coluna de reflexo do sol.
 * O reflexo é feito de traços que encurtam e escurecem conforme descem — é isso que dá a
 * leitura de "caminho de luz na água" em vez de uma barra amarela colada por cima.
 */
function makeSea(width = W, height = 70) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 0, width, height, ['9', 'a', 'b', 'c'], SVC);

    const rnd = seeded(77);
    // cristas: quanto mais perto do observador, mais longas e espaçadas
    for (let y = 2; y < height; y += 3) {
        const t = y / height;
        const count = Math.round(6 + t * 10);
        for (let i = 0; i < count; i++) {
            const x = Math.floor(rnd() * width);
            const len = Math.round(3 + t * 9 + rnd() * 4);
            px(g, x, y, len, 1, t < 0.4 ? 'b' : 'c');
        }
    }

    // Reflexo do sol, alinhado à mesma coluna do disco no céu. Ele entra por fade nas
    // primeiras linhas: começar em cheio na borda de cima deixava um degrau visível bem no
    // encontro com o horizonte.
    const cx = Math.round(width * SUN_X);
    for (let y = 0; y < height; y++) {
        const t = y / height;
        const fadeIn = Math.min(1, y / 10);
        if (rnd() < 0.25 + t * 0.25 + (1 - fadeIn) * 0.6) continue;   // buracos: a luz pisca
        const spread = 2 + t * 13;
        const len = Math.max(1, Math.round((1 - t * 0.55) * (2 + rnd() * 5)));
        const x = cx + Math.round((rnd() - 0.5) * spread * 2) - len / 2;
        px(g, x, y, len, 1, t < 0.3 ? 'h' : t < 0.6 ? '8' : '7');
    }
    return cv;
}

/** Faixa de areia: bandas + granulado fino + conchinhas, com a barra molhada no topo. */
function makeSand(width = W, height = 60) {
    const { cv, g } = canvas(width, height);
    ditherGradient(g, 0, 6, width, height - 6, ['h', 'g', 'f', 'e'], SVC);

    // faixa molhada onde a água acabou de subir — escura e brilhante
    const rnd = seeded(91);
    px(g, 0, 0, width, 6, 'R');
    for (let x = 0; x < width; x++) {
        const wob = Math.round(Math.sin(x * 0.09) * 1.5 + Math.sin(x * 0.31) * 1);
        px(g, x, 0, 1, 3 + wob, 'Q');
        px(g, x, 5 + wob, 1, 2, 'g');
        if (rnd() < 0.1) px(g, x, 1 + wob, 1, 1, 'd');   // brilho de água na areia
    }

    // granulado: pares de pixels claros/escuros dão textura sem virar chuvisco
    for (let i = 0; i < width * 2.2; i++) {
        const x = Math.floor(rnd() * width);
        const y = 7 + Math.floor(rnd() * (height - 8));
        px(g, x, y, 1, 1, rnd() < 0.5 ? 'e' : 'h');
    }
    // pedrinhas e conchas esparsas
    for (let i = 0; i < 26; i++) {
        const x = Math.floor(rnd() * width);
        const y = 12 + Math.floor(rnd() * (height - 16));
        px(g, x, y, 2, 1, 'h');
        px(g, x, y + 1, 2, 1, 'f');
    }
    return cv;
}

/** Quebra-Mar: espinha de pedras entrando no mar, em perspectiva. */
function makeBreakwater(width = 200, height = 40) {
    const { cv, g } = canvas(width, height);
    const rnd = seeded(33);
    for (let x = 0; x < width; x++) {
        const t = x / width;
        const h = Math.round(4 + (1 - t) * 14);
        const y = Math.round(height - h - t * 6);
        for (let j = 0; j < h; j++) {
            const r = rnd();
            // blocos de pedra: topo claro, corpo médio, base na sombra
            const ch = j === 0 ? 'p' : j < h * 0.4 ? (r < 0.4 ? 'o' : 'n') : (r < 0.4 ? 'n' : 'm');
            px(g, x, y + j, 1, 1, ch);
        }
        // arrebentação batendo no costão
        if (rnd() < 0.12) px(g, x, y + h - 1, 2, 2, 'P');
    }
    return cv;
}

// ---------------------------------------------------------------------------
// Elementos animados (desenhados por frame, não pré-renderizados)
// ---------------------------------------------------------------------------

/**
 * Grade neon em perspectiva (piso do título/pódio). Devolve uma função de desenho em vez de
 * um canvas porque ela anima: as linhas horizontais rolam em direção ao observador.
 */
export function drawNeonGrid(ctx, y0, h, t, colorH = 'x', colorV = 'z') {
    const horizonY = y0;
    ctx.strokeStyle = SVC[colorV];
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -10; i <= 10; i++) {
        ctx.moveTo(W / 2 + i * 3 + 0.5, horizonY + 0.5);
        ctx.lineTo(W / 2 + i * 46 + 0.5, y0 + h + 0.5);
    }
    ctx.stroke();

    for (let i = 0; i < 14; i++) {
        const p = ((i / 14) + (t * 0.25 % 1)) % 1;
        const yy = horizonY + Math.pow(p, 2.2) * h;
        // as linhas próximas engrossam: é o que dá a sensação de vir na direção do jogador
        const thick = p > 0.72 ? 2 : 1;
        ctx.fillStyle = SVC[p > 0.5 ? colorH : colorV];
        ctx.fillRect(0, Math.round(yy), W, thick);
    }
}

/**
 * Faixa de água animada, para as provas que precisam de mar vivo em vez de bloco chapado.
 * Bandas de profundidade + marolas que correm — barato o suficiente para rodar por frame.
 */
export function drawWater(px2, x, y, w, h, t, scroll = 0) {
    const bands = ['b', 'a', '9', 'O'];
    for (let i = 0; i < h; i++) {
        const p = i / h;
        const idx = Math.min(bands.length - 1, Math.floor(p * bands.length));
        px2.rect(x, y + i, w, 1, SVC[bands[idx]]);
    }
    // marolas: linhas curtas que descem devagar e correm para trás
    for (let i = 0; i < 22; i++) {
        const p = ((i * 0.137 + t * 0.05) % 1);
        const yy = y + Math.round(p * p * h);
        const len = 4 + Math.round(p * 12);
        const xx = x + (((i * 71 - scroll * (0.3 + p)) % (w + 40)) + w + 40) % (w + 40) - 20;
        px2.rect(xx, yy, len, 1, SVC[p < 0.45 ? 'b' : 'c']);
    }
}

/** Linha de espuma quebrando na areia — usada pelas provas de praia. */
export function drawShoreFoam(px2, y, t, width = W) {
    for (let x = 0; x < width; x++) {
        const wob = Math.sin(x * 0.11 + t * 1.6) * 2 + Math.sin(x * 0.037 - t) * 1.5;
        px2.rect(x, y + wob, 1, 2, SVC['P']);
        px2.rect(x, y + wob + 2, 1, 1, SVC['d']);
        if ((x + Math.floor(t * 12)) % 13 < 2) px2.rect(x, y + wob - 1, 1, 1, SVC['E']);
    }
}

/**
 * Sombra elíptica achatada no chão. Um sprite sem sombra flutua; com ela, o mesmo sprite
 * ganha peso — é o retoque mais barato de todos e o que mais muda a leitura.
 */
export function drawShadow(px2, cx, cy, rx, alpha = 0.4) {
    const ctx = px2.ctx;
    ctx.globalAlpha = alpha;
    px2.rect(cx - rx, cy, rx * 2, 2, SVC['S']);
    px2.rect(cx - rx * 0.6, cy - 1, rx * 1.2, 1, SVC['S']);
    px2.rect(cx - rx * 0.6, cy + 2, rx * 1.2, 1, SVC['S']);
    ctx.globalAlpha = 1;
}

/**
 * Constrói e memoiza todas as camadas. Chamado uma vez no boot; cada prova escolhe as
 * camadas que usa e o parallax que aplica.
 */
export function buildScenery() {
    return {
        sky: makeSky(),
        skyNight: makeStarfield(W, 140),
        skyline: makeSkyline(640, 78, '2', '3', 7),
        skylineFar: makeSkyline(640, 54, '1', '2', 23),
        morro: makeMorro(320, 96),
        sea: makeSea(W, 70),
        seaFar: makeSea(W, 40),
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
