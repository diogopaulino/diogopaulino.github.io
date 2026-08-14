/**
 * Mundo infinito em chunks.
 *
 * Altura h(x, z):
 *   continent = fBm(x·0.00105, z·0.00105) ^ 1.55           → serras longas
 *   ridge     = ridged(x·0.0022, z·0.0022) ^ 2.1            → cristas
 *   hills     = (fBm(x·0.0065, z·0.0065) − 0.38) · 14
 *   rolling   = fBm(x·0.0026, z·0.0026) ^ 1.25 · 20         → lombadas
 *   detail    = (fBm(x·0.034, z·0.034) − 0.5) · 2.1
 *   river     = |sin(warpX·0.004) · cos(warpZ·0.003)|        → talvegue
 *   carve     = (1 − smoothstep(0.02, 0.16, river))^2 · 15
 *   canyon    = −(1 − |2n−1|)^3 · 20 · máscara árida
 *   h         = continent·72 + ridge·continent·42 + hills + rolling + detail + canyon − carve
 *   mesa      = achata 14 < h < 32 onde arid > 0.62
 *
 * Bioma: alpine / pine / prairie / desert / mesa / canyon / riparian.
 * Água: plano em WATER_Y; o terreno abaixo vira rio.
 */

import * as THREE from 'three';
import { CHUNK_SIZE, WATER_Y, REGION_PREFIX, REGION_SUFFIX } from './config.js';
import { fbm, ridged, hash2, seeded, smoothstep, lerp } from './utils.js';
import { dirtTexture } from './textures.js';
import {
    buildPine, buildCottonwood, buildCactus, buildRock, buildCabin,
    buildSaloon, buildWagon, buildCampfire, buildArch,
    grassBladeGeometry, grassMaterial, disposeUnique
} from './models.js';

export function aridAt(x, z) {
    return fbm(x * 0.00092, z * 0.00092, 7, 4);
}

export function heightAt(x, z) {
    const continent = Math.pow(fbm(x * 0.00105, z * 0.00105, 1, 5), 1.22);
    const ridge = Math.pow(ridged(x * 0.0022, z * 0.0022, 11, 4), 2.1);
    const mountains = continent * 72 + ridge * continent * 42;
    const hills = (fbm(x * 0.0065, z * 0.0065, 3, 5) - 0.38) * 14;
    const rolling = Math.pow(fbm(x * 0.0026, z * 0.0026, 15, 4), 1.25) * 20;
    const detail = (fbm(x * 0.034, z * 0.034, 9, 3) - 0.5) * 2.1;

    const warpX = x + (fbm(x * 0.002, z * 0.002, 21, 3) - 0.5) * 180;
    const warpZ = z + (fbm(x * 0.002, z * 0.002, 27, 3) - 0.5) * 180;
    const river = Math.abs(Math.sin(warpX * 0.0042) * Math.cos(warpZ * 0.0031));
    const carve = Math.pow(1 - smoothstep(0.02, 0.16, river), 2) * 15;

    const arid = aridAt(x, z);
    const canyonMask = smoothstep(0.55, 0.82, arid) * smoothstep(0.32, 0.7, ridge);
    const nCan = ridged(x * 0.0062, z * 0.0062, 33, 3);
    const canyon = -Math.pow(nCan, 3) * 20 * canyonMask;

    let h = mountains + hills + rolling + detail + canyon - carve;
    if (arid > 0.62 && h > 14 && h < 32) {
        h = lerp(h, 18 + (h - 18) * 0.18, smoothstep(0.62, 0.8, arid));
    }
    return h;
}

export function biomeAt(x, z, h = heightAt(x, z)) {
    const arid = aridAt(x, z);
    const moist = 1 - arid;
    if (h < WATER_Y + 1.6) return 'riparian';
    if (h > 48) return 'alpine';
    const canyonDeep = h < 12 && arid > 0.55 && ridged(x * 0.0062, z * 0.0062, 33, 3) > 0.55;
    if (canyonDeep) return 'canyon';
    if (h > 30 && moist > 0.42) return 'pine';
    if (arid > 0.6) return h > 18 ? 'mesa' : 'desert';
    return 'prairie';
}

