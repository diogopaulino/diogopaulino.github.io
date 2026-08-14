/**
 * A Jornada do Anel — constantes, capítulos e presets de qualidade.
 *
 * Homenagem visual ao primeiro filme da trilogia: cinco cenas, cada uma
 * com um objetivo, uma paleta e um clima sonoro próprios.
 */

export const STORAGE_KEY = 'jornada-do-anel-v1';

export const PLAYER = {
    walk: 4.35,
    sprint: 7.15,
    radius: 0.42,
    height: 1.12,
    eye: 0.92,
    jump: 5.4,
    gravity: 18,
    turnSpeed: 10,
    invuln: 1.4
};

export const CAMERA = {
    distance: 6.4,
    minDistance: 3.2,
    maxDistance: 11,
    height: 1.55,
    pitchMin: -0.42,
    pitchMax: 0.72,
    defaultPitch: 0.18,
    lookY: 1.05
};

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 512,
        trees: 0.45,
        grass: 0.35,
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
 * Cinco capítulos alinhados às batidas do primeiro filme.
 * Textos originais — nenhum diálogo copiado.
 */
export const CHAPTERS = [
    {
        id: 'shire',
        roman: 'I',
        title: 'O Condado',
        subtitle: 'A toca redonda',
        blurb: 'Colinas verdes, a árvore da festa e um anel que não deveria existir.',
        objective: 'Encontre a toca de porta verde e pegue o Anel.',
        hint: 'Siga as lanternas até a colina mais alta.',
        music: 'shire',
        fog: { color: 0xc8d6a8, near: 28, far: 118 },
        clear: 0x8eb4d4,
        ambient: 0xffe2b0,
        ambientIntensity: 0.62,
        exposure: 1.32,
        sun: { color: 0xffd39a, intensity: 2.55, dir: [-0.45, 0.82, 0.32] },
        hemi: { sky: 0xffe8c4, ground: 0x6a8a3a, intensity: 1.05 }
    },
    {
        id: 'forest',
        roman: 'II',
        title: 'A Fuga',
        subtitle: 'Cavaleiros na estrada',
        blurb: 'A floresta fecha. Capas negras farejam o Anel. Não seja visto.',
        objective: 'Alcance o vau do rio sem ser pego pelos Cavaleiros.',
        hint: 'Esconda-se atrás das árvores. Eles enxergam à frente.',
        music: 'forest',
        fog: { color: 0x1a2230, near: 8, far: 62 },
        clear: 0x0c1018,
        ambient: 0x2a3348,
        ambientIntensity: 0.4,
        exposure: 0.92,
        sun: { color: 0x8aa0c8, intensity: 0.35, dir: [0.2, 0.85, -0.4] },
        hemi: { sky: 0x1c2740, ground: 0x0a120c, intensity: 0.45 }
    },
    {
        id: 'rivendell',
        roman: 'III',
        title: 'O Vale Élfico',
        subtitle: 'O conselho',
        blurb: 'Quedas d’água, pedra clara e um círculo de pedras. Alguém precisa levar o Anel.',
        objective: 'Entre no círculo do conselho e aceite a jornada.',
        hint: 'Suba as terraces até o pavilhão dourado.',
        music: 'rivendell',
        fog: { color: 0xb7d4d8, near: 35, far: 130 },
        clear: 0x9ec8d6,
        ambient: 0xdcecff,
        ambientIntensity: 0.55,
        exposure: 1.22,
        sun: { color: 0xfff1d2, intensity: 1.55, dir: [0.35, 0.8, 0.45] },
        hemi: { sky: 0xd8f0ff, ground: 0x5a7a4a, intensity: 0.8 }
    },
    {
        id: 'moria',
        roman: 'IV',
        title: 'As Minas',
        subtitle: 'A ponte',
        blurb: 'Pilares sem fim, tambores na escuridão e uma fenda que não perdoa.',
        objective: 'Atravesse o salão e a ponte antes que a Sombra chegue.',
        hint: 'Espaço para atacar. Corra quando a ponte tremer.',
        music: 'moria',
        fog: { color: 0x0a0706, near: 6, far: 48 },
        clear: 0x070504,
        ambient: 0x3a2214,
        ambientIntensity: 0.45,
        exposure: 0.88,
        sun: { color: 0xff7a32, intensity: 0.15, dir: [0, 1, 0] },
        hemi: { sky: 0x2a1810, ground: 0x140804, intensity: 0.35 }
    },
    {
        id: 'amonhen',
        roman: 'V',
        title: 'O Monte da Visão',
        subtitle: 'A partida',
        blurb: 'Ruínas no alto, o grande rio abaixo. A companhia se parte — e a jornada continua.',
        objective: 'Sente-se no trono de pedra e escolha seguir adiante.',
        hint: 'Suba até o assento no cume.',
        music: 'amonhen',
        fog: { color: 0xd08a5a, near: 40, far: 140 },
        clear: 0xe8a060,
        ambient: 0xffc080,
        ambientIntensity: 0.58,
        exposure: 1.18,
        sun: { color: 0xff8a3a, intensity: 1.7, dir: [-0.75, 0.35, 0.2] },
        hemi: { sky: 0xffc090, ground: 0x4a3020, intensity: 0.7 }
    }
];
