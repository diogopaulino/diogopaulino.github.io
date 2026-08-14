/**
 * Nico em terceira pessoa — movimento relativo à câmera Lakitu e o kit
 * de pulos da Cúpola 64 (simples, duplo, triplo, long jump, pound, dive).
 */

import * as THREE from 'three';
import { PLAYER, CAMERA, ISLAND } from './config.js';
import { clamp, damp, wrapPi, lerpAngle } from './utils.js';
import { createNico } from './models.js';

export class Player {
    constructor(scene) {
        const { root, parts } = createNico();
        this.root = root;
        this.parts = parts;
        scene.add(root);

        this.x = 0;
        this.y = 1;
        this.z = 12;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.facing = 0;
        this.yaw = 0;
        this.grounded = true;
        this.swimming = false;
        this.pounding = false;
        this.diving = false;
        this.inCannon = false;
        this.cannonT = 0;
        this.jumpCombo = 0;
        this.landTimer = 0;
        this.jumpHeld = false;
        this.invuln = 0;
        this.starPose = 0;
        this.hurtT = 0;
        this.walkPhase = 0;
        this.squash = 1;
        this.lives = 4;
        this.alive = true;

        this.camYaw = Math.PI;
        this.camPhi = CAMERA.phi;
        this.camDist = CAMERA.distance;
        this._dYaw = Math.PI;
        this._dPhi = CAMERA.phi;
        this._dDist = CAMERA.distance;
        this._camPos = new THREE.Vector3();
        this._look = new THREE.Vector3();
        this._fwd = new THREE.Vector3();
        this._right = new THREE.Vector3();

        this.spawn();
    }

    spawn(world) {
        this.x = 0;
        this.z = 12;
        this.y = world ? world.groundAt(0, 12, 40) : 1.6;
        this.vx = this.vy = this.vz = 0;
        this.facing = 0;
        this.yaw = 0;
        this.grounded = true;
        this.swimming = false;
        this.pounding = false;
        this.diving = false;
        this.inCannon = false;
        this.jumpCombo = 0;
        this.invuln = 1.1;
        this.starPose = 0;
        this.hurtT = 0;
        this.alive = true;
        this.camYaw = this._dYaw = Math.PI;
        this.camPhi = this._dPhi = CAMERA.phi;
        this.root.visible = true;
        this.sync();
    }

    get position() {
        return this.root.position;
    }

    hurt() {
        if (this.invuln > 0 || this.starPose > 0 || !this.alive) return false;
        this.lives -= 1;
        this.invuln = PLAYER.invuln;
        this.hurtT = 0.45;
        this.vy = 8;
        this.grounded = false;
        if (this.lives <= 0) {
            this.alive = false;
            this.lives = 0;
        }
        return true;
    }

    /**
     * @returns {{ jumped: boolean, landed: boolean, pounded: boolean, dived: boolean, cannon: boolean, swam: boolean }}
     */
    update(dt, input, world, camera) {
        const flags = { jumped: false, landed: false, pounded: false, dived: false, cannon: false, swam: false };
        this.invuln = Math.max(0, this.invuln - dt);
        this.hurtT = Math.max(0, this.hurtT - dt);
        this.landTimer = Math.max(0, this.landTimer - dt);
        this.starPose = Math.max(0, this.starPose - dt);
        this._world = world;

        input.sample();
        this._camera(dt, input, world, camera);
        if (this.starPose > 0) {
            this._animate(dt, 0, true);
            this.sync();
            return flags;
        }

        if (this.inCannon) {
            this._cannonUpdate(dt, input, world, flags);
            this.sync();
            return flags;
        }

        if (world.nearCannon(this.x, this.z) && this.grounded && input.consumeJump()) {
            this.inCannon = true;
            this.cannonT = 0;
            flags.cannon = true;
            this.sync();
            return flags;
        }

        const ax = input.axisX;
        const az = input.axisY;
        const mag = Math.hypot(ax, az);
        const crouch = input.crouchHeld;

        const sin = Math.sin(this.camYaw);
        const cos = Math.cos(this.camYaw);
        const fx = -sin;
        const fz = -cos;
        const rx = cos;
        const rz = -sin;

        let wishX = (fx * az + rx * ax);
        let wishZ = (fz * az + rz * ax);
        const wlen = Math.hypot(wishX, wishZ);
        if (wlen > 1) {
            wishX /= wlen;
            wishZ /= wlen;
        }

        this.swimming = world.isWater(this.x, this.z, this.y);
        if (this.swimming && this.y <= ISLAND.waterY + 1.05) {
            flags.swam = true;
            this._swim(dt, wishX, wishZ, mag, input, world, flags);
        } else {
            this._move(dt, wishX, wishZ, mag, crouch, input, world, flags);
        }

        this.yaw = lerpAngle(this.yaw, this.facing, 1 - Math.exp(-PLAYER.turn * dt));
        this._animate(dt, mag, crouch);
        this.sync();

        this.root.visible = this.invuln <= 0 || Math.sin(this.invuln * 28) > 0;
        return flags;
    }

