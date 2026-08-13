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
import { drawShoreFoam, drawShadow } from '../art/scenery.js';
import { panel, needleGauge } from '../game/hud.js';
import { assistToward } from '../game/kids.js';

const SAND_Y = 176;
const GRAVITY = 220;
const HIT_RANGE_X = 56;

/** Tipos de toque: alcance vertical, impulso e pontuação-base de cada um. */
const TOUCHES = {
    pe: { name: 'PÉ', low: 4, high: 30, vy: -190, pts: 10, pose: 'ballKick', sfx: 'touch' },
    coxa: { name: 'COXA', low: 22, high: 48, vy: -170, pts: 14, pose: 'ballChest', sfx: 'touch' },
    peito: { name: 'PEITO', low: 40, high: 66, vy: -150, pts: 18, pose: 'ballChest', sfx: 'touch' },
    cabeca: { name: 'CABEÇA', low: 58, high: 88, vy: -215, pts: 26, pose: 'ballHead', sfx: 'header' }
};

export class AltinhaEvent extends EventBase {
    setup() {
        this.duration = 40;
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
        this._varietyShown = false;
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
        if (vx !== 0) {
            this.facing = vx;
            this.playerX = clamp(this.playerX + vx * 175 * dt, 20, W - 20);
        } else if (this.ball.live) {
            this.playerX = clamp(assistToward(this.playerX, this.ball.x, 160, dt, 6), 20, W - 20);
            if (this.ball.x < this.playerX - 4) this.facing = -1;
            if (this.ball.x > this.playerX + 4) this.facing = 1;
        }

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
        // Buffer curto: apertar meio quadro antes da bola entrar no alcance continua valendo.
        const height = SAND_Y - b.y;
        const near = Math.abs(b.x - this.playerX) < HIT_RANGE_X + 10 && b.vy > 0 && height < 90;
        this.cueReady = this.ball.live && near;
        this.cueX = this.playerX;
        this.cueY = SAND_Y - 70;

        if (input.buffered('a', 160)) { input.consume('a'); this.tryTouch(); }

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

        const reach = b.vy > 0 ? HIT_RANGE_X + 4 : HIT_RANGE_X;
        if (dx > reach) {
            this.float.push('OPS!', this.playerX, SAND_Y - 60, 'o', 500);
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
        if (!key) key = height > 50 ? 'cabeca' : height > 28 ? 'coxa' : 'pe';

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
        if (this.variety.size === 4 && !this._varietyShown) {
            this._varietyShown = true;
            this.float.push('VARIEDADE x1.5!', W / 2, 54, 'z', 1100);
            audio.play('coin');
        }
        this.pose = t.pose;
        this.poseT = 0.28;

        this.float.push(`BOA! +${pts}`, this.playerX, SAND_Y - 70, repeated ? 'p' : 'z', 750);
        if (this.combo > 0 && this.combo % 5 === 0) {
            this.float.push(`${this.combo} TOQUES!`, W / 2, 70, 'x', 1200);
            if (this.combo % 10 === 0) {
                this.score += 50;
                audio.play('coin');
                px.shake(1, 120);
            }
        }
        this.app.audio.play(t.sfx);
    }

    drop() {
        const { audio, px } = this.app;
        this.ball.live = false;
        this.drops++;
        this.combo = 0;
        this.variety.clear();
        this._varietyShown = false;
        this.serveT = 1.2;
        audio.play('drop');
        px.shake(2, 180);
        this.float.push('OPS!', this.ball.x, SAND_Y - 30, 'B', 1100);
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
        ctx.drawImage(scenery.sea, 0, 100);
        drawShoreFoam(px, SAND_Y - 18, this.elapsed);
        ctx.drawImage(scenery.sand, 0, SAND_Y - 14);
        px.rect(0, SAND_Y + 46, W, H - SAND_Y - 46, SVC['e']);

        // guarda-sóis e coqueiro no fundo
        px.blitScreen(sprites.get('umbrella'), 40, SAND_Y - 8);
        px.blitScreen(sprites.get('umbrella'), 264, SAND_Y - 4);
        px.blitScreen(sprites.get('palm'), 302, SAND_Y + 8);

        // roda de altinha ao fundo, cada um com o seu pé de apoio na areia
        for (const p of this.roda) {
            drawShadow(px, p.x, SAND_Y - 3, 8, 0.3);
            px.blitScreen(sprites.get(`crowd#${p.kit}`), p.x, SAND_Y - 4);
        }

        // sombra da bola na areia — é a leitura que permite se posicionar
        if (this.ball.live) {
            const t = clamp((SAND_Y - this.ball.y) / 150, 0, 1);
            drawShadow(px, this.ball.x, SAND_Y - 2, Math.round(7 - t * 3.5), 0.3 + (1 - t) * 0.35);
        }

        // zona de alcance: só aparece quando a bola está descendo perto, para ensinar o timing
        if (this.ball.live && this.ball.vy > 0 && Math.abs(this.ball.x - this.playerX) < HIT_RANGE_X + 16) {
            const glow = Math.abs(this.ball.x - this.playerX) < HIT_RANGE_X;
            ctx.globalAlpha = 0.55;
            px.rect(this.playerX - HIT_RANGE_X, SAND_Y - 1, HIT_RANGE_X * 2, 2, SVC[glow ? 'y' : 'o']);
            px.rect(this.playerX - HIT_RANGE_X, SAND_Y - 4, 1, 4, SVC[glow ? 'y' : 'o']);
            px.rect(this.playerX + HIT_RANGE_X - 1, SAND_Y - 4, 1, 4, SVC[glow ? 'y' : 'o']);
            ctx.globalAlpha = 1;
        }

        // atleta
        drawShadow(px, this.playerX, SAND_Y - 1, 10, 0.38);
        const spriteName = this.facing < 0 ? `${this.pose}_flip` : this.pose;
        px.blitScreen(sprites.get(spriteName), this.playerX, SAND_Y);

        if (this.ball.live) {
            px.blitScreen(sprites.get('ballBig'), this.ball.x, this.ball.y);
        }
    }

    renderOverlay() {
        const { px, font } = this.app;

        // indicador de vento — a bola deriva, e saber pra onde é meio caminho
        needleGauge(px, font, 4, 16, 92, 'VENTO', clamp(0.5 + this.wind / 68, 0, 1), { color: 'y' });

        // Variedade: quatro selos que acendem conforme você usa cada parte do corpo.
        // Viraram iniciais dentro de caixinhas porque os nomes por extenso não cabiam na
        // largura disponível e saíam colados uns nos outros ("PEiTOCABEÇ").
        const stamps = [['P', 'pe'], ['C', 'coxa'], ['T', 'peito'], ['H', 'cabeca']];
        const boxW = 16, gap = 3;
        const x0 = W - 4 - (stamps.length * boxW + (stamps.length - 1) * gap);
        stamps.forEach(([letter, key], i) => {
            const on = this.variety.has(key);
            const x = x0 + i * (boxW + gap);
            panel(px, x, 16, boxW, 14, {
                fill: on ? 'j' : '1', border: '0', light: on ? 'y' : 'n', dark: '0', shadow: false
            });
            font.text(px.ctx, letter, x + boxW / 2, 19, {
                color: on ? 'P' : 'n', align: 'center', mono: true
            });
        });
        if (this.variety.size >= 4) {
            font.text(px.ctx, 'x1.5', x0 - 26, 19, { color: 'z', mono: true, outline: '0' });
        }
    }
}
