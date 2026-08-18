/**
 * Mapas PBR procedurais — albedo, normal e roughness, sem arquivos externos.
 */

import * as THREE from 'three';

const cache = new Map();

function canvas(w, h = w) {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    return el;
}

function ctx2d(el) {
    return el.getContext('2d', { willReadFrequently: true });
}

function rng(seed = 1) {
    let s = seed >>> 0;
    return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

function toTex(el, { repeat = [1, 1], srgb = true, aniso = 8, wrap = true } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = aniso;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.needsUpdate = true;
    return tex;
}

function heightToNormal(srcCtx, w, h, strength = 2.2) {
    const src = srcCtx.getImageData(0, 0, w, h).data;
    const out = canvas(w, h);
    const ctx = ctx2d(out);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    const lum = (x, y) => {
        const i = (((y + h) % h) * w + ((x + w) % w)) * 4;
        return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
    };
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = (lum(x + 1, y) - lum(x - 1, y)) * strength;
            const dy = (lum(x, y + 1) - lum(x, y - 1)) * strength;
            const len = Math.hypot(dx, dy, 1) || 1;
            const i = (y * w + x) * 4;
            d[i] = ((-dx / len) * 0.5 + 0.5) * 255;
            d[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
            d[i + 2] = (1 / len) * 0.5 * 255 + 128;
            d[i + 3] = 255;
        }
    }
    ctx.putImageData(img, 0, 0);
    return out;
}

function roughnessFrom(srcCtx, w, h, base = 0.78, contrast = 0.22) {
    const src = srcCtx.getImageData(0, 0, w, h).data;
    const out = canvas(w, h);
    const ctx = ctx2d(out);
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < src.length; i += 4) {
        const v = (src[i] + src[i + 1] + src[i + 2]) / (3 * 255);
        const r = Math.max(0, Math.min(1, base + (v - 0.5) * contrast));
        d[i] = d[i + 1] = d[i + 2] = r * 255;
        d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return out;
}

function pack(key, w, h, draw, opts = {}) {
    if (cache.has(key)) return cache.get(key);
    const {
        strength = 2.1, roughBase = 0.8, roughContrast = 0.2,
        aniso = 8, repeat = [1, 1], wrap = true
    } = opts;
    const el = canvas(w, h);
    const ctx = ctx2d(el);
    draw(ctx, w, h);
    const map = toTex(el, { repeat, srgb: true, aniso, wrap });
    const nEl = heightToNormal(ctx, w, h, strength);
    const normalMap = toTex(nEl, { repeat, srgb: false, aniso, wrap });
    const rEl = roughnessFrom(ctx, w, h, roughBase, roughContrast);
    const roughnessMap = toTex(rEl, { repeat, srgb: false, aniso, wrap });
    const set = { map, normalMap, roughnessMap };
    cache.set(key, set);
    return set;
}

function hexTo(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp255(v) {
    return Math.max(0, Math.min(255, v));
}

function saturate(v) {
    return Math.max(0, Math.min(1, v));
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function woodMaps(aniso = 8) {
    return pack('wood', 512, 512, (ctx, w, h) => {
        const rnd = rng(42);
        ctx.fillStyle = '#8a5a32';
        ctx.fillRect(0, 0, w, h);
        const plank = 64;
        for (let y = 0; y < h; y += plank) {
            const hue = 28 + rnd() * 8;
            ctx.fillStyle = `hsl(${hue} 42% ${38 + rnd() * 10}%)`;
            ctx.fillRect(0, y, w, plank - 1);
            for (let i = 0; i < 18; i++) {
                ctx.strokeStyle = `rgba(40, 20, 10, ${0.06 + rnd() * 0.1})`;
                ctx.lineWidth = 1 + rnd() * 1.4;
                ctx.beginPath();
                const yy = y + rnd() * plank;
                ctx.moveTo(0, yy);
                ctx.bezierCurveTo(w * 0.3, yy + (rnd() - 0.5) * 8, w * 0.7, yy + (rnd() - 0.5) * 8, w, yy);
                ctx.stroke();
            }
            ctx.fillStyle = 'rgba(30, 16, 8, 0.35)';
            ctx.fillRect(0, y + plank - 2, w, 2);
        }
    }, { strength: 1.6, roughBase: 0.72, roughContrast: 0.18, aniso, repeat: [4, 4] });
}

export function plasterMaps(aniso = 8) {
    return pack('plaster', 256, 256, (ctx, w, h) => {
        const rnd = rng(9);
        ctx.fillStyle = '#e8d8c4';
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 1800; i++) {
            ctx.fillStyle = `rgba(255, 244, 228, ${0.04 + rnd() * 0.08})`;
            ctx.fillRect(rnd() * w, rnd() * h, 2, 2);
        }
        ctx.fillStyle = 'rgba(180, 140, 110, 0.08)';
        ctx.fillRect(0, 0, 8, h);
    }, { strength: 0.7, roughBase: 0.9, roughContrast: 0.08, aniso, repeat: [2, 2] });
}

export function fabricMaps(aniso = 8) {
    return pack('fabric', 256, 256, (ctx, w, h) => {
        const rnd = rng(21);
        ctx.fillStyle = '#6a3a28';
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 4) {
            ctx.fillStyle = y % 8 === 0 ? 'rgba(255,220,180,0.07)' : 'rgba(20,8,4,0.08)';
            ctx.fillRect(0, y, w, 2);
        }
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = `rgba(240, 200, 160, ${rnd() * 0.12})`;
            ctx.fillRect(rnd() * w, rnd() * h, 3, 3);
        }
    }, { strength: 1.4, roughBase: 0.86, roughContrast: 0.12, aniso, repeat: [3, 3] });
}

