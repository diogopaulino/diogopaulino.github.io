// ==========================================================================
// Rock Kombat — Fighter
// Street Fighter / Mortal Kombat state machine: dash, jump arc, throws, DP
// ==========================================================================

import {
  GROUND, LEFT_WALL, RIGHT_WALL,
  SPECIAL_COST, PARRY_WINDOW, PARRY_COOLDOWN,
  MOVES, METER_GAIN, FRAME, BODY_WIDTH, THROW_RANGE,
  GRAVITY, BACK_WALK, LAND_LAG, INPUT_BUFFER
} from './constants.js';
import { clamp } from './utils.js';
import audio from './audio.js';
import { spawnProjectile } from './combat.js';

export function moveFor(fighter, name) {
  if (name !== 'special') return { name, ...MOVES[name] };

  const superMove = fighter.meter >= 100;

  if (fighter.data.id === 'axl') {
    return {
      name: superMove ? 'super' : 'special',
      startup: superMove ? 11 : 8,
      active: superMove ? 11 : 8,
      recovery: 22,
      damage: superMove ? 26 : 15,
      hitstun: 28, blockstun: 16,
      reach: superMove ? 280 : 220,
      top: 270, bottom: 35,
      push: 62,
      hitstop: superMove ? 15 : 10,
      meter: 0, sprite: 6, level: 'mid',
      rush: superMove ? 19 : 14,
      superMove
    };
  }

  const zoner = fighter.data.id === 'lennon';
  return {
    name: superMove ? 'super' : 'special',
    startup: superMove ? (zoner ? 16 : 14) : (zoner ? 13 : 11),
    active: 1,
    recovery: superMove ? 32 : 24,
    damage: superMove ? (zoner ? 20 : 23) : (zoner ? 12 : 14),
    hitstun: 26, blockstun: 15,
    reach: 0,
    top: 260, bottom: 55,
    push: 48,
    hitstop: superMove ? 13 : 9,
    meter: 0, sprite: 8, level: 'mid',
    projectile: true,
    projectileSpeed: zoner ? 8.4 : 11.2,
    projectileRadius: zoner ? 36 : 28,
    superMove
  };
}

const LOCKED_FACE = new Set(['attack', 'hitstun', 'blockstun', 'knockdown', 'getup', 'dash', 'backdash']);
const UNTHROWABLE = new Set(['hitstun', 'knockdown', 'getup', 'victory']);

export class Fighter {
  constructor(data, input, isCpu = false) {
    this.data = data;
    this.input = input;
    this.isCpu = isCpu;
    this.wins = 0;
    this.match = null;
    this.image = null;
    this.reset(isCpu ? 910 : 370);
  }

  setMatch(match) {
    this.match = match;
  }

  opponent() {
    if (!this.match) return null;
    return this.isCpu ? this.match.p1 : this.match.p2;
  }

  reset(x, preserveMeter = false) {
    const carriedMeter = preserveMeter ? this.meter : 0;
    this.x = x;
    this.y = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.jumpVx = 0;
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
    this.comboDamage = 0;
    this.parryCooldown = 0;
    this.dashTimer = 0;
    this.dashType = null;
    this.landLag = 0;
    this.launched = false;
    this.trail = [];
    this.wasGrounded = true;
  }

  grounded() { return this.y >= GROUND - 0.1; }

  neutral() { return ['idle', 'walk', 'crouch', 'jump'].includes(this.state); }

  gainMeter(amount) { this.meter = clamp(this.meter + amount, 0, 100); }

  directionTo(opponent) { return opponent.x >= this.x ? 1 : -1; }

  awayHeld(opponent) {
    return this.directionTo(opponent) === 1
      ? this.input.has('left')
      : this.input.has('right');
  }

  towardHeld(opponent) {
    return this.directionTo(opponent) === 1
      ? this.input.has('right')
      : this.input.has('left');
  }

  blocking(opponent, move) {
    if (move.unblockable) return false;
    if (!this.grounded() || !this.awayHeld(opponent)) return false;
    if (!this.neutral() && this.state !== 'blockstun') return false;
    if (move.level === 'low') return this.input.has('down');
    if (move.level === 'overhead') return !this.input.has('down');
    return true;
  }

  parrying(opponent) {
    if (this.parryCooldown > 0) return false;
    const away = this.directionTo(opponent) === 1 ? 'left' : 'right';
    return this.input.fresh(away, PARRY_WINDOW);
  }

  canThrow() {
    const opponent = this.opponent();
    if (!opponent || !this.grounded() || !opponent.grounded()) return false;
    if (opponent.invuln > 0) return false;
    if (UNTHROWABLE.has(opponent.state)) return false;
    if (opponent.activeBox()) return false;
    return Math.abs(opponent.x - this.x) <= THROW_RANGE;
  }

