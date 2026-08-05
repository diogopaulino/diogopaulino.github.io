/* ==========================================================================
   Ravi 1·2·3 — sprites do elenco, brinquedos, comidas e veículos
   --------------------------------------------------------------------------
   Tudo é assado uma única vez no boot, em canvas fora de tela. Em tempo de
   execução o render só faz drawImage — nenhum path, nenhuma alocação.
   ========================================================================== */

import { K, bakeSprite } from './assets.js';

/* --------------------------------------------------------------------------
   Dados (nomes e propriedades vêm do jogo antigo, a arte é nova)
   -------------------------------------------------------------------------- */

/* `short` é o rótulo que cabe na caixa postal dos correios (5 chars no máximo);
   `name` é o usado na narração falada. */
export const HEROES = [
  { id: 'bolt', name: 'Sir Bolt', short: 'BOLT', title: 'Cavaleiro', color: K.BLU, dark: K.BLU_D },
  { id: 'luna', name: 'Luna', short: 'LUNA', title: 'Feiticeira', color: K.PUR, dark: K.PUR_L },
  { id: 'freya', name: 'Freya', short: 'FREYA', title: 'Arqueira', color: K.GRN, dark: K.GRN_D },
  { id: 'kenzo', name: 'Kenzo', short: 'KENZO', title: 'Samurai', color: K.RED, dark: K.RED_D },
  { id: 'bjorn', name: 'Bjorn', short: 'BJORN', title: 'Viking', color: K.ORANGE, dark: K.OCHRE },
  { id: 'shade', name: 'Shade', short: 'SHADE', title: 'Ninja', color: K.GRAY_D, dark: K.GRAY_XD },
  { id: 'max', name: 'Maximus', short: 'MAX', title: 'Gladiador', color: K.OCHRE, dark: K.WOOD_D },
  { id: 'ember', name: 'Ember', short: 'EMBER', title: 'Dragão', color: K.RED_L, dark: K.RED },
  { id: 'aria', name: 'Aria', short: 'ARIA', title: 'Princesa', color: K.PINK, dark: K.PUR }
];

export const TOYS = [
  { id: 'urso', name: 'Urso' },
  { id: 'palhaco', name: 'Palhaço' },
  { id: 'dino', name: 'Dinossauro' },
  { id: 'barco', name: 'Barco' },
  { id: 'trem', name: 'Trenzinho' },
  { id: 'robo', name: 'Robô' },
  { id: 'trombeta', name: 'Trombeta' },
  { id: 'bola', name: 'Bola' },
  { id: 'boneco', name: 'Boneco' }
];

export const FOODS = [
  { id: 'burger', name: 'Hambúrguer' },
  { id: 'fries', name: 'Batata frita' },
  { id: 'apple', name: 'Maçã' },
  { id: 'milk', name: 'Leite' },
  { id: 'balloon', name: 'Balão' }
];

export const VEHICLES = [
  { id: 'walk', name: 'A pé', wheels: 0, w: 26 },
  { id: 'uni', name: 'Monociclo', wheels: 1, w: 26 },
  { id: 'moto', name: 'Moto', wheels: 2, w: 42 },
  { id: 'tri', name: 'Triciclo', wheels: 3, w: 44 },
  { id: 'car', name: 'Carrinho', wheels: 4, w: 52 },
  { id: 'jipe', name: 'Jipe', wheels: 5, w: 58 },
  { id: 'van', name: 'Van', wheels: 6, w: 64 },
  { id: 'trator', name: 'Trator', wheels: 7, w: 70 },
  { id: 'bus', name: 'Ônibus', wheels: 8, w: 78 },
  { id: 'truck', name: 'Caminhão', wheels: 9, w: 86 }
];

/** Preenchido por buildSprites(). */
export const SPR = {
  ravi: {},
  hero: {},
  heroSmall: {},
  toy: {},
  food: {},
  vehicle: {},
  misc: {}
};

/* --------------------------------------------------------------------------
   Helpers de forma
   -------------------------------------------------------------------------- */

/** Elipse com contorno preto de 1px. */
function blob(pen, cx, cy, rx, ry, fill) {
  pen.col(K.BLACK).ellipse(cx, cy, rx + 1, ry + 1);
  pen.col(fill).ellipse(cx, cy, rx, ry);
}

