/**
 * Noite de Fúria — regras e fórmulas (espírito Streets of Rage).
 *
 * Plano 2.5D: x ao longo da rua, z a profundidade (mais z = mais ao fundo),
 * y a altura do pulo. Golpes só conectam se |Δz| < HIT_DEPTH.
 *
 * Combate (60 Hz):
 *   combo no chão = 3 jabs + finisher (knockdown)
 *   pulo + ataque = jump kick
 *   especial custa HP (SPECIAL_COST) e dá i-frames
 *   especial na hitstun = especial desesperado (custa +4 HP)
 *   andar de frente contra o inimigo = agarrão; A ajoelha; A+trás arremessa
 *   toque duplo na direção = corrida; ataque correndo = blitz
 *
 * Tokens de agressão: no máximo MAX_ATTACKERS atacam ao mesmo tempo,
 * o resto cerca — o “espaço” clássico do beat 'em up.
 */

export const VW = 1280;
export const VH = 720;

export const GROUND_Y = 560;
export const Z_MIN = -78;
export const Z_MAX = 92;
export const Z_SCALE = 0.62;

export const GRAVITY = 0.62;
export const HIT_DEPTH = 30;
export const GRAB_X = 34;
export const GRAB_Z = 16;
export const MAX_ATTACKERS = 2;
export const START_LIVES = 2;
export const STAGE_TIME = 99;
export const COMBO_WINDOW = 22;
export const GETUP_IFRAMES = 22;
export const HITSTOP_LIGHT = 3;
export const HITSTOP_HEAVY = 7;
export const HITSTOP_SPECIAL = 10;

export const CHARACTERS = {
    frank: {
        id: 'frank',
        name: 'FRANK',
        title: 'A Criatura',
        blurb: 'Tanque. Socos de bigorna, agarrão brutal e tempestade elétrica.',
        specialName: 'TEMPESTADE',
        hp: 128,
        speed: 2.05,
        runSpeed: 3.55,
        jump: 12.4,
        power: 1.28,
        weight: 1.4,
        specialCost: 12,
        special: 'storm',
        color: '#8fb56e',
        accent: '#d7c46a'
    },
    vlad: {
        id: 'vlad',
        name: 'VLAD',
        title: 'O Conde',
        blurb: 'Elegante e cruel. Garras, capa e enxame que drena vida.',
        specialName: 'ENXAME',
        hp: 100,
        speed: 2.55,
        runSpeed: 4.35,
        jump: 13.2,
        power: 1.02,
        weight: 0.92,
        specialCost: 10,
        special: 'swarm',
        color: '#c43b3b',
        accent: '#e8c97a'
    },
    nekro: {
        id: 'nekro',
        name: 'NEKRO',
        title: 'O Condenado',
        blurb: 'Anti-herói do abismo. Correntes vivas e soco que rasga a rua.',
        specialName: 'CORRENTE',
        hp: 108,
        speed: 2.35,
        runSpeed: 4.05,
        jump: 12.8,
        power: 1.1,
        weight: 1.05,
        specialCost: 10,
        special: 'chain',
        color: '#e07a32',
        accent: '#f3ead2'
    },
    lupa: {
        id: 'lupa',
        name: 'LUPA',
        title: 'A Alcateia',
        blurb: 'A mais rápida. Garras em fúria e uivo que atordoa a onda.',
        specialName: 'UIVO',
        hp: 92,
        speed: 2.85,
        runSpeed: 4.7,
        jump: 13.8,
        power: 0.94,
        weight: 0.84,
        specialCost: 8,
        special: 'howl',
        color: '#d4a25a',
        accent: '#f0e0c0'
    }
};

export const CHARACTER_ORDER = ['frank', 'vlad', 'nekro', 'lupa'];

export const ENEMIES = {
    ghoul: {
        name: 'Carniçal',
        hp: 42,
        speed: 1.55,
        power: 0.85,
        score: 200,
        kind: 'ghoul',
        scale: 0.92,
        think: 28
    },
    cultist: {
        name: 'Sectário',
        hp: 50,
        speed: 1.85,
        power: 0.95,
        score: 300,
        kind: 'cultist',
        scale: 0.95,
        think: 22
    },
    brute: {
        name: 'Açougueiro',
        hp: 96,
        speed: 1.15,
        power: 1.25,
        score: 500,
        kind: 'brute',
        scale: 1.18,
        think: 34,
        grabber: true
    },
    gargoyle: {
        name: 'Gárgula',
        hp: 58,
        speed: 2.05,
        power: 1.0,
        score: 400,
        kind: 'gargoyle',
        scale: 0.98,
        think: 18,
        jumper: true
    },
    wight: {
        name: 'Esqueleto',
        hp: 70,
        speed: 1.7,
        power: 1.08,
        score: 450,
        kind: 'wight',
        scale: 1.0,
        think: 24
    }
};

