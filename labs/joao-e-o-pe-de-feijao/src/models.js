/**
 * Modelos 3D construídos por código no Babylon.js — nenhum GLB externo.
 * João, mãe, mercador, Mimosa, gigante, cabana, pé de feijão, castelo e tesouros.
 */

import { hexToColor3 } from './sky.js';
import {
    grassTexture, barkTexture, leafTexture, thatchTexture, woodTexture,
    stoneTexture, goldTexture, cloudTexture, clothTexture
} from './textures.js';

const B = window.BABYLON;
const matCache = new Map();

function mat(scene, key, factory) {
    const sceneKey = scene?.uid || 'default';
    const fullKey = `${sceneKey}:${key}`;
    if (!matCache.has(fullKey)) {
        matCache.set(fullKey, factory());
    }
    return matCache.get(fullKey);
}

export function clearMaterialCache() {
    matCache.clear();
}

export function std(scene, hex, roughness = 0.78, metallic = 0.04, extra = {}) {
    const colStr = typeof hex === 'number' ? hex.toString(16) : String(hex);
    return mat(scene, `std:${colStr}:${roughness}:${metallic}:${JSON.stringify(extra)}`, () => {
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
        }
        if (extra.alpha != null) {
            material.alpha = extra.alpha;
            material.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
        }
        if (extra.doubleSided) {
            material.backFaceCulling = false;
        }
        return material;
    });
}

function limb(scene, name, type, options, material, parent, y = 0) {
    let mesh;
    if (type === 'cylinder') {
        mesh = B.MeshBuilder.CreateCylinder(name, options, scene);
    } else if (type === 'box') {
        mesh = B.MeshBuilder.CreateBox(name, options, scene);
    } else if (type === 'sphere') {
        mesh = B.MeshBuilder.CreateSphere(name, options, scene);
    }
    mesh.material = material;
    if (parent) mesh.parent = parent;
    mesh.position.y = y;
    return mesh;
}

/* ------------------------------------------------------------------ */
/* Personagens                                                         */
/* ------------------------------------------------------------------ */

export function buildJoao(scene) {
    const root = new B.TransformNode('joaoRoot', scene);
    const skin = std(scene, 0xf0c49a, 0.65, 0.02);
    const hair = std(scene, 0x5a3218, 0.88, 0.02);
    const vest = std(scene, 0x2e7a3a, 0.84, 0.04);
    const pants = std(scene, 0x6a4428, 0.86, 0.02);
    const cap = std(scene, 0xc43a2a, 0.68, 0.05);

    const hips = new B.TransformNode('joaoHips', scene);
    hips.parent = root;

    const parts = { legs: [], arms: [], feet: [] };

    // Pernas e pés
    [-1, 1].forEach((sx, i) => {
        const leg = new B.TransformNode(`joaoLeg_${i}`, scene);
        leg.parent = hips;
        leg.position.set(sx * 0.12, 0.42, 0);

        const thigh = limb(scene, `joaoThigh_${i}`, 'cylinder', {
            height: 0.38,
            diameterTop: 0.15,
            diameterBottom: 0.13,
            tessellation: 8
        }, pants, leg, -0.19);

        const foot = limb(scene, `joaoFoot_${i}`, 'sphere', {
            diameterX: 0.16,
            diameterY: 0.08,
            diameterZ: 0.24,
            segments: 8
        }, std(scene, 0x3a2414, 0.82), leg, -0.4);
        foot.position.z = 0.04;

        parts.legs.push(leg);
        parts.feet.push(foot);
    });

    // Torso
    const torso = new B.TransformNode('joaoTorso', scene);
    torso.parent = hips;
    torso.position.y = 0.44;

    const body = limb(scene, 'joaoBody', 'cylinder', {
        height: 0.42,
        diameterTop: 0.32,
        diameterBottom: 0.40,
        tessellation: 10
    }, vest, torso, 0.28);

    const shirt = limb(scene, 'joaoShirt', 'cylinder', {
        height: 0.12,
        diameterTop: 0.24,
        diameterBottom: 0.28,
        tessellation: 8
    }, std(scene, 0xf2e8d0, 0.9), torso, 0.48);

    // Cabeça e chapéu
    const head = new B.TransformNode('joaoHead', scene);
    head.parent = torso;
    head.position.y = 0.62;

    const skull = limb(scene, 'joaoSkull', 'sphere', {
        diameter: 0.31,
        segments: 12
    }, skin, head, 0);

    // Olhos
    [-1, 1].forEach((sx, i) => {
        const eye = limb(scene, `joaoEye_${i}`, 'sphere', {
            diameter: 0.048,
            segments: 8
        }, std(scene, 0xf7f2ea, 0.35), head, 0.02);
        eye.position.set(sx * 0.05, 0.02, 0.135);

        const iris = limb(scene, `joaoIris_${i}`, 'sphere', {
            diameter: 0.026,
            segments: 6
        }, std(scene, 0x2a5a18, 0.4), head, 0.02);
        iris.position.set(sx * 0.05, 0.02, 0.152);
    });

    const haircap = limb(scene, 'joaoHair', 'sphere', {
        diameterX: 0.32,
        diameterY: 0.22,
        diameterZ: 0.32,
        segments: 10
    }, hair, head, 0.04);

    const hat = limb(scene, 'joaoHat', 'cylinder', {
        height: 0.1,
        diameterTop: 0.32,
        diameterBottom: 0.34,
        tessellation: 12
    }, cap, head, 0.16);

    const brim = limb(scene, 'joaoBrim', 'cylinder', {
        height: 0.03,
        diameter: 0.44,
        tessellation: 12
    }, cap, head, 0.12);

    // Braços
    [-1, 1].forEach((sx, i) => {
        const arm = new B.TransformNode(`joaoArm_${i}`, scene);
        arm.parent = torso;
        arm.position.set(sx * 0.22, 0.44, 0);

        limb(scene, `joaoArmMesh_${i}`, 'cylinder', {
            height: 0.34,
            diameterTop: 0.10,
            diameterBottom: 0.09,
            tessellation: 8
        }, skin, arm, -0.16);

        parts.arms.push(arm);
    });

    const resultParts = { ...parts, torso, head, hips, root };
    root.userData = { parts: resultParts };
    return { group: root, parts: resultParts };
}