/** Retângulo com contorno preto de 1px. */
function box(pen, x, y, w, h, fill) {
  pen.col(K.BLACK).rect(x - 1, y - 1, w + 2, h + 2);
  pen.col(fill).rect(x, y, w, h);
}

/** Par de olhos com pupila. */
function eyes(pen, cx, cy, spread, look = 0) {
  pen.col(K.WHITE).ellipse(cx - spread, cy, 3, 4).ellipse(cx + spread, cy, 3, 4);
  pen.col(K.BLACK).ellipse(cx - spread + look, cy + 1, 1, 2).ellipse(cx + spread + look, cy + 1, 1, 2);
}

/** Olhos fechados (sono / riso). */
function eyesClosed(pen, cx, cy, spread) {
  pen.col(K.BLACK);
  pen.hline(cx - spread - 2, cy, 5).hline(cx + spread - 2, cy, 5);
  pen.px(cx - spread - 3, cy - 1).px(cx - spread + 2, cy - 1);
  pen.px(cx + spread - 3, cy - 1).px(cx + spread + 2, cy - 1);
}

/* --------------------------------------------------------------------------
   Ravi — 26×38, pés apoiados na base
   -------------------------------------------------------------------------- */

/* As figuras são desenhadas com a cabeça perto de y=0 e o corpo centrado em
   cx; as folgas abaixo abrem espaço para topete, elmos e braços erguidos não
   serem cortados nas bordas do sprite. */
const RAVI_PADX = 2;
const RAVI_PADY = 3;
const RAVI_W = 32;
const RAVI_H = 43;

function drawRavi(pen, pose) {
  const cx = 13;
  const armUp = pose === 'wave' || pose === 'cheer';
  const bothUp = pose === 'cheer';
  const step = pose === 'walk1';
  const asleep = pose === 'sleep';
  const sitting = asleep || pose === 'sit';

  // Sapatos
  const footY = sitting ? 33 : 35;
  const spreadL = step ? cx - 9 : cx - 6;
  const spreadR = step ? cx + 9 : cx + 6;
  blob(pen, spreadL, footY, 5, 3, K.YEL);
  blob(pen, spreadR, footY, 5, 3, K.YEL);

  // Pernas (macacão azul)
  const legTop = sitting ? 24 : 26;
  box(pen, cx - 7, legTop, 5, footY - legTop - 2, K.BLU);
  box(pen, cx + 3, legTop, 5, footY - legTop - 2, K.BLU);

  // Tronco: camiseta verde por baixo, macacão azul por cima
  box(pen, cx - 8, 15, 17, 12, K.GRN);
  pen.col(K.GRN_D).hline(cx - 8, 26, 17);
  box(pen, cx - 7, 21, 15, 7, K.BLU);
  pen.col(K.BLU_D).hline(cx - 7, 27, 15);
  // Alças do macacão
  pen.col(K.BLU).rect(cx - 5, 15, 3, 7).rect(cx + 3, 15, 3, 7);
  pen.col(K.YEL).px(cx - 4, 21).px(cx + 4, 21);

  // Braços
  if (bothUp) {
    pen.col(K.BLACK).rect(cx - 12, 7, 4, 11).rect(cx + 9, 7, 4, 11);
    pen.col(K.SKIN).rect(cx - 11, 8, 2, 10).rect(cx + 10, 8, 2, 10);
    blob(pen, cx - 10, 6, 3, 3, K.WHITE);
    blob(pen, cx + 11, 6, 3, 3, K.WHITE);
  } else if (armUp) {
    pen.col(K.BLACK).rect(cx - 11, 16, 4, 10);
    pen.col(K.SKIN).rect(cx - 10, 17, 2, 9);
    blob(pen, cx - 9, 27, 3, 3, K.WHITE);
    pen.col(K.BLACK).rect(cx + 9, 7, 4, 11);
    pen.col(K.SKIN).rect(cx + 10, 8, 2, 10);
    blob(pen, cx + 11, 6, 3, 3, K.WHITE);
  } else {
    const swing = pose === 'walk0' ? 1 : pose === 'walk1' ? -1 : 0;
    pen.col(K.BLACK).rect(cx - 11, 16 + swing, 4, 10);
    pen.col(K.SKIN).rect(cx - 10, 17 + swing, 2, 9);
    blob(pen, cx - 9, 27 + swing, 3, 3, K.WHITE);
    pen.col(K.BLACK).rect(cx + 8, 16 - swing, 4, 10);
    pen.col(K.SKIN).rect(cx + 9, 17 - swing, 2, 9);
    blob(pen, cx + 10, 27 - swing, 3, 3, K.WHITE);
  }

  // Cabeça
  blob(pen, cx, 9, 9, 8, K.SKIN);
  // Orelhas
  blob(pen, cx - 9, 5, 3, 3, K.SKIN);
  blob(pen, cx + 9, 5, 3, 3, K.SKIN);
  // Topete
  pen.col(K.WOOD_D);
  pen.rect(cx - 6, 0, 12, 3).rect(cx - 8, 2, 16, 2);
  pen.px(cx - 1, -1).px(cx, -1).px(cx + 1, 0);
  pen.col(K.BLACK).hline(cx - 8, 4, 16);

  if (asleep) {
    eyesClosed(pen, cx, 9, 4);
    // Boca aberta de quem ronca
    pen.col(K.BLACK).ellipse(cx, 14, 2, 2);
  } else {
    eyes(pen, cx, 8, 4, pose === 'walk1' ? 1 : 0);
    // Sorriso
    pen.col(K.BLACK);
    pen.hline(cx - 3, 14, 7).px(cx - 4, 13).px(cx + 4, 13);
    if (pose === 'cheer') pen.col(K.RED_L).hline(cx - 2, 15, 5);
  }
  // Nariz
  pen.col(K.OCHRE).ellipse(cx, 11, 2, 1);
}

