/**
 * O mundo: vegetação das margens, pássaros e o "diretor" que decide o que
 * aparece à frente do jogador conforme ele avança rumo ao castelo.
 */

import * as THREE from 'three';
import { createTreeKit } from '../../shared/gfx/terrain.js';
import { createCreature } from '../../shared/gfx/creature.js';
import { loadModel } from '../../shared/gfx/assets.js';
import { buildReedGeometry, applyVegetationWind } from './models.js?v=60';
import { centerX, halfWidth, terrainHeight } from './river.js?v=60';
import { COURSE_LENGTH, BOSS_Z, CASTLE_Z } from './config.js?v=60';
import { clamp, randRange, pick } from './utils.js?v=60';

const SPAWN_AHEAD = 430;
const RECYCLE_BEHIND = 90;

/* ------------------------------------------------------------------ */
/* Vegetação e rochas instanciadas                                     */
/* ------------------------------------------------------------------ */

const _dummy = new THREE.Object3D();
const _mat = new THREE.Matrix4();

/**
 * Faixa de objetos reciclados ao longo das margens. Cada item que fica para
 * trás do jogador é replantado à frente (nada é criado durante a partida).
 *
 * `near`/`far` são listas de partes `{ geometry, material, shadow }` (o formato
 * dos kits de árvore). Com `far`, a faixa tem dois níveis de detalhe: a cada
 * 0,2 s os itens a menos de `lod` metros do jogador (em Z) vão para as malhas
 * detalhadas e os demais para as simplificadas — a mata do horizonte custa
 * uma fração dos triângulos.
 */
class Scatter {
    constructor(scene, near, count, {
        far = null,
        lod = 120,
        minDist,
        maxDist,
        scale,
        sink = 0.6,
        minHeight = 0.8,
        maxSlope = 1.35,
        keepAfloat = false,
        yScale = 1,
        tilt = 0.06,
        bias = 1.55
    }) {
        const build = (parts) => parts.map((p) => {
            const mesh = new THREE.InstancedMesh(p.geometry, p.material, count);
            mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
            mesh.castShadow = p.shadow !== false && !keepAfloat;
            mesh.receiveShadow = true;
            mesh.frustumCulled = false;
            mesh.count = 0;
            scene.add(mesh);
            return mesh;
        });
        this.near = build(near);
        this.far = far ? build(far) : null;
        this.lod = lod;
        this.count = count;
        this.minDist = minDist;
        this.maxDist = maxDist;
        this.scaleRange = scale;
        this.sink = sink;
        this.minHeight = minHeight;
        this.maxSlope = maxSlope;
        this.keepAfloat = keepAfloat;
        this.yScale = yScale;
        this.tilt = tilt;
        this.bias = bias;
        this.items = new Array(count);
        this.timer = 0;
        this.dirty = true;
        for (let i = 0; i < count; i++) {
            this.items[i] = { x: 0, y: 0, z: 0, scale: 1, rot: 0, tilt: 0, valid: false, matrix: new THREE.Matrix4() };
        }
    }

    /** Sorteia uma posição válida na margem, na frente do jogador. */
    _place(item, z) {
        const side = Math.random() < 0.5 ? -1 : 1;
        // Viés para perto da margem (mais densidade visual na beira do rio).
        const u = Math.pow(Math.random(), this.bias);
        const dist = this.minDist + u * (this.maxDist - this.minDist);
        const x = centerX(z) + side * (halfWidth(z) + dist);
        const y = terrainHeight(x, z);
        // Amostra vizinhos: evita “flutuadores” em encostas muito íngremes.
        const eps = 1.4;
        const yL = terrainHeight(x - eps, z);
        const yR = terrainHeight(x + eps, z);
        const yD = terrainHeight(x, z - eps);
        const yU = terrainHeight(x, z + eps);
        const slope = Math.max(Math.abs(yL - yR), Math.abs(yD - yU)) / (2 * eps);
        item.x = x;
        item.y = this.keepAfloat ? Math.max(y, -0.15) - this.sink : y - this.sink;
        item.z = z;
        item.scale = randRange(this.scaleRange[0], this.scaleRange[1]);
        item.rot = randRange(0, Math.PI * 2);
        item.tilt = randRange(-this.tilt, this.tilt);
        // nada cresce dentro do castelo
        if (Math.abs(z - CASTLE_Z) < 95 && !this.keepAfloat) {
            item.valid = false;
            return;
        }
        item.valid = this.keepAfloat
            ? y < 1.2 && y > -1.6 && slope < this.maxSlope
            : y > this.minHeight && slope < this.maxSlope;
        const d = _dummy;
        d.position.set(item.x, item.y, item.z);
        d.rotation.set(item.tilt, item.rot, item.tilt * 0.6);
        d.scale.set(item.scale, item.scale * this.yScale, item.scale);
        d.updateMatrix();
        item.matrix.copy(d.matrix);
        this.dirty = true;
    }

