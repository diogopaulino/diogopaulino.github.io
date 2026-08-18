/**
 * Modelos do conto: cápsulas, tubos e lathe + PBR fotográfico.
 * Nenhum GLB externo. Cache de material nunca serializa Texture (ciclo no engine).
 */

import { hexToColor3 } from './sky.js';
import {
    surface, thatchTexture, goldTexture, cloudTexture, clothTexture,
    leafTexture, skinTexture, cowHideTexture, bladeTexture, setTextureQuality
} from './textures.js';

const B = window.BABYLON;
const matCache = new Map();

let tess = 12;

export function setModelQuality(id) {
    tess = id === 'low' ? 6 : id === 'medium' ? 10 : 14;
    setTextureQuality(id);
}

export function clearMaterialCache() {
    matCache.clear();
}

function extraKey(extra) {
    return [
        extra.map?.name || extra.mapKey || '',
        extra.bump?.name || '',
        extra.roughnessMap?.name || '',
        extra.emissive ?? '',
        extra.emissiveIntensity ?? '',
        extra.alpha ?? '',
        extra.alphaTest ? 1 : 0,
        extra.doubleSided ? 1 : 0,
        extra.bumpLevel ?? ''
    ].join(':');
}

function mat(scene, key, factory) {
    const fullKey = `${scene?.uid || 'default'}:${key}`;
    if (!matCache.has(fullKey)) matCache.set(fullKey, factory());
    return matCache.get(fullKey);
}

export function std(scene, hex, roughness = 0.78, metallic = 0.04, extra = {}) {
    const colStr = typeof hex === 'number' ? hex.toString(16).padStart(6, '0') : String(hex);
    return mat(scene, `std:${colStr}:${roughness}:${metallic}:${extraKey(extra)}`, () => {
        const material = new B.PBRMaterial(`mat_${colStr}`, scene);
        material.albedoColor = hexToColor3(hex);
        material.roughness = roughness;
        material.metallic = metallic;
        if (extra.emissive) {
            material.emissiveColor = hexToColor3(extra.emissive);
            material.emissiveIntensity = extra.emissiveIntensity ?? 0.5;
        }
        if (extra.map) {
            material.albedoTexture = extra.map;
            if (extra.map.hasAlpha || extra.alphaTest) {
                material.albedoTexture.hasAlpha = true;
                material.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHATEST;
                material.needAlphaTesting = true;
                material.alphaCutOff = extra.alphaCutOff ?? 0.38;
            }
        }
        if (extra.bump) {
            material.bumpTexture = extra.bump;
            material.bumpTexture.level = extra.bumpLevel ?? 0.5;
        }
        if (extra.roughnessMap) {
            material.metallicTexture = extra.roughnessMap;
            material.useRoughnessFromMetallicTextureAlpha = false;
            material.useRoughnessFromMetallicTextureGreen = true;
            material.useMetallnessFromMetallicTextureBlue = false;
        }
        if (extra.alpha != null && !extra.alphaTest) {
            material.alpha = extra.alpha;
            material.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        }
        if (extra.doubleSided) material.backFaceCulling = false;
        return material;
    });
}

export function surf(scene, kind, tint = 0xffffff, extra = {}) {
    const maps = surface(scene, kind);
    return std(scene, tint, extra.roughness ?? 0.82, extra.metallic ?? 0.04, {
        ...extra,
        map: maps.albedo,
        bump: maps.bump,
        roughnessMap: maps.rough,
        mapKey: kind
    });
}

function limb(scene, name, type, options, material, parent, y = 0) {
    let mesh;
    if (type === 'cylinder') mesh = B.MeshBuilder.CreateCylinder(name, options, scene);
    else if (type === 'box') mesh = B.MeshBuilder.CreateBox(name, options, scene);
    else if (type === 'sphere') mesh = B.MeshBuilder.CreateSphere(name, options, scene);
    else if (type === 'capsule') mesh = B.MeshBuilder.CreateCapsule(name, options, scene);
    else if (type === 'torus') mesh = B.MeshBuilder.CreateTorus(name, options, scene);
    else if (type === 'disc') {
        mesh = B.MeshBuilder.CreateDisc(name, options, scene);
        mesh.rotation.x = Math.PI / 2;
    } else {
        throw new Error(`limb desconhecido: ${type}`);
    }
    mesh.material = material;
    if (parent) mesh.parent = parent;
    mesh.position.y = y;
    mesh.isPickable = false;
    return mesh;
}

function lathe(scene, name, shape, tessellation, material, parent, y = 0) {
    const mesh = B.MeshBuilder.CreateLathe(name, { shape, tessellation, cap: B.Mesh.CAP_END }, scene);
    mesh.material = material;
    if (parent) mesh.parent = parent;
    mesh.position.y = y;
    mesh.isPickable = false;
    return mesh;
}

function leafMat(scene) {
    return std(scene, 0xffffff, 0.72, 0.02, {
        map: leafTexture(scene),
        doubleSided: true,
        alphaTest: true,
        mapKey: 'leafAlpha'
    });
}

