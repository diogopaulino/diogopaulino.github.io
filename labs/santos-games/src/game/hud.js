// game/hud.js — widgets de interface compartilhados pelas seis provas.
//
// Nenhuma prova desenha caixa, barra ou placar por conta própria: tudo passa por aqui, para
// que o campeonato inteiro tenha a mesma linguagem visual.
//
// A gramática é a das janelas de cartucho 16-bit: contorno preto de 1 px, chanfro claro no
// canto superior esquerdo, chanfro escuro no inferior direito e sombra projetada. É esse
// relevo — e não a moldura dupla que existia antes — que faz a caixa "sair" do fundo mesmo
// numa tela de 320×224.

import { W } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp } from '../core/util.js';

const col = (ch) => SVC[ch] || ch;

/**
 * Caixa com chanfro e sombra — o container padrão de tudo que é UI.
 * opts: { fill, border, accent, light, dark, shadow }
 */
export function panel(px, x, y, w, h, opts = {}) {
    const fill = opts.fill || '1';
    const border = opts.border || '0';
    const light = opts.light || 'o';
    const dark = opts.dark || '0';
    const accent = opts.accent || null;

    if (opts.shadow !== false) {
        px.ctx.globalAlpha = 0.5;
        px.rect(x + 2, y + 2, w, h, col('0'));
        px.ctx.globalAlpha = 1;
    }
    px.rect(x, y, w, h, col(border));            // contorno
    px.rect(x + 1, y + 1, w - 2, h - 2, col(fill));
    px.rect(x + 1, y + 1, w - 2, 1, col(light)); // chanfro claro
    px.rect(x + 1, y + 1, 1, h - 2, col(light));
    px.rect(x + 1, y + h - 2, w - 2, 1, col(dark));
    px.rect(x + w - 2, y + 1, 1, h - 2, col(dark));
    if (accent) px.rect(x + 1, y + 2, w - 2, 1, col(accent));
}

/** Faixa lisa, sem relevo — para rodapés e tarjas de leitura. */
export function plate(px, x, y, w, h, fill = '0', edge = null) {
    px.rect(x, y, w, h, col(fill));
    if (edge) px.rect(x, y + h - 1, w, 1, col(edge));
}

/** Barra de progresso/energia com marcador de "alvo" opcional. */
export function bar(px, x, y, w, h, value, opts = {}) {
    const t = clamp(value, 0, 1);
    px.rect(x - 1, y - 1, w + 2, h + 2, col(opts.border || '0'));
    px.rect(x, y, w, h, col(opts.bg || 'm'));
    const fillW = Math.round(w * t);
    if (fillW > 0) {
        px.rect(x, y, fillW, h, col(opts.fill || 'c'));
        // brilho na primeira linha e sombra na última: a barra deixa de ser um retângulo chapado
        if (h > 2) {
            px.rect(x, y, fillW, 1, col(opts.glow || opts.fill || 'd'));
            px.rect(x, y + h - 1, fillW, 1, col(opts.shade || '0'));
        }
    }
    if (opts.mark != null) {
        const mx = x + Math.round(w * clamp(opts.mark, 0, 1));
        px.rect(mx, y - 2, 1, h + 4, col(opts.markColor || 'A'));
    }
}

/**
 * Medidor compacto rotulado: a peça que as provas usam no lugar de painel + texto + barra.
 * Ocupa 12 px de altura no total, contra os 24 do arranjo antigo, o que devolve um terço da
 * tela para o jogo — que é onde o jogador está olhando.
 */
export function gauge(px, font, x, y, w, label, value, opts = {}) {
    const align = opts.align || 'left';
    panel(px, x, y, w, 12, { fill: '1', border: '0', light: 'n', dark: '0' });
    const labelW = font.measure(label, { mono: true });
    const barX = align === 'right' ? x + 4 : x + labelW + 7;
    const barW = w - labelW - 11;
    font.text(px.ctx, label, align === 'right' ? x + w - 4 : x + 4, y + 2, {
        color: opts.labelColor || 'p', mono: true, align: align === 'right' ? 'right' : 'left'
    });
    bar(px, barX, y + 4, Math.max(4, barW), 5, value, opts);
}

/** Medidor com marcador central que anda para os dois lados (vento, leme). */
export function needleGauge(px, font, x, y, w, label, t, opts = {}) {
    panel(px, x, y, w, 12, { fill: '1', border: '0', light: 'n', dark: '0' });
    const labelW = font.measure(label, { mono: true });
    font.text(px.ctx, label, x + 4, y + 2, { color: opts.labelColor || 'p', mono: true });
    const trackX = x + labelW + 7;
    const trackW = w - labelW - 11;
    px.rect(trackX, y + 5, trackW, 3, col('m'));
    px.rect(trackX + Math.round(trackW / 2), y + 4, 1, 5, col('n'));
    const nx = trackX + Math.round(trackW * clamp(t, 0, 1));
    px.rect(nx - 1, y + 3, 3, 7, col(opts.color || 'y'));
}

