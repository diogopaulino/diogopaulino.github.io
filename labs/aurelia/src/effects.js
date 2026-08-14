/** Fumaça de pneu, marcas de drift e partículas de terra. */

import * as THREE from 'three';
import { smokeTexture } from './textures.js';

const MATRIX = new THREE.Matrix4();
const POS = new THREE.Vector3();
const QUAT = new THREE.Quaternion();
const SCALE = new THREE.Vector3();

export class Smoke {
    constructor(scene, max = 220) {
        this.max = max;
        this.cursor = 0;
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        const geo = new THREE.PlaneGeometry(1, 1);
        const mat = new THREE.MeshBasicMaterial({
            map: smokeTexture(),
            transparent: true,
            depthWrite: false,
            opacity: 0.45,
            color: 0xdddde4
        });
        this.mesh = new THREE.InstancedMesh(geo, mat, max);
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.mesh);
        this.hideAll();
    }

    hideAll() {
        SCALE.set(0, 0, 0);
        for (let i = 0; i < this.max; i++) {
            MATRIX.compose(POS, QUAT, SCALE);
            this.mesh.setMatrixAt(i, MATRIX);
            this.life[i] = 0;
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    emit(x, y, z, amount = 1) {
        for (let n = 0; n < amount; n++) {
            const i = this.cursor++ % this.max;
            this.life[i] = 1;
            this.maxLife[i] = 0.7 + Math.random() * 0.5;
            POS.set(x + (Math.random() - 0.5) * 0.4, y + 0.12, z + (Math.random() - 0.5) * 0.4);
            SCALE.set(0.6, 0.6, 0.6);
            QUAT.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6);
            MATRIX.compose(POS, QUAT, SCALE);
            this.mesh.setMatrixAt(i, MATRIX);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    update(dt, camera) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) continue;
            this.life[i] -= dt / this.maxLife[i];
            this.mesh.getMatrixAt(i, MATRIX);
            MATRIX.decompose(POS, QUAT, SCALE);
            POS.y += dt * 0.8;
            const s = Math.max(0, this.life[i]) * 2.2;
            SCALE.set(s, s, s);
            QUAT.copy(camera.quaternion);
            MATRIX.compose(POS, QUAT, SCALE);
            this.mesh.setMatrixAt(i, MATRIX);
            if (this.life[i] <= 0) {
                SCALE.set(0, 0, 0);
                MATRIX.compose(POS, QUAT, SCALE);
                this.mesh.setMatrixAt(i, MATRIX);
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}

export class SkidMarks {
    constructor(scene, max = 280) {
        this.max = max;
        this.cursor = 0;
        const geo = new THREE.PlaneGeometry(0.28, 1.1);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x1a1a1c,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        });
        this.mesh = new THREE.InstancedMesh(geo, mat, max);
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);
        SCALE.set(0, 0, 0);
        for (let i = 0; i < max; i++) {
            MATRIX.compose(POS, QUAT, SCALE);
            this.mesh.setMatrixAt(i, MATRIX);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    stamp(x, y, z, yaw) {
        const i = this.cursor++ % this.max;
        POS.set(x, y + 0.03, z);
        QUAT.setFromEuler(new THREE.Euler(-Math.PI / 2, yaw, 0, 'YXZ'));
        SCALE.set(1, 1, 1);
        MATRIX.compose(POS, QUAT, SCALE);
        this.mesh.setMatrixAt(i, MATRIX);
        this.mesh.instanceMatrix.needsUpdate = true;
    }
}
