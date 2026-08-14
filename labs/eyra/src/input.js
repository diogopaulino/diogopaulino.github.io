/**
 * Teclado, mouse e stick virtual.
 * axis.x = banco, axis.y = arfagem, axis.z = aceleração (W = −1).
 */

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.axis = { x: 0, y: 0, z: 0 };
        this.look = { dx: 0, dy: 0 };
        this.boostHeld = false;
        this.rollLeft = false;
        this.rollRight = false;
        this.dragging = false;
        this.pointers = new Map();
        this.stick = { x: 0, y: 0 };
        this.listeners = new Map();
        this._bind();
    }

    on(name, fn) {
        if (!this.listeners.has(name)) this.listeners.set(name, new Set());
        this.listeners.get(name).add(fn);
    }

    emit(name) {
        this.listeners.get(name)?.forEach((fn) => fn());
    }

    consumeRoll() {
        if (this.rollLeft) { this.rollLeft = false; return -1; }
        if (this.rollRight) { this.rollRight = false; return 1; }
        return 0;
    }

    _bind() {
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            if (e.code === 'KeyP' || e.code === 'Escape') this.emit('pause');
            if (e.code === 'KeyM') this.emit('mute');
            if (e.code === 'KeyC') this.emit('camera');
            if (e.code === 'KeyQ') this.rollLeft = true;
            if (e.code === 'KeyE') this.rollRight = true;
            if (e.code === 'Space') {
                this.boostHeld = true;
                e.preventDefault();
            }
            this.keys.add(e.code);
        }, { passive: false });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
            if (e.code === 'Space') this.boostHeld = false;
        });
        window.addEventListener('blur', () => {
            this.keys.clear();
            this.stick.x = this.stick.y = 0;
            this.boostHeld = false;
        });

        const el = this.canvas;
        el.addEventListener('pointerdown', (e) => {
            // Best-effort: lança InvalidStateError se o ponteiro já terminou.
            try {
                el.setPointerCapture(e.pointerId);
            } catch (err) {
                /* segue sem captura */
            }
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.pointers.size === 1) {
                this.dragging = true;
                el.classList.add('is-dragging');
            }
        });
        el.addEventListener('pointermove', (e) => {
            const prev = this.pointers.get(e.pointerId);
            if (!prev) return;
            this.look.dx += e.clientX - prev.x;
            this.look.dy += e.clientY - prev.y;
            this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        });
        const up = (e) => {
            this.pointers.delete(e.pointerId);
            if (this.pointers.size === 0) {
                this.dragging = false;
                el.classList.remove('is-dragging');
            }
        };
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    bindTouch({ stick, knob, boost, roll }) {
        if (!stick) return;
        const setKnob = (x, y) => {
            knob.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
        };
        const onMove = (e) => {
            const r = stick.getBoundingClientRect();
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const p = e.touches ? e.touches[0] : e;
            let x = (p.clientX - cx) / (r.width * 0.42);
            let y = (p.clientY - cy) / (r.height * 0.42);
            const mag = Math.hypot(x, y) || 1;
            if (mag > 1) { x /= mag; y /= mag; }
            this.stick.x = x;
            this.stick.y = y;
            setKnob(x, y);
        };
        const end = () => {
            this.stick.x = this.stick.y = 0;
            setKnob(0, 0);
        };
        stick.addEventListener('pointerdown', (e) => {
            // Best-effort: lança InvalidStateError se o ponteiro já terminou.
            try {
                stick.setPointerCapture(e.pointerId);
            } catch (err) {
                /* segue sem captura */
            }
            onMove(e);
        });
        stick.addEventListener('pointermove', (e) => {
            if (e.pressure === 0 && e.buttons === 0) return;
            onMove(e);
        });
        stick.addEventListener('pointerup', end);
        stick.addEventListener('pointercancel', end);

        const hold = (btn, onDown, onUp) => {
            if (!btn) return;
            btn.addEventListener('pointerdown', (e) => { e.preventDefault(); onDown(); });
            btn.addEventListener('pointerup', onUp);
            btn.addEventListener('pointerleave', onUp);
            btn.addEventListener('pointercancel', onUp);
        };
        hold(boost, () => { this.boostHeld = true; }, () => { this.boostHeld = false; });
        hold(roll, () => { this.rollRight = true; }, () => {});
    }

    sample() {
        let x = this.stick.x;
        let z = this.stick.y;
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
        let y = 0;
        if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyR')) y += 1;
        if (this.keys.has('ControlLeft') || this.keys.has('ControlRight') || this.keys.has('KeyF')) y -= 1;
        const mag = Math.hypot(x, z) || 1;
        this.axis.x = x / (mag > 1 ? mag : 1);
        this.axis.z = z / (mag > 1 ? mag : 1);
        this.axis.y = y;
        if (this.keys.has('Space')) this.boostHeld = true;
        const look = { dx: this.look.dx, dy: this.look.dy };
        this.look.dx = this.look.dy = 0;
        return look;
    }
}
