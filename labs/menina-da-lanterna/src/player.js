/**
 * Clara em terceira pessoa: movimento relativo à câmera, lanterna na mão
 * e pulso da chama.
 *
 * Fórmulas:
 *   fuel' = fuel - drain * dt   (só se capítulo.dark e longe de lampião aceso)
 *   flash: se fuel >= 14, fuel -= 14, flashT = 0.55
 *   intensidade da PointLight = 0.55 + (fuel/100)*2.6 + sin(flash)*7
 */

import * as THREE from 'three';
import { PLAYER, CAMERA } from './config.js';
import { clamp, damp } from './utils.js';
import { buildGirl } from './models.js';

export class Player {
    constructor(scene) {
        const { group, parts } = buildGirl();
        this.root = group;
        scene.add(group);
        this.parts = parts;

        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vy = 0;
        this.yaw = 0;
        this.facing = 0;
        this.grounded = true;
        this.health = 3;
        this.maxHealth = 3;
        this.invuln = 0;
        this.fuel = PLAYER.fuelMax;
        this.flashT = 0;
        this.walkPhase = 0;
        this.footTimer = 0;
        this.alive = true;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.bob = 0;
        this.nearLit = false;
    }

    spawn(x, z, yaw, heightAt) {
        this.x = x;
        this.z = z;
        this.y = heightAt(x, z);
        this.yaw = yaw;
        this.facing = yaw;
        this.camYaw = yaw + Math.PI;
        this.camPitch = CAMERA.defaultPitch;
        this.vy = 0;
        this.health = this.maxHealth;
        this.invuln = 0;
        this.alive = true;
        this.flashT = 0;
        this.fuel = PLAYER.fuelMax;
        this.root.visible = true;
        this.sync();
    }

    hurt(amount = 1) {
        if (this.invuln > 0 || !this.alive) return false;
        this.health -= amount;
        this.invuln = PLAYER.invuln;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return true;
    }

    addFuel(n) {
        this.fuel = clamp(this.fuel + n, 0, PLAYER.fuelMax);
    }

    /**
     * @returns {{footstep: boolean, flash: boolean, moving: boolean}}
     */
    update(dt, input, world, chapter) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.flashT = Math.max(0, this.flashT - dt);

        const look = input.consumeLook();
        this.camYaw -= look.x * 0.0022;
        this.camPitch = clamp(this.camPitch - look.y * 0.0020, CAMERA.pitchMin, CAMERA.pitchMax);
        this.camDist = clamp(this.camDist + input.consumeZoom() * 0.55, CAMERA.minDistance, CAMERA.maxDistance);

        const move = input.move;
        let mx = move.x;
        let mz = move.z;
        const len = Math.hypot(mx, mz);
        if (len > 1) {
            mx /= len;
            mz /= len;
        }

        const speed = move.sprint ? PLAYER.sprint : PLAYER.walk;
        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        const fx = -sin;
        const fz = -cos;
        const rx = cos;
        const rz = -sin;

        let vx = (fx * mz + rx * mx) * speed;
        let vz = (fz * mz + rz * mx) * speed;

        if (len > 0.08) {
            this.facing = Math.atan2(vx, vz);
            this.walkPhase += dt * speed * 2.8;
            this.footTimer += dt * speed;
        } else {
            this.walkPhase = damp(this.walkPhase, 0, 8, dt);
            this.footTimer = 0;
        }

        let nx = this.x + vx * dt;
        let nz = this.z + vz * dt;

        const b = world.bounds;
        nx = clamp(nx, b.minX, b.maxX);
        nz = clamp(nz, b.minZ, b.maxZ);

        if (!this._blocked(nx, this.z, world)) this.x = nx;
        if (!this._blocked(this.x, nz, world)) this.z = nz;

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

