/**
 * Teclado, toque, controle (Gamepad API) e ações globais (pausa, mudo, câmera).
 *
 * Saída de sample(dt): { steer −1..1, throttle 0..1, brake 0..1, nitro bool }.
 *   • Teclado: o esterço digital sobe em rampa (0 → 1 em ~0,16 s, volta em ~0,1 s) — sem isso
 *     a moto "chicoteia" a cada toque de seta.
 *   • Acelerador automático (padrão): acelera sempre que não está freando. Desligado, ↑/W/gatilho
 *     direito acelera e soltar usa o freio-motor. No toque é sempre automático (2 pedais bastam).
 *   • blur / aba oculta zeram tudo: tecla presa nunca mantém a moto acelerando ou virando.
 */

const STEER = {
    ArrowLeft: -1,
    KeyA: -1,
    ArrowRight: 1,
    KeyD: 1
};

const HOLD = {
    ArrowUp: 'throttle',
    KeyW: 'throttle',
    ArrowDown: 'brake',
    KeyS: 'brake',
    ShiftLeft: 'nitro',
    ShiftRight: 'nitro',
    Space: 'nitro'
};

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Enter: 'confirm',
    KeyR: 'radio'
};

const STEER_RISE = 6.5;
const STEER_FALL = 10;
const DEADZONE = 0.14;

export class Input {
    constructor() {
        this.steer = 0;
        this.throttle = 0;
        this.brake = 0;
        this.nitro = false;
        this.keySteer = 0;
        this.keys = new Set();
        this.listeners = new Map();
        this.touchSteer = 0;
        this.touchBoost = false;
        this.touchBrake = false;
        this.touchActive = false;
        this.autoThrottle = true;
        this.enabled = true;
        this.padPrev = [];

        this._onKeyDown = (e) => {
            if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
            const action = ACTIONS[e.code];
            if (action) {
                if (action === 'confirm' && e.target instanceof Element && e.target.closest('button, a, summary')) return;
                if (e.repeat) return;
                this.emit(action);
                e.preventDefault();
            }
            if (STEER[e.code] !== undefined || HOLD[e.code]) {
                // Espaço em botão focado continua clicando o botão (menus); no jogo vira nitro
                if (e.code === 'Space' && e.target instanceof Element && e.target.closest('button, summary, a')) return;
                this.keys.add(e.code);
                e.preventDefault();
            }
        };
        this._onKeyUp = (e) => {
            this.keys.delete(e.code);
        };

        const clear = () => this.clear();
        window.addEventListener('blur', clear);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clear();
        });
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    /** Solta tudo (troca de aba, pausa, fim de corrida). */
    clear() {
        this.keys.clear();
        this.keySteer = 0;
        this.touchSteer = 0;
        this.touchBoost = false;
        this.touchBrake = false;
        this.steer = 0;
        this.throttle = 0;
        this.brake = 0;
        this.nitro = false;
    }

    on(action, fn) {
        if (!this.listeners.has(action)) this.listeners.set(action, new Set());
        this.listeners.get(action).add(fn);
    }

    emit(action) {
        this.listeners.get(action)?.forEach((fn) => fn());
    }

    setTouchSteer(v) { this.touchSteer = v; }
    setTouchBoost(v) { this.touchBoost = v; }
    setTouchBrake(v) { this.touchBrake = v; }

    /** Controle: lê o primeiro gamepad conectado e dispara ações na borda de subida dos botões. */
    readPad() {
        const pads = navigator.getGamepads?.();
        if (!pads) return null;
        let pad = null;
        for (const p of pads) if (p && p.connected) { pad = p; break; }
        if (!pad) return null;
        const btn = (i) => (pad.buttons[i] ? pad.buttons[i].value || (pad.buttons[i].pressed ? 1 : 0) : 0);
        const edge = (i, action) => {
            const down = btn(i) > 0.5;
            if (down && !this.padPrev[i]) this.emit(action);
            this.padPrev[i] = down;
        };
        edge(9, 'pause');      // Start
        edge(3, 'camera');     // Y / △
        edge(2, 'radio');      // X / □
        edge(8, 'mute');       // Select / Back
        edge(0, 'confirm');    // A / ✕ (menus)
        const ax = pad.axes[0] || 0;
        const steer = Math.abs(ax) < DEADZONE ? 0 : (ax - Math.sign(ax) * DEADZONE) / (1 - DEADZONE);
        const out = {
            steer: steer + (btn(15) - btn(14)),
            throttle: btn(7),
            brake: btn(6),
            nitro: btn(0) > 0.5 || btn(5) > 0.5
        };
        return out;
    }

    sample(dt = 1 / 60) {
        const pad = this.readPad();
        if (!this.enabled) {
            this.steer = 0;
            this.throttle = 0;
            this.brake = 0;
            this.nitro = false;
            return this;
        }

        let target = 0;
        let throttleKey = false;
        let brakeKey = false;
        let nitroKey = false;
        for (const code of this.keys) {
            if (STEER[code] !== undefined) target += STEER[code];
            const hold = HOLD[code];
            if (hold === 'throttle') throttleKey = true;
            else if (hold === 'brake') brakeKey = true;
            else if (hold === 'nitro') nitroKey = true;
        }
        target = Math.max(-1, Math.min(1, target));
        // rampa do esterço digital (sobe mais devagar do que volta)
        const rate = target !== 0 && Math.sign(target) === Math.sign(this.keySteer || target) ? STEER_RISE : STEER_FALL;
        const delta = target - this.keySteer;
        this.keySteer += Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);

        let steer = this.keySteer + this.touchSteer;
        let brake = brakeKey || this.touchBrake ? 1 : 0;
        let throttle = throttleKey ? 1 : 0;
        let nitro = nitroKey || this.touchBoost;
        if (pad) {
            steer += pad.steer;
            brake = Math.max(brake, pad.brake);
            throttle = Math.max(throttle, pad.throttle);
            nitro = nitro || pad.nitro;
        }
        // acelerador automático: no toque sempre; no teclado/controle se a opção estiver ligada
        const auto = this.touchActive || this.autoThrottle;
        if (auto && brake < 0.05) throttle = 1;
        if (brake > 0.05) throttle = Math.min(throttle, 1 - brake);

        this.steer = Math.max(-1, Math.min(1, steer));
        this.throttle = throttle;
        this.brake = brake;
        this.nitro = nitro;
        return this;
    }
}
