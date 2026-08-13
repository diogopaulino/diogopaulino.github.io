/* ==========================================================================
   Ravi 1·2·3 — cenários e widgets numerados
   --------------------------------------------------------------------------
   Cada cenário é pintado UMA vez num canvas fora de tela e depois só blitado.
   Os widgets numerados são desenhados por cima, e o mesmo array de hotspots
   que posiciona os desenhos é o que responde ao toque — desenho e clique
   nunca podem sair de sincronia porque vêm da mesma fonte.
   ========================================================================== */

import { W, H, STAGE_H } from './screen.js';
import { K, Pen, blit, blitMid } from './assets.js';
import * as F from './font.js';
import { SPR, TOYS, VEHICLES, HEROES, FOODS } from './sprites.js';
import { bounceOut, wave, hop, wrap } from './anim.js';
import { bakeWorld, drawAmbient as drawWorldAmbient } from './world.js';

export { STAGE_H };

/* --------------------------------------------------------------------------
   Peças de UI diegética (pixel) — tudo reutiliza a mesma “ferragem”
   -------------------------------------------------------------------------- */

/** Sombra + chanfro elevado. */
function raised(pen, x, y, w, h, face, light, dark) {
  pen.col(K.BLACK).rect(x + 1, y + 1, w, h);
  pen.bevel(x, y, w, h, face, light, dark);
  // Brilho interno de 1px no topo
  pen.col(light).hline(x + 2, y + 2, Math.max(0, w - 4));
}

/** Chanfro afundado (tecla / poço). */
function sunk(pen, x, y, w, h, face, light, dark) {
  pen.col(K.BLACK).rect(x, y, w, h);
  pen.inset(x + 1, y + 1, w - 2, h - 2, face, light, dark);
}

/** Rebite metálico. */
function rivet(pen, x, y) {
  pen.col(K.BLACK).px(x, y).px(x + 1, y).px(x, y + 1);
  pen.col(K.GRAY_L).px(x, y);
  pen.col(K.GRAY).px(x + 1, y).px(x, y + 1);
}

/** Estrelinha de 5 px — ornamento de título/flashcard. */
function spark(pen, x, y, c = K.YEL_L) {
  pen.col(c).px(x, y - 1).px(x - 1, y).px(x, y).px(x + 1, y).px(x, y + 1);
}

/** Badge numérico com fundo creme (contraste em madeira/azul). */
function numBadge(ctx, pen, n, cx, cy, scale = 2, fg = K.RED, face = K.CREAM) {
  const label = String(n);
  const tw = F.measure(label, scale);
  const bw = tw + 6;
  const bh = 7 * scale + 2;
  const bx = Math.round(cx - bw / 2);
  const by = Math.round(cy - bh / 2);
  raised(pen, bx, by, bw, bh, face, face === K.CREAM ? K.WHITE : K.YEL_L, face === K.CREAM ? K.GRAY_D : K.RED_D);
  F.text(ctx, label, Math.round(cx - tw / 2), by + 2, fg, { scale, shadow: face === K.CREAM ? K.SAND : K.RED_D });
}

/** Cenário VGA assado — a vida (estrelas, nuvens) vai em `drawAmbient`. */
export function backdrop(id) {
  return bakeWorld(id);
}

export function drawAmbient(ctx, id, t) {
  drawWorldAmbient(ctx, id, t);
}

/* --------------------------------------------------------------------------
   Chrome: barra de fala e flashcard
   -------------------------------------------------------------------------- */

/** Barra de narração no rodapé — cromada, com filete dourado e ícone. */
export function speechBar(ctx, message) {
  const pen = new Pen(ctx);
  const y = STAGE_H;
  const h = H - STAGE_H;

  // Base preta + face navy com chanfro
  pen.col(K.BLACK).rect(0, y, W, h);
  pen.bevel(1, y + 1, W - 2, h - 2, K.NAVY, K.BLU, K.NIGHT);
  // Filete dourado no topo (como moldura de CRT educativo)
  pen.col(K.OCHRE).hline(2, y + 1, W - 4);
  pen.col(K.YEL).hline(2, y + 2, W - 4);
  pen.col(K.NIGHT).hline(2, H - 2, W - 4);

  // Ícone de fala (boquinha) à esquerda
  pen.col(K.YEL_L).ellipse(12, y + (h >> 1), 5, 4);
  pen.col(K.NAVY).ellipse(12, y + (h >> 1), 3, 2);
  pen.col(K.YEL).px(17, y + (h >> 1) - 1).px(18, y + (h >> 1)).px(17, y + (h >> 1) + 1);

  if (!message) return;
  const lines = F.wrap(message, W - 36);
  const startY = y + (h - (lines.length * F.LINE - 2)) / 2 + 1;
  for (let i = 0; i < lines.length; i++) {
    F.textCenter(ctx, lines[i], W / 2 + 4, Math.round(startY + i * F.LINE), K.YEL_L, { shadow: K.BLACK });
  }
}

