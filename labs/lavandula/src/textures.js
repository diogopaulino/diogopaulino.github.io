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

function toTexture(el, { repeat = [1, 1], srgb = true, aniso = 4, wrap = true } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
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

/** Solo dos campos: terra rosada com musgo e sombra de lavanda. */
export function soilTexture() {
    return cached('soil', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a4a32';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 420; i++) {
            ctx.fillStyle = hash2(i, 3) > 0.55 ? '#7a5a38' : '#5a3a28';
            ctx.globalAlpha = 0.35;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 1) * size, hash2(i, 2) * size, 8 + hash2(i, 4) * 18, 4 + hash2(i, 5) * 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 28, 4);
        return toTexture(el, { repeat: [22, 22] });
    });
}

export function dirtTexture() {
    return cached('dirt', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#8a6238';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 42, 9);
        return toTexture(el, { repeat: [8, 8] });
    });
}

/**
 * Pé de lavanda em alpha: caule verde e espiga violeta.
 * Usado em dois planos cruzados (billboard em X).
 */
export function lavenderTexture() {
    return cached('lavender', () => {
        const w = 64;
        const h = 256;
        const el = canvas(w, h);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        const cx = w * 0.5;
        ctx.strokeStyle = '#3a6a28';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(cx, h);
        ctx.quadraticCurveTo(cx + 4, h * 0.55, cx - 1, h * 0.38);
        ctx.stroke();

        for (let i = 0; i < 7; i++) {
            const t = i / 7;
            ctx.strokeStyle = i % 2 ? '#4a7a30' : '#2e5a22';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(cx, h * (0.92 - t * 0.4));
            ctx.lineTo(cx + (i % 2 ? 10 : -10), h * (0.86 - t * 0.4));
            ctx.stroke();
        }

        const spikeTop = 8;
        const spikeBot = h * 0.42;
        for (let i = 0; i < 90; i++) {
            const t = hash2(i, 1);
            const y = spikeTop + t * (spikeBot - spikeTop);
            const spread = (1 - t) * 5 + 4;
            const x = cx + (hash2(i, 2) - 0.5) * spread * 2;
            const r = 2.1 + hash2(i, 3) * 2.4;
            const purple = hash2(i, 4);
            ctx.fillStyle = purple > 0.66
                ? 'rgba(196, 150, 220, 0.95)'
                : purple > 0.33
                    ? 'rgba(132, 78, 168, 0.95)'
                    : 'rgba(88, 42, 128, 0.92)';
            ctx.beginPath();
            ctx.ellipse(x, y, r * 0.7, r, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { wrap: false, aniso: 8 });
    });
}

/** Espiga de trigo dourado — borda dos campos, hora dourada. */
export function wheatTexture() {
    return cached('wheat', () => {
        const w = 48;
        const h = 192;
        const el = canvas(w, h);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        const cx = w * 0.5;
        ctx.strokeStyle = '#6a8a28';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(cx, h);
        ctx.lineTo(cx + 2, h * 0.32);
        ctx.stroke();
        for (let i = 0; i < 18; i++) {
            const y = 8 + i * 6;
            ctx.fillStyle = i % 2 ? '#e8c050' : '#d4a030';
            ctx.beginPath();
            ctx.ellipse(cx + (i % 2 ? 4 : -4), y, 3.2, 5.5, 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { wrap: false, aniso: 4 });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a3424';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = hash2(i, 2) > 0.5 ? '#3a2818' : '#5a4430';
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.moveTo(hash2(i, 1) * size, 0);
            ctx.lineTo(hash2(i, 3) * size, size);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 6);
        return toTexture(el, { repeat: [2, 4] });
    });
}

export function leafTexture() {
    return cached('leaf', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#5a7a38';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = hash2(i, 2) > 0.5 ? '#6a8a40' : '#4a6a28';
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 1) * size, hash2(i, 3) * size, 10, 6, hash2(i, 4) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 18, 2);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function oliveLeafTexture() {
    return cached('oliveLeaf', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#7a8a58';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 70; i++) {
            ctx.fillStyle = hash2(i, 2) > 0.5 ? '#c8d4a8' : '#5a6a38';
            ctx.globalAlpha = 0.4;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 1) * size, hash2(i, 3) * size, 12, 5, 0.6, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function stoneTexture() {
    return cached('stone', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#8a7a68';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 36, 11);
        return toTexture(el, { repeat: [3, 3] });
    });
}

export function terracottaTexture() {
    return cached('terra', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#b45a38';
        ctx.fillRect(0, 0, size, size);
        for (let y = 0; y < size; y += 10) {
            ctx.strokeStyle = '#9a482c';
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }
        grain(ctx, size, size, 20, 5);
        return toTexture(el, { repeat: [4, 4] });
    });
}

export function linenTexture() {
    return cached('linen', () => {
        const size = 64;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#e8dcc4';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 16, 7);
        return toTexture(el, { repeat: [2, 2] });
    });
}
