/**
 * Vehicle dynamics — single-track bicycle model with simplified Pacejka tyres,
 * speed-dependent downforce, longitudinal weight transfer, 8-speed gearbox and
 * ERS/DRS. Tuned for arcade-satisfying feel with real grip/weight feedback
 * (Crazy Grand Prix style: accessible, weighty, not a hardcore sim).
 */

import { COMPOUNDS } from './config.js';

const G = 9.81;
const RHO = 1.225;

const SPEC = {
    mass: 798,
    wheelbase: 3.6,
    frontAxle: 1.62,
    rearAxle: 1.98,
    cgHeight: 0.32,
    yawInertia: 1150,
    wheelRadius: 0.36,
    clA: 4.8,
    cdA: 1.22,
    maxPower: 620000,
    maxTorqueForce: 22000,
    brakeForce: 42000,
    maxSteer: 0.36,
    ersCapacity: 4.0,
    ersDeployRate: 0.42,
    ersHarvestRate: 0.58,
    gears: [24, 18, 14.5, 12, 10.2, 8.8, 7.6, 6.4],
    idleRpm: 4200,
    redline: 15000,
    shiftUpRpm: 14350,
    shiftDownRpm: 8200
};

/** Surface grip multipliers: asphalt, kerb, runoff, gravel, grass. */
const SURFACE_GRIP = [1.0, 0.92, 0.82, 0.48, 0.38];
const SURFACE_DRAG = [0, 280, 520, 5200, 3100];

const BASE_MU = 1.78;
const ROLLING_COEFF = 0.0135;

/** Simplified Pacejka: lateral force coefficient for a slip angle (radians). */
function tyreCurve(slip, sharpness = 10.5, shape = 1.48, peak = 1) {
    return peak * Math.sin(shape * Math.atan(sharpness * slip));
}

function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

function sign(v) {
    return v < 0 ? -1 : 1;
}

export class Vehicle {
    constructor({ circuit, team, driver, compound = 'soft', weather, isPlayer = false, skill = 1 }) {
        this.circuit = circuit;
        this.team = team;
        this.driver = driver || team?.name || 'Pilot';
        this.isPlayer = isPlayer;
        this.skill = skill;
        this.weather = weather;
        this.compound = COMPOUNDS[compound] || COMPOUNDS.medium;

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
        this.gear = 1;
        this.rpm = SPEC.idleRpm;
        this.speed = 0;

        this.drsOpen = false;
        this.drsAvailable = false;
        this.ers = SPEC.ersCapacity;
        this.ersActive = false;
        this.tyreWear = 0;
        this.tyreTemp = 55;

        this.trackIndex = 0;
        this.lapDistance = 0;
        this.lateral = 0;
        this.surface = 0;
        this.offTrack = false;
        this.slip = 0;
        this.wheelSpin = 0;
        this.lockUp = 0;
        this.wheelAngle = 0;
        this.suspension = 0;
        this.airborne = 0;

        this.lap = 0;
        this.lapStart = 0;
        this.lastLap = 0;
        this.bestLap = 0;
        this.sectorTimes = [0, 0, 0];
        this.totalDistance = 0;
        this.finished = false;
        this.finishTime = 0;
        this.position_ = 1;
        this.impulse = { x: 0, z: 0 };
        this.shiftCooldown = 0;
        this.lastAccel = 0;
        this.verticalSpeed = 0;
    }

    placeOnGrid(slot) {
        const circuit = this.circuit;
        const back = 12 + slot * 9;
        const distance = (circuit.length - back) % circuit.length;
        const index = circuit.indexAt(distance);
        const side = slot % 2 === 0 ? -1 : 1;
        const lateral = side * circuit.halfWidth * 0.42;

        this.trackIndex = index;
        this.position.x = circuit.cx[index] + circuit.nx[index] * lateral;
        this.position.z = circuit.cz[index] + circuit.nz[index] * lateral;
        this.position.y = circuit.heightAt(index, lateral);
        this.yaw = circuit.heading[index];
        this.lateral = lateral;
        this.lapDistance = distance;
        this.vx = this.vz = this.yawRate = 0;
        this.speed = 0;
        this.gear = 1;
        this.rpm = SPEC.idleRpm;
        this.lap = 0;
        this.totalDistance = -back;
        this.gridSlot = slot;
        this.tyreTemp = 55;
        this.tyreWear = 0;
        this.ers = SPEC.ersCapacity;
    }

