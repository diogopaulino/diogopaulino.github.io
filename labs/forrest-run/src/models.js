/**
 * Modelos 3D com materiais PBR de alta fidelidade para Babylon.js:
 * - Forrest Gump (camisa xadrez vintage, calça cáqui, tênis Nike Cortez, boné Bubba Gump)
 * - Seguidores com roupas de corrida retrô
 * - Árvores (Carvalhos do Alabama com musgo, Pinheiros das Rochosas, Cactos Saguaro)
 * - Cenários (Casas, Celeiros, Mesas do Deserto, Placas da Rota 61, Cercas, Postes)
 * - Obstáculos (Caminhão 70s, Fardos de Feno, Caixotes, Vacas Malhadas, Cones)
 * - Pena flutuante com brilho especular
 */

import {
    createPlaidTexture, createCortezTexture, createBubbaCapTexture,
    createBarkTexture, createSignTexture, createFeatherTexture
} from './textures.js';
import { hexToColor3 } from './utils.js';

const matCache = new Map();

function pbrMat(scene, key, colorHex, roughness = 0.8, metallic = 0.05, extra = {}) {
    const fullKey = `${key}_${colorHex}_${roughness}_${metallic}_${JSON.stringify(extra)}`;
    if (matCache.has(fullKey)) return matCache.get(fullKey);

    const mat = new BABYLON.PBRMaterial(fullKey, scene);
    mat.albedoColor = typeof colorHex === 'number' ? hexToColor3(colorHex) : colorHex;
    mat.roughness = roughness;
    mat.metallic = metallic;
    mat.useRoughnessFromMetallicTextureAlpha = false;
    mat.useRoughnessFromMetallicTextureGreen = true;
    mat.useMetallnessFromMetallicTextureBlue = true;

    if (extra.emissiveColor) mat.emissiveColor = extra.emissiveColor;
    if (extra.albedoTexture) mat.albedoTexture = extra.albedoTexture;
    if (extra.bumpTexture) mat.bumpTexture = extra.bumpTexture;
    if (extra.alpha !== undefined) mat.alpha = extra.alpha;
    if (extra.transparencyMode !== undefined) mat.transparencyMode = extra.transparencyMode;

    matCache.set(fullKey, mat);
    return mat;
}

function registerShadows(mesh, shadowGenerator) {
    if (!mesh) return;
    mesh.receiveShadows = true;
    if (shadowGenerator) {
        shadowGenerator.addShadowCaster(mesh, true);
    }
}

/**
 * Cria o personagem de Forrest Gump em escala realista (1.80m)
 * com articulações hierárquicas e texturas autênticas de cinema.
 */
