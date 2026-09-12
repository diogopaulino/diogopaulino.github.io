/**
 * Bicycle model — Pacejka simplificado, transferência de carga,
 * câmbio automático, freio de mão e grip por superfície.
 */

import { CAR } from './config.js';
import { clamp, sgn, angleDelta } from './utils.js';

const G = 9.81;
const RHO = 1.225;

function tyreCurve(slip) {
    return Math.sin(1.42 * Math.atan(9.2 * slip));
}

export class Vehicle {
    constructor(opts = {}) {
        this.name = opts.name || 'Piloto';
        this.isPlayer = Boolean(opts.isPlayer);
        this.skill = opts.skill ?? 1;
        this.color = opts.color ?? 0xc4281c;

        this.x = 0; this.y = 0; this.z = 0;
        this.yaw = 0; this.pitch = 0; this.roll = 0;
        this.vx = 0; this.vz = 0; this.yawRate = 0;

        this.steer = 0; this.throttle = 0; this.brake = 0; this.handbrake = 0;
        this.gear = 1; this.rpm = CAR.idleRpm; this.speed = 0;
        this.shiftCooldown = 0;

        this.trackIndex = 0; this.lapDistance = 0; this.lateral = 0;
        this.totalDistance = 0; this.lap = 0; this.lastLap = 0; this.bestLap = 0;
        this.finished = false; this.finishTime = 0; this.place = 1;

        this.slip = 0; this.wheelSpin = 0; this.lockUp = 0;
        this.wheelAngle = 0; this.steerAngle = 0; this.suspension = 0;
        this.surface = 0; this.offTrack = false; this.lastAccel = 0;
        this.impulseX = 0; this.impulseZ = 0; this.alive = true;
    }

    reset(pose) {
        this.x = pose.x; this.y = pose.y; this.z = pose.z; this.yaw = pose.yaw;
        this.trackIndex = pose.trackIndex ?? 0;
        this.lapDistance = pose.lapDistance ?? 0;
        this.lateral = pose.lateral ?? 0;
        this.vx = this.vz = this.yawRate = 0;
        this.speed = 0; this.gear = 1; this.rpm = CAR.idleRpm;
        this.lap = 0; this.totalDistance = pose.totalDistance ?? 0;
        this.finished = false; this.finishTime = 0;
        this.bestLap = 0; this.lastLap = 0; this.slip = 0;
        this.alive = true; this.steer = 0; this.shiftCooldown = 0;
        this.impulseX = this.impulseZ = 0;
    }

