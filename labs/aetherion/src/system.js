/**
 * Gerador de sistemas estelares. Kepler simplificado: período ∝ a^1.5,
 * órbitas quase circulares com pequena inclinação.
 */

import * as THREE from 'three';
import { createStar } from './star.js';
import { createPlanet } from './planet.js';
import { createBlackHole } from './blackhole.js';
import { createSky } from './sky.js';
import { createAsteroidBelt, createComet } from './asteroids.js';

const AU = 42;

const STAR_TYPES = {
    g: {
        label: 'Anã amarela',
        radius: 6.4,
        palette: {
            hot: '#fff6d8',
            mid: '#ffb347',
            cool: '#ff6a22',
            corona: '#ffd18a',
            light: '#ffe6b0',
            ambient: '#1a2238',
            intensity: 1.35,
            lightIntensity: 1800
        }
    },
    k: {
        label: 'Anã laranja',
        radius: 5.4,
        palette: {
            hot: '#ffe0c0',
            mid: '#ff8a3d',
            cool: '#c44512',
            corona: '#ffb070',
            light: '#ffc090',
            ambient: '#241818',
            intensity: 1.2,
            lightIntensity: 1400
        }
    },
    a: {
        label: 'Estrela branca-azul',
        radius: 8.2,
        palette: {
            hot: '#f7fbff',
            mid: '#b8d4ff',
            cool: '#6a9fff',
            corona: '#cfe4ff',
            light: '#dce8ff',
            ambient: '#101828',
            intensity: 1.55,
            lightIntensity: 2400
        }
    },
    m: {
        label: 'Anã vermelha',
        radius: 4.6,
        palette: {
            hot: '#ffd0a8',
            mid: '#ff5a2a',
            cool: '#8a1208',
            corona: '#ff7a4a',
            light: '#ff7040',
            ambient: '#1c1014',
            intensity: 1.1,
            lightIntensity: 900
        }
    },
    f: {
        label: 'Estrela branco-amarela',
        radius: 7.1,
        palette: {
            hot: '#fffaf0',
            mid: '#ffe9a8',
            cool: '#ffaa55',
            corona: '#ffe7b8',
            light: '#fff4d8',
            ambient: '#141820',
            intensity: 1.4,
            lightIntensity: 2000
        }
    }
};

const NAMES = {
    star: ['Helion', 'Aether', 'Lumen', 'Solara', 'Lyra', 'Vega', 'Altair', 'Caelum'],
    rocky: ['Pyra', 'Cinder', 'Ferrum', 'Obsidia', 'Hestia', 'Basalto'],
    desert: ['Sahra', 'Aurel', 'Ochra', 'Solara', 'Duna'],
    terra: ['Gaia', 'Vespera', 'Miria', 'Eden', 'Thalassa', 'Nova'],
    ocean: ['Nereida', 'Pelagia', 'Maris', 'Abyssia', 'Undina'],
    lava: ['Magma', 'Inferna', 'Pyroclast', 'Hephaestia'],
    gas: ['Kronos', 'Tempest', 'Zephyrus', 'Titanor', 'Jovian'],
    ice: ['Nyx', 'Glacia', 'Khione', 'Boreal', 'Frost'],
    hole: ['Abismo', 'Nyxar', 'Vórtice', 'Sombra', 'Evento'],
    belt: ['Cinturão de Ícaros', 'Anel de Asteria', 'Faixa de Pó'],
    comet: ['Mensageiro', 'Halix', 'Cauda de Prata'],
    moon: ['Selene', 'Io', 'Callisto', 'Phobos', 'Nix', 'Dione']
};

const BLURBS = {
    star: 'Fotosfera em ebulição, manchas e uma coroa que foge para o vazio.',
    rocky: 'Crosta craterada, sem ar — um arquivo de impactos antigos.',
    desert: 'Dunas de óxido e vento fino. O horizonte queima em ocre.',
    terra: 'Continentes vivos, nuvens à deriva e cidades no hemisfério noturno.',
    ocean: 'Um mundo de água. Tempestades rasas, gelo nos polos, brilho especular.',
    lava: 'Crosta negra rachada por rios de magma que pulsam com o tempo.',
    gas: 'Faixas de tempestade e um olho que nunca dorme. Anéis, às vezes.',
    ice: 'Metano congelado, fendas azuladas e um brilho de porcelana.',
    hole: 'Horizonte de eventos, disco de acreção e jatos que furam o céu.',
    belt: 'Pedra residual da formação do sistema — um anel de ruínas.',
    comet: 'Núcleo sujo de gelo. A cauda sempre aponta para longe da estrela.',
    moon: 'Satélite cativo, craterado, preso à gravidade do mundo-mãe.'
};

