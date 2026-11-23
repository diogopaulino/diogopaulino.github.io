/**
 * Neon Rider — constantes, paletas (estações de rádio) e presets de qualidade.
 * A cidade inteira retuna as cores quando o jogador coleta uma fita VHS.
 */

export const STORAGE_KEY = 'neon-rider-v2';
/** Chave antiga (escala de 2,4 m por unidade): só os ajustes são migrados, recordes não. */
const LEGACY_KEY = 'neon-rider-v1';

export const ROAD = {
    laneWidth: 3.6,
    lanes: 4,
    halfWidth: 7.4,
    curb: 8.6,
    buildingGap: 11.2
};

export const CHUNK = {
    length: 52,
    count: 14
};

/**
 * Escala: 1 unidade do mundo = 1 metro (faixa de 3,6 m, carro de 4,2 m, moto de 2,1 m).
 * A física da moto (potência, marchas, arrasto, freio, inclinação) está em physics.js.
 * Aqui ficam só os números de jogo ligados a ela.
 */
export const BIKE = {
    /** Caixa de colisão da moto no plano XZ (m): guidão + piloto, entre-eixos + pneus. */
    width: 0.8,
    length: 2.1,
    /** Velocidade de largada ao apertar Jogar (m/s) — sai já rodando, em 2ª/3ª. */
    startSpeed: 50 / 3.6,
    /** Invulnerabilidade após batida (s): a moto pisca e atravessa carros. */
    invuln: 2.2,
    /** Raio visual da roda do modelo 3D (m), só para o giro da roda casar com o chão. */
    wheelVisualRadius: 0.38
};

/** Estações: cada fita troca o "broadcast" da cidade (néon + rádio). Sem astros. */
export const STATIONS = [
    {
        id: 'wave',
        name: 'WAVE 84',
        tagline: 'synth · meia-noite',
        neonA: 0xff2bd6,
        neonB: 0x00f0ff,
        fog: 0x14081f,
        horizon: 0xff3eb5,
        zenith: 0x06010c,
        ground: 0x04020a,
        asphalt: 0x12101c,
        window: 0xffc4a0,
        lamp: 0xffe7b0
    },
    {
        id: 'vhs',
        name: 'VHS FM',
        tagline: 'chroma · tracking',
        neonA: 0xff6a00,
        neonB: 0xffd428,
        fog: 0x1a0c08,
        horizon: 0xff7a28,
        zenith: 0x0c0604,
        ground: 0x0a0402,
        asphalt: 0x1a1210,
        window: 0xffd9a0,
        lamp: 0xffcc77
    },
    {
        id: 'arcade',
        name: 'ARCADE AM',
        tagline: 'fósforo · 1-up',
        neonA: 0x39ff14,
        neonB: 0x00ffe0,
        fog: 0x04140c,
        horizon: 0x2dff9a,
        zenith: 0x020a08,
        ground: 0x02100a,
        asphalt: 0x0c1412,
        window: 0xc8ffd4,
        lamp: 0xe8ffc8
    },
    {
        id: 'disco',
        name: 'DISCO 12',
        tagline: 'esfera · glitter',
        neonA: 0xff3ea5,
        neonB: 0x7a5cff,
        fog: 0x12081c,
        horizon: 0xff5ad5,
        zenith: 0x080414,
        ground: 0x060310,
        asphalt: 0x141018,
        window: 0xffd0ff,
        lamp: 0xf0d0ff
    }
];

/**
 * Dificuldades: cada uma é uma moto real da categoria (physics.js#BIKES) e um trânsito.
 *   goal     — distância até a chegada (m), ~70–90 s de corrida no ritmo da moto.
 *   density  — carros por 100 m de avenida (4 faixas).
 *   kmh      — faixa de velocidade dos carros (trânsito urbano noturno, 40–80 km/h).
 *              A faixa da esquerda é a mais rápida (+15 %), a da direita a mais lenta (−15 %).
 *   shift    — chance por segundo de um carro à frente trocar de faixa (com seta antes).
 *   Tempo estimado ≈ goal / v_média; v_média ≈ 75 % da vmax da moto descontando frenagens.
 */
