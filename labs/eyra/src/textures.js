/**
 * Texturas procedurais — o lab não usa PNG externos.
 * Ruído, musgo, casca, membrana de asa e rampa de musgo úmido.
 */

import * as THREE from 'three';

const cache = new Map();

function canvas(w, h = w) {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    return el;
}

function toTexture(el, { nearest = false, repeat = [1, 1], colorSpace = true } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = colorSpace && !nearest ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = nearest ? 1 : 8;
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

function noise2(x, y) {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
}

function fbm(x, y) {
    let v = 0;
    let a = 0.5;
    let f = 1;
    for (let i = 0; i < 5; i++) {
        v += a * noise2(x * f, y * f);
        f *= 2.03;
        a *= 0.5;
    }
    return v;
}

export function rockTexture() {
    return cached('rock', () => {
        const s = 256;
        const el = canvas(s);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const n = fbm(x * 0.035, y * 0.035);
                const crack = Math.abs(Math.sin(x * 0.08 + n * 6) * Math.cos(y * 0.07));
                const g = 78 + n * 55 + crack * 18;
                const i = (y * s + x) * 4;
                img.data[i] = g * 0.82;
                img.data[i + 1] = g * 0.92;
                img.data[i + 2] = g * 0.78;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [4, 4] });
    });
}

export function mossTexture() {
    return cached('moss', () => {
        const s = 256;
        const el = canvas(s);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const n = fbm(x * 0.05, y * 0.05);
                const speck = noise2(x * 0.4, y * 0.4);
                const i = (y * s + x) * 4;
                img.data[i] = 18 + n * 40 + speck * 20;
                img.data[i + 1] = 70 + n * 90 + speck * 30;
                img.data[i + 2] = 28 + n * 35;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [6, 6] });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const s = 128;
        const el = canvas(s);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const n = fbm(x * 0.18, y * 0.04);
                const i = (y * s + x) * 4;
                const g = 48 + n * 40;
                img.data[i] = g * 0.7;
                img.data[i + 1] = g * 0.48;
                img.data[i + 2] = g * 0.32;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [2, 4] });
    });
}

export function leafTexture() {
    return cached('leaf', () => {
        const s = 128;
        const el = canvas(s);
        const ctx = el.getContext('2d');
        const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
        g.addColorStop(0, '#3ecf6a');
        g.addColorStop(0.55, '#1a8a48');
        g.addColorStop(1, '#0a4a28');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(20, 80, 40, 0.35)';
        for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.moveTo(64, 8);
            ctx.quadraticCurveTo(40 + i * 4, 70, 20 + i * 8, 120);
            ctx.stroke();
        }
        return toTexture(el);
    });
}

export function wingTexture() {
    return cached('wing', () => {
        const el = canvas(256, 128);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 256, 128);
        g.addColorStop(0, '#143a48');
        g.addColorStop(0.4, '#1a5a62');
        g.addColorStop(0.7, '#0e2a38');
        g.addColorStop(1, '#082028');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 256, 128);
        ctx.strokeStyle = 'rgba(94, 240, 216, 0.28)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 9; i++) {
            ctx.beginPath();
            ctx.moveTo(12, 8);
            ctx.quadraticCurveTo(80 + i * 14, 40 + i * 6, 240, 20 + i * 12);
            ctx.stroke();
        }
        ctx.fillStyle = 'rgba(94, 240, 216, 0.12)';
        for (let i = 0; i < 18; i++) {
            ctx.beginPath();
            ctx.ellipse(30 + (i % 6) * 38, 24 + Math.floor(i / 6) * 36, 10, 16, 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el);
    });
}

export function waterTexture() {
    return cached('water', () => {
        const s = 256;
        const el = canvas(s);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(s, s);
        for (let y = 0; y < s; y++) {
            for (let x = 0; x < s; x++) {
                const n = fbm(x * 0.04, y * 0.04);
                const i = (y * s + x) * 4;
                img.data[i] = 20 + n * 30;
                img.data[i + 1] = 90 + n * 70;
                img.data[i + 2] = 110 + n * 80;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [8, 8] });
    });
}

export function glowSprite(color = '#5ef0d8') {
    return cached(`glow:${color}`, () => {
        const el = canvas(64);
        const ctx = el.getContext('2d');
        const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.2, color);
        g.addColorStop(0.55, color + '88');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
        const tex = toTexture(el, { colorSpace: false });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}
