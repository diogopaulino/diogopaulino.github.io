/** Liga o DOM do HUD e dos overlays ao estado do jogo. */

import { formatTime } from './utils.js';
import { QUEST } from './config.js';

export class Hud {
    constructor() {
        this.els = {
            hud: document.getElementById('hud'),
            score: document.getElementById('scoreValue'),
            disks: document.getElementById('diskValue'),
            diskFill: document.getElementById('diskFill'),
            lives: document.getElementById('livesValue'),
            time: document.getElementById('timeValue'),
            combo: document.getElementById('comboBadge'),
            message: document.getElementById('message'),
            toastFill: document.getElementById('toastFill'),
            bossPanel: document.getElementById('bossPanel'),
            bossFill: document.getElementById('bossFill'),
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
            touch: document.getElementById('touchControls')
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
        this._msgT = 2.4;
    }

    update(state) {
        this.els.score.textContent = String(state.score);
        this.els.disks.textContent = `${state.disks}/${QUEST.disksToBoss}`;
        this.els.diskFill.style.width = `${(state.disks / QUEST.disksToBoss) * 100}%`;
        this.els.lives.innerHTML = '🍞'.repeat(Math.max(0, state.lives)) || '—';
        this.els.time.textContent = formatTime(state.elapsed);
        this.els.combo.textContent = `x${state.combo.toFixed(1)}`;
        this.els.combo.dataset.active = state.combo > 1.05 ? 'true' : 'false';
        this.els.toastFill.style.transform = `scaleX(${state.coolReady})`;
        if (state.boss) {
            this.els.bossPanel.hidden = false;
            this.els.bossFill.style.width = `${(state.bossHp / state.bossMax) * 100}%`;
        } else {
            this.els.bossPanel.hidden = true;
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
        <div class="stat"><span>Disquetes</span><b class="mono">${stats.disks}</b></div>
        <div class="stat"><span>Torradas certeiras</span><b class="mono">${stats.kills}</b></div>
        <div class="stat"><span>Tempo</span><b class="mono">${formatTime(stats.elapsed)}</b></div>
    `;
}
