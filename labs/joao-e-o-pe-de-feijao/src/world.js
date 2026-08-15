/**
 * Cinco capítulos do conto em Babylon.js: cabana, feira, noite/pé, castelo nas nuvens e fuga.
 * Cada um devolve um ChapterWorld com colisores, plataformas, climbs e interações.
 */

import { fbm, hash2, seeded, smoothstep, disposeNode } from './utils.js';
import { grassTexture, dirtTexture, stoneTexture } from './textures.js';
import {
    buildCottage, buildFence, buildTree, buildStall, buildBeanstalk, buildCloudIsland,
    buildCastle, buildTable, buildGoldBag, buildHen, buildHarp, buildAxe, buildWell,
    buildMother, buildMerchant, buildCow, buildGiant, makeBeacon, buildGateArch, std
} from './models.js';
import { CowAI, GiantAI } from './npcs.js';

const B = window.BABYLON;

export class ChapterWorld {
    constructor(scene) {
        this.scene = scene;
        this.root = new B.TransformNode('worldRoot', scene);
        this.group = this.root; // Compatibilidade com referências existentes
        this.colliders = [];
        this.interactables = [];
        this.platforms = [];
        this.climbs = [];
        this.particles = [];
        this.heightAt = () => 0;
        this.bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
        this.spawn = { x: 0, z: 0, yaw: 0 };
        this.updateFns = [];
        this.overview = new B.Vector3(16, 12, 20);
        this.voidY = -12;
        this.flags = {};
        this.cow = null;
        this.giant = null;
        this.stalk = null;
        this.chop = 0;
        this.chopNeeded = 8;
        this.disposables = [];
    }

    addCollider(x, z, r, extra = {}) {
        this.colliders.push({ x, z, r, ...extra });
    }

    addInteract(it) {
        this.interactables.push(it);
    }

    dispose() {
        this.disposables.forEach(d => {
            if (typeof d?.dispose === 'function') d.dispose();
        });
        this.disposables = [];
        disposeNode(this.root);
    }
}

function terrainMesh(scene, heightAt, size, segs, material, ox = 0, oz = 0) {
    const ground = B.MeshBuilder.CreateGround('terrain', {
        width: size,
        height: size,
        subdivisions: segs,
        updatable: true
    }, scene);

    const positions = ground.getVerticesData(B.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i] + ox;
        const z = positions[i + 2] + oz;
        positions[i + 1] = heightAt(x, z);
    }
    ground.setVerticesData(B.VertexBuffer.PositionKind, positions);
    const normals = [];
    B.VertexData.ComputeNormals(positions, ground.getIndices(), normals);
    ground.setVerticesData(B.VertexBuffer.NormalKind, normals);
    ground.position.set(ox, 0, oz);
    ground.material = material;
    ground.receiveShadows = true;
    return ground;
}

function scatterTrees(scene, world, count, rng, opts) {
    const { minR = 10, maxR = 42, avoid = [] } = opts;
    for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const r = minR + rng() * (maxR - minR);
        const x = Math.cos(a) * r + (opts.cx || 0);
        const z = Math.sin(a) * r + (opts.cz || 0);
        if (avoid.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) continue;
        if (x < world.bounds.minX + 3 || x > world.bounds.maxX - 3) continue;
        const tree = buildTree(scene, rng);
        tree.parent = world.root;
        const s = 0.85 + rng() * 0.7;
        tree.scaling.setAll(s);
        tree.position.set(x, world.heightAt(x, z), z);
        tree.rotation.y = rng() * Math.PI * 2;
        world.addCollider(x, z, 0.5 * s);
    }
}

function placeBeacon(scene, world, x, z, color) {
    const beacon = makeBeacon(scene, color);
    beacon.parent = world.root;
    beacon.position.set(x, world.heightAt(x, z) + 3.0, z);
    return beacon;
}

function addPath(scene, world, from, to, width = 2.4) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    const pathMesh = B.MeshBuilder.CreatePlane('path', { width, height: len }, scene);
    pathMesh.parent = world.root;
    pathMesh.rotation.x = Math.PI / 2;
    pathMesh.rotation.y = Math.atan2(dx, dz);
    pathMesh.position.set((from.x + to.x) / 2, 0.04, (from.z + to.z) / 2);

    const dirtTex = dirtTexture(scene);
    pathMesh.material = std(scene, 0xc4a06a, 0.95, 0.02, { map: dirtTex });
    pathMesh.receiveShadows = true;
    return pathMesh;
}

