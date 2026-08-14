/**
 * Luma voa em terceira pessoa. A câmera orbita com inércia; o movimento
 * é relativo ao yaw da câmera, como um tapete mágico.
 */

import * as THREE from 'three';
import { createLuma } from './models.js';

export class Player {
    constructor(scene, camera, canvas) {
        this.scene = scene;
        this.camera = camera;
        this.canvas = canvas;
        this.mesh = createLuma();
        this.mesh.position.set(0, 2.4, 18);
        scene.add(this.mesh);

        this.vel = new THREE.Vector3();
        this.yaw = 0;
        this.spherical = new THREE.Spherical(16, 1.32, 0.05);
        this.desired = this.spherical.clone();
        this.lookTarget = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.right = new THREE.Vector3();
        this.tmp = new THREE.Vector3();
        this.minR = 8;
        this.maxR = 34;
    }

    reset() {
        this.mesh.position.set(0, 2.4, 18);
        this.vel.set(0, 0, 0);
        this.yaw = 0;
        this.spherical.set(16, 1.32, 0.05);
        this.desired.copy(this.spherical);
        this.mesh.rotation.set(0, Math.PI, 0);
    }

    update(dt, input, look, kingdom) {
        this.desired.theta -= look.dx * 0.005;
        this.desired.phi = THREE.MathUtils.clamp(this.desired.phi + look.dy * 0.004, 0.35, 1.45);
        this.desired.radius = THREE.MathUtils.clamp(
            this.desired.radius + look.zoom * 0.012,
            this.minR,
            this.maxR
        );
        this.spherical.theta = THREE.MathUtils.damp(this.spherical.theta, this.desired.theta, 8, dt);
        this.spherical.phi = THREE.MathUtils.damp(this.spherical.phi, this.desired.phi, 8, dt);
        this.spherical.radius = THREE.MathUtils.damp(this.spherical.radius, this.desired.radius, 6, dt);

        this.camera.getWorldDirection(this.forward);
        this.forward.y = 0;
        this.forward.normalize();
        this.right.crossVectors(this.forward, new THREE.Vector3(0, 1, 0)).normalize();

        const speed = 11;
        this.vel.x += (this.right.x * input.axis.x + this.forward.x * -input.axis.z) * speed * dt * 4;
        this.vel.z += (this.right.z * input.axis.x + this.forward.z * -input.axis.z) * speed * dt * 4;
        this.vel.y += input.axis.y * 9 * dt * 4;
        this.vel.multiplyScalar(Math.pow(0.04, dt));

        this.mesh.position.addScaledVector(this.vel, dt);

        const p = this.mesh.position;
        const ground = kingdom.groundHeight(p.x, p.z) + 1.15;
        if (p.y < ground) {
            p.y = ground;
            this.vel.y = Math.max(0, this.vel.y);
        }
        p.y = THREE.MathUtils.clamp(p.y, ground, 16);
        const radial = Math.hypot(p.x, p.z);
        if (radial > 46) {
            const k = 46 / radial;
            p.x *= k;
            p.z *= k;
            this.vel.x *= 0.3;
            this.vel.z *= 0.3;
        }

        const moving = this.vel.length() > 0.4;
        if (moving) {
            const targetYaw = Math.atan2(this.vel.x, this.vel.z);
            this.yaw = THREE.MathUtils.damp(this.yaw, targetYaw, 6, dt);
        }
        this.mesh.rotation.y = this.yaw;
        this.mesh.rotation.z = THREE.MathUtils.damp(this.mesh.rotation.z, -input.axis.x * 0.28, 6, dt);
        this.mesh.rotation.x = THREE.MathUtils.damp(this.mesh.rotation.x, this.vel.y * 0.04, 6, dt);

        const t = performance.now() * 0.001;
        this.mesh.position.y += Math.sin(t * 3.2) * 0.003;
        if (this.mesh.userData.star) {
            this.mesh.userData.star.rotation.y += dt * 2.4;
        }
        if (this.mesh.userData.ribbon) {
            this.mesh.userData.ribbon.rotation.x = 0.35 + Math.sin(t * 6) * 0.18;
        }

        this.lookTarget.lerp(this.tmp.copy(p).add(new THREE.Vector3(0, 0.6, 0)), 1 - Math.pow(0.001, dt));
        this.tmp.setFromSpherical(this.spherical).add(this.lookTarget);
        this.camera.position.lerp(this.tmp, 1 - Math.pow(0.0008, dt));
        this.camera.lookAt(this.lookTarget);
    }
}
