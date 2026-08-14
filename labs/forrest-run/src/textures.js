/**
 * Texturas em canvas — xadrez da camisa, asfalto, terra, grama e pena.
 * Nada de arquivos externos: o lab precisa abrir offline além do three.js.
 */

function canvas(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    draw(ctx, size);
    return c;
}

export function plaidTexture(THREE) {
    const c = canvas(64, (ctx, s) => {
        ctx.fillStyle = '#3a5f9a';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#2a4a7a';
        for (let i = 0; i < s; i += 8) ctx.fillRect(i, 0, 3, s);
        ctx.fillStyle = '#c44';
        for (let i = 4; i < s; i += 16) ctx.fillRect(i, 0, 1.5, s);
        ctx.fillStyle = '#2a4a7a';
        for (let i = 0; i < s; i += 8) ctx.fillRect(0, i, s, 3);
        ctx.fillStyle = '#c44';
        for (let i = 4; i < s; i += 16) ctx.fillRect(0, i, s, 1.5);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        for (let i = 0; i < s; i += 8) {
            ctx.fillRect(i + 1, 0, 0.6, s);
            ctx.fillRect(0, i + 1, s, 0.6);
        }
    });
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2.4, 3.2);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
}

export function dirtTexture(THREE) {
    const c = canvas(128, (ctx, s) => {
        ctx.fillStyle = '#8a7348';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 900; i++) {
            const n = Math.random();
            ctx.fillStyle = `rgba(${90 + n * 80},${70 + n * 50},${40 + n * 30},${0.18 + n * 0.25})`;
            ctx.fillRect(Math.random() * s, Math.random() * s, 1 + n * 3, 1 + n * 2);
        }
        ctx.strokeStyle = 'rgba(60,40,20,0.18)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * s, 0);
            ctx.lineTo(Math.random() * s, s);
            ctx.stroke();
        }
    });
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function asphaltTexture(THREE) {
    const c = canvas(128, (ctx, s) => {
        ctx.fillStyle = '#3a3a3e';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 1400; i++) {
            const g = 40 + Math.random() * 50;
            ctx.fillStyle = `rgba(${g},${g},${g + 4},0.35)`;
            ctx.fillRect(Math.random() * s, Math.random() * s, 1, 1);
        }
    });
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function grassTexture(THREE) {
    const c = canvas(64, (ctx, s) => {
        ctx.fillStyle = '#4a7a30';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 400; i++) {
            ctx.strokeStyle = `rgba(${40 + Math.random() * 40},${90 + Math.random() * 80},30,0.45)`;
            const x = Math.random() * s;
            const y = Math.random() * s;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + (Math.random() - 0.5) * 3, y - 4 - Math.random() * 6);
            ctx.stroke();
        }
    });
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function barkTexture(THREE) {
    const c = canvas(32, (ctx, s) => {
        ctx.fillStyle = '#5a3a22';
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(30,16,8,0.45)';
        for (let x = 2; x < s; x += 5) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x + 1, s);
            ctx.stroke();
        }
    });
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function featherTexture(THREE) {
    const c = canvas(64, (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        const g = ctx.createRadialGradient(s * 0.5, s * 0.5, 2, s * 0.5, s * 0.5, s * 0.48);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.45, 'rgba(245,245,240,0.9)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        ctx.strokeStyle = 'rgba(210,210,200,0.5)';
        ctx.beginPath();
        ctx.moveTo(s * 0.5, 8);
        ctx.lineTo(s * 0.5, s - 8);
        ctx.stroke();
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function cloudTexture(THREE) {
    const c = canvas(128, (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        for (let i = 0; i < 7; i++) {
            const x = 24 + (i % 4) * 22;
            const y = 48 + (i % 3) * 12;
            const r = 18 + (i % 3) * 8;
            const g = ctx.createRadialGradient(x, y, 2, x, y, r);
            g.addColorStop(0, 'rgba(255,255,255,0.85)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function signTexture(THREE, title, sub) {
    const c = canvas(256, (ctx, s) => {
        ctx.fillStyle = '#1e4a28';
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = '#e8d8a8';
        ctx.fillRect(8, 8, s - 16, s - 16);
        ctx.fillStyle = '#1e4a28';
        ctx.fillRect(14, 14, s - 28, s - 28);
        ctx.fillStyle = '#f4ead0';
        ctx.font = 'bold 28px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText(title, s / 2, 110);
        ctx.font = '18px Georgia, serif';
        ctx.fillText(sub, s / 2, 150);
    });
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export function sparkTexture(THREE) {
    const c = canvas(32, (ctx, s) => {
        const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, 'rgba(255,230,180,0.7)');
        g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
    });
    return new THREE.CanvasTexture(c);
}
