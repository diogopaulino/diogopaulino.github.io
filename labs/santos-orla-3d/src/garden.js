/**
 * Jardins da orla (os maiores jardins de praia do mundo, 5.335 m): palmeiras-imperiais
 * em alameda no calçadão e no canteiro central, amendoeiras (chapéu-de-sol) no gramado,
 * oitis na calçada dos prédios, ipês pontuando de cor, coqueiros no alto da areia e
 * canteiros floridos ao longo dos caminhos.
 *
 * Regras de plantio (determinísticas, seed fixa):
 *   - nada dentro dos canais (margem 2 m), dos caminhos sinuosos (±2,2 m) ou das travessas;
 *   - alamedas com passo regular + jitter pequeno; miolo do gramado por amostragem com
 *     rejeição (distância mínima entre copas);
 *   - cada espécie tem 2–3 variações de malha, instanciadas (≈ 2 draw calls por variação).
 */
import * as THREE from 'three';
import { createPalmKit, createTreeKit, createShrubKit, instanceKit } from '../../shared/gfx/flora.js';
import { seeded } from '../../shared/gfx/core.js';
import { ZONES, CANALS, LAND_Y, GARDEN_KEEPOUT, groundY } from './config.js';
import { gardenPathA, gardenPathB, X_WEST, X_EAST } from './terrain.js';
import { kioskSpots, postoSpots, KIOSK_Z } from './props.js';

