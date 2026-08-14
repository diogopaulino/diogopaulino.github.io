/**
 * Teclado, mouse (pointer lock), toque e atalhos de HUD.
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
    Space: 'jump',
    KeyE: 'interact',
    KeyF: 'interact',
    KeyR: 'reload',
    KeyG: 'grenade',
    Digit1: 'weapon1',
    Digit2: 'weapon2'
};

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    Enter: 'confirm'
};

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.lookX = 0;
        this.lookY = 0;
        this.locked = false;
        this.enabled = true;
        this.listeners = new Map();
        this.touchMove = { x: 0, y: 0 };
        this.touchLook = { x: 0, y: 0 };
        this.touchSprint = false;
        this.fireHeld = false;
        this.adsHeld = false;
        this.interactPressed = false;
        this.reloadPressed = false;
        this.grenadePressed = false;
        this.jumpPressed = false;
        this.weaponSlot = 0;
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
        const x = this.lookX + this.touchLook.x;
        const y = this.lookY + this.touchLook.y;
        this.lookX = 0;
        this.lookY = 0;
        this.touchLook.x = 0;
        this.touchLook.y = 0;
        return { x, y };
    }

    consumeInteract() {
        const v = this.interactPressed;
        this.interactPressed = false;
        return v;
    }

    consumeReload() {
        const v = this.reloadPressed;
        this.reloadPressed = false;
        return v;
    }

    consumeGrenade() {
        const v = this.grenadePressed;
        this.grenadePressed = false;
        return v;
    }

    consumeJump() {
        const v = this.jumpPressed;
        this.jumpPressed = false;
        return v;
    }

    consumeWeapon() {
        const v = this.weaponSlot;
        this.weaponSlot = 0;
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

    bindTouch(hud) {
        const stick = hud.el.moveStick;
        const knob = hud.el.moveKnob;
        const look = hud.el.lookZone;
        if (!stick || !look) return;

        const setKnob = (x, y) => {
            if (!knob) return;
            knob.style.transform = `translate(${x * 28}px, ${-y * 28}px)`;
        };

        const onStick = (cx, cy, rect) => {
            const x = (cx - rect.left) / rect.width * 2 - 1;
            const y = -((cy - rect.top) / rect.height * 2 - 1);
            const len = Math.hypot(x, y) || 1;
            const s = Math.min(1, len);
            this.touchMove.x = (x / len) * s;
            this.touchMove.y = (y / len) * s;
            setKnob(this.touchMove.x, this.touchMove.y);
        };

        stick.addEventListener('pointerdown', (e) => {
            stick.setPointerCapture(e.pointerId);
            onStick(e.clientX, e.clientY, stick.getBoundingClientRect());
        });
        stick.addEventListener('pointermove', (e) => {
            if (!stick.hasPointerCapture(e.pointerId)) return;
            onStick(e.clientX, e.clientY, stick.getBoundingClientRect());
        });
        const endStick = () => {
            this.touchMove.x = 0;
            this.touchMove.y = 0;
            setKnob(0, 0);
        };
        stick.addEventListener('pointerup', endStick);
        stick.addEventListener('pointercancel', endStick);

        let last = null;
        look.addEventListener('pointerdown', (e) => {
            look.setPointerCapture(e.pointerId);
            last = { x: e.clientX, y: e.clientY };
        });
        look.addEventListener('pointermove', (e) => {
            if (!last) return;
            this.touchLook.x += (e.clientX - last.x) * 1.6;
            this.touchLook.y += (e.clientY - last.y) * 1.6;
            last = { x: e.clientX, y: e.clientY };
        });
        const endLook = () => { last = null; };
        look.addEventListener('pointerup', endLook);
        look.addEventListener('pointercancel', endLook);

        const hold = (el, on, off) => {
            if (!el) return;
            el.addEventListener('pointerdown', (e) => { e.preventDefault(); on(); });
            el.addEventListener('pointerup', off);
            el.addEventListener('pointercancel', off);
            el.addEventListener('pointerleave', off);
        };

        hold(hud.el.btnFire, () => { this.fireHeld = true; }, () => { this.fireHeld = false; });
        hold(hud.el.btnSprint, () => { this.touchSprint = true; }, () => { this.touchSprint = false; });
        hud.el.btnReload?.addEventListener('pointerdown', () => { this.reloadPressed = true; });
        hud.el.btnGrenade?.addEventListener('pointerdown', () => { this.grenadePressed = true; });
        hud.el.btnInteract?.addEventListener('pointerdown', () => { this.interactPressed = true; });
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
            if (key === 'reload') this.reloadPressed = true;
            if (key === 'grenade') this.grenadePressed = true;
            if (key === 'jump') this.jumpPressed = true;
            if (key === 'weapon1') this.weaponSlot = 1;
            if (key === 'weapon2') this.weaponSlot = 2;
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
            if (e.button === 0) this.fireHeld = true;
            if (e.button === 2) this.adsHeld = true;
        };

        this._onMouseUp = (e) => {
            if (e.button === 0) this.fireHeld = false;
            if (e.button === 2) this.adsHeld = false;
        };

        this._onLock = () => {
            this.locked = document.pointerLockElement === this.canvas;
            if (!this.locked) {
                this.fireHeld = false;
                this.adsHeld = false;
            }
        };

        this._onContext = (e) => e.preventDefault();

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousemove', this._onMouseMove);
        window.addEventListener('mouseup', this._onMouseUp);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('pointerlockchange', this._onLock);
    }
}
