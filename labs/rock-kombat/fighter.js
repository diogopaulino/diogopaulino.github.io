// ==========================================================================
// Rock Kombat — Fighter State Machine
// Marvel vs. Capcom & Mortal Kombat hybrid combat mechanics:
// - Magic Series Chain: Light -> Medium -> Heavy -> Launcher -> Super Jump Air Rave
// - Air Dash & Wave Dash cancels
// - Advancing Guard (Pushblock) when pressing L+M or Dash during blockstun
// - 3-Bar Hyper Amplifier: EX Special (1 bar) & Cinematic Hyper Combo (2+ bars)
// ==========================================================================

import {
  GROUND, LEFT_WALL, RIGHT_WALL,
  EX_COST, HYPER_COST, PUSHBLOCK_COST, MAX_METER,
  PARRY_WINDOW, PARRY_COOLDOWN,
  MOVES, NORMAL_VARIANTS, METER_GAIN, FRAME, BODY_WIDTH, THROW_RANGE,
  GRAVITY, JUGGLE_GRAVITY, BACK_WALK, LAND_LAG, INPUT_BUFFER
} from './constants.js?v=23';
import { approach, clamp } from './utils.js';
import audio from './audio.js';
import { spawnProjectile, triggerPushblock } from './combat.js';

export function moveFor(fighter, name) {
  if (name !== 'special' && name !== 'hyper') {
    return { name, ...MOVES[name], ...NORMAL_VARIANTS[fighter.data.id]?.[name] };
  }

  const isHyper = name === 'hyper';
  const id = fighter.data.id;

  if (isHyper) {
    if (id === 'axl') {
      // Axl's Hyper: Jungle Hurricane (multi-hit full-screen blazing rush)
      return {
        name: 'hyper',
        title: 'JUNGLE HURRICANE',
        startup: 8,
        active: 32,
        recovery: 20,
        damage: 6,
        multiHit: 6,
        hitInterval: 5,
        hitstun: 34,
        blockstun: 20,
        reach: 265,
        top: 285,
        bottom: 20,
        push: 26,
        hitstop: 5,
        meter: 0,
        sprite: 6,
        level: 'mid',
        rush: 18.5,
        invuln: 14,
        wallBounce: true,
        superMove: true
      };
    }

    if (id === 'kurt') {
      // Kurt's Hyper: Nirvana Overdrive (colossal sonic beam across the entire stage)
      return {
        name: 'hyper',
        title: 'NIRVANA OVERDRIVE',
        startup: 9,
        active: 34,
        recovery: 24,
        damage: 7,
        multiHit: 6,
        hitInterval: 5,
        hitstun: 38,
        blockstun: 22,
        reach: 0,
        top: 290,
        bottom: 75,
        push: 20,
        hitstop: 7,
        meter: 0,
        sprite: 8,
        level: 'mid',
        beam: true,
        invuln: 12,
        superMove: true
      };
    }

    // Lennon's Hyper: Imagine Supernova (psychedelic barrage of harmonic orbs)
    return {
      name: 'hyper',
      title: 'IMAGINE SUPERNOVA',
      startup: 9,
      active: 30,
      recovery: 22,
      damage: 8,
      hitstun: 34,
      blockstun: 20,
      reach: 0,
      top: 280,
      bottom: 40,
      push: 46,
      hitstop: 6,
      meter: 0,
      sprite: 8,
      level: 'mid',
      projectile: true,
      barrage: 5,
      projectileSpeed: 13.5,
      projectileRadius: 48,
      invuln: 12,
      superMove: true
    };
  }

  // 1-Bar EX Special Move
  if (id === 'axl') {
    return {
      name: 'special',
      title: 'PARADISE RUSH',
      startup: 7,
      active: 11,
      recovery: 18,
      damage: 14,
      hitstun: 28,
      blockstun: 15,
      reach: 225,
      top: 270,
      bottom: 30,
      push: 46,
      hitstop: 10,
      meter: 0,
      sprite: 6,
      level: 'mid',
      rush: 15.5,
      invuln: 5,
      wallBounce: true,
      exMove: true
    };
  }

  const zoner = id === 'lennon';
  return {
    name: 'special',
    title: zoner ? 'PEACE PULSE' : 'FEEDBACK WAVE',
    startup: zoner ? 10 : 9,
    active: 2,
    recovery: zoner ? 20 : 18,
    damage: 8,
    hitstun: 26,
    blockstun: 15,
    reach: 0,
    top: 260,
    bottom: 50,
    push: 42,
    hitstop: 9,
    meter: 0,
    sprite: 8,
    level: 'mid',
    projectile: true,
    multiOrb: zoner ? 2 : 1,
    projectileSpeed: zoner ? 9.6 : 12.6,
    projectileRadius: zoner ? 36 : 32,
    wallBounce: !zoner,
    exMove: true
  };
}

