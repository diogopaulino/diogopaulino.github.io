/**
 * Constrói cada capítulo: terreno, vegetação, marcos e objetivos.
 * Árvores e pilares entram como InstancedMesh para cortar draw calls.
 */

import * as THREE from 'three';
import { fbm, hash2, seeded, smoothstep } from './utils.js?v=3';
import { grassTexture, mossTexture, stoneTexture, brickTexture, applyMaps } from './textures.js?v=3';
import {
    buildHobbitHole, buildPartyTree, buildRing,
    buildRock, buildPavilion, buildCouncilRing, buildBridge,
    buildSeat, buildRuinArch, buildWizard, buildElf, buildNazgul, buildGoblin,
    buildCompanion, grassBladeGeometry, grassBladeMaterial, waterMaterial,
    getOakAssets, getPineAssets, getPillarAssets, buildBalrog, std
} from './models.js?v=3';
import { Rider, GoblinAI } from './npcs.js?v=3';

export class ChapterWorld {
    constructor() {
        this.group = new THREE.Group();
        this.colliders = [];
        this.interactables = [];
        this.riders = [];
        this.goblins = [];
        this.particles = [];
        this.heightAt = () => 0;
        this.bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
        this.spawn = { x: 0, z: 0, yaw: 0 };
        this.goal = null;
        this.updateFns = [];
        this.overview = new THREE.Vector3(18, 14, 22);
        this.waterMeshes = [];
        this.balrog = null;
        this.balrogAwake = false;
        this.page = null;
    }

    addCollider(x, z, r) {
        this.colliders.push({ x, z, r });
    }

    addInteract(it) {
        this.interactables.push(it);
    }
}

function groundMat(maps, color) {
    const m = new THREE.MeshStandardMaterial({
        color, roughness: 0.94, metalness: 0.02, vertexColors: true
    });
    applyMaps(m, maps, { color, roughness: 0.94, metalness: 0.02, normalScale: 1.05 });
    m.vertexColors = true;
    return m;
}

function terrainMesh(heightAt, size, segs, material, ox = 0, oz = 0, colorFn = null) {
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, heightAt(x + ox, z + oz));
    }
    if (colorFn) {
        const colors = new Float32Array(pos.count * 3);
        const c = new THREE.Color();
        for (let i = 0; i < pos.count; i++) {
            colorFn(pos.getX(i) + ox, pos.getZ(i) + oz, pos.getY(i), c);
            colors[i * 3] = c.r;
            colors[i * 3 + 1] = c.g;
            colors[i * 3 + 2] = c.b;
        }
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        material.vertexColors = true;
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(ox, 0, oz);
    mesh.receiveShadow = true;
    return mesh;
}

const _dummy = new THREE.Object3D();

function placeTree(world, rng, opts) {
    const { minR = 8, maxR = 48, avoid = [] } = opts;
    const a = rng() * Math.PI * 2;
    const r = minR + rng() * (maxR - minR);
    const x = Math.cos(a) * r + (opts.cx || 0);
    const z = Math.sin(a) * r + (opts.cz || 0);
    if (avoid.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) return null;
    if (x < world.bounds.minX + 2 || x > world.bounds.maxX - 2) return null;
    if (z < world.bounds.minZ + 2 || z > world.bounds.maxZ - 2) return null;
    return { x, z, s: (opts.minScale || 0.8) + rng() * ((opts.maxScale || 1.5) - (opts.minScale || 0.8)), rot: rng() * Math.PI * 2 };
}

