/**
 * HUD cinematográfico: vida, objetivo, interação, diálogo, stealth, FPS (só com ?debug).
 * Vida em corações com meio-coração (defesa tira 0,35; flecha no convés 0,5): cada
 * coração mostra a fração que resta, arredondada a meio. Golpe recebido: flash vermelho
 * nas bordas da tela (desligado com prefers-reduced-motion, fica só o tremor reduzido).
 */

export class HUD {
    constructor(game) {
        this.game = game;
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
            chapterSub: document.getElementById('chapterSub'),
            fade: document.getElementById('fade'),
            loading: document.getElementById('loadingOverlay'),
            loadingFill: document.getElementById('loadingFill'),
            loadingPct: document.getElementById('loadingPct'),
            fps: document.getElementById('fpsCounter'),
            hurt: document.getElementById('hurtFlash')
        };
        this.debug = new URLSearchParams(location.search).has('debug');
        if (this.debug) document.body.dataset.debug = 'true';
        this._hearts = [];
        this._toastT = 0;
        this._chapterT = 0;
        this.isTouch = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
        this.lastHp = -1;
    }

    show() {
        if (this.el.hud) this.el.hud.hidden = false;
        document.body.dataset.playing = 'true';
    }

    hide() {
        if (this.el.hud) this.el.hud.hidden = true;
        delete document.body.dataset.playing;
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
        if (this.el.loading) this.el.loading.hidden = true;
    }

    setHealth(hp, max = 5) {
        /* meio-coração: arredonda a vida para 0,5 */
        const shown = Math.round(hp * 2) / 2;
        if (this.lastHp === shown) return;
        const lost = this.lastHp > shown;
        this.lastHp = shown;
        const box = this.el.hearts;
        if (!box) return;
        while (this._hearts.length < max) {
            const s = document.createElement('span');
            s.className = 'heart';
            s.textContent = '❤';
            box.appendChild(s);
            this._hearts.push(s);
        }
        for (let i = 0; i < this._hearts.length; i++) {
            const frac = Math.max(0, Math.min(1, shown - i));
            const h = this._hearts[i];
            h.classList.toggle('is-empty', frac <= 0);
            h.classList.toggle('is-half', frac > 0 && frac < 1);
        }
        box.setAttribute('aria-label', `Vida: ${shown} de ${max}`);
        if (lost) {
            box.classList.remove('is-hurt');
            void box.offsetWidth;
            box.classList.add('is-hurt');
        }
    }

    /** Flash vermelho nas bordas ao levar um golpe. */
    flashHurt() {
        const el = this.el.hurt;
        if (!el) return;
        el.classList.remove('is-on');
        void el.offsetWidth;
        el.classList.add('is-on');
    }

    showObjective(text, urgent = false) {
        if (!this.el.objective) return;
        this.el.objective.textContent = text;
        this.el.objective.dataset.urgent = urgent ? 'true' : 'false';
        const parent = this.el.objective.parentElement;
        if (parent) {
            parent.classList.add('is-flash');
            setTimeout(() => parent.classList.remove('is-flash'), 2400);
        }
    }

    setInteractPrompt(item) {
        if (!this.el.prompt) return;
        if (!item) {
            this.el.prompt.hidden = true;
            return;
        }
        this.el.prompt.hidden = false;
        const key = this.isTouch ? 'Botão E' : '<kbd>E</kbd>';
        this.el.prompt.innerHTML = `${key} ${item.interactionLabel || 'Interagir'}`;
    }

    setDialogue(line) {
        if (!this.el.dialogue) return;
        if (!line) {
            this.el.dialogue.hidden = true;
            return;
        }
        this.el.dialogue.hidden = false;
        if (this.el.speaker) this.el.speaker.textContent = line.speaker;
        if (this.el.line) this.el.line.textContent = line.text;
    }

    showStealth(on, amount = 0) {
        if (!this.el.stealth) return;
        this.el.stealth.hidden = !on;
        if (this.el.stealthFill) this.el.stealthFill.style.width = `${Math.round(amount * 100)}%`;
        this.el.stealth.dataset.danger = amount > 0.65 ? 'true' : 'false';
    }

    showToast(text, seconds = 3.2) {
        if (!this.el.toast) return;
        /* O cartão de capítulo ocupa o centro: o aviso espera ele sumir (antes os dois
           textos se sobrepunham na chegada de cada fase). */
        if (this._chapterT > 0) {
            this._pendingToast = [text, seconds];
            return;
        }
        this.el.toast.hidden = false;
        this.el.toast.textContent = text;
        this._toastT = seconds;
    }

    showChapter(title, sub) {
        if (!this.el.chapter) return;
        if (this._toastT > 0 && this.el.toast && !this.el.toast.hidden) {
            this._pendingToast = [this.el.toast.textContent, Math.max(2.5, this._toastT)];
            this._toastT = 0;
            this.el.toast.hidden = true;
        }
        this.el.chapter.hidden = false;
        if (this.el.chapterTitle) this.el.chapterTitle.textContent = title;
        if (this.el.chapterSub) this.el.chapterSub.textContent = sub || '';
        this._chapterT = 3.8;
    }

    showLevelName(stageId) {
        const names = {
            home: ['A Sala da Lareira', 'onde toda história começa'],
            ship: ['O Mar Aberto', 'rumo ao outro lado do oceano'],
            island: ['A Ilha do Castelo', 'desembarque e reconhecimento'],
            interior: ['As Profundezas', 'sombras e grades de ferro'],
            escape: ['A Fuga', 'correndo pelas flechas'],
            shipEscape: ['Zarpando', 'mar adentro contra o vento'],
            ending: ['O Retorno', 'uma promessa cumprida']
        };
        if (names[stageId]) {
            this.showChapter(names[stageId][0], names[stageId][1]);
        }
    }

    flashStealth(text) {
        if (text) this.showToast(text);
    }

    setFps(n) {
        if (this.el.fps) this.el.fps.textContent = `${n} fps`;
    }

    update(dt) {
        if (this._toastT > 0) {
            this._toastT -= dt;
            if (this._toastT <= 0 && this.el.toast) this.el.toast.hidden = true;
        }
        if (this._chapterT > 0) {
            this._chapterT -= dt;
            if (this._chapterT <= 0 && this.el.chapter) {
                this.el.chapter.hidden = true;
                if (this._pendingToast) {
                    const [text, seconds] = this._pendingToast;
                    this._pendingToast = null;
                    this.showToast(text, seconds);
                }
            }
        }

        if (this.game && this.game.player) {
            this.setHealth(this.game.player.health, this.game.player.maxHealth);
        }

        this._fpsT = (this._fpsT || 0) + dt;
        if (this.debug && this._fpsT > 0.5 && this.game.stage) {
            this._fpsT = 0;
            this.setFps(Math.round(this.game.stage.fps));
        }
    }
}
