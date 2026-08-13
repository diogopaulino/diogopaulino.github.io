// events/frescobol.js — FRESCOBOL no José Menino (equivalente ao Flying Disk do California Games).
//
// Frescobol é o único esporte da orla que não tem placar: ninguém marca ponto, ninguém ganha.
// A prova respeita isso — o que pontua é a troca durar. O jogo acontece num espaço com
// profundidade falsa: a bola tem `z` (0 = seu lado, 1 = o do parceiro) e uma sombra na areia
// que é a única leitura confiável de onde ela vai cair.

import { EventBase } from './base.js';
import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp, lerp } from '../core/util.js';
import { drawShoreFoam, drawShadow } from '../art/scenery.js';
import { gauge, needleGauge } from '../game/hud.js';

const NEAR_Y = 196;      // linha do jogador
const FAR_Y = 126;       // linha do parceiro
const NEAR_SPREAD = 118; // meia-largura da quadra perto
const FAR_SPREAD = 58;   // meia-largura longe
const HIT_WINDOW = 0.22; // faixa de z em que o rebate é possível (Aumentado)
const REACH = 44;        // alcance lateral da raquete (Aumentado)

const screenY = (z, h) => lerp(NEAR_Y, FAR_Y, z) - h * lerp(1, 0.55, z);
const screenX = (x, z) => W / 2 + x * lerp(NEAR_SPREAD, FAR_SPREAD, z);
const groundY = (z) => lerp(NEAR_Y, FAR_Y, z);

export class FrescobolEvent extends EventBase {
    setup() {
        this.duration = 72;
        this.playerX = 0;            // -1..1
        this.partnerX = 0;
        this.rally = 0;
        this.bestRally = 0;
        this.exchanges = 0;
        this.misses = 0;
        this.charge = 0;
        this.swingT = 0;
        this.partnerSwingT = 0;
        this.wind = (this.app.rng.next() - 0.5) * 0.5;
        this.pauseT = 0.8;
        this.ball = { x: 0, z: 1, h: 20, vx: 0, vz: 0, vh: 0, live: false, owner: 'partner' };
        this.trailPts = [];
    }

    start() { this.serve(); }

    serve() {
        const { rng } = this.app;
        this.ball.x = this.partnerX;
        this.ball.z = 0.94;
        this.ball.h = 26;
        this.ball.live = true;
        this.ball.owner = 'player';
        // saída mais rápida e progressão mais agressiva
        const speed = 0.85 + Math.min(this.rally, 14) * 0.045;
        this.ball.vz = -speed;
        this.ball.vx = (rng.next() - 0.5) * 0.5;
        this.ball.vh = 28;
        this.partnerSwingT = 0.25;
        this.trailPts.length = 0;
    }

    step(dt) {
        const { input, audio, px } = this.app;
        this.swingT = Math.max(0, this.swingT - dt);
        this.partnerSwingT = Math.max(0, this.partnerSwingT - dt);

        if (this.pauseT > 0) {
            this.pauseT -= dt;
            if (this.pauseT <= 0) this.serve();
            return;
        }

        // --- posição do jogador ---
        this.playerX = clamp(this.playerX + input.axisX() * 1.9 * dt, -1, 1);

        // --- carga do rebate: segurar A acumula força, soltar/apertar rebate ---
        if (input.state.a.down) this.charge = Math.min(1, this.charge + dt * 2.8);

        if (!this.ball.live) return;
        const b = this.ball;

        // --- física da bola ---
        b.z += b.vz * dt;
        b.x += (b.vx + this.wind * 0.35) * dt;
        b.h += b.vh * dt;
        b.vh -= 55 * dt; // gravidade maior

        // rastro: guarda alguns pontos para desenhar a trajetória
        this.trailPts.push({ x: b.x, z: b.z, h: b.h });
        if (this.trailPts.length > 10) this.trailPts.shift();

        // laterais da quadra: a bola sai e a troca acaba
        if (Math.abs(b.x) > 1.25) { this.miss('SAIU'); return; }

        // --- rebate do jogador ---
        if (b.owner === 'player' && input.buffered('a', 110)) { input.consume('a'); this.tryHit(); }

        // --- chegou ao chão ---
        if (b.h <= 0) {
            if (b.owner === 'player') this.miss('CAIU');
            else this.miss('O PARCEIRO NÃO ALCANÇOU');
            return;
        }

        // --- parceiro devolve ---
        if (b.owner === 'partner' && b.z >= 0.88) {
            this.partnerReturn();
        }

        // --- passou da linha do jogador sem rebater ---
        if (b.owner === 'player' && b.z < -0.08) {
            this.miss('PASSOU');
        }
    }

