/**
 * Princesa Camila para Babylon.js.
 */

import { buildCamila, CharacterAnimator } from './builders.js';
import { PrincessAI } from '../ai/PrincessAI.js';
import { angleDamp } from '../utils/math.js';

export class Camila {
    constructor(scene) {
        this.scene = scene;
        const built = buildCamila(scene);
        this.root = built.root;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.root, built.clips);
        this.position = new BABYLON.Vector3(0, 0, 0);
        this.facing = 0;
        this.speed = 0;
        this.active = false;
        this.freed = false;
        this.ai = new PrincessAI(this);
    }

    spawn(x, y, z) {
        this.position.set(x, y, z);
        this.root.position.copyFrom(this.position);
        this.ai.reset();
    }

    attachTo(parent) {
        this.root.parent = parent;
    }

    setShackles(on) {
        if (this.parts.shackles) {
            this.parts.shackles.setEnabled(on);
        }
    }

    update(dt, game) {
        if (!this.active) return;
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 10, dt);
        this.root.position.copyFrom(this.position);
        this.root.rotation.y = this.facing;

        if (this.speed > 4.5) this.animator.play('Run', 0.12);
        else if (this.speed > 0.2) this.animator.play('Walk', 0.14);
        else this.animator.play('Idle', 0.2);

        this.animator.update(dt);
    }
}
