/**
 * Teclado, mouse (pointer lock), toque e atalhos de HUD.
 * Espaço / clique = pulso da lanterna. E / F = interagir.
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
    Space: 'flash',
    KeyE: 'interact',
    KeyF: 'interact'
};

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
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
        this.touchSprint = false;
        this.interactPressed = false;
        this.flashPressed = false;
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
        const x = this.lookX;
        const y = this.lookY;
        this.lookX = 0;
        this.lookY = 0;
        return { x, y };
    }

    consumeZoom() {
        const z = this.zoomDelta;
        this.zoomDelta = 0;
        return z;
    }

    consumeInteract() {
        const v = this.interactPressed;
        this.interactPressed = false;
        return v;
    }

    consumeFlash() {
        const v = this.flashPressed;
        this.flashPressed = false;
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
            sprint: this.keys.has('sprint') || this.touchSprint
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
            if (key === 'interact') this.interactPressed = true;
            if (key === 'flash') this.flashPressed = true;
        };

        this._onKeyUp = (e) => {
            const key = MOVE[e.code];
            if (key) this.keys.delete(key);
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
            if (e.button === 0) {
                this.flashPressed = true;
                this.emit('pointerdown');
            }
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
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('pointerlockchange', this._onLock);
    }
}