/* ================================================================== */
/* I — A Cabana                                                        */
/* ================================================================== */

export function buildCottageChapter(scene, quality) {
    const world = new ChapterWorld(scene);
    world.bounds = { minX: -46, maxX: 46, minZ: -46, maxZ: 46 };
    world.spawn = { x: 6, z: 10, yaw: -2.6 };
    world.overview.copyFromFloats(18, 10, 16);
    world.flags = { talkedMother: false, hasCow: false };

    world.heightAt = (x, z) => {
        const hills = fbm(x * 0.04, z * 0.04, 4) * 2.4
            + Math.sin(x * 0.05) * 0.6
            + Math.cos(z * 0.04) * 0.5;
        const yard = smoothstep(14, 4, Math.hypot(x + 4, z + 2));
        return hills * (1 - yard * 0.7);
    };

    const segs = quality.id === 'low' ? 36 : 64;
    const grassTex = grassTexture(scene);
    const ground = terrainMesh(
        scene, world.heightAt, 100, segs,
        std(scene, 0x8fbc5a, 0.95, 0.02, { map: grassTex })
    );
    ground.parent = world.root;

    const cottage = buildCottage(scene);
    cottage.parent = world.root;
    cottage.position.set(-6, world.heightAt(-6, -4), -4);
    cottage.rotation.y = 0.25;
    world.addCollider(-6, -4, 3.1);

    const fenceA = buildFence(scene, 10);
    fenceA.parent = world.root;
    fenceA.position.set(2, world.heightAt(2, 2), 2);

    const mother = buildMother(scene);
    mother.parent = world.root;
    mother.position.set(-3.2, world.heightAt(-3.2, -1.2), -1.2);
    mother.rotation.y = 0.8;
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

    const cowMesh = buildCow(scene);
    cowMesh.parent = world.root;
    const cow = new CowAI(cowMesh, 4.5, 3.2);
    cowMesh.position.set(4.5, world.heightAt(4.5, 3.2), 3.2);
    world.cow = cow;
    world.addInteract({
        r: 1.7, id: 'cow', kind: 'cow',
        label: 'Chamar a Mimosa',
        get x() { return cow.x; },
        get z() { return cow.z; }
    });

    const gateX = 16;
    const gateZ = 9;
    const arch = buildGateArch(scene);
    arch.parent = world.root;
    arch.position.set(gateX, world.heightAt(gateX, gateZ), gateZ);
    arch.rotation.y = Math.atan2(gateX + 2, gateZ);

    const beacon = placeBeacon(scene, world, gateX, gateZ, 0xffee66);
    beacon.scaling.set(1.4, 1.8, 1.4);
    world.gateBeacon = beacon;
    world.addInteract({
        x: gateX, z: gateZ, r: 3.8, id: 'gate', kind: 'goal',
        label: 'Seguir para a feira'
    });

    const well = buildWell(scene);
    well.parent = world.root;
    well.position.set(1.5, world.heightAt(1.5, -6), -6);
    world.addCollider(1.5, -6, 0.95);

    const rng = seeded(21);
    scatterTrees(scene, world, Math.round(18 * quality.trees), rng, {
        minR: 16, maxR: 42, avoid: [{ x: -6, z: -4, r: 8 }, { x: 4.5, z: 3.2, r: 4 }, { x: 16, z: 9, r: 7 }]
    });
    addPath(scene, world, { x: -2, z: 0 }, { x: 16, z: 9 });

    for (let i = 1; i <= 4; i++) {
        const t = i / 5;
        const lx = -2 + (16 + 2) * t;
        const lz = 0 + 9 * t;
        const lamp = B.MeshBuilder.CreateCylinder(`lamp_${i}`, {
            height: 1.6,
            diameterTop: 0.12,
            diameterBottom: 0.16,
            tessellation: 6
        }, scene);
        lamp.parent = world.root;
        lamp.material = std(scene, 0x5a3a18, 0.85);
        lamp.position.set(lx, world.heightAt(lx, lz) + 0.8, lz);

        const flame = B.MeshBuilder.CreateSphere(`flame_${i}`, { diameter: 0.28, segments: 6 }, scene);
        flame.parent = world.root;
        const fMat = new B.StandardMaterial(`flameMat_${i}`, scene);
        fMat.emissiveColor = new B.Color3(1, 0.8, 0.4);
        fMat.disableLighting = true;
        flame.material = fMat;
        flame.position.set(lx, world.heightAt(lx, lz) + 1.7, lz);

        if (quality.lights) {
            const pLight = new B.PointLight(`plight_${i}`, flame.position, scene);
            pLight.diffuse = new B.Color3(1, 0.8, 0.4);
            pLight.intensity = 0.55;
            pLight.range = 8;
            world.disposables.push(pLight);
        }
    }

    world.updateFns.push((t, dt) => {
        mother.position.y = world.heightAt(-3.2, -1.2) + Math.sin(t * 1.1) * 0.01;
        if (beacon) beacon.rotation.y = t * 0.4;
    });

    return world;
}

