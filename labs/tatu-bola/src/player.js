/**
 * Tatu-bola — movimento estilo N64 (eixo relativo à câmera), pulo duplo e rolamento.
 *
 * vx' = vx + wishX * accel * dt
 * |v|  ≤ maxSpeed  (ou ROLL.speed se rolando)
 * vy'  = vy - g·dt ; se grounded e jump: vy = JUMP (2º pulo = 0.82·JUMP)
 * coyote: grounded permanece true por PLAYER.coyote após deixar o chão
 */

import * as THREE from 'three';
import { PLAYER } from './config.js';
import { clamp, damp, wrapPi } from './utils.js';
import { createTatu } from './models.js';

export class Player {
    constructor(scene) {
        this.mesh = createTatu();
        scene.add(this.mesh);
        this.position = this.mesh.position;
        this.yaw = 0;
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.grounded = true;
        this.jumps = 0;
        this.coyote = 0;
        this.rollT = 0;
        this.rollCool = 0;
        this.invuln = 0;
        this.flash = 0;
        this.alive = true;
        this.swimT = 0;
        this.anim = 0;
        this.lastSafe = new THREE.Vector3(0, 1, 10);
        this._wish = new THREE.Vector3();
        this.body = this.mesh.getObjectByName('body');
        this.head = this.mesh.getObjectByName('head');
        this.legs = this.mesh.getObjectByName('legs');
        this.tail = this.mesh.getObjectByName('tail');
        this.ball = this.mesh.getObjectByName('ball');
        this.blob = this.mesh.getObjectByName('blob');
        this.reset();
    }

    get rolling() {
        return this.rollT > 0;
    }

    reset() {
        this.position.set(0, 1.2, 11);
        this.yaw = Math.PI;
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.grounded = true;
        this.jumps = 0;
        this.coyote = 0;
        this.rollT = 0;
        this.rollCool = 0;
        this.invuln = 2.2;
        this.flash = 0;
        this.alive = true;
        this.swimT = 0;
        this.anim = 0;
        this.lastSafe.set(0, 1.2, 11);
        this.mesh.rotation.set(0, this.yaw, 0);
        this.mesh.visible = true;
        this._setBall(false);
    }

    _setBall(on) {
        if (this.ball) this.ball.visible = on;
        if (this.body) this.body.visible = !on;
        if (this.head) this.head.visible = !on;
        if (this.legs) this.legs.visible = !on;
        if (this.tail) this.tail.visible = !on;
    }

    hurt() {
        if (this.invuln > 0 || this.rolling) return false;
        this.invuln = PLAYER.invuln;
        this.flash = 0.45;
        this.vy = 6.5;
        this.grounded = false;
        return true;
    }

