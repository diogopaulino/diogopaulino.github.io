/**
 * River Knight — configuração central.
 *
 * Todos os números que definem a "sensação" do jogo moram aqui para facilitar
 * o ajuste fino sem caçar constantes espalhadas pelos módulos.
 */

/** Distância total (em metros de jogo) até o castelo. */
export const COURSE_LENGTH = 4200;

/** Onde o castelo é posicionado no eixo Z (o barco navega no sentido -Z). */
export const CASTLE_Z = -COURSE_LENGTH;

/** Ponto em que a barcaça do vilão bloqueia o rio. */
export const BOSS_Z = CASTLE_Z + 240;

/**
 * Navegação do drakkar — modelo físico simplificado, em unidades reais (m, s, rad).
 *
 * Referência: um drakkar de 15 m remava a ~5–6 nós e, com vela e correnteza a
 * favor, passava de 10 nós. A versão anterior andava a 32 m/s (115 km/h) e
 * "deslizava" de lado sem virar a proa — irreal. Agora:
 *
 *   Avanço (surge), por marcha de remo g:
 *     du/dt = F[g] − brake[g]·u − b1·u − b2·u·|u|   (empuxo − remos segurando − arrasto)
 *     velocidade terminal U[g] resolve F = b1·U + b2·U²  →  0 / 3,5 / 7 / 10 m/s sobre a água
 *     (+ ~2 m/s de correnteza ⇒ cruzeiro ≈ 17 nós e ataque ≈ 23 nós sobre o fundo)
 *     constante de tempo perto do cruzeiro: 1/(b1 + 2·b2·U) ≈ 4 s (o barco tem massa).
 *
 *   Leme (modelo de Nomoto de 1ª ordem):
 *     δ segue o comando com velocidade limitada (cana do leme: rudderRate rad/s)
 *     r_alvo = K · max(u, uSteerMin) · δ          (o leme só "morde" com água passando)
 *     dr/dt  = (r_alvo − r) / Tyaw
 *     raio de giro ≈ u / r ≈ 30 m a qualquer velocidade (r ∝ u); |r| ≤ maxYawRate (2 comprimentos de casco).
 *
 *   Deriva lateral (sway): a quilha amortece; na curva o casco escorrega para fora:
 *     dv/dt = −kSway·(v − v_alvo),   v_alvo = −slip · u · r
 *
 *   Correnteza: o rio corre a `current` m/s rio abaixo (mais lento junto às margens,
 *   perfil parabólico) e soma à velocidade sobre a água → velocidade sobre o fundo.
 *
 *   Adernamento: mola amortecida; na curva o casco aderna para FORA (deslocamento),
 *   somado à inclinação das ondas sob o casco.
 */
