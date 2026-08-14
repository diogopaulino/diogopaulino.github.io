/**
 * Vector Fighter — dados de roster, palcos, golpes e qualidade.
 *
 * O sistema de frames é em segundos (não em 60 fps fixos): startup, active
 * e recovery somam a duração do golpe. Dano é em pontos de vida (base 100).
 */

export const STORAGE_KEY = 'vector-fighter-v1';

export const RING_RADIUS = 7.15;
export const ROUND_TIME = 60;
export const ROUNDS_TO_WIN = 2;
export const GRAVITY = 28;
export const FIGHTER_RADIUS = 0.42;

export const QUALITY = {
    low: { antialias: false, pixelRatio: 1, shadows: false, edges: false, extras: 0.45, particles: 24 },
    medium: { antialias: true, pixelRatio: 1.5, shadows: true, edges: true, extras: 0.75, particles: 48 },
    high: { antialias: true, pixelRatio: 2, shadows: true, edges: true, extras: 1, particles: 72 }
};

export const DIFFICULTY = {
    easy: { label: 'Iniciante', think: 0.38, block: 0.18, aggro: 0.42, error: 0.32 },
    normal: { label: 'Arcade', think: 0.2, block: 0.38, aggro: 0.62, error: 0.14 },
    hard: { label: 'Juiz', think: 0.1, block: 0.55, aggro: 0.82, error: 0.05 }
};

/**
 * Golpes. `reach` soma ao raio da esfera no membro atacante.
 * Sweep atravessa guarda (baixo); throw é imbloqueável à queima-roupa.
 */
export const MOVES = {
    punch: {
        duration: 0.4,
        startup: 0.09,
        active: 0.11,
        damage: 9,
        stun: 0.34,
        push: 0.62,
        hitstop: 0.055,
        limb: 'rHand',
        reach: 0.38,
        type: 'high',
        knockdown: false,
        cancel: true
    },
    kick: {
        duration: 0.56,
        startup: 0.15,
        active: 0.13,
        damage: 14,
        stun: 0.44,
        push: 0.92,
        hitstop: 0.075,
        limb: 'rFoot',
        reach: 0.48,
        type: 'mid',
        knockdown: false,
        cancel: false
    },
    sweep: {
        duration: 0.68,
        startup: 0.2,
        active: 0.14,
        damage: 12,
        stun: 0.22,
        push: 0.5,
        hitstop: 0.07,
        limb: 'rFoot',
        reach: 0.52,
        type: 'low',
        knockdown: true,
        cancel: false
    },
    throw: {
        duration: 0.82,
        startup: 0.07,
        active: 0.12,
        damage: 18,
        stun: 0,
        push: 0,
        hitstop: 0.1,
        limb: 'lHand',
        reach: 0.28,
        type: 'throw',
        knockdown: true,
        cancel: false,
        maxRange: 1.18
    }
};

