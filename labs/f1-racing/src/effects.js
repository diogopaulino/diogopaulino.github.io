/**
 * Particle and decal effects: tyre smoke, sparks, spray, rain and skid trails.
 *
 * Per-instance opacity is not something the built-in materials expose, so the
 * particle material is written in TSL and reads instanced attributes directly —
 * which also means it compiles for both the WebGPU and WebGL backends.
 */

import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, texture as textureNode, uv, vec4, float } from 'three/tsl';
import { smokeTexture } from './textures.js';

const RIGHT = new THREE.Vector3();
const UP = new THREE.Vector3();
const FORWARD = new THREE.Vector3();
const MATRIX = new THREE.Matrix4();
const SCALE = new THREE.Vector3();

export class ParticleSystem {
    constructor(scene, {
        max = 400,
        blending = THREE.NormalBlending,
        gravity = -1.4,
        drag = 0.86,
        renderOrder = 5
    } = {}) {
        this.max = max;
        this.gravity = gravity;
        this.drag = drag;
        this.cursor = 0;
        this.alive = 0;

        this.px = new Float32Array(max);
        this.py = new Float32Array(max);
        this.pz = new Float32Array(max);
        this.vx = new Float32Array(max);
        this.vy = new Float32Array(max);
        this.vz = new Float32Array(max);
        this.life = new Float32Array(max);
        this.maxLife = new Float32Array(max);
        this.size = new Float32Array(max);
        this.growth = new Float32Array(max);

        const geometry = new THREE.PlaneGeometry(1, 1);
        this.opacityAttr = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
        this.colorAttr = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
        geometry.setAttribute('aOpacity', this.opacityAttr);
        geometry.setAttribute('aTint', this.colorAttr);

        const material = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            blending,
            side: THREE.DoubleSide,
            toneMapped: blending !== THREE.AdditiveBlending
        });
        const sprite = textureNode(smokeTexture(), uv());
        material.colorNode = vec4(attribute('aTint').mul(sprite.r), sprite.a);
        material.opacityNode = sprite.a.mul(attribute('aOpacity')).mul(float(1));

        this.mesh = new THREE.InstancedMesh(geometry, material, max);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = renderOrder;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.count = 0;
        scene.add(this.mesh);

        this._color = new THREE.Color();
    }

    spawn(x, y, z, vx, vy, vz, { size = 1, life = 1, color = 0xffffff, growth = 1.6 } = {}) {
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % this.max;
        this.px[i] = x; this.py[i] = y; this.pz[i] = z;
        this.vx[i] = vx; this.vy[i] = vy; this.vz[i] = vz;
        this.life[i] = life;
        this.maxLife[i] = life;
        this.size[i] = size;
        this.growth[i] = growth;
        this._color.set(color);
        this.colorAttr.setXYZ(i, this._color.r, this._color.g, this._color.b);
        this.mesh.count = this.max;
    }

    update(dt, camera) {
        if (this.mesh.count === 0) return;
        camera.matrixWorld.extractBasis(RIGHT, UP, FORWARD);
        let visible = 0;

        for (let i = 0; i < this.max; i++) {
            if (this.life[i] <= 0) {
                this.opacityAttr.setX(i, 0);
                continue;
            }
            this.life[i] -= dt;
            const t = Math.max(0, this.life[i] / this.maxLife[i]);

            this.vy[i] += this.gravity * dt;
            const damp = Math.exp(Math.log(this.drag) * dt * 60 / 60);
            this.vx[i] *= damp; this.vy[i] *= damp; this.vz[i] *= damp;
            this.px[i] += this.vx[i] * dt;
            this.py[i] += this.vy[i] * dt;
            this.pz[i] += this.vz[i] * dt;

            const grow = this.size[i] * (1 + (1 - t) * this.growth[i]);
            SCALE.set(grow, grow, grow);
            MATRIX.makeBasis(
                RIGHT.clone().multiplyScalar(grow),
                UP.clone().multiplyScalar(grow),
                FORWARD
            );
            MATRIX.setPosition(this.px[i], this.py[i], this.pz[i]);
            this.mesh.setMatrixAt(i, MATRIX);
            this.opacityAttr.setX(i, Math.sin(t * Math.PI) * 0.95);
            visible++;
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.opacityAttr.needsUpdate = true;
        this.colorAttr.needsUpdate = true;
        if (visible === 0) this.mesh.count = 0;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh.removeFromParent();
    }
}