export function createForrest(scene, shadowGenerator = null, { follower = false } = {}) {
    const root = new BABYLON.TransformNode(follower ? 'followerRoot' : 'forrestRoot', scene);

    // Materiais PBR
    const skinMat = pbrMat(scene, 'skin', follower ? 0xdca07c : 0xf2cbb0, 0.68, 0.02);
    const hairMat = pbrMat(scene, 'hair', follower ? 0x3d2818 : 0xdfbe72, 0.88, 0.04);
    const khakiMat = pbrMat(scene, 'khaki', follower ? 0x3d4e68 : 0xcab57e, 0.82, 0.02);
    const beltMat = pbrMat(scene, 'belt', 0x3a2414, 0.6, 0.1);
    const buckleMat = pbrMat(scene, 'buckle', 0xd8b040, 0.35, 0.85);

    let shirtMat;
    if (follower) {
        shirtMat = pbrMat(scene, 'followerShirt', follower ? 0xb03434 : 0x2d68b0, 0.8, 0.05);
    } else {
        shirtMat = pbrMat(scene, 'forrestShirt', 0xffffff, 0.78, 0.02, {
            albedoTexture: createPlaidTexture(scene)
        });
    }

    const shoeMat = follower
        ? pbrMat(scene, 'followerShoe', 0x303236, 0.7, 0.1)
        : pbrMat(scene, 'cortezShoe', 0xffffff, 0.55, 0.05, {
            albedoTexture: createCortezTexture(scene)
        });

    const capMat = pbrMat(scene, 'bubbaCap', 0xffffff, 0.65, 0.05, {
        albedoTexture: createBubbaCapTexture(scene)
    });

    // 1. Quadris (Hips)
    const hips = new BABYLON.TransformNode('hips', scene);
    hips.parent = root;
    hips.position.y = 0.95;

    const hipsMesh = BABYLON.MeshBuilder.CreateBox('hipsMesh', { width: 0.38, height: 0.22, depth: 0.24 }, scene);
    hipsMesh.material = khakiMat;
    hipsMesh.parent = hips;
    registerShadows(hipsMesh, shadowGenerator);

    // Cinto
    const beltMesh = BABYLON.MeshBuilder.CreateBox('beltMesh', { width: 0.39, height: 0.05, depth: 0.25 }, scene);
    beltMesh.position.y = 0.09;
    beltMesh.material = beltMat;
    beltMesh.parent = hips;

    const buckle = BABYLON.MeshBuilder.CreateBox('buckle', { width: 0.08, height: 0.06, depth: 0.26 }, scene);
    buckle.position.set(0, 0.09, -0.01);
    buckle.material = buckleMat;
    buckle.parent = hips;

    // 2. Pernas e Tênis Cortez
    const legs = [];
    for (const sx of [-1, 1]) {
        const leg = new BABYLON.TransformNode(sx < 0 ? 'leftLeg' : 'rightLeg', scene);
        leg.parent = hips;
        leg.position.set(sx * 0.11, -0.08, 0);

        // Coxa
        const thigh = BABYLON.MeshBuilder.CreateCylinder('thigh', {
            height: 0.44,
            diameterTop: 0.15,
            diameterBottom: 0.13,
            tessellation: 12
        }, scene);
        thigh.position.y = -0.22;
        thigh.material = khakiMat;
        thigh.parent = leg;
        registerShadows(thigh, shadowGenerator);

        // Canela / Joelho
        const shin = new BABYLON.TransformNode('shin', scene);
        shin.parent = leg;
        shin.position.y = -0.44;

        const calf = BABYLON.MeshBuilder.CreateCylinder('calf', {
            height: 0.42,
            diameterTop: 0.13,
            diameterBottom: 0.11,
            tessellation: 12
        }, scene);
        calf.position.y = -0.21;
        calf.material = khakiMat;
        calf.parent = shin;
        registerShadows(calf, shadowGenerator);

        // Pé com Tênis Cortez detalhado
        const foot = new BABYLON.TransformNode('foot', scene);
        foot.parent = shin;
        foot.position.set(0, -0.42, 0.05);

        const shoe = BABYLON.MeshBuilder.CreateBox('shoe', {
            width: 0.14,
            height: 0.11,
            depth: 0.32
        }, scene);
        shoe.position.set(0, 0.02, 0.04);
        shoe.material = shoeMat;
        shoe.parent = foot;
        registerShadows(shoe, shadowGenerator);

        legs.push({ leg, shin, foot });
    }

    // 3. Torso e Camisa
    const torso = new BABYLON.TransformNode('torso', scene);
    torso.parent = hips;
    torso.position.y = 0.12;

    const chest = BABYLON.MeshBuilder.CreateBox('chest', {
        width: 0.46,
        height: 0.54,
        depth: 0.26
    }, scene);
    chest.position.y = 0.27;
    chest.material = shirtMat;
    chest.parent = torso;
    registerShadows(chest, shadowGenerator);

    // Colarinho aberto
    const collar = BABYLON.MeshBuilder.CreateBox('collar', {
        width: 0.22,
        height: 0.08,
        depth: 0.2
    }, scene);
    collar.position.set(0, 0.54, 0);
    collar.material = shirtMat;
    collar.parent = torso;

    // 4. Cabeça, Rosto e Boné Bubba Gump
    const head = new BABYLON.TransformNode('head', scene);
    head.parent = torso;
    head.position.y = 0.62;

    const neck = BABYLON.MeshBuilder.CreateCylinder('neck', {
        height: 0.14,
        diameter: 0.14,
        tessellation: 12
    }, scene);
    neck.position.y = -0.04;
    neck.material = skinMat;
    neck.parent = head;

    const face = BABYLON.MeshBuilder.CreateSphere('face', {
        diameterX: 0.22,
        diameterY: 0.26,
        diameterZ: 0.24,
        segments: 14
    }, scene);
    face.position.set(0, 0.14, 0);
    face.material = skinMat;
    face.parent = head;
    registerShadows(face, shadowGenerator);

    // Cabelo corte militar curto
    const hair = BABYLON.MeshBuilder.CreateSphere('hair', {
        diameterX: 0.23,
        diameterY: 0.14,
        diameterZ: 0.24,
        segments: 12
    }, scene);
    hair.position.set(0, 0.24, -0.01);
    hair.material = hairMat;
    hair.parent = head;

    // Olhos e Sobrancelha
    for (const sx of [-1, 1]) {
        const eyeWhite = BABYLON.MeshBuilder.CreateSphere('eyeWhite', { diameter: 0.04, segments: 8 }, scene);
        eyeWhite.position.set(sx * 0.055, 0.16, -0.11);
        eyeWhite.material = pbrMat(scene, 'eyeWhite', 0xf8f8f8, 0.3, 0.05);
        eyeWhite.parent = head;

        const eyePupil = BABYLON.MeshBuilder.CreateSphere('eyePupil', { diameter: 0.022, segments: 8 }, scene);
        eyePupil.position.set(sx * 0.055, 0.16, -0.125);
        eyePupil.material = pbrMat(scene, 'eyePupil', 0x221810, 0.2, 0.1);
        eyePupil.parent = head;
    }

    // Boné vermelho Bubba Gump (no Forrest)
    if (!follower) {
        const capCrown = BABYLON.MeshBuilder.CreateSphere('capCrown', {
            diameterX: 0.24,
            diameterY: 0.18,
            diameterZ: 0.25,
            segments: 14
        }, scene);
        capCrown.position.set(0, 0.25, -0.01);
        capCrown.material = capMat;
        capCrown.parent = head;

        const capVisor = BABYLON.MeshBuilder.CreateBox('capVisor', {
            width: 0.22,
            height: 0.03,
            depth: 0.16
        }, scene);
        capVisor.position.set(0, 0.22, -0.16);
        capVisor.rotation.x = 0.15;
        capVisor.material = pbrMat(scene, 'capVisor', 0xb81e1e, 0.7, 0.05);
        capVisor.parent = head;
        registerShadows(capVisor, shadowGenerator);
    }

    // 5. Braços
    const arms = [];
    for (const sx of [-1, 1]) {
        const arm = new BABYLON.TransformNode(sx < 0 ? 'leftArm' : 'rightArm', scene);
        arm.parent = torso;
        arm.position.set(sx * 0.28, 0.48, 0);

        // Ombro / Braço
        const upperArm = BABYLON.MeshBuilder.CreateCylinder('upperArm', {
            height: 0.34,
            diameterTop: 0.13,
            diameterBottom: 0.11,
            tessellation: 12
        }, scene);
        upperArm.position.y = -0.14;
        upperArm.material = shirtMat;
        upperArm.parent = arm;
        registerShadows(upperArm, shadowGenerator);

        // Antebraço
        const forearm = new BABYLON.TransformNode('forearm', scene);
        forearm.parent = arm;
        forearm.position.y = -0.32;

        const armSkin = BABYLON.MeshBuilder.CreateCylinder('armSkin', {
            height: 0.32,
            diameterTop: 0.11,
            diameterBottom: 0.09,
            tessellation: 12
        }, scene);
        armSkin.position.y = -0.14;
        armSkin.material = skinMat;
        armSkin.parent = forearm;
        registerShadows(armSkin, shadowGenerator);

        // Mão
        const hand = BABYLON.MeshBuilder.CreateSphere('hand', {
            diameterX: 0.09,
            diameterY: 0.11,
            diameterZ: 0.09,
            segments: 8
        }, scene);
        hand.position.set(0, -0.32, 0);
        hand.material = skinMat;
        hand.parent = forearm;

        arms.push({ arm, forearm, hand });
    }

    root.metadata = {
        parts: { hips, torso, head, legs, arms },
        follower
    };

    return root;
}

