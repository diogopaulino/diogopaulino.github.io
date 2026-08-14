/**
 * Teclado + toque. Flags lidas a cada frame pelo jogo.
 * jumpPressed / rollPressed são pulsos (edge) consumidos pelo update.
 */

export function createInput() {
  const down = Object.create(null);
  const pulse = { jump: false, roll: false, start: false, pause: false, up: false };
  const touch = { left: false, right: false, up: false, down: false, jump: false, roll: false };

  const map = {
    ArrowLeft: 'left', a: 'left', A: 'left',
    ArrowRight: 'right', d: 'right', D: 'right',
    ArrowUp: 'up', w: 'up', W: 'up',
    ArrowDown: 'down', s: 'down', S: 'down',
    ' ': 'jump', z: 'jump', Z: 'jump', k: 'jump', K: 'jump',
    Shift: 'roll', x: 'roll', X: 'roll', j: 'roll', J: 'roll', Control: 'roll',
    Enter: 'start',
    Escape: 'pause', p: 'pause', P: 'pause',
    m: 'mute', M: 'mute'
  };

  function onKey(e, isDown) {
    const bind = map[e.key];
    if (!bind) return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
      e.preventDefault();
    }
    if (isDown) {
      if (!down[bind]) {
        if (bind === 'jump') pulse.jump = true;
        if (bind === 'roll') pulse.roll = true;
        if (bind === 'start') pulse.start = true;
        if (bind === 'pause') pulse.pause = true;
        if (bind === 'up') pulse.up = true;
        if (bind === 'mute') pulse.mute = true;
      }
      down[bind] = true;
    } else {
      down[bind] = false;
    }
  }

  window.addEventListener('keydown', (e) => onKey(e, true), { passive: false });
  window.addEventListener('keyup', (e) => onKey(e, false));
  window.addEventListener('blur', () => {
    for (const k of Object.keys(down)) down[k] = false;
  });

  function bindHold(el, flag) {
    if (!el) return;
    const start = (ev) => {
      ev.preventDefault();
      touch[flag] = true;
      if (flag === 'jump') pulse.jump = true;
      if (flag === 'roll') pulse.roll = true;
      if (flag === 'up') pulse.up = true;
    };
    const end = (ev) => {
      ev.preventDefault();
      touch[flag] = false;
    };
    el.addEventListener('pointerdown', start);
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('pointerleave', end);
  }

  return {
    down,
    touch,
    pulse,
    bindHold,
    left() { return !!(down.left || touch.left); },
    right() { return !!(down.right || touch.right); },
    up() { return !!(down.up || touch.up); },
    downHeld() { return !!(down.down || touch.down); },
    jumpHeld() { return !!(down.jump || touch.jump); },
    rollHeld() { return !!(down.roll || touch.roll); },
    consume(name) {
      const v = pulse[name];
      pulse[name] = false;
      return v;
    },
    clearPulses() {
      pulse.jump = false;
      pulse.roll = false;
      pulse.start = false;
      pulse.pause = false;
      pulse.up = false;
      pulse.mute = false;
    }
  };
}
