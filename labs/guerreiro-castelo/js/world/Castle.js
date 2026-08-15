/**
 * Castelo em escala: muralhas, 4 torres, ameias, portão maciço, bandeiras e porta secreta em Babylon.js.
 */

import { castleStoneTexture, mossTexture, flagTexture, woodTexture } from './Textures.js';
import { makeTorch } from './Environment.js';

export function buildCastle(scene) {
    const root = new BABYLON.TransformNode('castleRoot', scene);

    const stoneMat = new BABYLON.StandardMaterial('castleStoneMat', scene);
    stoneMat.diffuseTexture = castleStoneTexture(scene, 6, 8);
    stoneMat.diffuseColor = new BABYLON.Color3(0.85, 0.82, 0.78);

    const mossMat = new BABYLON.StandardMaterial('castleMossMat', scene);
    mossMat.diffuseTexture = mossTexture(scene, 4, 4);

    const woodMat = new BABYLON.StandardMaterial('castleWoodMat', scene);
    woodMat.diffuseTexture = woodTexture(scene, 3, 3);

    const wallH = 18;
    const wallT = 2.4;
    const court = 28;

    const mkWall = (name, w, d, x, z) => {
        const m = BABYLON.MeshBuilder.CreateBox(name, { width: w, height: wallH, depth: d }, scene);
        m.position.set(x, wallH / 2, z);
        m.material = stoneMat;
        m.parent = root;
        m.receiveShadows = true;

        const mossBand = BABYLON.MeshBuilder.CreateBox(`${name}_moss`, { width: w * 0.98, height: 2.2, depth: d * 1.02 }, scene);
        mossBand.position.set(x, 1.1, z);
        mossBand.material = mossMat;
        mossBand.parent = root;

        addCrenels(root, stoneMat, x, z, w, d, wallH, scene);
    };

    mkWall('castleWallBack', court + wallT, wallT, 0, -court / 2);
    mkWall('castleWallFront', court + wallT, wallT, 0, court / 2);
    mkWall('castleWallLeft', wallT, court, -court / 2, 0);
    mkWall('castleWallRight', wallT, court, court / 2, 0);

    // 4 Torres cilíndricas nos cantos
    const roofMat = new BABYLON.StandardMaterial('towerRoofMat', scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.45, 0.15, 0.15);

    const towerPositions = [
        [-court / 2, -court / 2],
        [court / 2, -court / 2],
        [-court / 2, court / 2],
        [court / 2, court / 2]
    ];

    towerPositions.forEach(([x, z], i) => {
        const tower = BABYLON.MeshBuilder.CreateCylinder(`tower_${i}`, {
            diameterTop: 6.4,
            diameterBottom: 7.2,
            height: 26,
            tessellation: 12
        }, scene);
        tower.position.set(x, 13, z);
        tower.material = stoneMat;
        tower.parent = root;
        tower.receiveShadows = true;

        const roof = BABYLON.MeshBuilder.CreateCylinder(`towerRoof_${i}`, {
            diameterTop: 0,
            diameterBottom: 7.6,
            height: 4.5,
            tessellation: 12
        }, scene);
        roof.position.set(x, 28, z);
        roof.material = roofMat;
        roof.parent = root;

        const flag = makeFlag(scene);
        flag.position.set(x, 31, z);
        flag.parent = root;
    });

    // Torre de menagem central (Keep)
    const keep = BABYLON.MeshBuilder.CreateBox('castleKeep', { width: 12, height: 22, depth: 12 }, scene);
    keep.position.set(0, 11, -2);
    keep.material = stoneMat;
    keep.parent = root;
    keep.receiveShadows = true;

    const keepRoof = BABYLON.MeshBuilder.CreateBox('keepRoof', { width: 13, height: 1.2, depth: 13 }, scene);
    keepRoof.position.set(0, 22.4, -2);
    keepRoof.material = roofMat;
    keepRoof.parent = root;

    // Portão principal
    const gate = BABYLON.MeshBuilder.CreateBox('mainGate', { width: 7, height: 10, depth: 1.2 }, scene);
    gate.position.set(0, 5, court / 2 + 0.4);
    gate.material = woodMat;
    gate.parent = root;

    const arch = BABYLON.MeshBuilder.CreateTorus('gateArch', {
        diameter: 7.2,
        thickness: 1.4,
        tessellation: 16
    }, scene);
    arch.position.set(0, 9.5, court / 2 + 0.5);
    arch.material = stoneMat;
    arch.parent = root;

    // Passadiço dos arqueiros
    const walk = BABYLON.MeshBuilder.CreateBox('archerWalk', { width: court, height: 0.4, depth: 2 }, scene);
    walk.position.set(0, wallH - 0.5, court / 2 - 0.2);
    walk.material = stoneMat;
    walk.parent = root;

    // Tochas no muro frontal
    for (let i = -3; i <= 3; i++) {
        const torch = makeTorch(scene);
        torch.position.set(i * 3.2, 6, court / 2 + 1.3);
        torch.parent = root;
    }

    // Porta secreta coberta de musgo
    const secretRoot = new BABYLON.TransformNode('secretDoorRoot', scene);
    secretRoot.position.set(-court / 2 - 1.3, 1.15, -6);
    secretRoot.parent = root;

    const door = BABYLON.MeshBuilder.CreateBox('secretDoorMesh', { width: 1.3, height: 2.2, depth: 0.18 }, scene);
    door.material = woodMat;
    door.parent = secretRoot;

    const lock = BABYLON.MeshBuilder.CreateBox('secretLock', { width: 0.18, height: 0.22, depth: 0.1 }, scene);
    lock.position.set(0.4, 0, 0.12);
    const rustMat = new BABYLON.StandardMaterial('lockRustMat', scene);
    rustMat.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.1);
    lock.material = rustMat;
    lock.parent = secretRoot;

    const vine = BABYLON.MeshBuilder.CreatePlane('secretVine', { width: 2.4, height: 4.2 }, scene);
    vine.position.set(-court / 2 - 1.35, 2.2, -6);
    vine.rotation.y = Math.PI / 2;
    vine.material = mossMat;
    vine.parent = root;

    root.userData = {
        secretDoor: secretRoot,
        doorMesh: door,
        gate,
        court
    };

    return root;
}

