// ==========================================================================
// Rock Kombat — Game Constants
// Marvel vs. Capcom & Mortal Kombat hyper-arcade specification:
// - 4-button magic series (Light -> Medium -> Heavy -> Launcher -> Air Combo)
// - 3-Bar Hyper Amplifier (EX Special = 1 bar, Pushblock = 0.4 bar, Hyper Combo = 2 bars)
// - Wide scrolling stage with dynamic camera zoom, Wall Bounce, OTG & MK Finishers
// ==========================================================================

export const W = 1280;
export const H = 720;
export const GROUND = 625;

// Expanded scrolling arena coordinates (world is 1600px wide, camera shows 1280px)
export const WORLD_W = 1600;
export const LEFT_WALL = 210;
export const RIGHT_WALL = 1390;

export const STEP = 1000 / 60;
export const INPUT_BUFFER = 12;
export const DASH_WINDOW = 20;
export const PARRY_WINDOW = 4;
export const PARRY_COOLDOWN = 26;
export const EX_COST = 100;       // 1 Bar
export const HYPER_COST = 200;    // 2 Bars
export const PUSHBLOCK_COST = 40; // Advancing Guard
export const MAX_METER = 300;     // 3 Hyper Bars
export const THROW_RANGE = 104;
export const GRAVITY = 0.76;
export const JUGGLE_GRAVITY = 0.58;
export const BACK_WALK = 0.72;
export const LAND_LAG = 4;
export const COMBO_DECAY = 0.085;
export const MIN_SCALE = 0.35;

export const METER_GAIN = Object.freeze({
  commit: 0.42,
  hit: 1.85,
  block: 1.05,
  damage: 1.45,
  guard: 0.85
});

export const SPRITE_SIZE = 415;
export const BODY_WIDTH = 44;
export const PUSH_DISTANCE = 94;

// Callouts inspired by Marvel vs. Capcom & Mortal Kombat
export const COMBO_TIERS = [
  { min: 3, label: 'BOM COMBO' },
  { min: 5, label: 'GRANDE COMBO' },
  { min: 7, label: 'COMBO IMPARÁVEL' },
  { min: 10, label: 'COMBO LENDÁRIO' }
];

export const FIGHTERS = [
  {
    id: 'kurt',
    name: 'Kurt Cobain',
    short: 'KURT',
    title: 'SEATTLE GRUNGE LEGEND',
    era: 'SEATTLE · GRUNGE',
    archetype: 'EQUILIBRADO · ONDA SÔNICA',
    style: 'Equilíbrio entre pressão de perto e controle de longe com ondas sonoras.',
    special: 'Feedback Wave',
    exSpecial: 'Feedback Wave (2 Hits · Wall Bounce)',
    hyper: 'Nirvana Overdrive',
    finisher: 'SMASHED AMP',
    sheet: 'assets/fighter-kurt-sheet-v2.webp',
    color: '#e5b95c',
    secondary: '#52b7ff',
    glow: '#ffcf6e',
    speed: 6.4,
    jump: 14.2,
    superJump: 18.2,
    power: 86,
    mobility: 78,
    defense: 82,
    standingHeight: 334,
    quote: 'Sem bis. O amplificador explodiu no último acorde.',
    moveset: [
      { cmd: 'J → K → I', name: 'Combo Grunge', desc: 'Sequência rápida que encaixa no Especial' },
      { cmd: 'H ou ↓ + I', name: 'Lançar pro Alto', desc: 'Joga o rival no ar — aperte W para Combo Aéreo!' },
      { cmd: 'Espaço · 1 barra', name: 'Feedback Wave', desc: 'Onda sônica de dois impactos' },
      { cmd: 'P · 2 barras', name: 'Nirvana Overdrive', desc: 'Feixe de distorção de até seis impactos' }
    ]
  },
  {
    id: 'axl',
    name: 'Axl Rose',
    short: 'AXL',
    title: 'JUNGLE HURRICANE',
    era: 'LOS ANGELES · HARD ROCK',
    archetype: 'VELOZ · AGRESSIVO',
    style: 'Ataques rápidos e investidas para encurtar a distância e pressionar no canto.',
    special: 'Paradise Rush',
    exSpecial: 'Paradise Rush (Investida + Wall Bounce)',
    hyper: 'Jungle Hurricane',
    finisher: 'PYRO ENCORE',
    sheet: 'assets/fighter-axl-sheet-v2.webp',
    color: '#ff4733',
    secondary: '#ffb338',
    glow: '#ff5e4d',
    speed: 7.35,
    jump: 14.6,
    superJump: 18.6,
    power: 82,
    mobility: 96,
    defense: 70,
    standingHeight: 347,
    quote: 'Bem-vindo à selva. O palco inteiro é meu.',
    moveset: [
      { cmd: 'J → K → I', name: 'Appetite Rush', desc: 'Combo explosivo que empurra para o canto' },
      { cmd: 'H ou ↓ + I', name: 'Mic Stand Upper', desc: 'Anti-aéreo invulnerável que inicia Combo Aéreo' },
      { cmd: 'Espaço · 1 barra', name: 'Paradise Rush', desc: 'Investida veloz que joga o rival na parede' },
      { cmd: 'P · 2 barras', name: 'Jungle Hurricane', desc: 'Investida de até seis impactos' }
    ]
  },
  {
    id: 'lennon',
    name: 'John Lennon',
    short: 'LENNON',
    title: 'ABBEY ROAD ARCHITECT',
    era: 'LONDON · CLASSIC ROCK',
    archetype: 'CONTROLE · CONTRA-ATAQUE',
    style: 'Chutes de maior alcance e orbes para controlar o espaço e punir avanços.',
    special: 'Peace Pulse',
    exSpecial: 'Peace Pulse (Esfera Dupla Harmônica)',
    hyper: 'Imagine Supernova',
    finisher: 'ABBEY ROAD REVERB',
    sheet: 'assets/fighter-lennon-sheet-v2.webp',
    color: '#4de6b8',
    secondary: '#c58aff',
    glow: '#6dffdb',
    speed: 5.95,
    jump: 13.6,
    superJump: 17.8,
    power: 79,
    mobility: 74,
    defense: 94,
    standingHeight: 323,
    quote: 'Imagine um contra-ataque sem escapatória.',
    moveset: [
      { cmd: 'J → K → I', name: 'Revolver String', desc: 'Golpes de longo alcance seguros na defesa' },
      { cmd: 'H ou ↓ + I', name: 'Revolution Lift', desc: 'Gancho luminoso que lança para Combo Aéreo' },
      { cmd: 'Espaço · 1 barra', name: 'Peace Pulse', desc: 'Dispara esferas duplas que controlam a arena' },
      { cmd: 'P · 2 barras', name: 'Imagine Supernova', desc: 'Dispara cinco orbes em alturas diferentes' }
    ]
  }
];

