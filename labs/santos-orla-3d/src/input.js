/**
 * Input teclado + toque (stick virtual, pad de olhar e botão de correr).
 *
 * Teclado: W/S ou ↑/↓ andar · A/D passo lateral (na bike: guidão) · ←/→ ou Q/E virar
 *          R/F inclinar a câmera · Shift correr (na bike: sprint).
 * Sem teclas presas: `blur`, aba oculta e perda de foco limpam tudo (clear()).
 */

const BLOCK_DEFAULT = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

export class Input {
    constructor() {
        this.forward = 0;
        this.strafe = 0;
        this.turn = 0;
        this.lookY = 0;
        this.run = false;
        this.runToggle = false; // botão "Correr" do toque
        this.keys = new Set();
        this.touch = { active: false, x: 0, y: 0, lookX: 0, lookY: 0 };
        this._bound = false;
    }

    bind() {
        if (this._bound) return;
        this._bound = true;
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('blur', this.clear);
        document.addEventListener('visibilitychange', this.onVisibility);
    }

    unbind() {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('blur', this.clear);
        document.removeEventListener('visibilitychange', this.onVisibility);
        this._bound = false;
    }

    /** Solta tudo (troca de aba, perda de foco, pausa). */
    clear = () => {
        this.keys.clear();
        this.touch.active = false;
        this.touch.x = this.touch.y = 0;
        this.touch.lookX = this.touch.lookY = 0;
        this.forward = this.strafe = this.turn = this.lookY = 0;
        this.run = false;
    };

    onVisibility = () => {
        if (document.hidden) this.clear();
    };

    onKeyDown = (e) => {
        const tag = e.target?.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
        if (e.metaKey || e.ctrlKey) return;
        this.keys.add(e.code);
        if (BLOCK_DEFAULT.has(e.code)) e.preventDefault();
    };

    onKeyUp = (e) => {
        this.keys.delete(e.code);
        // macOS não envia keyup das outras teclas enquanto Cmd está pressionado
        if (e.key === 'Meta') this.keys.clear();
    };

    setTouchMove(x, y) {
        this.touch.active = Math.hypot(x, y) > 0.05;
        this.touch.x = x;
        this.touch.y = y;
    }

    setTouchLook(dx, dy) {
        this.touch.lookX = dx;
        this.touch.lookY = dy;
    }

    poll() {
        const k = this.keys;
        let forward = 0;
        let strafe = 0;
        let turn = 0;
        let lookY = 0;

        if (k.has('KeyW') || k.has('ArrowUp')) forward += 1;
        if (k.has('KeyS') || k.has('ArrowDown')) forward -= 1;
        if (k.has('KeyA')) strafe -= 1;
        if (k.has('KeyD')) strafe += 1;
        if (k.has('ArrowLeft') || k.has('KeyQ')) turn += 1;
        if (k.has('ArrowRight') || k.has('KeyE')) turn -= 1;
        if (k.has('KeyR')) lookY += 1;
        if (k.has('KeyF')) lookY -= 1;

        if (this.touch.active) {
            forward += -this.touch.y;
            strafe += this.touch.x;
        }
        turn += -this.touch.lookX * 1.8;
        lookY += -this.touch.lookY * 1.2;

        // decay touch look
        this.touch.lookX *= 0.85;
        this.touch.lookY *= 0.85;

        this.forward = Math.max(-1, Math.min(1, forward));
        this.strafe = Math.max(-1, Math.min(1, strafe));
        this.turn = Math.max(-1, Math.min(1, turn));
        this.lookY = Math.max(-1, Math.min(1, lookY));
        this.run = k.has('ShiftLeft') || k.has('ShiftRight') || this.runToggle;

        return this;
    }
}
