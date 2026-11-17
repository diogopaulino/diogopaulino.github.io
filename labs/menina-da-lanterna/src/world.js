/**
 * Vale-da-Bruma — um vale contínuo com os cinco capítulos do conto, de sul a norte:
 *
 *   z = +120  I   A Aldeia Apagada     praça calçada, casas de enxaimel, poço, 4 lampiões
 *   z = +80…15 II  A Trilha das Sombras floresta fechada, 5 lanternas penduradas, moinho velho
 *   z ≈ 0     III O Rio dos Nomes      rio de leste a oeste, 3 bóias, sarças do Pingo, ponte
 *   z = −62   IV  A Árvore Oca         carvalho gigante, 4 raízes de luz, a Noite
 *   z = −130  V   O Primeiro Sol       colina com a Pedra da Aurora
 *
 * Cada capítulo é uma `Zone` (limites, colisores, interativos, lampiões, sombras).
 * O mundo é montado uma vez; trocar de capítulo só move Clara e reinicia a zona.
 * O que foi aceso num capítulo continua aceso nos seguintes — do alto da colina,
 * no fim, o vale inteiro está iluminado.
 *
 * Relevo (heightFn), em metros:
 *   h = inclinação(|z|) + ondulação fbm + bordas do vale (oeste alto, leste baixo: o sol nasce ali)
 *   aldeia e clareira da árvore são aplainadas; a colina soma 15·(1 − smoothstep(4, 42, d))
 *   rio: fundo(t) = lerp(3,2; −1,2; t) rio abaixo; várzea = fundo + 1,25 + min(0,07·d; 2,4);
 *        leito cavado 1,3 m com margem de 3 m
 */

import * as THREE from 'three';
import { clamp, lerp, smoothstep, seeded, fbm2, damp, applyWorldUV } from '../../shared/gfx/core.js';
import {
    createCourse, carveBasin, createTerrain, createGrass, createForest, createWater, createPath, createFence,
    scatter, scatterModel
} from '../../shared/gfx/terrain.js';
import { loadModel, instanceModel } from '../../shared/gfx/assets.js';
import { createHero } from '../../shared/gfx/hero.js';
import { createCreature } from '../../shared/gfx/creature.js';
import { createParticles } from '../../shared/gfx/particles.js';
import {
    Batch, materials, trs, addHouse, glassMaterial, addWell, addLanternPost, bridgeBatch, bridgeDeckY, BRIDGE,
    wheelGeometry, setLowDetail, brambleGeometry, rootCradle, buttressRoots, hollowArch, hollowCore
} from './build.js?v=20';
import { createGlows, createFlameKit, createMotes, createShadowBody, createBeacon, revealMaterial, FX_TIME } from './fx.js?v=20';
import { ShadowWisp, NightWraith, FoxCompanion } from './npcs.js?v=20';
import { ROOT_COLORS, STORY } from './config.js?v=20';

const VILLAGE = { x: 0, z: 120 };
const TREE = { x: 40, z: -62 };
const HILL = { x: 0, z: -130 };
const WARM = 0xffa24a;

export class Zone {
    constructor(id) {
        this.id = id;
        this.colliders = [];
        this.boxes = [];
        this.interactables = [];
        this.lamps = [];
        this.shadows = [];
        this.fireflies = [];
        this.night = null;
        this.fox = null;
        this.goal = null;
        this.heightAt = () => 0;
        this.bounds = { minX: -40, maxX: 40, minZ: -40, maxZ: 40 };
        this.spawn = { x: 0, z: 0, yaw: 0 };
        this.overview = new THREE.Vector3();
        this.center = new THREE.Vector3();
        this.updateFns = [];
        this.resetFns = [];
        this.progress = { lampsNeeded: 0, talked: false, foxFreed: false, crystals: [], placed: false };
        this.river = null;
        this.bridgeOpen = false;
    }

    addCollider(x, z, r, h = 99) {
        this.colliders.push({ x, z, r, h });
    }

    /** Colisor retangular orientado (meias-medidas hw × hd, rotação ry, altura h). */
    addBox(x, z, hw, hd, ry = 0, h = 99) {
        this.boxes.push({ x, z, hw, hd, c: Math.cos(ry), s: Math.sin(ry), h });
    }

    addInteract(it) {
        this.interactables.push(it);
    }

    lampsLit() {
        let n = 0;
        for (const l of this.lamps) if (l.lit) n++;
        return n;
    }

    /** Progresso 0..1 do capítulo — alimenta a atmosfera (névoa recua, cor volta). */
    warmth() {
        const p = this.progress;
        if (this.needCrystals) return p.crystals.length / 4;
        if (this.needPlace) return p.placed ? 1 : 0;
        return p.lampsNeeded ? this.lampsLit() / p.lampsNeeded : 0;
    }

    readyToExit() {
        if (this.progress.lampsNeeded > 0 && this.lampsLit() < this.progress.lampsNeeded) return false;
        if (this.needTalk && !this.progress.talked) return false;
        if (this.needFox && !this.progress.foxFreed) return false;
        if (this.needCrystals && this.progress.crystals.length < 4) return false;
        if (this.needPlace && !this.progress.placed) return false;
        return true;
    }

    /** Há obstáculo num círculo de raio r em (x, z)? `y` (opcional) ignora obstáculos mais baixos (câmera). */
    blocked(x, z, r, y = null) {
        for (const c of this.colliders) {
            if (y !== null && y > this.heightAt(c.x, c.z) + c.h) continue;
            const dx = x - c.x;
            const dz = z - c.z;
            if (dx * dx + dz * dz < (r + c.r) * (r + c.r)) return true;
        }
        for (const b of this.boxes) {
            if (y !== null && y > this.heightAt(b.x, b.z) + b.h) continue;
            const dx = x - b.x;
            const dz = z - b.z;
            const lx = dx * b.c - dz * b.s;
            const lz = dx * b.s + dz * b.c;
            if (Math.abs(lx) < b.hw + r && Math.abs(lz) < b.hd + r) return true;
        }
        // o rio só se cruza pela ponte (e só depois de as bóias acenderem)
        if (this.river && y === null && this.river.dist(x, z, 6) < 3.7 + r) {
            if (!(this.bridgeOpen && this.onBridge(x, z))) return true;
        }
        return false;
    }