export const FIGHTERS = [
    {
        id: 'ren',
        name: 'REN',
        full: 'Ren Hayashi',
        style: 'Karatê',
        country: 'Japão',
        blurb: 'Postura clássica, socos secos. O anel é o tatame.',
        stats: { speed: 1.02, power: 1.05, reach: 1, bulk: 1, hp: 100 },
        palette: {
            skin: 0xe8c4a4,
            hair: 0x1a1412,
            primary: 0xf4f0ea,
            secondary: 0xc41e3a,
            accent: 0x1a1412,
            shoes: 0xf4f0ea
        },
        look: { hair: 'short', gear: 'gi', brow: 0.08 }
    },
    {
        id: 'sofia',
        name: 'SOFIA',
        full: 'Sofia Reed',
        style: 'Kickboxing',
        country: 'EUA',
        blurb: 'Chutes longos e pé na frente. Não deixa respirar.',
        stats: { speed: 1.14, power: 0.94, reach: 1.08, bulk: 0.92, hp: 96 },
        palette: {
            skin: 0xf0c9ae,
            hair: 0xe8c56b,
            primary: 0x1aa6a6,
            secondary: 0x0e2a32,
            accent: 0xf2d38a,
            shoes: 0x0e2a32
        },
        look: { hair: 'pony', gear: 'sport', brow: -0.02 }
    },
    {
        id: 'viktor',
        name: 'VIKTOR',
        full: 'Viktor Volk',
        style: 'Luta livre',
        country: 'Rússia',
        blurb: 'Peso-pesado. Se encostar, o chão é o destino.',
        stats: { speed: 0.82, power: 1.28, reach: 0.96, bulk: 1.22, hp: 118 },
        palette: {
            skin: 0xd4a07a,
            hair: 0x3a2418,
            primary: 0xe24a1c,
            secondary: 0x1c120e,
            accent: 0xf0d090,
            shoes: 0x1c120e
        },
        look: { hair: 'bald', gear: 'wrestler', brow: 0.14 }
    },
    {
        id: 'mei',
        name: 'MEI',
        full: 'Mei Lin',
        style: 'Kung fu',
        country: 'China',
        blurb: 'Ritmo de contragolpe. Entra, corta, some.',
        stats: { speed: 1.1, power: 0.98, reach: 1.02, bulk: 0.9, hp: 98 },
        palette: {
            skin: 0xe2b896,
            hair: 0x140c0a,
            primary: 0xa81c28,
            secondary: 0xf0d48a,
            accent: 0x2a0c12,
            shoes: 0x2a0c12
        },
        look: { hair: 'buns', gear: 'silk', brow: 0.02 }
    },
    {
        id: 'kai',
        name: 'KAI',
        full: 'Kai Noctis',
        style: 'Ninjutsu',
        country: 'Japão',
        blurb: 'Dash, baixa e some do ring. A sombra também luta.',
        stats: { speed: 1.2, power: 0.9, reach: 0.98, bulk: 0.88, hp: 94 },
        palette: {
            skin: 0xc9a07e,
            hair: 0x0c0a12,
            primary: 0x1a1428,
            secondary: 0x5b2d9a,
            accent: 0xc9a24a,
            shoes: 0x0c0a12
        },
        look: { hair: 'mask', gear: 'ninja', brow: 0.04 }
    },
    {
        id: 'rex',
        name: 'REX',
        full: 'Rex Cole',
        style: 'Pancrase',
        country: 'Reino Unido',
        blurb: 'Pressão de boxe militar. O timer é o inimigo dele.',
        stats: { speed: 1.0, power: 1.08, reach: 1.04, bulk: 1.06, hp: 104 },
        palette: {
            skin: 0xe6c2a0,
            hair: 0xc4a056,
            primary: 0x4a5a3a,
            secondary: 0x1c2218,
            accent: 0xc9a24a,
            shoes: 0x1c2218
        },
        look: { hair: 'crop', gear: 'tank', brow: 0.1 }
    }
];

export const STAGES = [
    {
        id: 'dojo',
        name: 'Dojo Noturno',
        tag: 'Honra · lua cheia',
        fog: 0x120818,
        skyTop: 0x241436,
        skyBot: 0x08040e,
        ambient: 0x4a3060,
        hemiSky: 0x8868a8,
        hemiGround: 0x2a1820,
        sun: 0xffd0b0,
        sunDir: [5.5, 11, 4.2],
        fill: 0x6a80c8,
        accent: 0xc41e3a,
        floor: 'wood'
    },
    {
        id: 'marina',
        name: 'Marina 93',
        tag: 'Pôr do sol · mar',
        fog: 0x6a3828,
        skyTop: 0xff7a42,
        skyBot: 0x1a0c20,
        ambient: 0x8a5040,
        hemiSky: 0xffb080,
        hemiGround: 0x4a2018,
        sun: 0xffc080,
        sunDir: [-6, 8, 5],
        fill: 0x4080c8,
        accent: 0xff6a2a,
        floor: 'stone'
    },
    {
        id: 'coliseum',
        name: 'Coliseu Neon',
        tag: 'Cidade · 3 da manhã',
        fog: 0x041018,
        skyTop: 0x0a1c38,
        skyBot: 0x02060e,
        ambient: 0x204060,
        hemiSky: 0x3a80c8,
        hemiGround: 0x081018,
        sun: 0xe8f0ff,
        sunDir: [2, 14, -6],
        fill: 0xff2a6a,
        accent: 0x2ee6ff,
        floor: 'neon'
    }
];

export function fighterById(id) {
    return FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];
}

export function stageById(id) {
    return STAGES.find((s) => s.id === id) || STAGES[0];
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

export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
        /* ignore */
    }
}

function defaults() {
    return {
        quality: 'auto',
        volume: 0.7,
        difficulty: 'normal',
        p1: 'ren',
        cpu: 'sofia',
        stage: 'dojo',
        wins: 0
    };
}
