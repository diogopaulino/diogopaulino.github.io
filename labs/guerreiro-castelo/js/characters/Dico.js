import { CharacterAnimator, applyLocomotion } from './builders.js';

export class Dico {
    constructor(built) {
        this.root = built.group;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.group, built.clips);
    }

    update(dt, state) {
        applyLocomotion(this.animator, state.speed || 0, state.crouch, state.grounded !== false, state.attack, state.block, state.interact);
        this.animator.update(dt);
    }
}
