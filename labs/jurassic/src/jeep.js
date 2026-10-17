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

/**
 * Casco visto de lado. +x é a frente (vira +z).
 * Os arcos de roda sobem na borda de baixo, centrados em x = ±1.25.
 */
function jeepHullGeometry() {
    const s = new THREE.Shape();
    s.moveTo(1.72, 0.52);
    s.lineTo(1.72, 0.78);
    s.quadraticCurveTo(1.35, 1.05, 0.72, 1.1);
    s.lineTo(-0.15, 1.08);
    s.quadraticCurveTo(-0.7, 1.02, -1.15, 0.96);
    s.quadraticCurveTo(-1.6, 0.86, -1.82, 0.7);
    s.lineTo(-1.82, 0.52);
    s.lineTo(-1.72, 0.52);
    s.quadraticCurveTo(-1.25, 1.02, -0.78, 0.52);
    s.lineTo(0.78, 0.52);
    s.quadraticCurveTo(1.25, 1.02, 1.72, 0.52);
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 1.82,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.04,
        bevelSegments: 1,
        curveSegments: 8
    });
    g.translate(0, 0, -0.91);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

/** Cabine: para-brisa inclinado e teto, mais estreita que o casco. */
function jeepCabinGeometry() {
    const s = new THREE.Shape();
    s.moveTo(0.58, 1.02);
    s.quadraticCurveTo(0.42, 1.45, 0.12, 1.68);
    s.lineTo(-0.82, 1.7);
    s.quadraticCurveTo(-1.02, 1.55, -1.02, 1.12);
    s.lineTo(0.58, 1.02);
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 1.58,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.035,
        bevelSegments: 1,
        curveSegments: 8
    });
    g.translate(0, 0, -0.79);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

/**
 * Para-choque 1.95×0.22×0.28, centrado e simétrico em Z
 * (a traseira é um clone). As pontas descem.
 */
