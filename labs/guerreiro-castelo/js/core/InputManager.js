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
    }

    requestLock() {
        if (this.locked) return;
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
        const len = Math.hypot(x, z);
        if (len > 1) {
            x /= len;
            z /= len;
        }
        this.move.x = x;
        this.move.z = z;
        this.move.sprint = Boolean(this.keys.ShiftLeft || this.keys.ShiftRight);
        this.move.crouch = Boolean(this.keys.KeyC);
        this.block = Boolean(this.keys.KeyQ);
    }

    dispose() {
        window.removeEventListener('keydown', this._onKeyDown);
        window.removeEventListener('keyup', this._onKeyUp);
        document.removeEventListener('mousemove', this._onMouseMove);
        this.dom.removeEventListener('mousedown', this._onMouseDown);
        this.dom.removeEventListener('wheel', this._onWheel);
        document.removeEventListener('pointerlockchange', this._onLockChange);
        this.dom.removeEventListener('contextmenu', this._onContext);
    }
}
