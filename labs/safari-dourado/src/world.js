/**
 * Savana: terreno com poço, acácias, kopjes, grama instanciada e poeira.
 */

import * as THREE from 'three';
import { WORLD_RADIUS, WATER } from './config.js';
import { fbm, hash2, seeded, smoothstep } from './utils.js';
import { savannaTexture } from './textures.js';
import {
    buildAcacia, buildBaobab, buildKopje, buildDistantHill,
    grassBladeGeometry, grassMaterial
} from './models.js';
import { createWater } from './water.js?v=3';

/**
 * Altura do solo. O poço é uma bacia suave; o resto são colinas em fBm
 * com dois kopjes mais altos.
 */
export function makeHeightFn() {
    return (x, z) => {
        const r = Math.hypot(x, z);
        const hole = -3.15 * smoothstep(WATER.shore + 8, WATER.radius - 2, r);
        const hills = (fbm(x * 0.011, z * 0.011, 1) - 0.42) * 9.5
            + (fbm(x * 0.032, z * 0.032, 4) - 0.5) * 2.4;
        const kopjeA = Math.exp(-((x - 62) ** 2 + (z + 38) ** 2) / 180) * 6.5;
        const kopjeB = Math.exp(-((x + 78) ** 2 + (z - 28) ** 2) / 220) * 5.8;
        return hole + hills + kopjeA + kopjeB;
    };
}

export class World {
    constructor(scene, skyUniforms, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.colliders = [];
        this.kopjes = [];
        this.heightAt = makeHeightFn();
        this.grassMat = null;
        this.dust = null;

        this.buildTerrain();
        this.water = createWater(skyUniforms, quality);
        this.group.add(this.water);
        this.scatterTrees(quality);
        this.scatterKopjes(quality);
        this.scatterGrass(quality);
        this.addLandmarks();
        this.addDust(quality);
        this.addBirds(quality);
    }

