/**
 * Modelos cinematográficos anos 80: moto cromada PBR, carros, prédios densos,
 * palmeiras, postes e fitas VHS. MeshPhysical no metal; MeshBasic só no néon.
 */

import * as THREE from 'three';
import { neonSignTexture, SIGN_WORDS, windowTexture, chromeScratchMap } from './textures.js';
import { pick } from './utils.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 36);
const SPH = new THREE.SphereGeometry(1, 36, 28);
const CONE = new THREE.ConeGeometry(1, 1, 24);
const CAP = new THREE.CapsuleGeometry(0.5, 1, 10, 28);

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

function chromePhysical(scratch) {
    return new THREE.MeshPhysicalMaterial({
        color: 0xd8e0f0,
        roughness: 0.08,
        metalness: 1.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.4,
        roughnessMap: scratch
    });
}

export function createSharedMaterials(station) {
    const windows = windowTexture(THREE);
    const scratch = chromeScratchMap(THREE);
    return {
        windows: windows.map,
        body: new THREE.MeshPhysicalMaterial({
            color: 0x0c0b14,
            roughness: 0.68,
            metalness: 0.35,
            clearcoat: 0.35,
            clearcoatRoughness: 0.4,
            map: windows.map,
            normalMap: windows.normalMap,
            emissiveMap: windows.emissiveMap,
            emissive: new THREE.Color(station.window),
            emissiveIntensity: 0.85,
            normalScale: new THREE.Vector2(0.55, 0.55)
        }),
        dark: new THREE.MeshPhysicalMaterial({
            color: 0x0a0912,
            roughness: 0.88,
            metalness: 0.2,
            clearcoat: 0.15,
            clearcoatRoughness: 0.55
        }),
        chrome: chromePhysical(scratch),
        rubber: new THREE.MeshPhysicalMaterial({
            color: 0x111114,
            roughness: 0.92,
            metalness: 0.05,
            clearcoat: 0.04
        }),
        neonA: new THREE.MeshBasicMaterial({
            color: station.neonA,
            toneMapped: false
        }),
        neonB: new THREE.MeshBasicMaterial({
            color: station.neonB,
            toneMapped: false
        }),
        glass: new THREE.MeshPhysicalMaterial({
            color: 0x081018,
            roughness: 0.05,
            metalness: 0.2,
            transmission: 0.55,
            thickness: 0.2,
            clearcoat: 1,
            clearcoatRoughness: 0.04,
            transparent: true,
            opacity: 0.7,
            emissive: 0x112244,
            emissiveIntensity: 0.35
        }),
        palm: new THREE.MeshPhysicalMaterial({
            color: 0x0d2a18,
            roughness: 0.75,
            clearcoat: 0.12,
            emissive: 0x032010,
            emissiveIntensity: 0.35
        }),
        trunk: new THREE.MeshPhysicalMaterial({
            color: 0x3a2614,
            roughness: 0.88,
            clearcoat: 0.05
        }),
        lamp: new THREE.MeshBasicMaterial({
            color: station.lamp,
            toneMapped: false
        }),
        tapeBody: new THREE.MeshPhysicalMaterial({
            color: 0x1a1520,
            roughness: 0.35,
            metalness: 0.35,
            clearcoat: 0.55,
            clearcoatRoughness: 0.2
        }),
        tapeWindow: new THREE.MeshPhysicalMaterial({
            color: 0x8aa0c8,
            roughness: 0.08,
            metalness: 0.25,
            transmission: 0.35,
            thickness: 0.08,
            clearcoat: 0.8,
            emissive: 0x334466,
            emissiveIntensity: 0.55,
            transparent: true,
            opacity: 0.85
        }),
        _scratch: scratch
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

    const paint = new THREE.MeshPhysicalMaterial({
        color: 0x1a1028,
        roughness: 0.22,
        metalness: 0.85,
        clearcoat: 0.9,
        clearcoatRoughness: 0.12,
        emissive: 0x2a1038,
        emissiveIntensity: 0.35,
        roughnessMap: mats._scratch
    });

    // Carenagem — lathe alongada (não caixa)
    const fairPts = [
        new THREE.Vector2(0.08, -0.75),
        new THREE.Vector2(0.32, -0.45),
        new THREE.Vector2(0.36, 0.05),
        new THREE.Vector2(0.28, 0.45),
        new THREE.Vector2(0.14, 0.72)
    ];
    const fairGeo = new THREE.LatheGeometry(fairPts, 32);
    fairGeo.rotateZ(-Math.PI / 2);
    fairGeo.scale(1, 0.55, 0.85);
    const fairing = new THREE.Mesh(fairGeo, paint);
    fairing.position.set(0, 0.72, 0.05);
    fairing.castShadow = true;
    lean.add(fairing);

    lean.add(mesh(CAP, paint, 0.55, 0.22, 0.55, 0, 0.95, 0.35));
    lean.add(mesh(CAP, mats.chrome, 0.38, 0.14, 0.55, 0, 0.88, -0.55));

    const tank = mesh(SPH, paint, 0.38, 0.22, 0.55, 0, 0.98, 0.15);
    lean.add(tank);

    const seat = mesh(CAP, new THREE.MeshPhysicalMaterial({
        color: 0x1a0c14,
        roughness: 0.55,
        metalness: 0.08,
        clearcoat: 0.25,
        clearcoatRoughness: 0.4
    }), 0.38, 0.08, 0.42, 0, 0.86, -0.42);
    lean.add(seat);

    const fork = mesh(CYL, mats.chrome, 0.035, 0.55, 0.035, 0.16, 0.7, 0.72);
    const fork2 = fork.clone();
    fork2.position.x = -0.16;
    lean.add(fork, fork2);

    const bars = mesh(CYL, mats.chrome, 0.025, 0.78, 0.025, 0, 1.12, 0.62);
    bars.rotation.z = Math.PI / 2;
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
        const rim = new THREE.Mesh(CYL, mats.chrome);
        rim.scale.set(0.22, 0.18, 0.22);
        rim.rotation.z = Math.PI / 2;
        const disc = new THREE.Mesh(
            new THREE.TorusGeometry(0.26, 0.025, 10, 36),
            mats.chrome
        );
        disc.rotation.y = Math.PI / 2;
        w.add(tire, rim, disc);
        lean.add(w);
        wheels.push(w);
    }

    const rider = new THREE.Group();
    rider.add(mesh(CAP, paint, 0.32, 0.28, 0.28, 0, 1.22, -0.18));
    const helmet = mesh(SPH, mats.chrome, 0.18, 0.16, 0.18, 0, 1.52, -0.02);
    rider.add(helmet);
    rider.add(mesh(BOX, mats.glass, 0.16, 0.08, 0.04, 0, 1.52, 0.14));
    rider.add(mesh(CAP, paint, 0.1, 0.1, 0.38, 0.22, 1.18, 0.22));
    rider.add(mesh(CAP, paint, 0.1, 0.1, 0.38, -0.22, 1.18, 0.22));
    lean.add(rider);

    root.userData = { lean, wheels, glow, paint, head, tail };
    return root;
}

