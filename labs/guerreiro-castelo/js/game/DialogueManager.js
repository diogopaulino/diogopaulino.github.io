/**
 * Diálogos discretos na parte inferior.
 * DICO
 * Segurem firme!
 */

export class DialogueManager {
    constructor() {
        this.queue = [];
        this.current = null;
        this.timer = 0;
        this.blocking = false;
        this.onDone = null;
    }

    say(speaker, text, duration = 3.2) {
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
        if (!this.current) {
            this.blocking = false;
            const cb = this.onDone;
            this.onDone = null;
            cb?.();
        }
    }

    skip() {
        if (this.current) this._next();
    }

    update(dt) {
        if (!this.current) return;
        this.timer -= dt;
        if (this.timer <= 0) this._next();
    }
}
