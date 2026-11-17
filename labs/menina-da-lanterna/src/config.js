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

/**
 * Luz da lanterna de Clara (PointLight em candelas, ver player.js):
 *   I = base + (fuel/100)·gain + pulso·flash
 */
export const LANTERN = { base: 1.3, gain: 3.4, flash: 16 };

/**
 * Carga por tier (o palco, o terreno e a grama têm os próprios orçamentos por tier):
 *   lights        PointLights sem sombra repartidas entre os lampiões acesos mais próximos
 *   lanternShadow lado do mapa de sombra em cubo da lanterna (0 = sem sombra)
 *   trees         árvores no vale · scatter: multiplicador de rochas/samambaias/arbustos
 *   npcDetail     detalhe dos aldeões (hero.js) · motes: vaga-lumes de ambiente
 */
export const QUALITY = {
    low: { id: 'low', lights: 3, lanternShadow: 0, trees: 260, scatter: 0.3, npcDetail: 0, motes: 60, props: false },
    medium: { id: 'medium', lights: 5, lanternShadow: 512, trees: 430, scatter: 0.7, npcDetail: 1, motes: 120, props: true },
    high: { id: 'high', lights: 6, lanternShadow: 1024, trees: 600, scatter: 1, npcDetail: 1, motes: 180, props: true }
};

/**
 * Cinco capítulos de um conto original.
 * A noite esqueceu de acabar; Clara carrega a última chama da avó Nara.
 *
 * `atmos` — atmosfera do capítulo. Pares [apagado, aceso] são interpolados pelo
 * progresso w ∈ [0,1] (lampiões acesos / necessários): cada chama recua a névoa,
 * devolve a cor (saturação) e esquenta a grade.
 *   hour: hora solar (a lua fica oposta ao sol) · fog/falloff/haze: névoa de altura
 *   sat: saturação · exposure · gain: ganho RGB da grade · fill: luz de preenchimento
 *   tint: multiplica a cor da névoa (o céu noturno é quase preto; > 1 dá bruma leitosa)
 *   dawn (cap. V): hora final do nascer do sol quando a lanterna pousa na pedra
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
        atmos: { hour: 22.6, clouds: 0.3, fog: [0.034, 0.008], falloff: 0.075, haze: [0.0016, 0.0004], sat: [0.7, 0.92], exposure: [2.5, 2.25], gain: [[0.84, 0.95, 1.14], [1.03, 1.0, 0.95]], fill: [1.25, 0.95], tint: [1.5, 1.6, 1.75] }
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
        atmos: { hour: 23.8, clouds: 0.45, fog: [0.05, 0.014], falloff: 0.06, haze: [0.0022, 0.0006], sat: [0.66, 0.92], exposure: [2.5, 2.25], gain: [[0.82, 1.0, 1.06], [1.0, 1.02, 0.95]], fill: [1.25, 0.95], tint: [1.5, 1.6, 1.75] }
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
        atmos: { hour: 1.2, clouds: 0.25, fog: [0.042, 0.012], falloff: 0.11, haze: [0.0016, 0.0004], sat: [0.7, 0.92], exposure: [2.5, 2.25], gain: [[0.8, 0.97, 1.16], [0.98, 1.0, 1.02]], fill: [1.25, 0.95], tint: [1.5, 1.6, 1.75] }
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
        atmos: { hour: 3.0, clouds: 0.55, fog: [0.046, 0.012], falloff: 0.07, haze: [0.002, 0.0005], sat: [0.7, 0.92], exposure: [2.5, 2.25], gain: [[0.98, 0.86, 1.14], [1.04, 0.98, 1.0]], fill: [1.25, 0.95], tint: [1.5, 1.6, 1.75] }
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
        atmos: { hour: 4.75, dawn: 7.1, clouds: 0.42, fog: [0.03, 0.02], falloff: 0.09, haze: [0.0012, 0.0006], sat: [0.72, 1.1], exposure: [2.6, 1.0], gain: [[0.92, 0.95, 1.1], [1.05, 1.0, 0.94]], fill: [1.3, 0.25], tint: [1.5, 1.6, 1.75] }
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