function addHumanFace(scene, head, skin, opts = {}) {
    const s = opts.scale ?? 1;
    const eyeWhite = std(scene, 0xf7f2ea, 0.28, 0.02);
    const iris = std(scene, opts.eyeHex ?? 0x2d5a1c, 0.32, 0.04);
    const pupil = std(scene, 0x0a0806, 0.2);
    const brow = std(scene, opts.browHex ?? 0x3a2414, 0.9);
    const lip = std(scene, 0xc4786a, 0.55);
    [-1, 1].forEach((sx, i) => {
        const eye = limb(scene, `eyeW_${i}`, 'sphere', { diameter: 0.056 * s, segments: 8 }, eyeWhite, head, 0.02 * s);
        eye.position.set(sx * 0.056 * s, 0.02 * s, 0.132 * s);
        const ir = limb(scene, `iris_${i}`, 'sphere', { diameter: 0.028 * s, segments: 6 }, iris, head, 0.02 * s);
        ir.position.set(sx * 0.056 * s, 0.02 * s, 0.15 * s);
        const pu = limb(scene, `pupil_${i}`, 'sphere', { diameter: 0.014 * s, segments: 5 }, pupil, head, 0.018 * s);
        pu.position.set(sx * 0.056 * s, 0.018 * s, 0.158 * s);
        const br = limb(scene, `brow_${i}`, 'box', { width: 0.072 * s, height: 0.012 * s, depth: 0.018 * s }, brow, head, 0.058 * s);
        br.position.set(sx * 0.056 * s, 0.058 * s, 0.122 * s);
        br.rotation.z = sx * -0.14;
        const ear = limb(scene, `ear_${i}`, 'sphere', {
            diameterX: 0.042 * s, diameterY: 0.072 * s, diameterZ: 0.032 * s, segments: 6
        }, skin, head, 0);
        ear.position.set(sx * 0.158 * s, 0, 0);
    });
    const nose = limb(scene, 'nose', 'capsule', {
        height: 0.072 * s, radius: 0.016 * s, tessellation: 6
    }, skin, head, -0.008 * s);
    nose.position.set(0, -0.008 * s, 0.148 * s);
    nose.rotation.x = 0.55;
    const mouth = limb(scene, 'mouth', 'sphere', {
        diameterX: 0.07 * s, diameterY: 0.018 * s, diameterZ: 0.024 * s, segments: 6
    }, lip, head, -0.052 * s);
    mouth.position.set(0, -0.052 * s, 0.128 * s);
}

/* ------------------------------------------------------------------ */
/* Personagens                                                         */
/* ------------------------------------------------------------------ */

export function buildJoao(scene) {
    const root = new B.TransformNode('joaoRoot', scene);
    const skin = std(scene, 0xffffff, 0.62, 0.02, { map: skinTexture(scene), mapKey: 'skin' });
    const hair = std(scene, 0x4a2a12, 0.9);
    const vest = surf(scene, 'leather', 0x3d8a48, { roughness: 0.78 });
    const pants = surf(scene, 'leather', 0x6a4428, { roughness: 0.86 });
    const cap = std(scene, 0xc43a2a, 0.62, 0.05);
    const boot = surf(scene, 'leather', 0x3a2414, { roughness: 0.8 });

    const hips = new B.TransformNode('joaoHips', scene);
    hips.parent = root;
    const parts = { legs: [], arms: [], feet: [] };

    [-1, 1].forEach((sx, i) => {
        const leg = new B.TransformNode(`joaoLeg_${i}`, scene);
        leg.parent = hips;
        leg.position.set(sx * 0.11, 0.46, 0);
        limb(scene, `joaoThigh_${i}`, 'capsule', {
            height: 0.44, radius: 0.07, tessellation: tess
        }, pants, leg, -0.2);
        const foot = limb(scene, `joaoFoot_${i}`, 'sphere', {
            diameterX: 0.14, diameterY: 0.07, diameterZ: 0.22, segments: 8
        }, boot, leg, -0.44);
        foot.position.z = 0.04;
        parts.legs.push(leg);
        parts.feet.push(foot);
    });

    const torso = new B.TransformNode('joaoTorso', scene);
    torso.parent = hips;
    torso.position.y = 0.46;
    limb(scene, 'joaoBody', 'capsule', {
        height: 0.48, radius: 0.16, tessellation: tess
    }, vest, torso, 0.28);
    limb(scene, 'joaoShirt', 'cylinder', {
        height: 0.1, diameterTop: 0.22, diameterBottom: 0.26, tessellation: 10
    }, std(scene, 0xf2e8d0, 0.88), torso, 0.5);
    const belt = limb(scene, 'joaoBelt', 'cylinder', {
        height: 0.05, diameter: 0.34, tessellation: 10
    }, surf(scene, 'leather', 0x4a2a14), torso, 0.1);
    belt.position.z = 0;

    const head = new B.TransformNode('joaoHead', scene);
    head.parent = torso;
    head.position.y = 0.64;
    limb(scene, 'joaoSkull', 'sphere', { diameter: 0.3, segments: tess }, skin, head, 0);
    addHumanFace(scene, head, skin, { scale: 1, eyeHex: 0x2a5a18, browHex: 0x5a3218 });
    limb(scene, 'joaoHair', 'sphere', {
        diameterX: 0.31, diameterY: 0.2, diameterZ: 0.3, segments: 10
    }, hair, head, 0.05);
    limb(scene, 'joaoHat', 'cylinder', {
        height: 0.1, diameterTop: 0.28, diameterBottom: 0.32, tessellation: 12
    }, cap, head, 0.16);
    limb(scene, 'joaoBrim', 'cylinder', {
        height: 0.025, diameter: 0.44, tessellation: 14
    }, cap, head, 0.12);

    [-1, 1].forEach((sx, i) => {
        const arm = new B.TransformNode(`joaoArm_${i}`, scene);
        arm.parent = torso;
        arm.position.set(sx * 0.2, 0.42, 0);
        limb(scene, `joaoArmMesh_${i}`, 'capsule', {
            height: 0.38, radius: 0.05, tessellation: 8
        }, skin, arm, -0.16);
        limb(scene, `joaoHand_${i}`, 'sphere', { diameter: 0.09, segments: 6 }, skin, arm, -0.36);
        parts.arms.push(arm);
    });

    const resultParts = { ...parts, torso, head, hips, root };
    root.userData = { parts: resultParts };
    return { group: root, parts: resultParts };
}

