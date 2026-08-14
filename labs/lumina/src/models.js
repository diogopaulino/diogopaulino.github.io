/**
 * Modelos toon construídos só com geometria nativa.
 * Paleta saturada, formas arredondadas e telhados cónicos — o vocabulário
 * visual de um castelo Disney (Bela Adormecida + Enrolados).
 */

import * as THREE from 'three';
import { toonRamp, flagTexture, windowTexture, grassTexture, stoneTexture } from './textures.js';

const geo = {
    sphere: new THREE.SphereGeometry(1, 18, 14),
    sphereLo: new THREE.SphereGeometry(1, 12, 10),
    sphereHi: new THREE.SphereGeometry(1, 24, 18),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
    cylLo: new THREE.CylinderGeometry(1, 1, 1, 10),
    cone: new THREE.ConeGeometry(1, 1, 16),
    coneLo: new THREE.ConeGeometry(1, 1, 10),
    torus: new THREE.TorusGeometry(1, 0.18, 10, 24),
    plane: new THREE.PlaneGeometry(1, 1)
};

export function toon(color, {
    emissive = 0x000000,
    em = 0,
    map = null,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide
} = {}) {
    return new THREE.MeshToonMaterial({
        color,
        map,
        gradientMap: toonRamp(),
        emissive,
        emissiveIntensity: em,
        transparent,
        opacity,
        side
    });
}

