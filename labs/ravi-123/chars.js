/* ==========================================================================
   Ravi 1·2·3 — Elenco Ilustrado com Volume e Luz (28×46)
   --------------------------------------------------------------------------
   - Ravi: menino com cabelinho cacheado volumoso (cachinhos redondos com
     sombra e brilho), olhos grandes expressivos, camiseta verde com gola,
     bermuda vermelha e tênis amarelo com cadarço e sola branca.
   - 9 Heróis do Reino com silhuetas ricas, sombreado 3-tons e rostos vivos.
   ========================================================================== */

import { K } from './assets.js';

function blob(pen, cx, cy, rx, ry, fill) {
  pen.col(K.BLACK).ellipse(cx, cy, rx + 1, ry + 1);
  pen.col(fill).ellipse(cx, cy, rx, ry);
}

function box(pen, x, y, w, h, fill) {
  pen.col(K.BLACK).rect(x - 1, y - 1, w + 2, h + 2);
  pen.col(fill).rect(x, y, w, h);
}

function eye(pen, x, y, blink) {
  if (blink) {
    pen.col(K.BLACK).hline(x - 1, y + 1, 3);
    pen.col(K.SKIN_D).hline(x - 1, y, 3);
    return;
  }
  pen.col(K.WHITE).rect(x - 1, y - 1, 3, 4);
  pen.col(K.BLACK).rect(x, y, 2, 3);
  pen.col(K.WHITE).px(x, y);
}

function smile(pen, x, y, big) {
  if (big) {
    pen.col(K.BLACK).rect(x - 2, y, 5, 3);
    pen.col(K.RED_D).rect(x - 1, y, 3, 2);
    pen.col(K.RED).hline(x - 1, y + 1, 3);
    pen.col(K.WHITE).hline(x - 1, y, 3);
  } else {
    pen.col(K.BLACK).px(x - 2, y).hline(x - 1, y + 1, 3).px(x + 2, y);
    pen.col(K.RED).hline(x - 1, y, 3);
  }
}

/**
 * Desenha a coroa de cachinhos do Ravi ao redor da cabeça centrada em (cx, hy).
 * Cada cachinho é uma bolinha com contorno, miolo castanho e ponto de brilho.
 */
function paintCurlyHairBack(pen, cx, hy) {
  const backCurls = [
    [cx - 8, hy + 1, 3],
    [cx + 8, hy + 1, 3],
    [cx - 8, hy - 3, 3],
    [cx + 8, hy - 3, 3],
    [cx - 6, hy - 6, 4],
    [cx + 6, hy - 6, 4],
    [cx - 3, hy - 8, 4],
    [cx + 3, hy - 8, 4],
    [cx, hy - 9, 4]
  ];
  for (const [qx, qy, r] of backCurls) {
    pen.col(K.BLACK).ellipse(qx, qy, r + 1, r + 1);
  }
  for (const [qx, qy, r] of backCurls) {
    pen.col(K.WOOD_XD).ellipse(qx, qy, r, r);
    pen.col(K.WOOD_D).ellipse(qx, qy - 1, Math.max(1, r - 1), Math.max(1, r - 1));
  }
}

function paintCurlyHairFront(pen, cx, hy) {
  // Cachinhos frontais e do topo com anéis de luz (efeito de cacho definido)
  const topCurls = [
    [cx - 6, hy - 5, 3],
    [cx - 3, hy - 7, 3],
    [cx + 1, hy - 7, 3],
    [cx + 5, hy - 6, 3],
    [cx - 8, hy - 1, 2],
    [cx + 8, hy - 1, 2]
  ];
  for (const [qx, qy, r] of topCurls) {
    pen.col(K.WOOD_D).ellipse(qx, qy, r, r);
    pen.col(K.FLOOR_D).ellipse(qx - 1, qy - 1, Math.max(1, r - 1), Math.max(1, r - 1));
    pen.col(K.FLOOR).px(qx - 1, qy - 1).px(qx, qy - 2);
  }
  // Cachinhos soltos na testa (franja cacheada)
  for (const fx of [cx - 5, cx - 2, cx + 2, cx + 5]) {
    pen.col(K.WOOD_XD).ellipse(fx, hy - 2, 2, 2);
    pen.col(K.WOOD_D).ellipse(fx, hy - 3, 2, 1);
    pen.col(K.FLOOR).px(fx - 1, hy - 3);
  }
}

