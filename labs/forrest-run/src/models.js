/**
 * Modelos low-poly: Forrest (camisa xadrez, cáqui, Cortez brancas),
 * seguidores, árvores, casa do Alabama, caminhão, feno, vaca e placas.
 */

import * as THREE from 'three';
import { plaidTexture, barkTexture, signTexture } from './textures.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 8);
const SPH = new THREE.SphereGeometry(1, 10, 8);
const CONE = new THREE.ConeGeometry(1, 1, 7);

const matCache = new Map();

function std(color, roughness = 0.82, metalness = 0.04, extra = {}) {
    const key = `${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`;
    if (!matCache.has(key)) {
        matCache.set(key, new THREE.MeshStandardMaterial({
            color, roughness, metalness, ...extra
        }));
    }
    return matCache.get(key);
}

function mesh(geo, mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

function enableShadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

let plaidMap = null;
function getPlaid(THREERef) {
    if (!plaidMap) plaidMap = plaidTexture(THREERef);
    return plaidMap;
}

let barkMap = null;
function getBark(THREERef) {
    if (!barkMap) barkMap = barkTexture(THREERef);
    return barkMap;
}

/**
 * Forrest: corte militar loiro, camisa xadrez azul, cáqui e tênis brancos
 * com faixa vermelha. Ossos em userData.parts para a passada.
 */
export function createForrest(THREERef = THREE, { follower = false } = {}) {
    const g = new THREE.Group();
    const skin = std(follower ? 0xd4a07a : 0xe8c4a0, 0.72);
    const hair = std(follower ? 0x3a2a18 : 0xc4a060, 0.9);
    const khaki = std(follower ? 0x4a5a70 : 0xc4b07a, 0.88);
    const shirtMat = follower
        ? std(0x6a3040, 0.86)
        : new THREE.MeshStandardMaterial({
            map: getPlaid(THREERef),
            color: 0xffffff,
            roughness: 0.86,
            metalness: 0.02
        });
    const shoe = std(0xf4f0ea, 0.55);
    const stripe = std(0xc42828, 0.5);

    const hips = new THREE.Group();
    g.add(hips);

    const legs = [];
    const arms = [];

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.11, 0.72, 0);
        hips.add(leg);
        const thigh = mesh(CYL, khaki, 0.075, 0.38, 0.075, 0, -0.18, 0);
        leg.add(thigh);
        const shin = new THREE.Group();
        shin.position.y = -0.38;
        leg.add(shin);
        shin.add(mesh(CYL, khaki, 0.065, 0.34, 0.065, 0, -0.16, 0));
        const foot = new THREE.Group();
        foot.position.set(0, -0.36, 0.06);
        shin.add(foot);
        foot.add(mesh(BOX, shoe, 0.12, 0.07, 0.26, 0, 0, 0.04));
        foot.add(mesh(BOX, stripe, 0.125, 0.03, 0.12, 0, 0.03, 0.02));
        legs.push({ leg, shin, foot });
    }

    const torso = new THREE.Group();
    torso.position.y = 0.78;
    hips.add(torso);
    torso.add(mesh(BOX, shirtMat, 0.42, 0.52, 0.24, 0, 0.22, 0));
    torso.add(mesh(BOX, std(0x2a3a28, 0.7), 0.44, 0.05, 0.26, 0, -0.04, 0));

    const head = new THREE.Group();
    head.position.y = 0.58;
    torso.add(head);
    head.add(mesh(SPH, skin, 0.16, 0.18, 0.16, 0, 0.02, 0));
    const cut = mesh(SPH, hair, 0.165, 0.08, 0.165, 0, 0.1, -0.01);
    head.add(cut);
    for (const sx of [-1, 1]) {
        head.add(mesh(SPH, std(0xf7f4ee, 0.4), 0.028, 0.03, 0.02, sx * 0.055, 0.03, 0.14));
        head.add(mesh(SPH, std(0x3a2a18, 0.4), 0.014, 0.016, 0.012, sx * 0.055, 0.03, 0.155));
        head.add(mesh(SPH, skin, 0.03, 0.04, 0.02, sx * 0.155, 0.0, 0));
    }
    const brow = mesh(BOX, hair, 0.14, 0.02, 0.03, 0, 0.08, 0.12);
    head.add(brow);

    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.26, 0.4, 0);
        torso.add(arm);
        arm.add(mesh(CYL, shirtMat, 0.06, 0.22, 0.06, 0, -0.08, 0));
        const forearm = new THREE.Group();
        forearm.position.y = -0.2;
        arm.add(forearm);
        forearm.add(mesh(CYL, skin, 0.05, 0.24, 0.05, 0, -0.1, 0));
        arms.push({ arm, forearm });
    }

    enableShadows(g);
    g.userData.parts = { hips, torso, head, legs, arms };
    g.userData.follower = follower;
    return g;
}

