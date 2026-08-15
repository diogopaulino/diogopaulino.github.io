/**
 * Texturas procedurais em canvas para F1 Grand Prix em Babylon.js.
 * Fibra de carbono, asfalto PBR, zebras (curbs), borracha de pneu e pintura automotiva.
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

export function carbonTexture(scene) {
    const size = 128;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#111215';
    ctx.fillRect(0, 0, size, size);

    // Trama 2x2 sarja de carbono
    const s = 8;
    for (let y = 0; y < size; y += s) {
        for (let x = 0; x < size; x += s) {
            const pattern = ((x / s) + (y / s)) % 2 === 0;
            ctx.fillStyle = pattern ? '#1c1e24' : '#14161b';
            ctx.fillRect(x, y, s, s);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.fillRect(x, y, s / 2, s / 2);
        }
    }
    return toBabylonTexture(el, scene, { uScale: 6, vScale: 6 });
}

export function asphaltTexture(scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');
    ctx.fillStyle = '#222326';
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

    // Borracha da linha ideal
    ctx.fillStyle = 'rgba(10, 10, 12, 0.25)';
    ctx.fillRect(size * 0.2, 0, size * 0.6, size);

    return toBabylonTexture(el, scene, { uScale: 4, vScale: 40 });
}

export function curbTexture(scene) {
    const size = 128;
    const el = canvas(size);
    const ctx = el.getContext('2d');

    const s = 32;
    for (let y = 0; y < size; y += s) {
        ctx.fillStyle = ((y / s) % 2 === 0) ? '#e61919' : '#f0f0f0';
        ctx.fillRect(0, y, size, s);
    }
    return toBabylonTexture(el, scene, { uScale: 1, vScale: 8 });
}

export function tireSidewallTexture(compound = 'soft', scene) {
    const size = 256;
    const el = canvas(size);
    const ctx = el.getContext('2d');

    ctx.fillStyle = '#18191c';
    ctx.fillRect(0, 0, size, size);

    const colors = {
        soft: '#e10600',
        medium: '#ffd700',
        hard: '#f0f0f0',
        wet: '#0088ff'
    };
    const col = colors[compound] || colors.soft;

    ctx.strokeStyle = col;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.38, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = col;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P ZERO', size / 2, size * 0.2);
    ctx.fillText('F1', size / 2, size * 0.8);

    return toBabylonTexture(el, scene);
}
