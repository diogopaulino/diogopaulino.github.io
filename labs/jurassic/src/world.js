/**
 * Jurassic — a ilha: relevo, trilhas, lago, mar, selva e dispersão de plantas.
 *
 * Tudo sobre `shared/gfx/terrain.js` (terreno PBR com splat, grama instanciada,
 * floresta com impostores) e `shared/gfx/ocean.js` (ondas de Gerstner).
 *
 * RELEVO — h(x, z):
 *   interior  = 4,2 + 13·(fbm − ½) + detalhe
 *               achatado em platôs: lago (cota 4), prado (5), paddock (5,5), portão (3,4)
 *               + crista dos estegossauros: 12·exp(−(d/17)²) ao longo de `stegoWalk`
 *   costa     R(θ) = 140 + 9·sin(3θ + 1) + 5·sin(7θ + 2,3)        (linha d'água)
 *   praia(r)  = clamp((R − r)·0,085; −7; 6)                        (1 m de subida a cada ~12 m)
 *   h         = lerp(interior, praia, smoothstep(R − 44, R − 12, r)) + promontório do farol
 *   as trilhas rebaixam 0,18 m (course.carve) e o lago é uma bacia (carveBasin)
 * O mar usa a mesma R(θ) em GLSL para saber a profundidade (espuma e cor do raso).
 */

import * as THREE from 'three';
import { WORLD } from './config.js?v=23';
import { fbm2, smoothstep, lerp, clamp, seeded } from '../../shared/gfx/core.js';
import {
    createCourse, carveBasin, createTerrain, createGrass, createForest, createWater, createPath, scatter, scatterModel
} from '../../shared/gfx/terrain.js';
import { createOcean } from '../../shared/gfx/ocean.js';

const LAKE_FLOOR = 4.0;
const LAKE_LEVEL = LAKE_FLOOR - 0.75;
const BEACH_SLOPE = 0.085;

export function coastRadius(x, z) {
    const th = Math.atan2(z, x);
    return WORLD.islandRadius + 9 * Math.sin(3 * th + 1) + 5 * Math.sin(7 * th + 2.3);
}

const SEA_DEPTH_GLSL = /* glsl */ `
float gfxSeaDepth(vec2 xz) {
    float th = atan(xz.y, xz.x);
    float R = ${WORLD.islandRadius.toFixed(1)} + 9.0 * sin(3.0 * th + 1.0) + 5.0 * sin(7.0 * th + 2.3);
    return (length(xz) - R) * ${BEACH_SLOPE.toFixed(3)};
}`;

const nextTask = () => new Promise((r) => setTimeout(r, 0));
/** Lado da célula da grade de colisores fixos (m). */
const CELL = 8;

export class World {
    /**
     * @param {object} stage    retorno de createStage
     * @param {object} quality  entrada de QUALITY
     * @param {(p:number, text:string)=>void} progress
     */
    static async create(stage, quality, progress = () => {}) {
        const w = new World(stage, quality);
        progress(0.12, 'Levantando o relevo da ilha…');
        await nextTask();
        w._terrain();
        progress(0.24, 'Abrindo as trilhas e enchendo o lago…');
        await nextTask();
        w._water();
        progress(0.34, 'Plantando a selva…');
        await nextTask();
        w._forest();
        progress(0.46, 'Semeando o capim…');
        await nextTask();
        w._grass();
        w._scatter();
        return w;
    }

    constructor(stage, quality) {
        this.stage = stage;
        this.scene = stage.scene;
        this.quality = quality;
        this.tier = stage.tier;
        this.colliders = [];
        this.dynamic = [];
        this.lakeLevel = LAKE_LEVEL;
        this.gateOpen = 0;
        this._hit = { x: 0, z: 0, hit: false };

        const P = WORLD;
        this.loop = createCourse(P.loop, { width: 3.2, closed: true });
        this.spurGate = createCourse(P.spurGate, { width: 3.2 });
        this.spurTower = createCourse(P.spurTower, { width: 2.8 });
        this.spurRidge = createCourse(P.spurRidge, { width: 2.8 });
        this.stegoWalk = createCourse(P.stegoWalk, { width: 3 });
        this.roads = [this.loop, this.spurGate, this.spurTower, this.spurRidge];
    }