function mesh(geometry, material, { pos, scale, rot, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

const MAT = {
    cream: toon(0xfff3e0, { map: stoneTexture() }),
    blush: toon(0xf7c4c4),
    roofBlue: toon(0x5b7cfa),
    roofPink: toon(0xff6fae),
    roofTeal: toon(0x3ecfc0),
    gold: toon(0xffd166, { emissive: 0xff9f43, em: 0.22 }),
    goldSoft: toon(0xffe08a),
    grass: toon(0x6fd15a, { map: grassTexture() }),
    dirt: toon(0xe0a070),
    rock: toon(0xd8b49a),
    wood: toon(0xb07248),
    leafMint: toon(0x5ad68a),
    leafTeal: toon(0x2db88a),
    leafLime: toon(0xa8e063),
    water: toon(0x4ecdc4, { transparent: true, opacity: 0.86 }),
    cloud: toon(0xfff7f0),
    cloudPink: toon(0xffd6e8),
    cloudPeach: toon(0xffe0c2),
    white: toon(0xfffaf4),
    ink: toon(0x2a1840),
    star: toon(0xffe566, { emissive: 0xffc107, em: 0.85 }),
    lantern: toon(0xffb347, { emissive: 0xff7a18, em: 0.95 }),
    flame: toon(0xfff3a0, { emissive: 0xffee88, em: 1.4 }),
    window: toon(0xffd27a, { map: windowTexture(), emissive: 0xff9a3a, em: 0.55 }),
    petal: toon(0xff7ab0),
    petalY: toon(0xffe066),
    petalL: toon(0xc9a0ff)
};

function flag(colorA, colorB) {
    const g = new THREE.Group();
    g.add(mesh(geo.cylLo, MAT.goldSoft, { scale: [0.04, 1.6, 0.04], pos: [0, 0.8, 0], cast: false }));
    const cloth = mesh(geo.plane, toon(0xffffff, { map: flagTexture(colorA, colorB), side: THREE.DoubleSide }), {
        scale: [0.9, 0.5, 1],
        pos: [0.46, 1.35, 0],
        cast: false
    });
    cloth.material.transparent = true;
    g.add(cloth);
    g.userData.flag = cloth;
    return g;
}

function tower({ h = 6, r = 1.15, roof = MAT.roofBlue, onion = false } = {}) {
    const g = new THREE.Group();
    g.add(mesh(geo.cyl, MAT.cream, { scale: [r, h, r], pos: [0, h / 2, 0] }));
    g.add(mesh(geo.cyl, MAT.goldSoft, { scale: [r * 1.08, 0.18, r * 1.08], pos: [0, h - 0.05, 0], cast: false }));
    if (onion) {
        g.add(mesh(geo.sphere, roof, { scale: [r * 1.15, r * 1.35, r * 1.15], pos: [0, h + r * 0.4, 0] }));
        g.add(mesh(geo.cone, roof, { scale: [r * 0.55, r * 1.6, r * 0.55], pos: [0, h + r * 1.5, 0] }));
    } else {
        g.add(mesh(geo.cone, roof, { scale: [r * 1.35, h * 0.55, r * 1.35], pos: [0, h + h * 0.22, 0] }));
    }
    g.add(mesh(geo.sphere, MAT.gold, { scale: [0.18, 0.18, 0.18], pos: [0, h + (onion ? r * 2.2 : h * 0.5), 0], cast: false }));
    const winH = Math.max(1.6, h * 0.28);
    g.add(mesh(geo.box, MAT.window, {
        scale: [r * 0.55, winH * 0.7, 0.08],
        pos: [0, h * 0.55, r + 0.02],
        cast: false
    }));
    return g;
}

export function createCastle() {
    const root = new THREE.Group();
    root.name = 'castle';

    root.add(mesh(geo.cyl, MAT.cream, { scale: [7.2, 1.1, 7.2], pos: [0, 0.55, 0] }));
    root.add(mesh(geo.box, MAT.cream, { scale: [8.4, 5.4, 6.2], pos: [0, 3.7, 0] }));
    root.add(mesh(geo.box, MAT.roofBlue, { scale: [8.9, 0.45, 6.7], pos: [0, 6.5, 0] }));

    const keep = tower({ h: 9.5, r: 1.55, roof: MAT.roofPink, onion: true });
    keep.position.set(0, 6.4, 0);
    root.add(keep);

    const corners = [
        [-3.6, 0, -2.6, 7.2, 0.95, MAT.roofBlue, false],
        [3.6, 0, -2.6, 6.4, 0.9, MAT.roofTeal, true],
        [-3.8, 0, 2.5, 5.6, 0.85, MAT.roofPink, false],
        [3.8, 0, 2.5, 8.1, 1.05, MAT.roofBlue, true]
    ];
    for (const [x, y, z, h, r, roof, onion] of corners) {
        const t = tower({ h, r, roof, onion });
        t.position.set(x, y, z);
        root.add(t);
        const f = flag(roof === MAT.roofPink ? '#ff6fae' : roof === MAT.roofTeal ? '#3ecfc0' : '#5b7cfa', '#ffe27a');
        f.position.set(x, h + (onion ? 3.4 : 2.6), z);
        f.scale.setScalar(0.85);
        root.add(f);
    }

    const spireFlag = flag('#ff6fae', '#fff4c0');
    spireFlag.position.set(0, 18.6, 0);
    root.add(spireFlag);

    // Portão e escadaria
    root.add(mesh(geo.box, MAT.ink, { scale: [1.8, 2.4, 0.4], pos: [0, 1.5, 3.2], cast: false }));
    root.add(mesh(geo.cyl, MAT.goldSoft, {
        scale: [0.95, 0.4, 0.95],
        pos: [0, 2.7, 3.2],
        rot: [Math.PI / 2, 0, 0],
        cast: false
    }));
    for (let i = 0; i < 5; i++) {
        root.add(mesh(geo.box, MAT.rock, {
            scale: [2.6 - i * 0.18, 0.28, 1.1],
            pos: [0, 0.2 + i * 0.22, 4.2 + i * 0.7],
            receive: true
        }));
    }

    // Rosácea
    root.add(mesh(geo.torus, MAT.gold, { scale: [0.7, 0.7, 0.7], pos: [0, 5.2, 3.2], cast: false }));
    root.add(mesh(geo.sphere, MAT.window, { scale: [0.55, 0.55, 0.08], pos: [0, 5.2, 3.22], cast: false }));

    // Varanda
    root.add(mesh(geo.box, MAT.cream, { scale: [3.2, 0.22, 1.3], pos: [0, 4.3, 3.5] }));
    for (let i = -1; i <= 1; i++) {
        root.add(mesh(geo.cylLo, MAT.goldSoft, { scale: [0.08, 0.7, 0.08], pos: [i * 1.1, 4.7, 4.0], cast: false }));
    }

    root.userData.windows = [];
    root.traverse((obj) => {
        if (obj.material === MAT.window) root.userData.windows.push(obj);
    });

    return root;
}

export function createCottage({ roof = MAT.roofPink } = {}) {
    const g = new THREE.Group();
    g.add(mesh(geo.box, MAT.cream, { scale: [2.2, 1.6, 1.8], pos: [0, 0.9, 0] }));
    g.add(mesh(geo.cone, roof, { scale: [1.7, 1.4, 1.7], pos: [0, 2.3, 0] }));
    g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.28, 0.9, 0.28], pos: [0.7, 2.7, 0.2] }));
    g.add(mesh(geo.sphere, toon(0x6a7180), { scale: [0.42, 0.42, 0.42], pos: [0.7, 3.15, 0.2], cast: false }));
    g.add(mesh(geo.box, MAT.window, { scale: [0.45, 0.5, 0.06], pos: [0.55, 1.05, 0.92], cast: false }));
    g.add(mesh(geo.box, MAT.wood, { scale: [0.4, 0.7, 0.08], pos: [-0.4, 0.55, 0.92], cast: false }));
    return g;
}

