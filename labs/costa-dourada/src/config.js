/**
 * Costa Dourada — constantes e presets de qualidade.
 * GT V8 RWD; bicycle model em vehicle.js.
 */

export const STORAGE_KEY = 'costa-dourada-v1';

export const RACE = {
    laps: 3,
    aiCount: 3,
    countdown: 3
};

export const CAR = {
    mass: 1480,
    wheelbase: 2.65,
    frontAxle: 1.22,
    rearAxle: 1.43,
    cgHeight: 0.48,
    yawInertia: 2400,
    wheelRadius: 0.33,
    trackWidth: 1.68,
    cdA: 0.62,
    clA: 0.85,
    maxPower: 420000,
    brakeForce: 18500,
    maxSteer: 0.52,
    gears: [3.9, 2.55, 1.85, 1.42, 1.12, 0.92, 0.76],
    finalDrive: 4.1,
    idleRpm: 900,
    redline: 9000,
    shiftUpRpm: 8400,
    shiftDownRpm: 4200,
    rolling: 0.015,
    grip: 1.55,
    handbrakeGrip: 0.42
};

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 512,
        oceanSeg: 24,
        treeCount: 28,
        rockCount: 18,
        roadSeg: 180,
        drawDistance: 220,
        fogNear: 40,
        fogFar: 220,
        particles: false
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.25,
        antialias: false,
        shadows: true,
        shadowSize: 1024,
        oceanSeg: 48,
        treeCount: 56,
        rockCount: 36,
        roadSeg: 280,
        drawDistance: 360,
        fogNear: 70,
        fogFar: 360,
        particles: true
    },
    high: {
        id: 'high',
        pixelRatio: 1.6,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        oceanSeg: 72,
        treeCount: 90,
        rockCount: 54,
        roadSeg: 420,
        drawDistance: 520,
        fogNear: 110,
        fogFar: 520,
        particles: true
    }
};

export const PAINTS = [
    { name: 'Rosso', body: 0xc4281c, accent: 0x1a0a08 },
    { name: 'Giallo', body: 0xe8b014, accent: 0x1c1408 },
    { name: 'Bianco', body: 0xe8e4dc, accent: 0x2a2a2c },
    { name: 'Blu', body: 0x1a3a6e, accent: 0x0a1018 }
];

export function loadSettings() {
    const fallback = { quality: 'auto', volume: 70, muted: false, best: null, assists: true };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return fallback;
        return { ...fallback, ...JSON.parse(raw) };
    } catch {
        return fallback;
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            quality: settings.quality,
            volume: settings.volume,
            muted: settings.muted,
            best: settings.best,
            assists: settings.assists
        }));
    } catch { /* private mode */ }
}
