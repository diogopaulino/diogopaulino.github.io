import { W, H, GROUND, SPRITE_SIZE } from './constants.js';
import { clamp, random } from './utils.js';

export function initRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

  function makeGlow(inner, middle, outer = '#0000') {
    const glow = document.createElement('canvas');
    glow.width = glow.height = 256;
    const glowContext = glow.getContext('2d');
    const gradient = glowContext.createRadialGradient(128, 128, 3, 128, 128, 128);
    gradient.addColorStop(0, inner);
    gradient.addColorStop(0.22, middle);
    gradient.addColorStop(1, outer);
    glowContext.fillStyle = gradient;
    glowContext.fillRect(0, 0, 256, 256);
    return glow;
  }

  const floorShade = ctx.createLinearGradient(0, 500, 0, H);
  floorShade.addColorStop(0, '#00000000');
  floorShade.addColorStop(1, '#00000082');

  const rain = document.createElement('canvas');
  rain.width = W;
  rain.height = H;
  const rainCtx = rain.getContext('2d');
  rainCtx.strokeStyle = '#b8d2e08a';
  rainCtx.lineWidth = 1.2;
  rainCtx.beginPath();
  for (let i = 0; i < 70; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % H;
    rainCtx.moveTo(x, y);
    rainCtx.lineTo(x - 5, y + 22);
  }
  rainCtx.stroke();

  const mote = document.createElement('canvas');
  mote.width = mote.height = 8;
  const moteCtx = mote.getContext('2d');
  moteCtx.fillStyle = '#d9b77b';
  moteCtx.beginPath();
  moteCtx.arc(4, 4, 3, 0, Math.PI * 2);
  moteCtx.fill();

  ctx.imageSmoothingEnabled = true;

  return {
    ctx,
    renderState: {
      floorShade,
      rain,
      mote,
      coliseumGlow: makeGlow('#e9a45b28', '#e9a45b12'),
      projectileGlows: new Map(),
      makeGlow
    }
  };
}

function drawSheet(ctx, image, index, x, y, facing, size = SPRITE_SIZE, alpha = 1, extra = null) {
  if (!image) return;
  const cellW = image.naturalWidth / 4;
  const cellH = image.naturalHeight / 3;
  const col = index % 4;
  const row = Math.floor(index / 4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  if (facing < 0) ctx.scale(-1, 1);
  if (extra) extra(ctx);
  ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, -size / 2, -size, size, size);
  ctx.restore();
}

export function render(ctx, match, frameNumber, images, renderState) {
  ctx.fillStyle = '#08090b';
  ctx.fillRect(0, 0, W, H);
  if (!match) return;

  ctx.save();

  const mid = (match.p1.x + match.p2.x) / 2;
  const camX = clamp(mid - W / 2, -28, 28);
  ctx.translate(-camX * 0.28, 0);

  if (match.shake) {
    ctx.translate(random(-match.shake, match.shake), random(-match.shake * 0.45, match.shake * 0.45));
  }

  if (match.koZoom > 0) {
    ctx.translate(random(-match.koZoom * 0.15, match.koZoom * 0.15), random(-match.koZoom * 0.08, match.koZoom * 0.08));
  }

  const image = images.get(match.stage.image);
  if (image) ctx.drawImage(image, 0, 0, W, H);

  if (match.stageId === 'seattle') {
    const shift = (frameNumber * 6) % H;
    ctx.drawImage(renderState.rain, 0, shift);
    ctx.drawImage(renderState.rain, 0, shift - H);
  } else if (match.stageId === 'coliseum') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 5; i++) {
      const x = 180 + i * 230 + Math.sin(frameNumber * 0.012 + i) * 65;
      ctx.drawImage(renderState.coliseumGlow, x - 100, 70, 200, 200);
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.globalAlpha = 0.16;
    for (let i = 0; i < 16; i++) {
      const x = (i * 137 + frameNumber * 0.22) % W;
      const y = 120 + ((i * 89 - frameNumber * 0.12 + H) % 430);
      ctx.drawImage(renderState.mote, x, y, 4, 4);
    }
    ctx.restore();
  }

  ctx.fillStyle = renderState.floorShade;
  ctx.fillRect(0, 500, W, 220);

  function drawShadow(fighter) {
    const air = GROUND - fighter.y;
    ctx.save();
    ctx.globalAlpha = clamp(0.48 - air * 0.002, 0.12, 0.48);
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(fighter.x, GROUND + 4, clamp(72 - air * 0.13, 22, 72), 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFighter(fighter) {
    const sheet = images.get(fighter.data.sheet);
    for (const ghost of fighter.trail || []) {
      drawSheet(ctx, sheet, ghost.frame, ghost.x, ghost.y, ghost.facing, SPRITE_SIZE, ghost.life / 14);
    }
    ctx.save();
    if (fighter.invuln > 0 && Math.floor(fighter.invuln / 3) % 2 === 0) ctx.globalAlpha = 0.42;
    const flash = fighter.hitstun > 8;
    const frame = fighter.spriteFrame();
    const pose = inner => {
      if (fighter.state === 'knockdown') {
        inner.translate(0, 22);
        inner.rotate(-0.55);
      }
    };
    drawSheet(ctx, sheet, frame, fighter.x, fighter.y, fighter.facing, SPRITE_SIZE, ctx.globalAlpha, pose);
    if (flash) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45;
      drawSheet(ctx, sheet, frame, fighter.x, fighter.y, fighter.facing, SPRITE_SIZE, 0.45, pose);
    }
    ctx.restore();
  }

  drawShadow(match.p1);
  drawShadow(match.p2);
  drawFighter(match.p1);
  drawFighter(match.p2);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const p of match.projectiles) {
    if (!renderState.projectileGlows.has(p.color)) {
      renderState.projectileGlows.set(p.color, renderState.makeGlow('#fff', p.color));
    }
    const glowSize = p.radius * 4.6;
    ctx.drawImage(renderState.projectileGlows.get(p.color), p.x - glowSize / 2, p.y - glowSize / 2, glowSize, glowSize);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, frameNumber * 0.1, frameNumber * 0.1 + Math.PI * 1.5);
    ctx.stroke();
  }

  for (const fx of match.effects) {
    ctx.globalAlpha = clamp(fx.life / 18, 0, 1);
    ctx.fillStyle = fx.color;
    ctx.save();
    ctx.translate(fx.x, fx.y);
    if (fx.spark) {
      ctx.rotate(fx.life * 0.2);
      ctx.fillRect(-fx.size, -1.2, fx.size * 2, 2.4);
      ctx.fillRect(-1.2, -fx.size, 2.4, fx.size * 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, fx.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (const ring of match.rings) {
    const progress = 1 - ring.life / ring.max;
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 5 * (1 - progress);
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, 16 + progress * 90, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  if (match.damageNumbers?.length) {
    ctx.save();
    ctx.font = 'italic 900 26px Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const dn of match.damageNumbers) {
      ctx.globalAlpha = clamp(dn.life / 18, 0, 1);
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = dn.color;
      ctx.strokeText(dn.text, dn.x, dn.y);
      ctx.fillText(dn.text, dn.x, dn.y);
    }
    ctx.restore();
  }

  ctx.restore();

  if (match.superFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${match.superFlash / 36})`;
    ctx.fillRect(0, 0, W, H);
  } else if (match.freeze > 0) {
    ctx.fillStyle = `rgba(255,236,210,${match.freeze / 90})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (match.koZoom > 12) {
    ctx.fillStyle = `rgba(255,255,255,${(match.koZoom - 12) / 40})`;
    ctx.fillRect(0, 0, W, H);
  }
}