/* --------------------------------------------------------------------------
   Ravi — menino de cabelinho cacheado (28×46 em pé, 46×26 deitado)
   -------------------------------------------------------------------------- */

export function paintRavi(pen, pose = 'idle') {
  if (pose === 'sleep') {
    paintRaviSleep(pen);
    return;
  }

  const blink = pose === 'blink';
  const walk = pose === 'walk0' || pose === 'walk1';
  const step = pose === 'walk1' ? 1 : 0;
  const cheer = pose === 'cheer';
  const wave = pose === 'wave';

  const jump = cheer ? -2 : 0;
  const cx = 14;
  const hy = 12 + jump;

  // Sombra elíptica no chão
  pen.col(K.BLACK).ellipse(cx, 43, 8, 2);

  // Camada traseira dos cachos
  paintCurlyHairBack(pen, cx, hy);

  // Orelhas
  blob(pen, cx - 8, hy + 4, 2, 2, K.SKIN_D);
  blob(pen, cx + 8, hy + 4, 2, 2, K.SKIN);

  // Rosto arredondado com sombreamento natural
  blob(pen, cx, hy + 3, 7, 6, K.SKIN);
  pen.col(K.SKIN_D).hline(cx - 4, hy + 8, 8).vline(cx - 6, hy + 3, 4);
  pen.col(K.CREAM).hline(cx - 2, hy - 1, 4);

  // Cachos frontais e volume no topo
  paintCurlyHairFront(pen, cx, hy);

  // Sobrancelhas, olhos com brilho, bochechas coradas e sorriso
  pen.col(K.WOOD_XD).hline(cx - 5, hy, 3).hline(cx + 3, hy, 3);
  eye(pen, cx - 3, hy + 2, blink);
  eye(pen, cx + 3, hy + 2, blink);
  pen.col(K.PINK_L).rect(cx - 6, hy + 5, 2, 1).rect(cx + 5, hy + 5, 2, 1);
  smile(pen, cx, hy + 6, cheer || wave);

  // Pescoço
  pen.col(K.SKIN_D).rect(cx - 2, hy + 9, 4, 2);

  // Camiseta verde com sombreamento, gola amarela e estrela no peito
  const by = hy + 11;
  box(pen, cx - 6, by, 12, 10, K.GRN);
  pen.col(K.GRN_L).hline(cx - 5, by + 1, 10).vline(cx - 5, by + 1, 8);
  pen.col(K.GRN_D).vline(cx + 5, by + 1, 9).hline(cx - 5, by + 9, 10);
  pen.col(K.YEL).hline(cx - 3, by, 6);
  pen.col(K.YEL_L).px(cx, by + 3).hline(cx - 1, by + 4, 3).px(cx, by + 5);

  // Braços e mãozinhas
  if (cheer) {
    box(pen, cx - 10, by - 7, 4, 9, K.GRN);
    box(pen, cx + 6, by - 7, 4, 9, K.GRN);
    pen.col(K.GRN_L).vline(cx - 9, by - 6, 7).vline(cx + 7, by - 6, 7);
    blob(pen, cx - 8, by - 9, 2, 2, K.SKIN);
    blob(pen, cx + 8, by - 9, 2, 2, K.SKIN);
  } else if (wave) {
    box(pen, cx - 10, by + 1, 4, 8, K.GRN);
    blob(pen, cx - 8, by + 10, 2, 2, K.SKIN);
    box(pen, cx + 6, by - 6, 4, 8, K.GRN);
    pen.col(K.GRN_L).vline(cx + 7, by - 5, 6);
    blob(pen, cx + 8, by - 8, 2, 2, K.SKIN);
  } else if (walk) {
    const sw = step ? 2 : -2;
    box(pen, cx - 10, by + 1 + sw, 4, 8, K.GRN);
    box(pen, cx + 6, by + 1 - sw, 4, 8, K.GRN);
    blob(pen, cx - 8, by + 10 + sw, 2, 2, K.SKIN);
    blob(pen, cx + 8, by + 10 - sw, 2, 2, K.SKIN);
  } else {
    box(pen, cx - 10, by + 1, 4, 8, K.GRN);
    box(pen, cx + 6, by + 1, 4, 8, K.GRN);
    pen.col(K.GRN_L).vline(cx - 9, by + 2, 6);
    blob(pen, cx - 8, by + 10, 2, 2, K.SKIN);
    blob(pen, cx + 8, by + 10, 2, 2, K.SKIN);
  }

  // Bermuda vermelha + pernas + tênis amarelos com sola branca
  const ly = by + 10;
  box(pen, cx - 6, ly, 12, 4, K.RED);
  pen.col(K.WOOD_D).hline(cx - 6, ly, 12);
  pen.col(K.YEL).rect(cx - 1, ly, 2, 2);

  if (walk) {
    const a = step ? 2 : 0;
    const b = step ? 0 : 2;
    box(pen, cx - 5, ly + 4, 4, 6 + a, K.RED);
    box(pen, cx + 1, ly + 4, 4, 6 + b, K.RED);
    pen.col(K.WHITE).hline(cx - 5, ly + 9 + a, 4).hline(cx + 1, ly + 9 + b, 4);
    box(pen, cx - 6, ly + 10 + a, 5, 3, K.YEL);
    box(pen, cx + 1, ly + 10 + b, 5, 3, K.YEL);
    pen.col(K.WHITE).hline(cx - 6, ly + 12 + a, 5).hline(cx + 1, ly + 12 + b, 5);
  } else {
    box(pen, cx - 5, ly + 4, 4, 6, K.RED);
    box(pen, cx + 1, ly + 4, 4, 6, K.RED);
    pen.col(K.RED_L).vline(cx - 5, ly + 4, 5).vline(cx + 1, ly + 4, 5);
    pen.col(K.WHITE).hline(cx - 5, ly + 9, 4).hline(cx + 1, ly + 9, 4);
    box(pen, cx - 6, ly + 10, 5, 3, K.YEL);
    box(pen, cx + 1, ly + 10, 5, 3, K.YEL);
    pen.col(K.YEL_L).hline(cx - 5, ly + 10, 4).hline(cx + 2, ly + 10, 4);
    pen.col(K.WHITE).hline(cx - 6, ly + 12, 5).hline(cx + 1, ly + 12, 5);
  }
}

