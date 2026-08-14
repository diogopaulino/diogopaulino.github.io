/**
 * Catálogo procedural de sistemas estelares e exoplanetas.
 *
 * Zonas orbitais (em função da órbita habitável da estrela):
 *  - interior  → lava, deserto, carbono
 *  - habitável → terra, oceano, noturna, tóxica
 *  - exterior  → gelo, gigante gasoso, gigante de gelo
 */
import { mulberry32, pick, pickWeighted, randRange, randInt } from './rng.js';

export const STAR_TYPES = [
    {
        id: 'M',
        w: 26,
        name: 'Anã vermelha',
        color: [1.0, 0.42, 0.26],
        corona: [1.0, 0.28, 0.12],
        radius: 0.72,
        intensity: 55,
        habitable: 4.4,
        innerOrbit: 1.85,
        orbitStep: 1.15,
        limb: 0.52,
        nebulaA: [0.12, 0.02, 0.03],
        nebulaB: [0.04, 0.01, 0.08]
    },
    {
        id: 'K',
        w: 22,
        name: 'Anã laranja',
        color: [1.0, 0.68, 0.38],
        corona: [1.0, 0.5, 0.18],
        radius: 0.9,
        intensity: 72,
        habitable: 5.4,
        innerOrbit: 2.05,
        orbitStep: 1.28,
        limb: 0.46,
        nebulaA: [0.1, 0.03, 0.02],
        nebulaB: [0.03, 0.04, 0.1]
    },
    {
        id: 'G',
        w: 22,
        name: 'Anã amarela',
        color: [1.0, 0.9, 0.68],
        corona: [1.0, 0.72, 0.28],
        radius: 1.08,
        intensity: 95,
        habitable: 6.3,
        innerOrbit: 2.25,
        orbitStep: 1.42,
        limb: 0.42,
        nebulaA: [0.03, 0.05, 0.14],
        nebulaB: [0.08, 0.03, 0.06]
    },
    {
        id: 'F',
        w: 14,
        name: 'Estrela branca',
        color: [0.92, 0.95, 1.0],
        corona: [0.7, 0.82, 1.0],
        radius: 1.22,
        intensity: 120,
        habitable: 7.4,
        innerOrbit: 2.55,
        orbitStep: 1.55,
        limb: 0.38,
        nebulaA: [0.02, 0.06, 0.14],
        nebulaB: [0.06, 0.02, 0.1]
    },
    {
        id: 'A',
        w: 10,
        name: 'Estrela branco-azul',
        color: [0.75, 0.84, 1.0],
        corona: [0.45, 0.62, 1.0],
        radius: 1.38,
        intensity: 150,
        habitable: 8.6,
        innerOrbit: 2.9,
        orbitStep: 1.7,
        limb: 0.34,
        nebulaA: [0.02, 0.04, 0.16],
        nebulaB: [0.08, 0.02, 0.12]
    },
    {
        id: 'B',
        w: 6,
        name: 'Gigante azul',
        color: [0.5, 0.68, 1.0],
        corona: [0.3, 0.48, 1.0],
        radius: 1.7,
        intensity: 210,
        habitable: 10.4,
        innerOrbit: 3.4,
        orbitStep: 1.9,
        limb: 0.28,
        nebulaA: [0.02, 0.05, 0.18],
        nebulaB: [0.1, 0.01, 0.08]
    }
];

const PREFIX = [
    'Lyra', 'Kepler', 'Helios', 'Nyx', 'Vega', 'Orion', 'Astra', 'Thalassa',
    'Pyre', 'Glacies', 'Aether', 'Solara', 'Rigel', 'Altair', 'Mira', 'Erebus',
    'Auriga', 'Draco', 'Callisto', 'Io', 'Vesper', 'Nova', 'Lumen', 'Umbra',
    'Arcadia', 'Celeste', 'Hyperion', 'Selene', 'Phoebus', 'Andromeda'
];

const SUFFIX = [
    'Prime', 'Minor', 'Reach', 'Hollow', 'Dawn', 'Vale', 'Expanse',
    'Cluster', 'Deep', 'Gate', 'Halo', 'Verge'
];

const PLANET_NAMES = [
    'Aethel', 'Boreal', 'Cinder', 'Dune', 'Elys', 'Fenn', 'Gossamer', 'Hade',
    'Icarus', 'Juno', 'Kite', 'Lumen', 'Maris', 'Nox', 'Orrin', 'Pyxis',
    'Quill', 'Rime', 'Sable', 'Thal', 'Umbra', 'Vesper', 'Wisp', 'Xanthe',
    'Yara', 'Zephyr', 'Iris', 'Kael', 'Nereid', 'Phaeton'
];

