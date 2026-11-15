/**
 * Faixa da orla: areia seca/molhada, guarda-sóis, mureta santista, jardins Guinness,
 * quiosques, calçadão em mosaico português, ciclovia, postes e tráfego na avenida.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ORLA_LENGTH, ZONES, CANALS } from './config.js';
import { seeded } from './utils.js';
import {
    roofTileMaterial,
    woodMaterial,
    plasterMaterial,
    metalMaterial
} from '../../shared/realism.js';
import {
    createPortugueseMosaicTextures,
    createAsphaltTextures,
    createSandTextures
} from './pbr.js';

function makeGrassTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#367d40';
    ctx.fillRect(0, 0, 128, 128);
    const rand = seeded(0x9a55);
    for (let i = 0; i < 600; i++) {
        const x = rand() * 128;
        const y = rand() * 128;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(28,72,32,0.38)' : 'rgba(115,192,98,0.32)';
        ctx.fillRect(x, y, 2, 4);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(90, 6);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function makePalmTrunkGeo() {
    const pts = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const flare = Math.exp(-t * 7) * 0.12;
        const ring = Math.sin(t * Math.PI * 18) * 0.014;
        const r = 0.19 - t * 0.09 + flare + ring;
        pts.push(new THREE.Vector2(Math.max(0.06, r), (t - 0.5) * 6.4));
    }
    const geo = new THREE.LatheGeometry(pts, 10);
    geo.computeVertexNormals();
    return geo;
}

function makePalmFrondGeo() {
    const geo = new THREE.ConeGeometry(0.45, 3.2, 6, 5, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const u = (y + 1.6) / 3.2;
        pos.setZ(i, pos.getZ(i) * 0.34 - u * u * 0.72);
    }
    geo.computeVertexNormals();
    return geo;
}

function addPalms(group, count) {
    const rand = seeded(0xc0ffee);
    const trunkGeo = makePalmTrunkGeo();
    const trunkMat = woodMaterial(0x7c5b39, { roughness: 0.9, repeat: 2 });
    const frondGeo = makePalmFrondGeo();
    const crownMat = new THREE.MeshPhysicalMaterial({
        color: 0x2f823f,
        roughness: 0.64,
        sheen: 0.38,
        sheenColor: 0xa2e584,
        side: THREE.DoubleSide
    });
    const frondsPerTree = 9;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const fronds = new THREE.InstancedMesh(frondGeo, crownMat, count * frondsPerTree);
    trunks.castShadow = fronds.castShadow = true;

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const eul = new THREE.Euler();
    let i = 0;
    let fi = 0;
    while (i < count) {
        const x = (rand() - 0.5) * (ORLA_LENGTH - 20);
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width + 3)) continue;
        const z = ZONES.gardenInner + 1.8 + rand() * (ZONES.gardenOuter - ZONES.gardenInner - 3.6);
        const h = 0.85 + rand() * 0.55;
        const leanX = (rand() - 0.5) * 0.08;
        const leanZ = (rand() - 0.5) * 0.08;
        eul.set(leanX, rand() * Math.PI * 2, leanZ);
        q.setFromEuler(eul);
        p.set(x, 3.2 * h, z);
        s.set(h * 0.85, h, h * 0.85);
        m.compose(p, q, s);
        trunks.setMatrixAt(i, m);

        const topY = 6.35 * h;
        for (let f = 0; f < frondsPerTree; f++) {
            const yaw = (f / frondsPerTree) * Math.PI * 2 + rand() * 0.2;
            eul.set(-0.88 - rand() * 0.32, yaw, 0.14);
            q.setFromEuler(eul);
            p.set(x, topY - 0.18, z);
            s.set(1.55 * h, h * (0.9 + rand() * 0.28), 1.55 * h);
            m.compose(p, q, s);
            fronds.setMatrixAt(fi++, m);
        }
        i++;
    }
    trunks.instanceMatrix.needsUpdate = true;
    fronds.count = fi;
    fronds.instanceMatrix.needsUpdate = true;
    group.add(trunks, fronds);
    return { trunks, fronds };
}

function addShrubsAndFlowers(group, count) {
    const rand = seeded(0x51b);
    const geo = new THREE.IcosahedronGeometry(0.75, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const lobe = 0.84 + 0.22 * Math.sin(vx * 4.2 + vz * 3.8);
        pos.setXYZ(i, vx * lobe, vy * 0.72 * lobe, vz * lobe);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x387e44,
        roughness: 0.76,
        sheen: 0.3,
        sheenColor: 0x9ce284
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const flowerCount = Math.floor(count * 0.35);
    const flowerGeo = new THREE.DodecahedronGeometry(0.32, 0);
    const flowerMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    flowers.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(flowerCount * 3), 3);
    const flowerPalette = [0xe84a68, 0xf2b830, 0xd94898, 0xf4ece1];

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const col = new THREE.Color();
    let fi = 0;

    for (let i = 0; i < count; i++) {
        const x = (rand() - 0.5) * (ORLA_LENGTH - 10);
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width + 2)) continue;
        const z = ZONES.gardenInner + 1 + rand() * 14;
        p.set(x, 0.42, z);
        q.setFromEuler(new THREE.Euler(0, rand() * Math.PI * 2, 0));
        const sc = 0.55 + rand() * 0.78;
        s.set(sc * (0.85 + rand() * 0.45), sc * (0.55 + rand() * 0.4), sc * (0.85 + rand() * 0.45));
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);

        if (fi < flowerCount && rand() > 0.55) {
            p.set(x + (rand() - 0.5) * 0.4, 0.72 * sc + 0.15, z + (rand() - 0.5) * 0.4);
            s.setScalar(0.7 + rand() * 0.5);
            m.compose(p, q, s);
            flowers.setMatrixAt(fi, m);
            col.set(flowerPalette[(rand() * flowerPalette.length) | 0]);
            flowers.setColorAt(fi, col);
            fi++;
        }
    }
    mesh.instanceMatrix.needsUpdate = true;
    flowers.count = fi;
    flowers.instanceMatrix.needsUpdate = true;
    if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
    group.add(mesh, flowers);
}

/** Mureta icônica de Santos ao longo da divisão jardim/areia. */
function addMuretaDeSantos(group) {
    const parts = [];
    // Bloco base + pilar + chapéu superior formando 1 módulo de 3m
    const base = new THREE.BoxGeometry(3.0, 0.35, 0.28);
    base.translate(0, 0.175, 0);
    parts.push(base);

    const postL = new THREE.BoxGeometry(0.32, 0.75, 0.32);
    postL.translate(-1.34, 0.375, 0);
    parts.push(postL);

    const top = new THREE.BoxGeometry(3.0, 0.14, 0.34);
    top.translate(0, 0.78, 0);
    parts.push(top);

    const modGeo = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());

    const mat = plasterMaterial(0xf2efe8, { roughness: 0.65, repeat: 1 });
    const step = 3.0;
    const maxCount = Math.ceil(ORLA_LENGTH / step);
    const mesh = new THREE.InstancedMesh(modGeo, mat, maxCount);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    const m = new THREE.Matrix4();
    let idx = 0;
    for (let x = -ORLA_LENGTH * 0.5 + 2; x < ORLA_LENGTH * 0.5 - 2; x += step) {
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width * 0.6 + 1.5)) continue;
        m.makeTranslation(x, 0, ZONES.gardenOuter + 0.35);
        mesh.setMatrixAt(idx++, m);
    }
    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
}