export function createTree(kind = 'oak') {
    const g = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({
        map: getBark(THREE),
        color: 0xffffff,
        roughness: 0.92
    });
    const leaf = std(kind === 'pine' ? 0x2a5a28 : 0x3d7a32, 0.88);
    if (kind === 'pine') {
        g.add(mesh(CYL, bark, 0.16, 2.4, 0.16, 0, 1.2, 0));
        g.add(mesh(CONE, leaf, 1.15, 1.8, 1.15, 0, 2.1, 0));
        g.add(mesh(CONE, leaf, 0.85, 1.5, 0.85, 0, 3.0, 0));
        g.add(mesh(CONE, leaf, 0.5, 1.1, 0.5, 0, 3.7, 0));
    } else if (kind === 'cactus') {
        const cactus = std(0x4a8a48, 0.7);
        g.add(mesh(CYL, cactus, 0.22, 1.8, 0.22, 0, 0.9, 0));
        g.add(mesh(CYL, cactus, 0.12, 0.7, 0.12, 0.32, 1.1, 0));
        g.add(mesh(CYL, cactus, 0.12, 0.55, 0.12, -0.28, 1.35, 0));
    } else {
        g.add(mesh(CYL, bark, 0.18, 1.6, 0.18, 0, 0.8, 0));
        g.add(mesh(SPH, leaf, 1.15, 0.85, 1.15, 0, 2.05, 0));
        g.add(mesh(SPH, leaf, 0.7, 0.55, 0.7, 0.55, 1.85, 0.2));
        g.add(mesh(SPH, leaf, 0.55, 0.45, 0.55, -0.5, 1.9, -0.15));
    }
    enableShadows(g);
    return g;
}

export function createHouse() {
    const g = new THREE.Group();
    const wall = std(0xf2ece0, 0.9);
    const roof = std(0x8a3030, 0.78);
    const wood = std(0x6a4a28, 0.86);
    g.add(mesh(BOX, wall, 4.2, 2.4, 3.2, 0, 1.2, 0));
    const roofM = mesh(BOX, roof, 4.8, 0.18, 3.8, 0, 2.55, 0);
    roofM.rotation.x = 0.18;
    g.add(roofM);
    g.add(mesh(BOX, wood, 0.7, 1.5, 0.08, 0, 0.75, 1.62));
    g.add(mesh(BOX, std(0x7ec8e8, 0.3, 0.1), 0.7, 0.7, 0.06, -1.2, 1.5, 1.62));
    g.add(mesh(BOX, std(0x7ec8e8, 0.3, 0.1), 0.7, 0.7, 0.06, 1.2, 1.5, 1.62));
    g.add(mesh(CYL, std(0xc8b8a0, 0.8), 0.18, 1.1, 0.18, 1.9, 2.9, -0.4));
    enableShadows(g);
    return g;
}

export function createBarn() {
    const g = new THREE.Group();
    g.add(mesh(BOX, std(0xa43028, 0.86), 5.2, 3.2, 3.6, 0, 1.6, 0));
    g.add(mesh(BOX, std(0x6a5040, 0.8), 5.6, 0.2, 4.0, 0, 3.3, 0));
    g.add(mesh(BOX, std(0x2a2018, 0.9), 1.4, 2.2, 0.1, 0, 1.1, 1.82));
    enableShadows(g);
    return g;
}

export function createTruck() {
    const g = new THREE.Group();
    const paint = std(0xb84828, 0.45, 0.2);
    const dark = std(0x1a1a1c, 0.7);
    g.add(mesh(BOX, paint, 1.9, 1.05, 3.4, 0, 0.85, 0));
    g.add(mesh(BOX, paint, 1.85, 0.85, 1.3, 0, 1.55, -0.85));
    g.add(mesh(BOX, std(0x88c4e0, 0.2, 0.15), 1.7, 0.5, 0.08, 0, 1.55, -1.5));
    for (const z of [-1.05, 1.05]) {
        for (const x of [-0.85, 0.85]) {
            const wheel = mesh(CYL, dark, 0.32, 0.22, 0.32, x, 0.32, z);
            wheel.rotation.z = Math.PI / 2;
            g.add(wheel);
        }
    }
    enableShadows(g);
    g.userData.kind = 'block';
    return g;
}

