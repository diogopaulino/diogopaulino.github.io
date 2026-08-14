/**
 * Teclado, toque e gamepad unificados.
 *
 * O jogo lê `input.axis`, `input.consumeJump()` e `input.consumeAttack()`.
 */

import { clamp } from './utils.js';

const KEY_MAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'jump',
    KeyW: 'jump',
    Space: 'jump',
    KeyJ: 'attack',
    KeyK: 'attack',
    KeyZ: 'attack',
    ControlLeft: 'attack'
};

const ACTION_KEYS = {
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
        this.touchAxis = 0;
        this.jumpPressed = false;
        this.attackPressed = false;
        this.listeners = new Map();
        this._padJumpHeld = false;
        this._padAttackHeld = false;
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

    _bind() {
        this._onKeyDown = (e) => {
            if (e.repeat) return;
            const action = ACTION_KEYS[e.code];
            if (action) {
                if (action === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(action);
                if (action !== 'confirm') e.preventDefault();
            }
            const key = KEY_MAP[e.code];
            if (!key) return;
            e.preventDefault();
            this.keys.add(key);
            if (key === 'jump') this.jumpPressed = true;
            if (key === 'attack') this.attackPressed = true;
        };

        this._onKeyUp = (e) => {
            const key = KEY_MAP[e.code];
            if (!key) return;
            this.keys.delete(key);
        };

        this._onBlur = () => {
            this.keys.clear();
            this.touchAxis = 0;
        };

        window.addEventListener('keydown', this._onKeyDown, { passive: false });
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    bindTouch(buttons) {
        buttons?.forEach((btn) => {
            const control = btn.dataset.control;
            const down = (e) => {
                e.preventDefault();
                btn.dataset.active = 'true';
                if (control === 'left') this.touchAxis = -1;
                else if (control === 'right') this.touchAxis = 1;
                else if (control === 'jump') this.jumpPressed = true;
                else if (control === 'attack') this.attackPressed = true;
            };
            const up = () => {
                btn.dataset.active = 'false';
                if (control === 'left' && this.touchAxis < 0) this.touchAxis = 0;
                if (control === 'right' && this.touchAxis > 0) this.touchAxis = 0;
            };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointerleave', up);
            btn.addEventListener('pointercancel', up);
        });
    }

    _pad() {
        if (!navigator.getGamepads) return null;
        for (const pad of navigator.getGamepads()) {
            if (pad?.connected) return pad;
        }
        return null;
    }

    get axis() {
        let value = 0;
        if (this.keys.has('left')) value -= 1;
        if (this.keys.has('right')) value += 1;
        value += this.touchAxis;

        const pad = this._pad();
        if (pad) {
            const axis = pad.axes[0] || 0;
            if (Math.abs(axis) > 0.18) value += axis;
            if (pad.buttons[14]?.pressed) value -= 1;
            if (pad.buttons[15]?.pressed) value += 1;
        }
        return clamp(value, -1, 1);
    }

    consumeJump() {
        const pad = this._pad();
        if (pad?.buttons[0]?.pressed) {
            if (!this._padJumpHeld) {
                this._padJumpHeld = true;
                return true;
            }
        } else {
            this._padJumpHeld = false;
        }
        if (this.jumpPressed) {
            this.jumpPressed = false;
            return true;
        }
        return false;
    }

    consumeAttack() {
        const pad = this._pad();
        if (pad?.buttons[2]?.pressed || pad?.buttons[1]?.pressed) {
            if (!this._padAttackHeld) {
                this._padAttackHeld = true;
                return true;
            }
        } else {
            this._padAttackHeld = false;
        }
        if (this.attackPressed) {
            this.attackPressed = false;
            return true;
        }
        return false;
    }

    reset() {
        this.keys.clear();
        this.jumpPressed = false;
        this.attackPressed = false;
        this.touchAxis = 0;
    }
}