export function createTree({ kind = 'round', scale = 1 } = {}) {
    const g = new THREE.Group();
    g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.28 * scale, 1.6 * scale, 0.28 * scale], pos: [0, 0.8 * scale, 0] }));
    const leaf = kind === 'pine' ? MAT.leafTeal : kind === 'lime' ? MAT.leafLime : MAT.leafMint;
    if (kind === 'pine') {
        g.add(mesh(geo.cone, leaf, { scale: [1.4 * scale, 1.8 * scale, 1.4 * scale], pos: [0, 2.1 * scale, 0] }));
        g.add(mesh(geo.cone, leaf, { scale: [1.1 * scale, 1.4 * scale, 1.1 * scale], pos: [0, 3.0 * scale, 0] }));
        g.add(mesh(geo.cone, leaf, { scale: [0.75 * scale, 1.1 * scale, 0.75 * scale], pos: [0, 3.7 * scale, 0] }));
    } else {
        g.add(mesh(geo.sphere, leaf, { scale: [1.35 * scale, 1.2 * scale, 1.35 * scale], pos: [0, 2.15 * scale, 0] }));
        g.add(mesh(geo.sphere, leaf, { scale: [0.85 * scale, 0.75 * scale, 0.85 * scale], pos: [0.7 * scale, 2.0 * scale, 0.2 * scale] }));
        g.add(mesh(geo.sphere, leaf, { scale: [0.7 * scale, 0.65 * scale, 0.7 * scale], pos: [-0.55 * scale, 2.25 * scale, -0.15 * scale] }));
    }
    return g;
}

export function createCloud({ tint = 'white', scale = 1 } = {}) {
    const mat = tint === 'pink' ? MAT.cloudPink : tint === 'peach' ? MAT.cloudPeach : MAT.cloud;
    const g = new THREE.Group();
    const blobs = [
        [0, 0, 0, 1.4],
        [1.3, -0.1, 0.2, 1.05],
        [-1.2, -0.15, 0.15, 1.1],
        [0.3, 0.55, -0.2, 0.9],
        [-0.4, 0.4, 0.35, 0.75]
    ];
    for (const [x, y, z, s] of blobs) {
        g.add(mesh(geo.sphereLo, mat, {
            pos: [x * scale, y * scale, z * scale],
            scale: [s * scale, s * 0.78 * scale, s * 0.9 * scale],
            cast: false,
            receive: false
        }));
    }
    g.userData.bob = Math.random() * Math.PI * 2;
    return g;
}

export function createLantern(color = 0xffb347, { light = false } = {}) {
    const g = new THREE.Group();
    const paper = toon(color, { emissive: color, em: 0.8 });
    g.add(mesh(geo.sphere, paper, { scale: [0.28, 0.36, 0.28], pos: [0, 0, 0], cast: false }));
    g.add(mesh(geo.cylLo, MAT.goldSoft, { scale: [0.12, 0.08, 0.12], pos: [0, 0.34, 0], cast: false }));
    g.add(mesh(geo.cylLo, MAT.goldSoft, { scale: [0.1, 0.06, 0.1], pos: [0, -0.34, 0], cast: false }));
    g.add(mesh(geo.sphereLo, MAT.flame, { scale: [0.08, 0.12, 0.08], pos: [0, 0.02, 0], cast: false }));
    if (light) {
        const point = new THREE.PointLight(color, 0.7, 8, 2);
        g.add(point);
        g.userData.light = point;
    }
    g.userData.flame = g.children[3];
    return g;
}

