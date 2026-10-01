/**
 * Materiais compartilhados (PBR leve).
 * Paleta: manhã de inverno no porto — ocre de armazém, aço escuro, café.
 */

import * as THREE from 'three';

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
        quay: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#6a655c'),
            roughness: 0.92,
            metalness: 0.02
        }),
        brick: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#8a6a4e'),
            roughness: 0.88,
            metalness: 0.02
        }),
        plaster: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#c4b59a'),
            roughness: 0.85,
            metalness: 0.01
        }),
        roof: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#4a3a32'),
            roughness: 0.9,
            metalness: 0.05
        }),
        steel: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#2c3036'),
            roughness: 0.45,
            metalness: 0.65
        }),
        hull: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#1e2430'),
            roughness: 0.55,
            metalness: 0.35
        }),
        hullBoot: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#6b2a1e'),
            roughness: 0.7,
            metalness: 0.15
        }),
        deck: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#8b7355'),
            roughness: 0.82,
            metalness: 0.05
        }),
        funnel: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#1a1a1c'),
            roughness: 0.5,
            metalness: 0.4
        }),
        funnelBand: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#c4a35a'),
            roughness: 0.55,
            metalness: 0.3
        }),
        sack: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#a89060'),
            roughness: 0.95,
            metalness: 0
        }),
        rail: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#3a3a3c'),
            roughness: 0.4,
            metalness: 0.7
        }),
        wood: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#5c4030'),
            roughness: 0.9,
            metalness: 0
        }),
        skin: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#c4a07a'),
            roughness: 0.75,
            metalness: 0
        }),
        cloth: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#3a4550'),
            roughness: 0.9,
            metalness: 0
        }),
        clothLight: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#d8d0c0'),
            roughness: 0.88,
            metalness: 0
        }),
        foliage: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#2d4a28'),
            roughness: 0.95,
            metalness: 0
        }),
        mountain: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#3a4a38'),
            roughness: 0.95,
            metalness: 0,
            flatShading: true
        }),
        sand: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#8a7a60'),
            roughness: 0.98,
            metalness: 0
        }),
        white: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#e8e4dc'),
            roughness: 0.7,
            metalness: 0.1
        }),
        glass: new THREE.MeshStandardMaterial({
            color: new THREE.Color('#8ab0c4'),
            roughness: 0.15,
            metalness: 0.3,
            transparent: true,
            opacity: 0.55
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