function jeepBumperGeometry() {
    const w = 1.95;
    const hw = w / 2;
    const g = new THREE.BoxGeometry(w, 0.22, 0.28, 16, 4, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const nx = Math.abs(x) / hw;
        if (nx > 0.62) {
            const u = (nx - 0.62) / 0.38;
            y -= u * u * 0.14;
        }
        if (y > 0 && nx < 0.55) y += (1 - nx) * 0.03;
        if (nx > 0.88) z *= 1 - (nx - 0.88) * 1.1;
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

const JEEP_BUMPER = jeepBumperGeometry();

/** Barras da grade. O vão entre elas fica aberto. */
const JEEP_GRILLE_BAR = new THREE.BoxGeometry(0.038, 0.24, 0.05);
const JEEP_GRILLE_RAIL = new THREE.BoxGeometry(0.86, 0.042, 0.062);
const JEEP_GRILLE_POST = new THREE.BoxGeometry(0.046, 0.32, 0.07);

/** Farol ao longo de Y: lente em +Y, aro mais largo. */
function jeepLampGeometry() {
    const g = new THREE.LatheGeometry([
        new THREE.Vector2(0.02, -0.04),
        new THREE.Vector2(0.1, -0.032),
        new THREE.Vector2(0.128, 0.0),
        new THREE.Vector2(0.09, 0.02),
        new THREE.Vector2(0.04, 0.04)
    ], 18);
    g.computeVertexNormals();
    return g;
}

const JEEP_LAMP = jeepLampGeometry();

/** Tubos do bagageiro. O longo corre em X; o curto, em Z. */
const JEEP_RACK_LONG = (() => {
    const g = new THREE.CylinderGeometry(0.02, 0.02, 1.35, 8);
    g.rotateZ(Math.PI / 2);
    return g;
})();
const JEEP_RACK_SHORT = (() => {
    const g = new THREE.CylinderGeometry(0.02, 0.02, 1.26, 8);
    g.rotateX(Math.PI / 2);
    return g;
})();

export function buildJeep() {
    const root = new THREE.Group();
    const paint = new THREE.MeshPhysicalMaterial({
        color: 0x1c3a38,
        roughness: 0.36,
        metalness: 0.22,
        clearcoat: 0.65,
        clearcoatRoughness: 0.22
    });
    const dark = std(0x121416, 0.7, 0.2);
    const leather = new THREE.MeshPhysicalMaterial({
        color: 0x4a2e1b,
        roughness: 0.56,
        metalness: 0.05,
        clearcoat: 0.28,
        clearcoatRoughness: 0.45
    });
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

    const chassis = new THREE.Mesh(jeepHullGeometry(), paint);
    chassis.name = 'jeepHull';
    root.add(chassis);

    const cabin = new THREE.Mesh(jeepCabinGeometry(), paint);
    cabin.name = 'jeepCabin';
    root.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.58, 0.06), glass);
    windshield.position.set(0, 1.42, 0.72);
    windshield.rotation.x = -0.28;
    root.add(windshield);

    // Interior: bancos dianteiros e traseiros de couro (seat + backrest) e volante com coluna
    const interior = new THREE.Group();
    interior.name = 'jeepInterior';
    const seatGeo = new THREE.BoxGeometry(0.52, 0.14, 0.52);
    const backrestGeo = new THREE.BoxGeometry(0.5, 0.56, 0.12);
    const headrestGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.26, 10);
    headrestGeo.rotateZ(Math.PI / 2);

    for (const sx of [-0.42, 0.42]) {
        const frontSeat = new THREE.Group();
        frontSeat.position.set(sx, 0.86, 0.12);
        const seat = new THREE.Mesh(seatGeo, leather);
        seat.name = 'seat';
        const backrest = new THREE.Mesh(backrestGeo, leather);
        backrest.name = 'backrest';
        backrest.position.set(0, 0.3, -0.22);
        backrest.rotation.x = -0.18;
        const headrest = new THREE.Mesh(headrestGeo, leather);
        headrest.position.set(0, 0.62, -0.27);
        frontSeat.add(seat, backrest, headrest);
        interior.add(frontSeat);
    }

    for (const sx of [-0.42, 0.42]) {
        const rearSeat = new THREE.Group();
        rearSeat.position.set(sx, 0.9, -0.68);
        const seat = new THREE.Mesh(seatGeo, leather);
        seat.name = 'seat';
        const backrest = new THREE.Mesh(backrestGeo, leather);
        backrest.name = 'backrest';
        backrest.position.set(0, 0.28, -0.22);
        backrest.rotation.x = -0.14;
        rearSeat.add(seat, backrest);
        interior.add(rearSeat);
    }

    // Coluna de direção e volante inclinado
    const steeringGroup = new THREE.Group();
    steeringGroup.name = 'steeringWheel';
    steeringGroup.position.set(0.42, 1.16, 0.52);
    steeringGroup.rotation.x = 0.58;
    const steeringCol = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.42, 10), dark);
    steeringCol.position.y = -0.2;
    const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 8, 20), dark);
    wheelRim.rotation.x = Math.PI / 2;
    const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10), chrome);
    const wheelSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.02, 0.028), chrome);
    steeringGroup.add(steeringCol, wheelRim, wheelHub, wheelSpoke);
    interior.add(steeringGroup);
    root.add(interior);

    const rack = new THREE.Group();
    rack.name = 'jeepRack';
    rack.position.set(0, 1.92, -0.15);
    for (const z of [-0.63, -0.21, 0.21, 0.63]) {
        const bar = new THREE.Mesh(JEEP_RACK_LONG, chrome);
        bar.position.z = z;
        rack.add(bar);
    }
    for (const x of [-0.64, 0.64]) {
        const bar = new THREE.Mesh(JEEP_RACK_SHORT, chrome);
        bar.position.x = x;
        rack.add(bar);
    }
    root.add(rack);

    const bumperF = new THREE.Mesh(JEEP_BUMPER, chrome);
    bumperF.name = 'jeepBumper';
    bumperF.position.set(0, 0.55, 1.95);
    root.add(bumperF);
    const bumperR = bumperF.clone();
    bumperR.position.z = -1.95;
    root.add(bumperR);

    const grille = new THREE.Group();
    grille.name = 'jeepGrille';
    grille.position.set(0, 0.78, 1.84);
    for (let i = 0; i < 7; i++) {
        const bar = new THREE.Mesh(JEEP_GRILLE_BAR, dark);
        bar.position.x = -0.33 + i * 0.11;
        grille.add(bar);
    }
    const railTop = new THREE.Mesh(JEEP_GRILLE_RAIL, dark);
    railTop.position.y = 0.145;
    const railBot = new THREE.Mesh(JEEP_GRILLE_RAIL, dark);
    railBot.position.y = -0.145;
    const postL = new THREE.Mesh(JEEP_GRILLE_POST, dark);
    postL.position.x = -0.4;
    const postR = new THREE.Mesh(JEEP_GRILLE_POST, dark);
    postR.position.x = 0.4;
    grille.add(railTop, railBot, postL, postR);
    root.add(grille);

    const headlights = [];
    for (const sx of [-1, 1]) {
        const lamp = new THREE.Mesh(JEEP_LAMP, lightMat);
        lamp.name = 'jeepLamp';
        lamp.position.set(sx * 0.62, 0.82, 1.84);
        lamp.rotation.x = Math.PI / 2;
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

    // Gaiola de proteção (roll cage): arcos + barras laterais e superiores
    const rollCage = new THREE.Group();
    rollCage.name = 'rollCage';
    const hoopGeo = new THREE.TorusGeometry(0.68, 0.036, 8, 16, Math.PI);
    for (const z of [-0.18, -1.08]) {
        const hoop = new THREE.Mesh(hoopGeo, chrome);
        hoop.position.set(0, 1.15, z);
        rollCage.add(hoop);
    }
    const sideBarGeo = new THREE.CylinderGeometry(0.032, 0.032, 1.62, 8);
    sideBarGeo.rotateX(Math.PI / 2);
    for (const sx of [-0.68, 0.68]) {
        const topBar = new THREE.Mesh(sideBarGeo, chrome);
        topBar.position.set(sx, 1.82, -0.35);
        rollCage.add(topBar);
        const waistBar = new THREE.Mesh(sideBarGeo, dark);
        waistBar.position.set(sx * 1.08, 1.14, -0.35);
        rollCage.add(waistBar);
        const pillarF = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), chrome);
        pillarF.position.set(sx, 1.48, 0.56);
        pillarF.rotation.x = -0.28;
        rollCage.add(pillarF);
    }
    root.add(rollCage);

    // Estepe traseiro (TorusGeometry + calota) preso na tampa traseira
    const spareWheel = new THREE.Group();
    spareWheel.name = 'spareWheel';
    spareWheel.position.set(0, 0.92, -1.89);
    const spareTire = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.12, 12, 22), rubber);
    const spareCap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 14), chrome);
    spareCap.rotation.x = Math.PI / 2;
    const spareHub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.17, 10), paint);
    spareHub.rotation.x = Math.PI / 2;
    spareWheel.add(spareTire, spareCap, spareHub);
    root.add(spareWheel);

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
