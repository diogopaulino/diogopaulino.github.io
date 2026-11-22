/* ==========================================================================
   Ravi 1·2·3 — Widgets Numerados Diegéticos (320×200 VGA)
   --------------------------------------------------------------------------
   Fiel ao Mickey's 123: The Big Surprise Party (1990):
   - Fábrica: coluna vertical 1..9 + painel 1..9 da máquina de formas malucas
     (estrela, fatias, panqueca, espiral, cubo, coração, mola, anel, bolinhas)
     + botão 0 (RÁPIDO >>) para acelerar a esteira e levar direto à empacotadora!
   - Mercado: gôndolas + quadro 1..9 + balcão da caixa registradora
   - Correios: 9 caixas postais com portinhas + 0 (Voltar) + rua das casas
   - Festa: 9 pratos numerados para servir CADA comida a CADA personagem
   ========================================================================== */

import { W, H, STAGE_H } from './screen.js';
import { K, Pen, blit, blitMid } from './assets.js';
import * as F from './font.js';
import { SPR, TOYS, VEHICLES, HEROES, FOODS } from './sprites.js';
import { bounceOut, wave, wrap } from './anim.js';
import { bakeWorld, drawAmbient as drawWorldAmbient } from './world.js';

export { STAGE_H };

let sharedPen = null;
function getPen(ctx) {
  if (!sharedPen || sharedPen.ctx !== ctx) sharedPen = new Pen(ctx);
  sharedPen._ci = -1;
  return sharedPen;
}

/* --------------------------------------------------------------------------
   Peças de UI diegética (pixel)
   -------------------------------------------------------------------------- */

export function raised(pen, x, y, w, h, face, light, dark) {
  pen.col(K.BLACK).rect(x + 1, y + 1, w, h);
  pen.bevel(x, y, w, h, face, light, dark);
  pen.col(light).hline(x + 2, y + 2, Math.max(0, w - 4));
}

export function sunk(pen, x, y, w, h, face, light, dark) {
  pen.col(K.BLACK).rect(x, y, w, h);
  pen.inset(x + 1, y + 1, w - 2, h - 2, face, light, dark);
}

function rivet(pen, x, y) {
  pen.col(K.BLACK).px(x, y).px(x + 1, y).px(x, y + 1);
  pen.col(K.GRAY_L).px(x, y);
  pen.col(K.GRAY).px(x + 1, y).px(x, y + 1);
}

function spark(pen, x, y, c = K.YEL_L) {
  pen.col(c).px(x, y - 1).px(x - 1, y).px(x, y).px(x + 1, y).px(x, y + 1);
}

export function numBadge(ctx, pen, n, cx, cy, scale = 2, fg = K.RED, face = K.CREAM) {
  const label = String(n);
  const tw = F.measure(label, scale);
  const bw = tw + 6;
  const bh = 7 * scale + 2;
  const bx = Math.round(cx - bw / 2);
  const by = Math.round(cy - bh / 2);
  raised(
    pen,
    bx,
    by,
    bw,
    bh,
    face,
    face === K.CREAM ? K.WHITE : K.YEL_L,
    face === K.CREAM ? K.GRAY_D : K.RED_D
  );
  F.text(ctx, label, Math.round(cx - tw / 2), by + 2, fg, {
    scale,
    shadow: face === K.CREAM ? K.SAND : K.RED_D
  });
}

export function backdrop(id) {
  return bakeWorld(id);
}

export function drawAmbient(ctx, id, t) {
  drawWorldAmbient(ctx, id, t);
}

/* --------------------------------------------------------------------------
   Chrome: Barra de Fala (166..200) e Flashcard
   -------------------------------------------------------------------------- */

const SPEAKER_SPOT = { n: -2, x: 4, y: STAGE_H + 6, w: 20, h: 22 };

let cachedMsg = null;
let cachedLines = [];

export function speechBar(ctx, message) {
  const pen = getPen(ctx);
  const y = STAGE_H;
  const h = H - STAGE_H;

  pen.col(K.BLACK).rect(0, y, W, h);
  pen.bevel(1, y + 1, W - 2, h - 2, K.NAVY, K.BLU, K.NIGHT);
  pen.col(K.OCHRE).hline(2, y + 1, W - 4);
  pen.col(K.YEL).hline(2, y + 2, W - 4);
  pen.col(K.NIGHT).hline(2, H - 2, W - 4);

  pen.col(K.YEL_L).ellipse(12, y + (h >> 1), 5, 4);
  pen.col(K.NAVY).ellipse(12, y + (h >> 1), 3, 2);
  pen.col(K.YEL).px(17, y + (h >> 1) - 1).px(18, y + (h >> 1)).px(17, y + (h >> 1) + 1);

  if (!message) return;
  if (message !== cachedMsg) {
    cachedMsg = message;
    cachedLines = F.wrap(message, W - 36);
  }
  const startY = y + (h - (cachedLines.length * F.LINE - 2)) / 2 + 1;
  for (let i = 0; i < cachedLines.length; i++) {
    F.textCenter(ctx, cachedLines[i], W / 2 + 4, Math.round(startY + i * F.LINE), K.YEL_L, {
      shadow: K.BLACK
    });
  }
}

/**
 * Cartão grande do número contado. `at` posiciona o centro superior do cartão
 * (cada cena escolhe um canto que não cubra o que está sendo contado).
 */
