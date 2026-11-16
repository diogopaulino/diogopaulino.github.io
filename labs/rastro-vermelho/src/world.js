/**
 * Mundo do Rastro Vermelho: céu físico, sol com sombra, terreno em blocos, vegetação
 * e rochas instanciadas, mesas no horizonte e os seis povoados.
 *
 * Streaming: blocos de 96 m centrados em múltiplos de 96; ao trocar de bloco, os que
 * faltam entram numa fila ordenada por distância e nasce UM por quadro (sem engasgo).
 * O cenário é determinístico: o mesmo bloco sempre recebe as mesmas pedras e árvores.
 * Terreno, colisão, cascos e adereços leem a mesma terrainHeight(x, z).
 */
import * as THREE from 'three';
import { createSky } from '../../shared/gfx/sky.js';
import { createSunRig } from '../../shared/gfx/rig.js';
import { createParticles } from '../../shared/gfx/particles.js';
import { createTreeKit, createShrubKit, updateWind } from '../../shared/gfx/flora.js';
import { applyWorldUV, seeded } from '../../shared/gfx/core.js';
import { pbr } from '../../shared/gfx/textures.js';
import { hash, roadDistance, roadX, LANDMARKS, worldClock, clamp, lerp } from './simulation.js';
import { CHUNK, hAt, biome, terrainMaterial, terrainGeometry, GrassRing } from './terrain.js?v=10';
import { variantMesh } from './assets.js?v=10';
import { createMaterials, Batch, building, waterTower, windmill, fence, hitchingPost, wagon, tent, campfireLogs, watchtower, mineEntrance, cactusGeometry, mesaGeometry } from './props.js?v=10';
import { createFolk, createTetheredHorse } from './actors.js?v=10';

export const CHUNK_SIZE = CHUNK;
/** pr = teto do pixel ratio; radius = blocos em cada direção; grass = tufos do anel. */
export const PROFILES = {
    low: { id: 'low', pr: 1.25, radius: 2, segments: 26, grass: 2200, shadowSize: 1024, shadowRadius: 34, scatter: 0.6, far: 1500 },
    medium: { id: 'medium', pr: 1.5, radius: 2, segments: 40, grass: 4400, shadowSize: 2048, shadowRadius: 44, scatter: 1, far: 2600 },
    high: { id: 'high', pr: 2, radius: 3, segments: 48, grass: 7500, shadowSize: 2048, shadowRadius: 48, scatter: 1, far: 3000 }
};

const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();

