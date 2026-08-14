/**
 * Texturas procedurais em canvas — o lab não depende de PNG externos.
 */

import * as THREE from 'three';

const cache = new Map();

function canvas(size, height = size) {
    const el = document.createElement('canvas');
    el.width = size;
    el.height = height;
    return el;
}

function toTexture(el, { repeat = [1, 1], nearest = false } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = nearest ? 1 : 4;
    if (nearest) {
        tex.minFilter = tex.magFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
    }
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

export function toonRamp() {
    return cached('toon', () => {
        const el = canvas(4, 1);
        const ctx = el.getContext('2d');
        const stops = ['#3a2048', '#7a4a6a', '#c8a090', '#fff4e8'];
        stops.forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.fillRect(i, 0, 1, 1);
        });
        return toTexture(el, { nearest: true, repeat: [1, 1] });
    });
}

export function stoneTexture(tint = '#6a4a78') {
    return cached(`stone:${tint}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 90; i++) {
            const x = noise2(i, 1) * size;
            const y = noise2(i, 2) * size;
            const r = 8 + noise2(i, 3) * 28;
            ctx.fillStyle = `rgba(255,255,255,${0.04 + noise2(i, 4) * 0.08})`;
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * 0.7, noise2(i, 5) * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.strokeStyle = 'rgba(20,8,28,0.28)';
        ctx.lineWidth = 3;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 6; x++) {
                const ox = (y % 2) * 22;
                ctx.strokeRect(x * 48 + ox, y * 32, 46, 30);
            }
        }
        return toTexture(el, { repeat: [2, 2] });
    });
}

export function woodTexture() {
    return cached('wood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#5a3218';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 10; i++) {
            const y = i * (size / 10);
            ctx.fillStyle = i % 2 ? '#7a4a24' : '#4a2410';
            ctx.fillRect(0, y, size, size / 10 - 2);
            ctx.strokeStyle = 'rgba(20,8,0,0.35)';
            ctx.beginPath();
            ctx.moveTo(0, y + 6);
            for (let x = 0; x < size; x += 8) {
                ctx.lineTo(x, y + 6 + Math.sin(x * 0.08 + i) * 2);
            }
            ctx.stroke();
        }
        return toTexture(el, { repeat: [1, 1] });
    });
}

export function crystalTexture() {
    return cached('crystal', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#7ef0ff');
        g.addColorStop(0.5, '#c45cff');
        g.addColorStop(1, '#ffe08a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 0.25;
        for (let i = 0; i < 12; i++) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(noise2(i, 1) * size, 0);
            ctx.lineTo(noise2(i, 2) * size, size);
            ctx.lineTo(noise2(i, 3) * size, size);
            ctx.fill();
        }
        return toTexture(el, { repeat: [1, 1] });
    });
}

export function grassTexture() {
    return cached('grass', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#1f6a3a';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 800; i++) {
            const x = noise2(i, 1) * size;
            const y = noise2(i, 2) * size;
            ctx.strokeStyle = noise2(i, 3) > 0.5 ? '#3cb86a' : '#0d4024';
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 1, y - 6 - noise2(i, 4) * 6);
            ctx.stroke();
        }
        return toTexture(el, { repeat: [4, 4] });
    });
}

export function cloudTexture() {
    return cached('cloud', () => {
        const el = canvas(256, 128);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, 256, 128);
        for (let i = 0; i < 18; i++) {
            const x = 40 + noise2(i, 1) * 180;
            const y = 40 + noise2(i, 2) * 50;
            const r = 18 + noise2(i, 3) * 28;
            const g = ctx.createRadialGradient(x, y, 4, x, y, r);
            g.addColorStop(0, 'rgba(255,230,250,0.85)');
            g.addColorStop(1, 'rgba(255,230,250,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        const tex = new THREE.CanvasTexture(el);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        return tex;
    });
}