/* --------------------------------------------------------------------------
   Heróis — 22×32
   -------------------------------------------------------------------------- */

const HERO_PADX = 6;
const HERO_PADY = 17;
const HERO_W = 36;
const HERO_H = 50;

function drawHero(pen, hero) {
  const cx = 11;
  const headY = 9;

  // Pés
  blob(pen, cx - 4, 29, 4, 2, K.WOOD_D);
  blob(pen, cx + 4, 29, 4, 2, K.WOOD_D);
  // Corpo
  box(pen, cx - 7, 16, 15, 12, hero.color);
  pen.col(hero.dark).hline(cx - 7, 27, 15).rect(cx - 7, 16, 15, 2);
  // Braços
  pen.col(K.BLACK).rect(cx - 10, 17, 3, 9).rect(cx + 8, 17, 3, 9);
  pen.col(hero.dark).rect(cx - 9, 18, 1, 8).rect(cx + 9, 18, 1, 8);
  // Cabeça
  blob(pen, cx, headY, 7, 7, K.SKIN);

  /* Os adereços entram ANTES do rosto: elmo, capuz e coroa se sobrepõem ao
     crânio, e desenhar os olhos depois garante que nenhum herói vire um
     borrão sem cara. Quem tem máscara ou focinho marca `custom`. */
  let custom = false;

  switch (hero.id) {
    case 'bolt': // elmo com penacho
      pen.col(K.BLACK).ellipse(cx, headY - 5, 8, 6);
      pen.col(K.GRAY_L).ellipse(cx, headY - 5, 7, 5);
      pen.col(K.GRAY).hline(cx - 7, headY - 4, 15);
      pen.col(K.RED).rect(cx - 1, headY - 14, 3, 6);
      pen.col(K.BLACK).frame(cx - 2, headY - 15, 5, 8);
      break;
    case 'luna': // chapéu pontudo
      pen.col(K.BLACK).line(cx - 9, headY - 5, cx, headY - 16).line(cx + 9, headY - 5, cx, headY - 16);
      pen.col(hero.dark);
      for (let y = 0; y < 11; y++) {
        const w = Math.round((11 - y) * 0.8);
        pen.hline(cx - w, headY - 5 - y, w * 2);
      }
      pen.col(K.YEL).px(cx - 3, headY - 9).px(cx + 3, headY - 12);
      pen.col(K.BLACK).hline(cx - 10, headY - 4, 21);
      break;
    case 'freya': // capuz e arco
      pen.col(K.BLACK).ellipse(cx, headY - 5, 9, 7);
      pen.col(hero.dark).ellipse(cx, headY - 5, 8, 6);
      pen.col(K.GRN_L).hline(cx - 8, headY - 4, 17);
      pen.col(K.WOOD_D).ring(cx + 11, 18, 6);
      pen.col(K.CREAM).line(cx + 8, 13, cx + 8, 23);
      break;
    case 'kenzo': // faixa e coque
      pen.col(K.BLACK).ellipse(cx, headY - 6, 4, 3);
      pen.col(K.GRAY_XD).ellipse(cx, headY - 6, 3, 2);
      pen.col(K.RED).rect(cx - 7, headY - 4, 15, 3);
      pen.col(K.WHITE).px(cx, headY - 3);
      pen.col(K.BLACK).hline(cx - 7, headY - 5, 15);
      break;
    case 'bjorn': // elmo com chifres
      pen.col(K.BLACK).ellipse(cx, headY - 5, 9, 6);
      pen.col(K.GRAY).ellipse(cx, headY - 5, 8, 5);
      pen.col(K.GRAY_L).hline(cx - 8, headY - 4, 17);
      pen.col(K.CREAM).ellipse(cx - 10, headY - 9, 3, 4).ellipse(cx + 10, headY - 9, 3, 4);
      pen.col(K.BLACK).ring(cx - 10, headY - 9, 4).ring(cx + 10, headY - 9, 4);
      break;
    case 'shade': // máscara ninja: só os olhos aparecem
      pen.col(K.GRAY_XD).ellipse(cx, headY - 2, 8, 7);
      pen.col(K.SKIN).rect(cx - 6, headY - 3, 13, 5);
      eyes(pen, cx, headY - 1, 3);
      pen.col(K.GRAY_XD).rect(cx - 8, headY + 2, 17, 5);
      custom = true;
      break;
    case 'max': // elmo de gladiador com crista
      pen.col(K.BLACK).ellipse(cx, headY - 5, 9, 6);
      pen.col(K.OCHRE).ellipse(cx, headY - 5, 8, 5);
      pen.col(K.RED).rect(cx - 1, headY - 15, 3, 8);
      pen.col(K.RED_L).vline(cx - 1, headY - 15, 8);
      pen.col(K.BLACK).frame(cx - 2, headY - 16, 5, 10);
      break;
    case 'ember': // dragãozinho com asas e focinho
      pen.col(K.BLACK).ellipse(cx - 11, 18, 5, 7).ellipse(cx + 11, 18, 5, 7);
      pen.col(K.ORANGE).ellipse(cx - 11, 18, 4, 6).ellipse(cx + 11, 18, 4, 6);
      eyes(pen, cx, headY - 2, 3);
      pen.col(K.YEL).ellipse(cx, headY + 4, 5, 3);
      pen.col(K.BLACK).ring(cx, headY + 4, 3).px(cx - 2, headY + 3).px(cx + 2, headY + 3);
      pen.col(K.GRN_L).px(cx - 3, headY - 8).px(cx, headY - 9).px(cx + 3, headY - 8);
      custom = true;
      break;
    case 'aria': // coroa
      pen.col(K.BLACK).rect(cx - 7, headY - 12, 15, 6);
      pen.col(K.YEL).rect(cx - 6, headY - 11, 13, 4);
      pen.col(K.YEL).px(cx - 6, headY - 13).px(cx, headY - 14).px(cx + 6, headY - 13);
      pen.col(K.PINK).px(cx, headY - 9);
      break;
    default:
      break;
  }

  if (!custom) {
    eyes(pen, cx, headY - 1, 3);
    pen.col(K.BLACK).hline(cx - 2, headY + 4, 5);
  }
}

