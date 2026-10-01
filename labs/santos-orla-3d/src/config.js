/**
 * Santos Orla 3D — dados geográficos e regras do digital twin.
 *
 * Escala: 1 unidade ≈ 10 metros. A orla real tem ~7 km (José Menino → Ponta da Praia);
 * aqui o eixo X cobre 700 u (±350). Canais 1–7 e landmarks seguem a ordem oeste→leste
 * usada pela cidade (Saturnino de Brito / nomenclatura popular da orla).
 *
 * Jardins: 5.335 m × ~45–50 m ≈ 218.800 m² (Guinness). Ciclovia ~7,9 km.
 * Camada visual: malha procedural contemporânea (não Photorealistic 3D Tiles —
 * esses exigiriam chave Google Map Tiles no cliente).
 */

export const STORAGE_KEY = 'santos-orla-3d-v1';

/** Comprimento da orla no mundo (u). */
export const ORLA_LENGTH = 700;
export const ORLA_HALF = ORLA_LENGTH * 0.5;

/** Faixas no eixo Z (mar → cidade). */
export const ZONES = {
    oceanFar: 180,
    oceanNear: 55,
    sandOuter: 42,
    sandInner: 28,
    gardenOuter: 26,
    gardenInner: 8,
    bikePath: 5.5,
    sidewalk: 3.5,
    avenue: 0,
    buildings: -18,
    inland: -90
};

/**
 * Canais da orla (referência popular 1–7, oeste→leste).
 * Avenidas oficiais aproximadas; x em unidades do lab.
 */
export const CANALS = [
    { id: 1, name: 'Canal 1', avenue: 'Av. Pinheiro Machado', x: -250, width: 4.2 },
    { id: 2, name: 'Canal 2', avenue: 'Av. Bernardino de Campos', x: -155, width: 4.2 },
    { id: 3, name: 'Canal 3', avenue: 'Av. Washington Luís', x: -55, width: 4.5 },
    { id: 4, name: 'Canal 4', avenue: 'Av. Siqueira Campos', x: 40, width: 4.2 },
    { id: 5, name: 'Canal 5', avenue: 'Av. Almirante Cochrane', x: 130, width: 4.2 },
    { id: 6, name: 'Canal 6', avenue: 'Av. Coronel Joaquim Montenegro', x: 220, width: 4.2 },
    { id: 7, name: 'Canal 7', avenue: 'Av. General San Martin', x: 295, width: 4.5 }
];

/** Praias / bairros entre os canais (e extremos). */
export const BEACHES = [
    { id: 'jose-menino', name: 'José Menino', x0: -ORLA_HALF, x1: -250, vibe: 'surf · pôr do sol' },
    { id: 'pompeia', name: 'Pompéia', x0: -250, x1: -155, vibe: 'família · quiosques' },
    { id: 'gonzaga', name: 'Gonzaga', x0: -155, x1: -55, vibe: 'coração da orla' },
    { id: 'boqueirao', name: 'Boqueirão', x0: -55, x1: 40, vibe: 'calçadão · movimento' },
    { id: 'embare', name: 'Embaré', x0: 40, x1: 130, vibe: 'jardins amplos' },
    { id: 'aparecida', name: 'Aparecida', x0: 130, x1: 220, vibe: 'Fonte do Sapo' },
    { id: 'ponta', name: 'Ponta da Praia', x0: 220, x1: ORLA_HALF, vibe: 'aquário · porto' }
];

/** Hotspots navegáveis. */
export const LANDMARKS = [
    {
        id: 'emissario',
        name: 'Emissário / Parque Santini',
        blurb: 'Mirante e pista de skate sobre a plataforma do emissário submarino.',
        x: -320,
        z: 18,
        kind: 'park'
    },
    {
        id: 'urubuquecaba',
        name: 'Urubuqueçaba',
        blurb: 'Formação rochosa no extremo oeste — marco visual do José Menino.',
        x: -340,
        z: 48,
        kind: 'rock'
    },
    {
        id: 'gonzaga',
        name: 'Gonzaga',
        blurb: 'Trecho mais movimentado: jardins, ciclovia e vida de calçadão.',
        x: -100,
        z: 12,
        kind: 'district'
    },
    {
        id: 'fonte-sapo',
        name: 'Fonte do Sapo',
        blurb: 'Ponto clássico da Aparecida — encontro de famílias e patins.',
        x: 175,
        z: 10,
        kind: 'fountain'
    },
    {
        id: 'aquario',
        name: 'Aquário Municipal',
        blurb: 'Primeiro aquário do Brasil (1945), na Ponta da Praia.',
        x: 310,
        z: 8,
        kind: 'building'
    },
    {
        id: 'deck',
        name: 'Deck do Pescador',
        blurb: 'Vista para o canal do porto e embarcações de pesca.',
        x: 335,
        z: 22,
        kind: 'deck'
    }
];