const COMBO_STATES = new Set(['hitstun', 'knockdown', 'dizzy']);
const LOCKED_FACE = new Set(['attack', 'hitstun', 'blockstun', 'knockdown', 'getup', 'dash', 'backdash', 'dizzy']);
const UNTHROWABLE = new Set(['hitstun', 'knockdown', 'getup', 'victory', 'dizzy']);

export class Fighter {
  constructor(data, input, isCpu = false) {
    this.data = data;
    this.input = input;
    this.isCpu = isCpu;
    this.wins = 0;
    this.match = null;
    this.reset(isCpu ? 1050 : 550);
  }

  setMatch(match) {
    this.match = match;
  }

  opponent() {
    if (!this.match) return null;
    return this.isCpu ? this.match.p1 : this.match.p2;
  }

  reset(x, preserveMeter = false) {
    const carriedMeter = preserveMeter ? this.meter : 100; // Start match with 1 bar ready for fast action!
    this.x = x;
    this.y = GROUND;
    this.vx = 0;
    this.vy = 0;
    this.jumpVx = 0;
    this.walkVx = 0;
    this.walkCycle = 0;
    this.wallBounceReady = false;
    this.facing = this.isCpu ? -1 : 1;
    this.health = 100;
    this.whiteHealth = 100;
    this.meter = carriedMeter;
    this.state = 'idle';
    this.stateFrame = 0;
    this.move = null;
    this.moveFrame = 0;
    this.moveConnected = false;
    this.launchConfirmed = false;
    this.moveHit = false;
    this.moveHitsLeft = 0;
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
    this.airDashesLeft = 1;
    this.landLag = 0;
    this.launched = false;
    this.superJumping = false;
    this.wallBounced = false;
    this.otgUsed = false;
    this.trail = [];
    this.scaleX = 1;
    this.scaleY = 1;
  }

  grounded() { return this.y >= GROUND - 0.1; }

  neutral() { return this.state === 'idle' || this.state === 'walk' || this.state === 'crouch' || this.state === 'jump'; }

  gainMeter(amount) {
    this.meter = clamp(this.meter + amount, 0, MAX_METER);
  }

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

  blocking(opponent, move, facing = -this.directionTo(opponent)) {
    if (move.unblockable || this.state === 'dizzy') return false;
    if (!this.input.has(facing > 0 ? 'right' : 'left')) return false;
    if (!this.neutral() && this.state !== 'blockstun') return false;
    if (!this.grounded()) return true; // MvC Air Block!
    if (move.level === 'low') return this.input.has('down');
    if (move.level === 'overhead') return !this.input.has('down');
    return true;
  }

  parrying(opponent, facing = -this.directionTo(opponent)) {
    if (this.parryCooldown > 0 || !this.neutral()) return false;
    const away = facing > 0 ? 'right' : 'left';
    return this.input.fresh(away, PARRY_WINDOW);
  }

  canThrow() {
    const opponent = this.opponent();
    if (!opponent || !this.grounded() || !opponent.grounded()) return false;
    if (opponent.invuln > 0) return false;
    if (UNTHROWABLE.has(opponent.state)) return false;
    return Math.abs(opponent.x - this.x) <= THROW_RANGE;
  }

