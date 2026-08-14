/**
 * Arraia-manta em geometria nativa. As asas batem com
 *   flap = sin(t * (1.8 + speed * 0.12)) * 0.48
 * e a pirueta soma um roll extra de 2π em PHYS.rollDuration segundos.
 */

import * as THREE from 'three';
import { CAMERA, COURSE, PHYS } from './config.js';
import { clamp, damp, pathFrame } from './utils.js';

const CAM_RIGS = [CAMERA.chase, CAMERA.shoulder, CAMERA.cinematic];

export class Manta {
    constructor(scene, camera, textures) {
        this.scene = scene;
        this.camera = camera;
        this.group = buildManta(textures);
        scene.add(this.group);

        this.s = 8;
        this.lat = 0;
        this.vert = 0;
        this.speed = PHYS.cruise;
        this.boost = 1;
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;
        this.spin = 0;
        this.spinDir = 0;
        this.invuln = 0;
        this.lookYaw = 0;
        this.lookPitch = 0;
        this.camMode = 0;
        this.pos = new THREE.Vector3();
        this.forward = new THREE.Vector3(0, 0, 1);
        this._q = new THREE.Quaternion();
        this._extra = new THREE.Quaternion();
        this._e = new THREE.Euler();
        this._cam = new THREE.Vector3();
        this._look = new THREE.Vector3();
        this._tmp = new THREE.Vector3();
        this._right = new THREE.Vector3();
        this._up = new THREE.Vector3();
        this._basis = new THREE.Matrix4();
    }

    reset() {
        this.s = 8;
        this.lat = 0;
        this.vert = 0;
        this.speed = PHYS.cruise * 0.6;
        this.boost = 1;
        this.yaw = 0;
        this.pitch = 0;
        this.roll = 0;
        this.spin = 0;
        this.spinDir = 0;
        this.invuln = 0;
        this.lookYaw = 0;
        this.lookPitch = 0;
        this.group.visible = true;
        this.syncPose(0);
    }

    cycleCamera() {
        this.camMode = (this.camMode + 1) % CAM_RIGS.length;
        return ['perseguição', 'ombro', 'cinema'][this.camMode];
    }

    startRoll(dir) {
        if (this.spin > 0) return false;
        this.spin = PHYS.rollDuration;
        this.spinDir = dir < 0 ? -1 : 1;
        this.invuln = Math.max(this.invuln, PHYS.rollDuration * 0.85);
        return true;
    }

    hit() {
        this.invuln = PHYS.invuln;
        this.speed *= PHYS.hitSlow;
        this.boost = Math.max(0, this.boost - 0.25);
    }

    update(dt, input, diff, boosting) {
        const length = COURSE.length;
        const cruise = PHYS.cruise * diff.speed;
        const target = cruise * (boosting && this.boost > 0.04 ? PHYS.boostMul : 1);
        this.speed = damp(this.speed, target, PHYS.dragLambda, dt);
        this.speed = clamp(this.speed, 6, PHYS.maxSpeed * diff.speed);

        if (boosting && this.boost > 0) {
            this.boost = Math.max(0, this.boost - PHYS.boostCost * dt);
        } else {
            this.boost = Math.min(1, this.boost + PHYS.boostRegen * dt);
        }

        const steer = PHYS.steer * (0.7 + this.speed / 40);
        this.lat = clamp(this.lat + input.steerX * steer * 9 * dt, -diff.corridor, diff.corridor);
        this.vert = clamp(this.vert + input.steerY * steer * 7 * dt, -diff.corridor * 0.72, diff.corridor * 0.72);

        this.s += this.speed * dt;
        this.lookYaw = damp(this.lookYaw, 0, 3, dt);
        this.lookPitch = damp(this.lookPitch, 0, 3, dt);

        const bankT = -input.steerX * PHYS.maxBank;
        const pitchT = input.steerY * PHYS.maxPitch;
        this.roll = damp(this.roll, bankT, 8, dt);
        this.pitch = damp(this.pitch, pitchT, 7, dt);

        if (this.spin > 0) {
            this.spin = Math.max(0, this.spin - dt);
            const k = 1 - this.spin / PHYS.rollDuration;
            this.roll += this.spinDir * k * Math.PI * 2 * (dt / PHYS.rollDuration) * 8;
        }

        this.invuln = Math.max(0, this.invuln - dt);
        this.syncPose(dt);
        this.updateCamera(dt);
        return this.s >= length - 6;
    }