/* ================================================================== */
/* II — A Feira                                                        */
/* ================================================================== */

export function buildFairChapter(scene, quality) {
    const world = new ChapterWorld(scene);
    world.bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
    world.spawn = { x: -16, z: 14, yaw: 0.4 };
    world.overview.copyFromFloats(20, 12, 18);
    world.flags = { sold: false };

    world.heightAt = (x, z) => fbm(x * 0.03, z * 0.03, 8) * 1.1 * (1 - smoothstep(6, 18, Math.hypot(x, z)) * 0.4);

    const grassTex = grassTexture(scene);
    const ground = terrainMesh(
        scene, world.heightAt, 90, quality.id === 'low' ? 36 : 64,
        std(scene, 0xc4b070, 0.92, 0.02, { map: grassTex })
    );
    ground.parent = world.root;

    const dirtTex = dirtTexture(scene);
    const plaza = B.MeshBuilder.CreateDisc('plaza', { radius: 11, tessellation: 24 }, scene);
    plaza.parent = world.root;
    plaza.rotation.x = Math.PI / 2;
    plaza.position.y = 0.05;
    plaza.material = std(scene, 0xd8b878, 0.9, 0.02, { map: dirtTex });
    plaza.receiveShadows = true;

    const colors = [0xc43a2a, 0x2a6aaa, 0xd4a020, 0x2e7a3a, 0x7a3aaa];
    const stalls = [
        { x: -6, z: -4, y: 1.2 },
        { x: 6, z: -5, y: -0.4 },
        { x: -7, z: 5, y: 2.2 },
        { x: 7, z: 4, y: 0.6 },
        { x: 0, z: -8, y: 0 }
    ];
    stalls.forEach((s, i) => {
        const st = buildStall(scene, colors[i]);
        st.parent = world.root;
        st.position.set(s.x, world.heightAt(s.x, s.z), s.z);
        st.rotation.y = s.y;
        world.addCollider(s.x, s.z, 1.15);
    });

    const stoneTex = stoneTexture(scene);
    const fountain = B.MeshBuilder.CreateCylinder('fountain', {
        height: 0.5,
        diameterTop: 2.8,
        diameterBottom: 3.2,
        tessellation: 16
    }, scene);
    fountain.parent = world.root;
    fountain.position.y = 0.25;
    fountain.material = std(scene, 0x8a9098, 0.7, 0.04, { map: stoneTex });

    const water = B.MeshBuilder.CreateDisc('fountainWater', { radius: 1.1, tessellation: 16 }, scene);
    water.parent = world.root;
    water.rotation.x = Math.PI / 2;
    water.position.y = 0.52;
    water.material = std(scene, 0x4aa0c8, 0.2, 0.25, { alpha: 0.75 });
    world.addCollider(0, 0, 1.5);

    const merchant = buildMerchant(scene);
    merchant.parent = world.root;
    merchant.position.set(0, world.heightAt(0, 12), 12);
    merchant.rotation.y = Math.PI;
    world.addCollider(0, 12, 0.7);

    const beanGlow = placeBeacon(scene, world, 0, 12, 0xaa66ff);
    beanGlow.position.set(0, 3.4, 12);

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

    const cowMesh = buildCow(scene);
    cowMesh.parent = world.root;
    const cow = new CowAI(cowMesh, -14, 12);
    cow.follow = true;
    world.cow = cow;

    const rng = seeded(44);
    scatterTrees(scene, world, Math.round(12 * quality.trees), rng, {
        minR: 16, maxR: 36, avoid: [{ x: 0, z: 0, r: 14 }, { x: 0, z: 12, r: 5 }]
    });

    world.updateFns.push((t) => {
        beanGlow.rotation.y = t * 0.5;
        merchant.position.y = world.heightAt(0, 12) + Math.sin(t * 1.3) * 0.02;
    });

    return world;
}

