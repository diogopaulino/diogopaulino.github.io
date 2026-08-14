/**
 * Marcos e props de Manhattan — primitivas empilhadas, sem GLB.
 */

import * as THREE from 'three';
import { PALETTE } from './config.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const CONE = new THREE.ConeGeometry(1, 1, 8);

function mesh(geo, mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function createMaterials(windowMap, facadeMap) {
    return {
        glass: new THREE.MeshStandardMaterial({
            color: 0x1a2230,
            map: windowMap,
            emissiveMap: windowMap,
            emissive: new THREE.Color(PALETTE.window),
            emissiveIntensity: 1.15,
            roughness: 0.38,
            metalness: 0.42
        }),
        stone: new THREE.MeshStandardMaterial({
            color: 0x2a2e38,
            map: facadeMap,
            roughness: 0.86,
            metalness: 0.08
        }),
        brick: new THREE.MeshStandardMaterial({
            color: 0x3a2a24,
            roughness: 0.9,
            metalness: 0.04
        }),
        dark: new THREE.MeshStandardMaterial({
            color: 0x12151c,
            roughness: 0.78,
            metalness: 0.2
        }),
        light: new THREE.MeshStandardMaterial({
            color: 0xc8d0dc,
            roughness: 0.35,
            metalness: 0.45
        }),
        gold: new THREE.MeshBasicMaterial({
            color: PALETTE.pulse,
            toneMapped: false
        }),
        red: new THREE.MeshBasicMaterial({
            color: PALETTE.suit,
            toneMapped: false
        }),
        neon: new THREE.MeshBasicMaterial({
            color: 0xff3b4a,
            toneMapped: false
        }),
        taxi: new THREE.MeshStandardMaterial({
            color: 0xf0c22e,
            roughness: 0.45,
            metalness: 0.25,
            emissive: 0x3a2e08,
            emissiveIntensity: 0.35
        }),
        water: new THREE.MeshStandardMaterial({
            color: 0x6a6e74,
            roughness: 0.55,
            metalness: 0.4
        }),
        tree: new THREE.MeshStandardMaterial({
            color: 0x163820,
            roughness: 0.9,
            emissive: 0x041208,
            emissiveIntensity: 0.25
        }),
        trunk: new THREE.MeshStandardMaterial({
            color: 0x3a2a18,
            roughness: 0.9
        })
    };
}

export function collider(minX, minY, minZ, maxX, maxY, maxZ) {
    return { minX, minY, minZ, maxX, maxY, maxZ };
}

export function boxCollider(x, y, z, sx, sy, sz) {
    return collider(
        x - sx * 0.5, y - sy * 0.5, z - sz * 0.5,
        x + sx * 0.5, y + sy * 0.5, z + sz * 0.5
    );
}

export function createEmpire(mats, x, z) {
    const g = new THREE.Group();
    const h1 = 92;
    const h2 = 70;
    const h3 = 110;
    const spire = 78;
    g.add(mesh(BOX, mats.stone, 22, h1, 22, x, h1 / 2, z));
    g.add(mesh(BOX, mats.facade || mats.glass, 16, h2, 16, x, h1 + h2 / 2, z));
    g.add(mesh(BOX, mats.facade || mats.glass, 10, h3, 10, x, h1 + h2 + h3 / 2, z));
    const mastY = h1 + h2 + h3 + spire / 2;
    g.add(mesh(CYL, mats.light, 0.7, spire, 0.7, x, mastY, z));
    const beacon = mesh(CYL, mats.red, 1.4, 3.2, 1.4, x, h1 + h2 + h3 + spire + 2, z);
    g.add(beacon);
    const colliders = [
        boxCollider(x, h1 / 2, z, 22, h1, 22),
        boxCollider(x, h1 + h2 / 2, z, 16, h2, 16),
        boxCollider(x, h1 + h2 + h3 / 2, z, 10, h3, 10)
    ];
    return { group: g, colliders, height: h1 + h2 + h3 + spire, beacon };
}

export function createChrysler(mats, x, z) {
    const g = new THREE.Group();
    g.add(mesh(BOX, mats.stone, 20, 88, 20, x, 44, z));
    g.add(mesh(BOX, mats.facade || mats.glass, 14, 72, 14, x, 88 + 36, z));
    g.add(mesh(BOX, mats.light, 8, 28, 8, x, 88 + 72 + 14, z));
    const crownY = 88 + 72 + 28 + 10;
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const arch = mesh(BOX, mats.light, 0.7, 18, 4.5, x + Math.cos(a) * 5, crownY, z + Math.sin(a) * 5);
        arch.lookAt(x, crownY, z);
        g.add(arch);
    }
    g.add(mesh(CYL, mats.gold, 0.5, 36, 0.5, x, crownY + 22, z));
    const colliders = [
        boxCollider(x, 44, z, 20, 88, 20),
        boxCollider(x, 88 + 36, z, 14, 72, 14),
        boxCollider(x, 88 + 72 + 14, z, 8, 28, 8)
    ];
    return { group: g, colliders, height: 230 };
}

