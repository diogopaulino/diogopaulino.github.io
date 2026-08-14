/**
 * Modelos 3D construídos por código — nenhum GLB externo.
 * Hobbit, mago, cavaleiro negro, goblin, tocas, árvores e arquitetura.
 */

import * as THREE from 'three';
import {
    grassTexture, barkTexture, leafTexture, stoneTexture, marbleTexture,
    woodTexture, goldTexture, doorTexture, brickTexture
} from './textures.js';

const matCache = new Map();

function mat(key, factory) {
    if (!matCache.has(key)) matCache.set(key, factory());
    return matCache.get(key);
}

export function std(color, roughness = 0.78, metalness = 0.04, extra = {}) {
    return mat(`std:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`, () =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
}

function mapped(map, color = 0xffffff, roughness = 0.88) {
    return new THREE.MeshStandardMaterial({ map, color, roughness, metalness: 0.02 });
}

function enableShadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

/* ------------------------------------------------------------------ */
/* Personagens                                                         */
/* ------------------------------------------------------------------ */

export function buildHobbit({ vest = 0xc45a2a, pants = 0x3d4a28 } = {}) {
    const group = new THREE.Group();
    const skin = std(0xe8b889, 0.72);
    const hair = std(0x6b3a18, 0.9);
    const clothV = std(vest, 0.86);
    const clothP = std(pants, 0.88);
    const foot = std(0xd4a07a, 0.8);

    const hips = new THREE.Group();
    group.add(hips);

    const parts = { legs: [], arms: [], feet: [] };

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.12, 0.38, 0);
        hips.add(leg);
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.34, 8), clothP);
        thigh.position.y = -0.17;
        leg.add(thigh);
        const footM = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), foot);
        footM.scale.set(1.15, 0.55, 1.55);
        footM.position.set(0, -0.36, 0.05);
        leg.add(footM);
        parts.legs.push(leg);
        parts.feet.push(footM);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.4;
    hips.add(torso);

    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), clothV);
    belly.scale.set(1.05, 0.85, 0.9);
    belly.position.y = 0.22;
    torso.add(belly);

    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.18, 10), std(0xf2e4c4, 0.9));
    shirt.position.y = 0.38;
    torso.add(shirt);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 14), std(0x5a3a18, 0.7, 0.1));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.12;
    torso.add(belt);

    const head = new THREE.Group();
    head.position.y = 0.58;
    torso.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
    head.add(skull);

    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skin);
        ear.scale.set(0.7, 1.1, 0.5);
        ear.position.set(sx * 0.16, 0.02, 0);
        head.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(0xf7f2ea, 0.4));
        eye.position.set(sx * 0.05, 0.02, 0.14);
        head.add(eye);
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 5), std(0x2a4a18, 0.45));
        iris.position.set(sx * 0.05, 0.02, 0.16);
        head.add(iris);
    }

    for (let i = 0; i < 14; i++) {
        const curl = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), hair);
        const a = (i / 14) * Math.PI * 2;
        curl.position.set(Math.cos(a) * 0.14, 0.1 + Math.sin(i * 2.1) * 0.04, Math.sin(a) * 0.12);
        head.add(curl);
    }
    const bang = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), hair);
    bang.position.set(0, 0.12, 0.1);
    head.add(bang);

    const armGeo = new THREE.CylinderGeometry(0.055, 0.048, 0.32, 8);
    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.26, 0.42, 0);
        torso.add(arm);
        const mesh = new THREE.Mesh(armGeo, skin);
        mesh.position.y = -0.16;
        arm.add(mesh);
        parts.arms.push(arm);
    }

    const ringGlow = new THREE.Mesh(
        new THREE.TorusGeometry(0.07, 0.018, 8, 20),
        new THREE.MeshStandardMaterial({
            map: goldTexture(),
            color: 0xffe08a,
            emissive: 0xffaa22,
            emissiveIntensity: 0.8,
            metalness: 1,
            roughness: 0.22
        })
    );
    ringGlow.rotation.x = Math.PI / 2;
    ringGlow.position.set(0.08, 0.28, 0.22);
    ringGlow.visible = false;
    torso.add(ringGlow);

    enableShadows(group);
    group.userData.parts = { ...parts, torso, head, hips, ring: ringGlow };
    return { group, parts: group.userData.parts };
}

