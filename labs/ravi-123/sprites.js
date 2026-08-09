/* ==========================================================================
   Ravi 1·2·3 — sprites do elenco, brinquedos, comidas e veículos
   --------------------------------------------------------------------------
   Tudo é assado uma única vez no boot, em canvas fora de tela. Em tempo de
   execução o render só faz drawImage — nenhum path, nenhuma alocação.
   ========================================================================== */

import { K, bakeSprite, sliceSpriteSheet } from './assets.js';

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

let built = false;
export async function buildSprites() {
  if (built) return SPR;
  built = true;

  // O fatiador retorna todos os sprites encontrados na folha em ordem.
  // Como são gerados via IA, os índices dependem da quantidade gerada.
  const raviSlices = sliceSpriteSheet('ravi_sprites', 56);
  const poses = ['idle', 'walk0', 'walk1', 'wave', 'cheer', 'sleep', 'sit'];
  for (let i = 0; i < poses.length; i++) {
    // Usamos o sprite correspondente ou o primeiro se faltar (fallback para IA imperfeita)
    SPR.ravi[poses[i]] = raviSlices[i] || raviSlices[0];
  }

  const heroSlices = sliceSpriteSheet('heroes_sprites', 56);
  for (let i = 0; i < HEROES.length; i++) {
    SPR.hero[HEROES[i].id] = heroSlices[i] || heroSlices[0];
  }

  const itemSlices = sliceSpriteSheet('items_sprites', 24);
  const vehicleSlices = sliceSpriteSheet('items_sprites', 36);
  
  const toyIcon = itemSlices[0] || itemSlices[0];
  const dinoIcon = itemSlices[1] || itemSlices[0];
  const carIcon = vehicleSlices[2] || vehicleSlices[0]; // Veículo maior!
  const foodIcon = itemSlices[3] || itemSlices[0];
  const appleIcon = itemSlices[4] || itemSlices[0];
  const balloonIcon = itemSlices[5] || itemSlices[0];

  for (const toy of TOYS) {
    SPR.toy[toy.id] = toy.id === 'dino' ? dinoIcon : toyIcon;
  }
  for (const food of FOODS) {
    if (food.id === 'balloon') SPR.food[food.id] = balloonIcon;
    else if (food.id === 'apple') SPR.food[food.id] = appleIcon;
    else SPR.food[food.id] = foodIcon;
  }
  for (const v of VEHICLES) {
    SPR.vehicle[v.id] = carIcon;
  }

  SPR.misc.sheep = heroSlices[0] || toyIcon;
  SPR.misc.mailman = heroSlices[1] || toyIcon;
  SPR.misc.envelope = bakeSprite(14, 10, (pen) => {
    pen.col(K.CREAM).rect(0, 0, 14, 10);
    pen.col(K.BLACK).frame(0, 0, 14, 10);
  });
  SPR.misc.gift = bakeSprite(21, 21, (pen) => {
    pen.col(K.RED).rect(0, 0, 21, 21);
    pen.col(K.YEL).rect(8, 0, 5, 21);
    pen.col(K.YEL).rect(0, 8, 21, 5);
  });
  SPR.misc.cake = bakeSprite(32, 27, (pen) => {
    pen.col(K.PINK).rect(0, 10, 32, 17);
  });

  return SPR;
}
