/**
 * Teclado e toque: faixas discretas, pulo, pausa, mudo, câmera.
 * laneLeft / laneRight disparam uma vez por tecla (keydown), não no sample.
 */

const LANE = {
    ArrowLeft: -1,
    KeyA: -1,
    ArrowRight: 1,
    KeyD: 1
};

const JUMP = new Set(['Space', 'ArrowUp', 'KeyW']);

const ACTIONS = {
    KeyP: 'pause',
    Escape: 'pause',
    KeyM: 'mute',
    KeyC: 'camera',
    Enter: 'confirm'
};

export class Input {
    constructor() {
        this.jump = false;
        this.laneLeft = false;
        this.laneRight = false;
        this.listeners = new Map();
        this.enabled = true;
        this._jumpHeld = false;

        this._onKeyDown = (e) => {
            if (ACTIONS[e.code]) {
                if (ACTIONS[e.code] === 'confirm' && document.activeElement?.tagName === 'BUTTON') return;
                this.emit(ACTIONS[e.code]);
                e.preventDefault();
                return;
            }
            if (LANE[e.code] !== undefined && !e.repeat) {
                if (LANE[e.code] < 0) this.laneLeft = true;
                else this.laneRight = true;
                e.preventDefault();
            }
            if (JUMP.has(e.code)) {
                this._jumpHeld = true;
                if (!e.repeat) this.jump = true;
                e.preventDefault();
            }
        };
        this._onKeyUp = (e) => {
            if (JUMP.has(e.code)) this._jumpHeld = false;
        };

        window.addEventListener('keydown', this._onKeyDown);
        window.addEventListener('keyup', this._onKeyUp);
    }

    on(action, fn) {
        if (!this.listeners.has(action)) this.listeners.set(action, new Set());
        this.listeners.get(action).add(fn);
    }

    emit(action) {
        this.listeners.get(action)?.forEach((fn) => fn());
    }

    tapLane(dir) {
        if (dir < 0) this.laneLeft = true;
        else if (dir > 0) this.laneRight = true;
    }

    tapJump() {
        this.jump = true;
        this._jumpHeld = true;
    }

    releaseJump() {
        this._jumpHeld = false;
    }

    sample() {
        if (!this.enabled) {
            this.jump = false;
            this.laneLeft = false;
            this.laneRight = false;
            return this;
        }
        const frame = {
            jump: this.jump,
            laneLeft: this.laneLeft,
            laneRight: this.laneRight
        };
        this.jump = false;
        this.laneLeft = false;
        this.laneRight = false;
        return frame;
    }
}
