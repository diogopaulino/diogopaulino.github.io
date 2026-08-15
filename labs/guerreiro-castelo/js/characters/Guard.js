/**
 * Guarda do castelo / Arqueiro para Babylon.js.
 */

import { buildGuard, CharacterAnimator } from './builders.js';
import { GuardAI } from '../ai/GuardAI.js';
import { angleDamp } from '../utils/math.js';

export class Guard {
    constructor(parentOrScene, opts = {}) {
        const scene = parentOrScene.getScene ? parentOrScene.getScene() : parentOrScene;
        const built = buildGuard(scene, opts);
        this.root = built.root;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.root, built.clips);

        if (parentOrScene.getScene) {
            this.root.parent = parentOrScene;
        }

        this.position = new BABYLON.Vector3(0, 0, 0);
        this.facing = 0;
        this.speed = 0;
        this.health = opts.health || 2;
        this.alive = true;
        this.hasKeys = Boolean(opts.fat);
        this.ai = new GuardAI(this, opts);
    }

    spawn(x, y, z, yaw = 0) {
        this.position.set(x, y, z);
        this.facing = yaw;
        this.root.position.copyFrom(this.position);
        this.root.rotation.y = this.facing;
        this.ai.home.copyFrom(this.position);
        this.ai.facing = yaw;
    }

    takeHit(amount = 1) {
        this.health -= amount;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            this.root.setEnabled(false);
        } else {
            this.ai.state = 'ATTACK';
        }
    }

    update(dt, game) {
        if (!this.alive) return;
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 8, dt);
        this.root.position.copyFrom(this.position);
        this.root.rotation.y = this.facing;

        if (this.ai.state === 'ATTACK') {
            this.animator.play('Attack', 0.1);
        } else if (this.speed > 2.5) {
            this.animator.play('Run', 0.12);
        } else if (this.speed > 0.2) {
            this.animator.play('Walk', 0.14);
        } else {
            this.animator.play('Idle', 0.2);
        }

        this.animator.update(dt);
    }
}
