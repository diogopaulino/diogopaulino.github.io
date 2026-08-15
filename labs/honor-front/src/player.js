/**
 * Controlador do jogador em primeira pessoa para Honor Front em Babylon.js.
 */

import { PLAYER, WORLD } from './config.js';
import { clamp, damp } from './utils.js';

export class Player {
    constructor() {
        this.x = 0;
        this.y = 1.6;
        this.z = WORLD.boatStartZ || -160;
        this.vy = 0;
        this.yaw = 0;
        this.pitch = 0;
        this.health = PLAYER.maxHealth || 100;
        this.maxHealth = PLAYER.maxHealth || 100;
        this.invuln = 0;
        this.alive = true;
        this.grounded = true;
        this.bob = 0;
        this.walkPhase = 0;
        this.footTimer = 0;
        this.recoil = 0;
        this.ads = 0;
        this.onBoat = true;
        this.wet = false;
    }

    spawn(x, z, yaw, heightAt) {
        this.x = x;
        this.z = z;
        this.y = heightAt(x, z) + 1.6;
        this.yaw = yaw;
        this.pitch = 0;
        this.vy = 0;
        this.health = this.maxHealth;
        this.alive = true;
        this.invuln = 0;
        this.recoil = 0;
        this.ads = 0;
        this.onBoat = false;
        this.wet = false;
    }

    hurt(amount) {
        if (this.invuln > 0 || !this.alive) return false;
        this.health -= amount;
        this.invuln = PLAYER.invuln || 0.4;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return true;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    update(dt, input, heightAt) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.recoil = damp(this.recoil, 0, 8, dt);

        const look = input.consumeLook ? input.consumeLook() : { x: 0, y: 0 };
        const lookScale = 0.0022 * (1 - this.ads * 0.45);
        this.yaw -= look.x * lookScale;
        this.pitch = clamp(this.pitch - look.y * lookScale, -1.15, 1.15);

        const targetAds = input.adsHeld ? 1 : 0;
        this.ads = damp(this.ads, targetAds, 10, dt);

        let moving = false;
        let footstep = false;

        const move = input.move || { x: 0, z: 0, sprint: false };
        let mx = move.x;
        let mz = move.z;
        const len = Math.hypot(mx, mz);
        if (len > 1) {
            mx /= len;
            mz /= len;
        }

        const groundY = heightAt(this.x, this.z);
        this.wet = groundY < (WORLD.waterY || 0) + 0.4;
        const speedMul = this.wet ? (PLAYER.waterSlow || 0.7) : 1;
        const speed = (move.sprint && !this.ads ? (PLAYER.sprint || 7.2) : (PLAYER.walk || 4.2)) * speedMul * (1 - this.ads * 0.35);

        const lx = Math.sin(this.yaw);
        const lz = Math.cos(this.yaw);
        const rx = Math.cos(this.yaw);
        const rz = -Math.sin(this.yaw);

        const vx = (lx * mz + rx * mx) * speed;
        const vz = (lz * mz + rz * mx) * speed;

        if (len > 0.05) {
            moving = true;
            this.x += vx * dt;
            this.z += vz * dt;
            this.walkPhase += dt * (move.sprint ? 14 : 9);
            this.bob = Math.sin(this.walkPhase) * (move.sprint ? 0.08 : 0.04);
            this.footTimer -= dt;
            if (this.footTimer <= 0) {
                footstep = true;
                this.footTimer = move.sprint ? 0.32 : 0.48;
            }
        } else {
            this.bob = damp(this.bob, 0, 8, dt);
        }

        // Gravidade e chão
        const targetY = heightAt(this.x, this.z) + 1.6;
        this.y = lerp(this.y, targetY, dt * 10);

        return { footstep, moving };
    }
}

function lerp(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
}
