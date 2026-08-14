/**
 * Forrest no eixo −Z. Sempre corre: v = clamp(v0 + k·s, vMin, vMax).
 * Faixas discretas (0, 1, 2) interpoladas com damp.
 * Pulo: y' += JUMP_VY; y'' = −g; aterrissa em y = 0.
 * Passada: ω = strideHz · 2π · (v / v0); pernas/braços em seno defasado.
 */

import * as THREE from 'three';
import { ROAD, RUNNER } from './config.js';
import { clamp, damp } from './utils.js';
import { createForrest } from './models.js';

export class Player {
    constructor(scene) {
        this.root = createForrest(THREE);
        scene.add(this.root);
        this.reset({});
    }

    reset({ vMax = 24 } = {}) {
        this.lane = 1;
        this.x = 0;
        this.y = 0;
        this.z = 0;
        this.vy = 0;
        this.speed = RUNNER.v0;
        this.vMax = vMax;
        this.grounded = true;
        this.coyote = 0;
        this.jumpBuf = 0;
        this.invuln = 0;
        this.alive = true;
        this.auto = false;
        this.cycle = 0;
        this.stumble = 0;
        this.distance = 0;
        this.root.visible = true;
        this.root.position.set(0, 0, 0);
        this.root.rotation.set(0, 0, 0);
    }

    get laneX() {
        return (this.lane - 1) * ROAD.laneW;
    }

    tryLane(dir) {
        if (!this.alive) return;
        this.lane = clamp(this.lane + dir, 0, ROAD.lanes - 1);
    }

    tryJump() {
        this.jumpBuf = RUNNER.jumpBuffer;
    }

    hit() {
        if (this.invuln > 0 || !this.alive) return false;
        this.invuln = RUNNER.invuln;
        this.stumble = 0.55;
        this.speed *= RUNNER.stumbleSlow;
        return true;
    }

    sitDown() {
        this.alive = false;
        this.speed = 0;
    }

    update(dt, input, playing) {
        if (!this.alive) {
            this.applyPose(dt);
            return;
        }

        this.distance += this.speed * dt;
        const cap = this.vMax;
        const target = clamp(
            RUNNER.v0 + this.distance * RUNNER.accelPerMeter,
            RUNNER.vMin,
            cap
        );
        this.speed = damp(this.speed, target, RUNNER.recover, dt);

        if (playing && !this.auto) {
            if (input.laneLeft) this.tryLane(-1);
            if (input.laneRight) this.tryLane(1);
            if (input.jump) this.tryJump();
        } else if (this.auto) {
            if (Math.random() < 0.004) this.tryLane(Math.random() < 0.5 ? -1 : 1);
            if (Math.random() < 0.006) this.tryJump();
        }

        this.x = damp(this.x, this.laneX, RUNNER.laneLerp, dt);

        this.jumpBuf = Math.max(0, this.jumpBuf - dt);
        this.coyote = this.grounded ? RUNNER.coyote : Math.max(0, this.coyote - dt);
        if (this.jumpBuf > 0 && (this.grounded || this.coyote > 0)) {
            this.vy = RUNNER.jumpVy;
            this.grounded = false;
            this.coyote = 0;
            this.jumpBuf = 0;
            this._didJump = true;
        } else {
            this._didJump = false;
        }

        this.vy -= RUNNER.gravity * dt;
        this.y += this.vy * dt;
        if (this.y <= 0) {
            this.y = 0;
            this.vy = 0;
            this.grounded = true;
        }

        this.z -= this.speed * dt;
        this.invuln = Math.max(0, this.invuln - dt);
        this.stumble = Math.max(0, this.stumble - dt);

        const hz = RUNNER.strideHz * (this.speed / RUNNER.v0);
        this.cycle += dt * hz * Math.PI * 2;
        this.applyPose(dt);
    }

    applyPose() {
        const p = this.root.userData.parts;
        const swing = this.grounded ? Math.sin(this.cycle) : 0.15;
        const bob = this.grounded ? Math.abs(Math.sin(this.cycle)) * 0.05 : 0;
        const limp = this.stumble > 0 ? Math.sin(this.stumble * 22) * 0.12 : 0;

        p.legs[0].leg.rotation.x = swing * 0.95 + limp;
        p.legs[1].leg.rotation.x = -swing * 0.95;
        p.legs[0].shin.rotation.x = Math.max(0, -swing) * 0.55;
        p.legs[1].shin.rotation.x = Math.max(0, swing) * 0.55;
        p.arms[0].arm.rotation.x = -swing * 0.75;
        p.arms[1].arm.rotation.x = swing * 0.75;
        p.arms[0].arm.rotation.z = 0.12;
        p.arms[1].arm.rotation.z = -0.12;
        p.hips.position.y = bob;
        p.torso.rotation.y = swing * 0.08;
        p.torso.rotation.z = limp * 0.4;
        p.head.rotation.x = this.grounded ? -0.08 : 0.12;

        this.root.position.set(this.x, this.y, this.z);
        this.root.rotation.y = Math.PI;
        this.root.visible = this.invuln <= 0 || Math.sin(this.invuln * 28) > 0;

        if (!this.alive) {
            p.hips.rotation.x = 0.15;
            p.torso.rotation.x = 0.2;
            p.legs[0].leg.rotation.x = 1.1;
            p.legs[1].leg.rotation.x = 1.05;
            this.root.position.y = 0.05;
        }
    }

    bounds() {
        return { x: this.x, y: this.y, z: this.z, w: 0.55, l: 0.7 };
    }
}
