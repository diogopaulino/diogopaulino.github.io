/**
 * Sala: o próprio HDRI do lounge, desenhado como céu desfocado.
 * Nenhuma geometria extra — o fundo, a luz e os reflexos são a mesma imagem,
 * então tudo combina. O desfoque (BLUR) lê o mapa pré-filtrado num nível de
 * rugosidade intermediário: vira o bokeh de uma lente aberta, sem custo.
 */
import { ENV_ROTATION } from './world.js?v=3';

const BLUR = 0.12;

export function buildRoom(B, scene) {
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