export function buildMother(scene) {
    const root = new B.TransformNode('motherRoot', scene);
    const skin = std(scene, 0xffffff, 0.66, 0.02, { map: skinTexture(scene), mapKey: 'skin' });
    const dress = std(scene, 0x6a3a78, 0.82, 0.02, { map: clothTexture(scene), mapKey: 'cloth' });
    const apron = std(scene, 0xf0e4c8, 0.88);
    const hair = std(scene, 0x3a2414, 0.9);

    lathe(scene, 'motherSkirt', [
        new B.Vector3(0.44, 0, 0),
        new B.Vector3(0.4, 0.28, 0),
        new B.Vector3(0.26, 0.7, 0),
        new B.Vector3(0.2, 1.02, 0),
        new B.Vector3(0.22, 1.18, 0)
    ], 16, dress, root, 0);

    const ap = limb(scene, 'motherApron', 'box', { width: 0.3, height: 0.48, depth: 0.03 }, apron, root, 0.7);
    ap.position.z = 0.2;

    const head = new B.TransformNode('motherHead', scene);
    head.parent = root;
    head.position.y = 1.32;
    limb(scene, 'motherSkull', 'sphere', { diameter: 0.3, segments: tess }, skin, head, 0);
    addHumanFace(scene, head, skin, { scale: 1, eyeHex: 0x4a3020, browHex: 0x3a2414 });
    const bun = limb(scene, 'motherBun', 'sphere', { diameter: 0.16, segments: 8 }, hair, head, 0.1);
    bun.position.z = -0.1;
    limb(scene, 'motherHair', 'sphere', {
        diameterX: 0.32, diameterY: 0.18, diameterZ: 0.3, segments: 8
    }, hair, head, 0.04);

    [-1, 1].forEach((sx, i) => {
        const arm = limb(scene, `motherArm_${i}`, 'capsule', {
            height: 0.46, radius: 0.05, tessellation: 8
        }, skin, root, 0.95);
        arm.position.set(sx * 0.24, 0.95, 0.04);
        arm.rotation.z = sx * 0.38;
    });
    return root;
}

export function buildMerchant(scene) {
    const root = new B.TransformNode('merchantRoot', scene);
    const robe = std(scene, 0xc8a0e0, 0.8, 0.02, { map: clothTexture(scene), mapKey: 'cloth' });
    const skin = std(scene, 0xffffff, 0.66, 0.02, { map: skinTexture(scene), mapKey: 'skin' });
    const hatMat = std(scene, 0x3a1848, 0.68, 0.05);
    const hair = std(scene, 0xd8d0c0, 0.88);

    lathe(scene, 'merchantCloak', [
        new B.Vector3(0.08, 0, 0),
        new B.Vector3(0.42, 0.15, 0),
        new B.Vector3(0.48, 0.7, 0),
        new B.Vector3(0.28, 1.2, 0),
        new B.Vector3(0.16, 1.38, 0)
    ], 16, robe, root, 0);

    const head = new B.TransformNode('merchantHead', scene);
    head.parent = root;
    head.position.y = 1.48;
    limb(scene, 'merchantSkull', 'sphere', { diameter: 0.3, segments: tess }, skin, head, 0);
    addHumanFace(scene, head, skin, { scale: 1, eyeHex: 0x3a2060, browHex: 0xc8c0b0 });
    limb(scene, 'merchantHat', 'cylinder', {
        height: 0.52, diameterTop: 0.02, diameterBottom: 0.42, tessellation: 12
    }, hatMat, head, 0.28);
    limb(scene, 'merchantBrim', 'cylinder', {
        height: 0.035, diameter: 0.62, tessellation: 14
    }, hatMat, head, 0.04);
    const beard = limb(scene, 'merchantBeard', 'cylinder', {
        height: 0.22, diameterTop: 0.18, diameterBottom: 0.02, tessellation: 8
    }, hair, head, -0.16);
    beard.position.z = 0.1;
    beard.rotation.x = 0.35;

    const pouch = limb(scene, 'merchantPouch', 'sphere', { diameter: 0.22, segments: 8 }, surf(scene, 'leather'), root, 0.7);
    pouch.position.set(0.28, 0.7, 0.1);
    return root;
}

