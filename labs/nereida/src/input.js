/**
 * Teclado, mouse e toque. steerX/steerY ∈ [-1, 1].
 */

const MOVE_X = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
const MOVE_Y = { KeyW: 1, ArrowUp: 1, KeyS: -1, ArrowDown: -1 };

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Enter: 'confirm',
    KeyQ: 'rollLeft',
    KeyE: 'rollRight'
};

export class Input {
    constructor() {
        this.steerX = 0;
        this.steerY = 0;
        this.lookX = 0;
        this.lookY = 0;
        this.boost = false;
        this.keys = new Set();
        this.listeners = new Map();
        this.enabled = true;
        this.pointerLocked = false;
        this._lookAccX = 0;
        this._lookAccY = 0;
        this.touchLook = { x: 0, y: 0 };
        this.touchBoost = false;
        this.touchSteer = { x: 0, y: 0 };

        this._onKeyDown = (e) => {
            if (ACTIONS[e.code]) {
                if (ACTIONS[e.code] === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(ACTIONS[e.code]);
                e.preventDefault();
                return;
            }
            if (
                MOVE_X[e.code] !== undefined ||
                MOVE_Y[e.code] !== undefined ||
                e.code === 'Space'
            ) {
                this.keys.add(e.code);
                e.preventDefault();
            }
        };
        this._onKeyUp = (e) => this.keys.delete(e.code);
        this._onMouseMove = (e) => {
            if (!this.pointerLocked) return;
            this._lookAccX += e.movementX || 0;
            this._lookAccY += e.movementY || 0;
        };
        this._onPointerLock = () => {
            this.pointerLocked = document.pointerLockElement != null;
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('pointerlockchange', this._onPointerLock);
    }

    bindTouch({ lookZone, boost, roll }) {
        const steerFrom = (el, e) => {
            const r = el.getBoundingClientRect();
            const t = e.touches?.[0] || e;
            const x = ((t.clientX - r.left) / r.width) * 2 - 1;
            const y = -(((t.clientY - r.top) / r.height) * 2 - 1);
            this.touchSteer.x = Math.max(-1, Math.min(1, x * 1.4));
            this.touchSteer.y = Math.max(-1, Math.min(1, y * 1.4));
        };
        lookZone.addEventListener('pointerdown', (e) => {
            lookZone.setPointerCapture(e.pointerId);
            steerFrom(lookZone, e);
        });
        lookZone.addEventListener('pointermove', (e) => {
            if (e.buttons || e.pressure) steerFrom(lookZone, e);
        });
        const clearSteer = () => {
            this.touchSteer.x = 0;
            this.touchSteer.y = 0;
        };
        lookZone.addEventListener('pointerup', clearSteer);
        lookZone.addEventListener('pointercancel', clearSteer);
        lookZone.addEventListener('pointerleave', clearSteer);

        const hold = (el, flag) => {
            const on = (e) => {
                e.preventDefault();
                this[flag] = true;
            };
            const off = () => {
                this[flag] = false;
            };
            el.addEventListener('pointerdown', on);
            el.addEventListener('pointerup', off);
            el.addEventListener('pointercancel', off);
            el.addEventListener('pointerleave', off);
        };
        hold(boost, 'touchBoost');
        roll.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this.emit('rollRight');
        });
    }

    on(action, fn) {
        if (!this.listeners.has(action)) this.listeners.set(action, new Set());
        this.listeners.get(action).add(fn);
    }

    emit(action) {
        this.listeners.get(action)?.forEach((fn) => fn());
    }

    requestLock(el) {
        el?.requestPointerLock?.();
    }

    exitLock() {
        if (document.pointerLockElement) document.exitPointerLock();
    }

    sample() {
        this.lookX = this._lookAccX;
        this.lookY = this._lookAccY;
        this._lookAccX = 0;
        this._lookAccY = 0;

        if (!this.enabled) {
            this.steerX = 0;
            this.steerY = 0;
            this.boost = false;
            return this;
        }

        let mx = this.touchSteer.x;
        let my = this.touchSteer.y;
        for (const code of this.keys) {
            if (MOVE_X[code] !== undefined) mx += MOVE_X[code];
            if (MOVE_Y[code] !== undefined) my += MOVE_Y[code];
        }
        mx += this.lookX * 0.04;
        my -= this.lookY * 0.04;
        this.steerX = Math.max(-1, Math.min(1, mx));
        this.steerY = Math.max(-1, Math.min(1, my));
        this.boost = this.touchBoost || this.keys.has('Space');
        return this;
    }
}
