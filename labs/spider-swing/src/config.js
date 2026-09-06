/**
 * Spider Swing — escala da ilha, física do pêndulo e presets de qualidade.
 * Unidades ≈ metros. Manhattan está comprimida para caber num lab jogável.
 */

export const STORAGE_KEY = 'spider-swing-v1';

export const GRID = {
    cols: 11,
    rows: 22,
    avenue: 44,
    street: 70,
    avenueW: 18,
    streetW: 16
};

export const PHYS = {
    gravity: -42,
    radius: 0.48,
    walk: 12,
    run: 20,
    airControl: 28,
    jump: 16.5,
    swingJump: 16.2,
    maxAir: 110,
    maxSwing: 140,
    dragAir: 0.1,
    dragGround: 10,
    webMax: 125,
    webMin: 6,
    webReel: 44,
    webCooldown: 0.08,
    hangDamp: 0.03,
    bounce: 0.35,
    fallDamage: 28,
    invuln: 1.35
};

export const CAMERA = {
    chase: { dist: 11.0, height: 3.4, look: 0.3, fov: 70 },
    shoulder: { dist: 4.8, height: 2.0, look: 0.4, fov: 75 },
    cinematic: { dist: 18, height: 8.0, look: 0.1, fov: 50 },
    pitchMin: -1.25,
    pitchMax: 0.72,
    mouse: 0.0022
};

export const DIFFICULTY = {
    cruise: {
        id: 'cruise',
        label: 'Passeio',
        blurb: 'Teia longa, pulsos por todo o canyon. Para curtir o skyline.',
        lives: 5,
        webMax: 102,
        pulses: 1.35,
        gravity: -30
    },
    night: {
        id: 'night',
        label: 'Patrulha',
        blurb: 'O ritmo certo: chuva, combos e o pêndulo no ponto.',
        lives: 3,
        webMax: 88,
        pulses: 1,
        gravity: -34
    },
    storm: {
        id: 'storm',
        label: 'Tempestade',
        blurb: 'Vento, teia curta, queda cruel. Encadeie ou caia no rio.',
        lives: 2,
        webMax: 68,
        pulses: 0.75,
        gravity: -40
    }
};

export const QUALITY = {
    low: {
        antialias: false,
        pixelRatio: 1,
        bloom: false,
        shadows: false,
        rain: 380,
        traffic: 24,
        pulses: 24,
        drawDistance: 540,
        fogDensity: 0.0052,
        props: 0.55
    },
    medium: {
        antialias: true,
        pixelRatio: Math.min(1.5, window.devicePixelRatio || 1.5),
        bloom: true,
        shadows: false,
        rain: 780,
        traffic: 42,
        pulses: 34,
        drawDistance: 780,
        fogDensity: 0.0038,
        props: 0.85
    },
    high: {
        antialias: true,
        pixelRatio: Math.min(2, window.devicePixelRatio || 2),
        bloom: true,
        shadows: true,
        rain: 1200,
        traffic: 64,
        pulses: 42,
        drawDistance: 1100,
        fogDensity: 0.0028,
        props: 1
    }
};

export const PALETTE = {
    fog: 0x0a1220,
    zenith: 0x050814,
    horizon: 0xc46a3a,
    ground: 0x1a120e,
    asphalt: 0x12151c,
    window: 0xffc48a,
    moon: 0xc9d6ff,
    web: 0xe8f2ff,
    pulse: 0xf4c15d,
    suit: 0xc41222,
    navy: 0x121826
};

export function loadSettings() {
    const fallback = {
        difficulty: 'night',
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
