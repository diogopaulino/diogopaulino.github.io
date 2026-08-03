/** Keyboard, touch and Gamepad input merged into one analogue control state. */

const KEY_MAP = {
    ArrowUp: 'throttle', KeyW: 'throttle',
    ArrowDown: 'brake', KeyS: 'brake',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'ers', ShiftLeft: 'ers', ShiftRight: 'ers',
    KeyE: 'drs'
};

export class InputManager {
    constructor({ root, actions = {} }) {
        this.raw = { throttle: false, brake: false, left: false, right: false, ers: false, drs: false };
        this.touch = { throttle: 0, brake: 0, left: 0, right: 0, ers: false, drs: false };
        this.state = { throttle: 0, brake: 0, steer: 0, ers: false, drs: false };
        this.actions = actions;
        this.gamepadIndex = null;
        this.abort = new AbortController();
        const { signal } = this.abort;

        addEventListener('keydown', (event) => {
            if (event.repeat) return;
            const mapped = KEY_MAP[event.code];
            if (mapped) {
                this.raw[mapped] = true;
                event.preventDefault();
            }
            switch (event.code) {
                case 'KeyP': case 'Escape': actions.togglePause?.(); break;
                case 'KeyC': actions.cycleCamera?.(); break;
                case 'KeyR': actions.restart?.(); break;
                case 'KeyM': actions.toggleMute?.(); break;
                default: break;
            }
        }, { signal });

        addEventListener('keyup', (event) => {
            const mapped = KEY_MAP[event.code];
            if (mapped) {
                this.raw[mapped] = false;
                event.preventDefault();
            }
        }, { signal });

        addEventListener('blur', () => this.releaseAll(), { signal });

        addEventListener('gamepadconnected', (event) => {
            this.gamepadIndex = event.gamepad.index;
            actions.onGamepad?.(true);
        }, { signal });
        addEventListener('gamepaddisconnected', () => {
            this.gamepadIndex = null;
            actions.onGamepad?.(false);
        }, { signal });

        if (root) this.bindTouch(root, signal);
    }

    bindTouch(root, signal) {
        const pads = root.querySelectorAll('[data-control]');
        for (const pad of pads) {
            const control = pad.dataset.control;
            const setPad = (on, event) => {
                event?.preventDefault();
                pad.classList.toggle('is-active', on);
                if (control === 'drs') {
                    if (on) this.actions.toggleDrs?.();
                    return;
                }
                if (control === 'ers') {
                    this.touch.ers = on;
                    return;
                }
                this.touch[control] = on ? 1 : 0;
                if (on && navigator.vibrate) navigator.vibrate(8);
            };
            pad.addEventListener('pointerdown', (event) => {
                pad.setPointerCapture?.(event.pointerId);
                setPad(true, event);
            }, { signal });
            pad.addEventListener('pointerup', (event) => setPad(false, event), { signal });
            pad.addEventListener('pointercancel', (event) => setPad(false, event), { signal });
            pad.addEventListener('lostpointercapture', () => setPad(false), { signal });
            pad.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
        }
    }

    releaseAll() {
        for (const key of Object.keys(this.raw)) this.raw[key] = false;
        for (const key of Object.keys(this.touch)) this.touch[key] = 0;
    }

    pollGamepad() {
        if (this.gamepadIndex === null || !navigator.getGamepads) return null;
        const pad = navigator.getGamepads()[this.gamepadIndex];
        if (!pad) return null;
        const dead = (v) => (Math.abs(v) < 0.12 ? 0 : v);
        return {
            steer: dead(pad.axes[0] ?? 0),
            throttle: Math.max(pad.buttons[7]?.value ?? 0, pad.buttons[0]?.pressed ? 1 : 0),
            brake: Math.max(pad.buttons[6]?.value ?? 0, pad.buttons[1]?.pressed ? 1 : 0),
            ers: pad.buttons[2]?.pressed ?? false,
            drs: pad.buttons[3]?.pressed ?? false
        };
    }

    update(dt) {
        const pad = this.pollGamepad();

        const throttleTarget = Math.max(
            this.raw.throttle ? 1 : 0,
            this.touch.throttle,
            pad?.throttle ?? 0
        );
        const brakeTarget = Math.max(
            this.raw.brake ? 1 : 0,
            this.touch.brake,
            pad?.brake ?? 0
        );

        // Pedals ramp so keyboard input still feels progressive.
        const ramp = (current, target, up, down) =>
            current + (target - current) * Math.min(1, (target > current ? up : down) * dt);

        this.state.throttle = ramp(this.state.throttle, throttleTarget, 7, 12);
        this.state.brake = ramp(this.state.brake, brakeTarget, 12, 16);

        // Compose desired steer in "screen space" first: left = -1, right = +1.
        let steerTarget = 0;
        if (this.raw.left || this.touch.left) steerTarget -= 1;
        if (this.raw.right || this.touch.right) steerTarget += 1;
        // Gamepad stick augments keys/touch instead of hard-replacing them
        // (avoids a resting/drifted pad swallowing keyboard input).
        if (pad) steerTarget += pad.steer;

        // Vehicle +X is the car's right, but a chase camera looking along +Z shows
        // world +X on the LEFT of the screen (Three.js Y-up / look-down-−Z basis).
        // Negate so pressing left turns toward screen-left.
        steerTarget = Math.max(-1, Math.min(1, -steerTarget));

        const returning = Math.sign(steerTarget) !== Math.sign(this.state.steer) || steerTarget === 0;
        this.state.steer = ramp(this.state.steer, steerTarget, returning ? 11 : 6.5, 12);

        this.state.ers = this.raw.ers || this.touch.ers || (pad?.ers ?? false);

        const drsHeld = this.raw.drs || (pad?.drs ?? false);
        if (drsHeld && !this.drsWasHeld) this.actions.toggleDrs?.();
        this.drsWasHeld = drsHeld;

        return this.state;
    }

    dispose() {
        this.abort.abort();
    }
}
