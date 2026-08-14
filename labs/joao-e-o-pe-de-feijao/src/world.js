/**
 * Cinco capítulos do conto: cabana, feira, noite/pé, castelo nas nuvens e fuga.
 * Cada um devolve um ChapterWorld com colisores, plataformas, climbs e interações.
 */

import * as THREE from 'three';
import { fbm, hash2, seeded, smoothstep } from './utils.js';
import { grassTexture, dirtTexture, stoneTexture, cloudTexture } from './textures.js';
import {
    buildCottage, buildFence, buildTree, buildStall, buildBeanstalk, buildCloudIsland,
    buildCastle, buildTable, buildGoldBag, buildHen, buildHarp, buildAxe, buildWell,
    buildMother, buildMerchant, buildCow, buildGiant, grassBladeGeometry, applyGrassWind,
    makeBeacon, std
} from './models.js';
import { CowAI, GiantAI } from './npcs.js';

export class ChapterWorld {
    constructor() {
        this.group = new THREE.Group();
        this.colliders = [];
        this.interactables = [];
        this.platforms = [];
        this.climbs = [];
        this.particles = [];
        this.heightAt = () => 0;
        this.bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
        this.spawn = { x: 0, z: 0, yaw: 0 };
        this.updateFns = [];
        this.overview = new THREE.Vector3(16, 12, 20);
        this.voidY = -12;
        this.flags = {};
        this.cow = null;
        this.giant = null;
        this.stalk = null;
        this.chop = 0;
        this.chopNeeded = 8;
    }

    addCollider(x, z, r, extra = {}) {
        this.colliders.push({ x, z, r, ...extra });
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

function scatterTrees(world, count, rng, opts) {
    const { minR = 10, maxR = 42, avoid = [] } = opts;
    for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = minR + rng() * (maxR - minR);
        const x = Math.cos(a) * r + (opts.cx || 0);
        const z = Math.sin(a) * r + (opts.cz || 0);
        if (avoid.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
        if (x < world.bounds.minX + 3 || x > world.bounds.maxX - 3) continue;
        const tree = buildTree(rng);
        const s = 0.85 + rng() * 0.7;
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
        color: 0x4a9a32,
        side: THREE.DoubleSide,
        roughness: 0.95
    });
    applyGrassWind(mat);
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const dummy = new THREE.Object3D();
    const b = world.bounds;
    for (let i = 0; i < count; i++) {
        const x = b.minX + hash2(i, 1) * (b.maxX - b.minX);
        const z = b.minZ + hash2(i, 2) * (b.maxZ - b.minZ);
        dummy.position.set(x, world.heightAt(x, z), z);
        dummy.rotation.y = hash2(i, 3) * Math.PI * 2;
        dummy.scale.setScalar(0.7 + hash2(i, 4) * 0.9);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.receiveShadow = true;
    world.group.add(mesh);
    world.updateFns.push((t) => {
        if (mat.userData.uTime) mat.userData.uTime.value = t;
    });
}

function placeBeacon(world, x, z, color) {
    const beacon = makeBeacon(color);
    beacon.position.set(x, world.heightAt(x, z) + 3.0, z);
    world.group.add(beacon);
    return beacon;
}

function addPath(world, from, to, width = 2.4) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    const geo = new THREE.PlaneGeometry(width, len, 1, 8);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        map: dirtTexture(), color: 0xc4a06a, roughness: 0.95
    }));
    mesh.position.set((from.x + to.x) / 2, 0.04, (from.z + to.z) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.receiveShadow = true;
    world.group.add(mesh);
}

/* ================================================================== */
/* I — A Cabana                                                        */
/* ================================================================== */

