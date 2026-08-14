/**
 * Teclado (WASD + câmera Q/E), mouse, stick virtual e botões de pulo/agachar.
 */

const MOVE = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right'
};

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.axisX = 0;
        this.axisY = 0;
        this.camX = 0;
        this.look = { dx: 0, dy: 0 };
        this.zoom = 0;
        this.jumpQueued = false;
        this.jumpDown = false;
        this.crouchHeld = false;
        this.touchX = 0;
        this.touchY = 0;
        this.touchCam = 0;
        this.listeners = new Map();
        this.enabled = true;
        this.stickId = null;
        this.stickOrigin = null;
        this.lookId = null;
        this._bind();
    }

    on(name, fn) {
        if (!this.listeners.has(name)) this.listeners.set(name, new Set());
        this.listeners.get(name).add(fn);
    }

    emit(name) {
        this.listeners.get(name)?.forEach((fn) => fn());
    }

    consumeJump() {
        const v = this.jumpQueued;
        this.jumpQueued = false;
        return v;
    }

    consumeLook() {
        const out = { dx: this.look.dx, dy: this.look.dy, zoom: this.zoom };
        this.look.dx = this.look.dy = 0;
        this.zoom = 0;
        return out;
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

        let cam = this.touchCam;
        if (this.keys.has('camL')) cam -= 1;
        if (this.keys.has('camR')) cam += 1;
        this.camX = cam;
        this.crouchHeld = this.keys.has('crouch') || this._touchCrouch;
        return this;
    }

    bindTouch({ stick, knob, jump, crouch, camL, camR }) {
        this._knob = knob;
        const hold = (el, setter) => {
            if (!el) return;
            const on = (e) => {
                e.preventDefault();
                setter(true);
            };
            const off = () => setter(false);
            el.addEventListener('pointerdown', on);
            el.addEventListener('pointerup', off);
            el.addEventListener('pointercancel', off);
            el.addEventListener('pointerleave', off);
        };
        hold(jump, (v) => {
            this.jumpDown = v;
            if (v) this.jumpQueued = true;
        });
        hold(crouch, (v) => {
            this._touchCrouch = v;
        });
        hold(camL, (v) => {
            this.touchCam = v ? -1 : (this.touchCam < 0 ? 0 : this.touchCam);
        });
        hold(camR, (v) => {
            this.touchCam = v ? 1 : (this.touchCam > 0 ? 0 : this.touchCam);
        });

        if (!stick) return;
        stick.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            // Best-effort: lança InvalidStateError se o ponteiro já terminou.
            try {
                stick.setPointerCapture(e.pointerId);
            } catch (err) {
                /* segue sem captura */
            }
            this.stickId = e.pointerId;
            const rect = stick.getBoundingClientRect();
            this.stickOrigin = {
                x: rect.left + rect.width * 0.5,
                y: rect.top + rect.height * 0.5,
                r: Math.min(rect.width, rect.height) * 0.42
            };
            this._steer(e);
        });
        stick.addEventListener('pointermove', (e) => {
            if (this.stickId === e.pointerId) this._steer(e);
        });
        const end = (e) => {
            if (this.stickId !== e.pointerId) return;
            this.stickId = null;
            this.touchX = this.touchY = 0;
            this._updateKnob(0, 0);
        };
        stick.addEventListener('pointerup', end);
        stick.addEventListener('pointercancel', end);
    }

    _steer(e) {
        if (!this.stickOrigin) return;
        let x = (e.clientX - this.stickOrigin.x) / this.stickOrigin.r;
        let y = -(e.clientY - this.stickOrigin.y) / this.stickOrigin.r;
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
        if (!this._knob) return;
        this._knob.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
    }

    _bind() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyP' || e.code === 'Escape') this.emit('pause');
            if (e.code === 'KeyM') this.emit('mute');
            const move = MOVE[e.code];
            if (move) {
                e.preventDefault();
                this.keys.add(move);
            }
            if (e.code === 'KeyQ') this.keys.add('camL');
            if (e.code === 'KeyE') this.keys.add('camR');
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyZ' || e.code === 'ControlLeft') {
                this.keys.add('crouch');
            }
            if (e.code === 'Space') {
                e.preventDefault();
                this.jumpDown = true;
                if (!e.repeat) this.jumpQueued = true;
            }
        }, { passive: false });

        window.addEventListener('keyup', (e) => {
            const move = MOVE[e.code];
            if (move) this.keys.delete(move);
            if (e.code === 'KeyQ') this.keys.delete('camL');
            if (e.code === 'KeyE') this.keys.delete('camR');
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyZ' || e.code === 'ControlLeft') {
                this.keys.delete('crouch');
            }
            if (e.code === 'Space') this.jumpDown = false;
        });

        const el = this.canvas;
        el.addEventListener('pointerdown', (e) => {
            if (e.target.closest?.('.touch-controls, .hud-actions, header, .overlay')) return;
            // Best-effort: lança InvalidStateError se o ponteiro já terminou.
            try {
                el.setPointerCapture(e.pointerId);
            } catch (err) {
                /* segue sem captura */
            }
            this.lookId = e.pointerId;
            this._lastLook = { x: e.clientX, y: e.clientY };
            el.classList.add('is-dragging');
        });
        el.addEventListener('pointermove', (e) => {
            if (this.lookId !== e.pointerId || !this._lastLook) return;
            this.look.dx += e.clientX - this._lastLook.x;
            this.look.dy += e.clientY - this._lastLook.y;
            this._lastLook = { x: e.clientX, y: e.clientY };
        });
        const up = (e) => {
            if (this.lookId === e.pointerId) {
                this.lookId = null;
                el.classList.remove('is-dragging');
            }
        };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom += e.deltaY;
        }, { passive: false });

        window.addEventListener('blur', () => {
            this.keys.clear();
            this.touchX = this.touchY = 0;
            this.touchCam = 0;
        });
    }
}