    syncPose(dt) {
        const frame = pathFrame(this.s, COURSE.length);
        const { p, f, r, u } = frame;
        this.pos.set(
            p.x + r.x * this.lat + u.x * this.vert,
            p.y + r.y * this.lat + u.y * this.vert,
            p.z + r.z * this.lat + u.z * this.vert
        );
        this.forward.set(f.x, f.y, f.z);
        this.group.position.copy(this.pos);

        this._e.set(this.pitch, 0, this.roll, 'YXZ');
        this._right.set(r.x, r.y, r.z);
        this._up.set(u.x, u.y, u.z);
        this._basis.makeBasis(this._right, this._up, this.forward);
        this._q.setFromRotationMatrix(this._basis);
        this._extra.setFromEuler(this._e);
        this.group.quaternion.copy(this._q).multiply(this._extra);

        const flap = Math.sin(performance.now() * 0.001 * (1.8 + this.speed * 0.12)) * 0.48;
        const wings = this.group.userData.wings;
        if (wings) {
            wings.l.rotation.z = 0.18 + flap;
            wings.r.rotation.z = -0.18 - flap;
            wings.tail.rotation.x = flap * 0.25;
        }
        this.group.userData.glow.intensity = 1.2 + this.boost * 1.8 + (this.spin > 0 ? 2 : 0);

        if (this.invuln > 0) {
            this.group.visible = Math.sin(this.invuln * 28) > -0.2;
        } else {
            this.group.visible = true;
        }
        void dt;
    }

    updateCamera(dt) {
        const rig = CAM_RIGS[this.camMode];
        const ahead = pathFrame(this.s + rig.look, COURSE.length);
        this._look.set(ahead.p.x, ahead.p.y + 0.4, ahead.p.z);
        this._look.lerp(this.pos, 0.35);

        this._cam.copy(this.pos)
            .addScaledVector(this.forward, -rig.dist)
            .add(this._tmp.set(0, rig.height, 0));

        this.camera.position.lerp(this._cam, 1 - Math.exp(-5.5 * dt));
        this.camera.lookAt(this._look);
        const fovT = rig.fov + Math.max(0, this.speed - 16) * 0.35;
        this.camera.fov = damp(this.camera.fov, fovT, 4, dt);
        this.camera.updateProjectionMatrix();
    }
}

function buildManta(textures) {
    const g = new THREE.Group();
    const skin = new THREE.MeshPhysicalMaterial({
        map: textures.manta,
        roughness: 0.32,
        metalness: 0.14,
        emissive: new THREE.Color(0x042028),
        emissiveIntensity: 0.45,
        iridescence: 0.9,
        iridescenceIOR: 1.28,
        sheen: 0.45,
        sheenColor: new THREE.Color(0x5ef0d8),
        clearcoat: 0.28,
        clearcoatRoughness: 0.4
    });
    const belly = new THREE.MeshStandardMaterial({
        color: 0xe8f2ee,
        roughness: 0.55,
        metalness: 0.05
    });

    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), skin);
    body.scale.set(1.15, 0.28, 1.85);
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 12), skin);
    head.position.set(0, 0.02, 1.55);
    head.scale.set(1.1, 0.7, 1.2);
    g.add(head);

    const wingGeo = new THREE.BoxGeometry(2.6, 0.08, 1.35);
    wingGeo.translate(1.3, 0, 0);
    const wingL = new THREE.Mesh(wingGeo, skin);
    const wingR = new THREE.Mesh(wingGeo, skin);
    wingR.scale.x = -1;
    g.add(wingL, wingR);

    const tipL = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.7, 8), skin);
    tipL.rotation.z = -Math.PI / 2;
    tipL.position.set(2.7, 0, -0.15);
    const tipR = tipL.clone();
    tipR.position.x = -2.7;
    tipR.rotation.z = Math.PI / 2;
    g.add(tipL, tipR);

    const horn = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.55), belly);
    const hL = horn.clone();
    hL.position.set(0.28, -0.05, 1.95);
    hL.rotation.y = 0.35;
    const hR = horn.clone();
    hR.position.set(-0.28, -0.05, 1.95);
    hR.rotation.y = -0.35;
    g.add(hL, hR);

    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.02, 1.8, 8), skin);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, 0.02, -2.1);
    g.add(tail);

    const eyeM = new THREE.MeshStandardMaterial({
        color: 0x0a1014,
        roughness: 0.2,
        emissive: 0x5ef0d8,
        emissiveIntensity: 0.35
    });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), eyeM);
    const eL = eye.clone();
    eL.position.set(0.32, 0.08, 1.72);
    const eR = eye.clone();
    eR.position.set(-0.32, 0.08, 1.72);
    g.add(eL, eR);

    const glow = new THREE.PointLight(0x5ef0d8, 1.4, 18, 2);
    glow.position.set(0, 0.4, 0.2);
    g.add(glow);

    g.userData.wings = { l: wingL, r: wingR, tail };
    g.userData.glow = glow;
    wingL.castShadow = true;
    wingR.castShadow = true;
    return g;
}
