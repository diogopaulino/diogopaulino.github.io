/**
 * Nereida — escala do recife, física do voo e presets.
 *
 * Unidades ≈ metros. A arraia segue um spline (a “corrente”) com liberdade
 * lateral; o impulso é um tanque que recarrega e explode em velocidade.
 *
 * Fórmulas (arcade, não Navier–Stokes):
 *   v'     = v + (vAlvo − v) * (1 − exp(−λ * dt))          // amortecimento exp.
 *   vAlvo  = cruise * maré + boost * BOOST_MUL + anelBonus
 *   roll   = damp(roll, −steerX * MAX_BANK, 8, dt)
 *   pitch  = damp(pitch,  steerY * MAX_PITCH, 7, dt)
 *   pos   += forward * v * dt
 *   erro   = pos − path(s);  se |erro| > corredor, puxa com k * (1 − rMax/|erro|)
 *   combo  = min(12, combo + 1) ao atravessar anel; decai se dtGap > COMBO_WINDOW
 *   score  += pérola * 40 * combo + anel * 80 * combo + pirueta * 120
 */

export const STORAGE_KEY = 'nereida-v1';

export const COURSE = {
    length: 520,
    /** Raio do corredor mole em torno do spline. */
    corridor: 16,
    /** Amostragem do spline para câmera e corrente (m). */
    sample: 0.85
};

export const PHYS = {
    cruise: 18,
    maxSpeed: 46,
    boostMul: 1.85,
    boostCost: 0.38,
    boostRegen: 0.22,
    steer: 1.55,
    maxBank: 0.72,
    maxPitch: 0.48,
    railK: 3.4,
    dragLambda: 2.6,
    radius: 1.15,
    invuln: 1.25,
    comboWindow: 2.4,
    rollDuration: 0.72,
    hitSlow: 0.55
};

export const CAMERA = {
    chase: { dist: 9.2, height: 3.1, look: 4.8, fov: 62 },
    shoulder: { dist: 5.4, height: 1.8, look: 5.2, fov: 72 },
    cinematic: { dist: 16, height: 6.2, look: 3.2, fov: 52 },
    mouse: 0.0024
};

export const DIFFICULTY = {
    lagoon: {
        id: 'lagoon',
        label: 'Lagoa',
        blurb: 'Corrente mansa, corredor largo, pérolas à vontade. Para flanar.',
        lives: 5,
        speed: 0.84,
        corridor: 19,
        pearls: 1.25,
        jellies: 0.65
    },
    tide: {
        id: 'tide',
        label: 'Maré',
        blurb: 'O ritmo certo: anéis no ponto, a baleia no meio, o templo no fim.',
        lives: 3,
        speed: 1,
        corridor: 16,
        pearls: 1,
        jellies: 1
    },
    abyss: {
        id: 'abyss',
        label: 'Abismo',
        blurb: 'Corrente cruel, corredor estreito. Encadeie ou a escuridão te come.',
        lives: 2,
        speed: 1.22,
        corridor: 12.5,
        pearls: 0.85,
        jellies: 1.35
    }
};

export const QUALITY = {
    low: {
        antialias: false,
        pixelRatio: 1,
        bloom: false,
        shadows: false,
        caustics: false,
        fish: 48,
        coral: 70,
        kelp: 40,
        bubbles: 50,
        rays: 4
    },
    medium: {
        antialias: true,
        pixelRatio: 1.35,
        bloom: true,
        shadows: true,
        caustics: true,
        fish: 110,
        coral: 130,
        kelp: 70,
        bubbles: 90,
        rays: 8
    },
    high: {
        antialias: true,
        pixelRatio: 1.7,
        bloom: true,
        shadows: true,
        caustics: true,
        fish: 180,
        coral: 190,
        kelp: 110,
        bubbles: 140,
        rays: 12
    }
};

export const PALETTE = {
    abyss: 0x02141c,
    fog: 0x053445,
    lumen: 0x5ef0d8,
    pearl: 0xf4d9a6,
    coral: 0xff7a8a,
    sand: 0xc4a574,
    kelp: 0x1f6b4a
};

export const ZONES = [
    { t: 0, name: 'Jardim de coral', fog: 0.016, tint: 0x0a5a62 },
    { t: 0.28, name: 'Nau partida', fog: 0.02, tint: 0x063048 },
    { t: 0.58, name: 'Catedral de lúmen', fog: 0.024, tint: 0x1a1848 },
    { t: 0.88, name: 'Templo náutilo', fog: 0.018, tint: 0x06283a }
];

export function loadSettings() {
    try {
        return {
            quality: 'auto',
            volume: 70,
            muted: false,
            difficulty: 'tide',
            best: 0,
            ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
        };
    } catch {
        return { quality: 'auto', volume: 70, muted: false, difficulty: 'tide', best: 0 };
    }
}

export function saveSettings(s) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
        /* private mode */
    }
}