/**
 * Árvores de alta fidelidade botânica:
 * - Oak: Carvalho secular do Sul com copa densa e galhos fortes.
 * - Pine: Pinheiro das Montanhas Rochosas com agulhas finas.
 * - Cactus: Saguaro clássico do deserto do Arizona.
 */
export function createTree(scene, shadowGenerator, kind = 'oak') {
    const root = new BABYLON.TransformNode(`tree_${kind}`, scene);
    const barkMat = pbrMat(scene, 'treeBark', 0x5a3e26, 0.94, 0.02, {
        albedoTexture: createBarkTexture(scene)
    });

    if (kind === 'pine') {
        const needleMat = pbrMat(scene, 'pineNeedle', 0x244e26, 0.85, 0.02);

        // Tronco
        const trunk = BABYLON.MeshBuilder.CreateCylinder('pineTrunk', {
            height: 4.8,
            diameterTop: 0.22,
            diameterBottom: 0.44,
            tessellation: 10
        }, scene);
        trunk.position.y = 2.4;
        trunk.material = barkMat;
        trunk.parent = root;
        registerShadows(trunk, shadowGenerator);

        // 3 Camadas de Folhagem Cônica
        const tiers = [
            { y: 3.2, d: 2.8, h: 2.2 },
            { y: 4.6, d: 2.2, h: 2.0 },
            { y: 5.8, d: 1.4, h: 1.8 }
        ];
        for (const t of tiers) {
            const cone = BABYLON.MeshBuilder.CreateCylinder('pineCone', {
                height: t.h,
                diameterTop: 0.05,
                diameterBottom: t.d,
                tessellation: 10
            }, scene);
            cone.position.y = t.y;
            cone.material = needleMat;
            cone.parent = root;
            registerShadows(cone, shadowGenerator);
        }
    } else if (kind === 'cactus') {
        const cactusMat = pbrMat(scene, 'cactusMat', 0x487e44, 0.72, 0.04);

        const mainStem = BABYLON.MeshBuilder.CreateCylinder('cactusStem', {
            height: 4.2,
            diameterTop: 0.44,
            diameterBottom: 0.48,
            tessellation: 12
        }, scene);
        mainStem.position.y = 2.1;
        mainStem.material = cactusMat;
        mainStem.parent = root;
        registerShadows(mainStem, shadowGenerator);

        // Braço esquerdo
        const armL1 = BABYLON.MeshBuilder.CreateCylinder('cactusArmL1', { height: 0.8, diameter: 0.28, tessellation: 10 }, scene);
        armL1.rotation.z = Math.PI / 2;
        armL1.position.set(-0.55, 2.2, 0);
        armL1.material = cactusMat;
        armL1.parent = root;

        const armL2 = BABYLON.MeshBuilder.CreateCylinder('cactusArmL2', { height: 1.4, diameter: 0.28, tessellation: 10 }, scene);
        armL2.position.set(-0.95, 2.8, 0);
        armL2.material = cactusMat;
        armL2.parent = root;
        registerShadows(armL2, shadowGenerator);

        // Braço direito
        const armR1 = BABYLON.MeshBuilder.CreateCylinder('cactusArmR1', { height: 0.8, diameter: 0.28, tessellation: 10 }, scene);
        armR1.rotation.z = Math.PI / 2;
        armR1.position.set(0.55, 2.7, 0);
        armR1.material = cactusMat;
        armR1.parent = root;

        const armR2 = BABYLON.MeshBuilder.CreateCylinder('cactusArmR2', { height: 1.1, diameter: 0.28, tessellation: 10 }, scene);
        armR2.position.set(0.95, 3.1, 0);
        armR2.material = cactusMat;
        armR2.parent = root;
        registerShadows(armR2, shadowGenerator);
    } else {
        // Carvalho do Alabama (Oak)
        const leafMat = pbrMat(scene, 'oakLeaf', 0x3d7028, 0.88, 0.02);

        const trunk = BABYLON.MeshBuilder.CreateCylinder('oakTrunk', {
            height: 3.4,
            diameterTop: 0.42,
            diameterBottom: 0.68,
            tessellation: 12
        }, scene);
        trunk.position.y = 1.7;
        trunk.material = barkMat;
        trunk.parent = root;
        registerShadows(trunk, shadowGenerator);

        // Copas arredondadas e volumosas
        const clusters = [
            { x: 0, y: 3.8, z: 0, dx: 3.2, dy: 2.2, dz: 3.2 },
            { x: -0.9, y: 3.4, z: 0.6, dx: 2.2, dy: 1.8, dz: 2.0 },
            { x: 1.1, y: 3.6, z: -0.5, dx: 2.4, dy: 1.9, dz: 2.2 },
            { x: 0.2, y: 4.6, z: -0.4, dx: 2.0, dy: 1.6, dz: 2.0 }
        ];

        for (const c of clusters) {
            const canopy = BABYLON.MeshBuilder.CreateSphere('canopy', {
                diameterX: c.dx,
                diameterY: c.dy,
                diameterZ: c.dz,
                segments: 10
            }, scene);
            canopy.position.set(c.x, c.y, c.z);
            canopy.material = leafMat;
            canopy.parent = root;
            registerShadows(canopy, shadowGenerator);
        }
    }

    return root;
}

