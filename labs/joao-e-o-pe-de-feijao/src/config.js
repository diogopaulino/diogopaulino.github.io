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
 * Física: gravidade 22, pulo 7.4, coyote 0.12 s. Subida: cilindro do caule
 * (W/S sobe/desce, A/D gira). Folhas são plataformas circulares.
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

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 512,
        trees: 0.4,
        grass: 0.3,
        particles: 0.35,
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
        fog: { color: 0xb7d4a0, near: 28, far: 110 },
        clear: 0x87c4e8,
        ambient: 0xffe8c4,
        ambientIntensity: 0.58,
        exposure: 1.28,
        sun: { color: 0xffe0a8, intensity: 2.4, dir: [-0.4, 0.85, 0.28] },
        hemi: { sky: 0xd8f0ff, ground: 0x5a8a38, intensity: 1.05 }
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
        fog: { color: 0xd4c4a0, near: 22, far: 95 },
        clear: 0xf0c878,
        ambient: 0xffd8a0,
        ambientIntensity: 0.62,
        exposure: 1.22,
        sun: { color: 0xffc878, intensity: 2.1, dir: [0.55, 0.62, 0.2] },
        hemi: { sky: 0xffe8c0, ground: 0x7a6a40, intensity: 0.9 }
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
        fog: { color: 0x1a2840, near: 12, far: 80 },
        clear: 0x0c1828,
        ambient: 0x3a5080,
        ambientIntensity: 0.42,
        exposure: 0.95,
        sun: { color: 0xa8c8ff, intensity: 0.45, dir: [0.15, 0.9, -0.35] },
        hemi: { sky: 0x1c3058, ground: 0x0a180c, intensity: 0.4 }
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
        fog: { color: 0xc8d8e8, near: 18, far: 90 },
        clear: 0xb8d0e8,
        ambient: 0xe8f0ff,
        ambientIntensity: 0.55,
        exposure: 1.12,
        sun: { color: 0xfff0d0, intensity: 1.65, dir: [0.3, 0.75, 0.5] },
        hemi: { sky: 0xf0f8ff, ground: 0x8aa0b8, intensity: 0.85 }
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
        fog: { color: 0xd08050, near: 20, far: 100 },
        clear: 0xe89858,
        ambient: 0xffc090,
        ambientIntensity: 0.55,
        exposure: 1.18,
        sun: { color: 0xff8a3a, intensity: 1.85, dir: [-0.7, 0.4, 0.25] },
        hemi: { sky: 0xffc090, ground: 0x4a3020, intensity: 0.7 }
    }
];
