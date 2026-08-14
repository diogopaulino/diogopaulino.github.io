/**
 * Eyra: picos flutuantes, canópia, a Yva e os anéis de névoa.
 * Colisores esféricos por pico — o voo empurra na normal.
 */

import * as THREE from 'three';
import { WORLD, SEEDS } from './config.js';
import { hash, mulberry32 } from './utils.js';
import { createSky } from './sky.js';
import { applyWater } from './shaders.js';
import { waterTexture, mossTexture } from './textures.js';
import {
    materials, createIra, createYva, createMountain, createCanopyTree,
    createPeakTree, createSpiralPlant, createWaterfall, createSeed,
    createRing, createCloud, std, geo, mesh
} from './models.js';

const LANDMARKS = [
    { x: 0, y: 38, z: 0, size: 1.55, yva: true, fall: false },
    { x: 72, y: 62, z: -48, size: 1.15, seed: 0, fall: true },
    { x: -80, y: 54, z: -28, size: 1.05, seed: 1, fall: true },
    { x: 48, y: 88, z: 64, size: 0.95, seed: 2, fall: false },
    { x: -56, y: 78, z: 70, size: 1.2, seed: 3, fall: true },
    { x: 110, y: 50, z: 18, size: 0.88, seed: 4, fall: false },
    { x: -108, y: 46, z: 12, size: 0.92, seed: 5, fall: true },
    { x: 22, y: 118, z: -92, size: 0.78, seed: 6, fall: false },
    { x: -30, y: 102, z: 108, size: 0.85, seed: 7, fall: true },
    { x: 86, y: 36, z: 96, size: 0.7, fall: false },
    { x: -92, y: 34, z: -88, size: 0.74, fall: false },
    { x: 0, y: 28, z: -120, size: 0.82, fall: true },
    { x: 130, y: 70, z: -70, size: 0.62, fall: false }
];

export class World {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.root = new THREE.Group();
        this.root.name = 'eyra';
        scene.add(this.root);

        this.colliders = [];
        this.seeds = [];
        this.rings = [];
        this.clouds = [];
        this.clock = 0;

        this.sky = createSky();
        scene.add(this.sky);