export function buildCow(scene) {
    const root = new B.TransformNode('cowRoot', scene);
    const hide = std(scene, 0xffffff, 0.86, 0.02, { map: cowHideTexture(scene), bump: surface(scene, 'leather').bump, mapKey: 'cowHide' });
    const hoof = std(scene, 0x2a1a10, 0.7);
    const pink = std(scene, 0xe8c8b0, 0.75);
    const horn = std(scene, 0xf0e8d0, 0.45, 0.18);

    limb(scene, 'cowBody', 'sphere', {
        diameterX: 1.28, diameterY: 0.82, diameterZ: 0.72, segments: tess
    }, hide, root, 0.58);

    const head = new B.TransformNode('cowHead', scene);
    head.parent = root;
    head.position.set(0, 0.78, 0.58);
    limb(scene, 'cowHeadMesh', 'sphere', { diameter: 0.42, segments: 10 }, hide, head, 0);
    const snout = limb(scene, 'cowSnout', 'sphere', {
        diameterX: 0.26, diameterY: 0.18, diameterZ: 0.3, segments: 8
    }, pink, head, -0.08);
    snout.position.z = 0.18;

    [-1, 1].forEach((sx, i) => {
        const h = limb(scene, `cowHorn_${i}`, 'cylinder', {
            height: 0.16, diameterTop: 0.012, diameterBottom: 0.055, tessellation: 6
        }, horn, head, 0.2);
        h.position.set(sx * 0.12, 0.2, -0.04);
        h.rotation.z = sx * -0.42;
        const ear = limb(scene, `cowEar_${i}`, 'sphere', {
            diameterX: 0.06, diameterY: 0.14, diameterZ: 0.09, segments: 6
        }, hide, head, 0.08);
        ear.position.set(sx * 0.2, 0.08, -0.08);
        const eye = limb(scene, `cowEye_${i}`, 'sphere', { diameter: 0.055, segments: 6 }, std(scene, 0x1a140e, 0.35), head, 0.06);
        eye.position.set(sx * 0.1, 0.06, 0.16);

        const legF = limb(scene, `cowLegF_${i}`, 'capsule', {
            height: 0.5, radius: 0.065, tessellation: 6
        }, hide, root, 0.26);
        legF.position.set(sx * 0.22, 0.26, 0.2);
        const legB = limb(scene, `cowLegB_${i}`, 'capsule', {
            height: 0.5, radius: 0.065, tessellation: 6
        }, hide, root, 0.26);
        legB.position.set(sx * 0.22, 0.26, -0.22);
        limb(scene, `cowHoofF_${i}`, 'sphere', { diameter: 0.12, segments: 5 }, hoof, legF, -0.26);
        limb(scene, `cowHoofB_${i}`, 'sphere', { diameter: 0.12, segments: 5 }, hoof, legB, -0.26);
    });

    const udder = limb(scene, 'cowUdder', 'sphere', { diameter: 0.22, segments: 8 }, pink, root, 0.28);
    udder.position.z = -0.04;
    const tail = limb(scene, 'cowTail', 'capsule', { height: 0.42, radius: 0.03, tessellation: 5 }, hide, root, 0.62);
    tail.position.z = -0.5;
    tail.rotation.x = 0.55;

    root.userData = { parts: { head } };
    return root;
}

export function buildGiant(scene) {
    const root = new B.TransformNode('giantRoot', scene);
    const skin = std(scene, 0xffffff, 0.7, 0.02, { map: skinTexture(scene), mapKey: 'skin' });
    const cloth = surf(scene, 'leather', 0x4a3020, { roughness: 0.88 });
    const hair = std(scene, 0x3a2010, 0.92);
    const boot = surf(scene, 'leather', 0x2a1810);

    const hips = new B.TransformNode('giantHips', scene);
    hips.parent = root;
    const parts = { legs: [], arms: [] };

    [-1, 1].forEach((sx, i) => {
        const leg = new B.TransformNode(`giantLeg_${i}`, scene);
        leg.parent = hips;
        leg.position.set(sx * 0.52, 1.65, 0);
        limb(scene, `giantThigh_${i}`, 'capsule', {
            height: 1.55, radius: 0.28, tessellation: 8
        }, cloth, leg, -0.72);
        const bootM = limb(scene, `giantBoot_${i}`, 'sphere', {
            diameterX: 0.42, diameterY: 0.26, diameterZ: 0.7, segments: 8
        }, boot, leg, -1.52);
        bootM.position.z = 0.12;
        parts.legs.push(leg);
    });

    const torso = new B.TransformNode('giantTorso', scene);
    torso.parent = hips;
    torso.position.y = 1.7;
    const belly = limb(scene, 'giantBelly', 'sphere', {
        diameterX: 2.15, diameterY: 1.7, diameterZ: 1.65, segments: tess
    }, cloth, torso, 1.1);
    limb(scene, 'giantChest', 'capsule', {
        height: 1.35, radius: 0.72, tessellation: 10
    }, cloth, torso, 1.85);

    const head = new B.TransformNode('giantHead', scene);
    head.parent = torso;
    head.position.y = 2.7;
    limb(scene, 'giantSkull', 'sphere', { diameter: 1.2, segments: tess }, skin, head, 0);
    addHumanFace(scene, head, skin, { scale: 3.6, eyeHex: 0x3a2010, browHex: 0x2a1810 });
    const beard = limb(scene, 'giantBeard', 'cylinder', {
        height: 0.7, diameterTop: 0.7, diameterBottom: 0.08, tessellation: 8
    }, hair, head, -0.48);
    beard.position.z = 0.28;
    beard.rotation.x = 0.22;
    limb(scene, 'giantHair', 'sphere', {
        diameterX: 1.24, diameterY: 0.7, diameterZ: 1.2, segments: 10
    }, hair, head, 0.22);

    [-1, 1].forEach((sx, i) => {
        const arm = new B.TransformNode(`giantArm_${i}`, scene);
        arm.parent = torso;
        arm.position.set(sx * 1.02, 2.05, 0);
        limb(scene, `giantArmMesh_${i}`, 'capsule', {
            height: 1.55, radius: 0.2, tessellation: 8
        }, skin, arm, -0.7);
        limb(scene, `giantFist_${i}`, 'sphere', { diameter: 0.42, segments: 8 }, skin, arm, -1.48);
        parts.arms.push(arm);
    });

    const club = limb(scene, 'giantClub', 'cylinder', {
        height: 2.2, diameterTop: 0.2, diameterBottom: 0.52, tessellation: 8
    }, surf(scene, 'bark'), parts.arms[1], -1.35);
    club.position.set(0.18, -1.35, 0.28);
    club.rotation.z = 0.28;

    const resultParts = { ...parts, torso, head, hips, belly, club, root };
    root.userData = { parts: resultParts };
    return { group: root, parts: resultParts };
}

