// ==========================================================================
// Rock Kombat — Fighter Module
// Fighter class with state machine, hitbox/hurtbox, and move execution
// ==========================================================================

import {
  GROUND, LEFT_WALL, RIGHT_WALL,
  SPECIAL_COST, PARRY_WINDOW, PARRY_COOLDOWN,
  MOVES, METER_GAIN, FRAME, BODY_WIDTH
} from './constants.js';
import { clamp } from './utils.js';
import audio from './audio.js';
import { spawnProjectile } from './combat.js';

/**
 * Build move data for a given fighter + move name.
 * Special/Super moves are character-specific.
 */
export function moveFor(fighter, name) {
  if (name !== 'special') return { name, ...MOVES[name] };

  const superMove = fighter.meter >= 100;

  // Axl Rose — rush-type special (dash forward with active hitbox)
  if (fighter.data.id === 'axl') {
    return {
      name: superMove ? 'super' : 'special',
      startup: superMove ? 13 : 9,
      active: superMove ? 10 : 7,
      recovery: 24,
      damage: superMove ? 24 : 14,
      hitstun: 28, blockstun: 16,
      reach: superMove ? 270 : 215,
      top: 270, bottom: 35,
      push: 58,
      hitstop: superMove ? 14 : 10,
      meter: 0, sprite: 6, level: 'mid',
      rush: superMove ? 18 : 13,
      superMove
    };
  }

  // Kurt & Lennon — projectile-type special
  return {
    name: superMove ? 'super' : 'special',
    startup: superMove ? 17 : 12,
    active: 1,
    recovery: superMove ? 34 : 27,
    damage: superMove ? 22 : 13,
    hitstun: 26, blockstun: 15,
    reach: 0,
    top: 260, bottom: 55,
    push: 48,
    hitstop: superMove ? 13 : 9,
    meter: 0, sprite: 8, level: 'mid',
    projectile: true,
    superMove
  };
}

/**
 * Fighter — represents a player or CPU combatant.
 *
 * State machine:
 *   idle → walk / crouch / jump / attack
 *   attack → idle (on move end) / attack (on cancel)
 *   hitstun → idle / jump (on stun end)
 *   blockstun → idle (on stun end)
 *   knockdown → getup → idle
 *   victory (terminal)
 */
export class Fighter {
  constructor(data, input, isCpu = false) {
    this.data = data;
    this.input = input;
    this.isCpu = isCpu;
    this.wins = 0;
    this.match = null;
    this.image = null; // set after assets load
    this.reset(isCpu ? 910 : 370);
  }

  /** Store reference to the match object (for events, freeze, projectiles) */
  setMatch(match) {
    this.match = match;
  }

  reset(x, preserveMeter = false) {
    const carriedMeter = preserveMeter ? this.meter : 0;
    this.x = x;
    this.y = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.facing = this.isCpu ? -1 : 1;
    this.health = 100;
    this.whiteHealth = 100;
    this.meter = carriedMeter;
    this.state = 'idle';
    this.stateFrame = 0;
    this.move = null;
    this.moveFrame = 0;
    this.moveConnected = false;
    this.moveHit = false;
    this.hitstun = 0;
    this.blockstun = 0;
    this.knockdown = 0;
    this.invuln = 0;
    this.combo = 0;
    this.comboClock = 0;
    this.parryCooldown = 0;
  }

  grounded() { return this.y >= GROUND - 0.1; }

  neutral() { return ['idle', 'walk', 'crouch', 'jump'].includes(this.state); }

  gainMeter(amount) { this.meter = clamp(this.meter + amount, 0, 100); }

  directionTo(opponent) { return opponent.x > this.x ? 1 : -1; }

  awayHeld(opponent) {
    return this.directionTo(opponent) === 1
      ? this.input.has('left')
      : this.input.has('right');
  }

