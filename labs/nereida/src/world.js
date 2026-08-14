/**
 * Recife procedural ao longo do spline: coral instanciado, anéis, pérolas,
 * águas-vivas, a baleia e o templo náutilo.
 */

import * as THREE from 'three';
import { COURSE, PALETTE } from './config.js';
import { applyCaustics } from './shaders.js';
import { coralTexture, sandTexture, skyTexture } from './textures.js';
import { hash, mulberry32, pathAt, pathFrame } from './utils.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

export class Reef {
    constructor(scene, quality, difficulty, textures) {
        this.scene = scene;
        this.quality = quality;
        this.diff = difficulty;
        this.textures = textures;
        this.rings = [];
        this.pearls = [];
        this.jellies = [];
        this.causticMats = [];
        this.group = new THREE.Group();
        scene.add(this.group);
        this._buildSky();
        this._buildVolume();
        this._buildSand();
        this._buildCoral();
        this._buildKelp();
        this._buildFish();
        this._buildPickups();
        this._buildWhale();
        this._buildWreck();
        this._buildTemple();
        this._buildRays();
    }

    _mat(color, { rough = 0.72, metal = 0.08, em = 0, emc = 0x000000, map = null, trans = false, op = 1, cau = false } = {}) {
        const m = new THREE.MeshStandardMaterial({
            color,
            map,
            roughness: rough,
            metalness: metal,
            emissive: emc,
            emissiveIntensity: em,
            transparent: trans,
            opacity: op,
            depthWrite: !trans
        });
        if (cau && this.quality.caustics) {
            applyCaustics(m, 0.5);
            this.causticMats.push(m);
        }
        return m;
    }

    _buildSky() {
        const sky = new THREE.Mesh(
            new THREE.SphereGeometry(280, 24, 16),
            new THREE.MeshBasicMaterial({ map: this.textures.sky, side: THREE.BackSide, fog: false })
        );
        this.group.add(sky);

        const sun = new THREE.Mesh(
            new THREE.CircleGeometry(18, 24),
            new THREE.MeshBasicMaterial({ color: 0xc8fff4, fog: false, transparent: true, opacity: 0.55 })
        );
        sun.position.set(20, 90, -40);
        sun.lookAt(0, 0, 0);
        this.group.add(sun);
    }

