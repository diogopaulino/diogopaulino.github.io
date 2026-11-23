/**
 * Santos Orla 3D — dados geográficos e regras do digital twin.
 *
 * Escala: 1 unidade = 1 metro para tudo que se vê de perto (pessoas, prédios, jardins,
 * faixa de areia). O COMPRIMENTO da orla é comprimido 10×: os ~7 km reais (José Menino →
 * Ponta da Praia) viram 700 m no eixo X (±350), mantendo a ordem e a proporção dos canais.
 *
 * Eixos: +X = leste (Ponta da Praia) · +Z = sul (mar) · −Z = norte (cidade) · +Y = cima.
 * O sol nasce no leste, cruza pelo NORTE (hemisfério sul) e se põe no oeste — por isso
 * os prédios sombreiam a areia no fim da tarde, como na Santos real.
 *
 * Jardins: 5.335 m × ~45–50 m ≈ 218.800 m² (Guinness). Ciclovia ~7,9 km.
 * Camada visual: malha procedural (sem Photorealistic 3D Tiles — exigiriam chave no cliente).
 */

export const STORAGE_KEY = 'santos-orla-3d-v2';

/** Comprimento da orla no mundo (m, comprimido 10×). */
export const ORLA_LENGTH = 700;
export const ORLA_HALF = ORLA_LENGTH * 0.5;

/** Cota do calçadão/jardim acima do nível médio do mar (m). */
export const LAND_Y = 2.6;

/**
 * Faixas no eixo Z (cidade → mar). Cada par é [início, fim] em metros.
 */
export const ZONES = {
    inland: -150,
    buildFront: -30,       // alinhamento das fachadas
    cityWalk: [-30, -25],  // calçada dos prédios
    roadN: [-25, -15.5],   // pista sentido oeste (3 faixas)
    median: [-15.5, -12.5],
    roadS: [-12.5, -3],    // pista sentido leste
    walk: [-3, 3],         // calçadão de pedra portuguesa
    bike: [3.6, 6.6],      // ciclovia
    garden: [7, 40],       // jardins da orla
    promenade: [40, 45.5], // passeio da praia (quiosques, postos)
    wall: 45.8,            // mureta
    sandTop: 47,
    waterline: 116,        // linha d'água na maré média
    walkMax: 131           // até onde dá para entrar no mar andando
};

/** Declividade da areia (m/m) e cota no topo da praia. */
export const SAND_Y0 = 2.0;
export const SAND_SLOPE = SAND_Y0 / (ZONES.waterline - ZONES.sandTop);

/** Profundidade do mar (m, positivo = submerso) — mesma função usada no shader do oceano. */
export function seaDepth(z) {
    return (z - ZONES.waterline) * SAND_SLOPE + Math.max(0, z - 160) * 0.035;
}
// A leste de x = 352 fica o canal do porto (estuário): fundo desce rápido junto ao cais.
export const SEA_DEPTH_GLSL = /* glsl */ `
float gfxSeaDepth(vec2 xz) {
    float beach = (xz.y - ${ZONES.waterline.toFixed(1)}) * ${SAND_SLOPE.toFixed(6)} + max(0.0, xz.y - 160.0) * 0.035;
    float channel = clamp((xz.x - 352.6) * 0.7, -2.0, 9.0);
    return max(beach, channel);
}`;

/**
 * Plataformas sobre a areia/mar na cota do calçadão (entra-se pelo passeio da praia).
 * Dentro da faixa X de uma plataforma, z > mureta pertence só a ela (guarda-corpos nas laterais).
 */
export const PLATFORMS = [
    { id: 'emissario', x0: -336, x1: -300, z1: 172 },
    { id: 'deck', x0: 331, x1: 345, z1: 142 }
];
export function platformAt(x, z) {
    if (z <= ZONES.wall) return null;
    for (const p of PLATFORMS) if (x > p.x0 && x < p.x1 && z < p.z1) return p;
    return null;
}

