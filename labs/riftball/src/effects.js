/**
 * Faíscas, rastros e onda de gol. Pools, sem alloc no laço quente.
 */

import * as THREE from 'three';
import { TEAMS } from './config.js';

const MATRIX = new THREE.Matrix4();
const POS = new THREE.Vector3();
const QUAT = new THREE.Quaternion();
const SCALE = new THREE.Vector3();
export class Effects {
    constructor(scene, count) {
        this.scene = scene;
        this.max = count;
        this.cursor = 0;
        this.life = new Float32Array(count);
        this.maxLife = new Float32Array(count);
        this.vel = new Float32Array(count * 3);

        const geo = new THREE.SphereGeometry(0.12, 6, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        this.mesh = new THREE.InstancedMesh(geo, mat, count);
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.tint = new THREE.Color(0xffffff);
        for (let i = 0; i < count; i++) this.mesh.setColorAt(i, this.tint);
        scene.add(this.mesh);
        this.hideAll();

        this.shock = new THREE.Mesh(
            new THREE.RingGeometry(0.4, 0.55, 32),
            new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        this.shock.rotation.x = -Math.PI / 2;
        this.shockLife = 0;
        scene.add(this.shock);

        this.trails = [makeTrail(TEAMS[0].color), makeTrail(TEAMS[1].color)];
        this.trails.forEach((t) => scene.add(t.mesh));
    }

    hideAll() {
        SCALE.set(0, 0, 0);
        for (let i = 0; i < this.max; i++) {
            this.life[i] = 0;
            MATRIX.compose(POS, QUAT, SCALE);
            this.mesh.setMatrixAt(i, MATRIX);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    burst(x, y, z, color, n = 18, speed = 8) {
        const c = new THREE.Color(color);
        for (let k = 0; k < n; k++) {
            const i = this.cursor++ % this.max;
            this.life[i] = 1;
            this.maxLife[i] = 0.35 + Math.random() * 0.45;
            this.vel[i * 3] = (Math.random() - 0.5) * speed;
            this.vel[i * 3 + 1] = Math.random() * speed;
            this.vel[i * 3 + 2] = (Math.random() - 0.5) * speed;
            POS.set(x, y, z);
            SCALE.setScalar(0.6 + Math.random() * 1.1);
            MATRIX.compose(POS, QUAT, SCALE);
            this.mesh.setMatrixAt(i, MATRIX);
            this.mesh.setColorAt(i, c);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    }

    shockwave(x, z, color) {
        this.shock.position.set(x, 0.12, z);
        this.shock.material.color.setHex(color);
        this.shock.material.opacity = 0.9;
        this.shock.scale.setScalar(1);
        this.shockLife = 1;
    }

    trail(slot, x, y, z, on) {
        this.trails[slot].push(x, y, z, on);
    }

    update(dt) {
        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) continue;
            this.life[i] -= dt / this.maxLife[i];
            this.mesh.getMatrixAt(i, MATRIX);
            MATRIX.decompose(POS, QUAT, SCALE);
            POS.x += this.vel[i * 3] * dt;
            POS.y += this.vel[i * 3 + 1] * dt;
            POS.z += this.vel[i * 3 + 2] * dt;
            this.vel[i * 3 + 1] -= 12 * dt;
            const s = Math.max(0, this.life[i]) * 1.2;
            SCALE.setScalar(s);
            MATRIX.compose(POS, QUAT, SCALE);
            this.mesh.setMatrixAt(i, MATRIX);
            if (this.life[i] <= 0) {
                SCALE.set(0, 0, 0);
                MATRIX.compose(POS, QUAT, SCALE);
                this.mesh.setMatrixAt(i, MATRIX);
            }
        }
        this.mesh.instanceMatrix.needsUpdate = true;

        if (this.shockLife > 0) {
            this.shockLife -= dt * 1.6;
            this.shock.scale.setScalar(1 + (1 - this.shockLife) * 14);
            this.shock.material.opacity = Math.max(0, this.shockLife);
        }

        this.trails.forEach((t) => t.update());
    }
}

function makeTrail(color) {
    const max = 28;
    const positions = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    const mesh = new THREE.Line(geo, mat);
    mesh.frustumCulled = false;
    const pts = [];
    return {
        mesh,
        push(x, y, z, on) {
            if (!on) {
                pts.length = 0;
                geo.setDrawRange(0, 0);
                return;
            }
            pts.push(x, y * 0.4 + 0.15, z);
            if (pts.length > max * 3) pts.splice(0, 3);
            positions.set(pts);
            geo.attributes.position.needsUpdate = true;
            geo.setDrawRange(0, pts.length / 3);
            geo.computeBoundingSphere();
        },
        update() { /* positions already written */ }
    };
}
