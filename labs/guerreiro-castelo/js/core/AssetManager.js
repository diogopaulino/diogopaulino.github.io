/**
 * Carrega GLB/texturas via THREE.LoadingManager.
 * Se o arquivo não existir, devolve null e o chamador usa fallback procedural.
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { ASSETS } from './assets.js';

export class AssetManager {
    constructor() {
        this.manager = new THREE.LoadingManager();
        this.gltf = new GLTFLoader(this.manager);
        const draco = new DRACOLoader(this.manager);
        draco.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.185.1/examples/jsm/libs/draco/');
        this.gltf.setDRACOLoader(draco);
        this.tex = new THREE.TextureLoader(this.manager);
        this.cache = new Map();
        this.progress = 0;
        this.failed = [];
        this.manager.onProgress = (_url, loaded, total) => {
            this.progress = total ? loaded / total : 1;
            this.onProgress?.(this.progress);
        };
        this.manager.onError = (url) => {
            console.warn('[AssetManager] falhou:', url);
            this.failed.push(url);
        };
    }

    async loadTexture(url) {
        if (this.cache.has(url)) return this.cache.get(url);
        try {
            const tex = await this.tex.loadAsync(url);
            tex.colorSpace = THREE.SRGBColorSpace;
            this.cache.set(url, tex);
            return tex;
        } catch (err) {
            console.warn('[AssetManager] textura indisponível:', url, err?.message || err);
            this.cache.set(url, null);
            return null;
        }
    }

    async tryGltf(key) {
        const url = ASSETS[key];
        if (!url) return null;
        if (this.cache.has(url)) return this.cache.get(url);
        try {
            const gltf = await this.gltf.loadAsync(url);
            this.cache.set(url, gltf);
            return gltf;
        } catch {
            this.cache.set(url, null);
            return null;
        }
    }

    async preloadEssential(onProgress) {
        this.onProgress = onProgress;
        const water = await this.loadTexture(ASSETS.waterNormals);
        return { waterNormals: water };
    }
}
