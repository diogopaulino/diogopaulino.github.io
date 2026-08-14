/**
 * Modelos 3D construídos por código — nenhum GLB externo.
 * João, mãe, mercador, Mimosa, gigante, cabana, pé de feijão, castelo e tesouros.
 */

import * as THREE from 'three';
import {
    grassTexture, barkTexture, leafTexture, thatchTexture, woodTexture,
    stoneTexture, goldTexture, cloudTexture, clothTexture
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

function enableShadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

function limb(geo, material, y) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = y;
    return mesh;
}

/* ------------------------------------------------------------------ */
/* Personagens                                                         */
/* ------------------------------------------------------------------ */

export function buildJoao() {
    const group = new THREE.Group();
    const skin = std(0xf0c49a, 0.7);
    const hair = std(0x5a3218, 0.9);
    const vest = std(0x2e7a3a, 0.86);
    const pants = std(0x6a4428, 0.88);
    const cap = std(0xc43a2a, 0.7);

    const hips = new THREE.Group();
    group.add(hips);
    const parts = { legs: [], arms: [], feet: [] };

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.11, 0.42, 0);
        hips.add(leg);
        leg.add(limb(new THREE.CylinderGeometry(0.075, 0.065, 0.38, 8), pants, -0.19));
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), std(0x3a2414, 0.85));
        foot.scale.set(1.1, 0.5, 1.5);
        foot.position.set(0, -0.4, 0.04);
        leg.add(foot);
        parts.legs.push(leg);
        parts.feet.push(foot);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.44;
    hips.add(torso);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 10), vest);
    body.position.y = 0.28;
    torso.add(body);
    const shirt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.12, 8), std(0xf2e8d0, 0.9));
    shirt.position.y = 0.48;
    torso.add(shirt);

    const head = new THREE.Group();
    head.position.y = 0.62;
    torso.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), skin));

    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), std(0xf7f2ea, 0.35));
        eye.position.set(sx * 0.05, 0.02, 0.135);
        head.add(eye);
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 5), std(0x2a5a18, 0.4));
        iris.position.set(sx * 0.05, 0.02, 0.152);
        head.add(iris);
    }
    const haircap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
    haircap.position.y = 0.04;
    head.add(haircap);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.17, 0.1, 12), cap);
    hat.position.y = 0.16;
    head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), cap);
    brim.position.y = 0.12;
    head.add(brim);

    const armGeo = new THREE.CylinderGeometry(0.05, 0.045, 0.34, 8);
    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.22, 0.44, 0);
        torso.add(arm);
        arm.add(limb(armGeo, skin, -0.16));
        parts.arms.push(arm);
    }

    enableShadows(group);
    group.userData.parts = { ...parts, torso, head, hips };
    return { group, parts: group.userData.parts };
}

export function buildMother() {
    const group = new THREE.Group();
    const skin = std(0xe8b888, 0.72);
    const dress = std(0x6a3a78, 0.88);
    const apron = std(0xf0e4c8, 0.9);
    const hair = std(0x3a2414, 0.9);

    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.85, 12), dress);
    skirt.position.y = 0.42;
    group.add(skirt);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.4, 10), dress);
    torso.position.y = 0.95;
    group.add(torso);
    const ap = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.45), apron);
    ap.position.set(0, 0.72, 0.22);
    group.add(ap);

    const head = new THREE.Group();
    head.position.y = 1.28;
    group.add(head);
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin));
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), hair);
    bun.position.set(0, 0.12, -0.1);
    head.add(bun);
    const haircap = new THREE.Mesh(new THREE.SphereGeometry(0.165, 10, 8, 0, Math.PI * 2, 0, 1.2), hair);
    haircap.position.y = 0.03;
    head.add(haircap);
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), std(0x2a2018, 0.4));
        eye.position.set(sx * 0.05, 0.02, 0.145);
        head.add(eye);
    }

    for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.42, 8), skin);
        arm.position.set(sx * 0.26, 0.88, 0.05);
        arm.rotation.z = sx * 0.35;
        group.add(arm);
    }
    enableShadows(group);
    return group;
}

