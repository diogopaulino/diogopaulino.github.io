/**
 * Teclado, mouse (pointer lock) e toque para o jipe.
 *   W/↑ acelera · S/↓ freia e, parado, dá ré · A/D/←/→ esterça · Espaço freio de mão
 *   Perder o pointer lock no meio do turno (Esc) emite 'unlock' → main.js pausa.
 *   Janela sem foco: o teclado compartilhado limpa as teclas presas (onReset).
 */

import { bindGameKeyboard } from '../../shared/game-keyboard.js';
import { clamp } from './utils.js?v=23';

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
    Space: 'handbrake',
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
        this.touchHandbrake = false;
        this._move = { x: 0, z: 0, sprint: false, handbrake: false };
        this._look = { x: 0, y: 0 };
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
        const l = this._look;
        l.x = this.lookX + this.touchLook.x * 12;
        l.y = this.lookY + this.touchLook.y * 12;
        this.lookX = 0;
        this.lookY = 0;
        return l;
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
        const m = this._move;
        m.x = clamp(r - l + this.touchMove.x, -1, 1);
        m.z = clamp(f - b + this.touchMove.y, -1, 1);
        m.sprint = this.keys.has('sprint');
        m.handbrake = this.keys.has('handbrake') || this.touchHandbrake;
        return m;
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
        bindGameKeyboard({
            moves: MOVE, actions: ACTIONS, held: this.keys,
            enabled: () => this.enabled,
            onAction: action => this.emit(action),
            onPress: key => {
                if (key === 'observe') {
                    this.observeHeld = true;
                    this.observePressed = true;
                }
            },
            onRelease: key => {
                if (key === 'observe') this.observeHeld = false;
            },
            onReset: () => {
                this.observeHeld = false;
                this.observePressed = false;
                this.touchMove.x = this.touchMove.y = 0;
                this.lookX = this.lookY = this.zoomDelta = 0;
                this.touchLook.x = this.touchLook.y = 0;
                this.touchHandbrake = false;
                this.emit('reset');
            }
        });

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
            const was = this.locked;
            this.locked = document.pointerLockElement === this.canvas;
            if (was && !this.locked) this.emit('unlock');
        };

        this._onContext = (e) => e.preventDefault();

        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('pointerlockchange', this._onLock);
    }
}
