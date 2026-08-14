/**
 * Cenários em parallax: rua gótica sob chuva, metrô abandonado, catedral.
 * Desenha no espaço da câmera (camX em pixels de mundo).
 */

import { VW, VH, GROUND_Y, Z_MIN, Z_MAX, groundY } from './config.js';

function sky(ctx, c0, c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, c0);
    g.addColorStop(0.55, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);
}

function moon(ctx, x, y, r) {
    const glow = ctx.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
    glow.addColorStop(0, '#f4e8c888');
    glow.addColorStop(0.35, '#c8b87822');
    glow.addColorStop(1, '#0000');
    ctx.fillStyle = glow;
    ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    ctx.fillStyle = '#f2ead0';
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8d0b888';
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y + r * 0.1, r * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.3, y - r * 0.2, r * 0.16, 0, Math.PI * 2);
    ctx.fill();
}

function building(ctx, x, y, w, h, color, lit, time) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y - h, w, h);
    ctx.fillStyle = '#00000033';
    ctx.fillRect(x + w - 10, y - h, 10, h);
    const cols = Math.max(2, (w / 22) | 0);
    const rows = Math.max(3, (h / 28) | 0);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const on = ((c * 13 + r * 7 + ((x / 17) | 0)) % 5) !== 0;
            const flicker = on && lit && ((Math.sin(time * 0.01 + c + r) + 1) > 0.15);
            ctx.fillStyle = flicker ? (r % 3 === 0 ? '#e8c878cc' : '#f0d89acc') : '#1a142022';
            ctx.fillRect(x + 8 + c * 18, y - h + 10 + r * 24, 10, 12);
        }
    }
}

function neon(ctx, x, y, text, color, time) {
    const on = Math.sin(time * 0.08 + x) > -0.7;
    ctx.save();
    ctx.font = '700 22px Outfit, sans-serif';
    ctx.textAlign = 'left';
    if (on) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 16;
        ctx.fillStyle = color;
    } else {
        ctx.fillStyle = '#ffffff22';
    }
    ctx.fillText(text, x, y);
    ctx.restore();
}

function cobbles(ctx, camX, z0, z1) {
    const y0 = groundY(z0);
    const y1 = groundY(z1) + 80;
    const g = ctx.createLinearGradient(0, y0 - 30, 0, VH);
    g.addColorStop(0, '#2a2430');
    g.addColorStop(0.35, '#1c1822');
    g.addColorStop(1, '#100e14');
    ctx.fillStyle = g;
    ctx.fillRect(0, y0 - 36, VW, VH - (y0 - 36));

    ctx.strokeStyle = '#00000044';
    ctx.lineWidth = 1;
    for (let i = -2; i < 28; i++) {
        const x = ((i * 70 - camX * 0.9) % (VW + 80)) - 40;
        ctx.beginPath();
        ctx.moveTo(x, y0 - 10);
        ctx.lineTo(x - 40, VH);
        ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff08';
    for (let row = 0; row < 6; row++) {
        const y = y0 + 8 + row * 22;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(VW, y + 8);
        ctx.stroke();
    }

    ctx.fillStyle = '#0a0810aa';
    ctx.fillRect(0, y1, VW, 8);
}

function rain(ctx, camX, time) {
    ctx.save();
    ctx.strokeStyle = '#b8c8e055';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 90; i++) {
        const x = ((i * 97 + time * 6 - camX * 0.2) % (VW + 40)) - 20;
        const y = ((i * 53 + time * 14) % (VH + 30)) - 15;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y + 18);
        ctx.stroke();
    }
    ctx.restore();
}