        this.nearLit = this._nearLitLamp(world);
        if (chapter?.dark && !this.nearLit) {
            this.fuel = Math.max(0, this.fuel - PLAYER.fuelDrain * dt);
        } else if (!chapter?.dark) {
            this.fuel = Math.min(PLAYER.fuelMax, this.fuel + dt * 4);
        }

        let flashed = false;
        if (input.consumeFlash() && this.flashT <= 0 && this.fuel >= PLAYER.flashCost) {
            this.fuel -= PLAYER.flashCost;
            this.flashT = PLAYER.flashTime;
            flashed = true;
        }

        this.yaw = damp(this.yaw, this.facing, PLAYER.turnSpeed, dt);
        this.bob = Math.abs(Math.sin(this.walkPhase)) * (len > 0.08 ? 0.045 : 0);

        const pulse = this.flashT > 0 ? Math.sin((1 - this.flashT / PLAYER.flashTime) * Math.PI) : 0;
        const gait = len > 0.08 ? Math.sin(this.walkPhase) : 0;
        this.parts.legs[0].rotation.x = gait * 0.65;
        this.parts.legs[1].rotation.x = -gait * 0.65;
        this.parts.arms[1].rotation.x = -gait * 0.45;
        this.parts.arms[0].rotation.x = gait * 0.2 - 0.35 - pulse * 0.4;
        this.parts.torso.rotation.y = gait * 0.07;
        this.parts.head.rotation.y = gait * 0.05;

        if (this.parts.braids) {
            for (const braid of this.parts.braids) {
                braid.rotation.x = gait * 0.12;
            }
        }

        this._updateLantern(pulse);
        this.root.visible = this.invuln <= 0 || Math.sin(this.invuln * 28) > 0;
        this.sync();

        const footstep = this.footTimer > 0.38;
        if (footstep) this.footTimer = 0;
        return { footstep, flash: flashed, moving: len > 0.08 };
    }

    _updateLantern(pulse) {
        const lantern = this.parts.lantern;
        if (!lantern) return;
        const t = this.fuel / PLAYER.fuelMax;
        const intensity = 0.45 + t * 2.55 + pulse * 7.5;
        const dist = 7 + t * 8 + pulse * 10;
        if (lantern.userData.light) {
            lantern.userData.light.intensity = intensity;
            lantern.userData.light.distance = dist;
        }
        if (lantern.userData.flame) {
            const s = 0.85 + Math.sin(performance.now() * 0.012) * 0.15 + pulse * 0.8;
            lantern.userData.flame.scale.set(s, s * 1.25, s);
            lantern.userData.flame.material.emissiveIntensity = 1.6 + t * 1.4 + pulse * 4;
        }
        if (lantern.userData.glass) {
            lantern.userData.glass.material.emissiveIntensity = 0.35 + t * 0.8 + pulse * 2;
        }
    }

    _nearLitLamp(world) {
        const r = PLAYER.lampRange;
        for (const lamp of world.lamps || []) {
            if (!lamp.lit) continue;
            if (Math.hypot(this.x - lamp.x, this.z - lamp.z) < r) return true;
        }
        return false;
    }

    _blocked(x, z, world) {
        const r = PLAYER.radius;
        for (const c of world.colliders) {
            const dx = x - c.x;
            const dz = z - c.z;
            if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) return true;
        }
        return false;
    }

    sync() {
        this.root.position.set(this.x, this.y + this.bob, this.z);
        this.root.rotation.y = this.yaw;
    }

    cameraPosition(target) {
        const dist = this.camDist;
        const cp = this.camPitch;
        const cy = this.camYaw;
        target.set(
            this.x + Math.sin(cy) * Math.cos(cp) * dist,
            this.y + CAMERA.height + Math.sin(cp) * dist,
            this.z + Math.cos(cy) * Math.cos(cp) * dist
        );
        return target;
    }

    lookAt(target) {
        target.set(this.x, this.y + CAMERA.lookY, this.z);
        return target;
    }
}