function paintRaviSleep(pen) {
  // 46×26 Ravi dormindo com cabelinho cacheado no travesseiro
  pen.col(K.BLACK).ellipse(23, 23, 18, 3);
  blob(pen, 10, 17, 7, 4, K.CREAM);
  pen.col(K.WHITE).ellipse(9, 16, 5, 2);

  // Cachos de trás no travesseiro
  for (const [qx, qy, r] of [[7, 10, 3], [10, 7, 4], [14, 7, 4], [17, 9, 3], [7, 13, 3]]) {
    pen.col(K.BLACK).ellipse(qx, qy, r + 1, r + 1);
    pen.col(K.WOOD_XD).ellipse(qx, qy, r, r);
    pen.col(K.WOOD_D).ellipse(qx, qy - 1, r - 1, r - 1);
    pen.col(K.FLOOR).px(qx - 1, qy - 1);
  }

  // Corpo deitado
  box(pen, 17, 12, 16, 9, K.GRN);
  pen.col(K.GRN_L).hline(18, 13, 14);
  box(pen, 30, 14, 9, 7, K.RED);
  box(pen, 38, 15, 5, 5, K.YEL);
  pen.col(K.WHITE).vline(42, 15, 5);

  // Rosto sereno
  blob(pen, 14, 14, 6, 5, K.SKIN);
  // Cachinhos da franja
  for (const fx of [11, 14, 17]) {
    pen.col(K.WOOD_D).ellipse(fx, 9, 2, 2);
    pen.col(K.FLOOR).px(fx - 1, 8);
  }
  pen.col(K.BLACK).hline(12, 14, 3).hline(17, 14, 3);
  pen.col(K.PINK_L).px(11, 16).px(19, 16);
  pen.col(K.RED).hline(14, 17, 3);
}