    tryHit() {
        const { audio, px } = this.app;
        const b = this.ball;
        const charge = this.charge;
        this.charge = 0;
        this.swingT = 0.24;

        const inZ = b.z <= HIT_WINDOW && b.z >= -0.06;
        const dx = Math.abs(screenX(b.x, b.z) - screenX(this.playerX, 0));
        const inX = dx <= REACH;
        const reachable = b.h < 62;

        if (!inZ || !inX || !reachable) {
            audio.play('ui_deny');
            this.float.push('ERROU O TEMPO', W / 2, 150, 'o', 600);
            return;
        }

        // qualidade do timing: acertar no centro da janela vale mais
        const timing = 1 - Math.abs(b.z - HIT_WINDOW * 0.45) / (HIT_WINDOW * 0.9);
        const quality = clamp(timing, 0, 1);
        const pts = Math.round((8 + quality * 16 + charge * 10) * (1 + Math.min(this.rally, 20) * 0.06));

        this.rally++;
        this.exchanges++;
        this.bestRally = Math.max(this.bestRally, this.rally);
        this.score += pts;

        const speed = 0.85 + Math.min(this.rally, 16) * 0.045 + charge * 0.3;
        b.owner = 'partner';
        b.vz = speed;
        b.vx = (this.playerX - b.x) * 1.1 + (this.playerX * -0.25);
        b.vh = 32 + charge * 20;
        b.h = Math.max(b.h, 6);

        audio.play('hit');
        const label = quality > 0.8 ? 'NO CHEIO!' : quality > 0.45 ? 'BOA' : 'RASPOU';
        this.float.push(`${label} +${pts}`, screenX(this.playerX, 0), NEAR_Y - 44, quality > 0.8 ? 'A' : 'r', 750);
        if (this.rally > 0 && this.rally % 10 === 0) {
            this.score += 60;
            this.float.push(`${this.rally} TROCAS!`, W / 2, 84, 'x', 1200);
            audio.play('coin');
            px.shake(1, 100);
        }
    }

    partnerReturn() {
        const { rng, audio } = this.app;
        const b = this.ball;
        b.owner = 'player';
        this.partnerSwingT = 0.24;
        // o parceiro mira cada vez mais longe de onde você está — é assim que a prova aperta
        const aggression = Math.min(0.85, 0.2 + this.rally * 0.035);
        const target = clamp(this.playerX + (rng.next() < 0.5 ? -1 : 1) * aggression, -0.95, 0.95);
        this.partnerX = clamp(b.x, -1, 1);
        const speed = 0.62 + Math.min(this.rally, 16) * 0.03;
        b.vz = -speed;
        b.vx = (target - b.x) * speed * 1.05;
        b.vh = 24;
        b.h = Math.max(b.h, 8);
        audio.play('hit');
    }

    miss(reason) {
        const { audio, px } = this.app;
        this.ball.live = false;
        this.misses++;
        this.rally = 0;
        this.charge = 0;
        this.pauseT = 1.1;
        audio.play('miss');
        px.shake(2, 160);
        this.float.push(reason, W / 2, 150, 'B', 1000);
    }

    finish(detail) {
        if (this.phase === 'outro' || this.phase === 'done') return;
        super.finish(detail || `${this.exchanges} trocas · melhor sequência ${this.bestRally}`);
    }

    middleLabel() {
        const left = Math.max(0, Math.ceil(this.duration - this.elapsed));
        return this.rally > 0 ? `${left}"  ${this.rally}` : `${left}"`;
    }

