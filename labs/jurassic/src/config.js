/**
 * Jurassic — constantes do parque, espécies e qualidade.
 *
 * 1 unidade = 1 metro. O recinto é uma ilha tropical compacta para o
 * navegador: o jipe percorre o circuito em cerca de um minuto e meio.
 *
 * Planta (x cresce para leste, z para o norte do mapa — o portão fica em +z):
 *   portão (4, 92) → trilha em laço → lago central (−14, −6)
 *   paddock do rex a leste · prado dos tricerátops a noroeste
 *   crista dos estegossauros a sudoeste · clareira dos raptors ao sul
 *   farol no promontório sudeste
 */

export const STORAGE_KEY = 'jurassic-v1';

export const WORLD = {
    /** Raio médio da linha d'água; a costa ondula ±14 m (ver coastRadius em world.js). */
    islandRadius: 140,
    size: 380,
    lake: { x: -14, z: -6, radius: 25 },
    spawn: { x: 4.1, z: 109, yaw: Math.PI },
    gate: { x: 4, z: 93 },
    center: { x: -17, z: 111 },
    paddock: { x: 66, z: 14, rx: 27, rz: 23, gap: Math.PI * 1.36 },
    meadow: { x: -76, z: 36, radius: 30 },
    ridge: { x: -64, z: -58 },
    raptors: { x: 26, z: -62, radius: 20 },
    tower: { x: 88, z: -66 },
    /** Laço principal (fechado) e ramais de terra batida. */
    loop: [
        [6, 73], [20, 60], [31, 42], [34, 22], [33, 2], [24, -22], [10, -42], [-10, -56],
        [-28, -52], [-42, -36], [-50, -12], [-48, 16], [-38, 42], [-18, 58], [-3, 69]
    ],
    spurGate: [[4, 116], [4, 100], [4.4, 86], [5.5, 76], [9, 70]],
    spurTower: [[25, -21], [40, -31], [56, -43], [70, -53], [79, -60]],
    spurRidge: [[-43, -35], [-52, -42], [-58, -50], [-60, -58]],
    stegoWalk: [[-88, -36], [-78, -46], [-68, -57], [-58, -68], [-48, -80]]
};

/**
 * Jipe — utilitário 4×4 de safári com unidades SI (m, kg, s, N, W).
 * As fórmulas estão no cabeçalho de jeep.js. Referências de bancada:
 *   0–50 km/h ≈ 4 s · 0–80 km/h ≈ 9 s na trilha (equivale a 0–100 em ~13 s sem o regulador)
 *   máxima 80 km/h na terra batida (regulador do parque) · ~50 km/h no mato
 *   frenagem 80→0 ≈ 22 m na trilha seca (μ = 0,75, ABS)
 *   raio mínimo de giro ≈ 5 m · rolagem ≈ 3° a 0,4 g
 */
export const JEEP = {
    mass: 2100,            // kg: chassi, quatro ocupantes e equipamento
    power: 80000,          // W entregues às rodas (≈ 110 cv no motor, 25 % de perda)
    maxForce: 8200,        // N: força de tração máxima em 1ª (torque × redução / raio) ≈ 0,4 g
    lowRangeSlope: 0.15,   // tan θ a partir da qual a reduzida automática entra (subida)
    lowRangeSpeed: 6,      // m/s: a reduzida só atua devagar
    cdA: 1.75,             // m²: Cd 0,55 × área frontal 3,2 m²
    airDensity: 1.2,       // kg/m³
    crrRoad: 0.025,        // resistência ao rolamento na terra batida
    crrOff: 0.06,          // no capim/solo fofo
    rough: 24,             // N/(m/s)²: perda nas irregularidades fora da trilha (pancada da suspensão)
    muRoad: 0.75,          // atrito pneu-chão na trilha
    muOff: 0.58,           // no capim
    wetGrip: 0.8,          // multiplicador com o chão molhado
    brakeDecel: 8,         // m/s² pedidos pelo pedal no fundo (limitado por μ·g)
    engineBrake: 350,      // N: freio-motor fixo (+ 18·v)
    governor: 22.8,        // m/s: regulador do parque (corta suave e assenta em ~80 km/h)
    reverseMax: 5.5,       // m/s (~20 km/h) em ré
    steerMax: 0.5,         // rad: esterço máximo das rodas dianteiras parado
    steerRate: 2.6,        // rad/s: velocidade da caixa de direção
    yawLag: 0.12,          // s: constante de tempo da guinada (inércia do chassi)
    latStiff: 9,           // 1/s: quão rápido o pneu anula o deslizamento lateral
    radius: 1.9,
    wheelBase: 2.56,
    track: 1.62,
    wheelRadius: 0.43,
    gears: [7, 12.5, 18, 23.5] // m/s em que cada marcha chega a 4000 rpm (câmbio automático, só para o som e o HUD)
};

