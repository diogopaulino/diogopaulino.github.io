/**
 * Teclado, toque, gamepad e código Konami.
 * Setas / WASD andam · Z/Espaço/K pulam · X/J atacam · Shift dash · Enter start · Esc pausa.
 */

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

export function createInput(root) {
    const keys = new Set();
    const pad = {
        left: false,
        right: false,
        up: false,
        down: false,
        jump: false,
        jumpPressed: false,
        attack: false,
        attackPressed: false,
        dash: false,
        dashPressed: false,
        start: false,
        startPressed: false,
        pause: false,
        pausePressed: false,
    };

    let jumpEdge = false;
    let attackEdge = false;
    let dashEdge = false;
    let startEdge = false;
    let pauseEdge = false;
    let konamiIdx = 0;
    let konamiHit = false;
    const history = [];

    function isTypingTarget(el) {
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    }

    function onKey(e, down) {
        if (isTypingTarget(e.target)) return;
        const code = e.code;
        const block = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code);
        if (block) e.preventDefault();
        if (down) {
            if (!keys.has(code)) {
                if (code === KONAMI[konamiIdx]) {
                    konamiIdx += 1;
                    if (konamiIdx >= KONAMI.length) {
                        konamiHit = true;
                        konamiIdx = 0;
                    }
                } else {
                    konamiIdx = code === KONAMI[0] ? 1 : 0;
                }
            }
            keys.add(code);
        } else {
            keys.delete(code);
        }
    }

    window.addEventListener('keydown', (e) => onKey(e, true), { passive: false });
    window.addEventListener('keyup', (e) => onKey(e, false));
    window.addEventListener('blur', () => keys.clear());

    const holds = new Map();

    function bindHold(el, name) {
        if (!el) return;
        const set = (v) => holds.set(name, v);
        const on = (ev) => {
            ev.preventDefault();
            set(true);
            el.classList.add('is-active');
        };
        const off = (ev) => {
            ev.preventDefault();
            set(false);
            el.classList.remove('is-active');
        };
        el.addEventListener('pointerdown', on);
        el.addEventListener('pointerup', off);
        el.addEventListener('pointerleave', off);
        el.addEventListener('pointercancel', off);
        el.addEventListener('contextmenu', (e) => e.preventDefault());
    }

    bindHold(root.querySelector('[data-pad="left"]'), 'left');
    bindHold(root.querySelector('[data-pad="right"]'), 'right');
    bindHold(root.querySelector('[data-pad="up"]'), 'up');
    bindHold(root.querySelector('[data-pad="down"]'), 'down');
    bindHold(root.querySelector('[data-pad="jump"]'), 'jump');
    bindHold(root.querySelector('[data-pad="attack"]'), 'attack');
    bindHold(root.querySelector('[data-pad="start"]'), 'start');

    function held(name) {
        return holds.get(name) === true;
    }

    function pollGamepad() {
        const gps = navigator.getGamepads?.();
        if (!gps) return {};
        for (const gp of gps) {
            if (!gp) continue;
            const ax = gp.axes[0] || 0;
            const ay = gp.axes[1] || 0;
            const b = (i) => gp.buttons[i]?.pressed;
            return {
                left: ax < -0.4 || b(14),
                right: ax > 0.4 || b(15),
                up: ay < -0.4 || b(12),
                down: ay > 0.4 || b(13),
                jump: b(0) || b(1),
                attack: b(2) || b(3),
                dash: b(5) || b(7),
                start: b(9),
                pause: b(8) || b(9),
            };
        }
        return {};
    }

    function edge(curr, prevFlag, setter) {
        const pressed = curr && !prevFlag;
        setter(curr);
        return pressed;
    }

    function poll() {
        const gp = pollGamepad();
        const left = keys.has('ArrowLeft') || keys.has('KeyA') || held('left') || gp.left;
        const right = keys.has('ArrowRight') || keys.has('KeyD') || held('right') || gp.right;
        const up = keys.has('ArrowUp') || keys.has('KeyW') || held('up') || gp.up;
        const down = keys.has('ArrowDown') || keys.has('KeyS') || held('down') || gp.down;
        const jump = keys.has('Space') || keys.has('KeyZ') || keys.has('KeyK') || held('jump') || gp.jump;
        const attack = keys.has('KeyX') || keys.has('KeyJ') || keys.has('ControlLeft') || held('attack') || gp.attack;
        const dash = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyC') || gp.dash;
        const start = keys.has('Enter') || held('start') || gp.start;
        const pause = keys.has('Escape') || keys.has('KeyP') || gp.pause;

        pad.left = !!left;
        pad.right = !!right;
        pad.up = !!up;
        pad.down = !!down;
        pad.jump = !!jump;
        pad.attack = !!attack;
        pad.dash = !!dash;
        pad.start = !!start;
        pad.pause = !!pause;

        pad.jumpPressed = edge(jump, jumpEdge, (v) => { jumpEdge = v; });
        pad.attackPressed = edge(attack, attackEdge, (v) => { attackEdge = v; });
        pad.dashPressed = edge(dash, dashEdge, (v) => { dashEdge = v; });
        pad.startPressed = edge(start, startEdge, (v) => { startEdge = v; });
        pad.pausePressed = edge(pause, pauseEdge, (v) => { pauseEdge = v; });

        if (konamiHit) {
            pad.konami = true;
            konamiHit = false;
        } else {
            pad.konami = false;
        }

        pad.anyPressed = pad.jumpPressed || pad.attackPressed || pad.startPressed || pad.pausePressed
            || pad.left || pad.right;

        return pad;
    }

    function consume() {
        pad.jumpPressed = false;
        pad.attackPressed = false;
        pad.dashPressed = false;
        pad.startPressed = false;
        pad.pausePressed = false;
        pad.konami = false;
    }

    return { poll, consume, keys, pad };
}
