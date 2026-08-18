/**
 * Cenário da savana africana em Babylon.js para Safari Dourado.
 * Terreno dourado, poço d'água, acácias e manadas de animais selvagens.
 */

import { savannaGrassTexture } from './textures.js';
import { buildAcacia } from './models.js';
import { buildGiraffe, buildElephant, buildZebra } from './animals.js';

export async function buildSavannaWorld(BABYLON, scene) {
    const root = new BABYLON.TransformNode('savanna_world', scene);

    const grassTex = savannaGrassTexture(scene);
    const grassMat = new BABYLON.PBRMaterial('mat_savanna_ground', scene);
    grassMat.albedoColor = new BABYLON.Color3(0.85, 0.72, 0.42);
    grassMat.albedoTexture = grassTex;
    grassMat.roughness = 0.95;

    const waterMat = new BABYLON.PBRMaterial('mat_waterhole', scene);
    waterMat.albedoColor = new BABYLON.Color3(0.18, 0.28, 0.32);
    waterMat.roughness = 0.1;
    waterMat.clearCoat.isEnabled = true;
    waterMat.clearCoat.intensity = 0.9;

    // 1. TERRENO DA SAVANA
    const ground = BABYLON.MeshBuilder.CreateGround('savanna_terrain', { width: 1400, height: 1400, subdivisions: 32 }, scene);
    ground.position.set(0, 0, 0);
    ground.material = grassMat;
    ground.parent = root;
    ground.receiveShadows = true;

    // 2. POÇO D'ÁGUA (WATERING HOLE)
    const water = BABYLON.MeshBuilder.CreateDisc('waterhole_disc', { radius: 36, tessellation: 24 }, scene);
    water.rotation.x = Math.PI / 2;
    water.position.set(60, 0.05, 80);
    water.material = waterMat;
    water.parent = root;

    // 3. BOSQUE DE ACÁCIAS
    const acaciaPromises = [];
    for (let i = 0; i < 35; i++) {
        const a = (i / 35) * Math.PI * 2;
        const r = 80 + (i % 5) * 45;
        acaciaPromises.push(buildAcacia(BABYLON, scene).then(acacia => {
            acacia.position.set(Math.cos(a) * r + (Math.random() - 0.5) * 30, 0, Math.sin(a) * r + (Math.random() - 0.5) * 30);
            acacia.parent = root;
        }));
    }
    await Promise.all(acaciaPromises);

    // 4. ANIMAIS DA SAVANA
    const animalInstances = [];

    // Manada de Girafas
    for (let i = 0; i < 4; i++) {
        const g = buildGiraffe(BABYLON, scene);
        g.root.position.set(-90 + i * 16, 0, 120 + (i % 2) * 12);
        g.root.rotation.y = Math.PI * 0.4;
        g.root.parent = root;
        animalInstances.push(g);
    }

    // Família de Elefantes no Poço d'água
    for (let i = 0; i < 3; i++) {
        const e = buildElephant(BABYLON, scene);
        e.root.position.set(50 + i * 22, 0, 95 + i * 10);
        e.root.rotation.y = -Math.PI * 0.3;
        e.root.parent = root;
        animalInstances.push(e);
    }

    // Zebras pastando
    for (let i = 0; i < 6; i++) {
        const z = buildZebra(BABYLON, scene);
        z.root.position.set(-40 + (i % 3) * 14, 0, -60 + Math.floor(i / 3) * 18);
        z.root.rotation.y = (i * 0.8);
        z.root.parent = root;
        animalInstances.push(z);
    }

    // 5. CÉU DOURADO & SOL
    const skyDome = BABYLON.MeshBuilder.CreateSphere('skyDome', { diameter: 1800, segments: 24 }, scene);
    const skyMat = new BABYLON.StandardMaterial('mat_sky', scene);
    skyMat.backFaceCulling = false;
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMat.emissiveColor = new BABYLON.Color3(0.95, 0.55, 0.25); // Pôr do sol dourado
    skyDome.material = skyMat;

    const hemi = new BABYLON.HemisphericLight('hemi_light', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.diffuse = new BABYLON.Color3(1.0, 0.75, 0.5);
    hemi.groundColor = new BABYLON.Color3(0.4, 0.25, 0.15);
    hemi.intensity = 1.2;

    const sun = new BABYLON.DirectionalLight('sun_light', new BABYLON.Vector3(-0.5, -0.4, 0.7).normalize(), scene);
    sun.position = new BABYLON.Vector3(200, 160, -280);
    sun.diffuse = new BABYLON.Color3(1.0, 0.85, 0.55);
    sun.intensity = 1.7;

    const shadowGen = new BABYLON.ShadowGenerator(2048, sun);
    shadowGen.usePoissonSampling = true;

    return { root, animalInstances, shadowGen };
}
