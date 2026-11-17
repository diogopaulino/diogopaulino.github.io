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
 * Jipe — física arcade.
 *   aceleração = accel·aderência; aderência = 1 na trilha, 0,55 fora dela, ×0,85 na chuva
 *   suspensão: mola k e amortecedor c por roda (ver jeep.js)
 */
export const JEEP = {
    accel: 15,
    brake: 26,
    friction: 2.2,
    maxSpeed: 16.5,
    reverseMax: 6.2,
    turn: 1.5,
    radius: 1.9,
    wheelBase: 2.56,
    track: 1.62,
    wheelRadius: 0.43
};

export const CAMERA = {
    distance: 9.5,
    minDistance: 6,
    maxDistance: 20,
    height: 3.6,
    lookY: 1.5,
    lookAhead: 9,
    pitchMin: -0.14,
    pitchMax: 0.5,
    defaultPitch: 0.02
};

/**
 * Carga por tier (o palco, o terreno e a grama já têm os seus próprios orçamentos).
 *   trees      árvores da selva            lod        distância malha → impostor (m)
 *   ferns…     plantas fotogramétricas     dinoNear   detalhe do dinossauro perto / longe
 *   nearDist   troca de LOD do dinossauro  rain       gotas de chuva
 */
export const QUALITY = {
    low: {
        id: 'low', grass: 26, grassRange: 22, trees: 240, lod: 20, ferns: 50, shrubs: 26, rocks: 16, dinoNear: 1, dinoFar: 0, nearDist: 30,
        rain: 1400, particles: 160, puddles: 26, headShadow: false, transmission: false, heroDetail: 1, flock: 3
    },
    medium: {
        id: 'medium', grass: 55, grassRange: 45, trees: 520, lod: 30, ferns: 150, shrubs: 70, rocks: 34, dinoNear: 2, dinoFar: 1, nearDist: 32,
        rain: 3600, particles: 320, puddles: 46, headShadow: true, transmission: false, heroDetail: 1, flock: 4
    },
    high: {
        id: 'high', grass: 80, grassRange: 62, trees: 700, lod: 38, ferns: 260, shrubs: 110, rocks: 48, dinoNear: 2, dinoFar: 1, nearDist: 40,
        rain: 6000, particles: 480, puddles: 64, headShadow: true, transmission: false, heroDetail: 1, flock: 5
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
