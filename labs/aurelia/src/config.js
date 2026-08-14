/**
 * Garage, céus, qualidade e eventos do Festival Aurélia.
 * Estética Forza Horizon: festival à beira-mar, hora dourada, supercarros.
 */

export const CARS = [
    {
        id: 'veloce',
        name: 'Veloce GT',
        maker: 'Aurelia',
        class: 'S1',
        year: 2024,
        blurb: 'Gran turismo italiano: equilíbrio, canto e um V8 que canta no sunset.',
        color: 0xc4122f,
        accent: 0x111318,
        caliper: 0xf5c542,
        mass: 1480,
        power: 520000,
        brake: 28000,
        drag: 0.32,
        grip: 1.42,
        steer: 0.52,
        wheelbase: 2.72,
        ride: 0.14,
        redline: 8200,
        idle: 850,
        gears: [90, 62, 44, 34, 27, 22, 18],
        body: 'gt',
        number: 21
    },
    {
        id: 'storm',
        name: 'Storm Hyper',
        maker: 'Nimbus',
        class: 'X',
        year: 2026,
        blurb: 'Hiper-carro elétrico-híbrido. 0–100 em um suspiro. A costa vira um smeer.',
        color: 0x12141a,
        accent: 0xd4af5a,
        caliper: 0xff4d2e,
        mass: 1420,
        power: 980000,
        brake: 34000,
        drag: 0.28,
        grip: 1.58,
        steer: 0.46,
        wheelbase: 2.78,
        ride: 0.10,
        redline: 9000,
        idle: 400,
        gears: [70, 48, 36, 28, 22, 18, 15],
        body: 'hyper',
        number: 7
    },
    {
        id: 'pacific',
        name: 'Pacific V8',
        maker: 'Westshore',
        class: 'A',
        year: 1971,
        blurb: 'Muscle clássico: capô longo, traseira solta e derrapagens de cinema.',
        color: 0x1c4f9c,
        accent: 0xe8dcc8,
        caliper: 0xc9a227,
        mass: 1680,
        power: 430000,
        brake: 22000,
        drag: 0.42,
        grip: 1.12,
        steer: 0.58,
        wheelbase: 2.92,
        ride: 0.16,
        redline: 6800,
        idle: 700,
        gears: [78, 52, 38, 28, 22],
        body: 'muscle',
        number: 44
    },
    {
        id: 'nimbus',
        name: 'Nimbus Rally',
        maker: 'Serra',
        class: 'B',
        year: 1998,
        blurb: 'Hatch de grupo A. Ama terra, ama hairpin, ama o ombro da estrada.',
        color: 0xf2f4f8,
        accent: 0x1a5cff,
        caliper: 0x1a5cff,
        mass: 1180,
        power: 280000,
        brake: 20000,
        drag: 0.38,
        grip: 1.28,
        steer: 0.62,
        wheelbase: 2.48,
        ride: 0.22,
        redline: 7800,
        idle: 950,
        gears: [82, 58, 42, 32, 26, 22],
        body: 'rally',
        number: 3
    },
    {
        id: 'aurora',
        name: 'Aurora Roadster',
        maker: 'Solara',
        class: 'S',
        year: 2022,
        blurb: 'Teto abaixo, V10 à mostra. Feito para a hora dourada e a câmera de capô.',
        color: 0xff6b2c,
        accent: 0x1a120e,
        caliper: 0x111111,
        mass: 1360,
        power: 470000,
        brake: 26000,
        drag: 0.34,
        grip: 1.36,
        steer: 0.56,
        wheelbase: 2.58,
        ride: 0.12,
        redline: 8800,
        idle: 900,
        gears: [88, 60, 43, 33, 26, 21],
        body: 'roadster',
        number: 11
    }
];