/**
 * Casa de Campo do Alabama (Estilo Fazenda Sulista)
 */
export function createHouse(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('farmHouse', scene);
    const wallMat = pbrMat(scene, 'houseWall', 0xf0ece2, 0.9, 0.02);
    const roofMat = pbrMat(scene, 'houseRoof', 0x7e2a26, 0.75, 0.05);
    const woodMat = pbrMat(scene, 'houseWood', 0x5a3e26, 0.85, 0.02);
    const windowMat = pbrMat(scene, 'houseGlass', 0x88c4e0, 0.25, 0.3);

    // Paredes
    const walls = BABYLON.MeshBuilder.CreateBox('walls', { width: 5.4, height: 3.2, depth: 4.2 }, scene);
    walls.position.y = 1.6;
    walls.material = wallMat;
    walls.parent = root;
    registerShadows(walls, shadowGenerator);

    // Telhado
    const roof = BABYLON.MeshBuilder.CreateCylinder('roof', {
        height: 6.0,
        diameter: 4.8,
        tessellation: 3
    }, scene);
    roof.rotation.z = Math.PI / 2;
    roof.position.y = 4.2;
    roof.material = roofMat;
    roof.parent = root;
    registerShadows(roof, shadowGenerator);

    // Varanda frontal
    const porch = BABYLON.MeshBuilder.CreateBox('porch', { width: 4.2, height: 0.2, depth: 1.4 }, scene);
    porch.position.set(0, 0.1, 2.6);
    porch.material = woodMat;
    porch.parent = root;

    // Colunas da varanda
    for (const x of [-1.8, 0, 1.8]) {
        const post = BABYLON.MeshBuilder.CreateCylinder('post', { height: 2.6, diameter: 0.14 }, scene);
        post.position.set(x, 1.4, 3.2);
        post.material = wallMat;
        post.parent = root;
        registerShadows(post, shadowGenerator);
    }

    // Janelas e Porta
    const door = BABYLON.MeshBuilder.CreateBox('door', { width: 0.85, height: 1.8, depth: 0.1 }, scene);
    door.position.set(0, 1.0, 2.15);
    door.material = woodMat;
    door.parent = root;

    for (const x of [-1.6, 1.6]) {
        const win = BABYLON.MeshBuilder.CreateBox('window', { width: 0.9, height: 0.9, depth: 0.1 }, scene);
        win.position.set(x, 1.8, 2.15);
        win.material = windowMat;
        win.parent = root;
    }

    return root;
}

