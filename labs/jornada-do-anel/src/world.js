/**
 * Constrói cada capítulo: terreno, vegetação, marcos e objetivos.
 * Tudo vive num Group para poder ser trocado com fade entre cenas.
 */

import * as THREE from 'three';
import { fbm, hash2, seeded, smoothstep } from './utils.js';
import {
    grassTexture, mossTexture, stoneTexture, waterTexture, brickTexture
} from './textures.js';
import {
    buildHobbitHole, buildOak, buildPine, buildPartyTree, buildRing,
    buildRock, buildPavilion, buildCouncilRing, buildPillar, buildBridge,
    buildSeat, buildRuinArch, buildWizard, buildElf, buildNazgul, buildGoblin,
    buildCompanion, grassBladeGeometry, applyGrassWind, std
} from './models.js';
import { Rider, GoblinAI } from './npcs.js';

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

function terrainMesh(heightAt, size, segs, material, ox = 0, oz = 0) {
    const geo = new THREE.PlaneGeometry(size, size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, heightAt(x + ox, z + oz));
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(ox, 0, oz);
    mesh.receiveShadow = true;
    return mesh;
}

function scatterTrees(world, proto, count, rng, opts) {
    const { minR = 8, maxR = 48, minScale = 0.8, maxScale = 1.5, avoid = [] } = opts;
    for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = minR + rng() * (maxR - minR);
        const x = Math.cos(a) * r + (opts.cx || 0);
        const z = Math.sin(a) * r + (opts.cz || 0);
        if (avoid.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
        if (x < world.bounds.minX + 2 || x > world.bounds.maxX - 2) continue;
        const tree = proto();
        const s = minScale + rng() * (maxScale - minScale);
        tree.scale.setScalar(s);
        const y = world.heightAt(x, z);
        tree.position.set(x, y, z);
        tree.rotation.y = rng() * Math.PI * 2;
        world.group.add(tree);
        world.addCollider(x, z, 0.55 * s);
    }
}