/** Quiosques octogonais com mesas e guarda-sóis na praia. */
function addQuiosquesAndBeachProps(group, quality) {
    const rand = seeded(0x991);
    const baseGeo = new THREE.CylinderGeometry(1.78, 1.86, 1.15, 8);
    const upperGeo = new THREE.CylinderGeometry(1.48, 1.48, 1.1, 8);
    const roofGeo = new THREE.ConeGeometry(2.5, 1.3, 8);
    const bodyMat = plasterMaterial(0xf2efe6, { roughness: 0.72, repeat: 2 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x2c4252, roughness: 0.2, metalness: 0.25 });
    const roofMat = roofTileMaterial(0xc45c2a, { roughness: 0.68, repeatX: 6, repeatY: 2 });

    const count = 14;
    const bases = new THREE.InstancedMesh(baseGeo, bodyMat, count);
    const uppers = new THREE.InstancedMesh(upperGeo, glassMat, count);
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, count);
    bases.castShadow = roofs.castShadow = true;

    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);

    let idx = 0;
    for (let i = 0; i < count; i++) {
        let x = -ORLA_LENGTH * 0.45 + (i / (count - 1)) * ORLA_LENGTH * 0.9;
        for (const c of CANALS) {
            if (Math.abs(x - c.x) < c.width + 4) x += 6;
        }
        const z = ZONES.gardenOuter - 0.8 + (rand() - 0.5) * 1.2;
        p.set(x, 0.58, z);
        m.compose(p, q, s);
        bases.setMatrixAt(idx, m);
        p.set(x, 1.7, z);
        m.compose(p, q, s);
        uppers.setMatrixAt(idx, m);
        p.set(x, 2.85, z);
        m.compose(p, q, s);
        roofs.setMatrixAt(idx, m);
        idx++;
    }
    bases.count = uppers.count = roofs.count = idx;
    bases.instanceMatrix.needsUpdate = true;
    uppers.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    group.add(bases, uppers, roofs);

    // Guarda-sóis coloridos na faixa de areia
    const umbCount = quality.id === 'low' ? 24 : 56;
    const poleGeo = new THREE.CylinderGeometry(0.035, 0.035, 1.9, 6);
    const canopyGeo = new THREE.ConeGeometry(1.15, 0.48, 8);
    const poleMat = woodMaterial(0x8c6d46, { roughness: 0.8 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72, side: THREE.DoubleSide });

    const poles = new THREE.InstancedMesh(poleGeo, poleMat, umbCount);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, umbCount);
    canopies.castShadow = true;
    canopies.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(umbCount * 3), 3);
    const umbColors = [0xd64538, 0x2674a8, 0xe8a828, 0x2d8a5c, 0xf2eee4, 0xd85c8a];
    const col = new THREE.Color();

    let ui = 0;
    for (let i = 0; i < umbCount; i++) {
        const x = (rand() - 0.5) * (ORLA_LENGTH - 30);
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width + 3)) continue;
        const z = ZONES.sandInner + 2.5 + rand() * (ZONES.sandOuter - ZONES.sandInner - 5.5);
        p.set(x, 0.95, z);
        q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.08, rand() * Math.PI * 2, (rand() - 0.5) * 0.08));
        m.compose(p, q, s);
        poles.setMatrixAt(ui, m);

        p.set(x, 1.85, z);
        m.compose(p, q, s);
        canopies.setMatrixAt(ui, m);
        col.set(umbColors[(rand() * umbColors.length) | 0]);
        canopies.setColorAt(ui, col);
        ui++;
    }
    poles.count = canopies.count = ui;
    poles.instanceMatrix.needsUpdate = true;
    canopies.instanceMatrix.needsUpdate = true;
    if (canopies.instanceColor) canopies.instanceColor.needsUpdate = true;
    group.add(poles, canopies);
}

