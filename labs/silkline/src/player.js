/**
 * Física do tecelão: corrida em telhados, queda e pêndulo da teia.
 *
 * A teia é uma restrição de distância (comprimento máximo). A velocidade
 * radial de afastamento é cortada; a tangencial vira o balanço. Recolher
 * o fio encurta o pêndulo e ganha altura.
 */

import * as THREE from 'three';
import { PHYS, CAMERA } from './config.js';
import { clamp, damp } from './utils.js';
import { buildHero, poseHero } from './hero.js';
import { SilkWeb } from './web.js';

const WISH = new THREE.Vector3();
const LOOK = new THREE.Vector3();
const RAD = new THREE.Vector3();
const TAN = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const WRIST = new THREE.Vector3();
const FWD = new THREE.Vector3();

export class Player {
    constructor(scene) {
        const hero = buildHero();
        this.root = hero.group;
        this.parts = hero.parts;
        scene.add(this.root);
        this.web = new SilkWeb(scene);

        this.pos = new THREE.Vector3();
        this.vel = new THREE.Vector3();
        this.anchor = new THREE.Vector3();
        this.yaw = 0;
        this.pitch = -0.12;
        this.facing = 0;
        this.grounded = false;
        this.swinging = false;
        this.webLen = 20;
        this.webMax = PHYS.webMax;
        this.gravity = PHYS.gravity;
        this.webCd = 0;
        this.phase = 0;
        this.invuln = 0;
        this.alive = true;
        this.auto = false;
        this.combo = 0;
        this.airTime = 0;
        this.justAttached = false;
        this.justReleased = false;
        this.missed = false;
        this.onRoof = false;
        this.camMode = 0;
        this.lookLock = false;
    }

    spawn(x, y, z, yaw = Math.PI) {
        this.pos.set(x, y, z);
        this.vel.set(0, 0, 0);
        this.yaw = yaw;
        this.pitch = 0.08;
        this.facing = yaw;
        this.grounded = true;
        this.swinging = false;
        this.web.release();
        this.webCd = 0;
        this.combo = 0;
        this.airTime = 0;
        this.invuln = 0;
        this.alive = true;
        this.sync();
    }

    lookDir(out = LOOK) {
        const cp = Math.cos(this.pitch);
        out.set(
            Math.sin(this.yaw) * cp,
            Math.sin(this.pitch),
            Math.cos(this.yaw) * cp
        );
        return out;
    }

    tryAttach(city) {
        const dir = this.lookDir();
        WRIST.copy(this.pos);
        WRIST.y += 1.35;
        const hit = city.pickAnchor(WRIST.x, WRIST.y, WRIST.z, dir.x, dir.y, dir.z, this.webMax);
        if (!hit) {
            this.missed = true;
            return false;
        }
        this.swinging = true;
        this.grounded = false;
        this.anchor.set(hit.point.x, hit.point.y, hit.point.z);
        this.webLen = clamp(hit.dist * 0.985, PHYS.webMin, this.webMax);
        this.web.attach(this.anchor);
        this.justAttached = true;
        this.webCd = PHYS.webCooldown;
        if (this.airTime > 0.12) this.combo += 1;
        return true;
    }

    release() {
        if (!this.swinging) return;
        this.swinging = false;
        this.web.release();
        this.justReleased = true;
        this.webCd = PHYS.webCooldown * 0.6;
    }

    hit() {
        if (this.invuln > 0 || !this.alive) return false;
        this.invuln = PHYS.invuln;
        this.release();
        this.vel.multiplyScalar(0.35);
        this.vel.y = Math.max(this.vel.y, 6);
        return true;
    }

