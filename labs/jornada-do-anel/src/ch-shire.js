/**
 * I — O Condado. Colinas verdes ao fim da tarde, tocas de porta redonda
 * escavadas no relevo, a grande árvore da festa com lanternas, riacho com
 * ponte de pedra, hortas, cercas e aldeões.
 *
 * Objetivo: pegar o Anel diante da toca de porta verde (colina mais alta).
 */

import * as THREE from 'three';
import { fbm2, smoothstep, lerp, seeded } from '../../shared/gfx/core.js';
import {
    createCourse, createTerrain, createGrass, createForest, createWater, createPath, createFence, scatter, scatterModel
} from '../../shared/gfx/terrain.js';
import { ChapterWorld, own, makeRing, lightShaft, makePage, halo, emitter, addAmbient } from './world.js?v=32';
import { Batch, trs, block, turned, stoneBridge, addBurrow, addTent, TAU } from './build.js?v=32';
import { makeVillager, makeWizard, Extra, Critter, createCreature } from './actors.js?v=32';

/** Tocas: centro da fachada (x, z), direção para onde a porta olha e cor da porta. */
const MAIN_DEF = { x: -21.5, z: -6.5, face: Math.atan2(8, 7), door: 0x3f7f3a, H: 4.4, R: 10.5, w: 6.8 };
const BURROWS = [
    MAIN_DEF,
    { x: -33, z: 19, door: 0xa8452f },
    { x: -5, z: -31, door: 0x2f5a8a },
    { x: 23, z: -23, door: 0xc8962a },
    { x: 39, z: 3, door: 0x6a3a6a },
    { x: -45, z: -3, door: 0x8a6a2a },
    { x: 43, z: 27, door: 0x2f7a7a },
    { x: -15, z: 25, door: 0x9a3a4a },
    { x: 7, z: -49, door: 0x4a6a2f }
].map((b, i) => ({
    H: 3.3, R: 8.6, w: 6.2, face: Math.atan2(-b.x, -b.z) + Math.sin(i * 2.3) * 0.35, ...b
}));
const MAIN = BURROWS[0];

