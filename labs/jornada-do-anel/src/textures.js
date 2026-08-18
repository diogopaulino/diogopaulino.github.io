/**
 * Texturas procedurais em canvas — o lab não depende de PNG externos.
 * Albedo + normal + roughness para o PBR não parecer plástico liso.
 */

import * as THREE from 'three';
import { hash2 } from './utils.js?v=3';

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
    else tex.colorSpace = THREE.LinearSRGBColorSpace;
    tex.needsUpdate = true;
    tex.userData.shared = true;
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

/** Normal map a partir da luminância do albedo (não sRGB). */
function normalFrom(src, scale = 2.4) {
    const w = src.width;
    const h = src.height;
    const sctx = src.getContext('2d');
    const srcData = sctx.getImageData(0, 0, w, h).data;
    const el = canvas(w, h);
    const ctx = el.getContext('2d');
    const out = ctx.createImageData(w, h);
    const d = out.data;
    const lum = (x, y) => {
        const i = (((y + h) % h) * w + ((x + w) % w)) * 4;
        return srcData[i] * 0.3 + srcData[i + 1] * 0.59 + srcData[i + 2] * 0.11;
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const nx = (lum(x - 1, y) - lum(x + 1, y)) / 255 * scale;
            const ny = (lum(x, y - 1) - lum(x, y + 1)) / 255 * scale;
            const nz = 1;
            const len = Math.hypot(nx, ny, nz) || 1;
            const i = (y * w + x) * 4;
            d[i] = (nx / len * 0.5 + 0.5) * 255;
            d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
            d[i + 2] = (nz / len * 0.5 + 0.5) * 255;
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(out, 0, 0);
    return el;
}

function roughnessFrom(src, base = 0.72, contrast = 0.35) {
    const w = src.width;
    const h = src.height;
    const sctx = src.getContext('2d');
    const srcData = sctx.getImageData(0, 0, w, h).data;
    const el = canvas(w, h);
    const ctx = el.getContext('2d');
    const out = ctx.createImageData(w, h);
    const d = out.data;
    for (let i = 0; i < srcData.length; i += 4) {
        const l = (srcData[i] * 0.3 + srcData[i + 1] * 0.59 + srcData[i + 2] * 0.11) / 255;
        const r = Math.max(0, Math.min(1, base + (0.5 - l) * contrast));
        const v = r * 255;
        d[i] = d[i + 1] = d[i + 2] = v;
        d[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
    return el;
}

function packMaps(albedoEl, { repeat = [1, 1], bump = 2.2, roughBase = 0.75, aniso = 4 } = {}) {
    const map = toTexture(albedoEl, { repeat, srgb: true, aniso });
    const normalMap = toTexture(normalFrom(albedoEl, bump), { repeat, srgb: false, aniso });
    const roughnessMap = toTexture(roughnessFrom(albedoEl, roughBase), { repeat, srgb: false, aniso });
    return { map, normalMap, roughnessMap };
}

export function grassTexture() {
    return cached('grass', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#3d6a22');
        g.addColorStop(0.5, '#4e7e2c');
        g.addColorStop(1, '#355c1c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1400; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.55 ? '#6ea83c' : '#2d5414';
            ctx.globalAlpha = 0.38 + hash2(i, 7) * 0.25;
            ctx.lineWidth = 1 + hash2(i, 8);
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(
                x + (hash2(i, 5) - 0.5) * 6,
                y - 5,
                x + (hash2(i, 11) - 0.5) * 5,
                y - 8 - hash2(i, 6) * 12
            );
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        grain(ctx, size, size, 18, 3);
        return packMaps(el, { repeat: [22, 22], bump: 1.8, roughBase: 0.92 });
    });
}

export function dirtTexture() {
    return cached('dirt', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a4a2c';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = `rgba(${90 + hash2(i, 1) * 40},${60 + hash2(i, 2) * 30},${30},0.25)`;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 3) * size, hash2(i, 4) * size, 6 + hash2(i, 5) * 18, 4 + hash2(i, 6) * 10, hash2(i, 7) * 4, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 42, 8);
        return packMaps(el, { repeat: [10, 10], bump: 2.6, roughBase: 0.94 });
    });
}

export function mossTexture() {
    return cached('moss', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#2f4a22';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 110; i++) {
            ctx.fillStyle = `rgba(${36 + hash2(i, 1) * 50},${80 + hash2(i, 2) * 70},${18},0.45)`;
            ctx.beginPath();
            ctx.arc(hash2(i, 3) * size, hash2(i, 4) * size, 6 + hash2(i, 5) * 26, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 26, 2);
        return packMaps(el, { repeat: [8, 8], bump: 2.1, roughBase: 0.9 });
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a2618';
        ctx.fillRect(0, 0, size, size);
        for (let x = 0; x < size; x += 6) {
            ctx.strokeStyle = hash2(x, 1) > 0.5 ? '#5c3c26' : '#24140c';
            ctx.lineWidth = 2 + hash2(x, 2) * 4;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            let y = 0;
            while (y < size) {
                const nx = x + (hash2(x, y + 3) - 0.5) * 10;
                ctx.lineTo(nx, y + 18);
                y += 18;
            }
            ctx.stroke();
        }
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = 'rgba(20,10,6,0.45)';
            ctx.beginPath();
            ctx.ellipse(hash2(i, 8) * size, hash2(i, 9) * size, 4, 14, 0.2, 0, Math.PI * 2);
            ctx.stroke();
        }
        grain(ctx, size, size, 24, 4);
        return packMaps(el, { repeat: [2, 5], bump: 3.4, roughBase: 0.92 });
    });
}

