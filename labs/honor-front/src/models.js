/**
 * Modelos 3D construídos por código — nenhum GLB externo.
 * Soldados, armas em first-person, casamatas, vila e o canhão.
 */

import * as THREE from 'three';
import {
    stoneTexture, concreteTexture, woodTexture, metalTexture,
    roofTexture, flagTexture
} from './textures.js';

const matCache = new Map();

export function std(color, roughness = 0.82, metalness = 0.04, extra = {}) {
    const key = `s:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`;
    if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
    }
    return matCache.get(key);
}

function mapped(map, color = 0xffffff, roughness = 0.88, metalness = 0.04) {
    return new THREE.MeshStandardMaterial({ map, color, roughness, metalness });
}

function shadows(root, cast = true) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = cast;
            c.receiveShadow = true;
        }
    });
}

const GEO = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    sph: new THREE.SphereGeometry(1, 10, 8),
    cone: new THREE.ConeGeometry(1, 1, 8)
};

function mesh(geo, mat, x, y, z, sx, sy, sz) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (sx !== undefined) m.scale.set(sx, sy, sz);
    return m;
}

/* ------------------------------------------------------------------ */
/* Personagens                                                         */
/* ------------------------------------------------------------------ */

export function buildSoldier({ team = 'axis' } = {}) {
    const group = new THREE.Group();
    const skin = std(0xc4a07a, 0.72);
    const isAxis = team === 'axis';
    const tunic = std(isAxis ? 0x4a5340 : 0x5a5c3a, 0.9);
    const pants = std(isAxis ? 0x3a4234 : 0x4a4c32, 0.9);
    const boot = std(0x2a241c, 0.7);
    const helm = std(isAxis ? 0x3a4034 : 0x6a6e52, 0.45, 0.35);

    const hips = new THREE.Group();
    group.add(hips);

    const parts = { legs: [], arms: [], torso: null, head: null };

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.13, 0.52, 0);
        hips.add(leg);
        leg.add(mesh(GEO.cyl, pants, 0, -0.22, 0, 0.075, 0.44, 0.075));
        leg.add(mesh(GEO.box, boot, 0, -0.48, 0.05, 0.14, 0.1, 0.28));
        parts.legs.push(leg);

        const arm = new THREE.Group();
        arm.position.set(sx * 0.24, 1.18, 0);
        hips.add(arm);
        arm.add(mesh(GEO.cyl, tunic, 0, -0.22, 0, 0.055, 0.44, 0.055));
        arm.add(mesh(GEO.sph, skin, 0, -0.46, 0, 0.055, 0.055, 0.055));
        parts.arms.push(arm);
    }

    const torso = mesh(GEO.box, tunic, 0, 1.05, 0, 0.42, 0.52, 0.24);
    hips.add(torso);
    parts.torso = torso;
    hips.add(mesh(GEO.box, std(0x3a3428, 0.8), 0, 0.82, 0.13, 0.28, 0.08, 0.04));

    const head = new THREE.Group();
    head.position.set(0, 1.42, 0);
    hips.add(head);
    head.add(mesh(GEO.sph, skin, 0, 0.08, 0, 0.13, 0.15, 0.13));
    const helmet = mesh(GEO.sph, helm, 0, 0.16, 0, 0.16, 0.1, 0.17);
    head.add(helmet);
    if (isAxis) {
        const brim = mesh(GEO.cyl, helm, 0, 0.1, 0, 0.18, 0.03, 0.18);
        brim.rotation.x = Math.PI / 2;
        brim.scale.set(1, 0.7, 1);
        head.add(brim);
    }
    parts.head = head;

    const rifle = buildWorldRifle(isAxis);
    rifle.position.set(0.02, -0.42, 0.28);
    rifle.rotation.set(-0.15, 0.1, 0.15);
    parts.arms[1].add(rifle);
    parts.rifle = rifle;

    shadows(group);
    group.userData.parts = parts;
    return group;
}

function buildWorldRifle(mg = false) {
    const g = new THREE.Group();
    const wood = mapped(woodTexture(), 0xc4a070, 0.82);
    const metal = mapped(metalTexture(), 0x6a7078, 0.4, 0.7);
    g.add(mesh(GEO.box, wood, 0, 0, 0.05, 0.05, 0.07, 0.55));
    g.add(mesh(GEO.cyl, metal, 0, 0.02, 0.42, 0.018, 0.55, 0.018));
    g.children[1].rotation.x = Math.PI / 2;
    if (mg) g.add(mesh(GEO.box, metal, 0, -0.02, 0.1, 0.08, 0.05, 0.12));
    return g;
}

