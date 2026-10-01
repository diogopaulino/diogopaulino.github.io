/**
 * Faixa da orla: areia, jardins Guinness, ciclovia, calçada e avenida.
 */

import * as THREE from 'three';
import { ORLA_LENGTH, ZONES, CANALS } from './config.js';
import { seeded } from './utils.js';

/** Textura procedural só em tons de areia (evita mapa RGB “TV estática”). */
function makeSandTexture(size = 128) {
    const data = new Uint8Array(size * size * 4);
    const rand = seeded(0xa5e);
    for (let i = 0; i < size * size; i++) {
        const n = rand();
        const o = i * 4;
        const r = 210 + Math.floor(n * 28);
        const g = 185 + Math.floor(rand() * 22);
        const b = 140 + Math.floor(rand() * 18);
        data[o] = r;
        data[o + 1] = g;
        data[o + 2] = b;
        data[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

function strip(width, depth, color, roughness = 0.9, metalness = 0) {
    const geo = new THREE.PlaneGeometry(width, depth);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({
        color,
        roughness,
        metalness,
        flatShading: false
    });
    return new THREE.Mesh(geo, mat);
}

function addPalms(group, count) {
    const rand = seeded(0xc0ffee);
    const trunkGeo = new THREE.CylinderGeometry(0.1, 0.2, 6.2, 7);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 0.92 });
    // Copa em camadas (mais “palmeira imperial” do que cone único)
    const frondGeo = new THREE.ConeGeometry(0.35, 2.8, 5, 1, true);
    const crownMat = new THREE.MeshStandardMaterial({
        color: 0x2d7a3c,
        roughness: 0.78,
        side: THREE.DoubleSide
    });
    const frondsPerTree = 6;
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
        const z = ZONES.gardenInner + 2 + rand() * (ZONES.gardenOuter - ZONES.gardenInner - 4);
        const h = 0.9 + rand() * 0.5;
        p.set(x, 3.1 * h, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI * 2);
        s.set(h * 0.85, h, h * 0.85);
        m.compose(p, q, s);
        trunks.setMatrixAt(i, m);
        const topY = 6.2 * h;
        for (let f = 0; f < frondsPerTree; f++) {
            const yaw = (f / frondsPerTree) * Math.PI * 2 + rand() * 0.2;
            eul.set(-0.95 - rand() * 0.25, yaw, 0.15);
            q.setFromEuler(eul);
            p.set(x, topY - 0.2, z);
            s.set(1.6 * h, h * (0.9 + rand() * 0.25), 1.6 * h);
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

function addShrubs(group, count) {
    const rand = seeded(0x51b);
    const geo = new THREE.SphereGeometry(0.7, 6, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3d7a45, roughness: 0.88 });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        const x = (rand() - 0.5) * (ORLA_LENGTH - 10);
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width + 2)) continue;
        const z = ZONES.gardenInner + 1 + rand() * 14;
        p.set(x, 0.45, z);
        q.identity();
        const sc = 0.5 + rand() * 0.8;
        s.set(sc * (0.8 + rand() * 0.5), sc * (0.5 + rand() * 0.5), sc * (0.8 + rand() * 0.5));
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
}

function addQuiosques(group) {
    const rand = seeded(0x991);
    const bodyGeo = new THREE.BoxGeometry(3.2, 2.4, 2.6);
    const roofGeo = new THREE.ConeGeometry(2.6, 1.1, 4);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.7 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xc45c2a, roughness: 0.65 });
    const count = 14;
    const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, count);
    const roofs = new THREE.InstancedMesh(roofGeo, roofMat, count);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
        const x = -ORLA_LENGTH * 0.45 + i * (ORLA_LENGTH * 0.9 / (count - 1)) + (rand() - 0.5) * 8;
        const z = ZONES.gardenOuter - 3.5;
        p.set(x, 1.2, z);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.25);
        m.compose(p, q, s);
        bodies.setMatrixAt(i, m);
        p.y = 2.9;
        m.compose(p, q, s);
        roofs.setMatrixAt(i, m);
    }
    bodies.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    group.add(bodies, roofs);
}