export function buildMerchant() {
    const group = new THREE.Group();
    const robe = new THREE.MeshStandardMaterial({
        map: clothTexture(), color: 0xc8a0e0, roughness: 0.82
    });
    const skin = std(0xd4b08a, 0.7);
    const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.48, 1.35, 12), robe);
    cloak.position.y = 0.68;
    group.add(cloak);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin);
    head.position.y = 1.42;
    group.add(head);
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 10), std(0x3a1848, 0.7));
    hat.position.y = 1.72;
    group.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.04, 12), std(0x3a1848, 0.7));
    brim.position.y = 1.5;
    group.add(brim);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), std(0xd8d0c0, 0.9));
    beard.position.set(0, 1.28, 0.12);
    beard.rotation.x = 0.4;
    group.add(beard);
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), std(0x201828, 0.3));
        eye.position.set(sx * 0.05, 1.45, 0.14);
        group.add(eye);
    }
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std(0x5a3a18, 0.85));
    pouch.position.set(0.28, 0.7, 0.1);
    group.add(pouch);
    enableShadows(group);
    return group;
}

export function buildCow() {
    const group = new THREE.Group();
    const hide = std(0xf2efe8, 0.85);
    const spot = std(0x5a3a22, 0.88);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), hide);
    body.scale.set(1.45, 0.9, 0.85);
    body.position.y = 0.55;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), hide);
    head.position.set(0, 0.72, 0.52);
    group.add(head);
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std(0xe8c8b0, 0.8));
    snout.scale.set(1.1, 0.7, 1.2);
    snout.position.set(0, 0.64, 0.7);
    group.add(snout);
    for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.14, 6), std(0xf0e8d0, 0.5, 0.2));
        horn.position.set(sx * 0.12, 0.92, 0.48);
        horn.rotation.z = sx * -0.4;
        group.add(horn);
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), hide);
        ear.scale.set(0.5, 1, 0.7);
        ear.position.set(sx * 0.2, 0.8, 0.42);
        group.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), std(0x1a140e, 0.4));
        eye.position.set(sx * 0.1, 0.78, 0.68);
        group.add(eye);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.48, 6), hide);
        leg.position.set(sx * 0.22, 0.24, sx * 0.18);
        group.add(leg);
        const legB = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.48, 6), hide);
        legB.position.set(sx * 0.22, 0.24, -0.22);
        group.add(legB);
        const blot = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), spot);
        blot.position.set(sx * 0.28, 0.62, sx * 0.05);
        group.add(blot);
    }
    const udder = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), std(0xf0c8c0, 0.8));
    udder.position.set(0, 0.28, -0.05);
    group.add(udder);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.4, 5), hide);
    tail.position.set(0, 0.55, -0.48);
    tail.rotation.x = 0.6;
    group.add(tail);
    enableShadows(group);
    group.userData.parts = { head };
    return group;
}

export function buildGiant() {
    const group = new THREE.Group();
    const skin = std(0xc49a72, 0.75);
    const cloth = std(0x4a3020, 0.88);
    const hair = std(0x3a2010, 0.9);

    const hips = new THREE.Group();
    group.add(hips);
    const parts = { legs: [], arms: [] };

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.55, 1.6, 0);
        hips.add(leg);
        leg.add(limb(new THREE.CylinderGeometry(0.32, 0.26, 1.5, 8), cloth, -0.75));
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.7), std(0x2a1810, 0.85));
        boot.position.set(0, -1.55, 0.12);
        leg.add(boot);
        parts.legs.push(leg);
    }

    const torso = new THREE.Group();
    torso.position.y = 1.7;
    hips.add(torso);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(1.05, 14, 12), cloth);
    belly.scale.set(1.05, 0.85, 0.8);
    belly.position.y = 1.15;
    torso.add(belly);
    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 1.1, 10), cloth);
    chest.position.y = 1.7;
    torso.add(chest);

    const head = new THREE.Group();
    head.position.y = 2.55;
    torso.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), skin);
    head.add(skull);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.2), hair);
    brow.position.set(0, 0.18, 0.48);
    head.add(brow);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 8), hair);
    beard.position.set(0, -0.45, 0.28);
    beard.rotation.x = 0.25;
    head.add(beard);
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), std(0xf0e8d8, 0.3));
        eye.position.set(sx * 0.18, 0.08, 0.52);
        head.add(eye);
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), std(0x3a2010, 0.4));
        iris.position.set(sx * 0.18, 0.06, 0.58);
        head.add(iris);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.28, 6), skin);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, -0.02, 0.62);
    head.add(nose);

    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 1.05, 2.0, 0);
        torso.add(arm);
        arm.add(limb(new THREE.CylinderGeometry(0.22, 0.18, 1.5, 8), skin, -0.7));
        const fist = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), skin);
        fist.position.y = -1.5;
        arm.add(fist);
        parts.arms.push(arm);
    }

    const club = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.28, 2.2, 8), std(0x5a3a18, 0.8));
    club.position.set(0.15, -1.4, 0.3);
    club.rotation.z = 0.3;
    parts.arms[1].add(club);

    enableShadows(group);
    group.userData.parts = { ...parts, torso, head, hips, belly, club };
    return { group, parts: group.userData.parts };
}

