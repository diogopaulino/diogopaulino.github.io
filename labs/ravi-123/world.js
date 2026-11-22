/* ==========================================================================
   Ravi 1·2·3 — Cenários VGA 320×166 com Profundidade, Iluminação e Realismo
   --------------------------------------------------------------------------
   - Céus com faixas atmosféricas suaves (sem granulado/dither)
   - Interiores com lambris de madeira, reflexos nos vidros, sombras projetadas
     no assoalho e iluminação quente de abajur/lareira
   - Tudo assado uma única vez num buffer offscreen (custo zero por frame)
   ========================================================================== */

import { W, STAGE_H, makeSurface } from './screen.js';
import { K, Pen } from './assets.js';
import { hop } from './anim.js';
import * as F from './font.js';

const baked = new Map();

/** Céu em faixas horizontais suaves (sem ruído de xadrez). */
function skyBands(pen, bands, totalH) {
  const n = bands.length;
  let y0 = 0;
  for (let i = 0; i < n; i++) {
    const y1 = i === n - 1 ? totalH : Math.round(((i + 1) / n) * totalH);
    pen.col(bands[i]).rect(0, y0, W, y1 - y0);
    y0 = y1;
  }
}

function windowFrame(pen, x, y, w, h, night) {
  // Sombra da janela na parede
  pen.col(K.BLACK).rect(x - 2, y - 2, w + 5, h + 5);
  pen.bevel(x - 1, y - 1, w + 2, h + 2, K.WOOD_D, K.FLOOR, K.WOOD_XD);

  // Vista externa + reflexo diagonal no vidro
  if (night) {
    pen.col(K.NIGHT).rect(x, y, w, h >> 1);
    pen.col(K.NAVY).rect(x, y + (h >> 1), w, h - (h >> 1));
    pen.col(K.BLU_D).ellipse(x + w - 12, y + 10, 8, 8);
    pen.col(K.YEL_L).ellipse(x + w - 12, y + 10, 5, 5);
    pen.col(K.NIGHT).ellipse(x + w - 10, y + 8, 4, 4);
    pen.col(K.WHITE).px(x + 10, y + 10).px(x + 22, y + 22).px(x + 14, y + 36);
    pen.col(K.YEL_L).px(x + 26, y + 12).px(x + 42, y + 26);
  } else {
    pen.col(K.SKY_M).rect(x, y, w, h >> 1);
    pen.col(K.SKY_L).rect(x, y + (h >> 1), w, h - (h >> 1));
    pen.col(K.YEL_L).ellipse(x + 12, y + 10, 6, 6);
    pen.col(K.YEL).ellipse(x + 12, y + 10, 4, 4);
    // Colina verde lá fora
    pen.col(K.GRN).ellipse(x + (w >> 1), y + h, (w >> 1) + 4, 10);
    pen.col(K.GRN_L).ellipse(x + (w >> 1) - 6, y + h, w >> 2, 6);
    // Reflexo de luz no vidro
    pen.col(K.WHITE).line(x + 8, y + 6, x + 16, y + 14).line(x + 11, y + 6, x + 16, y + 11);
  }

  // Caixilho de madeira
  pen.col(K.WOOD_D).rect(x + (w >> 1) - 1, y, 2, h).rect(x, y + (h >> 1) - 1, w, 2);
  pen.col(K.FLOOR).vline(x + (w >> 1) - 1, y, h).hline(x, y + (h >> 1) - 1, w);

  // Varão dourado + cortinas drapeadas com volume
  pen.col(K.BLACK).rect(x - 5, y - 6, w + 10, 4);
  pen.col(K.OCHRE).rect(x - 4, y - 5, w + 8, 2);
  pen.col(K.YEL_L).hline(x - 3, y - 5, w + 6);
  const cloth = night ? K.PUR : K.RED;
  const fold = night ? K.PUR_L : K.RED_L;
  const dark = night ? K.PUR_D : K.RED_D;
  for (const sx of [x - 1, x + w - 7]) {
    pen.col(cloth).rect(sx, y, 8, h);
    pen.col(fold).vline(sx + 1, y + 1, h - 2).vline(sx + 5, y + 2, h - 4);
    pen.col(dark).vline(sx + 3, y + 1, h - 2).vline(sx + 7, y + 1, h - 2);
    pen.col(K.YEL).rect(sx, y + Math.round(h * 0.64), 8, 2);
  }

  // Peitoril de madeira com sombra
  pen.col(K.BLACK).rect(x - 5, y + h, w + 10, 5);
  pen.bevel(x - 4, y + h + 1, w + 8, 3, K.FLOOR, K.SAND, K.WOOD_D);
}

