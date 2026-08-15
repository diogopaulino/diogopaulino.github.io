/**
 * Cenário de desembarque costeiro para Honor Front em Babylon.js.
 * Praia da Normandia, arrebentação, muralha de contenção, trincheiras e bateria costeira.
 */

import { WORLD } from './config.js';
import { sandTexture, concreteTexture } from './textures.js';
import { buildCzechHedgehog, buildBunker } from './models.js';

export function heightAt(x, z) {
    if (z < -80) return WORLD.waterY || 0;
    if (z < 30) {
        // Praia inclinada
        const t = (z + 80) / 110;
        return t * 3.5;
    }
    if (z < 60) {
        // Muralha / Aclive
        const t = (z - 30) / 30;
        return 3.5 + t * 4.0;
    }
    if (z < 180) {
        // Platô e trincheiras
        const t = (z - 60) / 120;
        return 7.5 + t * 5.0;
    }
    // Penhasco da bateria
    const t = Math.min(1, (z - 180) / 80);
    return 12.5 + t * 14.0;
}

export function buildCombatWorld(BABYLON, scene) {
    const root = new BABYLON.TransformNode('world_root', scene);

    const sandTex = sandTexture(scene);
    const sandMat = new BABYLON.PBRMaterial('mat_beach_sand', scene);
    sandMat.albedoColor = new BABYLON.Color3(0.85, 0.72, 0.52);
    sandMat.albedoTexture = sandTex;
    sandMat.roughness = 0.92;
    sandMat.metallic = 0.02;

    // Terreno da Praia e Colina
    const ground = BABYLON.MeshBuilder.CreateGround('beach_ground', {
        width: 140,
        height: 480,
        subdivisions: 48
    }, scene);
    ground.position.set(0, 0, 80);

    const positions = ground.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2] + 80;
        positions[i + 1] = heightAt(x, z);
    }
    ground.setVerticesData(BABYLON.VertexBuffer.PositionKind, positions);
    ground.material = sandMat;
    ground.parent = root;
    ground.receiveShadows = true;

    // Oceano / Água rasa
    const oceanMat = new BABYLON.PBRMaterial('mat_ocean', scene);
    oceanMat.albedoColor = new BABYLON.Color3(0.12, 0.24, 0.32);
    oceanMat.roughness = 0.12;
    oceanMat.clearCoat.isEnabled = true;
    oceanMat.clearCoat.intensity = 0.9;

    const ocean = BABYLON.MeshBuilder.CreateGround('ocean_water', {
        width: 300,
        height: 200
    }, scene);
    ocean.position.set(0, (WORLD.waterY || 0) + 0.1, -120);
    ocean.material = oceanMat;
    ocean.parent = root;

    // Obstáculos na Praia (Hedgehogs)
    const hedgehogZ = [-20, 0, 20];
    for (const hz of hedgehogZ) {
        for (let hx = -35; hx <= 35; hx += 14) {
            const h = buildCzechHedgehog(BABYLON, scene);
            h.position.set(hx + (Math.random() - 0.5) * 4, heightAt(hx, hz) + 0.8, hz);
            h.parent = root;
        }
    }

    // Bunkers de Concreto na Muralha
    const bunker1 = buildBunker(BABYLON, scene);
    bunker1.position.set(-18, heightAt(-18, 55), 55);
    bunker1.parent = root;

    const bunker2 = buildBunker(BABYLON, scene);
    bunker2.position.set(18, heightAt(18, 55), 55);
    bunker2.parent = root;

    return { root, ground, ocean };
}