    /** Distribui tudo de uma vez ao (re)iniciar a partida. */
    reset(playerZ) {
        for (let i = 0; i < this.count; i++) {
            const z = playerZ + 60 - (i / this.count) * (SPAWN_AHEAD + 120) * 1.1 - randRange(0, 12);
            this._place(this.items[i], z);
        }
        this._write(playerZ);
    }

    _write(playerZ) {
        let nn = 0;
        let nf = 0;
        for (let i = 0; i < this.count; i++) {
            const item = this.items[i];
            if (!item.valid) continue;
            const isNear = !this.far || Math.abs(item.z - playerZ + 30) < this.lod;
            if (isNear) {
                for (const m of this.near) m.setMatrixAt(nn, item.matrix);
                nn++;
            } else {
                for (const m of this.far) m.setMatrixAt(nf, item.matrix);
                nf++;
            }
        }
        for (const m of this.near) {
            m.count = nn;
            m.instanceMatrix.needsUpdate = true;
        }
        if (this.far) {
            for (const m of this.far) {
                m.count = nf;
                m.instanceMatrix.needsUpdate = true;
            }
        }
        this.dirty = false;
    }

    update(playerZ, dt = 0.016) {
        for (let i = 0; i < this.count; i++) {
            const item = this.items[i];
            if (item.z > playerZ + RECYCLE_BEHIND) {
                this._place(item, playerZ - SPAWN_AHEAD - randRange(0, 80));
            }
        }
        this.timer -= dt;
        if (this.dirty || (this.far && this.timer <= 0)) {
            this.timer = 0.2;
            this._write(playerZ);
        }
    }
}

/**
 * Simplificação por aglomeração de vértices: o volume do modelo é dividido em
 * `cells`³ células; todos os vértices de uma célula viram um só (o primeiro
 * encontrado, com sua UV) e os triângulos que colapsam são descartados.
 * Os modelos fotogramétricos do kit têm 13–45 mil triângulos — demais para
 * dezenas de instâncias; com 12–18 células ficam em ~1–2,5 mil e a textura
 * (albedo + normal map) segura o detalhe.
 */
function decimate(geometry, cells) {
    const src = geometry.index ? geometry.toNonIndexed() : geometry;
    const pos = src.attributes.position;
    const uv = src.attributes.uv;
    src.computeBoundingBox();
    const bb = src.boundingBox;
    const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z) || 1;
    const k = cells / size;
    const map = new Map();
    const outPos = [];
    const outUv = [];
    const index = [];
    const tri = [0, 0, 0];
    for (let i = 0; i < pos.count; i += 3) {
        for (let j = 0; j < 3; j++) {
            const x = pos.getX(i + j);
            const y = pos.getY(i + j);
            const z = pos.getZ(i + j);
            const key = (Math.round((x - bb.min.x) * k) * 73856093) ^ (Math.round((y - bb.min.y) * k) * 19349663) ^ (Math.round((z - bb.min.z) * k) * 83492791);
            let id = map.get(key);
            if (id === undefined) {
                id = outPos.length / 3;
                map.set(key, id);
                outPos.push(x, y, z);
                if (uv) outUv.push(uv.getX(i + j), uv.getY(i + j));
            }
            tri[j] = id;
        }
        if (tri[0] !== tri[1] && tri[1] !== tri[2] && tri[0] !== tri[2]) index.push(tri[0], tri[1], tri[2]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3));
    if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
}

