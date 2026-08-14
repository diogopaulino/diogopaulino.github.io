/**
 * Safari Dourado — constantes de mundo, jeep, caderno e qualidade.
 */

export const STORAGE_KEY = 'safari-dourado:v1';

/** Raio jogável da savana (metros de jogo). */
export const WORLD_RADIUS = 210;

/** Poço d’água no centro. */
export const WATER = {
    radius: 28,
    surfaceY: -0.35,
    shore: 36
};

export const JEEP = {
    accel: 18,
    brake: 26,
    friction: 2.4,
    maxSpeed: 22,
    reverseMax: 8,
    turn: 1.55,
    radius: 2.1,
    height: 1.15
};

export const CAMERA = {
    chaseDist: 11.5,
    chaseHeight: 4.4,
    chaseLook: 1.15,
    hoodDist: 0.4,
    hoodHeight: 2.05,
    aerialDist: 22,
    aerialHeight: 18,
    photoFovMin: 18,
    photoFovMax: 52,
    photoFov: 32,
    chaseFov: 58
};

export const PHOTO = {
    cooldown: 0.85,
    minDist: 9,
    sweetMin: 16,
    sweetMax: 52,
    maxDist: 78,
    centerWeight: 0.72
};

export const SPECIES = {
    elephant: {
        id: 'elephant',
        label: 'Elefante',
        points: 360,
        rarity: 'ícone',
        color: '#c4b09a'
    },
    giraffe: {
        id: 'giraffe',
        label: 'Girafa',
        points: 320,
        rarity: 'alta',
        color: '#d4a04a'
    },
    lion: {
        id: 'lion',
        label: 'Leão',
        points: 420,
        rarity: 'rara',
        color: '#c47a28'
    },
    zebra: {
        id: 'zebra',
        label: 'Zebra',
        points: 200,
        rarity: 'comum',
        color: '#e8e2d4'
    },
    wildebeest: {
        id: 'wildebeest',
        label: 'Gnu',
        points: 180,
        rarity: 'comum',
        color: '#6b5a48'
    },
    gazelle: {
        id: 'gazelle',
        label: 'Gazela',
        points: 170,
        rarity: 'comum',
        color: '#c9a066'
    },
    hippo: {
        id: 'hippo',
        label: 'Hipopótamo',
        points: 300,
        rarity: 'alta',
        color: '#8a6a6a'
    },
    flamingo: {
        id: 'flamingo',
        label: 'Flamingo',
        points: 240,
        rarity: 'alta',
        color: '#f0a0a0'
    }
};

export const SPECIES_ORDER = [
    'elephant', 'giraffe', 'lion', 'zebra',
    'wildebeest', 'gazelle', 'hippo', 'flamingo'
];

export const QUALITY = {
    low: {
        id: 'low',
        label: 'Performance',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 1024,
        bloom: false,
        terrainSegments: 96,
        grass: 700,
        trees: 28,
        rocks: 18,
        birds: 4,
        drawDistance: 240,
        fogDensity: 0.0078
    },
    medium: {
        id: 'medium',
        label: 'Equilibrada',
        pixelRatio: 1.25,
        antialias: true,
        shadows: true,
        shadowSize: 1536,
        bloom: true,
        terrainSegments: 140,
        grass: 2200,
        trees: 48,
        rocks: 28,
        birds: 8,
        drawDistance: 340,
        fogDensity: 0.0056
    },
    high: {
        id: 'high',
        label: 'Cinemática',
        pixelRatio: 1.55,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        bloom: true,
        terrainSegments: 180,
        grass: 3800,
        trees: 72,
        rocks: 40,
        birds: 12,
        drawDistance: 420,
        fogDensity: 0.0046
    }
};

/**
 * Paleta do entardecer. `at` é o progresso da hora dourada (0 = tarde, 1 = sol posto).
 */
export const SKY_STOPS = [
    {
        at: 0,
        zenith: [0.28, 0.48, 0.78],
        horizon: [0.96, 0.72, 0.42],
        ground: [0.42, 0.28, 0.16],
        sun: [1.0, 0.86, 0.52],
        sunDir: [0.72, 0.38, -0.58],
        fog: [0.78, 0.62, 0.42],
        light: [1.0, 0.90, 0.72],
        lightIntensity: 2.05,
        ambient: [0.42, 0.38, 0.34]
    },
    {
        at: 0.45,
        zenith: [0.18, 0.28, 0.58],
        horizon: [1.0, 0.52, 0.22],
        ground: [0.38, 0.18, 0.10],
        sun: [1.0, 0.62, 0.28],
        sunDir: [0.82, 0.22, -0.52],
        fog: [0.72, 0.42, 0.24],
        light: [1.0, 0.72, 0.42],
        lightIntensity: 1.85,
        ambient: [0.38, 0.28, 0.24]
    },
    {
        at: 1,
        zenith: [0.06, 0.08, 0.22],
        horizon: [0.72, 0.24, 0.14],
        ground: [0.16, 0.08, 0.06],
        sun: [1.0, 0.42, 0.18],
        sunDir: [0.70, 0.10, -0.70],
        fog: [0.32, 0.14, 0.10],
        light: [1.0, 0.48, 0.28],
        lightIntensity: 1.22,
        ambient: [0.22, 0.16, 0.18]
    }
];

/** Duração da hora dourada em segundos de jogo. */
export const GOLDEN_HOUR = 420;