    /** Reinicia a zona. `done` = capítulo já vencido (tudo aceso, sem inimigos). */
    reset(done = false) {
        const p = this.progress;
        p.talked = done;
        p.foxFreed = done;
        p.crystals = done ? [0, 1, 2, 3] : [];
        p.placed = false;
        this.bridgeOpen = done && !!this.river;
        for (const l of this.lamps) l.setLit(done, true);
        for (const it of this.interactables) if (it.kind !== 'lamp') it.done = done && it.kind !== 'place';
        for (const fn of this.resetFns) fn(done);
    }
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/**
 * Monta o vale inteiro.
 * @param {object} stage  retorno de createStage
 * @param {object} q      entrada de QUALITY (config.js)
 * @param {(p:number, text:string)=>void} progress
 */
export async function createValley(stage, q, progress = () => {}) {
    const scene = stage.scene;
    const tier = stage.tier;
    const M = materials();
    setLowDetail(tier === 'low');
    const rnd = seeded(2024);

    // ─────────────── traçados ───────────────
    const river = createCourse([[150, -10], [110, -4], [78, 3], [50, 2], [25, -2], [0, 1], [-30, -3], [-62, 5], [-100, 1], [-150, 8]], { width: 6.5 });
    const roadA = createCourse([[0, 111], [0, 100], [1.5, 88], [3, 76], [-2.5, 64], [2.5, 52], [-1.5, 40], [-3, 29], [-3, 21], [3, 15.5], [16, 13], [30, 12.5], [42, 11.5], [50, 9.2]], { width: 2.6 });
    const roadB = createCourse([[50, -5.2], [48, -16], [45, -30], [42, -42], [33, -53], [27, -70], [20, -86], [10, -100], [3, -110], [0, -120]], { width: 2.4 });
    const BR = { x: 50, z: river.sample(50, 2).z };
    const MILL = { x: -11, z: river.sample(-11, 6).z + 7.9 };
    const riverSample = (x, z) => (z > 46 || z < -44 ? null : river.sample(x, z));
    const bedAt = (t) => lerp(3.2, -1.2, t);

    const Hv = 6.3;
    const Ht = 5.3;
    const heightFn = (x, z) => {
        const tilt = 2.2 + (z > 0 ? z * 0.034 : -z * 0.05);
        let h = tilt + (fbm2(x * 0.013 + 10, z * 0.013 + 20, 4) - 0.5) * 9 + (fbm2(x * 0.06, z * 0.06, 3) - 0.5) * 1.3;
        const ax = Math.abs(x);
        h += smoothstep(66, 150, ax) * (x < 0 ? 34 : 13) * (0.75 + 0.5 * fbm2(x * 0.02 + 4, z * 0.02, 3));
        h += smoothstep(150, 186, z) * 24 + smoothstep(-160, -188, z) * 18;
        const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
        h = lerp(h, Hv + (fbm2(x * 0.08, z * 0.08, 2) - 0.5) * 0.3, 1 - smoothstep(26, 48, dv));
        const dt = Math.hypot(x - TREE.x, z - TREE.z);
        h = lerp(h, Ht + (fbm2(x * 0.09 + 7, z * 0.09, 2) - 0.5) * 0.5, 1 - smoothstep(13, 28, dt));
        h += 1.1 * (1 - smoothstep(2, 9, dt));
        const dh = Math.hypot(x - HILL.x, z - HILL.z);
        h += 15 * (1 - smoothstep(4, 42, dh));
        const s = riverSample(x, z);
        if (s) {
            const bed = bedAt(s.t);
            const d = s.d;
            h = lerp(h, bed + 1.25 + Math.min(d * 0.07, 2.4), 1 - smoothstep(9, 36, d));
            h -= 1.3 * (1 - smoothstep(3.1, 6.1, d));
            // canal da roda do moinho
            const dm = Math.hypot(x - MILL.x, z - (MILL.z - 4.4));
            if (dm < 6) h = carveBasin(x, z, h, { x: MILL.x, z: MILL.z - 4.4, radius: 4.2, floor: bed - 0.15 });
        }
        return h;
    };

    // camadas: grama · terra batida · calçamento de pedra · chão de folhas
    const woods = (x, z) => smoothstep(0.38, 0.6, fbm2(x * 0.016 + 3, z * 0.016 + 8, 3));
    const terrain = createTerrain({
        size: [300, 376], center: [0, -4], heightFn, tier,
        layers: [
            { set: 'leafy_grass', scale: 3.4, tint: 0xa9c284 },
            { set: 'dirt_floor', scale: 3.0, tint: 0xa8a696 },
            { set: 'cobblestone_floor_08', scale: 2.6, tint: 0xc4c0b6 },
            { set: 'brown_mud_leaves_01', scale: 3.2 }
        ],
        splatFn: (x, z, h, slope, out) => {
            const inTrail = z < 90 && z > 14 && Math.abs(x) < 40 ? 0.35 : 0;
            out[0] = smoothstep(0.68, 0.85, fbm2(x * 0.05 + 5, z * 0.05 + 2, 2)) * 0.6;
            out[1] = 0;
            const town = 1 - smoothstep(30, 46, Math.hypot(x, z - 120));
            out[2] = clamp(woods(x, z) * 0.7 + inTrail + smoothstep(0.2, 0.4, slope) * 0.5, 0, 0.9) * (1 - town);
            out[0] *= 1 - town * 0.7;
            out[3] = 0;
            return out;
        }
    });
    scene.add(terrain.object);
    stage.follow(terrain);
    const H = terrain.heightAt;
    progress(0.3, 'Calçando a praça…');
    await nextFrame();

    createPath({ terrain, course: roadA, ruts: true });
    createPath({ terrain, course: roadB, ruts: true });
    createPath({ terrain, points: [[-3, 21], [-7, 17], [MILL.x + 1, MILL.z + 4.4]], width: 1.8 });
    // praça e ruelas calçadas (camada 2)
    terrain.paint({ minX: -16, maxX: 16, minZ: 104, maxZ: 136 }, (x, z, h, slope, w) => {
        const d = Math.hypot(x - VILLAGE.x, z - VILLAGE.z) + (fbm2(x * 0.5, z * 0.5, 2) - 0.5) * 1.6;
        const k = 1 - smoothstep(8.4, 10.2, d);
        w[0] *= 1 - k;
        w[2] *= 1 - k;
        w[1] = Math.max(w[1], k);
        return w;
    });
    const lanes = [[[-4, 119], [-9, 117.4]], [[5, 116], [10.5, 112.6]], [[-6, 124], [-12, 128.6]], [[5, 124.5], [8.6, 129]], [[0, 112], [0, 106]]];
    for (const pts of lanes) createPath({ terrain, points: pts, width: 2.1, layer: 2, noise: 0.3 });

    const water = createWater({ terrain, river, depth: 0.6, shallow: 0x4d6a66, deep: 0x0d2630, flow: 0.8 });
    scene.add(water.object);
    // grama: no tier high o padrão do kit (150 lâminas/m², 80 m) passa de 600 mil triângulos sozinho
    const grass = createGrass({ terrain, tier, ...(tier === 'high' ? { density: 105, range: 58 } : {}) });
    if (tier === 'low') grass.setDensity(0.55);
    scene.add(grass.object);
    progress(0.42, 'Plantando a floresta…');
    await nextFrame();

    // ─────────────── floresta ───────────────
    const clearings = (x, z) => Math.max(
        1 - smoothstep(31, 44, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)),
        1 - smoothstep(9, 15, Math.hypot(x - MILL.x, z - MILL.z)),
        1 - smoothstep(15.5, 21, Math.hypot(x - TREE.x, z - TREE.z)),
        (1 - smoothstep(13, 34, Math.hypot(x - HILL.x, z - HILL.z))) * 0.94,
        1 - smoothstep(5, 9, Math.hypot(x - BR.x, z - BR.z)),
        1 - smoothstep(3, 5, Math.hypot(x - 30, z - 17))
    );
    const trees = scatter({
        terrain, count: q.trees, minDist: 5.2, seed: 4, slopeMax: 0.34, keepOff: [roadA, roadB, river], margin: 3.4,
        maskFn: (x, z) => (0.3 + 0.7 * woods(x, z) + (z < 92 && z > 12 && Math.abs(x) < 45 ? 0.5 : 0)) * (1 - clearings(x, z))
    });
    const extra = [
        { x: -3.9, z: 88.5, species: 'pinheiro', s: 1.25 }, { x: 4.6, z: 87.6, species: 'pinheiro', s: 1.35 },
        ...[[-26, 8], [20, 8.5], [44, 9.5], [-48, 12], [70, 10], [14, -8], [-20, -10], [64, -6]].map(([x, z]) => ({ x, z: river.sample(x, z).z + (z > 0 ? 7.2 : -7.2), species: 'salgueiro' })),
        ...[0.2, 2.9, 3.9, 5.0, 5.9].map((a) => ({ x: TREE.x + Math.cos(a) * 19, z: TREE.z + Math.sin(a) * 19, species: 'morta' })),
        { x: -15, z: -112, species: 'betula' }, { x: 17, z: -118, species: 'betula' }, { x: -21, z: 142, species: 'carvalho' }, { x: 22, z: 137, species: 'carvalho', s: 1.1 }
    ];
    const forest = createForest({
        terrain, renderer: stage.renderer, tier, seed: 3, placements: [...trees, ...extra],
        lodDistance: tier === 'high' ? 42 : tier === 'medium' ? 36 : 22,
        species: [{ kind: 'carvalho', weight: 3 }, { kind: 'pinheiro', weight: 4 }, { kind: 'betula', weight: 1.5 }, { kind: 'salgueiro', weight: 0 }, { kind: 'morta', weight: 0.2 }]
    });
    scene.add(forest.object);
    // a Árvore Oca: um carvalho 2,7× maior, sempre em malha
    const giant = createForest({
        terrain, renderer: null, tier, seed: 11, placements: [{ x: TREE.x, z: TREE.z, ry: 0.6 }], variants: 1, lodDistance: 1e6, sink: 0.5,
        species: [{ kind: 'carvalho', scale: [2.7, 2.7], params: { trunkR: 0.66, flare: 0.9, trunkFrac: 0.38 } }]
    });
    scene.add(giant.object);
    const heavy = [forest.object, giant.object]; // grupos que ganham malhas depois (ver _patchShadowPasses em main.js)

