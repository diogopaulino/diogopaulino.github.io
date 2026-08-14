/**
 * Cavalo + cavaleiro.
 *
 * Física arcade:
 *   v' = v + throttle * accel * dt
 *   yaw' = yaw − steer * turn * (v / cruise) * dt
 *   y = heightAt(x, z)
 *
 * Galope livre: a velocidade nunca cai abaixo de HORSE.cruise (ou walk se
 * o jogador segura S). O cavalo não cansa — “sem parar” é a regra.
 *
 * Marcha (gait) pela velocidade: passo → trote → galope → disparada.
 * Pernas em diagonal (trote): FL+HR vs FR+HL, fase = distance * 2.4.
 */

import * as THREE from 'three';
import { HORSE } from './config.js';
import { clamp, damp, wrapPi, lerp } from './utils.js';
import { std } from './models.js';
import { hideTexture } from './textures.js';

function enableShadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

export function buildHorse() {
    const root = new THREE.Group();
    const coat = new THREE.MeshStandardMaterial({
        map: hideTexture(), color: 0xb86a32, roughness: 0.68
    });
    const dark = std(0x1a120c, 0.78);
    const cream = std(0xd8c8a8, 0.7);
    const leather = std(0x4a2412, 0.7);
    const cloth = std(0x6a1c14, 0.75);
    const skin = std(0xc4a07a, 0.65);
    const hat = std(0x2a2018, 0.8);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 10, 8), coat);
    body.scale.set(1.05, 0.92, 1.85);
    body.position.set(0, 1.18, 0);
    root.add(body);

    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), coat);
    chest.position.set(0, 1.16, 0.68);
    root.add(chest);

    const rump = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 8), coat);
    rump.position.set(0, 1.2, -0.72);
    root.add(rump);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 0.78, 8), coat);
    neck.position.set(0, 1.58, 0.92);
    neck.rotation.x = 0.62;
    root.add(neck);

    const headG = new THREE.Group();
    headG.position.set(0, 2.02, 1.28);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), coat);
    head.scale.set(0.72, 0.78, 1.4);
    headG.add(head);
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 6), cream);
    muzzle.position.set(0, -0.04, 0.28);
    muzzle.scale.set(0.75, 0.65, 1.15);
    headG.add(muzzle);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), coat);
        ear.position.set(sx * 0.1, 0.2, -0.04);
        ear.rotation.z = sx * 0.25;
        headG.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), dark);
        eye.position.set(sx * 0.1, 0.04, 0.12);
        headG.add(eye);
    }
    root.add(headG);

    const mane = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.55, 0.7), dark);
    mane.position.set(0, 1.72, 0.72);
    mane.rotation.x = 0.5;
    root.add(mane);

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.95, 6), dark);
    tail.position.set(0, 1.05, -1.15);
    tail.rotation.x = 0.45;
    root.add(tail);

    const legs = [];
    const spots = [
        { x: 0.22, z: 0.55, name: 'fl' },
        { x: -0.22, z: 0.55, name: 'fr' },
        { x: 0.22, z: -0.55, name: 'hl' },
        { x: -0.22, z: -0.55, name: 'hr' }
    ];
    for (const s of spots) {
        const hip = new THREE.Group();
        hip.position.set(s.x, 1.05, s.z);
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.52, 6), coat);
        thigh.position.y = -0.22;
        hip.add(thigh);
        const shinG = new THREE.Group();
        shinG.position.y = -0.48;
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.48, 6), coat);
        shin.position.y = -0.2;
        shinG.add(shin);
        const hoof = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.14), dark);
        hoof.position.y = -0.46;
        shinG.add(hoof);
        hip.add(shinG);
        root.add(hip);
        legs.push({ hip, shin: shinG, name: s.name });
    }

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.7), leather);
    saddle.position.set(0, 1.58, 0.02);
    root.add(saddle);

    const rider = new THREE.Group();
    rider.position.set(0, 1.62, 0.02);
    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.28), cloth);
    hips.position.y = 0.22;
    rider.add(hips);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.48, 0.28), cloth);
    torso.position.y = 0.52;
    rider.add(torso);
    const poncho = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.55, 6, 1, true), std(0x8a3a18, 0.8));
    poncho.position.y = 0.42;
    rider.add(poncho);
    const headR = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), skin);
    headR.position.y = 0.88;
    rider.add(headR);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 10), hat);
    brim.position.y = 0.98;
    rider.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.16, 8), hat);
    crown.position.y = 1.08;
    rider.add(crown);
    for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.42, 6), cloth);
        arm.position.set(sx * 0.28, 0.48, 0.12);
        arm.rotation.x = 0.85;
        arm.rotation.z = -sx * 0.25;
        rider.add(arm);
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.18), dark);
        boot.position.set(sx * 0.16, 0.02, 0.12);
        rider.add(boot);
    }
    root.add(rider);

    enableShadows(root);
    return { root, parts: { legs, neck, head: headG, tail, rider, mane } };
}

function gaitName(speed) {
    if (speed < 5) return 'passo';
    if (speed < 9.5) return 'trote';
    if (speed < 16.5) return 'galope';
    return 'disparada';
}

export class Horse {
    constructor(scene, world) {
        this.world = world;
        const built = buildHorse();
        this.mesh = built.root;
        this.parts = built.parts;
        scene.add(this.mesh);
        this.x = 0;
        this.z = 0;
        this.y = 0;
        this.yaw = 0;
        this.speed = HORSE.cruise;
        this.pitch = 0;
        this.roll = 0;
        this.phase = 0;
        this.spurT = 0;
        this.cruise = true;
        this.distance = 0;
        this.air = 0;
        this.hoofTimer = 0;
        this.gait = 'galope';
        this.inWater = false;
    }