function woodPlanks(pen, y0, night) {
  const base = night ? K.FLOOR_D : K.FLOOR;
  const plankLight = night ? K.FLOOR : K.SAND;
  const seam = night ? K.WOOD_XD : K.WOOD_D;
  pen.col(base).rect(0, y0, W, STAGE_H - y0);
  pen.col(plankLight).hline(0, y0, W);
  let row = 0;
  for (let y = y0 + 6; y < STAGE_H; y += 7, row++) {
    pen.col(seam).hline(0, y, W);
    pen.col(plankLight).hline(0, y + 1, W);
    for (let x = (row % 2) * 32 + 16; x < W; x += 64) {
      pen.col(seam).vline(x, y - 6, 6);
    }
  }
}

function houseRoom(pen, night) {
  // Parede superior + lambris de madeira trabalhada na parte baixa
  pen.col(night ? K.NAVY : K.CREAM).rect(0, 0, W, 82);
  pen.col(night ? K.BLU_D : K.GOLD_L).rect(0, 74, W, 8);
  pen.col(K.BLACK).hline(0, 82, W);
  pen.col(night ? K.WOOD_D : K.FLOOR).rect(0, 83, W, 25);
  pen.col(night ? K.FLOOR_D : K.SAND).hline(0, 84, W);
  for (let x = 8; x < W; x += 26) {
    pen.inset(
      x,
      87,
      20,
      17,
      night ? K.WOOD_XD : K.FLOOR_D,
      night ? K.FLOOR_D : K.SAND,
      K.BLACK
    );
  }
  // Rodapé
  pen.col(K.BLACK).hline(0, 108, W);
  pen.bevel(0, 109, W, 5, K.WOOD_D, K.FLOOR, K.WOOD_XD);

  // Assoalho de madeira com tábuas e juntas
  woodPlanks(pen, 114, night);

  windowFrame(pen, 10, 18, 66, 56, night);

  // Quadro emoldurado na parede
  pen.col(K.BLACK).rect(88, 22, 24, 20);
  pen.bevel(89, 23, 22, 18, K.OCHRE, K.YEL, K.WOOD_D);
  pen.col(night ? K.NIGHT : K.SKY_L).rect(91, 25, 18, 14);
  pen.col(K.GRN).ellipse(100, 37, 8, 3);
  pen.col(K.YEL_L).px(95, 29);

  // Tapete persa oval trabalhado
  pen.col(K.BLACK).ellipse(160, 149, 72, 13);
  pen.col(K.RED_D).ellipse(160, 148, 70, 12);
  pen.col(K.RED).ellipse(160, 148, 64, 10);
  pen.col(K.YEL).ellipse(160, 148, 50, 7);
  pen.col(K.CREAM).ellipse(160, 148, 34, 4);

  // Poltrona estofada com encosto, braços arredondados e almofadas
  pen.col(K.BLACK).ellipse(160, 141, 44, 4);
  pen.col(K.BLACK).roundRect(122, 88, 76, 50, 2);
  pen.bevel(124, 90, 72, 46, K.RED_D, K.RED, K.WOOD_XD);
  pen.bevel(130, 93, 60, 26, K.RED, K.RED_L, K.RED_D);
  // Braços da poltrona
  pen.bevel(118, 104, 12, 32, K.RED_D, K.RED, K.WOOD_XD);
  pen.bevel(190, 104, 12, 32, K.RED_D, K.RED, K.WOOD_XD);
  // Almofadas do assento
  pen.bevel(130, 116, 29, 14, K.OCHRE, K.YEL, K.WOOD_D);
  pen.bevel(161, 116, 29, 14, K.OCHRE, K.YEL, K.WOOD_D);
  // Pés de madeira da poltrona
  pen.col(K.WOOD_XD).rect(122, 136, 6, 4).rect(192, 136, 6, 4);

  // Abajur com halo de luz quente
  if (night) {
    pen.col(K.FLOOR).ellipse(239, 145, 18, 5);
  }
  pen.col(K.BLACK).ellipse(239, 146, 9, 2);
  pen.col(K.WOOD_D).rect(236, 116, 6, 29);
  pen.bevel(232, 143, 14, 3, K.OCHRE, K.YEL_L, K.WOOD_D);
  pen.col(K.BLACK).poly([[225, 116], [253, 116], [247, 96], [231, 96]]);
  pen.col(night ? K.YEL : K.CREAM).poly([[227, 115], [251, 115], [246, 98], [232, 98]]);
  pen.col(K.YEL_L).hline(229, 114, 20);

  // Estante de livros esculpida à direita
  pen.col(K.BLACK).rect(266, 36, 48, 76);
  pen.bevel(267, 37, 46, 74, K.WOOD_D, K.FLOOR, K.WOOD_XD);
  pen.col(K.WOOD_XD).rect(271, 41, 38, 18).rect(271, 63, 38, 20).rect(271, 87, 38, 20);
  // Vasinho/globo na prateleira de cima
  pen.col(K.CYAN).ellipse(282, 51, 5, 5);
  pen.col(K.WHITE).px(280, 49);
  pen.col(K.OCHRE).rect(279, 56, 6, 3);
  const books = [K.RED, K.BLU, K.GRN, K.PUR, K.ORANGE, K.CYAN, K.PINK, K.YEL];
  for (let row = 0; row < 2; row++) {
    const sy = 65 + row * 24;
    for (let i = 0; i < 4; i++) {
      const bx = 273 + i * 9;
      const bh = 15 + (i % 2) * 2;
      pen.bevel(bx, sy + 18 - bh, 8, bh, books[(row * 4 + i) % books.length], K.WHITE, K.BLACK);
    }
  }
}