export function leafTexture(tint = '#2f6a24') {
    return cached(`leaf:${tint}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 520; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#4a8a32' : '#1a4214';
            ctx.globalAlpha = 0.32;
            ctx.beginPath();
            ctx.ellipse(hash2(i, 2) * size, hash2(i, 3) * size, 3 + hash2(i, 8) * 5, 7 + hash2(i, 9) * 8, hash2(i, 4) * 6, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        grain(ctx, size, size, 20, 5);
        return packMaps(el, { repeat: [2, 2], bump: 1.6, roughBase: 0.78 });
    });
}

export function stoneTexture(tint = '#8a8680') {
    return cached(`stone:${tint}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 55; i++) {
            ctx.strokeStyle = `rgba(0,0,0,${0.08 + hash2(i, 1) * 0.16})`;
            ctx.lineWidth = 1 + hash2(i, 8) * 2;
            ctx.beginPath();
            ctx.moveTo(hash2(i, 2) * size, hash2(i, 3) * size);
            ctx.quadraticCurveTo(
                hash2(i, 6) * size, hash2(i, 7) * size,
                hash2(i, 4) * size, hash2(i, 5) * size
            );
            ctx.stroke();
        }
        for (let i = 0; i < 24; i++) {
            ctx.fillStyle = `rgba(255,255,255,${0.03 + hash2(i, 12) * 0.05})`;
            ctx.beginPath();
            ctx.arc(hash2(i, 13) * size, hash2(i, 14) * size, 4 + hash2(i, 15) * 12, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 32, 6);
        return packMaps(el, { repeat: [4, 4], bump: 2.8, roughBase: 0.88 });
    });
}

export function marbleTexture() {
    return cached('marble', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#efeae0';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 22; i++) {
            ctx.strokeStyle = `rgba(150,140,112,${0.12 + hash2(i, 1) * 0.22})`;
            ctx.lineWidth = 1 + hash2(i, 2) * 2.4;
            ctx.beginPath();
            ctx.moveTo(0, hash2(i, 3) * size);
            ctx.bezierCurveTo(
                size * 0.3, hash2(i, 4) * size,
                size * 0.65, hash2(i, 5) * size,
                size, hash2(i, 6) * size
            );
            ctx.stroke();
        }
        grain(ctx, size, size, 14, 7);
        return packMaps(el, { repeat: [3, 3], bump: 1.2, roughBase: 0.38 });
    });
}

