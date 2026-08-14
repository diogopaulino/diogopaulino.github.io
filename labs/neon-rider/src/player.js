/**
 * Física simples da moto: aceleração, esterço, inclinação visual e nitro.
 * A moto avança no eixo −Z (para dentro da câmera padrão).
 */

import { BIKE, ROAD } from './config.js';
import { clamp, damp } from './utils.js';
import { createBike } from './models.js';

export class Player {
    constructor(scene, mats) {
        this.root = createBike(mats);
        scene.add(this.root);
        this.x = 0;
        this.z = 0;
        this.vx = 0;
        this.speed = 18;
        this.boost = 0;
        this.lean = 0;
        this.invuln = 0;
        this.alive = true;
        this.auto = false;
        this.maxSpeed = BIKE.maxSpeed;
        this.wheelSpin = 0;
    }

    reset({ maxSpeed }) {
        this.x = 0;
        this.z = 0;
        this.vx = 0;
        this.speed = 16;
        this.boost = 1;
        this.lean = 0;
        this.invuln = 0;
        this.alive = true;
        this.maxSpeed = maxSpeed || BIKE.maxSpeed;
        this.root.position.set(0, 0, 0);
        this.root.rotation.set(0, 0, 0);
        this.root.userData.lean.rotation.z = 0;
    }

    update(dt, input, autoSteer = 0) {
        if (!this.alive) {
            this.speed = damp(this.speed, 0, 3, dt);
            this.applyPose(dt);
            return;
        }

        const throttle = input.boost ? 1 : input.brake ? -1 : 0.35;
        const cap = this.maxSpeed + (input.boost && this.boost > 0.05 ? 22 : 0);
        const accel = throttle > 0
            ? (input.boost ? BIKE.accel * 1.45 : BIKE.accel * 0.55)
            : throttle < 0 ? -BIKE.brake : -BIKE.coast * 0.15;

        this.speed = clamp(this.speed + accel * dt, 8, cap);

        if (input.boost && this.boost > 0) {
            this.boost = Math.max(0, this.boost - dt * 0.28);
        } else {
            this.boost = Math.min(1, this.boost + dt * 0.12);
        }

        const steer = clamp(input.steer + autoSteer, -1, 1);
        const grip = BIKE.steer * (0.45 + this.speed / this.maxSpeed);
        this.vx = damp(this.vx, steer * grip, BIKE.grip, dt);
        this.x = clamp(this.x + this.vx * dt, -ROAD.halfWidth, ROAD.halfWidth);

        this.z -= this.speed * dt;
        this.invuln = Math.max(0, this.invuln - dt);

        const leanTarget = -steer * BIKE.lean * (0.35 + this.speed / this.maxSpeed);
        this.lean = damp(this.lean, leanTarget, 10, dt);
        this.wheelSpin += (this.speed / 0.38) * dt;

        this.applyPose(dt);
    }

    applyPose() {
        this.root.position.set(this.x, 0, this.z);
        this.root.userData.lean.rotation.z = this.lean;
        this.root.rotation.y = this.vx * 0.012;
        for (const w of this.root.userData.wheels) {
            w.rotation.x = this.wheelSpin;
        }
        const glow = this.root.userData.glow;
        glow.material.opacity = 0.28 + this.speed / 140 + (this.boost > 0 && this.speed > 40 ? 0.25 : 0);
        glow.scale.x = 0.9 + Math.abs(this.lean) * 1.4;
    }

    hit() {
        if (this.invuln > 0 || !this.alive) return false;
        this.invuln = 1.8;
        this.speed *= 0.45;
        this.vx *= -0.6;
        return true;
    }

    bounds() {
        return {
            x: this.x,
            z: this.z,
            w: 0.85,
            l: 2.1
        };
    }
}
