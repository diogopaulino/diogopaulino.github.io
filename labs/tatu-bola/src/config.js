/**
 * Tatu Bola — constantes, spawns e o mapa da ilha.
 *
 * Fórmulas (unidades de cartucho ≈ metros):
 *   gravidade  g = 38
 *   pulo       vy = JUMP; segundo pulo = JUMP * 0.82
 *   roll       duração ROLL.time; velocidade ROLL.speed
 *   terreno    ver world.heightAt()
 */

export const STORAGE_KEY = 'tatu-bola:v1';

export const ISLAND = {
    radius: 38,
    water: 0.05,
    fogNear: 28,
    fogFar: 78
};

export const PLAYER = {
    radius: 0.52,
    height: 0.95,
    accel: 60,
    airAccel: 25,
    maxSpeed: 10.5,
    rollSpeed: 16.0,
    friction: 10.0,
    airFriction: 2.0,
    jump: 12.0,
    doubleJump: 10.0,
    gravity: 42,
    coyote: 0.15,
    rollTime: 0.72,
    rollCooldown: 0.28,
    invuln: 1.65,
    swimSpeed: 4.0,
    drownTime: 2.6
};

export const QUEST = {
    crystals: 7,
    lives: 3,
    cajuLife: 100,
    crystalScore: 800,
    cajuScore: 25,
    crateScore: 60,
    enemyScore: 120,
    idolScore: 2500,
    maxLives: 5
};

export const QUALITY = {
    auto: { pixel: 1.5, shadows: true, particles: 1.0 },
    low: { pixel: 1.0, shadows: false, particles: 0.5 },
    medium: { pixel: 1.5, shadows: true, particles: 0.8 },
    high: { pixel: 2.0, shadows: true, particles: 1.2 }
};

/** Cristais — (x, z). Y é amostrado do terreno + offset. */
export const CRYSTAL_SPOTS = [
    { x: 4.5, z: 10.5, label: 'Praia' },
    { x: -16, z: 8, label: 'Cais' },
    { x: 18, z: 6, label: 'Colina leste' },
    { x: 2, z: -22, label: 'Topo do templo' },
    { x: -10, z: -8, label: 'Ruína' },
    { x: 14, z: -12, label: 'Plataformas' },
    { x: -6, z: 18, label: 'Dunas' }
];

export const CAJU_SPOTS = [
    [0, 8], [3, 6], [-3, 7], [6, 4], [-5, 4],
    [-14, 6], [-18, 9], [-12, 11],
    [12, 8], [16, 4], [20, 2],
    [8, -4], [4, -10], [-2, -14],
    [-8, -4], [-12, -10], [10, -16],
    [16, -8], [0, 16], [-8, 16],
    [8, 14], [-18, 2], [22, -4], [6, -20]
];

export const CRATE_SPOTS = [
    [2, 5], [-8, 9], [10, 3], [-4, -6],
    [15, -6], [-14, 4], [8, -14], [0, -10]
];

export const ENEMIES = {
    crabs: [
        { x: 8, z: 8, span: 4.5, yaw: 0 },
        { x: -10, z: 6, span: 3.6, yaw: 1.2 },
        { x: 14, z: -4, span: 4, yaw: 0.4 },
        { x: -6, z: -12, span: 3.2, yaw: 2.1 },
        { x: 6, z: 16, span: 3.8, yaw: 0.7 },
        { x: -16, z: -2, span: 3, yaw: 1.6 }
    ],
    bats: [
        { x: 10, z: -8, r: 3.4, y: 4.2 },
        { x: -8, z: -14, r: 2.8, y: 5.1 },
        { x: 18, z: 2, r: 3.1, y: 3.8 },
        { x: -4, z: 14, r: 2.6, y: 3.4 }
    ],
    plants: [
        { x: 5, z: -6 },
        { x: -12, z: 2 },
        { x: 12, z: -18 }
    ]
};

export const IDOL = { x: 2, z: -18 };

export const GET_QUOTES = [
    'CRYSTAL GET',
    'FACETA +1',
    'NICE CATCH',
    'BRILHOU, TATU',
    'ITEM GET!',
    'STAGE CRYSTAL'
];

export const HIT_QUOTES = [
    'OUCH!',
    'MISS… QUASE',
    'CONTINUE?',
    'A CARAPAÇA TREMEU',
    'TRY AGAIN',
    'GAME FREAK-OUT'
];

export const ROLL_QUOTES = [
    'LETS ROLL',
    'TATU BOLA!',
    'SPIN ATTACK',
    'BOING'
];
