/**
 * Medusa jogável: pulso para acelerar e subir, inclinação para esterçar.
 * Sem pulso ela afunda suavemente — o ritmo vira o jogo.
 */

import * as THREE from 'three';
import { PLAY, SWIM } from './config.js';
import { clamp, damp } from './utils.js';
import { createJellyfish } from './models.js';

export class Player {
    constructor(scene, geo, pal) {
        this.root = createJellyfish(THREE, geo, pal);
        this.root.position.set(0, 8, 0);
        scene.add(this.root);
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;
        this.speed = SWIM.baseSpeed;
        this.pulseT = 0;
        this.cool = 0;
        this.glow = 1;
        this.invuln = 0;
        this.shock = 0;
        this.beatBonus = false;
        this._look = new THREE.Vector3();
        this._fwd = new THREE.Vector3();
    }

    get position() {
        return this.root.position;
    }

    pulse(onBeat) {
        if (this.cool > 0) return false;
        this.pulseT = SWIM.pulseDuration;
        this.cool = SWIM.pulseCooldown;
        this.shock = 0.28;
        this.beatBonus = Boolean(onBeat);
        if (onBeat) this.pulseT += 0.12;
        return true;
    }

    hit(amount) {
        if (this.invuln > 0) return false;
        this.glow = clamp(this.glow - amount, 0, 1);
        this.invuln = 1.15;
        this.root.userData.pulse.uHit.value = 1;
        return true;
    }

    heal(amount) {
        this.glow = clamp(this.glow + amount, 0, 1);
    }

    setPalette(pal) {
        const d = this.root.userData;
        d.pulse.uJelly.value.setHex(pal.jelly);
        d.pulse.uGlowA.value.setHex(pal.glowA);
        d.inner.material.color.setHex(pal.glowA);
        d.light.color.setHex(pal.glowA);
        d.tentMat.color.setHex(pal.jelly);
    }

    reset() {
        this.root.position.set(0, 8, 0);
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;
        this.speed = SWIM.baseSpeed;
        this.pulseT = 0;
        this.cool = 0;
        this.glow = 1;
        this.invuln = 0;
        this.shock = 0;
        this.root.rotation.set(0, 0, 0);
        this.root.userData.pulse.uHit.value = 0;
        this.root.userData.pulse.uPulse.value = 0;
    }

    update(dt, input, speedScale) {
        this.cool = Math.max(0, this.cool - dt);
        this.invuln = Math.max(0, this.invuln - dt);
        this.shock = Math.max(0, this.shock - dt);
        if (this.pulseT > 0) this.pulseT = Math.max(0, this.pulseT - dt);

        const pulsing = this.pulseT > 0;
        const targetSpeed = pulsing
            ? SWIM.pulseSpeed * (this.beatBonus ? 1.18 : 1) * speedScale
            : SWIM.baseSpeed * speedScale;
        this.speed = damp(this.speed, targetSpeed, pulsing ? 8 : 2.4, dt);

        this.yaw -= input.steerX * SWIM.steer * dt;
        this.pitch -= input.steerY * SWIM.steer * dt;
        this.pitch = clamp(this.pitch, -0.72, 0.72);
        this.roll = damp(this.roll, -input.steerX * 0.55, 8, dt);

        const sink = pulsing ? -6.5 : SWIM.sink;
        this.root.position.y += (-sink * dt) - Math.sin(this.pitch) * this.speed * dt * 0.85;
        this.root.position.x += Math.sin(this.yaw) * this.speed * dt * 0.72
            + input.strafe * 8 * dt;
        this.root.position.z -= Math.cos(this.yaw) * this.speed * dt;

        this.root.position.x = clamp(this.root.position.x, -PLAY.halfWidth, PLAY.halfWidth);
        this.root.position.y = clamp(this.root.position.y, PLAY.yMin, PLAY.yMax);

        this.root.rotation.set(this.pitch * 0.85, this.yaw, this.roll);

        const u = this.root.userData;
        const pulseAmt = pulsing ? Math.sin((1 - this.pulseT / SWIM.pulseDuration) * Math.PI) : 0;
        u.pulse.uPulse.value = pulseAmt;
        u.pulse.uHit.value = damp(u.pulse.uHit.value, 0, 6, dt);
        u.inner.material.opacity = 0.35 + this.glow * 0.4 + pulseAmt * 0.25;
        u.light.intensity = 2.2 + this.glow * 3.5 + pulseAmt * 4;
        u.light.distance = 12 + this.glow * 10;

        const t = performance.now() * 0.001;
        for (const tent of u.tentacles) {
            const s = tent.userData.seed;
            tent.rotation.x = Math.sin(t * 3.2 + s) * 0.35 + 0.15;
            tent.rotation.z = Math.cos(t * 2.4 + s * 1.3) * 0.28;
            tent.scale.y = 1 + pulseAmt * 0.15;
        }
        for (const arm of u.arms) {
            const s = arm.userData.seed;
            arm.rotation.x = Math.sin(t * 2.1 + s) * 0.22 + 0.35;
            arm.rotation.z = Math.cos(t * 1.6 + s) * 0.18;
        }

        const blink = this.invuln > 0 && Math.sin(this.invuln * 28) > 0;
        this.root.visible = !blink;
    }
}
