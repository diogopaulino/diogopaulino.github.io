/**
 * HUD, menus e overlays. Sem lógica 3D aqui.
 */

import { SEEDS } from './config.js';
import { formatTime, formatScore } from './utils.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            alt: $('altValue'),
            zone: $('zoneValue'),
            boost: $('boostFill'),
            speed: $('speedValue'),
            seeds: $('seedValue'),
            combo: $('comboValue'),
            score: $('scoreValue'),
            fps: $('fpsCounter'),
            message: $('message'),
            objective: $('objective'),
            questTag: $('questTag'),
            seedPips: $('seedPips'),
            touch: $('touchControls'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            victory: $('victoryOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            bestScore: $('bestScore'),
            victoryStats: $('victoryStats'),
            startButton: $('startButton'),
            resumeButton: $('resumeButton'),
            pauseMenuButton: $('pauseMenuButton'),
            replayButton: $('replayButton'),
            victoryMenuButton: $('victoryMenuButton')
        };
        this.msgTimer = 0;
        this.buildPips(SEEDS);
    }

    buildPips(n) {
        this.el.seedPips.innerHTML = '';
        for (let i = 0; i < n; i++) {
            this.el.seedPips.appendChild(document.createElement('i'));
        }
    }

    setLoading(p, text) {
        if (text) this.el.loadingText.textContent = text;
        this.el.loadingFill.style.width = `${Math.round(p * 100)}%`;
    }

    hideLoading() {
        this.el.loading.hidden = true;
    }

    fail(message) {
        this.el.errorText.textContent = message;
        this.el.error.hidden = false;
        this.el.loading.hidden = true;
    }

    showMenu() {
        this.el.menu.hidden = false;
        this.el.pause.hidden = true;
        this.el.victory.hidden = true;
        this.el.hud.hidden = true;
    }

    showPlay() {
        this.el.menu.hidden = true;
        this.el.pause.hidden = true;
        this.el.victory.hidden = true;
        this.el.hud.hidden = false;
    }

    showPause() {
        this.el.pause.hidden = false;
    }

    hidePause() {
        this.el.pause.hidden = true;
    }

    showVictory({ seeds, rings, score, seconds }) {
        this.el.victory.hidden = false;
        this.el.victoryStats.innerHTML = `
            <div><dt>Sementes</dt><dd>${seeds}/${SEEDS}</dd></div>
            <div><dt>Anéis</dt><dd>${rings}</dd></div>
            <div><dt>Canto</dt><dd>${formatScore(score)}</dd></div>
            <div><dt>Tempo</dt><dd>${formatTime(seconds)}</dd></div>`;
    }

    setFlight({ alt, zone, speed, boost }) {
        this.el.alt.textContent = `${String(Math.round(alt)).padStart(3, '0')} m`;
        this.el.zone.textContent = zone;
        this.el.speed.textContent = `${String(Math.round(speed)).padStart(2, '0')} kn`;
        this.el.boost.style.width = `${Math.round(boost * 100)}%`;
    }

    setScore({ seeds, combo, score }) {
        this.el.seeds.textContent = `${String(seeds).padStart(2, '0')} / ${SEEDS}`;
        this.el.combo.textContent = `${combo}×`;
        this.el.score.textContent = formatScore(score);
        [...this.el.seedPips.children].forEach((pip, i) => {
            pip.classList.toggle('on', i < seeds);
        });
        if (seeds === 0) {
            this.el.questTag.textContent = 'O vínculo adormecido';
            this.el.objective.textContent = 'Colete as oito sementes e volte à Yva.';
        } else if (seeds < SEEDS) {
            this.el.questTag.textContent = 'As sementes acordam';
            this.el.objective.textContent = `Ainda faltam ${SEEDS - seeds} sementes nos picos.`;
        } else {
            this.el.questTag.textContent = 'A Yva chama';
            this.el.objective.textContent = 'Voe até o coração da árvore-mãe.';
        }
    }

    say(text, ms = 2800) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        clearTimeout(this.msgTimer);
        this.msgTimer = setTimeout(() => {
            this.el.message.dataset.show = 'false';
        }, ms);
    }

    setBest(score) {
        this.el.bestScore.textContent = score ? formatScore(score) : '—';
    }

    setSound(on) {
        this.el.soundButton.setAttribute('aria-pressed', on ? 'true' : 'false');
        this.el.soundButton.textContent = on ? '♪' : '×';
    }

    setFps(n) {
        this.el.fps.textContent = n ? `${n}` : '—';
    }

    setTouchVisible(on) {
        this.el.touch.hidden = !on;
    }
}
