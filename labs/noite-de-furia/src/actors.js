/**
 * Ator 2.5D — herói, inimigo ou chefe.
 *
 * Estados: idle, walk, run, jump, jattack, attack, blitz, special,
 * grab, grabbed, hurt, knockdown, getup, dead, win, intro.
 *
 * Combo no chão: 3 hits + finisher (knockdown). Janela = COMBO_WINDOW frames.
 * Agarrão: colisão frontal no chão. A = joelho; A + trás = arremesso.
 */

import {
    Z_MIN, Z_MAX, GRAVITY, HIT_DEPTH, GRAB_X, GRAB_Z,
    COMBO_WINDOW, GETUP_IFRAMES, CHARACTERS, ENEMIES, BOSSES, WEAPONS
} from './config.js';
import { clamp, sign } from './utils.js';

let nextId = 1;

export class Actor {
    constructor(opts) {
        this.id = nextId++;
        this.team = opts.team || 'foe';
        this.charId = opts.charId || opts.kind || 'ghoul';
        this.kind = opts.kind || opts.charId || 'ghoul';
        this.name = opts.name || this.kind;
        const stats = opts.stats;
        this.maxHp = stats.hp;
        this.hp = stats.hp;
        this.speed = stats.speed;
        this.runSpeed = stats.runSpeed || stats.speed * 1.7;
        this.jumpPower = stats.jump || 12;
        this.power = stats.power || 1;
        this.weight = stats.weight || 1;
        this.specialCost = stats.specialCost || 10;
        this.specialType = stats.special || 'storm';
        this.scale = stats.scale || (this.team === 'hero' ? 1 : stats.scale);
        if (!this.scale) this.scale = 1;
        this.x = opts.x || 0;
        this.y = 0;
        this.z = opts.z || 0;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.facing = opts.facing || 1;
        this.state = 'idle';
        this.stateT = 0;
        this.comboStep = 0;
        this.comboLeft = 0;
        this.invuln = 0;
        this.flash = 0;
        this.weapon = null;
        this.weaponHits = 0;
        this.grabTarget = null;
        this.grabber = null;
        this.grabHits = 0;
        this.think = 0;
        this.token = false;
        this.dead = false;
        this.scoreValue = stats.score || 0;
        this.jumper = !!stats.jumper;
        this.grabberType = !!stats.grabber;
        this.boss = !!opts.boss;
        this.animOff = Math.random() * 40;
        this.hitbox = { x: 0, z: 0, w: 0, d: 0, dmg: 0, knock: false, owner: this };
        this.hasHit = false;
        this.airAttack = false;
        this.sx = 0;
        this.sy = 0;
        this.stun = 0;
        this.introT = 0;
    }

    setState(st) {
        if (this.state === st) return;
        this.state = st;
        this.stateT = 0;
        this.hasHit = false;
        if (st !== 'attack' && st !== 'blitz') this.hitbox.w = 0;
        if (st !== 'grab') {
            if (this.grabTarget) {
                if (this.grabTarget.grabber === this) this.grabTarget.grabber = null;
                if (this.grabTarget.state === 'grabbed') this.grabTarget.setState('idle');
            }
            this.grabTarget = null;
        }
    }

    busy() {
        return ['attack', 'blitz', 'special', 'hurt', 'knockdown', 'getup', 'dead', 'grab', 'grabbed', 'jattack', 'win', 'intro'].includes(this.state);
    }

    canControl() {
        return !this.dead && ['idle', 'walk', 'run', 'jump'].includes(this.state);
    }

    grounded() {
        return this.y <= 0 && this.vy <= 0;
    }

    updatePhysics() {
        this.x += this.vx;
        this.z = clamp(this.z + this.vz, Z_MIN, Z_MAX);
        if (this.y > 0 || this.vy > 0) {
            this.vy -= GRAVITY;
            this.y += this.vy;
            if (this.y <= 0) {
                this.y = 0;
                this.vy = 0;
                if (this.state === 'jump' || this.state === 'jattack') this.setState('idle');
                this.airAttack = false;
            }
        }
        if (this.state !== 'hurt' && this.state !== 'knockdown' && this.state !== 'dead') {
            this.vx *= this.grounded() ? 0.55 : 0.96;
            this.vz *= 0.55;
        } else {
            this.vx *= 0.9;
            this.vz *= 0.9;
        }
        if (this.invuln > 0) this.invuln--;
        if (this.flash > 0) this.flash--;
        if (this.stun > 0) this.stun--;
        this.stateT++;
        if (this.comboLeft > 0) this.comboLeft--;
        else if (this.state !== 'attack') this.comboStep = 0;
    }

