/**
 * Texturas do conto: fotos PBR (Poly Haven, CC0) + canvas com alpha para folha, palha, pele e Mimosa.
 * Nunca passe um Texture para JSON.stringify — o engine tem referências circulares.
 */

import { hash2 } from './utils.js';

const B = window.BABYLON;
const POLY = 'https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k';
const cache = new Map();

let modelQuality = 'high';

export function setTextureQuality(id) {
    modelQuality = id || 'high';
}

export function clearTextureCache() {
    cache.clear();
}

const SURFACES = {
    grass: { name: 'aerial_grass_rock', albedo: 'diff', scale: 16 },
    dirt: { name: 'brown_mud_03', albedo: 'diff', scale: 8 },
    wood: { name: 'weathered_planks', albedo: 'diff', scale: 3 },
    stone: { name: 'castle_brick_02_red', albedo: 'diff', scale: 4 },
    rock: { name: 'rock_wall_02', albedo: 'diff', scale: 5 },
    bark: { name: 'bark_brown_02', albedo: 'diff', scale: 2 },
    leather: { name: 'brown_leather', albedo: 'albedo', scale: 3 },
    tiles: { name: 'roof_09', albedo: 'diff', scale: 4 },
    forest: { name: 'forrest_ground_01', albedo: 'diff', scale: 10 }
};

function grain(ctx, w, h, amount, seed = 0) {
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const x = p % w;
        const y = (p / w) | 0;
        const n = (hash2(x, y, seed) - 0.5) * amount;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
}

function cachedTexture(scene, key, size, painter, { uScale = 1, vScale = 1, alpha = false } = {}) {
    const sceneKey = scene?.uid || 'default';
    const fullKey = `${sceneKey}:canvas:${key}`;
    if (cache.has(fullKey)) return cache.get(fullKey);

    const dynamic = new B.DynamicTexture(key, { width: size, height: size }, scene, true);
    const ctx = dynamic.getContext();
    painter(ctx, size);
    dynamic.update(false);
    dynamic.wrapU = B.Texture.WRAP_ADDRESSMODE;
    dynamic.wrapV = B.Texture.WRAP_ADDRESSMODE;
    dynamic.uScale = uScale;
    dynamic.vScale = vScale;
    dynamic.hasAlpha = Boolean(alpha);
    cache.set(fullKey, dynamic);
    return dynamic;
}

function photo(scene, url, scale, gammaSpace = true) {
    const tex = new B.Texture(url, scene, false, false, B.Texture.TRILINEAR_SAMPLINGMODE);
    tex.wrapU = B.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = B.Texture.WRAP_ADDRESSMODE;
    tex.uScale = scale;
    tex.vScale = scale;
    tex.gammaSpace = gammaSpace;
    tex.anisotropicFilteringLevel = 4;
    return tex;
}

/** Albedo + normal (e roughness no high) de um material Poly Haven. */
export function surface(scene, kind) {
    const spec = SURFACES[kind];
    if (!spec) return { albedo: null, bump: null, rough: null };
    const sceneKey = scene?.uid || 'default';
    const fullKey = `${sceneKey}:pbr:${kind}:${modelQuality}`;
    if (cache.has(fullKey)) return cache.get(fullKey);

    const base = `${POLY}/${spec.name}/${spec.name}`;
    const maps = {
        albedo: photo(scene, `${base}_${spec.albedo}_1k.jpg`, spec.scale, true),
        bump: null,
        rough: null
    };
    if (modelQuality !== 'low') {
        maps.bump = photo(scene, `${base}_nor_gl_1k.jpg`, spec.scale, false);
        maps.bump.level = 0.55;
    }
    if (modelQuality === 'high' && kind === 'grass') {
        maps.rough = photo(scene, `${base}_rough_1k.jpg`, spec.scale, false);
    }
    cache.set(fullKey, maps);
    return maps;
}

export function grassTexture(scene) {
    return surface(scene, 'grass').albedo;
}

export function dirtTexture(scene) {
    return surface(scene, 'dirt').albedo;
}

export function barkTexture(scene) {
    return surface(scene, 'bark').albedo;
}

export function woodTexture(scene) {
    return surface(scene, 'wood').albedo;
}

export function stoneTexture(scene) {
    return surface(scene, 'stone').albedo;
}

export function goldTexture(scene) {
    return cachedTexture(scene, 'gold', 256, (ctx, size) => {
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#fff3b0');
        g.addColorStop(0.35, '#d4a020');
        g.addColorStop(0.7, '#8a5a10');
        g.addColorStop(1, '#ffe9a0');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = 'rgba(255, 240, 180, 0.25)';
            ctx.lineWidth = 1;
            const y = hash2(i, 2) * size;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y + (hash2(i, 3) - 0.5) * 12);
            ctx.stroke();
        }
        grain(ctx, size, size, 18, 9);
    }, { uScale: 2, vScale: 2 });
}

export function cloudTexture(scene) {
    return cachedTexture(scene, 'cloud', 256, (ctx, size) => {
        ctx.fillStyle = '#eef4fb';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 70; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#ffffff' : '#d5e2ef';
            ctx.globalAlpha = 0.38;
            ctx.beginPath();
            ctx.arc(hash2(i, 2) * size, hash2(i, 3) * size, 16 + hash2(i, 4) * 48, 0, Math.PI * 2);
            ctx.fill();
        }
    }, { uScale: 2, vScale: 2 });
}

