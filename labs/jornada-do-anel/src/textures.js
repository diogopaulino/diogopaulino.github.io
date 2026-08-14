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
        ctx.fillStyle = '#4a7a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 900; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.5 ? '#6a9a38' : '#3a6218';
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 4, y - 6 - hash2(i, 6) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 3);
        return toTexture(el, { repeat: [18, 18] });
    });
}

export function dirtTexture() {
    return cached('dirt', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a4a2c';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 48, 8);
        return toTexture(el, { repeat: [10, 10] });
    });
}

export function mossTexture() {
    return cached('moss', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3d5a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = `rgba(${40 + hash2(i, 1) * 40},${90 + hash2(i, 2) * 50},${20},0.4)`;
            ctx.beginPath();
            ctx.arc(hash2(i, 3) * size, hash2(i, 4) * size, 8 + hash2(i, 5) * 22, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 30, 2);
        return toTexture(el, { repeat: [6, 6] });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a2618';
        ctx.fillRect(0, 0, size, size);
        for (let x = 0; x < size; x += 7) {
            ctx.strokeStyle = hash2(x, 1) > 0.5 ? '#5a3a24' : '#2a1810';
            ctx.lineWidth = 2 + hash2(x, 2) * 3;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + (hash2(x, 3) - 0.5) * 8, size);
            ctx.stroke();
        }
        grain(ctx, size, size, 28, 4);
        return toTexture(el, { repeat: [2, 4] });
    });
}

export function leafTexture(tint = '#2f6a24') {
    return cached(`leaf:${tint}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#4a8a32' : '#1e4a16';
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 2) * size, hash2(i, 3) * size, 4, 8, hash2(i, 4) * 6, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 24, 5);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function stoneTexture(tint = '#8a8680') {
    return cached(`stone:${tint}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = `rgba(0,0,0,${0.08 + hash2(i, 1) * 0.12})`;
            ctx.beginPath();
            ctx.moveTo(hash2(i, 2) * size, hash2(i, 3) * size);
            ctx.lineTo(hash2(i, 4) * size, hash2(i, 5) * size);
            ctx.stroke();
        }
        grain(ctx, size, size, 36, 6);
        return toTexture(el, { repeat: [4, 4] });
    });
}

export function marbleTexture() {
    return cached('marble', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#e8e4d8';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 18; i++) {
            ctx.strokeStyle = `rgba(160,150,120,${0.15 + hash2(i, 1) * 0.2})`;
            ctx.lineWidth = 1 + hash2(i, 2) * 2;
            ctx.beginPath();
            ctx.moveTo(0, hash2(i, 3) * size);
            ctx.bezierCurveTo(
                size * 0.3, hash2(i, 4) * size,
                size * 0.6, hash2(i, 5) * size,
                size, hash2(i, 6) * size
            );
            ctx.stroke();
        }
        grain(ctx, size, size, 18, 7);
        return toTexture(el, { repeat: [3, 3] });
    });
}

export function woodTexture() {
    return cached('wood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6b4428';
        ctx.fillRect(0, 0, size, size);
        const planks = 6;
        const ph = size / planks;
        for (let i = 0; i < planks; i++) {
            ctx.fillStyle = i % 2 ? '#7a5130' : '#5c3a20';
            ctx.fillRect(0, i * ph + 1, size, ph - 2);
        }
        grain(ctx, size, size, 26, 9);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function goldTexture() {
    return cached('gold', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#fff3b0');
        g.addColorStop(0.4, '#d4a017');
        g.addColorStop(0.7, '#8a5a10');
        g.addColorStop(1, '#f0d060');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 20, 11);
        return toTexture(el, { repeat: [1, 1] });
    });
}

export function doorTexture(color = '#2d6b38') {
    return cached(`door:${color}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 6;
        for (let i = 1; i < 5; i++) {
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, (size / 2) * (i / 5), 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = '#c9a227';
        ctx.beginPath();
        ctx.arc(size * 0.72, size * 0.5, 10, 0, Math.PI * 2);
        ctx.fill();
        grain(ctx, size, size, 18, 12);
        return toTexture(el, { repeat: [1, 1] });
    });
}

export function waterTexture() {
    return cached('water', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#1a4a6a');
        g.addColorStop(0.5, '#2a7a88');
        g.addColorStop(1, '#163a58');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 20; i++) {
            ctx.strokeStyle = `rgba(200,230,255,${0.08 + hash2(i, 1) * 0.1})`;
            ctx.beginPath();
            ctx.moveTo(0, hash2(i, 2) * size);
            ctx.bezierCurveTo(size * 0.4, hash2(i, 3) * size, size * 0.7, hash2(i, 4) * size, size, hash2(i, 5) * size);
            ctx.stroke();
        }
        return toTexture(el, { repeat: [8, 8] });
    });
}

export function brickTexture() {
    return cached('brick', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a4038';
        ctx.fillRect(0, 0, size, size);
        const bw = 42;
        const bh = 18;
        for (let y = 0, row = 0; y < size; y += bh, row++) {
            const off = row % 2 ? bw / 2 : 0;
            for (let x = -bw; x < size; x += bw) {
                ctx.fillStyle = hash2(x, y) > 0.5 ? '#6a5a4a' : '#5a4a3a';
                ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
            }
        }
        grain(ctx, size, size, 22, 14);
        return toTexture(el, { repeat: [4, 4] });
    });
}