/** Câmera de perseguição: rumo suavizado, mola por eixo e campo de visão com a velocidade. */
export const CAMERA = {
    distance: 9.5,
    minDistance: 6,
    maxDistance: 20,
    height: 3.6,
    lookY: 1.5,
    lookAhead: 9,
    pitchMin: -0.14,
    pitchMax: 0.5,
    defaultPitch: 0.02,
    headingLambda: 3.2,    // 1/s: quão rápido o rumo da câmera alcança o do jipe
    posLambda: 7,          // 1/s: mola horizontal
    heightLambda: 3.5,     // 1/s: mola vertical (mais lenta: não sacode nos buracos)
    recenter: 1.8,         // s sem mexer o mouse/dedo até a câmera voltar para trás do jipe
    fovKick: 7             // graus a mais na velocidade máxima
};

/**
 * Ataque do rex — perseguição justa:
 *   aviso   ao chegar a `windupDist` m e de frente para o jipe, ele trava 0,6 s (HUD pisca "bote")
 *   bote    0,35 s a 1,5× a corrida (~4,3 m de alcance); acerta se o jipe ainda estiver a ≤ `biteDist` m
 *           → parado, leva a mordida; acelerando a ≥ 6 m/s durante o aviso, escapa
 *   dano    1 ponto de integridade (o jipe tem `hull`); empurrão de `knockback` m/s para longe
 *   folga   `iframes` s invulnerável depois de cada mordida; o rex recua e ruge 1,4 s
 * Corrida do rex ≈ 8,2 m/s (30 km/h): o jipe passa disso em ~2,5 s acelerando na trilha.
 */
export const REX = {
    windupDist: 7,
    windup: 0.6,
    lunge: 0.35,
    lungeBoost: 1.5,
    biteDist: 4.6,
    recover: 1.4,
    knockback: 5,
    iframes: 2.5,
    hull: 3,
    chaseMax: 12
};

/**
 * Carga por tier (o palco, o terreno e a grama já têm os seus próprios orçamentos).
 *   trees      árvores da selva            lod        distância malha → impostor (m)
 *   ferns…     plantas fotogramétricas     dinoNear   detalhe do dinossauro perto / longe
 *   nearDist   troca de LOD do dinossauro  rain       gotas de chuva
 *   cullDist   além disso o animal some     burst      partículas novas por quadro (teto)
 */
export const QUALITY = {
    low: {
        id: 'low', grass: 26, grassRange: 22, trees: 240, lod: 20, ferns: 50, shrubs: 26, rocks: 16, dinoNear: 1, dinoFar: 0, nearDist: 30,
        rain: 1400, particles: 160, puddles: 26, headShadow: false, transmission: false, heroDetail: 1, flock: 3, cullDist: 150, burst: 24
    },
    medium: {
        id: 'medium', grass: 55, grassRange: 45, trees: 520, lod: 30, ferns: 150, shrubs: 70, rocks: 34, dinoNear: 2, dinoFar: 1, nearDist: 32,
        rain: 3600, particles: 320, puddles: 46, headShadow: true, transmission: false, heroDetail: 1, flock: 4, cullDist: 200, burst: 40
    },
    high: {
        id: 'high', grass: 80, grassRange: 62, trees: 700, lod: 38, ferns: 260, shrubs: 110, rocks: 48, dinoNear: 2, dinoFar: 1, nearDist: 40,
        rain: 6000, particles: 480, puddles: 64, headShadow: true, transmission: false, heroDetail: 1, flock: 5, cullDist: 250, burst: 60
    }
};

