// core/font.js — fonte bitmap pixelada, gerada em código (sem assets, sem tabela hex manual).
//
// Em vez de autorar ~100 glifos em hex à mão (alto risco de erro silencioso e sem garantia de
// cobrir corretamente TODOS os acentos do português), cada glifo é rasterizado uma única vez no
// boot usando o motor de texto nativo do Canvas (que já sabe desenhar Á Ã Ç etc corretamente),
// super-amostrado e depois reduzido a um grid pixelado de baixa resolução. O resultado continua
// sendo 100% gerado em código — nenhuma imagem, nenhuma rede — só que a "autoria" do desenho de
// cada glifo fica por conta do próprio navegador, o que elimina o risco de digitar hex errado.
//
// Teto: ~300 linhas.

import { SVC } from './palette.js';

const CELL_W = 6;
const CELL_H = 9;
const SS = 6; // fator de super-amostragem antes do downsample pixelado

/**
 * Resolve uma cor recebida por text()/textBig(): aceita tanto um char de 1 letra
 * da paleta mestra ("A", "q", "x"…) quanto uma cor CSS já pronta ("#ffe600").
 * Sem isso, passar um char de paleta direto pro canvas é silenciosamente
 * ignorado (CSS inválido não lança erro) e o texto sai preto — o fillStyle
 * default de um canvas novo — em vez da cor pretendida.
 */
export function resolveColor(color) {
    if (!color) return '#ffffff';
    if (color.length === 1 && Object.prototype.hasOwnProperty.call(SVC, color)) {
        return SVC[color] || '#ffffff';
    }
    return color;
}

