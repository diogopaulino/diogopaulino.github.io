// ==========================================================================
// Rock Kombat — Game Constants
// All configurable values, data definitions, and frame mappings
// ==========================================================================

// --- Arena dimensions ---
export const W = 1280;
export const H = 720;
export const GROUND = 620;
export const LEFT_WALL = 190;
export const RIGHT_WALL = 1090;

// --- Timing ---
export const STEP = 1000 / 60;
export const INPUT_BUFFER = 9;

// --- Combat tuning ---
export const PARRY_WINDOW = 3;       // frames (reduced from 4 for balance)
export const PARRY_COOLDOWN = 30;    // frames between parries
export const SPECIAL_COST = 40;      // meter required for special

export const METER_GAIN = Object.freeze({
  commit: 0.2,   // on move startup
  hit: 0.8,      // on successful hit
  block: 0.55,   // attacker gains on blocked hit
  damage: 0.65,  // defender gains on taking damage
  guard: 0.3     // defender gains on blocking
});

// --- Sizing ---
export const SPRITE_SIZE = 405;
export const BODY_WIDTH = 42;
export const PUSH_DISTANCE = 92;

// --- Fighter roster ---
export const FIGHTERS = [
  {
    id: 'kurt', name: 'Kurt Cobain', short: 'KURT', era: 'GRUNGE / BALANCED',
    style: 'Controle de espaço e impacto', special: 'Feedback Wave',
    sheet: 'assets/fighter-kurt-sheet-v2.webp',
    color: '#c6b06a', speed: 6.1, jump: 13.1, power: 82, mobility: 72, defense: 75,
    quote: 'Sem bis. Só feedback.'
  },
  {
    id: 'axl', name: 'Axl Rose', short: 'AXL', era: 'HARD ROCK / RUSHDOWN',
    style: 'Pressão, avanço e velocidade', special: 'Paradise Rush',
    sheet: 'assets/fighter-axl-sheet-v2.webp',
    color: '#c84d3c', speed: 6.7, jump: 13.4, power: 76, mobility: 90, defense: 66,
    quote: 'O palco nunca espera.'
  },
  {
    id: 'lennon', name: 'John Lennon', short: 'LENNON', era: 'ROCK / CONTROL',
    style: 'Defesa, contra-ataque e alcance', special: 'Peace Pulse',
    sheet: 'assets/fighter-lennon-sheet-v2.webp',
    color: '#729788', speed: 5.7, jump: 12.7, power: 74, mobility: 68, defense: 88,
    quote: 'Dê uma chance ao contra-ataque.'
  }
];

// --- Stage definitions ---
export const STAGES = {
  seattle:  { name: 'SEATTLE RAIN',   image: 'assets/stage-seattle.webp',   tint: '#6f8da1', accent: '#d6a45b' },
  coliseum: { name: 'RED COLOSSEUM',  image: 'assets/stage-coliseum.webp',  tint: '#b83d31', accent: '#e5a14b' },
  cellar:   { name: 'ABBEY CELLAR',   image: 'assets/stage-cellar.webp',    tint: '#7c8c77', accent: '#c38b52' }
};

// --- Move frame data ---
// Each move: startup (before hit), active (hitbox live), recovery (after hit)
// damage, hitstun/blockstun (defender's frozen frames), reach (px), hitbox top/bottom (relative to feet)
// push (knockback), hitstop (freeze on contact), meter (gain), sprite (sheet frame index)
// level: 'mid' | 'low' | 'overhead', cancel: moves this can chain into
export const MOVES = {
  punch:    { startup: 5,  active: 3, recovery: 10, damage: 6,  hitstun: 15, blockstun: 9,  reach: 96,  top: 245, bottom: 105, push: 18, hitstop: 5,  meter: 10, sprite: 5, level: 'mid',      cancel: ['kick', 'special'] },
  kick:     { startup: 10, active: 4, recovery: 17, damage: 10, hitstun: 20, blockstun: 12, reach: 145, top: 270, bottom: 70,  push: 30, hitstop: 8,  meter: 15, sprite: 6, level: 'mid',      cancel: ['special'] },
  sweep:    { startup: 12, active: 4, recovery: 24, damage: 9,  hitstun: 14, blockstun: 14, reach: 154, top: 76,  bottom: 5,   push: 36, hitstop: 8,  meter: 14, sprite: 7, level: 'low',      knockdown: 42 },
  uppercut: { startup: 6,  active: 5, recovery: 25, damage: 11, hitstun: 22, blockstun: 15, reach: 104, top: 320, bottom: 34,  push: 26, hitstop: 9,  meter: 16, sprite: 8, level: 'mid',      launch: 12.5 },
  airkick:  { startup: 5,  active: 9, recovery: 10, damage: 9,  hitstun: 18, blockstun: 12, reach: 125, top: 210, bottom: 30,  push: 30, hitstop: 7,  meter: 14, sprite: 6, level: 'overhead' }
};

// --- AI difficulty profiles ---
export const AI_CONFIG = {
  easy:   { think: [16, 28], guard: 0.38, attack: 0.46, punish: 0.28 },
  normal: { think: [9, 18],  guard: 0.62, attack: 0.68, punish: 0.58 },
  hard:   { think: [4, 10],  guard: 0.82, attack: 0.86, punish: 0.82 }
};

// --- Sprite sheet frame indices (4 cols × 3 rows = 12 frames) ---
export const FRAME = {
  idleA: 0, idleB: 1, forward: 2, back: 3,
  crouch: 4, punch: 5, kick: 6, sweep: 7,
  uppercut: 8, block: 9, hit: 10, victory: 11
};