export function createGarden(quality, terrain) {
    const root = new THREE.Group();
    root.name = 'garden';
    const rnd = seeded(0x6a2d);
    const cross = terrain?.crossPaths || [];

    const inCanal = (x, m = 2) => CANALS.some((c) => Math.abs(x - c.x) < c.width / 2 + m);
    const kiosks = kioskSpots(terrain?.openings || []);
    const keepout = (x, z, m) => GARDEN_KEEPOUT.some((k) => (k.r
        ? (x - k.x) ** 2 + (z - k.z) ** 2 < (k.r + m) ** 2
        : x > k.x0 - m && x < k.x1 + m && z > k.z0 - m && z < k.z1 + m));
    const postos = postoSpots();
    const free = (x, z, m = 2.2) => !inCanal(x, m) && !keepout(x, z, m)
        && !postos.some((p) => Math.abs(x - p.x) < 5.5 + m && z > p.z - 4.5 - m)
        && !kiosks.some((kx) => Math.abs(x - kx) < 9 + m && z > KIOSK_Z - 9 - m)
        && Math.abs(z - gardenPathA(x)) > m && Math.abs(z - gardenPathB(x)) > m
        && !cross.some((cx) => Math.abs(x - cx) < m + 0.6);

    const kits = {
        imperial: [createPalmKit({ kind: 'imperial', seed: 1 }), createPalmKit({ kind: 'imperial', seed: 2 })],
        coco: [createPalmKit({ kind: 'coco', seed: 3 }), createPalmKit({ kind: 'coco', seed: 4 })],
        amendoeira: [createTreeKit({ kind: 'amendoeira', seed: 1 }), createTreeKit({ kind: 'amendoeira', seed: 2 }), createTreeKit({ kind: 'amendoeira', seed: 5 })],
        round: [createTreeKit({ kind: 'round', seed: 3 }), createTreeKit({ kind: 'round', seed: 6 })],
        ipe: [createTreeKit({ kind: 'ipe', seed: 4 }), createTreeKit({ kind: 'ipe', seed: 7, flowerColor: '#e86aa8' })],
        shrub: [
            createShrubKit({ seed: 1 }),
            createShrubKit({ seed: 2, flowers: 34, flowerColor: '#e23a6a' }),
            createShrubKit({ seed: 3, flowers: 34, flowerColor: '#f2d23a' }),
            createShrubKit({ seed: 4, flowers: 30, flowerColor: '#f4f1ea', hue: 118 })
        ]
    };
    const lists = {};
    const put = (kind, variant, pl) => {
        const key = `${kind}:${variant}`;
        (lists[key] ||= { kit: kits[kind][variant % kits[kind].length], items: [] }).items.push(pl);
    };
    const taken = [];
    const farFrom = (x, z, d) => taken.every((t) => (t.x - x) ** 2 + (t.z - z) ** 2 > d * d);

    // budget: o tier define quantas palmeiras/árvores cabem
    const palmStep = quality.palms >= 240 ? 13 : quality.palms >= 160 ? 18 : 30;

    // alameda de imperiais: borda do calçadão, passeio da praia e canteiro central
    let i = 0;
    for (let x = X_WEST + 8; x < X_EAST - 4; x += palmStep) {
        const jx = x + (rnd() - 0.5) * 1.6;
        if (!inCanal(jx, 3)) {
            put('imperial', i, { x: jx, y: LAND_Y, z: ZONES.garden[0] + 1.6, rot: rnd() * 6.28, scale: 0.92 + rnd() * 0.2 });
            taken.push({ x: jx, z: ZONES.garden[0] + 1.6 });
        }
        const kx = x + palmStep * 0.5 + (rnd() - 0.5) * 2;
        if (!inCanal(kx, 3) && kx < X_EAST - 4 && !kiosks.some((q) => Math.abs(q - kx) < 8) && !keepout(kx, ZONES.garden[1] - 1.8, 1)
            && !postos.some((p) => Math.abs(p.x - kx) < 6)) {
            put('imperial', i + 1, { x: kx, y: LAND_Y, z: ZONES.garden[1] - 1.8, rot: rnd() * 6.28, scale: 0.85 + rnd() * 0.25 });
            taken.push({ x: kx, z: ZONES.garden[1] - 1.8 });
        }
        if (i % 2 === 0 && !inCanal(x, 10)) {
            put('imperial', i, { x: x + 4, y: LAND_Y + 0.05, z: (ZONES.median[0] + ZONES.median[1]) / 2, rot: rnd() * 6.28, scale: 0.8 + rnd() * 0.15 });
        }
        i++;
    }

    // oitis na calçada dos prédios
    for (let x = X_WEST + 5; x < X_EAST - 3; x += 12.5) {
        if (inCanal(x, 13)) continue;
        put('round', i++, { x: x + (rnd() - 0.5) * 2, y: LAND_Y, z: ZONES.cityWalk[1] - 1.1, rot: rnd() * 6.28, scale: 0.62 + rnd() * 0.14 });
    }

    // amendoeiras e ipês no miolo do gramado
    let tries = 0;
    let planted = 0;
    while (planted < quality.trees && tries < quality.trees * 30) {
        tries++;
        const x = X_WEST + 6 + rnd() * (X_EAST - X_WEST - 12);
        const z = ZONES.garden[0] + 5 + rnd() * (ZONES.garden[1] - ZONES.garden[0] - 10);
        if (!free(x, z, 3.2) || !farFrom(x, z, 11.5)) continue;
        taken.push({ x, z });
        const r = rnd();
        if (r < 0.7) put('amendoeira', planted, { x, y: LAND_Y, z, rot: rnd() * 6.28, scale: 0.85 + rnd() * 0.3 });
        else if (r < 0.86) put('round', planted, { x, y: LAND_Y, z, rot: rnd() * 6.28, scale: 0.9 + rnd() * 0.25 });
        else put('ipe', planted, { x, y: LAND_Y, z, rot: rnd() * 6.28, scale: 0.85 + rnd() * 0.25 });
        planted++;
    }

    // coqueiros no alto da areia
    const cocoN = Math.round(quality.palms * 0.12);
    for (let k = 0; k < cocoN; k++) {
        const x = X_WEST + 10 + rnd() * (X_EAST - X_WEST - 20);
        if (inCanal(x, 5)) continue;
        const z = ZONES.sandTop + 1.5 + rnd() * 7;
        put('coco', k, { x, y: groundY(x, z) - 0.05, z, rot: rnd() * 6.28, scale: 0.85 + rnd() * 0.35 });
    }

    // canteiros floridos: manchas elípticas junto aos caminhos + cercas vivas nas bordas
    let s = 0;
    const bedStep = quality.shrubs > 700 ? 19 : quality.shrubs > 400 ? 27 : 44;
    for (let bx = X_WEST + 12; bx < X_EAST - 8; bx += bedStep) {
        const cz = (rnd() < 0.5 ? gardenPathA(bx) : gardenPathB(bx)) + (rnd() < 0.5 ? -1 : 1) * (3.4 + rnd() * 1.2);
        const variant = 1 + (s % 3);
        const n = 9 + Math.floor(rnd() * 6);
        const ra = 2.2 + rnd() * 1.6;
        for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            const rr = k === 0 ? 0 : 0.5 + rnd() * 0.5;
            const x = bx + Math.cos(a) * ra * rr * 1.5;
            const z = cz + Math.sin(a) * ra * rr * 0.8;
            if (!free(x, z, 1.1) || z < ZONES.garden[0] + 1 || z > ZONES.garden[1] - 1) continue;
            put('shrub', variant, { x, y: LAND_Y + 0.02, z, rot: rnd() * 6.28, scale: 0.7 + rnd() * 0.5 });
        }
        s++;
    }
    const hedgeStep = quality.shrubs > 700 ? 1.5 : 2.4;
    for (let x = X_WEST + 4; x < X_EAST - 2; x += hedgeStep) {
        if (inCanal(x, 1.5) || cross.some((cx) => Math.abs(x - cx) < 2.2) || kiosks.some((q) => Math.abs(q - x) < 8)
            || postos.some((p) => Math.abs(p.x - x) < 5)) continue;
        if (Math.floor((x + 500) / 22) % 3 === 0) continue; // vãos na cerca viva
        put('shrub', 0, { x, y: LAND_Y + 0.02, z: ZONES.garden[1] - 0.6, rot: rnd() * 6.28, scale: 0.75 + rnd() * 0.2 });
    }

    for (const { kit, items } of Object.values(lists)) {
        if (!items.length) continue;
        root.add(instanceKit(kit, items, { castShadow: true }));
    }

    return { root, trees: taken, update() {}, setNight() {} };
}