export function buildCottageChapter(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -46, maxX: 46, minZ: -46, maxZ: 46 };
    world.spawn = { x: 6, z: 10, yaw: -2.6 };
    world.overview.set(18, 11, 22);
    world.flags = { talkedMother: false, hasCow: false };

    world.heightAt = (x, z) => {
        const hills = fbm(x * 0.04, z * 0.04, 4) * 2.4
            + Math.sin(x * 0.05) * 0.6
            + Math.cos(z * 0.04) * 0.5;
        const yard = smoothstep(14, 4, Math.hypot(x + 4, z + 2));
        return hills * (1 - yard * 0.7);
    };

    const segs = quality.id === 'low' ? 40 : 80;
    world.group.add(terrainMesh(
        world.heightAt, 100, segs,
        new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.95, color: 0x8fbc5a })
    ));

    const cottage = buildCottage();
    cottage.position.set(-6, world.heightAt(-6, -4), -4);
    cottage.rotation.y = 0.25;
    world.group.add(cottage);
    world.addCollider(-6, -4, 3.1);

    const fenceA = buildFence(10);
    fenceA.position.set(2, world.heightAt(2, 2), 2);
    world.group.add(fenceA);

    const mother = buildMother();
    mother.position.set(-3.2, world.heightAt(-3.2, -1.2), -1.2);
    mother.rotation.y = 0.8;
    world.group.add(mother);
    world.addCollider(-3.2, -1.2, 0.55);
    world.addInteract({
        x: -3.2, z: -1.2, r: 1.8, id: 'mother', kind: 'talk',
        label: 'Falar com a mãe',
        speaker: 'Mãe',
        lines: [
            'João, a despensa está vazia. Não resta nem um punhado de farinha.',
            'Leve a Mimosa à feira. É tudo o que nos resta — e não aceite trocas estranhas.',
            'Volte antes do sol baixo. Eu cuido da cabana.'
        ]
    });

    const cowMesh = buildCow();
    const cow = new CowAI(cowMesh, 4.5, 3.2);
    cowMesh.position.set(4.5, world.heightAt(4.5, 3.2), 3.2);
    world.group.add(cowMesh);
    world.cow = cow;
    world.addInteract({
        r: 1.7, id: 'cow', kind: 'cow',
        label: 'Chamar a Mimosa',
        get x() { return cow.x; },
        get z() { return cow.z; }
    });

    const gateX = 22;
    const gateZ = 8;
    const beacon = placeBeacon(world, gateX, gateZ, 0x88ff66);
    world.gateBeacon = beacon;
    world.addInteract({
        x: gateX, z: gateZ, r: 2.4, id: 'gate', kind: 'goal',
        label: 'Seguir para a feira'
    });

    const well = buildWell();
    well.position.set(1.5, world.heightAt(1.5, -6), -6);
    world.group.add(well);
    world.addCollider(1.5, -6, 0.95);

    const rng = seeded(21);
    scatterTrees(world, Math.round(18 * quality.trees), rng, {
        minR: 16, maxR: 42, avoid: [{ x: -6, z: -4, r: 8 }, { x: 4.5, z: 3.2, r: 4 }, { x: 22, z: 8, r: 5 }]
    });
    scatterGrass(world, Math.round(420 * quality.grass));
    addPath(world, { x: -2, z: 0 }, { x: gateX, z: gateZ });

    world.updateFns.push((t, dt) => {
        // cow follow is driven from main via world.cow.update
        mother.position.y = world.heightAt(-3.2, -1.2) + Math.sin(t * 1.1) * 0.01;
        if (world.flags.hasCow) beacon.visible = true;
        beacon.rotation.y = t * 0.4;
    });

    return world;
}

/* ================================================================== */
/* II — A Feira                                                        */
/* ================================================================== */

