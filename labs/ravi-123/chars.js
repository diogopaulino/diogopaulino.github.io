/* ==========================================================================
   Ravi 1·2·3 — elenco em pixel art (sem folhas JPEG)
   --------------------------------------------------------------------------
   JPEG + chroma-key comia poses (o Ravi “dormia” andando) e deixava borda
   suja. Aqui cada personagem é pintado na paleta VGA, com silhueta própria
   para uma criança de 3–4 anos reconhecer de longe.
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
    pen.col(K.BLACK).hline(x - 1, y, 3);
    return;
  }
  pen.col(K.WHITE).rect(x - 1, y - 1, 3, 3);
  pen.col(K.BLACK).px(x, y);
}

function smile(pen, x, y, big) {
  pen.col(K.RED);
  if (big) {
    pen.px(x - 2, y).px(x - 1, y + 1).px(x, y + 1).px(x + 1, y + 1).px(x + 2, y);
    pen.col(K.WHITE).px(x - 1, y).px(x + 1, y);
  } else {
    pen.px(x - 1, y).px(x, y + 1).px(x + 1, y);
  }
}

function blush(pen, x, y) {
  pen.col(K.PINK).px(x - 5, y).px(x + 5, y);
}

/* --------------------------------------------------------------------------
   Ravi — menino de cabelo bagunçado, camisa verde, calça vermelha, tênis amarelo
   poses: idle, blink, walk0, walk1, wave, cheer, sleep, sit
   -------------------------------------------------------------------------- */

export function paintRavi(pen, pose = 'idle') {
  const blink = pose === 'blink';
  const walk = pose === 'walk0' || pose === 'walk1';
  const step = pose === 'walk1' ? 1 : 0;

  if (pose === 'sleep') {
    paintRaviSleep(pen);
    return;
  }

  const jump = pose === 'cheer' ? -3 : 0;
  const hy = 10 + jump;

  // Sombra
  pen.col(K.BLACK).ellipse(12, 40, pose === 'cheer' ? 5 : 7, 2);

  // Cabelo (volume bagunçado)
  blob(pen, 12, hy - 1, 8, 7, K.WOOD_D);
  pen.col(K.OCHRE).ellipse(11, hy - 2, 5, 4);
  pen.col(K.FLOOR).px(6, hy - 4).px(16, hy - 5).px(12, hy - 7);

  // Cabeça
  blob(pen, 12, hy + 3, 7, 6, K.SKIN);
  eye(pen, 9, hy + 2, blink);
  eye(pen, 15, hy + 2, blink);
  blush(pen, 12, hy + 4);
  smile(pen, 12, hy + 6, pose === 'cheer' || pose === 'wave');

  // Orelhas
  pen.col(K.SKIN).px(4, hy + 3).px(20, hy + 3);

  if (pose === 'sit') {
    box(pen, 7, hy + 10, 10, 8, K.GRN);
    pen.col(K.GRN_L).hline(8, hy + 11, 8);
    box(pen, 6, hy + 17, 12, 6, K.RED);
    blob(pen, 6, hy + 14, 2, 2, K.SKIN);
    blob(pen, 18, hy + 14, 2, 2, K.SKIN);
    box(pen, 6, hy + 22, 5, 3, K.YEL);
    box(pen, 13, hy + 22, 5, 3, K.YEL);
    return;
  }

  // Tronco
  const by = hy + 10;
  box(pen, 7, by, 10, 9, K.GRN);
  pen.col(K.GRN_L).hline(8, by + 1, 8);
  pen.col(K.GRN_D).rect(11, by + 3, 2, 5);

  // Braços
  if (pose === 'cheer') {
    box(pen, 2, by - 8, 4, 8, K.GRN);
    box(pen, 18, by - 8, 4, 8, K.GRN);
    blob(pen, 3, by - 10, 2, 2, K.SKIN);
    blob(pen, 21, by - 10, 2, 2, K.SKIN);
  } else if (pose === 'wave') {
    box(pen, 3, by + 1, 4, 7, K.GRN);
    blob(pen, 4, by + 9, 2, 2, K.SKIN);
    box(pen, 17, by - 7, 4, 8, K.GRN);
    blob(pen, 19, by - 9, 2, 2, K.SKIN);
  } else if (walk) {
    const swing = step ? 2 : -2;
    box(pen, 4, by + 1 + swing, 4, 7, K.GRN);
    box(pen, 16, by + 1 - swing, 4, 7, K.GRN);
    blob(pen, 5, by + 9 + swing, 2, 2, K.SKIN);
    blob(pen, 19, by + 9 - swing, 2, 2, K.SKIN);
  } else {
    box(pen, 3, by + 1, 4, 7, K.GRN);
    box(pen, 17, by + 1, 4, 7, K.GRN);
    blob(pen, 4, by + 9, 2, 2, K.SKIN);
    blob(pen, 20, by + 9, 2, 2, K.SKIN);
  }

  // Calça + pernas
  const ly = by + 9;
  box(pen, 7, ly, 10, 4, K.RED);
  if (walk) {
    const a = step ? 2 : 0;
    const b = step ? 0 : 2;
    box(pen, 7, ly + 4, 4, 6 + a, K.RED);
    box(pen, 13, ly + 4, 4, 6 + b, K.RED);
    box(pen, 7, ly + 10 + a, 5, 3, K.YEL);
    box(pen, 12, ly + 10 + b, 5, 3, K.YEL);
  } else if (pose === 'cheer') {
    box(pen, 5, ly + 4, 5, 6, K.RED);
    box(pen, 14, ly + 4, 5, 6, K.RED);
    box(pen, 4, ly + 10, 6, 3, K.YEL);
    box(pen, 14, ly + 10, 6, 3, K.YEL);
  } else {
    box(pen, 7, ly + 4, 4, 6, K.RED);
    box(pen, 13, ly + 4, 4, 6, K.RED);
    box(pen, 6, ly + 10, 5, 3, K.YEL);
    box(pen, 13, ly + 10, 5, 3, K.YEL);
  }
}