/* --------------------------------------------------------------------------
   Brinquedos — ícones 16×16
   -------------------------------------------------------------------------- */

const TOY_PAINTERS = {
  urso(pen) {
    blob(pen, 4, 4, 2, 2, K.WOOD_D);
    blob(pen, 11, 4, 2, 2, K.WOOD_D);
    blob(pen, 8, 6, 5, 4, K.OCHRE);
    blob(pen, 8, 12, 5, 4, K.OCHRE);
    pen.col(K.BLACK).px(6, 5).px(10, 5).px(8, 7);
    pen.col(K.SAND).ellipse(8, 12, 2, 2);
  },
  palhaco(pen) {
    box(pen, 3, 8, 11, 7, K.RED);
    pen.col(K.YEL).hline(3, 10, 11);
    blob(pen, 8, 5, 4, 4, K.CREAM);
    pen.col(K.RED).ellipse(8, 6, 1, 1);
    pen.col(K.BLACK).px(6, 4).px(10, 4);
    pen.col(K.BLU).px(4, 2).px(12, 2).hline(5, 3, 7);
  },
  dino(pen) {
    blob(pen, 7, 10, 6, 4, K.GRN);
    blob(pen, 12, 5, 3, 3, K.GRN);
    pen.col(K.GRN_D).px(4, 6).px(6, 5).px(8, 5).px(10, 5);
    pen.col(K.BLACK).px(13, 4);
    pen.col(K.GRN_D).rect(1, 11, 3, 2);
    pen.col(K.GRN_D).rect(5, 13, 2, 2).rect(9, 13, 2, 2);
  },
  barco(pen) {
    pen.col(K.WOOD_D).rect(2, 11, 12, 3);
    pen.col(K.BLACK).frame(1, 10, 14, 5);
    pen.col(K.CREAM).vline(8, 2, 8);
    pen.col(K.RED).line(9, 3, 9, 9).line(12, 9, 9, 9).line(12, 9, 9, 3);
    pen.col(K.BLU_L).hline(0, 15, 16);
  },
  trem(pen) {
    box(pen, 2, 6, 8, 6, K.RED);
    box(pen, 10, 8, 4, 4, K.BLU);
    pen.col(K.GRAY_XD).rect(4, 3, 3, 3);
    pen.col(K.WHITE).px(5, 2);
    pen.col(K.BLACK).ellipse(4, 13, 2, 2).ellipse(11, 13, 2, 2);
    pen.col(K.GRAY_L).px(4, 13).px(11, 13);
  },
  robo(pen) {
    box(pen, 4, 5, 8, 8, K.GRAY_L);
    box(pen, 5, 1, 6, 4, K.GRAY);
    pen.col(K.RED).px(7, 2).px(9, 2);
    pen.col(K.GRAY).rect(1, 6, 3, 2).rect(12, 6, 3, 2);
    pen.col(K.CYAN).rect(6, 8, 4, 3);
    pen.col(K.YEL).px(3, 0).px(12, 0);
  },
  trombeta(pen) {
    pen.col(K.YEL).rect(3, 7, 8, 3);
    pen.col(K.BLACK).frame(2, 6, 10, 5);
    pen.col(K.YEL).ellipse(13, 8, 2, 4);
    pen.col(K.BLACK).ring(13, 8, 4);
    pen.col(K.OCHRE).px(5, 5).px(7, 5).px(9, 5);
    pen.col(K.BLACK).px(5, 4).px(7, 4).px(9, 4);
  },
  bola(pen) {
    blob(pen, 8, 8, 6, 6, K.WHITE);
    pen.col(K.RED).ellipse(8, 5, 5, 2);
    pen.col(K.BLU).ellipse(8, 11, 5, 2);
    pen.col(K.WHITE).ellipse(6, 6, 1, 1);
  },
  boneco(pen) {
    blob(pen, 8, 4, 3, 3, K.SKIN);
    pen.col(K.WOOD_D).hline(6, 1, 5);
    pen.col(K.BLACK).px(7, 4).px(9, 4);
    box(pen, 5, 7, 7, 5, K.GRN);
    pen.col(K.BLU).rect(5, 12, 7, 2);
    pen.col(K.YEL).px(5, 14).px(11, 14);
    pen.col(K.SKIN).px(3, 8).px(12, 8);
  }
};