  /**
   * Is this fighter currently blocking the given move?
   * Standing block stops mid/overhead, crouching block stops low.
   */
  blocking(opponent, move) {
    if (!this.neutral() || !this.grounded() || !this.awayHeld(opponent)) return false;
    if (move.level === 'low') return this.input.has('down');
    if (move.level === 'overhead') return !this.input.has('down');
    return true;
  }

  /**
   * Is the fighter performing a just-frame parry?
   * Requires a fresh directional input within PARRY_WINDOW frames
   * and no active parry cooldown.
   */
  parrying(opponent) {
    if (this.parryCooldown > 0) return false;
    const away = this.directionTo(opponent) === 1 ? 'left' : 'right';
    return this.input.fresh(away, PARRY_WINDOW);
  }

  /**
   * Attempt to start a move. Returns true if successful.
   * Handles cancel chains: a connected hit can cancel into allowed moves,
   * but only after startup frames have elapsed (no startup cancels).
   */
  beginMove(name) {
    const next = moveFor(this, name);

    if (this.move) {
      // Cancel check: must have connected AND be past startup
      const cancelable = this.moveConnected
        && this.moveFrame >= this.move.startup
        && this.move.cancel
        && this.move.cancel.includes(name);
      if (!cancelable) return false;
    } else if (!this.neutral()) {
      return false;
    }

    // Meter cost for specials
    if (name === 'special') {
      if (this.meter < SPECIAL_COST) return false;
      this.meter = next.superMove ? 0 : this.meter - SPECIAL_COST;
    } else {
      this.gainMeter(next.meter * METER_GAIN.commit);
    }

    this.move = next;
    this.moveFrame = 0;
    this.moveConnected = false;
    this.moveHit = false;
    this.state = 'attack';

    // Sound effect
    audio.sfx(
      next.superMove ? 'super' : name === 'special' ? 'special' : 'whiff',
      next.damage / 10
    );

    // Super move: freeze frame + announcement via events
    if (next.superMove && this.match) {
      this.match.freeze = 18;
      this.match.shake = 8;
      this.match.events.push({
        type: 'announce',
        text: `${this.data.short} SUPER`,
        duration: 900
      });
    }

    return true;
  }

  /**
   * Check buffered inputs and attempt to execute a move.
   * Priority: special > kick > punch
   */
  chooseAction() {
    if (this.input.consume('special')) return this.beginMove('special');
    if (this.input.consume('kick')) {
      return this.beginMove(
        !this.grounded() ? 'airkick'
          : this.input.has('down') ? 'sweep'
          : 'kick'
      );
    }
    if (this.input.consume('punch')) {
      return this.beginMove(
        this.input.has('down') && this.grounded() ? 'uppercut' : 'punch'
      );
    }
    return false;
  }

  /** Main per-frame update. Handles state transitions and physics. */
  update(opponent) {
    this.stateFrame++;
    if (this.invuln > 0) this.invuln--;
    if (this.comboClock > 0) this.comboClock--; else this.combo = 0;
    if (this.parryCooldown > 0) this.parryCooldown--;

    // White health lerps toward actual health (visual "chip" drain)
    this.whiteHealth += (this.health - this.whiteHealth) * 0.045;
    this.facing = this.directionTo(opponent);

    // --- Hitstun state ---
    if (this.state === 'hitstun') {
      this.hitstun--;
      this.x += this.vx;
      this.vx *= 0.88;
      if (!this.grounded() || this.vy) {
        this.y += this.vy;
        this.vy += 0.72;
        if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; }
      }
      if (this.hitstun <= 0) this.state = this.grounded() ? 'idle' : 'jump';
      return;
    }

    // --- Blockstun state ---
    if (this.state === 'blockstun') {
      if (--this.blockstun <= 0) this.state = 'idle';
      return;
    }

    // --- Knockdown → Getup transition ---
    if (this.state === 'knockdown') {
      if (--this.knockdown <= 0) {
        this.state = 'getup';
        this.stateFrame = 0;
        this.invuln = 12;
      }
      return;
    }

