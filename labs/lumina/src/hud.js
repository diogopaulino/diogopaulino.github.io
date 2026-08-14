/**
 * Ligação da HUD com o DOM — pips de desejos, mensagens e overlays.
 */

export class Hud {
    constructor() {
        this.el = {
            hud: document.getElementById('hud'),
            wishPips: document.getElementById('wishPips'),
            wishCount: document.getElementById('wishCount'),
            lanternCount: document.getElementById('lanternCount'),
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
            touch: document.getElementById('touchControls')
        };
        this._msgTimer = 0;
        this.buildPips(8);
    }

    buildPips(n) {
        this.el.wishPips.innerHTML = '';
        for (let i = 0; i < n; i++) {
            this.el.wishPips.appendChild(document.createElement('i'));
        }
    }

    setWishes(have, total) {
        this.el.wishCount.textContent = `${have} / ${total}`;
        [...this.el.wishPips.children].forEach((pip, i) => {
            pip.classList.toggle('on', i < have);
        });
        if (have === 0) {
            this.el.questTag.textContent = 'O reino adormecido';
            this.el.objective.textContent = 'Colete os oito desejos e acenda Lúmina.';
        } else if (have < total) {
            this.el.questTag.textContent = 'As lanternas acordam';
            this.el.objective.textContent = `Ainda faltam ${total - have} desejos pelo reino.`;
        } else {
            this.el.questTag.textContent = 'Lúmina brilha';
            this.el.objective.textContent = 'O castelo acendeu. Solte lanternas e celebre.';
        }
    }

    setLanterns(n) {
        this.el.lanternCount.textContent = String(n);
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

    showVictory({ wishes, lanterns, seconds }) {
        this.el.victory.hidden = false;
        const m = Math.floor(seconds / 60);
        const s = String(Math.floor(seconds % 60)).padStart(2, '0');
        this.el.victoryStats.innerHTML = `
            <div><dt>Desejos</dt><dd>${wishes}/8</dd></div>
            <div><dt>Lanternas</dt><dd>${lanterns}</dd></div>
            <div><dt>Tempo</dt><dd>${m}:${s}</dd></div>
            <div><dt>Luz</dt><dd>100%</dd></div>`;
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
