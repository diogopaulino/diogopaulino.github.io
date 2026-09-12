/**
 * Modelos PBR com geometria nativa.
 * Pelagem com sheen, clearcoat seletivo e subdivisões altas —
 * vale hiper-realista sem mudar a jogabilidade.
 */

import * as THREE from 'three';
import { grassTexture, woodTexture, picnicTexture, barnTexture } from './textures.js';

export const geo = {
    sphere: new THREE.SphereGeometry(1, 32, 24),
    sphereLo: new THREE.SphereGeometry(1, 20, 16),
    sphereHi: new THREE.SphereGeometry(1, 40, 28),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 24),
    cylLo: new THREE.CylinderGeometry(1, 1, 1, 14),
    cone: new THREE.ConeGeometry(1, 1, 20),
    coneLo: new THREE.ConeGeometry(1, 1, 12),
    torus: new THREE.TorusGeometry(1, 0.18, 14, 36),
    plane: new THREE.PlaneGeometry(1, 1)
};

/**
 * MeshPhysical com variação de roughness tipo pelagem.
 * `fur` ativa sheen + micro-variação procedural no fragment.
 */
export function pbr(color, {
    emissive = 0x000000,
    em = 0,
    map = null,
    transparent = false,
    opacity = 1,
    side = THREE.FrontSide,
    roughness = 0.62,
    metalness = 0.04,
    fur = false,
    sheen = 0,
    sheenColor = null,
    sheenRoughness = 0.42,
    clearcoat = 0,
    clearcoatRoughness = 0.35,
    transmission = 0,
    thickness = 0,
    ior = 1.5
} = {}) {
    const mat = new THREE.MeshPhysicalMaterial({
        color,
        map,
        emissive,
        emissiveIntensity: em,
        transparent,
        opacity,
        side,
        roughness,
        metalness,
        sheen: fur ? Math.max(sheen, 0.85) : sheen,
        sheenColor: sheenColor
            ?? (fur
                ? new THREE.Color(color).lerp(new THREE.Color(0xfff4e8), 0.42)
                : new THREE.Color(0xffffff)),
        sheenRoughness: fur ? sheenRoughness : sheenRoughness,
        clearcoat,
        clearcoatRoughness,
        transmission,
        thickness,
        ior,
        envMapIntensity: fur ? 0.55 : 0.7
    });

    if (fur) {
        // Micro-variação de roughness — fiapos sem textura externa.
        mat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                /* glsl */ `#include <roughnessmap_fragment>
                float furN = fract(sin(dot(vViewPosition.xy * 37.1, vec2(12.9898, 78.233))) * 43758.5453);
                roughnessFactor = clamp(roughnessFactor + (furN - 0.5) * 0.22, 0.08, 1.0);`
            );
        };
        mat.customProgramCacheKey = () => 'nina-fur-v1';
    }
    return mat;
}

/** @deprecated use pbr — mantido para imports legados */
export const toon = pbr;

export function mesh(geometry, material, { pos, scale, rot, cast = true, receive = true } = {}) {
    const m = new THREE.Mesh(geometry, material);
    if (pos) m.position.set(...pos);
    if (scale) m.scale.set(...scale);
    if (rot) m.rotation.set(...rot);
    m.castShadow = cast;
    m.receiveShadow = receive;
    return m;
}

