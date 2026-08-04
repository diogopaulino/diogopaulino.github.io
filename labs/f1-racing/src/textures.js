/** Procedural PBR textures — albedo, normal and roughness from canvas, no network assets. */

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

/** Seeded PRNG for repeatable surfaces. */
function rng(seed = 1) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Value noise, tiled so the texture repeats seamlessly. */
function noiseField(ctx, w, h, { cells = 32, alpha = 0.25, light = 255, dark = 0, seed = 1 } = {}) {
    const rand = rng(seed);
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
    const rand = rng(seed);
    for (let i = 0; i < count; i++) {
        ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
        const r = size * (0.4 + rand());
        ctx.fillRect(rand() * w, rand() * h, r, r);
    }
}

/** Derive a tangent-space normal map from luminance of an albedo canvas. */
function heightToNormal(srcCtx, w, h, strength = 2.4) {
    const src = srcCtx.getImageData(0, 0, w, h).data;
    const out = canvas(w, h);
    const ctx = out.getContext('2d');
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

function roughnessFromAlbedo(srcCtx, w, h, { base = 0.82, contrast = 0.22, invert = false } = {}) {
    const src = srcCtx.getImageData(0, 0, w, h).data;
    const out = canvas(w, h);
    const ctx = out.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < src.length; i += 4) {
        let v = (src[i] + src[i + 1] + src[i + 2]) / (3 * 255);
        if (invert) v = 1 - v;
        const r = Math.max(0, Math.min(1, base + (v - 0.5) * contrast));
        const g = Math.round(r * 255);
        d[i] = d[i + 1] = d[i + 2] = g;
        d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return out;
}

function packMaps(key, albedoCanvas, { strength = 2.2, roughBase = 0.84, roughContrast = 0.2, aniso = 8, repeat = [1, 1] } = {}) {
    const mapKey = `${key}-pack`;
    if (cache.has(mapKey)) return cache.get(mapKey);

    const w = albedoCanvas.width;
    const h = albedoCanvas.height;
    const aCtx = albedoCanvas.getContext('2d');

    const map = new THREE.CanvasTexture(albedoCanvas);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(repeat[0], repeat[1]);
    map.anisotropy = aniso;
    map.colorSpace = THREE.SRGBColorSpace;

    const normal = new THREE.CanvasTexture(heightToNormal(aCtx, w, h, strength));
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(repeat[0], repeat[1]);
    normal.anisotropy = aniso;
    normal.colorSpace = THREE.NoColorSpace;

    const rough = new THREE.CanvasTexture(roughnessFromAlbedo(aCtx, w, h, { base: roughBase, contrast: roughContrast }));
    rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
    rough.repeat.set(repeat[0], repeat[1]);
    rough.anisotropy = Math.min(4, aniso);
    rough.colorSpace = THREE.NoColorSpace;

    const pack = { map, normalMap: normal, roughnessMap: rough };
    cache.set(mapKey, pack);
    return pack;
}

/**
 * Road surface. `u` runs across the track — white edge lines and darker rubbered
 * racing line are baked into the albedo for a Grand Prix look.
 */
export function roadTexture(base = 0x1e2026) {
    const key = `road-${base}`;
    if (cache.has(`${key}-pack`)) return cache.get(`${key}-pack`).map;

    const el = canvas(1024, 1024);
    const ctx = el.getContext('2d');
    const col = new THREE.Color(base);
    ctx.fillStyle = `#${col.getHexString()}`;
    ctx.fillRect(0, 0, 1024, 1024);

    noiseField(ctx, 1024, 1024, { cells: 48, alpha: 0.18, light: 170, dark: 28, seed: 12 });
    noiseField(ctx, 1024, 1024, { cells: 180, alpha: 0.12, light: 195, dark: 40, seed: 88 });
    noiseField(ctx, 1024, 1024, { cells: 320, alpha: 0.08, light: 210, dark: 55, seed: 201 });
    speckle(ctx, 1024, 1024, 22000, ['#00000055', '#ffffff14', '#00000077', '#3a3c4222'], 2, 33);

    // Aggregate chips — small bright/dark stones in the asphalt matrix.
    const rand = rng(404);
    for (let i = 0; i < 9000; i++) {
        ctx.fillStyle = rand() > 0.55 ? '#2a2c3288' : '#6a6e7688';
        ctx.fillRect(rand() * 1024, rand() * 1024, 1 + rand() * 2, 1 + rand());
    }

    // Longitudinal rubber build-up (racing line).
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(1024 * 0.28, 0, 1024 * 0.18, 1024);
    ctx.fillRect(1024 * 0.54, 0, 1024 * 0.18, 1024);
    ctx.globalAlpha = 0.12;
    ctx.fillRect(1024 * 0.12, 0, 1024 * 0.12, 1024);
    ctx.fillRect(1024 * 0.76, 0, 1024 * 0.12, 1024);

    // Asphalt seam / expansion joint.
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.fillRect(1024 * 0.5 - 1.5, 0, 3, 1024);

    // Painted edge lines with slight wear.
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e8ebf0';
    ctx.fillRect(1024 * 0.018, 0, 1024 * 0.032, 1024);
    ctx.fillRect(1024 * 0.95, 0, 1024 * 0.032, 1024);
    ctx.globalAlpha = 0.35;
    speckle(ctx, 1024, 1024, 800, ['#0009'], 2, 5);
    ctx.globalAlpha = 1;

    // Dashed centre guideline (subtle).
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#d0d4da';
    for (let y = 0; y < 1024; y += 48) ctx.fillRect(1024 * 0.5 - 2, y, 4, 22);
    ctx.globalAlpha = 1;

    const pack = packMaps(key, el, { strength: 3.2, roughBase: 0.88, roughContrast: 0.18, aniso: 16 });
    return pack.map;
}

export function roadMaps(base = 0x1e2026) {
    roadTexture(base);
    return cache.get(`road-${base}-pack`);
}

export function kerbTexture() {
    const key = 'kerb';
    if (cache.has(`${key}-pack`)) return cache.get(`${key}-pack`).map;

    const el = canvas(128, 256);
    const ctx = el.getContext('2d');
    const bands = 8;
    for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#c92e28' : '#f4f5f7';
        ctx.fillRect(0, (i * 256) / bands, 128, 256 / bands);
    }
    // Raised serration ridges.
    ctx.globalAlpha = 0.28;
    for (let i = 0; i < bands; i++) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, (i * 256) / bands, 128, 3);
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, (i * 256) / bands + 3, 128, 2);
    }
    ctx.globalAlpha = 1;
    noiseField(ctx, 128, 256, { cells: 24, alpha: 0.18, light: 255, dark: 80, seed: 4 });
    speckle(ctx, 128, 256, 600, ['#0008', '#fff3'], 2, 19);

    packMaps(key, el, { strength: 4.5, roughBase: 0.55, roughContrast: 0.3, aniso: 8 });
    return cache.get(`${key}-pack`).map;
}

