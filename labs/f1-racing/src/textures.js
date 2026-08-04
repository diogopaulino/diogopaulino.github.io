/** Procedurally generated textures — nothing is loaded over the network. */

import * as THREE from 'three';

const cache = new Map();

function canvas(w, h) {
    const el = document.createElement('canvas');
    el.width = w;
    el.height = h;
    return el;
}

function makeTexture(key, w, h, draw, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
    if (cache.has(key)) return cache.get(key);
    const el = canvas(w, h);
    draw(el.getContext('2d'), w, h);
    const texture = new THREE.CanvasTexture(el);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.anisotropy = aniso;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    cache.set(key, texture);
    return texture;
}

/** Value noise, tiled so the texture repeats seamlessly. */
function noiseField(ctx, w, h, { cells = 32, alpha = 0.25, light = 255, dark = 0, seed = 1 } = {}) {
    let s = seed;
    const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const grid = new Float32Array((cells + 1) * (cells + 1));
    for (let y = 0; y <= cells; y++) {
        for (let x = 0; x <= cells; x++) {
            grid[y * (cells + 1) + x] = (x === cells ? grid[y * (cells + 1)] : 0) || rand();
        }
    }
    for (let x = 0; x <= cells; x++) grid[cells * (cells + 1) + x] = grid[x];

    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let y = 0; y < h; y++) {
        const gy = (y / h) * cells;
        const y0 = Math.floor(gy), fy = gy - y0;
        for (let x = 0; x < w; x++) {
            const gx = (x / w) * cells;
            const x0 = Math.floor(gx), fx = gx - x0;
            const a = grid[y0 * (cells + 1) + x0];
            const b = grid[y0 * (cells + 1) + x0 + 1];
            const c = grid[(y0 + 1) * (cells + 1) + x0];
            const d = grid[(y0 + 1) * (cells + 1) + x0 + 1];
            const sx = fx * fx * (3 - 2 * fx);
            const sy = fy * fy * (3 - 2 * fy);
            const v = (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy;
            const i = (y * w + x) * 4;
            const tint = dark + (light - dark) * v;
            data[i] = data[i] * (1 - alpha) + tint * alpha;
            data[i + 1] = data[i + 1] * (1 - alpha) + tint * alpha;
            data[i + 2] = data[i + 2] * (1 - alpha) + tint * alpha;
        }
    }
    ctx.putImageData(img, 0, 0);
}

function speckle(ctx, w, h, count, colors, size = 2, seed = 7) {
    let s = seed;
    const rand = () => (s = (s * 1103515245 + 12345) >>> 0) / 4294967296;
    for (let i = 0; i < count; i++) {
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        const r = size * (0.4 + rand());
        ctx.fillRect(rand() * w, rand() * h, r, r);
    }
}

/**
 * Road surface. `u` runs across the track, so the white edge lines and the darker
 * rubbered-in racing line are baked straight into the texture.
 */
export function roadTexture(base = 0x3a3d44) {
    const key = `road-${base}`;
    return makeTexture(key, 512, 512, (ctx, w, h) => {
        const col = new THREE.Color(base);
        ctx.fillStyle = `#${col.getHexString()}`;
        ctx.fillRect(0, 0, w, h);
        noiseField(ctx, w, h, { cells: 40, alpha: 0.22, light: 210, dark: 40, seed: 12 });
        noiseField(ctx, w, h, { cells: 140, alpha: 0.13, light: 190, dark: 60, seed: 88 });
        speckle(ctx, w, h, 5200, ['#0006', '#fff1', '#0004'], 2, 33);

        // Asphalt seam down the middle of the lane.
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#000';
        ctx.fillRect(w * 0.5 - 1, 0, 2, h);
        ctx.globalAlpha = 1;

        // Painted edge lines.
        ctx.fillStyle = '#e9ecef';
        ctx.fillRect(w * 0.022, 0, w * 0.028, h);
        ctx.fillRect(w * 0.95, 0, w * 0.028, h);
        ctx.globalAlpha = 0.35;
        speckle(ctx, w, h, 700, ['#0008'], 3, 5);
        ctx.globalAlpha = 1;
    }, { repeat: [1, 1] });
}

/** Rubber build-up on the racing line, blended over the road with a second pass. */
export function kerbTexture() {
    return makeTexture('kerb', 64, 128, (ctx, w, h) => {
        const bands = 4;
        for (let i = 0; i < bands; i++) {
            ctx.fillStyle = i % 2 === 0 ? '#d93b32' : '#f2f3f5';
            ctx.fillRect(0, (i * h) / bands, w, h / bands);
        }
        noiseField(ctx, w, h, { cells: 20, alpha: 0.16, light: 255, dark: 90, seed: 4 });
        ctx.globalAlpha = 0.25;
        speckle(ctx, w, h, 400, ['#0007'], 2, 19);
        ctx.globalAlpha = 1;
    }, { repeat: [1, 1] });
}

