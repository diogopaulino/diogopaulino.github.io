/**
 * O vale depois da chuva: relevo com texturas PBR, grama alta que dobra sob os
 * bichos, laguinho e riacho, bosque de bétulas e carvalhos, celeiro, ninho do
 * piquenique, arbustos de amora, cogumelos, borboletas, pássaros e arco-íris.
 *
 * Montagem (ordem exigida por gfx/terrain): traçados → terreno → trilhas/água
 * (pintam a máscara) → grama/floresta/dispersão (leem a máscara).
 *
 * RELEVO  h(x, z) = base(x, z)                               (config.heightAt)
 *                 + ruído fino + colinas do anel externo (fbm)
 *                 → platô do celeiro e da margem do lago (lerp por distância)
 *                 → vale do riacho: leito desce de H0 até o lago, leito(t) = lerp(H0, L0 − 0,3, t^0,8)
 *                 → bacia do lago (carveBasin), fundo em L0 − 0,95; espelho d'água em L0 − 0,22
 *
 * BOIAR   chão(x, z, altura) = max(terreno, nível − FLOAT·altura) dentro do lago;
 *         (no riacho vale o mesmo com o nível local da água);
 *         `swimming` fica true quando o bicho está boiando (vira o modo 'swim').
 *
 * COLISÃO círculos (troncos das árvores do miolo) e a caixa orientada do celeiro:
 *         o ponto é empurrado para fora pela menor penetração.
 */

import * as THREE from 'three';
import { fbm2, smoothstep, lerp, seeded } from '../../shared/gfx/core.js';
import {
    createCourse, carveBasin, createTerrain, createGrass, createForest, createWater, createPath, createFence,
    scatter, scatterModel
} from '../../shared/gfx/terrain.js';
import { loadModel, instanceModel } from '../../shared/gfx/assets.js';
import { createCreature } from '../../shared/gfx/creature.js';
import {
    WORLD_RADIUS, FRIENDS, TOTAL_BERRIES, BERRY_SPOTS, heightAt, HOME, BARN, POND, CREEK, TRAILS, FLOAT
} from './config.js?v=23';
import {
    createBarn, BARN_SIZE, createBlanket, createNestRim, createHomeGlow, mushroomGeometry, berryGeometry,
    createButterflies, createRainbow, createDew, createPollen
} from './builds.js?v=23';
import { createFriend } from './animals.js?v=23';

const TAU = Math.PI * 2;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);

/** Carga por tier do que é específico deste lab. */
const LOAD = {
    low: { trees: 90, butterflies: 8, birds: 1, dew: 500, pollen: 90, ferns: 24, weeds: 30, flowers: 40, rocks: 10, friendDetail: 0, berryDetail: 0 },
    medium: { trees: 150, butterflies: 16, birds: 2, dew: 1000, pollen: 160, ferns: 60, weeds: 80, flowers: 90, rocks: 22, friendDetail: 1, berryDetail: 1 },
    high: { trees: 200, butterflies: 24, birds: 3, dew: 1500, pollen: 240, ferns: 90, weeds: 130, flowers: 140, rocks: 30, friendDetail: 2, berryDetail: 1 }
};

/** Árvores plantadas à mão no miolo do vale (x, z, espécie, escala). */
const INNER_TREES = [
    // carvalho que dá sombra ao piquenique
    [-4.6, -1.0, 'carvalho', 0.62],
    // pomar do coelhinho
    [6.4, 19.4, 'carvalho', 0.44], [11.6, 21.6, 'carvalho', 0.5], [13.8, 14.0, 'carvalho', 0.42], [17.2, 16.8, 'carvalho', 0.47], [7.0, 12.2, 'carvalho', 0.4],
    // bosque de bétulas e cogumelos do ouriço
    [-21.6, -10.6, 'betula', 0.6], [-16.0, -11.6, 'betula', 0.52], [-21.2, -5.2, 'betula', 0.56], [-15.2, -5.8, 'betula', 0.5], [-24.2, -8.0, 'betula', 0.64],
    [-18.4, -13.6, 'betula', 0.48],
    // salgueiros na beira do lago
    [-23.2, 2.4, 'salgueiro', 0.5], [-10.4, 15.4, 'salgueiro', 0.46],
    // carvalho do morro do cordeiro
    [-10.4, -20.6, 'carvalho', 0.55],
    // bétulas soltas
    [21.5, -3.6, 'betula', 0.5], [-2.4, 22.5, 'betula', 0.55], [24.5, 10.5, 'betula', 0.5]
];
const TRUNK = { carvalho: 0.44, betula: 0.17, salgueiro: 0.4 };