    // --- Getup state (12 frames of invulnerability blink) ---
    if (this.state === 'getup') {
      if (this.stateFrame >= 12) {
        this.state = 'idle';
      }
      return;
    }

    // --- Victory state (terminal) ---
    if (this.state === 'victory') return;

    // --- Active move ---
    if (this.move) {
      this.moveFrame++;

      // Rush moves (Axl's special) advance position during startup+active
      if (this.move.rush && this.moveFrame <= this.move.startup + this.move.active) {
        this.x += this.facing * this.move.rush;
      }

      // Projectile spawn on startup frame
      if (this.move.projectile && !this.move.spawned && this.moveFrame === this.move.startup) {
        this.move.spawned = true;
        if (this.match) spawnProjectile(this.match, this, this.move);
      }

      // Try to cancel into another move (only if current move connected)
      this.chooseAction();

      // Move completion
      if (this.move && this.moveFrame >= this.move.startup + this.move.active + this.move.recovery) {
        this.move = null;
        this.state = this.grounded() ? 'idle' : 'jump';
      }
    } else {
      // --- Neutral state: movement & action ---
      if (this.chooseAction()) return;

      if (this.input.consume('jump') && this.grounded()) {
        this.vy = -this.data.jump;
        this.state = 'jump';
      }

      const direction = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);

      if (this.grounded() && this.input.has('down')) {
        this.state = 'crouch';
      } else if (direction) {
        this.x += direction * this.data.speed;
        this.state = 'walk';
      } else if (this.grounded()) {
        this.state = 'idle';
      }
    }

    // --- Gravity & landing ---
    if (!this.grounded() || this.vy) {
      this.y += this.vy;
      this.vy += 0.72;
      this.state = this.move ? 'attack' : 'jump';
      if (this.y >= GROUND) {
        this.y = GROUND;
        this.vy = 0;
        if (!this.move) this.state = 'idle';
      }
    }

    // Clamp to arena bounds
    this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
  }

  /**
   * Returns the active hitbox rectangle during the active frames of a move.
   * Null if no active hitbox.
   */
  activeBox() {
    if (!this.move || this.move.projectile || this.moveHit) return null;
    if (this.moveFrame < this.move.startup || this.moveFrame >= this.move.startup + this.move.active) return null;

    const near = this.x + this.facing * 28;
    const far = this.x + this.facing * this.move.reach;
    return {
      left: Math.min(near, far),
      right: Math.max(near, far),
      top: this.y - this.move.top,
      bottom: this.y - this.move.bottom
    };
  }

  /**
   * Returns the fighter's hurtbox (vulnerable area).
   * Shorter when crouching.
   */
  hurtBox() {
    const crouching = this.state === 'crouch' || (this.move && this.move.name === 'sweep');
    return {
      left: this.x - BODY_WIDTH,
      right: this.x + BODY_WIDTH,
      top: this.y - (crouching ? 175 : 305),
      bottom: this.y - 10
    };
  }

  /** Returns the sprite sheet frame index for the current state. */
  spriteFrame() {
    if (this.state === 'victory') return FRAME.victory;
    if (this.state === 'hitstun' || this.state === 'knockdown' || this.state === 'getup') return FRAME.hit;

    // Block pose: in blockstun, or holding away while neutral
    if (this.state === 'blockstun') return FRAME.block;
    if (this.neutral() && this.match) {
      const opponent = this.isCpu ? this.match.p1 : this.match.p2;
      if (opponent && this.awayHeld(opponent)) return FRAME.block;
    }

    if (this.move) return this.move.sprite;
    if (this.state === 'crouch') return FRAME.crouch;

    if (this.state === 'walk') {
      const dir = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
      return this.facing * dir > 0 ? FRAME.forward : FRAME.back;
    }

    if (this.state === 'jump') return FRAME.forward;

    // Idle breathing animation
    return Math.floor(this.stateFrame / 18) % 2 ? FRAME.idleB : FRAME.idleA;
  }
}