    /**
     * @returns {{attached: boolean, released: boolean, missed: boolean, landed: boolean, splash: boolean}}
     */
    update(dt, input, city) {
        this.justAttached = false;
        this.justReleased = false;
        this.missed = false;
        const wasGround = this.grounded;
        this.webCd = Math.max(0, this.webCd - dt);
        this.invuln = Math.max(0, this.invuln - dt);

        if (this.auto) this.autopilot(dt, input, city);

        this.yaw -= input.lookX * CAMERA.mouse;
        this.pitch = clamp(this.pitch - input.lookY * CAMERA.mouse, CAMERA.pitchMin, CAMERA.pitchMax);

        if (input.webHeld && !this.swinging && this.webCd <= 0) this.tryAttach(city);
        if (this.swinging && !input.webHeld) this.release();

        if (this.swinging && input.reel) {
            this.webLen = Math.max(PHYS.webMin, this.webLen - PHYS.webReel * dt);
        }

        const jumpTap = input.jumpPressed;
        input.jumpPressed = false;

        const look = this.lookDir();
        RIGHT.set(look.z, 0, -look.x);
        if (RIGHT.lengthSq() < 1e-6) RIGHT.set(1, 0, 0);
        RIGHT.normalize();
        FWD.set(look.x, 0, look.z);
        if (FWD.lengthSq() < 1e-4) FWD.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
        FWD.normalize();
        WISH.copy(FWD).multiplyScalar(input.moveZ).addScaledVector(RIGHT, input.moveX);
        if (WISH.lengthSq() > 1) WISH.normalize();

        if (this.grounded) {
            const speed = input.moveZ !== 0 || input.moveX !== 0 ? PHYS.run : 0;
            this.vel.x = damp(this.vel.x, WISH.x * speed, PHYS.dragGround, dt);
            this.vel.z = damp(this.vel.z, WISH.z * speed, PHYS.dragGround, dt);
            this.vel.y = 0;
            if (input.jump) {
                this.vel.y = PHYS.jump;
                this.grounded = false;
                if (WISH.lengthSq() > 0.1) {
                    this.vel.x += WISH.x * 3.5;
                    this.vel.z += WISH.z * 3.5;
                }
            }
        } else {
            this.vel.y += this.gravity * dt;
            this.vel.x += WISH.x * PHYS.airControl * dt;
            this.vel.z += WISH.z * PHYS.airControl * dt;
            const drag = this.swinging ? PHYS.hangDamp : PHYS.dragAir;
            this.vel.x *= Math.max(0, 1 - drag * dt);
            this.vel.z *= Math.max(0, 1 - drag * dt);

            if (this.swinging && jumpTap) {
                TAN.copy(this.vel);
                if (TAN.lengthSq() < 1) TAN.copy(look);
                TAN.normalize();
                this.vel.addScaledVector(TAN, PHYS.swingJump);
                this.vel.y += 5.5;
                this.release();
            }
        }

        this.pos.x += this.vel.x * dt;
        this.pos.y += this.vel.y * dt;
        this.pos.z += this.vel.z * dt;

        if (this.swinging) this.constrainWeb(dt);

        this.resolveHits(city);
        const splash = this.snapGround(city);

        const spd = Math.hypot(this.vel.x, this.vel.y, this.vel.z);
        const cap = this.swinging ? PHYS.maxSwing : PHYS.maxAir;
        if (!this.grounded && spd > cap) {
            this.vel.multiplyScalar(cap / spd);
        }

        if (this.grounded) {
            this.airTime = 0;
            if (this.combo > 0 && spd < 4) this.combo = Math.max(0, this.combo - dt * 2.5);
        } else {
            this.airTime += dt;
        }

        if (WISH.lengthSq() > 0.05 && this.grounded) {
            this.facing = Math.atan2(WISH.x, WISH.z);
        } else if (!this.grounded) {
            const h = Math.hypot(this.vel.x, this.vel.z);
            if (h > 2) this.facing = Math.atan2(this.vel.x, this.vel.z);
        }

        this.phase += dt * (this.grounded ? 8 + spd : 4);
        this.animate(look);
        WRIST.copy(this.pos);
        WRIST.y += 1.25;
        this.web.update(WRIST);
        this.sync();

        return {
            attached: this.justAttached,
            released: this.justReleased,
            missed: this.missed,
            landed: !wasGround && this.grounded,
            splash
        };
    }