    /**
     * @param {number} dt
     * @param {{ throttle:number, brake:number, steer:number, handbrake?:number, assists?:boolean }} input
     * @param {import('./track.js').Track} track
     */
    update(dt, input, track) {
        if (!this.alive || this.finished) return;

        const assists = input.assists !== false;
        this.throttle = clamp(input.throttle, 0, 1);
        this.brake = clamp(input.brake, 0, 1);
        this.handbrake = clamp(input.handbrake || 0, 0, 1);

        const steerTarget = clamp(input.steer, -1, 1);
        const speedFactor = clamp(1 - Math.abs(this.vx) / 72, 0.32, 1);
        const maxSteer = CAR.maxSteer * speedFactor;
        const steerRate = assists ? 9.5 : 13;
        this.steer += (steerTarget * maxSteer - this.steer) * Math.min(1, steerRate * dt);
        this.steerAngle = this.steer;

        this.autoShift(dt);

        const located = track.locate(this.x, this.z, this.trackIndex);
        this.trackIndex = located.index;
        this.lateral = located.lateral;
        const prevDist = this.lapDistance;
        this.lapDistance = located.distance;
        let delta = this.lapDistance - prevDist;
        if (delta > track.length * 0.5) delta -= track.length;
        if (delta < -track.length * 0.5) delta += track.length;
        this.totalDistance += delta;

        const half = track.halfWidthAt(this.trackIndex);
        this.offTrack = Math.abs(this.lateral) > half;
        this.surface = this.offTrack ? (Math.abs(this.lateral) > half + 6 ? 2 : 1) : 0;

        const surfaceMu = [1, 0.55, 0.32][this.surface];
        const surfaceDrag = [0, 900, 2400][this.surface];

        const staticLoad = CAR.mass * G;
        const aeroDown = 0.5 * RHO * CAR.clA * this.vx * this.vx;
        const normalLoad = staticLoad + aeroDown;
        const transfer = clamp(
            (CAR.cgHeight / CAR.wheelbase) * CAR.mass * (this.lastAccel || 0),
            -0.28 * staticLoad,
            0.28 * staticLoad
        );
        const frontLoad = Math.max(400, normalLoad * (CAR.rearAxle / CAR.wheelbase) - transfer);
        const rearLoad = Math.max(400, normalLoad * (CAR.frontAxle / CAR.wheelbase) + transfer);

        const mu = CAR.grip * surfaceMu * (0.92 + 0.08 * this.skill);
        const rearMu = mu * (1 - this.handbrake * (1 - CAR.handbrakeGrip));
        const frontGrip = frontLoad * mu;
        const rearGrip = rearLoad * rearMu;
        const totalGrip = frontGrip + rearGrip;

        let drive = 0;
        this.wheelSpin = 0;
        this.lockUp = 0;

        if (this.throttle > 0.02) {
            drive = this.engineForce() * this.throttle;
            if (drive > rearGrip) {
                this.wheelSpin = clamp((drive - rearGrip) / rearGrip, 0, 1.5);
                drive = rearGrip * (assists ? 0.95 : 0.86);
            }
        }

        let braking = this.brake * CAR.brakeForce;
        braking *= 0.75 + 0.25 * clamp(normalLoad / (staticLoad * 2.2), 0, 1.3);
        if (braking > totalGrip * 1.05) {
            this.lockUp = clamp((braking - totalGrip) / totalGrip, 0, 1);
            braking = totalGrip * (assists ? 0.97 : 0.88);
        }

        const drag = 0.5 * RHO * CAR.cdA * this.vx * Math.abs(this.vx);
        const rolling = CAR.rolling * normalLoad * sgn(this.vx || 1)
            + surfaceDrag * sgn(this.vx || 1) * clamp(Math.abs(this.vx) / 35, 0.15, 1.4);

        if (this.impulseX || this.impulseZ) {
            const s = Math.sin(this.yaw);
            const c = Math.cos(this.yaw);
            this.vx += this.impulseX * s + this.impulseZ * c;
            this.vz += this.impulseX * c - this.impulseZ * s;
            this.impulseX = 0;
            this.impulseZ = 0;
        }

        const fx = drive - braking * sgn(this.vx || 1) - drag - rolling;
        this.lastAccel = fx / CAR.mass;
        this.vx += (fx / CAR.mass) * dt;
        if (this.brake > 0.2 && this.vx < 0.6 && this.vx > -0.4) {
            this.vx = Math.max(0, this.vx - 14 * dt);
        }
        this.vx = clamp(this.vx, -12, 78);

        const speed = Math.max(1.1, Math.abs(this.vx));
        const beta = Math.atan2(this.vz, speed);
        const frontSlip = this.steer - beta - (CAR.frontAxle * this.yawRate) / speed;
        const rearSlip = -beta + (CAR.rearAxle * this.yawRate) / speed;

        const longDemand = Math.abs(drive - braking * sgn(this.vx || 1)) / Math.max(1, totalGrip);
        const latScale = Math.sqrt(Math.max(0.18, 1 - clamp(longDemand, 0, 0.95) ** 2));
        const FyF = frontGrip * tyreCurve(frontSlip) * latScale;
        const FyR = rearGrip * tyreCurve(rearSlip) * latScale;

        if (assists && Math.abs(this.vz) > 5) this.vz *= Math.exp(-dt * 1.6);

        this.vz += ((FyF + FyR) / CAR.mass - this.vx * this.yawRate) * dt;
        this.yawRate += ((CAR.frontAxle * FyF - CAR.rearAxle * FyR) / CAR.yawInertia) * dt;

        if (Math.abs(this.vx) < 3) {
            const turnRadius = CAR.wheelbase / Math.tan(this.steer || 0.001);
            this.yawRate += (this.vx / turnRadius - this.yawRate) * Math.min(1, 7 * dt);
            this.vz *= Math.exp(-dt * 5);
        }

        this.yawRate *= Math.exp(-dt * (assists ? 1.05 : 0.5));
        this.vz *= Math.exp(-dt * (assists ? 0.75 : 0.32));
        if (this.handbrake > 0.4) {
            this.yawRate += this.steer * this.handbrake * 1.8 * dt * clamp(Math.abs(this.vx) / 20, 0, 1);
            this.vz *= Math.exp(-dt * 0.2);
        }

        this.yaw += this.yawRate * dt;
        this.speed = Math.hypot(this.vx, this.vz);

        const peakSlip = Math.max(Math.abs(frontSlip), Math.abs(rearSlip));
        this.slip = clamp(peakSlip / 0.2 + this.wheelSpin * 0.5 + this.lockUp * 0.55, 0, 2.4);

        const sinYaw = Math.sin(this.yaw);
        const cosYaw = Math.cos(this.yaw);
        this.x += (this.vx * sinYaw + this.vz * cosYaw) * dt;
        this.z += (this.vx * cosYaw - this.vz * sinYaw) * dt;

        const groundY = track.heightAt(this.trackIndex, this.lateral);
        this.y += (groundY - this.y) * Math.min(1, 14 * dt);
        this.suspension = clamp(-(this.y - groundY) * 0.4, -0.05, 0.04);

        const slope = track.slopeAt(this.trackIndex);
        this.pitch += (clamp(-slope * 0.9 - this.lastAccel * 0.006, -0.28, 0.28) - this.pitch) * Math.min(1, 6 * dt);
        const latLoad = clamp(this.vz * 0.01 + this.yawRate * this.vx * 0.0007, -0.16, 0.16);
        this.roll += (latLoad - this.roll) * Math.min(1, 6 * dt);

        this.wheelAngle += (this.vx / CAR.wheelRadius) * dt;

        const limit = half + 9;
        if (Math.abs(this.lateral) > limit) {
            const side = sgn(this.lateral);
            const pose = track.sample(this.trackIndex);
            this.x = pose.x + pose.nx * side * limit;
            this.z = pose.z + pose.nz * side * limit;
            this.vx *= 0.45;
            this.vz *= -0.3;
            this.yawRate *= 0.2;
        }
    }