/* --------------------------------------------------------------------------
   9 Heróis do Reino — 28×46 cada, com iluminação e volume
   -------------------------------------------------------------------------- */

export const HERO_SPECS = [
  { id: 'leo', name: 'Leo', short: 'LEO', title: 'o cavaleiro', color: K.BLU, dark: K.BLU_D },
  { id: 'nina', name: 'Nina', short: 'NINA', title: 'a ninja', color: K.GRAY_D, dark: K.GRAY_XD },
  { id: 'luna', name: 'Luna', short: 'LUNA', title: 'a maga', color: K.PUR, dark: K.PUR_L },
  { id: 'draco', name: 'Draco', short: 'DRACO', title: 'o dragão', color: K.GRN, dark: K.GRN_D },
  { id: 'bela', name: 'Bela', short: 'BELA', title: 'a princesa', color: K.PINK, dark: K.PUR },
  { id: 'max', name: 'Max', short: 'MAX', title: 'o robô', color: K.GRAY, dark: K.GRAY_D },
  { id: 'lili', name: 'Lili', short: 'LILI', title: 'a fada', color: K.GRN_L, dark: K.GRN },
  { id: 'ken', name: 'Ken', short: 'KEN', title: 'o samurai', color: K.RED, dark: K.RED_D },
  { id: 'tom', name: 'Tom', short: 'TOM', title: 'o arqueiro', color: K.GRN_D, dark: K.WOOD_D }
];

export function paintHero(pen, spec, pose = 'idle') {
  const painters = {
    leo: paintKnight,
    nina: paintNinja,
    luna: paintMage,
    draco: paintDragon,
    bela: paintPrincess,
    max: paintRobot,
    lili: paintFairy,
    ken: paintSamurai,
    tom: paintArcher
  };
  (painters[spec.id] || paintKnight)(pen, pose);
}

function paintKnight(pen, pose) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 8, 2);
  pen.col(K.RED_D).rect(cx - 6, 20, 13, 14);
  blob(pen, cx, 3, 3, 2, K.RED);
  box(pen, cx - 6, 5, 12, 9, K.BLU);
  pen.col(K.BLU_L).rect(cx - 5, 6, 10, 3);
  pen.col(K.YEL).hline(cx - 6, 10, 12);
  blob(pen, cx, 15, 6, 5, K.SKIN);
  eye(pen, cx - 3, 14, false);
  eye(pen, cx + 3, 14, false);
  smile(pen, cx, 17, pose === 'cheer');
  box(pen, cx - 6, 20, 12, 11, K.BLU);
  pen.col(K.BLU_L).hline(cx - 5, 21, 10);
  pen.col(K.YEL).rect(cx - 2, 22, 4, 7).hline(cx - 3, 24, 6);
  blob(pen, 5, 25, 3, 5, K.CYAN);
  pen.col(K.YEL).frame(3, 21, 5, 9);
  box(pen, 22, 10, 2, 13, K.GRAY_L);
  pen.col(K.WHITE).vline(22, 10, 12);
  pen.col(K.YEL).rect(21, 22, 4, 2);
  box(pen, cx - 6, 31, 5, 7, K.BLU_D);
  box(pen, cx + 1, 31, 5, 7, K.BLU_D);
}

