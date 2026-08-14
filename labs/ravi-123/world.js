/* ==========================================================================
   Ravi 1·2·3 — cenários pixel + vida ambiente
   --------------------------------------------------------------------------
   Fundos JPEG eram escuros, cheios de texto em inglês e “parados”. Cada
   cenário agora é VGA, claro, com um palco vazio no meio para os bonecos
   e uma camada viva (estrelas, nuvens, fogo, engrenagens) desenhada todo
   frame.
   ========================================================================== */

import { W, STAGE_H, makeSurface } from './screen.js';
import { K, Pen } from './assets.js';
import { wave, hop, wrap } from './anim.js';

const baked = new Map();

function sky(pen, top, bot, h) {
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    pen.col(t < 0.55 ? top : bot).hline(0, y, W);
  }
}

function windowFrame(pen, x, y, w, h, night) {
  pen.col(K.BLACK).rect(x - 2, y - 2, w + 4, h + 4);
  pen.col(K.WOOD_D).rect(x - 1, y - 1, w + 2, h + 2);
  pen.col(night ? K.NAVY : K.BLU_L).rect(x, y, w, h);
  pen.col(K.WOOD_D).vline(x + (w >> 1), y, h).hline(x, y + (h >> 1), w);
  if (night) {
    pen.col(K.YEL_L).ellipse(x + w - 8, y + 6, 4, 4);
    pen.col(K.YEL).ellipse(x + w - 7, y + 6, 2, 2);
  } else {
    pen.col(K.YEL_L).ellipse(x + 8, y + 6, 5, 5);
    pen.col(K.YEL).ellipse(x + 8, y + 6, 3, 3);
  }
}

function houseRoom(pen, night) {
  // Parede lisa — listras finas cansam olho de 3 anos
  pen.col(night ? K.NAVY : K.CREAM).rect(0, 0, W, 110);
  if (!night) pen.col(K.SAND).rect(0, 86, W, 24);
  // Rodapé
  pen.col(K.WOOD_D).rect(0, 108, W, 6);
  // Chão
  pen.col(night ? K.FLOOR_D : K.FLOOR).rect(0, 114, W, STAGE_H - 114);
  for (let y = 118; y < STAGE_H; y += 5) {
    pen.col(night ? K.WOOD_D : K.OCHRE).hline(0, y, W);
  }
  windowFrame(pen, 8, 18, 70, 58, night);
  // Tapete
  pen.col(K.BLACK).ellipse(160, 148, 70, 12);
  pen.col(K.RED).ellipse(160, 147, 68, 11);
  pen.col(K.YEL).ellipse(160, 147, 52, 7);
  // Poltrona
  pen.col(K.BLACK).rect(118, 92, 84, 48);
  pen.col(K.WOOD_D).rect(120, 94, 80, 44);
  pen.col(K.OCHRE).rect(128, 100, 64, 28);
  pen.col(K.SAND).rect(132, 104, 24, 10).rect(168, 104, 24, 10);
  // Abajur
  pen.col(K.WOOD_D).rect(236, 118, 6, 28);
  pen.col(K.BLACK).rect(226, 96, 26, 22);
  pen.col(night ? K.YEL : K.YEL_L).rect(228, 98, 22, 18);
  if (night) {
    pen.col(K.YEL).ellipse(239, 118, 18, 8);
  }
  // Estante
  pen.col(K.WOOD_D).rect(268, 40, 44, 70);
  pen.col(K.CREAM).rect(270, 42, 40, 18);
  const books = [K.RED, K.BLU, K.GRN, K.PUR, K.ORANGE, K.CYAN];
  for (let i = 0; i < 6; i++) {
    pen.col(books[i]).rect(272 + (i % 3) * 12, 64 + ((i / 3) | 0) * 20, 10, 16);
  }
}

function paintHouseNight(pen) {
  houseRoom(pen, true);
}

function paintHouseDay(pen) {
  houseRoom(pen, false);
}