/* --------------------------------------------------------------------------
   Comidas / balão — ícones 14×16
   -------------------------------------------------------------------------- */

const FOOD_PAINTERS = {
  burger(pen) {
    pen.col(K.OCHRE).ellipse(7, 6, 6, 3);
    pen.col(K.SAND).ellipse(7, 5, 5, 2);
    pen.col(K.GRN).rect(1, 8, 12, 2);
    pen.col(K.WOOD_D).rect(1, 10, 12, 2);
    pen.col(K.OCHRE).ellipse(7, 12, 6, 2);
    pen.col(K.BLACK).px(5, 4).px(9, 3);
  },
  fries(pen) {
    pen.col(K.YEL).rect(3, 2, 2, 6).rect(6, 1, 2, 7).rect(9, 3, 2, 5);
    pen.col(K.YEL_L).vline(3, 2, 6).vline(6, 1, 7);
    pen.col(K.RED).rect(2, 7, 10, 8);
    pen.col(K.RED_D).hline(2, 14, 10);
    pen.col(K.WHITE).rect(4, 9, 6, 3);
    pen.col(K.BLACK).frame(1, 6, 12, 10);
  },
  apple(pen) {
    blob(pen, 7, 9, 5, 5, K.RED);
    pen.col(K.RED_L).ellipse(5, 7, 1, 2);
    pen.col(K.WOOD_D).vline(7, 2, 3);
    pen.col(K.GRN).ellipse(10, 3, 2, 1);
  },
  milk(pen) {
    box(pen, 4, 4, 7, 11, K.WHITE);
    pen.col(K.BLU).rect(4, 4, 7, 3);
    pen.col(K.BLACK).line(4, 4, 7, 1).line(11, 4, 7, 1);
    pen.col(K.WHITE).px(7, 2).px(8, 3);
    pen.col(K.BLU_L).rect(5, 9, 5, 4);
  },
  balloon(pen) {
    blob(pen, 7, 6, 5, 6, K.PINK);
    pen.col(K.WHITE).ellipse(5, 4, 1, 2);
    pen.col(K.PINK).px(7, 12).px(6, 13).px(8, 13);
    pen.col(K.CREAM).line(7, 13, 7, 15);
  }
};

