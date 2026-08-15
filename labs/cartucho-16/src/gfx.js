/**
 * Render 16-bit: fonte bitmap, tiles, sprites procedurais, parallax e HUD SNES.
 * Tudo pixel-aligned. Paleta por mundo em config.PALETTES.
 */

import { VIEW_W, VIEW_H, PALETTES, PLAYER } from './config.js';

const FONT5 = {
    ' ': [],
    '0': ['111', '101', '101', '101', '111'],
    '1': ['010', '110', '010', '010', '111'],
    '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '111', '001', '111'],
    '4': ['101', '101', '111', '001', '001'],
    '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'],
    '7': ['111', '001', '010', '010', '010'],
    '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'],
    A: ['010', '101', '111', '101', '101'],
    B: ['110', '101', '110', '101', '110'],
    C: ['011', '100', '100', '100', '011'],
    D: ['110', '101', '101', '101', '110'],
    E: ['111', '100', '110', '100', '111'],
    F: ['111', '100', '110', '100', '100'],
    G: ['011', '100', '101', '101', '011'],
    H: ['101', '101', '111', '101', '101'],
    I: ['111', '010', '010', '010', '111'],
    J: ['001', '001', '001', '101', '010'],
    K: ['101', '101', '110', '101', '101'],
    L: ['100', '100', '100', '100', '111'],
    M: ['101', '111', '111', '101', '101'],
    N: ['101', '111', '111', '111', '101'],
    O: ['010', '101', '101', '101', '010'],
    P: ['110', '101', '110', '100', '100'],
    Q: ['010', '101', '101', '111', '011'],
    R: ['110', '101', '110', '101', '101'],
    S: ['011', '100', '010', '001', '110'],
    T: ['111', '010', '010', '010', '010'],
    U: ['101', '101', '101', '101', '010'],
    V: ['101', '101', '101', '010', '010'],
    W: ['101', '101', '111', '111', '101'],
    X: ['101', '101', '010', '101', '101'],
    Y: ['101', '101', '010', '010', '010'],
    Z: ['111', '001', '010', '100', '111'],
    '-': ['000', '000', '111', '000', '000'],
    '.': ['000', '000', '000', '000', '010'],
    ':': ['000', '010', '000', '010', '000'],
    '!': ['010', '010', '010', '000', '010'],
    '?': ['110', '001', '010', '000', '010'],
    '*': ['101', '010', '111', '010', '101'],
    '/': ['001', '001', '010', '100', '100'],
    '+': ['000', '010', '111', '010', '000'],
    '×': ['101', '010', '000', '010', '101'],
    '·': ['000', '000', '010', '000', '000'],
};

export function p(ctx, x, y, w, h, c) {
    ctx.fillStyle = c;
    ctx.fillRect(x | 0, y | 0, w, h);
}

export function text(ctx, str, x, y, color = '#f8f8f8', scale = 1, shadow = '#101018') {
    const s = String(str).toUpperCase();
    let ox = x | 0;
    const oy = y | 0;
    for (const ch of s) {
        const g = FONT5[ch] || FONT5['?'];
        if (shadow) {
            for (let row = 0; row < 5; row++) {
                const line = g[row] || '';
                for (let col = 0; col < 3; col++) {
                    if (line[col] === '1') p(ctx, ox + (col + 1) * scale, oy + (row + 1) * scale, scale, scale, shadow);
                }
            }
        }
        for (let row = 0; row < 5; row++) {
            const line = g[row] || '';
            for (let col = 0; col < 3; col++) {
                if (line[col] === '1') p(ctx, ox + col * scale, oy + row * scale, scale, scale, color);
            }
        }
        ox += 4 * scale;
    }
}

export function textWidth(str, scale = 1) {
    return String(str).length * 4 * scale;
}

export function centerText(ctx, str, y, color, scale = 1) {
    const w = textWidth(str, scale);
    text(ctx, str, ((VIEW_W - w) / 2) | 0, y, color, scale);
}

function pal(world) {
    return PALETTES[world] || PALETTES.pradaria;
}

