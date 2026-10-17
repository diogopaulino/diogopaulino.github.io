/**
 * Desenho estilo ACM / Super Nintendo: formas suaves, luz quente, lenço vermelho.
 * Origem do Kong: pés no chão, centro horizontal do hitbox.
 */

import { PAL, THEMES, TILE, VIEW_W, VIEW_H, hash2 } from './config.js';

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  if (fill) ctx.fillStyle = fill;
  ctx.fill();
}

function radGrad(ctx, x, y, r, c1, c2, ox = -0.35, oy = -0.4) {
  const g = ctx.createRadialGradient(x + r * ox, y + r * oy, r * 0.12, x, y, r);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  return g;
}

function drawScarf(ctx, t, wind, rolling) {
  const flutter = Math.sin(t * 10) * (rolling ? 0.4 : 1.6);
  const flutter2 = Math.sin(t * 10 + 1.3) * (rolling ? 0.3 : 1.9);
  ctx.fillStyle = PAL.scarfD;
  ellipse(ctx, 0.2, -13.2, 7.1, 2.6);
  ctx.fillStyle = PAL.scarf;
  ellipse(ctx, 0, -13.6, 6.6, 2.3);
  ctx.fillStyle = PAL.scarfL;
  ellipse(ctx, -1.6, -14.4, 2.4, 0.8);

  ctx.fillStyle = PAL.scarfD;
  ellipse(ctx, 5.8, -12.6, 2.6, 2.7);
  ctx.fillStyle = PAL.scarf;
  ellipse(ctx, 5.4, -13, 2.2, 2.3);
  ctx.fillStyle = PAL.scarfL;
  ellipse(ctx, 4.6, -13.6, 0.8, 0.7);

  const ends = [
    { x: 6.2, y: -12.2, w: flutter + wind, len: 8.5 },
    { x: 6.6, y: -11.4, w: flutter2 + wind * 0.7, len: 7.2 }
  ];
  for (const e of ends) {
    ctx.fillStyle = PAL.scarfD;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.quadraticCurveTo(e.x + 4 + e.w, e.y + e.len * 0.45, e.x + 5.5 + e.w, e.y + e.len);
    ctx.lineTo(e.x + 2.8 + e.w, e.y + e.len + 0.4);
    ctx.quadraticCurveTo(e.x + 2.4 + e.w * 0.5, e.y + e.len * 0.5, e.x - 0.4, e.y + 1);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.scarf;
    ctx.beginPath();
    ctx.moveTo(e.x, e.y);
    ctx.quadraticCurveTo(e.x + 3.2 + e.w, e.y + e.len * 0.42, e.x + 4.4 + e.w, e.y + e.len - 0.6);
    ctx.lineTo(e.x + 2.4 + e.w, e.y + e.len - 0.4);
    ctx.quadraticCurveTo(e.x + 2 + e.w * 0.4, e.y + e.len * 0.48, e.x, e.y + 0.6);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Kong Kong. `opt`: facing (-1|1), t, state, scarf, frame, flash
 * state: idle|run|jump|fall|roll|climb|hurt|swim|barrel
 */
export function drawKong(ctx, x, y, opt) {
  const facing = opt.facing < 0 ? -1 : 1;
  const t = opt.t || 0;
  const state = opt.state || 'idle';
  const scarf = opt.scarf !== false;
  const flash = opt.flash && Math.floor(t * 20) % 2 === 0;
  if (flash) return;

  const bob = state === 'run' ? Math.sin(t * 16) * 1.2
    : state === 'idle' ? Math.sin(t * 3) * 0.6
    : state === 'climb' ? Math.sin(t * 10) * 1
    : 0;
  const roll = state === 'roll';
  const wind = facing * (state === 'run' || roll ? 2.2 : 0.4);
  const squash = opt.squash || 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing * (1 + squash * 0.16), 1 - squash * 0.22);
  if (roll) ctx.rotate(t * 18);

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 9, 2.4, 0, 0, Math.PI * 2);
  ctx.fill();

  const legSwing = state === 'run' ? Math.sin(t * 16) * 5
    : state === 'climb' ? Math.sin(t * 10) * 4
    : 0;
  if (!roll) {
    ctx.fillStyle = PAL.furD;
    ellipse(ctx, -4.2, -2 + bob + Math.max(0, -legSwing * 0.15), 3.1, 4.2);
    ellipse(ctx, 3.8, -2 + bob + Math.max(0, legSwing * 0.15), 3.1, 4.2);
    ctx.fillStyle = PAL.fur;
    ellipse(ctx, -4, -2.6 + bob + Math.max(0, -legSwing * 0.15), 2.6, 3.6);
    ellipse(ctx, 4, -2.6 + bob + Math.max(0, legSwing * 0.15), 2.6, 3.6);
    ctx.fillStyle = PAL.skin;
    ellipse(ctx, -4.2, 1.2 + bob, 2.2, 1.5);
    ellipse(ctx, 4.2, 1.2 + bob, 2.2, 1.5);
  }

  const by = -9 + bob;
  ctx.fillStyle = radGrad(ctx, 0, by, 11, PAL.furL, PAL.furD);
  ellipse(ctx, 0, by, 8.4, 7.6);
  ctx.fillStyle = PAL.skin;
  ellipse(ctx, 0.6, by + 2.2, 4.6, 3.8);

  const armSwing = state === 'run' ? Math.sin(t * 16 + Math.PI) * 6
    : state === 'jump' || state === 'fall' ? -8
    : state === 'climb' ? Math.sin(t * 10 + Math.PI) * 6
    : 2;
  if (!roll) {
    ctx.fillStyle = PAL.fur;
    ctx.save();
    ctx.translate(-7, by);
    ctx.rotate((-armSwing * Math.PI) / 180);
    ellipse(ctx, 0, 4, 2.4, 4.4);
    ctx.fillStyle = PAL.skin;
    ellipse(ctx, 0.2, 8, 2.1, 1.8);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = PAL.fur;
    ctx.translate(7, by);
    ctx.rotate((armSwing * Math.PI) / 180);
    ellipse(ctx, 0, 4, 2.4, 4.4);
    ctx.fillStyle = PAL.skin;
    ellipse(ctx, -0.2, 8, 2.1, 1.8);
    ctx.restore();
  }

  const hy = -18 + bob;
  ctx.fillStyle = PAL.furD;
  ellipse(ctx, -6.4, hy - 4.2, 3.3, 3.1);
  ellipse(ctx, 6.4, hy - 4.2, 3.3, 3.1);
  ctx.fillStyle = PAL.skin;
  ellipse(ctx, -6.2, hy - 4, 1.8, 1.6);
  ellipse(ctx, 6.2, hy - 4, 1.8, 1.6);

  ctx.fillStyle = radGrad(ctx, 0, hy, 9, PAL.furL, PAL.furD, -0.25, -0.45);
  ellipse(ctx, 0, hy, 8.2, 7.4);

  ctx.fillStyle = PAL.skin;
  ellipse(ctx, 0.8, hy + 1.6, 5.4, 4.4);
  ctx.fillStyle = PAL.skinD;
  ellipse(ctx, 1.6, hy + 3.4, 2.4, 1.6);

  ctx.fillStyle = PAL.white;
  ellipse(ctx, -1.6, hy - 0.6, 2.3, 2.5);
  ellipse(ctx, 3.2, hy - 0.6, 2.3, 2.5);
  ctx.fillStyle = PAL.eye;
  const look = state === 'hurt' ? 0.6 : 0;
  ellipse(ctx, -1.3 + look, hy - 0.3, 1.15, 1.35);
  ellipse(ctx, 3.5 + look, hy - 0.3, 1.15, 1.35);
  ctx.fillStyle = '#fff';
  ellipse(ctx, -1.8, hy - 1, 0.55, 0.55);
  ellipse(ctx, 3, hy - 1, 0.55, 0.55);

  if (state === 'hurt') {
    ctx.strokeStyle = PAL.eye;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0.4, hy + 3.6);
    ctx.quadraticCurveTo(1.4, hy + 2.8, 2.6, hy + 3.6);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#c45a48';
    ellipse(ctx, 1.6, hy + 3.8, 1.3, 0.7);
  }

  if (scarf) drawScarf(ctx, t, wind, roll);
  else {
    ctx.fillStyle = 'rgba(80,40,20,0.35)';
    ellipse(ctx, 0, -13.4, 5.2, 1.4);
  }

  ctx.restore();
}

