/**
 * Modelos PBR com geometria nativa.
 * Pelagem com sheen, clearcoat seletivo e subdivisões altas —
 * vale hiper-realista sem mudar a jogabilidade.
 */

import * as THREE from 'three';
import { grassTexture, woodTexture, picnicTexture, barnTexture } from './textures.js';
import {
    canineTorsoGeometry, canineHeadGeometry, tailGeometry, earBladeGeometry, limbGeometry,
    headGeometry, profileTube, wingMembrane, createOrganicTree
} from '../../shared/realism.js';

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

const onceGeo = new Map();
function once(key, factory) {
    if (!onceGeo.has(key)) onceGeo.set(key, factory());
    return onceGeo.get(key);
}

/** Cauda com a base no grupo — o balanço gira o grupo, não a malha. */
function fluffyTail(mat, { length = 0.28, r0 = 0.06, r1 = 0.02, fluff = 0.04, pos } = {}) {
    const g = new THREE.Group();
    if (pos) g.position.set(pos[0], pos[1], pos[2]);
    const fur = mesh(tailGeometry({ length, r0, r1, fluff }), mat);
    fur.position.z = -length * 0.5;
    g.add(fur);
    return g;
}

function earPair(parent, parts, mat, { y, spread, height, width, inner = null } = {}) {
    parts.ears = parts.ears || [];
    for (const sx of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(sx * spread, y, -0.02);
        ear.add(mesh(earBladeGeometry({ height, width, thickness: width * 0.28 }), mat, { pos: [0, height * 0.12, 0] }));
        if (inner) {
            ear.add(mesh(
                earBladeGeometry({ height: height * 0.7, width: width * 0.5, thickness: width * 0.14 }),
                inner,
                { pos: [0, height * 0.16, 0.012], cast: false }
            ));
        }
        parent.add(ear);
        parts.ears.push(ear);
    }
}

function addLegs(parent, hipY, spread, length, radius, mat, parts, zSpread = null) {
    const zs = zSpread ?? spread * 0.9;
    const g = limbGeometry({
        length, r0: radius * 1.25, r1: radius * 0.72, bulge: radius * 0.45, bulgeAt: 0.28, pinch: 0.2, seg: 10
    });
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const leg = new THREE.Group();
        leg.position.set(sx * spread, hipY, sz * zs);
        parent.add(leg);
        const m = new THREE.Mesh(g, mat);
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

    const body = mesh(canineTorsoGeometry({ length: 0.85, girth: 0.22, chest: 0.08 }), MAT.fox, { pos: [0, 0.58, 0] });
    root.add(body);
    parts.body = body;
    root.add(mesh(canineTorsoGeometry({ length: 0.42, girth: 0.1, chest: 0.02 }), MAT.white, { pos: [0, 0.42, 0.12], cast: false }));

    addLegs(root, 0.42, 0.2, 0.42, 0.08, MAT.foxDeep, parts, 0.22);

    const head = new THREE.Group();
    head.position.set(0, 0.95, 0.22);
    root.add(head);
    parts.head = head;
    head.add(mesh(canineHeadGeometry({ radius: 0.34, style: 'fox' }), MAT.fox));
    head.add(mesh(geo.sphereLo, MAT.nose, { scale: [0.05, 0.04, 0.05], pos: [0, -0.04, 0.48], cast: false }));
    eyes(head, { y: 0.08, z: 0.28, spread: 0.14, s: 0.95 });
    cheeks(head, -0.04, 0.3, 0.22);

    for (const sx of [-1, 1]) {
        const ear = new THREE.Group();
        ear.position.set(sx * 0.22, 0.28, -0.04);
        ear.rotation.z = sx * -0.35;
        ear.add(mesh(earBladeGeometry({ height: 0.32, width: 0.14, thickness: 0.035 }), MAT.fox, { pos: [0, 0.12, 0] }));
        ear.add(mesh(earBladeGeometry({ height: 0.2, width: 0.08, thickness: 0.02 }), MAT.pink, { pos: [0, 0.1, 0.02], cast: false }));
        head.add(ear);
        parts.ears.push(ear);
    }

    const tail = new THREE.Group();
    tail.position.set(0, 0.55, -0.42);
    root.add(tail);
    parts.tail = tail;
    tail.add(mesh(tailGeometry({ length: 0.62, r0: 0.1, r1: 0.035, fluff: 0.07 }), MAT.foxDeep, { pos: [0, 0.08, -0.28] }));
    tail.add(mesh(geo.sphereLo, MAT.white, { scale: [0.1, 0.1, 0.12], pos: [0, 0.1, -0.58], cast: false }));

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
    const parts = root.userData.parts;
    const body = mesh(canineTorsoGeometry({ length: 0.34, girth: 0.13, chest: 0.04 }), MAT.chick, { pos: [0, 0.3, 0] });
    root.add(body);
    parts.body = body;
    const head = new THREE.Group();
    head.position.set(0, 0.46, 0.16);
    root.add(head);
    parts.head = head;
    head.add(mesh(headGeometry(0.15, 'chibi'), MAT.chick));
    const beak = mesh(limbGeometry({ length: 0.1, r0: 0.038, r1: 0.012, bulge: 0.006, pinch: 0.05, seg: 8 }), MAT.orange, { cast: false });
    beak.rotation.x = -Math.PI / 2;
    beak.position.set(0, -0.02, 0.12);
    head.add(beak);
    head.add(mesh(earBladeGeometry({ height: 0.1, width: 0.045, thickness: 0.018 }), MAT.orange, { pos: [0, 0.12, 0.02], cast: false }));
    eyes(head, { y: 0.02, z: 0.12, spread: 0.07, s: 0.5 });
    const footGeo = limbGeometry({ length: 0.14, r0: 0.028, r1: 0.014, bulge: 0.006, pinch: 0.12, seg: 8 });
    const toeGeo = limbGeometry({ length: 0.07, r0: 0.016, r1: 0.005, bulge: 0, pinch: 0, seg: 6 });
    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.07, 0.18, 0.02);
        const m = new THREE.Mesh(footGeo, MAT.orange);
        m.castShadow = true;
        leg.add(m);
        const toe = new THREE.Mesh(toeGeo, MAT.orange);
        toe.rotation.x = -Math.PI / 2;
        toe.position.set(0, -0.14, 0.01);
        toe.castShadow = false;
        leg.add(toe);
        root.add(leg);
        parts.legs.push(leg);
    }
    return root;
}