    engineForce() {
        const ratio = CAR.gears[this.gear - 1] * CAR.finalDrive;
        const wheelRpm = (Math.abs(this.vx) / (2 * Math.PI * CAR.wheelRadius)) * 60;
        this.rpm = clamp(wheelRpm * ratio, CAR.idleRpm, CAR.redline);
        const norm = this.rpm / CAR.redline;
        const curve = clamp(0.42 + 1.35 * norm - 0.7 * norm * norm, 0, 1.05);
        const limiter = this.rpm >= CAR.redline - 80 ? 0.15 : 1;
        return (CAR.maxPower / Math.max(8, Math.abs(this.vx) + 4)) * curve * limiter
            * (0.85 + 0.15 * this.skill);
    }

    autoShift(dt) {
        this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
        if (this.shiftCooldown > 0) return;
        if (this.rpm > CAR.shiftUpRpm && this.gear < CAR.gears.length && this.throttle > 0.15) {
            this.gear++;
            this.shiftCooldown = 0.14;
        } else if (this.rpm < CAR.shiftDownRpm && this.gear > 1) {
            this.gear--;
            this.shiftCooldown = 0.12;
        }
    }

    worldVelocity() {
        const s = Math.sin(this.yaw);
        const c = Math.cos(this.yaw);
        return { x: this.vx * s + this.vz * c, z: this.vx * c - this.vz * s };
    }

    snapToTrack(track, distance, lateral) {
        const pose = track.poseAtDistance(distance, lateral);
        this.reset({
            x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw,
            trackIndex: pose.index, lapDistance: distance, lateral,
            totalDistance: distance - track.length
        });
    }

    headingError(track) {
        return angleDelta(this.yaw, track.sample(this.trackIndex).yaw);
    }
}

export function resolveCarContact(a, b) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const min = 3.1;
    if (dist > min || dist < 1e-4) return 0;

    const nx = dx / dist;
    const nz = dz / dist;
    const overlap = (min - dist) * 0.5;
    a.x -= nx * overlap; a.z -= nz * overlap;
    b.x += nx * overlap; b.z += nz * overlap;

    const av = a.worldVelocity();
    const bv = b.worldVelocity();
    const closing = (bv.x - av.x) * nx + (bv.z - av.z) * nz;
    if (closing >= 0) return 0;

    const impulse = -(1 + 0.32) * closing * 0.5;
    a.impulseX -= nx * impulse; a.impulseZ -= nz * impulse;
    b.impulseX += nx * impulse; b.impulseZ += nz * impulse;
    return Math.abs(closing);
}