/**
 * Celeiro Vermelho Clássico
 */
export function createBarn(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('barn', scene);
    const redMat = pbrMat(scene, 'barnRed', 0x9a2620, 0.88, 0.02);
    const roofMat = pbrMat(scene, 'barnRoof', 0x48464a, 0.7, 0.05);

    const body = BABYLON.MeshBuilder.CreateBox('barnBody', { width: 6.4, height: 4.2, depth: 5.2 }, scene);
    body.position.y = 2.1;
    body.material = redMat;
    body.parent = root;
    registerShadows(body, shadowGenerator);

    const roof = BABYLON.MeshBuilder.CreateCylinder('barnRoofMesh', { height: 7.0, diameter: 5.8, tessellation: 3 }, scene);
    roof.rotation.z = Math.PI / 2;
    roof.position.y = 5.2;
    roof.material = roofMat;
    roof.parent = root;
    registerShadows(roof, shadowGenerator);

    return root;
}

/**
 * Mesa do Deserto (Sandstone Butte)
 */
export function createMesa(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('mesa', scene);
    const rockMat = pbrMat(scene, 'mesaRock', 0xba6a38, 0.92, 0.02);
    const topMat = pbrMat(scene, 'mesaTop', 0xd48a52, 0.88, 0.02);

    const base = BABYLON.MeshBuilder.CreateCylinder('mesaBase', {
        height: 8.5,
        diameterTop: 6.2,
        diameterBottom: 8.4,
        tessellation: 12
    }, scene);
    base.position.y = 4.25;
    base.material = rockMat;
    base.parent = root;
    registerShadows(base, shadowGenerator);

    const cap = BABYLON.MeshBuilder.CreateCylinder('mesaCap', {
        height: 0.8,
        diameterTop: 6.8,
        diameterBottom: 6.8,
        tessellation: 12
    }, scene);
    cap.position.y = 8.8;
    cap.material = topMat;
    cap.parent = root;
    registerShadows(cap, shadowGenerator);

    return root;
}