    update(dt, input, world, camYaw) {
        if (!this.alive) return;

        this.invuln = Math.max(0, this.invuln - dt);
        this.flash = Math.max(0, this.flash - dt);
        this.rollCool = Math.max(0, this.rollCool - dt);
        this.coyote = Math.max(0, this.coyote - dt);
        this.anim += dt;

        const canJump = this.grounded || this.coyote > 0 || this.jumps < 2;
        if (input.consumeJump() && canJump) {
            const second = !this.grounded && this.coyote <= 0;
            this.vy = second ? PLAYER.doubleJump : PLAYER.jump;
            this.grounded = false;
            this.coyote = 0;
            this.jumps = second ? 2 : 1;
            this._didJump = true;
        } else {
            this._didJump = false;
        }

        if (input.consumeFire() && this.rollCool <= 0 && this.rollT <= 0) {
            this.rollT = PLAYER.rollTime;
            this._didRoll = true;
            const speed = Math.hypot(this.vx, this.vz);
            if (speed < 2) {
                this.vx += Math.sin(this.yaw) * 6;
                this.vz += Math.cos(this.yaw) * 6;
            }
        } else {
            this._didRoll = false;
        }
        if (this.rollT > 0) this.rollT = Math.max(0, this.rollT - dt);
        if (this.rollT === 0 && this._wasRolling) this.rollCool = PLAYER.rollCooldown;
        this._wasRolling = this.rollT > 0;
        this._setBall(this.rolling);

        // Eixos relativos à câmera: frente = (sin camYaw, cos camYaw);
        // direita da tela = frente × cima = (-cos camYaw, sin camYaw).
        const sx = Math.sin(camYaw);
        const sz = Math.cos(camYaw);
        this._wish.set(
            input.axisY * sx - input.axisX * sz,
            0,
            input.axisY * sz + input.axisX * sx
        );
        const wishLen = this._wish.length();
        if (wishLen > 1) this._wish.multiplyScalar(1 / wishLen);

        const inWater = world.heightAt(this.position.x, this.position.z) < 0.12
            && this.position.y < 0.7;
        const accel = this.grounded ? PLAYER.accel : PLAYER.airAccel;
        const maxV = this.rolling ? PLAYER.rollSpeed : inWater ? PLAYER.swimSpeed : PLAYER.maxSpeed;
        const fric = this.grounded ? PLAYER.friction : PLAYER.airFriction;

        if (wishLen > 0.08) {
            this.vx += this._wish.x * accel * dt;
            this.vz += this._wish.z * accel * dt;
            this.yaw = Math.atan2(this._wish.x, this._wish.z);
        } else {
            this.vx = damp(this.vx, 0, fric, dt);
            this.vz = damp(this.vz, 0, fric, dt);
        }

        let spd = Math.hypot(this.vx, this.vz);
        if (spd > maxV) {
            this.vx *= maxV / spd;
            this.vz *= maxV / spd;
            spd = maxV;
        }

        const prevY = this.position.y;
        this.position.x += this.vx * dt;
        this.position.z += this.vz * dt;

        world.resolveWalls(this.position, PLAYER.radius, this.position.y);

        this.vy -= PLAYER.gravity * dt;
        this.position.y += this.vy * dt;

        const { floor, ride } = world.floorAt(
            this.position.x, this.position.z, prevY, PLAYER.radius
        );

        if (this.position.y <= floor + 0.02 && this.vy <= 0.4) {
            this.position.y = floor;
            this.vy = 0;
            if (!this.grounded) this.coyote = PLAYER.coyote;
            this.grounded = true;
            this.jumps = 0;
            if (ride?.mover) {
                this.position.x += ride.mover.dx || 0;
                this.position.z += ride.mover.dz || 0;
            }
            if (floor > 0.25 && !inWater) {
                this.lastSafe.set(this.position.x, floor, this.position.z);
            }
        } else {
            if (this.grounded) this.coyote = PLAYER.coyote;
            this.grounded = false;
        }

        if (inWater) {
            this.swimT += dt;
            this.position.y = Math.max(this.position.y, 0.18);
            if (this.vy < -2) this.vy = -2;
        } else {
            this.swimT = 0;
        }

        this._animate(dt, spd, inWater);
        let turn = wrapPi(this.yaw - this.mesh.rotation.y);
        this.mesh.rotation.y += turn * (1 - Math.exp(-25 * dt));

        if (this.blob) {
            this.blob.position.y = 0.04 - this.position.y * 0.002;
            const s = clamp(0.9 / (1 + Math.max(0, this.position.y - floor) * 0.35), 0.25, 1);
            this.blob.scale.setScalar(s);
        }

        const vis = this.invuln > 0 ? (Math.sin(this.anim * 28) > 0) : true;
        this.mesh.visible = vis;
    }

    _animate(dt, spd, inWater) {
        if (this.rolling && this.ball) {
            this.ball.rotation.x -= spd * dt * 2.4;
            this.mesh.position.y += Math.sin(this.anim * 18) * 0.02;
            return;
        }
        const walk = this.grounded && spd > 0.4;
        const bob = walk ? Math.sin(this.anim * 10) * 0.06 : 0;
        if (this.body) this.body.position.y = 0.52 + bob;
        if (this.head) {
            this.head.position.y = 0.58 + bob * 0.6;
            this.head.rotation.x = walk ? Math.sin(this.anim * 10) * 0.08 : 0;
        }
        if (this.legs) {
            this.legs.children.forEach((leg, i) => {
                const s = (i % 2 === 0) ? 1 : -1;
                leg.rotation.x = walk ? Math.sin(this.anim * 10) * 0.55 * s : 0;
            });
        }
        if (this.tail) this.tail.rotation.y = Math.sin(this.anim * 4) * 0.25;
        if (!this.grounded) {
            if (this.body) this.body.scale.set(1.05, 0.9, 1.05);
        } else {
            if (this.body) {
                const t = 12;
                this.body.scale.x = damp(this.body.scale.x, 1, t, dt);
                this.body.scale.y = damp(this.body.scale.y, 1, t, dt);
                this.body.scale.z = damp(this.body.scale.z, 1, t, dt);
            }
        }
        if (inWater && this.body) this.body.rotation.z = Math.sin(this.anim * 3) * 0.08;
        else if (this.body) this.body.rotation.z = 0;
    }

    respawn() {
        this.position.copy(this.lastSafe);
        this.position.y += 0.4;
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.invuln = 2;
        this.swimT = 0;
        this.rollT = 0;
        this._setBall(false);
    }
}
