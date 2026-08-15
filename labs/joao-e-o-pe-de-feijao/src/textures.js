/**
 * Texturas procedurais em canvas para Babylon.js — sem dependência de PNGs externos.
 */

import { hash2 } from './utils.js';

const B = window.BABYLON;
const cache = new Map();

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

export function clearTextureCache() {
    cache.clear();
}

function cachedTexture(scene, key, size, painter, { uScale = 1, vScale = 1 } = {}) {
    const sceneKey = scene?.uid || 'default';
    const fullKey = `${sceneKey}:${key}`;
    if (cache.has(fullKey)) return cache.get(fullKey);

    const dynamic = new B.DynamicTexture(key, { width: size, height: size }, scene, true);
    const ctx = dynamic.getContext();
    painter(ctx, size);
    dynamic.update(false);
    dynamic.wrapU = B.Texture.WRAP_ADDRESSMODE;
    dynamic.wrapV = B.Texture.WRAP_ADDRESSMODE;
    dynamic.uScale = uScale;
    dynamic.vScale = vScale;

    cache.set(fullKey, dynamic);
    return dynamic;
}

export function grassTexture(scene) {
    return cachedTexture(scene, 'grass', 256, (ctx, size) => {
        ctx.fillStyle = '#4a8a32';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1200; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.5 ? '#6aaa42' : '#3a7018';
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 4, y - 6 - hash2(i, 6) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 3);
    }, { uScale: 16, vScale: 16 });
}

export function dirtTexture(scene) {
    return cachedTexture(scene, 'dirt', 256, (ctx, size) => {
        ctx.fillStyle = '#6a4a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 60; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#55361a' : '#7c5832';
            ctx.globalAlpha = 0.4;
            const rx = hash2(i, 2) * size;
            const ry = hash2(i, 3) * size;
            ctx.beginPath();
            ctx.arc(rx, ry, 3 + hash2(i, 4) * 8, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 52, 8);
    }, { uScale: 8, vScale: 8 });
}

export function barkTexture(scene) {
    return cachedTexture(scene, 'bark', 256, (ctx, size) => {
        ctx.fillStyle = '#3a5a22';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 48; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#243e14' : '#4e7a2b';
            ctx.lineWidth = 2 + hash2(i, 2) * 4;
            ctx.globalAlpha = 0.6;
            const x = hash2(i, 3) * size;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.quadraticCurveTo(x + 14, size * 0.5, x - 10, size);
            ctx.stroke();
        }
        grain(ctx, size, size, 28, 5);
    }, { uScale: 2, vScale: 6 });
}

export function leafTexture(scene) {
    return cachedTexture(scene, 'leaf', 128, (ctx, size) => {
        ctx.fillStyle = '#3d9a38';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 90; i++) {
            ctx.fillStyle = hash2(i, 2) > 0.5 ? '#5cba48' : '#2a7818';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 3) * size, hash2(i, 4) * size, 8, 14, hash2(i, 5) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 16, 2);
    }, { uScale: 2, vScale: 2 });
}

export function thatchTexture(scene) {
    return cachedTexture(scene, 'thatch', 256, (ctx, size) => {
        ctx.fillStyle = '#c4a050';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 240; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#a87830' : '#d8b868';
            ctx.globalAlpha = 0.55;
            const y = hash2(i, 2) * size;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y + (hash2(i, 3) - 0.5) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 18, 2);
    }, { uScale: 4, vScale: 4 });
}

export function woodTexture(scene) {
    return cachedTexture(scene, 'wood', 256, (ctx, size) => {
        ctx.fillStyle = '#8a5a32';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 32; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#6a3e20' : '#b07848';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.45;
            const y = (i / 32) * size;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(80, y + 8, 160, y - 8, 256, y);
            ctx.stroke();
        }
        grain(ctx, size, size, 24, 4);
    }, { uScale: 3, vScale: 3 });
}

export function stoneTexture(scene) {
    return cachedTexture(scene, 'stone', 256, (ctx, size) => {
        ctx.fillStyle = '#8a9098';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 60; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#9aa0a8' : '#6a7078';
            ctx.globalAlpha = 0.55;
            const x = hash2(i, 2) * size;
            const y = hash2(i, 3) * size;
            ctx.fillRect(x, y, 18 + hash2(i, 4) * 40, 12 + hash2(i, 5) * 22);
        }
        grain(ctx, size, size, 30, 6);
    }, { uScale: 6, vScale: 6 });
}

export function goldTexture(scene) {
    return cachedTexture(scene, 'gold', 128, (ctx, size) => {
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#ffe680');
        g.addColorStop(0.5, '#d4a020');
        g.addColorStop(1, '#fff0a8');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 20, 9);
    }, { uScale: 2, vScale: 2 });
}

export function cloudTexture(scene) {
    return cachedTexture(scene, 'cloud', 256, (ctx, size) => {
        ctx.fillStyle = '#e8f0f8';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#ffffff' : '#d0dce8';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.arc(hash2(i, 2) * size, hash2(i, 3) * size, 20 + hash2(i, 4) * 45, 0, Math.PI * 2);
            ctx.fill();
        }
    }, { uScale: 3, vScale: 3 });
}

export function clothTexture(scene) {
    return cachedTexture(scene, 'cloth', 128, (ctx, size) => {
        ctx.fillStyle = '#6a2a88';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 20; i++) {
            ctx.strokeStyle = '#8a48a8';
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.moveTo(0, i * 6.4);
            ctx.lineTo(size, i * 6.4);
            ctx.stroke();
        }
        grain(ctx, size, size, 16, 1);
    }, { uScale: 4, vScale: 4 });
}

