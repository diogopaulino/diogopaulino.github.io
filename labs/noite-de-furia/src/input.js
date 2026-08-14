/**
 * Teclado, gamepad e stick virtual (8 direções).
 * Cima/baixo andam na profundidade — o pulo é botão separado, como no arcade.
 */

const KEY_DIR = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    KeyA: 'left',
    KeyD: 'right',
    KeyW: 'up',
    KeyS: 'down'
};

const KEY_BTN = {
    KeyJ: 'attack',
    KeyZ: 'attack',
    KeyK: 'jump',
    KeyX: 'jump',
    KeyL: 'special',
    KeyC: 'special',
    Space: 'special'
};

export class Input {
    constructor() {
        this.held = new Set();
        this.pressed = new Set();
        this.prev = new Set();
        this.axes = { x: 0, z: 0 };
        this.stickTouch = null;
        this.lastDirTap = { left: -999, right: -999 };
        this.runDir = 0;
        this.frame = 0;
        this.enabled = true;
        this._onKeyDown = this.onKeyDown.bind(this);
        this._onKeyUp = this.onKeyUp.bind(this);
        this._onBlur = this.blur.bind(this);
        window.addEventListener('keydown', this._onKeyDown, { passive: false });
        window.addEventListener('keyup', this._onKeyUp);
        window.addEventListener('blur', this._onBlur);
    }

    onKeyDown(e) {
        if (!this.enabled) return;
        if (e.code === 'Enter' || e.code === 'NumpadEnter') {
            if (document.activeElement?.tagName === 'BUTTON') return;
            this.pressed.add('start');
            e.preventDefault();
            return;
        }
        if (e.code === 'Escape' || e.code === 'KeyP') {
            this.pressed.add('pause');
            e.preventDefault();
            return;
        }
        if (e.code === 'KeyM') {
            this.pressed.add('mute');
            e.preventDefault();
            return;
        }
        const dir = KEY_DIR[e.code];
        if (dir) {
            if (!e.repeat) {
                this.held.add(dir);
                if (dir === 'left' || dir === 'right') {
                    const now = this.frame;
                    if (now - this.lastDirTap[dir] < 18) this.runDir = dir === 'right' ? 1 : -1;
                    this.lastDirTap[dir] = now;
                }
            }
            e.preventDefault();
            return;
        }
        const btn = KEY_BTN[e.code];
        if (btn) {
            if (!e.repeat) {
                this.held.add(btn);
                this.pressed.add(btn);
            }
            e.preventDefault();
        }
    }

    onKeyUp(e) {
        const dir = KEY_DIR[e.code];
        if (dir) {
            this.held.delete(dir);
            if ((dir === 'right' && this.runDir === 1) || (dir === 'left' && this.runDir === -1)) {
                this.runDir = 0;
            }
            return;
        }
        const btn = KEY_BTN[e.code];
        if (btn) this.held.delete(btn);
    }

    blur() {
        this.held.clear();
        this.pressed.clear();
        this.runDir = 0;
        this.axes.x = 0;
        this.axes.z = 0;
    }

    bindTouch({ stick, knob, buttons }) {
        if (stick) {
            const start = (e) => {
                this.stickTouch = {
                    id: e.pointerId,
                    x: e.clientX,
                    y: e.clientY,
                    cx: stick.getBoundingClientRect().left + stick.offsetWidth / 2,
                    cy: stick.getBoundingClientRect().top + stick.offsetHeight / 2,
                    r: stick.offsetWidth * 0.38
                };
                stick.setPointerCapture?.(e.pointerId);
                this.moveStick(e, knob);
                e.preventDefault();
            };
            const move = (e) => {
                if (!this.stickTouch || e.pointerId !== this.stickTouch.id) return;
                this.moveStick(e, knob);
                e.preventDefault();
            };
            const end = (e) => {
                if (this.stickTouch && e.pointerId !== this.stickTouch.id) return;
                this.stickTouch = null;
                this.axes.x = 0;
                this.axes.z = 0;
                this.held.delete('left');
                this.held.delete('right');
                this.held.delete('up');
                this.held.delete('down');
                if (this.runDir && !this.held.has('left') && !this.held.has('right')) this.runDir = 0;
                if (knob) {
                    knob.style.transform = 'translate(-50%, -50%)';
                }
            };
            stick.addEventListener('pointerdown', start, { passive: false });
            stick.addEventListener('pointermove', move, { passive: false });
            stick.addEventListener('pointerup', end);
            stick.addEventListener('pointercancel', end);
        }

        for (const btn of buttons || []) {
            const act = btn.dataset.act;
            const down = (e) => {
                this.held.add(act);
                this.pressed.add(act);
                btn.classList.add('is-down');
                e.preventDefault();
            };
            const up = () => {
                this.held.delete(act);
                btn.classList.remove('is-down');
            };
            btn.addEventListener('pointerdown', down, { passive: false });
            btn.addEventListener('pointerup', up);
            btn.addEventListener('pointercancel', up);
            btn.addEventListener('pointerleave', up);
        }
    }