export const MAT = {
    cream: pbr(0xfff6e8, { roughness: 0.78, sheen: 0.25 }),
    peach: pbr(0xffb07a, { roughness: 0.55, clearcoat: 0.12 }),
    berry: pbr(0xe85a9b, { emissive: 0xc2185b, em: 0.18, roughness: 0.35, clearcoat: 0.55, clearcoatRoughness: 0.2 }),
    berryGlow: pbr(0xff6eb4, { emissive: 0xff4d9a, em: 0.85, roughness: 0.28, clearcoat: 0.7, clearcoatRoughness: 0.12 }),
    fox: pbr(0xff8a3c, { fur: true, roughness: 0.72, sheenRoughness: 0.38 }),
    foxDeep: pbr(0xe06a28, { fur: true, roughness: 0.78, sheenRoughness: 0.45 }),
    white: pbr(0xfffaf4, { fur: true, roughness: 0.68, sheenRoughness: 0.32 }),
    ink: pbr(0x2a1840, { roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.25 }),
    pink: pbr(0xff9bb8, { roughness: 0.55, sheen: 0.35 }),
    nose: pbr(0x3a2048, { roughness: 0.28, clearcoat: 0.65, clearcoatRoughness: 0.18 }),
    grass: pbr(0x6fd15a, { map: grassTexture(), roughness: 0.88, sheen: 0.2, sheenColor: 0xb8f070 }),
    dirt: pbr(0xe0a070, { roughness: 0.94 }),
    wood: pbr(0xc47a48, { map: woodTexture(), roughness: 0.82 }),
    leaf: pbr(0x4ecf6a, { roughness: 0.58, sheen: 0.35, sheenColor: 0xa8f080, clearcoat: 0.08 }),
    leafMint: pbr(0x7ae08a, { roughness: 0.55, sheen: 0.4, sheenColor: 0xc8f0a0 }),
    leafDark: pbr(0x2db86a, { roughness: 0.62, sheen: 0.3 }),
    apple: pbr(0xff5b6a, { emissive: 0xff3b4a, em: 0.12, roughness: 0.38, clearcoat: 0.75, clearcoatRoughness: 0.15 }),
    gold: pbr(0xffd166, { emissive: 0xff9f43, em: 0.22, roughness: 0.32, metalness: 0.35, clearcoat: 0.4 }),
    barn: pbr(0xe85a5a, { map: barnTexture(), roughness: 0.86 }),
    roof: pbr(0x7a3a2a, { roughness: 0.9 }),
    picnic: pbr(0xffffff, { map: picnicTexture(), roughness: 0.8, sheen: 0.3 }),
    water: pbr(0x4ecdc4, {
        transparent: true,
        opacity: 0.72,
        roughness: 0.08,
        metalness: 0.12,
        transmission: 0.55,
        thickness: 1.4,
        ior: 1.33,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08
    }),
    cloud: pbr(0xfff7f0, { roughness: 1, sheen: 0.15, transparent: true, opacity: 0.92 }),
    mushroom: pbr(0xff6b7a, { roughness: 0.48, clearcoat: 0.25 }),
    stem: pbr(0xfff3d0, { roughness: 0.7 }),
    chick: pbr(0xffe066, { fur: true, roughness: 0.7, sheenRoughness: 0.4 }),
    duck: pbr(0xffc04a, { roughness: 0.42, clearcoat: 0.2, sheen: 0.25 }),
    orange: pbr(0xff9f43, { roughness: 0.45, clearcoat: 0.15 }),
    bunny: pbr(0xf2d4e8, { fur: true, roughness: 0.7, sheenRoughness: 0.36 }),
    lamb: pbr(0xf7f1e6, { fur: true, roughness: 0.88, sheen: 1, sheenRoughness: 0.55 }),
    kitten: pbr(0xf4c478, { fur: true, roughness: 0.68, sheenRoughness: 0.34 }),
    hedge: pbr(0xc4a070, { roughness: 0.9 }),
    turtle: pbr(0x6fd18a, { roughness: 0.48, clearcoat: 0.22 }),
    shell: pbr(0x3eaa72, { roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.28 }),
    flowerP: pbr(0xff7ab0, { roughness: 0.5, sheen: 0.45 }),
    flowerY: pbr(0xffe066, { roughness: 0.48, sheen: 0.4 }),
    flowerL: pbr(0xc9a0ff, { roughness: 0.5, sheen: 0.45 }),
    flowerO: pbr(0xff9f43, { roughness: 0.5, sheen: 0.4 })
};