function scatterInstancedOaks(world, count, rng, opts, autumn = false) {
    const { trunkGeo, canopyGeo, trunkMat, canopyMat } = getOakAssets(autumn);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    trunks.castShadow = canopies.castShadow = true;
    trunks.receiveShadow = canopies.receiveShadow = true;
    let n = 0;
    for (let i = 0; i < count; i++) {
        const p = placeTree(world, rng, opts);
        if (!p) continue;
        _dummy.position.set(p.x, world.heightAt(p.x, p.z), p.z);
        _dummy.rotation.set(0, p.rot, 0);
        _dummy.scale.setScalar(p.s);
        _dummy.updateMatrix();
        trunks.setMatrixAt(n, _dummy.matrix);
        _dummy.position.y += 1.35 * p.s;
        _dummy.updateMatrix();
        canopies.setMatrixAt(n, _dummy.matrix);
        world.addCollider(p.x, p.z, 0.55 * p.s);
        n++;
    }
    trunks.count = n;
    canopies.count = n;
    world.group.add(trunks);
    world.group.add(canopies);
}

function scatterGrass(world, count) {
    const geo = grassBladeGeometry();
    const mat = grassBladeMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const b = world.bounds;
    for (let i = 0; i < count; i++) {
        const x = b.minX + hash2(i, 1) * (b.maxX - b.minX);
        const z = b.minZ + hash2(i, 2) * (b.maxZ - b.minZ);
        _dummy.position.set(x, world.heightAt(x, z), z);
        _dummy.rotation.set((hash2(i, 5) - 0.5) * 0.25, hash2(i, 3) * Math.PI * 2, 0);
        _dummy.scale.setScalar(0.75 + hash2(i, 4) * 0.95);
        _dummy.updateMatrix();
        mesh.setMatrixAt(i, _dummy.matrix);
    }
    mesh.receiveShadow = true;
    world.group.add(mesh);
}

function makePage(world, x, z, id) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.015, 0.46),
        new THREE.MeshStandardMaterial({
            color: 0xf2e4c0,
            emissive: 0xc8a050,
            emissiveIntensity: 0.4,
            roughness: 0.7
        })
    );
    const y = world.heightAt(x, z) + 0.7;
    mesh.position.set(x, y, z);
    world.group.add(mesh);
    world.page = { x, z, r: 1.3, id, mesh, kind: 'page', label: 'Recolher página da crônica', done: false };
    world.addInteract(world.page);
    world.updateFns.push((t) => {
        if (world.page.done) return;
        mesh.position.y = y + Math.sin(t * 2.2) * 0.12;
        mesh.rotation.y = t * 0.8;
    });
}

function addWater(world, w, h, color, x, y, z, segs = 24) {
    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h, segs, Math.max(8, (segs * h / w) | 0)),
        waterMaterial(color)
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(x, y, z);
    world.group.add(water);
    world.waterMeshes.push(water);
    return water;
}

/* ================================================================== */
/* I — O Condado                                                       */
/* ================================================================== */

