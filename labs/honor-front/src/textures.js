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

export function sandTexture() {
    return cached('sand', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#c4a06a';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1400; i++) {
            ctx.fillStyle = hash2(i, 2) > 0.5 ? '#d4b47a' : '#a88852';
            ctx.globalAlpha = 0.35;
            ctx.fillRect(hash2(i, 3) * size, hash2(i, 4) * size, 2, 2);
        }
        grain(ctx, size, size, 28, 1);
        return toTexture(el, { repeat: [22, 40] });
    });
}

export function grassTexture() {
    return cached('grass', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3d5a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 900; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.5 ? '#5a7a32' : '#2c4418';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 4, y - 7 - hash2(i, 6) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 3);
        return toTexture(el, { repeat: [16, 22] });
    });
}

export function stoneTexture() {
    return cached('stone', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#8a8478';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 18; i++) {
            for (let j = 0; j < 18; j++) {
                const ox = (hash2(i, j) - 0.5) * 4;
                ctx.fillStyle = hash2(i, j + 3) > 0.5 ? '#9a9488' : '#6e685c';
                ctx.fillRect(i * 14 + ox, j * 14 + hash2(j, i) * 3, 13, 12);
            }
        }
        grain(ctx, size, size, 32, 6);
        return toTexture(el, { repeat: [3, 2] });
    });
}

export function concreteTexture() {
    return cached('concrete', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#8b8678';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 40, 11);
        ctx.strokeStyle = 'rgba(40,38,32,0.25)';
        ctx.beginPath();
        ctx.moveTo(20, 40);
        ctx.lineTo(200, 180);
        ctx.moveTo(80, 10);
        ctx.lineTo(240, 90);
        ctx.stroke();
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function woodTexture() {
    return cached('wood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a4a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 28; i++) {
            ctx.strokeStyle = i % 2 ? '#5a3c1e' : '#7a5830';
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.moveTo(0, i * 9 + hash2(i, 1) * 3);
            ctx.bezierCurveTo(80, i * 9 + 4, 160, i * 9 - 3, 256, i * 9);
            ctx.stroke();
        }
        grain(ctx, size, size, 24, 7);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function metalTexture() {
    return cached('metal', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#9aa0a6');
        g.addColorStop(0.5, '#6a7076');
        g.addColorStop(1, '#c4c8cc');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 36, 9);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function roofTexture() {
    return cached('roof', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a3a28';
        ctx.fillRect(0, 0, size, size);
        for (let y = 0; y < size; y += 8) {
            ctx.fillStyle = y % 16 ? '#7a4830' : '#5a2e20';
            ctx.fillRect(0, y, size, 7);
        }
        grain(ctx, size, size, 20, 4);
        return toTexture(el, { repeat: [4, 4] });
    });
}

export function flagTexture(colors = ['#3c3c38', '#c4b48a', '#3c3c38']) {
    const key = `flag:${colors.join()}`;
    return cached(key, () => {
        const el = canvas(128, 80);
        const ctx = el.getContext('2d');
        const h = 80 / colors.length;
        colors.forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.fillRect(0, i * h, 128, h + 1);
        });
        grain(ctx, 128, 80, 18, 2);
        const tex = toTexture(el, { repeat: [1, 1] });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}

export function sparkTexture() {
    return cached('spark', () => {
        const size = 64;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.25, '#ffe8a0');
        g.addColorStop(0.55, '#ff8020');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        const tex = toTexture(el, { srgb: false, aniso: 1 });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}
