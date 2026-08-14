/**
 * Sombrios (fogem da chama), a Noite (cap. IV) e Pingo, a raposa.
 *
 * Sombrio: patrulha waypoints. Se a lanterna estiver fraca (< 28) ou o
 * jogador estiver de costas, aproxima. Um pulso (flashRadius) força fuga.
 */

import { clamp } from './utils.js';

export class ShadowWisp {
    constructor(group, x, z, waypoints) {
        this.group = group;
        this.x = x;
        this.z = z;
        this.yaw = 0;
        this.waypoints = waypoints;
        this.wp = 0;
        this.state = 'patrol';
        this.speed = 2.15;
        this.chaseSpeed = 4.4;
        this.fleeSpeed = 7.2;
        this.vision = 11;
        this.alive = true;
        this.catchR = 1.05;
        this.alert = 0;
        this.fleeT = 0;
        this.phase = Math.random() * Math.PI * 2;
    }

    scare(px, pz, radius) {
        const d = Math.hypot(this.x - px, this.z - pz);
        if (d < radius) {
            this.state = 'flee';
            this.fleeT = 2.2;
            this.alert = 0;
            return true;
        }
        return false;
    }

    update(dt, player, heightAt) {
        if (!this.alive) return null;
        this.phase += dt * 2.4;
        this.fleeT = Math.max(0, this.fleeT - dt);

        const dx = player.x - this.x;
        const dz = player.z - this.z;
        const dist = Math.hypot(dx, dz);
        const dim = player.fuel < 28;
        const bold = dim || player.flashT <= 0;

        if (this.fleeT > 0) this.state = 'flee';
        else if (dist < this.vision && bold) {
            this.state = 'chase';
            this.alert = Math.min(1, this.alert + dt * 0.9);
        } else if (this.state === 'chase' && dist > this.vision * 1.5) {
            this.state = 'patrol';
        }

        let tx;
        let tz;
        if (this.state === 'flee') {
            tx = this.x - dx;
            tz = this.z - dz;
        } else if (this.state === 'chase') {
            tx = player.x;
            tz = player.z;
        } else {
            const w = this.waypoints[this.wp];
            tx = w.x;
            tz = w.z;
            if (Math.hypot(this.x - tx, this.z - tz) < 1.5) {
                this.wp = (this.wp + 1) % this.waypoints.length;
            }
        }

        const sp = this.state === 'flee' ? this.fleeSpeed
            : this.state === 'chase' ? this.chaseSpeed : this.speed;
        const ax = tx - this.x;
        const az = tz - this.z;
        const al = Math.hypot(ax, az) || 1;
        this.x += (ax / al) * sp * dt;
        this.z += (az / al) * sp * dt;
        this.yaw = Math.atan2(ax / al, az / al);
        this.alert = Math.max(0, this.alert - dt * 0.22);

        const y = heightAt(this.x, this.z);
        this.group.position.set(this.x, y + Math.sin(this.phase) * 0.18, this.z);
        this.group.rotation.y = this.yaw;
        const s = 0.92 + Math.sin(this.phase * 1.6) * 0.08;
        this.group.scale.set(s, 1 + (1 - s), s);

        if (this.state !== 'flee' && dist < this.catchR) return 'caught';
        if (this.state === 'chase') return 'chase';
        return null;
    }
}

export class NightWraith {
    constructor(group, cx, cz, radius = 10) {
        this.group = group;
        this.cx = cx;
        this.cz = cz;
        this.orbit = radius;
        this.angle = 0;
        this.x = cx + radius;
        this.z = cz;
        this.alive = true;
        this.stun = 0;
        this.catchR = 1.6;
        this.alert = 0;
    }

    scare(px, pz, radius) {
        const d = Math.hypot(this.x - px, this.z - pz);
        if (d < radius * 1.15) {
            this.stun = 1.8;
            this.alert = 0;
            return true;
        }
        return false;
    }

    update(dt, player, heightAt) {
        if (!this.alive) return null;
        this.stun = Math.max(0, this.stun - dt);
        this.angle += dt * (this.stun > 0 ? 0.15 : 0.55);
        const wantX = this.cx + Math.cos(this.angle) * this.orbit;
        const wantZ = this.cz + Math.sin(this.angle) * this.orbit;
        // Se o jogador está perto das raízes, a Noite se aproxima.
        const pd = Math.hypot(player.x - this.cx, player.z - this.cz);
        const mix = pd < 14 && this.stun <= 0 ? 0.55 : 0.12;
        this.x += (wantX * (1 - mix) + player.x * mix - this.x) * dt * 1.4;
        this.z += (wantZ * (1 - mix) + player.z * mix - this.z) * dt * 1.4;
        const y = heightAt(this.x, this.z);
        this.group.position.set(this.x, y + 0.4 + Math.sin(this.angle * 3) * 0.25, this.z);
        this.group.rotation.y = this.angle;
        const dist = Math.hypot(player.x - this.x, player.z - this.z);
        this.alert = clamp(1 - dist / 10, 0, 1);
        if (this.stun <= 0 && dist < this.catchR) return 'caught';
        if (this.alert > 0.4) return 'chase';
        return null;
    }
}

export class FoxCompanion {
    constructor(group, x, z) {
        this.group = group;
        this.x = x;
        this.z = z;
        this.yaw = 0;
        this.freed = false;
        this.bob = 0;
    }

    free() {
        this.freed = true;
        this.group.visible = true;
    }

    update(dt, player, heightAt) {
        if (!this.freed) {
            const y = heightAt(this.x, this.z);
            this.group.position.set(this.x, y, this.z);
            return;
        }
        this.bob += dt * 8;
        const tx = player.x - Math.sin(player.yaw) * 1.4;
        const tz = player.z - Math.cos(player.yaw) * 1.4;
        this.x += (tx - this.x) * dt * 3.4;
        this.z += (tz - this.z) * dt * 3.4;
        const dx = tx - this.x;
        const dz = tz - this.z;
        if (Math.hypot(dx, dz) > 0.05) this.yaw = Math.atan2(dx, dz);
        const y = heightAt(this.x, this.z);
        this.group.position.set(this.x, y + Math.abs(Math.sin(this.bob)) * 0.04, this.z);
        this.group.rotation.y = this.yaw;
        if (this.group.userData.tail) {
            this.group.userData.tail.rotation.z = Math.sin(this.bob) * 0.35;
        }
    }
}

export function nearestInteractable(player, list, extra = 0.25) {
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
