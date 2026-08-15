import { buildFriend, CharacterAnimator, applyLocomotion } from './builders.js';

export class Friend {
    constructor(parent, variant = 0) {
        const scene = parent.getScene ? parent.getScene() : parent;
        const built = buildFriend(scene, variant);
        this.root = built.root;
        this.animator = new CharacterAnimator(built.root, built.clips);
        this.root.parent = parent;
    }

    update(dt) {
        this.animator.update(dt);
    }
}
