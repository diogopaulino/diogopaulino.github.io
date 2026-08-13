/**
 * Entrada unificada: teclado, mouse, toque e gamepad.
 *
 * O jogo lê apenas `input.steer`, `input.boost`, `input.brake` e
 * `input.consumeFire()` — de onde veio o comando é problema deste módulo.
 */

import { clamp } from './utils.js';

const KEY_MAP = {
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'boost',
    KeyW: 'boost',
    ArrowDown: 'brake',
    KeyS: 'brake',
    Space: 'fire',
    KeyJ: 'fire'
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
        this.touchSteer = 0;
        this.touchBoost = false;
        this.firePressed = false;
        this.fireHeld = false;
        this.pointerFire = false;
        this.listeners = new Map();
        this.enabled = true;
        this.touchOrigin = null;
        this.gamepadIndex = null;

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
                // Enter só interessa quando o foco não está num botão.
                if (action === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(action);
                if (action !== 'confirm') e.preventDefault();
            }
            const key = KEY_MAP[e.code];
            if (!key) return;
            e.preventDefault();
            this.keys.add(key);
            if (key === 'fire') {
                this.firePressed = true;
                this.fireHeld = true;
            }
        };

        this._onKeyUp = (e) => {
            const key = KEY_MAP[e.code];
            if (!key) return;
            this.keys.delete(key);
            if (key === 'fire') this.fireHeld = false;
        };

        this._onBlur = () => {
            this.keys.clear();
            this.fireHeld = false;
            this.touchSteer = 0;
            this.touchBoost = false;
            this.pointerFire = false;
        };

        this._onPointerDown = (e) => {
            if (e.pointerType === 'touch') return;
            if (e.button !== 0) return;
            this.firePressed = true;
            this.pointerFire = true;
        };

        this._onPointerUp = () => {
            this.pointerFire = false;
        };

        window.addEventListener('keydown', this._onKeyDown, { passive: false });
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);
        this.canvas.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointerup', this._onPointerUp);
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    /** Liga a área de arraste e os botões da interface de toque. */
    bindTouch({ steerZone, buttons }) {
        if (!steerZone) return;

        const start = (e) => {
            this.touchOrigin = { id: e.pointerId, x: e.clientX };
            steerZone.setPointerCapture?.(e.pointerId);
            e.preventDefault();
        };

        const move = (e) => {
            if (!this.touchOrigin || this.touchOrigin.id !== e.pointerId) return;
            const dx = e.clientX - this.touchOrigin.x;
            this.touchSteer = clamp(dx / 80, -1, 1);
            e.preventDefault();
        };

        const end = (e) => {
            if (this.touchOrigin && this.touchOrigin.id !== e.pointerId) return;
            this.touchOrigin = null;
            this.touchSteer = 0;
        };

        steerZone.addEventListener('pointerdown', start);
        steerZone.addEventListener('pointermove', move);
        steerZone.addEventListener('pointerup', end);
        steerZone.addEventListener('pointercancel', end);

        buttons?.forEach((btn) => {
            const control = btn.dataset.control;
            const down = (e) => {
                e.preventDefault();
                btn.dataset.active = 'true';
                if (control === 'throw') {
                    this.firePressed = true;
                    this.fireHeld = true;
                } else if (control === 'boost') {
                    this.touchBoost = true;
                }
            };
            const up = () => {
                btn.dataset.active = 'false';
                if (control === 'throw') this.fireHeld = false;
                else if (control === 'boost') this.touchBoost = false;
            };
            btn.addEventListener('pointerdown', down);
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointerleave', up);
            btn.addEventListener('pointercancel', up);
        });
    }

    _gamepad() {
        if (!navigator.getGamepads) return null;
        const pads = navigator.getGamepads();
        for (const pad of pads) {
            if (pad?.connected) return pad;
        }
        return null;
    }

    /** Direção lateral desejada, de -1 (bombordo) a 1 (boreste). */
    get steer() {
        let value = 0;
        if (this.keys.has('left')) value -= 1;
        if (this.keys.has('right')) value += 1;
        value += this.touchSteer;

        const pad = this._gamepad();
        if (pad) {
            const axis = pad.axes[0] || 0;
            if (Math.abs(axis) > 0.16) value += axis;
            if (pad.buttons[14]?.pressed) value -= 1;
            if (pad.buttons[15]?.pressed) value += 1;
        }

        return clamp(value, -1, 1);
    }

    get boost() {
        const pad = this._gamepad();
        return this.keys.has('boost') || this.touchBoost || Boolean(pad?.buttons[7]?.pressed);
    }

    get brake() {
        const pad = this._gamepad();
        return this.keys.has('brake') || Boolean(pad?.buttons[6]?.pressed);
    }

    /** Verdadeiro apenas uma vez por toque/clique/tecla. */
    consumeFire() {
        const pad = this._gamepad();
        if (pad?.buttons[0]?.pressed || pad?.buttons[2]?.pressed) {
            if (!this._padFireHeld) {
                this._padFireHeld = true;
                return true;
            }
        } else {
            this._padFireHeld = false;
        }

        if (this.firePressed) {
            this.firePressed = false;
            return true;
        }
        return false;
    }

    /** Disparo contínuo (usado no modo fúria). */
    get firing() {
        return this.fireHeld || this.pointerFire;
    }

    reset() {
        this.keys.clear();
        this.firePressed = false;
        this.fireHeld = false;
        this.pointerFire = false;
        this.touchSteer = 0;
        this.touchBoost = false;
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        window.removeEventListener('blur', this._onBlur);
        window.removeEventListener('pointerup', this._onPointerUp);
        this.listeners.clear();
    }
}