/**
 * Placa de Rodovia e Billboard
 */
export function createBillboard(scene, shadowGenerator, title = 'BUBBA GUMP', sub = 'SHRIMP CO.') {
    const root = new BABYLON.TransformNode('billboard', scene);
    const woodMat = pbrMat(scene, 'signPostWood', 0x4a3220, 0.9, 0.02);

    for (const x of [-1.8, 1.8]) {
        const post = BABYLON.MeshBuilder.CreateCylinder('post', { height: 4.4, diameter: 0.16 }, scene);
        post.position.set(x, 2.2, 0);
        post.material = woodMat;
        post.parent = root;
        registerShadows(post, shadowGenerator);
    }

    const boardMat = pbrMat(scene, `signMat_${title}_${sub}`, 0xffffff, 0.65, 0.05, {
        albedoTexture: createSignTexture(scene, title, sub)
    });

    const board = BABYLON.MeshBuilder.CreatePlane('signBoard', { width: 4.4, height: 2.2 }, scene);
    board.position.set(0, 3.4, -0.1);
    board.material = boardMat;
    board.parent = root;
    registerShadows(board, shadowGenerator);

    return root;
}

/**
 * Caminhão Americano Anos 70 (Obstáculo Alto)
 */
export function createTruck(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('truck', scene);
    const paintMat = pbrMat(scene, 'truckPaint', 0xb83824, 0.45, 0.25);
    const chromeMat = pbrMat(scene, 'truckChrome', 0xe8e8e8, 0.2, 0.95);
    const glassMat = pbrMat(scene, 'truckGlass', 0x88c4e0, 0.2, 0.35);
    const tireMat = pbrMat(scene, 'truckTire', 0x1a1a1c, 0.85, 0.05);

    // Carroceria / Cabine
    const cab = BABYLON.MeshBuilder.CreateBox('cab', { width: 2.2, height: 1.3, depth: 1.8 }, scene);
    cab.position.set(0, 1.75, -0.7);
    cab.material = paintMat;
    cab.parent = root;
    registerShadows(cab, shadowGenerator);

    const bed = BABYLON.MeshBuilder.CreateBox('bed', { width: 2.2, height: 1.0, depth: 2.6 }, scene);
    bed.position.set(0, 1.25, 1.2);
    bed.material = paintMat;
    bed.parent = root;
    registerShadows(bed, shadowGenerator);

    // Para-brisa
    const windshield = BABYLON.MeshBuilder.CreateBox('windshield', { width: 2.0, height: 0.65, depth: 0.08 }, scene);
    windshield.position.set(0, 1.85, -1.61);
    windshield.material = glassMat;
    windshield.parent = root;

    // Para-choque cromado
    const bumper = BABYLON.MeshBuilder.CreateBox('bumper', { width: 2.3, height: 0.28, depth: 0.2 }, scene);
    bumper.position.set(0, 0.65, -1.7);
    bumper.material = chromeMat;
    bumper.parent = root;

    // 4 Rodas
    for (const z of [-0.9, 1.5]) {
        for (const x of [-1.15, 1.15]) {
            const wheel = BABYLON.MeshBuilder.CreateCylinder('wheel', { height: 0.32, diameter: 0.74, tessellation: 16 }, scene);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, 0.37, z);
            wheel.material = tireMat;
            wheel.parent = root;
            registerShadows(wheel, shadowGenerator);
        }
    }

    root.metadata = { kind: 'block', clearance: 3.5, width: 2.3 };
    return root;
}

