/**
 * Vehicle dynamics: a single-track (bicycle) model with a simplified Pacejka tyre,
 * speed-dependent downforce, longitudinal weight transfer, an 8-speed gearbox and
 * ERS/DRS. The same class drives both the player and the AI — only the input source
 * differs.
 */

import { COMPOUNDS } from './config.js';

const G = 9.81;
const RHO = 1.225;

const SPEC = {
    mass: 798,
    wheelbase: 3.6,
    frontAxle: 1.62,        // distance CoG -> front axle
    rearAxle: 1.98,
    cgHeight: 0.32,
    yawInertia: 1150,
    wheelRadius: 0.36,
    clA: 4.6,               // downforce coefficient x area
    cdA: 1.28,
    maxPower: 660000,       // W (ICE + deployment)
    maxTorqueForce: 26000,  // N at the contact patch in first gear
    brakeForce: 42000,      // N total at full pedal
    maxSteer: 0.34,
    ersCapacity: 4.0,       // MJ
    ersDeployRate: 0.36,    // MJ/s
    ersHarvestRate: 0.55,
    gears: [24, 18, 14.5, 12, 10.2, 8.8, 7.6, 6.4],
    idleRpm: 4200,
    redline: 15000,
    shiftUpRpm: 14350,
    shiftDownRpm: 8200
};

const SURFACE_GRIP = [1, 0.94, 0.88, 0.5, 0.42];
const SURFACE_DRAG = [0, 220, 380, 4400, 2600];

/** Peak friction coefficient of a slick at operating temperature. */
const BASE_MU = 1.85;
const ROLLING_COEFF = 0.014;

/** Simplified magic formula: normalised lateral force for a slip angle. */
function tyreCurve(slip, sharpness = 9.2, shape = 1.55, peak = 1) {
    return peak * Math.sin(shape * Math.atan(sharpness * slip));
}

function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
}

export class Vehicle {
    constructor({ circuit, team, driver, compound = 'soft', weather, isPlayer = false, skill = 1 }) {
        this.circuit = circuit;
        this.team = team;
        this.driver = driver || team.name;
        this.isPlayer = isPlayer;
        this.skill = skill;
        this.weather = weather;
        this.compound = COMPOUNDS[compound] || COMPOUNDS.medium;

        this.position = { x: 0, y: 0, z: 0 };
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;
        this.vx = 0;              // body-frame longitudinal velocity
        this.vz = 0;              // body-frame lateral velocity
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
    }