export function drawScarfPickup(ctx, x, y, t) {
  ctx.save();
  ctx.translate(x, y + Math.sin(t * 5) * 2);
  ctx.rotate(Math.sin(t * 3) * 0.25);
  ctx.fillStyle = PAL.scarfD;
  roundRect(ctx, -7, -3, 14, 6, 2);
  ctx.fill();
  ctx.fillStyle = PAL.scarf;
  roundRect(ctx, -6.5, -3.4, 13, 5.4, 2);
  ctx.fill();
  ctx.fillStyle = PAL.scarfL;
  ctx.fillRect(-4, -2.4, 6, 1.2);
  ctx.restore();
}

export function drawBanana(ctx, x, y, t, bunch = false) {
  const bob = Math.sin(t * 4 + x * 0.05) * 1.6;
  ctx.save();
  ctx.translate(x, y + bob);
  const n = bunch ? 3 : 1;
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.translate(bunch ? (i - 1) * 3.2 : 0, bunch ? Math.abs(i - 1) * 1.4 : 0);
    ctx.rotate(-0.5 + i * 0.45);
    ctx.fillStyle = PAL.bananaD;
    ctx.beginPath();
    ctx.ellipse(0, 2, 3.4, 6.2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.banana;
    ctx.beginPath();
    ctx.ellipse(-0.3, 1.6, 2.8, 5.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff6b0';
    ctx.beginPath();
    ctx.ellipse(-1, 0.4, 1, 2.2, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2410';
    ellipse(ctx, 0.2, -4.2, 1.1, 1.1);
    ctx.restore();
  }
  ctx.restore();
}

export function drawLetter(ctx, x, y, ch, t) {
  const bob = Math.sin(t * 3 + ch.charCodeAt(0)) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.fillStyle = 'rgba(255, 210, 60, 0.28)';
  ellipse(ctx, 0, 0, 9, 9);
  ctx.fillStyle = '#f6d03a';
  roundRect(ctx, -7, -8, 14, 16, 3);
  ctx.fill();
  ctx.fillStyle = '#7a4a08';
  ctx.font = 'bold 12px "Titan One", "Lilita One", system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 0, 1);
  ctx.restore();
}

export function drawBalloon(ctx, x, y, t) {
  const bob = Math.sin(t * 3) * 2.4;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.strokeStyle = '#fff6ea';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.quadraticCurveTo(4, 14, 0, 20);
  ctx.stroke();
  ctx.fillStyle = '#e31b23';
  ellipse(ctx, 0, 0, 7, 8.4);
  ctx.fillStyle = '#ff6b6b';
  ellipse(ctx, -2, -2, 2.4, 3);
  ctx.fillStyle = '#8e1018';
  ctx.beginPath();
  ctx.moveTo(-2, 8);
  ctx.lineTo(2, 8);
  ctx.lineTo(0, 10.5);
  ctx.fill();
  ctx.restore();
}

export function drawBarrel(ctx, x, y, kind, t, angle = 0, charge = 0) {
  ctx.save();
  ctx.translate(x, y);
  if (kind === 'cannon' || kind === 'cannonUp' || kind === 'cannonDiag') {
    ctx.rotate(angle);
    if (charge > 0) {
      const pulse = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(t * (10 + charge * 26)));
      ctx.fillStyle = `rgba(255,210,80,${pulse * charge})`;
      ellipse(ctx, 16, 0, 5 + charge * 5, 7 + charge * 5);
    }
    ctx.fillStyle = '#4a2a12';
    roundRect(ctx, -6, -8, 22, 16, 4);
    ctx.fill();
    ctx.fillStyle = '#7a4a22';
    roundRect(ctx, -5, -7, 20, 14, 3);
    ctx.fill();
    ctx.fillStyle = '#1a1008';
    ellipse(ctx, 16, 0, 4, 6);
    ctx.fillStyle = '#c07838';
    ellipse(ctx, -4, 0, 8, 9);
    ctx.fillStyle = '#6a3418';
    ellipse(ctx, -4, 0, 5, 6);
    ctx.restore();
    return;
  }
  const body = kind === 'tnt' ? '#b43a28' : kind === 'bounce' ? '#3a8a48' : '#c07838';
  const band = kind === 'tnt' ? '#f0e0a0' : '#5a3418';
  if (kind === 'tnt' && charge > 0) {
    const pulse = 0.3 + 0.45 * (0.5 + 0.5 * Math.sin(t * (8 + charge * 30)));
    ctx.fillStyle = `rgba(255,90,40,${pulse * charge})`;
    ellipse(ctx, 0, 0, 13 + charge * 4, 14 + charge * 4);
  }
  ctx.fillStyle = '#4a2a10';
  ellipse(ctx, 0, 1, 11, 12);
  ctx.fillStyle = body;
  ellipse(ctx, 0, 0, 10, 11);
  ctx.fillStyle = band;
  ctx.fillRect(-10, -3, 20, 3);
  ctx.fillRect(-10, 4, 20, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ellipse(ctx, -3, -4, 3, 4);
  if (kind === 'tnt') {
    ctx.fillStyle = '#f0e0a0';
    ctx.font = 'bold 7px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TNT', 0, 0.5);
  }
  if (kind === 'dk') {
    ctx.fillStyle = PAL.scarf;
    ellipse(ctx, 0, -1, 4, 4);
    ctx.fillStyle = PAL.white;
    ctx.font = 'bold 6px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('K', 0, 1);
  }
  ctx.restore();
}

export function drawEnemy(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x + e.w / 2, e.y + e.h);
  const face = e.vx < 0 ? -1 : 1;
  ctx.scale(face, 1);
  const bob = Math.sin(t * 8 + e.x) * 0.8;

  if (e.type === 'bee') {
    ctx.translate(0, -8 + Math.sin(t * 6 + e.x) * 3);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ellipse(ctx, 0, 10, 6, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ellipse(ctx, -5, -4, 5, 3);
    ellipse(ctx, 5, -4, 5, 3);
    ctx.fillStyle = '#f0c030';
    ellipse(ctx, 0, 0, 7, 5.5);
    ctx.fillStyle = '#2a2218';
    ctx.fillRect(-7, -1.2, 14, 2.4);
    ctx.fillStyle = PAL.white;
    ellipse(ctx, 3, -1, 1.6, 1.8);
    ctx.fillStyle = PAL.eye;
    ellipse(ctx, 3.4, -1, 0.8, 0.9);
    ctx.fillStyle = PAL.scarf;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(10, -1);
    ctx.lineTo(7, 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  if (e.type === 'quill') {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ellipse(ctx, 0, 1, 8, 2);
    ctx.fillStyle = '#c8b090';
    ellipse(ctx, 0, -6 + bob, 8, 6);
    ctx.fillStyle = '#6a5030';
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 2, -8);
      ctx.lineTo(i * 2 + 0.5, -16);
      ctx.lineTo(i * 2 + 1.6, -8);
      ctx.fill();
    }
    ctx.fillStyle = PAL.white;
    ellipse(ctx, 3, -7 + bob, 1.6, 1.7);
    ctx.fillStyle = PAL.eye;
    ellipse(ctx, 3.4, -7 + bob, 0.8, 0.9);
    ctx.restore();
    return;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ellipse(ctx, 0, 1, 8, 2.2);
  ctx.fillStyle = '#3a8a48';
  ellipse(ctx, -4, -3 + bob, 3, 3.4);
  ellipse(ctx, 4, -3 + bob, 3, 3.4);
  ctx.fillStyle = '#4cb05a';
  ellipse(ctx, 0, -8 + bob, 8.5, 7);
  ctx.fillStyle = '#d8e070';
  ellipse(ctx, 2, -6 + bob, 4, 3.4);
  ctx.fillStyle = PAL.white;
  ellipse(ctx, 3.2, -9 + bob, 1.8, 2);
  ctx.fillStyle = PAL.eye;
  ellipse(ctx, 3.6, -8.8 + bob, 0.9, 1);
  ctx.fillStyle = '#2a5028';
  ellipse(ctx, 7, -7 + bob, 2.4, 1.4);
  ctx.restore();
}

export function drawBoss(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x + b.w / 2, b.y + b.h);
  const face = b.vx < 0 ? -1 : 1;
  ctx.scale(face, 1);
  const bob = Math.sin(t * 4) * 1.2;
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ellipse(ctx, 0, 2, 18, 4);
  ctx.fillStyle = '#2f6a38';
  ellipse(ctx, -10, -6 + bob, 6, 7);
  ellipse(ctx, 10, -6 + bob, 6, 7);
  ctx.fillStyle = '#3d8a44';
  ellipse(ctx, 0, -16 + bob, 20, 16);
  ctx.fillStyle = '#c8d878';
  ellipse(ctx, 6, -12 + bob, 10, 8);
  ctx.fillStyle = PAL.white;
  ellipse(ctx, 8, -20 + bob, 4, 4.4);
  ctx.fillStyle = PAL.eye;
  ellipse(ctx, 9, -19.4 + bob, 2, 2.2);
  ctx.fillStyle = '#1a3018';
  roundRect(ctx, 10, -10 + bob, 14, 5, 2);
  ctx.fill();
  ctx.fillStyle = PAL.white;
  for (let i = 0; i < 4; i++) ellipse(ctx, 12 + i * 3, -8.4 + bob, 1, 1.6);
  ctx.fillStyle = '#f0c030';
  ctx.beginPath();
  ctx.moveTo(-6, -30 + bob);
  ctx.lineTo(0, -40 + bob);
  ctx.lineTo(6, -30 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAL.scarf;
  ellipse(ctx, 0, -38 + bob, 3, 3);
  ctx.restore();
}

export function drawExit(ctx, x, y, t) {
  const glow = 0.45 + Math.sin(t * 4) * 0.15;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = `rgba(246, 208, 58, ${glow})`;
  ellipse(ctx, 0, -10, 16, 18);
  ctx.fillStyle = '#6b3a1c';
  roundRect(ctx, -12, -28, 24, 28, 4);
  ctx.fill();
  ctx.fillStyle = '#3e2110';
  roundRect(ctx, -8, -24, 16, 20, 3);
  ctx.fill();
  ctx.fillStyle = PAL.banana;
  ellipse(ctx, 0, -16, 5, 5);
  ctx.restore();
}

function tileColor(theme, ch, tx, ty) {
  const n = hash2(tx, ty);
  if (ch === '#' || ch === '=' || ch === '*') {
    return n > 0.5 ? theme.dirt : theme.dirtD;
  }
  return theme.dirt;
}

export function drawTile(ctx, ch, tx, ty, theme, t) {
  const x = tx * TILE;
  const y = ty * TILE;
  if (ch === '.' || ch === 'S' || ch === 'X') return;

  if (ch === '~') {
    const wave = Math.sin(t * 3 + tx) * 1.4;
    ctx.fillStyle = theme.water;
    ctx.globalAlpha = 0.55;
    ctx.fillRect(x, y + 4 + wave, TILE, TILE);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#b8ecff';
    ctx.fillRect(x, y + 4 + wave, TILE, 2);
    ctx.globalAlpha = 1;
    return;
  }

  if (ch === '|') {
    ctx.strokeStyle = '#6a3a18';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 8, y);
    ctx.lineTo(x + 8 + Math.sin(t * 2 + ty) * 1.2, y + TILE);
    ctx.stroke();
    ctx.strokeStyle = '#4aaa3a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 6);
    ctx.quadraticCurveTo(x + 8, y + 8, x + 12, y + 5);
    ctx.stroke();
    return;
  }

  if (ch === '^') {
    ctx.fillStyle = '#8a8a90';
    ctx.beginPath();
    ctx.moveTo(x, y + TILE);
    ctx.lineTo(x + 4, y + 2);
    ctx.lineTo(x + 8, y + TILE);
    ctx.lineTo(x + 12, y + 2);
    ctx.lineTo(x + 16, y + TILE);
    ctx.fill();
    return;
  }

  if (ch === '-') {
    ctx.fillStyle = theme.grass;
    roundRect(ctx, x, y + 4, TILE, 5, 2);
    ctx.fill();
    ctx.fillStyle = theme.grassL;
    ctx.fillRect(x + 1, y + 5, TILE - 2, 2);
    return;
  }

  if (ch === '@' || ch === '*') {
    ctx.fillStyle = '#8a5a28';
    roundRect(ctx, x + 1, y + 1, TILE - 2, TILE - 2, 2);
    ctx.fill();
    ctx.strokeStyle = '#4a2a10';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
    return;
  }

  ctx.fillStyle = tileColor(theme, ch, tx, ty);
  ctx.fillRect(x, y, TILE, TILE);
  if (ch === '=') {
    ctx.fillStyle = theme.grass;
    ctx.fillRect(x, y, TILE, 5);
    ctx.fillStyle = theme.grassL;
    ctx.fillRect(x, y, TILE, 2);
    if (hash2(tx, ty + 9) > 0.7) {
      ctx.fillStyle = theme.grassL;
      ctx.fillRect(x + 4, y - 3, 2, 3);
    }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y, TILE, 1);
    if (hash2(tx, ty) > 0.84) {
      ctx.fillStyle = 'rgba(255,220,160,0.16)';
      ctx.fillRect(x + 4, y + 6, 3, 2);
    }
  }
}