/* ------------------------------------------------------------------ */
/* Arquitetura                                                         */
/* ------------------------------------------------------------------ */

export function buildCottage(scene) {
    const root = new B.TransformNode('cottageRoot', scene);
    const plaster = surf(scene, 'wood', 0xf0d8b0, { roughness: 0.9 });
    const timber = surf(scene, 'wood', 0x6a3e20, { roughness: 0.82 });
    const thatch = std(scene, 0xffffff, 0.95, 0.02, { map: thatchTexture(scene), mapKey: 'thatch' });
    const stone = surf(scene, 'stone');

    limb(scene, 'cottageBase', 'box', { width: 5.5, height: 0.45, depth: 4.5 }, stone, root, 0.22);
    limb(scene, 'cottageBody', 'box', { width: 5.2, height: 2.35, depth: 4.2 }, plaster, root, 1.4);

    [[-2.5, 0], [2.5, 0], [0, -2.05], [0, 2.05]].forEach(([x, z], i) => {
        const beam = limb(scene, `cottageBeam_${i}`, 'box', {
            width: z === 0 ? 0.16 : 5.2, height: 2.35, depth: x === 0 ? 0.16 : 4.2
        }, timber, root, 1.4);
        beam.position.set(x * 0.02 + (z === 0 ? x : 0), 1.4, z === 0 ? 0 : z * 0.02 + (x === 0 ? z : 0));
    });
    [-1, 1].forEach((sx) => {
        const post = limb(scene, 'cottagePost', 'box', { width: 0.18, height: 2.4, depth: 0.18 }, timber, root, 1.4);
        post.position.set(sx * 2.45, 1.4, 2.05);
    });

    const slopeL = limb(scene, 'cottageRoofL', 'box', { width: 3.4, height: 0.28, depth: 5.0 }, thatch, root, 3.15);
    slopeL.rotation.z = 0.52;
    slopeL.position.set(-1.35, 3.15, 0);
    const slopeR = limb(scene, 'cottageRoofR', 'box', { width: 3.4, height: 0.28, depth: 5.0 }, thatch, root, 3.15);
    slopeR.rotation.z = -0.52;
    slopeR.position.set(1.35, 3.15, 0);
    limb(scene, 'cottageRidge', 'box', { width: 0.22, height: 0.18, depth: 5.1 }, timber, root, 3.85);

    const door = limb(scene, 'cottageDoor', 'box', { width: 0.88, height: 1.55, depth: 0.1 }, timber, root, 0.9);
    door.position.z = 2.16;
    const knob = limb(scene, 'cottageKnob', 'sphere', { diameter: 0.09, segments: 6 }, std(scene, 0xd4a020, 0.28, 0.82), root, 0.85);
    knob.position.set(0.3, 0.85, 2.24);

    [-1.35, 1.35].forEach((sx, i) => {
        const win = limb(scene, `cottageWin_${i}`, 'box', { width: 0.72, height: 0.72, depth: 0.08 },
            std(scene, 0x88c8e8, 0.22, 0.08, { emissive: 0xffcc66, emissiveIntensity: 0.4 }), root, 1.62);
        win.position.set(sx, 1.62, 2.12);
        const frame = limb(scene, `cottageWinF_${i}`, 'box', { width: 0.82, height: 0.82, depth: 0.06 }, timber, root, 1.62);
        frame.position.set(sx, 1.62, 2.1);
    });

    const chimney = limb(scene, 'cottageChimney', 'box', { width: 0.58, height: 1.55, depth: 0.58 }, stone, root, 4.2);
    chimney.position.set(1.55, 4.2, -0.7);
    return root;
}

export function buildFence(scene, len = 6) {
    const root = new B.TransformNode('fenceRoot', scene);
    const wood = surf(scene, 'wood', 0x8a6a40);
    const posts = Math.max(2, Math.round(len / 1.15));
    for (let i = 0; i < posts; i++) {
        const x = (i / (posts - 1) - 0.5) * len;
        const p = limb(scene, `fencePost_${i}`, 'cylinder', {
            height: 0.95, diameterTop: 0.1, diameterBottom: 0.13, tessellation: 6
        }, wood, root, 0.48);
        p.position.set(x, 0.48, 0);
    }
    [0.3, 0.64].forEach((y, i) => {
        limb(scene, `fenceRail_${i}`, 'box', { width: len, height: 0.07, depth: 0.07 }, wood, root, y);
    });
    return root;
}

export function buildTree(scene, rng = Math.random) {
    const root = new B.TransformNode('treeRoot', scene);
    const barkMat = surf(scene, 'bark');
    const foliage = leafMat(scene);
    const lean = (rng() - 0.5) * 0.28;
    const path = [];
    for (let i = 0; i <= 7; i++) {
        const t = i / 7;
        path.push(new B.Vector3(lean * t * t * 1.4, t * 2.55, (rng() - 0.5) * 0.08));
    }
    const trunk = B.MeshBuilder.CreateTube('treeTrunk', {
        path,
        radius: 0.2,
        tessellation: Math.max(5, tess - 4),
        cap: B.Mesh.CAP_ALL
    }, scene);
    trunk.material = barkMat;
    trunk.parent = root;
    trunk.isPickable = false;

    const cards = tess < 8 ? 5 : 11;
    for (let i = 0; i < cards; i++) {
        const card = B.MeshBuilder.CreatePlane(`treeLeaf_${i}`, {
            width: 1.1 + rng() * 0.7,
            height: 1.3 + rng() * 0.6
        }, scene);
        card.material = foliage;
        card.parent = root;
        card.position.set((rng() - 0.5) * 1.5, 2.15 + rng() * 1.1, (rng() - 0.5) * 1.5);
        card.rotation.set(rng() * 0.5, rng() * Math.PI * 2, rng() * 0.4);
        card.isPickable = false;
    }
    return root;
}

