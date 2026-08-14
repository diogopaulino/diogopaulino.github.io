/**
 * Modelos 3D construídos por código — nenhum GLB externo.
 * Clara (a menina), lanterna, aldeões, raposa, Sombrios, casas e a árvore oca.
 */

import * as THREE from 'three';
import { barkTexture, woodTexture, thatchTexture, cobbleTexture } from './textures.js';

const matCache = new Map();

export function std(color, roughness = 0.78, metalness = 0.04, extra = {}) {
    const key = `std:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`;
    if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
    }
    return matCache.get(key);
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
/* Clara — menina da lanterna                                          */
/* ------------------------------------------------------------------ */

export function buildGirl() {
    const group = new THREE.Group();
    const skin = std(0xf0c4a0, 0.68);
    const hair = std(0x2a1810, 0.92);
    const coat = std(0xc45a42, 0.82);
    const dress = std(0xf2e2c4, 0.88);
    const boot = std(0x3a2418, 0.7);

    const hips = new THREE.Group();
    group.add(hips);
    const parts = { legs: [], arms: [], feet: [] };

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.1, 0.42, 0);
        hips.add(leg);
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.32, 8), dress);
        thigh.position.y = -0.16;
        leg.add(thigh);
        const bootM = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), boot);
        bootM.scale.set(1.05, 0.55, 1.45);
        bootM.position.set(0, -0.34, 0.04);
        leg.add(bootM);
        parts.legs.push(leg);
        parts.feet.push(bootM);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.42;
    hips.add(torso);

    const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.38, 10), dress);
    skirt.position.y = 0.12;
    torso.add(skirt);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.32, 10), coat);
    body.position.y = 0.38;
    torso.add(body);

    const cape = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.5, 8, 1, true), std(0xa84838, 0.9));
    cape.position.set(0, 0.28, -0.08);
    cape.rotation.x = 0.18;
    torso.add(cape);

    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 6, 12), std(0xe8c44a, 0.7));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.54;
    torso.add(scarf);

    const head = new THREE.Group();
    head.position.y = 0.72;
    torso.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.175, 14, 12), skin);
    head.add(skull);

    for (const sx of [-1, 1]) {
        const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), std(0xf7f2ea, 0.35));
        eyeW.position.set(sx * 0.055, 0.02, 0.155);
        head.add(eyeW);
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), std(0x3a5a28, 0.4));
        iris.position.set(sx * 0.055, 0.018, 0.178);
        head.add(iris);
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.012), hair);
        brow.position.set(sx * 0.055, 0.055, 0.16);
        brow.rotation.z = sx * -0.12;
        head.add(brow);
        const cheek = new THREE.Mesh(
            new THREE.SphereGeometry(0.028, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0xf08a7a, roughness: 0.7, transparent: true, opacity: 0.45 })
        );
        cheek.position.set(sx * 0.1, -0.03, 0.12);
        head.add(cheek);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 5), skin);
    nose.position.set(0, -0.01, 0.17);
    head.add(nose);

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.185, 12, 10), hair);
    hairCap.scale.set(1.05, 0.85, 1.05);
    hairCap.position.y = 0.06;
    head.add(hairCap);

    const bangs = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), hair);
    bangs.scale.set(1.4, 0.45, 0.7);
    bangs.position.set(0, 0.08, 0.12);
    head.add(bangs);

    const braids = [];
    for (const sx of [-1, 1]) {
        const braid = new THREE.Group();
        braid.position.set(sx * 0.16, -0.02, -0.02);
        head.add(braid);
        for (let i = 0; i < 5; i++) {
            const bead = new THREE.Mesh(new THREE.SphereGeometry(0.038 - i * 0.003, 8, 6), hair);
            bead.position.set(sx * 0.02, -0.08 - i * 0.07, -0.02);
            braid.add(bead);
        }
        const ribbon = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), std(0xe8c44a, 0.6));
        ribbon.position.set(sx * 0.02, -0.44, -0.02);
        braid.add(ribbon);
        braids.push(braid);
    }

    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.22, 0.5, 0);
        torso.add(arm);
        const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.038, 0.3, 8), coat);
        mesh.position.y = -0.14;
        arm.add(mesh);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skin);
        hand.position.y = -0.3;
        arm.add(hand);
        parts.arms.push(arm);
    }

    const lantern = buildLantern({ light: true, scale: 0.85 });
    lantern.position.set(0.02, -0.38, 0.08);
    lantern.rotation.x = 0.15;
    parts.arms[0].add(lantern);

    enableShadows(group);
    group.userData.parts = { ...parts, torso, head, hips, lantern, braids, cape };
    return { group, parts: group.userData.parts };
}

