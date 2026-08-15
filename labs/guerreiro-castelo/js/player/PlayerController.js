/**
 * Controlador de movimento do guerreiro: aceleração, física de gravidade, pulo, corrida e agachar.
 */

import { clamp } from '../utils/math.js';

export class PlayerController {
    constructor(player, collision) {
        this.player = player;
        this.collision = collision;
        this.walkSpeed = 2.35;
        this.runSpeed = 4.15;
        this.sprintSpeed = 6.1;
        this.crouchSpeed = 1.15;
        this.accel = 14;
        this.decel = 16;
        this.gravity = 22;
        this.jumpSpeed = 7.2;
        this.vx = 0;
        this.vz = 0;
        this.vy = 0;
        this.mode = 'walk';
    }

    setMode(mode) {
        this.mode = mode;
    }

    update(dt, input, camYaw) {
        const p = this.player;
        if (this.mode === 'helm' || this.mode === 'locked') {
            this.vx = 0;
            this.vz = 0;
            p.speed = 0;
            return;
        }

        const crouch = Boolean(input.move.crouch && p.grounded);
        p.collider.setCrouch(crouch);
        p.crouching = crouch;

        let wish = this.walkSpeed;
        if (crouch) wish = this.crouchSpeed;
        else if (input.move.sprint) wish = this.sprintSpeed;
        else if (Math.hypot(input.move.x, input.move.z) > 0.15) wish = this.runSpeed;

        const sin = Math.sin(camYaw);
        const cos = Math.cos(camYaw);
        const fx = -sin;
        const fz = -cos;
        const rx = cos;
        const rz = -sin;
        const wishX = (fx * -input.move.z + rx * input.move.x);
        const wishZ = (fz * -input.move.z + rz * input.move.x);
        const wlen = Math.hypot(wishX, wishZ);
        const tx = wlen > 0.001 ? (wishX / wlen) * wish : 0;
        const tz = wlen > 0.001 ? (wishZ / wlen) * wish : 0;

        const rate = wlen > 0.05 ? this.accel : this.decel;
        this.vx += (tx - this.vx) * Math.min(1, rate * dt);
        this.vz += (tz - this.vz) * Math.min(1, rate * dt);

        if (p.grounded && input.move.jump) {
            this.vy = this.jumpSpeed;
            p.grounded = false;
        }
        input.move.jump = false;

        this.vy -= this.gravity * dt;
        let y = p.position.y + this.vy * dt;

        const res = this.collision.resolveCapsule(
            p.position.x, y, p.position.z,
            p.collider.radius, p.collider.height,
            this.vx, this.vz, dt, 0.4
        );

        p.position.set(res.x, res.y, res.z);
        p.grounded = res.grounded;
        if (res.grounded && this.vy < 0) this.vy = 0;
        if (y < res.y && this.vy < 0) this.vy = 0;

        const speed = Math.hypot(this.vx, this.vz);
        p.speed = speed;
        p.sprinting = speed > 5.2 && input.move.sprint && !crouch;
        if (speed > 0.35) {
            p.facing = Math.atan2(this.vx, this.vz);
        }

        p.noise = crouch ? 0.22 : speed > 5.2 ? 1.35 : speed > 3 ? 0.85 : speed > 0.2 ? 0.55 : 0.05;
        return speed;
    }
}