  beginMove(name) {
    const next = moveFor(this, name);

    if (this.move) {
      const cancelable = this.moveConnected
        && this.moveFrame >= this.move.startup
        && this.move.cancel
        && this.move.cancel.includes(name === 'special' ? 'special' : name);
      if (!cancelable) return false;
    } else if (this.landLag > 0) {
      return false;
    } else if (this.state === 'dash') {
      if (this.dashType === 'back') return false;
    } else if (this.state === 'getup') {
      if (!['special', 'uppercut'].includes(next.name) && name !== 'special') return false;
    } else if (!this.neutral() && this.state !== 'dash') {
      return false;
    }

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
    this.dashTimer = 0;
    this.dashType = null;

    if (next.invuln) this.invuln = Math.max(this.invuln, next.invuln);
    if (next.superMove && this.data.id === 'axl') this.invuln = Math.max(this.invuln, 6);

    audio.sfx(
      next.superMove ? 'super' : name === 'throw' ? 'throw' : name === 'special' ? 'special' : 'whiff',
      next.damage / 10
    );

    if (next.superMove && this.match) {
      this.match.freeze = 20;
      this.match.shake = 10;
      this.match.superFlash = 18;
      this.match.events.push({
        type: 'announce',
        text: `${this.data.short} SUPER`,
        duration: 900
      });
    }

    return true;
  }

  chooseAction() {
    if (this.input.consume('special')) return this.beginMove('special');
    if (this.input.consume('throw')) {
      return this.canThrow() ? this.beginMove('throw') : this.beginMove('punch');
    }

    const throwChord = this.input.has('punch') && this.input.has('kick')
      && (this.input.fresh('punch', 4) || this.input.fresh('kick', 4));
    const throwTaps = this.input.fresh('punch', INPUT_BUFFER) && this.input.fresh('kick', INPUT_BUFFER);
    if (this.canThrow() && (throwChord || throwTaps)) {
      this.input.consume('punch');
      this.input.consume('kick');
      return this.beginMove('throw');
    }

    if (this.input.consume('kick')) {
      return this.beginMove(
        !this.grounded() ? 'airkick'
          : this.input.has('down') ? 'sweep'
          : 'kick'
      );
    }
    if (this.input.consume('punch')) {
      return this.beginMove(
        !this.grounded() ? 'airpunch'
          : this.input.has('down') ? 'uppercut'
          : 'punch'
      );
    }
    return false;
  }

  tryDash(opponent) {
    if (!this.grounded() || this.move || this.landLag > 0) return false;
    if (this.input.has('down')) return false;
    const toward = this.directionTo(opponent) === 1 ? 'right' : 'left';
    const away = toward === 'right' ? 'left' : 'right';
    if (this.input.consumeDash(toward)) {
      this.state = 'dash';
      this.dashType = 'forward';
      this.dashTimer = 12;
      this.stateFrame = 0;
      audio.sfx('dash');
      return true;
    }
    if (this.input.consumeDash(away)) {
      this.state = 'backdash';
      this.dashType = 'back';
      this.dashTimer = 14;
      this.invuln = Math.max(this.invuln, 8);
      this.stateFrame = 0;
      audio.sfx('dash');
      return true;
    }
    return false;
  }

