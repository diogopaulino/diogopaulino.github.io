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
 * Física (unidades SI — m, s, m/s, m/s²; João é uma criança de 1,32 m):
 *   andar 2,1 m/s · correr 4,9 m/s · aceleração exponencial v ← v + (alvo − v)(1 − e^(−k·dt))
 *   gravidade 24 m/s² na subida, ×1,55 na queda e ×2,4 se soltar o pulo cedo (pulo variável)
 *   pulo de 1,05 m (v0 = √(2·g·h) ≈ 7,1 m/s), coyote 0,12 s, buffer 0,12 s, terminal 24 m/s
 * Subida: João abraça o feixe do caule (W/S sobe/desce a 2,2 m/s, A/D gira em volta).
 * Folhas são plataformas com a mesma superfície curva da malha (world.js → leafSurface);
 * do caule, Espaço/E salta para a folha mirada (arco balístico calculado: pouso garantido).
 *
 * Atmosfera: cada capítulo escolhe um preset de `gfx/stage.js` (`sky.preset`), a
 * hora solar e a cobertura de nuvens; o palco deriva sol, névoa, exposição e grade.
 */

export const STORAGE_KEY = 'joao-pe-de-feijao-v1';

export const PLAYER = {
    walk: 2.1,          // m/s — passo apressado de criança (adulto anda ~1,4 m/s)
    sprint: 4.9,        // m/s — corrida (Shift, botão "correr" ou analógico no fim do curso)
    accel: 11,          // 1/s — ganho de velocidade no chão (~0,2 s até 90% do alvo)
    decel: 14,          // 1/s — frenagem ao soltar o direcional
    airControl: 0.35,   // fração da aceleração disponível no ar
    airDrag: 0.4,       // 1/s — no ar sem direcional o embalo quase se mantém
    radius: 0.32,       // m — raio do corpo para colisão
    height: 1.28,
    eye: 1.12,
    gravity: 24,        // m/s² (subida)
    fallGravity: 1.55,  // × gravidade na descida: queda mais pesada que a subida
    cutGravity: 2.4,    // × gravidade subindo sem segurar o pulo (pulo curto ≈ 0,45 m)
    jumpHeight: 1.05,   // m — pulo completo
    terminal: 24,       // m/s — velocidade terminal (queda limitada)
    turnSpeed: 12,      // 1/s — giro do corpo rumo à direção do movimento
    invuln: 1.35,       // s de piscar depois de um susto
    climbSpeed: 2.2,    // m/s subindo o caule
    climbSprint: 3.3,   // m/s subindo com Shift
    climbDown: 2.9,     // m/s descendo (S)
    slideSpeed: 5.2,    // m/s escorregando (S + Shift)
    climbTurn: 1.5,     // rad/s dando a volta no caule (A/D)
    coyote: 0.12,       // s — ainda pode pular logo depois de sair da beirada
    jumpBuffer: 0.12,   // s — Espaço apertado um pouco antes de pousar vale
    stepUp: 0.45,       // m — degrau/borda de folha que o pé sobe sem pular
    longFall: 7,        // m de queda livre → resgate no último ponto seguro (sem frustração)
    leapReach: 3.2,     // m — folha até 3,2 m abaixo…
    leapRise: 0.6,      // m — …ou 0,6 m acima do João no caule pode ser alvo do salto
    leapCone: 0.62      // rad — e precisa estar a ±35° do lado do caule onde ele está
};

/**
 * Câmera em órbita (camera.js). Distâncias em m a partir do pivô (João + lookY).
 * Suavização exponencial: pivô λ = 14 no plano e 5…12 na vertical (pulo não sacode a tela);
 * distância encolhe na hora ao bater em algo (λ = 40) e volta devagar (λ = 3).
 */
export const CAMERA = {
    distance: 5.6,
    minDistance: 2.6,
    maxDistance: 11,
    near: 0.9,          // m — distância mínima quando algo fica no meio
    pitchMin: -0.5,
    pitchMax: 0.95,
    defaultPitch: 0.26,
    climbPitch: 0.5,    // no caule a câmera sobe e olha o chão encolher
    climbDist: 1.3,     // × distância no caule (enquadra João e a folha-alvo)
    climbSide: 0.55,    // rad — fica de lado do João no caule para a folha atrás dele aparecer
    lookY: 1.05,        // m acima dos pés
    sens: 0.0022,       // rad por pixel de mouse/arrasto
    recenter: 0.9,      // 1/s — volta para trás do João quando ele anda e ninguém mexe na câmera
    idleLook: 1.1       // s sem mexer na câmera antes de recentralizar
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
        hint: 'Pule junto ao caule para agarrar. W sobe; folhas com vagem dourada valem glória.',
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
        hint: 'Segure S para descer (Shift escorrega). Embaixo, E no machado e depois no tronco.',
        music: 'escape',
        sky: { preset: 'entardecer', hour: 17.55, clouds: 0.42 }
    }
];
