/**
 * Companheiro Teco (Macaco) — IA de acompanhamento, ombro, escalada e interação.
 */

import { damp } from '../utils/math.js';

export const MonkeyState = {
    IDLE: 'IDLE',
    FOLLOW: 'FOLLOW',
    PERCHED: 'PERCHED',
    MOVE_TO: 'MOVE_TO',
    CLIMB: 'CLIMB',
    INTERACT: 'INTERACT',
    RETURN: 'RETURN',
    SCARED: 'SCARED',
    CELEBRATE: 'CELEBRATE'
};

export class MonkeyAI {
    constructor(teco) {
        this.teco = teco;
        this.state = MonkeyState.FOLLOW;
        this.facing = 0;
        this.target = null;
        this.path = [];
        this.pathI = 0;
        this.timer = 0;
        this.perchTimer = 0;
        this.onComplete = null;
        this.speed = 4.2;
    }

    reset() {
        this.state = MonkeyState.FOLLOW;
        this.path = [];
        this.pathI = 0;
        this.target = null;
        this.teco.onShoulder = false;
    }

    command(path, { climb = false, scared = false, celebrate = false, onComplete = null } = {}) {
        this.path = path.map((p) => p.clone ? p.clone() : new BABYLON.Vector3(p.x, p.y, p.z));
        this.pathI = 0;
        this.onComplete = onComplete;
        this.state = climb ? MonkeyState.CLIMB : MonkeyState.MOVE_TO;
        this.teco.onShoulder = false;
        this.teco.play(climb ? 'Climb' : 'Run');
        this._celebrate = celebrate;
        this._scared = scared;
    }

    update(dt, game) {
        const teco = this.teco;
        const player = game.player;
        this.timer += dt;

        if (this.state === MonkeyState.PERCHED) {
            const shoulderX = Math.cos(player.facing) * 0.22 - Math.sin(player.facing) * 0.05;
            const shoulderZ = -Math.sin(player.facing) * 0.22 - Math.cos(player.facing) * 0.05;
            teco.position.set(
                player.position.x + shoulderX,
                player.position.y + 1.52,
                player.position.z + shoulderZ
            );
            this.facing = player.facing;
            teco.play('Shoulder');
            teco.onShoulder = true;
            this.perchTimer -= dt;
            if (this.perchTimer < -8 && Math.random() < 0.002) {
                this.state = MonkeyState.FOLLOW;
                teco.onShoulder = false;
            }
            return;
        }

        if (this.state === MonkeyState.MOVE_TO || this.state === MonkeyState.CLIMB || this.state === MonkeyState.RETURN) {
            const goal = this.path[this.pathI];
            if (!goal) {
                this.state = MonkeyState.INTERACT;
                this.timer = 0;
                return;
            }
            const dx = goal.x - teco.position.x;
            const dy = goal.y - teco.position.y;
            const dz = goal.z - teco.position.z;
            const dist = Math.hypot(dx, dy, dz);
            const spd = this.state === MonkeyState.CLIMB ? 3.4 : this.speed;
            if (dist < 0.18) {
                this.pathI++;
                if (this.pathI >= this.path.length) {
                    this.state = this.state === MonkeyState.RETURN ? MonkeyState.FOLLOW : MonkeyState.INTERACT;
                    this.timer = 0;
                }
            } else {
                teco.position.x += (dx / dist) * spd * dt;
                teco.position.y += (dy / dist) * spd * dt;
                teco.position.z += (dz / dist) * spd * dt;
                this.facing = Math.atan2(dx, dz);
            }
            teco.play(this.state === MonkeyState.CLIMB ? 'Climb' : 'Run');
            return;
        }

        if (this.state === MonkeyState.INTERACT) {
            teco.play('Grab');
            if (this.timer > 0.7) {
                const cb = this.onComplete;
                this.onComplete = null;
                cb?.(game);
                if (this._scared) {
                    this.state = MonkeyState.SCARED;
                    this.timer = 0;
                    teco.play('Scared');
                } else if (this._celebrate) {
                    this.state = MonkeyState.CELEBRATE;
                    this.timer = 0;
                    teco.play('Celebrate');
                } else {
                    this.state = MonkeyState.FOLLOW;
                }
            }
            return;
        }

        if (this.state === MonkeyState.SCARED) {
            teco.play('Scared');
            if (this.timer > 1.2) this.state = MonkeyState.FOLLOW;
            return;
        }

        if (this.state === MonkeyState.CELEBRATE) {
            teco.play('Celebrate');
            if (this.timer > 1.4) this.state = MonkeyState.FOLLOW;
            return;
        }

        const dx = player.position.x - teco.position.x;
        const dz = player.position.z - teco.position.z;
        const dist = Math.hypot(dx, dz);
        const targetY = player.position.y + 0.05;

        if (dist > 1.4) {
            this.state = MonkeyState.FOLLOW;
            const spd = dist > 6 ? 7 : 4.2;
            teco.position.x += (dx / (dist || 1)) * spd * dt;
            teco.position.z += (dz / (dist || 1)) * spd * dt;
            teco.position.y = damp(teco.position.y, targetY, 8, dt);
            this.facing = Math.atan2(dx, dz);
            teco.play(dist > 5 ? 'Run' : 'Walk');
            teco.onShoulder = false;
        } else {
            teco.position.y = damp(teco.position.y, targetY, 8, dt);
            this.facing = player.facing;
            teco.play('Idle');
            this.perchTimer += dt;
            if (this.perchTimer > 7 && dist < 1.1) {
                this.state = MonkeyState.PERCHED;
                this.perchTimer = 0;
            }
        }
    }
}
