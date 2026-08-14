/**
 * A Menina da Lanterna — constantes, capítulos e a historinha.
 *
 * Clara, a última chama e cinco noites até o primeiro sol.
 * Regras da lanterna (documentadas também no player):
 *   fuel ∈ [0, 100]
 *   drain = 1.65 / s nos capítulos escuros, se não houver lampião aceso perto (< 3.4 m)
 *   flash custa 14 e empurra Sombrios num raio de 6.2 m
 *   vaga-lume restaura +16
 */

export const STORAGE_KEY = 'menina-da-lanterna-v1';

export const PLAYER = {
    walk: 3.85,
    sprint: 6.35,
    radius: 0.38,
    height: 1.22,
    gravity: 18,
    turnSpeed: 11,
    invuln: 1.35,
    fuelMax: 100,
    fuelDrain: 1.65,
    flashCost: 14,
    flashTime: 0.55,
    flashRadius: 6.2,
    fireflyHeal: 16,
    lampRange: 3.4
};

export const CAMERA = {
    distance: 5.8,
    minDistance: 3.0,
    maxDistance: 10.5,
    height: 1.42,
    pitchMin: -0.38,
    pitchMax: 0.68,
    defaultPitch: 0.22,
    lookY: 1.05
};

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 512,
        trees: 0.42,
        grass: 0.3,
        particles: 0.4,
        lights: false
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.35,
        antialias: true,
        shadows: true,
        shadowSize: 1024,
        trees: 0.75,
        grass: 0.7,
        particles: 0.75,
        lights: true
    },
    high: {
        id: 'high',
        pixelRatio: 1.75,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        trees: 1,
        grass: 1,
        particles: 1,
        lights: true
    }
};

/**
 * Cinco capítulos de um conto original.
 * A noite esqueceu de acabar; Clara carrega a última chama da avó Nara.
 */