/* ------------------------------------------------------------------ */
/* Arquitetura e props                                                 */
/* ------------------------------------------------------------------ */

export function buildCottage() {
    const group = new THREE.Group();
    const wall = new THREE.MeshStandardMaterial({ map: woodTexture(), color: 0xe8d2a8, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.6, 4.2), wall);
    body.position.y = 1.3;
    group.add(body);
    const roof = new THREE.Mesh(
        new THREE.ConeGeometry(4.2, 2.2, 4),
        new THREE.MeshStandardMaterial({ map: thatchTexture(), roughness: 0.95 })
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 3.5;
    group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.5, 0.12), std(0x5a3218, 0.8));
    door.position.set(0, 0.75, 2.16);
    group.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), std(0xd4a020, 0.3, 0.8));
    knob.position.set(0.32, 0.7, 2.24);
    group.add(knob);
    for (const sx of [-1.4, 1.4]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.08), std(0x88c8e8, 0.3, 0.1, {
            emissive: 0xffcc66, emissiveIntensity: 0.25
        }));
        win.position.set(sx, 1.55, 2.14);
        group.add(win);
    }
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.4, 0.55), std(0x8a7060, 0.9));
    chimney.position.set(1.6, 4.1, -0.6);
    group.add(chimney);
    enableShadows(group);
    return group;
}

export function buildFence(len = 6) {
    const group = new THREE.Group();
    const wood = std(0x8a6a40, 0.88);
    const posts = Math.max(2, Math.round(len / 1.2));
    for (let i = 0; i < posts; i++) {
        const x = (i / (posts - 1) - 0.5) * len;
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), wood);
        p.position.set(x, 0.45, 0);
        group.add(p);
    }
    for (const y of [0.28, 0.62]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.08, 0.08), wood);
        rail.position.y = y;
        group.add(rail);
    }
    enableShadows(group);
    return group;
}

export function buildTree(rng = Math.random) {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.28, 2.2, 8),
        new THREE.MeshStandardMaterial({ map: barkTexture(), color: 0x6a4a28, roughness: 0.92 })
    );
    trunk.position.y = 1.1;
    group.add(trunk);
    const leafMat = new THREE.MeshStandardMaterial({
        map: leafTexture(), color: 0x4aaa3a, roughness: 0.85
    });
    for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7 + rng() * 0.35, 0), leafMat);
        s.position.set((rng() - 0.5) * 0.8, 2.2 + i * 0.35, (rng() - 0.5) * 0.8);
        s.scale.setScalar(0.9 + rng() * 0.4);
        group.add(s);
    }
    enableShadows(group);
    return group;
}

export function buildStall(color = 0xc45a2a) {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.88 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 1.1), wood);
    table.position.y = 0.85;
    group.add(table);
    for (const sx of [-0.9, 0.9]) {
        for (const sz of [-0.4, 0.4]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), wood);
            leg.position.set(sx, 0.42, sz);
            group.add(leg);
        }
    }
    const cloth = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.06, 1.6), std(color, 0.85));
    cloth.position.set(0, 1.85, 0);
    group.add(cloth);
    const poleL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.0, 6), wood);
    poleL.position.set(-1.05, 1.0, -0.5);
    group.add(poleL);
    const poleR = poleL.clone();
    poleR.position.x = 1.05;
    group.add(poleR);
    enableShadows(group);
    return group;
}

