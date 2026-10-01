/**
 * Câmera: intro aérea → nível humano, modos turista/morador/mapa/drone.
 */

import * as THREE from 'three';
import { INTRO, VIEW_MODES, ORLA_HALF, WALK } from './config.js';
import { clamp, damp, lerp, smoothstep } from './utils.js';

export class OrlaCamera {
    constructor(camera) {
        this.camera = camera;
        this.mode = 'tourist';
        this.phase = 'intro'; // intro | walk | map | cinematic
        this.introT = 0;
        this.yaw = 0;
        this.pitch = -0.08;
        this.lookTarget = new THREE.Vector3();
        this._pos = new THREE.Vector3();
        this.cinematicT = 0;
    }

    startIntro() {
        this.phase = 'intro';
        this.introT = 0;
        this.camera.fov = 55;
        this.camera.updateProjectionMatrix();
    }

    setMode(mode) {
        this.mode = mode;
        if (mode === 'map') {
            this.phase = 'map';
            this.camera.fov = 42;
        } else if (mode === 'cinematic') {
            this.phase = 'cinematic';
            this.camera.fov = 48;
            this.cinematicT = 0;
        } else {
            this.phase = 'walk';
            this.camera.fov = 62;
        }
        this.camera.updateProjectionMatrix();
    }

    update(dt, player) {
        if (this.phase === 'intro') {
            this.introT += dt;
            const u = clamp(this.introT / INTRO.duration, 0, 1);
            const e = smoothstep(0, 1, u);
            const x = lerp(-40, player.x, e * e);
            const y = lerp(INTRO.startY, INTRO.endY, Math.pow(e, 0.7));
            const z = lerp(INTRO.startZ, player.z + 6, e);
            this.camera.position.set(x, y, z);
            this.lookTarget.set(lerp(0, player.x, e), lerp(0, 1.2, e), lerp(20, player.z, e));
            this.camera.lookAt(this.lookTarget);
            if (u >= 1) {
                this.phase = 'walk';
                this.yaw = 0;
                this.pitch = -0.05;
            }
            return { introProgress: u, landed: u >= 1 };
        }

        if (this.phase === 'map') {
            const target = this._pos.set(player.x * 0.15, VIEW_MODES.map.height, 40);
            this.camera.position.x = damp(this.camera.position.x, target.x, 3, dt);
            this.camera.position.y = damp(this.camera.position.y, target.y, 3, dt);
            this.camera.position.z = damp(this.camera.position.z, target.z, 3, dt);
            this.lookTarget.set(player.x * 0.2, 0, 12);
            this.camera.lookAt(this.lookTarget);
            return { introProgress: 1, landed: true };
        }

        if (this.phase === 'cinematic') {
            this.cinematicT += dt;
            const t = this.cinematicT * 0.12;
            const x = Math.sin(t * 0.35) * ORLA_HALF * 0.85;
            const y = 18 + Math.sin(t * 0.5) * 8;
            const z = 35 + Math.cos(t * 0.4) * 25;
            this.camera.position.x = damp(this.camera.position.x, x, 1.5, dt);
            this.camera.position.y = damp(this.camera.position.y, y, 1.5, dt);
            this.camera.position.z = damp(this.camera.position.z, z, 1.5, dt);
            this.lookTarget.set(x * 0.7, 1, 10);
            this.camera.lookAt(this.lookTarget);
            return { introProgress: 1, landed: true };
        }

        const eye = VIEW_MODES[this.mode]?.height || WALK.eyeHeight;
        this.yaw = player.yaw;
        this.pitch = damp(this.pitch, player.pitch, 10, dt);

        const dist = 5.5;
        const ox = Math.sin(this.yaw) * dist;
        const oz = Math.cos(this.yaw) * dist;
        const tx = player.x - ox;
        const ty = eye + 1.1;
        const tz = player.z - oz + Math.sin(this.pitch) * 2;

        this.camera.position.x = damp(this.camera.position.x, tx, 8, dt);
        this.camera.position.y = damp(this.camera.position.y, ty, 8, dt);
        this.camera.position.z = damp(this.camera.position.z, tz, 8, dt);

        this.lookTarget.set(
            player.x + Math.sin(this.yaw) * 8,
            eye + this.pitch * 6,
            player.z + Math.cos(this.yaw) * 8
        );
        this.camera.lookAt(this.lookTarget);
        return { introProgress: 1, landed: true };
    }
}
