/**
 * Manhattan comprimida: grid de avenidas, distritos, marcos e colisores AABB.
 * Prédios comuns entram num InstancedMesh; marcos são grupos únicos.
 */

import * as THREE from 'three';
import { GRID, PALETTE } from './config.js';
import { hash, mulberry32, rayAABB, aabbNormal, sphereAABB, clamp } from './utils.js';
import {
    windowTexture, facadeTexture, asphaltTexture, waterTexture, grassTexture,
    billboardTexture, SIGN_WORDS
} from './textures.js';
import { createSky, createGroundShader } from './sky.js';
import {
    createMaterials, boxCollider,
    createEmpire, createChrysler, createWTC, createFlatiron,
    createBridge, createLiberty, createWaterTower
} from './buildings.js';

const CELL = 70;
const BOX = new THREE.BoxGeometry(1, 1, 1);

export class City {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.colliders = [];
        this.cells = new Map();
        this.dummy = new THREE.Object3D();
        this.color = new THREE.Color();
        this.pulses = [];
        this.traffic = [];
        this.time = 0;

        const { cols, rows, avenue, street } = GRID;
        this.blockW = avenue - GRID.avenueW;
        this.blockD = street - GRID.streetW;
        this.originX = -(cols * avenue) * 0.5;
        this.originZ = -(rows * street) * 0.5;
        this.minX = this.originX + 4;
        this.maxX = this.originX + cols * avenue - 4;
        this.minZ = this.originZ + 4;
        this.maxZ = this.originZ + rows * street - 4;

        this.windowMap = windowTexture(THREE, 3);
        this.facadeMap = facadeTexture(THREE);
        this.asphaltMap = asphaltTexture(THREE);
        this.waterMap = waterTexture(THREE);
        this.grassMap = grassTexture(THREE);
        this.mats = createMaterials(this.windowMap, this.facadeMap);

        this.root = new THREE.Group();
        scene.add(this.root);

        this.sky = createSky();
        this.root.add(this.sky.mesh);

