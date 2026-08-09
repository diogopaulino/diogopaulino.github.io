/* ==========================================================================
   Ravi 1·2·3 — cenários e widgets numerados
   --------------------------------------------------------------------------
   Cada cenário é pintado UMA vez num canvas fora de tela e depois só blitado.
   Os widgets numerados são desenhados por cima, e o mesmo array de hotspots
   que posiciona os desenhos é o que responde ao toque — desenho e clique
   nunca podem sair de sincronia porque vêm da mesma fonte.
   ========================================================================== */

import { W, H, makeSurface } from './screen.js';
import { K, Pen, blit, blitMid, IMG } from './assets.js';
import * as F from './font.js';
import { SPR, TOYS, VEHICLES, HEROES } from './sprites.js';

export const STAGE_H = 166;  // altura da área de jogo (o resto é a barra de fala)

/** Cache de cenários já assados. */
const baked = new Map();

/**
 * Devolve o canvas do cenário, assando na primeira vez que for pedido.
 * Chamado em `enter()` de cada cena, nunca dentro do loop de render.
 */
export function backdrop(id) {
  let surface = baked.get(id);
  if (surface) return surface;

  const s = makeSurface(W, STAGE_H);
  
  const imgMap = {
    houseNight: 'house_night',
    houseDay: 'house_day',
    field: 'field_night',
    street: 'street',
    factory: 'factory',
    market: 'market',
    post: 'post',
    party: 'party'
  };
  
  const imgName = imgMap[id];
  if (imgName && IMG[imgName]) {
    s.ctx.drawImage(IMG[imgName], 0, 0, W, STAGE_H);
  } else {
    // Fallback preto
    const pen = new Pen(s.ctx);
    pen.col(K.BLACK).rect(0, 0, W, STAGE_H);
  }

  surface = s.canvas;
  baked.set(id, surface);
  return surface;
}

/* --------------------------------------------------------------------------
   Chrome: barra de fala e flashcard
   -------------------------------------------------------------------------- */

/** Barra de narração no rodapé, no lugar do balão de vidro antigo. */
export function speechBar(ctx, message) {
  const pen = new Pen(ctx);
  const y = STAGE_H;
  const h = H - STAGE_H;
  pen.col(K.BLACK).rect(0, y, W, h);
  pen.col(K.NAVY).rect(1, y + 1, W - 2, h - 2);
  pen.col(K.BLU).hline(1, y + 1, W - 2).vline(1, y + 1, h - 2);
  pen.col(K.NIGHT).hline(1, H - 2, W - 2).vline(W - 2, y + 1, h - 2);

  if (!message) return;
  const lines = F.wrap(message, W - 16);
  const startY = y + (h - (lines.length * F.LINE - 2)) / 2;
  for (let i = 0; i < lines.length; i++) {
    F.textCenter(ctx, lines[i], W / 2, Math.round(startY + i * F.LINE), K.YEL_L, { shadow: K.BLACK });
  }
}

/**
 * Flashcard do numeral — o elemento de ensino do jogo original.
 * `pop` (0..1) é usado para a animação de entrada.
 */
export function flashcard(ctx, n, pop = 1) {
  if (n === null || n === undefined) return;
  const pen = new Pen(ctx);
  const scale = 3;
  const w = 44;
  const h = 58;
  const grow = Math.min(1, Math.max(0, pop));
  const cw = Math.round(w * (0.6 + grow * 0.4));
  const chh = Math.round(h * (0.6 + grow * 0.4));
  const x = Math.round((W - cw) / 2);
  const y = Math.round(26 - (chh - h) / 2);

  pen.col(K.BLACK).rect(x + 3, y + 3, cw, chh);
  pen.bevel(x, y, cw, chh, K.CREAM, K.WHITE, K.GRAY);
  pen.col(K.RED).frame(x + 3, y + 3, cw - 6, chh - 6);

  if (grow > 0.7) {
    const label = String(n);
    const tw = F.measure(label, scale);
    F.text(ctx, label, Math.round(x + (cw - tw) / 2), y + 13, K.RED, { scale, shadow: K.RED_D });
  }
}

/* --------------------------------------------------------------------------
   Widgets numerados — os números fazem parte do cenário
   -------------------------------------------------------------------------- */