function paintRaviSleep(pen) {
  pen.col(K.BLACK).ellipse(18, 20, 10, 3);
  // Corpo deitado
  box(pen, 14, 10, 16, 8, K.GRN);
  box(pen, 26, 12, 10, 6, K.RED);
  box(pen, 34, 14, 5, 4, K.YEL);
  // Cabeça
  blob(pen, 10, 12, 8, 7, K.WOOD_D);
  blob(pen, 12, 13, 6, 6, K.SKIN);
  pen.col(K.OCHRE).ellipse(9, 10, 4, 3);
  // Olhos fechados + sorriso
  pen.col(K.BLACK).hline(11, 13, 3).hline(16, 13, 3);
  pen.col(K.PINK).px(10, 15).px(18, 15);
  pen.col(K.RED).px(13, 16).px(14, 17).px(15, 16);
}

/* --------------------------------------------------------------------------
   Heróis — 9 silhuetas distintas, nomes curtos em PT
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
  const cheer = pose === 'cheer';
  pen.col(K.BLACK).ellipse(12, 35, 7, 2);
  // Elmo
  box(pen, 6, 2, 12, 10, K.BLU);
  pen.col(K.BLU_L).rect(7, 3, 10, 4);
  pen.col(K.RED).rect(10, 0, 4, 4);
  pen.col(K.YEL).px(12, 0);
  // Viseira / rosto
  blob(pen, 12, 14, 6, 5, K.SKIN);
  eye(pen, 9, 13, false);
  eye(pen, 15, 13, false);
  smile(pen, 12, 16, cheer);
  // Peitoral + capa
  box(pen, 6, 19, 12, 10, K.BLU);
  pen.col(K.YEL).rect(10, 21, 4, 6);
  pen.col(K.RED_D).rect(18, 20, 4, 12);
  // Escudo e espada
  blob(pen, 4, 24, 3, 4, K.CYAN);
  pen.col(K.YEL).frame(2, 21, 5, 8);
  pen.col(K.GRAY_L).rect(20, 8, 2, 14);
  pen.col(K.YEL).rect(19, 20, 4, 3);
  box(pen, 6, 29, 5, 5, K.BLU_D);
  box(pen, 13, 29, 5, 5, K.BLU_D);
}

function paintNinja(pen, pose) {
  pen.col(K.BLACK).ellipse(12, 35, 6, 2);
  blob(pen, 12, 8, 7, 7, K.GRAY_XD);
  pen.col(K.RED).ellipse(12, 8, 7, 2);
  blob(pen, 12, 10, 5, 4, K.SKIN);
  pen.col(K.GRAY_XD).rect(7, 8, 10, 3);
  eye(pen, 9, 11, false);
  eye(pen, 15, 11, false);
  box(pen, 7, 16, 10, 12, K.GRAY_XD);
  pen.col(K.RED).hline(7, 18, 10);
  box(pen, 3, pose === 'cheer' ? 8 : 18, 4, 8, K.GRAY_D);
  box(pen, 17, 18, 4, 8, K.GRAY_D);
  pen.col(K.GRAY).rect(20, 10, 2, 12);
  box(pen, 7, 28, 4, 6, K.GRAY_XD);
  box(pen, 13, 28, 4, 6, K.GRAY_XD);
}

function paintMage(pen, pose) {
  pen.col(K.BLACK).ellipse(12, 35, 7, 2);
  // Chapéu pontudo
  pen.col(K.BLACK).line(12, 0, 4, 12).line(12, 0, 20, 12);
  pen.col(K.PUR).rect(5, 10, 14, 3);
  for (let i = 0; i < 10; i++) {
    pen.col(K.PUR).hline(12 - i, 1 + i, i * 2 + 1);
  }
  pen.col(K.YEL).px(12, 1).px(4, 11).px(20, 11);
  blob(pen, 12, 16, 6, 5, K.SKIN);
  eye(pen, 9, 15, false);
  eye(pen, 15, 15, false);
  smile(pen, 12, 18, true);
  box(pen, 6, 21, 12, 10, K.PUR);
  pen.col(K.PUR_L).hline(7, 22, 10);
  // Cajado
  pen.col(K.WOOD_D).vline(3, 8, 24);
  blob(pen, 3, 7, 3, 3, K.YEL);
  pen.col(K.YEL_L).px(3, 6);
  box(pen, 7, 31, 4, 4, K.PUR);
  box(pen, 13, 31, 4, 4, K.PUR);
}

function paintDragon(pen, pose) {
  pen.col(K.BLACK).ellipse(13, 35, 8, 2);
  // Corpo de dragão fofo
  blob(pen, 12, 20, 9, 8, K.GRN);
  pen.col(K.YEL_L).ellipse(12, 22, 5, 5);
  blob(pen, 18, 10, 6, 6, K.GRN);
  // Chifres
  pen.col(K.YEL).rect(14, 2, 2, 5).rect(20, 2, 2, 5);
  eye(pen, 17, 9, false);
  pen.col(K.WHITE).px(19, 9);
  smile(pen, 20, 12, true);
  // Asas
  pen.col(K.GRN_D).ellipse(4, 16, 5, 7);
  pen.col(K.GRN_L).ellipse(4, 16, 3, 5);
  // Patinhas
  box(pen, 6, 28, 4, 5, K.GRN_D);
  box(pen, 14, 28, 4, 5, K.GRN_D);
  // Fogo se animado
  if (pose === 'cheer' || pose === 'wave') {
    pen.col(K.ORANGE).px(24, 10).px(25, 9).px(26, 10);
    pen.col(K.YEL).px(25, 10);
  }
}

function paintPrincess(pen, pose) {
  pen.col(K.BLACK).ellipse(12, 35, 8, 2);
  // Cabelo loiro longo
  blob(pen, 12, 10, 8, 8, K.YEL);
  pen.col(K.YEL_L).ellipse(12, 9, 6, 5);
  pen.col(K.YEL).rect(4, 12, 3, 10).rect(17, 12, 3, 10);
  // Coroa
  pen.col(K.YEL).rect(8, 1, 8, 4);
  pen.col(K.YEL_L).px(8, 0).px(12, 0).px(16, 0);
  blob(pen, 12, 12, 6, 5, K.SKIN);
  eye(pen, 9, 11, false);
  eye(pen, 15, 11, false);
  blush(pen, 12, 13);
  smile(pen, 12, 15, true);
  // Vestido
  pen.col(K.BLACK).ellipse(12, 30, 11, 6);
  pen.col(K.PINK).ellipse(12, 29, 10, 5);
  box(pen, 8, 18, 8, 8, K.PINK);
  pen.col(K.WHITE).hline(9, 20, 6);
  blob(pen, 5, 20, 2, 2, K.SKIN);
  blob(pen, 19, 20, 2, 2, K.SKIN);
}

function paintRobot(pen, pose) {
  pen.col(K.BLACK).ellipse(12, 35, 7, 2);
  box(pen, 7, 4, 10, 8, K.GRAY);
  pen.col(K.CYAN).rect(9, 6, 2, 2).rect(13, 6, 2, 2);
  if (pose === 'cheer') pen.col(K.YEL).rect(9, 6, 2, 2).rect(13, 6, 2, 2);
  pen.col(K.RED).rect(10, 9, 4, 2);
  box(pen, 6, 13, 12, 12, K.GRAY_L);
  pen.col(K.CYAN).rect(9, 16, 6, 5);
  pen.col(K.YEL).px(4, 2).px(19, 2);
  box(pen, 2, pose === 'wave' || pose === 'cheer' ? 8 : 16, 4, 8, K.GRAY);
  box(pen, 18, 16, 4, 8, K.GRAY);
  box(pen, 7, 25, 4, 8, K.GRAY_D);
  box(pen, 13, 25, 4, 8, K.GRAY_D);
}

function paintFairy(pen, pose) {
  pen.col(K.BLACK).ellipse(12, 35, 6, 2);
  // Asas
  pen.col(K.CYAN).ellipse(4, 16, 5, 8);
  pen.col(K.WHITE).ellipse(4, 16, 3, 5);
  pen.col(K.CYAN).ellipse(20, 16, 5, 8);
  pen.col(K.WHITE).ellipse(20, 16, 3, 5);
  blob(pen, 12, 8, 6, 6, K.YEL);
  blob(pen, 12, 10, 5, 5, K.SKIN);
  eye(pen, 10, 9, false);
  eye(pen, 14, 9, false);
  smile(pen, 12, 12, true);
  box(pen, 8, 16, 8, 8, K.GRN_L);
  pen.col(K.GRN).hline(8, 20, 8);
  blob(pen, 6, 18, 2, 2, K.SKIN);
  blob(pen, 18, 18, 2, 2, K.SKIN);
  box(pen, 8, 24, 3, 8, K.SKIN);
  box(pen, 13, 24, 3, 8, K.SKIN);
  if (pose === 'cheer') {
    pen.col(K.YEL_L).px(2, 8).px(22, 6).px(12, 1);
  }
}

function paintSamurai(pen, pose) {
  pen.col(K.BLACK).ellipse(12, 35, 7, 2);
  box(pen, 6, 2, 12, 8, K.RED);
  pen.col(K.YEL).rect(10, 0, 4, 3);
  blob(pen, 12, 12, 6, 5, K.SKIN);
  eye(pen, 9, 11, false);
  eye(pen, 15, 11, false);
  smile(pen, 12, 14, false);
  box(pen, 6, 17, 12, 11, K.RED);
  pen.col(K.BLACK).hline(6, 22, 12);
  pen.col(K.YEL).rect(10, 18, 4, 8);
  pen.col(K.GRAY_L).rect(19, 8, 2, 16);
  box(pen, 6, 28, 5, 6, K.RED_D);
  box(pen, 13, 28, 5, 6, K.RED_D);
}

function paintArcher(pen, pose) {
  pen.col(K.BLACK).ellipse(12, 35, 7, 2);
  blob(pen, 12, 8, 7, 6, K.OCHRE);
  blob(pen, 12, 10, 6, 5, K.SKIN);
  eye(pen, 9, 9, false);
  eye(pen, 15, 9, false);
  smile(pen, 12, 12, true);
  // Gorro
  pen.col(K.GRN_D).ellipse(12, 4, 7, 3);
  pen.col(K.GRN).px(18, 6);
  box(pen, 7, 16, 10, 10, K.GRN_D);
  pen.col(K.SAND).rect(9, 18, 6, 4);
  // Arco
  pen.col(K.WOOD_D).ring(4, 20, 7);
  pen.col(K.CREAM).vline(4, 14, 13);
  box(pen, 7, 26, 4, 7, K.WOOD_D);
  box(pen, 13, 26, 4, 7, K.WOOD_D);
}
