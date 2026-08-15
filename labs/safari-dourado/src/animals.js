/**
 * Fauna africana animada em Babylon.js para Safari Dourado:
 * Girafas, Elefantes, Zebras e Leões com marcha procedural.
 */

import { zebraTexture, giraffeTexture } from './textures.js';

export function buildGiraffe(BABYLON, scene) {
    const root = new BABYLON.TransformNode('giraffe_root', scene);
    const tex = giraffeTexture(scene);

    const mat = new BABYLON.PBRMaterial('mat_giraffe', scene);
    mat.albedoTexture = tex;
    mat.albedoColor = new BABYLON.Color3(0.92, 0.82, 0.65);
    mat.roughness = 0.85;

    // Corpo
    const body = BABYLON.MeshBuilder.CreateBox('g_body', { width: 1.2, height: 1.4, depth: 2.2 }, scene);
    body.position.set(0, 3.2, 0);
    body.material = mat;
    body.parent = root;

    // Pescoço longo
    const neck = BABYLON.MeshBuilder.CreateCylinder('g_neck', { height: 3.4, diameterTop: 0.35, diameterBottom: 0.55, tessellation: 8 }, scene);
    neck.position.set(0, 4.8, 0.9);
    neck.rotation.x = 0.28;
    neck.material = mat;
    neck.parent = root;

    // Cabeça
    const head = BABYLON.MeshBuilder.CreateBox('g_head', { width: 0.45, height: 0.5, depth: 0.8 }, scene);
    head.position.set(0, 6.4, 1.45);
    head.material = mat;
    head.parent = root;

    // 4 Pernas longas
    const legConfigs = [
        { key: 'fl', x: 0.45, z: 0.85 },
        { key: 'fr', x: -0.45, z: 0.85 },
        { key: 'hl', x: 0.45, z: -0.85 },
        { key: 'hr', x: -0.45, z: -0.85 }
    ];

    const legs = {};
    legConfigs.forEach((cfg) => {
        const leg = BABYLON.MeshBuilder.CreateCylinder(`g_leg_${cfg.key}`, { height: 3.2, diameter: 0.22, tessellation: 8 }, scene);
        leg.position.set(cfg.x, 1.6, cfg.z);
        leg.material = mat;
        leg.parent = root;
        legs[cfg.key] = leg;
    });

    return { root, neck, head, legs, species: 'giraffe', name: 'Girafa-da-savana' };
}

export function buildElephant(BABYLON, scene) {
    const root = new BABYLON.TransformNode('elephant_root', scene);

    const mat = new BABYLON.PBRMaterial('mat_elephant', scene);
    mat.albedoColor = new BABYLON.Color3(0.48, 0.48, 0.52);
    mat.roughness = 0.92;

    const tuskMat = new BABYLON.PBRMaterial('mat_tusk', scene);
    tuskMat.albedoColor = new BABYLON.Color3(0.95, 0.92, 0.85);

    // Corpo maciço
    const body = BABYLON.MeshBuilder.CreateSphere('e_body', { diameter: 3.2, segments: 10 }, scene);
    body.scaling.set(1.1, 1.0, 1.4);
    body.position.set(0, 2.6, 0);
    body.material = mat;
    body.parent = root;

    // Cabeça
    const head = BABYLON.MeshBuilder.CreateSphere('e_head', { diameter: 1.8, segments: 8 }, scene);
    head.position.set(0, 2.9, 1.8);
    head.material = mat;
    head.parent = root;

    // Tromba
    const trunk = BABYLON.MeshBuilder.CreateCylinder('e_trunk', { height: 2.2, diameterTop: 0.38, diameterBottom: 0.18, tessellation: 8 }, scene);
    trunk.position.set(0, 1.8, 2.5);
    trunk.rotation.x = -0.35;
    trunk.material = mat;
    trunk.parent = root;

    // Orelhas grandes
    for (const sx of [-1, 1]) {
        const ear = BABYLON.MeshBuilder.CreateDisc(`e_ear_${sx}`, { radius: 0.85, tessellation: 12 }, scene);
        ear.rotation.y = sx * 0.45;
        ear.position.set(sx * 1.05, 3.1, 1.6);
        ear.material = mat;
        ear.parent = root;

        // Presas
        const tusk = BABYLON.MeshBuilder.CreateCylinder(`e_tusk_${sx}`, { height: 1.2, diameterTop: 0.04, diameterBottom: 0.14, tessellation: 6 }, scene);
        tusk.position.set(sx * 0.4, 2.0, 2.2);
        tusk.rotation.x = 0.65;
        tusk.material = tuskMat;
        tusk.parent = root;
    }

    return { root, trunk, species: 'elephant', name: 'Elefante-africano' };
}

export function buildZebra(BABYLON, scene) {
    const root = new BABYLON.TransformNode('zebra_root', scene);
    const tex = zebraTexture(scene);

    const mat = new BABYLON.PBRMaterial('mat_zebra', scene);
    mat.albedoTexture = tex;
    mat.roughness = 0.82;

    // Corpo
    const body = BABYLON.MeshBuilder.CreateBox('z_body', { width: 0.9, height: 1.0, depth: 1.8 }, scene);
    body.position.set(0, 1.5, 0);
    body.material = mat;
    body.parent = root;

    // Cabeça
    const head = BABYLON.MeshBuilder.CreateBox('z_head', { width: 0.4, height: 0.45, depth: 0.8 }, scene);
    head.position.set(0, 2.2, 1.0);
    head.material = mat;
    head.parent = root;

    return { root, species: 'zebra', name: 'Zebra-da-planície' };
}
