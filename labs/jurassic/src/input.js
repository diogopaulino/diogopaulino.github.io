/**
 * Teclado, mouse (pointer lock) e toque para o jipe.
 */

import { clamp } from './utils.js';

const MOVE = {
    KeyW: 'forward',
    ArrowUp: 'forward',
    KeyS: 'back',
    ArrowDown: 'back',
    KeyA: 'left',
    ArrowLeft: 'left',
    KeyD: 'right',
    ArrowRight: 'right',
    ShiftLeft: 'sprint',
    ShiftRight: 'sprint',
    KeyE: 'observe',
    KeyF: 'observe'
};

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    KeyL: 'lights',
    KeyT: 'tod',
    KeyR: 'rain',
    KeyH: 'hud',
    Enter: 'confirm'
};

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.lookX = 0;
        this.lookY = 0;
        this.zoomDelta = 0;
        this.locked = false;
        this.enabled = true;
        this.listeners = new Map();
        this.touchMove = { x: 0, y: 0 };
        this.touchLook = { x: 0, y: 0 };
        this.observeHeld = false;
        this.observePressed = false;
        this._bind();
    }

    on(action, handler) {
        if (!this.listeners.has(action)) this.listeners.set(action, new Set());
        this.listeners.get(action).add(handler);
        return () => this.listeners.get(action).delete(handler);
    }

    emit(action, payload) {
        this.listeners.get(action)?.forEach((fn) => fn(payload));
    }

    consumeLook() {
        const x = this.lookX + this.touchLook.x * 12;
        const y = this.lookY + this.touchLook.y * 12;
        this.lookX = 0;
        this.lookY = 0;
        return { x, y };
    }

    consumeZoom() {
        const z = this.zoomDelta;
        this.zoomDelta = 0;
        return z;
    }

    consumeObserve() {
        const v = this.observePressed;
        this.observePressed = false;
        return v;
    }

    get move() {
        const f = this.keys.has('forward') ? 1 : 0;
        const b = this.keys.has('back') ? 1 : 0;
        const r = this.keys.has('right') ? 1 : 0;
        const l = this.keys.has('left') ? 1 : 0;
        return {
            x: clamp(r - l + this.touchMove.x, -1, 1),
            z: clamp(f - b + this.touchMove.y, -1, 1),
            sprint: this.keys.has('sprint')
        };
    }

    requestLock() {
        if (this.locked) return;
        const result = this.canvas.requestPointerLock?.();
        if (result && typeof result.catch === 'function') result.catch(() => {});
    }

    exitLock() {
        if (document.pointerLockElement) document.exitPointerLock?.();
    }

    _bind() {
        this._onKeyDown = (e) => {
            if (!this.enabled) return;
            const action = ACTIONS[e.code];
            if (action) {
                if (action === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(action);
                if (action !== 'confirm') e.preventDefault();
            }
            const key = MOVE[e.code];
            if (!key) return;
            e.preventDefault();
            this.keys.add(key);
            if (key === 'observe') {
                this.observeHeld = true;
                this.observePressed = true;
            }
        };

        this._onKeyUp = (e) => {
            const key = MOVE[e.code];
            if (key) this.keys.delete(key);
            if (key === 'observe') this.observeHeld = false;
        };

        this._onMouseMove = (e) => {
            if (!this.enabled) return;
            if (this.locked) {
                this.lookX += e.movementX;
                this.lookY += e.movementY;
            }
        };

        this._onMouseDown = (e) => {
            if (!this.enabled) return;
            if (e.button === 0) this.emit('pointerdown');
            if (e.button === 2) {
                this.observeHeld = true;
                this.observePressed = true;
            }
        };

        this._onMouseUp = (e) => {
            if (e.button === 2) this.observeHeld = false;
        };

        this._onWheel = (e) => {
            if (!this.enabled) return;
            this.zoomDelta += Math.sign(e.deltaY);
            e.preventDefault();
        };

        this._onLock = () => {
            this.locked = document.pointerLockElement === this.canvas;
        };

        this._onContext = (e) => e.preventDefault();

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('pointerlockchange', this._onLock);
    }
}
