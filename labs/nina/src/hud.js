/**
 * HUD: amoras, filhotes, objetivo e overlays.
 */

import { TOTAL_FRIENDS } from './config.js?v=20';

export class Hud {
    constructor() {
        this.el = {
            hud: document.getElementById('hud'),
            friendPips: document.getElementById('friendPips'),
            friendCount: document.getElementById('friendCount'),
            berryCount: document.getElementById('berryCount'),
            followCount: document.getElementById('followCount'),
            objective: document.getElementById('objective'),
            questTag: document.getElementById('questTag'),
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
            touch: document.getElementById('touchControls'),
            guideArrow: document.getElementById('guideArrow'),
            guideDist: document.getElementById('guideDist')
        };
        this._msgTimer = 0;
        this._guide = { deg: NaN, dist: NaN };
        this.buildPips(TOTAL_FRIENDS);
    }

    buildPips(n) {
        this.el.friendPips.innerHTML = '';
        for (let i = 0; i < n; i++) {
            this.el.friendPips.appendChild(document.createElement('i'));
        }
    }

    setStatus({ home, berries, following, hint }) {
        this.el.friendCount.textContent = `${home} / ${TOTAL_FRIENDS}`;
        this.el.berryCount.textContent = String(berries);
        this.el.followCount.textContent = String(following);
        [...this.el.friendPips.children].forEach((pip, i) => {
            pip.classList.toggle('on', i < home);
        });
        if (home === 0 && following === 0) {
            this.el.questTag.textContent = 'O vale acordou';
            this.el.objective.textContent = berries < 1 ? 'Pegue uma amora 🫐 (siga a seta).' : `Leve a amora para ${hint}.`;
        } else if (home < TOTAL_FRIENDS) {
            this.el.questTag.textContent = following ? 'Fila fofa' : 'Filhotes perdidos';
            this.el.objective.textContent = following
                ? `Leve ${following === 1 ? 'o amigo' : 'os amigos'} ao ninho do piquenique.`
                : berries < 1 ? 'Pegue uma amora 🫐 (siga a seta).' : `Encontre ${hint}.`;
        } else {
            this.el.questTag.textContent = 'Piquenique!';
            this.el.objective.textContent = 'Todos chegaram. A festa é no ninho.';
        }
    }

    /**
     * Bússola do próximo alvo. `deg` = ângulo na tela (0 = para a frente da câmera, positivo =
     * horário); dist em metros (null esconde). Só escreve no DOM quando muda (5° / 1 m).
     */
    setGuide(deg, dist) {
        const g = this._guide;
        const q = dist == null ? NaN : Math.round(deg / 5) * 5;
        if (q !== g.deg && !(Number.isNaN(q) && Number.isNaN(g.deg))) {
            g.deg = q;
            // a seta ➤ aponta para a direita: −90° deixa 0° apontando para cima
            this.el.guideArrow.style.transform = Number.isNaN(q) ? '' : `rotate(${q - 90}deg)`;
        }
        const m = dist == null ? -1 : Math.round(dist);
        if (m !== g.dist) {
            g.dist = m;
            this.el.guideDist.textContent = m < 0 ? '♥' : m < 3 ? 'aqui!' : `${m} m`;
        }
    }

    say(text, ms = 2800) {
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

    showVictory({ home, berries, seconds }) {
        this.el.victory.hidden = false;
        const m = Math.floor(seconds / 60);
        const s = String(Math.floor(seconds % 60)).padStart(2, '0');
        this.el.victoryStats.innerHTML = `
            <div><dt>Filhotes</dt><dd>${home}/7</dd></div>
            <div><dt>Amoras</dt><dd>${berries}</dd></div>
            <div><dt>Tempo</dt><dd>${m}:${s}</dd></div>
            <div><dt>Festa</dt><dd>100%</dd></div>`;
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