    _move(dt, wishX, wishZ, mag, crouch, input, world, flags) {
        const running = mag > 0.72 && !crouch;
        const max = this.grounded
            ? (crouch ? PLAYER.walk * 0.45 : (running ? PLAYER.run : PLAYER.walk * (0.45 + mag * 0.55)))
            : PLAYER.run;
        const acc = this.grounded ? PLAYER.accel : PLAYER.airAccel;

        if (mag > 0.08 && !this.pounding) {
            this.vx += wishX * acc * dt;
            this.vz += wishZ * acc * dt;
            this.facing = Math.atan2(wishX, wishZ);
        }

        const spd = Math.hypot(this.vx, this.vz);
        if (this.grounded) {
            const fr = mag > 0.08 ? 2.2 : PLAYER.friction;
            const keep = Math.exp(-fr * dt);
            this.vx *= keep;
            this.vz *= keep;
            const n = Math.hypot(this.vx, this.vz);
            if (n > max) {
                this.vx *= max / n;
                this.vz *= max / n;
            }
        } else {
            const n = Math.hypot(this.vx, this.vz);
            if (n > PLAYER.run * 1.35) {
                this.vx *= PLAYER.run * 1.35 / n;
                this.vz *= PLAYER.run * 1.35 / n;
            }
        }

        if (this.pounding) {
            this.vx *= Math.exp(-10 * dt);
            this.vz *= Math.exp(-10 * dt);
        }

        const jump = input.consumeJump();
        if (jump && this.grounded) {
            const speed = Math.hypot(this.vx, this.vz);
            if (crouch && speed > 7.5) {
                this.vy = PLAYER.jumpLong;
                this.vx *= PLAYER.longBoost;
                this.vz *= PLAYER.longBoost;
                this.jumpCombo = 0;
            } else if (this.jumpCombo >= 2 && this.landTimer > 0 && speed > 6) {
                this.vy = PLAYER.jumpTri;
                this.jumpCombo = 0;
            } else if (this.jumpCombo === 1 && this.landTimer > 0) {
                this.vy = PLAYER.jumpDbl;
                this.jumpCombo = 2;
            } else {
                this.vy = PLAYER.jump;
                this.jumpCombo = 1;
            }
            this.grounded = false;
            this.jumpHeld = true;
            flags.jumped = true;
            this.squash = 1.22;
        } else if (jump && !this.grounded && !this.pounding && !this.diving) {
            if (crouch) {
                this.pounding = true;
                this.vy = PLAYER.poundVy;
                flags.pounded = true;
            } else {
                this.diving = true;
                this.vy = PLAYER.diveY;
                this.vx += Math.sin(this.facing) * PLAYER.diveBoost;
                this.vz += Math.cos(this.facing) * PLAYER.diveBoost;
                flags.dived = true;
            }
        }

        if (!this.grounded && this.jumpHeld && this.vy > 0 && !input.jumpDown) {
            this.vy *= 0.48;
            this.jumpHeld = false;
        }
        if (this.grounded) this.jumpHeld = false;

        const g = this.vy < 0 ? PLAYER.fallGravity : PLAYER.gravity;
        this.vy -= (this.pounding ? g * 1.35 : g) * dt;

        let nx = this.x + this.vx * dt;
        let nz = this.z + this.vz * dt;
        const hit = world.collide(nx, nz, PLAYER.radius);
        if (hit.x !== nx || hit.z !== nz) {
            this.vx *= 0.35;
            this.vz *= 0.35;
            if (!this.grounded && this.vy > 2 && mag > 0.2) {
                this.vy = PLAYER.jump * 0.82;
                this.facing += Math.PI;
                flags.jumped = true;
            }
        }
        nx = hit.x;
        nz = hit.z;

        this.y += this.vy * dt;
        const ground = world.groundAt(nx, nz, this.y);
        if (this.vy <= 0 && this.y <= ground) {
            const wasAir = !this.grounded;
            this.y = ground;
            if (this.pounding) flags.pounded = true;
            this.vy = 0;
            this.grounded = true;
            this.pounding = false;
            this.diving = false;
            if (wasAir) {
                flags.landed = true;
                this.landTimer = this.jumpCombo >= 2 ? PLAYER.tripleWindow : PLAYER.comboWindow;
                this.squash = 0.72;
            }
        } else if (this.y > ground + 0.04) {
            this.grounded = false;
        }

        this.x = nx;
        this.z = nz;
        if (this.y < ISLAND.fallY) this._fall();
    }

    _swim(dt, wishX, wishZ, mag, input, world, flags) {
        this.pounding = false;
        this.diving = false;
        this.y = damp(this.y, ISLAND.waterY + 0.72, 6, dt);
        this.vy *= Math.exp(-4 * dt);
        if (mag > 0.08) {
            this.vx += wishX * 18 * dt;
            this.vz += wishZ * 18 * dt;
            this.facing = Math.atan2(wishX, wishZ);
        }
        this.vx *= Math.exp(-3.5 * dt);
        this.vz *= Math.exp(-3.5 * dt);
        const n = Math.hypot(this.vx, this.vz);
        if (n > PLAYER.swim) {
            this.vx *= PLAYER.swim / n;
            this.vz *= PLAYER.swim / n;
        }
        const hit = world.collide(this.x + this.vx * dt, this.z + this.vz * dt, PLAYER.radius);
        this.x = hit.x;
        this.z = hit.z;
        if (input.consumeJump()) {
            this.vy = PLAYER.jump * 0.72;
            this.grounded = false;
            this.swimming = false;
            flags.jumped = true;
        }
    }