export function drawBackground(ctx, themeName, camX, camY, t) {
  const theme = THEMES[themeName] || THEMES.jungle;
  const sky = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, theme.sky[0]);
  sky.addColorStop(0.55, theme.sky[1]);
  sky.addColorStop(1, theme.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  if (themeName === 'jungle' || themeName === 'canopy' || themeName === 'ruins') {
    ctx.fillStyle = 'rgba(255, 236, 160, 0.12)';
    ctx.beginPath();
    ctx.arc(360, 40, 50, 0, Math.PI * 2);
    ctx.fill();
  }

  const cloudColors = {
    jungle: 'rgba(255,255,255,0.4)',
    canopy: 'rgba(255,255,255,0.32)',
    ruins: 'rgba(255,235,205,0.28)',
    falls: 'rgba(255,255,255,0.45)',
    throne: 'rgba(255,160,120,0.12)'
  };
  const cloudColor = cloudColors[themeName];
  if (cloudColor) {
    ctx.fillStyle = cloudColor;
    const parC = camX * 0.08;
    for (let i = -1; i < 6; i++) {
      const cx = i * 160 - (parC % 160);
      const cy = 26 + (i % 3) * 14;
      ellipse(ctx, cx + 30, cy, 26, 9);
      ellipse(ctx, cx + 55, cy + 4, 18, 7);
      ellipse(ctx, cx + 10, cy + 5, 16, 6);
    }
  }

  ctx.fillStyle = theme.far;
  const par = camX * 0.18;
  for (let i = -1; i < 8; i++) {
    const bx = i * 110 - (par % 110);
    ctx.beginPath();
    ctx.moveTo(bx, VIEW_H);
    ctx.lineTo(bx + 20, 110);
    ctx.lineTo(bx + 55, 70);
    ctx.lineTo(bx + 90, 120);
    ctx.lineTo(bx + 120, VIEW_H);
    ctx.fill();
  }

  ctx.fillStyle = theme.mid;
  const par2 = camX * 0.4;
  for (let i = -1; i < 10; i++) {
    const bx = i * 80 - (par2 % 80);
    ctx.beginPath();
    ctx.moveTo(bx, VIEW_H);
    ctx.lineTo(bx + 18, 150);
    ctx.lineTo(bx + 40, 128);
    ctx.lineTo(bx + 64, 160);
    ctx.lineTo(bx + 80, VIEW_H);
    ctx.fill();
  }

  if (themeName === 'falls') {
    ctx.fillStyle = 'rgba(180, 230, 255, 0.22)';
    for (let i = 0; i < 4; i++) {
      const wx = 80 + i * 110 - ((camX * 0.3) % 110);
      ctx.fillRect(wx, 0, 18, VIEW_H);
    }
  }

  if (themeName === 'mine') {
    ctx.fillStyle = 'rgba(255, 180, 60, 0.08)';
    for (let i = 0; i < 6; i++) {
      const lx = 40 + i * 90 - ((camX * 0.2) % 90);
      ctx.beginPath();
      ctx.arc(lx, 50, 16, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.fillStyle = theme.fog;
  ctx.fillRect(0, VIEW_H - 70, VIEW_W, 70);
}

export function drawForeground(ctx, themeName, camX, t) {
  if (themeName === 'mine' || themeName === 'throne') return;
  ctx.fillStyle = 'rgba(20, 80, 30, 0.35)';
  const par = camX * 0.92;
  for (let i = -1; i < 8; i++) {
    const x = i * 90 - (par % 90);
    ctx.beginPath();
    ctx.ellipse(x + 20, 16, 28, 18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + 60, 8, 22, 14, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawWorldMap(ctx, save, cursor, t) {
  drawBackground(ctx, 'jungle', t * 12, 0, t);
  ctx.fillStyle = '#2a8a50';
  ctx.beginPath();
  ctx.ellipse(240, 168, 200, 72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#48b45a';
  ctx.beginPath();
  ctx.ellipse(240, 160, 188, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0d48a';
  ctx.beginPath();
  ctx.ellipse(240, 176, 70, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  const nodes = [
    { x: 90, y: 176, name: 'Trilha' },
    { x: 150, y: 148, name: 'Cipós' },
    { x: 220, y: 168, name: 'Canhões' },
    { x: 290, y: 140, name: 'Mina' },
    { x: 350, y: 166, name: 'Catarata' },
    { x: 410, y: 132, name: 'Trono' }
  ];

  ctx.strokeStyle = '#f0d48a';
  ctx.lineWidth = 3;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(nodes[0].x, nodes[0].y);
  for (let i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
  ctx.stroke();
  ctx.setLineDash([]);

  nodes.forEach((n, i) => {
    const unlocked = i < save.unlocked;
    const cleared = save.clear.includes(i);
    ctx.fillStyle = unlocked ? '#f6d03a' : '#5a5a5a';
    ellipse(ctx, n.x, n.y, 11, 11);
    ctx.fillStyle = unlocked ? '#7a4a08' : '#2a2a2a';
    ctx.font = 'bold 10px "Titan One", system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), n.x, n.y + 1);
    if (cleared) {
      ctx.fillStyle = PAL.scarf;
      ellipse(ctx, n.x + 8, n.y - 8, 4, 4);
    }
    ctx.fillStyle = '#fff6ea';
    ctx.font = '7px "Nunito", system-ui';
    ctx.fillText(n.name, n.x, n.y + 18);
    if (i === cursor) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(n.x, n.y, 14 + Math.sin(t * 6), 0, Math.PI * 2);
      ctx.stroke();
    }
  });

  const c = nodes[cursor];
  drawKong(ctx, c.x, c.y - 22, { facing: 1, t, state: 'idle', scarf: true });

  ctx.fillStyle = '#fff6ea';
  ctx.font = '22px "Titan One", "Lilita One", system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('ILHA DO LENÇO', 240, 36);
  ctx.font = '9px "Nunito", system-ui';
  ctx.fillStyle = 'rgba(255,246,234,0.8)';
  ctx.fillText('Escolha a fase · Enter para entrar · Esc volta', 240, 52);
}

export function drawTitle(ctx, t) {
  drawBackground(ctx, 'jungle', t * 20, 0, t);
  drawForeground(ctx, 'jungle', t * 20, t);

  for (let i = 0; i < 8; i++) {
    drawBanana(ctx, 40 + i * 56, 36 + Math.sin(t * 2 + i) * 6, t, i % 3 === 0);
  }

  ctx.fillStyle = 'rgba(20, 40, 16, 0.45)';
  roundRect(ctx, 70, 58, 340, 150, 16);
  ctx.fill();

  ctx.fillStyle = PAL.scarf;
  ctx.font = '42px "Titan One", "Lilita One", system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('KONG KONG', 242, 108);
  ctx.fillStyle = '#f6d03a';
  ctx.fillText('KONG KONG', 240, 106);

  ctx.fillStyle = '#fff6ea';
  ctx.font = '13px "Nunito", system-ui';
  ctx.fillText('O macaquinho do lenço vermelho', 240, 128);
  ctx.font = '10px "Nunito", system-ui';
  ctx.fillStyle = 'rgba(255,246,234,0.75)';
  ctx.fillText('Os Lagartões roubaram as bananas. Recupere o estoque.', 240, 148);

  drawKong(ctx, 240, 196, { facing: 1, t, state: 'idle', scarf: true });

  if (Math.sin(t * 4) > -0.2) {
    ctx.fillStyle = '#f6d03a';
    ctx.font = '11px "Titan One", system-ui';
    // Em tela de toque não há Enter: a chamada precisa combinar com o aparelho.
    const startHint = window.matchMedia?.('(pointer: coarse)').matches
      ? 'TOQUE PARA COMEÇAR'
      : 'APERTE ENTER';
    ctx.fillText(startHint, 240, 248);
  }
}

export function drawHud(ctx, snap) {
  ctx.fillStyle = 'rgba(12, 20, 10, 0.42)';
  roundRect(ctx, 8, 8, 150, 28, 8);
  ctx.fill();
  for (let i = 0; i < snap.lives; i++) {
    ctx.save();
    ctx.translate(22 + i * 16, 30);
    ctx.scale(0.45, 0.45);
    drawKong(ctx, 0, 0, { facing: 1, t: 0, state: 'idle', scarf: true });
    ctx.restore();
  }

  ctx.fillStyle = 'rgba(12, 20, 10, 0.42)';
  roundRect(ctx, VIEW_W / 2 - 70, 8, 140, 28, 8);
  ctx.fill();
  drawBanana(ctx, VIEW_W / 2 - 48, 22, snap.t, false);
  ctx.fillStyle = '#fff6ea';
  ctx.font = 'bold 12px "Nunito", system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(snap.bananas).padStart(3, '0'), VIEW_W / 2 - 36, 22);
  ctx.textAlign = 'center';
  ctx.font = '8px "Nunito", system-ui';
  ctx.fillStyle = 'rgba(255,246,234,0.8)';
  ctx.fillText(snap.levelName, VIEW_W / 2 + 28, 22);

  const letters = ['K', 'O', 'N', 'G'];
  letters.forEach((ch, i) => {
    const on = snap.letters[ch];
    ctx.fillStyle = on ? '#f6d03a' : 'rgba(255,255,255,0.18)';
    ctx.font = 'bold 13px "Titan One", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(ch, 20 + i * 14, 48);
  });

  if (!snap.scarf) {
    ctx.fillStyle = 'rgba(227, 27, 35, 0.9)';
    ctx.font = '9px "Nunito", system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('pegue o lenço!', VIEW_W / 2, 50);
  }
}
