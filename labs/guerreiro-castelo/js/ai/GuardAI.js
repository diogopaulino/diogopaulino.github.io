/**
 * Percepção de guarda: cone de visão, raycast em obstáculos, audição e estados.
 */

import { damp } from '../utils/math.js';

export class GuardAI {
    constructor(guard, opts = {}) {
        this.guard = guard;
        this.state = opts.sleep ? 'SLEEP' : 'IDLE';
        this.home = new BABYLON.Vector3();
        this.facing = 0;
        this.viewDist = opts.viewDist ?? 9;
        this.viewAngle = opts.viewAngle ?? 0.7;
        this.hearRadius = opts.hearRadius ?? 4.2;
        this.patrol = opts.patrol || [];
        this.patrolI = 0;
        this.timer = 0;
        this.suspicion = 0;
        this.attackCd = 0;
        this.sleep = Boolean(opts.sleep);
        this.snoreT = 0;
    }

    canSee(game) {
        const g = this.guard;
        const p = game.player.position;
        const dx = p.x - g.position.x;
        const dz = p.z - g.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > this.viewDist) return false;

        const ang = Math.atan2(dx, dz);
        let d = Math.abs(((ang - this.facing + Math.PI) % (Math.PI * 2)) - Math.PI);
        if (d > this.viewAngle) return false;

        // Raycast Babylon
        const origin = new BABYLON.Vector3(g.position.x, g.position.y + 1.4, g.position.z);
        const dir = new BABYLON.Vector3(dx, 0, dz).normalize();
        const ray = new BABYLON.Ray(origin, dir, dist);

        const obstacles = game.cameraRig?._obstacles || [];
        for (const obs of obstacles) {
            if (!obs || !obs.isEnabled?.()) continue;
            const pick = ray.intersectsMesh(obs, false);
            if (pick.hit && pick.distance < dist - 0.4) return false;
        }

        return true;
    }

    hear(game) {
        const g = this.guard;
        const p = game.player.position;
        const dist = Math.hypot(p.x - g.position.x, p.z - g.position.z);
        const noise = game.player.noise || 0;
        let hear = noise * this.hearRadius;
        if (game.player.crouching) hear *= 0.55;
        if (dist < hear) return true;

        for (const n of game.collision.noiseSources) {
            if (Math.hypot(n.x - g.position.x, n.z - g.position.z) < n.amount * 5) return true;
        }
        return false;
    }

    update(dt, game) {
        const g = this.guard;
        this.timer += dt;
        this.attackCd = Math.max(0, this.attackCd - dt);

        if (this.state === 'SLEEP') {
            g.root.rotation.x = 0.15;
            this.snoreT += dt;
            if (this.snoreT > 2.4) {
                this.snoreT = 0;
                game.audio?.play('snore');
                game.hud?.flashStealth?.('Ronc… ronc…');
            }
            if (this.hear(game) && game.player.noise > 0.9) {
                this.suspicion += dt * 0.8;
            }
            if (this.suspicion > 1.2) {
                this.state = 'SUSPICIOUS';
                this.timer = 0;
            }
            g.speed = 0;
            return;
        }

        g.root.rotation.x = damp(g.root.rotation.x, 0, 8, dt);

        const p = game.player.position;
        const dx = p.x - g.position.x;
        const dz = p.z - g.position.z;
        const dist = Math.hypot(dx, dz);

        if (this.canSee(game) || (this.hear(game) && game.player.noise > 0.7)) {
            this.state = dist < 1.8 ? 'ATTACK' : 'CHASE';
        }

        if (this.state === 'CHASE') {
            this.facing = Math.atan2(dx, dz);
            const spd = 3.4;
            g.position.x += Math.sin(this.facing) * spd * dt;
            g.position.z += Math.cos(this.facing) * spd * dt;
            g.speed = spd;
            if (dist < 1.7) this.state = 'ATTACK';
            return;
        }

        if (this.state === 'ATTACK') {
            this.facing = Math.atan2(dx, dz);
            g.speed = 0;
            if (this.attackCd <= 0 && dist < 2.1) {
                this.attackCd = 1.1;
                if (!game.player.blockT) game.player.hurt(1);
                game.audio?.play('hit');
                game.cameraRig?.addShake(0.1, 0.2);
            }
            return;
        }

        if (this.state === 'SUSPICIOUS' || this.state === 'SEARCH') {
            this.facing += dt * 0.8;
            g.speed = 0;
            if (this.timer > 3) {
                this.state = this.sleep ? 'SLEEP' : 'RETURN';
                this.suspicion = 0;
            }
            return;
        }

        if (this.state === 'RETURN' || this.state === 'IDLE' || this.state === 'PATROL') {
            if (this.patrol.length) {
                this.state = 'PATROL';
                const goal = this.patrol[this.patrolI];
                const gx = goal.x - g.position.x;
                const gz = goal.z - g.position.z;
                const gd = Math.hypot(gx, gz);
                if (gd < 0.3) this.patrolI = (this.patrolI + 1) % this.patrol.length;
                else {
                    this.facing = Math.atan2(gx, gz);
                    g.position.x += Math.sin(this.facing) * 1.6 * dt;
                    g.position.z += Math.cos(this.facing) * 1.6 * dt;
                    g.speed = 1.6;
                }
            } else {
                this.state = 'IDLE';
                g.speed = 0;
            }
        }
    }
}