export function createDuck() {
    const root = babyRoot();
    const parts = root.userData.parts;
    const body = mesh(canineTorsoGeometry({ length: 0.5, girth: 0.15, chest: 0.05 }), MAT.duck, { pos: [0, 0.32, 0] });
    root.add(body);
    parts.body = body;
    const head = new THREE.Group();
    head.position.set(0, 0.48, 0.26);
    root.add(head);
    parts.head = head;
    head.add(mesh(headGeometry(0.16, 'chibi'), MAT.duck));
    head.add(mesh(once('bill', () => profileTube({
        axis: 'z', length: 0.18, rings: 8, seg: 10, squashY: 0.38,
        radius: (t) => 0.055 * (1 - t * 0.28)
    })), MAT.orange, { pos: [0, -0.02, 0.2], cast: false }));
    eyes(head, { y: 0.03, z: 0.13, spread: 0.08, s: 0.5 });
    addLegs(root, 0.18, 0.1, 0.14, 0.035, MAT.orange, parts, 0.1);
    const wingMat = MAT.orange.clone();
    wingMat.side = THREE.DoubleSide;
    const wingGeo = wingMembrane({ span: 0.26, chord: 0.16 });
    const wingL = mesh(wingGeo, wingMat, { pos: [0.14, 0.36, 0], rot: [-Math.PI / 2, 0, 0], cast: false });
    const wingR = mesh(wingGeo, wingMat, { pos: [-0.14, 0.36, 0], rot: [-Math.PI / 2, 0, 0], cast: false });
    wingR.scale.x = -1;
    root.add(wingL, wingR);
    parts.wings = [wingL, wingR];
    return root;
}

