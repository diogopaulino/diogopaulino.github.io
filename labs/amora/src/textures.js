/**
 * Texturas procedurais — o lab não usa PNG externos.
 * Rampa toon de 4 degraus (nearest) = look de livro infantil / Pixar.
 */

import * as THREE from 'three';

const cache = new Map();

function canvas(w, h = w) {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    return el;
}

function toTexture(el, { nearest = false, repeat = [1, 1] } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = nearest ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
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

/** Sombra musgo, meio pêssego, luz creme, highlight branco. */
export function toonRamp() {
    return cached('toon', () => {
        const el = canvas(4, 1);
        const ctx = el.getContext('2d');
        ['#2d5a3a', '#e08a6a', '#ffe2a8', '#fffaf0'].forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.fillRect(i, 0, 1, 1);
        });
        return toTexture(el, { nearest: true });
    });
}

export function grassTexture() {
    return cached('grass', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#7ad35c';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1100; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.strokeStyle = Math.random() > 0.45 ? '#9ae86e' : '#58b84a';
            ctx.lineWidth = 1.15;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 5 - Math.random() * 8);
            ctx.stroke();
        }
        for (let i = 0; i < 55; i++) {
            ctx.fillStyle = ['#ff7ab8', '#ffe066', '#c9a0ff', '#ff9f43'][i % 4];
            ctx.beginPath();
            ctx.arc(Math.random() * size, Math.random() * size, 1.7, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { repeat: [10, 10] });
    });
}

export function woodTexture() {
    return cached('wood', () => {
        const el = canvas(128);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#c47a48';
        ctx.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 10; i++) {
            ctx.fillStyle = i % 2 ? '#d68a55' : '#b06838';
            ctx.fillRect(0, i * 13, 128, 11);
        }
        ctx.strokeStyle = 'rgba(80, 40, 20, 0.25)';
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(20 + i * 18, 0);
            ctx.lineTo(12 + i * 18, 128);
            ctx.stroke();
        }
        return toTexture(el, { repeat: [2, 3] });
    });
}

export function picnicTexture() {
    return cached('picnic', () => {
        const el = canvas(64);
        const ctx = el.getContext('2d');
        const a = '#f4f0e6';
        const b = '#e85a6a';
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 8; x++) {
                ctx.fillStyle = (x + y) % 2 ? a : b;
                ctx.fillRect(x * 8, y * 8, 8, 8);
            }
        }
        return toTexture(el, { repeat: [4, 4] });
    });
}

export function barnTexture() {
    return cached('barn', () => {
        const el = canvas(64);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#e85a5a';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#c44848';
        for (let i = 0; i < 8; i++) ctx.fillRect(0, i * 8, 64, 3);
        return toTexture(el, { repeat: [2, 3] });
    });
}
