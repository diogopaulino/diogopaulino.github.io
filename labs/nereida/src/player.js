/**
 * Nereida nada em terceira pessoa. A câmera orbita com inércia; o
 * movimento é relativo ao yaw da câmera, como um planeio na água.
 *
 *   a = input · ACCEL
 *   v ← (v + a·dt) · exp(-DRAG·dt)
 *   p ← p + v·dt
 */

import * as THREE from 'three';
import {
    ACCEL, DRAG, MAX_SPEED, VERTICAL,
    FLOOR, SURFACE, BOUND, CLEARANCE
} from './config.js';
import { createManta } from './models.js';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.mesh = createManta();
        this.mesh.position.set(0, 6.2, 18);
        scene.add(this.mesh);

        this.vel = new THREE.Vector3();
        this.yaw = Math.PI;
        this.spherical = new THREE.Spherical(11.5, 1.22, 0.12);
        this.desired = this.spherical.clone();
        this.lookTarget = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.right = new THREE.Vector3();
        this.tmp = new THREE.Vector3();
        this.minR = 6;
        this.maxR = 22;
        this.speed = 0;
    }

    reset() {
        this.mesh.position.set(0, 6.2, 18);
        this.vel.set(0, 0, 0);
        this.yaw = Math.PI;
        this.spherical.set(11.5, 1.22, 0.12);
        this.desired.copy(this.spherical);
        this.mesh.rotation.set(0, this.yaw, 0);
        this.speed = 0;
    }

    update(dt, input, look) {
        this.desired.theta -= look.dx * 0.005;
        this.desired.phi = THREE.MathUtils.clamp(this.desired.phi + look.dy * 0.004, 0.42, 1.52);
        this.desired.radius = THREE.MathUtils.clamp(
            this.desired.radius + look.zoom * 0.012,
            this.minR,
            this.maxR
        );
        this.spherical.theta = THREE.MathUtils.damp(this.spherical.theta, this.desired.theta, 7, dt);
        this.spherical.phi = THREE.MathUtils.damp(this.spherical.phi, this.desired.phi, 7, dt);
        this.spherical.radius = THREE.MathUtils.damp(this.spherical.radius, this.desired.radius, 5, dt);

        this.camera.getWorldDirection(this.forward);
        this.forward.y = 0;
        if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
        this.forward.normalize();
        this.right.crossVectors(this.forward, new THREE.Vector3(0, 1, 0)).normalize();

        this.vel.x += (this.right.x * input.axis.x + this.forward.x * -input.axis.z) * ACCEL * dt;
        this.vel.z += (this.right.z * input.axis.x + this.forward.z * -input.axis.z) * ACCEL * dt;
        this.vel.y += input.axis.y * VERTICAL * dt;
        this.vel.multiplyScalar(Math.exp(-DRAG * dt));

        const spd = this.vel.length();
        if (spd > MAX_SPEED) this.vel.multiplyScalar(MAX_SPEED / spd);
        this.speed = this.vel.length();

        this.mesh.position.addScaledVector(this.vel, dt);

        const p = this.mesh.position;
        p.y = THREE.MathUtils.clamp(p.y, FLOOR + CLEARANCE, SURFACE - CLEARANCE);
        const radial = Math.hypot(p.x, p.z);
        if (radial > BOUND) {
            const k = BOUND / radial;
            p.x *= k;
            p.z *= k;
            this.vel.x *= 0.25;
            this.vel.z *= 0.25;
        }

        if (this.speed > 0.25) {
            const targetYaw = Math.atan2(this.vel.x, this.vel.z);
            this.yaw = THREE.MathUtils.damp(this.yaw, targetYaw, 4.2, dt);
        }
        this.mesh.rotation.y = this.yaw;
        this.mesh.rotation.z = THREE.MathUtils.damp(this.mesh.rotation.z, -input.axis.x * 0.38, 5, dt);
        this.mesh.rotation.x = THREE.MathUtils.damp(this.mesh.rotation.x, this.vel.y * 0.06, 5, dt);

        const t = performance.now() * 0.001;
        const flap = Math.sin(t * (2.1 + this.speed * 0.35)) * (0.18 + this.speed * 0.04);
        this.mesh.userData.wingL.rotation.z = flap;
        this.mesh.userData.wingR.rotation.z = -flap;
        this.mesh.userData.tail.rotation.y = Math.sin(t * 3.2) * 0.12;

        this.lookTarget.lerp(this.tmp.copy(p).add(new THREE.Vector3(0, 0.35, 0)), 1 - Math.pow(0.002, dt));
        this.tmp.setFromSpherical(this.spherical).add(this.lookTarget);
        this.camera.position.lerp(this.tmp, 1 - Math.pow(0.001, dt));
        this.camera.lookAt(this.lookTarget);
    }
}