export function buildWizard() {
    const group = new THREE.Group();
    const robe = std(0x9aa3ad, 0.9);
    const skin = std(0xe0c4a0, 0.7);
    const beard = std(0xe8e4d8, 0.92);

    const body = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.7, 10), robe);
    body.position.y = 0.85;
    group.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skin);
    head.position.y = 1.72;
    group.add(head);

    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.7, 8), robe);
    hat.position.y = 2.12;
    hat.rotation.z = 0.12;
    group.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.04, 12), robe);
    brim.position.y = 1.82;
    group.add(brim);

    const beardM = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 8), beard);
    beardM.position.set(0, 1.42, 0.08);
    beardM.rotation.x = Math.PI;
    group.add(beardM);

    const staff = new THREE.Group();
    staff.position.set(0.38, 0, 0.1);
    group.add(staff);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 2.15, 6), std(0x5a3a22, 0.85));
    shaft.position.y = 1.05;
    staff.add(shaft);
    const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1),
        new THREE.MeshStandardMaterial({
            color: 0xa8d8ff,
            emissive: 0x4aa0ff,
            emissiveIntensity: 2.2,
            roughness: 0.2,
            metalness: 0.3
        })
    );
    crystal.position.y = 2.18;
    staff.add(crystal);

    enableShadows(group);
    group.userData.parts = { staff, crystal };
    return { group, parts: group.userData.parts };
}

export function buildElf({ robe = 0xc8d8c0 } = {}) {
    const group = new THREE.Group();
    const skin = std(0xf0d8c0, 0.65);
    const cloth = std(robe, 0.82);
    const hair = std(0xe8d080, 0.55);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.35, 8), cloth);
    body.position.y = 0.72;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin);
    head.position.y = 1.52;
    group.add(head);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), skin);
        ear.position.set(sx * 0.12, 1.54, 0);
        ear.rotation.z = sx * -0.9;
        group.add(ear);
    }
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), hair);
    hairM.position.y = 1.6;
    hairM.scale.set(1, 0.7, 1.1);
    group.add(hairM);
    enableShadows(group);
    return { group };
}

export function buildCompanion() {
    return buildHobbit({ vest: 0x3a6a38, pants: 0x4a3a22 });
}

export function buildGoblin() {
    const group = new THREE.Group();
    const skin = std(0x5a7a3a, 0.8);
    const dark = std(0x2a2218, 0.9);

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), dark);
    body.position.y = 0.55;
    body.scale.set(1, 1.2, 0.8);
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), skin);
    head.position.y = 0.95;
    group.add(head);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), skin);
        ear.position.set(sx * 0.18, 1.05, 0);
        ear.rotation.z = sx * -0.7;
        group.add(ear);
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 5),
            new THREE.MeshStandardMaterial({ color: 0xffee88, emissive: 0xffcc33, emissiveIntensity: 2 })
        );
        eye.position.set(sx * 0.07, 0.98, 0.16);
        group.add(eye);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.4, 6), skin);
        arm.position.set(sx * 0.28, 0.55, 0);
        arm.rotation.z = sx * 0.4;
        group.add(arm);
    }
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.45, 5), std(0xb0b8c0, 0.3, 0.85));
    blade.position.set(0.38, 0.45, 0.1);
    blade.rotation.x = 0.4;
    group.add(blade);
    enableShadows(group);
    group.userData.hp = 2;
    return { group };
}

export function buildNazgul() {
    const group = new THREE.Group();
    const black = std(0x0a0a0c, 0.95, 0.05, { emissive: 0x050508, emissiveIntensity: 0.2 });

    const horse = new THREE.Group();
    group.add(horse);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), black);
    body.scale.set(1.6, 0.85, 0.7);
    body.position.y = 0.85;
    horse.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 0.7, 8), black);
    neck.position.set(0.7, 1.2, 0);
    neck.rotation.z = -0.7;
    horse.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), black);
    head.scale.set(1.4, 0.7, 0.6);
    head.position.set(1.05, 1.48, 0);
    horse.add(head);
    for (const sx of [-1, 1]) {
        for (const z of [-0.22, 0.22]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.85, 6), black);
            leg.position.set(sx * 0.35, 0.42, z);
            horse.add(leg);
        }
    }

    const rider = new THREE.Group();
    rider.position.set(-0.05, 1.15, 0);
    group.add(rider);
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.15, 8), black);
    cloak.position.y = 0.55;
    rider.add(cloak);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), black);
    hood.position.y = 1.12;
    rider.add(hood);
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.035, 6, 5),
            new THREE.MeshStandardMaterial({
                color: 0xffe8a0,
                emissive: 0xffcc66,
                emissiveIntensity: 3.5
            })
        );
        eye.position.set(sx * 0.06, 1.14, 0.16);
        rider.add(eye);
    }

    enableShadows(group);
    group.userData.parts = { horse, rider };
    return { group, parts: group.userData.parts };
}

/* ------------------------------------------------------------------ */
/* Cenário                                                             */
/* ------------------------------------------------------------------ */