export const BOAT = {
    /** Marchas do "telégrafo" de remo: 0 parado · 1 lento · 2 cruzeiro · 3 ataque. */
    gears: [
        { id: 'stop', label: 'Segurar remos', short: 'Parar', thrust: 0, brake: 0.15 },
        { id: 'slow', label: 'Ritmo lento', short: 'Lento', thrust: 0.427 },
        { id: 'cruise', label: 'Ritmo de cruzeiro', short: 'Cruzeiro', thrust: 1.148 },
        { id: 'ram', label: 'Ataque!', short: 'Ataque', thrust: 2.0 }
    ],
    startGear: 2,
    /** Arrasto: b1 (1/s) e b2 (1/m). */
    dragLinear: 0.08,
    dragQuadratic: 0.012,
    /** Correnteza média no meio do rio (m/s) e fração que sobra junto à margem. */
    current: 2.2,
    currentAtBank: 0.45,
    /** Leme. */
    rudderMax: 0.6,
    rudderRate: 1.7,
    rudderReturn: 2.4,
    yawGain: 0.055,
    yawTime: 1.1,
    uSteerMin: 2.6,
    /** Teto da guinada (rad/s ≈ 20°/s): um casco de 15 m não gira como um caiaque. */
    maxYawRate: 0.35,
    /** Ângulo máximo entre a proa e o rio (rad). Além disso a correnteza vence. */
    maxDrift: 1.2,
    /** Deriva lateral. */
    swayDamping: 1.8,
    slip: 0.35,
    /** Adernamento (rad por (m/s · rad/s)) e mola de roll/pitch. */
    heelGain: 0.03,
    rollOmega: 2.2,
    rollZeta: 0.28,
    /** Fôlego dos remadores no Ataque: drena em ~14 s, recupera em ~20 s no cruzeiro. */
    staminaDrain: 1 / 14,
    staminaRegen: [1 / 7, 1 / 9, 1 / 20, 0],
    staminaMinRam: 0.18,
    /** Casco: meio comprimento e meia boca (m), usados nas margens e colisões. */
    halfLength: 7.5,
    halfBeam: 1.8,
    bankMargin: 1.2,
    maxHull: 5,
    /** Recarga de canhão (uma salva). */
    throwCooldown: 0.8,
    furyCooldown: 0.32,
    invulnAfterHit: 1.65,
    /** Referências de HUD/câmera: cruzeiro e ataque sobre o fundo (água + correnteza). */
    baseSpeed: 9.1,
    boostSpeed: 12.1,
    brakeSpeed: 2.2,
    bankLimitPadding: 3.2
};

/** Canhão de bordo — mira automática (estilo jogos de navio). */
export const CANNON = {
    speed: 118,
    /** Gravidade real (m/s²) — a balística usa a mesma no cálculo do arco. */
    gravity: 9.81,
    life: 3.4,
    damage: 1,
    /** Alcance de trava automática. */
    assistRange: 175,
    /** Cone bem amplo: só precisa apontar o navio. */
    assistCone: 0.02,
    loft: 6.2,
    ballRadius: 1.85
};

/** Alias legado — alguns módulos ainda referenciam AXE. */
export const AXE = CANNON;

export const DIFFICULTY = {
    squire: {
        id: 'squire',
        label: 'Escudeiro',
        blurb: 'Fácil: o canhão atira sozinho, o leme ajuda a seguir o rio e o casco aguenta mais.',
        spawnScale: 0.62,
        enemyFireScale: 0.58,
        damageScale: 1,
        hull: 7,
        scoreScale: 0.8,
        /** Assistência de leme: a proa tende a seguir o rio (0 = nenhuma, 1 = forte). */
        helmAssist: 1,
        /** Dispara sozinho quando a mira trava num alvo: o jogador só governa o navio. */
        autoFire: true
    },
    warrior: {
        id: 'warrior',
        label: 'Guerreiro',
        blurb: 'O equilíbrio da campanha: pressão constante, margem para erro.',
        spawnScale: 1,
        enemyFireScale: 1,
        damageScale: 1,
        hull: 5,
        scoreScale: 1,
        helmAssist: 0.45
    },
    legend: {
        id: 'legend',
        label: 'Lenda',
        blurb: 'Rio infestado, arqueiros precisos e casco frágil. Boa sorte.',
        spawnScale: 1.42,
        enemyFireScale: 1.35,
        damageScale: 1,
        hull: 4,
        scoreScale: 1.35,
        helmAssist: 0.2
    }
};

export const SCORE = {
    enemyShip: 320,
    tower: 260,
    barricade: 150,
    rock: 0,
    coin: 90,
    bossPart: 900,
    bossKill: 4000,
    distancePerMeter: 1.4,
    hullBonus: 800,
    comboStep: 0.12,
    comboMax: 4
};