export class Valley {
    /**
     * @param {object} stage  retorno de createStage
     * @param {(done:number, total:number)=>void} [onStep]  progresso da montagem assíncrona
     */
    constructor(stage) {
        this.stage = stage;
        this.scene = stage.scene;
        this.tier = stage.tier;
        this.load = LOAD[this.tier] || LOAD.medium;
        this.clock = 0;
        this.swimming = false;
        this.root = new THREE.Group();
        this.root.name = 'vale';
        this.scene.add(this.root);
        this.pending = [];
        this.colliders = [];
        this.groundFn = (x, z) => this.terrain.heightAt(x, z);

        this._terrain();
        this._vegetation();
        this._landmarks();
        this._berries();
        this._mushrooms();
        this._friends();
        this._life();
        /** Resolve quando texturas do terreno, impostores e modelos glTF chegaram (ou falharam). */
        /** Resolve quando texturas do terreno e modelos glTF chegaram (ou falharam). */
        this.ready = Promise.all([this.terrain.ready, ...this.pending]).catch(() => {});
    }

    groundHeight(x, z) {
        return this.terrain.heightAt(x, z);
    }

    /** Altura em que um bicho de altura `h` fica em (x, z): chão ou boiando no lago. Atualiza `swimming`. */
    floorY(x, z, h) {
        const g = this.terrain.heightAt(x, z);
        this.swimming = false;
        const dx = x - POND.x;
        const dz = z - POND.z;
        if (dx * dx + dz * dz < POND.radius * POND.radius * 1.7) {
            const f = this.pondLevel - FLOAT * h;
            if (f > g) {
                this.swimming = true;
                return f;
            }
        } else if (this.creek.dist(x, z, 2.4) < 2.4) {
            // riacho raso: os pequenos boiam, Nina só molha as patas
            const f = this.stream.levelAt(x, z) - FLOAT * h;
            if (f > g) {
                this.swimming = true;
                return f;
            }
        }
        return g;
    }

    /** Empurra `p` (Vector3) para fora de troncos e do celeiro. */
    collide(p, radius) {
        for (const c of this.colliders) {
            const dx = p.x - c.x;
            const dz = p.z - c.z;
            const r = c.r + radius;
            const d2 = dx * dx + dz * dz;
            if (d2 < r * r && d2 > 1e-6) {
                const d = Math.sqrt(d2);
                p.x = c.x + (dx / d) * r;
                p.z = c.z + (dz / d) * r;
            }
        }
        // celeiro: caixa orientada (meia-largura hx, meia-profundidade hz no referencial local)
        const cs = Math.cos(BARN.ry);
        const sn = Math.sin(BARN.ry);
        const wx = p.x - BARN.x;
        const wz = p.z - BARN.z;
        const lx = wx * cs - wz * sn;
        const lz = wx * sn + wz * cs;
        const hx = BARN_SIZE.w / 2 + radius;
        const hz = BARN_SIZE.d / 2 + radius;
        if (Math.abs(lx) < hx && Math.abs(lz) < hz) {
            const ox = hx - Math.abs(lx);
            const oz = hz - Math.abs(lz);
            let nx = lx;
            let nz = lz;
            if (ox < oz) nx = Math.sign(lx || 1) * hx;
            else nz = Math.sign(lz || 1) * hz;
            p.x = BARN.x + nx * cs + nz * sn;
            p.z = BARN.z - nx * sn + nz * cs;
        }
    }

