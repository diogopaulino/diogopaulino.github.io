/**
 * Teclado, mouse (pointer lock), toque e atalhos de HUD.
 *
 * Mapa:  WASD/setas andar · Shift correr · Espaço pular · E/F usar e falar
 *        clique/J/K atacar · P/Esc pausa · M som · C distância da câmera
 *
 * Pulo: `jumpPressed` é a borda de descida (consumida pelo Player com buffer
 * de 0,12 s); `jumpHeld` diz se o botão segue apertado (pulo variável: soltar
 * cedo corta a subida). Nada aqui aloca por quadro: `move` e `consumeLook`
 * devolvem sempre o mesmo objeto.
 */

import { bindGameKeyboard } from '../../shared/game-keyboard.js';
import { clamp } from './utils.js?v=32';

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
    KeyJ: 'attack',
    KeyK: 'attack',
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
        this.touchJump = false;
        this.interactPressed = false;
        this.attackPressed = false;
        this.jumpPressed = false;
        this.lockFailed = false;
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

    /** Soma de movimento do mouse/toque desde o último quadro (objeto reaproveitado). */
    consumeLook() {
        const o = this._look;
        o.x = this.lookX;
        o.y = this.lookY;
        this.lookX = 0;
        this.lookY = 0;
        return o;
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

    consumeAttack() {
        const v = this.attackPressed;
        this.attackPressed = false;
        return v;
    }

    consumeJump() {
        const v = this.jumpPressed;
        this.jumpPressed = false;
        return v;
    }

    get jumpHeld() {
        return this.keys.has('jump') || this.touchJump;
    }

    /** Direção pedida (−1…1 em x/z, comprimento ≤ √2 antes de normalizar no Player). */
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

    /** Solta tudo (pausa, blur, troca de capítulo): nada fica "apertado" ao voltar. */
    release() {
        this.keys.clear();
        this.interactPressed = false;
        this.attackPressed = false;
        this.jumpPressed = false;
        this.touchJump = false;
        this.touchMove.x = this.touchMove.y = 0;
        this.lookX = this.lookY = this.zoomDelta = 0;
        this.emit('released');
    }

    requestLock() {
        if (this.locked) return;
        try {
            const result = this.canvas.requestPointerLock?.();
            if (result && typeof result.catch === 'function') result.catch(() => {});
        } catch { /* navegador recusou (sem gesto): segue sem trava */ }
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
                if (key === 'attack') this.attackPressed = true;
                if (key === 'jump') this.jumpPressed = true;
            },
            onReset: () => {
                this.interactPressed = false;
                this.attackPressed = false;
                this.jumpPressed = false;
                this.touchJump = false;
                this.touchMove.x = this.touchMove.y = 0;
                this.lookX = this.lookY = this.zoomDelta = 0;
                this.emit('released');
            }
        });

        this._onMouseMove = (e) => {
            if (!this.enabled || !this.locked) return;
            this.lookX += e.movementX;
            this.lookY += e.movementY;
        };

        this._onMouseDown = (e) => {
            if (!this.enabled) return;
            if (e.button === 0) {
                // o primeiro clique só trava o mouse (não sai golpe no vazio)
                if (this.locked || this.lockFailed || !this.canvas.requestPointerLock) this.attackPressed = true;
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

        window.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('pointerlockchange', this._onLock);
        // trava recusada (iframe, política do navegador): clique volta a ser golpe
        document.addEventListener('pointerlockerror', () => { this.lockFailed = true; });
    }
}