/** Célula base: quadro afundado, miniatura à esquerda, numeral à direita. */
function cell(ctx, spot, opts = {}) {
  const pen = new Pen(ctx);
  const { x, y, w, h } = spot;
  const disabled = opts.done || opts.locked;

  pen.col(K.BLACK).rect(x, y, w, h);
  pen.bevel(x + 1, y + 1, w - 2, h - 2, disabled ? K.GRAY : K.CREAM, K.WHITE, K.GRAY_D);

  if (opts.icon) blitMid(ctx, opts.icon, x + 13, y + h / 2);
  else if (opts.label) F.text(ctx, opts.label, x + 4, y + (h - 7) / 2, K.GRAY_XD);

  const numColor = opts.locked ? K.GRAY_D : opts.done ? K.GRN_D : K.RED;
  const label = String(spot.n);
  const tw = F.measure(label, 2);
  F.text(ctx, label, Math.round(x + w - tw - 8), Math.round(y + (h - 14) / 2), numColor, { scale: 2 });

  if (opts.done) {
    pen.col(K.GRN_L).line(x + 5, y + h / 2, x + 9, y + h - 4).line(x + 9, y + h - 4, x + 19, y + 3);
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
export function drawToyColumn(ctx, spots, madeIds) {
  for (const spot of spots) {
    const toy = TOYS[spot.n - 1];
    cell(ctx, spot, { icon: SPR.toy[toy.id], done: madeIds.includes(toy.id) });
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

export function drawMachinePanel(ctx, spots, active) {
  const pen = new Pen(ctx);
  const first = spots[0];
  const last = spots[spots.length - 1];
  const width = last.x + last.w - first.x;
  // Carcaça do painel, com espaço para o rótulo acima das teclas
  pen.col(K.BLACK).rect(first.x - 7, first.y - 12, width + 14, first.h + 20);
  pen.bevel(first.x - 6, first.y - 11, width + 12, first.h + 18, K.GRAY, K.GRAY_L, K.GRAY_D);
  F.textCenter(ctx, 'MOLDADORA', W / 2, first.y - 10, K.YEL_L, { shadow: K.BLACK });

  for (const spot of spots) {
    const on = spot.n === active;
    pen.col(K.BLACK).rect(spot.x, spot.y, spot.w, spot.h);
    pen.bevel(spot.x + 1, spot.y + 1, spot.w - 2, spot.h - 2,
      on ? K.YEL : K.BLU, on ? K.YEL_L : K.BLU_L, on ? K.OCHRE : K.BLU_D);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(ctx, label, Math.round(spot.x + (spot.w - tw) / 2), spot.y + 3,
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

export function drawSignpost(ctx, spots, state) {
  const pen = new Pen(ctx);
  const names = ['FÁBRICA', 'MERCADO', 'CORREIOS', 'A FESTA!'];
  const done = [state.presentDone, state.marketDone, state.inviteDone, false];

  // Poste
  pen.col(K.BLACK).rect(148, 20, 12, 108);
  pen.col(K.WOOD_D).rect(149, 21, 10, 106);
  pen.col(K.OCHRE).vline(150, 21, 106);

  for (const spot of spots) {
    const i = spot.n - 1;
    const party = i === 3;
    pen.col(K.BLACK).rect(spot.x, spot.y, spot.w, spot.h);
    pen.bevel(spot.x + 1, spot.y + 1, spot.w - 2, spot.h - 2,
      party ? K.YEL : K.OCHRE, party ? K.YEL_L : K.SAND, K.WOOD_D);
    // Ponta de seta
    pen.col(K.BLACK);
    for (let k = 0; k < 8; k++) pen.vline(spot.x + spot.w + k, spot.y + k, spot.h - k * 2);
    pen.col(party ? K.YEL : K.OCHRE);
    for (let k = 0; k < 7; k++) pen.vline(spot.x + spot.w + k, spot.y + 1 + k, spot.h - 2 - k * 2);

    const label = String(spot.n);
    F.text(ctx, label, spot.x + 5, spot.y + 3, party ? K.RED : K.RED_D, { scale: 2, shadow: K.SAND });
    F.text(ctx, names[i], spot.x + 22, spot.y + 6, K.WOOD_D);
    if (done[i]) {
      pen.col(K.GRN).line(spot.x + 108, spot.y + 9, spot.x + 112, spot.y + 14)
        .line(spot.x + 112, spot.y + 14, spot.x + 120, spot.y + 4);
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

export function drawVehicleRack(ctx, spots) {
  const pen = new Pen(ctx);
  for (const spot of spots) {
    const v = VEHICLES[spot.n];
    pen.col(K.BLACK).rect(spot.x, spot.y, spot.w, spot.h);
    pen.bevel(spot.x + 1, spot.y + 1, spot.w - 2, spot.h - 2, K.CREAM, K.WHITE, K.GRAY_D);

    /* Veículos mais largos que o cartão entram pela metade. A contagem de
       rodas de verdade acontece na cena da viagem, com o veículo em tamanho
       cheio e o flashcard — aqui é só a vitrine de escolha. */
    const sprite = v.wheels === 0 ? SPR.ravi.idle : SPR.vehicle[v.id];
    const half = sprite.w > spot.w - 6 || sprite.h > 26;
    const dw = half ? Math.round(sprite.w / 2) : sprite.w;
    const dh = half ? Math.round(sprite.h / 2) : sprite.h;
    ctx.drawImage(
      sprite.canvas,
      Math.round(spot.x + (spot.w - dw) / 2),
      Math.round(spot.y + 16 - dh / 2),
      dw, dh
    );

    F.textCenter(ctx, v.name, spot.x + spot.w / 2, spot.y + 32, K.GRAY_XD);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(ctx, label, Math.round(spot.x + (spot.w - tw) / 2), spot.y + 43, K.RED, { scale: 2, shadow: K.SAND });
  }
}

/** Quadro de quantidade do mercado: 1 a 9. */
export function quantitySpots() {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = (i / 3) | 0;
    spots.push({ n: i + 1, x: 210 + col * 34, y: 18 + row * 32, w: 30, h: 28 });
  }
  return spots;
}

export function drawQuantityBoard(ctx, spots, title) {
  const pen = new Pen(ctx);
  pen.col(K.BLACK).rect(202, 4, 112, 106);
  pen.bevel(203, 5, 110, 104, K.WOOD_D, K.OCHRE, K.GRAY_XD);
  F.textCenter(ctx, title, 258, 10, K.YEL_L, { shadow: K.BLACK });

  for (const spot of spots) {
    pen.col(K.BLACK).rect(spot.x, spot.y, spot.w, spot.h);
    pen.bevel(spot.x + 1, spot.y + 1, spot.w - 2, spot.h - 2, K.CREAM, K.WHITE, K.GRAY_D);
    const label = String(spot.n);
    const tw = F.measure(label, 3);
    F.text(ctx, label, Math.round(spot.x + (spot.w - tw) / 2), spot.y + 4, K.RED, { scale: 3 });
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

export function drawMailboxes(ctx, spots, state) {
  const pen = new Pen(ctx);
  for (const spot of spots) {
    if (spot.n === 0) {
      pen.col(K.BLACK).rect(spot.x, spot.y, spot.w, spot.h);
      pen.bevel(spot.x + 1, spot.y + 1, spot.w - 2, spot.h - 2, K.GRN, K.GRN_L, K.GRN_D);
      F.textCenter(ctx, 'VOLTAR', spot.x + spot.w / 2, spot.y + 8, K.WHITE, { shadow: K.GRN_D });
      F.textCenter(ctx, 'À PLACA', spot.x + spot.w / 2, spot.y + 18, K.WHITE, { shadow: K.GRN_D });
      const tw = F.measure('0', 2);
      F.text(ctx, '0', Math.round(spot.x + (spot.w - tw) / 2), spot.y + 26, K.YEL_L, { scale: 2, shadow: K.GRN_D });
      continue;
    }

    const idx = spot.n - 1;
    const hero = HEROES[idx];
    const locked = idx === state.honoree;
    const invited = state.invited.includes(idx);

    pen.col(K.BLACK).rect(spot.x, spot.y, spot.w, spot.h);
    pen.bevel(spot.x + 1, spot.y + 1, spot.w - 2, spot.h - 2,
      locked ? K.GRAY : invited ? K.GRN_D : K.BLU_D, K.GRAY_L, K.GRAY_XD);

    /* Portinha com o herói espiando. O recorte mostra da cabeça ao tronco:
       o sprite tem folga no topo para elmos e chapéus, então ele entra
       deslocado para que o rosto fique centrado na janelinha. */
    pen.col(K.BLACK).rect(spot.x + 3, spot.y + 3, 20, 32);
    pen.col(locked ? K.GRAY_D : K.CREAM).rect(spot.x + 4, spot.y + 4, 18, 30);
    if (!locked) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(spot.x + 4, spot.y + 4, 18, 30);
      ctx.clip();
      blit(ctx, SPR.hero[hero.id], spot.x - 5, spot.y - 4);
      ctx.restore();
    } else {
      pen.col(K.GRAY_XD).rect(spot.x + 9, spot.y + 18, 8, 8);
      pen.col(K.YEL).ring(spot.x + 13, spot.y + 15, 3);
    }

    const label = String(spot.n);
    F.text(ctx, label, spot.x + 27, spot.y + 5, locked ? K.GRAY_L : K.YEL_L,
      { scale: 2, shadow: K.BLACK });
    F.text(ctx, hero.short, spot.x + 25, spot.y + 24, locked ? K.GRAY_L : K.WHITE,
      { shadow: K.BLACK });
    if (invited) {
      pen.col(K.GRN_L).line(spot.x + 44, spot.y + 10, spot.x + 47, spot.y + 15)
        .line(spot.x + 47, spot.y + 15, spot.x + 53, spot.y + 4);
    }
  }
}

/** Pratos numerados da mesa da festa. */
export function plateSpots() {
  const spots = [];
  // Começa em x=44 para deixar o canto esquerdo livre para o Ravi
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x: 44 + i * 30, y: 128, w: 28, h: 30 });
  }
  return spots;
}

/** Pratos: comida à esquerda, numeral à direita — sem um cobrir o outro. */
export function drawPlates(ctx, spots, food) {
  const pen = new Pen(ctx);
  const icon = food ? SPR.food[food.id] : null;
  for (const spot of spots) {
    const cx = Math.round(spot.x + spot.w / 2);
    const cy = Math.round(spot.y + spot.h / 2);
    pen.col(K.BLACK).ellipse(cx, cy, 13, 10);
    pen.col(K.WHITE).ellipse(cx, cy, 12, 9);
    pen.col(K.GRAY_L).ellipse(cx, cy, 9, 6);
    if (icon) blitMid(ctx, icon, cx - 6, cy);
    F.text(ctx, String(spot.n), cx + 2, cy - 7, K.RED, { scale: 2 });
  }
}

/* --------------------------------------------------------------------------
   Hit-test
   -------------------------------------------------------------------------- */

/**
 * Descobre qual hotspot foi tocado. O alvo é ampliado em `pad` pixels para
 * perdoar o dedo — importante porque o jogo é para crianças pequenas.
 */
export function hitTest(spots, x, y, pad = 3) {
  if (!spots) return null;
  for (const spot of spots) {
    if (x >= spot.x - pad && x < spot.x + spot.w + pad &&
        y >= spot.y - pad && y < spot.y + spot.h + pad) {
      return spot.n;
    }
  }
  return null;
}

/** Confete da festa — posições fixas, animadas por tempo. */
export function makeConfetti(count) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    arr.push({
      x: (i * 53 + 11) % W,
      y: (i * 29) % STAGE_H,
      speed: 14 + (i % 5) * 6,
      color: [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.CYAN][i % 6]
    });
  }
  return arr;
}

export function drawConfetti(ctx, arr, t) {
  const pen = new Pen(ctx);
  for (const p of arr) {
    const y = (p.y + t * p.speed) % STAGE_H;
    const x = p.x + Math.round(3 * Math.sin(t * 2 + p.x));
    pen.col(p.color).rect(x, y | 0, 2, 2);
  }
}

/** Balões pendurados na parede da festa, abaixo da faixa. */
export function drawBalloons(ctx, count, t) {
  const pen = new Pen(ctx);
  const step = Math.min(32, 272 / Math.max(count, 1));
  for (let i = 0; i < count; i++) {
    const x = Math.round(24 + i * step);
    const y = 48 + Math.round(3 * Math.sin(t * 1.6 + i));
    blitMid(ctx, SPR.food.balloon, x, y);
    pen.col(K.CREAM).vline(x, y + 8, 14);
  }
}