export function createWish() {
    const g = new THREE.Group();
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.42, 0), MAT.star);
    star.castShadow = false;
    g.add(star);
    const halo = new THREE.Mesh(geo.sphereLo, toon(0xfff4c0, {
        emissive: 0xffe08a,
        em: 0.35,
        transparent: true,
        opacity: 0.22
    }));
    halo.scale.setScalar(0.85);
    halo.castShadow = false;
    g.add(halo);
    g.userData.core = star;
    g.userData.halo = halo;
    return g;
}

export function createCarousel() {
    const g = new THREE.Group();
    g.add(mesh(geo.cyl, MAT.goldSoft, { scale: [2.4, 0.18, 2.4], pos: [0, 0.12, 0] }));
    g.add(mesh(geo.cylLo, MAT.gold, { scale: [0.16, 2.4, 0.16], pos: [0, 1.3, 0] }));
    g.add(mesh(geo.cone, MAT.roofPink, { scale: [2.6, 1.3, 2.6], pos: [0, 2.9, 0] }));
    g.add(mesh(geo.sphere, MAT.gold, { scale: [0.22, 0.22, 0.22], pos: [0, 3.6, 0], cast: false }));

    const horses = new THREE.Group();
    const colors = [0xff6fae, 0x5b7cfa, 0x3ecfc0, 0xffe066];
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        const horse = new THREE.Group();
        const mat = toon(colors[i]);
        horse.add(mesh(geo.sphereLo, mat, { scale: [0.28, 0.22, 0.45], pos: [0, 0.55, 0] }));
        horse.add(mesh(geo.sphereLo, mat, { scale: [0.2, 0.2, 0.2], pos: [0, 0.72, 0.38] }));
        horse.add(mesh(geo.cylLo, MAT.goldSoft, { scale: [0.05, 0.9, 0.05], pos: [0, 0.9, 0] }));
        horse.position.set(Math.cos(a) * 1.55, 0, Math.sin(a) * 1.55);
        horse.lookAt(0, horse.position.y, 0);
        horse.rotateY(Math.PI);
        horses.add(horse);
    }
    g.add(horses);
    g.userData.spin = horses;
    return g;
}

export function createWell() {
    const g = new THREE.Group();
    g.add(mesh(geo.cyl, MAT.rock, { scale: [0.9, 0.7, 0.9], pos: [0, 0.35, 0] }));
    g.add(mesh(geo.cyl, toon(0x3a6ea5, { emissive: 0x1a3a80, em: 0.35 }), {
        scale: [0.72, 0.08, 0.72],
        pos: [0, 0.62, 0],
        cast: false
    }));
    g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.07, 1.3, 0.07], pos: [-0.7, 1.15, 0] }));
    g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.07, 1.3, 0.07], pos: [0.7, 1.15, 0] }));
    g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.08, 1.5, 0.08], pos: [0, 1.8, 0], rot: [0, 0, Math.PI / 2] }));
    g.add(mesh(geo.coneLo, MAT.roofTeal, { scale: [1.15, 0.7, 1.15], pos: [0, 2.15, 0] }));
    return g;
}

export function createBridge() {
    const g = new THREE.Group();
    g.add(mesh(geo.box, MAT.wood, { scale: [1.4, 0.16, 6.2], pos: [0, 0.2, 0] }));
    for (const s of [-1, 1]) {
        g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.07, 6.2, 0.07], pos: [0.65 * s, 0.7, 0], rot: [Math.PI / 2, 0, 0] }));
        for (let i = -2; i <= 2; i++) {
            g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.05, 0.7, 0.05], pos: [0.65 * s, 0.5, i * 1.2] }));
        }
    }
    return g;
}

export function createFlowerPatch() {
    const g = new THREE.Group();
    const mats = [MAT.petal, MAT.petalY, MAT.petalL];
    for (let i = 0; i < 14; i++) {
        const m = mats[i % 3];
        const x = (Math.random() - 0.5) * 3.4;
        const z = (Math.random() - 0.5) * 3.4;
        g.add(mesh(geo.sphereLo, m, {
            scale: [0.14, 0.1, 0.14],
            pos: [x, 0.12, z],
            cast: false
        }));
        g.add(mesh(geo.cylLo, MAT.leafMint, {
            scale: [0.03, 0.18, 0.03],
            pos: [x, 0.02, z],
            cast: false
        }));
    }
    return g;
}

