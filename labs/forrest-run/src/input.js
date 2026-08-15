/**
 * Sistema de Entrada (Teclado, Toque e Gestos de Swipe) para Forrest Run.
 *
 * Suporta:
 * - Teclado (A/D, Setas, W/Espaço, P, M, C, Enter)
 * - Gestos de Swipe no touch (Deslizar para os lados troca faixa; Deslizar para cima pula)
 * - Botões virtuais na tela para celular/tablet
 * - Feedback tátil (Haptic vibration) quando disponível
 */

const LANE = {
    ArrowLeft: -1,
    KeyA: -1,
    ArrowRight: 1,
    KeyD: 1
};

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Enter: 'confirm'
};

export class Input {
    constructor() {
        this.jump = false;
        this.laneLeft = false;
        this.laneRight = false;
        this.listeners = new Map();
        this.enabled = true;

        this._touchStartX = 0;
        this._touchStartY = 0;
        this._touchStartTime = 0;

        this._onKeyDown = (e) => {
            if (ACTIONS[e.code]) {
                if (ACTIONS[e.code] === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(ACTIONS[e.code]);
                e.preventDefault();
                return;
            }
            if (LANE[e.code] !== undefined && !e.repeat) {
                if (LANE[e.code] < 0) this.laneLeft = true;
                else this.laneRight = true;
                e.preventDefault();
            }
            if (JUMP.has(e.code) && !e.repeat) {
                this.jump = true;
                e.preventDefault();
            }
        };

        window.addEventListener('keydown', this._onKeyDown);
        this.bindSwipe();
    }

    bindSwipe() {
        const target = window;

        target.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const t = e.touches[0];
                this._touchStartX = t.clientX;
                this._touchStartY = t.clientY;
                this._touchStartTime = performance.now();
            }
        }, { passive: true });

        target.addEventListener('touchend', (e) => {
            if (!this.enabled || !e.changedTouches.length) return;
            const t = e.changedTouches[0];
            const dx = t.clientX - this._touchStartX;
            const dy = t.clientY - this._touchStartY;
            const dt = performance.now() - this._touchStartTime;

            // Gesto de swipe válido se rápido (< 450ms) e distância significativa (> 25px)
            if (dt < 450) {
                const absX = Math.abs(dx);
                const absY = Math.abs(dy);

                if (absX > 28 && absX > absY * 1.2) {
                    if (dx < 0) this.tapLane(-1);
                    else this.tapLane(1);
                } else if (dy < -28 && absY > absX * 1.2) {
                    this.tapJump();
                }
            }
        }, { passive: true });
    }

    vibrate(ms = 14) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
            try { navigator.vibrate(ms); } catch (_) {}
        }
    }

    on(action, fn) {
        if (!this.listeners.has(action)) this.listeners.set(action, new Set());
        this.listeners.get(action).add(fn);
    }

    emit(action) {
        this.listeners.get(action)?.forEach((fn) => fn());
    }

    tapLane(dir) {
        if (dir < 0) this.laneLeft = true;
        else if (dir > 0) this.laneRight = true;
        this.vibrate(12);
    }

    tapJump() {
        this.jump = true;
        this.vibrate(18);
    }

    sample() {
        if (!this.enabled) {
            this.jump = false;
            this.laneLeft = false;
            this.laneRight = false;
            return this;
        }
        const frame = {
            jump: this.jump,
            laneLeft: this.laneLeft,
            laneRight: this.laneRight
        };
        this.jump = false;
        this.laneLeft = false;
        this.laneRight = false;
        return frame;
    }
}
