/**
 * Coluna d'água infinita: cúpula, areia, raios, plâncton, kelp e ruínas recicladas.
 * O jogador avança em −Z; chunks atrás voltam para a frente com um novo layout.
 */

import * as THREE from 'three';
import { PLAY } from './config.js';
import { mulberry32, randRange, randInt } from './utils.js';
import {
    waterDomeMaterial, sandMaterial, stoneMaterial, kelpMaterial,
    rayMaterial, planktonMaterial
} from './shaders.js';
import {
    createSharedGeo, tintUniforms, makeColumn, makeArch, makeTemple,
    makeRock, makeStatue, makeCoral
} from './models.js';

export class Ocean {
    constructor(scene, quality, pal) {
        this.scene = scene;
        this.quality = quality;
        this.geo = createSharedGeo();
        this.chunks = [];
        this.time = 0;

        this.u = {
            uTime: { value: 0 },
            uZenith: { value: new THREE.Color(pal.zenith) },
            uHorizon: { value: new THREE.Color(pal.horizon) },
            uSand: { value: new THREE.Color(pal.sand) },
            uStone: { value: new THREE.Color(pal.stone) },
            uGlowA: { value: new THREE.Color(pal.glowA) },
            uGlowB: { value: new THREE.Color(pal.glowB) },
            uFog: { value: new THREE.Color(pal.fog) },
            uJelly: { value: new THREE.Color(pal.jelly) },
            uFogDensity: { value: 0.012 },
            uSeed: { value: 0 },
            uGain: { value: 1 },
            uScale: { value: 420 },
            uPulse: { value: 0 },
            uHit: { value: 0 }
        };

        this.mats = {
            sand: sandMaterial(THREE, this.u),
            stone: stoneMaterial(THREE, this.u),
            kelp: kelpMaterial(THREE, this.u),
            glowA: new THREE.MeshBasicMaterial({
                color: pal.glowA,
                transparent: true,
                opacity: 0.85,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            }),
            glowB: new THREE.MeshBasicMaterial({
                color: pal.glowB,
                transparent: true,
                opacity: 0.8,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        };

        this._dome(pal);
        this._floor();
        this._rays(quality.rays);
        this._plankton(quality.plankton);
        this._fish(quality.fish);
        this._lights(pal);

        for (let i = 0; i < PLAY.chunkCount; i++) {
            this.chunks.push(this._buildChunk(i, -i * PLAY.chunkLength));
        }
    }

    _dome() {
        const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(220, 32, 20),
            waterDomeMaterial(THREE, this.u)
        );
        mesh.frustumCulled = false;
        this.dome = mesh;
        this.scene.add(mesh);
    }

    _floor() {
        const geo = new THREE.PlaneGeometry(90, PLAY.chunkLength * PLAY.chunkCount + 40, 24, 48);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const h = Math.sin(x * 0.12) * 0.8 + Math.cos(z * 0.07) * 1.1
                + Math.sin(x * 0.31 + z * 0.19) * 0.45;
            pos.setY(i, h);
        }
        geo.computeVertexNormals();
        this.floor = new THREE.Mesh(geo, this.mats.sand);
        this.floor.position.y = 0;
        this.scene.add(this.floor);
    }

