/** Regras centrais. Todas as distâncias estão em metros Babylon. */
export const PLAYER = {
  maxHealth: 100,
  maxStamina: 100,
  walkSpeed: 5.1,
  runSpeed: 8.2,
  turnSpeed: 12,
  staminaRecovery: 22,
  sprintCost: 12,
  blockCost: 7,
  lightCost: 14,
  heavyCost: 31,
  dodgeCost: 27,
  dodgeSpeed: 15.5,
  dodgeTime: .42
};

export const ATTACKS = {
  light: { duration: .48, hitStart: .19, hitEnd: .31, damage: 32, range: 2.7, arc: .28, knockback: 1.2 },
  heavy: { duration: .86, hitStart: .40, hitEnd: .55, damage: 58, range: 3.05, arc: .05, knockback: 2.7 }
};

export const DIFFICULTY = {
  squire: { playerHealth: 125, enemyHealth: .82, enemyDamage: .72, aggression: .82, score: .8 },
  knight: { playerHealth: 100, enemyHealth: 1, enemyDamage: 1, aggression: 1, score: 1 },
  legend: { playerHealth: 82, enemyHealth: 1.18, enemyDamage: 1.28, aggression: 1.2, score: 1.4 }
};

export const WAVES = [
  { title: 'A primeira brecha', enemies: ['raider', 'raider', 'raider'] },
  { title: 'Escudos no nevoeiro', enemies: ['raider', 'guard', 'raider', 'guard'] },
  { title: 'O pátio em chamas', enemies: ['brute', 'raider', 'guard', 'raider', 'guard'] },
  { title: 'O comandante do cerco', enemies: ['guard', 'raider', 'warlord', 'raider'] }
];

export const ENEMY_TYPES = {
  raider: { name: 'Saqueador do Norte', health: 68, speed: 3.8, damage: 17, range: 2.05, scale: 1 },
  guard: { name: 'Guarda de Ferro', health: 104, speed: 3.15, damage: 21, range: 2.15, scale: 1.05 },
  brute: { name: 'Quebra-Muralhas', health: 155, speed: 2.65, damage: 29, range: 2.4, scale: 1.18 },
  warlord: { name: 'Eirik, o Impiedoso', health: 330, speed: 3.25, damage: 32, range: 2.55, scale: 1.28, boss: true }
};

export const QUALITY = {
  performance: { hardwareScale: 1.45, shadows: 1024, particles: .55, bloom: .07, grain: false, aberration: false, ssao: false },
  balanced: { hardwareScale: 1, shadows: 1536, particles: .8, bloom: .11, grain: true, aberration: false, ssao: false },
  cinematic: { hardwareScale: .75, shadows: 2048, particles: 1, bloom: .15, grain: true, aberration: true, ssao: true }
};

export const STORAGE_KEY = 'ultimo-bastiao:v1';