const COMP = {
    star: 'Hidrogênio · Hélio',
    rocky: 'Silicatos · Ferro',
    desert: 'Óxidos · Basalto',
    terra: 'N₂ · O₂ · Água',
    ocean: 'H₂O · Sais',
    lava: 'Basalto · Magma',
    gas: 'H₂ · He · Amônia',
    ice: 'Gelo · Metano',
    hole: 'Espaço-tempo',
    belt: 'Condritos · Níquel',
    comet: 'Gelo · Poeira',
    moon: 'Regolito · Rocha'
};

function mulberry32(seed) {
    let a = seed >>> 0;
    return function rng() {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
}

function pickStar(rng) {
    const roll = rng();
    if (roll < 0.3) return 'g';
    if (roll < 0.52) return 'k';
    if (roll < 0.7) return 'f';
    if (roll < 0.86) return 'a';
    return 'm';
}

function keplerPeriod(orbitRadius) {
    const a = orbitRadius / AU;
    return Math.pow(Math.max(a, 0.08), 1.5) * 24;
}

function orbitLine(radius, color, inclination) {
    const pts = [];
    const steps = 160;
    for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        pts.push(new THREE.Vector3(
            Math.cos(a) * radius,
            Math.sin(a) * radius * inclination,
            Math.sin(a) * radius
        ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity: 0.16
        })
    );
    line.userData.orbit = true;
    return line;
}

function disposeObject(root) {
    root.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        const mats = child.material
            ? (Array.isArray(child.material) ? child.material : [child.material])
            : [];
        for (const mat of mats) {
            for (const key of Object.keys(mat)) {
                const val = mat[key];
                if (val && val.isTexture) val.dispose();
            }
            mat.dispose();
        }
    });
}

function planetColors(type, rng) {
    if (type === 'terra') {
        return {
            uOcean: new THREE.Color().setHSL(0.58 + rng() * 0.04, 0.75, 0.18),
            uLand: new THREE.Color().setHSL(0.28 + rng() * 0.08, 0.45, 0.28),
            uCoast: new THREE.Color().setHSL(0.14, 0.35, 0.42),
            uIce: new THREE.Color('#e8f0f8'),
            uCity: new THREE.Color('#ffd18a'),
            cloud: '#f4f7ff',
            cloudCover: 0.48 + rng() * 0.12,
            spin: 0.15
        };
    }
    if (type === 'ocean') {
        return {
            uDeep: new THREE.Color().setHSL(0.58, 0.7, 0.12 + rng() * 0.05),
            uShallow: new THREE.Color().setHSL(0.52, 0.55, 0.32),
            uFoam: new THREE.Color('#d7f0ff'),
            spin: 0.12
        };
    }
    if (type === 'desert') {
        return {
            uDune: new THREE.Color().setHSL(0.08 + rng() * 0.04, 0.55, 0.42),
            uRock: new THREE.Color().setHSL(0.05, 0.35, 0.28),
            uDark: new THREE.Color().setHSL(0.06, 0.4, 0.18),
            spin: 0.1
        };
    }
    if (type === 'rocky') {
        return {
            uA: new THREE.Color().setHSL(0.05 + rng() * 0.08, 0.18, 0.32),
            uB: new THREE.Color().setHSL(0.02, 0.12, 0.18),
            uCrater: new THREE.Color('#1a1614'),
            spin: 0.08
        };
    }
    if (type === 'lava') {
        return {
            uCrust: new THREE.Color('#1a0e0a'),
            uGlow: new THREE.Color().setHSL(0.04 + rng() * 0.03, 0.9, 0.52),
            spin: 0.09
        };
    }
    if (type === 'gas') {
        return {
            uA: new THREE.Color().setHSL(rng() * 0.15 + 0.05, 0.45, 0.42),
            uB: new THREE.Color().setHSL(rng() * 0.12 + 0.55, 0.35, 0.38),
            uStorm: new THREE.Color().setHSL(0.02, 0.7, 0.45),
            spin: 0.22
        };
    }
    return {
        uIce: new THREE.Color().setHSL(0.55 + rng() * 0.08, 0.25, 0.78),
        uDeep: new THREE.Color().setHSL(0.58, 0.35, 0.42),
        uCrack: new THREE.Color('#9ad0e8'),
        spin: 0.07
    };
}

