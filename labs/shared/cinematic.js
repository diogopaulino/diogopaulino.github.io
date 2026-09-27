/**
 * Preset visual compartilhado para labs three.js cinematográficos.
 * Mantém o custo previsível: IBL sutil, ACES, sombras suaves e materiais PBR
 * sem obrigar pós-processamento pesado em mobile/low.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function configureCinematicRenderer(renderer, {
    exposure = null,
    shadows = true
} = {}) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    if (Number.isFinite(exposure)) renderer.toneMappingExposure = exposure;
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
    const room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose?.();
    scene.environment = environment;
    scene.environmentIntensity = intensity;
    pmrem.dispose();
    return environment;
}