/* --------------------------------------------------------------------------
   Veículos — a base tem 26px de altura, a roda é o elemento a contar
   -------------------------------------------------------------------------- */

function wheel(pen, cx, cy, r) {
  pen.col(K.BLACK).ellipse(cx, cy, r, r);
  pen.col(K.GRAY_L).ellipse(cx, cy, Math.max(1, r - 2), Math.max(1, r - 2));
  pen.col(K.GRAY_D).ellipse(cx, cy, 1, 1);
}

function drawVehicle(pen, v, w) {
  const groundY = 23;
  /* Todas as rodas ficam em fila na base, sem sobreposição: a criança precisa
     conseguir contar uma a uma. O raio encolhe conforme a quantidade cresce. */
  const r = v.wheels >= 8 ? 3 : v.wheels >= 5 ? 4 : 5;
  const wheelY = groundY - r;

  switch (v.id) {
    case 'walk':
      break;
    case 'uni':
      pen.col(K.GRAY_XD).vline(w >> 1, 8, 8);
      pen.col(K.WOOD_D).hline((w >> 1) - 4, 8, 9);
      break;
    case 'moto':
      pen.col(K.RED).rect(10, 12, 22, 5);
      pen.col(K.BLACK).frame(9, 11, 24, 7);
      pen.col(K.GRAY_XD).line(10, 12, 6, 7).line(32, 12, 36, 8);
      pen.col(K.GRAY_L).hline(3, 7, 7);
      break;
    case 'tri':
      pen.col(K.BLU).rect(8, 11, 26, 6);
      pen.col(K.BLACK).frame(7, 10, 28, 8);
      pen.col(K.GRAY_XD).line(10, 11, 7, 6);
      pen.col(K.RED).rect(22, 7, 8, 4);
      break;
    case 'car': {           // 4 — carrinho baixo e vermelho
      const y = groundY - r - 12;
      pen.col(K.BLACK).rect(3, y + 4, w - 6, 10);
      pen.col(K.RED).rect(4, y + 5, w - 8, 8);
      pen.col(K.RED_D).hline(4, y + 12, w - 8);
      pen.col(K.BLACK).rect(14, y - 4, w - 30, 9);
      pen.col(K.RED_L).rect(15, y - 3, w - 32, 7);
      pen.col(K.CYAN).rect(17, y - 1, (w - 36) / 2, 4).rect(19 + (w - 36) / 2, y - 1, (w - 36) / 2, 4);
      pen.col(K.YEL_L).rect(w - 6, y + 7, 2, 3);
      break;
    }
    case 'jipe': {          // 5 — jipe verde com santantônio
      const y = groundY - r - 13;
      pen.col(K.BLACK).rect(3, y + 4, w - 6, 11);
      pen.col(K.GRN).rect(4, y + 5, w - 8, 9);
      pen.col(K.GRN_D).hline(4, y + 13, w - 8);
      pen.col(K.GRAY_XD).line(14, y + 4, 14, y - 6).line(w - 16, y + 4, w - 16, y - 6)
        .line(14, y - 6, w - 16, y - 6);
      pen.col(K.CYAN).rect(w - 26, y - 2, 9, 5);
      pen.col(K.BLACK).frame(w - 27, y - 3, 11, 7);
      pen.col(K.YEL_L).rect(w - 6, y + 8, 2, 3);
      break;
    }
    case 'trator': {        // 7 — trator laranja de cabine alta
      const y = groundY - r - 12;
      pen.col(K.BLACK).rect(3, y + 4, w - 6, 11);
      pen.col(K.ORANGE).rect(4, y + 5, w - 8, 9);
      pen.col(K.OCHRE).hline(4, y + 13, w - 8);
      pen.col(K.BLACK).rect(w - 30, y - 14, 22, 19);
      pen.col(K.ORANGE).rect(w - 29, y - 13, 20, 17);
      pen.col(K.CYAN).rect(w - 26, y - 10, 14, 9);
      pen.col(K.GRAY_XD).rect(10, y - 10, 5, 15);
      pen.col(K.GRAY).rect(11, y - 10, 3, 15);
      break;
    }
    default: {              // 6 van, 8 ônibus, 9 caminhão
      const isBus = v.id === 'bus';
      const isTruck = v.id === 'truck';
      const bodyH = isBus ? 17 : 14;
      const bodyY = groundY - r - bodyH - 1;
      const face = isBus ? K.YEL : isTruck ? K.GRAY_L : K.BLU;
      const shade = isBus ? K.OCHRE : isTruck ? K.GRAY_D : K.BLU_D;

      if (isTruck) {
        // Cabine vermelha na frente + baú cinza atrás
        pen.col(K.BLACK).rect(2, bodyY + 3, w - 30, bodyH - 2);
        pen.col(K.GRAY_L).rect(3, bodyY + 4, w - 32, bodyH - 4);
        pen.col(K.GRAY_D).hline(3, bodyY + bodyH - 1, w - 32);
        pen.col(K.BLACK).rect(w - 28, bodyY - 1, 26, bodyH + 2);
        pen.col(K.RED).rect(w - 27, bodyY, 24, bodyH);
        pen.col(K.RED_D).hline(w - 27, bodyY + bodyH - 1, 24);
        pen.col(K.CYAN).rect(w - 24, bodyY + 3, 12, 6);
        pen.col(K.BLACK).frame(w - 25, bodyY + 2, 14, 8);
        pen.col(K.YEL_L).rect(w - 5, bodyY + bodyH - 5, 2, 3);
        break;
      }

      pen.col(K.BLACK).rect(2, bodyY - 1, w - 4, bodyH + 2);
      pen.col(face).rect(3, bodyY, w - 6, bodyH);
      pen.col(shade).hline(3, bodyY + bodyH - 1, w - 6);
      pen.col(K.CYAN);
      for (let x = 7; x < w - 10; x += 12) pen.rect(x, bodyY + 3, 8, 6);
      pen.col(K.BLACK);
      for (let x = 7; x < w - 10; x += 12) pen.frame(x - 1, bodyY + 2, 10, 8);
      if (isBus) pen.col(K.BLACK).rect(3, bodyY + 11, w - 6, 2);
      pen.col(K.YEL_L).rect(w - 5, bodyY + bodyH - 5, 2, 3);
      break;
    }
  }

  const n = v.wheels;
  if (n === 1) {
    wheel(pen, w >> 1, groundY - 7, 7);
  } else if (n > 1) {
    const margin = r + 2;
    const span = w - margin * 2;
    for (let i = 0; i < n; i++) {
      const x = margin + Math.round((i * span) / (n - 1));
      wheel(pen, x, wheelY, r);
    }
  }
}