    faceToward(x) {
        if (Math.abs(x - this.x) > 4) this.facing = x >= this.x ? 1 : -1;
    }

    startJump() {
        if (!this.grounded() || this.busy()) return false;
        this.vy = this.jumpPower;
        this.y = 0.1;
        this.setState('jump');
        return true;
    }

    startAttack() {
        if (this.state === 'jump' && !this.airAttack) {
            this.setState('jattack');
            this.airAttack = true;
            this.armHit(1.15, 68, true);
            return 'jattack';
        }
        if (!this.grounded()) return null;
        if (this.state === 'run') {
            this.setState('blitz');
            this.armHit(1.35, 78, true);
            this.vx = this.facing * 6.2;
            return 'blitz';
        }
        if (this.state === 'attack' && this.comboLeft > 0 && this.comboStep < 4 && this.hasHit) {
            this.comboStep++;
            this.stateT = 0;
            this.hasHit = false;
            const finisher = this.comboStep >= 3;
            this.armHit(finisher ? 1.55 : 1 + this.comboStep * 0.12, finisher ? 76 : 64, finisher);
            this.comboLeft = COMBO_WINDOW;
            this.vx += this.facing * 1.6;
            return 'combo';
        }
        if (this.canControl() || (this.state === 'attack' && this.comboLeft > 0 && this.comboStep < 4)) {
            this.comboStep = this.state === 'attack' ? this.comboStep + 1 : 0;
            this.setState('attack');
            this.comboLeft = COMBO_WINDOW + 8;
            const finisher = this.comboStep >= 3;
            this.armHit(finisher ? 1.5 : 0.95, finisher ? 74 : 62, finisher);
            this.vx += this.facing * 2.1;
            return 'attack';
        }
        return null;
    }

    armHit(mult, reach, knock) {
        const extra = this.weapon ? WEAPONS[this.weapon].reach - 44 : 0;
        const wmul = this.weapon ? WEAPONS[this.weapon].damage : 1;
        this.hitbox = {
            x: this.x + this.facing * (28 + extra * 0.3),
            z: this.z,
            w: reach + extra,
            d: HIT_DEPTH,
            dmg: 8 * this.power * mult * wmul,
            knock,
            owner: this,
            from: this.x
        };
        this.hasHit = false;
        if (this.weapon) {
            this.weaponHits--;
            if (this.weaponHits <= 0) this.weapon = null;
        }
    }

    startSpecial() {
        const cost = this.state === 'hurt' ? this.specialCost + 4 : this.specialCost;
        if (this.hp <= cost + 4) return false;
        if (!(this.canControl() || this.state === 'hurt' || this.state === 'jump' || this.state === 'grabbed')) return false;
        this.hp -= cost;
        this.setState('special');
        this.invuln = 28;
        this.armHit(2.4, this.specialType === 'chain' ? 210 : 90, true);
        return true;
    }

    startGrab(target) {
        this.setState('grab');
        this.grabTarget = target;
        this.grabHits = 0;
        target.setState('grabbed');
        target.grabber = this;
        target.facing = -this.facing;
        target.x = this.x + this.facing * 30;
        target.z = this.z;
        target.vx = 0;
    }

    throwTarget(dir) {
        const t = this.grabTarget;
        if (!t) return;
        const d = dir || this.facing;
        t.grabber = null;
        t.vx = d * 9.5 / t.weight;
        t.vy = 7.5;
        t.y = 1;
        t.takeHit(16 * this.power, true, d, true);
        this.grabTarget = null;
        this.setState('idle');
        this.invuln = 8;
    }

    takeHit(dmg, knock, fromDir, thrown = false) {
        if (this.dead || this.invuln > 0) return false;
        if (this.state === 'special' && this.stateT < 20) return false;
        if (this.state === 'grab') this.setState('idle');
        this.hp -= dmg;
        this.flash = 6;
        this.vx = fromDir * (knock ? 6.2 : 3.2) / this.weight;
        this.facing = -fromDir || this.facing;
        if (this.hp <= 0) {
            this.hp = 0;
            this.dead = true;
            this.vy = 8;
            this.y = Math.max(this.y, 1);
            this.setState('knockdown');
            this.invuln = 80;
            return true;
        }
        if (knock || thrown) {
            this.vy = thrown ? 8 : 6.2;
            this.y = Math.max(this.y, 1);
            this.setState('knockdown');
            this.invuln = 12;
        } else {
            this.setState('hurt');
        }
        return true;
    }