const KINDS = {
    lava: {
        label: 'Vulcânico',
        water: [0.02, 0.12],
        ice: [0, 0.05],
        temp: [0.72, 1],
        clouds: [0.05, 0.28],
        atmos: [0.35, 0.7],
        mountain: [0.55, 1],
        warp: [0.35, 0.7],
        cities: [0, 0.05],
        emissive: [0.55, 1],
        kind: 0,
        rings: 0,
        moons: [0, 1],
        oceanDeep: [0.18, 0.04, 0.02],
        oceanShallow: [0.45, 0.12, 0.04],
        landA: [0.18, 0.06, 0.04],
        landB: [0.32, 0.1, 0.05],
        desert: [0.55, 0.18, 0.06],
        snow: [0.35, 0.12, 0.08],
        lava: [1.0, 0.38, 0.08],
        atmosColor: [1.0, 0.4, 0.16],
        atmosColor2: [1.0, 0.15, 0.04]
    },
    desert: {
        label: 'Árido',
        water: [0.08, 0.28],
        ice: [0.02, 0.18],
        temp: [0.45, 0.85],
        clouds: [0.04, 0.32],
        atmos: [0.25, 0.55],
        mountain: [0.3, 0.7],
        warp: [0.25, 0.55],
        cities: [0, 0.2],
        emissive: [0, 0.05],
        kind: 0,
        rings: 0,
        moons: [0, 1],
        oceanDeep: [0.12, 0.18, 0.22],
        oceanShallow: [0.35, 0.42, 0.32],
        landA: [0.62, 0.38, 0.18],
        landB: [0.45, 0.22, 0.1],
        desert: [0.78, 0.52, 0.28],
        snow: [0.85, 0.82, 0.75],
        lava: [0.4, 0.1, 0.02],
        atmosColor: [0.85, 0.55, 0.28],
        atmosColor2: [0.95, 0.72, 0.4]
    },
    terra: {
        label: 'Terrestre',
        water: [0.38, 0.62],
        ice: [0.12, 0.32],
        temp: [0.38, 0.62],
        clouds: [0.28, 0.7],
        atmos: [0.55, 0.95],
        mountain: [0.25, 0.6],
        warp: [0.4, 0.75],
        cities: [0.15, 0.7],
        emissive: [0, 0.02],
        kind: 0,
        rings: 0,
        moons: [0, 2],
        oceanDeep: [0.02, 0.12, 0.32],
        oceanShallow: [0.08, 0.42, 0.52],
        landA: [0.14, 0.38, 0.16],
        landB: [0.28, 0.32, 0.12],
        desert: [0.62, 0.5, 0.22],
        snow: [0.9, 0.93, 0.95],
        lava: [0.6, 0.2, 0.05],
        atmosColor: [0.35, 0.55, 1.0],
        atmosColor2: [0.55, 0.82, 1.0]
    },
    ocean: {
        label: 'Oceânico',
        water: [0.72, 0.92],
        ice: [0.08, 0.28],
        temp: [0.32, 0.58],
        clouds: [0.4, 0.85],
        atmos: [0.65, 1],
        mountain: [0.1, 0.35],
        warp: [0.3, 0.6],
        cities: [0, 0.15],
        emissive: [0, 0],
        kind: 0,
        rings: 0,
        moons: [0, 1],
        oceanDeep: [0.01, 0.08, 0.28],
        oceanShallow: [0.05, 0.45, 0.55],
        landA: [0.2, 0.42, 0.22],
        landB: [0.45, 0.4, 0.2],
        desert: [0.7, 0.62, 0.35],
        snow: [0.92, 0.95, 0.98],
        lava: [0.5, 0.15, 0.04],
        atmosColor: [0.25, 0.6, 0.95],
        atmosColor2: [0.55, 0.9, 1.0]
    },
    night: {
        label: 'Ecumenópole',
        water: [0.22, 0.42],
        ice: [0.04, 0.16],
        temp: [0.4, 0.65],
        clouds: [0.18, 0.5],
        atmos: [0.5, 0.85],
        mountain: [0.15, 0.4],
        warp: [0.35, 0.65],
        cities: [0.75, 1],
        emissive: [0.08, 0.22],
        kind: 0,
        rings: 0,
        moons: [0, 1],
        oceanDeep: [0.02, 0.05, 0.14],
        oceanShallow: [0.08, 0.16, 0.28],
        landA: [0.08, 0.08, 0.12],
        landB: [0.14, 0.12, 0.16],
        desert: [0.2, 0.16, 0.12],
        snow: [0.4, 0.42, 0.5],
        lava: [0.3, 0.5, 1.0],
        atmosColor: [0.45, 0.35, 0.9],
        atmosColor2: [0.9, 0.5, 0.3]
    },
    toxic: {
        label: 'Tóxico',
        water: [0.25, 0.55],
        ice: [0, 0.12],
        temp: [0.5, 0.85],
        clouds: [0.45, 0.9],
        atmos: [0.7, 1],
        mountain: [0.3, 0.7],
        warp: [0.4, 0.8],
        cities: [0, 0.1],
        emissive: [0.05, 0.25],
        kind: 0,
        rings: 0,
        moons: [0, 1],
        oceanDeep: [0.08, 0.22, 0.1],
        oceanShallow: [0.28, 0.55, 0.18],
        landA: [0.22, 0.4, 0.12],
        landB: [0.4, 0.22, 0.35],
        desert: [0.5, 0.45, 0.12],
        snow: [0.55, 0.7, 0.45],
        lava: [0.6, 1.0, 0.2],
        atmosColor: [0.45, 0.95, 0.25],
        atmosColor2: [0.7, 0.3, 0.9]
    },
    ice: {
        label: 'Glacial',
        water: [0.15, 0.4],
        ice: [0.55, 0.95],
        temp: [0, 0.28],
        clouds: [0.2, 0.6],
        atmos: [0.3, 0.7],
        mountain: [0.35, 0.75],
        warp: [0.25, 0.55],
        cities: [0, 0.12],
        emissive: [0, 0.04],
        kind: 0,
        rings: 0.15,
        moons: [0, 2],
        oceanDeep: [0.05, 0.14, 0.28],
        oceanShallow: [0.25, 0.45, 0.55],
        landA: [0.55, 0.68, 0.78],
        landB: [0.35, 0.42, 0.5],
        desert: [0.45, 0.4, 0.38],
        snow: [0.92, 0.96, 1.0],
        lava: [0.2, 0.35, 0.7],
        atmosColor: [0.55, 0.75, 1.0],
        atmosColor2: [0.75, 0.9, 1.0]
    },
    carbon: {
        label: 'Carbonáceo',
        water: [0.05, 0.22],
        ice: [0, 0.1],
        temp: [0.25, 0.55],
        clouds: [0.08, 0.35],
        atmos: [0.2, 0.5],
        mountain: [0.45, 0.9],
        warp: [0.3, 0.65],
        cities: [0, 0.08],
        emissive: [0.02, 0.12],
        kind: 0,
        rings: 0,
        moons: [0, 1],
        oceanDeep: [0.04, 0.05, 0.08],
        oceanShallow: [0.1, 0.1, 0.12],
        landA: [0.08, 0.07, 0.08],
        landB: [0.18, 0.14, 0.12],
        desert: [0.28, 0.2, 0.14],
        snow: [0.4, 0.38, 0.36],
        lava: [0.7, 0.25, 0.1],
        atmosColor: [0.35, 0.28, 0.25],
        atmosColor2: [0.55, 0.4, 0.3]
    },
    gas: {
        label: 'Gigante gasoso',
        water: [0.4, 0.6],
        ice: [0.1, 0.3],
        temp: [0.2, 0.55],
        clouds: [0, 0.15],
        atmos: [0.85, 1],
        mountain: [0.35, 0.85],
        warp: [0.2, 0.5],
        cities: [0, 0],
        emissive: [0, 0.08],
        kind: 1,
        rings: 0.85,
        moons: [1, 2],
        oceanDeep: [0.55, 0.32, 0.18],
        oceanShallow: [0.85, 0.62, 0.35],
        landA: [0.72, 0.48, 0.28],
        landB: [0.4, 0.28, 0.55],
        desert: [0.9, 0.75, 0.45],
        snow: [0.85, 0.8, 0.7],
        lava: [0.9, 0.4, 0.15],
        atmosColor: [0.85, 0.65, 0.4],
        atmosColor2: [0.55, 0.4, 0.85]
    },
    icegiant: {
        label: 'Gigante de gelo',
        water: [0.4, 0.6],
        ice: [0.4, 0.8],
        temp: [0, 0.3],
        clouds: [0, 0.12],
        atmos: [0.8, 1],
        mountain: [0.25, 0.65],
        warp: [0.15, 0.4],
        cities: [0, 0],
        emissive: [0, 0.04],
        kind: 1,
        rings: 0.45,
        moons: [1, 2],
        oceanDeep: [0.15, 0.35, 0.55],
        oceanShallow: [0.35, 0.7, 0.75],
        landA: [0.25, 0.45, 0.7],
        landB: [0.4, 0.55, 0.5],
        desert: [0.55, 0.7, 0.8],
        snow: [0.8, 0.9, 1.0],
        lava: [0.3, 0.5, 0.9],
        atmosColor: [0.4, 0.7, 0.95],
        atmosColor2: [0.55, 0.85, 0.9]
    }
};

