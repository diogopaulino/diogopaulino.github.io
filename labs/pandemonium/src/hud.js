/**
 * Camada DOM: HUD, menus e overlays — nada de three.js aqui.
 */

import { DIFFICULTY } from './config.js';

const $ = (id) => document.getElementById(id);

export class Hud {
    constructor() {
        this.el = {
            hud: $('hud'),
            lifePips: $('lifePips'),
            gems: $('gemsValue'),
            score: $('scoreValue'),
            combo: $('comboBadge'),
            distance: $('distanceValue'),
            progressFill: $('progressFill'),
            progressHero: $('progressHero'),
            message: $('message'),
            hitFlash: $('hitFlash'),
            fps: $('fpsCounter'),
            touch: $('touchControls'),
            soundButton: $('soundButton'),
            pauseButton: $('pauseButton'),

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
        this.lastGems = -1;
    }

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

    setLives(value, max) {
        if (this.pipCount !== max) {
            this.pipCount = max;
            this.el.lifePips.innerHTML = '';
            for (let i = 0; i < max; i++) {
                const pip = document.createElement('span');
                pip.className = 'pip';
                this.el.lifePips.appendChild(pip);
            }
        }
        const pips = this.el.lifePips.children;
        for (let i = 0; i < pips.length; i++) {
            pips[i].dataset.empty = String(i >= value);
        }
    }

    setGems(n) {
        if (n === this.lastGems) return;
        this.lastGems = n;
        this.el.gems.textContent = n;
    }

    setScore(score) {
        const rounded = Math.round(score);
        if (rounded === this.lastScore) return;
        this.lastScore = rounded;
        this.el.score.textContent = rounded.toLocaleString('pt-BR');
    }

    setCombo(multiplier) {
        const active = multiplier > 1.01;
        this.el.combo.textContent = `x${multiplier.toFixed(0)}`;
        this.el.combo.dataset.active = String(active);
    }

    setProgress(ratio) {
        const pct = Math.max(0, Math.min(1, ratio)) * 100;
        this.el.progressFill.style.width = `${pct}%`;
        this.el.progressHero.style.left = `${pct}%`;
        this.el.distance.textContent = `${Math.round(pct)}%`;
    }

    setFps(fps) {
        this.el.fps.hidden = false;
        this.el.fps.textContent = `${Math.round(fps)} fps`;
    }

    message(text, tone = 'default', duration = 2400) {
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

    flash(tone = 'danger') {
        const el = this.el.hitFlash;
        el.dataset.tone = tone;
        el.dataset.show = 'true';
        clearTimeout(this.flashTimer);
        this.flashTimer = setTimeout(() => {
            el.dataset.show = 'false';
        }, 90);
    }

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