/**
 * Fardo de Feno Redondo (Obstáculo Baixo)
 */
export function createHay(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('hayBale', scene);
    const hayMat = pbrMat(scene, 'hayMat', 0xd2aa46, 0.95, 0.02);

    const roll = BABYLON.MeshBuilder.CreateCylinder('roll', {
        height: 1.4,
        diameter: 1.2,
        tessellation: 16
    }, scene);
    roll.rotation.z = Math.PI / 2;
    roll.position.y = 0.6;
    roll.material = hayMat;
    roll.parent = root;
    registerShadows(roll, shadowGenerator);

    root.metadata = { kind: 'low', clearance: 1.15, width: 1.4 };
    return root;
}

/**
 * Caixote de Madeira Reforçado (Obstáculo Baixo)
 */
export function createCrate(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('crate', scene);
    const woodMat = pbrMat(scene, 'crateWood', 0x8a6238, 0.88, 0.02);

    const box = BABYLON.MeshBuilder.CreateBox('box', { size: 1.1 }, scene);
    box.position.y = 0.55;
    box.material = woodMat;
    box.parent = root;
    registerShadows(box, shadowGenerator);

    root.metadata = { kind: 'low', clearance: 1.1, width: 1.1 };
    return root;
}

/**
 * Vaca Malhada Holstein (Obstáculo Baixo)
 */
export function createCow(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('cow', scene);
    const hideMat = pbrMat(scene, 'cowHide', 0xf2eee6, 0.85, 0.02);
    const spotMat = pbrMat(scene, 'cowSpot', 0x222224, 0.85, 0.02);

    // Corpo
    const body = BABYLON.MeshBuilder.CreateBox('cowBody', { width: 0.9, height: 0.85, depth: 1.8 }, scene);
    body.position.y = 0.95;
    body.material = hideMat;
    body.parent = root;
    registerShadows(body, shadowGenerator);

    // Mancha preta
    const spot = BABYLON.MeshBuilder.CreateBox('cowSpotMesh', { width: 0.92, height: 0.5, depth: 0.6 }, scene);
    spot.position.set(0, 1.05, 0.2);
    spot.material = spotMat;
    spot.parent = root;

    // Cabeça
    const head = BABYLON.MeshBuilder.CreateBox('cowHead', { width: 0.44, height: 0.48, depth: 0.65 }, scene);
    head.position.set(0, 1.25, -1.05);
    head.material = hideMat;
    head.parent = root;
    registerShadows(head, shadowGenerator);

    // 4 Patas
    for (const z of [-0.6, 0.6]) {
        for (const x of [-0.34, 0.34]) {
            const leg = BABYLON.MeshBuilder.CreateCylinder('cowLeg', { height: 0.65, diameter: 0.12 }, scene);
            leg.position.set(x, 0.32, z);
            leg.material = hideMat;
            leg.parent = root;
            registerShadows(leg, shadowGenerator);
        }
    }

    root.metadata = { kind: 'low', clearance: 1.25, width: 1.3 };
    return root;
}

