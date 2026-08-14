/** Follower genérico para amigos do navio. */

import { damp } from '../utils/math.js';

export class FollowerAI {
    constructor(root, offset) {
        this.root = root;
        this.offset = offset;
        this.active = false;
        this.facing = 0;
        this.speed = 0;
    }

    update(dt, player) {
        if (!this.active) return;
        const tx = player.position.x + this.offset.x;
        const tz = player.position.z + this.offset.z;
        const dx = tx - this.root.position.x;
        const dz = tz - this.root.position.z;
        const dist = Math.hypot(dx, dz);
        const spd = dist > 4 ? 6 : 3.6;
        if (dist > 1.2) {
            this.root.position.x += (dx / dist) * spd * dt;
            this.root.position.z += (dz / dist) * spd * dt;
            this.root.position.y = damp(this.root.position.y, player.position.y, 8, dt);
            this.facing = Math.atan2(dx, dz);
            this.root.rotation.y = this.facing;
            this.speed = spd;
        } else this.speed = 0;
    }
}