export function drawSky(ctx, worldId, camX, t) {
    const pal = PALETTES[worldId] || PALETTES.pradaria;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, pal.skyTop);
    g.addColorStop(1, pal.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (worldId === 'templo' || worldId === 'castelo' || worldId === 'nucleo' || worldId === 'cidadela') {
        for (let i = 0; i < 28; i++) {
            const sx = ((i * 47 + (t * 0.2) | 0) % (VIEW_W + 10)) - 5;
            const sy = (i * 17) % 90;
            p(ctx, sx, sy, i % 3 === 0 ? 2 : 1, 1, i % 4 === 0 ? '#fff8c8' : '#d0d8f8');
        }
    }

    if (worldId === 'castelo') {
        p(ctx, 200, 18, 28, 28, '#e8d090');
        p(ctx, 204, 22, 20, 20, '#c8b070');
        p(ctx, 190, 24, 8, 8, pal.skyTop);
    } else if (worldId === 'pradaria' || worldId === 'loop') {
        p(ctx, 210, 16, 22, 22, '#ffe878');
        p(ctx, 214, 20, 14, 14, '#fff0a8');
    }

    const parallax = (camX * 0.18) | 0;
    for (let i = 0; i < 6; i++) {
        const cx = ((i * 90 - parallax) % (VIEW_W + 80)) - 40;
        const cy = 28 + (i % 3) * 10;
        drawCloud(ctx, cx, cy, pal.cloud);
    }

    const hPar = (camX * 0.42) | 0;
    ctx.fillStyle = pal.hillDark;
    for (let i = -1; i < 8; i++) {
        const hx = i * 70 - (hPar % 70);
        ctx.beginPath();
        ctx.moveTo(hx, 140);
        ctx.lineTo(hx + 36, 92 + (i % 3) * 8);
        ctx.lineTo(hx + 72, 140);
        ctx.fill();
    }
    ctx.fillStyle = pal.hill;
    for (let i = -1; i < 8; i++) {
        const hx = i * 56 - ((camX * 0.55) | 0) % 56;
        ctx.beginPath();
        ctx.moveTo(hx, 158);
        ctx.lineTo(hx + 28, 118 + (i % 2) * 10);
        ctx.lineTo(hx + 56, 158);
        ctx.fill();
    }

    if (worldId === 'cidadela') {
        ctx.fillStyle = pal.hillDark;
        const bx = -((camX * 0.5) | 0) % 48;
        for (let x = bx; x < VIEW_W + 20; x += 48) {
            p(ctx, x + 8, 100, 18, 60, pal.hillDark);
            p(ctx, x + 12, 108, 4, 6, pal.accent);
            p(ctx, x + 20, 118, 4, 6, pal.coin);
        }
    }
}

function drawCloud(ctx, x, y, c) {
    p(ctx, x + 8, y, 18, 8, c);
    p(ctx, x + 4, y + 4, 28, 8, c);
    p(ctx, x + 10, y + 2, 10, 6, '#ffffff');
}

