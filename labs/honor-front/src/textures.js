/**
 * Texturas procedurais PBR em canvas para Honor Front em Babylon.js.
 * Aço escovado, nogueira de coronha, concreto de bunker, sacos de areia e metal oxidado.
 */

function canvas(size, height = size) {
    const el = document.createElement('canvas');
    el.width = size;
    el.height = height;
    return el;
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

export function gunMetalTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#22252a';
    ctx.fillRect(0, 0, size, size);

    // Arranhões e metal escovado
    for (let i = 0; i < 300; i++) {
        const y = Math.random() * size;
        ctx.strokeStyle = `rgba(180, 195, 210, ${0.05 + Math.random() * 0.08})`;
        ctx.lineWidth = 0.6 + Math.random();
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
    }
    return toBabylonTexture(el, scene);
}

export function gunWoodTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, size, 0);
    g.addColorStop(0, '#5a3218');
    g.addColorStop(0.5, '#422410');
    g.addColorStop(1, '#341a0a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);

    // Fibras da madeira
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * size;
        ctx.strokeStyle = `rgba(20, 10, 4, ${0.08 + Math.random() * 0.12})`;
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 10, size * 0.33, x - 10, size * 0.66, x + 5, size);
        ctx.stroke();
    }
    return toBabylonTexture(el, scene);
}

export function concreteTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#686c6e';
    ctx.fillRect(0, 0, size, size);

    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 35;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    return toBabylonTexture(el, scene, { uScale: 4, vScale: 4 });
}

export function sandTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#c8a872';
    ctx.fillRect(0, 0, size, size);

    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 22;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    return toBabylonTexture(el, scene, { uScale: 16, vScale: 16 });
}
