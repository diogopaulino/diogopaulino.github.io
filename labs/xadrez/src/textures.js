/**
 * Texturas PBR procedurais — madeira, marfim, ébano, feltro e mármore para Babylon.js.
 * Mapas locais de madeira fotografada e microtexturas determinísticas em canvas.
 */

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

function toBabylonTexture(el, scene, { uScale = 1, vScale = 1 } = {}) {
    const BABYLON = window.BABYLON;
    if (!BABYLON) return null;
    // Upload direto: evita codificar e decodificar dezenas de PNGs no boot.
    const tex = new BABYLON.DynamicTexture('surface', el, scene, true,
        BABYLON.Texture.TRILINEAR_SAMPLINGMODE);
    tex.update(false);
    tex.uScale = uScale;
    tex.vScale = vScale;
    tex.wrapU = BABYLON.Texture.WRAP_ADDRESSMODE;
    tex.wrapV = BABYLON.Texture.WRAP_ADDRESSMODE;
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

function roughnessFrom(srcCtx, w, h, base = 0.35, contrast = 0.25) {
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

function pack(scene, draw, { w = 512, strength = 1.8, roughBase = 0.32, roughContrast = 0.22, repeat = [1, 1], roughness = false } = {}) {
    const el = canvas(w);
    const ctx = ctx2d(el);
    draw(ctx, w);
    const n = heightToNormal(ctx, w, w, strength);
    const r = roughness ? roughnessFrom(ctx, w, w, roughBase, roughContrast) : null;
    const maps = {
        map: toBabylonTexture(el, scene, { uScale: repeat[0], vScale: repeat[1] }),
        normalMap: toBabylonTexture(n, scene, { uScale: repeat[0], vScale: repeat[1] }),
        roughnessMap: r ? toBabylonTexture(r, scene, { uScale: repeat[0], vScale: repeat[1] }) : null
    };
    maps.normalMap.gammaSpace = false;
    maps.normalMap.level = 0.2;
    if (maps.roughnessMap) maps.roughnessMap.gammaSpace = false;
    return maps;
}

function grain(ctx, w, rand, colorA, colorB, bands = 28) {
    const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    const a = rgb(colorA), b = rgb(colorB);
    const image = ctx.createImageData(w, w);
    // Veios longos com poros finos, sem os degraus de um gradiente em faixas.
    for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
        const warp = x + 3 * Math.sin(y / w * Math.PI * 2) + Math.sin(y / w * Math.PI * 6);
        const vein = Math.sin(warp / w * Math.PI * bands * 2);
        const pore = Math.pow(Math.abs(Math.sin(warp * 1.31)), 24) * 3;
        const mix = 0.5 + vein * 0.16 + Math.sin(warp * 0.17) * 0.1;
        const noise = (rand() - 0.5) * 3 - pore;
        const i = (y * w + x) * 4;
        for (let c = 0; c < 3; c++) image.data[i + c] = a[c] * mix + b[c] * (1 - mix) + noise;
        image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
}

export function createTextures(scene) {
    const maple = pack(scene, (ctx, w) => {
        grain(ctx, w, rng(11), '#d8c9ac', '#c7b795', 22);
    }, { repeat: [1, 1], roughBase: 0.76, strength: 0.4 });

    const walnut = pack(scene, (ctx, w) => {
        grain(ctx, w, rng(29), '#735744', '#604936', 18);
    }, { repeat: [1, 1], roughBase: 0.8, strength: 0.5 });

    const ebony = pack(scene, (ctx, w) => {
        const rand = rng(101);
        ctx.fillStyle = '#1a120f';
        ctx.fillRect(0, 0, w, w);
        grain(ctx, w, rand, '#38322c', '#24221f', 12);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#4a2818';
        for (let i = 0; i < 40; i++) {
            ctx.fillRect(rand() * w, 0, 1 + rand() * 2, w);
        }
        ctx.globalAlpha = 1;
    }, { w: 256, roughness: true, repeat: [1, 1], roughBase: 0.72, roughContrast: 0.08, strength: 0.3 });

    const ivory = pack(scene, (ctx, w) => {
        const rand = rng(53);
        const g = ctx.createLinearGradient(0, 0, w, w);
        g.addColorStop(0, '#eadcc4');
        g.addColorStop(0.45, '#e2d0b4');
        g.addColorStop(1, '#d4c09a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, w);
        ctx.strokeStyle = 'rgba(160,130,90,0.18)';
        for (let i = 0; i < 18; i++) {
            ctx.lineWidth = 0.8 + rand();
            ctx.beginPath();
            const y = rand() * w;
            ctx.moveTo(0, y);
            ctx.bezierCurveTo(w * 0.3, y + (rand() - 0.5) * 40, w * 0.7, y + (rand() - 0.5) * 40, w, y + (rand() - 0.5) * 20);
            ctx.stroke();
        }
    }, { w: 256, roughness: true, repeat: [1, 1], roughBase: 0.8, strength: 0.2 });

    const felt = pack(scene, (ctx, w) => {
        const rand = rng(7);
        ctx.fillStyle = '#85817a';
        ctx.fillRect(0, 0, w, w);
        const img = ctx.getImageData(0, 0, w, w);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
            const noise = (rand() - 0.5) * 26;
            d[i] = Math.max(0, Math.min(255, d[i] + noise));
            d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + noise));
            d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + noise));
        }
        ctx.putImageData(img, 0, 0);
    }, { w: 256, repeat: [4, 4], roughBase: 0.95, strength: 0.4 });

    const photographed = {
        map: new window.BABYLON.Texture(new URL('../assets/wood.jpg', import.meta.url).href, scene),
        normalMap: new window.BABYLON.Texture(new URL('../assets/wood-normal.jpg', import.meta.url).href, scene)
    };
    photographed.normalMap.gammaSpace = false;
    photographed.normalMap.level = 0.25;
    return { maple, walnut, mahogany: photographed, ebony, ivory, felt };
}