export function buildMother(scene) {
    const root = new B.TransformNode('motherRoot', scene);
    const skin = std(scene, 0xe8b888, 0.7);
    const dress = std(scene, 0x6a3a78, 0.85);
    const apron = std(scene, 0xf0e4c8, 0.9);
    const hair = std(scene, 0x3a2414, 0.9);

    const skirt = limb(scene, 'motherSkirt', 'cylinder', {
        height: 0.85,
        diameterTop: 0.1,
        diameterBottom: 0.84,
        tessellation: 12
    }, dress, root, 0.42);

    const torso = limb(scene, 'motherTorso', 'cylinder', {
        height: 0.4,
        diameterTop: 0.36,
        diameterBottom: 0.44,
        tessellation: 10
    }, dress, root, 0.95);

    const ap = limb(scene, 'motherApron', 'box', {
        width: 0.32,
        height: 0.45,
        depth: 0.02
    }, apron, root, 0.72);
    ap.position.z = 0.22;

    const head = new B.TransformNode('motherHead', scene);
    head.parent = root;
    head.position.y = 1.28;

    limb(scene, 'motherSkull', 'sphere', {
        diameter: 0.32,
        segments: 12
    }, skin, head, 0);

    const bun = limb(scene, 'motherBun', 'sphere', {
        diameter: 0.18,
        segments: 8
    }, hair, head, 0.12);
    bun.position.z = -0.1;

    [-1, 1].forEach((sx, i) => {
        const eye = limb(scene, `motherEye_${i}`, 'sphere', {
            diameter: 0.044,
            segments: 6
        }, std(scene, 0x2a2018, 0.4), head, 0.02);
        eye.position.set(sx * 0.05, 0.02, 0.145);

        const arm = limb(scene, `motherArm_${i}`, 'cylinder', {
            height: 0.42,
            diameterTop: 0.10,
            diameterBottom: 0.09,
            tessellation: 8
        }, skin, root, 0.88);
        arm.position.set(sx * 0.26, 0.88, 0.05);
        arm.rotation.z = sx * 0.35;
    });

    return root;
}