export function createBunny() {
    const root = babyRoot();
    const parts = root.userData.parts;
    const body = mesh(canineTorsoGeometry({ length: 0.46, girth: 0.16, chest: 0.05 }), MAT.bunny, { pos: [0, 0.36, 0] });
    root.add(body);
    parts.body = body;
    const head = new THREE.Group();
    head.position.set(0, 0.58, 0.18);
    root.add(head);
    parts.head = head;
    head.add(mesh(canineHeadGeometry({ radius: 0.2, style: 'fox' }), MAT.bunny));
    eyes(head, { y: 0.03, z: 0.16, spread: 0.09, s: 0.55 });
    cheeks(head, -0.04, 0.14, 0.12);
    head.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.035, 0.028, 0.03], pos: [0, -0.02, 0.2], cast: false }));
    earPair(head, parts, MAT.bunny, { y: 0.14, spread: 0.08, height: 0.32, width: 0.07, inner: MAT.pink });
    addLegs(root, 0.22, 0.12, 0.2, 0.045, MAT.bunny, parts, 0.12);
    const tail = fluffyTail(MAT.white, { length: 0.16, r0: 0.07, r1: 0.04, fluff: 0.05, pos: [0, 0.32, -0.2] });
    root.add(tail);
    parts.tail = tail;
    return root;
}

export function createLamb() {
    const root = babyRoot();
    const parts = root.userData.parts;
    const body = mesh(canineTorsoGeometry({ length: 0.52, girth: 0.18, chest: 0.05 }), MAT.lamb, { pos: [0, 0.46, 0] });
    root.add(body);
    parts.body = body;
    root.add(mesh(canineTorsoGeometry({ length: 0.58, girth: 0.24, chest: 0.04 }), MAT.white, { pos: [0, 0.48, 0], cast: false }));
    const head = new THREE.Group();
    head.position.set(0, 0.58, 0.32);
    root.add(head);
    parts.head = head;
    head.add(mesh(headGeometry(0.16, 'child'), MAT.peach));
    eyes(head, { y: 0.02, z: 0.13, spread: 0.07, s: 0.48 });
    head.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.03, 0.024, 0.028], pos: [0, -0.03, 0.15], cast: false }));
    earPair(head, parts, MAT.peach, { y: 0.08, spread: 0.12, height: 0.12, width: 0.05 });
    addLegs(root, 0.28, 0.14, 0.28, 0.05, MAT.peach, parts, 0.16);
    return root;
}

export function createKitten() {
    const root = babyRoot();
    const parts = root.userData.parts;
    const body = mesh(canineTorsoGeometry({ length: 0.46, girth: 0.13, chest: 0.04 }), MAT.kitten, { pos: [0, 0.32, 0] });
    root.add(body);
    parts.body = body;
    const head = new THREE.Group();
    head.position.set(0, 0.48, 0.22);
    root.add(head);
    parts.head = head;
    head.add(mesh(canineHeadGeometry({ radius: 0.17, style: 'cat' }), MAT.kitten));
    eyes(head, { y: 0.03, z: 0.13, spread: 0.07, s: 0.5 });
    cheeks(head, -0.03, 0.12, 0.1);
    head.add(mesh(geo.sphereLo, MAT.pink, { scale: [0.028, 0.022, 0.024], pos: [0, -0.02, 0.16], cast: false }));
    earPair(head, parts, MAT.kitten, { y: 0.12, spread: 0.1, height: 0.14, width: 0.07, inner: MAT.pink });
    const tail = fluffyTail(MAT.kitten, { length: 0.32, r0: 0.035, r1: 0.016, fluff: 0.02, pos: [0, 0.34, -0.22] });
    root.add(tail);
    parts.tail = tail;
    addLegs(root, 0.2, 0.11, 0.18, 0.035, MAT.kitten, parts, 0.14);
    return root;
}