export function buildShire(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -52, maxX: 52, minZ: -52, maxZ: 52 };
    world.spawn = { x: 18, z: 22, yaw: -2.4 };
    world.overview.set(22, 16, 28);

    world.heightAt = (x, z) => {
        const hills = fbm(x * 0.035, z * 0.035, 2) * 7.5
            + Math.sin(x * 0.04) * 2.2
            + Math.cos(z * 0.033) * 1.8;
        const bag = Math.hypot(x + 20, z + 6);
        const mound = smoothstep(10, 0, bag) * 4.2;
        const party = Math.hypot(x, z);
        const flat = 1 - smoothstep(6, 16, party) * 0.35;
        return hills * flat + mound;
    };

    const dirt = new THREE.Color(0x8a6a38);
    const lush = new THREE.Color(0x8fbc5a);
    const deep = new THREE.Color(0x6a8a38);
    const ground = terrainMesh(
        world.heightAt, 120, quality.id === 'low' ? 56 : 110,
        groundMat(grassTexture(), 0x8fbc5a),
        0, 0,
        (x, z, y, c) => {
            const toBag = Math.abs((x + 20) * 0.55 + (z + 6) * 0.45);
            const along = smoothstep(40, 8, Math.hypot(x + 1, z + 8));
            const pathAmt = smoothstep(3.2, 1.1, toBag) * along;
            const slope = Math.min(1, y * 0.08);
            c.copy(lush).lerp(deep, slope * 0.35).lerp(dirt, pathAmt * 0.7);
        }
    );
    world.group.add(ground);

    const party = buildPartyTree();
    party.position.set(0, world.heightAt(0, 0), 0);
    world.group.add(party);
    world.addCollider(0, 0, 1.2);

    const hole = buildHobbitHole({ doorColor: '#2d6b38', scale: 1.35 });
    hole.group.position.set(-20, world.heightAt(-20, -6), -6);
    hole.group.lookAt(new THREE.Vector3(-12, hole.group.position.y, 2));
    world.group.add(hole.group);
    world.addCollider(-20, -6, 1.85);

    const ring = buildRing(1.15);
    const doorX = -18.2;
    const doorZ = -3.6;
    ring.position.set(doorX, world.heightAt(doorX, doorZ) + 1.15, doorZ);
    world.group.add(ring);
    const ringIt = {
        x: doorX, z: doorZ, r: 1.8, id: 'ring', kind: 'ring',
        label: 'Pegar o Anel', mesh: ring, done: false
    };
    world.addInteract(ringIt);
    world.goal = 'ring';
    const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.45, 6.5, 10, 1, true),
        new THREE.MeshBasicMaterial({
            color: 0xffcc55, transparent: true, opacity: 0.16,
            side: THREE.DoubleSide, depthWrite: false
        })
    );
    beacon.position.set(doorX, world.heightAt(doorX, doorZ) + 3.4, doorZ);
    world.group.add(beacon);
    world.updateFns.push((t) => {
        if (ringIt.done) {
            beacon.visible = false;
            return;
        }
        ring.rotation.y = t * 0.9;
        ring.position.y = world.heightAt(doorX, doorZ) + 1.15 + Math.sin(t * 2) * 0.08;
        beacon.material.opacity = 0.1 + Math.sin(t * 2.4) * 0.05;
    });

    const colors = ['#2d6b38', '#6b3a2d', '#3a4a8a', '#8a5a2a', '#4a6b3a'];
    const rng = seeded(42);
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.4;
        const r = 16 + rng() * 18;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (Math.hypot(x + 20, z + 6) < 10) continue;
        const h = buildHobbitHole({ doorColor: colors[i % colors.length], scale: 0.75 + rng() * 0.35 });
        h.group.position.set(x, world.heightAt(x, z) - 0.2, z);
        h.group.rotation.y = a + Math.PI;
        world.group.add(h.group);
        world.addCollider(x, z, 1.6);
    }

    const wiz = buildWizard();
    wiz.group.position.set(8, world.heightAt(8, -12), -12);
    world.group.add(wiz.group);
    world.addCollider(8, -12, 0.7);
    world.addInteract({
        x: 8, z: -12, r: 2.2, id: 'wizard', kind: 'talk',
        label: 'Falar com o Cinzento', done: false,
        lines: [
            'O Condado dorme em paz — por enquanto.',
            'Leve o Anel. Não o use. A estrada já está à escuta.'
        ]
    });

    const fireworks = [];
    const fGeo = new THREE.SphereGeometry(0.07, 6, 5);
    for (let i = 0; i < Math.floor(36 * quality.particles); i++) {
        const p = new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hash2(i, 2), 0.75, 0.62),
            transparent: true
        }));
        world.group.add(p);
        fireworks.push({ mesh: p, t: rng() * 4, life: 2 + rng() * 2 });
    }
    world.updateFns.push((t) => {
        wiz.parts.crystal.rotation.y = t * 2;
        wiz.parts.crystal.rotation.z = Math.sin(t * 1.4) * 0.2;
        for (const fw of fireworks) {
            const u = (t + fw.t) % fw.life;
            const k = u / fw.life;
            const ang = fw.t * 6;
            fw.mesh.position.set(
                8 + Math.cos(ang) * k * 3.5,
                world.heightAt(8, -12) + 2.2 + k * 7,
                -12 + Math.sin(ang) * k * 3.5
            );
            fw.mesh.scale.setScalar(1 - k);
            fw.mesh.material.opacity = 1 - k;
        }
    });

    scatterInstancedOaks(world, Math.floor(42 * quality.trees), rng, {
        minR: 12, maxR: 48, avoid: [{ x: 0, z: 0, r: 8 }, { x: -20, z: -6, r: 8 }, { x: 18, z: 22, r: 6 }]
    });
    scatterGrass(world, Math.floor(1100 * quality.grass));
    makePage(world, 4, 10, 'shire-page');
    return world;
}