/**
 * Flashcard do numeral — cartão de ensino com moldura vermelha e brilho.
 * `pop` (0..1) anima a entrada com bounce.
 */
export function flashcard(ctx, n, pop = 1) {
  if (n === null || n === undefined) return;
  const pen = new Pen(ctx);
  const scale = 3;
  const w = 52;
  const h = 66;
  const grow = bounceOut(Math.min(1, Math.max(0, pop)));
  const cw = Math.round(w * (0.55 + grow * 0.45));
  const chh = Math.round(h * (0.55 + grow * 0.45));
  const x = Math.round((W - cw) / 2);
  const y = Math.round(18 - (chh - h) / 2 - (1 - grow) * 12);

  // Sombra elíptica
  pen.col(K.BLACK).ellipse(W / 2, y + chh + 5, Math.round(cw * 0.38), 4);
  // Cartão
  pen.col(K.BLACK).rect(x + 3, y + 3, cw, chh);
  pen.bevel(x, y, cw, chh, K.CREAM, K.WHITE, K.GRAY);
  pen.col(K.WHITE).hline(x + 3, y + 3, Math.max(0, cw - 6));
  // Moldura dupla vermelha
  pen.col(K.RED_D).frame(x + 3, y + 3, cw - 6, chh - 6);
  pen.col(K.RED).frame(x + 4, y + 4, cw - 8, chh - 8);
  pen.col(K.RED_L).frame(x + 5, y + 5, cw - 10, chh - 10);
  // Cantos decorativos
  if (grow > 0.4) {
    spark(pen, x + 8, y + 10, K.YEL);
    spark(pen, x + cw - 9, y + 10, K.YEL);
    spark(pen, x + 8, y + chh - 10, K.ORANGE);
    spark(pen, x + cw - 9, y + chh - 10, K.ORANGE);
  }

  if (grow > 0.55) {
    const label = String(n);
    const tw = F.measure(label, scale);
    F.text(ctx, label, Math.round(x + (cw - tw) / 2), y + 16, K.RED, { scale, shadow: K.RED_D });
  }
}

/* --------------------------------------------------------------------------
   Widgets numerados — os números fazem parte do cenário
   -------------------------------------------------------------------------- */

/** Célula base: quadro afundado, miniatura à esquerda, numeral à direita. */
function cell(ctx, spot, opts = {}) {
  const pen = new Pen(ctx);
  const pulse = opts.pulse ? hop(opts.clock || 0, 4, 1, spot.n) : 0;
  const { w, h } = spot;
  const x = spot.x;
  const y = spot.y - pulse;
  const disabled = opts.done || opts.locked;

  sunk(pen, x, y, w, h, disabled ? K.GRAY : K.CREAM, K.WHITE, K.GRAY_D);
  if (!disabled) pen.col(K.WHITE).hline(x + 3, y + 2, w - 6);

  if (opts.icon) blitMid(ctx, opts.icon, x + 13, y + h / 2);
  else if (opts.label) F.text(ctx, opts.label, x + 4, y + (h - 7) / 2, K.GRAY_XD);

  const numColor = opts.locked ? K.GRAY_D : opts.done ? K.GRN_D : K.RED;
  const label = String(spot.n);
  const tw = F.measure(label, 2);
  F.text(ctx, label, Math.round(x + w - tw - 6), Math.round(y + (h - 14) / 2), numColor, {
    scale: 2,
    shadow: K.SAND
  });

  if (opts.done) {
    pen.col(K.BLACK).rect(x + 4, y + 3, 14, 12);
    pen.col(K.GRN).rect(x + 5, y + 4, 12, 10);
    pen.col(K.GRN_L).line(x + 7, y + 9, x + 10, y + 12).line(x + 10, y + 12, x + 16, y + 5);
  }
  if (opts.locked) {
    pen.col(K.GRAY_XD).rect(x + 9, y + h / 2 - 2, 8, 7);
    pen.col(K.YEL).ring(x + 13, y + h / 2 - 3, 3);
  }
}