const INNER_KINDS = [
    { id: 'lava', w: 34 },
    { id: 'desert', w: 28 },
    { id: 'carbon', w: 22 },
    { id: 'toxic', w: 10 },
    { id: 'night', w: 6 }
];

const HAB_KINDS = [
    { id: 'terra', w: 32 },
    { id: 'ocean', w: 22 },
    { id: 'night', w: 12 },
    { id: 'desert', w: 12 },
    { id: 'toxic', w: 10 },
    { id: 'ice', w: 7 },
    { id: 'carbon', w: 5 }
];

const OUTER_KINDS = [
    { id: 'gas', w: 28 },
    { id: 'icegiant', w: 24 },
    { id: 'ice', w: 26 },
    { id: 'carbon', w: 10 },
    { id: 'ocean', w: 6 },
    { id: 'toxic', w: 6 }
];

const LORE = {
    lava: [
        'Rios de basalto abrem a crosta como veias em brasa.',
        'A noite nunca chega: o magma pinta o horizonte de âmbar.',
        'Cadeias de vulcões espirram vidro obsidiana na órbita baixa.'
    ],
    desert: [
        'Dunas de óxido atravessam um único mar interior.',
        'Tempestades de areia esculpem cânions em silêncio de séculos.',
        'O equador ferve; os polos guardam geada de dióxido.'
    ],
    terra: [
        'Continentes verdes sob um céu que ainda lembra o nosso.',
        'Cidades acendem na face noturna como um segundo céu.',
        'Correntes oceânicas carregam nuvens em espirais lentas.'
    ],
    ocean: [
        'Um único arquipélago resiste a um oceano do tamanho do mundo.',
        'Tempestades de vapor desenham tufões visíveis do espaço.',
        'A luz da estrela atravessa água rasa e devolve turquesa.'
    ],
    night: [
        'A crosta inteira é cidade: um circuito que nunca apaga.',
        'Arranha-céus orbitais projetam auroras artificiais nos polos.',
        'O lado noturno pulsa em âmbar, ciano e violeta.'
    ],
    toxic: [
        'A atmosfera mastiga metal e pinta o céu de verde-veneno.',
        'Lagos ácidos espelham uma lua pálida e doente.',
        'Nuvens de enxofre descem como cortinas sobre vales mortos.'
    ],
    ice: [
        'Gelo de metano racha em placas do tamanho de continentes.',
        'Uma aurora permanente lambe os polos em silêncio.',
        'O sol distante só consegue dourar as cristas das geleiras.'
    ],
    carbon: [
        'Uma joia opaca de grafite e diamante bruto.',
        'Cânions negros absorvem quase toda a luz da estrela.',
        'A superfície brilha como carvão molhado sob o vento.'
    ],
    gas: [
        'Faixas de amônia giram em torno de uma tempestade eterna.',
        'Um sistema de anéis varre a órbita como um disco de cinzas douradas.',
        'A Grande Mancha deste mundo engole luas menores.'
    ],
    icegiant: [
        'Metano profundo tinge o gigante de azul-elétrico.',
        'Anéis tênues de gelo orbitam como um halo quebrado.',
        'Ventos a milhares de km/h riscavam as faixas do equador.'
    ]
};

