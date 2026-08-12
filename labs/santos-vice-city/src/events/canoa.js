// events/canoa.js — CANOA HAVAIANA na Baía de Santos (o lugar do Skating no California Games).
//
// A prova é de ritmo, não de martelar botão. A remada alterna Z e X e existe uma cadência
// correndo o tempo todo: remar dentro da janela do compasso rende potência cheia, remar fora
// rende quase nada, e remar com o botão errado quebra a cadência. É a diferença entre uma
// tripulação sincronizada e seis pessoas batendo água — que é exatamente o ponto do esporte.

import { EventBase } from './base.js';
import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp } from '../core/util.js';
import { tile } from '../art/scenery.js';
import { panel, bar } from '../game/hud.js';

const RACE_LEN = 4200;
const LANES = [126, 148, 170, 192];   // y de cada raia, do fundo para a frente
const PLAYER_SCREEN_X = 92;
const BEAT_SEC = 0.52;                // intervalo entre remadas na cadência ideal
const GOOD_WINDOW = 0.16;             // tolerância em segundos para uma remada "no tempo"

export class CanoaEvent extends EventBase {
    setup() {
        this.duration = 0;                 // termina na chegada
        this.dist = 0;
        this.speed = 40;
        this.lane = 2;
        this.laneY = LANES[this.lane];
        this.beatT = 0;
        this.nextSide = 'a';               // qual botão a cadência espera agora
        this.cadence = 0;                  // 0..1 — quão sincronizado você está
        this.strokes = 0;
        this.perfect = 0;
        this.broken = 0;
        this.rowPhase = 0;
        this.finished = false;
        this.wake = [];

        const { rng } = this.app;
        this.rivals = [0, 1, 3].map((laneIdx, i) => ({
            lane: laneIdx,
            dist: 0,
            // ritmo próprio: um sai forte e cai, outro segura o passo — dá disputa de verdade
            base: 88 + rng.next() * 26,
            surge: 0.5 + rng.next(),
            phase: rng.next() * Math.PI * 2,
            name: ['CLUBE XV', 'SALDANHA', 'TUMIARU'][i]
        }));

        this.buoys = [];
        for (let d = 500; d < RACE_LEN - 200; d += 240 + rng.next() * 200) {
            this.buoys.push({ dist: d, lane: rng.int(0, 3) });
        }
        this.place = 1;
    }

    start() {
        this.beatT = BEAT_SEC;
        this.app.audio.play('stroke');
    }

    step(dt) {
        const { input, audio, px } = this.app;
        if (this.finished) {
            this.dist += this.speed * dt;
            this.speed = Math.max(0, this.speed - 30 * dt);
            this.stepWake(dt);
            return;
        }

        // --- cadência: um metrônomo que corre sozinho ---
        this.beatT -= dt;
        if (this.beatT <= -GOOD_WINDOW) {
            // perdeu a batida inteira
            this.beatT += BEAT_SEC;
            this.cadence = Math.max(0, this.cadence - 0.22);
            this.broken++;
        }

        // --- remada ---
        const pressedA = input.state.a.pressed;
        const pressedB = input.state.b.pressed;
        if (pressedA || pressedB) {
            const side = pressedA ? 'a' : 'b';
            const offset = Math.abs(this.beatT);
            if (side !== this.nextSide) {
                // remar do lado errado desequilibra a canoa
                this.cadence = Math.max(0, this.cadence - 0.3);
                this.broken++;
                this.speed *= 0.94;
                audio.play('ui_deny');
                this.float.push('FORA DE LADO', PLAYER_SCREEN_X, this.laneY - 34, 'B', 700);
            } else if (offset <= GOOD_WINDOW) {
                const quality = 1 - offset / GOOD_WINDOW;
                this.cadence = Math.min(1, this.cadence + 0.12 + quality * 0.1);
                this.speed += 26 + quality * 30 + this.cadence * 22;
                this.strokes++;
                if (quality > 0.7) {
                    this.perfect++;
                    this.score += 12;
                    this.float.push('NO TEMPO', PLAYER_SCREEN_X, this.laneY - 34, 'H', 500);
                } else {
                    this.score += 5;
                }
                this.nextSide = side === 'a' ? 'b' : 'a';
                this.beatT = BEAT_SEC;
                this.rowPhase = 0;
                audio.play('stroke');
                this.pushWake();
            } else {
                // remada fora da janela: entra, mas mata o embalo
                this.cadence = Math.max(0, this.cadence - 0.14);
                this.speed += 8;
                this.strokes++;
                this.nextSide = side === 'a' ? 'b' : 'a';
                this.beatT = BEAT_SEC;
                audio.play('stroke');
            }
        }

        this.rowPhase += dt;
        // arrasto: sem remar, a canoa perde tudo rápido
        this.speed -= (26 + this.speed * 0.16) * dt;
        this.speed = clamp(this.speed, 0, 200 + this.cadence * 40);

        // --- leme: trocar de raia é discreto, um toque por raia (não é eixo contínuo) ---
        if (input.state.up.pressed && this.lane > 0) this.lane--;
        if (input.state.down.pressed && this.lane < LANES.length - 1) this.lane++;
        this.laneY += (LANES[this.lane] - this.laneY) * Math.min(1, dt * 7);

        this.dist += this.speed * dt;

        // --- boias ---
        for (const b of this.buoys) {
            if (b.hit) continue;
            const rel = b.dist - this.dist;
            if (rel < 12 && rel > -18 && b.lane === this.lane) {
                b.hit = true;
                this.speed *= 0.55;
                this.cadence = Math.max(0, this.cadence - 0.25);
                audio.play('buoy');
                px.shake(3, 200);
                this.float.push('BOIA!', PLAYER_SCREEN_X, this.laneY - 30, 'B', 900);
            }
        }

        // --- rivais ---
        for (const r of this.rivals) {
            const surge = 1 + Math.sin(this.elapsed * r.surge + r.phase) * 0.16;
            r.dist += r.base * surge * dt;
        }
        this.place = 1 + this.rivals.filter((r) => r.dist > this.dist).length;

        this.stepWake(dt);

        if (this.dist >= RACE_LEN) this.arrive();
    }