/** Áreas do jardim sem árvores/canteiros (praças, fontes, edifícios). */
export const GARDEN_KEEPOUT = [
    { x: -104, z: 24, r: 14.5 },
    { x: 175, z: 26, r: 10.5 },
    { x0: 286, x1: 326, z0: 11, z1: 37 }
];

/** Altura do chão caminhável em (x, z). */
export function groundY(x, z) {
    if (z <= ZONES.wall || platformAt(x, z)) return LAND_Y;
    if (z <= ZONES.sandTop) return LAND_Y - (LAND_Y - SAND_Y0) * ((z - ZONES.wall) / (ZONES.sandTop - ZONES.wall));
    return SAND_Y0 - (z - ZONES.sandTop) * SAND_SLOPE;
}

/**
 * Canais da orla (referência popular 1–7, oeste→leste). Largura do canal em metros.
 */
export const CANALS = [
    { id: 1, name: 'Canal 1', avenue: 'Av. Pinheiro Machado', x: -250, width: 7 },
    { id: 2, name: 'Canal 2', avenue: 'Av. Bernardino de Campos', x: -155, width: 7 },
    { id: 3, name: 'Canal 3', avenue: 'Av. Washington Luís', x: -55, width: 7.5 },
    { id: 4, name: 'Canal 4', avenue: 'Av. Siqueira Campos', x: 40, width: 7 },
    { id: 5, name: 'Canal 5', avenue: 'Av. Almirante Cochrane', x: 130, width: 7 },
    { id: 6, name: 'Canal 6', avenue: 'Av. Coronel Joaquim Montenegro', x: 220, width: 7 },
    { id: 7, name: 'Canal 7', avenue: 'Av. General San Martin', x: 295, width: 7.5 }
];

/** Passarela de pedestres sobre cada canal, dentro do jardim (faixa de Z). */
export const FOOTBRIDGE_Z = [21, 25];

/** Praias / bairros entre os canais (e extremos). */
export const BEACHES = [
    { id: 'jose-menino', name: 'José Menino', x0: -ORLA_HALF, x1: -250, vibe: 'surf · pôr do sol' },
    { id: 'pompeia', name: 'Pompéia', x0: -250, x1: -155, vibe: 'família · quiosques' },
    { id: 'gonzaga', name: 'Gonzaga', x0: -155, x1: -55, vibe: 'coração da orla' },
    { id: 'boqueirao', name: 'Boqueirão', x0: -55, x1: 40, vibe: 'calçadão · movimento' },
    { id: 'embare', name: 'Embaré', x0: 40, x1: 130, vibe: 'basílica · jardins amplos' },
    { id: 'aparecida', name: 'Aparecida', x0: 130, x1: 220, vibe: 'Fonte do Sapo' },
    { id: 'ponta', name: 'Ponta da Praia', x0: 220, x1: ORLA_HALF, vibe: 'aquário · canal do porto' }
];

/**
 * Hotspots navegáveis = roteiro da orla. (x, z) = onde o visitante chega; `y` = altura do
 * rótulo; `face` = yaw ao chegar (0 = mar, π = cidade). Descobre-se a ≤ DISCOVER_RADIUS m.
 */
