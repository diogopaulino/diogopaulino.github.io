/**
 * Lyra no trilho: movimento 1D ao longo de `s`, pulo/gravidade em Y,
 * salto duplo, giro de ataque e o crânio Bico no ombro.
 */

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp, damp } from './utils.js';
import { createLyra, createBico } from './models.js';

export class Player {
    constructor(scene) {
        this.scene = scene;
        this.mesh = createLyra();
        this.bico = createBico();
        this.mesh.add(this.bico);
        this.bico.position.set(0.55, 1.55, 0.15);
        scene.add(this.mesh);

        this._frame = { pos: new THREE.Vector3(), tangent: new THREE.Vector3(),
            binormal: new THREE.Vector3(), normal: new THREE.Vector3() };
        this._look = new THREE.Vector3();
        this.tangent = new THREE.Vector3(0, 0, 1);
        this.binormal = new THREE.Vector3(1, 0, 0);
        this.normal = new THREE.Vector3(0, 1, 0);
        this.reset(0);
    }

    reset(s = 0) {
        this.s = s;
        this.y = 8;
        this.vs = 0;
        this.vy = 0;
        this.facing = 1;
        this.grounded = false;
        this.jumps = 2;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.attackT = 0;
        this.invuln = 0;
        this.spin = 0;
        this.cycle = 0;
        this.alive = true;
        this.mesh.visible = true;
        this.mesh.rotation.set(0, 0, 0);
    }

    get attacking() {
        return this.attackT > 0;
    }

    tryJump() {
        this.jumpBuf = PLAYER.jumpBuffer;
    }

    tryAttack() {
        if (this.attackT > -PLAYER.attackCooldown) return false;
        this.attackT = PLAYER.attackTime;
        this.spin = 0;
        return true;
    }

    hit() {
        this.invuln = PLAYER.invuln;
        this.vs *= -0.4;
        this.vy = 6.5;
        this.grounded = false;
    }

    update(dt, axis, course, time) {
        if (!this.alive) return;

        this.invuln = Math.max(0, this.invuln - dt);
        this.attackT -= dt;
        this.jumpBuf = Math.max(0, this.jumpBuf - dt);
        if (this.grounded) this.coyote = PLAYER.coyote;
        else this.coyote = Math.max(0, this.coyote - dt);

        const control = this.grounded ? 1 : PLAYER.airControl;
        const target = axis * PLAYER.runSpeed;
        const rate = axis !== 0 ? PLAYER.accel : PLAYER.friction;
        this.vs = damp(this.vs, target, rate * control, dt);
        this.s = clamp(this.s + this.vs * dt, -1.2, course.length + 1.5);
        if (Math.abs(this.vs) > 0.4) this.facing = Math.sign(this.vs);

        if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0 || this.jumps > 0)) {
            const first = this.grounded || this.coyote > 0;
            this.vy = first ? PLAYER.jumpVy : PLAYER.doubleJumpVy;
            if (!first) this.spin = Math.PI * 2;
            this.grounded = false;
            this.coyote = 0;
            this.jumpBuf = 0;
            this.jumps = first ? 1 : 0;
            this._didJump = first ? 'jump' : 'double';
        } else {
            this._didJump = null;
        }

        this.vy += -PLAYER.gravity * dt;
        this.vy = Math.max(PLAYER.maxFall, this.vy);
        this.y += this.vy * dt;

        const floor = course.floorAt(this.s, time);
        const feet = this.y;
        this.grounded = false;
        if (floor && this.vy <= 0.4 && feet <= floor.y + 0.22 && feet >= floor.y - 0.85) {
            this.y = floor.y;
            this.vy = 0;
            this.grounded = true;
            this.jumps = 2;
        }

        this._place(course, time, dt);
        this._animate(dt, axis);
    }

    _place(course, time, dt) {
        const frame = course.frame(this.s, this._frame);
        this.mesh.position.copy(frame.pos);
        this.mesh.position.y = this.y;

        // lookAt aponta o -Z do grupo; o rosto da Lyra está em +Z, então
        // miramos para trás do movimento para ela correr de frente.
        this._look.copy(frame.pos).addScaledVector(frame.tangent, -this.facing);
        this._look.y = this.y;
        this.mesh.lookAt(this._look);

        if (this.spin > 0) {
            const step = Math.min(this.spin, dt * 14);
            this.mesh.rotateY(step);
            this.spin -= step;
        }
        if (this.attacking) this.mesh.rotateY(dt * 22);

        this.worldPos = this.mesh.position;
        this.tangent = frame.tangent;
        this.binormal = frame.binormal;
        this.normal = frame.normal;
    }

    _animate(dt, axis) {
        const u = this.mesh.userData;
        const speed = Math.abs(this.vs);
        this.cycle += dt * (this.grounded ? 10 + speed * 1.4 : 4);

        const run = this.grounded && speed > 0.6;
        const swing = run ? Math.sin(this.cycle) * 0.7 : Math.sin(this.cycle * 0.5) * 0.08;
        u.lLeg.rotation.x = this.grounded ? swing : -0.45;
        u.rLeg.rotation.x = this.grounded ? -swing : -0.2;
        u.lArm.rotation.x = this.grounded ? -swing * 0.85 : 0.6;
        u.rArm.rotation.x = this.grounded ? swing * 0.85 : 0.6;
        u.hips.position.y = 0.72 + (run ? Math.abs(Math.sin(this.cycle * 2)) * 0.06 : Math.sin(this.cycle) * 0.02);
        u.head.rotation.z = axis * -0.12;
        u.cape.rotation.x = this.grounded ? -0.15 - speed * 0.02 : -0.55;

        const blink = Math.sin(this.cycle * 0.35 + 1.2);
        this.bico.position.set(0.55, 1.55 + Math.sin(this.cycle * 0.8) * 0.06, 0.15);
        this.bico.rotation.y = blink * 0.4;
        this.bico.rotation.z = Math.sin(this.cycle * 0.6) * 0.15;

        const flash = this.invuln > 0 && Math.sin(this.invuln * 28) > 0;
        this.mesh.visible = !flash;
    }

    fallingIntoVoid(course, time) {
        const floor = course.floorAt(this.s, time);
        const refY = floor ? floor.y : course.frame(this.s, this._frame).pos.y;
        return this.y < refY - 14;
    }
}