export function buildLantern({ light = false, scale = 1, color = 0xffb347 } = {}) {
    const group = new THREE.Group();
    group.scale.setScalar(scale);

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 12, Math.PI), std(0x8a5a28, 0.4, 0.5));
    handle.rotation.x = Math.PI;
    handle.position.y = 0.16;
    group.add(handle);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.04, 8), std(0x6a3a18, 0.45, 0.4));
    cap.position.y = 0.1;
    group.add(cap);

    const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.09, 0.16, 8),
        new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.85,
            roughness: 0.35,
            metalness: 0.1,
            transparent: true,
            opacity: 0.92
        })
    );
    glass.position.y = 0;
    group.add(glass);

    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 8, 6),
        new THREE.MeshStandardMaterial({
            color: 0xffeeaa,
            emissive: 0xffaa33,
            emissiveIntensity: 2.4,
            roughness: 0.4
        })
    );
    flame.position.y = 0;
    group.add(flame);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.04, 8), std(0x5a3014, 0.5, 0.35));
    base.position.y = -0.1;
    group.add(base);

    let point = null;
    if (light) {
        point = new THREE.PointLight(0xffc060, 2.4, 14, 1.6);
        point.position.y = 0.05;
        group.add(point);
    }

    group.userData.flame = flame;
    group.userData.glass = glass;
    group.userData.light = point;
    return group;
}

/* ------------------------------------------------------------------ */
/* NPCs                                                                */
/* ------------------------------------------------------------------ */

export function buildVillager({ coat = 0x3a5a48, hat = 0x2a2418 } = {}) {
    const group = new THREE.Group();
    const skin = std(0xe0b080, 0.7);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.9, 10), std(coat, 0.88));
    body.position.y = 0.55;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skin);
    head.position.y = 1.12;
    group.add(head);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 10), std(hat, 0.85));
    brim.position.y = 1.22;
    group.add(brim);
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.16, 8), std(hat, 0.85));
    crown.position.y = 1.32;
    group.add(crown);
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 8), std(0xc8c0b0, 0.9));
    beard.position.set(0, 0.95, 0.08);
    beard.rotation.x = Math.PI;
    group.add(beard);
    enableShadows(group);
    return group;
}

export function buildGrandmother() {
    const group = new THREE.Group();
    const robe = new THREE.MeshStandardMaterial({
        color: 0xf2e8c8,
        emissive: 0xffe8a0,
        emissiveIntensity: 0.55,
        roughness: 0.5,
        transparent: true,
        opacity: 0.82
    });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.5, 10), robe);
    body.position.y = 0.75;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), robe);
    head.position.y = 1.58;
    group.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), std(0xe8e0d0, 0.9));
    hair.position.y = 1.68;
    hair.scale.set(1, 0.7, 1);
    group.add(hair);
    enableShadows(group);
    return group;
}

export function buildFox() {
    const group = new THREE.Group();
    const fur = std(0xd46828, 0.75);
    const white = std(0xf2e8d8, 0.8);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), fur);
    body.scale.set(1.4, 0.75, 0.85);
    body.position.y = 0.28;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), fur);
    head.position.set(0, 0.38, 0.28);
    group.add(head);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 6), white);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 0.34, 0.4);
    group.add(snout);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 6), fur);
        ear.position.set(sx * 0.08, 0.52, 0.24);
        group.add(ear);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.22, 6), fur);
        leg.position.set(sx * 0.12, 0.12, 0.08);
        group.add(leg);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), std(0x1a1008, 0.4));
        eye.position.set(sx * 0.05, 0.4, 0.38);
        group.add(eye);
    }
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 6), fur);
    tail.rotation.x = -1.1;
    tail.position.set(0, 0.32, -0.32);
    group.add(tail);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), white);
    tip.position.set(0, 0.48, -0.5);
    group.add(tip);
    enableShadows(group);
    group.userData.tail = tail;
    return group;
}

export function buildShadow() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: 0x0a0812,
        emissive: 0x1a1030,
        emissiveIntensity: 0.4,
        roughness: 0.95,
        transparent: true,
        opacity: 0.88
    });
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.7, 8), mat);
    body.position.y = 0.85;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat);
    head.position.y = 1.55;
    group.add(head);
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 6, 5),
            new THREE.MeshStandardMaterial({ color: 0x88ddff, emissive: 0x44aaff, emissiveIntensity: 2 })
        );
        eye.position.set(sx * 0.08, 1.58, 0.16);
        group.add(eye);
    }
    group.userData.body = body;
    return group;
}