/** Postes de iluminação da orla. */
function addLampPosts(group) {
    const postCount = 46;
    const poleGeo = new THREE.CylinderGeometry(0.06, 0.09, 5.2, 8);
    const armGeo = new THREE.BoxGeometry(0.12, 0.1, 1.3);
    const bulbGeo = new THREE.BoxGeometry(0.32, 0.12, 0.55);

    const poleMat = metalMaterial(0x2a313a, { roughness: 0.4, metalness: 0.78 });
    const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xfff0cc,
        emissive: 0xffd088,
        emissiveIntensity: 0.15,
        roughness: 0.3
    });

    const poles = new THREE.InstancedMesh(poleGeo, poleMat, postCount);
    const arms = new THREE.InstancedMesh(armGeo, poleMat, postCount);
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, postCount);

    const m = new THREE.Matrix4();
    let idx = 0;
    for (let i = 0; i < postCount; i++) {
        const x = -ORLA_LENGTH * 0.48 + (i / (postCount - 1)) * ORLA_LENGTH * 0.96;
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width + 2)) continue;
        const z = ZONES.sidewalk - 0.8;
        m.makeTranslation(x, 2.6, z);
        poles.setMatrixAt(idx, m);
        m.makeTranslation(x, 5.15, z - 0.5);
        arms.setMatrixAt(idx, m);
        m.makeTranslation(x, 5.08, z - 1.0);
        bulbs.setMatrixAt(idx, m);
        idx++;
    }
    poles.count = arms.count = bulbs.count = idx;
    poles.instanceMatrix.needsUpdate = true;
    arms.instanceMatrix.needsUpdate = true;
    bulbs.instanceMatrix.needsUpdate = true;
    group.add(poles, arms, bulbs);
    return bulbMat;
}

