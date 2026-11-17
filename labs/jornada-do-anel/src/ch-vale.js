/**
 * III — O Vale Élfico. Amanhecer num vale de paredões: cachoeira que alimenta
 * o rio, ponte de pedra, terraço do conselho com assentos esculpidos e meia
 * colunata de arcos ogivais, pavilhão de cúpula, bétulas e salgueiros.
 *
 * Objetivo: entrar no círculo do conselho e aceitar levar o Anel.
 */

import * as THREE from 'three';
import { fbm2, smoothstep, lerp } from '../../shared/gfx/core.js';
import { createCourse, carveBasin, createTerrain, createGrass, createForest, createWater, createPath, scatter, scatterModel } from '../../shared/gfx/terrain.js';
import { ChapterWorld, own, makeRing, makePage, lightShaft, addAmbient, emitter } from './world.js?v=30';
import { Batch, trs, block, turned, column, arch, stoneBridge, addStoneSeat, TAU } from './build.js?v=30';
import { makeElf, makeDwarf, makeHuman, makeWizard, Extra } from './actors.js?v=30';
import { makeStaff } from './ch-shire.js?v=30';

/** Véu de cachoeira: faixa com estrias que descem (ruído esticado em y) e espuma embaixo. */
function waterfall(width, height) {
    const geo = new THREE.PlaneGeometry(width, height, 6, 12);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const v = 0.5 - pos.getY(i) / height; // 0 topo → 1 base
        pos.setZ(i, v * v * 2.2 + Math.cos((pos.getX(i) / width) * Math.PI) * 0.6); // a queda se afasta do paredão
    }
    geo.translate(0, height / 2, 0);
    const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
            uniform float uTime; varying vec2 vUv;
            float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
            void main() {
                float fall = (1.0 - vUv.y);
                // estrias: ruído fino em x, esticado em y, descendo com aceleração
                float s = n(vec2(vUv.x * 26.0, vUv.y * 3.0 + uTime * (1.6 + fall))) * 0.6 + n(vec2(vUv.x * 60.0, vUv.y * 7.0 + uTime * 3.2)) * 0.4;
                float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
                float a = edge * smoothstep(0.18, 0.75, s + fall * 0.35) * smoothstep(1.0, 0.94, vUv.y);
                vec3 col = mix(vec3(0.62, 0.78, 0.86), vec3(1.0), smoothstep(0.45, 0.9, s) + fall * 0.4);
                gl_FragColor = vec4(col * 1.15, a * 0.92);
            }`
    });
    const m = new THREE.Mesh(geo, mat);
    m.userData.own = true;
    m.renderOrder = 4;
    return m;
}

export function buildVale(ctx) {
    const world = new ChapterWorld(ctx);
    const { stage, tier } = ctx;
    const q = world.q;
    world.bounds = { minX: -34, maxX: 30, minZ: -50, maxZ: 46 };
    world.spawn = { x: 4, z: -42, yaw: 0 };
    world.overview.set(-20, 9, -24);
    world.overviewLook.set(-4, 5, 22);

    const POOL = { x: 12, z: 56, radius: 11 };
    const river = createCourse([[12, 50], [15, 36], [16, 18], [12, 0], [3, -14], [-14, -22], [-44, -30], [-110, -40]], { width: 4.6 });
    const path = createCourse([[4, -64], [4, -42], [3.4, -27], [2.6, -14], [-2, 0], [-7, 12], [-8, 21.5]], { width: 2.2 });
    const T = { x: -8, z: 30, r: 8 }; // terraço do conselho
    const base = (x, z) => 3 + (fbm2(x * 0.02 + 9, z * 0.02 + 1, 4) - 0.5) * 5;
    T.y = base(T.x, T.z) + 1.6;
    /**
     * Vale: fundo ondulado + paredões.
     *   leste/oeste: + 38·smoothstep(34, 78, |x| + ruído)      norte: + 40·smoothstep(58, 74, z + ruído) (degrau da cachoeira)
     */
    const heightFn = (x, z) => {
        const nz = (fbm2(x * 0.05, z * 0.05 + 4, 3) - 0.5) * 14;
        let h = base(x, z);
        const s = river.sample(x, z);
        const bed = lerp(2.2, -2.5, s.t);
        h = lerp(h, bed + Math.min(s.d * 0.12, 2.4), 1 - smoothstep(6, 26, s.d));
        h = lerp(h, T.y, 1 - smoothstep(T.r + 1.5, T.r + 7, Math.hypot(x - T.x, z - T.z)));
        h = river.carve(x, z, h, { depth: 1.1, width: 4.2, bank: 3.4 });
        h = carveBasin(x, z, h, { ...POOL, floor: 0.2 });
        h += 38 * smoothstep(34, 78, Math.abs(x + 2) + nz) + 40 * smoothstep(62, 67, z + nz * 0.25) + 30 * smoothstep(64, 100, -z + nz);
        return path.carve(x, z, h, { depth: 0.1, width: 2, bank: 1.6 });
    };
    const terrain = createTerrain({ size: 260, heightFn, tier });
    world.terrain = terrain;
    world.ground = terrain.heightAt;
    world.group.add(terrain.object);
    createPath({ terrain, course: path, layer: 1 });
    // sob o terraço e o pavilhão o chão é de terra (sem grama atravessando as lajes)
    for (const [cx, cz, r] of [[T.x, T.z, T.r + 1.2], [4.5, 24, 3.6]]) {
        terrain.paint({ minX: cx - r - 2, maxX: cx + r + 2, minZ: cz - r - 2, maxZ: cz + r + 2 }, (x, z, h, sl, w) => {
            w[0] = Math.max(w[0], 1 - smoothstep(r - 0.6, r + 0.6, Math.hypot(x - cx, z - cz)));
            return w;
        });
    }
    const pool = createWater({ terrain, lake: { ...POOL, level: 2.5 }, shallow: 0x7fb0a8, deep: 0x1f4a50 });
    const water = createWater({ terrain, river, depth: 0.55, shallow: 0x7aa89a, deep: 0x1f4a48, flow: 1.4 });
    world.waters.push(pool, water);
    world.group.add(pool.object, water.object);

    const grass = createGrass({ terrain, tier, colors: { base: 0x3a6a2a, tip: 0x9ac86a, dry: 0xb8c070 }, dryness: 0.25, flowers: { density: 1, colors: [0xffffff, 0xcfe0ff, 0xfff0a0, 0xe8b0ff] } });
    world.grass = grass;
    world.group.add(grass.object);

    // ---------- pedra clara ----------
    const batch = new Batch();
    // terraço: disco de lajes com dois degraus
    [[T.r + 0.8, 0.2], [T.r, 0.4]].forEach(([r, h]) => batch.add('slate', turned([[r + 0.04, -1.2], [r + 0.04, h - 0.03], [r, h], [0.001, h]], 48), trs(T.x, T.y, T.z), 0xf2ece0, 1.8));
    world.decks.push((x, z) => {
        const d = Math.hypot(x - T.x, z - T.z);
        return d < T.r ? T.y + 0.4 : d < T.r + 0.8 ? T.y + 0.2 : -Infinity;
    });
    const fy = T.y + 0.4;
    // pedestal do Anel
    batch.add('stoneLight', turned([[0.5, 0], [0.5, 0.1], [0.32, 0.18], [0.22, 0.5], [0.2, 0.8], [0.3, 0.9], [0.42, 0.95], [0.42, 1.02], [0.001, 1.04]], 20), trs(T.x, fy, T.z), 0xffffff, 1);
    world.addCollider(T.x, T.z, 0.5, { top: 1.2 });
    // assentos em arco (abertura voltada para o sul, por onde se chega)
    const seats = [];
    for (let i = 0; i < 9; i++) {
        const a = Math.PI * 0.5 + (i - 4) * 0.56; // em volta do norte
        const x = T.x + Math.cos(a) * 5.3;
        const z = T.z + Math.sin(a) * 5.3;
        const yaw = Math.atan2(T.x - x, T.z - z);
        addStoneSeat(batch, trs(x, fy, z, yaw), { tint: 0xf6f0e4 });
        world.addCollider(x, z, 0.55, { top: 1.6 });
        seats.push({ x: x + Math.sin(yaw) * 0.08, z: z + Math.cos(yaw) * 0.08, yaw });
    }
    // meia colunata com arcos ogivais atrás dos assentos
    const COLS = 8;
    const cp = [];
    for (let i = 0; i < COLS; i++) {
        const a = Math.PI * 0.5 + (i - (COLS - 1) / 2) * 0.4;
        const x = T.x + Math.cos(a) * (T.r - 0.5);
        const z = T.z + Math.sin(a) * (T.r - 0.5);
        cp.push([x, z]);
        batch.add('stoneLight', column({ height: 3.6, radius: 0.24, flutes: 12 }), trs(x, fy, z, a), 0xfaf5ea, 1.2);
        world.addCollider(x, z, 0.4, { block: true, top: 5 });
    }
    for (let i = 0; i < COLS - 1; i++) {
        const [x0, z0] = cp[i];
        const [x1, z1] = cp[i + 1];
        const span = Math.hypot(x1 - x0, z1 - z0);
        const g = arch({ span: span - 0.5, pier: 0.25, rise: 0.05, thick: 0.4, crown: 0.4, ogival: span * 0.22 });
        batch.add('stoneLight', g, trs((x0 + x1) / 2, fy + 3.55, (z0 + z1) / 2, Math.atan2(-(z1 - z0), x1 - x0)), 0xf6f0e2, 1.2);
    }
    // pavilhão de cúpula junto ao rio
    const PV = { x: 4.5, z: 24, r: 2.6 };
    const py = terrain.heightAt(PV.x, PV.z);
    batch.add('slate', turned([[PV.r + 0.55, -1], [PV.r + 0.55, 0.26], [PV.r + 0.5, 0.3], [0.001, 0.3]], 32), trs(PV.x, py, PV.z), 0xf0eadc, 1.6);
    world.decks.push((x, z) => (Math.hypot(x - PV.x, z - PV.z) < PV.r + 0.5 ? py + 0.3 : -Infinity));
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const x = PV.x + Math.cos(a) * PV.r;
        const z = PV.z + Math.sin(a) * PV.r;
        batch.add('stoneLight', column({ height: 3.3, radius: 0.2, flutes: 10 }), trs(x, py + 0.3, z), 0xfaf5ea, 1.2);
        world.addCollider(x, z, 0.32, { block: true, top: 5 });
    }
    // cúpula nervurada: revolução com perfil em ogiva, r(y) = R·cos(πt/2)^0,8
    const dome = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        dome.push([(PV.r + 0.45) * Math.pow(Math.cos(t * Math.PI * 0.5), 0.8) + 0.02, 3.6 + t * 2.4]);
    }
    batch.add('stoneLight', turned([[PV.r + 0.2, 3.3], [PV.r + 0.5, 3.36], [PV.r + 0.5, 3.6], ...dome, [0.06, 6.4], [0.001, 6.7]], 24), trs(PV.x, py + 0.3, PV.z), 0xe6eef0, 1.4);

    // ponte sobre o rio
    const BR = { x: 2.6, z: -14.2, yaw: Math.atan2(2.6 - 3.4, -14 + 27), len: 12, w: 3 };
    const bridge = stoneBridge({ length: BR.len, width: BR.w, rise: 0.9, arches: 1, depth: 2.6, parapet: 0.8 });
    const bs = Math.sin(BR.yaw);
    const bc = Math.cos(BR.yaw);
    BR.y = Math.max(terrain.heightAt(BR.x - bs * 6, BR.z - bc * 6), terrain.heightAt(BR.x + bs * 6, BR.z + bc * 6)) + 0.1;
    for (const [key, g] of bridge.parts) batch.add(key === 'stoneBlock' ? 'stoneLight' : key, g, trs(BR.x, BR.y, BR.z, BR.yaw), 0xf4eee2, 1.5);
    world.decks.push((x, z) => {
        const lx = (x - BR.x) * bc - (z - BR.z) * bs;
        const lz = (x - BR.x) * bs + (z - BR.z) * bc;
        if (Math.abs(lx) > BR.w * 0.5 || Math.abs(lz) > bridge.half + 1.2) return -Infinity;
        return BR.y + bridge.deck(Math.min(Math.abs(lz), bridge.half)) - Math.max(0, Math.abs(lz) - bridge.half) * 0.25;
    });
    for (const sx of [-1, 1]) {
        const ox = bc * sx * (BR.w * 0.5 - 0.1);
        const oz = -bs * sx * (BR.w * 0.5 - 0.1);
        world.addWall(BR.x + ox - bs * 6, BR.z + oz - bc * 6, BR.x + ox + bs * 6, BR.z + oz + bc * 6, 0.22, { top: 1.2 });
    }
    // lampiões de pedra ao longo do caminho
    for (const [x, z] of [[5.6, -30], [1.2, -22], [0.6, -4], [-4.6, 6], [-10, 16]]) {
        batch.add('stoneLight', turned([[0.2, 0], [0.2, 0.12], [0.09, 0.2], [0.08, 1.3], [0.2, 1.4], [0.2, 1.46]], 10), trs(x, terrain.heightAt(x, z), z), 0xf6f0e4, 0.8);
        batch.add('glow', turned([[0.12, 1.46], [0.15, 1.6], [0.1, 1.78]], 10), trs(x, terrain.heightAt(x, z), z), 0xffffff, 0);
        batch.add('stoneLight', turned([[0.22, 1.78], [0.2, 1.84], [0.001, 2.0]], 10), trs(x, terrain.heightAt(x, z), z), 0xf6f0e4, 0.8);
        world.addCollider(x, z, 0.25, { top: 2 });
    }
    world.group.add(own(batch.build({ name: 'vale' })));

    // ---------- cachoeiras ----------
    const falls = [];
    const mainTop = terrain.heightAt(12, 70);
    const f1 = waterfall(8, mainTop - 2.2);
    f1.position.set(12, 2.3, 62.6);
    f1.rotation.set(-0.12, Math.PI, 0);
    falls.push(f1);
    for (const [x, z, ry, w] of [[-47, 14, Math.PI / 2, 5], [42, -6, -Math.PI / 2, 4]]) {
        const top = terrain.heightAt(x + Math.sign(x) * 9, z);
        const bot = terrain.heightAt(x - Math.sign(x) * 3, z);
        const f = waterfall(w, Math.max(6, top - bot));
        f.position.set(x, bot, z);
        f.rotation.y = ry;
        falls.push(f);
    }
    falls.forEach((f) => world.group.add(f));
    world.disposers.push(() => falls.forEach((f) => f.material.dispose()));
    const mist = emitter(world, {
        count: Math.round(40 * q.particles), life: 6, origin: new THREE.Vector3(12, 3.2, 63), spread: new THREE.Vector3(4.5, 0.6, 2),
        velocity: new THREE.Vector3(0, 1.1, -0.9), velocitySpread: new THREE.Vector3(0.9, 0.5, 0.6), turbulence: 1.4, size: [3, 9], color: 0xf4f8ff, opacity: 0.2
    });
    world.updateFns.push((t) => {
        for (const f of falls) f.material.uniforms.uTime.value = t;
        mist.update(t);
    });

    // ---------- vegetação ----------
    const trees = scatter({
        terrain, count: Math.round(190 * q.trees), minDist: 6, seed: 17, slopeMax: 0.42, keepOff: [path, river], margin: 3.5,
        maskFn: (x, z) => (Math.hypot(x - T.x, z - T.z) < T.r + 4 || Math.hypot(x - PV.x, z - PV.z) < 6 || Math.hypot(x - POOL.x, z - POOL.z) < 13 ? 0 : 1)
    }).map((p) => (river.dist(p.x, p.z, 12) < 9 ? { ...p, species: 'salgueiro' } : p));
    const forest = createForest({
        terrain, renderer: stage.renderer, tier, seed: 6, placements: trees,
        species: [{ kind: 'betula', weight: 4, scale: [0.85, 1.3] }, { kind: 'carvalho', weight: 1.5 }, { kind: 'pinheiro', weight: 1.5 }, { kind: 'salgueiro', weight: 0 }]
    });
    world.forest = forest;
    world.group.add(forest.object);
    for (const p of forest.placements) {
        if (Math.abs(p.x) < 50 && Math.abs(p.z) < 60) world.addCollider(p.x, p.z, 0.4 * (p.s ?? 1), { block: true, top: 9 });
    }
    const add = (g) => g && !world.disposed && world.group.add(g);
    const area = { minX: -45, maxX: 40, minZ: -60, maxZ: 62 };
    world.pending.push(
        scatterModel({ terrain, preset: 'rochas', count: Math.round(30 * q.props), seed: 3, area, keepOff: [path], maskFn: (x, z) => (river.dist(x, z, 9) < 7 || Math.hypot(x - POOL.x, z - POOL.z) < 15 ? 1 : 0.15) }).then(add),
        scatterModel({ terrain, preset: 'samambaias', count: Math.round(140 * q.props), seed: 4, area, keepOff: [path] }).then(add),
        scatterModel({ terrain, preset: 'flores', count: Math.round(120 * q.props), seed: 5, area, keepOff: [path], layerMax: 0.3 }).then(add),
        scatterModel({ terrain, preset: 'arbustos', count: Math.round(50 * q.props), seed: 6, area, keepOff: [path, river] }).then(add)
    );

    // ---------- o Anel e o conselho ----------
    const ring = makeRing(1.3);
    ring.position.set(T.x, fy + 1.35, T.z);
    world.group.add(ring);
    const beacon = lightShaft(8, 0.6, 0xffd890);
    beacon.position.set(T.x, fy + 1.0, T.z);
    world.group.add(beacon);
    world.addInteract({ x: T.x, z: T.z - 0.6, r: 2.6, id: 'oath', kind: 'goal', label: 'Aceitar levar o Anel', mesh: ring, done: false });
    world.goal = 'oath';
    world.updateFns.push((t) => {
        ring.rotation.y = t * 0.7;
        ring.position.y = fy + 1.35 + Math.sin(t * 1.6) * 0.06;
        beacon.material.uniforms.uOpacity.value = 0.18 + Math.sin(t * 2.2) * 0.05;
    });
    const npc = q.npc;
    const council = [makeElf(0, Math.max(1, npc)), makeElf(1, npc), makeDwarf(npc), makeElf(3, npc), makeHuman(0, npc), makeElf(4, npc), makeElf(5, npc), makeHuman(1, npc), makeElf(2, npc)];
    const order = [4, 3, 5, 2, 6, 1, 7, 0, 8];
    council.slice(0, world.low ? 5 : 9).forEach((h, i) => {
        const s = seats[order[i]];
        world.group.add(h.object);
        // em `sit` a pelve desce até seatHeight: a raiz sobe o que falta para o assento de 0,46 m
        world.extras.push(new Extra(h, { x: s.x, z: s.z, yaw: s.yaw, mode: i === 0 ? 'talk' : 'sit', heightAt: world.heightAt, y: fy + (i === 0 ? 0 : 0.46 - h.seatHeight), lookRange: 7 }));
    });
    // quem fala fica de pé à frente do próprio assento
    const speaker = world.extras[world.extras.length - (world.low ? 5 : 9)];
    speaker.x += Math.sin(speaker.yaw) * 1.1;
    speaker.z += Math.cos(speaker.yaw) * 1.1;
    speaker.sync();
    const wizard = makeWizard(1);
    wizard.attach('handR', makeStaff(), { position: [0, -0.86, 0], upright: true });
    world.group.add(wizard.object);
    world.extras.push(new Extra(wizard, { x: T.x + 3.4, z: T.z - 5.6, yaw: -0.5, mode: 'idle', heightAt: world.heightAt, lookRange: 8 }));
    world.addCollider(T.x + 3.4, T.z - 5.6, 0.4, { top: 2 });

    // pólen e bruma dourada
    addAmbient(world, {
        count: 70, life: 10, spread: new THREE.Vector3(16, 3, 16), velocity: new THREE.Vector3(0.15, 0.08, 0.1),
        velocitySpread: new THREE.Vector3(0.2, 0.1, 0.2), turbulence: 1, size: [0.05, 0.05], color: 0xfff0c0, opacity: 0.6, additive: true
    }, { y: 2 });

    makePage(world, -14, -16, 'vale-page');
    return world;
}
