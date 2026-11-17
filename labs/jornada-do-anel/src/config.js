/**
 * A Jornada do Anel — constantes, capítulos e presets de qualidade.
 *
 * Homenagem em cinco cenas à aventura clássica de fantasia: cada capítulo
 * tem um objetivo, uma atmosfera e um clima sonoro próprios. Textos, música,
 * mapas e figurinos são originais deste lab.
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
    height: 1.45,
    pitchMin: -0.42,
    pitchMax: 0.72,
    defaultPitch: 0.18,
    lookY: 0.98,
    /** folga entre a câmera e o que estiver no caminho (m) */
    skin: 0.35
};

/**
 * Detalhe por tier (o tier vem de `pickTier` + seletor do menu; o palco pode
 * rebaixar sozinho se o fps cair).
 *   hero / npc      nível de detalhe de `createHero` (2 herói · 1 NPC · 0 multidão)
 *   trees / props   multiplicadores de contagem          lights  luzes pontuais por cena
 *   pointShadow     sombra da luz do cajado/lanterna (cubemap) — só no tier alto
 */
export const QUALITY = {
    low: { id: 'low', npc: 0, trees: 0.5, props: 0.4, particles: 0.45, lights: 3, pointShadow: 0, extras: 0.5 },
    medium: { id: 'medium', npc: 1, trees: 0.8, props: 0.75, particles: 0.8, lights: 6, pointShadow: 0, extras: 0.8 },
    high: { id: 'high', npc: 1, trees: 1, props: 1, particles: 1, lights: 9, pointShadow: 512, extras: 1 }
};

/**
 * Atmosferas dos capítulos — entram em PRESETS de `gfx/stage.js` (mesmos campos:
 * hora, nuvens, exposição, sol/ambiente, névoa de altura, bruma, bloom, raios, grade).
 */
export const ATMOSPHERES = {
    // I — fim de tarde dourado
    condado: {
        hour: 16.7, clouds: 0.34, exposure: 1.1, sun: 1.05, env: 1.25, fog: 0.0024, falloff: 0.03, haze: 0.00018,
        fogGlow: 0.55, bloom: 0.1, rays: 0.6, saturation: 1.12, contrast: 1.05, vignette: 0.26,
        fogTint: [0.9, 0.84, 0.74], gain: [1.05, 1.0, 0.92], lift: [0.012, 0.008, 0.004], wind: 0.7, fill: 0.24
    },
    // II — noite de lua, névoa rasteira
    fuga: {
        hour: 23, clouds: 0.3, exposure: 2.6, sun: 1.7, env: 1.25, fog: 0.016, falloff: 0.1, haze: 0.0011,
        fogGlow: 0.55, bloom: 0.14, rays: 0.55, saturation: 0.84, contrast: 1.1, vignette: 0.46,
        fogTint: [0.74, 0.86, 1.06], gain: [0.9, 0.98, 1.1], lift: [0.004, 0.008, 0.02], wind: 0.45, fill: 0.5
    },
    // III — amanhecer com bruma e raios de sol
    vale: {
        hour: 7.4, clouds: 0.4, exposure: 1.1, sun: 0.95, env: 1.2, fog: 0.011, falloff: 0.05, haze: 0.0005,
        fogGlow: 1.4, bloom: 0.14, rays: 1.0, saturation: 1.05, contrast: 1.03, vignette: 0.28,
        fogTint: [1.0, 0.95, 0.86], gain: [1.05, 1.01, 0.94], lift: [0.016, 0.016, 0.014], wind: 0.4, fill: 0.22
    },
    // IV — subterrâneo: sem sol, só fogo e cajado
    minas: {
        hour: 12, clouds: 0, exposure: 1.45, sun: 0, env: 0.05, fog: 0.03, falloff: 0.02, haze: 0.006,
        fogGlow: 0, bloom: 0.2, rays: 0, saturation: 0.96, contrast: 1.1, vignette: 0.5,
        fogTint: [0.02, 0.016, 0.014], gain: [1.05, 0.98, 0.9], lift: [0.002, 0.001, 0.0], wind: 0, fill: 0.03
    },
    // V — entardecer com vento
    cume: {
        hour: 17.35, clouds: 0.5, exposure: 1.25, sun: 1.05, env: 1.3, fog: 0.0028, falloff: 0.03, haze: 0.0002,
        fogGlow: 0.45, bloom: 0.12, rays: 0.6, saturation: 0.98, contrast: 1.05, vignette: 0.32,
        fogTint: [0.62, 0.54, 0.52], gain: [1.0, 1.0, 0.98], lift: [0.014, 0.006, 0.016], wind: 1.3, fill: 0.42
    }
};

/**
 * Cinco capítulos da jornada. Textos originais — nenhum diálogo copiado.
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
        atmosphere: 'condado',
        loading: 'Erguendo as colinas do Condado…'
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
        atmosphere: 'fuga',
        loading: 'A noite cai sobre a estrada…'
    },
    {
        id: 'vale',
        roman: 'III',
        title: 'O Vale Élfico',
        subtitle: 'O conselho',
        blurb: 'Quedas d’água, pedra clara e um círculo de pedras. Alguém precisa levar o Anel.',
        objective: 'Entre no círculo do conselho e aceite a jornada.',
        hint: 'Cruze a ponte e suba até o terraço das colunas.',
        music: 'vale',
        atmosphere: 'vale',
        loading: 'A bruma sobe das quedas d’água…'
    },
    {
        id: 'mines',
        roman: 'IV',
        title: 'As Minas',
        subtitle: 'A ponte',
        blurb: 'Pilares sem fim, tambores na escuridão e uma fenda que não perdoa.',
        objective: 'Atravesse o salão e a ponte antes que a Sombra chegue.',
        hint: 'Espaço para atacar. Corra quando a ponte tremer.',
        music: 'mines',
        atmosphere: 'minas',
        loading: 'Acendendo os braseiros do salão…'
    },
    {
        id: 'summit',
        roman: 'V',
        title: 'O Monte da Visão',
        subtitle: 'A partida',
        blurb: 'Ruínas no alto, o grande rio abaixo. A companhia se parte — e a jornada continua.',
        objective: 'Sente-se no trono de pedra e escolha seguir adiante.',
        hint: 'Suba até o assento no cume.',
        music: 'summit',
        atmosphere: 'cume',
        loading: 'O vento varre as ruínas do cume…'
    }
];