export function buildFairChapter(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
    world.spawn = { x: -16, z: 14, yaw: 0.4 };
    world.overview.set(20, 12, 18);
    world.flags = { sold: false };

    world.heightAt = (x, z) => fbm(x * 0.03, z * 0.03, 8) * 1.1 * (1 - smoothstep(6, 18, Math.hypot(x, z)) * 0.4);

    world.group.add(terrainMesh(
        world.heightAt, 90, quality.id === 'low' ? 36 : 72,
        new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0xc4b070, roughness: 0.92 })
    ));

    const plaza = new THREE.Mesh(
        new THREE.CircleGeometry(11, 24),
        new THREE.MeshStandardMaterial({ map: dirtTexture(), color: 0xd8b878, roughness: 0.9 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.05;
    plaza.receiveShadow = true;
    world.group.add(plaza);

    const colors = [0xc43a2a, 0x2a6aaa, 0xd4a020, 0x2e7a3a, 0x7a3aaa];
    const stalls = [
        { x: -6, z: -4, y: 1.2 },
        { x: 6, z: -5, y: -0.4 },
        { x: -7, z: 5, y: 2.2 },
        { x: 7, z: 4, y: 0.6 },
        { x: 0, z: -8, y: 0 }
    ];
    stalls.forEach((s, i) => {
        const st = buildStall(colors[i]);
        st.position.set(s.x, world.heightAt(s.x, s.z), s.z);
        st.rotation.y = s.y;
        world.group.add(st);
        world.addCollider(s.x, s.z, 1.15);
    });

    const fountain = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.6, 0.5, 16),
        new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.7 })
    );
    fountain.position.y = 0.25;
    world.group.add(fountain);
    const water = new THREE.Mesh(
        new THREE.CircleGeometry(1.1, 16),
        std(0x4aa0c8, 0.2, 0.25, { transparent: true, opacity: 0.75 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.52;
    world.group.add(water);
    world.addCollider(0, 0, 1.5);

    const merchant = buildMerchant();
    merchant.position.set(0, world.heightAt(0, 12), 12);
    merchant.rotation.y = Math.PI;
    world.group.add(merchant);
    world.addCollider(0, 12, 0.7);
    const beanGlow = makeBeacon(0xaa66ff);
    beanGlow.position.set(0, 3.4, 12);
    world.group.add(beanGlow);

    world.addInteract({
        x: 0, z: 12, r: 2.0, id: 'merchant', kind: 'talk',
        label: 'Falar com o mercador',
        speaker: 'Mercador',
        lines: [
            'Essa vaca tem olhar de quem já andou longe.',
            'Não ofereço moedas. Ofereço cinco feijões que dormem no bolso e acordam na terra.',
            'Plante-os ao relento. O resto… o céu decide.'
        ]
    });

    const cowMesh = buildCow();
    const cow = new CowAI(cowMesh, -14, 12);
    cow.follow = true;
    world.group.add(cowMesh);
    world.cow = cow;

    const rng = seeded(44);
    scatterTrees(world, Math.round(12 * quality.trees), rng, {
        minR: 16, maxR: 36, avoid: [{ x: 0, z: 0, r: 14 }, { x: 0, z: 12, r: 5 }]
    });
    scatterGrass(world, Math.round(280 * quality.grass));

    world.updateFns.push((t) => {
        beanGlow.rotation.y = t * 0.5;
        merchant.position.y = world.heightAt(0, 12) + Math.sin(t * 1.3) * 0.02;
    });

    return world;
}

/* ================================================================== */
/* III — A Noite / o pé                                                */
/* ================================================================== */

export function buildNightChapter(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -36, maxX: 36, minZ: -36, maxZ: 36 };
    world.spawn = { x: 8, z: 10, yaw: -2.4 };
    world.overview.set(14, 18, 18);
    world.voidY = -8;
    world.flags = { talkedMother: false, growing: false, grown: false, growT: 0 };

    world.heightAt = (x, z) => {
        const hills = fbm(x * 0.045, z * 0.045, 3) * 1.8;
        const yard = smoothstep(12, 3, Math.hypot(x + 2, z));
        return hills * (1 - yard * 0.75);
    };

    world.group.add(terrainMesh(
        world.heightAt, 80, quality.id === 'low' ? 36 : 70,
        new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0x2a5a28, roughness: 0.95 })
    ));

    const cottage = buildCottage();
    cottage.position.set(-8, world.heightAt(-8, -3), -3);
    world.group.add(cottage);
    world.addCollider(-8, -3, 3.1);

    const mother = buildMother();
    mother.position.set(-5.4, world.heightAt(-5.4, -0.6), -0.6);
    mother.rotation.y = 0.5;
    world.group.add(mother);
    world.addCollider(-5.4, -0.6, 0.55);
    world.addInteract({
        x: -5.4, z: -0.6, r: 1.8, id: 'mother', kind: 'talk',
        label: 'Falar com a mãe',
        speaker: 'Mãe',
        lines: [
            'Feijões? João, vendemos a Mimosa por feijões?',
            'Joguei tudo pela janela. Durma. Amanhã pensamos no pão.',
            '…O que é esse farfalhar no quintal?'
        ]
    });

    const patchX = 2.2;
    const patchZ = 4.5;
    const dirt = new THREE.Mesh(
        new THREE.CircleGeometry(1.6, 16),
        new THREE.MeshStandardMaterial({ map: dirtTexture(), color: 0x5a3a18, roughness: 0.95 })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(patchX, world.heightAt(patchX, patchZ) + 0.05, patchZ);
    world.group.add(dirt);

    const beans = [];
    for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(
            new THREE.SphereGeometry(0.08, 8, 6),
            std(0x6a2aaa, 0.5, 0.1, { emissive: 0x4a1888, emissiveIntensity: 0.7 })
        );
        const a = (i / 5) * Math.PI * 2;
        b.position.set(patchX + Math.cos(a) * 0.35, world.heightAt(patchX, patchZ) + 0.12, patchZ + Math.sin(a) * 0.35);
        world.group.add(b);
        beans.push(b);
    }

    const stalkBuild = buildBeanstalk(72, quality.id);
    stalkBuild.group.position.set(patchX, world.heightAt(patchX, patchZ), patchZ);
    stalkBuild.group.scale.set(1, 0.02, 1);
    stalkBuild.group.visible = false;
    world.group.add(stalkBuild.group);
    world.stalk = stalkBuild;

    const climb = {
        x: patchX, z: patchZ, r: 1.65, hold: 0.95,
        yMin: world.heightAt(patchX, patchZ), yMax: 72, locked: true
    };
    world.climbs.push(climb);

    world.addInteract({
        x: patchX, z: patchZ, r: 1.9, id: 'beans', kind: 'plant',
        label: 'Olhar os feijões no quintal'
    });

    const topY = 72;
    world.addInteract({
        x: patchX, z: patchZ, r: 2.8, y: topY, yReach: 10, id: 'clouds', kind: 'goal',
        label: 'Entrar nas nuvens'
    });

    const moon = new THREE.Mesh(
        new THREE.SphereGeometry(3.2, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xf0f4ff })
    );
    moon.position.set(-18, 28, -22);
    world.group.add(moon);
    const moonLight = new THREE.PointLight(0xaaccff, 1.4, 80);
    moonLight.position.copy(moon.position);
    world.group.add(moonLight);

    const rng = seeded(9);
    scatterTrees(world, Math.round(14 * quality.trees), rng, {
        minR: 12, maxR: 32, avoid: [{ x: -8, z: -3, r: 7 }, { x: patchX, z: patchZ, r: 5 }]
    });

    const fireflies = [];
    const fCount = Math.round(40 * quality.particles);
    const fGeo = new THREE.SphereGeometry(0.05, 6, 4);
    const fMat = new THREE.MeshBasicMaterial({ color: 0xd4ff6a });
    for (let i = 0; i < fCount; i++) {
        const m = new THREE.Mesh(fGeo, fMat);
        m.position.set((rng() - 0.5) * 30, 1 + rng() * 4, (rng() - 0.5) * 30);
        world.group.add(m);
        fireflies.push({ m, ox: m.position.x, oz: m.position.z, ph: rng() * 6 });
    }

    world.growStalk = () => {
        world.flags.growing = true;
        world.flags.growT = 0;
        stalkBuild.group.visible = true;
        beans.forEach((b) => { b.visible = false; });
    };

    world.updateFns.push((t, dt) => {
        fireflies.forEach((f) => {
            f.m.position.x = f.ox + Math.sin(t * 0.7 + f.ph) * 1.2;
            f.m.position.z = f.oz + Math.cos(t * 0.5 + f.ph) * 1.2;
            f.m.position.y = 1.2 + Math.sin(t * 2 + f.ph) * 0.8;
        });
        if (world.flags.growing && !world.flags.grown) {
            world.flags.growT += dt;
            const k = smoothstep(0, 4.2, world.flags.growT);
            stalkBuild.group.scale.set(1, 0.02 + k * 0.98, 1);
            if (k >= 1) {
                world.flags.grown = true;
                climb.locked = false;
                const baseY = world.heightAt(patchX, patchZ);
                for (const p of stalkBuild.platforms) {
                    world.platforms.push({
                        x: patchX + p.x,
                        z: patchZ + p.z,
                        y: baseY + p.y,
                        r: p.r
                    });
                }
            }
        }
        beans.forEach((b, i) => {
            b.position.y = world.heightAt(patchX, patchZ) + 0.12 + Math.sin(t * 3 + i) * 0.04;
        });
    });

    return world;
}

