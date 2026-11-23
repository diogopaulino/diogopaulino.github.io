/**
 * Input: teclado, mouse, pointer lock e um stick virtual para toque.
 * `move.jump` é o toque (pulso) e `move.jumpHeld` o estado segurado — o controlador usa o
 * pulso para o jump buffer e o segurado para o pulo variável.
 * Zona morta do stick: 12 % do raio; a resposta é reescalada para 0…1 fora dela.
 */

export class InputManager {
    constructor(dom) {
        this.dom = dom;
        this.keys = Object.create(null);
        this.move = { x: 0, z: 0, sprint: false, crouch: false, jump: false, jumpHeld: false };
        this.look = { x: 0, y: 0 };
        this.zoom = 0;
        this.locked = false;
        this.interact = false;
        this.attack = false;
        this.block = false;
        this.pause = false;
        this.tab = false;
        this.advance = false;
        this._lookBuffer = { x: 0, y: 0 };
        this._lookOut = { x: 0, y: 0 };
        this._drag = null;
        this._rmb = false;
        this.enabled = true;
        /* Estado alimentado pelos controles de toque (ver setupTouch). */
        this.touch = { x: 0, z: 0, sprint: false, crouch: false, block: false, jump: false, active: false };
        this._touchCleanup = [];
        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);
        this._onMouseMove = this.onMouseMove.bind(this);
        this._onMouseDown = this.onMouseDown.bind(this);
        this._onMouseUp = this.onMouseUp.bind(this);
        this._onPointerDown = this.onPointerDown.bind(this);
        this._onPointerMove = this.onPointerMove.bind(this);
        this._onPointerUp = this.onPointerUp.bind(this);
        this._onWheel = this.onWheel.bind(this);
        this._onLockChange = this.onLockChange.bind(this);
        this._onContext = (e) => e.preventDefault();
        /* Janela perdeu o foco (alt-tab, notificação): solta as teclas, senão Dico
           continua andando sozinho porque o keyup nunca chega. */
        this._onBlur = () => this.release();
        this.lockLost = false;
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('mousemove', this._onMouseMove);
        dom.addEventListener('mousedown', this._onMouseDown);
        window.addEventListener('mouseup', this._onMouseUp);
        dom.addEventListener('pointerdown', this._onPointerDown);
        dom.addEventListener('pointermove', this._onPointerMove);
        window.addEventListener('pointerup', this._onPointerUp);
        dom.addEventListener('wheel', this._onWheel, { passive: false });
        document.addEventListener('pointerlockchange', this._onLockChange);
        dom.addEventListener('contextmenu', this._onContext);
        window.addEventListener('blur', this._onBlur);
        this.setupTouch();
    }

    /**
     * Liga o stick virtual, a área de câmera e os botões de ação. Sem ponteiro
     * grosso nada é registrado — no desktop os controles nem são exibidos.
     */
    setupTouch() {
        const layer = document.getElementById('touchControls');
        if (!layer || !window.matchMedia?.('(pointer: coarse)').matches) return;

        const on = (el, type, fn, opts) => {
            el.addEventListener(type, fn, opts);
            this._touchCleanup.push(() => el.removeEventListener(type, fn, opts));
        };

        /* Stick: o deslocamento a partir do centro vira um vetor -1..1. */
        const stick = layer.querySelector('[data-touch-stick]');
        const knob = layer.querySelector('.touch-stick-knob');
        const STICK_RADIUS = 46;
        let stickId = null;
        let originX = 0;
        let originY = 0;

        const stickEnd = (e) => {
            if (stickId === null || (e && e.pointerId !== stickId)) return;
            stickId = null;
            this.touch.x = 0;
            this.touch.z = 0;
            stick.classList.remove('is-active');
            if (knob) knob.style.transform = '';
        };

        on(stick, 'pointerdown', (e) => {
            e.preventDefault();
            stickId = e.pointerId;
            const rect = stick.getBoundingClientRect();
            originX = rect.left + rect.width / 2;
            originY = rect.top + rect.height / 2;
            try { stick.setPointerCapture?.(e.pointerId); } catch { /* ponteiro já solto */ }
            stick.classList.add('is-active');
        }, { passive: false });

        on(stick, 'pointermove', (e) => {
            if (e.pointerId !== stickId) return;
            e.preventDefault();
            let dx = e.clientX - originX;
            let dy = e.clientY - originY;
            const len = Math.hypot(dx, dy);
            if (len > STICK_RADIUS) {
                dx = (dx / len) * STICK_RADIUS;
                dy = (dy / len) * STICK_RADIUS;
            }
            /* zona morta de 12 % e resposta reescalada: o boneco não anda sozinho com o
               dedo apoiado, e meia inclinação = andar devagar */
            const r = Math.hypot(dx, dy) / STICK_RADIUS;
            const k = r < 0.12 ? 0 : (r - 0.12) / 0.88 / (r || 1);
            this.touch.x = (dx / STICK_RADIUS) * k;
            this.touch.z = (dy / STICK_RADIUS) * k;
            if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
        }, { passive: false });

        on(stick, 'pointerup', stickEnd);
        on(stick, 'pointercancel', stickEnd);

        /* Câmera: arrastar em qualquer área livre da tela. */
        const lookZone = layer.querySelector('[data-touch-look]');
        const LOOK_SENSITIVITY = 1.9;
        let lookId = null;
        let lastX = 0;
        let lastY = 0;

        const lookEnd = (e) => {
            if (lookId === null || (e && e.pointerId !== lookId)) return;
            lookId = null;
        };

        on(lookZone, 'pointerdown', (e) => {
            e.preventDefault();
            lookId = e.pointerId;
            lastX = e.clientX;
            lastY = e.clientY;
            try { lookZone.setPointerCapture?.(e.pointerId); } catch { /* ponteiro já solto */ }
        }, { passive: false });

        on(lookZone, 'pointermove', (e) => {
            if (e.pointerId !== lookId || !this.enabled) return;
            this._lookBuffer.x += (e.clientX - lastX) * LOOK_SENSITIVITY;
            this._lookBuffer.y += (e.clientY - lastY) * LOOK_SENSITIVITY;
            lastX = e.clientX;
            lastY = e.clientY;
        });

        on(lookZone, 'pointerup', lookEnd);
        on(lookZone, 'pointercancel', lookEnd);

        /* Botões: pular/avançar, interagir, atacar, defender, correr, agachar. */
        layer.querySelectorAll('[data-touch]').forEach((btn) => {
            const action = btn.dataset.touch;
            const toggle = action === 'sprint' || action === 'crouch';

            on(btn, 'pointerdown', (e) => {
                e.preventDefault();
                try { btn.setPointerCapture?.(e.pointerId); } catch { /* ok */ }
                btn.classList.add('is-active');
                this.applyTouchAction(action, true);
                if (toggle) btn.setAttribute('aria-pressed', String(this.touch[action]));
            }, { passive: false });

            const release = () => {
                btn.classList.remove('is-active');
                if (!toggle) this.applyTouchAction(action, false);
            };

            on(btn, 'pointerup', release);
            on(btn, 'pointercancel', release);
            on(btn, 'pointerleave', release);
        });

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) this.release();
        });

        this.touch.active = true;
    }

    applyTouchAction(action, down) {
        if (action === 'jump') {
            this.touch.jump = down;
            if (down) {
                this.move.jump = true;
                this.advance = true;
            }
            return;
        }
        if (action === 'interact') {
            if (down) this.interact = true;
            return;
        }
        if (action === 'attack') {
            if (down) this.attack = true;
            return;
        }
        if (action === 'pause') {
            if (down) this.pause = true;
            return;
        }
        if (action === 'block') {
            this.touch.block = down;
            return;
        }
        if (action === 'sprint' || action === 'crouch') {
            /* Correr e agachar são travas: segurar o botão o jogo inteiro numa
               tela de toque é inviável. */
            if (down) this.touch[action] = !this.touch[action];
        }
    }

    requestLock() {
        if (this.locked || this.touch.active) return;
        /* Sem gesto do usuário (Esc para sair da pausa) o Chrome recusa a trava com uma
           promessa rejeitada — o jogo segue com arrastar-para-olhar, sem erro no console. */
        try {
            const req = this.dom.requestPointerLock?.();
            req?.catch?.(() => {});
        } catch { /* navegador sem trava de cursor */ }
    }

    exitLock() {
        if (document.pointerLockElement) document.exitPointerLock();
    }

    onLockChange() {
        const was = this.locked;
        this.locked = document.pointerLockElement === this.dom;
        /* Esc com o cursor travado não chega como keydown: o jogo pausa por aqui. */
        if (was && !this.locked) this.lockLost = true;
    }

    onKeyDown(e) {
        if (e.repeat) return;
        /* Teclado navegando num menu (pausa, configurações): Espaço/Enter acionam o botão
           focado, não pulam nem avançam fala. Só o Esc segue para o jogo. */
        if (e.code !== 'Escape' && e.target instanceof Element && e.target.closest('.overlay')) return;
        if (e.code === 'Tab') e.preventDefault();
        this.keys[e.code] = true;
        if (e.code === 'KeyE') this.interact = true;
        if (e.code === 'KeyF') this.attack = true;
        if (e.code === 'Space') {
            e.preventDefault();
            this.move.jump = true;
            this.advance = true;
        }
        if (e.code === 'Escape') this.pause = true;
        if (e.code === 'Tab') this.tab = true;
        if (e.code === 'Enter') this.advance = true;
    }

    onKeyUp(e) {
        this.keys[e.code] = false;
    }

    onMouseMove(e) {
        if (!this.locked || !this.enabled) return;
        this._lookBuffer.x += e.movementX;
        this._lookBuffer.y += e.movementY;
    }

    onMouseDown(e) {
        if (this.touch.active || !this.enabled) return;
        if (e.button === 2) this._rmb = true;
    }

    onMouseUp(e) {
        if (e.button === 2) this._rmb = false;
    }

    /* Sem pointer lock o jogo continua jogável: arrastar olha, um clique
       curto ataca. A trava do cursor é opcional e só entra nesse clique. */
    onPointerDown(e) {
        // Safari/iOS: toque pode chegar com button === -1; com HUD de toque ativo, ignore.
        if (this.touch.active || !this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
        this._drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    }

    onPointerMove(e) {
        if (!this._drag || e.pointerId !== this._drag.id || this.locked) return;
        const dx = e.clientX - this._drag.x;
        const dy = e.clientY - this._drag.y;
        if (dx * dx + dy * dy > 16) this._drag.moved = true;
        this._lookBuffer.x += dx * 1.25;
        this._lookBuffer.y += dy * 1.25;
        this._drag.x = e.clientX;
        this._drag.y = e.clientY;
    }

    onPointerUp(e) {
        if (!this._drag || e.pointerId !== this._drag.id) return;
        const moved = this._drag.moved;
        this._drag = null;
        if (!this.enabled || this.touch.active || moved) return;
        this.attack = true;
        if (!this.locked && !this._lockAsked) {
            this._lockAsked = true;
            this.requestLock();
        }
    }

    onWheel(e) {
        if (!this.locked) return;
        e.preventDefault();
        this.zoom += Math.sign(e.deltaY);
    }

    /** Delta de olhar acumulado desde o último quadro (objeto reaproveitado). */
    consumeLook() {
        this._lookOut.x = this._lookBuffer.x;
        this._lookOut.y = this._lookBuffer.y;
        this._lookBuffer.x = 0;
        this._lookBuffer.y = 0;
        return this._lookOut;
    }

    /**
     * Solta tudo: teclas, botões de toque, pulsos pendentes e olhar acumulado.
     * Chamado ao perder o foco e ao pausar — nada fica "preso" na volta.
     */
    release() {
        for (const k in this.keys) this.keys[k] = false;
        this._rmb = false;
        this._drag = null;
        this.move.x = 0;
        this.move.z = 0;
        this.move.jump = false;
        this.move.jumpHeld = false;
        this.move.sprint = false;
        this.move.crouch = false;
        this.attack = false;
        this.interact = false;
        this.block = false;
        this.pause = false;
        this.advance = false;
        this.tab = false;
        this.lockLost = false;
        this.touch.x = 0;
        this.touch.z = 0;
        this.touch.block = false;
        this.touch.jump = false;
        this._lookBuffer.x = 0;
        this._lookBuffer.y = 0;
        this.zoom = 0;
        const layer = typeof document !== 'undefined' && document.getElementById('touchControls');
        if (layer) {
            const knob = layer.querySelector('.touch-stick-knob');
            if (knob) knob.style.transform = '';
            layer.querySelectorAll('.is-active').forEach((el) => el.classList.remove('is-active'));
        }
    }

    consumeZoom() {
        const z = this.zoom;
        this.zoom = 0;
        return z;
    }

    consume(flag) {
        const v = this[flag];
        this[flag] = false;
        return v;
    }

    update() {
        if (!this.enabled) {
            this.move.x = 0;
            this.move.z = 0;
            this.move.sprint = false;
            this.move.crouch = false;
            this.move.jumpHeld = false;
            return;
        }
        let x = 0;
        let z = 0;
        if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
        if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
        if (this.keys.KeyW || this.keys.ArrowUp) z -= 1;
        if (this.keys.KeyS || this.keys.ArrowDown) z += 1;
        x += this.touch.x;
        z += this.touch.z;
        const len = Math.hypot(x, z);
        if (len > 1) {
            x /= len;
            z /= len;
        }
        this.move.x = x;
        this.move.z = z;
        this.move.sprint = Boolean(this.keys.ShiftLeft || this.keys.ShiftRight || this.touch.sprint);
        this.move.crouch = Boolean(this.keys.KeyC || this.touch.crouch);
        this.move.jumpHeld = Boolean(this.keys.Space || this.touch.jump);
        this.block = Boolean(this.keys.KeyQ || this.touch.block || this._rmb);
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        this.dom.removeEventListener('mousedown', this._onMouseDown);
        window.removeEventListener('mouseup', this._onMouseUp);
        this.dom.removeEventListener('pointerdown', this._onPointerDown);
        this.dom.removeEventListener('pointermove', this._onPointerMove);
        window.removeEventListener('pointerup', this._onPointerUp);
        this.dom.removeEventListener('wheel', this._onWheel);
        document.removeEventListener('pointerlockchange', this._onLockChange);
        this.dom.removeEventListener('contextmenu', this._onContext);
        window.removeEventListener('blur', this._onBlur);
        this._touchCleanup.forEach((off) => off());
        this._touchCleanup.length = 0;
    }
}
