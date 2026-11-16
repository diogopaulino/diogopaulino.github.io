/**
 * Sala de leitura: panorama 360° local (`reading-room.webp`) como cenário — um
 * desenho, sem luzes ou centenas de meshes por quadro. A luz e os reflexos das
 * peças continuam vindo do HDRI; o panorama é só o que se vê ao fundo.
 * O panorama já traz piso e tapete, então os do cenário 3D são desligados
 * quando ele carrega. Se a imagem falhar, o fundo vira o próprio HDRI desfocado.
 */
import { ENV_ROTATION } from './world.js?v=4';

const BLUR = 0.12;

export function buildRoom(B, scene, floorMeshes = []) {
    const dome = new B.PhotoDome('reading_room', new URL('../assets/reading-room.webp', import.meta.url).href, {
        resolution: 32, size: 80, useDirectMapping: true, faceForward: false,
        generateMipMaps: true
    }, scene);
    dome.position.y = -4;
    dome.rotation.y = Math.PI * 0.65;
    dome.mesh.isPickable = false;
    dome.onLoadObservable.addOnce(() => floorMeshes.forEach(mesh => mesh.setEnabled(false)));
    dome.onLoadErrorObservable.addOnce(() => {
        dome.setEnabled(false);
        buildFallbackRoom(B, scene);
    });
    return dome;
}

/** Reserva: o HDRI do lounge desenhado como céu desfocado (nível de rugosidade BLUR). */
function buildFallbackRoom(B, scene) {
    const env = scene.environmentTexture;
    if (!env) return null;
    const box = scene.createDefaultSkybox(env, true, 600, BLUR, false);
    if (!box) return null;
    box.name = 'lounge_backdrop';
    box.isPickable = false;
    box.infiniteDistance = true;
    const tex = box.material?.reflectionTexture;
    if (tex) tex.rotationY = ENV_ROTATION;
    return box;
}
