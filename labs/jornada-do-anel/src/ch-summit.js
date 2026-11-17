/**
 * V — O Monte da Visão. Cume ao entardecer: ruínas de pedra clara (anel de
 * colunas quebradas, arcos, estátuas), pinhal nas encostas, o grande rio a oeste,
 * vento e folhas. Objetivo: sentar-se no assento de pedra do cume.
 */

import * as THREE from 'three';
import { fbm2, smoothstep, lerp } from '../../shared/gfx/core.js';
import { createCourse, createTerrain, createGrass, createForest, createWater, createPath, scatter, scatterModel } from '../../shared/gfx/terrain.js';
import { ChapterWorld, own, makePage, lightShaft, addAmbient } from './world.js?v=30';
import { Batch, trs, block, turned, column, arch, addStoneSeat, TAU } from './build.js?v=30';
import { makeGardener, Extra } from './actors.js?v=30';

export function buildSummit(ctx) {
    const world = new ChapterWorld(ctx);
    const { stage, tier } = ctx;
    const q = world.q;
    world.bounds = { minX: -44, maxX: 46, minZ: -44, maxZ: 46 };
    world.spawn = { x: 7, z: 39, yaw: Math.PI };
    world.overview.set(14, 9, 20);
    world.overviewLook.set(0, 17, 0);

    const river = createCourse([[-62, -140], [-68, -70], [-62, 0], [-70, 70], [-62, 140]], { width: 30 });
    const path = createCourse([[8, 60], [7, 39], [13, 26], [12, 13], [5, 6], [1, 3.4]], { width: 2 });
    const TOP = 16;
    /** Morro: h = 16·(1 − smoothstep(5, 50, d)) + ruído; cume aplainado (r < 7 m); margem cai para o leito do rio. */
    const heightFn = (x, z) => {
        const d = Math.hypot(x, z);
        let h = TOP * (1 - smoothstep(5, 50, d)) + (fbm2(x * 0.03 + 5, z * 0.03 + 2, 4) - 0.5) * 5 * smoothstep(8, 30, d) + (fbm2(x * 0.012, z * 0.012, 3) - 0.4) * 9 * smoothstep(40, 110, d);
        h = lerp(h, TOP, 1 - smoothstep(5, 9, d));
        const s = river.sample(x, z);
        const bed = lerp(-3, -5, s.t);
        h = lerp(h, bed + Math.min(s.d * 0.1, 3), 1 - smoothstep(16, 44, s.d));
        h = river.carve(x, z, h, { depth: 1.6, width: 28, bank: 8 });
        return path.carve(x, z, h, { depth: 0.1, width: 1.8, bank: 1.5 });
    };
    const terrain = createTerrain({ size: 280, heightFn, tier });
    world.terrain = terrain;
    world.ground = terrain.heightAt;
    world.group.add(terrain.object);
    createPath({ terrain, course: path });
    // piso do cume: terra batida em volta das ruínas
    terrain.paint({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, (x, z, h, sl, w) => {
        const k = 1 - smoothstep(5, 8, Math.hypot(x, z));
        w[0] = Math.max(w[0], k);
        return w;
    });
    const water = createWater({ terrain, river, depth: 1.5, shallow: 0x6a7a80, deep: 0x16303a, flow: 0.7, ripple: 0.22 });
    world.waters.push(water);
    world.group.add(water.object);

    const grass = createGrass({ terrain, tier, bladeHeight: 0.3, colors: { base: 0x4a5a22, tip: 0xc8b85a, dry: 0xd8b060 }, dryness: 0.8, flowers: { density: 0.4, colors: [0xffe08a, 0xf0a060] } });
    world.grass = grass;
    world.group.add(grass.object);

    const trees = scatter({
        terrain, count: Math.round(300 * q.trees), minDist: 5.5, seed: 31, slopeMax: 0.5, keepOff: [path, river], margin: 3,
        maskFn: (x, z) => smoothstep(11, 20, Math.hypot(x, z))
    });
    const forest = createForest({
        terrain, renderer: stage.renderer, tier, seed: 4, placements: trees,
        species: [{ kind: 'pinheiro', weight: 5, scale: [0.8, 1.35] }, { kind: 'carvalho', weight: 1 }, { kind: 'morta', weight: 0.5 }]
    });
    world.forest = forest;
    world.group.add(forest.object);
    for (const p of forest.placements) {
        if (Math.abs(p.x) < 60 && Math.abs(p.z) < 60) world.addCollider(p.x, p.z, 0.5 * (p.s ?? 1), { block: true, top: 9 });
    }
    const add = (g) => g && !world.disposed && world.group.add(g);
    const area = { minX: -55, maxX: 60, minZ: -60, maxZ: 60 };
    world.pending.push(
        scatterModel({ terrain, preset: 'pedras', count: Math.round(50 * q.props), seed: 2, area, keepOff: [path] }).then(add),
        scatterModel({ terrain, preset: 'rochas', count: Math.round(26 * q.props), seed: 7, area, keepOff: [path], maskFn: (x, z) => 0.3 + terrain.slopeAt(x, z) * 3 }).then((g) => {
            add(g);
            if (g) for (const p of g.userData.placements) world.addCollider(p.x, p.z, 0.6 * (p.s ?? 1), { top: 1 });
        }),
        scatterModel({ terrain, preset: 'samambaias', count: Math.round(120 * q.props), seed: 9, area, keepOff: [path], maskFn: (x, z) => smoothstep(10, 18, Math.hypot(x, z)) }).then(add)
    );

    // ---------- ruínas ----------
    const batch = new Batch();
    const y0 = terrain.heightAt(0, 0);
    // patamar circular de três degraus
    [[4.6, 0.14], [3.9, 0.28], [3.2, 0.42]].forEach(([r, h]) => batch.add('slate', turned([[r + 0.03, -0.4], [r + 0.03, h - 0.14], [r, h - 0.01], [0.001, h - 0.01]], 40), trs(0, y0, 0), 0xe8e0d0, 1.6));
    world.decks.push((x, z) => {
        const d = Math.hypot(x, z);
        return d < 3.2 ? y0 + 0.42 : d < 3.9 ? y0 + 0.28 : d < 4.6 ? y0 + 0.14 : -Infinity;
    });
    // assento do cume olhando para o rio (oeste)
    const SEAT = { x: 0.6, z: 0, yaw: -Math.PI / 2, s: 1.3 };
    addStoneSeat(batch, trs(SEAT.x, y0 + 0.42, SEAT.z, SEAT.yaw), { scale: SEAT.s, back: 1.5, tint: 0xf4eee0 });
    world.addCollider(SEAT.x + 0.35, SEAT.z, 0.55, { top: 2 });
    // anel de colunas, metade quebrada
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + 0.35;
        const x = Math.cos(a) * 7;
        const z = Math.sin(a) * 7;
        const broken = [0, 0.7, 0, 0.45, 0.85, 0, 0.6, 0, 0.3][i];
        batch.add('stoneLight', column({ height: 4.6, radius: 0.36, flutes: 10, broken, seed: i }), trs(x, terrain.heightAt(x, z) - 0.1, z, i), 0xefe8d8, 1.4);
        world.addCollider(x, z, 0.6, { block: true, top: 4 });
        if (broken > 0.5) batch.add('stoneLight', column({ height: 1.5, radius: 0.34, flutes: 10, capital: 1, base: 0 }), trs(x * 1.22 + 0.5, terrain.heightAt(x * 1.22, z * 1.22) + 0.3, z * 1.22, a, 1, Math.PI / 2), 0xe2dccc, 1.4);
    }
    // arcos no caminho e no lado do rio
    for (const [x, z, ry, tint] of [[12.4, 16, 0.2, 0xeee6d6], [-9.5, 2.5, Math.PI / 2 + 0.2, 0xe4decf], [3, -10.5, 0.1, 0xe8e2d2]]) {
        batch.add('stoneLight', arch({ span: 2.6, pier: 0.7, rise: 2.5, thick: 0.75, crown: 0.6, ogival: 0.5 }), trs(x, terrain.heightAt(x, z) - 0.25, z, ry), tint, 1.5);
        const c = Math.cos(ry);
        const s = Math.sin(ry);
        for (const k of [-1, 1]) world.addCollider(x + c * k * 1.65, z - s * k * 1.65, 0.55, { block: true, top: 4 });
    }
    // plintos das estátuas
    const statues = [['marble_bust_01', -4.6, 5.6, 2.4, 0.85], ['marble_bust_01', -4.4, -5.8, 0.6, 0.85], ['horse_statue_01', 9.5, -6.5, -2.2, 1.5]];
    for (const [name, x, z, ry, h] of statues) {
        const gy = terrain.heightAt(x, z);
        const big = name.startsWith('horse');
        batch.add('stoneBlock', block(big ? 1.5 : 0.8, big ? 1.0 : 1.3, big ? 2.2 : 0.8, 0.06), trs(x, gy - 0.15, z, ry), 0xe8e2d4, 1.2);
        world.prop(name, x, z, { ry, y: gy + (big ? 0.85 : 1.15), height: h, collider: big ? 1.1 : 0.6, top: 3 });
    }
    world.group.add(own(batch.build({ name: 'ruinas' })));

    const beacon = lightShaft(9, 0.7, 0xffc880);
    beacon.position.set(SEAT.x, y0 + 0.5, SEAT.z);
    world.group.add(beacon);
    world.updateFns.push((t) => {
        beacon.material.uniforms.uOpacity.value = 0.16 + Math.sin(t * 2) * 0.05;
    });
    world.addInteract({
        x: SEAT.x - 0.6, z: SEAT.z, r: 2.3, id: 'seat', kind: 'goal', label: 'Sentar no trono e seguir adiante', done: false,
        sit: { x: SEAT.x - 0.08, z: SEAT.z, seatY: y0 + 0.42 + 0.46 * SEAT.s, yaw: SEAT.yaw }
    });
    world.goal = 'seat';

    const friend = makeGardener(tier === 'low' ? 1 : 2);
    world.group.add(friend.object);
    world.extras.push(new Extra(friend, { x: 5.4, z: 6.6, yaw: 2.6, mode: 'idle', heightAt: world.heightAt, lookRange: 10 }));
    world.addCollider(5.4, 6.6, 0.4, { top: 1.3 });
    world.addInteract({
        x: 5.4, z: 6.6, r: 2.1, id: 'gardener', kind: 'talk', speaker: 'O jardineiro', label: 'Falar com o jardineiro', done: false,
        lines: ['Não posso carregar o Anel por você.', 'Mas posso ir até o fim. Não o deixe sozinho.']
    });

    // folhas ao vento
    addAmbient(world, {
        count: 80, life: 7, spread: new THREE.Vector3(18, 4, 18), velocity: new THREE.Vector3(2.4, -0.25, 1.0),
        velocitySpread: new THREE.Vector3(0.8, 0.3, 0.8), turbulence: 1.6, size: [0.12, 0.1], color: 0xc8742a, opacity: 0.95, stretch: 0.6
    }, { y: 3 });

    makePage(world, -5.5, 0.5, 'summit-page');
    return world;
}
