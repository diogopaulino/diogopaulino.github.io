/**
 * HUD: amoras, filhotes, objetivo e overlays.
 */

import { TOTAL_FRIENDS } from './config.js?v=23';

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

    /**
     * Contadores + objetivo curto. O texto segue o mesmo alvo da bússola e do marcador 3D
     * (target.kind: 'berry' | 'friend' | 'home' | 'done'). Só toca no DOM quando muda.
     */
    setStatus({ home, berries, following, target }) {
        this._text(this.el.friendCount, `${home} / ${TOTAL_FRIENDS}`);
        this._text(this.el.berryCount, String(berries));
        this._text(this.el.followCount, String(following));
        const pips = this.el.friendPips.children;
        for (let i = 0; i < pips.length; i++) pips[i].classList.toggle('on', i < home);

        let tag;
        let text;
        const kind = target?.kind;
        if (home >= TOTAL_FRIENDS || kind === 'done') {
            tag = 'Piquenique!';
            text = 'Todos chegaram. A festa é no ninho.';
        } else if (kind === 'home') {
            tag = 'Fila fofa';
            text = following === 1 ? 'Leve seu amigo ao ninho do piquenique.' : `Leve os ${following} amigos ao ninho do piquenique.`;
        } else if (kind === 'berry') {
            tag = home === 0 && following === 0 ? 'O vale acordou' : 'Falta amora';
            text = 'Pegue uma amora 🫐 — siga a seta.';
        } else if (kind === 'friend') {
            tag = following ? 'Mais um aqui perto!' : 'Filhote perdido';
            text = `Encoste n${target.ref.hint.startsWith('a ') ? 'a' : 'o'}${target.ref.hint.slice(1)}.`;
        } else {
            tag = 'Filhotes perdidos';
            text = 'Siga a seta dourada.';
        }
        this._text(this.el.questTag, tag);
        this._text(this.el.objective, text);
    }

    _text(el, value) {
        if (el.textContent !== value) el.textContent = value;
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
            <div><dt>Filhotes</dt><dd>${home}/${TOTAL_FRIENDS}</dd></div>
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