function eyes(root, { y = 0.28, z = 0.42, spread = 0.16, s = 1 } = {}) {
    const eyeW = pbr(0xfffaf4, { roughness: 0.12, clearcoat: 0.95, clearcoatRoughness: 0.06 });
    const spark = pbr(0xffffff, { emissive: 0xffffff, em: 0.55, roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.04 });
    root.add(mesh(geo.sphere, eyeW, { scale: [0.14 * s, 0.18 * s, 0.08 * s], pos: [spread, y, z], cast: false }));
    root.add(mesh(geo.sphere, eyeW, { scale: [0.14 * s, 0.18 * s, 0.08 * s], pos: [-spread, y, z], cast: false }));
    root.add(mesh(geo.sphere, MAT.ink, { scale: [0.07 * s, 0.09 * s, 0.05 * s], pos: [spread, y - 0.02, z + 0.07], cast: false }));
    root.add(mesh(geo.sphere, MAT.ink, { scale: [0.07 * s, 0.09 * s, 0.05 * s], pos: [-spread, y - 0.02, z + 0.07], cast: false }));
    root.add(mesh(geo.sphereLo, spark, { scale: [0.03 * s, 0.035 * s, 0.018 * s], pos: [spread + 0.03, y + 0.04, z + 0.1], cast: false }));
    root.add(mesh(geo.sphereLo, spark, { scale: [0.03 * s, 0.035 * s, 0.018 * s], pos: [-spread + 0.03, y + 0.04, z + 0.1], cast: false }));
}

function cheeks(root, y, z, spread) {
    root.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.08, 0.055, 0.05], pos: [spread, y, z], cast: false }));
    root.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.08, 0.055, 0.05], pos: [-spread, y, z], cast: false }));
}

function addLegs(parent, hipY, spread, length, radius, mat, parts, zSpread = null) {
    const zs = zSpread ?? spread * 0.9;
    const g = new THREE.CylinderGeometry(radius * 0.85, radius, length, 12);
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const leg = new THREE.Group();
        leg.position.set(sx * spread, hipY, sz * zs);
        parent.add(leg);
        const m = new THREE.Mesh(g, mat);
        m.position.y = -length * 0.5;
        m.castShadow = true;
        leg.add(m);
        parts.legs.push(leg);
    }
}

/** Raposinha Nina — jogadora, orelhas grandes e rabo fofo. */
export function createFox() {
    const root = new THREE.Group();
    root.name = 'nina';
    const parts = { legs: [], tail: null, head: null, body: null, ears: [] };

    const body = mesh(geo.sphereHi, MAT.fox, { scale: [0.42, 0.38, 0.55], pos: [0, 0.55, 0] });
    root.add(body);
    parts.body = body;
    root.add(mesh(geo.sphereLo, MAT.white, { scale: [0.28, 0.22, 0.32], pos: [0, 0.42, 0.12], cast: false }));

    addLegs(root, 0.42, 0.2, 0.42, 0.08, MAT.foxDeep, parts, 0.22);

    const head = new THREE.Group();
    head.position.set(0, 0.95, 0.22);
    root.add(head);
    parts.head = head;
    head.add(mesh(geo.sphereHi, MAT.fox, { scale: [0.38, 0.36, 0.36], pos: [0, 0, 0] }));
    head.add(mesh(geo.sphere, MAT.white, { scale: [0.22, 0.16, 0.28], pos: [0, -0.08, 0.18], cast: false }));
    head.add(mesh(geo.sphereLo, MAT.nose, { scale: [0.06, 0.05, 0.05], pos: [0, -0.06, 0.42], cast: false }));
    eyes(head, { y: 0.08, z: 0.28, spread: 0.14, s: 0.95 });
    cheeks(head, -0.04, 0.3, 0.22);

    for (const sx of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(sx * 0.22, 0.28, -0.04);
        ear.rotation.z = sx * -0.35;
        ear.add(mesh(geo.cone, MAT.fox, { scale: [0.14, 0.32, 0.1], pos: [0, 0.12, 0] }));
        ear.add(mesh(geo.cone, MAT.pink, { scale: [0.08, 0.2, 0.04], pos: [0, 0.08, 0.04], cast: false }));
        head.add(ear);
        parts.ears.push(ear);
    }

    const tail = new THREE.Group();
    tail.position.set(0, 0.55, -0.42);
    root.add(tail);
    parts.tail = tail;
    tail.add(mesh(geo.sphere, MAT.foxDeep, { scale: [0.16, 0.16, 0.38], pos: [0, 0.08, -0.22] }));
    tail.add(mesh(geo.sphereLo, MAT.white, { scale: [0.12, 0.12, 0.16], pos: [0, 0.1, -0.52], cast: false }));

    root.userData.parts = parts;
    return root;
}

