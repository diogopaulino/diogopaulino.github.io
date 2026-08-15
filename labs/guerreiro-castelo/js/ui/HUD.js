/**
 * HUD cinematográfico em Babylon.js: vida, objetivo, interação, diálogo, stealth, FPS.
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
            fps: document.getElementById('fpsCounter')
        };
        this._toastT = 0;
        this._chapterT = 0;
        this.isTouch = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
        this.lastHp = -1;
    }

    show() {
        if (this.el.hud) this.el.hud.hidden = false;
    }

    hide() {
        if (this.el.hud) this.el.hud.hidden = true;
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
        if (this.lastHp === hp) return;
        this.lastHp = hp;
        if (!this.el.hearts) return;
        this.el.hearts.innerHTML = '';
        for (let i = 0; i < max; i++) {
            const s = document.createElement('span');
            s.className = 'heart' + (i < hp ? '' : ' is-empty');
            s.textContent = '❤';
            this.el.hearts.appendChild(s);
        }
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

    showToast(text) {
        if (!this.el.toast) return;
        this.el.toast.hidden = false;
        this.el.toast.textContent = text;
        this._toastT = 3.2;
    }

    showChapter(title, sub) {
        if (!this.el.chapter) return;
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
            if (this._chapterT <= 0 && this.el.chapter) this.el.chapter.hidden = true;
        }

        if (this.game && this.game.player) {
            this.setHealth(this.game.player.health, this.game.player.maxHealth);
        }

        if (this.game && this.game.engine) {
            const fps = Math.round(this.game.engine.getFps() || 60);
            this.setFps(fps);
        }
    }
}
