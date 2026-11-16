/**
 * Skyline da orla — a "muralha" de torres residenciais de Santos.
 *
 * Geometria: cada torre é um prisma com UV em unidades de fachada
 *   u = vãos (≈ 3,4 m)   v = pavimentos (3,0 m)
 * então fract(uv) endereça uma janela e floor(uv) a identifica (hash → cortina, luz acesa).
 * A fachada inteira é um único material PBR com shader procedural:
 *   - parede tingida por prédio, lajes marcadas, térreo com pilotis/vidro;
 *   - vidro = metalness alto + rugosidade baixa → espelha o céu (IBL) de dia e some à noite;
 *   - cortinas/persianas por janela; à noite ~38 % das janelas acendem (emissivo quente).
 * Varandas da primeira fila são geometria instanciada (laje + guarda-corpo de vidro),
 * o que dá paralaxe real quando se caminha na praia olhando para cima.
 *
 * Prédios tortos: ~9 torres antigas entre os canais 3 e 6 inclinam 1,2–2,2° (recalque em
 * solo de argila marinha) — fato real e marca visual de Santos.
 *
 * Tudo em 4 draw calls: torres, varandas (laje), guarda-corpos, topo/caixas d'água.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbr } from '../../shared/gfx/textures.js';
import { seeded } from '../../shared/gfx/core.js';
import { ZONES, CANALS, LAND_Y } from './config.js';
import { X_WEST, X_EAST } from './terrain.js';

const FLOOR_H = 3.0;
const BAY = 3.4;

const TINTS = [
    0xf2ede4, 0xe9e2d4, 0xdcd6ca, 0xf5f1ea, 0xd7dde0, 0xe6d8c2, 0xcfc6b8, 0xeae6de,
    0xd9c9b0, 0xc9d3d6, 0xf0e6d6, 0xe2ddd6, 0xbfc7cc, 0xe8d2bc
];
const ACCENTS = [0x7a8a94, 0x8a6a52, 0x556b7a, 0x9a9a92, 0x6e7f6a, 0xa0522d, 0x3f5266];

/** Lotes reservados (sem torre): avenidas dos canais e marcos. */
const RESERVED = [
    ...CANALS.map((c) => [c.x - 16, c.x + 16]),
    [-36, -4],  // Pinacoteca
    [70, 102],  // Basílica do Embaré
    [288, 352]  // Aquário / Ponta da Praia (prédios baixos)
];
const reserved = (x0, x1) => RESERVED.some(([a, b]) => x1 > a && x0 < b);

function towerGeometry(w, h, d, floors, bays, baysSide, tint, seed, kind) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(0, h / 2, 0);
    const uv = g.attributes.uv;
    // ordem das faces do BoxGeometry: +x, −x, +y, −y, +z, −z (4 vértices cada)
    for (let i = 0; i < uv.count; i++) {
        const face = Math.floor(i / 4);
        const nb = face < 2 ? baysSide : bays;
        if (face === 2 || face === 3) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * d / 4);
        else uv.setXY(i, uv.getX(i) * nb, uv.getY(i) * floors);
    }
    const n = g.attributes.position.count;
    const c = new THREE.Color(tint);
    const col = new Float32Array(n * 3);
    const info = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
        info[i * 2] = seed;
        info[i * 2 + 1] = kind;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(info, 2));
    return g;
}

function plainBox(w, h, d, x, y, z, tint, seed) {
    const g = towerGeometry(w, h, d, 1, 1, 1, tint, seed, 3);
    g.translate(x, y, z);
    return g;
}

