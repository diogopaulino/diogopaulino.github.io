/**
 * Teclado, mouse (pointer lock), toque e atalhos de HUD.
 * Espaço / clique = pulso da lanterna. E / F = interagir.
 *
 * Mouse: o primeiro clique só prende o ponteiro (não gasta chama com um pulso que
 * ninguém pediu). Sem pointer lock (negado, iframe, Safari antigo) arrastar com o
 * botão segurado também gira a câmera — o desktop nunca fica sem olhar em volta.
 */

import { bindGameKeyboard } from '../../shared/game-keyboard.js';
import { clamp } from './utils.js?v=22';

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
        this.dragging = false;
        this._look = { x: 0, y: 0 };
        this._move = { x: 0, z: 0, sprint: false };
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

    /** Delta de olhar acumulado desde o último quadro (objeto reaproveitado: sem lixo por quadro). */
    consumeLook() {
        this._look.x = this.lookX;
        this._look.y = this.lookY;
        this.lookX = 0;
        this.lookY = 0;
        return this._look;
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
                if (key === 'flash') this.flashPressed = true;
            },
            onReset: () => {
                this.dragging = false;
                this.touchSprint = false;
                this.interactPressed = false;
                this.flashPressed = false;
                this.touchMove.x = this.touchMove.y = 0;
                this.lookX = this.lookY = this.zoomDelta = 0;
                this.touchLook.x = this.touchLook.y = 0;
            }
        });

        this._onMouseMove = (e) => {
            if (!this.enabled) return;
            if (this.locked || (this.dragging && e.buttons & 1)) {
                this.lookX += e.movementX;
                this.lookY += e.movementY;
            }
        };

        this._onMouseDown = (e) => {
            if (!this.enabled) return;
            if (e.button === 0) {
                // preso: clique é pulso · solto: o clique só pede o ponteiro (e permite arrastar)
                if (this.locked) this.flashPressed = true;
                else this.dragging = true;
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

        this._onMouseUp = () => {
            this.dragging = false;
        };
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('pointerlockchange', this._onLock);
    }
}
