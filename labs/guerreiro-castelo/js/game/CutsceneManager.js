/**
 * Cutscenes curtas: interpola câmera, bloqueia controle, dispara eventos.
 */

import * as THREE from 'three';
import { getEasing } from '../utils/easing.js';

export class CutsceneManager {
    constructor(cameraRig) {
        this.rig = cameraRig;
        this.blocking = false;
        this.t = 0;
        this.duration = 0;
        this.fromPos = new THREE.Vector3();
        this.toPos = new THREE.Vector3();
        this.fromLook = new THREE.Vector3();
        this.toLook = new THREE.Vector3();
        this.ease = getEasing('inOutCubic');
        this.midAt = 0.5;
        this.midFired = false;
        this.onMid = null;
        this.onEnd = null;
        this._pos = new THREE.Vector3();
        this._look = new THREE.Vector3();
    }

    play({
        from, to, lookFrom, lookTo, duration = 3, easing = 'inOutCubic',
        onMid = null, onEnd = null, midAt = 0.5
    }) {
        this.blocking = true;
        this.rig.cutscene = true;
        this.t = 0;
        this.duration = duration;
        this.fromPos.copy(from);
        this.toPos.copy(to);
        this.fromLook.copy(lookFrom);
        this.toLook.copy(lookTo);
        this.ease = getEasing(easing);
        this.onMid = onMid;
        this.onEnd = onEnd;
        this.midAt = midAt;
        this.midFired = false;
        this.rig.setCutscenePose(from, lookFrom);
    }

    skip() {
        if (!this.blocking) return;
        this.t = this.duration;
        this._finish();
    }

    _finish() {
        this.blocking = false;
        this.rig.cutscene = false;
        this.rig.setCutscenePose(this.toPos, this.toLook);
        const cb = this.onEnd;
        this.onEnd = null;
        this.onMid = null;
        cb?.();
    }

    update(dt) {
        if (!this.blocking) return;
        this.t += dt;
        const u = Math.min(1, this.t / this.duration);
        const e = this.ease(u);
        this._pos.lerpVectors(this.fromPos, this.toPos, e);
        this._look.lerpVectors(this.fromLook, this.toLook, e);
        this.rig.setCutscenePose(this._pos, this._look);
        if (!this.midFired && u >= this.midAt) {
            this.midFired = true;
            this.onMid?.();
        }
        if (u >= 1) this._finish();
    }
}
