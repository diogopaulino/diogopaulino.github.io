/**
 * Mundo do conto em three.js sobre o kit compartilhado (gfx/stage + gfx/terrain).
 *
 * São dois cenários montados UMA vez, atrás da tela de carregamento:
 *   SOLO   — vale de 300 m: cabana, quintal, estrada de terra, riacho, bosque e a
 *            feira (80 m adiante). Serve aos capítulos I, II, III e V; só mudam a
 *            hora, as luzes e quais atores aparecem.
 *   NUVENS — mar de nuvens, ilha caminhável e o salão do gigante (capítulo IV).
 *
 * `enter(id)` devolve o estado lógico do capítulo (o mesmo contrato do jogo
 * original): colliders, interactables, platforms, climbs, heightAt, bounds,
 * spawn, flags, cow, giant, chop… A lógica de fases em main.js não sabe de malhas.
 *
 * Pé de feijão como fase vertical:
 *   platforms  folhas com a superfície curva da malha (leaves.js) — pouso justo
 *   climbs[0]  o caule: eixo serpenteante axis(y), raio de agarre hold(y), yMin…yMax
 *   stalkCam   cilindro que a câmera não atravessa (raio da casca + folga)
 *   pods       4 vagens douradas em folhas a ~15, 29, 43 e 57 m (opcionais, +glória)
 *
 * Relevo do solo (metros; o quintal fica em y ≈ 0):
 *   h = (fbm(p·0,012) − ½)·15 + 9·smoothstep(70, 160, |p − c|) + (fbm(p·0,06) − ½)·1,4
 *   quintal e praça da feira achatam h para a cota local (smoothstep no raio)
 *   o riacho cava um vale raso; a estrada rebaixa 0,18 m o próprio leito
 */

import * as THREE from 'three';
import { fbm2, smoothstep, lerp } from '../../shared/gfx/core.js';
import {
    createCourse, createTerrain, createGrass, createForest, createWater, createPath, createFence,
    createBeanstalk, scatter, scatterModel
} from '../../shared/gfx/terrain.js';
import { instanceModel, preload } from '../../shared/gfx/assets.js';
import { createParticles } from '../../shared/gfx/particles.js';
import { createHero } from '../../shared/gfx/hero.js';
import { createCreature } from '../../shared/gfx/creature.js';
import { STALK, GIANT_SCALE } from './config.js?v=12';
import {
    buildCottage, buildWell, buildGateArch, buildLampPost, buildStall, buildCart, buildFountain,
    buildWoodpile, buildGardenBeds, buildGoldBag, buildNest, buildHarp, buildCastleHall, buildStool,
    prop, HALL, MAT
} from './models.js?v=12';
import { createCloudRealm, createCloudCollar } from './clouds.js?v=12';
import { CowAI, GiantAI, Rope } from './npcs.js?v=12';
import { makeLeaf } from './leaves.js?v=12';

const HOME = { x: -2, z: 2 };
const CABIN = { x: -8, z: -3, ry: 0.5 };
const GATE = { x: 16, z: 9 };
const FAIR = { x: 80, z: 30 };
const AXE = { x: -1.6, z: 5.2 };
const WELL = { x: 2.4, z: -6.5 };
/** Direção em que o pé cai (para o campo aberto, longe da cabana). */
const FALL_DIR = { x: 0.83, z: 0.56 };

/** Discos da ilha de nuvem: base do castelo, adro, caminho e a clareira de chegada. */
const ISLAND = [
    { x: 0, z: -1, r: 40 }, { x: 0, z: 30, r: 13 }, { x: -2, z: 40, r: 10 }, { x: 1, z: 50, r: 13 }
];
const CLOUD_SPAWN = { x: 1, z: 50 };

const box = (x, z, hx, hz, ry = 0, extra = {}) => ({ box: true, x, z, hx, hz, cos: Math.cos(ry), sin: Math.sin(ry), ...extra });
const local = (o, lx, lz) => ({
    x: o.x + lx * Math.cos(o.ry) + lz * Math.sin(o.ry),
    z: o.z - lx * Math.sin(o.ry) + lz * Math.cos(o.ry)
});

/** Modelos e texturas baixados atrás da tela de carregamento. */
const PRELOAD = {
    models: ['wooden_bucket_01', 'wooden_crate_01', 'wicker_basket_01', 'wine_barrel_01', 'food_apple_01',
        'wooden_lantern_01', 'tree_stump_01', 'wooden_axe', 'large_castle_door', 'WoodenTable_01', 'WoodenChair_01',
        'Chandelier_01', 'treasure_chest', 'brass_goblets'],
    textures: ['rough_plaster_03', 'dark_wooden_planks', 'thatch_roof_angled', 'mossy_cobblestone', 'medieval_blocks_02']
};