function facadeMaterial(nightUniform) {
    const set = pbr('plaster');
    const m = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.86,
        metalness: 0,
        normalMap: set.normalMap,
        envMapIntensity: 1.0
    });
    m.normalScale.set(0.25, 0.25);
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uNightLights = nightUniform;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', `#include <common>
                attribute vec2 aInfo;
                varying vec2 vFacUv;
                varying vec2 vInfo;
                varying float vRoof;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vFacUv = uv;
                vInfo = aInfo;
                vRoof = step(0.5, abs(normal.y));`);
        sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', `#include <common>
                uniform float uNightLights;
                varying vec2 vFacUv;
                varying vec2 vInfo;
                varying float vRoof;
                float facGlass;
                float facRough;
                vec3 facEmit;
                float facHash(vec2 p) {
                    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
                    p3 += dot(p3, p3.yzx + 33.33);
                    return fract((p3.x + p3.y) * p3.z);
                }`)
            .replace('#include <color_fragment>', `#include <color_fragment>
                {
                    facGlass = 0.0; facRough = 0.86; facEmit = vec3(0.0);
                    vec3 wall = diffuseColor.rgb;
                    float kind = vInfo.y;
                    float seed = vInfo.x;
                    if (vRoof > 0.5 || kind > 2.5) {
                        // laje de cobertura / volumes técnicos
                        float n = facHash(floor(vFacUv * 6.0) + seed);
                        diffuseColor.rgb = mix(wall * 0.72, vec3(0.42, 0.42, 0.41), vRoof * 0.75) * (0.9 + 0.2 * n);
                    } else {
                        vec2 cell = floor(vFacUv);
                        vec2 f = fract(vFacUv);
                        float h1 = facHash(cell + seed * 17.0);
                        float h2 = facHash(cell * 1.7 + seed * 5.0 + 3.0);
                        float ground = step(vFacUv.y, 1.0);
                        vec2 wmin = kind < 0.5 ? vec2(0.07, 0.09) : kind < 1.5 ? vec2(0.2, 0.3) : vec2(0.025, 0.07);
                        vec2 wmax = kind < 0.5 ? vec2(0.93, 0.87) : kind < 1.5 ? vec2(0.8, 0.84) : vec2(0.975, 0.965);
                        // térreo: pano de vidro alto entre pilotis
                        wmin = mix(wmin, vec2(0.12, 0.04), ground);
                        wmax = mix(wmax, vec2(0.88, 0.8), ground);
                        vec2 aa = fwidth(vFacUv) * 1.2;
                        float inX = smoothstep(wmin.x - aa.x, wmin.x + aa.x, f.x) * (1.0 - smoothstep(wmax.x - aa.x, wmax.x + aa.x, f.x));
                        float inY = smoothstep(wmin.y - aa.y, wmin.y + aa.y, f.y) * (1.0 - smoothstep(wmax.y - aa.y, wmax.y + aa.y, f.y));
                        float inW = inX * inY;
                        // esquadria: borda + montante central (some ao longe, sem aliasing)
                        float fr = 0.022;
                        float inner = smoothstep(wmin.x + fr, wmin.x + fr + aa.x, f.x) * (1.0 - smoothstep(wmax.x - fr - aa.x, wmax.x - fr, f.x))
                            * smoothstep(wmin.y + fr, wmin.y + fr + aa.y, f.y) * (1.0 - smoothstep(wmax.y - fr - aa.y, wmax.y - fr, f.y));
                        float mull = 1.0 - smoothstep(0.008, 0.008 + aa.x, abs(f.x - 0.5));
                        float detail = 1.0 - smoothstep(0.0, 0.5, max(aa.x, aa.y) * 6.0);
                        float glass = inW * mix(1.0, inner * (1.0 - mull), detail);
                        float frame = inW - glass;

                        // parede: laje marcada, leve variação por pavimento, sujeira descendo
                        float slab = 1.0 - smoothstep(0.045, 0.045 + aa.y, f.y);
                        vec3 wcol = wall * (0.96 + 0.06 * facHash(vec2(cell.y, seed)));
                        wcol = mix(wcol, wall * 1.06, slab * (1.0 - ground));
                        float streak = facHash(vec2(floor(vFacUv.x * 9.0), seed)) * smoothstep(0.0, 0.5, f.y);
                        wcol *= 1.0 - 0.07 * streak;
                        // sombra do peitoril/laje de cima sobre a janela
                        float reveal = smoothstep(wmax.y - 0.16, wmax.y, f.y);
                        wcol = mix(wcol, wall * 0.5, ground * 0.35);

                        // vidro: cortina/persiana em parte das janelas
                        float curtain = step(0.6, h1) * (1.0 - ground);
                        float blind = step(f.y, wmin.y + (wmax.y - wmin.y) * (0.35 + 0.65 * h2));
                        vec3 curtainCol = mix(vec3(0.78, 0.74, 0.66), vec3(0.62, 0.66, 0.7), step(0.5, h2));
                        float cur = curtain * mix(1.0, blind, step(0.8, h1));
                        vec3 gcol = mix(vec3(0.34, 0.42, 0.5), curtainCol, cur);
                        gcol *= 1.0 - reveal * 0.45;

                        vec3 col = mix(wcol, vec3(0.86, 0.87, 0.88) * (0.75 + 0.25 * step(0.5, seed)), frame);
                        col = mix(col, gcol, glass);
                        diffuseColor.rgb = col;
                        facGlass = glass * (1.0 - cur);
                        facRough = mix(0.86, mix(0.07, 0.6, cur), glass);

                        // luzes à noite
                        float lit = step(1.0 - 0.38 * uNightLights - ground * 0.3, h2) * step(0.02, uNightLights);
                        vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(0.72, 0.84, 1.0), step(0.86, h1));
                        float room = 0.45 + 0.55 * smoothstep(wmin.y, wmax.y, f.y) + 0.25 * sin(f.x * 9.0 + h1 * 6.0);
                        facEmit = warm * glass * lit * room * uNightLights * (1.3 + 1.4 * h1) * mix(1.0, 0.45, cur);
                    }
                }`)
            .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
                roughnessFactor = facRough;`)
            .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
                metalnessFactor = facGlass * 0.88;`)
            .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
                totalEmissiveRadiance += facEmit;`);
    };
    m.customProgramCacheKey = () => 'orlaFacade';
    return m;
}

