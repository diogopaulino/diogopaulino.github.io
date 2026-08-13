/**
 * Camada de interface: tudo que é DOM (HUD, menus, overlays) vive aqui,
 * separado da lógica 3D.
 */

import { formatTime } from './utils.js';
import { DIFFICULTY } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            hullPips: $('hullPips'),
            hullPanel: document.querySelector('.hull-panel'),
            furyFill: $('furyFill'),
            distance: $('distanceValue'),
            progressFill: $('progressFill'),
            progressBoat: $('progressBoat'),
            score: $('scoreValue'),
            combo: $('comboBadge'),
            time: $('timeValue'),
            bossPanel: $('bossPanel'),
            bossFill: $('bossFill'),
            message: $('message'),
            hitFlash: $('hitFlash'),
            fps: $('fpsCounter'),
            touch: $('touchControls'),
            steerZone: $('steerZone'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),
            reticle: $('reticle'),
            reticleLabel: $('reticleLabel'),
            throwFill: $('throwFill'),

            loading: $('loadingOverlay'),
            loadingFill: $('loadingFill'),
            loadingText: $('loadingText'),
            menu: $('menuOverlay'),
            pause: $('pauseOverlay'),
            gameOver: $('gameOverOverlay'),
            victory: $('victoryOverlay'),
            error: $('errorOverlay'),
            errorText: $('errorText'),

            difficultyOptions: $('difficultyOptions'),
            difficultyBlurb: $('difficultyBlurb'),
            qualitySelect: $('qualitySelect'),
            volumeSlider: $('volumeSlider'),
            volumeValue: $('volumeValue'),
            bestScore: $('bestScore'),
            defeatStats: $('defeatStats'),
            victoryStats: $('victoryStats')
        };

        this.pipCount = 0;
        this.messageTimer = null;
        this.flashTimer = null;
        this.lastScore = -1;
    }

    /* ------------------------------ estado ------------------------------ */

    setState(state) {
        document.body.dataset.state = state;
    }

    showHud(visible) {
        this.el.hud.hidden = !visible;
    }

    setTouchVisible(visible) {
        this.el.touch.hidden = !visible;
    }

    setLoading(progress, text) {
        if (text) this.el.loadingText.textContent = text;
        this.el.loadingFill.style.width = `${Math.round(progress * 100)}%`;
    }

    hideLoading() {
        this.el.loading.hidden = true;
    }

    showError(message) {
        if (message) this.el.errorText.textContent = message;
        this.el.error.hidden = false;
        this.el.loading.hidden = true;
    }

    /* ------------------------------ HUD --------------------------------- */

    buildPips(max) {
        if (this.pipCount === max) return;
        this.pipCount = max;
        this.el.hullPips.innerHTML = '';
        for (let i = 0; i < max; i++) {
            const pip = document.createElement('span');
            pip.className = 'pip';
            this.el.hullPips.appendChild(pip);
        }
    }

    setHull(value, max) {
        this.buildPips(max);
        const pips = this.el.hullPips.children;
        for (let i = 0; i < pips.length; i++) {
            pips[i].dataset.empty = String(i >= value);
        }
    }

    setFury(ratio, active) {
        this.el.furyFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
        this.el.hullPanel.dataset.fury = String(Boolean(active));
    }

    setProgress(ratio, metersLeft) {
        const pct = Math.max(0, Math.min(1, ratio)) * 100;
        this.el.progressFill.style.width = `${pct}%`;
        this.el.progressBoat.style.left = `${pct}%`;
        this.el.distance.textContent = `${Math.max(0, Math.round(metersLeft))} m`;
    }

    setScore(score) {
        const rounded = Math.round(score);
        if (rounded === this.lastScore) return;
        this.lastScore = rounded;
        this.el.score.textContent = rounded.toLocaleString('pt-BR');
    }

    setCombo(multiplier) {
        const active = multiplier > 1.01;
        this.el.combo.textContent = `x${multiplier.toFixed(1)}`;
        this.el.combo.dataset.active = String(active);
    }

    setTime(seconds) {
        this.el.time.textContent = formatTime(seconds);
    }

    setFps(fps) {
        this.el.fps.textContent = `${Math.round(fps)} fps`;
    }

    showBoss(show) {
        this.el.bossPanel.hidden = !show;
    }

    setBossHealth(ratio) {
        this.el.bossFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }

    message(text, tone = 'default', duration = 2600) {
        const el = this.el.message;
        el.textContent = text;
        el.dataset.tone = tone;
        el.dataset.show = 'true';
        clearTimeout(this.messageTimer);
        if (duration > 0) {
            this.messageTimer = setTimeout(() => {
                el.dataset.show = 'false';
            }, duration);
        }
    }

    clearMessage() {
        clearTimeout(this.messageTimer);
        this.el.message.dataset.show = 'false';
    }

    flash(tone = 'danger') {
        const el = this.el.hitFlash;
        el.dataset.tone = tone;
        el.dataset.show = 'true';
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => {
            el.dataset.show = 'false';
        }, 90);
    }

    /** Mira: trava visual quando há torre/inimigo no cone. */
    setAim(lock) {
        if (!this.el.reticle) return;
        const locked = Boolean(lock);
        this.el.reticle.dataset.lock = String(locked);
        if (!this.el.reticleLabel) return;
        if (!locked) {
            this.el.reticleLabel.textContent = '';
            return;
        }
        const labels = { towers: 'Torre', enemyShips: 'Navio', barricades: 'Barricada' };
        this.el.reticleLabel.textContent = labels[lock.kind] || 'Alvo';
    }

    /** 0 = recarregando, 1 = canhão pronto. */
    setThrowReady(ratio) {
        if (!this.el.throwFill) return;
        this.el.throwFill.style.width = `${Math.max(0, Math.min(1, ratio)) * 100}%`;
    }

    /* ---------------------------- overlays ------------------------------ */

    hideOverlays() {
        this.el.menu.hidden = true;
        this.el.pause.hidden = true;
        this.el.gameOver.hidden = true;
        this.el.victory.hidden = true;
    }

    showMenu() {
        this.hideOverlays();
        this.el.menu.hidden = false;
    }

    showPause() {
        this.el.pause.hidden = false;
    }

    hidePause() {
        this.el.pause.hidden = true;
    }

    showGameOver(stats) {
        this.hideOverlays();
        this.el.defeatStats.innerHTML = this._statsMarkup(stats);
        this.el.gameOver.hidden = false;
    }

    showVictory(stats) {
        this.hideOverlays();
        this.el.victoryStats.innerHTML = this._statsMarkup(stats);
        this.el.victory.hidden = false;
    }

    _statsMarkup(stats) {
        return stats
            .map(
                (s) => `<div class="stat${s.gold ? ' stat--gold' : ''}">
                    <span>${s.label}</span>
                    <strong>${s.value}</strong>
                </div>`
            )
            .join('');
    }

    /* ----------------------------- menu --------------------------------- */

    buildDifficulties(current, onSelect) {
        const wrap = this.el.difficultyOptions;
        wrap.innerHTML = '';
        Object.values(DIFFICULTY).forEach((diff) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'chip';
            chip.textContent = diff.label;
            chip.setAttribute('role', 'radio');
            chip.setAttribute('aria-checked', String(diff.id === current));
            chip.addEventListener('click', () => {
                wrap.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
                chip.setAttribute('aria-checked', 'true');
                this.el.difficultyBlurb.textContent = diff.blurb;
                onSelect(diff.id);
            });
            wrap.appendChild(chip);
        });
        this.el.difficultyBlurb.textContent = DIFFICULTY[current].blurb;
    }

    setBestScore(value) {
        this.el.bestScore.textContent = value ? Math.round(value).toLocaleString('pt-BR') : '—';
    }

    setSoundButton(enabled) {
        this.el.soundButton.setAttribute('aria-pressed', String(enabled));
        this.el.soundButton.textContent = enabled ? '♪' : '✕';
    }
}