/* ================================================================== */
/* II — A Fuga                                                         */
/* ================================================================== */

export function buildForest(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -22, maxX: 22, minZ: -8, maxZ: 132 };
    world.spawn = { x: 0, z: 4, yaw: 0 };
    world.overview.set(8, 10, -6);

    world.heightAt = (x, z) => {
        const path = smoothstep(5, 11, Math.abs(x));
        const bumps = fbm(x * 0.08, z * 0.05, 7) * 2.4;
        return bumps * path;
    };

    const mossDark = new THREE.Color(0x2a4224);
    const mossPath = new THREE.Color(0x5a6a40);
    const mossDeep = new THREE.Color(0x1a2a14);
    world.group.add(terrainMesh(
        world.heightAt, 140, quality.id === 'low' ? 48 : 88,
        groundMat(mossTexture(), 0x3a5a32),
        0, 62,
        (x, z, y, c) => {
            const path = smoothstep(6.5, 2.2, Math.abs(x));
            c.copy(mossDark).lerp(mossPath, path).lerp(mossDeep, Math.min(1, Math.abs(x) * 0.04));
            void y;
            void z;
        }
    ));

    const rng = seeded(99);
    const pineCount = Math.floor(58 * quality.trees);
    const oakCount = Math.floor(32 * quality.trees);

    const pine = getPineAssets();
    const pineMesh = new THREE.InstancedMesh(pine.geo, pine.mat, pineCount);
    pineMesh.castShadow = true;
    pineMesh.receiveShadow = true;
    let pn = 0;
    for (let i = 0; i < pineCount; i++) {
        const z = rng() * 120 + 4;
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (7 + rng() * 12);
        const s = 0.9 + rng() * 1.15;
        _dummy.position.set(x, world.heightAt(x, z), z);
        _dummy.rotation.set(0, rng() * 6, 0);
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        pineMesh.setMatrixAt(pn++, _dummy.matrix);
        world.addCollider(x, z, 0.7);
    }
    pineMesh.count = pn;
    world.group.add(pineMesh);

    const oak = getOakAssets(false);
    const oakTrunk = new THREE.InstancedMesh(oak.trunkGeo, oak.trunkMat, oakCount);
    const oakCan = new THREE.InstancedMesh(oak.canopyGeo, oak.canopyMat, oakCount);
    oakTrunk.castShadow = oakCan.castShadow = true;
    let on = 0;
    for (let i = 0; i < oakCount; i++) {
        const z = rng() * 120 + 4;
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (7.5 + rng() * 11);
        const s = 0.85 + rng() * 1.05;
        _dummy.position.set(x, world.heightAt(x, z), z);
        _dummy.rotation.set(0, rng() * 6, 0);
        _dummy.scale.setScalar(s);
        _dummy.updateMatrix();
        oakTrunk.setMatrixAt(on, _dummy.matrix);
        _dummy.position.y += 1.35 * s;
        _dummy.updateMatrix();
        oakCan.setMatrixAt(on, _dummy.matrix);
        world.addCollider(x, z, 0.7);
        on++;
    }
    oakTrunk.count = oakCan.count = on;
    world.group.add(oakTrunk);
    world.group.add(oakCan);

    for (let i = 0; i < 12; i++) {
        const rock = buildRock(i + 3);
        const x = (rng() - 0.5) * 16;
        const z = 10 + rng() * 100;
        rock.position.set(x, world.heightAt(x, z), z);
        rock.scale.setScalar(0.5 + rng() * 0.95);
        rock.rotation.set(rng(), rng() * 6, rng() * 0.4);
        world.group.add(rock);
        world.addCollider(x, z, 0.6);
    }

    const riderSpawns = [
        { x: -4, z: 38, wps: [{ x: -6, z: 32 }, { x: 5, z: 48 }, { x: -4, z: 38 }] },
        { x: 3, z: 68, wps: [{ x: 6, z: 60 }, { x: -5, z: 78 }, { x: 3, z: 68 }] },
        { x: -2, z: 98, wps: [{ x: -7, z: 92 }, { x: 4, z: 108 }, { x: -2, z: 98 }] }
    ];
    for (const s of riderSpawns) {
        const n = buildNazgul();
        n.group.position.set(s.x, world.heightAt(s.x, s.z), s.z);
        world.group.add(n.group);
        world.riders.push(new Rider(n.group, s.x, s.z, s.wps));
    }

    addWater(world, 48, 22, 0x3a88b0, 0, -0.12, 122, 20);

    const fordMarker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 1.8, 10),
        new THREE.MeshStandardMaterial({ color: 0xd8e8ff, emissive: 0x88aaff, emissiveIntensity: 1.1, roughness: 0.35 })
    );
    fordMarker.position.set(0, 1.2, 124);
    world.group.add(fordMarker);
    world.addInteract({
        x: 0, z: 124, r: 3.2, id: 'ford', kind: 'goal',
        label: 'Atravessar o vau', mesh: fordMarker, done: false
    });
    world.goal = 'ford';

    const elf = buildElf({ robe: 0xd8e8f0 });
    elf.group.position.set(3.5, world.heightAt(3.5, 126), 126);
    world.group.add(elf.group);

    scatterGrass(world, Math.floor(480 * quality.grass));
    makePage(world, -8, 20, 'forest-page');
    return world;
}

