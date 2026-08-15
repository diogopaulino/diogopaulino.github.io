/**
 * Castelo Estelar — Texturas PBR procedurais em Babylon.js.
 * Gera mapas de Albedo, Normal (bump), Rugosidade e Emissão diretamente em Canvas 2D.
 */

import { fbm, hash2 } from './utils.js';

const canvasCache = new Map();

function canvas(width, height = width) {
    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    return el;
}

function cachedCanvas(key, factory) {
    if (!canvasCache.has(key)) {
        canvasCache.set(key, factory());
    }
    return canvasCache.get(key);
}

function createDynamicTexture(scene, canvasEl, { uScale = 1, vScale = 1, hasAlpha = false } = {}) {
    const B = window.BABYLON;
    const dt = new B.DynamicTexture(`dt_${Math.random()}`, canvasEl, scene, true);
    dt.uScale = uScale;
    dt.vScale = vScale;
    dt.wrapU = B.Texture.WRAP_ADDRESSMODE;
    dt.wrapV = B.Texture.WRAP_ADDRESSMODE;
    dt.hasAlpha = hasAlpha;
    dt.update(false);
    return dt;
}

function heightToNormal(height, size, strength = 4.5) {
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
            d[i] = Math.floor((0.5 - dx * inv * 0.5) * 255);
            d[i + 1] = Math.floor((0.5 - dy * inv * 0.5) * 255);
            d[i + 2] = Math.floor((0.5 + inv * 0.5) * 255);
            d[i + 3] = 255;
        }
    }
    nctx.putImageData(img, 0, 0);
    return nEl;
}

/**
 * Calcário de cantaria (Ashlar Limestone)
 * Albedo creme quente, mapas normais com relevo de blocos e argamassa.
 */
export function getLimestoneTextures(scene, { uScale = 4, vScale = 6 } = {}) {
    const size = 512;
    const albedoEl = cachedCanvas('limestone_albedo', () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        const bw = 32;
        const bh = 16;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const row = Math.floor(y / bh);
                const ox = row % 2 === 0 ? 0 : bw * 0.5;
                const col = Math.floor((x + ox) / bw);
                const lx = ((x + ox) % bw) / bw;
                const ly = (y % bh) / bh;
                const mortar = lx < 0.07 || ly < 0.12;

                const blockHash = hash2(col * 17.1, row * 23.3);
                const blockTint = (blockHash - 0.5) * 18;

                const n = fbm(x * 0.035, y * 0.035, 3, 4);
                const chip = fbm(x * 0.12, y * 0.12, 9, 3);
                const base = mortar ? 160 : (220 + blockTint + n * 24 - chip * 16);

                const i = (y * size + x) * 4;
                img.data[i] = Math.min(255, base + 12);
                img.data[i + 1] = Math.min(255, base + 4);
                img.data[i + 2] = Math.max(0, base - 8);
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return el;
    });

    const normalEl = cachedCanvas('limestone_normal', () => {
        const height = new Float32Array(size * size);
        const bw = 32;
        const bh = 16;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const row = Math.floor(y / bh);
                const ox = row % 2 === 0 ? 0 : bw * 0.5;
                const lx = ((x + ox) % bw) / bw;
                const ly = (y % bh) / bh;
                const mortar = lx < 0.07 || ly < 0.12;
                const bevel = Math.min(lx, 1 - lx, ly, 1 - ly) * 10;
                const n = fbm(x * 0.035, y * 0.035, 3, 4);
                const chip = fbm(x * 0.12, y * 0.12, 9, 3);
                height[y * size + x] = mortar ? 0.15 : (0.6 + Math.min(0.3, bevel) + n * 0.2 - chip * 0.15);
            }
        }
        return heightToNormal(height, size, 5.2);
    });

    return {
        albedo: createDynamicTexture(scene, albedoEl, { uScale, vScale }),
        bump: createDynamicTexture(scene, normalEl, { uScale, vScale })
    };
}

/**
 * Telhas de ardósia azul das torres (Roof Tiles)
 */
export function getRoofTextures(scene, { uScale = 3, vScale = 6 } = {}) {
    const size = 512;
    const albedoEl = cachedCanvas('roof_albedo', () => {
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        const tw = 24;
        const th = 18;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const row = Math.floor(y / th);
                const ox = row % 2 ? tw * 0.5 : 0;
                const lx = ((x + ox) % tw) / tw;
                const ly = (y % th) / th;
                const edge = Math.min(lx, 1 - lx, ly);
                const n = fbm(x * 0.05, y * 0.07, 11, 3);
                const ridge = edge < 0.09;

                const tileHash = hash2(Math.floor((x + ox) / tw) * 11.3, row * 29.7);
                const tileVar = (tileHash - 0.5) * 20;

                const b = 135 + n * 30 + (1 - ly) * 28 + tileVar;
                const g = 100 + n * 18 + tileVar * 0.6;
                const r = 46 + n * 12 + tileVar * 0.3;

                const i = (y * size + x) * 4;
                img.data[i] = Math.min(255, ridge ? r + 22 : r);
                img.data[i + 1] = Math.min(255, ridge ? g + 14 : g);
                img.data[i + 2] = Math.min(255, ridge ? b + 36 : b);
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return el;
    });

    const normalEl = cachedCanvas('roof_normal', () => {
        const height = new Float32Array(size * size);
        const tw = 24;
        const th = 18;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const row = Math.floor(y / th);
                const ox = row % 2 ? tw * 0.5 : 0;
                const lx = ((x + ox) % tw) / tw;
                const ly = (y % th) / th;
                const edge = Math.min(lx, 1 - lx, ly);
                const n = fbm(x * 0.05, y * 0.07, 11, 3);
                const ridge = edge < 0.09;
                height[y * size + x] = ridge ? 0.9 : (0.42 + (1 - ly) * 0.38 + n * 0.12);
            }
        }
        return heightToNormal(height, size, 6.0);
    });

    return {
        albedo: createDynamicTexture(scene, albedoEl, { uScale, vScale }),
        bump: createDynamicTexture(scene, normalEl, { uScale, vScale })
    };
}

