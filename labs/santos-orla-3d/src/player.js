/**
 * Avatar caminhando pela orla — colisão suave com canais e limites da faixa.
 */

import { ORLA_HALF, CANALS, WALK, ZONES } from './config.js';
import { clamp } from './utils.js';

export class Player {
    constructor() {
        this.x = -100; // Gonzaga
        this.z = WALK.pathZ;
        this.yaw = 0;
        this.pitch = -0.05;
        this.speed = 0;
    }

    reset(landmarkX = -100) {
        this.x = landmarkX;
        this.z = WALK.pathZ;
        this.yaw = 0;
        this.pitch = -0.05;
        this.speed = 0;
    }

    update(dt, input, locked = false) {
        if (locked) return;

        this.yaw += input.turn * WALK.turnSpeed * dt;
        this.pitch = clamp(this.pitch + input.lookY * 0.9 * dt, -0.55, 0.35);

        const run = input.run ? WALK.runMult : 1;
        const forward = input.forward;
        const strafe = input.strafe;
        const len = Math.hypot(forward, strafe) || 1;
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        const rx = Math.cos(this.yaw);
        const rz = -Math.sin(this.yaw);

        const vx = ((fx * forward + rx * strafe) / len) * WALK.speed * run;
        const vz = ((fz * forward + rz * strafe) / len) * WALK.speed * run;

        let nx = this.x + vx * dt;
        let nz = this.z + vz * dt;

        nz = clamp(nz, ZONES.avenue + 1, ZONES.sandInner - 1);
        nx = clamp(nx, -ORLA_HALF + 8, ORLA_HALF - 8);

        for (const c of CANALS) {
            const half = c.width * 0.5 + 1.2;
            if (Math.abs(nx - c.x) < half) {
                const onBridge = nz < ZONES.avenue + 3 && nz > ZONES.avenue - 5;
                if (!onBridge) {
                    nx = nx < c.x ? c.x - half : c.x + half;
                }
            }
        }

        this.x = nx;
        this.z = nz;
        this.speed = Math.hypot(vx, vz);
    }
}
