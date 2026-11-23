/**
 * Camila segue Dico com offset sem bloquear passagens estreitas.
 * Ritmo: velocidade = clamp(1,8·distância, 1,4, teto) — teto 5,2 m/s seguindo, 7 m/s na
 * fuga — e acelera/freia com inércia (λ = 6/s). Ficou para trás mais de 14 m (curva
 * fechada, porta) → reaparece logo atrás de Dico, sem nunca prender o jogador.
 */

import * as THREE from 'three';
import { damp } from '../utils/math.js?v=50';

export class PrincessAI {
    constructor(camila) {
        this.camila = camila;
        this.state = 'WAIT';
        this.facing = 0;
        this.stuck = 0;
        this.last = new THREE.Vector3();
    }

    reset() {
        this.state = 'WAIT';
        this.stuck = 0;
    }

    follow() {
        this.state = 'FOLLOW';
    }

    run() {
        this.state = 'RUN';
    }

    update(dt, game) {
        const c = this.camila;
        if (this.state === 'HOLD') {
            c.speed = 0;
            return;
        }
        if (this.state === 'WAIT') {
            c.speed = 0;
            const dx = game.player.position.x - c.position.x;
            const dz = game.player.position.z - c.position.z;
            this.facing = Math.atan2(dx, dz);
            return;
        }

        const p = game.player;
        const ox = Math.sin(p.facing + Math.PI) * 0.85 + Math.cos(p.facing) * -0.55;
        const oz = Math.cos(p.facing + Math.PI) * 0.85 + Math.sin(p.facing) * -0.55;
        const tx = p.position.x + ox;
        const tz = p.position.z + oz;
        const ty = p.position.y;
        const dx = tx - c.position.x;
        const dz = tz - c.position.z;
        const dist = Math.hypot(dx, dz);
        const run = this.state === 'RUN' || this.state === 'ESCAPE';
        const top = run ? 7 : 5.2;

        if (dist > 14) {
            c.position.set(tx, ty, tz);
            this.v = 0;
        }
        const want = dist > 1.15 ? Math.min(top, Math.max(1.4, dist * 1.8)) : 0;
        this.v = damp(this.v || 0, want, 6, dt);
        if (this.v > 0.05 && dist > 0.2) {
            const step = Math.min(dist, this.v * dt);
            c.position.x += (dx / dist) * step;
            c.position.z += (dz / dist) * step;
            if (dist > 1.15) this.facing = Math.atan2(dx, dz);
        }
        if (dist <= 1.15) this.facing = p.facing;
        c.position.y = damp(c.position.y, ty, 8, dt);
        c.speed = this.v;

        if (Math.hypot(c.position.x - this.last.x, c.position.z - this.last.z) < 0.01 && dist > 2) {
            this.stuck += dt;
            if (this.stuck > 1.2) {
                c.position.x = tx;
                c.position.z = tz;
                this.stuck = 0;
            }
        } else {
            this.stuck = 0;
        }
        this.last.copy(c.position);
    }
}
