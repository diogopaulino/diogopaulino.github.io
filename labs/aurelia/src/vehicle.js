/**
 * Dinâmica arcade-sim estilo Forza Horizon: bicicleta com derrapagem,
 * transferência de peso visual, câmbio e grip que quebra no handbrake.
 */

import { clamp, damp, sign, wrapAngle } from './utils.js';

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

        const throttle = this.isPlayer ? input.throttle : input.throttle;
        const brake = this.isPlayer ? input.brake : input.brake;
        const handbrake = this.isPlayer ? input.handbrake : 0;
        const steerInput = this.isPlayer ? input.steer : input.steer;

        this.throttle = throttle;
        this.brake = brake;
        this.handbrake = handbrake;

        const speedSteer = 1 / (1 + this.speed * 0.045);
        const steerTarget = steerInput * spec.steer * speedSteer;
        this.steer = damp(this.steer, steerTarget, 10, dt);

        const forwardX = Math.sin(this.yaw);
        const forwardZ = Math.cos(this.yaw);
        const rightX = Math.cos(this.yaw);
        const rightZ = -Math.sin(this.yaw);

        const vLong = this.vx * forwardX + this.vz * forwardZ;
        const vLat = this.vx * rightX + this.vz * rightZ;

        const gripMul = SURFACE_GRIP[this.surface] * (spec.grip);
        const mu = gripMul * (this.handbrake > 0.4 ? 0.42 : 1);

        const gears = spec.gears;
        const gearRatio = gears[clamp(this.gear - 1, 0, gears.length - 1)];
        const wheelR = 0.33;
        const rpmFromSpeed = Math.abs(vLong) * gearRatio / (wheelR * Math.PI * 2) * 60;
        this.rpm = clamp(damp(this.rpm, Math.max(spec.idle, rpmFromSpeed), 8, dt), spec.idle, spec.redline + 200);

        this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
        if (this.shiftCooldown <= 0) {
            if (this.rpm > spec.redline * 0.94 && this.gear < gears.length) {
                this.gear += 1;
                this.shiftCooldown = 0.18;
            } else if (this.rpm < spec.redline * 0.42 && this.gear > 1) {
                this.gear -= 1;
                this.shiftCooldown = 0.14;
            }
        }

        const rpmNorm = (this.rpm - spec.idle) / (spec.redline - spec.idle);
        const power = spec.power * (0.35 + 0.65 * Math.sin(Math.PI * clamp(rpmNorm, 0.05, 0.98)));
        const drive = (power / Math.max(6, Math.abs(vLong) + 4)) * throttle;
        const brakeForce = spec.brake * brake + (this.handbrake > 0.3 ? spec.brake * 0.55 : 0);
        const drag = 0.5 * 1.225 * spec.drag * 2.1 * vLong * Math.abs(vLong);
        const roll = 90 * sign(vLong) * Math.abs(vLong);
        const surfDrag = SURFACE_DRAG[this.surface] * vLong;

        let aLong = (drive - brakeForce * sign(vLong) - drag - roll - surfDrag) / spec.mass;
        if (throttle < 0.05 && brake < 0.05 && this.handbrake < 0.1) {
            aLong -= vLong * 0.35;
        }

        const slipAngle = Math.atan2(vLat, Math.max(4, Math.abs(vLong))) - this.steer * 0.65;
        const latForce = -Math.sin(1.35 * Math.atan(9.5 * slipAngle)) * mu * spec.mass * G;
        const aLat = latForce / spec.mass;
        this.slip = Math.abs(slipAngle);

        const yawInertia = spec.mass * 1.15;
        const yawTorque = this.steer * mu * 8200 + (-vLat * 420) + this.handbrake * steerInput * 5200;
        this.yawRate += (yawTorque / yawInertia) * dt;
        this.yawRate *= Math.exp(-dt * (2.4 + mu * 1.8));
        this.yaw = wrapAngle(this.yaw + this.yawRate * dt);

        const nForwardX = Math.sin(this.yaw);
        const nForwardZ = Math.cos(this.yaw);
        const nRightX = Math.cos(this.yaw);
        const nRightZ = -Math.sin(this.yaw);

        let nLong = vLong + aLong * dt;
        let nLat = vLat + aLat * dt;
        nLat *= Math.exp(-dt * (1.6 + mu * 2.2));
        if (this.handbrake > 0.4) nLat *= Math.exp(-dt * 0.4);

        this.vx = nLong * nForwardX + nLat * nRightX;
        this.vz = nLong * nForwardZ + nLat * nRightZ;
        this.speed = Math.hypot(this.vx, this.vz);

        this.position.x += this.vx * dt;
        this.position.z += this.vz * dt;

        const ground = this.road.heightAt(loc.index, loc.lateral);
        const targetY = ground;
        if (this.position.y > targetY + 0.6) {
            this.airborne = 1;
            this.verticalSpeed -= G * dt;
        } else {
            this.airborne = 0;
            this.verticalSpeed = (targetY - this.position.y) * 8;
        }
        this.position.y += this.verticalSpeed * dt;
        if (this.position.y < targetY) this.position.y = targetY;

        const bank = this.road.bank[loc.index];
        this.pitch = damp(this.pitch, -aLong * 0.012, 8, dt);
        this.roll = damp(this.roll, bank * 0.7 + aLat * 0.008 + this.steer * 0.12, 8, dt);
        this.suspension = damp(this.suspension, -aLong * 0.02, 10, dt);

        if (this.slip > 0.18 && this.speed > 8) {
            this.driftChain += dt;
            this.driftScore += this.slip * this.speed * dt * 18;
        } else {
            this.driftChain = Math.max(0, this.driftChain - dt * 0.6);
        }

        if (Math.abs(loc.lateral) > 42) this.recover();
        if (this.position.y < -2) this.recover();
    }
}