/* ================================================================== */
/* III — A Noite / o pé                                                */
/* ================================================================== */

export function buildNightChapter(scene, quality) {
    const world = new ChapterWorld(scene);
    world.bounds = { minX: -36, maxX: 36, minZ: -36, maxZ: 36 };
    world.spawn = { x: 8, z: 10, yaw: -2.4 };
    world.overview.copyFromFloats(14, 18, 18);
    world.voidY = -8;
    world.flags = { talkedMother: false, growing: false, grown: false, growT: 0 };

    world.heightAt = (x, z) => {
        const hills = fbm(x * 0.045, z * 0.045, 3) * 1.8;
        const yard = smoothstep(12, 3, Math.hypot(x + 2, z));
        return hills * (1 - yard * 0.75);
    };

    const grassTex = grassTexture(scene);
    const ground = terrainMesh(
        scene, world.heightAt, 80, quality.id === 'low' ? 36 : 64,
        std(scene, 0x2a5a28, 0.95, 0.02, { map: grassTex })
    );
    ground.parent = world.root;

    const cottage = buildCottage(scene);
    cottage.parent = world.root;
    cottage.position.set(-8, world.heightAt(-8, -3), -3);
    world.addCollider(-8, -3, 3.1);

    const mother = buildMother(scene);
    mother.parent = world.root;
    mother.position.set(-5.4, world.heightAt(-5.4, -0.6), -0.6);
    mother.rotation.y = 0.5;
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
    const dirtTex = dirtTexture(scene);
    const dirt = B.MeshBuilder.CreateDisc('patchDirt', { radius: 1.6, tessellation: 16 }, scene);
    dirt.parent = world.root;
    dirt.rotation.x = Math.PI / 2;
    dirt.position.set(patchX, world.heightAt(patchX, patchZ) + 0.05, patchZ);
    dirt.material = std(scene, 0x5a3a18, 0.95, 0.02, { map: dirtTex });

    const beans = [];
    for (let i = 0; i < 5; i++) {
        const b = B.MeshBuilder.CreateSphere(`magicBean_${i}`, { diameter: 0.16, segments: 8 }, scene);
        b.parent = world.root;
        b.material = std(scene, 0x6a2aaa, 0.5, 0.1, {
            emissive: 0x8a38dd,
            emissiveIntensity: 0.8
        });
        const a = (i / 5) * Math.PI * 2;
        b.position.set(
            patchX + Math.cos(a) * 0.35,
            world.heightAt(patchX, patchZ) + 0.12,
            patchZ + Math.sin(a) * 0.35
        );
        beans.push(b);
    }

    const stalkBuild = buildBeanstalk(scene, 72, quality.id);
    stalkBuild.group.parent = world.root;
    stalkBuild.group.position.set(patchX, world.heightAt(patchX, patchZ), patchZ);
    stalkBuild.group.scaling.set(1, 0.02, 1);
    stalkBuild.group.setEnabled(false);
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

    const moon = B.MeshBuilder.CreateSphere('moon', { diameter: 6.4, segments: 16 }, scene);
    moon.parent = world.root;
    const moonMat = new B.StandardMaterial('moonMat', scene);
    moonMat.emissiveColor = new B.Color3(0.95, 0.97, 1);
    moonMat.disableLighting = true;
    moon.material = moonMat;
    moon.position.set(-18, 28, -22);

    const moonLight = new B.PointLight('moonLight', moon.position, scene);
    moonLight.diffuse = new B.Color3(0.65, 0.8, 1);
    moonLight.intensity = 1.4;
    moonLight.range = 80;
    world.disposables.push(moonLight);

    const rng = seeded(9);
    scatterTrees(scene, world, Math.round(14 * quality.trees), rng, {
        minR: 12, maxR: 32, avoid: [{ x: -8, z: -3, r: 7 }, { x: patchX, z: patchZ, r: 5 }]
    });

    const fireflies = [];
    const fCount = Math.round(40 * quality.particles);
    const ffMat = new B.StandardMaterial('ffMat', scene);
    ffMat.emissiveColor = new B.Color3(0.85, 1, 0.4);
    ffMat.disableLighting = true;

    for (let i = 0; i < fCount; i++) {
        const m = B.MeshBuilder.CreateSphere(`firefly_${i}`, { diameter: 0.1, segments: 4 }, scene);
        m.parent = world.root;
        m.material = ffMat;
        m.position.set((rng() - 0.5) * 30, 1 + rng() * 4, (rng() - 0.5) * 30);
        fireflies.push({ m, ox: m.position.x, oz: m.position.z, ph: rng() * 6 });
    }

    world.growStalk = () => {
        world.flags.growing = true;
        world.flags.growT = 0;
        stalkBuild.group.setEnabled(true);
        beans.forEach((b) => { b.setEnabled(false); });
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
            stalkBuild.group.scaling.set(1, 0.02 + k * 0.98, 1);
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

export function buildCastleChapter(scene, quality) {
    const world = new ChapterWorld(scene);
    world.bounds = { minX: -34, maxX: 34, minZ: -28, maxZ: 38 };
    world.spawn = { x: 0, z: 24, yaw: Math.PI };
    world.overview.copyFromFloats(22, 16, 28);
    world.voidY = -6;
    world.flags = { gold: false, hen: false, harp: false };

    world.heightAt = (x, z) => (Math.hypot(x, z) > 29 ? -20 : 1.15);

    const island = buildCloudIsland(scene, 30);
    island.parent = world.root;

    const stoneTex = stoneTexture(scene);
    const floor = B.MeshBuilder.CreateDisc('castleFloor', { radius: 22, tessellation: 28 }, scene);
    floor.parent = world.root;
    floor.rotation.x = Math.PI / 2;
    floor.position.y = 1.15;
    floor.material = std(scene, 0xd0d6dc, 0.88, 0.05, { map: stoneTex });
    floor.receiveShadows = true;

    const castle = buildCastle(scene);
    castle.parent = world.root;
    castle.position.set(0, 1.15, -4);
    world.addCollider(0, -4, 8.5);
    world.addCollider(-7, 2, 1.8);
    world.addCollider(7, 2, 1.8);

    const hallFloor = B.MeshBuilder.CreatePlane('hallFloor', { width: 14, height: 16 }, scene);
    hallFloor.parent = world.root;
    hallFloor.rotation.x = Math.PI / 2;
    hallFloor.position.set(0, 1.18, 8);
    hallFloor.material = std(scene, 0xc8b090, 0.8, 0.04, { map: stoneTex });
    hallFloor.receiveShadows = true;

    const table = buildTable(scene);
    table.parent = world.root;
    table.position.set(0, 1.15, 6);
    world.addCollider(0, 6, 2.6);

    const giantBuilt = buildGiant(scene);
    giantBuilt.group.parent = world.root;
    giantBuilt.group.scaling.setAll(1.15);
    const giant = new GiantAI(giantBuilt.group, giantBuilt.parts, 0, 5.2, 1.15);
    giant.yaw = 0.2;
    giantBuilt.group.rotation.y = 0.2;
    world.giant = giant;

    const gold = buildGoldBag(scene);
    gold.parent = world.root;
    gold.position.set(-4.6, 2.15, 8.4);
    world.addInteract({
        x: -4.6, z: 8.4, y: 2.15, r: 1.5, id: 'gold', kind: 'treasure',
        label: 'Pegar o saco de ouro', mesh: gold
    });

    const hen = buildHen(scene);
    hen.parent = world.root;
    hen.position.set(5.2, 1.45, 11.5);
    world.addInteract({
        x: 5.2, z: 11.5, y: 1.45, r: 1.5, id: 'hen', kind: 'treasure',
        label: 'Pegar a galinha dourada', mesh: hen
    });

    const harp = buildHarp(scene);
    harp.parent = world.root;
    harp.position.set(0, 1.2, 14.2);

    const harpLight = new B.PointLight('harpLight', new B.Vector3(0, 2.4, 14.2), scene);
    harpLight.diffuse = new B.Color3(1, 0.88, 0.4);
    harpLight.intensity = 0.9;
    harpLight.range = 8;
    world.disposables.push(harpLight);

    world.addInteract({
        x: 0, z: 14.2, y: 1.2, r: 1.6, id: 'harp', kind: 'treasure',
        label: 'Pegar a harpa que canta', mesh: harp
    });

    const candles = [];
    [[-6, 2], [6, 2], [-5, 12], [5, 12]].forEach(([x, z], i) => {
        const stand = B.MeshBuilder.CreateCylinder(`candleStand_${i}`, {
            height: 0.9,
            diameterTop: 0.24,
            diameterBottom: 0.32,
            tessellation: 8
        }, scene);
        stand.parent = world.root;
        stand.position.set(x, 1.6, z);
        stand.material = std(scene, 0x8a6a28, 0.6);

        const flame = B.MeshBuilder.CreateSphere(`candleFlame_${i}`, { diameter: 0.2, segments: 6 }, scene);
        flame.parent = world.root;
        const cMat = new B.StandardMaterial(`cMat_${i}`, scene);
        cMat.emissiveColor = new B.Color3(1, 0.8, 0.4);
        cMat.disableLighting = true;
        flame.material = cMat;
        flame.position.set(x, 2.15, z);
        candles.push(flame);
    });

    world.updateFns.push((t) => {
        hen.rotation.y = t * 0.6;
        hen.position.y = 1.45 + Math.sin(t * 2) * 0.08;
        gold.rotation.y = t * 0.4;
        gold.position.y = 2.15 + Math.sin(t * 2.2) * 0.06;
        harp.rotation.y = Math.sin(t * 1.4) * 0.15;
        candles.forEach((c, i) => {
            c.scaling.setAll(0.85 + Math.sin(t * 8 + i) * 0.18);
        });
    });

    return world;
}

/* ================================================================== */
/* V — A Fuga                                                          */
/* ================================================================== */

export function buildEscapeChapter(scene, quality) {
    const world = new ChapterWorld(scene);
    world.bounds = { minX: -36, maxX: 36, minZ: -36, maxZ: 36 };
    world.spawn = { x: 2.2, z: 6.2, yaw: Math.PI, y: 68 };
    world.overview.copyFromFloats(16, 22, 20);
    world.voidY = -10;
    world.flags = { hasAxe: false, chopped: false };
    world.chop = 0;

    world.heightAt = (x, z) => {
        const hills = fbm(x * 0.04, z * 0.04, 5) * 1.6;
        const yard = smoothstep(12, 3, Math.hypot(x + 2, z));
        return hills * (1 - yard * 0.7);
    };

    const grassTex = grassTexture(scene);
    const ground = terrainMesh(
        scene, world.heightAt, 80, quality.id === 'low' ? 36 : 64,
        std(scene, 0x7aaa48, 0.95, 0.02, { map: grassTex })
    );
    ground.parent = world.root;

    const cottage = buildCottage(scene);
    cottage.parent = world.root;
    cottage.position.set(-8, world.heightAt(-8, -3), -3);
    world.addCollider(-8, -3, 3.1);

    const patchX = 2.2;
    const patchZ = 4.5;
    const stalkBuild = buildBeanstalk(scene, 72, quality.id);
    const baseY = world.heightAt(patchX, patchZ);
    stalkBuild.group.parent = world.root;
    stalkBuild.group.position.set(patchX, baseY, patchZ);
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

    const axe = buildAxe(scene);
    axe.parent = world.root;
    axe.position.set(-4.2, world.heightAt(-4.2, 1.4) + 0.55, 1.4);
    axe.rotation.z = 0.4;
    world.addInteract({
        x: -4.2, z: 1.4, r: 1.6, id: 'axe', kind: 'axe',
        label: 'Pegar o machado', mesh: axe
    });

    world.addInteract({
        x: patchX, z: patchZ, r: 2.0, id: 'chop', kind: 'chop',
        label: 'Cortar o pé de feijão'
    });

    const giantBuilt = buildGiant(scene);
    giantBuilt.group.parent = world.root;
    giantBuilt.group.scaling.setAll(1.05);
    const giant = new GiantAI(giantBuilt.group, giantBuilt.parts, patchX, patchZ, 78);
    giant.state = 'chase';
    giant.alert = 1;
    world.giant = giant;
    world.stalkX = patchX;
    world.stalkZ = patchZ;

    const mother = buildMother(scene);
    mother.parent = world.root;
    mother.position.set(-5.8, world.heightAt(-5.8, -0.8), -0.8);
    world.addCollider(-5.8, -0.8, 0.5);

    world.updateFns.push((t) => {
        if (world.flags.chopped && stalkBuild.group) {
            stalkBuild.group.rotation.z = Math.min(1.2, (stalkBuild.group.userData?.fall || 0));
        }
        axe.rotation.y = t * 0.5;
    });

    return world;
}

export function buildChapter(id, scene, quality) {
    switch (id) {
        case 'cottage': return buildCottageChapter(scene, quality);
        case 'fair': return buildFairChapter(scene, quality);
        case 'night': return buildNightChapter(scene, quality);
        case 'castle': return buildCastleChapter(scene, quality);
        case 'escape': return buildEscapeChapter(scene, quality);
        default: return buildCottageChapter(scene, quality);
    }
}

