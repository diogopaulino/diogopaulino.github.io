/**
 * Entrada do passeio: teclado, mouse, toque e analógico virtual.
 *
 *   teclado   WASD / setas movem · Shift corre (segurar)
 *   mouse     arrastar no canvas gira a câmera · rolagem aproxima
 *   toque     o polegar na metade esquerda faz nascer um analógico flutuante onde tocou;
 *             arrastar no resto da tela gira a câmera; o botão "Correr" alterna a corrida.
 *   analógico v = (Δx, Δy) / R, |v| ≤ 1, zona morta 0,12 (re-escalada para começar em 0)
 *
 * `clear()` solta tudo (blur, aba oculta, pausa): nenhuma tecla fica presa.
 * Nada é alocado por quadro: `move` é reaproveitado e o "look" acumula em números.
 */

const R = 56; // raio do analógico (px)
const DEAD = 0.12;
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

export class Input {
    constructor(canvas, { zone, base, knob }) {
        this.canvas = canvas;
        this.zone = zone;
        this.base = base;
        this.knob = knob;
        this.enabled = false;
        this.keys = new Set();
        this.move = { x: 0, y: 0, sprint: false };
        this.runToggle = false;
        this.lookX = 0;
        this.lookY = 0;
        this.zoom = 0;
        this.stickId = -1;
        this.stick = { ox: 0, oy: 0, x: 0, y: 0 };
        this.lookId = -1;
        this.lastX = 0;
        this.lastY = 0;
        this.dragging = false;

        window.addEventListener('keydown', (e) => {
            if (!this.enabled || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
            if (MOVE_KEYS.has(e.code)) {
                this.keys.add(e.code);
                if (e.code.startsWith('Arrow')) e.preventDefault();
            }
        });
        window.addEventListener('keyup', (e) => this.keys.delete(e.code));

        canvas.addEventListener('pointerdown', (e) => this.onLookDown(e));
        canvas.addEventListener('pointermove', (e) => this.onLookMove(e));
        canvas.addEventListener('pointerup', (e) => this.onLookUp(e));
        canvas.addEventListener('pointercancel', (e) => this.onLookUp(e));
        canvas.addEventListener('wheel', (e) => {
            if (!this.enabled) return;
            e.preventDefault();
            this.zoom += Math.sign(e.deltaY) * Math.min(3, Math.abs(e.deltaY) / 100 + 0.4);
        }, { passive: false });

        if (zone) {
            zone.addEventListener('pointerdown', (e) => this.onStickDown(e));
            zone.addEventListener('pointermove', (e) => this.onStickMove(e));
            zone.addEventListener('pointerup', (e) => this.onStickUp(e));
            zone.addEventListener('pointercancel', (e) => this.onStickUp(e));
        }
    }

    setEnabled(on) {
        this.enabled = on;
        if (!on) this.clear();
    }

    /** Solta teclas, analógico e arrasto (blur, pausa, aba oculta). */
    clear() {
        this.keys.clear();
        this.lookX = this.lookY = this.zoom = 0;
        this.lookId = -1;
        this.dragging = false;
        this.canvas.classList.remove('is-dragging');
        this.onStickUp(null);
    }

    onLookDown(e) {
        if (!this.enabled || this.lookId !== -1) return;
        this.lookId = e.pointerId;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.dragging = true;
        this.canvas.classList.add('is-dragging');
        try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
    }

    onLookMove(e) {
        if (e.pointerId !== this.lookId) return;
        const k = e.pointerType === 'touch' ? 1.35 : 1;
        this.lookX += (e.clientX - this.lastX) * k;
        this.lookY += (e.clientY - this.lastY) * k;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
    }

    onLookUp(e) {
        if (e.pointerId !== this.lookId) return;
        this.lookId = -1;
        this.dragging = false;
        this.canvas.classList.remove('is-dragging');
    }

    onStickDown(e) {
        if (!this.enabled || this.stickId !== -1) return;
        e.preventDefault();
        this.stickId = e.pointerId;
        const r = this.zone.getBoundingClientRect();
        // o analógico nasce onde o polegar tocou (afastado da borda o bastante para caber)
        this.stick.ox = Math.min(r.width - R - 8, Math.max(R + 8, e.clientX - r.left));
        this.stick.oy = Math.min(r.height - R - 8, Math.max(R + 8, e.clientY - r.top));
        this.stick.x = this.stick.y = 0;
        this.base.style.transform = `translate(${this.stick.ox - R}px, ${this.stick.oy - R}px)`;
        this.base.classList.add('is-active');
        this.knob.style.transform = 'translate(0px, 0px)';
        try { this.zone.setPointerCapture(e.pointerId); } catch { /* ponteiro já solto */ }
        this.onStickMove(e);
    }

    onStickMove(e) {
        if (e.pointerId !== this.stickId) return;
        const r = this.zone.getBoundingClientRect();
        let dx = e.clientX - r.left - this.stick.ox;
        let dy = e.clientY - r.top - this.stick.oy;
        const len = Math.hypot(dx, dy);
        if (len > R) {
            dx *= R / len;
            dy *= R / len;
        }
        this.stick.x = dx / R;
        this.stick.y = dy / R;
        this.knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    }

    onStickUp(e) {
        if (e && e.pointerId !== this.stickId) return;
        this.stickId = -1;
        this.stick.x = this.stick.y = 0;
        this.base?.classList.remove('is-active');
        if (this.knob) this.knob.style.transform = 'translate(0px, 0px)';
    }

    /** Atualiza e devolve `move` (x = direita, y = frente, |v| ≤ 1). */
    readMove() {
        const k = this.keys;
        let x = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
        let y = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
        if (this.stickId !== -1) {
            const sx = this.stick.x;
            const sy = -this.stick.y;
            const m = Math.hypot(sx, sy);
            if (m > DEAD) {
                const s = (m - DEAD) / (1 - DEAD) / m;
                x += sx * s;
                y += sy * s;
            }
        }
        const m = Math.hypot(x, y);
        if (m > 1) {
            x /= m;
            y /= m;
        }
        this.move.x = x;
        this.move.y = y;
        this.move.sprint = k.has('ShiftLeft') || k.has('ShiftRight') || this.runToggle;
        return this.move;
    }

    /** Devolve e zera o arrasto acumulado (px) e a rolagem. */
    consumeLook(out) {
        out.x = this.lookX;
        out.y = this.lookY;
        out.zoom = this.zoom;
        this.lookX = this.lookY = this.zoom = 0;
        return out;
    }
}
