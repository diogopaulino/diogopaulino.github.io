// ==========================================================================
// Rock Kombat — Input Buffer
// 60Hz deterministic buffer with MvC Magic Series, Dash Macros, Super Jump
// (Down -> Up), and zero-allocation gesture detection.
// ==========================================================================

import { INPUT_BUFFER, DASH_WINDOW } from './constants.js?v=23';

export class InputBuffer {
  constructor() {
    this.held = new Set();
    this.pressed = new Map();
    this.tapHistory = [];
    this.frameNumber = 0;
    this.lastDashFrame = -99;
    this.lastDownFrame = -99;
    this.sources = new Map();
    this.onClear = null;
  }

  updateFrame(frame) {
    this.frameNumber = frame;
  }

  hasSource(action, source) {
    return this.sources.get(action)?.has(source) ?? false;
  }

  down(action, source = action) {
    if (!this.sources.has(action)) this.sources.set(action, new Set());
    this.sources.get(action).add(source);
    if (!this.held.has(action)) {
      this.pressed.set(action, this.frameNumber);
      this.tapHistory.push({ action, frame: this.frameNumber });
      if (this.tapHistory.length > 14) this.tapHistory.shift();
      if (action === 'down') this.lastDownFrame = this.frameNumber;
    }
    this.held.add(action);
  }

  up(action, source = action) {
    const sources = this.sources.get(action);
    if (!sources) return;
    sources.delete(source);
    if (sources.size) return;
    this.sources.delete(action);
    this.held.delete(action);
  }

  tap(action) {
    this.pressed.set(action, this.frameNumber);
    this.tapHistory.push({ action, frame: this.frameNumber });
    if (this.tapHistory.length > 14) this.tapHistory.shift();
    if (action === 'down') this.lastDownFrame = this.frameNumber;
  }

  has(action) {
    return this.held.has(action);
  }

  fresh(action, window = 1) {
    return this.pressed.has(action) && this.frameNumber - this.pressed.get(action) <= window;
  }

  consume(action, window = INPUT_BUFFER) {
    if (!this.pressed.has(action) || this.frameNumber - this.pressed.get(action) > window) return false;
    this.pressed.delete(action);
    return true;
  }

  /**
   * True if player tapped Down within the last 14 frames before jumping (MvC Super Jump).
   */
  consumeSuperJump() {
    if (this.frameNumber - this.lastDownFrame <= 14) {
      this.lastDownFrame = -99;
      return true;
    }
    return false;
  }

  /**
   * Double-tap direction or L+M Dash Macro.
   */
  consumeDash(action, window = DASH_WINDOW) {
    if (this.frameNumber - this.lastDashFrame < 15) return false;

    let count = 0;
    let latestFrame = -1;
    let prevFrame = -1;
    for (let i = this.tapHistory.length - 1; i >= 0; i--) {
      if (this.tapHistory[i].action === action) {
        if (count === 0) latestFrame = this.tapHistory[i].frame;
        else if (count === 1) {
          prevFrame = this.tapHistory[i].frame;
          break;
        }
        count++;
      }
    }
    if (count < 2) return false;
    const recent = this.frameNumber - latestFrame <= 2;
    const gap = latestFrame - prevFrame;
    if (!recent || gap < 2 || gap > window) return false;

    this.lastDashFrame = this.frameNumber;
    for (let i = this.tapHistory.length - 1; i >= 0; i--) {
      if (this.tapHistory[i].action === action) this.tapHistory.splice(i, 1);
    }
    return true;
  }

  clearDirections() {
    this.up('left');
    this.up('right');
    this.up('down');
    this.up('jump');
  }

  clear() {
    this.held.clear();
    this.sources.clear();
    this.onClear?.();
    this.pressed.clear();
    this.tapHistory.length = 0;
    this.lastDashFrame = -99;
    this.lastDownFrame = -99;
  }
}

