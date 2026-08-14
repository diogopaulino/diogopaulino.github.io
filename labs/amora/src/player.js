/**
 * Amora corre e pula em terceira pessoa.
 * Câmera orbita com inércia; o movimento é relativo ao yaw da câmera.
 */

import * as THREE from 'three';
import { createFox } from './models.js';
import {
    WALK_SPEED, RUN_SPEED, ACCEL, FRICTION, JUMP_VY, GRAVITY,
    COYOTE, HOP_BOOST, clampToWorld
} from './config.js';

export class Player {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.mesh = createFox();
        scene.add(this.mesh);

        this.vel = new THREE.Vector3();
        this.yaw = Math.PI;
        this.spherical = new THREE.Spherical(11.5, 1.18, 0.2);
        this.desired = this.spherical.clone();
        this.lookTarget = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.right = new THREE.Vector3();
        this.tmp = new THREE.Vector3();
        this.coyote = 0;
        this.squash = 1;
        this.grounded = true;
        this.berries = 0;
        this.minR = 6;
        this.maxR = 22;
    }

    reset() {
        this.mesh.position.set(0, 1.2, 6.5);
        this.vel.set(0, 0, 0);
        this.yaw = Math.PI;
        this.spherical.set(11.5, 1.18, 0.2);
        this.desired.copy(this.spherical);
        this.berries = 0;
        this.coyote = 0;
        this.mesh.rotation.set(0, this.yaw, 0);
    }

    get pos() {
        return this.mesh.position;
    }

    update(dt, input, look, valley) {
        this.desired.theta -= look.dx * 0.005;
        this.desired.phi = THREE.MathUtils.clamp(this.desired.phi + look.dy * 0.004, 0.42, 1.38);
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

        const cap = input.run ? RUN_SPEED : WALK_SPEED;
        const wishX = this.right.x * input.axis.x + this.forward.x * -input.axis.z;
        const wishZ = this.right.z * input.axis.x + this.forward.z * -input.axis.z;
        this.vel.x += wishX * ACCEL * dt;
        this.vel.z += wishZ * ACCEL * dt;
        this.vel.x *= Math.exp(-FRICTION * dt);
        this.vel.z *= Math.exp(-FRICTION * dt);
        const hz = Math.hypot(this.vel.x, this.vel.z);
        if (hz > cap) {
            this.vel.x *= cap / hz;
            this.vel.z *= cap / hz;
        }

        const p = this.mesh.position;
        const ground = valley.groundHeight(p.x, p.z);
        this.grounded = p.y <= ground + 0.06;
        if (this.grounded) {
            this.coyote = COYOTE;
            p.y = ground;
            if (this.vel.y < 0) this.vel.y = 0;
        } else {
            this.coyote -= dt;
            this.vel.y -= GRAVITY * dt;
        }

        p.addScaledVector(this.vel, dt);
        const clamped = clampToWorld(p.x, p.z);
        p.x = clamped.x;
        p.z = clamped.z;
        const g2 = valley.groundHeight(p.x, p.z);
        if (p.y < g2) {
            p.y = g2;
            this.vel.y = 0;
            this.grounded = true;
        }

        const moving = hz > 0.45;
        if (moving) {
            const targetYaw = Math.atan2(this.vel.x, this.vel.z);
            const delta = ((targetYaw - this.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
            this.yaw += delta * Math.min(1, dt * 8);
        }
        this.mesh.rotation.y = this.yaw;

        const t = performance.now() * 0.001;
        const parts = this.mesh.userData.parts;
        if (parts?.legs) {
            const swing = moving && this.grounded ? Math.sin(t * (input.run ? 14 : 10)) * 0.55 : 0;
            parts.legs.forEach((leg, i) => {
                leg.rotation.x = swing * (i % 2 ? 1 : -1);
            });
        }
        if (parts?.tail) {
            parts.tail.rotation.y = Math.sin(t * 5) * 0.45;
            parts.tail.rotation.x = 0.25 + Math.sin(t * 3.2) * 0.12;
        }
        if (parts?.head) {
            parts.head.rotation.x = this.grounded ? Math.sin(t * 2) * 0.04 : -0.12;
        }

        const wantSquash = this.grounded ? (moving ? 0.96 : 1) : 0.86;
        this.squash = THREE.MathUtils.damp(this.squash, wantSquash, 12, dt);
        this.mesh.scale.set(1 / Math.sqrt(this.squash), this.squash, 1 / Math.sqrt(this.squash));

        this.lookTarget.lerp(this.tmp.copy(p).add(new THREE.Vector3(0, 0.85, 0)), 1 - Math.pow(0.001, dt));
        this.tmp.setFromSpherical(this.spherical).add(this.lookTarget);
        this.camera.position.lerp(this.tmp, 1 - Math.pow(0.0008, dt));
        this.camera.lookAt(this.lookTarget);
    }

    tryJump() {
        if (this.coyote <= 0) return false;
        this.vel.y = JUMP_VY;
        const hz = Math.hypot(this.vel.x, this.vel.z);
        if (hz > 0.2) {
            this.vel.x += (this.vel.x / hz) * HOP_BOOST;
            this.vel.z += (this.vel.z / hz) * HOP_BOOST;
        }
        this.coyote = 0;
        this.grounded = false;
        this.squash = 1.22;
        return true;
    }
}