export function buildMerchant(scene) {
    const root = new B.TransformNode('merchantRoot', scene);
    const robeTex = clothTexture(scene);
    const robe = std(scene, 0xc8a0e0, 0.82, 0.02, { map: robeTex });
    const skin = std(scene, 0xd4b08a, 0.7);
    const hatMat = std(scene, 0x3a1848, 0.7, 0.05);

    const cloak = limb(scene, 'merchantCloak', 'cylinder', {
        height: 1.35,
        diameterTop: 0.12,
        diameterBottom: 0.96,
        tessellation: 12
    }, robe, root, 0.68);

    const head = limb(scene, 'merchantHead', 'sphere', {
        diameter: 0.32,
        segments: 12
    }, skin, root, 1.42);

    const hat = limb(scene, 'merchantHat', 'cylinder', {
        height: 0.55,
        diameterTop: 0.02,
        diameterBottom: 0.44,
        tessellation: 10
    }, hatMat, root, 1.72);

    const brim = limb(scene, 'merchantBrim', 'cylinder', {
        height: 0.04,
        diameter: 0.64,
        tessellation: 12
    }, hatMat, root, 1.5);

    const beard = limb(scene, 'merchantBeard', 'cylinder', {
        height: 0.24,
        diameterTop: 0.20,
        diameterBottom: 0.02,
        tessellation: 8
    }, std(scene, 0xd8d0c0, 0.9), root, 1.28);
    beard.position.z = 0.12;
    beard.rotation.x = 0.4;

    const pouch = limb(scene, 'merchantPouch', 'sphere', {
        diameter: 0.24,
        segments: 8
    }, std(scene, 0x5a3a18, 0.85), root, 0.7);
    pouch.position.set(0.28, 0.7, 0.1);

    return root;
}

export function buildCow(scene) {
    const root = new B.TransformNode('cowRoot', scene);
    const hide = std(scene, 0xf2efe8, 0.85);
    const spot = std(scene, 0x5a3a22, 0.88);

    const body = limb(scene, 'cowBody', 'sphere', {
        diameterX: 1.2,
        diameterY: 0.75,
        diameterZ: 0.7,
        segments: 12
    }, hide, root, 0.55);

    const head = new B.TransformNode('cowHead', scene);
    head.parent = root;
    head.position.set(0, 0.72, 0.52);

    limb(scene, 'cowHeadMesh', 'sphere', {
        diameter: 0.44,
        segments: 10
    }, hide, head, 0);

    const snout = limb(scene, 'cowSnout', 'sphere', {
        diameterX: 0.26,
        diameterY: 0.17,
        diameterZ: 0.28,
        segments: 8
    }, std(scene, 0xe8c8b0, 0.8), head, -0.08);
    snout.position.z = 0.18;

    [-1, 1].forEach((sx, i) => {
        const horn = limb(scene, `cowHorn_${i}`, 'cylinder', {
            height: 0.14,
            diameterTop: 0.01,
            diameterBottom: 0.06,
            tessellation: 6
        }, std(scene, 0xf0e8d0, 0.5, 0.2), head, 0.20);
        horn.position.set(sx * 0.12, 0.20, -0.04);
        horn.rotation.z = sx * -0.4;

        const ear = limb(scene, `cowEar_${i}`, 'sphere', {
            diameterX: 0.07,
            diameterY: 0.14,
            diameterZ: 0.10,
            segments: 6
        }, hide, head, 0.08);
        ear.position.set(sx * 0.2, 0.08, -0.1);

        const eye = limb(scene, `cowEye_${i}`, 'sphere', {
            diameter: 0.06,
            segments: 6
        }, std(scene, 0x1a140e, 0.4), head, 0.06);
        eye.position.set(sx * 0.1, 0.06, 0.16);

        // Pernas
        const legF = limb(scene, `cowLegF_${i}`, 'cylinder', {
            height: 0.48,
            diameterTop: 0.14,
            diameterBottom: 0.11,
            tessellation: 6
        }, hide, root, 0.24);
        legF.position.set(sx * 0.22, 0.24, 0.18);

        const legB = limb(scene, `cowLegB_${i}`, 'cylinder', {
            height: 0.48,
            diameterTop: 0.14,
            diameterBottom: 0.11,
            tessellation: 6
        }, hide, root, 0.24);
        legB.position.set(sx * 0.22, 0.24, -0.22);

        const blot = limb(scene, `cowBlot_${i}`, 'sphere', {
            diameter: 0.32,
            segments: 8
        }, spot, root, 0.62);
        blot.position.set(sx * 0.28, 0.62, sx * 0.05);
    });

    const udder = limb(scene, 'cowUdder', 'sphere', {
        diameter: 0.24,
        segments: 8
    }, std(scene, 0xf0c8c0, 0.8), root, 0.28);
    udder.position.z = -0.05;

    const tail = limb(scene, 'cowTail', 'cylinder', {
        height: 0.4,
        diameterTop: 0.06,
        diameterBottom: 0.04,
        tessellation: 5
    }, hide, root, 0.55);
    tail.position.z = -0.48;
    tail.rotation.x = 0.6;

    root.userData = { parts: { head } };
    return root;
}