export function flashcard(ctx, n, pop = 1, at = null) {
  if (n === null || n === undefined) return;
  const pen = getPen(ctx);
  const scale = 4;
  const w = 60;
  const h = 76;
  const grow = bounceOut(Math.min(1, Math.max(0, pop)));
  const cw = Math.round(w * (0.55 + grow * 0.45));
  const chh = Math.round(h * (0.55 + grow * 0.45));
  const cx = at ? at.x : W / 2;
  const top = at ? at.y : 16;
  const x = Math.round(cx - cw / 2);
  const y = Math.round(top - (chh - h) / 2 - (1 - grow) * 12);

  pen.col(K.BLACK).ellipse(cx, y + chh + 5, Math.round(cw * 0.38), 4);
  pen.col(K.BLACK).rect(x + 3, y + 3, cw, chh);
  pen.bevel(x, y, cw, chh, K.CREAM, K.WHITE, K.GRAY);
  pen.col(K.WHITE).hline(x + 3, y + 3, Math.max(0, cw - 6));

  pen.col(K.RED_D).frame(x + 3, y + 3, cw - 6, chh - 6);
  pen.col(K.RED).frame(x + 4, y + 4, cw - 8, chh - 8);
  pen.col(K.RED_L).frame(x + 5, y + 5, cw - 10, chh - 10);

  if (grow > 0.4) {
    spark(pen, x + 8, y + 10, K.YEL);
    spark(pen, x + cw - 9, y + 10, K.YEL);
    spark(pen, x + 8, y + chh - 10, K.ORANGE);
    spark(pen, x + cw - 9, y + chh - 10, K.ORANGE);
  }

  if (grow > 0.55) {
    const label = String(n);
    const tw = F.measure(label, scale);
    F.text(ctx, label, Math.round(x + (cw - tw) / 2), y + 15, K.RED, {
      scale,
      shadow: K.GOLD_L
    });

    if (n > 0) {
      const step = Math.min(5, Math.floor((cw - 16) / Math.max(1, n)));
      const span = (n - 1) * step;
      const px0 = Math.round(x + cw / 2 - span / 2);
      const py = y + chh - 13;
      for (let i = 0; i < n; i++) {
        const px = px0 + i * step;
        pen.col(K.BLU_D).rect(px, py + 1, 2, 2);
        pen.col(K.BLU).rect(px, py, 2, 2);
      }
    }
  }
}

/* --------------------------------------------------------------------------
   Widgets Numerados do Cenário
   -------------------------------------------------------------------------- */

function cell(ctx, spot, opts = {}) {
  const pen = getPen(ctx);
  const { x, y, w, h } = spot;
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
    pen.col(K.GRN_L)
      .line(x + 7, y + 9, x + 10, y + 12)
      .line(x + 10, y + 12, x + 16, y + 5);
  }
}

/** Coluna vertical de brinquedos 1..9 (de baixo para cima, como no Mickey's 123). */
const TOY_COLUMN_SPOTS = (() => {
  const spots = [];
  const cw = 52;
  const ch = 18;
  const x = 134;
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x, y: 2 + (8 - i) * ch, w: cw, h: ch });
  }
  return spots;
})();

export function toyColumnSpots() {
  return TOY_COLUMN_SPOTS;
}

export function drawToyColumn(ctx, spots, madeIds) {
  const pen = getPen(ctx);
  raised(pen, 131, 0, 58, 166, K.WOOD_D, K.FLOOR, K.BLACK);
  for (const spot of spots) {
    const toy = TOYS[spot.n - 1];
    cell(ctx, spot, {
      icon: SPR.toy[toy.id],
      done: madeIds.includes(toy.id)
    });
  }
}

/**
 * Painel de controle da fábrica no Mickey's 123:
 * - Teclas 1..9 transformam a matéria-prima em 9 formas engraçadas na esteira!
 * - Tecla 0 (RÁPIDO >>) acelera a esteira direto para a máquina de presente!
 */
const MACHINE_PANEL_SPOTS = (() => {
  const spots = [];
  const bw = 20;
  const gap = 2;
  const x0 = 56;
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x: x0 + i * (bw + gap), y: 138, w: bw, h: 20 });
  }
  // Tecla 0 (Acelerar esteira >>)
  spots.push({ n: 0, x: x0 + 9 * (bw + gap) + 2, y: 138, w: 34, h: 20 });
  return spots;
})();

export function machinePanelSpots() {
  return MACHINE_PANEL_SPOTS;
}

export const MOLD_NAMES = [
  '',
  'FATIAS!',
  'PANQUECA!',
  'ESTRELA!',
  'MOLA!',
  'CUBOS!',
  'CORAÇÃO!',
  'ESPIRAL!',
  'ROSQUINHA!',
  'BOLINHAS!'
];

