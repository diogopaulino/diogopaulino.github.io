/**
 * Pandemônio — constantes de jogabilidade, qualidade e pontuação.
 *
 * Tudo que define a "sensação" (gravidade, pulo, vidas, ritmo dos inimigos)
 * mora aqui para ajustar sem caçar números espalhados pelos módulos.
 */

export const STORAGE_KEY = 'labs.pandemonium.v1';

export const PLAYER = {
    runSpeed: 11.4,
    airControl: 0.72,
    accel: 38,
    friction: 18,
    gravity: 32,
    jumpVy: 12.4,
    doubleJumpVy: 11.2,
    coyote: 0.1,
    jumpBuffer: 0.12,
    radius: 0.55,
    height: 1.55,
    invuln: 1.45,
    attackTime: 0.42,
    attackCooldown: 0.18,
    attackRadius: 1.85,
    stompBounce: 8.4,
    maxFall: -28
};

export const DIFFICULTY = {
    acrobat: {
        id: 'acrobat',
        label: 'Acrobata',
        blurb: 'Trilho largo, inimigos preguiçosos e três vidas extra. Para conhecer Lyrion.',
        lives: 5,
        enemySpeed: 0.7,
        spawnScale: 0.7,
        scoreScale: 0.8,
        widthBonus: 0.45
    },
    hero: {
        id: 'hero',
        label: 'Heroína',
        blurb: 'O ritmo do clássico: pulos justos, impes no caminho, margem para errar.',
        lives: 3,
        enemySpeed: 1,
        spawnScale: 1,
        scoreScale: 1,
        widthBonus: 0
    },
    chaos: {
        id: 'chaos',
        label: 'Caos',
        blurb: 'Trilho estreito, bichos nervosos e pouco fôlego. O carnaval não perdoa.',
        lives: 2,
        enemySpeed: 1.28,
        spawnScale: 1.25,
        scoreScale: 1.4,
        widthBonus: -0.35
    }
};

export const SCORE = {
    gem: 50,
    stomp: 200,
    spin: 150,
    checkpoint: 300,
    heart: 400,
    finish: 2500,
    timeBonusPerSecond: 8,
    lifeBonus: 500,
    comboWindow: 2.4
};

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 512,
        drawDistance: 90,
        fogDensity: 0.018,
        sceneryStep: 14,
        particles: false,
        bloom: false
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.5,
        antialias: true,
        shadows: true,
        shadowSize: 1024,
        drawDistance: 140,
        fogDensity: 0.012,
        sceneryStep: 9,
        particles: true,
        bloom: false
    },
    high: {
        id: 'high',
        pixelRatio: 2,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        drawDistance: 190,
        fogDensity: 0.009,
        sceneryStep: 6,
        particles: true,
        bloom: true
    }
};

export const CAMERA_MODES = [
    { name: 'perseguição', back: 8.4, height: 4.15, lookAhead: 6.2, side: 1.15 },
    { name: 'cinema', back: 6.2, height: 2.85, lookAhead: 7.4, side: 2.4 },
    { name: 'aérea', back: 11.5, height: 10.5, lookAhead: 4.0, side: 0.2 }
];

export const PALETTE = {
    skyTop: 0x2a0a4a,
    skyHorizon: 0xff6b4a,
    skyBottom: 0xffc14a,
    fog: 0x4a1848,
    sun: 0xffd28a,
    ambientSky: 0xff9ad5,
    ambientGround: 0x3a1840,
    magenta: 0xff2d95,
    teal: 0x2de2c5,
    gold: 0xffd166,
    grape: 0x6c2bd9
};