export const BOSSES = {
    imhotep: {
        name: 'IMHOTEP',
        title: 'O Eterno',
        hp: 420,
        speed: 1.45,
        power: 1.45,
        score: 5000,
        kind: 'mummy',
        scale: 1.22,
        think: 20
    },
    morgana: {
        name: 'MORGANA',
        title: 'Senhora da Névoa',
        hp: 460,
        speed: 1.7,
        power: 1.35,
        score: 7000,
        kind: 'witch',
        scale: 1.12,
        think: 16
    },
    baron: {
        name: 'BARÃO',
        title: 'Nocturno',
        hp: 620,
        speed: 1.55,
        power: 1.6,
        score: 12000,
        kind: 'baron',
        scale: 1.38,
        think: 14
    }
};

export const ITEMS = {
    apple: { heal: 18, score: 500, label: 'Maçã' },
    roast: { heal: 48, score: 1000, label: 'Assado' },
    gold: { heal: 0, score: 2000, label: 'Ouro' },
    pipe: { weapon: 'pipe', score: 200, label: 'Cano' },
    knife: { weapon: 'knife', score: 200, label: 'Adaga' }
};

export const WEAPONS = {
    pipe: { hits: 8, damage: 1.35, reach: 58 },
    knife: { hits: 6, damage: 1.15, reach: 46, throwable: true }
};

/**
 * Ondas: a câmera trava em lock até limpar os inimigos.
 * dx negativo = vem da esquerda da câmera; positivo = direita.
 */
export const STAGES = [
    {
        id: 'street',
        name: 'RUA DA NÉVOA',
        length: 4300,
        music: 'street',
        rain: true,
        waves: [
            { lock: 520, foes: [{ t: 'ghoul', dx: 420, z: 10 }, { t: 'ghoul', dx: -180, z: -20 }] },
            { lock: 1100, foes: [{ t: 'ghoul', dx: 460, z: 30 }, { t: 'cultist', dx: 500, z: -24 }, { t: 'ghoul', dx: -200, z: 8 }] },
            { lock: 1780, foes: [{ t: 'brute', dx: 480, z: 0 }, { t: 'ghoul', dx: -220, z: 36 }, { t: 'ghoul', dx: 520, z: -40 }] },
            { lock: 2520, foes: [{ t: 'cultist', dx: 500, z: 20 }, { t: 'cultist', dx: -210, z: -28 }, { t: 'gargoyle', dx: 560, z: 44 }] },
            { lock: 3280, foes: [{ t: 'brute', dx: 470, z: -12 }, { t: 'gargoyle', dx: 540, z: 40 }, { t: 'ghoul', dx: -180, z: 16 }, { t: 'ghoul', dx: 500, z: -36 }] }
        ],
        crates: [380, 980, 1680, 2400, 3100],
        boss: { id: 'imhotep', lock: 4000 }
    },
    {
        id: 'metro',
        name: 'METRÔ DOS OSSOS',
        length: 4500,
        music: 'metro',
        rain: false,
        waves: [
            { lock: 480, foes: [{ t: 'wight', dx: 440, z: 8 }, { t: 'ghoul', dx: -190, z: -22 }, { t: 'ghoul', dx: 500, z: 32 }] },
            { lock: 1120, foes: [{ t: 'cultist', dx: 480, z: -18 }, { t: 'cultist', dx: 520, z: 28 }, { t: 'brute', dx: -200, z: 4 }] },
            { lock: 1840, foes: [{ t: 'gargoyle', dx: 540, z: 40 }, { t: 'gargoyle', dx: -180, z: -30 }, { t: 'wight', dx: 500, z: 0 }] },
            { lock: 2620, foes: [{ t: 'brute', dx: 470, z: 12 }, { t: 'wight', dx: 530, z: -34 }, { t: 'cultist', dx: -210, z: 24 }, { t: 'ghoul', dx: 500, z: -8 }] },
            { lock: 3400, foes: [{ t: 'wight', dx: 480, z: 20 }, { t: 'wight', dx: -200, z: -16 }, { t: 'gargoyle', dx: 560, z: 44 }, { t: 'brute', dx: 510, z: -28 }] }
        ],
        crates: [420, 1040, 1760, 2500, 3220],
        boss: { id: 'morgana', lock: 4180 }
    },
    {
        id: 'cathedral',
        name: 'CATEDRAL DE SANGUE',
        length: 2800,
        music: 'cathedral',
        rain: false,
        waves: [
            { lock: 420, foes: [{ t: 'wight', dx: 440, z: 10 }, { t: 'cultist', dx: 500, z: -24 }, { t: 'gargoyle', dx: -180, z: 36 }] },
            { lock: 980, foes: [{ t: 'brute', dx: 470, z: 0 }, { t: 'wight', dx: 520, z: 32 }, { t: 'wight', dx: -200, z: -28 }, { t: 'cultist', dx: 540, z: -8 }] },
            { lock: 1620, foes: [{ t: 'gargoyle', dx: 560, z: 40 }, { t: 'gargoyle', dx: -190, z: -36 }, { t: 'brute', dx: 500, z: 8 }, { t: 'wight', dx: 480, z: -20 }] }
        ],
        crates: [360, 900, 1500],
        boss: { id: 'baron', lock: 2360 }
    }
];

export function groundY(z) {
    return GROUND_Y - z * Z_SCALE;
}