/* ------------------------------------------------------------------ */
/* Armas em first-person                                               */
/* ------------------------------------------------------------------ */

export function buildViewGarand() {
    const root = new THREE.Group();
    const wood = mapped(woodTexture(), 0xb8894a, 0.78);
    const metal = mapped(metalTexture(), 0x8a9098, 0.35, 0.75);
    const dark = std(0x2a2c30, 0.4, 0.6);

    const stock = mesh(GEO.box, wood, 0.12, -0.06, 0.28, 0.07, 0.14, 0.55);
    stock.rotation.z = 0.08;
    root.add(stock);
    root.add(mesh(GEO.box, wood, 0.05, -0.02, -0.12, 0.06, 0.08, 0.42));
    const barrel = mesh(GEO.cyl, metal, 0.05, 0.02, -0.55, 0.016, 0.72, 0.016);
    barrel.rotation.x = Math.PI / 2;
    root.add(barrel);
    root.add(mesh(GEO.box, dark, 0.05, 0.05, -0.22, 0.045, 0.05, 0.18));
    root.add(mesh(GEO.box, metal, 0.05, 0.045, -0.88, 0.01, 0.04, 0.02));
    root.add(mesh(GEO.box, metal, 0.03, 0.05, -0.18, 0.004, 0.05, 0.004));
    root.add(mesh(GEO.box, metal, 0.07, 0.05, -0.18, 0.004, 0.05, 0.004));

    const hands = buildHands();
    hands.position.set(0.02, -0.12, 0.02);
    root.add(hands);

    root.position.set(0.22, -0.2, -0.42);
    root.rotation.set(0.04, 0.08, 0.02);
    return root;
}

export function buildViewThompson() {
    const root = new THREE.Group();
    const wood = mapped(woodTexture(), 0x8a5a32, 0.8);
    const metal = mapped(metalTexture(), 0x4a4e52, 0.4, 0.7);

    root.add(mesh(GEO.box, wood, 0.08, -0.08, 0.18, 0.06, 0.14, 0.28));
    root.add(mesh(GEO.box, metal, 0.06, 0.0, -0.12, 0.07, 0.08, 0.42));
    const barrel = mesh(GEO.cyl, metal, 0.06, 0.02, -0.48, 0.018, 0.38, 0.018);
    barrel.rotation.x = Math.PI / 2;
    root.add(barrel);
    root.add(mesh(GEO.box, metal, 0.06, -0.12, -0.05, 0.05, 0.18, 0.08));
    root.add(mesh(GEO.cyl, wood, 0.06, -0.1, 0.02, 0.03, 0.16, 0.03));

    const hands = buildHands();
    hands.position.set(0.0, -0.14, 0.0);
    root.add(hands);

    root.position.set(0.2, -0.18, -0.4);
    return root;
}

function buildHands() {
    const g = new THREE.Group();
    const skin = std(0xd0a07a, 0.7);
    const sleeve = std(0x4a5238, 0.9);
    const r = new THREE.Group();
    r.position.set(0.08, 0.02, 0.18);
    r.add(mesh(GEO.cyl, sleeve, 0, 0.05, 0.08, 0.045, 0.16, 0.045));
    r.add(mesh(GEO.sph, skin, 0, -0.02, -0.02, 0.05, 0.045, 0.06));
    g.add(r);
    const l = new THREE.Group();
    l.position.set(-0.04, 0.04, -0.12);
    l.add(mesh(GEO.cyl, sleeve, 0, 0.04, 0.06, 0.042, 0.14, 0.042));
    l.add(mesh(GEO.sph, skin, 0, 0.0, -0.04, 0.048, 0.04, 0.055));
    g.add(l);
    return g;
}

/* ------------------------------------------------------------------ */
/* Veículo e cenário                                                   */
/* ------------------------------------------------------------------ */

export function buildHiggins() {
    const g = new THREE.Group();
    const steel = mapped(metalTexture(), 0x5a6048, 0.55, 0.45);
    const dark = std(0x3a3e32, 0.7, 0.3);
    g.add(mesh(GEO.box, steel, 0, 0.55, 0, 3.2, 1.1, 8.4));
    g.add(mesh(GEO.box, dark, 0, 1.15, 0, 3.05, 0.18, 8.1));
    g.add(mesh(GEO.box, steel, -1.55, 1.35, 0, 0.12, 0.7, 8.2));
    g.add(mesh(GEO.box, steel, 1.55, 1.35, 0, 0.12, 0.7, 8.2));
    g.add(mesh(GEO.box, steel, 0, 1.35, -4.05, 3.2, 0.7, 0.12));
    const ramp = new THREE.Group();
    ramp.position.set(0, 0.7, 4.15);
    ramp.add(mesh(GEO.box, dark, 0, 0.55, 0, 2.7, 0.1, 1.15));
    g.add(ramp);
    g.userData.ramp = ramp;
    shadows(g);
    return g;
}