    // ───────────────────────────── terreno e água ─────────────────────────────
    _terrain() {
        const tier = this.tier;
        const creek = createCourse(CREEK, { width: 2.2 });
        const trails = TRAILS.map((pts) => createCourse(pts, { width: 1.5 }));
        this.creek = creek;
        this.trails = trails;

        const L0 = -0.25;
        const H0 = heightAt(CREEK[0][0], CREEK[0][1]) + 1.2;
        const HB = heightAt(BARN.x, BARN.z);
        const heightFn = (x, z) => {
            const d = Math.hypot(x, z);
            let h = heightAt(x, z)
                + (fbm2(x * 0.07 + 4, z * 0.07 + 8, 3) - 0.5) * 0.55 * smoothstep(6, 26, d)
                + (fbm2(x * 0.017 + 5, z * 0.017 + 9, 4) - 0.42) * 15 * smoothstep(36, 78, d);
            // platô do celeiro
            h = lerp(h, HB, 1 - smoothstep(4.4, 8, Math.hypot(x - BARN.x, z - BARN.z)));
            // margem do lago quase plana, para o espelho d'água não vazar
            const dl = Math.hypot(x - POND.x, z - POND.z);
            h = lerp(h, L0 + (fbm2(x * 0.11, z * 0.11, 2) - 0.5) * 0.3, 1 - smoothstep(POND.radius + 1.5, POND.radius + 9, dl));
            // vale do riacho: perfil sempre descendo até o lago
            const s = creek.sample(x, z);
            if (s.d < 15) {
                const bed = lerp(H0, L0 - 0.3, Math.pow(s.t, 0.8));
                h = lerp(h, bed + Math.min(s.d * 0.1, 1.3), 1 - smoothstep(2.6, 15, s.d));
                h = creek.carve(x, z, h, { depth: 0.55, width: 1.8, bank: 1.7 });
            }
            for (const t of trails) h = t.carve(x, z, h, { depth: 0.07, width: 1.3, bank: 1.2 });
            return carveBasin(x, z, h, { x: POND.x, z: POND.z, radius: POND.radius, floor: L0 - 0.95 });
        };
        this.pondLevel = L0 - 0.22;

        const grove = (x, z) => 1 - smoothstep(4.5, 8.5, Math.hypot(x + 18.8, z + 8.6));
        const splatFn = (x, z, h, slope, out) => {
            const n = fbm2(x * 0.3 + 3, z * 0.3 + 7, 2);
            const d = Math.hypot(x, z);
            // terra batida: clareira do ninho e terreiro do celeiro
            const home = 1 - smoothstep(2.9, 3.9, Math.hypot(x - HOME.x, z - HOME.z) + (n - 0.5) * 0.9);
            const yard = 1 - smoothstep(4.3, 6.4, Math.hypot(x - BARN.x, z - BARN.z) + (n - 0.5) * 1.4);
            const rock = smoothstep(0.26, 0.42, slope);
            const wood = Math.max(grove(x, z) * 0.85, smoothstep(40, 50, d) * smoothstep(0.42, 0.7, fbm2(x * 0.04 + 9, z * 0.04 + 2, 3)) * 0.85);
            out[0] = Math.max(home, yard * 0.9) * (1 - rock);
            out[1] = rock;
            out[2] = wood * (1 - rock) * (1 - Math.max(home, yard));
            out[3] = 0;
            return out;
        };

        const terrain = createTerrain({ size: 190, heightFn, splatFn, tier });
        this.terrain = terrain;
        this.root.add(terrain.object);
        this.stage.follow(terrain);

        trails.forEach((course, i) => createPath({ terrain, course, ruts: false, noise: 0.5, edge: 0.6, strength: i === 0 ? 0.95 : 0.85 }));
        // poças de depois da chuva: só onde é terra (trilhas, clareira, terreiro)
        terrain.paint({ minX: -32, maxX: 32, minZ: -32, maxZ: 32 }, (x, z, h, slope, w) => {
            const puddle = smoothstep(0.6, 0.72, fbm2(x * 0.55 + 20, z * 0.55 + 31, 2));
            w[3] = Math.max(w[3], puddle * smoothstep(0.55, 0.9, w[0]) * 0.9);
            return w;
        });

        this.lake = createWater({
            terrain, lake: { x: POND.x, z: POND.z, radius: POND.radius, level: this.pondLevel },
            shallow: 0x6a9a86, deep: 0x1d4a52, absorb: 1.6, ripple: 0.12
        });
        this.stream = createWater({ terrain, river: creek, depth: 0.32, shallow: 0x7aa08a, deep: 0x2a4f4c, flow: 0.8 });
        this.root.add(this.lake.object, this.stream.object);
    }