export function grassTexture(tint = 0x2f4a24) {
    return makeTexture(`grass-${tint}`, 512, 512, (ctx, w, h) => {
        const col = new THREE.Color(tint);
        ctx.fillStyle = `#${col.getHexString()}`;
        ctx.fillRect(0, 0, w, h);
        noiseField(ctx, w, h, { cells: 26, alpha: 0.4, light: 150, dark: 20, seed: 21 });
        noiseField(ctx, w, h, { cells: 90, alpha: 0.22, light: 170, dark: 30, seed: 55 });
        speckle(ctx, w, h, 9000, ['#00000022', '#7fa04a33', '#4c6b2a44'], 3, 91);
    }, { repeat: [1, 1] });
}

/** Asphalt run-off apron: like the track but lighter, unmarked and coarser. */
export function runoffTexture() {
    return makeTexture('runoff', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#4c5057';
        ctx.fillRect(0, 0, w, h);
        noiseField(ctx, w, h, { cells: 30, alpha: 0.24, light: 200, dark: 60, seed: 71 });
        noiseField(ctx, w, h, { cells: 110, alpha: 0.14, light: 180, dark: 70, seed: 19 });
        speckle(ctx, w, h, 3000, ['#0005', '#fff1'], 2, 12);
    }, { repeat: [1, 1] });
}

export function gravelTexture() {
    return makeTexture('gravel', 512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#8d7a5c';
        ctx.fillRect(0, 0, w, h);
        noiseField(ctx, w, h, { cells: 60, alpha: 0.35, light: 225, dark: 90, seed: 6 });
        speckle(ctx, w, h, 14000, ['#00000033', '#ffffff33', '#6b5c42aa'], 3, 41);
    }, { repeat: [1, 1] });
}

export function concreteTexture() {
    return makeTexture('concrete', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#9aa0a6';
        ctx.fillRect(0, 0, w, h);
        noiseField(ctx, w, h, { cells: 24, alpha: 0.25, light: 230, dark: 120, seed: 17 });
        ctx.strokeStyle = '#00000033';
        ctx.lineWidth = 2;
        for (let i = 0; i <= 4; i++) {
            ctx.beginPath();
            ctx.moveTo(0, (i * h) / 4);
            ctx.lineTo(w, (i * h) / 4);
            ctx.stroke();
        }
    }, { repeat: [1, 1] });
}

/** Grandstand crowd: coloured dots that read as people from a distance. */
export function crowdTexture() {
    return makeTexture('crowd', 256, 128, (ctx, w, h) => {
        ctx.fillStyle = '#15181d';
        ctx.fillRect(0, 0, w, h);
        const palette = ['#e8e8e8', '#d94f4f', '#4f7fd9', '#e0c65a', '#54b06a', '#c96ad0', '#f0a04b', '#2a2f38'];
        let s = 99;
        const rand = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
        for (let row = 0; row < 16; row++) {
            for (let i = 0; i < 46; i++) {
                const x = (i / 46) * w + (rand() - 0.5) * 4;
                const y = (row / 16) * h + 3;
                ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
                ctx.beginPath();
                ctx.arc(x, y, 2 + rand() * 1.4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
    }, { repeat: [1, 1] });
}

/** Start/finish grid: the painted chequered band across the track. */
export function startLineTexture() {
    return makeTexture('startline', 256, 64, (ctx, w, h) => {
        ctx.fillStyle = '#e9ecef';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#15171c';
        const cols = 16, rows = 4;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if ((x + y) % 2 === 0) continue;
                ctx.fillRect((x * w) / cols, (y * h) / rows, w / cols, h / rows);
            }
        }
    }, { repeat: [1, 1] });
}

/** Soft radial sprite reused by smoke, spray and dust. */
export function smokeTexture() {
    return makeTexture('smoke', 128, 128, (ctx, w, h) => {
        const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.45, 'rgba(255,255,255,0.35)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
    }, { srgb: false });
}

/** Car number + team stripe used on the nose and the engine cover. */
export function liveryTexture(team) {
    const key = `livery-${team.id}`;
    return makeTexture(key, 256, 256, (ctx, w, h) => {
        const primary = new THREE.Color(team.primary);
        const accent = new THREE.Color(team.accent);
        ctx.fillStyle = `#${primary.getHexString()}`;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = `#${accent.getHexString()}`;
        ctx.fillRect(0, h * 0.68, w, h * 0.06);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 150px Inter, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(team.number), w / 2, h * 0.4);
        ctx.font = 'bold 34px Inter, Helvetica, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(team.short, w / 2, h * 0.86);
    }, { repeat: [1, 1], aniso: 4 });
}

export function disposeTextures() {
    for (const texture of cache.values()) texture.dispose();
    cache.clear();
}