function paintHouseNight(pen) {
  houseRoom(pen, true);
}

function paintHouseDay(pen) {
  houseRoom(pen, false);
}

function paintField(pen) {
  skyBands(pen, [K.NIGHT, K.NAVY, K.BLU_D], 96);

  // Estrelas fixas e lua crescente com halo suave
  for (let i = 0; i < 18; i++) {
    const sx = 14 + ((i * 53) % 230);
    const sy = 8 + ((i * 19) % 48);
    pen.col(i % 2 ? K.WHITE : K.YEL_L).px(sx, sy);
  }
  pen.col(K.BLU_D).ellipse(268, 26, 18, 18);
  pen.col(K.YEL_L).ellipse(268, 26, 14, 14);
  pen.col(K.YEL).ellipse(268, 26, 10, 10);
  pen.col(K.NIGHT).ellipse(274, 22, 8, 8);

  // Silhueta de pinheiros e colinas em 3 planos de profundidade
  pen.col(K.FOREST).ellipse(55, 110, 95, 28).ellipse(270, 112, 80, 24);
  pen.col(K.GRN_D).ellipse(175, 110, 115, 28);
  pen.col(K.GRN_L).hline(115, 83, 55); // brilho do luar no topo da colina
  pen.col(K.GRN).rect(0, 116, W, 24);
  pen.col(K.GRN_D).rect(0, 140, W, STAGE_H - 140);

  // Pinheiros noturnos nas bordas
  for (const tx of [18, 298]) {
    pen.col(K.WOOD_XD).rect(tx - 2, 104, 4, 14);
    pen.col(K.FOREST).poly([[tx - 11, 106], [tx + 11, 106], [tx, 84]]);
    pen.col(K.GRN_D).poly([[tx - 9, 96], [tx + 9, 96], [tx, 78]]);
  }

  // Cerca de madeira 3D com chanfro e sombra
  for (let x = 10; x < W; x += 28) {
    pen.col(K.BLACK).rect(x, 121, 7, 29);
    pen.bevel(x + 1, 122, 5, 27, K.FLOOR_D, K.SAND, K.WOOD_D);
  }
  pen.col(K.BLACK).rect(0, 128, W, 5).rect(0, 140, W, 5);
  pen.bevel(0, 129, W, 3, K.FLOOR, K.SAND, K.WOOD_D);
  pen.bevel(0, 141, W, 3, K.FLOOR, K.SAND, K.WOOD_D);
}

