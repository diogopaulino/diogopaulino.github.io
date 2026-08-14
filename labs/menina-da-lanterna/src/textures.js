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

export function grassTexture(tint = '#2a4a22') {
    return cached(`grass:${tint}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 900; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.5 ? '#3a6a30' : '#1a3014';
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 4, y - 6 - hash2(i, 6) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 3);
        return toTexture(el, { repeat: [16, 16] });
    });
}

export function cobbleTexture() {
    return cached('cobble', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a3840';
        ctx.fillRect(0, 0, size, size);
        for (let y = 0; y < 10; y++) {
            for (let x = 0; x < 10; x++) {
                const ox = (y % 2) * 12;
                ctx.fillStyle = hash2(x, y, 4) > 0.5 ? '#4a4850' : '#2e2c34';
                ctx.fillRect(x * 26 + ox + 2, y * 26 + 2, 22, 20);
                ctx.strokeStyle = '#1c1a20';
                ctx.strokeRect(x * 26 + ox + 2, y * 26 + 2, 22, 20);
            }
        }
        grain(ctx, size, size, 28, 6);
        return toTexture(el, { repeat: [8, 8] });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a2818';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#2a1810' : '#4a3420';
            ctx.lineWidth = 2 + hash2(i, 2) * 4;
            ctx.beginPath();
            ctx.moveTo(hash2(i, 3) * size, 0);
            ctx.quadraticCurveTo(
                hash2(i, 4) * size, size * 0.5,
                hash2(i, 5) * size, size
            );
            ctx.stroke();
        }
        grain(ctx, size, size, 30, 2);
        return toTexture(el, { repeat: [2, 4] });
    });
}

export function woodTexture() {
    return cached('wood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a4a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 18; i++) {
            ctx.strokeStyle = `rgba(40,24,10,${0.15 + hash2(i, 1) * 0.25})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, i * 14 + 4);
            ctx.lineTo(size, i * 14 + 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 24, 5);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function waterTexture() {
    return cached('water', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#1a3a48');
        g.addColorStop(1, '#0c2430');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 24; i++) {
            ctx.strokeStyle = `rgba(160,210,230,${0.08 + hash2(i, 2) * 0.12})`;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 3) * size, hash2(i, 4) * size, 30, 8, hash2(i, 5) * 3, 0, Math.PI * 2);
            ctx.stroke();
        }
        return toTexture(el, { repeat: [6, 6] });
    });
}

export function thatchTexture() {
    return cached('thatch', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a4820';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 200; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#8a6428' : '#4a3014';
            ctx.beginPath();
            const x = hash2(i, 2) * size;
            ctx.moveTo(x, hash2(i, 3) * size);
            ctx.lineTo(x + 2, hash2(i, 3) * size + 10);
            ctx.stroke();
        }
        return toTexture(el, { repeat: [4, 4] });
    });
}
