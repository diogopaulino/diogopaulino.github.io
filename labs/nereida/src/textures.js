/**
 * Texturas PBR procedurais — areia, kelp, pedra e pele orgânica.
 * Albedo + normal + roughness em canvas (padrão castelo-estelar).
 */

import * as THREE from 'three';

const cache = new Map();

function canvas(size, height = size) {
    const el = document.createElement('canvas');
    el.width = size;
    el.height = height;
    return el;
}

function hash2(x, y, seed = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

function valueNoise(x, y, seed = 0) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(x0, y0, seed);
    const b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed);
    const d = hash2(x0 + 1, y0 + 1, seed);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x, y, seed = 0, octaves = 5) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 19) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
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

/** Areia do fundo — grãos e dunas suaves. Devolve canvas (compat) ou PBR. */
export function sandTexture() {
    const c = canvas(256);
    const ctx = c.getContext('2d');
    const s = 256;
    const g = ctx.createLinearGradient(0, 0, s, s);
    g.addColorStop(0, '#1a4a4a');
    g.addColorStop(0.45, '#2d6a62');
    g.addColorStop(1, '#163a42');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 1800; i++) {
        const x = Math.random() * s;
        const y = Math.random() * s;
        const a = 0.04 + Math.random() * 0.12;
        ctx.fillStyle = Math.random() > 0.5
            ? `rgba(180, 220, 200, ${a})`
            : `rgba(20, 40, 50, ${a})`;
        ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
    }
    return c;
}

export function sandPBR({ size = 256, repeat = [10, 10] } = {}) {
    return cached(`sandPBR:${size}`, () => {
        const el = canvas(size);
        const rEl = canvas(size);
        const ctx = el.getContext('2d');
        const rctx = rEl.getContext('2d');
        const img = ctx.createImageData(size, size);
        const rimg = rctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.045, y * 0.045, 3, 4);
                const grain = fbm(x * 0.22, y * 0.22, 11, 3);
                const dune = Math.sin(x * 0.04) * Math.cos(y * 0.03) * 0.15;
                const base = 90 + n * 40 + grain * 18;
                const i = (y * size + x) * 4;
                img.data[i] = base * 0.55;
                img.data[i + 1] = base * 0.85;
                img.data[i + 2] = base * 0.78;
                img.data[i + 3] = 255;
                rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = 200 + grain * 40;
                rimg.data[i + 3] = 255;
                height[y * size + x] = 0.4 + n * 0.35 + dune + grain * 0.1;
            }
        }
        ctx.putImageData(img, 0, 0);
        rctx.putImageData(rimg, 0, 0);
        return {
            map: toTexture(el, { repeat, aniso: 8 }),
            normalMap: toTexture(heightToNormal(height, size, 4.8), { repeat, srgb: false, normal: true }),
            roughnessMap: toTexture(rEl, { repeat, srgb: false })
        };
    });
}

export function kelpTexture() {
    const c = canvas(64);
    const ctx = c.getContext('2d');
    const s = 64;
    ctx.clearRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, 0, s, 0);
    g.addColorStop(0, 'rgba(10, 60, 50, 0)');
    g.addColorStop(0.25, 'rgba(18, 140, 96, 0.92)');
    g.addColorStop(0.5, 'rgba(80, 220, 160, 0.95)');
    g.addColorStop(0.75, 'rgba(20, 120, 90, 0.9)');
    g.addColorStop(1, 'rgba(10, 60, 50, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(8, 0, s - 16, s);
    ctx.fillStyle = 'rgba(180, 255, 210, 0.18)';
    ctx.fillRect(s * 0.42, 0, 3, s);
    return c;
}

/** Pedra vulcânica submarina — poros e musgo. */
export function rockPBR({ size = 256, repeat = [2, 2] } = {}) {
    return cached(`rockPBR:${size}`, () => {
        const el = canvas(size);
        const rEl = canvas(size);
        const ctx = el.getContext('2d');
        const rctx = rEl.getContext('2d');
        const img = ctx.createImageData(size, size);
        const rimg = rctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.035, y * 0.035, 7, 5);
                const pore = fbm(x * 0.12, y * 0.12, 21, 3);
                const moss = fbm(x * 0.06, y * 0.08, 33, 3);
                const v = 28 + n * 38 - pore * pore * 22;
                const i = (y * size + x) * 4;
                img.data[i] = v + moss * 8;
                img.data[i + 1] = v + 12 + moss * 22;
                img.data[i + 2] = v + 18 + moss * 10;
                img.data[i + 3] = 255;
                rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = 160 + n * 60 + pore * 30;
                rimg.data[i + 3] = 255;
                height[y * size + x] = 0.35 + n * 0.45 - pore * 0.25;
            }
        }
        ctx.putImageData(img, 0, 0);
        rctx.putImageData(rimg, 0, 0);
        return {
            map: toTexture(el, { repeat }),
            normalMap: toTexture(heightToNormal(height, size, 5.8), { repeat, srgb: false, normal: true }),
            roughnessMap: toTexture(rEl, { repeat, srgb: false })
        };
    });
}

/** Pele lisa de peixe/arraia — microrelevo. */
export function skinPBR({ size = 128, repeat = [3, 3] } = {}) {
    return cached(`skinPBR:${size}`, () => {
        const height = new Float32Array(size * size);
        const rEl = canvas(size);
        const rctx = rEl.getContext('2d');
        const rimg = rctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.08, y * 0.08, 5, 4);
                const scale = Math.sin(x * 0.35) * Math.sin(y * 0.28) * 0.08;
                height[y * size + x] = 0.5 + n * 0.2 + scale;
                const i = (y * size + x) * 4;
                rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = 90 + n * 50;
                rimg.data[i + 3] = 255;
            }
        }
        rctx.putImageData(rimg, 0, 0);
        return {
            normalMap: toTexture(heightToNormal(height, size, 3.2), { repeat, srgb: false, normal: true }),
            roughnessMap: toTexture(rEl, { repeat, srgb: false })
        };
    });
}

/** Coral calcário — poros e rugosidade. */
export function coralPBR({ size = 128, repeat = [2, 2] } = {}) {
    return cached(`coralPBR:${size}`, () => {
        const height = new Float32Array(size * size);
        const rEl = canvas(size);
        const rctx = rEl.getContext('2d');
        const rimg = rctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.07, y * 0.07, 9, 4);
                const pore = fbm(x * 0.18, y * 0.18, 41, 3);
                height[y * size + x] = 0.4 + n * 0.4 - pore * 0.3;
                const i = (y * size + x) * 4;
                rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = 140 + n * 80;
                rimg.data[i + 3] = 255;
            }
        }
        rctx.putImageData(rimg, 0, 0);
        return {
            normalMap: toTexture(heightToNormal(height, size, 5.0), { repeat, srgb: false, normal: true }),
            roughnessMap: toTexture(rEl, { repeat, srgb: false })
        };
    });
}

export function rockTexture() {
    const c = canvas(128);
    const ctx = c.getContext('2d');
    const s = 128;
    ctx.fillStyle = '#1c3340';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 400; i++) {
        ctx.fillStyle = `rgba(${20 + Math.random() * 50},${40 + Math.random() * 40},${50 + Math.random() * 40},${0.15 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 8, 0, Math.PI * 2);
        ctx.fill();
    }
    return c;
}
