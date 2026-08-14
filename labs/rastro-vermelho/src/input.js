/**
 * Teclado, mouse (pointer lock), toque e atalhos.
 *
 * Frente do cavalo segue W/stick-cima. O galope livre ignora soltar W.
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
    ShiftRight: 'sprint'
};

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Space: 'spur',
    KeyG: 'cruise',
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
        this.spurPressed = false;
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

    consumeZoom() {
        const z = this.zoomDelta;
        this.zoomDelta = 0;
        return z;
    }

    consumeSpur() {
        const v = this.spurPressed;
        this.spurPressed = false;
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

    bindTouch({ stick, knob, look, spur }) {
        const setFromTouch = (el, ev, target) => {
            const t = ev.changedTouches[0];
            if (!t) return;
            const r = el.getBoundingClientRect();
            const x = (t.clientX - r.left) / r.width * 2 - 1;
            const y = (t.clientY - r.top) / r.height * 2 - 1;
            target.x = clamp(x, -1, 1);
            target.y = clamp(-y, -1, 1);
        };

        if (stick) {
            const onMove = (ev) => {
                ev.preventDefault();
                setFromTouch(stick, ev, this.touchMove);
                if (knob) {
                    knob.style.transform = `translate(${this.touchMove.x * 18}px, ${-this.touchMove.y * 18}px)`;
                }
            };
            const clear = () => {
                this.touchMove.x = 0;
                this.touchMove.y = 0;
                if (knob) knob.style.transform = '';
            };
            stick.addEventListener('touchstart', onMove, { passive: false });
            stick.addEventListener('touchmove', onMove, { passive: false });
            stick.addEventListener('touchend', clear);
            stick.addEventListener('touchcancel', clear);
        }

        if (look) {
            let lx = 0;
            let ly = 0;
            look.addEventListener('touchstart', (ev) => {
                const t = ev.changedTouches[0];
                lx = t.clientX;
                ly = t.clientY;
            }, { passive: true });
            look.addEventListener('touchmove', (ev) => {
                const t = ev.changedTouches[0];
                this.touchLook.x += t.clientX - lx;
                this.touchLook.y += t.clientY - ly;
                lx = t.clientX;
                ly = t.clientY;
            }, { passive: true });
        }

        if (spur) {
            spur.addEventListener('touchstart', (ev) => {
                ev.preventDefault();
                this.spurPressed = true;
            }, { passive: false });
        }
    }

    _bind() {
        this._onKeyDown = (e) => {
            if (!this.enabled) return;
            const action = ACTIONS[e.code];
            if (action) {
                if (action === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                if (action === 'spur') {
                    if (!e.repeat) this.spurPressed = true;
                } else {
                    this.emit(action);
                }
                if (action !== 'confirm') e.preventDefault();
            }
            const key = MOVE[e.code];
            if (!key) return;
            e.preventDefault();
            this.keys.add(key);
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

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('mousemove', this._onMouseMove);
        this.canvas.addEventListener('mousedown', this._onMouseDown);
        this.canvas.addEventListener('wheel', this._onWheel, { passive: false });
        this.canvas.addEventListener('contextmenu', this._onContext);
        document.addEventListener('pointerlockchange', this._onLock);
    }
}
