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
  
  const coliseumGlow = makeGlow('#e9a45b28', '#e9a45b12');
  const projectileGlows = new Map();

  const renderState = {
    floorShade,
    coliseumGlow,
    projectileGlows,
    makeGlow
  };

  return { ctx, renderState };
}

export function render(ctx, match, frameNumber, images, renderState) {
  ctx.fillStyle = '#08090b';
  ctx.fillRect(0, 0, W, H);
  if (!match) return;

  ctx.save();
  if (match.shake) {
    ctx.translate(random(-match.shake, match.shake), random(-match.shake * 0.5, match.shake * 0.5));
  }

  function drawStage() {
    const image = images.get(match.stage.image);
    if (image) ctx.drawImage(image, 0, 0, W, H);
    
    if (match.stageId === 'seattle') {
      ctx.save();
      ctx.strokeStyle = '#b8d2e05c';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 75; i++) {
        const x = (i * 97 + frameNumber * 7) % W;
        const y = (i * 53 + frameNumber * 13) % H;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 5, y + 22);
        ctx.stroke();
      }
      ctx.restore();
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
      ctx.fillStyle = '#d9b77b22';
      for (let i = 0; i < 30; i++) {
        const x = (i * 137 + frameNumber * 0.22) % W;
        const y = 120 + ((i * 89 - frameNumber * 0.12 + H) % 430);
        ctx.beginPath();
        ctx.arc(x, y, 1.4 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    
    ctx.fillStyle = renderState.floorShade;
    ctx.fillRect(0, 500, W, 220);
  }

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
    const image = images.get(fighter.data.sheet);
    if (!image) return;
    const index = fighter.spriteFrame();
    const cellW = image.naturalWidth / 4;
    const cellH = image.naturalHeight / 3;
    const col = index % 4;
    const row = Math.floor(index / 4);
    
    ctx.save();
    ctx.translate(fighter.x, fighter.y);
    if (fighter.facing < 0) ctx.scale(-1, 1);
    if (fighter.state === 'knockdown') ctx.translate(0, 8);
    if (fighter.invuln > 0 && Math.floor(fighter.invuln / 3) % 2 === 0) ctx.globalAlpha = 0.45;
    ctx.filter = fighter.hitstun > 0 && fighter.hitstun > (fighter.move ? 0 : 12) ? 'brightness(1.7) saturate(.55)' : 'none';
    
    ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, -SPRITE_SIZE / 2, -SPRITE_SIZE, SPRITE_SIZE, SPRITE_SIZE);
    ctx.restore();
  }

  function drawProjectiles() {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const p of match.projectiles) {
      if (!renderState.projectileGlows.has(p.color)) {
        renderState.projectileGlows.set(p.color, renderState.makeGlow('#fff', p.color));
      }
      const glowSize = p.radius * 4.4;
      ctx.drawImage(renderState.projectileGlows.get(p.color), p.x - glowSize / 2, p.y - glowSize / 2, glowSize, glowSize);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, frameNumber * 0.08, frameNumber * 0.08 + Math.PI * 1.45);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEffects() {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (const fx of match.effects) {
      ctx.globalAlpha = clamp(fx.life / 18, 0, 1);
      ctx.fillStyle = fx.color;
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const ring of match.rings) {
      const progress = 1 - ring.life / ring.max;
      ctx.globalAlpha = 1 - progress;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 5 * (1 - progress);
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, 16 + progress * 82, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDamageNumbers() {
    if (!match.damageNumbers || !match.damageNumbers.length) return;
    ctx.save();
    ctx.font = 'bold 22px Impact, sans-serif';
    ctx.textAlign = 'center';
    for (const dn of match.damageNumbers) {
      ctx.globalAlpha = clamp(dn.life / 20, 0, 1);
      ctx.fillStyle = dn.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(dn.text, dn.x, dn.y);
      ctx.fillText(dn.text, dn.x, dn.y);
    }
    ctx.restore();
  }

  drawStage();
  drawShadow(match.p1);
  drawShadow(match.p2);
  drawFighter(match.p1);
  drawFighter(match.p2);
  drawProjectiles();
  drawEffects();
  drawDamageNumbers();

  if (match.freeze > 0) {
    ctx.fillStyle = `rgba(255,255,255,${match.freeze / 70})`;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.restore();
}
