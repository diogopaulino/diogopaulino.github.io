/**
 * Cenário cinematográfico em Babylon.js — céu estrelado, lua, lago reflexivo,
 * relevo de montanhas, pinheiros e iluminação noturna mágica.
 */

import { moonTexture } from './textures.js';

export function buildKingdom(BABYLON, scene, quality) {
    const root = new BABYLON.TransformNode('world_root', scene);

    // 1. CÉU ESTRELADO
    const skyDome = BABYLON.MeshBuilder.CreateSphere('skydome', { diameter: 450, segments: 32 }, scene);
    const skyMat = new BABYLON.StandardMaterial('mat_sky', scene);
    skyMat.backFaceCulling = false;
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMat.emissiveColor = new BABYLON.Color3(0.02, 0.03, 0.08);
    skyMat.specularColor = new BABYLON.Color3(0, 0, 0);
    skyDome.material = skyMat;
    skyDome.parent = root;

    // Estrelas cintilantes
    const starCount = quality.stars || 4000;
    const starGeo = new BABYLON.Mesh('stars', scene);
    const starPositions = [];
    const starColors = [];
    for (let i = 0; i < starCount; i++) {
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = 210 + Math.random() * 10;
        const sinPhi = Math.sin(phi);
        const x = r * sinPhi * Math.cos(theta);
        const y = Math.abs(r * Math.cos(phi)) + 15; // apenas no hemisfério superior
        const z = r * sinPhi * Math.sin(theta);
        starPositions.push(x, y, z);
        const b = 0.6 + Math.random() * 0.4;
        starColors.push(b * 0.9, b * 0.95, b, 1.0);
    }
    const vertexData = new BABYLON.VertexData();
    vertexData.positions = starPositions;
    vertexData.colors = starColors;
    vertexData.applyToMesh(starGeo, true);

    const starMat = new BABYLON.StandardMaterial('mat_star_pts', scene);
    starMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    starMat.pointsCloud = true;
    starMat.pointSize = 2.4;
    starGeo.material = starMat;
    starGeo.parent = root;

    // 2. LUA ILUMINADA
    const moonTex = moonTexture(scene);
    const moon = BABYLON.MeshBuilder.CreateSphere('moon', { diameter: 22, segments: 32 }, scene);
    moon.position.set(24, 62, -85);
    const moonMat = new BABYLON.StandardMaterial('mat_moon', scene);
    moonMat.diffuseTexture = moonTex;
    moonMat.emissiveColor = new BABYLON.Color3(0.95, 0.92, 0.85);
    moonMat.specularColor = new BABYLON.Color3(0, 0, 0);
    moon.material = moonMat;
    moon.parent = root;

    // Halo da Lua
    const moonHalo = BABYLON.MeshBuilder.CreateDisc('moon_halo', { radius: 24, tessellation: 48 }, scene);
    moonHalo.position.copyFrom(moon.position);
    moonHalo.position.z += 1;
    const haloMat = new BABYLON.StandardMaterial('mat_moon_halo', scene);
    haloMat.diffuseColor = new BABYLON.Color3(0.8, 0.85, 1.0);
    haloMat.emissiveColor = new BABYLON.Color3(0.4, 0.5, 0.75);
    haloMat.alpha = 0.25;
    moonHalo.material = haloMat;
    moonHalo.parent = root;

    // 3. LAGO REFLEXIVO
    const water = BABYLON.MeshBuilder.CreateGround('water_lake', { width: 260, height: 260, subdivisions: 32 }, scene);
    water.position.y = -0.05;
    const waterMat = new BABYLON.PBRMaterial('mat_water', scene);
    waterMat.albedoColor = new BABYLON.Color3(0.04, 0.08, 0.16);
    waterMat.roughness = 0.08;
    waterMat.metallic = 0.1;
    waterMat.clearCoat.isEnabled = true;
    waterMat.clearCoat.intensity = 1.0;
    waterMat.clearCoat.roughness = 0.04;
    water.material = waterMat;
    water.parent = root;
    water.receiveShadows = true;

    // 4. COLINA DO CASTELO (Ilha)
    const island = BABYLON.MeshBuilder.CreateCylinder('castle_island', {
        height: 6,
        diameterTop: 36,
        diameterBottom: 48,
        tessellation: 32
    }, scene);
    island.position.set(0, -1, 0);
    const groundMat = new BABYLON.PBRMaterial('mat_ground', scene);
    groundMat.albedoColor = new BABYLON.Color3(0.08, 0.14, 0.09);
    groundMat.roughness = 0.85;
    groundMat.metallic = 0.0;
    island.material = groundMat;
    island.parent = root;
    island.receiveShadows = true;

    // 5. PINHEIROS AO REDOR
    const treeMat = new BABYLON.PBRMaterial('mat_pine', scene);
    treeMat.albedoColor = new BABYLON.Color3(0.06, 0.12, 0.08);
    treeMat.roughness = 0.9;

    const trunkMat = new BABYLON.PBRMaterial('mat_trunk', scene);
    trunkMat.albedoColor = new BABYLON.Color3(0.18, 0.12, 0.08);

    const treeProto = BABYLON.MeshBuilder.CreateCylinder('proto_pine', { height: 4, diameterTop: 0, diameterBottom: 2.2, tessellation: 8 }, scene);
    treeProto.material = treeMat;
    treeProto.setEnabled(false);

    const numTrees = quality.trees || 70;
    for (let i = 0; i < numTrees; i++) {
        const ang = Math.random() * Math.PI * 2;
        const dist = 22 + Math.random() * 45;
        const x = Math.cos(ang) * dist;
        const z = Math.sin(ang) * dist;
        const scale = 0.8 + Math.random() * 0.7;
        const tree = treeProto.clone(`tree_${i}`);
        tree.setEnabled(true);
        tree.position.set(x, scale * 2 - 0.2, z);
        tree.scaling.setAll(scale);
        tree.parent = root;
        tree.receiveShadows = true;
    }

    return { root, moon, water, starGeo };
}

export function setupKingdomLights(BABYLON, scene, quality) {
    // Luz ambiente luar / crepúsculo
    const hemi = new BABYLON.HemisphericLight('hemi_night', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.diffuse = new BABYLON.Color3(0.2, 0.28, 0.45);
    hemi.groundColor = new BABYLON.Color3(0.05, 0.06, 0.1);
    hemi.intensity = 0.75;

    // Luz da Lua direcional
    const moonLight = new BABYLON.DirectionalLight('moon_light', new BABYLON.Vector3(-0.25, -0.6, 0.75).normalize(), scene);
    moonLight.position.set(24, 62, -85);
    moonLight.diffuse = new BABYLON.Color3(0.75, 0.85, 1.0);
    moonLight.intensity = 1.4;

    let shadowGen = null;
    if (quality.shadows) {
        shadowGen = new BABYLON.ShadowGenerator(quality.shadowMap || 2048, moonLight);
        shadowGen.usePoissonSampling = true;
        shadowGen.bias = 0.001;
    }

    // Holofotes aconchegantes iluminando o castelo da água
    const spotWarm = new BABYLON.PointLight('spot_warm', new BABYLON.Vector3(0, 4, 18), scene);
    spotWarm.diffuse = new BABYLON.Color3(1.0, 0.85, 0.6);
    spotWarm.intensity = 1.2;
    spotWarm.range = 35;

    return { hemi, moonLight, shadowGen, spotWarm };
}