function babyRoot() {
    const root = new THREE.Group();
    root.userData.parts = { legs: [], tail: null, head: null, body: null };
    return root;
}

export function createChick() {
    const root = babyRoot();
    const body = mesh(geo.sphere, MAT.chick, { scale: [0.28, 0.26, 0.3], pos: [0, 0.32, 0] });
    root.add(body);
    root.userData.parts.body = body;
    const head = new THREE.Group();
    head.position.set(0, 0.52, 0.12);
    root.add(head);
    root.userData.parts.head = head;
    head.add(mesh(geo.sphere, MAT.chick, { scale: [0.2, 0.2, 0.2] }));
    head.add(mesh(geo.cone, MAT.orange, { scale: [0.06, 0.12, 0.06], pos: [0, -0.02, 0.2], rot: [1.2, 0, 0], cast: false }));
    head.add(mesh(geo.coneLo, MAT.orange, { scale: [0.05, 0.1, 0.05], pos: [0, 0.2, 0], cast: false }));
    eyes(head, { y: 0.02, z: 0.16, spread: 0.08, s: 0.7 });
    const footGeo = new THREE.CylinderGeometry(0.03, 0.035, 0.16, 10);
    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.08, 0.16, 0.02);
        const m = new THREE.Mesh(footGeo, MAT.orange);
        m.position.y = -0.08;
        m.castShadow = true;
        leg.add(m);
        root.add(leg);
        root.userData.parts.legs.push(leg);
    }
    return root;
}

export function createDuck() {
    const root = babyRoot();
    const body = mesh(geo.sphere, MAT.duck, { scale: [0.32, 0.24, 0.4], pos: [0, 0.32, 0] });
    root.add(body);
    root.userData.parts.body = body;
    const head = new THREE.Group();
    head.position.set(0, 0.5, 0.28);
    root.add(head);
    root.userData.parts.head = head;
    head.add(mesh(geo.sphere, MAT.duck, { scale: [0.2, 0.2, 0.2] }));
    head.add(mesh(geo.box, MAT.orange, { scale: [0.16, 0.05, 0.18], pos: [0, -0.04, 0.2], cast: false }));
    eyes(head, { y: 0.04, z: 0.16, spread: 0.09, s: 0.72 });
    addLegs(root, 0.18, 0.1, 0.16, 0.04, MAT.orange, root.userData.parts, 0.1);
    const wingL = mesh(geo.sphereLo, MAT.orange, { scale: [0.06, 0.1, 0.16], pos: [0.28, 0.32, 0] });
    const wingR = mesh(geo.sphereLo, MAT.orange, { scale: [0.06, 0.1, 0.16], pos: [-0.28, 0.32, 0] });
    root.add(wingL, wingR);
    root.userData.parts.wings = [wingL, wingR];
    return root;
}