export function woodTexture() {
    return cached('wood', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6b4428';
        ctx.fillRect(0, 0, size, size);
        const planks = 7;
        const ph = size / planks;
        for (let i = 0; i < planks; i++) {
            ctx.fillStyle = i % 2 ? '#7e5634' : '#5a3820';
            ctx.fillRect(0, i * ph + 1, size, ph - 2);
            ctx.strokeStyle = 'rgba(30,16,8,0.35)';
            ctx.beginPath();
            ctx.moveTo(0, i * ph);
            ctx.lineTo(size, i * ph);
            ctx.stroke();
            for (let x = 0; x < size; x += 18) {
                ctx.strokeStyle = `rgba(40,22,10,${0.08 + hash2(i, x) * 0.12})`;
                ctx.beginPath();
                ctx.moveTo(x, i * ph + 2);
                ctx.lineTo(x + (hash2(x, i) - 0.5) * 8, (i + 1) * ph - 2);
                ctx.stroke();
            }
        }
        grain(ctx, size, size, 22, 9);
        return packMaps(el, { repeat: [2, 2], bump: 2.2, roughBase: 0.78 });
    });
}

export function goldTexture() {
    return cached('gold', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#fff6c4');
        g.addColorStop(0.28, '#e8c04a');
        g.addColorStop(0.55, '#c48a18');
        g.addColorStop(0.78, '#8a5a10');
        g.addColorStop(1, '#f2d56a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 18; i++) {
            ctx.strokeStyle = `rgba(255,240,180,${0.12 + hash2(i, 2) * 0.18})`;
            ctx.beginPath();
            ctx.moveTo(hash2(i, 3) * size, 0);
            ctx.lineTo(hash2(i, 4) * size, size);
            ctx.stroke();
        }
        grain(ctx, size, size, 16, 11);
        return packMaps(el, { repeat: [1, 1], bump: 1.4, roughBase: 0.22 });
    });
}

export function doorTexture(color = '#2d6b38') {
    return cached(`door:${color}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = 'rgba(20,12,6,0.32)';
        ctx.lineWidth = 7;
        for (let i = 1; i < 6; i++) {
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, (size / 2) * (i / 6), 0, Math.PI * 2);
            ctx.stroke();
        }
        for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(size / 2, size / 2);
            ctx.lineTo(size / 2 + Math.cos(ang) * size * 0.48, size / 2 + Math.sin(ang) * size * 0.48);
            ctx.stroke();
        }
        ctx.fillStyle = '#d4b24a';
        ctx.beginPath();
        ctx.arc(size * 0.74, size * 0.5, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6a4a18';
        ctx.beginPath();
        ctx.arc(size * 0.74, size * 0.5, 3, 0, Math.PI * 2);
        ctx.fill();
        grain(ctx, size, size, 16, 12);
        return packMaps(el, { repeat: [1, 1], bump: 2.0, roughBase: 0.62 });
    });
}

export function waterTexture() {
    return cached('water', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#163a58');
        g.addColorStop(0.45, '#2a7a88');
        g.addColorStop(1, '#0e2a44');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 28; i++) {
            ctx.strokeStyle = `rgba(200,230,255,${0.07 + hash2(i, 1) * 0.12})`;
            ctx.lineWidth = 1 + hash2(i, 8) * 2;
            ctx.beginPath();
            ctx.moveTo(0, hash2(i, 2) * size);
            ctx.bezierCurveTo(size * 0.35, hash2(i, 3) * size, size * 0.7, hash2(i, 4) * size, size, hash2(i, 5) * size);
            ctx.stroke();
        }
        return packMaps(el, { repeat: [10, 10], bump: 3.6, roughBase: 0.12 });
    });
}

export function brickTexture() {
    return cached('brick', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a342c';
        ctx.fillRect(0, 0, size, size);
        const bw = 42;
        const bh = 18;
        for (let y = 0, row = 0; y < size; y += bh, row++) {
            const off = row % 2 ? bw / 2 : 0;
            for (let x = -bw; x < size; x += bw) {
                const shade = hash2(x, y);
                ctx.fillStyle = shade > 0.55 ? '#6e5c4a' : shade > 0.25 ? '#5a4a3a' : '#4a3c30';
                ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
            }
        }
        grain(ctx, size, size, 20, 14);
        return packMaps(el, { repeat: [4, 4], bump: 2.4, roughBase: 0.9 });
    });
}

export function skinTexture() {
    return cached('skin', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#e8b889';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = `rgba(${200 + hash2(i, 1) * 30},${140 + hash2(i, 2) * 30},${100},0.12)`;
            ctx.beginPath();
            ctx.arc(hash2(i, 3) * size, hash2(i, 4) * size, 2 + hash2(i, 5) * 8, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 12, 20);
        return packMaps(el, { repeat: [2, 2], bump: 0.9, roughBase: 0.62 });
    });
}

export function clothTexture(tint = '#9aa3ad') {
    return cached(`cloth:${tint}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = tint;
        ctx.fillRect(0, 0, size, size);
        for (let y = 0; y < size; y += 3) {
            ctx.strokeStyle = `rgba(0,0,0,${0.04 + hash2(y, 1) * 0.06})`;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y + (hash2(y, 2) - 0.5) * 2);
            ctx.stroke();
        }
        grain(ctx, size, size, 14, 21);
        return packMaps(el, { repeat: [3, 3], bump: 1.1, roughBase: 0.86 });
    });
}

