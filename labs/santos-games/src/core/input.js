// core/input.js — 8 ações canônicas: teclado + toque + clique no canvas + gamepad.

import { W, H } from './pixel.js';

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
        // Toques muito curtos podem começar e terminar entre dois frames — sem este buffer,
        // o jogo simplesmente não veria a tecla. Cada ação registrada aqui vale por um frame,
        // garantindo que todo apertar gere exatamente um `pressed`.
        this._buffered = new Set();
        // idade (ms) do último toque de cada ação e se ele já foi consumido — a base da
        // janela de tolerância de `buffered()`
        this._pressAge = {};
        this._spent = {};

        this._pauseCb = null;
        this._muteCb = null;

        this.ac = new AbortController();
        this._bindKeyboard();
        this._bindWindow();
        this._touchLayout = null;
        this._touchButtons = [];
        this.pointer = { x: W / 2, y: H / 2, down: false, clicked: false };
        this._clickLatch = false;
        this._pointerBound = false;
    }

    /** Clique/toque no canvas vira TAP (botão A) e guarda a posição em pixels do jogo. */
    attachPointer(canvas) {
        if (!canvas || this._pointerBound) return;
        this._pointerBound = true;
        const { signal } = this.ac;
        const toGame = (e) => {
            const r = canvas.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) return;
            this.pointer.x = ((e.clientX - r.left) / r.width) * W;
            this.pointer.y = ((e.clientY - r.top) / r.height) * H;
        };
        canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            toGame(e);
            this.pointer.down = true;
            this._clickLatch = true;
            this._buffered.add('a');
            this._touchDown.add('a');
            try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
        }, { signal });
        canvas.addEventListener('pointermove', toGame, { signal });
        const release = () => {
            this.pointer.down = false;
            this._touchDown.delete('a');
        };
        canvas.addEventListener('pointerup', release, { signal });
        canvas.addEventListener('pointercancel', release, { signal });
        canvas.addEventListener('lostpointercapture', release, { signal });
        canvas.style.touchAction = 'none';
        canvas.style.cursor = 'pointer';
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
            if (action) { this._kbDown.add(action); this._buffered.add(action); }
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
                this._buffered.add(action);
                if (navigator.vibrate) navigator.vibrate(8);
            };
            const release = () => this._touchDown.delete(action);
            btn.addEventListener('pointerdown', press, { signal });
            btn.addEventListener('pointerup', release, { signal });
            btn.addEventListener('pointercancel', release, { signal });
            btn.addEventListener('lostpointercapture', release, { signal });
        });
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
        this.pointer.clicked = this._clickLatch;
        this._clickLatch = false;
        this.pollGamepad();
        for (const a of ACTIONS) {
            const down = this._kbDown.has(a) || this._touchDown.has(a) ||
                this._gpDown.has(a) || this._buffered.has(a);
            const st = this.state[a];
            st.pressed = down && !this.prevDown[a];
            st.released = !down && this.prevDown[a];
            st.down = down;
            st.heldMs = down ? st.heldMs + dtMs : 0;
            this.prevDown[a] = down;

            // idade do último toque, para a janela de tolerância de `buffered()`
            if (st.pressed) { this._pressAge[a] = 0; this._spent[a] = false; }
            else if (this._pressAge[a] != null) this._pressAge[a] += dtMs;
        }
        this._buffered.clear();
    }

    /**
     * "Esse botão foi apertado nos últimos `windowMs`?"
     *
     * Em jogo de ação o jogador quase nunca aperta no frame exato em que a ação fica
     * disponível — ele aperta um pouco antes, enquanto ainda está no ar, ainda em cooldown,
     * ainda fora da janela de acerto. Ler só `pressed` joga esse toque fora e o jogo parece
     * não responder. Com a janela de tolerância o toque fica guardado e é gasto assim que a
     * ação abre, que é o que faz o controle parecer "grudado" no jogador.
     */
    buffered(action, windowMs = 120) {
        const age = this._pressAge[action];
        return age != null && age <= windowMs && !this._spent[action];
    }

    /** Marca o toque bufferizado como usado, para ele não disparar duas vezes. */
    consume(action) { this._spent[action] = true; }

    /**
     * Descarta todos os toques em buffer.
     * Chamado a cada troca de cena: sem isto o mesmo "Z" que confirma CONTINUAR no menu de
     * pausa ainda estaria dentro da janela de tolerância no primeiro quadro de volta ao jogo,
     * e sairia como uma manobra que o jogador não pediu.
     */
    flushBuffer() {
        for (const a of ACTIONS) this._spent[a] = true;
    }

    axisX() { return (this.state.right.down ? 1 : 0) - (this.state.left.down ? 1 : 0); }
    axisY() { return (this.state.down.down ? 1 : 0) - (this.state.up.down ? 1 : 0); }

    releaseAll() {
        this._kbDown.clear();
        this._touchDown.clear();
        this._gpDown.clear();
        this._buffered.clear();
        this._pressAge = {};
        this._spent = {};
    }

    dispose() { this.ac.abort(); }
}