export function buildGiant(scene) {
    const root = new B.TransformNode('giantRoot', scene);
    const skin = std(scene, 0xc49a72, 0.72);
    const cloth = std(scene, 0x4a3020, 0.88);
    const hair = std(scene, 0x3a2010, 0.9);

    const hips = new B.TransformNode('giantHips', scene);
    hips.parent = root;

    const parts = { legs: [], arms: [] };

    // Pernas colossais
    [-1, 1].forEach((sx, i) => {
        const leg = new B.TransformNode(`giantLeg_${i}`, scene);
        leg.parent = hips;
        leg.position.set(sx * 0.55, 1.6, 0);

        limb(scene, `giantThigh_${i}`, 'cylinder', {
            height: 1.5,
            diameterTop: 0.64,
            diameterBottom: 0.52,
            tessellation: 8
        }, cloth, leg, -0.75);

        const boot = limb(scene, `giantBoot_${i}`, 'box', {
            width: 0.42,
            height: 0.28,
            depth: 0.7
        }, std(scene, 0x2a1810, 0.85), leg, -1.55);
        boot.position.z = 0.12;

        parts.legs.push(leg);
    });

    // Torso e Barriga
    const torso = new B.TransformNode('giantTorso', scene);
    torso.parent = hips;
    torso.position.y = 1.7;

    const belly = limb(scene, 'giantBelly', 'sphere', {
        diameterX: 2.2,
        diameterY: 1.8,
        diameterZ: 1.7,
        segments: 14
    }, cloth, torso, 1.15);

    const chest = limb(scene, 'giantChest', 'cylinder', {
        height: 1.1,
        diameterTop: 1.4,
        diameterBottom: 1.8,
        tessellation: 10
    }, cloth, torso, 1.7);

    // Cabeça
    const head = new B.TransformNode('giantHead', scene);
    head.parent = torso;
    head.position.y = 2.55;

    limb(scene, 'giantSkull', 'sphere', {
        diameter: 1.24,
        segments: 12
    }, skin, head, 0);

    const brow = limb(scene, 'giantBrow', 'box', {
        width: 0.9,
        height: 0.12,
        depth: 0.2
    }, hair, head, 0.18);
    brow.position.z = 0.48;

    const beard = limb(scene, 'giantBeard', 'cylinder', {
        height: 0.7,
        diameterTop: 0.7,
        diameterBottom: 0.05,
        tessellation: 8
    }, hair, head, -0.45);
    beard.position.z = 0.28;
    beard.rotation.x = 0.25;

    [-1, 1].forEach((sx, i) => {
        const eye = limb(scene, `giantEye_${i}`, 'sphere', {
            diameter: 0.18,
            segments: 8
        }, std(scene, 0xf0e8d8, 0.3), head, 0.08);
        eye.position.set(sx * 0.18, 0.08, 0.52);

        const iris = limb(scene, `giantIris_${i}`, 'sphere', {
            diameter: 0.08,
            segments: 6
        }, std(scene, 0x3a2010, 0.4), head, 0.06);
        iris.position.set(sx * 0.18, 0.06, 0.58);
    });

    const nose = limb(scene, 'giantNose', 'cylinder', {
        height: 0.28,
        diameterTop: 0.02,
        diameterBottom: 0.24,
        tessellation: 6
    }, skin, head, -0.02);
    nose.position.z = 0.62;
    nose.rotation.x = Math.PI / 2;

    // Braços
    [-1, 1].forEach((sx, i) => {
        const arm = new B.TransformNode(`giantArm_${i}`, scene);
        arm.parent = torso;
        arm.position.set(sx * 1.05, 2.0, 0);

        limb(scene, `giantArmMesh_${i}`, 'cylinder', {
            height: 1.5,
            diameterTop: 0.44,
            diameterBottom: 0.36,
            tessellation: 8
        }, skin, arm, -0.7);

        const fist = limb(scene, `giantFist_${i}`, 'sphere', {
            diameter: 0.44,
            segments: 8
        }, skin, arm, -1.5);

        parts.arms.push(arm);
    });

    // Clava de madeira na mão direita
    const club = limb(scene, 'giantClub', 'cylinder', {
        height: 2.2,
        diameterTop: 0.24,
        diameterBottom: 0.56,
        tessellation: 8
    }, std(scene, 0x5a3a18, 0.8), parts.arms[1], -1.4);
    club.position.set(0.15, -1.4, 0.3);
    club.rotation.z = 0.3;

    const resultParts = { ...parts, torso, head, hips, belly, club, root };
    root.userData = { parts: resultParts };
    return { group: root, parts: resultParts };
}

