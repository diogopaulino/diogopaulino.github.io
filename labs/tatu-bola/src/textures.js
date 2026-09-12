/**
 * Texturas PBR procedurais — casco, areia, pedra, casca e água.
 * Sem PNG externos: albedo, normal e roughness em canvas.
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

/** Placas do casco do tatu — faixas e granulação. */
export function shellArmor({ size = 256, repeat = [2, 2] } = {}) {
    return cached(`shell:${size}`, () => {
        const el = canvas(size);
        const rEl = canvas(size);
        const ctx = el.getContext('2d');
        const rctx = rEl.getContext('2d');
        const img = ctx.createImageData(size, size);
        const rimg = rctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.05, y * 0.05, 3, 4);
                const band = Math.abs(Math.sin((x / size) * Math.PI * 4)) * 0.35;
                const chip = fbm(x * 0.14, y * 0.14, 11, 3);
                const base = 210 + n * 30 - chip * 22 - band * 40;
                const i = (y * size + x) * 4;
                img.data[i] = base + 12;
                img.data[i + 1] = base - 20;
                img.data[i + 2] = base - 70;
                img.data[i + 3] = 255;
                rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = 90 + n * 50 + band * 40;
                rimg.data[i + 3] = 255;
                height[y * size + x] = 0.45 + n * 0.35 + band * 0.25 - chip * 0.15;
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

/** Areia / grão fino para micro-relevo do terreno. */
export function sandGrain({ size = 256, repeat = [24, 24] } = {}) {
    return cached(`sand:${size}`, () => {
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                height[y * size + x] = fbm(x * 0.12, y * 0.12, 7, 4);
            }
        }
        return {
            normalMap: toTexture(heightToNormal(height, size, 3.6), {
                repeat, srgb: false, normal: true, aniso: 4
            })
        };
    });
}

/** Pedra do templo — juntas e granulação. */
export function templeStone({ size = 256, repeat = [2, 2] } = {}) {
    return cached(`stone:${size}`, () => {
        const el = canvas(size);
        const rEl = canvas(size);
        const ctx = el.getContext('2d');
        const rctx = rEl.getContext('2d');
        const img = ctx.createImageData(size, size);
        const rimg = rctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        const bw = 32;
        const bh = 18;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const row = (y / bh) | 0;
                const ox = row % 2 === 0 ? 0 : bw * 0.5;
                const lx = ((x + ox) % bw) / bw;
                const ly = (y % bh) / bh;
                const mortar = lx < 0.07 || ly < 0.1 ? 1 : 0;
                const n = fbm(x * 0.04, y * 0.04, 5, 4);
                const shade = mortar ? 150 : 198 + n * 28;
                const i = (y * size + x) * 4;
                img.data[i] = shade + 10;
                img.data[i + 1] = shade;
                img.data[i + 2] = shade - 18;
                img.data[i + 3] = 255;
                rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = mortar ? 200 : 140 + n * 40;
                rimg.data[i + 3] = 255;
                height[y * size + x] = mortar ? 0.18 : 0.55 + n * 0.3;
            }
        }
        ctx.putImageData(img, 0, 0);
        rctx.putImageData(rimg, 0, 0);
        return {
            map: toTexture(el, { repeat }),
            normalMap: toTexture(heightToNormal(height, size, 5.0), { repeat, srgb: false, normal: true }),
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
            repeat: [6, 6],
            srgb: false,
            normal: true,
            aniso: 4
        });
    });
}

export function leafTexture({ size = 128, repeat = [1, 1] } = {}) {
    return cached(`leaf:${size}`, () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.07, y * 0.07, 2, 3);
                const vein = Math.abs(x / size - 0.5) < 0.04 ? 0.25 : 0;
                const i = (y * size + x) * 4;
                img.data[i] = 30 + n * 20;
                img.data[i + 1] = 120 + n * 50 - vein * 40;
                img.data[i + 2] = 48 + n * 18;
                img.data[i + 3] = 255;
                height[y * size + x] = 0.4 + n * 0.4 + vein;
            }
        }
        ctx.putImageData(img, 0, 0);
        return {
            map: toTexture(el, { repeat }),
            normalMap: toTexture(heightToNormal(height, size, 3.8), { repeat, srgb: false, normal: true })
        };
    });
}