export function buildHedgehog() {
    const g = new THREE.Group();
    const rust = mapped(metalTexture(), 0x6a4a32, 0.55, 0.5);
    const beam = (rx, ry, rz) => {
        const m = mesh(GEO.box, rust, 0, 0.7, 0, 0.16, 2.1, 0.16);
        m.rotation.set(rx, ry, rz);
        g.add(m);
    };
    beam(0.7, 0.2, 0.4);
    beam(-0.6, 0.8, -0.3);
    beam(0.15, -0.5, 0.9);
    shadows(g);
    return g;
}

export function buildSandbags() {
    const g = new THREE.Group();
    const bag = std(0x8a7a52, 0.92);
    for (let i = 0; i < 5; i++) {
        g.add(mesh(GEO.cyl, bag, (i - 2) * 0.42, 0.16, 0, 0.2, 0.32, 0.2));
        g.children[i].rotation.z = Math.PI / 2;
    }
    for (let i = 0; i < 4; i++) {
        g.add(mesh(GEO.cyl, bag, (i - 1.5) * 0.42, 0.42, 0, 0.18, 0.3, 0.18));
        g.children[5 + i].rotation.z = Math.PI / 2;
    }
    shadows(g);
    return g;
}

export function buildBunker() {
    const g = new THREE.Group();
    const conc = mapped(concreteTexture(), 0xb0aa98, 0.9);
    g.add(mesh(GEO.box, conc, 0, 1.35, 0, 7.2, 2.7, 5.4));
    g.add(mesh(GEO.box, conc, 0, 2.85, 0, 7.6, 0.35, 5.8));
    const slit = mesh(GEO.box, std(0x101208), 0, 1.7, 2.72, 3.4, 0.38, 0.2);
    g.add(slit);
    g.add(mesh(GEO.box, conc, -2.4, 1.1, 3.1, 1.6, 2.2, 1.2));
    g.add(mesh(GEO.box, conc, 2.4, 1.1, 3.1, 1.6, 2.2, 1.2));
    shadows(g);
    return g;
}

export function buildHouse({ w = 6.4, d = 5.2, h = 3.4, roofH = 2.1 } = {}) {
    const g = new THREE.Group();
    const wall = mapped(stoneTexture(), 0xd4c8b0, 0.88);
    const roof = mapped(roofTexture(), 0xffffff, 0.8);
    const dark = std(0x2a241c, 0.7);
    g.add(mesh(GEO.box, wall, 0, h * 0.5, 0, w, h, d));
    const roofM = mesh(GEO.cone, roof, 0, h + roofH * 0.42, 0, w * 0.72, roofH, d * 0.72);
    g.add(roofM);
    g.add(mesh(GEO.box, dark, 0, 1.05, d * 0.51, 1.1, 2.1, 0.12));
    g.add(mesh(GEO.box, std(0x7a90a8, 0.3, 0.2), -w * 0.22, 1.8, d * 0.51, 0.8, 0.9, 0.08));
    g.add(mesh(GEO.box, std(0x7a90a8, 0.3, 0.2), w * 0.22, 1.8, d * 0.51, 0.8, 0.9, 0.08));
    shadows(g);
    return g;
}

export function buildChurch() {
    const g = new THREE.Group();
    const wall = mapped(stoneTexture(), 0xe8dcc8, 0.86);
    const roof = mapped(roofTexture(), 0x6a4030, 0.78);
    g.add(mesh(GEO.box, wall, 0, 2.4, 0, 7.5, 4.8, 12));
    g.add(mesh(GEO.cone, roof, 0, 5.6, 0, 5.6, 2.4, 8.5));
    g.add(mesh(GEO.box, wall, 0, 5.2, -4.2, 2.4, 6.4, 2.4));
    g.add(mesh(GEO.cone, roof, 0, 9.1, -4.2, 1.8, 2.2, 1.8));
    g.add(mesh(GEO.box, std(0x2a2418), 0, 1.4, 6.05, 1.4, 2.8, 0.15));
    shadows(g);
    return g;
}