export const SKIES = {
    dawn: {
        id: 'dawn',
        name: 'Amanhecer',
        tag: 'névoa rosa',
        zenith: [0.22, 0.38, 0.62],
        horizon: [1.0, 0.62, 0.48],
        ground: [0.28, 0.22, 0.24],
        sun: [1.0, 0.78, 0.58],
        fog: [0.78, 0.62, 0.58],
        fogDensity: 0.0048,
        sunDir: [0.55, 0.22, 0.55],
        sunPower: 18,
        ambient: 0.42,
        hemiSky: 0xa8c4e8,
        hemiGround: 0x6a5048,
        dirColor: 0xffd2a8,
        dirIntensity: 2.4,
        exposure: 0.92
    },
    golden: {
        id: 'golden',
        name: 'Hora dourada',
        tag: 'o look Forza',
        zenith: [0.18, 0.32, 0.58],
        horizon: [1.0, 0.52, 0.22],
        ground: [0.32, 0.18, 0.10],
        sun: [1.0, 0.62, 0.28],
        fog: [0.92, 0.58, 0.32],
        fogDensity: 0.0036,
        sunDir: [0.62, 0.18, 0.42],
        sunPower: 28,
        ambient: 0.38,
        hemiSky: 0xffb070,
        hemiGround: 0x5a3a22,
        dirColor: 0xff9a48,
        dirIntensity: 3.1,
        exposure: 1.05
    },
    dusk: {
        id: 'dusk',
        name: 'Entardecer',
        tag: 'violeta e neon',
        zenith: [0.08, 0.10, 0.28],
        horizon: [0.72, 0.28, 0.48],
        ground: [0.12, 0.08, 0.14],
        sun: [1.0, 0.42, 0.28],
        fog: [0.42, 0.22, 0.32],
        fogDensity: 0.0052,
        sunDir: [-0.55, 0.12, 0.48],
        sunPower: 16,
        ambient: 0.28,
        hemiSky: 0x6a4a88,
        hemiGround: 0x2a1820,
        dirColor: 0xff6a4a,
        dirIntensity: 1.8,
        exposure: 0.82
    },
    night: {
        id: 'night',
        name: 'Noite de festival',
        tag: 'faróis e palco',
        zenith: [0.02, 0.04, 0.10],
        horizon: [0.12, 0.10, 0.22],
        ground: [0.04, 0.05, 0.08],
        sun: [0.55, 0.62, 0.85],
        fog: [0.08, 0.10, 0.16],
        fogDensity: 0.0065,
        sunDir: [0.15, 0.72, -0.35],
        sunPower: 4,
        ambient: 0.16,
        hemiSky: 0x243050,
        hemiGround: 0x101418,
        dirColor: 0xc8d4ff,
        dirIntensity: 0.35,
        exposure: 0.62
    }
};

export const QUALITY = {
    low: {
        pixelRatio: 1,
        shadows: false,
        bloom: false,
        trees: 220,
        rocks: 80,
        grass: 0,
        traffic: 4,
        cubeEnv: false,
        anisotropy: 2
    },
    medium: {
        pixelRatio: 1.35,
        shadows: true,
        shadowMap: 1024,
        bloom: true,
        trees: 520,
        rocks: 140,
        grass: 400,
        traffic: 6,
        cubeEnv: true,
        anisotropy: 4
    },
    high: {
        pixelRatio: 1.75,
        shadows: true,
        shadowMap: 2048,
        bloom: true,
        trees: 860,
        rocks: 220,
        grass: 900,
        traffic: 8,
        cubeEnv: true,
        anisotropy: 8
    }
};

export const CAMERAS = [
    { id: 'chase', name: 'Perseguição' },
    { id: 'hood', name: 'Capô' },
    { id: 'bumper', name: 'Para-choque' },
    { id: 'cockpit', name: 'Cockpit' },
    { id: 'cinematic', name: 'Cinemática' }
];

export const RADIO = [
    { id: 'horizon', name: 'Aurelia FM', tag: 'indie · sunset', bpm: 118 },
    { id: 'pulse', name: 'Pulse 98', tag: 'synth · festival', bpm: 128 },
    { id: 'coast', name: 'Costa Wave', tag: 'chill · farol', bpm: 96 },
    { id: 'serra', name: 'Serra Bass', tag: 'breakbeat · rally', bpm: 136 }
];

export const EVENTS = [
    {
        id: 'beach-trap',
        kind: 'speed',
        name: 'Speed Trap · Praia',
        start: 0.18,
        end: 0.28,
        target: 52, // m/s ≈ 187 km/h
        stars: [42, 50, 58]
    },
    {
        id: 'lighthouse-drift',
        kind: 'drift',
        name: 'Drift Zone · Farol',
        start: 0.34,
        end: 0.46,
        target: 1800
    },
    {
        id: 'climb-trap',
        kind: 'speed',
        name: 'Speed Trap · Serra',
        start: 0.62,
        end: 0.70,
        target: 38,
        stars: [28, 36, 44]
    }
];
