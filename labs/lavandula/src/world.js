/**
 * Campos de lavanda: terreno em fBm, fileiras, estrada, ciprestes, olival e a casa.
 *
 * Altura:
 *   h(x,z) = 1.8 * (fBm(x·0.009, z·0.009) - 0.42)
 *          + 0.55 * (fBm(x·0.028, z·0.028) - 0.5)
 *          + 4.2  * exp(-((x)² + (z+88)²) / 420)   // cume da casa
 *
 * Estrada: |x - 3.2·sin(z·0.045)| < pathHalf  → terra, sem lavanda.
 */

import * as THREE from 'three';
import { WORLD, MEMORIES } from './config.js';
import { fbm, hash2, seeded, smoothstep } from './utils.js';
import { soilTexture, dirtTexture } from './textures.js';
import {
    lavenderGeometry, lavenderMaterial, wheatMaterial,
    buildCypress, buildOlive, buildFarmhouse, buildBench, buildWell, buildDistantHill
} from './models.js';

export function pathOffset(z) {
    return Math.sin(z * 0.045) * 3.2 + Math.sin(z * 0.017) * 1.4;
}

export function onPath(x, z, extra = 0) {
    return Math.abs(x - pathOffset(z)) < WORLD.pathHalf + extra;
}

export function makeHeightFn() {
    return (x, z) => {
        const hills = (fbm(x * 0.009, z * 0.009, 2) - 0.42) * 1.8
            + (fbm(x * 0.028, z * 0.028, 7) - 0.5) * 0.55;
        const rise = Math.exp(-(x * x + (z + 88) * (z + 88)) / 420) * 4.2;
        const ridge = Math.exp(-((x - 62) ** 2 + (z + 20) ** 2) / 900) * 2.4;
        const pathDip = onPath(x, z, 0.4) ? -0.08 : 0;
        return hills + rise + ridge + pathDip;
    };
}

export class World {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.colliders = [];
        this.heightAt = makeHeightFn();
        this.bounds = {
            minX: -WORLD.radius + 8,
            maxX: WORLD.radius - 8,
            minZ: -WORLD.radius + 6,
            maxZ: WORLD.radius - 6
        };
        this.windMats = [];
        this.birds = [];
        this.pollen = null;

