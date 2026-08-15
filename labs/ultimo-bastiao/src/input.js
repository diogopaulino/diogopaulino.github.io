const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Une teclado, mouse, toque e gamepad em um estado de entrada único. */
export class BattleInput {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.camera = { x: 0, y: 0 };
    this.attackQueued = false;
    this.heavyQueued = false;
    this.dodgeQueued = false;
    this.blocking = false;
    this.pointerBlocking = false;
    this.running = false;
    this.enabled = false;
    this.pointerDown = false;
    this.lastPointer = null;
    this.joystickPointer = null;
    this.joystickOrigin = null;
    this.pauseHandler = null;
    this.coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
    this.bind();
  }

  bind() {
    window.addEventListener('keydown', event => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (!this.enabled || event.repeat) return;
      if (event.code === 'Space') this.dodgeQueued = true;
      if (event.code === 'KeyF') this.heavyQueued = true;
      if (event.code === 'KeyP' || event.code === 'Escape') this.pauseHandler?.();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.blocking = false; this.pointerBlocking = false; });

    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('pointerdown', event => {
      if (!this.enabled) return;
      if (event.button === 0) {
        this.attackQueued = true;
        this.pointerDown = true;
        if (!this.coarse && document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock?.();
      }
      if (event.button === 2) this.pointerBlocking = true;
      this.lastPointer = { x: event.clientX, y: event.clientY };
    });
    window.addEventListener('pointerup', event => {
      if (event.button === 0) this.pointerDown = false;
      if (event.button === 2) this.pointerBlocking = false;
      this.lastPointer = null;
    });
    window.addEventListener('pointermove', event => {
      if (!this.enabled || this.joystickPointer === event.pointerId) return;
      if (document.pointerLockElement === this.canvas) {
        this.camera.x += event.movementX * .0032;
        this.camera.y += event.movementY * .0024;
      } else if (this.coarse && this.pointerDown && this.lastPointer) {
        this.camera.x += (event.clientX - this.lastPointer.x) * .005;
        this.camera.y += (event.clientY - this.lastPointer.y) * .004;
        this.lastPointer = { x: event.clientX, y: event.clientY };
      }
    });

    this.bindTouch();
  }

  bindTouch() {
    const zone = document.getElementById('moveStick');
    const knob = document.getElementById('stickKnob');
    const updateStick = event => {
      if (!this.joystickOrigin) return;
      const dx = event.clientX - this.joystickOrigin.x;
      const dy = event.clientY - this.joystickOrigin.y;
      const distance = Math.hypot(dx, dy) || 1;
      const max = 42;
      const scale = Math.min(max, distance) / distance;
      const x = dx * scale;
      const y = dy * scale;
      this.move.x = clamp(x / max, -1, 1);
      this.move.y = clamp(-y / max, -1, 1);
      knob.style.transform = `translate(${x}px, ${y}px)`;
    };
    const resetStick = event => {
      if (event && event.pointerId !== this.joystickPointer) return;
      this.joystickPointer = null;
      this.joystickOrigin = null;
      this.move.x = 0; this.move.y = 0;
      knob.style.transform = 'translate(0, 0)';
    };
    zone.addEventListener('pointerdown', event => {
      if (!this.enabled) return;
      event.preventDefault();
      this.joystickPointer = event.pointerId;
      const rect = zone.getBoundingClientRect();
      this.joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      zone.setPointerCapture(event.pointerId);
      updateStick(event);
    });
    zone.addEventListener('pointermove', event => {
      if (event.pointerId === this.joystickPointer) updateStick(event);
    });
    zone.addEventListener('pointerup', resetStick);
    zone.addEventListener('pointercancel', resetStick);

    const attack = document.getElementById('attackButton');
    let attackHoldTimer = null;
    let attackPointer = null;
    let heavyAttack = false;
    const stopAttackHold = event => {
      if (event && event.pointerId !== attackPointer) return;
      if (attackHoldTimer) clearTimeout(attackHoldTimer);
      attackHoldTimer = null;
      if (this.enabled) {
        if (heavyAttack) this.heavyQueued = true;
        else this.attackQueued = true;
      }
      attackPointer = null;
      heavyAttack = false;
      attack.classList.remove('pressed');
    };
    attack.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (!this.enabled) return;
      attack.classList.add('pressed');
      attackPointer = event.pointerId;
      attack.setPointerCapture?.(event.pointerId);
      heavyAttack = false;
      attackHoldTimer = setTimeout(() => {
        heavyAttack = true;
        attackHoldTimer = null;
      }, 340);
    });
    attack.addEventListener('pointerup', stopAttackHold);
    attack.addEventListener('pointercancel', stopAttackHold);

    const dodge = document.getElementById('dodgeButton');
    dodge.addEventListener('pointerdown', event => { event.preventDefault(); if (this.enabled) this.dodgeQueued = true; });

    const block = document.getElementById('blockButton');
    const endBlock = () => { this.pointerBlocking = false; block.classList.remove('pressed'); };
    block.addEventListener('pointerdown', event => { event.preventDefault(); if (!this.enabled) return; this.pointerBlocking = true; block.classList.add('pressed'); });
    block.addEventListener('pointerup', endBlock);
    block.addEventListener('pointercancel', endBlock);
    block.addEventListener('pointerleave', endBlock);
  }

  update() {
    if (!this.coarse) {
      this.move.x = (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) - (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
      this.move.y = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
      const length = Math.hypot(this.move.x, this.move.y);
      if (length > 1) { this.move.x /= length; this.move.y /= length; }
    }
    this.blocking = this.pointerBlocking || this.keys.has('KeyQ');
    this.running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.pollGamepad();
  }

  pollGamepad() {
    const pad = navigator.getGamepads?.()[0];
    if (!pad || !this.enabled) return;
    const dead = value => Math.abs(value) < .16 ? 0 : value;
    this.move.x = dead(pad.axes[0] || 0);
    this.move.y = -dead(pad.axes[1] || 0);
    this.camera.x += dead(pad.axes[2] || 0) * .045;
    this.camera.y += dead(pad.axes[3] || 0) * .035;
    if (pad.buttons[0]?.pressed && !this.padAttack) this.attackQueued = true;
    if (pad.buttons[1]?.pressed && !this.padDodge) this.dodgeQueued = true;
    if (pad.buttons[3]?.pressed && !this.padHeavy) this.heavyQueued = true;
    this.blocking = this.blocking || Boolean(pad.buttons[4]?.pressed || pad.buttons[6]?.pressed);
    this.running = this.running || Boolean(pad.buttons[10]?.pressed);
    this.padAttack = pad.buttons[0]?.pressed;
    this.padDodge = pad.buttons[1]?.pressed;
    this.padHeavy = pad.buttons[3]?.pressed;
  }

  consume(name) {
    const key = `${name}Queued`;
    const value = Boolean(this[key]);
    this[key] = false;
    return value;
  }

  consumeCamera() {
    const delta = { ...this.camera };
    this.camera.x = 0; this.camera.y = 0;
    return delta;
  }
}