export function bindKeyboard(playerInput, hooks = {}) {
  const keyMap = {
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyS: 'down', ArrowDown: 'down',
    KeyW: 'jump', ArrowUp: 'jump',
    // Light / Punch
    KeyJ: 'light', KeyQ: 'light', KeyZ: 'light',
    // Medium / Kick
    KeyK: 'medium', KeyE: 'medium', KeyX: 'medium',
    // Heavy / Fierce / Launcher (Down+Heavy)
    KeyI: 'heavy', KeyF: 'heavy', KeyC: 'heavy',
    // Dedicated Launcher shortcut
    KeyH: 'launcher',
    // Throw / Grab
    KeyU: 'throw', KeyO: 'throw',
    // Special / Hyper (Down+Special)
    KeyL: 'special', KeyR: 'special', Space: 'special',
    // Dedicated Hyper Combo button
    KeyP: 'hyper', Enter: 'hyper',
    // Dedicated Dash macro
    ShiftLeft: 'dash', ShiftRight: 'dash'
  };

  addEventListener('keydown', event => {
    if (event.code === 'Escape') {
      if (hooks.shouldIgnore?.()) return;
      event.preventDefault();
      if (!event.repeat) hooks.onEscape?.();
      return;
    }

    if (hooks.shouldIgnore && hooks.shouldIgnore()) return;

    if (!event.repeat && hooks.onMenuKey?.(event)) {
      event.preventDefault();
      return;
    }

    const action = keyMap[event.code];
    if (!action || !hooks.isArena?.()) return;
    if (event.target instanceof Element && event.target.closest('button, a')
      && (event.code === 'Space' || event.code === 'Enter')) return;
    event.preventDefault();
    if (!event.repeat) playerInput.down(action, event.code);
  });

  addEventListener('keyup', event => {
    const action = keyMap[event.code];
    if (action) playerInput.up(action, event.code);
  });
}

// Capture each thumb, then resolve its position against the pad on every move.
export function bindTouch(playerInput, isActive) {
  const controls = document.querySelector('.touch-controls');
  const dpad = controls.querySelector('.touch-dpad');
  const buttons = [...controls.querySelectorAll('[data-input]')];
  const pointers = new Map();

  function update(pointer, next) {
    for (const action of pointer.actions) {
      if (!next.includes(action)) playerInput.up(action, pointer.id);
    }
    for (const action of next) {
      if (!pointer.actions.includes(action)) playerInput.down(action, pointer.id);
    }
    pointer.actions = next;
    for (const button of buttons) {
      const active = [...pointers.values()].some(item => item.actions.includes(button.dataset.input));
      button.classList.toggle('is-down', active);
    }
  }

  function actionsAt(pointer, event) {
    if (!pointer.directional) return [pointer.action];
    const hit = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-input]');
    const bounds = dpad.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    if (x < -0.18 || x > 1.18 || y < -0.2 || y > 1.2) return [];
    if (hit && dpad.contains(hit) && y <= 0.82) return [hit.dataset.input];
    const side = x < 0.33 ? 'left' : x > 0.67 ? 'right' : null;
    const vertical = y < 0.48 ? 'jump' : !side || y > 0.82 ? 'down' : null;
    return [side, vertical].filter(Boolean);
  }

  controls.addEventListener('pointerdown', event => {
    // Safari/iOS: toque pode chegar com button === -1.
    if ((event.pointerType === 'mouse' && event.button !== 0) || !isActive()) return;
    const button = event.target.closest('[data-input]');
    const directional = dpad.contains(event.target);
    if (!button && !directional) return;
    event.preventDefault();
    const pointer = { id: event.pointerId, action: button?.dataset.input, directional, actions: [] };
    pointers.set(pointer.id, pointer);
    try { controls.setPointerCapture(pointer.id); } catch { /* ponteiro já solto */ }
    update(pointer, actionsAt(pointer, event));
  }, { passive: false });

  controls.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (pointer?.directional) update(pointer, actionsAt(pointer, event));
  });

  function release(event) {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    pointers.delete(pointer.id);
    update(pointer, []);
  }

  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) controls.addEventListener(type, release);
  controls.addEventListener('contextmenu', event => event.preventDefault());
  // Aba oculta / blur: solta os dedos para não ficar golpe preso.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) playerInput.clear();
  });
  playerInput.onClear = () => {
    pointers.clear();
    for (const button of buttons) button.classList.remove('is-down');
  };
}
