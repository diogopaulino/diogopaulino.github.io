/**
 * Cinco capítulos do conto: aldeia, trilha, rio, árvore oca, alvorecer.
 * Cada mundo vive num Group para ser trocado com fade.
 */

import * as THREE from 'three';
import { fbm, hash2, seeded, smoothstep } from './utils.js';
import { grassTexture, cobbleTexture, waterTexture } from './textures.js';
import { ROOT_COLORS, ROOT_ORDER, STORY } from './config.js';import {
    buildCottage, buildLampPost, buildHangingLantern, buildPine, buildOak,
    buildHollowTree, buildRootCrystal, buildBridge, buildMill, buildBuoy,
    buildCage, buildDawnStone, buildFence, buildMemory, buildFirefly,
    buildWell, buildVillager, buildFox, buildShadow, buildNight, buildGrandmother,
    grassBladeGeometry, std
} from './models.js';
import { ShadowWisp, NightWraith, FoxCompanion } from './npcs.js';

export class ChapterWorld {
    constructor() {
        this.group = new THREE.Group();
        this.colliders = [];
        this.interactables = [];
        this.lamps = [];
        this.shadows = [];
        this.fireflies = [];
        this.night = null;
        this.fox = null;
        this.goal = null;
        this.heightAt = () => 0;
        this.bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
        this.spawn = { x: 0, z: 0, yaw: 0 };
        this.updateFns = [];
        this.overview = new THREE.Vector3(16, 12, 20);
        this.waterMeshes = [];
        this.progress = {
            lamps: 0,
            lampsNeeded: 0,
            talked: false,
            foxFreed: false,
            crystals: [],
            placed: false
        };
        this.crystalOrder = ROOT_ORDER.slice();
    }

    addCollider(x, z, r) {
        this.colliders.push({ x, z, r });
    }

    addInteract(it) {
        this.interactables.push(it);
    }

    lampsLit() {
        return this.lamps.filter((l) => l.lit).length;
    }

