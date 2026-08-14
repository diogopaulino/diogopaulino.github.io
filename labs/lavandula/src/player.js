/**
 * Viajante em terceira pessoa: movimento relativo à câmera, terreno e sentar.
 *
 * Frente da câmera no XZ: (-sin(camYaw), -cos(camYaw)).
 * Velocidade = walk (2.15) ou stride (3.35) · input.
 */

import * as THREE from 'three';
import { PLAYER, CAMERA, SPAWN } from './config.js';
import { clamp, damp } from './utils.js';
import { buildTraveler } from './models.js';

export class Player {
    constructor(scene) {
        const { group, parts } = buildTraveler();
        this.root = group;
        scene.add(group);
        this.parts = parts;

        this.x = SPAWN.x;
        this.y = 0;
        this.z = SPAWN.z;
        this.yaw = SPAWN.yaw;
        this.facing = SPAWN.yaw;
        this.walkPhase = 0;
        this.footTimer = 0;
        this.bob = 0;
        this.sitting = false;
        this.sitBlend = 0;
        this.camYaw = SPAWN.yaw + Math.PI;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.speed = 0;
    }

    spawn(heightAt) {
        this.x = SPAWN.x;
        this.z = SPAWN.z;
        this.y = heightAt(this.x, this.z);
        this.yaw = SPAWN.yaw;
        this.facing = SPAWN.yaw;
        this.camYaw = SPAWN.yaw + Math.PI;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.sitting = false;
        this.sitBlend = 0;
        this.walkPhase = 0;
        this.root.visible = true;
        this.sync();
    }

    toggleSit() {
        this.sitting = !this.sitting;
        return this.sitting;
    }

    update(dt, input, world) {
        const look = input.consumeLook();
        this.camYaw -= look.x * 0.002;
        this.camPitch = clamp(this.camPitch - look.y * 0.0018, CAMERA.pitchMin, CAMERA.pitchMax);
        this.camDist = clamp(this.camDist + input.consumeZoom() * 0.5, CAMERA.minDistance, CAMERA.maxDistance);

        if (input.consumeSit()) this.toggleSit();

        this.sitBlend = damp(this.sitBlend, this.sitting ? 1 : 0, 6, dt);

        const move = input.move;
        let mx = move.x;
        let mz = move.z;
        const len = Math.hypot(mx, mz);
        if (len > 1) {
            mx /= len;
            mz /= len;
        }

        if (this.sitting && len > 0.18) this.sitting = false;

        const moving = !this.sitting && len > 0.08;
        const speed = (move.sprint ? PLAYER.stride : PLAYER.walk);
        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        const fx = -sin;
        const fz = -cos;
        const rx = cos;
        const rz = -sin;

        let vx = 0;
        let vz = 0;
        if (moving) {
            vx = (fx * mz + rx * mx) * speed;
            vz = (fz * mz + rz * mx) * speed;
            this.facing = Math.atan2(vx, vz);
            this.walkPhase += dt * speed * 2.4;
            this.footTimer += dt * speed;
        } else {
            this.walkPhase = damp(this.walkPhase, 0, 7, dt);
            this.footTimer = 0;
        }
        this.speed = Math.hypot(vx, vz);

        let nx = this.x + vx * dt;
        let nz = this.z + vz * dt;
        const hit = world.collide(nx, nz, PLAYER.radius);
        nx = clamp(hit.x, world.bounds.minX, world.bounds.maxX);
        nz = clamp(hit.z, world.bounds.minZ, world.bounds.maxZ);
        this.x = nx;
        this.z = nz;
        this.y = world.heightAt(this.x, this.z);

        this.yaw = damp(this.yaw, this.facing, PLAYER.turnSpeed, dt);
        this.bob = moving ? Math.abs(Math.sin(this.walkPhase)) * 0.035 : 0;

        const gait = moving ? Math.sin(this.walkPhase) : 0;
        const sit = this.sitBlend;
        this.parts.legs[0].rotation.x = gait * 0.62 + sit * 1.15;
        this.parts.legs[1].rotation.x = -gait * 0.62 + sit * 1.15;
        this.parts.arms[0].rotation.x = -gait * 0.42 + sit * 0.25;
        this.parts.arms[1].rotation.x = gait * 0.42 + sit * 0.25;
        this.parts.torso.rotation.y = gait * 0.06;
        this.parts.head.rotation.y = gait * 0.05;
        this.parts.hips.position.y = -sit * PLAYER.sitLower;

        this.sync();

        const footstep = this.footTimer > 0.48;
        if (footstep) this.footTimer = 0;
        return { footstep, moving, sitting: this.sitting };
    }

    sync() {
        this.root.position.set(this.x, this.y + this.bob, this.z);
        this.root.rotation.y = this.yaw;
    }

    cameraPosition(target) {
        const dist = lerp(this.camDist, CAMERA.sitDistance, this.sitBlend);
        const cp = this.camPitch + this.sitBlend * 0.08;
        const cy = this.camYaw;
        target.set(
            this.x + Math.sin(cy) * Math.cos(cp) * dist,
            this.y + CAMERA.height + Math.sin(cp) * dist - this.sitBlend * 0.25,
            this.z + Math.cos(cy) * Math.cos(cp) * dist
        );
        return target;
    }

    lookAt(target) {
        target.set(this.x, this.y + CAMERA.lookY - this.sitBlend * 0.2, this.z);
        return target;
    }
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}
