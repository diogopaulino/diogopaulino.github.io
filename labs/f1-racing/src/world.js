/**
 * Construção do mundo 3D e circuito em Babylon.js para F1 Grand Prix.
 * Fita de asfalto procedural PBR, zebras, barreiras, iluminação solar e domo do céu.
 */

import { asphaltTexture, curbTexture } from './textures.js';

export function buildCircuitWorld(BABYLON, circuit, scene) {
    const root = new BABYLON.TransformNode('world_root', scene);

    // Texturas & Materiais PBR
    const asphaltTex = asphaltTexture(scene);
    const roadMat = new BABYLON.PBRMaterial('mat_f1_asphalt', scene);
    roadMat.albedoColor = new BABYLON.Color3(0.85, 0.85, 0.88);
    roadMat.albedoTexture = asphaltTex;
    roadMat.roughness = 0.82;
    roadMat.metallic = 0.05;

    const curbTex = curbTexture(scene);
    const curbMat = new BABYLON.PBRMaterial('mat_f1_curb', scene);
    curbMat.albedoTexture = curbTex;
    curbMat.roughness = 0.65;

    const grassMat = new BABYLON.PBRMaterial('mat_f1_grass', scene);
    grassMat.albedoColor = new BABYLON.Color3(0.22, 0.42, 0.18);
    grassMat.roughness = 0.95;

    const barrierMat = new BABYLON.PBRMaterial('mat_f1_barrier', scene);
    barrierMat.albedoColor = new BABYLON.Color3(0.85, 0.88, 0.92);
    barrierMat.roughness = 0.35;
    barrierMat.metallic = 0.65;

    // 1. TERRENO DE GRAMA BASE
    const ground = BABYLON.MeshBuilder.CreateGround('f1_ground', { width: 2200, height: 2200 }, scene);
    ground.position.y = -0.2;
    ground.material = grassMat;
    ground.parent = root;
    ground.receiveShadows = true;

    // 2. FITA DE ASFALTO (ROAD SURFACE)
    const n = circuit.count;
    const halfWidth = circuit.width ? circuit.width / 2 : 7.0;

    const roadPositions = [];
    const roadIndices = [];
    const roadUvs = [];

    const curbPositionsL = [];
    const curbIndicesL = [];
    const curbUvsL = [];

    const curbPositionsR = [];
    const curbIndicesR = [];
    const curbUvsR = [];

    for (let i = 0; i <= n; i++) {
        const idx = i % n;
        const cx = circuit.cx[idx];
        const cz = circuit.cz[idx];
        const cy = circuit.y ? circuit.y[idx] : 0;
        const nx = circuit.nx[idx];
        const nz = circuit.nz[idx];

        // Pontos esquerdo e direito da pista
        const lx = cx - nx * halfWidth;
        const lz = cz - nz * halfWidth;
        const rx = cx + nx * halfWidth;
        const rz = cz + nz * halfWidth;

        roadPositions.push(lx, cy + 0.02, lz);
        roadPositions.push(rx, cy + 0.02, rz);

        const v = (i / n) * 40;
        roadUvs.push(0, v);
        roadUvs.push(1, v);

        // Zebras nas margens
        const clx = cx - nx * (halfWidth + 1.2);
        const clz = cz - nz * (halfWidth + 1.2);
        curbPositionsL.push(clx, cy + 0.04, clz);
        curbPositionsL.push(lx, cy + 0.04, lz);
        curbUvsL.push(0, v * 2);
        curbUvsL.push(1, v * 2);

        const crx = cx + nx * (halfWidth + 1.2);
        const crz = cz + nz * (halfWidth + 1.2);
        curbPositionsR.push(rx, cy + 0.04, rz);
        curbPositionsR.push(crx, cy + 0.04, crz);
        curbUvsR.push(0, v * 2);
        curbUvsR.push(1, v * 2);
    }

    for (let i = 0; i < n; i++) {
        const a = i * 2;
        const b = a + 1;
        const c = (i + 1) * 2;
        const d = c + 1;

        roadIndices.push(a, b, c);
        roadIndices.push(b, d, c);

        curbIndicesL.push(a, b, c);
        curbIndicesL.push(b, d, c);

        curbIndicesR.push(a, b, c);
        curbIndicesR.push(b, d, c);
    }

    // Malha do Asfalto
    const roadMesh = new BABYLON.Mesh('f1_track_road', scene);
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

    // Malhas das Zebras
    const curbMeshL = new BABYLON.Mesh('f1_track_curb_l', scene);
    const curbNormalsL = [];
    BABYLON.VertexData.ComputeNormals(curbPositionsL, curbIndicesL, curbNormalsL);
    const curbVDL = new BABYLON.VertexData();
    curbVDL.positions = curbPositionsL;
    curbVDL.indices = curbIndicesL;
    curbVDL.normals = curbNormalsL;
    curbVDL.uvs = curbUvsL;
    curbVDL.applyToMesh(curbMeshL, false);
    curbMeshL.material = curbMat;
    curbMeshL.parent = root;

    const curbMeshR = new BABYLON.Mesh('f1_track_curb_r', scene);
    const curbNormalsR = [];
    BABYLON.VertexData.ComputeNormals(curbPositionsR, curbIndicesR, curbNormalsR);
    const curbVDR = new BABYLON.VertexData();
    curbVDR.positions = curbPositionsR;
    curbVDR.indices = curbIndicesR;
    curbVDR.normals = curbNormalsR;
    curbVDR.uvs = curbUvsR;
    curbVDR.applyToMesh(curbMeshR, false);
    curbMeshR.material = curbMat;
    curbMeshR.parent = root;

    // 3. ILUMINAÇÃO & DOMO DO CÉU
    const skyDome = BABYLON.MeshBuilder.CreateSphere('skyDome', { diameter: 1800, segments: 24 }, scene);
    const skyMat = new BABYLON.StandardMaterial('mat_f1_sky', scene);
    skyMat.backFaceCulling = false;
    skyMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    skyMat.emissiveColor = new BABYLON.Color3(0.52, 0.72, 0.95);
    skyMat.specularColor = new BABYLON.Color3(0, 0, 0);
    skyDome.material = skyMat;

    const hemi = new BABYLON.HemisphericLight('hemi_light', new BABYLON.Vector3(0, 1, 0), scene);
    hemi.diffuse = new BABYLON.Color3(0.9, 0.95, 1.0);
    hemi.groundColor = new BABYLON.Color3(0.2, 0.35, 0.2);
    hemi.intensity = 1.0;

    const sun = new BABYLON.DirectionalLight('sun_light', new BABYLON.Vector3(0.4, -0.7, 0.5).normalize(), scene);
    sun.position = new BABYLON.Vector3(-150, 250, -200);
    sun.diffuse = new BABYLON.Color3(1.0, 0.98, 0.92);
    sun.intensity = 1.6;

    const shadowGen = new BABYLON.ShadowGenerator(2048, sun);
    shadowGen.usePoissonSampling = true;

    return { root, roadMesh, shadowGen };
}
