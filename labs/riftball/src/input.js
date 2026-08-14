/**
 * Teclado (P1 WASD, P2 setas), toque e atalhos de HUD.
 * sample(slot) devolve { throttle, steer, boost, jump }.
 */

const P1 = {
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right'
};
const P2 = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right'
};

export class Input {
    constructor() {
        this.keys = new Set();
        this.touchX = 0;
        this.touchY = 0;
        this.touchBoost = false;
        this.jumpQueued = [false, false];
        this.listeners = new Map();
        this.enabled = true;
        this.stickId = null;
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

    consumeJump(slot) {
        const v = this.jumpQueued[slot];
        this.jumpQueued[slot] = false;
        return v;
    }

    sample(slot) {
        let x = slot === 0 ? this.touchX : 0;
        let y = slot === 0 ? this.touchY : 0;
        const map = slot === 0 ? P1 : P2;
        if (this.keys.has(slot === 0 ? 'p1-left' : 'p2-left')) x -= 1;
        if (this.keys.has(slot === 0 ? 'p1-right' : 'p2-right')) x += 1;
        if (this.keys.has(slot === 0 ? 'p1-up' : 'p2-up')) y += 1;
        if (this.keys.has(slot === 0 ? 'p1-down' : 'p2-down')) y -= 1;
        const mag = Math.hypot(x, y);
        if (mag > 1) {
            x /= mag;
            y /= mag;
        }
        const boost = slot === 0
            ? this.keys.has('p1-boost') || this.touchBoost
            : this.keys.has('p2-boost');
        const jump = this.consumeJump(slot);
        return { throttle: y, steer: x, boost, jump };
    }

    _bind() {
        this._onKeyDown = (e) => {
            if (e.repeat) {
                if (['Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
                return;
            }
            if (e.code === 'KeyP' || e.code === 'Escape') {
                this.emit('pause');
                return;
            }
            if (e.code === 'KeyM') {
                this.emit('mute');
                return;
            }
            if (e.code === 'KeyC') {
                this.emit('camera');
                return;
            }
            if (!this.enabled) return;

            if (P1[e.code]) this.keys.add(`p1-${P1[e.code]}`);
            if (P2[e.code]) {
                e.preventDefault();
                this.keys.add(`p2-${P2[e.code]}`);
            }
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.add('p1-boost');
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') {
                e.preventDefault();
                this.keys.add('p2-boost');
            }
            if (e.code === 'Space') {
                e.preventDefault();
                this.jumpQueued[0] = true;
            }
            if (e.code === 'Period' || e.code === 'NumpadDecimal') this.jumpQueued[1] = true;
        };

        this._onKeyUp = (e) => {
            if (P1[e.code]) this.keys.delete(`p1-${P1[e.code]}`);
            if (P2[e.code]) this.keys.delete(`p2-${P2[e.code]}`);
            if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.delete('p1-boost');
            if (e.code === 'ControlLeft' || e.code === 'ControlRight') this.keys.delete('p2-boost');
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', () => this.keys.clear());
    }

    bindTouch({ zone, knob, boost, jump }) {
        if (!zone) return;
        const setKnob = (x, y) => {
            const max = 42;
            const px = x * max;
            const py = -y * max;
            if (knob) knob.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))`;
        };
        const sampleStick = (ev) => {
            const rect = zone.getBoundingClientRect();
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            let dx = (ev.clientX - cx) / (rect.width * 0.42);
            let dy = (cy - ev.clientY) / (rect.height * 0.42);
            const mag = Math.hypot(dx, dy);
            if (mag > 1) {
                dx /= mag;
                dy /= mag;
            }
            this.touchX = dx;
            this.touchY = dy;
            setKnob(dx, dy);
        };
        const endStick = () => {
            this.touchX = 0;
            this.touchY = 0;
            this.stickId = null;
            setKnob(0, 0);
        };

        zone.addEventListener('pointerdown', (ev) => {
            this.stickId = ev.pointerId;
            zone.setPointerCapture?.(ev.pointerId);
            sampleStick(ev);
        });
        zone.addEventListener('pointermove', (ev) => {
            if (this.stickId !== ev.pointerId) return;
            sampleStick(ev);
        });
        zone.addEventListener('pointerup', endStick);
        zone.addEventListener('pointercancel', endStick);

        const hold = (el, on, off) => {
            if (!el) return;
            const down = (ev) => {
                ev.preventDefault();
                on();
            };
            const up = () => off();
            el.addEventListener('pointerdown', down);
            el.addEventListener('pointerup', up);
            el.addEventListener('pointercancel', up);
            el.addEventListener('pointerleave', up);
        };
        hold(boost, () => { this.touchBoost = true; }, () => { this.touchBoost = false; });
        hold(jump, () => { this.jumpQueued[0] = true; }, () => {});
    }
}