/** Modos de visão da experiência. */
export const VIEW_MODES = {
    tourist: {
        id: 'tourist',
        label: 'Turista',
        hint: 'Hotspots e nomes dos trechos em evidência',
        showLabels: true,
        showPath: true,
        height: 2.0
    },
    resident: {
        id: 'resident',
        label: 'Morador',
        hint: 'Caminhada livre, HUD mínimo',
        showLabels: false,
        showPath: false,
        height: 1.7
    },
    map: {
        id: 'map',
        label: 'Mapa',
        hint: 'Vista aérea ortográfica da orla inteira',
        showLabels: true,
        showPath: true,
        height: 220
    },
    cinematic: {
        id: 'cinematic',
        label: 'Drone',
        hint: 'Voo cinematográfico ao longo dos 7 km',
        showLabels: true,
        showPath: false,
        height: 28
    }
};

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        buildingCount: 48,
        palmCount: 120,
        peopleCount: 18,
        waterSeg: 64,
        fogFar: 280
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.5,
        antialias: true,
        shadows: true,
        buildingCount: 90,
        palmCount: 220,
        peopleCount: 40,
        waterSeg: 96,
        fogFar: 360
    },
    high: {
        id: 'high',
        pixelRatio: 2,
        antialias: true,
        shadows: true,
        buildingCount: 140,
        palmCount: 360,
        peopleCount: 70,
        waterSeg: 140,
        fogFar: 420
    }
};

/** Paletas de hora do dia (céu + luz). */
export const DAY_STOPS = [
    {
        id: 'dawn',
        label: 'Amanhecer',
        zenith: [0.25, 0.38, 0.62],
        horizon: [0.95, 0.55, 0.38],
        ground: [0.55, 0.42, 0.35],
        sun: [1.0, 0.72, 0.45],
        sunDir: [0.55, 0.18, 0.35],
        fog: [0.72, 0.62, 0.58],
        exposure: 0.95
    },
    {
        id: 'day',
        label: 'Tarde',
        zenith: [0.22, 0.48, 0.88],
        horizon: [0.62, 0.78, 0.95],
        ground: [0.55, 0.62, 0.58],
        sun: [1.0, 0.95, 0.85],
        sunDir: [0.35, 0.72, 0.25],
        fog: [0.68, 0.78, 0.88],
        exposure: 1.05
    },
    {
        id: 'golden',
        label: 'Horário nobre',
        zenith: [0.18, 0.32, 0.58],
        horizon: [0.98, 0.48, 0.28],
        ground: [0.48, 0.35, 0.28],
        sun: [1.0, 0.58, 0.28],
        sunDir: [-0.55, 0.22, 0.4],
        fog: [0.78, 0.55, 0.42],
        exposure: 1.0
    },
    {
        id: 'night',
        label: 'Noite',
        zenith: [0.02, 0.04, 0.1],
        horizon: [0.08, 0.1, 0.18],
        ground: [0.04, 0.05, 0.07],
        sun: [0.55, 0.65, 0.95],
        sunDir: [0.2, 0.55, -0.4],
        fog: [0.06, 0.08, 0.12],
        exposure: 0.72
    }
];

export const WALK = {
    speed: 9.5,
    runMult: 1.75,
    eyeHeight: 1.7,
    turnSpeed: 1.85,
    pathZ: 12,
    pathHalfWidth: 9
};

export const INTRO = {
    duration: 11,
    startY: 260,
    startZ: 90,
    endY: 2.4,
    endZ: 14
};
