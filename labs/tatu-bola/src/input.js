/**
 * Teclado, toque (stick + pulo + rolamento) e atalhos de HUD.
 * O jogo lê eixos e consumeJump / consumeFire (roll).
 */

const MOVE = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right'
};

const ACTION = {
    KeyP: 'pause', Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Enter: 'confirm'
};

export class Input {
    constructor() {
        this.keys = new Set();
        this.axisX = 0;
        this.axisY = 0;
        this.touchX = 0;
        this.touchY = 0;
        this.jumpQueued = false;
        this.fireQueued = false;
        this.fireHeld = false;
        this.listeners = new Map();
        this.enabled = true;
        this.stickId = null;
        this.stickOrigin = null;
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

    consumeJump() {
        const v = this.jumpQueued;
        this.jumpQueued = false;
        return v;
    }

    consumeFire() {
        const v = this.fireQueued;
        this.fireQueued = false;
        return v;
    }

    sample() {
        let x = this.touchX;
        let y = this.touchY;
        if (this.keys.has('left')) x -= 1;
        if (this.keys.has('right')) x += 1;
        if (this.keys.has('up')) y += 1;
        if (this.keys.has('down')) y -= 1;
        const mag = Math.hypot(x, y);
        if (mag > 1) {
            x /= mag;
            y /= mag;
        }
        this.axisX = x;
        this.axisY = y;
        return this;
    }

    _bind() {
        this._onKeyDown = (e) => {
            if (!this.enabled && ACTION[e.code] !== 'pause' && ACTION[e.code] !== 'mute') return;
            const act = ACTION[e.code];
            if (act) {
                if (act === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(act);
                e.preventDefault();
            }
            const move = MOVE[e.code];
            if (move) {
                e.preventDefault();
                this.keys.add(move);
            }
            if (e.code === 'Space') {
                e.preventDefault();
                if (!e.repeat) this.jumpQueued = true;
            }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF' || e.code === 'KeyJ') {
                e.preventDefault();
                if (!e.repeat) this.fireQueued = true;
                this.fireHeld = true;
            }
        };

        this._onKeyUp = (e) => {
            const move = MOVE[e.code];
            if (move) this.keys.delete(move);
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyF' || e.code === 'KeyJ') {
                this.fireHeld = false;
            }
        };

        this._onPointerDown = (e) => {
            if (!this.enabled) return;
            const t = e.target;
            if (t?.closest?.('#jumpPad')) {
                this.jumpQueued = true;
                return;
            }
            if (t?.closest?.('#firePad')) {
                this.fireQueued = true;
                this.fireHeld = true;
                this._pointerFire = true;
                return;
            }
            const zone = t?.closest?.('#steerZone');
            if (zone) {
                this.stickId = e.pointerId;
                const rect = zone.getBoundingClientRect();
                this.stickOrigin = {
                    x: rect.left + rect.width * 0.5,
                    y: rect.top + rect.height * 0.5,
                    r: Math.min(rect.width, rect.height) * 0.42
                };
                this._steerFromEvent(e);
                zone.setPointerCapture?.(e.pointerId);
            }
        };

        this._onPointerMove = (e) => {
            if (this.stickId !== e.pointerId) return;
            this._steerFromEvent(e);
        };

        this._onPointerUp = (e) => {
            if (e.target?.closest?.('#firePad') || this._pointerFire) {
                this.fireHeld = false;
                this._pointerFire = false;
            }
            if (this.stickId === e.pointerId) {
                this.stickId = null;
                this.touchX = 0;
                this.touchY = 0;
                this._updateKnob(0, 0);
            }
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        window.addEventListener('pointercancel', this._onPointerUp);
        window.addEventListener('blur', () => {
            this.keys.clear();
            this.touchX = 0;
            this.touchY = 0;
            this.fireHeld = false;
        });
    }

    _steerFromEvent(e) {
        if (!this.stickOrigin) return;
        const dx = e.clientX - this.stickOrigin.x;
        const dy = e.clientY - this.stickOrigin.y;
        const r = this.stickOrigin.r;
        let x = dx / r;
        let y = -dy / r;
        const mag = Math.hypot(x, y);
        if (mag > 1) {
            x /= mag;
            y /= mag;
        }
        this.touchX = x;
        this.touchY = y;
        this._updateKnob(x, -y);
    }

    _updateKnob(x, y) {
        const knob = document.getElementById('steerKnob');
        if (!knob) return;
        knob.style.transform = `translate(calc(-50% + ${x * 28}px), calc(-50% + ${y * 28}px))`;
    }
}