export function createBunny() {
    const root = babyRoot();
    const body = mesh(geo.sphere, MAT.bunny, { scale: [0.3, 0.28, 0.34], pos: [0, 0.34, 0] });
    root.add(body);
    root.userData.parts.body = body;
    const head = new THREE.Group();
    head.position.set(0, 0.62, 0.12);
    root.add(head);
    root.userData.parts.head = head;
    head.add(mesh(geo.sphere, MAT.bunny, { scale: [0.24, 0.22, 0.22] }));
    eyes(head, { y: 0.02, z: 0.18, spread: 0.1, s: 0.78 });
    cheeks(head, -0.06, 0.16, 0.16);
    head.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.04, 0.03, 0.03], pos: [0, -0.04, 0.22], cast: false }));
    for (const sx of [-1, 1]) {
        const ear = mesh(geo.sphere, MAT.bunny, { scale: [0.07, 0.28, 0.06], pos: [sx * 0.1, 0.32, -0.04] });
        ear.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.5, 0.7, 0.4], pos: [0, 0.05, 0.4], cast: false }));
        head.add(ear);
        root.userData.parts.ears = root.userData.parts.ears || [];
        root.userData.parts.ears.push(ear);
    }
    addLegs(root, 0.22, 0.12, 0.2, 0.05, MAT.bunny, root.userData.parts, 0.12);
    const tail = mesh(geo.sphereLo, MAT.white, { scale: [0.1, 0.1, 0.1], pos: [0, 0.28, -0.32] });
    root.add(tail);
    root.userData.parts.tail = tail;
    return root;
}

export function createLamb() {
    const root = babyRoot();
    const body = mesh(geo.sphere, MAT.lamb, { scale: [0.38, 0.34, 0.48], pos: [0, 0.48, 0] });
    root.add(body);
    root.userData.parts.body = body;
    root.add(mesh(geo.sphereLo, MAT.white, { scale: [0.42, 0.36, 0.5], pos: [0, 0.5, 0], cast: false }));
    const head = new THREE.Group();
    head.position.set(0, 0.62, 0.4);
    root.add(head);
    root.userData.parts.head = head;
    head.add(mesh(geo.sphere, MAT.peach, { scale: [0.18, 0.18, 0.2] }));
    eyes(head, { y: 0.02, z: 0.16, spread: 0.09, s: 0.7 });
    head.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.04, 0.03, 0.04], pos: [0, -0.04, 0.2], cast: false }));
    for (const sx of [-1, 1]) {
        head.add(mesh(geo.cylLo, MAT.peach, { scale: [0.03, 0.08, 0.03], pos: [sx * 0.12, 0.16, -0.02], cast: false }));
    }
    addLegs(root, 0.32, 0.16, 0.32, 0.055, MAT.peach, root.userData.parts, 0.18);
    return root;
}

export function createKitten() {
    const root = babyRoot();
    const body = mesh(geo.sphere, MAT.kitten, { scale: [0.28, 0.24, 0.4], pos: [0, 0.32, 0] });
    root.add(body);
    root.userData.parts.body = body;
    const head = new THREE.Group();
    head.position.set(0, 0.52, 0.22);
    root.add(head);
    root.userData.parts.head = head;
    head.add(mesh(geo.sphere, MAT.kitten, { scale: [0.22, 0.2, 0.2] }));
    eyes(head, { y: 0.02, z: 0.16, spread: 0.09, s: 0.72 });
    cheeks(head, -0.05, 0.14, 0.14);
    head.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.035, 0.03, 0.03], pos: [0, -0.04, 0.2], cast: false }));
    for (const sx of [-1, 1]) {
        const ear = mesh(geo.cone, MAT.kitten, { scale: [0.08, 0.16, 0.06], pos: [sx * 0.14, 0.18, -0.02], rot: [0, 0, sx * -0.25] });
        head.add(ear);
    }
    const tail = new THREE.Group();
    tail.position.set(0, 0.34, -0.38);
    tail.add(mesh(geo.cylLo, MAT.kitten, { scale: [0.04, 0.36, 0.04], pos: [0, 0.1, -0.08], rot: [0.8, 0, 0] }));
    root.add(tail);
    root.userData.parts.tail = tail;
    addLegs(root, 0.22, 0.12, 0.2, 0.04, MAT.kitten, root.userData.parts, 0.16);
    return root;
}