/* ================================================================== */
/* IV — O Castelo nas nuvens                                           */
/* ================================================================== */

export function buildCastleChapter(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -34, maxX: 34, minZ: -28, maxZ: 38 };
    world.spawn = { x: 0, z: 24, yaw: Math.PI };
    world.overview.set(22, 16, 28);
    world.voidY = -6;
    world.flags = { gold: false, hen: false, harp: false };

    world.heightAt = (x, z) => (Math.hypot(x, z) > 29 ? -20 : 1.15);

    const island = buildCloudIsland(30);
    world.group.add(island);

    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(22, 28),
        new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xd0d6dc, roughness: 0.88 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 1.15;
    floor.receiveShadow = true;
    world.group.add(floor);

    const castle = buildCastle();
    castle.position.set(0, 1.15, -4);
    world.group.add(castle);
    world.addCollider(0, -4, 8.5);
    world.addCollider(-7, 2, 1.8);
    world.addCollider(7, 2, 1.8);

    const hallFloor = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 16),
        new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xc8b090, roughness: 0.8 })
    );
    hallFloor.rotation.x = -Math.PI / 2;
    hallFloor.position.set(0, 1.18, 8);
    hallFloor.receiveShadow = true;
    world.group.add(hallFloor);

    const table = buildTable();
    table.position.set(0, 1.15, 6);
    world.group.add(table);
    world.addCollider(0, 6, 2.6);

    const giantBuilt = buildGiant();
    giantBuilt.group.scale.setScalar(1.15);
    const giant = new GiantAI(giantBuilt.group, giantBuilt.parts, 0, 5.2, 1.15);
    giant.yaw = 0.2;
    giantBuilt.group.rotation.y = 0.2;
    world.group.add(giantBuilt.group);
    world.giant = giant;

    const gold = buildGoldBag();
    gold.position.set(-4.6, 2.15, 8.4);
    world.group.add(gold);
    world.addInteract({
        x: -4.6, z: 8.4, y: 2.15, r: 1.5, id: 'gold', kind: 'treasure',
        label: 'Pegar o saco de ouro', mesh: gold
    });

    const hen = buildHen();
    hen.position.set(5.2, 1.45, 11.5);
    world.group.add(hen);
    world.addInteract({
        x: 5.2, z: 11.5, y: 1.45, r: 1.5, id: 'hen', kind: 'treasure',
        label: 'Pegar a galinha dourada', mesh: hen
    });

    const harp = buildHarp();
    harp.position.set(0, 1.2, 14.2);
    world.group.add(harp);
    const harpLight = new THREE.PointLight(0xffdd66, 0.9, 8);
    harpLight.position.set(0, 2.4, 14.2);
    world.group.add(harpLight);
    world.addInteract({
        x: 0, z: 14.2, y: 1.2, r: 1.6, id: 'harp', kind: 'treasure',
        label: 'Pegar a harpa que canta', mesh: harp
    });

    const candles = [];
    for (const [x, z] of [[-6, 2], [6, 2], [-5, 12], [5, 12]]) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8), std(0x8a6a28, 0.6));
        s.position.set(x, 1.6, z);
        world.group.add(s);
        const flame = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 6, 5),
            new THREE.MeshBasicMaterial({ color: 0xffcc66 })
        );
        flame.position.set(x, 2.15, z);
        world.group.add(flame);
        candles.push(flame);
    }

    world.updateFns.push((t) => {
        hen.rotation.y = t * 0.6;
        hen.position.y = 1.45 + Math.sin(t * 2) * 0.08;
        gold.rotation.y = t * 0.4;
        gold.position.y = 2.15 + Math.sin(t * 2.2) * 0.06;
        harp.rotation.y = Math.sin(t * 1.4) * 0.15;
        candles.forEach((c, i) => {
            c.scale.setScalar(0.85 + Math.sin(t * 8 + i) * 0.18);
        });
    });

    return world;
}

