// events/surf.js — SURFE no Quebra-Mar (equivalente ao Surfing do California Games).
//
// A onda fica parada no enquadramento e o surfista se move sobre ela; quem corre é o cenário
// atrás, que é o que vende a sensação de velocidade. A tensão vem de um único conflito: a
// espuma fecha a onda vindo da direita, e os pontos estão justamente perto dela — no "bolso".
// Fugir para a esquerda é seguro e pobre; ficar no bolso é caro e rende.

import { EventBase } from './base.js';
import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp, lerp } from '../core/util.js';
import { tile } from '../art/scenery.js';
import { panel, bar, judgePanel } from '../game/hud.js';

const CREST_X = 244;        // coluna onde a crista da onda fica fixa na tela
const FACE_LEN = 208;       // extensão da parede para a esquerda
const TROUGH_Y = 186;       // linha da base da onda
const CREST_H = 92;         // altura da parede na crista
const WAVES = 3;

/**
 * Altura da parede numa coluna.
 * O expoente alto é o que faz a parede ser CÔNCAVA: ela quase não sobe no ombro e engrossa
 * rápido perto da crista. Com um expoente próximo de 1 o resultado é uma rampa reta, que não
 * lê como onda nenhuma.
 */
function faceHeight(x) {
    const d = clamp((CREST_X - x) / FACE_LEN, 0, 1);
    return CREST_H * Math.pow(1 - d, 2.3);
}

export class SurfEvent extends EventBase {
    setup() {
        this.duration = 0;              // termina por número de ondas, não por relógio
        this.waveIndex = 0;
        this.rawPoints = 0;
        this.scroll = 0;
        this.gulls = [{ x: 40, y: 46, s: 12 }, { x: 210, y: 30, s: 9 }];
        this.resetWave();
    }

    resetWave() {
        this.playerX = 150;
        this.face = 0.45;              // 0 = base da parede, 1 = lábio
        this.speed = 62;
        this.foamX = CREST_X + 26;     // espuma começa atrás da crista
        this.foamSpeed = 16 + this.waveIndex * 5;
        this.state = 'ride';           // ride | air | tube | wipe
        this.airT = 0;
        this.airPeak = 0;
        this.tubeT = 0;
        this.trickCooldown = 0;
        this.waveT = 0;
        this.wavePoints = 0;
        this.spray = [];
    }

    start() {
        this.app.audio.play('splash');
    }

    /** Y da água na coluna x, considerando a parede da onda. */
    waterY(x) {
        return TROUGH_Y - faceHeight(x);
    }

    /** Y do surfista: interpola entre a base e o lábio na coluna em que ele está. */
    playerY() {
        const top = this.waterY(this.playerX);
        return lerp(TROUGH_Y, top, this.face) - (this.state === 'air' ? this.airT * 0 : 0);
    }

