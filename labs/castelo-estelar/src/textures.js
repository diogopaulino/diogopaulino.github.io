/**
 * Texturas PBR procedurais — calcário, telha azul, água, lua e bandeira.
 * Sem PNG externos: o lab gera albedo, normal e roughness em canvas.
 */

import * as THREE from 'three';
import { hash2, fbm } from './utils.js';

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

/**
 * Calcário de conto: junta de argamassa, blocos irregulares e granulação.
 * Devolve { map, normalMap, roughnessMap }.
 */
export function limestone({ size = 512, repeat = [6, 8] } = {}) {
    return cached(`lime:${size}:${repeat}`, () => {
        const el = canvas(size);
        const rEl = canvas(size);
        const ctx = el.getContext('2d');
        const rctx = rEl.getContext('2d');
        const img = ctx.createImageData(size, size);
        const rimg = rctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        const bw = 28;
        const bh = 14;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const row = (y / bh) | 0;
                const ox = row % 2 === 0 ? 0 : bw * 0.5;
                const lx = ((x + ox) % bw) / bw;
                const ly = (y % bh) / bh;
                const mortar = lx < 0.08 || ly < 0.12 ? 1 : 0;
                const n = fbm(x * 0.04, y * 0.04, 3, 4);
                const chip = fbm(x * 0.11, y * 0.11, 9, 3);
                const base = 210 + n * 28 - chip * 18;
                const shade = mortar ? 168 : base;
                const i = (y * size + x) * 4;
                img.data[i] = shade + 8;
                img.data[i + 1] = shade;
                img.data[i + 2] = shade - 10;
                img.data[i + 3] = 255;
                rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = mortar ? 210 : 150 + n * 40;
                rimg.data[i + 3] = 255;
                height[y * size + x] = mortar ? 0.15 : 0.55 + n * 0.35 - chip * 0.2;
            }
        }
        ctx.putImageData(img, 0, 0);
        rctx.putImageData(rimg, 0, 0);
        return {
            map: toTexture(el, { repeat, aniso: 8 }),
            normalMap: toTexture(heightToNormal(height, size, 5.5), { repeat, srgb: false, normal: true }),
            roughnessMap: toTexture(rEl, { repeat, srgb: false })
        };
    });
}

/** Telha cónica azul — losangos empilhados, o azul da silhueta clássica. */
export function roofTiles({ size = 512, repeat = [3, 5] } = {}) {
    return cached(`roof:${size}`, () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        const height = new Float32Array(size * size);
        const tw = 22;
        const th = 16;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const row = (y / th) | 0;
                const ox = row % 2 ? tw * 0.5 : 0;
                const lx = ((x + ox) % tw) / tw;
                const ly = (y % th) / th;
                const edge = Math.min(lx, 1 - lx, ly);
                const n = fbm(x * 0.05, y * 0.07, 11, 3);
                const ridge = edge < 0.08 ? 1 : 0;
        const b = 110 + n * 36 + (1 - ly) * 22;
        const g = 92 + n * 20;
        const r = 38 + n * 14;
                const i = (y * size + x) * 4;
                img.data[i] = ridge ? r + 18 : r;
                img.data[i + 1] = ridge ? g + 10 : g;
                img.data[i + 2] = ridge ? b + 30 : b;
                img.data[i + 3] = 255;
                height[y * size + x] = ridge ? 0.85 : 0.4 + (1 - ly) * 0.25 + n * 0.1;
            }
        }
        ctx.putImageData(img, 0, 0);
        return {
            map: toTexture(el, { repeat }),
            normalMap: toTexture(heightToNormal(height, size, 6.2), { repeat, srgb: false, normal: true })
        };
    });
}

/** Normal tiling de ondas — usado pelo Water do three.js. */
export function waterNormals(size = 512) {
    return cached(`waterN:${size}`, () => {
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = x / size;
                const v = y / size;
                const h = Math.sin(u * Math.PI * 8) * 0.35
                    + Math.sin(v * Math.PI * 6 + u * 4) * 0.28
                    + fbm(u * 6, v * 6, 21, 4) * 0.7;
                height[y * size + x] = h;
            }
        }
        const tex = toTexture(heightToNormal(height, size, 3.4), {
            repeat: [4, 4],
            srgb: false,
            normal: true,
            aniso: 4
        });
        return tex;
    });
}

export function moonTexture(size = 512) {
    return cached('moon', () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.018, y * 0.018, 4, 5);
                const crater = fbm(x * 0.06, y * 0.06, 17, 3);
                const v = 210 + n * 28 - crater * crater * 50;
                const i = (y * size + x) * 4;
                img.data[i] = v;
                img.data[i + 1] = v - 4;
                img.data[i + 2] = v - 14;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [1, 1], aniso: 4 });
    });
}

export function flagTexture(a = '#1e3a8a', b = '#f4d06f') {
    return cached(`flag:${a}:${b}`, () => {
        const el = canvas(256, 160);
        const ctx = el.getContext('2d');
        ctx.fillStyle = a;
        ctx.fillRect(0, 0, 256, 160);
        ctx.fillStyle = b;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(256, 80);
        ctx.lineTo(0, 160);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,240,200,0.35)';
        ctx.lineWidth = 6;
        ctx.strokeRect(8, 8, 240, 144);
        const tex = toTexture(el, { repeat: [1, 1] });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}

export function clockTexture(size = 256) {
    return cached('clock', () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const r = size * 0.46;
        ctx.fillStyle = '#f3ead2';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = size * 0.04;
        ctx.stroke();
        ctx.fillStyle = '#3a2a12';
        ctx.font = `700 ${size * 0.09}px Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            ctx.fillText(romans[i], cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72);
        }
        ctx.strokeStyle = '#2a1a0a';
        ctx.lineWidth = size * 0.035;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + r * 0.18, cy + r * 0.05);
        ctx.stroke();
        ctx.lineWidth = size * 0.022;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - r * 0.08, cy - r * 0.42);
        ctx.stroke();
        ctx.fillStyle = '#c9a227';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.03, 0, Math.PI * 2);
        ctx.fill();
        const tex = toTexture(el, { repeat: [1, 1] });
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}

export function barkTexture() {
    return cached('bark', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.08, y * 0.02, 8, 4);
                const v = 28 + n * 22;
                const i = (y * size + x) * 4;
                img.data[i] = v + 8;
                img.data[i + 1] = v;
                img.data[i + 2] = v - 6;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [1, 3] });
    });
}

export function grassNight() {
    return cached('grassN', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.09, y * 0.09, 2, 4);
                const i = (y * size + x) * 4;
                img.data[i] = 18 + n * 16;
                img.data[i + 1] = 28 + n * 22;
                img.data[i + 2] = 22 + n * 10;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return toTexture(el, { repeat: [18, 18] });
    });
}

export function goldOrnament() {
    return cached('gold', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const g = ctx.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#fff1b8');
        g.addColorStop(0.4, '#d4af37');
        g.addColorStop(1, '#8a5a12');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        return toTexture(el, { repeat: [2, 2] });
    });
}