/** Veículos 3D esculpidos circulando na Av. da Orla. */
function addTraffic(group, quality) {
    const count = quality.id === 'low' ? 6 : 14;
    const rand = seeded(0xc455);
    const cars = [];
    const carColors = [0xd9e0e6, 0x263242, 0xb8362c, 0x3b6e8c, 0x8a929a, 0x1c1e22];

    // Geometria mesclada de carro (carroceria + cabine + para-brisa + 4 rodas)
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x16181c, roughness: 0.85 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1d2d3a, roughness: 0.12, metalness: 0.35, clearcoat: 0.9 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6dc, emissive: 0xffe8a8, emissiveIntensity: 0.25 });
    const tailMat = new THREE.MeshStandardMaterial({ color: 0xd92424, emissive: 0xff2222, emissiveIntensity: 0.2 });

    for (let i = 0; i < count; i++) {
        const isBus = i % 5 === 0;
        const car = new THREE.Group();
        const bodyMat = new THREE.MeshPhysicalMaterial({
            color: isBus ? 0x1f6294 : carColors[(rand() * carColors.length) | 0],
            roughness: 0.32,
            metalness: 0.45,
            clearcoat: 0.85
        });

        if (isBus) {
            const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.35, 2.15), bodyMat);
            body.position.y = 1.48;
            body.castShadow = true;
            const win = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.85, 2.18), glassMat);
            win.position.y = 1.95;
            car.add(body, win);
            for (const wx of [-2.2, 2.2]) {
                for (const wz of [-1.05, 1.05]) {
                    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.26, 12), wheelMat);
                    wh.rotation.x = Math.PI / 2;
                    wh.position.set(wx, 0.42, wz);
                    car.add(wh);
                }
            }
        } else {
            const lower = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.68, 1.68), bodyMat);
            lower.position.y = 0.64;
            lower.castShadow = true;
            const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.56, 1.48), bodyMat);
            cabin.position.set(-0.15, 1.22, 0);
            cabin.castShadow = true;
            const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.44, 1.5), glassMat);
            windshield.position.set(-0.15, 1.22, 0);
            const hl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 1.3), headMat);
            hl.position.set(1.9, 0.68, 0);
            const tl = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 1.3), tailMat);
            tl.position.set(-1.9, 0.68, 0);
            car.add(lower, cabin, windshield, hl, tl);
            for (const wx of [-1.15, 1.15]) {
                for (const wz of [-0.82, 0.82]) {
                    const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10), wheelMat);
                    wh.rotation.x = Math.PI / 2;
                    wh.position.set(wx, 0.3, wz);
                    car.add(wh);
                }
            }
        }

        const dir = i % 2 === 0 ? 1 : -1;
        car.position.set((rand() - 0.5) * (ORLA_LENGTH - 30), 0.08, ZONES.avenue + (dir > 0 ? 1.5 : -1.5));
        car.rotation.y = dir > 0 ? 0 : Math.PI;
        car.userData = { dir, speed: (isBus ? 11 : 16 + rand() * 8) };
        group.add(car);
        cars.push(car);
    }

    return { cars, headMat, tailMat };
}

