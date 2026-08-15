/**
 * Obstáculos e Penas flutuantes na pista em Babylon.js.
 *
 * Colisão precisa no espaço 3D:
 * - Obstáculos baixos (fardos, caixotes, vacas, cones) podem ser pulados com folga justa.
 * - Obstáculos altos (caminhões) bloqueiam a faixa inteira e exigem desvio lateral.
 * - Penas: coletadas ao cruzar a proximidade 3D da pena.
 */

import { ROAD, CHUNK } from './config.js';
import { mulberry32 } from './utils.js';
import {
    createTruck, createHay, createCrate, createCow, createCone,
    createFeatherMesh, disposeTransformNode
} from './models.js';

const KINDS = [
    { make: createTruck, kind: 'block', w: 1.2, clearance: 3.5, chance: 0.22 },
    { make: createHay, kind: 'low', w: 0.8, clearance: 1.15, chance: 0.22 },
    { make: createCrate, kind: 'low', w: 0.65, clearance: 1.1, chance: 0.18 },
    { make: createCow, kind: 'low', w: 0.9, clearance: 1.25, chance: 0.14 },
    { make: createCone, kind: 'low', w: 0.45, clearance: 0.9, chance: 0.24 }
];

function pickKind(rng) {
    let r = rng();
    for (const k of KINDS) {
        r -= k.chance;
        if (r <= 0) return k;
    }
    return KINDS[0];
}

export class Track {
    constructor(scene, shadowGenerator, quality) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.quality = quality;
        this.items = [];
        this.feathers = [];
        this.density = 1;
        this.featherRate = 1;
        this.seed = 1;
        this.nextZ = -24;
        this.nextFeather = -14;
    }

    setDifficulty(diff) {
        this.density = diff.obstacle;
        this.featherRate = diff.feathers;
    }

    reset(playerZ) {
        for (const it of this.items) disposeTransformNode(it.mesh);
        for (const f of this.feathers) disposeTransformNode(f.mesh);
        this.items = [];
        this.feathers = [];
        this.nextZ = playerZ - 30;
        this.nextFeather = playerZ - 18;
        this.seed = (Math.random() * 99999) | 0;
    }

    spawnObstacle(z) {
        const rng = mulberry32((this.seed + Math.floor(-z)) | 0);
        const spec = pickKind(rng);
        const lane = Math.floor(rng() * ROAD.lanes);
        const mesh = spec.make(this.scene, this.shadowGenerator);
        mesh.position.set((lane - 1) * ROAD.laneW, 0, z);

        if (spec.kind === 'block') {
            mesh.rotation.y = Math.PI; // Caminhão apontando para o jogador
        }

        this.items.push({
            mesh,
            lane,
            z,
            kind: spec.kind,
            w: spec.w,
            clearance: spec.clearance,
            live: true
        });
    }

    spawnFeather(z) {
        const rng = mulberry32((this.seed * 3 + Math.floor(-z * 1.7)) | 0);
        const lane = Math.floor(rng() * ROAD.lanes);
        const mesh = createFeatherMesh(this.scene);
        const y = 1.15 + rng() * 0.4;
        mesh.position.set((lane - 1) * ROAD.laneW, y, z);

        this.feathers.push({
            mesh,
            lane,
            z,
            baseY: y,
            live: true,
            spin: rng() * Math.PI
        });
    }

    update(dt, player) {
        const horizon = player.z - CHUNK.length * 6.5;

        // Gerar obstáculos à frente
        while (this.nextZ > horizon) {
            const gap = 18 / Math.max(0.4, this.density) + Math.random() * 8;
            this.nextZ -= gap;
            if (Math.random() < 0.84 * this.density) {
                this.spawnObstacle(this.nextZ);
            }
        }

        // Gerar penas à frente
        while (this.nextFeather > horizon) {
            const gap = 14 / Math.max(0.5, this.featherRate) + Math.random() * 9;
            this.nextFeather -= gap;
            if (Math.random() < 0.75 * this.featherRate) {
                this.spawnFeather(this.nextFeather);
            }
        }

        const behind = player.z + 18;

        // Reciclar obstáculos que ficaram para trás
        this.items = this.items.filter((it) => {
            if (it.z > behind) {
                disposeTransformNode(it.mesh);
                return false;
            }
            return true;
        });

        // Atualizar animação das penas e reciclar
        this.feathers = this.feathers.filter((f) => {
            if (!f.live || f.z > behind) {
                disposeTransformNode(f.mesh);
                return false;
            }
            f.spin += dt * 2.2;
            f.mesh.rotation.y = f.spin;
            f.mesh.rotation.z = Math.sin(f.spin * 1.5) * 0.25;
            f.mesh.position.y = f.baseY + Math.sin(f.spin * 2.4) * 0.22;
            return true;
        });
    }

    collide(player) {
        if (player.invuln > 0 || !player.alive) return null;

        for (const it of this.items) {
            if (!it.live) continue;
            const dx = Math.abs(it.mesh.position.x - player.x);
            const dz = Math.abs(it.z - player.z);

            // Tolerância lateral e frontal proporcional à largura do obstáculo
            const hitX = dx < (0.65 + it.w * 0.35);
            const hitZ = dz < 1.25;

            if (hitX && hitZ) {
                // Obstáculo baixo: se Forrest pulou alto o suficiente, ele passa por cima!
                if (it.kind === 'low' && player.y > (it.clearance * 0.72)) {
                    continue; // Pulo bem-sucedido!
                }
                it.live = false;
                return it;
            }
        }
        return null;
    }

    collect(player) {
        const got = [];
        for (const f of this.feathers) {
            if (!f.live) continue;
            const dx = Math.abs(f.mesh.position.x - player.x);
            const dz = Math.abs(f.z - player.z);
            const dy = Math.abs(f.mesh.position.y - (player.y + 0.9));

            if (dx < 0.95 && dz < 1.15 && dy < 1.4) {
                f.live = false;
                got.push(f);
            }
        }
        return got;
    }
}
