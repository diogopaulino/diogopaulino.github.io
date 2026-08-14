/**
 * Input: teclado, mouse, pointer lock e um stick virtual para toque.
 */

export class InputManager {
    constructor(dom) {
        this.dom = dom;
        this.keys = Object.create(null);
        this.move = { x: 0, z: 0, sprint: false, crouch: false, jump: false };
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
        this.enabled = true;
        /* Estado alimentado pelos controles de toque (ver setupTouch). */
        this.touch = { x: 0, z: 0, sprint: false, crouch: false, block: false, active: false };
        this._touchCleanup = [];
        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);
        this._onMouseMove = this.onMouseMove.bind(this);
        this._onMouseDown = this.onMouseDown.bind(this);
        this._onWheel = this.onWheel.bind(this);
        this._onLockChange = this.onLockChange.bind(this);
        this._onContext = (e) => e.preventDefault();
        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
        document.addEventListener('mousemove', this._onMouseMove);
        dom.addEventListener('mousedown', this._onMouseDown);
        dom.addEventListener('wheel', this._onWheel, { passive: false });
        document.addEventListener('pointerlockchange', this._onLockChange);
        dom.addEventListener('contextmenu', this._onContext);
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
            stick.setPointerCapture?.(e.pointerId);
            stick.classList.add('is-active');
        });

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
            this.touch.x = dx / STICK_RADIUS;
            this.touch.z = dy / STICK_RADIUS;
            if (knob) knob.style.transform = `translate(${dx}px, ${dy}px)`;
        });

        on(stick, 'pointerup', stickEnd);
        on(stick, 'pointercancel', stickEnd);

        /* Câmera: arrastar em qualquer área livre da tela. */
        const lookZone = layer.querySelector('[data-touch-look]');
        const LOOK_SENSITIVITY = 1.35;
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
            lookZone.setPointerCapture?.(e.pointerId);
        });

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
                btn.classList.add('is-active');
                this.applyTouchAction(action, true);
                if (toggle) btn.setAttribute('aria-pressed', String(this.touch[action]));
            });

            const release = () => {
                btn.classList.remove('is-active');
                if (!toggle) this.applyTouchAction(action, false);
            };

            on(btn, 'pointerup', release);
            on(btn, 'pointercancel', release);
            on(btn, 'pointerleave', release);
        });

        this.touch.active = true;
    }

    applyTouchAction(action, down) {
        if (action === 'jump') {
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
        this.dom.requestPointerLock?.();
    }

    exitLock() {
        if (document.pointerLockElement) document.exitPointerLock();
    }

    onLockChange() {
        this.locked = document.pointerLockElement === this.dom;
    }

    onKeyDown(e) {
        if (e.repeat) return;
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
        /* Em telas de toque não existe pointer lock: pedir trava só engoliria o
           primeiro toque e, no iOS, falharia em silêncio. */
        if (this.touch.active) return;
        if (e.button === 0 && !this.locked && this.enabled) this.requestLock();
    }

    onWheel(e) {
        if (!this.locked) return;
        e.preventDefault();
        this.zoom += Math.sign(e.deltaY);
    }

    consumeLook() {
        const x = this._lookBuffer.x;
        const y = this._lookBuffer.y;
        this._lookBuffer.x = 0;
        this._lookBuffer.y = 0;
        return { x, y };
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
        this.block = Boolean(this.keys.KeyQ || this.touch.block);
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        this.dom.removeEventListener('mousedown', this._onMouseDown);
        this.dom.removeEventListener('wheel', this._onWheel);
        document.removeEventListener('pointerlockchange', this._onLockChange);
        this.dom.removeEventListener('contextmenu', this._onContext);
        this._touchCleanup.forEach((off) => off());
        this._touchCleanup.length = 0;
    }
}
