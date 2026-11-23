/**
 * Nina corre e pula em terceira pessoa.
 * Câmera orbita com inércia, baixa e próxima (a grama fica em primeiro plano);
 * o movimento é relativo ao yaw da câmera.
 *
 * Nina é uma raposa jovem de gfx/creature.js (idade 0,6, escala 1,7: ~0,67 m de
 * altura, 1,4 m do focinho à cauda). A andadura vem da velocidade real (ver gaitFor
 * em animals.js): passo, trote ou galope; no ar ela estica o galope e o corpo
 * acompanha a parábola:
 *   inclinação = clamp(−vy·0,055, −0,45, 0,5) rad   (focinho para cima subindo, para baixo caindo)
 * Parada por 6 s ela senta; o olhar segue o filhote perdido mais próximo (< 12 m).
 *
 * Física (ver config.js para as fórmulas e unidades): passo fixo de no máximo
 * 1/120 s dentro de cada frame, velocidade-alvo com aproximação exponencial,
 * pulo variável com coyote time e buffer, queda mais pesada, velocidade terminal,
 * "cola" no chão descendo morro e desliza ao longo de troncos/paredes (a componente
 * da velocidade contra o obstáculo é removida: v −= n·min(0, v·n)).
 *
 * Câmera:
 *   alvo = Nina + 0,62 m (suavizado, 1 − 0,001^dt)
 *   posição = alvo + esférico(raio, φ, θ), φ ∈ [0,7; 1,5] rad, raio ∈ [2,4; 11] m
 *   andar de lado gira a câmera:          θ −= eixo.x · 0,9 rad/s
 *   recentraliza atrás dela andando para a frente sem mexer na câmera por 1,4 s:
 *     θ ← θ + Δ(θ, yaw+π)·(1 − exp(−1,8·(v/galope)·dt))
 *   oclusão: amostra o relevo em 10 pontos do segmento alvo→câmera e testa troncos
 *   (círculos) e o celeiro (caixa); encurta o raio até antes do primeiro obstáculo
 *   (aproxima rápido, 18/s; volta devagar, 3/s). Se o obstáculo é o relevo, a câmera
 *   também sobe (φ −= 0,9 rad/s até 0,85). Nunca abaixo de chão/água + 0,32 m.
 *
 * Trilha de migalhas (para a fila de filhotes): um ponto a cada 0,2 m andados,
 * num anel de 512 pontos (~100 m).
 */

import * as THREE from 'three';
import { createCreature } from '../../shared/gfx/creature.js';
import { gaitFor } from './animals.js?v=23';
import { BARN_SIZE } from './builds.js?v=23';
import {
    WALK_SPEED, RUN_SPEED, SWIM_K, ACCEL_K, DECEL_K, AIR_CONTROL, TURN_K, JUMP_VY, GRAVITY,
    FALL_MULT, JUMP_CUT, TERMINAL_VY, COYOTE, JUMP_BUFFER, SNAP_DOWN, HOP_BOOST,
    STUCK_S, SAFE_EVERY, BARN, WORLD_RADIUS, clampToWorld
} from './config.js?v=23';

const TRAIL_N = 512;
const TRAIL_STEP = 0.2;
/** Passo máximo da física (s). */
const PHYS_DT = 1 / 120;
const SPAWN = { x: 0, z: 6.5 };
/** Altura típica das copas/troncos e do celeiro para a oclusão da câmera (m). */
const TRUNK_H = 4.5;
const BARN_H = BARN_SIZE.ridge;
const CAM_SAMPLES = 10;
const RECENTER_K = 1.8;

