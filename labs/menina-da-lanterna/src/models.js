/**
 * Modelos 3D construídos por código — nenhum GLB externo.
 * Clara (a menina), lanterna, aldeões, raposa, Sombrios, casas e a árvore oca.
 */

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { barkTexture, woodTexture, thatchTexture, cobbleTexture } from './textures.js';
import {
    attachHumanHead, limbGeometry, shoeMesh, handGroup,
    torsoGeometry, headGeometry, canineTorsoGeometry, canineHeadGeometry,
    tailGeometry, earBladeGeometry
} from '../../shared/realism.js';

const matCache = new Map();

export function std(color, roughness = 0.78, metalness = 0.04, extra = {}) {
    const key = `std:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`;
    if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshPhysicalMaterial({
            color, roughness, metalness,
            clearcoat: extra.clearcoat ?? 0.08,
            clearcoatRoughness: extra.clearcoatRoughness ?? 0.65,
            ...extra
        }));
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
    skin.side = THREE.DoubleSide;
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
        const thigh = new THREE.Mesh(limbGeometry({
            length: 0.32, r0: 0.07, r1: 0.048, bulge: 0.016, bulgeAt: 0.34, pinch: 0.25
        }), dress);
        leg.add(thigh);
        const bootM = shoeMesh(boot, { length: 0.16, width: 0.075, height: 0.055 });
        bootM.position.set(0, -0.32, 0.03);
        leg.add(bootM);
        parts.legs.push(leg);
        parts.feet.push(bootM);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.42;
    hips.add(torso);

    const skirtPts = [
        new THREE.Vector2(0.08, 0),
        new THREE.Vector2(0.16, 0.08),
        new THREE.Vector2(0.24, 0.2),
        new THREE.Vector2(0.3, 0.36)
    ];
    const skirt = new THREE.Mesh(new THREE.LatheGeometry(skirtPts, 18), dress);
    torso.add(skirt);

    const body = new THREE.Mesh(limbGeometry({
        length: 0.34, r0: 0.15, r1: 0.13, bulge: 0.03, bulgeAt: 0.45, pinch: 0.05
    }), coat);
    body.position.y = 0.52;
    torso.add(body);

    const cape = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.06, 0),
        new THREE.Vector2(0.16, 0.12),
        new THREE.Vector2(0.28, 0.32),
        new THREE.Vector2(0.14, 0.5)
    ], 10, Math.PI * 0.55, Math.PI * 0.9), std(0xa84838, 0.9));
    cape.position.set(0, 0.28, -0.08);
    cape.rotation.x = 0.18;
    torso.add(cape);

    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.035, 8, 18), std(0xe8c44a, 0.7));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.54;
    torso.add(scarf);

    const head = new THREE.Group();
    head.position.y = 0.72;
    torso.add(head);
    attachHumanHead(head, {
        radius: 0.175,
        style: 'child',
        skin: 0xf0c4a0,
        hair: 0x2a1810,
        hairStyle: 'bangs',
        iris: 0x3a5a28,
        lips: 0xc46a62
    });

    const braids = [];
    for (const sx of [-1, 1]) {
        const braid = new THREE.Group();
        braid.position.set(sx * 0.15, 0.02, -0.02);
        head.add(braid);
        const lock = new THREE.Mesh(limbGeometry({
            length: 0.42, r0: 0.032, r1: 0.014, bulge: 0.008, bulgeAt: 0.25, pinch: 0.05, seg: 8, rings: 8
        }), hair);
        braid.add(lock);
        const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 6, 10), std(0xe8c44a, 0.45, 0.2));
        ribbon.position.y = -0.4;
        ribbon.rotation.x = Math.PI / 2;
        braid.add(ribbon);
        braids.push(braid);
    }

    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.22, 0.5, 0);
        torso.add(arm);
        const mesh = new THREE.Mesh(limbGeometry({
            length: 0.3, r0: 0.05, r1: 0.036, bulge: 0.012, bulgeAt: 0.32, pinch: 0.2
        }), coat);
        arm.add(mesh);
        const hand = handGroup(skin, { scale: 0.72 });
        hand.position.y = -0.3;
        if (sx > 0) hand.scale.x = -1;
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

    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 10, 20, Math.PI), std(0x8a5a28, 0.4, 0.5));
    handle.rotation.x = Math.PI;
    handle.position.y = 0.16;
    group.add(handle);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.04, 14), std(0x6a3a18, 0.45, 0.4));
    cap.position.y = 0.1;
    group.add(cap);

    const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.085, 0.09, 0.16, 16),
        new THREE.MeshPhysicalMaterial({
            color,
            emissive: color,
            emissiveIntensity: 0.85,
            roughness: 0.28,
            metalness: 0.12,
            clearcoat: 0.55,
            transparent: true,
            opacity: 0.92
        })
    );
    glass.position.y = 0;
    group.add(glass);

    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 14, 12),
        new THREE.MeshPhysicalMaterial({
            color: 0xffeeaa,
            emissive: 0xffaa33,
            emissiveIntensity: 2.4,
            roughness: 0.35,
            clearcoat: 0.2
        })
    );
    flame.position.y = 0;
    group.add(flame);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.04, 14), std(0x5a3014, 0.5, 0.35));
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
    const cloth = std(coat, 0.88);
    const hatMat = std(hat, 0.85);
    const torso = new THREE.Mesh(torsoGeometry({ height: 0.82, girth: 0.32, style: 'human' }), cloth);
    torso.position.y = 0.08;
    group.add(torso);
    const head = new THREE.Group();
    head.position.y = 1.02;
    group.add(head);
    attachHumanHead(head, {
        radius: 0.16, style: 'human', skin: 0xe0b080, hair: 0x3a2414, hairStyle: 'none', iris: 0x3a2418
    });
    const brim = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.04, 0),
        new THREE.Vector2(0.22, 0.012),
        new THREE.Vector2(0.22, 0.028),
        new THREE.Vector2(0.04, 0.04)
    ], 18), hatMat);
    brim.position.y = 0.12;
    head.add(brim);
    const crown = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.02, 0),
        new THREE.Vector2(0.13, 0.02),
        new THREE.Vector2(0.11, 0.12),
        new THREE.Vector2(0.03, 0.17)
    ], 14), hatMat);
    crown.position.y = 0.14;
    head.add(crown);
    const beard = new THREE.Mesh(
        limbGeometry({ length: 0.22, r0: 0.08, r1: 0.018, bulge: 0.02, pinch: 0.08, seg: 8 }),
        std(0xc8c0b0, 0.9)
    );
    beard.position.set(0, -0.02, 0.1);
    head.add(beard);
    const armGeo = limbGeometry({ length: 0.46, r0: 0.07, r1: 0.042, bulge: 0.016, seg: 10 });
    for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(armGeo, cloth);
        arm.position.set(sx * 0.26, 0.78, 0);
        arm.rotation.z = sx * 0.18;
        group.add(arm);
    }
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
        opacity: 0.82,
        side: THREE.DoubleSide
    });
    const body = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.06, 0),
        new THREE.Vector2(0.42, 0.1),
        new THREE.Vector2(0.34, 0.62),
        new THREE.Vector2(0.2, 1.12),
        new THREE.Vector2(0.1, 1.38)
    ], 18), robe);
    group.add(body);
    const head = new THREE.Group();
    head.position.y = 1.48;
    group.add(head);
    attachHumanHead(head, {
        radius: 0.15,
        style: 'human',
        skin: 0xf0d2b4,
        hair: 0xe8e0d0,
        hairStyle: 'bob',
        iris: 0x6a5030,
        lips: 0xc48a78
    });
    enableShadows(group);
    return group;
}