        this.buildTerrain();
        this.scatterLavender();
        this.scatterWheat();
        this.scatterCypress();
        this.scatterOlives();
        this.addLandmarks();
        this.addHorizon();
        this.addBirds();
        this.addPollen();
    }

    buildTerrain() {
        const segs = this.quality.terrainSegments;
        const size = WORLD.radius * 2.2;
        const geo = new THREE.PlaneGeometry(size, size, segs, segs);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        const colors = [];
        const soil = new THREE.Color(0x8a6240);
        const moss = new THREE.Color(0x6a7a40);
        const lavenderTint = new THREE.Color(0x8a5a88);
        const dirt = new THREE.Color(0xc49a68);
        const c = new THREE.Color();

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = this.heightAt(x, z);
            pos.setY(i, y);
            const n = fbm(x * 0.04, z * 0.04, 11);
            if (onPath(x, z, 0.15)) {
                c.copy(dirt).lerp(soil, n * 0.25);
            } else if (Math.abs(x) > 58) {
                c.copy(moss).lerp(new THREE.Color(0xd4b060), n);
            } else {
                c.copy(soil).lerp(lavenderTint, 0.42 + n * 0.28);
            }
            c.offsetHSL(0, 0, (hash2(x, z, 3) - 0.5) * 0.05);
            colors.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            map: soilTexture(),
            vertexColors: true,
            roughness: 0.95,
            metalness: 0
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.terrain = mesh;

        const pathGeo = new THREE.PlaneGeometry(WORLD.pathHalf * 2.05, WORLD.radius * 1.7, 8, 48);
        pathGeo.rotateX(-Math.PI / 2);
        const pp = pathGeo.attributes.position;
        for (let i = 0; i < pp.count; i++) {
            const z = pp.getZ(i) - 12;
            const x = pathOffset(z) + pp.getX(i);
            pp.setX(i, x);
            pp.setZ(i, z);
            pp.setY(i, this.heightAt(x, z) + 0.04);
        }
        pathGeo.computeVertexNormals();
        const pathMat = new THREE.MeshStandardMaterial({
            map: dirtTexture(),
            color: 0xe0b878,
            roughness: 0.9
        });
        const path = new THREE.Mesh(pathGeo, pathMat);
        path.receiveShadow = true;
        this.group.add(path);
    }

    _nearLandmark(x, z, extra = 4) {
        for (const m of MEMORIES) {
            const dx = x - m.x;
            const dz = z - m.z;
            if (dx * dx + dz * dz < (m.r + extra) * (m.r + extra)) return true;
        }
        if (Math.hypot(x, z + 86) < 12) return true;
        return false;
    }

    scatterLavender() {
        const count = this.quality.lavender;
        const geo = lavenderGeometry();
        const mat = lavenderMaterial();
        this.windMats.push(mat);
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        mesh.frustumCulled = false;
        const dummy = new THREE.Object3D();
        const rng = seeded(0xc0ffee);
        const rowStep = WORLD.rowGap * (this.quality.rowSkip || 1);
        const plantStep = WORLD.plantGap * (this.quality.plantSkip || 1);
        let placed = 0;
        for (let row = -72; row <= 72 && placed < count; row += rowStep) {
            if (Math.abs(row) < WORLD.pathHalf + 1.15) continue;
            for (let z = -74; z < 62 && placed < count; z += plantStep) {
                const x = row + (rng() - 0.5) * 0.28;
                const zz = z + (rng() - 0.5) * 0.22;
                if (onPath(x, zz, 0.55)) continue;
                if (this._nearLandmark(x, zz, 3.2)) continue;
                dummy.position.set(x, this.heightAt(x, zz), zz);
                dummy.rotation.y = rng() * 0.5;
                const s = 0.95 + rng() * 0.38;
                dummy.scale.set(s, s * (0.95 + rng() * 0.2), s);
                dummy.updateMatrix();
                mesh.setMatrixAt(placed, dummy.matrix);
                placed++;
            }
        }
        mesh.count = placed;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.lavender = mesh;
    }

    scatterWheat() {
        const count = this.quality.wheat;
        const geo = lavenderGeometry();
        const mat = wheatMaterial();
        this.windMats.push(mat);
        const mesh = new THREE.InstancedMesh(geo, mat, count);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        const dummy = new THREE.Object3D();
        const rng = seeded(0xa11e);
        let placed = 0;
        for (let i = 0; i < count * 3 && placed < count; i++) {
            const side = rng() > 0.5 ? 1 : -1;
            const x = side * (58 + rng() * 28);
            const z = -80 + rng() * 150;
            if (onPath(x, z, 1)) continue;
            dummy.position.set(x, this.heightAt(x, z), z);
            dummy.rotation.y = rng() * Math.PI;
            dummy.scale.setScalar(0.9 + rng() * 0.5);
            dummy.updateMatrix();
            mesh.setMatrixAt(placed, dummy.matrix);
            placed++;
        }
        mesh.count = placed;
        mesh.instanceMatrix.needsUpdate = true;
        this.group.add(mesh);
    }

    scatterCypress() {
        const rng = seeded(0xceda);
        const n = Math.round(18 * this.quality.trees);
        for (let i = 0; i < n; i++) {
            const z = 62 - i * (118 / Math.max(1, n - 1));
            const side = i % 2 === 0 ? -1 : 1;
            const x = pathOffset(z) + side * (WORLD.pathHalf + 1.8 + rng() * 0.6);
            const tree = buildCypress(rng);
            const s = 0.85 + rng() * 0.35;
            tree.scale.setScalar(s);
            tree.position.set(x, this.heightAt(x, z), z);
            tree.rotation.y = rng() * 0.4;
            this.group.add(tree);
            this.colliders.push({ x, z, r: 0.55 * s });
        }
    }

    scatterOlives() {
        const rng = seeded(0x0117e);
        const n = Math.round(9 * this.quality.trees);
        for (let i = 0; i < n; i++) {
            const a = rng() * Math.PI * 2;
            const r = 4 + rng() * 10;
            const x = 24 + Math.cos(a) * r;
            const z = -48 + Math.sin(a) * r;
            const tree = buildOlive(rng);
            const s = 0.9 + rng() * 0.4;
            tree.scale.setScalar(s);
            tree.position.set(x, this.heightAt(x, z), z);
            tree.rotation.y = rng() * Math.PI;
            this.group.add(tree);
            this.colliders.push({ x, z, r: 0.8 * s });
        }
    }

    addLandmarks() {
        const house = buildFarmhouse();
        const hx = 0;
        const hz = -88;
        house.position.set(hx, this.heightAt(hx, hz), hz);
        this.group.add(house);
        this.colliders.push({ x: hx, z: hz, r: 5.4 });
        this.colliders.push({ x: hx + 5.2, z: hz, r: 2.6 });

        const bench = buildBench();
        const bx = -7.2;
        const bz = -16;
        bench.position.set(bx, this.heightAt(bx, bz), bz);
        bench.rotation.y = 0.4;
        this.group.add(bench);

        const well = buildWell();
        const wx = 8.5;
        const wz = -78;
        well.position.set(wx, this.heightAt(wx, wz), wz);
        this.group.add(well);
        this.colliders.push({ x: wx, z: wz, r: 1.1 });
    }

    addHorizon() {
        const spots = [
            [-90, -8, -160, 2.2],
            [40, -2, -175, 1.7],
            [130, 2, -140, 2.6],
            [-150, 0, -90, 1.9],
            [160, 4, 40, 2.1]
        ];
        spots.forEach(([x, y, z, s], i) => {
            const hill = buildDistantHill();
            hill.position.set(x, y, z);
            hill.scale.setScalar(s);
            hill.rotation.y = i * 0.7;
            this.group.add(hill);
        });
    }

    addBirds() {
        const n = this.quality.birds;
        const geo = new THREE.ConeGeometry(0.1, 0.48, 4);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x2a2218,
            roughness: 0.7,
            flatShading: true
        });
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(geo, mat);
            m.rotation.x = Math.PI;
            const g = new THREE.Group();
            g.add(m);
            const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.1), mat);
            wing.rotation.x = Math.PI / 2;
            g.add(wing);
            g.userData = {
                radius: 14 + hash2(i, 2, 8) * 22,
                height: 9 + hash2(i, 4, 8) * 8,
                speed: 0.12 + hash2(i, 6, 8) * 0.16,
                phase: hash2(i, 1, 8) * Math.PI * 2,
                cx: (hash2(i, 9, 3) - 0.5) * 40,
                cz: (hash2(i, 11, 3) - 0.5) * 50 - 20
            };
            this.group.add(g);
            this.birds.push(g);
        }
    }

    addPollen() {
        const n = this.quality.particles;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(n * 3);
        const rng = seeded(0xb33);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (rng() - 0.5) * 90;
            pos[i * 3 + 1] = 0.6 + rng() * 4.5;
            pos[i * 3 + 2] = (rng() - 0.5) * 120;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xe8c8f0,
            size: 0.12,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            sizeAttenuation: true
        });
        this.pollen = new THREE.Points(geo, mat);
        this.group.add(this.pollen);
    }

    nearestMemory(x, z) {
        let best = null;
        let bestD = Infinity;
        for (const m of MEMORIES) {
            const d = Math.hypot(x - m.x, z - m.z);
            if (d < m.r && d < bestD) {
                best = m;
                bestD = d;
            }
        }
        return best;
    }

    collide(x, z, radius) {
        let nx = x;
        let nz = z;
        for (const c of this.colliders) {
            const dx = nx - c.x;
            const dz = nz - c.z;
            const min = radius + c.r;
            const d2 = dx * dx + dz * dz;
            if (d2 < min * min && d2 > 1e-6) {
                const d = Math.sqrt(d2);
                const k = min / d;
                nx = c.x + dx * k;
                nz = c.z + dz * k;
            }
        }
        return { x: nx, z: nz };
    }

    /**
     * Vento: uTime avança; pássaros em órbita; pólen sobe em seno.
     */
    update(time) {
        for (const m of this.windMats) {
            if (m.userData.uTime) m.userData.uTime.value = time;
        }
        for (const b of this.birds) {
            const u = b.userData;
            const a = time * u.speed + u.phase;
            b.position.set(
                u.cx + Math.cos(a) * u.radius,
                u.height + Math.sin(a * 2.2) * 0.6,
                u.cz + Math.sin(a) * u.radius
            );
            b.rotation.y = -a + Math.PI / 2;
            b.children[1].rotation.z = Math.sin(time * 8 + u.phase) * 0.45;
        }
        if (this.pollen) {
            const arr = this.pollen.geometry.attributes.position.array;
            for (let i = 0; i < arr.length; i += 3) {
                arr[i] += Math.sin(time * 0.35 + i) * 0.008;
                arr[i + 1] = 0.5 + ((arr[i + 1] + 0.012) % 4.2);
                arr[i + 2] += Math.cos(time * 0.28 + i) * 0.006;
            }
            this.pollen.geometry.attributes.position.needsUpdate = true;
        }
    }
}