export const DIFFICULTY = {
    cruise: {
        id: 'cruise',
        label: 'Passeio',
        blurb: 'Naked 700 (0–100 em 4,2 s, 192 km/h). Pouco trânsito, 5 créditos, 3 km.',
        bike: 'naked',
        density: 1.8,
        kmh: [40, 60],
        shift: 0.05,
        tapes: 1.35,
        lives: 5,
        goal: 3000
    },
    night: {
        id: 'night',
        label: 'Madrugada',
        blurb: 'Street 765 (0–100 em 3,5 s, 233 km/h). Avenida cheia, 3 créditos, 4,5 km.',
        bike: 'sport',
        density: 2.7,
        kmh: [45, 70],
        shift: 0.1,
        tapes: 1,
        lives: 3,
        goal: 4500
    },
    turbo: {
        id: 'turbo',
        label: 'Turbo',
        blurb: 'Superbike 1000 (0–100 em 3,1 s, 308 km/h). Trânsito agressivo, 2 créditos, 6 km.',
        bike: 'superbike',
        density: 3.4,
        kmh: [50, 80],
        shift: 0.16,
        tapes: 0.75,
        lives: 2,
        goal: 6000
    }
};

/** Pontos: placar = metros percorridos + 300 por fita + 150 por ultrapassagem raspando. */
export const SCORE = { tape: 300, nearMiss: 150 };

export const QUALITY = {
    low: {
        id: 'low',
        antialias: false,
        pixelRatio: 1,
        bloom: false,
        shadows: false,
        lamps: 0,
        drawDistance: 140,
        fogDensity: 0.018,
        chunkProps: 0.28,
        particles: 20
    },
    medium: {
        id: 'medium',
        antialias: false,
        pixelRatio: 1.25,
        bloom: false,
        shadows: false,
        lamps: 2,
        drawDistance: 240,
        fogDensity: 0.012,
        chunkProps: 0.55,
        particles: 80
    },
    high: {
        id: 'high',
        antialias: true,
        pixelRatio: 1.75,
        bloom: true,
        shadows: true,
        lamps: 6,
        drawDistance: 380,
        fogDensity: 0.0068,
        chunkProps: 1,
        particles: 200
    }
};

const CAMERA_COUNT = 3;

function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
}

export function loadSettings() {
    const fallback = {
        difficulty: 'cruise',
        quality: 'auto',
        volume: 72,
        muted: false,
        autoThrottle: true,
        shake: true,
        camera: 0,
        /** Recordes por dificuldade: { [id]: { time: s | null, dist: m, score } } */
        records: {}
    };
    const saved = readJson(STORAGE_KEY) || (() => {
        const old = readJson(LEGACY_KEY);
        if (!old || typeof old !== 'object') return null;
        return { difficulty: old.difficulty, quality: old.quality, volume: old.volume, muted: old.muted };
    })();
    if (!saved || typeof saved !== 'object') return fallback;
    const out = { ...fallback, ...saved };
    // valor antigo/corrompido no localStorage não pode derrubar o menu
    if (!DIFFICULTY[out.difficulty]) out.difficulty = fallback.difficulty;
    if (!['auto', 'low', 'medium', 'high'].includes(out.quality)) out.quality = 'auto';
    out.volume = Number.isFinite(out.volume) ? Math.min(100, Math.max(0, out.volume)) : fallback.volume;
    out.muted = Boolean(out.muted);
    out.autoThrottle = out.autoThrottle !== false;
    out.shake = out.shake !== false;
    out.camera = Number.isInteger(out.camera) && out.camera >= 0 && out.camera < CAMERA_COUNT ? out.camera : 0;
    if (!out.records || typeof out.records !== 'object') out.records = {};
    return out;
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            difficulty: settings.difficulty,
            quality: settings.quality,
            volume: settings.volume,
            muted: settings.muted,
            autoThrottle: settings.autoThrottle,
            shake: settings.shake,
            camera: settings.camera,
            records: settings.records
        }));
    } catch (err) {
        /* modo privado / cota cheia: o jogo segue sem salvar */
    }
}