/** Presets de qualidade gráfica. */
export const QUALITY = {
    low: {
        id: 'low',
        label: 'Performance',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 1024,
        bloom: false,
        terrainSegments: 150,
        waterSegments: 110,
        scatterScale: 0.5,
        fogDensity: 0.0022,
        drawDistance: 620,
        pointLights: false,
        reeds: 160,
        birds: 0
    },
    medium: {
        id: 'medium',
        label: 'Equilibrada',
        pixelRatio: 1.25,
        antialias: true,
        shadows: true,
        shadowSize: 1536,
        bloom: true,
        terrainSegments: 200,
        waterSegments: 156,
        scatterScale: 0.85,
        fogDensity: 0.0015,
        drawDistance: 900,
        pointLights: false,
        reeds: 280,
        birds: 10
    },
    high: {
        id: 'high',
        label: 'Cinemática',
        pixelRatio: 1.5,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        bloom: true,
        terrainSegments: 248,
        waterSegments: 200,
        scatterScale: 1,
        fogDensity: 0.00125,
        drawDistance: 1150,
        pointLights: true,
        reeds: 380,
        birds: 14
    }
};

/**
 * Paleta do "golden hour" medieval. As cores do céu são interpoladas ao longo
 * da corrida (amanhecer enevoado → dourado → crepúsculo sobre o castelo).
 */
export const SKY_STOPS = [
    {
        at: 0,
        zenith: [0.16, 0.32, 0.58],
        horizon: [0.78, 0.72, 0.62],
        ground: [0.16, 0.18, 0.16],
        sun: [1.0, 0.93, 0.74],
        sunDir: [0.62, 0.42, -0.66],
        fog: [0.62, 0.68, 0.72],
        light: [1.0, 0.96, 0.88],
        lightIntensity: 1.72,
        ambient: [0.38, 0.46, 0.58]
    },
    {
        at: 0.45,
        zenith: [0.10, 0.22, 0.48],
        horizon: [0.92, 0.58, 0.28],
        ground: [0.16, 0.12, 0.10],
        sun: [1.0, 0.78, 0.42],
        sunDir: [0.84, 0.28, -0.46],
        fog: [0.58, 0.42, 0.32],
        light: [1.0, 0.84, 0.58],
        lightIntensity: 1.68,
        ambient: [0.36, 0.34, 0.44]
    },
    {
        at: 0.82,
        zenith: [0.05, 0.08, 0.22],
        horizon: [0.72, 0.28, 0.16],
        ground: [0.10, 0.06, 0.07],
        sun: [1.0, 0.52, 0.24],
        sunDir: [0.58, 0.16, -0.80],
        fog: [0.30, 0.16, 0.16],
        light: [1.0, 0.60, 0.36],
        lightIntensity: 1.38,
        ambient: [0.24, 0.22, 0.36]
    },
    {
        at: 1,
        zenith: [0.022, 0.032, 0.10],
        horizon: [0.38, 0.12, 0.12],
        ground: [0.05, 0.035, 0.055],
        sun: [1.0, 0.40, 0.20],
        sunDir: [0.32, 0.08, -0.94],
        fog: [0.16, 0.08, 0.10],
        light: [1.0, 0.48, 0.30],
        lightIntensity: 1.12,
        ambient: [0.18, 0.18, 0.32]
    }
];

/** Batidas narrativas — o rio deixa de ser um corredor vazio. */
export const LANDMARKS = [
    { at: 0.04, text: 'O vale de Eld' },
    { at: 0.22, text: 'As corredeiras' },
    { at: 0.48, text: 'As torres de vigia' },
    { at: 0.72, text: 'O desfiladeiro de Morvain' },
    { at: 0.90, text: 'As muralhas à vista!' }
];

export const COLORS = {
    hull: 0x6b4429,
    hullDark: 0x4a2f1d,
    hullTrim: 0xb98a4b,
    sail: 0xdccfae,
    sailStripe: 0x9c2b2b,
    enemySail: 0x241d28,
    enemyStripe: 0x8b1d1d,
    stone: 0x8d8b86,
    stoneDark: 0x5f5d59,
    roof: 0x5a2f3a,
    gold: 0xf3c96b,
    fire: 0xff8a3c,
    princess: 0xe8b7d4
};

export const STORAGE_KEY = 'river-knight:v1';
