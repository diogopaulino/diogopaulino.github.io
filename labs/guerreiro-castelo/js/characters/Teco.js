import * as THREE from 'three';
import { buildTeco, CharacterAnimator } from './builders.js';
import { MonkeyAI } from '../ai/MonkeyAI.js';
import { angleDamp } from '../utils/math.js';

export class Teco {
    constructor(scene) {
        const built = buildTeco();
        this.root = built.group;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.group, built.clips);
        scene.add(this.root);
        this.root.traverse((c) => { if (c.isMesh) c.userData.ignoreCamera = true; });
        this.position = new THREE.Vector3();
        this.facing = 0;
        this.ai = new MonkeyAI(this);
        this.onShoulder = false;
        this.visible = true;
    }

    spawn(x, y, z) {
        this.position.set(x, y, z);
        this.root.position.copy(this.position);
        this.ai.reset();
    }

    attachTo(parent) {
        if (this.root.parent) this.root.parent.remove(this.root);
        parent.add(this.root);
    }

    play(name) {
        this.animator.play(name, 0.12);
    }

    update(dt, game) {
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 10, dt);
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
        this.root.visible = this.visible;
        this.animator.update(dt);
    }
}