export function createHedgehog() {
    const root = babyRoot();
    const body = mesh(geo.sphere, MAT.hedge, { scale: [0.34, 0.26, 0.38], pos: [0, 0.28, 0] });
    root.add(body);
    root.userData.parts.body = body;
    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const spike = mesh(geo.coneLo, MAT.foxDeep, {
            scale: [0.05, 0.16, 0.05],
            pos: [Math.cos(a) * 0.22, 0.4, Math.sin(a) * 0.22],
            rot: [0.4, a, 0],
            cast: false
        });
        root.add(spike);
    }
    const head = new THREE.Group();
    head.position.set(0, 0.28, 0.28);
    root.add(head);
    root.userData.parts.head = head;
    head.add(mesh(geo.sphere, MAT.peach, { scale: [0.16, 0.14, 0.2] }));
    eyes(head, { y: 0.02, z: 0.14, spread: 0.07, s: 0.6 });
    head.add(mesh(geo.sphereLo, MAT.nose, { scale: [0.04, 0.035, 0.04], pos: [0, -0.02, 0.2], cast: false }));
    addLegs(root, 0.16, 0.12, 0.14, 0.035, MAT.peach, root.userData.parts, 0.12);
    return root;
}

export function createTurtle() {
    const root = babyRoot();
    const shell = mesh(geo.sphere, MAT.shell, { scale: [0.36, 0.18, 0.4], pos: [0, 0.28, 0] });
    root.add(shell);
    root.userData.parts.body = shell;
    root.add(mesh(geo.sphereLo, MAT.turtle, { scale: [0.22, 0.08, 0.26], pos: [0, 0.18, 0], receive: true }));
    const head = new THREE.Group();
    head.position.set(0, 0.28, 0.38);
    root.add(head);
    root.userData.parts.head = head;
    head.add(mesh(geo.sphere, MAT.turtle, { scale: [0.12, 0.1, 0.16] }));
    eyes(head, { y: 0.02, z: 0.12, spread: 0.07, s: 0.55 });
    addLegs(root, 0.14, 0.18, 0.08, 0.05, MAT.turtle, root.userData.parts, 0.16);
    const tail = mesh(geo.coneLo, MAT.turtle, { scale: [0.05, 0.12, 0.05], pos: [0, 0.16, -0.38], rot: [1.2, 0, 0], cast: false });
    root.add(tail);
    root.userData.parts.tail = tail;
    return root;
}

export const BABY_BUILDERS = {
    chick: createChick,
    duck: createDuck,
    bunny: createBunny,
    lamb: createLamb,
    kitten: createKitten,
    hedge: createHedgehog,
    turtle: createTurtle
};

export function createBerry({ light = false } = {}) {
    const g = new THREE.Group();
    g.add(mesh(geo.sphere, MAT.berryGlow, { scale: [0.16, 0.16, 0.16], pos: [0, 0.16, 0] }));
    g.add(mesh(geo.sphereLo, MAT.leafMint, { scale: [0.08, 0.04, 0.08], pos: [0, 0.3, 0], cast: false }));
    if (light) {
        const glow = new THREE.PointLight(0xff6eb4, 0.55, 3.2, 2);
        glow.position.y = 0.2;
        g.add(glow);
    }
    return g;
}

export function createTree({ h = 2.4, r = 1.15, fruit = true, tint = 0x4ecf6a } = {}) {
    const g = new THREE.Group();
    g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.16, h, 0.16], pos: [0, h / 2, 0] }));
    g.add(mesh(geo.sphereHi, pbr(tint, { roughness: 0.58, sheen: 0.35, sheenColor: 0xa8f080 }), { scale: [r, r * 0.9, r], pos: [0, h + r * 0.35, 0] }));
    g.add(mesh(geo.sphereLo, MAT.leafMint, { scale: [r * 0.7, r * 0.55, r * 0.7], pos: [r * 0.35, h + r * 0.15, r * 0.2], cast: false }));
    if (fruit) {
        for (let i = 0; i < 4; i++) {
            const a = i * 1.7;
            g.add(mesh(geo.sphereLo, MAT.apple, {
                scale: [0.1, 0.1, 0.1],
                pos: [Math.cos(a) * r * 0.55, h + 0.2 + (i % 2) * 0.35, Math.sin(a) * r * 0.55]
            }));
        }
    }
    return g;
}

