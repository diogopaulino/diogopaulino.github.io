/**
 * Entidade do lutador: movimento no anel, poses ósseas e máquina de estados.
 *
 * Poses são Eulers por osso. O mixer interpola para o alvo; walk/idle
 * oscilam por cima. Golpes avançam `animT` e expõem a fase (startup/active).
 */

import * as THREE from 'three';
import { MOVES, RING_RADIUS, GRAVITY, FIGHTER_RADIUS } from './config.js';
import { clamp, damp, insideOctagon, saturate } from './utils.js';
import { createFighterModel, createShadowDecal } from './models.js';

const ZERO = [0, 0, 0];
const BONES = [
    'hips', 'torso', 'head',
    'lArm', 'lFore', 'lHand',
    'rArm', 'rFore', 'rHand',
    'lThigh', 'lShin', 'lFoot',
    'rThigh', 'rShin', 'rFoot'
];

const POSES = {
    idle: {
        torso: [0.1, 0.12, 0],
        head: [0, -0.08, 0],
        lArm: [0.35, 0.15, 0.7],
        rArm: [0.45, -0.2, -0.75],
        lFore: [-1.15, 0, 0.1],
        rFore: [-1.05, 0, -0.1],
        lThigh: [0.22, 0, 0.06],
        rThigh: [-0.28, 0, -0.06],
        lShin: [0.18, 0, 0],
        rShin: [0.42, 0, 0]
    },
    guard: {
        torso: [0.18, 0, 0],
        head: [0.1, 0, 0],
        lArm: [0.7, 0.4, 1.05],
        rArm: [0.75, -0.4, -1.05],
        lFore: [-1.55, 0.2, 0],
        rFore: [-1.5, -0.2, 0],
        lThigh: [0.35, 0, 0.1],
        rThigh: [0.2, 0, -0.1],
        lShin: [0.4, 0, 0],
        rShin: [0.5, 0, 0]
    },
    punchChamber: {
        torso: [0.05, 0.55, 0.08],
        rArm: [-0.2, 0.15, -1.25],
        rFore: [-1.7, 0, 0],
        lArm: [0.5, 0.3, 0.85],
        rThigh: [-0.35, 0, 0]
    },
    punchHit: {
        torso: [0.02, -0.45, -0.06],
        rArm: [-1.55, -0.15, -0.15],
        rFore: [-0.12, 0, 0],
        lArm: [0.4, 0.2, 0.9],
        rThigh: [-0.4, 0, 0]
    },
    kickChamber: {
        torso: [-0.15, -0.2, 0],
        rThigh: [-1.15, 0, 0],
        rShin: [1.4, 0, 0],
        rArm: [0.2, 0, -0.5],
        lArm: [0.3, 0, 0.9]
    },
    kickHit: {
        torso: [0.1, -0.25, 0],
        rThigh: [-1.55, 0.1, 0],
        rShin: [0.15, 0, 0],
        rFoot: [0.2, 0, 0],
        lArm: [-0.3, 0, 0.7]
    },
    sweepChamber: {
        torso: [0.45, 0.3, 0],
        rThigh: [-0.4, 0, 0.4],
        rShin: [0.2, 0, 0],
        lThigh: [0.5, 0, 0]
    },
    sweepHit: {
        torso: [0.55, -0.2, 0],
        rThigh: [-0.2, 0, -1.4],
        rShin: [0.1, 0, 0],
        lThigh: [0.6, 0, 0.2]
    },
    throwHold: {
        torso: [0.1, 0.4, 0],
        lArm: [-0.8, 0.6, 0.4],
        rArm: [-0.8, -0.6, -0.4],
        lFore: [-0.8, 0, 0],
        rFore: [-0.8, 0, 0]
    },
    hit: {
        torso: [-0.25, -0.45, 0.15],
        head: [-0.35, 0.2, 0],
        lArm: [-0.4, 0.5, 1.1],
        rArm: [-0.5, -0.4, -1.0]
    },
    down: {
        torso: [1.2, 0, 0],
        head: [0.4, 0, 0],
        lArm: [-0.6, 0, 1.2],
        rArm: [-0.4, 0, -1.1],
        lThigh: [0.2, 0, 0.4],
        rThigh: [0.3, 0, -0.3]
    },
    win: {
        torso: [-0.1, 0.2, 0],
        rArm: [-2.4, -0.2, -0.2],
        rFore: [-0.2, 0, 0],
        lArm: [0.3, 0, 0.6],
        head: [-0.15, 0, 0]
    }
};