export function buildHobbitHole({ doorColor = '#2d6b38', scale = 1 } = {}) {
    const group = new THREE.Group();
    const hill = new THREE.Mesh(
        new THREE.SphereGeometry(2.4, 16, 12),
        mapped(grassTexture(), 0x7aab48)
    );
    hill.scale.set(1.35, 0.72, 1.15);
    hill.position.y = 0.4;
    group.add(hill);

    const facade = new THREE.Mesh(
        new THREE.CylinderGeometry(1.05, 1.05, 0.18, 20),
        mapped(woodTexture(), 0xc4a06a)
    );
    facade.rotation.x = Math.PI / 2;
    facade.position.set(0, 0.85, 1.55);
    group.add(facade);

    const door = new THREE.Mesh(
        new THREE.CylinderGeometry(0.72, 0.72, 0.08, 22),
        new THREE.MeshStandardMaterial({ map: doorTexture(doorColor), roughness: 0.7 })
    );
    door.rotation.x = Math.PI / 2;
    door.position.set(0, 0.85, 1.66);
    group.add(door);

    const window = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.06, 12),
        new THREE.MeshStandardMaterial({
            color: 0xffe8a8,
            emissive: 0xffcc66,
            emissiveIntensity: 0.7,
            roughness: 0.3
        })
    );
    window.rotation.x = Math.PI / 2;
    window.position.set(1.15, 1.15, 0.9);
    group.add(window);

    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.7, 8), mapped(brickTexture()));
    chimney.position.set(-0.6, 2.0, -0.2);
    group.add(chimney);

    const smoke = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xccc8c0, transparent: true, opacity: 0.35, depthWrite: false })
    );
    smoke.position.set(-0.6, 2.5, -0.2);
    group.add(smoke);

    group.scale.setScalar(scale);
    enableShadows(group);
    group.userData.parts = { door, smoke };
    return { group, parts: group.userData.parts };
}

export function buildOak({ autumn = false } = {}) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.4, 2.4, 8),
        mapped(barkTexture(), 0x8a6a48)
    );
    trunk.position.y = 1.2;
    group.add(trunk);
    const leafMat = mapped(leafTexture(autumn ? '#c45a22' : '#2f6a24'), autumn ? 0xd47830 : 0x4a8a32);
    const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55, 1), leafMat);
    canopy.position.y = 2.7;
    canopy.scale.set(1.2, 0.9, 1.15);
    group.add(canopy);
    const canopy2 = new THREE.Mesh(new THREE.IcosahedronGeometry(1.1, 1), leafMat);
    canopy2.position.set(0.6, 2.4, 0.3);
    group.add(canopy2);
    enableShadows(group);
    return group;
}

export function buildPine() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, 2.1, 7),
        mapped(barkTexture(), 0x6a4a32)
    );
    trunk.position.y = 1.05;
    group.add(trunk);
    const leaf = mapped(leafTexture('#1e4a28'), 0x2a5a30);
    for (let i = 0; i < 4; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.15 - i * 0.18, 1.15, 8), leaf);
        cone.position.y = 1.7 + i * 0.7;
        group.add(cone);
    }
    enableShadows(group);
    return group;
}

export function buildPartyTree() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.8, 4.2, 10),
        mapped(barkTexture(), 0x8a6a48)
    );
    trunk.position.y = 2.1;
    group.add(trunk);
    const leaf = mapped(leafTexture('#2f6a24'), 0x4a8a32);
    for (let i = 0; i < 5; i++) {
        const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 1), leaf);
        const a = (i / 5) * Math.PI * 2;
        blob.position.set(Math.cos(a) * 1.3, 4.4 + (i % 2) * 0.5, Math.sin(a) * 1.3);
        blob.scale.setScalar(0.85 + (i % 3) * 0.12);
        group.add(blob);
    }
    const lanterns = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const lantern = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 6),
            new THREE.MeshStandardMaterial({
                color: 0xffe8a0,
                emissive: 0xffaa44,
                emissiveIntensity: 1.8,
                roughness: 0.3
            })
        );
        lantern.position.set(Math.cos(a) * 2.1, 3.1, Math.sin(a) * 2.1);
        group.add(lantern);
        lanterns.push(lantern);
    }
    enableShadows(group);
    group.userData.lanterns = lanterns;
    return group;
}

export function buildRing(scale = 1) {
    const group = new THREE.Group();
    const torus = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.07, 12, 32),
        new THREE.MeshStandardMaterial({
            map: goldTexture(),
            color: 0xffe08a,
            metalness: 1,
            roughness: 0.18,
            emissive: 0xffaa22,
            emissiveIntensity: 0.65
        })
    );
    torus.rotation.x = Math.PI / 2;
    group.add(torus);
    const glow = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.12, 8, 24),
        new THREE.MeshBasicMaterial({
            color: 0xffcc55,
            transparent: true,
            opacity: 0.22,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    );
    glow.rotation.x = Math.PI / 2;
    group.add(glow);
    group.scale.setScalar(scale);
    group.userData.glow = glow;
    return group;
}

