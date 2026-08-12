// events/bmx.js — BMX na Ciclovia da Orla (equivalente ao BMX Race do California Games).
//
// Percurso lateral com relógio: o traçado é gerado por semente, então cada campanha tem uma
// ciclovia diferente mas reprodutível. O conflito é o de sempre em prova contra o tempo —
// acelerar é o que rende, e é exatamente o que faz o obstáculo chegar antes de você estar
// pronto. As rampas dos canteiros dão o ar para manobrar, que é onde mora o placar.

import { EventBase } from './base.js';
import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp } from '../core/util.js';
import { tile } from '../art/scenery.js';
import { panel, bar } from '../game/hud.js';

const GROUND_Y = 182;
const COURSE_LEN = 5200;      // px de ciclovia até a linha de chegada
const GRAVITY = 900;
const MAX_SPEED = 250;

const OBSTACLES = [
    { sprite: 'cone', w: 10, h: 14, damage: 0.45, label: 'CONE' },
    { sprite: 'coco', w: 9, h: 9, damage: 0.30, label: 'COCO' },
    { sprite: 'bench', w: 24, h: 14, damage: 0.60, label: 'BANCO' },
    { sprite: 'dog', w: 18, h: 13, damage: 0.50, label: 'CACHORRO' },
    { sprite: 'pothole', w: 22, h: 6, damage: 0.35, label: 'BURACO', flat: true }
];

const TRICKS = ['BUNNY HOP', 'TABLE TOP', 'X-UP', 'NO FOOT'];

export class BmxEvent extends EventBase {
    setup() {
        this.duration = 0;             // termina na linha de chegada
        this.dist = 0;
        this.speed = 90;
        this.y = 0;                    // altura acima do solo
        this.vy = 0;
        this.grounded = true;
        this.crashT = 0;
        this.trickT = 0;
        this.trickName = '';
        this.trickRot = 0;
        this.tricks = 0;
        this.crashes = 0;
        this.cocos = 0;
        this.timeBonus = 0;
        this.buildCourse();
    }

    /** Gera obstáculos, rampas e cocos ao longo do percurso, com espaçamento jogável. */
    buildCourse() {
        const { rng } = this.app;
        this.obstacles = [];
        this.ramps = [];
        this.pickups = [];
        let x = 420;
        while (x < COURSE_LEN - 300) {
            const roll = rng.next();
            if (roll < 0.24) {
                // rampa de canteiro: dá impulso vertical se passar por cima
                this.ramps.push({ x, w: 34, h: 16 });
                // recompensa logo depois da rampa, no arco do salto
                this.pickups.push({ x: x + 54, y: 44 + rng.next() * 22, taken: false });
                this.pickups.push({ x: x + 76, y: 40 + rng.next() * 20, taken: false });
                x += 150 + rng.next() * 90;
            } else {
                const def = rng.pick(OBSTACLES);
                this.obstacles.push({ ...def, x });
                x += 130 + rng.next() * 140;
            }
        }
        // palmeiras e bancos decorativos do jardim da orla
        this.decor = [];
        for (let dx = 200; dx < COURSE_LEN; dx += 180 + rng.next() * 120) {
            this.decor.push({ x: dx, kind: rng.next() < 0.7 ? 'palm' : 'umbrella' });
        }
    }

    start() { this.app.audio.play('jump'); }