/* ------------------------------------------------------------------ */
/* Arquitetura e Cenários                                              */
/* ------------------------------------------------------------------ */

export function buildCottage(scene) {
    const root = new B.TransformNode('cottageRoot', scene);
    const wallTex = woodTexture(scene);
    const thatchTex = thatchTexture(scene);
    const wall = std(scene, 0xe8d2a8, 0.9, 0.02, { map: wallTex });
    const roofMat = std(scene, 0xc4a050, 0.95, 0.02, { map: thatchTex });

    const body = limb(scene, 'cottageBody', 'box', {
        width: 5.2,
        height: 2.6,
        depth: 4.2
    }, wall, root, 1.3);

    const roof = limb(scene, 'cottageRoof', 'cylinder', {
        height: 2.2,
        diameterTop: 0.2,
        diameterBottom: 5.9,
        tessellation: 4
    }, roofMat, root, 3.5);
    roof.rotation.y = Math.PI / 4;

    const door = limb(scene, 'cottageDoor', 'box', {
        width: 0.9,
        height: 1.5,
        depth: 0.12
    }, std(scene, 0x5a3218, 0.8), root, 0.75);
    door.position.z = 2.16;

    const knob = limb(scene, 'cottageKnob', 'sphere', {
        diameter: 0.1,
        segments: 6
    }, std(scene, 0xd4a020, 0.3, 0.8), root, 0.7);
    knob.position.set(0.32, 0.7, 2.24);

    [-1.4, 1.4].forEach((sx, i) => {
        const win = limb(scene, `cottageWin_${i}`, 'box', {
            width: 0.7,
            height: 0.7,
            depth: 0.08
        }, std(scene, 0x88c8e8, 0.3, 0.1, {
            emissive: 0xffcc66,
            emissiveIntensity: 0.35
        }), root, 1.55);
        win.position.set(sx, 1.55, 2.14);
    });

    const chimney = limb(scene, 'cottageChimney', 'box', {
        width: 0.55,
        height: 1.4,
        depth: 0.55
    }, std(scene, 0x8a7060, 0.9), root, 4.1);
    chimney.position.set(1.6, 4.1, -0.6);

    return root;
}

export function buildFence(scene, len = 6) {
    const root = new B.TransformNode('fenceRoot', scene);
    const wood = std(scene, 0x8a6a40, 0.88);
    const posts = Math.max(2, Math.round(len / 1.2));

    for (let i = 0; i < posts; i++) {
        const x = (i / (posts - 1) - 0.5) * len;
        const p = limb(scene, `fencePost_${i}`, 'box', {
            width: 0.12,
            height: 0.9,
            depth: 0.12
        }, wood, root, 0.45);
        p.position.set(x, 0.45, 0);
    }

    [0.28, 0.62].forEach((y, i) => {
        const rail = limb(scene, `fenceRail_${i}`, 'box', {
            width: len,
            height: 0.08,
            depth: 0.08
        }, wood, root, y);
    });

    return root;
}

export function buildTree(scene, rng = Math.random) {
    const root = new B.TransformNode('treeRoot', scene);
    const barkTex = barkTexture(scene);
    const leafTex = leafTexture(scene);

    const trunk = limb(scene, 'treeTrunk', 'cylinder', {
        height: 2.2,
        diameterTop: 0.36,
        diameterBottom: 0.56,
        tessellation: 8
    }, std(scene, 0x6a4a28, 0.92, 0.02, { map: barkTex }), root, 1.1);

    const leafMat = std(scene, 0x4aaa3a, 0.85, 0.02, { map: leafTex });

    for (let i = 0; i < 4; i++) {
        const s = limb(scene, `treeFoliage_${i}`, 'sphere', {
            diameter: (1.4 + rng() * 0.7),
            segments: 8
        }, leafMat, root, 2.2 + i * 0.35);
        s.position.set((rng() - 0.5) * 0.8, 2.2 + i * 0.35, (rng() - 0.5) * 0.8);
    }

    return root;
}

