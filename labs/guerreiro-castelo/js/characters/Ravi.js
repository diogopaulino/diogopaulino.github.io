import { buildRavi, CharacterAnimator } from './builders.js';

export class Ravi {
    constructor(parent) {
        const built = buildRavi();
        this.root = built.group;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.group, built.clips);
        parent.add(this.root);
    }

    update(dt) {
        this.animator.update(dt);
    }
}
