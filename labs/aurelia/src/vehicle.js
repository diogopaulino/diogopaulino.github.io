/**
 * Dinâmica arcade-sim estilo Forza Horizon: bicicleta com derrapagem,
 * transferência de peso visual, câmbio e grip que quebra no handbrake.
 */

import { clamp, damp, sign, wrapAngle, saturate } from './utils.js';

const G = 9.81;
const SURFACE_GRIP = [1.0, 0.78, 0.55, 0.42];
const SURFACE_DRAG = [0, 420, 2800, 2200];

export class Vehicle {
    constructor({ road, spec, isPlayer = false }) {
        this.road = road;
        this.spec = spec;
        this.isPlayer = isPlayer;

        this.position = { x: 0, y: 0, z: 0 };
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;
        this.vx = 0;
        this.vz = 0;
        this.yawRate = 0;

        this.steer = 0;
        this.throttle = 0;
        this.brake = 0;
        this.handbrake = 0;
        this.gear = 1;
        this.rpm = spec.idle;
        this.speed = 0;
        this.slip = 0;
        this.wheelSpin = 0;
        this.wheelAngle = 0;
        this.suspension = 0;
        this.trackIndex = 0;
        this.lateral = 0;
        this.lapDistance = 0;
        this.progress = 0;
        this.surface = 0;
        this.shiftCooldown = 0;
        this.airborne = 0;
        this.verticalSpeed = 0;
        this.boost = 1;
        this.score = 0;
        this.driftScore = 0;
        this.driftChain = 0;
        this.finished = false;
    }

    spawn(distance = 12, lateral = 0) {
        const sample = this.road.sample(distance);
        this.position.x = sample.x + sample.nx * lateral;
        this.position.z = sample.z + sample.nz * lateral;
        this.position.y = sample.y;
        this.yaw = sample.heading;
        this.vx = this.vz = this.yawRate = 0;
        this.speed = 0;
        this.gear = 1;
        this.rpm = this.spec.idle;
        this.lapDistance = distance;
        this.trackIndex = sample.index;
        this.lateral = lateral;
        this.slip = 0;
        this.boost = 1;
        this.score = 0;
        this.driftScore = 0;
        this.driftChain = 0;
        this.finished = false;
    }

    recover() {
        const loc = this.road.locate(this.position.x, this.position.z, this.trackIndex);
        const sample = this.road.sample(loc.distance);
        this.position.x = sample.x;
        this.position.z = sample.z;
        this.position.y = sample.y;
        this.yaw = sample.heading;
        this.vx = this.vz = this.yawRate = 0;
        this.speed = Math.min(this.speed, 8);
        this.lateral = 0;
        this.trackIndex = sample.index;
        this.lapDistance = loc.distance;
    }

    applyMesh(mesh, dt) {
        mesh.position.set(this.position.x, this.position.y + 0.02, this.position.z);
        mesh.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
        const data = mesh.userData;
        if (!data?.wheels) return;
        this.wheelSpin += (this.speed / 0.33) * dt;
        this.wheelAngle = damp(this.wheelAngle, this.steer * 0.42, 12, dt);
        data.wheels.forEach((w, i) => {
            w.rotation.x = this.wheelSpin;
            if (i < 2) w.rotation.y = (w.position.x < 0 ? Math.PI : 0) + this.wheelAngle;
        });
        const night = data.headlights;
        if (night) {
            const on = data.lightsOn ? 1 : 0;
            for (const l of night) l.intensity = on * 6.5;
            for (const m of data.headMats) m.emissiveIntensity = 0.5 + on * 2.2;
            data.tailMat.emissiveIntensity = 0.4 + this.brake * 2.4;
        }
    }