/* --------------------------------------------------------------------------
   Diversos
   -------------------------------------------------------------------------- */

function drawSheep(pen) {
  blob(pen, 11, 8, 8, 5, K.WHITE);
  pen.col(K.GRAY_L).ellipse(6, 6, 2, 2).ellipse(11, 5, 2, 2).ellipse(16, 6, 2, 2);
  blob(pen, 19, 6, 3, 3, K.GRAY_XD);
  pen.col(K.WHITE).px(19, 5);
  pen.col(K.BLACK).px(20, 6);
  pen.col(K.GRAY_XD).vline(6, 12, 3).vline(10, 12, 3).vline(14, 12, 3).vline(17, 12, 3);
}

function drawMailman(pen) {
  // Bicicleta
  pen.col(K.BLACK).ring(8, 24, 6).ring(26, 24, 6);
  pen.col(K.GRAY).ring(8, 24, 3).ring(26, 24, 3);
  pen.col(K.GRAY_XD).line(8, 24, 17, 14).line(26, 24, 17, 14).line(17, 14, 17, 9);
  pen.col(K.BLU_D).hline(13, 9, 9);
  // Carteiro
  box(pen, 12, 12, 10, 9, K.BLU);
  blob(pen, 17, 7, 5, 5, K.SKIN);
  pen.col(K.BLACK).px(15, 6).px(19, 6);
  pen.col(K.BLU_D).rect(11, 1, 13, 3);
  pen.col(K.BLACK).frame(10, 0, 15, 5);
  // Bolsa de correspondência
  box(pen, 22, 15, 8, 6, K.CREAM);
  pen.col(K.RED).px(26, 17);
}

