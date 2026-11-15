/**
 * Texturas e materiais PBR procedurais para Santos Orla 3D.
 * Gera albedo, normal/bump e roughness em Canvas/DataTexture sem assets externos.
 */

import * as THREE from 'three';
import { seeded } from './utils.js';

const texCache = new Map();

function cachedCanvasTex(key, w, h, draw, { color = true, repeatX = 1, repeatY = 1 } = {}) {
    if (texCache.has(key)) return texCache.get(key);
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d'), w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    texCache.set(key, tex);
    return tex;
}

/** Calçadão em Mosaico Português (ondas clássicas da orla de Santos). */
export function createPortugueseMosaicTextures(repeatX = 120, repeatY = 2.4) {
    const map = cachedCanvasTex('mosaic-albedo', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#e6e1d6';
        ctx.fillRect(0, 0, w, h);

        // Ondas em pedra portuguesa preta e branca
        const bands = 4;
        const bh = h / bands;
        for (let b = 0; b < bands; b++) {
            const isBlack = b % 2 === 1;
            ctx.fillStyle = isBlack ? '#282c32' : '#ebe6dc';
            ctx.beginPath();
            for (let x = 0; x <= w; x += 8) {
                const y = b * bh + Math.sin((x / w) * Math.PI * 2) * (bh * 0.34);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            for (let x = w; x >= 0; x -= 8) {
                const y = (b + 1) * bh + Math.sin((x / w) * Math.PI * 2) * (bh * 0.34);
                ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        }

        // Juntas individuais das pedrinhas
        const rand = seeded(0xca1c);
        for (let y = 0; y < h; y += 8) {
            for (let x = 0; x < w; x += 8) {
                const jx = x + (rand() - 0.5) * 2;
                const jy = y + (rand() - 0.5) * 2;
                ctx.strokeStyle = 'rgba(40, 38, 34, 0.22)';
                ctx.lineWidth = 1;
                ctx.strokeRect(jx, jy, 7, 7);
            }
        }
    }, { color: true, repeatX, repeatY });

    const bump = cachedCanvasTex('mosaic-bump', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(0, 0, w, h);
        const rand = seeded(0xca1d);
        for (let y = 0; y < h; y += 8) {
            for (let x = 0; x < w; x += 8) {
                const v = 175 + Math.floor(rand() * 65);
                ctx.fillStyle = `rgb(${v},${v},${v})`;
                ctx.fillRect(x + 1, y + 1, 6, 6);
            }
        }
    }, { color: false, repeatX, repeatY });

    return { map, bump };
}

/** Asfalto com granulação + faixas de rolamento da Av. da Orla. */
export function createAsphaltTextures(repeatX = 60, repeatY = 1) {
    const map = cachedCanvasTex('asphalt-albedo', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#2b2e34';
        ctx.fillRect(0, 0, w, h);
        const rand = seeded(0xa5fa);
        for (let i = 0; i < 4500; i++) {
            const x = rand() * w;
            const y = rand() * h;
            const g = 34 + Math.floor(rand() * 28);
            ctx.fillStyle = `rgb(${g},${g + 2},${g + 4})`;
            ctx.fillRect(x, y, 2, 2);
        }
        // Bordas e faixa tracejada central
        ctx.fillStyle = 'rgba(235, 232, 220, 0.78)';
        ctx.fillRect(0, 12, w, 5);
        ctx.fillRect(0, h - 17, w, 5);

        ctx.fillStyle = 'rgba(240, 195, 70, 0.85)';
        ctx.fillRect(16, h * 0.5 - 3, 84, 6);
        ctx.fillRect(148, h * 0.5 - 3, 84, 6);
    }, { color: true, repeatX, repeatY });

    const bump = cachedCanvasTex('asphalt-bump', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, w, h);
        const rand = seeded(0xa5fb);
        for (let i = 0; i < 4000; i++) {
            const g = 90 + Math.floor(rand() * 80);
            ctx.fillStyle = `rgb(${g},${g},${g})`;
            ctx.fillRect(rand() * w, rand() * h, 2, 2);
        }
    }, { color: false, repeatX, repeatY });

    return { map, bump };
}