/* ================================================================== */
/* III — O Vale Élfico                                                 */
/* ================================================================== */

export function buildRivendell(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -48, maxX: 48, minZ: -40, maxZ: 48 };
    world.spawn = { x: 0, z: -30, yaw: 0 };
    world.overview.set(16, 18, -22);

    world.heightAt = (x, z) => {
        const valley = Math.abs(x) * 0.18;
        const rise = smoothstep(-8, 20, z) * 3.4;
        const noise = fbm(x * 0.03, z * 0.03, 11) * 2.2;
        return valley + rise + noise * 0.5;
    };

    const valleyGreen = new THREE.Color(0x5a8a48);
    const waterEdge = new THREE.Color(0x8ab868);
    const highStone = new THREE.Color(0xc8d0c0);
    world.group.add(terrainMesh(
        world.heightAt, 120, quality.id === 'low' ? 56 : 96,
        groundMat(mossTexture(), 0x6a9a58),
        0, 0,
        (x, z, y, c) => {
            const nearWater = smoothstep(6, 1.2, Math.abs(x));
            c.copy(valleyGreen).lerp(waterEdge, nearWater).lerp(highStone, Math.min(1, y * 0.06));
            void z;
        }
    ));

    addWater(world, 8.5, 90, 0x6ad0e0, 0, 0.06, 0, 16);

    const pav = buildPavilion();
    pav.position.set(0, world.heightAt(0, 8), 8);
    world.group.add(pav);
    world.addCollider(0, 8, 5.4);

    const council = buildCouncilRing();
    council.position.set(0, world.heightAt(0, 18) + 0.05, 18);
    world.group.add(council);

    const ring = buildRing(1.4);
    ring.position.set(0, world.heightAt(0, 18) + 1.35, 18);
    world.group.add(ring);
    world.addInteract({
        x: 0, z: 18, r: 2.4, id: 'oath', kind: 'goal',
        label: 'Aceitar levar o Anel', mesh: ring, done: false
    });
    world.goal = 'oath';
    world.updateFns.push((t) => {
        ring.rotation.y = t * 0.7;
        ring.position.y = world.heightAt(0, 18) + 1.35 + Math.sin(t * 1.6) * 0.1;
    });

    const robes = [0xc8d8c0, 0xd8c8a0, 0xb0c8d8, 0xe8dcc8, 0x9ab090];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const elf = buildElf({ robe: robes[i] });
        const x = Math.cos(a) * 3.2;
        const z = 18 + Math.sin(a) * 3.2;
        elf.group.position.set(x, world.heightAt(x, z), z);
        elf.group.lookAt(0, elf.group.position.y, 18);
        world.group.add(elf.group);
    }

    const fallTex = new THREE.MeshBasicMaterial({
        color: 0xc8f0ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false
    });
    for (const sx of [-1, 1]) {
        const sheet = new THREE.Mesh(new THREE.PlaneGeometry(7, 18, 1, 8), fallTex);
        sheet.position.set(sx * 36, 8, -4);
        world.group.add(sheet);
        world.updateFns.push((t) => {
            sheet.material.opacity = 0.28 + Math.sin(t * 4 + sx) * 0.08;
        });
    }

    const dropGeo = new THREE.SphereGeometry(0.06, 4, 4);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.55 });
    const drops = [];
    const nDrops = Math.floor(90 * quality.particles);
    for (let i = 0; i < nDrops; i++) {
        const m = new THREE.Mesh(dropGeo, dropMat);
        world.group.add(m);
        drops.push({ mesh: m, side: i % 2 ? -1 : 1, t: hash2(i, 4) });
    }
    world.updateFns.push((t) => {
        for (const d of drops) {
            const u = (t * 0.35 + d.t) % 1;
            d.mesh.position.set(d.side * 36, 16 - u * 18, -4 + Math.sin((d.t + t) * 8) * 0.4);
        }
    });

    for (const sx of [-1, 1]) {
        const cliff = new THREE.Mesh(
            new THREE.BoxGeometry(8, 18, 28),
            new THREE.MeshStandardMaterial({ color: 0xc8d8d0, roughness: 0.85 })
        );
        applyMaps(cliff.material, stoneTexture('#8aa0a8'), { color: 0xc8d8d0, roughness: 0.85, normalScale: 1.2 });
        cliff.position.set(sx * 40, 6, 0);
        world.group.add(cliff);
    }

    const rng = seeded(21);
    scatterInstancedOaks(world, Math.floor(30 * quality.trees), rng, {
        minR: 14, maxR: 42, cx: 0, cz: 0, avoid: [{ x: 0, z: 8, r: 10 }, { x: 0, z: 18, r: 8 }]
    }, true);
    scatterGrass(world, Math.floor(560 * quality.grass));
    makePage(world, -12, -16, 'rivendell-page');
    return world;
}

