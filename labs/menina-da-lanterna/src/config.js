/**
 * A Menina da Lanterna — constantes, capítulos e a historinha.
 *
 * Clara, a última chama e cinco noites até o primeiro sol.
 * Regras da lanterna (documentadas também no player):
 *   fuel ∈ [0, 100]
 *   drain = 1.15 / s nos capítulos escuros, se não houver lampião aceso perto (< 3.4 m)
 *           (era 1,65: no modo infantil a chama cheia dura ~87 s em vez de ~60 s)
 *   abrigo: perto de lampião aceso a chama não gasta e ainda REACENDE +6 / s
 *           (lampião aceso é ponto seguro: nunca há escuro sem saída)
 *   flash custa 14 e empurra Sombrios num raio de 6.2 m
 *   vaga-lume restaura +16 e volta a brilhar 45 s depois de colhido
 */

export const STORAGE_KEY = 'menina-da-lanterna-v1';

/**
 * Corpo e locomoção de Clara (criança de ~1,22 m, ~8 anos). Unidades SI.
 *   Velocidade-alvo no plano: v* = |stick| · walk  (trote leve; stick a meio ≈ passo de 1,2 m/s)
 *                             v* = sprint com Shift / botão "correr"
 *     (adulto anda 1,4 m/s e corre 4–6 m/s; escalado pela altura, 2,4 e 4,2 m/s dão a
 *      sensação de uma criança apressada sem deixar o vale de 300 m cansativo)
 *   Aceleração exponencial:  v ← v + (v* − v)·(1 − e^(−k·dt)),  k = accel (ganha) ou decel (perde)
 *     accel 8 → 90 % da velocidade em ~0,29 s · decel 11 → da corrida à parada em ~0,4 s
 *   Ladeira (função de Tobler, 1993):  f = e^(−3,5·|g + 0,05|) / e^(−3,5·0,05),  g = dy/dx no rumo
 *     f limitado a [0,7; 1,12]: subida de 15 % já custa ~30 % do passo, descida leve ajuda um pouco
 *   gravity  m/s² (sem pulo: só segura o corpo colado em ladeira e ponte)
 */
export const PLAYER = {
    walk: 2.4,
    sprint: 4.2,
    accel: 8,
    decel: 11,
    radius: 0.38,
    height: 1.22,
    gravity: 24,
    terminal: 30,
    turnSpeed: 10,
    invuln: 1.35,
    fuelMax: 100,
    fuelDrain: 1.15,
    lampRegen: 6,
    flashCost: 14,
    flashTime: 0.55,
    flashRadius: 6.2,
    fireflyHeal: 16,
    fireflyRespawn: 45,
    lampRange: 3.4
};

/**
 * Câmera em órbita no ombro.
 *   recenter: rad/s com que a órbita volta para trás de Clara quando ela anda e ninguém mexe
 *             na câmera há `recenterDelay` s (escala com v/sprint; não roda quando ela anda
 *             para a câmera — senão a câmera daria meia-volta)
 */
export const CAMERA = {
    recenter: 1.6,
    recenterDelay: 1.1,
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
 *   dawn (cap. V): hora final do nascer do sol (sol baixo, ~10° sobre o horizonte)
 *   dawnTint: cor da névoa no fim do amanhecer (pêssego/dourado, rala)
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
        atmos: { hour: 4.75, dawn: 7.1, clouds: 0.42, fog: [0.03, 0.02], falloff: 0.09, haze: [0.0012, 0.0006], sat: [0.72, 1.1], exposure: [2.6, 1.0], gain: [[0.92, 0.95, 1.1], [1.05, 1.0, 0.94]], fill: [1.3, 0.22], tint: [1.5, 1.6, 1.75], dawnTint: [1.0, 0.62, 0.38] }
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
