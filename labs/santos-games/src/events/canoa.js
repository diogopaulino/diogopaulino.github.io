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
import { tile, drawWater } from '../art/scenery.js';
import { panel, gauge } from '../game/hud.js';

const RACE_LEN = 2800;
const LANES = [126, 148, 170, 192];
const PLAYER_SCREEN_X = 92;
const BEAT_SEC = 0.58;
const GOOD_WINDOW = 0.28;

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
        this.perfectStreak = 0;
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
            this.perfectStreak = 0;
            this.broken++;
        }

        // --- remada ---
        const pressedA = input.state.a.pressed;
        const pressedB = input.state.b.pressed;
        if (pressedA || pressedB) {
            const side = this.nextSide;
            const offset = Math.abs(this.beatT);
            if (side !== this.nextSide) {
                // remar do lado errado desequilibra a canoa
                this.cadence = Math.max(0, this.cadence - 0.3);
                this.broken++;
                this.perfectStreak = 0;
                this.speed *= 0.94;
                audio.play('ui_deny');
                this.float.push('FORA DE LADO', PLAYER_SCREEN_X, this.laneY - 34, 'B', 700);
            } else if (offset <= GOOD_WINDOW) {
                const quality = 1 - offset / GOOD_WINDOW;
                this.cadence = Math.min(1, this.cadence + 0.15 + quality * 0.15); // Sobe mais rápido
                this.speed += 38 + quality * 45 + this.cadence * 30; // Impulso muito maior
                this.strokes++;
                if (quality > 0.7) {
                    this.perfect++;
                    this.perfectStreak++;
                    this.score += 12;
                    this.float.push(`BOA! +12`, PLAYER_SCREEN_X, this.laneY - 34, 'z', 550);
                    if (this.perfectStreak >= 5 && this.perfectStreak % 5 === 0) {
                        this.float.push(`${this.perfectStreak} SEGUIDAS!`, PLAYER_SCREEN_X, this.laneY - 50, 'x', 800);
                        this.speed += 18;
                    }
                } else {
                    this.perfectStreak = 0;
                    this.score += 5;
                }
                this.pushWake(side);
                this.nextSide = side === 'a' ? 'b' : 'a';
                this.beatT = BEAT_SEC;
                this.rowPhase = 0;
                audio.play('stroke');
            } else {
                // remada fora da janela: entra, mas mata o embalo
                this.cadence = Math.max(0, this.cadence - 0.14);
                this.perfectStreak = 0;
                this.speed += 8;
                this.strokes++;
                this.nextSide = side === 'a' ? 'b' : 'a';
                this.beatT = BEAT_SEC;
                audio.play('stroke');
                this.float.push('REMA!', PLAYER_SCREEN_X, this.laneY - 34, 'o', 450);
            }
        }

        this.rowPhase += dt;
        this.cueReady = Math.abs(this.beatT) <= GOOD_WINDOW + 0.08;
        this.cueX = PLAYER_SCREEN_X + 24;
        this.cueY = this.laneY - 42;

        if (input.state.up.pressed && this.lane > 0) this.lane--;
        if (input.state.down.pressed && this.lane < LANES.length - 1) this.lane++;
        // desvia sozinho da boia que vem na mesma raia
        if (!input.state.up.down && !input.state.down.down) {
            const danger = this.buoys.find((b) => !b.hit && b.lane === this.lane
                && (b.dist - this.dist) > 20 && (b.dist - this.dist) < 90);
            if (danger) {
                const alt = danger.lane === 0 ? 1 : danger.lane === LANES.length - 1 ? danger.lane - 1
                    : (this.lane > 1 ? this.lane - 1 : this.lane + 1);
                this.lane = alt;
            }
        }
        this.laneY += (LANES[this.lane] - this.laneY) * Math.min(1, dt * 7);

        this.speed -= (16 + this.speed * 0.1) * dt;
        this.speed = clamp(this.speed, 20, 240 + this.cadence * 50);

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

    pushWake(side) {
        this.wake.push({ x: PLAYER_SCREEN_X - 30, y: this.laneY + 6, life: 0.7, side });
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
        if (this.finished) return;
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

        // água da baía: bandas de profundidade + marolas correndo para trás
        drawWater(px, 0, 104, W, H - 104, this.elapsed, cam);
        // linhas de raia, que também servem de referência de velocidade
        for (const ly of LANES) {
            for (let i = -1; i < 12; i++) {
                const x = Math.round(i * 34 - (cam * 0.9) % 34);
                px.ctx.globalAlpha = 0.35;
                px.rect(x, ly + 12, 14, 1, SVC['d']);
                px.ctx.globalAlpha = 1;
            }
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
            px.blitScreen(sprites.get(`rowRival#${i % 4}`), x + 4, y + 6);
            px.blitScreen(sprites.get('canoe'), x, y + 12);
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
        px.blitScreen(sprites.get('paddle'), PLAYER_SCREEN_X + 4 + paddleSide * 12, this.laneY + 10 + bob);
        px.blitScreen(sprites.get(pose), PLAYER_SCREEN_X + 4, this.laneY + 6 + bob);
        px.blitScreen(sprites.get('canoe'), PLAYER_SCREEN_X, this.laneY + 12 + bob);
    }

    renderOverlay() {
        const { px, font } = this.app;

        // --- sincronia acumulada e velocidade, nas beiradas ---
        gauge(px, font, 4, 16, 84, 'SINC', this.cadence, {
            fill: this.cadence > 0.6 ? 'y' : 'c', glow: 'd'
        });
        gauge(px, font, W - 88, 16, 84, 'RITMO', this.speed / 240, { fill: 'b', glow: 'c' });

        // --- metrônomo: a peça central da prova, no meio e sem competir com os medidores ---
        const boxW = 124;
        const boxX = Math.round((W - boxW) / 2);
        panel(px, boxX, 16, boxW, 26, { fill: '1', border: '0', light: 'n', dark: '0' });
        font.text(px.ctx, 'CADÊNCIA', W / 2, 18, { color: 'o', align: 'center', mono: true });

        const trackX = boxX + 8;
        const trackW = boxW - 16;
        px.rect(trackX, 29, trackW, 6, SVC['m']);
        // janela boa, centrada — o marcador corre da direita pra esquerda até ela
        const goodW = Math.round(trackW * (GOOD_WINDOW * 2 / BEAT_SEC));
        px.rect(Math.round(trackX + trackW / 2 - goodW / 2), 29, goodW, 6, SVC['j']);
        px.rect(Math.round(trackX + trackW / 2 - goodW / 2), 29, goodW, 1, SVC['k']);
        px.rect(Math.round(trackX + trackW / 2) - 1, 27, 2, 10, SVC['z']);

        const p = clamp(this.beatT / BEAT_SEC, -0.4, 1);
        const markX = trackX + trackW / 2 + p * (trackW / 2);
        px.rect(Math.round(markX) - 1, 26, 3, 12, SVC[Math.abs(this.beatT) <= GOOD_WINDOW ? 'y' : 'r']);

        // qual botão vem agora, dentro da própria caixa da cadência
        font.text(px.ctx, 'TOQUE', boxX + boxW - 6, 18, {
            color: 'z', align: 'right', mono: true
        });

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
        px.rect(railX + Math.round(railW * pt) - 2, railY - 3, 5, 8, SVC['z']);
    }
}
