/**
 * Castelo cinematográfico em Babylon.js — silhueta de torres cónicas azuis,
 * calcário claro e pináculos dourados no espírito da abertura de cinema.
 */

import { limestone, roofTiles, goldOrnament } from './textures.js';

export function buildCastle(BABYLON, scene) {
    const root = new BABYLON.TransformNode('castle_root', scene);

    const stoneTex = limestone(scene);
    const roofTex = roofTiles(scene);
    const goldTex = goldOrnament(scene);

    // Materiais PBR do Castelo
    const stoneMat = new BABYLON.PBRMaterial('mat_castle_stone', scene);
    stoneMat.albedoColor = new BABYLON.Color3(0.98, 0.94, 0.88);
    stoneMat.albedoTexture = stoneTex.map;
    stoneMat.bumpTexture = stoneTex.normalMap;
    stoneMat.roughness = 0.72;
    stoneMat.metallic = 0.03;

    const roofMat = new BABYLON.PBRMaterial('mat_castle_roof', scene);
    roofMat.albedoColor = new BABYLON.Color3(0.35, 0.52, 0.85);
    roofMat.albedoTexture = roofTex.map;
    roofMat.bumpTexture = roofTex.normalMap;
    roofMat.roughness = 0.45;
    roofMat.metallic = 0.15;
    roofMat.clearCoat.isEnabled = true;
    roofMat.clearCoat.intensity = 0.4;

    const goldMat = new BABYLON.PBRMaterial('mat_castle_gold', scene);
    goldMat.albedoColor = new BABYLON.Color3(0.92, 0.78, 0.28);
    goldMat.albedoTexture = goldTex;
    goldMat.roughness = 0.22;
    goldMat.metallic = 0.88;

    const windowMat = new BABYLON.StandardMaterial('mat_castle_window', scene);
    windowMat.diffuseColor = new BABYLON.Color3(1.0, 0.85, 0.5);
    windowMat.emissiveColor = new BABYLON.Color3(1.0, 0.75, 0.35);

    const darkMat = new BABYLON.PBRMaterial('mat_castle_dark', scene);
    darkMat.albedoColor = new BABYLON.Color3(0.1, 0.08, 0.06);
    darkMat.roughness = 0.9;

    // 1. BASE / MURALHAS
    const base = BABYLON.MeshBuilder.CreateBox('c_base', { width: 14, height: 4, depth: 10 }, scene);
    base.position.set(0, 2, 0);
    base.material = stoneMat;
    base.parent = root;
    base.receiveShadows = true;

    const rampartL = BABYLON.MeshBuilder.CreateBox('c_rampart_l', { width: 18, height: 3, depth: 2 }, scene);
    rampartL.position.set(0, 1.5, 5.5);
    rampartL.material = stoneMat;
    rampartL.parent = root;
    rampartL.receiveShadows = true;

    // Portal central em arco
    const gate = BABYLON.MeshBuilder.CreateBox('c_gate', { width: 3.2, height: 3.8, depth: 2.2 }, scene);
    gate.position.set(0, 1.9, 5.6);
    gate.material = darkMat;
    gate.parent = root;

    // 2. TORRE CENTRAL PRINCIPAL (Donjon / Torre da Coroa)
    const midTower = BABYLON.MeshBuilder.CreateCylinder('c_mid_tower', { height: 9, diameter: 5.5, tessellation: 32 }, scene);
    midTower.position.set(0, 8.5, -1);
    midTower.material = stoneMat;
    midTower.parent = root;

    const grandTower = BABYLON.MeshBuilder.CreateCylinder('c_grand_tower', { height: 11, diameter: 3.6, tessellation: 32 }, scene);
    grandTower.position.set(0, 17.5, -1);
    grandTower.material = stoneMat;
    grandTower.parent = root;

    const grandRoof = BABYLON.MeshBuilder.CreateCylinder('c_grand_roof', { height: 8, diameterTop: 0, diameterBottom: 4.2, tessellation: 32 }, scene);
    grandRoof.position.set(0, 26, -1);
    grandRoof.material = roofMat;
    grandRoof.parent = root;

    const grandSpire = BABYLON.MeshBuilder.CreateCylinder('c_grand_spire', { height: 3.5, diameterTop: 0, diameterBottom: 0.25, tessellation: 12 }, scene);
    grandSpire.position.set(0, 31, -1);
    grandSpire.material = goldMat;
    grandSpire.parent = root;

    // 3. TORRES LATERAIS (4 Cantos)
    const towerCoords = [
        [-6.5, 4.5], [6.5, 4.5], [-6.5, -4.5], [6.5, -4.5],
        [-3.2, 1.5], [3.2, 1.5]
    ];

    const towers = [];
    towerCoords.forEach(([x, z], i) => {
        const height = i >= 4 ? 14 : 10;
        const radius = i >= 4 ? 1.4 : 1.8;

        const body = BABYLON.MeshBuilder.CreateCylinder(`c_tower_${i}`, { height, diameter: radius * 2, tessellation: 24 }, scene);
        body.position.set(x, height / 2 + 1, z);
        body.material = stoneMat;
        body.parent = root;

        const roofH = i >= 4 ? 6.5 : 5.5;
        const roof = BABYLON.MeshBuilder.CreateCylinder(`c_roof_${i}`, { height: roofH, diameterTop: 0, diameterBottom: (radius + 0.3) * 2, tessellation: 24 }, scene);
        roof.position.set(x, height + roofH / 2 + 1, z);
        roof.material = roofMat;
        roof.parent = root;

        const spire = BABYLON.MeshBuilder.CreateCylinder(`c_spire_${i}`, { height: 2, diameterTop: 0, diameterBottom: 0.18, tessellation: 8 }, scene);
        spire.position.set(x, height + roofH + 2, z);
        spire.material = goldMat;
        spire.parent = root;

        towers.push(body, roof, spire);
    });

    // 4. JANELAS ILUMINADAS (Brilho aconchegante de conto de fadas)
    const windows = [];
    const winCoords = [
        [0, 15, 0.82], [0, 19, 0.82], [-1.2, 16, 0.5], [1.2, 16, 0.5],
        [0, 7, 1.8], [-2.5, 5, 2.8], [2.5, 5, 2.8]
    ];

    winCoords.forEach(([x, y, z], i) => {
        const win = BABYLON.MeshBuilder.CreateBox(`c_win_${i}`, { width: 0.55, height: 1.1, depth: 0.2 }, scene);
        win.position.set(x, y, z - 1);
        win.material = windowMat;
        win.parent = root;
        windows.push(win);
    });

    return { root, windows, stoneMat, roofMat, goldMat, windowMat };
}
