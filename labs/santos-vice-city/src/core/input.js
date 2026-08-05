// core/input.js — 8 ações canônicas: teclado + touch (overlay DOM) + gamepad, tudo por OR.
// Teto: ~230 linhas.

const ACTIONS = ['up', 'down', 'left', 'right', 'a', 'b', 'start', 'select'];

const KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
    KeyZ: 'a', KeyJ: 'a', Space: 'a',
    KeyX: 'b', KeyK: 'b',
    Enter: 'start',
    ShiftLeft: 'select', ShiftRight: 'select'
};
const PREVENT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

const GAMEPAD_BTN = { 12: 'up', 13: 'down', 14: 'left', 15: 'right', 0: 'a', 2: 'a', 1: 'b', 3: 'b', 9: 'start', 8: 'select' };

export class InputManager {
    constructor(root) {
        this.root = root || document;
        this.state = {};
        this.prevDown = {};
        for (const a of ACTIONS) this.state[a] = { down: false, pressed: false, released: false, heldMs: 0 };

        this._kbDown = new Set();
        this._touchDown = new Set();
        this._gpDown = new Set();

        this._pauseCb = null;
        this._muteCb = null;

        this.ac = new AbortController();
        this._bindKeyboard();
        this._bindWindow();
        this._touchLayout = null;
        this._touchButtons = [];
    }

    onPause(cb) { this._pauseCb = cb; }
    onMute(cb) { this._muteCb = cb; }

    _bindKeyboard() {
        const { signal } = this.ac;
        window.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            if (PREVENT_KEYS.has(e.code)) e.preventDefault();
            if (e.code === 'Escape' || e.code === 'KeyP') { this._pauseCb && this._pauseCb(); return; }
            if (e.code === 'KeyM') { this._muteCb && this._muteCb(); return; }
            const action = KEY_MAP[e.code];
            if (action) this._kbDown.add(action);
        }, { signal, passive: false });
        window.addEventListener('keyup', (e) => {
            const action = KEY_MAP[e.code];
            if (action) this._kbDown.delete(action);
        }, { signal });
    }

    _bindWindow() {
        const { signal } = this.ac;
        window.addEventListener('blur', () => this.releaseAll(), { signal });
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.releaseAll();
        }, { signal });
    }

    /** Liga o overlay de toque. layout: 'FULL' | 'LR' | 'UD' | null (esconde). */
    attachTouch(overlayEl, layout) {
        this._touchLayout = layout;
        if (!overlayEl) return;
        overlayEl.classList.remove('tp--full', 'tp--lr', 'tp--ud', 'tp--hidden');
        if (!layout) { overlayEl.classList.add('tp--hidden'); return; }
        overlayEl.classList.add(layout === 'FULL' ? 'tp--full' : layout === 'LR' ? 'tp--lr' : 'tp--ud');

        if (this._touchBound) return;
        this._touchBound = true;
        const { signal } = this.ac;
        const buttons = overlayEl.querySelectorAll('[data-btn]');
        buttons.forEach((btn) => {
            const action = btn.dataset.btn;
            const press = (e) => {
                e.preventDefault();
                try { btn.setPointerCapture(e.pointerId); } catch { /* noop */ }
                this._touchDown.add(action);
                if (navigator.vibrate) navigator.vibrate(8);
            };
            const release = () => this._touchDown.delete(action);
            btn.addEventListener('pointerdown', press, { signal });
            btn.addEventListener('pointerup', release, { signal });
            btn.addEventListener('pointercancel', release, { signal });
            btn.addEventListener('lostpointercapture', release, { signal });
        });
        const pauseBtn = overlayEl.querySelector('[data-btn="start"]');
        void pauseBtn;
    }

    pollGamepad() {
        if (!navigator.getGamepads) return;
        this._gpDown.clear();
        const pads = navigator.getGamepads();
        for (const gp of pads) {
            if (!gp) continue;
            gp.buttons.forEach((b, i) => {
                if (b.pressed && GAMEPAD_BTN[i]) this._gpDown.add(GAMEPAD_BTN[i]);
            });
            const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
            const dz = 0.35;
            if (ax < -dz) this._gpDown.add('left');
            if (ax > dz) this._gpDown.add('right');
            if (ay < -dz) this._gpDown.add('up');
            if (ay > dz) this._gpDown.add('down');
        }
    }

    /** Chamar uma vez por frame de update, com dt em ms. */
    update(dtMs) {
        this.pollGamepad();
        for (const a of ACTIONS) {
            const down = this._kbDown.has(a) || this._touchDown.has(a) || this._gpDown.has(a);
            const st = this.state[a];
            st.pressed = down && !this.prevDown[a];
            st.released = !down && this.prevDown[a];
            st.down = down;
            st.heldMs = down ? st.heldMs + dtMs : 0;
            this.prevDown[a] = down;
        }
    }

    axisX() { return (this.state.right.down ? 1 : 0) - (this.state.left.down ? 1 : 0); }
    axisY() { return (this.state.down.down ? 1 : 0) - (this.state.up.down ? 1 : 0); }

    releaseAll() {
        this._kbDown.clear();
        this._touchDown.clear();
        this._gpDown.clear();
    }

    dispose() { this.ac.abort(); }
}
