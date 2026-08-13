/* ==========================================================================
   Ravi 1·2·3 — sprites do elenco, brinquedos, comidas e veículos
   --------------------------------------------------------------------------
   Heróis e Ravi vêm das folhas com chroma key. Brinquedos, comidas e veículos
   são pixel art procedural — cada um com silhueta própria, como no Mickey's
   123 original (nenhuma vitrine pode repetir o mesmo desenho).
   ========================================================================== */

import { K, bakeSprite, sliceSpriteSheet } from './assets.js';

/* --------------------------------------------------------------------------
   Dados (nomes alinhados ao Mickey's 123; a arte é original)
   -------------------------------------------------------------------------- */

/* `short` é o rótulo que cabe na caixa postal dos correios (5 chars no máximo);
   `name` é o usado na narração falada.
   Ordem alinhada à folha heroes_sprites (3×3, idle = 1ª pose de cada herói). */
export const HEROES = [
  { id: 'bolt', name: 'Sir Bolt', short: 'BOLT', title: 'Cavaleiro', color: K.BLU, dark: K.BLU_D },
  { id: 'shade', name: 'Shade', short: 'SHADE', title: 'Ninja', color: K.GRAY_D, dark: K.GRAY_XD },
  { id: 'luna', name: 'Luna', short: 'LUNA', title: 'Feiticeira', color: K.PUR, dark: K.PUR_L },
  { id: 'ember', name: 'Ember', short: 'EMBER', title: 'Dragão', color: K.GRN, dark: K.GRN_D },
  { id: 'aria', name: 'Aria', short: 'ARIA', title: 'Princesa', color: K.PINK, dark: K.PUR },
  { id: 'max', name: 'Maximus', short: 'MAX', title: 'Robô', color: K.GRAY, dark: K.GRAY_D },
  { id: 'freya', name: 'Freya', short: 'FREYA', title: 'Fada', color: K.GRN_L, dark: K.GRN },
  { id: 'kenzo', name: 'Kenzo', short: 'KENZO', title: 'Samurai', color: K.RED, dark: K.RED_D },
  { id: 'bjorn', name: 'Bjorn', short: 'BJORN', title: 'Arqueiro', color: K.GRN_D, dark: K.WOOD_D }
];

/* Ordem = Mickey's 123: urso, boneca, dino, foguete, trator, robô, trombeta, bola, boneco. */
export const TOYS = [
  { id: 'urso', name: 'Urso' },
  { id: 'boneca', name: 'Boneca' },
  { id: 'dino', name: 'Dinossauro' },
  { id: 'foguete', name: 'Foguete' },
  { id: 'trator', name: 'Trator' },
  { id: 'robo', name: 'Robô' },
  { id: 'trombeta', name: 'Trombeta' },
  { id: 'bola', name: 'Bola' },
  { id: 'boneco', name: 'Boneco' }
];

export const FOODS = [
  { id: 'burger', name: 'Hambúrguer', ask: 'hambúrgueres', how: 'Quantos' },
  { id: 'fries', name: 'Batata frita', ask: 'porções de batata', how: 'Quantas' },
  { id: 'apple', name: 'Maçã', ask: 'maçãs', how: 'Quantas' },
  { id: 'milk', name: 'Leite', ask: 'caixas de leite', how: 'Quantas' },
  { id: 'balloon', name: 'Balão', ask: 'balões', how: 'Quantos' }
];

