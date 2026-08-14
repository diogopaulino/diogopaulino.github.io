/**
 * Armilla — musica universalis.
 *
 * Cada anel é um sequenciador circular de 16 passos.
 * Uma volta no anel 1× equivale a um compasso de 16 semicolcheias:
 *   período(s) = 16 × (60 / bpm / 4) = 240 / bpm
 *
 * Anéis mais graves orbitam mais devagar (como planetas),
 * gerando polirritmia entre as esferas.
 */

export const STEPS = 16;
export const TWO_PI = Math.PI * 2;
export const STEP_ANGLE = TWO_PI / STEPS;

export const ROOTS = {
    C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
};

export const ROOT_NAMES = Object.keys(ROOTS);

/** Intervalos em semitons a partir da tônica. */
export const SCALES = {
    pentatonic: [0, 2, 4, 7, 9],
    major: [0, 2, 4, 5, 7, 9, 11],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    minor: [0, 2, 3, 5, 7, 8, 10]
};

export const SCALE_LABELS = {
    pentatonic: 'Pentatônica',
    major: 'Jônia',
    dorian: 'Dórica',
    phrygian: 'Frígia',
    mixolydian: 'Mixolídia',
    minor: 'Eólia'
};

export const RING_DEFS = [
    {
        id: 'bass',
        name: 'Núcleo',
        role: 'Baixo',
        color: '#ffb14a',
        radius: 2.15,
        tube: 0.028,
        tilt: [0.12, 0.04, 0],
        speed: 0.5,
        baseMidi: 33,
        spread: 0
    },
    {
        id: 'harmony',
        name: 'Aura',
        role: 'Harmonia',
        color: '#c084fc',
        radius: 2.95,
        tube: 0.024,
        tilt: [0.62, 0.18, 0.22],
        speed: 1,
        baseMidi: 48,
        spread: 0
    },
    {
        id: 'melody',
        name: 'Órbita',
        role: 'Melodia',
        color: '#7dd3fc',
        radius: 3.75,
        tube: 0.022,
        tilt: [1.12, -0.42, 0.55],
        speed: 1,
        baseMidi: 60,
        spread: 1
    },
    {
        id: 'sparkle',
        name: 'Cintila',
        role: 'Brilho',
        color: '#f9a8d4',
        radius: 4.55,
        tube: 0.018,
        tilt: [1.48, 0.72, -0.28],
        speed: 2,
        baseMidi: 72,
        spread: 1
    }
];

function p(...hits) {
    const out = new Array(STEPS).fill(0);
    hits.forEach((i) => {
        out[i] = 1;
    });
    return out;
}

export const PRESETS = [
    {
        id: 'vesper',
        name: 'Vésper',
        tag: 'Entardecer pentatônico',
        scale: 'pentatonic',
        root: 'E',
        bpm: 72,
        rings: [
            p(0, 4, 8, 12, 14),
            p(0, 3, 6, 8, 11, 14),
            p(2, 5, 7, 10, 13, 15),
            p(1, 3, 6, 9, 11, 14)
        ]
    },
    {
        id: 'orbits',
        name: 'Órbitas',
        tag: 'Jônia em movimento',
        scale: 'major',
        root: 'C',
        bpm: 96,
        rings: [
            p(0, 4, 8, 10, 12),
            p(0, 2, 4, 7, 8, 11, 14),
            p(1, 4, 6, 9, 12, 15),
            p(3, 5, 7, 11, 13)
        ]
    },
    {
        id: 'phrygian',
        name: 'Frígio',
        tag: 'Crepúsculo modal',
        scale: 'phrygian',
        root: 'D',
        bpm: 84,
        rings: [
            p(0, 6, 8, 14),
            p(0, 3, 5, 8, 12, 15),
            p(2, 4, 7, 11, 13),
            p(1, 5, 9, 10, 14)
        ]
    },
    {
        id: 'nebula',
        name: 'Nébula',
        tag: 'Dórica rarefeita',
        scale: 'dorian',
        root: 'A',
        bpm: 68,
        rings: [
            p(0, 8, 12),
            p(0, 4, 7, 11),
            p(3, 6, 10, 14),
            p(2, 5, 9, 13, 15)
        ]
    },
    {
        id: 'aurora',
        name: 'Aurora',
        tag: 'Mixolídia clara',
        scale: 'mixolydian',
        root: 'G',
        bpm: 108,
        rings: [
            p(0, 3, 4, 8, 12),
            p(0, 2, 5, 8, 10, 13),
            p(1, 3, 6, 7, 11, 14),
            p(0, 2, 4, 8, 10, 12, 15)
        ]
    },
    {
        id: 'void',
        name: 'Vazio',
        tag: 'Esferas em silêncio',
        scale: 'pentatonic',
        root: 'C',
        bpm: 80,
        rings: [
            p(),
            p(),
            p(),
            p()
        ]
    }
];

export const STORAGE_KEY = 'armilla-v1';

export function midiToFreq(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
}

export function noteName(midi) {
    const names = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    const n = ((Math.round(midi) % 12) + 12) % 12;
    const oct = Math.floor(Math.round(midi) / 12) - 1;
    return `${names[n]}${oct}`;
}

/**
 * Mapeia um passo do anel para MIDI.
 * O círculo sobe a escala e desce no caminho de volta,
 * para que notas opostas se atraiam harmonicamente.
 */
export function pitchFor(ringDef, step, scaleId, rootName) {
    const scale = SCALES[scaleId] || SCALES.pentatonic;
    const root = ROOTS[rootName] ?? 0;
    const n = scale.length;
    const cycle = Math.max(1, n * 2 - 2);
    const k = step % cycle;
    const idx = k < n ? k : cycle - k;
    const bump = ringDef.spread ? Math.floor(step / n) % 2 : 0;
    return ringDef.baseMidi + root + scale[idx] + bump * 12;
}

export function clonePattern(rings) {
    return rings.map((row) => row.slice());
}

export function randomPattern() {
    const densities = [0.28, 0.38, 0.34, 0.42];
    return densities.map((d) =>
        Array.from({ length: STEPS }, () => (Math.random() < d ? 1 : 0))
    );
}

export function emptyPattern() {
    return RING_DEFS.map(() => new Array(STEPS).fill(0));
}
