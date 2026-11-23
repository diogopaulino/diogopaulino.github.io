/**
 * Teclado, mouse e stick virtual. O vale lê `axis` (x, z), `run` e `jumpHeld` a cada frame.
 * Espaço = pulo / oferecer amora (o toque é consumido uma vez; segurar alonga o pulo).
 *
 * Stick analógico: |eixo| ∈ [0, 1] escala o trote; empurrado além de STICK_RUN
 * vira galope — a criança não precisa de um segundo dedo para correr.
 * Zona morta de 12% evita Nina "andando sozinha" com o dedo parado no centro.
 */

const STICK_DEAD = 0.12;
const STICK_RUN = 0.92;

export class Input {
    constructor(canvas) {
        this.canvas = canvas;
        this.keys = new Set();
        this.axis = { x: 0, y: 0, z: 0, mag: 0 };
        this.look = { dx: 0, dy: 0 };
        this.lookOut = { dx: 0, dy: 0, zoom: 0 };
        this.zoom = 0;
        this.jumpPressed = false;
        this.jumpHeld = false;
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

    consumeJump() {
        const v = this.jumpPressed;
        this.jumpPressed = false;
        return v;
    }

    /** Solta tudo: teclas, stick, pulo e arrasto (pausa, aba oculta, janela sem foco). */
    clear() {
        this.keys.clear();
        this.stick.x = this.stick.y = 0;
        this.jumpPressed = false;
        this.jumpHeld = false;
        this.look.dx = this.look.dy = 0;
        this.zoom = 0;
        this._resetKnob?.();
    }

    get run() {
        return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
            || Math.hypot(this.stick.x, this.stick.y) > STICK_RUN;
    }

    _bind() {
        window.addEventListener('keydown', (e) => {
            if (e.target.closest?.('input, select, textarea')) return;
            if (e.code === 'Space') e.preventDefault();
            if (e.repeat) return;
            if (e.code === 'KeyP' || e.code === 'Escape') this.emit('pause');
            if (e.code === 'KeyM') this.emit('mute');
            if (e.code === 'Space') {
                this.jumpPressed = true;
                this.jumpHeld = true;
            }
            this.keys.add(e.code);
        }, { passive: false });

        window.addEventListener('keyup', (e) => {
            this.keys.delete(e.code);
            if (e.code === 'Space') this.jumpHeld = false;
        });
        window.addEventListener('blur', () => {
            this.clear();
            this.emit('blur');
        });

        const el = this.canvas;
        el.addEventListener('pointerdown', (e) => {
            try { el.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
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
            prev.x = e.clientX;
            prev.y = e.clientY;
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
        el.addEventListener('lostpointercapture', up);
        el.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.zoom += e.deltaY;
        }, { passive: false });
        el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    bindTouch({ stick, knob, jump, run }) {
        if (!stick) return;
        // raio útil do stick em px (lido no pointerdown, não a cada movimento)
        let cx = 0;
        let cy = 0;
        let reach = 40;
        let owner = null;
        const setKnob = (x, y) => {
            knob.style.transform = `translate(${x * reach * 0.62}px, ${y * reach * 0.62}px)`;
        };
        this._resetKnob = () => {
            owner = null;
            setKnob(0, 0);
            stick.classList.remove('is-active');
        };
        const onMove = (e) => {
            let x = (e.clientX - cx) / reach;
            let y = (e.clientY - cy) / reach;
            const mag = Math.hypot(x, y);
            if (mag > 1) { x /= mag; y /= mag; }
            this.stick.x = x;
            this.stick.y = y;
            setKnob(x, y);
        };
        const end = (e) => {
            if (owner !== e.pointerId) return;
            this.stick.x = this.stick.y = 0;
            this._resetKnob();
        };
        stick.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            try { stick.setPointerCapture(e.pointerId); } catch { /* ok */ }
            const r = stick.getBoundingClientRect();
            cx = r.left + r.width / 2;
            cy = r.top + r.height / 2;
            reach = r.width * 0.42;
            owner = e.pointerId;
            stick.classList.add('is-active');
            onMove(e);
        }, { passive: false });
        stick.addEventListener('pointermove', (e) => {
            if (owner === e.pointerId) onMove(e);
        });
        stick.addEventListener('pointerup', end);
        stick.addEventListener('pointercancel', end);
        stick.addEventListener('lostpointercapture', end);

        if (jump) {
            jump.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                try { jump.setPointerCapture?.(e.pointerId); } catch { /* ok */ }
                this.jumpPressed = true;
                this.jumpHeld = true;
            }, { passive: false });
            const release = () => { this.jumpHeld = false; };
            jump.addEventListener('pointerup', release);
            jump.addEventListener('pointerleave', release);
            jump.addEventListener('pointercancel', release);
        }

        const hold = (btn, code) => {
            if (!btn) return;
            const down = (e) => { e.preventDefault(); this.keys.add(code); };
            const upFn = () => this.keys.delete(code);
            btn.addEventListener('pointerdown', down, { passive: false });
            btn.addEventListener('pointerup', upFn);
            btn.addEventListener('pointerleave', upFn);
            btn.addEventListener('pointercancel', upFn);
        };
        hold(run, 'ShiftLeft');

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.clear();
        });
    }

    /** Lê eixo e câmera do frame. Devolve o mesmo objeto `lookOut` (sem alocar). */
    sample() {
        let x = this.stick.x;
        let z = this.stick.y;
        // zona morta radial do stick, reescalada para 0..1
        const sm = Math.hypot(x, z);
        if (sm < STICK_DEAD) { x = 0; z = 0; } else {
            const k = Math.min(1, (sm - STICK_DEAD) / (1 - STICK_DEAD)) / sm;
            x *= k;
            z *= k;
        }
        if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
        if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
        if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) z -= 1;
        if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) z += 1;
        const mag = Math.hypot(x, z);
        const k = mag > 1 ? 1 / mag : 1;
        this.axis.x = x * k;
        this.axis.z = z * k;
        this.axis.mag = Math.min(1, mag);
        const out = this.lookOut;
        out.dx = this.look.dx;
        out.dy = this.look.dy;
        out.zoom = this.zoom;
        this.look.dx = this.look.dy = 0;
        this.zoom = 0;
        return out;
    }
}
