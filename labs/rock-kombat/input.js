import { INPUT_BUFFER } from './constants.js';

/**
 * Input buffer with frame-aware press tracking.
 * Held = currently pressed keys, Pressed = timestamped key presses for buffered input.
 */
export class InputBuffer {
  constructor() {
    this.held = new Set();
    this.pressed = new Map();
    this.frameNumber = 0;
  }

  /** Sync the internal frame counter (called each fixedUpdate) */
  updateFrame(frame) {
    this.frameNumber = frame;
  }

  down(action) {
    if (!this.held.has(action)) this.pressed.set(action, this.frameNumber);
    this.held.add(action);
  }

  up(action) {
    this.held.delete(action);
  }

  tap(action) {
    this.pressed.set(action, this.frameNumber);
  }

  has(action) {
    return this.held.has(action);
  }

  /** Was action pressed within the last `window` frames? (non-consuming) */
  fresh(action, window = 1) {
    return this.pressed.has(action) && this.frameNumber - this.pressed.get(action) <= window;
  }

  /** Was action pressed within buffer window? Consumes the press. */
  consume(action, window = INPUT_BUFFER) {
    if (!this.pressed.has(action) || this.frameNumber - this.pressed.get(action) > window) return false;
    this.pressed.delete(action);
    return true;
  }

  clearDirections() {
    ['left', 'right', 'down', 'jump'].forEach(key => this.held.delete(key));
  }

  clear() {
    this.held.clear();
    this.pressed.clear();
  }
}

/** Bind keyboard input to a player's InputBuffer */
export function bindKeyboard(playerInput, onPause) {
  const keyMap = {
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyS: 'down', ArrowDown: 'down',
    KeyW: 'jump', ArrowUp: 'jump',
    KeyJ: 'punch', KeyQ: 'punch',
    KeyK: 'kick', KeyE: 'kick',
    KeyL: 'special', KeyR: 'special', Space: 'special'
  };

  addEventListener('keydown', event => {
    const action = keyMap[event.code];
    if (action) {
      event.preventDefault();
      playerInput.down(action);
    }
    if (event.code === 'Escape' && onPause) onPause();
  });

  addEventListener('keyup', event => {
    const action = keyMap[event.code];
    if (action) playerInput.up(action);
  });
}

/** Bind touch/pointer controls to on-screen buttons */
export function bindTouch(playerInput) {
  const buttons = [...document.querySelectorAll('[data-input]')];
  buttons.forEach(button => {
    const action = button.dataset.input;
    const down = event => {
      event.preventDefault();
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
    button.addEventListener('pointerleave', up);
  });
}
