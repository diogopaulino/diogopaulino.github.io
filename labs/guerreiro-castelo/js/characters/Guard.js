import * as THREE from 'three';
import { buildGuard, CharacterAnimator, applyLocomotion } from './builders.js';
import { GuardAI } from '../ai/GuardAI.js';
import { angleDamp } from '../utils/math.js';

export class Guard {
    constructor(scene, opts = {}) {
        const built = buildGuard(opts);
        this.root = built.group;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.group, built.clips);
        scene.add(this.root);
        this.position = new THREE.Vector3();
        this.facing = 0;
        this.ai = new GuardAI(this, opts);
        this.health = 3;
        this.maxHealth = 3;
        this.alive = true;
        this.fat = Boolean(opts.fat);
        this.archer = Boolean(opts.archer);
        this.hasKeys = Boolean(opts.fat);
        this.speed = 0;
        this.hitT = 0;
    }

    spawn(x, y, z, yaw = 0) {
        this.position.set(x, y, z);
        this.facing = yaw;
        this.ai.home.set(x, y, z);
        this.ai.facing = yaw;
        this.root.position.copy(this.position);
        this.root.rotation.y = yaw;
        this.alive = true;
        this.health = this.maxHealth;
    }

    takeHit(amount = 1) {
        if (!this.alive) return;
        this.health -= amount;
        this.hitT = 0.2;
        if (this.health <= 0) {
            this.alive = false;
            this.ai.state = 'IDLE';
        }
    }

    update(dt, game) {
        if (!this.alive) {
            this.root.rotation.x = Math.min(1.4, this.root.rotation.x + dt * 3);
            return;
        }
        this.hitT = Math.max(0, this.hitT - dt);
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 8, dt);
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
        if (this.ai.state === 'SLEEP') this.animator.play('Idle');
        else applyLocomotion(this.animator, this.speed, false, true, this.ai.state === 'ATTACK', false, false);
        this.animator.update(dt);
        if (this.parts.keys) this.parts.keys.visible = this.hasKeys;
    }
}