/**
 * Coluna vertical de brinquedos — o widget da tela original da fábrica.
 * Devolve os hotspots já na ordem 1..9 (de baixo para cima, como no original).
 */
export function toyColumnSpots() {
  const spots = [];
  const cw = 52;
  const ch = 18;
  const x = 134;
  // 1 embaixo e 9 em cima, como na tela original
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x, y: 2 + (8 - i) * ch, w: cw, h: ch });
  }
  return spots;
}

/* Sem rótulo de texto: no jogo original a célula traz só a miniatura do
   brinquedo e o numeral grande. A criança escolhe pela figura. */
export function drawToyColumn(ctx, spots, madeIds, clock = 0) {
  for (const spot of spots) {
    const toy = TOYS[spot.n - 1];
    cell(ctx, spot, { icon: SPR.toy[toy.id], done: madeIds.includes(toy.id), pulse: true, clock });
  }
}

/**
 * Painel de controle da moldadora — a fileira 1–9 desenhada na máquina.
 */
export function machinePanelSpots() {
  const spots = [];
  const bw = 22;
  const gap = 2;
  const total = 9 * bw + 8 * gap;
  const x0 = Math.round((W - total) / 2);
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x: x0 + i * (bw + gap), y: 130, w: bw, h: 20 });
  }
  return spots;
}

export function drawMachinePanel(ctx, spots, active, clock = 0) {
  const pen = new Pen(ctx);
  const first = spots[0];
  const last = spots[spots.length - 1];
  const width = last.x + last.w - first.x;
  raised(pen, first.x - 7, first.y - 14, width + 14, first.h + 22, K.GRAY, K.GRAY_L, K.GRAY_D);
  rivet(pen, first.x - 4, first.y - 11);
  rivet(pen, first.x + width + 2, first.y - 11);
  rivet(pen, first.x - 4, first.y + first.h + 2);
  rivet(pen, first.x + width + 2, first.y + first.h + 2);
  raised(pen, Math.round(W / 2 - 36), first.y - 12, 72, 10, K.NAVY, K.BLU, K.NIGHT);
  F.textCenter(ctx, 'TOQUE!', W / 2, first.y - 10, K.YEL_L, { shadow: K.BLACK });

  for (const spot of spots) {
    const on = spot.n === active;
    const pulse = !on && hop(clock, 5, 1, spot.n);
    sunk(pen, spot.x, spot.y - pulse, spot.w, spot.h,
      on ? K.YEL : K.BLU, on ? K.YEL_L : K.BLU_L, on ? K.OCHRE : K.BLU_D);
    if (on) pen.col(K.WHITE).hline(spot.x + 2, spot.y - pulse + 2, spot.w - 4);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(ctx, label, Math.round(spot.x + (spot.w - tw) / 2), spot.y - pulse + 3,
      on ? K.RED : K.WHITE, { scale: 2, shadow: K.BLACK });
  }
}

/** Placa de caminhos da encruzilhada. */
export function signpostSpots(showParty) {
  const spots = [];
  const labels = showParty ? 4 : 3;
  for (let i = 0; i < labels; i++) {
    spots.push({ n: i + 1, x: 96, y: 24 + i * 22, w: 128, h: 19 });
  }
  return spots;
}

