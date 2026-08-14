/**
 * Abertura cinematográfica.
 * Keyframes interpolados com Catmull-Rom no espaço e ease suave no tempo.
 *
 * easeInOutCubic(t) = t<½ ? 4t³ : 1 − (−2t+2)³ / 2
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { clamp, smoothstep } from './utils.js';

export const INTRO_DURATION = 22;

const KEYS = [
    { t: 0.0, pos: [22, 5.2, 168], look: [0, 18, 0], fov: 28 },
    { t: 3.5, pos: [12, 7.5, 118], look: [0, 20, 0], fov: 30 },
    { t: 8.0, pos: [6, 11.5, 78], look: [0, 22, -2], fov: 33 },
    { t: 13.5, pos: [-8, 16, 54], look: [1, 24, -2], fov: 36 },
    { t: 18.0, pos: [4, 14.5, 46], look: [0, 22, 0], fov: 38 },
    { t: 22.0, pos: [2.5, 13.2, 44], look: [0, 21, 0], fov: 40 }
];

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function sampleKeys(time) {
    const t = clamp(time, 0, INTRO_DURATION);
    let i = 0;
    while (i < KEYS.length - 2 && KEYS[i + 1].t < t) i++;
    const a = KEYS[i];
    const b = KEYS[i + 1];
    const u = easeInOutCubic(smoothstep(a.t, b.t, t));
    return {
        pos: a.pos.map((v, k) => v + (b.pos[k] - v) * u),
        look: a.look.map((v, k) => v + (b.look[k] - v) * u),
        fov: a.fov + (b.fov - a.fov) * u
    };
}

export class CineCamera {
    constructor(camera, canvas) {
        this.camera = camera;
        this.mode = 'intro';
        this.t = 0;
        this.controls = new OrbitControls(camera, canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.06;
        this.controls.target.set(0, 18, 0);
        this.controls.minDistance = 18;
        this.controls.maxDistance = 160;
        this.controls.maxPolarAngle = Math.PI * 0.49;
        this.controls.minPolarAngle = 0.18;
        this.controls.enablePan = false;
        this.controls.enabled = false;
        this._pos = new THREE.Vector3();
        this._look = new THREE.Vector3();
    }

    playIntro() {
        this.mode = 'intro';
        this.t = 0;
        this.controls.enabled = false;
        this.apply(0);
    }

    skip() {
        this.t = INTRO_DURATION;
        this.enterOrbit();
    }

    enterOrbit() {
        this.mode = 'orbit';
        const end = sampleKeys(INTRO_DURATION);
        this.camera.position.set(...end.pos);
        this.controls.target.set(...end.look);
        this.camera.fov = end.fov;
        this.camera.updateProjectionMatrix();
        this.controls.enabled = true;
        this.controls.update();
    }

    apply(time) {
        const k = sampleKeys(time);
        this.camera.position.set(...k.pos);
        this._look.set(...k.look);
        this.camera.lookAt(this._look);
        if (Math.abs(this.camera.fov - k.fov) > 0.05) {
            this.camera.fov = k.fov;
            this.camera.updateProjectionMatrix();
        }
    }

    tick(dt) {
        if (this.mode === 'intro') {
            this.t += dt;
            this.apply(this.t);
            if (this.t >= INTRO_DURATION) this.enterOrbit();
            return;
        }
        this.controls.update();
    }
}