function scatterGrass(world, count, quality) {
    const geo = grassBladeGeometry();
    const mat = new THREE.MeshStandardMaterial({
        color: 0x5a8a32,
        side: THREE.DoubleSide,
        roughness: 0.95
    });
    applyGrassWind(mat, 1);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    const b = world.bounds;
    for (let i = 0; i < count; i++) {
        const x = b.minX + hash2(i, 1) * (b.maxX - b.minX);
        const z = b.minZ + hash2(i, 2) * (b.maxZ - b.minZ);
        dummy.position.set(x, world.heightAt(x, z), z);
        dummy.rotation.y = hash2(i, 3) * Math.PI * 2;
        dummy.scale.setScalar(0.7 + hash2(i, 4) * 0.8);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.receiveShadow = true;
    world.group.add(mesh);
    world.updateFns.push((t) => {
        if (mat.userData.uTime) mat.userData.uTime.value = t;
    });
    return mesh;
}

function makePage(world, x, z, id) {
    const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.02, 0.5),
        new THREE.MeshStandardMaterial({
            color: 0xf2e4c0,
            emissive: 0xc8a050,
            emissiveIntensity: 0.45
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

    const ground = terrainMesh(
        world.heightAt, 120, quality.id === 'low' ? 48 : 96,
        new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, color: 0x8fbc5a })
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
        new THREE.CylinderGeometry(0.12, 0.45, 6.5, 8, 1, true),
        new THREE.MeshBasicMaterial({
            color: 0xffcc55,
            transparent: true,
            opacity: 0.18,
            side: THREE.DoubleSide,
            depthWrite: false
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
        beacon.material.opacity = 0.12 + Math.sin(t * 2.4) * 0.06;
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
    const fGeo = new THREE.SphereGeometry(0.08, 6, 5);
    for (let i = 0; i < Math.floor(28 * quality.particles); i++) {
        const p = new THREE.Mesh(fGeo, new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hash2(i, 2), 0.75, 0.6)
        }));
        world.group.add(p);
        fireworks.push({ mesh: p, t: rng() * 4, life: 2 + rng() * 2 });
    }
    world.updateFns.push((t) => {
        wiz.parts.crystal.rotation.y = t * 2;
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
            fw.mesh.material.transparent = true;
        }
    });

    scatterTrees(world, () => buildOak(), Math.floor(38 * quality.trees), rng, {
        minR: 12, maxR: 48, avoid: [{ x: 0, z: 0, r: 8 }, { x: -20, z: -6, r: 8 }, { x: 18, z: 22, r: 6 }]
    });
    scatterGrass(world, Math.floor(900 * quality.grass), quality);
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

    world.group.add(terrainMesh(
        world.heightAt, 140, quality.id === 'low' ? 40 : 80,
        new THREE.MeshStandardMaterial({ map: mossTexture(), color: 0x3a5a32, roughness: 0.96 }),
        0, 62
    ));

    const rng = seeded(99);
    const protoPine = () => buildPine();
    const protoOak = () => buildOak();
    const treeCount = Math.floor(90 * quality.trees);
    for (let i = 0; i < treeCount; i++) {
        const z = rng() * 120 + 4;
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (7 + rng() * 12);
        const tree = rng() < 0.65 ? protoPine() : protoOak();
        tree.scale.setScalar(0.9 + rng() * 1.1);
        tree.position.set(x, world.heightAt(x, z), z);
        tree.rotation.y = rng() * 6;
        world.group.add(tree);
        world.addCollider(x, z, 0.7);
    }

    for (let i = 0; i < 10; i++) {
        const rock = buildRock(i + 3);
        const x = (rng() - 0.5) * 16;
        const z = 10 + rng() * 100;
        rock.position.set(x, world.heightAt(x, z), z);
        rock.scale.setScalar(0.5 + rng() * 0.9);
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

    // Vau
    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(48, 22),
        new THREE.MeshStandardMaterial({
            map: waterTexture(),
            color: 0x4aa0c8,
            transparent: true,
            opacity: 0.78,
            roughness: 0.2,
            metalness: 0.3
        })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -0.15, 122);
    world.group.add(water);
    world.waterMeshes.push(water);

    const fordMarker = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 2.2, 8),
        new THREE.MeshStandardMaterial({ color: 0xd8e8ff, emissive: 0x88aaff, emissiveIntensity: 1.2 })
    );
    fordMarker.position.set(0, 1.4, 124);
    world.group.add(fordMarker);
    world.addInteract({
        x: 0, z: 124, r: 3.2, id: 'ford', kind: 'goal',
        label: 'Atravessar o vau', mesh: fordMarker, done: false
    });
    world.goal = 'ford';

    const elf = buildElf({ robe: 0xd8e8f0 });
    elf.group.position.set(3.5, world.heightAt(3.5, 126), 126);
    world.group.add(elf.group);

    scatterGrass(world, Math.floor(400 * quality.grass), quality);
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

    world.group.add(terrainMesh(
        world.heightAt, 120, quality.id === 'low' ? 48 : 90,
        new THREE.MeshStandardMaterial({ map: mossTexture(), color: 0x6a9a58, roughness: 0.9 })
    ));

    const stream = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 90),
        new THREE.MeshStandardMaterial({
            map: waterTexture(),
            color: 0x6ad0e0,
            transparent: true,
            opacity: 0.8,
            roughness: 0.15,
            metalness: 0.25
        })
    );
    stream.rotation.x = -Math.PI / 2;
    stream.position.set(0, 0.05, 0);
    world.group.add(stream);
    world.waterMeshes.push(stream);

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

    // Quedas — partículas.
    const dropGeo = new THREE.SphereGeometry(0.07, 4, 4);
    const dropMat = new THREE.MeshBasicMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.55 });
    const drops = [];
    const nDrops = Math.floor(80 * quality.particles);
    for (let i = 0; i < nDrops; i++) {
        const m = new THREE.Mesh(dropGeo, dropMat);
        world.group.add(m);
        drops.push({ mesh: m, side: i % 2 ? -1 : 1, t: hash2(i, 4) });
    }
    world.updateFns.push((t) => {
        for (const d of drops) {
            const u = (t * 0.35 + d.t) % 1;
            const x = d.side * 36;
            const y = 16 - u * 18;
            const z = -4 + Math.sin((d.t + t) * 8) * 0.4;
            d.mesh.position.set(x, y, z);
        }
    });

    for (const sx of [-1, 1]) {
        const cliff = new THREE.Mesh(
            new THREE.BoxGeometry(8, 18, 28),
            new THREE.MeshStandardMaterial({ map: stoneTexture('#8aa0a8'), color: 0xc8d8d0, roughness: 0.85 })
        );
        cliff.position.set(sx * 40, 6, 0);
        world.group.add(cliff);
    }

    const rng = seeded(21);
    scatterTrees(world, () => buildOak({ autumn: true }), Math.floor(28 * quality.trees), rng, {
        minR: 14, maxR: 42, cx: 0, cz: 0, avoid: [{ x: 0, z: 8, r: 10 }, { x: 0, z: 18, r: 8 }]
    });
    scatterGrass(world, Math.floor(500 * quality.grass), quality);
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

    const floorMat = new THREE.MeshStandardMaterial({
        map: brickTexture(),
        color: 0x5a4a3a,
        roughness: 0.92
    });
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

    // Paredes e teto
    const wallMat = new THREE.MeshStandardMaterial({
        map: stoneTexture('#3a3028'),
        color: 0x3a3028,
        roughness: 0.95
    });
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
    for (let i = 0; i < pillarN; i++) {
        const z = 8 + i * 5.5;
        for (const sx of [-1, 1]) {
            const p = buildPillar(13);
            p.position.set(sx * 8.5, 0, z);
            world.group.add(p);
            world.addCollider(sx * 8.5, z, 1.0);
        }
    }

    // Tochas
    const torchCount = quality.lights ? 10 : 4;
    for (let i = 0; i < torchCount; i++) {
        const z = 6 + i * 9;
        const sx = i % 2 ? 1 : -1;
        const flame = new THREE.Mesh(
            new THREE.SphereGeometry(0.18, 8, 6),
            new THREE.MeshStandardMaterial({
                color: 0xffaa44,
                emissive: 0xff6622,
                emissiveIntensity: 3
            })
        );
        flame.position.set(sx * 15.5, 3.4, z);
        world.group.add(flame);
        if (quality.lights) {
            const light = new THREE.PointLight(0xff7a30, 2.2, 16, 2);
            light.position.copy(flame.position);
            world.group.add(light);
        }
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

    // Abismo
    const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 20),
        new THREE.MeshBasicMaterial({ color: 0xff4a12, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
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
            color: 0xffe8a0,
            emissive: 0xffaa44,
            emissiveIntensity: 0.8
        })
    );
    exit.position.set(0, 2.5, 104);
    world.group.add(exit);
    world.addInteract({
        x: 0, z: 104, r: 2.6, id: 'exit', kind: 'goal',
        label: 'Escapar das minas', mesh: exit, done: false
    });
    world.goal = 'exit';

    // A Sombra — aparece quando o jogador pisa na ponte.
    const shadow = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.ConeGeometry(2.4, 8, 6),
        new THREE.MeshStandardMaterial({
            color: 0x1a0804,
            emissive: 0xff3300,
            emissiveIntensity: 0.45,
            roughness: 0.9
        })
    );
    body.position.y = 4;
    shadow.add(body);
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 6), std(0x2a1008, 0.8));
    hornL.position.set(-1.1, 8.2, 0);
    hornL.rotation.z = 0.5;
    shadow.add(hornL);
    const hornR = hornL.clone();
    hornR.position.x = 1.1;
    hornR.rotation.z = -0.5;
    shadow.add(hornR);
    const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.35, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffaa00, emissiveIntensity: 4 })
    );
    eye.position.set(0, 6.2, 1.4);
    shadow.add(eye);
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
        eye.scale.setScalar(1 + Math.sin(t * 8) * 0.15);
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

    world.group.add(terrainMesh(
        world.heightAt, 130, quality.id === 'low' ? 48 : 90,
        new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0x8a7a48, roughness: 0.92 })
    ));

    const river = new THREE.Mesh(
        new THREE.PlaneGeometry(40, 130),
        new THREE.MeshStandardMaterial({
            map: waterTexture(),
            color: 0x3a7aaa,
            transparent: true,
            opacity: 0.85,
            roughness: 0.18,
            metalness: 0.3
        })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.set(-42, -0.4, 0);
    world.group.add(river);
    world.waterMeshes.push(river);

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
    scatterTrees(world, () => buildOak({ autumn: true }), Math.floor(22 * quality.trees), rng, {
        minR: 12, maxR: 36, avoid: [{ x: 0, z: 0, r: 8 }]
    });
    scatterGrass(world, Math.floor(600 * quality.grass), quality);
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