function poseOf(name) {
    const extra = POSES[name] || {};
    const base = POSES.idle;
    const out = {};
    for (const b of BONES) {
        out[b] = extra[b] || base[b] || ZERO;
    }
    return out;
}

const TMP = new THREE.Vector3();
const TMP2 = new THREE.Vector3();

export class Fighter {
    constructor(def, side, scene, quality) {
        this.def = def;
        this.side = side;
        this.stats = def.stats;
        this.maxHp = def.stats.hp;
        this.hp = this.maxHp;
        this.root = createFighterModel(def, { showEdges: quality.edges });
        this.bones = this.root.userData.bones;
        this.shadow = createShadowDecal();
        scene.add(this.root, this.shadow);

        this.x = side === 1 ? -2.35 : 2.35;
        this.z = 0;
        this.y = 0;
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.facing = side === 1 ? 0 : Math.PI;
        this.state = 'idle';
        this.animT = 0;
        this.move = null;
        this.moveHit = false;
        this.stun = 0;
        this.hitstop = 0;
        this.invuln = 0;
        this.guarding = false;
        this.grounded = true;
        this.combo = 0;
        this.walkPhase = 0;
        this.poseT = 0;
        this.currentPose = poseOf('idle');
        this.targetPose = poseOf('idle');
        this.alive = true;
        this.rounds = 0;
        this.koReason = null;
        this.hipY = this.bones.hips.position.y;
        this.applyPose(this.currentPose, 1);
    }

    reset(side) {
        this.side = side;
        this.x = side === 1 ? -2.35 : 2.35;
        this.z = 0;
        this.y = 0;
        this.vx = this.vz = this.vy = 0;
        this.hp = this.maxHp;
        this.state = 'idle';
        this.animT = 0;
        this.move = null;
        this.moveHit = false;
        this.stun = 0;
        this.hitstop = 0;
        this.invuln = 0;
        this.guarding = false;
        this.grounded = true;
        this.combo = 0;
        this.alive = true;
        this.koReason = null;
        this.targetPose = poseOf('idle');
        this.syncTransform();
    }

    dispose(scene) {
        scene.remove(this.root, this.shadow);
    }

    syncTransform() {
        this.root.position.set(this.x, this.y, this.z);
        this.root.rotation.y = this.facing;
        this.shadow.position.set(this.x, 0.025, this.z);
        const air = this.y > 0.05 ? 0.55 : 1;
        this.shadow.scale.setScalar(air);
        this.shadow.material.opacity = 0.28 * air;
    }

    setPose(name) {
        this.targetPose = poseOf(name);
    }

    applyPose(pose, alpha) {
        for (const name of BONES) {
            const bone = this.bones[name];
            const e = pose[name] || ZERO;
            bone.rotation.x = lerp3(bone.rotation.x, e[0], alpha);
            bone.rotation.y = lerp3(bone.rotation.y, e[1], alpha);
            bone.rotation.z = lerp3(bone.rotation.z, e[2], alpha);
        }
    }

    faceOpponent(opp) {
        const dx = opp.x - this.x;
        const dz = opp.z - this.z;
        this.facing = Math.atan2(dx, dz);
    }

    getWorldLimb(name, target) {
        this.bones[name].getWorldPosition(target);
        return target;
    }

    hurtbox(target) {
        this.bones.torso.getWorldPosition(target);
        return target;
    }

