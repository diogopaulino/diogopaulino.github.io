/**
 * Texturas procedurais em canvas — o lab não depende de PNG externos.
 */

import * as THREE from 'three';
import { hash2 } from '../utils/math.js';

const cache = new Map();

function canvas(size, height = size) {
    const el = document.createElement('canvas');
    el.width = size;
    el.height = height;
    return el;
}

function toTexture(el, { repeat = [1, 1], srgb = true, aniso = 4, normal = false } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = aniso;
    if (srgb && !normal) tex.colorSpace = THREE.SRGBColorSpace;
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

export function woodTexture() {
    return cached('wood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 28; i++) {
            ctx.strokeStyle = i % 2 ? '#5a3818' : '#7a5530';
            ctx.lineWidth = 6 + hash2(i, 2) * 8;
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.moveTo(0, i * 10);
            ctx.bezierCurveTo(80, i * 10 + 8, 160, i * 10 - 6, size, i * 10 + 4);
            ctx.stroke();
        }
        grain(ctx, size, size, 28, 4);
        return toTexture(el, { repeat: [4, 4] });
    });
}

export function darkWoodTexture() {
    return cached('darkwood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a2414';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 22; i++) {
            ctx.strokeStyle = '#2a180c';
            ctx.lineWidth = 5;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, i * 12);
            ctx.lineTo(size, i * 12 + 3);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 6);
        return toTexture(el, { repeat: [3, 3] });
    });
}

export function stoneTexture() {
    return cached('stone', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a665e';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            const x = hash2(i, 1) * size;
            const y = hash2(i, 2) * size;
            ctx.fillStyle = hash2(i, 3) > 0.5 ? '#7a766e' : '#5a564e';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(x, y, 18 + hash2(i, 4) * 30, 12 + hash2(i, 5) * 20);
        }
        grain(ctx, size, size, 36, 9);
        return toTexture(el, { repeat: [8, 8] });
    });
}

export function castleStoneTexture() {
    return cached('castlestone', () => {
        const size = 512;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#7a7468';
        ctx.fillRect(0, 0, size, size);
        const bw = 64;
        const bh = 32;
        for (let y = 0, row = 0; y < size; y += bh, row++) {
            const ox = (row % 2) * (bw / 2);
            for (let x = -bw; x < size; x += bw) {
                const shade = 108 + hash2(x, y, 2) * 40;
                ctx.fillStyle = `rgb(${shade},${shade - 8},${shade - 18})`;
                ctx.globalAlpha = 1;
                ctx.fillRect(x + ox + 1, y + 1, bw - 2, bh - 2);
                ctx.strokeStyle = 'rgba(40,36,30,0.45)';
                ctx.strokeRect(x + ox + 1, y + 1, bw - 2, bh - 2);
            }
        }
        grain(ctx, size, size, 24, 11);
        return toTexture(el, { repeat: [6, 8] });
    });
}

export function mossTexture() {
    return cached('moss', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a5a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#4a7a32' : '#2a4a18';
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(hash2(i, 2) * size, hash2(i, 3) * size, 2 + hash2(i, 4) * 6, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 20, 3);
        return toTexture(el, { repeat: [6, 6] });
    });
}

export function grassTexture() {
    return cached('grass', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3d6a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1100; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.5 ? '#5a8a38' : '#2a5218';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 4, y - 6 - hash2(i, 6) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 3);
        return toTexture(el, { repeat: [14, 14] });
    });
}

export function sandTexture() {
    return cached('sand', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#cbb48a';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 42, 12);
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = 'rgba(160,130,80,0.25)';
            ctx.beginPath();
            ctx.moveTo(0, hash2(i, 1) * size);
            ctx.bezierCurveTo(80, hash2(i, 2) * size, 180, hash2(i, 3) * size, size, hash2(i, 4) * size);
            ctx.stroke();
        }
        return toTexture(el, { repeat: [10, 10] });
    });
}

export function leatherTexture() {
    return cached('leather', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 36, 7);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function clothTexture() {
    return cached('cloth', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(0, 0, size, size);
        for (let y = 0; y < size; y += 3) {
            ctx.fillStyle = y % 6 === 0 ? '#524232' : '#423222';
            ctx.fillRect(0, y, size, 1);
        }
        grain(ctx, size, size, 18, 2);
        return toTexture(el, { repeat: [3, 3] });
    });
}

export function rustTexture() {
    return cached('rust', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a3a18';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 50, 15);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function plasterTexture() {
    return cached('plaster', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#c4b49a';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 28, 5);
        return toTexture(el, { repeat: [3, 3] });
    });
}

export function rugTexture() {
    return cached('rug', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#1e3a7a';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 8;
        ctx.strokeRect(16, 16, size - 32, size - 32);
        ctx.strokeRect(32, 32, size - 64, size - 64);
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = i % 2 ? '#2a4a8a' : '#16306a';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, 20 + i * 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        grain(ctx, size, size, 16, 1);
        return toTexture(el, { repeat: [1, 1] });
    });
}

export function leafTexture() {
    return cached('leaf', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#2f6a24';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#3e8a30' : '#245818';
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 2) * size, hash2(i, 3) * size, 8, 14, hash2(i, 4) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a321c';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 18; i++) {
            ctx.strokeStyle = '#2e1e10';
            ctx.lineWidth = 4 + hash2(i, 1) * 6;
            ctx.globalAlpha = 0.6;
            ctx.beginPath();
            ctx.moveTo(i * 14, 0);
            ctx.bezierCurveTo(i * 14 + 6, 80, i * 14 - 4, 160, i * 14 + 2, size);
            ctx.stroke();
        }
        grain(ctx, size, size, 24, 8);
        return toTexture(el, { repeat: [2, 4] });
    });
}

export function waterNormalTexture() {
    return cached('watern', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n1 = hash2(x * 0.08, y * 0.08, 1);
                const n2 = hash2(x * 0.2, y * 0.2, 4);
                const nx = (n1 - 0.5) * 0.6 + 0.5;
                const ny = (n2 - 0.5) * 0.6 + 0.5;
                const i = (y * size + x) * 4;
                img.data[i] = nx * 255;
                img.data[i + 1] = ny * 255;
                img.data[i + 2] = 255;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [8, 8], srgb: false, normal: true });
    });
}

export function flagTexture(color = '#6b1c1c') {
    return cached(`flag:${color}`, () => {
        const el = canvas(128, 80);
        const ctx = el.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 128, 80);
        ctx.fillStyle = '#d4b45a';
        ctx.beginPath();
        ctx.moveTo(64, 18);
        ctx.lineTo(70, 36);
        ctx.lineTo(90, 36);
        ctx.lineTo(74, 48);
        ctx.lineTo(80, 66);
        ctx.lineTo(64, 54);
        ctx.lineTo(48, 66);
        ctx.lineTo(54, 48);
        ctx.lineTo(38, 36);
        ctx.lineTo(58, 36);
        ctx.closePath();
        ctx.fill();
        return toTexture(el, { repeat: [1, 1] });
    });
}

export function clearTextureCache() {
    for (const tex of cache.values()) tex.dispose();
    cache.clear();
}
