/**
 * Teclado, mouse (pointer lock), toque e atalhos de HUD.
 * Espaço = pulo; E = interagir / cortar.
 */

import { bindGameKeyboard } from '../../shared/game-keyboard.js';
import { clamp } from './utils.js?v=12';

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
    Space: 'jump',
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
        this.touchSprint = false;
        this.interactPressed = false;
        this.jumpPressed = false;
        this.jumpHeld = false;
        // objetos reaproveitados (lidos a cada quadro: nada de alocação no laço)
        this._move = { x: 0, z: 0, sprint: false };
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
        this._look.x = this.lookX;
        this._look.y = this.lookY;
        this.lookX = 0;
        this.lookY = 0;
        return this._look;
    }

    /** Descarta toques pendentes de pulo/usar (sem soltar o direcional que ainda está apertado). */
    consumeTaps() {
        this.interactPressed = false;
        this.jumpPressed = false;
    }

    /** Solta tudo (pausa, troca de aba, fim de capítulo): nenhuma tecla fica presa. */
    release() {
        this.keys.clear();
        this.touchMove.x = this.touchMove.y = 0;
        this.touchSprint = false;
        this.interactPressed = false;
        this.jumpPressed = false;
        this.jumpHeld = false;
        this.lookX = this.lookY = this.zoomDelta = 0;
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

    consumeJump() {
        const v = this.jumpPressed;
        this.jumpPressed = false;
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
        m.sprint = this.keys.has('sprint') || this.touchSprint;
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
                if (key === 'interact') this.interactPressed = true;
                if (key === 'jump') {
                    this.jumpPressed = true;
                    this.jumpHeld = true;
                }
            },
            onRelease: key => {
                if (key === 'jump') this.jumpHeld = false;
            },
            onReset: () => {
                this.touchSprint = false;
                this.interactPressed = false;
                this.jumpPressed = false;
                this.jumpHeld = false;
                this.touchMove.x = this.touchMove.y = 0;
                this.lookX = this.lookY = this.zoomDelta = 0;
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

        window.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('pointerlockchange', this._onLock);
    }
}