export function drawMachinePanel(ctx, spots, active, fast = false) {
  const pen = getPen(ctx);
  raised(pen, 50, 125, 246, 37, K.GRAY, K.GRAY_L, K.GRAY_D);
  rivet(pen, 53, 128);
  rivet(pen, 291, 128);
  raised(pen, 114, 126, 118, 10, K.NAVY, K.BLU, K.NIGHT);
  F.textCenter(ctx, '1-9 FORMAS · 0 RÁPIDO', 173, 128, K.YEL_L, { shadow: K.BLACK });

  for (const spot of spots) {
    if (spot.n === 0) {
      sunk(
        pen,
        spot.x,
        spot.y,
        spot.w,
        spot.h,
        fast ? K.YEL : K.GRN,
        fast ? K.YEL_L : K.GRN_L,
        fast ? K.OCHRE : K.GRN_D
      );
      F.textCenter(ctx, '0>>', spot.x + spot.w / 2, spot.y + 6, fast ? K.RED : K.WHITE, {
        shadow: K.BLACK
      });
      continue;
    }
    const on = spot.n === active;
    sunk(
      pen,
      spot.x,
      spot.y,
      spot.w,
      spot.h,
      on ? K.YEL : K.BLU,
      on ? K.YEL_L : K.BLU_L,
      on ? K.OCHRE : K.BLU_D
    );
    if (on) pen.col(K.WHITE).hline(spot.x + 2, spot.y + 2, spot.w - 4);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(
      ctx,
      label,
      Math.round(spot.x + (spot.w - tw) / 2),
      spot.y + 3,
      on ? K.RED : K.WHITE,
      { scale: 2, shadow: K.BLACK }
    );
  }
}

/**
 * Desenha as 9 transformações malucas da matéria-prima na esteira da fábrica
 * (como no Mickey's 123: cortar em fatias, esmagar como panqueca, virar estrela,
 * mola, cubos, coração, espiral, rosquinha ou bolinhas!).
 */
export function drawMoldedMaterial(ctx, mold, x, y) {
  const pen = getPen(ctx);
  switch (mold) {
    case 1: // Cortado em 3 fatias verticais
      for (let i = -1; i <= 1; i++) {
        pen.col(K.BLACK).rect(x + i * 8 - 3, y - 9, 6, 15);
        pen.col(K.RED_L).rect(x + i * 8 - 2, y - 8, 4, 13);
        pen.col(K.WHITE).vline(x + i * 8 - 1, y - 7, 10);
      }
      break;
    case 2: // Esmagado como panqueca larga
      pen.col(K.BLACK).ellipse(x, y + 3, 18, 4);
      pen.col(K.YEL).ellipse(x, y + 2, 17, 3);
      pen.col(K.YEL_L).hline(x - 11, y + 1, 22);
      break;
    case 3: // Estrela dourada
      pen.col(K.BLACK).ellipse(x, y - 2, 10, 10);
      pen.col(K.YEL).poly([[x, y - 13], [x - 9, y + 5], [x + 9, y + 5]]);
      pen.col(K.YEL).poly([[x, y + 9], [x - 9, y - 7], [x + 9, y - 7]]);
      pen.col(K.YEL_L).ellipse(x, y - 2, 4, 4);
      break;
    case 4: // Mola zig-zag
      for (let i = 0; i < 4; i++) {
        const sy = y - 10 + i * 4;
        pen.col(K.BLACK).ellipse(x + (i % 2 ? 2 : -2), sy, 8, 2);
        pen.col(K.CYAN).ellipse(x + (i % 2 ? 2 : -2), sy, 7, 1);
      }
      break;
    case 5: // Pirâmide de 3 cubos coloridos
      pen.bevel(x - 10, y - 2, 9, 8, K.RED, K.RED_L, K.RED_D);
      pen.bevel(x + 1, y - 2, 9, 8, K.BLU, K.BLU_L, K.BLU_D);
      pen.bevel(x - 5, y - 10, 9, 8, K.GRN, K.GRN_L, K.GRN_D);
      break;
    case 6: // Coração rosa
      pen.col(K.BLACK).ellipse(x - 5, y - 5, 6, 6).ellipse(x + 5, y - 5, 6, 6);
      pen.col(K.BLACK).poly([[x - 11, y - 3], [x + 11, y - 3], [x, y + 8]]);
      pen.col(K.PINK).ellipse(x - 5, y - 5, 5, 5).ellipse(x + 5, y - 5, 5, 5);
      pen.col(K.PINK).poly([[x - 10, y - 3], [x + 10, y - 3], [x, y + 7]]);
      pen.col(K.WHITE).px(x - 7, y - 7);
      break;
    case 7: // Espiral roxa
      pen.col(K.BLACK).ellipse(x, y - 2, 10, 9);
      pen.col(K.PUR).ellipse(x, y - 2, 9, 8);
      pen.col(K.PUR_L).ring(x, y - 2, 6).ring(x, y - 2, 3);
      pen.col(K.WHITE).px(x, y - 2);
      break;
    case 8: // Rosquinha / anel colorido
      pen.col(K.BLACK).ellipse(x, y - 2, 11, 8);
      pen.col(K.ORANGE).ellipse(x, y - 2, 10, 7);
      pen.col(K.PINK_L).ellipse(x, y - 3, 8, 5);
      pen.col(K.SAND).ellipse(x, y - 2, 4, 3);
      pen.col(K.BLACK).ellipse(x, y - 2, 3, 2);
      break;
    case 9: // Monte de bolinhas coloridas
      for (const [dx, dy, c] of [[-7, 2, K.RED], [0, 3, K.YEL], [7, 2, K.BLU], [-4, -4, K.GRN], [4, -4, K.PINK], [0, -9, K.CYAN]]) {
        pen.col(K.BLACK).ellipse(x + dx, y + dy, 4, 4);
        pen.col(c).ellipse(x + dx, y + dy, 3, 3);
        pen.col(K.WHITE).px(x + dx - 1, y + dy - 1);
      }
      break;
    default: // Massa de modelar crua: bolota rosa com brilho e "respiração"
      pen.col(K.BLACK).ellipse(x, y, 12, 8);
      pen.col(K.PINK_D).ellipse(x, y + 1, 11, 7);
      pen.col(K.PINK).ellipse(x - 1, y, 10, 6);
      pen.col(K.PINK_L).ellipse(x - 4, y - 3, 4, 2);
      pen.col(K.WHITE).px(x - 5, y - 4);
      break;
  }
}

