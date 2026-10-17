/**
 * Materiais compartilhados (PBR procedural com mapas de normal e textura).
 * Paleta: manhã de inverno no porto — ocre de armazém, aço escuro, café.
 */

import * as THREE from 'three';
import {
    woodMaterial,
    brickMaterial,
    stoneMaterial,
    plasterMaterial,
    metalMaterial,
    burlapMaterial,
    roofTileMaterial,
    skinMaterial,
    clothMaterial
} from '../../shared/realism.js';

export function createMaterials() {
    const mats = {
        water: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#1a4a5c'),
            roughness: 0.18,
            metalness: 0.08,
            envMapIntensity: 0.7
        }),
        waterNear: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#2a5548'),
            roughness: 0.28,
            metalness: 0.05,
            envMapIntensity: 0.5
        }),
        quay: stoneMaterial(0x6a655c, { roughness: 0.9, repeatX: 18, repeatY: 4 }),
        brick: brickMaterial(0x8a5842, { mortar: 0xc2b8a6, roughness: 0.88, repeatX: 6, repeatY: 3 }),
        plaster: plasterMaterial(0xc4b59a, { roughness: 0.84, repeat: 4 }),
        roof: roofTileMaterial(0x5a3c32, { roughness: 0.8, repeatX: 8, repeatY: 3 }),
        steel: metalMaterial(0x2c3036, { roughness: 0.42, metalness: 0.72 }),
        hull: metalMaterial(0x1e2430, { roughness: 0.5, metalness: 0.42 }),
        hullBoot: metalMaterial(0x6b2a1e, { roughness: 0.65, metalness: 0.22 }),
        deck: woodMaterial(0x8b7355, { roughness: 0.78, planks: true, repeat: 6 }),
        funnel: metalMaterial(0x1a1a1c, { roughness: 0.48, metalness: 0.45 }),
        funnelBand: metalMaterial(0xc4a35a, { roughness: 0.42, metalness: 0.55 }),
        sack: burlapMaterial(0xa89060, { roughness: 0.94 }),
        rail: metalMaterial(0x3a3a3c, { roughness: 0.35, metalness: 0.78 }),
        wood: woodMaterial(0x5c4030, { roughness: 0.84, planks: true, repeat: 3 }),
        skin: skinMaterial(0xc4a07a),
        cloth: clothMaterial(0x3a4550, { roughness: 0.86 }),
        clothLight: clothMaterial(0xd8d0c0, { roughness: 0.84 }),
        foliage: new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#2d4a28'),
            roughness: 0.78,
            sheen: 0.35,
            sheenColor: new THREE.Color('#7ca868'),
            sheenRoughness: 0.6
        }),
        mountain: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#3a4a38'),
            roughness: 0.92,
            metalness: 0
        }),
        sand: plasterMaterial(0x8a7a60, { roughness: 0.95, repeat: 8 }),
        white: plasterMaterial(0xe8e4dc, { roughness: 0.68, repeat: 2 }),
        glass: new THREE.MeshPhysicalMaterial({
            color: new THREE.Color('#8ab0c4'),
            roughness: 0.12,
            metalness: 0.15,
            transmission: 0.35,
            transparent: true,
            opacity: 0.68
        }),
        smoke: new THREE.MeshBasicMaterial({
            color: new THREE.Color('#b8b4ae'),
            transparent: true,
            opacity: 0.35,
            depthWrite: false
        })
    };

    for (const m of Object.values(mats)) {
        if (m.isMeshStandardMaterial) m.envMapIntensity = m.envMapIntensity ?? 0.45;
    }

    return mats;
}

export function disposeMaterials(mats) {
    for (const m of Object.values(mats)) m.dispose?.();
}

