/**
 * Ligação da HUD com o DOM — pips das marés, mensagens e overlays.
 */

import { TOTAL_TIDES } from './config.js';

export class Hud {
    constructor() {
        this.el = {
            hud: document.getElementById('hud'),
            tidePips: document.getElementById('tidePips'),
            tideCount: document.getElementById('tideCount'),
            objective: document.getElementById('objective'),
            questTag: document.getElementById('questTag'),
            depthValue: document.getElementById('depthValue'),
            message: document.getElementById('message'),
            soundButton: document.getElementById('soundButton'),
            pauseButton: document.getElementById('pauseButton'),
            loading: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            loadingFill: document.getElementById('loadingFill'),
            menu: document.getElementById('menuOverlay'),
            pause: document.getElementById('pauseOverlay'),
            victory: document.getElementById('victoryOverlay'),
            error: document.getElementById('errorOverlay'),
            errorText: document.getElementById('errorText'),
            qualitySelect: document.getElementById('qualitySelect'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            bestScore: document.getElementById('bestScore'),
            victoryStats: document.getElementById('victoryStats'),
            touch: document.getElementById('touchControls')
        };
        this._msgTimer = 0;
        this.buildPips(TOTAL_TIDES);
    }

    buildPips(n) {
        this.el.tidePips.innerHTML = '';
        for (let i = 0; i < n; i++) {
            this.el.tidePips.appendChild(document.createElement('i'));
        }
    }

    setTides(have, total) {
        this.el.tideCount.textContent = `${have} / ${total}`;
        [...this.el.tidePips.children].forEach((pip, i) => {
            pip.classList.toggle('on', i < have);
        });
        if (have === 0) {
            this.el.questTag.textContent = 'O santuário dorme';
            this.el.objective.textContent = 'Deslize até as sete luzes-maré e acorde Nereida.';
        } else if (have < total) {
            this.el.questTag.textContent = 'A maré acorda';
            this.el.objective.textContent = `Ainda faltam ${total - have} luzes no recife.`;
        } else {
            this.el.questTag.textContent = 'Calmaria';
            this.el.objective.textContent = 'A baleia canta. Fique, se quiser.';
        }
    }

    setDepth(y, surface) {
        const meters = Math.max(0, surface - y);
        this.el.depthValue.textContent = `${meters.toFixed(1)} m`;
    }

    say(text, ms = 3000) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        clearTimeout(this._msgTimer);
        this._msgTimer = setTimeout(() => {
            this.el.message.dataset.show = 'false';
        }, ms);
    }

    setLoading(t, label) {
        this.el.loadingFill.style.width = `${Math.round(t * 100)}%`;
        if (label) this.el.loadingText.textContent = label;
    }

    hideLoading() {
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

    showVictory({ tides, pings, seconds }) {
        this.el.victory.hidden = false;
        const m = Math.floor(seconds / 60);
        const s = String(Math.floor(seconds % 60)).padStart(2, '0');
        this.el.victoryStats.innerHTML = `
            <div><dt>Luzes</dt><dd>${tides}/7</dd></div>
            <div><dt>Sonares</dt><dd>${pings}</dd></div>
            <div><dt>Tempo</dt><dd>${m}:${s}</dd></div>
            <div><dt>Maré</dt><dd>cheia</dd></div>`;
    }

    setBest(score) {
        this.el.bestScore.textContent = score ?? '—';
    }

    setSound(on) {
        this.el.soundButton.setAttribute('aria-pressed', on ? 'true' : 'false');
        this.el.soundButton.textContent = on ? '♪' : '×';
    }

    setTouchVisible(on) {
        this.el.touch.hidden = !on;
    }

    fail(message) {
        this.el.errorText.textContent = message;
        this.el.error.hidden = false;
        this.el.loading.hidden = true;
    }
}