    const scatterGroups = [];
    const addScatter = (o) => scatterModel({ terrain, tier, ...o }).then((g) => {
        if (!g) return;
        scene.add(g);
        scatterGroups.push(g);
        heavy.push(g);
    });
    const k = q.scatter;
    const offVillage = (x, z) => 1 - clearings(x, z);
    const jobs = [
        addScatter({ preset: 'rochas', count: Math.round(34 * k), seed: 5, keepOff: [roadA, roadB], maskFn: (x, z) => 0.3 + terrain.slopeAt(x, z) * 4 }),
        addScatter({ preset: 'samambaias', count: Math.round(240 * k), seed: 7, keepOff: [roadA, roadB], maskFn: (x, z) => woods(x, z) * offVillage(x, z) + 0.04, area: { minX: -70, maxX: 80, minZ: -150, maxZ: 100 } }),
        addScatter({ preset: 'arbustos', count: Math.round(90 * k), seed: 8, keepOff: [roadA, roadB, river], maskFn: (x, z) => woods(x, z) * offVillage(x, z), area: { minX: -70, maxX: 80, minZ: -150, maxZ: 150 } })
    ];
    if (tier !== 'low') {
        jobs.push(
            addScatter({ preset: 'pedras', count: Math.round(46 * k), seed: 6, keepOff: [roadA, roadB], area: { minX: -60, maxX: 75, minZ: -150, maxZ: 30 } }),
            addScatter({ preset: 'tocos', count: 6, seed: 10, keepOff: [roadA, roadB, river], maskFn: (x, z) => woods(x, z) * offVillage(x, z), area: { minX: -40, maxX: 60, minZ: -100, maxZ: 95 } }),
            addScatter({ preset: 'flores', count: Math.round(110 * k), seed: 12, keepOff: [roadA], area: { x: VILLAGE.x, z: VILLAGE.z, radius: 34 }, maskFn: (x, z) => smoothstep(10, 14, Math.hypot(x, z - 120)) })
        );
    }
    progress(0.55, 'Erguendo as casas…');
    await nextFrame();

    // ─────────────── luz: halos, chamas, fontes ───────────────
    const glows = createGlows(360);
    const flames = createFlameKit();
    scene.add(glows.mesh);
    /** Fontes de luz dos lampiões: a cada quadro as mais próximas recebem as PointLights do tier. */
    const sources = [];
    const addSource = (x, y, z, color, intensity, range = 15) => {
        const s = { x, y, z, color: new THREE.Color(color), intensity, range, k: 0, d: 0 };
        sources.push(s);
        return s;
    };
    const pool = [];
    for (let i = 0; i < q.lights; i++) {
        const l = new THREE.PointLight(WARM, 0, 15, 1.8);
        scene.add(l);
        pool.push({ light: l, src: null });
    }

    const zones = ['aldeia', 'trilha', 'rio', 'arvore', 'alvorecer'].map((id) => new Zone(id));
    const [zA, zT, zR, zV, zD] = zones;
    for (const z of zones) z.heightAt = H;
    const arch = new Batch();
    const animated = []; // fn(dt, t) sempre ativos (lampiões, casas, roda)
    const npcs = [];

    /**
     * Registra um lampião: interativo + fonte de luz + halo + chama.
     * k (0..1) anima o acender:  k' = damp(k, aceso ? 1 : 0, 3)
     */
    function addLamp(zone, { x, z, lx = x, ly, lz = z, label, r = 1.9, color = WARM, power = 9, flameH = 0.11, onK = null, hint = true }) {
        const src = addSource(lx, ly, lz, color, power);
        const halo = glows.add({ x: lx, y: ly, z: lz, size: 2.6, color, intensity: 0, flicker: 0.3 });
        const flame = flames.make(flameH);
        flame.position.set(lx, ly - flameH * 0.5, lz);
        flame.visible = false;
        scene.add(flame);
        // lampião apagado: uma brasa fraca pulsa para ser achado no escuro
        const ember = hint ? glows.add({ x: lx, y: ly, z: lz, size: 0.5, color: 0xffc070, intensity: 0, flicker: 0.9 }) : null;
        const lamp = {
            x, z, r, kind: 'lamp', label, lit: false, done: false, k: 0, src,
            setLit(v, instant = false) {
                lamp.lit = lamp.done = v;
                if (instant) lamp.k = v ? 1 : 0;
                apply();
            }
        };
        function apply() {
            const e = lamp.k * lamp.k * (3 - 2 * lamp.k);
            src.k = e;
            halo.intensity = e * 0.3;
            halo.push();
            flame.visible = e > 0.02;
            flame.scale.set(flameH * 0.62 * e, flameH * e, flameH * 0.62 * e);
            if (ember) {
                ember.intensity = (1 - e) * 0.3;
                ember.push();
            }
            onK?.(e);
        }
        animated.push((dt) => {
            const target = lamp.lit ? 1 : 0;
            if (lamp.k === target) return;
            lamp.k = Math.abs(lamp.k - target) < 0.004 ? target : damp(lamp.k, target, 3, dt);
            apply();
        });
        apply();
        zone.lamps.push(lamp);
        zone.addInteract(lamp);
        return lamp;
    }

    /** Clona os materiais de vidro/bulbo de um modelo de lanterna e devolve fn(k) que os acende. */
    function litMaterials(model, gain = 2.2) {
        const list = [];
        model.traverse((o) => {
            if (!o.isMesh) return;
            o.castShadow = false;
            if (/glass|bulb|flame/i.test(o.material?.name || '')) {
                o.material = o.material.clone();
                o.material.emissive = new THREE.Color(0xff9838);
                o.material.emissiveIntensity = 0;
                list.push(o.material);
            }
        });
        return (e) => {
            for (const m of list) m.emissiveIntensity = e * gain;
        };
    }

    /** Lanterna de madeira pendurada num poste rústico (trilha; também a praça no tier low). */
    async function hangingLamp(zone, x, z, ry, label, seed, power = 8) {
        const hook = addLanternPost(arch, trs(x, H(x, z) - 0.25, z, 0, ry, 0), seed);
        const lan = await loadModel('wooden_lantern_01', { height: 0.46 });
        let onK = null;
        if (lan) {
            lan.position.set(hook.x, hook.y - 0.46, hook.z);
            lan.rotation.y = ry + 0.4;
            scene.add(lan);
            onK = litMaterials(lan);
        }
        zone.addCollider(x, z, 0.26, 3);
        return addLamp(zone, { x, z, lx: hook.x, ly: hook.y - 0.27, lz: hook.z, label, power, onK });
    }

    // ═══════════════ I — A Aldeia Apagada ═══════════════
    zA.bounds = { minX: -34, maxX: 34, minZ: 84, maxZ: 150 };
    zA.spawn = { x: 1.5, z: 140.5, yaw: Math.PI };
    zA.center.set(0, H(0, 120) + 2.2, 120);
    zA.overview.set(17, H(0, 120) + 9, 144);
    zA.progress.lampsNeeded = 4;
    zA.needTalk = true;