/**
 * Cone de Trânsito Rodoviário
 */
export function createCone(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('cone', scene);
    const orangeMat = pbrMat(scene, 'coneOrange', 0xf05a18, 0.65, 0.05);
    const whiteMat = pbrMat(scene, 'coneReflect', 0xf6f6f6, 0.4, 0.3);

    const base = BABYLON.MeshBuilder.CreateBox('coneBase', { width: 0.52, height: 0.06, depth: 0.52 }, scene);
    base.position.y = 0.03;
    base.material = orangeMat;
    base.parent = root;

    const coneMesh = BABYLON.MeshBuilder.CreateCylinder('coneMesh', {
        height: 0.85,
        diameterTop: 0.06,
        diameterBottom: 0.44,
        tessellation: 14
    }, scene);
    coneMesh.position.y = 0.45;
    coneMesh.material = orangeMat;
    coneMesh.parent = root;
    registerShadows(coneMesh, shadowGenerator);

    // Faixa refletiva branca
    const stripe = BABYLON.MeshBuilder.CreateCylinder('stripe', {
        height: 0.18,
        diameterTop: 0.22,
        diameterBottom: 0.32,
        tessellation: 14
    }, scene);
    stripe.position.y = 0.42;
    stripe.material = whiteMat;
    stripe.parent = root;

    root.metadata = { kind: 'low', clearance: 0.9, width: 0.55 };
    return root;
}

/**
 * Rocha / Pedra de beira de estrada
 */
export function createRock(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('rock', scene);
    const rockMat = pbrMat(scene, 'rockMat', 0x82786a, 0.95, 0.02);

    const rock = BABYLON.MeshBuilder.CreateSphere('rockMesh', {
        diameterX: 1.4,
        diameterY: 0.75,
        diameterZ: 1.1,
        segments: 8
    }, scene);
    rock.position.y = 0.35;
    rock.material = rockMat;
    rock.parent = root;
    registerShadows(rock, shadowGenerator);

    return root;
}

/**
 * Cerca de Madeira
 */
export function createFence(scene, shadowGenerator) {
    const root = new BABYLON.TransformNode('fence', scene);
    const woodMat = pbrMat(scene, 'fenceWood', 0x7d6244, 0.9, 0.02);

    for (let i = -2; i <= 2; i++) {
        const post = BABYLON.MeshBuilder.CreateBox('post', { width: 0.12, height: 1.3, depth: 0.12 }, scene);
        post.position.set(i * 0.9, 0.65, 0);
        post.material = woodMat;
        post.parent = root;
        registerShadows(post, shadowGenerator);
    }

    const rail1 = BABYLON.MeshBuilder.CreateBox('rail1', { width: 4.2, height: 0.1, depth: 0.08 }, scene);
    rail1.position.set(0, 0.48, 0);
    rail1.material = woodMat;
    rail1.parent = root;

    const rail2 = BABYLON.MeshBuilder.CreateBox('rail2', { width: 4.2, height: 0.1, depth: 0.08 }, scene);
    rail2.position.set(0, 0.95, 0);
    rail2.material = woodMat;
    rail2.parent = root;

    return root;
}

/**
 * Pena Branca Colecionável:
 * Flutua no ar girando com efeito de brilho e reflexo.
 */
export function createFeatherMesh(scene) {
    const root = new BABYLON.TransformNode('featherMesh', scene);

    const featherMat = pbrMat(scene, 'featherMat', 0xffffff, 0.4, 0.05, {
        albedoTexture: createFeatherTexture(scene),
        alpha: 0.98,
        transparencyMode: BABYLON.Material.MATERIAL_ALPHATESTANDBLEND
    });

    const plane = BABYLON.MeshBuilder.CreatePlane('featherPlane', { width: 0.42, height: 0.72 }, scene);
    plane.material = featherMat;
    plane.parent = root;
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;

    root.metadata = { kind: 'feather' };
    return root;
}

/**
 * Descarte seguro de nós e meshes
 */
export function disposeTransformNode(node) {
    if (!node) return;
    node.dispose(false, true);
}
