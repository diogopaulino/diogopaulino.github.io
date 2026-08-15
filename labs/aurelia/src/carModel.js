/**
 * Modelagem 3D do Supercarro para Aurelia Festival em Babylon.js.
 * Pintura automotiva PBR com verniz clearCoat, faróis de LED, lanternas neon e rodas de liga leve.
 */

import { rimTexture } from './textures.js';

export function buildSupercar(BABYLON, scene, colorHex = '#e11d48') {
    const root = new BABYLON.TransformNode('supercar_root', scene);

    const paintMat = new BABYLON.PBRMaterial('mat_car_paint', scene);
    paintMat.albedoColor = BABYLON.Color3.FromHexString(colorHex);
    paintMat.metallic = 0.5;
    paintMat.roughness = 0.12;
    paintMat.clearCoat.isEnabled = true;
    paintMat.clearCoat.intensity = 1.0;
    paintMat.clearCoat.roughness = 0.04;

    const glassMat = new BABYLON.PBRMaterial('mat_car_glass', scene);
    glassMat.albedoColor = new BABYLON.Color3(0.08, 0.1, 0.12);
    paintMat.metallic = 0.8;
    paintMat.roughness = 0.05;

    const tireMat = new BABYLON.PBRMaterial('mat_car_tire', scene);
    tireMat.albedoColor = new BABYLON.Color3(0.14, 0.14, 0.16);
    tireMat.roughness = 0.8;

    const headMat = new BABYLON.StandardMaterial('mat_headlight', scene);
    headMat.emissiveColor = new BABYLON.Color3(1.0, 1.0, 1.0);

    const tailMat = new BABYLON.StandardMaterial('mat_taillight', scene);
    tailMat.emissiveColor = new BABYLON.Color3(1.0, 0.1, 0.1);

    // 1. CARROCERIA / CHASSIS
    const body = BABYLON.MeshBuilder.CreateBox('car_body', { width: 1.9, height: 0.52, depth: 4.4 }, scene);
    body.position.set(0, 0.42, 0);
    body.material = paintMat;
    body.parent = root;

    // Capô inclinado
    const hood = BABYLON.MeshBuilder.CreateBox('car_hood', { width: 1.82, height: 0.28, depth: 1.6 }, scene);
    hood.position.set(0, 0.48, 1.35);
    hood.rotation.x = 0.08;
    hood.material = paintMat;
    hood.parent = root;

    // Cabine / Teto com vidros
    const cabin = BABYLON.MeshBuilder.CreateBox('car_cabin', { width: 1.48, height: 0.52, depth: 1.9 }, scene);
    cabin.position.set(0, 0.82, -0.2);
    cabin.material = glassMat;
    cabin.parent = root;

    // Faróis dianteiros de LED
    for (const sx of [-1, 1]) {
        const hl = BABYLON.MeshBuilder.CreateBox(`hl_${sx}`, { width: 0.32, height: 0.08, depth: 0.08 }, scene);
        hl.position.set(sx * 0.72, 0.48, 2.2);
        hl.material = headMat;
        hl.parent = root;
    }

    // Barra de lanterna traseira de LED
    const taillight = BABYLON.MeshBuilder.CreateBox('car_taillight', { width: 1.7, height: 0.06, depth: 0.06 }, scene);
    taillight.position.set(0, 0.52, -2.2);
    taillight.material = tailMat;
    taillight.parent = root;

    // Escapamentos
    for (const sx of [-1, 1]) {
        const ex = BABYLON.MeshBuilder.CreateCylinder(`ex_${sx}`, { height: 0.2, diameter: 0.12, tessellation: 12 }, scene);
        ex.rotation.x = Math.PI / 2;
        ex.position.set(sx * 0.42, 0.26, -2.22);
        ex.material = glassMat;
        ex.parent = root;
    }

    // 2. 4 RODAS DE LIGA LEVE
    const wheelConfigs = [
        { key: 'fl', x: 0.92, y: 0.35, z: 1.35, isFront: true },
        { key: 'fr', x: -0.92, y: 0.35, z: 1.35, isFront: true },
        { key: 'rl', x: 0.94, y: 0.35, z: -1.35, isFront: false },
        { key: 'rr', x: -0.94, y: 0.35, z: -1.35, isFront: false }
    ];

    const wheels = {};
    wheelConfigs.forEach((cfg) => {
        const pivot = new BABYLON.TransformNode(`wheel_pivot_${cfg.key}`, scene);
        pivot.position.set(cfg.x, cfg.y, cfg.z);
        pivot.parent = root;

        const tire = BABYLON.MeshBuilder.CreateCylinder(`tire_${cfg.key}`, {
            height: 0.32,
            diameter: 0.72,
            tessellation: 20
        }, scene);
        tire.rotation.z = Math.PI / 2;
        tire.material = tireMat;
        tire.parent = pivot;

        wheels[cfg.key] = { pivot, tire, isFront: cfg.isFront };
    });

    return { root, body, wheels, taillight };
}

export function updateSupercarVisuals(carObj, speed, steerAngle, isDrifting, dt) {
    if (!carObj) return;

    // Rotação das rodas com a velocidade
    const rotSpeed = (speed / 0.36) * dt;
    Object.values(carObj.wheels).forEach((w) => {
        w.tire.rotation.x += rotSpeed;
    });

    // Esterçamento dianteiro
    carObj.wheels.fl.pivot.rotation.y = steerAngle;
    carObj.wheels.fr.pivot.rotation.y = steerAngle;
}
