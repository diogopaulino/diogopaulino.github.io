/**
 * Grupo de Seguidores que se juntam à corrida após FOLLOWERS_AT metros.
 * Inspirado no momento épico em que as pessoas começam a correr com o Forrest.
 */

import { FOLLOWERS_AT, ROAD } from './config.js';
import { createForrest } from './models.js';

export class Pack {
    constructor(scene, shadowGenerator, max = 12) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.runners = [];
        this.active = 0;

        for (let i = 0; i < max; i++) {
            const root = createForrest(scene, shadowGenerator, { follower: true });
            root.setEnabled(false);
            root.scaling.setAll(1.05);

            this.runners.push({
                root,
                laneOff: (i % 3) - 1,
                back: 3.5 + i * 1.5,
                phase: i * 0.72 + (i % 2) * 0.4,
                wobble: 0.18 + (i % 4) * 0.05
            });
        }
    }

    reset() {
        this.active = 0;
        for (const r of this.runners) {
            r.root.setEnabled(false);
        }
    }

    update(dt, player, distance) {
        const want = distance < FOLLOWERS_AT
            ? 0
            : Math.min(this.runners.length, 2 + Math.floor((distance - FOLLOWERS_AT) / 380));

        if (want > this.active) this.active = want;

        for (let i = 0; i < this.runners.length; i++) {
            const r = this.runners[i];
            const on = i < this.active && player.alive;
            r.root.setEnabled(on);
            if (!on) continue;

            const t = player.cycle + r.phase;
            const swing = Math.sin(t);
            const p = r.root.metadata.parts;

            p.legs[0].leg.rotation.x = swing * 0.95;
            p.legs[1].leg.rotation.x = -swing * 0.95;
            p.legs[0].shin.rotation.x = Math.max(0, -swing) * 0.65;
            p.legs[1].shin.rotation.x = Math.max(0, swing) * 0.65;

            p.arms[0].arm.rotation.x = -swing * 0.75;
            p.arms[1].arm.rotation.x = swing * 0.75;
            p.hips.position.y = 0.95 + Math.abs(Math.sin(t)) * 0.05;

            const x = player.x + r.laneOff * ROAD.laneW * 0.82 + Math.sin(t * 0.4) * r.wobble;
            const z = player.z + r.back;

            r.root.position.set(x, 0, z);
            r.root.rotation.y = Math.PI;
        }
    }
}
