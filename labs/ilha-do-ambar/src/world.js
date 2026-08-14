/**
 * Selva procedural, trilha, lago, cercas e vegetação instanciada.
 */

import * as THREE from 'three';
import { WORLD } from './config.js';
import { fbm, hash2, seeded, smoothstep } from './utils.js';
import {
    grassTexture, dirtTexture, barkTexture, leafTexture, palmLeafTexture,
    rockTexture, mistTexture
} from './textures.js';
import { makeWaterMaterial } from './shaders.js';

const dummy = new THREE.Object3D();

export class World {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.colliders = [];
        this.islandRadius = WORLD.islandRadius;
        this.waterMat = null;
        this.roadPoints = [];
        this.sparks = [];
        this.mist = [];
        this.rain = null;
        this.rainCount = 0;

        this._terrain();
        this._road();
        this._water();
        this._fences();
        this._station();
        this._vegetation();
        this._rocks();
        this._mist();
        if (quality.particles > 0.4) this._rain();
    }

    /**
     * Altura do solo. A ilha cai para o mar; o lago é uma bacia suave
     * em (−14, −6). Colinas usam FBM em duas escalas.
     */
    heightAt = (x, z) => {
        const r = Math.hypot(x, z);
        const island = smoothstep(this.islandRadius + 8, this.islandRadius - 18, r);
        const hills = fbm(x * 0.016, z * 0.016, 2) * 7.5;
        const ridge = fbm(x * 0.007, z * 0.007, 8) * 11;
        const lakeD = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
        const basin = -smoothstep(WORLD.lake.r + 8, 6, lakeD) * 2.6;
        const coast = -smoothstep(this.islandRadius - 6, this.islandRadius + 14, r) * 6;
        return Math.max(-1.6, (hills + ridge + basin) * island + coast);
    };

    onRoad(x, z) {
        let best = 99;
        for (const p of this.roadPoints) {
            const d = Math.hypot(x - p.x, z - p.z);
            if (d < best) best = d;
        }
        return best < 3.4;
    }

    collide(x, z, radius) {
        let hx = x;
        let hz = z;
        let hit = false;
        for (const c of this.colliders) {
            const dx = hx - c.x;
            const dz = hz - c.z;
            const d = Math.hypot(dx, dz);
            const min = radius + c.r;
            if (d < min && d > 1e-4) {
                const s = min / d;
                hx = c.x + dx * s;
                hz = c.z + dz * s;
                hit = true;
            }
        }
        return { x: hx, z: hz, hit };
    }

    addCollider(x, z, r) {
        this.colliders.push({ x, z, r });
    }

    _terrain() {
        const segs = this.quality.id === 'low' ? 72 : this.quality.id === 'high' ? 140 : 100;
        const size = this.islandRadius * 2.4;
        const geo = new THREE.PlaneGeometry(size, size, segs, segs);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        const colors = [];
        const cGrass = new THREE.Color(0x4a7a32);
        const cDirt = new THREE.Color(0x6a4a2c);
        const cSand = new THREE.Color(0xc2b07a);
        const cRock = new THREE.Color(0x6a665c);
        const tmp = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = this.heightAt(x, z);
            pos.setY(i, y);
            const r = Math.hypot(x, z);
            const lakeD = Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z);
            tmp.copy(cGrass);
            if (y < 0.55) tmp.lerp(cSand, 0.8);
            else if (lakeD < WORLD.lake.r + 6) tmp.lerp(cDirt, 0.35);
            if (y > 9) tmp.lerp(cRock, smoothstep(9, 14, y));
            if (r > this.islandRadius - 10) tmp.lerp(cSand, 0.55);
            colors.push(tmp.r, tmp.g, tmp.b);
        }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
            map: grassTexture(),
            vertexColors: true,
            roughness: 0.92,
            metalness: 0.02
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.receiveShadow = true;
        this.group.add(mesh);

        const ocean = new THREE.Mesh(
            new THREE.CircleGeometry(WORLD.oceanRadius, 48),
            new THREE.MeshStandardMaterial({
                color: 0x0a3a48, roughness: 0.28, metalness: 0.22, transparent: true, opacity: 0.92
            })
        );
        ocean.rotation.x = -Math.PI / 2;
        ocean.position.y = -0.35;
        this.group.add(ocean);
    }

    _road() {
        const waypoints = [
            [4, 78], [18, 62], [32, 42], [40, 22], [36, 2],
            [22, -22], [8, -42], [-10, -58], [-28, -52], [-42, -36],
            [-50, -12], [-48, 16], [-38, 42], [-18, 58], [-2, 72], [4, 78]
        ];
        const pts = waypoints.map(([x, z]) => new THREE.Vector3(x, 0, z));
        const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.35);
        const samples = 180;
        this.roadPoints = [];
        const w = 3.1;
        const positions = [];
        const uvs = [];
        const indices = [];
        const nrm = new THREE.Vector3();
        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const p = curve.getPointAt(t);
            const tan = curve.getTangentAt(t);
            nrm.set(-tan.z, 0, tan.x).normalize();
            p.y = this.heightAt(p.x, p.z) + 0.06;
            this.roadPoints.push({ x: p.x, z: p.z });
            const a = p.clone().addScaledVector(nrm, w);
            const b = p.clone().addScaledVector(nrm, -w);
            a.y = this.heightAt(a.x, a.z) + 0.07;
            b.y = this.heightAt(b.x, b.z) + 0.07;
            positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
            uvs.push(0, t * 40, 1, t * 40);
        }
        for (let i = 0; i < samples; i++) {
            const a = i * 2;
            indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
            map: dirtTexture(), roughness: 0.92, metalness: 0.02
        }));
        mesh.receiveShadow = true;
        this.group.add(mesh);
    }

    _water() {
        this.waterMat = makeWaterMaterial();
        const lake = new THREE.Mesh(new THREE.CircleGeometry(WORLD.lake.r * 0.92, 40), this.waterMat);
        lake.rotation.x = -Math.PI / 2;
        lake.position.set(WORLD.lake.x, 1.15, WORLD.lake.z);
        this.group.add(lake);
        this.lake = lake;
    }

    _post(x, z, h, mat) {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, h, 6), mat);
        m.position.set(x, this.heightAt(x, z) + h * 0.5, z);
        m.castShadow = true;
        this.group.add(m);
        return m;
    }

    _fences() {
        const steel = new THREE.MeshStandardMaterial({ color: 0x2a3036, roughness: 0.4, metalness: 0.7 });
        const warn = new THREE.MeshStandardMaterial({ color: 0xc4a018, roughness: 0.45, metalness: 0.3 });
        const paddock = { cx: 42, cz: 14, rx: 22, rz: 18 };
        const posts = 36;
        for (let i = 0; i < posts; i++) {
            const a = (i / posts) * Math.PI * 2;
            const x = paddock.cx + Math.cos(a) * paddock.rx;
            const z = paddock.cz + Math.sin(a) * paddock.rz;
            if (i >= 30 && i <= 33) continue;
            this._post(x, z, 3.2, steel);
            this.addCollider(x, z, 0.25);
        }
        const broken = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 0.12), steel);
        broken.position.set(paddock.cx - paddock.rx + 1, this.heightAt(paddock.cx - paddock.rx, paddock.cz) + 1.4, paddock.cz);
        broken.rotation.z = 1.1;
        this.group.add(broken);

        for (let i = 0; i < 8; i++) {
            const spark = new THREE.PointLight(0x88ddff, 0, 6, 2);
            const a = (30.5 / posts) * Math.PI * 2;
            spark.position.set(
                paddock.cx + Math.cos(a) * paddock.rx,
                this.heightAt(paddock.cx, paddock.cz) + 1.6 + i * 0.1,
                paddock.cz + Math.sin(a) * paddock.rz
            );
            spark.userData.phase = i * 0.7;
            this.group.add(spark);
            this.sparks.push(spark);
        }

        const sign = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 0.08), warn);
        sign.position.set(28, this.heightAt(28, 28) + 2.1, 28);
        this.group.add(sign);
        this._post(27.2, 28, 2.2, steel);
        this._post(28.8, 28, 2.2, steel);
    }

    _station() {
        const concrete = new THREE.MeshStandardMaterial({ color: 0x8a8678, roughness: 0.8, map: rockTexture() });
        const rust = new THREE.MeshStandardMaterial({ color: 0x6a4030, roughness: 0.7, metalness: 0.3 });
        const x = 2;
        const z = 88;
        const y = this.heightAt(x, z);
        const hall = new THREE.Mesh(new THREE.BoxGeometry(10, 4.2, 6.5), concrete);
        hall.position.set(x, y + 2.1, z);
        hall.castShadow = true;
        hall.receiveShadow = true;
        this.group.add(hall);
        this.addCollider(x, z, 4.2);
        const roof = new THREE.Mesh(new THREE.BoxGeometry(11.2, 0.25, 7.4), rust);
        roof.position.set(x, y + 4.3, z);
        this.group.add(roof);
        const gateL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 3.4, 0.25), rust);
        gateL.position.set(-4, y + 1.7, 80);
        this.group.add(gateL);
        const gateR = gateL.clone();
        gateR.position.x = 12;
        this.group.add(gateR);
        const arch = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.3, 0.3), rust);
        arch.position.set(4, y + 3.5, 80);
        this.group.add(arch);
        const amber = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 10), new THREE.MeshStandardMaterial({
            color: 0xe09020, emissive: 0xc46a10, emissiveIntensity: 0.55, roughness: 0.3, metalness: 0.1
        }));
        amber.position.set(4, y + 5.1, 88);
        this.group.add(amber);
        this.amber = amber;
    }

    _makePalm() {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.22, 5.4, 7),
            new THREE.MeshStandardMaterial({ map: barkTexture(), color: 0xc4a070, roughness: 0.9 })
        );
        trunk.position.y = 2.7;
        trunk.rotation.z = 0.08;
        g.add(trunk);
        const leafTex = palmLeafTexture();
        const leafMat = new THREE.MeshStandardMaterial({
            map: leafTex, transparent: true, alphaTest: 0.2,
            side: THREE.DoubleSide, roughness: 0.85
        });
        for (let i = 0; i < 7; i++) {
            const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 3.2), leafMat);
            leaf.position.set(0, 5.3, 0);
            leaf.rotation.set(0.85, (i / 7) * Math.PI * 2, 0);
            g.add(leaf);
        }
        g.traverse((c) => { if (c.isMesh) { c.castShadow = true; } });
        return g;
    }

    _makeCanopy() {
        const g = new THREE.Group();
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.22, 0.38, 6.5, 7),
            new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.92 })
        );
        trunk.position.y = 3.25;
        g.add(trunk);
        const foliage = new THREE.MeshStandardMaterial({
            map: leafTexture(), color: 0x3a7a28, roughness: 0.88, transparent: true, alphaTest: 0.35
        });
        for (let i = 0; i < 4; i++) {
            const s = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6 + i * 0.15, 1), foliage);
            s.position.set((i - 1.5) * 0.45, 6.2 + (i % 2) * 0.4, ((i % 3) - 1) * 0.4);
            s.scale.set(1.1, 0.75, 1.1);
            g.add(s);
        }
        g.traverse((c) => { if (c.isMesh) c.castShadow = true; });
        return g;
    }

    _vegetation() {
        const rng = seeded(9041);
        const palms = Math.round(42 * this.quality.trees);
        const trees = Math.round(70 * this.quality.trees);
        const palmProto = this._makePalm();
        const treeProto = this._makeCanopy();

        const scatter = (proto, count, minR, maxR, avoidLake = true) => {
            for (let i = 0; i < count; i++) {
                const a = rng() * Math.PI * 2;
                const r = minR + rng() * (maxR - minR);
                const x = Math.cos(a) * r;
                const z = Math.sin(a) * r;
                if (this.onRoad(x, z)) continue;
                if (avoidLake && Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z) < WORLD.lake.r + 6) continue;
                if (Math.hypot(x - 42, z - 14) < 18) continue;
                if (Math.hypot(x, z - 88) < 12) continue;
                const clone = proto.clone();
                const s = 0.75 + rng() * 0.7;
                clone.scale.setScalar(s);
                clone.position.set(x, this.heightAt(x, z), z);
                clone.rotation.y = rng() * Math.PI * 2;
                this.group.add(clone);
                this.addCollider(x, z, 0.55 * s);
            }
        };
        scatter(palmProto, palms, 28, this.islandRadius - 8);
        scatter(treeProto, trees, 22, this.islandRadius - 6);

        const grassCount = Math.round(900 * this.quality.grass);
        if (grassCount > 0) {
            const blade = new THREE.PlaneGeometry(0.18, 0.7);
            blade.translate(0, 0.35, 0);
            const gmat = new THREE.MeshStandardMaterial({
                color: 0x4a8a32, side: THREE.DoubleSide, roughness: 0.95
            });
            const mesh = new THREE.InstancedMesh(blade, gmat, grassCount);
            mesh.frustumCulled = false;
            for (let i = 0; i < grassCount; i++) {
                const a = hash2(i, 1) * Math.PI * 2;
                const r = 8 + hash2(i, 2) * (this.islandRadius - 16);
                const x = Math.cos(a) * r;
                const z = Math.sin(a) * r;
                dummy.position.set(x, this.heightAt(x, z), z);
                dummy.rotation.y = hash2(i, 3) * Math.PI * 2;
                dummy.scale.setScalar(0.6 + hash2(i, 4) * 1.1);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
            this.group.add(mesh);
            this.grass = mesh;
        }
    }

    _rocks() {
        const mat = new THREE.MeshStandardMaterial({ map: rockTexture(), roughness: 0.9, color: 0x8a8680 });
        const rng = seeded(2201);
        for (let i = 0; i < 28; i++) {
            const a = rng() * Math.PI * 2;
            const r = 30 + rng() * 70;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            if (this.onRoad(x, z)) continue;
            const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7 + rng() * 1.4, 0), mat);
            rock.position.set(x, this.heightAt(x, z) + 0.3, z);
            rock.rotation.set(rng() * 2, rng() * 6, rng());
            rock.scale.set(1 + rng(), 0.55 + rng() * 0.5, 1 + rng());
            rock.castShadow = true;
            rock.receiveShadow = true;
            this.group.add(rock);
            this.addCollider(x, z, 0.9);
        }
    }

    _mist() {
        const tex = mistTexture();
        const mat = new THREE.MeshBasicMaterial({
            map: tex, transparent: true, depthWrite: false, opacity: 0.55, side: THREE.DoubleSide
        });
        for (let i = 0; i < 8; i++) {
            const p = new THREE.Mesh(new THREE.PlaneGeometry(18, 6), mat.clone());
            const a = (i / 8) * Math.PI * 2;
            p.position.set(
                WORLD.lake.x + Math.cos(a) * 10,
                2.2,
                WORLD.lake.z + Math.sin(a) * 8
            );
            this.group.add(p);
            this.mist.push(p);
        }
    }

    _rain() {
        const count = Math.round(1400 * this.quality.particles);
        this.rainCount = count;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (hash2(i, 1) - 0.5) * 80;
            pos[i * 3 + 1] = hash2(i, 2) * 28;
            pos[i * 3 + 2] = (hash2(i, 3) - 0.5) * 80;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const mat = new THREE.PointsMaterial({
            color: 0xb8c8d0, size: 0.08, transparent: true, opacity: 0, depthWrite: false
        });
        this.rain = new THREE.Points(geo, mat);
        this.group.add(this.rain);
    }

    update(dt, time, jeep, raining) {
        if (this.waterMat) this.waterMat.uniforms.uTime.value = time;
        if (this.amber) this.amber.rotation.y = time * 0.4;
        for (const s of this.sparks) {
            s.intensity = (0.4 + Math.abs(Math.sin(time * 11 + (s.userData.phase || 0))) * 2.2) * 1.4;
        }
        for (let i = 0; i < this.mist.length; i++) {
            const m = this.mist[i];
            m.position.y = 1.8 + Math.sin(time * 0.35 + i) * 0.35;
            m.material.opacity = 0.28 + Math.sin(time * 0.4 + i) * 0.12;
            m.lookAt(jeep.x, m.position.y, jeep.z);
        }
        if (this.grass) {
            this.grass.rotation.y = Math.sin(time * 0.35) * 0.01;
        }
        if (this.rain) {
            this.rain.material.opacity = raining ? 0.55 : 0;
            this.rain.position.set(jeep.x, 0, jeep.z);
            if (raining) {
                const pos = this.rain.geometry.attributes.position;
                for (let i = 0; i < this.rainCount; i++) {
                    let y = pos.getY(i) - dt * 22;
                    if (y < 0) y = 26;
                    pos.setY(i, y);
                }
                pos.needsUpdate = true;
            }
        }
    }
}