    _buildVolume() {
        const water = new THREE.Mesh(
            new THREE.PlaneGeometry(420, 640, 1, 1),
            new THREE.MeshPhysicalMaterial({
                color: 0x3ec6d4,
                roughness: 0.15,
                metalness: 0,
                transmission: 0.55,
                thickness: 2,
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide,
                depthWrite: false
            })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.set(0, 38, COURSE.length * 0.5);
        this.water = water;
        if (!this.quality.caustics) water.material.transmission = 0;
        this.group.add(water);
    }

    _buildSand() {
        const geo = new THREE.PlaneGeometry(220, COURSE.length + 80, 40, 80);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const n = Math.sin(x * 0.09) * 1.8 + Math.cos(y * 0.05) * 2.2 + hash(i * 13) * 1.4;
            pos.setZ(i, n);
        }
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, this._mat(PALETTE.sand, { map: this.textures.sand, cau: true, rough: 0.95 }));
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(0, -6, COURSE.length * 0.5);
        mesh.receiveShadow = true;
        this.group.add(mesh);
    }

    _buildCoral() {
        const kinds = [
            new THREE.ConeGeometry(0.7, 2.2, 7),
            new THREE.SphereGeometry(0.7, 8, 6),
            new THREE.CylinderGeometry(0.15, 0.35, 2.4, 6)
        ];
        const colors = [0xe15b64, 0xff8a6a, 0xf2c14e, 0xd94f8a, 0x5ec8c8];
        const count = this.quality.coral;
        const mesh = new THREE.InstancedMesh(
            kinds[0],
            this._mat(0xe15b64, { map: this.textures.coral, cau: true, em: 0.12, emc: 0xff6a7a }),
            count
        );
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.castShadow = this.quality.shadows;
        const rng = mulberry32(42);
        for (let i = 0; i < count; i++) {
            const s = 12 + rng() * (COURSE.length - 24);
            const frame = pathFrame(s, COURSE.length);
            const side = rng() > 0.5 ? 1 : -1;
            const dist = this.diff.corridor + 3 + rng() * 10;
            const along = (rng() - 0.5) * 4;
            _p.set(
                frame.p.x + frame.r.x * side * dist + frame.f.x * along,
                -4 + rng() * 6,
                frame.p.z + frame.r.z * side * dist + frame.f.z * along
            );
            _e.set(rng() * 0.3, rng() * Math.PI * 2, rng() * 0.2);
            _q.setFromEuler(_e);
            const sc = 0.7 + rng() * 1.8;
            _s.set(sc, sc * (0.8 + rng() * 1.4), sc);
            _m.compose(_p, _q, _s);
            mesh.setMatrixAt(i, _m);
            mesh.setColorAt?.(i, new THREE.Color(colors[i % colors.length]));
        }
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        this.group.add(mesh);

        const fans = new THREE.InstancedMesh(
            new THREE.ConeGeometry(1.1, 0.35, 10),
            this._mat(0xff9bb0, { trans: true, op: 0.78, em: 0.2, emc: 0xff7a8a }),
            Math.floor(count * 0.45)
        );
        for (let i = 0; i < fans.count; i++) {
            const s = 20 + hash(i + 9) * (COURSE.length - 40);
            const frame = pathFrame(s, COURSE.length);
            const ang = hash(i * 3) * Math.PI * 2;
            const dist = 6 + hash(i * 7) * 14;
            _p.set(frame.p.x + Math.cos(ang) * dist, -3.5 + hash(i) * 2, frame.p.z + Math.sin(ang) * dist);
            _q.setFromEuler(_e.set(-Math.PI / 2, 0, ang));
            _s.set(1, 1, 1);
            _m.compose(_p, _q, _s);
            fans.setMatrixAt(i, _m);
        }
        this.group.add(fans);
        void kinds;
    }

    _buildKelp() {
        const count = this.quality.kelp;
        const kelp = new THREE.InstancedMesh(
            new THREE.CylinderGeometry(0.08, 0.16, 1, 5),
            this._mat(PALETTE.kelp, { em: 0.18, emc: 0x2cff9a, cau: true }),
            count
        );
        this.kelp = [];
        for (let i = 0; i < count; i++) {
            const s = 8 + hash(i + 21) * (COURSE.length - 16);
            const frame = pathFrame(s, COURSE.length);
            const side = hash(i) > 0.5 ? 1 : -1;
            const dist = 5 + hash(i * 2) * 12;
            const h = 4 + hash(i * 5) * 10;
            _p.set(
                frame.p.x + frame.r.x * side * dist,
                h * 0.5 - 5,
                frame.p.z + frame.r.z * side * dist
            );
            _s.set(1, h, 1);
            _q.identity();
            _m.compose(_p, _q, _s);
            kelp.setMatrixAt(i, _m);
            this.kelp.push({ s, side, dist, h, phase: hash(i * 11) * 6 });
        }
        this.kelpMesh = kelp;
        this.group.add(kelp);
    }

    _buildFish() {
        const count = this.quality.fish;
        const fish = new THREE.InstancedMesh(
            new THREE.ConeGeometry(0.12, 0.45, 5),
            this._mat(0x7ad7ff, { em: 0.35, emc: 0x5ef0d8, rough: 0.3 }),
            count
        );
        this.fish = [];
        for (let i = 0; i < count; i++) {
            this.fish.push({
                s: hash(i + 3) * COURSE.length,
                orbit: 2 + hash(i * 4) * 8,
                phase: hash(i * 8) * 6.2,
                speed: 0.3 + hash(i * 2) * 0.7,
                y: (hash(i * 5) - 0.5) * 8
            });
        }
        this.fishMesh = fish;
        this.group.add(fish);
    }

    _buildPickups() {
        const ringGeo = new THREE.TorusGeometry(3.4, 0.12, 8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
            color: PALETTE.lumen,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        const pearlGeo = new THREE.SphereGeometry(0.32, 12, 10);
        const pearlMat = new THREE.MeshStandardMaterial({
            color: PALETTE.pearl,
            emissive: PALETTE.pearl,
            emissiveIntensity: 0.85,
            roughness: 0.2,
            metalness: 0.4
        });
        const jellyGeo = new THREE.SphereGeometry(0.85, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
        const jellyMat = new THREE.MeshPhysicalMaterial({
            color: 0xc77dff,
            transparent: true,
            opacity: 0.45,
            roughness: 0.15,
            transmission: this.quality.caustics ? 0.4 : 0,
            emissive: 0xaa66ff,
            emissiveIntensity: 0.55,
            depthWrite: false
        });

        const rng = mulberry32(99);
        const ringCount = 22;
        for (let i = 0; i < ringCount; i++) {
            const s = 28 + (i / (ringCount - 1)) * (COURSE.length - 70);
            const frame = pathFrame(s, COURSE.length);
            const lat = (rng() - 0.5) * this.diff.corridor * 0.7;
            const vert = (rng() - 0.5) * this.diff.corridor * 0.45;
            const mesh = new THREE.Mesh(ringGeo, ringMat.clone());
            mesh.position.set(
                frame.p.x + frame.r.x * lat + frame.u.x * vert,
                frame.p.y + frame.r.y * lat + frame.u.y * vert,
                frame.p.z + frame.r.z * lat + frame.u.z * vert
            );
            mesh.lookAt(
                mesh.position.x + frame.f.x,
                mesh.position.y + frame.f.y,
                mesh.position.z + frame.f.z
            );
            const glow = new THREE.PointLight(PALETTE.lumen, 1.1, 12, 2);
            mesh.add(glow);
            this.group.add(mesh);
            this.rings.push({ mesh, taken: false, s, lat, vert });
        }

        const pearlCount = Math.round(36 * this.diff.pearls);
        for (let i = 0; i < pearlCount; i++) {
            const s = 18 + rng() * (COURSE.length - 50);
            const frame = pathFrame(s, COURSE.length);
            const lat = (rng() - 0.5) * this.diff.corridor * 0.85;
            const vert = (rng() - 0.5) * this.diff.corridor * 0.55;
            const mesh = new THREE.Mesh(pearlGeo, pearlMat);
            mesh.position.set(
                frame.p.x + frame.r.x * lat + frame.u.x * vert,
                frame.p.y + frame.u.y * vert,
                frame.p.z + frame.r.z * lat + frame.u.z * vert
            );
            this.group.add(mesh);
            this.pearls.push({ mesh, taken: false, phase: rng() * 6 });
        }

        const jellyCount = Math.round(16 * this.diff.jellies);
        for (let i = 0; i < jellyCount; i++) {
            const s = 90 + rng() * (COURSE.length - 140);
            const frame = pathFrame(s, COURSE.length);
            const lat = (rng() - 0.5) * this.diff.corridor * 0.9;
            const vert = (rng() - 0.4) * this.diff.corridor * 0.5;
            const mesh = new THREE.Mesh(jellyGeo, jellyMat.clone());
            mesh.position.set(
                frame.p.x + frame.r.x * lat,
                frame.p.y + vert,
                frame.p.z + frame.r.z * lat
            );
            const tent = new THREE.Mesh(
                new THREE.CylinderGeometry(0.04, 0.02, 1.6, 5),
                jellyMat
            );
            tent.position.y = -1.1;
            mesh.add(tent, tent.clone(), tent.clone());
            mesh.children[1].position.x = 0.25;
            mesh.children[2].position.x = -0.22;
            this.group.add(mesh);
            this.jellies.push({ mesh, s, lat, phase: rng() * 6, hit: 0 });
        }
    }

    _buildWhale() {
        const w = new THREE.Group();
        const skin = this._mat(0x4a6a78, { rough: 0.6, em: 0.08, emc: 0x88c8d8 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), skin);
        body.scale.set(2.4, 1.3, 5.2);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 10), skin);
        head.position.z = 4.2;
        head.scale.set(1.1, 0.95, 1.4);
        const fin = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 1.1), skin);
        fin.position.set(0, 0.1, 0.2);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, 1.2), skin);
        tail.position.set(0, 0.2, -5.1);
        w.add(body, head, fin, tail);
        this.whale = w;
        this.whaleTail = tail;
        this.group.add(w);
    }

    _buildWreck() {
        const wood = this._mat(0x5a3a28, { rough: 0.9, cau: true });
        const hull = new THREE.Mesh(new THREE.BoxGeometry(18, 6, 42), wood);
        const mid = pathAt(COURSE.length * 0.38, COURSE.length);
        hull.position.set(mid.x + 18, -1, mid.z);
        hull.rotation.y = 0.5;
        hull.rotation.z = 0.18;
        this.group.add(hull);
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 22, 8), wood);
        mast.position.set(mid.x + 16, 10, mid.z + 4);
        mast.rotation.z = 0.4;
        this.group.add(mast);
        const sail = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 14),
            this._mat(0xd8c4a0, { trans: true, op: 0.35 })
        );
        sail.position.copy(mast.position).add(new THREE.Vector3(2, -1, 0));
        this.group.add(sail);
    }

    _buildTemple() {
        const end = pathAt(COURSE.length - 8, COURSE.length);
        const gold = this._mat(PALETTE.pearl, { rough: 0.25, metal: 0.55, em: 0.6, emc: PALETTE.lumen });
        const nautilus = new THREE.Group();
        for (let i = 0; i < 10; i++) {
            const t = i / 10;
            const rad = 2 + i * 1.15;
            const ring = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.18, 8, 28), gold);
            ring.position.y = i * 0.55;
            ring.rotation.x = Math.PI / 2;
            ring.rotation.z = t * 0.8;
            nautilus.add(ring);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 18), gold);
        core.position.y = 3.2;
        nautilus.add(core);
        const light = new THREE.PointLight(PALETTE.pearl, 4, 40, 2);
        light.position.y = 4;
        nautilus.add(light);
        nautilus.position.set(end.x, end.y - 2, end.z + 6);
        this.temple = nautilus;
        this.group.add(nautilus);

        const columns = this._mat(0x8ab8c4, { cau: true, rough: 0.5 });
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 9, 8), columns);
            col.position.set(end.x + Math.cos(a) * 9, end.y - 4, end.z + 6 + Math.sin(a) * 9);
            this.group.add(col);
        }
    }

    _buildRays() {
        const mat = new THREE.MeshBasicMaterial({
            color: 0xb8fff4,
            transparent: true,
            opacity: 0.06,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.rays = [];
        for (let i = 0; i < this.quality.rays; i++) {
            const ray = new THREE.Mesh(new THREE.ConeGeometry(3.5, 42, 8, 1, true), mat.clone());
            ray.rotation.x = Math.PI;
            const s = 40 + hash(i + 4) * (COURSE.length - 80);
            const p = pathAt(s, COURSE.length);
            ray.position.set(p.x + (hash(i) - 0.5) * 16, 22, p.z);
            this.group.add(ray);
            this.rays.push(ray);
        }
    }

    collect(playerPos, radius) {
        const events = [];
        for (const ring of this.rings) {
            if (ring.taken) continue;
            const d = ring.mesh.position.distanceTo(playerPos);
            if (d < 3.6 + radius) {
                ring.taken = true;
                ring.mesh.visible = false;
                events.push({ type: 'ring' });
            }
        }
        for (const pearl of this.pearls) {
            if (pearl.taken) continue;
            if (pearl.mesh.position.distanceTo(playerPos) < 1.4 + radius) {
                pearl.taken = true;
                pearl.mesh.visible = false;
                events.push({ type: 'pearl' });
            }
        }
        for (const j of this.jellies) {
            if (j.hit > 0) continue;
            if (j.mesh.position.distanceTo(playerPos) < 1.5 + radius) {
                j.hit = 1.2;
                events.push({ type: 'jelly' });
            }
        }
        return events;
    }

    reset() {
        for (const ring of this.rings) {
            ring.taken = false;
            ring.mesh.visible = true;
        }
        for (const pearl of this.pearls) {
            pearl.taken = false;
            pearl.mesh.visible = true;
        }
        for (const j of this.jellies) j.hit = 0;
    }

    update(dt, time) {
        if (this.water) this.water.position.y = 38 + Math.sin(time * 0.4) * 0.35;

        for (const pearl of this.pearls) {
            if (pearl.taken) continue;
            pearl.mesh.position.y += Math.sin(time * 2.2 + pearl.phase) * 0.01;
            pearl.mesh.rotation.y += dt * 1.4;
        }
        for (const ring of this.rings) {
            if (ring.taken) continue;
            ring.mesh.rotation.z += dt * 0.8;
        }
        for (const j of this.jellies) {
            j.mesh.position.y += Math.sin(time * 1.3 + j.phase) * 0.02;
            j.mesh.rotation.y += dt * 0.4;
            j.hit = Math.max(0, j.hit - dt);
            j.mesh.material.opacity = j.hit > 0 ? 0.2 : 0.45;
        }

        if (this.fishMesh) {
            for (let i = 0; i < this.fish.length; i++) {
                const f = this.fish[i];
                f.s = (f.s + f.speed * 6 * dt) % COURSE.length;
                const frame = pathFrame(f.s, COURSE.length);
                const a = time * f.speed + f.phase;
                _p.set(
                    frame.p.x + Math.cos(a) * f.orbit,
                    frame.p.y + f.y + Math.sin(a * 1.3) * 0.6,
                    frame.p.z + Math.sin(a) * f.orbit
                );
                _e.set(0, -a, 0.2);
                _q.setFromEuler(_e);
                _s.set(1, 1, 1);
                _m.compose(_p, _q, _s);
                this.fishMesh.setMatrixAt(i, _m);
            }
            this.fishMesh.instanceMatrix.needsUpdate = true;
        }

        if (this.kelpMesh) {
            for (let i = 0; i < this.kelp.length; i++) {
                const k = this.kelp[i];
                const frame = pathFrame(k.s, COURSE.length);
                _p.set(
                    frame.p.x + frame.r.x * k.side * k.dist,
                    k.h * 0.5 - 5,
                    frame.p.z + frame.r.z * k.side * k.dist
                );
                _e.set(Math.sin(time * 1.2 + k.phase) * 0.18, 0, Math.cos(time * 0.9 + k.phase) * 0.12);
                _q.setFromEuler(_e);
                _s.set(1, k.h, 1);
                _m.compose(_p, _q, _s);
                this.kelpMesh.setMatrixAt(i, _m);
            }
            this.kelpMesh.instanceMatrix.needsUpdate = true;
        }

        if (this.whale) {
            const s = 220 + Math.sin(time * 0.12) * 40;
            const frame = pathFrame(s, COURSE.length);
            this.whale.position.set(frame.p.x + 10, frame.p.y + 2, frame.p.z);
            this.whale.lookAt(frame.p.x + frame.f.x * 10, frame.p.y, frame.p.z + frame.f.z * 10);
            this.whaleTail.rotation.y = Math.sin(time * 1.6) * 0.4;
        }
        if (this.temple) this.temple.rotation.y += dt * 0.15;
        for (const ray of this.rays) {
            ray.material.opacity = 0.04 + Math.sin(time * 0.7 + ray.position.z) * 0.025;
        }
    }
}
