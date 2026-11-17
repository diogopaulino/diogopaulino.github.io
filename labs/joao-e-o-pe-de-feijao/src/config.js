/**
 * João e o Pé de Feijão — constantes, capítulos e presets de qualidade.
 *
 * Conto completo em cinco cenas. Regras:
 * - I: fale com a mãe e leve a Mimosa até o caminho da feira.
 * - II: troque a vaca por cinco feijões mágicos com o mercador.
 * - III: a mãe joga os feijões; o pé cresce; suba pelas folhas até as nuvens.
 * - IV: no castelo, colete ouro, galinha e harpa sem acordar o gigante.
 * - V: desça, pegue o machado e corte o pé (E várias vezes) antes que ele alcance.
 *
 * Física: gravidade 22, pulo 7.4, coyote 0.12 s. Subida: João abraça o feixe do
 * caule (W/S sobe/desce, A/D gira em volta). Folhas são plataformas circulares.
 *
 * Atmosfera: cada capítulo escolhe um preset de `gfx/stage.js` (`sky.preset`), a
 * hora solar e a cobertura de nuvens; o palco deriva sol, névoa, exposição e grade.
 */

export const STORAGE_KEY = 'joao-pe-de-feijao-v1';

export const PLAYER = {
    walk: 5.15,
    sprint: 8.35,
    radius: 0.38,
    height: 1.28,
    eye: 1.12,
    jump: 7.45,
    gravity: 22,
    turnSpeed: 12,
    invuln: 1.35,
    climbSpeed: 5.6,
    climbRadius: 1.55,
    coyote: 0.14,
    jumpBuffer: 0.12
};

export const CAMERA = {
    distance: 6.8,
    minDistance: 3.4,
    maxDistance: 14,
    height: 1.65,
    pitchMin: -0.55,
    pitchMax: 0.82,
    defaultPitch: 0.22,
    lookY: 1.12
};

/**
 * Carga por tier (o tier do palco decide sombra, pós e pixelRatio; aqui fica o
 * que é do jogo): fração de árvores, vizinhos da feira, luzes pontuais e detalhe
 * dos personagens secundários.
 */
export const QUALITY = {
    low: { id: 'low', trees: 0.45, scatter: 0.3, villagers: 2, lights: 2, npcDetail: 0, heroDetail: 1, clouds: 48 },
    medium: { id: 'medium', trees: 0.75, scatter: 0.7, villagers: 4, lights: 4, npcDetail: 1, heroDetail: 2, clouds: 80 },
    high: { id: 'high', trees: 1, scatter: 1, villagers: 5, lights: 6, npcDetail: 1, heroDetail: 2, clouds: 112 }
};

/** Pé de feijão: mesma altura lógica do jogo original (topo = 72 m). */
export const STALK = { height: 74, radius: 1.5, top: 72, x: 0.5, z: 8.5 };

/** Escala do gigante: ogro de 3,2 m × 3 = 9,6 m (≈ 6× um adulto). */
export const GIANT_SCALE = 3;

export const TREASURES = [
    { id: 'gold', label: 'Saco de ouro', icon: '◉' },
    { id: 'hen', label: 'Galinha dourada', icon: '✦' },
    { id: 'harp', label: 'Harpa que canta', icon: '♫' }
];

export const CHAPTERS = [
    {
        id: 'cottage',
        roman: 'I',
        title: 'A Cabana',
        subtitle: 'A última vaca',
        blurb: 'A despensa está vazia. A Mimosa é tudo o que resta.',
        objective: 'Fale com a mãe e leve a Mimosa até o caminho da feira.',
        hint: 'A vaca pastando ao lado da cerca segue quem a chama.',
        music: 'cottage',
        sky: { preset: 'dia-claro', hour: 9.6, clouds: 0.92, clearTo: 0.36 }
    },
    {
        id: 'fair',
        roman: 'II',
        title: 'A Feira',
        subtitle: 'Cinco feijões',
        blurb: 'Barracas, pão e um estranho de capa roxa que não vende pão.',
        objective: 'Troque a Mimosa pelos feijões mágicos do mercador.',
        hint: 'O mercador espera no fim da praça, sob o toldo violeta.',
        music: 'fair',
        sky: { preset: 'dia-claro', hour: 15.4, clouds: 0.3 }
    },
    {
        id: 'night',
        roman: 'III',
        title: 'A Noite',
        subtitle: 'O pé que cresce',
        blurb: 'A mãe joga os feijões. Ao relento, algo verde sobe até as nuvens.',
        objective: 'Fale com a mãe, veja o pé crescer e suba até as nuvens.',
        hint: 'Aperte-se ao caule para trepar. Pule nas folhas se preferir.',
        music: 'night',
        sky: { preset: 'noite-lua', hour: 22.4, clouds: 0.22 }
    },
    {
        id: 'castle',
        roman: 'IV',
        title: 'O Castelo',
        subtitle: 'Fee-fi-fo-fum',
        blurb: 'Nuvens de pedra, uma mesa do tamanho de um celeiro e um sono ruidoso.',
        objective: 'Roube o ouro, a galinha e a harpa sem acordar o gigante.',
        hint: 'Ande sem correr. A harpa canta alto — deixe-a por último.',
        music: 'castle',
        sky: { preset: 'entardecer', hour: 16.35, clouds: 0.18 }
    },
    {
        id: 'escape',
        roman: 'V',
        title: 'A Fuga',
        subtitle: 'O machado',
        blurb: 'O gigante desce. Embaixo, um machado espera na lenha.',
        objective: 'Desça, pegue o machado e corte o pé de feijão.',
        hint: 'Desça pelo caule. Embaixo, E no machado e depois no tronco.',
        music: 'escape',
        sky: { preset: 'entardecer', hour: 17.55, clouds: 0.42 }
    }
];
