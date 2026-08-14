/**
 * Teclado, mouse (pointer lock) e toque. lookX/lookY são deltas por frame.
 */

const MOVE_X = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
const MOVE_Z = { KeyW: 1, ArrowUp: 1, KeyS: -1, ArrowDown: -1 };

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Enter: 'confirm'
};

export class Input {
    constructor() {
        this.moveX = 0;
        this.moveZ = 0;
        this.lookX = 0;
        this.lookY = 0;
        this.webHeld = false;
        this.jump = false;
        this.jumpPressed = false;
        this.reel = false;
        this.keys = new Set();
        this.listeners = new Map();
        this.enabled = true;
        this.pointerLocked = false;
        this._lookAccX = 0;
        this._lookAccY = 0;
        this._mouseWeb = false;
        this._jumpHeld = false;
        this.touchLook = { x: 0, y: 0 };
        this.touchWeb = false;
        this.touchJump = false;
        this.touchForward = false;

        this._onKeyDown = (e) => {
            if (ACTIONS[e.code]) {
                if (ACTIONS[e.code] === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(ACTIONS[e.code]);
                e.preventDefault();
                return;
            }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                if (!this._jumpHeld) this.jumpPressed = true;
                this._jumpHeld = true;
                this.keys.add(e.code);
                e.preventDefault();
                return;
            }
            if (
                MOVE_X[e.code] !== undefined ||
                MOVE_Z[e.code] !== undefined ||
                e.code === 'KeyE' ||
                e.code === 'Space'
            ) {
                this.keys.add(e.code);
                e.preventDefault();
            }
        };
        this._onKeyUp = (e) => {
            this.keys.delete(e.code);
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this._jumpHeld = false;
        };
        this._onMouseDown = (e) => {
            if (e.button === 0) this._mouseWeb = true;
        };
        this._onMouseUp = (e) => {
            if (e.button === 0) this._mouseWeb = false;
        };
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
        window.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);
        window.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('pointerlockchange', this._onPointerLock);
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
        this.lookX = this._lookAccX + this.touchLook.x;
        this.lookY = this._lookAccY + this.touchLook.y;
        this._lookAccX = 0;
        this._lookAccY = 0;
        this.touchLook.x = 0;
        this.touchLook.y = 0;

        if (!this.enabled) {
            this.moveX = 0;
            this.moveZ = 0;
            this.webHeld = false;
            this.jump = false;
            this.jumpPressed = false;
            this.reel = false;
            return this;
        }

        let mx = 0;
        let mz = this.touchForward ? 1 : 0;
        for (const code of this.keys) {
            if (MOVE_X[code] !== undefined) mx += MOVE_X[code];
            if (MOVE_Z[code] !== undefined) mz += MOVE_Z[code];
        }
        this.moveX = Math.max(-1, Math.min(1, mx));
        this.moveZ = Math.max(-1, Math.min(1, mz));
        this.webHeld = this._mouseWeb || this.touchWeb || this.keys.has('Space');
        this.reel = this.keys.has('KeyE');
        this.jump = this.touchJump || this._jumpHeld;
        return this;
    }

    consumeJump() {
        const v = this.jumpPressed;
        this.jumpPressed = false;
        return v;
    }
}
