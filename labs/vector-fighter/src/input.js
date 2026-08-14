/**
 * Teclado + toque. Golpes são edge-triggered (buffer de 140 ms).
 * Eixos contínuos alimentam o movimento relativo à câmera.
 */

const AXIS = {
    KeyA: [-1, 0],
    ArrowLeft: [-1, 0],
    KeyD: [1, 0],
    ArrowRight: [1, 0],
    KeyW: [0, -1],
    ArrowUp: [0, -1],
    KeyS: [0, 1],
    ArrowDown: [0, 1]
};

export class Input {
    constructor() {
        this.keys = new Set();
        this.buffer = { punch: 0, kick: 0, throw: 0, jump: 0, dash: 0 };
        this.touch = { x: 0, z: 0, guard: false };
        this.tap = { dir: 0, time: 0 };
        this.listeners = new Map();
        this.enabled = true;

        this._down = (e) => {
            if (e.repeat) {
                if (AXIS[e.code]) e.preventDefault();
                return;
            }
            if (e.code === 'KeyP' || e.code === 'Escape') {
                this.emit('pause');
                e.preventDefault();
                return;
            }
            if (e.code === 'KeyM') {
                this.emit('mute');
                e.preventDefault();
                return;
            }
            if (e.code === 'Enter' || e.code === 'Space') {
                if (document.activeElement?.tagName === 'BUTTON') return;
                this.emit('confirm');
            }
            if (e.code === 'KeyJ' || e.code === 'KeyZ') this.buffer.punch = 0.14;
            if (e.code === 'KeyK' || e.code === 'KeyX') this.buffer.kick = 0.14;
            if (e.code === 'KeyL' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                this.keys.add('guard');
            }
            if (e.code === 'KeyC' || e.code === 'KeyV') this.buffer.throw = 0.14;
            if (e.code === 'Space') this.buffer.jump = 0.14;
            if (AXIS[e.code]) {
                this.keys.add(e.code);
                const dir = AXIS[e.code][0];
                if (dir) {
                    const now = performance.now();
                    if (this.tap.dir === dir && now - this.tap.time < 240) {
                        this.buffer.dash = 0.16;
                    }
                    this.tap = { dir, time: now };
                }
                e.preventDefault();
            }
            if (['KeyJ', 'KeyK', 'KeyL', 'KeyZ', 'KeyX', 'KeyC', 'Space'].includes(e.code)) {
                e.preventDefault();
            }
        };
        this._up = (e) => {
            this.keys.delete(e.code);
            if (e.code === 'KeyL' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
                this.keys.delete('guard');
            }
        };

        window.addEventListener('keydown', this._down);
        window.addEventListener('keyup', this._up);
    }

    on(name, fn) {
        if (!this.listeners.has(name)) this.listeners.set(name, new Set());
        this.listeners.get(name).add(fn);
    }

    emit(name) {
        this.listeners.get(name)?.forEach((fn) => fn());
    }

    tick(dt) {
        for (const k of Object.keys(this.buffer)) {
            this.buffer[k] = Math.max(0, this.buffer[k] - dt);
        }
    }

    consume(name) {
        const v = this.buffer[name] > 0;
        this.buffer[name] = 0;
        return v;
    }

    axes() {
        let x = this.touch.x;
        let z = this.touch.z;
        for (const code of this.keys) {
            const a = AXIS[code];
            if (!a) continue;
            x += a[0];
            z += a[1];
        }
        const len = Math.hypot(x, z);
        if (len > 1) {
            x /= len;
            z /= len;
        }
        return { x, z };
    }

    command() {
        const punch = this.consume('punch');
        const kick = this.consume('kick');
        return {
            x: 0,
            z: 0,
            punch,
            kick,
            sweep: kick && (this.keys.has('KeyS') || this.keys.has('ArrowDown') || this.touch.z > 0.5),
            throw: this.consume('throw') || (punch && kick),
            guard: this.keys.has('guard') || this.touch.guard,
            jump: this.consume('jump'),
            dash: this.consume('dash')
        };
    }

    setTouchAxis(x, z) {
        this.touch.x = x;
        this.touch.z = z;
    }

    setTouchGuard(on) {
        this.touch.guard = on;
    }

    tapPunch() { this.buffer.punch = 0.14; }
    tapKick() { this.buffer.kick = 0.14; }
    tapThrow() { this.buffer.throw = 0.14; }
    tapJump() { this.buffer.jump = 0.14; }
}