export function createWTC(mats, x, z) {
    const g = new THREE.Group();
    const h = 310;
    const prism = mesh(BOX, mats.facade || mats.glass, 18, h, 18, x, h / 2, z);
    prism.rotation.y = Math.PI / 8;
    g.add(prism);
    g.add(mesh(CYL, mats.light, 0.55, 70, 0.55, x, h + 35, z));
    g.add(mesh(CYL, mats.gold, 1.1, 4, 1.1, x, h + 72, z));
    const colliders = [boxCollider(x, h / 2, z, 22, h, 22)];
    return { group: g, colliders, height: h + 70 };
}

export function createFlatiron(mats, x, z) {
    const g = new THREE.Group();
    const h = 62;
    const body = mesh(BOX, mats.brick, 10, h, 28, x, h / 2, z);
    body.rotation.y = 0.45;
    g.add(body);
    g.add(mesh(BOX, mats.stone, 8, 6, 8, x, h + 3, z));
    const colliders = [boxCollider(x, h / 2, z, 18, h, 24)];
    return { group: g, colliders, height: h + 6 };
}

export function createBridge(mats, x, z) {
    const g = new THREE.Group();
    const span = 220;
    const towerH = 78;
    const t1z = z - 48;
    const t2z = z + 48;
    for (const tz of [t1z, t2z]) {
        g.add(mesh(BOX, mats.stone, 8, towerH, 6, x, towerH / 2, tz));
        g.add(mesh(BOX, mats.stone, 14, 8, 6, x, 52, tz));
    }
    g.add(mesh(BOX, mats.dark, 10, 1.6, span, x, 28, z));
    const cableMat = new THREE.MeshBasicMaterial({ color: 0xc8d0dc, toneMapped: false });
    const cableGeo = new THREE.CylinderGeometry(0.12, 0.12, 1, 4);
    for (const tz of [t1z, t2z]) {
        for (const sx of [-3.2, 3.2]) {
            for (let i = -10; i <= 10; i++) {
                const pz = z + i * (span / 22);
                const top = 72;
                const deck = 28.8;
                const c = new THREE.Mesh(cableGeo, cableMat);
                const dy = top - deck;
                const dz = tz - pz;
                const len = Math.hypot(dy, dz);
                c.scale.set(1, len, 1);
                c.position.set(x + sx, (top + deck) / 2, (tz + pz) / 2);
                c.rotation.x = Math.atan2(dz, dy);
                g.add(c);
            }
        }
    }
    const colliders = [
        boxCollider(x, towerH / 2, t1z, 8, towerH, 6),
        boxCollider(x, towerH / 2, t2z, 8, towerH, 6),
        boxCollider(x, 28, z, 10, 1.6, span)
    ];
    return { group: g, colliders, height: towerH };
}

export function createLiberty(mats, x, z) {
    const g = new THREE.Group();
    g.add(mesh(CYL, mats.stone, 9, 6, 9, x, 3, z));
    g.add(mesh(CYL, mats.light, 3.2, 18, 3.2, x, 15, z));
    g.add(mesh(BOX, mats.light, 1.2, 8, 3.5, x, 28, z));
    const arm = mesh(CYL, mats.light, 0.7, 10, 0.7, x + 4.5, 30, z);
    arm.rotation.z = -0.9;
    g.add(arm);
    g.add(mesh(CYL, mats.gold, 1.1, 2.4, 1.1, x + 8.2, 34.5, z));
    const colliders = [boxCollider(x, 10, z, 10, 20, 10)];
    return { group: g, colliders, height: 36 };
}

export function createWaterTower() {
    const g = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 2.6, 8), wood);
    tank.position.y = 2.4;
    g.add(tank);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.55, 0.8, 8), wood);
    cap.position.y = 4.1;
    g.add(cap);
    for (const sx of [-1.1, 1.1]) {
        for (const sz of [-1.1, 1.1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 4), wood);
            leg.position.set(sx, 1.1, sz);
            g.add(leg);
        }
    }
    return g;
}

export function createTaxi() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({
        color: 0xf0c22e, roughness: 0.5, metalness: 0.2, emissive: 0x3a2a00, emissiveIntensity: 0.3
    }));
    body.scale.set(2.2, 0.85, 4.4);
    body.position.y = 0.55;
    g.add(body);
    const cabin = new THREE.Mesh(BOX, new THREE.MeshStandardMaterial({
        color: 0x1a2430, roughness: 0.25, metalness: 0.4, emissive: 0x223344, emissiveIntensity: 0.2
    }));
    cabin.scale.set(1.9, 0.7, 2.2);
    cabin.position.set(0, 1.2, -0.2);
    g.add(cabin);
    const light = new THREE.Mesh(BOX, new THREE.MeshBasicMaterial({ color: 0xf4c15d, toneMapped: false }));
    light.scale.set(0.6, 0.18, 0.8);
    light.position.set(0, 1.62, 0);
    g.add(light);
    return g;
}