    canAct() {
        return this.alive && this.stun <= 0 && this.hitstop <= 0
            && (this.state === 'idle' || this.state === 'walk' || this.state === 'guard');
    }

    startMove(kind) {
        const move = MOVES[kind];
        if (!move) return;
        this.state = kind;
        this.move = move;
        this.animT = 0;
        this.moveHit = false;
        this.guarding = false;
        if (kind === 'punch') this.setPose('punchChamber');
        else if (kind === 'kick') this.setPose('kickChamber');
        else if (kind === 'sweep') this.setPose('sweepChamber');
        else if (kind === 'throw') this.setPose('throwHold');
    }

    takeHit(move, dirX, dirZ, counter) {
        const power = move.damage;
        if (this.guarding && move.type !== 'throw' && move.type !== 'low') {
            this.hp = Math.max(0, this.hp - 1);
            this.vx += dirX * move.push * 0.45;
            this.vz += dirZ * move.push * 0.45;
            this.hitstop = move.hitstop * 0.5;
            return 'block';
        }
        const dmg = power * (counter ? 1.25 : 1);
        this.hp = Math.max(0, this.hp - dmg);
        this.vx += dirX * move.push;
        this.vz += dirZ * move.push;
        this.hitstop = move.hitstop;
        this.invuln = 0.05;
        this.move = null;
        if (move.knockdown || this.hp <= 0) {
            this.state = 'down';
            this.stun = 1.15;
            this.setPose('down');
            this.vy = 3.2;
            this.grounded = false;
            this.y += 0.05;
        } else {
            this.state = 'hit';
            this.stun = move.stun;
            this.setPose('hit');
        }
        if (this.hp <= 0) {
            this.alive = false;
            this.koReason = 'ko';
            this.state = 'down';
            this.setPose('down');
        }
        return 'hit';
    }

    ringOut() {
        this.alive = false;
        this.hp = 0;
        this.koReason = 'ring';
        this.state = 'down';
        this.setPose('down');
        this.vy = 2.4;
        this.grounded = false;
    }

    celebrate() {
        this.state = 'win';
        this.setPose('win');
        this.vx = this.vz = 0;
    }

