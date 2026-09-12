/**
 * Texturas PBR procedurais — grama, pedra pêssego, casca, água e ouro.
 */

import * as THREE from 'three';
import { fbm } from './utils.js';

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
    if (normal) tex.colorSpace = THREE.NoColorSpace;
    else if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
}

function cached(key, factory) {
    if (!cache.has(key)) cache.set(key, factory());
    return cache.get(key);
}

function heightToNormal(height, size, strength = 4.2) {
    const nEl = canvas(size);
    const nctx = nEl.getContext('2d');
    const img = nctx.createImageData(size, size);
    const d = img.data;
    const at = (x, y) => height[((y + size) % size) * size + ((x + size) % size)];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
            const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
            const inv = 1 / Math.hypot(dx, dy, 1);
            const i = (y * size + x) * 4;
            d[i] = (0.5 - dx * inv * 0.5) * 255;
            d[i + 1] = (0.5 - dy * inv * 0.5) * 255;
            d[i + 2] = (0.5 + inv * 0.5) * 255;
            d[i + 3] = 255;
        }
    }
    nctx.putImageData(img, 0, 0);
    return nEl;
}

export function grassDetail({ size = 256, repeat = [28, 28] } = {}) {
    return cached(`grass:${size}`, () => {
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                height[y * size + x] = fbm(x * 0.11, y * 0.11, 3, 4);
            }
        }
        return {
            normalMap: toTexture(heightToNormal(height, size, 3.8), {
                repeat, srgb: false, normal: true, aniso: 4
            })
        };
    });
}

/** Calcário rosado do castelo pêssego. */
export function peachStone({ size = 256, repeat = [3, 3] } = {}) {
    return cached(`peach:${size}`, () => {
        const el = canvas(size);
        const rEl = canvas(size);
        const ctx = el.getContext('2d');
        const rctx = rEl.getContext('2d');
        const img = ctx.createImageData(size, size);
        const rimg = rctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        const bw = 26;
        const bh = 14;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const row = (y / bh) | 0;
                const ox = row % 2 === 0 ? 0 : bw * 0.5;
                const lx = ((x + ox) % bw) / bw;
                const ly = (y % bh) / bh;
                const mortar = lx < 0.08 || ly < 0.12 ? 1 : 0;
                const n = fbm(x * 0.045, y * 0.045, 4, 4);
                const chip = fbm(x * 0.12, y * 0.12, 14, 3);
                const base = 220 + n * 20 - chip * 14;
                const i = (y * size + x) * 4;
                if (mortar) {
                    img.data[i] = 190;
                    img.data[i + 1] = 150;
                    img.data[i + 2] = 145;
                } else {
                    img.data[i] = base + 8;
                    img.data[i + 1] = base - 28;
                    img.data[i + 2] = base - 40;
                }
                img.data[i + 3] = 255;
                rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = mortar ? 205 : 145 + n * 35;
                rimg.data[i + 3] = 255;
                height[y * size + x] = mortar ? 0.2 : 0.55 + n * 0.3 - chip * 0.15;
            }
        }
        ctx.putImageData(img, 0, 0);
        rctx.putImageData(rimg, 0, 0);
        return {
            map: toTexture(el, { repeat }),
            normalMap: toTexture(heightToNormal(height, size, 5.2), { repeat, srgb: false, normal: true }),
            roughnessMap: toTexture(rEl, { repeat, srgb: false })
        };
    });
}

export function barkTexture({ size = 256, repeat = [1, 3] } = {}) {
    return cached(`bark:${size}`, () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.08, y * 0.02, 8, 4);
                const v = 28 + n * 22;
                const i = (y * size + x) * 4;
                img.data[i] = v + 8;
                img.data[i + 1] = v;
                img.data[i + 2] = v - 6;
                img.data[i + 3] = 255;
                height[y * size + x] = n;
            }
        }
        ctx.putImageData(img, 0, 0);
        return {
            map: toTexture(el, { repeat }),
            normalMap: toTexture(heightToNormal(height, size, 4.5), { repeat, srgb: false, normal: true })
        };
    });
}

export function leafCanopy({ size = 128, repeat = [2, 2] } = {}) {
    return cached(`canopy:${size}`, () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.09, y * 0.09, 2, 4);
                const i = (y * size + x) * 4;
                img.data[i] = 28 + n * 22;
                img.data[i + 1] = 140 + n * 40;
                img.data[i + 2] = 45 + n * 18;
                img.data[i + 3] = 255;
                height[y * size + x] = 0.4 + n * 0.5;
            }
        }
        ctx.putImageData(img, 0, 0);
        return {
            map: toTexture(el, { repeat }),
            normalMap: toTexture(heightToNormal(height, size, 3.5), { repeat, srgb: false, normal: true })
        };
    });
}

export function waterNormals(size = 256) {
    return cached(`waterN:${size}`, () => {
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = x / size;
                const v = y / size;
                height[y * size + x] =
                    Math.sin(u * Math.PI * 8) * 0.35
                    + Math.sin(v * Math.PI * 6 + u * 4) * 0.28
                    + fbm(u * 6, v * 6, 21, 4) * 0.7;
            }
        }
        return toTexture(heightToNormal(height, size, 3.4), {
            repeat: [5, 5],
            srgb: false,
            normal: true,
            aniso: 4
        });
    });
}

export function fabricTeal({ size = 128, repeat = [2, 2] } = {}) {
    return cached(`teal:${size}`, () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.15, y * 0.15, 6, 3);
                const weave = ((x >> 2) ^ (y >> 2)) & 1 ? 8 : 0;
                const i = (y * size + x) * 4;
                img.data[i] = 28 + n * 18 + weave;
                img.data[i + 1] = 130 + n * 30 + weave;
                img.data[i + 2] = 118 + n * 24;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return { map: toTexture(el, { repeat }) };
    });
}

export function goldMetal({ size = 64, repeat = [1, 1] } = {}) {
    return cached('gold', () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#fff1b8');
        g.addColorStop(0.4, '#d4af37');
        g.addColorStop(1, '#8a5a12');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        return { map: toTexture(el, { repeat }) };
    });
}
