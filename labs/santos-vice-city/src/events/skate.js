// events/skate.js — SKATE VERT no Bowl da Orla (equivalente ao Half Pipe do California Games).
//
// A física roda em uma dimensão: a posição do skatista é o comprimento de arco `s` medido a
// partir do fundo do bowl, e a velocidade `v` é escalar ao longo da superfície. A gravidade
// projetada na inclinação local desacelera na subida e acelera na descida — o que produz
// sozinho o vaivém do pêndulo. Bombear é injetar energia nesse pêndulo no momento certo.

import { EventBase } from './base.js';
import { W, H } from '../core/pixel.js';
import { SVC } from '../core/palette.js';
import { clamp } from '../core/util.js';
import { panel, bar, judgePanel } from '../game/hud.js';

const CX = W / 2;
const FLOOR_Y = 184;
const HALF_FLAT = 40;       // metade do fundo reto do bowl
const R = 66;               // raio da transição
const COPING_Y = FLOOR_Y - R;
const S_MAX = HALF_FLAT + R * (Math.PI / 2);   // arco do fundo até o coping
const GRAVITY = 620;
const PUMP_ACCEL = 340;
const MIN_LAUNCH = 120;

/** Arco assinado -> ponto na superfície + inclinação local (radianos). */
function surfaceAt(s) {
    const as = Math.abs(s);
    const sign = Math.sign(s) || 1;
    if (as <= HALF_FLAT) {
        return { x: CX + sign * as, y: FLOOR_Y, slope: 0 };
    }
    const a = Math.min((as - HALF_FLAT) / R, Math.PI / 2);
    return {
        x: CX + sign * (HALF_FLAT + R * Math.sin(a)),
        y: FLOOR_Y - R * (1 - Math.cos(a)),
        slope: a
    };
}

/** Perfil do bowl por coluna de tela — usado só para desenhar. */
function bowlY(x) {
    const adx = Math.abs(x - CX);
    if (adx <= HALF_FLAT) return FLOOR_Y;
    if (adx >= HALF_FLAT + R) return COPING_Y;
    const a = Math.asin(clamp((adx - HALF_FLAT) / R, 0, 1));
    return FLOOR_Y - R * (1 - Math.cos(a));
}

const GRAB_NAMES = ['INDY', 'MELON', 'STALEFISH', 'MUTE'];

export class SkateEvent extends EventBase {
    setup() {
        this.duration = 62;
        this.s = -12;
        this.v = 40;
        this.state = 'ride';        // ride | air | bail
        this.airY = 0;              // altura acima do coping
        this.airVy = 0;
        this.airSide = 1;
        this.rotation = 0;
        this.rotSpeed = 0;
        this.grabT = 0;
        this.grabName = '';
        this.bailT = 0;
        this.rawPoints = 0;
        this.bestAir = 0;
        this.tricks = 0;
        this.combo = 0;
        this.usedGrabs = new Set();
        this.t = 0;
        // grafite do fundo do bowl, sorteado uma vez por run
        this.tag = this.app.rng.pick(['SANTOS', 'CANAL 3', 'ORLA', 'VICE', 'CAIÇARA']);
    }

    start() { this.app.audio.play('pump'); }

    step(dt) {
        const { input, audio, px } = this.app;
        this.t += dt;

        if (this.state === 'bail') {
            this.bailT -= dt;
            if (this.bailT <= 0) {
                this.state = 'ride';
                this.s = -10;
                this.v = 30;
                this.rotation = 0;
                this.combo = 0;
            }
            return;
        }

        if (this.state === 'air') {
            this.stepAir(dt);
            return;
        }

        // --- rolando dentro do bowl ---
        const pt = surfaceAt(this.s);
        // componente da gravidade ao longo da superfície: freia subindo, empurra descendo
        this.v -= GRAVITY * Math.sin(pt.slope) * Math.sign(this.s || 1) * dt;
        this.v *= 1 - 0.22 * dt;   // atrito

        // bombear: acelerar no sentido do movimento enquanto está na transição.
        // O ganho é proporcional à inclinação, então bombear no fundo reto não faz nada —
        // é preciso pegar o tempo da parede, como no bowl de verdade.
        const dir = input.axisX();
        if (dir !== 0 && Math.sign(dir) === Math.sign(this.v) && pt.slope > 0.12) {
            this.v += PUMP_ACCEL * Math.sin(pt.slope) * Math.sign(this.v) * dt;
            if (Math.random() < dt * 6) audio.play('pump');
        }
        this.v = clamp(this.v, -420, 420);
        this.s += this.v * dt;

        // --- decolagem no coping ---
        if (Math.abs(this.s) >= S_MAX) {
            if (Math.abs(this.v) >= MIN_LAUNCH) {
                this.state = 'air';
                this.airSide = Math.sign(this.s);
                this.airY = 0;
                this.airVy = Math.abs(this.v);
                this.rotation = 0;
                this.rotSpeed = 0;
                this.grabT = 0;
                this.grabName = '';
                this._jumpPeak = 0;
                this.s = S_MAX * this.airSide;
                audio.play('air');
            } else {
                // sem velocidade pra estourar: bate no coping e volta
                this.s = S_MAX * Math.sign(this.s) * 0.999;
                this.v = -this.v * 0.55;
            }
        }
    }