export const STAGES = {
  seattle: {
    name: 'SEATTLE RAIN',
    sub: 'PIER 48 · BLUE HOUR STORM',
    image: 'assets/stage-seattle.webp',
    tint: '#5d92b5',
    accent: '#f0b85a',
    floorGlow: 'rgba(93, 165, 225, 0.24)'
  },
  coliseum: {
    name: 'RED COLOSSEUM',
    sub: 'WORLD TOUR ARENA · 1988',
    image: 'assets/stage-coliseum.webp',
    tint: '#d93829',
    accent: '#ffad42',
    floorGlow: 'rgba(235, 72, 48, 0.28)'
  },
  cellar: {
    name: 'ABBEY CELLAR',
    sub: 'LONDON UNDERGROUND · 1969',
    image: 'assets/stage-cellar.webp',
    tint: '#52b896',
    accent: '#e09f5a',
    floorGlow: 'rgba(82, 184, 150, 0.22)'
  }
};

// Frame data @ 60fps.
// Magic Series (MvC): light -> medium -> heavy -> launcher (or sweep) -> special -> hyper
// Air Series: airlight -> airmedium -> airheavy (knockdown slam!)
export const MOVES = {
  light: {
    startup: 4, active: 3, recovery: 8,
    damage: 4, hitstun: 15, blockstun: 10,
    reach: 98, top: 250, bottom: 110,
    push: 12, hitstop: 5, meter: 12,
    sprite: 5, level: 'mid', advance: 1.8,
    cancel: ['medium', 'heavy', 'sweep', 'launcher', 'special', 'hyper']
  },
  medium: {
    startup: 6, active: 4, recovery: 12,
    damage: 7, hitstun: 19, blockstun: 13,
    reach: 138, top: 268, bottom: 80,
    push: 18, hitstop: 7, meter: 18,
    sprite: 6, level: 'mid', advance: 3.4,
    cancel: ['heavy', 'sweep', 'launcher', 'special', 'hyper']
  },
  heavy: {
    startup: 9, active: 5, recovery: 17,
    damage: 11, hitstun: 23, blockstun: 16,
    reach: 158, top: 278, bottom: 72,
    push: 30, hitstop: 10, meter: 24,
    sprite: 6, level: 'mid', advance: 4.5,
    wallBounce: true,
    cancel: ['launcher', 'special', 'hyper']
  },
  crouchlight: {
    startup: 4, active: 3, recovery: 8,
    damage: 4, hitstun: 14, blockstun: 9,
    reach: 96, top: 145, bottom: 15,
    push: 11, hitstop: 5, meter: 11,
    sprite: 5, level: 'low', advance: 1.2,
    cancel: ['medium', 'sweep', 'launcher', 'special', 'hyper']
  },
  sweep: {
    startup: 9, active: 4, recovery: 21,
    damage: 9, hitstun: 16, blockstun: 14,
    reach: 162, top: 92, bottom: 4,
    push: 26, hitstop: 9, meter: 20,
    sprite: 7, level: 'low', knockdown: 42, otg: true,
    cancel: ['special', 'hyper']
  },
  launcher: {
    startup: 6, active: 6, recovery: 22,
    damage: 11, hitstun: 36, blockstun: 15,
    reach: 116, top: 345, bottom: 26,
    push: 10, hitstop: 12, meter: 26,
    sprite: 8, level: 'mid',
    launch: 16.2, advance: 3.5, invuln: 6,
    jumpCancel: true,
    cancel: ['special', 'hyper']
  },
  airlight: {
    startup: 4, active: 6, recovery: 7,
    damage: 5, hitstun: 18, blockstun: 11,
    reach: 106, top: 220, bottom: 45,
    push: 10, hitstop: 5, meter: 13,
    sprite: 5, level: 'overhead', airJuggle: 6.8,
    cancel: ['airmedium', 'airheavy', 'special', 'hyper']
  },
  airmedium: {
    startup: 5, active: 7, recovery: 9,
    damage: 7, hitstun: 20, blockstun: 12,
    reach: 126, top: 225, bottom: 30,
    push: 12, hitstop: 7, meter: 17,
    sprite: 6, level: 'overhead', airJuggle: 7.4,
    cancel: ['airheavy', 'special', 'hyper']
  },
  airheavy: {
    startup: 7, active: 8, recovery: 12,
    damage: 11, hitstun: 26, blockstun: 14,
    reach: 142, top: 235, bottom: 20,
    push: 26, hitstop: 11, meter: 24,
    sprite: 6, level: 'overhead',
    airSlam: 15, knockdown: 48,
    cancel: ['special', 'hyper']
  },
  throw: {
    startup: 3, active: 4, recovery: 20,
    damage: 14, hitstun: 0, blockstun: 0,
    reach: 84, top: 260, bottom: 35,
    push: 0, hitstop: 14, meter: 24,
    sprite: 5, level: 'throw',
    knockdown: 48, unblockable: true, wallBounce: true
  }
};