/** Areia da praia com ondulações sutis de vento/maré. */
export function createSandTextures(repeatX = 90, repeatY = 6) {
    const map = cachedCanvasTex('sand-albedo', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#dcc598';
        ctx.fillRect(0, 0, w, h);
        const rand = seeded(0x5a4d);
        for (let i = 0; i < 6500; i++) {
            const x = rand() * w;
            const y = rand() * h;
            const v = rand();
            ctx.fillStyle = v > 0.5
                ? `rgba(242, 224, 184, ${0.15 + v * 0.2})`
                : `rgba(176, 148, 102, ${0.12 + v * 0.18})`;
            ctx.fillRect(x, y, 2, 2);
        }
        // Marcas suaves de vento
        ctx.strokeStyle = 'rgba(182, 152, 104, 0.18)';
        ctx.lineWidth = 3;
        for (let y = 16; y < h; y += 28) {
            ctx.beginPath();
            for (let x = 0; x <= w; x += 16) {
                const yy = y + Math.sin((x / w) * Math.PI * 2) * 4;
                if (x === 0) ctx.moveTo(x, yy);
                else ctx.lineTo(x, yy);
            }
            ctx.stroke();
        }
    }, { color: true, repeatX, repeatY });

    const bump = cachedCanvasTex('sand-bump', 256, 256, (ctx, w, h) => {
        ctx.fillStyle = '#808080';
        ctx.fillRect(0, 0, w, h);
        const rand = seeded(0x5a4e);
        for (let i = 0; i < 4500; i++) {
            const g = 100 + Math.floor(rand() * 60);
            ctx.fillStyle = `rgb(${g},${g},${g})`;
            ctx.fillRect(rand() * w, rand() * h, 2, 2);
        }
    }, { color: false, repeatX, repeatY });

    return { map, bump };
}

/** Fachada de edifício de Santos com varandas, vidro reflexivo e textura de pastilha. */
export function createFacadeTextures() {
    const map = cachedCanvasTex('facade-albedo', 512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#ede8de';
        ctx.fillRect(0, 0, w, h);

        const rand = seeded(0xfa5a);
        // Granulação de reboco/pastilha
        for (let i = 0; i < 3000; i++) {
            const g = 215 + Math.floor(rand() * 30);
            ctx.fillStyle = `rgba(${g},${g - 4},${g - 10},0.35)`;
            ctx.fillRect(rand() * w, rand() * h, 2, 2);
        }

        const floors = 12;
        const cols = 4;
        const fh = h / floors;
        const cw = w / cols;

        for (let r = 0; r < floors; r++) {
            const y = r * fh;
            // Sombra sob laje da varanda
            const grad = ctx.createLinearGradient(0, y, 0, y + 10);
            grad.addColorStop(0, 'rgba(30, 34, 42, 0.35)');
            grad.addColorStop(1, 'rgba(30, 34, 42, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, y, w, 10);

            for (let col = 0; col < cols; col++) {
                const x = col * cw;
                // Janela / porta-balcão com reflexo azul-oceano
                const wg = ctx.createLinearGradient(x + 10, y + 6, x + cw - 10, y + fh - 14);
                wg.addColorStop(0, '#1e394c');
                wg.addColorStop(0.55, '#2d556e');
                wg.addColorStop(1, '#192b38');
                ctx.fillStyle = wg;
                ctx.fillRect(x + 10, y + 5, cw - 20, fh - 17);

                // Esquadrias de alumínio
                ctx.strokeStyle = 'rgba(232, 236, 240, 0.72)';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 10, y + 5, cw - 20, fh - 17);
                ctx.beginPath();
                ctx.moveTo(x + cw * 0.5, y + 5);
                ctx.lineTo(x + cw * 0.5, y + fh - 12);
                ctx.stroke();

                // Guarda-corpo de vidro da sacada
                ctx.fillStyle = 'rgba(130, 185, 210, 0.42)';
                ctx.fillRect(x + 6, y + fh - 15, cw - 12, 9);
            }

            // Borda da laje
            ctx.fillStyle = '#e8e4da';
            ctx.fillRect(0, y + fh - 6, w, 5);
        }
    }, { color: true, repeatX: 1, repeatY: 1 });

    const emissive = cachedCanvasTex('facade-emissive', 512, 512, (ctx, w, h) => {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, w, h);
        const rand = seeded(0xe115);
        const floors = 12;
        const cols = 4;
        const fh = h / floors;
        const cw = w / cols;
        for (let r = 0; r < floors; r++) {
            for (let col = 0; col < cols; col++) {
                if (rand() > 0.46) continue;
                const x = col * cw;
                const y = r * fh;
                const warm = rand() > 0.25;
                ctx.fillStyle = warm ? '#ffcf86' : '#b8e2ff';
                ctx.fillRect(x + 12, y + 7, cw - 24, fh - 20);
            }
        }
    }, { color: true, repeatX: 1, repeatY: 1 });

    return { map, emissive };
}
