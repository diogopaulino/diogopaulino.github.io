/**
 * Teclado, toque e ações globais (pausa, mudo, câmera).
 */

const STEER = {
    ArrowLeft: -1,
    KeyA: -1,
    ArrowRight: 1,
    KeyD: 1
};

const HOLD = {
    ArrowUp: 'boost',
    KeyW: 'boost',
    ShiftLeft: 'boost',
    ShiftRight: 'boost',
    ArrowDown: 'brake',
    KeyS: 'brake',
    Space: 'boost'
};

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Enter: 'confirm',
    KeyR: 'radio'
};

export class Input {
    constructor() {
        this.steer = 0;
        this.boost = false;
        this.brake = false;
        this.keys = new Set();
        this.listeners = new Map();
        this.touchSteer = 0;
        this.touchBoost = false;
        this.touchBrake = false;
        this.enabled = true;

        this._onKeyDown = (e) => {
            if (ACTIONS[e.code]) {
                if (ACTIONS[e.code] === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(ACTIONS[e.code]);
                e.preventDefault();
            }
            if (STEER[e.code] !== undefined || HOLD[e.code]) {
                this.keys.add(e.code);
                e.preventDefault();
            }
        };
        this._onKeyUp = (e) => {
            this.keys.delete(e.code);
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    on(action, fn) {
        if (!this.listeners.has(action)) this.listeners.set(action, new Set());
        this.listeners.get(action).add(fn);
    }

    emit(action) {
        this.listeners.get(action)?.forEach((fn) => fn());
    }

    setTouchSteer(v) {
        this.touchSteer = v;
    }

    setTouchBoost(v) {
        this.touchBoost = v;
    }

    setTouchBrake(v) {
        this.touchBrake = v;
    }

    sample() {
        if (!this.enabled) {
            this.steer = 0;
            this.boost = false;
            this.brake = false;
            return this;
        }
        let s = this.touchSteer;
        for (const code of this.keys) {
            if (STEER[code] !== undefined) s += STEER[code];
        }
        this.steer = Math.max(-1, Math.min(1, s));
        this.boost = this.touchBoost || [...this.keys].some((c) => HOLD[c] === 'boost');
        this.brake = this.touchBrake || [...this.keys].some((c) => HOLD[c] === 'brake');
        return this;
    }
}
