/**
 * Grupo que se junta à corrida depois de FOLLOWERS_AT metros.
 * Clones low-poly defasados em X/Z, mesma passada com fase distinta.
 */

import * as THREE from 'three';
import { FOLLOWERS_AT, ROAD } from './config.js';
import { createForrest } from './models.js';

export class Pack {
    constructor(scene, max) {
        this.scene = scene;
        this.runners = [];
        this.active = 0;
        for (let i = 0; i < max; i++) {
            const mesh = createForrest(THREE, { follower: true });
            mesh.visible = false;
            mesh.scale.setScalar(0.92);
            scene.add(mesh);
            this.runners.push({
                mesh,
                laneOff: (i % 3) - 1,
                back: 3.2 + i * 1.35,
                phase: i * 0.7,
                wobble: 0.15 + (i % 5) * 0.04
            });
        }
    }

    reset() {
        this.active = 0;
        for (const r of this.runners) r.mesh.visible = false;
    }

    update(dt, player, distance) {
        const want = distance < FOLLOWERS_AT
            ? 0
            : Math.min(this.runners.length, 2 + Math.floor((distance - FOLLOWERS_AT) / 420));
        if (want > this.active) this.active = want;

        for (let i = 0; i < this.runners.length; i++) {
            const r = this.runners[i];
            const on = i < this.active && player.alive;
            r.mesh.visible = on;
            if (!on) continue;
            const t = player.cycle + r.phase;
            const swing = Math.sin(t);
            const p = r.mesh.userData.parts;
            p.legs[0].leg.rotation.x = swing * 0.9;
            p.legs[1].leg.rotation.x = -swing * 0.9;
            p.arms[0].arm.rotation.x = -swing * 0.7;
            p.arms[1].arm.rotation.x = swing * 0.7;
            p.hips.position.y = Math.abs(Math.sin(t)) * 0.05;
            const x = player.x + r.laneOff * ROAD.laneW * 0.85
                + Math.sin(t * 0.35) * r.wobble;
            r.mesh.position.set(x, 0, player.z + r.back);
            r.mesh.rotation.y = Math.PI;
        }
    }
}