        this.buildIsland();
        this.buildGrid();
        this.buildLandmarks();
        this.buildPark();
        this.buildWater();
        this.buildTraffic();
        this.buildPulses();
    }

    cellOf(ix, iz) {
        const { avenue, street } = GRID;
        return {
            x: this.originX + (ix + 0.5) * avenue,
            z: this.originZ + (iz + 0.5) * street
        };
    }

    addCollider(b) {
        this.colliders.push(b);
        const i = this.colliders.length - 1;
        const x0 = Math.floor(b.minX / CELL);
        const x1 = Math.floor(b.maxX / CELL);
        const z0 = Math.floor(b.minZ / CELL);
        const z1 = Math.floor(b.maxZ / CELL);
        for (let x = x0; x <= x1; x++) {
            for (let z = z0; z <= z1; z++) {
                const k = `${x},${z}`;
                if (!this.cells.has(k)) this.cells.set(k, []);
                this.cells.get(k).push(i);
            }
        }
    }

    query(px, pz, radius = 90) {
        const x0 = Math.floor((px - radius) / CELL);
        const x1 = Math.floor((px + radius) / CELL);
        const z0 = Math.floor((pz - radius) / CELL);
        const z1 = Math.floor((pz + radius) / CELL);
        const seen = new Set();
        const out = [];
        for (let x = x0; x <= x1; x++) {
            for (let z = z0; z <= z1; z++) {
                const list = this.cells.get(`${x},${z}`);
                if (!list) continue;
                for (const i of list) {
                    if (seen.has(i)) continue;
                    seen.add(i);
                    out.push(this.colliders[i]);
                }
            }
        }
        return out;
    }

    isPark(ix, iz) {
        return iz >= 15 && iz <= 19 && ix >= 3 && ix <= 7;
    }

    isTimes(ix, iz) {
        return iz >= 10 && iz <= 12 && ix >= 4 && ix <= 5;
    }

    lotHeight(ix, iz, rng) {
        if (this.isPark(ix, iz)) return 0;
        if (iz <= 2) return 40 + rng() * 90 + (ix === 4 && iz === 1 ? 0 : 0);
        if (iz <= 6) return 18 + rng() * 36;
        if (iz <= 9) return 28 + rng() * 55;
        if (iz <= 13) return 55 + rng() * 140;
        if (iz <= 19) return 22 + rng() * 40;
        return 18 + rng() * 28;
    }

    buildIsland() {
        const w = this.maxX - this.minX + 80;
        const d = this.maxZ - this.minZ + 80;
        this.groundMat = createGroundShader(this.asphaltMap, PALETTE.fog, this.quality.fogDensity);
        const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 1, 1), this.groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.set((this.minX + this.maxX) * 0.5, 0, (this.minZ + this.maxZ) * 0.5);
        ground.receiveShadow = true;
        this.root.add(ground);
        this.ground = ground;
    }

    buildWater() {
        const mat = new THREE.MeshStandardMaterial({
            map: this.waterMap,
            color: 0x0a1824,
            roughness: 0.18,
            metalness: 0.72,
            emissive: 0x041018,
            emissiveIntensity: 0.35
        });
        const water = new THREE.Mesh(new THREE.PlaneGeometry(2800, 3200, 1, 1), mat);
        water.rotation.x = -Math.PI / 2;
        water.position.y = -0.55;
        water.receiveShadow = true;
        this.root.add(water);
        this.water = water;
    }

    buildGrid() {
        const maxBoxes = GRID.cols * GRID.rows * 3;
        this.buildingMesh = new THREE.InstancedMesh(BOX, this.mats.glass, maxBoxes);
        this.buildingMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.buildingMesh.castShadow = this.quality.shadows;
        this.buildingMesh.receiveShadow = true;
        this.buildingMesh.frustumCulled = false;

        const darkMesh = new THREE.InstancedMesh(BOX, this.mats.stone, Math.floor(maxBoxes * 0.4));
        darkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        darkMesh.castShadow = this.quality.shadows;
        darkMesh.frustumCulled = false;

        let iGlass = 0;
        let iStone = 0;
        const towers = [];
        const rng = mulberry32(20260814);

        for (let iz = 0; iz < GRID.rows; iz++) {
            for (let ix = 0; ix < GRID.cols; ix++) {
                const skip =
                    (ix === 4 && iz === 1) ||
                    (ix === 5 && iz === 11) ||
                    (ix === 7 && iz === 10) ||
                    (ix === 5 && iz === 7);
                const { x, z } = this.cellOf(ix, iz);
                if (this.isPark(ix, iz) || skip) continue;

                const h = this.lotHeight(ix, iz, rng);
                if (h < 8) continue;

                const inset = 1.6 + rng() * 2.2;
                const sx = this.blockW - inset * 2;
                const sz = this.blockD - inset * 2;
                const n = hash(ix * 97 + iz * 13);
                const split = n > 0.55 && h > 40;

                const place = (px, pz, bw, bd, height, stone) => {
                    const base = Math.min(height, 12 + rng() * 18);
                    const mid = height > 50 ? height * (0.35 + rng() * 0.2) : 0;
                    const top = height - base - mid;
                    const layers = [];
                    layers.push({ y: base / 2, h: base, w: bw, d: bd });
                    if (mid > 8) {
                        layers.push({
                            y: base + mid / 2,
                            h: mid,
                            w: bw * 0.82,
                            d: bd * 0.82
                        });
                    }
                    if (top > 10) {
                        layers.push({
                            y: base + mid + top / 2,
                            h: top,
                            w: bw * 0.62,
                            d: bd * 0.62
                        });
                    }
                    for (const L of layers) {
                        const mesh = stone && iStone < darkMesh.count ? darkMesh : this.buildingMesh;
                        const idx = stone && iStone < darkMesh.count ? iStone++ : iGlass++;
                        if (idx >= mesh.count) continue;
                        this.dummy.position.set(px, L.y, pz);
                        this.dummy.scale.set(L.w, L.h, L.d);
                        this.dummy.rotation.set(0, 0, 0);
                        this.dummy.updateMatrix();
                        mesh.setMatrixAt(idx, this.dummy.matrix);
                        this.color.setHSL(0.58 + rng() * 0.08, 0.12, 0.16 + rng() * 0.08);
                        if (mesh.setColorAt) mesh.setColorAt(idx, this.color);
                        this.addCollider(boxCollider(px, L.y, pz, L.w, L.h, L.d));
                    }
                    if (this.quality.props > 0.6 && height > 28 && rng() > 0.72) {
                        towers.push({ x: px, z: pz, y: height + 0.2 });
                    }
                    if (this.isTimes(ix, iz) && this.quality.props > 0.4) {
                        this.addBillboard(px, height * 0.55, pz, bw, bd, rng);
                    }
                };

                if (split) {
                    const gap = 2.4;
                    const hw = (sx - gap) * 0.5;
                    place(x - (hw + gap) * 0.5, z, hw, sz * (0.7 + rng() * 0.25), h * (0.7 + rng() * 0.4), n > 0.75);
                    place(x + (hw + gap) * 0.5, z, hw, sz * (0.65 + rng() * 0.3), h * (0.55 + rng() * 0.5), n < 0.3);
                } else {
                    place(x, z, sx * (0.85 + rng() * 0.12), sz * (0.82 + rng() * 0.14), h, n > 0.68);
                }
            }
        }

        this.buildingMesh.count = iGlass;
        darkMesh.count = iStone;
        this.buildingMesh.instanceMatrix.needsUpdate = true;
        darkMesh.instanceMatrix.needsUpdate = true;
        if (this.buildingMesh.instanceColor) this.buildingMesh.instanceColor.needsUpdate = true;
        this.root.add(this.buildingMesh, darkMesh);

        if (towers.length && this.quality.props > 0.5) {
            const proto = createWaterTower();
            for (const t of towers.slice(0, Math.floor(28 * this.quality.props))) {
                const w = proto.clone();
                w.position.set(t.x + (hash(t.x) - 0.5) * 6, t.y, t.z + (hash(t.z) - 0.5) * 6);
                this.root.add(w);
            }
        }
    }

    addBillboard(x, y, z, bw, bd, rng) {
        const [text, color] = SIGN_WORDS[Math.floor(rng() * SIGN_WORDS.length)];
        const tex = billboardTexture(THREE, text, color);
        const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
        const w = 10 + rng() * 8;
        const h = 5 + rng() * 3;
        const board = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
        const face = rng() > 0.5 ? 1 : -1;
        if (rng() > 0.5) {
            board.position.set(x + face * (bw * 0.5 + 0.2), y, z);
            board.rotation.y = face > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
            board.position.set(x, y, z + face * (bd * 0.5 + 0.2));
            board.rotation.y = face > 0 ? 0 : Math.PI;
        }
        this.root.add(board);
    }

    buildLandmarks() {
        const empire = this.cellOf(5, 11);
        const chrysler = this.cellOf(7, 10);
        const wtc = this.cellOf(4, 1);
        const flat = this.cellOf(5, 7);

        const e = createEmpire(this.mats, empire.x, empire.z);
        const c = createChrysler(this.mats, chrysler.x, chrysler.z);
        const w = createWTC(this.mats, wtc.x, wtc.z);
        const f = createFlatiron(this.mats, flat.x, flat.z);
        const bridge = createBridge(this.mats, this.maxX + 48, this.originZ + GRID.street * 4.2);
        const liberty = createLiberty(this.mats, -40, this.minZ - 90);

        for (const piece of [e, c, w, f, bridge, liberty]) {
            this.root.add(piece.group);
            for (const col of piece.colliders) this.addCollider(col);
        }
        this.empire = e;
        this.beacons = [e.beacon];
        const roof = this.cellOf(6, 11);
        const roofY = this.heightAt(roof.x, roof.z);
        this.spawn = { x: roof.x, y: Math.max(28, roofY) + 1.4, z: roof.z };
    }

    buildPark() {
        const a = this.cellOf(3, 15);
        const b = this.cellOf(7, 19);
        const x = (a.x + b.x) * 0.5;
        const z = (a.z + b.z) * 0.5;
        const w = Math.abs(b.x - a.x) + this.blockW;
        const d = Math.abs(b.z - a.z) + this.blockD;
        const park = new THREE.Mesh(
            new THREE.PlaneGeometry(w, d),
            new THREE.MeshStandardMaterial({
                map: this.grassMap,
                color: 0x1a3320,
                roughness: 0.95,
                emissive: 0x041208,
                emissiveIntensity: 0.2
            })
        );
        park.rotation.x = -Math.PI / 2;
        park.position.set(x, 0.08, z);
        park.receiveShadow = true;
        this.root.add(park);

        const treeCount = Math.floor(48 * this.quality.props);
        const trees = new THREE.InstancedMesh(new THREE.ConeGeometry(2.2, 7, 6), this.mats.tree, treeCount);
        trees.frustumCulled = false;
        const rng = mulberry32(99);
        for (let i = 0; i < treeCount; i++) {
            this.dummy.position.set(
                x + (rng() - 0.5) * w * 0.85,
                3.6,
                z + (rng() - 0.5) * d * 0.85
            );
            const s = 0.7 + rng() * 0.8;
            this.dummy.scale.set(s, 0.8 + rng() * 0.7, s);
            this.dummy.rotation.set(0, rng() * 6, 0);
            this.dummy.updateMatrix();
            trees.setMatrixAt(i, this.dummy.matrix);
        }
        this.root.add(trees);

        const lake = new THREE.Mesh(
            new THREE.CircleGeometry(16, 16),
            new THREE.MeshStandardMaterial({
                color: 0x0a1820,
                roughness: 0.15,
                metalness: 0.7,
                emissive: 0x061018,
                emissiveIntensity: 0.4
            })
        );
        lake.rotation.x = -Math.PI / 2;
        lake.position.set(x - 10, 0.12, z + 8);
        this.root.add(lake);
        this.park = { x, z, w, d };
    }

    buildTraffic() {
        const n = this.quality.traffic;
        this.taxiMesh = new THREE.InstancedMesh(BOX, this.mats.taxi, n);
        this.taxiMesh.frustumCulled = false;
        this.taxiMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.root.add(this.taxiMesh);
        const rng = mulberry32(7);
        for (let i = 0; i < n; i++) {
            const avenue = rng() > 0.45;
            const lane = rng() > 0.5 ? 1 : -1;
            this.traffic.push({
                avenue,
                lane,
                speed: 11 + rng() * 10,
                x: avenue
                    ? this.originX + (Math.floor(rng() * GRID.cols) + 0.5) * GRID.avenue + lane * 4
                    : this.minX + rng() * (this.maxX - this.minX),
                z: avenue
                    ? this.minZ + rng() * (this.maxZ - this.minZ)
                    : this.originZ + (Math.floor(rng() * GRID.rows) + 0.5) * GRID.street + lane * 3.5
            });
        }
    }

    buildPulses() {
        const n = this.quality.pulses;
        const geo = new THREE.SphereGeometry(0.55, 10, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: PALETTE.pulse,
            toneMapped: false
        });
        this.pulseMesh = new THREE.InstancedMesh(geo, mat, n);
        this.pulseMesh.frustumCulled = false;
        this.root.add(this.pulseMesh);
        const glow = new THREE.MeshBasicMaterial({
            color: 0xffe08a,
            transparent: true,
            opacity: 0.28,
            depthWrite: false
        });
        this.pulseGlow = new THREE.InstancedMesh(new THREE.SphereGeometry(1.15, 8, 6), glow, n);
        this.pulseGlow.frustumCulled = false;
        this.root.add(this.pulseGlow);
        this.seedPulses();
    }

    seedPulses() {
        const rng = mulberry32((Math.random() * 9999) | 0);
        this.pulses.length = 0;
        for (let i = 0; i < this.quality.pulses; i++) {
            this.pulses.push(this.randomPulse(rng));
        }
        this.syncPulses();
    }

    randomPulse(rng = Math.random) {
        const r = typeof rng === 'function' ? rng : Math.random;
        const x = this.minX + 30 + r() * (this.maxX - this.minX - 60);
        const z = this.minZ + 30 + r() * (this.maxZ - this.minZ - 60);
        const roof = this.heightAt(x, z);
        const y = Math.max(18, roof + 8 + r() * 36);
        return { x, y, z, live: true, phase: r() * 6 };
    }

    syncPulses() {
        for (let i = 0; i < this.pulses.length; i++) {
            const p = this.pulses[i];
            const vis = p.live ? 1 : 0.001;
            this.dummy.position.set(p.x, p.y, p.z);
            this.dummy.scale.setScalar(vis);
            this.dummy.rotation.set(0, 0, 0);
            this.dummy.updateMatrix();
            this.pulseMesh.setMatrixAt(i, this.dummy.matrix);
            this.dummy.scale.setScalar(vis * 1.6);
            this.dummy.updateMatrix();
            this.pulseGlow.setMatrixAt(i, this.dummy.matrix);
        }
        this.pulseMesh.instanceMatrix.needsUpdate = true;
        this.pulseGlow.instanceMatrix.needsUpdate = true;
    }

    collectPulses(px, py, pz, radius = 2.1) {
        const got = [];
        for (let i = 0; i < this.pulses.length; i++) {
            const p = this.pulses[i];
            if (!p.live) continue;
            const dx = p.x - px;
            const dy = p.y - py;
            const dz = p.z - pz;
            if (dx * dx + dy * dy + dz * dz < radius * radius) {
                p.live = false;
                got.push(p);
                Object.assign(p, this.randomPulse());
                p.live = true;
            }
        }
        if (got.length) this.syncPulses();
        return got;
    }

    heightAt(x, z) {
        if (this.isWater(x, z)) return -8;
        let h = 0;
        const list = this.query(x, z, 8);
        for (const b of list) {
            if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) {
                if (b.maxY > h) h = b.maxY;
            }
        }
        return h;
    }

    isWater(x, z) {
        return x < this.minX - 2 || x > this.maxX + 2 || z < this.minZ - 2 || z > this.maxZ + 2;
    }

    districtName(x, z) {
        const iz = (z - this.originZ) / GRID.street;
        const ix = (x - this.originX) / GRID.avenue;
        if (this.isWater(x, z)) return 'Harbor';
        if (iz >= 15 && iz <= 19 && ix >= 3 && ix <= 7) return 'Central Park';
        if (iz >= 10 && iz <= 12 && ix >= 4 && ix <= 6) return 'Times Square';
        if (iz < 3) return 'Financial';
        if (iz < 7) return 'Downtown';
        if (iz < 10) return 'Chelsea';
        if (iz < 14) return 'Midtown';
        if (iz < 20) return 'Uptown';
        return 'Harlem';
    }

    pickAnchor(ox, oy, oz, dx, dy, dz, maxDist) {
        const len = Math.hypot(dx, dy, dz) || 1;
        dx /= len; dy /= len; dz /= len;
        let bestT = maxDist;
        let best = null;
        const list = this.query(ox + dx * maxDist * 0.45, oz + dz * maxDist * 0.45, maxDist);
        for (const b of list) {
            const t = rayAABB(ox, oy, oz, dx, dy, dz, b, maxDist);
            if (t == null || t < 2.2 || t >= bestT) continue;
            const y = oy + dy * t;
            if (y < 6) continue;
            bestT = t;
            best = b;
        }
        if (best) {
            const px = ox + dx * bestT;
            const py = oy + dy * bestT;
            const pz = oz + dz * bestT;
            const n = aabbNormal(best, px, py, pz);
            return { point: { x: px, y: py, z: pz }, normal: n, dist: bestT, box: best };
        }

        let coneBest = null;
        let coneScore = 1e9;
        for (const b of list) {
            const cx = clamp(ox + dx * 28, b.minX, b.maxX);
            const cy = clamp(oy + dy * 28, b.minY, b.maxY);
            const cz = clamp(oz + dz * 28, b.minZ, b.maxZ);
            const vx = cx - ox;
            const vy = cy - oy;
            const vz = cz - oz;
            const dist = Math.hypot(vx, vy, vz);
            if (dist < 6 || dist > maxDist || cy < oy - 4) continue;
            const dot = (vx * dx + vy * dy + vz * dz) / dist;
            if (dot < 0.62) continue;
            const score = dist * (1.4 - dot);
            if (score < coneScore) {
                coneScore = score;
                coneBest = { x: cx, y: Math.max(cy, oy + 2), z: cz, dist, box: b };
            }
        }
        if (!coneBest) return null;
        const n = aabbNormal(coneBest.box, coneBest.x, coneBest.y, coneBest.z);
        return { point: coneBest, normal: n, dist: coneBest.dist, box: coneBest.box };
    }

    collideSphere(px, py, pz, r) {
        const list = this.query(px, pz, r + 8);
        let hit = null;
        for (const b of list) {
            const s = sphereAABB(px, py, pz, r, b);
            if (s && (!hit || s.depth > hit.depth)) hit = { ...s, box: b };
        }
        return hit;
    }

    update(dt, camPos) {
        this.time += dt;
        if (this.groundMat) this.groundMat.uniforms.uTime.value = this.time;
        this.sky.mesh.position.set(camPos.x * 0.02, camPos.y * 0.02, camPos.z * 0.02);

        if (this.empire?.beacon) {
            const pulse = 0.55 + Math.sin(this.time * 4.2) * 0.45;
            this.empire.beacon.scale.y = 3.2 + pulse;
        }

        for (let i = 0; i < this.traffic.length; i++) {
            const c = this.traffic[i];
            if (c.avenue) {
                c.z += c.speed * c.lane * dt;
                if (c.z > this.maxZ) c.z = this.minZ;
                if (c.z < this.minZ) c.z = this.maxZ;
            } else {
                c.x += c.speed * c.lane * dt;
                if (c.x > this.maxX) c.x = this.minX;
                if (c.x < this.minX) c.x = this.maxX;
            }
            this.dummy.position.set(c.x, 0.55, c.z);
            this.dummy.scale.set(2.1, 0.85, 4.2);
            this.dummy.rotation.set(0, c.avenue ? 0 : Math.PI / 2, 0);
            this.dummy.updateMatrix();
            this.taxiMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.taxiMesh.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < this.pulses.length; i++) {
            const p = this.pulses[i];
            p.phase += dt * 2.2;
            this.dummy.position.set(p.x, p.y + Math.sin(p.phase) * 0.45, p.z);
            this.dummy.scale.setScalar(p.live ? 1 : 0.001);
            this.dummy.rotation.set(0, p.phase, 0);
            this.dummy.updateMatrix();
            this.pulseMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.pulseMesh.instanceMatrix.needsUpdate = true;
    }
}
