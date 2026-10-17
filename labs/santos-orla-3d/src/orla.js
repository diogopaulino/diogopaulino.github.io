/**
 * Faixa da orla: areia granulada, jardins Guinness, quiosques octogonais, mureta santista, ciclovia, calçadão em mosaico português e avenida.
 */

import * as THREE from 'three';
import { ORLA_LENGTH, ZONES, CANALS } from './config.js';
import { seeded } from './utils.js';
import {
    sidewalkMosaicMaterial,
    roofTileMaterial,
    woodMaterial,
    plasterMaterial,
    metalMaterial
} from '../../shared/realism.js';

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

function makeGrassTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#367d40';
    ctx.fillRect(0, 0, 128, 128);
    const rand = seeded(0x9a55);
    for (let i = 0; i < 420; i++) {
        const x = rand() * 128;
        const y = rand() * 128;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(30,75,35,0.35)' : 'rgba(110,185,95,0.28)';
        ctx.fillRect(x, y, 2, 4);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
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

function makePalmTrunkGeo() {
    const pts = [];
    const steps = 16;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const flare = Math.exp(-t * 7) * 0.11;
        const ring = Math.sin(t * Math.PI * 18) * 0.012;
        const r = 0.18 - t * 0.08 + flare + ring;
        pts.push(new THREE.Vector2(Math.max(0.06, r), (t - 0.5) * 6.2));
    }
    const geo = new THREE.LatheGeometry(pts, 10);
    geo.computeVertexNormals();
    return geo;
}

function makePalmFrondGeo() {
    const geo = new THREE.ConeGeometry(0.42, 3.0, 6, 4, true);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const u = (y + 1.5) / 3.0;
        pos.setZ(i, pos.getZ(i) * 0.35 - u * u * 0.65);
    }
    geo.computeVertexNormals();
    return geo;
}

function addPalms(group, count) {
    const rand = seeded(0xc0ffee);
    const trunkGeo = makePalmTrunkGeo();
    const trunkMat = woodMaterial(0x7a5a38, { roughness: 0.9, repeat: 2 });
    const frondGeo = makePalmFrondGeo();
    const crownMat = new THREE.MeshPhysicalMaterial({
        color: 0x2d7a3c,
        roughness: 0.68,
        sheen: 0.35,
        sheenColor: 0x9fe082,
        side: THREE.DoubleSide
    });
    const frondsPerTree = 7;
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
            eul.set(-0.92 - rand() * 0.25, yaw, 0.12);
            q.setFromEuler(eul);
            p.set(x, topY - 0.2, z);
            s.set(1.55 * h, h * (0.92 + rand() * 0.25), 1.55 * h);
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
    const geo = new THREE.IcosahedronGeometry(0.72, 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vy = pos.getY(i);
        const vz = pos.getZ(i);
        const lobe = 0.84 + 0.2 * Math.sin(vx * 4.2 + vz * 3.8);
        pos.setXYZ(i, vx * lobe, vy * 0.72 * lobe, vz * lobe);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshPhysicalMaterial({
        color: 0x387a42,
        roughness: 0.76,
        sheen: 0.3,
        sheenColor: 0x9ce284
    });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
        const x = (rand() - 0.5) * (ORLA_LENGTH - 10);
        if (CANALS.some((c) => Math.abs(x - c.x) < c.width + 2)) continue;
        const z = ZONES.gardenInner + 1 + rand() * 14;
        p.set(x, 0.42, z);
        q.setFromEuler(new THREE.Euler(0, rand() * Math.PI * 2, 0));
        const sc = 0.55 + rand() * 0.75;
        s.set(sc * (0.85 + rand() * 0.45), sc * (0.55 + rand() * 0.4), sc * (0.85 + rand() * 0.45));
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    group.add(mesh);
}

function addQuiosques(group) {
    const rand = seeded(0x991);
    const baseGeo = new THREE.CylinderGeometry(1.75, 1.82, 1.15, 8);
    const upperGeo = new THREE.CylinderGeometry(1.45, 1.45, 1.1, 8);
    const roofGeo = new THREE.ConeGeometry(2.45, 1.25, 8);
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
    for (let i = 0; i < count; i++) {
        const x = -ORLA_LENGTH * 0.45 + i * (ORLA_LENGTH * 0.9 / (count - 1)) + (rand() - 0.5) * 8;
        const z = ZONES.gardenOuter - 3.5;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 0.125);
        p.set(x, 0.58, z);
        m.compose(p, q, s);
        bases.setMatrixAt(i, m);
        p.y = 1.65;
        m.compose(p, q, s);
        uppers.setMatrixAt(i, m);
        p.y = 2.75;
        m.compose(p, q, s);
        roofs.setMatrixAt(i, m);
    }
    bases.instanceMatrix.needsUpdate = true;
    uppers.instanceMatrix.needsUpdate = true;
    roofs.instanceMatrix.needsUpdate = true;
    group.add(bases, uppers, roofs);
}

