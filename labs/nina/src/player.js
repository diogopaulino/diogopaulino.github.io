/**
 * Nina corre e pula em terceira pessoa.
 * Câmera orbita com inércia, baixa e próxima (a grama fica em primeiro plano);
 * o movimento é relativo ao yaw da câmera.
 *
 * Nina é uma raposa jovem de gfx/creature.js (idade 0,6, escala 1,7). A andadura
 * vem da velocidade real (ver gaitFor em animals.js): passo, trote ou galope; no
 * ar ela estica o galope e o corpo acompanha a parábola:
 *   inclinação = clamp(−vy·0,055, −0,45, 0,5) rad   (focinho para cima subindo, para baixo caindo)
 * Parada por 6 s ela senta; o olhar segue o filhote perdido mais próximo (< 12 m).
 *
 * Câmera: alvo = Nina + 0,62 m; posição = alvo + esférico(raio, φ, θ) e nunca abaixo
 * de chão + 0,32 m. Andar de lado gira a câmera devagar atrás dela:
 *   θ −= eixo.x · 0,9 rad/s
 *
 * Trilha de migalhas (para a fila de filhotes): um ponto a cada 0,2 m andados,
 * num anel de 512 pontos (~100 m).
 */

import * as THREE from 'three';
import { createCreature } from '../../shared/gfx/creature.js';
import { gaitFor } from './animals.js?v=20';
import {
    WALK_SPEED, RUN_SPEED, ACCEL, FRICTION, JUMP_VY, GRAVITY,
    COYOTE, HOP_BOOST, clampToWorld
} from './config.js?v=20';

const TRAIL_N = 512;
const TRAIL_STEP = 0.2;
const UP = new THREE.Vector3(0, 1, 0);

export class Player {
    constructor(scene, camera, detail = 2) {
        this.scene = scene;
        this.camera = camera;
        this.creature = createCreature('fox', { detail, age: 0.6, scale: 1.7 });
        this.mesh = this.creature.object;
        this.mesh.name = 'nina';
        this.mesh.rotation.order = 'YXZ';
        this.mesh.traverse((o) => {
            if (o.isMesh) {
                o.castShadow = true;
                o.receiveShadow = true;
            }
        });
        scene.add(this.mesh);

        this.vel = new THREE.Vector3();
        this.yaw = Math.PI;
        this.spherical = new THREE.Spherical(4.8, 1.37, 0.2);
        this.desired = this.spherical.clone();
        this.lookTarget = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.right = new THREE.Vector3();
        this.tmp = new THREE.Vector3();
        this.head = new THREE.Vector3();
        this.coyote = 0;
        this.grounded = true;
        this.swim = false;
        this.berries = 0;
        this.minR = 2.4;
        this.maxR = 11;
        this.idleT = 0;
        this.pitch = 0;
        this.speed = 0;
        this.lookAt = null;
        this.anim = { mode: 'idle', speed: 0, lookAt: null, groundFn: null, turn: 0 };
        this.trample = 0.95;

        this.trailX = new Float32Array(TRAIL_N);
        this.trailZ = new Float32Array(TRAIL_N);
        this.trailHead = 0;
        this.trailCount = 0;
        /** Ponto da trilha a `dist` metros atrás de Nina; false se a trilha ainda é curta. */
        this.trailAt = (dist, out) => {
            const n = Math.round(dist / TRAIL_STEP);
            if (n >= this.trailCount) return false;
            const i = (this.trailHead - 1 - n + TRAIL_N * 2) % TRAIL_N;
            out.set(this.trailX[i], 0, this.trailZ[i]);
            return true;
        };
    }

    reset(valley) {
        const y = valley ? valley.groundHeight(0, 6.5) : 0;
        this.mesh.position.set(0, y, 6.5);
        this.vel.set(0, 0, 0);
        this.yaw = Math.PI;
        this.spherical.set(4.8, 1.37, 0.2);
        this.desired.copy(this.spherical);
        this.berries = 0;
        this.coyote = 0;
        this.idleT = 0;
        this.pitch = 0;
        this.trailCount = 0;
        this.trailHead = 0;
        this.mesh.rotation.set(0, this.yaw, 0);
        this.lookTarget.copy(this.mesh.position).y += 0.62;
        this.camera.position.setFromSpherical(this.spherical).add(this.lookTarget);
        this.camera.lookAt(this.lookTarget);
    }

    get pos() {
        return this.mesh.position;
    }

    _pushTrail(x, z) {
        if (this.trailCount) {
            const i = (this.trailHead - 1 + TRAIL_N) % TRAIL_N;
            if (Math.hypot(x - this.trailX[i], z - this.trailZ[i]) < TRAIL_STEP) return;
        }
        this.trailX[this.trailHead] = x;
        this.trailZ[this.trailHead] = z;
        this.trailHead = (this.trailHead + 1) % TRAIL_N;
        if (this.trailCount < TRAIL_N) this.trailCount++;
    }