export function buildNight() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color: 0x100818,
        emissive: 0x401060,
        emissiveIntensity: 0.55,
        roughness: 0.9,
        transparent: true,
        opacity: 0.78
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), mat);
    body.scale.set(1, 1.4, 1);
    body.position.y = 1.6;
    group.add(body);
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.12, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0xff6688, emissive: 0xff2244, emissiveIntensity: 2.2 })
        );
        eye.position.set(sx * 0.28, 1.85, 0.85);
        group.add(eye);
    }
    enableShadows(group);
    return group;
}

/* ------------------------------------------------------------------ */
/* Cenário                                                             */
/* ------------------------------------------------------------------ */

export function buildCottage({ roof = 0x6a3a22, wall = 0xd8c4a0 } = {}) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.1, 2.6), std(wall, 0.9));
    body.position.y = 1.05;
    group.add(body);
    const roofM = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.5, 4), new THREE.MeshStandardMaterial({
        map: thatchTexture(), color: roof, roughness: 0.92
    }));
    roofM.position.y = 2.7;
    roofM.rotation.y = Math.PI / 4;
    group.add(roofM);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.08), std(0x4a2a14, 0.8));
    door.position.set(0, 0.6, 1.32);
    group.add(door);
    const window = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xffc878, emissive: 0xffaa44, emissiveIntensity: 0.6 })
    );
    window.position.set(0.9, 1.2, 1.32);
    group.add(window);
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.8, 0.35), std(0x6a5040, 0.9));
    chimney.position.set(0.9, 3.1, -0.4);
    group.add(chimney);
    enableShadows(group);
    return group;
}

export function buildLampPost() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 8), std(0x2a2418, 0.6, 0.3));
    pole.position.y = 1.2;
    group.add(pole);
    const lantern = buildLantern({ light: true, scale: 1.15 });
    lantern.position.y = 2.45;
    group.add(lantern);
    if (lantern.userData.light) lantern.userData.light.intensity = 0;
    lantern.userData.glass.emissiveIntensity = 0.05;
    lantern.userData.flame.visible = false;
    enableShadows(group);
    group.userData.lantern = lantern;
    return group;
}

export function buildHangingLantern(color = 0xffb347) {
    const group = new THREE.Group();
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.4, 5), std(0x4a3420, 0.9));
    rope.position.y = 2.0;
    group.add(rope);
    const lantern = buildLantern({ light: true, scale: 1, color });
    lantern.position.y = 1.25;
    group.add(lantern);
    if (lantern.userData.light) lantern.userData.light.intensity = 0;
    lantern.userData.flame.visible = false;
    lantern.userData.glass.emissiveIntensity = 0.04;
    group.userData.lantern = lantern;
    return group;
}

export function buildPine() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.28, 2.4, 8),
        new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95 })
    );
    trunk.position.y = 1.2;
    group.add(trunk);
    const greens = [0x1a3a22, 0x16341c, 0x204828];
    for (let i = 0; i < 4; i++) {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(1.35 - i * 0.22, 1.5, 8), std(greens[i % 3], 0.92));
        cone.position.y = 2.1 + i * 0.7;
        group.add(cone);
    }
    enableShadows(group);
    return group;
}

export function buildOak() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.4, 2.2, 8),
        new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.95 })
    );
    trunk.position.y = 1.1;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), std(0x2a5a28, 0.9));
    crown.position.y = 2.8;
    crown.scale.set(1.2, 0.85, 1.15);
    group.add(crown);
    enableShadows(group);
    return group;
}

export function buildHollowTree() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(2.2, 2.8, 8, 12),
        new THREE.MeshStandardMaterial({ map: barkTexture(), color: 0x4a3020, roughness: 0.95 })
    );
    trunk.position.y = 4;
    group.add(trunk);
    const hole = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x080408, roughness: 1 })
    );
    hole.position.set(0, 1.6, 2.2);
    group.add(hole);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(4.2, 12, 10), std(0x1a3018, 0.92));
    crown.position.y = 9.2;
    crown.scale.set(1.15, 0.7, 1.1);
    group.add(crown);
    enableShadows(group);
    return group;
}

