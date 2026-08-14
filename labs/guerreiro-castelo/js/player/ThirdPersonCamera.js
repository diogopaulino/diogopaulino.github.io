/**
 * Câmera em terceira pessoa — ombro, órbita, zoom, raycast contra paredes.
 * Nunca é parenteda no personagem.
 */

import * as THREE from 'three';
import { clamp, damp } from '../utils/math.js';

const _from = new THREE.Vector3();
const _to = new THREE.Vector3();
const _desired = new THREE.Vector3();
const _look = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _hit = new THREE.Vector3();

export class ThirdPersonCamera {
    constructor(camera, scene) {
        this.camera = camera;
        this.scene = scene;
        this.yaw = 0;
        this.pitch = 0.32;
        this.distance = 4.4;
        this.targetDistance = 4.4;
        this.minDistance = 1.4;
        this.maxDistance = 7.2;
        this.pitchMin = -0.55;
        this.pitchMax = 1.15;
        this.shoulder = 0.55;
        this.lookHeight = 1.55;
        this.fov = 55;
        this.targetFov = 55;
        this.shake = 0;
        this.shakeAmp = 0;
        this.locked = false;
        this.ray = new THREE.Raycaster();
        this.ray.far = 12;
        this._obstacles = [];
        this.currentPos = new THREE.Vector3(0, 2, 6);
        this.smoothLook = new THREE.Vector3();
        this.cutscene = false;
    }

    setObstacles(meshes) {
        this._obstacles = meshes;
    }

    addShake(amp = 0.12, time = 0.25) {
        this.shake = Math.max(this.shake, time);
        this.shakeAmp = Math.max(this.shakeAmp, amp);
    }

    lookAtImmediate(target) {
        this.smoothLook.copy(target);
        this.currentPos.copy(this.camera.position);
    }

    update(dt, player, lookDelta, zoomDelta, sprinting) {
        if (this.cutscene) return;

        this.yaw -= lookDelta.x * 0.00215;
        this.pitch = clamp(this.pitch - lookDelta.y * 0.0019, this.pitchMin, this.pitchMax);
        this.targetDistance = clamp(this.targetDistance + zoomDelta * 0.45, this.minDistance, this.maxDistance);
        this.distance = damp(this.distance, this.targetDistance, 8, dt);

        this.targetFov = sprinting ? 62 : 55;
        this.fov = damp(this.fov, this.targetFov, 4, dt);
        this.camera.fov = this.fov;
        this.camera.updateProjectionMatrix();

        const origin = player.worldPosition ? player.worldPosition() : player.position;
        const lookY = origin.y + (player.crouching ? 1.15 : this.lookHeight);
        _look.set(origin.x, lookY, origin.z);

        const cosP = Math.cos(this.pitch);
        const sinP = Math.sin(this.pitch);
        const sinY = Math.sin(this.yaw);
        const cosY = Math.cos(this.yaw);

        const backX = sinY * cosP;
        const backZ = cosY * cosP;
        const rightX = cosY;
        const rightZ = -sinY;

        _desired.set(
            _look.x + backX * this.distance + rightX * this.shoulder,
            _look.y + sinP * this.distance,
            _look.z + backZ * this.distance + rightZ * this.shoulder
        );

        let dist = this.distance;
        if (this._obstacles.length) {
            _from.copy(_look);
            _to.copy(_desired).sub(_from);
            const len = _to.length();
            if (len > 0.01) {
                this.ray.set(_from, _to.normalize());
                this.ray.far = len;
                const hits = this.ray.intersectObjects(this._obstacles, true);
                if (hits.length) {
                    const h = hits[0];
                    dist = Math.max(0.6, h.distance - 0.28);
                    _desired.copy(_from).addScaledVector(this.ray.ray.direction, dist);
                }
            }
        }

        this.currentPos.x = damp(this.currentPos.x, _desired.x, 14, dt);
        this.currentPos.y = damp(this.currentPos.y, _desired.y, 12, dt);
        this.currentPos.z = damp(this.currentPos.z, _desired.z, 14, dt);
        this.smoothLook.x = damp(this.smoothLook.x, _look.x, 16, dt);
        this.smoothLook.y = damp(this.smoothLook.y, _look.y, 16, dt);
        this.smoothLook.z = damp(this.smoothLook.z, _look.z, 16, dt);

        if (this.shake > 0) {
            this.shake -= dt;
            const a = this.shakeAmp * (this.shake / 0.25);
            this.currentPos.x += (Math.random() - 0.5) * a;
            this.currentPos.y += (Math.random() - 0.5) * a * 0.6;
        }

        this.camera.position.copy(this.currentPos);
        this.camera.up.copy(_up);
        this.camera.lookAt(this.smoothLook);
        _hit.copy(_desired);
    }

    /**
     * Cutscene: interpola posição e lookAt. Chamado pelo CutsceneManager.
     */
    setCutscenePose(pos, look) {
        this.camera.position.copy(pos);
        this.camera.lookAt(look);
        this.currentPos.copy(pos);
        this.smoothLook.copy(look);
    }
}
