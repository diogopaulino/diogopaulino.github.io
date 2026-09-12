/**
 * Texturas PBR procedurais: fachadas, placas néon, asfalto e sprites.
 * Nada de assets externos — o lab continua autocontido.
 */

import * as THREE from 'three';

const cache = new Map();

function cached(key, factory) {
    if (!cache.has(key)) cache.set(key, factory());
    return cache.get(key);
}

export function makeCanvas(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    draw(ctx, size);
    return canvas;
}

export function canvasTexture(THREE, canvas, { repeatX = 1, repeatY = 1, colorSpace, normal = false } = {}) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    if (normal) tex.colorSpace = THREE.NoColorSpace;
    else if (colorSpace && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

function heightToNormal(height, size, strength = 3.5) {
    const el = document.createElement('canvas');
    el.width = el.height = size;
    const ctx = el.getContext('2d');
    const img = ctx.createImageData(size, size);
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
    ctx.putImageData(img, 0, 0);
    return el;
}

/** Fachada densas — mais janelas, molduras e relevo. */
export function windowTexture(THREE) {
    return cached('windows', () => {
        const size = 512;
        const height = new Float32Array(size * size);
        const canvas = makeCanvas(size, (ctx, s) => {
            ctx.fillStyle = '#07060d';
            ctx.fillRect(0, 0, s, s);
            const cols = 10;
            const rows = 14;
            const pad = 6;
            const bw = (s - pad * (cols + 1)) / cols;
            const bh = (s - pad * (rows + 1)) / rows;
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    const px = pad + x * (bw + pad);
                    const py = pad + y * (bh + pad);
                    const on = Math.random() > 0.22;
                    const shade = on ? 170 + Math.random() * 85 : 14 + Math.random() * 16;
                    const r = shade;
                    const g = shade * (0.72 + Math.random() * 0.2);
                    const b = shade * (0.55 + Math.random() * 0.25);
                    ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
                    ctx.fillRect(px, py, bw, bh);
                    // moldura
                    ctx.strokeStyle = 'rgba(40, 36, 60, 0.85)';
                    ctx.lineWidth = 1.5;
                    ctx.strokeRect(px + 0.5, py + 0.5, bw - 1, bh - 1);
                    if (on && Math.random() > 0.55) {
                        ctx.fillStyle = 'rgba(255, 180, 220, 0.12)';
                        ctx.fillRect(px + 2, py + 2, bw * 0.35, bh * 0.3);
                    }
                    for (let yy = 0; yy < bh; yy++) {
                        for (let xx = 0; xx < bw; xx++) {
                            const ix = ((py + yy) | 0) * size + ((px + xx) | 0);
                            if (ix >= 0 && ix < height.length) {
                                height[ix] = on ? 0.55 : 0.25;
                            }
                        }
                    }
                    // moldura raised
                    for (let t = 0; t < 2; t++) {
                        for (let xx = 0; xx < bw; xx++) {
                            const top = ((py + t) | 0) * size + ((px + xx) | 0);
                            const bot = ((py + bh - 1 - t) | 0) * size + ((px + xx) | 0);
                            if (top < height.length) height[top] = 0.75;
                            if (bot < height.length) height[bot] = 0.75;
                        }
                    }
                }
            }
        });
        const map = canvasTexture(THREE, canvas, { repeatX: 1, repeatY: 2, colorSpace: true });
        const normalMap = canvasTexture(THREE, heightToNormal(height, size, 4.2), {
            repeatX: 1, repeatY: 2, normal: true
        });
        return { map, normalMap, emissiveMap: map };
    });
}

export function neonSignTexture(THREE, text, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 128);
    ctx.fillStyle = 'rgba(4, 2, 10, 0.72)';
    ctx.fillRect(0, 0, 512, 128);
    ctx.font = '700 64px "Audiowide", "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = color;
    ctx.shadowBlur = 24;
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 68);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeText(text, 256, 68);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function sparkTexture(THREE) {
    const canvas = makeCanvas(64, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.25, 'rgba(255,220,255,0.9)');
        g.addColorStop(0.6, 'rgba(255,80,200,0.35)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

/** Micro-risco de cromo para roughnessMap. */
export function chromeScratchMap(THREE) {
    return cached('chromeScratch', () => {
        const size = 128;
        const canvas = makeCanvas(size, (ctx, s) => {
            ctx.fillStyle = '#2a2a2a';
            ctx.fillRect(0, 0, s, s);
            for (let i = 0; i < 80; i++) {
                ctx.strokeStyle = `rgba(180,180,200,${0.08 + Math.random() * 0.2})`;
                ctx.lineWidth = 0.5 + Math.random();
                ctx.beginPath();
                ctx.moveTo(Math.random() * s, Math.random() * s);
                ctx.lineTo(Math.random() * s, Math.random() * s);
                ctx.stroke();
            }
        });
        return canvasTexture(THREE, canvas, { repeatX: 2, repeatY: 2, normal: true });
    });
}

export const SIGN_WORDS = [
    'ARCADE', 'VIDEO', 'HOTEL', 'DISCO', 'SUSHI', 'RADIO', 'PIZZA',
    'KARAOKE', 'CINEMA', 'BAR', 'TAXI', 'LASER', 'PIXEL', 'WALKMAN',
    'CASSETTE', 'NIGHT', '24H', 'BOWL', 'DINER', 'CLUB'
];
