// events/altinha.js — ALTINHA na areia do Gonzaga (equivalente ao Foot Bag do California Games).
//
// Mecânica de uma regra só: a bola não pode encostar na areia. O que dá profundidade é a
// variedade — repetir o mesmo toque rende cada vez menos, e alternar as partes do corpo faz o
// multiplicador subir. É exatamente a lógica de uma roda de altinha de verdade, onde repetir
// peito-peito-peito é considerado sem graça.

import { EventBase } from './base.js';
import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp } from '../core/util.js';
import { panel, bar } from '../game/hud.js';

const SAND_Y = 176;
const GRAVITY = 300;
const HIT_RANGE_X = 22;

/** Tipos de toque: alcance vertical, impulso e pontuação-base de cada um. */
const TOUCHES = {
    pe: { name: 'PÉ', low: 4, high: 30, vy: -190, pts: 10, pose: 'ballKick', sfx: 'touch' },
    coxa: { name: 'COXA', low: 22, high: 48, vy: -170, pts: 14, pose: 'ballChest', sfx: 'touch' },
    peito: { name: 'PEITO', low: 40, high: 66, vy: -150, pts: 18, pose: 'ballChest', sfx: 'touch' },
    cabeca: { name: 'CABEÇA', low: 58, high: 88, vy: -215, pts: 26, pose: 'ballHead', sfx: 'header' }
};

export class AltinhaEvent extends EventBase {
    setup() {
        this.duration = 70;
        this.playerX = W / 2;
        this.facing = 1;
        this.pose = 'ballIdle';
        this.poseT = 0;
        this.combo = 0;
        this.bestCombo = 0;
        this.touches = 0;
        this.drops = 0;
        this.lastTouch = null;
        this.variety = new Set();
        this.wind = (this.app.rng.next() - 0.5) * 34;
        this.serveT = 1.0;
        this.ball = { x: W / 2, y: 60, vx: 0, vy: 0, spin: 0, live: false };
        this.shadowPulse = 0;
        // figurantes da roda, parados na areia atrás
        this.roda = [
            { x: 52, kit: 0 }, { x: 108, kit: 1 }, { x: 214, kit: 2 }, { x: 272, kit: 3 }
        ];
    }

    start() {
        this.serve();
    }

    serve() {
        const { rng } = this.app;
        this.ball.x = this.playerX + (rng.next() - 0.5) * 40;
        this.ball.y = 30;
        this.ball.vx = (rng.next() - 0.5) * 40;
        this.ball.vy = 0;
        this.ball.live = true;
        this.lastTouch = null;
    }

    step(dt) {
        const { input, audio, px } = this.app;
        this.poseT = Math.max(0, this.poseT - dt);
        if (this.poseT === 0) this.pose = 'ballIdle';

        // --- atleta ---
        const vx = input.axisX();
        if (vx !== 0) this.facing = vx;
        this.playerX = clamp(this.playerX + vx * 104 * dt, 20, W - 20);

        if (this.serveT > 0) {
            this.serveT -= dt;
            if (this.serveT <= 0) this.serve();
            return;
        }
        if (!this.ball.live) return;

        // --- bola ---
        const b = this.ball;
        b.vy += GRAVITY * dt;
        b.vx += this.wind * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.spin += b.vx * dt * 0.1;

        // paredes invisíveis nas laterais: a bola quica de volta pra dentro da roda
        if (b.x < 12) { b.x = 12; b.vx = Math.abs(b.vx) * 0.85; }
        if (b.x > W - 12) { b.x = W - 12; b.vx = -Math.abs(b.vx) * 0.85; }

        // --- toque ---
        if (input.state.a.pressed) this.tryTouch();

        // --- caiu na areia ---
        if (b.y >= SAND_Y - 4) {
            this.drop();
        }
    }

    /** Escolhe o toque pela altura da bola e pelo direcional segurado. */
    tryTouch() {
        const { input, audio, px } = this.app;
        const b = this.ball;
        const dx = Math.abs(b.x - this.playerX);
        const height = SAND_Y - b.y;

        if (dx > HIT_RANGE_X) {
            this.float.push('LONGE', this.playerX, SAND_Y - 60, 'o', 500);
            audio.play('ui_deny');
            return;
        }

        // direcional filtra a intenção; sem direcional, escolhe pelo que a altura permite
        const wantsHead = input.state.up.down;
        const wantsLow = input.state.down.down;
        let key = null;
        for (const [k, t] of Object.entries(TOUCHES)) {
            if (height >= t.low && height <= t.high) {
                if (wantsHead && k !== 'cabeca') continue;
                if (wantsLow && k !== 'pe') continue;
                key = k;
                break;
            }
        }
        if (!key) {
            this.float.push('NÃO ALCANÇOU', this.playerX, SAND_Y - 60, 'o', 550);
            audio.play('ui_deny');
            return;
        }

        const t = TOUCHES[key];
        // repetir o mesmo toque vale metade: a roda quer variedade
        const repeated = this.lastTouch === key;
        const varietyBonus = this.variety.size >= 4 ? 1.5 : 1;
        const pts = Math.round(t.pts * (repeated ? 0.5 : 1) * varietyBonus * (1 + this.combo * 0.08));

        b.vy = t.vy - Math.min(this.combo, 10) * 3;
        b.vx += (this.ball.x - this.playerX) * 2.4 + this.facing * 12;
        b.vx = clamp(b.vx, -130, 130);

        this.combo++;
        this.touches++;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        this.score += pts;
        this.variety.add(key);
        this.lastTouch = key;
        this.pose = t.pose;
        this.poseT = 0.28;

        this.float.push(`${t.name} +${pts}`, this.playerX, SAND_Y - 70, repeated ? 'p' : 'A', 750);
        if (this.combo > 0 && this.combo % 10 === 0) {
            this.float.push(`${this.combo} TOQUES!`, W / 2, 70, 'x', 1200);
            this.score += 50;
            audio.play('coin');
            px.shake(1, 120);
        }
        this.app.audio.play(t.sfx);
    }