export function buildShire(ctx) {
    const world = new ChapterWorld(ctx);
    const { stage, tier } = ctx;
    const q = world.q;
    const low = world.low;
    world.bounds = { minX: -62, maxX: 62, minZ: -58, maxZ: 60 };
    world.spawn = { x: 17, z: 27, yaw: Math.atan2(-17, -27) };
    world.overview.set(30, 13, 34);
    world.overviewLook.set(-2, 3, -2);

    // ---------- traçados ----------
    const stream = createCourse([[-118, 54], [-74, 47], [-38, 41], [-6, 45], [22, 42.5], [52, 48], [84, 44], [118, 51]], { width: 3.2 });
    const road = createCourse([[27, 84], [24, 56], [21.6, 42.5], [17, 27], [10, 12], [-2, 6.5], [-12, 1], [-17.6, -3]], { width: 2.5 });

    // ---------- relevo ----------
    const hills = (x, z) => (fbm2(x * 0.0125 + 4, z * 0.0125 + 9, 4) - 0.5) * 17 + (fbm2(x * 0.05 + 2, z * 0.05, 3) - 0.5) * 1.5;
    const bedHi = hills(stream.xs[0], stream.zs[0]) - 1;
    const bedLo = bedHi - 5;
    const rolling = (x, z) => {
        let h = hills(x, z);
        // campo da festa: aplaina em volta da árvore
        h = lerp(h, lerp(hills(0, 0), h, 0.25), 1 - smoothstep(12, 26, Math.hypot(x, z)));
        // vale do riacho: leito sempre descendo de oeste para leste
        const s = stream.sample(x, z);
        const bed = lerp(bedHi, bedLo, s.t);
        h = lerp(h, bed + Math.min(s.d * 0.1, 2.2), 1 - smoothstep(6, 30, s.d));
        return h;
    };
    // base de cada toca (altura da soleira) calculada uma vez
    for (const b of BURROWS) {
        b.sin = Math.sin(b.face);
        b.cos = Math.cos(b.face);
        b.y = rolling(b.x + b.sin * 1.5, b.z + b.cos * 1.5);
    }
    /**
     * Morro da toca. Em coordenadas locais da fachada (lx lateral, lz para fora):
     *   pátio:   h ← lerp(h, y_soleira, 1 − smoothstep(2,5; 5,5, |p − (0; 1,6)|))
     *   morro:   + H · (1 − smoothstep(0,22·R, R, |p − (0; −3,4)|)) · corte
     *   corte:   1 − smoothstep(−0,9; 0, lz + 0,9·max(0, |lx| − w/2))   (parede vertical atrás da fachada)
     */
    const heightFn = (x, z) => {
        let h = rolling(x, z);
        for (let i = 0; i < BURROWS.length; i++) {
            const b = BURROWS[i];
            const dx = x - b.x;
            const dz = z - b.z;
            if (dx * dx + dz * dz > (b.R + 6) * (b.R + 6)) continue;
            const lx = dx * b.cos - dz * b.sin;
            const lz = dx * b.sin + dz * b.cos;
            h = lerp(h, b.y, 1 - smoothstep(2.5, 5.5, Math.hypot(lx, lz - 1.6)));
            const d = Math.hypot(lx, lz + 3.4);
            const cut = 1 - smoothstep(-0.9, 0, lz + 0.9 * Math.max(0, Math.abs(lx) - b.w * 0.5));
            h += b.H * (1 - smoothstep(0.22 * b.R, b.R, d)) * cut;
        }
        h = stream.carve(x, z, h, { depth: 1.15, width: 3, bank: 3.2 });
        h = road.carve(x, z, h, { depth: 0.12, width: 2.2, bank: 2 });
        return h;
    };

    const terrain = createTerrain({ size: 250, heightFn, tier, segments: low ? 160 : tier === 'high' ? 320 : 256 });
    world.terrain = terrain;
    world.ground = terrain.heightAt;
    world.group.add(terrain.object);

    createPath({ terrain, course: road });
    // trilhas de cada porta até a estrada / o campo
    for (const b of BURROWS) {
        const fx = b.x + b.sin * 1.2;
        const fz = b.z + b.cos * 1.2;
        const tx = b === MAIN ? -17.6 : b.x * 0.42;
        const tz = b === MAIN ? -3 : b.z * 0.42;
        createPath({ terrain, points: [[fx, fz], [lerp(fx, tx, 0.5) + b.cos * 1.5, lerp(fz, tz, 0.5) - b.sin * 1.5], [tx, tz]], width: 1.1, edge: 0.5 });
    }
    // hortas: canteiros de terra ao lado de algumas tocas
    const gardens = BURROWS.slice(0, 6).map((b, i) => {
        const side = i % 2 ? 1 : -1;
        return { x: b.x + b.cos * side * 6.2 + b.sin * 3.4, z: b.z - b.sin * side * 6.2 + b.cos * 3.4, ry: b.face, w: 3.6, d: 2.8 };
    });
    for (const g of gardens) {
        const c = Math.cos(g.ry);
        const s = Math.sin(g.ry);
        terrain.paint({ minX: g.x - 5, maxX: g.x + 5, minZ: g.z - 5, maxZ: g.z + 5 }, (x, z, h, slope, w) => {
            const lx = (x - g.x) * c - (z - g.z) * s;
            const lz = (x - g.x) * s + (z - g.z) * c;
            const k = (1 - smoothstep(g.w * 0.5 - 0.2, g.w * 0.5 + 0.3, Math.abs(lx))) * (1 - smoothstep(g.d * 0.5 - 0.2, g.d * 0.5 + 0.3, Math.abs(lz)));
            if (k <= 0) return w;
            // leiras: faixas de terra revolvida
            w[0] = Math.max(w[0], k);
            w[2] *= 1 - k;
            return w;
        });
    }
    const water = createWater({ terrain, river: stream, depth: 0.5, shallow: 0x6a8a6a, deep: 0x1f4440, flow: 0.8 });
    world.waters.push(water);
    world.group.add(water.object);

    // ---------- alvenaria ----------
    const batch = new Batch();
    for (const b of BURROWS) {
        const M = trs(b.x, b.y, b.z, b.face);
        addBurrow(batch, M, { door: b.door, width: b.w, height: b === MAIN ? 3.2 : 2.9, chimneyY: b.H });
        // maciço de pedra atrás do arco (fecha a fresta entre a fachada e o morro)
        batch.add('mossStone', turned([[b.w * 0.5, -0.4], [b.w * 0.49, 0.9], [b.w * 0.36, 2.0], [b.w * 0.16, 2.6], [0.001, 2.75]], 20),
            trs(b.x - b.sin * 1.75, b.y, b.z - b.cos * 1.75, b.face, [1, b === MAIN ? 1.1 : 1, 0.42]), 0xcfd0bc, 1.4);
        world.addWall(b.x - b.cos * b.w * 0.5, b.z + b.sin * b.w * 0.5, b.x + b.cos * b.w * 0.5, b.z - b.sin * b.w * 0.5, 0.55, { block: true, top: 3 });
        world.addCollider(b.x - b.sin * 3.2, b.z - b.cos * 3.2, 2.6, { top: 4 });
    }

    // ponte de pedra onde a estrada cruza o riacho
    const BR = { x: 21.6, z: 42.6, yaw: Math.atan2(24 - 17, 56 - 27), len: 11.5, w: 3.3 };
    const bridge = stoneBridge({ length: BR.len, width: BR.w, rise: 0.75, arches: 1, depth: 2.6, parapet: 0.7 });
    const bs = Math.sin(BR.yaw);
    const bc = Math.cos(BR.yaw);
    const end = (k) => terrain.heightAt(BR.x + bs * BR.len * 0.5 * k, BR.z + bc * BR.len * 0.5 * k);
    BR.y = Math.max(end(-1), end(1)) + 0.12;
    const BM = trs(BR.x, BR.y, BR.z, BR.yaw);
    for (const [key, g] of bridge.parts) batch.add(key, g, BM, 0xf0eadc, 1.5);
    world.decks.push((x, z) => {
        const dx = x - BR.x;
        const dz = z - BR.z;
        const lx = dx * bc - dz * bs;
        const lz = dx * bs + dz * bc;
        if (Math.abs(lx) > BR.w * 0.5 || Math.abs(lz) > bridge.half + 1.2) return -Infinity;
        // rampa curta nas cabeceiras para emendar com o caminho
        const zz = Math.min(Math.abs(lz), bridge.half);
        return BR.y + bridge.deck(zz) - Math.max(0, Math.abs(lz) - bridge.half) * 0.25;
    });
    for (const sx of [-1, 1]) {
        const ox = bc * sx * (BR.w * 0.5 - 0.1);
        const oz = -bs * sx * (BR.w * 0.5 - 0.1);
        world.addWall(BR.x + ox - bs * bridge.half, BR.z + oz - bc * bridge.half, BR.x + ox + bs * bridge.half, BR.z + oz + bc * bridge.half, 0.22, { top: 1.2 });
    }

    // ---------- campo da festa ----------
    const fy = (x, z) => terrain.heightAt(x, z);
    const tents = [{ x: -9, z: 9, c: 0xe9dcb4, s: 0xb8473a }, { x: 9.5, z: -4.5, c: 0xdfe4d0, s: 0x3f6a8a }];
    for (const t of tents) {
        addTent(batch, trs(t.x, fy(t.x, t.z), t.z, 0.4), { color: t.c, stripe: t.s });
        world.addCollider(t.x, t.z, 0.25, { top: 4 });
    }
    // mastros e varais de lanternas em volta da árvore
    const POLES = 7;
    const lanternGeo = turned([[0.02, 0], [0.085, 0.03], [0.11, 0.11], [0.085, 0.2], [0.03, 0.23]], 10);
    const capGeo = turned([[0.04, 0.22], [0.05, 0.25], [0.012, 0.28]], 8);
    const lanternPts = [];
    for (let i = 0; i < POLES; i++) {
        const a = (i / POLES) * TAU + 0.3;
        const r = 9.2 + (i % 2) * 1.6;
        const px = Math.cos(a) * r;
        const pz = Math.sin(a) * r;
        const py = fy(px, pz);
        batch.add('wood', turned([[0.075, 0], [0.06, 1.2], [0.05, 3.5], [0.075, 3.56], [0.03, 3.72], [0.001, 3.78]], 8), trs(px, py - 0.2, pz, 0, 1, 0.03 * Math.sin(i * 3)), 0xd2b890, 0.7);
        world.addCollider(px, pz, 0.14, { top: 3.6 });
        // corda com flecha: y(u) = lerp(y0, y1, u) − f·4u(1−u)
        const y0 = fy(0, 0) + 6.4;
        const y1 = py + 3.35;
        const pts = [];
        for (let k = 0; k <= 10; k++) {
            const u = k / 10;
            pts.push(new THREE.Vector3(lerp(Math.cos(a) * 1.1, px, u), lerp(y0, y1, u) - 1.5 * 4 * u * (1 - u), lerp(Math.sin(a) * 1.1, pz, u)));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        batch.add('woodDark', new THREE.TubeGeometry(curve, 20, 0.012, 4, false), null, 0x6a5a48, 0.5);
        const n = low ? 4 : 6;
        for (let k = 1; k <= n; k++) {
            const p = curve.getPoint(k / (n + 1));
            batch.add('glow', lanternGeo.clone(), trs(p.x, p.y - 0.27, p.z), 0xffffff, 0);
            batch.add('brass', capGeo.clone(), trs(p.x, p.y - 0.27, p.z), 0xffffff, 0);
            lanternPts.push(p);
        }
    }
    lanternGeo.dispose();
    capGeo.dispose();
    // brilho das lanternas: halos instanciados num único Points
    {
        const pos = new Float32Array(lanternPts.length * 3);
        lanternPts.forEach((p, i) => pos.set([p.x, p.y - 0.15, p.z], i * 3));
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pm = new THREE.PointsMaterial({
            map: halo().material.map, color: 0xffb060, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.5,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        const pts = new THREE.Points(g, pm);
        pts.userData.own = true;
        world.group.add(pts);
        world.disposers.push(() => pm.dispose());
    }
    for (const [lx, lz] of [[5, 5], [-6, -3], [1, -8]]) world.addLight(lx, fy(lx, lz) + 3.2, lz, 0xffb468, 9, 15);

    // mesas, bancos e barris (modelos fotogramétricos)
    const tables = [[-4.5, 5.5, 0.5], [5.5, 4.5, -0.4], [-9, 9, 0.4], [9.5, -4.5, 1.2]];
    tables.slice(0, low ? 2 : 4).forEach(([x, z, ry], i) => {
        world.prop('WoodenTable_01', x, z, { ry, height: 0.62, collider: 0.75, top: 0.8 });
        // cadeira fotogramétrica = ~20 mil triângulos cada (×2 com a sombra): fora no tier baixo
        for (const k of low ? [] : [-1, 1]) {
            world.prop('WoodenChair_01', x + Math.cos(ry) * k * 1.0, z - Math.sin(ry) * k * 1.0, { ry: ry + (k > 0 ? -Math.PI / 2 : Math.PI / 2), height: 0.74 });
        }
        if (i < 2) world.prop('brass_goblets', x, z, { ry: i, y: fy(x, z) + 0.62, height: 0.16 });
        else world.prop('food_apple_01', x + 0.1, z, { y: fy(x, z) + 0.62, height: 0.06 });
    });
    [[-2.5, -6.5, 0.72], [-3.3, -6.1, 0.66], [11.5, 6, 0.7], [-11.5, 5.5, 0.7], [13, -2, 0.66]].forEach(([x, z, h], i) => {
        world.prop('wine_barrel_01', x, z, { ry: i * 1.3, height: h, collider: 0.42, top: 0.9 });
    });
    world.prop('wooden_crate_01', 12.2, 5, { ry: 0.5, height: 0.5, collider: 0.4, top: 0.6 });
    world.prop('wooden_crate_01', -12.4, 6.6, { ry: 1.1, height: 0.46, collider: 0.4, top: 0.6 });
    // lanterna, barril e balde em cada porta
    BURROWS.forEach((b, i) => {
        const side = i % 2 ? 1 : -1;
        const px = b.x + b.cos * side * 1.5 + b.sin * 0.95;
        const pz = b.z - b.sin * side * 1.5 + b.cos * 0.95;
        if (i < (low ? 3 : 9)) world.prop('wooden_lantern_01', px, pz, { ry: b.face, height: 0.42 });
        if (i % 3 === 0) world.prop('wooden_bucket_01', b.x - b.cos * side * 2.3 + b.sin * 1.4, b.z + b.sin * side * 2.3 + b.cos * 1.4, { height: 0.34 });
        if (i % 3 === 1) world.prop('wicker_basket_01', b.x - b.cos * side * 2.2 + b.sin * 1.2, b.z + b.sin * side * 2.2 + b.cos * 1.2, { height: 0.3 });
    });

    world.group.add(own(batch.build({ name: 'condado' })));

    // cercas das hortas e do pasto
    gardens.forEach((g, i) => {
        const c = Math.cos(g.ry);
        const s = Math.sin(g.ry);
        const P = (lx, lz) => [g.x + lx * c + lz * s, g.z - lx * s + lz * c];
        const hw = g.w * 0.5 + 0.7;
        const hd = g.d * 0.5 + 0.7;
        // três lados (o lado da porta fica aberto)
        world.group.add(createFence({ terrain, points: [P(-hw, hd), P(-hw, -hd), P(hw, -hd), P(hw, hd)], type: 'cerca', height: 0.8, seed: i + 2 }));
    });
    const pasture = [[26, 12], [34, 15], [37, 23], [30, 28], [23, 22], [26, 12]];
    world.group.add(createFence({ terrain, points: pasture, type: 'cerca', seed: 11 }));
    world.group.add(createFence({ terrain, points: [[-28, 30], [-20, 34], [-10, 35.5]], type: 'muro', seed: 5 }));

    // ---------- vegetação ----------
    const village = (x, z) => smoothstep(22, 40, Math.hypot(x, z));
    const nearBurrow = (x, z, r) => BURROWS.some((b) => Math.hypot(x - b.x + b.sin * 2, z - b.z + b.cos * 2) < r);
    const grass = createGrass({
        terrain, tier, bladeHeight: 0.34, density: tier === 'high' ? 60 : tier === 'medium' ? 50 : 24,
        colors: { base: 0x3f6a22, tip: 0xa9c85a, dry: 0xc9b85a }, dryness: 0.35,
        flowers: { density: 1.2, colors: [0xffffff, 0xffe26a, 0xf08ab0, 0x9a8af0, 0xff9a4a] }
    });
    world.grass = grass;
    world.group.add(grass.object);

    const trees = scatter({
        terrain, count: Math.round(130 * q.trees), minDist: 8, seed: 12, slopeMax: 0.3, layerMax: 0.4, keepOff: [road, stream], margin: 4,
        maskFn: (x, z) => (nearBurrow(x, z, 12) ? 0 : 0.12 + 0.88 * village(x, z)) * (Math.abs(x - 30) < 8 && Math.abs(z - 20) < 9 ? 0 : 1)
    });
    const willows = scatter({
        terrain, count: 7, minDist: 14, seed: 3, area: { minX: -70, maxX: 70, minZ: 34, maxZ: 56 }, keepOff: [road], margin: 6,
        maskFn: (x, z) => {
            const d = stream.dist(x, z, 12);
            return d > 3.5 && d < 7 ? 1 : 0;
        }
    }).map((p) => ({ ...p, species: 'salgueiro' }));
    const placements = [{ x: 0, z: 0, species: 'carvalho', s: 2.25, ry: 1.2 }, ...trees, ...willows];
    const forest = createForest({
        terrain, renderer: stage.renderer, tier, seed: 5, placements, lodDistance: tier === 'high' ? 42 : tier === 'medium' ? 34 : 20,
        species: [{ kind: 'carvalho', weight: 4, scale: [0.75, 1.2] }, { kind: 'betula', weight: 1.4 }, { kind: 'salgueiro', weight: 0 }]
    });
    world.forest = forest;
    world.group.add(forest.object);
    for (const p of forest.placements) {
        if (Math.abs(p.x) > 70 || Math.abs(p.z) > 70) continue;
        world.addCollider(p.x, p.z, 0.5 * (p.s ?? 1), { block: true, top: 9 });
    }

    const add = (g) => {
        if (g && !world.disposed) world.group.add(g);
    };
    const playable = { minX: -70, maxX: 70, minZ: -66, maxZ: 68 };
    world.pending.push(
        scatterModel({ terrain, preset: 'arbustos', count: Math.round(70 * q.props), seed: 8, area: playable, layerMax: 0.35, keepOff: [road, stream], maskFn: (x, z) => 0.15 + village(x, z) * 0.6 + (nearBurrow(x, z, 9) ? 0.6 : 0) }).then(add),
        scatterModel({ terrain, preset: 'flores', count: Math.round(160 * q.props), seed: 9, area: playable, layerMax: 0.3, keepOff: [road], maskFn: (x, z) => (nearBurrow(x, z, 8) ? 1 : 0.2) }).then(add),
        scatterModel({ terrain, preset: 'rochas', count: Math.round(22 * q.props), seed: 4, area: playable, keepOff: [road], maskFn: (x, z) => 0.2 + (stream.dist(x, z, 8) < 6 ? 0.8 : 0) }).then((g) => {
            add(g);
            if (g) for (const p of g.userData.placements) world.addCollider(p.x, p.z, 0.5 * (p.s ?? 1), { top: 1 });
        }),
        scatterModel({ terrain, preset: 'samambaias', count: Math.round(60 * q.props), seed: 14, area: playable, maskFn: (x, z) => (stream.dist(x, z, 9) < 7 ? 1 : 0.05) }).then(add)
    );
    // hortaliças nos canteiros
    gardens.forEach((g, i) => {
        world.pending.push(scatterModel({
            terrain, preset: 'ervas', count: low ? 8 : 18, seed: 30 + i, area: { x: g.x, z: g.z, radius: 2.2 }, layerMax: 1, minDist: 0.55, scale: [0.8, 1.4], dry: false
        }).then(add));
    });

    // ---------- o Anel ----------
    const doorX = MAIN.x + MAIN.sin * 2.3;
    const doorZ = MAIN.z + MAIN.cos * 2.3;
    const ring = makeRing(1.25);
    const ringY = () => world.heightAt(doorX, doorZ) + 1.12;
    ring.position.set(doorX, ringY(), doorZ);
    world.group.add(ring);
    const ringIt = world.addInteract({ x: doorX, z: doorZ, r: 1.9, id: 'ring', kind: 'ring', label: 'Pegar o Anel', mesh: ring, done: false });
    world.goal = 'ring';
    const beacon = lightShaft(7.5, 0.55, 0xffcc66);
    beacon.position.set(doorX, world.heightAt(doorX, doorZ) + 0.1, doorZ);
    world.group.add(beacon);
    world.updateFns.push((t) => {
        if (ringIt.done) {
            beacon.visible = false;
            return;
        }
        ring.rotation.y = t * 0.9;
        ring.rotation.x = Math.sin(t * 0.7) * 0.25;
        ring.position.y = ringY() + Math.sin(t * 2) * 0.07;
        beacon.material.uniforms.uOpacity.value = 0.2 + Math.sin(t * 2.4) * 0.06;
    });

    // ---------- elenco ----------
    const wizard = makeWizard(tier === 'low' ? 1 : 2);
    const WZ = { x: 6.5, z: -8.5 };
    const staff = makeStaff();
    wizard.attach('handR', staff, { position: [0, -0.86, 0], upright: true });
    world.group.add(wizard.object);
    world.extras.push(new Extra(wizard, { x: WZ.x, z: WZ.z, yaw: -0.6, mode: 'idle', heightAt: world.heightAt, lookRange: 9 }));
    world.addCollider(WZ.x, WZ.z, 0.5, { top: 2 });
    world.addInteract({
        x: WZ.x, z: WZ.z, r: 2.4, id: 'wizard', kind: 'talk', speaker: 'O Mago Errante', label: 'Falar com o Mago Errante', done: false,
        lines: [
            'O Condado dorme em paz — por enquanto.',
            'Leve o Anel. Não o use. A estrada já está à escuta.'
        ]
    });
    // fogos do mago: fagulhas douradas subindo do cajado
    const sparks = emitter(world, {
        count: Math.round(46 * q.particles), life: 3.2, origin: new THREE.Vector3(WZ.x + 0.35, fy(WZ.x, WZ.z) + 2.2, WZ.z + 0.2),
        spread: new THREE.Vector3(0.05, 0.05, 0.05), velocity: new THREE.Vector3(0, 3.4, 0), velocitySpread: new THREE.Vector3(1.3, 1.2, 1.3),
        accel: new THREE.Vector3(0, -1.2, 0), turbulence: 0.5, size: [0.1, 0.03], color: 0xffd070, opacity: 0.95, additive: true
    });
    world.updateFns.push((t) => sparks.update(t));

    const npc = q.npc;
    const villagers = [
        { i: 0, x: -4.2, z: 4.2, yaw: 0.9, mode: 'talk' },
        { i: 1, x: -3.2, z: 5.6, yaw: -2.3, mode: 'talk' },
        { i: 2, x: 6.6, z: 5.6, yaw: -2.6, mode: 'cheer' },
        { i: 3, x: 13.5, z: 22, yaw: 0.4, mode: 'wave' },
        { i: 4, x: -30.5, z: 15.5, yaw: 2.2, mode: 'idle' },
        { i: 5, x: 3, z: 9, mode: 'run', speed: 2.9, path: [{ x: 3, z: 10 }, { x: -7, z: 2 }, { x: 0, z: -9 }, { x: 10, z: -1 }, { x: 8, z: 8 }] },
        { i: 6, x: 14, z: 20, mode: 'idle', speed: 1.25, path: [{ x: 16.5, z: 25, wait: 2 }, { x: 10, z: 12 }, { x: -2, z: 6.5, wait: 3 }, { x: 10, z: 12 }] },
        { i: 7, x: -12, z: -1, mode: 'idle', speed: 1.1, path: [{ x: -13, z: 0.5, wait: 4 }, { x: -3, z: 6 }, { x: 4, z: 1, wait: 2 }, { x: -3, z: 6 }] }
    ];
    villagers.slice(0, Math.max(4, Math.round(villagers.length * q.extras))).forEach((v) => {
        const h = makeVillager(v.i, npc);
        world.group.add(h.object);
        world.extras.push(new Extra(h, { ...v, heightAt: world.heightAt }));
        if (!v.path) world.addCollider(v.x, v.z, 0.35, { top: 1.3 });
    });

    // bichos
    const blockedForCritter = (x, z) => world.blockedAt(x, z, 0.4);
    const critters = [
        ['chicken', -31, 23.5, 3], ['chicken', -29.5, 24.5, 3], ['chicken', -32.5, 25, 3],
        ['sheep', 30, 19, 4], ['sheep', 28, 22, 4], ['pig', -43, 2.5, 2.5], ['dog', 2, 3, 6], ['goose', 14, 38, 3]
    ];
    critters.slice(0, Math.round(critters.length * q.extras)).forEach(([kind, x, z, radius], i) => {
        const c = createCreature(kind, { detail: npc, seed: i + 2 });
        world.group.add(c.object);
        world.extras.push(new Critter(c, { x, z, radius, heightAt: world.heightAt, blocked: blockedForCritter }));
        world.disposers.push(() => c.dispose());
    });

    // poeira dourada no ar do fim da tarde
    addAmbient(world, {
        count: 70, life: 9, spread: new THREE.Vector3(14, 2.5, 14), velocity: new THREE.Vector3(0.25, 0.05, 0.1),
        velocitySpread: new THREE.Vector3(0.2, 0.08, 0.2), turbulence: 0.8, size: [0.05, 0.05], color: 0xffe0a0, opacity: 0.5, additive: true
    }, { y: 1.6 });

    makePage(world, 3.5, 12.5, 'shire-page');
    return world;
}

/** Cajado do mago: haste torneada e torta, com um cristal preso no alto. */
export function makeStaff() {
    const g = new THREE.Group();
    const wood = turned([[0.022, 0], [0.026, 0.5], [0.024, 1.3], [0.03, 1.72], [0.045, 1.84], [0.03, 1.92], [0.05, 2.0], [0.02, 2.08]], 8);
    const pos = wood.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        pos.setX(i, pos.getX(i) + Math.sin(y * 3.1) * 0.018 + Math.max(0, y - 1.7) * 0.12);
    }
    wood.computeVertexNormals();
    const stick = new THREE.Mesh(wood, new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 0.8 }));
    stick.castShadow = true;
    stick.userData.own = true;
    const gem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.055, 1),
        new THREE.MeshStandardMaterial({ color: 0xcfeeff, emissive: 0x9fd8ff, emissiveIntensity: 2.4, roughness: 0.2 })
    );
    gem.userData.own = true;
    gem.position.set(0.05, 2.02, 0);
    gem.scale.set(1, 1.5, 1);
    const glow = halo(0xbfe4ff, 0.7, 0.5);
    glow.position.copy(gem.position);
    g.add(stick, gem, glow);
    g.userData.gem = gem;
    g.userData.glow = glow;
    return g;
}
