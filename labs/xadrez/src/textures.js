/**
 * Texturas PBR procedurais — madeira, marfim, ébano, feltro e mármore para Babylon.js.
 * Sem arquivos externos: cada mapa é gerado em canvas e instanciado como BABYLON.Texture.
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
    const url = el.toDataURL('image/png');
    const tex = new BABYLON.Texture(url, scene, false, false);
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

function pack(scene, draw, { w = 512, strength = 1.8, roughBase = 0.32, roughContrast = 0.22, repeat = [1, 1] } = {}) {
    const el = canvas(w);
    const ctx = ctx2d(el);
    draw(ctx, w);
    const n = heightToNormal(ctx, w, w, strength);
    const r = roughnessFrom(ctx, w, w, roughBase, roughContrast);
    return {
        map: toBabylonTexture(el, scene, { uScale: repeat[0], vScale: repeat[1] }),
        normalMap: toBabylonTexture(n, scene, { uScale: repeat[0], vScale: repeat[1] }),
        roughnessMap: toBabylonTexture(r, scene, { uScale: repeat[0], vScale: repeat[1] })
    };
}

function grain(ctx, w, rand, colorA, colorB, bands = 28) {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= bands; i++) {
        const t = i / bands;
        const wobble = (rand() - 0.5) * 0.08;
        g.addColorStop(Math.min(1, Math.max(0, t + wobble)), rand() > 0.5 ? colorA : colorB);
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    for (let i = 0; i < w * 1.5; i++) {
        const x = rand() * w;
        ctx.strokeStyle = `rgba(0,0,0,${0.008 + rand() * 0.016})`;
        ctx.lineWidth = 0.6 + rand();
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + (rand() - 0.5) * 18, w * 0.33, x + (rand() - 0.5) * 18, w * 0.66, x + (rand() - 0.5) * 10, w);
        ctx.stroke();
    }
}

export function createTextures(scene) {
    const maple = pack(scene, (ctx, w) => {
        grain(ctx, w, rng(11), '#d8c9ac', '#c7b795', 22);
    }, { repeat: [1, 1], roughBase: 0.28, strength: 1.4 });

    const walnut = pack(scene, (ctx, w) => {
        grain(ctx, w, rng(29), '#735744', '#604936', 18);
    }, { repeat: [1, 1], roughBase: 0.34, strength: 1.6 });

    const mahogany = pack(scene, (ctx, w) => {
        grain(ctx, w, rng(71), '#554033', '#48392e', 16);
    }, { repeat: [3, 3], roughBase: 0.22, strength: 1.2 });

    const ebony = pack(scene, (ctx, w) => {
        const rand = rng(101);
        ctx.fillStyle = '#1a120f';
        ctx.fillRect(0, 0, w, w);
        grain(ctx, w, rand, '#241610', '#0e0a08', 12);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#4a2818';
        for (let i = 0; i < 40; i++) {
            ctx.fillRect(rand() * w, 0, 1 + rand() * 2, w);
        }
        ctx.globalAlpha = 1;
    }, { repeat: [2, 2], roughBase: 0.18, roughContrast: 0.15, strength: 1.1 });

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
    }, { repeat: [2, 2], roughBase: 0.28, strength: 0.8 });

    const felt = pack(scene, (ctx, w) => {
        const rand = rng(7);
        ctx.fillStyle = '#1e6840';
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
    }, { repeat: [4, 4], roughBase: 0.95, strength: 0.4 });

    const marble = pack(scene, (ctx, w) => {
        const rand = rng(88);
        // Pedra grafite: o salão deve enquadrar a mesa sem competir com as
        // casas claras. As veias continuam legíveis mesmo em qualidade baixa.
        ctx.fillStyle = '#30363a';
        ctx.fillRect(0, 0, w, w);
        for (let v = 0; v < 14; v++) {
            ctx.strokeStyle = `rgba(190,185,174,${0.08 + rand() * 0.10})`;
            ctx.lineWidth = 1 + rand() * 3.5;
            ctx.beginPath();
            let x = rand() * w;
            let y = rand() * w;
            ctx.moveTo(x, y);
            for (let step = 0; step < 5; step++) {
                x += (rand() - 0.5) * 160;
                y += (rand() - 0.5) * 160;
                ctx.lineTo(x, y);
            }
            ctx.stroke();
        }
    }, { repeat: [2, 2], roughBase: 0.12, strength: 0.6 });

    const photographed = {
        map: new window.BABYLON.Texture(new URL('../assets/wood.jpg', import.meta.url).href, scene),
        normalMap: new window.BABYLON.Texture(new URL('../assets/wood-normal.jpg', import.meta.url).href, scene),
        roughnessMap: new window.BABYLON.Texture(new URL('../assets/wood-roughness.jpg', import.meta.url).href, scene)
    };
    photographed.normalMap.gammaSpace = false;
    photographed.normalMap.level = 0.25;
    photographed.roughnessMap.gammaSpace = false;
    return { maple, walnut, mahogany: photographed, ebony, ivory, felt, marble };
}