/* ================================================================== */
/* IV — As Minas                                                       */
/* ================================================================== */

export function buildMoria(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -16, maxX: 16, minZ: -4, maxZ: 108 };
    world.spawn = { x: 0, z: 2, yaw: 0 };
    world.overview.set(0, 8, -8);

    world.heightAt = (x, z) => {
        if (z > 74 && z < 90 && Math.abs(x) > 1.15) return -40;
        return 0;
    };

    const floorMaps = brickTexture();
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.92 });
    applyMaps(floorMat, floorMaps, { color: 0x5a4a3a, roughness: 0.92, normalScale: 1.1 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 78), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 36);
    floor.receiveShadow = true;
    world.group.add(floor);

    const exitFloor = new THREE.Mesh(new THREE.PlaneGeometry(10, 22), floorMat);
    exitFloor.rotation.x = -Math.PI / 2;
    exitFloor.position.set(0, 0, 98);
    exitFloor.receiveShadow = true;
    world.group.add(exitFloor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3028, roughness: 0.95 });
    applyMaps(wallMat, stoneTexture('#3a3028'), { color: 0x3a3028, roughness: 0.95, normalScale: 1.25 });
    for (const sx of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(2, 16, 110), wallMat);
        wall.position.set(sx * 18, 8, 50);
        world.group.add(wall);
        world.addCollider(sx * 17, 50, 3);
    }
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(38, 1.2, 110), wallMat);
    ceiling.position.set(0, 15.2, 50);
    world.group.add(ceiling);

    const pillarN = quality.id === 'low' ? 8 : 12;
    const pillar = getPillarAssets(13);
    const pillars = new THREE.InstancedMesh(pillar.geo, pillar.mat, pillarN * 2);
    pillars.castShadow = true;
    pillars.receiveShadow = true;
    let pi = 0;
    for (let i = 0; i < pillarN; i++) {
        const z = 8 + i * 5.5;
        for (const sx of [-1, 1]) {
            _dummy.position.set(sx * 8.5, 0, z);
            _dummy.rotation.set(0, 0, 0);
            _dummy.scale.set(1, 1, 1);
            _dummy.updateMatrix();
            pillars.setMatrixAt(pi++, _dummy.matrix);
            world.addCollider(sx * 8.5, z, 1.0);
        }
    }
    pillars.count = pi;
    world.group.add(pillars);

    const torchCount = quality.lights ? 10 : 4;
    for (let i = 0; i < torchCount; i++) {
        const z = 6 + i * 9;
        const sx = i % 2 ? 1 : -1;
        const flame = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 8, 6),
            new THREE.MeshStandardMaterial({
                color: 0xffaa44, emissive: 0xff6622, emissiveIntensity: 3.2, roughness: 0.4
            })
        );
        flame.position.set(sx * 15.5, 3.4, z);
        world.group.add(flame);
        const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.2, 8), std(0x3a2a18, 0.8));
        bowl.position.set(sx * 15.5, 3.18, z);
        world.group.add(bowl);
        if (quality.lights) {
            const light = new THREE.PointLight(0xff7a30, 2.35, 17, 2);
            light.position.copy(flame.position);
            world.group.add(light);
        }
        world.updateFns.push((t) => {
            const k = 1 + Math.sin(t * 11 + i) * 0.12;
            flame.scale.setScalar(k);
        });
    }

    const goblinSpawns = [
        { x: -3, z: 28 }, { x: 4, z: 42 }, { x: -5, z: 55 }, { x: 2, z: 66 }
    ];
    for (const s of goblinSpawns) {
        const g = buildGoblin();
        g.group.position.set(s.x, 0, s.z);
        world.group.add(g.group);
        world.goblins.push(new GoblinAI(g.group, s.x, s.z));
    }

    const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 20),
        new THREE.MeshBasicMaterial({ color: 0xff4a12, transparent: true, opacity: 0.38, side: THREE.DoubleSide })
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, -8, 82);
    world.group.add(glow);

    const bridge = buildBridge();
    bridge.position.set(0, 0, 82);
    world.group.add(bridge);

    const exit = new THREE.Mesh(
        new THREE.BoxGeometry(4, 5, 0.4),
        new THREE.MeshStandardMaterial({
            color: 0xffe8a0, emissive: 0xffaa44, emissiveIntensity: 0.85, roughness: 0.4
        })
    );
    exit.position.set(0, 2.5, 104);
    world.group.add(exit);
    world.addInteract({
        x: 0, z: 104, r: 2.6, id: 'exit', kind: 'goal',
        label: 'Escapar das minas', mesh: exit, done: false
    });
    world.goal = 'exit';

    const shadow = buildBalrog();
    shadow.position.set(0, -12, 70);
    shadow.visible = false;
    world.group.add(shadow);
    world.balrog = shadow;
    world.updateFns.push((t, dt) => {
        if (!world.balrogAwake) return;
        shadow.visible = true;
        const k = 1 - Math.exp(-1.8 * dt);
        shadow.position.z += (78 - shadow.position.z) * k;
        shadow.position.y += (0 - shadow.position.y) * k;
        const eye = shadow.userData.eye;
        if (eye) eye.scale.setScalar(1 + Math.sin(t * 8) * 0.15);
        const whip = shadow.userData.whip;
        if (whip) whip.rotation.z = -0.9 + Math.sin(t * 3.5) * 0.25;
    });

    makePage(world, 5, 14, 'moria-page');
    return world;
}