/** Placa de caminhos da encruzilhada. */
const SIGNPOST_3 = [0, 1, 2].map((i) => ({ n: i + 1, x: 96, y: 24 + i * 24, w: 128, h: 20 }));
const SIGNPOST_4 = [0, 1, 2, 3].map((i) => ({ n: i + 1, x: 96, y: 20 + i * 23, w: 128, h: 20 }));

export function signpostSpots(showParty) {
  return showParty ? SIGNPOST_4 : SIGNPOST_3;
}

export function drawSignpost(ctx, spots, state) {
  const pen = getPen(ctx);
  const names = ['FÁBRICA', 'MERCADO', 'CARTAS', 'FESTA!'];
  const done = [state.presentDone, state.marketDone, state.inviteDone, false];
  const icons = [SPR.toy.robo, SPR.food.apple, SPR.misc.envelope, SPR.food.balloon];

  pen.col(K.BLACK).rect(148, 14, 14, 116);
  pen.col(K.WOOD_D).rect(149, 15, 12, 114);
  pen.col(K.OCHRE).vline(151, 15, 114);
  pen.col(K.BLACK).rect(142, 126, 26, 6);
  pen.col(K.WOOD_D).rect(143, 127, 24, 4);

  for (const spot of spots) {
    const i = spot.n - 1;
    const party = i === 3;
    const y = spot.y;
    raised(
      pen,
      spot.x,
      y,
      spot.w,
      spot.h,
      party ? K.YEL : K.OCHRE,
      party ? K.YEL_L : K.SAND,
      K.WOOD_D
    );
    pen.col(K.BLACK);
    for (let k = 0; k < 9; k++) pen.vline(spot.x + spot.w + k, y + k, spot.h - k * 2);
    pen.col(party ? K.YEL : K.OCHRE);
    for (let k = 0; k < 8; k++) pen.vline(spot.x + spot.w + k, y + 1 + k, spot.h - 2 - k * 2);

    numBadge(ctx, pen, spot.n, spot.x + 14, y + (spot.h >> 1), 2, K.YEL_L, K.RED);
    if (icons[i]) {
      const ic = icons[i];
      ctx.drawImage(ic.canvas, spot.x + 28, y + 3, 14, 14);
    }
    F.text(ctx, names[i], spot.x + 46, y + 7, K.WOOD_D, {
      shadow: party ? K.OCHRE : K.SAND
    });

    if (done[i]) {
      pen.col(K.BLACK).rect(spot.x + 108, y + 4, 14, 12);
      pen.col(K.GRN).rect(spot.x + 109, y + 5, 12, 10);
      pen.col(K.WHITE)
        .line(spot.x + 111, y + 10, spot.x + 114, y + 13)
        .line(spot.x + 114, y + 13, spot.x + 119, y + 6);
    }
  }
}

/** Grade 2×5 de veículos 0–9. */
const VEHICLE_SPOTS = (() => {
  const spots = [];
  for (let i = 0; i < 10; i++) {
    const col = i % 5;
    const row = (i / 5) | 0;
    spots.push({ n: i, x: 6 + col * 62, y: 10 + row * 74, w: 58, h: 70 });
  }
  return spots;
})();

export function vehicleSpots() {
  return VEHICLE_SPOTS;
}

const TRAVEL_SWAP_SPOTS = (() => {
  const spots = [];
  const bw = 28;
  const gap = 2;
  const total = 10 * bw + 9 * gap;
  const x0 = Math.round((W - total) / 2);
  for (let i = 0; i < 10; i++) {
    spots.push({ n: i, x: x0 + i * (bw + gap), y: 4, w: bw, h: 18 });
  }
  return spots;
})();

export function travelSwapSpots() {
  return TRAVEL_SWAP_SPOTS;
}

export function drawTravelSwap(ctx, spots, activeN) {
  const pen = getPen(ctx);
  const first = spots[0];
  const last = spots[spots.length - 1];
  const width = last.x + last.w - first.x;
  raised(pen, first.x - 4, first.y - 3, width + 8, first.h + 6, K.NAVY, K.BLU, K.NIGHT);

  for (const spot of spots) {
    const on = spot.n === activeN;
    sunk(
      pen,
      spot.x,
      spot.y,
      spot.w,
      spot.h,
      on ? K.YEL : K.CREAM,
      on ? K.YEL_L : K.WHITE,
      on ? K.OCHRE : K.GRAY_D
    );
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(
      ctx,
      label,
      Math.round(spot.x + (spot.w - tw) / 2),
      spot.y + 2,
      on ? K.RED : K.GRAY_XD,
      { scale: 2, shadow: on ? K.SAND : undefined }
    );
  }
}

