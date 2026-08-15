/**
 * Texturas PBR procedurais — calcário, telha azul, água, lua e bandeira para Babylon.js.
 * Sem arquivos externos: o lab gera albedo, normal e roughness em canvas.
 */

import { fbm } from './utils.js';

function canvas(size, height = size) {
    const el = document.createElement('canvas');
    el.width = size;
    el.height = height;
    return el;
}

function toBabylonTexture(el, scene, { uScale = 1, vScale = 1 } = {}) {
    const BABYLON = window.BABYLON;
    if (!BABYLON) return null;
    const url = el.toDataURL('image/png');
    const tex = new BABYLON.Texture(url, scene, false, false);
    tex.uScale = uScale;
    tex.vScale = vScale;
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    return tex;
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

export function limestone(scene, { size = 512, repeat = [6, 8] } = {}) {
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
        map: toBabylonTexture(el, scene, { uScale: repeat[0], vScale: repeat[1] }),
        normalMap: toBabylonTexture(heightToNormal(height, size, 5.5), scene, { uScale: repeat[0], vScale: repeat[1] }),
        roughnessMap: toBabylonTexture(rEl, scene, { uScale: repeat[0], vScale: repeat[1] })
    };
}

export function roofTiles(scene, { size = 512, repeat = [6, 12] } = {}) {
    const el = canvas(size);
    const rEl = canvas(size);
    const ctx = el.getContext('2d');
    const rctx = rEl.getContext('2d');
    const img = ctx.createImageData(size, size);
    const rimg = rctx.createImageData(size, size);
    const height = new Float32Array(size * size);
    const sw = 20;
    const sh = 24;
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const row = (y / sh) | 0;
            const ox = row % 2 === 0 ? 0 : sw * 0.5;
            const lx = ((x + ox) % sw) / sw;
            const ly = (y % sh) / sh;
            const center = Math.abs(lx - 0.5) * 2;
            const round = Math.sqrt(Math.max(0, 1 - center * center));
            const overlap = ly > 0.7 ? 1 - (ly - 0.7) / 0.3 : ly / 0.7;
            const h = round * overlap;
            const n = fbm(x * 0.05, y * 0.05, 2, 2) * 0.15;
            const base = 90 + h * 90 + n * 40;
            const i = (y * size + x) * 4;
            img.data[i] = Math.min(255, base * 0.65);
            img.data[i + 1] = Math.min(255, base * 0.85);
            img.data[i + 2] = Math.min(255, base * 1.35 + 30);
            img.data[i + 3] = 255;
            rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = 110 + (1 - h) * 90;
            rimg.data[i + 3] = 255;
            height[y * size + x] = h * 0.8 + n;
        }
    }
    ctx.putImageData(img, 0, 0);
    rctx.putImageData(rimg, 0, 0);
    return {
        map: toBabylonTexture(el, scene, { uScale: repeat[0], vScale: repeat[1] }),
        normalMap: toBabylonTexture(heightToNormal(height, size, 4.0), scene, { uScale: repeat[0], vScale: repeat[1] }),
        roughnessMap: toBabylonTexture(rEl, scene, { uScale: repeat[0], vScale: repeat[1] })
    };
}

export function goldOrnament(scene, size = 256) {
    const el = canvas(size);
    const ctx = el.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, '#f9e27c');
    g.addColorStop(0.5, '#e0b432');
    g.addColorStop(1, '#a67812');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return toBabylonTexture(el, scene);
}

export function moonTexture(scene, size = 512) {
    const el = canvas(size);
    const ctx = el.getContext('2d');
    const g = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.1, size * 0.5, size * 0.5, size * 0.5);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.8, '#f5efe0');
    g.addColorStop(1, '#ded5c0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Crateras
    const rand = (seed) => {
        let s = seed;
        return () => (s = (s * 9301 + 49297) % 233280) / 233280;
    };
    const r = rand(42);
    for (let i = 0; i < 45; i++) {
        const cx = r() * size;
        const cy = r() * size;
        const rad = 6 + r() * 24;
        ctx.fillStyle = 'rgba(160,150,140,0.18)';
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
    }
    return toBabylonTexture(el, scene);
}
