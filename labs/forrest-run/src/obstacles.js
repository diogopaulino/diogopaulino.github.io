/**
 * Obstáculos e penas na pista.
 *
 * Colisão AABB no plano XZ: |Δx| < 0.7 e |Δz| < 1.1.
 * kind === 'low' é pulável se player.y > 0.55.
 * Penas: coleta se |Δx| < 0.85 e |Δz| < 0.9, independente do pulo.
 */

import * as THREE from 'three';
import { ROAD, CHUNK } from './config.js';
import { mulberry32 } from './utils.js';
import {
    createTruck, createHay, createCrate, createCow, createCone, createFeatherMesh
} from './models.js';

const KINDS = [
    { make: createTruck, kind: 'block', w: 1.1, chance: 0.22 },
    { make: createHay, kind: 'low', w: 0.7, chance: 0.22 },
    { make: createCrate, kind: 'low', w: 0.55, chance: 0.18 },
    { make: createCow, kind: 'low', w: 0.8, chance: 0.14 },
    { make: createCone, kind: 'low', w: 0.35, chance: 0.24 }
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
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.items = [];
        this.feathers = [];
        this.density = 1;
        this.featherRate = 1;
        this.seed = 1;
        this.nextZ = -20;
        this.nextFeather = -12;
    }

    setDifficulty(diff) {
        this.density = diff.obstacle;
        this.featherRate = diff.feathers;
    }

    reset(playerZ) {
        for (const it of this.items) this.scene.remove(it.mesh);
        for (const f of this.feathers) this.scene.remove(f.mesh);
        this.items = [];
        this.feathers = [];
        this.nextZ = playerZ - 28;
        this.nextFeather = playerZ - 16;
        this.seed = (Math.random() * 99999) | 0;
    }

    spawnObstacle(z) {
        const rng = mulberry32((this.seed + Math.floor(-z)) | 0);
        const spec = pickKind(rng);
        const lane = Math.floor(rng() * ROAD.lanes);
        const mesh = spec.make();
        mesh.position.set((lane - 1) * ROAD.laneW, 0, z);
        this.scene.add(mesh);
        this.items.push({ mesh, lane, z, kind: spec.kind, w: spec.w, live: true });
    }

    spawnFeather(z) {
        const rng = mulberry32((this.seed * 3 + Math.floor(-z * 1.7)) | 0);
        const lane = Math.floor(rng() * ROAD.lanes);
        const mesh = createFeatherMesh();
        mesh.position.set((lane - 1) * ROAD.laneW, 1.15, z);
        this.scene.add(mesh);
        this.feathers.push({ mesh, lane, z, live: true, spin: rng() * Math.PI });
    }

    update(dt, player) {
        const horizon = player.z - CHUNK.length * 6;
        while (this.nextZ > horizon) {
            const gap = 18 / Math.max(0.4, this.density) + Math.random() * 8;
            this.nextZ -= gap;
            if (Math.random() < 0.82 * this.density) this.spawnObstacle(this.nextZ);
        }
        while (this.nextFeather > horizon) {
            this.nextFeather -= 14 / Math.max(0.5, this.featherRate) + Math.random() * 10;
            if (Math.random() < 0.7 * this.featherRate) this.spawnFeather(this.nextFeather);
        }

        const behind = player.z + 16;
        this.items = this.items.filter((it) => {
            if (it.z > behind) {
                this.scene.remove(it.mesh);
                return false;
            }
            return true;
        });
        this.feathers = this.feathers.filter((f) => {
            if (!f.live || f.z > behind) {
                this.scene.remove(f.mesh);
                return false;
            }
            f.spin += dt * 1.6;
            f.mesh.rotation.set(0.4, f.spin, 0.35);
            f.mesh.position.y = 1.05 + Math.sin(f.spin * 2.2) * 0.18;
            return true;
        });
    }

    collide(player) {
        if (player.invuln > 0 || !player.alive) return null;
        for (const it of this.items) {
            if (!it.live) continue;
            const dx = Math.abs(it.mesh.position.x - player.x);
            const dz = Math.abs(it.z - player.z);
            if (dx < 0.7 + it.w * 0.25 && dz < 1.15) {
                if (it.kind === 'low' && player.y > 0.55) continue;
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
            if (dx < 0.85 && dz < 0.95) {
                f.live = false;
                got.push(f);
            }
        }
        return got;
    }
}
