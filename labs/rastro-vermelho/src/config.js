/**
 * Rastro Vermelho — constantes do mundo aberto, do cavalo e da qualidade.
 *
 * O cavalo não cansa: o galope de cruzeiro é o estado padrão.
 * O terreno é infinito (chunks) e a altura vem de fBm + vales de rio.
 */

export const STORAGE_KEY = 'rastro-vermelho:v1';

/** Tamanho de um chunk no plano XZ (unidades de jogo ≈ metros). */
export const CHUNK_SIZE = 96;

/** Nível d’água. Vales abaixo disso viram rio ou lago. */
export const WATER_Y = 3.35;

export const HORSE = {
    /** Velocidade mínima com o galope livre ligado — o cavalo não para. */
    cruise: 11.4,
    walk: 3.6,
    trot: 7.1,
    canter: 12.2,
    gallop: 19.8,
    spur: 24.5,
    accel: 11,
    brake: 14,
    friction: 1.15,
    turn: 1.48,
    radius: 1.15,
    height: 1.55,
    /** Inclinação máxima que o cavalo sobe sem perder impulso. */
    maxClimb: 0.72,
    spurBoost: 4.2,
    spurTime: 1.35
};

export const CAMERA = {
    chaseDist: 8.6,
    chaseHeight: 3.35,
    chaseLook: 1.35,
    cineDist: 14.5,
    cineHeight: 4.8,
    riderHeight: 2.05,
    chaseFov: 58,
    cineFov: 52,
    riderFov: 68,
    pitchMin: -0.42,
    pitchMax: 0.62,
    defaultPitch: 0.12
};

export const DAY_LENGTH = 480;

export const QUALITY = {
    low: {
        id: 'low',
        label: 'Performance',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 1024,
        bloom: false,
        chunkRadius: 1,
        terrainSegments: 18,
        grass: 900,
        trees: 8,
        rocks: 6,
        wildlife: 4,
        birds: 5,
        drawDistance: 280,
        fogDensity: 0.0064
    },
    medium: {
        id: 'medium',
        label: 'Equilibrada',
        pixelRatio: 1.25,
        antialias: true,
        shadows: true,
        shadowSize: 1536,
        bloom: true,
        chunkRadius: 2,
        terrainSegments: 26,
        grass: 2400,
        trees: 14,
        rocks: 10,
        wildlife: 8,
        birds: 9,
        drawDistance: 420,
        fogDensity: 0.0044
    },
    high: {
        id: 'high',
        label: 'Cinemática',
        pixelRatio: 1.55,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        bloom: true,
        chunkRadius: 2,
        terrainSegments: 34,
        grass: 4200,
        trees: 20,
        rocks: 14,
        wildlife: 12,
        birds: 14,
        drawDistance: 560,
        fogDensity: 0.0034
    }
};

/**
 * Ciclo de um dia. `at` ∈ [0, 1] — 0 é o fim da madrugada.
 * sunDir aponta PARA o sol (o shader usa o mesmo vetor do Safari Dourado).
 */
export const SKY_STOPS = [
    {
        at: 0,
        zenith: [0.05, 0.07, 0.16],
        horizon: [0.42, 0.22, 0.18],
        ground: [0.12, 0.08, 0.06],
        sun: [1.0, 0.55, 0.28],
        sunDir: [-0.72, 0.08, -0.42],
        fog: [0.18, 0.12, 0.10],
        light: [1.0, 0.62, 0.38],
        lightIntensity: 0.55,
        ambient: [0.16, 0.14, 0.18]
    },
    {
        at: 0.12,
        zenith: [0.22, 0.38, 0.72],
        horizon: [1.0, 0.58, 0.28],
        ground: [0.38, 0.18, 0.10],
        sun: [1.0, 0.72, 0.38],
        sunDir: [-0.62, 0.28, -0.52],
        fog: [0.72, 0.48, 0.32],
        light: [1.0, 0.82, 0.55],
        lightIntensity: 1.55,
        ambient: [0.38, 0.28, 0.24]
    },
    {
        at: 0.38,
        zenith: [0.28, 0.52, 0.88],
        horizon: [0.72, 0.82, 0.92],
        ground: [0.42, 0.32, 0.22],
        sun: [1.0, 0.96, 0.82],
        sunDir: [0.18, 0.82, -0.42],
        fog: [0.62, 0.72, 0.82],
        light: [1.0, 0.98, 0.92],
        lightIntensity: 2.15,
        ambient: [0.48, 0.46, 0.44]
    },
    {
        at: 0.62,
        zenith: [0.22, 0.42, 0.78],
        horizon: [0.96, 0.68, 0.38],
        ground: [0.40, 0.24, 0.14],
        sun: [1.0, 0.82, 0.42],
        sunDir: [0.62, 0.42, -0.48],
        fog: [0.78, 0.58, 0.36],
        light: [1.0, 0.88, 0.62],
        lightIntensity: 1.92,
        ambient: [0.42, 0.36, 0.30]
    },
    {
        at: 0.78,
        zenith: [0.14, 0.18, 0.42],
        horizon: [1.0, 0.42, 0.16],
        ground: [0.32, 0.14, 0.08],
        sun: [1.0, 0.52, 0.22],
        sunDir: [0.78, 0.16, -0.42],
        fog: [0.62, 0.32, 0.16],
        light: [1.0, 0.58, 0.28],
        lightIntensity: 1.35,
        ambient: [0.32, 0.22, 0.20]
    },
    {
        at: 0.92,
        zenith: [0.04, 0.05, 0.12],
        horizon: [0.22, 0.14, 0.18],
        ground: [0.08, 0.06, 0.05],
        sun: [0.72, 0.78, 1.0],
        sunDir: [0.55, -0.08, -0.62],
        fog: [0.10, 0.08, 0.12],
        light: [0.62, 0.70, 0.92],
        lightIntensity: 0.38,
        ambient: [0.12, 0.12, 0.18]
    },
    {
        at: 1,
        zenith: [0.05, 0.07, 0.16],
        horizon: [0.42, 0.22, 0.18],
        ground: [0.12, 0.08, 0.06],
        sun: [1.0, 0.55, 0.28],
        sunDir: [-0.72, 0.08, -0.42],
        fog: [0.18, 0.12, 0.10],
        light: [1.0, 0.62, 0.38],
        lightIntensity: 0.55,
        ambient: [0.16, 0.14, 0.18]
    }
];

export const REGION_PREFIX = [
    'Serra', 'Vale', 'Mesa', 'Cânion', 'Pradaria', 'Passo', 'Riacho', 'Morro',
    'Alto', 'Baixada', 'Garganta', 'Chapada'
];

export const REGION_SUFFIX = [
    'do Corvo', 'Rubra', 'da Poeira', 'do Oeste', 'Dourada', 'dos Ossos',
    'do Trovão', 'Silenciosa', 'do Mustangue', 'da Lua', 'do Cobre',
    'dos Ventos', 'do Sal', 'Encarnada', 'do Relâmpago'
];

export const LANDMARKS = {
    town: { id: 'town', label: 'Povoado' },
    camp: { id: 'camp', label: 'Fogueira' },
    arch: { id: 'arch', label: 'Arco de pedra' },
    wagon: { id: 'wagon', label: 'Carroça' },
    herd: { id: 'herd', label: 'Manada' },
    falls: { id: 'falls', label: 'Cachoeira' }
};

export const LANDMARK_ORDER = ['town', 'camp', 'arch', 'wagon', 'herd', 'falls'];