    update(dt, input) {
        const spec = this.spec;
        const loc = this.road.locate(this.position.x, this.position.z, this.trackIndex);
        this.trackIndex = loc.index;
        this.lateral = loc.lateral;
        this.lapDistance = loc.distance;
        this.progress = loc.progress;
        this.surface = this.road.surfaceAt(loc.lateral);

        const throttle = input.throttle || 0;
        const brake = input.brake || 0;
        const handbrake = this.isPlayer ? (input.handbrake || 0) : 0;
        const steerInput = clamp(input.steer || 0, -1, 1);

        this.throttle = throttle;
        this.brake = brake;
        this.handbrake = handbrake;

        const gripMul = SURFACE_GRIP[this.surface] * spec.grip;
        const topSpeed = 52 + spec.power / 18000;
        const peakAccel = 9 + spec.power / spec.mass * 0.016;
        const speedSteer = 1 / (1 + this.speed * 0.038);
        this.steer = damp(this.steer, steerInput * spec.steer * speedSteer, 11, dt);

        const gears = spec.gears;
        const ratio = gears[clamp(this.gear - 1, 0, gears.length - 1)];
        const rpmFromSpeed = (this.speed * ratio) / (0.33 * Math.PI * 2) * 60;
        this.rpm = clamp(damp(this.rpm, Math.max(spec.idle, rpmFromSpeed), 8, dt), spec.idle, spec.redline + 200);
        this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
        if (this.shiftCooldown <= 0) {
            if (this.rpm > spec.redline * 0.94 && this.gear < gears.length) {
                this.gear += 1;
                this.shiftCooldown = 0.16;
            } else if (this.rpm < spec.redline * 0.4 && this.gear > 1) {
                this.gear -= 1;
                this.shiftCooldown = 0.12;
            }
        }

        const rpmNorm = clamp((this.rpm - spec.idle) / (spec.redline - spec.idle), 0.08, 1);
        const band = 0.55 + 0.45 * Math.sin(Math.PI * rpmNorm);
        let accel = throttle * peakAccel * band;
        accel -= brake * 32;
        accel -= handbrake * 16;
        accel -= this.speed * spec.drag * 0.35;
        accel -= SURFACE_DRAG[this.surface] / spec.mass * this.speed * 0.015;
        if (throttle < 0.05 && brake < 0.05) accel -= 3.2;

        const cap = topSpeed * (0.55 + 0.45 * gripMul);
        this.speed = clamp(this.speed + accel * dt, 0, cap);

        const driftWant = Math.abs(steerInput) * (0.12 + handbrake * 0.85) * saturate(this.speed / 18);
        this.slip = damp(this.slip, driftWant / Math.max(0.55, gripMul), 7, dt);
        this.yawRate = this.steer * this.speed * 0.24 + sign(steerInput) * this.slip * (0.9 + handbrake * 1.6);
        this.yaw = wrapAngle(this.yaw + this.yawRate * dt);

        const slipHeading = this.yaw - sign(steerInput || this.steer) * this.slip * 0.9;
        this.vx = Math.sin(slipHeading) * this.speed;
        this.vz = Math.cos(slipHeading) * this.speed;
        this.position.x += this.vx * dt;
        this.position.z += this.vz * dt;

        const ground = this.road.heightAt(loc.index, loc.lateral);
        if (this.position.y > ground + 0.7) {
            this.airborne = 1;
            this.verticalSpeed -= G * dt;
        } else {
            this.airborne = 0;
            this.verticalSpeed = (ground - this.position.y) * 8;
        }
        this.position.y += this.verticalSpeed * dt;
        if (this.position.y < ground) this.position.y = ground;

        const bank = this.road.bank[loc.index];
        this.pitch = damp(this.pitch, -accel * 0.012, 8, dt);
        this.roll = damp(this.roll, bank * 0.7 + this.steer * 0.18, 8, dt);

        if (this.slip > 0.16 && this.speed > 8) {
            this.driftChain += dt;
            this.driftScore += this.slip * this.speed * dt * 18;
        } else {
            this.driftChain = Math.max(0, this.driftChain - dt * 0.6);
        }

        if (Math.abs(loc.lateral) > 70) this.recover();
        if (this.position.y < -4) this.recover();
    }
}