    /** Places the car on the grid (staggered, alternating sides, behind the line). */
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
    }

    /** Puts a beached car back on the racing line facing the right way. */
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
        const drsLoss = this.drsOpen ? 0.82 : 1;
        return 0.5 * RHO * SPEC.clA * drsLoss * this.vx * this.vx;
    }

    /** Effective friction coefficient: compound, wear, temperature, weather and track. */
    get gripLevel() {
        const wear = 1 - this.tyreWear * 0.28;
        const temp = 0.82 + 0.18 * clamp((this.tyreTemp - 40) / 55, 0, 1.05);
        return BASE_MU * this.compound.grip * wear * temp * this.weather.grip * (this.circuit.def.gripBias || 1);
    }

    engineForce() {
        const ratio = SPEC.gears[this.gear - 1];
        const wheelRpm = (Math.abs(this.vx) / (2 * Math.PI * SPEC.wheelRadius)) * 60;
        const rpm = clamp(wheelRpm * ratio, SPEC.idleRpm, SPEC.redline);
        this.rpm = rpm;

        // Torque curve: soft below 7k, plateau to the limiter, cut at the redline.
        const norm = rpm / SPEC.redline;
        const curve = clamp(0.42 + 1.35 * norm - 0.72 * norm * norm, 0, 1.05);
        const limiter = rpm >= SPEC.redline - 60 ? 0.25 : 1;

        const force = (SPEC.maxTorqueForce / (SPEC.gears[0] / ratio)) * curve * limiter;
        const powerCap = this.vx > 1 ? SPEC.maxPower / Math.abs(this.vx) : Infinity;
        return Math.min(force, powerCap);
    }

    autoShift(dt) {
        this.shiftCooldown = Math.max(0, (this.shiftCooldown || 0) - dt);
        if (this.shiftCooldown > 0) return;
        if (this.rpm > SPEC.shiftUpRpm && this.gear < SPEC.gears.length && this.throttle > 0.2) {
            this.gear++;
            this.shiftCooldown = 0.12;
            this.justShifted = 1;
        } else if (this.rpm < SPEC.shiftDownRpm && this.gear > 1) {
            this.gear--;
            this.shiftCooldown = 0.12;
        }
    }

    /**
     * @param {number} dt seconds
     * @param {{throttle:number, brake:number, steer:number, ers:boolean}} input
     */
    update(dt, input) {
        const circuit = this.circuit;

        this.throttle = clamp(input.throttle, 0, 1);
        this.brake = clamp(input.brake, 0, 1);
        const steerTarget = clamp(input.steer, -1, 1);

        const speedFactor = clamp(1 - Math.abs(this.vx) / 135, 0.4, 1);
        const maxSteer = SPEC.maxSteer * speedFactor;
        const steerRate = 12.0;
        this.steer += (steerTarget * maxSteer - this.steer) * Math.min(1, steerRate * dt);

        this.autoShift(dt);

        /* --- surface ------------------------------------------------ */
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
        this.wide = this.surface >= 2;          // beyond the white line
        this.offTrack = this.surface >= 3;      // gravel or grass

        /* --- arcade longitudinal forces ----------------------------- */
        let drive = 0;
        if (this.throttle > 0) {
            drive = this.engineForce() * this.throttle;
            if (this.ersActive && this.ers > 0) {
                drive *= 1.5; // Arcade Nitro Boost
                this.ers = Math.max(0, this.ers - SPEC.ersDeployRate * dt * 2);
            }
        } else if (this.brake > 0) {
            // Arcade braking recharges boost
            this.ers = Math.min(SPEC.ersCapacity, this.ers + SPEC.ersHarvestRate * dt * 2);
        }

        let braking = this.brake * SPEC.brakeForce * 1.5; // Stronger brakes for arcade

        const drag = 0.5 * RHO * SPEC.cdA * (this.drsOpen ? 0.5 : 1) * this.vx * Math.abs(this.vx);
        const rolling = ROLLING_COEFF * SPEC.mass * G * Math.sign(this.vx || 1)
            + (this.offTrack ? 12000 : 0) * Math.sign(this.vx); // Heavy penalty off-track
        const slope = circuit.slope[this.trackIndex];
        const gravityPull = SPEC.mass * G * -slope;

        let fx = drive - braking * Math.sign(this.vx || 1) - drag - rolling + gravityPull;
        this.lastAccel = fx / SPEC.mass;

        /* --- arcade lateral kinematics ------------------------------ */
        this.vx += (fx / SPEC.mass) * dt;
        if (this.brake > 0.1 && this.vx < 0.6) this.vx = Math.max(0, this.vx - 12 * dt);
        this.vx = clamp(this.vx, -15, 130); // Higher max speed (arcade)

        // Simple kinematic steering with drift
        const turnRadius = SPEC.wheelbase / Math.tan(this.steer || 0.001);
        this.yawRate = this.vx / turnRadius;
        
        // Arcade drift/slip
        this.vz = this.steer * this.vx * 0.15; 
        this.slip = Math.abs(this.steer) * (this.vx / 30);

        this.yaw += this.yawRate * dt;
        this.speed = Math.hypot(this.vx, this.vz);

        /* --- integrate position ------------------------------------- */
        const sinYaw = Math.sin(this.yaw);
        const cosYaw = Math.cos(this.yaw);
        this.position.x += (this.vx * sinYaw + this.vz * cosYaw) * dt;
        this.position.z += (this.vx * cosYaw - this.vz * sinYaw) * dt;

        // Ground tracking
        const groundY = circuit.heightAt(this.trackIndex, clamp(this.lateral, -60, 60));
        const drop = this.position.y - groundY;
        if (drop > 0.05) {
            this.airborne = Math.min(1, this.airborne + dt * 2);
            this.verticalSpeed = (this.verticalSpeed || 0) - G * dt;
        } else {
            this.airborne *= Math.exp(-dt * 5);
            this.verticalSpeed = 0;
        }
        this.position.y += (this.verticalSpeed || 0) * dt;
        this.position.y += (groundY - this.position.y) * Math.min(1, 14 * dt);
        this.suspension = clamp(-drop * 0.4, -0.05, 0.05);

        // Kerb rattle
        if (this.surface === 1) {
            this.suspension += Math.sin(this.totalDistance * 6) * 0.022;
        }

        /* --- attitude ------------------------------------------------ */
        const targetPitch = clamp(-slope * 0.9 - (fx / SPEC.mass) * 0.006, -0.3, 0.3);
        this.pitch += (targetPitch - this.pitch) * Math.min(1, 6 * dt);
        const targetRoll = clamp(circuit.bank[this.trackIndex] + (this.vz * this.yawRate) * 0.004, -0.2, 0.2);
        this.roll += (targetRoll - this.roll) * Math.min(1, 6 * dt);

        /* --- wheels & HUD fakes -------------------------------------- */
        this.wheelAngle += (this.vx / SPEC.wheelRadius) * dt;

        // Keep HUD/Audio happy but no actual wear
        this.tyreWear = 0;
        this.tyreTemp = 80;

        return delta;
    }

    /** Contact response: split the closing velocity and nudge the cars apart. */
    static resolveContact(a, b) {
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distance = Math.hypot(dx, dz);
        const minDistance = 3.4;
        if (distance > minDistance || distance < 1e-4) return 0;

        const nx = dx / distance;
        const nz = dz / distance;
        const overlap = (minDistance - distance) * 0.5;

        a.position.x -= nx * overlap;
        a.position.z -= nz * overlap;
        b.position.x += nx * overlap;
        b.position.z += nz * overlap;

        const av = a.worldVelocity();
        const bv = b.worldVelocity();
        const closing = (bv.x - av.x) * nx + (bv.z - av.z) * nz;
        if (closing > 0) return 0;

        const impulse = -closing * 0.55;
        a.impulse.x -= nx * impulse;
        a.impulse.z -= nz * impulse;
        b.impulse.x += nx * impulse;
        b.impulse.z += nz * impulse;
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

    /** Pushes the car back inside the barriers and scrubs speed. */
    clampToTrack() {
        const circuit = this.circuit;
        const limit = circuit.halfWidth * circuit.widthScale[this.trackIndex] + 14.6;
        if (Math.abs(this.lateral) <= limit) return 0;

        const i = this.trackIndex;
        const sign = Math.sign(this.lateral);
        const clamped = sign * limit;
        this.position.x = circuit.cx[i] + circuit.nx[i] * clamped;
        this.position.z = circuit.cz[i] + circuit.nz[i] * clamped;
        this.lateral = clamped;

        const hit = Math.abs(this.vz) + Math.abs(this.vx) * 0.25;
        this.vx *= 0.55;
        this.vz *= -0.25;
        this.yawRate *= 0.3;
        return hit;
    }
}

export { SPEC as VEHICLE_SPEC };