function streetLamps(ctx, camX, time) {
    for (let i = 0; i < 10; i++) {
        const wx = i * 420 + 80;
        const x = wx - camX * 0.92;
        if (x < -40 || x > VW + 40) continue;
        const y = groundY(Z_MAX) - 8;
        ctx.fillStyle = '#1a161c';
        ctx.fillRect(x, y - 210, 8, 210);
        ctx.fillRect(x - 18, y - 214, 44, 8);
        const glow = ctx.createRadialGradient(x + 4, y - 200, 4, x + 4, y - 160, 90);
        const flick = 0.55 + Math.sin(time * 0.05 + i) * 0.08;
        glow.addColorStop(0, `rgba(255, 210, 140, ${0.55 * flick})`);
        glow.addColorStop(1, '#0000');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x + 4, y - 170, 90, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawStreet(ctx, camX, time) {
    sky(ctx, '#12101c', '#1c1830', '#2a2038');
    moon(ctx, 980 - camX * 0.04, 110, 44);

    ctx.fillStyle = '#0c0a14';
    for (let i = 0; i < 18; i++) {
        const x = i * 160 - (camX * 0.12) % 160 - 80;
        const h = 90 + (i % 5) * 28;
        ctx.fillRect(x, GROUND_Y - 220 - h, 150, h + 80);
        ctx.fillStyle = i % 3 === 0 ? '#14101c' : '#0c0a14';
    }

    for (let i = 0; i < 14; i++) {
        const x = i * 240 - (camX * 0.38) % 240 - 120;
        const h = 210 + (i % 4) * 50;
        const pal = i % 2 ? '#2a2238' : '#241c32';
        building(ctx, x, groundY(Z_MAX) - 20, 200, h, pal, true, time);
        if (i % 3 === 0) neon(ctx, x + 16, groundY(Z_MAX) - 24 - h + 36, i % 6 === 0 ? 'NOCTURNA' : 'BAR', i % 6 === 0 ? '#ff4d6d' : '#5ce1e6', time);
        if (i % 4 === 1) neon(ctx, x + 24, groundY(Z_MAX) - 10 - h + 70, '24H', '#f0c14a', time);
    }

    cobbles(ctx, camX, Z_MAX, Z_MIN);
    streetLamps(ctx, camX, time);

    ctx.fillStyle = '#1a1420';
    for (let i = 0; i < 8; i++) {
        const x = i * 640 - camX * 0.7;
        ctx.fillRect(x, groundY(Z_MAX) - 8, 18, 14);
        ctx.fillRect(x + 300, groundY(-20) + 40, 90, 12);
    }

    rain(ctx, camX, time);

    ctx.fillStyle = '#6ec0ff10';
    ctx.fillRect(0, 0, VW, VH);
}

function drawMetro(ctx, camX, time) {
    sky(ctx, '#121014', '#1c1816', '#241c18');
    ctx.fillStyle = '#2a2420';
    ctx.fillRect(0, 80, VW, groundY(Z_MAX) - 80);

    ctx.fillStyle = '#3a342e';
    for (let i = 0; i < 12; i++) {
        const x = i * 220 - (camX * 0.35) % 220 - 40;
        ctx.fillRect(x, 90, 28, groundY(Z_MAX) - 100);
        ctx.fillStyle = '#2a2420';
        ctx.fillRect(x + 6, 100, 16, groundY(Z_MAX) - 120);
        ctx.fillStyle = '#3a342e';
    }

    for (let i = 0; i < 20; i++) {
        const x = i * 90 - (camX * 0.2) % 90;
        const y = 110 + (i % 3) * 40;
        const flick = Math.sin(time * 0.03 + i) > 0.4;
        ctx.fillStyle = flick ? '#e8d09055' : '#00000033';
        ctx.fillRect(x, y, 22, 14);
    }

    ctx.fillStyle = '#1a1614';
    ctx.fillRect(0, groundY(Z_MAX) - 70, VW, 70);
    ctx.fillStyle = '#c8a050';
    ctx.fillRect(0, groundY(Z_MAX) - 74, VW, 4);

    for (let i = 0; i < 6; i++) {
        const x = i * 480 - camX * 0.45;
        ctx.fillStyle = '#2c2018';
        ctx.fillRect(x, groundY(Z_MAX) - 160, 200, 90);
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(x + 16, groundY(Z_MAX) - 148, 50, 50);
        ctx.fillRect(x + 80, groundY(Z_MAX) - 148, 50, 50);
        ctx.fillStyle = '#e05030';
        ctx.fillRect(x + 170, groundY(Z_MAX) - 150, 10, 10);
    }

    cobbles(ctx, camX, Z_MAX, Z_MIN);
    ctx.fillStyle = '#3a3028';
    ctx.fillRect(0, groundY(Z_MIN) + 36, VW, 16);
    ctx.fillStyle = '#1a1612';
    for (let i = 0; i < 16; i++) {
        const x = i * 90 - (camX * 0.95) % 90;
        ctx.fillRect(x, groundY(Z_MIN) + 40, 40, 8);
    }

    const flicker = 0.5 + Math.sin(time * 0.2) * 0.12;
    ctx.fillStyle = `rgba(255, 180, 90, ${0.06 * flicker})`;
    ctx.fillRect(0, 0, VW, VH);
}

function roseWindow(ctx, cx, cy, r, time) {
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, r);
    g.addColorStop(0, '#f0d080');
    g.addColorStop(0.35, '#c43b5a');
    g.addColorStop(0.7, '#3a3080');
    g.addColorStop(1, '#1a1030');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8c878';
    ctx.lineWidth = 3;
    ctx.stroke();
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + time * 0.0005;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        ctx.stroke();
    }
}