export function buildRock(scene, rng = Math.random) {
    const mesh = B.MeshBuilder.CreateIcoSphere('rock', {
        radius: 0.32 + rng() * 0.45,
        subdivisions: 1
    }, scene);
    mesh.scaling.set(1 + rng() * 0.7, 0.4 + rng() * 0.45, 0.75 + rng() * 0.6);
    mesh.material = surf(scene, 'rock');
    mesh.rotation.y = rng() * Math.PI * 2;
    mesh.isPickable = false;
    return mesh;
}

export function buildStall(scene, color = 0xc45a2a) {
    const root = new B.TransformNode('stallRoot', scene);
    const wood = surf(scene, 'wood');
    limb(scene, 'stallTable', 'box', { width: 2.2, height: 0.12, depth: 1.1 }, wood, root, 0.85);
    [-0.9, 0.9].forEach((sx) => {
        [-0.4, 0.4].forEach((sz) => {
            const leg = limb(scene, 'stallLeg', 'box', { width: 0.1, height: 0.85, depth: 0.1 }, wood, root, 0.42);
            leg.position.set(sx, 0.42, sz);
        });
    });
    limb(scene, 'stallCloth', 'box', { width: 2.45, height: 0.06, depth: 1.65 }, std(scene, color, 0.82), root, 1.88);
    [-1.05, 1.05].forEach((sx) => {
        const pole = limb(scene, 'stallPole', 'cylinder', { height: 2.05, diameter: 0.09, tessellation: 6 }, wood, root, 1.02);
        pole.position.set(sx, 1.02, -0.5);
    });
    return root;
}

export function buildBeanstalk(scene, height = 78, quality = 'high') {
    const root = new B.TransformNode('beanstalkRoot', scene);
    const stemMat = surf(scene, 'bark', 0x3a8a32, { roughness: 0.8 });
    const foliage = leafMat(scene);
    const segs = quality === 'low' ? 28 : 52;
    const path = [];
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const a = t * Math.PI * 2 * 6.2;
        const r = 0.42 + Math.sin(t * 11) * 0.1;
        path.push(new B.Vector3(Math.cos(a) * r, t * height, Math.sin(a) * r));
    }
    const vine = B.MeshBuilder.CreateTube('stalkVine', {
        path,
        radius: 0.55,
        tessellation: quality === 'low' ? 6 : 9,
        cap: B.Mesh.CAP_ALL
    }, scene);
    vine.material = stemMat;
    vine.parent = root;
    vine.isPickable = false;

    const tendrilPath = path.map((p, i) => {
        const t = i / segs;
        const a = t * Math.PI * 2 * 6.2 + 0.9;
        return new B.Vector3(Math.cos(a) * 0.85, p.y, Math.sin(a) * 0.85);
    });
    const tendril = B.MeshBuilder.CreateTube('stalkTendril', {
        path: tendrilPath,
        radius: 0.16,
        tessellation: 5,
        cap: B.Mesh.CAP_ALL
    }, scene);
    tendril.material = stemMat;
    tendril.parent = root;
    tendril.isPickable = false;

    const platforms = [];
    const count = quality === 'low' ? 12 : 18;
    for (let i = 0; i < count; i++) {
        const y = 3.2 + i * (height - 10) / count;
        const a = i * 0.92;
        const r = 3.15;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const pad = limb(scene, `stalkPad_${i}`, 'sphere', {
            diameterX: 3.1, diameterY: 0.26, diameterZ: 2.4, segments: 10
        }, foliage, root, y);
        pad.position.set(x, y, z);
        pad.rotation.y = a;
        platforms.push({ x, y, z, r: 1.45 });
    }

    const flower = limb(scene, 'stalkFlower', 'cylinder', {
        height: 2.1, diameterTop: 0.15, diameterBottom: 2.6, tessellation: 10
    }, std(scene, 0x7a3aaa, 0.55, 0.05, { emissive: 0x5a2088, emissiveIntensity: 0.5 }), root, height + 0.35);
    flower.position.y = height + 0.35;
    return { group: root, platforms, height };
}

export function buildCloudIsland(scene, radius = 28) {
    const root = new B.TransformNode('cloudIslandRoot', scene);
    const cloudMat = std(scene, 0xffffff, 0.95, 0.02, {
        map: cloudTexture(scene),
        emissive: 0xe8f0fa,
        emissiveIntensity: 0.18,
        mapKey: 'cloud'
    });
    limb(scene, 'cloudTop', 'cylinder', {
        height: 2.0, diameterTop: radius * 2, diameterBottom: radius * 1.84, tessellation: 28
    }, cloudMat, root, 0);
    const puffs = tess < 8 ? 8 : 14;
    for (let i = 0; i < puffs; i++) {
        const a = (i / puffs) * Math.PI * 2;
        const puff = limb(scene, `cloudPuff_${i}`, 'sphere', {
            diameterX: 9 + (i % 4) * 2.4,
            diameterY: 4.2 + (i % 3) * 1.2,
            diameterZ: 9 + (i % 4) * 2.4,
            segments: 10
        }, cloudMat, root, -1.15);
        puff.position.set(Math.cos(a) * (radius * 0.8), -1.15, Math.sin(a) * (radius * 0.8));
    }
    return root;
}

