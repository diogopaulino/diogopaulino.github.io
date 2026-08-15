/**
 * Cavalo + cavaleiro em Babylon.js com marcha procedural (passo, trote, galope).
 */

import { stdMat } from './models.js';

export function buildHorse(BABYLON, scene) {
    const root = new BABYLON.TransformNode('horse_root', scene);

    const coat = stdMat(BABYLON, 'mat_horse_coat', '#c47838', 0.65, scene);
    const dark = stdMat(BABYLON, 'mat_horse_dark', '#1a120c', 0.8, scene);
    const cream = stdMat(BABYLON, 'mat_horse_cream', '#e8dcc4', 0.65, scene);
    const leather = stdMat(BABYLON, 'mat_leather', '#4a2412', 0.7, scene);
    const shirt = stdMat(BABYLON, 'mat_shirt', '#8c281e', 0.75, scene);
    const skin = stdMat(BABYLON, 'mat_skin', '#c4a07a', 0.65, scene);
    const hat = stdMat(BABYLON, 'mat_hat', '#2a2018', 0.8, scene);

    // 1. CORPO DO CAVALO
    const body = BABYLON.MeshBuilder.CreateSphere('h_body', { diameter: 1.05, segments: 12 }, scene);
    body.scaling.set(1.05, 0.92, 1.85);
    body.position.set(0, 1.18, 0);
    body.material = coat;
    body.parent = root;

    const chest = BABYLON.MeshBuilder.CreateSphere('h_chest', { diameter: 0.8, segments: 10 }, scene);
    chest.position.set(0, 1.16, 0.68);
    chest.material = coat;
    chest.parent = root;

    const rump = BABYLON.MeshBuilder.CreateSphere('h_rump', { diameter: 0.76, segments: 10 }, scene);
    rump.position.set(0, 1.20, -0.72);
    rump.material = coat;
    rump.parent = root;

    // Pescoço
    const neck = BABYLON.MeshBuilder.CreateCylinder('h_neck', { height: 0.82, diameterTop: 0.32, diameterBottom: 0.52, tessellation: 12 }, scene);
    neck.position.set(0, 1.62, 0.92);
    neck.rotation.x = 0.65;
    neck.material = coat;
    neck.parent = root;

    // Cabeça
    const headG = new BABYLON.TransformNode('h_head_node', scene);
    headG.position.set(0, 2.05, 1.28);
    headG.parent = root;

    const head = BABYLON.MeshBuilder.CreateSphere('h_head', { diameter: 0.42, segments: 10 }, scene);
    head.scaling.set(0.72, 0.78, 1.4);
    head.material = coat;
    head.parent = headG;

    const muzzle = BABYLON.MeshBuilder.CreateSphere('h_muzzle', { diameter: 0.24, segments: 8 }, scene);
    muzzle.position.set(0, -0.04, 0.32);
    muzzle.scaling.set(0.75, 0.65, 1.15);
    muzzle.material = cream;
    muzzle.parent = headG;

    // Orelhas e Olhos
    for (const sx of [-1, 1]) {
        const ear = BABYLON.MeshBuilder.CreateCylinder(`h_ear_${sx}`, { height: 0.18, diameterTop: 0, diameterBottom: 0.1, tessellation: 6 }, scene);
        ear.position.set(sx * 0.1, 0.22, -0.04);
        ear.rotation.z = -sx * 0.25;
        ear.material = coat;
        ear.parent = headG;

        const eye = BABYLON.MeshBuilder.CreateSphere(`h_eye_${sx}`, { diameter: 0.06, segments: 6 }, scene);
        eye.position.set(sx * 0.11, 0.04, 0.12);
        eye.material = dark;
        eye.parent = headG;
    }

    // Crina e Cauda
    const mane = BABYLON.MeshBuilder.CreateBox('h_mane', { width: 0.08, height: 0.58, depth: 0.72 }, scene);
    mane.position.set(0, 1.76, 0.72);
    mane.rotation.x = 0.55;
    mane.material = dark;
    mane.parent = root;

    const tailG = new BABYLON.TransformNode('h_tail_node', scene);
    tailG.position.set(0, 1.15, -1.05);
    tailG.parent = root;

    const tail = BABYLON.MeshBuilder.CreateCylinder('h_tail', { height: 0.95, diameterTop: 0.08, diameterBottom: 0.18, tessellation: 8 }, scene);
    tail.position.y = -0.45;
    tail.rotation.x = 0.35;
    tail.material = dark;
    tail.parent = tailG;

    // Sela
    const saddle = BABYLON.MeshBuilder.CreateBox('h_saddle', { width: 0.6, height: 0.15, depth: 0.65 }, scene);
    saddle.position.set(0, 1.68, 0);
    saddle.material = leather;
    saddle.parent = root;

    // 2. PERNAS ARTICULADAS (4 patas)
    const legs = {};
    const legConfigs = [
        { key: 'fl', x: 0.24, z: 0.55 },
        { key: 'fr', x: -0.24, z: 0.55 },
        { key: 'hl', x: 0.24, z: -0.55 },
        { key: 'hr', x: -0.24, z: -0.55 }
    ];

    legConfigs.forEach((cfg) => {
        const hip = new BABYLON.TransformNode(`hip_${cfg.key}`, scene);
        hip.position.set(cfg.x, 1.05, cfg.z);
        hip.parent = root;

        const thigh = BABYLON.MeshBuilder.CreateCylinder(`thigh_${cfg.key}`, { height: 0.55, diameterTop: 0.18, diameterBottom: 0.14, tessellation: 8 }, scene);
        thigh.position.y = -0.25;
        thigh.material = coat;
        thigh.parent = hip;

        const knee = new BABYLON.TransformNode(`knee_${cfg.key}`, scene);
        knee.position.y = -0.52;
        knee.parent = hip;

        const shin = BABYLON.MeshBuilder.CreateCylinder(`shin_${cfg.key}`, { height: 0.52, diameterTop: 0.13, diameterBottom: 0.10, tessellation: 8 }, scene);
        shin.position.y = -0.24;
        shin.material = coat;
        shin.parent = knee;

        const hoof = BABYLON.MeshBuilder.CreateCylinder(`hoof_${cfg.key}`, { height: 0.12, diameter: 0.14, tessellation: 8 }, scene);
        hoof.position.y = -0.50;
        hoof.material = dark;
        hoof.parent = knee;

        legs[cfg.key] = { hip, knee };
    });

    // 3. CAVALEIRO
    const rider = new BABYLON.TransformNode('rider_root', scene);
    rider.position.set(0, 1.75, 0.05);
    rider.parent = root;

    const torso = BABYLON.MeshBuilder.CreateBox('r_torso', { width: 0.44, height: 0.56, depth: 0.3 }, scene);
    torso.position.y = 0.32;
    torso.material = shirt;
    torso.parent = rider;

    const rHead = BABYLON.MeshBuilder.CreateSphere('r_head', { diameter: 0.28, segments: 10 }, scene);
    rHead.position.y = 0.72;
    rHead.material = skin;
    rHead.parent = rider;

    const rHatBrim = BABYLON.MeshBuilder.CreateDisc('r_hat_brim', { radius: 0.34, tessellation: 24 }, scene);
    rHatBrim.rotation.x = Math.PI / 2;
    rHatBrim.position.y = 0.85;
    rHatBrim.material = hat;
    rHatBrim.parent = rider;

    const rHatCrown = BABYLON.MeshBuilder.CreateCylinder('r_hat_crown', { height: 0.18, diameter: 0.26, tessellation: 16 }, scene);
    rHatCrown.position.y = 0.94;
    rHatCrown.material = hat;
    rHatCrown.parent = rider;

    return { root, body, headG, tailG, legs, rider };
}