    readyToExit() {
        if (this.progress.lampsNeeded > 0 && this.lampsLit() < this.progress.lampsNeeded) return false;
        if (this.needTalk && !this.progress.talked) return false;
        if (this.needFox && !this.progress.foxFreed) return false;
        if (this.needCrystals && this.progress.crystals.length < 4) return false;
        if (this.needPlace && !this.progress.placed) return false;
        return true;
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
    const { minR = 8, maxR = 48, minScale = 0.8, maxScale = 1.5, avoid = [], cx = 0, cz = 0 } = opts;
    for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = minR + rng() * (maxR - minR);
        const x = Math.cos(a) * r + cx;
        const z = Math.sin(a) * r + cz;
        if (avoid.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
        if (x < world.bounds.minX + 2 || x > world.bounds.maxX - 2) continue;
        const tree = proto();
        const s = minScale + rng() * (maxScale - minScale);
        tree.scale.setScalar(s);
        tree.position.set(x, world.heightAt(x, z), z);
        tree.rotation.y = rng() * Math.PI * 2;
        world.group.add(tree);
        world.addCollider(x, z, 0.5 * s);
    }
}

function scatterGrass(world, count) {
    const geo = grassBladeGeometry();
    const mat = new THREE.MeshStandardMaterial({
        color: 0x3a6a32,
        side: THREE.DoubleSide,
        roughness: 0.95
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const b = world.bounds;
    for (let i = 0; i < count; i++) {
        const x = b.minX + hash2(i, 1) * (b.maxX - b.minX);
        const z = b.minZ + hash2(i, 2) * (b.maxZ - b.minZ);
        dummy.position.set(x, world.heightAt(x, z), z);
        dummy.rotation.y = hash2(i, 3) * Math.PI * 2;
        dummy.scale.setScalar(0.7 + hash2(i, 4) * 0.85);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.receiveShadow = true;
    world.group.add(mesh);
}

function lightLamp(lamp) {
    if (lamp.lit) return false;
    lamp.lit = true;
    lamp.done = true;
    const L = lamp.lantern || lamp.mesh?.userData?.lantern;
    if (L) {
        if (L.userData.light) L.userData.light.intensity = 2.6;
        if (L.userData.flame) L.userData.flame.visible = true;
        if (L.userData.glass) L.userData.glass.material.emissiveIntensity = 1.1;
    }
    if (lamp.beacon) lamp.beacon.visible = false;
    return true;
}

function addLamp(world, x, z, builder, label = 'Acender o lampião') {
    const mesh = builder();
    mesh.position.set(x, world.heightAt(x, z), z);
    world.group.add(mesh);
    const lantern = mesh.userData.lantern;
    const lamp = {
        x, z, r: 1.9, kind: 'lamp', label, lit: false, done: false, mesh, lantern
    };
    const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.1, 0.35, 4.8, 8, 1, true),
        new THREE.MeshBasicMaterial({
            color: 0xffcc66,
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    beacon.position.set(x, world.heightAt(x, z) + 2.6, z);
    world.group.add(beacon);
    lamp.beacon = beacon;
    world.lamps.push(lamp);
    world.addInteract(lamp);
    world.addCollider(x, z, 0.28);
    return lamp;
}

function addMemory(world, x, z, id, label = 'Pegar a lembrança') {
    const mesh = buildMemory();
    const y = world.heightAt(x, z) + 0.85;
    mesh.position.set(x, y, z);
    world.group.add(mesh);
    const it = { x, z, r: 1.35, kind: 'memory', id, label, done: false, mesh };
    world.addInteract(it);
    world.updateFns.push((t) => {
        if (it.done) return;
        mesh.position.y = y + Math.sin(t * 2.2) * 0.12;
        mesh.rotation.y = t * 0.9;
    });
    return it;
}

function addFireflies(world, count, rng) {
    for (let i = 0; i < count; i++) {
        const x = world.bounds.minX + 4 + rng() * (world.bounds.maxX - world.bounds.minX - 8);
        const z = world.bounds.minZ + 4 + rng() * (world.bounds.maxZ - world.bounds.minZ - 8);
        const mesh = buildFirefly();
        const y0 = world.heightAt(x, z) + 0.7 + rng() * 0.8;
        mesh.position.set(x, y0, z);
        world.group.add(mesh);
        const fly = { x, z, r: 1.1, kind: 'firefly', done: false, mesh, y0, phase: rng() * 6 };
        world.fireflies.push(fly);
        world.updateFns.push((t) => {
            if (fly.done) return;
            mesh.position.y = fly.y0 + Math.sin(t * 2.4 + fly.phase) * 0.22;
            mesh.position.x = x + Math.sin(t * 0.7 + fly.phase) * 0.35;
        });
    }
}

function addGoal(world, x, z, label, extra = {}) {
    const it = {
        x, z, r: extra.r || 2.2, kind: 'goal', label, done: false, locked: extra.locked !== false
    };
    world.goal = it;
    world.addInteract(it);
    if (extra.mesh) {
        extra.mesh.position.set(x, world.heightAt(x, z), z);
        world.group.add(extra.mesh);
        it.mesh = extra.mesh;
    }
    const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.55, 7.5, 8, 1, true),
        new THREE.MeshBasicMaterial({
            color: extra.color || 0x88ddff,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    beacon.position.set(x, world.heightAt(x, z) + 4, z);
    world.group.add(beacon);
    it.beacon = beacon;
    return it;
}

function placeShadow(world, x, z, waypoints) {
    const mesh = buildShadow();
    world.group.add(mesh);
    const wisp = new ShadowWisp(mesh, x, z, waypoints);
    world.shadows.push(wisp);
    return wisp;
}

/* ================================================================== */
/* I — A Aldeia Apagada                                                */
/* ================================================================== */

function buildAldeia(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -36, maxX: 36, minZ: -40, maxZ: 32 };
    world.spawn = { x: 10, z: 16, yaw: -2.6 };
    world.overview.set(18, 13, 22);
    world.progress.lampsNeeded = 4;
    world.needTalk = true;

    world.heightAt = (x, z) => {
        const hills = fbm(x * 0.04, z * 0.04, 2) * 2.2;
        const plaza = 1 - smoothstep(6, 16, Math.hypot(x, z)) * 0.55;
        return hills * plaza;
    };

    world.group.add(terrainMesh(
        world.heightAt, 90, quality.id === 'low' ? 40 : 80,
        new THREE.MeshStandardMaterial({ map: grassTexture('#243a1c'), roughness: 0.95, color: 0x3a5a32 })
    ));

    const plaza = new THREE.Mesh(
        new THREE.CircleGeometry(8.5, 24),
        new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.9 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.04;
    plaza.receiveShadow = true;
    world.group.add(plaza);

    const home = buildCottage({ roof: 0x6a2a18, wall: 0xe8d2b0 });
    home.position.set(-10, world.heightAt(-10, -4), -4);
    world.group.add(home);
    world.addCollider(-10, -4, 2.1);

    const house2 = buildCottage({ roof: 0x4a3a28, wall: 0xd0c0a0 });
    house2.position.set(12, world.heightAt(12, -8), -8);
    house2.rotation.y = 0.4;
    world.group.add(house2);
    world.addCollider(12, -8, 2.0);

    const house3 = buildCottage({ roof: 0x5a4020, wall: 0xc8b898 });
    house3.position.set(-16, world.heightAt(-16, 10), 10);
    house3.rotation.y = -0.6;
    world.group.add(house3);
    world.addCollider(-16, 10, 2.0);

    const well = buildWell();
    well.position.set(0, world.heightAt(0, 0), 0);
    world.group.add(well);
    world.addCollider(0, 0, 0.9);

    addLamp(world, 6.2, 4.4, () => buildLampPost());
    addLamp(world, -5.4, 5.8, () => buildLampPost());
    addLamp(world, 7.5, -5.2, () => buildLampPost());
    addLamp(world, -6.8, -6.5, () => buildLampPost());

    const tomas = buildVillager();
    tomas.position.set(4.2, world.heightAt(4.2, 8.5), 8.5);
    tomas.rotation.y = 3.2;
    world.group.add(tomas);
    world.addCollider(4.2, 8.5, 0.5);
    world.addInteract({
        x: 4.2, z: 8.5, r: 1.8, kind: 'talk', id: 'tomas',
        speaker: 'Tomás, o padeiro',
        lines: STORY.tomas,
        label: 'Falar com Tomás',
        done: false
    });

    addMemory(world, -10, -2.2, 'carta', 'Ler a carta da Nara');

    const fenceZ = 14;
    for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        const f = buildFence(4.2);
        f.position.set(i * 4.4, world.heightAt(i * 4.4, fenceZ), fenceZ);
        world.group.add(f);
    }

    const rng = seeded(42);
    scatterTrees(world, buildOak, Math.round(10 * quality.trees), rng, {
        minR: 16, maxR: 34, avoid: [{ x: 0, z: 0, r: 12 }, { x: -10, z: -4, r: 6 }]
    });
    if (quality.grass > 0) scatterGrass(world, Math.round(280 * quality.grass));
    addFireflies(world, Math.round(6 * quality.particles), rng);

    addGoal(world, 0, -32, 'Seguir para a floresta', { locked: true, color: 0x88aaff });
    const archL = buildPine();
    archL.position.set(-3.2, world.heightAt(-3.2, -32), -32);
    const archR = buildPine();
    archR.position.set(3.2, world.heightAt(3.2, -32), -32);
    world.group.add(archL, archR);
    world.addCollider(-3.2, -32, 0.7);
    world.addCollider(3.2, -32, 0.7);

    return world;
}

/* ================================================================== */
/* II — A Trilha das Sombras                                           */
/* ================================================================== */

function buildTrilha(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -22, maxX: 22, minZ: -36, maxZ: 28 };
    world.spawn = { x: 0, z: 22, yaw: Math.PI };
    world.overview.set(8, 10, 18);
    world.progress.lampsNeeded = 5;

    world.heightAt = (x, z) => fbm(x * 0.05, z * 0.05, 7) * 2.8 + Math.sin(z * 0.08) * 0.4;

    world.group.add(terrainMesh(
        world.heightAt, 80, quality.id === 'low' ? 36 : 72,
        new THREE.MeshStandardMaterial({ map: grassTexture('#1a2e18'), roughness: 0.96, color: 0x243a22 })
    ));

    const pathZ = [18, 8, -2, -12, -22];
    const pathX = [0, 3.5, -2.2, 1.8, 0];
    pathZ.forEach((z, i) => {
        addLamp(world, pathX[i], z, () => buildHangingLantern([0xffb347, 0xff8a5a, 0xffe066, 0xff9f43, 0xffc878][i]),
            'Acender a lanterna da trilha');
    });

    const rng = seeded(91);
    scatterTrees(world, buildPine, Math.round(28 * quality.trees), rng, {
        minR: 5, maxR: 26, cx: 0, cz: -4,
        avoid: pathZ.map((z, i) => ({ x: pathX[i], z, r: 3.2 }))
    });
    if (quality.grass > 0) scatterGrass(world, Math.round(180 * quality.grass));
    addFireflies(world, Math.round(10 * quality.particles), rng);

    placeShadow(world, -8, 10, [{ x: -8, z: 10 }, { x: 6, z: 6 }, { x: -4, z: 0 }]);
    placeShadow(world, 7, -6, [{ x: 7, z: -6 }, { x: -6, z: -10 }, { x: 4, z: -16 }]);
    placeShadow(world, -5, -18, [{ x: -5, z: -18 }, { x: 5, z: -20 }, { x: 0, z: -12 }]);

    const mill = buildMill();
    mill.position.set(0, world.heightAt(0, -30), -30);
    world.group.add(mill);
    world.addCollider(0, -30, 1.8);
    world.updateFns.push((t) => {
        if (mill.userData.hub) mill.userData.hub.rotation.z = t * 0.35;
    });
    addMemory(world, 3.5, -28, 'moinho', 'Pegar o pão que Tomás deu');
    addGoal(world, 0, -33.5, 'Passar pelo moinho', { locked: true, color: 0xffaa66 });

    return world;
}

/* ================================================================== */
/* III — O Rio dos Nomes                                               */
/* ================================================================== */

function buildRio(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -30, maxX: 32, minZ: -20, maxZ: 20 };
    world.spawn = { x: -22, z: 4, yaw: 1.2 };
    world.overview.set(20, 12, 8);
    world.progress.lampsNeeded = 3;
    world.needFox = true;

    world.heightAt = (x, z) => {
        const bank = smoothstep(4.5, 9, Math.abs(z)) * (1.1 + fbm(x * 0.04, z * 0.04, 3) * 1.6);
        return bank;
    };

    world.group.add(terrainMesh(
        world.heightAt, 80, quality.id === 'low' ? 40 : 80,
        new THREE.MeshStandardMaterial({ map: grassTexture('#1e3a28'), roughness: 0.95, color: 0x2a4a38 })
    ));

    const water = new THREE.Mesh(
        new THREE.PlaneGeometry(70, 9, 20, 4),
        new THREE.MeshStandardMaterial({
            map: waterTexture(),
            color: 0x3a7088,
            roughness: 0.22,
            metalness: 0.35,
            transparent: true,
            opacity: 0.88
        })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.15;
    world.group.add(water);
    world.waterMeshes.push(water);

    addLamp(world, -8, 0.2, () => buildBuoy(), 'Acender a bóia');
    addLamp(world, 2, -0.4, () => buildBuoy(), 'Acender a bóia');
    addLamp(world, 12, 0.5, () => buildBuoy(), 'Acender a bóia');

    const mill = buildMill();
    mill.position.set(-18, world.heightAt(-18, 8), 8);
    mill.scale.setScalar(0.75);
    world.group.add(mill);
    world.addCollider(-18, 8, 1.4);
    world.updateFns.push((t) => {
        if (mill.userData.hub) mill.userData.hub.rotation.z = t * 0.4;
    });

    const cage = buildCage();
    cage.position.set(6, world.heightAt(6, 8.5) , 8.5);
    world.group.add(cage);
    world.addCollider(6, 8.5, 0.7);

    const foxMesh = buildFox();
    foxMesh.position.set(6, world.heightAt(6, 8.5), 8.5);
    world.group.add(foxMesh);
    world.fox = new FoxCompanion(foxMesh, 6, 8.5);
    world.addInteract({
        x: 6, z: 8.5, r: 1.8, kind: 'cage',
        label: 'Libertar Pingo (pulse a lanterna perto)',
        done: false, mesh: cage
    });

    const rng = seeded(17);
    scatterTrees(world, buildOak, Math.round(12 * quality.trees), rng, {
        minR: 10, maxR: 28, cz: 12, avoid: [{ x: 6, z: 8.5, r: 4 }]
    });
    scatterTrees(world, buildPine, Math.round(8 * quality.trees), rng, {
        minR: 8, maxR: 24, cz: -12
    });
    addFireflies(world, Math.round(8 * quality.particles), rng);
    placeShadow(world, 0, 10, [{ x: -6, z: 10 }, { x: 8, z: 12 }, { x: 2, z: 7 }]);

    const bridge = buildBridge();
    bridge.position.set(20, 0.2, 0);
    bridge.rotation.y = Math.PI / 2;
    world.group.add(bridge);
    world.bridge = bridge;
    bridge.visible = false;

    addMemory(world, -16, 6, 'canto', 'Ouvir a canção do rio');
    addGoal(world, 26, 0, 'Atravessar para a outra margem', { locked: true, color: 0xa0e8ff });

    return world;
}

/* ================================================================== */
/* IV — A Árvore Oca                                                   */
/* ================================================================== */

function buildArvore(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -24, maxX: 24, minZ: -24, maxZ: 24 };
    world.spawn = { x: 0, z: 18, yaw: Math.PI };
    world.overview.set(14, 16, 16);
    world.needCrystals = true;
    world.progress.crystals = [];

    world.heightAt = (x, z) => {
        const d = Math.hypot(x, z);
        return fbm(x * 0.05, z * 0.05, 11) * 1.8 + smoothstep(18, 4, d) * 1.2;
    };

    world.group.add(terrainMesh(
        world.heightAt, 60, quality.id === 'low' ? 32 : 64,
        new THREE.MeshStandardMaterial({ map: grassTexture('#241828'), roughness: 0.96, color: 0x2a1a28 })
    ));

    const tree = buildHollowTree();
    tree.position.set(0, world.heightAt(0, 0) - 0.2, 0);
    world.group.add(tree);
    world.addCollider(0, 0, 2.4);

    const spots = [
        { x: -7.5, z: 4.2, i: 0 },
        { x: 7.2, z: 3.8, i: 1 },
        { x: 6.4, z: -6.5, i: 2 },
        { x: -6.8, z: -5.8, i: 3 }
    ];
    spots.forEach((s) => {
        const mesh = buildRootCrystal(ROOT_COLORS[s.i]);
        mesh.position.set(s.x, world.heightAt(s.x, s.z), s.z);
        world.group.add(mesh);
        world.addInteract({
            x: s.x, z: s.z, r: 1.7, kind: 'crystal', index: s.i,
            label: `Acender a raiz ${['dourada', 'azul', 'rosa', 'verde'][s.i]}`,
            done: false, mesh, lit: false
        });
        world.addCollider(s.x, s.z, 0.4);
    });

    const nightMesh = buildNight();
    world.group.add(nightMesh);
    world.night = new NightWraith(nightMesh, 0, 0, 11);

    const rng = seeded(5);
    scatterTrees(world, buildPine, Math.round(14 * quality.trees), rng, {
        minR: 12, maxR: 22, avoid: [{ x: 0, z: 0, r: 10 }]
    });
    addFireflies(world, Math.round(12 * quality.particles), rng);
    addMemory(world, 0, 3.4, 'xale', 'Pegar o xale da Nara');
    addGoal(world, 0, 3.2, 'Entrar no oco da árvore', { locked: true, r: 1.8, color: 0xff88cc });

    return world;
}

/* ================================================================== */
/* V — O Primeiro Sol                                                  */
/* ================================================================== */

function buildAlvorecer(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };
    world.spawn = { x: 0, z: 20, yaw: Math.PI };
    world.overview.set(16, 14, 22);
    world.needPlace = true;

    world.heightAt = (x, z) => {
        const d = Math.hypot(x, z);
        return smoothstep(22, 0, d) * 7.5 + fbm(x * 0.03, z * 0.03, 4) * 1.1;
    };

    world.group.add(terrainMesh(
        world.heightAt, 70, quality.id === 'low' ? 40 : 80,
        new THREE.MeshStandardMaterial({ map: grassTexture('#4a6a28'), roughness: 0.92, color: 0x7aaa48 })
    ));

    const stone = buildDawnStone();
    stone.position.set(0, world.heightAt(0, 0), 0);
    world.group.add(stone);
    world.addCollider(0, 0, 1.3);
    world.addInteract({
        x: 0, z: 0, r: 2.1, kind: 'place',
        label: 'Colocar a lanterna na Pedra da Aurora',
        done: false, mesh: stone
    });

    const nara = buildGrandmother();
    nara.position.set(-2.4, world.heightAt(-2.4, -1.5), -1.5);
    nara.visible = false;
    world.group.add(nara);
    world.nara = nara;

    const rng = seeded(3);
    scatterTrees(world, buildOak, Math.round(8 * quality.trees), rng, {
        minR: 12, maxR: 24, avoid: [{ x: 0, z: 0, r: 8 }]
    });
    if (quality.grass > 0) scatterGrass(world, Math.round(320 * quality.grass));
    addFireflies(world, Math.round(14 * quality.particles), rng);
    addMemory(world, 4.5, 6, 'sol', 'Uma última lembrança');

    const foxMesh = buildFox();
    world.group.add(foxMesh);
    world.fox = new FoxCompanion(foxMesh, 1.5, 18);
    world.fox.free();

    return world;
}

export function lightWorldLamp(world, lamp) {
    return lightLamp(lamp);
}

export function revealBridge(world) {
    if (world.bridge) world.bridge.visible = true;
}

export function lightCrystal(it) {
    it.lit = true;
    it.done = true;
    const c = it.mesh?.userData?.crystal;
    if (c) {
        c.material.emissiveIntensity = 1.8;
        c.scale.setScalar(1.25);
    }
}

export function resetCrystals(world) {
    world.progress.crystals = [];
    for (const it of world.interactables) {
        if (it.kind !== 'crystal') continue;
        it.lit = false;
        it.done = false;
        const c = it.mesh?.userData?.crystal;
        if (c) {
            c.material.emissiveIntensity = 0.15;
            c.scale.setScalar(1);
        }
    }
}

export function buildChapter(id, quality) {
    if (id === 'aldeia') return buildAldeia(quality);
    if (id === 'trilha') return buildTrilha(quality);
    if (id === 'rio') return buildRio(quality);
    if (id === 'arvore') return buildArvore(quality);
    return buildAlvorecer(quality);
}