export function createMushroom({ s = 1, cap = 0xff6b7a } = {}) {
    const g = new THREE.Group();
    g.add(mesh(geo.cylLo, MAT.stem, { scale: [0.12 * s, 0.32 * s, 0.12 * s], pos: [0, 0.16 * s, 0] }));
    g.add(mesh(geo.sphere, pbr(cap, { roughness: 0.48, clearcoat: 0.25 }), { scale: [0.32 * s, 0.16 * s, 0.32 * s], pos: [0, 0.36 * s, 0] }));
    g.add(mesh(geo.sphereLo, MAT.white, { scale: [0.06 * s, 0.04 * s, 0.06 * s], pos: [0.12 * s, 0.42 * s, 0.08 * s], cast: false }));
    return g;
}

export function createFlower(color = MAT.flowerP) {
    const g = new THREE.Group();
    g.add(mesh(geo.cylLo, MAT.leaf, { scale: [0.025, 0.28, 0.025], pos: [0, 0.14, 0], cast: false }));
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mesh(geo.sphereLo, color, {
            scale: [0.08, 0.05, 0.08],
            pos: [Math.cos(a) * 0.1, 0.3, Math.sin(a) * 0.1],
            cast: false
        }));
    }
    g.add(mesh(geo.sphereLo, MAT.gold, { scale: [0.06, 0.05, 0.06], pos: [0, 0.32, 0], cast: false }));
    return g;
}

export function createCloud() {
    const g = new THREE.Group();
    g.add(mesh(geo.sphereLo, MAT.cloud, { scale: [1.4, 0.85, 1.1], pos: [0, 0, 0], cast: false, receive: false }));
    g.add(mesh(geo.sphereLo, MAT.cloud, { scale: [0.9, 0.7, 0.8], pos: [0.9, 0.15, 0.1], cast: false, receive: false }));
    g.add(mesh(geo.sphereLo, MAT.cloud, { scale: [0.7, 0.55, 0.65], pos: [-0.85, 0.1, -0.15], cast: false, receive: false }));
    return g;
}

export function createBarn() {
    const g = new THREE.Group();
    g.add(mesh(geo.box, MAT.barn, { scale: [5.2, 3.4, 4.2], pos: [0, 1.7, 0] }));
    g.add(mesh(geo.cone, MAT.roof, { scale: [4.4, 2.2, 4.4], pos: [0, 4.5, 0] }));
    g.add(mesh(geo.box, MAT.ink, { scale: [1.4, 2.1, 0.12], pos: [0, 1.05, 2.12], cast: false }));
    g.add(mesh(geo.box, MAT.gold, { scale: [0.7, 0.7, 0.08], pos: [1.4, 2.4, 2.12], cast: false }));
    g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.12, 2.4, 0.12], pos: [3.1, 1.2, 2.4] }));
    g.add(mesh(geo.box, pbr(0xfff0e0, { map: picnicTexture(), roughness: 0.78 }), {
        scale: [1.1, 0.7, 0.04],
        pos: [3.55, 2.0, 2.4],
        cast: false
    }));
    return g;
}

