/**
 * Gerenciador de diálogos contextuais discretos na parte inferior da tela em Babylon.js.
 */

export class DialogueManager {
    constructor(game) {
        this.game = game;
        this.queue = [];
        this.current = null;
        this.timer = 0;
        this.blocking = false;
        this.onDone = null;
    }

    get active() {
        return Boolean(this.current);
    }

    say(speaker, text, duration = 3.4) {
        this.queue.push({ speaker, text, duration });
        if (!this.current) this._next();
    }

    play(lines, onDone) {
        this.queue.push(...lines);
        this.onDone = onDone || null;
        this.blocking = true;
        if (!this.current) this._next();
    }

    _next() {
        this.current = this.queue.shift() || null;
        this.timer = this.current ? this.current.duration : 0;
        if (this.game && this.game.hud) {
            this.game.hud.setDialogue(this.current);
        }
        if (this.current) {
            this.game.audio?.play('speech');
        } else {
            this.blocking = false;
            const cb = this.onDone;
            this.onDone = null;
            cb?.();
        }
    }

    advance() {
        if (this.current) this._next();
    }

    update(dt) {
        if (!this.current) return;
        this.timer -= dt;
        if (this.timer <= 0) this._next();
    }
}