/**
 * Luma — a estrela-viajante. Corpo redondo, olhos grandes, laço e uma
 * estrela na testa: o atalho visual de um protagonista Disney.
 */
export function createLuma() {
    const root = new THREE.Group();
    root.name = 'luma';

    const bodyMat = toon(0xfff1b8, { emissive: 0xffd166, em: 0.18 });
    const body = mesh(geo.sphereHi, bodyMat, { scale: [0.55, 0.58, 0.52], pos: [0, 0.15, 0] });
    root.add(body);

    const cheek = toon(0xff9bb3, { emissive: 0xff6fae, em: 0.15 });
    root.add(mesh(geo.sphereLo, cheek, { scale: [0.1, 0.07, 0.06], pos: [0.28, 0.12, 0.38], cast: false }));
    root.add(mesh(geo.sphereLo, cheek, { scale: [0.1, 0.07, 0.06], pos: [-0.28, 0.12, 0.38], cast: false }));

    const eyeW = toon(0xfffdf8);
    const eyeI = MAT.ink;
    const spark = toon(0xffffff, { emissive: 0xffffff, em: 0.6 });
    root.add(mesh(geo.sphere, eyeW, { scale: [0.16, 0.2, 0.1], pos: [0.16, 0.28, 0.4], cast: false }));
    root.add(mesh(geo.sphere, eyeW, { scale: [0.16, 0.2, 0.1], pos: [-0.16, 0.28, 0.4], cast: false }));
    root.add(mesh(geo.sphere, eyeI, { scale: [0.08, 0.1, 0.06], pos: [0.16, 0.26, 0.48], cast: false }));
    root.add(mesh(geo.sphere, eyeI, { scale: [0.08, 0.1, 0.06], pos: [-0.16, 0.26, 0.48], cast: false }));
    root.add(mesh(geo.sphereLo, spark, { scale: [0.035, 0.04, 0.02], pos: [0.19, 0.32, 0.52], cast: false }));
    root.add(mesh(geo.sphereLo, spark, { scale: [0.035, 0.04, 0.02], pos: [-0.13, 0.32, 0.52], cast: false }));

    const brow = toon(0x5b3a28);
    root.add(mesh(geo.box, brow, { scale: [0.12, 0.025, 0.03], pos: [0.16, 0.44, 0.42], rot: [0, 0, 0.2], cast: false }));
    root.add(mesh(geo.box, brow, { scale: [0.12, 0.025, 0.03], pos: [-0.16, 0.44, 0.42], rot: [0, 0, -0.2], cast: false }));

    const smile = mesh(geo.torus, toon(0xe07a8a), {
        scale: [0.12, 0.12, 0.12],
        pos: [0, 0.04, 0.46],
        rot: [1.2, 0, 0],
        cast: false
    });
    smile.scale.z = 0.4;
    root.add(smile);

    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), MAT.star);
    star.position.set(0, 0.78, 0);
    star.castShadow = false;
    root.add(star);

    const ribbon = mesh(geo.plane, toon(0xff6fae, { side: THREE.DoubleSide, emissive: 0xff6fae, em: 0.12 }), {
        scale: [0.18, 0.9, 1],
        pos: [0, -0.15, -0.45],
        rot: [0.4, 0, 0],
        cast: false
    });
    root.add(ribbon);

    const glow = new THREE.PointLight(0xffe08a, 0.9, 8, 2);
    glow.position.set(0, 0.4, 0);
    root.add(glow);

    root.userData.star = star;
    root.userData.ribbon = ribbon;
    root.userData.body = body;
    return root;
}

export function createRainbow() {
    const g = new THREE.TorusGeometry(14, 0.28, 8, 48, Math.PI);
    const colors = [0xff5b7a, 0xff9f43, 0xffe066, 0x6fd15a, 0x5b7cfa, 0xc9a0ff];
    const group = new THREE.Group();
    colors.forEach((c, i) => {
        const ring = new THREE.Mesh(g, toon(c, { emissive: c, em: 0.18, transparent: true, opacity: 0.72 }));
        ring.scale.set(1 + i * 0.035, 1 + i * 0.035, 1);
        ring.castShadow = false;
        ring.receiveShadow = false;
        group.add(ring);
    });
    group.rotation.z = Math.PI;
    group.rotation.y = 0.4;
    return group;
}

export { MAT, geo, mesh };
