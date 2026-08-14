import { INPUT_BUFFER, DASH_WINDOW } from './constants.js';

/**
 * Frame-aware input buffer with dash double-tap tracking.
 * Presses are stamped with the simulation frame so buffering stays stable at 60Hz.
 */
export class InputBuffer {
  constructor() {
    this.held = new Set();
    this.pressed = new Map();
    this.tapHistory = [];
    this.frameNumber = 0;
    this.lastDashFrame = -99;
  }

  updateFrame(frame) {
    this.frameNumber = frame;
  }

  down(action) {
    if (!this.held.has(action)) {
      this.pressed.set(action, this.frameNumber);
      this.tapHistory.push({ action, frame: this.frameNumber });
      if (this.tapHistory.length > 10) this.tapHistory.shift();
    }
    this.held.add(action);
  }

  up(action) {
    this.held.delete(action);
  }

  tap(action) {
    this.pressed.set(action, this.frameNumber);
    this.tapHistory.push({ action, frame: this.frameNumber });
    if (this.tapHistory.length > 10) this.tapHistory.shift();
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
   * True on the frame a direction was double-tapped (Street Fighter dash).
   * Consumes the gesture so it cannot retrigger until the next pair of taps.
   */
  consumeDash(action, window = DASH_WINDOW) {
    if (this.frameNumber - this.lastDashFrame < 18) return false;
    const taps = this.tapHistory.filter(t => t.action === action);
    if (taps.length < 2) return false;
    const latest = taps[taps.length - 1];
    const previous = taps[taps.length - 2];
    const recent = this.frameNumber - latest.frame <= 1;
    const gap = latest.frame - previous.frame;
    if (!recent || gap < 3 || gap > window) return false;
    this.lastDashFrame = this.frameNumber;
    this.tapHistory = this.tapHistory.filter(t => t.action !== action);
    return true;
  }

  clearDirections() {
    ['left', 'right', 'down', 'jump'].forEach(key => this.held.delete(key));
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
    this.tapHistory.length = 0;
  }
}

export function bindKeyboard(playerInput, hooks = {}) {
  const keyMap = {
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyS: 'down', ArrowDown: 'down',
    KeyW: 'jump', ArrowUp: 'jump',
    KeyJ: 'punch', KeyQ: 'punch',
    KeyK: 'kick', KeyE: 'kick',
    KeyU: 'throw', KeyO: 'throw',
    KeyL: 'special', KeyR: 'special', Space: 'special'
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
