/**
 * AI drivers. Each one follows the pre-solved racing line with a pure-pursuit
 * steering controller, brakes to the circuit's speed profile using a look-ahead
 * search, and adds a lateral offset to defend or overtake.
 */

import { AERO_REFERENCE } from './circuits.js';

const LOOKAHEAD_MIN = 14;
const LOOKAHEAD_MAX = 52;

function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

export class AIDriver {
    constructor(vehicle, { difficulty, seed = 1 }) {
        this.vehicle = vehicle;
        this.difficulty = difficulty;
        this.seed = seed;
        this.offset = 0;
        this.offsetTarget = 0;
        this.noisePhase = seed * 7.3;
        this.mistakeTimer = 0;
        this.mistake = 0;
        // Small per-driver personality so the field is not a train.
        this.personality = {
            pace: 0.975 + ((seed * 37) % 41) / 800,
            bravery: 0.85 + ((seed * 53) % 31) / 100,
            lineBias: (((seed * 17) % 21) - 10) / 22
        };
    }

    /** Cars close enough ahead to matter for this decision. */
    scanAhead(rivals) {
        const me = this.vehicle;
        const circuit = me.circuit;
        let nearest = null;
        let nearestGap = Infinity;

        for (const other of rivals) {
            if (other === me) continue;
            let gap = other.lapDistance - me.lapDistance;
            if (gap < -circuit.length * 0.5) gap += circuit.length;
            if (gap > circuit.length * 0.5) gap -= circuit.length;
            if (gap <= 0 || gap > 46) continue;
            if (gap < nearestGap) {
                nearestGap = gap;
                nearest = other;
            }
        }
        return { car: nearest, gap: nearestGap };
    }

    update(dt, rivals, raceState) {
        const me = this.vehicle;
        const circuit = me.circuit;
        const diff = this.difficulty;
        const speed = Math.max(0, me.vx);

        /* --- mistakes ------------------------------------------------ */
        this.mistakeTimer -= dt;
        if (this.mistakeTimer <= 0) {
            this.mistakeTimer = 3 + Math.random() * 7;
            this.mistake = Math.random() < diff.error * 6 ? (Math.random() - 0.5) * 2 : 0;
        }
        this.mistake *= Math.exp(-dt * 1.5);

        /* --- where to aim -------------------------------------------- */
        const lookaheadDistance = clamp(speed * 0.62, LOOKAHEAD_MIN, LOOKAHEAD_MAX);
        const aheadIndex = circuit.indexAt(me.lapDistance + lookaheadDistance);

        const ahead = this.scanAhead(rivals);
        let desiredOffset = circuit.lineOffset[aheadIndex] + this.personality.lineBias;

        if (ahead.car) {
            const closing = me.vx - ahead.car.vx;
            const room = circuit.halfWidth * circuit.widthScale[aheadIndex] - 2.2;
            if (closing > 1.5 && ahead.gap < 32) {
                // Pick the side with more room and commit to it.
                const side = ahead.car.lateral > 0 ? -1 : 1;
                desiredOffset = clamp(ahead.car.lateral + side * 3.4, -room, room);
                this.overtaking = 1;
            } else if (ahead.gap < 12) {
                desiredOffset = clamp(ahead.car.lateral - Math.sign(ahead.car.lateral || 1) * 3.2, -room, room);
            }
        } else {
            this.overtaking = Math.max(0, (this.overtaking || 0) - dt);
        }

        this.offsetTarget += (desiredOffset - this.offsetTarget) * Math.min(1, dt * 2.4);
        const targetLateral = this.offsetTarget + this.mistake * 1.6 * (1 - diff.reaction);

        const targetX = circuit.cx[aheadIndex] + circuit.nx[aheadIndex] * targetLateral;
        const targetZ = circuit.cz[aheadIndex] + circuit.nz[aheadIndex] * targetLateral;

        /* --- steering: pure pursuit ---------------------------------- */
        const dx = targetX - me.position.x;
        const dz = targetZ - me.position.z;
        // World -> car frame: forward is (sin yaw, cos yaw), right is (cos yaw, -sin yaw).
        const sin = Math.sin(me.yaw);
        const cos = Math.cos(me.yaw);
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;

        // Pure pursuit: the arc through the look-ahead point has curvature 2x/L².
        // Feeding the required steering *angle* (rather than a raw error gain) is what
        // keeps the loop stable at 300 km/h, where a degree of lock is a lot of yaw.
        const lookLength = Math.max(6, Math.hypot(localX, localZ));
        const curvature = (2 * localX) / (lookLength * lookLength);
        const requiredSteer = Math.atan(curvature * 3.6);
        const maxSteer = 0.34 * clamp(1 - Math.abs(me.vx) / 135, 0.26, 1);
        let steer = clamp(requiredSteer / maxSteer, -1, 1);

        // Gentle counter-steer when the rear steps out.
        steer -= clamp(me.vz * 0.018, -0.16, 0.16) * diff.reaction;

        /* --- braking / throttle -------------------------------------- */
        let targetSpeed = Infinity;
        // Braking capability rises with downforce, so the usable deceleration at the
        // end of a straight is several times what it is at hairpin speed.
        const aero = 1 + Math.min(3.2, (speed * speed) / AERO_REFERENCE);
        const brakeCapacity = Math.min(1.55 * 9.81 * aero, 55) * this.personality.bravery * me.weather.grip;
        for (let k = 0; k < 110; k++) {
            const idx = circuit.indexAt(me.lapDistance + k * circuit.spacing * 1.5);
            const distance = Math.max(1, k * circuit.spacing * 1.5);
            const limit = circuit.speedProfile[idx];
            const reachable = Math.sqrt(limit * limit + 2 * brakeCapacity * distance);
            if (reachable < targetSpeed) targetSpeed = reachable;
        }
        targetSpeed *= diff.pace * this.personality.pace;
        if (me.offTrack) targetSpeed *= 0.6;
        if (raceState?.safety) targetSpeed = Math.min(targetSpeed, 24);

        // Slipstream: tuck in and use the tow on straights.
        if (ahead.car && ahead.gap < 25 && Math.abs(circuit.curvature[me.trackIndex]) < 0.004) {
            targetSpeed *= 1.03;
        }

        const error = targetSpeed - speed;
        let throttle = clamp(error * 0.35, 0, 1);
        let brake = clamp(-error * 0.22, 0, 1);

        // Do not brake and accelerate at once; feather off the kerbs.
        if (brake > 0.05) throttle = 0;
        if (me.surface === 1) throttle *= 0.9;

        // Traction-limited exit.
        if (speed < 26 && throttle > 0.6 && Math.abs(circuit.curvature[me.trackIndex]) > 0.012) {
            throttle *= 0.82 + diff.reaction * 0.16;
        }

        /* --- ERS + DRS ------------------------------------------------ */
        const onStraight = Math.abs(circuit.curvature[me.trackIndex]) < 0.0035;
        const useErs = onStraight && throttle > 0.8 && me.ers > 0.6 &&
            (this.overtaking > 0 || me.ers > 2.4 || diff.aggression > 0.85);

        return {
            throttle: clamp(throttle + this.mistake * 0.05, 0, 1),
            brake,
            steer: clamp(steer + this.mistake * 0.06 * (1 - diff.reaction), -1, 1),
            ers: useErs,
            assists: true
        };
    }
}