    stepAir(dt) {
        const { input, audio, px } = this.app;
        this.airY += this.airVy * dt;
        this.airVy -= GRAVITY * dt;
        this.bestAir = Math.max(this.bestAir, this.airY);
        this._jumpPeak = Math.max(this._jumpPeak || 0, this.airY);

        // giro: segurar direção + A. A rotação continua por inércia depois do toque.
        if (input.state.a.down) {
            const dir = input.axisX() || -this.airSide;
            this.rotSpeed = clamp(this.rotSpeed + dir * 900 * dt, -640, 640);
        }
        this.rotation += this.rotSpeed * dt;

        // grab: pontos por tempo segurando, e o nome muda conforme a direção
        if (input.state.b.down) {
            if (this.grabT === 0) {
                const idx = (input.axisY() < 0 ? 0 : input.axisY() > 0 ? 1 : input.axisX() !== 0 ? 2 : 3);
                this.grabName = GRAB_NAMES[idx];
                audio.play('grind');
            }
            this.grabT += dt;
        }

        if (this.airY <= 0) {
            this.land();
        }
    }

    land() {
        const { audio, px } = this.app;
        this.airY = 0;
        const spins = Math.abs(this.rotation) / 360;
        const norm = ((this.rotation % 360) + 360) % 360;
        const aligned = norm < 42 || norm > 318 || (norm > 138 && norm < 222);

        if (!aligned || this.bestAirThisJump() < 4) {
            this.bail();
            return;
        }

        const height = Math.round(this.airPeakThisJump());
        const spinPts = Math.floor(spins * 2) * 55;
        const grabPts = Math.round(Math.min(this.grabT, 1.2) * 60);
        const pts = Math.round(height * 3 + spinPts + grabPts) * (1 + this.combo * 0.12);

        this.combo = Math.min(this.combo + 1, 8);
        this.tricks++;
        this.rawPoints += pts;
        this.score = this.rawPoints;
        if (this.grabName) this.usedGrabs.add(this.grabName);

        const label = spinPts > 0 ? `${Math.floor(spins * 2) * 180}°` : this.grabName || 'AIR';
        this.float.push(`${label} +${Math.round(pts)}`, surfaceAt(this.s).x, COPING_Y - 30, 'A', 900);
        if (this.combo > 1) {
            this.float.push(`x${this.combo}`, surfaceAt(this.s).x, COPING_Y - 44, 'x', 700);
        }

        audio.play('land');
        px.shake(1, 90);

        this.state = 'ride';
        this.v = -this.airVy * 0.92 * this.airSide;
        this.s = S_MAX * this.airSide * 0.998;
        this.rotation = 0;
        this.rotSpeed = 0;
        this.grabT = 0;
        this._jumpPeak = 0;
    }

    /** Pico do salto atual — guardado à parte de `bestAir`, que é do run inteiro. */
    airPeakThisJump() { return this._jumpPeak || 0; }
    bestAirThisJump() { return this._jumpPeak || 0; }

    bail() {
        const { audio, px } = this.app;
        this.state = 'bail';
        this.bailT = 1.3;
        this.combo = 0;
        this.rotSpeed = 0;
        audio.play('crash');
        px.shake(4, 260);
        this.float.push('CAIU!', surfaceAt(this.s).x, COPING_Y - 20, 'B', 1100);
    }

    middleLabel() {
        const left = Math.max(0, Math.ceil(this.duration - this.elapsed));
        return this.combo > 1 ? `${left}"  x${this.combo}` : `${left}"`;
    }

    finish(detail) {
        if (this.phase === 'outro' || this.phase === 'done') return;
        this.judges = this.makeJudges(this.rawPoints + this.usedGrabs.size * 40, 1400);
        this.score = this.judgeScore(this.judges);
        this.detail = detail || `${this.tricks} manobras · ${this.usedGrabs.size} grabs diferentes`;
        super.finish(this.detail);
    }