export function buildRootCrystal(color) {
    const group = new THREE.Group();
    const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.42),
        new THREE.MeshStandardMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.15,
            roughness: 0.25,
            metalness: 0.35,
            transparent: true,
            opacity: 0.92
        })
    );
    crystal.position.y = 0.7;
    group.add(crystal);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.35, 6), std(0x3a2418, 0.9));
    base.position.y = 0.15;
    group.add(base);
    group.userData.crystal = crystal;
    return group;
}

export function buildBridge() {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.88 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.18, 1.6), wood);
    deck.position.y = 0.4;
    group.add(deck);
    for (const sz of [-0.75, 0.75]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(8.5, 0.08, 0.08), wood);
        rail.position.set(0, 0.95, sz);
        group.add(rail);
        for (let i = -3; i <= 3; i++) {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.7, 0.08), wood);
            post.position.set(i * 1.2, 0.7, sz);
            group.add(post);
        }
    }
    enableShadows(group);
    return group;
}

export function buildMill() {
    const group = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 4.2, 10), std(0xc8b090, 0.9));
    tower.position.y = 2.1;
    group.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.2, 8), std(0x5a3018, 0.85));
    cap.position.y = 4.7;
    group.add(cap);
    const hub = new THREE.Group();
    hub.position.set(0, 3.2, 1.5);
    group.add(hub);
    for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.5), std(0xe8d8b0, 0.8));
        blade.position.y = 1.5;
        const arm = new THREE.Group();
        arm.rotation.z = (i / 4) * Math.PI * 2;
        arm.add(blade);
        hub.add(arm);
    }
    group.userData.hub = hub;
    enableShadows(group);
    return group;
}

export function buildBuoy() {
    const group = new THREE.Group();
    const float = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), std(0xc45a2a, 0.6));
    float.scale.y = 0.7;
    group.add(float);
    const lantern = buildLantern({ light: true, scale: 0.7 });
    lantern.position.y = 0.35;
    group.add(lantern);
    if (lantern.userData.light) lantern.userData.light.intensity = 0;
    lantern.userData.flame.visible = false;
    group.userData.lantern = lantern;
    return group;
}

export function buildCage() {
    const group = new THREE.Group();
    const thorn = std(0x3a2818, 0.9);
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), thorn);
        bar.position.set(Math.cos(a) * 0.55, 0.7, Math.sin(a) * 0.55);
        group.add(bar);
    }
    const top = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 6, 12), thorn);
    top.rotation.x = Math.PI / 2;
    top.position.y = 1.4;
    group.add(top);
    enableShadows(group);
    return group;
}

export function buildDawnStone() {
    const group = new THREE.Group();
    const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.1),
        new THREE.MeshStandardMaterial({
            color: 0xc8a060,
            emissive: 0xffaa44,
            emissiveIntensity: 0.35,
            roughness: 0.55
        })
    );
    rock.position.y = 0.7;
    group.add(rock);
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.06, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffcc55, emissiveIntensity: 0.8 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.15;
    group.add(ring);
    enableShadows(group);
    group.userData.rock = rock;
    return group;
}

export function buildFence(length = 4) {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.9 });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(length, 0.08, 0.08), wood);
    rail.position.y = 0.55;
    group.add(rail);
    const n = Math.max(2, Math.round(length / 1.1));
    for (let i = 0; i < n; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 0.1), wood);
        post.position.set(-length / 2 + (i / (n - 1)) * length, 0.42, 0);
        group.add(post);
    }
    enableShadows(group);
    return group;
}

export function buildMemory() {
    const mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.22),
        new THREE.MeshStandardMaterial({
            color: 0xffe8a8,
            emissive: 0xffcc66,
            emissiveIntensity: 1.1,
            roughness: 0.3,
            metalness: 0.2
        })
    );
    return mesh;
}

export function buildFirefly() {
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 6, 5),
        new THREE.MeshStandardMaterial({
            color: 0xc8ff7a,
            emissive: 0xa0ff55,
            emissiveIntensity: 2.2
        })
    );
    return mesh;
}

export function buildWell() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 0.78, 0.55, 12),
        new THREE.MeshStandardMaterial({ map: cobbleTexture(), roughness: 0.92 })
    );
    ring.position.y = 0.28;
    group.add(ring);
    const water = new THREE.Mesh(
        new THREE.CircleGeometry(0.55, 12),
        new THREE.MeshStandardMaterial({ color: 0x1a3040, roughness: 0.2, metalness: 0.3 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.38;
    group.add(water);
    enableShadows(group);
    return group;
}

export function grassBladeGeometry() {
    const geo = new THREE.PlaneGeometry(0.08, 0.45, 1, 2);
    geo.translate(0, 0.22, 0);
    return geo;
}