export function regionName(cx, cz) {
    const a = Math.floor(hash2(cx, cz, 41) * REGION_PREFIX.length);
    const b = Math.floor(hash2(cx, cz, 73) * REGION_SUFFIX.length);
    return `${REGION_PREFIX[a]} ${REGION_SUFFIX[b]}`;
}

const GOLD = new THREE.Color(0xd2b05a);
const GREEN = new THREE.Color(0x5a7a32);
const DIRT = new THREE.Color(0xa86a38);
const REDROCK = new THREE.Color(0xb24a28);
const SAND = new THREE.Color(0xc4a06a);
const STONE = new THREE.Color(0x8a8078);
const SNOW = new THREE.Color(0xe8e4dc);
const WET = new THREE.Color(0x4a5a38);
const tmpC = new THREE.Color();

function vertexColor(x, z, y) {
    const biome = biomeAt(x, z, y);
    const n = fbm(x * 0.04, z * 0.04, 9, 3);
    switch (biome) {
        case 'riparian':
            tmpC.copy(WET).lerp(DIRT, n * 0.4);
            break;
        case 'alpine':
            tmpC.copy(STONE).lerp(SNOW, smoothstep(46, 58, y));
            break;
        case 'pine':
            tmpC.copy(DIRT).lerp(GREEN, 0.45 + n * 0.2);
            break;
        case 'desert':
            tmpC.copy(SAND).lerp(DIRT, n * 0.35);
            break;
        case 'mesa':
        case 'canyon':
            tmpC.copy(REDROCK).lerp(SAND, n * 0.35);
            break;
        default:
            tmpC.copy(GOLD).lerp(n > 0.58 ? GREEN : DIRT, n > 0.58 ? 0.45 : n * 0.4);
    }
    tmpC.offsetHSL(0, 0, (hash2(x, z, 2) - 0.5) * 0.06);
    return tmpC;
}

function makeTerrainGeometry(cx, cz, segs) {
    const size = CHUNK_SIZE;
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const ox = (cx + 0.5) * size;
    const oz = (cz + 0.5) * size;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + ox;
        const z = pos.getZ(i) + oz;
        const y = heightAt(x, z);
        pos.setY(i, y);
        const c = vertexColor(x, z, y);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    geo.userData.unique = true;
    return geo;
}

export class World {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.chunks = new Map();
        this.colliders = [];
        this.waterY = WATER_Y;
        this.heightAt = heightAt;
        this.biomeAt = biomeAt;
        this.landmarks = [];
        this.discovered = new Set();

        this.terrainMat = new THREE.MeshStandardMaterial({
            map: dirtTexture(),
            vertexColors: true,
            roughness: 0.94,
            metalness: 0
        });

