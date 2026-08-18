/**
 * Texturas procedurais geradas via HTML Canvas para Babylon.js.
 * Sem dependência de PNGs externos.
 */

import { hash2 } from '../utils/math.js';

const cache = new Map();

function createCanvas(width, height = width) {
    const el = document.createElement('canvas');
    el.width = width;
    el.height = height;
    return el;
}

function grain(ctx, w, h, amount, seed = 0) {
    const img = ctx.getImageData(0, 0, w, h);
    const data = img.data;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const x = p % w;
        const y = (p / w) | 0;
        const n = (hash2(x, y, seed) - 0.5) * amount;
        data[i] = Math.max(0, Math.min(255, data[i] + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
}

function createBabylonDynamicTexture(name, canvasEl, scene, uScale = 1, vScale = 1) {
    const texture = new BABYLON.DynamicTexture(name, canvasEl, scene, true);
    texture.uScale = uScale;
    texture.vScale = vScale;
    texture.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
    texture.update();
    return texture;
}

function cached(key, scene, factory) {
    const cacheKey = `${key}_${scene?.uid || 'default'}`;
    if (!cache.has(cacheKey)) {
        cache.set(cacheKey, factory());
    }
    return cache.get(cacheKey);
}

export function woodTexture(scene, uScale = 4, vScale = 4) {
    return cached('wood', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6b4423';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 28; i++) {
            ctx.strokeStyle = i % 2 ? '#5a3818' : '#7a5530';
            ctx.lineWidth = 6 + hash2(i, 2) * 8;
            ctx.globalAlpha = 0.45;
            ctx.beginPath();
            ctx.moveTo(0, i * 10);
            ctx.bezierCurveTo(80, i * 10 + 8, 160, i * 10 - 6, size, i * 10 + 4);
            ctx.stroke();
        }
        grain(ctx, size, size, 28, 4);
        return createBabylonDynamicTexture('tex_wood', el, scene, uScale, vScale);
    });
}

export function darkWoodTexture(scene, uScale = 3, vScale = 3) {
    return cached('darkwood', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a2414';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 22; i++) {
            ctx.strokeStyle = '#2a180c';
            ctx.lineWidth = 5;
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(0, i * 12);
            ctx.lineTo(size, i * 12 + 3);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 6);
        return createBabylonDynamicTexture('tex_darkwood', el, scene, uScale, vScale);
    });
}

/* Casca de árvore: sulcos verticais irregulares sobre marrom acinzentado.
   O `vScale` alto no uso (1x2) estica a fibra ao longo do tronco, que é como a
   casca real se comporta. */
