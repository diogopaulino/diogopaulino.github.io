/**
 * O mundo: vegetação das margens, pássaros e o "diretor" que decide o que
 * aparece à frente do jogador conforme ele avança rumo ao castelo.
 */

import * as THREE from 'three';
import { buildPineGeometry, buildOakGeometry, buildRockGeometry, plainMaterial } from './models.js';
import { centerX, halfWidth, terrainHeight } from './river.js';
import { COURSE_LENGTH, BOSS_Z } from './config.js';
import { clamp, randRange, pick } from './utils.js';

const SPAWN_AHEAD = 430;
const RECYCLE_BEHIND = 90;

/* ------------------------------------------------------------------ */
/* Vegetação instanciada                                               */
/* ------------------------------------------------------------------ */

class Scatter {
    constructor(scene, geometry, count, { minDist, maxDist, scale, sink = 0.6, tint = null }) {
        const material = new THREE.MeshStandardMaterial({
            vertexColors: !tint,
            color: tint || 0xffffff,
            roughness: 0.92,
            metalness: 0
        });

        this.mesh = new THREE.InstancedMesh(geometry, material, count);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false;
        scene.add(this.mesh);

        this.count = count;
        this.minDist = minDist;
        this.maxDist = maxDist;
        this.scaleRange = scale;
        this.sink = sink;
        this.items = new Array(count);
        this.dummy = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            this.items[i] = { x: 0, y: 0, z: 0, scale: 1, rot: 0, tilt: 0 };
        }
    }

    /** Sorteia uma posição válida na margem, na frente do jogador. */
    _place(item, z) {
        const side = Math.random() < 0.5 ? -1 : 1;
        const dist = randRange(this.minDist, this.maxDist);
        const x = centerX(z) + side * (halfWidth(z) + dist);
        const y = terrainHeight(x, z);
        item.x = x;
        item.y = y - this.sink;
        item.z = z;
        item.scale = randRange(this.scaleRange[0], this.scaleRange[1]);
        item.rot = randRange(0, Math.PI * 2);
        item.tilt = randRange(-0.06, 0.06);
        item.valid = y > 0.4;
    }

    /** Distribui tudo de uma vez ao (re)iniciar a partida. */
    reset(playerZ) {
        for (let i = 0; i < this.count; i++) {
            const z = playerZ + 60 - (i / this.count) * (SPAWN_AHEAD + 120) * 1.1 - randRange(0, 12);
            this._place(this.items[i], z);
            this._write(i);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    _write(i) {
        const item = this.items[i];
        const d = this.dummy;
        d.position.set(item.x, item.y, item.z);
        d.rotation.set(item.tilt, item.rot, item.tilt * 0.6);
        d.scale.setScalar(item.valid ? item.scale : 0.0001);
        d.updateMatrix();
        this.mesh.setMatrixAt(i, d.matrix);
    }

    update(playerZ) {
        let dirty = false;
        for (let i = 0; i < this.count; i++) {
            const item = this.items[i];
            if (item.z > playerZ + RECYCLE_BEHIND) {
                this._place(item, playerZ - SPAWN_AHEAD - randRange(0, 80));
                this._write(i);
                dirty = true;
            }
        }
        if (dirty) this.mesh.instanceMatrix.needsUpdate = true;
    }
}

/* ------------------------------------------------------------------ */
/* Pássaros                                                            */
/* ------------------------------------------------------------------ */

class Birds {
    constructor(scene, count = 14) {
        const geo = new THREE.BufferGeometry();
        // Um "V" simples: duas asas.
        geo.setAttribute('position', new THREE.Float32BufferAttribute([
            -0.9, 0, 0, 0, 0.25, 0.15, 0, 0.25, 0.15, 0.9, 0, 0
        ], 3));
        const material = new THREE.LineBasicMaterial({ color: 0x2b2621, transparent: true, opacity: 0.75 });

        this.group = new THREE.Group();
        this.birds = [];
        for (let i = 0; i < count; i++) {
            const line = new THREE.LineSegments(geo, material);
            this.group.add(line);
            this.birds.push({
                line,
                phase: Math.random() * Math.PI * 2,
                speed: randRange(7, 12),
                radius: randRange(30, 90),
                height: randRange(24, 52),
                offset: randRange(-120, 120)
            });
        }
        this.group.frustumCulled = false;
        scene.add(this.group);
    }

    update(dt, time, playerZ) {
        for (const b of this.birds) {
            b.phase += dt * 0.22;
            const x = centerX(playerZ - 120) + Math.cos(b.phase) * b.radius;
            const z = playerZ - 120 + Math.sin(b.phase) * b.radius * 0.6 + b.offset;
            b.line.position.set(x, b.height + Math.sin(time * 0.6 + b.phase) * 2.4, z);
            b.line.rotation.y = -b.phase + Math.PI / 2;
            const flap = Math.sin(time * b.speed + b.phase) * 0.5;
            b.line.rotation.z = flap * 0.35;
            b.line.scale.set(2.2, 1 + flap * 0.9, 2.2);
        }
    }
}

/* ------------------------------------------------------------------ */
/* Diretor de encontros                                                */
/* ------------------------------------------------------------------ */

export class World {
    constructor(scene, quality) {
        const s = quality.scatterScale;
        this.pines = new Scatter(scene, buildPineGeometry(), Math.round(150 * s), {
            minDist: 1.5,
            maxDist: 120,
            scale: [0.75, 1.5]
        });
        this.oaks = new Scatter(scene, buildOakGeometry(), Math.round(70 * s), {
            minDist: 2,
            maxDist: 95,
            scale: [0.7, 1.35]
        });
        this.bankRocks = new Scatter(scene, buildRockGeometry(5), Math.round(80 * s), {
            minDist: -2.5,
            maxDist: 70,
            scale: [0.8, 2.6],
            sink: 0.9,
            tint: 0x54504a
        });

        this.birds = quality.id === 'low' ? null : new Birds(scene, 12);
        this.nextSpawnZ = 0;
        this.lastKind = null;
    }

    reset(playerZ) {
        this.pines.reset(playerZ);
        this.oaks.reset(playerZ);
        this.bankRocks.reset(playerZ);
        this.nextSpawnZ = playerZ - 150;
        this.lastKind = null;
    }

    update(dt, time, playerZ) {
        this.pines.update(playerZ);
        this.oaks.update(playerZ);
        this.bankRocks.update(playerZ);
        this.birds?.update(dt, time, playerZ);
    }

    /**
     * Sorteia encontros à frente do jogador. A mistura muda com o progresso:
     * o começo é quase só navegação, o fim é um corredor de guerra.
     */
    direct(playerZ, entities, difficulty) {
        const progress = clamp(-playerZ / COURSE_LENGTH, 0, 1);

        while (this.nextSpawnZ > playerZ - SPAWN_AHEAD) {
            const z = this.nextSpawnZ;
            if (z > BOSS_Z + 130) this._spawnEncounter(z, progress, entities, difficulty);

            const gap = randRange(54, 104) / (0.8 + difficulty.spawnScale * 0.45 + progress * 0.5);
            this.nextSpawnZ -= Math.max(26, gap);
            if (this.nextSpawnZ < BOSS_Z + 130) break;
        }
    }

    _spawnEncounter(z, progress, entities, difficulty) {
        const cx = centerX(z);
        const hw = halfWidth(z);
        const lane = () => randRange(-0.62, 0.62);

        // Pesos por fase da jornada.
        const weights = [
            ['rock', 26 - progress * 10],
            ['pickup', 20 - progress * 6],
            ['enemyShip', 6 + progress * 26],
            ['tower', 4 + progress * 20],
            ['barricade', 8 + progress * 12],
            ['whirlpool', 4 + progress * 8]
        ];

        // Evita repetir o mesmo tipo duas vezes seguidas.
        const total = weights.reduce((sum, [kind, w]) => sum + (kind === this.lastKind ? w * 0.35 : w), 0);
        let roll = Math.random() * total;
        let kind = 'rock';
        for (const [k, w] of weights) {
            roll -= k === this.lastKind ? w * 0.35 : w;
            if (roll <= 0) {
                kind = k;
                break;
            }
        }
        this.lastKind = kind;

        switch (kind) {
            case 'rock': {
                const cluster = Math.random() < 0.45 ? 2 : 1;
                const base = lane();
                for (let i = 0; i < cluster; i++) {
                    const l = clamp(base + randRange(-0.22, 0.22), -0.8, 0.8);
                    entities.spawnRock(cx + l * hw, z - i * randRange(6, 14), randRange(0.7, 1.15));
                }
                break;
            }
            case 'pickup': {
                const type = Math.random() < 0.58
                    ? 'coin'
                    : Math.random() < 0.5
                        ? 'heart'
                        : pick(['shield', 'fury']);
                const l = lane();
                const count = type === 'coin' ? 3 : 1;
                for (let i = 0; i < count; i++) {
                    entities.spawnPickup(cx + l * hw + randRange(-1, 1), z - i * 7, type);
                }
                break;
            }
            case 'enemyShip': {
                entities.spawnEnemyShip(cx + lane() * hw, z, {
                    fireRate: (2.9 - progress * 1.1) / difficulty.enemyFireScale,
                    speed: randRange(5, 9) + progress * 4
                });
                if (progress > 0.55 && Math.random() < 0.35) {
                    entities.spawnEnemyShip(cx + lane() * hw, z - randRange(18, 34), {
                        fireRate: 3.2 / difficulty.enemyFireScale,
                        speed: randRange(5, 8)
                    });
                }
                break;
            }
            case 'tower': {
                const side = Math.random() < 0.5 ? -1 : 1;
                const x = cx + side * (hw + randRange(3, 11));
                entities.spawnTower(x, z, { fireRate: (3.6 - progress * 1.3) / difficulty.enemyFireScale });
                break;
            }
            case 'barricade': {
                // Deixa sempre um vão navegável.
                const l = lane();
                entities.spawnBarricade(cx + l * hw, z);
                if (Math.random() < 0.35) {
                    entities.spawnBarricade(cx + clamp(l + (l > 0 ? -0.55 : 0.55), -0.7, 0.7) * hw, z - randRange(9, 18));
                }
                break;
            }
            case 'whirlpool':
                entities.spawnWhirlpool(cx + lane() * hw * 0.8, z);
                break;
            default:
                break;
        }
    }
}