  pushTrail() {
    if ((this.state === 'dash' || this.state === 'backdash' || (this.move && this.move.rush)) && (this.stateFrame & 1) === 0) {
      this.trail.push({
        x: this.x,
        y: this.y,
        frame: this.spriteFrame(),
        facing: this.facing,
        life: 8
      });
      if (this.trail.length > 6) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      if (--this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }

  update(opponent) {
    this.stateFrame++;
    if (this.invuln > 0) this.invuln--;
    if (this.landLag > 0) this.landLag--;
    if (this.comboClock > 0) this.comboClock--;
    else {
      this.combo = 0;
      this.comboDamage = 0;
    }
    if (this.parryCooldown > 0) this.parryCooldown--;

    this.whiteHealth += (this.health - this.whiteHealth) * 0.05;
    if (!LOCKED_FACE.has(this.state)) this.facing = this.directionTo(opponent);

    this.pushTrail();

    if (this.state === 'hitstun') {
      this.hitstun--;
      this.x += this.vx;
      this.vx *= 0.86;
      if (!this.grounded() || this.vy) {
        this.y += this.vy;
        this.vy += GRAVITY;
        if (this.y >= GROUND) {
          this.y = GROUND;
          this.vy = 0;
          this.vx *= 0.4;
          if (this.launched || this.hitstun > 2) {
            this.state = 'knockdown';
            this.knockdown = Math.max(this.knockdown, 28);
            this.launched = false;
            this.hitstun = 0;
            return;
          }
        }
      }
      if (this.hitstun <= 0) {
        this.launched = false;
        this.state = this.grounded() ? 'idle' : 'jump';
        if (!this.grounded()) this.jumpVx = this.vx;
      }
      this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
      return;
    }

    if (this.state === 'blockstun') {
      this.x += this.vx;
      this.vx *= 0.8;
      if (--this.blockstun <= 0) {
        this.vx = 0;
        this.state = this.input.has('down') ? 'crouch' : 'idle';
      }
      this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
      return;
    }

    if (this.state === 'knockdown') {
      if (--this.knockdown <= 0) {
        this.state = 'getup';
        this.stateFrame = 0;
        this.invuln = 10;
        this.vx = 0;
      }
      return;
    }

    if (this.state === 'getup') {
      if (this.stateFrame >= 8) this.chooseAction();
      if (!this.move && this.stateFrame >= 14) this.state = 'idle';
      return;
    }

    if (this.state === 'victory') return;

    if (this.dashTimer > 0) {
      this.dashTimer--;
      const speed = this.dashType === 'back' ? -11.5 : 15.5;
      this.x += this.facing * speed * (this.data.mobility / 80);
      this.state = this.dashType === 'back' ? 'backdash' : 'dash';
      if (this.dashType === 'forward') this.chooseAction();
      if (this.dashTimer <= 0 && !this.move) this.state = 'idle';
    } else if (this.move) {
      this.moveFrame++;

      if (this.move.advance && this.moveFrame <= this.move.startup) {
        this.x += this.facing * this.move.advance;
      }
      if (this.move.rush && this.moveFrame <= this.move.startup + this.move.active) {
        this.x += this.facing * this.move.rush;
      }
      if (this.move.projectile && !this.move.spawned && this.moveFrame === this.move.startup) {
        this.move.spawned = true;
        if (this.match) spawnProjectile(this.match, this, this.move);
      }

      this.chooseAction();

      if (this.move && this.moveFrame >= this.move.startup + this.move.active + this.move.recovery) {
        this.move = null;
        this.state = this.grounded() ? 'idle' : 'jump';
      }
    } else {
      if (this.tryDash(opponent)) {
        // dash started
      } else if (this.chooseAction()) {
        this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
        return;
      } else if (this.input.consume('jump') && this.grounded() && this.landLag <= 0) {
        const held = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
        this.vy = -this.data.jump;
        this.jumpVx = held * this.data.speed * 1.22;
        this.state = 'jump';
        this.wasGrounded = false;
      } else if (this.grounded()) {
        const direction = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
        if (this.input.has('down')) {
          this.state = 'crouch';
        } else if (direction) {
          const backward = direction !== this.facing;
          this.x += direction * this.data.speed * (backward ? BACK_WALK : 1);
          this.state = 'walk';
        } else {
          this.state = 'idle';
        }
      }
    }

    if (!this.grounded() || this.vy) {
      if (!this.move) {
        const airSteer = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
        this.jumpVx += airSteer * 0.12;
        this.jumpVx = clamp(this.jumpVx, -this.data.speed * 1.35, this.data.speed * 1.35);
        this.x += this.jumpVx;
      }
      this.y += this.vy;
      this.vy += GRAVITY;
      if (!this.move) this.state = 'jump';
      if (this.y >= GROUND) {
        this.y = GROUND;
        this.vy = 0;
        this.jumpVx = 0;
        this.landLag = LAND_LAG;
        if (this.match) this.match.events.push({ type: 'dust', x: this.x, y: GROUND });
        if (!this.move) this.state = 'idle';
      }
    }

    this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
  }

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

  hurtBox() {
    const crouching = this.state === 'crouch' || this.state === 'getup'
      || (this.move && (this.move.name === 'sweep' || this.move.level === 'low'));
    const dashing = this.state === 'backdash';
    const width = dashing ? BODY_WIDTH * 0.72 : BODY_WIDTH;
    return {
      left: this.x - width,
      right: this.x + width,
      top: this.y - (crouching ? 168 : 305),
      bottom: this.y - 8
    };
  }

  spriteFrame() {
    if (this.state === 'victory') return FRAME.victory;
    if (this.state === 'hitstun' || this.state === 'knockdown' || this.state === 'getup') return FRAME.hit;
    if (this.state === 'blockstun') return FRAME.block;
    if (this.neutral() && this.match) {
      const opponent = this.opponent();
      if (opponent && this.awayHeld(opponent) && this.grounded()) return FRAME.block;
    }
    if (this.move) return this.move.sprite;
    if (this.state === 'crouch') return FRAME.crouch;
    if (this.state === 'dash') return FRAME.forward;
    if (this.state === 'backdash') return FRAME.back;
    if (this.state === 'walk') {
      const dir = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
      if (!dir) return FRAME.forward;
      return this.facing * dir > 0 ? FRAME.forward : FRAME.back;
    }
    if (this.state === 'jump') return FRAME.forward;
    return Math.floor(this.stateFrame / 16) % 2 ? FRAME.idleB : FRAME.idleA;
  }
}