    buildTerrain() {
        const segs = this.quality.terrainSegments;
        const size = WORLD_RADIUS * 2.35;
        const geo = new THREE.PlaneGeometry(size, size, segs, segs);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        const colors = [];
        const gold = new THREE.Color(0xd2b05a);
        const green = new THREE.Color(0x6a8a38);
        const dirt = new THREE.Color(0xa86a38);
        const mud = new THREE.Color(0x7a5a38);
        const c = new THREE.Color();

        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = this.heightAt(x, z);
            pos.setY(i, y);
            const r = Math.hypot(x, z);
            const n = fbm(x * 0.04, z * 0.04, 9);
            if (r < WATER.shore) c.copy(mud).lerp(dirt, n);
            else if (n > 0.62) c.copy(green);
            else c.copy(gold).lerp(dirt, n * 0.45);
            c.offsetHSL(0, 0, (hash2(x, z, 2) - 0.5) * 0.06);
            colors.push(c.r, c.g, c.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            map: savannaTexture(),
            vertexColors: true,
            roughness: 0.94,
            metalness: 0.0
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.terrain = mesh;
    }

    scatterTrees(quality) {
        const rng = seeded(0x5afA);
        const n = quality.trees;
        for (let i = 0; i < n; i++) {
            const a = rng() * Math.PI * 2;
            const r = WATER.shore + 12 + rng() * (WORLD_RADIUS - WATER.shore - 22);
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            if (Math.hypot(x - 62, z + 38) < 14 || Math.hypot(x + 78, z - 28) < 14) continue;
            const tree = buildAcacia(rng);
            const s = 0.75 + rng() * 0.7;
            tree.scale.setScalar(s);
            tree.position.set(x, this.heightAt(x, z), z);
            tree.rotation.y = rng() * Math.PI * 2;
            this.group.add(tree);
            this.colliders.push({ x, z, r: 0.7 * s });
        }

        const baobabs = [
            [118, -72],
            [-132, 54],
            [36, 148]
        ];
        baobabs.forEach(([x, z], i) => {
            if (quality.id === 'low' && i > 0) return;
            const b = buildBaobab();
            b.scale.setScalar(1.1 + i * 0.12);
            b.position.set(x, this.heightAt(x, z), z);
            b.rotation.y = i * 1.2;
            this.group.add(b);
            this.colliders.push({ x, z, r: 3.2 });
        });
    }

    scatterKopjes(quality) {
        const spots = [
            { x: 62, z: -38 },
            { x: -78, z: 28 },
            { x: 24, z: 92 }
        ];
        const rng = seeded(0xabc);
        spots.forEach((s, i) => {
            if (quality.id === 'low' && i === 2) return;
            const k = buildKopje(rng);
            k.position.set(s.x, this.heightAt(s.x, s.z), s.z);
            this.group.add(k);
            this.kopjes.push(s);
            this.colliders.push({ x: s.x, z: s.z, r: 4.5 });
        });
    }

    scatterGrass(quality) {
        const count = quality.grass;
        const geo = grassBladeGeometry();
        this.grassMat = grassMaterial();
        const mesh = new THREE.InstancedMesh(geo, this.grassMat, count);
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        const dummy = new THREE.Object3D();
        const rng = seeded(0x77a1);
        let placed = 0;
        for (let i = 0; i < count * 3 && placed < count; i++) {
            const a = rng() * Math.PI * 2;
            const r = WATER.shore + 2 + rng() * (WORLD_RADIUS * 0.72);
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            dummy.position.set(x, this.heightAt(x, z), z);
            dummy.rotation.y = rng() * Math.PI;
            dummy.scale.setScalar(0.7 + rng() * 1.1);
            dummy.updateMatrix();
            mesh.setMatrixAt(placed, dummy.matrix);
            placed++;
        }
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        this.group.add(mesh);
        this.grass = mesh;
    }

    addLandmarks() {
        const hill = buildDistantHill();
        hill.position.set(-40, 4, -WORLD_RADIUS - 40);
        hill.scale.setScalar(1.6);
        this.group.add(hill);

        const hill2 = buildDistantHill();
        hill2.position.set(160, 2, -WORLD_RADIUS - 10);
        hill2.scale.setScalar(0.9);
        hill2.rotation.y = 0.6;
        this.group.add(hill2);
    }

    addBirds(quality) {
        this.birds = [];
        const n = quality.birds;
        const geo = new THREE.ConeGeometry(0.12, 0.55, 4);
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
            const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.12), mat);
            wing.rotation.x = Math.PI / 2;
            g.add(wing);
            g.userData = {
                radius: 18 + hash2(i, 2, 8) * 28,
                height: 16 + hash2(i, 4, 8) * 10,
                speed: 0.18 + hash2(i, 6, 8) * 0.22,
                phase: hash2(i, 1, 8) * Math.PI * 2,
                cx: (hash2(i, 9, 3) - 0.5) * 80,
                cz: (hash2(i, 11, 3) - 0.5) * 80
            };
            this.group.add(g);
            this.birds.push(g);
        }
    }

    addDust(quality) {
        const n = quality.id === 'low' ? 80 : 220;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            pos[i * 3] = (hash2(i, 1, 2) - 0.5) * 40;
            pos[i * 3 + 1] = hash2(i, 3, 2) * 4;
            pos[i * 3 + 2] = (hash2(i, 5, 2) - 0.5) * 40;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xe8c890,
            size: 0.28,
            transparent: true,
            opacity: 0.35,
            depthWrite: false,
            sizeAttenuation: true
        });
        this.dust = new THREE.Points(geo, mat);
        this.group.add(this.dust);
    }

    collide(x, z, radius) {
        let ox = x;
        let oz = z;
        for (const c of this.colliders) {
            const dx = ox - c.x;
            const dz = oz - c.z;
            const min = radius + c.r;
            const d = Math.hypot(dx, dz);
            if (d < min && d > 1e-4) {
                const s = min / d;
                ox = c.x + dx * s;
                oz = c.z + dz * s;
            }
        }
        const r = Math.hypot(ox, oz);
        const lim = WORLD_RADIUS - 4;
        if (r > lim) {
            ox *= lim / r;
            oz *= lim / r;
        }
        const wr = Math.hypot(ox, oz);
        if (wr < WATER.radius - 1.5) {
            const s = (WATER.radius - 1.5) / Math.max(wr, 0.01);
            ox *= s;
            oz *= s;
        }
        return { x: ox, z: oz };
    }

    update(dt, time, jeep) {
        if (this.grassMat?.userData.uTime) this.grassMat.userData.uTime.value = time;
        if (this.water?.material.uniforms.uTime) this.water.material.uniforms.uTime.value = time;
        if (this.dust) {
            this.dust.position.set(jeep.x, jeep.y + 1.2, jeep.z);
            this.dust.rotation.y = time * 0.08;
            this.dust.material.opacity = 0.18 + Math.min(0.35, Math.abs(jeep.speed) * 0.02);
        }
        for (const b of this.birds || []) {
            const u = b.userData;
            const a = time * u.speed + u.phase;
            b.position.set(
                u.cx + Math.cos(a) * u.radius,
                u.height,
                u.cz + Math.sin(a) * u.radius
            );
            b.rotation.y = -a + Math.PI / 2;
            b.children[1].rotation.z = Math.sin(time * 8 + u.phase) * 0.35;
        }
    }
}