    render() {
        const { px, sprites, scenery } = this.app;
        const ctx = px.ctx;

        ctx.drawImage(scenery.sky, 0, -34);
        ctx.drawImage(scenery.skyline, -200, 30);
        ctx.drawImage(scenery.sea, 0, 76);
        drawShoreFoam(px, FAR_Y - 18, this.elapsed);
        ctx.drawImage(scenery.sand, 0, FAR_Y - 16);

        // Areia da frente em três degraus de tom, do claro perto do mar ao escuro na base da
        // tela. Um bloco bege único, que era o desenho anterior, ocupava metade da tela sem
        // dar nenhuma informação de distância — agora a própria areia mostra a profundidade.
        px.rect(0, FAR_Y + 42, W, H - FAR_Y - 42, SVC['f']);
        px.rect(0, NEAR_Y - 22, W, H - NEAR_Y + 22, SVC['R']);
        px.rect(0, NEAR_Y + 6, W, H - NEAR_Y - 6, SVC['e']);
        for (let x = 0; x < W; x += 3) {
            px.rect(x, FAR_Y + 44 + ((x * 11) % 7), 2, 1, SVC['g']);
            px.rect(x + 1, NEAR_Y - 20 + ((x * 7) % 9), 2, 1, SVC['f']);
        }

        // marcas da quadra improvisada: duas linhas contínuas convergindo com a perspectiva
        for (let i = 0; i < 40; i++) {
            const z = i / 39;
            const y = groundY(z);
            const half = lerp(NEAR_SPREAD, FAR_SPREAD, z);
            const thick = Math.round(lerp(3, 1, z));
            px.ctx.globalAlpha = 0.5;
            px.rect(W / 2 - half, y, thick, 1, SVC['h']);
            px.rect(W / 2 + half - thick, y, thick, 1, SVC['h']);
            px.ctx.globalAlpha = 1;
        }

        px.blitScreen(sprites.get('umbrella'), 26, FAR_Y + 4);
        px.blitScreen(sprites.get('palm'), 296, FAR_Y + 18);

        // --- parceiro (fundo) ---
        const partnerSX = screenX(this.partnerX, 1);
        drawShadow(px, partnerSX, FAR_Y - 1, 7, 0.3);
        px.blitScreen(sprites.get(this.partnerSwingT > 0 ? 'racketSwing_flip' : 'racketReady_flip'),
            partnerSX, FAR_Y);
        px.blitScreen(sprites.get('racket'), partnerSX + 9, FAR_Y - 14);

        // --- sombra da bola: a leitura principal do jogo ---
        if (this.ball.live) {
            const b = this.ball;
            const gy = groundY(b.z);
            const r = Math.round(lerp(5, 3, b.z));
            drawShadow(px, screenX(b.x, b.z), gy - 1, r, clamp(0.7 - b.h / 120, 0.18, 0.6));
            // retículo no ponto de queda quando a bola vem para o jogador: sem ele o
            // posicionamento vira adivinhação de trajetória em perspectiva falsa
            if (b.owner === 'player' && b.vz < 0) {
                const landX = screenX(b.x + b.vx * Math.max(0, b.h / 46), 0);
                const blink = Math.sin(this.elapsed * 14) > 0 ? 'A' : '8';
                px.rect(landX - 5, NEAR_Y - 1, 11, 1, SVC[blink]);
                px.rect(landX, NEAR_Y - 3, 1, 5, SVC[blink]);
            }
        }

        // --- rastro ---
        this.trailPts.forEach((p, i) => {
            const a = (i / this.trailPts.length) * 0.4;
            ctx.globalAlpha = a;
            px.rect(screenX(p.x, p.z) - 1, screenY(p.z, p.h) - 1, 2, 2, SVC['h']);
            ctx.globalAlpha = 1;
        });

        // --- jogador (frente) ---
        const playerSX = screenX(this.playerX, 0);
        const pose = this.swingT > 0 ? 'racketSwing' : (this.ball.live && this.ball.z < 0.4 ? 'racketReach' : 'racketReady');
        drawShadow(px, playerSX, NEAR_Y - 1, 10, 0.38);
        px.blitScreen(sprites.get(pose), playerSX, NEAR_Y);
        px.blitScreen(sprites.get('racket'), playerSX + (this.swingT > 0 ? 14 : 10), NEAR_Y - 16);

        // zona de alcance quando a bola se aproxima
        if (this.ball.live && this.ball.owner === 'player' && this.ball.z < 0.45) {
            const inRange = Math.abs(screenX(this.ball.x, this.ball.z) - playerSX) <= REACH;
            ctx.globalAlpha = 0.45;
            px.rect(playerSX - REACH, NEAR_Y + 1, REACH * 2, 2, SVC[inRange ? 'H' : 'o']);
            ctx.globalAlpha = 1;
        }

        // --- bola ---
        if (this.ball.live) {
            const b = this.ball;
            px.blitScreen(sprites.get('ballSmall'), screenX(b.x, b.z), screenY(b.z, b.h));
        }
    }

    renderOverlay() {
        const { px, font } = this.app;

        needleGauge(px, font, 4, 16, 92, 'VENTO', clamp(0.5 + this.wind, 0, 1), { color: 'y' });
        gauge(px, font, W - 96, 16, 92, 'FORÇA', this.charge, {
            fill: this.charge > 0.8 ? 'B' : '6', glow: '8'
        });

        if (this.rally > 0) {
            font.text(px.ctx, `TROCA ${this.rally}`, W / 2, 18, {
                color: 'H', align: 'center', mono: true, outline: '0'
            });
        }
    }
}
