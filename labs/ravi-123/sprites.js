/* ==========================================================================
   Ravi 1·2·3 — sprites do elenco, brinquedos, comidas e veículos
   --------------------------------------------------------------------------
   Personagens vêm de chars.js (pixel art na paleta). Brinquedos, comidas e
   veículos são ícones gordos, cada um com silhueta própria — a criança de
   3–4 anos escolhe pela figura, não pelo nome.
   ========================================================================== */

import { K, bakeSprite } from './assets.js';
import { paintRavi, paintHero, HERO_SPECS } from './chars.js';

export const HEROES = HERO_SPECS;

/* Ordem = Mickey's 123: urso, boneca, dino, foguete, trator, robô, trombeta, bola, boneco. */
export const TOYS = [
  { id: 'urso', name: 'Urso' },
  { id: 'boneca', name: 'Boneca' },
  { id: 'dino', name: 'Dino' },
  { id: 'foguete', name: 'Foguete' },
  { id: 'trator', name: 'Trator' },
  { id: 'robo', name: 'Robô' },
  { id: 'trombeta', name: 'Trombeta' },
  { id: 'bola', name: 'Bola' },
  { id: 'boneco', name: 'Boneco' }
];

export const FOODS = [
  { id: 'burger', name: 'Hambúrguer', ask: 'hambúrgueres', how: 'Quantos' },
  { id: 'fries', name: 'Batata', ask: 'batatas', how: 'Quantas' },
  { id: 'apple', name: 'Maçã', ask: 'maçãs', how: 'Quantas' },
  { id: 'milk', name: 'Leite', ask: 'leites', how: 'Quantos' },
  { id: 'balloon', name: 'Balão', ask: 'balões', how: 'Quantos' }
];

export const VEHICLES = [
  { id: 'walk', name: 'A pé', wheels: 0, w: 28 },
  { id: 'uni', name: 'Monociclo', wheels: 1, w: 28 },
  { id: 'moto', name: 'Moto', wheels: 2, w: 44 },
  { id: 'tri', name: 'Triciclo', wheels: 3, w: 48 },
  { id: 'car', name: 'Carro', wheels: 4, w: 56 },
  { id: 'spare', name: 'Jipe', wheels: 5, w: 58 },
  { id: 'van', name: 'Van', wheels: 6, w: 64 },
  { id: 'van7', name: 'Kombi', wheels: 7, w: 70 },
  { id: 'skates', name: 'Patins', wheels: 8, w: 56 },
  { id: 'truck', name: 'Caminhão', wheels: 9, w: 86 }
];

export const SPR = {
  ravi: {},
  hero: {},
  toy: {},
  food: {},
  vehicle: {},
  misc: {}
};

function blob(pen, cx, cy, rx, ry, fill) {
  pen.col(K.BLACK).ellipse(cx, cy, rx + 1, ry + 1);
  pen.col(fill).ellipse(cx, cy, rx, ry);
}

function box(pen, x, y, w, h, fill) {
  pen.col(K.BLACK).rect(x - 1, y - 1, w + 2, h + 2);
  pen.col(fill).rect(x, y, w, h);
}

/* --------------------------------------------------------------------------
   Brinquedos 20×20 — gordos e legíveis na coluna da fábrica
   -------------------------------------------------------------------------- */

