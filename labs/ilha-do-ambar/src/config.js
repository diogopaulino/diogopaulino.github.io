/**
 * Ilha do Âmbar — constantes do parque, espécies e qualidade.
 *
 * 1 unidade = 1 metro. O recinto é uma ilha tropical compacta para o
 * navegador: o jipe percorre o circuito em cerca de um minuto.
 */

export const STORAGE_KEY = 'ilha-do-ambar-v1';

export const WORLD = {
    islandRadius: 118,
    oceanRadius: 240,
    lake: { x: -14, z: -6, r: 22 },
    spawn: { x: 8, z: 56, yaw: Math.PI },
    boundsPad: 6
};

export const JEEP = {
    accel: 18,
    brake: 26,
    friction: 2.4,
    maxSpeed: 16.5,
    reverseMax: 6.2,
    turn: 1.55,
    radius: 1.85,
    height: 1.55,
    wheelBase: 2.6
};

export const CAMERA = {
    distance: 12.5,
    minDistance: 6.5,
    maxDistance: 22,
    height: 5.4,
    lookY: 1.7,
    lookAhead: 10,
    pitchMin: -0.12,
    pitchMax: 0.48,
    defaultPitch: 0.04
};

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 512,
        trees: 0.4,
        grass: 0.25,
        particles: 0.35,
        bloom: false,
        dinoSegs: 0.72
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.4,
        antialias: true,
        shadows: true,
        shadowSize: 1024,
        trees: 0.72,
        grass: 0.7,
        particles: 0.75,
        bloom: true,
        dinoSegs: 0.8
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
        bloom: true,
        dinoSegs: 1
    }
};

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
        observe: 48,
        log: 2.2
    },
    {
        id: 'trex',
        name: 'Tyrannosaurus rex',
        common: 'Tiranossauro',
        era: 'Cretáceo Superior',
        note: 'Visão binocular, olfato de predador de ápice. A cerca do paddock falha. Não fique parado.',
        observe: 34,
        log: 1.6
    },
    {
        id: 'raptor',
        name: 'Velociraptor mongoliensis',
        common: 'Velociraptor',
        era: 'Cretáceo Superior',
        note: 'Caçam em trio. A garra em foice não é enfeite — se o mato mexer em três pontos, saia.',
        observe: 18,
        log: 1.8
    },
    {
        id: 'triceratops',
        name: 'Triceratops horridus',
        common: 'Tricerátops',
        era: 'Cretáceo Superior',
        note: 'O babado ósseo é defesa e corte. Pastam no prado norte, ombro a ombro, como um muro vivo.',
        observe: 26,
        log: 1.8
    },
    {
        id: 'stego',
        name: 'Stegosaurus stenops',
        common: 'Estegossauro',
        era: 'Jurássico Superior',
        note: 'Placas vasculares regulam calor. A cauda com quatro espinhos — o thagomizer — é o argumento final.',
        observe: 24,
        log: 1.8
    },
    {
        id: 'ptera',
        name: 'Pteranodon longiceps',
        common: 'Pteranodonte',
        era: 'Cretáceo Superior',
        note: 'Planam nas térmicas do farol. A crista não é só display: corta o vento como uma quilha invertida.',
        observe: 42,
        log: 2.0
    }
];

export const RADIO = [
    'Central para Unidade 4: o Vale dos Braquiossauros está limpo. Prossiga em baixa.',
    'Meteorologia: névoa no lago até o meio da manhã. Faróis recomendados.',
    'Manutenção: cerca leste do paddock do rex com descarga intermitente.',
    'Lembrete: não desça do veículo. O protocolo existe por um motivo.',
    'Avistamento: trio de raptors no trecho sombreado da trilha sul.',
    'Farol reporta pteranodontes em térmica. Evite a crista com o teto aberto.',
    'Unidade 4, confirme diário de campo. Seis espécies no circuito de hoje.'
];