export function drawVehicleRack(ctx, spots) {
  const pen = getPen(ctx);
  for (const spot of spots) {
    const v = VEHICLES[spot.n];
    const y = spot.y;
    raised(pen, spot.x, y, spot.w, spot.h, K.CREAM, K.WHITE, K.GRAY_D);

    pen.col(K.NAVY).rect(spot.x + 2, y + 2, spot.w - 4, 15);
    pen.col(K.BLU).hline(spot.x + 2, y + 2, spot.w - 4);
    const twN = F.measure(String(spot.n), 2);
    F.text(ctx, String(spot.n), Math.round(spot.x + (spot.w - twN) / 2), y + 3, K.YEL_L, {
      scale: 2,
      shadow: K.BLACK
    });

    const sprite = v.wheels === 0 ? SPR.ravi.idle : SPR.vehicle[v.id];
    const scale = Math.min(1, (spot.w - 8) / sprite.w, 24 / sprite.h);
    const dw = Math.round(sprite.w * scale);
    const dh = Math.round(sprite.h * scale);
    ctx.drawImage(
      sprite.canvas,
      Math.round(spot.x + (spot.w - dw) / 2),
      Math.round(y + 31 - dh / 2),
      dw,
      dh
    );

    F.textCenter(ctx, v.name, spot.x + spot.w / 2, y + 47, K.GRAY_XD);

    const nW = v.wheels;
    const pipY = y + 61;
    if (nW === 0) {
      F.textCenter(ctx, '0 RODAS', spot.x + spot.w / 2, pipY - 3, K.RED);
    } else {
      const pipR = 2;
      const step = Math.min(6, Math.floor((spot.w - 10) / Math.max(1, nW)));
      const span = (nW - 1) * step;
      const x0 = Math.round(spot.x + spot.w / 2 - span / 2);
      for (let i = 0; i < nW; i++) {
        const px = x0 + i * step;
        pen.col(K.BLACK).ellipse(px, pipY, pipR, pipR);
        pen.col(K.GRAY_L).px(px, pipY);
      }
    }
  }
}

/** Quadro de quantidade do mercado: 1 a 9. */
const QUANTITY_SPOTS = (() => {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const col = i % 3;
    const row = (i / 3) | 0;
    spots.push({ n: i + 1, x: 210 + col * 34, y: 24 + row * 28, w: 30, h: 26 });
  }
  return spots;
})();

export function quantitySpots() {
  return QUANTITY_SPOTS;
}

export function drawQuantityBoard(ctx, spots, title) {
  const pen = getPen(ctx);
  raised(pen, 202, 4, 112, 106, K.WOOD_D, K.OCHRE, K.GRAY_XD);
  rivet(pen, 206, 8);
  rivet(pen, 306, 8);
  rivet(pen, 206, 100);
  rivet(pen, 306, 100);
  raised(pen, 210, 8, 96, 12, K.NAVY, K.BLU, K.NIGHT);
  F.textCenter(ctx, title, 258, 10, K.YEL_L, { shadow: K.BLACK });

  for (const spot of spots) {
    sunk(pen, spot.x, spot.y, spot.w, spot.h, K.CREAM, K.WHITE, K.GRAY_D);
    pen.col(K.WHITE).hline(spot.x + 3, spot.y + 2, spot.w - 6);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(
      ctx,
      label,
      Math.round(spot.x + (spot.w - tw) / 2),
      spot.y + 6,
      K.RED,
      {
        scale: 2,
        shadow: K.SAND
      }
    );
  }
}

export function drawShoppingCart(ctx, cart, footX = 88, footY = 158) {
  const body = SPR.misc.cart;
  if (!body) return;
  const bx = Math.round(footX - body.w / 2);
  const by = footY - body.h;
  blit(ctx, body, bx, by);

  const originX = bx + 16;
  const originY = by + 16;
  const cols = 4;
  let slot = 0;
  for (const food of FOODS) {
    const qty = cart[food.id] || 0;
    for (let i = 0; i < qty && slot < 12; i++, slot++) {
      const col = slot % cols;
      const row = (slot / cols) | 0;
      blitMid(ctx, SPR.food[food.id], originX + col * 11, originY + row * 9);
    }
  }
}

/** Parede de caixas postais dos correios. */
const MAILBOX_SPOTS = (() => {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    const col = i % 5;
    const row = (i / 5) | 0;
    spots.push({ n: i + 1, x: 8 + col * 61, y: 26 + row * 44, w: 57, h: 40 });
  }
  spots.push({ n: 0, x: 252, y: 70, w: 57, h: 40 });
  return spots;
})();

export function mailboxSpots() {
  return MAILBOX_SPOTS;
}