    // ─────────────────────────────── vegetação ────────────────────────────────
    _vegetation() {
        const { terrain, tier, load } = this;
        const all = [this.creek, ...this.trails];

        // capim alto com muitas flores do campo
        this.grass = createGrass({
            terrain, tier, bladeHeight: 0.36, dryness: 0.3, cell: 14,
            density: { low: 20, medium: 60, high: 105 }[tier], range: { low: 24, medium: 44, high: 60 }[tier],
            flowers: { density: 2.6, patch: 15, height: 0.4 }
        });
        this.root.add(this.grass.object);

        const outer = scatter({
            terrain, count: load.trees, minDist: 5.4, seed: 4, slopeMax: 0.5, keepOff: [this.creek], margin: 3,
            maskFn: (x, z) => smoothstep(38, 46, Math.hypot(x, z)) * (0.35 + 0.65 * smoothstep(0.35, 0.6, fbm2(x * 0.03 + 2, z * 0.03 + 6, 3)))
        });
        const inner = INNER_TREES.map(([x, z, species, s], i) => ({ x, z, species, s, ry: i * 2.4 }));
        for (const t of inner) this.colliders.push({ x: t.x, z: t.z, r: (TRUNK[t.species] || 0.3) * t.s * 1.25 + 0.1 });
        this.forest = createForest({
            terrain, renderer: this.stage.renderer, tier, seed: 5, lodDistance: { low: 16, medium: 30, high: 44 }[tier],
            placements: [...outer, ...inner],
            species: [
                { kind: 'carvalho', weight: 3 }, { kind: 'betula', weight: 3.4 }, { kind: 'salgueiro', weight: 0, scale: [0.95, 1.1] }
            ]
        });
        this.root.add(this.forest.object);

        const add = (promise) => {
            this.pending.push(promise.then((g) => {
                if (g) this.root.add(g);
                return g;
            }).catch(() => null));
        };
        const play = (x, z) => 1 - smoothstep(34, 42, Math.hypot(x, z));
        const grove = (x, z) => 1 - smoothstep(5, 9, Math.hypot(x + 18.8, z + 8.6));
        const meadow = (x, z) => 1 - smoothstep(6, 11, Math.hypot(x - 18.8, z - 4.4));
        add(scatterModel({ terrain, preset: 'rochas', count: Math.round(load.rocks * 0.4), seed: 5, keepOff: all, layerMax: 0.5, maskFn: (x, z) => 0.3 + 0.7 * (1 - play(x, z)) }));
        add(scatterModel({ terrain, preset: 'pedras', count: load.rocks, seed: 6, keepOff: all, layerMax: 0.5, scale: [1.2, 2.8] }));
        // pedras na beira do riacho e do lago
        add(scatterModel({
            terrain, preset: 'pedras', count: Math.round(load.rocks * 0.8), seed: 16, dry: false, minDist: 1.4, scale: [1.5, 3.2],
            maskFn: (x, z) => {
                const dc = this.creek.dist(x, z, 3);
                const dl = Math.abs(Math.hypot(x - POND.x, z - POND.z) - POND.radius * 0.95);
                return Math.max(dc < 2.2 && dc > 0.8 ? 1 : 0, dl < 1.2 ? 0.8 : 0);
            }
        }));
        add(scatterModel({ terrain, preset: 'samambaias', count: load.ferns, seed: 7, keepOff: all, maskFn: (x, z) => Math.max(grove(x, z), (1 - play(x, z)) * 0.5) }));
        add(scatterModel({ terrain, preset: 'ervas', maxTriangles: 1500, count: load.weeds, seed: 12, keepOff: all, layerMax: 0.4, maskFn: (x, z) => play(x, z) * 0.7 }));
        add(scatterModel({ terrain, preset: 'flores', maxTriangles: 1500, count: load.flowers, seed: 13, keepOff: all, layerMax: 0.4, maskFn: (x, z) => Math.max(meadow(x, z), play(x, z) * 0.18) }));
        add(scatterModel({
            terrain, preset: 'tocos', seed: 10,
            placements: [[-17.0, -9.9, 0.9], [-22.4, -7.2, 0.7], [15.6, 19.2, 0.8], [-9.4, 10.6, 0.75], [20.4, -9.6, 1.0]].map(([x, z, s], i) => ({
                x, z, s, ry: i * 1.7, y: terrain.heightAt(x, z), nx: 0, ny: 1, nz: 0
            }))
        }));
        this.colliders.push({ x: -17.0, z: -9.9, r: 0.42 }, { x: 15.6, z: 19.2, r: 0.4 });
        add(scatterModel({ terrain, preset: 'arbustos', count: tier === 'low' ? 10 : 26, seed: 8, keepOff: all, maskFn: (x, z) => smoothstep(30, 40, Math.hypot(x, z)) }));
    }