    step(dt) {
        const { input, audio, px } = this.app;
        this.waveT += dt;
        this.trickCooldown = Math.max(0, this.trickCooldown - dt);

        if (this.state === 'wipe') {
            this.wipeT -= dt;
            this.scroll += this.speed * dt;
            this.speed = Math.max(0, this.speed - 90 * dt);
            if (this.wipeT <= 0) this.nextWave();
            this.updateSpray(dt);
            return;
        }

        // --- posição na parede ---
        // Subir custa velocidade, descer ganha: é o bombeio que mantém a prancha viva.
        const vy = input.axisY();
        if (this.state === 'ride') {
            this.face = clamp(this.face - vy * 0.85 * dt, 0, 1);
            this.speed += (vy > 0 ? 46 : vy < 0 ? -26 : -6) * dt;
        }
        this.speed = clamp(this.speed, 26, 165);

        // --- posição na linha (esquerda = fugir, direita = bolso) ---
        const vx = input.axisX();
        this.playerX = clamp(this.playerX + vx * 62 * dt, 44, CREST_X - 6);

        // --- a onda fecha ---
        this.foamX -= this.foamSpeed * dt;
        // quanto mais rápido você anda, mais a onda "acompanha" — evita que o jogador
        // simplesmente estacione na esquerda e espere a prova acabar sem risco
        this.foamSpeed += dt * 2.2;

        // --- manobras ---
        if (this.state === 'ride' && input.state.a.pressed && this.trickCooldown <= 0) {
            this.doTrick();
        }

        // --- tubo: agachar embaixo do lábio, perto da espuma ---
        const inTubeZone = this.face < 0.42 && (this.foamX - this.playerX) < 74 && (this.foamX - this.playerX) > 8;
        if (this.state === 'ride' && input.state.b.down && inTubeZone) {
            this.state = 'tube';
            audio.play('tube');
        } else if (this.state === 'tube' && (!input.state.b.down || !inTubeZone)) {
            if (this.tubeT > 0.5) {
                const pts = Math.round(this.tubeT * 90);
                this.addPoints(pts, 'TUBO!', 'y');
            }
            this.tubeT = 0;
            this.state = 'ride';
        }

        if (this.state === 'tube') {
            this.tubeT += dt;
            this.speed += 22 * dt;
            this.wavePoints += dt * 26;
        }

        if (this.state === 'air') {
            this.airT += dt;
            this.airPeak = Math.max(this.airPeak, Math.sin(clamp(this.airT / 0.62, 0, 1) * Math.PI) * 34);
            if (this.airT >= 0.62) {
                this.state = 'ride';
                // aterrissagem: cair muito baixo na parede custa velocidade
                if (this.face < 0.2) {
                    this.speed *= 0.7;
                    audio.play('land');
                } else {
                    audio.play('land');
                }
            }
        }

        // --- pontuação contínua: proximidade do bolso × altura na parede ---
        const gap = this.foamX - this.playerX;
        const pocketQuality = clamp(1 - Math.abs(gap - 54) / 90, 0, 1);
        this.wavePoints += pocketQuality * (0.6 + this.face * 0.8) * 26 * dt;

        this.scroll += this.speed * dt;
        this.updateSpray(dt);
        if (Math.random() < dt * 22) this.pushSpray();

        // --- fim de onda ---
        if (gap < 4) {
            this.wipeout();
        } else if (this.foamX < 40 || this.waveT > 26) {
            this.closeWave();
        }
    }

    doTrick() {
        const { audio, px } = this.app;
        this.trickCooldown = 0.5;
        if (this.face > 0.74 && this.speed > 96) {
            this.state = 'air';
            this.airT = 0;
            this.airPeak = 0;
            const pts = Math.round(60 + this.speed * 0.7);
            this.addPoints(pts, 'AÉREO!', 'x');
            audio.play('air');
            px.shake(2, 160);
        } else if (this.face > 0.55) {
            const pts = Math.round(30 + this.speed * 0.35);
            this.addPoints(pts, 'RASGADA', 'A');
            audio.play('carve');
            this.face = clamp(this.face - 0.22, 0, 1);
            this.speed *= 0.9;
        } else {
            const pts = Math.round(20 + this.speed * 0.2);
            this.addPoints(pts, 'CUTBACK', 'H');
            audio.play('carve');
            // o cutback joga o surfista de volta pra dentro do bolso — risco e recompensa
            this.playerX = clamp(this.playerX + 22, 44, CREST_X - 6);
        }
    }

    addPoints(pts, label, color) {
        this.wavePoints += pts;
        this.float.push(`${label} +${pts}`, this.playerX, this.playerY() - 40, color, 950);
    }

    wipeout() {
        this.state = 'wipe';
        this.wipeT = 1.5;
        this.app.audio.play('splash');
        this.app.px.shake(4, 300);
        this.float.push('CAIU!', this.playerX, this.playerY() - 30, 'B', 1200);
        this.wavePoints *= 0.6;   // cair não zera a onda, mas dói
    }

