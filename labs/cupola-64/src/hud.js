/**
 * HUD do platformer — estrelas, moedas, vidas e a fanfarra da estrela.
 */

import { formatTime } from './utils.js?v=13';
import { QUEST } from './config.js?v=13';

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
            touch: document.getElementById('touchControls'),
            guideArrow: document.getElementById('guideArrow'),
            guideDist: document.getElementById('guideDist')
        };
        this._msgTimer = 0;
        this._guide = { deg: NaN, dist: NaN, title: '', hint: '' };
    }

    /**
     * Bússola da próxima estrela. `deg` = ângulo na tela (0 = para a frente da câmera,
     * positivo = horário). Só escreve no DOM quando muda (5° / 1 m / texto).
     */
    setGuide(deg, dist, title, hint) {
        const g = this._guide;
        const q = Math.round(deg / 5) * 5;
        if (q !== g.deg) {
            g.deg = q;
            // a seta ➤ aponta para a direita: −90° deixa 0° apontando para cima
            this.el.guideArrow.style.transform = `rotate(${q - 90}deg)`;
        }
        const m = Math.round(dist);
        if (m !== g.dist) {
            g.dist = m;
            this.el.guideDist.textContent = m < 3 ? 'aqui!' : `${m} m`;
        }
        if (title !== g.title) {
            g.title = title;
            this.el.questTag.textContent = title;
        }
        if (hint !== g.hint) {
            g.hint = hint;
            this.el.objective.textContent = hint;
        }
    }

    setStats({ stars, coins, reds, lives }) {
        // chamado a cada quadro: só toca no DOM quando algum número muda
        const key = stars * 1e6 + coins * 1e3 + reds * 10 + lives;
        if (key === this._statsKey) return;
        this._statsKey = key;
        this.el.stars.textContent = `${stars}/${QUEST.stars}`;
        this.el.coins.textContent = String(coins).padStart(3, '0');
        this.el.reds.textContent = `${reds}/${QUEST.redCoins}`;
        this.el.lives.textContent = `×${lives}`;
        // título e dica do painel vêm da bússola (setGuide); aqui só o caso "tudo pronto"
        if (stars >= QUEST.stars) {
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
