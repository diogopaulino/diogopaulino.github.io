/**
 * A Ilha do Castelo: terreno PBR com praia, mata e o rochedo do castelo sobre o mar
 * (labs/shared/gfx/terrain.js), usado na chegada (BeachLevel + CastleExteriorLevel +
 * SecretEntranceLevel) e na fuga (EscapeLevel). É montada uma vez e reaproveitada.
 *
 * Relevo (metros; r = √(x² + (z/1,2)²), t = 82 − r = distância para dentro da costa):
 *   mar      t < 0:  h = max(−9; 0,14·t)                        (a mesma conta vai em GLSL para o oceano)
 *   praia    h = 1,6·smoothstep(0, 14, t)
 *   interior h += 5,5·smoothstep(8, 40, t) + 1,8·(fbm − ½)·2·smoothstep(12, 40, t)
 *   rochedo  centro C = (0, −63), platô de raio 27 a 13 m; a encosta tem 9 m de largura
 *            (falésia) em todo o contorno, menos ao sul, onde se abre em 30 m (subida do caminho):
 *            largura = 9 + 21·smoothstep(0,3; 0,9; (z − Cz)/d)
 *   gruta    terraço de 6,6 m de altura em volta da entrada secreta, a oeste do rochedo
 */

import * as THREE from 'three';
import { createCourse, createTerrain, createPath, createGrass, createForest, scatter, scatterModel } from '../../../shared/gfx/terrain.js';
import { fbm2, smoothstep, lerp } from '../../../shared/gfx/core.js';
import { buildCastle, addCastleColliders } from './Castle.js?v=40';
import { Kit, block, wallGeo, makeCrag, shadowAll } from './Build.js?v=40';
import { addTorch, EnvironmentFX } from './Environment.js?v=40';
import { loadModel } from '../../../shared/gfx/assets.js';

const R = 82;
const CZ = -63;
const PLATEAU = 13;

export const ISLAND_MARKS = {
    spawn: { x: 0, z: 90 },
    view: { x: 1, z: -6 },
    tree: { x: -15, z: -20 },
    gate: { x: 0, z: CZ + 19 + 3 },
    secret: { x: -33.4, z: -59 },
    shipSpot: { x: 6, z: 124 },
    reach: 68
};

/** Profundidade do mar para o shader do oceano (m; negativo = terra). */
export const ISLAND_DEPTH_GLSL = /* glsl */ `
float gfxSeaDepth(vec2 xz) {
    float r = length(vec2(xz.x, xz.y / 1.2));
    return min(9.0, (r - ${R.toFixed(1)}) * 0.14);
}`;

export function islandHeight(x, z) {
    const r = Math.hypot(x, z / 1.2);
    const t = R - r;
    if (t < 0) return Math.max(-9, t * 0.14);
    let h = 1.6 * smoothstep(0, 14, t) + 5.5 * smoothstep(8, 40, t)
        + (fbm2(x * 0.035 + 7, z * 0.035 + 3, 4) - 0.5) * 3.6 * smoothstep(12, 40, t);
    const dz = z - CZ;
    const d = Math.hypot(x, dz) || 1;
    const w = 9 + 21 * smoothstep(0.3, 0.9, dz / d);
    const k = 1 - smoothstep(27, 27 + w, d);
    h = lerp(h, PLATEAU, k);
    const s = ISLAND_MARKS.secret;
    const ds = Math.hypot(x - (s.x - 2.5), z - s.z);
    h = lerp(h, 6.6, (1 - smoothstep(3.5, 7.5, ds)) * (x < s.x + 0.6 ? 1 : 0));
    return h;
}

/** Monta (ou devolve) a ilha. */
export function getIsland(game) {
    if (!game._island) game._island = buildIsland(game);
    return game._island;
}