function instanced(parts, placements, { cast = true, receive = true } = {}) {
    const out = [];
    for (const part of parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
        placements.forEach((pl, i) => {
            _p.set(pl.x, pl.y, pl.z); _e.set(pl.tx || 0, pl.rot || 0, pl.tz || 0); _q.setFromEuler(_e);
            _s.set(pl.s * (pl.sx || 1), pl.s * (pl.sy || 1), pl.s);
            mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = cast && part.shadow !== false;
        mesh.receiveShadow = receive;
        mesh.computeBoundingSphere();
        out.push(mesh);
    }
    return out;
}

export class World {
    constructor(scene, renderer, profile, kits) {
        this.scene = scene; this.renderer = renderer; this.profile = profile; this.kits = kits;
        this.chunks = new Map(); this.queue = []; this.center = ''; this.staticColliders = []; this.colliders = [];
        this.fires = []; this.folk = []; this.horses = []; this.spinners = [];
        this.M = createMaterials();
        // fronteira no hemisfério norte: o sol cruza o sul (+Z₃), às costas de quem sobe a trilha —
        // fachadas e paisagem ficam iluminadas de frente e o poente cai à esquerda (oeste = −X)
        this.sky = createSky({ renderer, scene, north: new THREE.Vector3(0, 0, 1), declination: -8, turbidity: 3.4, rayleigh: 2.2, mie: 0.006, mieG: 0.82, cloudCover: 0.34, ground: 0x8a6a4a, envIntensity: 1.5 });
        this.sky.setHour(16);
        this.sky.flush();
        this.rig = createSunRig(scene, this.sky, { shadows: true, mapSize: profile.shadowSize, radius: profile.shadowRadius, depth: 420 });
        this.focus = new THREE.Vector3();
        // preenchimento: céu (frio) por cima, rebatida da terra (quente) por baixo — a sombra nunca vira breu
        this.fill = new THREE.HemisphereLight(0xcfe0ff, 0x9a7650, 0.9);
        scene.add(this.fill);
        this.terrainMat = terrainMaterial(profile.id);
        this.createKits();
        this.createHorizon();
        this.grass = new GrassRing(scene, profile.grass, profile.id === 'low' ? 60 : 84);
        // duas luzes de fogueira fixas: mudam de lugar, nunca de quantidade (não recompila shaders)
        this.fireLights = [0, 1].map(() => { const l = new THREE.PointLight(0xff8a3a, 0, 16, 1.8); scene.add(l); return l; });
    }

    createKits() {
        const k = this.kits;
        const cactusMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, envMapIntensity: 0.6 });
        const trees = [1, 2].map((seed) => createTreeKit({ kind: 'round', seed }));
        this.scatterKits = {
            boulder: [k.boulder[0].parts],
            cliff: [k.cliff[0].parts],
            stone: k.stones.map((v) => v.parts),
            quiver: [k.quiver[0].parts],
            bush: [createShrubKit({ hue: 72, seed: 3, size: 0.9 }), createShrubKit({ hue: 96, seed: 5, size: 1.1 }), createShrubKit({ hue: 60, seed: 8, size: 0.7 })].map((b) => b.parts),
            trunk: [k.trunk[0].parts],
            cactus: [1, 2, 3].map((s) => [{ geometry: cactusGeometry(s), material: cactusMat }]),
            tree: trees.map((t) => t.parts)
        };
    }

    createHorizon() {
        // malha grossa de 3,4 km que continua o relevo além dos blocos (7 m abaixo para nunca furar o chão fino)
        const size = 3400, mesh = new THREE.Mesh(terrainGeometry(-size / 2, -500 - size / 2, size, this.profile.id === 'low' ? 72 : 120, 7), this.terrainMat);
        mesh.receiveShadow = false; mesh.matrixAutoUpdate = false;
        this.scene.add(mesh);
        // mesas e buttes: silhueta de faroeste no cânion e no horizonte norte
        const rnd = seeded(1899), list = [];
        const spots = [];
        for (let i = 0; i < 9; i++) { const z = 610 + (i / 8) * 260 + rnd.range(-12, 12), side = i % 2 ? 1 : -1; const r = rnd.range(34, 80); spots.push([roadX(z) + side * (r * 2.1 + rnd.range(30, 190)), z, r, rnd.range(40, 95)]); }
        for (let i = 0; i < 8; i++) spots.push([rnd.range(-1300, 1300), rnd.range(1150, 1750), rnd.range(90, 220), rnd.range(90, 190)]);
        for (let i = 0; i < 7; i++) { const side = i % 2 ? 1 : -1; spots.push([side * rnd.range(520, 1150), rnd.range(-200, 1000), rnd.range(70, 170), rnd.range(70, 150)]); }
        const mat = pbr('rock', { color: 0xffffff, roughness: 1, vertexColors: true, normalScale: 2.2, envMapIntensity: 0.5 });
        spots.forEach(([x, z, r, h], i) => {
            const g = mesaGeometry(i + 1, r, h);
            g.translate(x, hAt(x, -z), -z);
            applyWorldUV(g, 22);
            list.push(g);
            if (Math.abs(x - roadX(z)) < 420) this.staticColliders.push({ x, z, radius: r * 1.55 });
        });
        for (const g of list) {
            const m = new THREE.Mesh(g, mat);
            m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false;
            this.scene.add(m);
        }
    }

    createChunk(cx, cz) {
        const group = new THREE.Group(), colliders = [];
        const x0 = cx * CHUNK - CHUNK / 2, z0 = cz * CHUNK - CHUNK / 2;
        const ground = new THREE.Mesh(terrainGeometry(x0, z0, CHUNK, this.profile.segments), this.terrainMat);
        ground.receiveShadow = true; ground.matrixAutoUpdate = false;
        group.add(ground);
        const rng = (i) => hash(cx * 37 + i * 2.7, cz * 19 + i * 1.3);
        const lists = {};
        const put = (kind, variant, pl) => { const key = `${kind}:${variant}`; (lists[key] || (lists[key] = { kind, variant, items: [] })).items.push(pl); };
        const far = (x, z, d) => !LANDMARKS.some((p) => Math.hypot(p.x - x, p.z - z) < d);
        // peças grandes (com colisão): 22 candidatos por bloco, como na simulação original
        for (let i = 0; i < 22; i++) {
            const x = cx * CHUNK + (rng(i) - 0.5) * 92, z3 = cz * CHUNK + (rng(i + 50) - 0.5) * 92, z = -z3;
            if (roadDistance(x, z) < 8 || !far(x, z, 31)) continue;
            const b = biome(x, z), r = rng(i + 80), r2 = rng(i + 30), rot = rng(i + 100) * Math.PI * 2, y = hAt(x, z3);
            let kind;
            if (b.canyon > 0.5) kind = r < 0.3 ? 'cactus' : r < 0.56 ? 'boulder' : r < 0.7 ? 'cliff' : r < 0.84 ? 'quiver' : 'boulder';
            else if (b.serra > 0.5) kind = r < 0.5 ? 'tree' : r < 0.8 ? 'boulder' : r < 0.9 ? 'cliff' : 'quiver';
            else if (b.north > 0.5) kind = r < 0.28 ? 'quiver' : r < 0.58 ? 'boulder' : r < 0.72 ? 'cactus' : r < 0.86 ? 'tree' : 'cliff';
            else kind = r < 0.3 ? 'tree' : r < 0.58 ? 'boulder' : r < 0.68 ? 'quiver' : null;
            if (!kind) continue;
            if (kind === 'boulder') { const s = 0.55 + r2 * 1.5; put(kind, 0, { x, y: y - s * 0.22, z: z3, s, rot, tx: (r2 - 0.5) * 0.3 }); colliders.push({ x, z, radius: s * 1.15 }); }
            else if (kind === 'cliff') {
                const s = 0.9 + r2 * 1.1;
                if (roadDistance(x, z) < 8 + s * 3) continue;
                put(kind, 0, { x, y: y - s * 0.6, z: z3, s, rot }); colliders.push({ x, z, radius: s * 2.7 });
            }
            else if (kind === 'quiver') { const s = 2.6 + r2 * 1.8; put(kind, 0, { x, y: y - 0.12, z: z3, s, rot }); colliders.push({ x, z, radius: 0.45 }); }
            else if (kind === 'cactus') { put(kind, i % 3, { x, y, z: z3, s: 0.75 + r2 * 0.5, rot }); colliders.push({ x, z, radius: 0.5 }); }
            else { put(kind, i % 2, { x, y: y - 0.15, z: z3, s: 0.75 + r2 * 0.5, rot }); colliders.push({ x, z, radius: 0.55 }); }
        }
        // miúdos sem colisão: arbustos, troncos caídos e pedras soltas
        const small = Math.round(46 * this.profile.scatter);
        for (let i = 0; i < small; i++) {
            const x = cx * CHUNK + (rng(i + 300) - 0.5) * 96, z3 = cz * CHUNK + (rng(i + 700) - 0.5) * 96, z = -z3;
            const rd = roadDistance(x, z);
            if (rd < 3.4 || !far(x, z, 13)) continue;
            const b = biome(x, z), r = rng(i + 900), r2 = rng(i + 1100), rot = r2 * Math.PI * 2, y = hAt(x, z3);
            if (r < 0.5 - b.canyon * 0.2) put('bush', i % 3, { x, y: y - 0.03, z: z3, s: 0.7 + r2 * 0.8, rot });
            else if (r < 0.58) put('trunk', 0, { x, y: y - 0.04, z: z3, s: 0.8 + r2 * 0.9, rot });
            else put('stone', i % 5, { x, y: y - 0.03, z: z3, s: 3 + r2 * 6, rot });
        }
        const shadows = this.profile.id !== 'low';
        for (const { kind, variant, items } of Object.values(lists)) {
            const cast = shadows ? kind !== 'stone' && kind !== 'bush' : kind === 'tree' || kind === 'cliff' || kind === 'cactus';
            for (const mesh of instanced(this.scatterKits[kind][variant], items, { cast })) group.add(mesh);
        }
        this.scene.add(group);
        return { group, colliders };
    }

    disposeChunk(c) {
        this.scene.remove(c.group);
        c.group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); else if (o.isMesh) o.geometry.dispose(); });
    }

    /** x, z em coordenadas da simulação. */
    update(x, z, immediate = false) {
        const cx = Math.round(x / CHUNK), cz = Math.round(-z / CHUNK), key = `${cx}:${cz}`;
        if (key !== this.center) {
            this.center = key;
            const needed = new Set(), candidates = [], r = this.profile.radius;
            for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
                const k = `${cx + dx}:${cz + dz}`;
                needed.add(k);
                if (!this.chunks.has(k)) candidates.push({ cx: cx + dx, cz: cz + dz, key: k, distance: dx * dx + dz * dz });
            }
            this.queue = candidates.sort((a, b) => a.distance - b.distance);
            for (const [k, c] of this.chunks) if (!needed.has(k)) { this.disposeChunk(c); this.chunks.delete(k); }
        }
        let count = immediate ? this.queue.length : 1;
        while (count-- > 0 && this.queue.length) { const job = this.queue.shift(); this.chunks.set(job.key, this.createChunk(job.cx, job.cz)); }
        this.colliders = [];
        for (const o of this.staticColliders) if (Math.abs(o.x - x) < 60 + o.radius && Math.abs(o.z - z) < 60 + o.radius) this.colliders.push(o);
        for (const c of this.chunks.values()) for (const o of c.colliders) if (Math.abs(o.x - x) < 50 && Math.abs(o.z - z) < 50) this.colliders.push(o);
    }

    async createLandmarks(onProgress = () => {}) {
        const k = this.kits, M = this.M;
        this.places = [];
        for (const p of LANDMARKS) {
            const root = new THREE.Group();
            const baseY = hAt(p.x, -p.z);
            root.position.set(p.x, baseY, -p.z);
            const gy = (lx, lz) => hAt(p.x + lx, -p.z + lz) - baseY;
            const clear = (lx, lz, d = 5) => roadDistance(p.x + lx, p.z - lz) > d;
            const B = new Batch(M), extras = [];
            const prop = (variant, lx, lz, { s = 1, ry = 0, y = 0, cast = true } = {}) => {
                const m = variantMesh(variant, { scale: s, castShadow: cast });
                m.position.set(lx, gy(lx, lz) + y, lz); m.rotation.y = ry;
                extras.push(m);
                return m;
            };
            const collide = (lx, lz, radius) => this.staticColliders.push({ x: p.x + lx, z: p.z - lz, radius });
            const barrel = k.barrels[0], barrel2 = k.barrels[1], crate = k.crate[0], lamp = k.lamp[0];
            const lampScale = 0.42 / Math.max(0.01, lamp.size.y);
            const fire = (lx, lz) => {
                const y = gy(lx, lz);
                prop(k.firepit[0], lx, lz, { s: 1.05, cast: false });
                campfireLogs(B, lx, y + 0.12, lz);
                this.addFire(p.x + lx, baseY + y + 0.3, -p.z + lz, p);
                prop(k.trunk[0], lx + 1.9, lz + 0.9, { s: 0.7, ry: 0.5 });
            };
            const folk = (i, mode, lx, lz, ry, y = null) => {
                const f = createFolk(i, mode);
                f.root.position.set(lx, y ?? gy(lx, lz), lz); f.root.rotation.y = ry;
                root.add(f.root);
                this.folk.push({ ...f, place: p });
            };
            if (p.kind === 'camp') {
                tent(B, gy, -5, -1, 0.55); collide(-5, -1, 2);
                fire(0, 0);
                prop(crate, 4, -2, { ry: 0.4 }); prop(crate, 4.25, -2.1, { ry: 1.2, y: crate.size.y * 0.98, s: 0.85 });
                prop(barrel, 5.1, -3.1, { ry: 1 });
                prop(lamp, 4.0, -1.9, { s: lampScale, y: crate.size.y });
                if (clear(-11, 5, 7)) { wagon(B, gy, -11, 5, 0.6, true); collide(-11, 5, 2); }
                hitchingPost(B, gy, 9, -2.5, 2.6, 0.3);
                // companheiro sentado no tronco, de frente para o fogo
                folk(p.id, 'sit', 1.75, 0.85, -2.0, gy(1.75, 0.85) - 0.22);
                if (p.id === 5) { folk(2, 'talk', -1.6, 1.2, 2.2); prop(barrel2, -2.6, -3.4); }
            } else {
                const label = p.kind === 'mine' ? 'MINA' : p.kind === 'ranch' ? 'RANCHO' : p.kind === 'town' ? 'CORREIO' : 'POSTO';
                const main = building(B, extras, gy, { x: -8, z: -3, w: p.kind === 'town' ? 7 : 6, d: 5, label, trim: p.kind === 'town' ? 'paint' : 'darkWood', body: p.kind === 'ranch' ? 'cream' : 'planks' });
                collide(-8, -3, Math.max(p.kind === 'town' ? 7 : 6, 5) * 0.55);
                fire(2, 3);
                prop(crate, 5, -2, { ry: 0.2 }); prop(crate, 5.8, -3.5, { ry: 1.3 }); prop(barrel, 6.4, -2.2); prop(barrel2, 4.2, -3.6, { ry: 2 });
                prop(lamp, -5.2, 1.05, { s: lampScale, y: main.porchY });
                prop(barrel, -10.6, 0.6, { y: main.porchY, ry: 0.7 });
                folk(p.id, p.kind === 'town' ? 'talk' : 'idle', -6.4, 0.7, 0.5, main.porchY);
                if (clear(-8, 4.4, 4.5)) hitchingPost(B, gy, -8, 4.6, 3);
                // cerca dos fundos (mesmo traçado do original) e cercado lateral
                if (p.kind !== 'mine') fence(B, gy, [0, 1, 2, 3, 4].map((i) => [-14 + i * 2.3, -10]));
                if (p.kind === 'town' || p.kind === 'ranch') {
                    building(B, extras, gy, { x: 9, z: -6, w: 5, d: 4, label: p.kind === 'town' ? 'ARMAZÉM' : 'ESTÁBULO', trim: p.kind === 'ranch' ? 'cream' : 'darkWood', body: p.kind === 'ranch' ? 'paint' : 'planks', chimney: p.kind === 'town' });
                    collide(9, -6, 5 * 0.55);
                }
                if (p.kind === 'town') {
                    if (clear(17, -15, 7)) { waterTower(B, gy, 17, -15); collide(17, -15, 2.4); }
                    if (clear(15, 2, 6)) { wagon(B, gy, 15, 2, -0.4, false); collide(15, 2, 1.8); }
                    folk(3, 'lean', 8.2, -3.4, 0.2, gy(9, -6) + 0.4);
                    this.pendingHorses.push({ root, coat: 'grey', clip: 'Idle_2', x: -8, z: 5.6, ry: Math.PI, gy });
                } else if (p.kind === 'ranch') {
                    if (clear(18, -16, 7)) { this.spinners.push({ mesh: windmill(B, gy, 18, -16), root }); collide(18, -16, 1.6); }
                    const cor = [[2, -12], [5.5, -12], [9, -12], [12.5, -12], [16, -12], [16, -15.5], [16, -19], [16, -22.5], [12.5, -22.5], [9, -22.5], [5.5, -22.5], [2, -22.5], [2, -19], [2, -15.5], [2, -12]];
                    fence(B, gy, cor, { rails: 3 });
                    for (const [fx, fz] of cor) if (Math.abs(Math.round(fx + fz)) % 2) collide(fx, fz, 0.9);
                    B.box(M.planks, 2.2, 0.5, 0.7, 4, gy(4, -14) + 0.3, -14); B.box(M.dark, 2.0, 0.05, 0.5, 4, gy(4, -14) + 0.5, -14);
                    this.pendingHorses.push({ root, coat: 'palomino', clip: 'Eating', x: 9.5, z: -17, ry: 2.2, gy, saddled: false });
                    this.pendingHorses.push({ root, coat: 'grey', clip: 'Idle', x: 12.5, z: -15, ry: -0.6, gy, saddled: false });
                } else if (p.kind === 'outpost') {
                    // a trilha passa a leste (x ≈ +10): torre, carroção e barricada ficam a oeste
                    if (clear(-17, -8, 6)) { watchtower(B, gy, -17, -8); collide(-17, -8, 2); }
                    if (clear(-16, 6, 7)) { wagon(B, gy, -16, 6, 1.2, false); collide(-16, 6, 1.9); }
                    prop(crate, -13.4, 7.6, { ry: 0.8 }); prop(barrel2, -13.2, 4.6);
                    fence(B, gy, [[-3, -13], [-0.7, -13.4], [1.6, -13.2]], { rails: 3 });
                } else if (p.kind === 'mine') {
                    // boca da mina a noroeste, longe da trilha (que passa em x ≈ +12)
                    mineEntrance(B, gy, -9, -17);
                    const cl = k.cliff[0];
                    prop(cl, -9, -21.5, { s: 1.6, y: -1.0, ry: 0 }); prop(cl, -15.5, -19.5, { s: 1.1, y: -0.8, ry: 1.9 }); prop(cl, -2.5, -19.5, { s: 1.15, y: -0.9, ry: -1.7 });
                    collide(-9, -20.5, 5.5); collide(-15.5, -19.5, 3); collide(-2.5, -19.5, 3);
                    prop(lamp, -10.6, -16.6, { s: lampScale * 1.2, y: 1.7 });
                    prop(barrel, -5.6, -13.2);
                }
            }
            const built = B.build();
            root.add(built);
            for (const m of extras) root.add(m);
            root.updateMatrixWorld(true);
            root.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !this.spinners.some((s) => s.mesh === o)) o.matrixAutoUpdate = false; });
            this.scene.add(root);
            this.places.push(root);
            onProgress(this.places.length / LANDMARKS.length);
            await new Promise((r) => setTimeout(r, 0));
        }
        for (const h of this.pendingHorses) {
            const horse = await createTetheredHorse(h.coat, h.clip, h.saddled !== false);
            horse.root.position.set(h.x, h.gy(h.x, h.z), h.z); horse.root.rotation.y = h.ry;
            h.root.add(horse.root);
            this.horses.push({ ...horse, parent: h.root });
        }
        this.pendingHorses = [];
    }
    pendingHorses = [];

    addFire(x, y, z3, place) {
        const flame = createParticles({ count: 26, life: 0.75, origin: new THREE.Vector3(x, y, z3), spread: new THREE.Vector3(0.16, 0.04, 0.16), velocity: new THREE.Vector3(0, 1.35, 0), velocitySpread: new THREE.Vector3(0.12, 0.3, 0.12), turbulence: 0.16, size: [0.55, 0.12], color: 0xffffff, opacity: 0.85, additive: true, stretch: 0.9 });
        flame.uniforms.uColor.value.setRGB(5.2, 1.9, 0.4);
        const smoke = createParticles({ count: 22, life: 6, origin: new THREE.Vector3(x, y + 0.5, z3), spread: new THREE.Vector3(0.1, 0.1, 0.1), velocity: new THREE.Vector3(0.35, 1.15, 0.1), velocitySpread: new THREE.Vector3(0.1, 0.2, 0.1), turbulence: 0.9, size: [0.35, 2.6], color: 0x9a948c, opacity: 0.16 });
        const sparks = createParticles({ count: 10, life: 1.6, origin: new THREE.Vector3(x, y + 0.2, z3), spread: new THREE.Vector3(0.12, 0.05, 0.12), velocity: new THREE.Vector3(0.1, 1.5, 0), velocitySpread: new THREE.Vector3(0.3, 0.6, 0.3), turbulence: 0.5, size: [0.05, 0.02], color: 0xffffff, opacity: 1, additive: true });
        sparks.uniforms.uColor.value.setRGB(9, 3.4, 0.6);
        for (const e of [flame, smoke, sparks]) { e.mesh.visible = false; this.scene.add(e.mesh); }
        this.fires.push({ x, y, z3, flame, smoke, sparks, place });
    }

    /** dt real, tempo total, posição (simulação) e hora do relógio do jogo. */
    animate(dt, time, x, z, elapsed) {
        const hour = worldClock(elapsed).hour;
        if (Math.abs(hour - this.sky.hour) > 0.02 || Math.abs(hour - this.sky.hour) > 23) this.sky.setHour(hour);
        this.sky.update(time, dt);
        this.focus.set(x, hAt(x, -z), -z);
        this.rig.update(this.focus, this.profile.shadowRadius);
        updateWind(time, 0.9 + Math.sin(time * 0.13) * 0.25);
        this.grass.update(x, -z);
        const vis = (this.profile.radius + 0.35) * CHUNK;
        for (let i = 0; i < this.places.length; i++) this.places[i].visible = Math.hypot(x - LANDMARKS[i].x, z - LANDMARKS[i].z) < vis;
        // fogueiras: partículas só por perto; as duas luzes vão para as duas mais próximas
        const near = [];
        const smokeCol = 0.25 + 0.75 * this.sky.daylight;
        for (const f of this.fires) {
            const d = Math.hypot(x - f.x, -z - f.z3), on = d < 150;
            f.flame.mesh.visible = f.smoke.mesh.visible = f.sparks.mesh.visible = on;
            if (!on) continue;
            f.flame.update(time); f.smoke.update(time); f.sparks.update(time);
            f.smoke.uniforms.uColor.value.setRGB(0.6 * smokeCol + 0.05, 0.58 * smokeCol + 0.04, 0.55 * smokeCol + 0.04);
            near.push([d, f]);
        }
        near.sort((a, b) => a[0] - b[0]);
        this.fireLights.forEach((l, i) => {
            const f = near[i]?.[1];
            if (!f || near[i][0] > 70) { l.intensity = 0; return; }
            const flick = 0.75 + 0.25 * Math.sin(time * 11 + f.x) * Math.sin(time * 7.3 + 1.7) + 0.1 * Math.sin(time * 23);
            l.position.set(f.x + Math.sin(time * 9) * 0.05, f.y + 0.55, f.z3);
            l.intensity = (9 + 26 * (1 - this.sky.daylight)) * flick;
        });
        const day = clamp(this.sky.daylight, 0, 1);
        this.fill.intensity = lerp(0.7, 1.25, day);
        this.fill.color.setRGB(lerp(0.5, 0.82, day), lerp(0.62, 0.89, day), 1);
        this.fill.groundColor.setRGB(lerp(0.16, 0.6, day), lerp(0.17, 0.46, day), lerp(0.22, 0.31, day));
        this.M.glass.emissiveIntensity = lerp(2.6, 0.18, clamp(this.sky.daylight * 1.4, 0, 1));
        for (const f of this.folk) if (Math.hypot(x - f.place.x, z - f.place.z) < 70) f.update(time);
        for (const h of this.horses) if (h.parent.visible && Math.hypot(x - h.parent.position.x, -z - h.parent.position.z) < 80) h.update(dt);
        for (const s of this.spinners) s.mesh.rotation.z -= dt * 1.4;
    }
}
