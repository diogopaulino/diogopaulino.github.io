/**
 * Catálogo do Sistema Solar hiper-realista.
 */

export const SLIDERS = [
    { key: 'water', label: 'Oceanos', min: 0, max: 1, step: 0.01 },
    { key: 'ice', label: 'Calotas', min: 0, max: 1, step: 0.01 },
    { key: 'temp', label: 'Temperatura', min: 0, max: 1, step: 0.01 },
    { key: 'clouds', label: 'Nuvens', min: 0, max: 1, step: 0.01 },
    { key: 'atmos', label: 'Atmosfera', min: 0, max: 1, step: 0.01 },
    { key: 'mountain', label: 'Relevo', min: 0, max: 1, step: 0.01 },
    { key: 'cities', label: 'Cidades', min: 0, max: 1, step: 0.01 },
    { key: 'emissive', label: 'Magma', min: 0, max: 1, step: 0.01 },
    { key: 'rings', label: 'Anéis', min: 0, max: 1, step: 0.01 },
    { key: 'aurora', label: 'Aurora', min: 0, max: 1, step: 0.01 }
];

export const SHOWCASE = [
    { seed: 1, title: 'Sistema Solar' }
];

export function generateSystem(seed) {
    const star = {
        id: 'G',
        w: 22,
        name: 'Sol',
        color: [1.0, 0.92, 0.72],
        corona: [1.0, 0.75, 0.35],
        radius: 1.15,
        intensity: 105,
        habitable: 6.3,
        innerOrbit: 2.25,
        orbitStep: 1.42,
        limb: 0.42,
        nebulaA: [0.02, 0.04, 0.12],
        nebulaB: [0.06, 0.02, 0.05],
        seed: 12345,
        spin: 0.04,
        spot: 0.15
    };

    const planets = [
        {
            kindId: 'carbon',
            kind: 0,
            label: 'Rochoso Árido',
            name: 'Mercúrio',
            designation: 'I',
            lore: 'O planeta mais próximo do Sol, marcado por crateras e sem atmosfera visível.',
            water: 0, ice: 0, temp: 0.85, clouds: 0, atmos: 0.02, mountain: 0.8, warp: 0.6, cities: 0, emissive: 0.0,
            rings: 0, moons: 0,
            oceanDeep: [0.15, 0.15, 0.15], oceanShallow: [0.25, 0.25, 0.25], landA: [0.35, 0.35, 0.35], landB: [0.45, 0.45, 0.45],
            desert: [0.55, 0.55, 0.55], snow: [0.65, 0.65, 0.65], lava: [1.0, 0.3, 0.1], atmosColor: [0.1, 0.1, 0.1], atmosColor2: [0.2, 0.2, 0.2],
            ringColor: [0, 0, 0], seed: 101, cloudSeed: 101, aurora: 0,
            orbit: 3.2, radius: 0.14, inclination: 0.12, orbitSpeed: 0.45, spin: 0.02, tilt: 0.01, phase: 0
        },
        {
            kindId: 'toxic',
            kind: 0,
            label: 'Estufa Tóxica',
            name: 'Vênus',
            designation: 'II',
            lore: 'Um inferno nublado com pressão esmagadora e chuvas de ácido sulfúrico.',
            water: 0, ice: 0, temp: 0.95, clouds: 0.9, atmos: 1.0, mountain: 0.5, warp: 0.4, cities: 0, emissive: 0.1,
            rings: 0, moons: 0,
            oceanDeep: [0.6, 0.4, 0.2], oceanShallow: [0.7, 0.5, 0.3], landA: [0.75, 0.55, 0.35], landB: [0.8, 0.6, 0.4],
            desert: [0.9, 0.7, 0.45], snow: [1.0, 0.85, 0.55], lava: [1.0, 0.5, 0.1], atmosColor: [0.9, 0.75, 0.4], atmosColor2: [1.0, 0.85, 0.55],
            ringColor: [0, 0, 0], seed: 102, cloudSeed: 102, aurora: 0,
            orbit: 4.8, radius: 0.24, inclination: 0.06, orbitSpeed: 0.32, spin: -0.01, tilt: 3.09, phase: 1.2
        },
        {
            kindId: 'terra',
            kind: 0,
            label: 'Terrestre',
            name: 'Terra',
            designation: 'III',
            lore: 'Oásis azul pálido, o único mundo conhecido a abrigar vida.',
            water: 0.71, ice: 0.12, temp: 0.48, clouds: 0.45, atmos: 0.65, mountain: 0.45, warp: 0.55, cities: 0.5, emissive: 0,
            rings: 0, moons: 1,
            oceanDeep: [0.02, 0.12, 0.35], oceanShallow: [0.05, 0.3, 0.5], landA: [0.15, 0.35, 0.15], landB: [0.25, 0.4, 0.12],
            desert: [0.7, 0.6, 0.35], snow: [0.95, 0.95, 1.0], lava: [0.8, 0.3, 0.1], atmosColor: [0.35, 0.55, 1.0], atmosColor2: [0.55, 0.82, 1.0],
            ringColor: [0, 0, 0], seed: 103, cloudSeed: 103, aurora: 0.65,
            orbit: 6.4, radius: 0.25, inclination: 0, orbitSpeed: 0.27, spin: 0.4, tilt: 0.41, phase: 2.5
        },
        {
            kindId: 'desert',
            kind: 0,
            label: 'Deserto Frio',
            name: 'Marte',
            designation: 'IV',
            lore: 'O planeta vermelho, outrora quente e úmido, agora um deserto gelado com calotas polares.',
            water: 0, ice: 0.08, temp: 0.28, clouds: 0.08, atmos: 0.25, mountain: 0.65, warp: 0.5, cities: 0, emissive: 0,
            rings: 0, moons: 2,
            oceanDeep: [0.65, 0.35, 0.2], oceanShallow: [0.75, 0.4, 0.25], landA: [0.7, 0.4, 0.25], landB: [0.8, 0.45, 0.3],
            desert: [0.85, 0.5, 0.35], snow: [0.95, 0.9, 0.85], lava: [1.0, 0.4, 0.1], atmosColor: [0.85, 0.55, 0.35], atmosColor2: [0.95, 0.65, 0.45],
            ringColor: [0, 0, 0], seed: 104, cloudSeed: 104, aurora: 0,
            orbit: 8.2, radius: 0.16, inclination: 0.03, orbitSpeed: 0.22, spin: 0.38, tilt: 0.44, phase: 3.8
        },
        {
            kindId: 'gas',
            kind: 1,
            label: 'Gigante Gasoso',
            name: 'Júpiter',
            designation: 'V',
            lore: 'O rei dos planetas, lar da Grande Mancha Vermelha e tempestades colossais.',
            water: 0.45, ice: 0.2, temp: 0.4, clouds: 0.08, atmos: 0.95, mountain: 0.6, warp: 0.35, cities: 0, emissive: 0,
            rings: 0.04, moons: 2,
            oceanDeep: [0.6, 0.4, 0.3], oceanShallow: [0.7, 0.5, 0.35], landA: [0.8, 0.65, 0.5], landB: [0.85, 0.75, 0.6],
            desert: [0.95, 0.85, 0.7], snow: [1.0, 0.9, 0.8], lava: [1.0, 0.5, 0.2], atmosColor: [0.85, 0.7, 0.55], atmosColor2: [0.95, 0.8, 0.65],
            ringColor: [0.6, 0.5, 0.4], seed: 105, cloudSeed: 105, aurora: 0.7,
            orbit: 12.8, radius: 0.68, inclination: 0.02, orbitSpeed: 0.12, spin: 0.9, tilt: 0.05, phase: 5.1
        },
        {
            kindId: 'gas',
            kind: 1,
            label: 'Gigante Gasoso',
            name: 'Saturno',
            designation: 'VI',
            lore: 'A joia do sistema solar, coroada por um sistema de anéis deslumbrante e complexo.',
            water: 0.35, ice: 0.25, temp: 0.3, clouds: 0.05, atmos: 0.9, mountain: 0.4, warp: 0.25, cities: 0, emissive: 0,
            rings: 0.92, moons: 2,
            oceanDeep: [0.7, 0.6, 0.4], oceanShallow: [0.8, 0.7, 0.5], landA: [0.85, 0.75, 0.55], landB: [0.9, 0.85, 0.65],
            desert: [0.95, 0.9, 0.75], snow: [1.0, 0.95, 0.85], lava: [1.0, 0.6, 0.3], atmosColor: [0.9, 0.85, 0.7], atmosColor2: [0.95, 0.9, 0.8],
            ringColor: [0.85, 0.8, 0.7], seed: 106, cloudSeed: 106, aurora: 0.5,
            orbit: 17.5, radius: 0.58, inclination: 0.04, orbitSpeed: 0.09, spin: 0.85, tilt: 0.47, phase: 0.4
        },
        {
            kindId: 'icegiant',
            kind: 1,
            label: 'Gigante de Gelo',
            name: 'Urano',
            designation: 'VII',
            lore: 'Um mundo gelado tombado de lado, orbitando o Sol como um barril rodopiante.',
            water: 0.55, ice: 0.75, temp: 0.1, clouds: 0.02, atmos: 0.85, mountain: 0.35, warp: 0.25, cities: 0, emissive: 0,
            rings: 0.18, moons: 2,
            oceanDeep: [0.4, 0.7, 0.9], oceanShallow: [0.5, 0.8, 0.95], landA: [0.6, 0.85, 1.0], landB: [0.7, 0.9, 1.0],
            desert: [0.8, 0.95, 1.0], snow: [0.9, 1.0, 1.0], lava: [0.5, 0.5, 0.9], atmosColor: [0.5, 0.8, 0.95], atmosColor2: [0.7, 0.9, 1.0],
            ringColor: [0.6, 0.7, 0.8], seed: 107, cloudSeed: 107, aurora: 0.3,
            orbit: 21.8, radius: 0.42, inclination: 0.01, orbitSpeed: 0.06, spin: -0.6, tilt: 1.71, phase: 1.8
        },
        {
            kindId: 'icegiant',
            kind: 1,
            label: 'Gigante de Gelo',
            name: 'Netuno',
            designation: 'VIII',
            lore: 'O planeta mais distante, de um azul profundo e varrido por ventos supersônicos.',
            water: 0.6, ice: 0.65, temp: 0.05, clouds: 0.12, atmos: 0.9, mountain: 0.45, warp: 0.3, cities: 0, emissive: 0,
            rings: 0.08, moons: 2,
            oceanDeep: [0.1, 0.25, 0.85], oceanShallow: [0.2, 0.4, 0.95], landA: [0.25, 0.45, 1.0], landB: [0.35, 0.55, 1.0],
            desert: [0.45, 0.65, 1.0], snow: [0.6, 0.8, 1.0], lava: [0.2, 0.3, 0.8], atmosColor: [0.15, 0.35, 0.95], atmosColor2: [0.25, 0.5, 1.0],
            ringColor: [0.3, 0.4, 0.6], seed: 108, cloudSeed: 108, aurora: 0.25,
            orbit: 26.0, radius: 0.4, inclination: 0.03, orbitSpeed: 0.05, spin: 0.65, tilt: 0.5, phase: 3.2
        }
    ];

    return {
        seed: 1,
        name: 'Sistema Solar',
        star,
        planets,
        belt: {
            inner: 10.0,
            outer: 11.2,
            count: 1
        }
    };
}