export function drawMailboxes(ctx, spots, state) {
  const pen = getPen(ctx);
  for (const spot of spots) {
    const y = spot.y;
    if (spot.n === 0) {
      raised(pen, spot.x, y, spot.w, spot.h, K.GRN, K.GRN_L, K.GRN_D);
      F.textCenter(ctx, 'PRONTO', spot.x + spot.w / 2, y + 6, K.WHITE, { shadow: K.GRN_D });
      numBadge(ctx, pen, 0, spot.x + spot.w / 2, y + 25, 2, K.RED);
      continue;
    }

    const idx = spot.n - 1;
    const hero = HEROES[idx];
    const locked = idx === state.honoree;
    const invited = state.invited.includes(idx);

    raised(
      pen,
      spot.x,
      y,
      spot.w,
      spot.h,
      locked ? K.GRAY : invited ? K.GRN_D : K.BLU_D,
      locked ? K.GRAY_L : invited ? K.GRN_L : K.BLU_L,
      K.GRAY_XD
    );

    sunk(pen, spot.x + 3, y + 4, 20, 32, locked ? K.GRAY_D : K.CREAM, K.WHITE, K.GRAY_XD);
    ctx.save();
    ctx.beginPath();
    ctx.rect(spot.x + 4, y + 5, 18, 30);
    ctx.clip();
    blit(ctx, SPR.hero[hero.id], spot.x + 1, y + 3);
    ctx.restore();
    if (locked) {
      pen.col(K.BLACK).rect(spot.x + 4, y + 15, 18, 10);
      F.textCenter(ctx, 'SHH', spot.x + 13, y + 17, K.YEL_L);
    }

    raised(pen, spot.x + 26, y + 4, 27, 16, K.YEL, K.YEL_L, K.OCHRE);
    const label = String(spot.n);
    const tw = F.measure(label, 2);
    F.text(
      ctx,
      label,
      Math.round(spot.x + 39 - tw / 2),
      y + 5,
      locked ? K.GRAY_XD : K.RED,
      { scale: 2, shadow: K.SAND }
    );

    if (invited) {
      raised(pen, spot.x + 26, y + 23, 27, 12, K.GRN, K.GRN_L, K.GRN_D);
      F.textCenter(ctx, 'OK!', spot.x + 39, y + 26, K.WHITE, { shadow: K.BLACK });
    } else {
      F.textCenter(ctx, hero.short, spot.x + 39, y + 26, locked ? K.GRAY_L : K.WHITE, {
        shadow: K.BLACK
      });
    }
  }
}

/** Pratos numerados da mesa da festa. */
const PLATE_SPOTS = (() => {
  const spots = [];
  for (let i = 0; i < 9; i++) {
    spots.push({ n: i + 1, x: 42 + i * 30, y: 146, w: 28, h: 18 });
  }
  return spots;
})();

export function plateSpots() {
  return PLATE_SPOTS;
}

export function drawPlates(ctx, spots, food, maxAvailable = 9) {
  const pen = getPen(ctx);
  for (const spot of spots) {
    const cx = Math.round(spot.x + spot.w / 2);
    const cy = Math.round(spot.y + spot.h / 2) + 2;
    const avail = spot.n <= maxAvailable;
    pen.col(K.BLACK).ellipse(cx + 1, cy + 1, 13, 6);
    pen.col(avail ? K.GRAY : K.GRAY_XD).ellipse(cx, cy, 13, 6);
    pen.col(avail ? K.CREAM : K.GRAY_D).ellipse(cx, cy, 11, 4);
    if (food && avail) blitMid(ctx, SPR.food[food.id], cx - 6, cy - 1);
    const label = String(spot.n);
    const tw = F.measure(label, 1);
    raised(
      pen,
      cx + 1,
      spot.y - 1,
      tw + 6,
      11,
      avail ? K.YEL : K.GRAY,
      avail ? K.YEL_L : K.GRAY_L,
      avail ? K.OCHRE : K.GRAY_XD
    );
    F.text(ctx, label, cx + 4, spot.y + 1, avail ? K.RED : K.GRAY_XD);
  }
}

/* --------------------------------------------------------------------------
   Hit-test
   -------------------------------------------------------------------------- */

export function hitTest(spots, x, y, pad = 5) {
  if (
    x >= SPEAKER_SPOT.x &&
    x < SPEAKER_SPOT.x + SPEAKER_SPOT.w &&
    y >= SPEAKER_SPOT.y &&
    y < SPEAKER_SPOT.y + SPEAKER_SPOT.h
  ) {
    return -2;
  }
  if (!spots) return null;
  for (const spot of spots) {
    if (
      x >= spot.x - pad &&
      x < spot.x + spot.w + pad &&
      y >= spot.y - pad &&
      y < spot.y + spot.h + pad
    ) {
      return spot.n;
    }
  }
  return null;
}

/* --------------------------------------------------------------------------
   Partículas da Festa: Confete, Balões e Pops
   -------------------------------------------------------------------------- */

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
      shape: i % 3,
      color: colors[i % colors.length]
    });
  }
  return arr;
}

export function drawConfetti(ctx, arr, t) {
  const pen = getPen(ctx);
  for (const p of arr) {
    const y = wrap(p.y + t * p.speed, STAGE_H);
    const x = p.x + wave(t, p.drift, 4, p.x);
    pen.col(p.color).rect(x, y | 0, p.size, p.size);
  }
}

export function drawBalloons(ctx, count, t) {
  const pen = getPen(ctx);
  const palette = [K.RED, K.YEL, K.BLU, K.PINK, K.GRN, K.ORANGE, K.PUR, K.CYAN];
  for (let i = 0; i < count; i++) {
    const left = i % 2 === 0;
    const slot = (i / 2) | 0;
    const baseX = left ? Math.round(18 + slot * 16) : Math.round(W - 18 - slot * 16);
    const bob = wave(t, 1.5, 2, i);
    const x = baseX;
    const y = 36 + bob;
    const col = palette[i % palette.length];

    pen.col(K.CREAM).vline(x, y + 8, 12);
    pen.col(K.BLACK).ellipse(x + 1, y + 1, 7, 8);
    pen.col(K.BLACK).ellipse(x, y, 7, 8);
    pen.col(col).ellipse(x, y, 6, 7);
    pen.col(K.WHITE).ellipse(x - 2, y - 3, 2, 2);
    pen.col(col).px(x, y + 8);
  }
}