export function thatchTexture(scene) {
    return cachedTexture(scene, 'thatch', 512, (ctx, size) => {
        ctx.fillStyle = '#c4923a';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1400; i++) {
            const x = hash2(i, 1) * size;
            const y = hash2(i, 2) * size;
            ctx.strokeStyle = hash2(i, 3) > 0.55 ? '#e0b45a' : '#8a5a18';
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1 + hash2(i, 4) * 2.2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 8, y + 16 + hash2(i, 6) * 26);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 2);
    }, { uScale: 3, vScale: 3 });
}

export function clothTexture(scene) {
    return cachedTexture(scene, 'cloth', 256, (ctx, size) => {
        ctx.fillStyle = '#6e3a88';
        ctx.fillRect(0, 0, size, size);
        for (let x = 0; x < size; x += 3) {
            ctx.strokeStyle = x % 6 ? 'rgba(30, 12, 40, 0.22)' : 'rgba(220, 180, 255, 0.16)';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + 4, size);
            ctx.stroke();
        }
        for (let y = 0; y < size; y += 4) {
            ctx.strokeStyle = 'rgba(255, 240, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y + 3);
            ctx.stroke();
        }
        grain(ctx, size, size, 14, 1);
    }, { uScale: 4, vScale: 4 });
}

export function leafTexture(scene) {
    return cachedTexture(scene, 'leafAlpha', 256, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);
        ctx.save();
        ctx.translate(size * 0.5, size * 0.52);
        ctx.rotate(-0.35);
        const g = ctx.createLinearGradient(0, -size * 0.46, 0, size * 0.46);
        g.addColorStop(0, '#6dcc4a');
        g.addColorStop(0.5, '#3d9a32');
        g.addColorStop(1, '#246818');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.46);
        ctx.bezierCurveTo(size * 0.38, -size * 0.18, size * 0.36, size * 0.22, 0, size * 0.46);
        ctx.bezierCurveTo(-size * 0.36, size * 0.22, -size * 0.38, -size * 0.18, 0, -size * 0.46);
        ctx.fill();
        ctx.strokeStyle = '#1e5a16';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.44);
        ctx.lineTo(0, size * 0.44);
        ctx.stroke();
        ctx.lineWidth = 1.4;
        ctx.globalAlpha = 0.55;
        for (let i = -4; i <= 4; i++) {
            if (i === 0) continue;
            ctx.beginPath();
            ctx.moveTo(0, i * 12);
            ctx.quadraticCurveTo(i * 18, i * 12 + 10, i * 28, i * 18);
            ctx.stroke();
        }
        ctx.restore();
        grain(ctx, size, size, 12, 2);
    }, { uScale: 1, vScale: 1, alpha: true });
}

export function bladeTexture(scene) {
    return cachedTexture(scene, 'bladeAlpha', 128, (ctx, size) => {
        ctx.clearRect(0, 0, size, size);
        for (let i = 0; i < 9; i++) {
            const x = 12 + i * 12 + (hash2(i, 1) - 0.5) * 6;
            ctx.fillStyle = hash2(i, 2) > 0.5 ? '#4aaa38' : '#2e7a22';
            ctx.beginPath();
            ctx.moveTo(x - 3, size);
            ctx.quadraticCurveTo(x + (hash2(i, 3) - 0.5) * 10, size * 0.45, x, 6);
            ctx.quadraticCurveTo(x + 2, size * 0.45, x + 3, size);
            ctx.fill();
        }
    }, { uScale: 1, vScale: 1, alpha: true });
}

export function skinTexture(scene) {
    return cachedTexture(scene, 'skin', 128, (ctx, size) => {
        ctx.fillStyle = '#e8bc96';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? 'rgba(196, 110, 90, 0.12)' : 'rgba(255, 230, 200, 0.14)';
            ctx.beginPath();
            ctx.arc(hash2(i, 2) * size, hash2(i, 3) * size, 2 + hash2(i, 4) * 8, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 10, 4);
    }, { uScale: 2, vScale: 2 });
}

export function cowHideTexture(scene) {
    return cachedTexture(scene, 'cowHide', 512, (ctx, size) => {
        ctx.fillStyle = '#f3eee6';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 18; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.4 ? '#5a3a22' : '#3a2414';
            ctx.globalAlpha = 0.92;
            const x = hash2(i, 2) * size;
            const y = hash2(i, 3) * size;
            ctx.beginPath();
            ctx.ellipse(x, y, 28 + hash2(i, 4) * 50, 18 + hash2(i, 5) * 34, hash2(i, 6) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 0.18;
        for (let i = 0; i < 400; i++) {
            ctx.strokeStyle = '#d8d0c4';
            ctx.beginPath();
            const x = hash2(i, 7) * size;
            const y = hash2(i, 8) * size;
            ctx.moveTo(x, y);
            ctx.lineTo(x + 2, y + 6);
            ctx.stroke();
        }
        grain(ctx, size, size, 16, 6);
    }, { uScale: 2, vScale: 2 });
}