    const houses = [];
    /** Casa virada para a praça. `link` = índice do lampião que acende as janelas. */
    function house(x, z, o, link) {
        const ry = o.ry ?? Math.atan2(VILLAGE.x - x, VILLAGE.z - z);
        const y = Math.min(H(x, z), H(x + 2, z), H(x - 2, z), H(x, z + 2), H(x, z - 2)) - 0.05;
        const info = addHouse(arch, trs(x, y, z, 0, ry, 0), o);
        const mat = glassMaterial();
        if (info.glass) {
            const m = new THREE.Mesh(info.glass, mat);
            m.name = 'vidraças';
            scene.add(m);
        }
        const halos = info.windows.map((p) => glows.add({ x: p.x, y: p.y, z: p.z, size: 2.2, color: 0xffa050, intensity: 0, flicker: 0.12 }));
        let smoke = null;
        if (info.chimneyTop && q.props) {
            smoke = createParticles({
                count: 26, life: 7, origin: info.chimneyTop, spread: new THREE.Vector3(0.1, 0.05, 0.1), velocity: new THREE.Vector3(0.25, 0.9, 0.1),
                velocitySpread: new THREE.Vector3(0.12, 0.2, 0.12), turbulence: 0.7, size: [0.4, 2.6], color: 0x8a8fa0, opacity: 0
            });
            scene.add(smoke.mesh);
            animated.push((dt, t) => smoke.update(t));
        }
        const hs = { x, z, link, k: 0, base: o.ember ?? 0, mat, halos, smoke, target: 0 };
        houses.push(hs);
        zA.addBox(x, z, info.W / 2 + 0.25, info.D / 2 + 0.25, -ry, 6);
        if (o.chimney) zA.addBox(x + Math.cos(ry) * o.chimney * (info.W / 2 + 0.4), z - Math.sin(ry) * o.chimney * (info.W / 2 + 0.4), 0.6, 0.9, -ry, 8);
        return info;
    }
    const home = house(-11.5, 116.5, { W: 6.6, D: 5, roof: 'thatch', chimney: -1, seed: 1 }, 3);
    house(13, 111, { W: 6, D: 4.8, roof: 'tiles', wall: 'plasterB', chimney: 1, seed: 2, doorX: -0.9 }, 2);
    house(-14.5, 131, { W: 5.6, D: 4.6, roof: 'thatch', chimney: 1, seed: 3, doorX: 0.8, H: 2.3 }, 1);
    house(11, 132.5, { W: 7, D: 5.2, roof: 'tiles', chimney: -1, seed: 4, ember: 0.3, roofH: 2.7 }, 0); // padaria do Tomás
    house(-3.5, 101, { W: 5.4, D: 4.4, roof: 'thatch', wall: 'plasterB', chimney: 0, seed: 5, ry: 0.5, H: 2.3, windows: { front: 1, back: 1 } }, 3);

    const well = addWell(arch, trs(0, H(0, 120) - 0.02, 120, 0, 0.5, 0));
    zA.addCollider(0, 120, 1.25, 3.2);

    const lampSpots = [[6.2, 124.4], [-5.4, 125.8], [7.5, 114.8], [-6.8, 113.5]];
    const street = q.props ? await loadModel('street_lamp_01', { height: 3.5 }) : null;
    for (let i = 0; i < lampSpots.length; i++) {
        const [x, z] = lampSpots[i];
        const linkHouses = (e) => {
            for (const hs of houses) if (hs.link === i) hs.target = Math.max(hs.base, e);
        };
        if (street) {
            const m = i === 0 ? street : await loadModel('street_lamp_01', { height: 3.5 });
            m.position.set(x, H(x, z) - 0.03, z);
            m.rotation.y = Math.atan2(VILLAGE.x - x, VILLAGE.z - z);
            scene.add(m);
            const lit = litMaterials(m, 3);
            zA.addCollider(x, z, 0.24, 4);
            addLamp(zA, { x, z, ly: H(x, z) + 3.5 * 0.895, label: 'Acender o lampião', power: 11, flameH: 0.13, onK: (e) => { lit(e); linkHouses(e); } });
        } else {
            const lamp = await hangingLamp(zA, x, z, Math.atan2(VILLAGE.x - x, VILLAGE.z - z) - Math.PI / 2, 'Acender o lampião', 20 + i, 10);
            const prev = lamp.src;
            animated.push(() => linkHouses(prev.k));
        }
    }
    for (const hs of houses) hs.target = hs.base;
    animated.push((dt) => {
        for (const hs of houses) {
            if (Math.abs(hs.k - hs.target) < 0.002) continue;
            hs.k = damp(hs.k, hs.target, 2.2, dt);
            hs.mat.emissiveIntensity = hs.k * 2.4;
            for (const h of hs.halos) {
                h.intensity = hs.k * 0.12;
                h.push();
            }
            if (hs.smoke) hs.smoke.uniforms.uOpacity.value = hs.k * 0.22;
        }
    });

    // moradores
    function villager(opts, x, z, ry, mode = 'idle') {
        const hero = createHero({ detail: q.npcDetail, ...opts });
        hero.object.position.set(x, H(x, z), z);
        hero.object.rotation.y = ry;
        hero.object.userData.lanternCaster = true;
        scene.add(hero.object);
        const n = { hero, x, z, state: { mode }, mode, look: true, visible: true };
        npcs.push(n);
        return n;
    }
    const tomas = villager({ preset: 'peasant', apron: 0xe8e0cc, hat: 'cap', hatColor: 0xe8e2d4, topColor: 0x8a6a4a, fat: 0.35, beard: 'mustache' }, 4.2, 128.5, 3.2);
    zA.addCollider(4.2, 128.5, 0.5, 2);
    zA.addInteract({ x: 4.2, z: 128.5, r: 1.8, kind: 'talk', id: 'tomas', speaker: 'Tomás, o padeiro', lines: STORY.tomas, label: 'Falar com Tomás', done: false, npc: tomas });
    if (tier !== 'low') {
        const w = villager({ preset: 'peasantWoman' }, 14.6, 114.6, -1.2);
        const b = villager({ preset: 'villageBoy' }, -11, 127.2, 1.9);
        zA.addCollider(w.x, w.z, 0.45, 2);
        zA.addCollider(b.x, b.z, 0.4, 2);
        zA.resetFns.push(() => {
            w.mode = b.mode = 'idle';
        });
        zA.updateFns.push(() => {
            if (zA.lampsLit() >= 4) w.mode = b.mode = 'cheer';
        });
    }

    // cercas e muro
    const fence = (points, type = 'cerca', seed = 1) => scene.add(createFence({ terrain, points, type, seed }));
    fence([[-18, 112], [-19, 106], [-13, 103.5]], 'cerca', 1);
    fence([[17, 117], [21, 112], [19, 106]], 'cerca', 2);
    fence([[-20, 136], [-17, 141], [-9, 141.5]], 'cerca', 3);
    fence([[7, 141], [15, 140.5], [19.5, 135]], 'cerca', 4);
    fence([[3.2, 96], [4, 91]], 'muro', 5);
    fence([[-3.4, 96], [-3.6, 91]], 'muro', 6);

    // tralha de aldeia: barris, caixotes, cestos, balde
    const prop = (list) => list.map(([x, z, ry = 0, s = 1]) => ({ x, y: H(x, z) - 0.02, z, ry, s }));
    if (q.props) {
        const barrels = prop([[7.4, 130.2, 0.3], [8.2, 130.9, 1.2, 0.9], [-8.6, 119.6, 2], [10.4, 114.8, 0.5], [-11.6, 133.2, 1], [-6.6, 14.8, 0.4], [-5.9, 15.6, 2, 0.85]]);
        const crates = prop([[6.6, 131.4, 0.4], [-8.9, 121, 1.1], [15.3, 113.2, 2.2], [-5.2, 16.6, 0.7]]);
        jobs.push(
            instanceModel('wine_barrel_01', barrels, { height: 0.9, castShadow: false }).then((g) => g && scene.add(g)),
            instanceModel('wooden_crate_01', crates, { height: 0.42, castShadow: false }).then((g) => g && scene.add(g)),
            loadModel('wooden_bucket_01', { height: 0.34 }).then((g) => {
                if (!g) return;
                g.position.set(well.bucket.x + 0.75, H(0, 120) + 0.86, well.bucket.z + 0.2);
                scene.add(g);
            })
        );
        for (const b of barrels) (b.z > 60 ? zA : zT).addCollider(b.x, b.z, 0.4, 1);
    }