export function drawSignpost(ctx, spots, state, clock = 0) {
  const pen = new Pen(ctx);
  const names = ['FÁBRICA', 'MERCADO', 'CARTAS', 'FESTA!'];
  const done = [state.presentDone, state.marketDone, state.inviteDone, false];
  const icons = [SPR.toy.robo, SPR.food.apple, SPR.misc.envelope, SPR.food.balloon];

  pen.col(K.BLACK).rect(148, 18, 14, 112);
  pen.col(K.WOOD_D).rect(149, 19, 12, 110);
  pen.col(K.OCHRE).vline(151, 19, 110);
  pen.col(K.SAND).vline(152, 22, 20).vline(152, 55, 18).vline(152, 90, 16);
  pen.col(K.BLACK).rect(142, 126, 26, 6);
  pen.col(K.WOOD_D).rect(143, 127, 24, 4);

  for (const spot of spots) {
    const i = spot.n - 1;
    const party = i === 3;
    const pulse = hop(clock, party ? 5 : 3.2, party ? 2 : 1, i);
    const y = spot.y - pulse;
    raised(pen, spot.x, y, spot.w, spot.h,
      party ? K.YEL : K.OCHRE, party ? K.YEL_L : K.SAND, K.WOOD_D);
    if (!party) {
      pen.col(K.SAND).hline(spot.x + 4, y + 5, spot.w - 14);
      pen.col(K.WOOD_D).hline(spot.x + 4, y + spot.h - 4, spot.w - 14);
    }
    pen.col(K.BLACK);
    for (let k = 0; k < 9; k++) pen.vline(spot.x + spot.w + k, y + k, spot.h - k * 2);
    pen.col(party ? K.YEL : K.OCHRE);
    for (let k = 0; k < 8; k++) pen.vline(spot.x + spot.w + k, y + 1 + k, spot.h - 2 - k * 2);
    pen.col(party ? K.YEL_L : K.SAND).vline(spot.x + spot.w, y + 2, spot.h - 4);

    numBadge(ctx, pen, spot.n, spot.x + 14, y + (spot.h >> 1), 2, K.YEL_L, K.RED);
    if (icons[i]) {
      const ic = icons[i];
      ctx.drawImage(ic.canvas, spot.x + 26, y + 2, 14, 14);
    }
    F.text(ctx, names[i], spot.x + 44, y + 6, K.WOOD_D, { shadow: party ? K.OCHRE : K.SAND });

    if (done[i]) {
      pen.col(K.BLACK).rect(spot.x + 106, y + 4, 14, 12);
      pen.col(K.GRN).rect(spot.x + 107, y + 5, 12, 10);
      pen.col(K.GRN_L)
        .line(spot.x + 109, y + 10, spot.x + 112, y + 13)
        .line(spot.x + 112, y + 13, spot.x + 118, y + 6);
    }
  }
}

/** Fileira de veículos 0–9, em duas linhas de cinco. */
export function vehicleSpots() {
  const spots = [];
  for (let i = 0; i < 10; i++) {
    const col = i % 5;
    const row = (i / 5) | 0;
    spots.push({ n: i, x: 6 + col * 62, y: 14 + row * 70, w: 58, h: 62 });
  }
  return spots;
}

/** Faixa compacta 0–9 para trocar de veículo durante a viagem. */
export function travelSwapSpots() {
  const spots = [];
  const bw = 28;
  const gap = 2;
  const total = 10 * bw + 9 * gap;
  const x0 = Math.round((W - total) / 2);
  for (let i = 0; i < 10; i++) {
    spots.push({ n: i, x: x0 + i * (bw + gap), y: 4, w: bw, h: 18 });
  }
  return spots;
}

export function drawTravelSwap(ctx, spots, activeN) {
  const pen = new Pen(ctx);
  const first = spots[0];
  const last = spots[spots.length - 1];
  const width = last.x + last.w - first.x;
  // Trilho cromado atrás das teclas
  raised(pen, first.x - 4, first.y - 3, width + 8, first.h + 6, K.NAVY, K.BLU, K.NIGHT);

  for (const spot of spots) {
    const on = spot.n === activeN;
    sunk(pen, spot.x, spot.y, spot.w, spot.h,
      on ? K.YEL : K.CREAM, on ? K.YEL_L : K.WHITE, on ? K.OCHRE : K.GRAY_D);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(ctx, label, Math.round(spot.x + (spot.w - tw) / 2), spot.y + 2,
      on ? K.RED : K.GRAY_XD, { scale: 2, shadow: on ? K.SAND : undefined });
  }
}