export function drawTile(ctx, ch, tx, ty, worldId, tick, extras = {}) {
    const pal = PALETTES[worldId] || PALETTES.pradaria;
    const x = tx | 0;
    const y = ty | 0;

    if (ch === '#' || ch === 'H') {
        p(ctx, x, y, 16, 16, pal.ground);
        p(ctx, x, y, 16, 4, pal.groundTop);
        p(ctx, x, y + 4, 16, 1, pal.hillDark);
        p(ctx, x + 2, y + 8, 3, 2, pal.brickDark);
        p(ctx, x + 9, y + 11, 4, 2, pal.brickDark);
        if (ch === 'H') p(ctx, x, y, 16, 16, pal.brick);
    } else if (ch === '=') {
        p(ctx, x, y, 16, 5, pal.brick);
        p(ctx, x, y, 16, 2, pal.groundTop);
        p(ctx, x + 1, y + 2, 14, 1, pal.brickDark);
    } else if (ch === '?' || ch === 'E') {
        const bounce = extras.bounce || 0;
        const yy = y - bounce;
        const live = ch === '?';
        p(ctx, x, yy, 16, 16, live ? '#e09020' : '#908070');
        p(ctx, x + 1, yy + 1, 14, 14, live ? '#f8c030' : '#b0a090');
        p(ctx, x + 2, yy + 2, 12, 2, '#fff0c0');
        if (live) {
            const blink = ((tick / 12) | 0) % 2 === 0;
            text(ctx, '?', x + 5, yy + 5, blink ? '#fff8e0' : '#c06010', 1, null);
        } else {
            p(ctx, x + 6, yy + 6, 4, 4, '#706050');
        }
    } else if (ch === 'B') {
        p(ctx, x, y, 16, 16, pal.brick);
        p(ctx, x + 1, y + 1, 6, 6, pal.brickDark);
        p(ctx, x + 9, y + 1, 6, 6, pal.brickDark);
        p(ctx, x + 1, y + 9, 6, 6, pal.brickDark);
        p(ctx, x + 9, y + 9, 6, 6, pal.brickDark);
        p(ctx, x, y, 16, 1, pal.groundTop);
    } else if (ch === 'p' || ch === 'i') {
        p(ctx, x, y, 16, 16, pal.pipe);
        p(ctx, x + 2, y, 12, 16, pal.pipeDark);
        p(ctx, x, y, 16, 3, pal.pipe);
        p(ctx, x + 1, y + 1, 2, 14, '#98e070');
    } else if (ch === '!') {
        p(ctx, x + 2, y + 8, 12, 8, pal.ground);
        p(ctx, x + 3, y + 2, 3, 10, '#d0d0d8');
        p(ctx, x + 7, y + 0, 3, 12, '#f0f0f8');
        p(ctx, x + 11, y + 3, 3, 9, '#d0d0d8');
        p(ctx, x + 3, y + 2, 3, 2, '#fff');
    } else if (ch === '|') {
        p(ctx, x + 6, y, 4, 16, '#c8a050');
        p(ctx, x + 3, y + 2, 10, 2, '#a08038');
        p(ctx, x + 3, y + 10, 10, 2, '#a08038');
    } else if (ch === '>') {
        p(ctx, x, y + 10, 16, 6, pal.accent);
        p(ctx, x + 2, y + 4, 8, 8, pal.coin);
        p(ctx, x + 8, y + 6, 6, 4, pal.coin);
    } else if (ch === '~') {
        const w = ((tick / 6) | 0) % 4;
        p(ctx, x, y, 16, 16, pal.water);
        p(ctx, x, y + w, 16, 2, '#a8e8ff');
        p(ctx, x, y + 8, 16, 8, pal.hillDark);
    }
}