export function kerbMaps() {
    kerbTexture();
    return cache.get('kerb-pack');
}

export function grassTexture(tint = 0x1f3518) {
    const key = `grass-${tint}`;
    if (cache.has(`${key}-pack`)) return cache.get(`${key}-pack`).map;

    const el = canvas(1024, 1024);
    const ctx = el.getContext('2d');
    const col = new THREE.Color(tint);
    ctx.fillStyle = `#${col.getHexString()}`;
    ctx.fillRect(0, 0, 1024, 1024);
    noiseField(ctx, 1024, 1024, { cells: 28, alpha: 0.42, light: 120, dark: 8, seed: 21 });
    noiseField(ctx, 1024, 1024, { cells: 140, alpha: 0.28, light: 150, dark: 18, seed: 55 });
    noiseField(ctx, 1024, 1024, { cells: 280, alpha: 0.15, light: 170, dark: 30, seed: 99 });

    // Blade streaks.
    const rand = rng(77);
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 6000; i++) {
        const x = rand() * 1024;
        const y = rand() * 1024;
        ctx.strokeStyle = rand() > 0.5 ? '#6a9a3a' : '#14280e';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand() - 0.5) * 4, y - 6 - rand() * 10);
        ctx.stroke();
    }
    ctx.globalAlpha = 1;
    speckle(ctx, 1024, 1024, 14000, ['#00000044', '#7fa04a33', '#4c6b2a55'], 2, 91);

    packMaps(key, el, { strength: 2.8, roughBase: 0.95, roughContrast: 0.12, aniso: 8 });
    return cache.get(`${key}-pack`).map;
}

export function grassMaps(tint = 0x1f3518) {
    grassTexture(tint);
    return cache.get(`grass-${tint}-pack`);
}

