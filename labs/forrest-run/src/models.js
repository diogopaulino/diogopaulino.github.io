import {
    createPlaidTexture, createCortezTexture, createBubbaCapTexture,
    createBarkTexture, createSignTexture, createFeatherTexture
} from './textures.js';
import { hexToColor3 } from './utils.js';
import { createHand, createMuscle, createSkull, createShoe, createTorso } from '../../shared/realism-bjs.js';

const prefabCache = new Map();

function getPrefab(scene, shadowGenerator, key, builderFunc) {
    if (!prefabCache.has(key)) {
        const root = builderFunc();
        root.position.y = -9999;
        root.setEnabled(false);
        prefabCache.set(key, root);
    }
    const prefab = prefabCache.get(key);
    const instance = prefab.instantiateHierarchy();
    instance.setEnabled(true);
    instance.position.y = 0;
    instance.metadata = prefab.metadata;
    
    if (shadowGenerator) {
        instance.getChildMeshes().forEach(m => {
            shadowGenerator.addShadowCaster(m, true);
            m.receiveShadows = true;
        });
    }
    return instance;
}

/**
 * Duas águas: cumeeira no eixo X, vão em Z, beiral abaixo de y = 0.
 * O caller encosta y = 0 no topo da parede.
 */
function gableRoof(scene, name, { length, span, rise }) {
    const hx = span / 2;
    const lip = 0.42;
    const shape = [
        new BABYLON.Vector3(-hx - lip, 0, 0),
        new BABYLON.Vector3(0, rise, 0),
        new BABYLON.Vector3(hx + lip, 0, 0),
        new BABYLON.Vector3(hx + lip - 0.18, -0.32, 0),
        new BABYLON.Vector3(-(hx + lip - 0.18), -0.32, 0)
    ];
    const half = length / 2;
    return BABYLON.MeshBuilder.ExtrudeShape(name, {
        shape,
        path: [
            new BABYLON.Vector3(-half, 0, 0),
            new BABYLON.Vector3(half, 0, 0)
        ],
        cap: BABYLON.Mesh.CAP_ALL,
        closeShape: true,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
}

/**
 * Parede de tábuas, base em y = 0. O comprimento corre em X e a frente em +Z.
 * frontSpots, quando existe, é a lista [x, largura] das pilastras da fachada
 * para não cobrir porta e janelas.
 */
function clapboardWall(scene, name, length, depth, height, frontSpots) {
    const hx = length / 2;
    const hz = depth / 2;
    const jut = 0.18;
    const pw = 0.42;
    const auto = [];
    for (let x = -hx + 0.28; x + pw < hx - 0.16; x += 1.05) auto.push([x, pw]);
    const front = frontSpots || auto;
    const pts = [[-hx, -hz]];
    for (const [x, w] of auto) {
        pts.push([x, -hz], [x, -hz - jut], [x + w, -hz - jut], [x + w, -hz]);
    }
    pts.push([hx, -hz], [hx, hz]);
    for (let i = front.length - 1; i >= 0; i--) {
        const [x, w] = front[i];
        pts.push([x + w, hz], [x + w, hz + jut], [x, hz + jut], [x, hz]);
    }
    pts.push([-hx, hz]);
    const shape = pts.map(([x, z]) => new BABYLON.Vector3(x, z, 0));
    const steps = 8;
    const path = [];
    for (let i = 0; i <= steps; i++) path.push(new BABYLON.Vector3(0, (i / steps) * height, 0));
    return BABYLON.MeshBuilder.ExtrudeShapeCustom(name, {
        shape,
        path,
        closeShape: true,
        cap: BABYLON.Mesh.CAP_ALL,
        firstNormal: new BABYLON.Vector3(1, 0, 0),
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
        scaleFunction: (_i, distance) => {
            const t = distance / height;
            return (1.012 - t * 0.018) * (1 + Math.sin(distance * 7.2) * 0.011);
        }
    }, scene);
}

/** Costelas no cilindro, sem mudar a altura. */
function erodeColumn(mesh, ribs, amp) {
    const pos = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < pos.length; i += 3) {
        const x = pos[i];
        const z = pos[i + 2];
        const ang = Math.atan2(z, x);
        const k = 1 + Math.abs(Math.sin(ang * ribs)) * amp;
        pos[i] = x * k;
        pos[i + 2] = z * k;
    }
    mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
    mesh.createNormals(false);
}

const matCache = new Map();
function pbrMat(scene, key, colorHex, roughness = 0.8, metallic = 0.05, extra = {}) {
    const fullKey = `${key}_${colorHex}_${roughness}_${metallic}`;
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
export function createForrest(scene, shadowGenerator = null, { follower = false } = {}) {
    const root = new BABYLON.TransformNode(follower ? 'followerRoot' : 'forrestRoot', scene);
    const skinMat = pbrMat(scene, 'skin', follower ? 0xdca07c : 0xf2cbb0, 0.68, 0.02);
    skinMat.backFaceCulling = false;
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
    const hips = new BABYLON.TransformNode('hips', scene);
    hips.parent = root;
    hips.position.y = 0.95;
    const hipsMesh = createTorso(scene, 'hipsMesh', { height: 0.24, girth: 0.16, style: 'human' });
    hipsMesh.position.y = -0.08;
    hipsMesh.scaling.set(1.28, 0.95, 0.92);
    hipsMesh.material = khakiMat;
    hipsMesh.parent = hips;
    registerShadows(hipsMesh, shadowGenerator);
    const beltMesh = BABYLON.MeshBuilder.CreateTorus('beltMesh', {
        diameter: 0.36, thickness: 0.035, tessellation: 24
    }, scene);
    beltMesh.rotation.x = Math.PI / 2;
    beltMesh.position.y = 0.09;
    beltMesh.material = beltMat;
    beltMesh.parent = hips;
    const buckle = BABYLON.MeshBuilder.CreateBox('buckle', {
        width: 0.07, height: 0.05, depth: 0.018
    }, scene);
    buckle.position.set(0, 0.09, -0.17);
    buckle.material = buckleMat;
    buckle.parent = hips;
    const legs = [];
    for (const sx of [-1, 1]) {
        const leg = new BABYLON.TransformNode(sx < 0 ? 'leftLeg' : 'rightLeg', scene);
        leg.parent = hips;
        leg.position.set(sx * 0.11, -0.08, 0);
        const thigh = createMuscle(scene, 'thigh', {
            length: 0.44, r0: 0.11, r1: 0.055, bulge: 0.05, bulgeAt: 0.28
        });
        thigh.position.y = -0.22;
        thigh.material = khakiMat;
        thigh.parent = leg;
        registerShadows(thigh, shadowGenerator);
        const shin = new BABYLON.TransformNode('shin', scene);
        shin.parent = leg;
        shin.position.y = -0.44;
        const calf = createMuscle(scene, 'calf', {
            length: 0.42, r0: 0.07, r1: 0.05, bulge: 0.02, bulgeAt: 0.35, pinch: 0.25
        });
        calf.position.y = -0.21;
        calf.material = khakiMat;
        calf.parent = shin;
        registerShadows(calf, shadowGenerator);
        const foot = new BABYLON.TransformNode('foot', scene);
        foot.parent = shin;
        foot.position.set(0, -0.42, 0.05);
        const shoe = createShoe(scene, 'shoe', { length: 0.26, width: 0.1, height: 0.08 });
        shoe.rotation.y = -Math.PI / 2;
        shoe.position.set(0, 0.02, 0.06);
        shoe.material = shoeMat;
        shoe.parent = foot;
        registerShadows(shoe, shadowGenerator);
        legs.push({ leg, shin, foot });
    }
    const torso = new BABYLON.TransformNode('torso', scene);
    torso.parent = hips;
    torso.position.y = 0.12;
    const chest = createTorso(scene, 'chest', { height: 0.58, girth: 0.22, style: 'human' });
    chest.scaling.set(1.15, 1, 0.9);
    chest.position.y = 0;
    chest.material = shirtMat;
    chest.parent = torso;
    registerShadows(chest, shadowGenerator);
    const collar = BABYLON.MeshBuilder.CreateTorus('collar', {
        diameter: 0.2, thickness: 0.035, tessellation: 16
    }, scene);
    collar.rotation.x = Math.PI / 2;
    collar.position.set(0, 0.54, 0);
    collar.material = shirtMat;
    collar.parent = torso;
    const head = new BABYLON.TransformNode('head', scene);
    head.parent = torso;
    head.position.y = 0.62;
    const neck = createMuscle(scene, 'neck', {
        length: 0.14, r0: 0.07, r1: 0.055, bulge: 0.012, bulgeAt: 0.4, pinch: 0.15, tessellation: 10, rings: 5
    });
    neck.position.y = -0.04;
    neck.material = skinMat;
    neck.parent = head;
    const face = createSkull(scene, 'face', { diameter: 0.24, style: 'human', front: -1, segments: 20 });
    face.scaling.set(0.92, 1.08, 1);
    face.position.set(0, 0.14, 0);
    face.material = skinMat;
    face.parent = head;
    registerShadows(face, shadowGenerator);
    const hair = BABYLON.MeshBuilder.CreateLathe('hair', {
        shape: [
            new BABYLON.Vector3(0.02, 0, 0),
            new BABYLON.Vector3(0.1, 0.015, 0),
            new BABYLON.Vector3(0.125, 0.06, 0),
            new BABYLON.Vector3(0.1, 0.11, 0),
            new BABYLON.Vector3(0.04, 0.145, 0)
        ],
        tessellation: 16,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    hair.position.set(0, 0.16, -0.02);
    hair.scaling.set(1, 1, 0.9);
    hair.material = hairMat;
    hair.parent = head;
    for (const sx of [-1, 1]) {
        const lock = createMuscle(scene, `hairLock_${sx}`, {
            length: 0.22, r0: 0.04, r1: 0.015, bulge: 0.01, bulgeAt: 0.2, pinch: 0, tessellation: 8, rings: 5
        });
        lock.material = hairMat;
        lock.parent = head;
        lock.position.set(sx * 0.1, 0.16, -0.02);
        lock.rotation.z = sx * 0.7;
    }
    for (const sx of [-1, 1]) {
        const eyeWhite = BABYLON.MeshBuilder.CreateSphere('eyeWhite', { diameter: 0.04, segments: 12 }, scene);
        eyeWhite.position.set(sx * 0.055, 0.16, -0.11);
        eyeWhite.material = pbrMat(scene, 'eyeWhite', 0xf8f8f8, 0.3, 0.05);
        eyeWhite.parent = head;
        const eyePupil = BABYLON.MeshBuilder.CreateSphere('eyePupil', { diameter: 0.022, segments: 10 }, scene);
        eyePupil.position.set(sx * 0.055, 0.16, -0.125);
        eyePupil.material = pbrMat(scene, 'eyePupil', 0x221810, 0.2, 0.1);
        eyePupil.parent = head;
    }
    if (!follower) {
        const capCrown = BABYLON.MeshBuilder.CreateLathe('capCrown', {
            shape: [
                new BABYLON.Vector3(0.02, 0, 0),
                new BABYLON.Vector3(0.125, 0.012, 0),
                new BABYLON.Vector3(0.132, 0.07, 0),
                new BABYLON.Vector3(0.08, 0.125, 0),
                new BABYLON.Vector3(0.015, 0.15, 0)
            ],
            tessellation: 18
        }, scene);
        capCrown.position.set(0, 0.17, -0.02);
        capCrown.material = capMat;
        capCrown.parent = head;
        const capVisor = BABYLON.MeshBuilder.ExtrudeShape('capVisor', {
            shape: [
                new BABYLON.Vector3(-0.11, 0, 0),
                new BABYLON.Vector3(-0.09, 0.02, 0),
                new BABYLON.Vector3(-0.04, 0.085, 0),
                new BABYLON.Vector3(0.04, 0.085, 0),
                new BABYLON.Vector3(0.09, 0.02, 0),
                new BABYLON.Vector3(0.11, 0, 0)
            ],
            path: [
                new BABYLON.Vector3(0, 0, -0.006),
                new BABYLON.Vector3(0, 0, 0.006)
            ],
            cap: BABYLON.Mesh.CAP_ALL
        }, scene);
        capVisor.rotation.x = -Math.PI / 2 + 0.22;
        capVisor.position.set(0, 0.19, -0.1);
        capVisor.material = pbrMat(scene, 'capVisor', 0xb81e1e, 0.7, 0.05);
        capVisor.parent = head;
        registerShadows(capVisor, shadowGenerator);
    }
    const arms = [];
    for (const sx of [-1, 1]) {
        const arm = new BABYLON.TransformNode(sx < 0 ? 'leftArm' : 'rightArm', scene);
        arm.parent = torso;
        arm.position.set(sx * 0.28, 0.48, 0);
        const upperArm = createMuscle(scene, 'upperArm', {
            length: 0.34, r0: 0.07, r1: 0.055, bulge: 0.02, bulgeAt: 0.3
        });
        upperArm.position.y = -0.14;
        upperArm.material = shirtMat;
        upperArm.parent = arm;
        registerShadows(upperArm, shadowGenerator);
        const forearm = new BABYLON.TransformNode('forearm', scene);
        forearm.parent = arm;
        forearm.position.y = -0.32;
        const armSkin = createMuscle(scene, 'armSkin', {
            length: 0.32, r0: 0.055, r1: 0.042, bulge: 0.012, bulgeAt: 0.4, pinch: 0.15
        });
        armSkin.position.y = -0.14;
        armSkin.material = skinMat;
        armSkin.parent = forearm;
        registerShadows(armSkin, shadowGenerator);
        const hand = createHand(scene, 'hand', skinMat, { scale: 0.8 });
        hand.position.set(0, -0.34, 0);
        if (sx > 0) hand.scaling.x = -1;
        hand.parent = forearm;
        arms.push({ arm, forearm, hand });
    }
    root.metadata = {
        parts: { hips, torso, head, legs, arms },
        follower
    };
    return root;
}
export function createTree(scene, shadowGenerator, kind = 'oak') {
    return getPrefab(scene, shadowGenerator, 'createTree_' + kind, () => {
    const root = new BABYLON.TransformNode(`tree_${kind}`, scene);
    const barkMat = pbrMat(scene, 'treeBark', 0x5a3e26, 0.94, 0.02, {
        albedoTexture: createBarkTexture(scene)
    });
    if (kind === 'pine') {
        const needleMat = pbrMat(scene, 'pineNeedle', 0x244e26, 0.85, 0.02);
        const trunk = BABYLON.MeshBuilder.CreateCylinder('pineTrunk', {
            height: 4.8,
            diameterTop: 0.22,
            diameterBottom: 0.44,
            tessellation: 16
        }, scene);
        trunk.position.y = 2.4;
        trunk.material = barkMat;
        trunk.parent = root;
        registerShadows(trunk, shadowGenerator);
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
                tessellation: 14
            }, scene);
            const verts = cone.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < verts.length; i += 3) {
                const n = 0.86 + Math.abs(Math.sin(verts[i] * 2.8 + t.y) * Math.cos(verts[i + 2] * 2.2)) * 0.2;
                verts[i] *= n;
                verts[i + 2] *= n;
            }
            cone.setVerticesData(BABYLON.VertexBuffer.PositionKind, verts);
            cone.createNormals(false);
            cone.position.y = t.y;
            cone.material = needleMat;
            cone.parent = root;
            registerShadows(cone, shadowGenerator);
        }
    } else if (kind === 'cactus') {
        const cactusMat = pbrMat(scene, 'cactusMat', 0x487e44, 0.72, 0.04);
        const rib = (mesh) => {
            const verts = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            if (!verts) return mesh;
            for (let i = 0; i < verts.length; i += 3) {
                const x = verts[i];
                const y = verts[i + 1];
                const z = verts[i + 2];
                const ang = Math.atan2(z, x);
                const n = 1 + Math.abs(Math.sin(ang * 5)) * 0.1 + Math.abs(Math.sin(y * 7)) * 0.025;
                verts[i] = x * n;
                verts[i + 2] = z * n;
            }
            mesh.setVerticesData(BABYLON.VertexBuffer.PositionKind, verts);
            mesh.createNormals(false);
            return mesh;
        };
        const mainStem = rib(BABYLON.MeshBuilder.CreateCylinder('cactusStem', {
            height: 4.2,
            diameterTop: 0.44,
            diameterBottom: 0.48,
            tessellation: 18
        }, scene));
        mainStem.position.y = 2.1;
        mainStem.material = cactusMat;
        mainStem.parent = root;
        registerShadows(mainStem, shadowGenerator);
        const armL1 = rib(BABYLON.MeshBuilder.CreateCylinder('cactusArmL1', { height: 0.8, diameter: 0.28, tessellation: 12 }, scene));
        armL1.rotation.z = Math.PI / 2;
        armL1.position.set(-0.55, 2.2, 0);
        armL1.material = cactusMat;
        armL1.parent = root;
        const armL2 = rib(BABYLON.MeshBuilder.CreateCylinder('cactusArmL2', { height: 1.4, diameter: 0.28, tessellation: 12 }, scene));
        armL2.position.set(-0.95, 2.8, 0);
        armL2.material = cactusMat;
        armL2.parent = root;
        registerShadows(armL2, shadowGenerator);
        const armR1 = rib(BABYLON.MeshBuilder.CreateCylinder('cactusArmR1', { height: 0.8, diameter: 0.28, tessellation: 12 }, scene));
        armR1.rotation.z = Math.PI / 2;
        armR1.position.set(0.55, 2.7, 0);
        armR1.material = cactusMat;
        armR1.parent = root;
        const armR2 = rib(BABYLON.MeshBuilder.CreateCylinder('cactusArmR2', { height: 1.1, diameter: 0.28, tessellation: 12 }, scene));
        armR2.position.set(0.95, 3.1, 0);
        armR2.material = cactusMat;
        armR2.parent = root;
        registerShadows(armR2, shadowGenerator);
    } else {
        const leafMat = pbrMat(scene, 'oakLeaf', 0x3d7028, 0.88, 0.02);
        const trunk = BABYLON.MeshBuilder.CreateCylinder('oakTrunk', {
            height: 3.4,
            diameterTop: 0.42,
            diameterBottom: 0.68,
            tessellation: 16
        }, scene);
        trunk.position.y = 1.7;
        trunk.material = barkMat;
        trunk.parent = root;
        registerShadows(trunk, shadowGenerator);
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
                segments: 14
            }, scene);
            const pos = canopy.getVerticesData(BABYLON.VertexBuffer.PositionKind);
            for (let i = 0; i < pos.length; i += 3) {
                const n = 0.78 + Math.abs(Math.sin(pos[i] * 2.4 + pos[i + 1]) * Math.cos(pos[i + 2] * 1.8 + c.y)) * 0.36;
                pos[i] *= n;
                pos[i + 1] *= n * 0.9;
                pos[i + 2] *= n;
            }
            canopy.setVerticesData(BABYLON.VertexBuffer.PositionKind, pos);
            canopy.createNormals(false);
            canopy.position.set(c.x, c.y, c.z);
            canopy.material = leafMat;
            canopy.parent = root;
            registerShadows(canopy, shadowGenerator);
        }
    }
    return root;
    });
}export function createHouse(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createHouse', () => {
    const root = new BABYLON.TransformNode('farmHouse', scene);
    const wallMat = pbrMat(scene, 'houseWall', 0xf0ece2, 0.9, 0.02);
    const roofMat = pbrMat(scene, 'houseRoof', 0x7e2a26, 0.75, 0.05);
    const woodMat = pbrMat(scene, 'houseWood', 0x5a3e26, 0.85, 0.02);
    const windowMat = pbrMat(scene, 'houseGlass', 0x88c4e0, 0.25, 0.3);
    const walls = clapboardWall(scene, 'walls', 5.4, 4.2, 3.2, [
        [-2.66, 0.46], [-1.08, 0.4], [0.64, 0.4], [2.2, 0.46]
    ]);
    walls.material = wallMat;
    walls.parent = root;
    registerShadows(walls, shadowGenerator);
    const roof = gableRoof(scene, 'roof', { length: 6.2, span: 4.6, rise: 2.15 });
    roof.position.y = 3.2;
    roof.material = roofMat;
    roof.parent = root;
    registerShadows(roof, shadowGenerator);
    const porch = BABYLON.MeshBuilder.CreateBox('porch', { width: 4.2, height: 0.2, depth: 1.4 }, scene);
    porch.position.set(0, 0.1, 2.6);
    porch.material = woodMat;
    porch.parent = root;
    for (const x of [-1.8, 0, 1.8]) {
        const post = BABYLON.MeshBuilder.CreateCylinder('post', { height: 2.6, diameter: 0.14 }, scene);
        post.position.set(x, 1.4, 3.2);
        post.material = wallMat;
        post.parent = root;
        registerShadows(post, shadowGenerator);
    }
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
    });
}export function createBarn(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createBarn', () => {
    const root = new BABYLON.TransformNode('barn', scene);
    const redMat = pbrMat(scene, 'barnRed', 0x9a2620, 0.88, 0.02);
    const roofMat = pbrMat(scene, 'barnRoof', 0x48464a, 0.7, 0.05);
    const body = clapboardWall(scene, 'barnBody', 6.4, 5.2, 4.2);
    body.material = redMat;
    body.parent = root;
    registerShadows(body, shadowGenerator);
    const roof = gableRoof(scene, 'barnRoofMesh', { length: 7.4, span: 5.6, rise: 2.45 });
    roof.position.y = 4.2;
    roof.material = roofMat;
    roof.parent = root;
    registerShadows(roof, shadowGenerator);
    return root;
    });
}export function createMesa(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createMesa', () => {
    const root = new BABYLON.TransformNode('mesa', scene);
    const rockMat = pbrMat(scene, 'mesaRock', 0xba6a38, 0.92, 0.02);
    const topMat = pbrMat(scene, 'mesaTop', 0xd48a52, 0.88, 0.02);
    const base = BABYLON.MeshBuilder.CreateCylinder('mesaBase', {
        height: 8.5,
        diameterTop: 6.2,
        diameterBottom: 8.4,
        tessellation: 12
    }, scene);
    erodeColumn(base, 5, 0.14);
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
    erodeColumn(cap, 5, 0.08);
    cap.position.y = 8.8;
    cap.material = topMat;
    cap.parent = root;
    registerShadows(cap, shadowGenerator);
    return root;
    });
}export function createBillboard(scene, shadowGenerator, title = 'BUBBA GUMP', sub = 'SHRIMP CO.') {
    return getPrefab(scene, shadowGenerator, 'createBillboard_' + title + '_' + sub, () => {
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
    });
}export function createTruck(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createTruck', () => {
    const root = new BABYLON.TransformNode('truck', scene);
    const paintMat = pbrMat(scene, 'truckPaint', 0xb83824, 0.45, 0.25);
    const chromeMat = pbrMat(scene, 'truckChrome', 0xe8e8e8, 0.2, 0.95);
    const glassMat = pbrMat(scene, 'truckGlass', 0x88c4e0, 0.2, 0.35);
    const tireMat = pbrMat(scene, 'truckTire', 0x1a1a1c, 0.85, 0.05);
    const cab = BABYLON.MeshBuilder.CreateLathe('cab', {
        shape: [
            new BABYLON.Vector3(0.22, 0, 0),
            new BABYLON.Vector3(0.85, 0.18, 0),
            new BABYLON.Vector3(1.08, 0.55, 0),
            new BABYLON.Vector3(1.02, 1.05, 0),
            new BABYLON.Vector3(0.62, 1.45, 0),
            new BABYLON.Vector3(0.18, 1.7, 0)
        ],
        tessellation: 16,
        cap: BABYLON.Mesh.CAP_ALL
    }, scene);
    cab.rotation.x = -Math.PI / 2;
    cab.scaling.set(1.05, 1, 0.62);
    cab.position.set(0, 1.15, -1.5);
    cab.material = paintMat;
    cab.parent = root;
    registerShadows(cab, shadowGenerator);
    const bed = BABYLON.MeshBuilder.CreateLathe('bed', {
        shape: [
            new BABYLON.Vector3(0.35, 0, 0),
            new BABYLON.Vector3(1.05, 0.15, 0),
            new BABYLON.Vector3(1.1, 1.3, 0),
            new BABYLON.Vector3(0.95, 2.2, 0),
            new BABYLON.Vector3(0.4, 2.5, 0)
        ],
        tessellation: 14,
        cap: BABYLON.Mesh.CAP_ALL
    }, scene);
    bed.rotation.x = -Math.PI / 2;
    bed.scaling.set(1.02, 1, 0.42);
    bed.position.set(0, 0.85, -0.05);
    bed.material = paintMat;
    bed.parent = root;
    registerShadows(bed, shadowGenerator);
    const windshield = BABYLON.MeshBuilder.CreateBox('windshield', { width: 2.0, height: 0.65, depth: 0.08 }, scene);
    windshield.position.set(0, 1.85, -1.61);
    windshield.material = glassMat;
    windshield.parent = root;
    // Para-choque: sulco no meio, centro mais à frente e pontas que voltam.
    const bumperShape = [
        [-0.02, -0.14],
        [-0.14, -0.08],
        [-0.16, -0.02],
        [-0.05, 0.03],
        [-0.18, 0.08],
        [-0.12, 0.14],
        [0.06, 0.14],
        [0.04, -0.14]
    ].map(([x, y]) => new BABYLON.Vector3(x, y, 0));
    const bumperPath = [];
    for (let i = 0; i <= 14; i++) {
        const u = i / 14;
        const x = -1.15 + u * 2.3;
        const end = Math.abs(u - 0.5) * 2;
        bumperPath.push(new BABYLON.Vector3(x, end * end * 0.05, -0.08 + end * end * 0.22));
    }
    const bumper = BABYLON.MeshBuilder.ExtrudeShape('bumper', {
        shape: bumperShape,
        path: bumperPath,
        cap: BABYLON.Mesh.CAP_ALL,
        closeShape: true,
        sideOrientation: BABYLON.Mesh.DOUBLESIDE
    }, scene);
    bumper.position.set(0, 0.65, -1.7);
    bumper.material = chromeMat;
    bumper.parent = root;
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
    });
}export function createHay(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createHay', () => {
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
    });
}export function createCrate(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createCrate', () => {
    const root = new BABYLON.TransformNode('crate', scene);
    const woodMat = pbrMat(scene, 'crateWood', 0x8a6238, 0.88, 0.02);
    const dark = pbrMat(scene, 'crateDark', 0x4a2c16, 0.9, 0.02);
    const S = 1.1;
    const post = 0.1;
    const inset = S / 2 - post / 2;
    const board = (name, w, h, d, x, y, z) => {
        const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
        m.position.set(x, y, z);
        m.material = woodMat;
        m.parent = root;
        registerShadows(m, shadowGenerator);
        return m;
    };
    for (const x of [-inset, inset]) {
        for (const z of [-inset, inset]) {
            board('cratePost', post, S, post, x, S / 2, z);
        }
    }
    for (const y of [0.18, 0.5, 0.84]) {
        for (const z of [-inset, inset]) {
            board('crateSlat', 0.86, 0.16, 0.06, 0, y, z);
        }
        for (const x of [-inset, inset]) {
            board('crateSlat', 0.06, 0.16, 0.86, x, y, 0);
        }
    }
    for (const tilt of [1, -1]) {
        const mark = BABYLON.MeshBuilder.CreateBox('crateMark', { width: 0.7, height: 0.07, depth: 0.04 }, scene);
        mark.position.set(0, 0.55, inset + 0.03);
        mark.rotation.z = tilt * Math.PI / 4;
        mark.material = dark;
        mark.parent = root;
        registerShadows(mark, shadowGenerator);
    }
    root.metadata = { kind: 'low', clearance: 1.1, width: 1.1 };
    return root;
    });
}export function createCow(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createCow', () => {
    const root = new BABYLON.TransformNode('cow', scene);
    const hideMat = pbrMat(scene, 'cowHide', 0xf2eee6, 0.85, 0.02);
    const spotMat = pbrMat(scene, 'cowSpot', 0x222224, 0.85, 0.02);
    const body = createMuscle(scene, 'cowBody', {
        length: 1.35, r0: 0.5, r1: 0.36, bulge: 0.14, bulgeAt: 0.42, pinch: 0.12, tessellation: 14, rings: 8
    });
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.95;
    body.material = hideMat;
    body.parent = root;
    registerShadows(body, shadowGenerator);
    const spot = BABYLON.MeshBuilder.CreateSphere('cowSpotMesh', {
        diameterX: 0.7, diameterY: 0.5, diameterZ: 0.55, segments: 12
    }, scene);
    spot.position.set(0, 1.15, 0.15);
    spot.material = spotMat;
    spot.parent = root;
    const head = createSkull(scene, 'cowHead', { diameter: 0.48, style: 'dog', segments: 16, front: -1 });
    head.scaling.set(0.92, 0.95, 1.2);
    head.position.set(0, 1.22, -1.05);
    head.material = hideMat;
    head.parent = root;
    registerShadows(head, shadowGenerator);
    for (const z of [-0.55, 0.55]) {
        for (const x of [-0.28, 0.28]) {
            const leg = createMuscle(scene, 'cowLeg', {
                length: 0.52, r0: 0.09, r1: 0.055, bulge: 0.02, pinch: 0.25, tessellation: 10, rings: 6
            });
            leg.position.set(x, 0.36, z);
            leg.material = hideMat;
            leg.parent = root;
            registerShadows(leg, shadowGenerator);
        }
    }
    root.metadata = { kind: 'low', clearance: 1.25, width: 1.3 };
    return root;
    });
}export function createCone(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createCone', () => {
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
    });
}export function createRock(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createRock', () => {
    const root = new BABYLON.TransformNode('rock', scene);
    const rockMat = pbrMat(scene, 'rockMat', 0x82786a, 0.95, 0.02);
    const rock = BABYLON.MeshBuilder.CreateSphere('rockMesh', {
        diameterX: 1.4,
        diameterY: 0.75,
        diameterZ: 1.1,
        segments: 14
    }, scene);
    const rockVerts = rock.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < rockVerts.length; i += 3) {
        const x = rockVerts[i];
        const y = rockVerts[i + 1];
        const z = rockVerts[i + 2];
        const n = 0.74 + Math.abs(Math.sin(x * 2.1 + z * 1.6) * Math.cos(y * 2.8 + x)) * 0.42;
        rockVerts[i] = x * n;
        rockVerts[i + 1] = y * (0.7 + n * 0.22);
        rockVerts[i + 2] = z * n;
    }
    rock.setVerticesData(BABYLON.VertexBuffer.PositionKind, rockVerts);
    rock.createNormals(false);
    rock.position.y = 0.35;
    rock.material = rockMat;
    rock.parent = root;
    registerShadows(rock, shadowGenerator);
    return root;
    });
}export function createFence(scene, shadowGenerator) {
    return getPrefab(scene, shadowGenerator, 'createFence', () => {
    const root = new BABYLON.TransformNode('fence', scene);
    const woodMat = pbrMat(scene, 'fenceWood', 0x7d6244, 0.9, 0.02);
    let postSrc = null;
    for (let i = -2; i <= 2; i++) {
        const post = postSrc
            ? postSrc.clone('post')
            : (postSrc = BABYLON.MeshBuilder.CreateLathe('post', {
                shape: [
                    new BABYLON.Vector3(0.11, 0, 0),
                    new BABYLON.Vector3(0.1, 0.06, 0),
                    new BABYLON.Vector3(0.055, 0.16, 0),
                    new BABYLON.Vector3(0.048, 1.02, 0),
                    new BABYLON.Vector3(0.072, 1.14, 0),
                    new BABYLON.Vector3(0.08, 1.26, 0),
                    new BABYLON.Vector3(0.03, 1.32, 0)
                ],
                tessellation: 4,
                cap: BABYLON.Mesh.CAP_ALL
            }, scene));
        post.rotation.y = Math.PI / 4;
        post.position.set(i * 0.9, 0, 0);
        post.material = woodMat;
        post.parent = root;
        registerShadows(post, shadowGenerator);
    }
    const railShape = [
        [-0.04, -0.05],
        [-0.05, -0.02],
        [-0.05, 0.03],
        [-0.02, 0.055],
        [0.02, 0.055],
        [0.05, 0.03],
        [0.05, -0.02],
        [0.04, -0.05]
    ].map(([x, y]) => new BABYLON.Vector3(x, y, 0));
    const fenceRail = (name, y) => {
        const path = [];
        for (let i = 0; i <= 12; i++) {
            const u = i / 12;
            const x = -2.1 + u * 4.2;
            const sag = Math.sin(u * Math.PI) * 0.09;
            path.push(new BABYLON.Vector3(x, -sag, 0));
        }
        const rail = BABYLON.MeshBuilder.ExtrudeShape(name, {
            shape: railShape,
            path,
            cap: BABYLON.Mesh.CAP_ALL,
            closeShape: true,
            sideOrientation: BABYLON.Mesh.DOUBLESIDE
        }, scene);
        rail.position.y = y;
        rail.material = woodMat;
        rail.parent = root;
        return rail;
    };
    fenceRail('rail1', 0.48);
    fenceRail('rail2', 0.95);
    return root;
    });
}export function createFeatherMesh(scene) {
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
export function disposeTransformNode(node) {
    if (!node) return;
    node.dispose(false, true);
}