// Character adjustments preserve the command list with distinct reach and risk.
export const NORMAL_VARIANTS = {
  axl: {
    light: { startup: 3, reach: 86, advance: 2.5 },
    medium: { startup: 5, reach: 126, advance: 4.1 },
    heavy: { startup: 8, reach: 147, advance: 5.1 }
  },
  lennon: {
    light: { reach: 108 },
    medium: { startup: 7, reach: 151, advance: 2.4 },
    heavy: { startup: 10, reach: 175, advance: 3.7 },
    sweep: { reach: 172, startup: 10 }
  }
};

// CPU difficulty. `think` = frames between decisions; the rest are probabilities.
// `react` = frames a player attack must be visible before the CPU can react to it
// (human visual reaction ≈ 12–15f @60fps). A 4f jab therefore can't be blocked on
// reaction — like against a person, the CPU has to *anticipate* (`anticipate` is the
// chance per decision of guarding up close on a guess, high/low picked at random).
// `damage` scales every hit the CPU lands (final = round(base × damage), min 1),
// `hyper` lets it spend 2 bars. Fácil is the kid-friendly default: slower, softer
// CPU that never fires a Hyper, so a first match is winnable by just pressing J K I.
export const AI_CONFIG = {
  easy:   { think: [22, 38], react: 22, anticipate: 0.04, guard: 0.18, attack: 0.32, punish: 0.12, combo: 0.2, dash: 0.05, airFollow: 0.1, damage: 0.7, hyper: false },
  normal: { think: [7, 14],  react: 14, anticipate: 0.16, guard: 0.62, attack: 0.74, punish: 0.60, combo: 0.68, dash: 0.24, airFollow: 0.60, damage: 1, hyper: true },
  hard:   { think: [3, 7],   react: 10, anticipate: 0.28, guard: 0.85, attack: 0.92, punish: 0.88, combo: 0.92, dash: 0.42, airFollow: 0.90, damage: 1, hyper: true }
};
export const DEFAULT_DIFFICULTY = 'easy';

export const FRAME = {
  idleA: 0, idleB: 1, forward: 2, back: 3,
  crouch: 4, punch: 5, kick: 6, sweep: 7,
  uppercut: 8, block: 9, hit: 10, victory: 11
};