function paintNinja(pen) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 7, 2);
  pen.col(K.RED).rect(20, 9, 5, 2).rect(22, 11, 4, 2);
  blob(pen, cx, 10, 7, 7, K.GRAY_XD);
  pen.col(K.RED).rect(cx - 7, 8, 14, 2);
  blob(pen, cx, 12, 5, 4, K.SKIN);
  pen.col(K.GRAY_XD).rect(cx - 5, 10, 10, 2);
  eye(pen, cx - 3, 12, false);
  eye(pen, cx + 3, 12, false);
  box(pen, cx - 5, 18, 10, 13, K.GRAY_XD);
  pen.col(K.GRAY_D).vline(cx - 4, 19, 11);
  pen.col(K.RED).hline(cx - 5, 25, 10);
  box(pen, 4, 19, 4, 8, K.GRAY_D);
  box(pen, 20, 19, 4, 8, K.GRAY_D);
  box(pen, cx - 5, 31, 4, 7, K.GRAY_XD);
  box(pen, cx + 1, 31, 4, 7, K.GRAY_XD);
}

function paintMage(pen) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 8, 2);
  for (let i = 0; i < 9; i++) {
    pen.col(K.BLACK).hline(cx - i - 1, 2 + i, (i + 1) * 2 + 1);
    pen.col(K.PUR).hline(cx - i, 2 + i, i * 2 + 1);
  }
  box(pen, cx - 8, 11, 16, 3, K.PUR);
  pen.col(K.YEL).hline(cx - 6, 11, 12).px(cx, 5);
  blob(pen, cx, 17, 6, 5, K.SKIN);
  eye(pen, cx - 3, 16, false);
  eye(pen, cx + 3, 16, false);
  smile(pen, cx, 19, true);
  box(pen, cx - 6, 22, 12, 13, K.PUR);
  pen.col(K.PUR_L).hline(cx - 5, 23, 10).rect(cx - 1, 23, 2, 11);
  pen.col(K.WOOD_D).vline(4, 10, 28);
  blob(pen, 4, 9, 3, 3, K.CYAN);
  pen.col(K.WHITE).px(3, 8);
  box(pen, cx - 5, 35, 4, 4, K.PUR_D);
  box(pen, cx + 1, 35, 4, 4, K.PUR_D);
}

function paintDragon(pen) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 9, 2);
  pen.col(K.GRN_D).ellipse(5, 19, 4, 6);
  pen.col(K.ORANGE).ellipse(5, 19, 2, 4);
  blob(pen, cx, 24, 8, 9, K.GRN);
  pen.col(K.YEL_L).ellipse(cx, 26, 5, 6);
  pen.col(K.OCHRE).hline(cx - 4, 24, 8).hline(cx - 4, 27, 8);
  blob(pen, 17, 12, 6, 6, K.GRN);
  pen.col(K.GRN_L).ellipse(16, 10, 4, 2);
  pen.col(K.YEL).rect(13, 4, 2, 4).rect(19, 4, 2, 4);
  eye(pen, 16, 11, false);
  smile(pen, 18, 14, true);
  box(pen, 8, 33, 4, 5, K.GRN_D);
  box(pen, 16, 33, 4, 5, K.GRN_D);
}

function paintPrincess(pen) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 9, 2);
  blob(pen, cx, 12, 8, 8, K.YEL);
  pen.col(K.YEL_L).ellipse(cx, 10, 6, 4);
  pen.col(K.OCHRE).rect(5, 13, 3, 12).rect(20, 13, 3, 12);
  pen.col(K.YEL).rect(cx - 4, 2, 8, 4);
  pen.col(K.RED).px(cx, 3);
  blob(pen, cx, 14, 6, 5, K.SKIN);
  eye(pen, cx - 3, 13, false);
  eye(pen, cx + 3, 13, false);
  smile(pen, cx, 17, true);
  blob(pen, cx, 33, 10, 6, K.PINK);
  pen.col(K.PINK_L).ellipse(cx, 32, 8, 4);
  box(pen, cx - 4, 20, 8, 9, K.PINK);
  pen.col(K.PINK_L).rect(cx - 2, 21, 4, 7);
  pen.col(K.WHITE).hline(cx - 7, 37, 14);
}