function house(pen, x, y, roof, roofLight, wall) {
  // Sombra e parede com tábuas horizontais
  pen.col(K.BLACK).rect(x + 8, y + 18, 52, 33);
  pen.bevel(x + 9, y + 19, 50, 31, wall, K.WHITE, K.SAND);
  // Chaminé de tijolinho
  pen.col(K.BLACK).rect(x + 44, y + 2, 8, 12);
  pen.col(K.RED_D).rect(x + 45, y + 3, 6, 10);
  // Telhado com beiral iluminado
  for (let i = 0; i < 16; i++) {
    pen.col(K.BLACK).hline(x + 16 - i, y + 2 + i, 36 + i * 2);
    pen.col(i < 4 ? roofLight : roof).hline(x + 17 - i, y + 3 + i, 34 + i * 2);
  }
  // Janelas com venezianas e reflexo
  pen.bevel(x + 15, y + 25, 12, 11, K.CYAN, K.WHITE, K.BLU_D);
  pen.bevel(x + 41, y + 25, 12, 11, K.CYAN, K.WHITE, K.BLU_D);
  pen.col(K.WHITE).px(x + 17, y + 27).px(x + 43, y + 27);
  // Porta de madeira com maçaneta dourada
  pen.bevel(x + 29, y + 33, 10, 17, K.WOOD_D, K.FLOOR, K.BLACK);
  pen.col(K.YEL).px(x + 36, y + 41);
}

function tree(pen, x, y) {
  pen.col(K.BLACK).rect(x - 3, y + 10, 7, 15);
  pen.col(K.WOOD_D).rect(x - 2, y + 10, 5, 14);
  pen.col(K.FLOOR).vline(x - 1, y + 11, 12);
  pen.col(K.BLACK).ellipse(x, y + 3, 13, 11);
  pen.col(K.GRN_D).ellipse(x, y + 4, 12, 10);
  pen.col(K.GRN).ellipse(x - 1, y + 2, 10, 8);
  pen.col(K.GRN_L).ellipse(x - 3, y - 1, 6, 4);
}

function paintStreet(pen) {
  skyBands(pen, [K.SKY_M, K.BLU_L, K.SKY_L], 80);

  // Sol radiante e nuvens com volume
  pen.col(K.YEL_L).ellipse(42, 22, 13, 13);
  pen.col(K.YEL).ellipse(42, 22, 9, 9);
  pen.col(K.WHITE).ellipse(39, 19, 4, 4);

  for (const [cx, cy] of [[112, 18], [244, 15]]) {
    pen.col(K.SKY_L).ellipse(cx + 4, cy + 3, 18, 5);
    pen.col(K.WHITE).ellipse(cx, cy, 16, 6).ellipse(cx + 10, cy + 1, 12, 5);
  }

  // Colinas distantes e gramado
  pen.col(K.GRN).ellipse(80, 82, 95, 16).ellipse(250, 82, 100, 18);
  pen.col(K.GRN_L).rect(0, 78, W, 18);
  pen.col(K.GRN).rect(0, 96, W, 18);

  // Casinhas e árvores da vila
  house(pen, 14, 52, K.RED, K.RED_L, K.GOLD_L);
  tree(pen, 84, 82);
  tree(pen, 226, 82);
  house(pen, 238, 54, K.BLU, K.BLU_L, K.CREAM);

  // Meio-fio de pedra e rua asfaltada
  pen.col(K.BLACK).hline(0, 113, W);
  pen.bevel(0, 114, W, 5, K.GRAY_L, K.WHITE, K.GRAY_D);
  for (let x = 0; x < W; x += 20) pen.col(K.GRAY).vline(x, 114, 5);

  pen.col(K.GRAY_D).rect(0, 119, W, STAGE_H - 119);
  pen.col(K.GRAY).rect(0, 121, W, 26);
  pen.col(K.GRAY_XD).rect(0, 147, W, STAGE_H - 147);
  for (let x = 8; x < W; x += 24) {
    pen.col(K.YEL).rect(x, 132, 13, 3);
    pen.col(K.YEL_L).hline(x, 132, 13);
  }
}

