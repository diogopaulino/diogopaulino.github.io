/* Claude Bros — o terreno jogável em 3D: ilhas de chão, degraus de pedra, ilhotas
 * flutuantes e a torre do estandarte, gerados a partir do mapa de tiles.
 *
 * Cada trecho contíguo de tiles vira uma "massa de terra" modelada:
 *   · tampo: grade (≈25 cm) com relevo — plano exato na faixa de jogo (|z| < 0,7 m,
 *     onde vale a colisão da lógica) e ondulado para trás; a borda desce 7 cm
 *     (lábio arredondado) e continua numa saia de capim que cai pelas laterais,
 *     com barra irregular.
 *   · paredes: anéis descendo a partir do contorno, deslocados para fora por
 *     ruído (fBm em comprimento-de-arco × profundidade) → paredão irregular. Os
 *     primeiros anéis usam o material de terra (faixa estratificada) e o resto,
 *     rocha. Nas paredes laterais perto do plano de jogo o deslocamento é
 *     reduzido para o visual não desmentir a colisão.
 *   · ilhotas: as paredes afunilam para dentro ( o(d) = −(d/D)^1,8 · afunilamento )
 *     e fecham por baixo com uma barriga de rocha.
 * Todas as massas são fundidas em 3 malhas (capim, terra, rocha) = 3 draw calls.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbrMaterial, loadModel } from '../../shared/gfx/assets.js';
import { applyWorldUV, fbm2, noise2, seeded, smoothstep, lerp } from '../../shared/gfx/core.js';
import { LEVEL, COLS, GROUND_ROW } from './config.js';

export const Z_FRONT = 1.75;
export const Z_BACK = -7.2;

/* ------------------------------------------------------------ leitura do mapa --- */

/** Agrupa os tiles em trechos: chão, degraus (apoiados no chão), ilhotas e torres. */
export function readLevel() {
    const at = (r, c) => (LEVEL[r] || '')[c] || ' ';
    const grounds = [];
    const steps = [];
    const islets = [];
    const towers = [];
    for (let c = 0; c < COLS; c++) {
        if (at(GROUND_ROW, c) !== '#') continue;
        let end = c;
        while (at(GROUND_ROW, end + 1) === '#') end++;
        grounds.push({ x0: c, x1: end + 1 });
        c = end;
    }
    const used = new Set();
    for (let r = 0; r < GROUND_ROW; r++) {
        for (let c = 0; c < COLS; c++) {
            if (at(r, c) !== '=' || used.has(`${r}:${c}`)) continue;
            // coluna vertical de '=' → torre
            if (at(r + 1, c) === '=' || at(r - 1, c) === '=') {
                let bottom = r;
                while (at(bottom + 1, c) === '=') bottom++;
                for (let k = r; k <= bottom; k++) used.add(`${k}:${c}`);
                towers.push({ x0: c, x1: c + 1, top: GROUND_ROW - r, bottom: GROUND_ROW - bottom - 1 });
                continue;
            }
            let end = c;
            while (at(r, end + 1) === '=' && at(r + 1, end + 1) !== '=') end++;
            const run = { x0: c, x1: end + 1, top: GROUND_ROW - r };
            (r === GROUND_ROW - 1 ? steps : islets).push(run);
            c = end;
        }
    }
    return { grounds, steps, islets, towers };
}

/**
 * Reaproveita o detalhe (luminância) de uma textura fotográfica de chão, mas com
 * o matiz de capim vivo:  cor = mix(tex, alvo · L/0,2, quantidade),  L = luma(tex).
 * As texturas CC0 de grama são bem secas/acastanhadas para um mundo de plataforma.
 */