        this.addWater();
        this.addHorizon();
        this.scatterGrass();
    }

    addWater() {
        const geo = new THREE.PlaneGeometry(1400, 1400, 1, 1);
        geo.rotateX(-Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x2a4a48,
            roughness: 0.18,
            metalness: 0.22,
            transparent: true,
            opacity: 0.82
        });
        this.water = new THREE.Mesh(geo, mat);
        this.water.position.y = WATER_Y;
        this.water.receiveShadow = true;
        this.group.add(this.water);
    }

    /**
     * Silhuetas de serra no horizonte — acompanham o cavalo para o oeste
     * nunca parecer uma mesa infinita.
     */
    addHorizon() {
        this.peaks = [];
        const rock = new THREE.MeshStandardMaterial({
            color: 0x6a3a28,
            roughness: 0.96,
            flatShading: true
        });
        const snow = new THREE.MeshStandardMaterial({
            color: 0xd8d0c4,
            roughness: 0.88,
            flatShading: true
        });
        for (let i = 0; i < 16; i++) {
            const g = new THREE.Group();
            const n = 2 + (i % 3);
            for (let k = 0; k < n; k++) {
                const h = 28 + hash2(i, k, 4) * 48;
                const r = 10 + hash2(i, k, 8) * 16;
                const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 5), k === 0 && h > 52 ? snow : rock);
                cone.position.set((k - 1) * r * 1.1, h * 0.5, (hash2(i, k, 2) - 0.5) * 12);
                cone.rotation.y = hash2(i, k, 11) * 6;
                g.add(cone);
            }
            g.traverse((c) => {
                if (c.isMesh) {
                    c.castShadow = false;
                    c.receiveShadow = false;
                }
            });
            this.group.add(g);
            this.peaks.push({
                group: g,
                angle: (i / 16) * Math.PI * 2,
                dist: 260 + hash2(i, 1, 19) * 90
            });
        }
    }

    scatterGrass() {
        const count = this.quality.grass;
        const geo = grassBladeGeometry();
        this.grassMat = grassMaterial();
        const mesh = new THREE.InstancedMesh(geo, this.grassMat, count);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        this.group.add(mesh);
        this.grass = mesh;
        this._grassOrigin = { x: 99999, z: 99999 };
        this._dummy = new THREE.Object3D();
    }

    refreshGrass(px, pz) {
        if (Math.hypot(px - this._grassOrigin.x, pz - this._grassOrigin.z) < 10) return;
        this._grassOrigin = { x: px, z: pz };
        const rng = seeded(((px * 13) | 0) * 73856093 ^ ((pz * 17) | 0) * 19349663);
        const dummy = this._dummy;
        const count = this.grass.count;
        const radius = 42;
        let placed = 0;
        for (let i = 0; i < count * 3 && placed < count; i++) {
            const a = rng() * Math.PI * 2;
            const r = Math.sqrt(rng()) * radius;
            const x = px + Math.cos(a) * r;
            const z = pz + Math.sin(a) * r;
            const y = heightAt(x, z);
            const biome = biomeAt(x, z, y);
            if (biome === 'desert' || biome === 'alpine' || y < WATER_Y + 0.4) continue;
            dummy.position.set(x, y, z);
            dummy.rotation.y = rng() * Math.PI;
            dummy.scale.setScalar(0.65 + rng() * 1.15);
            dummy.updateMatrix();
            this.grass.setMatrixAt(placed, dummy.matrix);
            placed++;
        }
        for (let i = placed; i < count; i++) {
            dummy.position.set(0, -40, 0);
            dummy.scale.setScalar(0);
            dummy.updateMatrix();
            this.grass.setMatrixAt(i, dummy.matrix);
        }
        this.grass.instanceMatrix.needsUpdate = true;
        this.grass.count = Math.max(1, placed);
    }

    loadChunk(cx, cz) {
        const key = `${cx},${cz}`;
        if (this.chunks.has(key)) return;
        const chunk = new THREE.Group();
        chunk.position.set((cx + 0.5) * CHUNK_SIZE, 0, (cz + 0.5) * CHUNK_SIZE);

        const geo = makeTerrainGeometry(cx, cz, this.quality.terrainSegments);
        const mesh = new THREE.Mesh(geo, this.terrainMat);
        mesh.receiveShadow = true;
        mesh.castShadow = false;
        mesh.position.set(-(cx + 0.5) * CHUNK_SIZE, 0, -(cz + 0.5) * CHUNK_SIZE);
        chunk.add(mesh);

        const colliders = [];
        const marks = this.scatterProps(cx, cz, chunk, colliders);
        this.group.add(chunk);
        this.chunks.set(key, { group: chunk, colliders, marks, cx, cz });
        this.colliders.push(...colliders);
        for (const m of marks) this.landmarks.push(m);
    }

    scatterProps(cx, cz, chunk, colliders) {
        const rng = seeded(((cx + 4096) * 73856093) ^ ((cz + 4096) * 19349663));
        const ox = (cx + 0.5) * CHUNK_SIZE;
        const oz = (cz + 0.5) * CHUNK_SIZE;
        const marks = [];
        const trees = this.quality.trees;
        const rocks = this.quality.rocks;

        const centerBiome = biomeAt(ox, oz);
        const roll = hash2(cx, cz, 91);

        if (roll < 0.042 && (centerBiome === 'prairie' || centerBiome === 'desert')) {
            this.placeTown(ox, oz, chunk, colliders, rng);
            marks.push({ id: 'town', x: ox, z: oz, label: 'Povoado' });
        } else if (roll < 0.078) {
            const camp = buildCampfire();
            const y = heightAt(ox + 4, oz - 3);
            camp.position.set(4, y, -3);
            chunk.add(camp);
            marks.push({ id: 'camp', x: ox + 4, z: oz - 3, label: 'Fogueira' });
        } else if (roll < 0.11 && (centerBiome === 'mesa' || centerBiome === 'canyon' || centerBiome === 'desert')) {
            const arch = buildArch();
            const y = heightAt(ox, oz);
            arch.position.set(0, y, 0);
            arch.rotation.y = rng() * Math.PI;
            chunk.add(arch);
            colliders.push({ x: ox - 3.2, z: oz, r: 2.2 });
            colliders.push({ x: ox + 3.2, z: oz, r: 2.2 });
            marks.push({ id: 'arch', x: ox, z: oz, label: 'Arco de pedra' });
        } else if (roll < 0.145) {
            const wagon = buildWagon();
            const y = heightAt(ox - 6, oz + 8);
            wagon.position.set(-6, y, 8);
            wagon.rotation.y = rng() * 6;
            chunk.add(wagon);
            colliders.push({ x: ox - 6, z: oz + 8, r: 1.8 });
            marks.push({ id: 'wagon', x: ox - 6, z: oz + 8, label: 'Carroça' });
        }

        for (let i = 0; i < trees; i++) {
            const lx = (rng() - 0.5) * (CHUNK_SIZE - 8);
            const lz = (rng() - 0.5) * (CHUNK_SIZE - 8);
            const x = ox + lx;
            const z = oz + lz;
            const y = heightAt(x, z);
            if (y < WATER_Y + 0.5) continue;
            const biome = biomeAt(x, z, y);
            let prop = null;
            let radius = 0.7;
            if (biome === 'pine' || biome === 'alpine') {
                if (rng() > 0.15) prop = buildPine(rng);
                radius = 0.85;
            } else if (biome === 'riparian') {
                prop = buildCottonwood(rng);
                radius = 0.9;
            } else if (biome === 'desert' || biome === 'mesa') {
                prop = buildCactus(rng);
                radius = 0.45;
            } else if (biome === 'prairie') {
                if (rng() > 0.55) prop = buildCottonwood(rng);
                radius = 0.8;
            } else if (biome === 'canyon' && rng() > 0.7) {
                prop = buildCactus(rng);
                radius = 0.4;
            }
            if (!prop) continue;
            const s = 0.75 + rng() * 0.55;
            prop.scale.setScalar(s);
            prop.position.set(lx, y, lz);
            prop.rotation.y = rng() * Math.PI * 2;
            chunk.add(prop);
            colliders.push({ x, z, r: radius * s });
        }

        for (let i = 0; i < rocks; i++) {
            const lx = (rng() - 0.5) * (CHUNK_SIZE - 6);
            const lz = (rng() - 0.5) * (CHUNK_SIZE - 6);
            const x = ox + lx;
            const z = oz + lz;
            const y = heightAt(x, z);
            if (y < WATER_Y + 0.2) continue;
            const rock = buildRock(rng);
            const s = 0.7 + rng() * 1.4;
            rock.scale.setScalar(s);
            rock.position.set(lx, y, lz);
            rock.rotation.y = rng() * 6;
            chunk.add(rock);
            colliders.push({ x, z, r: 1.1 * s });
        }

        if (centerBiome === 'riparian' || centerBiome === 'pine') {
            const y0 = heightAt(ox, oz);
            const y1 = heightAt(ox + 8, oz);
            if (y0 > WATER_Y + 8 && y1 < WATER_Y + 2.5) {
                marks.push({ id: 'falls', x: ox, z: oz, label: 'Cachoeira' });
                const spray = new THREE.Points(
                    this.makeSprayGeo(),
                    new THREE.PointsMaterial({
                        color: 0xd8e8e8, size: 0.18, transparent: true, opacity: 0.45, depthWrite: false
                    })
                );
                spray.position.set(0, WATER_Y + 4, 0);
                chunk.add(spray);
            }
        }

        return marks;
    }

    makeSprayGeo() {
        const n = 40;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 4;
            pos[i * 3 + 1] = Math.random() * 6;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 3;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.userData.unique = true;
        return geo;
    }

    placeTown(ox, oz, chunk, colliders, rng) {
        const saloon = buildSaloon();
        const sy = heightAt(ox, oz);
        saloon.position.set(0, sy, 0);
        chunk.add(saloon);
        colliders.push({ x: ox, z: oz, r: 3.6 });
        for (let i = 0; i < 3; i++) {
            const cabin = buildCabin();
            const lx = (i - 1) * 9 + (rng() - 0.5) * 2;
            const lz = 10 + (rng() - 0.5) * 4;
            const y = heightAt(ox + lx, oz + lz);
            cabin.position.set(lx, y, lz);
            cabin.rotation.y = rng() * 0.4 - 0.2 + Math.PI;
            chunk.add(cabin);
            colliders.push({ x: ox + lx, z: oz + lz, r: 2.4 });
        }
    }

    unloadChunk(key) {
        const chunk = this.chunks.get(key);
        if (!chunk) return;
        this.group.remove(chunk.group);
        disposeUnique(chunk.group);
        chunk.group.traverse((c) => {
            if (c.isMesh && c.geometry?.userData?.unique) c.geometry.dispose();
        });
        this.colliders = this.colliders.filter((c) => !chunk.colliders.includes(c));
        this.landmarks = this.landmarks.filter((m) => !chunk.marks.includes(m));
        this.chunks.delete(key);
    }

    update(dt, time, player) {
        const pcx = Math.floor(player.x / CHUNK_SIZE);
        const pcz = Math.floor(player.z / CHUNK_SIZE);
        const r = this.quality.chunkRadius;
        const needed = new Set();
        for (let dz = -r; dz <= r; dz++) {
            for (let dx = -r; dx <= r; dx++) {
                const key = `${pcx + dx},${pcz + dz}`;
                needed.add(key);
                this.loadChunk(pcx + dx, pcz + dz);
            }
        }
        for (const key of [...this.chunks.keys()]) {
            if (!needed.has(key)) this.unloadChunk(key);
        }

        this.water.position.x = player.x;
        this.water.position.z = player.z;
        this.refreshGrass(player.x, player.z);
        this.updateHorizon(player);

        if (this.grassMat.userData.shader) {
            this.grassMat.userData.shader.uniforms.uTime.value = time;
        }

        this.group.traverse((c) => {
            if (c.name === 'flame') {
                c.scale.y = 0.85 + Math.sin(time * 9 + c.id) * 0.18;
                c.rotation.y += dt * 2.4;
            }
        });
    }

    updateHorizon(player) {
        if (!this.peaks) return;
        for (const p of this.peaks) {
            const x = player.x + Math.cos(p.angle) * p.dist;
            const z = player.z + Math.sin(p.angle) * p.dist;
            const y = heightAt(x, z);
            p.group.position.set(x, Math.max(y - 6, 2), z);
            p.group.rotation.y = p.angle;
        }
    }

    collide(x, z, radius) {
        let ox = x;
        let oz = z;
        for (const c of this.colliders) {
            const dx = ox - c.x;
            const dz = oz - c.z;
            const d = Math.hypot(dx, dz);
            const min = radius + c.r;
            if (d < min && d > 1e-4) {
                const push = (min - d) / d;
                ox += dx * push;
                oz += dz * push;
            }
        }
        return { x: ox, z: oz };
    }

    nearestLandmark(x, z, maxDist = 18) {
        let best = null;
        let bestD = maxDist;
        for (const m of this.landmarks) {
            const d = Math.hypot(m.x - x, m.z - z);
            if (d < bestD) {
                best = m;
                bestD = d;
            }
        }
        return best;
    }

    currentRegion(x, z) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        return { name: regionName(cx, cz), cx, cz, biome: biomeAt(x, z) };
    }

    findSpawn() {
        for (let i = 0; i < 100; i++) {
            const a = hash2(i, 4, 5) * Math.PI * 2;
            const r = 18 + hash2(i, 9, 6) * 90;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            const y = heightAt(x, z);
            const b = biomeAt(x, z, y);
            const slope = Math.abs(heightAt(x + 4, z) - y) + Math.abs(heightAt(x, z + 4) - y);
            const horizon = Math.max(
                heightAt(x + 80, z),
                heightAt(x - 80, z),
                heightAt(x, z + 80),
                heightAt(x, z - 80)
            );
            if (y > WATER_Y + 1.8 && y < 26 && slope < 5 && horizon > y + 10
                && (b === 'prairie' || b === 'desert' || b === 'mesa')) {
                return { x, z, yaw: a + Math.PI, y };
            }
        }
        return { x: 8, z: 24, yaw: 0.4, y: heightAt(8, 24) };
    }
}