function paintFactory(pen) {
  // Parede da fábrica limpa com painéis industriais suaves e tubulações nas bordas
  pen.col(K.SAND).rect(0, 0, W, 88);
  pen.col(K.OCHRE).rect(0, 88, W, 12);
  pen.col(K.WOOD_D).hline(0, 88, W);

  // Tubulações industriais nas extremidades
  pen.bevel(0, 0, 7, 100, K.TEAL, K.CYAN, K.BLU_D);
  pen.bevel(W - 7, 0, 7, 100, K.ORANGE, K.YEL, K.RED_D);

  // Janelas industriais com luz do céu
  for (const wx of [34, 242]) {
    pen.col(K.BLACK).rect(wx - 1, 10, 44, 34);
    pen.bevel(wx, 11, 42, 32, K.WOOD_D, K.FLOOR, K.BLACK);
    pen.col(K.SKY_M).rect(wx + 3, 14, 36, 13);
    pen.col(K.SKY_L).rect(wx + 3, 27, 36, 13);
    pen.col(K.WHITE).line(wx + 6, 17, wx + 12, 23);
    pen.col(K.WOOD_D).vline(wx + 21, 14, 26).hline(wx + 3, 27, 36);
  }

  // Prateleira de potes de tinta e blocos à esquerda
  pen.col(K.BLACK).rect(11, 49, 54, 40);
  pen.bevel(12, 50, 52, 38, K.WOOD_D, K.FLOOR, K.WOOD_XD);
  const bits = [K.RED, K.YEL, K.GRN, K.BLU, K.PINK, K.CYAN];
  for (let i = 0; i < 6; i++) {
    const bx = 16 + (i % 3) * 15;
    const by = 54 + ((i / 3) | 0) * 16;
    pen.bevel(bx, by, 12, 12, bits[i], K.WHITE, K.BLACK);
    pen.col(K.WHITE).rect(bx + 2, by + 3, 8, 4);
  }

  // Piso metálico da oficina com faixa de segurança discreta
  pen.col(K.BLACK).hline(0, 99, W);
  pen.col(K.GRAY).rect(0, 100, W, STAGE_H - 100);
  pen.col(K.GRAY_L).hline(0, 101, W);
  pen.col(K.GRAY_D).rect(0, 148, W, STAGE_H - 148);
}

function blobFruit(pen, x, y, c) {
  pen.col(K.BLACK).ellipse(x, y, 7, 6);
  pen.col(c).ellipse(x, y, 6, 5);
  pen.col(K.WHITE).rect(x - 3, y - 3, 2, 2);
}

function paintMarket(pen) {
  pen.col(K.CREAM).rect(0, 0, W, 96);
  pen.col(K.GOLD_L).rect(0, 78, W, 18);

  // Toldo listrado 3D com sombra projetada na parede
  pen.col(K.SAND).rect(0, 18, W, 3);
  for (let x = 0; x < W; x += 16) {
    const isRed = (x % 32) !== 0;
    pen.col(isRed ? K.RED : K.WHITE).rect(x, 0, 16, 16);
    pen.col(isRed ? K.RED_D : K.GRAY_L).rect(x, 16, 16, 2);
  }
  pen.col(K.BLACK).hline(0, 18, W);

  // Piso de ladrilho xadrez com junta fina
  pen.col(K.BLACK).hline(0, 95, W);
  for (let y = 96; y < STAGE_H; y += 10) {
    for (let x = 0; x < W; x += 10) {
      const odd = ((((x + y) / 10) | 0) % 2) !== 0;
      pen.col(odd ? K.BLU_L : K.WHITE).rect(x, y, 10, 10);
      pen.col(odd ? K.BLU : K.GRAY_L).hline(x, y + 9, 10);
    }
  }

  // Placa MERCADO na esquerda (x = 14..90, livre da vitrine central)
  pen.col(K.BLACK).rect(14, 22, 76, 16);
  pen.bevel(15, 23, 74, 14, K.WOOD_D, K.FLOOR, K.BLACK);
  pen.bevel(17, 25, 70, 10, K.YEL, K.YEL_L, K.OCHRE);
  F.textCenter(pen.ctx, 'MERCADO', 52, 27, K.RED, { shadow: K.SAND });

  // Bancada de frutas de madeira com brilho nas frutas
  pen.col(K.BLACK).rect(8, 54, 88, 42);
  pen.bevel(9, 55, 86, 40, K.WOOD_D, K.FLOOR, K.WOOD_XD);
  pen.bevel(11, 57, 82, 13, K.OCHRE, K.SAND, K.FLOOR_D);
  blobFruit(pen, 22, 78, K.RED);
  blobFruit(pen, 40, 80, K.YEL);
  blobFruit(pen, 58, 78, K.GRN);
  blobFruit(pen, 76, 80, K.ORANGE);

  // Gôndola do corredor ao fundo (latas, caixas e potes) — enche a parede
  // atrás da vitrine e do quadro de quantidades, como um corredor de mercado.
  gondola(pen, 100, 24, 218, 70);
}