    // ───────────────────────── celeiro, ninho, cercas ─────────────────────────
    _landmarks() {
        const { terrain } = this;
        const ground = (x, z) => terrain.heightAt(x, z);

        // celeiro
        const barn = createBarn();
        barn.position.set(BARN.x, ground(BARN.x, BARN.z) - 0.04, BARN.z);
        barn.rotation.y = BARN.ry;
        this.root.add(barn);
        const cs = Math.cos(BARN.ry);
        const sn = Math.sin(BARN.ry);
        /** local do celeiro (lx, lz) → mundo */
        const barnAt = (lx, lz) => [BARN.x + lx * cs + lz * sn, BARN.z - lx * sn + lz * cs];
        const prop = (name, opts, x, z, ry = 0, dy = 0) => {
            this.pending.push(loadModel(name, opts).then((g) => {
                if (!g) return;
                g.position.set(x, ground(x, z) + dy, z);
                g.rotation.y = ry;
                const cast = this.tier !== 'low';
                g.traverse((o) => {
                    if (o.isMesh) {
                        o.castShadow = cast;
                        o.receiveShadow = true;
                    }
                });
                this.root.add(g);
            }).catch(() => {}));
        };
        {
            const [bx, bz] = barnAt(2.1, 3.0);
            prop('wine_barrel_01', { height: 0.92 }, bx, bz, 0.6);
            const [cx, cz] = barnAt(2.9, 3.4);
            prop('wooden_crate_01', { height: 0.5 }, cx, cz, 0.3);
            const [kx, kz] = barnAt(-2.0, 3.1);
            prop('wooden_bucket_01', { height: 0.36 }, kx, kz, 1.1);
            if (this.tier !== 'low') prop('Lantern_01', { height: 0.42 }, cx, cz, 0.9, 0.5);
        }
        // curral ao lado do celeiro e cerca ao longo da trilha do pomar
        const fences = [
            [barnAt(3.2, -2.2), barnAt(6.2, -2.4), barnAt(7.6, 0.6), barnAt(7.0, 3.8), barnAt(4.6, 5.4)],
            [[5.3, 6.9], [6.6, 10.6], [10.2, 14.2], [13.4, 16.8]],
            [[-6.5, 9.2], [-9.5, 11.6], [-13.2, 16.0]]
        ];
        fences.forEach((points, i) => this.root.add(createFence({ terrain, points, type: 'cerca', seed: i + 2 })));

        // ninho do piquenique
        this.root.add(createBlanket(terrain, HOME.x, HOME.z));
        this.root.add(createNestRim(terrain, HOME.x, HOME.z));
        const glow = createHomeGlow();
        glow.mesh.position.set(HOME.x, ground(HOME.x, HOME.z) + 0.09, HOME.z);
        this.root.add(glow.mesh);
        this.homeGlow = glow;

        prop('wicker_basket_01', { height: 0.38 }, HOME.x + 0.1, HOME.z - 0.05, 0.5, 0.04);
        const apples = [[0.62, 0.2], [0.5, -0.42], [-0.45, 0.36], [-0.62, -0.2], [0.05, 0.66], [-0.2, -0.62], [0.9, -0.1]].map(([dx, dz], i) => ({
            x: HOME.x + dx, z: HOME.z + dz, y: ground(HOME.x + dx, HOME.z + dz) + 0.045, ry: i * 1.3, s: 0.9 + (i % 3) * 0.12, nx: 0, ny: 1, nz: 0
        }));
        this.pending.push(scatterModel({ terrain, model: 'food_apple_01', height: 0.13, sink: 0, maxTriangles: 500, placements: apples })
            .then((g) => g && this.root.add(g)).catch(() => {}));

        // mesinha e banquinhos de toco ao lado do ninho
        const TX = HOME.x + 3.6;
        const TZ = HOME.z - 4.4;
        prop('WoodenTable_01', { height: 0.52 }, TX, TZ, 0.5);
        if (this.tier !== 'low') prop('wooden_lantern_01', { height: 0.3 }, TX + 0.1, TZ, 0.4, 0.52);
        const stools = [[0.95, 0.3], [-0.85, 0.5], [0.1, -0.95]].map(([dx, dz], i) => ({
            x: TX + dx, z: TZ + dz, y: ground(TX + dx, TZ + dz), ry: i * 2.1, s: 1, nx: 0, ny: 1, nz: 0
        }));
        this.pending.push(scatterModel({ terrain, model: 'tree_stump_01', height: 0.34, sink: 0.1, maxTriangles: 1200, placements: stools })
            .then((g) => g && this.root.add(g)).catch(() => {}));
        this.colliders.push({ x: TX, z: TZ, r: 0.6 });
    }

