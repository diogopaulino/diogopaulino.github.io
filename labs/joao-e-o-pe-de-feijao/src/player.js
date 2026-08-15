/**
 * João em terceira pessoa no Babylon.js: movimento relativo à câmera, pulo com coyote,
 * trepar no caule e pouso em folhas-plataforma.
 */

import { PLAYER, CAMERA } from './config.js';
import { clamp, damp } from './utils.js';
import { buildJoao } from './models.js';

const B = window.BABYLON;

export class Player {
    constructor(scene) {
        this.scene = scene;
        const { group, parts } = buildJoao(scene);
        this.root = group;
        this.parts = parts;

        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vy = 0;
        this.yaw = 0;
        this.facing = 0;
        this.grounded = true;
        this.climbing = false;
        this.health = 3;
        this.maxHealth = 3;
        this.invuln = 0;
        this.walkPhase = 0;
        this.footTimer = 0;
        this.alive = true;
        this.camYaw = 0;
        this.camPitch = CAMERA.defaultPitch;
        this.camDist = CAMERA.distance;
        this.bob = 0;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.beans = 0;
        this.treasures = { gold: false, hen: false, harp: false };
        this.hasCow = false;
        this.hasAxe = false;
        this.sprinting = false;
    }

    get treasureCount() {
        return Number(this.treasures.gold) + Number(this.treasures.hen) + Number(this.treasures.harp);
    }

    setVisible(v) {
        if (this.root) this.root.setEnabled(Boolean(v));
    }

    spawn(x, z, yaw, heightAt, y) {
        this.x = x;
        this.z = z;
        this.y = y ?? heightAt(x, z);
        this.yaw = yaw;
        this.facing = yaw;
        this.camYaw = yaw + Math.PI;
        this.camPitch = CAMERA.defaultPitch;
        this.vy = 0;
        this.health = this.maxHealth;
        this.invuln = 0;
        this.alive = true;
        this.climbing = false;
        this.setVisible(true);
        this.sync();
    }

