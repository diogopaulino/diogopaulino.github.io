/**
 * Neon Rider — constantes, paletas (estações de rádio) e presets de qualidade.
 * A cidade inteira retuna as cores quando o jogador coleta uma fita VHS.
 */

export const STORAGE_KEY = 'neon-rider-v1';

export const ROAD = {
    laneWidth: 3.6,
    lanes: 4,
    halfWidth: 7.4,
    curb: 8.6,
    buildingGap: 11.2
};

export const CHUNK = {
    length: 52,
    count: 14
};

export const BIKE = {
    accel: 28,
    brake: 38,
    coast: 8,
    maxSpeed: 62,
    boostSpeed: 86,
    steer: 22,
    grip: 9.5,
    lean: 0.42
};

/** Estações: cada fita troca o "broadcast" da cidade (néon + rádio). Sem astros. */
export const STATIONS = [
    {
        id: 'wave',
        name: 'WAVE 84',
        tagline: 'synth · meia-noite',
        neonA: 0xff2bd6,
        neonB: 0x00f0ff,
        fog: 0x14081f,
        horizon: 0xff3eb5,
        zenith: 0x06010c,
        ground: 0x04020a,
        asphalt: 0x12101c,
        window: 0xffc4a0,
        lamp: 0xffe7b0
    },
    {
        id: 'vhs',
        name: 'VHS FM',
        tagline: 'chroma · tracking',
        neonA: 0xff6a00,
        neonB: 0xffd428,
        fog: 0x1a0c08,
        horizon: 0xff7a28,
        zenith: 0x0c0604,
        ground: 0x0a0402,
        asphalt: 0x1a1210,
        window: 0xffd9a0,
        lamp: 0xffcc77
    },
    {
        id: 'arcade',
        name: 'ARCADE AM',
        tagline: 'fósforo · 1-up',
        neonA: 0x39ff14,
        neonB: 0x00ffe0,
        fog: 0x04140c,
        horizon: 0x2dff9a,
        zenith: 0x020a08,
        ground: 0x02100a,
        asphalt: 0x0c1412,
        window: 0xc8ffd4,
        lamp: 0xe8ffc8
    },
    {
        id: 'disco',
        name: 'DISCO 12',
        tagline: 'esfera · glitter',
        neonA: 0xff3ea5,
        neonB: 0x7a5cff,
        fog: 0x12081c,
        horizon: 0xff5ad5,
        zenith: 0x080414,
        ground: 0x060310,
        asphalt: 0x141018,
        window: 0xffd0ff,
        lamp: 0xf0d0ff
    }
];

export const DIFFICULTY = {
    cruise: {
        id: 'cruise',
        label: 'Passeio',
        blurb: 'Trânsito leve, fitas por toda a avenida. Para curtir o néon.',
        traffic: 0.55,
        trafficSpeed: 0.42,
        tapes: 1.35,
        lives: 5,
        maxSpeed: 54
    },
    night: {
        id: 'night',
        label: 'Madrugada',
        blurb: 'Avenida cheia, táxis surpresa e boost curto. O ritmo certo.',
        traffic: 1,
        trafficSpeed: 0.58,
        tapes: 1,
        lives: 3,
        maxSpeed: 66
    },
    turbo: {
        id: 'turbo',
        label: 'Turbo',
        blurb: 'Nitro permanente, trânsito agressivo. Uma fita errada e acabou.',
        traffic: 1.45,
        trafficSpeed: 0.78,
        tapes: 0.75,
        lives: 2,
        maxSpeed: 84
    }
};

export const QUALITY = {
    low: {
        antialias: false,
        pixelRatio: 1,
        bloom: false,
        shadows: false,
        lamps: 0,
        drawDistance: 220,
        fogDensity: 0.012,
        chunkProps: 0.55,
        particles: 80
    },
    medium: {
        antialias: true,
        pixelRatio: 1.5,
        bloom: true,
        shadows: false,
        lamps: 4,
        drawDistance: 320,
        fogDensity: 0.0085,
        chunkProps: 0.85,
        particles: 180
    },
    high: {
        antialias: true,
        pixelRatio: 2,
        bloom: true,
        shadows: true,
        lamps: 8,
        drawDistance: 420,
        fogDensity: 0.0064,
        chunkProps: 1,
        particles: 280
    }
};

export function loadSettings() {
    const fallback = {
        difficulty: 'night',
        quality: 'auto',
        volume: 72,
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