export function leatherTexture() {
    return cached('leather', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#5a3a18';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 28, 22);
        return packMaps(el, { repeat: [2, 2], bump: 1.8, roughBase: 0.7 });
    });
}

/** Folha de grama com alpha — dois planos cruzados usam o mesmo mapa. */
export function grassBladeTexture() {
    return cached('grassBlade', () => {
        const el = canvas(64, 128);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, 64, 128);
        const g = ctx.createLinearGradient(32, 128, 32, 0);
        g.addColorStop(0, '#2a4a14');
        g.addColorStop(0.45, '#4a7a28');
        g.addColorStop(1, '#8aba48');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(32, 4);
        ctx.quadraticCurveTo(48, 50, 40, 128);
        ctx.lineTo(24, 128);
        ctx.quadraticCurveTo(16, 50, 32, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(180,220,80,0.35)';
        ctx.beginPath();
        ctx.moveTo(32, 8);
        ctx.quadraticCurveTo(36, 60, 33, 120);
        ctx.lineTo(31, 120);
        ctx.fill();
        const tex = toTexture(el, { repeat: [1, 1], srgb: true, aniso: 2 });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}

export function cloudTexture() {
    return cached('cloud', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, size, size);
        for (let i = 0; i < 18; i++) {
            const x = 40 + hash2(i, 1) * 176;
            const y = 50 + hash2(i, 2) * 140;
            const r = 28 + hash2(i, 3) * 46;
            const grd = ctx.createRadialGradient(x, y, 4, x, y, r);
            grd.addColorStop(0, 'rgba(255,255,255,0.55)');
            grd.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = grd;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        const tex = toTexture(el, { repeat: [1, 1], srgb: true, aniso: 1 });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}

export function faceTexture() {
    return cached('face', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#e8b889';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#c48a68';
        ctx.beginPath();
        ctx.ellipse(64, 78, 22, 16, 0, 0, Math.PI * 2);
        ctx.fill();
        for (const sx of [-1, 1]) {
            ctx.fillStyle = '#f7f2ea';
            ctx.beginPath();
            ctx.ellipse(64 + sx * 16, 54, 8, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2a4a18';
            ctx.beginPath();
            ctx.arc(64 + sx * 16, 54, 3.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#1a1a12';
            ctx.beginPath();
            ctx.arc(64 + sx * 16, 54, 1.4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#5a3a18';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(64 + sx * 16, 46, 8, Math.PI, 0);
            ctx.stroke();
        }
        ctx.fillStyle = '#d4a07a';
        ctx.beginPath();
        ctx.ellipse(64, 66, 6, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#a06050';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(64, 84, 8, 0.15, Math.PI - 0.15);
        ctx.stroke();
        grain(ctx, size, size, 10, 30);
        return toTexture(el, { repeat: [1, 1], srgb: true, aniso: 2 });
    });
}

export function applyMaps(material, maps, { color = 0xffffff, roughness = 0.82, metalness = 0.02, normalScale = 0.85 } = {}) {
    if (!maps) return material;
    material.map = maps.map;
    material.normalMap = maps.normalMap;
    material.roughnessMap = maps.roughnessMap;
    material.color.set(color);
    material.roughness = roughness;
    material.metalness = metalness;
    if (material.normalScale) material.normalScale.set(normalScale, normalScale);
    material.needsUpdate = true;
    return material;
}