export function rugMaps(aniso = 8) {
    return pack('rug', 512, 512, (ctx, w, h) => {
        const rnd = rng(77);
        const g = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, w * 0.5);
        g.addColorStop(0, '#c45a3a');
        g.addColorStop(0.45, '#8a3028');
        g.addColorStop(1, '#5a2018');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(240, 200, 140, 0.35)';
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w * 0.42, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w * 0.28, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 24; i++) {
            const a = (i / 24) * Math.PI * 2;
            ctx.strokeStyle = `rgba(240, 210, 160, ${0.12 + rnd() * 0.12})`;
            ctx.beginPath();
            ctx.moveTo(w / 2, h / 2);
            ctx.lineTo(w / 2 + Math.cos(a) * w * 0.48, h / 2 + Math.sin(a) * h * 0.48);
            ctx.stroke();
        }
    }, { strength: 1.8, roughBase: 0.92, roughContrast: 0.1, aniso, wrap: false });
}

export function cushionMaps(aniso = 8) {
    return pack('cushion', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#d8b070';
        ctx.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 6) {
            ctx.fillStyle = 'rgba(90, 50, 20, 0.08)';
            ctx.fillRect(0, y, w, 2);
        }
        ctx.strokeStyle = 'rgba(255, 240, 210, 0.25)';
        ctx.lineWidth = 8;
        ctx.strokeRect(16, 16, w - 32, h - 32);
    }, { strength: 1.2, roughBase: 0.88, aniso, wrap: false });
}

function furPattern(u, v, pattern) {
    if (pattern === 'tabby') {
        return Math.sin(u * 28 + Math.sin(v * 10) * 1.4) * 0.5 + 0.5;
    }
    if (pattern === 'spots') {
        const gx = Math.floor(u * 9);
        const gy = Math.floor(v * 7);
        const r = rng(gx * 13 + gy * 29)();
        const dx = u * 9 - gx - 0.5;
        const dy = v * 7 - gy - 0.5;
        return r > 0.55 && dx * dx + dy * dy < 0.12 ? 1 : 0;
    }
    if (pattern === 'patches') {
        const n = Math.sin(u * 7.1 + 2) * Math.cos(v * 5.3) + Math.sin(u * 3.7 + v * 4.2);
        if (n > 0.45) return 1;
        if (n < -0.35) return 0.35;
        return 0;
    }
    if (pattern === 'bicolor') {
        return v < 0.42 || (u > 0.35 && u < 0.65 && v < 0.62) ? 0 : 1;
    }
    if (pattern === 'mask') {
        const face = Math.hypot(u - 0.5, v - 0.55);
        return face < 0.22 || v > 0.78 ? 0 : 1;
    }
    if (pattern === 'colorpoint') {
        const edge = Math.min(u, 1 - u, v, 1 - v);
        return edge < 0.18 || v < 0.16 || v > 0.86 ? 1 : 0;
    }
    if (pattern === 'poodle') {
        return (Math.sin(u * 40) * Math.sin(v * 40) > 0.15) ? 1 : 0.4;
    }
    return 0.08;
}

export function furMaps(primary, secondary, belly, pattern = 'solid', aniso = 8) {
    const key = `fur:${primary}:${secondary}:${pattern}`;
    return pack(key, 256, 256, (ctx, w, h) => {
        const rnd = rng(primary.length * 17 + pattern.length * 9);
        const img = ctx.createImageData(w, h);
        const d = img.data;
        const p = hexTo(primary);
        const s = hexTo(secondary);
        const b = hexTo(belly);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const u = x / w;
                const v = y / h;
                const stroke = 0.55 + 0.45 * Math.sin((x * 0.9 + y * 2.4) * 0.35);
                const grain = rnd();
                const pat = furPattern(u, v, pattern);
                const bellyMix = saturate((v - 0.55) * 2.4);
                let r = p[0];
                let g = p[1];
                let bl = p[2];
                r = lerp(r, s[0], pat * 0.85);
                g = lerp(g, s[1], pat * 0.85);
                bl = lerp(bl, s[2], pat * 0.85);
                r = lerp(r, b[0], bellyMix * 0.7);
                g = lerp(g, b[1], bellyMix * 0.7);
                bl = lerp(bl, b[2], bellyMix * 0.7);
                const shade = 0.78 + stroke * 0.18 + grain * 0.08;
                const i = (y * w + x) * 4;
                d[i] = clamp255(r * shade);
                d[i + 1] = clamp255(g * shade);
                d[i + 2] = clamp255(bl * shade);
                d[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    }, { strength: 2.6, roughBase: 0.78, roughContrast: 0.16, aniso, wrap: true });
}

export function skyTexture() {
    const el = canvas(8, 256);
    const ctx = ctx2d(el);
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#7eb4e8');
    g.addColorStop(0.45, '#c8dcf0');
    g.addColorStop(0.72, '#f0d8b8');
    g.addColorStop(1, '#e8b888');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 8, 256);
    return toTex(el, { wrap: false, aniso: 1, repeat: [1, 1] });
}

export function leafMaps(aniso = 4) {
    return pack('leaf', 128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#2f7a3a';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(20, 60, 24, 0.4)';
        ctx.beginPath();
        ctx.moveTo(w / 2, 4);
        ctx.lineTo(w / 2, h - 4);
        ctx.stroke();
        ctx.fillStyle = 'rgba(180, 220, 120, 0.18)';
        ctx.fillRect(8, 8, w * 0.4, h * 0.4);
    }, { strength: 1.1, roughBase: 0.7, aniso });
}
