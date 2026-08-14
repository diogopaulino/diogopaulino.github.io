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
    baseSpeed: 32,
    boostSpeed: 49,
    brakeSpeed: 15,
    accel: 18,
    strafeSpeed: 17.5,
    strafeAccel: 52,
    maxHull: 5,
    /** Recarga de canhão (uma salva). */
    throwCooldown: 0.56,
    furyCooldown: 0.26,
    invulnAfterHit: 1.65,
    bankLimitPadding: 3.2
};

/** Canhão de bordo — mira automática (estilo jogos de navio). */
export const CANNON = {
    speed: 118,
    gravity: 11,
    life: 3.4,
    damage: 1,
    /** Alcance de trava automática. */
    assistRange: 175,
    /** Cone bem amplo: só precisa apontar o navio. */
    assistCone: 0.02,
    loft: 6.2,
    ballRadius: 1.85
};

/** Alias legado — alguns módulos ainda referenciam AXE. */
export const AXE = CANNON;

export const DIFFICULTY = {
    squire: {
        id: 'squire',
        label: 'Escudeiro',
        blurb: 'Rio calmo, inimigos raros. Ideal para conhecer o trecho.',
        spawnScale: 0.62,
        enemyFireScale: 0.58,
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
        fogDensity: 0.0022,
        drawDistance: 620,
        pointLights: false,
        reeds: 160,
        birds: 0
    },
    medium: {
        id: 'medium',
        label: 'Equilibrada',
        pixelRatio: 1.25,
        antialias: true,
        shadows: true,
        shadowSize: 1536,
        bloom: true,
        terrainSegments: 200,
        waterSegments: 156,
        scatterScale: 0.85,
        fogDensity: 0.0015,
        drawDistance: 900,
        pointLights: false,
        reeds: 280,
        birds: 10
    },
    high: {
        id: 'high',
        label: 'Cinemática',
        pixelRatio: 1.5,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        bloom: true,
        terrainSegments: 248,
        waterSegments: 200,
        scatterScale: 1,
        fogDensity: 0.00125,
        drawDistance: 1150,
        pointLights: true,
        reeds: 380,
        birds: 14
    }
};

/**
 * Paleta do "golden hour" medieval. As cores do céu são interpoladas ao longo
 * da corrida (amanhecer enevoado → dourado → crepúsculo sobre o castelo).
 */
export const SKY_STOPS = [
    {
        at: 0,
        zenith: [0.16, 0.32, 0.58],
        horizon: [0.78, 0.72, 0.62],
        ground: [0.16, 0.18, 0.16],
        sun: [1.0, 0.93, 0.74],
        sunDir: [0.62, 0.42, -0.66],
        fog: [0.62, 0.68, 0.72],
        light: [1.0, 0.96, 0.88],
        lightIntensity: 1.72,
        ambient: [0.38, 0.46, 0.58]
    },
    {
        at: 0.45,
        zenith: [0.10, 0.22, 0.48],
        horizon: [0.92, 0.58, 0.28],
        ground: [0.16, 0.12, 0.10],
        sun: [1.0, 0.78, 0.42],
        sunDir: [0.84, 0.28, -0.46],
        fog: [0.58, 0.42, 0.32],
        light: [1.0, 0.84, 0.58],
        lightIntensity: 1.68,
        ambient: [0.36, 0.34, 0.44]
    },
    {
        at: 0.82,
        zenith: [0.05, 0.08, 0.22],
        horizon: [0.72, 0.28, 0.16],
        ground: [0.10, 0.06, 0.07],
        sun: [1.0, 0.52, 0.24],
        sunDir: [0.58, 0.16, -0.80],
        fog: [0.30, 0.16, 0.16],
        light: [1.0, 0.60, 0.36],
        lightIntensity: 1.38,
        ambient: [0.24, 0.22, 0.36]
    },
    {
        at: 1,
        zenith: [0.022, 0.032, 0.10],
        horizon: [0.38, 0.12, 0.12],
        ground: [0.05, 0.035, 0.055],
        sun: [1.0, 0.40, 0.20],
        sunDir: [0.32, 0.08, -0.94],
        fog: [0.16, 0.08, 0.10],
        light: [1.0, 0.48, 0.30],
        lightIntensity: 1.12,
        ambient: [0.18, 0.18, 0.32]
    }
];

/** Batidas narrativas — o rio deixa de ser um corredor vazio. */
export const LANDMARKS = [
    { at: 0.04, text: 'O vale de Eld' },
    { at: 0.22, text: 'As corredeiras' },
    { at: 0.48, text: 'As torres de vigia' },
    { at: 0.72, text: 'O desfiladeiro de Morvain' },
    { at: 0.90, text: 'As muralhas à vista!' }
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