    /** Relevo do interior, antes da costa. */
    _inland(x, z) {
        const P = WORLD;
        const n = fbm2(x * 0.0105 + 10, z * 0.0105 + 20, 4);
        let h = 4.2 + (n - 0.5) * 13 + (fbm2(x * 0.05, z * 0.05, 3) - 0.5) * 1.3;
        const soft = (fbm2(x * 0.045 + 4, z * 0.045 + 1, 2) - 0.5);
        // platô do lago: a lâmina d'água não vaza em baixadas vizinhas
        const dl = Math.hypot(x - P.lake.x, z - P.lake.z);
        h = lerp(h, LAKE_FLOOR + soft * 1.0, 1 - smoothstep(28, 60, dl));
        // prado dos tricerátops
        const dm = Math.hypot(x - P.meadow.x, z - P.meadow.z);
        h = lerp(h, 5 + soft * 1.6, 1 - smoothstep(P.meadow.radius * 0.7, P.meadow.radius * 1.5, dm));
        // paddock do rex (elipse)
        const pe = Math.hypot((x - P.paddock.x) / P.paddock.rx, (z - P.paddock.z) / P.paddock.rz);
        h = lerp(h, 5.5 + soft * 1.8, 1 - smoothstep(0.85, 1.5, pe));
        // clareira dos raptors
        const dr = Math.hypot(x - P.raptors.x, z - P.raptors.z);
        h = lerp(h, 4.6 + soft * 1.4, 1 - smoothstep(P.raptors.radius * 0.6, P.raptors.radius * 1.6, dr));
        // pátio do portão e do centro de visitantes
        const dg = Math.min(Math.hypot(x - P.center.x, z - P.center.z), Math.hypot(x - P.gate.x, z - (P.gate.z + 8)) * 0.9);
        h = lerp(h, 3.4, 1 - smoothstep(13, 30, dg));
        // crista dos estegossauros
        const ds = this.stegoWalk.dist(x, z, 60);
        if (ds !== Infinity) h += 12 * Math.exp(-((ds / 17) ** 2));
        return h;
    }

    heightFn = (x, z) => {
        const P = WORLD;
        const r = Math.hypot(x, z);
        const R = coastRadius(x, z);
        let h = this._inland(x, z);
        const beach = clamp((R - r) * BEACH_SLOPE, -7, 6) + (fbm2(x * 0.07 + 9, z * 0.07, 2) - 0.5) * 0.5;
        h = lerp(h, beach, smoothstep(R - 44, R - 12, r));
        // promontório rochoso do farol
        const dt = Math.hypot(x - P.tower.x, z - P.tower.z);
        h += 9.5 * Math.exp(-((dt / 15) ** 2)) * (1 + (fbm2(x * 0.09, z * 0.09, 2) - 0.5) * 0.3);
        h = lerp(h, 11.6, 1 - smoothstep(3.5, 9, dt));
        for (const road of this.roads) h = road.carve(x, z, h, { depth: 0.18, width: 2.6, bank: 2.2 });
        return carveBasin(x, z, h, { ...P.lake, floor: LAKE_FLOOR - 3.4 });
    };

    _terrain() {
        const P = WORLD;
        this.terrain = createTerrain({
            size: P.size,
            heightFn: this.heightFn,
            tier: this.tier,
            layers: [
                { set: 'leafy_grass', scale: 3.4, tint: 0x9cc27a },
                { set: 'dirt_floor', scale: 3.0, tint: 0x9a9484 },
                { set: 'cliff_side', scale: 7.0 },
                { set: 'sand_01', scale: 3.0, tint: 0xeadfc4 }
            ],
            // [terra, rocha, areia, umidade]
            splatFn: (x, z, h, slope, out) => {
                const n = fbm2(x * 0.045 + 31, z * 0.045 + 17, 3);
                const rock = smoothstep(0.17, 0.34, slope + (n - 0.5) * 0.14);
                const sand = (1 - smoothstep(1.2, 2.5, h + (n - 0.5) * 0.9)) * (1 - rock);
                const patch = smoothstep(0.6, 0.82, fbm2(x * 0.024 + 5, z * 0.024 + 2, 2)) * 0.75;
                out[0] = clamp(patch + smoothstep(0.1, 0.2, slope) * 0.5, 0, 1) * (1 - rock) * (1 - sand);
                out[1] = rock;
                out[2] = sand;
                out[3] = (1 - smoothstep(0.1, 0.7, h)) * 0.7;
                return out;
            }
        });
        this.scene.add(this.terrain.object);
        this.stage.follow(this.terrain);
        for (const road of this.roads) createPath({ terrain: this.terrain, course: road, ruts: true, edge: 0.8 });
        // pátio de terra batida diante do centro de visitantes
        this.terrain.paint({ minX: -32, maxX: 14, minZ: 96, maxZ: 126 }, (x, z, h, slope, wt) => {
            const d = Math.hypot((x + 6) / 1.25, z - 110);
            const k = (1 - smoothstep(9, 15, d + (fbm2(x * 0.3, z * 0.3, 2) - 0.5) * 4)) * 0.9;
            if (k <= 0) return wt;
            for (let i = 0; i < 3; i++) wt[i] *= 1 - k;
            wt[0] += k;
            return wt;
        });
    }