export const CHAPTERS = [
    {
        id: 'aldeia',
        roman: 'I',
        title: 'A Aldeia Apagada',
        subtitle: 'Vale-da-Bruma',
        blurb: 'Os lampiões morreram. A avó Nara saiu com a lanterna e não voltou.',
        objective: 'Fale com Tomás, acenda os 4 lampiões e pegue a carta na casa.',
        hint: 'Espaço pulsa a chama. E acende o que estiver perto.',
        music: 'aldeia',
        dark: true,
        fog: { color: 0x1a2238, near: 12, far: 72 },
        clear: 0x10182c,
        ambient: 0x3a4a78,
        ambientIntensity: 0.28,
        exposure: 0.88,
        sun: { color: 0x6a7ab0, intensity: 0.22, dir: [0.35, 0.72, 0.4] },
        hemi: { sky: 0x243050, ground: 0x1a140c, intensity: 0.38 },
        sky: { top: 0x0c1428, mid: 0x1c2848, bot: 0x2a2218 }
    },
    {
        id: 'trilha',
        roman: 'II',
        title: 'A Trilha das Sombras',
        subtitle: 'A floresta fecha',
        blurb: 'Sombrios farejam a chama. Acenda o caminho e não deixe apagar.',
        objective: 'Acenda 5 lanternas da trilha e alcance o moinho velho.',
        hint: 'Pulse a lanterna para afastar os Sombrios. Vaga-lumes reabastecem a chama.',
        music: 'trilha',
        dark: true,
        fog: { color: 0x0a1210, near: 6, far: 42 },
        clear: 0x060a0c,
        ambient: 0x1a2830,
        ambientIntensity: 0.18,
        exposure: 0.72,
        sun: { color: 0x3a5060, intensity: 0.12, dir: [0.15, 0.9, -0.3] },
        hemi: { sky: 0x101820, ground: 0x0a1008, intensity: 0.22 },
        sky: { top: 0x05080c, mid: 0x0c1418, bot: 0x101408 }
    },
    {
        id: 'rio',
        roman: 'III',
        title: 'O Rio dos Nomes',
        subtitle: 'Quem esqueceu o próprio nome',
        blurb: 'Almas-vaga-lume não cruzam sem luz. Pingo, a raposa, está presa nas sarças.',
        objective: 'Acenda 3 bóias, liberte Pingo e atravesse a ponte.',
        hint: 'A raposa aponta segredos. A ponte só aparece com as bóias acesas.',
        music: 'rio',
        dark: true,
        fog: { color: 0x1a3040, near: 8, far: 58 },
        clear: 0x0c1824,
        ambient: 0x2a4860,
        ambientIntensity: 0.24,
        exposure: 0.8,
        sun: { color: 0x4a80a0, intensity: 0.18, dir: [-0.4, 0.75, 0.2] },
        hemi: { sky: 0x183040, ground: 0x142018, intensity: 0.32 },
        sky: { top: 0x081420, mid: 0x183848, bot: 0x1a2820 }
    },
    {
        id: 'arvore',
        roman: 'IV',
        title: 'A Árvore Oca',
        subtitle: 'O ninho da noite',
        blurb: 'Quatro raízes cantam a canção de ninar. A Noite tenta soprar a chama.',
        objective: 'Acenda as 4 raízes na ordem da canção e suba ao copo.',
        hint: 'A ordem é a da carta: dourado, azul, rosa, verde. Pulse se a Noite chegar.',
        music: 'arvore',
        dark: true,
        fog: { color: 0x140818, near: 7, far: 48 },
        clear: 0x0a0610,
        ambient: 0x3a2048,
        ambientIntensity: 0.22,
        exposure: 0.78,
        sun: { color: 0x604080, intensity: 0.16, dir: [0.2, 0.85, 0.45] },
        hemi: { sky: 0x201028, ground: 0x100810, intensity: 0.28 },
        sky: { top: 0x0a0614, mid: 0x1a1028, bot: 0x140c18 }
    },
    {
        id: 'alvorecer',
        roman: 'V',
        title: 'O Primeiro Sol',
        subtitle: 'A colina que lembra o dia',
        blurb: 'Nara segurou a noite. Agora a lanterna cabe na mão de Clara.',
        objective: 'Coloque a lanterna na Pedra da Aurora e traga o dia.',
        hint: 'Suba a colina. E na pedra dourada.',
        music: 'alvorecer',
        dark: false,
        fog: { color: 0xc8a078, near: 22, far: 110 },
        clear: 0xf0b878,
        ambient: 0xffd0a0,
        ambientIntensity: 0.48,
        exposure: 1.18,
        sun: { color: 0xffc878, intensity: 1.85, dir: [-0.55, 0.42, 0.35] },
        hemi: { sky: 0xffc8a0, ground: 0x6a4830, intensity: 0.85 },
        sky: { top: 0x6a90c8, mid: 0xf0b878, bot: 0xe88858 }
    }
];

export const STORY = {
    tomas: [
        'Clara… a noite não acabou. Sua avó saiu com a lanterna e o vento fechou a porta.',
        'Os lampiões da praça apagaram um a um. Se você acender de novo, o caminho da floresta aparece.',
        'Leva pão. E não deixe a chama tremer — ela é teimosa, igual a Nara.'
    ],
    chama: [
        'Eu sou a última chama da Nara.',
        'Anda. A manhã esqueceu o caminho de volta. A gente lembra por ela.'
    ],
    carta: 'Clara: se a noite ficar grande demais, a chama cabe na sua mão. A canção é ouro, azul, rosa, verde. — Vovó',
    pingo: [
        'A raposa solta um au baixo e sacode o rabo em direção à ponte.',
        'Pingo vai com você. Ele enxerga o que a chama ainda não acendeu.'
    ],
    nara: [
        'Eu não me perdi, menina. Eu segurei a noite para ela não engolir a aldeia.',
        'Agora a lanterna é sua. Não para afastar o escuro — para lembrar o dia de que ele existe.',
        'Vai. Acende o primeiro sol. Eu fico na chama, bem quietinha.'
    ]
};

/** Ordem das raízes no cap. IV — ouro, azul, rosa, verde. */
export const ROOT_ORDER = [0, 1, 2, 3];
export const ROOT_COLORS = [0xffc44a, 0x6ec8ff, 0xff7ab0, 0x8ee08a];
export const ROOT_NAMES = ['ouro', 'azul', 'rosa', 'verde'];