function sampleRange(rng, pair) {
    if (typeof pair === 'number') return pair;
    return randRange(rng, pair[0], pair[1]);
}

function jitterColor(rng, rgb, amt = 0.08) {
    return rgb.map((c) => Math.min(1, Math.max(0, c + (rng() - 0.5) * amt)));
}

function kindForZone(rng, zone) {
    const table = zone < 0.72 ? INNER_KINDS : zone < 1.28 ? HAB_KINDS : OUTER_KINDS;
    return pickWeighted(rng, table).id;
}

function planetRadius(rng, kindId) {
    if (kindId === 'gas') return randRange(rng, 0.42, 0.58);
    if (kindId === 'icegiant') return randRange(rng, 0.34, 0.46);
    if (kindId === 'ocean' || kindId === 'terra') return randRange(rng, 0.2, 0.3);
    if (kindId === 'ice') return randRange(rng, 0.18, 0.28);
    return randRange(rng, 0.16, 0.26);
}

function makePlanet(rng, kindId, index) {
    const spec = KINDS[kindId];
    const ringsChance = spec.rings;
    const rings = rng() < ringsChance ? randRange(rng, 0.35, 1) : (rng() < 0.06 ? randRange(rng, 0.2, 0.5) : 0);

    return {
        kindId,
        kind: spec.kind,
        label: spec.label,
        name: pick(rng, PLANET_NAMES),
        designation: String.fromCharCode(98 + index),
        lore: pick(rng, LORE[kindId]),
        water: sampleRange(rng, spec.water),
        ice: sampleRange(rng, spec.ice),
        temp: sampleRange(rng, spec.temp),
        clouds: sampleRange(rng, spec.clouds),
        atmos: sampleRange(rng, spec.atmos),
        mountain: sampleRange(rng, spec.mountain),
        warp: sampleRange(rng, spec.warp),
        cities: sampleRange(rng, spec.cities),
        emissive: sampleRange(rng, spec.emissive),
        rings,
        moons: randInt(rng, spec.moons[0], spec.moons[1]),
        oceanDeep: jitterColor(rng, spec.oceanDeep, 0.06),
        oceanShallow: jitterColor(rng, spec.oceanShallow, 0.06),
        landA: jitterColor(rng, spec.landA, 0.08),
        landB: jitterColor(rng, spec.landB, 0.08),
        desert: jitterColor(rng, spec.desert, 0.08),
        snow: jitterColor(rng, spec.snow, 0.04),
        lava: jitterColor(rng, spec.lava, 0.1),
        atmosColor: jitterColor(rng, spec.atmosColor, 0.08),
        atmosColor2: jitterColor(rng, spec.atmosColor2, 0.08),
        ringColor: jitterColor(rng, spec.kind === 1 ? spec.desert : spec.snow, 0.1),
        seed: rng() * 1000,
        cloudSeed: rng() * 1000,
        aurora: kindId === 'ice' || kindId === 'terra' ? randRange(rng, 0.25, 0.85) : rng() * 0.25
    };
}