export function buildBeanstalk(height = 78, quality = 'high') {
    const group = new THREE.Group();
    const stemMat = new THREE.MeshStandardMaterial({
        map: barkTexture(), color: 0x3a8a32, roughness: 0.82
    });
    const leafMat = new THREE.MeshStandardMaterial({
        map: leafTexture(), color: 0x4cba40, roughness: 0.78, side: THREE.DoubleSide
    });

    const twist = new THREE.Group();
    const segs = quality === 'low' ? 10 : 18;
    for (let i = 0; i < segs; i++) {
        const y = (i / segs) * height;
        const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, height / segs + 0.4, 8), stemMat);
        vine.position.y = y + height / segs * 0.5;
        vine.rotation.y = i * 0.45;
        vine.rotation.z = 0.08;
        twist.add(vine);
        const tendril = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.12, 6, 12, Math.PI * 1.4), stemMat);
        tendril.position.y = y + 1.2;
        tendril.rotation.x = Math.PI / 2;
        tendril.rotation.z = i * 0.7;
        twist.add(tendril);
    }
    group.add(twist);

    const platforms = [];
    const count = quality === 'low' ? 12 : 18;
    for (let i = 0; i < count; i++) {
        const y = 3.2 + i * (height - 10) / count;
        const a = i * 0.92;
        const r = 3.15;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(1.55, 10), leafMat);
        leaf.rotation.x = -Math.PI / 2;
        leaf.position.set(x, y, z);
        group.add(leaf);
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.45, 0.18, 10), stemMat);
        pad.position.set(x, y - 0.08, z);
        group.add(pad);
        platforms.push({ x, y, z, r: 1.45 });
    }

    const flower = new THREE.Mesh(
        new THREE.ConeGeometry(1.4, 2.2, 8),
        std(0x7a3aaa, 0.6, 0.05, { emissive: 0x5a2088, emissiveIntensity: 0.35 })
    );
    flower.position.y = height + 0.4;
    group.add(flower);

    enableShadows(group);
    return { group, platforms, height };
}

export function buildCloudIsland(radius = 28) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        map: cloudTexture(), color: 0xf4f8fc, roughness: 0.92
    });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.92, 2.2, 24), mat);
    top.position.y = 0;
    group.add(top);
    for (let i = 0; i < 10; i++) {
        const puff = new THREE.Mesh(new THREE.SphereGeometry(4 + (i % 3) * 1.4, 10, 8), mat);
        const a = (i / 10) * Math.PI * 2;
        puff.position.set(Math.cos(a) * (radius * 0.82), -1.2, Math.sin(a) * (radius * 0.82));
        puff.scale.set(1.4, 0.7, 1.2);
        group.add(puff);
    }
    enableShadows(group);
    return group;
}

export function buildCastle() {
    const group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), color: 0xb8c0c8, roughness: 0.9 });
    const keep = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 14), stone);
    keep.position.y = 5;
    group.add(keep);
    const hall = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 12), stone);
    hall.position.set(0, 3, 10);
    group.add(hall);
    for (const [x, z] of [[-7, -6], [7, -6], [-7, 6], [7, 6], [-4, 15], [4, 15]]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 14, 10), stone);
        t.position.set(x, 7, z);
        group.add(t);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8, 2.4, 8), std(0x5a2a68, 0.7));
        cap.position.set(x, 15.1, z);
        group.add(cap);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(3.2, 4.4, 0.4), std(0x3a2414, 0.8));
    door.position.set(0, 2.2, 16.1);
    group.add(door);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.25, 8, 16, Math.PI), stone);
    arch.position.set(0, 4.4, 16.15);
    arch.rotation.x = Math.PI;
    group.add(arch);
    enableShadows(group);
    return group;
}

export function buildTable() {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.75 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 4.2), wood);
    top.position.y = 1.8;
    group.add(top);
    for (const sx of [-3.4, 3.4]) {
        for (const sz of [-1.6, 1.6]) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.28, 1.8, 0.28), wood);
            leg.position.set(sx, 0.9, sz);
            group.add(leg);
        }
    }
    enableShadows(group);
    return group;
}

