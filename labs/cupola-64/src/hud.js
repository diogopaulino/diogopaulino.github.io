/**
 * HUD estilo cartucho — estrelas, moedas, vidas e a fanfarra da estrela.
 */

import { formatTime } from './utils.js';
import { QUEST } from './config.js';

export class Hud {
    constructor() {
        this.el = {
            hud: document.getElementById('hud'),
            stars: document.getElementById('starValue'),
            coins: document.getElementById('coinValue'),
            reds: document.getElementById('redValue'),
            lives: document.getElementById('livesValue'),
            objective: document.getElementById('objective'),
            questTag: document.getElementById('questTag'),
            message: document.getElementById('message'),
            starGet: document.getElementById('starGet'),
            starGetTitle: document.getElementById('starGetTitle'),
            soundButton: document.getElementById('soundButton'),
            pauseButton: document.getElementById('pauseButton'),
            loading: document.getElementById('loadingOverlay'),
            loadingText: document.getElementById('loadingText'),
            loadingFill: document.getElementById('loadingFill'),
            menu: document.getElementById('menuOverlay'),
            pause: document.getElementById('pauseOverlay'),
            victory: document.getElementById('victoryOverlay'),
            over: document.getElementById('gameOverOverlay'),
            error: document.getElementById('errorOverlay'),
            errorText: document.getElementById('errorText'),
            qualitySelect: document.getElementById('qualitySelect'),
            volumeSlider: document.getElementById('volumeSlider'),
            volumeValue: document.getElementById('volumeValue'),
            bestScore: document.getElementById('bestScore'),
            victoryStats: document.getElementById('victoryStats'),
            overStats: document.getElementById('defeatStats'),
            touch: document.getElementById('touchControls')
        };
        this._msgTimer = 0;
    }

    setStats({ stars, coins, reds, lives }) {
        this.el.stars.textContent = `${stars}/${QUEST.stars}`;
        this.el.coins.textContent = String(coins).padStart(3, '0');
        this.el.reds.textContent = `${reds}/${QUEST.redCoins}`;
        this.el.lives.textContent = `×${lives}`;
        if (stars === 0) {
            this.el.questTag.textContent = 'Ilha da Cúpola';
            this.el.objective.textContent = 'Colete as sete estrelas do vitral.';
        } else if (stars < QUEST.stars) {
            this.el.questTag.textContent = 'As estrelas acordam';
            this.el.objective.textContent = `Faltam ${QUEST.stars - stars} estrelas na ilha.`;
        } else {
            this.el.questTag.textContent = 'Cúpola completa';
            this.el.objective.textContent = 'O vitral brilha de novo.';
        }
    }

    say(text, ms = 2600) {
        this.el.message.textContent = text;
        this.el.message.dataset.show = 'true';
        clearTimeout(this._msgTimer);
        this._msgTimer = setTimeout(() => {
            this.el.message.dataset.show = 'false';
        }, ms);
    }

    showStarGet(title) {
        this.el.starGetTitle.textContent = title;
        this.el.starGet.hidden = false;
        this.el.starGet.dataset.show = 'true';
        setTimeout(() => {
            this.el.starGet.dataset.show = 'false';
            setTimeout(() => {
                this.el.starGet.hidden = true;
            }, 400);
        }, 2200);
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
        this.el.over.hidden = true;
        this.el.hud.hidden = true;
    }

    showPlay() {
        this.el.menu.hidden = true;
        this.el.pause.hidden = true;
        this.el.victory.hidden = true;
        this.el.over.hidden = true;
        this.el.hud.hidden = false;
    }

    showPause() {
        this.el.pause.hidden = false;
    }

    hidePause() {
        this.el.pause.hidden = true;
    }

    showVictory({ stars, coins, seconds }) {
        this.el.victory.hidden = false;
        this.el.victoryStats.innerHTML = `
            <div><dt>Estrelas</dt><dd>${stars}/${QUEST.stars}</dd></div>
            <div><dt>Moedas</dt><dd>${coins}</dd></div>
            <div><dt>Tempo</dt><dd>${formatTime(seconds)}</dd></div>
            <div><dt>Vitral</dt><dd>100%</dd></div>`;
    }

    showOver({ stars, coins, seconds }) {
        this.el.over.hidden = false;
        this.el.overStats.innerHTML = `
            <div><dt>Estrelas</dt><dd>${stars}/${QUEST.stars}</dd></div>
            <div><dt>Moedas</dt><dd>${coins}</dd></div>
            <div><dt>Tempo</dt><dd>${formatTime(seconds)}</dd></div>`;
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