export async function createWorld(stage, quality, progress = () => {}) {
    const scene = stage.scene;
    const tier = stage.tier;
    const low = tier === 'low';
    const ground = new THREE.Group();
    ground.name = 'solo';
    const sky = new THREE.Group();
    sky.name = 'nuvens';
    sky.visible = false;
    scene.add(ground, sky);

    progress(0.12, 'Baixando madeira, pedra e palha…');
    await preload(PRELOAD);

    /* ================================================================== */
    /* SOLO                                                                */
    /* ================================================================== */
    progress(0.3, 'Levantando as colinas…');
    const road = createCourse([[-4.6, 0.8], [1, 2.6], [8, 5.6], [16, 9], [30, 17], [46, 31], [60, 43], [70, 40], [77, 33]], { width: 2.6 });
    const river = createCourse([[-140, -62], [-90, -50], [-52, -38], [-22, -30], [8, -27], [40, -24], [78, -30], [120, -40], [170, -36]], { width: 3.4 });
    const raw = (x, z) => (fbm2(x * 0.012 + 10, z * 0.012 + 20, 4) - 0.5) * 15
        + smoothstep(70, 160, Math.hypot(x - 35, z - 10)) * 9 + (fbm2(x * 0.06, z * 0.06, 3) - 0.5) * 1.4;
    const H0 = raw(HOME.x, HOME.z);
    const fairH = raw(FAIR.x, FAIR.z) - H0;
    const heightFn = (x, z) => {
        let h = raw(x, z) - H0;
        h = lerp(h, (fbm2(x * 0.09, z * 0.09, 2) - 0.5) * 0.35, 1 - smoothstep(11, 30, Math.hypot(x - HOME.x, z - HOME.z)));
        h = lerp(h, fairH, 1 - smoothstep(14, 32, Math.hypot(x - FAIR.x, z - FAIR.z)));
        const s = river.sample(x, z);
        const bed = lerp(-0.6, -3.4, s.t);
        h = lerp(h, bed + Math.min(s.d * 0.11, 2.2), 1 - smoothstep(4, 22, s.d));
        h = river.carve(x, z, h, { depth: 1.0, width: 3.0, bank: 3.2 });
        return road.carve(x, z, h, { depth: 0.18, width: 2.3, bank: 2 });
    };
    const terrain = createTerrain({
        size: 320, center: [30, 8], heightFn, tier,
        layers: [
            { set: 'leafy_grass', scale: 3.4, tint: 0xa9c284 },
            { set: 'dirt_floor', scale: 3.0, tint: 0xb0a690 },
            { set: 'cobblestone_floor_08', scale: 3.2 },
            { set: 'brown_mud_leaves_01', scale: 3.2 }
        ],
        splatFn: (x, z, h, slope, out) => {
            const patch = smoothstep(0.68, 0.86, fbm2(x * 0.021 + 5, z * 0.021 + 2, 2));
            out[0] = smoothstep(0.3, 0.5, slope) * 0.8;
            out[1] = 0;
            out[2] = patch * 0.6;
            out[3] = 0;
            return out;
        }
    });
    ground.add(terrain.object);
    const hAt = terrain.heightAt;
    createPath({ terrain, course: road, ruts: true });
    // chão batido: soleira da cabana, poço, canteiro dos feijões, horta; calçamento da praça
    const door = local(CABIN, 0.95, 3.6);
    const garden = local(CABIN, -8.6, 2.6);
    const dab = (cx, cz, r, layer, k = 1) => terrain.paint({ minX: cx - r - 1, maxX: cx + r + 1, minZ: cz - r - 1, maxZ: cz + r + 1 }, (x, z, h, s, w) => {
        const v = (1 - smoothstep(r * 0.55, r, Math.hypot(x - cx, z - cz) + (fbm2(x * 0.5, z * 0.5, 2) - 0.5) * 1.2)) * k;
        for (let i = 0; i < 3; i++) w[i] *= 1 - v;
        w[layer - 1] += v;
        return w;
    });
    dab(door.x, door.z, 3.4, 1);
    dab(WELL.x, WELL.z, 2.6, 1, 0.9);
    dab(STALK.x, STALK.z, 2.6, 3);
    dab(garden.x, garden.z, 3.6, 3);
    dab(AXE.x, AXE.z, 2.2, 1, 0.8);
    dab(FAIR.x, FAIR.z, 13.5, 2);
    dab(FAIR.x, FAIR.z + 12, 5, 1, 0.8);
    const stream = createWater({ terrain, river, depth: 0.5, shallow: 0x5a7257, deep: 0x1c3c38 });
    ground.add(stream.object);

    progress(0.42, 'Semeando grama e flores…');
    // 95 lâminas/m² no tier alto (o padrão do kit, 150, estoura o orçamento de triângulos com a feira à vista)
    const grass = createGrass({ terrain, tier, density: tier === 'high' ? 95 : undefined });
    ground.add(grass.object);

    progress(0.5, 'Plantando o bosque…');
    const clump = (x, z) => smoothstep(0.38, 0.6, fbm2(x * 0.016 + 3, z * 0.016 + 8, 3));
    const open = (x, z) => smoothstep(22, 34, Math.hypot(x - HOME.x, z - HOME.z)) * smoothstep(24, 34, Math.hypot(x - FAIR.x, z - FAIR.z));
    const trees = scatter({
        terrain, count: Math.round(330 * quality.trees), minDist: 6, seed: 4, slopeMax: 0.34, keepOff: [road, river], margin: 4.5,
        maskFn: (x, z) => (0.2 + 0.8 * clump(x, z)) * open(x, z)
    });
    const forest = createForest({
        terrain, renderer: stage.renderer, tier, seed: 3, placements: trees, lodDistance: low ? 22 : 38,
        species: [{ kind: 'carvalho', weight: 3 }, { kind: 'betula', weight: 2 }, { kind: 'pinheiro', weight: 1.4 }]
    });
    ground.add(forest.object);
    const colliders = [];
    for (const p of trees) {
        if (Math.hypot(p.x - HOME.x, p.z - HOME.z) < 60 || Math.hypot(p.x - FAIR.x, p.z - FAIR.z) < 50) colliders.push({ x: p.x, z: p.z, r: 0.45 });
    }
    const k = quality.scatter;
    const addG = (g) => g && ground.add(g);
    const near = { x: 30, z: 14, radius: 95 };
    const scatters = Promise.all([
        scatterModel({ terrain, preset: 'pedras', maxTriangles: 2500, count: Math.round(36 * k), seed: 6, area: near, keepOff: [road], maskFn: open }),
        scatterModel({ terrain, preset: 'samambaias', maxTriangles: 1200, count: Math.round(120 * k), seed: 7, area: near, keepOff: [road], maskFn: (x, z) => clump(x, z) * open(x, z) }),
        scatterModel({ terrain, preset: 'arbustos', maxTriangles: 2500, count: Math.round(50 * k), seed: 8, area: near, keepOff: [road, river], margin: 3, maskFn: (x, z) => (0.15 + clump(x, z)) * open(x, z) }),
        scatterModel({ terrain, preset: 'flores', maxTriangles: 900, count: Math.round(70 * k), seed: 9, area: { x: HOME.x, z: HOME.z, radius: 30 }, keepOff: [road], layerMax: 0.3 }),
        scatterModel({ terrain, preset: 'ervas', maxTriangles: 900, count: Math.round(22 * k) + 8, seed: 12, area: { x: garden.x, z: garden.z, radius: 2.6 }, minDist: 0.55, scale: [0.9, 1.5] })
    ]).then((gs) => gs.forEach(addG)).catch(() => {});

    progress(0.6, 'Erguendo a cabana…');
    const place = (obj, x, z, ry = 0, dy = 0) => {
        obj.position.set(x, hAt(x, z) + dy, z);
        obj.rotation.y = ry;
        ground.add(obj);
        return obj;
    };
    const cottage = place(buildCottage(), CABIN.x, CABIN.z, CABIN.ry, 0.05);
    colliders.push(box(CABIN.x, CABIN.z, cottage.userData.half[0], cottage.userData.half[1], CABIN.ry));
    const chim = local(CABIN, cottage.userData.chimneyTop.x, cottage.userData.chimneyTop.z);
    colliders.push({ x: local(CABIN, -3.8, -0.3).x, z: local(CABIN, -3.8, -0.3).z, r: 0.9 });
    const smoke = createParticles({
        count: low ? 18 : 40, life: 7, origin: new THREE.Vector3(chim.x, cottage.position.y + cottage.userData.chimneyTop.y, chim.z),
        spread: new THREE.Vector3(0.12, 0.05, 0.12), velocity: new THREE.Vector3(0.45, 1.25, 0.2),
        velocitySpread: new THREE.Vector3(0.12, 0.2, 0.12), turbulence: 0.5, size: [0.35, 2.4], color: 0xb8b4ae, opacity: 0.34
    });
    ground.add(smoke.mesh);

    const well = place(buildWell(), WELL.x, WELL.z, 0.7);
    colliders.push({ x: WELL.x, z: WELL.z, r: 1.15 });
    prop('wooden_bucket_01', { height: 0.36 }).then((b) => {
        if (!b) return;
        b.position.set(0.12, 0.92, 0.72);
        well.add(b);
    });
    place(buildGardenBeds(4, 4.2), garden.x, garden.z, CABIN.ry, 0.05);
    place(buildWoodpile(), AXE.x - 1.5, AXE.z + 0.5, 0.9);
    colliders.push({ x: AXE.x - 1.5, z: AXE.z + 0.5, r: 0.75 }, { x: AXE.x, z: AXE.z, r: 0.5 });
    let axeProp = null;
    prop('tree_stump_01', { height: 0.5 }).then((s) => s && place(s, AXE.x, AXE.z, 0.4, -0.06));
    prop('wooden_axe', { height: 0.8, ground: false }).then((a) => {
        if (!a) return;
        axeProp = a;
        a.position.set(AXE.x, hAt(AXE.x, AXE.z) + 0.72, AXE.z);
        a.rotation.set(0.5, 0.6, 2.6);
        ground.add(a);
    });
    ground.add(createFence({ terrain, points: [[-5, 13.5], [2, 15.2], [9, 14.2], [15, 13]], type: 'cerca', seed: 2 }));
    ground.add(createFence({ terrain, points: [[4.5, -0.6], [9, 1], [14, 4.2]], type: 'cerca', seed: 5 }));
    // cerquinha da horta: quatro lances retos (o traçado é spline; canto vivo pede um lance por lado)
    const gc = [[-3.1, -2.7], [-3.1, 2.7], [3.1, 2.7], [3.1, -2.7]].map(([lx, lz]) => { const p = local({ ...garden, ry: CABIN.ry }, lx, lz); return [p.x, p.z]; });
    for (let i = 0; i < 3; i++) ground.add(createFence({ terrain, points: [gc[i], gc[i + 1]], type: 'cerca', height: 0.8, spacing: 1.55, seed: 8 + i }));

    place(buildGateArch(), GATE.x, GATE.z, Math.atan2(14, 8));
    const gateDir = { x: 0.5, z: -0.87 };
    colliders.push({ x: GATE.x + gateDir.x * 2.4, z: GATE.z + gateDir.z * 2.4, r: 0.4 }, { x: GATE.x - gateDir.x * 2.4, z: GATE.z - gateDir.z * 2.4, r: 0.4 });

    // lampiões da estrada: poste + lanterna glTF + luz pontual (só acende à noite/entardecer)
    const lamps = [];
    const lampSpots = [[0.4, 0.6], [9.5, 3.6], [18.5, 7.6], [-3.6, 6.4], [28, 13.4], [70, 44.5]].slice(0, quality.lights);
    lampSpots.forEach(([x, z], i) => {
        const post = place(buildLampPost(i + 1), x, z, i * 1.3);
        colliders.push({ x, z, r: 0.2 });
        const light = new THREE.PointLight(0xffb060, 0, 14, 1.6);
        light.position.copy(post.userData.hook).add(new THREE.Vector3(0, -0.22, 0));
        post.add(light);
        lamps.push(light);
        prop('wooden_lantern_01', { height: 0.38 }).then((l) => {
            if (!l) return;
            l.position.copy(post.userData.hook).add(new THREE.Vector3(0, -0.4, 0));
            l.traverse((c) => { if (c.isMesh) c.castShadow = false; });
            post.add(l);
        });
    });

    // --- feira
    progress(0.7, 'Armando as barracas da feira…');
    place(buildFountain(), FAIR.x, FAIR.z);
    colliders.push({ x: FAIR.x, z: FAIR.z, r: 1.95 });
    const stallDefs = [
        { x: -6.5, z: -4, ry: 1.2, c: 0xc43a2a }, { x: 6.5, z: -5, ry: -0.5, c: 0x2a6aaa }, { x: -8, z: 5, ry: 2.1, c: 0xd4a020 },
        { x: 8, z: 4.5, ry: -1.9, c: 0x2e7a3a }, { x: 0, z: -9, ry: 0, c: 0xb85a2a }
    ];
    const goods = {};
    const pushGood = (g, gx, gz, gy, gry) => {
        (goods[g.model] ||= []).push({
            x: gx + g.x * Math.cos(gry) + g.z * Math.sin(gry), y: gy + g.y, z: gz - g.x * Math.sin(gry) + g.z * Math.cos(gry), ry: gry + g.ry, s: g.s
        });
    };
    stallDefs.forEach((s, i) => {
        const x = FAIR.x + s.x;
        const z = FAIR.z + s.z;
        const st = place(buildStall(s.c, i + 1), x, z, s.ry);
        colliders.push(box(x, z, 1.7, 1.0, s.ry));
        st.userData.props.forEach((g) => pushGood(g, x, z, st.position.y, s.ry));
    });
    const MX = FAIR.x;
    const MZ = FAIR.z + 12;
    const cart = place(buildCart(0x6a2f9a), MX - 2.6, MZ + 2.6, 2.4);
    colliders.push(box(MX - 2.6, MZ + 2.6, 1.2, 2.0, 2.4));
    [{ model: 'wine_barrel_01', x: 0.25, y: 0.86, z: -0.6, ry: 0.3, s: 0.8 }, { model: 'wooden_crate_01', x: -0.1, y: 0.86, z: 0.55, ry: 1.2, s: 0.9 },
        { model: 'wicker_basket_01', x: 1.9, y: 0, z: 0.4, ry: 0.5, s: 1.8 }].forEach((g) => pushGood(g, MX - 2.6, MZ + 2.6, cart.position.y, 2.4));
    const HEIGHTS = { wooden_crate_01: 0.42, wicker_basket_01: 0.16, wine_barrel_01: 0.9, food_apple_01: 0.085 };
    // miudezas não projetam sombra (a maçã fotogramétrica tem 7 mil triângulos: a sombra dobraria o custo)
    // Tier baixo (celular): cada barraca fica com 1 maçã em vez de 4 e só o barril faz sombra —
    // as mercadorias instanciadas somavam ~540 mil dos ~650 mil triângulos da feira.
    if (low && goods.food_apple_01) goods.food_apple_01 = goods.food_apple_01.filter((_, i) => i % 4 === 0);
    for (const [model, list] of Object.entries(goods)) instanceModel(model, list, { height: HEIGHTS[model], castShadow: model === 'wine_barrel_01' || (!low && model === 'wooden_crate_01') }).then(addG);

    // --- pé de feijão (cresce na noite; inteiro na fuga)
    progress(0.76, 'Guardando cinco feijões…');
    const stalkBase = hAt(STALK.x, STALK.z) - 0.5;
    const bean = createBeanstalk({ height: STALK.height, radius: STALK.radius, leafSpacing: 3.1, leafSize: 5.4, seed: 3, detail: low ? 0 : 2 });
    // a casca do kit some no escuro: um verde emissivo fraco mantém o caule legível à noite
    const stemMat = bean.object.children[0].material;
    stemMat.emissive = new THREE.Color(0x2c5a18);
    stemMat.emissiveIntensity = 0;
    const stalkPivot = new THREE.Group();
    stalkPivot.position.set(STALK.x, stalkBase, STALK.z);
    stalkPivot.add(bean.object);
    stalkPivot.visible = false;
    ground.add(stalkPivot);
    const taper = (t) => lerp(1, 0.28, Math.pow(t, 1.2));
    const _ax = new THREE.Vector3();
    const stalkAxis = (y, out) => {
        bean.axisAt(clamp01((y - stalkBase) / STALK.height), _ax);
        out.x = _ax.x + STALK.x;
        out.z = _ax.z + STALK.z;
        return out;
    };
    const stalkHold = (y) => STALK.radius * taper(clamp01((y - stalkBase) / STALK.height)) * 1.02 + 0.3;
    // folhas-plataforma com a superfície da lâmina (leaves.js); ordenadas de baixo para cima
    const _axL = new THREE.Vector3();
    const leaves = bean.leaves.map((l) => makeLeaf(l, {
        ox: STALK.x, oy: stalkBase, oz: STALK.z, height: STALK.height, tmp: _axL,
        axisLocal: (t, out) => bean.axisAt(clamp01(t), out)
    })).sort((a, b) => a.y - b.y);
    /** Raio externo da casca (m) na altura y: feixe de 3 fios ≈ 1,05·raio·afinamento. */
    const stalkSkin = (y) => STALK.radius * 1.05 * taper(clamp01((y - stalkBase) / STALK.height));
    const stalkCam = { axis: (y, out) => stalkAxis(y, out), radiusAt: stalkSkin, yMin: stalkBase - 1, yMax: stalkBase + STALK.height };

    /*
     * Vagens douradas: 4 recompensas opcionais em folhas perto de 15, 29, 43 e 57 m.
     * Para pegar, o João salta do caule para a folha (o arco é calculado: chega sempre).
     */
    const podGeo = new THREE.CapsuleGeometry(0.1, 0.46, 4, 10);
    podGeo.rotateZ(Math.PI / 2);
    const podMat = new THREE.MeshStandardMaterial({ color: 0xe8b43a, roughness: 0.32, metalness: 0.55, emissive: 0xffa21a, emissiveIntensity: 1.4 });
    const haloTex = (() => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        grd.addColorStop(0, 'rgba(255,220,140,0.95)');
        grd.addColorStop(0.35, 'rgba(255,190,80,0.35)');
        grd.addColorStop(1, 'rgba(255,170,40,0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 64, 64);
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    })();
    const haloMat = new THREE.SpriteMaterial({ map: haloTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const podLeaves = [];
    for (const h of [15, 29, 43, 57]) {
        let best = null;
        for (const l of leaves) {
            if (podLeaves.includes(l)) continue;
            if (!best || Math.abs(l.y - stalkBase - h) < Math.abs(best.y - stalkBase - h)) best = l;
        }
        if (best) podLeaves.push(best);
    }
    const pods = podLeaves.map((l, i) => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(podGeo, podMat);
        m.castShadow = true;
        const halo = new THREE.Sprite(haloMat);
        halo.scale.setScalar(1.6);
        g.add(m, halo);
        g.position.set(l.x, l.y + 0.32, l.z);
        g.rotation.y = l.ang;
        g.visible = false;
        ground.add(g);
        return { x: l.x, y: l.y + 0.32, z: l.z, leaf: l, mesh: g, taken: false, i };
    });
    const collar = createCloudCollar({ x: STALK.x, y: STALK.top + 1, z: STALK.z, count: low ? 12 : 26 });
    collar.object.visible = false;
    ground.add(collar.object);

    const beans = new THREE.Group();
    const beanGeo = new THREE.SphereGeometry(0.09, 12, 8);
    beanGeo.scale(1.5, 0.8, 0.9);
    const beanMat = new THREE.MeshStandardMaterial({ color: 0x5a2a9a, roughness: 0.35, emissive: 0x9a48ff, emissiveIntensity: 2.2 });
    for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(beanGeo, beanMat);
        const a = (i / 5) * Math.PI * 2;
        b.position.set(STALK.x + Math.cos(a) * 0.4, stalkBase + 0.6, STALK.z + Math.sin(a) * 0.4);
        b.rotation.set(0.2, a, 0.4);
        beans.add(b);
    }
    const beanLight = new THREE.PointLight(0xa060ff, 0, 9, 1.8);
    beanLight.position.set(STALK.x, stalkBase + 1.2, STALK.z);
    beans.add(beanLight);
    beans.visible = false;
    ground.add(beans);
    const P3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const magic = createParticles({
        count: low ? 40 : 110, life: 2.6, origin: P3(STALK.x, stalkBase + 0.6, STALK.z), spread: P3(1.6, 0.4, 1.6), velocity: P3(0, 5.5, 0),
        velocitySpread: P3(1.4, 2.5, 1.4), turbulence: 1.6, size: [0.1, 0.42], color: 0xb48cff, opacity: 0.9, additive: true
    });
    magic.mesh.visible = false;
    const fireflies = createParticles({
        count: low ? 30 : 80, life: 9, origin: P3(HOME.x, 1.5, HOME.z + 4), spread: P3(22, 1.2, 20), velocity: P3(0, 0, 0),
        velocitySpread: P3(0.25, 0.12, 0.25), turbulence: 1.5, size: [0.1, 0.1], color: 0xd8ff7a, opacity: 1, additive: true
    });
    fireflies.mesh.visible = false;
    const wisps = createParticles({
        count: low ? 10 : 22, life: 10, origin: P3(STALK.x - 30, 30, STALK.z), spread: P3(10, 9, 28), velocity: P3(6, 0, 1.5),
        velocitySpread: P3(1.5, 0.3, 1), turbulence: 2, size: [7, 13], color: 0xffffff, opacity: 0.16
    });
    wisps.mesh.visible = false;
    const dust = createParticles({
        count: low ? 30 : 70, life: 3.2, origin: P3(STALK.x + FALL_DIR.x * 30, 0.5, STALK.z + FALL_DIR.z * 30), spread: P3(26 * FALL_DIR.x + 4, 0.4, 26 * FALL_DIR.z + 4),
        velocity: P3(0, 2.4, 0), velocitySpread: P3(2.5, 1.4, 2.5), turbulence: 1.2, size: [1.2, 6], color: 0xcbb89a, opacity: 0.5
    });
    dust.mesh.visible = false;
    ground.add(magic.mesh, fireflies.mesh, wisps.mesh, dust.mesh);

    /* ---------------- personagens ---------------- */
    progress(0.82, 'Acordando a Mimosa…');
    const nd = quality.npcDetail;
    const mother = createHero({ preset: 'peasantWoman', detail: Math.max(1, nd) });
    const motherSt = { mode: 'idle', speed: 0 };
    ground.add(mother.object);
    const merchant = createHero({
        preset: 'elder', detail: Math.max(1, nd), top: 'robe', sleeves: 'wide', topColor: 0x4a2a6a, trimColor: 0xc9a23a,
        cape: 'long', capeColor: 0x5a2a8a, hood: 'up', beard: 'long', hat: 'none', belt: 0xc9a23a
    });
    const merchantSt = { mode: 'idle', speed: 0 };
    place(merchant.object, MX, MZ, Math.PI);
    colliders.push({ x: MX, z: MZ, r: 0.6 });
    const villagers = [];
    const vDefs = [
        { preset: 'peasant', x: -6.2, z: -1.6, ry: 1.2 + Math.PI, mode: 'talk' }, { preset: 'peasantWoman', x: 5.4, z: -3.2, ry: -0.5 + Math.PI, mode: 'idle', topColor: 0x8a4a3a },
        { preset: 'elder', x: -1.2, z: -7.1, ry: Math.PI, mode: 'wave' }, { preset: 'peasant', x: 6.4, z: 2.6, ry: -1.9 + Math.PI, mode: 'talk', topColor: 0x8a6a40, hat: 'none' },
        { preset: 'peasantWoman', x: -6.2, z: 3.2, ry: 2.1 + Math.PI, mode: 'idle', topColor: 0x6a7a4a }
    ].slice(0, quality.villagers);
    vDefs.forEach(({ x, z, ry, mode, ...o }) => {
        const h = createHero({ detail: nd, ...o });
        place(h.object, FAIR.x + x, FAIR.z + z, ry);
        colliders.push({ x: FAIR.x + x, z: FAIR.z + z, r: 0.5 });
        villagers.push({ h, st: { mode, speed: 0 } });
    });
    const cowCreature = createCreature('cow', { detail: low ? 1 : 2, seed: 2 });
    ground.add(cowCreature.object);
    const cow = new CowAI(cowCreature, 7, 2.4);
    const rope = new Rope(3.4);
    ground.add(rope.mesh);
    cowCreature.object.traverse((c) => { if (c.isMesh) c.castShadow = true; });

    const giantHero = createHero({
        preset: 'giant', detail: quality.heroDetail, top: 'shirt', sleeves: 'short', topColor: 0x8a7a5a, bottom: 'breeches', bottomColor: 0x5a4028,
        beard: 'full', hairStyle: 'wild', hair: 0x3a2a1c, vest: 0x5a3a26
    });
    giantHero.object.scale.setScalar(GIANT_SCALE);
    giantHero.object.visible = false;
    scene.add(giantHero.object);
    const giant = new GiantAI(giantHero, GIANT_SCALE, 0, 0, 0);

    /* ================================================================== */
    /* NUVENS                                                              */
    /* ================================================================== */
    progress(0.88, 'Subindo às nuvens…');
    const realm = createCloudRealm({
        circles: ISLAND, count: quality.clouds,
        flat: { x0: HALL.x0 - HALL.t - 1, x1: HALL.x1 + HALL.t + 1, z0: HALL.z0 - HALL.t - 1, z1: HALL.z1 + HALL.t + 4, y: 0.05, margin: 9 }
    });
    sky.add(realm.object);
    const hall = buildCastleHall();
    sky.add(hall);
    const F = HALL.floor;
    const inHall = (x, z) => x > HALL.x0 - 0.2 && x < HALL.x1 + 0.2 && z > HALL.z0 - 0.2 && z < HALL.z1 + HALL.t + 3.4;
    const cloudHeight = (x, z) => {
        if (inHall(x, z) && (z < HALL.z1 + HALL.t || Math.abs(x) < HALL.door.w / 2 + 1.5)) return F;
        return realm.mask(x, z) > 0.03 ? realm.heightAt(x, z) : -40;
    };
    const T = HALL.t;
    const dw = HALL.door.w / 2;
    const skyCol = [
        box((HALL.x0 - T - dw) / 2, HALL.z1 + T / 2, (HALL.x1 + T - dw) / 2, T / 2), box((HALL.x1 + T + dw) / 2, HALL.z1 + T / 2, (HALL.x1 + T - dw) / 2, T / 2),
        box(0, HALL.z0 - T / 2, HALL.x1 + T, T / 2), box(HALL.x0 - T / 2, -1, T / 2, 23), box(HALL.x1 + T / 2, -1, T / 2, 23),
        box(HALL.x0 + 1.4, -6, 1.6, 5.6),
        { x: HALL.x0 - 1.1, z: HALL.z1 + 1.1, r: 3.5 }, { x: HALL.x1 + 1.1, z: HALL.z1 + 1.1, r: 3.5 }
    ];
    // mesa, cadeira, porta, lustre, baú, cálices: glTF em escala de gigante
    const TABLE = { x: 0, z: 0.5, h: 4.3 };
    const SEAT = { x: 0, z: -5.4 };
    const giantObstacles = [{ x: TABLE.x, z: TABLE.z, r: 8.2 }];
    const hearth = hall.userData.hearth;
    const fireLight = new THREE.PointLight(0xff7a2a, 0, 46, 1.5);
    fireLight.position.set(hearth.x + 1.6, hearth.y + 1.4, hearth.z);
    const chandLight = new THREE.PointLight(0xffdcae, 0, 44, 1.4);
    chandLight.position.copy(hall.userData.chandelier).y -= 1.2;
    sky.add(fireLight, chandLight);
    const fire = createParticles({
        count: low ? 24 : 60, life: 1.5, origin: P3(hearth.x, hearth.y, hearth.z), spread: P3(0.5, 0.2, 1.6), velocity: P3(0, 3.4, 0),
        velocitySpread: P3(0.3, 1, 0.5), turbulence: 0.6, size: [1.6, 0.4], color: 0xff8a2a, opacity: 0.85, additive: true
    });
    sky.add(fire.mesh);
    const zzz = createParticles({
        count: 8, life: 4, origin: P3(SEAT.x, 9.5, SEAT.z + 1.5), spread: P3(0.3, 0.2, 0.3), velocity: P3(0.3, 1.1, 0.5),
        velocitySpread: P3(0.2, 0.2, 0.2), turbulence: 0.8, size: [0.5, 1.8], color: 0xdfe8ff, opacity: 0.22
    });
    sky.add(zzz.mesh);
    const skyProps = Promise.all([
        prop('large_castle_door', { height: 11.3 }).then((d) => {
            if (!d) return;
            d.position.set(0, F, HALL.z1 + T * 0.45);
            const r = d.getObjectByName('large_castle_door_right');
            const l = d.getObjectByName('large_castle_door_left');
            if (r) r.rotation.y = 1.85;
            if (l) l.rotation.y = -1.85;
            sky.add(d);
        }),
        prop('WoodenTable_01', { height: TABLE.h }).then((t) => {
            if (!t) return;
            t.position.set(TABLE.x, F, TABLE.z);
            sky.add(t);
            const s = t.userData.size;
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) skyCol.push({ x: TABLE.x + sx * s.x * 0.44, z: TABLE.z + sz * s.z * 0.38, r: 0.55 });
        }),
        prop('WoodenChair_01', { height: 9.4 }).then((c) => {
            if (!c) return;
            c.position.set(SEAT.x, F, SEAT.z - 0.9);
            sky.add(c);
            const s = c.userData.size;
            for (const sx of [-1, 1]) for (const sz of [-1, 1]) skyCol.push({ x: SEAT.x + sx * s.x * 0.42, z: SEAT.z - 0.9 + sz * s.z * 0.4, r: 0.45 });
        }),
        prop('Chandelier_01', { width: 6.5, ground: false }).then((c) => {
            if (!c) return;
            c.position.copy(hall.userData.chandelier);
            c.traverse((m) => { if (m.isMesh) m.castShadow = false; });
            sky.add(c);
        }),
        low ? null : prop('treasure_chest', { width: 5 }).then((c) => {
            if (!c) return;
            c.position.set(-11.2, F, 12.5);
            c.rotation.y = 1.25;
            sky.add(c);
        }),
        prop('brass_goblets', { height: 1.6 }).then((c) => {
            if (!c) return;
            c.position.set(2.5, F + TABLE.h, 0.4);
            sky.add(c);
        }),
        instanceModel('food_apple_01', [{ x: -2.6, y: F + TABLE.h, z: 0.2, ry: 1, s: 1 }, { x: -3.5, y: F + TABLE.h, z: 1.1, ry: 2, s: 0.9 }, { x: 5.4, y: F, z: 3.5, ry: 0, s: 1.1 }], { height: 0.6 }).then((g) => g && sky.add(g))
    ]).catch(() => {});
    skyCol.push(box(-11.2, 12.5, 1.6, 2.7));

    const GOLD = { x: -8.2, z: 9.2 };
    const HEN = { x: 9.6, z: 5 };
    const HARP = { x: 9, z: -15 };
    const goldBag = buildGoldBag(1.7);
    goldBag.position.set(GOLD.x, F, GOLD.z);
    const nest = buildNest(1.7);
    nest.position.set(HEN.x, F, HEN.z);
    const hen = createCreature('chicken', { detail: 2, scale: 1.7, colors: { base: 0xe8b84a, back: 0xd89a2a, belly: 0xf2d27a } });
    hen.object.position.set(HEN.x, F + 0.38, HEN.z);
    hen.object.rotation.y = -1.2;
    const henSt = { mode: 'sit', speed: 0 };
    const stool = buildStool(1.5, 0.9);
    stool.position.set(HARP.x, F, HARP.z);
    const harp = buildHarp(1.35);
    harp.position.set(HARP.x, F + 0.9, HARP.z);
    harp.rotation.y = -0.7;
    const harpLight = new THREE.PointLight(0xffd070, 0, 12, 1.6);
    harpLight.position.set(HARP.x, F + 2.6, HARP.z + 1.2);
    sky.add(goldBag, nest, hen.object, stool, harp, harpLight);
    skyCol.push({ x: GOLD.x, z: GOLD.z, r: 0.8 }, { x: HEN.x, z: HEN.z, r: 0.95 }, { x: HARP.x, z: HARP.z, r: 1.4 });
    // toco do pé de feijão furando a nuvem na clareira de chegada
    const stub = createBeanstalk({ height: 11, radius: 0.75, leafSpacing: 2.2, leafSize: 3.4, seed: 5, detail: low ? 0 : 1 });
    stub.object.position.set(CLOUD_SPAWN.x + 3, -7, CLOUD_SPAWN.z + 4);
    sky.add(stub.object);
    skyCol.push({ x: CLOUD_SPAWN.x + 3, z: CLOUD_SPAWN.z + 4, r: 0.9 });

    progress(0.94, 'Polindo o ouro…');
    await Promise.race([Promise.all([scatters, skyProps, terrain.ready, forest.ready]), new Promise((r) => setTimeout(r, 9000))]);

    /* ================================================================== */
    /* Capítulos                                                           */
    /* ================================================================== */
    const _h = new THREE.Vector3();
    const _c = new THREE.Vector3();
    const tramplers = [{ x: 0, y: 0, z: 0, radius: 0.8 }, { x: 0, y: 0, z: 0, radius: 1.3 }];
    let cur = null;
    let envK = 1;

    function baseState(id) {
        return {
            id, colliders: [], interactables: [], platforms: [], climbs: [], pods: [], stalkCam: null, heightAt: hAt,
            bounds: { minX: -46, maxX: 46, minZ: -21, maxZ: 46 }, spawn: { x: 0, z: 0, yaw: 0 },
            overview: { pos: P3(14, 7, 20), look: P3(-3, 1.6, 1), radius: 19 },
            voidY: -30, flags: {}, cow: null, giant: null, stalk: null, chop: 0, chopNeeded: 8, updateFns: [],
            fogBase: terrain.bounds.minY, minY: terrain.bounds.minY, shadowRadius: low ? 34 : 46, cam: null,
            addInteract(it) { this.interactables.push(it); }
        };
    }

    const setMother = (x, z, ry) => {
        mother.object.visible = true;
        mother.object.position.set(x, hAt(x, z), z);
        mother.object.rotation.y = ry;
    };
    const motherLines = {
        cottage: [
            'João, a despensa está vazia. Não resta nem um punhado de farinha.',
            'Leve a Mimosa à feira. É tudo o que nos resta — e não aceite trocas estranhas.',
            'Volte antes do sol baixo. Eu cuido da cabana.'
        ],
        night: [
            'Feijões? João, vendemos a Mimosa por feijões?',
            'Joguei tudo pela janela. Durma. Amanhã pensamos no pão.',
            '…O que é esse farfalhar no quintal?'
        ]
    };
    const stalkPose = (kk) => {
        // crescimento: a altura segue k; a espessura atrasa (broto fino que engrossa)
        const sy = 0.012 + 0.988 * kk;
        const sxz = 0.22 + 0.78 * smoothstep(0.1, 1, kk);
        bean.object.scale.set(sxz, sy, sxz);
    };

    function enter(id) {
        const w = baseState(id);
        cur = w;
        const isSky = id === 'castle';
        ground.visible = !isSky;
        sky.visible = isSky;
        const night = id === 'night';
        const dusk = id === 'escape';
        lamps.forEach((l) => { l.intensity = night ? 26 : dusk ? 9 : 0; });
        cottage.userData.glow.emissiveIntensity = night ? 3.2 : dusk ? 1.4 : 0;
        fireflies.mesh.visible = night;
        stemMat.emissiveIntensity = night ? 0.55 : dusk ? 0.12 : 0;
        beans.visible = false;
        beanLight.intensity = 0;
        magic.mesh.visible = false;
        wisps.mesh.visible = false;
        dust.mesh.visible = false;
        stalkPivot.visible = false;
        stalkPivot.quaternion.identity();
        for (const p of pods) {
            p.taken = false;
            p.mesh.visible = false;
        }
        collar.object.visible = false;
        mother.object.visible = false;
        cowCreature.object.visible = false;
        rope.mesh.visible = false;
        giantHero.object.visible = false;
        if (axeProp) axeProp.visible = true;
        motherSt.mode = 'idle';
        merchantSt.mode = 'idle';
        if (!isSky) w.colliders.push(...colliders);

        if (id === 'cottage') {
            w.spawn = { x: 6, z: 10.5, yaw: -2.5 };
            w.flags = { talkedMother: false, hasCow: false };
            const m = local(CABIN, 1.4, 4.4);
            setMother(m.x, m.z, CABIN.ry + 0.2);
            w.colliders.push({ x: m.x, z: m.z, r: 0.5 });
            w.addInteract({ x: m.x, z: m.z, r: 1.9, id: 'mother', kind: 'talk', label: 'Falar com a mãe', speaker: 'Mãe', lines: motherLines.cottage });
            cow.place(7, 2.4, -1.9);
            cow.follow = false;
            cow.parked = false;
            cowCreature.object.visible = true;
            w.cow = cow;
            w.addInteract({ r: 2.3, id: 'cow', kind: 'cow', label: 'Chamar a Mimosa', get x() { return cow.x; }, get z() { return cow.z; } });
            w.addInteract({ x: GATE.x, z: GATE.z, r: 3.8, id: 'gate', kind: 'goal', label: 'Seguir para a feira' });
            w.gate = GATE;
        } else if (id === 'fair') {
            w.bounds = { minX: FAIR.x - 38, maxX: FAIR.x + 34, minZ: FAIR.z - 34, maxZ: FAIR.z + 34 };
            w.spawn = { x: FAIR.x - 16, z: FAIR.z + 14, yaw: 2.0 };
            w.overview = { pos: P3(FAIR.x + 16, hAt(FAIR.x, FAIR.z) + 9, FAIR.z + 20), look: P3(FAIR.x, hAt(FAIR.x, FAIR.z) + 1.5, FAIR.z), radius: 22 };
            w.flags = { sold: false };
            w.addInteract({
                x: MX, z: MZ, r: 2.2, id: 'merchant', kind: 'talk', label: 'Falar com o mercador', speaker: 'Mercador',
                lines: [
                    'Essa vaca tem olhar de quem já andou longe.',
                    'Não ofereço moedas. Ofereço cinco feijões que dormem no bolso e acordam na terra.',
                    'Plante-os ao relento. O resto… o céu decide.'
                ]
            });
            cow.place(FAIR.x - 19, FAIR.z + 15.5, 2.0);
            cow.follow = true;
            cow.parked = false;
            cowCreature.object.visible = true;
            w.cow = cow;
            w.cowPark = { x: MX + 2.6, z: MZ + 1.2 };
        } else if (night) {
            w.spawn = { x: 8, z: 12, yaw: -2.4 };
            w.overview = { pos: P3(16, 9, 24), look: P3(0, 4, 6), radius: 22 };
            w.flags = { talkedMother: false, growing: false, grown: false, growT: 0 };
            const m = local(CABIN, 1.4, 4.4);
            setMother(m.x, m.z, CABIN.ry + 0.2);
            w.colliders.push({ x: m.x, z: m.z, r: 0.5 });
            w.addInteract({ x: m.x, z: m.z, r: 1.9, id: 'mother', kind: 'talk', label: 'Falar com a mãe', speaker: 'Mãe', lines: motherLines.night });
            beans.visible = true;
            beanLight.intensity = 5;
            stalkPose(0);
            const climb = { axis: stalkAxis, hold: stalkHold, r: 3.0, yMin: stalkBase + 0.5, yMax: STALK.top, locked: true, groundGrab: true };
            w.climbs.push(climb);
            w.stalk = { x: STALK.x, z: STALK.z };
            w.addInteract({ x: STALK.x, z: STALK.z, y: hAt(STALK.x, STALK.z), yReach: 2.5, r: 2.1, id: 'beans', kind: 'plant', label: 'Olhar os feijões no quintal' });
            w.addInteract({ x: STALK.x, z: STALK.z, r: 3.4, y: STALK.top, yReach: 10, id: 'clouds', kind: 'goal', label: 'Entrar nas nuvens' });
            w.growStalk = () => {
                w.flags.growing = true;
                w.flags.growT = 0;
                stalkPivot.visible = true;
                beans.visible = false;
                magic.mesh.visible = true;
                collar.object.visible = true;
            };
            /* Crescimento: k = smoothstep(0, 6,5 s, t). Ao terminar, libera o caule e as folhas-plataforma. */
            w.updateFns.push((t, dt) => {
                if (w.flags.growing && !w.flags.grown) {
                    w.flags.growT += dt;
                    const kk = smoothstep(0, 6.5, w.flags.growT);
                    stalkPose(kk);
                    beanLight.intensity = 30 * (1 - kk) + 3;
                    w.growK = kk;
                    if (kk >= 1) {
                        w.flags.grown = true;
                        climb.locked = false;
                        w.platforms.push(...leaves);
                        w.colliders.push({ x: STALK.x, z: STALK.z, r: 1.25, top: stalkBase + 3 });
                        w.stalkCam = stalkCam;
                        w.pods = pods;
                        for (const p of pods) p.mesh.visible = true;
                    }
                }
                if (w.flags.grown && w.flags.growT < 12) {
                    w.flags.growT += dt;
                    if (w.flags.growT > 11) magic.mesh.visible = false;
                }
            });
        } else if (dusk) {
            w.spawn = { x: STALK.x, z: STALK.z + 1.4, yaw: Math.PI, y: 68, climbing: true };
            w.overview = { pos: P3(22, 16, 30), look: P3(STALK.x, 14, STALK.z), radius: 30 };
            w.flags = { hasAxe: false, chopped: false };
            stalkPivot.visible = true;
            stalkPose(1);
            collar.object.visible = true;
            w.climbs.push({ axis: stalkAxis, hold: stalkHold, r: 3.0, yMin: stalkBase + 0.5, yMax: STALK.top, locked: false, groundGrab: false });
            w.platforms.push(...leaves);
            w.stalkCam = stalkCam;
            w.colliders.push({ x: STALK.x, z: STALK.z, r: 1.25, top: stalkBase + 3 });
            w.stalk = { x: STALK.x, z: STALK.z, axis: stalkAxis };
            // com altura: lá no alto do caule o aviso de cortar/pegar não aparece
            w.addInteract({ x: AXE.x, z: AXE.z, y: hAt(AXE.x, AXE.z), yReach: 2.5, r: 1.9, id: 'axe', kind: 'axe', label: 'Pegar o machado', get mesh() { return axeProp; } });
            w.addInteract({ x: STALK.x, z: STALK.z, y: hAt(STALK.x, STALK.z), yReach: 2.5, r: 2.7, id: 'chop', kind: 'chop', label: 'Cortar o pé de feijão' });
            giant.reset(STALK.x, STALK.z, 78, 0, 'chase');
            w.giant = giant;
            const m = local(CABIN, 2.6, 5.2);
            setMother(m.x, m.z, 0.9);
            w.colliders.push({ x: m.x, z: m.z, r: 0.5 });
            w.fall = { th: 0, om: 0, done: false };
            /*
             * Queda do pé: pêndulo invertido preso à base.
             *   θ'' = 1,1·sin θ + 0,25   até θ = π/2 − 0,03 (deitado) → poeira + tremor
             * Enquanto se corta, cada machadada inclina 0,012 rad.
             */
            const axis = new THREE.Vector3(FALL_DIR.z, 0, -FALL_DIR.x);
            w.updateFns.push((t, dt) => {
                const f = w.fall;
                if (!w.flags.chopped) f.th = lerp(f.th, (w.chop / w.chopNeeded) * 0.1, 1 - Math.exp(-6 * dt));
                else if (!f.done) {
                    f.om += (1.1 * Math.sin(f.th) + 0.25) * dt;
                    f.th += f.om * dt;
                    if (f.th >= Math.PI / 2 - 0.03) {
                        f.th = Math.PI / 2 - 0.03;
                        f.done = true;
                        f.impact = true;
                        dust.mesh.visible = true;
                        dust.t0 = t;
                        collar.object.visible = false;
                    }
                }
                stalkPivot.quaternion.setFromAxisAngle(axis, f.th);
                // caule inclinado/caindo: folhas e casca deixam de valer para pé e câmera
                if (f.th > 0.02 && w.platforms.length) {
                    w.platforms.length = 0;
                    w.stalkCam = null;
                }
                if (dust.mesh.visible) dust.uniforms.uOpacity.value = 0.5 * Math.max(0, 1 - (t - dust.t0) / 6);
            });
            w.fallDir = FALL_DIR;
        } else if (isSky) {
            w.heightAt = cloudHeight;
            w.bounds = { minX: -44, maxX: 44, minZ: -44, maxZ: 64 };
            w.spawn = { x: CLOUD_SPAWN.x, z: CLOUD_SPAWN.z, yaw: Math.PI };
            w.overview = { pos: P3(30, 13, 62), look: P3(0, 9, 14), radius: 60 };
            w.voidY = -8;
            w.fogBase = -5;
            w.minY = -6;
            w.shadowRadius = 52;
            w.flags = { gold: false, hen: false, harp: false };
            w.colliders.push(...skyCol);
            goldBag.visible = nest.visible = hen.object.visible = harp.visible = true;
            harpLight.intensity = 14;
            w.addInteract({ x: GOLD.x, z: GOLD.z, y: F, r: 2.0, id: 'gold', kind: 'treasure', label: 'Pegar o saco de ouro', mesh: goldBag });
            w.addInteract({ x: HEN.x, z: HEN.z, y: F, r: 2.2, id: 'hen', kind: 'treasure', label: 'Pegar a galinha dourada', mesh: hen.object });
            w.addInteract({ x: HARP.x, z: HARP.z, y: F, r: 2.6, id: 'harp', kind: 'treasure', label: 'Pegar a harpa que canta', mesh: harp });
            giant.reset(SEAT.x, SEAT.z, F, 0, 'sleep');
            giant.obstacles = giantObstacles;
            giant.wakeTo = { x: SEAT.x + 9.5, z: SEAT.z - 1.5 };
            w.giant = giant;
            w.inside = (x, z) => x > HALL.x0 && x < HALL.x1 && z > HALL.z0 && z < HALL.z1 + T;
            w.cam = { minX: HALL.x0 + 0.8, maxX: HALL.x1 - 0.8, minZ: HALL.z0 + 0.8, maxZ: HALL.z1 - 0.6, maxY: HALL.h - 1 };
        }
        return w;
    }

    /** Atualização por quadro do cenário visível (vento, grama, LOD, partículas, atores secundários). */
    function update(dt, t, camera, player, talking) {
        const w = cur;
        if (!w) return;
        if (ground.visible) {
            terrain.update(camera);
            tramplers[0].x = player.x;
            tramplers[0].y = player.y;
            tramplers[0].z = player.z;
            tramplers[1].x = cow.x;
            tramplers[1].z = cow.z;
            tramplers[1].y = cowCreature.object.position.y;
            grass.update(camera, dt, tramplers);
            forest.update(camera);
            stream.update(dt);
            smoke.update(t);
            if (fireflies.mesh.visible) fireflies.update(t);
            if (magic.mesh.visible) magic.update(t);
            if (dust.mesh.visible) dust.update(t - (dust.t0 || 0));
            wisps.mesh.visible = stalkPivot.visible && player.y > 14 && !w.flags.chopped;
            if (wisps.mesh.visible) {
                wisps.uniforms.uOrigin.value.y = player.y + 4;
                wisps.update(t);
            }
            if (mother.object.visible) {
                motherSt.mode = talking === 'Mãe' ? 'talk' : w.flags.chopped ? 'cheer' : 'idle';
                mother.lookAt(_h.set(player.x, player.y + 1.1, player.z));
                mother.update(dt, motherSt);
            }
            if (w.id === 'fair') {
                merchantSt.mode = talking === 'Mercador' ? 'talk' : 'idle';
                merchant.lookAt(_h.set(player.x, player.y + 1.1, player.z));
                merchant.update(dt, merchantSt);
                for (const v of villagers) v.h.update(dt, v.st);
            }
            if (w.id === 'night') {
                for (let i = 0; i < 5; i++) beans.children[i].position.y = stalkBase + 0.62 + Math.sin(t * 3 + i) * 0.04;
                for (const p of w.pods) {
                    if (!p.mesh.visible) continue;
                    p.mesh.position.y = p.y + Math.sin(t * 2.2 + p.i) * 0.07;
                    p.mesh.children[0].rotation.y = t * 1.4 + p.i;
                }
            }
            // corda: mão esquerda do João → cabeça da Mimosa
            const roped = w.cow && cow.follow && !cow.parked;
            rope.mesh.visible = roped;
            if (roped) {
                player.hero.sockets.handL.getWorldPosition(_h);
                cowCreature.sockets.head.getWorldPosition(_c);
                _c.y -= 0.18;
                rope.update(_h, _c);
            }
        } else {
            const fl = 0.85 + Math.sin(t * 9) * 0.08 + Math.sin(t * 23.7) * 0.07;
            fireLight.intensity = 230 * fl;
            chandLight.intensity = 210;
            fire.update(t);
            zzz.mesh.visible = giant.state === 'sleep';
            if (zzz.mesh.visible) zzz.update(t);
            if (hen.object.visible) {
                henSt.mode = (t % 9) > 6.5 ? 'idle' : 'sit';
                hen.update(dt, henSt);
            }
            if (harp.visible) harp.rotation.y = -0.7 + Math.sin(t * 1.4) * 0.05;
        }
        // interior do salão: o IBL do céu não é ocluído pelas paredes, então é reduzido lá dentro
        const inside = w.inside ? w.inside(player.x, player.z) : false;
        envK = lerp(envK, inside ? 0.55 : 1, 1 - Math.exp(-3 * dt));
        w.envK = envK;
    }

    return {
        enter, update, ground, sky, terrain, grass, forest, giant, cow, leaves, pods,
        setCloudLight(glow, under, kg, ku) {
            realm.material.userData.setLight(glow, under, kg, ku);
            collar.material.userData.setLight(glow, under, kg, ku);
        },
        get current() { return cur; }
    };
}

function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
}