function addCrenels(root, mat, x, z, w, d, h, scene) {
    const alongX = w > d;
    const len = alongX ? w : d;
    const n = Math.floor(len / 2.2);
    for (let i = 0; i < n; i++) {
        const t = (i / n - 0.5) * len;
        const c = BABYLON.MeshBuilder.CreateBox(`crenel_${x}_${z}_${i}`, {
            width: alongX ? 1.1 : d + 0.4,
            height: 1.4,
            depth: alongX ? d + 0.4 : 1.1
        }, scene);
        c.position.set(alongX ? x + t : x, h + 0.7, alongX ? z : z + t);
        c.material = mat;
        c.parent = root;
    }
}

function makeFlag(scene) {
    const root = new BABYLON.TransformNode('flagRoot', scene);

    const pole = BABYLON.MeshBuilder.CreateCylinder('flagPole', {
        diameter: 0.08,
        height: 3.2,
        tessellation: 6
    }, scene);
    pole.position.y = 1.6;
    pole.parent = root;

    const cloth = BABYLON.MeshBuilder.CreatePlane('flagCloth', { width: 1.6, height: 0.9 }, scene);
    cloth.position.set(0.8, 2.7, 0);
    const fMat = new BABYLON.StandardMaterial('flagMat', scene);
    fMat.diffuseTexture = flagTexture(scene, '#6b1c1c');
    fMat.backFaceCulling = false;
    cloth.material = fMat;
    cloth.parent = root;

    return root;
}

export function addCastleColliders(collision, ox, oz) {
    const court = 28;
    const t = 2.4;
    const h = 18;
    collision.addWall(ox, oz - court / 2, court + t, t, h);
    collision.addWall(ox, oz + court / 2, court + t, t, h);
    collision.addWall(ox - court / 2, oz, t, court, h);
    collision.addWall(ox + court / 2, oz, t, court, h);
    collision.addWall(ox, oz + court / 2 + 0.4, 7, 1.2, 10);
}
