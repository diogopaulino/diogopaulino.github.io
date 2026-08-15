/**
 * Modelos 3D procedurais em Babylon.js para Safari Dourado:
 * Jipe 4x4 de expedição, acácia de copa achatada e baobá monumental.
 */

export function buildJeep(BABYLON, scene) {
    const root = new BABYLON.TransformNode('jeep_root', scene);

    const bodyMat = new BABYLON.PBRMaterial('mat_jeep_body', scene);
    bodyMat.albedoColor = new BABYLON.Color3(0.78, 0.68, 0.45); // Khaki Safari
    bodyMat.roughness = 0.55;
    bodyMat.metallic = 0.15;

    const metalMat = new BABYLON.PBRMaterial('mat_jeep_metal', scene);
    metalMat.albedoColor = new BABYLON.Color3(0.18, 0.18, 0.2);
    metalMat.roughness = 0.45;
    metalMat.metallic = 0.8;

    const tireMat = new BABYLON.PBRMaterial('mat_jeep_tire', scene);
    tireMat.albedoColor = new BABYLON.Color3(0.12, 0.12, 0.14);
    tireMat.roughness = 0.85;

    // 1. CARROCERIA / CHASSIS
    const chassis = BABYLON.MeshBuilder.CreateBox('jeep_chassis', { width: 1.8, height: 0.72, depth: 3.4 }, scene);
    chassis.position.set(0, 0.75, 0);
    chassis.material = bodyMat;
    chassis.parent = root;

    // Cabine aberta com Santo Antônio (Rollcage)
    const rollcageL = BABYLON.MeshBuilder.CreateCylinder('rc_l', { height: 1.1, diameter: 0.08, tessellation: 8 }, scene);
    rollcageL.position.set(-0.8, 1.6, -0.4);
    rollcageL.material = metalMat;
    rollcageL.parent = root;

    const rollcageR = BABYLON.MeshBuilder.CreateCylinder('rc_r', { height: 1.1, diameter: 0.08, tessellation: 8 }, scene);
    rollcageR.position.set(0.8, 1.6, -0.4);
    rollcageR.material = metalMat;
    rollcageR.parent = root;

    const rollcageTop = BABYLON.MeshBuilder.CreateBox('rc_top', { width: 1.68, height: 0.08, depth: 0.08 }, scene);
    rollcageTop.position.set(0, 2.15, -0.4);
    rollcageTop.material = metalMat;
    rollcageTop.parent = root;

    // Para-brisa
    const windshield = BABYLON.MeshBuilder.CreateBox('jeep_windshield', { width: 1.6, height: 0.65, depth: 0.04 }, scene);
    windshield.position.set(0, 1.45, 0.65);
    windshield.rotation.x = 0.22;
    windshield.material = metalMat;
    windshield.parent = root;

    // Pneu sobressalente na traseira
    const spare = BABYLON.MeshBuilder.CreateCylinder('jeep_spare', { height: 0.32, diameter: 0.78, tessellation: 16 }, scene);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0, 0.9, -1.85);
    spare.material = tireMat;
    spare.parent = root;

    // Faróis dianteiros
    const headMat = new BABYLON.StandardMaterial('mat_j_headlight', scene);
    headMat.emissiveColor = new BABYLON.Color3(1.0, 0.95, 0.7);

    for (const sx of [-1, 1]) {
        const hl = BABYLON.MeshBuilder.CreateCylinder(`j_hl_${sx}`, { height: 0.1, diameter: 0.26, tessellation: 12 }, scene);
        hl.rotation.x = Math.PI / 2;
        hl.position.set(sx * 0.62, 0.82, 1.72);
        hl.material = headMat;
        hl.parent = root;
    }

    // 2. 4 RODAS OFF-ROAD
    const wheelConfigs = [
        { key: 'fl', x: 0.95, y: 0.45, z: 1.15, isFront: true },
        { key: 'fr', x: -0.95, y: 0.45, z: 1.15, isFront: true },
        { key: 'rl', x: 0.95, y: 0.45, z: -1.15, isFront: false },
        { key: 'rr', x: -0.95, y: 0.45, z: -1.15, isFront: false }
    ];

    const wheels = {};
    wheelConfigs.forEach((cfg) => {
        const pivot = new BABYLON.TransformNode(`wheel_pivot_${cfg.key}`, scene);
        pivot.position.set(cfg.x, cfg.y, cfg.z);
        pivot.parent = root;

        const tire = BABYLON.MeshBuilder.CreateCylinder(`tire_${cfg.key}`, {
            height: 0.35,
            diameter: 0.85,
            tessellation: 18
        }, scene);
        tire.rotation.z = Math.PI / 2;
        tire.material = tireMat;
        tire.parent = pivot;

        wheels[cfg.key] = { pivot, tire, isFront: cfg.isFront };
    });

    return { root, chassis, wheels };
}

export function buildAcacia(BABYLON, scene) {
    const root = new BABYLON.TransformNode('acacia_root', scene);

    const barkMat = new BABYLON.PBRMaterial('mat_acacia_bark', scene);
    barkMat.albedoColor = new BABYLON.Color3(0.42, 0.28, 0.18);
    barkMat.roughness = 0.92;

    const leafMat = new BABYLON.PBRMaterial('mat_acacia_leaf', scene);
    leafMat.albedoColor = new BABYLON.Color3(0.45, 0.58, 0.22);
    leafMat.roughness = 0.78;

    // Tronco esguio
    const trunk = BABYLON.MeshBuilder.CreateCylinder('acacia_trunk', { height: 6.5, diameterTop: 0.28, diameterBottom: 0.48, tessellation: 8 }, scene);
    trunk.position.y = 3.25;
    trunk.rotation.z = 0.08;
    trunk.material = barkMat;
    trunk.parent = root;

    // Copa achatada em disco (Guarda-chuva)
    const canopy1 = BABYLON.MeshBuilder.CreateDisc('acacia_canopy1', { radius: 4.8, tessellation: 16 }, scene);
    canopy1.rotation.x = Math.PI / 2;
    canopy1.position.y = 6.4;
    canopy1.material = leafMat;
    canopy1.parent = root;

    const canopy2 = BABYLON.MeshBuilder.CreateDisc('acacia_canopy2', { radius: 3.6, tessellation: 16 }, scene);
    canopy2.rotation.x = Math.PI / 2;
    canopy2.position.y = 6.8;
    canopy2.material = leafMat;
    canopy2.parent = root;

    return root;
}