export function createOrla(quality) {
    const root = new THREE.Group();
    root.name = 'orla';

    // Areia seca + faixa úmida próxima ao mar
    const { map: sandMap, bump: sandBump } = createSandTextures(95, 6);
    const sandGeo = new THREE.PlaneGeometry(ORLA_LENGTH + 60, ZONES.sandOuter - ZONES.gardenOuter + 14);
    sandGeo.rotateX(-Math.PI / 2);
    const sandMat = new THREE.MeshStandardMaterial({
        map: sandMap,
        bumpMap: sandBump,
        bumpScale: 0.08,
        roughness: 0.94,
        metalness: 0.0
    });
    const sand = new THREE.Mesh(sandGeo, sandMat);
    sand.position.set(0, 0.02, (ZONES.sandOuter + ZONES.gardenOuter) * 0.5 + 2);
    sand.receiveShadow = true;
    root.add(sand);

    // Faixa de areia molhada (brilho especular junto à água)
    const wetSand = new THREE.Mesh(
        new THREE.PlaneGeometry(ORLA_LENGTH + 60, 4.5),
        new THREE.MeshStandardMaterial({ color: 0xa68e65, roughness: 0.26, metalness: 0.08 })
    );
    wetSand.rotation.x = -Math.PI / 2;
    wetSand.position.set(0, 0.03, ZONES.sandOuter - 0.5);
    wetSand.receiveShadow = true;
    root.add(wetSand);

    // Gramado dos Jardins da Orla (Guinness)
    const gardenDepth = ZONES.gardenOuter - ZONES.gardenInner;
    const grassTex = makeGrassTexture();
    const gardenGeo = new THREE.PlaneGeometry(ORLA_LENGTH + 20, gardenDepth);
    gardenGeo.rotateX(-Math.PI / 2);
    const garden = new THREE.Mesh(
        gardenGeo,
        new THREE.MeshStandardMaterial({ map: grassTex, roughness: 0.92 })
    );
    garden.position.set(0, 0.04, (ZONES.gardenOuter + ZONES.gardenInner) * 0.5);
    garden.receiveShadow = true;
    root.add(garden);

    // Calçadão em Mosaico Português
    const { map: mosaicMap, bump: mosaicBump } = createPortugueseMosaicTextures(125, 2.2);
    const promenadeGeo = new THREE.PlaneGeometry(ORLA_LENGTH + 20, 4.4);
    promenadeGeo.rotateX(-Math.PI / 2);
    const promenade = new THREE.Mesh(
        promenadeGeo,
        new THREE.MeshStandardMaterial({
            map: mosaicMap,
            bumpMap: mosaicBump,
            bumpScale: 0.05,
            roughness: 0.82
        })
    );
    promenade.position.set(0, 0.055, ZONES.sidewalk + 1.2);
    promenade.receiveShadow = true;
    root.add(promenade);

    // Ciclovia vermelha com faixa central
    const bikeGeo = new THREE.PlaneGeometry(ORLA_LENGTH + 20, 2.2);
    bikeGeo.rotateX(-Math.PI / 2);
    const bikePath = new THREE.Mesh(
        bikeGeo,
        new THREE.MeshStandardMaterial({ color: 0x9c3e2e, roughness: 0.82 })
    );
    bikePath.position.set(0, 0.06, ZONES.bikePath);
    bikePath.receiveShadow = true;
    root.add(bikePath);

    // Avenida da Orla com asfalto texturizado
    const { map: asphaltMap, bump: asphaltBump } = createAsphaltTextures(55, 1);
    const avenueGeo = new THREE.PlaneGeometry(ORLA_LENGTH + 40, 7.2);
    avenueGeo.rotateX(-Math.PI / 2);
    const avenue = new THREE.Mesh(
        avenueGeo,
        new THREE.MeshStandardMaterial({
            map: asphaltMap,
            bumpMap: asphaltBump,
            bumpScale: 0.04,
            roughness: 0.78
        })
    );
    avenue.position.set(0, 0.05, ZONES.avenue);
    avenue.receiveShadow = true;
    root.add(avenue);

    addMuretaDeSantos(root);
    const palms = addPalms(root, quality.palmCount);
    addShrubsAndFlowers(root, Math.floor(quality.palmCount * 1.4));
    addQuiosquesAndBeachProps(root, quality);
    const lampBulbMat = addLampPosts(root);
    const traffic = addTraffic(root, quality);

    return {
        root,
        palms,
        update(t, dt) {
            const half = ORLA_LENGTH * 0.49;
            for (const car of traffic.cars) {
                car.position.x += car.userData.dir * car.userData.speed * dt;
                if (car.position.x > half) car.position.x = -half;
                if (car.position.x < -half) car.position.x = half;
            }
        },
        setNight(night) {
            lampBulbMat.emissiveIntensity = night ? 2.2 : 0.15;
            traffic.headMat.emissiveIntensity = night ? 2.4 : 0.25;
            traffic.tailMat.emissiveIntensity = night ? 2.0 : 0.2;
        }
    };
}
