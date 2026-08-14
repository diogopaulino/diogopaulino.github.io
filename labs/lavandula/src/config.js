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
        lavender: 2800,
        wheat: 400,
        trees: 0.5,
        particles: 80,
        birds: 4,
        terrainSegments: 72,
        drawDistance: 220
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.4,
        antialias: true,
        shadows: true,
        shadowSize: 1024,
        lavender: 7200,
        wheat: 900,
        trees: 0.8,
        particles: 180,
        birds: 7,
        terrainSegments: 110,
        drawDistance: 320
    },
    high: {
        id: 'high',
        pixelRatio: 1.75,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        lavender: 12000,
        wheat: 1400,
        trees: 1,
        particles: 280,
        birds: 10,
        terrainSegments: 148,
        drawDistance: 420
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
    clear: 0xf2c8a0,
    fog: 0xe8c4b0,
    fogNear: 28,
    fogFar: 210,
    ambient: 0xffe0c4,
    ambientIntensity: 0.42,
    hemiSky: 0xffd4a8,
    hemiGround: 0x7a5488,
    hemiIntensity: 0.72,
    sun: 0xffc078,
    sunIntensity: 2.15,
    sunDir: [0.62, 0.28, 0.42],
    exposure: 1.08
};