    render() {
        const { px, sprites, scenery, font } = this.app;
        const ctx = px.ctx;

        // céu + prédios tortos atrás do bowl
        ctx.drawImage(scenery.sky, 0, -30);
        ctx.drawImage(scenery.skyline, -60, 40);

        // deck (borda de cima) e concreto do bowl
        px.rect(0, COPING_Y, W, H - COPING_Y, SVC['n']);
        for (let x = 0; x < W; x++) {
            const y = bowlY(x);
            px.rect(x, y, 1, H - y, SVC['o']);
            px.rect(x, y, 1, 2, SVC['p']);
        }
        // sombra que acompanha a curva: mais escura no fundo do bowl, onde bate menos luz
        for (let x = 0; x < W; x++) {
            const y = bowlY(x);
            const depth = (y - COPING_Y) / R;          // 0 no coping, 1 no fundo
            const shade = depth > 0.75 ? 'n' : depth > 0.4 ? 'o' : 'p';
            px.rect(x, y + 2, 1, H - y - 2, SVC[shade]);
        }

        // grafite no fundo
        font.text(ctx, this.tag, CX, FLOOR_Y + 12, { color: 'x', align: 'center', mono: true, alpha: 0.75 });

        // coping (cano metálico nas duas bordas)
        const leftCoping = CX - (HALF_FLAT + R);
        const rightCoping = CX + (HALF_FLAT + R);
        px.rect(leftCoping - 3, COPING_Y - 2, 6, 4, SVC['q']);
        px.rect(rightCoping - 3, COPING_Y - 2, 6, 4, SVC['q']);

        // plateia no deck
        for (let i = 0; i < 4; i++) {
            const x = 18 + i * 22;
            px.blitScreen(sprites.get(`crowd#${i % 4}`), x, COPING_Y);
            px.blitScreen(sprites.get(`cheer#${(i + 1) % 4}`), W - x, COPING_Y);
        }

        // --- skatista ---
        let sx, sy, pose;
        if (this.state === 'air') {
            const pt = surfaceAt(this.s);
            sx = pt.x + this.airSide * Math.min(this.airY * 0.18, 14);
            sy = COPING_Y - this.airY;
            pose = this.grabT > 0 ? 'skateGrab' : 'skateAir';
        } else {
            const pt = surfaceAt(this.s);
            sx = pt.x;
            sy = pt.y;
            pose = this.state === 'bail' ? 'skateBail'
                : Math.abs(this.v) > 240 ? 'skatePump' : 'skateLand';
        }

        const flip = (this.state === 'air' ? this.airSide < 0 : this.v < 0);
        const spinFlip = this.state === 'air' && (((this.rotation % 360) + 360) % 360) > 90 &&
            (((this.rotation % 360) + 360) % 360) < 270;
        const useFlip = spinFlip ? !flip : flip;

        if (this.state !== 'bail') {
            px.blitScreen(sprites.get('deck'), sx, sy + 3);
        }
        px.blitScreen(sprites.get(useFlip ? `${pose}_flip` : pose), sx, sy);

        // rastro de poeira no fundo do bowl
        if (this.state === 'ride' && Math.abs(this.v) > 200 && Math.abs(this.s) < HALF_FLAT) {
            px.blitScreen(sprites.get('spray#0'), sx - Math.sign(this.v) * 10, sy - 1);
        }
    }

    renderOverlay() {
        const { px, font } = this.app;
        panel(px, 4, 18, 74, 24, { fill: '1', border: 'n' });
        font.text(px.ctx, 'IMPULSO', 8, 21, { color: 'o', mono: true });
        bar(px, 8, 32, 66, 5, Math.abs(this.v) / 420, {
            fill: Math.abs(this.v) > MIN_LAUNCH ? 'x' : 'n', glow: 'G', mark: MIN_LAUNCH / 420
        });

        if (this.state === 'air') {
            font.text(px.ctx, `${Math.round(this.airY)} PX`, W / 2, 24, { color: 'A', align: 'center', mono: true });
            if (this.grabName) {
                font.text(px.ctx, this.grabName, W / 2, 34, { color: 'y', align: 'center', mono: true });
            }
        }

        if (this.phase === 'outro' && this.judges) {
            judgePanel(px, font, this.judges, (1.4 - this.phaseT) * 1.6);
        }
    }
}
