/**
 * Texturas procedurais (canvas 2D) que não existem no acervo PBR do kit:
 * disco da lua, vitrais, rosácea, treliça de chumbo das janelas, estandarte e
 * o mapa de normais em mosaico da água.
 *
 * Tudo é gerado uma vez e cacheado por chave.
 */

import * as THREE from 'three';
import { seeded, fbm2 } from '../../shared/gfx/core.js';

const cache = new Map();
const cached = (key, make) => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
};

function canvas(w, h = w) {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    return { el, ctx: el.getContext('2d') };
}

function toTexture(el, { srgb = true, repeat = false } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

/**
 * Disco lunar: mares (manchas escuras de fbm), crateras com borda clara e raios.
 * O escurecimento de limbo e a máscara circular ficam no shader do céu.
 */
export function moonTexture(size = 512) {
    return cached(`moon${size}`, () => {
        const { el, ctx } = canvas(size);
        const img = ctx.createImageData(size, size);
        const d = img.data;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = x / size;
                const v = y / size;
                const maria = fbm2(u * 3.2 + 4.1, v * 3.2 + 1.7, 4);
                const fine = fbm2(u * 17 + 2, v * 17 + 9, 3);
                // mares: onde o ruído grosso passa de 0,52 o albedo cai para ~55 %
                const sea = THREE.MathUtils.smoothstep(maria, 0.5, 0.64);
                const l = (0.86 - sea * 0.36) * (0.9 + fine * 0.2);
                const o = (y * size + x) * 4;
                d[o] = l * 255;
                d[o + 1] = l * 250;
                d[o + 2] = l * 238;
                d[o + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        const rnd = seeded(77);
        for (let i = 0; i < 90; i++) {
            const cx = rnd() * size;
            const cy = rnd() * size;
            const r = (0.006 + Math.pow(rnd(), 3) * 0.05) * size;
            const g = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
            g.addColorStop(0, 'rgba(60,60,62,0.34)');
            g.addColorStop(0.72, 'rgba(70,70,72,0.22)');
            g.addColorStop(0.86, 'rgba(255,255,250,0.32)');
            g.addColorStop(1, 'rgba(255,255,250,0)');
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
        }
        // duas crateras raiadas
        for (const [cx, cy] of [[0.36, 0.7], [0.66, 0.3]]) {
            ctx.save();
            ctx.translate(cx * size, cy * size);
            for (let i = 0; i < 26; i++) {
                ctx.rotate(rnd() * Math.PI * 2);
                const len = (0.08 + rnd() * 0.2) * size;
                const g = ctx.createLinearGradient(0, 0, len, 0);
                g.addColorStop(0, 'rgba(255,255,250,0.2)');
                g.addColorStop(1, 'rgba(255,255,250,0)');
                ctx.fillStyle = g;
                ctx.fillRect(0, -1.2, len, 2.4);
            }
            ctx.restore();
        }
        const tex = toTexture(el);
        tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
        return tex;
    });
}

/**
 * Atlas das janelas (512×512), dividido em 4 quadrantes de UV:
 *   (0,0)–(½,½)  treliça de chumbo em losangos sobre vidro âmbar
 *   (½,0)–(1,½)  vitral de lanceta (painéis coloridos + medalhão)
 *   (0,½)–(½,1)  rosácea (pétalas radiais)
 *   (½,½)–(1,1)  janela pequena de casa (cruzeta de madeira)
 * No canvas o eixo Y cresce para baixo; a UV v = 0 é a base da textura.
 */
export function glassAtlas() {
    return cached('glassAtlas', () => {
        const S = 512;
        const H = S / 2;
        const { el, ctx } = canvas(S);
        const rnd = seeded(4242);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, S, S);

        // --- treliça âmbar (canvas: x 0..H, y H..S → uv v 0..½) ---
        ctx.save();
        ctx.translate(0, H);
        let g = ctx.createLinearGradient(0, H, 0, 0);
        g.addColorStop(0, '#ffb04a');
        g.addColorStop(0.55, '#ffd58a');
        g.addColorStop(1, '#ffe9bd');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, H, H);
        // variação de vidro soprado
        for (let i = 0; i < 160; i++) {
            ctx.fillStyle = `rgba(${200 + rnd() * 55 | 0},${120 + rnd() * 70 | 0},40,${0.05 + rnd() * 0.1})`;
            ctx.fillRect(rnd() * H, rnd() * H, 10 + rnd() * 26, 10 + rnd() * 26);
        }
        ctx.strokeStyle = 'rgba(38,24,12,0.9)';
        ctx.lineWidth = 3;
        const step = 32;
        for (let i = -H; i < H * 2; i += step) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + H, H);
            ctx.moveTo(i + H, 0);
            ctx.lineTo(i, H);
            ctx.stroke();
        }
        ctx.lineWidth = 9;
        ctx.strokeRect(0, 0, H, H);
        ctx.beginPath();
        ctx.moveTo(H / 2, 0);
        ctx.lineTo(H / 2, H);
        ctx.stroke();
        ctx.restore();

        // --- vitral (canvas: x H..S, y H..S) ---
        ctx.save();
        ctx.translate(H, H);
        const hues = [8, 28, 46, 205, 222, 268, 140, 352];
        const cols = 6;
        const rows = 12;
        const cw = H / cols;
        const ch = H / rows;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const hue = hues[(rnd() * hues.length) | 0];
                const light = 42 + rnd() * 26;
                ctx.fillStyle = `hsl(${hue} 86% ${light}%)`;
                ctx.beginPath();
                const ox = c * cw;
                const oy = r * ch;
                const j = () => (rnd() - 0.5) * 6;
                ctx.moveTo(ox + j(), oy + j());
                ctx.lineTo(ox + cw + j(), oy + j());
                ctx.lineTo(ox + cw + j(), oy + ch + j());
                ctx.lineTo(ox + j(), oy + ch + j());
                ctx.closePath();
                ctx.fill();
                ctx.lineWidth = 2.6;
                ctx.strokeStyle = 'rgba(14,10,8,0.95)';
                ctx.stroke();
            }
        }
        // medalhão com a estrela de oito pontas
        const mx = H / 2;
        const my = H * 0.42;
        g = ctx.createRadialGradient(mx, my, 4, mx, my, 62);
        g.addColorStop(0, '#fff6cf');
        g.addColorStop(0.6, '#ffc94a');
        g.addColorStop(1, '#2a3f9c');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(mx, my, 62, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(14,10,8,0.95)';
        ctx.stroke();
        ctx.fillStyle = '#fffdf0';
        star(ctx, mx, my, 46, 18, 8);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 8;
        ctx.strokeRect(0, 0, H, H);
        ctx.restore();

        // --- rosácea (canvas: x 0..H, y 0..H → uv v ½..1) ---
        ctx.save();
        ctx.translate(H / 2, H / 2);
        const R = H / 2 - 4;
        ctx.fillStyle = '#120c0a';
        ctx.fillRect(-H / 2, -H / 2, H, H);
        const petals = 12;
        for (let ring = 0; ring < 3; ring++) {
            const r0 = R * [0.2, 0.46, 0.74][ring];
            const r1 = R * [0.44, 0.72, 0.98][ring];
            const n = petals * (ring === 2 ? 2 : 1);
            for (let i = 0; i < n; i++) {
                const a0 = (i / n) * Math.PI * 2;
                const a1 = ((i + 1) / n) * Math.PI * 2;
                const hue = [[44, 20, 352], [212, 268, 196], [352, 44, 212, 140]][ring];
                ctx.fillStyle = `hsl(${hue[i % hue.length]} 88% ${46 + (i % 3) * 8}%)`;
                ctx.beginPath();
                ctx.arc(0, 0, r1, a0 + 0.035, a1 - 0.035);
                ctx.arc(0, 0, r0, a1 - 0.05, a0 + 0.05, true);
                ctx.closePath();
                ctx.fill();
            }
        }
        g = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 0.2);
        g.addColorStop(0, '#fffbe0');
        g.addColorStop(1, '#ffc23d');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- janela de casa (canvas: x H..S, y 0..H) ---
        ctx.save();
        ctx.translate(H, 0);
        g = ctx.createRadialGradient(H / 2, H * 0.55, 10, H / 2, H / 2, H * 0.75);
        g.addColorStop(0, '#ffe2a0');
        g.addColorStop(1, '#f08a2c');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, H, H);
        ctx.fillStyle = '#1c120b';
        ctx.fillRect(H / 2 - 9, 0, 18, H);
        ctx.fillRect(0, H / 2 - 9, H, 18);
        ctx.lineWidth = 22;
        ctx.strokeStyle = '#1c120b';
        ctx.strokeRect(0, 0, H, H);
        ctx.restore();

        return toTexture(el);
    });
}