export function drawVehicleRack(ctx, spots, clock = 0) {
  const pen = new Pen(ctx);
  for (const spot of spots) {
    const v = VEHICLES[spot.n];
    const pulse = hop(clock, 3.4, 1, spot.n);
    const y = spot.y - pulse;
    raised(pen, spot.x, y, spot.w, spot.h, K.CREAM, K.WHITE, K.GRAY_D);
    pen.col(K.NAVY).rect(spot.x + 2, y + 2, spot.w - 4, 10);
    pen.col(K.BLU).hline(spot.x + 2, y + 2, spot.w - 4);
    const twN = F.measure(String(spot.n), 2);
    F.text(ctx, String(spot.n), Math.round(spot.x + (spot.w - twN) / 2), y + 2,
      K.YEL_L, { scale: 2, shadow: K.BLACK });

    const sprite = v.wheels === 0 ? SPR.ravi.idle : SPR.vehicle[v.id];
    const half = sprite.w > spot.w - 6 || sprite.h > 26;
    const dw = half ? Math.round(sprite.w / 2) : sprite.w;
    const dh = half ? Math.round(sprite.h / 2) : sprite.h;
    ctx.drawImage(
      sprite.canvas,
      Math.round(spot.x + (spot.w - dw) / 2),
      Math.round(y + 28 - dh / 2),
      dw, dh
    );

    F.textCenter(ctx, v.name, spot.x + spot.w / 2, y + 42, K.GRAY_XD);
    const chip = `${v.wheels}`;
    const cw = F.measure(chip, 1) + 10;
    raised(pen, Math.round(spot.x + (spot.w - cw) / 2), y + spot.h - 13, cw, 10, K.YEL, K.YEL_L, K.OCHRE);
    F.textCenter(ctx, chip + 'R', spot.x + spot.w / 2, y + spot.h - 11, K.RED_D);
  }
}

/** Quadro de quantidade do mercado: 1 a 9. */
export function quantitySpots() {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = (i / 3) | 0;
    spots.push({ n: i + 1, x: 210 + col * 34, y: 24 + row * 28, w: 30, h: 26 });
  }
  return spots;
}

export function drawQuantityBoard(ctx, spots, title, clock = 0) {
  const pen = new Pen(ctx);
  raised(pen, 202, 4, 112, 106, K.WOOD_D, K.OCHRE, K.GRAY_XD);
  rivet(pen, 206, 8);
  rivet(pen, 306, 8);
  rivet(pen, 206, 100);
  rivet(pen, 306, 100);
  raised(pen, 210, 8, 96, 12, K.NAVY, K.BLU, K.NIGHT);
  F.textCenter(ctx, title, 258, 10, K.YEL_L, { shadow: K.BLACK });

  for (const spot of spots) {
    const pulse = hop(clock, 4.5, 1, spot.n);
    sunk(pen, spot.x, spot.y - pulse, spot.w, spot.h, K.CREAM, K.WHITE, K.GRAY_D);
    pen.col(K.WHITE).hline(spot.x + 3, spot.y - pulse + 2, spot.w - 6);
    const label = String(spot.n);
    const tw = F.measure(label, 3);
    F.text(ctx, label, Math.round(spot.x + (spot.w - tw) / 2), spot.y - pulse + 4, K.RED, {
      scale: 3,
      shadow: K.SAND
    });
  }
}

/**
 * Carrinho de compras com os itens já escolhidos dentro do cesto.
 * `cart` é o mapa { foodId: qty } do estado do jogo.
 */
export function drawShoppingCart(ctx, cart, footX = 150, footY = 158, t = 0) {
  const body = SPR.misc.cart;
  if (!body) return;
  const wobble = t ? wave(t, 6, 1) : 0;
  const bx = Math.round(footX - body.w / 2) + wobble;
  const by = footY - body.h;
  blit(ctx, body, bx, by);

  // Miolo creme do cesto — os itens empilham aqui, bem visíveis
  const originX = bx + 16;
  const originY = by + 16;
  const cols = 4;
  let slot = 0;
  for (const food of FOODS) {
    const qty = cart[food.id] || 0;
    for (let i = 0; i < qty && slot < 12; i++, slot++) {
      const col = slot % cols;
      const row = (slot / cols) | 0;
      const jiggle = t ? hop(t, 5 + (slot % 3), 1, slot) : 0;
      blitMid(ctx, SPR.food[food.id], originX + col * 11, originY + row * 9 - jiggle);
    }
  }
}

/** Parede de caixas postais numeradas dos correios. */
export function mailboxSpots() {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const col = i % 5;
    const row = (i / 5) | 0;
    spots.push({ n: i + 1, x: 8 + col * 61, y: 28 + row * 44, w: 57, h: 40 });
  }
  spots.push({ n: 0, x: 252, y: 72, w: 57, h: 40 });
  return spots;
}