export function buildCoastalGun() {
    const g = new THREE.Group();
    const steel = mapped(metalTexture(), 0x4a4e46, 0.4, 0.65);
    const dark = std(0x2e322c, 0.5, 0.4);
    g.add(mesh(GEO.box, dark, 0, 0.7, 0, 2.8, 1.1, 3.6));
    const barrel = mesh(GEO.cyl, steel, 0, 1.35, 2.4, 0.22, 7.2, 0.22);
    barrel.rotation.x = Math.PI / 2;
    barrel.rotation.x -= 0.12;
    g.add(barrel);
    g.add(mesh(GEO.cyl, steel, 0, 1.35, -0.2, 0.42, 0.7, 0.42));
    g.add(mesh(GEO.box, dark, -1.3, 0.45, 0.4, 0.5, 0.9, 1.6));
    g.add(mesh(GEO.box, dark, 1.3, 0.45, 0.4, 0.5, 0.9, 1.6));
    shadows(g);
    return g;
}

export function buildFlag(colors) {
    const g = new THREE.Group();
    const pole = mesh(GEO.cyl, std(0x8a8a80, 0.4, 0.5), 0, 2.4, 0, 0.04, 4.8, 0.04);
    g.add(pole);
    const cloth = mesh(GEO.box, mapped(flagTexture(colors), 0xffffff, 0.85), 0.7, 4.15, 0, 1.4, 0.85, 0.04);
    g.add(cloth);
    g.userData.cloth = cloth;
    shadows(g, false);
    pole.castShadow = true;
    return g;
}

export function buildPine() {
    const g = new THREE.Group();
    const bark = mapped(woodTexture(), 0x5a4030, 0.9);
    const leaf = std(0x2a3e22, 0.88);
    g.add(mesh(GEO.cyl, bark, 0, 1.1, 0, 0.18, 2.2, 0.18));
    g.add(mesh(GEO.cone, leaf, 0, 2.6, 0, 1.35, 2.4, 1.35));
    g.add(mesh(GEO.cone, leaf, 0, 3.7, 0, 0.95, 1.8, 0.95));
    g.add(mesh(GEO.cone, leaf, 0, 4.6, 0, 0.55, 1.3, 0.55));
    shadows(g);
    return g;
}

export function buildCrate() {
    const g = new THREE.Group();
    const wood = mapped(woodTexture(), 0x8a6a3a, 0.85);
    g.add(mesh(GEO.box, wood, 0, 0.28, 0, 0.7, 0.55, 0.55));
    shadows(g);
    return g;
}

export function buildMedkit() {
    const g = new THREE.Group();
    g.add(mesh(GEO.box, std(0xc4c4c0, 0.7), 0, 0.12, 0, 0.38, 0.22, 0.26));
    g.add(mesh(GEO.box, std(0xa82828), 0, 0.24, 0, 0.18, 0.04, 0.06));
    g.add(mesh(GEO.box, std(0xa82828), 0, 0.24, 0, 0.06, 0.04, 0.18));
    return g;
}

export function buildWirePost() {
    const g = new THREE.Group();
    const wood = mapped(woodTexture(), 0x5a4a32, 0.9);
    g.add(mesh(GEO.cyl, wood, 0, 0.55, 0, 0.05, 1.1, 0.05));
    const wire = std(0x2a2a28, 0.4, 0.6);
    for (let i = 0; i < 3; i++) {
        g.add(mesh(GEO.box, wire, 0.6, 0.25 + i * 0.28, 0, 1.2, 0.012, 0.012));
    }
    shadows(g, false);
    return g;
}

export function buildFlareGunStand() {
    const g = new THREE.Group();
    const metal = mapped(metalTexture(), 0x6a5040, 0.45, 0.55);
    g.add(mesh(GEO.cyl, metal, 0, 0.45, 0, 0.08, 0.9, 0.08));
    g.add(mesh(GEO.box, metal, 0, 0.95, 0.1, 0.12, 0.08, 0.4));
    shadows(g);
    return g;
}

export function buildGrenade() {
    const g = new THREE.Group();
    g.add(mesh(GEO.sph, std(0x4a5a38, 0.55, 0.3), 0, 0, 0, 0.07, 0.08, 0.07));
    g.add(mesh(GEO.cyl, std(0x8a8a80, 0.4, 0.6), 0, 0.08, 0, 0.025, 0.06, 0.025));
    return g;
}

export function buildShip() {
    const g = new THREE.Group();
    const hull = std(0x2a2e28, 0.7);
    g.add(mesh(GEO.box, hull, 0, 0.8, 0, 6, 1.4, 18));
    g.add(mesh(GEO.box, hull, 0, 2.0, -2, 3.2, 1.6, 6));
    g.add(mesh(GEO.cyl, std(0x3a3a36), -0.8, 3.4, -2, 0.25, 2.4, 0.25));
    g.add(mesh(GEO.cyl, std(0x3a3a36), 0.8, 3.4, -1.2, 0.22, 2.0, 0.22));
    return g;
}