export function createOrla(quality) {
    const root = new THREE.Group();
    root.name = 'orla';

    const sand = strip(ORLA_LENGTH + 40, ZONES.sandOuter - ZONES.gardenOuter + 4, 0xe6d2a8, 0.96);
    sand.position.set(0, 0.02, (ZONES.sandOuter + ZONES.gardenOuter) * 0.5);
    sand.receiveShadow = true;
    sand.material.map = makeSandTexture();
    sand.material.map.repeat.set(48, 6);
    sand.material.roughnessMap = sand.material.map;
    root.add(sand);

    // Faixa molhada espelhada perto da água
    const wet = strip(ORLA_LENGTH + 30, 4.5, 0xc4b08a, 0.42, 0.12);
    wet.position.set(0, 0.03, ZONES.sandOuter - 1.5);
    wet.receiveShadow = true;
    root.add(wet);

    const grassTex = makeGrassTexture();
    grassTex.repeat.set(36, 4);
    const garden = strip(ORLA_LENGTH + 20, ZONES.gardenOuter - ZONES.gardenInner, 0xffffff, 0.92);
    garden.material.map = grassTex;
    garden.position.set(0, 0.04, (ZONES.gardenOuter + ZONES.gardenInner) * 0.5);
    garden.receiveShadow = true;
    root.add(garden);

    // Canteiros floridos / topiaria dos jardins da orla
    const bed = strip(ORLA_LENGTH + 10, 1.8, 0x2f6d38, 0.9);
    bed.position.set(0, 0.05, ZONES.gardenInner + 6);
    root.add(bed);

    // Ciclovia vermelha/terracota típica de Santos
    const bike = strip(ORLA_LENGTH + 10, 2.2, 0x8a382d, 0.62, 0.04);
    bike.position.set(0, 0.06, ZONES.bikePath);
    bike.receiveShadow = true;
    root.add(bike);

    const lane = strip(ORLA_LENGTH + 10, 0.12, 0xf2e498, 0.4);
    lane.position.set(0, 0.07, ZONES.bikePath);
    root.add(lane);

    // Calçadão em mosaico português de ondas preto e branco
    const sidewalkGeo = new THREE.PlaneGeometry(ORLA_LENGTH + 10, 2.6);
    sidewalkGeo.rotateX(-Math.PI / 2);
    const sidewalk = new THREE.Mesh(
        sidewalkGeo,
        sidewalkMosaicMaterial({ repeatX: 72, repeatY: 1.5 })
    );
    sidewalk.position.set(0, 0.055, ZONES.sidewalk);
    sidewalk.receiveShadow = true;
    root.add(sidewalk);

    // Mureta branca histórica com balaústres ao longo do jardim
    const balustradeMat = plasterMaterial(0xf4f0e6, { roughness: 0.72, repeat: 4 });
    const lowWall = new THREE.Mesh(
        new THREE.BoxGeometry(ORLA_LENGTH + 6, 0.52, 0.24),
        balustradeMat
    );
    lowWall.position.set(0, 0.28, ZONES.gardenInner - 0.2);
    lowWall.castShadow = true;
    lowWall.receiveShadow = true;
    root.add(lowWall);

    const avenue = strip(ORLA_LENGTH + 20, 7.5, 0x34363c, 0.72);
    avenue.position.set(0, 0.03, ZONES.avenue - 1.5);
    avenue.receiveShadow = true;
    root.add(avenue);

    const center = strip(ORLA_LENGTH + 10, 0.18, 0xd8d2a8, 0.5);
    center.position.set(0, 0.04, ZONES.avenue - 1.5);
    root.add(center);

    addPalms(root, quality.palmCount);
    addShrubs(root, Math.floor(quality.palmCount * 0.75));
    addQuiosques(root);

    // Postes de luz curvos ao longo da orla
    const poleGeo = new THREE.CylinderGeometry(0.07, 0.11, 4.6, 8);
    const lampGeo = new THREE.SphereGeometry(0.28, 12, 10);
    const poleMat = metalMaterial(0x2c2e34, { roughness: 0.45, metalness: 0.65 });
    const lampMat = new THREE.MeshStandardMaterial({
        color: 0xfff2c8,
        emissive: 0xffd27a,
        emissiveIntensity: 0.35,
        roughness: 0.3
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
        p.set(x, 2.3, ZONES.sidewalk + 0.8);
        m.compose(p, q, s);
        poleMesh.setMatrixAt(i, m);
        p.y = 4.6;
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