export function createHedgehog() {
    const root = babyRoot();
    const parts = root.userData.parts;
    const body = mesh(canineTorsoGeometry({ length: 0.42, girth: 0.16, chest: 0.04 }), MAT.hedge, { pos: [0, 0.28, 0] });
    root.add(body);
    parts.body = body;
    const spikeGeo = limbGeometry({ length: 0.13, r0: 0.028, r1: 0.006, bulge: 0.004, pinch: 0, seg: 6, rings: 6 });
    const down = new THREE.Vector3(0, -1, 0);
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const spike = new THREE.Mesh(spikeGeo, MAT.foxDeep);
        spike.castShadow = false;
        const dir = new THREE.Vector3(Math.cos(a) * 0.85, 0.7, Math.sin(a) * 0.75).normalize();
        spike.position.copy(dir).multiplyScalar(0.2).add(new THREE.Vector3(0, 0.32, 0));
        spike.quaternion.setFromUnitVectors(down, dir);
        root.add(spike);
    }
    const head = new THREE.Group();
    head.position.set(0, 0.3, 0.24);
    root.add(head);
    parts.head = head;
    head.add(mesh(canineHeadGeometry({ radius: 0.13, style: 'fox' }), MAT.peach));
    eyes(head, { y: 0.02, z: 0.1, spread: 0.055, s: 0.42 });
    head.add(mesh(geo.sphereLo, MAT.nose, { scale: [0.03, 0.024, 0.028], pos: [0, -0.01, 0.12], cast: false }));
    addLegs(root, 0.16, 0.11, 0.12, 0.03, MAT.peach, parts, 0.1);
    return root;
}

export function createTurtle() {
    const root = babyRoot();
    const parts = root.userData.parts;
    const shellGeo = once('turtle-shell', () => {
        const g = new THREE.LatheGeometry([
            new THREE.Vector2(0.04, -0.02),
            new THREE.Vector2(0.2, 0.02),
            new THREE.Vector2(0.3, 0.1),
            new THREE.Vector2(0.16, 0.2),
            new THREE.Vector2(0.03, 0.24)
        ], 20);
        g.rotateX(Math.PI / 2);
        return g;
    });
    const shell = mesh(shellGeo, MAT.shell, { pos: [0, 0.24, 0] });
    shell.scale.set(1.05, 0.72, 1.15);
    root.add(shell);
    parts.body = shell;
    const belly = once('turtle-belly', () => {
        const g = new THREE.LatheGeometry([
            new THREE.Vector2(0.02, 0),
            new THREE.Vector2(0.16, 0.02),
            new THREE.Vector2(0.12, 0.08),
            new THREE.Vector2(0.02, 0.1)
        ], 14);
        g.rotateX(Math.PI / 2);
        return g;
    });
    root.add(mesh(belly, MAT.turtle, { pos: [0, 0.16, 0], receive: true }));
    const head = new THREE.Group();
    head.position.set(0, 0.24, 0.32);
    root.add(head);
    parts.head = head;
    head.add(mesh(headGeometry(0.1, 'child'), MAT.turtle));
    eyes(head, { y: 0.02, z: 0.08, spread: 0.045, s: 0.4 });
    addLegs(root, 0.14, 0.16, 0.08, 0.04, MAT.turtle, parts, 0.14);
    const tail = fluffyTail(MAT.turtle, { length: 0.12, r0: 0.03, r1: 0.012, fluff: 0.008, pos: [0, 0.16, -0.28] });
    root.add(tail);
    parts.tail = tail;
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
    const g = createOrganicTree({ tint, scale: Math.max(0.7, h / 2.4) });
    g.scale.multiplyScalar(r / 1.15);
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
    g.add(mesh(limbGeometry({ length: 0.32 * s, r0: 0.1 * s, r1: 0.07 * s, bulge: 0.02 * s, pinch: 0.15, seg: 10 }), MAT.stem, { pos: [0, 0.32 * s, 0] }));
    const capGeo = once('mush-cap', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.04, 0),
        new THREE.Vector2(0.28, 0.03),
        new THREE.Vector2(0.34, 0.12),
        new THREE.Vector2(0.16, 0.2),
        new THREE.Vector2(0.03, 0.24)
    ], 16));
    const capMesh = mesh(capGeo, pbr(cap, { roughness: 0.48, clearcoat: 0.25 }), { pos: [0, 0.3 * s, 0] });
    capMesh.scale.setScalar(s);
    g.add(capMesh);
    g.add(mesh(geo.sphereLo, MAT.white, { scale: [0.06 * s, 0.04 * s, 0.06 * s], pos: [0.12 * s, 0.42 * s, 0.08 * s], cast: false }));
    return g;
}

