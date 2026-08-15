/**
 * Companheiro Teco (Macaco) para Babylon.js.
 */

import { buildTeco, CharacterAnimator } from './builders.js';
import { MonkeyAI } from '../ai/MonkeyAI.js';
import { angleDamp } from '../utils/math.js';

export class Teco {
    constructor(scene) {
        this.scene = scene;
        const built = buildTeco(scene);
        this.root = built.root;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.root, built.clips);
        this.position = new BABYLON.Vector3(0, 0, 0);
        this.facing = 0;
        this.ai = new MonkeyAI(this);
        this.onShoulder = false;
        this.visible = true;
    }

    spawn(x, y, z) {
        this.position.set(x, y, z);
        this.root.position.copyFrom(this.position);
        this.ai.reset();
    }

    attachTo(parent) {
        this.root.parent = parent;
    }

    play(name) {
        this.animator.play(name, 0.12);
    }

    update(dt, game) {
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 10, dt);
        this.root.position.copyFrom(this.position);
        this.root.rotation.y = this.facing;
        this.root.setEnabled(this.visible);
        this.animator.update(dt);
    }
}
