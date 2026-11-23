/**
 * Catálogo do Sistema Solar.
 * Nomes, classes e luas são os reais. O mapa de cada mundo vem de textures.js.
 *
 * Fontes dos números (todos reais):
 * - elements: JPL/NASA "Approximate Positions of the Planets", Tabela 1
 *   (eclíptica e equinócio J2000, válida 1800–2050). a em UA; e; i, L (longitude
 *   média), peri (ϖ, longitude do periélio) e node (Ω) em graus. Mantemos os
 *   elementos fixos (sem a deriva secular por século): erro < ~0,5° em 1950–2100.
 * - mass (kg), radiusKm (raio médio), flattening (achatamento): NASA Planetary Fact Sheet.
 * - rot: polo norte (ra/dec) e meridiano W = W0 + Wd·d (graus, d em dias desde J2000),
 *   relatório IAU WGCCRE 2009/2015. Wd < 0 = rotação retrógrada (Vênus, Urano).
 *   A inclinação axial NÃO é digitada: sai do ângulo entre o polo e a normal da órbita.
 * - luas: semi-eixo (aKm), excentricidade, inclinação (graus, ao equador do planeta;
 *   a Lua à eclíptica) e período sideral real (dias). Fase inicial das luas que não
 *   a nossa é ilustrativa (não há efeméride delas aqui).
 * - radius / scale são só visuais (tamanhos ampliados para caber na tela).
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
        radius: 0.9,
        intensity: 105,
        habitable: 6.3,
        innerOrbit: 2.25,
        orbitStep: 1.42,
        limb: 0.42,
        nebulaA: [0.02, 0.04, 0.12],
        nebulaB: [0.06, 0.02, 0.05],
        seed: 12345,
        spot: 0.15,
        // Dados físicos reais do Sol (IAU 2015 / NASA Sun Fact Sheet).
        mass: 1.98841e30, radiusKm: 695700, luminosity: 3.828e26, teff: 5772, spectral: 'G2V',
        rot: { ra: 286.13, dec: 63.87, W0: 84.176, Wd: 14.1844 },
        lore: 'Uma anã amarela de 4,6 bilhões de anos que concentra 99,86% da massa do Sistema Solar.'
    };

    const planets = [
        {
            kindId: 'carbon',
            kind: 0,
            label: 'Planeta rochoso',
            name: 'Mercúrio',
            designation: 'I',
            lore: 'O planeta mais próximo do Sol, marcado por crateras e sem atmosfera visível.',
            water: 0, ice: 0, temp: 0.85, clouds: 0, atmos: 0.02, mountain: 0.8, warp: 0.6, cities: 0, emissive: 0.0,
            rings: 0, moons: 0,
            texture: 'mercury', spec: 0.1,
            moonsNamed: [],
            oceanDeep: [0.15, 0.15, 0.15], oceanShallow: [0.25, 0.25, 0.25], landA: [0.35, 0.35, 0.35], landB: [0.45, 0.45, 0.45],
            desert: [0.55, 0.55, 0.55], snow: [0.65, 0.65, 0.65], lava: [1.0, 0.3, 0.1], atmosColor: [0.1, 0.1, 0.1], atmosColor2: [0.2, 0.2, 0.2],
            ringColor: [0, 0, 0], seed: 101, cloudSeed: 101, aurora: 0,
            radius: 0.14,
            elements: { a: 0.38709927, e: 0.20563593, i: 7.00497902, L: 252.25032350, peri: 77.45779628, node: 48.33076593 },
            mass: 3.30103e23, radiusKm: 2439.4, flattening: 0,
            rot: { ra: 281.0103, dec: 61.4155, W0: 329.5469, Wd: 6.1385025 }
        },
        {
            kindId: 'toxic',
            kind: 0,
            label: 'Planeta rochoso',
            name: 'Vênus',
            designation: 'II',
            lore: 'Um inferno nublado com pressão esmagadora e chuvas de ácido sulfúrico.',
            water: 0, ice: 0, temp: 0.95, clouds: 0.35, atmos: 0.85, mountain: 0.5, warp: 0.4, cities: 0, emissive: 0.1,
            rings: 0, moons: 0,
            texture: 'venus', spec: 0.06,
            moonsNamed: [],
            oceanDeep: [0.6, 0.4, 0.2], oceanShallow: [0.7, 0.5, 0.3], landA: [0.75, 0.55, 0.35], landB: [0.8, 0.6, 0.4],
            desert: [0.9, 0.7, 0.45], snow: [1.0, 0.85, 0.55], lava: [1.0, 0.5, 0.1], atmosColor: [0.9, 0.75, 0.4], atmosColor2: [1.0, 0.85, 0.55],
            ringColor: [0, 0, 0], seed: 102, cloudSeed: 102, aurora: 0,
            radius: 0.24,
            elements: { a: 0.72333566, e: 0.00677672, i: 3.39467605, L: 181.97909950, peri: 131.60246718, node: 76.67984255 },
            mass: 4.86731e24, radiusKm: 6051.8, flattening: 0,
            rot: { ra: 272.76, dec: 67.16, W0: 160.20, Wd: -1.4813688 }
        },
        {
            kindId: 'terra',
            kind: 0,
            label: 'Planeta rochoso',
            name: 'Terra',
            designation: 'III',
            lore: 'Oásis azul pálido, o único mundo conhecido a abrigar vida.',
            water: 0.71, ice: 0.12, temp: 0.48, clouds: 0.45, atmos: 0.65, mountain: 0.45, warp: 0.55, cities: 0.5, emissive: 0,
            rings: 0, moons: 1,
            texture: 'earth', spec: 0.58,
            moonsNamed: [{
                name: 'Lua', texture: 'moon', tint: [1, 0.98, 0.94], scale: 0.27,
                // Órbita referida à eclíptica, com precessão real do nodo (18,6 anos)
                // e do perigeu (8,85 anos): a fase da Lua no céu é a de verdade.
                frame: 'ecliptic', aKm: 384400, e: 0.0549, i: 5.145, period: 27.321661, radiusKm: 1737.4,
                L: 218.3164477, peri: 83.3532465, node: 125.0445479,
                nodeRate: -0.0529538083, periRate: 0.1114040803
            }],
            oceanDeep: [0.02, 0.12, 0.35], oceanShallow: [0.05, 0.3, 0.5], landA: [0.15, 0.35, 0.15], landB: [0.25, 0.4, 0.12],
            desert: [0.7, 0.6, 0.35], snow: [0.95, 0.95, 1.0], lava: [0.8, 0.3, 0.1], atmosColor: [0.35, 0.55, 1.0], atmosColor2: [0.55, 0.82, 1.0],
            ringColor: [0, 0, 0], seed: 103, cloudSeed: 103, aurora: 0.65,
            radius: 0.25,
            // Elementos do baricentro Terra–Lua (é o que o JPL publica); μ inclui a Lua.
            elements: { a: 1.00000261, e: 0.01671123, i: -0.00001531, L: 100.46457166, peri: 102.93768193, node: 0 },
            mass: 5.97217e24, extraMass: 7.342e22, radiusKm: 6371.0, flattening: 0.00335,
            rot: { ra: 0, dec: 90, W0: 190.147, Wd: 360.9856235 }
        },
        {
            kindId: 'desert',
            kind: 0,
            label: 'Planeta rochoso',
            name: 'Marte',
            designation: 'IV',
            lore: 'O planeta vermelho, outrora quente e úmido, agora um deserto gelado com calotas polares.',
            water: 0, ice: 0.08, temp: 0.28, clouds: 0.08, atmos: 0.25, mountain: 0.65, warp: 0.5, cities: 0, emissive: 0,
            rings: 0, moons: 2,
            texture: 'mars', spec: 0.14,
            moonsNamed: [
                { name: 'Fobos', texture: 'phobos', tint: [0.85, 0.78, 0.7], scale: 0.12, aKm: 9376, e: 0.0151, i: 1.075, period: 0.31891023, radiusKm: 11.27 },
                { name: 'Deimos', texture: 'deimos', tint: [0.9, 0.84, 0.76], scale: 0.09, aKm: 23463.2, e: 0.00033, i: 1.788, period: 1.263, radiusKm: 6.2 }
            ],
            oceanDeep: [0.65, 0.35, 0.2], oceanShallow: [0.75, 0.4, 0.25], landA: [0.7, 0.4, 0.25], landB: [0.8, 0.45, 0.3],
            desert: [0.85, 0.5, 0.35], snow: [0.95, 0.9, 0.85], lava: [1.0, 0.4, 0.1], atmosColor: [0.85, 0.55, 0.35], atmosColor2: [0.95, 0.65, 0.45],
            ringColor: [0, 0, 0], seed: 104, cloudSeed: 104, aurora: 0,
            radius: 0.16,
            elements: { a: 1.52371034, e: 0.09339410, i: 1.84969142, L: -4.55343205, peri: -23.94362959, node: 49.55953891 },
            mass: 6.41691e23, radiusKm: 3389.5, flattening: 0.00589,
            rot: { ra: 317.68143, dec: 52.88650, W0: 176.630, Wd: 350.89198226 }
        },
        {
            kindId: 'gas',
            kind: 1,
            label: 'Gigante Gasoso',
            name: 'Júpiter',
            texture: 'jupiter', spec: 0.22,
            moonsNamed: [
                { name: 'Io', texture: 'io', tint: [1, 0.96, 0.86], scale: 0.16, aKm: 421700, e: 0.0041, i: 0.05, period: 1.769137786, radiusKm: 1821.6 },
                { name: 'Europa', texture: 'europa', tint: [0.96, 0.97, 1], scale: 0.14, aKm: 671034, e: 0.009, i: 0.47, period: 3.551181, radiusKm: 1560.8 }
            ],
            designation: 'V',
            lore: 'O rei dos planetas, lar da Grande Mancha Vermelha e tempestades colossais.',
            water: 0.45, ice: 0.2, temp: 0.4, clouds: 0.08, atmos: 0.95, mountain: 0.6, warp: 0.35, cities: 0, emissive: 0,
            rings: 0.04, moons: 2,
            oceanDeep: [0.6, 0.4, 0.3], oceanShallow: [0.7, 0.5, 0.35], landA: [0.8, 0.65, 0.5], landB: [0.85, 0.75, 0.6],
            desert: [0.95, 0.85, 0.7], snow: [1.0, 0.9, 0.8], lava: [1.0, 0.5, 0.2], atmosColor: [0.85, 0.7, 0.55], atmosColor2: [0.95, 0.8, 0.65],
            ringColor: [0.6, 0.5, 0.4], seed: 105, cloudSeed: 105, aurora: 0.7,
            radius: 0.68,
            elements: { a: 5.20288700, e: 0.04838624, i: 1.30439695, L: 34.39644051, peri: 14.72847983, node: 100.47390909 },
            mass: 1.898125e27, radiusKm: 69911, flattening: 0.06487,
            rot: { ra: 268.056595, dec: 64.495303, W0: 284.95, Wd: 870.5360000 },
            ringSpan: [1.4, 1.81], ringGap: [0.46, 0.56]
        },
        {
            kindId: 'gas',
            kind: 1,
            label: 'Gigante Gasoso',
            name: 'Saturno',
            texture: 'saturn', spec: 0.2,
            moonsNamed: [
                { name: 'Titã', texture: 'titan', tint: [1, 0.9, 0.72], scale: 0.18, aKm: 1221870, e: 0.0288, i: 0.348, period: 15.945, radiusKm: 2574.7 },
                { name: 'Encélado', texture: 'enceladus', tint: [0.95, 0.98, 1], scale: 0.1, aKm: 237948, e: 0.0047, i: 0.009, period: 1.370218, radiusKm: 252.1 }
            ],
            designation: 'VI',
            lore: 'A joia do sistema solar, coroada por um sistema de anéis deslumbrante e complexo.',
            water: 0.35, ice: 0.25, temp: 0.3, clouds: 0.05, atmos: 0.9, mountain: 0.4, warp: 0.25, cities: 0, emissive: 0,
            rings: 0.92, moons: 2,
            oceanDeep: [0.7, 0.6, 0.4], oceanShallow: [0.8, 0.7, 0.5], landA: [0.85, 0.75, 0.55], landB: [0.9, 0.85, 0.65],
            desert: [0.95, 0.9, 0.75], snow: [1.0, 0.95, 0.85], lava: [1.0, 0.6, 0.3], atmosColor: [0.9, 0.85, 0.7], atmosColor2: [0.95, 0.9, 0.8],
            ringColor: [0.85, 0.8, 0.7], seed: 106, cloudSeed: 106, aurora: 0.5,
            radius: 0.58,
            elements: { a: 9.53667594, e: 0.05386179, i: 2.48599187, L: 49.95424423, peri: 92.59887831, node: 113.66242448 },
            mass: 5.68317e26, radiusKm: 58232, flattening: 0.09796,
            rot: { ra: 40.589, dec: 83.537, W0: 38.90, Wd: 810.7939024 },
            // Anel C interno (74 658 km) ao A externo (136 775 km), em raios médios;
            // divisão de Cassini 117 580–122 170 km → fração 0,69–0,765 da largura.
            ringSpan: [1.282, 2.349], ringGap: [0.69, 0.765]
        },
        {
            kindId: 'icegiant',
            kind: 1,
            label: 'Gigante de Gelo',
            name: 'Urano',
            texture: 'uranus', spec: 0.16,
            moonsNamed: [
                { name: 'Titânia', texture: 'titania', tint: [0.9, 0.94, 0.96], scale: 0.14, aKm: 435910, e: 0.0011, i: 0.34, period: 8.706234, radiusKm: 788.4 },
                { name: 'Oberon', texture: 'oberon', tint: [0.86, 0.88, 0.9], scale: 0.13, aKm: 583520, e: 0.0014, i: 0.058, period: 13.463234, radiusKm: 761.4 }
            ],
            designation: 'VII',
            lore: 'Um mundo gelado tombado de lado, orbitando o Sol como um barril rodopiante.',
            water: 0.55, ice: 0.75, temp: 0.1, clouds: 0.02, atmos: 0.85, mountain: 0.35, warp: 0.25, cities: 0, emissive: 0,
            rings: 0.18, moons: 2,
            oceanDeep: [0.4, 0.7, 0.9], oceanShallow: [0.5, 0.8, 0.95], landA: [0.6, 0.85, 1.0], landB: [0.7, 0.9, 1.0],
            desert: [0.8, 0.95, 1.0], snow: [0.9, 1.0, 1.0], lava: [0.5, 0.5, 0.9], atmosColor: [0.5, 0.8, 0.95], atmosColor2: [0.7, 0.9, 1.0],
            ringColor: [0.6, 0.7, 0.8], seed: 107, cloudSeed: 107, aurora: 0.3,
            radius: 0.42,
            elements: { a: 19.18916464, e: 0.04725744, i: 0.77263783, L: 313.23810451, peri: 170.95427630, node: 74.01692503 },
            mass: 8.68099e25, radiusKm: 25362, flattening: 0.02293,
            rot: { ra: 257.311, dec: -15.175, W0: 203.81, Wd: -501.1600928 },
            ringSpan: [1.65, 2.02], ringGap: [0.46, 0.56]
        },
        {
            kindId: 'icegiant',
            kind: 1,
            label: 'Gigante de Gelo',
            name: 'Netuno',
            texture: 'neptune', spec: 0.2,
            moonsNamed: [
                { name: 'Tritão', texture: 'triton', tint: [1, 0.94, 0.96], scale: 0.16, aKm: 354759, e: 0.000016, i: 156.885, period: 5.876854, radiusKm: 1353.4 } /* i > 90°: órbita retrógrada */,
                { name: 'Proteu', texture: 'proteus', tint: [0.82, 0.8, 0.78], scale: 0.08, aKm: 117647, e: 0.00053, i: 0.524, period: 1.122315, radiusKm: 210 }
            ],
            designation: 'VIII',
            lore: 'O planeta mais distante, de um azul profundo e varrido por ventos supersônicos.',
            water: 0.6, ice: 0.65, temp: 0.05, clouds: 0.12, atmos: 0.9, mountain: 0.45, warp: 0.3, cities: 0, emissive: 0,
            rings: 0.08, moons: 2,
            oceanDeep: [0.1, 0.25, 0.85], oceanShallow: [0.2, 0.4, 0.95], landA: [0.25, 0.45, 1.0], landB: [0.35, 0.55, 1.0],
            desert: [0.45, 0.65, 1.0], snow: [0.6, 0.8, 1.0], lava: [0.2, 0.3, 0.8], atmosColor: [0.15, 0.35, 0.95], atmosColor2: [0.25, 0.5, 1.0],
            ringColor: [0.3, 0.4, 0.6], seed: 108, cloudSeed: 108, aurora: 0.25,
            radius: 0.4,
            elements: { a: 30.06992276, e: 0.00859048, i: 1.77004347, L: -55.12002969, peri: 44.96476227, node: 131.78422574 },
            mass: 1.024092e26, radiusKm: 24622, flattening: 0.01708,
            rot: { ra: 299.36, dec: 43.46, W0: 253.18, Wd: 536.3128492 },
            ringSpan: [1.7, 2.56], ringGap: [0.46, 0.56]
        }
    ];

    for (const p of planets) {
        p.paint = 1;
        p.base = {
            water: p.water, ice: p.ice, temp: p.temp, clouds: p.clouds,
            atmos: p.atmos, mountain: p.mountain, cities: p.cities,
            emissive: p.emissive, rings: p.rings, aurora: p.aurora
        };
    }

    return {
        seed: 1,
        name: 'Sistema Solar',
        star,
        planets,
        // Cinturão principal em UA (2,1–3,3), com as lacunas de Kirkwood
        // (ressonâncias 3:1, 5:2, 7:3 e 2:1 com Júpiter) e os troianos de Júpiter.
        belt: {
            inner: 2.1,
            outer: 3.3,
            gaps: [2.502, 2.825, 2.958, 3.279],
            trojans: 0.12
        }
    };
}

export function moonLine(planet) {
    const names = (planet.moonsNamed || []).map((m) => m.name);
    if (!names.length) return 'sem satélites';
    if (names.length === 1) return names[0];
    return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}