export function drawMailboxes(ctx, spots, state, clock = 0) {
  const pen = new Pen(ctx);
  for (const spot of spots) {
    const pulse = hop(clock, 3.6, 1, spot.n);
    const y = spot.y - (spot.n === 0 || state.invited.includes(spot.n - 1) ? 0 : pulse);
    if (spot.n === 0) {
      raised(pen, spot.x, y, spot.w, spot.h, K.GRN, K.GRN_L, K.GRN_D);
      F.textCenter(ctx, 'PRONTO', spot.x + spot.w / 2, y + 6, K.WHITE, { shadow: K.GRN_D });
      F.textCenter(ctx, 'VOLTAR', spot.x + spot.w / 2, y + 16, K.WHITE, { shadow: K.GRN_D });
      numBadge(ctx, pen, 0, spot.x + spot.w / 2, y + 30, 2, K.RED);
      continue;
    }

    const idx = spot.n - 1;
    const hero = HEROES[idx];
    const locked = idx === state.honoree;
    const invited = state.invited.includes(idx);

    raised(pen, spot.x, y, spot.w, spot.h,
      locked ? K.GRAY : invited ? K.GRN_D : K.BLU_D,
      locked ? K.GRAY_L : invited ? K.GRN_L : K.BLU_L,
      K.GRAY_XD);

    sunk(pen, spot.x + 3, y + 3, 20, 32, locked ? K.GRAY_D : K.CREAM, K.WHITE, K.GRAY_XD);
    ctx.save();
    ctx.beginPath();
    ctx.rect(spot.x + 4, y + 4, 18, 30);
    ctx.clip();
    blit(ctx, SPR.hero[hero.id], spot.x + 2, y + 2);
    ctx.restore();
    if (locked) {
      pen.col(K.BLACK).rect(spot.x + 5, y + 14, 16, 10);
      F.text(ctx, 'SHH', spot.x + 6, y + 16, K.YEL_L, { shadow: K.BLACK });
    }

    raised(pen, spot.x + 26, y + 4, 26, 16, K.YEL, K.YEL_L, K.OCHRE);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(ctx, label, Math.round(spot.x + 39 - tw / 2), y + 5,
      locked ? K.GRAY_XD : K.RED, { scale: 2, shadow: K.SAND });

    F.text(ctx, hero.short, spot.x + 25, y + 26, locked ? K.GRAY_L : K.WHITE,
      { shadow: K.BLACK });
    if (invited) {
      pen.col(K.BLACK).rect(spot.x + 44, y + 24, 10, 10);
      pen.col(K.GRN).rect(spot.x + 45, y + 25, 8, 8);
      pen.col(K.GRN_L)
        .line(spot.x + 46, y + 29, spot.x + 48, y + 31)
        .line(spot.x + 48, y + 31, spot.x + 52, y + 26);
    }
  }
}

/** Pratos numerados da mesa da festa. */
export function plateSpots() {
  const spots = [];
  // Fileira baixa, abaixo dos convidados (pés ~142) e acima da barra de fala
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x: 44 + i * 30, y: 148, w: 28, h: 16 });
  }
  return spots;
}

/** Pratos: oval creme + numeral + miniatura da comida da vez (Mickey 123). */
export function drawPlates(ctx, spots, food, clock = 0) {
  const pen = new Pen(ctx);
  for (const spot of spots) {
    const bounce = hop(clock, 4.8, 2, spot.n);
    const cx = Math.round(spot.x + spot.w / 2);
    const cy = Math.round(spot.y + spot.h / 2) - bounce;
    pen.col(K.BLACK).ellipse(cx + 1, cy + 1, 12, 7);
    pen.col(K.GRAY).ellipse(cx, cy, 12, 7);
    pen.col(K.CREAM).ellipse(cx, cy, 10, 5);
    pen.col(K.WHITE).ellipse(cx - 2, cy - 1, 3, 2);
    if (food) blitMid(ctx, SPR.food[food.id], cx - 5, cy - 2);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    pen.col(K.BLACK).rect(cx - (tw >> 1) - 2, spot.y - 3 - bounce, tw + 4, 11);
    pen.bevel(cx - (tw >> 1) - 1, spot.y - 2 - bounce, tw + 2, 9, K.YEL, K.YEL_L, K.OCHRE);
    F.text(ctx, label, Math.round(cx - tw / 2), spot.y - 1 - bounce, K.RED, { scale: 2 });
  }
}

