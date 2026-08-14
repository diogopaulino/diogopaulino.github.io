/**
 * Eyra — escala do mundo, física do voo e presets de qualidade.
 *
 * Unidades ≈ metros. A ira (fera alada) planeia sempre para a frente;
 * o piloto só escolhe o vetor e o impulso. Arcade, não Navier–Stokes.
 *
 * Fórmulas:
 *   vAlvo  = cruise * (1 + W * 0.9 − S * 0.55) + boost * BOOST_MUL
 *   v'     = v + (vAlvo − v) * (1 − exp(−DRAG * dt))
 *   yaw'   = yaw − (mouseX + A/D) * YAW * (0.5 + v / vmax) * dt
 *   pitch' = clamp(pitch + (mouseY + R/F) * PITCH * dt, −0.82, 0.58)
 *   roll   = damp(roll, −bank * MAX_BANK, 7, dt)
 *   fwd    = (sin(yaw) cos(pitch), sin(pitch), cos(yaw) cos(pitch))
 *   pos   += fwd * v * dt
 *   se |pos − pico| < raio: empurra na normal e v *= HIT_SLOW
 *   combo  += 1 ao atravessar anel; decai se dtGap > COMBO_WINDOW
 *   score  += semente * 400 * combo + anel * 80 * combo
 */

export const STORAGE_KEY = 'eyra-v1';

export const WORLD = {
    radius: 260,
    canopy: 4,
    ceiling: 210,
    fogNear: 40,
    fogFar: 420
};

export const PHYS = {
    cruise: 28,
    maxSpeed: 78,
    boostMul: 1.9,
    boostCost: 0.34,
    boostRegen: 0.18,
    drag: 2.4,
    yaw: 1.35,
    pitch: 1.15,
    maxBank: 0.78,
    minPitch: -0.82,
    maxPitch: 0.58,
    radius: 2.4,
    invuln: 1.05,
    hitSlow: 0.48,
    comboWindow: 3.2,
    rollDuration: 0.78
};

export const CAMERA = {
    dist: 14.5,
    height: 4.2,
    look: 9.5,
    fov: 58,
    fovBoost: 16,
    mouse: 0.0026
};

export const SEEDS = 8;

export const QUALITY = {
    low: {
        antialias: false,
        pixelRatio: 1,
        bloom: false,
        shadows: false,
        trees: 90,
        plants: 40,
        clouds: 10,
        spores: 80,
        peaks: 8
    },
    medium: {
        antialias: true,
        pixelRatio: 1.35,
        bloom: true,
        shadows: true,
        trees: 180,
        plants: 90,
        clouds: 16,
        spores: 140,
        peaks: 11
    },
    high: {
        antialias: true,
        pixelRatio: 1.7,
        bloom: true,
        shadows: true,
        trees: 280,
        plants: 140,
        clouds: 22,
        spores: 220,
        peaks: 13
    }
};

export const PALETTE = {
    abyss: 0x041820,
    fog: 0x1a4a52,
    lumen: 0x5ef0d8,
    gold: 0xffd27a,
    moss: 0x2f6b3a,
    leaf: 0x1f8a4a,
    rock: 0x6a7a6e,
    magenta: 0xd46ad0,
    water: 0x1a8a9a
};

export const ZONES = [
    { y: 0, name: 'Canópia de jade' },
    { y: 48, name: 'Picos de Helion' },
    { y: 96, name: 'Mar de nuvens' },
    { y: 150, name: 'Céu de Eyra' }
];

export function loadSettings() {
    try {
        return {
            quality: 'auto',
            volume: 70,
            muted: false,
            best: 0,
            ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        };
    } catch {
        return { quality: 'auto', volume: 70, muted: false, best: 0 };
    }
}

export function saveSettings(s) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
        /* private mode */
    }
}