/* ================================================================== */
/* V — A Fuga                                                          */
/* ================================================================== */

export function buildEscapeChapter(quality) {
    const world = new ChapterWorld();
    world.bounds = { minX: -36, maxX: 36, minZ: -36, maxZ: 36 };
    world.spawn = { x: 2.2, z: 6.2, yaw: Math.PI, y: 68 };
    world.overview.set(16, 22, 20);
    world.voidY = -10;
    world.flags = { hasAxe: false, chopped: false };
    world.chop = 0;

    world.heightAt = (x, z) => {
        const hills = fbm(x * 0.04, z * 0.04, 5) * 1.6;
        const yard = smoothstep(12, 3, Math.hypot(x + 2, z));
        return hills * (1 - yard * 0.7);
    };

    world.group.add(terrainMesh(
        world.heightAt, 80, quality.id === 'low' ? 36 : 70,
        new THREE.MeshStandardMaterial({ map: grassTexture(), color: 0x7aaa48, roughness: 0.95 })
    ));

    const cottage = buildCottage();
    cottage.position.set(-8, world.heightAt(-8, -3), -3);
    world.group.add(cottage);
    world.addCollider(-8, -3, 3.1);

    const patchX = 2.2;
    const patchZ = 4.5;
    const stalkBuild = buildBeanstalk(72, quality.id);
    const baseY = world.heightAt(patchX, patchZ);
    stalkBuild.group.position.set(patchX, baseY, patchZ);
    world.group.add(stalkBuild.group);
    world.stalk = stalkBuild;
    world.climbs.push({
        x: patchX, z: patchZ, r: 1.7, hold: 0.95,
        yMin: baseY, yMax: 72, locked: false
    });
    for (const p of stalkBuild.platforms) {
        world.platforms.push({
            x: patchX + p.x,
            z: patchZ + p.z,
            y: baseY + p.y,
            r: p.r
        });
    }

    const axe = buildAxe();
    axe.position.set(-4.2, world.heightAt(-4.2, 1.4) + 0.55, 1.4);
    axe.rotation.z = 0.4;
    world.group.add(axe);
    world.addInteract({
        x: -4.2, z: 1.4, r: 1.6, id: 'axe', kind: 'axe',
        label: 'Pegar o machado', mesh: axe
    });

    world.addInteract({
        x: patchX, z: patchZ, r: 2.0, id: 'chop', kind: 'chop',
        label: 'Cortar o pé de feijão'
    });

    const giantBuilt = buildGiant();
    giantBuilt.group.scale.setScalar(1.05);
    const giant = new GiantAI(giantBuilt.group, giantBuilt.parts, patchX, patchZ, 78);
    giant.state = 'chase';
    giant.alert = 1;
    world.group.add(giantBuilt.group);
    world.giant = giant;
    world.stalkX = patchX;
    world.stalkZ = patchZ;

    const mother = buildMother();
    mother.position.set(-5.8, world.heightAt(-5.8, -0.8), -0.8);
    world.group.add(mother);
    world.addCollider(-5.8, -0.8, 0.5);

    scatterGrass(world, Math.round(220 * quality.grass));

    world.updateFns.push((t) => {
        if (world.flags.chopped && stalkBuild.group.visible) {
            stalkBuild.group.rotation.z = Math.min(1.2, (stalkBuild.group.userData.fall || 0));
        }
        axe.rotation.y = t * 0.5;
    });

    return world;
}

export function buildChapter(id, quality) {
    switch (id) {
        case 'cottage': return buildCottageChapter(quality);
        case 'fair': return buildFairChapter(quality);
        case 'night': return buildNightChapter(quality);
        case 'castle': return buildCastleChapter(quality);
        case 'escape': return buildEscapeChapter(quality);
        default: return buildCottageChapter(quality);
    }
}
