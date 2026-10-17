/**
 * Avatar esculpido caminhando pela orla — colisão suave com canais e limites da faixa.
 */

import { ORLA_HALF, CANALS, WALK, ZONES } from './config.js';
import { clamp } from './utils.js';
import { createSculptedHuman, animateSculptedHuman } from '../../shared/realism.js';

export class Player {
    constructor(scene) {
        this.x = -100; // Gonzaga
        this.z = WALK.pathZ;
        this.yaw = Math.PI * 0.5; // olhando para a Ponta da Praia (leste)
        this.pitch = -0.05;
        this.speed = 0;
        this.walkPhase = 0;
        this.mesh = this._buildMesh();
        if (scene) scene.add(this.mesh);
    }

    _buildMesh() {
        return createSculptedHuman({
            style: 'human',
            skin: 0xd4a574,
            hair: 0x2a1c12,
            hairStyle: 'short',
            shirt: 0x1e6b9e,
            pants: 0x26303d,
            shoes: 0x1e1a18,
            detailedFace: true,
            scale: 1.08
        });
    }

    reset(landmarkX = -100) {
        this.x = landmarkX;
        this.z = WALK.pathZ;
        this.yaw = Math.PI * 0.5;
        this.pitch = -0.05;
        this.speed = 0;
        this.walkPhase = 0;
        this.syncMesh(0);
    }

    syncMesh(dt = 0.016) {
        if (!this.mesh) return;
        this.mesh.position.set(this.x, 0, this.z);
        this.mesh.rotation.y = this.yaw;
        if (this.speed > 0.3) {
            this.walkPhase += dt * (this.speed * 0.95);
            animateSculptedHuman(this.mesh, this.walkPhase, Math.min(0.75, 0.35 + this.speed * 0.03));
        } else {
            animateSculptedHuman(this.mesh, 0, 0);
        }
    }

    update(dt, input, locked = false) {
        if (locked) {
            this.syncMesh(dt);
            return;
        }

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
        this.syncMesh(dt);
    }
}

