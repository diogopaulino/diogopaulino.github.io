/**
 * Visitante: personagem com esqueleto (kit gfx/human) caminhando, correndo ou pedalando
 * uma bicicleta compartilhada pela orla. Unidades SI (m, s); fórmulas em config.js (WALK, BIKE).
 *
 * A pé — velocidade alvo v* = direção · |stick| · v_max, aproximada com aceleração limitada:
 *   v ← v + clamp(|v* − v|, a·dt) · (v* − v)/|v* − v|
 *   a = WALK.accel / runAccel ao ganhar velocidade, WALK.decel ao perder (para em ~0,25 s).
 *   Cadência pela distância (fase += dist · 2π / ciclo) → o pé não "patina".
 *   Na água o passo perde até 55 % conforme a profundidade (0 → 0,9 m).
 *
 * De bike — força longitudinal (potência constante − rolamento − arrasto) e direção
 *   cinemática ω = v·tan δ / L; inclinação φ = atan(v·ω/g). Areia fofa: c_rr 0,25.
 *   Não entra no mar (> 0,25 m de água). Parada: dá para empurrar para trás.
 *
 * Colisão (círculo de raio r no plano XZ), legível e sem prender:
 *   - fachadas (z ≥ −30 + r), limites leste/oeste, profundidade máxima no mar;
 *   - obstáculos sólidos (quiosques, fontes, postos, marcos): círculos e retângulos;
 *   - canais abertos (jardim e areia): atravessa-se pela calçada, passarela ou passeio;
 *   - mureta da praia: só passa pelos acessos (rampas), canais e plataformas;
 *   - desliza eixo a eixo; se já estiver dentro de algo (teleporte), o passo é liberado
 *     para ele sair — nunca trava. A velocidade vira o deslocamento real (bater zera).
 */
import * as THREE from 'three';
import { createHuman, poseHuman } from '../../shared/gfx/human.js';
import { clamp, damp, smoothstep, lerp } from '../../shared/gfx/core.js';
import { ORLA_HALF, CANALS, WALK, BIKE, ZONES, FOOTBRIDGE_Z, PLATFORMS, platformAt, groundY, seaDepth } from './config.js';
import { bikeGeometry } from './life.js';

const G = 9.81;

/** Há passagem na mureta em x? (acesso/rampa, plataforma ou canal) — sem closures. */
function wallGap(x, openings) {
    for (let i = 0; i < openings.length; i++) if (Math.abs(x - openings[i]) < 1.5) return true;
    for (let i = 0; i < PLATFORMS.length; i++) if (x > PLATFORMS[i].x0 + 0.6 && x < PLATFORMS[i].x1 - 0.6) return true;
    for (let i = 0; i < CANALS.length; i++) if (Math.abs(x - CANALS[i].x) < CANALS[i].width / 2 + 1) return true;
    return false;
}
const TAU = Math.PI * 2;
const SPAWN_X = -100;

