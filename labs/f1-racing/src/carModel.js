/**
 * Modelo procedural do carro de F1 em Babylon.js com pintura automotiva PBR, fibra de carbono e DRS ativo.
 */

import { carbonTexture, tireSidewallTexture } from './textures.js';

export function buildF1Car(BABYLON, scene, liveryColor = '#e10600') {
    const root = new BABYLON.TransformNode('f1_car_root', scene);

    const carbonTex = carbonTexture(scene);
    const sidewallTex = tireSidewallTexture('soft', scene);

    // Pintura automotiva brilhante (Gloss Livery)
    const paintMat = new BABYLON.PBRMaterial('mat_f1_paint', scene);
    paintMat.albedoColor = BABYLON.Color3.FromHexString(liveryColor);
    paintMat.metallic = 0.45;
    paintMat.roughness = 0.15;
    paintMat.clearCoat.isEnabled = true;
    paintMat.clearCoat.intensity = 1.0;
    paintMat.clearCoat.roughness = 0.05;

    // Fibra de carbono exposta
    const carbonMat = new BABYLON.PBRMaterial('mat_f1_carbon', scene);
    carbonMat.albedoColor = new BABYLON.Color3(0.18, 0.18, 0.2);
    carbonMat.albedoTexture = carbonTex;
    carbonMat.metallic = 0.15;
    carbonMat.roughness = 0.45;

    // Borracha dos Pneus
    const tireMat = new BABYLON.PBRMaterial('mat_f1_tire', scene);
    tireMat.albedoColor = new BABYLON.Color3(0.12, 0.12, 0.14);
    tireMat.roughness = 0.75;

    // 1. CHASSIS / MONOCOQUE
    const nose = BABYLON.MeshBuilder.CreateCylinder('f1_nose', {
        height: 2.4,
        diameterTop: 0.18,
        diameterBottom: 0.58,
        tessellation: 16
    }, scene);
    nose.rotation.x = Math.PI / 2;
    nose.position.set(0, 0.32, 1.3);
    nose.material = paintMat;
    nose.parent = root;

    const cockpit = BABYLON.MeshBuilder.CreateBox('f1_cockpit', { width: 0.72, height: 0.48, depth: 1.6 }, scene);
    cockpit.position.set(0, 0.38, -0.4);
    cockpit.material = paintMat;
    cockpit.parent = root;

    const engineCover = BABYLON.MeshBuilder.CreateCylinder('f1_engine_cover', {
        height: 1.5,
        diameterTop: 0.62,
        diameterBottom: 0.25,
        tessellation: 16
    }, scene);
    engineCover.rotation.x = Math.PI / 2;
    engineCover.position.set(0, 0.48, -1.3);
    engineCover.material = paintMat;
    engineCover.parent = root;

    // 2. HALO DE SEGURANÇA
    const haloLoop = BABYLON.MeshBuilder.CreateTorus('f1_halo', {
        diameter: 0.52,
        thickness: 0.045,
        tessellation: 20
    }, scene);
    haloLoop.rotation.x = Math.PI / 2;
    haloLoop.position.set(0, 0.68, -0.15);
    haloLoop.material = carbonMat;
    haloLoop.parent = root;

    // 3. CAPACETE DO PILOTO
    const helmet = BABYLON.MeshBuilder.CreateSphere('f1_helmet', { diameter: 0.26, segments: 12 }, scene);
    helmet.position.set(0, 0.55, -0.3);
    const helmetMat = new BABYLON.PBRMaterial('mat_f1_helmet', scene);
    helmetMat.albedoColor = new BABYLON.Color3(1.0, 0.85, 0.1);
    helmetMat.clearCoat.isEnabled = true;
    helmet.material = helmetMat;
    helmet.parent = root;

    // 4. ASA DIANTEIRA (Front Wing)
    const frontWingMain = BABYLON.MeshBuilder.CreateBox('f1_fw_main', { width: 1.8, height: 0.04, depth: 0.42 }, scene);
    frontWingMain.position.set(0, 0.14, 2.3);
    frontWingMain.material = carbonMat;
    frontWingMain.parent = root;

    // Endplates dianteiros
    for (const sx of [-1, 1]) {
        const ep = BABYLON.MeshBuilder.CreateBox(`f1_fw_ep_${sx}`, { width: 0.03, height: 0.22, depth: 0.45 }, scene);
        ep.position.set(sx * 0.9, 0.22, 2.3);
        ep.material = paintMat;
        ep.parent = root;
    }

    // 5. ASA TRASEIRA COM DRS ATIVO (Rear Wing)
    const rearWingPlates = [];
    for (const sx of [-1, 1]) {
        const ep = BABYLON.MeshBuilder.CreateBox(`f1_rw_ep_${sx}`, { width: 0.03, height: 0.55, depth: 0.42 }, scene);
        ep.position.set(sx * 0.65, 0.72, -2.1);
        ep.material = paintMat;
        ep.parent = root;
        rearWingPlates.push(ep);
    }

    const rwBase = BABYLON.MeshBuilder.CreateBox('f1_rw_base', { width: 1.28, height: 0.04, depth: 0.35 }, scene);
    rwBase.position.set(0, 0.68, -2.1);
    rwBase.material = carbonMat;
    rwBase.parent = root;

    // Flap DRS móvel
    const drsFlap = BABYLON.MeshBuilder.CreateBox('f1_drs_flap', { width: 1.28, height: 0.03, depth: 0.2 }, scene);
    drsFlap.position.set(0, 0.88, -2.15);
    drsFlap.material = carbonMat;
    drsFlap.parent = root;

    // 6. 4 RODAS E SUSPENSÕES
    const wheelConfigs = [
        { key: 'fl', x: 0.82, y: 0.34, z: 1.45, isFront: true },
        { key: 'fr', x: -0.82, y: 0.34, z: 1.45, isFront: true },
        { key: 'rl', x: 0.82, y: 0.36, z: -1.45, isFront: false },
        { key: 'rr', x: -0.82, y: 0.36, z: -1.45, isFront: false }
    ];

    const wheels = {};
    wheelConfigs.forEach((cfg) => {
        const pivot = new BABYLON.TransformNode(`wheel_pivot_${cfg.key}`, scene);
        pivot.position.set(cfg.x, cfg.y, cfg.z);
        pivot.parent = root;

        const tire = BABYLON.MeshBuilder.CreateCylinder(`tire_${cfg.key}`, {
            height: cfg.isFront ? 0.35 : 0.44,
            diameter: 0.68,
            tessellation: 24
        }, scene);
        tire.rotation.z = Math.PI / 2;
        tire.material = tireMat;
        tire.parent = pivot;

        wheels[cfg.key] = { pivot, tire, isFront: cfg.isFront };
    });

    return { root, drsFlap, wheels };
}

export function updateCarVisuals(carObj, speed, steerAngle, drsActive, dt) {
    if (!carObj) return;

    // Rotação das rodas com a velocidade
    const rotSpeed = (speed / 0.34) * dt;
    Object.values(carObj.wheels).forEach((w) => {
        w.tire.rotation.x += rotSpeed;
    });

    // Esterçamento das rodas dianteiras
    carObj.wheels.fl.pivot.rotation.y = steerAngle;
    carObj.wheels.fr.pivot.rotation.y = steerAngle;

    // Abertura do flap DRS (ângulo de 22 graus quando ativo)
    const targetDrsRot = drsActive ? -0.38 : 0;
    carObj.drsFlap.rotation.x += (targetDrsRot - carObj.drsFlap.rotation.x) * Math.min(1, dt * 15);
}