function paintRobot(pen) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 8, 2);
  pen.col(K.GRAY_D).vline(cx, 1, 4);
  pen.col(K.RED).rect(cx - 1, 0, 2, 2);
  box(pen, cx - 5, 5, 10, 8, K.GRAY_L);
  pen.col(K.WHITE).hline(cx - 4, 6, 8);
  pen.col(K.NAVY).rect(cx - 4, 7, 8, 4);
  pen.col(K.CYAN).rect(cx - 3, 8, 2, 2).rect(cx + 1, 8, 2, 2);
  box(pen, cx - 6, 14, 12, 13, K.GRAY);
  pen.col(K.GRAY_L).hline(cx - 5, 15, 10);
  pen.col(K.NAVY).rect(cx - 4, 17, 8, 6);
  pen.col(K.GRN_L).vline(cx - 2, 18, 4);
  pen.col(K.YEL).vline(cx, 18, 4);
  pen.col(K.RED_L).vline(cx + 2, 19, 3);
  box(pen, 3, 16, 4, 9, K.GRAY_D);
  box(pen, 21, 16, 4, 9, K.GRAY_D);
  box(pen, cx - 5, 27, 4, 10, K.GRAY_D);
  box(pen, cx + 1, 27, 4, 10, K.GRAY_D);
}

function paintFairy(pen) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 7, 2);
  pen.col(K.CYAN).ellipse(6, 19, 4, 7).ellipse(22, 19, 4, 7);
  pen.col(K.WHITE).ellipse(6, 19, 2, 4).ellipse(22, 19, 2, 4);
  blob(pen, cx, 10, 6, 6, K.YEL);
  blob(pen, cx, 12, 5, 5, K.SKIN);
  eye(pen, cx - 2, 11, false);
  eye(pen, cx + 2, 11, false);
  smile(pen, cx, 14, true);
  box(pen, cx - 4, 18, 8, 9, K.GRN_L);
  pen.col(K.GRN).hline(cx - 4, 23, 8);
  box(pen, cx - 4, 27, 3, 9, K.SKIN);
  box(pen, cx + 1, 27, 3, 9, K.SKIN);
}

function paintSamurai(pen) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 8, 2);
  box(pen, cx - 6, 4, 12, 8, K.RED);
  pen.col(K.RED_L).hline(cx - 5, 5, 10);
  pen.col(K.YEL).rect(cx - 2, 1, 4, 3);
  blob(pen, cx, 14, 6, 5, K.SKIN);
  eye(pen, cx - 3, 13, false);
  eye(pen, cx + 3, 13, false);
  smile(pen, cx, 16, false);
  box(pen, cx - 6, 19, 12, 11, K.RED);
  pen.col(K.YEL).hline(cx - 6, 22, 12).hline(cx - 6, 26, 12);
  pen.col(K.GRAY_L).rect(22, 9, 2, 16);
  box(pen, cx - 6, 30, 5, 7, K.RED_D);
  box(pen, cx + 1, 30, 5, 7, K.RED_D);
}

function paintArcher(pen) {
  const cx = 14;
  pen.col(K.BLACK).ellipse(cx, 40, 8, 2);
  blob(pen, cx, 10, 7, 6, K.OCHRE);
  blob(pen, cx, 12, 6, 5, K.SKIN);
  eye(pen, cx - 3, 11, false);
  eye(pen, cx + 3, 11, false);
  smile(pen, cx, 14, true);
  pen.col(K.GRN_D).ellipse(cx, 5, 7, 3);
  pen.col(K.RED).line(cx + 3, 5, cx + 7, 2);
  box(pen, cx - 5, 18, 10, 10, K.GRN_D);
  pen.col(K.GRN).rect(cx - 4, 19, 8, 8);
  pen.col(K.WOOD_D).hline(cx - 5, 25, 10);
  pen.col(K.WOOD_D).ring(5, 22, 7);
  pen.col(K.CREAM).vline(5, 16, 13);
  box(pen, cx - 5, 28, 4, 8, K.WOOD_D);
  box(pen, cx + 1, 28, 4, 8, K.WOOD_D);
}
