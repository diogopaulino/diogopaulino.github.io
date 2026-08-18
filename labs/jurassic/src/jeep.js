/**
 * Jipe de safari — silhueta dos anos 90, teal escuro, rack e faróis.
 * Física arcade com aderência menor fora da trilha.
 */

import * as THREE from 'three';
import { JEEP } from './config.js';
import { clamp, damp, wrapPi } from './utils.js';
import { metalTexture } from './textures.js';

function std(color, roughness = 0.55, metalness = 0.12) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function buildJeep() {
    const root = new THREE.Group();
    const paint = std(0x1c3a38, 0.42, 0.18);
    const paintTan = std(0xb89a6a, 0.55, 0.08);
    const dark = std(0x121416, 0.7, 0.2);
    const chrome = new THREE.MeshStandardMaterial({
        map: metalTexture(), color: 0xccd2d8, roughness: 0.28, metalness: 0.85
    });
    const glass = new THREE.MeshStandardMaterial({
        color: 0x1a2830, roughness: 0.12, metalness: 0.4,
        transparent: true, opacity: 0.55
    });
    const rubber = std(0x1a1a1a, 0.9, 0.05);
    const lightMat = new THREE.MeshStandardMaterial({
        color: 0xfff2c8, emissive: 0xffe8a0, emissiveIntensity: 0.85, roughness: 0.3
    });

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.42, 3.6), paint);
    chassis.position.y = 0.72;
    root.add(chassis);

    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.12, 3.62), paintTan);
    stripe.position.y = 0.9;
    root.add(stripe);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.85, 1.7), paint);
    cabin.position.set(0, 1.32, -0.15);
    root.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.62, 0.08), glass);
    windshield.position.set(0, 1.42, 0.72);
    windshield.rotation.x = -0.28;
    root.add(windshield);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.85), dark);
    roof.position.set(0, 1.78, -0.2);
    root.add(roof);

    const rack = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 1.5), chrome);
    rack.position.set(0, 1.92, -0.15);
    root.add(rack);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.22, 0.28), chrome);
    bumperF.position.set(0, 0.55, 1.95);
    root.add(bumperF);
    const bumperR = bumperF.clone();
    bumperR.position.z = -1.95;
    root.add(bumperR);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.08), dark);
    grille.position.set(0, 0.78, 1.84);
    root.add(grille);

    const headlights = [];
    for (const sx of [-1, 1]) {
        const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.08), lightMat);
        lamp.position.set(sx * 0.62, 0.82, 1.84);
        root.add(lamp);
        headlights.push(lamp);
        const light = new THREE.SpotLight(0xfff0c8, 0, 38, 0.42, 0.45, 1.1);
        light.position.set(sx * 0.55, 0.9, 1.9);
        light.target.position.set(sx * 0.4, 0.2, 8);
        root.add(light);
        root.add(light.target);
        headlights.push(light);
    }

    const wheels = [];
    const positions = [
        [0.92, 0.42, 1.25],
        [-0.92, 0.42, 1.25],
        [0.92, 0.42, -1.25],
        [-0.92, 0.42, -1.25]
    ];
    for (const [x, y, z] of positions) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.32, 12), rubber);
        w.rotation.z = Math.PI / 2;
        w.position.set(x, y, z);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 8), chrome);
        hub.rotation.z = Math.PI / 2;
        w.add(hub);
        root.add(w);
        wheels.push(w);
    }

    const roll = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 12, Math.PI), chrome);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, 1.55, -1.05);
    root.add(roll);

    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });

    return { root, wheels, headlights, lightMat };
}

export class Jeep {
    constructor(scene) {
        const built = buildJeep();
        this.mesh = built.root;
        this.wheels = built.wheels;
        this.headlights = built.headlights;
        this.lightMat = built.lightMat;
        scene.add(this.mesh);
        this.x = 0;
        this.z = 0;
        this.y = 0;
        this.yaw = 0;
        this.speed = 0;
        this.steer = 0;
        this.pitch = 0;
        this.roll = 0;
        this.lightsOn = true;
        this.spin = 0;
        this.onRoad = true;
        this.fwd = new THREE.Vector3();
    }

    reset(spawn) {
        this.x = spawn.x;
        this.z = spawn.z;
        this.yaw = spawn.yaw;
        this.speed = 0;
        this.steer = 0;
        this.pitch = 0;
        this.roll = 0;
        this.spin = 0;
        this.mesh.position.set(this.x, 0, this.z);
        this.mesh.rotation.set(0, this.yaw, 0);
        this.mesh.visible = true;
    }

    setLights(on) {
        this.lightsOn = on;
        this.lightMat.emissiveIntensity = on ? 0.9 : 0.05;
        for (const o of this.headlights) {
            if (o.isSpotLight) o.intensity = on ? 2.4 : 0;
        }
    }

    update(dt, input, world) {
        const throttle = input.move.z;
        const steerIn = input.move.x;
        this.steer = damp(this.steer, steerIn, 8, dt);

        const road = world.onRoad(this.x, this.z);
        this.onRoad = road;
        const grip = road ? 1 : 0.55;
        const max = JEEP.maxSpeed * grip;

        if (throttle > 0.08) this.speed += throttle * JEEP.accel * grip * dt;
        else if (throttle < -0.08) this.speed += throttle * JEEP.brake * dt;
        else this.speed = damp(this.speed, 0, JEEP.friction, dt);
        this.speed = clamp(this.speed, -JEEP.reverseMax, max);

        const turnScale = clamp(Math.abs(this.speed) / 5, 0.22, 1);
        this.yaw -= this.steer * JEEP.turn * turnScale * Math.sign(this.speed || 1) * dt;
        this.yaw = wrapPi(this.yaw);

        this.x += Math.sin(this.yaw) * this.speed * dt;
        this.z += Math.cos(this.yaw) * this.speed * dt;

        const hit = world.collide(this.x, this.z, JEEP.radius);
        this.x = hit.x;
        this.z = hit.z;
        if (hit.hit) this.speed *= 0.35;

        const lim = world.islandRadius - 4;
        const r = Math.hypot(this.x, this.z);
        if (r > lim) {
            const s = lim / r;
            this.x *= s;
            this.z *= s;
            this.speed *= 0.4;
        }

        const y = Math.max(world.heightAt(this.x, this.z), 0.4);
        const yF = Math.max(world.heightAt(this.x + Math.sin(this.yaw) * 1.4, this.z + Math.cos(this.yaw) * 1.4), 0.4);
        const yS = Math.max(world.heightAt(this.x + Math.cos(this.yaw) * 1.1, this.z - Math.sin(this.yaw) * 1.1), 0.4);
        this.pitch = damp(this.pitch, Math.atan2(y - yF, 1.4), 8, dt);
        this.roll = damp(this.roll, Math.atan2(y - yS, 1.1) * 0.7 - this.steer * 0.12, 7, dt);
        this.y = y;

        this.mesh.position.set(this.x, y + 0.02, this.z);
        this.mesh.rotation.order = 'YXZ';
        this.mesh.rotation.y = this.yaw;
        this.mesh.rotation.x = this.pitch;
        this.mesh.rotation.z = this.roll;

        this.spin += this.speed * dt * 1.6;
        for (const w of this.wheels) w.rotation.x = this.spin;

        this.fwd.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        return { x: this.x, z: this.z, y, speed: this.speed };
    }
}
