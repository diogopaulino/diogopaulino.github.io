/**
 * Jeep de safari: aceleração, esterço, seguimento do terreno e rodas.
 */

import * as THREE from 'three';
import { JEEP } from './config.js';
import { clamp, damp, wrapPi } from './utils.js';
import { buildJeep } from './models.js';

export class Player {
    constructor(scene, world) {
        this.world = world;
        this.mesh = buildJeep();
        scene.add(this.mesh);
        this.x = 18;
        this.z = 48;
        this.y = 0;
        this.yaw = Math.PI;
        this.speed = 0;
        this.pitch = 0;
        this.roll = 0;
        this.wheelSpin = 0;
        this.reset();
    }

    reset() {
        this.x = 18;
        this.z = 48;
        this.yaw = Math.PI;
        this.speed = 0;
        this.pitch = 0;
        this.roll = 0;
        this.y = this.world.heightAt(this.x, this.z);
        this.sync();
    }

    get forward() {
        return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    }

    update(dt, input, photoMode) {
        const steer = input.move.x;
        const throttle = input.move.z;
        const cap = photoMode ? JEEP.maxSpeed * 0.28 : JEEP.maxSpeed;

        if (Math.abs(throttle) > 0.08) {
            const acc = throttle > 0 ? JEEP.accel : JEEP.brake;
            this.speed += throttle * acc * dt;
        } else {
            this.speed = damp(this.speed, 0, JEEP.friction, dt);
        }
        this.speed = clamp(this.speed, -JEEP.reverseMax, cap);

        const turnScale = clamp(Math.abs(this.speed) / 5, 0.22, 1);
        this.yaw -= steer * JEEP.turn * turnScale * Math.sign(this.speed || 1) * dt;
        this.yaw = wrapPi(this.yaw);

        const f = this.forward;
        let x = this.x + f.x * this.speed * dt;
        let z = this.z + f.z * this.speed * dt;
        const hit = this.world.collide(x, z, JEEP.radius);
        x = hit.x;
        z = hit.z;

        const y = this.world.heightAt(x, z);
        const ahead = this.world.heightAt(x + f.x * 2.2, z + f.z * 2.2);
        const right = this.world.heightAt(
            x + Math.cos(this.yaw) * 1.6,
            z - Math.sin(this.yaw) * 1.6
        );

        this.x = x;
        this.z = z;
        this.y = y;
        this.pitch = damp(this.pitch, clamp((y - ahead) * 0.18, -0.22, 0.22), 6, dt);
        this.roll = damp(this.roll, clamp((y - right) * 0.12 - steer * 0.12, -0.2, 0.2), 7, dt);
        this.wheelSpin += this.speed * dt * 1.15;
        this.sync();
    }

    sync() {
        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
        const wheels = this.mesh.userData.wheels || [];
        wheels.forEach((w) => {
            w.rotation.y = this.wheelSpin;
        });
    }
}