    tickHero(input, world) {
        if (this.dead) {
            if (this.state === 'knockdown' && this.grounded() && this.stateT > 30) this.setState('dead');
            this.updatePhysics();
            return;
        }
        if (this.stun > 0) {
            this.updatePhysics();
            return;
        }

        if (this.state === 'hurt' && this.stateT > 14) this.setState('idle');
        if (this.state === 'knockdown') {
            if (this.grounded() && this.stateT > 28) {
                this.setState('getup');
                this.invuln = GETUP_IFRAMES;
            }
            this.updatePhysics();
            return;
        }
        if (this.state === 'getup' && this.stateT > 16) this.setState('idle');
        if (this.state === 'attack' && this.stateT > (this.comboStep >= 3 ? 22 : 14)) this.setState('idle');
        if (this.state === 'blitz' && this.stateT > 18) this.setState('idle');
        if (this.state === 'special' && this.stateT > 32) this.setState('idle');
        if (this.state === 'grab') {
            if (this.grabTarget && !this.grabTarget.dead) {
                this.grabTarget.x = this.x + this.facing * 30;
                this.grabTarget.z = this.z;
                if (input.consume('attack')) {
                    const back = (input.has('left') && this.facing === 1) || (input.has('right') && this.facing === -1);
                    if (back || this.grabHits >= 3) {
                        this.throwTarget(back ? -this.facing : this.facing);
                        world.onThrow?.(this);
                    } else {
                        this.grabHits++;
                        this.stateT = 0;
                        this.grabTarget.takeHit(7 * this.power, false, this.facing);
                        world.onHit?.(this, this.grabTarget, false);
                    }
                }
            } else this.setState('idle');
            this.updatePhysics();
            return;
        }

        if (this.canControl() || this.state === 'jump') {
            const ax = input.axes.x;
            const az = input.axes.z;
            const running = input.runDir !== 0 && Math.sign(ax || input.runDir) === input.runDir && this.grounded();
            const spd = running ? this.runSpeed : this.speed;
            if (this.grounded()) {
                this.vx = ax * spd;
                this.vz = az * spd * 0.72;
                if (ax) this.facing = sign(ax);
                if (running && ax) this.setState('run');
                else if (ax || az) this.setState('walk');
                else if (this.state === 'walk' || this.state === 'run') this.setState('idle');
                if (running && !ax) input.runDir = 0;

                const prey = tryGrab(this, world.foes?.filter((f) => !f.dead) || []);
                if (prey && (this.state === 'walk' || this.state === 'run')) {
                    this.startGrab(prey);
                }
            } else {
                this.vx += ax * 0.18;
                this.vz += az * 0.12;
                this.vx = clamp(this.vx, -this.runSpeed, this.runSpeed);
            }
        }

        this.updatePhysics();
        const maxX = Math.max(world.camX + 80, Math.min(world.lockX - 36, world.camX + 1200, world.stageLength - 40));
        this.x = clamp(this.x, Math.max(40, world.camX + 36), maxX);
    }

