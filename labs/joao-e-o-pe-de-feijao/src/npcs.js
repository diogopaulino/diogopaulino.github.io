/**
 * Mimosa (segue o João), gigante (dorme / fareja / persegue) e utilitário de interação.
 */

import { clamp, damp } from './utils.js';

export class CowAI {
    constructor(group, x, z) {
        this.group = group;
        this.x = x;
        this.z = z;
        this.yaw = 0;
        this.follow = false;
        this.parked = false;
        this.phase = 0;
    }

    update(dt, player, heightAt) {
        if (this.parked) {
            this.group.position.set(this.x, heightAt(this.x, this.z), this.z);
            this.group.rotation.y = this.yaw;
            return;
        }
        const tx = this.follow ? player.x : this.x;
        const tz = this.follow ? player.z : this.z;
        const dx = tx - this.x;
        const dz = tz - this.z;
        const dist = Math.hypot(dx, dz);
        const hold = 1.85;
        if (this.follow && dist > hold) {
            const sp = dist > 6 ? 6.2 : 3.4;
            this.x += (dx / dist) * sp * dt;
            this.z += (dz / dist) * sp * dt;
            this.yaw = Math.atan2(dx, dz);
            this.phase += dt * 8;
        } else {
            this.phase = damp(this.phase, 0, 6, dt);
        }
        const y = heightAt(this.x, this.z);
        this.group.position.set(this.x, y + Math.abs(Math.sin(this.phase)) * 0.04, this.z);
        this.group.rotation.y = this.yaw;
    }
}

export class GiantAI {
    constructor(group, parts, x, z, y = 0) {
        this.group = group;
        this.parts = parts;
        this.x = x;
        this.z = z;
        this.y = y;
        this.yaw = Math.PI;
        this.state = 'sleep';
        this.alert = 0;
        this.speed = 4.6;
        this.chaseSpeed = 7.8;
        this.catchR = 2.6;
        this.hearR = 14;
        this.phase = 0;
        this.alive = true;
        this.fallVy = 0;
        this.falling = false;
    }

    /**
     * @returns {'sleep'|'stir'|'chase'|'caught'|null}
     */
    update(dt, player, heightAt) {
        if (!this.alive) return null;
        if (this.falling) {
            this.fallVy -= 28 * dt;
            this.y += this.fallVy * dt;
            this.group.position.set(this.x, this.y, this.z);
            this.group.rotation.z += dt * 1.4;
            if (this.y < -8) this.alive = false;
            return 'falling';
        }

        this.phase += dt;
        const dx = player.x - this.x;
        const dz = player.z - this.z;
        const dist = Math.hypot(dx, dz);
        const dy = Math.abs((player.y || 0) - this.y);

        if (this.state === 'sleep') {
            this.alert = Math.max(0, this.alert - dt * 0.12);
            const near = dist < this.hearR && dy < 4;
            if (near) {
                this.alert += dt * (player.sprinting ? 0.55 : 0.12);
                if (dist < 3.2) this.alert += dt * 0.4;
            }
            if (this.alert >= 1) {
                this.state = 'chase';
                this.alert = 1;
                return 'stir';
            }
            if (this.parts?.belly) {
                const s = 1 + Math.sin(this.phase * 1.4) * 0.04;
                this.parts.belly.scale.set(1.05 * s, 0.85, 0.8);
            }
            if (this.parts?.head) this.parts.head.rotation.x = Math.sin(this.phase * 1.4) * 0.08;
        } else if (this.state === 'chase') {
            this.alert = 1;
            const sp = this.chaseSpeed;
            if (dist > 0.2) {
                this.x += (dx / dist) * sp * dt;
                this.z += (dz / dist) * sp * dt;
                this.yaw = Math.atan2(dx, dz);
            }
            const gait = this.phase * 6;
            if (this.parts?.legs) {
                this.parts.legs[0].rotation.x = Math.sin(gait) * 0.45;
                this.parts.legs[1].rotation.x = -Math.sin(gait) * 0.45;
            }
            if (dist < this.catchR && dy < 3.2) return 'caught';
        }

        const gy = heightAt ? heightAt(this.x, this.z) : this.y;
        this.y = gy;
        this.group.position.set(this.x, this.y, this.z);
        this.group.rotation.y = this.yaw;
        return this.state;
    }

    /** Perseguição vertical no pé de feijão (capítulo V). */
    chaseDown(dt, player, stalkX, stalkZ) {
        if (!this.alive || this.falling) return this.update(dt, player, () => this.y);
        this.state = 'chase';
        this.alert = 1;
        this.phase += dt;
        const targetY = player.y + 3.4;
        this.y = damp(this.y, targetY, 1.1, dt);
        const ang = Math.atan2(player.x - stalkX, player.z - stalkZ);
        this.x = stalkX + Math.sin(ang) * 2.4;
        this.z = stalkZ + Math.cos(ang) * 2.4;
        this.yaw = Math.atan2(player.x - this.x, player.z - this.z);
        this.group.position.set(this.x, this.y, this.z);
        this.group.rotation.y = this.yaw;
        const dist = Math.hypot(player.x - this.x, player.z - this.z);
        const dy = Math.abs(player.y - this.y);
        if (dist < 2.8 && dy < 3.4) return 'caught';
        return 'chase';
    }

    wake() {
        this.state = 'chase';
        this.alert = 1;
    }

    drop() {
        this.falling = true;
        this.fallVy = 2;
        this.state = 'falling';
    }
}

export function nearestInteractable(player, list, extra = 0.25) {
    let best = null;
    let bestD = Infinity;
    for (const it of list) {
        if (it.done) continue;
        const dy = it.y != null ? Math.abs(player.y - it.y) : 0;
        if (it.y != null && dy > (it.yReach ?? 2.4)) continue;
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
