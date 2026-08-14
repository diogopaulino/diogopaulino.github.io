/**
 * Texturas geradas em canvas: areia, coral, pele da arraia e caústicas.
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
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function sandTexture(THREE) {
    const canvas = makeCanvas(256, (ctx, s) => {
        ctx.fillStyle = '#c4a574';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 1400; i++) {
            const n = Math.random();
            ctx.fillStyle = `rgba(${160 + n * 70 | 0},${120 + n * 50 | 0},${70 + n * 40 | 0},${0.35})`;
            ctx.fillRect(Math.random() * s, Math.random() * s, 2 + n * 3, 1 + n * 2);
        }
        ctx.fillStyle = 'rgba(80, 50, 30, 0.12)';
        for (let i = 0; i < 12; i++) {
            ctx.beginPath();
            ctx.ellipse(Math.random() * s, Math.random() * s, 8 + Math.random() * 18, 3, Math.random(), 0, Math.PI * 2);
            ctx.fill();
        }
    });
    return canvasTexture(THREE, canvas, { repeatX: 8, repeatY: 8 });
}

export function coralTexture(THREE, hue = 12) {
    const canvas = makeCanvas(128, (ctx, s) => {
        ctx.fillStyle = `hsl(${hue} 55% 48%)`;
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 80; i++) {
            ctx.fillStyle = `hsla(${hue + Math.random() * 20} 60% ${40 + Math.random() * 30}% / 0.5)`;
            ctx.beginPath();
            ctx.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 6, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    return canvasTexture(THREE, canvas, { repeatX: 2, repeatY: 2 });
}

export function mantaTexture(THREE) {
    const canvas = makeCanvas(256, (ctx, s) => {
        const g = ctx.createLinearGradient(0, 0, 0, s);
        g.addColorStop(0, '#0a2a3a');
        g.addColorStop(0.45, '#12384c');
        g.addColorStop(0.72, '#cfd8d4');
        g.addColorStop(1, '#eef4f0');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = 'rgba(240, 248, 255, 0.85)';
        for (let i = 0; i < 28; i++) {
            const x = 30 + Math.random() * 196;
            const y = 20 + Math.random() * 110;
            ctx.beginPath();
            ctx.ellipse(x, y, 3 + Math.random() * 7, 2 + Math.random() * 4, 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.fillStyle = 'rgba(20, 80, 90, 0.35)';
        ctx.fillRect(0, 0, s, 8);
    });
    const tex = canvasTexture(THREE, canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

export function causticTexture(THREE) {
    const canvas = makeCanvas(256, (ctx, s) => {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, s, s);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 40; i++) {
            ctx.strokeStyle = `rgba(140, 255, 240, ${0.08 + Math.random() * 0.12})`;
            ctx.lineWidth = 1 + Math.random() * 2;
            ctx.beginPath();
            const x = Math.random() * s;
            const y = Math.random() * s;
            ctx.moveTo(x, y);
            ctx.quadraticCurveTo(x + 40, y - 20, x + 80, y + 10);
            ctx.stroke();
        }
    });
    return canvasTexture(THREE, canvas, { repeatX: 4, repeatY: 4 });
}

export function skyTexture(THREE) {
    const canvas = makeCanvas(4, (ctx, s, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#7ec8d4');
        g.addColorStop(0.22, '#1a6a78');
        g.addColorStop(0.5, '#063044');
        g.addColorStop(1, '#010b12');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, h);
    }, 64);
    const tex = canvasTexture(THREE, canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
}