export function spawnPops(arr, x, y, t) {
  const colors = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.CYAN, K.ORANGE, K.PUR];
  for (let i = 0; i < 8; i++) {
    arr.push({ x, y, born: t, i, color: colors[i % colors.length] });
  }
  if (arr.length > 64) arr.splice(0, arr.length - 64);
}

export function drawPops(ctx, arr, t) {
  const pen = getPen(ctx);
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    const age = t - p.born;
    if (age > 0.55) {
      arr.splice(i, 1);
      continue;
    }
    const ang = p.i * 0.785;
    const d = age * 38;
    const px = Math.round(p.x + Math.cos(ang) * d);
    const py = Math.round(p.y + Math.sin(ang) * d - age * 18);
    pen.col(p.color).rect(px, py, 2, 2);
  }
}

/* --------------------------------------------------------------------------
   Contagem no objeto (como no original: cada coisa contada ganha o número
   em cima dela no instante em que é contada)
   -------------------------------------------------------------------------- */

const TAG_LIFE = 1.25;

/** Etiqueta numérica que nasce em (x, y), sobe um pouco e some. */
export function spawnTag(arr, x, y, n, t) {
  arr.push({ x: Math.round(x), y: Math.round(y), n, born: t });
  if (arr.length > 24) arr.splice(0, arr.length - 24);
}

export function drawTags(ctx, arr, t) {
  const pen = getPen(ctx);
  for (let i = arr.length - 1; i >= 0; i--) {
    const tag = arr[i];
    const age = t - tag.born;
    if (age > TAG_LIFE) {
      arr.splice(i, 1);
      continue;
    }
    // Pop: escala 1 no primeiro instante, 2 depois; sobe 6px ao longo da vida.
    const rise = Math.round(Math.min(1, age / TAG_LIFE) * 6);
    const scale = age < 0.07 ? 1 : 2;
    numBadge(ctx, pen, tag.n, tag.x, tag.y - rise, scale, K.RED, K.YEL);
  }
}

/** Número fixo e pequeno em cima de um objeto (ovelhas, convidados na foto). */
export function smallTag(ctx, n, x, y) {
  numBadge(ctx, getPen(ctx), n, x, y, 1, K.RED, K.YEL);
}

/* --------------------------------------------------------------------------
   Realce de alvo: hover do mouse e dica de "toque aqui" quando a criança
   fica parada (moldura tracejada que anda em volta do botão)
   -------------------------------------------------------------------------- */

export function drawSpotGlow(ctx, spot, t, strong = false) {
  if (!spot) return;
  const pen = getPen(ctx);
  const x = spot.x - 2;
  const y = spot.y - 2;
  const w = spot.w + 4;
  const h = spot.h + 4;
  const phase = Math.floor(t * 12) % 4;
  const a = strong ? K.WHITE : K.YEL_L;
  const b = strong ? K.YEL : K.ORANGE;
  // Perímetro em segmentos de 2px alternando duas cores ("formigas marchando").
  const seg = (i) => (((i >> 1) + phase) & 1 ? a : b);
  for (let i = 0; i < w; i++) {
    pen.col(seg(i)).px(x + i, y);
    pen.col(seg(i + 1)).px(x + w - 1 - i, y + h - 1);
  }
  for (let i = 0; i < h; i++) {
    pen.col(seg(i + 2)).px(x + w - 1, y + i);
    pen.col(seg(i + 3)).px(x, y + h - 1 - i);
  }
}

/* --------------------------------------------------------------------------
   Transição íris (abre um círculo do preto, em pixel, linha a linha)
   -------------------------------------------------------------------------- */

export function drawIris(ctx, p, cx = W / 2, cy = STAGE_H / 2) {
  if (p >= 1) return;
  const pen = getPen(ctx);
  const maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, STAGE_H - cy)) + 2;
  const r = Math.max(0, p) * maxR;
  pen.col(K.BLACK);
  for (let y = 0; y < STAGE_H; y++) {
    const dy = y + 0.5 - cy;
    const inside = r * r - dy * dy;
    if (inside <= 0) {
      pen.hline(0, y, W);
      continue;
    }
    const half = Math.round(Math.sqrt(inside));
    const l = Math.round(cx) - half;
    const rr = Math.round(cx) + half;
    if (l > 0) pen.hline(0, y, l);
    if (rr < W) pen.hline(rr, y, W - rr);
  }
}

/** Sombra oval no chão sob um personagem (meio-tom com transparência). */
export function footShadow(ctx, x, y, rx = 10) {
  const pen = getPen(ctx);
  ctx.save();
  ctx.globalAlpha = 0.28;
  pen._ci = -1;
  pen.col(K.BLACK).ellipse(Math.round(x), Math.round(y), rx, 3);
  ctx.restore();
  pen._ci = -1;
}

/* --------------------------------------------------------------------------
   Caixa do mercado: esteira do caixa + visor da registradora
   -------------------------------------------------------------------------- */

