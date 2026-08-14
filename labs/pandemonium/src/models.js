/**
 * Modelos low-poly do carnaval de Lyrion: Lyra, Bico, impes, cristais e cenário.
 * Tudo é geometria nativa — nenhum glTF.
 */

import * as THREE from 'three';
import { toonRamp, stoneTexture, woodTexture, crystalTexture, grassTexture } from './textures.js';

const geo = {
    sphere: new THREE.SphereGeometry(1, 12, 10),
    sphereHi: new THREE.SphereGeometry(1, 16, 12),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 8),
    cone: new THREE.ConeGeometry(1, 1, 8),
    torus: new THREE.TorusGeometry(1, 0.22, 8, 16),
    octa: new THREE.OctahedronGeometry(1, 0)
};

function toon(color, { emissive = 0x000000, em = 0, transparent = false, opacity = 1 } = {}) {
    return new THREE.MeshToonMaterial({
        color,
        gradientMap: toonRamp(),
        emissive,
        emissiveIntensity: em,
        transparent,
        opacity
    });
}

function lambert(color, map = null, opts = {}) {
    return new THREE.MeshLambertMaterial({ color, map, ...opts });
}

function mesh(geometry, material, { pos, scale, rot, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (scale) m.scale.set(scale[0], scale[1], scale[2]);
    if (rot) m.rotation.set(rot[0], rot[1], rot[2]);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

export function createLyra() {
    const root = new THREE.Group();
    root.name = 'lyra';

    const hips = new THREE.Group();
    hips.position.y = 0.72;
    root.add(hips);

    const skin = toon(0xf3c7a8);
    const hair = toon(0xff2d95, { emissive: 0xff2d95, em: 0.12 });
    const tunic = toon(0x1ec8b0);
    const gold = toon(0xffd166);
    const boot = toon(0x3a1848);

    const torso = mesh(geo.box, tunic, { scale: [0.62, 0.72, 0.38] });
    torso.position.y = 0.42;
    hips.add(torso);

    const belt = mesh(geo.cyl, gold, { pos: [0, 0.08, 0], scale: [0.34, 0.08, 0.34] });
    hips.add(belt);

    const head = new THREE.Group();
    head.position.y = 0.95;
    hips.add(head);
    head.add(mesh(geo.sphereHi, skin, { scale: [0.32, 0.34, 0.3] }));
    head.add(mesh(geo.sphere, hair, { pos: [0, 0.12, -0.02], scale: [0.36, 0.28, 0.34] }));
    // Maria-chiquinha / twin tails.
    head.add(mesh(geo.sphere, hair, { pos: [0.28, 0.02, -0.04], scale: [0.14, 0.28, 0.14] }));
    head.add(mesh(geo.sphere, hair, { pos: [-0.28, 0.02, -0.04], scale: [0.14, 0.28, 0.14] }));
    head.add(mesh(geo.cone, hair, { pos: [0, 0.38, -0.02], scale: [0.16, 0.28, 0.16] }));

    const eyeW = toon(0xfff8f0);
    const eyeI = toon(0x1a1024);
    head.add(mesh(geo.sphere, eyeW, { pos: [0.1, 0.02, 0.24], scale: [0.08, 0.1, 0.05], cast: false }));
    head.add(mesh(geo.sphere, eyeW, { pos: [-0.1, 0.02, 0.24], scale: [0.08, 0.1, 0.05], cast: false }));
    head.add(mesh(geo.sphere, eyeI, { pos: [0.1, 0.02, 0.28], scale: [0.04, 0.05, 0.03], cast: false }));
    head.add(mesh(geo.sphere, eyeI, { pos: [-0.1, 0.02, 0.28], scale: [0.04, 0.05, 0.03], cast: false }));

    const lArm = new THREE.Group();
    lArm.position.set(0.4, 0.62, 0);
    const rArm = new THREE.Group();
    rArm.position.set(-0.4, 0.62, 0);
    hips.add(lArm, rArm);
    lArm.add(mesh(geo.cyl, skin, { pos: [0, -0.28, 0], scale: [0.08, 0.52, 0.08] }));
    rArm.add(mesh(geo.cyl, skin, { pos: [0, -0.28, 0], scale: [0.08, 0.52, 0.08] }));
    lArm.add(mesh(geo.sphere, gold, { pos: [0, -0.54, 0], scale: [0.1, 0.1, 0.1] }));
    rArm.add(mesh(geo.sphere, gold, { pos: [0, -0.54, 0], scale: [0.1, 0.1, 0.1] }));

    const lLeg = new THREE.Group();
    lLeg.position.set(0.16, 0, 0);
    const rLeg = new THREE.Group();
    rLeg.position.set(-0.16, 0, 0);
    hips.add(lLeg, rLeg);
    lLeg.add(mesh(geo.cyl, boot, { pos: [0, -0.38, 0], scale: [0.11, 0.7, 0.11] }));
    rLeg.add(mesh(geo.cyl, boot, { pos: [0, -0.38, 0], scale: [0.11, 0.7, 0.11] }));
    lLeg.add(mesh(geo.box, boot, { pos: [0, -0.74, 0.08], scale: [0.22, 0.1, 0.34] }));
    rLeg.add(mesh(geo.box, boot, { pos: [0, -0.74, 0.08], scale: [0.22, 0.1, 0.34] }));

    const cape = mesh(geo.box, toon(0x6c2bd9), { pos: [0, 0.35, -0.28], scale: [0.5, 0.7, 0.06] });
    hips.add(cape);

    root.userData = { hips, head, lArm, rArm, lLeg, rLeg, cape };
    return root;
}

export function createBico() {
    const root = new THREE.Group();
    const bone = toon(0xf0e6d0);
    const hat = toon(0x6c2bd9);
    const gold = toon(0xffd166);
    const glow = toon(0x2de2c5, { emissive: 0x2de2c5, em: 0.8 });

    root.add(mesh(geo.sphere, bone, { scale: [0.22, 0.24, 0.2] }));
    root.add(mesh(geo.box, bone, { pos: [0, -0.12, 0.04], scale: [0.28, 0.08, 0.16] }));
    root.add(mesh(geo.sphere, glow, { pos: [0.07, 0.04, 0.16], scale: [0.05, 0.06, 0.04], cast: false }));
    root.add(mesh(geo.sphere, glow, { pos: [-0.07, 0.04, 0.16], scale: [0.05, 0.06, 0.04], cast: false }));
    root.add(mesh(geo.cone, hat, { pos: [0, 0.28, 0], scale: [0.16, 0.32, 0.16] }));
    root.add(mesh(geo.sphere, gold, { pos: [0, 0.46, 0], scale: [0.07, 0.07, 0.07] }));
    root.add(mesh(geo.cone, toon(0xff2d95), { pos: [0.16, 0.22, 0], rot: [0, 0, -0.9], scale: [0.08, 0.22, 0.08] }));
    root.add(mesh(geo.cone, toon(0xffd166), { pos: [-0.16, 0.22, 0], rot: [0, 0, 0.9], scale: [0.08, 0.22, 0.08] }));
    return root;
}

export function createImp(kind = 'imp') {
    const root = new THREE.Group();
    root.userData.kind = kind;

    if (kind === 'wisp') {
        const body = mesh(geo.sphere, toon(0xc45cff, { emissive: 0xc45cff, em: 0.55 }), {
            scale: [0.42, 0.42, 0.42]
        });
        root.add(body);
        root.add(mesh(geo.cone, toon(0x7ef0ff, { emissive: 0x2de2c5, em: 0.4 }), {
            pos: [0, -0.45, 0], scale: [0.18, 0.5, 0.18]
        }));
        return root;
    }

    if (kind === 'spike') {
        const mat = toon(0x5a6a78);
        root.add(mesh(geo.sphere, mat, { scale: [0.48, 0.4, 0.48] }));
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            root.add(mesh(geo.cone, toon(0xffd166), {
                pos: [Math.cos(a) * 0.4, 0.15, Math.sin(a) * 0.4],
                rot: [0.4, a, 0],
                scale: [0.12, 0.38, 0.12]
            }));
        }
        return root;
    }

    const body = toon(0xff3b4a);
    root.add(mesh(geo.sphere, body, { pos: [0, 0.35, 0], scale: [0.46, 0.4, 0.42] }));
    root.add(mesh(geo.cone, toon(0xffd166), { pos: [0.18, 0.72, 0], scale: [0.08, 0.28, 0.08] }));
    root.add(mesh(geo.cone, toon(0xffd166), { pos: [-0.18, 0.72, 0], scale: [0.08, 0.28, 0.08] }));
    const eye = toon(0x1a1024);
    root.add(mesh(geo.sphere, toon(0xfff8f0), { pos: [0.14, 0.42, 0.32], scale: [0.1, 0.12, 0.06], cast: false }));
    root.add(mesh(geo.sphere, toon(0xfff8f0), { pos: [-0.14, 0.42, 0.32], scale: [0.1, 0.12, 0.06], cast: false }));
    root.add(mesh(geo.sphere, eye, { pos: [0.14, 0.42, 0.36], scale: [0.05, 0.06, 0.03], cast: false }));
    root.add(mesh(geo.sphere, eye, { pos: [-0.14, 0.42, 0.36], scale: [0.05, 0.06, 0.03], cast: false }));
    root.add(mesh(geo.cyl, body, { pos: [0.18, 0.02, 0.1], scale: [0.08, 0.28, 0.08] }));
    root.add(mesh(geo.cyl, body, { pos: [-0.18, 0.02, 0.1], scale: [0.08, 0.28, 0.08] }));
    return root;
}

export function createGem() {
    const root = new THREE.Group();
    const mat = toon(0x7ef0ff, { emissive: 0x2de2c5, em: 0.45 });
    root.add(mesh(geo.octa, mat, { scale: [0.55, 0.8, 0.55] }));
    return root;
}

export function createHeartPickup() {
    const root = new THREE.Group();
    const mat = toon(0xff2d95, { emissive: 0xff2d95, em: 0.35 });
    root.add(mesh(geo.sphere, mat, { pos: [0.14, 0.08, 0], scale: [0.22, 0.22, 0.18] }));
    root.add(mesh(geo.sphere, mat, { pos: [-0.14, 0.08, 0], scale: [0.22, 0.22, 0.18] }));
    root.add(mesh(geo.cone, mat, { pos: [0, -0.18, 0], rot: [Math.PI, 0, 0], scale: [0.32, 0.4, 0.22] }));
    return root;
}

export function createCheckpoint() {
    const root = new THREE.Group();
    const ring = mesh(geo.torus, toon(0xffd166, { emissive: 0xffd166, em: 0.4 }), {
        scale: [0.95, 0.95, 0.95],
        rot: [Math.PI / 2, 0, 0]
    });
    root.add(ring);
    root.add(mesh(geo.octa, toon(0xff9ad5, { emissive: 0xff2d95, em: 0.5 }), { scale: [0.28, 0.28, 0.28] }));
    root.userData.ring = ring;
    return root;
}

export function createPortal() {
    const root = new THREE.Group();
    const frame = lambert(0xffd166);
    root.add(mesh(geo.torus, toon(0xffd166, { emissive: 0xffd166, em: 0.55 }), {
        scale: [2.1, 2.1, 2.1]
    }));
    root.add(mesh(new THREE.CircleGeometry(1.85, 24),
        new THREE.MeshBasicMaterial({
            color: 0xc45cff,
            transparent: true,
            opacity: 0.55,
            side: THREE.DoubleSide
        }),
        { cast: false, receive: false }));
    root.add(mesh(geo.box, frame, { pos: [0, -2.1, 0], scale: [1.4, 0.35, 1.4] }));
    return root;
}

export function createTree() {
    const root = new THREE.Group();
    root.add(mesh(geo.cyl, lambert(0x5a3218, woodTexture()), { pos: [0, 0.9, 0], scale: [0.22, 1.8, 0.22] }));
    const leaf = lambert(0x2db36a);
    root.add(mesh(geo.sphere, leaf, { pos: [0, 2.1, 0], scale: [1.15, 0.9, 1.15] }));
    root.add(mesh(geo.sphere, lambert(0xff2d95), { pos: [0.5, 2.0, 0.2], scale: [0.35, 0.35, 0.35] }));
    root.add(mesh(geo.sphere, lambert(0xffd166), { pos: [-0.45, 2.2, -0.15], scale: [0.28, 0.28, 0.28] }));
    return root;
}

export function createMushroom() {
    const root = new THREE.Group();
    root.add(mesh(geo.cyl, lambert(0xf0e6d0), { pos: [0, 0.45, 0], scale: [0.22, 0.9, 0.22] }));
    root.add(mesh(geo.sphere, lambert(0xff3b6b), { pos: [0, 1.05, 0], scale: [0.85, 0.45, 0.85] }));
    root.add(mesh(geo.sphere, lambert(0xfff8f0), { pos: [0.28, 1.15, 0.3], scale: [0.14, 0.1, 0.14], cast: false }));
    root.add(mesh(geo.sphere, lambert(0xfff8f0), { pos: [-0.22, 1.22, -0.18], scale: [0.12, 0.08, 0.12], cast: false }));
    return root;
}

export function createCrystalRock() {
    const root = new THREE.Group();
    root.add(mesh(new THREE.OctahedronGeometry(0.8, 0), lambert(0xc45cff, crystalTexture()), {
        scale: [0.7, 1.4, 0.7]
    }));
    root.add(mesh(new THREE.OctahedronGeometry(0.5, 0), lambert(0x7ef0ff, crystalTexture()), {
        pos: [0.45, 0.2, 0.1],
        scale: [0.4, 0.9, 0.4],
        rot: [0.3, 0.4, 0.2]
    }));
    return root;
}

export function createColumn() {
    const root = new THREE.Group();
    const mat = lambert(0xc4a07a, stoneTexture('#8a6a58'));
    root.add(mesh(geo.cyl, mat, { pos: [0, 1.6, 0], scale: [0.32, 3.2, 0.32] }));
    root.add(mesh(geo.box, mat, { pos: [0, 3.3, 0], scale: [0.9, 0.28, 0.9] }));
    root.add(mesh(geo.box, mat, { pos: [0, 0.12, 0], scale: [0.95, 0.24, 0.95] }));
    return root;
}

export function createIsland() {
    const root = new THREE.Group();
    root.add(mesh(new THREE.DodecahedronGeometry(2.4, 0), lambert(0x6a4a78, stoneTexture()), {
        scale: [1.6, 0.55, 1.2]
    }));
    root.add(mesh(geo.cyl, lambert(0x2db36a, grassTexture()), {
        pos: [0, 0.55, 0],
        scale: [2.1, 0.18, 1.55]
    }));
    return root;
}

export function createPlatformMesh(type) {
    const maps = {
        solid: stoneTexture('#7a5a88'),
        float: crystalTexture(),
        gold: stoneTexture('#c4a05a')
    };
    const colors = { solid: 0xc4a8d8, float: 0x9ae0ff, gold: 0xffd166 };
    const mat = lambert(colors[type] || colors.solid, maps[type] || maps.solid);
    const m = new THREE.Mesh(geo.box, mat);
    m.castShadow = true;
    m.receiveShadow = true;
    const trim = new THREE.Mesh(geo.box, lambert(type === 'gold' ? 0xff9ad5 : 0xffd166));
    trim.scale.set(1.02, 0.18, 1.02);
    trim.position.y = 0.42;
    trim.receiveShadow = true;
    m.add(trim);
    return m;
}

export function createSkyDome() {
    const geoDome = new THREE.SphereGeometry(420, 24, 16);
    const col = new Float32Array(geoDome.attributes.position.count * 3);
    const color = new THREE.Color();
    const pos = geoDome.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 420;
        if (y > 0.25) color.setHex(0x2a0a4a);
        else if (y > 0.0) color.setHex(0x8a2a6a);
        else if (y > -0.25) color.setHex(0xff6b4a);
        else color.setHex(0xffc14a);
        col[i * 3] = color.r;
        col[i * 3 + 1] = color.g;
        col[i * 3 + 2] = color.b;
    }
    geoDome.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    return new THREE.Mesh(geoDome, mat);
}

export { toon, lambert, mesh, geo };
