/** Liga o DOM do HUD e dos overlays ao estado do jogo. */

import { formatTime } from './utils.js';
import { QUEST } from './config.js';

export class Hud {
    constructor() {
        this.els = {
            hud: document.getElementById('hud'),
            score: document.getElementById('scoreValue'),
            crystals: document.getElementById('crystalValue'),
            crystalFill: document.getElementById('crystalFill'),
            lives: document.getElementById('livesValue'),
            cajus: document.getElementById('cajuValue'),
            time: document.getElementById('timeValue'),
            message: document.getElementById('message'),
            fps: document.getElementById('fpsCounter'),
            loading: document.getElementById('loadingOverlay'),
            loadingFill: document.getElementById('loadingFill'),
            loadingText: document.getElementById('loadingText'),
            menu: document.getElementById('menuOverlay'),
            pause: document.getElementById('pauseOverlay'),
            over: document.getElementById('gameOverOverlay'),
            win: document.getElementById('victoryOverlay'),
            error: document.getElementById('errorOverlay'),
            errorText: document.getElementById('errorText'),
            best: document.getElementById('bestScore'),
            overStats: document.getElementById('defeatStats'),
            winStats: document.getElementById('victoryStats'),
            sound: document.getElementById('soundButton'),
            volume: document.getElementById('volumeValue'),
            touch: document.getElementById('touchControls'),
            idolHint: document.getElementById('idolHint')
        };
        this._msgT = 0;
    }

    setLoading(p, text) {
        if (this.els.loadingFill) this.els.loadingFill.style.width = `${Math.round(p * 100)}%`;
        if (text && this.els.loadingText) this.els.loadingText.textContent = text;
    }

    hideLoading() {
        this.els.loading.hidden = true;
    }

    showMenu(best) {
        this.els.hud.hidden = true;
        this.els.menu.hidden = false;
        this.els.pause.hidden = true;
        this.els.over.hidden = true;
        this.els.win.hidden = true;
        if (this.els.best) this.els.best.textContent = best ? String(best) : '—';
    }

    showPlay() {
        this.els.hud.hidden = false;
        this.els.menu.hidden = true;
        this.els.pause.hidden = true;
        this.els.over.hidden = true;
        this.els.win.hidden = true;
    }

    showPause() {
        this.els.pause.hidden = false;
    }

    hidePause() {
        this.els.pause.hidden = true;
    }

    showOver(stats) {
        this.els.over.hidden = false;
        this.els.hud.hidden = true;
        this.els.overStats.innerHTML = statsHtml(stats);
    }

    showWin(stats) {
        this.els.win.hidden = false;
        this.els.hud.hidden = true;
        this.els.winStats.innerHTML = statsHtml(stats);
    }

    showError(text) {
        this.els.error.hidden = false;
        this.els.loading.hidden = true;
        if (text) this.els.errorText.textContent = text;
    }

    setTouch(on) {
        if (this.els.touch) this.els.touch.hidden = !on;
    }

    setMuted(muted) {
        if (this.els.sound) {
            this.els.sound.setAttribute('aria-pressed', muted ? 'false' : 'true');
            this.els.sound.textContent = muted ? '×' : '♪';
        }
    }

    setVolume(v) {
        if (this.els.volume) this.els.volume.textContent = String(Math.round(v * 100));
    }

    message(text) {
        this.els.message.textContent = text;
        this.els.message.dataset.show = 'true';
        this._msgT = 2.5;
    }

    update(state) {
        this.els.score.textContent = String(state.score);
        this.els.crystals.textContent = `${state.crystals}/${QUEST.crystals}`;
        this.els.crystalFill.style.width = `${(state.crystals / QUEST.crystals) * 100}%`;
        this.els.lives.textContent = '●'.repeat(Math.max(0, state.lives)) || '—';
        this.els.cajus.textContent = String(state.cajus);
        this.els.time.textContent = formatTime(state.elapsed);
        if (this.els.idolHint) {
            this.els.idolHint.hidden = state.crystals < QUEST.crystals;
        }
        if (this._msgT > 0) {
            this._msgT -= state.dt || 0.016;
            if (this._msgT <= 0) this.els.message.dataset.show = 'false';
        }
        if (this.els.fps && state.showFps) {
            this.els.fps.hidden = false;
            this.els.fps.textContent = `${state.fps} fps`;
        }
    }
}

function statsHtml(stats) {
    return `
        <div class="stat"><span>Pontos</span><b class="mono">${stats.score}</b></div>
        <div class="stat"><span>Cristais</span><b class="mono">${stats.crystals}/${QUEST.crystals}</b></div>
        <div class="stat"><span>Cajus</span><b class="mono">${stats.cajus}</b></div>
        <div class="stat"><span>Tempo</span><b class="mono">${formatTime(stats.elapsed)}</b></div>
    `;
}
