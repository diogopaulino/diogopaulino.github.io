// ==========================================================================
// Rock Kombat — Input Buffer
// 60Hz deterministic buffer with MvC Magic Series, Dash Macros, Super Jump
// (Down -> Up), and zero-allocation gesture detection.
// ==========================================================================

import { INPUT_BUFFER, DASH_WINDOW } from './constants.js';

export class InputBuffer {
  constructor() {
    this.held = new Set();
    this.pressed = new Map();
    this.tapHistory = [];
    this.frameNumber = 0;
    this.lastDashFrame = -99;
    this.lastDownFrame = -99;
  }

  updateFrame(frame) {
    this.frameNumber = frame;
  }

  down(action) {
    if (!this.held.has(action)) {
      this.pressed.set(action, this.frameNumber);
      this.tapHistory.push({ action, frame: this.frameNumber });
      if (this.tapHistory.length > 14) this.tapHistory.shift();
      if (action === 'down') this.lastDownFrame = this.frameNumber;
    }
    this.held.add(action);
  }

  up(action) {
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
    this.held.delete('left');
    this.held.delete('right');
    this.held.delete('down');
    this.held.delete('jump');
  }

  clear() {
    this.held.clear();
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
    // Special / Hyper (Down+Special or Shift+Special)
    KeyL: 'special', KeyR: 'special', Space: 'special',
    // Dedicated Hyper Combo button
    KeyP: 'hyper', Enter: 'hyper',
    // Dedicated Dash macro
    ShiftLeft: 'dash', ShiftRight: 'dash'
  };

  addEventListener('keydown', event => {
    if (event.repeat) return;

    if (event.code === 'Escape') {
      event.preventDefault();
      if (hooks.onEscape) hooks.onEscape();
      return;
    }

    if (hooks.shouldIgnore && hooks.shouldIgnore()) return;

    if (hooks.onMenuKey && hooks.onMenuKey(event)) {
      event.preventDefault();
      return;
    }

    const action = keyMap[event.code];
    if (action) {
      event.preventDefault();
      if (hooks.isArena && hooks.isArena()) playerInput.down(action);
    }
  });

  addEventListener('keyup', event => {
    const action = keyMap[event.code];
    if (action) playerInput.up(action);
  });
}

export function bindTouch(playerInput) {
  const buttons = [...document.querySelectorAll('[data-input]')];
  buttons.forEach(button => {
    const action = button.dataset.input;
    const down = event => {
      event.preventDefault();
      if (event.button != null && event.button !== 0) return;
      button.setPointerCapture?.(event.pointerId);
      playerInput.down(action);
      button.classList.add('is-down');
    };
    const up = event => {
      event.preventDefault();
      playerInput.up(action);
      button.classList.remove('is-down');
    };
    button.addEventListener('pointerdown', down);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('contextmenu', event => event.preventDefault());
  });
}
