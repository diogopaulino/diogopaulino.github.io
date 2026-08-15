/**
 * Texturas procedurais PBR em canvas para Aurelia Festival em Babylon.js.
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

export function coastalAsphaltTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#26282d';
    ctx.fillRect(0, 0, size, size);

    // Grânulos do asfalto
    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 30;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);

    // Linha central amarela da estrada costeira
    ctx.fillStyle = '#f5b020';
    ctx.fillRect(size * 0.48, 0, size * 0.04, size * 0.6);

    return toBabylonTexture(el, scene, { uScale: 2, vScale: 24 });
}

export function rimTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');

    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, size, size);

    // Raios da roda de liga leve
    ctx.strokeStyle = '#d0d6dc';
    ctx.lineWidth = 8;
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(size / 2, size / 2);
        ctx.lineTo(size / 2 + Math.cos(a) * size * 0.4, size / 2 + Math.sin(a) * size * 0.4);
        ctx.stroke();
    }

    ctx.strokeStyle = '#8a949e';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.4, 0, Math.PI * 2);
    ctx.stroke();

    return toBabylonTexture(el, scene);
}
