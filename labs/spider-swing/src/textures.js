/**
 * Texturas geradas em canvas: janelas, asfalto molhado, letreiros e pulsos.
 */

export function makeCanvas(size, draw, h = size) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    draw(ctx, size, h);
    return canvas;
}

export function canvasTexture(THREE, canvas, { repeatX = 1, repeatY = 1 } = {}) {
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function windowTexture(THREE, seed = 1) {
    const canvas = makeCanvas(256, (ctx, s) => {
        ctx.fillStyle = '#0a0d14';
        ctx.fillRect(0, 0, s, s);
        const cols = 7;
        const rows = 10;
        const padX = 6;
        const padY = 5;
        const bw = (s - padX * (cols + 1)) / cols;
        const bh = (s - padY * (rows + 1)) / rows;
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const n = Math.sin((x + 1.7) * (y + 3.1) * (seed + 2.2) * 12.9898) * 43758.5453;
                const r = n - Math.floor(n);
                const on = r > 0.28;
                if (!on) {
                    ctx.fillStyle = `rgb(${8 + (r * 8) | 0},${10 + (r * 8) | 0},${14})`;
                } else {
                    const warm = r > 0.62;
                    const shade = 200 + r * 55;
                    ctx.fillStyle = warm
                        ? `rgb(${shade | 0},${(shade * 0.78) | 0},${(shade * 0.42) | 0})`
                        : `rgb(${(shade * 0.62) | 0},${(shade * 0.78) | 0},${shade | 0})`;
                }
                ctx.fillRect(padX + x * (bw + padX), padY + y * (bh + padY), bw, bh * 0.82);
            }
        }
    });
    return canvasTexture(THREE, canvas, { repeatX: 1, repeatY: 2 });
}

export function facadeTexture(THREE) {
    const canvas = makeCanvas(128, (ctx, s) => {
        ctx.fillStyle = '#161922';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#1c212c';
        for (let y = 0; y < 8; y++) ctx.fillRect(0, y * 16, s, 1);
        ctx.fillStyle = '#0e1118';
        ctx.fillRect(0, 0, 3, s);
        ctx.fillRect(s - 3, 0, 3, s);
    });
    return canvasTexture(THREE, canvas, { repeatX: 2, repeatY: 8 });
}

export function asphaltTexture(THREE) {
    const canvas = makeCanvas(256, (ctx, s) => {
        ctx.fillStyle = '#14171e';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 900; i++) {
            const n = Math.random();
            ctx.fillStyle = `rgba(${20 + n * 40 | 0},${22 + n * 36 | 0},${28 + n * 40 | 0},${0.18})`;
            ctx.fillRect(Math.random() * s, Math.random() * s, 2, 2);
        }
        ctx.strokeStyle = 'rgba(220, 200, 140, 0.35)';
        ctx.lineWidth = 3;
        ctx.setLineDash([18, 16]);
        ctx.beginPath();
        ctx.moveTo(s / 2, 0);
        ctx.lineTo(s / 2, s);
        ctx.stroke();
    });
    return canvasTexture(THREE, canvas, { repeatX: 8, repeatY: 24 });
}

export function waterTexture(THREE) {
    const canvas = makeCanvas(256, (ctx, s) => {
        const g = ctx.createLinearGradient(0, 0, s, s);
        g.addColorStop(0, '#081018');
        g.addColorStop(0.5, '#0c1a28');
        g.addColorStop(1, '#071014');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(80, 140, 180, 0.12)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 18; i++) {
            ctx.beginPath();
            ctx.moveTo(0, i * 14 + 4);
            ctx.quadraticCurveTo(s * 0.5, i * 14 + (i % 2 ? 10 : -6), s, i * 14 + 4);
            ctx.stroke();
        }
    });
    return canvasTexture(THREE, canvas, { repeatX: 14, repeatY: 14 });
}

export function grassTexture(THREE) {
    const canvas = makeCanvas(128, (ctx, s) => {
        ctx.fillStyle = '#0c1810';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = `rgb(${10 + Math.random() * 20 | 0},${28 + Math.random() * 40 | 0},${16})`;
            ctx.fillRect(Math.random() * s, Math.random() * s, 2, 3);
        }
    });
    return canvasTexture(THREE, canvas, { repeatX: 8, repeatY: 12 });
}

export function billboardTexture(THREE, text, color, bg = '#12080c') {
    const canvas = makeCanvas(512, (ctx, w, h) => {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(8, 8, w - 16, h - 16);
        ctx.globalAlpha = 1;
        ctx.font = '700 92px "Bebas Neue", "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 28;
        ctx.fillStyle = color;
        ctx.fillText(text, w / 2, h / 2 + 6);
    }, 256);
    return canvasTexture(THREE, canvas);
}

export function sparkTexture(THREE) {
    const canvas = makeCanvas(64, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.28, 'rgba(255,210,160,0.9)');
        g.addColorStop(0.62, 'rgba(225,30,46,0.4)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
    });
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
}

export const SIGN_WORDS = [
    ['TIMES', '#ff3b4a'],
    ['SUBWAY', '#f4c15d'],
    ['PIZZA', '#ff7a3c'],
    ['DELI', '#ffe08a'],
    ['HOTEL', '#9ad0ff'],
    ['BANK', '#d0e4ff'],
    ['RADIO', '#ff5ad5'],
    ['NIGHT', '#ff2d55'],
    ['METRO', '#7ae0ff'],
    ['24H', '#fff2c8'],
    ['TAXI', '#ffd428'],
    ['COFFEE', '#e8b48a']
];
