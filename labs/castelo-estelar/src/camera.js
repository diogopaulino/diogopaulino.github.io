/**
 * Câmera cinematográfica em Babylon.js — voo sobre o lago, aproximação
 * do castelo e transição suave para órbita livre (ArcRotateCamera).
 */

export const INTRO_DURATION = 16.0;

function cubic(p0, p1, p2, p3, t) {
    const it = 1 - t;
    return it * it * it * p0 + 3 * it * it * t * p1 + 3 * it * t * t * p2 + t * t * t * p3;
}

export class CineCamera {
    constructor(BABYLON, canvas, scene) {
        this.BABYLON = BABYLON;
        this.canvas = canvas;
        this.scene = scene;

        // Câmera universal / orbital do Babylon
        this.camera = new BABYLON.ArcRotateCamera('cineCam', -Math.PI / 2, Math.PI / 2.8, 55, new BABYLON.Vector3(0, 12, 0), scene);
        this.camera.lowerRadiusLimit = 15;
        this.camera.upperRadiusLimit = 120;
        this.camera.lowerBetaLimit = 0.2;
        this.camera.upperBetaLimit = Math.PI / 2.05;
        this.camera.wheelDeltaPercentage = 0.015;
        this.camera.pinchDeltaPercentage = 0.015;
        this.camera.inertia = 0.85;

        this.mode = 'cinematic';
    }

    attachOrbit() {
        this.mode = 'orbit';
        this.camera.attachControl(this.canvas, true);
    }

    detachOrbit() {
        this.mode = 'cinematic';
        this.camera.detachControl();
    }

    update(time) {
        if (this.mode !== 'cinematic') return;

        const t = Math.min(1, Math.max(0, time / INTRO_DURATION));

        // Curva Bezier da Câmera
        let px, py, pz, tx, ty, tz;

        if (t < 0.35) {
            // Fase 1: Voo rasante sobre o lago refletindo as estrelas
            const k = t / 0.35;
            px = cubic(-40, -25, -10, 0, k);
            py = cubic(3, 4, 7, 12, k);
            pz = cubic(75, 60, 50, 44, k);
            tx = cubic(0, 0, 0, 0, k);
            ty = cubic(8, 9, 11, 14, k);
            tz = cubic(0, 0, 0, 0, k);
        } else if (t < 0.75) {
            // Fase 2: Elevação e enquadramento das torres para o arco da fada
            const k = (t - 0.35) / 0.40;
            px = cubic(0, 5, 8, 0, k);
            py = cubic(12, 16, 18, 17, k);
            pz = cubic(44, 46, 50, 52, k);
            tx = cubic(0, 0, 0, 0, k);
            ty = cubic(14, 16, 17, 16, k);
            tz = cubic(0, 0, 0, 0, k);
        } else {
            // Fase 3: Ponto clássico e estalido dos fogos de artifício
            const k = (t - 0.75) / 0.25;
            px = cubic(0, -2, 0, 0, k);
            py = cubic(17, 17.5, 17.8, 18, k);
            pz = cubic(52, 54, 55, 56, k);
            tx = 0;
            ty = 15;
            tz = 0;
        }

        this.camera.setPosition(new this.BABYLON.Vector3(px, py, pz));
        this.camera.setTarget(new this.BABYLON.Vector3(tx, ty, tz));
    }
}