    recover() {
        const circuit = this.circuit;
        const i = this.trackIndex;
        const lateral = circuit.lineOffset[i];
        this.position.x = circuit.cx[i] + circuit.nx[i] * lateral;
        this.position.z = circuit.cz[i] + circuit.nz[i] * lateral;
        this.position.y = circuit.heightAt(i, lateral);
        this.yaw = circuit.heading[i];
        this.vx = Math.min(this.vx, 22);
        this.vz = 0;
        this.yawRate = 0;
    }

    get downforce() {
        const drsLoss = this.drsOpen ? 0.78 : 1;
        return 0.5 * RHO * SPEC.clA * drsLoss * this.vx * this.vx;
    }

    /** Effective friction: compound, wear, temperature, weather, surface, track bias. */
    get gripLevel() {
        const wear = 1 - this.tyreWear * 0.32;
        const temp = 0.78 + 0.22 * clamp((this.tyreTemp - 35) / 55, 0, 1.1);
        const surface = SURFACE_GRIP[this.surface] ?? 1;
        return BASE_MU * this.compound.grip * wear * temp * this.weather.grip
            * surface * (this.circuit.def.gripBias || 1);
    }

    engineForce() {
        const ratio = SPEC.gears[this.gear - 1];
        const wheelRpm = (Math.abs(this.vx) / (2 * Math.PI * SPEC.wheelRadius)) * 60;
        const rpm = clamp(wheelRpm * ratio, SPEC.idleRpm, SPEC.redline);
        this.rpm = rpm;

        const norm = rpm / SPEC.redline;
        const curve = clamp(0.38 + 1.42 * norm - 0.78 * norm * norm, 0, 1.08);
        const limiter = rpm >= SPEC.redline - 60 ? 0.2 : 1;

        const force = (SPEC.maxTorqueForce / (SPEC.gears[0] / ratio)) * curve * limiter;
        const powerCap = this.vx > 1 ? SPEC.maxPower / Math.abs(this.vx) : Infinity;
        return Math.min(force, powerCap);
    }

