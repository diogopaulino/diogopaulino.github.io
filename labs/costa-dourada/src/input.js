/** Teclado, gamepad e touch-pad para Costa Dourada. */

export class Input {
    constructor() {
        this.keys = Object.create(null);
        this.steer = 0;
        this.throttle = 0;
        this.brake = 0;
        this.handbrake = 0;
        this.camera = false;
        this.pause = false;
        this.reset = false;
        this._cameraEdge = false;
        this._pauseEdge = false;
        this._resetEdge = false;
        this.touchSteer = 0;
        this.touchGas = false;
        this.touchBrake = false;
        this.touchHb = false;

        window.addEventListener('keydown', (e) => {
            this.keys[e.code] = true;
            if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
        });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

        this._bindTouch();
    }

    _bindTouch() {
        const gas = document.getElementById('touchGas');
        const brake = document.getElementById('touchBrake');
        const hb = document.getElementById('touchHb');
        const steer = document.getElementById('touchSteer');
        const bindHold = (el, on, off) => {
            if (!el) return;
            const start = (e) => { e.preventDefault(); on(); };
            const end = (e) => { e.preventDefault(); off(); };
            el.addEventListener('pointerdown', start);
            el.addEventListener('pointerup', end);
            el.addEventListener('pointerleave', end);
            el.addEventListener('pointercancel', end);
        };
        bindHold(gas, () => { this.touchGas = true; }, () => { this.touchGas = false; });
        bindHold(brake, () => { this.touchBrake = true; }, () => { this.touchBrake = false; });
        bindHold(hb, () => { this.touchHb = true; }, () => { this.touchHb = false; });
        if (steer) {
            const update = (e) => {
                const rect = steer.getBoundingClientRect();
                const t = ('touches' in e ? e.touches[0] : e);
                if (!t) return;
                const x = (t.clientX - rect.left) / rect.width;
                this.touchSteer = Math.max(-1, Math.min(1, (x - 0.5) * 2));
            };
            const clear = () => { this.touchSteer = 0; };
            steer.addEventListener('pointerdown', (e) => { steer.setPointerCapture(e.pointerId); update(e); });
            steer.addEventListener('pointermove', update);
            steer.addEventListener('pointerup', clear);
            steer.addEventListener('pointercancel', clear);
        }
    }

    poll() {
        const k = this.keys;
        let steer = 0;
        if (k.KeyA || k.ArrowLeft) steer -= 1;
        if (k.KeyD || k.ArrowRight) steer += 1;
        if (Math.abs(this.touchSteer) > 0.05) steer = this.touchSteer;

        let throttle = (k.KeyW || k.ArrowUp) ? 1 : 0;
        let brake = (k.KeyS || k.ArrowDown) ? 1 : 0;
        if (this.touchGas) throttle = 1;
        if (this.touchBrake) brake = 1;

        const handbrake = (k.Space || this.touchHb) ? 1 : 0;

        // gamepad
        const pads = navigator.getGamepads?.() || [];
        for (const p of pads) {
            if (!p) continue;
            if (Math.abs(p.axes[0]) > 0.08) steer = p.axes[0];
            const rt = p.buttons[7]?.value ?? 0;
            const lt = p.buttons[6]?.value ?? 0;
            if (rt > 0.05) throttle = rt;
            if (lt > 0.05) brake = lt;
            if (p.buttons[0]?.pressed) handbrake = 1;
        }

        this.steer = steer;
        this.throttle = throttle;
        this.brake = brake;
        this.handbrake = handbrake;

        const cam = Boolean(k.KeyC);
        this.camera = cam && !this._cameraEdge;
        this._cameraEdge = cam;

        const pau = Boolean(k.KeyP || k.Escape);
        this.pause = pau && !this._pauseEdge;
        this._pauseEdge = pau;

        const rst = Boolean(k.KeyR);
        this.reset = rst && !this._resetEdge;
        this._resetEdge = rst;

        return {
            steer: this.steer,
            throttle: this.throttle,
            brake: this.brake,
            handbrake: this.handbrake,
            cameraPressed: this.camera,
            pausePressed: this.pause,
            resetPressed: this.reset
        };
    }
}
