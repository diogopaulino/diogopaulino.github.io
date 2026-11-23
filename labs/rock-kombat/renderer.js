// ==========================================================================
// Rock Kombat — 2D Hyper-Arcade Canvas Renderer
// Marvel vs. Capcom & Mortal Kombat visual pipeline:
// - Wide 1600px scrolling arena with dynamic camera tracking & zoom
// - Real-time wet stage floor mirror reflections of fighters & projectiles
// - MvC Hyper Combo screen-freeze speedline cut-in & beam laser rendering
// - Chromatic afterimages, directional hit-slashes, dizzy stars & KO bursts
// ==========================================================================

import { W, H, WORLD_W, GROUND, SPRITE_SIZE, STEP } from './constants.js?v=23';
import { clamp, lerp } from './utils.js';

export function initRenderer(canvas, onResize) {
  const ctx = canvas.getContext('2d', { alpha: false });

  function makeGlow(inner, middle, outer = '#0000') {
    const glow = document.createElement('canvas');
    glow.width = glow.height = 256;
    const gCtx = glow.getContext('2d');
    const grad = gCtx.createRadialGradient(128, 128, 4, 128, 128, 128);
    grad.addColorStop(0, inner);
    grad.addColorStop(0.28, middle);
    grad.addColorStop(1, outer);
    gCtx.fillStyle = grad;
    gCtx.fillRect(0, 0, 256, 256);
    return glow;
  }

  const floorShade = ctx.createLinearGradient(0, GROUND - 110, 0, H);
  floorShade.addColorStop(0, 'rgba(6, 7, 10, 0)');
  floorShade.addColorStop(0.55, 'rgba(6, 7, 10, 0.36)');
  floorShade.addColorStop(1, 'rgba(4, 5, 8, 0.78)');

  const vignette = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.25, W / 2, H * 0.5, W * 0.65);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(0,0,0,0.52)');

  // Pre-rendered diagonal rain sheet
  const rain = document.createElement('canvas');
  rain.width = W;
  rain.height = H;
  const rainCtx = rain.getContext('2d');
  rainCtx.strokeStyle = 'rgba(185, 218, 240, 0.48)';
  rainCtx.lineWidth = 1.3;
  rainCtx.beginPath();
  for (let i = 0; i < 85; i++) {
    const x = (i * 97) % W;
    const y = (i * 53) % H;
    rainCtx.moveTo(x, y);
    rainCtx.lineTo(x - 7, y + 26);
  }
  rainCtx.stroke();

  // Pre-rendered dust mote
  const mote = document.createElement('canvas');
  mote.width = mote.height = 10;
  const moteCtx = mote.getContext('2d');
  moteCtx.fillStyle = '#f2c97d';
  moteCtx.beginPath();
  moteCtx.arc(5, 5, 3.5, 0, Math.PI * 2);
  moteCtx.fill();

  const resize = new ResizeObserver(([entry]) => {
    const cssWidth = entry.contentRect.width;
    if (!cssWidth) return;
    const width = clamp(Math.round(cssWidth * Math.min(devicePixelRatio, 2)), 320, 1920);
    const height = Math.round(width * entry.contentRect.height / cssWidth);
    if (canvas.width === width && canvas.height === height) return;
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingQuality = 'medium';
    onResize();
  });
  resize.observe(canvas);

  return {
    ctx,
    renderState: {
      floorShade,
      vignette,
      rain,
      mote,
      camX: WORLD_W / 2,
      camY: H / 2,
      camZoom: 1,
      coliseumGlow: makeGlow('rgba(255, 130, 65, 0.24)', 'rgba(235, 60, 40, 0.09)'),
      seattleGlow: makeGlow('rgba(95, 175, 255, 0.20)', 'rgba(95, 175, 255, 0.05)'),
      contactShadow: makeGlow('#000', '#000b'),
      projectileGlows: new Map(),
      makeGlow
    }
  };
}

