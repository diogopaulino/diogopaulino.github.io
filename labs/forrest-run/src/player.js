/**
 * Forrest Gump em Babylon.js — Cinemática, Física de Corrida e Animação Orgânica.
 *
 * Movimento: corre no eixo −Z; faixas discretas (0, 1, 2) interpoladas com amortecimento suave.
 * Pulo: y' = JUMP_VY; y'' = −g; coyote time + jump buffering.
 * Passada: ω = strideHz · 2π · (v / v0); esqueleto hierárquico com inclinação e balanço natural.
 */

import { ROAD, RUNNER } from './config.js';
import { clamp, damp, lerp } from './utils.js';
import { createForrest } from './models.js';

export class Player {
    constructor(scene, shadowGenerator) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.root = createForrest(scene, shadowGenerator);
        this.root.scaling.setAll(1.15);
        this.reset({});
    }

    reset({ vMax = 25 } = {}) {
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
        this.bankAngle = 0;
        this.root.setEnabled(true);
        this.root.position.set(0, 0, 0);
        this.root.rotation.set(0, Math.PI, 0);
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
        const targetSpeed = clamp(
            RUNNER.v0 + this.distance * RUNNER.accelPerMeter,
            RUNNER.vMin,
            cap
        );
        this.speed = damp(this.speed, targetSpeed, RUNNER.recover, dt);

        if (playing && !this.auto) {
            if (input.laneLeft) this.tryLane(-1);
            if (input.laneRight) this.tryLane(1);
            if (input.jump) this.tryJump();
        } else if (this.auto) {
            if (Math.random() < 0.005) this.tryLane(Math.random() < 0.5 ? -1 : 1);
            if (Math.random() < 0.008) this.tryJump();
        }

        const prevX = this.x;
        this.x = damp(this.x, this.laneX, RUNNER.laneLerp, dt);
        const vx = (this.x - prevX) / Math.max(0.001, dt);
        this.bankAngle = damp(this.bankAngle, -vx * 0.045, 12, dt);

        // Sistema de Pulo com Coyote Time e Jump Buffer
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

        // Frequência de passada sincronizada com a velocidade
        const hz = RUNNER.strideHz * (this.speed / RUNNER.v0);
        this.cycle += dt * hz * Math.PI * 2;
        this.applyPose(dt);
    }

    applyPose(dt) {
        const p = this.root.metadata.parts;
        const swing = this.grounded ? Math.sin(this.cycle) : 0.2;
        const bob = this.grounded ? Math.abs(Math.sin(this.cycle)) * 0.06 : 0;
        const limp = this.stumble > 0 ? Math.sin(this.stumble * 24) * 0.16 : 0;
        const speedLean = (this.speed / RUNNER.v0) * 0.08;

        // Pernas (Quadril, Joelho e Pé)
        p.legs[0].leg.rotation.x = swing * 1.05 + limp;
        p.legs[1].leg.rotation.x = -swing * 1.05;

        p.legs[0].shin.rotation.x = Math.max(0, -swing) * 0.75;
        p.legs[1].shin.rotation.x = Math.max(0, swing) * 0.75;

        p.legs[0].foot.rotation.x = -swing * 0.2;
        p.legs[1].foot.rotation.x = swing * 0.2;

        // Braços
        p.arms[0].arm.rotation.x = -swing * 0.9;
        p.arms[1].arm.rotation.x = swing * 0.9;
        p.arms[0].arm.rotation.z = 0.12;
        p.arms[1].arm.rotation.z = -0.12;
        p.arms[0].forearm.rotation.x = 0.35 + Math.max(0, -swing) * 0.3;
        p.arms[1].forearm.rotation.x = 0.35 + Math.max(0, swing) * 0.3;

        // Tronco, Quadris e Cabeça
        p.hips.position.y = 0.95 + bob;
        p.torso.rotation.x = speedLean;
        p.torso.rotation.y = swing * 0.09;
        p.torso.rotation.z = this.bankAngle + limp * 0.35;
        p.head.rotation.x = this.grounded ? -0.06 : 0.14;
        p.head.rotation.z = -this.bankAngle * 0.5;

        this.root.position.set(this.x, this.y, this.z);
        this.root.rotation.y = Math.PI;

        // Efeito de piscar na invulnerabilidade
        if (this.invuln > 0) {
            this.root.setEnabled(Math.sin(this.invuln * 32) > 0);
        } else {
            this.root.setEnabled(true);
        }

        // Posição de sentar ("Estou bastante cansado...")
        if (!this.alive) {
            p.hips.position.y = 0.35;
            p.hips.rotation.x = 0.3;
            p.torso.rotation.x = 0.35;
            p.legs[0].leg.rotation.x = 1.35;
            p.legs[1].leg.rotation.x = 1.25;
            p.legs[0].shin.rotation.x = 0.8;
            p.legs[1].shin.rotation.x = 0.75;
            p.arms[0].arm.rotation.x = 0.4;
            p.arms[1].arm.rotation.x = 0.4;
            this.root.position.y = 0.05;
        }
    }

    bounds() {
        return {
            x: this.x,
            y: this.y,
            z: this.z,
            w: 0.65,
            l: 0.85,
            h: 1.85
        };
    }
}