    update(dt, command, opp, moveAxes) {
        if (this.hitstop > 0) {
            this.hitstop -= dt;
            this.syncTransform();
            return;
        }

        this.poseT += dt;
        this.invuln = Math.max(0, this.invuln - dt);
        if (this.stun > 0) this.stun -= dt;

        if (this.alive && this.state !== 'down' && this.state !== 'win') {
            this.faceOpponent(opp);
        }

        this.guarding = Boolean(command.guard && this.canAct());
        if (this.guarding) {
            this.state = 'guard';
            this.setPose('guard');
        } else if (this.state === 'guard') {
            this.state = 'idle';
            this.setPose('idle');
        }

        if (this.canAct() && !this.guarding) {
            if (command.throw) this.startMove('throw');
            else if (command.sweep) this.startMove('sweep');
            else if (command.kick) this.startMove('kick');
            else if (command.punch) this.startMove('punch');
            else if (command.jump && this.grounded) {
                this.vy = 8.4;
                this.grounded = false;
                this.vx += moveAxes.x * 2.2;
                this.vz += moveAxes.z * 2.2;
            }
        }

        // Cancelamento leve: soco que acertou pode virar chute.
        if (this.state === 'punch' && this.moveHit && command.kick && this.animT > 0.18) {
            this.startMove('kick');
        }

        if (this.move && (this.state === 'punch' || this.state === 'kick'
            || this.state === 'sweep' || this.state === 'throw')) {
            this.animT += dt;
            const m = this.move;
            if (this.animT < m.startup) {
                /* chamber already set */
            } else if (this.animT < m.startup + m.active) {
                if (this.state === 'punch') this.setPose('punchHit');
                else if (this.state === 'kick') this.setPose('kickHit');
                else if (this.state === 'sweep') this.setPose('sweepHit');
            } else if (this.animT >= m.duration) {
                this.move = null;
                this.state = 'idle';
                this.setPose('idle');
            }
        }

        if (this.state === 'hit' && this.stun <= 0) {
            this.state = 'idle';
            this.setPose('idle');
        }
        if (this.state === 'down' && this.stun <= 0 && this.alive && this.grounded) {
            this.state = 'idle';
            this.setPose('idle');
            this.y = 0;
        }

        const busy = this.state === 'punch' || this.state === 'kick'
            || this.state === 'sweep' || this.state === 'throw'
            || this.state === 'hit' || this.state === 'down' || this.state === 'win';

        const speed = 4.35 * this.stats.speed;
        if (!busy && this.grounded && this.alive) {
            let ix = moveAxes.x;
            let iz = moveAxes.z;
            if (command.dash) {
                ix *= 2.35;
                iz *= 2.35;
            }
            this.vx = damp(this.vx, ix * speed, 12, dt);
            this.vz = damp(this.vz, iz * speed, 12, dt);
            const moving = Math.hypot(ix, iz) > 0.15;
            if (moving && !this.guarding) {
                this.state = 'walk';
                this.walkPhase += dt * 9 * this.stats.speed;
            } else if (this.state === 'walk') {
                this.state = 'idle';
            }
        } else if (this.grounded) {
            this.vx = damp(this.vx, 0, 8, dt);
            this.vz = damp(this.vz, 0, 8, dt);
        }

        if (!this.grounded) {
            this.vy -= GRAVITY * dt;
        }

        this.x += this.vx * dt;
        this.z += this.vz * dt;
        this.y += this.vy * dt;

        const onRing = insideOctagon(this.x, this.z, RING_RADIUS + 0.02);
        if (this.y <= 0 && onRing && this.koReason !== 'ring') {
            this.y = 0;
            if (!this.grounded) {
                this.grounded = true;
                this.vy = 0;
            }
        } else if (this.y < -10) {
            this.y = -10;
            this.vy = 0;
        }

        if (this.alive && this.state !== 'down' && !onRing && this.y <= 0.25) {
            this.ringOut();
        }

        this.applyPose(this.targetPose, 1 - Math.exp(-14 * dt));
        this.animateOverlay(dt);
        this.syncTransform();
    }

    animateOverlay(dt) {
        const t = this.poseT;
        if (this.state === 'idle' || this.state === 'walk' || this.state === 'guard') {
            this.bones.hips.position.y = this.hipY + Math.sin(t * 2.4) * 0.018;
            this.bones.head.rotation.x += Math.sin(t * 1.6) * 0.01;
        }
        if (this.state === 'walk') {
            const s = Math.sin(this.walkPhase);
            this.bones.lThigh.rotation.x += s * 0.45;
            this.bones.rThigh.rotation.x -= s * 0.45;
            this.bones.lArm.rotation.x -= s * 0.25;
            this.bones.rArm.rotation.x += s * 0.25;
        }
        if (this.state === 'win') {
            this.bones.rArm.rotation.z += Math.sin(t * 6) * 0.04;
        }
    }

    isActive() {
        if (!this.move) return false;
        return this.animT >= this.move.startup
            && this.animT < this.move.startup + this.move.active
            && !this.moveHit;
    }

    distTo(other) {
        return Math.hypot(this.x - other.x, this.z - other.z);
    }
}

function lerp3(a, b, t) {
    return a + (b - a) * saturate(t);
}

export function separate(a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz) || 0.0001;
    const min = FIGHTER_RADIUS * (a.stats.bulk + b.stats.bulk) * 0.9 + 0.35;
    if (d >= min) return;
    const push = (min - d) * 0.5;
    const nx = dx / d;
    const nz = dz / d;
    a.x -= nx * push;
    a.z -= nz * push;
    b.x += nx * push;
    b.z += nz * push;
}

export { TMP, TMP2 };
