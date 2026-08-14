/**
 * Texturas procedurais em canvas — areia, lâmina de kelp e rampa suave.
 */

function canvas(size, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    draw(ctx, size);
    return c;
}

export function sandTexture() {
    const c = canvas(256, (ctx, s) => {
        const g = ctx.createLinearGradient(0, 0, s, s);
        g.addColorStop(0, '#1a4a4a');
        g.addColorStop(0.45, '#2d6a62');
        g.addColorStop(1, '#163a42');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 1800; i++) {
            const x = Math.random() * s;
            const y = Math.random() * s;
            const a = 0.04 + Math.random() * 0.12;
            ctx.fillStyle = Math.random() > 0.5
                ? `rgba(180, 220, 200, ${a})`
                : `rgba(20, 40, 50, ${a})`;
            ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
        }
    });
    return c;
}

export function kelpTexture() {
    const c = canvas(64, (ctx, s) => {
        ctx.clearRect(0, 0, s, s);
        const g = ctx.createLinearGradient(0, 0, s, 0);
        g.addColorStop(0, 'rgba(10, 60, 50, 0)');
        g.addColorStop(0.25, 'rgba(18, 140, 96, 0.92)');
        g.addColorStop(0.5, 'rgba(80, 220, 160, 0.95)');
        g.addColorStop(0.75, 'rgba(20, 120, 90, 0.9)');
        g.addColorStop(1, 'rgba(10, 60, 50, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(8, 0, s - 16, s);
        ctx.fillStyle = 'rgba(180, 255, 210, 0.18)';
        ctx.fillRect(s * 0.42, 0, 3, s);
    });
    return c;
}

export function rockTexture() {
    const c = canvas(128, (ctx, s) => {
        ctx.fillStyle = '#1c3340';
        ctx.fillRect(0, 0, s, s);
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = `rgba(${20 + Math.random() * 50},${40 + Math.random() * 40},${50 + Math.random() * 40},${0.15 + Math.random() * 0.3})`;
            ctx.beginPath();
            ctx.arc(Math.random() * s, Math.random() * s, 2 + Math.random() * 8, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    return c;
}