export function createFlower(color = MAT.flowerP) {
    const g = new THREE.Group();
    const petal = once('flower-petal', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.008, 0),
        new THREE.Vector2(0.04, 0.03),
        new THREE.Vector2(0.07, 0.09),
        new THREE.Vector2(0.028, 0.15),
        new THREE.Vector2(0.006, 0.19)
    ], 8));
    const heart = once('flower-heart', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(0.055, 0.02),
        new THREE.Vector2(0.04, 0.07),
        new THREE.Vector2(0.012, 0.1)
    ], 10));
    g.add(mesh(geo.cylLo, MAT.leaf, { scale: [0.025, 0.28, 0.025], pos: [0, 0.14, 0], cast: false }));
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.add(mesh(petal, color, {
            pos: [Math.cos(a) * 0.07, 0.26, Math.sin(a) * 0.07],
            rot: [0.55, a, 0],
            cast: false
        }));
    }
    g.add(mesh(heart, MAT.gold, { pos: [0, 0.3, 0], cast: false }));
    return g;
}

export function createCloud() {
    const g = new THREE.Group();
    const puff = once('cloud-puff', () => {
        const blob = new THREE.SphereGeometry(1, 18, 14);
        const pos = blob.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const n = 0.8 + Math.abs(Math.sin(x * 3.1 + y * 2.4) * Math.cos(z * 2.7)) * 0.3;
            pos.setXYZ(i, x * n, y * (0.7 + n * 0.22), z * n);
        }
        blob.computeVertexNormals();
        return blob;
    });
    g.add(mesh(puff, MAT.cloud, { scale: [1.4, 0.85, 1.1], pos: [0, 0, 0], cast: false, receive: false }));
    g.add(mesh(puff, MAT.cloud, { scale: [0.9, 0.7, 0.8], pos: [0.9, 0.15, 0.1], cast: false, receive: false }));
    g.add(mesh(puff, MAT.cloud, { scale: [0.7, 0.55, 0.65], pos: [-0.85, 0.1, -0.15], cast: false, receive: false }));
    return g;
}

/** Celeiro 5.2×3.4×4.2, centrado. Fiadas, cunhal e o vão da porta na face +Z. */
function barnWallGeometry() {
    const g = new THREE.BoxGeometry(5.2, 3.4, 4.2, 10, 14, 8);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const onX = Math.abs(x) > 2.45;
        const onZ = Math.abs(z) > 1.95;
        const t = (y + 1.7) / 3.4;
        if (onX || onZ) {
            const course = Math.sin((y + 1.7) * Math.PI * 5);
            const lip = course > 0.62 ? 0.07 : 0;
            const quoin = onX && onZ ? 0.12 : 0;
            const batter = (1 - t) * 0.05;
            if (onX) x = Math.sign(x) * (2.6 + batter + lip + quoin);
            if (onZ) z = Math.sign(z) * (2.1 + batter + lip + quoin);
        }
        if (z > 1.85 && Math.abs(x) < 0.8 && y < 0.5) z -= 0.16;
        if (z > 1.85 && Math.abs(x - 1.4) < 0.42 && Math.abs(y - 0.7) < 0.42) z -= 0.1;
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

const BARN_WALL = barnWallGeometry();

export function createBarn() {
    const g = new THREE.Group();
    const wall = mesh(BARN_WALL, MAT.barn, { pos: [0, 1.7, 0] });
    wall.name = 'barnWall';
    g.add(wall);
    const barnRoof = once('barn-roof', () => {
        const shape = new THREE.Shape();
        shape.moveTo(-2.4, 0);
        shape.lineTo(0, 1.15);
        shape.lineTo(2.4, 0);
        const gable = new THREE.ExtrudeGeometry(shape, {
            depth: 4.6,
            bevelEnabled: true,
            bevelThickness: 0.06,
            bevelSize: 0.08,
            bevelSegments: 1
        });
        gable.translate(0, 0, -2.3);
        gable.computeVertexNormals();
        return gable;
    });
    g.add(mesh(barnRoof, MAT.roof, { pos: [0, 3.4, 0] }));
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
    const wingGeo = wingMembrane({ span: 0.22, chord: 0.14 });
    const l = mesh(wingGeo, wingMat, { pos: [0.02, 0.02, 0], cast: false });
    l.scale.y = -1;
    const r = mesh(wingGeo, wingMat, { pos: [-0.02, 0.02, 0], cast: false });
    r.scale.set(-1, -1, 1);
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
