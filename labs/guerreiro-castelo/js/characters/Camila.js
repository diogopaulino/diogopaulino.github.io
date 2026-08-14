import * as THREE from 'three';
import { buildCamila, CharacterAnimator, applyLocomotion } from './builders.js';
import { PrincessAI } from '../ai/PrincessAI.js';
import { angleDamp } from '../utils/math.js';

export class Camila {
    constructor(scene) {
        const built = buildCamila();
        this.root = built.group;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.group, built.clips);
        scene.add(this.root);
        this.position = new THREE.Vector3();
        this.facing = 0;
        this.ai = new PrincessAI(this);
        this.freed = false;
        this.shackled = true;
        this.active = false;
        this.root.visible = false;
        this.speed = 0;
    }

    spawn(x, y, z) {
        this.position.set(x, y, z);
        this.root.position.copy(this.position);
        this.root.visible = true;
        this.active = true;
        this.ai.reset();
    }

    setShackles(on) {
        this.shackled = on;
        if (this.parts.shackles) this.parts.shackles.visible = on;
    }

    attachTo(parent) {
        if (this.root.parent) this.root.parent.remove(this.root);
        parent.add(this.root);
    }

    update(dt, game) {
        if (!this.active) return;
        this.ai.update(dt, game);
        this.facing = angleDamp(this.facing, this.ai.facing, 8, dt);
        this.root.position.copy(this.position);
        this.root.rotation.y = this.facing;
        applyLocomotion(this.animator, this.speed, false, true, false, false, false);
        if (this.ai.state === 'HIDE' || this.ai.state === 'SCARED') this.animator.play('Idle');
        this.animator.update(dt);
    }
}