const TOY_PAINTERS = {
  urso(pen) {
    blob(pen, 5, 5, 3, 3, K.WOOD_D);
    blob(pen, 15, 5, 3, 3, K.WOOD_D);
    blob(pen, 10, 8, 7, 6, K.OCHRE);
    blob(pen, 10, 14, 6, 5, K.OCHRE);
    pen.col(K.SAND).ellipse(10, 10, 3, 2);
    pen.col(K.BLACK).px(7, 7).px(13, 7);
    pen.col(K.RED).px(9, 10).px(10, 11).px(11, 10);
    pen.col(K.SAND).ellipse(10, 15, 3, 2);
  },
  boneca(pen) {
    blob(pen, 10, 5, 4, 4, K.SKIN);
    pen.col(K.YEL).ellipse(10, 3, 6, 3);
    pen.col(K.YEL_L).px(6, 4).px(14, 4);
    pen.col(K.BLACK).px(8, 5).px(12, 5);
    pen.col(K.PINK).px(10, 7);
    box(pen, 6, 9, 8, 7, K.PINK);
    pen.col(K.WHITE).hline(6, 12, 8);
    pen.col(K.SKIN).px(4, 11).px(15, 11);
    pen.col(K.PINK).rect(6, 16, 3, 3).rect(11, 16, 3, 3);
  },
  dino(pen) {
    blob(pen, 8, 12, 7, 5, K.GRN);
    blob(pen, 15, 6, 4, 4, K.GRN);
    pen.col(K.GRN_D).px(4, 8).px(6, 6).px(8, 6).px(10, 7);
    pen.col(K.WHITE).px(16, 5);
    pen.col(K.BLACK).px(17, 5);
    pen.col(K.RED).px(18, 7);
    pen.col(K.YEL_L).ellipse(8, 13, 3, 2);
    pen.col(K.GRN_D).rect(5, 16, 3, 3).rect(11, 16, 3, 3);
  },
  foguete(pen) {
    pen.col(K.BLACK).ellipse(10, 9, 5, 8);
    pen.col(K.WHITE).ellipse(10, 9, 4, 7);
    pen.col(K.RED).ellipse(10, 2, 3, 3);
    pen.col(K.CYAN).ellipse(10, 8, 2, 2);
    pen.col(K.RED).rect(4, 12, 4, 5).rect(13, 12, 4, 5);
    pen.col(K.ORANGE).px(8, 18).px(10, 19).px(12, 18);
    pen.col(K.YEL).px(10, 17);
  },
  trator(pen) {
    box(pen, 1, 11, 10, 5, K.GRN);
    box(pen, 9, 4, 8, 12, K.GRN_D);
    pen.col(K.CYAN).rect(11, 6, 5, 4);
    pen.col(K.YEL).rect(0, 9, 3, 3);
    blob(pen, 5, 17, 3, 3, K.GRAY_XD);
    blob(pen, 15, 16, 4, 4, K.GRAY_XD);
    pen.col(K.GRAY_L).px(5, 17).px(15, 16);
  },
  robo(pen) {
    box(pen, 6, 1, 8, 5, K.GRAY);
    pen.col(K.RED).px(8, 3).px(12, 3);
    box(pen, 5, 7, 10, 8, K.GRAY_L);
    pen.col(K.CYAN).rect(8, 9, 4, 4);
    pen.col(K.GRAY).rect(1, 8, 4, 3).rect(15, 8, 4, 3);
    pen.col(K.YEL).px(4, 0).px(15, 0);
    pen.col(K.GRAY_D).rect(6, 16, 3, 3).rect(11, 16, 3, 3);
  },
  trombeta(pen) {
    // Corneta: boquilha + tubo + campânula — cabe no ícone 20×20
    pen.col(K.YEL).rect(1, 8, 9, 4);
    pen.col(K.BLACK).frame(0, 7, 11, 6);
    pen.col(K.OCHRE).rect(1, 8, 3, 4);
    pen.col(K.YEL).ellipse(15, 10, 5, 7);
    pen.col(K.BLACK).ring(15, 10, 6);
    pen.col(K.YEL_L).ellipse(14, 8, 2, 2);
  },
  bola(pen) {
    blob(pen, 10, 10, 8, 8, K.WHITE);
    pen.col(K.RED).ellipse(10, 6, 6, 3);
    pen.col(K.BLU).ellipse(10, 14, 6, 3);
    pen.col(K.BLACK).hline(4, 10, 12).vline(10, 4, 12);
    pen.col(K.WHITE).ellipse(7, 7, 2, 2);
  },
  boneco(pen) {
    blob(pen, 10, 5, 4, 4, K.SKIN);
    pen.col(K.WOOD_D).hline(7, 1, 6);
    pen.col(K.BLACK).px(8, 5).px(12, 5);
    pen.col(K.RED).px(10, 7);
    box(pen, 6, 9, 8, 6, K.BLU);
    pen.col(K.YEL).hline(6, 12, 8);
    pen.col(K.SKIN).px(4, 10).px(15, 10);
    pen.col(K.RED).rect(6, 15, 3, 4).rect(11, 15, 3, 4);
  }
};