    // a carta: pergaminho que flutua à porta de casa
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xf2e6c4, roughness: 0.8, emissive: 0xffc878, emissiveIntensity: 0.5, side: THREE.DoubleSide });
    const keepsakeGeo = new THREE.PlaneGeometry(0.34, 0.24, 6, 1);
    {
        const p = keepsakeGeo.attributes.position;
        for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 9) * 0.02);
        keepsakeGeo.computeVertexNormals();
    }
    /** Lembrança: folha dourada que gira e sobe/desce 12 cm, com halo. */
    function addMemory(zone, x, z, id, label) {
        const mesh = new THREE.Mesh(keepsakeGeo, paperMat);
        const y = H(x, z) + 0.95;
        mesh.position.set(x, y, z);
        mesh.rotation.x = -0.5;
        scene.add(mesh);
        const halo = glows.add({ x, y, z, size: 1.3, color: 0xffd890, intensity: 0.5, flicker: 0.2 });
        const it = {
            x, z, r: 1.35, kind: 'memory', id, label, done: false,
            collect() {
                it.done = true;
                show(false);
            }
        };
        const show = (v) => {
            mesh.visible = v;
            halo.intensity = v ? 0.5 : 0;
            halo.push();
        };
        zone.addInteract(it);
        zone.resetFns.push((done) => show(!done));
        zone.updateFns.push((dt, t) => {
            if (it.done) return;
            mesh.position.y = y + Math.sin(t * 2.2) * 0.12;
            mesh.rotation.y = t * 0.9;
            halo.set(x, mesh.position.y, z).push();
        });
        return it;
    }
    addMemory(zA, home.door.x, home.door.z, 'carta', 'Ler a carta da Nara');

    /** Vaga-lumes que reabastecem a chama: pequeno enxame de 3 halos em órbita. */
    function addFireflies(zone, count, seed) {
        const r = seeded(seed);
        const b = zone.bounds;
        for (let i = 0; i < count; i++) {
            let x = 0;
            let z = 0;
            for (let t = 0; t < 30; t++) {
                x = lerp(b.minX + 4, b.maxX - 4, r());
                z = lerp(b.minZ + 4, b.maxZ - 4, r());
                if (!zone.blocked(x, z, 0.8)) break;
            }
            const y0 = 0.8 + r() * 0.7;
            const halos = [0, 1, 2].map(() => glows.add({ size: 0.42, color: 0xd6ff6a, intensity: 0, flicker: 0.8 }));
            const fly = {
                x, z, r: 1.1, kind: 'firefly', done: false, phase: r() * 6,
                collect() {
                    fly.done = true;
                    for (const h of halos) {
                        h.intensity = 0;
                        h.push();
                    }
                }
            };
            zone.fireflies.push(fly);
            zone.resetFns.push(() => {
                fly.done = false;
            });
            zone.updateFns.push((dt, t) => {
                if (fly.done) return;
                const gy = H(x, z) + y0;
                for (let j = 0; j < 3; j++) {
                    const a = t * (0.9 + j * 0.35) + fly.phase + j * 2.1;
                    halos[j].set(x + Math.cos(a) * 0.35, gy + Math.sin(a * 1.3 + j) * 0.22, z + Math.sin(a) * 0.35);
                    halos[j].intensity = 0.55 + 0.35 * Math.sin(t * 3 + j * 2 + fly.phase);
                    halos[j].push();
                }
            });
        }
    }

    /** Saída do capítulo: facho de luz; fraco enquanto trancado, forte quando liberado. */
    function addGoal(zone, x, z, label, color, r = 2.2) {
        const it = { x, z, r, kind: 'goal', label, done: false };
        zone.goal = it;
        zone.addInteract(it);
        const beacon = createBeacon(color, 8, 0.7);
        beacon.mesh.position.set(x, H(x, z) - 0.1, z);
        scene.add(beacon.mesh);
        zone.updateFns.push((dt) => {
            beacon.mesh.visible = true;
            beacon.uniforms.uOn.value = damp(beacon.uniforms.uOn.value, zone.readyToExit() ? 1 : 0.16, 3, dt);
        });
        zone.exitFn = () => {
            beacon.mesh.visible = false;
        };
        beacon.mesh.visible = false;
        return it;
    }
    addGoal(zA, 0.6, 89.5, 'Seguir para a floresta', 0x88aaff);

    // ═══════════════ II — A Trilha das Sombras ═══════════════
    zT.bounds = { minX: -24, maxX: 24, minZ: 12, maxZ: 83 };
    zT.spawn = { x: 2.6, z: 79, yaw: Math.PI };
    zT.center.set(0, H(0, 50) + 2, 50);
    zT.overview.set(9, H(3, 76) + 7, 92);
    zT.progress.lampsNeeded = 5;
    const roadPoint = (course, zWant, side) => {
        // ponto do caminho com z mais próximo de zWant, deslocado `side` m para o lado
        let best = 0;
        for (let i = 0; i < course.count; i++) if (Math.abs(course.zs[i] - zWant) < Math.abs(course.zs[best] - zWant)) best = i;
        const j = Math.min(course.count - 1, best + 1);
        const tx = course.xs[j] - course.xs[Math.max(0, j - 1)];
        const tz = course.zs[j] - course.zs[Math.max(0, j - 1)];
        const l = Math.hypot(tx, tz) || 1;
        return { x: course.xs[best] - (tz / l) * side, z: course.zs[best] + (tx / l) * side, ry: Math.atan2(-(tz / l) * -side, (tx / l) * -side) };
    };
    const trailLamps = [[69, 1.9], [59, -1.9], [48, 1.9], [38, -1.9], [27, 1.9]];
    for (let i = 0; i < trailLamps.length; i++) {
        const p = roadPoint(roadA, trailLamps[i][0], trailLamps[i][1]);
        // braço do poste aponta para o caminho
        const ry = Math.atan2(-(roadA.sample(p.x, p.z).z - p.z), roadA.sample(p.x, p.z).x - p.x);
        await hangingLamp(zT, p.x, p.z, ry, 'Acender a lanterna da trilha', 40 + i);
    }

    function addShadow(zone, x, z, waypoints, seed) {
        const body = createShadowBody({ size: 0.95, seed });
        body.object.visible = false;
        scene.add(body.object);
        const wisp = new ShadowWisp(body, x, z, waypoints);
        zone.shadows.push(wisp);
        zone.resetFns.push(() => wisp.reset());
        return wisp;
    }
    addShadow(zT, -8, 60, [{ x: -8, z: 60 }, { x: 6, z: 56 }, { x: -4, z: 50 }], 1);
    addShadow(zT, 7, 44, [{ x: 7, z: 44 }, { x: -6, z: 40 }, { x: 4, z: 34 }], 2);
    addShadow(zT, -5, 32, [{ x: -5, z: 32 }, { x: 5, z: 30 }, { x: 0, z: 38 }], 3);

    // moinho velho de pedra, com roda-d'água no rio
    const millY = Math.min(H(MILL.x, MILL.z), H(MILL.x, MILL.z - 3)) - 0.1;
    const mill = addHouse(arch, trs(MILL.x, millY, MILL.z, 0, 0, 0), { W: 7.4, D: 6, H: 3.2, roofH: 3.3, roof: 'slate', wall: 'slate', frame: false, chimney: 0, seed: 9, plinth: 0.3, windows: { front: 2, back: 0 } });
    const millGlass = glassMaterial();
    if (mill.glass) scene.add(new THREE.Mesh(mill.glass, millGlass));
    const wheel = new THREE.Mesh(wheelGeometry(2.35, 1.0), M.timber);
    wheel.castShadow = wheel.receiveShadow = true;
    const wheelY = water.levelAt(MILL.x, MILL.z - 4.4) + 1.75;
    wheel.position.set(MILL.x + 0.6, wheelY, MILL.z - 3.0 - 1.0);
    scene.add(wheel);
    animated.push((dt) => {
        wheel.rotation.z -= dt * 0.42;
    });
    for (const z of [zT, zR]) z.addBox(MILL.x, MILL.z - 0.6, 4.1, 4.4, 0, 8);
    addMemory(zT, -2.5, 22.5, 'moinho', 'Pegar o pão que Tomás deu');
    addGoal(zT, MILL.x + 0.2, MILL.z + 4.6, 'Passar pelo moinho', 0xffaa66, 2.4);
    addFireflies(zT, 10, 91);
    addFireflies(zA, 6, 42);

    // ═══════════════ III — O Rio dos Nomes ═══════════════
    zR.bounds = { minX: -20, maxX: 64, minZ: -14, maxZ: 27 };
    zR.spawn = { x: -1.5, z: 14.5, yaw: Math.PI / 2 };
    zR.center.set(24, H(24, 10) + 1.5, 6);
    zR.overview.set(-8, H(0, 16) + 8, 26);
    zR.progress.lampsNeeded = 3;
    zR.needFox = true;
    zR.river = river;
    zR.onBridge = (x, z) => Math.abs(x - BR.x) < BRIDGE.width / 2 - 0.25 && Math.abs(z - BR.z) < BRIDGE.length / 2 + 1;
    const bridgeBase = Math.max(H(BR.x, BR.z + BRIDGE.length / 2), H(BR.x, BR.z - BRIDGE.length / 2)) - 0.05;
    zR.heightAt = (x, z) => {
        if (zR.bridgeOpen && Math.abs(x - BR.x) < BRIDGE.width / 2 && Math.abs(z - BR.z) < BRIDGE.length / 2) {
            return Math.max(H(x, z), bridgeBase + bridgeDeckY(z - BR.z) + 0.06);
        }
        return H(x, z);
    };
    // ponte: nasce da luz das bóias (material com revelação ao longo do eixo)
    const revealU = { uReveal: { value: 0 }, uRevOrigin: { value: new THREE.Vector3(BR.x, 0, BR.z + BRIDGE.length / 2) }, uRevDir: { value: new THREE.Vector4(0, 0, -1, BRIDGE.length) } };
    const bMats = { timber: revealMaterial(M.timber.clone(), revealU), planks: revealMaterial(M.planks.clone(), revealU) };
    const bb = new Batch().merge(bridgeBatch(), trs(BR.x, bridgeBase, BR.z, 0, Math.PI / 2, 0));
    const bridge = bb.build(bMats, { name: 'ponte' });
    bridge.visible = false;
    scene.add(bridge);
    let bridgeT = 0;
    zR.revealBridge = () => {
        zR.bridgeOpen = true;
        bridge.visible = true;
        bridgeT = 0.0001;
    };
    animated.push((dt) => {
        if (bridgeT > 0 && bridgeT < 1.2) {
            bridgeT = Math.min(1.2, bridgeT + dt * 0.45);
            revealU.uReveal.value = bridgeT;
        }
    });
    zR.resetFns.push((done) => {
        bridge.visible = done;
        bridgeT = done ? 1.2 : 0;
        revealU.uReveal.value = bridgeT;
    });
    for (const sz of [-1, 1]) {
        for (const sx of [-1, 1]) for (const z of [zR, zV]) z.addCollider(BR.x + sx * (BRIDGE.width / 2 + 0.1), BR.z + sz * (BRIDGE.length / 2 - 0.3), 0.3, 2);
    }

    // bóias: barril flutuante com lamparina
    const buoyX = [10, 24, 38];
    for (let i = 0; i < buoyX.length; i++) {
        const s = river.sample(buoyX[i], 3);
        const bx = s.x;
        const bz = s.z + 1.5;
        const wy = water.levelAt(bx, bz);
        const g = new THREE.Group();
        g.position.set(bx, wy, bz);
        scene.add(g);
        const [barrel, lampM] = await Promise.all([loadModel('wine_barrel_01', { height: 0.7 }), loadModel('vintage_oil_lamp', { height: 0.5 })]);
        let onK = null;
        if (barrel) {
            barrel.position.y = -0.42;
            g.add(barrel);
        }
        if (lampM) {
            lampM.position.y = 0.28;
            g.add(lampM);
            onK = litMaterials(lampM, 2.5);
        }
        const lamp = addLamp(zR, { x: bx, z: bz, ly: wy + 0.62, label: 'Acender a bóia', r: 3.1, power: 8, color: 0xffb060, onK });
        lamp.x = bx;
        lamp.z = bz + 1.9; // interage da margem
        animated.push((dt, t) => {
            g.position.y = wy + Math.sin(t * 1.3 + i * 2) * 0.05;
            g.rotation.set(Math.sin(t * 0.9 + i) * 0.07, 0, Math.cos(t * 1.1 + i * 1.7) * 0.07);
        });
    }

    // Pingo preso nas sarças
    const CAGE = { x: 30, z: 17.5 };
    const brambleMat = new THREE.MeshStandardMaterial({ color: 0x2a1a16, roughness: 0.9, emissive: 0xff5a10, emissiveIntensity: 0 });
    const cageMesh = new THREE.Mesh(brambleGeometry(1.1, 7), brambleMat);
    cageMesh.position.set(CAGE.x, H(CAGE.x, CAGE.z), CAGE.z);
    cageMesh.castShadow = true;
    scene.add(cageMesh);
    const cage = { x: CAGE.x, z: CAGE.z, r: 1.9, kind: 'cage', label: 'Libertar Pingo (pulse a lanterna perto)', done: false, burnT: 0, burn() { cage.done = true; cage.burnT = 0.001; } };
    zR.addInteract(cage);
    const cageCol = { x: CAGE.x, z: CAGE.z, r: 1.0, h: 1.4 };
    zR.colliders.push(cageCol);
    animated.push((dt) => {
        // sarças queimam: brasa sobe e o domo encolhe em 1,2 s
        if (cage.burnT > 0 && cage.burnT < 1) {
            cage.burnT = Math.min(1, cage.burnT + dt / 1.2);
            brambleMat.emissiveIntensity = Math.sin(cage.burnT * Math.PI) * 6;
            cageMesh.scale.setScalar(1 - cage.burnT * cage.burnT);
            if (cage.burnT >= 1) cageMesh.visible = false;
            cageCol.r = 0;
        }
    });
    const mkFox = () => {
        const c = createCreature('fox', { detail: tier === 'low' ? 1 : 2, seed: 5 });
        c.object.userData.lanternCaster = true;
        scene.add(c.object);
        return c;
    };
    const fox = mkFox();
    zR.fox = new FoxCompanion(fox, CAGE.x, CAGE.z);
    zR.resetFns.push((done) => {
        cage.burnT = 0;
        cage.done = done;
        cageMesh.visible = !done;
        cageMesh.scale.setScalar(1);
        brambleMat.emissiveIntensity = 0;
        cageCol.r = done ? 0 : 1.0;
        zR.fox.reset(false);
    });
    addShadow(zR, 26, 22, [{ x: 26, z: 22 }, { x: 40, z: 18 }, { x: 14, z: 21 }], 4);
    addMemory(zR, 17, 10.6, 'canto', 'Ouvir a canção do rio');
    addGoal(zR, BR.x - 0.5, BR.z - BRIDGE.length / 2 - 3.2, 'Atravessar para a outra margem', 0xa0e8ff);
    addFireflies(zR, 8, 17);

    // ═══════════════ IV — A Árvore Oca ═══════════════
    zV.bounds = { minX: TREE.x - 25, maxX: TREE.x + 25, minZ: TREE.z - 25, maxZ: TREE.z + 25 };
    zV.spawn = { x: TREE.x + 2.5, z: TREE.z + 19.5, yaw: Math.PI };
    zV.center.set(TREE.x, H(TREE.x, TREE.z) + 4, TREE.z);
    zV.overview.set(TREE.x + 13, H(TREE.x, TREE.z) + 10, TREE.z + 24);
    zV.needCrystals = true;
    const barkMat = M.bark;
    const roots = new THREE.Mesh(buttressRoots(1.9, 10, 3, (x, z) => H(TREE.x + x, TREE.z + z) - H(TREE.x, TREE.z)), barkMat);
    roots.position.set(TREE.x, H(TREE.x, TREE.z), TREE.z);
    roots.castShadow = roots.receiveShadow = true;
    scene.add(roots);
    zV.addCollider(TREE.x, TREE.z, 2.5);
    // o oco: ogiva de raízes na face sul, miolo que acende com as raízes
    const hollow = new THREE.Group();
    hollow.position.set(TREE.x, H(TREE.x, TREE.z + 2.3) - 0.1, TREE.z + 2.25);
    const archMesh = new THREE.Mesh(hollowArch(1.5, 2.6), barkMat);
    archMesh.castShadow = true;
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.012, 0.03), toneMapped: false });
    const coreMesh = new THREE.Mesh(hollowCore(1.7, 2.7), coreMat);
    coreMesh.position.z = -0.12;
    hollow.add(archMesh, coreMesh);
    scene.add(hollow);
    const hollowSrc = addSource(TREE.x, H(TREE.x, TREE.z) + 1.6, TREE.z + 3.4, 0xffb070, 10, 14);
    const hollowHalo = glows.add({ x: TREE.x, y: H(TREE.x, TREE.z) + 1.5, z: TREE.z + 2.6, size: 5, color: 0xffb070, intensity: 0, flicker: 0.15 });
    let hollowK = 0;

    const rootSpots = [{ x: -7.5, z: 4.2, i: 0 }, { x: 7.2, z: 3.8, i: 1 }, { x: 6.4, z: -6.5, i: 2 }, { x: -6.8, z: -5.8, i: 3 }];
    const crystals = [];
    const bulbGeo = new THREE.SphereGeometry(0.2, 20, 14);
    bulbGeo.scale(0.85, 1.25, 0.85);
    for (const s of rootSpots) {
        const x = TREE.x + s.x;
        const z = TREE.z + s.z;
        const cradle = rootCradle(s.i + 2);
        const g = new THREE.Group();
        g.position.set(x, H(x, z), z);
        g.rotation.y = s.i * 1.7;
        const rm = new THREE.Mesh(cradle.geometry, barkMat);
        rm.castShadow = rm.receiveShadow = true;
        const col = new THREE.Color(ROOT_COLORS[s.i]);
        const bm = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.25, emissive: col, emissiveIntensity: 0.15 });
        const bulb = new THREE.Mesh(bulbGeo, bm);
        bulb.position.copy(cradle.bulb);
        g.add(rm, bulb);
        scene.add(g);
        g.updateMatrixWorld(true);
        const wp = bulb.getWorldPosition(new THREE.Vector3());
        const src = addSource(wp.x, wp.y + 0.2, wp.z, ROOT_COLORS[s.i], 9, 13);
        const halo = glows.add({ x: wp.x, y: wp.y, z: wp.z, size: 2.4, color: ROOT_COLORS[s.i], intensity: 0.12, flicker: 0.15 });
        const it = {
            x, z, r: 1.9, kind: 'crystal', index: s.i, label: `Acender a raiz ${['dourada', 'azul', 'rosa', 'verde'][s.i]}`, done: false, lit: false, k: 0,
            setLit(v) {
                it.lit = it.done = v;
            }
        };
        animated.push((dt) => {
            const target = it.lit ? 1 : 0;
            if (Math.abs(it.k - target) < 0.003) return;
            it.k = damp(it.k, target, 4, dt);
            bm.emissiveIntensity = 0.15 + it.k * 3.2;
            bulb.scale.setScalar(1 + it.k * 0.25);
            src.k = it.k;
            halo.intensity = 0.12 + it.k * 0.8;
            halo.push();
        });
        crystals.push(it);
        zV.addInteract(it);
        zV.addCollider(x, z, 0.5, 1.2);
    }
    zV.lightCrystal = (it) => it.setLit(true);
    zV.resetCrystals = () => {
        zV.progress.crystals = [];
        for (const c of crystals) c.setLit(false);
    };
    zV.resetFns.push((done) => {
        for (const c of crystals) c.setLit(done);
    });
    animated.push((dt) => {
        const target = zV.progress.crystals.length / 4;
        if (Math.abs(hollowK - target) < 0.002) return;
        hollowK = damp(hollowK, target, 2.5, dt);
        const e = hollowK * hollowK;
        coreMat.color.setRGB(0.02 + e * 5, 0.012 + e * 2.6, 0.03 + e * 0.8);
        hollowSrc.k = e;
        hollowHalo.intensity = e * 0.9;
        hollowHalo.push();
    });
    const nightBody = createShadowBody({ size: 2.1, seed: 9, rim: 0x8a5ad0, eyeColor: [2.8, 0.3, 0.5] });
    nightBody.object.visible = false;
    scene.add(nightBody.object);
    zV.night = new NightWraith(nightBody, TREE.x, TREE.z, 11);
    zV.resetFns.push(() => zV.night.reset());
    addMemory(zV, TREE.x + 2.6, TREE.z + 5.2, 'xale', 'Pegar o xale da Nara');
    addGoal(zV, TREE.x, TREE.z + 3.5, 'Entrar no oco da árvore', 0xff88cc, 1.9);
    addFireflies(zV, 12, 5);

    // ═══════════════ V — O Primeiro Sol ═══════════════
    zD.bounds = { minX: -30, maxX: 30, minZ: -160, maxZ: -98 };
    zD.spawn = { x: 3, z: -106, yaw: Math.PI };
    zD.center.set(HILL.x, H(HILL.x, HILL.z) + 1.5, HILL.z);
    zD.overview.set(14, H(HILL.x, HILL.z) + 4, -108);
    zD.needPlace = true;
    const stoneY = H(HILL.x, HILL.z);
    // Pedra da Aurora: bloco de pedra arredondado, de topo plano (a lanterna assenta nele)
    const stoneGeo = new THREE.IcosahedronGeometry(1, 4);
    {
        const p = stoneGeo.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i);
            const y = p.getY(i);
            const z = p.getZ(i);
            const n = 1 + (fbm2(x * 1.7 + y * 1.3 + 5, z * 1.7 - y * 0.9, 3) - 0.5) * 0.5;
            p.setXYZ(i, x * 1.3 * n, Math.min(0.62, y * 0.85 * n), z * 1.05 * n);
        }
        stoneGeo.computeVertexNormals();
        applyWorldUV(stoneGeo, 1.6);
    }
    const stoneMesh = new THREE.Mesh(stoneGeo, M.mossy);
    stoneMesh.position.set(HILL.x, stoneY + 0.2, HILL.z);
    stoneMesh.rotation.y = 0.7;
    stoneMesh.castShadow = stoneMesh.receiveShadow = true;
    scene.add(stoneMesh);
    const stoneTop = new THREE.Vector3(HILL.x, stoneY + 0.82, HILL.z);
    // anel de runas douradas no chão
    const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.8, 0.3), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const runes = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.5, 48), runeMat);
    runes.rotation.x = -Math.PI / 2;
    runes.position.set(HILL.x, stoneY + 0.12, HILL.z);
    scene.add(runes);
    const stoneSrc = addSource(HILL.x, stoneY + 1.5, HILL.z, 0xffc070, 16, 22);
    const stoneHalo = glows.add({ x: HILL.x, y: stoneY + 1.4, z: HILL.z, size: 3.6, color: 0xffc070, intensity: 0, flicker: 0.2 });
    zD.addCollider(HILL.x, HILL.z, 1.5, 1.0);
    zD.addInteract({ x: HILL.x, z: HILL.z, r: 2.4, kind: 'place', label: 'Colocar a lanterna na Pedra da Aurora', done: false });
    zD.stoneTop = stoneTop;
    const nara = villager({ preset: 'elder', sex: 'f', beard: 'none', hairStyle: 'bun', hair: 0xe8e6e0, top: 'dress', sleeves: 'long', topColor: 0x6a5a7a, bottom: 'none', apron: 0xd8ceb8, cape: 'short', capeColor: 0x7a3a34, mantle: true, hat: 'scarf', hatColor: 0x8a4a3c, detail: tier === 'low' ? 1 : 2 }, HILL.x - 2.4, HILL.z - 1.4, 1.0, 'talk');
    nara.hero.object.visible = false;
    nara.visible = false;
    const naraHalo = glows.add({ x: nara.x, y: H(nara.x, nara.z) + 1.1, z: nara.z, size: 2.6, color: 0xffe0a8, intensity: 0, flicker: 0.1 });
    zD.showNara = () => {
        nara.visible = true;
        nara.hero.object.visible = true;
        naraHalo.intensity = 0.2;
        naraHalo.push();
    };
    zD.setStone = (kk) => {
        stoneSrc.k = kk;
        stoneHalo.intensity = kk * 0.4;
        stoneHalo.push();
        runeMat.opacity = 0.25 + kk * 0.75;
    };
    zD.resetFns.push(() => {
        nara.visible = false;
        nara.hero.object.visible = false;
        naraHalo.intensity = 0;
        naraHalo.push();
        zD.setStone(0);
    });
    addMemory(zD, 4.5, -122, 'sol', 'Uma última lembrança');
    addFireflies(zD, 14, 3);
    // Pingo acompanha Clara até a colina (mesma criatura, outro ponto de partida)
    zD.fox = new FoxCompanion(fox, 1.5, -104);
    zD.resetFns.push(() => zD.fox.reset(true));

    // ─────────────── arquitetura num lote só ───────────────
    // o lote é uma malha só por material: na sombra em cubo da lanterna ele sairia inteiro em cada
    // uma das 6 faces, então fica fora dela (só personagens e a raposa projetam sombra da lanterna)
    const archGroup = arch.build(M, { name: 'vale' });
    scene.add(archGroup);
    progress(0.8, 'Soltando os vaga-lumes…');
    await nextFrame();

    // colisores de troncos em cada zona
    const trunkR = { carvalho: 0.6, pinheiro: 0.38, betula: 0.24, salgueiro: 0.6, morta: 0.45 };
    for (const kit of forest.kits) {
        for (const t of kit.trees || []) {
            for (const zn of zones) {
                const b = zn.bounds;
                if (t.pl.x < b.minX - 2 || t.pl.x > b.maxX + 2 || t.pl.z < b.minZ - 2 || t.pl.z > b.maxZ + 2) continue;
                zn.addCollider(t.pl.x, t.pl.z, (trunkR[kit.species] || 0.45) * t.s, 2.6);
            }
        }
    }

    // vaga-lumes de ambiente: voltam conforme os lampiões acendem
    const motes = createMotes({ count: q.motes, box: [44, 5, 44], color: 0xd0ff70, size: 0.075, intensity: 3.2 });
    scene.add(motes.mesh);
    // brasas douradas do amanhecer
    const embers = createMotes({ count: q.motes, box: [40, 9, 40], color: 0xffc060, size: 0.06, rise: 0.5, blink: 0.4, intensity: 4 });
    embers.uniforms.uAmount.value = 0;
    scene.add(embers.mesh);

    await Promise.all(jobs);

    const tramplers = [{ x: 0, y: 0, z: 0, radius: 0.8 }, { x: 0, y: 0, z: 0, radius: 0.6 }];
    const order = [];
    const look = new THREE.Vector3();
    let active = zA;
    let poolTimer = 0;

    const valley = {
        terrain, zones, river, water, forest, grass, glows, flames, heavy, npcs, motes, embers, sources,
        bridgeAt: BR, mill: MILL, stoneTop,
        get active() { return active; },

        /** Entra num capítulo: os anteriores ficam vencidos (acesos), este e os seguintes reiniciam. */
        enter(index) {
            zones.forEach((z, i) => {
                z.reset(i < index);
                z.exitFn?.();
                for (const s of z.shadows) s.group.visible = i === index;
                if (z.night) z.night.group.visible = i === index;
            });
            active = zones[index];
            fox.object.visible = index === 2 || index === 4;
            if (index === 4) zD.fox.free();
            embers.uniforms.uAmount.value = 0;
            valley.setDawn(0);
            return active;
        },

        /**
         * Amanhecer (k 0..1): as árvores distantes viram silhueta contra o sol — o impostor é
         * escurecido e esquentado (cor × ~0,3) e a troca malha → impostor recua 3,4× (só durante o clímax: custa triângulos).
         */
        setDawn(k) {
            for (const kit of forest.kits) {
                if (!kit.set) continue;
                if (kit.baseLod == null) kit.baseLod = kit.set.lod;
                kit.set.lod = kit.baseLod * (1 + k * 2.4);
                const m = kit.impostor?.material;
                if (m) m.color.setRGB(lerp(1, 0.34, k), lerp(1, 0.27, k), lerp(1, 0.24, k));
            }
        },

        /** Só cenário (menu): nenhuma sombra visível. */
        calm() {
            for (const z of zones) {
                for (const s of z.shadows) s.group.visible = false;
                if (z.night) z.night.group.visible = false;
                z.exitFn?.();
            }
        },

        update(dt, t, player, camera) {
            FX_TIME.value = t;
            terrain.update(camera);
            tramplers[0].x = player.x;
            tramplers[0].y = player.y;
            tramplers[0].z = player.z;
            if (active.fox) {
                tramplers[1].x = active.fox.x;
                tramplers[1].z = active.fox.z;
                tramplers[1].y = H(active.fox.x, active.fox.z);
            }
            grass.update(camera, dt, tramplers);
            forest.update(camera);
            giant.update(camera);
            for (const g of scatterGroups) g.userData.update?.(camera);
            water.update(dt);
            for (const fn of animated) fn(dt, t);
            for (const fn of active.updateFns) fn(dt, t);

            // moradores: animam só perto da câmera e olham para Clara
            for (const n of npcs) {
                if (!n.visible) continue;
                const d = Math.hypot(n.x - camera.position.x, n.z - camera.position.z);
                if (d > 55) continue;
                n.state.mode = n.mode;
                const pd = Math.hypot(n.x - player.x, n.z - player.z);
                n.hero.lookAt(n.look && pd < 9 ? look.set(player.x, player.y + 1.05, player.z) : null);
                n.hero.update(dt, n.state);
            }

            // reparte as PointLights entre as fontes acesas mais próximas (a cada 0,2 s)
            poolTimer -= dt;
            if (poolTimer <= 0) {
                poolTimer = 0.2;
                order.length = 0;
                for (const s of sources) {
                    if (s.k < 0.01) continue;
                    s.d = Math.hypot(s.x - player.x, s.z - player.z);
                    order.push(s);
                }
                order.sort((a, b) => a.d - b.d);
                // distância da primeira fonte que ficou de fora: quem chega perto dela já vai apagando
                const cut = order.length > pool.length ? order[pool.length].d : Infinity;
                for (const slot of pool) {
                    if (slot.src && order.indexOf(slot.src) >= pool.length) slot.src = null;
                    if (slot.src && order.indexOf(slot.src) < 0) slot.src = null;
                }
                for (let i = 0; i < Math.min(pool.length, order.length); i++) {
                    const s = order[i];
                    if (pool.some((p) => p.src === s)) continue;
                    const free = pool.find((p) => !p.src);
                    if (free) free.src = s;
                }
                for (const slot of pool) slot.fade = !slot.src ? 0 : cut === Infinity ? 1 : 1 - smoothstep(cut * 0.72, cut, slot.src.d);
            }
            for (const slot of pool) {
                const s = slot.src;
                if (!s) {
                    slot.light.intensity = 0;
                    continue;
                }
                slot.light.position.set(s.x, s.y, s.z);
                slot.light.color.copy(s.color);
                slot.light.distance = s.range;
                slot.light.intensity = s.intensity * s.k * slot.fade * (1 + 0.05 * Math.sin(t * 15 + s.x));
            }
            glows.update();
            motes.uniforms.uCenter.value.set(camera.position.x, player.y + 1.6, camera.position.z);
            embers.uniforms.uCenter.value.set(camera.position.x, player.y + 3.5, camera.position.z);
        }
    };
    return valley;
}