    update(dt, input, look, valley) {
        this.desired.theta -= look.dx * 0.005 + input.axis.x * 0.9 * dt;
        this.desired.phi = THREE.MathUtils.clamp(this.desired.phi + look.dy * 0.004, 0.7, 1.5);
        this.desired.radius = THREE.MathUtils.clamp(
            this.desired.radius + look.zoom * 0.006,
            this.minR,
            this.maxR
        );
        this.spherical.theta = THREE.MathUtils.damp(this.spherical.theta, this.desired.theta, 8, dt);
        this.spherical.phi = THREE.MathUtils.damp(this.spherical.phi, this.desired.phi, 8, dt);
        this.spherical.radius = THREE.MathUtils.damp(this.spherical.radius, this.desired.radius, 6, dt);

        this.camera.getWorldDirection(this.forward);
        this.forward.y = 0;
        this.forward.normalize();
        this.right.crossVectors(this.forward, UP).normalize();

        // na água ela nada devagar
        const cap = (input.run ? RUN_SPEED : WALK_SPEED) * (this.swim ? 0.5 : 1);
        const wishX = this.right.x * input.axis.x + this.forward.x * -input.axis.z;
        const wishZ = this.right.z * input.axis.x + this.forward.z * -input.axis.z;
        this.vel.x += wishX * ACCEL * dt;
        this.vel.z += wishZ * ACCEL * dt;
        this.vel.x *= Math.exp(-FRICTION * dt);
        this.vel.z *= Math.exp(-FRICTION * dt);
        const hz = Math.hypot(this.vel.x, this.vel.z);
        if (hz > cap) {
            this.vel.x *= cap / hz;
            this.vel.z *= cap / hz;
        }

        const p = this.mesh.position;
        const h = this.creature.height;
        const ground = valley.floorY(p.x, p.z, h);
        this.grounded = p.y <= ground + 0.06;
        if (this.grounded) {
            this.coyote = COYOTE;
            p.y = ground;
            if (this.vel.y < 0) this.vel.y = 0;
        } else {
            this.coyote -= dt;
            this.vel.y -= GRAVITY * dt;
        }

        p.addScaledVector(this.vel, dt);
        const clamped = clampToWorld(p.x, p.z);
        p.x = clamped.x;
        p.z = clamped.z;
        valley.collide(p, 0.42);
        const g2 = valley.floorY(p.x, p.z, h);
        this.swim = valley.swimming && p.y <= g2 + 0.08;
        if (p.y < g2) {
            p.y = g2;
            this.vel.y = 0;
            this.grounded = true;
        }

        const moving = hz > 0.45;
        let turn = 0;
        if (moving) {
            const targetYaw = Math.atan2(this.vel.x, this.vel.z);
            const delta = ((targetYaw - this.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
            this.yaw += delta * Math.min(1, dt * 9);
            turn = THREE.MathUtils.clamp(delta * 1.4, -1, 1);
        }
        this.speed = hz;
        this.idleT = moving || !this.grounded ? 0 : this.idleT + dt;

        // corpo acompanha a parábola do pulo
        const wantPitch = this.grounded ? 0 : THREE.MathUtils.clamp(-this.vel.y * 0.055, -0.45, 0.5);
        this.pitch = THREE.MathUtils.damp(this.pitch, wantPitch, 12, dt);
        this.mesh.rotation.set(this.pitch, this.yaw, 0);

        const a = this.anim;
        if (!this.grounded) {
            a.mode = 'run';
            a.speed = Math.max(hz, 3.5);
            a.groundFn = null;
        } else if (this.swim) {
            a.mode = 'swim';
            a.groundFn = null;
        } else {
            a.mode = this.idleT > 6 ? 'sit' : gaitFor(this.creature, hz);
            a.speed = hz;
            a.groundFn = valley.groundFn;
        }
        a.turn = turn;
        a.lookAt = moving ? null : this.lookAt;
        this.creature.update(dt, a);
        if (this.grounded && !this.swim) this._pushTrail(p.x, p.z);

        this.head.set(p.x + Math.sin(this.yaw) * 0.5, p.y + h * 0.9, p.z + Math.cos(this.yaw) * 0.5);

        this.tmp.set(p.x, p.y + 0.62, p.z);
        this.lookTarget.lerp(this.tmp, 1 - Math.pow(0.001, dt));
        this.tmp.setFromSpherical(this.spherical).add(this.lookTarget);
        this.camera.position.lerp(this.tmp, 1 - Math.pow(0.0008, dt));
        const floor = valley.groundHeight(this.camera.position.x, this.camera.position.z) + 0.32;
        if (this.camera.position.y < floor) this.camera.position.y = floor;
        this.camera.lookAt(this.lookTarget);
    }

    /** Fora do jogo (menu/pausa): só respira e mexe a cauda. */
    idle(dt, valley) {
        const a = this.anim;
        a.mode = 'sit';
        a.lookAt = null;
        a.groundFn = valley.groundFn;
        this.creature.update(dt, a);
    }

    tryJump() {
        if (this.coyote <= 0) return false;
        this.vel.y = JUMP_VY;
        const hz = Math.hypot(this.vel.x, this.vel.z);
        if (hz > 0.2) {
            this.vel.x += (this.vel.x / hz) * HOP_BOOST;
            this.vel.z += (this.vel.z / hz) * HOP_BOOST;
        }
        this.coyote = 0;
        this.grounded = false;
        this.idleT = 0;
        return true;
    }
}
