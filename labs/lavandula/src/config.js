/**
 * Lavandula — constantes, qualidade e os cinco lugares quietos.
 *
 * Passeio relaxante: não há combate, timer nem falha. O jogador anda
 * pelos campos ao entardecer e recolhe memórias ao chegar perto de
 * marcos. Velocidades em m/s (1 unidade = 1 metro).
 */

export const STORAGE_KEY = 'lavandula-v1';

/** Caminhada lenta, no espírito de um filme — nunca uma corrida. */
export const PLAYER = {
    walk: 2.15,
    stride: 3.35,
    radius: 0.42,
    height: 1.72,
    turnSpeed: 7.2,
    sitLower: 0.42
};

export const CAMERA = {
    distance: 5.8,
    minDistance: 2.8,
    maxDistance: 14,
    height: 1.55,
    pitchMin: -0.28,
    pitchMax: 0.62,
    defaultPitch: 0.16,
    lookY: 1.28,
    sitDistance: 7.4
};

export const WORLD = {
    radius: 118,
    /** Espaçamento das fileiras de lavanda (metros). */
    rowGap: 2.55,
    /** Espaçamento entre pés na fileira. */
    plantGap: 0.72,
    pathHalf: 2.35
};

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 512,
        lavender: 1600,
        wheat: 280,
        trees: 0.45,
        particles: 40,
        birds: 3,
        terrainSegments: 64,
        drawDistance: 200,
        rowSkip: 2,
        plantSkip: 2.1
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.25,
        antialias: true,
        shadows: true,
        shadowSize: 1024,
        lavender: 5600,
        wheat: 700,
        trees: 0.75,
        particles: 120,
        birds: 6,
        terrainSegments: 96,
        drawDistance: 280,
        rowSkip: 1.35,
        plantSkip: 1.25
    },
    high: {
        id: 'high',
        pixelRatio: 1.6,
        antialias: true,
        shadows: true,
        shadowSize: 1536,
        lavender: 9000,
        wheat: 1100,
        trees: 1,
        particles: 200,
        birds: 8,
        terrainSegments: 128,
        drawDistance: 360,
        rowSkip: 1,
        plantSkip: 1
    }
};

/**
 * Cinco lugares. Textos originais — nenhum diálogo de filme.
 * `sit` marca um banco: E senta e recolhe a memória.
 */
export const MEMORIES = [
    {
        id: 'path',
        title: 'A estrada de terra',
        line: 'O pó sob os pés. O vento nas fileiras. Nada pede pressa.',
        x: 0.4,
        z: 36,
        r: 4.2
    },
    {
        id: 'rows',
        title: 'Entre as fileiras',
        line: 'Lavanda até o horizonte. O sol baixa e o campo respira.',
        x: 16.5,
        z: 6,
        r: 5.4
    },
    {
        id: 'bench',
        title: 'O banco de pedra',
        line: 'Sente. O dia ainda não se foi — e não precisa ir.',
        x: -7.2,
        z: -16,
        r: 3.4,
        sit: true
    },
    {
        id: 'olives',
        title: 'O olival',
        line: 'Prata nas folhas. Sombra antiga, pão e silêncio.',
        x: 24,
        z: -48,
        r: 6.2
    },
    {
        id: 'home',
        title: 'A casa no cume',
        line: 'A porta está aberta. Os campos ficam. Você também.',
        x: 0,
        z: -86,
        r: 5.5
    }
];

export const SPAWN = { x: 0.2, z: 58, yaw: Math.PI };

export const LIGHT = {
    clear: 0xf6d2b0,
    fog: 0xefc8b4,
    fogNear: 36,
    fogFar: 190,
    ambient: 0xffe8d0,
    ambientIntensity: 0.62,
    hemiSky: 0xffe0b8,
    hemiGround: 0x9a6aa0,
    hemiIntensity: 0.95,
    sun: 0xffd090,
    sunIntensity: 2.45,
    sunDir: [0.72, 0.34, 0.38],
    exposure: 1.18
};
