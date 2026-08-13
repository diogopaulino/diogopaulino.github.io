/**
 * River Knight — configuração central.
 *
 * Todos os números que definem a "sensação" do jogo moram aqui para facilitar
 * o ajuste fino sem caçar constantes espalhadas pelos módulos.
 */

/** Distância total (em metros de jogo) até o castelo. */
export const COURSE_LENGTH = 4200;

/** Onde o castelo é posicionado no eixo Z (o barco navega no sentido -Z). */
export const CASTLE_Z = -COURSE_LENGTH;

/** Ponto em que a barcaça do vilão bloqueia o rio. */
export const BOSS_Z = CASTLE_Z + 240;

export const BOAT = {
    baseSpeed: 26,
    boostSpeed: 41,
    brakeSpeed: 13,
    accel: 16,
    strafeSpeed: 15.5,
    strafeAccel: 46,
    maxHull: 5,
    throwCooldown: 0.42,
    furyCooldown: 0.16,
    invulnAfterHit: 1.4,
    bankLimitPadding: 3.4
};

export const AXE = {
    speed: 78,
    gravity: 16,
    life: 2.6,
    damage: 1,
    spin: 22
};

export const DIFFICULTY = {
    squire: {
        id: 'squire',
        label: 'Escudeiro',
        blurb: 'Rio calmo, inimigos raros. Ideal para conhecer o trecho.',
        spawnScale: 0.68,
        enemyFireScale: 0.72,
        damageScale: 1,
        hull: 6,
        scoreScale: 0.8
    },
    warrior: {
        id: 'warrior',
        label: 'Guerreiro',
        blurb: 'O equilíbrio da campanha: pressão constante, margem para erro.',
        spawnScale: 1,
        enemyFireScale: 1,
        damageScale: 1,
        hull: 5,
        scoreScale: 1
    },
    legend: {
        id: 'legend',
        label: 'Lenda',
        blurb: 'Rio infestado, arqueiros precisos e casco frágil. Boa sorte.',
        spawnScale: 1.42,
        enemyFireScale: 1.35,
        damageScale: 1,
        hull: 4,
        scoreScale: 1.35
    }
};

export const SCORE = {
    enemyShip: 320,
    tower: 260,
    barricade: 150,
    rock: 0,
    coin: 90,
    bossPart: 900,
    bossKill: 4000,
    distancePerMeter: 1.4,
    hullBonus: 800,
    comboStep: 0.12,
    comboMax: 4
};

/** Presets de qualidade gráfica. */
export const QUALITY = {
    low: {
        id: 'low',
        label: 'Performance',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 1024,
        bloom: false,
        terrainSegments: 150,
        waterSegments: 110,
        scatterScale: 0.5,
        fogDensity: 0.0024,
        drawDistance: 620
    },
    medium: {
        id: 'medium',
        label: 'Equilibrada',
        pixelRatio: 1.35,
        antialias: true,
        shadows: true,
        shadowSize: 1536,
        bloom: true,
        terrainSegments: 216,
        waterSegments: 168,
        scatterScale: 0.8,
        fogDensity: 0.0017,
        drawDistance: 900
    },
    high: {
        id: 'high',
        label: 'Cinemática',
        pixelRatio: 2,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        bloom: true,
        terrainSegments: 268,
        waterSegments: 220,
        scatterScale: 1,
        fogDensity: 0.0014,
        drawDistance: 1150
    }
};

/**
 * Paleta do "golden hour" medieval. As cores do céu são interpoladas ao longo
 * da corrida (amanhecer enevoado → dourado → crepúsculo sobre o castelo).
 */
export const SKY_STOPS = [
    {
        at: 0,
        zenith: [0.09, 0.19, 0.38],
        horizon: [0.52, 0.50, 0.50],
        ground: [0.11, 0.12, 0.14],
        sun: [1.0, 0.88, 0.68],
        sunDir: [0.80, 0.28, -0.53],
        fog: [0.44, 0.47, 0.54],
        light: [1.0, 0.94, 0.84],
        lightIntensity: 1.35,
        ambient: [0.30, 0.38, 0.52]
    },
    {
        at: 0.45,
        zenith: [0.07, 0.16, 0.40],
        horizon: [0.82, 0.50, 0.24],
        ground: [0.14, 0.11, 0.10],
        sun: [1.0, 0.74, 0.38],
        sunDir: [0.90, 0.20, -0.39],
        fog: [0.52, 0.38, 0.30],
        light: [1.0, 0.80, 0.56],
        lightIntensity: 1.5,
        ambient: [0.30, 0.32, 0.46]
    },
    {
        at: 0.82,
        zenith: [0.035, 0.055, 0.17],
        horizon: [0.60, 0.21, 0.14],
        ground: [0.09, 0.06, 0.08],
        sun: [1.0, 0.46, 0.22],
        sunDir: [0.62, 0.11, -0.78],
        fog: [0.27, 0.15, 0.17],
        light: [1.0, 0.56, 0.34],
        lightIntensity: 1.25,
        ambient: [0.20, 0.21, 0.36]
    },
    {
        at: 1,
        zenith: [0.018, 0.026, 0.085],
        horizon: [0.32, 0.10, 0.11],
        ground: [0.05, 0.035, 0.055],
        sun: [1.0, 0.36, 0.18],
        sunDir: [0.34, 0.05, -0.94],
        fog: [0.14, 0.08, 0.11],
        light: [1.0, 0.44, 0.28],
        lightIntensity: 1.05,
        ambient: [0.16, 0.17, 0.32]
    }
];

export const COLORS = {
    hull: 0x6b4429,
    hullDark: 0x4a2f1d,
    hullTrim: 0xb98a4b,
    sail: 0xdccfae,
    sailStripe: 0x9c2b2b,
    enemySail: 0x241d28,
    enemyStripe: 0x8b1d1d,
    stone: 0x8d8b86,
    stoneDark: 0x5f5d59,
    roof: 0x5a2f3a,
    gold: 0xf3c96b,
    fire: 0xff8a3c,
    princess: 0xe8b7d4
};

export const STORAGE_KEY = 'river-knight:v1';