/* --------------------------------------------------------------------------
   Hit-test
   -------------------------------------------------------------------------- */

/**
 * Descobre qual hotspot foi tocado. O alvo é ampliado em `pad` pixels para
 * perdoar o dedo — importante porque o jogo é para crianças pequenas.
 */
export function hitTest(spots, x, y, pad = 6) {
  if (!spots) return null;
  for (const spot of spots) {
    if (x >= spot.x - pad && x < spot.x + spot.w + pad &&
        y >= spot.y - pad && y < spot.y + spot.h + pad) {
      return spot.n;
    }
  }
  return null;
}

/** Confete da festa — formas variadas, sem alocar no draw. */
export function makeConfetti(count) {
  const arr = [];
  const colors = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.CYAN, K.ORANGE, K.PUR];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: (i * 47 + 13) % W,
      y: (i * 31 + 7) % STAGE_H,
      speed: 18 + (i % 7) * 5,
      drift: 1 + (i % 4),
      spin: 3 + (i % 5),
      size: 2 + (i % 3),
      shape: i % 3, // 0 rect, 1 tall, 2 diamond-ish
      color: colors[i % colors.length]
    });
  }
  return arr;
}

export function drawConfetti(ctx, arr, t) {
  const pen = new Pen(ctx);
  for (const p of arr) {
    const y = wrap(p.y + t * p.speed, STAGE_H);
    const x = p.x + wave(t, p.drift, 5, p.x);
    const flip = ((t * p.spin + p.x) | 0) & 1;
    pen.col(p.color);
    if (p.shape === 0) {
      pen.rect(x, y | 0, p.size + flip, p.size + (1 - flip));
    } else if (p.shape === 1) {
      pen.rect(x, y | 0, 1 + flip, p.size + 2);
    } else {
      pen.px(x, y | 0).px(x + 1, (y | 0) + 1).px(x - 1, (y | 0) + 1).px(x, (y | 0) + 2);
    }
  }
}

/** Balões nas laterais da festa — flutuam e balançam o fio. */
export function drawBalloons(ctx, count, t) {
  const pen = new Pen(ctx);
  const palette = [K.RED, K.YEL, K.BLU, K.PINK, K.GRN, K.ORANGE, K.PUR, K.CYAN];
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const slot = (i / 2) | 0;
    const baseX = left
      ? Math.round(18 + slot * 16)
      : Math.round(W - 18 - slot * 16);
    const sway = wave(t, 1.4 + i * 0.07, 3, i * 1.3);
    const bob = wave(t, 1.8 + i * 0.11, 4, i);
    const x = baseX + sway;
    const y = 38 + bob;
    // Fio curvado
    pen.col(K.CREAM);
    pen.px(baseX, y + 10);
    pen.px(baseX + (sway >> 1), y + 16);
    pen.vline(x, y + 8, 4);
    // Sombra + balão
    pen.col(K.BLACK).ellipse(x + 1, y + 1, 7, 8);
    if (SPR.food.balloon) blitMid(ctx, SPR.food.balloon, x, y);
    else {
      pen.col(K.BLACK).ellipse(x, y, 7, 8);
      pen.col(palette[i % palette.length]).ellipse(x, y, 6, 7);
    }
    pen.col(K.WHITE).ellipse(x - 2, y - 3, 2, 2);
    pen.col(palette[i % palette.length]).px(x, y + 8);
  }
}

/** Estourinhos quando a criança mexe — nada fica “morto”. */
export function spawnPops(arr, x, y, t) {
  const colors = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.CYAN, K.ORANGE, K.PUR];
  for (let i = 0; i < 10; i++) {
    arr.push({ x, y, born: t, i, color: colors[i % colors.length] });
  }
  if (arr.length > 90) arr.splice(0, arr.length - 90);
}

export function drawPops(ctx, arr, t) {
  const pen = new Pen(ctx);
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    const age = t - p.born;
    if (age > 0.65) {
      arr.splice(i, 1);
      continue;
    }
    const ang = p.i * 0.7;
    const d = age * 42;
    const px = Math.round(p.x + Math.cos(ang) * d);
    const py = Math.round(p.y + Math.sin(ang) * d - age * 22);
    pen.col(p.color).px(px, py).px(px + 1, py);
    if (age < 0.2) pen.col(K.WHITE).px(px, py - 1);
  }
}