    pushWake() {
        this.wake.push({ x: PLAYER_SCREEN_X - 30, y: this.laneY + 6, life: 0.7, side: this.nextSide });
        if (this.wake.length > 20) this.wake.shift();
    }

    stepWake(dt) {
        for (let i = this.wake.length - 1; i >= 0; i--) {
            const wk = this.wake[i];
            wk.x -= (40 + this.speed * 0.4) * dt;
            wk.life -= dt;
            if (wk.life <= 0) this.wake.splice(i, 1);
        }
    }

    arrive() {
        this.finished = true;
        const placeBonus = [320, 200, 110, 50][this.place - 1] ?? 20;
        const timeBonus = Math.max(0, Math.round((70 - this.elapsed) * 6));
        const rhythmBonus = Math.round((this.perfect / Math.max(1, this.strokes)) * 180);
        this.score += placeBonus + timeBonus + rhythmBonus;
        this.detail = `${this.place}º lugar · ${this.elapsed.toFixed(1)}s · ${this.perfect}/${this.strokes} no tempo`;
        this.app.audio.play('record');
        this.finish(this.detail);
    }

    middleLabel() {
        const pct = Math.min(100, Math.round((this.dist / RACE_LEN) * 100));
        return `${this.place}º  ${pct}%`;
    }