    _water() {
        this.lake = createWater({
            terrain: this.terrain, lake: { ...WORLD.lake, level: LAKE_LEVEL }, shallow: 0x55745a, deep: 0x10302e, shoreLayer: 3
        });
        this.scene.add(this.lake.object);
        this.ocean = createOcean({
            tier: this.tier,
            depthGLSL: SEA_DEPTH_GLSL,
            surf: true,
            surfAmp: 0.3,
            surfK: 4.2,
            surfSpeed: 0.7,
            surfDepth: 1.4,
            swash: 0.1,
            waveScale: 0.55,
            deep: 0x0b3944,
            shallow: 0x4a9a8a,
            scatter: 0x38a08e,
            deepDepth: 6
        });
        this.scene.add(this.ocean.mesh);
    }

    /** Densidade de selva 0..1 (clareiras onde os animais vivem e onde o jipe precisa ver longe). */
    jungle = (x, z) => {
        const P = WORLD;
        const c = smoothstep(0.36, 0.6, fbm2(x * 0.016 + 3, z * 0.016 + 8, 3));
        let k = 0.22 + 0.78 * c;
        k *= smoothstep(31, 40, Math.hypot(x - P.lake.x, z - P.lake.z));
        k *= smoothstep(P.meadow.radius * 0.95, P.meadow.radius * 1.3, Math.hypot(x - P.meadow.x, z - P.meadow.z));
        k *= smoothstep(0.92, 1.12, Math.hypot((x - P.paddock.x) / P.paddock.rx, (z - P.paddock.z) / P.paddock.rz));
        k *= smoothstep(P.raptors.radius * 0.8, P.raptors.radius * 1.15, Math.hypot(x - P.raptors.x, z - P.raptors.z));
        k *= smoothstep(19, 27, Math.hypot(x - P.center.x, z - P.center.z));
        k *= smoothstep(8, 14, Math.hypot(x - P.gate.x, z - P.gate.z));
        k *= smoothstep(9, 15, Math.hypot(x - P.tower.x, z - P.tower.z));
        k *= smoothstep(5, 9, this.stegoWalk.dist(x, z, 12));
        return k;
    };