    _cannonUpdate(dt, input, world, flags) {
        this.cannonT += dt;
        const c = world.cannonPos;
        this.x = c.x;
        this.z = c.z;
        this.y = c.y + 0.8;
        this.vx = this.vz = this.vy = 0;
        if (world.cannon) world.cannon.rotation.y += input.axisX * dt * 1.4;
        if (input.consumeJump() && this.cannonT > 0.2) {
            const t = world.cannonTarget;
            const dir = new THREE.Vector3(t.x - this.x, t.y + 4 - this.y, t.z - this.z).normalize();
            this.vx = dir.x * 22;
            this.vy = dir.y * 22;
            this.vz = dir.z * 22;
            this.inCannon = false;
            this.grounded = false;
            flags.cannon = true;
            flags.jumped = true;
        }
    }

    _fall() {
        this.hurt();
        if (this.alive) this.spawn(this._world);
    }

    _camera(dt, input, world, camera) {
        const look = input.consumeLook();
        this._dYaw -= look.dx * 0.005 + input.camX * CAMERA.rotate * dt;
        this._dPhi = clamp(this._dPhi + look.dy * 0.0035, CAMERA.phiMin, CAMERA.phiMax);
        this._dDist = clamp(this._dDist + look.zoom * 0.012, CAMERA.minDistance, CAMERA.maxDistance);

        this.camYaw = damp(this.camYaw, this._dYaw, CAMERA.lag, dt);
        this.camPhi = damp(this.camPhi, this._dPhi, CAMERA.lag, dt);
        this.camDist = damp(this.camDist, this._dDist, 6, dt);

        const dist = this.camDist;
        const ox = Math.sin(this.camYaw) * Math.sin(this.camPhi) * dist;
        const oy = Math.cos(this.camPhi) * dist + CAMERA.height;
        const oz = Math.cos(this.camYaw) * Math.sin(this.camPhi) * dist;
        let cx = this.x + ox;
        let cy = this.y + oy;
        let cz = this.z + oz;
        const floor = world.cameraClearance(cx, cz);
        if (cy < floor) cy = floor;
        this._camPos.set(cx, cy, cz);
        this._look.set(this.x, this.y + 1.15, this.z);
        camera.position.copy(this._camPos);
        camera.lookAt(this._look);
    }

    _animate(dt, mag, crouch) {
        this.squash = damp(this.squash, 1, 10, dt);
        const moving = this.grounded && mag > 0.08;
        if (moving) this.walkPhase += dt * (8 + mag * 10);
        else this.walkPhase = damp(this.walkPhase, 0, 8, dt);

        const gait = moving ? Math.sin(this.walkPhase) : 0;
        this.parts.legL.rotation.x = gait * 0.7;
        this.parts.legR.rotation.x = -gait * 0.7;
        this.parts.armL.rotation.x = -gait * 0.65;
        this.parts.armR.rotation.x = gait * 0.65;
        this.parts.hips.position.y = 0.38 + Math.abs(gait) * 0.05;
        this.parts.hips.rotation.z = gait * 0.08;
        this.parts.head.rotation.x = this.diving ? 0.6 : (this.pounding ? 0.4 : 0);
        this.parts.emblem.rotation.y += dt * 3;

        if (this.starPose > 0) {
            this.parts.armL.rotation.z = 1.1;
            this.parts.armR.rotation.z = -1.1;
            this.parts.armL.rotation.x = -0.4;
            this.parts.armR.rotation.x = -0.4;
            this.root.rotation.y += dt * 4.5;
        } else if (crouch && this.grounded) {
            this.parts.hips.scale.set(1.08, 0.72, 1.08);
        } else if (!this.grounded) {
            this.parts.armL.rotation.z = 0.7;
            this.parts.armR.rotation.z = -0.7;
            this.parts.hips.scale.set(this.squash, 2 - this.squash, this.squash);
        } else {
            this.parts.armL.rotation.z = 0;
            this.parts.armR.rotation.z = 0;
            this.parts.hips.scale.set(this.squash, 2 - this.squash, this.squash);
        }

        const sp = Math.hypot(this.vx, this.vz);
        this.parts.shadow.scale.setScalar(clamp(1.1 - this.y * 0.04, 0.35, 1.2));
        this.parts.shadow.visible = this.grounded || this.y < 8;
        this.root.rotation.x = this.diving ? 0.85 : (sp > 10 && this.grounded ? -0.08 : 0);
        if (this.starPose <= 0) this.root.rotation.y = this.yaw;
    }

    sync() {
        this.root.position.set(this.x, this.y, this.z);
    }

    celebrate() {
        this.starPose = 2.4;
        this.vx = this.vz = 0;
        this.vy = 2.2;
    }
}
