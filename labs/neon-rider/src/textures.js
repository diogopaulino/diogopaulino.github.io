/**
 * Texturas geradas em canvas: janelas de prédios, placas néon, asfalto e sprites.
 * Nada de assets externos — o lab continua autocontido.
 */

export function makeCanvas(size, draw) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    draw(ctx, size);
    return canvas;
}

export function canvasTexture(THREE, canvas, { repeatX = 1, repeatY = 1, colorSpace } = {}) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    if (colorSpace && THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function windowTexture(THREE) {
    const canvas = makeCanvas(256, (ctx, s) => {
        ctx.fillStyle = '#07060d';
        ctx.fillRect(0, 0, s, s);
        const cols = 6;
        const rows = 8;
        const pad = 8;
        const bw = (s - pad * (cols + 1)) / cols;
        const bh = (s - pad * (rows + 1)) / rows;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const on = Math.random() > 0.28;
                const shade = on ? 180 + Math.random() * 75 : 18 + Math.random() * 14;
                const r = shade;
                const g = shade * (0.72 + Math.random() * 0.2);
                const b = shade * (0.55 + Math.random() * 0.25);
                ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
                ctx.fillRect(pad + x * (bw + pad), pad + y * (bh + pad), bw, bh);
            }
        }
    });
    return canvasTexture(THREE, canvas, { repeatX: 1, repeatY: 2 });
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

export const SIGN_WORDS = [
    'ARCADE', 'VIDEO', 'HOTEL', 'DISCO', 'SUSHI', 'RADIO', 'PIZZA',
    'KARAOKE', 'CINEMA', 'BAR', 'TAXI', 'LASER', 'PIXEL', 'WALKMAN',
    'CASSETTE', 'NIGHT', '24H', 'BOWL', 'DINER', 'CLUB'
];