export function drawRegister(ctx, total, ringing) {
  const pen = getPen(ctx);
  // Corpo da registradora sobre o balcão
  raised(pen, 196, 52, 62, 46, K.GRAY, K.GRAY_L, K.GRAY_D);
  rivet(pen, 199, 55);
  rivet(pen, 253, 55);
  // Visor verde de cristal líquido com o total de itens
  sunk(pen, 204, 58, 46, 18, K.GRN_D, K.GRN, K.BLACK);
  const label = String(total);
  const tw = F.measure(label, 2);
  F.text(ctx, label, Math.round(227 - tw / 2), 60, ringing ? K.YEL_L : K.GRN_L, { scale: 2 });
  // Teclado 3×3 da registradora (decorativo)
  for (let i = 0; i < 9; i++) {
    const kx = 206 + (i % 3) * 9;
    const ky = 80 + ((i / 3) | 0) * 5;
    pen.col(i === 4 && ringing ? K.YEL : K.CREAM).rect(kx, ky, 7, 4);
  }
  // Gaveta que salta quando registra
  const drawer = ringing ? 4 : 0;
  raised(pen, 236, 80 + drawer, 18, 14, K.OCHRE, K.YEL, K.WOOD_D);
  pen.col(K.WOOD_D).hline(241, 86 + drawer, 8);
}

export function drawCheckoutBelt(ctx, t, running) {
  const pen = getPen(ctx);
  pen.col(K.BLACK).rect(40, 98, 160, 8);
  pen.col(K.GRAY_XD).rect(41, 99, 158, 6);
  pen.col(K.GRAY_D);
  const shift = running ? Math.floor(t * 30) % 8 : 0;
  for (let x = 41 + shift; x < 199; x += 8) pen.vline(x, 99, 6);
  // Leitor (laser vermelho pisca quando passa um item)
  raised(pen, 176, 86, 16, 12, K.GRAY_D, K.GRAY, K.BLACK);
  if (running && Math.floor(t * 10) % 2) pen.col(K.RED_L).hline(178, 97, 12);
}

/* --------------------------------------------------------------------------
   Xilofone da festa: barras 1..9 (afinadas em escala) + botão 0 FOTO
   -------------------------------------------------------------------------- */

const XYLO_COLORS = [K.RED, K.ORANGE, K.YEL, K.GRN, K.CYAN, K.BLU, K.PUR, K.PINK, K.RED_L];

const XYLO_SPOTS = (() => {
  const spots = [];
  const bw = 24;
  const gap = 3;
  const x0 = 14;
  for (let i = 0; i < 9; i++) {
    // Barra mais longa = nota mais grave (como num xilofone de verdade)
    const h = 20 - i;
    spots.push({ n: i + 1, x: x0 + i * (bw + gap), y: 164 - h - 2, w: bw, h });
  }
  spots.push({ n: 0, x: 264, y: 142, w: 50, h: 20 });
  return spots;
})();

export function xyloSpots() {
  return XYLO_SPOTS;
}

export function drawXylophone(ctx, spots, hit, hitAge) {
  const pen = getPen(ctx);
  const bars = spots.filter((s) => s.n > 0);
  const first = bars[0];
  const last = bars[bars.length - 1];
  // Trilhos de madeira
  pen.col(K.BLACK).rect(first.x - 4, 150, last.x + last.w - first.x + 8, 4);
  pen.col(K.WOOD_D).rect(first.x - 3, 151, last.x + last.w - first.x + 6, 2);
  for (const spot of spots) {
    if (spot.n === 0) {
      raised(pen, spot.x, spot.y, spot.w, spot.h, K.NAVY, K.BLU, K.NIGHT);
      F.textCenter(ctx, '0 FOTO', spot.x + spot.w / 2, spot.y + 6, K.YEL_L, { shadow: K.BLACK });
      continue;
    }
    const on = spot.n === hit && hitAge < 0.25;
    const c = XYLO_COLORS[spot.n - 1];
    const y = spot.y + (on ? 2 : 0);
    raised(pen, spot.x, y, spot.w, spot.h, on ? K.WHITE : c, K.WHITE, K.BLACK);
    rivet(pen, spot.x + 2, y + 3);
    rivet(pen, spot.x + spot.w - 4, y + 3);
    const label = String(spot.n);
    const tw = F.measure(label, 1);
    F.text(ctx, label, Math.round(spot.x + (spot.w - tw) / 2), y + Math.max(2, (spot.h >> 1) - 3), on ? c : K.WHITE, {
      shadow: K.BLACK
    });
  }
}

/* --------------------------------------------------------------------------
   Foto da festa: polaroid com a imagem capturada do palco
   -------------------------------------------------------------------------- */

export function drawPolaroid(ctx, photo, cx, top, scale = 0.5) {
  if (!photo) return;
  const pen = getPen(ctx);
  const pw = Math.round(W * scale);
  const ph = Math.round(STAGE_H * scale);
  const x = Math.round(cx - pw / 2);
  pen.col(K.BLACK).rect(x - 4, top - 3, pw + 10, ph + 19);
  pen.bevel(x - 5, top - 4, pw + 10, ph + 18, K.CREAM, K.WHITE, K.SAND);
  ctx.drawImage(photo, 0, 0, W, STAGE_H, x, top, pw, ph);
  pen.col(K.GRAY_D).frame(x - 1, top - 1, pw + 2, ph + 2);
}