/** Partes de um modelo glTF do kit (geometria na escala final, simplificada em `cells`). */
async function modelParts(name, opts, cells = 14) {
    const obj = await loadModel(name, opts);
    if (!obj) return null;
    obj.updateMatrixWorld(true);
    const parts = [];
    obj.traverse((c) => {
        if (!c.isMesh) return;
        const g = decimate(c.geometry.clone().applyMatrix4(c.matrixWorld), cells);
        parts.push({ geometry: g, material: c.material, shadow: true });
    });
    return parts.length ? parts : null;
}

/* ------------------------------------------------------------------ */
/* Aves                                                                */
/* ------------------------------------------------------------------ */

/**
 * Bando de gansos em "V" cruzando o vale + aves pequenas em círculo.
 * Cada ave é um `createCreature` (malha com esqueleto, asas batendo em `fly`).
 * O bando descreve uma elipse à frente do jogador:
 *   centro = (centroDoRio(z₀), altura, z₀),  z₀ = zJogador − 150
 *   p(φ) = centro + (R·cos φ, 0, 0,55·R·sin φ),  φ' = v / R
 * e cada ave ocupa um posto fixo do "V" em relação ao líder.
 */
class Birds {
    constructor(scene, count = 8) {
        this.flock = [];
        const geese = Math.min(5, Math.max(0, count - 3));
        for (let i = 0; i < count; i++) {
            const goose = i < geese;
            const c = createCreature(goose ? 'goose' : 'bird', { detail: 0, seed: i + 1 });
            c.object.scale.setScalar(goose ? 1.6 : 2.2);
            scene.add(c.object);
            const rank = Math.ceil(i / 2);
            this.flock.push({
                c,
                goose,
                // posto no "V": atrás e ao lado do líder
                back: goose ? rank * 3.4 : 0,
                side: goose ? (i % 2 ? 1 : -1) * rank * 2.6 : 0,
                phase: goose ? 0 : Math.random() * Math.PI * 2,
                radius: goose ? 95 : randRange(28, 60),
                height: goose ? 34 : randRange(16, 30),
                speed: goose ? 15 : randRange(8, 11),
                state: { mode: 'fly' }
            });
        }
        this.phase = 0;
    }

    update(dt, time, playerZ) {
        this.phase += (dt * 15) / 95;
        const z0 = playerZ - 150;
        const cx = centerX(z0);
        for (const b of this.flock) {
            let ph;
            if (b.goose) ph = this.phase - b.back / b.radius;
            else {
                b.phase += (dt * b.speed) / b.radius;
                ph = b.phase;
            }
            const r = b.radius + b.side;
            const x = cx + Math.cos(ph) * r;
            const z = z0 + 40 + Math.sin(ph) * r * 0.55;
            const o = b.c.object;
            o.position.set(x, b.height + Math.sin(time * 0.6 + b.radius) * 1.5, z);
            // tangente da elipse → rumo (frente da criatura = +Z)
            o.rotation.y = Math.atan2(-Math.sin(ph), Math.cos(ph) * 0.55);
            b.c.update(dt, b.state);
        }
    }
}

/* ------------------------------------------------------------------ */
/* Diretor de encontros                                                */
/* ------------------------------------------------------------------ */

