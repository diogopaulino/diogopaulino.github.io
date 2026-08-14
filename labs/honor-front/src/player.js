/**
 * Controlador em primeira pessoa: olhar com pointer-lock, bob, ADS e nado raso.
 */

import * as THREE from 'three';
import { PLAYER, WORLD } from './config.js';
import { clamp, damp } from './utils.js';

export class Player {
    constructor() {
        this.x = 0;
        this.y = 1.6;
        this.z = WORLD.boatStartZ;
        this.vy = 0;
        this.yaw = 0;
        this.pitch = 0;
        this.health = PLAYER.maxHealth;
        this.maxHealth = PLAYER.maxHealth;
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
        this.y = heightAt(x, z);
        this.yaw = yaw;
        this.pitch = 0;
        this.vy = 0;
        this.health = this.maxHealth;
        this.alive = true;
        this.invuln = 0;
        this.recoil = 0;
        this.ads = 0;
        this.onBoat = true;
        this.wet = false;
    }

    hurt(amount) {
        if (this.invuln > 0 || !this.alive) return false;
        this.health -= amount;
        this.invuln = PLAYER.invuln;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return true;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    /**
     * @returns {{footstep: boolean, moving: boolean}}
     */
    update(dt, input, world, locked) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.recoil = damp(this.recoil, 0, 8, dt);

        if (!locked) {
            this.wet = this.y < WORLD.waterY + 0.35;
            return { footstep: false, moving: false };
        }

        const look = input.consumeLook();
        const lookScale = 0.0022 * (1 - this.ads * 0.45);
        this.yaw -= look.x * lookScale;
        this.pitch = clamp(this.pitch - look.y * lookScale, -1.15, 1.15);

        const targetAds = input.adsHeld ? 1 : 0;
        this.ads = damp(this.ads, targetAds, 10, dt);

        let moving = false;
        let footstep = false;

        if (!this.onBoat) {
            const move = input.move;
            let mx = move.x;
            let mz = move.z;
            const len = Math.hypot(mx, mz);
            if (len > 1) {
                mx /= len;
                mz /= len;
            }

            this.wet = this.y < WORLD.waterY + 0.4;
            const speedMul = this.wet ? PLAYER.waterSlow : 1;
            const speed = (move.sprint && !this.ads ? PLAYER.sprint : PLAYER.walk) * speedMul * (1 - this.ads * 0.35);
            // A câmera Three.js olha para −Z local; yaw 0 = mar, yaw π = interior.
            const lx = -Math.sin(this.yaw);
            const lz = -Math.cos(this.yaw);
            const rx = -lz;
            const rz = lx;
            const vx = (lx * mz + rx * mx) * speed;
            const vz = (lz * mz + rz * mx) * speed;

            let nx = this.x + vx * dt;
            let nz = this.z + vz * dt;
            const b = world.bounds;
            nx = clamp(nx, b.minX, b.maxX);
            nz = clamp(nz, b.minZ, b.maxZ);

            if (!world.blocked(nx, this.z, PLAYER.radius)) this.x = nx;
            if (!world.blocked(this.x, nz, PLAYER.radius)) this.z = nz;

            if (input.consumeJump() && this.grounded) this.vy = PLAYER.jump;

            const ground = world.heightAt(this.x, this.z);
            this.vy -= PLAYER.gravity * dt;
            this.y += this.vy * dt;
            if (this.y <= ground) {
                this.y = ground;
                this.vy = 0;
                this.grounded = true;
            } else {
                this.grounded = false;
            }

            if (this.y < WORLD.waterY - 0.85 && this.z < 4) {
                this.y = WORLD.waterY - 0.85;
                this.vy = 0;
            }

            if (len > 0.08) {
                moving = true;
                this.walkPhase += dt * speed * 2.4;
                this.footTimer += dt * (move.sprint ? 1.6 : 1);
                if (this.footTimer > 0.42) {
                    this.footTimer = 0;
                    footstep = this.grounded;
                }
            } else {
                this.walkPhase = damp(this.walkPhase, 0, 8, dt);
            }
            this.bob = Math.sin(this.walkPhase) * (len > 0.08 ? 0.035 : 0);
        } else {
            this.y = Math.max(world.heightAt(this.x, this.z), WORLD.waterY) + 0.15;
            this.grounded = true;
            this.wet = true;
        }

        return { footstep, moving };
    }

    applyToCamera(camera) {
        const eye = this.y + PLAYER.eye + this.bob * 0.6 + this.recoil * 0.15;
        camera.position.set(this.x, eye, this.z);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = this.yaw;
        camera.rotation.x = this.pitch + this.recoil;
        camera.rotation.z = this.bob * 0.08;
    }

    kick(amount) {
        this.recoil += amount;
    }

    forward() {
        const cp = Math.cos(this.pitch);
        return {
            x: -Math.sin(this.yaw) * cp,
            y: Math.sin(this.pitch),
            z: -Math.cos(this.yaw) * cp
        };
    }
}