export function runoffTexture() {
    const key = 'runoff';
    if (cache.has(`${key}-pack`)) return cache.get(`${key}-pack`).map;
    const el = canvas(512, 512);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#4a4e55';
    ctx.fillRect(0, 0, 512, 512);
    noiseField(ctx, 512, 512, { cells: 36, alpha: 0.26, light: 200, dark: 55, seed: 71 });
    noiseField(ctx, 512, 512, { cells: 140, alpha: 0.16, light: 180, dark: 65, seed: 19 });
    speckle(ctx, 512, 512, 8000, ['#0006', '#fff2', '#2a2c30aa'], 2, 12);
    packMaps(key, el, { strength: 2.6, roughBase: 0.9, roughContrast: 0.15 });
    return cache.get(`${key}-pack`).map;
}

export function runoffMaps() {
    runoffTexture();
    return cache.get('runoff-pack');
}

export function gravelTexture() {
    const key = 'gravel';
    if (cache.has(`${key}-pack`)) return cache.get(`${key}-pack`).map;
    const el = canvas(512, 512);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#8a7658';
    ctx.fillRect(0, 0, 512, 512);
    noiseField(ctx, 512, 512, { cells: 70, alpha: 0.38, light: 230, dark: 85, seed: 6 });
    const rand = rng(41);
    for (let i = 0; i < 18000; i++) {
        const r = 1 + rand() * 3;
        ctx.fillStyle = rand() > 0.5 ? '#c4b089' : '#5a4a32';
        ctx.beginPath();
        ctx.arc(rand() * 512, rand() * 512, r, 0, Math.PI * 2);
        ctx.fill();
    }
    packMaps(key, el, { strength: 4.0, roughBase: 0.98, roughContrast: 0.1 });
    return cache.get(`${key}-pack`).map;
}

export function gravelMaps() {
    gravelTexture();
    return cache.get('gravel-pack');
}

export function concreteTexture() {
    const key = 'concrete';
    if (cache.has(`${key}-pack`)) return cache.get(`${key}-pack`).map;
    const el = canvas(512, 512);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#949aa0';
    ctx.fillRect(0, 0, 512, 512);
    noiseField(ctx, 512, 512, { cells: 28, alpha: 0.28, light: 230, dark: 110, seed: 17 });
    noiseField(ctx, 512, 512, { cells: 120, alpha: 0.12, light: 200, dark: 90, seed: 44 });
    ctx.strokeStyle = '#00000040';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 6; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (i * 512) / 6);
        ctx.lineTo(512, (i * 512) / 6);
        ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
        ctx.beginPath();
        ctx.moveTo((i * 512) / 4, 0);
        ctx.lineTo((i * 512) / 4, 512);
        ctx.stroke();
    }
    speckle(ctx, 512, 512, 4000, ['#0004', '#fff2'], 2, 9);
    packMaps(key, el, { strength: 2.0, roughBase: 0.78, roughContrast: 0.16 });
    return cache.get(`${key}-pack`).map;
}

export function concreteMaps() {
    concreteTexture();
    return cache.get('concrete-pack');
}

/** Carbon-fibre weave for monocoque accents. */
export function carbonTexture() {
    return makeTexture('carbon', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#0c0e12';
        ctx.fillRect(0, 0, w, h);
        const cell = 8;
        for (let y = 0; y < h; y += cell) {
            for (let x = 0; x < w; x += cell) {
                const dark = ((x / cell) + (y / cell)) % 2 === 0;
                ctx.fillStyle = dark ? '#12151b' : '#1a1e26';
                ctx.fillRect(x, y, cell, cell);
                ctx.fillStyle = dark ? '#2a303a22' : '#080a0e44';
                ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
            }
        }
        noiseField(ctx, w, h, { cells: 40, alpha: 0.12, light: 180, dark: 20, seed: 3 });
    }, { aniso: 4 });
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