export class World {
    constructor(scene, quality) {
        const s = quality.scatterScale;
        const low = quality.id === 'low';
        // folhas das folhosas um tom abaixo do padrão do kit (ao entardecer o verde-limão estoura)
        const LEAF = { betula: { leafColor: 0xa9b27c }, carvalho: { leafColor: 0x98a37e } };
        const kit = (species, seed, detail) => createTreeKit({ species, seed, detail, params: LEAF[species] || {} }).parts;
        const trees = (species, seed, count, opts) => new Scatter(scene, kit(species, seed, low ? 0 : quality.id === 'high' ? 2 : 1), Math.round(count * s), {
            far: low ? null : kit(species, seed, 0),
            lod: quality.id === 'high' ? 85 : 70,
            sink: 0.25,
            tilt: 0.04,
            minHeight: 2.2,
            ...opts
        });
        // Mata de coníferas com bétulas e carvalhos na beira (duas sementes de pinheiro = duas árvores distintas).
        this.scatters = [
            trees('pinheiro', 1, 170, { minDist: 9, maxDist: 110, scale: [0.8, 1.35], maxSlope: 1.1, bias: 1.2 }),
            trees('pinheiro', 4, 150, { minDist: 12, maxDist: 120, scale: [0.7, 1.2], maxSlope: 1.1, bias: 1.1 }),
            trees('betula', 2, 90, { minDist: 6, maxDist: 60, scale: [0.8, 1.25], maxSlope: 0.9 }),
            trees('carvalho', 3, 44, { minDist: 8, maxDist: 70, scale: [0.75, 1.2], maxSlope: 0.8 })
        ];

        // Juncos na linha d'água.
        const reedMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide });
        applyVegetationWind(reedMat, 0.22);
        this.reedMaterial = reedMat;
        this.scatters.push(new Scatter(scene, [{ geometry: buildReedGeometry(), material: reedMat, shadow: false }], quality.reeds ?? 280, {
            minDist: -1.5,
            maxDist: 4.5,
            scale: [0.3, 0.6],
            sink: 0.05,
            maxSlope: 2.4,
            keepAfloat: true,
            yScale: 1.6
        }));
        this.scene = scene;
        this.quality = quality;

        this.birds = quality.birds === 0 ? null : new Birds(scene, low ? 0 : Math.min(8, quality.birds ?? 8));
        this.nextSpawnZ = 0;
        this.lastKind = null;
        this._fishAcc = 0;
        this._z = 0;
    }

    /**
     * Rochas e samambaias fotogramétricas das margens (assíncrono: os modelos
     * glTF chegam depois; a partida não depende deles).
     */
    async loadAssets() {
        const s = this.quality.scatterScale;
        const add = (parts, count, opts) => {
            if (!parts) return;
            const sc = new Scatter(this.scene, parts, Math.round(count * s), opts);
            sc.reset(this._z);
            this.scatters.push(sc);
        };
        const [boulder, slab, face, stump] = await Promise.all([
            modelParts('rock_07', { height: 1 }, 14),
            modelParts('rock_09', { height: 1 }, 14),
            modelParts('rock_face_01', { height: 1 }, 20),
            modelParts('tree_stump_01', { height: 1 }, 18)
        ]);
        // pedras de praia (meio enterradas, algumas dentro d'água com espuma do shader ao redor)
        add(boulder, 70, { minDist: -2.5, maxDist: 12, scale: [0.9, 3.2], sink: 0.35, minHeight: -1.2, maxSlope: 1.6, tilt: 0.3 });
        add(slab, 46, { minDist: 0, maxDist: 26, scale: [1.2, 4.2], sink: 0.4, minHeight: -0.6, maxSlope: 2.2, tilt: 0.25 });
        // paredões soltos nas encostas e falésias
        add(face, 34, { minDist: 9, maxDist: 44, scale: [5, 12], sink: 1.2, minHeight: 2, maxSlope: 6, tilt: 0.12, bias: 1 });
        add(stump, 20, { minDist: 4, maxDist: 30, scale: [0.6, 1.1], sink: 0.08, minHeight: 2, maxSlope: 0.6 });
    }

    reset(playerZ) {
        this._z = playerZ;
        for (const sc of this.scatters) sc.reset(playerZ);
        this.nextSpawnZ = playerZ - 70;
        this.lastKind = null;
    }

    update(dt, time, playerZ, effects) {
        this._z = playerZ;
        for (const sc of this.scatters) sc.update(playerZ, dt);
        this.reedMaterial.userData.uniforms.uTime.value = time;
        this.birds?.update(dt, time, playerZ);

        if (effects) {
            this._fishAcc += dt;
            if (this._fishAcc > 0.55) {
                this._fishAcc = 0;
                if (Math.random() < 0.45) {
                    const z = playerZ - randRange(18, 90);
                    const x = centerX(z) + randRange(-0.7, 0.7) * halfWidth(z);
                    effects.splash(x, 0.12, z, 6, 0.7);
                }
            }
        }
    }

    /**
     * Sorteia encontros à frente do jogador. A mistura muda com o progresso:
     * o começo é quase só navegação, o fim é um corredor de guerra.
     */
    direct(playerZ, entities, difficulty) {
        const progress = clamp(-playerZ / COURSE_LENGTH, 0, 1);

        while (this.nextSpawnZ > playerZ - SPAWN_AHEAD) {
            const z = this.nextSpawnZ;
            if (z > BOSS_Z + 130) this._spawnEncounter(z, progress, entities, difficulty);

            const gap = randRange(36, 78) / (0.85 + difficulty.spawnScale * 0.5 + progress * 0.55);
            this.nextSpawnZ -= Math.max(26, gap);
            if (this.nextSpawnZ < BOSS_Z + 130) break;
        }
    }

    _spawnEncounter(z, progress, entities, difficulty) {
        const cx = centerX(z);
        const hw = halfWidth(z);
        const lane = () => randRange(-0.62, 0.62);

        // Pesos por fase da jornada.
        const weights = [
            ['rock', 16 - progress * 6],
            ['pickup', 22 - progress * 5],
            ['enemyShip', 14 + progress * 22],
            ['tower', 12 + progress * 20],
            ['barricade', 8 + progress * 12],
            ['whirlpool', 4 + progress * 8]
        ];

        // Evita repetir o mesmo tipo duas vezes seguidas.
        const total = weights.reduce((sum, [kind, w]) => sum + (kind === this.lastKind ? w * 0.35 : w), 0);
        let roll = Math.random() * total;
        let kind = 'rock';
        for (const [k, w] of weights) {
            roll -= k === this.lastKind ? w * 0.35 : w;
            if (roll <= 0) {
                kind = k;
                break;
            }
        }
        this.lastKind = kind;

        switch (kind) {
            case 'rock': {
                const cluster = Math.random() < 0.45 ? 2 : 1;
                const base = lane();
                for (let i = 0; i < cluster; i++) {
                    const l = clamp(base + randRange(-0.22, 0.22), -0.8, 0.8);
                    entities.spawnRock(cx + l * hw, z - i * randRange(6, 14), randRange(0.7, 1.15));
                }
                break;
            }
            case 'pickup': {
                const type = Math.random() < 0.58
                    ? 'coin'
                    : Math.random() < 0.5
                        ? 'heart'
                        : pick(['shield', 'fury']);
                const l = lane();
                const count = type === 'coin' ? 3 : 1;
                for (let i = 0; i < count; i++) {
                    entities.spawnPickup(cx + l * hw + randRange(-1, 1), z - i * 7, type);
                }
                break;
            }
            case 'enemyShip': {
                entities.spawnEnemyShip(cx + lane() * hw, z, {
                    fireRate: (2.9 - progress * 1.1) / difficulty.enemyFireScale,
                    speed: randRange(5, 9) + progress * 4
                });
                if (progress > 0.55 && Math.random() < 0.35) {
                    entities.spawnEnemyShip(cx + lane() * hw, z - randRange(18, 34), {
                        fireRate: 3.2 / difficulty.enemyFireScale,
                        speed: randRange(5, 8)
                    });
                }
                break;
            }
            case 'tower': {
                const side = Math.random() < 0.5 ? -1 : 1;
                // Mais perto da água — alcançáveis com canhão assistido.
                const x = cx + side * (hw + randRange(1.6, 6.5));
                entities.spawnTower(x, z, { fireRate: (3.6 - progress * 1.3) / difficulty.enemyFireScale });
                break;
            }
            case 'barricade': {
                // Deixa sempre um vão navegável.
                const l = lane();
                entities.spawnBarricade(cx + l * hw, z);
                if (Math.random() < 0.35) {
                    entities.spawnBarricade(cx + clamp(l + (l > 0 ? -0.55 : 0.55), -0.7, 0.7) * hw, z - randRange(9, 18));
                }
                break;
            }
            case 'whirlpool':
                entities.spawnWhirlpool(cx + lane() * hw * 0.8, z);
                break;
            default:
                break;
        }
    }
}