    _forest() {
        const q = this.quality;
        const rnd = seeded(77);
        const t = this.terrain;
        const inland = scatter({
            terrain: t, count: q.trees, minDist: 5.2, seed: 4, slopeMax: 0.3, heightMin: 2.4,
            keepOff: this.roads, margin: 5.6, maskFn: this.jungle
        }).map((p) => {
            const u = rnd();
            const species = p.y < 3.6 ? (u < 0.75 ? 'palmeira' : 'cicadacea')
                : u < 0.3 ? 'samambaia' : u < 0.52 ? 'cicadacea' : u < 0.8 ? 'carvalho' : 'palmeira';
            return { ...p, species };
        });
        // coqueiros na praia
        const beach = scatter({
            terrain: t, count: Math.round(q.trees * 0.14), minDist: 7, seed: 19, slopeMax: 0.3, heightMin: 1.1, heightMax: 2.4,
            dry: false, keepOff: this.roads, margin: 4, maskFn: (x, z) => smoothstep(22, 30, Math.hypot(x - WORLD.center.x, z - WORLD.center.z))
        }).map((p) => ({ ...p, species: 'palmeira' }));
        // frondosas altas na margem do lago: é nelas que os braquiossauros comem
        this.browse = [[19, 1, 1.5], [7, 21, 1.4], [-41, 13, 1.45], [-30, -33, 1.35]].map(([x, z, s]) => ({
            x, z, y: t.heightAt(x, z), s, species: 'carvalho', browse: true
        }));
        const near = (p, list, d) => list.some((b) => Math.hypot(p.x - b.x, p.z - b.z) < d);
        const placements = [...inland.filter((p) => !near(p, this.browse, 9)), ...beach, ...this.browse];
        this.forest = createForest({
            terrain: t, renderer: this.stage.renderer, tier: this.tier, seed: 3, placements, lodDistance: q.lod, variants: 1,
            species: [
                { kind: 'carvalho', weight: 1, scale: [0.85, 1.2] }, { kind: 'palmeira', weight: 1 },
                { kind: 'cicadacea', weight: 1, scale: [1.0, 1.7] }, { kind: 'samambaia', weight: 1, scale: [0.9, 1.5] }
            ]
        });
        this.scene.add(this.forest.object);
        const R = { carvalho: 0.6, palmeira: 0.34, samambaia: 0.26, cicadacea: 0.45 };
        for (const p of placements) this.addCollider(p.x, p.z, (R[p.species] || 0.4) * (p.browse ? p.s : 1), true);
        this.trees = placements;
    }

    _grass() {
        this.grass = createGrass({
            terrain: this.terrain,
            tier: this.tier,
            density: this.quality.grass,
            range: this.quality.grassRange,
            bladeHeight: 0.36,
            dryness: 0.28,
            colors: { base: 0x2f5a1c, tip: 0x8fc04a, dry: 0xb7b060 },
            flowers: { density: 1.2, patch: 34, colors: [0xfff4d8, 0xffd04a, 0xe86a9a, 0xf2f2f2] }
        });
        this.scene.add(this.grass.object);
    }

    _scatter() {
        const q = this.quality;
        const t = this.terrain;
        const P = WORLD;
        const add = (g) => {
            if (!g) return;
            this.scene.add(g);
        };
        const rocky = (x, z) => 0.15 + t.slopeAt(x, z) * 4 + Math.exp(-((Math.hypot(x - P.tower.x, z - P.tower.z) / 20) ** 2)) * 2
            + Math.exp(-((this.stegoWalk.dist(x, z, 60) / 22) ** 2));
        const off = [...this.roads, this.stegoWalk];
        this.ready = Promise.all([
            scatterModel({ terrain: t, preset: 'rochas', count: q.rocks, seed: 5, heightMin: 0.4, keepOff: off, margin: 3.5, maskFn: rocky })
                .then((g) => {
                    add(g);
                    for (const p of g?.userData.placements || []) if (p.s > 0.75) this.addCollider(p.x, p.z, 0.7 * p.s, true);
                }),
            scatterModel({ terrain: t, preset: 'pedras', count: Math.round(q.rocks * 1.4), seed: 6, heightMin: 0.2, keepOff: off, margin: 3 }).then(add),
            scatterModel({
                terrain: t, preset: 'samambaias', count: q.ferns, seed: 7, heightMin: 2.2, keepOff: this.roads, margin: 1.6,
                maskFn: (x, z) => this.jungle(x, z) * 0.9 + 0.06
            }).then(add),
            scatterModel({
                terrain: t, preset: 'arbustos', count: q.shrubs, seed: 8, heightMin: 2.2, keepOff: off, margin: 2.6,
                maskFn: (x, z) => this.jungle(x, z)
            }).then(add),
            scatterModel({
                terrain: t, preset: 'ervas', count: Math.round(q.ferns * 0.6), seed: 12, heightMin: 2.2, keepOff: this.roads, margin: 1.2,
                area: { x: 0, z: 30, radius: 110 }
            }).then(add),
            scatterModel({ terrain: t, preset: 'tocos', count: 8, seed: 10, heightMin: 2.4, keepOff: off, maskFn: this.jungle }).then(add)
        ]).catch(() => {});
    }

    heightAt = (x, z) => this.terrain.heightAt(x, z);