function paintField(pen) {
  sky(pen, K.NIGHT, K.NAVY, 90);
  // Colinas
  pen.col(K.GRN_D).ellipse(40, 110, 90, 28);
  pen.col(K.GRN).ellipse(180, 108, 110, 32);
  pen.col(K.GRN_D).ellipse(280, 114, 70, 24);
  pen.col(K.GRN).rect(0, 118, W, STAGE_H - 118);
  // Cerca
  for (let x = 8; x < W; x += 28) {
    pen.col(K.BLACK).rect(x, 122, 6, 28);
    pen.col(K.WOOD_D).rect(x + 1, 123, 4, 26);
  }
  pen.col(K.BLACK).rect(0, 128, W, 4).rect(0, 140, W, 4);
  pen.col(K.OCHRE).rect(0, 129, W, 2).rect(0, 141, W, 2);
  // Lua
  pen.col(K.YEL_L).ellipse(268, 28, 14, 14);
  pen.col(K.YEL).ellipse(268, 28, 10, 10);
  pen.col(K.NIGHT).ellipse(274, 24, 8, 8);
}

function paintStreet(pen) {
  sky(pen, K.BLU_L, K.CYAN, 78);
  // Sol
  pen.col(K.YEL_L).ellipse(42, 22, 12, 12);
  pen.col(K.YEL).ellipse(42, 22, 8, 8);
  // Colinas / gramado
  pen.col(K.GRN_L).rect(0, 78, W, 28);
  pen.col(K.GRN).rect(0, 98, W, 18);
  // Casas simples
  house(pen, 18, 52, K.RED, K.YEL);
  house(pen, 230, 56, K.BLU, K.CREAM);
  // Rua
  pen.col(K.GRAY_D).rect(0, 116, W, STAGE_H - 116);
  pen.col(K.GRAY).rect(0, 120, W, 28);
  pen.col(K.YEL).rect(0, 132, W, 3);
  for (let x = 8; x < W; x += 24) pen.col(K.GRAY_D).rect(x, 132, 12, 3);
}

function house(pen, x, y, roof, wall) {
  pen.col(K.BLACK).rect(x + 8, y + 18, 52, 32);
  pen.col(wall).rect(x + 9, y + 19, 50, 30);
  // Telhado
  for (let i = 0; i < 16; i++) {
    pen.col(K.BLACK).hline(x + 16 - i, y + 2 + i, 36 + i * 2);
    pen.col(roof).hline(x + 17 - i, y + 3 + i, 34 + i * 2);
  }
  pen.col(K.CYAN).rect(x + 16, y + 26, 10, 10);
  pen.col(K.CYAN).rect(x + 40, y + 26, 10, 10);
  pen.col(K.WOOD_D).rect(x + 28, y + 34, 10, 16);
  pen.col(K.YEL).px(x + 36, y + 42);
}

function paintFactory(pen) {
  pen.col(K.SAND).rect(0, 0, W, 100);
  // Tijolos claros (não o vermelho pesado do JPEG)
  for (let y = 0; y < 100; y += 8) {
    for (let x = (y / 8) % 2 ? 6 : 0; x < W; x += 14) {
      pen.col(K.OCHRE).rect(x, y, 12, 6);
    }
  }
  pen.col(K.CYAN).rect(40, 12, 36, 28);
  pen.col(K.CYAN).rect(244, 12, 36, 28);
  pen.col(K.WOOD_D).frame(38, 10, 40, 32).frame(242, 10, 40, 32);
  // Prateleira de blocos
  pen.col(K.WOOD_D).rect(8, 48, 52, 40);
  const bits = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.CYAN];
  for (let i = 0; i < 6; i++) {
    pen.col(bits[i]).rect(12 + (i % 3) * 15, 52 + ((i / 3) | 0) * 16, 12, 12);
  }
  // Chão de oficina
  pen.col(K.GRAY).rect(0, 100, W, STAGE_H - 100);
  pen.col(K.GRAY_D).hline(0, 100, W);
  // Arco ao fundo (menor, não cobre os brinquedos)
  pen.col(K.GRAY_XD).ellipse(280, 70, 22, 18);
  pen.col(K.NIGHT).ellipse(280, 72, 14, 12);
}

