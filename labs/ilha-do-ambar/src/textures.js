/**
 * Texturas procedurais em canvas — o lab não depende de PNG externos.
 * Escamas, casca, relva, terra da trilha e água.
 */

import * as THREE from 'three';
import { hash2, fbm } from './utils.js';

const cache = new Map();

function canvas(size, height = size) {
    const el = document.createElement('canvas');
    el.width = size;
    el.height = height;
    return el;
}

function toTexture(el, { repeat = [1, 1], srgb = true, aniso = 8, normal = false } = {}) {
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

function hexRgb(hex) {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function mixRgb(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
    ];
}

/**
 * Pele de dinossauro: escamas em favo, listras dorsais e ventre mais claro.
 * Devolve albedo, normal e roughness.
 */
export function dinoSkin({
    key,
    dorsal = 0x5a6b3a,
    ventral = 0xc4b089,
    stripe = 0x2a2418,
    scale = 18,
    stripeAmt = 0.55,
    size = 512
} = {}) {
    return cached(`skin:${key}`, () => {
        const el = canvas(size);
        const nEl = canvas(size);
        const rEl = canvas(size);
        const ctx = el.getContext('2d');
        const nctx = nEl.getContext('2d');
        const rctx = rEl.getContext('2d');
        const img = ctx.createImageData(size, size);
        const nimg = nctx.createImageData(size, size);
        const rimg = rctx.createImageData(size, size);
        const d = hexRgb(dorsal);
        const v = hexRgb(ventral);
        const s = hexRgb(stripe);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = x / size;
                const vv = y / size;
                const belly = smoothBell(vv);
                const n1 = fbm(u * scale, vv * scale * 1.4, 3);
                const n2 = fbm(u * 3.2, vv * 8.5, 11);
                const cell = scaleNoise(u * scale, vv * scale * 1.15);
                const stripeMask = Math.pow(Math.abs(Math.sin(u * Math.PI * 7 + n2 * 2.2)), 1.6) * stripeAmt;
                let col = mixRgb(v, d, belly * 0.85 + n1 * 0.15);
                col = mixRgb(col, s, stripeMask * belly);
                col = mixRgb(col, [col[0] * 0.72, col[1] * 0.78, col[2] * 0.7], cell * 0.35);

                const i = (y * size + x) * 4;
                img.data[i] = col[0];
                img.data[i + 1] = col[1];
                img.data[i + 2] = col[2];
                img.data[i + 3] = 255;

                const nx = 128 + (cell - 0.5) * 70;
                const ny = 128 + (n1 - 0.5) * 40;
                nimg.data[i] = nx;
                nimg.data[i + 1] = ny;
                nimg.data[i + 2] = 255;
                nimg.data[i + 3] = 255;

                const rough = 0.62 + cell * 0.28 - belly * 0.12;
                const rv = Math.max(0, Math.min(255, rough * 255));
                rimg.data[i] = rv;
                rimg.data[i + 1] = rv;
                rimg.data[i + 2] = rv;
                rimg.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        nctx.putImageData(nimg, 0, 0);
        rctx.putImageData(rimg, 0, 0);

        const map = toTexture(el, { repeat: [2.4, 2.4] });
        const normalMap = toTexture(nEl, { repeat: [2.4, 2.4], srgb: false, normal: true });
        const roughnessMap = toTexture(rEl, { repeat: [2.4, 2.4], srgb: false });
        return { map, normalMap, roughnessMap };
    });
}

function smoothBell(v) {
    return Math.max(0, Math.min(1, (v - 0.12) / 0.7));
}

/** Células de escamas via ruído de Voronoi barato. */
function scaleNoise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let min = 1;
    for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
            const cx = ix + ox + hash2(ix + ox, iy + oy, 21);
            const cy = iy + oy + hash2(ix + ox, iy + oy, 44);
            const d = Math.hypot(x - cx, y - cy);
            if (d < min) min = d;
        }
    }
    return Math.max(0, Math.min(1, min * 1.35));
}