export function createOrla(quality) {
    const root = new THREE.Group();
    root.name = 'orla';

    const sand = strip(ORLA_LENGTH + 40, ZONES.sandOuter - ZONES.gardenOuter + 4, 0xe6d2a8, 0.98);
    sand.position.set(0, 0.02, (ZONES.sandOuter + ZONES.gardenOuter) * 0.5);
    sand.receiveShadow = true;
    // Granulação de areia (tons de areia, não RGB barulhento)
    sand.material.map = makeSandTexture();
    sand.material.map.repeat.set(48, 6);
    sand.material.roughnessMap = sand.material.map;
    root.add(sand);

    // Faixa molhada perto da água
    const wet = strip(ORLA_LENGTH + 30, 4.5, 0xc4b08a, 0.55, 0.08);
    wet.position.set(0, 0.03, ZONES.sandOuter - 1.5);
    wet.receiveShadow = true;
    root.add(wet);

    const garden = strip(ORLA_LENGTH + 20, ZONES.gardenOuter - ZONES.gardenInner, 0x3f8f4a, 0.95);
    garden.position.set(0, 0.04, (ZONES.gardenOuter + ZONES.gardenInner) * 0.5);
    garden.receiveShadow = true;
    root.add(garden);

    // Faixas de grama mais escuras (canteiros)
    const bed = strip(ORLA_LENGTH + 10, 1.8, 0x2f6d38, 0.95);
    bed.position.set(0, 0.05, ZONES.gardenInner + 6);
    root.add(bed);

    const bike = strip(ORLA_LENGTH + 10, 2.2, 0x2a2a2e, 0.55, 0.05);
    bike.position.set(0, 0.06, ZONES.bikePath);
    bike.receiveShadow = true;
    root.add(bike);

    // Linha amarela da ciclovia
    const lane = strip(ORLA_LENGTH + 10, 0.12, 0xf0d24a, 0.4);
    lane.position.set(0, 0.07, ZONES.bikePath);
    root.add(lane);

    const sidewalk = strip(ORLA_LENGTH + 10, 2.4, 0xb8b4aa, 0.85);
    sidewalk.position.set(0, 0.055, ZONES.sidewalk);
    sidewalk.receiveShadow = true;
    root.add(sidewalk);

    const avenue = strip(ORLA_LENGTH + 20, 7.5, 0x3a3a40, 0.7);
    avenue.position.set(0, 0.03, ZONES.avenue - 1.5);
    avenue.receiveShadow = true;
    root.add(avenue);

    // Faixa central da avenida
    const center = strip(ORLA_LENGTH + 10, 0.18, 0xd8d2a8, 0.5);
    center.position.set(0, 0.04, ZONES.avenue - 1.5);
    root.add(center);

    addPalms(root, quality.palmCount);
    addShrubs(root, Math.floor(quality.palmCount * 0.7));
    addQuiosques(root);

    // Postes de luz ao longo da orla
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 4.5, 5);
    const lampGeo = new THREE.SphereGeometry(0.28, 8, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c2c30, roughness: 0.6, metalness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({
        color: 0xfff2c8,
        emissive: 0xffd27a,
        emissiveIntensity: 0.35,
        roughness: 0.4
    });
    const poles = 28;
    const poleMesh = new THREE.InstancedMesh(poleGeo, poleMat, poles);
    const lampMesh = new THREE.InstancedMesh(lampGeo, lampMat, poles);
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < poles; i++) {
        const x = -ORLA_LENGTH * 0.48 + i * (ORLA_LENGTH * 0.96 / (poles - 1));
        p.set(x, 2.25, ZONES.sidewalk + 0.8);
        m.compose(p, q, s);
        poleMesh.setMatrixAt(i, m);
        p.y = 4.5;
        m.compose(p, q, s);
        lampMesh.setMatrixAt(i, m);
    }
    poleMesh.instanceMatrix.needsUpdate = true;
    lampMesh.instanceMatrix.needsUpdate = true;
    root.add(poleMesh, lampMesh);

    return {
        root,
        lampMat,
        setNight(night) {
            lampMat.emissiveIntensity = night ? 1.6 : 0.25;
        }
    };
}
