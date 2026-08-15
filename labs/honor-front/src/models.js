/**
 * Modelos 3D procedurais para Honor Front em Babylon.js.
 * Armas em primeira pessoa (M1 Garand e Thompson), soldados, bunkers, sacos de areia e canhão costeiro.
 */

import { gunMetalTexture, gunWoodTexture, concreteTexture } from './textures.js';

export function buildViewGarand(BABYLON, scene) {
    const root = new BABYLON.TransformNode('view_garand', scene);

    const metalTex = gunMetalTexture(scene);
    const woodTex = gunWoodTexture(scene);

    const metalMat = new BABYLON.PBRMaterial('mat_g_metal', scene);
    metalMat.albedoColor = new BABYLON.Color3(0.25, 0.28, 0.32);
    metalMat.albedoTexture = metalTex;
    metalMat.metallic = 0.85;
    metalMat.roughness = 0.28;

    const woodMat = new BABYLON.PBRMaterial('mat_g_wood', scene);
    woodMat.albedoColor = new BABYLON.Color3(0.48, 0.28, 0.16);
    woodMat.albedoTexture = woodTex;
    woodMat.metallic = 0.04;
    woodMat.roughness = 0.55;

    // Coronha / Madeira
    const stock = BABYLON.MeshBuilder.CreateBox('g_stock', { width: 0.05, height: 0.09, depth: 0.55 }, scene);
    stock.position.set(0.18, -0.18, 0.42);
    stock.material = woodMat;
    stock.parent = root;

    // Cano de Aço
    const barrel = BABYLON.MeshBuilder.CreateCylinder('g_barrel', { height: 0.65, diameter: 0.024, tessellation: 12 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.18, -0.12, 0.72);
    barrel.material = metalMat;
    barrel.parent = root;

    // Caixa da Culatra (Receiver)
    const receiver = BABYLON.MeshBuilder.CreateBox('g_receiver', { width: 0.045, height: 0.06, depth: 0.22 }, scene);
    receiver.position.set(0.18, -0.13, 0.46);
    receiver.material = metalMat;
    receiver.parent = root;

    // Massa de mira frontal
    const sight = BABYLON.MeshBuilder.CreateBox('g_sight', { width: 0.008, height: 0.022, depth: 0.008 }, scene);
    sight.position.set(0.18, -0.095, 1.02);
    sight.material = metalMat;
    sight.parent = root;

    return root;
}

export function buildViewThompson(BABYLON, scene) {
    const root = new BABYLON.TransformNode('view_thompson', scene);

    const metalTex = gunMetalTexture(scene);
    const woodTex = gunWoodTexture(scene);

    const metalMat = new BABYLON.PBRMaterial('mat_t_metal', scene);
    metalMat.albedoColor = new BABYLON.Color3(0.22, 0.24, 0.28);
    metalMat.albedoTexture = metalTex;
    metalMat.metallic = 0.88;
    metalMat.roughness = 0.25;

    const woodMat = new BABYLON.PBRMaterial('mat_t_wood', scene);
    woodMat.albedoColor = new BABYLON.Color3(0.42, 0.24, 0.14);
    woodMat.albedoTexture = woodTex;
    woodMat.metallic = 0.02;
    woodMat.roughness = 0.6;

    // Caixa da culatra
    const receiver = BABYLON.MeshBuilder.CreateBox('t_receiver', { width: 0.055, height: 0.08, depth: 0.35 }, scene);
    receiver.position.set(0.18, -0.15, 0.45);
    receiver.material = metalMat;
    receiver.parent = root;

    // Cano com aletas
    const barrel = BABYLON.MeshBuilder.CreateCylinder('t_barrel', { height: 0.48, diameter: 0.03, tessellation: 12 }, scene);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.18, -0.13, 0.72);
    barrel.material = metalMat;
    barrel.parent = root;

    // Carregador de Tambor (Drum Mag)
    const drum = BABYLON.MeshBuilder.CreateCylinder('t_drum', { height: 0.07, diameter: 0.16, tessellation: 20 }, scene);
    drum.position.set(0.18, -0.22, 0.48);
    drum.material = metalMat;
    drum.parent = root;

    // Empunhadura de madeira
    const grip = BABYLON.MeshBuilder.CreateBox('t_grip', { width: 0.04, height: 0.12, depth: 0.05 }, scene);
    grip.position.set(0.18, -0.24, 0.34);
    grip.rotation.x = 0.35;
    grip.material = woodMat;
    grip.parent = root;

    return root;
}

