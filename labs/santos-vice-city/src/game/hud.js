// game/hud.js — HUD compartilhado: timer, score, combo, hearts, popups, partículas.
// Teto: ~190 linhas.

import { W, H } from '../core/pixel.js';
import { resolveColor } from '../core/font.js';

export class HUD {
    constructor(font, sprites) {
        this.font = font;
        this.sprites = sprites;
        this.time = 0;
        this.score = 0;
        this.combo = 0;
        this.lives = 3;
        this.popups = [];
        this.particles = [];
    }

    update(dtMs) {
        this.time += dtMs / 1000;
        this.popups = this.popups.filter(p => {
            p.t += dtMs / 1000;
            return p.t < p.dur;
        });
        this.particles = this.particles.filter(p => {
            p.t += dtMs / 1000;
            return p.t < p.life;
        });
    }

    draw(px) {
        const ctx = px.ctx;

        // Barra de tempo no topo
        const barW = W * 0.6;
        const barX = (W - barW) / 2;
        const barY = 8;
        ctx.fillStyle = 'rgba(100,100,100,0.4)';
        ctx.fillRect(barX, barY, barW, 12);
        ctx.fillStyle = '#6ad3ff';
        ctx.fillRect(barX, barY, barW * this.time, 12);

        // Score no canto
        this.font.text(ctx, 'PTS', 4, 8, { color: 'A', mono: true, scale: 1 });
        this.font.text(ctx, String(Math.floor(this.score)).padStart(6, '0'), 4, 20, { color: 'q', mono: true, scale: 1 });

        // Combo no centro superior
        if (this.combo > 0) {
            this.font.text(ctx, 'COMBO x' + this.combo, W / 2, 8, { color: 'A', mono: true, align: 'center', scale: 1 });
        }

        // Corações
        const hx = W - 22;
        for (let i = 0; i < 3; i++) {
            const sp = this.lives > i ? 'heart' : 'heart_empty';
            if (this.sprites.has(sp)) {
                px.blitScreen(this.sprites.get(sp), hx - i * 8, 8);
            }
        }

        // Popups (damage numbers, combos, etc)
        for (const p of this.popups) {
            const alpha = Math.max(0, 1 - p.t / p.dur);
            const y = p.y - (p.t * 20);
            this.font.text(ctx, p.text, p.x, y, { color: p.color, shadow: '0', alpha, scale: 1 });
        }

        // Partículas
        for (const p of this.particles) {
            ctx.fillStyle = resolveColor(p.color);
            ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
            ctx.fillRect(p.x, p.y, p.size, p.size);
            ctx.globalAlpha = 1;
        }
    }

    popup(x, y, text, color = 'A', dur = 0.6) {
        this.popups.push({ x, y, text, color, dur, t: 0 });
    }

    burst(x, y, color = 'A', count = 8) {
        for (let i = 0; i < count; i++) {
            const ang = (i / count) * Math.PI * 2;
            const speed = 40 + Math.random() * 40;
            this.particles.push({
                x, y,
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed,
                color,
                size: 1 + Math.random() * 2,
                life: 0.4 + Math.random() * 0.2,
                t: 0
            });
        }
    }
}