export function buildStall(scene, color = 0xc45a2a) {
    const root = new B.TransformNode('stallRoot', scene);
    const woodTex = woodTexture(scene);
    const wood = std(scene, 0x8a5a32, 0.88, 0.02, { map: woodTex });

    const table = limb(scene, 'stallTable', 'box', {
        width: 2.2,
        height: 0.12,
        depth: 1.1
    }, wood, root, 0.85);

    [-0.9, 0.9].forEach(sx => {
        [-0.4, 0.4].forEach(sz => {
            const leg = limb(scene, 'stallLeg', 'box', {
                width: 0.1,
                height: 0.85,
                depth: 0.1
            }, wood, root, 0.42);
            leg.position.set(sx, 0.42, sz);
        });
    });

    const cloth = limb(scene, 'stallCloth', 'box', {
        width: 2.4,
        height: 0.06,
        depth: 1.6
    }, std(scene, color, 0.85), root, 1.85);

    [-1.05, 1.05].forEach(sx => {
        const pole = limb(scene, 'stallPole', 'cylinder', {
            height: 2.0,
            diameter: 0.1,
            tessellation: 6
        }, wood, root, 1.0);
        pole.position.set(sx, 1.0, -0.5);
    });

    return root;
}

export function buildBeanstalk(scene, height = 78, quality = 'high') {
    const root = new B.TransformNode('beanstalkRoot', scene);
    const barkTex = barkTexture(scene);
    const leafTex = leafTexture(scene);

    const stemMat = std(scene, 0x3a8a32, 0.82, 0.04, { map: barkTex });
    const leafMat = std(scene, 0x4cba40, 0.78, 0.02, { map: leafTex, doubleSided: true });

    const twist = new B.TransformNode('beanstalkTwist', scene);
    twist.parent = root;

    const segs = quality === 'low' ? 10 : 18;
    for (let i = 0; i < segs; i++) {
        const y = (i / segs) * height;
        const segHeight = height / segs + 0.4;
        const vine = limb(scene, `stalkVine_${i}`, 'cylinder', {
            height: segHeight,
            diameterTop: 1.1,
            diameterBottom: 1.4,
            tessellation: 8
        }, stemMat, twist, y + segHeight * 0.5);
        vine.rotation.y = i * 0.45;
        vine.rotation.z = 0.08;

        const tendril = limb(scene, `stalkTendril_${i}`, 'cylinder', {
            height: 0.24,
            diameterTop: 1.7,
            diameterBottom: 1.7,
            tessellation: 8
        }, stemMat, twist, y + 1.2);
        tendril.rotation.z = i * 0.7;
    }

    const platforms = [];
    const count = quality === 'low' ? 12 : 18;
    for (let i = 0; i < count; i++) {
        const y = 3.2 + i * (height - 10) / count;
        const a = i * 0.92;
        const r = 3.15;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;

        const pad = limb(scene, `stalkPad_${i}`, 'cylinder', {
            height: 0.18,
            diameterTop: 2.7,
            diameterBottom: 2.9,
            tessellation: 10
        }, leafMat, root, y - 0.08);
        pad.position.set(x, y - 0.08, z);

        platforms.push({ x, y, z, r: 1.45 });
    }

    const flower = limb(scene, 'stalkFlower', 'cylinder', {
        height: 2.2,
        diameterTop: 0.2,
        diameterBottom: 2.8,
        tessellation: 8
    }, std(scene, 0x7a3aaa, 0.6, 0.05, {
        emissive: 0x5a2088,
        emissiveIntensity: 0.45
    }), root, height + 0.4);

    return { group: root, platforms, height };
}

export function buildCloudIsland(scene, radius = 28) {
    const root = new B.TransformNode('cloudIslandRoot', scene);
    const cloudTex = cloudTexture(scene);
    const cloudMat = std(scene, 0xf4f8fc, 0.92, 0.02, { map: cloudTex });

    const top = limb(scene, 'cloudTop', 'cylinder', {
        height: 2.2,
        diameterTop: radius * 2,
        diameterBottom: radius * 1.84,
        tessellation: 24
    }, cloudMat, root, 0);

    for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const puff = limb(scene, `cloudPuff_${i}`, 'sphere', {
            diameterX: 8 + (i % 3) * 2.8,
            diameterY: 4 + (i % 3) * 1.4,
            diameterZ: 8 + (i % 3) * 2.8,
            segments: 8
        }, cloudMat, root, -1.2);
        puff.position.set(Math.cos(a) * (radius * 0.82), -1.2, Math.sin(a) * (radius * 0.82));
    }

    return root;
}

