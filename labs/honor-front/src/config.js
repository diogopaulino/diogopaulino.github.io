/**
 * Honor Front — constantes, missão e presets de qualidade.
 *
 * Homenagem visual a Medal of Honor (praia, muralha, vila, bateria).
 * Textos, mapas e armas originais — nenhum asset oficial.
 */

export const STORAGE_KEY = 'honor-front-v1';

export const PLAYER = {
    walk: 4.55,
    sprint: 7.35,
    radius: 0.42,
    height: 1.72,
    eye: 1.58,
    jump: 6.2,
    gravity: 22,
    invuln: 0.85,
    maxHealth: 100,
    adsFov: 42,
    hipFov: 68,
    waterSlow: 0.42
};

export const QUALITY = {
    low: {
        id: 'low',
        pixelRatio: 1,
        antialias: false,
        shadows: false,
        shadowSize: 512,
        terrain: 96,
        trees: 0.4,
        particles: 180,
        fog: 0.018,
        far: 280
    },
    medium: {
        id: 'medium',
        pixelRatio: 1.35,
        antialias: true,
        shadows: true,
        shadowSize: 1024,
        terrain: 140,
        trees: 0.75,
        particles: 420,
        fog: 0.014,
        far: 380
    },
    high: {
        id: 'high',
        pixelRatio: 1.7,
        antialias: true,
        shadows: true,
        shadowSize: 2048,
        terrain: 180,
        trees: 1,
        particles: 720,
        fog: 0.011,
        far: 460
    }
};

export const DIFFICULTY = {
    ranger: {
        id: 'ranger',
        label: 'Ranger',
        blurb: 'Supressão justa, recarga generosa. O desembarque ainda dói.',
        enemyDamage: 9,
        enemyAcc: 0.42,
        health: 100,
        magBonus: 1
    },
    veteran: {
        id: 'veteran',
        label: 'Veterano',
        blurb: 'A praia não perdoa. Mira inimiga mais fria, vital mais curto.',
        enemyDamage: 16,
        enemyAcc: 0.62,
        health: 80,
        magBonus: 0
    }
};

export const WEAPONS = {
    garand: {
        id: 'garand',
        name: 'M1 GARAND',
        magSize: 8,
        reserve: 48,
        rpm: 320,
        damage: 62,
        spread: 0.012,
        adsSpread: 0.0035,
        auto: false,
        recoil: 0.028,
        reload: 2.15
    },
    thompson: {
        id: 'thompson',
        name: 'THOMPSON M1A1',
        magSize: 30,
        reserve: 90,
        rpm: 680,
        damage: 24,
        spread: 0.028,
        adsSpread: 0.01,
        auto: true,
        recoil: 0.018,
        reload: 1.85
    }
};

/**
 * Cinco batidas da missão — cada uma destrava um cartão cinematográfico.
 * Coordenadas no eixo +Z (do mar para o interior).
 */
export const OBJECTIVES = [
    {
        id: 'beach',
        roman: 'I',
        title: 'A praia',
        tag: 'I · Desembarque',
        text: 'Alcance a muralha da praia.',
        radio: 'Ranger, a rampa cai. Não fique no aberto — a MG da muralha varre a areia.',
        check: 'z',
        z: 84
    },
    {
        id: 'mg',
        roman: 'II',
        title: 'Ninho de MG',
        tag: 'II · Muralha',
        text: 'Plante a carga no ninho de metralhadora.',
        radio: 'Silencie aquele ninho. Carga no vão da casamata — depois siga à vila.',
        check: 'interact',
        interact: 'mg'
    },
    {
        id: 'village',
        roman: 'III',
        title: 'Sainte-Claire',
        tag: 'III · Vila',
        text: 'Avance até a praça da igreja.',
        radio: 'A vila está ocupada. Use as paredes. A praça da igreja é o corredor para o penhasco.',
        check: 'z',
        z: 178
    },
    {
        id: 'gun',
        roman: 'IV',
        title: 'A bateria',
        tag: 'IV · Penhasco',
        text: 'Destrua o canhão costeiro.',
        radio: 'Aquele canhão afunda a segunda onda. Carga na culatra. Afaste-se.',
        check: 'interact',
        interact: 'gun'
    },
    {
        id: 'flare',
        roman: 'V',
        title: 'O sinal',
        tag: 'V · Extração',
        text: 'Dispare o sinalizador no penhasco.',
        radio: 'A frota precisa ver o setor. Suba e queime o céu.',
        check: 'interact',
        interact: 'flare'
    }
];

export const WORLD = {
    waterY: 0.12,
    minX: -48,
    maxX: 48,
    minZ: -42,
    maxZ: 292,
    boatStartZ: -34,
    boatEndZ: 7.5,
    boatDuration: 14
};

export function loadSettings() {
    const fallback = {
        quality: 'auto',
        volume: 72,
        muted: false,
        difficulty: 'ranger',
        best: 0
    };
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
    } catch (err) {
        return fallback;
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) { /* privado */ }
}