    moveStick(e, knob) {
        const s = this.stickTouch;
        let dx = e.clientX - s.cx;
        let dy = e.clientY - s.cy;
        const len = Math.hypot(dx, dy) || 1;
        const max = s.r;
        if (len > max) {
            dx = (dx / len) * max;
            dy = (dy / len) * max;
        }
        if (knob) {
            knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        }
        const nx = dx / max;
        const nz = -dy / max;
        const dead = 0.22;
        this.axes.x = Math.abs(nx) < dead ? 0 : nx;
        this.axes.z = Math.abs(nz) < dead ? 0 : nz;

        const wasL = this.held.has('left');
        const wasR = this.held.has('right');
        this.held.delete('left');
        this.held.delete('right');
        this.held.delete('up');
        this.held.delete('down');
        if (this.axes.x < -dead) this.held.add('left');
        if (this.axes.x > dead) this.held.add('right');
        if (this.axes.z > dead) this.held.add('up');
        if (this.axes.z < -dead) this.held.add('down');
        if (!wasR && this.held.has('right')) {
            if (this.frame - this.lastDirTap.right < 18) this.runDir = 1;
            this.lastDirTap.right = this.frame;
        }
        if (!wasL && this.held.has('left')) {
            if (this.frame - this.lastDirTap.left < 18) this.runDir = -1;
            this.lastDirTap.left = this.frame;
        }
        if (!this.held.has('left') && !this.held.has('right')) this.runDir = 0;
    }

    pollGamepad() {
        const pads = navigator.getGamepads?.() || [];
        const pad = [...pads].find(Boolean);
        if (!pad) return;
        const ax = pad.axes[0] || 0;
        const az = pad.axes[1] || 0;
        if (Math.abs(ax) > 0.28) {
            this.held.add(ax > 0 ? 'right' : 'left');
            this.held.delete(ax > 0 ? 'left' : 'right');
        }
        if (Math.abs(az) > 0.28) {
            this.held.add(az > 0 ? 'down' : 'up');
            this.held.delete(az > 0 ? 'up' : 'down');
        }
        const map = { 0: 'attack', 1: 'jump', 2: 'special', 9: 'start', 8: 'pause' };
        for (const [i, act] of Object.entries(map)) {
            const b = pad.buttons[i];
            if (b?.pressed) {
                if (!this.held.has(act)) this.pressed.add(act);
                this.held.add(act);
            }
        }
    }

    beginFrame() {
        this.frame++;
        this.pollGamepad();
        if (!this.stickTouch) {
            this.axes.x = (this.held.has('right') ? 1 : 0) - (this.held.has('left') ? 1 : 0);
            this.axes.z = (this.held.has('up') ? 1 : 0) - (this.held.has('down') ? 1 : 0);
        }
    }

    endFrame() {
        this.pressed.clear();
    }

    consume(act) {
        if (!this.pressed.has(act)) return false;
        this.pressed.delete(act);
        return true;
    }

    has(act) {
        return this.held.has(act);
    }

    moving() {
        return this.axes.x !== 0 || this.axes.z !== 0;
    }
}