export function buildCastle(scene) {
    const root = new B.TransformNode('castleRoot', scene);
    const stoneTex = stoneTexture(scene);
    const stone = std(scene, 0xb8c0c8, 0.9, 0.05, { map: stoneTex });
    const roofMat = std(scene, 0x5a2a68, 0.7, 0.05);

    const keep = limb(scene, 'castleKeep', 'box', {
        width: 16,
        height: 10,
        depth: 14
    }, stone, root, 5);

    const hall = limb(scene, 'castleHall', 'box', {
        width: 10,
        height: 6,
        depth: 12
    }, stone, root, 3);
    hall.position.z = 10;

    [
        [-7, -6], [7, -6], [-7, 6], [7, 6], [-4, 15], [4, 15]
    ].forEach(([x, z], i) => {
        const t = limb(scene, `castleTower_${i}`, 'cylinder', {
            height: 14,
            diameterTop: 2.8,
            diameterBottom: 3.2,
            tessellation: 10
        }, stone, root, 7);
        t.position.set(x, 7, z);

        const cap = limb(scene, `castleCap_${i}`, 'cylinder', {
            height: 2.4,
            diameterTop: 0.2,
            diameterBottom: 3.6,
            tessellation: 8
        }, roofMat, root, 15.1);
        cap.position.set(x, 15.1, z);
    });

    const door = limb(scene, 'castleDoor', 'box', {
        width: 3.2,
        height: 4.4,
        depth: 0.4
    }, std(scene, 0x3a2414, 0.8), root, 2.2);
    door.position.z = 16.1;

    return root;
}

export function buildTable(scene) {
    const root = new B.TransformNode('tableRoot', scene);
    const woodTex = woodTexture(scene);
    const wood = std(scene, 0x8a5a32, 0.75, 0.04, { map: woodTex });

    const top = limb(scene, 'tableTop', 'box', {
        width: 8,
        height: 0.35,
        depth: 4.2
    }, wood, root, 1.8);

    [-3.4, 3.4].forEach(sx => {
        [-1.6, 1.6].forEach(sz => {
            const leg = limb(scene, 'tableLeg', 'box', {
                width: 0.28,
                height: 1.8,
                depth: 0.28
            }, wood, root, 0.9);
            leg.position.set(sx, 0.9, sz);
        });
    });

    return root;
}

export function buildGoldBag(scene) {
    const root = new B.TransformNode('goldBagRoot', scene);
    const goldTex = goldTexture(scene);
    const goldMat = std(scene, 0xc4a030, 0.45, 0.65, {
        map: goldTex,
        emissive: 0xaa7700,
        emissiveIntensity: 0.4
    });

    const bag = limb(scene, 'goldBagMesh', 'sphere', {
        diameterX: 0.76,
        diameterY: 0.88,
        diameterZ: 0.76,
        segments: 10
    }, goldMat, root, 0);

    const neck = limb(scene, 'goldBagNeck', 'cylinder', {
        height: 0.22,
        diameterTop: 0.24,
        diameterBottom: 0.36,
        tessellation: 8
    }, std(scene, 0x8a6a20, 0.6, 0.4), root, 0.42);

    return root;
}

export function buildHen(scene) {
    const root = new B.TransformNode('henRoot', scene);
    const goldTex = goldTexture(scene);
    const gold = std(scene, 0xffe080, 0.32, 0.75, {
        map: goldTex,
        emissive: 0xaa7700,
        emissiveIntensity: 0.35
    });

    const body = limb(scene, 'henBody', 'sphere', {
        diameterX: 0.64,
        diameterY: 0.50,
        diameterZ: 0.56,
        segments: 10
    }, gold, root, 0.28);

    const head = limb(scene, 'henHead', 'sphere', {
        diameter: 0.28,
        segments: 8
    }, gold, root, 0.48);
    head.position.x = 0.22;

    const beak = limb(scene, 'henBeak', 'cylinder', {
        height: 0.12,
        diameterTop: 0.01,
        diameterBottom: 0.08,
        tessellation: 6
    }, std(scene, 0xffaa33, 0.4, 0.5), root, 0.46);
    beak.position.x = 0.36;
    beak.rotation.z = -Math.PI / 2;

    const comb = limb(scene, 'henComb', 'sphere', {
        diameter: 0.12,
        segments: 6
    }, std(scene, 0xff6644, 0.5), root, 0.62);
    comb.position.x = 0.2;

    [-1, 1].forEach(sx => {
        const wing = limb(scene, 'henWing', 'sphere', {
            diameterX: 0.28,
            diameterY: 0.20,
            diameterZ: 0.08,
            segments: 8
        }, gold, root, 0.3);
        wing.position.set(-0.05, 0.3, sx * 0.22);
    });

    return root;
}