/**
 * Hora do dia (tecla T). Cada parada usa um preset de atmosfera do palco.
 * Com chuva (tecla R) o preset vira 'tempestade' mantendo a hora.
 */
export const DAY_STOPS = [
    { label: 'Manhã de névoa', preset: 'neblina-floresta', hour: 7.6 },
    { label: 'Meio-dia', preset: 'dia-claro', hour: 11.2 },
    { label: 'Entardecer', preset: 'entardecer', hour: 17.1 },
    { label: 'Noite de lua', preset: 'noite-lua', hour: 22 }
];

/**
 * Espécies catalogáveis. `observe` é o raio em que o dossiê abre;
 * `log` é o tempo em segundos olhando para registrar no diário.
 */
export const SPECIES = [
    {
        id: 'brachio',
        name: 'Brachiosaurus altithorax',
        common: 'Braquiossauro',
        era: 'Jurássico Superior',
        note: 'O pescoço sobe até a copa. No lago, eles bebem em silêncio — o chão treme só quando o peso muda de pata.',
        observe: 52,
        log: 2.2
    },
    {
        id: 'trex',
        name: 'Tyrannosaurus rex',
        common: 'Tiranossauro',
        era: 'Cretáceo Superior',
        note: 'Visão binocular, olfato de predador de ápice. A cerca do paddock falha. Não fique parado.',
        observe: 40,
        log: 1.6
    },
    {
        id: 'raptor',
        name: 'Velociraptor mongoliensis',
        common: 'Velociraptor',
        era: 'Cretáceo Superior',
        note: 'Caçam em bando. A garra em foice não é enfeite — se o mato mexer em três pontos, saia.',
        observe: 30,
        log: 1.8
    },
    {
        id: 'triceratops',
        name: 'Triceratops horridus',
        common: 'Tricerátops',
        era: 'Cretáceo Superior',
        note: 'O babado ósseo é defesa e corte. Pastam no prado norte, ombro a ombro, como um muro vivo.',
        observe: 36,
        log: 1.8
    },
    {
        id: 'stego',
        name: 'Stegosaurus stenops',
        common: 'Estegossauro',
        era: 'Jurássico Superior',
        note: 'Placas vasculares regulam calor. A cauda com quatro espinhos — o thagomizer — é o argumento final.',
        observe: 34,
        log: 1.8
    },
    {
        id: 'ptera',
        name: 'Pteranodon longiceps',
        common: 'Pteranodonte',
        era: 'Cretáceo Superior',
        note: 'Planam nas térmicas do farol. A crista não é só display: corta o vento como uma quilha invertida.',
        observe: 60,
        log: 2.0
    }
];

export const RADIO = [
    'Central para Unidade 4: o Vale dos Braquiossauros está limpo. Prossiga em baixa.',
    'Meteorologia: névoa no lago até o meio da manhã. Faróis recomendados.',
    'Manutenção: cerca oeste do paddock do rex com descarga intermitente.',
    'Lembrete: não desça do veículo. O protocolo existe por um motivo.',
    'Avistamento: bando de raptors na clareira da trilha sul.',
    'Farol reporta pteranodontes em térmica. Siga o ramal do promontório.',
    'Unidade 4, confirme diário de campo. Seis espécies no circuito de hoje.',
    'Estegossauros em fila na crista sudoeste. O ramal sobe até o mirante.'
];