    render() {
        const { px, sprites, scenery, font } = this.app;
        const ctx = px.ctx;
        const cam = this.dist;

        ctx.drawImage(scenery.sky, 0, -46);
        ctx.drawImage(scenery.morro, Math.round(-cam * 0.03) % 320, 24);
        tile(ctx, scenery.skylineFar, cam * 0.05, 66);

        // água: bandas horizontais que rolam, cada raia mais escura ao fundo
        px.rect(0, 104, W, H - 104, SVC['a']);
        for (let y = 104; y < H; y += 4) {
            const t = (y - 104) / (H - 104);
            const shade = t < 0.3 ? 'b' : t < 0.7 ? 'a' : '9';
            px.rect(0, y, W, 2, SVC[shade]);
        }
        // marolas correndo para trás
        for (let i = 0; i < 26; i++) {
            const yy = 108 + (i * 37) % (H - 112);
            const xx = ((i * 91) - cam * 0.6) % (W + 40);
            const x = ((xx % (W + 40)) + W + 40) % (W + 40) - 20;
            px.rect(x, yy, 8, 1, SVC['c']);
        }

        // boias
        for (const b of this.buoys) {
            const x = PLAYER_SCREEN_X + (b.dist - cam);
            if (x < -20 || x > W + 20) continue;
            px.blitScreen(sprites.get('buoy'), x, LANES[b.lane] + 4);
        }

        // linha de chegada
        const finishX = PLAYER_SCREEN_X + (RACE_LEN - cam);
        if (finishX > -20 && finishX < W + 20) {
            for (let i = 0; i < 26; i++) {
                px.rect(finishX, 104 + i * 5, 6, 5, SVC[i % 2 ? 'E' : 'B']);
            }
        }

        // --- rivais ---
        for (let i = 0; i < this.rivals.length; i++) {
            const r = this.rivals[i];
            const x = PLAYER_SCREEN_X + (r.dist - cam);
            if (x < -70 || x > W + 70) continue;
            const y = LANES[r.lane];
            px.blitScreen(sprites.get(`rowRival#${i % 4}`), x + 4, y + 2);
            px.blitScreen(sprites.get('canoe'), x, y + 8);
        }

        // --- esteira ---
        for (const wk of this.wake) {
            px.ctx.globalAlpha = clamp(wk.life / 0.7, 0, 1) * 0.7;
            px.rect(wk.x, wk.y, 10, 2, SVC['d']);
            px.ctx.globalAlpha = 1;
        }

        // --- canoa do jogador ---
        const bob = Math.sin(this.elapsed * 5) * 1.2;
        const pose = this.rowPhase < 0.18 ? 'rowPull' : 'rowCatch';
        // remo atrás do atleta, atleta atrás do casco: a sobreposição é o que vende a leitura
        // de "sentado dentro da canoa" sem precisar de sprites dedicados.
        const paddleSide = this.nextSide === 'a' ? -1 : 1;
        px.blitScreen(sprites.get('paddle'), PLAYER_SCREEN_X + 4 + paddleSide * 12, this.laneY + 6 + bob);
        px.blitScreen(sprites.get(pose), PLAYER_SCREEN_X + 4, this.laneY + 2 + bob);
        px.blitScreen(sprites.get('canoe'), PLAYER_SCREEN_X, this.laneY + 8 + bob);
    }

    renderOverlay() {
        const { px, font } = this.app;

        // --- metrônomo: a peça central da prova ---
        const boxW = 132;
        panel(px, (W - boxW) / 2, 18, boxW, 30, { fill: '1', border: 'n' });
        font.text(px.ctx, 'CADÊNCIA', W / 2, 21, { color: 'o', align: 'center', mono: true });

        const trackX = (W - boxW) / 2 + 8;
        const trackW = boxW - 16;
        px.rect(trackX, 32, trackW, 6, SVC['m']);
        // janela boa, centrada — o marcador corre da direita pra esquerda até ela
        const goodW = Math.round(trackW * (GOOD_WINDOW * 2 / BEAT_SEC));
        px.rect(trackX + trackW / 2 - goodW / 2, 32, goodW, 6, SVC['j']);
        px.rect(trackX + trackW / 2 - 1, 30, 2, 10, SVC['A']);

        const p = clamp(this.beatT / BEAT_SEC, -0.4, 1);
        const markX = trackX + trackW / 2 + p * (trackW / 2);
        px.rect(Math.round(markX) - 1, 29, 3, 12, SVC[Math.abs(this.beatT) <= GOOD_WINDOW ? 'H' : 'r']);

        // qual botão vem agora
        font.text(px.ctx, this.nextSide === 'a' ? 'Z' : 'X', trackX - 4, 32, {
            color: 'A', align: 'right', mono: true
        });

        // --- sincronia acumulada e velocidade ---
        panel(px, 4, 18, 74, 30, { fill: '1', border: 'n' });
        font.text(px.ctx, 'SINCRONIA', 8, 21, { color: 'o', mono: true });
        bar(px, 8, 32, 66, 5, this.cadence, { fill: this.cadence > 0.6 ? 'H' : 'c', glow: 'd' });

        panel(px, W - 78, 18, 74, 30, { fill: '1', border: 'n' });
        font.text(px.ctx, 'RITMO', W - 74, 21, { color: 'o', mono: true });
        bar(px, W - 74, 32, 66, 5, this.speed / 240, { fill: 'b', glow: 'c' });

        // --- trilho da regata: onde cada canoa está no percurso ---
        const railX = 20, railW = W - 40, railY = 205;
        px.rect(railX - 2, railY - 3, railW + 4, 12, SVC['0']);
        px.rect(railX, railY, railW, 2, SVC['m']);
        px.rect(railX + railW - 1, railY - 3, 2, 8, SVC['B']);   // linha de chegada
        for (const r of this.rivals) {
            const t = clamp(r.dist / RACE_LEN, 0, 1);
            px.rect(railX + Math.round(railW * t) - 1, railY - 2, 3, 3, SVC['o']);
        }
        const pt = clamp(this.dist / RACE_LEN, 0, 1);
        px.rect(railX + Math.round(railW * pt) - 2, railY - 3, 5, 8, SVC['A']);
    }
}
