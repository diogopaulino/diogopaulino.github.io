/**
 * Forrest Run — constantes, biomas da travessia e presets de renderização Babylon.js.
 *
 * Distância em metros de cena. A HUD mostra milhas (1 mi = 1609.34 m).
 * Velocidade: Forrest nunca para — v = clamp(v0 + k·s, vMin, vMax).
 * Pulo: y'' = −g, y'(0) = JUMP_VY; aterrissa em y = 0.
 * 3 faixas: x = (lane − 1) · LANE_W, lane ∈ {0,1,2}.
 */

export const STORAGE_KEY = 'forrest-run-babylon-v2';

export const ROAD = {
    lanes: 3,
    laneW: 2.6,
    halfWidth: 4.6,
    shoulder: 7.2
};

export const CHUNK = {
    length: 46,
    count: 14
};

/** Física e cinemática do corredor. */
export const RUNNER = {
    v0: 12.0,
    vMin: 8.5,
    accelPerMeter: 0.0018,
    gravity: 34,
    jumpVy: 11.2,
    coyote: 0.12,
    jumpBuffer: 0.15,
    laneLerp: 16,
    invuln: 1.6,
    stumbleSlow: 0.65,
    recover: 2.5,
    /** Ciclo de passada: ω = strideHz · 2π · (v / v0). */
    strideHz: 1.4
};

export const FOLLOWERS_AT = 1400;

/** Troca de bioma a cada BIOME_METERS (com blend nos últimos 100 m). */
export const BIOME_METERS = 960;
export const BIOME_BLEND = 100;

/**
 * Cinco trechos icônicos da corrida cinematográfica de Forrest.
 * Cores ricas PBR para céu, iluminação solar, névoa atmosférica e chão.
 */
export const BIOMES = [
    {
        id: 'greenbow',
        name: 'Greenbow, Alabama',
        tagline: 'estrada de terra · pés descalços viraram tênis',
        quote: 'Eu só senti vontade de correr.',
        horizon: 0xf3c27a,
        zenith: 0x6ca6dc,
        fog: 0xc4d8b8,
        ground: 0x4f7d2f,
        road: 0x8a6d46,
        shoulder: 0x628838,
        sun: 0xffdf99,
        sunIntensity: 2.2,
        hemiSky: 0xffe2b8,
        hemiGround: 0x3d5c22,
        hemiIntensity: 1.1,
        bloomWeight: 0.35,
        rain: false,
        dirt: true,
        wetRoughness: 0.9
    },
    {
        id: 'highway',
        name: 'Estrada 61',
        tagline: 'asfalto quente · placas e caminhões',
        quote: 'Corri até o oceano. E virei, e continuei.',
        horizon: 0xf0b56a,
        zenith: 0x4a94d4,
        fog: 0xd2c09c,
        ground: 0x5e8234,
        road: 0x2e2f33,
        shoulder: 0x807044,
        sun: 0xffce70,
        sunIntensity: 2.5,
        hemiSky: 0xffdcab,
        hemiGround: 0x4d3e20,
        hemiIntensity: 1.15,
        bloomWeight: 0.45,
        rain: false,
        dirt: false,
        wetRoughness: 0.75
    },
    {
        id: 'desert',
        name: 'Sudoeste',
        tagline: 'calor, mesas e o silêncio',
        quote: 'Uma senhora perguntou se eu corria pela paz. Eu não sei.',
        horizon: 0xf29f5c,
        zenith: 0x569ee0,
        fog: 0xe6c49c,
        ground: 0xc29c66,
        road: 0x524840,
        shoulder: 0xcca86c,
        sun: 0xffba54,
        sunIntensity: 2.8,
        hemiSky: 0xffd29f,
        hemiGround: 0x946e38,
        hemiIntensity: 1.2,
        bloomWeight: 0.55,
        rain: false,
        dirt: false,
        wetRoughness: 0.85
    },
    {
        id: 'rockies',
        name: 'Montanhas',
        tagline: 'pinheiros, frio e o ar fino',
        quote: 'De Alabama até o mar, e de volta.',
        horizon: 0xc4d4e6,
        zenith: 0x3d70a8,
        fog: 0xb4c4be,
        ground: 0x365f2b,
        road: 0x3d3c40,
        shoulder: 0x425632,
        sun: 0xede4cc,
        sunIntensity: 2.1,
        hemiSky: 0xd2e4f6,
        hemiGround: 0x223d20,
        hemiIntensity: 1.0,
        bloomWeight: 0.3,
        rain: false,
        dirt: false,
        wetRoughness: 0.8
    },
    {
        id: 'rain',
        name: 'A chuva',
        tagline: 'alguém veio até a estrada',
        quote: 'Eu não sei por que saí correndo.',
        horizon: 0x8298a8,
        zenith: 0x3c5268,
        fog: 0x72828c,
        ground: 0x2e4a28,
        road: 0x1f2024,
        shoulder: 0x303e30,
        sun: 0xb8c4cc,
        sunIntensity: 1.3,
        hemiSky: 0x98a8b8,
        hemiGround: 0x1c2620,
        hemiIntensity: 0.9,
        bloomWeight: 0.25,
        rain: true,
        dirt: false,
        wetRoughness: 0.2
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
        vMax: 19
    },
    cross: {
        id: 'cross',
        label: 'Campo afora',
        blurb: 'O ritmo certo: faixas, pulos e o pessoal começando a seguir.',
        obstacle: 1.0,
        feathers: 1.0,
        lives: 3,
        vMax: 25
    },
    never: {
        id: 'never',
        label: 'Sem parar',
        blurb: 'Caminhões, vacas, chuva. Quase não dá tempo de respirar.',
        obstacle: 1.45,
        feathers: 0.72,
        lives: 2,
        vMax: 31
    }
};

export const QUALITY = {
    low: {
        antialias: false,
        pixelRatio: 1,
        shadows: false,
        bloom: false,
        drawDistance: 240,
        fogDensity: 0.010,
        chunkProps: 0.6,
        particles: 120,
        followers: 4,
        rain: 260
    },
    medium: {
        antialias: true,
        pixelRatio: 1.5,
        shadows: true,
        shadowMapSize: 1024,
        bloom: true,
        drawDistance: 380,
        fogDensity: 0.0072,
        chunkProps: 0.9,
        particles: 240,
        followers: 8,
        rain: 500
    },
    high: {
        antialias: true,
        pixelRatio: 2,
        shadows: true,
        shadowMapSize: 2048,
        bloom: true,
        drawDistance: 520,
        fogDensity: 0.0052,
        chunkProps: 1.15,
        particles: 400,
        followers: 14,
        rain: 800
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