export function drawLeo(ctx, x, y, state) {
    const { facing, frame, blink, attack, star, spin, dash, hurt } = state;
    ctx.save();
    ctx.translate(x | 0, y | 0);
    if (facing < 0) {
        ctx.translate(12, 0);
        ctx.scale(-1, 1);
    }
    if (hurt && ((frame / 2) | 0) % 2 === 0) {
        ctx.restore();
        return;
    }
    const bob = state.grounded ? ((frame / 10) | 0) % 2 : 0;
    const run = state.running ? ((frame / 5) | 0) % 4 : 0;
    const leg = run === 1 || run === 3 ? 1 : 0;
    const cap = star ? ((frame / 4) | 0) % 2 === 0 ? '#f8f838' : '#f830f8' : '#e02838';
    const jacket = star ? '#40f0f8' : '#28b8e0';
    const pants = '#203060';

    if (spin) {
        const ang = (frame * 0.6) % (Math.PI * 2);
        ctx.translate(6, 8);
        ctx.rotate(ang);
        ctx.translate(-6, -8);
        p(ctx, 2, 4, 10, 10, jacket);
        p(ctx, 4, 6, 6, 6, cap);
        ctx.restore();
        return;
    }

    p(ctx, 2, 0 + bob, 8, 3, cap);
    p(ctx, 1, 1 + bob, 10, 2, cap);
    p(ctx, 9, 0 + bob, 3, 2, cap);
    p(ctx, 3, 3 + bob, 7, 5, '#f0c090');
    p(ctx, 4, 4 + bob, 2, 2, '#201818');
    p(ctx, 8, 4 + bob, 1, 2, '#201818');
    p(ctx, 6, 6 + bob, 2, 1, '#c07060');
    p(ctx, 2, 8 + bob, 8, 6, jacket);
    p(ctx, 1, 9 + bob, 2, 4, jacket);
    p(ctx, 9, 9 + bob, 2, 4, jacket);
    p(ctx, 4, 9 + bob, 4, 3, '#f8e0a0');
    p(ctx, 3, 13 + bob, 3, 3, pants);
    p(ctx, 7, 13 + bob, 3, 3, pants);
    if (state.grounded) {
        p(ctx, 2 + leg, 15, 4, 2, '#e03830');
        p(ctx, 7 - leg, 15, 4, 2, '#e03830');
    } else {
        p(ctx, 1, 15, 4, 2, '#e03830');
        p(ctx, 8, 14, 4, 2, '#e03830');
    }
    if (attack) {
        p(ctx, 11, 8, 8, 3, '#e8e8f0');
        p(ctx, 17, 7, 3, 5, '#f8f8ff');
        p(ctx, 11, 9, 9, 1, '#a0a0c0');
    }
    if (dash) p(ctx, -4, 8, 4, 2, '#c0f0ff');
    ctx.restore();
}

export function drawWalker(ctx, x, y, worldId, frame, squish) {
    const pal = PALETTES[worldId] || PALETTES.pradaria;
    const h = squish ? 8 : 14;
    const oy = squish ? 6 : 0;
    if (worldId === 'loop') {
        p(ctx, x + 1, y + 4 + oy, 14, h - 2, '#1860c8');
        p(ctx, x + 3, y + 6 + oy, 4, 3, '#f8e020');
        p(ctx, x + 9, y + 6 + oy, 4, 3, '#f8e020');
        p(ctx, x + 2, y + 12 + oy, 4, 3, '#202028');
        p(ctx, x + 10, y + 12 + oy, 4, 3, '#202028');
    } else if (worldId === 'cidadela') {
        p(ctx, x + 2, y + 2 + oy, 12, h, '#90a8c0');
        p(ctx, x + 4, y + 4 + oy, 8, 4, pal.accent);
        p(ctx, x + 5, y + 10 + oy, 2, 4, '#e03820');
        p(ctx, x + 9, y + 10 + oy, 2, 4, '#e03820');
    } else if (worldId === 'castelo') {
        p(ctx, x + 3, y + oy, 10, 8, '#e8e0d0');
        p(ctx, x + 4, y + 8 + oy, 8, 6, '#a03040');
        p(ctx, x + 5, y + 3 + oy, 2, 2, '#201018');
        p(ctx, x + 9, y + 3 + oy, 2, 2, '#201018');
    } else if (worldId === 'templo') {
        p(ctx, x + 2, y + oy, 12, 6, '#705828');
        p(ctx, x + 4, y + 6 + oy, 8, 8, '#c0a060');
        p(ctx, x + 5, y + 3 + oy, 2, 2, '#201808');
        p(ctx, x + 9, y + 3 + oy, 2, 2, '#201808');
    } else {
        p(ctx, x + 2, y + 4 + oy, 12, h - 2, '#b07028');
        p(ctx, x + 4, y + 2 + oy, 8, 6, '#e09040');
        p(ctx, x + 5, y + 6 + oy, 2, 2, '#201808');
        p(ctx, x + 9, y + 6 + oy, 2, 2, '#201808');
        p(ctx, x + 6, y + 9 + oy, 4, 2, '#803010');
    }
}

