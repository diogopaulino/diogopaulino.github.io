/**
 * Tigre do castelo para Babylon.js.
 */

import { buildTiger, CharacterAnimator } from './builders.js';
import { TigerAI } from '../ai/TigerAI.js';
import { angleDamp } from '../utils/math.js';

export class Tiger {
    constructor(parentOrScene) {
        const scene = parentOrScene.getScene ? parentOrScene.getScene() : parentOrScene;
        const built = buildTiger(scene);
        this.root = built.root;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.root, built.clips);

        if (parentOrScene.getScene) {
            this.root.parent = parentOrScene;
        }

        this.position = new BABYLON.Vector3(0, 0, 0);
        this.facing = 0;
        this.ai = new TigerAI(this);
    }

    spawn(x, y, z, yaw = 0) {
        this.position.set(x, y, z);
        this.facing = yaw;
        this.root.position.copyFrom(this.position);
        this.root.rotation.y = this.facing;
        this.ai.reset();
    }

    update(dt, game) {
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 8, dt);
        this.root.position.copyFrom(this.position);
        this.root.rotation.y = this.facing;
        this.animator.update(dt);
    }
}