/** Estante de mercado com 3 prateleiras de produtos coloridos. */
function gondola(pen, x, y, w, h) {
  pen.col(K.BLACK).rect(x, y, w, h);
  pen.bevel(x + 1, y + 1, w - 2, h - 2, K.GRAY_L, K.WHITE, K.GRAY);
  const rows = 3;
  const rowH = Math.floor((h - 4) / rows);
  const goods = [
    [K.RED, K.RED_L], [K.YEL, K.YEL_L], [K.BLU, K.BLU_L], [K.GRN, K.GRN_L],
    [K.ORANGE, K.GOLD_L], [K.PUR, K.PUR_L], [K.PINK, K.PINK_L], [K.CYAN, K.MINT]
  ];
  for (let r = 0; r < rows; r++) {
    const sy = y + 2 + r * rowH;
    pen.col(K.GRAY_D).rect(x + 2, sy + rowH - 3, w - 4, 3);
    pen.col(K.WHITE).hline(x + 2, sy + rowH - 3, w - 4);
    let gx = x + 4;
    let k = r * 3;
    while (gx < x + w - 10) {
      const [c, l] = goods[k % goods.length];
      const kind = (k * 7 + r) % 3;
      const gh = kind === 0 ? rowH - 7 : kind === 1 ? rowH - 10 : rowH - 8;
      const gw = kind === 0 ? 8 : kind === 1 ? 10 : 7;
      const gy = sy + rowH - 3 - gh;
      pen.col(K.BLACK).rect(gx, gy, gw, gh);
      pen.col(c).rect(gx + 1, gy + 1, gw - 2, gh - 1);
      pen.col(l).vline(gx + 1, gy + 1, gh - 2);
      if (kind === 0) pen.col(K.CREAM).rect(gx + 2, gy + 4, gw - 4, 3); // rótulo da lata
      if (kind === 2) pen.col(K.WHITE).rect(gx + 2, gy, gw - 4, 2); // tampa do pote
      gx += gw + 2;
      k++;
    }
  }
}

function paintCheckout(pen) {
  pen.col(K.CREAM).rect(0, 0, W, 96);
  pen.col(K.GOLD_L).rect(0, 78, W, 18);
  for (let x = 0; x < W; x += 16) {
    const isRed = (x % 32) !== 0;
    pen.col(isRed ? K.RED : K.WHITE).rect(x, 0, 16, 12);
    pen.col(isRed ? K.RED_D : K.GRAY_L).rect(x, 12, 16, 2);
  }
  pen.col(K.BLACK).hline(0, 14, W);

  // Placa CAIXA pendurada
  pen.col(K.GRAY_D).vline(150, 14, 8).vline(170, 14, 8);
  pen.col(K.BLACK).rect(126, 21, 68, 16);
  pen.bevel(127, 22, 66, 14, K.GRN_D, K.GRN, K.BLACK);
  F.textCenter(pen.ctx, 'CAIXA 1', 160, 26, K.YEL_L, { shadow: K.BLACK });

  gondola(pen, 4, 26, 96, 56);
  gondola(pen, 268, 26, 48, 56);

  pen.col(K.BLACK).hline(0, 95, W);
  for (let y = 96; y < STAGE_H; y += 10) {
    for (let x = 0; x < W; x += 10) {
      const odd = ((((x + y) / 10) | 0) % 2) !== 0;
      pen.col(odd ? K.BLU_L : K.WHITE).rect(x, y, 10, 10);
      pen.col(odd ? K.BLU : K.GRAY_L).hline(x, y + 9, 10);
    }
  }

  // Balcão do caixa (frente de madeira com faixa)
  pen.col(K.BLACK).rect(36, 104, 230, 34);
  pen.bevel(37, 105, 228, 32, K.FLOOR, K.SAND, K.WOOD_D);
  pen.col(K.FLOOR_D).rect(37, 116, 228, 3);
  pen.col(K.WOOD_D);
  for (let x = 53; x < 265; x += 24) pen.vline(x, 120, 16);
  // Sombra do balcão no piso
  pen.col(K.BLU).rect(38, 138, 228, 3);
}