const CHARSET =
    ' !"#$%&\'()*+,-./0123456789:;<=>?@' +
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`' +
    'abcdefghijklmnopqrstuvwxyz{|}~' +
    'ÁÀÂÃÉÊÍÓÔÕÚÜÇÑáàâãéêíóôõúüçñ' +
    '←→↑↓♥★●○◆▲▼';

// Limiar de maioria: uma célula final só vira "tinta" se uma fração mínima dos subpixels
// super-amostrados estiver ativa. Usar "qualquer subpixel ativo" (OR) faz uma fonte em negrito
// preencher quase toda célula numa grade tão pequena — o resultado vira um borrão ilegível.
const FILL_THRESHOLD = 0.4;

function rasterizeGlyph(ch) {
    const ssW = CELL_W * SS, ssH = CELL_H * SS;
    const cv = document.createElement('canvas');
    cv.width = ssW; cv.height = ssH;
    const g = cv.getContext('2d');
    g.clearRect(0, 0, ssW, ssH);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = `700 ${Math.floor(ssH * 0.75)}px Arial, sans-serif`;
    // baseline deixa espaço pra descendentes/acentos abaixo, corpo ocupa o resto
    g.fillText(ch, ssW / 2, ssH * 0.78);

    // downsample por maioria: célula final = fração de subpixels ativos > FILL_THRESHOLD
    const src = g.getImageData(0, 0, ssW, ssH).data;
    const mask = new Uint8Array(CELL_W * CELL_H);
    for (let cy = 0; cy < CELL_H; cy++) {
        for (let cx = 0; cx < CELL_W; cx++) {
            let count = 0;
            for (let sy = 0; sy < SS; sy++) {
                for (let sx = 0; sx < SS; sx++) {
                    const px = cx * SS + sx, py = cy * SS + sy;
                    if (src[(py * ssW + px) * 4 + 3] > 90) count++;
                }
            }
            mask[cy * CELL_W + cx] = (count / (SS * SS)) > FILL_THRESHOLD ? 1 : 0;
        }
    }
    return mask;
}

export class BitmapFont {
    constructor() {
        this.glyphs = new Map(); // char -> Uint8Array mask (CELL_W*CELL_H)
        this.adv = new Map();    // char -> largura usada (para modo proporcional)
        this.atlas = null;       // canvas branco-sobre-transparente, um glifo por célula
        this.index = new Map();  // char -> {x,y}
        this.tintCache = new Map();
        this.cols = 16;
    }

    build() {
        const chars = CHARSET.split('');
        for (const ch of chars) {
            const mask = rasterizeGlyph(ch);
            this.glyphs.set(ch, mask);
            let maxX = 0, used = false;
            for (let y = 0; y < CELL_H; y++) {
                for (let x = 0; x < CELL_W; x++) {
                    if (mask[y * CELL_W + x]) { used = true; maxX = Math.max(maxX, x); }
                }
            }
            this.adv.set(ch, used ? maxX + 2 : Math.floor(CELL_W * 0.55));
        }

        const rows = Math.ceil(chars.length / this.cols);
        this.atlas = document.createElement('canvas');
        this.atlas.width = this.cols * CELL_W;
        this.atlas.height = rows * CELL_H;
        const g = this.atlas.getContext('2d');
        g.imageSmoothingEnabled = false;

        chars.forEach((ch, i) => {
            const cx = (i % this.cols) * CELL_W;
            const cy = Math.floor(i / this.cols) * CELL_H;
            this.index.set(ch, { x: cx, y: cy });
            const mask = this.glyphs.get(ch);
            g.fillStyle = '#fff';
            for (let y = 0; y < CELL_H; y++) {
                for (let x = 0; x < CELL_W; x++) {
                    if (mask[y * CELL_W + x]) g.fillRect(cx + x, cy + y, 1, 1);
                }
            }
        });
        return this;
    }

    _tinted(color) {
        if (this.tintCache.has(color)) return this.tintCache.get(color);
        const cv = document.createElement('canvas');
        cv.width = this.atlas.width; cv.height = this.atlas.height;
        const g = cv.getContext('2d');
        g.imageSmoothingEnabled = false;
        g.fillStyle = color;
        g.fillRect(0, 0, cv.width, cv.height);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(this.atlas, 0, 0);
        this.tintCache.set(color, cv);
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

    wrap(str, maxW, opts = {}) {
        const words = str.split(' ');
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
     * Desenha texto no ctx (2D context de um canvas de pixels — px.stage ou px.screen).
     * opts: { color, shadow, align: 'left'|'center'|'right', mono, scale, wave }
     */
    text(ctx, str, x, y, opts = {}) {
        const color = resolveColor(opts.color);
        const scale = opts.scale || 1;
        const mono = opts.mono !== false;
        const align = opts.align || 'left';
        const w = this.measure(str, { mono }) * scale;
        let drawX = x;
        if (align === 'center') drawX = x - w / 2;
        else if (align === 'right') drawX = x - w;

        if (opts.shadow) {
            this._draw(ctx, str, drawX + scale, y + scale, resolveColor(opts.shadow), mono, scale, opts.wave, y);
        }
        if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
        this._draw(ctx, str, drawX, y, color, mono, scale, opts.wave, y);
        if (opts.alpha != null) ctx.globalAlpha = 1;
        return w;
    }

    _draw(ctx, str, x, y, color, mono, scale, wave, baseY) {
        const atlas = this._tinted(color);
        let cx = x;
        let i = 0;
        for (const ch of str) {
            const pos = this.index.get(ch) || this.index.get(ch.toUpperCase()) || this.index.get('?');
            const yOff = wave ? Math.sin(i * 0.6 + wave.t * (wave.speed || 6)) * (wave.amp || 1) : 0;
            ctx.drawImage(
                atlas, pos.x, pos.y, CELL_W, CELL_H,
                Math.round(cx), Math.round(y + yOff * scale), CELL_W * scale, CELL_H * scale
            );
            cx += (this.charWidth(ch, mono) + (mono ? 0 : 1)) * scale;
            i++;
        }
    }

    /** Título grande com contorno em 8 direções — usado no title screen e resultados. */
    textBig(ctx, str, x, y, opts = {}) {
        const scale = opts.scale || 3;
        const outline = opts.outlineColor || '#000000';
        const align = opts.align || 'center';
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                this.text(ctx, str, x + dx * scale, y + dy * scale,
                    { ...opts, color: outline, scale, align, shadow: null });
            }
        }
        return this.text(ctx, str, x, y, { ...opts, scale, align });
    }
}

export function createFont() {
    return new BitmapFont().build();
}