function star(ctx, cx, cy, r1, r0, points) {
    ctx.beginPath();
    for (let i = 0; i < points * 2; i++) {
        const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? r0 : r1;
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
    }
    ctx.closePath();
}

/**
 * Estandarte: campo azul-noite com orla dourada e a estrela de oito pontas.
 * u = 0 fica no mastro; a ponta em cauda de andorinha é recortada por alfa.
 */
export function bannerTexture() {
    return cached('banner', () => {
        const W = 256;
        const Hh = 128;
        const { el, ctx } = canvas(W, Hh);
        ctx.clearRect(0, 0, W, Hh);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(W, 0);
        ctx.lineTo(W * 0.78, Hh / 2);
        ctx.lineTo(W, Hh);
        ctx.lineTo(0, Hh);
        ctx.closePath();
        ctx.save();
        ctx.clip();
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, '#1b2a6b');
        g.addColorStop(1, '#27408f');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, Hh);
        ctx.fillStyle = '#d9a93a';
        ctx.fillRect(0, 0, W, 9);
        ctx.fillRect(0, Hh - 9, W, 9);
        ctx.fillRect(0, 0, 12, Hh);
        ctx.fillStyle = '#f3d67a';
        star(ctx, W * 0.36, Hh / 2, 36, 14, 8);
        ctx.fill();
        // trama do tecido
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = '#000';
        for (let x = 0; x < W; x += 3) ctx.fillRect(x, 0, 1, Hh);
        for (let y = 0; y < Hh; y += 3) ctx.fillRect(0, y, W, 1);
        ctx.restore();
        return toTexture(el);
    });
}