export function createCity(quality) {
    const root = new THREE.Group();
    root.name = 'city';
    const rnd = seeded(0x5a705);
    const uNight = { value: 0 };

    const towers = [];
    const tops = [];
    const slabs = [];   // { matrix, sx, sz }
    const rails = [];
    const footprints = [];
    const m4 = new THREE.Matrix4();
    const tilt = new THREE.Matrix4();
    const local = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();

    const addTower = ({ x, z, w, d, floors, front, lean = 0, leanDir = 0 }) => {
        const h = floors * FLOOR_H;
        const bays = Math.max(2, Math.round(w / BAY));
        const baysSide = Math.max(2, Math.round(d / BAY));
        const tint = rnd.pick(TINTS);
        const seed = rnd();
        const kind = front ? (rnd() < 0.72 ? 0 : rnd() < 0.6 ? 1 : 2) : (rnd() < 0.4 ? 0 : rnd() < 0.75 ? 1 : 2);
        const g = towerGeometry(w, h, d, floors, bays, baysSide, tint, seed, kind);
        // inclinação em torno da base
        e.set(Math.sin(leanDir) * lean, 0, Math.cos(leanDir) * lean);
        q.setFromEuler(e);
        tilt.compose(new THREE.Vector3(x, LAND_Y, z - d / 2), q, new THREE.Vector3(1, 1, 1));
        g.applyMatrix4(tilt);
        towers.push(g);
        footprints.push({ x, z: z - d / 2, w, d, h });

        // coroamento: platibanda, casa de máquinas, caixa d'água
        const accent = rnd.pick(ACCENTS);
        const topParts = [
            plainBox(w + 0.3, 0.9, d + 0.3, 0, h, 0, tint, seed),
            plainBox(w * 0.34, 3.2, d * 0.4, (rnd() - 0.5) * w * 0.3, h + 0.9, (rnd() - 0.5) * d * 0.2, accent, seed),
            plainBox(w * 0.16, 2.2, d * 0.2, (rnd() - 0.5) * w * 0.5, h + 0.9, (rnd() - 0.5) * d * 0.5, 0xbfc2c4, seed)
        ];
        if (front && rnd() < 0.5) topParts.push(plainBox(w * 0.9, 0.35, d * 0.7, 0, h + 2.9, -d * 0.1, accent, seed)); // pérgola/laje de lazer
        // embasamento: marquise sobre a entrada
        if (front) topParts.push(plainBox(Math.min(8, w * 0.5), 0.3, 3.2, 0, FLOOR_H + 0.25, d / 2 + 1.4, 0xe9e6df, seed));
        for (const t of topParts) {
            t.applyMatrix4(tilt);
            tops.push(t);
        }

        // varandas voltadas para o mar (fila da frente, tipologia residencial)
        if (front && kind === 0) {
            const continuous = rnd() < 0.62;
            const bw = w / bays;
            const depth = 1.25 + rnd() * 0.4;
            const railTint = rnd() < 0.7 ? 0 : 1;
            for (let f = 1; f < floors; f++) {
                const y = f * FLOOR_H;
                const units = continuous ? [[0, w * 0.96]] : Array.from({ length: bays }, (_, b) => [(-w / 2) + bw * (b + 0.5), bw * 0.82]);
                for (const [cx, sw] of units) {
                    local.makeTranslation(cx, y, d / 2 + depth / 2);
                    m4.multiplyMatrices(tilt, local);
                    slabs.push({ m: m4.clone(), sx: sw, sz: depth });
                    local.makeTranslation(cx, y + 0.6, d / 2 + depth - 0.03);
                    m4.multiplyMatrices(tilt, local);
                    rails.push({ m: m4.clone(), sx: sw, tint: railTint });
                }
            }
        }
    };

    // ---------- fila da frente ----------
    let x = X_WEST + 6;
    while (x < X_EAST - 8) {
        let w = 15 + rnd() * 10;
        if (reserved(x, x + w)) {
            // tenta encaixar uma torre mais estreita no vão que sobrou antes do lote reservado
            const hit = RESERVED.filter(([a, b]) => x + w > a && x < b).sort((p, q) => p[0] - q[0])[0];
            const room = hit[0] - x - 1;
            if (room >= 11) w = room;
            else {
                x = hit[1] + 1 + rnd() * 1.5;
                continue;
            }
        }
        const central = 1 - Math.min(1, Math.abs(x + w / 2 - 20) / 330);
        const floors = Math.round(11 + rnd() * 9 + central * 5);
        const cx = x + w / 2;
        const old = cx > -50 && cx < 225 && floors < 19 && rnd() < 0.34;
        addTower({
            x: cx, z: ZONES.buildFront - 1 - rnd() * 3, w, d: 16 + rnd() * 7, floors, front: true,
            lean: old ? THREE.MathUtils.degToRad(1.2 + rnd()) : 0, leanDir: rnd() * Math.PI * 2
        });
        x += w + 2.5 + rnd() * 3.5;
    }

    // ---------- filas de trás (preenchem o skyline) ----------
    const rows = [-64, -98, -134, -176, -224, -280, -350, -430];
    let placed = 0;
    for (const rz of rows) {
        let bx = X_WEST + 4 + rnd() * 10;
        while (bx < X_EAST - 6 && placed < quality.buildingsBack) {
            const w = 13 + rnd() * 12;
            if (CANALS.some((c) => bx + w + 1 > c.x - 15 && bx - 1 < c.x + 15)) {
                bx += 8;
                continue;
            }
            const depthK = Math.min(1, Math.abs(rz) / 430);
            if (rnd() < 0.2 + depthK * 0.35) {
                bx += w + 6;
                continue;
            }
            const floors = Math.round(5 + rnd() * (14 - depthK * 7) + (rnd() < 0.12 ? 8 : 0));
            addTower({ x: bx + w / 2, z: rz + rnd() * 8, w, d: 14 + rnd() * 9, floors, front: false });
            placed++;
            bx += w + 5 + rnd() * 9;
        }
    }

    const facade = facadeMaterial(uNight);
    const towerMesh = new THREE.Mesh(mergeGeometries(towers), facade);
    towerMesh.castShadow = true;
    towerMesh.receiveShadow = true;
    const topMesh = new THREE.Mesh(mergeGeometries(tops), facade);
    topMesh.castShadow = true;
    root.add(towerMesh, topMesh);
    towers.forEach((g) => g.dispose());
    tops.forEach((g) => g.dispose());

    // ---------- varandas instanciadas ----------
    const slabGeo = new THREE.BoxGeometry(1, 0.14, 1);
    const slabMat = pbr('plaster', { color: 0xf1eee8 });
    const slabMesh = new THREE.InstancedMesh(slabGeo, slabMat, slabs.length);
    const railGeo = new THREE.BoxGeometry(1, 1.05, 0.05);
    const railMat = new THREE.MeshPhysicalMaterial({
        color: 0x86a39c, roughness: 0.08, metalness: 0.55, envMapIntensity: 1.1
    });
    const railMesh = new THREE.InstancedMesh(railGeo, railMat, rails.length);
    const sc = new THREE.Matrix4();
    const col = new THREE.Color();
    slabs.forEach((s, i) => {
        sc.makeScale(s.sx, 1, s.sz);
        slabMesh.setMatrixAt(i, m4.multiplyMatrices(s.m, sc));
    });
    rails.forEach((r, i) => {
        sc.makeScale(r.sx, 1, 1);
        railMesh.setMatrixAt(i, m4.multiplyMatrices(r.m, sc));
        railMesh.setColorAt(i, col.set(r.tint ? 0xe8e6e0 : 0xffffff));
    });
    slabMesh.castShadow = true;
    slabMesh.receiveShadow = true;
    slabMesh.instanceMatrix.needsUpdate = true;
    railMesh.instanceMatrix.needsUpdate = true;
    if (railMesh.instanceColor) railMesh.instanceColor.needsUpdate = true;
    slabMesh.computeBoundingSphere();
    railMesh.computeBoundingSphere();
    root.add(slabMesh, railMesh);

    return {
        root,
        footprints,
        facade,
        setNight(k) {
            uNight.value = k;
        }
    };
}