    closeWave() {
        this.state = 'wipe';
        this.wipeT = 0.9;
        this.float.push('ONDA FECHOU', W / 2, 96, 'p', 1100);
    }

    nextWave() {
        this.rawPoints += this.wavePoints;
        this.score = this.rawPoints;
        this.waveIndex++;
        if (this.waveIndex >= WAVES) {
            this.judges = this.makeJudges(this.rawPoints, 1500);
            this.score = this.judgeScore(this.judges);
            this.detail = `${WAVES} ondas · ${Math.round(this.rawPoints)} pts de manobra`;
            this.finish();
        } else {
            this.resetWave();
        }
    }

    pushSpray() {
        this.spray.push({
            x: this.playerX + 6, y: this.playerY() + 2,
            vx: 30 + Math.random() * 40, vy: -20 - Math.random() * 30,
            life: 0.5, size: Math.floor(Math.random() * 3)
        });
        if (this.spray.length > 40) this.spray.shift();
    }

    updateSpray(dt) {
        for (let i = this.spray.length - 1; i >= 0; i--) {
            const s = this.spray[i];
            s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 120 * dt; s.life -= dt;
            if (s.life <= 0) this.spray.splice(i, 1);
        }
    }

    middleLabel() {
        return `ONDA ${Math.min(this.waveIndex + 1, WAVES)}/${WAVES}`;
    }

