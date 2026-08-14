/**
 * Silkline — escala da ilha, física do pêndulo e presets de qualidade.
 * Unidades ≈ metros. Manhattan está comprimida para caber num lab jogável.
 */

export const STORAGE_KEY = 'silkline-v1';

export const GRID = {
    cols: 11,
    rows: 22,
    avenue: 44,
    street: 70,
    avenueW: 18,
    streetW: 16
};

export const PHYS = {
    gravity: -34,
    radius: 0.48,
    walk: 11,
    run: 16,
    airControl: 18,
    jump: 13.5,
    swingJump: 9.2,
    maxAir: 78,
    maxSwing: 92,
    dragAir: 0.18,
    dragGround: 8,
    webMax: 88,
    webMin: 7,
    webReel: 26,
    webCooldown: 0.12,
    hangDamp: 0.08,
    bounce: 0.28,
    fallDamage: 28,
    invuln: 1.35
};

export const CAMERA = {
    chase: { dist: 7.4, height: 5.2, look: 0.15, fov: 64 },
    shoulder: { dist: 4.8, height: 2.4, look: 0.35, fov: 70 },
    cinematic: { dist: 13.5, height: 6.2, look: -0.1, fov: 54 },
    pitchMin: -1.15,
    pitchMax: 0.62,
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
        rain: 280,
        traffic: 18,
        pulses: 18,
        drawDistance: 420,
        fogDensity: 0.0062,
        props: 0.45
    },
    medium: {
        antialias: true,
        pixelRatio: 1.5,
        bloom: true,
        shadows: false,
        rain: 620,
        traffic: 32,
        pulses: 28,
        drawDistance: 620,
        fogDensity: 0.0044,
        props: 0.75
    },
    high: {
        antialias: true,
        pixelRatio: 2,
        bloom: true,
        shadows: true,
        rain: 980,
        traffic: 46,
        pulses: 36,
        drawDistance: 860,
        fogDensity: 0.0032,
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