/* ================================================================== */
/* V — O Monte da Visão                                                */
/* ================================================================== */

export function buildAmonHen(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -55, maxX: 40, minZ: -40, maxZ: 40 };
    world.spawn = { x: 4, z: 28, yaw: Math.PI };
    world.overview.set(12, 18, 32);

    world.heightAt = (x, z) => {
        const d = Math.hypot(x, z);
        const hill = smoothstep(38, 4, d) * 9.5;
        const river = x < -28 ? -2.5 : 0;
        const noise = fbm(x * 0.04, z * 0.04, 15) * 1.4;
        return Math.max(river, hill + noise * 0.4);
    };

    const henLow = new THREE.Color(0x7a6a38);
    const henHigh = new THREE.Color(0xb89868);
    const henRock = new THREE.Color(0x8a8a80);
    world.group.add(terrainMesh(
        world.heightAt, 130, quality.id === 'low' ? 56 : 96,
        groundMat(grassTexture(), 0x8a7a48),
        0, 0,
        (x, z, y, c) => {
            const d = Math.hypot(x, z);
            c.copy(henLow).lerp(henHigh, smoothstep(28, 4, d)).lerp(henRock, Math.min(1, y * 0.08));
            void z;
        }
    ));

    addWater(world, 40, 130, 0x3a7aaa, -42, -0.35, 0, 18);

    const seat = buildSeat();
    seat.position.set(0, world.heightAt(0, 0), 0);
    world.group.add(seat);
    world.addCollider(0, 0, 1.4);
    world.addInteract({
        x: 0, z: 0, r: 2.2, id: 'seat', kind: 'goal',
        label: 'Sentar no trono e seguir adiante', done: false
    });
    world.goal = 'seat';

    const arch = buildRuinArch();
    arch.position.set(6, world.heightAt(6, 10), 10);
    arch.rotation.y = 0.4;
    world.group.add(arch);

    const arch2 = buildRuinArch();
    arch2.position.set(-8, world.heightAt(-8, 8), 8);
    arch2.rotation.y = -0.6;
    world.group.add(arch2);

    const companion = buildCompanion();
    companion.group.position.set(3.2, world.heightAt(3.2, 5), 5);
    world.group.add(companion.group);
    world.addInteract({
        x: 3.2, z: 5, r: 2, id: 'sam', kind: 'talk',
        label: 'Falar com o jardineiro', done: false,
        lines: [
            'Não posso carregar o Anel por você.',
            'Mas posso ir até o fim. Não o deixe sozinho.'
        ]
    });

    const rng = seeded(5);
    scatterInstancedOaks(world, Math.floor(24 * quality.trees), rng, {
        minR: 12, maxR: 36, avoid: [{ x: 0, z: 0, r: 8 }]
    }, true);
    scatterGrass(world, Math.floor(680 * quality.grass));
    makePage(world, -6, 16, 'hen-page');
    return world;
}

export function buildChapter(id, quality) {
    switch (id) {
        case 'shire': return buildShire(quality);
        case 'forest': return buildForest(quality);
        case 'rivendell': return buildRivendell(quality);
        case 'moria': return buildMoria(quality);
        case 'amonhen': return buildAmonHen(quality);
        default: return buildShire(quality);
    }
}