export function drawFlyer(ctx, x, y, worldId, frame) {
    const flap = ((frame / 6) | 0) % 2;
    const wy = flap ? -2 : 2;
    if (worldId === 'castelo') {
        p(ctx, x + 4, y + 6, 8, 6, '#e8d0a0');
        p(ctx, x - 2, y + 4 + wy, 8, 3, '#d0b080');
        p(ctx, x + 10, y + 4 + wy, 8, 3, '#d0b080');
        p(ctx, x + 6, y + 7, 2, 2, '#801020');
        p(ctx, x + 8, y + 7, 2, 2, '#801020');
    } else if (worldId === 'cidadela') {
        p(ctx, x + 3, y + 5, 10, 7, '#a0b8d0');
        p(ctx, x + 1, y + 6 + wy, 5, 2, '#40e8f8');
        p(ctx, x + 10, y + 6 + wy, 5, 2, '#40e8f8');
    } else {
        p(ctx, x + 4, y + 6, 8, 6, '#403060');
        p(ctx, x, y + 5 + wy, 6, 3, '#705898');
        p(ctx, x + 10, y + 5 + wy, 6, 3, '#705898');
        p(ctx, x + 6, y + 8, 2, 2, '#f8e060');
    }
}

export function drawArmored(ctx, x, y, frame) {
    p(ctx, x + 2, y + 1, 12, 14, '#888898');
    p(ctx, x + 4, y + 3, 8, 6, '#c0c0d0');
    p(ctx, x + 5, y + 5, 2, 2, '#e03030');
    p(ctx, x + 9, y + 5, 2, 2, '#e03030');
    p(ctx, x + 12, y + 6, 6, 2, '#d8d0a0');
}

export function drawPiranha(ctx, x, y, frame) {
    const open = ((frame / 10) | 0) % 2 === 0;
    p(ctx, x + 5, y + 8, 6, 8, '#289038');
    p(ctx, x + 2, y, 12, 10, '#e03840');
    p(ctx, x + 4, y + 2, 8, open ? 5 : 2, '#f8e0d0');
    p(ctx, x + 3, y + 1, 2, 2, '#f8f8f8');
    p(ctx, x + 11, y + 1, 2, 2, '#f8f8f8');
}

export function drawBoss(ctx, x, y, hp, frame, phase) {
    const flash = hp % 2 === 0 && ((frame / 3) | 0) % 2;
    const body = flash ? '#f8f8f8' : (phase === 2 ? '#e03090' : phase === 1 ? '#40e0f0' : '#8030e0');
    p(ctx, x + 4, y + 4, 24, 24, body);
    p(ctx, x + 8, y + 8, 16, 12, '#201028');
    p(ctx, x + 10, y + 10, 4, 4, '#f8e020');
    p(ctx, x + 18, y + 10, 4, 4, '#f8e020');
    p(ctx, x + 12, y + 18, 8, 3, '#f03050');
    p(ctx, x, y + 10, 6, 6, body);
    p(ctx, x + 26, y + 10, 6, 6, body);
    text(ctx, 'G', x + 14, y + 22, '#fff', 1, null);
}

