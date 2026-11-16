/**
 * Visitante: personagem com esqueleto (kit gfx/human) caminhando pela orla.
 *
 * Movimento: velocidade alvo suavizada (damp λ = 9), cadência do passo proporcional à
 * distância percorrida (fase += dist · 2π · passos/m), então o pé não "patina".
 * Colisões simples e legíveis:
 *   - fachadas (z ≥ −29,5), limites leste/oeste, profundidade máxima no mar;
 *   - canais abertos (jardim e areia): atravessa-se pela calçada, passarela ou passeio;
 *   - mureta da praia: só passa pelos acessos (rampas).
 * Na água o passo fica mais lento conforme a profundidade (até −55 %).
 */
import { createHuman, poseHuman } from '../../shared/gfx/human.js';
import { clamp, damp } from '../../shared/gfx/core.js';
import { ORLA_HALF, CANALS, WALK, ZONES, FOOTBRIDGE_Z, PLATFORMS, platformAt, groundY, seaDepth } from './config.js';

export class Player {
    constructor(scene, openings) {
        this.x = -100;
        this.z = WALK.spawnZ;
        this.yaw = Math.PI * 0.5; // olhando para leste (Ponta da Praia)
        this.speed = 0;
        this.vx = 0;
        this.vz = 0;
        this.phase = 0;
        this.idleT = 0;
        this.openings = openings || [];
        this.blockers = [];
        this.human = createHuman({
            detail: 2, skin: 0xc68e62, hair: 0x2a1c12, top: 'tee', topColor: 0x1e6b9e,
            bottom: 'bermuda', bottomColor: 0xd9d2c0, shoes: 'sneaker', shoeColor: 0xf2f0ea
        });
        this.mesh = this.human.object;
        scene?.add(this.mesh);
        this.sync(0);
    }

    reset(x = -100, z = WALK.spawnZ) {
        this.x = x;
        this.z = z;
        this.yaw = Math.PI * 0.5;
        this.speed = 0;
        this.vx = this.vz = 0;
        this.sync(0);
    }

    get y() {
        return groundY(this.x, this.z);
    }

    sync(dt) {
        const depth = platformAt(this.x, this.z) ? 0 : Math.max(0, seaDepth(this.z));
        this.mesh.position.set(this.x, groundY(this.x, this.z) - Math.min(depth, 0.05), this.z);
        this.mesh.rotation.y = this.yaw;
        if (this.speed > 0.25) {
            const run = this.speed > WALK.speed * 1.6;
            poseHuman(this.human, run ? 'run' : 'walk', this.phase, run ? 1 : clamp(this.speed / WALK.speed, 0.45, 1.15));
        } else {
            this.idleT += dt;
            poseHuman(this.human, 'idle', this.idleT);
        }
    }

    blocked(nx, nz) {
        // obstáculos sólidos (quiosques, fontes, edifícios): círculos e retângulos
        for (const b of this.blockers) {
            if (b.r ? (nx - b.x) ** 2 + (nz - b.z) ** 2 < (b.r + 0.35) ** 2
                : nx > b.x0 - 0.35 && nx < b.x1 + 0.35 && nz > b.z0 - 0.35 && nz < b.z1 + 0.35) return true;
        }
        // plataformas: só se entra/sai pelo passeio; laterais e ponta têm guarda-corpo
        const here = platformAt(this.x, this.z);
        if (nz > ZONES.wall) {
            const there = PLATFORMS.find((p) => nx > p.x0 && nx < p.x1 && nz < p.z1 + 0.5);
            if (here) {
                if (nx < here.x0 + 0.6 || nx > here.x1 - 0.6 || nz > here.z1 - 0.6) return true;
            } else if (there && this.z > ZONES.wall) return true;
        }
        // canais
        for (const c of CANALS) {
            const half = c.width / 2 + 0.75;
            if (Math.abs(nx - c.x) < half) {
                const inGarden = nz > ZONES.garden[0] + 0.3 && nz < ZONES.promenade[0] - 0.3
                    && !(nz > FOOTBRIDGE_Z[0] + 0.3 && nz < FOOTBRIDGE_Z[1] - 0.3);
                const inSand = nz > ZONES.wall + 0.1 && nz < 109.5;
                if (inGarden || inSand) return true;
            }
        }
        return false;
    }

    update(dt, input, locked = false) {
        if (locked) {
            this.speed = damp(this.speed, 0, 9, dt);
            this.sync(dt);
            return;
        }
        this.yaw += input.turn * WALK.turnSpeed * dt;

        const depth = platformAt(this.x, this.z) ? 0 : Math.max(0, seaDepth(this.z));
        const wade = 1 - clamp(depth / 0.9, 0, 1) * 0.55;
        const target = WALK.speed * (input.run ? WALK.runMult : 1) * wade;
        const len = Math.hypot(input.forward, input.strafe);
        const k = len > 1 ? 1 / len : 1;
        const fx = Math.sin(this.yaw);
        const fz = Math.cos(this.yaw);
        const tvx = (fx * input.forward - fz * input.strafe) * k * target;
        const tvz = (fz * input.forward + fx * input.strafe) * k * target;
        this.vx = damp(this.vx, tvx, 9, dt);
        this.vz = damp(this.vz, tvz, 9, dt);

        let nx = clamp(this.x + this.vx * dt, -ORLA_HALF + 2, ORLA_HALF - 1.5);
        const onDeck = platformAt(this.x, this.z);
        let nz = clamp(this.z + this.vz * dt, ZONES.buildFront + 0.6, onDeck ? onDeck.z1 : ZONES.walkMax);

        // mureta: só nos acessos
        const crossing = (this.z - ZONES.wall) * (nz - ZONES.wall) < 0 || Math.abs(nz - ZONES.wall) < 0.45;
        if (crossing && !this.openings.some((ox) => Math.abs(nx - ox) < 1.5)
            && !PLATFORMS.some((p) => nx > p.x0 + 0.6 && nx < p.x1 - 0.6)
            && !CANALS.some((c) => Math.abs(nx - c.x) < c.width / 2 + 1)) {
            nz = this.z < ZONES.wall ? Math.min(nz, ZONES.wall - 0.45) : Math.max(nz, ZONES.wall + 0.45);
        }
        // canais: tenta deslizar em cada eixo
        if (this.blocked(nx, nz)) {
            if (!this.blocked(this.x, nz)) nx = this.x;
            else if (!this.blocked(nx, this.z)) nz = this.z;
            else { nx = this.x; nz = this.z; }
        }

        const dist = Math.hypot(nx - this.x, nz - this.z);
        this.x = nx;
        this.z = nz;
        this.speed = dt > 0 ? dist / dt : 0;
        this.phase += dist * Math.PI * 2 * (WALK.stepsPerMeter / 2);
        this.sync(dt);
    }
}
