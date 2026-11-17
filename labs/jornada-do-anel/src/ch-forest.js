/**
 * II — A Fuga. Floresta à noite com névoa rasteira; a estrada serpenteia até o
 * vau do rio enquanto três cavaleiros sombrios patrulham montados.
 *
 * Furtividade (ver actors.js): troncos e rochas cortam a linha de visão; correr
 * aumenta o alcance com que o portador é visto e faz barulho a menos de 5 m.
 */

import * as THREE from 'three';
import { fbm2, smoothstep, lerp } from '../../shared/gfx/core.js';
import { createCourse, createTerrain, createGrass, createForest, createWater, createPath, scatter, scatterModel } from '../../shared/gfx/terrain.js';
import { ChapterWorld, own, makePage, halo, lightShaft, addAmbient } from './world.js?v=30';
import { Batch, trs, turned } from './build.js?v=30';
import { makeDarkRider, makeBlackHorse, mount, Rider, makeElf, Extra, createCreature } from './actors.js?v=30';

export function buildForest(ctx) {
    const world = new ChapterWorld(ctx);
    const { stage, tier } = ctx;
    const q = world.q;
    world.bounds = { minX: -24, maxX: 24, minZ: -6, maxZ: 127 };
    world.spawn = { x: 0, z: 2, yaw: 0 };
    world.overview.set(7, 6, -12);
    world.overviewLook.set(0, 1.5, 14);
    world.gear = { drawn: true, lantern: true };

    const road = createCourse([[0, -30], [0, 4], [3, 24], [-4, 44], [4, 66], [-3, 88], [2, 108], [0, 122], [0, 150]], { width: 3 });
    const river = createCourse([[-80, 119], [-30, 123], [0, 122], [30, 124], [80, 121]], { width: 8 });
    // leito do rio desce de oeste para leste; o vau é raso
    const heightFn = (x, z) => {
        const rd = road.dist(x, z, 40);
        let h = (fbm2(x * 0.045 + 3, z * 0.045 + 7, 4) - 0.45) * 5.5 * smoothstep(2.5, 16, rd) + (fbm2(x * 0.2, z * 0.2, 2) - 0.5) * 0.35;
        const s = river.sample(x, z);
        const bed = lerp(-0.4, -2.2, s.t);
        h = lerp(h, bed + Math.min(s.d * 0.14, 2), 1 - smoothstep(5, 24, s.d));
        h = river.carve(x, z, h, { depth: 0.75, width: 7, bank: 4 });
        return road.carve(x, z, h, { depth: 0.15, width: 2.6, bank: 2 });
    };
    const terrain = createTerrain({
        size: [150, 220], center: [0, 62], heightFn, tier,
        layers: [{ set: 'forest_leaves_02', scale: 3.2 }, { set: 'dirt_floor', scale: 3 }, { set: 'mossy_rock', scale: 5 }, { set: 'brown_mud_leaves_01', scale: 3.2 }]
    });
    world.terrain = terrain;
    world.ground = terrain.heightAt;
    world.group.add(terrain.object);
    createPath({ terrain, course: road, ruts: true });
    const water = createWater({ terrain, river, depth: 0.45, shallow: 0x3a5560, deep: 0x0a1c26, flow: 1.3 });
    world.waters.push(water);
    world.group.add(water.object);

    const grass = createGrass({ terrain, tier, density: world.low ? 18 : 40, bladeHeight: 0.26, colors: { base: 0x1f3a1c, tip: 0x5f7a44, dry: 0x6a6a3a }, flowers: false, cover: false });
    world.grass = grass;
    world.group.add(grass.object);

    const trees = scatter({
        terrain, count: Math.round(330 * q.trees), minDist: 4.2, seed: 21, slopeMax: 0.45, keepOff: [road, river], margin: 3.4,
        maskFn: (x, z) => (z > 114 ? 0.25 : 1)
    });
    const forest = createForest({
        terrain, renderer: stage.renderer, tier, seed: 9, placements: trees, lodDistance: world.low ? 22 : 38,
        species: [{ kind: 'pinheiro', weight: 3 }, { kind: 'carvalho', weight: 3 }, { kind: 'morta', weight: 2, scale: [0.9, 1.3] }]
    });
    world.forest = forest;
    world.group.add(forest.object);
    for (const p of forest.placements) world.addCollider(p.x, p.z, 0.5 * (p.s ?? 1), { block: true, top: 9 });

    const add = (g) => g && !world.disposed && world.group.add(g);
    const area = { minX: -40, maxX: 40, minZ: -20, maxZ: 135 };
    world.pending.push(
        scatterModel({ terrain, preset: 'pedregulhos', count: Math.round(26 * q.props), seed: 3, area, keepOff: [road], margin: 2.4, height: [1.3, 2.2] }).then((g) => {
            add(g);
            // rochas grandes também escondem o portador
            if (g) for (const p of g.userData.placements) world.addCollider(p.x, p.z, 0.9, { block: true, top: 1.6 });
        }),
        scatterModel({ terrain, preset: 'samambaias', count: Math.round(200 * q.props), seed: 5, area, keepOff: [road], margin: 1.6 }).then(add),
        scatterModel({ terrain, preset: 'tocos', count: Math.round(12 * q.props), seed: 6, area, keepOff: [road], margin: 2 }).then(add),
        scatterModel({ terrain, preset: 'arbustos', count: Math.round(60 * q.props), seed: 8, area, keepOff: [road], margin: 2 }).then(add)
    );

    // ---------- cavaleiros ----------
    const spawns = [
        { x: -4, z: 38, wps: [{ x: -6, z: 32 }, { x: 5, z: 48 }, { x: -4, z: 38 }] },
        { x: 3, z: 68, wps: [{ x: 6, z: 60 }, { x: -5, z: 78 }, { x: 3, z: 68 }] },
        { x: -2, z: 98, wps: [{ x: -7, z: 92 }, { x: 4, z: 108 }, { x: -2, z: 98 }] }
    ];
    spawns.forEach((s, i) => {
        const horse = makeBlackHorse(tier === 'low' ? 0 : 1, i);
        const rider = mount(horse, makeDarkRider(tier === 'low' ? 0 : 1));
        world.group.add(horse.object);
        world.riders.push(new Rider(horse, rider, s.x, s.z, s.wps));
        world.disposers.push(() => horse.dispose());
    });

    // ---------- vau: marco de pedra, elfo e cavalo esperando na outra margem ----------
    const batch = new Batch();
    const gy = terrain.heightAt(2.6, 125.6);
    batch.add('mossRock', turned([[0.42, -0.3], [0.36, 0.5], [0.3, 1.5], [0.24, 2.1], [0.1, 2.35], [0.001, 2.42]], 7), trs(2.6, gy, 125.6, 0.4, 1, 0.05), 0xd8dccc, 1.2);
    world.group.add(own(batch.build({ name: 'vau' })));
    const beacon = lightShaft(8, 0.6, 0x9fc8ff);
    beacon.position.set(0, water.levelAt ? water.levelAt(0, 123) : -0.5, 123);
    world.group.add(beacon);
    const glow = halo(0xbfdcff, 2.2, 0.5);
    glow.position.set(2.6, gy + 2.5, 125.6);
    world.group.add(glow);
    world.addLight(2.2, gy + 2.4, 125, 0x9fc4ff, 10, 16);
    world.addInteract({ x: 0, z: 123.5, r: 3.4, id: 'ford', kind: 'goal', label: 'Atravessar o vau', done: false });
    world.goal = 'ford';
    const elf = makeElf(2, q.npc);
    world.group.add(elf.object);
    world.extras.push(new Extra(elf, { x: 4.6, z: 129.5, yaw: Math.PI, mode: 'wave', heightAt: world.heightAt, lookRange: 30 }));
    const grey = createCreature('horse', { coat: 'grey', saddle: true, detail: q.npc });
    grey.object.position.set(7.4, terrain.heightAt(7.4, 131), 131);
    grey.object.rotation.y = -2.2;
    world.group.add(grey.object);
    const gs = { mode: 'idle', groundFn: terrain.heightAt };
    world.updateFns.push((t, dt) => grey.update(dt, gs));
    world.disposers.push(() => grey.dispose());

    // ---------- luz da lanterna do portador + vaga-lumes + bruma ----------
    const lamp = new THREE.PointLight(0xffa860, 7, 11, 1.7);
    world.group.add(lamp);
    world.updateFns.push((t, dt, p) => {
        if (!p) return;
        lamp.position.set(p.x + Math.sin(p.yaw) * 0.3, p.y + 0.75, p.z + Math.cos(p.yaw) * 0.3);
        lamp.intensity = 7 * (1 + Math.sin(t * 9) * 0.06);
        beacon.material.uniforms.uOpacity.value = 0.2 + Math.sin(t * 2) * 0.06;
    });
    addAmbient(world, {
        count: 60, life: 7, spread: new THREE.Vector3(16, 1.6, 16), velocity: new THREE.Vector3(0.1, 0.05, 0.05),
        velocitySpread: new THREE.Vector3(0.3, 0.15, 0.3), turbulence: 1.4, size: [0.07, 0.07], color: 0xd8ff8a, opacity: 0.9, additive: true
    }, { y: 1.2 });
    addAmbient(world, {
        count: 26, life: 14, spread: new THREE.Vector3(22, 0.5, 22), velocity: new THREE.Vector3(0.35, 0.02, 0.15),
        velocitySpread: new THREE.Vector3(0.2, 0.02, 0.2), turbulence: 1.5, size: [5, 9], color: 0x6a7c98, opacity: 0.09
    }, { y: 0.6 });

    makePage(world, -8, 20, 'forest-page');
    return world;
}