function systemName(rng, star) {
    const prefix = pick(rng, PREFIX);
    const mode = rng();
    if (mode < 0.4) return `${prefix}-${randInt(rng, 12, 980)}`;
    if (mode < 0.7) return `${prefix} ${pick(rng, SUFFIX)}`;
    return `${prefix} ${star.id}-${randInt(rng, 2, 88)}`;
}

export function generateSystem(seed) {
    const rng = mulberry32(seed >>> 0);
    const star = { ...pickWeighted(rng, STAR_TYPES) };
    star.seed = rng() * 800;
    star.spin = randRange(rng, 0.04, 0.14);
    star.spot = randRange(rng, 0.08, 0.35);

    const count = randInt(rng, 4, 6);
    const planets = [];
    let orbit = star.innerOrbit + rng() * 0.35;

    for (let i = 0; i < count; i++) {
        orbit += star.orbitStep * randRange(rng, 0.78, 1.18);
        const zone = orbit / star.habitable;
        const kindId = kindForZone(rng, zone);
        const planet = makePlanet(rng, kindId, i);
        planet.orbit = orbit;
        planet.radius = planetRadius(rng, kindId);
        planet.inclination = (rng() - 0.5) * 0.18;
        planet.orbitSpeed = (0.22 + rng() * 0.08) / Math.sqrt(orbit);
        planet.spin = (0.25 + rng() * 1.4) * (rng() < 0.12 ? -1 : 1);
        planet.tilt = (rng() - 0.5) * 0.55;
        planet.phase = rng() * Math.PI * 2;
        planets.push(planet);
    }

    return {
        seed: seed >>> 0,
        name: systemName(rng, star),
        star,
        planets,
        belt: {
            inner: planets[Math.min(2, planets.length - 1)].orbit + 0.35,
            outer: planets[Math.min(3, planets.length - 1)].orbit - 0.25,
            count: 1
        }
    };
}

export const SHOWCASE = [
    { seed: 1, title: 'Via habitável' },
    { seed: 8, title: 'Gigante em anéis' },
    { seed: 29, title: 'Anã vermelha' },
    { seed: 2, title: 'Catedral de gelo' },
    { seed: 14, title: 'Forja vulcânica' }
];

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
