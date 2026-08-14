/**
 * Aurelia — constantes, paletas por profundidade e presets de qualidade.
 * A cidade submersa muda de cor conforme o mergulho: rasa, crepúsculo, abismo.
 */

export const STORAGE_KEY = 'aurelia-v1';

export const PLAY = {
    halfWidth: 16,
    yMin: 2.4,
    yMax: 22,
    chunkLength: 72,
    chunkCount: 9,
    radius: 0.95
};

export const SWIM = {
    baseSpeed: 16,
    pulseSpeed: 38,
    sink: 3.2,
    steer: 1.85,
    mouse: 0.0024,
    pulseCooldown: 0.32,
    pulseDuration: 0.46,
    magnet: 5.4,
    shockwave: 9.2
};

export const DEPTHS = [
    {
        id: 'shoal',
        name: 'Rasa',
        from: 0,
        fog: 0x083044,
        zenith: 0x041018,
        horizon: 0x1ad4c8,
        sand: 0xc4a06a,
        stone: 0x5a6e72,
        glowA: 0x5cf6ff,
        glowB: 0xff8ad4,
        jelly: 0xff7ec8,
        ambient: 0x1a6a78,
        sun: 0xb8fff4
    },
    {
        id: 'twilight',
        name: 'Crepúsculo',
        from: 420,
        fog: 0x0a1838,
        zenith: 0x030814,
        horizon: 0x6a7cff,
        sand: 0x6e5a48,
        stone: 0x3e4a62,
        glowA: 0x88a8ff,
        glowB: 0xff6ad8,
        jelly: 0xe878ff,
        ambient: 0x243878,
        sun: 0x9ab0ff
    },
    {
        id: 'abyss',
        name: 'Abismo',
        from: 1100,
        fog: 0x060412,
        zenith: 0x020108,
        horizon: 0xff5ac8,
        sand: 0x2a2430,
        stone: 0x2a2238,
        glowA: 0xffd36a,
        glowB: 0xff4ec8,
        jelly: 0xffc878,
        ambient: 0x3a1860,
        sun: 0xff88c8
    }
];

export const DIFFICULTY = {
    calm: {
        id: 'calm',
        label: 'Calmaria',
        blurb: 'Corrente suave, mais lúmens, predadores distraídos. Bom para flanar.',
        speed: 0.86,
        orbs: 1.35,
        hazards: 0.55,
        damage: 0.75
    },
    tide: {
        id: 'tide',
        label: 'Maré',
        blurb: 'O ritmo certo. Anéis, enguias e o pulso da medusa no tempo da música.',
        speed: 1,
        orbs: 1,
        hazards: 1,
        damage: 1
    },
    abyss: {
        id: 'abyss',
        label: 'Abismo',
        blurb: 'Mais fundo, mais rápido. A cidade aperta e as enguias caçam de verdade.',
        speed: 1.22,
        orbs: 0.85,
        hazards: 1.45,
        damage: 1.25
    }
};

export const QUALITY = {
    low: {
        id: 'low',
        antialias: false,
        pixelRatio: 1,
        bloom: false,
        particles: 280,
        plankton: 420,
        kelp: 10,
        rays: 3,
        fish: 6,
        shadows: false
    },
    medium: {
        id: 'medium',
        antialias: false,
        pixelRatio: 1.35,
        bloom: true,
        particles: 520,
        plankton: 900,
        kelp: 16,
        rays: 5,
        fish: 10,
        shadows: false
    },
    high: {
        id: 'high',
        antialias: true,
        pixelRatio: 1.75,
        bloom: true,
        particles: 900,
        plankton: 1600,
        kelp: 22,
        rays: 7,
        fish: 14,
        shadows: false
    }
};

export function depthPalette(meters) {
    let pal = DEPTHS[0];
    for (let i = 0; i < DEPTHS.length; i++) {
        if (meters >= DEPTHS[i].from) pal = DEPTHS[i];
    }
    return pal;
}

export function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaults();
        return { ...defaults(), ...JSON.parse(raw) };
    } catch (err) {
        return defaults();
    }
}

export function saveSettings(s) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            quality: s.quality,
            volume: s.volume,
            difficulty: s.difficulty,
            muted: s.muted,
            best: s.best
        }));
    } catch (err) {
        /* private mode */
    }
}

function defaults() {
    return {
        quality: 'auto',
        volume: 74,
        difficulty: 'tide',
        muted: false,
        best: 0
    };
}
