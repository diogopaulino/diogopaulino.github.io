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
import { tile, drawShoreFoam, drawShadow } from '../art/scenery.js';
import { gauge } from '../game/hud.js';

const GROUND_Y = 182;
// Janela de "coyote time": por um instante depois de sair do chão o pulo ainda é aceito.
// Sem isso, saltar no fim de uma rampa exigia precisão de frame e a prova parecia injusta.
const COYOTE_SEC = 0.14;
const COURSE_LEN = 3400;      // px de ciclovia até a linha de chegada
const GRAVITY = 1050;
const MAX_SPEED = 320;

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
        this.finished = false;
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
        if (ax > 0) this.speed += 200 * dt;
        else if (ax < 0) this.speed -= 160 * dt;
        else this.speed += 150 * dt;
        this.speed = clamp(this.speed, 70, MAX_SPEED);

        this.coyote = this.grounded ? COYOTE_SEC : Math.max(0, (this.coyote || 0) - dt);

        const nearObs = this.obstacles.find((o) => !o.hit && (o.x - this.dist) > 4 && (o.x - this.dist) < 110);
        this.cueReady = (this.grounded && !!nearObs) || (!this.grounded && this.y > 18);
        this.cueX = 96;
        this.cueY = GROUND_Y - 56;

        const wantJump = this.coyote > 0 && input.buffered('a', 180);
        const autoHop = this.grounded && nearObs && (nearObs.x - this.dist) < 22;
        if (wantJump || autoHop) {
            if (wantJump) input.consume('a');
            this.vy = 300 + this.speed * 0.5;
            this.grounded = false;
            this.coyote = 0;
            audio.play('jump');
            if (autoHop && !wantJump) this.float.push('PULO!', 96, GROUND_Y - 40, 'y', 400);
        }

        if (!this.grounded) {
            this.y += this.vy * dt;
            this.vy -= GRAVITY * dt;

            // manobra no ar: só vale com altura sobrando, senão vira queda
            if (input.state.a.pressed && this.trickT <= 0 && this.y > 20) {
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
                this.float.push('UAU!', 96, GROUND_Y - this.y - 36, 'y', 500);
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
                this.float.push('COCO +40', 96, GROUND_Y - this.y - 30, 'z', 600);
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
        this.float.push('OPS!', 96, GROUND_Y - 50, 'B', 1100);
    }

    arrive() {
        // Mesma armadilha da prova de surfe: o desfecho segue chamando `step()`, a distância
        // continua acima da linha de chegada e o bônus de tempo era creditado a cada quadro.
        if (this.finished) return;
        this.finished = true;

        // o grosso da pontuação é o tempo: 700 é o par, e cada segundo abaixo de 60 vale ouro
        const t = this.elapsed;
        this.timeBonus = Math.max(0, Math.round((78 - t) * 12));
        this.score += this.timeBonus;
        if (this.timeBonus > 0) {
            this.float.push(`TEMPO +${this.timeBonus}`, W / 2, 100, 'z', 1400);
        }
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

        // mar e areia: a ciclovia corre paralela à praia, e é essa faixa que dá a Santos
        ctx.drawImage(scenery.seaFar, 0, 124);
        drawShoreFoam(px, 160, this.elapsed);
        ctx.drawImage(scenery.sand, 0, 162);

        // decoração do jardim, antes do piso: as árvores nascem no canteiro, atrás da pista
        for (const d of this.decor) {
            const x = d.x - cam;
            if (x < -40 || x > W + 40) continue;
            px.blitScreen(sprites.get(d.kind), x, GROUND_Y - 3);
        }

        // --- jardim + calçadão ---
        px.rect(0, GROUND_Y - 6, W, 6, SVC['j']);
        px.rect(0, GROUND_Y - 6, W, 1, SVC['k']);
        // touceiras do canteiro correndo com a câmera
        for (let i = -1; i < 14; i++) {
            const x = Math.round(i * 26 - (cam * 1.0) % 26);
            px.rect(x, GROUND_Y - 8, 7, 3, SVC['k']);
            px.rect(x + 2, GROUND_Y - 9, 3, 1, SVC['l']);
        }

        // Piso: três faixas de tom decrescente em vez de um bloco cinza. Com o meio-fio claro
        // e a linha central pontilhada, o calçadão finalmente tem profundidade e velocidade.
        px.rect(0, GROUND_Y, W, H - GROUND_Y, SVC['o']);
        px.rect(0, GROUND_Y, W, 2, SVC['q']);          // meio-fio iluminado
        px.rect(0, GROUND_Y + 2, W, 1, SVC['p']);
        px.rect(0, GROUND_Y + 22, W, H - GROUND_Y - 22, SVC['n']);
        px.rect(0, GROUND_Y + 34, W, H - GROUND_Y - 34, SVC['m']);

        // faixa central pontilhada + juntas do piso, o que dá a leitura de velocidade
        for (let i = -1; i < 12; i++) {
            const x = Math.round(i * 40 - (cam % 40));
            px.rect(x, GROUND_Y + 14, 22, 2, SVC['q']);
            px.rect(x + 30, GROUND_Y + 26, 26, 2, SVC['o']);
        }
        for (let i = -1; i < 8; i++) {
            const x = Math.round(i * 64 - (cam * 1.3) % 64);
            px.rect(x, GROUND_Y + 3, 1, H - GROUND_Y - 3, SVC['n']);
        }

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

        // sombra antes do sprite: no ar ela encolhe e some, e é ela que diz onde vai cair
        drawShadow(px, px0, GROUND_Y + 1, clamp(13 - this.y * 0.05, 6, 13),
            clamp(0.5 - this.y * 0.003, 0.12, 0.5));

        // linhas de velocidade atrás da bike — o truque de sempre para vender aceleração
        if (this.speed > MAX_SPEED * 0.55 && this.crashT <= 0) {
            for (let i = 0; i < 4; i++) {
                const ly = py - 6 - i * 6;
                const len = 8 + ((Math.floor(this.dist * 0.4) + i * 7) % 12);
                px.ctx.globalAlpha = 0.5;
                px.rect(px0 - 22 - len, ly, len, 1, SVC['r']);
                px.ctx.globalAlpha = 1;
            }
        }

        if (this.crashT <= 0) {
            const spin = this.trickT > 0 ? Math.sin(this.trickRot * Math.PI / 180) * 4 : 0;
            px.blitScreen(sprites.get('bike'), px0, py + spin);
        }
        px.blitScreen(sprites.get(pose), px0, py - 6);
    }

    renderOverlay() {
        const { px, font } = this.app;

        gauge(px, font, 4, 16, 104, 'VEL', this.speed / MAX_SPEED, { fill: 'z', glow: '7' });

        // barra de percurso com a posição relativa — a leitura de "quanto falta"
        gauge(px, font, W - 116, 16, 112, 'PISTA', this.dist / COURSE_LEN, { fill: 'k', glow: 'l' });
    }
}
