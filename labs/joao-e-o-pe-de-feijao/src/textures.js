/**
 * Texturas procedurais em canvas — o lab não depende de PNG externos.
 */

import * as THREE from 'three';
import { hash2 } from './utils.js';

const cache = new Map();

function canvas(size, height = size) {
    const el = document.createElement('canvas');
    el.width = size;
    el.height = height;
    return el;
}

function toTexture(el, { repeat = [1, 1], srgb = true, aniso = 4 } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = aniso;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

function cached(key, factory) {
    if (!cache.has(key)) cache.set(key, factory());
    return cache.get(key);
}

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

export function grassTexture() {
    return cached('grass', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a8a32';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1000; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.5 ? '#6aaa42' : '#3a7018';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 4, y - 6 - hash2(i, 6) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 3);
        return toTexture(el, { repeat: [16, 16] });
    });
}

export function dirtTexture() {
    return cached('dirt', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a4a28';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 52, 8);
        return toTexture(el, { repeat: [8, 8] });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a5a22';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#2a4818' : '#4a7028';
            ctx.lineWidth = 2 + hash2(i, 2) * 4;
            ctx.globalAlpha = 0.55;
            const x = hash2(i, 3) * size;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.quadraticCurveTo(x + 12, size * 0.5, x - 8, size);
            ctx.stroke();
        }
        grain(ctx, size, size, 28, 5);
        return toTexture(el, { repeat: [2, 6] });
    });
}

export function leafTexture() {
    return cached('leaf', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3d9a38';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = hash2(i, 2) > 0.5 ? '#5cba48' : '#2a7818';
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 3) * size, hash2(i, 4) * size, 8, 14, hash2(i, 5) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function thatchTexture() {
    return cached('thatch', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#c4a050';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 220; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#a87830' : '#d8b868';
            ctx.globalAlpha = 0.5;
            const y = hash2(i, 2) * size;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y + (hash2(i, 3) - 0.5) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 18, 2);
        return toTexture(el, { repeat: [4, 4] });
    });
}

export function woodTexture() {
    return cached('wood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#8a5a32';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 28; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#6a3e20' : '#b07848';
            ctx.lineWidth = 3;
            ctx.globalAlpha = 0.4;
            const y = (i / 28) * size;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(80, y + 8, 160, y - 8, 256, y);
            ctx.stroke();
        }
        grain(ctx, size, size, 24, 4);
        return toTexture(el, { repeat: [3, 3] });
    });
}

export function stoneTexture() {
    return cached('stone', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#8a9098';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#9aa0a8' : '#6a7078';
            ctx.globalAlpha = 0.5;
            const x = hash2(i, 2) * size;
            const y = hash2(i, 3) * size;
            ctx.fillRect(x, y, 18 + hash2(i, 4) * 40, 12 + hash2(i, 5) * 22);
        }
        grain(ctx, size, size, 30, 6);
        return toTexture(el, { repeat: [6, 6] });
    });
}

export function goldTexture() {
    return cached('gold', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#ffe680');
        g.addColorStop(0.5, '#d4a020');
        g.addColorStop(1, '#fff0a8');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 20, 9);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function cloudTexture() {
    return cached('cloud', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#e8f0f8';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#ffffff' : '#d0dce8';
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.arc(hash2(i, 2) * size, hash2(i, 3) * size, 20 + hash2(i, 4) * 40, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { repeat: [3, 3] });
    });
}

export function clothTexture() {
    return cached('cloth', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a2a88';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 16; i++) {
            ctx.strokeStyle = '#8a48a8';
            ctx.globalAlpha = 0.3;
            ctx.beginPath();
            ctx.moveTo(0, i * 8);
            ctx.lineTo(size, i * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 16, 1);
        return toTexture(el, { repeat: [4, 4] });
    });
}