    // ───────────────────────────── amoras ─────────────────────────────────────
    /**
     * 14 arbustos (shrub_03 fotogramétrico) com 7 amoras cada + 1 amora grande que
     * flutua e gira sobre o arbusto para a criança achar de longe:
     *   y = topo + 0,16·sin(2,4t + fase),  giro 1,6 rad/s
     * Colhida: as 8 somem (matriz de escala zero).
     */
    _berries() {
        const { terrain } = this;
        const rnd = seeded(33);
        const PER = this.tier === 'low' ? 4 : 7;
        const spots = BERRY_SPOTS.slice(0, TOTAL_BERRIES);
        this.berries = spots.map(([x, z], i) => ({
            x, z, y: terrain.heightAt(x, z), taken: false, phase: rnd() * 6,
            position: new THREE.Vector3(x, terrain.heightAt(x, z) + 0.5, z), index: i
        }));
        this.pending.push(scatterModel({
            terrain, model: 'shrub_03', height: [1.05, 1.25], sink: 0.03, range: 120, minDist: 1, maxTriangles: this.tier === 'low' ? 700 : 2500, shadow: this.tier !== 'low',
            placements: this.berries.map((b, i) => ({ x: b.x, z: b.z, y: b.y, s: 1, ry: i * 1.9, nx: 0, ny: 1, nz: 0 }))
        }).then((g) => g && this.root.add(g)).catch(() => {}));

        const mat = new THREE.MeshPhysicalMaterial({
            vertexColors: true, roughness: 0.2, metalness: 0, clearcoat: 0.7, clearcoatRoughness: 0.18,
            emissive: 0x4a1466, emissiveIntensity: 0.22
        });
        this.berrySmall = new THREE.InstancedMesh(berryGeometry(0), mat, spots.length * PER);
        this.berrySmall.castShadow = false;
        this.berrySmall.frustumCulled = false;
        this.berryBig = new THREE.InstancedMesh(berryGeometry(this.load.berryDetail), mat, spots.length);
        this.berryBig.frustumCulled = false;
        this.berryBig.castShadow = this.tier !== 'low';
        this.berryPER = PER;
        this.berryLocal = [];
        for (const b of this.berries) {
            for (let k = 0; k < PER; k++) {
                const a = (k / PER) * TAU + rnd() * 0.6;
                const r = 0.22 + rnd() * 0.2;
                const y = 0.42 + rnd() * 0.4;
                _e.set(rnd() * 0.8 - 0.4 + Math.PI, rnd() * 6, rnd() * 0.8 - 0.4);
                _m.compose(_p.set(b.x + Math.cos(a) * r, b.y + y, b.z + Math.sin(a) * r), _q.setFromEuler(_e), _s.setScalar(0.05 + rnd() * 0.02));
                this.berryLocal.push(_m.clone());
                this.berrySmall.setMatrixAt(b.index * PER + k, _m);
            }
        }
        this.root.add(this.berrySmall, this.berryBig);
    }

    _setBerry(b, visible) {
        for (let k = 0; k < this.berryPER; k++) {
            const i = b.index * this.berryPER + k;
            this.berrySmall.setMatrixAt(i, visible ? this.berryLocal[i] : ZERO);
        }
        this.berrySmall.instanceMatrix.needsUpdate = true;
    }

    takeBerry(b) {
        b.taken = true;
        this._setBerry(b, false);
    }