function paintMarket(pen) {
  pen.col(K.CREAM).rect(0, 0, W, 96);
  // Toldo
  for (let x = 0; x < W; x += 16) {
    pen.col(x % 32 ? K.RED : K.WHITE).rect(x, 0, 16, 18);
  }
  pen.col(K.RED_D).hline(0, 18, W);
  // Piso xadrez — a divisão precisa ser inteira, senão todo o chão vira um só azul
  for (let y = 96; y < STAGE_H; y += 10) {
    for (let x = 0; x < W; x += 10) {
      pen.col((((x + y) / 10) | 0) % 2 ? K.BLU_L : K.WHITE).rect(x, y, 10, 10);
    }
  }
  // Bancada de frutas (esquerda, atrás do Ravi)
  pen.col(K.WOOD_D).rect(8, 58, 70, 40);
  pen.col(K.OCHRE).rect(10, 60, 66, 12);
  blobFruit(pen, 22, 78, K.RED);
  blobFruit(pen, 38, 80, K.YEL);
  blobFruit(pen, 54, 78, K.GRN);
  blobFruit(pen, 70, 80, K.ORANGE);
  // Prateleira ao fundo
  pen.col(K.WOOD_D).rect(100, 40, 90, 50);
  const cans = [K.RED, K.BLU, K.GRN, K.PUR, K.ORANGE, K.CYAN, K.PINK, K.YEL];
  for (let i = 0; i < 8; i++) {
    pen.col(cans[i]).rect(106 + (i % 4) * 20, 46 + ((i / 4) | 0) * 20, 14, 16);
    pen.col(K.WHITE).rect(108 + (i % 4) * 20, 48 + ((i / 4) | 0) * 20, 10, 4);
  }
}

function blobFruit(pen, x, y, c) {
  pen.col(K.BLACK).ellipse(x, y, 7, 6);
  pen.col(c).ellipse(x, y, 6, 5);
  pen.col(K.WHITE).px(x - 2, y - 2);
}

function paintPost(pen) {
  pen.col(K.YEL_L).rect(0, 0, W, 110);
  pen.col(K.SAND).rect(0, 0, W, 18);
  // Relógio amigável
  pen.col(K.BLACK).ellipse(160, 28, 12, 12);
  pen.col(K.WHITE).ellipse(160, 28, 10, 10);
  pen.col(K.RED).px(160, 28).vline(160, 20, 8).hline(160, 28, 6);
  windowFrame(pen, 8, 22, 50, 42, false);
  // Balcão
  pen.col(K.WOOD_D).rect(0, 110, W, STAGE_H - 110);
  pen.col(K.OCHRE).rect(0, 110, W, 6);
  pen.col(K.SAND).hline(0, 112, W);
  // Pacotes
  pen.col(K.RED).rect(260, 96, 22, 16);
  pen.col(K.YEL).rect(266, 96, 10, 16);
  pen.col(K.BLU).rect(288, 100, 18, 12);
}

function paintParty(pen) {
  // Parede lisa e clara — listras finas cansam olho de 3 anos
  pen.col(K.LILAC).rect(0, 0, W, 100);
  pen.col(K.PINK).rect(0, 96, W, 4);
  windowFrame(pen, 8, 16, 48, 40, true);
  pen.col(K.WOOD_D).rect(0, 100, W, STAGE_H - 100);
  for (let y = 104; y < STAGE_H; y += 6) pen.col(K.OCHRE).hline(0, y, W);
  pen.col(K.RED).ellipse(180, 140, 90, 16);
  pen.col(K.YEL).ellipse(180, 140, 70, 10);
  pen.col(K.RED_D).rect(268, 48, 44, 52);
  pen.col(K.GRAY_XD).rect(276, 64, 28, 28);
  pen.col(K.ORANGE).rect(280, 72, 20, 16);
  pen.col(K.YEL).rect(284, 78, 12, 8);
}

const PAINTERS = {
  houseNight: paintHouseNight,
  houseDay: paintHouseDay,
  field: paintField,
  street: paintStreet,
  factory: paintFactory,
  market: paintMarket,
  post: paintPost,
  party: paintParty
};

export function bakeWorld(id) {
  let surface = baked.get(id);
  if (surface) return surface;
  const s = makeSurface(W, STAGE_H);
  const pen = new Pen(s.ctx);
  pen.col(K.BLACK).rect(0, 0, W, STAGE_H);
  const paint = PAINTERS[id];
  if (paint) paint(pen);
  surface = s.canvas;
  baked.set(id, surface);
  return surface;
}

export function clearWorldCache() {
  baked.clear();
}

/* --------------------------------------------------------------------------
   Camada viva — nunca assada, para o cenário não ficar estático
   -------------------------------------------------------------------------- */

export function drawAmbient(ctx, id, t) {
  const pen = new Pen(ctx);
  if (id === 'houseNight') drawWindowStars(pen, t);
  if (id === 'field' || id === 'party') {
    drawStars(pen, t, id === 'field' ? 28 : 12);
  }
  if (id === 'field') drawFireflies(pen, t);
  if (id === 'houseDay' || id === 'street') drawClouds(pen, t);
  if (id === 'street') drawRoadDash(pen, t);
  if (id === 'factory') drawGears(pen, t);
  if (id === 'party') {
    drawStreamers(pen, t);
    drawFire(pen, t);
  }
  if (id === 'houseNight') drawLampGlow(pen, t, true);
}

