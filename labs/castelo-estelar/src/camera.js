/**
 * Castelo Estelar — Câmera Cinemática e Órbita Livre em Babylon.js.
 * Interpolação suave em Catmull-Rom para a abertura cinematográfica (22s)
 * com transição perfeita para ArcRotateCamera livre.
 */

import { clamp, smoothstep, easeInOutCubic } from './utils.js';

export const INTRO_DURATION = 22;

const KEYS = [
    { t: 0.0, pos: [12, 8.5, 115], look: [0, 8, 16], fov: 0.56 },
    { t: 4.0, pos: [8, 9.4, 86], look: [0, 12, 6], fov: 0.58 },
    { t: 8.5, pos: [5, 11.5, 65], look: [0, 18, 0], fov: 0.60 },
    { t: 14.0, pos: [-7, 15.6, 48], look: [1, 21, -1], fov: 0.63 },
    { t: 18.2, pos: [4, 14.2, 40], look: [0, 20, 0], fov: 0.66 },
    { t: 22.0, pos: [2.0, 13.0, 38], look: [0, 19, 0], fov: 0.70 }
];

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
    constructor(scene, canvas) {
        const B = window.BABYLON;
        this.scene = scene;
        this.canvas = canvas;
        this.mode = 'intro';
        this.t = 0;

        // Câmera Orbital com limites e amortecimento
        this.camera = new B.ArcRotateCamera('cineCam', -Math.PI / 2, Math.PI / 3, 45, new B.Vector3(0, 18, 0), scene);
        this.camera.fov = 0.56;
        this.camera.minZ = 0.3;
        this.camera.maxZ = 1200;

        this.camera.lowerRadiusLimit = 16;
        this.camera.upperRadiusLimit = 160;
        this.camera.lowerBetaLimit = 0.15;
        this.camera.upperBetaLimit = Math.PI * 0.485; // Evita atravessar a água

        this.camera.inertia = 0.88;
        this.camera.wheelDeltaPercentage = 0.015;
        this.camera.pinchDeltaPercentage = 0.015;
        this.camera.panningSensibility = 0; // Desativa pan para focar no castelo

        this.apply(0);
    }

    playIntro() {
        this.mode = 'intro';
        this.t = 0;
        this.camera.detachControl();
        this.apply(0);
    }

    skip() {
        this.t = INTRO_DURATION;
        this.enterOrbit();
    }

    enterOrbit() {
        const B = window.BABYLON;
        this.mode = 'orbit';
        const end = sampleKeys(INTRO_DURATION);

        this.camera.setTarget(new B.Vector3(end.look[0], end.look[1], end.look[2]));
        this.camera.setPosition(new B.Vector3(end.pos[0], end.pos[1], end.pos[2]));
        this.camera.fov = end.fov;

        this.camera.attachControl(this.canvas, true);
    }

    apply(time) {
        const B = window.BABYLON;
        const k = sampleKeys(time);
        this.camera.setPosition(new B.Vector3(k.pos[0], k.pos[1], k.pos[2]));
        this.camera.setTarget(new B.Vector3(k.look[0], k.look[1], k.look[2]));
        this.camera.fov = k.fov;
    }

    tick(dt) {
        if (this.mode === 'intro') {
            this.t += dt;
            this.apply(this.t);
            if (this.t >= INTRO_DURATION) {
                this.enterOrbit();
            }
        }
    }
}

