/**
 * Camila segue Dico com offset sem bloquear passagens estreitas.
 */

import { damp } from '../utils/math.js';

export class PrincessAI {
    constructor(camila) {
        this.camila = camila;
        this.state = 'WAIT';
        this.facing = 0;
        this.stuck = 0;
        this.last = new BABYLON.Vector3();
    }

    reset() {
        this.state = 'WAIT';
        this.stuck = 0;
    }

    follow() {
        this.state = 'FOLLOW';
    }

    run() {
        this.state = 'RUN';
    }

    update(dt, game) {
        const c = this.camila;
        if (this.state === 'WAIT') {
            c.speed = 0;
            const dx = game.player.position.x - c.position.x;
            const dz = game.player.position.z - c.position.z;
            this.facing = Math.atan2(dx, dz);
            return;
        }

        const p = game.player;
        const ox = Math.sin(p.facing + Math.PI) * 0.85 + Math.cos(p.facing) * -0.55;
        const oz = Math.cos(p.facing + Math.PI) * 0.85 + Math.sin(p.facing) * -0.55;
        const tx = p.position.x + ox;
        const tz = p.position.z + oz;
        const ty = p.position.y;
        const dx = tx - c.position.x;
        const dz = tz - c.position.z;
        const dist = Math.hypot(dx, dz);
        const run = this.state === 'RUN' || this.state === 'ESCAPE';
        const spd = run ? 5.6 : 3.4;

        if (dist > 1.15) {
            c.position.x += (dx / dist) * spd * dt;
            c.position.z += (dz / dist) * spd * dt;
            c.position.y = damp(c.position.y, ty, 8, dt);
            this.facing = Math.atan2(dx, dz);
            c.speed = spd;
        } else {
            c.speed = 0;
            c.position.y = damp(c.position.y, ty, 8, dt);
            this.facing = p.facing;
        }

        if (Math.hypot(c.position.x - this.last.x, c.position.z - this.last.z) < 0.01 && dist > 2) {
            this.stuck += dt;
            if (this.stuck > 1.2) {
                c.position.x = tx;
                c.position.z = tz;
                this.stuck = 0;
            }
        } else {
            this.stuck = 0;
        }
        this.last.copyFrom(c.position);
    }
}
