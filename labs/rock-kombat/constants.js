// ==========================================================================
// Rock Kombat — Game Constants
// Arcade timing, roster, stages and Street Fighter / MK frame data
// ==========================================================================

export const W = 1280;
export const H = 720;
export const GROUND = 620;
export const LEFT_WALL = 160;
export const RIGHT_WALL = 1120;

export const STEP = 1000 / 60;
export const INPUT_BUFFER = 10;
export const DASH_WINDOW = 20;
export const PARRY_WINDOW = 3;
export const PARRY_COOLDOWN = 30;
export const SPECIAL_COST = 40;
export const THROW_RANGE = 96;
export const GRAVITY = 0.78;
export const BACK_WALK = 0.68;
export const LAND_LAG = 5;
export const COMBO_DECAY = 0.12;
export const MIN_SCALE = 0.42;

export const METER_GAIN = Object.freeze({
  commit: 0.18,
  hit: 0.85,
  block: 0.5,
  damage: 0.7,
  guard: 0.32
});

export const SPRITE_SIZE = 405;
export const BODY_WIDTH = 42;
export const PUSH_DISTANCE = 96;

export const FIGHTERS = [
  {
    id: 'kurt', name: 'Kurt Cobain', short: 'KURT', era: 'GRUNGE / SHOTO',
    style: 'Espaço, confirms e feedback à distância', special: 'Feedback Wave',
    sheet: 'assets/fighter-kurt-sheet-v2.webp',
    color: '#c6b06a', speed: 6.05, jump: 13.2, power: 84, mobility: 72, defense: 76,
    quote: 'Sem bis. Só feedback.'
  },
  {
    id: 'axl', name: 'Axl Rose', short: 'AXL', era: 'HARD ROCK / RUSHDOWN',
    style: 'Dash, pressão e mix-up no canto', special: 'Paradise Rush',
    sheet: 'assets/fighter-axl-sheet-v2.webp',
    color: '#c84d3c', speed: 6.85, jump: 13.55, power: 78, mobility: 92, defense: 64,
    quote: 'O palco nunca espera.'
  },
  {
    id: 'lennon', name: 'John Lennon', short: 'LENNON', era: 'ROCK / ZONER',
    style: 'Defesa, anti-ar e controle de tela', special: 'Peace Pulse',
    sheet: 'assets/fighter-lennon-sheet-v2.webp',
    color: '#729788', speed: 5.55, jump: 12.55, power: 74, mobility: 66, defense: 90,
    quote: 'Dê uma chance ao contra-ataque.'
  }
];

export const STAGES = {
  seattle:  { name: 'SEATTLE RAIN',   image: 'assets/stage-seattle.webp',   tint: '#6f8da1', accent: '#d6a45b' },
  coliseum: { name: 'RED COLOSSEUM',  image: 'assets/stage-coliseum.webp',  tint: '#b83d31', accent: '#e5a14b' },
  cellar:   { name: 'ABBEY CELLAR',   image: 'assets/stage-cellar.webp',    tint: '#7c8c77', accent: '#c38b52' }
};

// Frame data: startup / active / recovery at 60fps.
// level: mid (stand block) | low (crouch block) | overhead (stand block) | throw (unblockable)
export const MOVES = {
  punch:    { startup: 4,  active: 3, recovery: 9,  damage: 6,  hitstun: 14, blockstun: 9,  reach: 98,  top: 245, bottom: 105, push: 16, hitstop: 6,  meter: 9,  sprite: 5, level: 'mid',      advance: 1.4, cancel: ['kick', 'special'] },
  kick:     { startup: 9,  active: 4, recovery: 16, damage: 10, hitstun: 19, blockstun: 12, reach: 148, top: 270, bottom: 70,  push: 28, hitstop: 8,  meter: 14, sprite: 6, level: 'mid',      advance: 2.4, cancel: ['special'] },
  sweep:    { startup: 11, active: 4, recovery: 26, damage: 9,  hitstun: 12, blockstun: 14, reach: 156, top: 76,  bottom: 5,   push: 34, hitstop: 8,  meter: 13, sprite: 7, level: 'low',      knockdown: 44 },
  uppercut: { startup: 5,  active: 6, recovery: 26, damage: 12, hitstun: 24, blockstun: 15, reach: 108, top: 340, bottom: 28,  push: 22, hitstop: 10, meter: 16, sprite: 8, level: 'mid',      launch: 13.2, advance: 3.2, invuln: 5 },
  airpunch: { startup: 4,  active: 8, recovery: 8,  damage: 7,  hitstun: 14, blockstun: 10, reach: 102, top: 200, bottom: 40,  push: 18, hitstop: 6,  meter: 10, sprite: 5, level: 'overhead' },
  airkick:  { startup: 5,  active: 10, recovery: 8, damage: 9,  hitstun: 16, blockstun: 12, reach: 128, top: 210, bottom: 24,  push: 26, hitstop: 7,  meter: 13, sprite: 6, level: 'overhead' },
  throw:    { startup: 3,  active: 4, recovery: 24, damage: 14, hitstun: 0,  blockstun: 0,  reach: 72,  top: 250, bottom: 40,  push: 0,  hitstop: 14, meter: 16, sprite: 5, level: 'throw',    knockdown: 50, unblockable: true }
};

export const AI_CONFIG = {
  easy:   { think: [22, 40], guard: 0.22, attack: 0.3,  punish: 0.12, sticky: 0.22, dash: 0.04 },
  normal: { think: [8, 16],  guard: 0.58, attack: 0.7,  punish: 0.55, sticky: 0.55, dash: 0.18 },
  hard:   { think: [4, 9],   guard: 0.8,  attack: 0.88, punish: 0.84, sticky: 0.72, dash: 0.3 }
};

export const FRAME = {
  idleA: 0, idleB: 1, forward: 2, back: 3,
  crouch: 4, punch: 5, kick: 6, sweep: 7,
  uppercut: 8, block: 9, hit: 10, victory: 11
};
