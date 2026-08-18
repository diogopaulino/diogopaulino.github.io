/**
 * Riftball — constantes, regras e fórmulas da simulação.
 *
 * Partida: primeiro a SCORE_LIMIT gols, ou quem liderar quando o relógio
 * zerar. Empate vai a gol de ouro (phase 'overtime').
 *
 * Física em passo fixo DT = 1/60. Host (sala) é autoridade; o convidado
 * só envia input e interpola snapshots.
 */

export const STORAGE_KEY = 'riftball:v1';

export const DT = 1 / 60;
export const MAX_STEPS = 5;
export const SCORE_LIMIT = 5;
export const MATCH_TIME = 180;
export const KICKOFF_T = 1.35;
export const GOAL_FREEZE = 2.15;

export const ARENA = {
    halfX: 26,
    halfZ: 16,
    wall: 0.55,
    floorY: 0,
    ceiling: 12,
    goalHalfZ: 4.2,
    goalHeight: 4.4,
    goalDepth: 1.8
};

/** Hover arcade, sempre em pé. Impulso no eixo do yaw; deriva lateral morre rápido. */
export const CRAFT = {
    radius: 1.12,
    hover: 0.62,
    thrust: 46,
    boostThrust: 34,
    maxSpeed: 26,
    boostMax: 36,
    drag: 1.25,
    grip: 8.5,
    steer: 3.1,
    reverseSteer: 0.72,
    jump: 12.0,
    gravity: 36,
    mass: 3.5,
    boostMaxMeter: 1,
    boostDrain: 0.55,
    boostRegen: 0.28,
    padRegen: 1.35,
    wallRest: 0.25
};

/** Bola de éter: mais leve, quica, pouco arrasto no ar. */
export const BALL = {
    radius: 0.92,
    mass: 1.2,
    gravity: 28,
    restitution: 0.68,
    floorFriction: 0.88,
    airDrag: 0.12,
    maxSpeed: 42,
    wallRest: 0.60
};

/**
 * Colisão esfera-esfera (impulso ao longo da normal):
 *   j = -(1 + e) * rel · n / (1/mA + 1/mB)
 * Chute extra se o hover está em boost: + KICK * heading.
 */
export const HIT = {
    craftBallE: 0.62,
    craftCraftE: 0.45,
    kick: 6.5,
    boostKick: 4.8,
    minSep: 0.02
};

export const PADS = [
    { x: 0, z: -9.5 },
    { x: 0, z: 9.5 },
    { x: -12, z: 0 },
    { x: 12, z: 0 }
];

export const PAD_RADIUS = 2.1;

export const TEAMS = [
    { id: 'cyan', name: 'Ciano', color: 0x3cf0ff, accent: 0x1494c8, spawnX: -12, yaw: Math.PI / 2 },
    { id: 'magenta', name: 'Magenta', color: 0xff4ad8, accent: 0xc4249a, spawnX: 12, yaw: -Math.PI / 2 }
];

export const QUALITY = {
    low: { antialias: false, pixelRatio: 1, bloom: false, shadows: false, particles: 80, shards: 10 },
    medium: { antialias: true, pixelRatio: 1.35, bloom: true, shadows: true, particles: 160, shards: 16 },
    high: { antialias: true, pixelRatio: 1.75, bloom: true, shadows: true, particles: 260, shards: 22 }
};

export const NET = {
    prefix: 'dp-riftball-v1-',
    tick: 1 / 20,
    inputTick: 1 / 30,
    delay: 0.08,
    alphabet: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
};