export const DISCOVER_RADIUS = 14;
export const LANDMARKS = [
    {
        id: 'emissario', short: 'Emissário', face: 0,
        name: 'Emissário / Parque Santini',
        blurb: 'Plataforma do emissário submarino: pista de skate e a escultura vermelha de Tomie Ohtake.',
        x: -318, z: 60, y: 9, kind: 'park'
    },
    {
        id: 'urubuquecaba', short: 'Urubuqueçaba', face: -0.8,
        name: 'Ilha Urubuqueçaba',
        blurb: 'Ilhota rochosa coberta de mata no extremo oeste — marco do José Menino.',
        x: -345, z: 106, y: 16, lx: -364, lz: 124, kind: 'rock'
    },
    {
        id: 'bandeiras', short: 'Bandeiras', face: 0,
        name: 'Praça das Bandeiras',
        blurb: 'Coração do Gonzaga: mastros com bandeiras e o trecho mais movimentado dos jardins.',
        x: -104, z: 14, y: 13, kind: 'district'
    },
    {
        id: 'pinacoteca', short: 'Pinacoteca', face: Math.PI,
        name: 'Pinacoteca Benedito Calixto',
        blurb: 'Casarão branco de 1900 que sobreviveu entre as torres do Boqueirão.',
        x: -18, z: -4, y: 15, kind: 'building'
    },
    {
        id: 'basilica', short: 'Basílica', face: Math.PI,
        name: 'Basílica do Embaré',
        blurb: 'Santo Antônio do Embaré — neogótico de frente para o mar.',
        x: 86, z: -4, y: 40, kind: 'building'
    },
    {
        id: 'fonte-sapo', short: 'Fonte do Sapo', face: 0,
        name: 'Fonte do Sapo',
        blurb: 'Ponto clássico da Aparecida — encontro de famílias e patins.',
        x: 175, z: 16, y: 6, kind: 'fountain'
    },
    {
        id: 'aquario', short: 'Aquário', face: Math.PI,
        name: 'Aquário Municipal',
        blurb: 'Primeiro aquário do Brasil (1945), na Ponta da Praia.',
        x: 306, z: 38.5, y: 12, kind: 'building'
    },
    {
        id: 'deck', short: 'Deck', face: 0,
        name: 'Deck do Pescador',
        blurb: 'Vista para o canal do porto, os navios e a Fortaleza da Barra.',
        x: 338, z: 52, y: 6, kind: 'deck'
    }
];

/** Modos de visão da experiência. */
export const VIEW_MODES = {
    tourist: {
        id: 'tourist',
        label: 'Turista',
        hint: 'Hotspots e nomes dos trechos em evidência',
        showLabels: true
    },
    resident: {
        id: 'resident',
        label: 'Morador',
        hint: 'Caminhada livre, HUD mínimo',
        showLabels: false
    },
    map: {
        id: 'map',
        label: 'Mapa',
        hint: 'Vista aérea da orla inteira',
        showLabels: true
    },
    cinematic: {
        id: 'cinematic',
        label: 'Drone',
        hint: 'Voo cinematográfico ao longo da orla',
        showLabels: true
    }
};

/**
 * Orçamentos por tier. Contagens são instâncias; o custo real está em draw calls
 * (quase tudo instanciado/fundido) e em pixels (MSAA + pós).
 */
export const QUALITY = {
    low: {
        id: 'low', pixelRatio: 1, shadows: true, shadowMap: 1024, shadowRadius: 45,
        buildingsBack: 40, palms: 90, trees: 40, shrubs: 220, people: 16, cyclists: 4,
        cars: 14, parked: 16, beachSets: 30, birds: 8, ships: 6, far: 2600
    },
    medium: {
        id: 'medium', pixelRatio: 1.5, shadows: true, shadowMap: 2048, shadowRadius: 60,
        buildingsBack: 70, palms: 170, trees: 80, shrubs: 520, people: 34, cyclists: 8,
        cars: 26, parked: 34, beachSets: 60, birds: 14, ships: 10, far: 4200
    },
    high: {
        id: 'high', pixelRatio: 2, shadows: true, shadowMap: 4096, shadowRadius: 75,
        buildingsBack: 100, palms: 260, trees: 120, shrubs: 900, people: 56, cyclists: 12,
        cars: 40, parked: 52, beachSets: 90, birds: 20, ships: 14, far: 5200
    }
};

/**
 * Horas do dia (hora solar local). O céu é físico: basta a hora para sol, cor e neblina.
 * `exposure` compensa a adaptação do olho; `fog`/`haze` dão a bruma de cada período.
 */