export function createHay() {
    const g = new THREE.Group();
    const hay = std(0xc8a84a, 0.92);
    const roll = mesh(CYL, hay, 0.55, 0.95, 0.55, 0, 0.45, 0);
    roll.rotation.z = Math.PI / 2;
    g.add(roll);
    enableShadows(g);
    g.userData.kind = 'low';
    return g;
}

export function createCrate() {
    const g = new THREE.Group();
    g.add(mesh(BOX, std(0x8a5a28, 0.88), 0.95, 0.95, 0.95, 0, 0.48, 0));
    enableShadows(g);
    g.userData.kind = 'low';
    return g;
}

export function createCow() {
    const g = new THREE.Group();
    const hide = std(0xf0ece4, 0.86);
    const spot = std(0x2a2a28, 0.86);
    g.add(mesh(BOX, hide, 0.7, 0.55, 1.35, 0, 0.7, 0));
    g.add(mesh(BOX, spot, 0.4, 0.35, 0.4, 0.12, 0.78, 0.2));
    g.add(mesh(SPH, hide, 0.22, 0.2, 0.22, 0, 0.85, -0.75));
    for (const z of [-0.4, 0.4]) {
        for (const x of [-0.22, 0.22]) {
            g.add(mesh(CYL, hide, 0.08, 0.45, 0.08, x, 0.22, z));
        }
    }
    enableShadows(g);
    g.userData.kind = 'low';
    return g;
}

export function createCone() {
    const g = new THREE.Group();
    g.add(mesh(CONE, std(0xe85820, 0.7), 0.22, 0.7, 0.22, 0, 0.35, 0));
    g.add(mesh(CYL, std(0xf4f0ea, 0.6), 0.18, 0.06, 0.18, 0, 0.28, 0));
    enableShadows(g);
    g.userData.kind = 'low';
    return g;
}

export function createBillboard(title = 'BUBBA GUMP', sub = 'SHRIMP CO.') {
    const g = new THREE.Group();
    const post = std(0x5a4030, 0.88);
    g.add(mesh(CYL, post, 0.08, 3.2, 0.08, -1.4, 1.6, 0));
    g.add(mesh(CYL, post, 0.08, 3.2, 0.08, 1.4, 1.6, 0));
    const mat = new THREE.MeshStandardMaterial({
        map: signTexture(THREE, title, sub),
        roughness: 0.7,
        metalness: 0.05
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.8), mat);
    board.position.set(0, 2.6, 0.08);
    board.castShadow = true;
    g.add(board);
    g.userData.signMat = mat;
    return g;
}

export function createRock() {
    const g = new THREE.Group();
    const stone = std(0x8a7a68, 0.92);
    g.add(mesh(SPH, stone, 0.9, 0.45, 0.7, 0, 0.22, 0));
    g.add(mesh(SPH, stone, 0.5, 0.3, 0.4, 0.4, 0.18, 0.1));
    enableShadows(g);
    return g;
}

export function createFence() {
    const g = new THREE.Group();
    const wood = std(0x8a6a40, 0.9);
    for (let i = -2; i <= 2; i++) {
        g.add(mesh(BOX, wood, 0.08, 1.1, 0.08, i * 0.7, 0.55, 0));
    }
    g.add(mesh(BOX, wood, 3.2, 0.07, 0.07, 0, 0.4, 0));
    g.add(mesh(BOX, wood, 3.2, 0.07, 0.07, 0, 0.75, 0));
    enableShadows(g);
    return g;
}

export function createFeatherMesh() {
    const g = new THREE.Group();
    const white = std(0xf7f4ee, 0.45);
    const vane = mesh(SPH, white, 0.07, 0.018, 0.22, 0, 0, 0);
    g.add(vane);
    g.add(mesh(CYL, std(0xe8e0d0, 0.5), 0.008, 0.28, 0.008, 0, 0, 0.02));
    g.userData.kind = 'feather';
    return g;
}

export function createMesa() {
    const g = new THREE.Group();
    const rock = std(0xc07848, 0.9);
    g.add(mesh(CYL, rock, 3.4, 4.5, 3.4, 0, 2.25, 0));
    g.add(mesh(CYL, std(0xd09058, 0.88), 3.8, 0.35, 3.8, 0, 4.55, 0));
    enableShadows(g);
    return g;
}

export function disposeGroup(group) {
    group.traverse((obj) => {
        if (obj.userData?.signMat) {
            obj.userData.signMat.map?.dispose();
            obj.userData.signMat.dispose();
        }
    });
    while (group.children.length) group.remove(group.children[0]);
}
