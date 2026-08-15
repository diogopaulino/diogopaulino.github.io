/**
 * Texturas procedurais PBR em canvas para Safari Dourado em Babylon.js.
 * Padrões de animais da savana (girafa, zebra, elefante, leão), casca de acácia e grama dourada.
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

export function zebraTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#f2efe9';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#1c1815';
    for (let x = 0; x < size; x += 32) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 15, size * 0.33, x - 15, size * 0.66, x + 8, size);
        ctx.lineTo(x + 22, size);
        ctx.bezierCurveTo(x - 2, size * 0.66, x + 28, size * 0.33, x + 14, 0);
        ctx.fill();
    }
    return toBabylonTexture(el, scene, { uScale: 2, vScale: 1 });
}

export function giraffeTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#dca85c';
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#7a3e18';
    for (let y = 16; y < size; y += 48) {
        for (let x = 16; x < size; x += 48) {
            const rx = x + (Math.random() - 0.5) * 8;
            const ry = y + (Math.random() - 0.5) * 8;
            ctx.beginPath();
            ctx.roundRect(rx, ry, 36, 36, [8, 12, 6, 10]);
            ctx.fill();
        }
    }
    return toBabylonTexture(el, scene, { uScale: 2, vScale: 2 });
}

export function savannaGrassTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#c49a48';
    ctx.fillRect(0, 0, size, size);

    const img = ctx.getImageData(0, 0, size, size);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const n = (Math.random() - 0.5) * 28;
        d[i] = Math.max(0, Math.min(255, d[i] + n));
        d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
        d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    }
    ctx.putImageData(img, 0, 0);
    return toBabylonTexture(el, scene, { uScale: 16, vScale: 16 });
}
