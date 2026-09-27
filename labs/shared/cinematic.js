/**
 * Preset visual compartilhado para labs three.js cinematográficos.
 * Mantém o custo previsível: IBL sutil, ACES, sombras suaves e materiais PBR
 * sem obrigar pós-processamento pesado em mobile/low.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function configureCinematicRenderer(renderer, {
    exposure = 1.0,
    shadows = true
} = {}) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;
    renderer.shadowMap.enabled = shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

export function applyCinematicEnvironment(scene, renderer, {
    intensity = 0.5
} = {}) {
    if (scene.environment) {
        scene.environmentIntensity = Math.max(scene.environmentIntensity ?? 0, intensity);
        return null;
    }
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    scene.environmentIntensity = intensity;
    pmrem.dispose();
    return environment;
}

export function tunePbrMaterials(root, {
    envMapIntensity = 1.0,
    softenClearcoat = true
} = {}) {
    root?.traverse?.((node) => {
        if (!node.isMesh || !node.material) return;
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const material of materials) {
            if (!material?.isMeshStandardMaterial && !material?.isMeshPhysicalMaterial) continue;
            material.envMapIntensity = Math.max(material.envMapIntensity ?? 1, envMapIntensity);
            if (material.isMeshPhysicalMaterial && softenClearcoat && material.clearcoat > 0.8) {
                material.clearcoatRoughness = Math.max(material.clearcoatRoughness ?? 0, 0.08);
            }
        }
    });
}