export function buildCastle(scene) {
    const root = new B.TransformNode('castleRoot', scene);
    const stone = surf(scene, 'stone');
    const roofMat = surf(scene, 'tiles', 0x8a4aaa, { roughness: 0.65 });
    const wood = surf(scene, 'wood', 0x3a2414);

    limb(scene, 'castleKeep', 'box', { width: 16, height: 10, depth: 14 }, stone, root, 5);
    limb(scene, 'castleHall', 'box', { width: 10, height: 6, depth: 12 }, stone, root, 3).position.z = 10;

    for (let i = -7; i <= 7; i += 2) {
        const merlon = limb(scene, `castleMerlon_${i}`, 'box', { width: 1.1, height: 0.85, depth: 0.55 }, stone, root, 10.4);
        merlon.position.set(i, 10.4, 7.05);
        const merlonB = limb(scene, `castleMerlonB_${i}`, 'box', { width: 1.1, height: 0.85, depth: 0.55 }, stone, root, 10.4);
        merlonB.position.set(i, 10.4, -7.05);
    }

    [[-7, -6], [7, -6], [-7, 6], [7, 6], [-4, 15], [4, 15]].forEach(([x, z], i) => {
        const t = limb(scene, `castleTower_${i}`, 'cylinder', {
            height: 14, diameterTop: 2.7, diameterBottom: 3.2, tessellation: 12
        }, stone, root, 7);
        t.position.set(x, 7, z);
        const cap = limb(scene, `castleCap_${i}`, 'cylinder', {
            height: 2.5, diameterTop: 0.15, diameterBottom: 3.5, tessellation: 10
        }, roofMat, root, 15.15);
        cap.position.set(x, 15.15, z);
    });

    [-5, 0, 5].forEach((x, i) => {
        const win = limb(scene, `castleWin_${i}`, 'box', { width: 0.7, height: 1.4, depth: 0.12 },
            std(scene, 0x1a2840, 0.3, 0.05, { emissive: 0xffaa55, emissiveIntensity: 0.25 }), root, 6.2);
        win.position.set(x, 6.2, 7.05);
    });

    const door = limb(scene, 'castleDoor', 'box', { width: 3.2, height: 4.4, depth: 0.35 }, wood, root, 2.2);
    door.position.z = 16.1;
    return root;
}

export function buildTable(scene) {
    const root = new B.TransformNode('tableRoot', scene);
    const wood = surf(scene, 'wood');
    limb(scene, 'tableTop', 'box', { width: 8, height: 0.32, depth: 4.2 }, wood, root, 1.8);
    [-3.4, 3.4].forEach((sx) => {
        [-1.6, 1.6].forEach((sz) => {
            const leg = limb(scene, 'tableLeg', 'box', { width: 0.28, height: 1.8, depth: 0.28 }, wood, root, 0.9);
            leg.position.set(sx, 0.9, sz);
        });
    });
    return root;
}

export function buildGoldBag(scene) {
    const root = new B.TransformNode('goldBagRoot', scene);
    const goldMat = std(scene, 0xffffff, 0.32, 0.72, {
        map: goldTexture(scene),
        emissive: 0xaa7700,
        emissiveIntensity: 0.42,
        mapKey: 'gold'
    });
    const sack = surf(scene, 'leather', 0x8a6a20, { roughness: 0.7 });
    limb(scene, 'goldBagMesh', 'sphere', {
        diameterX: 0.78, diameterY: 0.9, diameterZ: 0.78, segments: 12
    }, goldMat, root, 0);
    limb(scene, 'goldBagNeck', 'cylinder', {
        height: 0.22, diameterTop: 0.22, diameterBottom: 0.36, tessellation: 8
    }, sack, root, 0.44);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const coin = limb(scene, `coin_${i}`, 'cylinder', {
            height: 0.04, diameter: 0.14, tessellation: 10
        }, goldMat, root, 0.18);
        coin.position.set(Math.cos(a) * 0.22, 0.18 + (i % 2) * 0.08, Math.sin(a) * 0.22);
        coin.rotation.x = Math.PI / 2;
    }
    return root;
}

export function buildHen(scene) {
    const root = new B.TransformNode('henRoot', scene);
    const gold = std(scene, 0xffffff, 0.28, 0.78, {
        map: goldTexture(scene),
        emissive: 0xaa7700,
        emissiveIntensity: 0.38,
        mapKey: 'gold'
    });
    limb(scene, 'henBody', 'sphere', {
        diameterX: 0.68, diameterY: 0.5, diameterZ: 0.54, segments: 12
    }, gold, root, 0.3);
    const head = limb(scene, 'henHead', 'sphere', { diameter: 0.26, segments: 8 }, gold, root, 0.52);
    head.position.x = 0.24;
    const beak = limb(scene, 'henBeak', 'cylinder', {
        height: 0.12, diameterTop: 0.01, diameterBottom: 0.07, tessellation: 6
    }, std(scene, 0xffaa33, 0.4, 0.45), root, 0.5);
    beak.position.x = 0.38;
    beak.rotation.z = -Math.PI / 2;
    const comb = limb(scene, 'henComb', 'sphere', { diameter: 0.12, segments: 6 }, std(scene, 0xff5533, 0.5), root, 0.66);
    comb.position.x = 0.2;
    [-1, 1].forEach((sx) => {
        const wing = limb(scene, 'henWing', 'sphere', {
            diameterX: 0.3, diameterY: 0.18, diameterZ: 0.08, segments: 8
        }, gold, root, 0.32);
        wing.position.set(-0.04, 0.32, sx * 0.24);
    });
    const tail = limb(scene, 'henTail', 'sphere', {
        diameterX: 0.22, diameterY: 0.28, diameterZ: 0.08, segments: 8
    }, gold, root, 0.4);
    tail.position.set(-0.32, 0.4, 0);
    tail.rotation.z = 0.5;
    return root;
}

