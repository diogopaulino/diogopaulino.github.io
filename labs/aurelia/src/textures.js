/** Texturas procedurais em canvas — asfalto, terra, grama, casca, bandeiras. */

import * as THREE from 'three';

const cache = new Map();

function canvas(w, h) {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    return el;
}

function rng(seed = 1) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function makeTexture(key, w, h, draw, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
    if (cache.has(key)) return cache.get(key);
    const el = canvas(w, h);
    draw(el.getContext('2d'), w, h);
    const texture = new THREE.CanvasTexture(el);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.anisotropy = aniso;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    cache.set(key, texture);
    return texture;
}

function noise(ctx, w, h, { cells = 24, alpha = 0.28, seed = 1 } = {}) {
    const rand = rng(seed);
    const grid = new Float32Array((cells + 1) * (cells + 1));
    for (let y = 0; y <= cells; y++) {
        for (let x = 0; x <= cells; x++) {
            grid[y * (cells + 1) + x] = (x === cells ? grid[y * (cells + 1)] : 0) || rand();
        }
    }
    for (let x = 0; x <= cells; x++) grid[cells * (cells + 1) + x] = grid[x];
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
        const gy = (y / h) * cells;
        const y0 = Math.floor(gy), fy = gy - y0;
        for (let x = 0; x < w; x++) {
            const gx = (x / w) * cells;
            const x0 = Math.floor(gx), fx = gx - x0;
            const a = grid[y0 * (cells + 1) + x0];
            const b = grid[y0 * (cells + 1) + x0 + 1];
            const c = grid[(y0 + 1) * (cells + 1) + x0];
            const d = grid[(y0 + 1) * (cells + 1) + x0 + 1];
            const sx = fx * fx * (3 - 2 * fx);
            const sy = fy * fy * (3 - 2 * fy);
            const v = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
            const i = (y * w + x) * 4;
            const t = (v - 0.5) * 255 * alpha;
            data[i] = Math.max(0, Math.min(255, data[i] + t));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + t));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + t));
        }
    }
    ctx.putImageData(img, 0, 0);
}

export function roadTexture(aniso = 8) {
    return makeTexture('road', 512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#3a3d44';
        ctx.fillRect(0, 0, w, h);
        noise(ctx, w, h, { cells: 28, alpha: 0.22, seed: 11 });
        ctx.fillStyle = 'rgba(255,255,255,0.14)';
        ctx.fillRect(w * 0.48, 0, 4, h);
        ctx.fillRect(w * 0.52, 0, 4, h);
        ctx.strokeStyle = 'rgba(210,190,140,0.18)';
        ctx.lineWidth = 3;
        ctx.setLineDash([28, 36]);
        ctx.beginPath();
        ctx.moveTo(w * 0.18, 0);
        ctx.lineTo(w * 0.18, h);
        ctx.moveTo(w * 0.82, 0);
        ctx.lineTo(w * 0.82, h);
        ctx.stroke();
        const rand = rng(19);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        for (let i = 0; i < 900; i++) ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }, { repeat: [1, 18], aniso });
}

export function dirtTexture(aniso = 8) {
    return makeTexture('dirt', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#6b4a2e';
        ctx.fillRect(0, 0, w, h);
        noise(ctx, w, h, { cells: 16, alpha: 0.35, seed: 4 });
        const rand = rng(8);
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = rand() > 0.5 ? 'rgba(90,60,30,0.4)' : 'rgba(160,120,70,0.25)';
            ctx.fillRect(rand() * w, rand() * h, 3 + rand() * 4, 2);
        }
    }, { repeat: [6, 6], aniso });
}

export function grassTexture(aniso = 8) {
    return makeTexture('grass', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#3d6a32';
        ctx.fillRect(0, 0, w, h);
        noise(ctx, w, h, { cells: 20, alpha: 0.3, seed: 2 });
        const rand = rng(3);
        for (let i = 0; i < 1200; i++) {
            ctx.fillStyle = rand() > 0.5 ? 'rgba(90,140,50,0.45)' : 'rgba(30,70,25,0.4)';
            ctx.fillRect(rand() * w, rand() * h, 1, 3 + rand() * 4);
        }
    }, { repeat: [14, 14], aniso });
}

export function rockTexture(aniso = 4) {
    return makeTexture('rock', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#6a645c';
        ctx.fillRect(0, 0, w, h);
        noise(ctx, w, h, { cells: 10, alpha: 0.4, seed: 9 });
    }, { repeat: [2, 2], aniso });
}

export function barkTexture() {
    return makeTexture('bark', 64, 128, (ctx, w, h) => {
        ctx.fillStyle = '#4a3224';
        ctx.fillRect(0, 0, w, h);
        const rand = rng(5);
        for (let x = 0; x < w; x += 4) {
            ctx.fillStyle = rand() > 0.5 ? '#3a2418' : '#5a4030';
            ctx.fillRect(x, 0, 3, h);
        }
    }, { repeat: [1, 2] });
}

export function leafTexture() {
    return makeTexture('leaf', 64, 64, (ctx, w, h) => {
        ctx.fillStyle = '#2f6a28';
        ctx.fillRect(0, 0, w, h);
        noise(ctx, w, h, { cells: 6, alpha: 0.35, seed: 6 });
    });
}

export function bannerTexture(colorA = '#ff6b2c', colorB = '#111318') {
    const key = `banner-${colorA}-${colorB}`;
    return makeTexture(key, 256, 128, (ctx, w, h) => {
        ctx.fillStyle = colorB;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = colorA;
        ctx.fillRect(0, 0, w, h * 0.18);
        ctx.fillRect(0, h * 0.82, w, h * 0.18);
        ctx.fillStyle = '#fff6e8';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('AURELIA', w / 2, h * 0.48);
        ctx.font = '12px sans-serif';
        ctx.fillText('FESTIVAL', w / 2, h * 0.68);
    }, { repeat: [1, 1] });
}

export function smokeTexture() {
    return makeTexture('smoke', 64, 64, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(220,220,220,0.7)');
        g.addColorStop(0.45, 'rgba(180,180,180,0.28)');
        g.addColorStop(1, 'rgba(160,160,160,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }, { srgb: false });
}

export function envGradientTexture() {
    return makeTexture('envgrad', 64, 64, (ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#87a0c8');
        g.addColorStop(0.45, '#ffb070');
        g.addColorStop(1, '#5a3a22');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }, { srgb: true });
}
