/**
 * Manifest único de assets. Se um GLB não existir, o AssetManager
 * usa fallback procedural sem alterar a lógica de gameplay.
 */
export const ASSETS = {
    dico: './assets/models/dico.glb',
    ravi: './assets/models/ravi.glb',
    camila: './assets/models/camila.glb',
    teco: './assets/models/teco.glb',
    guard: './assets/models/guard.glb',
    tiger: './assets/models/tiger.glb',
    friend: './assets/models/friend.glb',
    ship: './assets/models/ship.glb',
    castle: './assets/models/castle.glb',
    waterNormals: 'https://cdn.jsdelivr.net/npm/three@0.185.1/examples/textures/waternormals.jpg'
};

export const STORAGE_KEY = 'guerreiro-castelo-save-v1';
export const SETTINGS_KEY = 'guerreiro-castelo-settings-v1';