    hurt(amount = 1) {
        if (this.invuln > 0 || !this.alive) return false;
        this.health -= amount;
        this.invuln = PLAYER.invuln;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
        }
        return true;
    }

    update(dt, input, world) {
        this.invuln = Math.max(0, this.invuln - dt);

        const look = input.consumeLook();
        this.camYaw -= look.x * 0.0022;
        this.camPitch = clamp(this.camPitch - look.y * 0.0020, CAMERA.pitchMin, CAMERA.pitchMax);
        this.camDist = clamp(this.camDist + input.consumeZoom() * 0.55, CAMERA.minDistance, CAMERA.maxDistance);

        const move = input.move;
        let mx = move.x;
        let mz = move.z;
        const len = Math.hypot(mx, mz);
        if (len > 1) {
            mx /= len;
            mz /= len;
        }
        this.sprinting = Boolean(move.sprint && len > 0.2 && this.grounded);

        if (input.consumeJump()) this.jumpBuf = PLAYER.jumpBuffer;
        else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

        const climb = this._findClimb(world);
        if (climb && !this.climbing && this.jumpBuf > 0) {
            this.climbing = true;
            this.jumpBuf = 0;
            this.grounded = false;
        }
        const wantClimb = Boolean(climb && this.climbing);

        let jumped = false;
        let footstep = false;

        if (wantClimb && climb) {
            this.climbing = true;
            this.grounded = false;
            this.coyote = 0;
            const ang = Math.atan2(this.x - climb.x, this.z - climb.z);
            const newAng = ang + mx * dt * 1.9;
            const cr = climb.hold ?? climb.r * 0.62;
            this.x = climb.x + Math.sin(newAng) * cr;
            this.z = climb.z + Math.cos(newAng) * cr;
            this.vy = mz * PLAYER.climbSpeed;
            this.y += this.vy * dt;
            this.y = clamp(this.y, climb.yMin, climb.yMax);
            this.facing = newAng + Math.PI;
            this.walkPhase += dt * 8;
            if (this.jumpBuf > 0 && mz < 0.15) {
                this.climbing = false;
                this.vy = PLAYER.jump * 0.72;
                this.jumpBuf = 0;
                jumped = true;
                const kick = 2.4;
                this.x += Math.sin(this.facing) * kick * dt * 8;
                this.z += Math.cos(this.facing) * kick * dt * 8;
            }
        } else {
            this.climbing = false;
            const speed = (move.sprint ? PLAYER.sprint : PLAYER.walk);
            const sin = Math.sin(this.camYaw);
            const cos = Math.cos(this.camYaw);
            const fx = -sin;
            const fz = -cos;
            const rx = cos;
            const rz = -sin;
            let vx = (fx * mz + rx * mx) * speed;
            let vz = (fz * mz + rz * mx) * speed;

            if (len > 0.08) {
                this.facing = Math.atan2(vx, vz);
                this.walkPhase += dt * speed * 2.6;
                this.footTimer += dt * speed;
            } else {
                this.walkPhase = damp(this.walkPhase, 0, 8, dt);
                this.footTimer = 0;
            }

            let nx = this.x + vx * dt;
            let nz = this.z + vz * dt;
            const b = world.bounds;
            nx = clamp(nx, b.minX, b.maxX);
            nz = clamp(nz, b.minZ, b.maxZ);
            if (!this._blocked(nx, this.z, world)) this.x = nx;
            if (!this._blocked(this.x, nz, world)) this.z = nz;

            const ground = this._groundY(world);
            if (this.grounded) this.coyote = PLAYER.coyote;
            else this.coyote = Math.max(0, this.coyote - dt);

            if (this.jumpBuf > 0 && this.coyote > 0) {
                this.vy = PLAYER.jump;
                this.grounded = false;
                this.coyote = 0;
                this.jumpBuf = 0;
                jumped = true;
            }

            this.vy -= PLAYER.gravity * dt;
            if (!input.jumpHeld && this.vy > 1.2) this.vy -= PLAYER.gravity * dt * 0.55;
            this.y += this.vy * dt;

            if (this.vy <= 0 && this.y <= ground) {
                this.y = ground;
                this.vy = 0;
                this.grounded = true;
            } else {
                this.grounded = false;
            }

            if (this.y < world.voidY) {
                return { footstep: false, jumped: false, moving: false, fell: true };
            }
        }

        this.yaw = damp(this.yaw, this.facing, PLAYER.turnSpeed, dt);
        this.bob = Math.abs(Math.sin(this.walkPhase)) * (len > 0.08 && this.grounded ? 0.05 : 0);

        const gait = (this.grounded || this.climbing) && len > 0.08 ? Math.sin(this.walkPhase) : 0;
        if (this.parts?.legs?.length >= 2) {
            this.parts.legs[0].rotation.x = gait * 0.75;
            this.parts.legs[1].rotation.x = -gait * 0.75;
        }
        if (this.parts?.arms?.length >= 2) {
            this.parts.arms[0].rotation.x = -gait * 0.55;
            this.parts.arms[1].rotation.x = gait * 0.55;
        }
        if (this.parts?.torso) this.parts.torso.rotation.y = gait * 0.08;
        if (this.parts?.head) this.parts.head.rotation.y = gait * 0.05;

        if (!this.grounded && !this.climbing) {
            if (this.parts?.legs?.length >= 2) {
                this.parts.legs[0].rotation.x = -0.45;
                this.parts.legs[1].rotation.x = 0.35;
            }
            if (this.parts?.arms?.length >= 2) {
                this.parts.arms[0].rotation.x = 0.6;
                this.parts.arms[1].rotation.x = 0.6;
            }
        }

        const isBlinking = this.invuln > 0 && Math.sin(this.invuln * 28) <= 0;
        this.setVisible(!isBlinking);
        this.sync();

        footstep = this.grounded && this.footTimer > 0.36;
        if (footstep) this.footTimer = 0;
        return { footstep, jumped, moving: len > 0.08, fell: false, climbing: this.climbing };
    }

    _groundY(world) {
        let y = world.heightAt(this.x, this.z);
        for (const p of world.platforms) {
            const d = Math.hypot(this.x - p.x, this.z - p.z);
            if (d < p.r && this.y >= p.y - 0.55) y = Math.max(y, p.y);
        }
        return y;
    }

    _findClimb(world) {
        for (const c of world.climbs) {
            if (c.locked) continue;
            const d = Math.hypot(this.x - c.x, this.z - c.z);
            if (d < c.r && this.y >= c.yMin - 0.6 && this.y <= c.yMax + 0.8) return c;
        }
        return null;
    }

    _blocked(x, z, world) {
        const r = PLAYER.radius;
        for (const c of world.colliders) {
            if (c.ignoreY != null && Math.abs(this.y - c.ignoreY) > 3) continue;
            const dx = x - c.x;
            const dz = z - c.z;
            if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) return true;
        }
        return false;
    }

    sync() {
        if (!this.root) return;
        this.root.position.set(this.x, this.y + this.bob, this.z);
        this.root.rotation.y = this.yaw;
    }

    cameraPosition(target) {
        const dist = this.climbing ? this.camDist * 1.15 : this.camDist;
        const cp = this.camPitch;
        const cy = this.camYaw;
        const cx = this.x + Math.sin(cy) * Math.cos(cp) * dist;
        const cyPos = this.y + CAMERA.height + Math.sin(cp) * dist;
        const cz = this.z + Math.cos(cy) * Math.cos(cp) * dist;
        if (target.copyFromFloats) target.copyFromFloats(cx, cyPos, cz);
        else if (target.set) target.set(cx, cyPos, cz);
        return target;
    }

    lookAt(target) {
        const lx = this.x;
        const ly = this.y + CAMERA.lookY;
        const lz = this.z;
        if (target.copyFromFloats) target.copyFromFloats(lx, ly, lz);
        else if (target.set) target.set(lx, ly, lz);
        return target;
    }
}