export function barkTexture(scene, uScale = 1, vScale = 2) {
    return cached('bark', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a3524';
        ctx.fillRect(0, 0, size, size);

        // Sulcos: linhas verticais que serpenteiam, com largura e tom variados.
        for (let i = 0; i < 44; i++) {
            const x = hash2(i, 11) * size;
            ctx.strokeStyle = hash2(i, 12) > 0.5 ? '#3a2818' : '#5d4530';
            ctx.lineWidth = 2 + hash2(i, 13) * 5;
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.bezierCurveTo(
                x + (hash2(i, 14) - 0.5) * 22, size * 0.33,
                x + (hash2(i, 15) - 0.5) * 22, size * 0.66,
                x + (hash2(i, 16) - 0.5) * 14, size
            );
            ctx.stroke();
        }

        // Nós da madeira.
        for (let i = 0; i < 5; i++) {
            const x = hash2(i, 21) * size;
            const y = hash2(i, 22) * size;
            const r = 6 + hash2(i, 23) * 10;
            ctx.globalAlpha = 0.4;
            ctx.strokeStyle = '#2d1e10';
            ctx.lineWidth = 2;
            for (let ring = 0; ring < 3; ring++) {
                ctx.beginPath();
                ctx.ellipse(x, y, r - ring * 2, (r - ring * 2) * 0.6, 0, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        ctx.globalAlpha = 1;
        grain(ctx, size, size, 30, 12);
        return createBabylonDynamicTexture('tex_bark', el, scene, uScale, vScale);
    });
}

/* Folhagem: aglomerado de manchas verdes em três tons. Aplicada nos cones da
   copa, o que evita o verde chapado que denuncia primitiva sem textura. */
export function leafTexture(scene, uScale = 2, vScale = 2) {
    return cached('leaf', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#2f5220';
        ctx.fillRect(0, 0, size, size);

        const tones = ['#3f6b28', '#264618', '#4f8033', '#1d3a12'];
        for (let i = 0; i < 260; i++) {
            const x = hash2(i, 31) * size;
            const y = hash2(i, 32) * size;
            const rx = 5 + hash2(i, 33) * 11;
            const ry = rx * (0.45 + hash2(i, 34) * 0.4);
            ctx.fillStyle = tones[Math.floor(hash2(i, 35) * tones.length) % tones.length];
            ctx.globalAlpha = 0.5 + hash2(i, 36) * 0.4;
            ctx.beginPath();
            ctx.ellipse(x, y, rx, ry, hash2(i, 37) * Math.PI, 0, Math.PI * 2);
            ctx.fill();
        }

        // Alguns pontos de luz, como sol furando a copa.
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = '#8fc45c';
        for (let i = 0; i < 30; i++) {
            ctx.beginPath();
            ctx.arc(hash2(i, 41) * size, hash2(i, 42) * size, 2 + hash2(i, 43) * 3, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        grain(ctx, size, size, 18, 15);
        return createBabylonDynamicTexture('tex_leaf', el, scene, uScale, vScale);
    });
}

export function stoneTexture(scene, uScale = 8, vScale = 8) {
    return cached('stone', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a665e';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 80; i++) {
            const x = hash2(i, 1) * size;
            const y = hash2(i, 2) * size;
            ctx.fillStyle = hash2(i, 3) > 0.5 ? '#7a766e' : '#5a564e';
            ctx.globalAlpha = 0.5;
            ctx.fillRect(x, y, 18 + hash2(i, 4) * 30, 12 + hash2(i, 5) * 20);
        }
        grain(ctx, size, size, 36, 9);
        return createBabylonDynamicTexture('tex_stone', el, scene, uScale, vScale);
    });
}

export function castleStoneTexture(scene, uScale = 6, vScale = 8) {
    return cached('castlestone', scene, () => {
        const size = 512;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#7a7468';
        ctx.fillRect(0, 0, size, size);
        const bw = 64;
        const bh = 32;
        for (let y = 0, row = 0; y < size; y += bh, row++) {
            const ox = (row % 2) * (bw / 2);
            for (let x = -bw; x < size; x += bw) {
                const shade = 108 + hash2(x, y, 2) * 40;
                ctx.fillStyle = `rgb(${shade},${shade - 8},${shade - 18})`;
                ctx.globalAlpha = 1;
                ctx.fillRect(x + ox + 1, y + 1, bw - 2, bh - 2);
                ctx.strokeStyle = 'rgba(40,36,30,0.45)';
                ctx.strokeRect(x + ox + 1, y + 1, bw - 2, bh - 2);
            }
        }
        grain(ctx, size, size, 24, 11);
        return createBabylonDynamicTexture('tex_castlestone', el, scene, uScale, vScale);
    });
}

export function mossTexture(scene, uScale = 6, vScale = 6) {
    return cached('moss', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3a5a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = hash2(i, 1) > 0.5 ? '#4a7a32' : '#2a4a18';
            ctx.globalAlpha = 0.55;
            ctx.beginPath();
            ctx.arc(hash2(i, 2) * size, hash2(i, 3) * size, 2 + hash2(i, 4) * 6, 0, Math.PI * 2);
            ctx.fill();
        }
        grain(ctx, size, size, 20, 3);
        return createBabylonDynamicTexture('tex_moss', el, scene, uScale, vScale);
    });
}

export function grassTexture(scene, uScale = 14, vScale = 14) {
    return cached('grass', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#3d6a28';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 1100; i++) {
            const x = hash2(i, 2) * size;
            const y = hash2(i, 9) * size;
            ctx.strokeStyle = hash2(i, 4) > 0.5 ? '#5a8a38' : '#2a5218';
            ctx.globalAlpha = 0.5;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (hash2(i, 5) - 0.5) * 4, y - 6 - hash2(i, 6) * 8);
            ctx.stroke();
        }
        grain(ctx, size, size, 22, 3);
        return createBabylonDynamicTexture('tex_grass', el, scene, uScale, vScale);
    });
}