    // ───────────────────────────── cogumelos ──────────────────────────────────
    _mushrooms() {
        const { terrain } = this;
        const rnd = seeded(57);
        const spots = [];
        const tryAdd = (cx, cz, R, n, big) => {
            for (let t = 0; t < n * 12 && n > 0; t++) {
                const a = rnd() * TAU;
                const r = Math.sqrt(rnd()) * R;
                const x = cx + Math.cos(a) * r;
                const z = cz + Math.sin(a) * r;
                if (Math.hypot(x + 18.6, z + 8.4) < 1.3) continue;
                if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 0.55)) continue;
                spots.push({ x, z, s: big && rnd() > 0.72 ? 0.55 + rnd() * 0.3 : 0.16 + rnd() * 0.24 });
                n--;
            }
        };
        tryAdd(-18.8, -8.6, 6.2, this.tier === 'low' ? 14 : 26, true);
        tryAdd(-17.0, -9.9, 1.2, 5, false);
        tryAdd(-4.6, -1.0, 1.6, 4, false);
        tryAdd(15.6, 19.2, 1.4, 4, false);
        tryAdd(-10.4, -20.6, 1.8, 3, false);
        const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0 });
        const variants = [mushroomGeometry(1), mushroomGeometry(2)];
        const tint = new THREE.Color();
        variants.forEach((geo, v) => {
            const list = spots.filter((_, i) => i % 2 === v);
            const mesh = new THREE.InstancedMesh(geo, mat, list.length);
            list.forEach((sp, i) => {
                _e.set((rnd() - 0.5) * 0.25, rnd() * 6, (rnd() - 0.5) * 0.25);
                mesh.setMatrixAt(i, _m.compose(_p.set(sp.x, terrain.heightAt(sp.x, sp.z) - 0.01, sp.z), _q.setFromEuler(_e), _s.set(sp.s, sp.s * (0.85 + rnd() * 0.4), sp.s)));
                // alguns puxam para o laranja
                mesh.setColorAt(i, tint.setRGB(1, 0.86 + rnd() * 0.3, 0.8 + rnd() * 0.25));
            });
            mesh.castShadow = this.tier !== 'low';
            mesh.receiveShadow = true;
            mesh.computeBoundingSphere();
            this.root.add(mesh);
        });
    }

    _friends() {
        this.friends = FRIENDS.map((def) => {
            const f = createFriend(def, this.load.friendDetail);
            f.mesh.position.set(def.x, this.floorY(def.x, def.z, f.creature.height), def.z);
            this.root.add(f.mesh);
            return f;
        });
    }

    // ─────────────────── borboletas, pássaros, arco-íris, orvalho ─────────────
    _life() {
        const { load, terrain } = this;
        const rnd = seeded(77);

        this.butterflies = createButterflies(load.butterflies);
        this.bfly = [];
        const hubs = [[18.8, 4.4, 8], [0, 9, 9], [-8, -4, 8], [9, -12, 7], [-14, 14, 7], [10, 17, 7]];
        for (let i = 0; i < load.butterflies; i++) {
            const hub = hubs[i % hubs.length];
            this.bfly.push({
                cx: hub[0] + (rnd() - 0.5) * 4, cz: hub[1] + (rnd() - 0.5) * 4, r: 1.5 + rnd() * hub[2] * 0.6,
                a: rnd() * TAU, s: (0.25 + rnd() * 0.4) * (rnd() > 0.5 ? 1 : -1), y: 0.55 + rnd() * 1.1, k: 0.6 + rnd() * 0.6
            });
        }
        this.root.add(this.butterflies.mesh);

        this.birds = [];
        for (let i = 0; i < load.birds; i++) {
            const c = createCreature('bird', { detail: 1, scale: 2.4, seed: i + 3 });
            c.object.rotation.order = 'YXZ';
            c.object.traverse((o) => { if (o.isMesh) o.castShadow = true; });
            this.root.add(c.object);
            this.birds.push({
                c, cx: -6 + i * 9, cz: -4 + i * 6, r: 15 + i * 6, a: i * 2.1, w: (0.16 - i * 0.03) * (i % 2 ? -1 : 1), y: 7.5 + i * 2.2,
                anim: { mode: 'fly', lookAt: null, groundFn: null }
            });
        }

        this.rainbow = createRainbow(this.stage.sky.sunDir);
        this.scene.add(this.rainbow.mesh);

        this.dew = createDew(terrain, { count: load.dew, radius: WORLD_RADIUS - 1 });
        this.root.add(this.dew.points);
        this.pollen = createPollen(load.pollen);
        this.scene.add(this.pollen.points);
    }

    reset() {
        for (const b of this.berries) {
            b.taken = false;
            this._setBerry(b, true);
        }
        for (const f of this.friends) {
            f.state = 'lost';
            f.mesh.position.set(f.x, this.floorY(f.x, f.z, f.creature.height), f.z);
            f.mesh.visible = true;
            f.homeSlot = 0;
            f.seated = false;
            f.hop = 0;
            f.speed = 0;
        }
    }

    /**
     * @param {number} dt
     * @param {THREE.Camera} camera
     * @param {number} party      0..1
     * @param {number} followers  filhotes na fila (acende o anel do ninho)
     * @param {Array} tramplers   [{x, y, z, radius}] até 8 (Nina + filhotes)
     * @param {number} pxScale    px por metro a 1 m de distância (tamanho dos pontos)
     */
    update(dt, camera, party, followers, tramplers, pxScale) {
        this.clock += dt;
        const t = this.clock;
        const terrain = this.terrain;
        terrain.update(camera);
        this.grass.update(camera, dt, tramplers);
        this.forest.update(camera);
        this.lake.update(dt);
        this.stream.update(dt);

        // amoras grandes flutuando
        const big = this.berryBig;
        for (const b of this.berries) {
            if (b.taken) {
                big.setMatrixAt(b.index, ZERO);
                continue;
            }
            const y = b.y + 1.42 + Math.sin(t * 2.4 + b.phase) * 0.16;
            _e.set(0.25, t * 1.6 + b.phase, 0);
            big.setMatrixAt(b.index, _m.compose(_p.set(b.x, y, b.z), _q.setFromEuler(_e), _s.setScalar(0.11)));
        }
        big.instanceMatrix.needsUpdate = true;

        // borboletas: órbita em 8 achatado em volta das flores
        const sun = this.stage.sun;
        const li = sun.intensity / Math.PI;
        this.butterflies.uniforms.uTime.value = t;
        this.butterflies.uniforms.uLight.value.setRGB(sun.color.r * li * 0.8 + 0.35, sun.color.g * li * 0.8 + 0.35, sun.color.b * li * 0.8 + 0.38);
        const M = this.butterflies.matrices;
        for (let i = 0; i < this.bfly.length; i++) {
            const b = this.bfly[i];
            b.a += dt * b.s;
            const x = b.cx + Math.cos(b.a) * b.r;
            const z = b.cz + Math.sin(b.a * 0.85) * b.r * 0.7;
            const y = terrain.heightAt(x, z) + b.y + Math.sin(t * 2 * b.k + b.a * 3) * 0.28;
            // rumo = derivada da órbita
            const vx = -Math.sin(b.a) * b.s;
            const vz = Math.cos(b.a * 0.85) * 0.85 * 0.7 * b.s;
            _e.set(Math.sin(t * 3 + i) * 0.2, Math.atan2(vx, vz), 0);
            _m.compose(_p.set(x, y, z), _q.setFromEuler(_e), _s.setScalar(0.12)).toArray(M, i * 16);
        }
        this.butterflies.attribute.needsUpdate = true;

        // pássaros em círculos largos, inclinando para dentro da curva
        for (const b of this.birds) {
            b.a += dt * b.w;
            const x = b.cx + Math.cos(b.a) * b.r;
            const z = b.cz + Math.sin(b.a) * b.r;
            b.c.object.position.set(x, b.y + Math.sin(t * 0.5 + b.r) * 1.2, z);
            const dir = Math.sign(b.w);
            b.c.object.rotation.set(0, Math.atan2(-Math.sin(b.a) * dir, Math.cos(b.a) * dir), -0.3 * dir);
            b.anim.mode = Math.sin(t * 0.35 + b.r) > 0.55 ? 'glide' : 'fly';
            b.c.update(dt, b.anim);
        }

        this.dew.uniforms.uTime.value = t;
        this.dew.uniforms.uScale.value = pxScale;
        this.pollen.uniforms.uTime.value = t;
        this.pollen.uniforms.uScale.value = pxScale;

        const glow = followers > 0 ? 0.6 + Math.sin(t * 4) * 0.2 : 0;
        const u = this.homeGlow.uniforms;
        u.uOpacity.value += (Math.max(glow, party * 0.8) - u.uOpacity.value) * Math.min(1, dt * 6);
        u.uTime.value = t;
        this.homeGlow.mesh.visible = u.uOpacity.value > 0.01;
    }
}