  beginMove(name) {
    const next = moveFor(this, name);
    const actualName = next.name;

    if (this.move) {
      const cancelList = this.move.cancel;
      const canCancel = this.moveConnected
        && this.moveFrame >= this.move.startup
        && cancelList
        && (cancelList.includes(actualName) || cancelList.includes(name));
      if (!canCancel) return false;
    } else if (this.landLag > 0) {
      return false;
    } else if (this.state === 'backdash' || (actualName === 'throw' && !this.grounded())) {
      return false;
    } else if (this.state === 'getup') {
      if (actualName !== 'special' && actualName !== 'hyper' && actualName !== 'launcher') return false;
    } else if (!this.neutral() && this.state !== 'dash') {
      return false;
    }

    if (actualName === 'hyper') {
      if (this.meter < HYPER_COST) return false;
      this.meter -= HYPER_COST;
    } else if (actualName === 'special') {
      if (this.meter < EX_COST) return false;
      this.meter -= EX_COST;
    } else {
      this.gainMeter(next.meter * METER_GAIN.commit);
    }

    this.move = next;
    this.moveFrame = 0;
    this.moveConnected = false;
    this.launchConfirmed = false;
    this.moveHit = false;
    this.moveHitsLeft = next.multiHit || 1;
    this.state = 'attack';
    this.stateFrame = 0;
    this.walkVx = 0;
    if (this.dashType === 'air') this.jumpVx = this.facing * this.data.speed;
    this.dashTimer = 0;
    this.dashType = null;

    // Squash & stretch impulse on attack startup
    this.scaleX = 1.08;
    this.scaleY = 0.93;

    if (next.invuln) this.invuln = Math.max(this.invuln, next.invuln);

    audio.sfx(
      next.superMove ? 'hyper'
        : actualName === 'throw' ? 'throw'
        : actualName === 'special' ? 'special'
        : actualName === 'launcher' ? 'launch'
        : 'whiff',
      next.damage / 9
    );

    if (next.superMove && this.match) {
      this.match.freeze = 26;
      this.match.shake = 12;
      this.match.superFlash = 26;
      this.match.hyperColor = this.data.color;
      this.match.events.push({
        type: 'announce',
        text: next.title || 'HYPER COMBO!',
        duration: 950
      });
    }

    return true;
  }

  chooseAction() {
    const { input, move } = this;
    const grounded = this.grounded();
    const down = input.has('down');

    if (move?.jumpCancel && this.launchConfirmed && (input.has('jump') || input.fresh('jump', INPUT_BUFFER))) {
      input.consume('jump');
      this.move = null;
      this.startJump(true);
      return true;
    }

    // Keep commands buffered until the first legal cancel/recovery frame.
    if (this.meter >= HYPER_COST && input.fresh('hyper', INPUT_BUFFER)) return this.tryCommand('hyper', 'hyper');
    if (this.meter >= EX_COST && input.fresh('special', INPUT_BUFFER)) {
      return this.tryCommand('special', down && this.meter >= HYPER_COST ? 'hyper' : 'special');
    }
    if (input.fresh('launcher', INPUT_BUFFER)) return this.tryCommand('launcher', grounded ? 'launcher' : 'airheavy');
    if (input.fresh('throw', INPUT_BUFFER)) return this.tryCommand('throw', 'throw');

    // Only a real chord triggers a grab. Sequential light → medium stays a combo.
    if (!move && this.canThrow() && input.has('light') && input.has('medium')
      && input.fresh('light', 3) && input.fresh('medium', 3)
      && this.beginMove('throw')) {
      input.consume('light');
      input.consume('medium');
      return true;
    }

    if (input.fresh('heavy', INPUT_BUFFER)) {
      return this.tryCommand('heavy', grounded ? (down ? 'launcher' : 'heavy') : 'airheavy');
    }

    const chain = this.moveConnected ? move?.name : null;
    if (input.fresh('medium', INPUT_BUFFER)) {
      const next = grounded
        ? down ? 'sweep' : chain === 'medium' ? 'heavy' : chain === 'heavy' ? 'launcher' : 'medium'
        : chain === 'airmedium' ? 'airheavy' : 'airmedium';
      return this.tryCommand('medium', next);
    }

    if (input.fresh('light', INPUT_BUFFER)) {
      const next = grounded
        ? chain === 'medium' ? (down ? 'launcher' : 'heavy')
          : chain === 'light' || chain === 'crouchlight' ? (down ? 'sweep' : 'medium')
            : down ? 'crouchlight' : 'light'
        : chain === 'airlight' ? 'airmedium' : chain === 'airmedium' ? 'airheavy' : 'airlight';
      return this.tryCommand('light', next);
    }

    return false;
  }