    drop() {
        const { audio, px } = this.app;
        this.ball.live = false;
        this.drops++;
        this.combo = 0;
        this.variety.clear();
        this.serveT = 1.2;
        audio.play('drop');
        px.shake(2, 180);
        this.float.push('CAIU NA AREIA', this.ball.x, SAND_Y - 30, 'B', 1100);
    }

    finish(detail) {
        if (this.phase === 'outro' || this.phase === 'done') return;
        super.finish(detail || `${this.touches} toques · sequência de ${this.bestCombo} · ${this.drops} quedas`);
    }

    middleLabel() {
        const left = Math.max(0, Math.ceil(this.duration - this.elapsed));
        return this.combo > 0 ? `${left}"  ${this.combo}` : `${left}"`;
    }

    render() {
        const { px, sprites, scenery, font } = this.app;
        const ctx = px.ctx;

        ctx.drawImage(scenery.sky, 0, -20);
        ctx.drawImage(scenery.skyline, -120, 46);
        ctx.drawImage(scenery.sea, 0, 108);
        ctx.drawImage(scenery.sand, 0, SAND_Y - 12);
        px.rect(0, SAND_Y + 48, W, H - SAND_Y - 48, SVC['f']);

        // guarda-sóis e coqueiro no fundo
        px.blitScreen(sprites.get('umbrella'), 42, SAND_Y - 6);
        px.blitScreen(sprites.get('umbrella'), 268, SAND_Y - 2);
        px.blitScreen(sprites.get('palm'), 300, SAND_Y + 6);

        // roda de altinha ao fundo
        for (const p of this.roda) {
            px.blitScreen(sprites.get(`crowd#${p.kit}`), p.x, SAND_Y - 4);
        }

        // sombra da bola na areia — é a leitura que permite se posicionar
        if (this.ball.live) {
            const t = clamp((SAND_Y - this.ball.y) / 150, 0, 1);
            const r = Math.round(6 - t * 3);
            ctx.globalAlpha = 0.35 + (1 - t) * 0.35;
            px.rect(this.ball.x - r, SAND_Y - 2, r * 2, 3, SVC['e']);
            ctx.globalAlpha = 1;
        }

        // atleta
        const spriteName = this.facing < 0 ? `${this.pose}_flip` : this.pose;
        px.blitScreen(sprites.get(spriteName), this.playerX, SAND_Y);

        // zona de alcance: só aparece quando a bola está descendo perto, para ensinar o timing
        if (this.ball.live && this.ball.vy > 0 && Math.abs(this.ball.x - this.playerX) < HIT_RANGE_X + 14) {
            const glow = Math.abs(this.ball.x - this.playerX) < HIT_RANGE_X;
            ctx.globalAlpha = 0.5;
            px.rect(this.playerX - HIT_RANGE_X, SAND_Y - 1, HIT_RANGE_X * 2, 2, SVC[glow ? 'H' : 'o']);
            ctx.globalAlpha = 1;
        }

        if (this.ball.live) {
            px.blitScreen(sprites.get('ballBig'), this.ball.x, this.ball.y);
        }
    }

    renderOverlay() {
        const { px, font } = this.app;

        // indicador de vento — a bola deriva, e saber pra onde é meio caminho
        panel(px, 4, 18, 82, 22, { fill: '1', border: 'n' });
        font.text(px.ctx, 'VENTO', 8, 21, { color: 'o', mono: true });
        const wt = clamp(0.5 + this.wind / 68, 0, 1);
        bar(px, 8, 31, 74, 4, 1, { fill: 'm', bg: 'm' });
        px.rect(8 + Math.round(74 * wt) - 1, 29, 3, 8, SVC['y']);
        font.text(px.ctx, this.wind < -3 ? '<<' : this.wind > 3 ? '>>' : '--', 78, 21, { color: 'y', mono: true });

        // variedade: quatro selos que acendem conforme você usa cada parte do corpo
        const names = ['PÉ', 'COXA', 'PEITO', 'CABEÇA'];
        const keys = ['pe', 'coxa', 'peito', 'cabeca'];
        panel(px, W - 120, 18, 116, 22, { fill: '1', border: 'n' });
        keys.forEach((k, i) => {
            const on = this.variety.has(k);
            font.text(px.ctx, names[i], W - 116 + i * 29, 25, {
                color: on ? 'H' : 'n', mono: true
            });
        });
    }
}