    /** true sobre a terra batida (laço ou ramais): aderência cheia. */
    onRoad(x, z) {
        for (const road of this.roads) if (road.dist(x, z, 3.2) < 2.3) return true;
        return false;
    }

    /** Água funda demais para o jipe (lago ou mar). */
    flooded(x, z) {
        const h = this.terrain.heightAt(x, z);
        if (h < -0.25) return true;
        return h < LAKE_LEVEL - 0.55 && Math.hypot(x - WORLD.lake.x, z - WORLD.lake.z) < WORLD.lake.radius * 1.4;
    }

    /**
     * Obstáculo circular. Os fixos (árvores, rochas, cercas, prédios) entram numa grade
     * uniforme de `CELL` m — cada consulta só olha as células vizinhas em vez de ~900 círculos.
     * Os dinâmicos (dinossauros e o próprio jipe) ficam numa lista curta.
     */
    addCollider(x, z, r, fixed = true) {
        const c = { x, z, r, on: true };
        if (!fixed) {
            this.dynamic.push(c);
            return c;
        }
        this.colliders.push(c);
        const g = this._grid || (this._grid = new Map());
        this._maxR = Math.max(this._maxR || 0, r);
        const x0 = Math.floor((x - r) / CELL);
        const x1 = Math.floor((x + r) / CELL);
        const z0 = Math.floor((z - r) / CELL);
        const z1 = Math.floor((z + r) / CELL);
        for (let i = x0; i <= x1; i++) {
            for (let k = z0; k <= z1; k++) {
                const key = i * 4096 + k;
                let cell = g.get(key);
                if (!cell) g.set(key, (cell = []));
                cell.push(c);
            }
        }
        return c;
    }

    /** Empurra `out` para fora de um círculo (ver collide). */
    _push(out, c, radius) {
        const dx = out.x - c.x;
        const dz = out.z - c.z;
        const min = radius + c.r;
        if (Math.abs(dx) > min || Math.abs(dz) > min) return;
        const d = Math.hypot(dx, dz);
        if (d < min && d > 1e-4) {
            const s = min / d;
            out.x = c.x + dx * s;
            out.z = c.z + dz * s;
            out.hit = true;
        }
    }

    /**
     * Empurra o círculo (x, z, radius) para fora dos obstáculos.
     *   para cada obstáculo c: se d < radius + c.r → p = c + (p − c)·(radius + c.r)/d
     * `skip` = colisor do próprio corpo (um dinossauro não colide consigo mesmo).
     * Devolve um objeto reutilizado { x, z, hit }.
     */
    collide(x, z, radius, skip = null) {
        const out = this._hit;
        out.x = x;
        out.z = z;
        out.hit = false;
        const g = this._grid;
        if (g) {
            const x0 = Math.floor((x - radius) / CELL);
            const x1 = Math.floor((x + radius) / CELL);
            const z0 = Math.floor((z - radius) / CELL);
            const z1 = Math.floor((z + radius) / CELL);
            for (let i = x0; i <= x1; i++) {
                for (let k = z0; k <= z1; k++) {
                    const cell = g.get(i * 4096 + k);
                    if (!cell) continue;
                    for (let j = 0; j < cell.length; j++) if (cell[j].on) this._push(out, cell[j], radius);
                }
            }
        }
        const list = this.dynamic;
        for (let i = 0; i < list.length; i++) {
            const c = list[i];
            if (c.on && c !== skip) this._push(out, c, radius);
        }
        return out;
    }

    /** true se um círculo em (x, z) bate em algo fixo ou cai na água (sondagem de desvio da IA). */
    blocked(x, z, radius, skip = null) {
        if (this.flooded(x, z)) return true;
        return this.collide(x, z, radius, skip).hit;
    }

    /** Liga a grama/floresta a uma queda de tier (resolução dinâmica do palco). */
    setTier(tier) {
        this.grass?.setDensity(tier === 'low' ? 0.4 : tier === 'medium' ? 0.7 : 1);
    }

    update(dt, t, camera, tramplers) {
        this.terrain.update(camera);
        this.grass.update(camera, dt, tramplers);
        this.forest.update(camera);
        this.lake.update(dt);
        this.ocean.update(t, camera, this.stage.sky.daylight ?? 1);
    }
}