    reset(spawn) {
        this.x = spawn.x;
        this.z = spawn.z;
        this.yaw = spawn.yaw;
        this.speed = HORSE.cruise;
        this.pitch = 0;
        this.roll = 0;
        this.phase = 0;
        this.spurT = 0;
        this.distance = 0;
        this.y = this.world.heightAt(this.x, this.z);
        this.sync();
    }

    get forward() {
        return { x: Math.sin(this.yaw), z: Math.cos(this.yaw) };
    }

    toggleCruise() {
        this.cruise = !this.cruise;
        return this.cruise;
    }

    update(dt, input) {
        const steer = input.move.x;
        const throttle = input.move.z;
        const sprint = input.move.sprint;

        const spurred = input.consumeSpur();
        if (spurred) this.spurT = HORSE.spurTime;

        this.spurT = Math.max(0, this.spurT - dt);

        let target;
        if (this.spurT > 0 || sprint) {
            target = this.spurT > 0 ? HORSE.spur : HORSE.gallop;
        } else if (throttle > 0.12) {
            target = lerp(HORSE.canter, HORSE.gallop, clamp(throttle, 0, 1));
        } else if (throttle < -0.12) {
            const brake = clamp(-throttle, 0, 1);
            target = this.cruise
                ? lerp(HORSE.cruise, HORSE.walk, brake)
                : lerp(HORSE.walk, 0, brake);
        } else {
            target = this.cruise ? HORSE.cruise : HORSE.walk;
        }

        const rate = target > this.speed ? HORSE.accel : HORSE.brake;
        this.speed = damp(this.speed, target, rate * 0.22, dt);
        if (this.cruise) this.speed = Math.max(this.speed, HORSE.walk * 0.92);

        const f = this.forward;
        const look = 2.4;
        const aheadY = this.world.heightAt(this.x + f.x * look, this.z + f.z * look);
        const slope = (aheadY - this.y) / look;
        if (slope > HORSE.maxClimb) this.speed *= 1 - clamp((slope - HORSE.maxClimb) * 1.6, 0, 0.55) * dt * 8;

        const turnScale = clamp(Math.abs(this.speed) / 7, 0.28, 1.15);
        this.yaw -= steer * HORSE.turn * turnScale * dt;
        this.yaw = wrapPi(this.yaw);

        const f2 = this.forward;
        let x = this.x + f2.x * this.speed * dt;
        let z = this.z + f2.z * this.speed * dt;
        const hit = this.world.collide(x, z, HORSE.radius);
        x = hit.x;
        z = hit.z;

        const ground = this.world.heightAt(x, z);
        this.inWater = ground < this.world.waterY + 0.35;
        if (this.inWater) this.speed = Math.min(this.speed, HORSE.trot * 1.05);

        const dist = Math.hypot(x - this.x, z - this.z);
        this.distance += dist;
        this.x = x;
        this.z = z;
        this.y = ground;
        this.gait = gaitName(this.speed);

        const right = this.world.heightAt(
            x + Math.cos(this.yaw) * 1.4,
            z - Math.sin(this.yaw) * 1.4
        );
        this.pitch = damp(this.pitch, clamp((this.y - aheadY) * 0.16, -0.28, 0.28), 7, dt);
        this.roll = damp(this.roll, clamp((this.y - right) * 0.1 - steer * 0.14, -0.22, 0.22), 8, dt);

        this.phase += this.speed * dt * 2.35;
        this.animate(dt, steer);
        this.sync();

        this.hoofTimer += this.speed * dt;
        const stride = this.speed > 14 ? 1.35 : this.speed > 8 ? 1.7 : 2.15;
        const hoof = this.hoofTimer > stride;
        if (hoof) this.hoofTimer = 0;
        return { hoof, spur: spurred };
    }

    animate(dt, steer) {
        const amp = clamp(this.speed / HORSE.gallop, 0.12, 1) * 0.72;
        const g = Math.sin(this.phase);
        const g2 = Math.sin(this.phase + Math.PI);
        const legs = this.parts.legs;
        legs[0].hip.rotation.x = g * amp;
        legs[3].hip.rotation.x = g * amp * 0.92;
        legs[1].hip.rotation.x = g2 * amp;
        legs[2].hip.rotation.x = g2 * amp * 0.92;
        legs[0].shin.rotation.x = Math.max(0, -g) * amp * 0.7;
        legs[3].shin.rotation.x = Math.max(0, -g) * amp * 0.6;
        legs[1].shin.rotation.x = Math.max(0, -g2) * amp * 0.7;
        legs[2].shin.rotation.x = Math.max(0, -g2) * amp * 0.6;

        this.parts.neck.rotation.x = 0.62 - amp * 0.12 + Math.sin(this.phase * 0.5) * 0.04;
        this.parts.head.rotation.x = Math.sin(this.phase * 0.5) * 0.05;
        this.parts.tail.rotation.x = 0.45 + Math.sin(this.phase * 0.8) * 0.18;
        this.parts.tail.rotation.z = steer * 0.25 + Math.sin(this.phase) * 0.08;
        this.parts.rider.rotation.z = -steer * 0.12;
        this.parts.rider.rotation.x = -this.pitch * 0.4 + Math.sin(this.phase) * 0.03;
    }

    sync() {
        this.mesh.position.set(this.x, this.y, this.z);
        this.mesh.rotation.order = 'YXZ';
        this.mesh.rotation.y = this.yaw;
        this.mesh.rotation.x = this.pitch;
        this.mesh.rotation.z = this.roll;
    }
}