function drawSheet(
  ctx,
  image,
  index,
  x,
  y,
  facing,
  size = SPRITE_SIZE,
  alpha = 1,
  scaleX = 1,
  scaleY = 1,
  extra = null
) {
  if (!image) return;
  const cellW = image.naturalWidth / 4;
  const cellH = image.naturalHeight / 3;
  const col = index % 4;
  const row = Math.floor(index / 4);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale((facing < 0 ? -1 : 1) * scaleX, scaleY);
  if (extra) extra(ctx);
  // The atlases share a foot line at 94% of the cell. Keep it planted across poses.
  ctx.drawImage(image, col * cellW, row * cellH, cellW, cellH, -size / 2, -size * 0.94, size, size);
  ctx.restore();
}

function drawHyperBackground(ctx, match, frameNumber) {
  const color = match.hyperColor || '#ff4733';
  ctx.save();
  ctx.fillStyle = match.freeze > 0 ? '#080912b8' : '#08091260';
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = color;
  for (let i = 0; i < 24; i++) {
    const y = ((i * 37 + frameNumber * 19) % H);
    const len = 180 + ((i * 91) % 520);
    const x = ((i * 173 + frameNumber * 55) % (W + 400)) - 200;
    ctx.globalAlpha = 0.22 + (i % 3) * 0.16;
    ctx.lineWidth = 2 + (i % 4) * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHyperBeam(ctx, fighter, x, y, frameNumber, renderState) {
  const move = fighter.move;
  if (!move || !move.beam) return;
  if (fighter.moveFrame < move.startup || fighter.moveFrame >= move.startup + move.active) return;

  const startX = x + fighter.facing * 58;
  const startY = y - 170;
  const length = 1220;
  const endX = startX + fighter.facing * length;
  const pulse = Math.sin(frameNumber * 0.33) * 10;
  const height = 190 + pulse;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';

  // Outer energy aura
  const grad = ctx.createLinearGradient(startX, startY - height / 2, startX, startY + height / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(0.2, fighter.data.color);
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(0.8, fighter.data.secondary || fighter.data.color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.rect(
    Math.min(startX, endX),
    startY - height / 2,
    length,
    height
  );
  ctx.fill();

  // Inner white-hot core
  ctx.fillStyle = '#fff5e7';
  ctx.fillRect(
    Math.min(startX, endX),
    startY - (height * 0.22),
    length,
    height * 0.44
  );

  // Sonic rings along the beam
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) {
    const rx = startX + fighter.facing * ((frameNumber * 23 + i * 170) % length);
    ctx.beginPath();
    ctx.ellipse(rx, startY, 16, height * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Muzzle flash
  if (!renderState.projectileGlows.has(fighter.data.color)) {
    renderState.projectileGlows.set(fighter.data.color, renderState.makeGlow('#fff', fighter.data.color));
  }
  const glow = renderState.projectileGlows.get(fighter.data.color);
  ctx.drawImage(glow, startX - 140, startY - 140, 280, 280);
  ctx.restore();
}

function drawRush(ctx, fighter, x, y, frame) {
  const move = fighter.move;
  if (!move?.rush || fighter.moveFrame < move.startup || fighter.moveFrame >= move.startup + move.active) return;
  const direction = fighter.facing;
  const count = move.superMove ? 9 : 4;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.strokeStyle = fighter.data.color;
  for (let i = 0; i < count; i++) {
    const offset = (frame * 18 + i * 43) % 170;
    const height = 32 + (i * 39) % 215;
    ctx.globalAlpha = (1 - offset / 170) * 0.62;
    ctx.lineWidth = i % 3 + 1;
    ctx.beginPath();
    ctx.moveTo(x + direction * (122 - offset), y - height);
    ctx.lineTo(x - direction * (26 + offset), y - height + 14);
    ctx.stroke();
  }
  ctx.restore();
}

export function render(ctx, match, frameNumber, images, renderState, interpolation, delta) {
  // Portrait renders a taller crop while keeping fighter proportions and world coordinates.
  const scale = ctx.canvas.height / H;
  const viewWidth = ctx.canvas.width / scale;
  const screenOffset = (ctx.canvas.width - W * scale) / 2;
  ctx.setTransform(scale, 0, 0, scale, screenOffset, 0);
  if (!match) return;
  ctx.fillStyle = '#080a12';
  ctx.fillRect(0, 0, W, H);

  // Dynamic Camera Tracking & Zoom (MvC / MK camera)
  const p1 = match.p1;
  const p2 = match.p2;
  const x1 = lerp(p1.prevX, p1.x, interpolation);
  const x2 = lerp(p2.prevX, p2.x, interpolation);
  const y1 = lerp(p1.prevY, p1.y, interpolation);
  const y2 = lerp(p2.prevY, p2.y, interpolation);
  const midX = (x1 + x2) * 0.5;
  const dist = Math.abs(x1 - x2);

  const airFollowY = clamp((GROUND - Math.min(y1, y2)) * 0.39, 0, 125);
  let targetZoom = clamp(1.25 - dist * 0.00027 - airFollowY * 0.001, 0.88, 1.2);
  if (match.koZoom > 0 && !match.reducedMotion) targetZoom = Math.min(targetZoom + 0.07, 1.24);
  const fitZoom = viewWidth / (dist + 230);
  targetZoom = Math.min(targetZoom, fitZoom);

  // Exponential smoothing keeps the camera response consistent at 60Hz and 120Hz.
  const follow = 1 - Math.pow(0.85, delta / STEP);
  renderState.camX = lerp(renderState.camX, midX, follow);
  renderState.camY = lerp(renderState.camY, H / 2 - airFollowY, follow);
  renderState.camZoom = lerp(renderState.camZoom, targetZoom, follow);

  const zoom = Math.min(renderState.camZoom, fitZoom);
  const halfViewW = viewWidth / (2 * zoom);
  const cameraMargin = Math.max(0, halfViewW - dist / 2 - 98);
  const trackedX = clamp(renderState.camX, midX - cameraMargin, midX + cameraMargin);
  const clampedCamX = clamp(trackedX, halfViewW, WORLD_W - halfViewW);

  ctx.save();

  // Apply screen shake
  if (match.shake > 0 && !match.reducedMotion) {
    ctx.translate(
      Math.sin(frameNumber * 2.6) * match.shake,
      Math.cos(frameNumber * 1.9) * match.shake * 0.35
    );
  }

  // Camera transform from World (1600x720) to Screen (1280x720)
  ctx.translate(W * 0.5, H * 0.55);
  ctx.scale(zoom, zoom);
  ctx.translate(-clampedCamX, -(H * 0.55 - (H * 0.5 - renderState.camY)));

  // 1. Stage Background with subtle parallax
  const stageImg = images.get(match.stage.image);
  if (stageImg) {
    const parallaxX = (clampedCamX - WORLD_W * 0.5) * 0.18;
    const stageWidth = WORLD_W + 220;
    const stageHeight = stageWidth * stageImg.naturalHeight / stageImg.naturalWidth;
    ctx.drawImage(stageImg, -110 + parallaxX, GROUND - stageHeight * 0.86, stageWidth, stageHeight);
  }

  // 2. Stage Atmospheric Effects
  if (match.stageId === 'seattle' && !match.reducedMotion) {
    const shift = (frameNumber * 8) % H;
    ctx.drawImage(renderState.rain, clampedCamX - W * 0.5, shift);
    ctx.drawImage(renderState.rain, clampedCamX - W * 0.5, shift - H);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 4; i++) {
      const lx = 260 + i * 360 + Math.sin(frameNumber * 0.015 + i) * 40;
      ctx.drawImage(renderState.seattleGlow, lx - 130, 50, 260, 260);
    }
    ctx.restore();
  } else if (match.stageId === 'coliseum') {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < 6; i++) {
      const x = 180 + i * 250 + Math.sin(frameNumber * 0.016 + i) * 75;
      ctx.drawImage(renderState.coliseumGlow, x - 120, 55, 240, 240);
    }
    ctx.restore();
  } else if (!match.reducedMotion) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 20; i++) {
      const x = (i * 137 + frameNumber * 0.3) % WORLD_W;
      const y = 110 + ((i * 89 - frameNumber * 0.16 + H) % 450);
      ctx.drawImage(renderState.mote, x, y, 5, 5);
    }
    ctx.restore();
  }

  // Hyper Combo speedline backdrop overlay when active
  const hyperActive = [p1, p2].some(fighter => fighter.move?.superMove
    && fighter.moveFrame < fighter.move.startup + fighter.move.active);
  if (hyperActive || match.freeze > 0) {
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, screenOffset, 0);
    drawHyperBackground(ctx, match, match.reducedMotion ? 0 : frameNumber);
    ctx.restore();
  }

  // 3. Stage Floor Shading & Reflective Surface
  ctx.fillStyle = renderState.floorShade;
  ctx.fillRect(0, GROUND - 110, WORLD_W, H - (GROUND - 110));

  // Real-time Wet Stage Reflection of Fighters!
  function drawReflection(fighter, x, y) {
    const sheet = images.get(fighter.data.sheet);
    const air = GROUND - y;
    if (air > 260 || fighter.state === 'knockdown') return;
    const frame = fighter.spriteFrame();
    const alpha = clamp(0.22 - air * 0.0007, 0.03, 0.22);
    const reflectY = GROUND + 2 + air * 0.36;
    drawSheet(
      ctx,
      sheet,
      frame,
      x,
      reflectY,
      fighter.facing,
      SPRITE_SIZE,
      alpha,
      fighter.scaleX,
      -fighter.scaleY * 0.42
    );
  }

  if (match.stageId === 'seattle') {
    drawReflection(p1, x1, y1);
    drawReflection(p2, x2, y2);
  }

  // 4. Dynamic Ground Shadows & Character Rim Auras
  function drawShadow(fighter, x, y) {
    const air = GROUND - y;
    ctx.save();
    ctx.globalAlpha = clamp(0.54 - air * 0.0018, 0.14, 0.54);
    const width = clamp(200 - air * 0.3, 85, 200);
    ctx.drawImage(renderState.contactShadow, x - width / 2, GROUND - 19, width, 38);

    // Meter full ground aura ring
    if (fighter.meter >= 200 && fighter.grounded()) {
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = 0.26 + Math.sin(frameNumber * 0.15) * 0.1;
      ctx.strokeStyle = fighter.data.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(x, GROUND + 4, 68 + Math.sin(frameNumber * 0.12) * 8, 12, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 5. Fighter Sprite + Chromatic Ghost Trail + Status Indicators
  function drawFighter(fighter, x, y) {
    const sheet = images.get(fighter.data.sheet);

    // Chromatic afterimage trail (Dash / Super Jump / EX / Hyper)
    if (!match.reducedMotion && fighter.trail.length) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < fighter.trail.length; i++) {
        const ghost = fighter.trail[i];
        drawSheet(
          ctx,
          sheet,
          ghost.frame,
          ghost.x,
          ghost.y,
          ghost.facing,
          SPRITE_SIZE,
          (ghost.life / 12) * 0.24,
          1,
          1
        );
      }
      ctx.restore();
    }

    ctx.save();
    const flash = fighter.state === 'hitstun' && fighter.stateFrame < 3 && !match.reducedMotion;
    const frame = fighter.spriteFrame();
    const pose = inner => {
      const move = fighter.move;
      const time = fighter.stateFrame + interpolation;
      if (fighter.state === 'knockdown' || fighter.state === 'getup') {
        const rotation = fighter.state === 'knockdown'
          ? lerp(-0.34, -1.36, clamp(time / 7, 0, 1))
          : lerp(-1.36, 0, clamp(time / 12, 0, 1));
        inner.rotate(rotation);
        inner.translate(0, -Math.abs(rotation) * 16);
      } else if (fighter.state === 'dizzy') {
        inner.rotate(Math.sin(time * 0.14) * 0.085);
      } else if (move) {
        const windup = clamp((fighter.moveFrame + interpolation) / move.startup, 0, 1);
        const recovery = clamp((fighter.moveFrame - move.startup - move.active) / move.recovery, 0, 1);
        const anticipation = fighter.moveFrame < move.startup ? Math.sin(windup * Math.PI) : 0;
        const extension = fighter.moveFrame >= move.startup ? 1 - recovery : 0;
        const followThrough = move.name === 'airheavy' ? 0.29 : move.name === 'heavy' ? 0.13 : 0.045;
        inner.rotate(-0.095 * anticipation + followThrough * extension);
        if (move.name === 'crouchlight' && extension) inner.scale(1, 0.64);
        inner.scale(1 - 0.045 * anticipation + extension * 0.025, 1 - 0.055 * anticipation);
      } else if (fighter.state === 'walk') {
        const stride = Math.sin(fighter.walkCycle);
        inner.rotate(clamp(fighter.walkVx * fighter.facing * 0.004, -0.035, 0.035));
        inner.scale(1, 0.982 + stride * 0.018);
      } else if (fighter.state === 'jump' || fighter.dashType === 'air') {
        inner.rotate(clamp(fighter.jumpVx * fighter.facing * 0.009, -0.095, 0.095));
      } else if (fighter.state === 'idle' || fighter.state === 'victory') {
        inner.scale(1, 1 + Math.sin(time * 0.105) * 0.014);
      }
    };

    drawSheet(
      ctx,
      sheet,
      frame,
      x,
      y,
      fighter.facing,
      SPRITE_SIZE,
      ctx.globalAlpha,
      fighter.scaleX,
      fighter.scaleY,
      pose
    );

    if (flash) {
      ctx.globalCompositeOperation = 'lighter';
      drawSheet(
        ctx,
        sheet,
        frame,
        x,
        y,
        fighter.facing,
        SPRITE_SIZE,
        0.22,
        fighter.scaleX,
        fighter.scaleY,
        pose
      );
    }

    // MK FINISH HIM spinning dizzy stars over head
    if (fighter.state === 'dizzy') {
      ctx.globalCompositeOperation = 'screen';
      const headY = y - 338;
      for (let i = 0; i < 4; i++) {
        const angle = frameNumber * 0.11 + (i * Math.PI * 0.5);
        const sx = x + Math.cos(angle) * 44;
        const sy = headY + Math.sin(angle) * 11;
        ctx.fillStyle = i % 2 === 0 ? '#ffcf6e' : '#ff4733';
        ctx.beginPath();
        ctx.arc(sx, sy, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawShadow(p1, x1, y1);
  drawShadow(p2, x2, y2);

  // Draw non-attacking fighter first so attacking fighter overlaps on top
  if (p2.state === 'attack' && p1.state !== 'attack') {
    drawFighter(p1, x1, y1);
    drawFighter(p2, x2, y2);
  } else {
    drawFighter(p2, x2, y2);
    drawFighter(p1, x1, y1);
  }

  // 6. Signature moves and sonic projectiles
  if (!match.reducedMotion) {
    drawRush(ctx, p1, x1, y1, frameNumber);
    drawRush(ctx, p2, x2, y2, frameNumber);
  }
  drawHyperBeam(ctx, p1, x1, y1, frameNumber, renderState);
  drawHyperBeam(ctx, p2, x2, y2, frameNumber, renderState);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < match.projectiles.length; i++) {
    const p = match.projectiles[i];
    if (!renderState.projectileGlows.has(p.color)) {
      renderState.projectileGlows.set(p.color, renderState.makeGlow('#fff', p.color));
    }
    const glowSize = p.radius * 4.8;
    ctx.drawImage(
      renderState.projectileGlows.get(p.color),
      p.x - glowSize * 0.5,
      p.y - glowSize * 0.5,
      glowSize,
      glowSize
    );

    // Core sonic ring
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.52, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating shockwave crescents
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, frameNumber * 0.14, frameNumber * 0.14 + Math.PI * 1.45);
    ctx.stroke();

    ctx.strokeStyle = p.secondary || '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * 0.78, -frameNumber * 0.18, -frameNumber * 0.18 + Math.PI * 1.2);
    ctx.stroke();
  }

  // 7. Hit Sparks, Directional Slashes & Shockwave Rings
  for (let i = 0; i < match.effects.length; i++) {
    const fx = match.effects[i];
    ctx.globalAlpha = clamp(fx.life / (fx.maxLife || 18), 0, 1);
    ctx.fillStyle = fx.color;
    ctx.save();
    ctx.translate(fx.x, fx.y);
    if (fx.slash) {
      const angle = Math.atan2(fx.vy, fx.vx);
      ctx.rotate(angle);
      ctx.fillRect(-fx.size * 3.8, -1.8, fx.size * 7.6, 3.6);
    } else if (fx.spark) {
      ctx.rotate(fx.life * 0.22);
      ctx.fillRect(-fx.size * 1.4, -1.3, fx.size * 2.8, 2.6);
      ctx.fillRect(-1.3, -fx.size * 1.4, 2.6, fx.size * 2.8);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, fx.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  for (let i = 0; i < match.rings.length; i++) {
    const ring = match.rings[i];
    const progress = 1 - ring.life / ring.max;
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = (ring.heavy ? 8 : 5) * (1 - progress);
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, 18 + progress * (ring.heavy ? 135 : 92), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();

  // 8. Floating Arcade Damage Numbers
  if (match.damageNumbers && match.damageNumbers.length) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (let i = 0; i < match.damageNumbers.length; i++) {
      const dn = match.damageNumbers[i];
      const size = Math.round(26 * (dn.scale || 1));
      ctx.font = `italic 900 ${size}px Impact, "Arial Black", sans-serif`;
      ctx.globalAlpha = clamp(dn.life / 18, 0, 1);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = dn.color;
      ctx.strokeText(dn.text, dn.x, dn.y);
      ctx.fillText(dn.text, dn.x, dn.y);
    }
    ctx.restore();
  }

  ctx.restore();

  // 9. Screen-Space Vignette & Cinematic Overlays
  ctx.fillStyle = renderState.vignette;
  ctx.fillRect(0, 0, W, H);

  if (match.superFlash > 0 && !match.reducedMotion) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const flashColor = match.hyperColor || '#ffffff';
    ctx.fillStyle = flashColor;
    ctx.globalAlpha = (match.superFlash / 32) * 0.45;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // Hyper Combo K.O. sunburst finish (Marvel vs. Capcom signature!)
  if (match.koZoom > 0 && match.hyperFinish && !match.reducedMotion) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = clamp(match.koZoom / 38, 0, 0.55);
    ctx.translate(W * 0.5, H * 0.5);
    ctx.fillStyle = match.hyperColor || '#ff4733';
    for (let i = 0; i < 16; i++) {
      ctx.rotate((Math.PI * 2) / 16);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(900, -45);
      ctx.lineTo(900, 45);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  } else if (match.koZoom > 14 && !match.reducedMotion) {
    ctx.fillStyle = `rgba(255, 255, 255, ${(match.koZoom - 14) / 42})`;
    ctx.fillRect(0, 0, W, H);
  }
}
