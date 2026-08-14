import * as THREE from 'three';
import { buildTiger, CharacterAnimator } from './builders.js';
import { TigerAI } from '../ai/TigerAI.js';

export class Tiger {
    constructor(scene) {
        const built = buildTiger();
        this.root = built.group;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.group, built.clips);
        scene.add(this.root);
        this.position = new THREE.Vector3();
        this.facing = 0;
        this.ai = new TigerAI(this);
        this.active = false;
        this.root.visible = false;
    }

    spawn(x, y, z, yaw = 0) {
        this.position.set(x, y, z);
        this.facing = yaw;
        this.root.position.copy(this.position);
        this.root.rotation.y = yaw;
        this.root.visible = true;
        this.active = true;
        this.ai.reset();
    }

    update(dt, game) {
        if (!this.active) return;
        this.ai.update(dt, game);
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
        this.animator.update(dt);
    }
}