  tryCommand(action, move) {
    if (!this.beginMove(move)) return false;
    this.input.consume(action);
    return true;
  }

  startJump(superJump = false) {
    const held = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
    const opponent = this.opponent();
    const toward = opponent ? this.directionTo(opponent) : this.facing;
    this.superJumping = superJump;
    this.y = Math.min(this.y, GROUND - 1);
    this.vy = -(superJump ? this.data.superJump : this.data.jump);
    this.jumpVx = (superJump && held === 0 ? toward * 0.72 : held) * this.data.speed * (superJump ? 1.48 : 1.24);
    this.state = 'jump';
    this.stateFrame = 0;
    this.walkVx = 0;
    this.airDashesLeft = 1;
    this.scaleX = 0.86;
    this.scaleY = 1.18;
    if (superJump) {
      audio.sfx('superjump');
      if (this.match) {
        this.match.rings.push({
          x: this.x, y: GROUND - 10,
          life: 16, max: 16,
          color: this.data.color
        });
      }
    }
  }

  tryDash(opponent) {
    if (this.move || this.landLag > 0) return false;
    const grounded = this.grounded();
    if (grounded && this.input.has('down')) return false;

    const toward = this.directionTo(opponent) === 1 ? 'right' : 'left';
    const away = toward === 'right' ? 'left' : 'right';
    if (!grounded) {
      // MvC Air Dash!
      if (this.airDashesLeft <= 0 || this.y > GROUND - 95) return false;
      if (this.input.consume('dash') || this.input.consumeDash(toward)) {
        this.airDashesLeft--;
        this.state = 'dash';
        this.dashType = 'air';
        this.dashTimer = 11;
        this.vy = 0;
        this.stateFrame = 0;
        audio.sfx('dash');
        return true;
      }
      return false;
    }

    const dashMacro = this.input.consume('dash');
    if ((dashMacro && this.input.has(away)) || this.input.consumeDash(away)) {
      this.state = 'backdash';
      this.dashType = 'back';
      this.walkVx = 0;
      this.dashTimer = 13;
      this.invuln = Math.max(this.invuln, 9);
      this.stateFrame = 0;
      this.scaleX = 1.14;
      this.scaleY = 0.88;
      audio.sfx('dash');
      return true;
    }

    if (dashMacro || this.input.consumeDash(toward)) {
      this.state = 'dash';
      this.dashType = 'forward';
      this.walkVx = 0;
      this.dashTimer = 13;
      this.stateFrame = 0;
      this.scaleX = 1.16;
      this.scaleY = 0.86;
      audio.sfx('dash');
      return true;
    }
    return false;
  }

  pushTrail() {
    const activeGhost = this.state === 'dash'
      || this.state === 'backdash'
      || this.superJumping
      || (this.move && (this.move.rush || this.move.superMove || this.move.exMove));

    if (activeGhost && (this.stateFrame & 1) === 0) {
      this.trail.push({
        x: this.x,
        y: this.y,
        frame: this.spriteFrame(),
        facing: this.facing,
        color: this.data.color,
        life: 10
      });
      if (this.trail.length > 5) this.trail.shift();
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      if (--this.trail[i].life <= 0) this.trail.splice(i, 1);
    }
  }

