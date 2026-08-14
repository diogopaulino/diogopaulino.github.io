/**
 * Forrest Run — constantes, biomas da travessia e presets.
 *
 * Distância em metros de cena. A HUD mostra milhas (1 mi = 1609.34 m).
 * Velocidade: Forrest nunca para — v = clamp(v0 + k·s, vMin, vMax).
 * Pulo: y'' = −g, y'(0) = JUMP_VY; aterrissa em y = 0.
 * 3 faixas: x = (lane − 1) · LANE_W, lane ∈ {0,1,2}.
 */

export const STORAGE_KEY = 'forrest-run-v1';

export const ROAD = {
    lanes: 3,
    laneW: 2.45,
    halfWidth: 4.2,
    shoulder: 6.4
};

export const CHUNK = {
    length: 42,
    count: 14
};

/** Física do corredor. Documentado também em player.js. */
export const RUNNER = {
    v0: 11.5,
    vMin: 8.2,
    accelPerMeter: 0.0018,
    gravity: 32,
    jumpVy: 10.4,
    coyote: 0.1,
    jumpBuffer: 0.12,
    laneLerp: 14,
    invuln: 1.55,
    stumbleSlow: 0.62,
    recover: 2.4,
    /** Ciclo de passada: ω = strideHz · 2π · (v / v0). */
    strideHz: 1.35
};

export const FOLLOWERS_AT = 1400;

/** Troca de bioma a cada BIOME_METERS (com blend nos últimos 80 m). */
export const BIOME_METERS = 920;
export const BIOME_BLEND = 80;

/**
 * Cinco trechos da corrida pelos EUA. Cores alimentam céu, névoa, chão e sol.
 * Homagem visual ao filme — sem diálogo literal.
 */
export const BIOMES = [
    {
        id: 'greenbow',
        name: 'Greenbow, Alabama',
        tagline: 'estrada de terra · pés descalços viraram tênis',
        quote: 'Eu só senti vontade de correr.',
        horizon: 0xf3c27a,
        zenith: 0x7eb6e6,
        fog: 0xc5d8b8,
        ground: 0x5d8a38,
        road: 0x8d734c,
        shoulder: 0x6a8f3e,
        sun: 0xffe2a0,
        hemiSky: 0xffe8c4,
        hemiGround: 0x4a6a28,
        scatter: 0xd8ecff,
        rain: false,
        dirt: true
    },
    {
        id: 'highway',
        name: 'Estrada 61',
        tagline: 'asfalto quente · placas e caminhões',
        quote: 'Corri até o oceano. E virei, e continuei.',
        horizon: 0xf0b56a,
        zenith: 0x5aa0d8,
        fog: 0xd4c4a0,
        ground: 0x6b8f3a,
        road: 0x3a3a3c,
        shoulder: 0x8a7a4a,
        sun: 0xffd078,
        hemiSky: 0xffe0b0,
        hemiGround: 0x5a4a28,
        scatter: 0xffe8c8,
        rain: false,
        dirt: false
    },
    {
        id: 'desert',
        name: 'Sudoeste',
        tagline: 'calor, mesas e o silêncio',
        quote: 'Uma senhora perguntou se eu corria pela paz. Eu não sei.',
        horizon: 0xf0a060,
        zenith: 0x6aa8e0,
        fog: 0xe8c8a0,
        ground: 0xc4a06a,
        road: 0x5a5048,
        shoulder: 0xd0b070,
        sun: 0xffc060,
        hemiSky: 0xffd8a8,
        hemiGround: 0xa07840,
        scatter: 0xffe0b8,
        rain: false,
        dirt: false
    },
    {
        id: 'rockies',
        name: 'Montanhas',
        tagline: 'pinheiros, frio e o ar fino',
        quote: 'De Alabama até o mar, e de volta.',
        horizon: 0xc8d8e8,
        zenith: 0x4a78b0,
        fog: 0xb8c8c0,
        ground: 0x3d6a32,
        road: 0x454448,
        shoulder: 0x4a6038,
        sun: 0xf0e8d0,
        hemiSky: 0xd8e8f8,
        hemiGround: 0x2a4a28,
        scatter: 0xe8f0ff,
        rain: false,
        dirt: false
    },
    {
        id: 'rain',
        name: 'A chuva',
        tagline: 'alguém veio até a estrada',
        quote: 'Eu não sei por que saí correndo.',
        horizon: 0x8aa0b0,
        zenith: 0x4a6078,
        fog: 0x7a8a94,
        ground: 0x3a5a32,
        road: 0x2c2c30,
        shoulder: 0x3a4a38,
        sun: 0xc8d0d8,
        hemiSky: 0xa8b8c8,
        hemiGround: 0x243028,
        scatter: 0xc8d8e8,
        rain: true,
        dirt: false
    }
];

export const DIFFICULTY = {
    sunday: {
        id: 'sunday',
        label: 'Domingo',
        blurb: 'Pouco trânsito, muitas penas. Uma corrida para olhar a paisagem.',
        obstacle: 0.55,
        feathers: 1.35,
        lives: 5,
        vMax: 18
    },
    cross: {
        id: 'cross',
        label: 'Campo afora',
        blurb: 'O ritmo certo: faixas, pulos e o pessoal começando a seguir.',
        obstacle: 1,
        feathers: 1,
        lives: 3,
        vMax: 24
    },
    never: {
        id: 'never',
        label: 'Sem parar',
        blurb: 'Caminhões, vacas, chuva. Quase não dá tempo de respirar.',
        obstacle: 1.45,
        feathers: 0.72,
        lives: 2,
        vMax: 30
    }
};

export const QUALITY = {
    low: {
        antialias: false,
        pixelRatio: 1,
        shadows: false,
        drawDistance: 220,
        fogDensity: 0.011,
        chunkProps: 0.5,
        particles: 90,
        followers: 4,
        rain: 220
    },
    medium: {
        antialias: true,
        pixelRatio: 1.5,
        shadows: false,
        drawDistance: 340,
        fogDensity: 0.0076,
        chunkProps: 0.85,
        particles: 180,
        followers: 8,
        rain: 420
    },
    high: {
        antialias: true,
        pixelRatio: 2,
        shadows: true,
        drawDistance: 460,
        fogDensity: 0.0056,
        chunkProps: 1,
        particles: 280,
        followers: 12,
        rain: 700
    }
};

export function biomeAt(distance) {
    const i = Math.floor(Math.max(0, distance) / BIOME_METERS) % BIOMES.length;
    return BIOMES[i];
}

export function biomeBlend(distance) {
    const t = ((distance % BIOME_METERS) + BIOME_METERS) % BIOME_METERS;
    const next = biomeAt(distance + BIOME_METERS);
    const cur = biomeAt(distance);
    const k = t > BIOME_METERS - BIOME_BLEND
        ? (t - (BIOME_METERS - BIOME_BLEND)) / BIOME_BLEND
        : 0;
    return { cur, next, k };
}

export function loadSettings() {
    const fallback = {
        difficulty: 'cross',
        quality: 'auto',
        volume: 70,
        muted: false,
        best: 0
    };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallback;
        return { ...fallback, ...JSON.parse(raw) };
    } catch (err) {
        return fallback;
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            difficulty: settings.difficulty,
            quality: settings.quality,
            volume: settings.volume,
            muted: settings.muted,
            best: settings.best
        }));
    } catch (err) {
        /* private mode */
    }
}
