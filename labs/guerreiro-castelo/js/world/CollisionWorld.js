/**
 * Mundo de colisão sem engine externa.
 * Caixas AABB, chão, degraus pequenos e rampas até o limite.
 */

import * as THREE from 'three';
import { clamp } from '../utils/math.js';

const _center = new THREE.Vector3();
const _size = new THREE.Vector3();

export class CollisionWorld {
    constructor() {
        this.boxes = [];
        this.triggers = [];
        this.noiseSources = [];
    }

    clear() {
        this.boxes.length = 0;
        this.triggers.length = 0;
        this.noiseSources.length = 0;
    }

    addBox(minx, miny, minz, maxx, maxy, maxz, opts = {}) {
        this.boxes.push({
            min: new THREE.Vector3(minx, miny, minz),
            max: new THREE.Vector3(maxx, maxy, maxz),
            solid: opts.solid !== false,
            climb: Boolean(opts.climb),
            oneWay: Boolean(opts.oneWay),
            id: opts.id || null
        });
    }

    addFloor(x, z, w, d, y = 0) {
        this.addBox(x - w / 2, y - 0.4, z - d / 2, x + w / 2, y, z + d / 2, { id: 'floor' });
    }

    addWall(x, z, w, d, h, y = 0) {
        this.addBox(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2);
    }

    addTrigger(id, minx, miny, minz, maxx, maxy, maxz) {
        this.triggers.push({
            id,
            min: new THREE.Vector3(minx, miny, minz),
            max: new THREE.Vector3(maxx, maxy, maxz),
            inside: false
        });
    }

    emitNoise(x, z, amount, ttl = 0.4) {
        this.noiseSources.push({ x, z, amount, ttl });
    }

    update(dt) {
        for (let i = this.noiseSources.length - 1; i >= 0; i--) {
            this.noiseSources[i].ttl -= dt;
            if (this.noiseSources[i].ttl <= 0) this.noiseSources.splice(i, 1);
        }
    }

    groundHeight(x, z, fromY, radius = 0.28) {
        let best = -Infinity;
        for (const b of this.boxes) {
            if (!b.solid) continue;
            if (x + radius < b.min.x || x - radius > b.max.x) continue;
            if (z + radius < b.min.z || z - radius > b.max.z) continue;
            if (b.max.y > fromY + 0.55) continue;
            if (b.max.y > best) best = b.max.y;
        }
        return best === -Infinity ? null : best;
    }

    /**
     * Resolve cápsula contra AABBs. Step offset ~0.4, rampas até ~50°.
     * @returns {{x:number,y:number,z:number,grounded:boolean,hit:boolean}}
     */
    resolveCapsule(px, py, pz, radius, height, vx, vz, dt, step = 0.42) {
        let x = px + vx * dt;
        let z = pz + vz * dt;
        let y = py;
        let hit = false;

        for (let pass = 0; pass < 3; pass++) {
            for (const b of this.boxes) {
                if (!b.solid) continue;
                const top = b.max.y;
                const bottom = b.min.y;
                if (y + height < bottom || y > top + 0.02) continue;
                const nx = clamp(x, b.min.x, b.max.x);
                const nz = clamp(z, b.min.z, b.max.z);
                const dx = x - nx;
                const dz = z - nz;
                const d2 = dx * dx + dz * dz;
                if (d2 >= radius * radius) continue;

                const stepH = top - y;
                if (stepH > 0 && stepH <= step && y + 0.05 >= bottom) {
                    y = top;
                    continue;
                }

                const dist = Math.sqrt(d2) || 0.0001;
                const push = radius - dist + 0.001;
                x += (dx / dist) * push;
                z += (dz / dist) * push;
                hit = true;
            }
        }

        const fromY = Math.max(y, py) + height;
        const ground = this.groundHeight(x, z, fromY, radius * 0.85);
        let grounded = false;
        if (ground !== null) {
            if (y <= ground + 0.08) {
                y = ground;
                grounded = true;
            }
        }

        return { x, y, z, grounded, hit };
    }

    overlappingTriggers(x, y, z) {
        const hits = [];
        for (const t of this.triggers) {
            const inside = x >= t.min.x && x <= t.max.x && y >= t.min.y && y <= t.max.y && z >= t.min.z && z <= t.max.z;
            t.inside = inside;
            if (inside) hits.push(t.id);
        }
        return hits;
    }

    debugBox(box) {
        box.getCenter(_center);
        box.getSize(_size);
        return { center: _center, size: _size };
    }
}