export function animateHorse(horseObj, speed, distance, dt) {
    if (!horseObj) return;

    // Fase do galope
    const freq = Math.max(1.0, speed * 0.35);
    const phase = distance * 2.8;

    // Balanço diagonal das pernas
    const flAngle = Math.sin(phase) * 0.55;
    const frAngle = Math.sin(phase + Math.PI) * 0.55;
    const hlAngle = Math.sin(phase + Math.PI * 0.8) * 0.55;
    const hrAngle = Math.sin(phase - Math.PI * 0.2) * 0.55;

    horseObj.legs.fl.hip.rotation.x = flAngle;
    horseObj.legs.fr.hip.rotation.x = frAngle;
    horseObj.legs.hl.hip.rotation.x = hlAngle;
    horseObj.legs.hr.hip.rotation.x = hrAngle;

    horseObj.legs.fl.knee.rotation.x = Math.max(0, -flAngle * 0.8);
    horseObj.legs.fr.knee.rotation.x = Math.max(0, -frAngle * 0.8);
    horseObj.legs.hl.knee.rotation.x = Math.max(0, -hlAngle * 0.8);
    horseObj.legs.hr.knee.rotation.x = Math.max(0, -hrAngle * 0.8);

    // Oscilação vertical do corpo no galope
    horseObj.body.position.y = 1.18 + Math.abs(Math.sin(phase * 2)) * 0.12 * Math.min(1, speed / 10);
    horseObj.headG.rotation.x = Math.sin(phase) * 0.08;
    horseObj.tailG.rotation.z = Math.sin(phase * 0.5) * 0.2;
}