function drawCathedral(ctx, camX, time) {
    sky(ctx, '#100818', '#1c1028', '#2a1830');
    moon(ctx, 200 - camX * 0.03, 90, 36);

    ctx.fillStyle = '#1a1224';
    ctx.beginPath();
    ctx.moveTo(VW * 0.15 - camX * 0.08, GROUND_Y - 40);
    ctx.lineTo(VW * 0.5 - camX * 0.08, 40);
    ctx.lineTo(VW * 0.85 - camX * 0.08, GROUND_Y - 40);
    ctx.fill();

    roseWindow(ctx, VW * 0.5 - camX * 0.1, 210, 78, time);

    for (let i = 0; i < 8; i++) {
        const x = i * 280 - (camX * 0.4) % 280 - 40;
        ctx.fillStyle = '#2a2038';
        ctx.fillRect(x, 160, 36, groundY(Z_MAX) - 160);
        ctx.fillStyle = '#3a2c48';
        ctx.beginPath();
        ctx.moveTo(x - 10, 170);
        ctx.lineTo(x + 18, 120);
        ctx.lineTo(x + 46, 170);
        ctx.fill();
        const glass = ctx.createLinearGradient(x + 50, 180, x + 50, 360);
        glass.addColorStop(0, '#c44a6a99');
        glass.addColorStop(0.5, '#4a38a099');
        glass.addColorStop(1, '#e8c06066');
        ctx.fillStyle = glass;
        ctx.fillRect(x + 50, 190, 70, 160);
        ctx.strokeStyle = '#e8c87855';
        ctx.strokeRect(x + 50, 190, 70, 160);
    }

    cobbles(ctx, camX, Z_MAX, Z_MIN);

    ctx.fillStyle = '#1a1220';
    for (let i = 0; i < 10; i++) {
        const x = i * 200 - camX * 0.85;
        ctx.fillRect(x, groundY(Z_MAX) - 8, 24, 90);
        const flame = 8 + Math.sin(time * 0.15 + i) * 3;
        const fg = ctx.createRadialGradient(x + 12, groundY(Z_MAX) - 14, 1, x + 12, groundY(Z_MAX) - 14, 28);
        fg.addColorStop(0, '#ffe0a0cc');
        fg.addColorStop(1, '#0000');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(x + 12, groundY(Z_MAX) - 16, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffb040';
        ctx.beginPath();
        ctx.moveTo(x + 12, groundY(Z_MAX) - 10 - flame);
        ctx.lineTo(x + 8, groundY(Z_MAX) - 6);
        ctx.lineTo(x + 16, groundY(Z_MAX) - 6);
        ctx.fill();
        ctx.fillStyle = '#1a1220';
    }

    ctx.fillStyle = '#c43b5a12';
    ctx.fillRect(0, 0, VW, VH);
}

export function drawStage(ctx, stage, camX, time) {
    if (stage.id === 'metro') drawMetro(ctx, camX, time);
    else if (stage.id === 'cathedral') drawCathedral(ctx, camX, time);
    else drawStreet(ctx, camX, time);

    const y0 = groundY(Z_MAX);
    const y1 = groundY(Z_MIN);
    ctx.strokeStyle = '#ffffff10';
    ctx.setLineDash([6, 10]);
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(VW, y0);
    ctx.moveTo(0, y1 + 8);
    ctx.lineTo(VW, y1 + 8);
    ctx.stroke();
    ctx.setLineDash([]);
}

export { rain };
