/**
 * HUD cinematográfico: vida, objetivo, interação, diálogo, stealth.
 */

export class HUD {
    constructor() {
        this.el = {
            hud: document.getElementById('hud'),
            hearts: document.getElementById('hearts'),
            objective: document.getElementById('objective'),
            prompt: document.getElementById('prompt'),
            dialogue: document.getElementById('dialogue'),
            speaker: document.getElementById('speaker'),
            line: document.getElementById('line'),
            stealth: document.getElementById('stealth'),
            stealthFill: document.getElementById('stealthFill'),
            toast: document.getElementById('toast'),
            chapter: document.getElementById('chapterCard'),
            chapterTitle: document.getElementById('chapterTitle'),
            fade: document.getElementById('fade'),
            loading: document.getElementById('loadingOverlay'),
            loadingFill: document.getElementById('loadingFill'),
            loadingPct: document.getElementById('loadingPct'),
            fps: document.getElementById('fpsCounter')
        };
        this._toastT = 0;
        this._chapterT = 0;
        /* Em telas de toque o prompt aponta o botão da tela, não a tecla E. */
        this.isTouch = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
    }

    setLoading(p, text) {
        if (this.el.loadingFill) this.el.loadingFill.style.width = `${Math.round(p * 100)}%`;
        if (this.el.loadingPct) this.el.loadingPct.textContent = `${Math.round(p * 100)}%`;
        if (text) {
            const t = document.getElementById('loadingText');
            if (t) t.textContent = text;
        }
    }

    hideLoading() {
        this.el.loading.hidden = true;
    }

    showHud(v) {
        this.el.hud.hidden = !v;
    }

    setHealth(hp, max) {
        this.el.hearts.innerHTML = '';
        for (let i = 0; i < max; i++) {
            const s = document.createElement('span');
            s.className = 'heart' + (i < hp ? '' : ' is-empty');
            s.textContent = '❤';
            this.el.hearts.appendChild(s);
        }
    }

    showObjective(text, urgent = false) {
        this.el.objective.textContent = text;
        this.el.objective.dataset.urgent = urgent ? 'true' : 'false';
        this.el.objective.parentElement.classList.add('is-flash');
        setTimeout(() => this.el.objective.parentElement.classList.remove('is-flash'), 2400);
    }

    setPrompt(item) {
        if (!item) {
            this.el.prompt.hidden = true;
            return;
        }
        this.el.prompt.hidden = false;
        const key = this.isTouch ? 'Botão E' : '<kbd>E</kbd>';
        this.el.prompt.innerHTML = `${key} ${item.interactionLabel || 'Interagir'}`;
    }

    setDialogue(line) {
        if (!line) {
            this.el.dialogue.hidden = true;
            return;
        }
        this.el.dialogue.hidden = false;
        this.el.speaker.textContent = line.speaker;
        this.el.line.textContent = line.text;
    }

    showStealth(on, amount = 0) {
        this.el.stealth.hidden = !on;
        if (this.el.stealthFill) this.el.stealthFill.style.width = `${Math.round(amount * 100)}%`;
        this.el.stealth.dataset.danger = amount > 0.65 ? 'true' : 'false';
    }

    showToast(text) {
        this.el.toast.hidden = false;
        this.el.toast.textContent = text;
        this._toastT = 3.2;
    }

    showChapter(title, sub) {
        this.el.chapter.hidden = false;
        this.el.chapterTitle.textContent = title;
        const s = document.getElementById('chapterSub');
        if (s) s.textContent = sub || '';
        this._chapterT = 3.5;
    }

    setFade(v) {
        this.el.fade.style.opacity = String(v);
    }

    setFps(n) {
        if (this.el.fps) this.el.fps.textContent = `${n} fps`;
    }

    flashStealth(text) {
        if (text) this.showToast(text);
    }

    update(dt) {
        if (this._toastT > 0) {
            this._toastT -= dt;
            if (this._toastT <= 0) this.el.toast.hidden = true;
        }
        if (this._chapterT > 0) {
            this._chapterT -= dt;
            if (this._chapterT <= 0) this.el.chapter.hidden = true;
        }
    }
}