        this._floor();
        this._peaks();
        this._jungle();
        this._rings();
        this._clouds();
        this._fog(scene);
    }

    _floor() {
        const m = materials();
        const ground = mesh(
            new THREE.CircleGeometry(WORLD.radius * 1.35, 64),
            std(0x145828, { map: mossTexture(), roughness: 0.95 }),
            { rot: [-Math.PI / 2, 0, 0], pos: [0, 0, 0], cast: false }
        );
        this.root.add(ground);

        const lakeMat = applyWater(std(0x1a7a8a, {
            map: waterTexture(),
            roughness: 0.12,
            metalness: 0.28,
            transparent: true,
            opacity: 0.82
        }));
        this.lake = mesh(new THREE.CircleGeometry(38, 48), lakeMat, {
            rot: [-Math.PI / 2, 0, 0],
            pos: [18, 0.4, 24],
            cast: false
        });
        this.root.add(this.lake);

        const mist = mesh(
            new THREE.CircleGeometry(WORLD.radius * 0.9, 32),
            std(0xc8e8d8, { transparent: true, opacity: 0.08, roughness: 1 }),
            { rot: [-Math.PI / 2, 0, 0], pos: [0, 14, 0], cast: false, receive: false }
        );
        this.root.add(mist);
    }

    _peaks() {
        const rng = mulberry32(42);
        const count = Math.min(LANDMARKS.length, this.quality.peaks + 2);
        for (let i = 0; i < count; i++) {
            const L = LANDMARKS[i];
            const peak = createMountain(rng, L.size);
            peak.position.set(L.x, L.y, L.z);
            peak.rotation.y = rng() * Math.PI * 2;
            this.root.add(peak);

            const r = 8 * L.size;
            const h = 18 * L.size;
            this.colliders.push({
                x: L.x,
                y: L.y + h * 0.1,
                z: L.z,
                r: r * 0.85,
                top: L.y + h * 0.55
            });

            if (L.yva) {
                const yva = createYva();
                yva.position.set(L.x, L.y + h * 0.48, L.z);
                this.root.add(yva);
                this.yva = yva;
                this.yvaPos = new THREE.Vector3(L.x, L.y + h * 0.48 + 14, L.z);
            }

            const trees = 3 + Math.floor(rng() * 4);
            for (let t = 0; t < trees; t++) {
                const a = rng() * Math.PI * 2;
                const d = rng() * r * 0.55;
                const tree = createPeakTree(rng);
                tree.position.set(
                    L.x + Math.cos(a) * d,
                    L.y + h * 0.5,
                    L.z + Math.sin(a) * d
                );
                tree.scale.setScalar(0.7 + rng() * 0.5);
                this.root.add(tree);
            }

            if (L.fall) {
                const fall = createWaterfall(h * 1.15, 1.6 + rng() * 1.2);
                const a = rng() * Math.PI * 2;
                fall.position.set(
                    L.x + Math.cos(a) * r * 0.55,
                    L.y + h * 0.2,
                    L.z + Math.sin(a) * r * 0.55
                );
                fall.lookAt(L.x, L.y, L.z);
                this.root.add(fall);
            }

            if (Number.isInteger(L.seed) && L.seed < SEEDS) {
                const seed = createSeed();
                seed.position.set(L.x, L.y + h * 0.62 + 2.4, L.z);
                seed.userData.taken = false;
                seed.userData.index = L.seed;
                this.root.add(seed);
                this.seeds.push(seed);
            }
        }
    }

    _jungle() {
        const rng = mulberry32(99);
        const n = this.quality.trees;
        for (let i = 0; i < n; i++) {
            const a = hash(i * 17.2) * Math.PI * 2;
            const d = 22 + hash(i * 9.1) * (WORLD.radius * 0.85);
            if (d < 28) continue;
            const tree = createCanopyTree(rng);
            tree.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
            tree.rotation.y = rng() * 6;
            tree.scale.setScalar(0.7 + rng() * 0.7);
            this.root.add(tree);
        }
        const plants = this.quality.plants;
        for (let i = 0; i < plants; i++) {
            const a = hash(i * 23.7) * Math.PI * 2;
            const d = 8 + hash(i * 4.4) * 90;
            const p = createSpiralPlant(rng);
            const peak = LANDMARKS[i % 6];
            if (i % 3 === 0) {
                p.position.set(peak.x + (rng() - 0.5) * 10, peak.y + 10, peak.z + (rng() - 0.5) * 10);
            } else {
                p.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d);
            }
            p.scale.setScalar(0.8 + rng() * 0.8);
            this.root.add(p);
        }
    }

    _rings() {
        const path = [
            [40, 58, -20],
            [64, 70, 8],
            [50, 92, 48],
            [8, 100, 70],
            [-42, 86, 62],
            [-70, 64, 24],
            [-48, 72, -36],
            [6, 110, -70],
            [38, 96, -80],
            [90, 58, -30],
            [20, 48, 20],
            [-20, 130, 20]
        ];
        for (const [x, y, z] of path) {
            const ring = createRing();
            ring.position.set(x, y, z);
            ring.lookAt(0, y, 0);
            ring.userData.taken = false;
            this.root.add(ring);
            this.rings.push(ring);
        }
    }

    _clouds() {
        const rng = mulberry32(7);
        for (let i = 0; i < this.quality.clouds; i++) {
            const c = createCloud(rng);
            const a = rng() * Math.PI * 2;
            const d = 40 + rng() * 180;
            c.position.set(Math.cos(a) * d, 30 + rng() * 90, Math.sin(a) * d);
            c.userData.drift = (rng() - 0.5) * 1.6;
            this.root.add(c);
            this.clouds.push(c);
        }
    }

    _fog(scene) {
        scene.fog = new THREE.Fog(0x1a4a52, WORLD.fogNear, WORLD.fogFar);
        scene.background = new THREE.Color(0x143a48);
    }

    groundHeight(x, z) {
        let h = WORLD.canopy;
        for (const c of this.colliders) {
            const d = Math.hypot(x - c.x, z - c.z);
            const reach = c.r * 1.55;
            if (d < reach) {
                const k = 1 - d / reach;
                h = Math.max(h, c.top * (k * k) + 1.2);
            }
        }
        return h;
    }

    collide(pos, radius) {
        let hit = null;
        for (const c of this.colliders) {
            const dx = pos.x - c.x;
            const dy = pos.y - c.y;
            const dz = pos.z - c.z;
            const d = Math.hypot(dx, dy, dz);
            const min = c.r + radius;
            if (d < min && d > 0.001) {
                const k = min / d;
                pos.x = c.x + dx * k;
                pos.y = c.y + dy * k;
                pos.z = c.z + dz * k;
                hit = { nx: dx / d, ny: dy / d, nz: dz / d };
            }
        }
        const radial = Math.hypot(pos.x, pos.z);
        if (radial > WORLD.radius) {
            const k = WORLD.radius / radial;
            pos.x *= k;
            pos.z *= k;
        }
        return hit;
    }

    update(dt, dusk) {
        this.clock += dt;
        const t = this.clock;
        for (const seed of this.seeds) {
            if (seed.userData.taken) continue;
            seed.rotation.y += dt * 1.4;
            seed.position.y += Math.sin(t * 2.2 + seed.userData.index) * 0.006;
            if (seed.userData.core) seed.userData.core.rotation.x += dt * 0.8;
        }
        for (const ring of this.rings) {
            if (ring.userData.taken) {
                ring.rotation.z += dt * 4;
                continue;
            }
            ring.rotation.z += dt * 0.8;
        }
        for (const c of this.clouds) {
            c.position.x += c.userData.drift * dt;
            c.position.z += Math.sin(t * 0.05 + c.position.x * 0.01) * 0.4 * dt;
        }
        if (this.yva?.userData.heart) {
            this.yva.userData.heart.rotation.y += dt * 0.6;
            this.yva.userData.heart.scale.setScalar(1 + Math.sin(t * 1.6) * 0.06);
        }
        if (this.sky?.userData.mat) {
            this.sky.userData.mat.uniforms.uDusk.value = dusk;
        }
    }

    resetPickups() {
        for (const seed of this.seeds) {
            seed.visible = true;
            seed.userData.taken = false;
        }
        for (const ring of this.rings) {
            ring.visible = true;
            ring.userData.taken = false;
            ring.scale.setScalar(1);
        }
    }
}

export { createIra };
