/**
 * Câmera AM2: permanece no lado do anel, enquadra os dois lutadores
 * e recua quando eles se afastam. O lado não inverte no cruzamento.
 */

import * as THREE from 'three';
import { damp } from './utils.js';

const MID = new THREE.Vector3();
const DELTA = new THREE.Vector3();
const PERP = new THREE.Vector3();
const TARGET = new THREE.Vector3();
const LOOK = new THREE.Vector3();

export class FightCamera {
    constructor(camera) {
        this.camera = camera;
        this.shake = 0;
        this.mode = 'fight';
        this.orbit = 0.4;
        this.offset = new THREE.Vector3(0, 2.6, 8.5);
    }

    impulse(amount) {
        this.shake = Math.max(this.shake, amount);
    }

    setMode(mode) {
        this.mode = mode;
    }

    update(dt, p1, p2, timeScale = 1) {
        const cam = this.camera;
        this.shake = Math.max(0, this.shake - dt * 4);

        if (this.mode === 'orbit' || this.mode === 'showcase') {
            this.orbit += dt * (this.mode === 'showcase' ? 0.55 : 0.22);
            const r = this.mode === 'showcase' ? 4.2 : 11;
            const h = this.mode === 'showcase' ? 1.65 : 3.4;
            const focusY = this.mode === 'showcase' ? 1.15 : 1.2;
            TARGET.set(Math.sin(this.orbit) * r, h, Math.cos(this.orbit) * r);
            cam.position.x = damp(cam.position.x, TARGET.x, 3.2, dt);
            cam.position.y = damp(cam.position.y, TARGET.y, 3.2, dt);
            cam.position.z = damp(cam.position.z, TARGET.z, 3.2, dt);
            cam.lookAt(0, focusY, 0);
            return;
        }

        MID.set((p1.x + p2.x) * 0.5, 1.15, (p1.z + p2.z) * 0.5);
        DELTA.set(p2.x - p1.x, 0, p2.z - p1.z);
        const span = Math.max(2.2, DELTA.length());
        PERP.set(-DELTA.z, 0, DELTA.x);
        if (PERP.lengthSq() < 0.0001) PERP.set(0, 0, 1);
        PERP.normalize();
        const side = cam.position.clone().sub(MID);
        if (side.dot(PERP) < 0) PERP.negate();

        const dist = 6.2 + span * 0.62;
        const height = 2.15 + span * 0.16;
        TARGET.copy(MID).addScaledVector(PERP, dist);
        TARGET.y = height;

        const lag = 4.2 * timeScale;
        cam.position.x = damp(cam.position.x, TARGET.x, lag, dt);
        cam.position.y = damp(cam.position.y, TARGET.y, lag, dt);
        cam.position.z = damp(cam.position.z, TARGET.z, lag, dt);

        LOOK.copy(MID);
        LOOK.y = 1.05;
        if (this.shake > 0) {
            cam.position.x += (Math.random() - 0.5) * this.shake * 0.35;
            cam.position.y += (Math.random() - 0.5) * this.shake * 0.2;
        }
        cam.lookAt(LOOK);
    }
}

export function cameraMoveAxes(camera, inputX, inputZ) {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    right.y = 0;
    if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
    right.normalize();
    const fwd = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2);
    fwd.y = 0;
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    return {
        x: right.x * inputX - fwd.x * inputZ,
        z: right.z * inputX - fwd.z * inputZ
    };
}

export function towardAxes(me, opp, side, forward) {
    const fx = opp.x - me.x;
    const fz = opp.z - me.z;
    const len = Math.hypot(fx, fz) || 1;
    const fwx = fx / len;
    const fwz = fz / len;
    return {
        x: -fwz * side + fwx * forward,
        z: fwx * side + fwz * forward
    };
}