  update(opponent) {
    this.stateFrame++;
    if (this.invuln > 0) this.invuln--;
    if (this.landLag > 0) this.landLag--;
    if (this.comboClock > 0 && COMBO_STATES.has(opponent.state)) this.comboClock--;
    else {
      this.combo = 0;
      this.comboClock = 0;
      this.comboDamage = 0;
      if (opponent) {
        opponent.wallBounced = false;
        opponent.otgUsed = false;
      }
    }
    if (this.parryCooldown > 0) this.parryCooldown--;

    // Smooth squash/stretch return to 1.0
    this.scaleX += (1 - this.scaleX) * 0.24;
    this.scaleY += (1 - this.scaleY) * 0.24;

    this.whiteHealth += (this.health - this.whiteHealth) * 0.055;
    if (!LOCKED_FACE.has(this.state)) this.facing = this.directionTo(opponent);

    this.pushTrail();

    // Mortal Kombat FINISH HIM dizzy state
    if (this.state === 'dizzy') {
      this.vx *= 0.85;
      this.x = clamp(this.x + this.vx, LEFT_WALL, RIGHT_WALL);
      return;
    }

    if (this.state === 'hitstun') {
      this.hitstun--;
      this.x += this.vx;

      // Wall Bounce check (Marvel vs. Capcom style!)
      if ((this.x <= LEFT_WALL + 4 || this.x >= RIGHT_WALL - 4) && this.wallBounceReady && Math.abs(this.vx) >= 7 && !this.wallBounced) {
        this.wallBounced = true;
        this.wallBounceReady = false;
        this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
        this.vx = -this.vx * 0.68;
        this.vy = -10.5;
        this.launched = true;
        this.hitstun = Math.max(this.hitstun, 34);
        audio.sfx('wallbounce');
        if (this.match) {
          this.match.shake = 12;
          this.match.hitStop = 8;
          this.match.rings.push({
            x: this.x, y: this.y - 160,
            life: 20, max: 20,
            color: '#ffffff'
          });
          this.match.events.push({
            type: 'callout',
            fighter: opponent,
            text: 'REBOTE NA PAREDE',
            color: '#52b7ff'
          });
        }
      }

      this.vx *= this.grounded() ? 0.84 : 0.94;
      if (!this.grounded() || this.vy) {
        this.y += this.vy;
        this.vy += this.launched ? JUGGLE_GRAVITY : GRAVITY;
        if (this.y >= GROUND) {
          this.y = GROUND;
          this.vy = 0;
          this.vx *= 0.45;
          this.superJumping = false;
          if (this.launched || this.hitstun > 2) {
            this.state = 'knockdown';
            this.stateFrame = 0;
            this.knockdown = Math.max(this.knockdown, 30);
            this.launched = false;
            this.hitstun = 0;
            this.scaleX = 1.18;
            this.scaleY = 0.82;
            if (this.match) this.match.events.push({ type: 'dust', x: this.x, y: GROUND });
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
      // MvC Advancing Guard / Pushblock! Press Dash or L+M while blocking
      const wantPushblock = this.input.consume('dash')
        || (this.input.fresh('light', 3) && this.input.fresh('medium', 3));
      if (wantPushblock && this.meter >= PUSHBLOCK_COST && this.match) {
        this.input.consume('light');
        this.input.consume('medium');
        this.meter -= PUSHBLOCK_COST;
        triggerPushblock(this.match, this, opponent);
      }

      this.x += this.vx;
      this.vx *= 0.82;
      if (!this.grounded()) {
        this.y = Math.min(GROUND, this.y + this.vy);
        this.vy = this.grounded() ? 0 : this.vy + GRAVITY;
      }
      if (--this.blockstun <= 0) {
        this.vx = 0;
        this.state = !this.grounded() ? 'jump' : this.input.has('down') ? 'crouch' : 'idle';
      }
      this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
      return;
    }

    if (this.state === 'knockdown') {
      this.x = clamp(this.x + this.vx, LEFT_WALL, RIGHT_WALL);
      this.vx *= 0.82;
      if (--this.knockdown <= 0) {
        this.state = 'getup';
        this.stateFrame = 0;
        this.invuln = 10;
        this.vx = 0;
        this.wallBounced = false;
        this.otgUsed = false;
      }
      return;
    }

    if (this.state === 'getup') {
      if (this.stateFrame >= 6) this.chooseAction();
      if (!this.move && this.stateFrame >= 12) this.state = 'idle';
      return;
    }

    if (this.state === 'victory') return;

    if (this.dashTimer > 0) {
      this.dashTimer--;
      const speed = this.dashType === 'back' ? -12.5 : this.dashType === 'air' ? 15.2 : 16.4;
      this.x += this.facing * speed * (this.data.mobility / 82);
      this.state = this.dashType === 'back' ? 'backdash' : 'dash';

      // Wave Dash (Crouch cancel during forward ground dash)
      if (this.dashType === 'forward' && this.input.has('down') && this.dashTimer <= 9) {
        this.dashTimer = 0;
        this.state = 'crouch';
      } else if (this.dashType !== 'back') {
        this.chooseAction();
      }

      if (this.dashTimer <= 0 && !this.move) {
        if (this.state !== 'crouch') this.state = this.grounded() ? 'idle' : 'jump';
        if (this.dashType === 'air') this.jumpVx = this.facing * this.data.speed * 1.1;
        this.dashType = null;
      }
    } else if (this.move) {
      this.moveFrame++;

      if (this.move.advance && this.moveFrame <= this.move.startup) {
        this.x += this.facing * this.move.advance;
      }
      if (this.move.rush && this.moveFrame >= this.move.startup && this.moveFrame <= this.move.startup + this.move.active) {
        this.x += this.facing * this.move.rush;
      }

      // Multi-hit resets (for Axl's Hyper or multi-hit specials)
      if (this.move.multiHit && this.moveHitsLeft > 0 && this.moveHit
        && (this.moveFrame - this.move.startup) % this.move.hitInterval === 0) {
        this.moveHit = false;
      }

      // Projectile / Beam spawning
      if (this.move.projectile && this.moveFrame >= this.move.startup) {
        if (this.move.barrage) {
          const offset = this.moveFrame - this.move.startup;
          if (offset % 5 === 0 && offset < this.move.barrage * 5 && this.match) {
            spawnProjectile(this.match, this, this.move, offset / 5);
          }
        } else if (!this.move.spawned && this.moveFrame === this.move.startup) {
          this.move.spawned = true;
          if (this.match) {
            const count = this.move.multiOrb || 1;
            for (let i = 0; i < count; i++) {
              spawnProjectile(this.match, this, this.move, i);
            }
          }
        }
      }

      this.chooseAction();

      if (this.move && this.moveFrame >= this.move.startup + this.move.active + this.move.recovery) {
        this.move = null;
        this.state = this.grounded() ? 'idle' : 'jump';
      }
    } else {
      if (this.tryDash(opponent)) {
        // Dash started
      } else if (this.chooseAction()) {
        this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
        return;
      } else if (this.grounded() && this.landLag <= 0 && this.input.consume('jump')) {
        const isSuper = this.input.consumeSuperJump();
        this.startJump(isSuper);
      } else if (this.grounded()) {
        const direction = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
        const crouching = this.input.has('down');
        const speed = crouching ? 0 : direction * this.data.speed * (direction === this.facing ? 1 : BACK_WALK);
        this.walkVx = crouching ? 0 : approach(this.walkVx, speed, direction ? 2.6 : 3.8);
        this.x += this.walkVx;
        this.walkCycle += Math.abs(this.walkVx) * 0.043;
        this.state = crouching ? 'crouch' : Math.abs(this.walkVx) > 0.1 ? 'walk' : 'idle';
      }
    }

    if ((!this.grounded() || this.vy) && this.dashType !== 'air') {
      if (!this.move) {
        const airSteer = (this.input.has('right') ? 1 : 0) - (this.input.has('left') ? 1 : 0);
        this.jumpVx += airSteer * 0.16;
        const maxAir = this.data.speed * (this.superJumping ? 1.55 : 1.35);
        this.jumpVx = clamp(this.jumpVx, -maxAir, maxAir);
        this.x += this.jumpVx;
      } else {
        this.x += this.jumpVx * 0.55;
      }
      this.y += this.vy;
      this.vy += GRAVITY;
      if (!this.move && this.dashTimer <= 0) this.state = 'jump';
      if (this.y >= GROUND) {
        this.y = GROUND;
        this.vy = 0;
        this.jumpVx = 0;
        this.superJumping = false;
        this.airDashesLeft = 1;
        this.landLag = LAND_LAG;
        this.scaleX = 1.12;
        this.scaleY = 0.88;
        if (this.match) this.match.events.push({ type: 'dust', x: this.x, y: GROUND });
        // Touching down ends aerial recovery and applies the landing delay.
        this.move = null;
        this.state = 'idle';
        this.stateFrame = 0;
      }
    }

    this.x = clamp(this.x, LEFT_WALL, RIGHT_WALL);
  }

  activeBox() {
    if (!this.move || this.move.projectile || this.moveHit || this.moveHitsLeft <= 0) return null;
    if (this.moveFrame < this.move.startup || this.moveFrame >= this.move.startup + this.move.active) return null;

    if (this.move.beam) {
      const near = this.x + this.facing * 40;
      const far = this.x + this.facing * 1250;
      return {
        left: Math.min(near, far),
        right: Math.max(near, far),
        top: this.y - 265,
        bottom: this.y - 75
      };
    }

    const near = this.x + this.facing * 26;
    const far = this.x + this.facing * this.move.reach;
    return {
      left: Math.min(near, far),
      right: Math.max(near, far),
      top: this.y - this.move.top,
      bottom: this.y - this.move.bottom
    };
  }

  hurtBox() {
    const crouching = this.state === 'crouch'
      || (this.state === 'blockstun' && this.grounded() && this.input.has('down'))
      || this.state === 'getup'
      || (this.move && (this.move.name === 'sweep' || this.move.level === 'low'));
    const downed = this.state === 'knockdown';
    const dashing = this.state === 'backdash';
    const width = dashing ? BODY_WIDTH * 0.72 : BODY_WIDTH;
    return {
      left: this.x - width,
      right: this.x + width,
      top: this.y - (downed ? 75 : crouching ? 195 : this.data.standingHeight),
      bottom: this.y - 4
    };
  }

  spriteFrame() {
    if (this.state === 'victory') return FRAME.victory;
    if (this.state === 'dizzy') return Math.floor(this.stateFrame / 10) % 2 ? FRAME.hit : FRAME.idleB;
    if (this.state === 'hitstun' || this.state === 'knockdown' || this.state === 'getup') return FRAME.hit;
    if (this.state === 'blockstun') return FRAME.block;
    if (this.neutral() && this.match) {
      const opponent = this.opponent();
      if (opponent?.move && this.awayHeld(opponent) && this.grounded() && !this.input.has('down')
        && Math.abs(this.x - opponent.x) < (opponent.move.reach || 190) + BODY_WIDTH) return FRAME.block;
    }
    if (this.move) {
      const { startup, active, sprite, recovery, level } = this.move;
      if (this.moveFrame < startup) return level === 'low' ? FRAME.crouch : FRAME.idleB;
      if (this.moveFrame < startup + active + Math.min(5, recovery)) return sprite;
      return level === 'low' ? FRAME.crouch : this.grounded() ? FRAME.idleA : FRAME.forward;
    }
    if (this.state === 'crouch') return FRAME.crouch;
    if (this.state === 'dash') return FRAME.forward;
    if (this.state === 'backdash') return FRAME.back;
    if (this.state === 'walk') {
      if (Math.sin(this.walkCycle) < -0.24) return FRAME.idleB;
      return this.facing * this.walkVx < 0 ? FRAME.back : FRAME.forward;
    }
    if (this.state === 'jump') return this.vy < 0 ? FRAME.forward : FRAME.kick;
    return Math.floor(this.stateFrame / 25) % 2 ? FRAME.idleB : FRAME.idleA;
  }
}