export function grassTexture() {
    return cached('grass', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3d6a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1400; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.55 ? '#6a9a3a' : '#2a4e18';
            ctx.globalAlpha = 0.5;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 5, y - 7 - hash2(i, 6) * 10);
            ctx.stroke();
        }
        grain(ctx, size, size, 18, 3);
        return toTexture(el, { repeat: [28, 28] });
    });
}

export function dirtTexture() {
    return cached('dirt', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6b4a2c';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = `rgba(40,28,16,${0.08 + hash2(i, 2) * 0.12})`;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 3) * size, hash2(i, 4) * size, 8 + hash2(i, 5) * 18, 3 + hash2(i, 6) * 6, hash2(i, 7) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 42, 8);
        return toTexture(el, { repeat: [6, 18] });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a3424';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = hash2(i, 1) > 0.5 ? '#2e2016' : '#6a4e34';
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 2 + hash2(i, 2) * 4;
            ctx.beginPath();
            ctx.moveTo(hash2(i, 3) * size, 0);
            ctx.bezierCurveTo(
                hash2(i, 4) * size, size * 0.33,
                hash2(i, 5) * size, size * 0.66,
                hash2(i, 6) * size, size
            );
            ctx.stroke();
        }
        grain(ctx, size, size, 28, 5);
        return toTexture(el, { repeat: [1, 3] });
    });
}

export function leafTexture() {
    return cached('leaf', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        const g = ctx.createRadialGradient(64, 70, 8, 64, 64, 62);
        g.addColorStop(0, '#7cb84a');
        g.addColorStop(0.55, '#3d7a28');
        g.addColorStop(1, 'rgba(20,40,12,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(64, 64, 52, 60, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20,50,10,0.35)';
        ctx.beginPath();
        ctx.moveTo(64, 12);
        ctx.lineTo(64, 116);
        ctx.stroke();
        const tex = toTexture(el, { repeat: [1, 1] });
        tex.premultiplyAlpha = true;
        return tex;
    });
}

export function palmLeafTexture() {
    return cached('palm', () => {
        const w = 64;
        const h = 256;
        const el = canvas(w, h);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#4e8a32';
        ctx.beginPath();
        ctx.moveTo(w * 0.5, 4);
        ctx.quadraticCurveTo(w * 0.95, h * 0.45, w * 0.55, h - 6);
        ctx.quadraticCurveTo(w * 0.5, h * 0.5, w * 0.45, h - 6);
        ctx.quadraticCurveTo(w * 0.05, h * 0.45, w * 0.5, 4);
        ctx.fill();
        ctx.strokeStyle = '#2a5a18';
        ctx.beginPath();
        ctx.moveTo(w * 0.5, 8);
        ctx.lineTo(w * 0.5, h - 10);
        ctx.stroke();
        return toTexture(el, { repeat: [1, 1] });
    });
}

export function rockTexture() {
    return cached('rock', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a665c';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 55, 12);
        return toTexture(el, { repeat: [3, 3] });
    });
}

export function metalTexture() {
    return cached('metal', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, 0);
        g.addColorStop(0, '#3a4048');
        g.addColorStop(0.5, '#8a929c');
        g.addColorStop(1, '#2e343c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 18, 2);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function waterNormal() {
    return cached('waterN', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x / 40, y / 40, 9);
                const m = fbm(x / 18 + 4, y / 18, 15);
                const i = (y * size + x) * 4;
                img.data[i] = 128 + (n - 0.5) * 80;
                img.data[i + 1] = 128 + (m - 0.5) * 80;
                img.data[i + 2] = 255;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [14, 14], srgb: false, normal: true });
    });
}

export function mistTexture() {
    return cached('mist', () => {
        const el = canvas(256, 128);
        const ctx = el.getContext('2d');
        const g = ctx.createRadialGradient(128, 90, 10, 128, 80, 120);
        g.addColorStop(0, 'rgba(230,236,220,0.45)');
        g.addColorStop(1, 'rgba(230,236,220,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 128);
        const tex = toTexture(el, { repeat: [1, 1] });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}