export function buildSoldier(BABYLON, scene) {
    const root = new BABYLON.TransformNode('soldier_root', scene);

    const uniformMat = new BABYLON.PBRMaterial('mat_s_uniform', scene);
    uniformMat.albedoColor = new BABYLON.Color3(0.32, 0.36, 0.32); // Feldgrau cinza-oliva
    uniformMat.roughness = 0.85;

    const helmetMat = new BABYLON.PBRMaterial('mat_s_helmet', scene);
    helmetMat.albedoColor = new BABYLON.Color3(0.24, 0.28, 0.24);
    helmetMat.metallic = 0.6;
    helmetMat.roughness = 0.4;

    const skinMat = new BABYLON.PBRMaterial('mat_s_skin', scene);
    skinMat.albedoColor = new BABYLON.Color3(0.85, 0.7, 0.55);

    // Torso
    const torso = BABYLON.MeshBuilder.CreateBox('s_torso', { width: 0.52, height: 0.7, depth: 0.3 }, scene);
    torso.position.y = 1.05;
    torso.material = uniformMat;
    torso.parent = root;

    // Cabeça
    const head = BABYLON.MeshBuilder.CreateSphere('s_head', { diameter: 0.26, segments: 8 }, scene);
    head.position.y = 1.55;
    head.material = skinMat;
    head.parent = root;

    // Capacete Stahlhelm
    const helmet = BABYLON.MeshBuilder.CreateSphere('s_helmet', { diameter: 0.32, segments: 10 }, scene);
    helmet.position.y = 1.62;
    helmet.scaling.set(1.05, 0.85, 1.15);
    helmet.material = helmetMat;
    helmet.parent = root;

    // Pernas
    const legL = BABYLON.MeshBuilder.CreateCylinder('s_leg_l', { height: 0.7, diameter: 0.16, tessellation: 8 }, scene);
    legL.position.set(-0.16, 0.35, 0);
    legL.material = uniformMat;
    legL.parent = root;

    const legR = BABYLON.MeshBuilder.CreateCylinder('s_leg_r', { height: 0.7, diameter: 0.16, tessellation: 8 }, scene);
    legR.position.set(0.16, 0.35, 0);
    legR.material = uniformMat;
    legR.parent = root;

    // Rifle
    const rifle = BABYLON.MeshBuilder.CreateBox('s_rifle', { width: 0.05, height: 0.08, depth: 0.85 }, scene);
    rifle.position.set(0.24, 1.0, 0.35);
    rifle.rotation.x = -0.3;
    rifle.material = helmetMat;
    rifle.parent = root;

    return root;
}

export function buildCzechHedgehog(BABYLON, scene) {
    const root = new BABYLON.TransformNode('czech_root', scene);
    const metalMat = new BABYLON.PBRMaterial('mat_hedgehog', scene);
    metalMat.albedoColor = new BABYLON.Color3(0.35, 0.28, 0.24);
    metalMat.roughness = 0.85;
    metalMat.metallic = 0.4;

    const b1 = BABYLON.MeshBuilder.CreateBox('beam1', { width: 0.18, height: 2.2, depth: 0.18 }, scene);
    b1.rotation.z = Math.PI / 4;
    b1.material = metalMat;
    b1.parent = root;

    const b2 = BABYLON.MeshBuilder.CreateBox('beam2', { width: 0.18, height: 2.2, depth: 0.18 }, scene);
    b2.rotation.z = -Math.PI / 4;
    b2.material = metalMat;
    b2.parent = root;

    const b3 = BABYLON.MeshBuilder.CreateBox('beam3', { width: 0.18, height: 2.2, depth: 0.18 }, scene);
    b3.rotation.x = Math.PI / 4;
    b3.material = metalMat;
    b3.parent = root;

    return root;
}

export function buildBunker(BABYLON, scene) {
    const root = new BABYLON.TransformNode('bunker_root', scene);
    const concTex = concreteTexture(scene);

    const concMat = new BABYLON.PBRMaterial('mat_bunker_conc', scene);
    concMat.albedoColor = new BABYLON.Color3(0.65, 0.68, 0.7);
    concMat.albedoTexture = concTex;
    concMat.roughness = 0.88;
    concMat.metallic = 0.05;

    const body = BABYLON.MeshBuilder.CreateBox('b_body', { width: 9, height: 3.5, depth: 7 }, scene);
    body.position.y = 1.75;
    body.material = concMat;
    body.parent = root;

    // Teto reforçado
    const roof = BABYLON.MeshBuilder.CreateBox('b_roof', { width: 10.5, height: 0.8, depth: 8.5 }, scene);
    roof.position.y = 3.9;
    roof.material = concMat;
    roof.parent = root;

    return root;
}