export function buildGoldBag() {
    const group = new THREE.Group();
    const bag = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), std(0xc4a030, 0.45, 0.65, {
        map: goldTexture(), emissive: 0xaa7700, emissiveIntensity: 0.35
    }));
    bag.scale.set(1, 1.15, 1);
    group.add(bag);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 0.22, 8), std(0x8a6a20, 0.6, 0.4));
    neck.position.y = 0.42;
    group.add(neck);
    enableShadows(group);
    return group;
}

export function buildHen() {
    const group = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({
        map: goldTexture(), color: 0xffe080, metalness: 0.75, roughness: 0.32,
        emissive: 0xaa7700, emissiveIntensity: 0.28
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), gold);
    body.scale.set(1.15, 0.9, 1);
    body.position.y = 0.28;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), gold);
    head.position.set(0.22, 0.48, 0);
    group.add(head);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 6), std(0xffaa33, 0.4, 0.5));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.36, 0.46, 0);
    group.add(beak);
    const comb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), std(0xff6644, 0.5));
    comb.position.set(0.2, 0.62, 0);
    group.add(comb);
    for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), gold);
        wing.scale.set(0.4, 0.7, 1.1);
        wing.position.set(-0.05, 0.3, sx * 0.22);
        group.add(wing);
    }
    enableShadows(group);
    return group;
}

export function buildHarp() {
    const group = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({
        map: goldTexture(), metalness: 0.8, roughness: 0.28,
        emissive: 0xaa8800, emissiveIntensity: 0.4
    });
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.07, 8, 24, Math.PI * 1.15), gold);
    frame.rotation.y = Math.PI / 2;
    frame.position.y = 0.55;
    group.add(frame);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.15, 8), gold);
    pillar.position.set(0.55, 0.55, 0);
    group.add(pillar);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.22), gold);
    base.position.y = 0.05;
    group.add(base);
    for (let i = 0; i < 7; i++) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.7 + i * 0.05, 4), std(0xfff8d0, 0.4));
        s.position.set(-0.2 + i * 0.1, 0.5, 0);
        group.add(s);
    }
    enableShadows(group);
    return group;
}

export function buildAxe() {
    const group = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.1, 8), std(0x6a3a18, 0.8));
    handle.position.y = 0.55;
    group.add(handle);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.28, 0.08), std(0xc8d0d8, 0.35, 0.7));
    head.position.set(0.18, 1.05, 0);
    group.add(head);
    enableShadows(group);
    return group;
}

export function buildWell() {
    const group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.9 });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.7, 12), stone);
    ring.position.y = 0.35;
    group.add(ring);
    const water = new THREE.Mesh(new THREE.CircleGeometry(0.7, 12), std(0x3a88aa, 0.2, 0.3, {
        transparent: true, opacity: 0.7
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.42;
    group.add(water);
    enableShadows(group);
    return group;
}

export function grassBladeGeometry() {
    const geo = new THREE.PlaneGeometry(0.12, 0.55, 1, 3);
    geo.translate(0, 0.28, 0);
    return geo;
}

export function applyGrassWind(mat) {
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        mat.userData.uTime = shader.uniforms.uTime;
        shader.vertexShader = `
            uniform float uTime;
            ${shader.vertexShader}
        `.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            float h = position.y;
            transformed.x += sin(uTime * 1.4 + position.z * 0.4) * h * 0.18;`
        );
    };
}

export function buildGateArch() {
    const group = new THREE.Group();
    const wood = std(0x6a3e1c, 0.85);
    for (const sx of [-1.6, 1.6]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.28), wood);
        post.position.set(sx, 1.7, 0);
        group.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 0.28), wood);
    bar.position.y = 3.25;
    group.add(bar);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.55, 0.08), std(0xc4a050, 0.7));
    sign.position.set(0, 3.7, 0);
    group.add(sign);
    const glow = new THREE.Mesh(
        new THREE.CylinderGeometry(0.9, 1.1, 0.12, 16),
        new THREE.MeshBasicMaterial({ color: 0xffee88, transparent: true, opacity: 0.55 })
    );
    glow.position.y = 0.08;
    group.add(glow);
    enableShadows(group);
    return group;
}
    const mesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.4, 5.5, 8, 1, true),
        new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.2,
            side: THREE.DoubleSide,
            depthWrite: false
        })
    );
    return mesh;
}