/**
 * Faixa superior padrão das provas: placa com o nome do evento à esquerda, campo livre no
 * meio (tempo, combo, volta…) e pontuação à direita com os zeros à esquerda apagados, do
 * jeito que os placares de arcade sempre fizeram.
 */
export function topBar(px, font, { title, score, middle, tint = 'c' }) {
    plate(px, 0, 0, W, 13, '0');
    px.rect(0, 12, W, 1, col(tint));
    px.rect(0, 13, W, 1, col('0'));

    const tw = font.measure(title, { mono: true }) + 8;
    px.rect(0, 0, tw, 12, col(tint));
    px.rect(0, 0, tw, 1, col('r'));
    px.rect(tw - 1, 0, 1, 12, col('0'));
    font.text(px.ctx, title, 4, 2, { color: '0', mono: true });

    if (middle) font.text(px.ctx, middle, W / 2, 2, { color: 'r', align: 'center', mono: true, shadow: '0' });

    if (score != null) {
        const s = String(Math.max(0, Math.round(score))).padStart(6, '0');
        const cut = s.length - String(Math.max(0, Math.round(score))).length;
        font.text(px.ctx, s.slice(0, cut), W - 4 - font.measure(s.slice(cut), { mono: true }), 2,
            { color: 'm', mono: true });
        font.text(px.ctx, s.slice(cut), W - 4, 2, { color: 'A', align: 'right', mono: true });
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
                color: it.color, align: 'center', mono: true, outline: '0',
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
    const boxW = 44, gap = 5;
    const totalW = judges.length * boxW + (judges.length - 1) * gap;
    const x0 = Math.round((W - totalW) / 2);
    const y = 150;
    judges.forEach((score, i) => {
        const x = x0 + i * (boxW + gap);
        const shown = revealT > i * 0.35;
        panel(px, x, y, boxW, 30, {
            fill: shown ? '2' : '1', border: '0', light: shown ? 'A' : 'n', dark: '0'
        });
        font.text(px.ctx, `J${i + 1}`, x + boxW / 2, y + 4, { color: 'o', align: 'center', mono: true });
        font.text(px.ctx, shown ? score.toFixed(1) : '--', x + boxW / 2, y + 15, {
            color: shown ? (score >= 8 ? 'A' : score >= 6 ? 'r' : 'o') : 'n',
            align: 'center', mono: true
        });
    });
}

/** Ícone de medalha + rótulo, usado no resultado, no pódio e na tela de recordes. */
export function medalBadge(px, font, sprites, medal, x, y, label) {
    if (medal) px.blitScreen(sprites.get(`medal_${medal}`), x, y + 20);
    if (label) font.text(px.ctx, label, x, y + 24, { color: 'r', align: 'center', mono: true });
}

/** Contagem regressiva 3-2-1-JÁ! no início das provas. */
export function countdown(px, font, secondsLeft) {
    const n = Math.ceil(secondsLeft);
    const label = n > 0 ? String(n) : 'JÁ!';
    const frac = secondsLeft - Math.floor(secondsLeft);
    const scale = n > 0 ? Math.round(4 + (1 - frac) * 2) : 5;

    // anel de leitura atrás do número, para ele não sumir num fundo carregado
    px.ctx.globalAlpha = 0.45;
    px.rect(0, 66, W, 46, SVC['0']);
    px.ctx.globalAlpha = 1;
    px.rect(0, 66, W, 1, SVC[n > 0 ? 'z' : 'H']);
    px.rect(0, 111, W, 1, SVC[n > 0 ? 'z' : 'H']);

    font.textBig(px.ctx, label, W / 2, 74, {
        outlineColor: '0', align: 'center', scale,
        ramp: n > 0 ? ['h', '8', '7', '6'] : ['P', 'H', 'k', 'j']
    });
}

/** Rodapé com a dica de controles — mostrado nos primeiros segundos de cada prova. */
export function controlHint(px, font, text, alpha = 1) {
    if (alpha <= 0) return;
    px.ctx.globalAlpha = alpha;
    plate(px, 0, 209, W, 15, '0');
    px.rect(0, 209, W, 1, SVC['m']);
    font.text(px.ctx, text, W / 2, 213, { color: 'p', align: 'center', mono: true });
    px.ctx.globalAlpha = 1;
}
