/**
 * Texturas procedurais — o lab não usa PNG externos.
 * A rampa toon de 4 degraus é o que dá o look Disney/Pixar.
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

/**
 * Rampa de iluminação toon: sombra uva, meio rosa, luz pêssego, highlight creme.
 * Nearest filtering evita interpolar os degraus e “lavar” o cartoon.
 */
export function toonRamp() {
    return cached('toon', () => {
        const el = canvas(4, 1);
        const ctx = el.getContext('2d');
        ['#3a2060', '#c06a88', '#ffd4a0', '#fff8ee'].forEach((c, i) => {
            ctx.fillStyle = c;
            ctx.fillRect(i, 0, 1, 1);
        });
        return toTexture(el, { nearest: true });
    });
}

export function flagTexture(a = '#5b7cfa', b = '#ffe27a') {
    return cached(`flag:${a}:${b}`, () => {
        const el = canvas(64, 32);
        const ctx = el.getContext('2d');
        ctx.fillStyle = a;
        ctx.fillRect(0, 0, 64, 32);
        ctx.fillStyle = b;
        ctx.beginPath();
        ctx.moveTo(8, 16);
        ctx.lineTo(22, 8);
        ctx.lineTo(22, 24);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#fff6d8';
        ctx.beginPath();
        ctx.arc(40, 16, 6, 0, Math.PI * 2);
        ctx.fill();
        return toTexture(el);
    });
}

export function windowTexture() {
    return cached('window', () => {
        const el = canvas(32, 48);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, 0, 48);
        g.addColorStop(0, '#fff4c0');
        g.addColorStop(1, '#ff9a4a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 32, 48);
        ctx.strokeStyle = 'rgba(80, 40, 20, 0.35)';
        ctx.lineWidth = 3;
        ctx.strokeRect(2, 2, 28, 44);
        ctx.beginPath();
        ctx.moveTo(16, 2);
        ctx.lineTo(16, 46);
        ctx.moveTo(2, 24);
        ctx.lineTo(30, 24);
        ctx.stroke();
        return toTexture(el);
    });
}

export function grassTexture() {
    return cached('grass', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6fd15a';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 900; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.strokeStyle = Math.random() > 0.5 ? '#8ae06a' : '#4fb84a';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 4, y - 4 - Math.random() * 7);
            ctx.stroke();
        }
        for (let i = 0; i < 40; i++) {
            ctx.fillStyle = ['#ff7ab0', '#ffe066', '#c9a0ff'][i % 3];
            ctx.beginPath();
            ctx.arc(Math.random() * size, Math.random() * size, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { repeat: [8, 8] });
    });
}

export function stoneTexture() {
    return cached('stone', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#f3e0c8';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = 'rgba(160, 110, 90, 0.28)';
        ctx.lineWidth = 2;
        for (let y = 0; y < 8; y++) {
            for (let x = 0; x < 6; x++) {
                const ox = (y % 2) * 12;
                ctx.strokeRect(x * 24 + ox, y * 16, 22, 14);
            }
        }
        return toTexture(el, { repeat: [3, 4] });
    });
}
