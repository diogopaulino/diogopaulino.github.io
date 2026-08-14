/**
 * IA dos Cavaleiros Negros (visão + perseguição) e dos goblins (aggro).
 */

import { clamp } from './utils.js';

export class Rider {
    constructor(group, x, z, waypoints) {
        this.group = group;
        this.x = x;
        this.z = z;
        this.yaw = 0;
        this.waypoints = waypoints;
        this.wp = 0;
        this.state = 'patrol';
        this.speed = 3.6;
        this.chaseSpeed = 7.4;
        this.vision = 16;
        this.fov = 0.62;
        this.alive = true;
        this.catchR = 1.35;
        this.alert = 0;
    }

    update(dt, player, heightAt) {
        if (!this.alive) return null;
        const dx = player.x - this.x;
        const dz = player.z - this.z;
        const dist = Math.hypot(dx, dz);
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        const facing = dist > 0.01 ? (dx * fx + dz * fz) / dist : 0;
        const seen = dist < this.vision && facing > this.fov && !this._occluded(player);

        if (seen) {
            this.state = 'chase';
            this.alert = 1;
        } else if (this.state === 'chase' && dist > this.vision * 1.6) {
            this.state = 'patrol';
        }

        let tx;
        let tz;
        if (this.state === 'chase') {
            tx = player.x;
            tz = player.z;
        } else {
            const w = this.waypoints[this.wp];
            tx = w.x;
            tz = w.z;
            if (Math.hypot(this.x - tx, this.z - tz) < 1.4) {
                this.wp = (this.wp + 1) % this.waypoints.length;
            }
        }

        const sp = this.state === 'chase' ? this.chaseSpeed : this.speed;
        const ax = tx - this.x;
        const az = tz - this.z;
        const al = Math.hypot(ax, az) || 1;
        this.x += (ax / al) * sp * dt;
        this.z += (az / al) * sp * dt;
        this.yaw = Math.atan2(ax / al, az / al);
        this.alert = Math.max(0, this.alert - dt * 0.35);

        const y = heightAt(this.x, this.z);
        this.group.position.set(this.x, y, this.z);
        this.group.rotation.y = this.yaw;
        const gait = Date.now() * 0.008;
        this.group.position.y = y + Math.abs(Math.sin(gait)) * 0.06;

        if (dist < this.catchR) return 'caught';
        if (this.state === 'chase') return 'chase';
        return null;
    }

    _occluded() {
        return false;
    }
}

export class GoblinAI {
    constructor(group, x, z) {
        this.group = group;
        this.x = x;
        this.z = z;
        this.yaw = Math.random() * Math.PI * 2;
        this.hp = 2;
        this.alive = true;
        this.speed = 3.2;
        this.aggro = 11;
        this.hitR = 1.15;
        this.cooldown = 0;
        this.wanderT = 0;
    }

    hit() {
        this.hp -= 1;
        if (this.hp <= 0) {
            this.alive = false;
            this.group.visible = false;
            return true;
        }
        return false;
    }

    update(dt, player, heightAt) {
        if (!this.alive) return null;
        this.cooldown = Math.max(0, this.cooldown - dt);
        const dx = player.x - this.x;
        const dz = player.z - this.z;
        const dist = Math.hypot(dx, dz);

        if (dist < this.aggro) {
            const sp = this.speed;
            this.x += (dx / dist) * sp * dt;
            this.z += (dz / dist) * sp * dt;
            this.yaw = Math.atan2(dx, dz);
        } else {
            this.wanderT -= dt;
            if (this.wanderT <= 0) {
                this.yaw += (Math.random() - 0.5) * 1.6;
                this.wanderT = 1.4 + Math.random();
            }
            this.x += Math.sin(this.yaw) * 1.1 * dt;
            this.z += Math.cos(this.yaw) * 1.1 * dt;
        }

        const y = heightAt(this.x, this.z);
        this.group.position.set(this.x, y, this.z);
        this.group.rotation.y = this.yaw;

        if (dist < this.hitR && this.cooldown <= 0) {
            this.cooldown = 1.15;
            return 'hit';
        }
        return null;
    }
}

export function nearestInteractable(player, list, extra = 0.2) {
    let best = null;
    let bestD = Infinity;
    for (const it of list) {
        if (it.done) continue;
        const d = Math.hypot(player.x - it.x, player.z - it.z);
        if (d < it.r + extra && d < bestD) {
            best = it;
            bestD = d;
        }
    }
    return best;
}

export function clampToBounds(x, z, bounds) {
    return {
        x: clamp(x, bounds.minX, bounds.maxX),
        z: clamp(z, bounds.minZ, bounds.maxZ)
    };
}