export function createCar(mats, kind = 0) {
    const g = new THREE.Group();
    const bodyCol = [0x1a2030, 0x2a1520, 0x102028, 0x241810, 0x181828][kind % 5];
    const body = new THREE.MeshPhysicalMaterial({
        color: bodyCol,
        roughness: 0.28,
        metalness: 0.78,
        clearcoat: 0.85,
        clearcoatRoughness: 0.14,
        roughnessMap: mats._scratch
    });

    if (kind % 3 === 0) {
        // Sedã — perfil lathe (comprimento ~4.2)
        const sedanPts = [
            new THREE.Vector2(0.35, -2.05),
            new THREE.Vector2(0.72, -1.7),
            new THREE.Vector2(0.82, -0.4),
            new THREE.Vector2(0.78, 0.9),
            new THREE.Vector2(0.55, 1.7),
            new THREE.Vector2(0.22, 2.05)
        ];
        const sedanGeo = new THREE.LatheGeometry(sedanPts, 32);
        sedanGeo.rotateZ(-Math.PI / 2);
        sedanGeo.scale(1, 0.58, 0.95);
        const sedan = new THREE.Mesh(sedanGeo, body);
        sedan.position.y = 0.55;
        sedan.castShadow = true;
        g.add(sedan);
        g.add(mesh(SPH, mats.glass, 1.35, 0.38, 0.95, 0, 1.0, -0.15));
        g.add(mesh(CAP, body, 1.4, 0.16, 0.55, 0, 0.92, -1.2));
    } else if (kind % 3 === 1) {
        // Van / wagon
        const vanPts = [
            new THREE.Vector2(0.55, -2.2),
            new THREE.Vector2(0.85, -1.6),
            new THREE.Vector2(0.9, 0.2),
            new THREE.Vector2(0.85, 1.5),
            new THREE.Vector2(0.5, 2.1)
        ];
        const vanGeo = new THREE.LatheGeometry(vanPts, 28);
        vanGeo.rotateZ(-Math.PI / 2);
        vanGeo.scale(1, 0.75, 0.95);
        const van = new THREE.Mesh(vanGeo, body);
        van.position.y = 0.75;
        van.castShadow = true;
        g.add(van);
        g.add(mesh(BOX, mats.glass, 1.55, 0.42, 1.5, 0, 1.25, 0.35));
    } else {
        // Coupé baixo
        const coupePts = [
            new THREE.Vector2(0.28, -1.75),
            new THREE.Vector2(0.68, -1.35),
            new THREE.Vector2(0.75, -0.2),
            new THREE.Vector2(0.7, 0.9),
            new THREE.Vector2(0.4, 1.45),
            new THREE.Vector2(0.15, 1.75)
        ];
        const coupeGeo = new THREE.LatheGeometry(coupePts, 28);
        coupeGeo.rotateZ(-Math.PI / 2);
        coupeGeo.scale(1, 0.48, 0.92);
        const coupe = new THREE.Mesh(coupeGeo, body);
        coupe.position.y = 0.48;
        coupe.castShadow = true;
        g.add(coupe);
        g.add(mesh(SPH, mats.glass, 1.2, 0.28, 0.75, 0, 0.82, 0.1));
    }

    g.add(mesh(BOX, mats.neonB, 0.35, 0.12, 0.08, 0.45, 0.55, 2.12));
    g.add(mesh(BOX, mats.neonB, 0.35, 0.12, 0.08, -0.45, 0.55, 2.12));
    g.add(mesh(BOX, mats.neonA, 0.4, 0.1, 0.08, 0.5, 0.5, -2.15));
    g.add(mesh(BOX, mats.neonA, 0.4, 0.1, 0.08, -0.5, 0.5, -2.15));

    for (const [x, z] of [[0.7, 1.35], [-0.7, 1.35], [0.7, -1.4], [-0.7, -1.4]]) {
        const tire = mesh(CYL, mats.rubber, 0.28, 0.18, 0.28, x, 0.28, z);
        tire.rotation.z = Math.PI / 2;
        const rim = mesh(CYL, mats.chrome, 0.16, 0.19, 0.16, x, 0.28, z);
        rim.rotation.z = Math.PI / 2;
        g.add(tire, rim);
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
    for (let i = 0; i < 9; i++) {
        const leaf = mesh(CONE, mats.palm, 1.1, 2.2, 0.18, 0, 4.3, 0);
        leaf.rotation.z = 0.85;
        leaf.rotation.y = (i / 9) * Math.PI * 2;
        g.add(leaf);
    }
    return g;
}

export function createLamp(mats) {
    const g = new THREE.Group();
    g.add(mesh(CYL, mats.dark, 0.08, 5.2, 0.08, 0, 2.6, 0));
    g.add(mesh(CYL, mats.chrome, 0.06, 0.12, 0.06, 0, 5.15, 0));
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

    // Cornija / setbacks para densificar a fachada
    if (rng() > 0.4) {
        const ledge = mesh(BOX, mats.dark, w * 1.04, 0.35, d * 1.04, 0, h * 0.55, 0);
        g.add(ledge);
    }
    if (rng() > 0.55) {
        const top = mesh(BOX, mats.dark, w * 0.88, h * 0.12, d * 0.88, 0, h * 0.94, 0);
        g.add(top);
    }
    // Faixas horizontais de néon intercaladas
    const bands = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < bands; i++) {
        const y = h * (0.2 + (i / bands) * 0.65);
        const stripH = mesh(BOX, rng() > 0.5 ? mats.neonA : mats.neonB,
            w * 0.92, 0.08, 0.12,
            0, y, -side * (d / 2 + 0.06));
        g.add(stripH);
    }

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
    g.add(mesh(BOX, mats.chrome, 5.7, 0.08, 0.14, 0, 7.15, -0.08));
    return g;
}