function hudColor(type, colors) {
    if (type === 'terra') return '#' + colors.uLand.getHexString();
    if (type === 'ocean') return '#' + colors.uShallow.getHexString();
    if (type === 'desert') return '#' + colors.uDune.getHexString();
    if (type === 'rocky') return '#' + colors.uA.getHexString();
    if (type === 'lava') return '#' + colors.uGlow.getHexString();
    if (type === 'gas') return '#' + colors.uA.getHexString();
    if (type === 'ice') return '#' + colors.uIce.getHexString();
    return '#9ad8ff';
}

export class StarSystem {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.root = new THREE.Group();
        this.scene.add(this.root);
        this.bodies = [];
        this.updaters = [];
        this.seed = 1;
        this.sky = null;
    }

    generate(seed = (Math.random() * 0xffffffff) >>> 0) {
        this.clear();
        this.seed = seed >>> 0;
        const rng = mulberry32(this.seed);
        const starKey = pickStar(rng);
        const starDef = STAR_TYPES[starKey];
        const segs = this.quality.planetSegs;

        this.sky = createSky(rng, this.quality);
        this.scene.add(this.sky.group);
        this.updaters.push(this.sky);

        const star = createStar({
            radius: starDef.radius,
            palette: starDef.palette,
            segs
        });
        this.root.add(star.group);
        this.updaters.push(star);
        this.bodies.push({
            id: 'star',
            name: pick(rng, NAMES.star),
            kind: 'star',
            type: 'star',
            subtitle: starDef.label,
            radius: starDef.radius,
            orbitRadius: 0,
            period: 0,
            group: star.group,
            pickMesh: star.pickMesh,
            color: starDef.palette.mid,
            composition: COMP.star,
            blurb: BLURBS.star,
            focusDistance: starDef.radius * 4.2
        });

        const innerTypes = ['rocky', 'lava', 'desert'];
        const habTypes = ['terra', 'ocean', 'desert'];
        const outerTypes = ['gas', 'ice'];

        const layout = [
            { type: pick(rng, innerTypes), au: 0.38 + rng() * 0.12, r: 0.9 + rng() * 0.4 },
            { type: pick(rng, innerTypes.filter((t) => t !== 'lava').concat(['desert'])), au: 0.62 + rng() * 0.14, r: 1.1 + rng() * 0.5 },
            { type: pick(rng, habTypes), au: 0.95 + rng() * 0.18, r: 1.5 + rng() * 0.35 },
            { type: rng() < 0.5 ? 'rocky' : 'desert', au: 1.38 + rng() * 0.16, r: 0.85 + rng() * 0.3 }
        ];

        if (rng() > 0.25) {
            layout.push({ type: pick(rng, outerTypes), au: 2.35 + rng() * 0.35, r: 3.6 + rng() * 1.4, rings: rng() > 0.35 });
        } else {
            layout.push({ type: 'gas', au: 2.4 + rng() * 0.3, r: 4.2 + rng() * 1.1, rings: true });
        }

        layout.push({ type: 'ice', au: 3.35 + rng() * 0.35, r: 2.2 + rng() * 0.7, rings: rng() > 0.7 });

        if (rng() > 0.45) {
            layout.push({ type: rng() > 0.5 ? 'ice' : 'rocky', au: 4.2 + rng() * 0.4, r: 0.7 + rng() * 0.35 });
        }

        const usedNames = new Set();
        const takeName = (type) => {
            const pool = NAMES[type] || NAMES.rocky;
            let name = pick(rng, pool);
            let i = 0;
            while (usedNames.has(name) && i++ < 8) name = pick(rng, pool);
            usedNames.add(name);
            return name;
        };

        for (let i = 0; i < layout.length; i++) {
            const spec = layout[i];
            const orbitRadius = spec.au * AU;
            const inclination = (rng() - 0.5) * 0.08;
            const colors = planetColors(spec.type, rng);
            const radius = spec.r;
            const hasClouds = spec.type === 'terra' || spec.type === 'ocean';
            const atmo = spec.type === 'terra'
                ? '#7ec8ff'
                : spec.type === 'ocean'
                    ? '#5ad0c8'
                    : spec.type === 'gas'
                        ? '#c9b07a'
                        : spec.type === 'ice'
                            ? '#9ad8ff'
                            : spec.type === 'desert'
                                ? '#e8b07a'
                                : null;
            const planet = createPlanet({
                type: spec.type,
                radius,
                segs: spec.type === 'gas' ? segs : Math.max(32, segs - 16),
                colors,
                clouds: hasClouds,
                atmosphere: atmo,
                rings: spec.rings
                    ? {
                        inner: 1.45,
                        outer: 2.35 + rng() * 0.4,
                        a: '#d9c4a0',
                        b: '#8a7355',
                        tilt: 0.12 + rng() * 0.12
                    }
                    : null,
                tilt: (rng() - 0.5) * 0.4
            });

            const holder = new THREE.Group();
            holder.add(planet.group);
            this.root.add(holder);
            this.root.add(orbitLine(orbitRadius, 0x88aacc, inclination));

            const body = {
                id: `p${i}`,
                name: takeName(spec.type),
                kind: 'planet',
                type: spec.type,
                subtitle: subtitleFor(spec.type),
                radius,
                orbitRadius,
                period: keplerPeriod(orbitRadius),
                phase: rng() * Math.PI * 2,
                inclination,
                group: holder,
                visual: planet,
                pickMesh: planet.pickMesh,
                color: hudColor(spec.type, colors),
                composition: COMP[spec.type],
                blurb: BLURBS[spec.type],
                focusDistance: radius * 4.8 + 6
            };
            this.bodies.push(body);
            this.updaters.push({
                update: (time, dt) => planet.update(time, dt)
            });

            if ((spec.type === 'terra' || spec.type === 'gas' || spec.type === 'ice') && rng() > 0.35) {
                const moonCount = spec.type === 'gas' ? 1 + Math.floor(rng() * 2) : 1;
                for (let m = 0; m < moonCount; m++) {
                    const moonR = 0.28 + rng() * 0.22;
                    const moon = createPlanet({
                        type: 'rocky',
                        radius: moonR,
                        segs: 24,
                        colors: planetColors('rocky', rng),
                        tilt: 0
                    });
                    const moonHold = new THREE.Group();
                    moonHold.add(moon.group);
                    holder.add(moonHold);
                    const moonOrbit = radius * (2.4 + m * 0.9 + rng() * 0.4);
                    const moonBody = {
                        id: `p${i}m${m}`,
                        name: takeName('moon'),
                        kind: 'moon',
                        type: 'moon',
                        subtitle: `Lua de ${body.name}`,
                        radius: moonR,
                        orbitRadius: moonOrbit,
                        period: 4 + rng() * 6,
                        phase: rng() * Math.PI * 2,
                        inclination: (rng() - 0.5) * 0.15,
                        group: moonHold,
                        visual: moon,
                        pickMesh: moon.pickMesh,
                        color: '#b9b3aa',
                        composition: COMP.moon,
                        blurb: BLURBS.moon,
                        focusDistance: moonR * 8 + 4,
                        parent: body
                    };
                    this.bodies.push(moonBody);
                    this.updaters.push({
                        update: (time, dt) => moon.update(time, dt)
                    });
                }
            }
        }

        const beltInner = 1.72 * AU;
        const beltOuter = 2.12 * AU;
        const belt = createAsteroidBelt({
            inner: beltInner,
            outer: beltOuter,
            count: this.quality.asteroids,
            rng
        });
        this.root.add(belt.mesh);
        this.updaters.push(belt);
        this.bodies.push({
            id: 'belt',
            name: pick(rng, NAMES.belt),
            kind: 'belt',
            type: 'belt',
            subtitle: 'Cinturão de asteroides',
            radius: 4,
            orbitRadius: (beltInner + beltOuter) * 0.5,
            period: keplerPeriod((beltInner + beltOuter) * 0.5),
            group: belt.mesh,
            pickMesh: belt.mesh,
            color: '#8a8178',
            composition: COMP.belt,
            blurb: BLURBS.belt,
            focusDistance: 28
        });
        this.root.add(orbitLine((beltInner + beltOuter) * 0.5, 0x6a625c, 0.02));

        const comet = createComet(rng);
        this.root.add(comet.group);
        const cometOrbit = 3.8 * AU + rng() * 0.8 * AU;
        const cometBody = {
            id: 'comet',
            name: pick(rng, NAMES.comet),
            kind: 'comet',
            type: 'comet',
            subtitle: 'Cometa periódico',
            radius: 0.7,
            orbitRadius: cometOrbit,
            period: keplerPeriod(cometOrbit) * 0.7,
            phase: rng() * Math.PI * 2,
            inclination: 0.22 + rng() * 0.15,
            ecc: 0.45,
            group: comet.group,
            pickMesh: comet.pickMesh,
            color: '#c8e4ff',
            composition: COMP.comet,
            blurb: BLURBS.comet,
            focusDistance: 14
        };
        this.bodies.push(cometBody);
        this.updaters.push({
            update: () => {
                comet.update(comet.group.position);
            }
        });

        if (rng() > 0.28) {
            const hole = createBlackHole({
                radius: 2.8 + rng() * 1.1,
                segs: Math.max(32, segs * 0.6)
            });
            const holeHold = new THREE.Group();
            holeHold.add(hole.group);
            this.root.add(holeHold);
            const holeOrbit = 5.6 * AU + rng() * 0.6 * AU;
            this.root.add(orbitLine(holeOrbit, 0xff6a4a, 0.12));
            this.updaters.push(hole);
            this.bodies.push({
                id: 'hole',
                name: pick(rng, NAMES.hole),
                kind: 'hole',
                type: 'hole',
                subtitle: 'Buraco negro companheiro',
                radius: 3.4,
                orbitRadius: holeOrbit,
                period: keplerPeriod(holeOrbit) * 1.8,
                phase: rng() * Math.PI * 2,
                inclination: 0.12,
                group: holeHold,
                pickMesh: hole.pickMesh,
                color: '#ff6a4a',
                composition: COMP.hole,
                blurb: BLURBS.hole,
                focusDistance: 28
            });
        }

        this._place(0);
        for (const body of this.bodies) {
            if (body.pickMesh) body.pickMesh.userData.bodyId = body.id;
        }
        return this.seed;
    }

    _place(simTime) {
        for (const body of this.bodies) {
            if (!body.orbitRadius || body.kind === 'belt' || body.kind === 'star') continue;
            const period = Math.max(body.period, 0.01);
            const angle = body.phase + (simTime / period) * Math.PI * 2;
            const ecc = body.ecc || 0;
            const r = body.orbitRadius * (1 - ecc * Math.cos(angle));
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            const y = Math.sin(angle) * r * (body.inclination || 0);
            if (body.parent) {
                body.group.position.set(x, y, z);
            } else {
                body.group.position.set(x, y, z);
            }
        }
    }

    update(simTime, dt) {
        this._place(simTime);
        for (const item of this.updaters) {
            item.update(simTime, dt);
        }
    }

    clear() {
        for (const child of [...this.root.children]) {
            disposeObject(child);
            this.root.remove(child);
        }
        if (this.sky) {
            disposeObject(this.sky.group);
            this.scene.remove(this.sky.group);
            this.sky = null;
        }
        this.bodies = [];
        this.updaters = [];
    }
}

function subtitleFor(type) {
    return {
        rocky: 'Planeta rochoso',
        desert: 'Mundo desértico',
        terra: 'Planeta terrestre',
        ocean: 'Mundo oceânico',
        lava: 'Mundo vulcânico',
        gas: 'Gigante gasoso',
        ice: 'Gigante de gelo'
    }[type] || 'Mundo';
}
