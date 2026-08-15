/**
 * Navio medieval de madeira em Babylon.js (Convés, mastros, velas, leme, cordas, barris).
 */

import { woodTexture, clothTexture, darkWoodTexture } from './Textures.js';

export function buildShip(scene) {
    const root = new BABYLON.TransformNode('shipRoot', scene);

    const woodMat = new BABYLON.StandardMaterial('shipWoodMat', scene);
    woodMat.diffuseTexture = woodTexture(scene, 4, 4);
    woodMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.5);

    const darkWoodMat = new BABYLON.StandardMaterial('shipDarkWoodMat', scene);
    darkWoodMat.diffuseTexture = darkWoodTexture(scene, 3, 3);

    // Casco
    const hull = BABYLON.MeshBuilder.CreateBox('shipHull', { width: 7.2, height: 2.2, depth: 18 }, scene);
    hull.position.y = 0.2;
    hull.material = woodMat;
    hull.parent = root;
    hull.receiveShadows = true;

    // Proa triangular
    const bow = BABYLON.MeshBuilder.CreateCylinder('shipBow', {
        diameterTop: 0,
        diameterBottom: 4.4,
        height: 4.5,
        tessellation: 4
    }, scene);
    bow.rotation.x = -Math.PI / 2;
    bow.position.set(0, 0.4, -10.2);
    bow.material = woodMat;
    bow.parent = root;

    // Convés principal
    const deck = BABYLON.MeshBuilder.CreateBox('shipDeck', { width: 6.6, height: 0.18, depth: 16.5 }, scene);
    deck.position.y = 1.35;
    deck.material = darkWoodMat;
    deck.parent = root;
    deck.receiveShadows = true;

    // Guarda-corpo
    const railL = BABYLON.MeshBuilder.CreateBox('shipRailL', { width: 0.14, height: 0.55, depth: 16 }, scene);
    railL.position.set(-3.2, 1.7, 0);
    railL.material = woodMat;
    railL.parent = root;

    const railR = BABYLON.MeshBuilder.CreateBox('shipRailR', { width: 0.14, height: 0.55, depth: 16 }, scene);
    railR.position.set(3.2, 1.7, 0);
    railR.material = woodMat;
    railR.parent = root;

    // Tompadilho traseiro (Quarter deck)
    const qdeck = BABYLON.MeshBuilder.CreateBox('shipQDeck', { width: 6.4, height: 0.16, depth: 4.2 }, scene);
    qdeck.position.set(0, 2.15, 6.2);
    qdeck.material = darkWoodMat;
    qdeck.parent = root;
    qdeck.receiveShadows = true;

    const qwall = BABYLON.MeshBuilder.CreateBox('shipQWall', { width: 6.4, height: 0.9, depth: 0.2 }, scene);
    qwall.position.set(0, 1.8, 4.1);
    qwall.material = woodMat;
    qwall.parent = root;

    // Mastro principal
    const mast = BABYLON.MeshBuilder.CreateCylinder('shipMast', {
        diameterTop: 0.32,
        diameterBottom: 0.4,
        height: 11,
        tessellation: 8
    }, scene);
    mast.position.set(0, 6.8, -0.5);
    mast.material = darkWoodMat;
    mast.parent = root;

    // Verga da vela
    const yard = BABYLON.MeshBuilder.CreateCylinder('shipYard', {
        diameter: 0.16,
        height: 8,
        tessellation: 6
    }, scene);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 10.2, -0.5);
    yard.material = darkWoodMat;
    yard.parent = root;

    // Vela de tecido
    const sail = BABYLON.MeshBuilder.CreatePlane('shipSail', { width: 7.2, height: 6.5 }, scene);
    sail.position.set(0, 7.4, -0.7);
    const sailMat = new BABYLON.StandardMaterial('sailMat', scene);
    sailMat.diffuseTexture = clothTexture(scene, 3, 3);
    sailMat.diffuseColor = new BABYLON.Color3(0.95, 0.9, 0.82);
    sailMat.backFaceCulling = false;
    sail.material = sailMat;
    sail.parent = root;

    // Leme
    const helmRoot = new BABYLON.TransformNode('shipHelm', scene);
    helmRoot.position.set(0, 2.7, 7.4);
    helmRoot.parent = root;

    const wheelMat = new BABYLON.StandardMaterial('helmWheelMat', scene);
    wheelMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);

    const wheel = BABYLON.MeshBuilder.CreateTorus('wheelTorus', {
        diameter: 0.84,
        thickness: 0.1,
        tessellation: 16
    }, scene);
    wheel.material = wheelMat;
    wheel.parent = helmRoot;

    for (let i = 0; i < 8; i++) {
        const spoke = BABYLON.MeshBuilder.CreateBox(`spoke_${i}`, { width: 0.05, height: 0.8, depth: 0.05 }, scene);
        spoke.rotation.z = (i / 8) * Math.PI;
        spoke.material = wheelMat;
        spoke.parent = helmRoot;
    }

    const post = BABYLON.MeshBuilder.CreateCylinder('helmPost', { diameter: 0.16, height: 1.1 }, scene);
    post.position.set(0, 2.2, 7.4);
    post.material = darkWoodMat;
    post.parent = root;

    // Barris no convés
    for (const x of [-2.2, 2.2]) {
        for (const z of [-4, -1, 2]) {
            const barrel = BABYLON.MeshBuilder.CreateCylinder(`barrel_${x}_${z}`, {
                diameter: 0.76,
                height: 0.7,
                tessellation: 10
            }, scene);
            barrel.position.set(x, 1.72, z);
            barrel.material = woodMat;
            barrel.parent = root;
        }
    }

    // Caixa de mantimentos
    const crate = BABYLON.MeshBuilder.CreateBox('shipCrate', { width: 0.8, height: 0.6, depth: 0.8 }, scene);
    crate.position.set(1.8, 1.72, 5.2);
    crate.material = woodMat;
    crate.parent = root;

    // Corda de tempestade que Teco precisa desatar
    const ropePoints = [
        new BABYLON.Vector3(-2.4, 1.5, 3),
        new BABYLON.Vector3(-1.2, 2.4, 4.5),
        new BABYLON.Vector3(0.2, 2.2, 6.8),
        new BABYLON.Vector3(0.4, 2.6, 7.5)
    ];
    const rope = BABYLON.MeshBuilder.CreateTube('stormRope', {
        path: ropePoints,
        radius: 0.04,
        tessellation: 5
    }, scene);
    const ropeMat = new BABYLON.StandardMaterial('ropeMat', scene);
    ropeMat.diffuseColor = new BABYLON.Color3(0.55, 0.42, 0.25);
    rope.material = ropeMat;
    rope.parent = root;
    rope.setEnabled(false);

    // Amarra do navio na praia
    const mooring = BABYLON.MeshBuilder.CreateCylinder('mooring', { diameter: 0.08, height: 2.4 }, scene);
    mooring.rotation.z = 0.7;
    mooring.position.set(2.6, 1.4, 8.2);
    mooring.material = ropeMat;
    mooring.parent = root;

    // Cabine na proa
    const cabin = BABYLON.MeshBuilder.CreateBox('shipCabin', { width: 4.2, height: 1.6, depth: 3.2 }, scene);
    cabin.position.set(0, 2.15, -5.4);
    cabin.material = woodMat;
    cabin.parent = root;

    root.userData = {
        sail,
        helm: helmRoot,
        rope,
        mooring,
        mast
    };

    return root;
}

export function addShipColliders(collision, ox = 0, oy = 0, oz = 0) {
    collision.addFloor(ox, oz, 6.4, 16, oy + 1.44);
    collision.addFloor(ox, oz + 6.2, 6.2, 4.2, oy + 2.23);
    collision.addWall(ox - 3.25, oz, 0.25, 16, 1.2, oy + 1.44);
    collision.addWall(ox + 3.25, oz, 0.25, 16, 1.2, oy + 1.44);
    collision.addWall(ox, oz + 4.1, 6.4, 0.25, 0.9, oy + 1.44);
    collision.addWall(ox, oz - 5.4, 4.2, 3.2, 1.6, oy + 1.44);
}
