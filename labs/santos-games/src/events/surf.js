// events/surf.js — SURFE no Quebra-Mar (equivalente ao Surfing do California Games).
//
// A onda fica parada no enquadramento e o surfista se move sobre ela; quem corre é o cenário
// atrás, que é o que vende a sensação de velocidade. A tensão vem de um único conflito: a
// espuma fecha a onda vindo da direita, e os pontos estão justamente perto dela — no "bolso".
// Fugir para a esquerda é seguro e pobre; ficar no bolso é caro e rende.
//
// O perfil da onda tem DOIS lados e o pico anda junto com o ponto de quebra. A versão
// anterior fixava a crista numa coluna e devolvia altura máxima para tudo à direita dela: a
// água já quebrada virava um paralelepípedo branco de 90 px cobrindo um quarto da tela, e a
// parede à esquerda ficava tão rasa que lia como um triângulo deitado. Agora a onda tem
// ombro, pico e costa, e os três caminham para a esquerda conforme ela fecha.

import { EventBase } from './base.js';
import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp, lerp } from '../core/util.js';
import { tile, drawWater, drawShadow } from '../art/scenery.js';
import { gauge, judgePanel } from '../game/hud.js';

const START_X = 296;        // onde o pico nasce, perto da borda direita
const FACE_LEN = 186;       // extensão da parede para a esquerda do pico
const BACK_LEN = 46;        // extensão da costa da onda para a direita
const TROUGH_Y = 190;       // linha da base da onda
const CREST_H = 92;         // altura da parede no pico
const SHOULDER_H = 22;      // altura do ombro, lá na ponta esquerda da parede
const SEA_Y = 124;          // horizonte da água
const WAVES = 3;

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
        this.playerX = 170;
        this.face = 0.45;              // 0 = base da parede, 1 = lábio
        this.speed = 70;               // mais rápido
        this.foamX = START_X;          // o pico (e a quebra) começam à direita e marcham
        this.foamSpeed = 22 + this.waveIndex * 6; // quebra mais agressiva (California Games style)
        this.state = 'ride';           // ride | air | tube | wipe
        this.airT = 0;
        this.airPeak = 0;
        this.tubeT = 0;
        this.trickCooldown = 0;
        this.waveT = 0;
        this.wavePoints = 0;
        this.danger = 0;               // 0..1 — o quanto a espuma já está em cima
        this.spray = [];
    }

    start() {
        this.app.audio.play('splash');
    }

    /**
     * Altura da onda numa coluna.
     *
     * O pico acompanha o ponto de quebra (`foamX`), que é o que uma onda de verdade faz: ela
     * quebra no ponto mais alto e esse ponto caminha ao longo do banco. Amarrar o pico a uma
     * coluna fixa, como antes, deixava o desenho com uma parede rasíssima do lado esquerdo —
     * dezenas de pixels de altura zero que liam como um triângulo deitado, não como onda.
     *
     * À esquerda: rampa côncava do ombro até o lábio. À direita: a costa desabando.
     */
    faceHeight(x) {
        const peak = this.foamX;
        if (x <= peak) {
            const d = clamp((peak - x) / FACE_LEN, 0, 1);
            return SHOULDER_H + (CREST_H - SHOULDER_H) * Math.pow(1 - d, 1.9);
        }
        // atrás do pico a água desaba depressa: é o que sobra depois da onda passar
        const d = clamp((x - peak) / BACK_LEN, 0, 1);
        return CREST_H * Math.pow(1 - d, 2.6);
    }

    /** Y da água na coluna x, considerando a parede da onda. */
    waterY(x) {
        return TROUGH_Y - this.faceHeight(x);
    }

    /** Y do surfista: interpola entre a base e o lábio na coluna em que ele está. */
    playerY() {
        return lerp(TROUGH_Y, this.waterY(this.playerX), this.face);
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
            this.face = clamp(this.face - vy * 0.95 * dt, 0, 1);
            this.speed += (vy > 0 ? 52 : vy < 0 ? -26 : -6) * dt;
        }
        this.speed = clamp(this.speed, 26, 170);

        // --- posição na linha (esquerda = fugir, direita = bolso) ---
        const vx = input.axisX();
        this.playerX = clamp(this.playerX + vx * 70 * dt, 40, this.foamX - 6);

        // --- a onda fecha ---
        this.foamX -= this.foamSpeed * dt;
        // quanto mais tempo passa, mais a onda "acompanha" — evita que o jogador
        // simplesmente estacione na esquerda e espere a prova acabar sem risco
        this.foamSpeed += dt * 2.0;

        const gap = this.foamX - this.playerX;
        this.danger = clamp(1 - gap / 34, 0, 1);

        // --- manobras (com buffer: um toque logo antes do fim do cooldown ainda vale) ---
        if (this.state === 'ride' && input.buffered('a', 130) && this.trickCooldown <= 0) {
            input.consume('a');
            this.doTrick();
        }

        // --- tubo: agachar embaixo do lábio, perto da espuma ---
        const inTubeZone = this.face < 0.45 && gap < 78 && gap > 10;
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
                if (this.face < 0.2) this.speed *= 0.75;
                audio.play('land');
                px.shake(1, 80);
            }
        }

        // --- pontuação contínua: proximidade do bolso × altura na parede ---
        const pocketQuality = clamp(1 - Math.abs(gap - 52) / 88, 0, 1);
        this.wavePoints += pocketQuality * (0.6 + this.face * 0.8) * 26 * dt;

        this.scroll += this.speed * dt;
        this.updateSpray(dt);
        if (Math.random() < dt * 24) this.pushSpray();

        // --- fim de onda ---
        // A margem de 2 px (em vez de 4) e o aviso visual de perigo dão ao jogador um quadro
        // inteiro para reagir: antes a queda vinha sem nenhum sinal.
        if (gap < 2) {
            this.wipeout();
        } else if (this.foamX < 52 || this.waveT > 26) {
            this.closeWave();
        }
    }

    doTrick() {
        const { audio, px } = this.app;
        this.trickCooldown = 0.42;
        if (this.face > 0.72 && this.speed > 92) {
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
            this.speed *= 0.92;
        } else {
            const pts = Math.round(20 + this.speed * 0.2);
            this.addPoints(pts, 'CUTBACK', 'H');
            audio.play('carve');
            // o cutback joga o surfista de volta pra dentro do bolso — risco e recompensa
            this.playerX = clamp(this.playerX + 22, 40, this.foamX - 6);
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
        for (let i = 0; i < 14; i++) this.pushSpray(true);
    }

    closeWave() {
        this.state = 'wipe';
        this.wipeT = 0.9;
        this.float.push('ONDA FECHOU', W / 2, 96, 'p', 1100);
    }

    nextWave() {
        // O desfecho da prova continua rodando `step()` em câmera lenta, e o estado 'wipe' com
        // o cronômetro já zerado reentrava aqui a cada quadro: a pontuação da última onda era
        // somada dezenas de vezes e QUALQUER partida — inclusive uma sem tocar em nada —
        // terminava com nota 10 dos cinco jurados. A prova só fecha onda enquanto está em jogo.
        if (this.phase !== 'play') return;

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

    pushSpray(burst = false) {
        this.spray.push({
            x: this.playerX + (burst ? (Math.random() - 0.5) * 20 : 6),
            y: this.playerY() + 2,
            vx: (burst ? (Math.random() - 0.5) * 120 : 30 + Math.random() * 40),
            vy: -20 - Math.random() * (burst ? 90 : 30),
            life: burst ? 0.8 : 0.5,
            size: Math.floor(Math.random() * 3)
        });
        if (this.spray.length > 48) this.spray.shift();
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

        // --- oceano de fundo: horizonte com cintilância, depois o canal escuro na frente ---
        ctx.drawImage(scenery.seaFar, 0, SEA_Y);
        drawWater(px, 0, SEA_Y + 40, W, H - SEA_Y - 40, this.waveT, this.scroll);
        px.rect(0, TROUGH_Y, W, H - TROUGH_Y, SVC['a']);
        px.rect(0, TROUGH_Y + 14, W, H - TROUGH_Y - 14, SVC['9']);
        px.rect(0, TROUGH_Y + 28, W, H - TROUGH_Y - 28, SVC['O']);

        const foamX = Math.round(this.foamX);
        const scrollPhase = Math.floor(this.waveT * 80);

        // --- parede não quebrada (tudo à esquerda da linha de quebra) ---
        for (let x = 0; x < Math.min(W, foamX); x++) {
            const top = this.waterY(x);
            const h = TROUGH_Y - top;
            if (h < 1) continue;
            // bandas seguindo a altura local: quanto mais alta a parede, mais clara no topo
            px.rect(x, top, 1, Math.max(1, h * 0.20), SVC['d']);
            px.rect(x, top + h * 0.20, 1, h * 0.28, SVC['c']);
            px.rect(x, top + h * 0.48, 1, h * 0.28, SVC['b']);
            px.rect(x, top + h * 0.76, 1, h * 0.24 + 2, SVC['a']);
            px.rect(x, top, 1, 1, SVC['h']);        // linha de brilho na crista
            // textura: riscos diagonais subindo a parede, que dão a sensação de água correndo
            if ((x + scrollPhase) % 17 === 0 && h > 12) {
                px.rect(x, top + h * 0.32, 1, Math.max(2, h * 0.22), SVC['d']);
            }
            if ((x * 3 + scrollPhase) % 29 === 0 && h > 24) {
                px.rect(x, top + h * 0.6, 1, Math.max(2, h * 0.14), SVC['c']);
            }
        }

        // --- água já quebrada ---
        // A espuma é uma CAMADA na superfície, não uma coluna: embaixo dela continua havendo
        // água azul. Pintar a coluna inteira de branco é o que transformava a arrebentação
        // numa cunha branca chapada engolindo o canto da tela.
        for (let x = Math.max(0, foamX); x < W; x++) {
            const top = this.waterY(x);
            const h = TROUGH_Y - top;
            if (h < 1) continue;
            const jag = Math.sin((x + this.waveT * 90) * 0.35) * 2 + Math.sin(x * 1.7) * 1.2;
            const y0 = top + jag;
            const thick = clamp(h * 0.6, 5, 20);

            // corpo de água por baixo da espuma
            px.rect(x, y0, 1, h - jag + 6, SVC['b']);
            px.rect(x, y0 + thick + 4, 1, Math.max(0, h - jag - thick - 2), SVC['a']);
            // manto de espuma
            px.rect(x, y0, 1, thick, SVC['P']);
            px.rect(x, y0, 1, Math.max(1, thick * 0.45), SVC['E']);
            // bolhas: pontos de água azul dentro da espuma, senão vira um bloco branco chapado
            if ((x * 7 + Math.floor(this.waveT * 40)) % 11 < 2) {
                px.rect(x, y0 + 3 + ((x * 13) % Math.max(3, thick - 2)), 1, 2, SVC['c']);
            }
            if ((x * 5 + Math.floor(this.waveT * 26)) % 19 < 2) {
                px.rect(x, y0 + thick + 1, 1, 2, SVC['d']);
            }
        }

        // --- o lábio se enrolando: é isto que faz o desenho ler como onda, e não como rampa ---
        const lipTop = this.waterY(foamX);
        const curlCx = foamX - 14;
        const curlCy = lipTop + 15;
        const curlR = 14;
        // Boca do tubo: só a metade de baixo-esquerda do disco, que é a parte que fica na
        // sombra do lábio. O disco inteiro lia como um buraco redondo furado na onda.
        for (let j = -curlR; j <= curlR; j++) {
            for (let i = -curlR; i <= curlR; i++) {
                if (i * i + j * j > (curlR - 4) * (curlR - 4)) continue;
                if (j < -1 && i > 2) continue;
                px.rect(curlCx + i, curlCy + j, 1, 1, SVC[j < 1 ? '9' : 'O']);
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

        // --- marcador do bolso na própria água: a leitura sem tirar o olho do surfista ---
        if (this.state !== 'wipe') {
            const pocketX = Math.round(this.foamX - 52);
            if (pocketX > 30 && pocketX < W - 10) {
                const py = this.waterY(pocketX);
                const blink = Math.sin(this.waveT * 8) > 0 ? 'A' : '8';
                px.rect(pocketX - 4, py + 3, 9, 1, SVC[blink]);
                px.rect(pocketX, py + 1, 1, 4, SVC[blink]);
            }
        }

        // --- surfista ---
        const pyBase = this.playerY();
        const py = pyBase - (this.state === 'air' ? this.airPeak : 0);
        const poseName = this.state === 'wipe' ? 'surfWipe'
            : this.state === 'air' ? 'surfAir'
                : this.state === 'tube' ? 'surfTube'
                    : this.face > 0.65 ? 'surfCarve' : 'surfCrouch';

        if (this.state === 'air') drawShadow(px, this.playerX, pyBase + 2, 9, 0.35);
        px.blitScreen(sprites.get('board'), this.playerX, py + 4);
        px.blitScreen(sprites.get(poseName), this.playerX, py);

        // --- spray ---
        for (const s of this.spray) {
            px.blitScreen(sprites.get(`spray#${s.size}`), s.x, s.y);
        }

        // dentro do tubo a tela escurece nas bordas — a "boca" fechando
        if (this.state === 'tube') {
            ctx.globalAlpha = 0.55;
            px.rect(0, 0, W, Math.max(0, this.waterY(this.playerX) - 6), SVC['0']);
            ctx.globalAlpha = 1;
        }

        // aviso de que a espuma está em cima: pulso vermelho na borda direita da tela
        if (this.danger > 0.05 && this.state !== 'wipe') {
            ctx.globalAlpha = this.danger * (0.4 + Math.sin(this.waveT * 18) * 0.2);
            px.rect(W - 8, 14, 8, H - 14, SVC['B']);
            ctx.globalAlpha = 1;
        }
    }

    renderOverlay() {
        const { px, font } = this.app;
        gauge(px, font, 4, 16, 96, 'VEL', (this.speed - 26) / 144, { fill: 'c', glow: 'd' });

        const gap = clamp((this.foamX - this.playerX) / 120, 0, 1);
        gauge(px, font, W - 100, 16, 96, 'BOLSO', 1 - gap, {
            fill: gap < 0.2 ? 'B' : 'x', glow: 'G', mark: 0.56, markColor: 'A'
        });

        if (this.phase === 'outro' && this.judges) {
            judgePanel(px, font, this.judges, (1.4 - this.phaseT) * 1.6);
        }
    }
}
