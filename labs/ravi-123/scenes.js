/* ==========================================================================
   Ravi 1·2·3 — cenários e widgets numerados
   --------------------------------------------------------------------------
   Cada cenário é pintado UMA vez num canvas fora de tela e depois só blitado.
   Os widgets numerados são desenhados por cima, e o mesmo array de hotspots
   que posiciona os desenhos é o que responde ao toque — desenho e clique
   nunca podem sair de sincronia porque vêm da mesma fonte.
   ========================================================================== */

import { W, H, makeSurface } from './screen.js';
import { K, Pen, blit, blitMid } from './assets.js';
import * as F from './font.js';
import { SPR, TOYS, VEHICLES, HEROES } from './sprites.js';

export const STAGE_H = 166;  // altura da área de jogo (o resto é a barra de fala)

/* --------------------------------------------------------------------------
   Texturas
   -------------------------------------------------------------------------- */

/** Xadrez de 1px entre duas cores — o jeito VGA de simular meio-tom. */
function dither(pen, x, y, w, h, a, b) {
  pen.col(a).rect(x, y, w, h);
  pen.col(b);
  for (let j = 0; j < h; j++) {
    for (let i = (j & 1); i < w; i += 2) pen.px(x + i, y + j);
  }
}

function brickWall(pen, x, y, w, h) {
  pen.col(K.RED).rect(x, y, w, h);
  pen.col(K.RED_D);
  for (let j = 0; j < h; j += 8) {
    pen.hline(x, y + j, w);
    const offset = ((j / 8) & 1) ? 8 : 0;
    for (let i = offset; i < w; i += 16) pen.vline(x + i, y + j, Math.min(8, h - j));
  }
  // Brilho em alguns tijolos, para a parede não ficar chapada
  pen.col(K.RED_L);
  for (let j = 1; j < h - 1; j += 16) {
    for (let i = 2; i < w; i += 32) pen.hline(x + i, y + j, 6);
  }
}

/** Cano metálico horizontal com reflexo. */
function pipeH(pen, x, y, w, thick = 8) {
  pen.col(K.BLACK).rect(x, y - 1, w, thick + 2);
  pen.col(K.GRAY).rect(x, y, w, thick);
  pen.col(K.GRAY_L).hline(x, y + 1, w);
  pen.col(K.WHITE).hline(x, y + 2, w);
  pen.col(K.GRAY_D).hline(x, y + thick - 1, w);
  // Flanges
  pen.col(K.GRAY_D);
  for (let i = 24; i < w; i += 48) pen.rect(x + i, y - 1, 3, thick + 2);
}

function pipeV(pen, x, y, h, thick = 8) {
  pen.col(K.BLACK).rect(x - 1, y, thick + 2, h);
  pen.col(K.GRAY).rect(x, y, thick, h);
  pen.col(K.WHITE).vline(x + 2, y, h);
  pen.col(K.GRAY_D).vline(x + thick - 1, y, h);
}

function crate(pen, x, y, s = 20) {
  pen.col(K.BLACK).rect(x, y, s, s);
  pen.col(K.OCHRE).rect(x + 1, y + 1, s - 2, s - 2);
  pen.col(K.WOOD_D).line(x + 1, y + 1, x + s - 2, y + s - 2).line(x + s - 2, y + 1, x + 1, y + s - 2);
  pen.col(K.WOOD_D).frame(x + 1, y + 1, s - 2, s - 2);
}

/* --------------------------------------------------------------------------
   Cenários
   -------------------------------------------------------------------------- */

