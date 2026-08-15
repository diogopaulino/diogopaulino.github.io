/**
 * Texturas procedurais em canvas para Rastro Vermelho em Babylon.js.
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

function noise2(x, y, seed = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

export function dirtTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#a87848';
    ctx.fillRect(0, 0, size, size);
    for (let i = 0; i < 120; i++) {
        const x = noise2(i, 2.1) * size;
        const y = noise2(i, 8.4) * size;
        const r = 16 + noise2(i, 3.3) * 40;
        ctx.fillStyle = 'rgba(140, 62, 28, 0.25)';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
    }
    return toBabylonTexture(el, scene, { uScale: 12, vScale: 12 });
}
