/**
 * Modelos low-poly: moto cromada, carros 80s, prédios, palmeiras, postes e fitas VHS.
 * Tudo é primitiva + material emissivo — o bloom cuida do brilho.
 */

import * as THREE from 'three';
import { neonSignTexture, SIGN_WORDS, windowTexture } from './textures.js';
import { pick } from './utils.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10);
const SPH = new THREE.SphereGeometry(1, 12, 8);
const CONE = new THREE.ConeGeometry(1, 1, 7);

function mesh(geo, mat, sx, sy, sz, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(sx, sy, sz);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

function hexColor(n) {
    return '#' + n.toString(16).padStart(6, '0');
}

export function createSharedMaterials(station) {
    const windows = windowTexture(THREE);
    return {
        windows,
        body: new THREE.MeshStandardMaterial({
            color: 0x0c0b14,
            roughness: 0.78,
            metalness: 0.22,
            map: windows,
            emissiveMap: windows,
            emissive: new THREE.Color(station.window),
            emissiveIntensity: 0.85
        }),
        dark: new THREE.MeshStandardMaterial({
            color: 0x0a0912,
            roughness: 0.9,
            metalness: 0.1
        }),
        chrome: new THREE.MeshStandardMaterial({
            color: 0xc5d0e8,
            roughness: 0.22,
            metalness: 0.95
        }),
        rubber: new THREE.MeshStandardMaterial({
            color: 0x111114,
            roughness: 0.95,
            metalness: 0.05
        }),
        neonA: new THREE.MeshBasicMaterial({
            color: station.neonA,
            toneMapped: false
        }),
        neonB: new THREE.MeshBasicMaterial({
            color: station.neonB,
            toneMapped: false
        }),
        glass: new THREE.MeshStandardMaterial({
            color: 0x081018,
            roughness: 0.08,
            metalness: 0.4,
            transparent: true,
            opacity: 0.72,
            emissive: 0x112244,
            emissiveIntensity: 0.4
        }),
        palm: new THREE.MeshStandardMaterial({
            color: 0x0d2a18,
            roughness: 0.8,
            emissive: 0x032010,
            emissiveIntensity: 0.35
        }),
        trunk: new THREE.MeshStandardMaterial({
            color: 0x3a2614,
            roughness: 0.9
        }),
        lamp: new THREE.MeshBasicMaterial({
            color: station.lamp,
            toneMapped: false
        }),
        tapeBody: new THREE.MeshStandardMaterial({
            color: 0x1a1520,
            roughness: 0.45,
            metalness: 0.2
        }),
        tapeWindow: new THREE.MeshStandardMaterial({
            color: 0x8aa0c8,
            roughness: 0.15,
            metalness: 0.3,
            emissive: 0x334466,
            emissiveIntensity: 0.6
        })
    };
}

export function tintMaterials(mats, station) {
    mats.body.emissive.setHex(station.window);
    mats.neonA.color.setHex(station.neonA);
    mats.neonB.color.setHex(station.neonB);
    mats.lamp.color.setHex(station.lamp);
}

export function createBike(mats) {
    const root = new THREE.Group();
    const lean = new THREE.Group();
    root.add(lean);

    const paint = new THREE.MeshStandardMaterial({
        color: 0x1a1028,
        roughness: 0.35,
        metalness: 0.7,
        emissive: 0x2a1038,
        emissiveIntensity: 0.4
    });

    const fairing = mesh(BOX, paint, 0.72, 0.42, 1.55, 0, 0.72, 0.05);
    lean.add(fairing);
    lean.add(mesh(BOX, paint, 0.55, 0.28, 0.7, 0, 0.95, 0.35));
    lean.add(mesh(BOX, mats.chrome, 0.42, 0.16, 0.7, 0, 0.88, -0.55));

    const tank = mesh(SPH, paint, 0.38, 0.22, 0.55, 0, 0.98, 0.15);
    lean.add(tank);

    const seat = mesh(BOX, new THREE.MeshStandardMaterial({
        color: 0x1a0c14,
        roughness: 0.7
    }), 0.42, 0.1, 0.55, 0, 0.86, -0.42);
    lean.add(seat);

    const fork = mesh(BOX, mats.chrome, 0.08, 0.55, 0.08, 0.16, 0.7, 0.72);
    const fork2 = fork.clone();
    fork2.position.x = -0.16;
    lean.add(fork, fork2);

    const bars = mesh(BOX, mats.chrome, 0.78, 0.05, 0.05, 0, 1.12, 0.62);
    lean.add(bars);
    lean.add(mesh(SPH, mats.rubber, 0.07, 0.07, 0.07, 0.38, 1.12, 0.62));
    lean.add(mesh(SPH, mats.rubber, 0.07, 0.07, 0.07, -0.38, 1.12, 0.62));

    const head = mesh(SPH, mats.neonB, 0.14, 0.14, 0.1, 0, 0.82, 0.88);
    lean.add(head);
    const tail = mesh(BOX, mats.neonA, 0.28, 0.08, 0.06, 0, 0.78, -0.92);
    lean.add(tail);

    const glow = mesh(BOX, new THREE.MeshBasicMaterial({
        color: 0xff2bd6,
        transparent: true,
        opacity: 0.55,
        toneMapped: false,
        side: THREE.DoubleSide
    }), 0.9, 0.02, 1.8, 0, 0.08, 0);
    lean.add(glow);

    const wheels = [];
    for (const z of [0.78, -0.72]) {
        const w = new THREE.Group();
        w.position.set(0, 0.38, z);
        const tire = new THREE.Mesh(CYL, mats.rubber);
        tire.scale.set(0.38, 0.16, 0.38);
        tire.rotation.z = Math.PI / 2;
        const rim = new THREE.Mesh(CYL, mats.neonB);
        rim.scale.set(0.22, 0.18, 0.22);
        rim.rotation.z = Math.PI / 2;
        w.add(tire, rim);
        lean.add(w);
        wheels.push(w);
    }

    const rider = new THREE.Group();
    rider.add(mesh(BOX, paint, 0.36, 0.38, 0.32, 0, 1.22, -0.18));
    const helmet = mesh(SPH, mats.chrome, 0.18, 0.16, 0.18, 0, 1.52, -0.02);
    rider.add(helmet);
    rider.add(mesh(BOX, mats.glass, 0.16, 0.08, 0.04, 0, 1.52, 0.14));
    rider.add(mesh(BOX, paint, 0.12, 0.12, 0.45, 0.22, 1.18, 0.22));
    rider.add(mesh(BOX, paint, 0.12, 0.12, 0.45, -0.22, 1.18, 0.22));
    lean.add(rider);

    root.userData = { lean, wheels, glow, paint, head, tail };
    return root;
}

export function createCar(mats, kind = 0) {
    const g = new THREE.Group();
    const bodyCol = [0x1a2030, 0x2a1520, 0x102028, 0x241810, 0x181828][kind % 5];
    const body = new THREE.MeshStandardMaterial({
        color: bodyCol,
        roughness: 0.45,
        metalness: 0.55
    });

    if (kind % 3 === 0) {
        g.add(mesh(BOX, body, 1.7, 0.55, 4.2, 0, 0.55, 0));
        g.add(mesh(BOX, mats.glass, 1.55, 0.42, 1.6, 0, 1.05, -0.2));
        g.add(mesh(BOX, body, 1.7, 0.22, 1.4, 0, 0.95, -1.2));
    } else if (kind % 3 === 1) {
        g.add(mesh(BOX, body, 1.85, 0.7, 4.6, 0, 0.7, 0));
        g.add(mesh(BOX, mats.glass, 1.7, 0.38, 1.4, 0, 1.18, 0.4));
        g.add(mesh(BOX, body, 1.85, 0.5, 1.6, 0, 1.1, -1.3));
    } else {
        g.add(mesh(BOX, body, 1.6, 0.45, 3.6, 0, 0.5, 0));
        g.add(mesh(BOX, mats.glass, 1.45, 0.32, 1.2, 0, 0.88, 0.15));
        g.add(mesh(BOX, body, 1.6, 0.18, 1.1, 0, 0.72, -1.1));
    }

    g.add(mesh(BOX, mats.neonB, 0.35, 0.12, 0.08, 0.45, 0.55, 2.12));
    g.add(mesh(BOX, mats.neonB, 0.35, 0.12, 0.08, -0.45, 0.55, 2.12));
    g.add(mesh(BOX, mats.neonA, 0.4, 0.1, 0.08, 0.5, 0.5, -2.15));
    g.add(mesh(BOX, mats.neonA, 0.4, 0.1, 0.08, -0.5, 0.5, -2.15));

    for (const [x, z] of [[0.7, 1.35], [-0.7, 1.35], [0.7, -1.4], [-0.7, -1.4]]) {
        const tire = mesh(CYL, mats.rubber, 0.28, 0.18, 0.28, x, 0.28, z);
        tire.rotation.z = Math.PI / 2;
        g.add(tire);
    }

    g.userData.length = kind % 3 === 1 ? 4.8 : 4.2;
    g.userData.width = 1.9;
    return g;
}

export function createCassette(mats) {
    const g = new THREE.Group();
    g.add(mesh(BOX, mats.tapeBody, 0.9, 0.55, 0.18, 0, 0, 0));
    g.add(mesh(BOX, mats.tapeWindow, 0.55, 0.28, 0.06, 0, 0.02, 0.08));
    const reel = mesh(CYL, mats.chrome, 0.12, 0.08, 0.12, -0.16, 0.02, 0.1);
    reel.rotation.x = Math.PI / 2;
    const reel2 = reel.clone();
    reel2.position.x = 0.16;
    g.add(reel, reel2);
    const label = mesh(BOX, mats.neonA, 0.7, 0.12, 0.04, 0, -0.16, 0.1);
    g.add(label);
    g.userData.reels = [reel, reel2];
    return g;
}

export function createPalm(mats) {
    const g = new THREE.Group();
    const trunk = mesh(CYL, mats.trunk, 0.16, 4.4, 0.16, 0, 2.2, 0);
    g.add(trunk);
    for (let i = 0; i < 7; i++) {
        const leaf = mesh(CONE, mats.palm, 1.1, 2.2, 0.18, 0, 4.3, 0);
        leaf.rotation.z = 0.85;
        leaf.rotation.y = (i / 7) * Math.PI * 2;
        g.add(leaf);
    }
    return g;
}

export function createLamp(mats) {
    const g = new THREE.Group();
    g.add(mesh(CYL, mats.dark, 0.08, 5.2, 0.08, 0, 2.6, 0));
    g.add(mesh(BOX, mats.dark, 1.4, 0.08, 0.12, 0.5, 5.15, 0));
    const bulb = mesh(BOX, mats.lamp, 0.45, 0.12, 0.25, 1.05, 5.0, 0);
    g.add(bulb);
    g.userData.bulb = bulb;
    return g;
}

export function createBuilding(mats, rng, density, side = 1) {
    const g = new THREE.Group();
    const w = 5.5 + rng() * 7.5;
    const d = 7 + rng() * 11;
    const h = 8 + rng() ** 1.4 * (28 + density * 18);

    const body = mesh(BOX, mats.body, w, h, d, 0, h / 2, 0);
    g.add(body);

    const strip = mesh(BOX, rng() > 0.5 ? mats.neonA : mats.neonB, 0.16, h * 0.92, 0.16,
        -side * (w / 2 + 0.08), h / 2, (rng() - 0.5) * d * 0.6);
    g.add(strip);

    if (rng() > 0.35) {
        const word = pick(SIGN_WORDS);
        const color = rng() > 0.5 ? 0xff2bd6 : 0x00f0ff;
        const tex = neonSignTexture(THREE, word, hexColor(color));
        const signMat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            toneMapped: false,
            side: THREE.DoubleSide
        });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.9, 6.5), 1.15), signMat);
        sign.position.set(-side * (w / 2 + 0.12), 3.2 + rng() * (h * 0.4), 0);
        sign.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(sign);
        g.userData.signMat = signMat;
        g.userData.signColor = color;
    }

    if (rng() > 0.7) {
        const dish = mesh(CYL, mats.chrome, 0.55, 0.08, 0.55, rng() * 1.4 - 0.7, h + 0.2, rng() * 1.4 - 0.7);
        g.add(dish);
    }

    g.userData.height = h;
    return g;
}

export function createBillboard(mats, title = 'NEON RIDER') {
    const g = new THREE.Group();
    g.add(mesh(CYL, mats.dark, 0.1, 6.2, 0.1, -1.6, 3.1, 0));
    g.add(mesh(CYL, mats.dark, 0.1, 6.2, 0.1, 1.6, 3.1, 0));
    const tex = neonSignTexture(THREE, title, '#00f0ff');
    const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        toneMapped: false,
        side: THREE.DoubleSide
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 1.4), mat);
    board.position.set(0, 6.4, 0);
    g.add(board);
    g.add(mesh(BOX, mats.dark, 5.6, 1.6, 0.12, 0, 6.4, -0.08));
    return g;
}