export const DAY_STOPS = [
    { id: 'dawn', label: 'Amanhecer', hour: 6.15, exposure: 1.25, fog: 0.0042, haze: 0.00022, clouds: 0.46 },
    { id: 'day', label: 'Tarde', hour: 14.6, exposure: 1.0, fog: 0.0007, haze: 0.00007, clouds: 0.4 },
    { id: 'golden', label: 'Horário nobre', hour: 17.85, exposure: 1.12, fog: 0.0019, haze: 0.00013, clouds: 0.5 },
    { id: 'night', label: 'Noite', hour: 21.5, exposure: 2.6, fog: 0.0012, haze: 0.0001, clouds: 0.34 }
];

/** Declinação solar usada (graus): −18 ≈ fim de janeiro, alto verão em Santos. */
export const SUN_DECLINATION = -18;

/**
 * Locomoção a pé (unidades SI). Referências: caminhada urbana confortável ≈ 1,4 m/s
 * (5 km/h); trote/corrida leve de orla ≈ 4,2 m/s (15 km/h).
 *   v ← v + clamp(v* − v, ±a·dt)      a = accel se |v*| > |v|, senão decel (m/s²)
 *   cadência: a fase do ciclo de marcha avança 2π a cada `cycleWalk` m (2 passos);
 *   na corrida a passada abre até `cycleRun` m → ~180 passos/min a 4,2 m/s.
 */
export const WALK = {
    speed: 1.4,         // m/s — caminhada (5 km/h)
    runSpeed: 4.2,      // m/s — corrida leve (15 km/h)
    accel: 3.2,         // m/s² — arrancada a pé (~0,45 s até 1,4 m/s)
    runAccel: 4.0,      // m/s² — arrancada correndo (~1 s até 4,2 m/s)
    decel: 6.0,         // m/s² — frear/parar a pé (~0,6 g)
    turnSpeed: 2.4,     // rad/s — giro no teclado (≈ 140°/s)
    radius: 0.32,       // m — raio do corpo para colisão
    spawnZ: 0,
    cycleWalk: 1.38,    // m por ciclo (2 passos de 0,69 m)
    cycleRun: 2.8,      // m por ciclo correndo
    stepsPerMeter: 1.45 // cadência dos pedestres da cidade (life.js)
};

/**
 * Bicicleta compartilhada (modelo longitudinal + bicicleta cinemática):
 *   m·dv/dt = F_pedal − F_rolamento − F_arrasto − F_freio
 *   F_pedal = P / max(v, v₀)     (potência constante; v₀ evita força infinita parado)
 *   F_rolamento = c_rr·m·g        (asfalto 0,008; areia fofa 0,1 → anda a passo de gente)
 *   F_arrasto = ½·ρ·CdA·v²        (ρ = 1,2 kg/m³, CdA = 0,6 m² ciclista sentado)
 * Equilíbrio: 100 W → ~5,6 m/s (20 km/h); 300 W (sprint) → ~8,2 m/s (29 km/h).
 * Direção: ω = v·tan(δ)/L, com δ_max caindo com a velocidade (curvas abertas rápido);
 *   inclinação visual φ = atan(v·ω/g). Abaixo de 1,2 m/s dá para "girar a bike na mão".
 */
export const BIKE = {
    mass: 90,           // kg (ciclista + bicicleta)
    power: 100,         // W pedalando
    sprintPower: 300,   // W com Shift / botão correr
    v0: 1.0,            // m/s (F_pedal parado = P/v₀ → arrancada ~1,1 m/s²)
    crr: 0.008,
    crrSand: 0.1,       // areia fofa: ~1,1 m/s pedalando, ~3,4 m/s no sprint
    coastBrake: 0.5,    // m/s² — freio leve quando solta o pedal (sem embalar indefinidamente)
    cda: 0.6,
    rho: 1.2,
    brake: 4.5,         // m/s² — freio (≈ 0,45 g)
    reverse: 0.8,       // m/s — empurrar a bike para trás
    wheelbase: 1.06,    // m
    steerMax: 0.62,     // rad em baixa velocidade
    steerMin: 0.16,     // rad a 9 m/s
    radius: 0.5,        // m — colisão
    color: 0xf07a22     // laranja das bikes compartilhadas
};

export const INTRO = {
    duration: 8.5
};
