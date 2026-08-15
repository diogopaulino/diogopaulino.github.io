/**
 * Cutscenes: interpolação de câmera em Babylon.js, bloqueio de controle e eventos de história.
 */

import { getEasing } from '../utils/easing.js';

export class CutsceneManager {
    constructor(cameraRig) {
        this.rig = cameraRig;
        this.blocking = false;
        this.t = 0;
        this.duration = 0;
        this.fromPos = new BABYLON.Vector3();
        this.toPos = new BABYLON.Vector3();
        this.fromLook = new BABYLON.Vector3();
        this.toLook = new BABYLON.Vector3();
        this.ease = getEasing('inOutCubic');
        this.midAt = 0.5;
        this.midFired = false;
        this.onMid = null;
        this.onEnd = null;
        this._pos = new BABYLON.Vector3();
        this._look = new BABYLON.Vector3();
    }

    play({
        from, to, lookFrom, lookTo, duration = 3, easing = 'inOutCubic',
        onMid = null, onEnd = null, midAt = 0.5
    }) {
        this.blocking = true;
        this.rig.cutscene = true;
        this.t = 0;
        this.duration = duration;
        this.fromPos.copyFrom(from);
        this.toPos.copyFrom(to);
        this.fromLook.copyFrom(lookFrom);
        this.toLook.copyFrom(lookTo);
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

        BABYLON.Vector3.LerpToRef(this.fromPos, this.toPos, e, this._pos);
        BABYLON.Vector3.LerpToRef(this.fromLook, this.toLook, e, this._look);

        this.rig.setCutscenePose(this._pos, this._look);

        if (!this.midFired && u >= this.midAt) {
            this.midFired = true;
            this.onMid?.();
        }

        if (u >= 1) this._finish();
    }
}