/* Rodas = número da tecla (0–9), como no original: a criança conta o que vê. */
export const VEHICLES = [
  { id: 'walk', name: 'A pé', wheels: 0, w: 26 },
  { id: 'uni', name: 'Monociclo', wheels: 1, w: 26 },
  { id: 'moto', name: 'Moto', wheels: 2, w: 42 },
  { id: 'tri', name: 'Triciclo', wheels: 3, w: 44 },
  { id: 'car', name: 'Carrinho', wheels: 4, w: 52 },
  { id: 'spare', name: 'Estepe', wheels: 5, w: 58 },
  { id: 'van', name: 'Van', wheels: 6, w: 64 },
  { id: 'van7', name: 'Van+', wheels: 7, w: 70 },
  { id: 'skates', name: 'Patins', wheels: 8, w: 54 },
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

function blob(pen, cx, cy, rx, ry, fill) {
  pen.col(K.BLACK).ellipse(cx, cy, rx + 1, ry + 1);
  pen.col(fill).ellipse(cx, cy, rx, ry);
}

function box(pen, x, y, w, h, fill) {
  pen.col(K.BLACK).rect(x - 1, y - 1, w + 2, h + 2);
  pen.col(fill).rect(x, y, w, h);
}

/* --------------------------------------------------------------------------
   Brinquedos — ícones 16×16 (cada um com silhueta única)
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
  boneca(pen) {
    blob(pen, 8, 4, 3, 3, K.SKIN);
    pen.col(K.YEL).ellipse(8, 2, 5, 2);
    pen.col(K.PINK).rect(5, 7, 7, 6);
    pen.col(K.WHITE).hline(5, 10, 7);
    pen.col(K.BLACK).px(7, 4).px(9, 4);
    pen.col(K.PINK).px(8, 5);
    pen.col(K.SKIN).px(3, 9).px(12, 9);
    pen.col(K.PINK).rect(5, 13, 3, 2).rect(9, 13, 3, 2);
  },
  dino(pen) {
    blob(pen, 7, 10, 6, 4, K.GRN);
    blob(pen, 12, 5, 3, 3, K.GRN);
    pen.col(K.GRN_D).px(4, 6).px(6, 5).px(8, 5).px(10, 5);
    pen.col(K.BLACK).px(13, 4);
    pen.col(K.GRN_D).rect(1, 11, 3, 2);
    pen.col(K.GRN_D).rect(5, 13, 2, 2).rect(9, 13, 2, 2);
  },
  foguete(pen) {
    pen.col(K.BLACK).ellipse(8, 7, 4, 7);
    pen.col(K.WHITE).ellipse(8, 7, 3, 6);
    pen.col(K.RED).ellipse(8, 2, 2, 2);
    pen.col(K.CYAN).ellipse(8, 6, 2, 2);
    pen.col(K.RED).rect(3, 10, 3, 4).rect(11, 10, 3, 4);
    pen.col(K.ORANGE).px(7, 14).px(8, 15).px(9, 14);
    pen.col(K.YEL).px(8, 13);
  },
  trator(pen) {
    // Trator: cabine alta + chassi curto + roda grande atrás
    box(pen, 1, 9, 8, 4, K.GRN);
    box(pen, 7, 3, 6, 10, K.GRN_D);
    pen.col(K.CYAN).rect(8, 5, 4, 3);
    pen.col(K.BLACK).ellipse(4, 14, 2, 2);
    pen.col(K.BLACK).ellipse(12, 13, 3, 3);
    pen.col(K.GRAY).ellipse(4, 14, 1, 1).ellipse(12, 13, 1, 1);
    pen.col(K.YEL).rect(0, 7, 2, 2);
    pen.col(K.GRAY_XD).rect(3, 6, 2, 3);
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
    box(pen, 5, 7, 7, 5, K.BLU);
    pen.col(K.RED).rect(5, 12, 7, 2);
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
   Veículos — silhuetas distintas; rodas alinhadas para contar
   -------------------------------------------------------------------------- */

function wheel(pen, cx, cy, r) {
  pen.col(K.BLACK).ellipse(cx, cy, r, r);
  pen.col(K.GRAY_L).ellipse(cx, cy, Math.max(1, r - 2), Math.max(1, r - 2));
  pen.col(K.GRAY_D).ellipse(cx, cy, 1, 1);
}

function drawVehicle(pen, v, w) {
  const groundY = 23;
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
      // Motocicleta de perfil: guidão, banco e duas rodas bem separadas
      pen.col(K.RED).rect(14, 11, 16, 5);
      pen.col(K.BLACK).frame(13, 10, 18, 7);
      pen.col(K.GRAY_XD).line(14, 11, 8, 6).line(8, 6, 5, 6);
      pen.col(K.GRAY_L).hline(3, 5, 6);
      pen.col(K.GRAY).rect(22, 8, 6, 3);
      pen.col(K.YEL).rect(28, 12, 2, 2);
      break;
    case 'tri':
      pen.col(K.BLU).rect(8, 11, 26, 6);
      pen.col(K.BLACK).frame(7, 10, 28, 8);
      pen.col(K.GRAY_XD).line(10, 11, 7, 6);
      pen.col(K.RED).rect(22, 7, 8, 4);
      break;
    case 'car': {
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
    case 'spare': {
      // Carrinho + estepe no teto (5 rodas)
      const y = groundY - r - 12;
      pen.col(K.BLACK).rect(3, y + 4, w - 6, 10);
      pen.col(K.BLU).rect(4, y + 5, w - 8, 8);
      pen.col(K.BLU_D).hline(4, y + 12, w - 8);
      pen.col(K.BLACK).rect(14, y - 4, w - 30, 9);
      pen.col(K.BLU_L).rect(15, y - 3, w - 32, 7);
      pen.col(K.CYAN).rect(17, y - 1, (w - 36) / 2, 4).rect(19 + (w - 36) / 2, y - 1, (w - 36) / 2, 4);
      // Estepe no teto
      wheel(pen, w >> 1, y - 2, 4);
      pen.col(K.YEL_L).rect(w - 6, y + 7, 2, 3);
      break;
    }
    case 'van': {
      const bodyH = 14;
      const bodyY = groundY - r - bodyH - 1;
      pen.col(K.BLACK).rect(2, bodyY - 1, w - 4, bodyH + 2);
      pen.col(K.GRN).rect(3, bodyY, w - 6, bodyH);
      pen.col(K.GRN_D).hline(3, bodyY + bodyH - 1, w - 6);
      pen.col(K.CYAN);
      for (let x = 7; x < w - 10; x += 12) pen.rect(x, bodyY + 3, 8, 6);
      pen.col(K.BLACK);
      for (let x = 7; x < w - 10; x += 12) pen.frame(x - 1, bodyY + 2, 10, 8);
      pen.col(K.YEL_L).rect(w - 5, bodyY + bodyH - 5, 2, 3);
      break;
    }
    case 'van7': {
      // Van + estepe lateral (7 rodas)
      const bodyH = 14;
      const bodyY = groundY - r - bodyH - 1;
      pen.col(K.BLACK).rect(2, bodyY - 1, w - 4, bodyH + 2);
      pen.col(K.PUR).rect(3, bodyY, w - 6, bodyH);
      pen.col(K.PUR_L).hline(3, bodyY + bodyH - 1, w - 6);
      pen.col(K.CYAN);
      for (let x = 7; x < w - 14; x += 12) pen.rect(x, bodyY + 3, 8, 6);
      pen.col(K.BLACK);
      for (let x = 7; x < w - 14; x += 12) pen.frame(x - 1, bodyY + 2, 10, 8);
      wheel(pen, w - 10, bodyY + 6, 4);
      pen.col(K.YEL_L).rect(w - 5, bodyY + bodyH - 5, 2, 3);
      break;
    }
    case 'skates': {
      // Dois patins com 4 rodinhas cada = 8
      pen.col(K.RED).rect(4, 10, 18, 5);
      pen.col(K.BLU).rect(32, 10, 18, 5);
      pen.col(K.BLACK).frame(3, 9, 20, 7).frame(31, 9, 20, 7);
      pen.col(K.CREAM).rect(8, 6, 10, 4).rect(36, 6, 10, 4);
      pen.col(K.GRAY_XD).vline(13, 4, 3).vline(41, 4, 3);
      break;
    }
    case 'truck': {
      const bodyH = 14;
      const bodyY = groundY - r - bodyH - 1;
      pen.col(K.BLACK).rect(2, bodyY + 3, w - 30, bodyH - 2);
      pen.col(K.GRAY_L).rect(3, bodyY + 4, w - 32, bodyH - 4);
      pen.col(K.GRAY_D).hline(3, bodyY + bodyH - 1, w - 32);
      pen.col(K.BLACK).rect(w - 28, bodyY - 1, 26, bodyH + 2);
      pen.col(K.ORANGE).rect(w - 27, bodyY, 24, bodyH);
      pen.col(K.OCHRE).hline(w - 27, bodyY + bodyH - 1, 24);
      pen.col(K.CYAN).rect(w - 24, bodyY + 3, 12, 6);
      pen.col(K.BLACK).frame(w - 25, bodyY + 2, 14, 8);
      pen.col(K.YEL_L).rect(w - 5, bodyY + bodyH - 5, 2, 3);
      break;
    }
    default:
      break;
  }

  const n = v.wheels;
  if (n === 1) {
    wheel(pen, w >> 1, groundY - 7, 7);
  } else if (n > 1) {
    // Patins: 4+4 em dois grupos; demais: fila única contável
    if (v.id === 'skates') {
      for (let i = 0; i < 4; i++) wheel(pen, 6 + i * 5, wheelY, 3);
      for (let i = 0; i < 4; i++) wheel(pen, 34 + i * 5, wheelY, 3);
    } else {
      const margin = r + 2;
      const span = w - margin * 2;
      for (let i = 0; i < n; i++) {
        const x = margin + Math.round((i * span) / (n - 1));
        wheel(pen, x, wheelY, r);
      }
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
  pen.col(K.BLACK).ring(8, 24, 6).ring(26, 24, 6);
  pen.col(K.GRAY).ring(8, 24, 3).ring(26, 24, 3);
  pen.col(K.GRAY_XD).line(8, 24, 17, 14).line(26, 24, 17, 14).line(17, 14, 17, 9);
  pen.col(K.BLU_D).hline(13, 9, 9);
  box(pen, 12, 12, 10, 9, K.BLU);
  blob(pen, 17, 7, 5, 5, K.SKIN);
  pen.col(K.BLACK).px(15, 6).px(19, 6);
  pen.col(K.BLU_D).rect(11, 1, 13, 3);
  pen.col(K.BLACK).frame(10, 0, 15, 5);
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
  pen.col(K.BLU).vline(11, 0, 5).vline(16, 0, 5).vline(21, 0, 5);
  pen.col(K.YEL_L).px(11, -1).px(16, -1).px(21, -1);
  pen.col(K.ORANGE).px(11, 0).px(16, 0).px(21, 0);
}

/** Carrinho de supermercado — cesto aberto para as compras ficarem visíveis. */
function drawCart(pen) {
  // Alça (lado esquerdo, onde o Ravi empurra)
  pen.col(K.BLACK).line(1, 18, 8, 4).line(8, 4, 16, 4);
  pen.col(K.GRAY_L).line(2, 18, 8, 5).line(8, 5, 15, 5);
  // Cesto: fundo escuro para os itens contrastarem
  pen.col(K.BLACK).rect(10, 10, 50, 26);
  pen.col(K.GRAY_XD).rect(11, 11, 48, 24);
  // Interior (chão do cesto)
  pen.col(K.CREAM).rect(13, 14, 44, 18);
  // Grades laterais (não cobrem o miolo)
  pen.col(K.GRAY);
  for (let x = 13; x <= 55; x += 7) {
    pen.vline(x, 11, 3);
    pen.vline(x, 29, 5);
  }
  pen.col(K.GRAY_L).hline(11, 11, 48).hline(11, 33, 48);
  // Borda superior
  pen.col(K.BLACK).rect(9, 8, 52, 3);
  pen.col(K.GRAY).rect(10, 9, 50, 1);
  // Base
  pen.col(K.BLACK).rect(16, 35, 38, 3);
  pen.col(K.GRAY_D).rect(17, 36, 36, 1);
  // Rodas
  pen.col(K.BLACK).ellipse(20, 43, 6, 6).ellipse(50, 43, 6, 6);
  pen.col(K.GRAY_XD).ellipse(20, 43, 4, 4).ellipse(50, 43, 4, 4);
  pen.col(K.GRAY_L).ellipse(20, 43, 1, 1).ellipse(50, 43, 1, 1);
}

/* --------------------------------------------------------------------------
   Boot
   -------------------------------------------------------------------------- */

let built = false;

export async function buildSprites() {
  if (built) return SPR;
  built = true;

  const raviSlices = sliceSpriteSheet('ravi_sprites', 56);
  const poses = ['idle', 'walk0', 'walk1', 'wave', 'cheer', 'sleep', 'sit'];
  for (let i = 0; i < poses.length; i++) {
    SPR.ravi[poses[i]] = raviSlices[i] || raviSlices[0];
  }

  // Folha com dezenas de poses: fica só com silhuetas de personagem (sem faixas largas / texto)
  // e pega a 1ª pose de cada bloco para os 9 heróis.
  const heroSlices = sliceSpriteSheet('heroes_sprites', 56)
    .filter((s) => s.w >= 28 && s.w <= 58 && s.w / s.h <= 1.1);
  const step = Math.max(1, Math.floor(heroSlices.length / HEROES.length) || 1);
  for (let i = 0; i < HEROES.length; i++) {
    SPR.hero[HEROES[i].id] = heroSlices[Math.min(i * step, heroSlices.length - 1)] || heroSlices[0];
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
    pen.ctx.translate(0, 2);
    drawCake(pen);
  });
  SPR.misc.cart = bakeSprite(64, 50, drawCart);

  return SPR;
}
