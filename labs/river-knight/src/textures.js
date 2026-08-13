/**
 * Texturas procedurais desenhadas em `<canvas>`.
 *
 * O lab é 100 % autocontido: nada de PNG/JPG externos. Cada textura é gerada
 * uma única vez (cache por chave) e reutilizada por todos os materiais.
 */

import * as THREE from 'three';

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
    tex.needsUpdate = true;
    return tex;
}

function cached(key, factory) {
    if (!cache.has(key)) cache.set(key, factory());
    return cache.get(key);
}

/** Ruído de valor simples e determinístico (para grão e manchas). */
function noise2(x, y, seed = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

function grain(ctx, w, h, amount, seed = 0) {
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const x = p % w;
        const y = (p / w) | 0;
        const n = (noise2(x, y, seed) - 0.5) * amount;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
}

/* ------------------------------------------------------------------ */
/* Madeira do casco                                                    */
/* ------------------------------------------------------------------ */

export function woodTexture(dark = false) {
    return cached(`wood:${dark}`, () => {
        const size = 512;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const base = dark ? '#3a2417' : '#6d472a';
        const light = dark ? '#4c3120' : '#8a5c37';

        ctx.fillStyle = base;
        ctx.fillRect(0, 0, size, size);

        // Tábuas horizontais com veios.
        const planks = 8;
        const ph = size / planks;
        for (let i = 0; i < planks; i++) {
            const y = i * ph;
            const shade = 0.82 + noise2(i, 3.1) * 0.36;
            ctx.fillStyle = light;
            ctx.globalAlpha = 0.35 * shade;
            ctx.fillRect(0, y + 1, size, ph - 2);
            ctx.globalAlpha = 1;

            // Veios longitudinais.
            for (let g = 0; g < 26; g++) {
                const gy = y + 3 + noise2(i * 31 + g, 7.7) * (ph - 6);
                ctx.strokeStyle = `rgba(30, 18, 10, ${0.05 + noise2(g, i) * 0.14})`;
                ctx.lineWidth = 0.6 + noise2(g, i * 2) * 1.4;
                ctx.beginPath();
                ctx.moveTo(0, gy);
                for (let x = 0; x <= size; x += 24) {
                    ctx.lineTo(x, gy + Math.sin((x + i * 40) * 0.02) * 1.6 + (noise2(x, gy) - 0.5) * 1.4);
                }
                ctx.stroke();
            }

            // Sombra entre tábuas.
            ctx.fillStyle = 'rgba(18, 10, 5, 0.55)';
            ctx.fillRect(0, y, size, 2);

            // Rebites de ferro.
            for (let r = 0; r < 10; r++) {
                const rx = (r + 0.5) * (size / 10) + (noise2(r, i) - 0.5) * 8;
                const ry = y + ph * 0.5;
                const grd = ctx.createRadialGradient(rx, ry, 0, rx, ry, 4);
                grd.addColorStop(0, 'rgba(210, 205, 195, 0.75)');
                grd.addColorStop(0.6, 'rgba(90, 84, 76, 0.55)');
                grd.addColorStop(1, 'rgba(30, 24, 18, 0)');
                ctx.fillStyle = grd;
                ctx.beginPath();
                ctx.arc(rx, ry, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        grain(ctx, size, size, 26, dark ? 5 : 1);
        return toTexture(el, { repeat: [1, 1] });
    });
}

/* ------------------------------------------------------------------ */
/* Pano da vela                                                        */
/* ------------------------------------------------------------------ */

export function sailTexture({ base = '#ded1b0', stripe = '#a02f2f', emblem = 'cross' } = {}) {
    return cached(`sail:${base}:${stripe}:${emblem}`, () => {
        const size = 512;
        const el = canvas(size);
        const ctx = el.getContext('2d');

        ctx.fillStyle = base;
        ctx.fillRect(0, 0, size, size);

        // Trama do tecido.
        ctx.globalAlpha = 0.08;
        for (let i = 0; i < size; i += 3) {
            ctx.fillStyle = i % 6 === 0 ? '#000' : '#fff';
            ctx.fillRect(i, 0, 1, size);
            ctx.fillRect(0, i, size, 1);
        }
        ctx.globalAlpha = 1;

        // Listras verticais.
        ctx.fillStyle = stripe;
        ctx.globalAlpha = 0.85;
        const stripes = 4;
        for (let i = 0; i < stripes; i++) {
            const x = (i + 0.5) * (size / stripes) - size / (stripes * 6);
            ctx.fillRect(x, 0, size / (stripes * 3), size);
        }
        ctx.globalAlpha = 1;

        // Emblema central.
        ctx.save();
        ctx.translate(size / 2, size / 2);
        if (emblem === 'cross') {
            ctx.fillStyle = 'rgba(28, 22, 16, 0.82)';
            ctx.fillRect(-26, -120, 52, 240);
            ctx.fillRect(-110, -30, 220, 52);
            ctx.fillStyle = 'rgba(243, 201, 107, 0.9)';
            ctx.fillRect(-16, -110, 32, 220);
            ctx.fillRect(-100, -20, 200, 32);
        } else if (emblem === 'rune') {
            ctx.strokeStyle = 'rgba(220, 60, 40, 0.9)';
            ctx.lineWidth = 18;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, -130);
            ctx.lineTo(0, 130);
            ctx.moveTo(0, -60);
            ctx.lineTo(90, -130);
            ctx.moveTo(0, -60);
            ctx.lineTo(-90, -130);
            ctx.moveTo(0, 30);
            ctx.lineTo(80, -30);
            ctx.moveTo(0, 30);
            ctx.lineTo(-80, -30);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(255, 160, 90, 0.35)';
            ctx.lineWidth = 34;
            ctx.stroke();
        }
        ctx.restore();

        // Desgaste nas bordas.
        const vign = ctx.createRadialGradient(size / 2, size / 2, size * 0.25, size / 2, size / 2, size * 0.72);
        vign.addColorStop(0, 'rgba(0,0,0,0)');
        vign.addColorStop(1, 'rgba(40, 28, 18, 0.35)');
        ctx.fillStyle = vign;
        ctx.fillRect(0, 0, size, size);

        grain(ctx, size, size, 16, 9);
        return toTexture(el);
    });
}

/* ------------------------------------------------------------------ */
/* Pedra do castelo e das torres                                       */
/* ------------------------------------------------------------------ */

export function stoneTexture(tint = '#8f8d87') {
    return cached(`stone:${tint}`, () => {
        const size = 512;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a3833';
        ctx.fillRect(0, 0, size, size);

        const rows = 10;
        const rh = size / rows;
        for (let r = 0; r < rows; r++) {
            const offset = (r % 2) * (size / 12);
            const cols = 6;
            for (let c = -1; c < cols; c++) {
                const x = c * (size / cols) + offset + 2;
                const y = r * rh + 2;
                const w = size / cols - 4;
                const h = rh - 4;
                const shade = 0.72 + noise2(c * 3.7, r * 5.3) * 0.5;
                ctx.fillStyle = tint;
                ctx.globalAlpha = Math.min(1, shade);
                ctx.fillRect(x, y, w, h);
                ctx.globalAlpha = 1;

                // Luz no topo e sombra na base do bloco.
                ctx.fillStyle = 'rgba(255,255,255,0.10)';
                ctx.fillRect(x, y, w, 3);
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.fillRect(x, y + h - 3, w, 3);

                // Manchas de musgo.
                if (noise2(c, r * 1.7) > 0.74) {
                    ctx.fillStyle = 'rgba(86, 110, 58, 0.30)';
                    ctx.beginPath();
                    ctx.ellipse(x + w * 0.5, y + h * 0.7, w * 0.35, h * 0.28, 0, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        grain(ctx, size, size, 30, 4);
        return toTexture(el);
    });
}

/* ------------------------------------------------------------------ */
/* Escudos pendurados no costado                                       */
/* ------------------------------------------------------------------ */

export function shieldTexture(colorA = '#b23a3a', colorB = '#e5d6ae') {
    return cached(`shield:${colorA}:${colorB}`, () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = colorB;
        ctx.fillRect(0, 0, size, size);

        ctx.fillStyle = colorA;
        for (let i = 0; i < 8; i++) {
            ctx.save();
            ctx.translate(size / 2, size / 2);
            ctx.rotate((i * Math.PI) / 4);
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, size / 2, -0.2, 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }

        // Umbo central metálico.
        const grd = ctx.createRadialGradient(size / 2 - 8, size / 2 - 8, 2, size / 2, size / 2, 40);
        grd.addColorStop(0, '#f2efe6');
        grd.addColorStop(0.55, '#9a958a');
        grd.addColorStop(1, '#4a463f');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, 38, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = 'rgba(60, 44, 28, 0.85)';
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 8, 0, Math.PI * 2);
        ctx.stroke();

        grain(ctx, size, size, 18, 12);
        return toTexture(el);
    });
}

/* ------------------------------------------------------------------ */
/* Sprites de partículas (alpha puro, sem sRGB)                        */
/* ------------------------------------------------------------------ */

export function sparkTexture() {
    return cached('spark', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grd.addColorStop(0, 'rgba(255,255,255,1)');
        grd.addColorStop(0.25, 'rgba(255,225,170,0.9)');
        grd.addColorStop(0.55, 'rgba(255,150,60,0.35)');
        grd.addColorStop(1, 'rgba(255,120,40,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, size, size);
        return toTexture(el, { srgb: true });
    });
}

export function smokeTexture() {
    return cached('smoke', () => {
        const size = 128;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        grd.addColorStop(0, 'rgba(255,255,255,0.85)');
        grd.addColorStop(0.45, 'rgba(255,255,255,0.35)');
        grd.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, size, size);

        // Nódulos para quebrar a forma perfeitamente circular.
        for (let i = 0; i < 14; i++) {
            const a = noise2(i, 2.2) * Math.PI * 2;
            const r = 18 + noise2(i, 5.5) * 34;
            const x = size / 2 + Math.cos(a) * r;
            const y = size / 2 + Math.sin(a) * r;
            const rad = 12 + noise2(i, 8.8) * 22;
            const g2 = ctx.createRadialGradient(x, y, 0, x, y, rad);
            g2.addColorStop(0, 'rgba(255,255,255,0.22)');
            g2.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g2;
            ctx.beginPath();
            ctx.arc(x, y, rad, 0, Math.PI * 2);
            ctx.fill();
        }
        return toTexture(el, { srgb: true });
    });
}

export function foamTexture() {
    return cached('foam', () => {
        const size = 256;
        const el = canvas(size);
        const ctx = el.getContext('2d');
        ctx.clearRect(0, 0, size, size);

        // Bolhas de espuma distribuídas de forma tileável no eixo X.
        for (let i = 0; i < 900; i++) {
            const x = noise2(i, 1.3) * size;
            const y = noise2(i, 4.9) * size;
            const r = 2.4 + noise2(i, 7.1) * 9.0;
            const a = 0.06 + noise2(i, 9.4) * 0.42;
            for (const dx of [-size, 0, size]) {
                const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
                g.addColorStop(0, `rgba(255,255,255,${a})`);
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(x + dx, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        return toTexture(el, { srgb: true });
    });
}

/* ------------------------------------------------------------------ */
/* Estandartes                                                         */
/* ------------------------------------------------------------------ */

export function bannerTexture(colorA = '#8a1f2d', colorB = '#f3c96b') {
    return cached(`banner:${colorA}:${colorB}`, () => {
        const w = 128;
        const h = 256;
        const el = canvas(w, h);
        const ctx = el.getContext('2d');
        ctx.fillStyle = colorA;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = colorB;
        ctx.fillRect(0, 0, w, 10);
        ctx.fillRect(0, h - 46, w, 8);

        // Flor-de-lis estilizada.
        ctx.save();
        ctx.translate(w / 2, h * 0.42);
        ctx.fillStyle = colorB;
        ctx.beginPath();
        ctx.moveTo(0, -52);
        ctx.quadraticCurveTo(20, -18, 0, 6);
        ctx.quadraticCurveTo(-20, -18, 0, -52);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-34, -6);
        ctx.quadraticCurveTo(-6, -10, 0, 10);
        ctx.quadraticCurveTo(-14, 24, -34, -6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(34, -6);
        ctx.quadraticCurveTo(6, -10, 0, 10);
        ctx.quadraticCurveTo(14, 24, 34, -6);
        ctx.fill();
        ctx.fillRect(-6, 6, 12, 44);
        ctx.fillRect(-22, 34, 44, 9);
        ctx.restore();

        // Recorte em "V" na ponta.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.moveTo(0, h);
        ctx.lineTo(w / 2, h - 38);
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        grain(ctx, w, h, 14, 21);
        return toTexture(el);
    });
}

/** Libera todas as texturas em cache (usado ao destruir o jogo). */
export function disposeTextures() {
    cache.forEach((tex) => tex.dispose());
    cache.clear();
}