function wrap(a) {
    a = (a + Math.PI) % (Math.PI * 2);
    if (a < 0) a += Math.PI * 2;
    return a - Math.PI;
}

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
        this.spherical = new THREE.Spherical(4.8, 1.37, 0);
        this.desired = this.spherical.clone();
        this.camR = 4.8;
        this.lookTarget = new THREE.Vector3();
        this.forward = new THREE.Vector3();
        this.right = new THREE.Vector3();
        this.tmp = new THREE.Vector3();
        this.camWant = new THREE.Vector3();
        this.head = new THREE.Vector3();
        /** Ponto do dorso onde Tata viaja (atualizado todo frame). */
        this.back = new THREE.Vector3();
        this.safe = new THREE.Vector3(SPAWN.x, 0, SPAWN.z);
        this.stuckRef = new THREE.Vector3();
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumping = false;
        this.grounded = true;
        this.swim = false;
        this.berries = 0;
        this.minR = 2.4;
        this.maxR = 11;
        this.idleT = 0;
        this.lookIdle = 9;
        this.terrainHit = false;
        this.safeT = 0;
        this.stuckT = 0;
        this.pitch = 0;
        this.speed = 0;
        this.lookAt = null;
        /** Eventos do frame para o laço principal (som, poeira, aviso). */
        this.events = { jumped: false, landed: 0, rescued: false };
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
        this.place(valley, SPAWN.x, SPAWN.z, Math.PI);
        this.berries = 0;
        this.safe.copy(this.mesh.position);
    }

    /** Põe Nina em (x, z) parada, com a câmera logo atrás dela (respawn, teleporte, início). */
    place(valley, x, z, yaw = this.yaw) {
        const y = valley ? valley.floorY(x, z, this.creature.height) : 0;
        this.mesh.position.set(x, y, z);
        this.vel.set(0, 0, 0);
        this.yaw = yaw;
        this.spherical.set(4.8, 1.37, yaw + Math.PI);
        this.desired.copy(this.spherical);
        this.camR = 4.8;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.jumping = false;
        this.grounded = true;
        this.idleT = 0;
        this.pitch = 0;
        this.stuckT = 0;
        this.stuckRef.copy(this.mesh.position);
        this.trailCount = 0;
        this.trailHead = 0;
        this.mesh.rotation.set(0, this.yaw, 0);
        this.lookTarget.copy(this.mesh.position).y += 0.62;
        this.camera.position.setFromSpherical(this.spherical).add(this.lookTarget);
        this.camera.lookAt(this.lookTarget);
        this._updateBack();
    }

    get pos() {
        return this.mesh.position;
    }

    /** Pedido de pulo: vale por JUMP_BUFFER s (pousar logo depois ainda pula). */
    requestJump() {
        this.jumpBuffer = JUMP_BUFFER;
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

    _updateBack() {
        const p = this.mesh.position;
        const h = this.creature.height;
        // dorso: um pouco atrás das patas dianteiras, na altura da cernelha
        const s = Math.sin(this.yaw);
        const c = Math.cos(this.yaw);
        this.back.set(p.x - s * 0.12, p.y + h * 0.67 - this.pitch * 0.1, p.z - c * 0.12);
    }

    update(dt, input, look, valley) {
        const ev = this.events;
        ev.jumped = false;
        ev.landed = 0;
        ev.rescued = false;

        // ── câmera: entrada manual ──
        const manual = look.dx !== 0 || look.dy !== 0;
        this.lookIdle = manual ? 0 : this.lookIdle + dt;
        this.desired.theta -= look.dx * 0.005 + input.axis.x * 0.9 * dt;
        this.desired.phi = THREE.MathUtils.clamp(this.desired.phi + look.dy * 0.004, 0.7, 1.5);
        this.desired.radius = THREE.MathUtils.clamp(this.desired.radius + look.zoom * 0.006, this.minR, this.maxR);

        // direção da câmera vem de θ (não da posição atrasada da câmera):
        // câmera em alvo + (sinθ, ·, cosθ) → frente = (−sinθ, 0, −cosθ), direita = (cosθ, 0, −sinθ)
        const th = this.spherical.theta;
        this.forward.set(-Math.sin(th), 0, -Math.cos(th));
        this.right.set(Math.cos(th), 0, -Math.sin(th));

        // ── física em passos fixos ──
        const n = Math.max(1, Math.ceil(dt / PHYS_DT - 1e-6));
        const h = dt / n;
        for (let i = 0; i < n; i++) this._physics(h, input, valley);

        const p = this.mesh.position;
        const hz = Math.hypot(this.vel.x, this.vel.z);
        this.speed = hz;

        // ── rede de segurança ──
        this._safety(dt, input, valley);

        // ── giro do corpo para onde ela vai (entrada tem prioridade: resposta imediata) ──
        let turn = 0;
        const ax = input.axis;
        let dirX = 0;
        let dirZ = 0;
        if (ax.mag > 0.05) {
            dirX = this.right.x * ax.x - this.forward.x * ax.z;
            dirZ = this.right.z * ax.x - this.forward.z * ax.z;
        } else if (hz > 0.45) {
            dirX = this.vel.x;
            dirZ = this.vel.z;
        }
        const moving = hz > 0.45;
        if (dirX !== 0 || dirZ !== 0) {
            const delta = wrap(Math.atan2(dirX, dirZ) - this.yaw);
            const k = (this.grounded ? 1 : 0.5) * (1 - Math.exp(-TURN_K * dt));
            this.yaw = wrap(this.yaw + delta * k);
            turn = THREE.MathUtils.clamp(delta * 1.4, -1, 1);
        }
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
            a.speed = hz;
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

        this.head.set(p.x + Math.sin(this.yaw) * 0.5, p.y + this.creature.height * 0.9, p.z + Math.cos(this.yaw) * 0.5);
        this._updateBack();

        // ── câmera: recentraliza atrás dela ──
        if (this.lookIdle > 1.4 && hz > 1 && ax.z < -0.3) {
            const behind = this.yaw + Math.PI;
            const d = wrap(behind - this.desired.theta);
            this.desired.theta += d * (1 - Math.exp(-RECENTER_K * Math.min(1, hz / RUN_SPEED) * dt));
        }
        // morro entre ela e a câmera: além de aproximar, sobe a câmera aos poucos (φ ≥ 0,85)
        if (this.terrainHit && this.lookIdle > 0.3) this.desired.phi = Math.max(0.85, this.desired.phi - 0.9 * dt);
        this.spherical.theta = THREE.MathUtils.damp(this.spherical.theta, this.desired.theta, 8, dt);
        this.spherical.phi = THREE.MathUtils.damp(this.spherical.phi, this.desired.phi, 8, dt);
        this.spherical.radius = THREE.MathUtils.damp(this.spherical.radius, this.desired.radius, 6, dt);

        this.tmp.set(p.x, p.y + 0.62, p.z);
        this.lookTarget.lerp(this.tmp, 1 - Math.pow(0.001, dt));
        this._placeCamera(dt, valley);
    }

    /** Um passo fixo de física (h ≤ 1/120 s). */
    _physics(h, input, valley) {
        const p = this.mesh.position;
        const v = this.vel;
        const ax = input.axis;
        const height = this.creature.height;

        // velocidade-alvo no plano
        const base = input.run ? RUN_SPEED : WALK_SPEED * ax.mag;
        const want = ax.mag > 0.02 ? base * (this.swim ? SWIM_K : 1) : 0;
        let tx = 0;
        let tz = 0;
        if (want > 0) {
            const dx = this.right.x * ax.x - this.forward.x * ax.z;
            const dz = this.right.z * ax.x - this.forward.z * ax.z;
            const dl = Math.hypot(dx, dz) || 1;
            tx = (dx / dl) * want;
            tz = (dz / dl) * want;
        }
        let k = want > 0 ? ACCEL_K : DECEL_K;
        if (!this.grounded) k *= want > 0 ? AIR_CONTROL : 0.12;
        const f = 1 - Math.exp(-k * h);
        v.x += (tx - v.x) * f;
        v.z += (tz - v.z) * f;

        // pulo (buffer + coyote)
        this.jumpBuffer -= h;
        if (this.jumpBuffer > 0 && this.coyote > 0) {
            v.y = JUMP_VY;
            const hz = Math.hypot(v.x, v.z);
            if (hz > 0.2) {
                v.x += (v.x / hz) * HOP_BOOST;
                v.z += (v.z / hz) * HOP_BOOST;
            }
            this.jumpBuffer = 0;
            this.coyote = 0;
            this.grounded = false;
            this.jumping = true;
            this.idleT = 0;
            this.events.jumped = true;
        }

        // gravidade assimétrica + pulo variável + terminal
        if (!this.grounded) {
            let g = GRAVITY;
            if (v.y > 0) {
                if (this.jumping && !input.jumpHeld) g *= JUMP_CUT;
            } else g *= FALL_MULT;
            v.y = Math.max(v.y - g * h, -TERMINAL_VY);
        }

        // integra e resolve colisões
        const ox = p.x + v.x * h;
        const oz = p.z + v.z * h;
        p.x = ox;
        p.z = oz;
        p.y += v.y * h;
        const c = clampToWorld(p.x, p.z);
        p.x = c.x;
        p.z = c.z;
        valley.collide(p, 0.42);
        // desliza: tira a componente da velocidade que entra no obstáculo
        const cx = p.x - ox;
        const cz = p.z - oz;
        const cl = Math.hypot(cx, cz);
        if (cl > 1e-5) {
            const nx = cx / cl;
            const nz = cz / cl;
            const vn = v.x * nx + v.z * nz;
            if (vn < 0) {
                v.x -= nx * vn;
                v.z -= nz * vn;
            }
        }

        const g2 = valley.floorY(p.x, p.z, height);
        const swimming = valley.swimming;
        const wasGrounded = this.grounded;
        if (p.y <= g2) {
            if (!wasGrounded && v.y < -2) this.events.landed = Math.max(this.events.landed, -v.y);
            p.y = g2;
            if (v.y < 0) v.y = 0;
            this.grounded = true;
            this.jumping = false;
        } else if (wasGrounded && v.y <= 0 && p.y - g2 < SNAP_DOWN) {
            // descendo morro: continua no chão em vez de "decolar" a cada passo
            p.y = g2;
            v.y = 0;
        } else {
            this.grounded = false;
        }
        this.swim = swimming && this.grounded;
        if (this.grounded) this.coyote = COYOTE;
        else this.coyote -= h;
    }

    /** NaN, abaixo do chão, fora do mapa ou preso → volta para um chão seguro. */
    _safety(dt, input, valley) {
        const p = this.mesh.position;
        const ok = Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
        const ground = ok ? valley.groundHeight(p.x, p.z) : 0;
        if (!ok || p.y < ground - 2.5 || Math.hypot(p.x, p.z) > WORLD_RADIUS + 2) {
            this.rescue(valley, false);
            return;
        }
        this.safeT += dt;
        if (this.grounded && !this.swim && this.safeT > SAFE_EVERY) {
            this.safeT = 0;
            this.safe.copy(p);
        }
        // preso: empurrando o stick sem sair de 0,5 m por STUCK_S s (borda do mapa não conta)
        if (input.axis.mag > 0.5 && Math.hypot(p.x, p.z) < WORLD_RADIUS - 2.5) {
            if (p.distanceToSquared(this.stuckRef) > 0.25) {
                this.stuckRef.copy(p);
                this.stuckT = 0;
            } else if ((this.stuckT += dt) > STUCK_S) {
                this.rescue(valley, true);
            }
        } else {
            this.stuckT = 0;
            this.stuckRef.copy(p);
        }
    }

    /** Respawn gentil: último chão seguro (ou perto do ninho se ela estava presa ali mesmo). */
    rescue(valley, stuck) {
        const s = this.safe;
        const useSpawn = stuck || !Number.isFinite(s.x) || s.distanceToSquared(this.mesh.position) < 2.25;
        this.place(valley, useSpawn ? SPAWN.x : s.x, useSpawn ? SPAWN.z : s.z);
        this.events.rescued = true;
    }

    /**
     * Câmera com oclusão: encurta o raio antes do primeiro morro, tronco ou celeiro
     * entre o alvo e a posição desejada.
     */
    _placeCamera(dt, valley) {
        const lt = this.lookTarget;
        const want = this.camWant.setFromSpherical(this.spherical).add(lt);
        const dx = want.x - lt.x;
        const dy = want.y - lt.y;
        const dz = want.z - lt.z;
        let hit = 1;
        // relevo
        for (let i = 1; i <= CAM_SAMPLES; i++) {
            const t = i / CAM_SAMPLES;
            const x = lt.x + dx * t;
            const z = lt.z + dz * t;
            if (lt.y + dy * t < valley.groundHeight(x, z) + 0.3) {
                hit = (i - 1) / CAM_SAMPLES;
                break;
            }
        }
        this.terrainHit = hit < 1;
        // troncos (círculo 2D + altura)
        const len2 = dx * dx + dz * dz;
        if (len2 > 1e-4) {
            for (const c of valley.colliders) {
                const r = c.r + 0.25;
                const fx = lt.x - c.x;
                const fz = lt.z - c.z;
                const b = fx * dx + fz * dz;
                const cc = fx * fx + fz * fz - r * r;
                if (cc < 0) continue; // alvo dentro do tronco (não acontece): ignora
                const disc = b * b - len2 * cc;
                if (disc < 0) continue;
                const t = (-b - Math.sqrt(disc)) / len2;
                if (t > 0 && t < hit && lt.y + dy * t < valley.groundHeight(c.x, c.z) + TRUNK_H) hit = t;
            }
            // celeiro: caixa orientada (mesmo referencial de valley.collide), teste de placas
            const cs = Math.cos(BARN.ry);
            const sn = Math.sin(BARN.ry);
            const wx = lt.x - BARN.x;
            const wz = lt.z - BARN.z;
            const ox = wx * cs - wz * sn;
            const oz = wx * sn + wz * cs;
            const lx = dx * cs - dz * sn;
            const lz = dx * sn + dz * cs;
            const hx = BARN_SIZE.w / 2 + 0.3;
            const hzz = BARN_SIZE.d / 2 + 0.3;
            let t0 = 0;
            let t1 = 1;
            const slab = (o, d, hh) => {
                if (Math.abs(d) < 1e-6) return Math.abs(o) <= hh;
                let a = (-hh - o) / d;
                let b = (hh - o) / d;
                if (a > b) { const s = a; a = b; b = s; }
                t0 = Math.max(t0, a);
                t1 = Math.min(t1, b);
                return t0 <= t1;
            };
            if (slab(ox, lx, hx) && slab(oz, lz, hzz) && t0 > 0 && t0 < hit) {
                if (lt.y + dy * t0 < valley.groundHeight(BARN.x, BARN.z) + BARN_H) hit = t0;
            }
        }
        const fit = Math.max(this.minR * 0.45, this.spherical.radius * hit - 0.2);
        const target = Math.min(this.spherical.radius, fit);
        this.camR = THREE.MathUtils.damp(this.camR, target, target < this.camR ? 18 : 3, dt);
        const cam = this.camera.position;
        const r = this.camR / Math.max(this.spherical.radius, 1e-3);
        cam.set(lt.x + dx * r, lt.y + dy * r, lt.z + dz * r);
        // nunca abaixo do chão/da água
        const floor = Math.max(valley.groundHeight(cam.x, cam.z), valley.floorY(cam.x, cam.z, 0)) + 0.32;
        if (cam.y < floor) cam.y = floor;
        this.camera.lookAt(lt);
    }

    /** Fora do jogo (menu/pausa): só respira e mexe a cauda. */
    idle(dt, valley) {
        const a = this.anim;
        a.mode = 'sit';
        a.lookAt = null;
        a.groundFn = valley.groundFn;
        this.creature.update(dt, a);
    }
}
