/**
 * Gerenciador de assets para Babylon.js.
 * Utiliza fallback procedural total integrado com Babylon.js.
 */

export class AssetManager {
    constructor() {
        this.cache = new Map();
        this.progress = 0;
    }

    async preloadEssential(onProgress) {
        onProgress?.(1);
        return { waterNormals: null };
    }
}