export class Player {
    constructor(scene, openings) {
        this.x = SPAWN_X;
        this.z = WALK.spawnZ;
        this.yaw = Math.PI * 0.5; // olhando para leste (Ponta da Praia)
        this.speed = 0;           // m/s medido (deslocamento real / dt)
        this.vx = 0;
        this.vz = 0;
        this.phase = 0;
        this.idleT = 0;
        this.riding = false;
        this.bv = 0;              // velocidade da bike ao longo do yaw (m/s, + = frente)
        this.steer = 0;
        this.lean = 0;
        this.pedal = 0;
        this.openings = openings || [];
        this.blockers = [];
        this.travelled = 0;       // m percorridos (onboarding)

        this.root = new THREE.Group();
        this.root.name = 'player';
        this.tilt = new THREE.Group();
        this.root.add(this.tilt);
        this.human = createHuman({
            detail: 2, skin: 0xc68e62, hair: 0x2a1c12, top: 'tee', topColor: 0x1e6b9e,
            bottom: 'bermuda', bottomColor: 0xd9d2c0, shoes: 'sneaker', shoeColor: 0xf2f0ea
        });
        this.mesh = this.human.object;
        this.tilt.add(this.mesh);
        // bicicleta: InstancedMesh de 1 para tingir só o quadro (cor por instância)
        this.bike = new THREE.InstancedMesh(
            bikeGeometry(),
            new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.5 }),
            1
        );
        this.bike.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, -0.02, 0));
        this.bike.setColorAt(0, new THREE.Color(BIKE.color));
        this.bike.castShadow = true;
        this.bike.frustumCulled = false;
        this.bike.visible = false;
        this.tilt.add(this.bike);
        scene?.add(this.root);
        this.sync(0);
    }

    reset(x = SPAWN_X, z = WALK.spawnZ, yaw = Math.PI * 0.5) {
        this.x = x;
        this.z = z;
        this.yaw = yaw;
        this.speed = 0;
        this.vx = this.vz = 0;
        this.bv = 0;
        this.steer = 0;
        this.lean = 0;
        this.sync(0);
    }

    get y() {
        return groundY(this.x, this.z);
    }

    /** Onde dá para pegar a bike: calçadão/jardim/passeio ou plataformas (não na areia). */
    canRide() {
        return this.z <= ZONES.wall || !!platformAt(this.x, this.z);
    }

    /** Monta/desmonta. Retorna texto curto para o HUD. */
    toggleBike() {
        if (this.riding) {
            this.riding = false;
            this.bv = 0;
            this.vx = this.vz = 0;
            this.sync(0);
            return 'Bike devolvida — seguindo a pé';
        }
        if (!this.canRide()) return 'Na areia não dá para pedalar — volte ao calçadão';
        this.riding = true;
        this.bv = Math.min(this.speed, 2);
        this.sync(0);
        return 'Bike compartilhada · W pedala, S freia';
    }

    /** Rótulo do andar atual (HUD). */
    get gait() {
        if (this.riding) return this.speed < 0.2 ? 'Bike parada' : 'Pedalando';
        if (this.speed < 0.15) return 'Parado';
        const depth = platformAt(this.x, this.z) ? 0 : seaDepth(this.z);
        if (depth > 0.2) return 'Na água';
        return this.speed > 2.4 ? 'Correndo' : 'Caminhando';
    }

    sync(dt) {
        const depth = platformAt(this.x, this.z) ? 0 : Math.max(0, seaDepth(this.z));
        this.root.position.set(this.x, groundY(this.x, this.z) - Math.min(depth, 0.05), this.z);
        this.root.rotation.y = this.yaw;
        this.tilt.rotation.z = -this.lean;
        this.bike.visible = this.riding;
        if (this.riding) {
            this.mesh.position.y = 0.44;
            poseHuman(this.human, 'cycle', this.pedal);
            return;
        }
        this.mesh.position.y = 0;
        if (this.speed > 0.15) {
            const run = this.speed > 2.4;
            poseHuman(this.human, run ? 'run' : 'walk', this.phase,
                run ? clamp(this.speed / WALK.runSpeed, 0.65, 1) : clamp(this.speed / WALK.speed, 0.35, 1.1));
        } else {
            this.idleT += dt;
            poseHuman(this.human, 'idle', this.idleT);
        }
    }

    blocked(nx, nz, r) {
        // obstáculos sólidos (quiosques, fontes, edifícios): círculos e retângulos
        for (let i = 0; i < this.blockers.length; i++) {
            const b = this.blockers[i];
            if (b.r ? (nx - b.x) ** 2 + (nz - b.z) ** 2 < (b.r + r) ** 2
                : nx > b.x0 - r && nx < b.x1 + r && nz > b.z0 - r && nz < b.z1 + r) return true;
        }
        // plataformas: só se entra/sai pelo passeio; laterais e ponta têm guarda-corpo
        const here = platformAt(this.x, this.z);
        if (nz > ZONES.wall) {
            let there = null;
            for (let i = 0; i < PLATFORMS.length; i++) {
                const p = PLATFORMS[i];
                if (nx > p.x0 && nx < p.x1 && nz < p.z1 + 0.5) { there = p; break; }
            }
            if (here) {
                if (nx < here.x0 + 0.6 || nx > here.x1 - 0.6 || nz > here.z1 - 0.6) return true;
            } else if (there && this.z > ZONES.wall) return true;
        }
        // bike não entra no mar
        if (this.riding && !here && !platformAt(nx, nz) && seaDepth(nz) > 0.25) return true;
        // canais
        for (let i = 0; i < CANALS.length; i++) {
            const c = CANALS[i];
            const half = c.width / 2 + r + 0.4;
            if (Math.abs(nx - c.x) < half) {
                const inGarden = nz > ZONES.garden[0] + 0.3 && nz < ZONES.promenade[0] - 0.3
                    && !(nz > FOOTBRIDGE_Z[0] + 0.3 && nz < FOOTBRIDGE_Z[1] - 0.3);
                const inSand = nz > ZONES.wall + 0.1 && nz < 109.5;
                if (inGarden || inSand) return true;
            }
        }
        return false;
    }

    /** Move de (x, z) até (nx, nz) respeitando limites, mureta e obstáculos; aplica o resultado. */
    _move(nx, nz, r) {
        nx = clamp(nx, -ORLA_HALF + 2, ORLA_HALF - 1.5);
        const onDeck = platformAt(this.x, this.z);
        nz = clamp(nz, ZONES.buildFront + r + 0.3, onDeck ? onDeck.z1 : ZONES.walkMax);

        // mureta: só nos acessos
        const crossing = (this.z - ZONES.wall) * (nz - ZONES.wall) < 0 || Math.abs(nz - ZONES.wall) < 0.45;
        if (crossing && !wallGap(nx, this.openings)) {
            nz = this.z < ZONES.wall ? Math.min(nz, ZONES.wall - 0.45) : Math.max(nz, ZONES.wall + 0.45);
        }
        // obstáculos: desliza em cada eixo; se já estiver dentro, deixa sair
        if (this.blocked(nx, nz, r) && !this.blocked(this.x, this.z, r)) {
            if (!this.blocked(this.x, nz, r)) nx = this.x;
            else if (!this.blocked(nx, this.z, r)) nz = this.z;
            else { nx = this.x; nz = this.z; }
        }
        const dist = Math.hypot(nx - this.x, nz - this.z);
        this.x = nx;
        this.z = nz;
        this.travelled += dist;
        return dist;
    }

    update(dt, input, locked = false) {
        if (dt <= 0) {
            this.sync(0);
            return;
        }
        if (locked) {
            // câmera em mapa/drone/intro: o visitante para com a desaceleração normal
            const v = Math.hypot(this.vx, this.vz);
            const k = v > 0 ? Math.max(0, v - WALK.decel * dt) / v : 0;
            this.vx *= k;
            this.vz *= k;
            this.bv = Math.sign(this.bv) * Math.max(0, Math.abs(this.bv) - BIKE.brake * dt);
            this.speed = this.riding ? Math.abs(this.bv) : v * k;
            this.lean = damp(this.lean, 0, 6, dt);
            this.sync(dt);
            return;
        }
        if (this.riding) this._updateBike(dt, input);
        else this._updateWalk(dt, input);
        this.sync(dt);
    }

    _updateWalk(dt, input) {
        this.yaw += input.turn * WALK.turnSpeed * dt;
        this.lean = damp(this.lean, 0, 8, dt);

        const depth = platformAt(this.x, this.z) ? 0 : Math.max(0, seaDepth(this.z));
        const wade = 1 - clamp(depth / 0.9, 0, 1) * 0.55;
        const vmax = (input.run ? WALK.runSpeed : WALK.speed) * wade;
        const len = Math.hypot(input.forward, input.strafe);
        const mag = Math.min(1, len);
        const k = len > 1e-3 ? mag / len : 0;
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        const tvx = (fx * input.forward - fz * input.strafe) * k * vmax;
        const tvz = (fz * input.forward + fx * input.strafe) * k * vmax;

        // aceleração limitada (m/s²): arranca mais devagar do que para
        const dvx = tvx - this.vx;
        const dvz = tvz - this.vz;
        const dv = Math.hypot(dvx, dvz);
        if (dv > 1e-4) {
            const speeding = Math.hypot(tvx, tvz) > Math.hypot(this.vx, this.vz);
            const a = speeding ? (input.run ? WALK.runAccel : WALK.accel) : WALK.decel;
            const step = Math.min(dv, a * dt) / dv;
            this.vx += dvx * step;
            this.vz += dvz * step;
        }

        const x0 = this.x;
        const z0 = this.z;
        const dist = this._move(this.x + this.vx * dt, this.z + this.vz * dt, WALK.radius);
        // a velocidade passa a ser o deslocamento real: bater numa parede zera a componente
        this.vx = (this.x - x0) / dt;
        this.vz = (this.z - z0) / dt;
        this.speed = dist / dt;
        const cycle = lerp(WALK.cycleWalk, WALK.cycleRun, smoothstep(1.8, 3.8, this.speed));
        this.phase = (this.phase + (dist * TAU) / cycle) % (TAU * 1000);
    }

    _updateBike(dt, input) {
        const B = BIKE;
        const steerIn = clamp(input.turn - input.strafe, -1, 1);
        this.steer = damp(this.steer, steerIn, 7, dt);
        const throttle = Math.max(0, input.forward);
        const braking = input.forward < -0.1;
        const sand = this.z > ZONES.wall && !platformAt(this.x, this.z);
        let v = this.bv;

        // forças longitudinais (N) → aceleração
        let F = 0;
        if (throttle > 0 && v >= -0.05) F += ((input.run ? B.sprintPower : B.power) * throttle) / Math.max(Math.abs(v), B.v0);
        const resist = (sand ? B.crrSand : B.crr) * B.mass * G + 0.5 * B.rho * B.cda * v * v;
        let a = F / B.mass;
        const vPrev = v;
        if (braking) {
            if (v > 0.05) a -= B.brake * Math.min(1, -input.forward);
            else {
                // parado: empurra a bike para trás devagar
                v = damp(v, -B.reverse * Math.min(1, -input.forward), 3, dt);
            }
        }
        // sem pedal nem freio, o ciclista segura de leve (coastBrake) em vez de embalar 40 s
        if (!throttle && !braking && v > 0) a -= B.coastBrake;
        v += a * dt;
        if (v >= 0) {
            // resistência sempre contra o movimento, sem inverter o sentido
            const dragDv = (resist / B.mass) * dt;
            v = v <= dragDv ? (F > 0 ? v : 0) : v - dragDv;
        } else if (!braking) {
            v = damp(v, 0, 4, dt); // soltou a ré: a bike para na mão
        }
        if (braking && vPrev > 0.05 && v < 0) v = 0;

        // direção cinemática; em baixa velocidade gira-se a bike "na mão"
        const delta = this.steer * lerp(B.steerMax, B.steerMin, clamp(Math.abs(v) / 9, 0, 1));
        let omega = (v * Math.tan(delta)) / B.wheelbase;
        if (Math.abs(v) < 1.2) omega += this.steer * 0.9 * (1 - Math.abs(v) / 1.2);
        this.yaw += omega * dt;

        const x0 = this.x;
        const z0 = this.z;
        const want = Math.abs(v) * dt;
        const dist = this._move(this.x + Math.sin(this.yaw) * v * dt, this.z + Math.cos(this.yaw) * v * dt, B.radius);
        // colisão "come" a velocidade: segue só o que de fato deslizou
        if (want > 1e-4 && dist < want * 0.98) v = Math.sign(v) * (dist / dt) * 0.6;
        this.bv = v;
        this.vx = (this.x - x0) / dt;
        this.vz = (this.z - z0) / dt;
        this.speed = dist / dt;

        const leanT = clamp(Math.atan((v * omega) / G), -0.45, 0.45);
        this.lean = damp(this.lean, Math.abs(v) > 1 ? leanT : 0, 8, dt);
        // pedivela: roda 2,1 m de perímetro, relação 2,5 → ~64 rpm a 20 km/h (roda livre ao embalar)
        if (throttle > 0 && v > 0) this.pedal = (this.pedal + ((v / 2.1 / 2.5) * TAU) * dt) % (TAU * 1000);
    }
}