export function drawItem(ctx, kind, x, y, frame) {
    const bob = Math.sin(frame * 0.12) * 1.4;
    const yy = y + bob;
    if (kind === 'coin') {
        const thin = ((frame / 8) | 0) % 2;
        p(ctx, x + (thin ? 5 : 3), yy + 2, thin ? 6 : 10, 12, '#f8d030');
        p(ctx, x + (thin ? 6 : 5), yy + 4, thin ? 4 : 6, 8, '#fff0a0');
    } else if (kind === 'ring') {
        p(ctx, x + 2, yy + 2, 12, 12, '#f8e020');
        p(ctx, x + 5, yy + 5, 6, 6, '#1890f0');
    } else if (kind === 'rupee') {
        ctx.save();
        ctx.translate(x + 8, yy + 8);
        ctx.rotate(Math.PI / 4);
        p(ctx, -4, -4, 8, 8, '#30e070');
        p(ctx, -2, -2, 4, 4, '#c0ffd0');
        ctx.restore();
    } else if (kind === 'heart') {
        p(ctx, x + 2, yy + 4, 5, 5, '#f03048');
        p(ctx, x + 7, yy + 4, 5, 5, '#f03048');
        p(ctx, x + 3, yy + 8, 8, 6, '#f03048');
        p(ctx, x + 3, yy + 5, 2, 2, '#ffd0d8');
    } else if (kind === 'star') {
        p(ctx, x + 6, yy, 4, 14, '#f8f040');
        p(ctx, x, yy + 6, 16, 4, '#f8f040');
        p(ctx, x + 3, yy + 3, 10, 10, '#fff888');
    } else if (kind === 'oneup') {
        p(ctx, x + 3, yy + 2, 10, 6, '#f0f0f0');
        p(ctx, x + 2, yy + 6, 12, 8, '#e03030');
        p(ctx, x + 5, yy + 8, 6, 4, '#f0f0f0');
    } else if (kind === 'crystal') {
        const glow = 0.6 + Math.sin(frame * 0.15) * 0.4;
        p(ctx, x + 4, yy, 8, 16, `rgba(80, 220, 255, ${glow})`);
        p(ctx, x + 6, yy + 2, 4, 12, '#f8ffff');
        p(ctx, x + 2, yy + 4, 12, 8, '#40c0f8');
    } else if (kind === 'candle') {
        p(ctx, x + 6, yy + 8, 4, 8, '#d8b050');
        p(ctx, x + 7, yy + 2, 2, 6, ((frame / 6) | 0) % 2 ? '#f8e040' : '#f87820');
    } else if (kind === 'pot') {
        p(ctx, x + 3, yy + 4, 10, 10, '#c07040');
        p(ctx, x + 5, yy + 2, 6, 4, '#a05830');
        p(ctx, x + 6, yy + 6, 4, 3, '#e09058');
    } else if (kind === 'spring') {
        p(ctx, x + 2, yy + 8, 12, 8, '#e03830');
        p(ctx, x + 4, yy + 4, 8, 6, '#f0f0f0');
        p(ctx, x + 5, yy + 2, 6, 4, '#e03830');
    }
}

export function drawHud(ctx, sim) {
    p(ctx, 0, 0, VIEW_W, 16, 'rgba(8,8,16,0.55)');
    text(ctx, 'LEO', 4, 5, '#f8e0a0', 1);
    text(ctx, 'x' + String(sim.lives).padStart(2, '0'), 22, 5, '#f8f8f8', 1);
    for (let i = 0; i < PLAYER.MAX_HP; i++) {
        const on = i < sim.hp;
        p(ctx, 48 + i * 8, 4, 7, 6, on ? '#f03048' : '#402028');
        if (on) p(ctx, 49 + i * 8, 5, 2, 2, '#ffd0d8');
    }
    const score = String(sim.score | 0).padStart(6, '0');
    text(ctx, score, 80, 5, '#f8f838', 1);
    if (sim.rings > 0) text(ctx, 'O' + sim.rings, 132, 5, '#f8e020', 1);
    text(ctx, sim.world.short, 168, 5, '#80e0ff', 1);
    const tm = Math.max(0, Math.ceil(sim.timeLeft));
    text(ctx, String(tm).padStart(3, '0'), 228, 5, tm < 30 ? '#f83030' : '#f8f8f8', 1);

    if (sim.banner && sim.bannerTimer > 0) {
        const bw = textWidth(sim.banner, 1) + 12;
        p(ctx, ((VIEW_W - bw) / 2) | 0, 24, bw, 11, 'rgba(8,8,20,0.75)');
        centerText(ctx, sim.banner, 26, '#fff0a0', 1);
    }
}

export function drawParticles(ctx, parts, camX) {
    for (const pt of parts) {
        p(ctx, pt.x - camX, pt.y, pt.s || 2, pt.s || 2, pt.c);
    }
}

export function drawScan(ctx, t, worldId) {
    if (worldId !== 'nucleo') return;
    const y = (t * 2) % VIEW_H;
    p(ctx, 0, y, VIEW_W, 2, 'rgba(248,56,160,0.18)');
    if (((t / 20) | 0) % 7 === 0) {
        p(ctx, 0, (t * 13) % VIEW_H, VIEW_W, 1, 'rgba(56,248,248,0.25)');
    }
}

export { pal };