/**
 * Mapa de normais da água em mosaico (RG = inclinação, B = altura), a partir de
 * fbm periódico:  n = normalize(−∂h/∂x · k, −∂h/∂y · k, 1).
 */
export function waterNormalTexture(size = 256) {
    return cached(`waterN${size}`, () => {
        const h = new Float32Array(size * size);
        const P = 8;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const u = (x / size) * P;
                const v = (y / size) * P;
                const a = fbm2(u, v, 4, P, 3);
                const b = fbm2(u * 2 + 5.2, v * 2 + 1.3, 3, P * 2, 9);
                h[y * size + x] = a * 0.7 + Math.abs(b - 0.5) * 0.6;
            }
        }
        const data = new Uint8Array(size * size * 4);
        const k = 5.5;
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const xl = h[y * size + ((x + size - 1) % size)];
                const xr = h[y * size + ((x + 1) % size)];
                const yu = h[((y + size - 1) % size) * size + x];
                const yd = h[((y + 1) % size) * size + x];
                let nx = (xl - xr) * k;
                let ny = (yu - yd) * k;
                const inv = 1 / Math.hypot(nx, ny, 1);
                nx *= inv;
                ny *= inv;
                const o = (y * size + x) * 4;
                data[o] = (nx * 0.5 + 0.5) * 255;
                data[o + 1] = (ny * 0.5 + 0.5) * 255;
                data[o + 2] = inv * 255;
                data[o + 3] = Math.min(255, h[y * size + x] * 255);
            }
        }
        const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.magFilter = THREE.LinearFilter;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        tex.anisotropy = 8;
        tex.needsUpdate = true;
        return tex;
    });
}
