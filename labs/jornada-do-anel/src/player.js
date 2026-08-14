/**
 * Controlador em terceira pessoa do hobbit: movimento relativo à câmera,
 * seguimento do terreno, colisão cilíndrica e animação de passada.
 */

import * as THREE from 'three';
import { PLAYER, CAMERA } from './config.js';
import { clamp, damp } from './utils.js';
import { buildHobbit, buildSword } from './models.js';

export class Player {
    constructor(scene) {
        const { group, parts } = buildHobbit();
        this.root = group;
        scene.add(group);
        this.parts = parts;

        this.sword = buildSword();
        this.sword.position.set(0.02, -0.28, 0.02);
        this.sword.rotation.z = 0.2;
        this.parts.arms[1].add(this.sword);

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
        this.hasRing = false;
        this.attackT = 0;
        this.walkPhase = 0;
        this.footTimer = 0;
        this.alive = true;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.bob = 0;
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
        this.attackT = 0;
        this.root.visible = true;
        this.sync();
    }

    setHasRing(v) {
        this.hasRing = v;
        this.parts.ring.visible = v;
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

    /**
     * @returns {{footstep: boolean, attacking: boolean}}
     */
    update(dt, input, world) {
        this.invuln = Math.max(0, this.invuln - dt);
        this.attackT = Math.max(0, this.attackT - dt);

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

        const speed = (move.sprint ? PLAYER.sprint : PLAYER.walk) * (this.hasRing ? 1.06 : 1);
        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        // Frente da câmera no XZ (do jogador para longe da câmera).
        const fx = -sin;
        const fz = -cos;
        const rx = cos;
        const rz = -sin;

        let vx = (fx * mz + rx * mx) * speed;
        let vz = (fz * mz + rz * mx) * speed;

        if (len > 0.08) {
            this.facing = Math.atan2(vx, vz);
            this.walkPhase += dt * speed * 2.6;
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

        let attacking = false;
        if (input.consumeAttack() && this.attackT <= 0) {
            this.attackT = 0.42;
            attacking = true;
        }

        this.yaw = damp(this.yaw, this.facing, PLAYER.turnSpeed, dt);
        this.bob = Math.abs(Math.sin(this.walkPhase)) * (len > 0.08 ? 0.05 : 0);

        const swing = this.attackT > 0 ? Math.sin((1 - this.attackT / 0.42) * Math.PI) : 0;
        const gait = len > 0.08 ? Math.sin(this.walkPhase) : 0;
        this.parts.legs[0].rotation.x = gait * 0.7;
        this.parts.legs[1].rotation.x = -gait * 0.7;
        this.parts.arms[0].rotation.x = -gait * 0.5;
        this.parts.arms[1].rotation.x = gait * 0.5 - swing * 1.4;
        this.parts.torso.rotation.y = gait * 0.08;
        this.parts.head.rotation.y = gait * 0.06;

        this.root.visible = this.invuln <= 0 || Math.sin(this.invuln * 28) > 0;
        this.sync();

        const footstep = this.footTimer > 0.36;
        if (footstep) this.footTimer = 0;
        return { footstep, attacking, moving: len > 0.08 };
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

    attackHit(npcs, range = 2.1) {
        const hits = [];
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        for (const n of npcs) {
            if (!n.alive) continue;
            const dx = n.x - this.x;
            const dz = n.z - this.z;
            const d = Math.hypot(dx, dz);
            if (d > range) continue;
            const dot = (dx * fx + dz * fz) / (d || 1);
            if (dot > 0.15) hits.push(n);
        }
        return hits;
    }
}
