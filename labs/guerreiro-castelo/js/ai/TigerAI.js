/**
 * IA do Tigre na sala do castelo em Babylon.js.
 */

import { damp } from '../utils/math.js';

export class TigerAI {
    constructor(tiger) {
        this.tiger = tiger;
        this.state = 'REST';
        this.home = new BABYLON.Vector3();
        this.timer = 0;
        this.bounds = { minX: -6, maxX: 6, minZ: -6, maxZ: 6 };
    }

    reset() {
        this.state = 'REST';
        this.timer = 0;
        this.home.copyFrom(this.tiger.position);
    }

    setBounds(minX, maxX, minZ, maxZ) {
        this.bounds = { minX, maxX, minZ, maxZ };
    }

    update(dt, game) {
        const t = this.tiger;
        this.timer += dt;
        const teco = game.teco;
        const tecoBusy = teco.ai.state === 'CLIMB' || teco.ai.state === 'MOVE_TO' || teco.ai.state === 'INTERACT';

        if (this.state === 'REST') {
            t.animator.play('Idle');
            if (this.timer > 0.4) {
                this.state = 'WATCH';
                t.animator.play('Growl');
                game.audio?.play('growl');
            }
            return;
        }

        if (this.state === 'WATCH' || this.state === 'THREATEN') {
            const dx = game.player.position.x - t.position.x;
            const dz = game.player.position.z - t.position.z;
            t.facing = Math.atan2(dx, dz);
            t.animator.play(this.state === 'THREATEN' ? 'Growl' : 'Idle');
            if (tecoBusy) {
                this.state = 'TRACK_TECO';
                this.timer = 0;
            }
            return;
        }

        if (this.state === 'TRACK_TECO') {
            const dx = teco.position.x - t.position.x;
            const dz = teco.position.z - t.position.z;
            t.facing = Math.atan2(dx, dz);
            const nx = t.position.x + Math.sin(t.facing) * 2.2 * dt;
            const nz = t.position.z + Math.cos(t.facing) * 2.2 * dt;
            t.position.x = Math.min(this.bounds.maxX, Math.max(this.bounds.minX, nx));
            t.position.z = Math.min(this.bounds.maxZ, Math.max(this.bounds.minZ, nz));
            t.animator.play('Walk');
            if (teco.position.y > t.position.y + 1.4 && this.timer > 0.5) {
                this.state = 'JUMP';
                this.timer = 0;
                t.animator.play('Jump');
            }
            if (!tecoBusy && this.timer > 0.8) this.state = 'RETURN';
            return;
        }

        if (this.state === 'JUMP') {
            t.position.y = this.home.y + Math.sin(Math.min(1, this.timer / 0.45) * Math.PI) * 1.1;
            if (this.timer > 0.5) {
                t.position.y = this.home.y;
                this.state = 'TRACK_TECO';
                this.timer = 0;
            }
            return;
        }

        if (this.state === 'RETURN') {
            t.position.x = damp(t.position.x, this.home.x, 3, dt);
            t.position.z = damp(t.position.z, this.home.z, 3, dt);
            t.animator.play('Walk');
            if (Math.hypot(t.position.x - this.home.x, t.position.z - this.home.z) < 0.2) {
                this.state = 'WATCH';
            }
        }
    }
}