    render() {
        const { px, sprites, scenery } = this.app;
        const ctx = px.ctx;

        // --- fundo: céu, quebra-mar e horizonte correndo com a velocidade ---
        ctx.drawImage(scenery.sky, 0, 0);
        tile(ctx, scenery.skylineFar, this.scroll * 0.10, 74);
        ctx.drawImage(scenery.breakwater, Math.round(30 - (this.scroll * 0.16) % 320), 96);

        for (const g of this.gulls) {
            const gx = ((g.x - this.scroll * 0.05) % (W + 40) + W + 40) % (W + 40) - 20;
            px.blitScreen(sprites.anim('gull', this.waveT + g.s, 5), gx, g.y);
        }

        // --- oceano de fundo ---
        px.rect(0, 128, W, H - 128, SVC['a']);
        px.rect(0, TROUGH_Y, W, H - TROUGH_Y, SVC['9']);

        const foamX = Math.round(this.foamX);

        // --- parede não quebrada (tudo à esquerda da linha de quebra) ---
        for (let x = 0; x < Math.min(W, foamX); x++) {
            const top = this.waterY(x);
            const h = TROUGH_Y - top;
            if (h < 1) continue;
            // bandas seguindo a altura local: quanto mais alta a parede, mais clara no topo
            px.rect(x, top, 1, Math.max(1, h * 0.22), SVC['d']);
            px.rect(x, top + h * 0.22, 1, h * 0.30, SVC['c']);
            px.rect(x, top + h * 0.52, 1, h * 0.28, SVC['b']);
            px.rect(x, top + h * 0.80, 1, h * 0.20 + 2, SVC['a']);
            // linha de brilho na crista
            px.rect(x, top, 1, 1, SVC['h']);
            // textura: riscos diagonais subindo a parede, que dão a sensação de água correndo
            if ((x + Math.floor(this.waveT * 80)) % 17 === 0 && h > 12) {
                px.rect(x, top + h * 0.35, 1, Math.max(2, h * 0.2), SVC['d']);
            }
        }

        // --- espuma: água já quebrada, com borda dentada e granulado ---
        for (let x = Math.max(0, foamX); x < W; x++) {
            const top = this.waterY(x);
            const jag = Math.sin((x + this.waveT * 90) * 0.35) * 3 + Math.sin(x * 1.7) * 1.5;
            const y0 = top + jag;
            px.rect(x, y0, 1, TROUGH_Y - y0 + 16, SVC['E']);
            px.rect(x, y0 + 3, 1, 2, SVC['d']);
            // bolhas: pontos de água azul dentro da espuma, senão vira um bloco branco chapado
            if ((x * 7 + Math.floor(this.waveT * 40)) % 11 < 2) {
                px.rect(x, y0 + 8 + ((x * 13) % 20), 1, 2, SVC['c']);
            }
        }

        // --- o lábio se enrolando: é isto que faz o desenho ler como onda, e não como rampa ---
        const lipTop = this.waterY(foamX);
        const curlCx = foamX - 17;
        const curlCy = lipTop + 17;
        const curlR = 17;
        // interior do tubo (escuro, atrás do lábio)
        for (let j = -curlR; j <= curlR; j++) {
            for (let i = -curlR; i <= curlR; i++) {
                if (i * i + j * j <= (curlR - 5) * (curlR - 5)) {
                    px.rect(curlCx + i, curlCy + j, 1, 1, SVC['9']);
                }
            }
        }
        // anel branco do lábio, aberto embaixo à esquerda (por onde o surfista sai)
        for (let a = -30; a <= 250; a += 4) {
            const rad = a * Math.PI / 180;
            const wob = Math.sin(a * 0.08 + this.waveT * 6) * 1.2;
            const lx = curlCx + Math.cos(rad) * (curlR + wob);
            const ly = curlCy - Math.sin(rad) * (curlR + wob);
            px.rect(lx - 2, ly - 2, 5, 5, SVC['J']);
        }
        // crista escorrendo pela parede logo antes da quebra
        for (let i = 2; i < 26; i++) {
            const x = foamX - curlR - i;
            if (x < 0) break;
            const top = this.waterY(x);
            px.rect(x, top - 1 + Math.sin(i * 0.6 + this.waveT * 9) * 1.5, 1, 3, SVC['J']);
        }

        // --- surfista ---
        const pyBase = this.playerY();
        const py = pyBase - (this.state === 'air' ? this.airPeak : 0);
        const poseName = this.state === 'wipe' ? 'surfWipe'
            : this.state === 'air' ? 'surfAir'
                : this.state === 'tube' ? 'surfTube'
                    : this.face > 0.65 ? 'surfCarve' : 'surfCrouch';

        px.blitScreen(sprites.get('board'), this.playerX, py + 4);
        px.blitScreen(sprites.get(poseName), this.playerX, py);

        // --- spray ---
        for (const s of this.spray) {
            px.blitScreen(sprites.get(`spray#${s.size}`), s.x, s.y);
        }

        // dentro do tubo a tela escurece nas bordas — a "boca" fechando
        if (this.state === 'tube') {
            const ctx2 = px.ctx;
            ctx2.globalAlpha = 0.55;
            px.rect(0, 0, W, Math.max(0, this.waterY(this.playerX) - 6), SVC['0']);
            ctx2.globalAlpha = 1;
        }
    }

    renderOverlay() {
        const { px, font } = this.app;
        // medidor de velocidade + indicador de bolso
        panel(px, 4, 18, 78, 24, { fill: '1', border: 'n' });
        font.text(px.ctx, 'VELOCIDADE', 8, 21, { color: 'o', mono: true });
        bar(px, 8, 32, 70, 5, (this.speed - 26) / 139, { fill: 'c', glow: 'd' });

        const gap = clamp((this.foamX - this.playerX) / 120, 0, 1);
        panel(px, W - 82, 18, 78, 24, { fill: '1', border: 'n' });
        font.text(px.ctx, 'BOLSO', W - 78, 21, { color: 'o', mono: true });
        bar(px, W - 78, 32, 70, 5, 1 - gap, { fill: gap < 0.2 ? 'B' : 'x', glow: 'G', mark: 0.55, markColor: 'A' });

        if (this.phase === 'outro' && this.judges) {
            judgePanel(px, font, this.judges, (1.4 - this.phaseT) * 1.6);
        }
    }
}
