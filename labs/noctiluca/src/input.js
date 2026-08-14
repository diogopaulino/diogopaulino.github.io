/**
 * Teclado, mouse (look), toque e ações globais (pausa, mudo, pulso).
 */

const STEER_X = {
    ArrowLeft: -1,
    KeyA: -1,
    ArrowRight: 1,
    KeyD: 1
};

const STEER_Y = {
    ArrowUp: -1,
    KeyW: -1,
    ArrowDown: 1,
    KeyS: 1
};

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Enter: 'confirm',
    Space: 'pulse'
};

export class Input {
    constructor() {
        this.keys = new Set();
        this.listeners = new Map();
        this.touchX = 0;
        this.touchY = 0;
        this.mouseX = 0;
        this.mouseY = 0;
        this.lookActive = false;
        this.enabled = true;
        this.touching = false;

        this._onKeyDown = (e) => {
            if (ACTIONS[e.code]) {
                if (ACTIONS[e.code] === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(ACTIONS[e.code]);
                e.preventDefault();
            }
            if (STEER_X[e.code] !== undefined || STEER_Y[e.code] !== undefined) {
                this.keys.add(e.code);
                e.preventDefault();
            }
        };
        this._onKeyUp = (e) => this.keys.delete(e.code);

        this._onMouseMove = (e) => {
            if (!this.lookActive) return;
            this.mouseX += e.movementX;
            this.mouseY += e.movementY;
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('pointerlockchange', () => {
            this.lookActive = document.pointerLockElement != null;
        });
    }

    on(action, fn) {
        if (!this.listeners.has(action)) this.listeners.set(action, new Set());
        this.listeners.get(action).add(fn);
    }

    emit(action) {
        this.listeners.get(action)?.forEach((fn) => fn());
    }

    lock(canvas) {
        canvas.requestPointerLock?.();
    }

    unlock() {
        document.exitPointerLock?.();
    }

    setTouch(x, y) {
        this.touchX = x;
        this.touchY = y;
        this.touching = true;
    }

    clearTouch() {
        this.touchX = 0;
        this.touchY = 0;
        this.touching = false;
    }

    sample() {
        if (!this.enabled) {
            return { steerX: 0, steerY: 0, strafe: 0 };
        }
        let sx = 0;
        let sy = 0;
        for (const k of this.keys) {
            if (STEER_X[k] !== undefined) sx += STEER_X[k];
            if (STEER_Y[k] !== undefined) sy += STEER_Y[k];
        }
        sx += this.touchX;
        sy += this.touchY;
        const mx = this.mouseX * 0.045;
        const my = this.mouseY * 0.045;
        this.mouseX = 0;
        this.mouseY = 0;
        sx += mx;
        sy += my;
        sx = Math.max(-1.4, Math.min(1.4, sx));
        sy = Math.max(-1.4, Math.min(1.4, sy));
        return { steerX: sx, steerY: sy, strafe: 0 };
    }
}