    constrainWeb(dt) {
        RAD.copy(this.pos).sub(this.anchor);
        const dist = RAD.length();
        if (dist < 0.001) return;
        RAD.multiplyScalar(1 / dist);
        if (dist > this.webLen) {
            this.pos.copy(this.anchor).addScaledVector(RAD, this.webLen);
            const vr = this.vel.dot(RAD);
            if (vr > 0) this.vel.addScaledVector(RAD, -vr * 1.08);
        }
        TAN.copy(WISH);
        TAN.y = Math.max(0, TAN.y);
        const radial = TAN.dot(RAD);
        TAN.addScaledVector(RAD, -radial);
        if (TAN.lengthSq() > 0.01) {
            TAN.normalize();
            this.vel.addScaledVector(TAN, 28 * dt);
        }
    }

    resolveHits(city) {
        const hit = city.collideSphere(this.pos.x, this.pos.y, this.pos.z, PHYS.radius);
        if (!hit) return;
        this.pos.x += hit.x * hit.depth;
        this.pos.y += hit.y * hit.depth;
        this.pos.z += hit.z * hit.depth;
        const vn = this.vel.x * hit.x + this.vel.y * hit.y + this.vel.z * hit.z;
        if (vn < 0) {
            this.vel.x -= hit.x * vn * (1 + PHYS.bounce);
            this.vel.y -= hit.y * vn * (1 + PHYS.bounce);
            this.vel.z -= hit.z * vn * (1 + PHYS.bounce);
            if (this.swinging && vn < -22) this.release();
        }
    }

    snapGround(city) {
        if (city.isWater(this.pos.x, this.pos.z) && this.pos.y < 2.5) {
            return true;
        }
        const feet = this.pos.y - PHYS.radius;
        const surface = city.heightAt(this.pos.x, this.pos.z);
        this.onRoof = surface > 2;
        if (!this.swinging && this.vel.y <= 2.5 && feet <= surface + 0.35 && feet > surface - 1.8) {
            this.pos.y = surface + PHYS.radius;
            this.vel.y = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
        if (this.pos.y < -6) return true;
        return false;
    }

    autopilot(dt, input, city) {
        input.moveZ = 1;
        input.moveX = Math.sin(this.phase * 0.15) * 0.2;
        input.lookX = Math.sin(this.phase * 0.08) * 0.4;
        input.lookY = 0;
        input.webHeld = true;
        input.reel = this.webLen > 28;
        if (this.grounded) input.jump = true;
        if (this.swinging) {
            RAD.copy(this.pos).sub(this.anchor).normalize();
            const goingUp = this.vel.y > 4;
            const steep = RAD.y < -0.82;
            if ((goingUp && steep) || this.webLen < 12) input.webHeld = false;
        }
        if (!this.swinging && this.pos.y < 22) {
            this.pitch = 0.35;
        } else {
            this.pitch = damp(this.pitch, -0.08, 2, dt);
        }
    }

    animate(look) {
        const spd = Math.hypot(this.vel.x, this.vel.z);
        poseHero(this.parts, {
            grounded: this.grounded,
            swinging: this.swinging,
            speed: spd,
            phase: this.phase,
            lookPitch: this.pitch
        });
        this.root.rotation.set(0, this.facing, 0);
        if (this.swinging) {
            RAD.copy(this.pos).sub(this.anchor).normalize();
            this.root.rotation.x = clamp(-RAD.y * 0.45, -0.5, 0.6);
        }
    }

    sync() {
        this.root.position.copy(this.pos);
        this.root.position.y -= PHYS.radius;
    }

    get speed() {
        return Math.hypot(this.vel.x, this.vel.y, this.vel.z);
    }

    get lockOn() {
        return this.lookLock;
    }
}
