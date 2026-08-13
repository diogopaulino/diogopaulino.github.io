// game/kids.js — suco visual e ajuda para uma criança de 3–4 anos.
// Uma ação só (TOQUE), personagens que se aproximam sozinhos do lance, e uma estrela
// piscando no momento certo. Textos curtos: BOA, UAU, TOQUE, OPS.

import { W } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp } from '../core/util.js';

export function tapped(input) {
    return input.buffered('a', 220) || input.buffered('b', 220) || input.state.start.pressed;
}

export function consumeTap(input) {
    if (input.buffered('a', 220)) input.consume('a');
    if (input.buffered('b', 220)) input.consume('b');
}

/** Anda sozinho até o alvo se o jogador não estiver empurrando o direcional. */
export function assistToward(current, target, speed, dt, dead = 3) {
    const d = target - current;
    if (Math.abs(d) <= dead) return target;
    const step = speed * dt;
    if (Math.abs(d) <= step) return target;
    return current + Math.sign(d) * step;
}

export function hitGrid(px, py, x0, y0, cols, rows, cellW, cellH) {
    const col = Math.floor((px - x0) / cellW);
    const row = Math.floor((py - y0) / cellH);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return -1;
    return row * cols + col;
}

/** Estrela + palavra TOQUE no ponto em que a criança deve apertar. */
export function drawTapCue(px, font, sprites, x, y, t) {
    const pulse = 0.72 + Math.sin(t * 11) * 0.28;
    const bob = Math.round(Math.sin(t * 8) * 3);
    px.ctx.globalAlpha = pulse;
    if (sprites.has('star')) px.blitScreen(sprites.get('star'), x - 14, y + bob - 2);
    if (sprites.has('star')) px.blitScreen(sprites.get('star'), x + 14, y + bob + 2);
    if (sprites.has('hand')) px.blitScreen(sprites.get('hand'), x, y + bob + 10);
    px.ctx.globalAlpha = 1;
    if (Math.floor(t * 4) % 2 === 0) {
        font.text(px.ctx, 'TOQUE!', x, y + bob - 12, {
            color: 'A', align: 'center', mono: true, scale: 2, outline: '0'
        });
    }
}

export function drawSparkles(px, sprites, x, y, t, n = 5) {
    for (let i = 0; i < n; i++) {
        const a = t * 3 + i * 1.26;
        const r = 10 + (i % 3) * 6;
        const sx = x + Math.cos(a) * r;
        const sy = y + Math.sin(a * 1.3) * r * 0.6;
        const key = `spark#${i % 3}`;
        if (sprites.has(key)) {
            px.ctx.globalAlpha = 0.45 + Math.sin(t * 9 + i) * 0.35;
            px.blitScreen(sprites.get(key), sx, sy);
            px.ctx.globalAlpha = 1;
        }
    }
}

export class Confetti {
    constructor() { this.bits = []; }

    burst(x, y, n = 28) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 40 + Math.random() * 120;
            this.bits.push({
                x, y,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp - 80,
                life: 1.1 + Math.random() * 0.7,
                ch: ['x', 'A', 'y', 'G', 'k', '8', 'B'][i % 7],
                w: 2 + (i % 3)
            });
        }
    }

    update(dt) {
        for (let i = this.bits.length - 1; i >= 0; i--) {
            const b = this.bits[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
            b.vy += 220 * dt;
            b.life -= dt;
            if (b.life <= 0 || b.y > 230) this.bits.splice(i, 1);
        }
    }

    draw(px) {
        for (const b of this.bits) {
            px.ctx.globalAlpha = clamp(b.life, 0, 1);
            px.rect(b.x, b.y, b.w, b.w, SVC[b.ch]);
            px.ctx.globalAlpha = 1;
        }
    }
}

/** Vida de fundo nas telas de menu: gaivotas, caranguejo, bola, balões. */
export function drawBeachLife(px, sprites, scenery, t, extra = {}) {
    const c = px.ctx;
    c.drawImage(scenery.sky, 0, extra.skyY || 0);
    if (extra.morro) c.drawImage(scenery.morro, extra.morroX || 0, extra.morroY || 28);
    if (extra.sea !== false) c.drawImage(scenery.sea, 0, extra.seaY || 118);
    if (extra.skyline !== false) {
        c.drawImage(scenery.skyline, Math.round(-(t * extra.skySpeed || t * 10) % 640), extra.skylineY || 88);
    }

    for (let i = 0; i < 4; i++) {
        const gx = ((t * (11 + i * 5) + i * 90) % (W + 50)) - 24;
        px.blitScreen(sprites.anim('gull', t + i, 5), gx, 14 + i * 11);
    }

    if (sprites.has('cloud')) {
        px.blitScreen(sprites.get('cloud'), (t * 8) % (W + 60) - 30, 22);
        px.blitScreen(sprites.get('cloud'), (t * 5 + 160) % (W + 80) - 40, 36);
    }

    const palmSway = Math.round(Math.sin(t * 1.4) * 2);
    px.blitScreen(sprites.get('palm'), 24 + palmSway, 172);
    px.blitScreen(sprites.get('palm'), W - 22 - palmSway, 176);
    px.blitScreen(sprites.get('umbrella'), 78, 180);

    if (extra.balloons !== false && sprites.has('balloon')) {
        px.blitScreen(sprites.get('balloon'), 16 + Math.sin(t * 1.2) * 4, 22 + Math.sin(t * 1.6) * 6);
        px.blitScreen(sprites.get('balloon'), W - 18 + Math.sin(t * 1.1 + 1) * 4, 30 + Math.sin(t * 1.4) * 7);
    }
    if (extra.walkers !== false) {
        if (sprites.has('crab#0')) {
            const cx = ((t * 22) % (W + 30)) - 10;
            px.blitScreen(sprites.anim('crab', t, 6), cx, 198);
        }
        if (sprites.has('dog')) {
            const dx = ((t * 38) % (W + 40)) - 16;
            px.blitScreen(sprites.get('dog'), dx, 200);
        }
    }
}