    autoShift(dt) {
        this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);
        if (this.shiftCooldown > 0) return;
        if (this.rpm > SPEC.shiftUpRpm && this.gear < SPEC.gears.length && this.throttle > 0.2) {
            this.gear++;
            this.shiftCooldown = 0.11;
            this.justShifted = 1;
        } else if (this.rpm < SPEC.shiftDownRpm && this.gear > 1) {
            this.gear--;
            this.shiftCooldown = 0.11;
        }
    }

    /**
     * @param {number} dt seconds
     * @param {{throttle:number, brake:number, steer:number, ers:boolean, assists?:boolean}} input
     */
    update(dt, input) {
        const circuit = this.circuit;
        const assists = input.assists !== false;

        this.throttle = clamp(input.throttle, 0, 1);
        this.brake = clamp(input.brake, 0, 1);
        const steerTarget = clamp(input.steer, -1, 1);

        // Speed-sensitive steering lock — high-speed stability like a real F1 rack.
        const speedFactor = clamp(1 - Math.abs(this.vx) / 145, 0.28, 1);
        const maxSteer = SPEC.maxSteer * speedFactor;
        const steerRate = assists ? 10.5 : 14.5;
        this.steer += (steerTarget * maxSteer - this.steer) * Math.min(1, steerRate * dt);

        this.autoShift(dt);

        /* --- track location ----------------------------------------- */
        const located = circuit.locate(this.position.x, this.position.z, this.trackIndex);
        this.trackIndex = located.index;
        this.lateral = located.lateral;
        const previousDistance = this.lapDistance;
        this.lapDistance = located.distance;
        let delta = this.lapDistance - previousDistance;
        if (delta > circuit.length * 0.5) delta -= circuit.length;
        if (delta < -circuit.length * 0.5) delta += circuit.length;
        this.totalDistance += delta;

        this.surface = circuit.surfaceAt(this.lateral, this.trackIndex);
        this.wide = this.surface >= 2;
        this.offTrack = this.surface >= 3;

        /* --- aero + normal load ------------------------------------- */
        const aeroDown = this.downforce;
        const staticLoad = SPEC.mass * G;
        const normalLoad = staticLoad + aeroDown;

        // Longitudinal weight transfer for braking dive / accel squat.
        const axGuess = this.lastAccel || 0;
        const transfer = clamp((SPEC.cgHeight / SPEC.wheelbase) * SPEC.mass * axGuess, -0.35 * staticLoad, 0.35 * staticLoad);
        const frontLoad = normalLoad * (SPEC.rearAxle / SPEC.wheelbase) - transfer;
        const rearLoad = normalLoad * (SPEC.frontAxle / SPEC.wheelbase) + transfer;

        const mu = this.gripLevel;
        const frontGrip = Math.max(400, frontLoad * mu);
        const rearGrip = Math.max(400, rearLoad * mu);
        const totalGrip = frontGrip + rearGrip;

        /* --- longitudinal forces ------------------------------------ */
        let drive = 0;
        this.wheelSpin = 0;
        this.lockUp = 0;

        if (this.throttle > 0) {
            drive = this.engineForce() * this.throttle;
            // ERS: ~120 kW hybrid boost — strong but not pure nitro.
            if (this.ersActive && this.ers > 0) {
                const boost = Math.min(120000 / Math.max(8, Math.abs(this.vx)), 8500);
                drive += boost;
                this.ers = Math.max(0, this.ers - SPEC.ersDeployRate * dt);
                if (this.ers <= 0) this.ersActive = false;
            }

            // Traction limit at the driven (rear) axle.
            if (drive > rearGrip) {
                this.wheelSpin = clamp((drive - rearGrip) / rearGrip, 0, 1.4);
                drive = rearGrip * (assists ? 0.96 : 0.88);
            }
        } else if (this.brake > 0.05) {
            this.ers = Math.min(SPEC.ersCapacity, this.ers + SPEC.ersHarvestRate * this.brake * dt);
        }

        let braking = this.brake * SPEC.brakeForce;
        // Brake force also scales with aero load (more downforce = shorter stopping).
        braking *= 0.72 + 0.28 * clamp(normalLoad / (staticLoad * 3.2), 0, 1.4);
        if (braking > totalGrip * 1.05) {
            this.lockUp = clamp((braking - totalGrip) / totalGrip, 0, 1);
            braking = totalGrip * (assists ? 0.98 : 0.9);
        }

        const dragCd = SPEC.cdA * (this.drsOpen ? 0.52 : 1);
        const drag = 0.5 * RHO * dragCd * this.vx * Math.abs(this.vx);
        const surfaceDrag = SURFACE_DRAG[this.surface] ?? 0;
        const rolling = ROLLING_COEFF * normalLoad * sign(this.vx || 1)
            + surfaceDrag * sign(this.vx || 1) * clamp(Math.abs(this.vx) / 40, 0.2, 1.5);

        const slope = circuit.slope[this.trackIndex];
        const gravityPull = SPEC.mass * G * -slope;

        // Apply pending collision impulse in body frame.
        if (this.impulse.x || this.impulse.z) {
            const sinYaw = Math.sin(this.yaw);
            const cosYaw = Math.cos(this.yaw);
            this.vx += this.impulse.x * sinYaw + this.impulse.z * cosYaw;
            this.vz += this.impulse.x * cosYaw - this.impulse.z * sinYaw;
            this.impulse.x = 0;
            this.impulse.z = 0;
        }

        let fx = drive - braking * sign(this.vx || 1) - drag - rolling + gravityPull;
        this.lastAccel = fx / SPEC.mass;

        this.vx += (fx / SPEC.mass) * dt;
        if (this.brake > 0.15 && this.vx < 0.8 && this.vx > -0.5) {
            this.vx = Math.max(0, this.vx - 18 * dt);
        }
        this.vx = clamp(this.vx, -14, 98);

        /* --- lateral bicycle / Pacejka ------------------------------ */
        const speed = Math.max(1.2, Math.abs(this.vx));
        // Slip angles at each axle.
        const beta = Math.atan2(this.vz, speed);
        const yawTerm = this.yawRate;
        const frontSlip = this.steer - beta - (SPEC.frontAxle * yawTerm) / speed;
        const rearSlip = -beta + (SPEC.rearAxle * yawTerm) / speed;

        const frontLat = frontGrip * tyreCurve(frontSlip);
        const rearLat = rearGrip * tyreCurve(rearSlip);

        // Combined-slip ellipse: reduce lateral when using lots of long. force.
        const longDemand = Math.abs(drive - braking * sign(this.vx || 1)) / Math.max(1, totalGrip);
        const latScale = Math.sqrt(Math.max(0.2, 1 - clamp(longDemand, 0, 0.95) ** 2));
        const FyF = frontLat * latScale;
        const FyR = rearLat * latScale;

        // Assist: gently bleed lateral velocity when near the limit.
        if (assists && Math.abs(this.vz) > 4.5) {
            this.vz *= Math.exp(-dt * 1.8);
        }

        const Fy = FyF + FyR;
        this.vz += (Fy / SPEC.mass - this.vx * this.yawRate) * dt;

        const yawMoment = SPEC.frontAxle * FyF - SPEC.rearAxle * FyR;
        this.yawRate += (yawMoment / SPEC.yawInertia) * dt;

        // Soft kinematic blend at very low speed so parking doesn't spin forever.
        if (Math.abs(this.vx) < 3.5) {
            const turnRadius = SPEC.wheelbase / Math.tan(this.steer || 0.001);
            const kinYaw = this.vx / turnRadius;
            this.yawRate += (kinYaw - this.yawRate) * Math.min(1, 8 * dt);
            this.vz *= Math.exp(-dt * 6);
        }

        // Damp residual yaw / lateral for arcade composure.
        this.yawRate *= Math.exp(-dt * (assists ? 1.15 : 0.55));
        this.vz *= Math.exp(-dt * (assists ? 0.85 : 0.35));

        this.yaw += this.yawRate * dt;
        this.speed = Math.hypot(this.vx, this.vz);

        // Slip metric for HUD / FX / audio (0 = glued, 1+ = sliding).
        const peakSlip = Math.max(Math.abs(frontSlip), Math.abs(rearSlip));
        this.slip = clamp(peakSlip / 0.18 + this.wheelSpin * 0.45 + this.lockUp * 0.55, 0, 2.2);

        /* --- integrate position ------------------------------------- */
        const sinYaw = Math.sin(this.yaw);
        const cosYaw = Math.cos(this.yaw);
        this.position.x += (this.vx * sinYaw + this.vz * cosYaw) * dt;
        this.position.z += (this.vx * cosYaw - this.vz * sinYaw) * dt;

        const groundY = circuit.heightAt(this.trackIndex, clamp(this.lateral, -60, 60));
        const drop = this.position.y - groundY;
        if (drop > 0.06) {
            this.airborne = Math.min(1, this.airborne + dt * 2.2);
            this.verticalSpeed -= G * dt;
        } else {
            this.airborne *= Math.exp(-dt * 5);
            this.verticalSpeed = 0;
        }
        this.position.y += this.verticalSpeed * dt;
        this.position.y += (groundY - this.position.y) * Math.min(1, 16 * dt);
        this.suspension = clamp(-drop * 0.45, -0.06, 0.05);

        if (this.surface === 1) {
            this.suspension += Math.sin(this.totalDistance * 7.5) * 0.028;
        }

        /* --- attitude ----------------------------------------------- */
        const targetPitch = clamp(-slope * 0.95 - (fx / SPEC.mass) * 0.007, -0.32, 0.32);
        this.pitch += (targetPitch - this.pitch) * Math.min(1, 7 * dt);
        const latLoad = clamp(this.vz * 0.012 + this.yawRate * this.vx * 0.0008, -0.18, 0.18);
        const targetRoll = clamp(circuit.bank[this.trackIndex] + latLoad, -0.22, 0.22);
        this.roll += (targetRoll - this.roll) * Math.min(1, 7 * dt);

        /* --- wheels + tyre state ------------------------------------ */
        this.wheelAngle += (this.vx / SPEC.wheelRadius) * dt;

        // Thermal: warm with slip/load while moving, cool when coasting/stopped.
        if (Math.abs(this.vx) > 8) {
            const heat = (this.slip * 18 + Math.abs(this.throttle) * 3.5 + Math.abs(this.brake) * 5)
                * this.compound.warmup;
            const cool = 7 + (this.weather.id === 'wet' ? 4 : 0) + Math.abs(this.vx) * 0.04;
            this.tyreTemp += (heat - cool) * dt;
        } else {
            this.tyreTemp += (62 - this.tyreTemp) * Math.min(1, 0.55 * dt);
        }
        this.tyreTemp = clamp(this.tyreTemp, 35, 118);

        // Wear accumulates with slip energy and compound aggressiveness.
        if (Math.abs(this.vx) > 6) {
            const wearRate = (0.0007 + this.slip * 0.0038) * this.compound.wear
                * (this.offTrack ? 2.2 : 1);
            this.tyreWear = clamp(this.tyreWear + wearRate * dt, 0, 1);
        }

        return delta;
    }

    /** Contact response with momentum exchange. */
    static resolveContact(a, b) {
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distance = Math.hypot(dx, dz);
        const minDistance = 3.35;
        if (distance > minDistance || distance < 1e-4) return 0;

        const nx = dx / distance;
        const nz = dz / distance;
        const overlap = (minDistance - distance) * 0.55;

        a.position.x -= nx * overlap;
        a.position.z -= nz * overlap;
        b.position.x += nx * overlap;
        b.position.z += nz * overlap;

        const av = a.worldVelocity();
        const bv = b.worldVelocity();
        const closing = (bv.x - av.x) * nx + (bv.z - av.z) * nz;
        if (closing >= 0) return 0;

        // Elastic-ish impulse shared between both cars.
        const restitution = 0.35;
        const impulse = -(1 + restitution) * closing * 0.5;
        a.impulse.x -= nx * impulse;
        a.impulse.z -= nz * impulse;
        b.impulse.x += nx * impulse;
        b.impulse.z += nz * impulse;

        // Immediate body-frame scrub so contact feels snappy this frame.
        const aSin = Math.sin(a.yaw), aCos = Math.cos(a.yaw);
        const bSin = Math.sin(b.yaw), bCos = Math.cos(b.yaw);
        a.vx -= (nx * impulse) * aSin + (nz * impulse) * aCos;
        a.vz -= (nx * impulse) * aCos - (nz * impulse) * aSin;
        b.vx += (nx * impulse) * bSin + (nz * impulse) * bCos;
        b.vz += (nx * impulse) * bCos - (nz * impulse) * bSin;

        return Math.abs(closing);
    }

    worldVelocity() {
        const sinYaw = Math.sin(this.yaw);
        const cosYaw = Math.cos(this.yaw);
        return {
            x: this.vx * sinYaw + this.vz * cosYaw,
            z: this.vx * cosYaw - this.vz * sinYaw
        };
    }

    clampToTrack() {
        const circuit = this.circuit;
        const limit = circuit.halfWidth * circuit.widthScale[this.trackIndex] + 14.6;
        if (Math.abs(this.lateral) <= limit) return 0;

        const i = this.trackIndex;
        const side = Math.sign(this.lateral);
        const clamped = side * limit;
        this.position.x = circuit.cx[i] + circuit.nx[i] * clamped;
        this.position.z = circuit.cz[i] + circuit.nz[i] * clamped;
        this.lateral = clamped;

        const hit = Math.abs(this.vz) + Math.abs(this.vx) * 0.28;
        this.vx *= 0.52;
        this.vz *= -0.35;
        this.yawRate *= 0.25;
        return hit;
    }
}

export { SPEC as VEHICLE_SPEC };