    _rays(count) {
        this.rays = [];
        const mat = rayMaterial(THREE, this.u);
        for (let i = 0; i < count; i++) {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 48), mat);
            mesh.position.set((i - count / 2) * 7.5, 18, -20 - i * 12);
            mesh.rotation.x = 0.18;
            mesh.frustumCulled = false;
            this.rays.push(mesh);
            this.scene.add(mesh);
        }
    }

    _plankton(count) {
        const pos = new Float32Array(count * 3);
        const size = new Float32Array(count);
        const seed = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 70;
            pos[i * 3 + 1] = 1 + Math.random() * 28;
            pos[i * 3 + 2] = -Math.random() * PLAY.chunkLength * PLAY.chunkCount;
            size[i] = 0.6 + Math.random() * 2.2;
            seed[i] = Math.random();
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
        geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
        geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 400);
        this.plankton = new THREE.Points(geo, planktonMaterial(THREE, this.u));
        this.plankton.frustumCulled = false;
        this.scene.add(this.plankton);
    }

    _fish(count) {
        this.schools = [];
        const mat = new THREE.MeshBasicMaterial({
            color: 0xa8fff0,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        for (let s = 0; s < 3; s++) {
            const g = new THREE.Group();
            for (let i = 0; i < count; i++) {
                const m = new THREE.Mesh(this.geo.fish, mat);
                m.position.set(
                    (Math.random() - 0.5) * 6,
                    (Math.random() - 0.5) * 2.4,
                    (Math.random() - 0.5) * 8
                );
                m.rotation.x = Math.PI / 2;
                g.add(m);
            }
            g.position.set((s - 1) * 10, 8 + s * 2, -40 - s * 50);
            g.userData.speed = 4 + s;
            this.schools.push(g);
            this.scene.add(g);
        }
        this.fishMat = mat;
    }

    _lights(pal) {
        this.hemi = new THREE.HemisphereLight(pal.sun, pal.sand, 0.85);
        this.sun = new THREE.DirectionalLight(pal.sun, 1.15);
        this.sun.position.set(8, 40, 12);
        this.scene.add(this.hemi, this.sun);
    }

    _buildChunk(index, z) {
        const group = new THREE.Group();
        group.position.z = z;
        this._populate(group, index);
        this.scene.add(group);
        return { group, index, z };
    }

    _populate(group, index) {
        while (group.children.length) {
            const c = group.children[0];
            group.remove(c);
        }
        const rng = mulberry32(index * 9973 + 17);
        const stone = this.mats.stone;
        const along = () => randRange(rng, -PLAY.chunkLength + 8, -8);
        group.userData.colliders = [];

        const rocks = randInt(rng, 2, 5);
        for (let i = 0; i < rocks; i++) {
            const r = makeRock(this.geo, stone, rng);
            r.position.set(randRange(rng, -18, 18), 0, along());
            group.add(r);
        }

        const cols = randInt(rng, 2, 5);
        for (let i = 0; i < cols; i++) {
            const h = randRange(rng, 4, 14);
            const radius = randRange(rng, 0.35, 0.7);
            const c = makeColumn(this.geo, stone, h, radius);
            c.position.set(randRange(rng, -15, 15), 0, along());
            group.add(c);
            group.userData.colliders.push({
                local: c.position.clone(),
                radius: radius * 1.35,
                height: h
            });
        }

        if (rng() > 0.35) {
            const arch = makeArch(this.geo, stone, randRange(rng, 5, 9), randRange(rng, 6, 11));
            arch.position.set(randRange(rng, -6, 6), 0, along());
            arch.rotation.y = rng() * 0.6 - 0.3;
            group.add(arch);
        }

        if (rng() > 0.62) {
            const t = makeTemple(this.geo, stone);
            t.position.set(randRange(rng, -10, 10), 0, along());
            t.rotation.y = rng() * Math.PI;
            t.scale.setScalar(0.7 + rng() * 0.45);
            group.add(t);
        }

        if (rng() > 0.5) {
            const s = makeStatue(this.geo, stone);
            s.position.set(randRange(rng, -14, 14), 0, along());
            s.rotation.y = rng() * Math.PI * 2;
            group.add(s);
        }

        const corals = randInt(rng, 3, 7);
        for (let i = 0; i < corals; i++) {
            const c = makeCoral(this.geo, this.mats, rng);
            c.position.set(randRange(rng, -16, 16), 0, along());
            group.add(c);
        }

        const kelpN = this.quality.kelp;
        for (let i = 0; i < kelpN; i++) {
            const k = new THREE.Mesh(this.geo.kelp, this.mats.kelp);
            k.position.set(randRange(rng, -18, 18), 4, along());
            k.rotation.y = rng() * Math.PI;
            k.scale.set(1, 0.7 + rng() * 1.1, 1);
            group.add(k);
        }
    }

    recycle(playerZ) {
        const span = PLAY.chunkLength * PLAY.chunkCount;
        for (const chunk of this.chunks) {
            if (chunk.group.position.z - playerZ > PLAY.chunkLength * 1.4) {
                chunk.index += PLAY.chunkCount;
                chunk.group.position.z -= span;
                this._populate(chunk.group, chunk.index);
            }
        }
        if (this.floor) this.floor.position.z = playerZ - span * 0.45;
        if (this.dome) this.dome.position.set(0, 8, playerZ);
    }

    setPalette(pal) {
        tintUniforms(this.u, pal);
        this.mats.glowA.color.setHex(pal.glowA);
        this.mats.glowB.color.setHex(pal.glowB);
        this.fishMat.color.setHex(pal.glowA);
        this.hemi.color.setHex(pal.sun);
        this.hemi.groundColor.setHex(pal.sand);
        this.sun.color.setHex(pal.sun);
        this.scene.fog.color.setHex(pal.fog);
        this.scene.background.setHex(pal.zenith);
    }

    update(dt, playerZ) {
        this.time += dt;
        this.u.uTime.value = this.time;
        this.recycle(playerZ);

        for (let i = 0; i < this.rays.length; i++) {
            const r = this.rays[i];
            r.position.z = playerZ - 18 - i * 14;
            r.position.x = Math.sin(this.time * 0.12 + i) * 10 + (i - 2) * 5;
            r.rotation.y = Math.sin(this.time * 0.08 + i) * 0.15;
        }

        if (this.plankton) this.plankton.position.z = playerZ;

        for (const s of this.schools) {
            s.position.z -= s.userData.speed * dt;
            s.position.y += Math.sin(this.time + s.position.x) * 0.4 * dt;
            s.rotation.y = Math.sin(this.time * 0.4) * 0.4;
            if (s.position.z > playerZ + 16) {
                s.position.z = playerZ - randRange(() => Math.random(), 60, 180);
                s.position.x = randRange(() => Math.random(), -12, 12);
                s.position.y = randRange(() => Math.random(), 5, 16);
            }
        }
    }

    /** Colunas próximas o bastante para empurrar a medusa. */
    collide(x, y, z, radius) {
        let nx = 0;
        let nz = 0;
        let hit = false;
        for (const chunk of this.chunks) {
            const cz = chunk.group.position.z;
            for (const c of chunk.group.userData.colliders || []) {
                const wx = c.local.x;
                const wz = cz + c.local.z;
                const dx = x - wx;
                const dz = z - wz;
                const rr = radius + c.radius;
                if (dx * dx + dz * dz < rr * rr && y < c.height + 1.2) {
                    const d = Math.hypot(dx, dz) || 0.001;
                    nx += dx / d;
                    nz += dz / d;
                    hit = true;
                }
            }
        }
        return hit ? { nx, nz } : null;
    }
}