export function buildFox() {
    const group = new THREE.Group();
    const fur = std(0xd46828, 0.75);
    const white = std(0xf2e8d8, 0.8);
    const body = new THREE.Mesh(canineTorsoGeometry({ length: 0.55, girth: 0.16, chest: 0.045 }), fur);
    body.position.y = 0.28;
    group.add(body);
    const head = new THREE.Group();
    head.position.set(0, 0.42, 0.26);
    group.add(head);
    head.add(new THREE.Mesh(canineHeadGeometry({ radius: 0.14, style: 'fox' }), fur));
    const muzzle = new THREE.Mesh(limbGeometry({ length: 0.12, r0: 0.045, r1: 0.02, bulge: 0.008, pinch: 0.05, seg: 8 }), white);
    muzzle.rotation.x = -Math.PI / 2;
    muzzle.position.set(0, -0.02, 0.1);
    head.add(muzzle);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(earBladeGeometry({ height: 0.14, width: 0.055, thickness: 0.018 }), fur);
        ear.position.set(sx * 0.07, 0.1, -0.02);
        head.add(ear);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), std(0x1a1008, 0.4));
        eye.position.set(sx * 0.05, 0.03, 0.12);
        head.add(eye);
    }
    const legGeo = limbGeometry({ length: 0.2, r0: 0.04, r1: 0.022, bulge: 0.01, seg: 8 });
    for (const [sx, sz] of [[-1, 0.12], [1, 0.12], [-1, -0.1], [1, -0.1]]) {
        const leg = new THREE.Mesh(legGeo, fur);
        leg.position.set(sx * 0.1, 0.2, sz);
        group.add(leg);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.32, -0.18);
    tail.rotation.x = -0.7;
    const furTail = new THREE.Mesh(tailGeometry({ length: 0.36, r0: 0.055, r1: 0.02, fluff: 0.035 }), fur);
    furTail.position.z = -0.18;
    tail.add(furTail);
    const tip = new THREE.Mesh(tailGeometry({ length: 0.1, r0: 0.035, r1: 0.018, fluff: 0.02 }), white);
    tip.position.z = -0.38;
    tail.add(tip);
    group.add(tail);
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
        opacity: 0.88,
        side: THREE.DoubleSide
    });
    const body = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.05, 0),
        new THREE.Vector2(0.46, 0.12),
        new THREE.Vector2(0.28, 0.7),
        new THREE.Vector2(0.2, 1.2),
        new THREE.Vector2(0.08, 1.48)
    ], 16), mat);
    group.add(body);
    const head = new THREE.Group();
    head.position.y = 1.52;
    group.add(head);
    head.add(new THREE.Mesh(headGeometry(0.2, 'human'), mat));
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.04, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x88ddff, emissive: 0x44aaff, emissiveIntensity: 2 })
        );
        eye.position.set(sx * 0.07, 0.04, 0.16);
        head.add(eye);
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
        opacity: 0.78,
        side: THREE.DoubleSide
    });
    const body = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.18, 0),
        new THREE.Vector2(1.15, 0.35),
        new THREE.Vector2(0.9, 1.15),
        new THREE.Vector2(0.62, 2.05),
        new THREE.Vector2(0.32, 2.75),
        new THREE.Vector2(0.1, 3.1)
    ], 18), mat);
    body.position.y = 0.08;
    group.add(body);
    const skull = new THREE.Mesh(headGeometry(0.42, 'human'), mat);
    skull.position.set(0, 2.85, 0.15);
    group.add(skull);
    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(
            new THREE.SphereGeometry(0.1, 10, 8),
            new THREE.MeshStandardMaterial({ color: 0xff6688, emissive: 0xff2244, emissiveIntensity: 2.2 })
        );
        eye.position.set(sx * 0.16, 2.9, 0.48);
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
    const plaster = std(wall, 0.88, 0.03, { clearcoat: 0.05 });
    const timber = std(0x4a2a14, 0.82, 0.05);
    // Corpo principal + base de pedra (cantos arredondados — menos caixa pura)
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(3.35, 0.28, 2.75, 4, 0.06), std(0x6a6050, 0.92));
    plinth.position.y = 0.14;
    group.add(plinth);
    const body = new THREE.Mesh(new RoundedBoxGeometry(3.2, 2.0, 2.6, 5, 0.1), plaster);
    body.position.y = 1.15;
    group.add(body);
    // Vigas de madeira (enxaimel)
    for (const x of [-1.55, 0, 1.55]) {
        const post = new THREE.Mesh(new RoundedBoxGeometry(0.12, 2.0, 0.12, 3, 0.02), timber);
        post.position.set(x, 1.15, 1.32);
        group.add(post);
    }
    for (const y of [0.55, 1.15, 1.75]) {
        const beam = new THREE.Mesh(new RoundedBoxGeometry(3.15, 0.1, 0.1, 3, 0.02), timber);
        beam.position.set(0, y, 1.32);
        group.add(beam);
    }
    // Telhado de duas águas (dois planos) em vez de cone pyramidal
    const thatchMat = new THREE.MeshPhysicalMaterial({
        map: thatchTexture(), color: roof, roughness: 0.9, metalness: 0.02, clearcoat: 0.04
    });
    for (const sx of [-1, 1]) {
        const slope = new THREE.Mesh(new RoundedBoxGeometry(3.6, 0.14, 1.9, 3, 0.04), thatchMat);
        slope.position.set(0, 2.55, sx * 0.55);
        slope.rotation.x = sx * -0.48;
        group.add(slope);
    }
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.5, 16), timber);
    ridge.rotation.z = Math.PI / 2;
    ridge.position.y = 2.95;
    group.add(ridge);
    // Porta com batente
    const doorFrame = new THREE.Mesh(new RoundedBoxGeometry(0.85, 1.35, 0.1, 3, 0.03), timber);
    doorFrame.position.set(0, 0.72, 1.33);
    group.add(doorFrame);
    const door = new THREE.Mesh(new RoundedBoxGeometry(0.7, 1.2, 0.08, 3, 0.025), std(0x3a2010, 0.75, 0.08));
    door.position.set(0, 0.7, 1.38);
    group.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 12), std(0xc9a050, 0.35, 0.85, { clearcoat: 0.8 }));
    knob.position.set(0.25, 0.7, 1.44);
    group.add(knob);
    // Janelas com caixilho
    for (const x of [-0.95, 0.95]) {
        const frame = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.08, 3, 0.025), timber);
        frame.position.set(x, 1.35, 1.33);
        group.add(frame);
        const glass = new THREE.Mesh(
            new RoundedBoxGeometry(0.48, 0.48, 0.05, 2, 0.02),
            new THREE.MeshPhysicalMaterial({
                color: 0xffc878, emissive: 0xffaa44, emissiveIntensity: 0.65,
                roughness: 0.2, metalness: 0.15, clearcoat: 0.5, transmission: 0.15, transparent: true, opacity: 0.92
            })
        );
        glass.position.set(x, 1.35, 1.38);
        group.add(glass);
        const mullion = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.48, 0.06, 2, 0.01), timber);
        mullion.position.set(x, 1.35, 1.4);
        group.add(mullion);
    }
    // Chaminé cilíndrica
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.1, 18), std(0x6a5040, 0.9));
    chimney.position.set(0.95, 3.35, -0.45);
    group.add(chimney);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.12, 18), std(0x3a3028, 0.7, 0.2));
    pot.position.set(0.95, 3.95, -0.45);
    group.add(pot);
    enableShadows(group);
    return group;
}

