/**
 * Torradeira sobre rodas — física arcade de kart, pulo com torrada e disparo.
 */

import * as THREE from 'three';
import { PLAYER, COMBAT, ARENA } from './config.js';
import { clamp, damp, wrapPi } from './utils.js';
import { createToaster } from './models.js';

export class Player {
    constructor(scene) {
        this.mesh = createToaster();
        scene.add(this.mesh);
        this.position = this.mesh.position;
        this.yaw = 0;
        this.speed = 0;
        this.vy = 0;
        this.grounded = true;
        this.toastPop = 0;
        this.cool = 0;
        this.invuln = 0;
        this.flash = 0;
        this.alive = true;
        this.knock = new THREE.Vector3();
        this.fwd = new THREE.Vector3(0, 0, 1);
        this.reset();
    }

    reset() {
        this.position.set(0, 0, 8);
        this.yaw = Math.PI;
        this.speed = 0;
        this.vy = 0;
        this.grounded = true;
        this.toastPop = 0;
        this.cool = 0;
        this.invuln = 0;
        this.flash = 0;
        this.alive = true;
        this.knock.set(0, 0, 0);
        this.mesh.rotation.set(0, this.yaw, 0);
        this.mesh.visible = true;
    }

    get forward() {
        this.fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        return this.fwd;
    }

    update(dt, input, world) {
        if (!this.alive) return;

        const steer = input.axisX;
        const throttle = input.axisY;

        if (Math.abs(throttle) > 0.08) {
            const acc = throttle > 0 ? PLAYER.accel : PLAYER.brake;
            this.speed += throttle * acc * dt;
        } else {
            this.speed = damp(this.speed, 0, PLAYER.friction, dt);
        }
        this.speed = clamp(this.speed, -PLAYER.reverseMax, PLAYER.maxSpeed);

        const turnScale = THREE.MathUtils.clamp(Math.abs(this.speed) / 4, 0.25, 1);
        this.yaw -= steer * PLAYER.turn * turnScale * Math.sign(this.speed || 1) * dt;
        this.yaw = wrapPi(this.yaw);

        if (this.grounded && input.consumeJump()) {
            this.vy = PLAYER.jump;
            this.grounded = false;
            this.toastPop = 1;
        }

        this.vy -= PLAYER.gravity * dt;
        let y = this.position.y + this.vy * dt;
        if (y <= 0) {
            y = 0;
            this.vy = 0;
            this.grounded = true;
        }

        const f = this.forward;
        let x = this.position.x + f.x * this.speed * dt + this.knock.x * dt;
        let z = this.position.z + f.z * this.speed * dt + this.knock.z * dt;
        this.knock.multiplyScalar(Math.exp(-5 * dt));

        const hit = world.collideSolids(x, z, PLAYER.radius);
        x = hit.x;
        z = hit.z;

        const lim = ARENA.half;
        x = clamp(x, -lim, lim);
        z = clamp(z, -lim, lim);

        this.position.set(x, y, z);
        this.mesh.rotation.y = this.yaw;
        this.mesh.rotation.z = -steer * 0.18;
        this.mesh.rotation.x = -this.speed * 0.008 + this.vy * 0.01;

        this.toastPop = Math.max(0, this.toastPop - dt * 2.4);
        const toasts = this.mesh.getObjectByName('toasts');
        if (toasts) toasts.position.y = this.toastPop * 0.55;

        const wheels = this.mesh.getObjectByName('wheels');
        if (wheels) {
            for (const w of wheels.children) w.rotation.x += this.speed * dt * 2.2;
        }
        const star = this.mesh.getObjectByName('star');
        if (star) star.rotation.y += dt * 4;

        this.cool = Math.max(0, this.cool - dt);
        this.invuln = Math.max(0, this.invuln - dt);
        this.flash += dt * 18;
        this.mesh.visible = this.invuln <= 0 || Math.sin(this.flash) > 0;
    }

    tryFire() {
        if (this.cool > 0 || !this.alive) return null;
        this.cool = COMBAT.toastCooldown;
        this.toastPop = Math.max(this.toastPop, 0.55);
        const f = this.forward;
        return {
            x: this.position.x + f.x * 1.4,
            y: this.position.y + 1.1,
            z: this.position.z + f.z * 1.4,
            vx: f.x * COMBAT.toastSpeed,
            vy: 0.4,
            vz: f.z * COMBAT.toastSpeed
        };
    }

    hurt(fromX, fromZ) {
        if (this.invuln > 0 || !this.alive) return false;
        this.invuln = COMBAT.invuln;
        const dx = this.position.x - fromX;
        const dz = this.position.z - fromZ;
        const len = Math.hypot(dx, dz) || 1;
        this.knock.set((dx / len) * COMBAT.hitKnockback, 0, (dz / len) * COMBAT.hitKnockback);
        this.speed *= 0.35;
        return true;
    }
}