async function buildIsland(game) {
    const stage = game.stage;
    const tier = stage.tier;
    const g = new THREE.Group();
    g.name = 'island';
    g.userData.keep = true;
    const M = ISLAND_MARKS;

    const road = createCourse([[0, 80], [3, 55], [-5, 30], [4, 8], [1, -12], [0, -30], [0, M.gate.z]], { width: 2.8 });
    const terrain = createTerrain({
        size: 300, center: [0, 4], heightFn: islandHeight, tier,
        layers: [
            { set: 'leafy_grass', scale: 3.4, tint: 0xa9c284 },
            { set: 'dirt_floor', scale: 3.0, tint: 0xa8a696 },
            { set: 'cliff_side', scale: 7.0 },
            { set: 'sand_01', scale: 3.6, tint: 0xf0e2c0 }
        ],
        splatFn: (x, z, h, slope, out) => {
            out[0] = 0;
            out[1] = smoothstep(0.16, 0.32, slope) * smoothstep(2.4, 4.5, h);
            out[2] = 1 - smoothstep(1.7, 3.3, h);
            out[3] = 0;
            return out;
        }
    });
    g.add(terrain.object);
    createPath({ terrain, course: road, ruts: true });
    await terrain.ready;

    const inPlateau = (x, z, m = 0) => Math.hypot(x, z - CZ) < 38 + m;
    const grass = createGrass({ terrain, maskFn: (x, z, h, slope) => (h > 3.1 && slope < 0.2 && !inPlateau(x, z, -9) && road.dist(x, z, 3) > 1.8 && Math.hypot(x - M.secret.x + 2, z - M.secret.z) > 5.5 ? 1 : 0) });
    g.add(grass.object);

    const count = tier === 'high' ? 160 : tier === 'medium' ? 120 : 80;
    const placements = scatter({
        terrain, count, minDist: 6, slopeMax: 0.24, keepOff: [road], margin: 4.5, seed: 5,
        maskFn: (x, z, h) => (h > 3.4 && !inPlateau(x, z, 4) && Math.hypot(x - M.tree.x, z - M.tree.z) > 9 ? 1 : 0)
    });
    // a árvore-mirante do Teco, isolada perto do castelo
    placements.push({ x: M.tree.x, z: M.tree.z, y: terrain.heightAt(M.tree.x, M.tree.z), s: 1.5, scale: 1.5, ry: 0.4, rot: 0.4 });
    const forest = createForest({
        terrain, renderer: stage.renderer, placements,
        species: [{ kind: 'carvalho', weight: 3 }, { kind: 'pinheiro', weight: 2 }, { kind: 'betula', weight: 2 }],
        lodDistance: tier === 'high' ? 55 : undefined
    });
    g.add(forest.object);
    const scat = [];
    for (const [preset, n, seed] of [['rochas', tier === 'low' ? 16 : 34, 3], ['samambaias', tier === 'low' ? 20 : 70, 4], ['arbustos', tier === 'low' ? 14 : 40, 6]]) {
        scatterModel({
            terrain, preset, count: n, seed, keepOff: [road], margin: 2.5,
            maskFn: (x, z, h) => (h > 2.2 && !inPlateau(x, z, -8) ? 1 : 0)
        }).then((m) => {
            if (!m) return;
            g.add(m);
            scat.push(m);
        });
    }

    // castelo sobre o platô
    const castle = await buildCastle({ detail: tier === 'low' ? 0 : 1 });
    castle.position.set(0, PLATEAU, CZ);
    g.add(castle);

    // rochedos: falésia ao norte, pedras na praia e a moldura da gruta
    const crags = [
        [-24, 4, -92, 9, 9, 7, 1], [22, 3, -94, 10, 8, 8, 2], [0, 1, -101, 8, 6, 6, 3], [36, 2, -70, 7, 8, 9, 4],
        [-18, 0.6, 86, 3, 2.2, 2.6, 5], [24, 0.4, 82, 3.6, 2.6, 3, 6], [-40, 0.5, 66, 4, 3, 3.4, 7], [52, -1, 92, 6, 5, 5, 8], [-60, -1.5, 96, 7, 6, 6, 9]
    ];
    for (const [x, y, z, rx, ry, rz, seed] of crags) {
        const c = makeCrag(seed, { rx, ry, rz, detail: tier === 'low' ? 3 : 4 });
        c.position.set(x, y, z);
        c.rotation.y = seed * 1.3;
        g.add(c);
    }

    // ---- entrada secreta: gruta úmida na rocha, porta de tábuas e tochas ----
    const fx = new EnvironmentFX();
    const s = M.secret;
    const sy = 6.6;
    const grotto = new THREE.Group();
    grotto.position.set(s.x, sy, s.z);
    const kit = new Kit();
    // portal de pedra (pano de 3,2 × 3,4 com vão em arco de 1,5 × 2,3), voltado para −X
    kit.put('mossy', wallGeo(3.4, 3.5, 0.9, [{ at: 1.7, w: 1.5, h: 2.3, arch: true }]), 0.3, 0, 1.7, Math.PI / 2);
    kit.put('cobble', block(4.4, 0.24, 5.2, 0.05), -1.9, -0.1, 0);
    kit.put('blocks', block(0.5, 0.2, 1.9, 0.04), -0.2, 0.1, 0);
    const torches = [
        addTorch(kit, grotto, -0.18, 1.55, -1.25, -Math.PI / 2, { intensity: 9, distance: 12 }),
        addTorch(kit, grotto, -0.18, 1.55, 1.25, -Math.PI / 2, { light: false })
    ];
    torches.forEach((t) => fx.addFire(t));
    kit.build(grotto);
    for (const [x, y, z, rx, ry, rz, seed] of [[1.6, 1.2, -3.4, 3.2, 3.6, 2.6, 11], [1.8, 1.4, 3.5, 3.4, 3.8, 2.8, 12], [2.2, 4.6, 0, 3.6, 2.2, 4.6, 13], [-3.6, 0.2, -3.2, 1.2, 0.9, 1.1, 14], [-3.9, 0.1, 3.0, 1.0, 0.7, 1.2, 15]]) {
        const c = makeCrag(seed, { rx, ry, rz, detail: 4, mat: 'mossy' });
        c.position.set(x, y, z);
        grotto.add(c);
    }
    // porta: folha de tábuas com cintas de ferro, dobradiça no batente sul (gira em Y)
    const doorPivot = new THREE.Group();
    doorPivot.position.set(0.05, 0, 0.75);
    const dk = new Kit();
    for (let i = 0; i < 6; i++) dk.put('planks', block(0.09, 2.26, 0.245, 0.012), 0, 1.13, -0.125 - i * 0.25);
    for (const y of [0.45, 1.75]) dk.put('iron', block(0.03, 0.09, 1.4, 0.008), -0.06, y, -0.75);
    dk.put('iron', new THREE.TorusGeometry(0.09, 0.016, 8, 16).rotateY(Math.PI / 2), -0.08, 1.1, -1.25);
    dk.build(doorPivot);
    grotto.add(doorPivot);
    // fechadura (alvo de "Pedir ajuda a Teco")
    const lock = new THREE.Object3D();
    lock.position.set(-0.1, 1.15, -0.55);
    grotto.add(lock);
    g.add(grotto);

    // navio fundeado diante da praia (só cenário: chegada e fuga)
    const shipModel = await loadModel('dutch_ship_medium', { ground: false });
    if (shipModel) {
        shipModel.scale.setScalar(1.4);
        shipModel.rotation.y = -0.5;
        shipModel.position.set(M.shipSpot.x, -0.5, M.shipSpot.z);
        shadowAll(shipModel);
        g.add(shipModel);
    }
    // bote na areia
    const pier = new Kit();
    for (let i = 0; i < 9; i++) pier.put('planks', block(2.2, 0.1, 1.5, 0.02), 0, 0.75, 80 + i * 1.55);
    for (let i = 0; i < 5; i++) for (const sx of [-1, 1]) pier.put('darkwood', new THREE.CylinderGeometry(0.13, 0.15, 4, 10), sx * 1.0, -0.9, 80.5 + i * 3.1);
    pier.build(g);

    stage.onTier((t) => grass.setDensity?.(t === 'low' ? 0.4 : t === 'medium' ? 0.7 : 1));

    const trunks = forest.placements || placements;
    return {
        group: g, terrain, grass, forest, road, castle, grotto, doorPivot, lock, fx, marks: M, plateau: PLATEAU,
        tramplers: [{ x: 0, y: 0, z: 0, radius: 0.9 }],
        heightAt: (x, z) => terrain.heightAt(x, z),
        /** Colisão da ilha: terreno (com mar raso como limite), castelo, árvores, portal da gruta. */
        addColliders(collision) {
            collision.setGround((x, z) => {
                if (Math.abs(x) < 1.3 && z > 79 && z < 93.6) return 0.8; // píer
                const h = terrain.heightAt(x, z);
                return h < -0.55 ? null : h;
            });
            addCastleColliders(collision, 0, PLATEAU, CZ);
            for (const p of trunks) collision.addPillar(p.x, p.z, 0.3 * (p.s || 1), 5, terrain.heightAt(p.x, p.z) - 1, { sight: false });
            // portal da gruta: ombreiras e a rocha atrás
            collision.addWall(s.x + 0.3, s.z - 1.25, 0.9, 1.0, 4, sy - 1);
            collision.addWall(s.x + 0.3, s.z + 1.25, 0.9, 1.0, 4, sy - 1);
            this.doorBox = collision.addWall(s.x + 0.3, s.z, 0.6, 1.6, 3, sy - 1);
            collision.addWall(s.x + 2.4, s.z, 3, 9, 6, sy - 1);
        },
        update(dt, time, camera, px, py, pz) {
            terrain.update(camera);
            this.tramplers[0].x = px;
            this.tramplers[0].y = py;
            this.tramplers[0].z = pz;
            grass.update(camera, dt, this.tramplers);
            forest.update(camera);
            fx.update(time);
        }
    };
}