export function greenify(material, target = [0.13, 0.36, 0.05], amount = 0.75) {
    const f = (v) => v.toFixed(4);
    material.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
            float gfxLuma = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${f(target[0])}, ${f(target[1])}, ${f(target[2])}) * (gfxLuma / 0.2), ${f(amount)});`);
    };
    material.customProgramCacheKey = () => `greenify:${target.join(',')}:${amount}`;
    return material;
}

/* ------------------------------------------------------------- massa de terra --- */

const C_GRASS = new THREE.Color();
const C_TMP = new THREE.Color();

function landmass(o) {
    const { x0, x1, zb, zf, top, seed, res = 0.25, edge = 0.22, height, depths, soilRings, offset, cap = false, lip = 0.07, path = false } = o;
    const nx = Math.max(2, Math.round((x1 - x0) / res));
    const nz = Math.max(2, Math.round((zf - zb) / res));
    const cornerR = Math.min(0.55, (x1 - x0) * 0.3);
    const zEdge = (x, front) => {
        const t = Math.min(x - x0, x1 - x) / cornerR;
        const inset = t < 1 ? (1 - Math.sqrt(Math.max(0, 1 - (1 - t) * (1 - t)))) * cornerR : 0;
        const n = (fbm2(x * 0.55 + (front ? 0 : 40), seed * 3.1, 3, 0, seed) * 2 - 1) * edge * (front ? 1 : 2.2);
        return front ? zf + n - inset : zb + n + inset;
    };

    /* ---- tampo ---- */
    const tp = [];
    const tc = [];
    const tuv = [];
    const ti = [];
    const vid = (i, j) => i * (nz + 1) + j;
    for (let i = 0; i <= nx; i++) {
        const x = x0 + (x1 - x0) * (i / nx);
        const zB = zEdge(x, false);
        const zF = zEdge(x, true);
        for (let j = 0; j <= nz; j++) {
            const z = lerp(zB, zF, j / nz);
            const rim = i === 0 || j === 0 || i === nx || j === nz;
            const y = top + height(x, z) - (rim ? lip : 0);
            tp.push(x, y, z);
            tuv.push(x / 1.6, z / 1.6);
            // variação de verde + trilha batida ao longo do plano de jogo
            const n = fbm2(x * 0.7, z * 0.7, 3, 0, seed + 5);
            C_GRASS.setRGB(0.78 + n * 0.3, 0.9 + n * 0.16, 0.7 + n * 0.25);
            if (path) {
                const worn = smoothstep(0.75, 0.15, Math.abs(z + 0.05)) * smoothstep(0.25, 0.6, fbm2(x * 1.3, z * 2.2, 2, 0, seed + 11) + 0.2);
                C_GRASS.lerp(C_TMP.setRGB(1.25, 1.05, 0.72), worn * 0.75);
            }
            if (rim) C_GRASS.multiplyScalar(0.82);
            tc.push(C_GRASS.r, C_GRASS.g, C_GRASS.b);
        }
    }
    for (let i = 0; i < nx; i++) {
        for (let j = 0; j < nz; j++) {
            const a = vid(i, j), b = vid(i + 1, j), c = vid(i, j + 1), d = vid(i + 1, j + 1);
            ti.push(a, c, b, b, c, d);
        }
    }

    /* ---- contorno (anti-horário visto de cima): frente → direita → fundo → esquerda ---- */
    const loop = [];
    for (let i = 0; i <= nx; i++) loop.push([i, nz]);
    for (let j = nz - 1; j >= 0; j--) loop.push([nx, j]);
    for (let i = nx - 1; i >= 0; i--) loop.push([i, 0]);
    for (let j = 1; j < nz; j++) loop.push([0, j]);
    const M = loop.length;
    const P = loop.map(([i, j]) => {
        const v = vid(i, j) * 3;
        return [tp[v], tp[v + 1], tp[v + 2]];
    });
    const N = [];
    const S = [];
    let arc = 0;
    for (let m = 0; m < M; m++) {
        const a = P[(m + M - 1) % M];
        const b = P[(m + 1) % M];
        const tx = b[0] - a[0];
        const tz = b[2] - a[2];
        const l = Math.hypot(tx, tz) || 1;
        N.push([-tz / l, tx / l]); // normal para fora do contorno (plano XZ)
        if (m > 0) arc += Math.hypot(P[m][0] - P[m - 1][0], P[m][2] - P[m - 1][2]);
        S.push(arc);
    }
    // perto do plano de jogo as paredes laterais ficam contidas (colisão é em x0/x1)
    const contain = P.map((p, m) => (Math.abs(N[m][0]) > 0.6 ? lerp(0.22, 1, smoothstep(0.9, 2.2, Math.abs(p[2]))) : 1));

    /* ---- saia de capim ---- */
    const skirt = [[0.05, 0.05], [0.075, 0.12], [0.03, 0.15]];
    let prev = loop.map(([i, j]) => vid(i, j));
    skirt.forEach(([out, down], r) => {
        const ring = [];
        for (let m = 0; m < M; m++) {
            const hang = r === 0 ? 0 : 0.34 * Math.pow(fbm2(S[m] * 2.3, seed * 1.3, 3, 0, seed + 21), 1.5);
            ring.push(tp.length / 3);
            tp.push(P[m][0] + N[m][0] * out, P[m][1] - down - hang, P[m][2] + N[m][1] * out);
            tuv.push(S[m] / 1.6, (down + hang) / 1.6);
            const shade = r === 0 ? 0.78 : r === 1 ? 0.5 : 0.3;
            tc.push(0.82 * shade, 0.95 * shade, 0.72 * shade);
        }
        for (let m = 0; m < M; m++) {
            const n = (m + 1) % M;
            ti.push(prev[m], ring[n], prev[n], prev[m], ring[m], ring[n]);
        }
        prev = ring;
    });
    const topGeo = new THREE.BufferGeometry();
    topGeo.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3));
    topGeo.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3));
    topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(tuv, 2));
    topGeo.setIndex(ti);
    topGeo.computeVertexNormals();

    /* ---- paredes ---- */
    const wp = [];
    const wc = [];
    const wuv = [];
    const soil = [];
    const rock = [];
    const D = depths[depths.length - 1];
    const rings = depths.map((d, k) => {
        const ring = [];
        for (let m = 0; m < M; m++) {
            const off = k === 0 ? -0.02 : offset(d, D, S[m], P[m], N[m]) * contain[m];
            ring.push(wp.length / 3);
            wp.push(P[m][0] + N[m][0] * off, P[m][1] - d, P[m][2] + N[m][1] * off);
            wuv.push(S[m] / 2.2, -d / 2.2);
            const n = fbm2(S[m] * 0.6, d * 3.2, 3, 0, seed + 31);
            if (k < soilRings) {
                // terra em estratos: faixas horizontais mais claras/escuras
                const band = 0.72 + 0.4 * noise2(d * 9 + fbm2(S[m] * 0.35, 0, 2, 0, seed) * 2.5, seed);
                wc.push(band * (0.95 + n * 0.2), band * (0.82 + n * 0.15), band * 0.7);
            } else {
                const wet = smoothstep(D * 0.55, D, d);
                const g = 0.95 + n * 0.25 - wet * 0.35;
                wc.push(g, g * (1 + wet * 0.12), g * 0.96);
            }
        }
        return ring;
    });
    for (let k = 0; k < rings.length - 1; k++) {
        const list = k < soilRings - 1 ? soil : rock;
        for (let m = 0; m < M; m++) {
            const n = (m + 1) % M;
            const a = rings[k][m], b = rings[k][n], c = rings[k + 1][n], d = rings[k + 1][m];
            list.push(a, c, b, a, d, c);
        }
    }
    if (cap) {
        // barriga: a grade do tampo, encolhida para dentro do último anel e caída no meio
        const last = rings[rings.length - 1];
        const cx = (x0 + x1) / 2;
        const cz = (zb + zf) / 2;
        const lastIdx = new Map(loop.map(([i, j], m) => [vid(i, j), last[m]]));
        const map = [];
        for (let i = 0; i <= nx; i++) {
            for (let j = 0; j <= nz; j++) {
                const id = vid(i, j);
                if (lastIdx.has(id)) { map.push(lastIdx.get(id)); continue; }
                const u = i / nx, v = j / nz;
                const x = tp[id * 3], z = tp[id * 3 + 2];
                const fx = 1 - o.taper / ((x1 - x0) / 2);
                const fz = 1 - o.taper / ((zf - zb) / 2);
                const sag = Math.pow(Math.sin(Math.PI * u) * Math.sin(Math.PI * v), 0.6);
                map.push(wp.length / 3);
                wp.push(cx + (x - cx) * Math.max(0.2, fx), top - D - sag * o.belly + fbm2(x * 1.4, z * 1.4, 2, 0, seed) * 0.08, cz + (z - cz) * Math.max(0.2, fz));
                wuv.push(x / 2.2, z / 2.2);
                const g = 0.78 + fbm2(x, z, 2, 0, seed + 3) * 0.2;
                wc.push(g, g, g * 0.96);
            }
        }
        for (let i = 0; i < nx; i++) {
            for (let j = 0; j < nz; j++) {
                const a = map[vid(i, j)], b = map[vid(i + 1, j)], c = map[vid(i, j + 1)], d = map[vid(i + 1, j + 1)];
                rock.push(a, c, b, b, c, d);
            }
        }
    }
    const wall = new THREE.BufferGeometry();
    wall.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
    wall.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
    wall.setAttribute('uv', new THREE.Float32BufferAttribute(wuv, 2));
    wall.setIndex([...soil, ...rock]);
    wall.computeVertexNormals();
    const part = (indices) => {
        if (!indices.length) return null;
        const g = new THREE.BufferGeometry();
        for (const name of ['position', 'normal', 'color', 'uv']) g.setAttribute(name, wall.attributes[name]);
        g.setIndex(indices);
        return g.toNonIndexed();
    };
    return { top: topGeo.toNonIndexed(), soil: part(soil), rock: part(rock) };
}

/* ---------------------------------------------------------------- construção --- */

/**
 * Constrói todo o terreno jogável.
 * @returns {{ group, islands, heightAt(x,z), level }}
 */
export function buildTerrain(scene, quality) {
    const level = readLevel();
    const tops = [];
    const soils = [];
    const rocks = [];
    const islands = [];
    const res = quality.terrainRes;
    const push = (m) => {
        tops.push(m.top);
        if (m.soil) soils.push(m.soil);
        if (m.rock) rocks.push(m.rock);
    };

    const first = level.grounds[0];
    const lastG = level.grounds[level.grounds.length - 1];
    level.grounds.forEach((g, i) => {
        // a primeira e a última ilha continuam para fora da fase (cenário além das bordas)
        const x0 = g === first ? g.x0 - 16 : g.x0;
        const x1 = g === lastG ? g.x1 + 16 : g.x1;
        const seed = 11 + i * 7;
        /* Relevo do tampo (m acima do nível de jogo):
             fundo:  sobe a partir de z = −0,9 até ~+1,1 m, modulado por fBm
             frente: cai 12 cm até a borda
           Dentro de |z| < 0,7 é exatamente 0 — é onde a lógica colide. */
        const height = (x, z) => {
            const ends = smoothstep(0, 1.6, Math.min(x - x0, x1 - x));
            const back = smoothstep(-0.9, -4.2, z) * (0.25 + 1.0 * fbm2(x * 0.28, z * 0.3, 3, 0, seed)) * (0.45 + 0.55 * ends);
            const front = -smoothstep(0.9, Z_FRONT, z) * 0.12;
            const micro = smoothstep(0.7, 1.4, Math.abs(z)) * (fbm2(x * 1.3, z * 1.3, 2, 0, seed + 2) - 0.5) * 0.12;
            return back + front + micro;
        };
        const island = { x0, x1, gx0: g.x0, gx1: g.x1, height, seed };
        islands.push(island);
        push(landmass({
            x0, x1, zb: Z_BACK, zf: Z_FRONT, top: 0, seed, height, path: true, res,
            depths: [0, 0.1, 0.24, 0.42, 0.62, 0.9, 1.25, 1.65, 2.1, 2.6, 3.2, 3.9],
            soilRings: 5,
            offset: (d, D, s, p) => {
                const rough = (fbm2(s * 0.55, d * 1.1, 4, 0, seed) - 0.42) * 0.55;
                const ledge = (noise2(d * 1.9 + fbm2(s * 0.3, 0, 2, 0, seed + 1) * 1.6, seed + 4) - 0.4) * 0.3;
                const soilIn = d < 0.62 ? -0.035 : 0.05;
                return soilIn + smoothstep(0.3, 1.4, d) * (rough + ledge) + d * 0.06;
            }
        }));
    });

    level.steps.forEach((s, i) => {
        const seed = 101 + i * 5;
        push(landmass({
            x0: s.x0, x1: s.x1, zb: -1.55, zf: 1.2, top: s.top, seed, edge: 0.12, lip: 0.05, res,
            height: (x, z) => smoothstep(0.7, 1.3, Math.abs(z)) * (fbm2(x * 1.1, z * 1.1, 2, 0, seed) - 0.6) * 0.16,
            depths: [0, 0.12, 0.3, 0.5, 0.72, 0.95, 1.12],
            soilRings: 0,
            offset: (d, D, sArc) => 0.01 + (fbm2(sArc * 0.9, d * 2.4, 3, 0, seed) - 0.45) * 0.12 + smoothstep(0.5, 1.1, d) * 0.07
        }));
    });

    level.islets.forEach((s, i) => {
        const seed = 201 + i * 5;
        const half = (s.x1 - s.x0) / 2;
        const taper = Math.min(0.62, half * 0.7);
        push(landmass({
            x0: s.x0, x1: s.x1, zb: -1.3, zf: 1.15, top: s.top, seed, edge: 0.1, lip: 0.06, cap: true, taper, belly: 0.16, res,
            height: (x, z) => smoothstep(0.7, 1.25, Math.abs(z)) * (fbm2(x * 1.2, z * 1.2, 2, 0, seed) - 0.55) * 0.14,
            depths: [0, 0.09, 0.2, 0.34, 0.5, 0.66, 0.8],
            soilRings: 3,
            offset: (d, D, sArc) => -Math.pow(d / D, 1.8) * taper + (fbm2(sArc * 1.1, d * 3, 3, 0, seed) - 0.5) * 0.1 * smoothstep(0.1, 0.4, d)
        }));
    });

    const grassMat = greenify(pbrMaterial('leafy_grass', { vertexColors: true, normalScale: 1.2, envMapIntensity: 0.6 }));
    const soilMat = pbrMaterial('dirt_floor', { vertexColors: true, normalScale: 1.4, envMapIntensity: 0.5 });
    const rockMat = pbrMaterial('cliff_side', { vertexColors: true, normalScale: 1.6, envMapIntensity: 0.6 });
    const group = new THREE.Group();
    group.name = 'terrain';
    for (const [list, mat, cast] of [[tops, grassMat, true], [soils, soilMat, true], [rocks, rockMat, true]]) {
        const mesh = new THREE.Mesh(mergeGeometries(list), mat);
        mesh.castShadow = cast;
        mesh.receiveShadow = true;
        group.add(mesh);
        list.forEach((g) => g.dispose());
    }

    /* ---- torre do estandarte: pilar de cantaria com base e cornija chanfradas ---- */
    const stoneMat = pbrMaterial('medieval_blocks_02', { normalScale: 1.3, envMapIntensity: 0.6 });
    for (const t of level.towers) {
        const h = t.top - t.bottom;
        const parts = [
            chamferBox(1.0, h, 1.5, 0.04).translate(0, h / 2, 0),
            chamferBox(1.16, 0.34, 1.68, 0.06).translate(0, 0.17, 0),
            chamferBox(1.08, 0.12, 1.6, 0.04).translate(0, 0.42, 0),
            chamferBox(1.06, 0.09, 1.58, 0.03).translate(0, h * 0.5, 0),
            chamferBox(1.08, 0.1, 1.6, 0.035).translate(0, h - 0.36, 0),
            chamferBox(1.16, 0.22, 1.7, 0.05).translate(0, h - 0.11, 0)
        ];
        // ameias nos quatro cantos do topo
        for (const sx of [-1, 1]) {
            for (const sz of [-1, 1]) parts.push(chamferBox(0.3, 0.26, 0.42, 0.04).translate(sx * 0.42, h + 0.12, sz * 0.62));
        }
        const geo = mergeGeometries(parts);
        applyWorldUV(geo, 1.3);
        const tower = new THREE.Mesh(geo, stoneMat);
        tower.position.set((t.x0 + t.x1) / 2, t.bottom, -0.1);
        tower.castShadow = true;
        tower.receiveShadow = true;
        group.add(tower);
    }
    scene.add(group);

    /** Altura do tampo da ilha de chão em (x, z); null fora das ilhas. */
    function heightAt(x, z) {
        for (const isl of islands) {
            if (x >= isl.x0 + 0.3 && x <= isl.x1 - 0.3 && z > Z_BACK + 0.5 && z < Z_FRONT - 0.2) return isl.height(x, z);
        }
        return null;
    }

    const grass = buildGrass(islands, quality);
    group.add(grass.mesh);
    return { group, islands, heightAt, level, grass };
}

/** Caixa com arestas chanfradas (bisel de 3 segmentos) — nada de quina viva de primitiva. */
export function chamferBox(w, h, d, r) {
    const shape = new THREE.Shape();
    const hw = w / 2 - r;
    const hd = d / 2 - r;
    shape.moveTo(-hw, -hd);
    shape.lineTo(hw, -hd);
    shape.lineTo(hw, hd);
    shape.lineTo(-hw, hd);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h - 2 * r, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 3, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -h / 2 + r, 0);
    return geo;
}

/* --------------------------------------------------------------------- capim --- */

/* Tufos instanciados: 7 lâminas curvas por tufo. Vento no vertex shader:
     Δx = [sin(t·1,6 + 0,9·x + 0,7·z)·0,5 + sin(t·3,7 + 2,3·x)·0,15] · h² · 0,16
   onde h ∈ [0,1] é a altura na lâmina (uv.y) e (x, z) a posição do tufo. */
export const grassWind = { value: 0 };

function buildGrass(islands, quality) {
    const rnd = seeded(77);
    const pos = [];
    const col = [];
    const uv = [];
    const idx = [];
    for (let b = 0; b < 7; b++) {
        const a = rnd() * Math.PI * 2;
        const lean = 0.25 + rnd() * 0.5;
        const hgt = 0.75 + rnd() * 0.5;
        const wdt = 0.02 + rnd() * 0.014;
        const ox = Math.cos(a) * 0.05 * rnd();
        const oz = Math.sin(a) * 0.05 * rnd();
        const base = pos.length / 3;
        for (let k = 0; k <= 2; k++) {
            const t = k / 2;
            const out = lean * t * t * 0.5;
            const cx = ox + Math.cos(a) * out;
            const cz = oz + Math.sin(a) * out;
            const half = wdt * (1 - t * 0.85);
            const px = -Math.sin(a) * half;
            const pz = Math.cos(a) * half;
            if (k < 2) {
                pos.push(cx - px, t * hgt, cz - pz, cx + px, t * hgt, cz + pz);
                uv.push(0, t, 1, t);
                const g = 0.07 + t * 0.13;
                col.push(g * 0.4, g, g * 0.15, g * 0.4, g, g * 0.15);
            } else {
                pos.push(cx, hgt, cz);
                uv.push(0.5, 1);
                col.push(0.14, 0.31, 0.05);
            }
        }
        idx.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const nor = new Float32Array(pos.length);
    for (let i = 0; i < nor.length; i += 3) nor[i + 1] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setIndex(idx);

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0.25 });
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWind = grassWind;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uWind;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                #ifdef USE_INSTANCING
                vec3 gfxTuft = instanceMatrix[3].xyz;
                float gfxH = uv.y * uv.y;
                transformed.x += (sin(uWind * 1.6 + gfxTuft.x * 0.9 + gfxTuft.z * 0.7) * 0.5 + sin(uWind * 3.7 + gfxTuft.x * 2.3) * 0.15) * gfxH * 0.16;
                transformed.z += cos(uWind * 1.3 + gfxTuft.x * 0.6) * gfxH * 0.06;
                #endif`);
        // lâmina vista por trás não escurece: a normal fica sempre "para cima"
        shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>',
            '#include <normal_fragment_begin>\nnormal = normalize(vNormal);\nnonPerturbedNormal = normal;');
    };

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const c = new THREE.Color();
    const items = [];
    for (const isl of islands) {
        const area = (isl.x1 - isl.x0) * (Z_FRONT - Z_BACK);
        const n = Math.round(area * quality.grass);
        for (let i = 0; i < n; i++) {
            const x = rnd.range(isl.x0 + 0.15, isl.x1 - 0.15);
            // mais denso perto da câmera, ralo no fundo
            const z = lerp(Z_FRONT - 0.2, Z_BACK + 0.4, Math.pow(rnd(), 1.7));
            const onPath = Math.abs(z + 0.05) < 0.6;
            if (onPath && rnd() < 0.55) continue;
            // altura: baixa na trilha (não esconde os pés), alta no fundo
            const hgt = (onPath ? 0.09 : 0.16 + smoothstep(-0.8, -3.5, z) * 0.22) * (0.7 + rnd() * 0.7);
            const wide = z > 0.75 ? 0.6 : 1;
            items.push([x, isl.height(x, z) - 0.02, z, hgt * wide, rnd()]);
        }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, items.length);
    items.forEach(([x, y, z, hgt, r], i) => {
        p.set(x, y, z);
        e.set(0, r * 6.283, 0);
        q.setFromEuler(e);
        s.set(hgt * 1.5, hgt, hgt * 1.5);
        m.compose(p, q, s);
        mesh.setMatrixAt(i, m);
        const n = fbm2(x * 0.6, z * 0.6, 2, 0, 9);
        c.setRGB(0.8 + n * 0.5 + r * 0.25, 0.85 + n * 0.3, 0.7 + r * 0.4);
        mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    mesh.name = 'grass';
    return { mesh, count: items.length };
}

/* ------------------------------------------------------ dispersão de modelos --- */

const _box = new THREE.Box3();
const _size = new THREE.Vector3();
const _center = new THREE.Vector3();

/**
 * Espalha um modelo glTF escolhendo UMA variante (sub-malha) por posição — o
 * `instanceModel` do kit instancia todas as variantes juntas em cada ponto.
 * placements: [{ x, y, z, ry, rx?, rz?, s (altura ou maior lado em m), v (variante) }]
 */
export async function scatterModel(name, placements, { by = 'height', castShadow = true, receiveShadow = true, brighten = 1 } = {}) {
    if (!placements.length) return null;
    const root = await loadModel(name, { ground: false });
    if (!root) return null;
    root.updateMatrixWorld(true);
    const variants = [];
    root.traverse((o) => { if (o.isMesh) variants.push(o); });
    if (!variants.length) return null;
    const group = new THREE.Group();
    group.name = `scatter:${name}`;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    variants.forEach((mesh, vi) => {
        const mine = placements.filter((pl) => (pl.v ?? 0) % variants.length === vi);
        if (!mine.length) return;
        _box.setFromObject(mesh);
        _box.getSize(_size);
        _box.getCenter(_center);
        const unit = by === 'height' ? _size.y : Math.max(_size.x, _size.y, _size.z);
        const base = new THREE.Matrix4().makeTranslation(-_center.x, -_box.min.y, -_center.z).multiply(mesh.matrixWorld);
        if (brighten !== 1 && !mesh.material.userData.brightened) {
            // folhagem fotogramétrica escura demais para o sol deste mundo
            mesh.material.color.multiplyScalar(brighten);
            mesh.material.userData.brightened = true;
        }
        const inst = new THREE.InstancedMesh(mesh.geometry, mesh.material, mine.length);
        mine.forEach((pl, i) => {
            const k = pl.s / (unit || 1);
            p.set(pl.x, pl.y, pl.z);
            e.set(pl.rx ?? 0, pl.ry ?? 0, pl.rz ?? 0);
            q.setFromEuler(e);
            s.set(k, k * (pl.sy ?? 1), k);
            m.compose(p, q, s).multiply(base);
            inst.setMatrixAt(i, m);
        });
        inst.instanceMatrix.needsUpdate = true;
        inst.castShadow = castShadow;
        inst.receiveShadow = receiveShadow;
        inst.computeBoundingSphere();
        group.add(inst);
    });
    return group;
}

/**
 * Vegetação e rochas fotogramétricas sobre as ilhas (2º plano) e na borda da frente.
 * Nada alto entra na faixa de jogo nem na frente dela (cobriria os pés do personagem).
 */
export async function decorate(scene, terrain, quality) {
    const rnd = seeded(2024);
    const d = quality.density;
    const lists = { fern_02: [], shrub_03: [], flower_empodium: [], rock_moss_set_01: [], rock_07: [], weed_plant_02: [] };
    for (const isl of terrain.islands) {
        const len = isl.x1 - isl.x0;
        const put = (name, count, zMin, zMax, sMin, sMax, extra = {}) => {
            for (let i = 0; i < count; i++) {
                const x = rnd.range(isl.x0 + 0.5, isl.x1 - 0.5);
                const z = rnd.range(zMin, zMax);
                const h = isl.height(x, z);
                lists[name].push({ x, y: h - (extra.sink ?? 0) * rnd(), z, ry: rnd() * 6.283, s: rnd.range(sMin, sMax), v: rnd.int(0, 5), ...extra.fn?.() });
            }
        };
        put('fern_02', Math.round(len * 0.34 * d), -4.2, -1.25, 0.34, 0.62);
        put('shrub_03', Math.round(len * 0.3 * d), -6.4, -2.0, 0.55, 1.1);
        put('weed_plant_02', Math.round(len * 0.2 * d), -3.0, -1.0, 0.16, 0.3);
        put('flower_empodium', Math.round(len * 0.6 * d), -2.6, -0.85, 0.2, 0.34);
        put('flower_empodium', Math.round(len * 0.35 * d), 0.85, 1.35, 0.12, 0.17);
        put('rock_moss_set_01', Math.round(len * 0.1 * d), -6.2, -1.9, 0.7, 1.7, { sink: 0.25 });
        put('rock_07', Math.round(len * 0.03 * d), -1.7, -1.0, 0.3, 0.55, { sink: 0.1 });
    }
    // rochas saindo da água no primeiro plano (abaixo da linha do chão)
    for (let i = 0; i < Math.round(6 * d); i++) {
        lists.rock_moss_set_01.push({ x: rnd.range(-4, 94), y: -2.75 - rnd() * 0.3, z: rnd.range(3.2, 6.5), ry: rnd() * 6.283, s: rnd.range(1.2, 2.4), v: rnd.int(0, 5) });
    }
    const by = { rock_moss_set_01: 'fit', rock_07: 'fit' };
    const groups = await Promise.all(Object.entries(lists).map(([name, list]) => scatterModel(name, list, { by: by[name] || 'height', castShadow: quality.propShadows, brighten: name === 'fern_02' ? 2.2 : name === 'shrub_03' ? 1.4 : 1 })));
    const group = new THREE.Group();
    group.name = 'decor';
    groups.forEach((g) => g && group.add(g));

    // paredão de pedra que fecha o lado esquerdo da fase (o jogador para em x = 0)
    const wall = await loadModel('rock_face_01', { height: 5.4 });
    if (wall) {
        wall.position.set(-3.1, -0.5, -1.2);
        wall.rotation.y = 1.9;
        group.add(wall);
        if (quality.propShadows) {
            const wall2 = wall.clone();
            wall2.position.set(-6.5, -0.8, 0.6);
            wall2.rotation.y = -0.7;
            wall2.scale.setScalar(0.8);
            group.add(wall2);
        }
    }
    scene.add(group);
    return group;
}