    step(dt) {
        const { input, audio, px } = this.app;

        if (this.crashT > 0) {
            this.crashT -= dt;
            this.speed = Math.max(0, this.speed - 260 * dt);
            this.dist += this.speed * dt;
            if (this.crashT <= 0) this.speed = Math.max(60, this.speed);
            return;
        }

        // --- aceleração ---
        const ax = input.axisX();
        if (ax > 0) this.speed += 108 * dt;
        else if (ax < 0) this.speed -= 190 * dt;
        else this.speed -= 26 * dt;
        this.speed = clamp(this.speed, 40, MAX_SPEED);

        // --- salto ---
        if (this.grounded && input.state.a.pressed) {
            this.vy = 300 + this.speed * 0.5;
            this.grounded = false;
            audio.play('jump');
        }

        if (!this.grounded) {
            this.y += this.vy * dt;
            this.vy -= GRAVITY * dt;

            // manobra no ar: só vale com altura sobrando, senão vira queda
            if (input.state.b.pressed && this.trickT <= 0 && this.y > 26) {
                this.trickT = 0.55;
                this.trickName = TRICKS[this.tricks % TRICKS.length];
                this.trickRot = 0;
                audio.play('trick');
            }
            if (this.trickT > 0) {
                this.trickT -= dt;
                this.trickRot += dt * 720;
                if (this.trickT <= 0) {
                    if (this.y > 12) {
                        const pts = Math.round(70 + this.y * 1.6);
                        this.score += pts;
                        this.tricks++;
                        this.float.push(`${this.trickName} +${pts}`, 96, GROUND_Y - this.y - 44, 'x', 900);
                    } else {
                        this.crash('MANOBRA BAIXA');
                        return;
                    }
                }
            }

            if (this.y <= 0) {
                this.y = 0;
                this.vy = 0;
                this.grounded = true;
                // aterrissar no meio de uma manobra é queda
                if (this.trickT > 0) { this.crash('NÃO FECHOU'); return; }
                audio.play('land');
            }
        }

        // --- avanço ---
        this.dist += this.speed * dt;

        // --- rampas ---
        for (const r of this.ramps) {
            const rel = r.x - this.dist;
            if (rel > -6 && rel < 26 && this.grounded) {
                this.vy = 250 + this.speed * 1.15;
                this.grounded = false;
                audio.play('jump');
                px.shake(1, 80);
            }
        }

        // --- colisões ---
        for (const o of this.obstacles) {
            if (o.hit) continue;
            const rel = o.x - this.dist;
            if (rel > -12 && rel < o.w) {
                const clears = this.y > (o.flat ? 4 : o.h);
                if (!clears) {
                    o.hit = true;
                    this.crash(o.label, o.damage);
                    return;
                }
            }
        }

        // --- cocos (bônus) ---
        for (const p of this.pickups) {
            if (p.taken) continue;
            const rel = p.x - this.dist;
            if (Math.abs(rel - 96) < 14 && Math.abs(this.y - p.y) < 18) {
                p.taken = true;
                this.cocos++;
                this.score += 40;
                this.float.push('+40', 96, GROUND_Y - this.y - 30, 'A', 600);
                audio.play('coin');
            }
        }

        // --- chegada ---
        if (this.dist >= COURSE_LEN) this.arrive();
    }

    crash(label, damage = 0.5) {
        const { audio, px } = this.app;
        this.crashT = 1.2;
        this.crashes++;
        this.grounded = true;
        this.y = 0;
        this.vy = 0;
        this.trickT = 0;
        this.speed *= 1 - damage;
        audio.play('crash');
        px.shake(4, 280);
        this.float.push(label, 96, GROUND_Y - 50, 'B', 1100);
    }

    arrive() {
        // o grosso da pontuação é o tempo: 700 é o par, e cada segundo abaixo de 60 vale ouro
        const t = this.elapsed;
        this.timeBonus = Math.max(0, Math.round((78 - t) * 12));
        this.score += this.timeBonus;
        this.detail = `${t.toFixed(1)}s · ${this.tricks} manobras · ${this.crashes} quedas`;
        this.app.audio.play('record');
        this.finish(this.detail);
    }

    middleLabel() {
        const pct = Math.min(100, Math.round((this.dist / COURSE_LEN) * 100));
        return `${this.elapsed.toFixed(1)}"  ${pct}%`;
    }

