/** IA de pista — ponto à frente, curva e rubber-band. */

import { clamp, angleDelta } from './utils.js';

export class AiDriver {
    constructor(vehicle, skill = 0.85) {
        this.vehicle = vehicle;
        this.skill = skill;
        this.lookAhead = 14 + skill * 10;
    }

    step(track, player) {
        const v = this.vehicle;
        const look = v.lapDistance + this.lookAhead + Math.abs(v.vx) * 0.35;
        const lane = clamp(-v.lateral * 0.35, -2.2, 2.2);
        const target = track.poseAtDistance(look, lane);
        const dx = target.x - v.x;
        const dz = target.z - v.z;
        const desiredYaw = Math.atan2(dx, dz);
        const err = angleDelta(v.yaw, desiredYaw);

        const steer = clamp(err * (1.6 + this.skill), -1, 1);
        const targetSpeed = track.targetSpeed(v.trackIndex, this.skill);

        const gap = player.totalDistance - v.totalDistance;
        let speedBias = 1;
        if (gap > 40) speedBias = 1.12;
        else if (gap < -55) speedBias = 0.88;

        const speed = Math.abs(v.vx);
        const want = targetSpeed * speedBias;
        let throttle = 0;
        let brake = 0;
        if (speed < want - 2) throttle = 1;
        else if (speed > want + 4) brake = clamp((speed - want) / 18, 0, 1);
        else throttle = 0.45;

        if (Math.abs(err) > 0.55) {
            throttle *= 0.45;
            brake = Math.max(brake, 0.25);
        }

        const half = track.halfWidthAt(v.trackIndex);
        if (Math.abs(v.lateral) > half * 0.72) {
            const away = -Math.sign(v.lateral || 1);
            return {
                steer: clamp(steer + away * 0.55, -1, 1),
                throttle: throttle * 0.6,
                brake: Math.max(brake, 0.15),
                handbrake: 0,
                assists: true
            };
        }

        return { steer, throttle, brake, handbrake: 0, assists: true };
    }
}