function drawEnvelope(pen) {
  box(pen, 0, 0, 13, 9, K.CREAM);
  pen.col(K.BLACK).line(0, 0, 6, 5).line(12, 0, 6, 5);
  pen.col(K.RED).px(11, 7).px(10, 7);
}

function drawGift(pen) {
  box(pen, 1, 6, 18, 13, K.RED);
  pen.col(K.YEL).rect(8, 6, 4, 13);
  pen.col(K.YEL).hline(1, 11, 18);
  pen.col(K.YEL).ellipse(7, 4, 3, 3).ellipse(13, 4, 3, 3);
  pen.col(K.BLACK).ring(7, 4, 4).ring(13, 4, 4);
}

function drawCake(pen) {
  pen.col(K.BLACK).rect(1, 12, 30, 12);
  pen.col(K.CREAM).rect(2, 13, 28, 10);
  pen.col(K.PINK).hline(2, 13, 28).hline(2, 14, 28);
  pen.col(K.BLACK).rect(6, 4, 20, 9);
  pen.col(K.WHITE).rect(7, 5, 18, 7);
  pen.col(K.PINK).hline(7, 5, 18);
  // Velas
  pen.col(K.BLU).vline(11, 0, 5).vline(16, 0, 5).vline(21, 0, 5);
  pen.col(K.YEL_L).px(11, -1).px(16, -1).px(21, -1);
  pen.col(K.ORANGE).px(11, 0).px(16, 0).px(21, 0);
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

let built = false;

export function buildSprites() {
  if (built) return SPR;
  built = true;

  for (const pose of ['idle', 'walk0', 'walk1', 'wave', 'cheer', 'sleep', 'sit']) {
    SPR.ravi[pose] = bakeSprite(RAVI_W, RAVI_H, (pen) => {
      pen.ctx.translate(RAVI_PADX, RAVI_PADY);
      drawRavi(pen, pose);
    });
  }

  for (const hero of HEROES) {
    SPR.hero[hero.id] = bakeSprite(HERO_W, HERO_H, (pen) => {
      pen.ctx.translate(HERO_PADX, HERO_PADY);
      drawHero(pen, hero);
    });
  }

  for (const toy of TOYS) {
    SPR.toy[toy.id] = bakeSprite(16, 16, (pen) => TOY_PAINTERS[toy.id](pen));
  }

  for (const food of FOODS) {
    SPR.food[food.id] = bakeSprite(14, 16, (pen) => FOOD_PAINTERS[food.id](pen));
  }

  for (const v of VEHICLES) {
    SPR.vehicle[v.id] = bakeSprite(v.w, 26, (pen) => drawVehicle(pen, v, v.w));
  }

  SPR.misc.sheep = bakeSprite(24, 16, drawSheep);
  SPR.misc.mailman = bakeSprite(34, 31, drawMailman);
  SPR.misc.envelope = bakeSprite(14, 10, drawEnvelope);
  SPR.misc.gift = bakeSprite(21, 21, drawGift);
  SPR.misc.cake = bakeSprite(32, 27, (pen) => {
    pen.ctx.translate(0, 2); // espaço para a chama das velas
    drawCake(pen);
  });

  return SPR;
}