    render() {
        const { px, sprites, scenery } = this.app;
        const ctx = px.ctx;
        const cam = this.dist;

        ctx.drawImage(scenery.sky, 0, -14);
        tile(ctx, scenery.skylineFar, cam * 0.06, 56);
        tile(ctx, scenery.skyline, cam * 0.14, 74);
        ctx.drawImage(scenery.sea, 0, 128);

        // faixa de areia e o mar à esquerda do quadro (a ciclovia corre paralela à praia)
        px.rect(0, 150, W, 27, SVC['g']);

        // decoração do jardim, antes do piso: as árvores nascem no canteiro, atrás da pista
        for (const d of this.decor) {
            const x = d.x - cam;
            if (x < -40 || x > W + 40) continue;
            px.blitScreen(sprites.get(d.kind), x, GROUND_Y - 3);
        }

        // jardim + calçadão
        px.rect(0, GROUND_Y - 5, W, 5, SVC['j']);
        px.rect(0, GROUND_Y - 5, W, 1, SVC['k']);
        px.rect(0, GROUND_Y, W, H - GROUND_Y, SVC['p']);
        px.rect(0, GROUND_Y, W, 2, SVC['q']);
        // faixas do piso correndo, o que dá a leitura de velocidade
        for (let i = -1; i < 12; i++) {
            const x = ((i * 40) - (cam % 40));
            px.rect(x, GROUND_Y + 12, 22, 2, SVC['o']);
        }
        px.rect(0, GROUND_Y + 26, W, H - GROUND_Y - 26, SVC['n']);

        // rampas
        for (const r of this.ramps) {
            const x = r.x - cam;
            if (x < -50 || x > W + 50) continue;
            for (let i = 0; i < r.w; i++) {
                const hh = Math.round((i / r.w) * r.h);
                px.rect(x + i, GROUND_Y - hh, 1, hh + 2, SVC[i > r.w - 4 ? 'A' : 'k']);
            }
        }

        // obstáculos
        for (const o of this.obstacles) {
            const x = o.x - cam;
            if (x < -40 || x > W + 40) continue;
            px.blitScreen(sprites.get(o.sprite), x + o.w / 2, GROUND_Y + (o.flat ? 4 : 0));
        }

        // cocos suspensos
        for (const p of this.pickups) {
            if (p.taken) continue;
            const x = p.x - cam;
            if (x < -20 || x > W + 20) continue;
            px.blitScreen(sprites.get('coco'), x, GROUND_Y - p.y);
        }

        // linha de chegada
        const finishX = COURSE_LEN - cam;
        if (finishX > -20 && finishX < W + 20) {
            for (let i = 0; i < 14; i++) {
                px.rect(finishX, GROUND_Y - 48 + i * 4, 8, 4, SVC[i % 2 ? 'E' : '0']);
                px.rect(finishX + 8, GROUND_Y - 48 + i * 4, 8, 4, SVC[i % 2 ? '0' : 'E']);
            }
        }

        // --- ciclista ---
        const px0 = 96;
        const py = GROUND_Y - this.y;
        const pose = this.crashT > 0 ? 'bikeCrash'
            : this.trickT > 0 ? 'bikeTrick'
                : this.grounded ? 'bikeRide' : 'bikeAir';

        if (this.crashT <= 0) {
            const spin = this.trickT > 0 ? Math.sin(this.trickRot * Math.PI / 180) * 4 : 0;
            px.blitScreen(sprites.get('bike'), px0, py + spin);
        }
        px.blitScreen(sprites.get(pose), px0, py - 6);

        // sombra no chão
        if (!this.grounded) {
            const shade = clamp(1 - this.y / 120, 0.2, 1);
            px.ctx.globalAlpha = shade * 0.5;
            px.rect(px0 - 12, GROUND_Y + 1, 24, 3, SVC['m']);
            px.ctx.globalAlpha = 1;
        }
    }

    renderOverlay() {
        const { px, font } = this.app;

        panel(px, 4, 18, 84, 24, { fill: '1', border: 'n' });
        font.text(px.ctx, 'VELOCIDADE', 8, 21, { color: 'o', mono: true });
        bar(px, 8, 32, 76, 5, this.speed / MAX_SPEED, { fill: 'A', glow: '8' });

        // barra de percurso com a posição relativa — a leitura de "quanto falta"
        panel(px, W - 108, 18, 104, 24, { fill: '1', border: 'n' });
        font.text(px.ctx, 'PERCURSO', W - 104, 21, { color: 'o', mono: true });
        bar(px, W - 104, 32, 96, 5, this.dist / COURSE_LEN, { fill: 'k', glow: 'l' });
    }
}