export function buildHarp(scene) {
    const root = new B.TransformNode('harpRoot', scene);
    const gold = std(scene, 0xffffff, 0.24, 0.82, {
        map: goldTexture(scene),
        emissive: 0xaa8800,
        emissiveIntensity: 0.48,
        mapKey: 'gold'
    });
    const frame = limb(scene, 'harpFrame', 'torus', {
        diameter: 1.12, thickness: 0.12, tessellation: 24
    }, gold, root, 0.58);
    frame.rotation.y = Math.PI / 2;
    const pillar = limb(scene, 'harpPillar', 'cylinder', {
        height: 1.18, diameter: 0.09, tessellation: 10
    }, gold, root, 0.58);
    pillar.position.x = 0.55;
    limb(scene, 'harpBase', 'box', { width: 0.72, height: 0.1, depth: 0.22 }, gold, root, 0.05);
    for (let i = 0; i < 8; i++) {
        const s = limb(scene, `harpString_${i}`, 'cylinder', {
            height: 0.68 + i * 0.05, diameter: 0.014, tessellation: 4
        }, std(scene, 0xfff8d0, 0.35, 0.1, { emissive: 0xffeedd, emissiveIntensity: 0.55 }), root, 0.52);
        s.position.x = -0.22 + i * 0.1;
    }
    return root;
}

export function buildAxe(scene) {
    const root = new B.TransformNode('axeRoot', scene);
    limb(scene, 'axeHandle', 'cylinder', {
        height: 1.12, diameterTop: 0.07, diameterBottom: 0.1, tessellation: 8
    }, surf(scene, 'wood', 0x6a3a18), root, 0.55);
    const head = limb(scene, 'axeHead', 'box', { width: 0.48, height: 0.28, depth: 0.07 },
        std(scene, 0xc8d0d8, 0.28, 0.78), root, 1.05);
    head.position.x = 0.18;
    const bit = limb(scene, 'axeBit', 'box', { width: 0.18, height: 0.34, depth: 0.04 },
        std(scene, 0xe8eef2, 0.22, 0.85), root, 1.05);
    bit.position.x = 0.38;
    return root;
}

export function buildWell(scene) {
    const root = new B.TransformNode('wellRoot', scene);
    const stone = surf(scene, 'stone', 0x9aa0a8);
    const wood = surf(scene, 'wood');
    limb(scene, 'wellRing', 'cylinder', {
        height: 0.72, diameterTop: 1.65, diameterBottom: 1.9, tessellation: 16
    }, stone, root, 0.36);
    limb(scene, 'wellWater', 'cylinder', {
        height: 0.02, diameter: 1.35, tessellation: 16
    }, std(scene, 0x3a88aa, 0.12, 0.28, { alpha: 0.78 }), root, 0.42);
    [-0.7, 0.7].forEach((sx) => {
        const post = limb(scene, 'wellPost', 'cylinder', {
            height: 1.15, diameter: 0.08, tessellation: 6
        }, wood, root, 1.05);
        post.position.set(sx, 1.05, 0);
    });
    limb(scene, 'wellBeam', 'cylinder', {
        height: 1.5, diameter: 0.07, tessellation: 6
    }, wood, root, 1.62).rotation.z = Math.PI / 2;
    return root;
}

export function buildGateArch(scene) {
    const root = new B.TransformNode('gateArchRoot', scene);
    const wood = surf(scene, 'wood', 0x6a3e1c);
    [-1.6, 1.6].forEach((sx) => {
        const post = limb(scene, 'gatePost', 'box', { width: 0.28, height: 3.4, depth: 0.28 }, wood, root, 1.7);
        post.position.set(sx, 1.7, 0);
    });
    limb(scene, 'gateBar', 'box', { width: 3.6, height: 0.28, depth: 0.28 }, wood, root, 3.25);
    limb(scene, 'gateSign', 'box', { width: 1.6, height: 0.55, depth: 0.08 }, std(scene, 0xc4a050, 0.65), root, 3.7);
    limb(scene, 'gateGlow', 'cylinder', {
        height: 0.12, diameterTop: 1.8, diameterBottom: 2.2, tessellation: 16
    }, std(scene, 0xffee88, 0.4, 0.1, { alpha: 0.55, emissive: 0xffee88, emissiveIntensity: 0.55 }), root, 0.08);
    return root;
}

export function makeBeacon(scene, colorHex = 0xaaff66) {
    const beacon = B.MeshBuilder.CreateCylinder('beacon', {
        height: 8.5, diameterTop: 0.36, diameterBottom: 1.1, tessellation: 8
    }, scene);
    const mat = new B.StandardMaterial('beaconMat', scene);
    const col = hexToColor3(colorHex);
    mat.diffuseColor = col;
    mat.emissiveColor = col;
    mat.alpha = 0.42;
    mat.backFaceCulling = false;
    mat.disableLighting = true;
    beacon.material = mat;
    beacon.isPickable = false;
    return beacon;
}

export function grassTuft(scene) {
    const plane = B.MeshBuilder.CreatePlane('grassTuft', { width: 0.7, height: 0.85 }, scene);
    plane.material = std(scene, 0xffffff, 0.85, 0.02, {
        map: bladeTexture(scene),
        doubleSided: true,
        alphaTest: true,
        mapKey: 'bladeAlpha'
    });
    plane.billboardMode = B.Mesh.BILLBOARDMODE_Y;
    plane.isPickable = false;
    return plane;
}
