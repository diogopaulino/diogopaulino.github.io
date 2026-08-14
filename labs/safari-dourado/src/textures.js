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

export function savannaTexture() {
    return cached('savanna', () => {
        const size = 512;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#c4a05a';
        ctx.fillRect(0, 0, size, size);

        for (let i = 0; i < 180; i++) {
            const x = noise2(i, 2.1) * size;
            const y = noise2(i, 8.4) * size;
            const r = 18 + noise2(i, 3.3) * 70;
            const grd = ctx.createRadialGradient(x, y, 0, x, y, r);
            const warm = noise2(i, 11) > 0.55;
            grd.addColorStop(0, warm ? 'rgba(168, 92, 42, 0.35)' : 'rgba(90, 110, 48, 0.28)');
            grd.addColorStop(1, 'rgba(196, 160, 90, 0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.strokeStyle = 'rgba(90, 60, 28, 0.12)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 420; i++) {
            const x = noise2(i, 21) * size;
            const y = noise2(i, 44) * size;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (noise2(i, 7) - 0.5) * 14, y + 6 + noise2(i, 9) * 10);
            ctx.stroke();
        }

        grain(ctx, size, size, 28, 2);
        return toTexture(el, { repeat: [28, 28], aniso: 8 });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a3220';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 28; i++) {
            ctx.strokeStyle = `rgba(28, 16, 8, ${0.18 + noise2(i, 1) * 0.4})`;
            ctx.lineWidth = 2 + noise2(i, 4) * 4;
            const x = (i / 28) * size;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            for (let y = 0; y <= size; y += 16) {
                ctx.lineTo(x + Math.sin(y * 0.08 + i) * 6, y);
            }
            ctx.stroke();
        }
        grain(ctx, size, size, 40, 6);
        return toTexture(el, { repeat: [1, 3], aniso: 4 });
    });
}

export function canopyTexture() {
    return cached('canopy', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3d5a22';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 90; i++) {
            const x = noise2(i, 1.2) * size;
            const y = noise2(i, 4.8) * size;
            ctx.fillStyle = noise2(i, 9) > 0.5 ? '#6a8a32' : '#2a4014';
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(x, y, 8 + noise2(i, 3) * 18, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        grain(ctx, size, size, 22, 3);
        return toTexture(el, { repeat: [2, 2], aniso: 4 });
    });
}

export function zebraTexture() {
    return cached('zebra', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#f4eee4';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 18; i++) {
            ctx.fillStyle = '#1a1612';
            const y = (i / 18) * size;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= size; x += 8) {
                ctx.lineTo(x, y + Math.sin(x * 0.08 + i) * 7 + (i % 2) * 4);
            }
            ctx.lineTo(size, y + 9);
            ctx.lineTo(0, y + 9);
            ctx.closePath();
            ctx.fill();
        }
        return toTexture(el, { repeat: [2, 3], aniso: 4 });
    });
}

export function giraffeTexture() {
    return cached('giraffe', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#e8c878';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 48; i++) {
            const x = (i % 7) * 38 + noise2(i, 2) * 10;
            const y = Math.floor(i / 7) * 40 + noise2(i, 5) * 12;
            ctx.fillStyle = `rgb(${110 + noise2(i, 1) * 40}, ${70 + noise2(i, 3) * 20}, 28)`;
            ctx.beginPath();
            const r = 10 + noise2(i, 8) * 8;
            ctx.ellipse(x, y, r * 1.15, r * 0.9, noise2(i, 4), 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 18, 4);
        return toTexture(el, { repeat: [2, 3], aniso: 4 });
    });
}

export function elephantTexture() {
    return cached('elephant', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#9a9086';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = 'rgba(40, 34, 30, 0.28)';
        ctx.lineWidth = 1.4;
        for (let i = 0; i < 40; i++) {
            const y = (i / 40) * size;
            ctx.beginPath();
            ctx.moveTo(0, y);
            for (let x = 0; x <= size; x += 12) {
                ctx.lineTo(x, y + Math.sin(x * 0.05 + i * 0.4) * 5);
            }
            ctx.stroke();
        }
        grain(ctx, size, size, 26, 8);
        return toTexture(el, { repeat: [2, 2], aniso: 4 });
    });
}

export function rockTexture() {
    return cached('rock', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#8a7a68';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 70; i++) {
            ctx.fillStyle = `rgba(${60 + noise2(i, 1) * 80}, ${50 + noise2(i, 2) * 50}, ${40}, 0.35)`;
            ctx.beginPath();
            ctx.arc(noise2(i, 3) * size, noise2(i, 6) * size, 6 + noise2(i, 9) * 22, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 36, 9);
        return toTexture(el, { repeat: [2, 2], aniso: 4 });
    });
}

export function jeepCanvasTexture() {
    return cached('jeep-canvas', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#d8c49a';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = 'rgba(90, 60, 30, 0.18)';
        for (let y = 0; y < size; y += 6) ctx.fillRect(0, y, size, 2);
        grain(ctx, size, size, 20, 1);
        return toTexture(el, { repeat: [2, 1], aniso: 4 });
    });
}

export function grassTexture() {
    return cached('grass', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        for (let i = 0; i < 40; i++) {
            const x = 20 + noise2(i, 1) * 88;
            ctx.strokeStyle = i % 3 ? '#c4a84a' : '#6a8a32';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x, size);
            ctx.quadraticCurveTo(x + (noise2(i, 2) - 0.5) * 18, size * 0.45, x + (noise2(i, 4) - 0.5) * 10, 8);
            ctx.stroke();
        }
        const tex = toTexture(el, { repeat: [1, 1], aniso: 2 });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}