const FOOD_PAINTERS = {
  burger(pen) {
    pen.col(K.OCHRE).ellipse(8, 6, 7, 4);
    pen.col(K.SAND).ellipse(8, 5, 6, 3);
    pen.col(K.GRN).rect(2, 9, 12, 2);
    pen.col(K.RED).rect(3, 11, 10, 2);
    pen.col(K.WOOD_D).rect(2, 13, 12, 2);
    pen.col(K.OCHRE).ellipse(8, 16, 7, 3);
    pen.col(K.SAND).px(5, 4).px(10, 3);
  },
  fries(pen) {
    pen.col(K.YEL).rect(3, 1, 3, 8).rect(7, 0, 3, 9).rect(11, 2, 3, 7);
    pen.col(K.YEL_L).vline(3, 1, 8).vline(7, 0, 9);
    box(pen, 2, 8, 12, 9, K.RED);
    pen.col(K.WHITE).rect(5, 11, 6, 4);
  },
  apple(pen) {
    blob(pen, 8, 10, 6, 6, K.RED);
    pen.col(K.RED_L).ellipse(6, 8, 2, 3);
    pen.col(K.WOOD_D).vline(8, 2, 4);
    pen.col(K.GRN).ellipse(11, 3, 3, 2);
    pen.col(K.WHITE).px(5, 8);
  },
  milk(pen) {
    box(pen, 4, 4, 8, 13, K.WHITE);
    pen.col(K.BLU).rect(4, 4, 8, 4);
    pen.col(K.BLACK).line(4, 4, 8, 1).line(12, 4, 8, 1);
    pen.col(K.WHITE).px(8, 2);
    pen.col(K.CYAN).rect(6, 10, 4, 4);
  },
  balloon(pen) {
    blob(pen, 8, 7, 6, 7, K.PINK);
    pen.col(K.WHITE).ellipse(6, 5, 2, 3);
    pen.col(K.PINK).px(8, 14).px(7, 15).px(9, 15);
    pen.col(K.CREAM).vline(8, 15, 3);
  }
};

function wheel(pen, cx, cy, r) {
  pen.col(K.BLACK).ellipse(cx, cy, r, r);
  pen.col(K.GRAY_L).ellipse(cx, cy, Math.max(1, r - 2), Math.max(1, r - 2));
  pen.col(K.WHITE).ellipse(cx, cy, 1, 1);
  pen.col(K.GRAY_D).px(cx, cy);
}

