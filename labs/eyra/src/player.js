/**
 * Voo da ira em terceira pessoa. A câmera persegue com inércia;
 * o roll segue o banco; as asas batem com a velocidade.
 *
 * flap = sin(t * (2.1 + speed * 0.06)) * 0.42
 */

import * as THREE from 'three';
import { PHYS, CAMERA, WORLD } from './config.js';
import { clamp, damp } from './utils.js';
import { createIra } from './models.js';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.mesh = createIra();
        scene.add(this.mesh);

        this.pos = new THREE.Vector3(0, 56, 42);
        this.yaw = Math.PI;
        this.pitch = 0.08;
        this.roll = 0;
        this.speed = PHYS.cruise * 0.7;
        this.boost = 1;
        this.spin = 0;
        this.spinDir = 0;
        this.invuln = 0;
        this.forward = new THREE.Vector3(0, 0, -1);
        this.vel = new THREE.Vector3();

        this._q = new THREE.Quaternion();
        this._e = new THREE.Euler();
        this._cam = new THREE.Vector3();
        this._look = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._up = new THREE.Vector3(0, 1, 0);
        this._desiredCam = new THREE.Vector3();

        this.reset();
    }

    reset() {
        this.pos.set(0, 56, 42);
        this.yaw = Math.PI;
        this.pitch = 0.08;
        this.roll = 0;
        this.speed = PHYS.cruise * 0.55;
        this.boost = 1;
        this.spin = 0;
        this.invuln = 0;
        this.mesh.visible = true;
        this.mesh.position.copy(this.pos);
        this.syncForward();
        this.camera.position.set(this.pos.x, this.pos.y + 8, this.pos.z + 22);
        this.camera.lookAt(this.pos);
    }

    startRoll(dir) {
        if (this.spin > 0) return false;
        this.spin = PHYS.rollDuration;
        this.spinDir = dir < 0 ? -1 : 1;
        this.invuln = Math.max(this.invuln, PHYS.rollDuration * 0.8);
        return true;
    }

    hit() {
        this.invuln = PHYS.invuln;
        this.speed *= PHYS.hitSlow;
        this.boost = Math.max(0, this.boost - 0.2);
    }

    syncForward() {
        const cp = Math.cos(this.pitch);
        this.forward.set(
            Math.sin(this.yaw) * cp,
            Math.sin(this.pitch),
            Math.cos(this.yaw) * cp
        );
    }

    update(dt, input, look, world, boosting) {
        this.yaw -= look.dx * CAMERA.mouse;
        this.pitch = clamp(this.pitch - look.dy * CAMERA.mouse * 0.85, PHYS.minPitch, PHYS.maxPitch);

        const throttle = -input.axis.z;
        const bank = input.axis.x;
        const climb = input.axis.y;

        this.yaw -= bank * PHYS.yaw * (0.5 + this.speed / PHYS.maxSpeed) * dt;
        this.pitch = clamp(
            this.pitch + climb * PHYS.pitch * dt,
            PHYS.minPitch,
            PHYS.maxPitch
        );

        const cruise = PHYS.cruise * (1 + Math.max(0, throttle) * 0.9 - Math.max(0, -throttle) * 0.55);
        const target = cruise * (boosting && this.boost > 0.04 ? PHYS.boostMul : 1);
        this.speed += (target - this.speed) * (1 - Math.exp(-PHYS.drag * dt));
        this.speed = clamp(this.speed, 8, PHYS.maxSpeed);

        if (boosting && this.boost > 0) {
            this.boost = Math.max(0, this.boost - PHYS.boostCost * dt);
        } else {
            this.boost = Math.min(1, this.boost + PHYS.boostRegen * dt);
        }

        this.roll = damp(this.roll, -bank * PHYS.maxBank, 7, dt);

        if (this.spin > 0) {
            this.spin = Math.max(0, this.spin - dt);
            this.roll += this.spinDir * Math.PI * 2 * (dt / PHYS.rollDuration);
        }

        this.syncForward();
        this.pos.addScaledVector(this.forward, this.speed * dt);

        const ground = world.groundHeight(this.pos.x, this.pos.z) + 3.2;
        if (this.pos.y < ground) {
            this.pos.y = ground;
            this.pitch = Math.max(this.pitch, 0.12);
            this.speed *= 0.92;
        }
        this.pos.y = clamp(this.pos.y, WORLD.canopy + 2.5, WORLD.ceiling);

        const hit = world.collide(this.pos, PHYS.radius);
        if (hit && this.invuln <= 0) this.hit();

        this.invuln = Math.max(0, this.invuln - dt);
        this.mesh.position.copy(this.pos);

        this._e.set(this.pitch, this.yaw, this.roll, 'YXZ');
        this.mesh.quaternion.setFromEuler(this._e);

        const flap = Math.sin(performance.now() * 0.001 * (2.1 + this.speed * 0.06)) * 0.42;
        const ud = this.mesh.userData;
        if (ud.left && ud.right) {
            ud.left.rotation.z = 0.08 + flap;
            ud.right.rotation.z = -0.08 - flap;
            ud.tail.rotation.x = flap * 0.22;
            ud.head.rotation.x = this.pitch * 0.15;
        }
        if (ud.glow) {
            ud.glow.intensity = 1.1 + this.boost * 2.2 + (boosting ? 1.4 : 0);
        }
        if (this.invuln > 0) {
            this.mesh.visible = Math.sin(this.invuln * 28) > 0;
        } else {
            this.mesh.visible = true;
        }

        this.updateCamera(dt, boosting);
        this.vel.copy(this.forward).multiplyScalar(this.speed);
        return hit;
    }

    updateCamera(dt, boosting) {
        this._right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
        const back = CAMERA.dist + this.speed * 0.04;
        this._desiredCam.set(
            this.pos.x - this.forward.x * back + this._right.x * this.roll * 2.2,
            this.pos.y + CAMERA.height - this.pitch * 4,
            this.pos.z - this.forward.z * back + this._right.z * this.roll * 2.2
        );
        this.camera.position.lerp(this._desiredCam, 1 - Math.exp(-5.2 * dt));
        this._look.copy(this.pos).addScaledVector(this.forward, CAMERA.look);
        this._look.y += 1.2;
        this.camera.lookAt(this._look);

        const fovT = CAMERA.fov + (boosting ? CAMERA.fovBoost : this.speed / PHYS.maxSpeed * 8);
        this.camera.fov = damp(this.camera.fov, fovT, 4, dt);
        this.camera.updateProjectionMatrix();
    }
}