function paintPost(pen) {
  pen.col(K.CREAM).rect(0, 0, W, 92);
  pen.col(K.GOLD_L).rect(0, 92, W, 18);
  pen.bevel(0, 0, W, 20, K.NAVY, K.BLU, K.NIGHT);
  pen.col(K.YEL).hline(0, 19, W);
  F.textCenter(pen.ctx, 'CORREIOS', 160, 6, K.YEL_L, { shadow: K.BLACK });

  // Balcão de madeira polida
  pen.col(K.BLACK).hline(0, 109, W);
  pen.bevel(0, 110, W, 6, K.OCHRE, K.YEL_L, K.WOOD_D);
  woodPlanks(pen, 116, false);

  // Pacotes com fita no canto
  pen.col(K.BLACK).rect(254, 117, 24, 18);
  pen.bevel(255, 118, 22, 16, K.RED, K.RED_L, K.RED_D);
  pen.col(K.YEL).rect(263, 118, 6, 16).hline(255, 125, 22);
}

function paintParty(pen) {
  // Salão de festa elegante com rodapé e lambris
  pen.col(K.LILAC).rect(0, 0, W, 82);
  pen.col(K.CREAM).rect(0, 82, W, 14);
  pen.bevel(0, 96, W, 4, K.PINK, K.PINK_L, K.PINK_D);
  windowFrame(pen, 8, 16, 48, 40, true);

  woodPlanks(pen, 100, false);

  // Tapete de gala central
  pen.col(K.BLACK).ellipse(180, 140, 92, 17);
  pen.col(K.RED_D).ellipse(180, 140, 90, 16);
  pen.col(K.RED).ellipse(180, 140, 82, 13);
  pen.col(K.YEL).ellipse(180, 140, 68, 9);
  pen.col(K.CREAM).ellipse(180, 140, 48, 5);

  // Lareira de tijolinhos com moldura de madeira à direita
  pen.col(K.BLACK).rect(267, 47, 46, 54);
  pen.bevel(268, 48, 44, 52, K.RED_D, K.RED, K.WOOD_XD);
  pen.bevel(265, 44, 50, 5, K.FLOOR, K.SAND, K.WOOD_D);
  pen.col(K.NIGHT).rect(275, 63, 30, 37);
  pen.col(K.WOOD_D).rect(279, 93, 22, 4);
  pen.col(K.ORANGE).rect(280, 76, 20, 16);
  pen.col(K.YEL).rect(284, 82, 12, 8);
}

const PAINTERS = {
  houseNight: paintHouseNight,
  houseDay: paintHouseDay,
  field: paintField,
  street: paintStreet,
  factory: paintFactory,
  market: paintMarket,
  checkout: paintCheckout,
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
   Camada ambiente sutil
   -------------------------------------------------------------------------- */

let reusablePen = null;
function getPen(ctx) {
  if (!reusablePen || reusablePen.ctx !== ctx) reusablePen = new Pen(ctx);
  reusablePen._ci = -1;
  return reusablePen;
}

export function drawAmbient(ctx, id, t) {
  const pen = getPen(ctx);
  if (id === 'party') {
    const h = 8 + hop(t, 5, 3);
    pen.col(K.ORANGE).rect(280, 92 - h, 20, h);
    pen.col(K.YEL).rect(284, 94 - (h >> 1), 12, h >> 1);
  }
}