export function sandTexture(scene, uScale = 10, vScale = 10) {
    return cached('sand', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#cbb48a';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 42, 12);
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = 'rgba(160,130,80,0.25)';
            ctx.beginPath();
            ctx.moveTo(0, hash2(i, 1) * size);
            ctx.bezierCurveTo(80, hash2(i, 2) * size, 180, hash2(i, 3) * size, size, hash2(i, 4) * size);
            ctx.stroke();
        }
        return createBabylonDynamicTexture('tex_sand', el, scene, uScale, vScale);
    });
}

export function leatherTexture(scene, uScale = 2, vScale = 2) {
    return cached('leather', scene, () => {
        const size = 128;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 36, 7);
        return createBabylonDynamicTexture('tex_leather', el, scene, uScale, vScale);
    });
}

export function clothTexture(scene, uScale = 3, vScale = 3) {
    return cached('cloth', scene, () => {
        const size = 128;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#4a3a2a';
        ctx.fillRect(0, 0, size, size);
        for (let y = 0; y < size; y += 3) {
            ctx.fillStyle = y % 6 === 0 ? '#524232' : '#423222';
            ctx.fillRect(0, y, size, 1);
        }
        grain(ctx, size, size, 18, 2);
        return createBabylonDynamicTexture('tex_cloth', el, scene, uScale, vScale);
    });
}

export function rustTexture(scene, uScale = 2, vScale = 2) {
    return cached('rust', scene, () => {
        const size = 128;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#6a3a18';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 50, 15);
        return createBabylonDynamicTexture('tex_rust', el, scene, uScale, vScale);
    });
}

export function plasterTexture(scene, uScale = 3, vScale = 3) {
    return cached('plaster', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#c4b49a';
        ctx.fillRect(0, 0, size, size);
        grain(ctx, size, size, 28, 5);
        return createBabylonDynamicTexture('tex_plaster', el, scene, uScale, vScale);
    });
}

export function rugTexture(scene, uScale = 1, vScale = 1) {
    return cached('rug', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        ctx.fillStyle = '#1e3a7a';
        ctx.fillRect(0, 0, size, size);
        ctx.strokeStyle = '#c9a227';
        ctx.lineWidth = 8;
        ctx.strokeRect(16, 16, size - 32, size - 32);
        ctx.strokeRect(32, 32, size - 64, size - 64);
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = i % 2 ? '#2a4a8a' : '#16306a';
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, 20 + i * 10, 0, Math.PI * 2);
            ctx.stroke();
        }
        grain(ctx, size, size, 16, 1);
        return createBabylonDynamicTexture('tex_rug', el, scene, uScale, vScale);
    });
}

export function flagTexture(scene, color = '#6b1c1c') {
    return cached(`flag_${color}`, scene, () => {
        const el = createCanvas(128, 80);
        const ctx = el.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 128, 80);
        ctx.fillStyle = '#d4b45a';
        ctx.beginPath();
        ctx.moveTo(64, 18);
        ctx.lineTo(70, 36);
        ctx.lineTo(90, 36);
        ctx.lineTo(74, 48);
        ctx.lineTo(80, 66);
        ctx.lineTo(64, 54);
        ctx.lineTo(48, 66);
        ctx.lineTo(54, 48);
        ctx.lineTo(38, 36);
        ctx.lineTo(58, 36);
        ctx.closePath();
        ctx.fill();
        return createBabylonDynamicTexture(`tex_flag_${color}`, el, scene, 1, 1);
    });
}

export function waterNormalTexture(scene, uScale = 8, vScale = 8) {
    return cached('watern', scene, () => {
        const size = 256;
        const el = createCanvas(size);
        const ctx = el.getContext('2d');
        const img = ctx.createImageData(size, size);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const n1 = hash2(x * 0.08, y * 0.08, 1);
                const n2 = hash2(x * 0.2, y * 0.2, 4);
                const nx = (n1 - 0.5) * 0.6 + 0.5;
                const ny = (n2 - 0.5) * 0.6 + 0.5;
                const i = (y * size + x) * 4;
                img.data[i] = nx * 255;
                img.data[i + 1] = ny * 255;
                img.data[i + 2] = 255;
                img.data[i + 3] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
        return createBabylonDynamicTexture('tex_watern', el, scene, uScale, vScale);
    });
}

export function clearTextureCache() {
    for (const tex of cache.values()) {
        try { tex.dispose(); } catch { /* ignore */ }
    }
    cache.clear();
}
