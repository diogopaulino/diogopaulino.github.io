// game/hud.js — widgets de interface compartilhados pelas seis provas.
//
// Nenhuma prova desenha caixa, barra ou placar por conta própria: tudo passa por aqui, para
// que o campeonato inteiro tenha a mesma linguagem visual — molduras de dois pixels, sombra
// projetada de um pixel e a mesma família de cores da paleta mestra.

import { W } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp } from '../core/util.js';

const col = (ch) => SVC[ch] || ch;

/** Caixa com moldura dupla e sombra — o container padrão de tudo que é UI. */
export function panel(px, x, y, w, h, opts = {}) {
    const fill = opts.fill || '1';
    const border = opts.border || 'q';
    const accent = opts.accent || null;
    px.rect(x + 2, y + 2, w, h, col('0'));          // sombra
    px.rect(x, y, w, h, col(fill));
    px.rect(x, y, w, 1, col(border));
    px.rect(x, y + h - 1, w, 1, col(border));
    px.rect(x, y, 1, h, col(border));
    px.rect(x + w - 1, y, 1, h, col(border));
    if (accent) px.rect(x + 1, y + 1, w - 2, 1, col(accent));
}

/** Barra de progresso/energia com marcador de "alvo" opcional. */
export function bar(px, x, y, w, h, value, opts = {}) {
    const t = clamp(value, 0, 1);
    px.rect(x - 1, y - 1, w + 2, h + 2, col(opts.border || '0'));
    px.rect(x, y, w, h, col(opts.bg || 'm'));
    const fillW = Math.round(w * t);
    if (fillW > 0) px.rect(x, y, fillW, h, col(opts.fill || 'c'));
    if (opts.glow && fillW > 1) px.rect(x, y, fillW, 1, col(opts.glow));
    if (opts.mark != null) {
        const mx = x + Math.round(w * clamp(opts.mark, 0, 1));
        px.rect(mx, y - 2, 1, h + 4, col(opts.markColor || 'A'));
    }
}

/**
 * Faixa superior padrão das provas: nome do evento à esquerda, pontuação à direita e um
 * campo livre no meio (tempo, combo, volta…).
 */
export function topBar(px, font, { title, score, middle, tint = 'c' }) {
    px.rect(0, 0, W, 14, col('0'));
    px.rect(0, 13, W, 1, col(tint));
    font.text(px.ctx, title, 4, 3, { color: tint, mono: true });
    if (middle) font.text(px.ctx, middle, W / 2, 3, { color: 'r', align: 'center', mono: true });
    if (score != null) {
        font.text(px.ctx, String(score).padStart(5, '0'), W - 4, 3, { color: 'A', align: 'right', mono: true });
    }
}

/** Texto que sobe e some — pontuação de manobra, "TUBO!", "ERROU". */
export class FloatingText {
    constructor() { this.items = []; }

    push(text, x, y, color = 'A', life = 900) {
        this.items.push({ text, x, y, color, life, maxLife: life });
        if (this.items.length > 24) this.items.shift();
    }

    update(dtMs) {
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            it.life -= dtMs;
            it.y -= dtMs * 0.02;
            if (it.life <= 0) this.items.splice(i, 1);
        }
    }

    draw(px, font) {
        for (const it of this.items) {
            const t = it.life / it.maxLife;
            font.text(px.ctx, it.text, it.x, it.y, {
                color: it.color, align: 'center', mono: true, shadow: '0',
                alpha: t > 0.3 ? 1 : t / 0.3
            });
        }
    }

    clear() { this.items.length = 0; }
}

/**
 * Painel de notas dos jurados (surfe e skate), como no California Games.
 * Cinco jurados, cada um com uma nota de 0 a 10 que aparece com atraso — a espera é parte
 * do teatro do original.
 */
export function judgePanel(px, font, judges, revealT) {
    const boxW = 46, gap = 4;
    const totalW = judges.length * boxW + (judges.length - 1) * gap;
    const x0 = (W - totalW) / 2;
    const y = 148;
    judges.forEach((score, i) => {
        const x = x0 + i * (boxW + gap);
        const shown = revealT > i * 0.35;
        panel(px, x, y, boxW, 30, { fill: shown ? '2' : '1', border: shown ? 'A' : 'n' });
        font.text(px.ctx, `J${i + 1}`, x + boxW / 2, y + 4, { color: 'o', align: 'center', mono: true });
        font.text(px.ctx, shown ? score.toFixed(1) : '--', x + boxW / 2, y + 15, {
            color: shown ? (score >= 8 ? 'A' : score >= 6 ? 'r' : 'o') : 'n',
            align: 'center', mono: true, scale: 1
        });
    });
}

/** Ícone de medalha + rótulo, usado no resultado, no pódio e na tela de recordes. */
export function medalBadge(px, font, sprites, medal, x, y, label) {
    if (medal) {
        px.blitScreen(sprites.get(`medal_${medal}`), x, y + 20);
    }
    if (label) font.text(px.ctx, label, x, y + 24, { color: 'r', align: 'center', mono: true });
}

/** Contagem regressiva 3-2-1-JÁ! no início das provas. */
export function countdown(px, font, secondsLeft) {
    const n = Math.ceil(secondsLeft);
    const label = n > 0 ? String(n) : 'JÁ!';
    const frac = secondsLeft - Math.floor(secondsLeft);
    const scale = 4 + (1 - frac) * 2;
    font.textBig(px.ctx, label, W / 2, 88, {
        color: n > 0 ? 'A' : 'H', outlineColor: '0', align: 'center', scale: Math.round(scale)
    });
}

/** Rodapé com a dica de controles — mostrado nos primeiros segundos de cada prova. */
export function controlHint(px, font, text, alpha = 1) {
    if (alpha <= 0) return;
    px.ctx.globalAlpha = alpha;
    px.rect(0, 208, W, 16, col('0'));
    font.text(px.ctx, text, W / 2, 213, { color: 'p', align: 'center', mono: true });
    px.ctx.globalAlpha = 1;
}
