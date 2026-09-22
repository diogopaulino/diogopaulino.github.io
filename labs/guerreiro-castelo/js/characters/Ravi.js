import { buildRavi, CharacterAnimator } from './builders.js?v=3';

export class Ravi {
    constructor(parent) {
        const scene = parent.getScene ? parent.getScene() : parent;
        const built = buildRavi(scene);
        this.root = built.root;
        this.parts = built.parts;
        this.animator = new CharacterAnimator(built.root, built.clips);
        this.root.parent = parent;
    }

    update(dt) {
        this.animator.update(dt);
    }
}