const BACKDROPS = {
  /** Sala do Ravi. `night` troca a janela e escurece a parede. */
  house(pen, night) {
    const wall = night ? K.NAVY : K.LILAC;
    const wallAlt = night ? K.NIGHT : K.CREAM;
    pen.col(wall).rect(0, 0, W, 126);
    pen.col(wallAlt);
    for (let x = 6; x < W; x += 18) pen.vline(x, 0, 126);
    // Rodapé e chão
    pen.col(K.WOOD_D).rect(0, 120, W, 8);
    pen.col(night ? K.GRAY_XD : K.OCHRE).rect(0, 128, W, STAGE_H - 128);
    pen.col(night ? K.BLACK : K.WOOD_D);
    for (let x = -20; x < W; x += 26) pen.line(x, STAGE_H, x + 30, 128);

    // Janela
    pen.col(K.BLACK).rect(202, 20, 62, 52);
    pen.col(night ? K.NIGHT : K.BLU_L).rect(204, 22, 58, 48);
    if (night) {
      pen.col(K.YEL_L).ellipse(248, 36, 8, 8);
      pen.col(K.NIGHT).ellipse(244, 33, 6, 6);
      pen.col(K.WHITE).px(215, 30).px(228, 42).px(238, 55).px(222, 60).px(210, 48);
    } else {
      pen.col(K.GRN).rect(204, 56, 58, 14);
      pen.col(K.WHITE).ellipse(220, 34, 8, 4).ellipse(244, 42, 6, 3);
    }
    pen.col(K.CREAM).rect(232, 20, 3, 52).rect(202, 44, 62, 3);

    // Quadro na parede
    pen.col(K.YEL).rect(40, 22, 34, 26);
    pen.col(K.BLACK).frame(40, 22, 34, 26);
    pen.col(K.GRN_L).rect(43, 25, 28, 20);
    pen.col(K.BLU).ellipse(57, 40, 10, 5);
    pen.col(K.YEL_L).ellipse(64, 30, 4, 4);

    // Tapete
    pen.col(K.RED_D).ellipse(160, 152, 88, 16);
    pen.col(K.RED).ellipse(160, 152, 82, 13);
    pen.col(K.CREAM).ellipse(160, 152, 60, 8);
    pen.col(K.RED).ellipse(160, 152, 48, 6);
  },

  /** Poltrona — desenhada à parte para o Ravi poder dormir nela. */
  armchair(pen, x, y) {
    pen.col(K.BLACK).rect(x - 26, y - 34, 52, 40);
    pen.col(K.BLU).rect(x - 25, y - 33, 50, 38);
    pen.col(K.BLU_D).rect(x - 25, y - 6, 50, 11);
    pen.col(K.BLU_L).rect(x - 21, y - 29, 42, 20);
    // Braços
    pen.col(K.BLACK).rect(x - 34, y - 20, 10, 26).rect(x + 24, y - 20, 10, 26);
    pen.col(K.BLU).rect(x - 33, y - 19, 8, 24).rect(x + 25, y - 19, 8, 24);
    pen.col(K.BLU_L).hline(x - 33, y - 19, 8).hline(x + 25, y - 19, 8);
    // Pés
    pen.col(K.WOOD_D).rect(x - 28, y + 6, 6, 5).rect(x + 22, y + 6, 6, 5);
  },

  /** Campo noturno do sonho, com lua, estrelas e cerca. */
  field(pen) {
    pen.col(K.NIGHT).rect(0, 0, W, 60);
    dither(pen, 0, 60, W, 20, K.NIGHT, K.NAVY);
    pen.col(K.NAVY).rect(0, 80, W, 26);
    dither(pen, 0, 106, W, 12, K.NAVY, K.GRN_D);
    pen.col(K.GRN_D).rect(0, 118, W, STAGE_H - 118);

    // Lua
    pen.col(K.YEL_L).ellipse(268, 32, 18, 18);
    pen.col(K.CREAM).ellipse(268, 32, 15, 15);
    pen.col(K.YEL_L).ellipse(262, 26, 4, 3).ellipse(273, 38, 5, 4).ellipse(274, 24, 3, 2);

    // Estrelas — posições fixas (determinísticas, nada de random no boot)
    pen.col(K.WHITE);
    for (let i = 0; i < 46; i++) {
      const x = (i * 71 + 13) % W;
      const y = (i * 37 + 5) % 78;
      pen.px(x, y);
      if (i % 5 === 0) { pen.px(x - 1, y); pen.px(x + 1, y); pen.px(x, y - 1); pen.px(x, y + 1); }
    }

    // Grama
    pen.col(K.GRN);
    for (let x = 0; x < W; x += 7) pen.line(x, STAGE_H, x + 3, 120);

    // Cerca que as ovelhas pulam
    pen.col(K.WOOD_D).rect(0, 128, W, 4).rect(0, 138, W, 4);
    pen.col(K.OCHRE).hline(0, 128, W).hline(0, 138, W);
    for (let x = 14; x < W; x += 46) {
      pen.col(K.BLACK).rect(x - 1, 118, 8, 32);
      pen.col(K.WOOD_D).rect(x, 119, 6, 30);
      pen.col(K.OCHRE).vline(x, 119, 30);
    }
  },

  /** Rua com a placa de caminhos. */
  street(pen) {
    pen.col(K.BLU_L).rect(0, 0, W, 62);
    dither(pen, 0, 62, W, 14, K.BLU_L, K.CYAN);
    pen.col(K.CYAN).rect(0, 76, W, 26);   // faixa de horizonte por trás dos morros
    // Morros ao fundo
    pen.col(K.GRN_D);
    for (let x = 0; x < W; x++) {
      const h = 16 + Math.round(10 * Math.sin(x / 26) + 6 * Math.sin(x / 11));
      pen.vline(x, 92 - h, h + 8);
    }
    pen.col(K.GRN).rect(0, 100, W, 22);
    pen.col(K.GRN_L);
    for (let x = 3; x < W; x += 9) pen.px(x, 104 + ((x * 7) % 12));

    // Nuvens
    pen.col(K.WHITE);
    pen.ellipse(52, 22, 14, 6).ellipse(64, 18, 10, 6).ellipse(40, 20, 9, 5);
    pen.ellipse(228, 14, 12, 5).ellipse(240, 11, 8, 5);

    // Estrada
    pen.col(K.GRAY_D).rect(0, 122, W, STAGE_H - 122);
    pen.col(K.GRAY).rect(0, 124, W, STAGE_H - 126);
    pen.col(K.GRAY_XD).hline(0, 122, W).hline(0, STAGE_H - 1, W);
    pen.col(K.YEL_L);
    for (let x = 4; x < W; x += 26) pen.rect(x, 144, 14, 3);
  },

  /** Fábrica de brinquedos — reconstruída a partir da tela original. */
  factory(pen) {
    brickWall(pen, 0, 0, W, 122);
    pipeH(pen, 0, 6, W, 10);
    pipeH(pen, 0, 26, 150, 7);
    pipeV(pen, 96, 16, 12, 7);
    pipeV(pen, 250, 16, 30, 9);
    pipeH(pen, 250, 46, 70, 9);

    // Chão
    pen.col(K.FLOOR_D).rect(0, 122, W, STAGE_H - 122);
    pen.col(K.FLOOR).rect(0, 126, W, STAGE_H - 130);
    pen.col(K.FLOOR_D);
    for (let x = 0; x < W; x += 32) pen.vline(x, 126, STAGE_H - 130);

    // Engradados à esquerda
    crate(pen, 6, 82, 22);
    crate(pen, 30, 82, 22);
    crate(pen, 18, 60, 22);

    // Prateleira azul com nichos amarelos (canto direito)
    pen.col(K.BLACK).rect(268, 56, 50, 66);
    pen.col(K.BLU_D).rect(269, 57, 48, 64);
    pen.col(K.BLU).frame(269, 57, 48, 64);
    for (let r = 0; r < 4; r++) {
      pen.col(K.YEL).rect(273, 61 + r * 16, 18, 12);
      pen.col(K.OCHRE).hline(273, 72 + r * 16, 18);
      pen.col(K.BLU_D).rect(295, 61 + r * 16, 18, 12);
      pen.col(K.NAVY).rect(297, 63 + r * 16, 14, 8);
    }
  },

  /** Mercado. */
  market(pen) {
    pen.col(K.CREAM).rect(0, 0, W, 118);
    pen.col(K.SAND);
    for (let y = 0; y < 118; y += 14) pen.hline(0, y, W);

    /* Gôndolas só na faixa esquerda: a vitrine do produto da vez ocupa o
       centro e o quadro de quantidade fica na direita. */
    for (let r = 0; r < 3; r++) {
      const y = 20 + r * 32;
      pen.col(K.BLACK).rect(6, y + 18, 86, 4);
      pen.col(K.WOOD_D).rect(6, y + 18, 86, 3);
      for (let i = 0; i < 5; i++) {
        const x = 10 + i * 17;
        const c = [K.RED, K.GRN, K.BLU, K.YEL, K.PUR, K.ORANGE][(i + r) % 6];
        pen.col(K.BLACK).rect(x - 1, y + 3, 14, 16);
        pen.col(c).rect(x, y + 4, 12, 14);
        pen.col(K.WHITE).hline(x, y + 9, 12);
      }
    }

    // Piso quadriculado em tom quente
    pen.col(K.SAND).rect(0, 118, W, STAGE_H - 118);
    pen.col(K.CREAM);
    for (let y = 118; y < STAGE_H; y += 8) {
      for (let x = ((y - 118) / 8) % 2 ? 0 : 8; x < W; x += 16) pen.rect(x, y, 8, 8);
    }
    pen.col(K.OCHRE).hline(0, 118, W);
  },

  /** Correios. */
  post(pen) {
    pen.col(K.BLU_L).rect(0, 0, W, 104);
    pen.col(K.CREAM).rect(0, 104, W, 14);
    pen.col(K.WOOD_D).rect(0, 100, W, 6);
    // Placa CORREIOS
    pen.col(K.BLACK).rect(96, 4, 128, 20);
    pen.col(K.RED).rect(97, 5, 126, 18);
    F.textCenter(pen.ctx, 'CORREIOS', 160, 11, K.YEL_L, { shadow: K.RED_D });
    // Balcão
    pen.col(K.BLACK).rect(0, 118, W, 6);
    pen.col(K.OCHRE).rect(0, 118, W, 5);
    pen.col(K.WOOD_D).rect(0, 124, W, STAGE_H - 124);
    pen.col(K.WOOD_D).hline(0, 123, W);
    pen.col(K.GRAY_XD);
    for (let x = 0; x < W; x += 24) pen.vline(x, 124, STAGE_H - 124);
  },

  /** Sala decorada para a festa. */
  party(pen) {
    BACKDROPS.house(pen, false);
    // Serpentinas no teto
    for (let i = 0; i < 5; i++) {
      const c = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK][i];
      pen.col(c);
      for (let x = i * 64; x < i * 64 + 64 && x < W; x++) {
        pen.px(x, 4 + Math.round(4 * Math.sin((x + i * 20) / 5)));
      }
    }
    /* Mesa larga: os convidados ficam atrás dela e o bolo e o presente nas
       pontas, para nenhum herói sumir por trás dos objetos. */
    pen.col(K.BLACK).rect(36, 116, 252, 9);
    pen.col(K.CREAM).rect(37, 117, 250, 7);
    pen.col(K.PINK).rect(37, 122, 250, 3);
    pen.col(K.BLACK).rect(48, 125, 6, 24).rect(268, 125, 6, 24);
    pen.col(K.WOOD_D).rect(49, 125, 4, 24).rect(269, 125, 4, 24);
  }
};

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
  const pen = new Pen(s.ctx);
  /* Base opaca: o canvas principal não é limpo a cada frame (o cenário é que
     cobre tudo), então qualquer pixel transparente aqui deixaria a cena
     anterior vazar por baixo. */
  pen.col(K.BLACK).rect(0, 0, W, STAGE_H);
  switch (id) {
    case 'houseNight': BACKDROPS.house(pen, true); BACKDROPS.armchair(pen, 150, 150); break;
    case 'houseDay': BACKDROPS.house(pen, false); BACKDROPS.armchair(pen, 150, 150); break;
    case 'field': BACKDROPS.field(pen); break;
    case 'street': BACKDROPS.street(pen); break;
    case 'factory': BACKDROPS.factory(pen); break;
    case 'market': BACKDROPS.market(pen); break;
    case 'post': BACKDROPS.post(pen); break;
    case 'party': BACKDROPS.party(pen); break;
    default: pen.col(K.BLACK).rect(0, 0, W, STAGE_H); break;
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
