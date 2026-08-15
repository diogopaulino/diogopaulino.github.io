/**
 * Texturas procedurais em canvas — o lab não usa PNG externos.
 */

import * as THREE from 'three';

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

function noise2(x, y, seed = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

function grain(ctx, w, h, amount, seed = 0) {
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const x = p % w;
        const y = (p / w) | 0;
        const n = (noise2(x, y, seed) - 0.5) * amount;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
}

export function dirtTexture() {
    return cached('dirt', () => {
        const size = 512;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#a87848';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 220; i++) {
            const x = noise2(i, 2.1) * size;
            const y = noise2(i, 8.4) * size;
            const r = 16 + noise2(i, 3.3) * 80;
            const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
            const warm = noise2(i, 11) > 0.5;
            grd.addColorStop(0, warm ? 'rgba(140, 62, 28, 0.38)' : 'rgba(72, 96, 40, 0.22)');
            grd.addColorStop(1, 'rgba(168, 120, 72, 0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.strokeStyle = 'rgba(80, 48, 22, 0.14)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 380; i++) {
            const x = noise2(i, 21) * size;
            const y = noise2(i, 44) * size;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (noise2(i, 7) - 0.5) * 16, y + 8 + noise2(i, 9) * 12);
            ctx.stroke();
        }
        grain(ctx, size, size, 28, 4);
        return toTexture(el, { repeat: [18, 18] });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a3220';
        ctx.fillRect(0, 0, size, size);
        for (let x = 0; x < size; x += 4) {
            ctx.strokeStyle = `rgba(20, 12, 8, ${0.15 + noise2(x, 2) * 0.35})`;
            ctx.beginPath();
            ctx.moveTo(x + noise2(x, 1) * 3, 0);
            ctx.lineTo(x + noise2(x, 3) * 6, size);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 8);
        return toTexture(el, { repeat: [1, 2] });
    });
}

export function rockTexture() {
    return cached('rock', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#8a5a3a';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = `rgba(${90 + noise2(i, 1) * 80}, ${50 + noise2(i, 2) * 40}, ${30 + noise2(i, 3) * 20}, 0.35)`;
            ctx.beginPath();
            ctx.ellipse(
                noise2(i, 4) * size, noise2(i, 5) * size,
                8 + noise2(i, 6) * 28, 6 + noise2(i, 7) * 18,
                noise2(i, 8) * 6, 0, Math.PI * 2
            );
            ctx.fill();
        }
        grain(ctx, size, size, 36, 12);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function woodTexture() {
    return cached('wood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a4428';
        ctx.fillRect(0, 0, size, size);
        for (let y = 0; y < size; y += 7) {
            ctx.fillStyle = `rgba(40, 22, 10, ${0.12 + noise2(y, 2) * 0.25})`;
            ctx.fillRect(0, y, size, 3 + noise2(y, 3) * 3);
        }
        grain(ctx, size, size, 18, 5);
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function canopyTexture() {
    return cached('canopy', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a5a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 120; i++) {
            ctx.fillStyle = `rgba(${40 + noise2(i, 1) * 50}, ${80 + noise2(i, 2) * 70}, ${20 + noise2(i, 3) * 20}, 0.45)`;
            ctx.beginPath();
            ctx.arc(noise2(i, 4) * size, noise2(i, 5) * size, 8 + noise2(i, 6) * 18, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 20, 2);
        return toTexture(el);
    });
}

/** Sprite radial da poeira dos cascos — sem ela o ponto vira um quadrado duro. */
export function puffTexture() {
    return cached('puff', () => {
        const size = 64;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grd.addColorStop(0, 'rgba(255, 255, 255, 0.92)');
        grd.addColorStop(0.42, 'rgba(255, 255, 255, 0.4)');
        grd.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, size, size);
        const tex = new THREE.CanvasTexture(el);
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        return tex;
    });
}

export function hideTexture() {
    return cached('hide', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a3c1e';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 40, 9);
        return toTexture(el);
    });
}