function drawWindowStars(pen, t) {
  for (let i = 0; i < 8; i++) {
    const x = 14 + (i % 4) * 16;
    const y = 24 + ((i / 4) | 0) * 18;
    if (!hop(t, 3 + (i % 3) * 0.5, 1, i)) continue;
    pen.col(i % 2 ? K.YEL_L : K.WHITE).px(x, y);
  }
}

function drawStars(pen, t, n) {
  for (let i = 0; i < n; i++) {
    const x = 12 + ((i * 47) % 300);
    const y = 6 + ((i * 19) % 40);
    const on = hop(t, 3 + (i % 5) * 0.4, 1, i) > 0;
    if (!on && i % 2) continue;
    pen.col(i % 3 ? K.YEL_L : K.WHITE).px(x, y);
    if (i % 4 === 0) {
      pen.px(x - 1, y).px(x + 1, y).px(x, y - 1).px(x, y + 1);
    }
  }
}

function drawFireflies(pen, t) {
  for (let i = 0; i < 8; i++) {
    const x = wrap(40 + i * 36 + wave(t, 0.7 + i * 0.05, 10, i), W);
    const y = 70 + hop(t, 1.4 + i * 0.2, 12, i * 2);
    pen.col(K.YEL_L).px(x, y).px(x + 1, y);
    if (hop(t, 6, 1, i) > 0) pen.col(K.YEL).px(x, y - 1);
  }
}

function drawClouds(pen, t) {
  for (let i = 0; i < 3; i++) {
    const x = wrap((t * (8 + i * 3) + i * 90) | 0, W + 40) - 20;
    const y = 10 + i * 10;
    pen.col(K.WHITE).ellipse(x, y, 16, 6).ellipse(x + 10, y + 2, 12, 5);
  }
}

function drawRoadDash(pen, t) {
  const shift = wrap((t * 40) | 0, 24);
  pen.col(K.YEL);
  for (let x = -shift; x < W; x += 24) pen.rect(x, 132, 12, 3);
}

function drawGears(pen, t) {
  const spin = ((t * 8) | 0) % 4;
  pen.col(K.GRAY_L).ellipse(300, 36, 10, 10);
  pen.col(K.GRAY).ellipse(300, 36, 4, 4);
  pen.col(K.YEL).px(300 + (spin === 0 ? 8 : spin === 1 ? 0 : spin === 2 ? -8 : 0),
    36 + (spin === 1 ? 8 : spin === 3 ? -8 : 0));
  // Lâmpada à esquerda — o centro é a coluna de brinquedos
  const sway = wave(t, 1.6, 3);
  pen.col(K.GRAY_D).vline(88 + sway, 0, 10);
  pen.col(K.YEL).ellipse(88 + sway, 16, 8, 6);
  pen.col(K.YEL_L).ellipse(88 + sway, 16, 4, 3);
}

function drawAwning(pen, t) {
  const bob = hop(t, 2.2, 1);
  for (let x = 0; x < W; x += 16) {
    pen.col(x % 32 ? K.RED : K.WHITE).rect(x, bob, 16, 18);
  }
}

function drawStreamers(pen, t) {
  const cols = [K.RED, K.GRN, K.YEL, K.CYAN, K.PINK];
  for (let i = 0; i < 5; i++) {
    const x0 = 40 + i * 56;
    pen.col(cols[i]);
    for (let k = 0; k < 10; k++) {
      const x = x0 + wave(t, 2 + i * 0.2, 6, k * 0.6);
      pen.px(x, 4 + k * 3);
    }
  }
}

function drawFire(pen, t) {
  const h = 8 + hop(t, 9, 6);
  pen.col(K.ORANGE).rect(280, 88 - h, 20, h);
  pen.col(K.YEL).rect(284, 90 - (h >> 1), 12, h >> 1);
  pen.col(K.YEL_L).px(290, 88 - h);
}

function drawLampGlow(pen, t, night) {
  if (!night) return;
  const g = 10 + hop(t, 2.5, 3);
  pen.col(K.YEL).ellipse(239, 118, g + 4, 6);
}
