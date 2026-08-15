/**
 * Cenário costeiro e estrada em Babylon.js para Aurelia Festival.
 * Estrada sinuosa à beira-mar, palmeiras, oceano com reflexos e falésias douradas.
 */

import { coastalAsphaltTexture } from './textures.js';

export function buildCoastalWorld(BABYLON, scene) {
    const root = new BABYLON.TransformNode('coastal_world', scene);

    const asphaltTex = coastalAsphaltTexture(scene);
    const roadMat = new BABYLON.PBRMaterial('mat_coastal_road', scene);
    roadMat.albedoColor = new BABYLON.Color3(0.85, 0.85, 0.88);
    roadMat.albedoTexture = asphaltTex;
    roadMat.roughness = 0.8;

    const oceanMat = new BABYLON.PBRMaterial('mat_sunset_ocean', scene);
    oceanMat.albedoColor = new BABYLON.Color3(0.12, 0.18, 0.28);
    oceanMat.roughness = 0.08;
    oceanMat.metallic = 0.1;
    oceanMat.clearCoat.isEnabled = true;
    oceanMat.clearCoat.intensity = 0.95;

    const cliffMat = new BABYLON.PBRMaterial('mat_coastal_cliff', scene);
    cliffMat.albedoColor = new BABYLON.Color3(0.72, 0.45, 0.28);
    cliffMat.roughness = 0.88;

    // 1. OCEANO
    const ocean = BABYLON.MeshBuilder.CreateGround('ocean_water', { width: 3000, height: 3000 }, scene);
    ocean.position.set(-600, -8, 0);
    ocean.material = oceanMat;
    ocean.parent = root;
    ocean.receiveShadows = true;

    // 2. ESTRADA COSTEIRA (Estrada Infinita / Loop Sinuoso)
    const points = [];
    const numPoints = 200;
    const roadWidth = 10;

    for (let i = 0; i <= numPoints; i++) {
        const t = (i / numPoints) * Math.PI * 4;
        const x = Math.sin(t) * 120 + Math.sin(t * 2) * 40;
        const z = (i / numPoints) * 2400 - 1200;
        const y = Math.sin(t * 1.5) * 8 + 4;
        points.push(new BABYLON.Vector3(x, y, z));
    }

    const roadPositions = [];
    const roadIndices = [];
    const roadUvs = [];

    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const next = points[Math.min(points.length - 1, i + 1)];
        const dir = next.subtract(p).normalize();
        const normal = new BABYLON.Vector3(-dir.z, 0, dir.x).normalize();

        const pL = p.add(normal.scale(-roadWidth / 2));
        const pR = p.add(normal.scale(roadWidth / 2));

        roadPositions.push(pL.x, pL.y, pL.z);
        roadPositions.push(pR.x, pR.y, pR.z);

        const v = (i / points.length) * 40;
        roadUvs.push(0, v);
        roadUvs.push(1, v);
    }

    for (let i = 0; i < points.length - 1; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = (i + 1) * 2;
        const d = c + 1;

        roadIndices.push(a, b, c);
        roadIndices.push(b, d, c);
    }

    const roadMesh = new BABYLON.Mesh('coastal_road_mesh', scene);
    const roadNormals = [];
    BABYLON.VertexData.ComputeNormals(roadPositions, roadIndices, roadNormals);
    const roadVD = new BABYLON.VertexData();
    roadVD.positions = roadPositions;
    roadVD.indices = roadIndices;
    roadVD.normals = roadNormals;
    roadVD.uvs = roadUvs;
    roadVD.applyToMesh(roadMesh, false);
    roadMesh.material = roadMat;
    roadMesh.parent = root;
    roadMesh.receiveShadows = true;

    // 3. FALÉSIAS E PALMEIRAS
    for (let i = 0; i < points.length; i += 4) {
        const p = points[i];
        const cliff = BABYLON.MeshBuilder.CreatePolyhedron(`cliff_${i}`, { type: 1, size: 8 }, scene);
        cliff.position.set(p.x + 28, p.y + 2, p.z);
        cliff.scaling.set(1.6, 2.2, 1.4);
        cliff.material = cliffMat;
        cliff.parent = root;
    }

    // 4. CÉU DE PÔR DO SOL & ILUMINAÇÃO
    const skyDome = BABYLON.MeshBuilder.CreateSphere('skyDome', { diameter: 2200, segments: 24 }, scene);
    const skyMat = new BABYLON.StandardMaterial('mat_sky', scene);
    skyMat.backFaceCulling = false;
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMat.emissiveColor = new BABYLON.Color3(0.92, 0.42, 0.22); // Laranja dourado
    skyDome.material = skyMat;

    const hemi = new BABYLON.HemisphericLight('hemi_light', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.diffuse = new BABYLON.Color3(1.0, 0.65, 0.45);
    hemi.groundColor = new BABYLON.Color3(0.25, 0.18, 0.2);
    hemi.intensity = 1.1;

    const sun = new BABYLON.DirectionalLight('sun_light', new BABYLON.Vector3(-0.6, -0.3, 0.4).normalize(), scene);
    sun.position = new BABYLON.Vector3(300, 120, -400);
    sun.diffuse = new BABYLON.Color3(1.0, 0.72, 0.35);
    sun.intensity = 1.8;

    const shadowGen = new BABYLON.ShadowGenerator(2048, sun);
    shadowGen.usePoissonSampling = true;

    return { root, roadMesh, points, shadowGen };
}