    tickFoe(hero, world) {
        if (this.dead) {
            if (this.state === 'knockdown' && this.grounded() && this.stateT > 36) this.setState('dead');
            this.updatePhysics();
            return;
        }
        if (this.stun > 0) {
            this.updatePhysics();
            return;
        }
        if (this.state === 'hurt' && this.stateT > 12) this.setState('idle');
        if (this.state === 'knockdown') {
            if (this.grounded() && this.stateT > 34) {
                this.setState('getup');
                this.invuln = GETUP_IFRAMES;
            }
            this.updatePhysics();
            return;
        }
        if (this.state === 'getup' && this.stateT > 18) this.setState('idle');
        if (this.state === 'attack' && this.stateT > 20) {
            this.setState('idle');
            this.think = 18 + (Math.random() * 24);
            this.releaseToken(world);
        }
        if (this.state === 'blitz' && this.stateT > 16) this.setState('idle');
        if (this.state === 'special' && this.stateT > 36) {
            this.setState('idle');
            this.releaseToken(world);
        }
        if (this.state === 'jump' && this.grounded() && this.stateT > 4) this.setState('idle');
        if (this.state === 'jattack' && this.grounded()) this.setState('idle');
        if (this.state === 'grab') {
            if (this.grabTarget && !this.grabTarget.dead) {
                this.grabTarget.x = this.x + this.facing * 28;
                if (this.stateT > 18) {
                    this.throwTarget(this.facing);
                    world.onThrow?.(this);
                    this.releaseToken(world);
                }
            } else this.setState('idle');
            this.updatePhysics();
            return;
        }

        this.think--;
        this.faceToward(hero.x);

        if (this.canControl() && this.think <= 0) {
            const dx = hero.x - this.x;
            const dz = hero.z - this.z;
            const near = Math.abs(dx) < 70 && Math.abs(dz) < HIT_DEPTH;
            const wantAttack = near && world.canAttack(this);

            if (this.boss && Math.random() < 0.12 && world.canAttack(this)) {
                this.setState('special');
                this.invuln = 18;
                this.armHit(1.8, this.kind === 'witch' ? 40 : 80, true);
                this.think = 40;
                if (this.kind === 'witch' || this.kind === 'baron' || this.kind === 'mummy') {
                    world.spawnBossShot?.(this);
                }
            } else if (wantAttack && this.grabberType && Math.abs(dx) < GRAB_X && Math.abs(dz) < GRAB_Z && hero.grounded() && !hero.busy()) {
                this.startGrab(hero);
                this.think = 40;
            } else if (wantAttack) {
                this.setState('attack');
                this.armHit(1, 58, Math.random() < 0.35);
                this.vx = this.facing * 2;
                this.think = 30;
            } else if (this.jumper && Math.abs(dx) < 160 && Math.random() < 0.08) {
                this.vy = 11;
                this.y = 0.1;
                this.setState('jump');
                this.vx = sign(dx) * 3.2;
            } else {
                const side = Math.abs(dx) < 90 ? (this.id % 2 ? 1 : -1) * 0.6 : 0;
                this.vx = sign(dx + side * 40) * this.speed;
                this.vz = Math.abs(dz) > 8 ? sign(dz) * this.speed * 0.65 : 0;
                if (Math.abs(dx) < 50 && !wantAttack) this.vx = -sign(dx) * this.speed * 0.4;
                this.setState('walk');
                this.think = 8 + (this.id % 7);
            }
        }

        this.updatePhysics();
        if (world?.camX != null) {
            this.x = clamp(this.x, world.camX - 120, world.camX + 1400);
        }
    }

    releaseToken(world) {
        if (this.token) {
            this.token = false;
            world.attackers = Math.max(0, world.attackers - 1);
        }
    }
}

export function makeHero(charId, x, z) {
    const c = CHARACTERS[charId];
    return new Actor({
        team: 'hero',
        charId: c.id,
        kind: c.id,
        name: c.name,
        stats: { ...c, scale: c.id === 'frank' ? 1.12 : c.id === 'lupa' ? 0.96 : 1 },
        x, z, facing: 1
    });
}

export function makeFoe(type, x, z, facing = -1) {
    const boss = BOSSES[type];
    const spec = boss || ENEMIES[type];
    return new Actor({
        team: 'foe',
        charId: spec.kind,
        kind: spec.kind,
        name: spec.name,
        stats: spec,
        x, z, facing,
        boss: !!boss
    });
}

export function tryGrab(hero, foes) {
    if (!hero.grounded() || !(hero.state === 'walk' || hero.state === 'run' || hero.state === 'idle')) return null;
    for (const e of foes) {
        if (e.dead || !e.grounded()) continue;
        if (e.state === 'knockdown' || e.state === 'hurt' || e.state === 'grabbed') continue;
        const dx = e.x - hero.x;
        if (sign(dx) !== hero.facing && Math.abs(dx) > 6) continue;
        if (Math.abs(dx) < GRAB_X && Math.abs(e.z - hero.z) < GRAB_Z) return e;
    }
    return null;
}

export function hitTest(box, victim) {
    if (!box.w || victim.dead || victim.invuln > 0) return false;
    if (victim.state === 'knockdown' || victim.state === 'getup' || victim.state === 'dead') return false;
    if (Math.abs(victim.z - box.z) > box.d) return false;
    const left = box.from + (box.owner.facing > 0 ? 8 : -box.w);
    const right = box.from + (box.owner.facing > 0 ? box.w : -8);
    const body = 26 * (victim.scale || 1);
    return victim.x + body > Math.min(left, right) && victim.x - body < Math.max(left, right);
}