/** Dark rubber ribbons left behind while a tyre is sliding. */
export class SkidTrails {
    constructor(scene, { maxPoints = 900 } = {}) {
        this.maxPoints = maxPoints;
        this.cursor = 0;
        this.positions = new Float32Array(maxPoints * 2 * 3);
        this.alphas = new Float32Array(maxPoints * 2);
        this.age = new Float32Array(maxPoints);

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('aOpacity', new THREE.BufferAttribute(this.alphas, 1).setUsage(THREE.DynamicDrawUsage));

        const indices = [];
        for (let i = 0; i < maxPoints - 1; i++) {
            const a = i * 2;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        geometry.setIndex(indices);
        geometry.setDrawRange(0, 0);

        const material = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            polygonOffset: true,
            polygonOffsetFactor: -4
        });
        material.colorNode = vec4(0.02, 0.02, 0.025, 1);
        material.opacityNode = attribute('aOpacity');

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.frustumCulled = false;
        this.mesh.renderOrder = 1;
        scene.add(this.mesh);
        this.geometry = geometry;
        this.lastIndex = -1;
    }

    /** @param {{x,y,z}} position @param {number} yaw @param {number} intensity 0..1 */
    push(position, yaw, halfTrack, intensity) {
        if (intensity <= 0.02) {
            this.lastIndex = -1;
            return;
        }
        const i = this.cursor;
        const cos = Math.cos(yaw);
        const sin = Math.sin(yaw);
        // Perpendicular to heading.
        const nx = cos * halfTrack;
        const nz = -sin * halfTrack;

        const o = i * 6;
        this.positions[o] = position.x - nx;
        this.positions[o + 1] = position.y + 0.02;
        this.positions[o + 2] = position.z - nz;
        this.positions[o + 3] = position.x + nx;
        this.positions[o + 4] = position.y + 0.02;
        this.positions[o + 5] = position.z + nz;

        const alpha = Math.min(0.65, intensity * 0.7);
        this.alphas[i * 2] = alpha;
        this.alphas[i * 2 + 1] = alpha;

        // A gap in the trail must not be bridged by a stray quad.
        if (this.lastIndex !== i - 1) {
            this.alphas[i * 2] = 0;
            this.alphas[i * 2 + 1] = 0;
        }
        this.lastIndex = i;
        this.cursor = (this.cursor + 1) % this.maxPoints;
        this.geometry.setDrawRange(0, (this.maxPoints - 1) * 6);
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.aOpacity.needsUpdate = true;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh.removeFromParent();
    }
}

/** Rain: streaks that live in a box around the camera and wrap around it. */
export class RainField {
    constructor(scene, { count = 2600, radius = 42 } = {}) {
        this.count = count;
        this.radius = radius;
        const geometry = new THREE.PlaneGeometry(0.035, 1.2);
        const material = new MeshBasicNodeMaterial({
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        material.colorNode = vec4(0.75, 0.85, 0.95, 1);
        material.opacityNode = float(0.42);

        this.mesh = new THREE.InstancedMesh(geometry, material, count);
        this.mesh.frustumCulled = false;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.mesh);

        this.px = new Float32Array(count);
        this.py = new Float32Array(count);
        this.pz = new Float32Array(count);
        for (let i = 0; i < count; i++) this.reset(i, true);
        this.enabled = false;
        this.mesh.visible = false;
    }

    reset(i, initial = false) {
        this.px[i] = (Math.random() - 0.5) * this.radius * 2;
        this.py[i] = initial ? Math.random() * 26 : 20 + Math.random() * 6;
        this.pz[i] = (Math.random() - 0.5) * this.radius * 2;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        this.mesh.visible = enabled;
    }

    update(dt, camera, windZ = 0) {
        if (!this.enabled) return;
        const cam = camera.position;
        const fall = 34 * dt;

        for (let i = 0; i < this.count; i++) {
            this.py[i] -= fall;
            this.pz[i] -= windZ * dt * 0.35;
            if (this.py[i] < -4) this.reset(i);

            const x = cam.x + this.px[i];
            const z = cam.z + this.pz[i];
            MATRIX.makeScale(1, 1 + Math.min(2.4, Math.abs(windZ) * 0.05), 1);
            MATRIX.setPosition(x, cam.y + this.py[i] - 12, z);
            this.mesh.setMatrixAt(i, MATRIX);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.mesh.geometry.dispose();
        this.mesh.material.dispose();
        this.mesh.removeFromParent();
    }
}