/** Grandstand crowd: denser coloured silhouettes. */
export function crowdTexture() {
    return makeTexture('crowd', 512, 256, (ctx, w, h) => {
        ctx.fillStyle = '#12151a';
        ctx.fillRect(0, 0, w, h);
        const palette = ['#e8e8e8', '#d94f4f', '#4f7fd9', '#e0c65a', '#54b06a', '#c96ad0', '#f0a04b', '#2a2f38', '#f5f5f5', '#1a6bb5'];
        const rand = rng(99);
        for (let row = 0; row < 22; row++) {
            for (let i = 0; i < 72; i++) {
                const x = (i / 72) * w + (rand() - 0.5) * 5;
                const y = (row / 22) * h + 4;
                ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
                // Body
                ctx.fillRect(x - 1.2, y, 2.4, 5 + rand() * 3);
                // Head
                ctx.beginPath();
                ctx.arc(x, y - 1.2, 1.4 + rand() * 0.6, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
    }, { repeat: [1, 1] });
}

export function startLineTexture() {
    return makeTexture('startline', 512, 128, (ctx, w, h) => {
        ctx.fillStyle = '#f0f2f6';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#101218';
        const cols = 20, rows = 5;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                if ((x + y) % 2 === 0) continue;
                ctx.fillRect((x * w) / cols, (y * h) / rows, w / cols, h / rows);
            }
        }
        noiseField(ctx, w, h, { cells: 20, alpha: 0.1, light: 255, dark: 40, seed: 2 });
    }, { repeat: [1, 1] });
}

/** Team ad board with logo-like typography. */
export function bannerTexture(team) {
    const key = `banner-${team.id}`;
    return makeTexture(key, 512, 128, (ctx, w, h) => {
        const primary = new THREE.Color(team.primary);
        const accent = new THREE.Color(team.accent);
        const secondary = new THREE.Color(team.secondary);
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, `#${secondary.getHexString()}`);
        g.addColorStop(0.35, `#${primary.getHexString()}`);
        g.addColorStop(1, `#${accent.getHexString()}`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(0, h * 0.78, w, h * 0.22);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px Orbitron, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(team.short, w * 0.5, h * 0.42);
        ctx.font = '600 18px Inter, Helvetica, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.fillText(team.name.toUpperCase(), w * 0.5, h * 0.88);
    }, { aniso: 4 });
}

/** Catch-fence mesh pattern. */
export function fenceTexture() {
    return makeTexture('fence', 128, 128, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(200,205,215,0.55)';
        ctx.lineWidth = 1.5;
        const step = 10;
        for (let x = 0; x <= w; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        for (let y = 0; y <= h; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
    }, { srgb: true, aniso: 2 });
}

/** Car number + team stripe for nose / engine cover. */
export function liveryTexture(team) {
    const key = `livery-${team.id}`;
    return makeTexture(key, 512, 512, (ctx, w, h) => {
        const primary = new THREE.Color(team.primary);
        const accent = new THREE.Color(team.accent);
        const secondary = new THREE.Color(team.secondary);
        ctx.fillStyle = `#${primary.getHexString()}`;
        ctx.fillRect(0, 0, w, h);

        // Metallic flake noise.
        noiseField(ctx, w, h, { cells: 80, alpha: 0.08, light: 255, dark: 0, seed: team.number * 13 });

        // Accent chevron / stripe.
        ctx.fillStyle = `#${accent.getHexString()}`;
        ctx.beginPath();
        ctx.moveTo(0, h * 0.55);
        ctx.lineTo(w, h * 0.42);
        ctx.lineTo(w, h * 0.52);
        ctx.lineTo(0, h * 0.65);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = `#${secondary.getHexString()}`;
        ctx.fillRect(0, h * 0.72, w, h * 0.08);

        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = 'bold 220px Orbitron, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(team.number), w / 2, h * 0.34);

        ctx.font = 'bold 42px Orbitron, Helvetica, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.fillText(team.short, w / 2, h * 0.86);
    }, { repeat: [1, 1], aniso: 8 });
}

/** Tyre sidewall with compound-style ring colour. */
export function tyreSidewallTexture(compoundColor = '#e8404a') {
    const key = `tyre-side-${compoundColor}`;
    return makeTexture(key, 256, 64, (ctx, w, h) => {
        ctx.fillStyle = '#0e0f12';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = compoundColor;
        ctx.fillRect(0, h * 0.35, w, h * 0.28);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.font = 'bold 14px Inter, Helvetica, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < 4; i++) {
            ctx.fillText('GP SLICK  ·  305/660-R13', (i + 0.5) * (w / 4), h * 0.5);
        }
        noiseField(ctx, w, h, { cells: 20, alpha: 0.15, light: 80, dark: 0, seed: 8 });
    }, { aniso: 4 });
}

export function disposeTextures() {
    for (const value of cache.values()) {
        if (value.dispose) value.dispose();
        else if (value.map) {
            value.map.dispose();
            value.normalMap?.dispose();
            value.roughnessMap?.dispose();
        }
    }
    cache.clear();
}
