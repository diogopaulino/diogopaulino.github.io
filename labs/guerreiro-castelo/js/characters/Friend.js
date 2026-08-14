import { buildFriend, CharacterAnimator, applyLocomotion } from './builders.js';
import { FollowerAI } from '../ai/FollowerAI.js';

export class Friend {
    constructor(parent, variant = 0, offset = { x: 0.8, z: -0.8 }) {
        const built = buildFriend(variant);
        this.root = built.group;
        this.animator = new CharacterAnimator(built.group, built.clips);
        parent.add(this.root);
        this.ai = new FollowerAI(this.root, offset);
    }

    update(dt, player) {
        this.ai.update(dt, player);
        applyLocomotion(this.animator, this.ai.speed, false, true, false, false, false);
        this.animator.update(dt);
    }
}
