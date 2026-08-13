// events/base.js — esqueleto comum das seis provas.
//
// Toda prova tem a mesma espinha: contagem regressiva, um miolo jogável cronometrado e um
// desfecho curto antes de devolver o resultado. Concentrar isso aqui deixa cada módulo de
// gameplay cuidando só da sua mecânica, e garante que as seis se comportem igual em pausa,
// em `prefers-reduced-motion` e na entrega da pontuação.

import { EVENTS } from '../game/config.js';
import { FloatingText, topBar, countdown, controlHint } from '../game/hud.js';
import { clamp } from '../core/util.js';
import { tapped, consumeTap, drawTapCue, drawSparkles } from '../game/kids.js';

const COUNTDOWN_SEC = 2.4;
const OUTRO_SEC = 1.1;
const HINT_SEC = 6;

export class EventBase {
    /**
     * @param {object} app  contexto do jogo ({ px, input, font, sprites, audio, scenery, rng… })
     * @param {string} id   id do evento em config.EVENTS
     */
    constructor(app, id) {
        this.app = app;
        this.id = id;
        this.def = EVENTS[id];
        this.phase = 'countdown';
        this.phaseT = COUNTDOWN_SEC;
        this.elapsed = 0;
        this.score = 0;
        this.detail = '';
        this.judges = null;
        this.result = null;
        this.float = new FloatingText();
        this.hintT = HINT_SEC;
        this.practice = false;
        /** Duração do miolo jogável; cada prova pode sobrescrever em `setup()`. */
        this.duration = 40;
        this.cueReady = false;
        this.cueX = 160;
        this.cueY = 72;
    }

    // --- ganchos que cada prova implementa ---
    setup() {}
    start() {}
    step(_dt) {}
    render() {}
    renderOverlay() {}
    teardown() {}

    /** Rótulo do meio da barra superior (tempo, combo, distância…). */
    middleLabel() {
        return `${Math.max(0, Math.ceil(this.duration - this.elapsed))}"`;
    }

    /** Encerra a prova antes do tempo (wipeout final, chegada, etc.). */
    finish(detail = '') {
        if (this.phase === 'done' || this.phase === 'outro') return;
        this.detail = detail || this.detail;
        this.phase = 'outro';
        this.phaseT = OUTRO_SEC;
    }

    /**
     * Converte pontos brutos de manobra em cinco notas de jurado (0..10).
     * Só as provas com `judged: true` usam isto — é a mesma teatralidade do original:
     * cada jurado tem um viés fixo e pequeno, então as notas nunca saem idênticas.
     */
    makeJudges(rawPoints, reference) {
        const base = clamp((rawPoints / reference) * 10, 0, 10);
        const bias = [0.0, -0.4, 0.35, -0.2, 0.5];
        return bias.map((b) => Math.round(clamp(base + b + (this.app.rng.next() - 0.5) * 0.5, 0, 10) * 10) / 10);
    }

    /** Média dos jurados -> pontuação final na escala do evento. */
    judgeScore(judges) {
        const avg = judges.reduce((a, b) => a + b, 0) / judges.length;
        return Math.round((avg / 10) * this.def.par);
    }

    update(dtMs) {
        const dt = dtMs / 1000;
        this.float.update(dtMs);

        if (this.phase === 'countdown') {
            if (tapped(this.app.input)) {
                consumeTap(this.app.input);
                this.phase = 'play';
                this.phaseT = 0;
                this.start();
                return null;
            }
            this.phaseT -= dt;
            const prev = Math.ceil(this.phaseT + dt);
            const now = Math.ceil(this.phaseT);
            if (now !== prev && now >= 0) this.app.audio.play('tick');
            if (this.phaseT <= 0) {
                this.phase = 'play';
                this.start();
            }
            return null;
        }

        if (this.phase === 'play') {
            this.elapsed += dt;
            this.hintT -= dt;
            this.step(dt);
            if (this.duration > 0 && this.elapsed >= this.duration) this.finish();
            return null;
        }

        if (this.phase === 'outro') {
            this.phaseT -= dt;
            this.step(dt * 0.35);   // o mundo continua vivo, em câmera lenta
            if (this.phaseT <= 0) {
                this.phase = 'done';
                this.result = {
                    score: Math.max(0, Math.round(this.score)),
                    detail: this.detail,
                    judges: this.judges
                };
            }
            return null;
        }

        return this.result;
    }

    draw() {
        this.render();
        topBar(this.app.px, this.app.font, {
            title: this.def.name,
            score: Math.round(this.score),
            middle: this.middleLabel(),
            tint: this.def.tint
        });
        this.float.draw(this.app.px, this.app.font);
        this.renderOverlay();

        if (this.phase === 'countdown') {
            countdown(this.app.px, this.app.font, this.phaseT - 0.2);
        } else if (this.phase === 'play' && this.cueReady) {
            drawTapCue(this.app.px, this.app.font, this.app.sprites, this.cueX, this.cueY, this.elapsed);
            drawSparkles(this.app.px, this.app.sprites, this.cueX, this.cueY, this.elapsed, 4);
        } else if (this.hintT > 0) {
            controlHint(this.app.px, this.app.font, this.def.hint, clamp(this.hintT / 1.2, 0, 1));
        }
    }

    exit() { this.teardown(); }
}