export function buildRock(seed = 1) {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const n = 0.82 + ((Math.sin(i * 12.9898 + seed) * 43758.5453) % 1) * 0.35;
        pos.setXYZ(i, pos.getX(i) * n, pos.getY(i) * n * 0.7, pos.getZ(i) * n);
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mapped(stoneTexture(), 0x8a8680));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function buildPavilion() {
    const group = new THREE.Group();
    const marble = mapped(marbleTexture(), 0xf2eee4, 0.45);
    const gold = new THREE.MeshStandardMaterial({
        map: goldTexture(),
        metalness: 0.85,
        roughness: 0.28,
        color: 0xffe8a8
    });

    const floor = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 0.25, 16), marble);
    floor.position.y = 0.12;
    group.add(floor);

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 4.2, 10), marble);
        col.position.set(Math.cos(a) * 5.2, 2.2, Math.sin(a) * 5.2);
        group.add(col);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), gold);
        cap.position.set(Math.cos(a) * 5.2, 4.4, Math.sin(a) * 5.2);
        group.add(cap);
    }

    const roof = new THREE.Mesh(new THREE.ConeGeometry(6.8, 2.4, 8), gold);
    roof.position.y = 5.4;
    group.add(roof);

    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 8, 16, Math.PI), marble);
    arch.position.set(0, 2.2, 6.3);
    arch.rotation.x = Math.PI;
    group.add(arch);

    enableShadows(group);
    return group;
}

export function buildCouncilRing() {
    const group = new THREE.Group();
    const stone = mapped(marbleTexture(), 0xe8e0d0);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.2, 0.22, 8, 32), stone);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.2;
    group.add(ring);
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), stone);
        seat.position.set(Math.cos(a) * 3.4, 0.28, Math.sin(a) * 3.4);
        seat.lookAt(0, 0.28, 0);
        group.add(seat);
    }
    enableShadows(group);
    return group;
}

export function buildPillar(height = 14) {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#6a5a48'), 0x7a6a58);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.85, height, 8), stone);
    col.position.y = height / 2;
    group.add(col);
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.5, 2.1), stone);
    base.position.y = 0.25;
    group.add(base);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.4, 1.9), stone);
    cap.position.y = height;
    group.add(cap);
    enableShadows(group);
    return group;
}

export function buildBridge() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#5a5048'), 0x6a6058);
    const plank = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.28, 16), stone);
    plank.position.y = 0.14;
    group.add(plank);
    for (const z of [-7, 7]) {
        for (const x of [-1.1, 1.1]) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.1, 0.18), stone);
            post.position.set(x, 0.7, z);
            group.add(post);
        }
    }
    enableShadows(group);
    return group;
}

export function buildSeat() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#9a8a78'), 0xb0a090);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.5, 12), stone);
    base.position.y = 0.25;
    group.add(base);
    const back = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.28), stone);
    back.position.set(0, 1.4, -0.55);
    group.add(back);
    const sit = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.28, 1.1), stone);
    sit.position.set(0, 0.62, 0.1);
    group.add(sit);
    enableShadows(group);
    return group;
}

export function buildRuinArch() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#8a7a68'), 0x9a8a78);
    for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.55, 3.4, 0.55), stone);
        p.position.set(sx * 1.4, 1.7, 0);
        group.add(p);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.45, 0.6), stone);
    lintel.position.y = 3.5;
    group.add(lintel);
    enableShadows(group);
    return group;
}

export function buildSword() {
    const group = new THREE.Group();
    const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.7, 0.12),
        std(0xd8dee8, 0.25, 0.9)
    );
    blade.position.y = 0.4;
    group.add(blade);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.08), std(0xc9a227, 0.35, 0.8));
    group.add(guard);
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.22, 8), std(0x4a3020, 0.8));
    hilt.position.y = -0.12;
    group.add(hilt);
    return group;
}

/** Geometria de tufo de grama (dois planos cruzados) para InstancedMesh. */
export function grassBladeGeometry() {
    const geo = new THREE.PlaneGeometry(0.35, 0.55);
    geo.translate(0, 0.27, 0);
    return geo;
}

export function applyGrassWind(material, strength = 1) {
    material.userData.uTime = { value: 0 };
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = material.userData.uTime;
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                /* glsl */ `#include <common>
                uniform float uTime;`
            )
            .replace(
                '#include <begin_vertex>',
                /* glsl */ `#include <begin_vertex>
                float h = uv.y;
                transformed.x += sin(uTime * 1.6 + position.x * 0.4) * 0.12 * h * ${strength.toFixed(2)};
                transformed.z += cos(uTime * 1.3 + position.z * 0.35) * 0.08 * h * ${strength.toFixed(2)};`
            );
    };
}