function drawVehicle(pen, v, w) {
  const groundY = 24;
  const r = v.wheels >= 8 ? 3 : v.wheels >= 5 ? 4 : 5;
  const wheelY = groundY - r;

  switch (v.id) {
    case 'uni':
      pen.col(K.GRAY_XD).vline(w >> 1, 6, 10);
      pen.col(K.RED).hline((w >> 1) - 5, 6, 11);
      pen.col(K.YEL).rect((w >> 1) - 3, 4, 7, 3);
      break;
    case 'moto':
      // Moto de perfil: duas rodas grandes bem separadas
      pen.col(K.RED).rect(12, 9, 20, 6);
      pen.col(K.BLACK).frame(11, 8, 22, 8);
      pen.col(K.GRAY_XD).line(12, 9, 6, 5);
      pen.col(K.GRAY_L).hline(3, 4, 8);
      pen.col(K.GRAY).rect(22, 6, 8, 4);
      pen.col(K.YEL).rect(30, 11, 3, 3);
      break;
    case 'tri':
      // Triciclo: 1 roda na frente, 2 atrás — silhueta de três pontos
      pen.col(K.BLU).rect(10, 9, 26, 7);
      pen.col(K.BLACK).frame(9, 8, 28, 9);
      pen.col(K.RED).rect(22, 4, 10, 6);
      pen.col(K.CYAN).rect(24, 5, 6, 4);
      pen.col(K.GRAY_XD).vline(14, 5, 5);
      break;
    case 'car': {
      const y = groundY - r - 12;
      box(pen, 4, y + 5, w - 8, 8, K.RED);
      box(pen, 16, y - 3, w - 32, 8, K.RED_L);
      pen.col(K.CYAN).rect(18, y - 1, (w - 38) / 2, 4).rect(20 + (w - 38) / 2, y - 1, (w - 38) / 2, 4);
      pen.col(K.YEL_L).rect(w - 7, y + 7, 3, 3);
      break;
    }
    case 'spare': {
      const y = groundY - r - 12;
      box(pen, 4, y + 5, w - 8, 8, K.BLU);
      box(pen, 16, y - 3, w - 32, 8, K.BLU_L);
      pen.col(K.CYAN).rect(18, y - 1, (w - 38) / 2, 4);
      wheel(pen, w >> 1, y - 1, 4);
      break;
    }
    case 'van': {
      const bodyY = groundY - r - 15;
      box(pen, 3, bodyY, w - 6, 14, K.GRN);
      pen.col(K.CYAN);
      for (let x = 8; x < w - 12; x += 12) pen.rect(x, bodyY + 3, 8, 6);
      pen.col(K.YEL_L).rect(w - 6, bodyY + 9, 3, 3);
      break;
    }
    case 'van7': {
      const bodyY = groundY - r - 15;
      box(pen, 3, bodyY, w - 6, 14, K.PUR);
      pen.col(K.CYAN);
      for (let x = 8; x < w - 16; x += 12) pen.rect(x, bodyY + 3, 8, 6);
      wheel(pen, w - 12, bodyY + 6, 4);
      break;
    }
    case 'skates':
      box(pen, 4, 10, 20, 6, K.RED);
      box(pen, 32, 10, 20, 6, K.BLU);
      pen.col(K.CREAM).rect(8, 6, 12, 4).rect(36, 6, 12, 4);
      break;
    case 'truck': {
      const bodyY = groundY - r - 15;
      box(pen, 3, bodyY + 4, w - 32, 10, K.GRAY_L);
      box(pen, w - 28, bodyY, 24, 14, K.ORANGE);
      pen.col(K.CYAN).rect(w - 24, bodyY + 3, 12, 6);
      pen.col(K.YEL_L).rect(w - 6, bodyY + 9, 3, 3);
      break;
    }
    default:
      break;
  }

  const n = v.wheels;
  if (n === 1) {
    wheel(pen, w >> 1, groundY - 8, 8);
  } else if (n > 1) {
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

function drawSheep(pen) {
  blob(pen, 12, 9, 9, 6, K.WHITE);
  pen.col(K.GRAY_L).ellipse(6, 7, 3, 3).ellipse(12, 5, 3, 3).ellipse(18, 7, 3, 3);
  blob(pen, 22, 7, 4, 4, K.GRAY_XD);
  pen.col(K.WHITE).px(22, 6);
  pen.col(K.BLACK).px(24, 7);
  pen.col(K.PINK).px(25, 8);
  pen.col(K.GRAY_XD).vline(6, 14, 4).vline(11, 14, 4).vline(16, 14, 4).vline(20, 14, 4);
}

function drawMailman(pen) {
  blob(pen, 17, 8, 6, 6, K.SKIN);
  pen.col(K.BLU_D).rect(11, 1, 13, 4);
  pen.col(K.YEL).rect(14, 1, 7, 2);
  eye(pen, 14, 8);
  eye(pen, 20, 8);
  box(pen, 12, 14, 10, 10, K.BLU);
  pen.col(K.BLU_L).hline(13, 15, 8);
  box(pen, 22, 16, 10, 7, K.CREAM);
  pen.col(K.RED).rect(24, 18, 6, 3);
  pen.col(K.BLACK).ring(8, 28, 5).ring(26, 28, 5);
  pen.col(K.GRAY).ring(8, 28, 2).ring(26, 28, 2);
}

function eye(pen, x, y) {
  pen.col(K.WHITE).px(x, y);
  pen.col(K.BLACK).px(x + 1, y);
}

function drawEnvelope(pen) {
  box(pen, 0, 0, 14, 10, K.CREAM);
  pen.col(K.BLACK).line(0, 0, 7, 6).line(14, 0, 7, 6);
  pen.col(K.RED).rect(10, 6, 3, 3);
}

function drawGift(pen) {
  box(pen, 2, 8, 20, 14, K.RED);
  pen.col(K.YEL).rect(10, 8, 4, 14);
  pen.col(K.YEL).hline(2, 14, 20);
  blob(pen, 9, 5, 4, 4, K.YEL);
  blob(pen, 15, 5, 4, 4, K.YEL);
}

function drawCake(pen) {
  box(pen, 2, 14, 30, 12, K.CREAM);
  pen.col(K.PINK).hline(2, 14, 30).hline(2, 15, 30);
  box(pen, 7, 6, 20, 9, K.WHITE);
  pen.col(K.PINK).hline(7, 6, 20);
  const xs = [12, 17, 22];
  for (const x of xs) {
    pen.col(K.CYAN).vline(x, 1, 6);
    pen.col(K.YEL_L).px(x, 0);
    pen.col(K.ORANGE).px(x, 1);
  }
}

function drawCart(pen) {
  pen.col(K.BLACK).line(2, 20, 10, 4).line(10, 4, 18, 4);
  pen.col(K.GRAY_L).line(3, 20, 10, 5);
  box(pen, 12, 10, 48, 24, K.GRAY_XD);
  pen.col(K.CREAM).rect(15, 14, 42, 16);
  pen.col(K.GRAY);
  for (let x = 16; x <= 54; x += 8) pen.vline(x, 10, 4);
  pen.col(K.GRAY_L).hline(12, 10, 48);
  blob(pen, 20, 40, 6, 6, K.GRAY_XD);
  blob(pen, 50, 40, 6, 6, K.GRAY_XD);
  pen.col(K.GRAY_L).px(20, 40).px(50, 40);
}

function drawArrow(pen) {
  pen.col(K.YEL).rect(6, 2, 8, 10);
  pen.col(K.BLACK).frame(6, 2, 8, 10);
  for (let i = 0; i < 8; i++) {
    pen.col(K.BLACK).hline(10 - i, 12 + i, 2 + i * 2);
    pen.col(K.YEL).hline(11 - i, 12 + i, i * 2);
  }
}

let built = false;

export async function buildSprites() {
  if (built) return SPR;
  built = true;

  const poses = ['idle', 'blink', 'walk0', 'walk1', 'wave', 'cheer', 'sleep', 'sit'];
  for (const pose of poses) {
    const w = pose === 'sleep' ? 42 : 24;
    const h = pose === 'sleep' ? 22 : 42;
    SPR.ravi[pose] = bakeSprite(w, h, (pen) => paintRavi(pen, pose));
  }

  for (const hero of HEROES) {
    SPR.hero[hero.id] = bakeSprite(24, 42, (pen) => paintHero(pen, hero, 'idle'));
    SPR.hero[hero.id + '_cheer'] = bakeSprite(24, 42, (pen) => paintHero(pen, hero, 'cheer'));
  }

  for (const toy of TOYS) {
    SPR.toy[toy.id] = bakeSprite(20, 20, (pen) => TOY_PAINTERS[toy.id](pen));
  }
  for (const food of FOODS) {
    SPR.food[food.id] = bakeSprite(16, 18, (pen) => FOOD_PAINTERS[food.id](pen));
  }
  for (const v of VEHICLES) {
    SPR.vehicle[v.id] = bakeSprite(v.w, 26, (pen) => drawVehicle(pen, v, v.w));
  }

  SPR.misc.sheep = bakeSprite(28, 18, drawSheep);
  SPR.misc.mailman = bakeSprite(36, 34, drawMailman);
  SPR.misc.envelope = bakeSprite(16, 11, drawEnvelope);
  SPR.misc.gift = bakeSprite(24, 24, drawGift);
  SPR.misc.cake = bakeSprite(34, 28, (pen) => {
    pen.ctx.translate(0, 2);
    drawCake(pen);
  });
  SPR.misc.cart = bakeSprite(64, 48, drawCart);
  SPR.misc.arrow = bakeSprite(20, 22, drawArrow);

  return SPR;
}

/** Pose viva do Ravi: pisca e, andando, troca as pernas. */
export function raviPose(name, clock) {
  if (name === 'idle' && (clock % 3.2) > 3.0) return SPR.ravi.blink;
  if (name === 'walk') return (Math.floor(clock * 6) % 2) ? SPR.ravi.walk1 : SPR.ravi.walk0;
  return SPR.ravi[name] || SPR.ravi.idle;
}

export function heroSprite(id, dancing) {
  return dancing && SPR.hero[id + '_cheer'] ? SPR.hero[id + '_cheer'] : SPR.hero[id];
}