export function buildHarp(scene) {
    const root = new B.TransformNode('harpRoot', scene);
    const goldTex = goldTexture(scene);
    const gold = std(scene, 0xffe080, 0.28, 0.8, {
        map: goldTex,
        emissive: 0xaa8800,
        emissiveIntensity: 0.45
    });

    const frame = limb(scene, 'harpFrame', 'torus', {
        diameter: 1.1,
        thickness: 0.14,
        tessellation: 16
    }, gold, root, 0.55);
    frame.rotation.y = Math.PI / 2;

    const pillar = limb(scene, 'harpPillar', 'cylinder', {
        height: 1.15,
        diameter: 0.1,
        tessellation: 8
    }, gold, root, 0.55);
    pillar.position.x = 0.55;

    const base = limb(scene, 'harpBase', 'box', {
        width: 0.7,
        height: 0.1,
        depth: 0.22
    }, gold, root, 0.05);

    for (let i = 0; i < 7; i++) {
        const s = limb(scene, `harpString_${i}`, 'cylinder', {
            height: 0.7 + i * 0.05,
            diameter: 0.016,
            tessellation: 4
        }, std(scene, 0xfff8d0, 0.4, 0.1, {
            emissive: 0xffeedd,
            emissiveIntensity: 0.5
        }), root, 0.5);
        s.position.x = -0.2 + i * 0.1;
    }

    return root;
}

export function buildAxe(scene) {
    const root = new B.TransformNode('axeRoot', scene);
    const handle = limb(scene, 'axeHandle', 'cylinder', {
        height: 1.1,
        diameterTop: 0.08,
        diameterBottom: 0.1,
        tessellation: 8
    }, std(scene, 0x6a3a18, 0.8), root, 0.55);

    const head = limb(scene, 'axeHead', 'box', {
        width: 0.45,
        height: 0.28,
        depth: 0.08
    }, std(scene, 0xc8d0d8, 0.35, 0.7), root, 1.05);
    head.position.x = 0.18;

    return root;
}

export function buildWell(scene) {
    const root = new B.TransformNode('wellRoot', scene);
    const stoneTex = stoneTexture(scene);
    const stone = std(scene, 0x8a9098, 0.9, 0.04, { map: stoneTex });

    const ring = limb(scene, 'wellRing', 'cylinder', {
        height: 0.7,
        diameterTop: 1.7,
        diameterBottom: 1.9,
        tessellation: 12
    }, stone, root, 0.35);

    const water = limb(scene, 'wellWater', 'cylinder', {
        height: 0.02,
        diameter: 1.4,
        tessellation: 12
    }, std(scene, 0x3a88aa, 0.2, 0.3, {
        alpha: 0.75
    }), root, 0.42);

    return root;
}

export function buildGateArch(scene) {
    const root = new B.TransformNode('gateArchRoot', scene);
    const wood = std(scene, 0x6a3e1c, 0.85);

    [-1.6, 1.6].forEach(sx => {
        const post = limb(scene, 'gatePost', 'box', {
            width: 0.28,
            height: 3.4,
            depth: 0.28
        }, wood, root, 1.7);
        post.position.set(sx, 1.7, 0);
    });

    const bar = limb(scene, 'gateBar', 'box', {
        width: 3.6,
        height: 0.28,
        depth: 0.28
    }, wood, root, 3.25);

    const sign = limb(scene, 'gateSign', 'box', {
        width: 1.6,
        height: 0.55,
        depth: 0.08
    }, std(scene, 0xc4a050, 0.7), root, 3.7);

    const glow = limb(scene, 'gateGlow', 'cylinder', {
        height: 0.12,
        diameterTop: 1.8,
        diameterBottom: 2.2,
        tessellation: 16
    }, std(scene, 0xffee88, 0.4, 0.1, {
        alpha: 0.6,
        emissive: 0xffee88,
        emissiveIntensity: 0.6
    }), root, 0.08);

    return root;
}

export function makeBeacon(scene, colorHex = 0xaaff66) {
    const beacon = B.MeshBuilder.CreateCylinder('beacon', {
        height: 8.5,
        diameterTop: 0.36,
        diameterBottom: 1.1,
        tessellation: 8
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

