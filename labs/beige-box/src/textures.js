/**
 * Texturas PBR procedurais — albedo + normal + roughness, sem arquivos externos.
 * Cada mapa é gerado uma vez e reutilizado pelos materiais da cena.
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
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

function toTex(el, { repeat = [1, 1], srgb = true, aniso = 8, wrap = true } = {}) {
    const tex = new THREE.CanvasTexture(el);
    tex.wrapS = tex.wrapT = wrap ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = aniso;
    if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
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

function pack(key, w, h, draw, {
    strength = 2.1, roughBase = 0.8, roughContrast = 0.2, aniso = 8, repeat = [1, 1], wrap = true
} = {}) {
    if (cache.has(key)) return cache.get(key);
    const el = canvas(w, h);
    const ctx = ctx2d(el);
    draw(ctx, w, h);
    const map = toTex(el, { repeat, srgb: true, aniso, wrap });
    const nEl = heightToNormal(ctx, w, h, strength);
    const normalMap = toTex(nEl, { repeat, srgb: false, aniso, wrap });
    const rEl = roughnessFrom(ctx, w, h, roughBase, roughContrast);
    const roughnessMap = toTex(rEl, { repeat, srgb: false, aniso, wrap });
    const packed = { map, normalMap, roughnessMap, canvas: el };
    cache.set(key, packed);
    return packed;
}

function grain(ctx, w, h, amount, seed = 1) {
    const rand = rng(seed);
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (rand() - 0.5) * amount;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
}

function drawWood(ctx, w, h) {
    const rand = rng(42);
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(0, 0, w, h);
    const planks = 7;
    const ph = h / planks;
    for (let i = 0; i < planks; i++) {
        const y = i * ph;
        const shade = 0.78 + rand() * 0.28;
        ctx.fillStyle = `rgb(${Math.round(138 * shade)},${Math.round(92 * shade)},${Math.round(48 * shade)})`;
        ctx.fillRect(0, y + 1, w, ph - 2);
        ctx.strokeStyle = 'rgba(40,22,10,0.55)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(90,50,22,0.28)';
        ctx.lineWidth = 1;
        for (let k = 0; k < 9; k++) {
            ctx.beginPath();
            const yy = y + 6 + rand() * (ph - 12);
            ctx.moveTo(0, yy);
            for (let x = 0; x <= w; x += 18) {
                ctx.lineTo(x, yy + Math.sin(x * 0.04 + i + k) * 1.6);
            }
            ctx.stroke();
        }
    }
    grain(ctx, w, h, 18, 7);
}

function drawPlastic(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#d8cbb3');
    g.addColorStop(0.5, '#c9b89a');
    g.addColorStop(1, '#b9a888');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rand = rng(19);
    ctx.fillStyle = 'rgba(90,70,40,0.07)';
    for (let i = 0; i < 80; i++) {
        ctx.beginPath();
        ctx.ellipse(rand() * w, rand() * h, 8 + rand() * 28, 3 + rand() * 10, rand() * 6, 0, Math.PI * 2);
        ctx.fill();
    }
    grain(ctx, w, h, 14, 3);
}

function drawDarkPlastic(ctx, w, h) {
    ctx.fillStyle = '#2a2a28';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 16, 11);
}

function drawCarpet(ctx, w, h) {
    ctx.fillStyle = '#3a2a22';
    ctx.fillRect(0, 0, w, h);
    const cell = 32;
    for (let y = 0; y < h; y += cell) {
        for (let x = 0; x < w; x += cell) {
            const on = ((x / cell) + (y / cell)) % 2 === 0;
            ctx.fillStyle = on ? '#4a3228' : '#2e221c';
            ctx.fillRect(x, y, cell, cell);
            ctx.fillStyle = on ? '#6a4434' : '#4a3026';
            ctx.beginPath();
            ctx.moveTo(x + cell * 0.5, y + 4);
            ctx.lineTo(x + cell - 4, y + cell * 0.5);
            ctx.lineTo(x + cell * 0.5, y + cell - 4);
            ctx.lineTo(x + 4, y + cell * 0.5);
            ctx.closePath();
            ctx.fill();
        }
    }
    grain(ctx, w, h, 20, 5);
}

function drawWallpaper(ctx, w, h) {
    ctx.fillStyle = '#c4b49a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(140,110,70,0.28)';
    ctx.lineWidth = 2;
    const step = 48;
    for (let y = 24; y < h; y += step) {
        for (let x = 24; x < w; x += step) {
            ctx.beginPath();
            ctx.arc(x, y, 11, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    grain(ctx, w, h, 12, 9);
}

function drawCeiling(ctx, w, h) {
    ctx.fillStyle = '#e8dcc8';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 10, 2);
}

function drawNightSky(ctx, w, h) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#0b1020');
    g.addColorStop(0.45, '#1a2240');
    g.addColorStop(0.72, '#3a2a48');
    g.addColorStop(1, '#6a4030');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const rand = rng(99);
    for (let i = 0; i < 220; i++) {
        const x = rand() * w;
        const y = rand() * h * 0.7;
        const r = rand() * 1.4;
        ctx.fillStyle = `rgba(255,245,220,${0.35 + rand() * 0.65})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    const mx = w * 0.72;
    const my = h * 0.22;
    const moon = ctx.createRadialGradient(mx, my, 4, mx, my, 38);
    moon.addColorStop(0, '#fff6d8');
    moon.addColorStop(0.45, '#f0d8a0');
    moon.addColorStop(1, 'rgba(240,200,120,0)');
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(mx, my, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f4e6c0';
    ctx.beginPath();
    ctx.arc(mx, my, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2240';
    ctx.beginPath();
    ctx.arc(mx + 6, my - 2, 14, 0, Math.PI * 2);
    ctx.fill();
}

function drawPoster(ctx, w, h, kind) {
    if (kind === 'os') {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, '#1a3a8a');
        g.addColorStop(1, '#0a1028');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#3ec6ff';
        ctx.fillRect(w * 0.18, h * 0.22, w * 0.64, h * 0.08);
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.round(h * 0.11)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('NEXUS 95', w / 2, h * 0.48);
        ctx.font = `${Math.round(h * 0.045)}px sans-serif`;
        ctx.fillStyle = '#9ad4ff';
        ctx.fillText('where do you want to go', w / 2, h * 0.6);
        ctx.fillText('today?', w / 2, h * 0.68);
        ctx.strokeStyle = '#d8c070';
        ctx.lineWidth = 10;
        ctx.strokeRect(8, 8, w - 16, h - 16);
    } else if (kind === 'band') {
        ctx.fillStyle = '#12080c';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e23a4a';
        ctx.beginPath();
        ctx.moveTo(w * 0.5, h * 0.18);
        ctx.bezierCurveTo(w * 0.9, h * 0.05, w * 1.05, h * 0.55, w * 0.5, h * 0.82);
        ctx.bezierCurveTo(w * -0.05, h * 0.55, w * 0.1, h * 0.05, w * 0.5, h * 0.18);
        ctx.fill();
        ctx.fillStyle = '#f4e8d0';
        ctx.font = `bold ${Math.round(h * 0.08)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('STATIC HEARTS', w / 2, h * 0.92);
        ctx.strokeStyle = '#f4e8d0';
        ctx.lineWidth = 8;
        ctx.strokeRect(10, 10, w - 20, h - 20);
    } else {
        ctx.fillStyle = '#0c1a12';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = '#7dff9a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.arc(w / 2, h / 2, 18 + i * 16, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = '#7dff9a';
        ctx.font = `bold ${Math.round(h * 0.09)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('DISKETTE', w / 2, h * 0.52);
        ctx.font = `${Math.round(h * 0.04)}px sans-serif`;
        ctx.fillText('FEST 94', w / 2, h * 0.62);
    }
}

function drawGrille(ctx, w, h) {
    ctx.fillStyle = '#1a1a18';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3a36';
    const s = 6;
    for (let y = 0; y < h; y += s) {
        for (let x = (y / s) % 2 === 0 ? 0 : s / 2; x < w; x += s) {
            ctx.beginPath();
            ctx.arc(x, y, 1.6, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

function drawMousepad(ctx, w, h) {
    ctx.fillStyle = '#2a1c28';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#c45a7a';
    ctx.lineWidth = 14;
    ctx.strokeRect(10, 10, w - 20, h - 20);
    ctx.fillStyle = '#e8c070';
    ctx.font = `bold ${Math.round(h * 0.16)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('NEXUS', w / 2, h * 0.58);
    grain(ctx, w, h, 16, 4);
}

function drawLeaf(ctx, w, h) {
    ctx.fillStyle = '#1a3a18';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a8a32';
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w * 0.38, h * 0.46, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b8e070';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2, 8);
    ctx.lineTo(w / 2, h - 8);
    ctx.stroke();
}

function drawPaper(ctx, w, h) {
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a5aaa';
    ctx.font = `${Math.round(h * 0.055)}px monospace`;
    ctx.fillText('MS-DOS 6.22', 24, 48);
    ctx.fillStyle = '#444';
    ctx.font = `${Math.round(h * 0.04)}px sans-serif`;
    const lines = ['User\'s Guide', '', 'Chapter 3 — AUTOEXEC', 'HIMEM.SYS / QEMM', 'SMARTDRV  /  MOUSE.COM'];
    lines.forEach((t, i) => ctx.fillText(t, 24, 90 + i * 28));
    grain(ctx, w, h, 10, 8);
}

function drawSticky(ctx, w, h) {
    ctx.fillStyle = '#f2e05a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a3010';
    ctx.font = `${Math.round(h * 0.16)}px sans-serif`;
    ctx.fillText('senha:', 16, h * 0.42);
    ctx.font = `bold ${Math.round(h * 0.18)}px sans-serif`;
    ctx.fillText('hunter2', 16, h * 0.72);
}

function drawFloppyLabel(ctx, w, h, title, color) {
    ctx.fillStyle = '#f2ead8';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h * 0.18);
    ctx.fillStyle = '#222';
    ctx.font = `bold ${Math.round(h * 0.13)}px sans-serif`;
    ctx.fillText(title, 10, h * 0.48);
    ctx.font = `${Math.round(h * 0.08)}px sans-serif`;
    ctx.fillStyle = '#555';
    ctx.fillText('1.44 MB  ·  HD', 10, h * 0.7);
    ctx.fillText('A: \\', 10, h * 0.86);
}

export function createTextures(aniso = 8) {
    const wood = pack('wood', 512, 512, drawWood, { strength: 3.2, roughBase: 0.72, repeat: [2, 1], aniso });
    const plastic = pack('plastic', 256, 256, drawPlastic, { strength: 1.1, roughBase: 0.48, roughContrast: 0.12, aniso });
    const darkPlastic = pack('darkP', 256, 256, drawDarkPlastic, { strength: 0.8, roughBase: 0.42, aniso });
    const carpet = pack('carpet', 512, 512, drawCarpet, { strength: 2.6, roughBase: 0.92, repeat: [6, 5], aniso });
    const wallpaper = pack('wall', 512, 512, drawWallpaper, { strength: 0.7, roughBase: 0.88, repeat: [4, 3], aniso });
    const ceiling = pack('ceil', 256, 256, drawCeiling, { strength: 0.4, roughBase: 0.9, aniso });

    const skyEl = canvas(512, 512);
    drawNightSky(ctx2d(skyEl), 512, 512);
    const nightSky = toTex(skyEl, { wrap: false, aniso: 4 });

    function poster(kind) {
        const key = `poster:${kind}`;
        if (cache.has(key)) return cache.get(key);
        const el = canvas(512, 704);
        drawPoster(ctx2d(el), 512, 704, kind);
        const tex = toTex(el, { wrap: false, aniso: 4 });
        cache.set(key, tex);
        return tex;
    }

    const grille = pack('grille', 256, 256, drawGrille, { strength: 2.8, roughBase: 0.55, aniso });
    const mousepad = pack('pad', 256, 256, drawMousepad, { strength: 1.4, roughBase: 0.86, wrap: false, aniso });
    const leaf = pack('leaf', 128, 256, drawLeaf, { strength: 1.6, roughBase: 0.7, wrap: false, aniso: 4 });
    const paper = pack('paper', 256, 360, drawPaper, { strength: 0.5, roughBase: 0.82, wrap: false, aniso: 4 });
    const sticky = (() => {
        const el = canvas(256, 256);
        drawSticky(ctx2d(el), 256, 256);
        return toTex(el, { wrap: false, aniso: 4 });
    })();

    function floppy(title, color) {
        const key = `floppy:${title}`;
        if (cache.has(key)) return cache.get(key);
        const el = canvas(256, 160);
        drawFloppyLabel(ctx2d(el), 256, 160, title, color);
        const tex = toTex(el, { wrap: false, aniso: 4 });
        cache.set(key, tex);
        return tex;
    }

    function bookCover(title, hue) {
        const key = `book:${title}`;
        if (cache.has(key)) return cache.get(key);
        const el = canvas(256, 360);
        const ctx = ctx2d(el);
        ctx.fillStyle = `hsl(${hue} 42% 28%)`;
        ctx.fillRect(0, 0, 256, 360);
        ctx.fillStyle = `hsl(${hue} 50% 18%)`;
        ctx.fillRect(0, 0, 22, 360);
        ctx.fillStyle = '#f0e6d0';
        ctx.font = 'bold 22px sans-serif';
        ctx.save();
        ctx.translate(48, 40);
        title.split(' ').forEach((t, i) => ctx.fillText(t, 0, i * 28));
        ctx.restore();
        const tex = toTex(el, { wrap: false, aniso: 4 });
        cache.set(key, tex);
        return tex;
    }

    return {
        wood, plastic, darkPlastic, carpet, wallpaper, ceiling,
        nightSky, grille, mousepad, leaf, paper, sticky,
        posterOs: poster('os'),
        posterBand: poster('band'),
        posterDisk: poster('disk'),
        floppy, bookCover
    };
}

export function applyMaps(material, packed, normalScale = 0.6) {
    material.map = packed.map;
    material.normalMap = packed.normalMap;
    material.normalScale = new THREE.Vector2(normalScale, normalScale);
    material.roughnessMap = packed.roughnessMap;
    material.needsUpdate = true;
    return material;
}