export function buildLampPost() {
    const group = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.4, 14), std(0x2a2418, 0.6, 0.3));
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

function raggedCone(radius, height, seed) {
    const g = new THREE.ConeGeometry(radius, height, 12);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const n = 0.84 + Math.abs(Math.sin(x * 4 + seed) * Math.cos(z * 3 + y + seed)) * 0.24;
        pos.setXYZ(i, x * n, y, z * n);
    }
    g.computeVertexNormals();
    return g;
}

function raggedCrown(radius, seed) {
    const g = new THREE.SphereGeometry(radius, 18, 14);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const len = Math.hypot(x, y, z) || 1;
        const n = 0.78 + Math.abs(Math.sin(x * 1.8 + seed) * Math.cos(z * 1.4 + seed)) * 0.34;
        pos.setXYZ(i, (x / len) * radius * n, (y / len) * radius * n * 0.82, (z / len) * radius * n);
    }
    g.computeVertexNormals();
    return g;
}

const PINE_LAYERS = [0, 1, 2, 3].map((i) => raggedCone(1.35 - i * 0.22, 1.5, i * 1.7));
const OAK_CROWN = raggedCrown(1.5, 2.2);
const HOLLOW_CROWN = raggedCrown(4.2, 5.1);

export function buildPine() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.28, 2.4, 16),
        new THREE.MeshPhysicalMaterial({ map: barkTexture(), roughness: 0.95, clearcoat: 0.04 })
    );
    trunk.position.y = 1.2;
    group.add(trunk);
    const greens = [0x1a3a22, 0x16341c, 0x204828];
    for (let i = 0; i < 4; i++) {
        const cone = new THREE.Mesh(PINE_LAYERS[i], std(greens[i % 3], 0.92));
        cone.position.y = 2.1 + i * 0.7;
        group.add(cone);
    }
    enableShadows(group);
    return group;
}

export function buildOak() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.4, 2.2, 16),
        new THREE.MeshPhysicalMaterial({ map: barkTexture(), roughness: 0.95, clearcoat: 0.04 })
    );
    trunk.position.y = 1.1;
    group.add(trunk);
    const crown = new THREE.Mesh(OAK_CROWN, std(0x2a5a28, 0.9));
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
        new THREE.MeshPhysicalMaterial({ map: barkTexture(), color: 0x4a3020, roughness: 0.95, clearcoat: 0.04 })
    );
    trunk.position.y = 4;
    group.add(trunk);
    const hole = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x080408, roughness: 1 })
    );
    hole.position.set(0, 1.6, 2.2);
    group.add(hole);
    const crown = new THREE.Mesh(HOLLOW_CROWN, std(0x1a3018, 0.92));
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