export function createPicnic() {
    const g = new THREE.Group();
    const cloth = mesh(geo.plane, MAT.picnic, {
        scale: [4.6, 4.6, 1],
        rot: [-Math.PI / 2, 0, 0.2],
        pos: [0, 0.04, 0],
        cast: false
    });
    g.add(cloth);
    g.add(mesh(geo.cylLo, MAT.cream, { scale: [0.55, 0.08, 0.55], pos: [0.4, 0.12, 0.2], cast: false }));
    g.add(mesh(geo.sphereLo, MAT.apple, { scale: [0.14, 0.14, 0.14], pos: [-0.6, 0.18, 0.4] }));
    g.add(mesh(geo.sphereLo, MAT.berry, { scale: [0.1, 0.1, 0.1], pos: [-0.35, 0.16, 0.55] }));
    g.add(mesh(geo.sphereLo, MAT.gold, { scale: [0.12, 0.12, 0.12], pos: [0.7, 0.16, -0.3] }));
    const nest = mesh(geo.torus, MAT.wood, { scale: [1.15, 0.7, 1.15], pos: [0, 0.12, 0], rot: [Math.PI / 2, 0, 0], cast: false });
    g.add(nest);
    g.userData.cloth = cloth;
    return g;
}

export function createRainbow() {
    const g = new THREE.TorusGeometry(11, 0.22, 8, 48, Math.PI);
    const colors = [0xff5b7a, 0xff9f43, 0xffe066, 0x6fd15a, 0x5b7cfa, 0xc9a0ff];
    const group = new THREE.Group();
    colors.forEach((c, i) => {
        const ring = new THREE.Mesh(g, pbr(c, { emissive: c, em: 0.2, transparent: true, opacity: 0.78, roughness: 0.35 }));
        ring.scale.set(1 + i * 0.032, 1 + i * 0.032, 1);
        ring.castShadow = false;
        ring.receiveShadow = false;
        group.add(ring);
    });
    group.rotation.z = Math.PI;
    group.rotation.y = 0.55;
    return group;
}

export function createFence(len = 6) {
    const g = new THREE.Group();
    const n = Math.max(2, Math.round(len));
    for (let i = 0; i < n; i++) {
        g.add(mesh(geo.cylLo, MAT.wood, { scale: [0.07, 0.7, 0.07], pos: [i * 0.7 - len * 0.35, 0.35, 0] }));
    }
    g.add(mesh(geo.box, MAT.wood, { scale: [len * 0.7, 0.08, 0.06], pos: [0, 0.48, 0] }));
    g.add(mesh(geo.box, MAT.wood, { scale: [len * 0.7, 0.08, 0.06], pos: [0, 0.22, 0] }));
    return g;
}

export function createButterfly(color = 0xff7ab0) {
    const g = new THREE.Group();
    g.add(mesh(geo.cylLo, MAT.ink, { scale: [0.02, 0.16, 0.02], pos: [0, 0, 0], rot: [Math.PI / 2, 0, 0], cast: false }));
    const wingMat = pbr(color, {
        emissive: color,
        em: 0.15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.92,
        roughness: 0.35,
        sheen: 0.55,
        transmission: 0.15,
        thickness: 0.2
    });
    const l = mesh(geo.sphereLo, wingMat, { scale: [0.18, 0.02, 0.12], pos: [0.12, 0, 0], cast: false });
    const r = mesh(geo.sphereLo, wingMat, { scale: [0.18, 0.02, 0.12], pos: [-0.12, 0, 0], cast: false });
    g.add(l, r);
    g.userData.wings = [l, r];
    return g;
}

export function createHeart() {
    const g = new THREE.Group();
    const mat = pbr(0xff6b9a, { emissive: 0xff4d80, em: 0.7, transparent: true, opacity: 0.95, roughness: 0.3, clearcoat: 0.4 });
    g.add(mesh(geo.sphereLo, mat, { scale: [0.12, 0.12, 0.1], pos: [0.07, 0.04, 0], cast: false }));
    g.add(mesh(geo.sphereLo, mat, { scale: [0.12, 0.12, 0.1], pos: [-0.07, 0.04, 0], cast: false }));
    g.add(mesh(geo.cone, mat, { scale: [0.16, 0.2, 0.1], pos: [0, -0.08, 0], rot: [Math.PI, 0, 0], cast: false }));
    return g;
}
