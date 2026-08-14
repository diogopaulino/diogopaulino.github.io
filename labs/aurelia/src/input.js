/** Teclado, toque e gamepad fundidos num estado analógico. */

const KEY_MAP = {
    ArrowUp: 'throttle', KeyW: 'throttle',
    ArrowDown: 'brake', KeyS: 'brake',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    Space: 'handbrake',
    ShiftLeft: 'handbrake', ShiftRight: 'handbrake'
};

export class InputManager {
    constructor({ root, actions = {} }) {
        this.raw = { throttle: false, brake: false, left: false, right: false, handbrake: false };
        this.touch = { throttle: 0, brake: 0, left: 0, right: 0, handbrake: 0 };
        this.state = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
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
                case 'KeyP':
                case 'Escape': actions.togglePause?.(); break;
                case 'KeyC': actions.cycleCamera?.(); break;
                case 'KeyR': actions.resetCar?.(); break;
                case 'KeyM': actions.toggleMute?.(); break;
                case 'KeyN': actions.cycleRadio?.(); break;
                case 'KeyF': actions.photoMode?.(); break;
                case 'KeyH': actions.cycleSky?.(); break;
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
        }, { signal });
        addEventListener('gamepaddisconnected', () => {
            this.gamepadIndex = null;
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
                this.touch[control] = on ? 1 : 0;
                if (on && navigator.vibrate) navigator.vibrate(8);
            };
            pad.addEventListener('pointerdown', (event) => {
                pad.setPointerCapture?.(event.pointerId);
                setPad(true, event);
            }, { signal });
            pad.addEventListener('pointerup', (event) => setPad(false, event), { signal });
            pad.addEventListener('pointercancel', (event) => setPad(false, event), { signal });
            pad.addEventListener('pointerleave', (event) => {
                if (event.buttons === 0) setPad(false, event);
            }, { signal });
        }
    }

    releaseAll() {
        this.raw.throttle = this.raw.brake = this.raw.left = this.raw.right = this.raw.handbrake = false;
        this.touch.throttle = this.touch.brake = this.touch.left = this.touch.right = this.touch.handbrake = 0;
    }

    poll() {
        let throttle = (this.raw.throttle ? 1 : 0) || this.touch.throttle;
        let brake = (this.raw.brake ? 1 : 0) || this.touch.brake;
        let left = (this.raw.left ? 1 : 0) || this.touch.left;
        let right = (this.raw.right ? 1 : 0) || this.touch.right;
        let handbrake = (this.raw.handbrake ? 1 : 0) || this.touch.handbrake;

        if (this.gamepadIndex != null) {
            const pads = navigator.getGamepads?.();
            const gp = pads?.[this.gamepadIndex];
            if (gp) {
                const ax = gp.axes[0] || 0;
                const triggerR = gp.buttons[7]?.value ?? 0;
                const triggerL = gp.buttons[6]?.value ?? 0;
                const accelBtn = gp.buttons[0]?.pressed ? 1 : 0;
                throttle = Math.max(throttle, triggerR, accelBtn);
                brake = Math.max(brake, triggerL, gp.buttons[1]?.pressed ? 1 : 0);
                handbrake = Math.max(handbrake, gp.buttons[2]?.pressed ? 1 : 0);
                if (Math.abs(ax) > 0.08) {
                    if (ax < 0) left = Math.max(left, -ax);
                    else right = Math.max(right, ax);
                }
                if (gp.buttons[9]?.pressed) this.actions.togglePause?.();
            }
        }

        this.state.throttle = throttle;
        this.state.brake = brake;
        this.state.steer = right - left;
        this.state.handbrake = handbrake;
        return this.state;
    }

    dispose() {
        this.abort.abort();
    }
}