/**
 * Mostrador de relógio clássico com algarismos romanos
 */
export function getClockTexture(scene) {
    const el = cachedCanvas('clock_texture', () => {
        const size = 512;
        const c = canvas(size);
        const ctx = c.getContext('2d');
        const cx = size / 2;
        const cy = size / 2;
        const r = size * 0.46;

        // Fundo pérola / marfim envelhecido
        ctx.fillStyle = '#f6edd9';
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // Anel externo dourado
        const grad = ctx.createLinearGradient(0, 0, size, size);
        grad.addColorStop(0, '#ffd868');
        grad.addColorStop(0.5, '#c89d2d');
        grad.addColorStop(1, '#7a520e');
        ctx.strokeStyle = grad;
        ctx.lineWidth = size * 0.05;
        ctx.stroke();

        // Anel interno fino
        ctx.strokeStyle = 'rgba(74, 52, 20, 0.4)';
        ctx.lineWidth = size * 0.012;
        ctx.beginPath();
        ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
        ctx.stroke();

        // Algarismos romanos
        ctx.fillStyle = '#2a1a0c';
        ctx.font = `bold ${size * 0.088}px 'Cinzel', Georgia, serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const romans = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
            ctx.fillText(romans[i], cx + Math.cos(a) * r * 0.72, cy + Math.sin(a) * r * 0.72);
        }

        // Ponteiros
        ctx.lineCap = 'round';
        // Hora
        ctx.strokeStyle = '#1a0e05';
        ctx.lineWidth = size * 0.038;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + r * 0.35, cy + r * 0.12);
        ctx.stroke();
        // Minuto
        ctx.lineWidth = size * 0.024;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx - r * 0.12, cy - r * 0.55);
        ctx.stroke();

        // Centro dourado
        ctx.fillStyle = '#e6b83b';
        ctx.beginPath();
        ctx.arc(cx, cy, size * 0.036, 0, Math.PI * 2);
        ctx.fill();

        return c;
    });

    return createDynamicTexture(scene, el);
}

/**
 * Textura da lua com mares e crateras
 */
export function getMoonTexture(scene) {
    const el = cachedCanvas('moon_surface', () => {
        const size = 512;
        const c = canvas(size);
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.02, y * 0.02, 4, 5);
                const crater = fbm(x * 0.07, y * 0.07, 17, 3);
                const v = 215 + n * 26 - crater * crater * 52;
                const i = (y * size + x) * 4;
                img.data[i] = Math.min(255, v + 2);
                img.data[i + 1] = Math.min(255, v);
                img.data[i + 2] = Math.max(0, v - 10);
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return c;
    });

    return createDynamicTexture(scene, el);
}

/**
 * Textura da bandeira heráldica
 */
export function getFlagTexture(scene) {
    const el = cachedCanvas('flag_royal', () => {
        const c = canvas(256, 160);
        const ctx = c.getContext('2d');
        // Fundo azul imperial
        ctx.fillStyle = '#1e3a8a';
        ctx.fillRect(0, 0, 256, 160);

        // Triângulo dourado
        ctx.fillStyle = '#f4d06f';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(256, 80);
        ctx.lineTo(0, 160);
        ctx.closePath();
        ctx.fill();

        // Borda e estrela
        ctx.strokeStyle = '#ffd868';
        ctx.lineWidth = 8;
        ctx.strokeRect(6, 6, 244, 148);

        // Estrela central
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✦', 80, 80);

        return c;
    });

    return createDynamicTexture(scene, el);
}

/**
 * Textura de orla / casca de pinheiro
 */
export function getBarkTexture(scene) {
    const el = cachedCanvas('bark_pine', () => {
        const size = 256;
        const c = canvas(size);
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.08, y * 0.02, 8, 4);
                const v = 32 + n * 24;
                const i = (y * size + x) * 4;
                img.data[i] = Math.min(255, v + 10);
                img.data[i + 1] = Math.min(255, v + 2);
                img.data[i + 2] = Math.max(0, v - 8);
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return c;
    });

    return createDynamicTexture(scene, el, { uScale: 1, vScale: 4 });
}

/**
 * Textura de grama noturna
 */
export function getGrassTexture(scene) {
    const el = cachedCanvas('grass_night', () => {
        const size = 256;
        const c = canvas(size);
        const ctx = c.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n = fbm(x * 0.09, y * 0.09, 2, 4);
                const i = (y * size + x) * 4;
                img.data[i] = Math.min(255, 20 + n * 18);
                img.data[i + 1] = Math.min(255, 34 + n * 24);
                img.data[i + 2] = Math.min(255, 26 + n * 14);
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return c;
    });

    return createDynamicTexture(scene, el, { uScale: 20, vScale: 20 });
}

/**
 * Normal map procedural de ondas do lago para WaterMaterial / PBR
 */
export function getWaterBumpTexture(scene) {
    const el = cachedCanvas('water_bump', () => {
        const size = 512;
        const height = new Float32Array(size * size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = x / size;
                const v = y / size;
                const h = Math.sin(u * Math.PI * 10) * 0.3
                    + Math.sin(v * Math.PI * 8 + u * 5) * 0.28
                    + fbm(u * 8, v * 8, 33, 4) * 0.55;
                height[y * size + x] = h;
            }
        }
        return heightToNormal(height, size, 3.8);
    });

    return createDynamicTexture(scene, el, { uScale: 6, vScale: 6 });
}

