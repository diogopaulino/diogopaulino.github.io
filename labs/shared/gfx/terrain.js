/**
 * gfx/terrain — ambiente ao ar livre: terreno PBR com splat, grama e flores
 * instanciadas, floresta com LOD, dispersão de rochas/plantas, água interior,
 * caminhos e cercas. Feito para ser usado com `stage.js` (céu, sol, pós).
 *
 * Ordem de montagem (cada etapa lê o que a anterior pintou):
 *   1. createCourse(...)        traçados (rio, estrada) — só matemática, sem terreno
 *   2. createTerrain(...)       relevo (heightFn pode usar course.carve / carveBasin)
 *   3. createPath / createWater pintam a máscara de splat (terra batida, margem úmida)
 *   4. createGrass / createForest / scatter*   respeitam a máscara por padrão
 *   5. a cada quadro: terrain.update(camera) · grass.update(camera, dt, pisadores)
 *                     forest.update(camera) · water.update(dt)
 *
 * ── TERRENO ────────────────────────────────────────────────────────────────
 * Malha em grade (chunks + LOD ½ resolução quando `size` é grande) com um
 * MeshStandardMaterial estendido por onBeforeCompile — sombras, IBL e névoa do
 * three continuam valendo. Até 4 camadas PBR reais (assets.js) ficam em dois
 * `sampler2DArray`: albedo+altura e normal.xy+AO+rugosidade (2 leituras por camada).
 *
 *   pesos:        w0 = 1 − (w1 + w2 + w3), com w1..w3 lidos da textura de splat (RGB);
 *                 A = umidade (escurece o albedo ×0,5 e baixa a rugosidade)
 *   height-blend: b_i = max(h_i + w_i − (max_j(h_j + w_j) − δ), 0);  cor = Σ b_i·c_i / Σ b_i
 *                 h_i = altura do detalhe (luminância normalizada do albedo, no alfa);
 *                 δ = `blend` (0,22): a camada "mais alta" vence, a borda segue o
 *                 relevo da textura em vez de virar degradê.
 *   anti-tiling:  c = mix(tex(p·s), tex(R37°·p·s·0,27 + 0,37), k)
 *                 k = mix(0,6·smoothstep(0,42, 0,78, ruído(p·0,043)), 0,92, smoothstep(14 m, 60 m, dist))
 *                 perto: manchas da escala grande quebram a grade; longe: só a
 *                 escala grande (período 3,7× maior, sem repetição visível).
 *   macro:        cor ×= 1 + macro·(0,2·n₂ + 0,12·n₁)   (n₂: ruído de ~100 m, n₁: ~23 m)
 *   normal:       N = normalize(T·d.x + B·d.y + Ng·√(1 − |d|²)),  T/B = eixos X/Z do
 *                 mundo projetados no plano da face (UV em metros do mundo).
 *   encostas:     acima de ~41° a projeção de cima (xz) dá lugar à lateral (zy ou xy,
 *                 pelo eixo dominante da normal), misturadas até ~60° — sem textura esticada.
 *   tier low:     só as 2 camadas mais fortes por pixel, sem anti-tiling, texturas 512.
 *
 * `slope` (em splatFn, maskFn, slopeAt) = 1 − normal.y: 0 = plano, 0,13 ≈ 30°, 0,29 ≈ 45°.
 *
 * ── GRAMA ──────────────────────────────────────────────────────────────────
 * Células de `cell` m ao redor da câmera, 1 draw call cada, com frustum culling.
 * A densidade cai por anéis de distância (frações em GRASS_LEVELS) e a largura da
 * lâmina cresce com a distância para manter a cobertura:
 *   largura(d) = w·(1 + 0,045·d)        altura some entre 0,72·alcance e o alcance
 * Lâmina = faixa de 4 segmentos (perto) ou 2 (longe), curvada em parábola:
 *   p(t) = raiz + lado·x·largura + dobra·H·t² + ŷ·H·t·(1 − 0,35·min(|dobra|², 1)·t)
 *   dobra = direção·inclinação + vento + empurrão dos pisadores
 *   vento = dir·(1,4·ruído(xz·0,045 + t·(0,32; 0,21)) − 0,35 + 0,22·tremor)·força
 *   pisador i (centro c, raio r): empurra para fora com k = 1 − smoothstep(0,35·r, r, |raiz − c|)
 *                                 e achata a altura em 55 %·k
 * Cor: gradiente base→ponta, AO na raiz, manchas secas por ruído, luz atravessando
 * a lâmina na contraluz:  +albedo·sol·(v·−l)³·t·translucidez.
 *
 * ── FLORESTA ───────────────────────────────────────────────────────────────
 * Árvores procedurais: tronco e galhos ramificados em tubos (casca PBR), copa de
 * cartões com textura de folhagem (alpha-test + alpha-to-coverage), normais
 * esféricas, AO da copa em cor de vértice, vento e translucidez. Dois LODs
 * instanciados: malha (perto) e impostor (dois cartões cruzados + um deitado)
 * assado em tempo de execução a partir da própria árvore (longe).
 *
 * ── API ────────────────────────────────────────────────────────────────────
 *   createCourse(points, o)      traçado em planta (dist, sample, pointAt, carve, mask)
 *   carveBasin(x, z, h, o)       bacia de lago para o heightFn
 *   createTerrain(o)             → { object, heightAt, normalAt, slopeAt, weightsAt, paint, update, ready… }
 *   createGrass(o)               → { object, update(camera, dt, pisadores), setDensity, stats }
 *   createTreeKit(o)             kit de uma árvore (SPECIES) · createForest(o) → { object, update(camera), ready… }
 *   createBeanstalk(o)           pé de feijão com pointAt(t) para escalar
 *   scatter(o)                   pontos por Poisson · scatterModel(o) modelos de assets.js (SCATTER_PRESETS)
 *   createWater(o)               lago ou rio → { object, update(dt), levelAt }
 *   createPath(o) · createFence(o)
 *   TERRAIN_TIERS · DEFAULT_LAYERS · GRASS_LEVELS · SPECIES · SCATTER_PRESETS
 */
import * as THREE from 'three';
import { clamp, lerp, smoothstep, seeded, fbm2, noise2, GLSL_NOISE, TAU, pickTier } from './core.js';
import { pbrSet, pbrMaterial, loadModel } from './assets.js';
import { wind, createPalmKit } from './flora.js';

/**
 * Carga por tier.
 *   segments     vértices por lado do terreno          splat      resolução da máscara
 *   tex          lado das texturas das camadas         grass*     lâminas/m² perto, alcance, raio do LOD alto
 *   treeLod      distância malha → impostor (m)        treeDetail 0–2 (segmentos de galho, cartões por copa)
 */
export const TERRAIN_TIERS = {
    low: {
        segments: 128, splat: 256, tex: 512, antiTile: false, wMin: 0.12, grassDensity: 50, grassRange: 28, grassNear: 6,
        flowerRange: 18, treeLod: 34, treeDetail: 0, impostor: 256, variants: 1, modelTris: 1400
    },
    medium: {
        segments: 192, splat: 512, tex: 1024, antiTile: true, wMin: 0.004, grassDensity: 70, grassRange: 55, grassNear: 12,
        flowerRange: 32, treeLod: 46, treeDetail: 1, impostor: 256, variants: 2, modelTris: 5000
    },
    high: {
        segments: 256, splat: 512, tex: 1024, antiTile: true, wMin: 0.004, grassDensity: 150, grassRange: 80, grassNear: 16,
        flowerRange: 45, treeLod: 70, treeDetail: 2, impostor: 256, variants: 2, modelTris: 9000
    }
};
const tierName = (t) => (TERRAIN_TIERS[t] ? t : pickTier('auto'));

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

function hashCell(x, z, seed) {
    let h = (Math.imul(x, 374761393) + Math.imul(z, 668265263) + Math.imul(seed, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return (h ^ (h >>> 16)) >>> 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Traçados
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Traçado em planta (rio, estrada, cerca): spline Catmull-Rom centrípeta
 * reamostrada a cada `step` m. Não depende do terreno — crie antes e use dentro
 * do `heightFn` (carve) e depois em createWater / createPath / createFence.
 *
 * @param {Array<[number, number]|{x:number,z:number}>} points  pontos (x, z)
 * @param {object} [o]
 * @param {number} [o.width]   largura nominal (m)
 * @param {boolean} [o.closed]
 * @returns {{ width, length, count, xs, zs,
 *   dist(x, z, max?) → m até o eixo (Infinity se além de `max`),
 *   sample(x, z) → { d, t, x, z, side }  (objeto reutilizado; t ∈ [0,1], side = ±1),
 *   pointAt(t, target?) → Vector3 (y = 0),  tangentAt(t, target?) → Vector3,
 *   carve(x, z, h, { depth, width, bank }) → h rebaixado no leito,
 *   mask(x, z, { width, edge }) → 0..1,  bounds(margin) → { minX, maxX, minZ, maxZ } }}
 */
export function createCourse(points, { width = 3, closed = false, step = 1.5 } = {}) {
    const pts = points.map((p) => (Array.isArray(p) ? V3(p[0], 0, p[1]) : V3(p.x, 0, p.z)));
    const curve = new THREE.CatmullRomCurve3(pts, closed, 'centripetal');
    const length = curve.getLength();
    const n = Math.max(2, Math.ceil(length / step));
    const sp = curve.getSpacedPoints(n);
    const xs = new Float32Array(n + 1);
    const zs = new Float32Array(n + 1);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    sp.forEach((p, i) => {
        xs[i] = p.x;
        zs[i] = p.z;
        minX = Math.min(minX, p.x);
        maxX = Math.max(maxX, p.x);
        minZ = Math.min(minZ, p.z);
        maxZ = Math.max(maxZ, p.z);
    });
    const res = { d: Infinity, t: 0, x: 0, z: 0, side: 1 };

    function sample(x, z) {
        let best = Infinity;
        let bi = 0;
        let bu = 0;
        for (let i = 0; i < n; i++) {
            const ax = xs[i];
            const az = zs[i];
            const dx = xs[i + 1] - ax;
            const dz = zs[i + 1] - az;
            const u = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
            const ex = ax + dx * u - x;
            const ez = az + dz * u - z;
            const d2 = ex * ex + ez * ez;
            if (d2 < best) {
                best = d2;
                bi = i;
                bu = u;
            }
        }
        const dx = xs[bi + 1] - xs[bi];
        const dz = zs[bi + 1] - zs[bi];
        res.d = Math.sqrt(best);
        res.t = (bi + bu) / n;
        res.x = xs[bi] + dx * bu;
        res.z = zs[bi] + dz * bu;
        res.side = dx * (z - res.z) - dz * (x - res.x) >= 0 ? 1 : -1;
        return res;
    }

    const course = {
        width, length, count: n + 1, xs, zs, closed,
        sample,
        dist(x, z, max = Infinity) {
            if (x < minX - max || x > maxX + max || z < minZ - max || z > maxZ + max) return Infinity;
            return sample(x, z).d;
        },
        pointAt(t, target = V3()) {
            const f = clamp(t, 0, 1) * n;
            const i = Math.min(n - 1, Math.floor(f));
            const u = f - i;
            return target.set(lerp(xs[i], xs[i + 1], u), 0, lerp(zs[i], zs[i + 1], u));
        },
        tangentAt(t, target = V3()) {
            const i = Math.min(n - 1, Math.floor(clamp(t, 0, 1) * n));
            return target.set(xs[i + 1] - xs[i], 0, zs[i + 1] - zs[i]).normalize();
        },
        /** Leito: h − depth·(1 − smoothstep(½·width, ½·width + bank, d)). */
        carve(x, z, h, { depth = 1, width: w = width, bank = w } = {}) {
            const d = course.dist(x, z, w * 0.5 + bank);
            if (d === Infinity) return h;
            return h - depth * (1 - smoothstep(w * 0.5, w * 0.5 + bank, d));
        },
        mask(x, z, { width: w = width, edge = 0.6 } = {}) {
            const d = course.dist(x, z, w * 0.5 + edge);
            return d === Infinity ? 0 : 1 - smoothstep(w * 0.5 - edge * 0.3, w * 0.5 + edge * 0.7, d);
        },
        bounds(margin = 0) {
            return { minX: minX - margin, maxX: maxX + margin, minZ: minZ - margin, maxZ: maxZ + margin };
        }
    };
    return course;
}

/**
 * Bacia de lago para usar no heightFn: puxa o chão para `floor` dentro do raio,
 * com margem irregular:  r' = radius·(1 + 0,22·(fbm − ½)),  k = 1 − smoothstep(0,3·r', r', d)
 *   h' = lerp(h, floor, k)
 */
export function carveBasin(x, z, h, { x: cx = 0, z: cz = 0, radius = 20, floor = h - 2 } = {}) {
    const d = Math.hypot(x - cx, z - cz);
    if (d > radius * 1.25) return h;
    const r = radius * (1 + 0.22 * (fbm2(x * 0.06 + 3.1, z * 0.06 + 9.7, 3) - 0.5) * 2);
    return lerp(h, floor, 1 - smoothstep(r * 0.3, r, d));
}

// ═══════════════════════════════════════════════════════════════════════════
// Terreno
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Camadas padrão:
 *   0 grama (base, recebe a grama instanciada) · 1 terra batida (caminhos — createPath)
 *   2 rocha (encostas) · 3 chão de folhas/lama (manchas de mata, margens de água — createWater)
 */
export const DEFAULT_LAYERS = [
    { set: 'leafy_grass', scale: 3.4, tint: 0xa9c284 },
    { set: 'dirt_floor', scale: 3.0, tint: 0xa8a696 },
    { set: 'cliff_side', scale: 7.0 },
    { set: 'brown_mud_leaves_01', scale: 3.2 }
];
const PLACEHOLDER = [[74, 92, 48], [112, 92, 70], [108, 106, 100], [86, 70, 52]];

let scratch = null;
function imagePixels(image, size) {
    if (!scratch) {
        scratch = document.createElement('canvas');
        scratch.ctx = scratch.getContext('2d', { willReadFrequently: true });
    }
    if (scratch.width !== size) scratch.width = scratch.height = size;
    scratch.ctx.drawImage(image, 0, 0, size, size);
    return scratch.ctx.getImageData(0, 0, size, size).data;
}

function arrayTexture(size, depth, srgb) {
    const tex = new THREE.DataArrayTexture(new Uint8Array(size * size * 4 * depth), size, size, depth);
    tex.format = THREE.RGBAFormat;
    tex.type = THREE.UnsignedByteType;
    tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 8;
    tex.needsUpdate = true;
    return tex;
}

/**
 * Copia um conjunto PBR para a camada `i` dos dois arrays.
 *   albedo.a = altura do detalhe = clamp(½ + (lum − média)/(4σ)) · (0,55 + 0,45·AO)
 *   normal:  RG = normal.xy · B = AO · A = rugosidade
 */
function fillLayer(alb, nrm, i, size, set) {
    const n = size * size;
    const off = i * n * 4;
    const a = alb.image.data;
    const m = nrm.image.data;
    const arm = imagePixels(set.aoMap.image, size).slice();
    const nor = imagePixels(set.normalMap.image, size).slice();
    const diff = imagePixels(set.map.image, size);
    let sum = 0;
    let sum2 = 0;
    for (let p = 0; p < n; p++) {
        const l = diff[p * 4] * 0.299 + diff[p * 4 + 1] * 0.587 + diff[p * 4 + 2] * 0.114;
        sum += l;
        sum2 += l * l;
    }
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(1, sum2 / n - mean * mean));
    for (let p = 0; p < n; p++) {
        const o = p * 4;
        const l = diff[o] * 0.299 + diff[o + 1] * 0.587 + diff[o + 2] * 0.114;
        const h = clamp(0.5 + (l - mean) / (4 * sd), 0, 1) * (0.55 + 0.45 * (arm[o] / 255));
        a[off + o] = diff[o];
        a[off + o + 1] = diff[o + 1];
        a[off + o + 2] = diff[o + 2];
        a[off + o + 3] = h * 255;
        m[off + o] = nor[o];
        m[off + o + 1] = nor[o + 1];
        m[off + o + 2] = arm[o];
        m[off + o + 3] = arm[o + 1];
    }
}

/**
 * Regra padrão da máscara: rocha (camada 2) acima de ~35° de inclinação, chão de
 * folhas/lama (camada 3) em meia-encosta e em manchas esparsas; o resto é grama.
 * A camada 1 (terra batida) fica livre para createPath.
 */
function defaultSplat(x, z, h, slope, out) {
    const n = fbm2(x * 0.045 + 31, z * 0.045 + 17, 3);
    const rock = smoothstep(0.2, 0.4, slope + (n - 0.5) * 0.16);
    const patch = smoothstep(0.66, 0.84, fbm2(x * 0.021 + 5, z * 0.021 + 2, 2));
    out[0] = 0;
    out[1] = rock;
    out[2] = clamp(smoothstep(0.12, 0.26, slope + (n - 0.5) * 0.1) * 0.8 + patch * 0.7, 0, 1) * (1 - rock);
    out[3] = 0;
    return out;
}

const TERRAIN_FRAG_HEAD = /* glsl */ `
uniform highp sampler2DArray uGfxAlb;
uniform highp sampler2DArray uGfxNrm;
uniform sampler2D uGfxSplat;
uniform vec4 uGfxRect;
uniform vec4 uGfxTile;
uniform vec4 uGfxNrmK;
uniform vec4 uGfxRoughK;
uniform vec3 uGfxTint[4];
uniform float uGfxBlend;
uniform float uGfxMacro;
uniform vec3 uGfxCoverCol;
uniform vec3 uGfxCoverDry;
uniform vec3 uGfxCover;
varying vec3 vGfxPos;
varying vec3 vGfxNrm;
vec3 gfxTNrm;
float gfxTRough;
float gfxTAO;
${GLSL_NOISE}
struct GfxLay { vec3 col; vec2 nrm; float ao; float rough; float cov; float h0; float l0; };
// Amostra e mistura as camadas em uma projeção (p em metros; dx/dy = derivadas de p).
GfxLay gfxLayers(vec2 p, vec2 dx, vec2 dy, vec4 w, float mixB) {
    #ifdef GFX_ANTITILE
        const mat2 R = mat2(0.7986, 0.6018, -0.6018, 0.7986);
    #endif
    vec4 A[4];
    vec4 M[4];
    float hmax = -1.0;
    for (int i = 0; i < 4; i++) {
        A[i] = vec4(0.0);
        M[i] = vec4(0.0, 0.0, 1.0, 1.0);
        if (w[i] > GFX_WMIN) {
            float s = uGfxTile[i];
            float li = float(i);
            vec4 a = textureGrad(uGfxAlb, vec3(p * s, li), dx * s, dy * s);
            vec4 m = textureGrad(uGfxNrm, vec3(p * s, li), dx * s, dy * s);
            vec2 d = (m.xy * 2.0 - 1.0) * vec2(1.0, -1.0);
            #ifdef GFX_ANTITILE
                float s2 = s * 0.27;
                vec2 q = R * p * s2 + 0.37;
                vec4 a2 = textureGrad(uGfxAlb, vec3(q, li), R * dx * s2, R * dy * s2);
                vec4 m2 = textureGrad(uGfxNrm, vec3(q, li), R * dx * s2, R * dy * s2);
                vec2 d2 = ((m2.xy * 2.0 - 1.0) * vec2(1.0, -1.0)) * R;
                a = mix(a, a2, mixB);
                d = mix(d, d2, mixB);
                m.zw = mix(m.zw, m2.zw, mixB);
            #endif
            A[i] = a;
            M[i] = vec4(d * uGfxNrmK[i], m.z, m.w * uGfxRoughK[i]);
            hmax = max(hmax, a.a + w[i]);
        }
    }
    float tot = 0.0;
    float b0 = 0.0;
    vec3 c = vec3(0.0);
    vec4 mm = vec4(0.0);
    for (int i = 0; i < 4; i++) {
        if (w[i] > GFX_WMIN) {
            float b = max(A[i].a + w[i] - (hmax - uGfxBlend), 0.0);
            c += A[i].rgb * uGfxTint[i] * b;
            mm += M[i] * b;
            tot += b;
            if (i == 0) b0 = b;
        }
    }
    tot = max(tot, 1e-4);
    mm /= tot;
    GfxLay o;
    o.col = c / tot;
    o.nrm = mm.xy;
    o.ao = mm.z;
    o.rough = mm.w;
    o.cov = b0 / tot;
    o.h0 = A[0].a;
    o.l0 = dot(A[0].rgb, vec3(0.3333));
    return o;
}
`;

const TERRAIN_FRAG_MAP = /* glsl */ `
{
    vec2 gP = vGfxPos.xz;
    vec4 gS = texture2D(uGfxSplat, (gP - uGfxRect.xy) * uGfxRect.zw);
    vec4 gW = vec4(max(0.0, 1.0 - gS.r - gS.g - gS.b), gS.rgb);
    float gDist = length(vViewPosition);
    float gN1 = gfxNoise(gP * 0.043);
    float gN2 = gfxNoise(gP * 0.0097 + 7.3);
    float gMixB = 0.0;
    #ifdef GFX_ANTITILE
        gMixB = clamp(mix(smoothstep(0.42, 0.78, gN1) * 0.6, 0.92, smoothstep(14.0, 60.0, gDist)), 0.0, 1.0);
    #endif
    // derivadas das três projeções, tiradas fora dos desvios (dentro delas o resultado é indefinido)
    vec2 gDxT = dFdx(gP);
    vec2 gDyT = dFdy(gP);
    vec2 gDxX = dFdx(vGfxPos.zy);
    vec2 gDyX = dFdy(vGfxPos.zy);
    vec2 gDxZ = dFdx(vGfxPos.xy);
    vec2 gDyZ = dFdy(vGfxPos.xy);
    vec3 gNg = normalize(vGfxNrm);
    // encosta íngreme (≈ 41° → 60°): troca a projeção de cima pela lateral, senão a textura estica
    float gSide = smoothstep(0.25, 0.5, 1.0 - gNg.y);
    vec3 gC = vec3(0.0);
    vec3 gDW = vec3(0.0);
    float gAo = 0.0;
    float gRo = 0.0;
    float gCov = 0.0;
    float gH0 = 0.0;
    float gL0 = 0.0;
    if (gSide < 0.999) {
        GfxLay l = gfxLayers(gP, gDxT, gDyT, gW, gMixB);
        float k = 1.0 - gSide;
        vec3 tx = normalize(vec3(1.0, 0.0, 0.0) - gNg * gNg.x);
        vec3 tz = normalize(vec3(0.0, 0.0, 1.0) - gNg * gNg.z);
        gC += l.col * k;
        gDW += (tx * l.nrm.x + tz * l.nrm.y) * k;
        gAo += l.ao * k;
        gRo += l.rough * k;
        gCov += l.cov * k;
        gH0 += l.h0 * k;
        gL0 += l.l0 * k;
    }
    if (gSide > 0.001) {
        bool ux = abs(gNg.x) > abs(gNg.z);
        GfxLay l = gfxLayers(ux ? vGfxPos.zy : vGfxPos.xy, ux ? gDxX : gDxZ, ux ? gDyX : gDyZ, gW, gMixB);
        vec3 ta = ux ? normalize(vec3(0.0, 0.0, 1.0) - gNg * gNg.z) : normalize(vec3(1.0, 0.0, 0.0) - gNg * gNg.x);
        vec3 ty = normalize(vec3(0.0, 1.0, 0.0) - gNg * gNg.y);
        gC += l.col * gSide;
        gDW += (ta * l.nrm.x + ty * l.nrm.y) * gSide;
        gAo += l.ao * gSide;
        gRo += l.rough * gSide;
        gCov += l.cov * gSide;
        gH0 += l.h0 * gSide;
        gL0 += l.l0 * gSide;
    }
    // cobertura de grama: onde a camada 0 vence, o chão assume a cor da grama instanciada
    // (um pouco sob as lâminas; por inteiro além do alcance delas, para o campo não "acabar")
    gCov *= uGfxCover.z * mix(0.35, 1.0, smoothstep(uGfxCover.x, uGfxCover.y, gDist));
    // mesmas manchas secas da grama (ruído em xz·0,035) + a textura da camada modulando a cor
    vec3 gCv = mix(uGfxCoverCol, uGfxCoverDry, smoothstep(0.5, 0.9, gfxNoise(gP * 0.035 + 11.0)));
    gC = mix(gC, gCv * (0.45 + 1.1 * gH0) * (0.8 + 1.6 * gL0), gCov);
    gRo = mix(gRo, 0.8, gCov);
    float gMac = (gN2 - 0.5) * 2.0;
    gC *= 1.0 + uGfxMacro * (gMac * 0.2 + (gN1 - 0.5) * 0.24);
    gC = mix(gC, gC * vec3(1.12, 1.02, 0.82), clamp(gMac, 0.0, 1.0) * uGfxMacro * 0.6);
    gC *= mix(1.0, 0.5, gS.a);
    gfxTRough = mix(gRo, 0.2, gS.a * 0.75);
    gfxTAO = gAo;
    gfxTNrm = gDW;
    diffuseColor.rgb *= gC;
}
`;

const TERRAIN_FRAG_NORMAL = /* glsl */ `
{
    vec3 gNw = normalize(vGfxNrm);
    float gNz = sqrt(max(1.0 - dot(gfxTNrm, gfxTNrm), 0.05));
    normal = normalize((viewMatrix * vec4(gfxTNrm + gNw * gNz, 0.0)).xyz);
}
`;

/**
 * Terreno com mistura de camadas PBR.
 *
 * @param {object} o
 * @param {number|[number,number]} [o.size]   lado em metros (ou [x, z])
 * @param {[number,number]} [o.center]        centro (x, z)
 * @param {number} [o.segments]               quads no lado maior (padrão por tier)
 * @param {(x:number,z:number)=>number} [o.heightFn]  altura em metros
 * @param {{data:ArrayLike<number>,width:number,height:number,scale?:number,offset?:number}} [o.heightmap]
 *        alternativa ao heightFn: grade de alturas amostrada com bilinear sobre o terreno
 * @param {Array<{set:string,scale?:number,tint?:number,normal?:number,rough?:number}>} [o.layers]
 *        até 4 conjuntos de assets.js; `scale` = metros por repetição
 * @param {(x,z,h,slope,out)=>number[]} [o.splatFn]  devolve [w1, w2, w3, umidade] (0..1) — peso das
 *        camadas 1–3; a camada 0 fica com o resto. Padrão: terra em manchas e em meia-encosta, rocha na encosta.
 * @param {number} [o.splatSize]  resolução da máscara (padrão por tier)
 * @param {'auto'|'low'|'medium'|'high'} [o.tier]
 * @param {number} [o.chunks]     chunks por lado (padrão: 1 até 500 m; depois ~1 a cada 200 m, com LOD e saias)
 * @param {number} [o.blend]      δ do height-blend (0,05 duro … 0,6 macio)
 * @param {number} [o.macro]      variação macro de cor (0 desliga)
 * @param {boolean} [o.castShadow] [o.receiveShadow]
 * @returns {{ object, material, size, bounds, tier, ready,
 *   heightAt(x,z), normalAt(x,z,target?), slopeAt(x,z), weightsAt(x,z,out?) → [w0,w1,w2,w3,umidade],
 *   paint(region|null, fn(x,z,h,slope,w)), update(camera), dispose() }}
 */
export function createTerrain({
    size = 300,
    center = [0, 0],
    segments,
    heightFn,
    heightmap,
    layers = DEFAULT_LAYERS,
    splatFn = defaultSplat,
    splatSize,
    tier = 'auto',
    chunks,
    blend = 0.22,
    macro = 1,
    castShadow = false,
    receiveShadow = true
} = {}) {
    const tn = tierName(tier);
    const T = TERRAIN_TIERS[tn];
    const sizeX = Array.isArray(size) ? size[0] : size;
    const sizeZ = Array.isArray(size) ? size[1] : size;
    const seg = segments ?? T.segments;
    const nChunks = chunks ?? (Math.max(sizeX, sizeZ) > 500 ? clamp(Math.round(Math.max(sizeX, sizeZ) / 200), 2, 8) : 1);
    // segmentos por chunk sempre pares (o LOD pula de 2 em 2)
    const per = Math.max(2, Math.round(seg / nChunks / 2) * 2);
    const segX = per * nChunks;
    const segZ = Math.max(2, Math.round((per * sizeZ) / sizeX / 2) * 2) * nChunks;
    const perZ = segZ / nChunks;
    const minX = center[0] - sizeX / 2;
    const minZ = center[1] - sizeZ / 2;
    const cellX = sizeX / segX;
    const cellZ = sizeZ / segZ;
    const nx = segX + 1;
    const nz = segZ + 1;

    let hf = heightFn;
    if (!hf && heightmap) {
        const { data, width, height, scale = 1, offset = 0 } = heightmap;
        hf = (x, z) => {
            const fx = clamp((x - minX) / sizeX, 0, 1) * (width - 1);
            const fz = clamp((z - minZ) / sizeZ, 0, 1) * (height - 1);
            const i = Math.min(width - 2, Math.floor(fx));
            const j = Math.min(height - 2, Math.floor(fz));
            const u = fx - i;
            const v = fz - j;
            const a = data[j * width + i];
            const b = data[j * width + i + 1];
            const c = data[(j + 1) * width + i];
            const d = data[(j + 1) * width + i + 1];
            return offset + scale * (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v);
        };
    }
    if (!hf) hf = () => 0;

    const H = new Float32Array(nx * nz);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let j = 0; j < nz; j++) {
        for (let i = 0; i < nx; i++) {
            const h = hf(minX + i * cellX, minZ + j * cellZ);
            H[j * nx + i] = h;
            if (h < minY) minY = h;
            if (h > maxY) maxY = h;
        }
    }

    function heightAt(x, z) {
        const fx = clamp((x - minX) / cellX, 0, segX);
        const fz = clamp((z - minZ) / cellZ, 0, segZ);
        const i = Math.min(segX - 1, Math.floor(fx));
        const j = Math.min(segZ - 1, Math.floor(fz));
        const u = fx - i;
        const v = fz - j;
        const o = j * nx + i;
        const a = H[o];
        const b = H[o + 1];
        const c = H[o + nx];
        const d = H[o + nx + 1];
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function normalAt(x, z, target = V3()) {
        return target.set(
            heightAt(x - cellX, z) - heightAt(x + cellX, z),
            2 * cellX,
            (heightAt(x, z - cellZ) - heightAt(x, z + cellZ)) * (cellX / cellZ)
        ).normalize();
    }
    const slopeAt = (x, z) => 1 - normalAt(x, z, _v).y;

    // ---------- máscara de splat ----------
    const S = splatSize ?? T.splat;
    const splat = new Uint8Array(S * S * 4);
    const splatTex = new THREE.DataTexture(splat, S, S, THREE.RGBAFormat);
    splatTex.magFilter = splatTex.minFilter = THREE.LinearFilter;
    splatTex.wrapS = splatTex.wrapT = THREE.ClampToEdgeWrapping;
    const tmpW = [0, 0, 0, 0];
    const sx = sizeX / S;
    const sz = sizeZ / S;

    function writeSplat(o, w) {
        let a = clamp(w[0] || 0, 0, 1);
        let b = clamp(w[1] || 0, 0, 1);
        let c = clamp(w[2] || 0, 0, 1);
        const sum = a + b + c;
        if (sum > 1) {
            a /= sum;
            b /= sum;
            c /= sum;
        }
        splat[o] = a * 255;
        splat[o + 1] = b * 255;
        splat[o + 2] = c * 255;
        splat[o + 3] = clamp(w[3] || 0, 0, 1) * 255;
    }

    /**
     * Repinta a máscara dentro de `region` ({minX,maxX,minZ,maxZ}; null = tudo).
     * fn(x, z, h, slope, w) recebe os pesos atuais w = [w1, w2, w3, umidade] e os altera no lugar.
     */
    function paint(region, fn) {
        const r = region || { minX, maxX: minX + sizeX, minZ, maxZ: minZ + sizeZ };
        const i0 = clamp(Math.floor((r.minX - minX) / sx), 0, S - 1);
        const i1 = clamp(Math.ceil((r.maxX - minX) / sx), 0, S - 1);
        const j0 = clamp(Math.floor((r.minZ - minZ) / sz), 0, S - 1);
        const j1 = clamp(Math.ceil((r.maxZ - minZ) / sz), 0, S - 1);
        for (let j = j0; j <= j1; j++) {
            for (let i = i0; i <= i1; i++) {
                const x = minX + (i + 0.5) * sx;
                const z = minZ + (j + 0.5) * sz;
                const o = (j * S + i) * 4;
                tmpW[0] = splat[o] / 255;
                tmpW[1] = splat[o + 1] / 255;
                tmpW[2] = splat[o + 2] / 255;
                tmpW[3] = splat[o + 3] / 255;
                const out = fn(x, z, heightAt(x, z), slopeAt(x, z), tmpW) || tmpW;
                writeSplat(o, out);
            }
        }
        splatTex.needsUpdate = true;
    }
    paint(null, (x, z, h, slope, w) => {
        w[0] = w[1] = w[2] = w[3] = 0;
        return splatFn(x, z, h, slope, w);
    });

    /** Pesos das camadas no ponto (bilinear): out = [w0, w1, w2, w3, umidade]. */
    function weightsAt(x, z, out = [0, 0, 0, 0, 0]) {
        const fx = clamp((x - minX) / sx - 0.5, 0, S - 1.001);
        const fz = clamp((z - minZ) / sz - 0.5, 0, S - 1.001);
        const i = Math.floor(fx);
        const j = Math.floor(fz);
        const u = fx - i;
        const v = fz - j;
        const o = (j * S + i) * 4;
        const k00 = (1 - u) * (1 - v) / 255;
        const k10 = u * (1 - v) / 255;
        const k01 = (1 - u) * v / 255;
        const k11 = u * v / 255;
        for (let c = 0; c < 4; c++) {
            out[c === 3 ? 4 : c + 1] = splat[o + c] * k00 + splat[o + 4 + c] * k10 + splat[o + S * 4 + c] * k01 + splat[o + S * 4 + 4 + c] * k11;
        }
        out[0] = Math.max(0, 1 - out[1] - out[2] - out[3]);
        return out;
    }

    // ---------- camadas PBR ----------
    const L = layers.slice(0, 4);
    while (L.length < 4) L.push({ ...L[L.length - 1] });
    const texSize = T.tex;
    const alb = arrayTexture(texSize, 4, true);
    const nrm = arrayTexture(texSize, 4, false);
    for (let i = 0; i < 4; i++) {
        const ph = PLACEHOLDER[i];
        const a = alb.image.data;
        const m = nrm.image.data;
        const off = i * texSize * texSize * 4;
        for (let p = 0; p < texSize * texSize; p++) {
            const o = off + p * 4;
            a[o] = ph[0];
            a[o + 1] = ph[1];
            a[o + 2] = ph[2];
            a[o + 3] = 128;
            m[o] = m[o + 1] = 128;
            m[o + 2] = 255;
            m[o + 3] = 235;
        }
    }
    const sets = L.map((l) => pbrSet(l.set));
    const pending = new Set([0, 1, 2, 3]);
    let disposed = false;
    const ready = new Promise((resolve) => {
        const t0 = performance.now();
        const tick = () => {
            if (disposed) return resolve(false);
            let changed = false;
            for (const i of [...pending]) {
                const s = sets[i];
                if (s.map.image && s.normalMap.image && s.aoMap.image) {
                    fillLayer(alb, nrm, i, texSize, s);
                    pending.delete(i);
                    changed = true;
                }
            }
            if (changed) {
                alb.needsUpdate = true;
                nrm.needsUpdate = true;
            }
            if (!pending.size) resolve(true);
            else if (performance.now() - t0 > 20000) resolve(false);
            else setTimeout(tick, 60);
        };
        tick();
    });

    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, metalness: 0, envMapIntensity: 0.85 });
    material.name = 'gfxTerrain';
    const uniforms = {
        uGfxAlb: { value: alb },
        uGfxNrm: { value: nrm },
        uGfxSplat: { value: splatTex },
        uGfxRect: { value: new THREE.Vector4(minX, minZ, 1 / sizeX, 1 / sizeZ) },
        uGfxTile: { value: new THREE.Vector4(...L.map((l) => 1 / (l.scale || 3))) },
        uGfxNrmK: { value: new THREE.Vector4(...L.map((l) => l.normal ?? 1)) },
        uGfxRoughK: { value: new THREE.Vector4(...L.map((l) => l.rough ?? 1)) },
        uGfxTint: { value: L.map((l) => new THREE.Color(l.tint ?? 0xffffff)) },
        uGfxBlend: { value: blend },
        uGfxMacro: { value: macro },
        // cor e faixa [início, fim, força] da cobertura de grama — createGrass preenche
        uGfxCoverCol: { value: new THREE.Color(0x3f5a1c) },
        uGfxCoverDry: { value: new THREE.Color(0x5a5a2a) },
        uGfxCover: { value: new THREE.Vector3(30, 70, 0) }
    };
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vGfxPos;\nvarying vec3 vGfxNrm;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vGfxPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
                vGfxNrm = normalize(mat3(modelMatrix) * objectNormal);`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${TERRAIN_FRAG_HEAD}`)
            .replace('#include <map_fragment>', TERRAIN_FRAG_MAP)
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = roughness * gfxTRough;')
            .replace('#include <normal_fragment_maps>', TERRAIN_FRAG_NORMAL)
            .replace('#include <aomap_fragment>', `
                reflectedLight.indirectDiffuse *= gfxTAO;
                reflectedLight.indirectSpecular *= gfxTAO;
                reflectedLight.directDiffuse *= 0.6 + 0.4 * gfxTAO;`);
    };
    material.defines = { GFX_WMIN: T.wMin.toFixed(3) };
    if (T.antiTile) material.defines.GFX_ANTITILE = '';
    material.customProgramCacheKey = () => `gfxTerrain:${T.antiTile}:${T.wMin}`;

    // ---------- malha ----------
    const object = new THREE.Group();
    object.name = 'gfxTerrain';
    const skirt = nChunks > 1 ? Math.max(1.5, (maxY - minY) * 0.04) : 0;

    function buildChunk(ci, cj, step) {
        const i0 = ci * per;
        const j0 = cj * perZ;
        const w = per / step + 1;
        const h = perZ / step + 1;
        const ring = skirt > 0 ? 2 * (w + h) : 0;
        const pos = new Float32Array((w * h + ring) * 3);
        const nor = new Float32Array((w * h + ring) * 3);
        let o = 0;
        const put = (i, j, drop) => {
            const ii = clamp(i, 0, segX);
            const jj = clamp(j, 0, segZ);
            pos[o] = minX + ii * cellX;
            pos[o + 1] = H[jj * nx + ii] - drop;
            pos[o + 2] = minZ + jj * cellZ;
            const hl = H[jj * nx + Math.max(0, ii - 1)];
            const hr = H[jj * nx + Math.min(segX, ii + 1)];
            const hd = H[Math.max(0, jj - 1) * nx + ii];
            const hu = H[Math.min(segZ, jj + 1) * nx + ii];
            const ex = (Math.min(segX, ii + 1) - Math.max(0, ii - 1)) * cellX;
            const ez = (Math.min(segZ, jj + 1) - Math.max(0, jj - 1)) * cellZ;
            _v.set((hl - hr) / ex, 1, (hd - hu) / ez).normalize();
            nor[o] = _v.x;
            nor[o + 1] = _v.y;
            nor[o + 2] = _v.z;
            o += 3;
        };
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(i0 + i * step, j0 + j * step, 0);
        const idx = [];
        for (let j = 0; j < h - 1; j++) {
            for (let i = 0; i < w - 1; i++) {
                const a = j * w + i;
                idx.push(a, a + w, a + 1, a + 1, a + w, a + w + 1);
            }
        }
        if (skirt > 0) {
            // saia: repete a borda rebaixada para esconder frestas entre LODs vizinhos
            const edge = [];
            for (let i = 0; i < w; i++) edge.push(i);
            for (let j = 1; j < h; j++) edge.push(j * w + w - 1);
            for (let i = w - 2; i >= 0; i--) edge.push((h - 1) * w + i);
            for (let j = h - 2; j >= 1; j--) edge.push(j * w);
            const base = w * h;
            edge.forEach((e) => {
                const i = e % w;
                const j = (e - i) / w;
                put(i0 + i * step, j0 + j * step, skirt);
            });
            for (let k = 0; k < edge.length; k++) {
                const a = edge[k];
                const b = edge[(k + 1) % edge.length];
                const c = base + k;
                const d = base + ((k + 1) % edge.length);
                idx.push(a, b, c, b, d, c);
            }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o), 3));
        g.setAttribute('normal', new THREE.BufferAttribute(nor.subarray(0, o), 3));
        g.setIndex(pos.length / 3 > 65535 ? new THREE.BufferAttribute(new Uint32Array(idx), 1) : new THREE.BufferAttribute(new Uint16Array(idx), 1));
        g.computeBoundingSphere();
        g.computeBoundingBox();
        return g;
    }

    const chunkList = [];
    for (let cj = 0; cj < nChunks; cj++) {
        for (let ci = 0; ci < nChunks; ci++) {
            const hi = buildChunk(ci, cj, 1);
            const lo = nChunks > 1 ? buildChunk(ci, cj, 2) : null;
            const mesh = new THREE.Mesh(hi, material);
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            object.add(mesh);
            chunkList.push({ mesh, hi, lo, center: hi.boundingSphere.center });
        }
    }
    const lodDist = (Math.max(sizeX, sizeZ) / nChunks) * 1.6;
    const updaters = [];

    return {
        object,
        material,
        uniforms,
        size: [sizeX, sizeZ],
        bounds: { minX, maxX: minX + sizeX, minZ, maxZ: minZ + sizeZ, minY, maxY },
        tier: tn,
        /** Promise<boolean>: true quando as 4 camadas PBR carregaram (false = ficou no substituto liso). */
        ready,
        heightAt,
        normalAt,
        slopeAt,
        weightsAt,
        paint,
        /** Registra fn(camera) para rodar em terrain.update (usado por scatterModel para LOD/descarte). */
        onUpdate(fn) { updaters.push(fn); },
        /** Chame todo quadro: LOD dos chunks + LOD/descarte do que foi espalhado com scatterModel. */
        update(camera) {
            for (const fn of updaters) fn(camera);
            if (nChunks === 1) return;
            for (const c of chunkList) {
                const far = c.center.distanceTo(camera.position) > lodDist;
                const g = far ? c.lo : c.hi;
                if (c.mesh.geometry !== g) c.mesh.geometry = g;
            }
        },
        dispose() {
            disposed = true;
            for (const c of chunkList) {
                c.hi.dispose();
                c.lo?.dispose();
            }
            material.dispose();
            alb.dispose();
            nrm.dispose();
            splatTex.dispose();
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Texturas desenhadas (folhagem, flores, casca de bétula)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Canvas → DataTexture RGBA. Os pixels transparentes recebem a cor média dos
 * opacos: sem isso o filtro bilinear/mipmap puxa preto para a borda do recorte.
 * Linha 0 dos dados = topo do desenho (v = 0 em cima).
 */
function drawnTexture(w, h, draw, { alpha = true } = {}) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    if (alpha) {
        let r = 0;
        let gg = 0;
        let b = 0;
        let n = 0;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] > 200) {
                r += d[i];
                gg += d[i + 1];
                b += d[i + 2];
                n++;
            }
        }
        n = n || 1;
        r /= n;
        gg /= n;
        b /= n;
        for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] < 12) {
                d[i] = r;
                d[i + 1] = gg;
                d[i + 2] = b;
            }
        }
    }
    const tex = new THREE.DataTexture(new Uint8Array(d.buffer), w, h, THREE.RGBAFormat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
}

const drawnCache = new Map();
const cached = (key, make) => {
    if (!drawnCache.has(key)) drawnCache.set(key, make());
    return drawnCache.get(key);
};

/** Folha em gota com nervura. */
function leafPath(g, x, y, ang, len, wid, fill, vein) {
    g.save();
    g.translate(x, y);
    g.rotate(ang);
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(0, 0);
    g.bezierCurveTo(len * 0.25, -wid, len * 0.75, -wid * 0.8, len, 0);
    g.bezierCurveTo(len * 0.75, wid * 0.8, len * 0.25, wid, 0, 0);
    g.fill();
    if (vein) {
        g.strokeStyle = vein;
        g.lineWidth = Math.max(0.6, len * 0.03);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(len * 0.95, 0);
        g.stroke();
    }
    g.restore();
}

const hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

const FOLIAGE = {
    /** Ramo de latifoliada: galhinhos + folhas largas em três camadas (escuras atrás). */
    broad(g, S) {
        const rnd = seeded(41);
        g.strokeStyle = '#3a2c1e';
        g.lineCap = 'round';
        for (let i = 0; i < 9; i++) {
            const a = rnd() * TAU;
            g.lineWidth = 2 + rnd() * 2;
            g.beginPath();
            g.moveTo(S / 2, S / 2);
            g.quadraticCurveTo(S / 2 + Math.cos(a + 0.4) * S * 0.2, S / 2 + Math.sin(a + 0.4) * S * 0.2, S / 2 + Math.cos(a) * S * 0.4, S / 2 + Math.sin(a) * S * 0.4);
            g.stroke();
        }
        for (let pass = 0; pass < 4; pass++) {
            for (let i = 0; i < 46; i++) {
                const a = rnd() * TAU;
                const r = Math.pow(rnd(), 0.62) * S * 0.43;
                const len = S * (0.085 + rnd() * 0.06);
                const l = 22 + pass * 7 + rnd() * 7;
                leafPath(g, S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, a + (rnd() - 0.5) * 2.2, len, len * 0.36,
                    hsl(86 + rnd() * 30, 36 + rnd() * 20, l), hsl(92, 30, l + 12, 0.5));
            }
        }
    },
    /** Bétula: folhas pequenas em fios pendentes, mais claras e ralas. */
    birch(g, S) {
        const rnd = seeded(77);
        for (let pass = 0; pass < 3; pass++) {
            for (let s = 0; s < 13; s++) {
                let x = S * (0.08 + rnd() * 0.84);
                let y = S * (0.02 + rnd() * 0.22);
                // envelope em gota: fios mais longos no meio do cartão (silhueta arredondada, não quadrada)
                const reach = S * (0.3 + 0.66 * Math.pow(Math.sin(Math.PI * (x / S)), 0.7)) * (0.75 + rnd() * 0.25);
                const n = Math.max(3, Math.floor((reach - y) / (S * 0.045)));
                g.strokeStyle = '#4a3a28';
                g.lineWidth = 1.2;
                g.beginPath();
                g.moveTo(x, y);
                const pts = [];
                for (let k = 0; k < n; k++) {
                    x += (rnd() - 0.5) * S * 0.035;
                    y += S * 0.045;
                    pts.push([x, y]);
                    g.lineTo(x, y);
                }
                g.stroke();
                for (const [px, py] of pts) {
                    if (py > S * 0.98) continue;
                    const len = S * (0.045 + rnd() * 0.022);
                    const side = rnd() < 0.5 ? -1 : 1;
                    const l = 30 + pass * 8 + rnd() * 8;
                    leafPath(g, px, py, Math.PI / 2 + side * (0.5 + rnd() * 0.7), len, len * 0.42,
                        hsl(70 + rnd() * 26, 44 + rnd() * 16, l), hsl(80, 40, l + 12, 0.5));
                }
            }
        }
    },
    /** Ramo de conífera ao longo de u: massa escura de fundo, raminhos alternados e agulhas em 3 camadas. */
    needle(g, W, H) {
        const rnd = seeded(13);
        const mid = H / 2;
        const k = W / 512;
        const twig = (x0, y0, a, len, lw) => {
            const x1 = x0 + Math.cos(a) * len;
            const y1 = y0 + Math.sin(a) * len;
            const steps = Math.max(3, Math.floor(len / (2.6 * k)));
            for (let pass = 0; pass < 3; pass++) {
                g.lineWidth = 1.7 * k;
                for (let s = 0; s <= steps; s++) {
                    const t = s / steps;
                    const px = x0 + (x1 - x0) * t;
                    const py = y0 + (y1 - y0) * t;
                    for (const sd of [-1, 1]) {
                        const na = a + sd * (0.55 + rnd() * 0.6);
                        const nl = (13 + rnd() * 9) * (1 - t * 0.3) * k;
                        g.strokeStyle = hsl(112 + rnd() * 34, 30 + rnd() * 18, 15 + pass * 7 + rnd() * 8);
                        g.beginPath();
                        g.moveTo(px, py);
                        g.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl);
                        g.stroke();
                    }
                }
            }
            g.strokeStyle = '#3d2c1e';
            g.lineWidth = lw * k;
            g.beginPath();
            g.moveTo(x0, y0);
            g.lineTo(x1, y1);
            g.stroke();
        };
        const n = 25;
        for (let i = 0; i < n; i++) {
            const t = i / (n - 1);
            const x = W * (0.03 + t * 0.86);
            const len = H * 0.5 * (0.35 + 0.65 * Math.sin(Math.PI * Math.pow(t, 0.55))) * (0.85 + rnd() * 0.25) * (1 - t * 0.4);
            twig(x, mid, (i % 2 ? 1 : -1) * (0.85 + rnd() * 0.3), Math.max(8 * k, len), 1.6);
        }
        twig(W * 0.01, mid, 0, W * 0.95, 3.5);
    },
    /** Salgueiro: fios longos de cima para baixo com folhas lanceoladas. */
    willow(g, W, H) {
        const rnd = seeded(29);
        for (let pass = 0; pass < 2; pass++) {
            for (let s = 0; s < 11; s++) {
                let x = W * (0.06 + (s + rnd() * 0.8) / 11 * 0.88);
                let y = H * rnd() * 0.06;
                const end = H * (0.42 + 0.57 * Math.pow(Math.sin(Math.PI * (x / W)), 0.6)) * (0.78 + rnd() * 0.22);
                g.strokeStyle = hsl(60, 30, 22);
                g.lineWidth = 1.3;
                while (y < end) {
                    const nx = x + (rnd() - 0.5) * W * 0.03;
                    const ny = y + H * 0.022;
                    g.beginPath();
                    g.moveTo(x, y);
                    g.lineTo(nx, ny);
                    g.stroke();
                    const len = H * (0.05 + rnd() * 0.025);
                    const sd = rnd() < 0.5 ? -1 : 1;
                    const l = 30 + pass * 9 + rnd() * 9;
                    leafPath(g, nx, ny, Math.PI / 2 + sd * (0.35 + rnd() * 0.3), len, len * 0.16, hsl(68 + rnd() * 22, 38 + rnd() * 16, l), null);
                    x = nx;
                    y = ny;
                }
            }
        }
    },
    /** Fronde bipinada de samambaia ao longo de u (larga na base, afinando). */
    fern(g, W, H) {
        const rnd = seeded(53);
        const mid = H / 2;
        const n = 30;
        for (let i = 0; i < n; i++) {
            const t = i / (n - 1);
            const x = W * (0.04 + t * 0.94);
            const len = (mid - 4) * Math.pow(1 - t, 0.75) * (0.55 + 0.45 * smoothstep(0, 0.12, t)) * (0.92 + rnd() * 0.12);
            for (const sd of [-1, 1]) {
                const l = 25 + rnd() * 14;
                const a = sd * (1.25 - t * 0.2);
                // pina: eixo + pínulas em dente de serra
                g.fillStyle = hsl(96 + rnd() * 22, 42 + rnd() * 14, l);
                const cx = Math.cos(a);
                const sy = Math.sin(a);
                const k = Math.max(4, Math.floor(len / 6));
                g.beginPath();
                g.moveTo(x, mid);
                for (let j = 0; j <= k; j++) {
                    const u = j / k;
                    const w = (W / n) * 0.62 * (1 - u * 0.85);
                    const px = x + cx * len * u;
                    const py = mid + sy * len * u;
                    g.lineTo(px - sy * w * (j % 2 ? 1 : 0.45), py + cx * w * (j % 2 ? 1 : 0.45) * sd * sd);
                }
                for (let j = k; j >= 0; j--) {
                    const u = j / k;
                    const w = (W / n) * 0.62 * (1 - u * 0.85);
                    const px = x + cx * len * u;
                    const py = mid + sy * len * u;
                    g.lineTo(px + sy * w * (j % 2 ? 1 : 0.45), py - cx * w * (j % 2 ? 1 : 0.45));
                }
                g.closePath();
                g.fill();
                g.strokeStyle = hsl(100, 35, l + 12, 0.6);
                g.lineWidth = 1;
                g.beginPath();
                g.moveTo(x, mid);
                g.lineTo(x + cx * len, mid + sy * len);
                g.stroke();
            }
        }
        g.strokeStyle = '#5a4a2a';
        g.lineWidth = 4;
        g.beginPath();
        g.moveTo(0, mid);
        g.lineTo(W * 0.97, mid);
        g.stroke();
    },
    /** Fronde pinada rígida (cicadácea/palmeira): folíolos estreitos voltados para a ponta. */
    cycad(g, W, H) {
        const rnd = seeded(61);
        const mid = H / 2;
        const n = 46;
        for (let i = 0; i < n; i++) {
            const t = i / (n - 1);
            const x = W * (0.05 + t * 0.9);
            const len = (mid - 5) * (0.5 + 0.5 * Math.sin(Math.PI * Math.pow(t, 0.55))) * (0.9 + rnd() * 0.15);
            for (const sd of [-1, 1]) {
                const l = 22 + rnd() * 13;
                leafPath(g, x, mid, sd * (1.05 - t * 0.35), len * 1.08, 4.2 * (W / 512), hsl(104 + rnd() * 20, 40 + rnd() * 14, l), hsl(100, 30, l + 14, 0.5));
            }
        }
        g.strokeStyle = '#6a6a3a';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(0, mid);
        g.lineTo(W * 0.96, mid);
        g.stroke();
    },
    /** Folha grande em coração (pé de feijão) com nervuras. u = comprimento. */
    bean(g, W, H) {
        const mid = H / 2;
        const grd = g.createLinearGradient(0, 0, W, 0);
        grd.addColorStop(0, hsl(104, 52, 20));
        grd.addColorStop(1, hsl(96, 55, 32));
        g.fillStyle = grd;
        g.beginPath();
        g.moveTo(W * 0.08, mid);
        g.bezierCurveTo(W * 0.0, mid - H * 0.62, W * 0.55, mid - H * 0.56, W * 0.98, mid);
        g.bezierCurveTo(W * 0.55, mid + H * 0.56, W * 0.0, mid + H * 0.62, W * 0.08, mid);
        g.fill();
        g.strokeStyle = hsl(92, 45, 44, 0.8);
        g.lineCap = 'round';
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(0, mid);
        g.lineTo(W * 0.95, mid);
        g.stroke();
        g.lineWidth = 2.2;
        for (let i = 0; i < 9; i++) {
            const t = 0.1 + i * 0.09;
            for (const sd of [-1, 1]) {
                g.beginPath();
                g.moveTo(W * t, mid);
                g.quadraticCurveTo(W * (t + 0.1), mid + sd * H * 0.2, W * (t + 0.22), mid + sd * H * 0.4 * (1 - t * 0.8));
                g.stroke();
            }
        }
    }
};

function foliageTexture(kind) {
    return cached(`fol:${kind}`, () => {
        const wide = kind === 'needle' || kind === 'fern' || kind === 'cycad' || kind === 'bean';
        const w = 512;
        const h = wide ? 256 : kind === 'willow' ? 512 : 512;
        return drawnTexture(kind === 'willow' ? 256 : w, h, FOLIAGE[kind]);
    });
}

/** Atlas de flores: [0,⅓) margarida · [⅓,⅔) papoula · [⅔,1) haste verde. Pétala branca → tingida por instância. */
function flowerAtlas() {
    return cached('flowers', () => drawnTexture(192, 64, (g) => {
        const petals = (cx, n, len, wid) => {
            g.fillStyle = '#ffffff';
            for (let i = 0; i < n; i++) {
                g.save();
                g.translate(cx, 32);
                g.rotate((i / n) * TAU);
                g.beginPath();
                g.ellipse(len * 0.55, 0, len * 0.5, wid, 0, 0, TAU);
                g.fill();
                g.restore();
            }
        };
        petals(32, 12, 28, 5.5);
        g.fillStyle = '#f0b400';
        g.beginPath();
        g.arc(32, 32, 8, 0, TAU);
        g.fill();
        petals(96, 5, 29, 15);
        g.fillStyle = '#2a1c08';
        g.beginPath();
        g.arc(96, 32, 6.5, 0, TAU);
        g.fill();
        g.fillStyle = '#4f7a2a';
        g.fillRect(128, 0, 64, 64);
    }));
}

function birchBark() {
    return cached('birch', () => {
        const t = drawnTexture(256, 512, (g, W, H) => {
            const rnd = seeded(9);
            g.fillStyle = '#d9d6cc';
            g.fillRect(0, 0, W, H);
            for (let i = 0; i < 900; i++) {
                g.fillStyle = `rgba(${150 + rnd() * 80},${150 + rnd() * 75},${140 + rnd() * 70},0.25)`;
                g.fillRect(rnd() * W, rnd() * H, 6 + rnd() * 40, 1 + rnd() * 3);
            }
            for (let i = 0; i < 90; i++) {
                const y = rnd() * H;
                const x = rnd() * W;
                const w = 8 + rnd() * 46;
                g.fillStyle = `rgba(24,20,16,${0.5 + rnd() * 0.45})`;
                g.beginPath();
                g.ellipse(x, y, w, 1.2 + rnd() * 3.2, 0, 0, TAU);
                g.fill();
                if (rnd() < 0.18) {
                    g.beginPath();
                    g.moveTo(x - 10, y);
                    g.quadraticCurveTo(x, y - 16 - rnd() * 18, x + 12, y);
                    g.quadraticCurveTo(x, y + 6, x - 10, y);
                    g.fill();
                }
            }
        }, { alpha: false });
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        return t;
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Campo instanciado em células (base da grama e das flores)
// ═══════════════════════════════════════════════════════════════════════════

/** Fração da densidade cheia por anel: até `near` → 1; depois cai até o alcance. */
export const GRASS_LEVELS = [1, 0.55, 0.3, 0.16, 0.08];

/**
 * Células quadradas em volta da câmera. Cada célula guarda as instâncias em
 * ordem aleatória, então desenhar só as primeiras N (instanceCount) rarefaz por
 * igual — o LOD de densidade é só um número. As células são geradas de forma
 * determinística (semente = hash da célula) em uma fila, poucas por quadro.
 */
function createField({ cell, range, near, maxPerCell, levels = GRASS_LEVELS, generate, material, geoNear, geoFar, group, height = 1 }) {
    const active = new Map();
    const free = [];
    const queue = [];
    const R = Math.ceil(range / cell);
    const cand = levels.map((f) => Math.max(1, Math.round(maxPerCell * f)));
    const ring = (d) => {
        if (d <= near) return 0;
        const k = Math.min(levels.length - 1, 1 + Math.floor(((d - near) / Math.max(1, range - near)) * (levels.length - 1)));
        return k;
    };
    let frame = 0;
    let first = true;
    let density = 1;
    const radius = Math.hypot(cell, cell) * 0.5 + height;

    function makeSlot() {
        const mesh = new THREE.Mesh(geoNear, material);
        mesh.frustumCulled = true;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
        return { mesh, cap: 0, gNear: null, gFar: null, root: null, data: null, counts: new Int32Array(levels.length), level: 99, cx: 0, cz: 0, seen: 0, queued: false, sphere: new THREE.Sphere() };
    }

    function alloc(slot, capacity) {
        slot.gNear?.dispose();
        slot.gFar?.dispose();
        slot.cap = capacity;
        slot.root = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
        slot.data = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        const mk = (base) => {
            const g = new THREE.InstancedBufferGeometry();
            g.index = base.index;
            g.setAttribute('position', base.attributes.position);
            if (base.attributes.normal) g.setAttribute('normal', base.attributes.normal);
            if (base.attributes.uv) g.setAttribute('uv', base.attributes.uv);
            g.setAttribute('aRoot', slot.root);
            g.setAttribute('aData', slot.data);
            g.boundingSphere = slot.sphere;
            g.instanceCount = 0;
            return g;
        };
        slot.gNear = mk(geoNear);
        slot.gFar = geoFar ? mk(geoFar) : slot.gNear;
    }

    function build(slot, level) {
        const c = cand[level];
        if (slot.cap < c) alloc(slot, c);
        generate(slot.cx, slot.cz, c, cand, slot.counts, slot.root.array, slot.data.array, slot.sphere);
        slot.sphere.radius = Math.max(slot.sphere.radius, radius);
        slot.level = level;
        slot.root.needsUpdate = true;
        slot.data.needsUpdate = true;
        slot.queued = false;
    }

    function update(camera, budget = 2) {
        frame++;
        const px = camera.position.x;
        const pz = camera.position.z;
        const ccx = Math.floor(px / cell);
        const ccz = Math.floor(pz / cell);
        for (let dz = -R; dz <= R; dz++) {
            for (let dx = -R; dx <= R; dx++) {
                const cx = ccx + dx;
                const cz = ccz + dz;
                const mx = (cx + 0.5) * cell - px;
                const mz = (cz + 0.5) * cell - pz;
                const d = Math.hypot(mx, mz);
                if (d - cell * 0.71 > range) continue;
                const key = cx * 65536 + cz;
                let slot = active.get(key);
                if (!slot) {
                    slot = free.pop() || makeSlot();
                    slot.cx = cx;
                    slot.cz = cz;
                    slot.level = 99;
                    slot.queued = false;
                    slot.mesh.visible = false;
                    active.set(key, slot);
                }
                slot.seen = frame;
                slot.dist = d;
                const level = ring(Math.max(0, d - cell * 0.5));
                if (slot.level > level && !slot.queued) {
                    slot.queued = true;
                    slot.want = level;
                    queue.push(slot);
                } else if (slot.queued) {
                    slot.want = Math.min(slot.want, level);
                }
                if (slot.level !== 99) {
                    const useNear = d - cell * 0.5 < near;
                    const g = useNear ? slot.gNear : slot.gFar;
                    if (slot.mesh.geometry !== g) slot.mesh.geometry = g;
                    const n = Math.round(slot.counts[Math.max(level, slot.level)] * density);
                    g.instanceCount = n;
                    slot.mesh.visible = n > 0;
                }
            }
        }
        for (const [key, slot] of active) {
            if (slot.seen !== frame) {
                active.delete(key);
                slot.mesh.visible = false;
                free.push(slot);
            }
        }
        if (queue.length) {
            queue.sort((a, b) => b.dist - a.dist);
            let left = first ? Infinity : budget;
            while (queue.length && left > 0) {
                const slot = queue.pop();
                if (slot.seen !== frame || !slot.queued) {
                    slot.queued = false;
                    continue;
                }
                build(slot, slot.want);
                left--;
            }
            first = false;
        }
    }

    return {
        update,
        setDensity(k) { density = clamp(k, 0, 1); },
        /** Instâncias ativas; com `camera`, só as de células dentro do frustum (o que de fato é desenhado). */
        instances(camera = null) {
            if (camera) _frustum.setFromProjectionMatrix(_m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
            let n = 0;
            for (const s of active.values()) {
                if (s.mesh.visible && (!camera || _frustum.intersectsSphere(s.sphere))) n += s.mesh.geometry.instanceCount;
            }
            return n;
        },
        dispose() {
            for (const s of [...active.values(), ...free]) {
                s.gNear?.dispose();
                s.gFar?.dispose();
                group.remove(s.mesh);
            }
            active.clear();
            free.length = 0;
        }
    };
}

/** Lâmina: faixa com `segs` segmentos e ponta. position = (x afinado, t, lado −1|0|+1). */
function bladeGeometry(segs) {
    const pos = [];
    const idx = [];
    for (let j = 0; j < segs; j++) {
        const t = j / segs;
        const w = 0.5 * (1 - Math.pow(t, 1.8) * 0.82);
        pos.push(-w, t, -1, w, t, 1);
    }
    pos.push(0, 1, 0);
    for (let j = 0; j < segs - 1; j++) {
        const a = j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const a = (segs - 1) * 2;
    idx.push(a, a + 1, a + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    // normal de enfeite: sem o atributo o three compila o material como FLAT_SHADED
    g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    g.setIndex(idx);
    return g;
}

const MAX_TRAMPLERS = 8;

const GLSL_FIELD_VERT_HEAD = /* glsl */ `
attribute vec3 aRoot;
attribute vec4 aData;
uniform float uWindTime;
uniform float uWindStrength;
uniform float uGfxRange;
uniform float uGfxWind;
uniform vec2 uGfxWindDir;
uniform vec4 uGfxTramp[${MAX_TRAMPLERS}];
varying vec3 vGfxCol;
varying float vGfxT;
${GLSL_NOISE}
// deslocamento horizontal do vento, em "alturas de planta"
vec2 gfxFieldWind(vec2 p, float seed) {
    float gust = gfxNoise(p * 0.045 + vec2(uWindTime * 0.32, uWindTime * 0.21));
    float flut = sin(uWindTime * 2.6 + p.x * 0.9 + p.y * 1.3 + seed * 6.28) * 0.5 + sin(uWindTime * 4.3 + p.y * 2.1 + seed * 11.0) * 0.25;
    return uGfxWindDir * ((gust * 1.4 - 0.35) + flut * 0.22) * uWindStrength * uGfxWind;
}
// xy = empurrão para fora dos pisadores, z = achatamento 0..1
vec3 gfxTrample(vec3 root) {
    vec3 r = vec3(0.0);
    for (int i = 0; i < ${MAX_TRAMPLERS}; i++) {
        vec4 tp = uGfxTramp[i];
        if (tp.w > 0.0) {
            vec2 dv = root.xz - tp.xz;
            float dl = length(dv);
            float k = (1.0 - smoothstep(tp.w * 0.35, tp.w, dl)) * (1.0 - smoothstep(0.6, 1.8, abs(root.y - tp.y)));
            r.xy += dv / max(dl, 0.001) * k;
            r.z = max(r.z, k);
        }
    }
    return r;
}
`;

const GLSL_SOFT_NORMAL = /* glsl */ `
    float faceDirection = 1.0;
    vec3 normal = normalize(vNormal);
    vec3 nonPerturbedNormal = normal;`;

/** Luz atravessando folha/lâmina quando a câmera olha contra o sol. `gate` reduz o efeito na sombra. */
const glslTranslucency = (amount, weight = '1.0') => /* glsl */ `
#include <lights_fragment_end>
#if NUM_DIR_LIGHTS > 0
{
    vec3 gLc = directionalLights[0].color;
    float gBack = pow(clamp(dot(geometryViewDir, -directionalLights[0].direction), 0.0, 1.0), 3.0);
    float gLit = clamp(dot(reflectedLight.directDiffuse, vec3(3.0)) / (dot(diffuseColor.rgb * gLc, vec3(1.0)) + 1e-3), 0.0, 1.0);
    reflectedLight.directDiffuse += diffuseColor.rgb * gLc * gBack * (${weight}) * ${amount.toFixed(3)} * (0.45 + 0.55 * gLit);
}
#endif
`;

/**
 * Grama instanciada (e flores do campo) sobre um terreno.
 *
 * @param {object} o
 * @param {object} o.terrain                         retorno de createTerrain
 * @param {{minX,maxX,minZ,maxZ}} [o.area]            limite (padrão: o terreno todo)
 * @param {(x,z,h,slope)=>number} [o.maskFn]          0..1: probabilidade e altura relativa da lâmina.
 *        Padrão: onde a camada 0 (grama) domina e não há umidade/água — caminhos e margens pintados ficam limpos.
 * @param {number} [o.density]       lâminas por m² perto da câmera (padrão por tier: 150 / 70 / 50)
 * @param {number} [o.range]         alcance de desenho (m)
 * @param {number} [o.bladeHeight]   altura média (m)        [o.bladeWidth] largura na base (m)
 * @param {boolean} [o.cover]        tinge a camada 0 do terreno com a cor da grama (sob as lâminas e além do alcance)
 * @param {{base:number, tip:number, dry:number}} [o.colors]  [o.dryness] 0..1 quantidade de manchas secas
 * @param {number} [o.windStrength]  multiplica o vento global (flora.wind)
 * @param {[number,number]} [o.windDir] direção do vento em xz
 * @param {number} [o.translucency]  luz atravessando a lâmina na contraluz
 * @param {false|{density?:number, colors?:number[], range?:number, patch?:number, height?:number}} [o.flowers]
 *        flores do campo em manchas (density = flores/m² dentro da mancha)
 * @param {'auto'|'low'|'medium'|'high'} [o.tier]  [o.seed]
 * @returns {{ object, update(camera, dt, tramplers?), setDensity(k), stats(), dispose() }}
 *   tramplers: [{ x, y, z, radius }] (até 8) — jogador/animais que dobram a grama
 */
export function createGrass({
    terrain,
    area,
    maskFn,
    density,
    range,
    bladeHeight = 0.3,
    bladeWidth = 0.026,
    cover = true,
    colors = {},
    dryness = 0.55,
    windStrength = 1,
    windDir = [0.8, 0.6],
    translucency = 0.55,
    flowers = {},
    tier,
    seed = 7,
    cell = 10
} = {}) {
    const tn = tierName(tier ?? terrain.tier);
    const T = TERRAIN_TIERS[tn];
    const D = density ?? T.grassDensity;
    const RANGE = range ?? T.grassRange;
    const b = area || terrain.bounds;
    const w5 = [0, 0, 0, 0, 0];
    const defaultMask = (x, z) => {
        terrain.weightsAt(x, z, w5);
        return smoothstep(0.38, 0.8, w5[0]) * (1 - smoothstep(0.04, 0.3, w5[4]));
    };
    const mask = maskFn ? (x, z) => maskFn(x, z, terrain.heightAt(x, z), terrain.slopeAt(x, z)) : defaultMask;

    const group = new THREE.Group();
    group.name = 'gfxGrass';
    const tramp = Array.from({ length: MAX_TRAMPLERS }, () => new THREE.Vector4(0, 0, 0, 0));
    const wd = new THREE.Vector2(windDir[0], windDir[1]).normalize();
    const shared = {
        uWindTime: wind.uWindTime,
        uWindStrength: wind.uWindStrength,
        uGfxRange: { value: RANGE },
        uGfxWind: { value: windStrength },
        uGfxWindDir: { value: wd },
        uGfxTramp: { value: tramp }
    };

    // ---------- lâminas ----------
    const uniforms = {
        ...shared,
        // com menos lâminas por m² (tiers baixos) cada uma alarga para manter a cobertura: w·clamp(√(110/D), 1, 2,6)
        uGfxWidth: { value: bladeWidth * clamp(Math.sqrt(110 / D), 1, 2.6) },
        uGfxBase: { value: new THREE.Color(colors.base ?? 0x1c3410) },
        uGfxTip: { value: new THREE.Color(colors.tip ?? 0x5e8a2e) },
        uGfxDry: { value: new THREE.Color(colors.dry ?? 0x9c9448) },
        uGfxDryAmt: { value: dryness }
    };
    if (cover && terrain.uniforms?.uGfxCover) {
        terrain.uniforms.uGfxCoverCol.value.copy(uniforms.uGfxBase.value).lerp(uniforms.uGfxTip.value, 0.6).multiplyScalar(0.85);
        terrain.uniforms.uGfxCover.value.set(RANGE * 0.4, RANGE * 0.95, 0.82);
        terrain.uniforms.uGfxCoverDry.value.copy(uniforms.uGfxDry.value).multiplyScalar(0.8);
        terrain.uniforms.uGfxCoverDry.value.lerp(terrain.uniforms.uGfxCoverCol.value, 1 - dryness * 0.75);
    }
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.45 });
    material.name = 'gfxGrass';
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                ${GLSL_FIELD_VERT_HEAD}
                uniform float uGfxWidth;
                uniform vec3 uGfxBase;
                uniform vec3 uGfxTip;
                uniform vec3 uGfxDry;
                uniform float uGfxDryAmt;`)
            .replace('#include <beginnormal_vertex>', /* glsl */ `
                float gT = position.y;
                float gDist = distance(aRoot, cameraPosition);
                float gFade = 1.0 - smoothstep(uGfxRange * 0.72, uGfxRange, gDist);
                vec2 gDir = vec2(cos(aData.x), sin(aData.x));
                vec2 gSide = vec2(-gDir.y, gDir.x);
                vec3 gTr = gfxTrample(aRoot);
                float gH = aData.y * gFade * (1.0 - gTr.z * 0.55);
                vec2 gBend = gDir * aData.z + gfxFieldWind(aRoot.xz, aData.w) + gTr.xy * 0.9;
                float gBl = min(dot(gBend, gBend), 1.0);
                float gW = position.x * uGfxWidth * (1.0 + gDist * 0.045) * (0.75 + aData.w * 0.5);
                vec3 gPos = aRoot;
                gPos.xz += gSide * gW + gBend * gH * gT * gT;
                gPos.y += gH * gT * (1.0 - 0.35 * gBl * gT);
                // normal "de tapete": quase a do chão, arredondada de um lado ao outro da lâmina
                vec3 objectNormal = normalize(vec3(0.0, 1.0, 0.0) + vec3(gDir.x, 0.0, gDir.y) * 0.22
                    + vec3(gSide.x, 0.0, gSide.y) * position.z * 0.32 + vec3(gBend.x, 0.0, gBend.y) * 0.5 * gT);
                float gPatch = gfxNoise(aRoot.xz * 0.035 + 11.0);
                vec3 gCol = mix(uGfxBase, uGfxTip, pow(gT, 1.25));
                gCol = mix(gCol, uGfxDry, smoothstep(0.5, 0.9, gPatch + (aData.w - 0.5) * 0.5) * uGfxDryAmt * (0.35 + 0.65 * gT));
                gCol *= 0.8 + 0.4 * aData.w;
                gCol *= mix(0.5, 1.0, smoothstep(0.0, 0.7, gT));
                vGfxCol = gCol;
                vGfxT = gT;`)
            .replace('#include <begin_vertex>', 'vec3 transformed = gPos;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vGfxCol;\nvarying float vGfxT;')
            .replace('#include <color_fragment>', 'diffuseColor.rgb = vGfxCol;')
            .replace('#include <normal_fragment_begin>', GLSL_SOFT_NORMAL)
            .replace('#include <lights_fragment_end>', glslTranslucency(translucency, 'vGfxT'));
    };
    material.customProgramCacheKey = () => `gfxGrass:${translucency}`;

    const maxPerCell = Math.round(D * cell * cell);
    const gen = (cx, cz, n, cand, counts, root, data, sphere) => {
        const rnd = seeded(hashCell(cx, cz, seed));
        const x0 = cx * cell;
        const z0 = cz * cell;
        let k = 0;
        let lo = Infinity;
        let hi = -Infinity;
        let li = cand.length - 1;
        for (let i = 0; i < n; i++) {
            while (li >= 0 && cand[li] === i) counts[li--] = k;
            const x = x0 + rnd() * cell;
            const z = z0 + rnd() * cell;
            const r1 = rnd();
            const r2 = rnd();
            const r3 = rnd();
            const r4 = rnd();
            if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
            const m = mask(x, z);
            if (m < 0.03 || r1 > m) continue;
            const y = terrain.heightAt(x, z);
            const clump = noise2(x * 0.42, z * 0.42, 0, seed);
            root[k * 3] = x;
            root[k * 3 + 1] = y;
            root[k * 3 + 2] = z;
            data[k * 4] = r2 * TAU;
            data[k * 4 + 1] = bladeHeight * (0.5 + 0.5 * m) * (0.55 + 0.9 * clump) * (0.7 + 0.6 * r3);
            data[k * 4 + 2] = 0.12 + r4 * 0.5;
            data[k * 4 + 3] = r3;
            if (y < lo) lo = y;
            if (y > hi) hi = y;
            k++;
        }
        while (li >= 0) counts[li--] = k;
        if (!k) {
            lo = hi = terrain.heightAt(x0 + cell / 2, z0 + cell / 2);
        }
        sphere.center.set(x0 + cell / 2, (lo + hi) / 2, z0 + cell / 2);
        sphere.radius = Math.hypot(cell, cell) * 0.5 + (hi - lo) * 0.5 + 1;
    };
    const field = createField({
        cell, range: RANGE, near: T.grassNear, maxPerCell, generate: gen, material,
        geoNear: bladeGeometry(3), geoFar: bladeGeometry(1), group, height: bladeHeight * 2
    });

    // ---------- flores ----------
    let flowerField = null;
    let flowerMat = null;
    if (flowers) {
        const fo = { density: 1.6, range: T.flowerRange, patch: 26, height: 0.34, colors: [0xffffff, 0xf2c21e, 0xb48ae0, 0xe0412e, 0xf07aa8, 0x6f9be8], ...flowers };
        const palette = Array.from({ length: 6 }, (_, i) => new THREE.Color(fo.colors[i % fo.colors.length]));
        const fu = { ...shared, uGfxRange: { value: fo.range }, uGfxPalette: { value: palette } };
        flowerMat = new THREE.MeshStandardMaterial({ map: flowerAtlas(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7, metalness: 0, envMapIntensity: 0.5 });
        flowerMat.name = 'gfxFlowers';
        flowerMat.onBeforeCompile = (shader) => {
            Object.assign(shader.uniforms, fu);
            shader.vertexShader = shader.vertexShader
                .replace('#include <common>', `#include <common>\n${GLSL_FIELD_VERT_HEAD}\nuniform vec3 uGfxPalette[6];`)
                .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv.x += step(0.5, position.z) * mod(floor(aData.w), 2.0) / 3.0;')
                .replace('#include <beginnormal_vertex>', /* glsl */ `
                    float gT = position.y;
                    float gDist = distance(aRoot, cameraPosition);
                    float gFade = 1.0 - smoothstep(uGfxRange * 0.7, uGfxRange, gDist);
                    float gCs = cos(aData.x);
                    float gSn = sin(aData.x);
                    vec3 gTr = gfxTrample(aRoot);
                    float gH = aData.y * gFade * (1.0 - gTr.z * 0.6);
                    vec2 gBend = (gfxFieldWind(aRoot.xz, fract(aData.w)) * 0.55 + gTr.xy * 0.8);
                    vec3 gLoc = normal * mix(1.0, aData.z * gFade, step(0.5, position.z));
                    vec3 gPos = aRoot + vec3(gLoc.x * gCs - gLoc.z * gSn, gLoc.y, gLoc.x * gSn + gLoc.z * gCs);
                    gPos.xz += gBend * gH * gT * gT;
                    gPos.y += gH * gT * (1.0 - 0.3 * min(dot(gBend, gBend), 1.0));
                    vec3 objectNormal = normalize(vec3(gBend.x * 0.4, 1.0, gBend.y * 0.4));
                    vGfxCol = uGfxPalette[int(mod(floor(aData.w), 6.0))];
                    vGfxT = gT;`)
                .replace('#include <begin_vertex>', 'vec3 transformed = gPos;');
            shader.fragmentShader = shader.fragmentShader
                .replace('#include <common>', '#include <common>\nvarying vec3 vGfxCol;\nvarying float vGfxT;')
                .replace('#include <map_fragment>', `#include <map_fragment>
                    diffuseColor.rgb *= mix(vec3(1.0), vGfxCol, smoothstep(0.25, 0.8, diffuseColor.b));`)
                .replace('#include <normal_fragment_begin>', GLSL_SOFT_NORMAL)
                .replace('#include <lights_fragment_end>', glslTranslucency(0.5));
        };
        flowerMat.customProgramCacheKey = () => 'gfxFlowers';

        // geometria: haste (2 segmentos) + corola (um quadro deitado e um em pé). normal = deslocamento local.
        const pos = [];
        const loc = [];
        const uv = [];
        const idx = [];
        const sw = 0.005;
        for (let j = 0; j <= 2; j++) {
            pos.push(0, j / 2, 0, 0, j / 2, 0);
            loc.push(-sw, 0, 0, sw, 0, 0);
            uv.push(0.75, 0.5, 0.85, 0.5);
        }
        idx.push(0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4);
        const quad = (ax, ay, az, bx, by, bz) => {
            const o = pos.length / 3;
            for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
                pos.push(0, 1, 1);
                loc.push(ax * u + bx * v, ay * u + by * v, az * u + bz * v);
                uv.push((u * 0.5 + 0.5) / 3, v * 0.5 + 0.5);
            }
            idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
        };
        quad(1, 0, 0, 0, 0.42, 0.9);
        quad(0.34, 0, 0.94, 0, 1, 0);
        const fg = new THREE.BufferGeometry();
        fg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        fg.setAttribute('normal', new THREE.Float32BufferAttribute(loc, 3));
        fg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        fg.setIndex(idx);

        const fcell = cell;
        const fgen = (cx, cz, n, cand, counts, root, data, sphere) => {
            const rnd = seeded(hashCell(cx, cz, seed + 101));
            const x0 = cx * fcell;
            const z0 = cz * fcell;
            let k = 0;
            let lo = Infinity;
            let hi = -Infinity;
            let li = cand.length - 1;
            for (let i = 0; i < n; i++) {
                while (li >= 0 && cand[li] === i) counts[li--] = k;
                const x = x0 + rnd() * fcell;
                const z = z0 + rnd() * fcell;
                const r1 = rnd();
                const r2 = rnd();
                const r3 = rnd();
                if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue;
                const patch = smoothstep(0.52, 0.72, fbm2(x / fo.patch + 13.7, z / fo.patch + 4.1, 3, 0, seed));
                if (r1 > patch) continue;
                const m = mask(x, z);
                if (m < 0.5) continue;
                // cada mancha tem uma espécie dominante (ruído de baixa frequência) com alguma mistura
                const sp = Math.floor(noise2(x / (fo.patch * 0.8) + 71, z / (fo.patch * 0.8) + 9, 0, seed) * 5.99 + (r3 < 0.2 ? r2 * 6 : 0)) % 6;
                const y = terrain.heightAt(x, z);
                root[k * 3] = x;
                root[k * 3 + 1] = y;
                root[k * 3 + 2] = z;
                data[k * 4] = r2 * TAU;
                data[k * 4 + 1] = fo.height * (0.65 + 0.7 * r3);
                data[k * 4 + 2] = 0.045 + 0.035 * r2;
                data[k * 4 + 3] = sp + r3 * 0.99;
                if (y < lo) lo = y;
                if (y > hi) hi = y;
                k++;
            }
            while (li >= 0) counts[li--] = k;
            if (!k) lo = hi = terrain.heightAt(x0 + fcell / 2, z0 + fcell / 2);
            sphere.center.set(x0 + fcell / 2, (lo + hi) / 2, z0 + fcell / 2);
            sphere.radius = Math.hypot(fcell, fcell) * 0.5 + (hi - lo) * 0.5 + 1;
        };
        flowerField = createField({
            cell: fcell, range: fo.range, near: fo.range * 0.45, maxPerCell: Math.round(fo.density * fcell * fcell),
            levels: [1, 0.7, 0.45], generate: fgen, material: flowerMat, geoNear: fg, geoFar: null, group, height: 1
        });
    }

    return {
        object: group,
        material,
        uniforms,
        /**
         * Chame todo quadro. `tramplers`: [{x, y, z, radius}] (ou Vector3 com .radius) — até 8.
         */
        update(camera, dt = 0.016, tramplers = null) {
            for (let i = 0; i < MAX_TRAMPLERS; i++) {
                const t = tramplers?.[i];
                if (t) tramp[i].set(t.x, t.y, t.z, t.radius ?? 0.8);
                else tramp[i].w = 0;
            }
            field.update(camera);
            flowerField?.update(camera);
        },
        /** 0..1: fração das lâminas desenhadas (use em stage.onTier para aliviar a carga). */
        setDensity(k) {
            field.setDensity(k);
            flowerField?.setDensity(k);
        },
        /** { blades, flowers }: com `camera`, conta só o que está no frustum. */
        stats: (camera = null) => ({ blades: field.instances(camera), flowers: flowerField?.instances(camera) ?? 0 }),
        dispose() {
            field.dispose();
            flowerField?.dispose();
            material.dispose();
            flowerMat?.dispose();
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Árvores
// ═══════════════════════════════════════════════════════════════════════════

class GeoBuf {
    constructor() {
        this.pos = [];
        this.nor = [];
        this.uv = [];
        this.wind = [];
        this.col = [];
        this.idx = [];
    }

    get count() { return this.pos.length / 3; }

    build(withColor = false) {
        if (!this.idx.length) return null;
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 1));
        if (withColor) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        g.setIndex(this.idx);
        g.computeBoundingBox();
        g.computeBoundingSphere();
        return g;
    }
}

const _tan = V3();
const _a = V3();
const _b = V3();

/**
 * Tubo ao longo de `pts` com raios `radii` (quadros por transporte paralelo, sem torção).
 * `flare` abre a base em contrafortes:  r(θ) = r·(1 + flare·e^(−1,3·s/(2,2·r₀))·(¼ + ¾·(½ + ½·sin(5θ + φ))²))
 * UV: u = voltas inteiras (≈ 1 tile a cada `vTile` m de perímetro), v = comprimento / vTile.
 */
function addTube(buf, pts, radii, { segs = 8, vTile = 1.6, wind0 = 0, wind1 = 0, flare = 0, phase = 0 } = {}) {
    const n = pts.length;
    const base = buf.count;
    const uT = Math.max(1, Math.round((TAU * radii[0]) / vTile));
    let len = 0;
    for (let i = 0; i < n; i++) {
        const p = pts[i];
        _tan.subVectors(pts[Math.min(i + 1, n - 1)], pts[Math.max(i - 1, 0)]).normalize();
        if (i === 0) {
            _a.crossVectors(_tan, Math.abs(_tan.y) < 0.9 ? UP : _v.set(1, 0, 0)).normalize();
        } else {
            _a.addScaledVector(_tan, -_a.dot(_tan)).normalize();
            len += p.distanceTo(pts[i - 1]);
        }
        _b.crossVectors(_tan, _a);
        const w = lerp(wind0, wind1, i / (n - 1));
        const fl = flare > 0 ? flare * Math.exp((-len * 1.3) / (radii[0] * 2.2)) : 0;
        for (let s = 0; s <= segs; s++) {
            const ang = (s / segs) * TAU;
            const c = Math.cos(ang);
            const si = Math.sin(ang);
            const rr = radii[i] * (1 + fl * (0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.sin(ang * 5 + phase), 2)));
            const nx = _a.x * c + _b.x * si;
            const ny = _a.y * c + _b.y * si;
            const nz = _a.z * c + _b.z * si;
            buf.pos.push(p.x + nx * rr, p.y + ny * rr, p.z + nz * rr);
            buf.nor.push(nx, ny, nz);
            buf.uv.push((s / segs) * uT, len / vTile);
            buf.wind.push(w);
            buf.col.push(1, 1, 1);
        }
    }
    const row = segs + 1;
    for (let i = 0; i < n - 1; i++) {
        for (let s = 0; s < segs; s++) {
            const p0 = base + i * row + s;
            const p1 = p0 + row;
            buf.idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1);
        }
    }
}

/** Cartão de folhagem: centro c, meio-eixos ax (largura) e ay (altura; a borda −ay recebe v = 1). */
function addCard(buf, c, ax, ay, tint, w0, w1, u0 = 0, u1 = 1) {
    const o = buf.count;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        buf.pos.push(c.x + ax.x * su + ay.x * sv, c.y + ax.y * su + ay.y * sv, c.z + ax.z * su + ay.z * sv);
        buf.nor.push(0, 1, 0);
        buf.uv.push(su < 0 ? u0 : u1, sv < 0 ? 1 : 0);
        buf.wind.push(sv < 0 ? w0 : w1);
        buf.col.push(tint[0], tint[1], tint[2]);
    }
    buf.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
}

/** Fronde arqueada com seção em V (3 vértices por seção). `profile(t)` dá a meia-largura relativa. */
function addFrond(buf, origin, yaw, lift, droop, length, width, { segs = 7, profile, fold = 0.3, windBase = 0.25, tint = [1, 1, 1] } = {}) {
    const o = buf.count;
    const dirH = V3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = V3(Math.cos(yaw), 0, -Math.sin(yaw));
    const p = origin.clone();
    let ang = lift;
    const step = length / segs;
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        if (i > 0) {
            ang -= (droop * (0.4 + t * 1.6)) / segs;
            p.addScaledVector(dirH, Math.cos(ang) * step).y += Math.sin(ang) * step;
        }
        const w = width * 0.5 * (profile ? profile(t) : 0.25 + 0.75 * Math.sin(Math.PI * Math.pow(t, 0.7)));
        const ux = -dirH.x * Math.sin(ang);
        const uy = Math.cos(ang);
        const uz = -dirH.z * Math.sin(ang);
        for (const s of [-1, 0, 1]) {
            const f = Math.abs(s) * w * fold;
            buf.pos.push(p.x + side.x * w * s - ux * f, p.y - uy * f, p.z + side.z * w * s - uz * f);
            buf.nor.push(ux * 0.6 + side.x * s * 0.3, uy * 0.6 + 0.4, uz * 0.6 + side.z * s * 0.3);
            buf.uv.push(t, s * 0.5 + 0.5);
            buf.wind.push(windBase + t * t * (1 - windBase));
            const ao = 0.55 + 0.45 * smoothstep(0, 0.5, t);
            buf.col.push(tint[0] * ao, tint[1] * ao, tint[2] * ao);
        }
    }
    for (let i = 0; i < segs; i++) {
        const a = o + i * 3;
        buf.idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
}

/**
 * Normais esféricas + AO da copa em cor de vértice.
 *   'ball':  n = normalize((p − c)/r·(1; 0,6; 1) + 0,65·ŷ),   k = |(p − c)/r|
 *   'axis':  n = normalize(p.xz/rAt(y) + 0,55·ŷ),      k = |p.xz| / rAt(y)     (coníferas: raio varia com a altura)
 *   ao = lerp(inner, 1, smoothstep(0,2, 0,95, k)) · lerp(0,8, 1, altura relativa)
 */
function shadeCrown(buf, from, { mode = 'ball', c, r, rAt, inner = 0.42 }) {
    for (let i = from; i < buf.count; i++) {
        const x = buf.pos[i * 3];
        const y = buf.pos[i * 3 + 1];
        const z = buf.pos[i * 3 + 2];
        let nx;
        let ny;
        let nz;
        let k;
        let hrel;
        if (mode === 'ball') {
            nx = (x - c.x) / r.x;
            ny = (y - c.y) / r.y;
            nz = (z - c.z) / r.x;
            k = Math.hypot(nx, ny, nz);
            hrel = clamp(ny * 0.5 + 0.5, 0, 1);
            // viés para cima: a base da copa recebe a luz do céu que atravessa as folhas, não o escuro do chão
            ny = ny * 0.6 + 0.65;
        } else {
            const rr = Math.max(0.3, rAt(y));
            nx = x / rr;
            nz = z / rr;
            k = Math.hypot(nx, nz);
            ny = 0.55;
            hrel = clamp((y - c.y) / r.y * 0.5 + 0.5, 0, 1);
        }
        const l = Math.hypot(nx, ny, nz) || 1;
        buf.nor[i * 3] = nx / l;
        buf.nor[i * 3 + 1] = ny / l;
        buf.nor[i * 3 + 2] = nz / l;
        const ao = lerp(inner, 1, smoothstep(0.2, 0.95, k)) * lerp(0.8, 1, hrel);
        buf.col[i * 3] *= ao;
        buf.col[i * 3 + 1] *= ao;
        buf.col[i * 3 + 2] *= ao;
    }
}

const leafTint = (rnd, v = 0.14) => [1 - v + rnd() * v * 1.6, 1 - v * 0.6 + rnd() * v, 1 - v * 1.4 + rnd() * v * 1.4];

function polyAt(pts, t, out = V3()) {
    const f = clamp(t, 0, 1) * (pts.length - 1);
    const i = Math.min(pts.length - 2, Math.floor(f));
    return out.lerpVectors(pts[i], pts[i + 1], f - i);
}

/**
 * Espécies. Alturas em metros; `detail` 0–2 corta ramificação e cartões.
 *   carvalho · betula · pinheiro · salgueiro · morta · cicadacea · samambaia · palmeira (flora.js)
 */
export const SPECIES = {
    carvalho: {
        gen: 'broad', height: 12.5, trunkFrac: 0.3, trunkR: 0.44, flare: 0.7, lean: 0.06, wobble: 0.14, leader: false,
        limbs: 4, limbLen: 0.36, elev: [0.35, 0.95], levels: 3, children: [3, 2], ratio: 0.66, spread: 0.85, gnarl: 0.3, up: 0.3, droop: 0,
        leaf: 'broad', leafLevel: 2, leafSize: 2.5, leavesPerTwig: 2, leafColor: 0xdfe8d2, bark: 'bark_brown_02', barkColor: 0xb0a595, inner: 0.6
    },
    betula: {
        gen: 'broad', height: 13, trunkFrac: 0.96, trunkR: 0.17, flare: 0.25, lean: 0.1, wobble: 0.1, leader: true,
        limbs: 12, limbLen: 0.3, limbStart: 0.32, elev: [0.35, 1.0], levels: 2, children: [3], ratio: 0.6, spread: 0.7, gnarl: 0.18, up: 0.25, droop: 0.55,
        leaf: 'birch', leafLevel: 1, leafSize: 1.9, leavesPerTwig: 3, leafColor: 0xf2f2cc, bark: 'birch', barkColor: 0xffffff, inner: 0.55, upright: true
    },
    morta: {
        gen: 'broad', height: 9.5, trunkFrac: 0.42, trunkR: 0.36, flare: 0.6, lean: 0.14, wobble: 0.2, leader: false,
        limbs: 4, limbLen: 0.34, elev: [0.3, 1.0], levels: 3, children: [3, 2], ratio: 0.62, spread: 0.95, gnarl: 0.45, up: 0.1, droop: 0,
        leaf: null, bark: 'bark_brown_02', barkColor: 0x8f8a84
    },
    salgueiro: {
        gen: 'willow', height: 10, trunkR: 0.46, flare: 0.6, leaf: 'willow', leafColor: 0xeef2c8, bark: 'bark_brown_02', barkColor: 0xa39884
    },
    pinheiro: {
        gen: 'conifer', height: 17, trunkR: 0.3, flare: 0.35, leaf: 'needle', leafColor: 0xd6e2d4, bark: 'pine_bark', barkColor: 0xb8a898
    },
    cicadacea: {
        gen: 'frond', height: 1.5, trunkR: 0.24, fronds: 20, frondLen: 2.0, frondW: 0.6, lift: [0.2, 1.15], droop: 0.9, leaf: 'cycad',
        leafColor: 0xdfe8d2, bark: 'pine_bark', barkColor: 0xb09a80, barkGain: 2.2, stiff: true
    },
    samambaia: {
        gen: 'frond', height: 4.6, trunkR: 0.13, fronds: 13, frondLen: 3.1, frondW: 1.5, lift: [0.25, 1.0], droop: 1.75, leaf: 'fern',
        leafColor: 0xe2ecd0, bark: 'pine_bark', barkColor: 0x8c7054, barkGain: 2.2
    },
    palmeira: { gen: 'palm' }
};

function genBroadleaf(rnd, P, detail) {
    const wood = new GeoBuf();
    const anchors = [];
    const H = P.height * rnd.range(0.9, 1.1);
    const segT = [6, 8, 10][detail];
    const segB = [4, 5, 6][detail];
    const segW = [3, 3, 4][detail];
    const levels = Math.max(detail === 0 ? 2 : 1, Math.min(P.levels, detail === 0 ? 2 : P.levels));
    const trunkTop = H * P.trunkFrac;
    const ph = rnd() * TAU;
    const leanX = (rnd() - 0.5) * 2 * P.lean * H;
    const leanZ = (rnd() - 0.5) * 2 * P.lean * H;
    const nT = P.leader ? 10 : 6;
    const tp = [];
    const tr = [];
    for (let i = 0; i <= nT; i++) {
        const t = i / nT;
        tp.push(V3(leanX * t * t + Math.sin(t * 3.1 + ph) * P.wobble * t, t * trunkTop, leanZ * t * t + Math.cos(t * 2.6 + ph) * P.wobble * t));
        tr.push(P.trunkR * (P.leader ? Math.pow(1 - t, 0.85) * 0.94 + 0.06 : 1 - t * 0.36));
    }
    addTube(wood, tp, tr, { segs: segT, flare: P.flare, wind0: 0, wind1: P.leader ? 0.3 : 0.04, phase: ph });

    const d = V3();
    const axis = V3();
    function limb(o, dir, len, r, level) {
        const n = level === 1 ? 5 : level === 2 ? 4 : 3;
        const pts = [o.clone()];
        const rad = [r];
        d.copy(dir);
        for (let i = 1; i <= n; i++) {
            const t = i / n;
            d.x += (rnd() - 0.5) * P.gnarl;
            d.z += (rnd() - 0.5) * P.gnarl;
            d.y += (rnd() - 0.5) * P.gnarl * 0.6 + P.up * (1 - t * 0.5) * 0.3 - P.droop * t * t * (level > 1 ? 1 : 0.45);
            d.normalize();
            pts.push(pts[i - 1].clone().addScaledVector(d, len / n));
            rad.push(r * (1 - t * 0.8));
        }
        addTube(wood, pts, rad, { segs: level === 1 ? segB : segW, wind0: 0.06 * level, wind1: 0.1 * level + 0.18, vTile: 1.2 });
        const tipDir = d.clone();
        if (level < levels) {
            const k = Math.max(2, P.children[level - 1] - (detail === 0 ? 1 : 0));
            for (let c = 0; c < k; c++) {
                const t = lerp(0.3, 0.9, (c + rnd() * 0.8) / k);
                const pos = polyAt(pts, t);
                const i0 = Math.min(n - 1, Math.floor(t * n));
                const pd = V3().subVectors(pts[i0 + 1], pts[i0]).normalize();
                axis.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).cross(pd).normalize();
                const cd = pd.clone().applyAxisAngle(axis, P.spread * (0.7 + rnd() * 0.6));
                if (cd.y < -0.15 && !P.droop) cd.y = Math.abs(cd.y) * 0.5;
                limb(pos, cd.normalize(), len * P.ratio * (1.1 - 0.35 * t), r * (1 - t * 0.8) * 0.72, level + 1);
            }
            limb(pts[n], tipDir, len * P.ratio * 0.75, r * 0.22, level + 1);
        }
        if (P.leaf && level >= Math.min(P.leafLevel, levels)) {
            const k = P.leavesPerTwig + (level === levels ? 0 : -1);
            for (let j = 0; j < Math.max(1, k); j++) {
                const t = k <= 1 ? 1 : lerp(0.45, 1, (j + rnd() * 0.6) / (k - 0.4));
                anchors.push({ p: polyAt(pts, Math.min(1, t)), s: P.leafSize * (0.78 + rnd() * 0.5) });
            }
        }
    }

    if (P.leader) {
        const k = Math.max(5, Math.round(P.limbs * [0.55, 0.8, 1][detail]));
        for (let c = 0; c < k; c++) {
            const t = lerp(P.limbStart, 0.95, c / (k - 1));
            const az = c * 2.399 + rnd() * 0.5;
            const el = lerp(P.elev[0], P.elev[1], t) + (rnd() - 0.5) * 0.25;
            const dir = V3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
            limb(polyAt(tp, t), dir, P.limbLen * H * (1 - t * 0.72) * (0.8 + rnd() * 0.4), P.trunkR * (Math.pow(1 - t, 0.85) * 0.94 + 0.06) * 0.5, 1);
        }
        anchors.push({ p: tp[nT].clone(), s: P.leafSize });
    } else {
        const k = P.limbs;
        for (let c = 0; c < k; c++) {
            const az = (c / k) * TAU + rnd() * 0.7;
            const el = lerp(P.elev[0], P.elev[1], rnd());
            const dir = V3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
            limb(polyAt(tp, lerp(0.74, 1, rnd())), dir, P.limbLen * H * (0.8 + rnd() * 0.45), P.trunkR * 0.52, 1);
        }
        limb(tp[nT].clone(), V3((rnd() - 0.5) * 0.4, 1, (rnd() - 0.5) * 0.4).normalize(), P.limbLen * H * 0.85, P.trunkR * 0.55, 1);
    }

    const leaves = new GeoBuf();
    if (anchors.length) {
        const box = new THREE.Box3();
        for (const a of anchors) box.expandByPoint(a.p);
        const c = box.getCenter(V3());
        const sz = box.getSize(V3());
        const r = V3(Math.max(sz.x, sz.z) * 0.5 + P.leafSize * 0.5, sz.y * 0.5 + P.leafSize * 0.5, 0);
        const cards = detail === 0 ? 2 : 3;
        const ax = V3();
        const ay = V3();
        for (const a of anchors) {
            for (let i = 0; i < cards; i++) {
                const yaw = rnd() * TAU;
                const s = a.s * 0.5 * (detail === 0 ? 1.25 : 1);
                if (P.upright) {
                    ax.set(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(s * 0.85);
                    ay.set((rnd() - 0.5) * 0.3, 1, (rnd() - 0.5) * 0.3).normalize().multiplyScalar(s * 1.1);
                    _v.copy(a.p).y -= s * 0.75;
                } else {
                    const tilt = (rnd() - 0.5) * 1.5;
                    ax.set(Math.cos(yaw), 0, Math.sin(yaw));
                    ay.set(-Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt));
                    if (i === 0) ay.set(-Math.sin(yaw) * 0.94, 0.34, Math.cos(yaw) * 0.94); // um cartão quase deitado fecha a copa vista de baixo
                    ax.multiplyScalar(s);
                    ay.multiplyScalar(s);
                    _v.copy(a.p).add(_v2.set(rnd() - 0.5, rnd() - 0.4, rnd() - 0.5).multiplyScalar(a.s * 0.3));
                }
                const wv = clamp(0.3 + (_v.y / H) * 0.5, 0, 1);
                addCard(leaves, _v, ax, ay, leafTint(rnd), P.upright ? wv + 0.25 : wv, wv);
            }
        }
        shadeCrown(leaves, 0, { mode: 'ball', c, r, inner: P.inner ?? 0.45 });
    }
    return { wood, leaves, height: H, radius: P.limbLen * H * 1.5 };
}

/**
 * Conífera: tronco reto e verticilos de galhos que encurtam para o topo. Cada
 * galho leva um ramo de agulhas deitado e, nos tiers médio/alto, duas "abas"
 * caídas (seção em tenda). Verticilos alternados são mais curtos e mais
 * erguidos: preenchem o miolo da copa.
 */
function genConifer(rnd, P, detail) {
    const wood = new GeoBuf();
    const leaves = new GeoBuf();
    const H = P.height * rnd.range(0.85, 1.15);
    const ph = rnd() * TAU;
    const tp = [];
    const tr = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        tp.push(V3(Math.sin(t * 2.2 + ph) * 0.12 * t, t * H, Math.cos(t * 1.8 + ph) * 0.12 * t));
        tr.push(P.trunkR * (Math.pow(1 - t, 0.9) * 0.95 + 0.05));
    }
    addTube(wood, tp, tr, { segs: [6, 8, 9][detail], flare: P.flare, wind0: 0, wind1: 0.3, phase: ph });
    const y0 = H * 0.15;
    const Lmax = H * 0.25;
    const rAt = (y) => 0.35 + Lmax * Math.pow(clamp(1 - (y - y0) / (H - y0), 0, 1), 0.82);
    const stepY = [0.95, 0.8, 0.6][detail];
    const ax = V3();
    const ay = V3();
    const c = V3();
    const wing = V3();
    let w = 0;
    for (let y = y0; y < H * 0.975; y += stepY * (0.85 + rnd() * 0.3), w++) {
        const t = (y - y0) / (H - y0);
        const short = w % 2 === 1;
        const count = Math.max(3, Math.round(lerp([4, 5, 6][detail], 3, t)));
        const len = rAt(y) * (short ? 0.62 : 1);
        const o = polyAt(tp, y / H);
        for (let b = 0; b < count; b++) {
            const az = (b / count) * TAU + w * 1.1 + rnd() * 0.4;
            const pitch = lerp(-0.4, 0.35, t) + (short ? 0.32 : 0) + (rnd() - 0.5) * 0.15;
            const L = len * (0.8 + rnd() * 0.35);
            const dh = V3(Math.cos(az), 0, Math.sin(az));
            const tip = o.clone().addScaledVector(dh, L * Math.cos(pitch)).setY(o.y + L * Math.sin(pitch));
            if (detail > 0 && L > 1.7) {
                const mid = o.clone().lerp(tip, 0.55).setY(lerp(o.y, tip.y, 0.55) - L * 0.06);
                addTube(wood, [o, mid, tip], [0.05 * (1 - t * 0.6) + 0.015, 0.028, 0.008], { segs: 4, wind0: 0.1, wind1: 0.5, vTile: 0.8 });
            }
            const tint = leafTint(rnd, 0.1);
            ax.subVectors(tip, o).multiplyScalar(0.56);
            c.copy(o).lerp(tip, 0.56);
            c.y -= L * 0.03;
            ay.set(-dh.z, 0, dh.x).multiplyScalar(L * (detail === 0 ? 0.46 : 0.34));
            addCardU(leaves, c, ax, ay, tint, 0.2, 0.7);
            if (detail === 0) {
                ay.set(0, -1, 0).multiplyScalar(L * 0.26);
                c.y -= L * 0.2;
                addCardU(leaves, c, ax, ay, tint, 0.2, 0.7);
            } else {
                for (const sd of [-1, 1]) {
                    // aba: sai do eixo do galho para fora e para baixo
                    wing.set(-dh.z * sd * 0.8, -0.6, dh.x * sd * 0.8).multiplyScalar(L * 0.22);
                    ay.copy(wing);
                    _v.copy(o).lerp(tip, 0.5).add(wing);
                    _v.y -= L * 0.02;
                    _v2.subVectors(tip, o).multiplyScalar(0.48);
                    addCardU(leaves, _v, _v2, ay, tint, 0.25, 0.8);
                }
            }
        }
    }
    // ponteira
    for (let i = 0; i < 2; i++) {
        const yaw = i * 1.57 + ph;
        addCardU(leaves, V3(tp[10].x, H - 0.3, tp[10].z), V3(0, 1.05, 0), V3(Math.cos(yaw) * 0.5, 0, Math.sin(yaw) * 0.5), [1, 1, 1], 0.4, 0.6);
    }
    shadeCrown(leaves, 0, { mode: 'axis', c: V3(0, H * 0.6, 0), r: V3(Lmax, H * 0.4, 0), rAt, inner: 0.72 });
    return { wood, leaves, height: H + 0.7, radius: Lmax + 0.4 };
}

/** Cartão cujo eixo u (comprimento do ramo) segue `ax`: u=0 em −ax, u=1 em +ax; v ao longo de ay. */
function addCardU(buf, c, ax, ay, tint, w0, w1) {
    const o = buf.count;
    for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        buf.pos.push(c.x + ax.x * su + ay.x * sv, c.y + ax.y * su + ay.y * sv, c.z + ax.z * su + ay.z * sv);
        buf.nor.push(0, 1, 0);
        buf.uv.push(su * 0.5 + 0.5, sv * 0.5 + 0.5);
        buf.wind.push(su < 0 ? w0 : w1);
        buf.col.push(tint[0], tint[1], tint[2]);
    }
    buf.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
}

/** Salgueiro: tronco curto, galhos em arco e cortinas de ramos pendentes. */
function genWillow(rnd, P, detail) {
    const wood = new GeoBuf();
    const leaves = new GeoBuf();
    const H = P.height * rnd.range(0.9, 1.12);
    const ph = rnd() * TAU;
    const trunkTop = H * 0.3;
    const tp = [];
    const tr = [];
    const lx = (rnd() - 0.5) * 1.2;
    const lz = (rnd() - 0.5) * 1.2;
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        tp.push(V3(lx * t * t, t * trunkTop, lz * t * t));
        tr.push(P.trunkR * (1 - t * 0.3));
    }
    addTube(wood, tp, tr, { segs: [6, 8, 10][detail], flare: P.flare, phase: ph, wind1: 0.03 });
    const hang = [];
    const d = V3();
    function arc(o, dir, len, r, level) {
        const n = 6;
        const pts = [o.clone()];
        const rad = [r];
        d.copy(dir);
        for (let i = 1; i <= n; i++) {
            const t = i / n;
            d.y -= (level === 1 ? 0.2 : 0.34) * t;
            d.x += (rnd() - 0.5) * 0.15;
            d.z += (rnd() - 0.5) * 0.15;
            d.normalize();
            pts.push(pts[i - 1].clone().addScaledVector(d, len / n));
            rad.push(r * (1 - t * 0.82));
        }
        addTube(wood, pts, rad, { segs: level === 1 ? [4, 5, 6][detail] : 3, wind0: 0.05 * level, wind1: 0.3 + 0.1 * level, vTile: 1.2 });
        const every = level === 1 ? 2 : 1;
        for (let i = level === 1 ? 3 : 2; i <= n; i += every) hang.push(pts[i]);
        if (level === 1) {
            const k = detail === 0 ? 2 : 3;
            for (let c = 0; c < k; c++) {
                const t = lerp(0.35, 0.85, (c + rnd()) / k);
                const az = Math.atan2(dir.z, dir.x) + (rnd() - 0.5) * 2.2;
                arc(polyAt(pts, t), V3(Math.cos(az) * 0.8, 0.45, Math.sin(az) * 0.8).normalize(), len * 0.6, r * 0.45, 2);
            }
        }
    }
    const limbs = detail === 0 ? 4 : 5;
    for (let c = 0; c < limbs; c++) {
        const az = (c / limbs) * TAU + rnd() * 0.6;
        arc(polyAt(tp, lerp(0.75, 1, rnd())), V3(Math.cos(az) * 0.55, 0.85, Math.sin(az) * 0.55).normalize(), H * 0.62 * (0.85 + rnd() * 0.3), P.trunkR * 0.5, 1);
    }
    const ax = V3();
    const ay = V3();
    let top = 0;
    for (const p of hang) {
        top = Math.max(top, p.y);
        const n = detail === 0 ? 1 : 2;
        for (let i = 0; i < n; i++) {
            const yaw = rnd() * TAU;
            const len = Math.min(p.y - 0.7 - rnd() * 1.4, H * (0.16 + rnd() * 0.34));
            if (len < 0.8) continue;
            ax.set(Math.cos(yaw), 0, Math.sin(yaw)).multiplyScalar(0.55 + rnd() * 0.35);
            // a 2ª cortina de cada ponto abre para fora (arredonda o "ombro" da copa)
            const out = i === 1 ? 0.42 : 0.08;
            const rl = Math.hypot(p.x, p.z) || 1;
            ay.set(-(p.x / rl) * out + (rnd() - 0.5) * 0.12, 1, -(p.z / rl) * out + (rnd() - 0.5) * 0.12).normalize().multiplyScalar(len * 0.5);
            _v.copy(p).addScaledVector(ay, -1).y += 0.14;
            addCard(leaves, _v, ax, ay, leafTint(rnd, 0.12), 1, 0.3);
        }
    }
    shadeCrown(leaves, 0, { mode: 'ball', c: V3(0, top * 0.62, 0), r: V3(H * 0.55, top * 0.62, 0), inner: 0.5 });
    return { wood, leaves, height: top + 0.6, radius: H * 0.55 };
}

/** Samambaia arbórea / cicadácea: estipe + coroa de frondes arqueadas. */
function genFrondTree(rnd, P, detail) {
    const wood = new GeoBuf();
    const leaves = new GeoBuf();
    const H = P.height * rnd.range(0.75, 1.3);
    const ph = rnd() * TAU;
    const lx = (rnd() - 0.5) * 0.5 * H * 0.3;
    const lz = (rnd() - 0.5) * 0.5 * H * 0.3;
    const tp = [];
    const tr = [];
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        tp.push(V3(lx * t * t, t * H, lz * t * t));
        tr.push(P.trunkR * (P.stiff ? 1 + Math.sin(t * Math.PI) * 0.25 : 1.25 - t * 0.35 + Math.exp(-t * 9) * 0.5));
    }
    addTube(wood, tp, tr, { segs: [6, 8, 9][detail], vTile: 0.7, wind1: P.stiff ? 0 : 0.12, phase: ph });
    const top = tp[6];
    const n = Math.round(P.fronds * [0.6, 0.8, 1][detail]);
    const profile = P.stiff
        ? (t) => 0.55 + 0.45 * Math.sin(Math.PI * Math.pow(t, 0.6))
        : (t) => (0.35 + 0.65 * smoothstep(0, 0.14, t)) * Math.pow(1 - t, 0.7) + 0.04;
    for (let i = 0; i < n; i++) {
        const yaw = i * 2.399 + rnd() * 0.4;
        const age = (i % 3) / 2;
        const lift = lerp(P.lift[1], P.lift[0], age) + (rnd() - 0.5) * 0.2;
        addFrond(leaves, top, yaw, lift, P.droop * (0.75 + age * 0.4 + rnd() * 0.2), P.frondLen * (0.8 + rnd() * 0.35), P.frondW, {
            segs: detail === 0 ? 5 : 8, profile, fold: P.stiff ? 0.45 : 0.22, windBase: P.stiff ? 0.08 : 0.25, tint: leafTint(rnd, 0.1)
        });
    }
    return { wood, leaves, height: H + P.frondLen * 0.5, radius: P.frondLen };
}

const windUniforms = { uWindTime: wind.uWindTime, uWindStrength: wind.uWindStrength };

/**
 * Vento de árvore (mesma fórmula de flora.js, mais o balanço do tronco inteiro):
 *   balanço = y²·0,0011·força·(sin(0,83t + φ) + 0,4)        φ = fase pela posição da instância
 *   folhas:  Δx = (sin(1,3t + φ + 0,25y)·0,22 + sin(3,1t + 2φ + 1,7z)·0,05)·aWind·força
 */
function treeShader(material, { soft = false, trans = 0, mipAlpha = false } = {}) {
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, windUniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float aWind;\nuniform float uWindTime;\nuniform float uWindStrength;')
            .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
                #ifdef USE_INSTANCING
                    vec3 gIP = instanceMatrix[3].xyz;
                #else
                    vec3 gIP = modelMatrix[3].xyz;
                #endif
                float gPh = gIP.x * 0.37 + gIP.z * 0.23;
                float gSw = transformed.y * transformed.y * 0.0011 * uWindStrength;
                transformed.x += (sin(uWindTime * 0.83 + gPh) + 0.4) * gSw;
                transformed.z += cos(uWindTime * 0.67 + gPh * 1.4) * gSw * 0.7;
                float gWd = aWind * uWindStrength;
                transformed.x += (sin(uWindTime * 1.3 + gPh + transformed.y * 0.25) * 0.22
                    + sin(uWindTime * 3.1 + gPh * 2.0 + transformed.z * 1.7) * 0.05) * gWd;
                transformed.z += cos(uWindTime * 1.1 + gPh * 1.3 + transformed.x * 0.3) * 0.16 * gWd;
                transformed.y -= abs(sin(uWindTime * 1.3 + gPh)) * 0.06 * gWd;`);
        let fs = shader.fragmentShader;
        if (soft) fs = fs.replace('#include <normal_fragment_begin>', GLSL_SOFT_NORMAL);
        if (trans > 0) fs = fs.replace('#include <lights_fragment_end>', glslTranslucency(trans));
        if (mipAlpha) {
            // o mipmap corrói o recorte à distância: compensa o alfa pelo nível de mip
            fs = fs.replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
                #ifdef USE_MAP
                {
                    vec2 gTs = vMapUv * 512.0;
                    float gMip = max(0.0, 0.5 * log2(max(dot(dFdx(gTs), dFdx(gTs)), dot(dFdy(gTs), dFdy(gTs))) + 1e-8));
                    diffuseColor.a *= 1.0 + gMip * 0.22;
                }
                #endif`);
        }
        shader.fragmentShader = fs;
    };
    material.customProgramCacheKey = () => `gfxTree:${soft}:${trans}:${mipAlpha}`;
    return material;
}

function barkMaterial(P) {
    return cached(`bark:${P.bark}:${P.barkColor}`, () => {
        let m;
        if (P.bark === 'birch') {
            m = new THREE.MeshStandardMaterial({ map: birchBark(), normalMap: pbrSet('bark_brown_02').normalMap, roughness: 0.72, metalness: 0 });
            m.normalScale.set(0.5, 0.5);
        } else {
            m = pbrMaterial(P.bark, { color: P.barkColor, normalScale: 1.3 });
            // as cascas do Poly Haven são escuras; sob a copa o tronco some — ganho de albedo
            m.color.multiplyScalar(P.barkGain ?? 1.7);
        }
        m.name = `gfxBark:${P.bark}`;
        return treeShader(m);
    });
}

function leafMaterial(P) {
    return cached(`leaf:${P.leaf}:${P.leafColor}`, () => {
        const m = new THREE.MeshStandardMaterial({
            map: foliageTexture(P.leaf), color: P.leafColor, alphaTest: 0.36, alphaToCoverage: true, side: THREE.DoubleSide,
            vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 1.2
        });
        m.name = `gfxLeaf:${P.leaf}`;
        return treeShader(m, { soft: true, trans: 0.55, mipAlpha: true });
    });
}

/**
 * Kit de árvore: { parts: [{ geometry, material, shadow }], height, radius, species }.
 * Compatível com `instanceKit` de flora.js (LOD único) e com `createForest` (2 LODs).
 *
 * @param {object} o
 * @param {string} o.species  chave de SPECIES
 * @param {number} [o.seed]   cada semente gera uma árvore diferente da mesma espécie
 * @param {0|1|2} [o.detail]
 * @param {object} [o.params] sobrescreve parâmetros da espécie (height, trunkR, leafColor, palm: 'coco'|'imperial'|'jeriva'…)
 */
export function createTreeKit({ species = 'carvalho', seed = 1, detail = 2, params = {} } = {}) {
    const P = { ...(SPECIES[species] || SPECIES.carvalho), ...params };
    if (P.gen === 'palm') {
        const kit = createPalmKit({ kind: P.palm || 'coco', seed });
        for (const p of kit.parts) p.geometry.computeBoundingBox();
        return { ...kit, radius: 4.5, species };
    }
    const rnd = seeded(seed * 7919 + species.length * 131 + 3);
    const out = P.gen === 'conifer' ? genConifer(rnd, P, detail)
        : P.gen === 'willow' ? genWillow(rnd, P, detail)
            : P.gen === 'frond' ? genFrondTree(rnd, P, detail)
                : genBroadleaf(rnd, P, detail);
    const parts = [{ geometry: out.wood.build(false), material: barkMaterial(P), shadow: true }];
    const lg = out.leaves.build(true);
    if (lg) parts.push({ geometry: lg, material: leafMaterial(P), shadow: true, leaf: true });
    return { parts, height: out.height, radius: out.radius, species };
}

// ---------- impostor ----------

function kitReady(kit) {
    for (const p of kit.parts) {
        const m = p.material;
        if (m.map && !m.map.image) return false;
    }
    return true;
}

/**
 * Assa o kit em um atlas de 3 vistas (frente | lado | topo) com materiais sem luz
 * (albedo × AO de vértice) e devolve a malha de impostor: dois cartões cruzados
 * + um cartão deitado (o que se vê de cima, em câmeras aéreas). A luz do
 * impostor vem do material padrão com normais arredondadas, então ele acompanha
 * a hora do dia como a malha de perto.
 *   vista 0: câmera em +Z olhando −Z  (direita = +X)            → u ∈ [0, ⅓)
 *   vista 1: câmera em +X olhando −X  (direita = −Z)            → u ∈ [⅓, ⅔)
 *   vista 2: câmera em +Y olhando −Y  (direita = +X, cima = −Z) → u ∈ [⅔, 1)
 */
function bakeImpostor(renderer, kit, res) {
    const box = new THREE.Box3();
    for (const p of kit.parts) box.union(p.geometry.boundingBox);
    const W = Math.max(Math.abs(box.min.x), Math.abs(box.max.x), Math.abs(box.min.z), Math.abs(box.max.z)) * 2;
    const y0 = box.min.y;
    const y1 = box.max.y;
    const float = renderer.extensions.has('EXT_color_buffer_float') || renderer.extensions.has('EXT_color_buffer_half_float');
    const rt = new THREE.WebGLRenderTarget(res * 3, res * 2, {
        type: float ? THREE.HalfFloatType : THREE.UnsignedByteType, format: THREE.RGBAFormat, depthBuffer: true,
        generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter
    });
    rt.texture.anisotropy = 4;
    const scene = new THREE.Scene();
    const mats = [];
    for (const p of kit.parts) {
        const src = p.material;
        const m = new THREE.MeshBasicMaterial({
            map: src.map, color: src.color, alphaTest: src.alphaTest ? 0.3 : 0, side: THREE.DoubleSide,
            vertexColors: !!src.vertexColors, toneMapped: false
        });
        mats.push(m);
        scene.add(new THREE.Mesh(p.geometry, m));
    }
    const side = new THREE.OrthographicCamera(-W / 2, W / 2, y1, y0, 0.1, W * 2 + 2);
    const topCam = new THREE.OrthographicCamera(-W / 2, W / 2, W / 2, -W / 2, 0.1, y1 - y0 + 2);
    const prevRT = renderer.getRenderTarget();
    const prevColor = renderer.getClearColor(new THREE.Color());
    const prevAlpha = renderer.getClearAlpha();
    const prevAuto = renderer.autoClear;
    const prevShadow = renderer.shadowMap.autoUpdate;
    renderer.shadowMap.autoUpdate = false;
    renderer.autoClear = false;
    renderer.setClearColor(0x1c2610, 0);
    rt.scissorTest = false;
    rt.viewport.set(0, 0, res * 3, res * 2);
    renderer.setRenderTarget(rt);
    renderer.clear(true, true, false);
    for (let v = 0; v < 3; v++) {
        rt.viewport.set(v * res, 0, res, res * 2);
        rt.scissor.set(v * res, 0, res, res * 2);
        rt.scissorTest = true;
        renderer.setRenderTarget(rt);
        let cam = side;
        if (v === 0) cam.position.set(0, 0, W + 1);
        else if (v === 1) cam.position.set(W + 1, 0, 0);
        else {
            cam = topCam;
            cam.position.set(0, y1 + 1, 0);
            cam.up.set(0, 0, -1);
        }
        cam.lookAt(v === 2 ? cam.position.x : 0, v === 2 ? 0 : cam.position.y, 0);
        cam.updateMatrixWorld();
        renderer.render(scene, cam);
    }
    rt.scissorTest = false;
    rt.viewport.set(0, 0, res * 3, res * 2);
    renderer.setRenderTarget(prevRT);
    renderer.setClearColor(prevColor, prevAlpha);
    renderer.autoClear = prevAuto;
    renderer.shadowMap.autoUpdate = prevShadow;
    mats.forEach((m) => m.dispose());

    const buf = new GeoBuf();
    const h = y1 - y0;
    const cy = (y0 + y1) / 2;
    const nx = 3;
    const ny = 3;
    // cartões cruzados: normais arredondadas (como um cilindro) e levemente para cima
    for (let v = 0; v < 2; v++) {
        const o = buf.count;
        for (let j = 0; j <= ny; j++) {
            for (let i = 0; i <= nx; i++) {
                const a = i / nx - 0.5;
                const t = j / ny;
                const x = v === 0 ? a * W : 0;
                const z = v === 0 ? 0 : -a * W;
                const y = y0 + t * h;
                buf.pos.push(x, y, z);
                _v.set(x / (W * 0.5), ((y - cy) / (h * 0.5)) * 0.55 + 0.45, z / (W * 0.5)).normalize();
                buf.nor.push(_v.x, _v.y, _v.z);
                buf.uv.push(((a + 0.5) + v) / 3, t);
                buf.wind.push(t * 0.45);
                buf.col.push(1, 1, 1);
            }
        }
        for (let j = 0; j < ny; j++) {
            for (let i = 0; i < nx; i++) {
                const p0 = o + j * (nx + 1) + i;
                buf.idx.push(p0, p0 + 1, p0 + nx + 1, p0 + 1, p0 + nx + 2, p0 + nx + 1);
            }
        }
    }
    // cartão deitado na altura do "ombro" da copa
    const o = buf.count;
    const yq = y0 + h * 0.5;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        buf.pos.push(sx * W * 0.5, yq, sz * W * 0.5);
        _v.set(sx * 0.35, 1, sz * 0.35).normalize();
        buf.nor.push(_v.x, _v.y, _v.z);
        buf.uv.push((2 + (sx * 0.5 + 0.5)) / 3, 0.5 - sz * 0.5);
        buf.wind.push(0.25);
        buf.col.push(1, 1, 1);
    }
    buf.idx.push(o, o + 2, o + 1, o, o + 3, o + 2);
    const material = treeShader(new THREE.MeshStandardMaterial({
        map: rt.texture, color: 0xd4d4d4, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.95, metalness: 0, envMapIntensity: 0.45
    }), { soft: true, trans: 0.12 });
    material.name = 'gfxImpostor';
    return { geometry: buf.build(false), material, target: rt };
}

const _frustum = new THREE.Frustum();
const _sphere = new THREE.Sphere();

/**
 * Conjunto instanciado com 2 LODs. `assign` reparte as instâncias entre as malhas
 * de perto (`near`, várias partes) e a de longe (`far`), com descarte por
 * distância e por frustum. Quem está a menos de `keep` m nunca é descartado pelo
 * frustum: a sombra dele pode entrar no quadro.
 *   histerese: quem já está perto só vira "longe" 12 % além de `lod`.
 */
function createLodSet({ n, mats, cols = null, cx, cy, cz, cr, near, far = null, lod, maxDistance = Infinity, keep = 40 }) {
    const isNear = new Uint8Array(n);
    const set = { near, far, lod, maxDistance, nearCount: 0, farCount: 0 };
    const put = (i, mesh, k) => {
        const dst = mesh.instanceMatrix.array;
        const so = i * 16;
        const d0 = k * 16;
        for (let j = 0; j < 16; j++) dst[d0 + j] = mats[so + j];
        if (cols && mesh.instanceColor) {
            const c = mesh.instanceColor.array;
            c[k * 3] = cols[i * 3];
            c[k * 3 + 1] = cols[i * 3 + 1];
            c[k * 3 + 2] = cols[i * 3 + 2];
        }
    };
    const flush = (m, count) => {
        m.count = count;
        m.visible = count > 0;
        m.instanceMatrix.clearUpdateRanges();
        m.instanceMatrix.addUpdateRange(0, count * 16);
        m.instanceMatrix.needsUpdate = true;
        if (m.instanceColor) {
            m.instanceColor.clearUpdateRanges();
            m.instanceColor.addUpdateRange(0, count * 3);
            m.instanceColor.needsUpdate = true;
        }
    };
    set.assign = (px, py, pz, frustum) => {
        let nn = 0;
        let nf = 0;
        const useFar = !!set.far;
        for (let i = 0; i < n; i++) {
            const dx = cx[i] - px;
            const dy = cy[i] - py;
            const dz = cz[i] - pz;
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (d > set.maxDistance) continue;
            const isN = !useFar || d < (isNear[i] ? set.lod * 1.12 : set.lod);
            isNear[i] = isN ? 1 : 0;
            if (!(isN && d < keep)) {
                _sphere.center.set(cx[i], cy[i], cz[i]);
                _sphere.radius = cr[i] * (isN ? 1.6 : 1);
                if (!frustum.intersectsSphere(_sphere)) continue;
            }
            if (isN) {
                for (const m of set.near) put(i, m, nn);
                nn++;
            } else {
                put(i, set.far, nf++);
            }
        }
        for (const m of set.near) flush(m, nn);
        if (set.far) flush(set.far, nf);
        set.nearCount = nn;
        set.farCount = nf;
    };
    return set;
}

/** Devolve true (e guarda o estado) quando a câmera mudou desde a última chamada. */
function cameraMoved(camera, state) {
    camera.updateMatrixWorld();
    if (state.pos.distanceToSquared(camera.position) < 0.01 && state.q.angleTo(camera.quaternion) < 0.002) return false;
    state.pos.copy(camera.position);
    state.q.copy(camera.quaternion);
    _frustum.setFromProjectionMatrix(_m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    return true;
}
const cameraState = () => ({ pos: V3(Infinity, 0, 0), q: new THREE.Quaternion() });

/**
 * Floresta instanciada com 2 LODs.
 *
 * @param {object} o
 * @param {object} o.terrain
 * @param {THREE.WebGLRenderer} [o.renderer]  necessário para assar os impostores; sem ele todas as árvores ficam em malha
 * @param {Array<{x,z,species?,s?,ry?}>} [o.placements]   posições prontas (y vem do terreno) — ou:
 * @param {object} [o.scatter]                opções de `scatter` (count, area, maskFn, minDist, seed, slopeMax…)
 * @param {Array<string|{kind:string, weight?:number, scale?:[number,number], params?:object}>} [o.species]
 * @param {number} [o.variants]    árvores distintas por espécie (padrão por tier)
 * @param {number} [o.lodDistance] distância malha → impostor (padrão por tier: 70 / 46 / 24 m)
 * @param {number} [o.maxDistance] além disso a árvore não é desenhada (padrão: Infinity)
 * @param {boolean} [o.castShadow] [o.sink] quanto o tronco entra no chão (m)
 * @returns {{ object, placements, kits, ready, update(camera), stats(), dispose() }}
 */
export function createForest({
    terrain,
    renderer = null,
    placements = null,
    scatter: scatterOptions = null,
    species = ['carvalho'],
    variants,
    lodDistance,
    maxDistance = Infinity,
    tier,
    seed = 1,
    castShadow = true,
    sink = 0.12
} = {}) {
    const tn = tierName(tier ?? terrain.tier);
    const T = TERRAIN_TIERS[tn];
    const rnd = seeded(seed * 311 + 17);
    const lod = lodDistance ?? T.treeLod;
    const nVar = variants ?? T.variants;
    const list = placements || scatter({ terrain, count: 200, minDist: 5, slopeMax: 0.3, seed, ...scatterOptions });
    const defs = species.map((s) => (typeof s === 'string' ? { kind: s } : s)).map((s) => ({ weight: 1, scale: [0.8, 1.25], ...s }));
    const totalW = defs.reduce((a, s) => a + s.weight, 0);

    const group = new THREE.Group();
    group.name = 'gfxForest';
    const kits = [];
    defs.forEach((def, di) => {
        def.kits = [];
        for (let v = 0; v < nVar; v++) {
            const kit = createTreeKit({ species: def.kind, seed: seed * 13 + di * 101 + v * 17 + 1, detail: T.treeDetail, params: def.params });
            kit.trees = [];
            def.kits.push(kit);
            kits.push(kit);
        }
    });
    for (const pl of list) {
        let def = defs.find((s) => s.kind === pl.species);
        if (!def) {
            let r = rnd() * totalW;
            def = defs.find((s) => (r -= s.weight) <= 0) || defs[0];
        }
        const kit = def.kits[Math.floor(rnd() * def.kits.length) % def.kits.length];
        pl.species = def.kind;
        kit.trees.push({ pl, s: (pl.s ?? 1) * lerp(def.scale[0], def.scale[1], rnd()), ry: pl.ry ?? rnd() * TAU, tilt: (rnd() - 0.5) * 0.07, tint: 0.86 + rnd() * 0.28, warm: (rnd() - 0.5) * 0.12 });
    }

    const euler = new THREE.Euler();
    for (const kit of kits) {
        const n = kit.trees.length;
        kit.n = n;
        if (!n) continue;
        const mats = new Float32Array(n * 16);
        const cols = new Float32Array(n * 3);
        const cx = new Float32Array(n);
        const cy = new Float32Array(n);
        const cz = new Float32Array(n);
        const cr = new Float32Array(n);
        kit.trees.forEach((t, i) => {
            const y = terrain.heightAt(t.pl.x, t.pl.z) - sink * t.s;
            t.pl.y = y;
            euler.set(t.tilt, t.ry, t.tilt * 0.7);
            _m4.compose(_v.set(t.pl.x, y, t.pl.z), _q.setFromEuler(euler), _s.setScalar(t.s));
            _m4.toArray(mats, i * 16);
            cols[i * 3] = t.tint * (1 + t.warm);
            cols[i * 3 + 1] = t.tint;
            cols[i * 3 + 2] = t.tint * (1 - t.warm);
            cx[i] = t.pl.x;
            cy[i] = y + kit.height * t.s * 0.5;
            cz[i] = t.pl.z;
            cr[i] = Math.max(kit.height * 0.6, kit.radius) * t.s;
        });
        const near = kit.parts.map((p) => {
            const m = new THREE.InstancedMesh(p.geometry, p.material, n);
            if (p.leaf) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3);
            m.castShadow = castShadow && p.shadow !== false;
            m.receiveShadow = true;
            m.frustumCulled = false;
            m.count = 0;
            group.add(m);
            return m;
        });
        kit.set = createLodSet({ n, mats, cols, cx, cy, cz, cr, near, lod, maxDistance });
    }

    let baked = !renderer;
    let resolveReady;
    const ready = new Promise((r) => { resolveReady = r; });
    if (baked) resolveReady();
    function bakeNext() {
        let pendingBake = false;
        for (const kit of kits) {
            if (!kit.n || kit.set.far) continue;
            if (!kitReady(kit)) {
                pendingBake = true;
                continue;
            }
            const imp = bakeImpostor(renderer, kit, T.impostor);
            kit.impostor = imp;
            const m = new THREE.InstancedMesh(imp.geometry, imp.material, kit.n);
            m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(kit.n * 3).fill(1), 3);
            m.castShadow = castShadow && tn !== 'low';
            m.receiveShadow = false;
            m.frustumCulled = false;
            m.count = 0;
            group.add(m);
            kit.set.far = m;
            return; // um por quadro
        }
        if (!pendingBake) {
            baked = true;
            resolveReady();
        }
    }

    const camState = cameraState();
    /** Reparte as árvores entre malha e impostor. Barato: só refaz quando a câmera muda. */
    function update(camera) {
        const baking = !baked;
        if (baking) bakeNext();
        if (!cameraMoved(camera, camState) && !baking) return;
        if (baking) _frustum.setFromProjectionMatrix(_m4.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
        const p = camera.position;
        for (const kit of kits) if (kit.n) kit.set.assign(p.x, p.y, p.z, _frustum);
    }

    return {
        object: group,
        placements: list,
        kits,
        /** Resolve quando todos os impostores foram assados (as texturas de casca precisam ter carregado). */
        ready,
        update,
        stats() {
            let near = 0;
            let far = 0;
            for (const k of kits) {
                near += k.set?.nearCount || 0;
                far += k.set?.farCount || 0;
            }
            return { trees: list.length, near, far };
        },
        dispose() {
            for (const kit of kits) {
                for (const p of kit.parts) p.geometry.dispose();
                kit.impostor?.geometry.dispose();
                kit.impostor?.material.dispose();
                kit.impostor?.target.dispose();
            }
        }
    };
}

/**
 * Pé de feijão gigante: três caules trançados em hélice ao redor de um eixo que
 * serpenteia, folhas em coração em pecíolos e gavinhas.
 *   eixo(t)   = (A·s(t)·sin(5,1t + φ₁), t·H, A·s(t)·cos(4,3t + φ₂)),  s = smoothstep(0, 0,15, t), A = 0,9·raio
 *   caule k   = eixo(t) + R(t)·(cos θ_k, 0, sin θ_k),  θ_k = 2πk/3 + 2π·voltas·t
 *   R(t) = ½·raio·afina(t),  raio do caule = 0,55·raio·afina(t),  afina(t) = lerp(1, 0,28, t^1,2)
 *
 * @param {object} o
 * @param {number} [o.height] [o.radius] raio do feixe na base  [o.turns] voltas da trança (padrão altura/7)
 * @param {number} [o.leafSpacing] [o.leafSize]  [o.x] [o.y] [o.z] posição da base  [o.detail] 0–2
 * @returns {{ object, height,
 *   pointAt(t, target?)  ponto do lado de fora do caule 0 (trilha de escalada em espiral), t ∈ [0,1]
 *   axisAt(t, target?)   centro do feixe
 *   normalAt(t, target?) direção para fora no ponto de pointAt
 *   leaves: [{ position: Vector3, radius }]  folhas grandes (plataformas) }}
 */
export function createBeanstalk({
    height = 40, radius = 1, turns, seed = 1, leafSpacing = 2.2, leafSize = 3, x = 0, y = 0, z = 0, detail = 2
} = {}) {
    const rnd = seeded(seed * 71 + 9);
    const N = turns ?? height / 7;
    const p1 = rnd() * TAU;
    const p2 = rnd() * TAU;
    const A = radius * 0.9;
    const taper = (t) => lerp(1, 0.28, Math.pow(t, 1.2));
    const axisAt = (t, out = V3()) => {
        const s = smoothstep(0, 0.15, t);
        return out.set(A * s * Math.sin(t * 5.1 + p1), t * height, A * s * Math.cos(t * 4.3 + p2));
    };
    const theta = (k, t) => (k / 3) * TAU + TAU * N * t;
    const strand = (k, t, out = V3()) => {
        axisAt(t, out);
        const R = radius * 0.5 * taper(t);
        const th = theta(k, t);
        out.x += Math.cos(th) * R;
        out.z += Math.sin(th) * R;
        return out;
    };
    const wood = new GeoBuf();
    const rings = Math.ceil(height * [1.2, 1.8, 2.4][detail]);
    for (let k = 0; k < 3; k++) {
        const pts = [];
        const rad = [];
        for (let i = 0; i <= rings; i++) {
            const t = i / rings;
            pts.push(strand(k, t));
            rad.push(radius * 0.55 * taper(t) * (1 + 0.08 * Math.sin(t * 60 + k * 2)) * (t > 0.985 ? 0.4 : 1));
        }
        addTube(wood, pts, rad, { segs: [6, 8, 10][detail], vTile: 2.2, wind0: 0, wind1: 0.3, flare: 0.8, phase: k * 2.1 });
    }
    const leaves = new GeoBuf();
    const platforms = [];
    const o = V3();
    const side = V3();
    let i = 0;
    for (let yy = 2.5; yy < height - 0.5; yy += leafSpacing * (0.75 + rnd() * 0.5), i++) {
        const t = yy / height;
        const az = i * 2.399 + rnd() * 0.5;
        o.set(Math.cos(az), 0, Math.sin(az));
        side.set(-o.z, 0, o.x);
        const tp = taper(t);
        const start = axisAt(t).addScaledVector(o, radius * tp * 0.8);
        const L = leafSize * (0.7 + rnd() * 0.6) * lerp(1, 0.6, t);
        const pet = L * 0.55;
        const mid = start.clone().addScaledVector(o, pet * 0.5).setY(start.y + pet * 0.42);
        const end = start.clone().addScaledVector(o, pet).setY(start.y + pet * 0.5);
        addTube(wood, [start, mid, end], [0.09 * tp + 0.03, 0.06 * tp + 0.02, 0.035], { segs: 5, wind0: 0.2, wind1: 0.5, vTile: 1 });
        // lâmina: grade 5×3 dobrada em V na nervura e caindo na ponta
        const base = leaves.count;
        const nu = 5;
        const W = L * 0.85;
        const tint = leafTint(rnd, 0.1);
        for (let a = 0; a <= nu; a++) {
            const u = a / nu;
            for (let bb = -1; bb <= 1; bb++) {
                const px = end.x + o.x * u * L + side.x * bb * W * 0.5;
                const pz = end.z + o.z * u * L + side.z * bb * W * 0.5;
                const py = end.y + Math.abs(bb) * W * 0.16 - u * u * L * 0.32 + u * L * 0.08;
                leaves.pos.push(px, py, pz);
                leaves.nor.push(o.x * 0.25 - side.x * bb * 0.3, 0.9, o.z * 0.25 - side.z * bb * 0.3);
                leaves.uv.push(u, bb * 0.5 + 0.5);
                leaves.wind.push(0.3 + u * 0.5);
                const ao = 0.7 + 0.3 * u;
                leaves.col.push(tint[0] * ao, tint[1] * ao, tint[2] * ao);
            }
        }
        for (let a = 0; a < nu; a++) {
            const q = base + a * 3;
            leaves.idx.push(q, q + 1, q + 3, q + 1, q + 4, q + 3, q + 1, q + 2, q + 4, q + 2, q + 5, q + 4);
        }
        platforms.push({ position: V3(x + end.x + o.x * L * 0.45, y + end.y - L * 0.02, z + end.z + o.z * L * 0.45), radius: W * 0.42 });
        // gavinha em mola a cada três folhas
        if (i % 3 === 1 && detail > 0) {
            const pts = [];
            const rad = [];
            const a0 = az + 1.3;
            for (let s = 0; s <= 22; s++) {
                const u = s / 22;
                const rr = 0.12 + u * 0.22;
                pts.push(V3(
                    start.x + Math.cos(a0) * (0.3 + u * 1.6) + Math.cos(u * 21) * rr * side.x,
                    start.y + 0.2 + Math.sin(u * 21) * rr + u * 0.5,
                    start.z + Math.sin(a0) * (0.3 + u * 1.6) + Math.cos(u * 21) * rr * side.z
                ));
                rad.push(0.03 * (1 - u * 0.75));
            }
            addTube(wood, pts, rad, { segs: 4, wind0: 0.3, wind1: 0.9, vTile: 1 });
        }
    }
    const stemMat = cached('beanStem', () => treeShader(Object.assign(pbrMaterial('bark_brown_02', { color: 0xa9d86a, normalScale: 0.8, roughness: 0.85 }), { name: 'gfxBeanStem' })));
    const P = { leaf: 'bean', leafColor: 0xffffff };
    const group = new THREE.Group();
    group.name = 'gfxBeanstalk';
    const stem = new THREE.Mesh(wood.build(false), stemMat);
    const leaf = new THREE.Mesh(leaves.build(true), leafMaterial(P));
    for (const m of [stem, leaf]) {
        m.castShadow = true;
        m.receiveShadow = true;
        group.add(m);
    }
    group.position.set(x, y, z);
    return {
        object: group,
        height,
        leaves: platforms,
        axisAt: (t, out = V3()) => axisAt(clamp(t, 0, 1), out).add(group.position),
        pointAt(t, out = V3()) {
            const tt = clamp(t, 0, 1);
            strand(0, tt, out);
            const th = theta(0, tt);
            const r = radius * 0.55 * taper(tt);
            out.x += Math.cos(th) * r;
            out.z += Math.sin(th) * r;
            return out.add(group.position);
        },
        normalAt(t, out = V3()) {
            const th = theta(0, clamp(t, 0, 1));
            return out.set(Math.cos(th), 0, Math.sin(th));
        },
        dispose() {
            stem.geometry.dispose();
            leaf.geometry.dispose();
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Dispersão
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Espalha pontos sobre o terreno por amostragem de Poisson (dardos com grade de
 * rejeição), determinística pela `seed`.
 *
 * @param {object} o
 * @param {object} o.terrain
 * @param {number} [o.count]      alvo de pontos (pode devolver menos se não couber)
 * @param {{minX,maxX,minZ,maxZ}|{x,z,radius}} [o.area]  padrão: o terreno com 2 % de margem
 * @param {(x,z,h,slope)=>number} [o.maskFn]  probabilidade 0..1
 * @param {number} [o.minDist]    distância mínima entre pontos (m)
 * @param {number} [o.slopeMax]   rejeita acima dessa inclinação (1 − normal.y)
 * @param {number} [o.heightMin] [o.heightMax]
 * @param {boolean} [o.dry]       rejeita água/margem úmida da máscara (padrão true)
 * @param {number} [o.layerMax]   rejeita onde alguma camada pintada 1..3 passa disso (ex.: 0.4 mantém fora de caminhos); padrão 1 = ignora
 * @param {Array<{dist:Function}>} [o.keepOff]  traçados a evitar, com `margin` metros
 * @param {[number,number]} [o.scale]  faixa de escala por ponto
 * @param {boolean} [o.align]     guarda a normal do terreno (nx, ny, nz) para alinhar o objeto
 * @returns {Array<{x,y,z, ry,rot, s,scale, nx,ny,nz}>}  serve em instanceModel/instanceKit/createForest/scatterModel
 */
export function scatter({
    terrain, count = 100, area, maskFn, minDist = 2, seed = 1, slopeMax = 0.4, heightMin = -Infinity, heightMax = Infinity,
    dry = true, layerMax = 1, keepOff = [], margin = 1.5, scale = [0.8, 1.25], align = false, tries = 40
} = {}) {
    const rnd = seeded(seed * 9973 + 11);
    const tb = terrain.bounds;
    const mx = (tb.maxX - tb.minX) * 0.02;
    const mz = (tb.maxZ - tb.minZ) * 0.02;
    const circle = area && area.radius != null;
    const b = circle
        ? { minX: area.x - area.radius, maxX: area.x + area.radius, minZ: area.z - area.radius, maxZ: area.z + area.radius }
        : area || { minX: tb.minX + mx, maxX: tb.maxX - mx, minZ: tb.minZ + mz, maxZ: tb.maxZ - mz };
    const cell = Math.max(0.25, minDist);
    const grid = new Map();
    const out = [];
    const w5 = [0, 0, 0, 0, 0];
    const n = V3();
    const md2 = minDist * minDist;
    for (let t = 0; t < count * tries && out.length < count; t++) {
        const x = lerp(b.minX, b.maxX, rnd());
        const z = lerp(b.minZ, b.maxZ, rnd());
        const r1 = rnd();
        const r2 = rnd();
        const r3 = rnd();
        if (circle && Math.hypot(x - area.x, z - area.z) > area.radius) continue;
        if (x < tb.minX || x > tb.maxX || z < tb.minZ || z > tb.maxZ) continue;
        const h = terrain.heightAt(x, z);
        if (h < heightMin || h > heightMax) continue;
        terrain.normalAt(x, z, n);
        const slope = 1 - n.y;
        if (slope > slopeMax) continue;
        if (dry || layerMax < 1) {
            terrain.weightsAt(x, z, w5);
            if (dry && w5[4] > 0.25) continue;
            if (layerMax < 1 && Math.max(w5[1], w5[2], w5[3]) > layerMax) continue;
        }
        if (maskFn && r1 > maskFn(x, z, h, slope)) continue;
        let ok = true;
        for (const c of keepOff) {
            if (c.dist(x, z, (c.width || 0) * 0.5 + margin) < (c.width || 0) * 0.5 + margin) {
                ok = false;
                break;
            }
        }
        if (!ok) continue;
        const gx = Math.floor(x / cell);
        const gz = Math.floor(z / cell);
        for (let dz = -1; dz <= 1 && ok; dz++) {
            for (let dx = -1; dx <= 1 && ok; dx++) {
                const list = grid.get((gx + dx) * 73856093 + (gz + dz) * 19349663);
                if (!list) continue;
                for (const p of list) {
                    if ((p.x - x) * (p.x - x) + (p.z - z) * (p.z - z) < md2) {
                        ok = false;
                        break;
                    }
                }
            }
        }
        if (!ok) continue;
        const s = lerp(scale[0], scale[1], r2);
        const ry = r3 * TAU;
        const p = { x, y: h, z, ry, rot: ry, s, scale: s, nx: align ? n.x : 0, ny: align ? n.y : 1, nz: align ? n.z : 0 };
        const key = gx * 73856093 + gz * 19349663;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(p);
        out.push(p);
    }
    return out;
}

/**
 * Simplificação por agrupamento de vértices: os vértices de cada célula de uma
 * grade (lado = maior dimensão / `cells`) viram um só (média de posição, normal
 * e UV); triângulos que colapsam somem. A chave inclui a ilha de UV (1/8) para
 * não misturar costuras.
 */
function clusterDecimate(geo, cells) {
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const size = bb.getSize(V3());
    const cs = Math.max(size.x, size.y, size.z) / cells || 1;
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    const index = geo.index;
    const map = new Map();
    const remap = new Uint32Array(pos.count);
    const acc = [];
    for (let i = 0; i < pos.count; i++) {
        const kx = Math.floor((pos.getX(i) - bb.min.x) / cs);
        const ky = Math.floor((pos.getY(i) - bb.min.y) / cs);
        const kz = Math.floor((pos.getZ(i) - bb.min.z) / cs);
        const ku = uv ? Math.floor(uv.getX(i) * 8) + Math.floor(uv.getY(i) * 8) * 16 : 0;
        const key = ((kx * 1031 + ky) * 1031 + kz) * 257 + ku;
        let id = map.get(key);
        if (id === undefined) {
            id = acc.length / 9;
            map.set(key, id);
            acc.push(0, 0, 0, 0, 0, 0, 0, 0, 0);
        }
        const o = id * 9;
        acc[o] += pos.getX(i);
        acc[o + 1] += pos.getY(i);
        acc[o + 2] += pos.getZ(i);
        if (nor) {
            acc[o + 3] += nor.getX(i);
            acc[o + 4] += nor.getY(i);
            acc[o + 5] += nor.getZ(i);
        }
        if (uv) {
            acc[o + 6] += uv.getX(i);
            acc[o + 7] += uv.getY(i);
        }
        acc[o + 8]++;
        remap[i] = id;
    }
    const nv = acc.length / 9;
    const P = new Float32Array(nv * 3);
    const N = new Float32Array(nv * 3);
    const U = new Float32Array(nv * 2);
    for (let i = 0; i < nv; i++) {
        const o = i * 9;
        const k = 1 / acc[o + 8];
        P[i * 3] = acc[o] * k;
        P[i * 3 + 1] = acc[o + 1] * k;
        P[i * 3 + 2] = acc[o + 2] * k;
        const l = Math.hypot(acc[o + 3], acc[o + 4], acc[o + 5]) || 1;
        N[i * 3] = acc[o + 3] / l;
        N[i * 3 + 1] = acc[o + 4] / l;
        N[i * 3 + 2] = acc[o + 5] / l;
        U[i * 2] = acc[o + 6] * k;
        U[i * 2 + 1] = acc[o + 7] * k;
    }
    const idx = [];
    const tri = index ? index.count : pos.count;
    for (let i = 0; i < tri; i += 3) {
        const a = remap[index ? index.getX(i) : i];
        const b = remap[index ? index.getX(i + 1) : i + 1];
        const c = remap[index ? index.getX(i + 2) : i + 2];
        if (a !== b && b !== c && a !== c) idx.push(a, b, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    if (uv) g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    g.setIndex(idx);
    return g;
}

const decimated = new Map();
function limitTriangles(geo, maxTris, key) {
    const tris = (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
    if (!maxTris || tris <= maxTris * 1.15) return geo;
    const ck = `${key}:${maxTris}`;
    if (!decimated.has(ck)) {
        // triângulos ∝ células²: parte de uma estimativa e corrige uma vez
        let cells = Math.max(6, Math.round(Math.sqrt(maxTris / 2.2)));
        let g = clusterDecimate(geo, cells);
        for (let i = 0; i < 2; i++) {
            const got = g.index.count / 3;
            if (got > maxTris * 0.7 && got < maxTris * 1.25) break;
            cells = Math.max(4, Math.round(cells * Math.sqrt(maxTris / Math.max(1, got))));
            g = clusterDecimate(geo, cells);
        }
        decimated.set(ck, g);
    }
    return decimated.get(ck);
}

/**
 * Conjuntos prontos para `scatterModel`. Os modelos fotogramétricos estão em
 * escala real, então `scale` é um multiplicador do tamanho nativo (sorteado por
 * ponto); `sink` é a fração da altura enterrada; `range` é a distância de corte.
 */
export const SCATTER_PRESETS = {
    rochas: { model: 'rock_moss_set_01', scale: [0.35, 1.1], sink: 0.24, align: true, minDist: 4, slopeMax: 0.5, range: 260 },
    pedras: { model: 'rock_07', scale: [1.4, 3.6], sink: 0.2, align: true, minDist: 2.5, slopeMax: 0.5, range: 110 },
    pedregulhos: { model: 'rock_09', height: [0.5, 1.3], scale: [1, 1], sink: 0.2, align: true, minDist: 5, slopeMax: 0.5, range: 220 },
    paredao: { model: 'rock_face_01', scale: [0.8, 1.6], sink: 0.1, align: false, minDist: 9, slopeMax: 0.7, range: 400 },
    samambaias: { model: 'fern_02', scale: [0.9, 1.7], sink: 0.05, align: true, minDist: 1.1, shadow: false, range: 70 },
    arbustos: { model: 'shrub_03', scale: [1.3, 2.3], sink: 0.03, align: false, minDist: 1.6, range: 110 },
    ervas: { model: 'weed_plant_02', scale: [1.2, 2.4], sink: 0.04, align: true, minDist: 0.8, shadow: false, range: 45 },
    flores: { model: 'flower_empodium', scale: [1, 1.7], sink: 0.02, align: false, minDist: 0.6, shadow: false, range: 45 },
    tocos: { model: 'tree_stump_01', scale: [0.7, 1.2], sink: 0.16, align: true, minDist: 8, range: 200 }
};

/**
 * Instancia um modelo fotogramétrico de assets.js sobre o terreno. Conjuntos com
 * várias peças lado a lado (rock_moss_set_01, fern_02, shrub_03…) são separados:
 * cada peça vira uma variante, centrada na própria base, e os pontos são
 * sorteados entre elas. Cada variante tem 2 LODs (malha limitada a
 * `maxTriangles` perto; versão simplificada longe) e descarte por
 * distância/frustum, atualizados por `terrain.update(camera)`.
 *
 * @param {object} o
 * @param {object} o.terrain
 * @param {string} [o.preset]   chave de SCATTER_PRESETS — ou informe `model` e o resto à mão
 * @param {string} [o.model]
 * @param {Array} [o.placements] de `scatter`; se ausente, as demais opções (count, area, maskFn, keepOff…) vão para `scatter`
 * @param {[number,number]} [o.scale]            multiplicador do tamanho nativo
 * @param {number|[number,number]} [o.height]    em vez de `scale`: normaliza a altura de cada peça (m)
 * @param {number} [o.sink]     fração da altura enterrada   [o.align] alinha o eixo Y à normal do terreno
 * @param {number} [o.maxTriangles]  teto por variante perto (padrão por tier: 9000 / 5000 / 1400)
 * @param {number} [o.lodDistance]   troca para a malha simplificada (padrão 26 m; 14 m no tier low)
 * @param {number} [o.range]    distância de corte (m)       [o.shadow]
 * @returns {Promise<THREE.Group|null>}  group.userData = { placements, update(camera) }
 */
export async function scatterModel({ terrain, preset, placements, tier, maxTriangles, lodDistance, seed = 1, ...rest } = {}) {
    const o = { sink: 0.08, align: false, shadow: true, range: 200, ...(SCATTER_PRESETS[preset] || {}), ...rest };
    const tn = tierName(tier ?? terrain.tier);
    const maxTris = maxTriangles ?? TERRAIN_TIERS[tn].modelTris;
    const lod = lodDistance ?? (tn === 'low' ? 14 : 26);
    const list = placements || scatter({ terrain, seed, ...o });
    const root = await loadModel(o.model, { ground: false });
    if (!root || !list.length) return null;
    root.updateMatrixWorld(true);
    const rnd = seeded(seed * 577 + 3);
    const variants = [];
    root.traverse((m) => {
        if (!m.isMesh) return;
        const local = m.matrixWorld.clone().setPosition(0, 0, 0);
        m.geometry.computeBoundingBox();
        const box = m.geometry.boundingBox.clone().applyMatrix4(local);
        const size = box.getSize(V3());
        const c = box.getCenter(V3());
        // base: centro em XZ e base em y = 0, no tamanho nativo
        const base = new THREE.Matrix4().makeTranslation(-c.x, -box.min.y, -c.z).multiply(local);
        variants.push({ mesh: m, base, size, items: [] });
    });
    for (const p of list) variants[Math.floor(rnd() * variants.length) % variants.length].items.push(p);
    const group = new THREE.Group();
    group.name = `gfxScatter:${o.model}`;
    const hr = o.height == null ? null : Array.isArray(o.height) ? o.height : [o.height, o.height];
    const yaw = new THREE.Quaternion();
    const tiltQ = new THREE.Quaternion();
    const sets = [];
    variants.forEach((v, vi) => {
        const n = v.items.length;
        if (!n) return;
        const mats = new Float32Array(n * 16);
        const cx = new Float32Array(n);
        const cy = new Float32Array(n);
        const cz = new Float32Array(n);
        const cr = new Float32Array(n);
        v.items.forEach((p, i) => {
            const k = (hr ? lerp(hr[0], hr[1], rnd()) / (v.size.y || 1) : 1) * (p.s ?? 1);
            const h = v.size.y * k;
            yaw.setFromAxisAngle(UP, p.ry ?? 0);
            if (o.align && p.ny !== undefined) {
                tiltQ.setFromUnitVectors(UP, _v.set(p.nx, p.ny, p.nz));
                _q.multiplyQuaternions(tiltQ, yaw);
            } else {
                _q.copy(yaw);
            }
            const y = (p.y ?? terrain.heightAt(p.x, p.z)) - h * o.sink;
            _m4.compose(_v.set(p.x, y, p.z), _q, _s.setScalar(k)).multiply(v.base);
            _m4.toArray(mats, i * 16);
            cx[i] = p.x;
            cy[i] = y + h * 0.5;
            cz[i] = p.z;
            cr[i] = Math.max(v.size.x, v.size.y, v.size.z) * k * 0.75;
        });
        const mk = (geo) => {
            const inst = new THREE.InstancedMesh(geo, v.mesh.material, n);
            inst.castShadow = o.shadow;
            inst.receiveShadow = true;
            inst.frustumCulled = false;
            inst.count = 0;
            group.add(inst);
            return inst;
        };
        const gNear = limitTriangles(v.mesh.geometry, maxTris, `${o.model}:${vi}`);
        const nearTris = gNear.index ? gNear.index.count / 3 : gNear.attributes.position.count / 3;
        const farTris = Math.max(250, Math.round(maxTris / 12));
        const far = nearTris > farTris * 2.5 ? mk(limitTriangles(v.mesh.geometry, farTris, `${o.model}:${vi}`)) : null;
        sets.push(createLodSet({ n, mats, cx, cy, cz, cr, near: [mk(gNear)], far, lod, maxDistance: o.range, keep: 25 }));
    });
    const camState = cameraState();
    const update = (camera) => {
        if (!cameraMoved(camera, camState)) return;
        const p = camera.position;
        for (const s of sets) s.assign(p.x, p.y, p.z, _frustum);
    };
    group.userData.placements = list;
    group.userData.update = update;
    terrain.onUpdate?.(update);
    return group;
}

// ═══════════════════════════════════════════════════════════════════════════
// Água interior
// ═══════════════════════════════════════════════════════════════════════════

/** Normal de ondulação tileável (RG = normal.xy, B = normal.z, A = altura). */
function waterTexture() {
    return cached('waterN', () => {
        const S = 256;
        const h = new Float32Array(S * S);
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const u = (x / S) * 8;
                const v = (y / S) * 8;
                h[y * S + x] = fbm2(u, v, 4, 8, 3) * 0.7 + (1 - Math.abs(fbm2(u * 2, v * 2, 3, 16, 9) * 2 - 1)) * 0.3;
            }
        }
        const d = new Uint8Array(S * S * 4);
        for (let y = 0; y < S; y++) {
            for (let x = 0; x < S; x++) {
                const l = h[y * S + ((x + S - 1) % S)];
                const r = h[y * S + ((x + 1) % S)];
                const dn = h[((y + S - 1) % S) * S + x];
                const up = h[((y + 1) % S) * S + x];
                _v.set((l - r) * 9, (dn - up) * 9, 1).normalize();
                const o = (y * S + x) * 4;
                d[o] = (_v.x * 0.5 + 0.5) * 255;
                d[o + 1] = (_v.y * 0.5 + 0.5) * 255;
                d[o + 2] = (_v.z * 0.5 + 0.5) * 255;
                d[o + 3] = clamp(h[y * S + x], 0, 1) * 255;
            }
        }
        const t = new THREE.DataTexture(d, S, S, THREE.RGBAFormat);
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.magFilter = THREE.LinearFilter;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        t.anisotropy = 4;
        t.needsUpdate = true;
        return t;
    });
}

/**
 * Lago ou rio sobre o terreno.
 *
 *   lago: plano em `level`; a margem nasce da interseção com o relevo (use
 *         carveBasin no heightFn). level padrão = fundo no centro + depth.
 *   rio:  faixa ao longo de um traçado (createCourse); o nível em cada ponto é
 *         leito + depth, forçado a nunca subir rio abaixo e suavizado. Use
 *         course.carve no heightFn para abrir o leito.
 *
 * Sombreamento (MeshStandardMaterial transparente; reflexo = IBL do céu):
 *   cor      = mix(raso, fundo, 1 − e^(−prof·absorb))
 *   alfa     = mix(smoothstep(0, 0,12, prof)·mix(0,3, 0,97, k), 1, fresnel·0,9)   fresnel = (1 − n·v)⁴
 *   espuma   = margem: 1 − smoothstep(0, foam, prof + ruído); corredeira: fluxo·ruído
 *   ondas    = duas normais em escalas 0,083 e 0,27 /m, a 2ª 1,35× mais rápida; no rio rolam com o fluxo
 *   reflexo  = IBL × mix(0,3, 1, smoothstep(0,15, 2,2, prof)): no raso vê-se o fundo, não o céu
 * A profundidade vai por vértice (nível − terreno), então a malha é densa só o
 * bastante para a margem (≈ 0,6–1 m).
 *
 * @param {object} o
 * @param {object} o.terrain
 * @param {{x:number, z:number, radius:number, level?:number}} [o.lake]
 * @param {object} [o.river]      traçado de createCourse (ordem dos pontos = rio abaixo)
 * @param {number} [o.width]      largura do rio (padrão course.width)
 * @param {number} [o.depth]      lâmina d'água sobre o leito/fundo (m)
 * @param {number} [o.shallow] [o.deep]  cores      [o.absorb] 1/m   [o.foam] largura da espuma (m de profundidade)
 * @param {number} [o.ripple]     força da ondulação  [o.flow] velocidade do rio (m/s)
 * @param {number} [o.bank] [o.bankHeight]  cor do reflexo falso das margens e até que elevação do raio refletido ele vale (0 desliga)
 * @param {boolean} [o.paint]     pinta margem úmida + camada `shoreLayer` no terreno (padrão true)
 * @returns {{ object, material, levelAt(x, z), update(dt), dispose() }}
 */
export function createWater({
    terrain, lake = null, river = null, width, depth = 0.8, shallow = 0x4f6b4a, deep = 0x0e2a2a, absorb = 1.1, foam = 0.16,
    ripple = 0.16, flow = 0.9, bank = 0x2a3a1a, bankHeight = 0.2, paint = true, shoreLayer = 3, tier
} = {}) {
    const tn = tierName(tier ?? terrain.tier);
    const bankColor = new THREE.Color(bank);
    const pos = [];
    const uv = [];
    const dep = [];
    const flw = [];
    const idx = [];
    let levelAt;
    let region;
    let inside;

    if (river) {
        const w = width ?? river.width;
        const hw = w * 0.5 * 1.6;
        const n = river.count;
        const prof = new Float32Array(n);
        for (let i = 0; i < n; i++) prof[i] = terrain.heightAt(river.xs[i], river.zs[i]) + depth;
        for (let i = 1; i < n; i++) prof[i] = Math.min(prof[i], prof[i - 1]);
        for (let pass = 0; pass < 3; pass++) {
            for (let i = 1; i < n - 1; i++) prof[i] = (prof[i - 1] + prof[i] * 2 + prof[i + 1]) / 4;
        }
        const M = tn === 'low' ? 6 : 10;
        let along = 0;
        for (let i = 0; i < n; i++) {
            const i0 = Math.max(0, i - 1);
            const i1 = Math.min(n - 1, i + 1);
            let tx = river.xs[i1] - river.xs[i0];
            let tz = river.zs[i1] - river.zs[i0];
            const l = Math.hypot(tx, tz) || 1;
            tx /= l;
            tz /= l;
            if (i > 0) along += Math.hypot(river.xs[i] - river.xs[i - 1], river.zs[i] - river.zs[i - 1]);
            for (let j = 0; j <= M; j++) {
                const a = lerp(-hw, hw, j / M);
                // través = (tz, −tx): mesmo eixo usado no shader para a normal
                const x = river.xs[i] + tz * a;
                const z = river.zs[i] - tx * a;
                pos.push(x, prof[i], z);
                uv.push(a, along);
                dep.push(prof[i] - terrain.heightAt(x, z));
                flw.push(tx, tz);
            }
        }
        const row = M + 1;
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < M; j++) {
                const a = i * row + j;
                if (Math.max(dep[a], dep[a + 1], dep[a + row], dep[a + row + 1]) < -0.2) continue;
                idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
            }
        }
        levelAt = (x, z) => {
            const s = river.sample(x, z);
            const f = s.t * (n - 1);
            const i = Math.min(n - 2, Math.floor(f));
            return lerp(prof[i], prof[i + 1], f - i);
        };
        inside = (x, z) => river.dist(x, z, hw + 1) < hw + 1;
        region = river.bounds(hw + 2);
    } else {
        const { x: cx, z: cz, radius } = lake;
        const level = lake.level ?? terrain.heightAt(cx, cz) + depth;
        const R = radius * 1.3;
        const N = Math.min(tn === 'low' ? 56 : 128, Math.max(16, Math.round((2 * R) / (tn === 'low' ? 1.2 : 0.7))));
        for (let j = 0; j <= N; j++) {
            for (let i = 0; i <= N; i++) {
                const x = cx - R + (i / N) * 2 * R;
                const z = cz - R + (j / N) * 2 * R;
                pos.push(x, level, z);
                uv.push(x, z);
                dep.push(level - terrain.heightAt(x, z));
                flw.push(0, 0);
            }
        }
        const row = N + 1;
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const a = j * row + i;
                if (Math.max(dep[a], dep[a + 1], dep[a + row], dep[a + row + 1]) < -0.2) continue;
                idx.push(a, a + row, a + 1, a + 1, a + row, a + row + 1);
            }
        }
        levelAt = () => level;
        inside = (x, z) => Math.hypot(x - cx, z - cz) < R;
        region = { minX: cx - R, maxX: cx + R, minZ: cz - R, maxZ: cz + R };
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geometry.setAttribute('aDepth', new THREE.Float32BufferAttribute(dep, 1));
    geometry.setAttribute('aFlow', new THREE.Float32BufferAttribute(flw, 2));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(pos.length).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geometry.setIndex(idx);

    const uniforms = {
        uGfxTime: { value: 0 },
        uGfxWaterN: { value: waterTexture() },
        uGfxShallow: { value: new THREE.Color(shallow) },
        uGfxDeep: { value: new THREE.Color(deep) },
        uGfxWater: { value: new THREE.Vector4(absorb, foam, ripple, flow) },
        uGfxBank: { value: new THREE.Vector4(bankColor.r, bankColor.g, bankColor.b, bankHeight) }
    };
    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.07, metalness: 0, transparent: true, envMapIntensity: 0.9, side: THREE.FrontSide
    });
    material.name = 'gfxWater';
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                attribute float aDepth;
                attribute vec2 aFlow;
                varying vec2 vGfxUv;
                varying float vGfxDepth;
                varying vec2 vGfxFlow;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                vGfxUv = uv;
                vGfxDepth = aDepth;
                vGfxFlow = aFlow;`);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>
                uniform float uGfxTime;
                uniform sampler2D uGfxWaterN;
                uniform vec3 uGfxShallow;
                uniform vec3 uGfxDeep;
                uniform vec4 uGfxWater;
                uniform vec4 uGfxBank;
                varying vec2 vGfxUv;
                varying float vGfxDepth;
                varying vec2 vGfxFlow;
                vec2 gfxWN;
                float gfxWAlpha;
                float gfxWFoam;`)
            .replace('#include <map_fragment>', /* glsl */ `
                {
                    float gSpd = length(vGfxFlow);
                    vec2 gScroll = vec2(0.0, -uGfxWater.w * gSpd * uGfxTime);
                    vec2 gDrift = vec2(0.021, 0.013) * uGfxTime;
                    vec3 gN1 = texture2D(uGfxWaterN, (vGfxUv + gScroll) * 0.083 + gDrift).xyz * 2.0 - 1.0;
                    vec3 gN2 = texture2D(uGfxWaterN, (vGfxUv + gScroll * 1.35) * 0.27 - gDrift * 1.7 + 0.37).xyz * 2.0 - 1.0;
                    // vista de cima a ondulação quase some (senão a água vira "concreto"); rasante, vale inteira
                    float gNdv = abs(dot(normalize(vViewPosition), normalize(vNormal)));
                    gfxWN = (gN1.xy + gN2.xy * 0.6) * uGfxWater.z * mix(1.0, 0.1, gNdv);
                    float gH = texture2D(uGfxWaterN, (vGfxUv + gScroll) * 0.31 + gDrift * 2.0).a;
                    float gH2 = texture2D(uGfxWaterN, (vGfxUv + gScroll * 1.2) * 1.1 - gDrift).a;
                    float gK = 1.0 - exp(-max(vGfxDepth, 0.0) * uGfxWater.x);
                    vec3 gCol = mix(uGfxShallow, uGfxDeep, gK);
                    float gShore = 1.0 - smoothstep(0.0, uGfxWater.y, vGfxDepth + (gH - 0.5) * uGfxWater.y * 0.9);
                    float gFoam = gShore * smoothstep(0.3, 0.6, gH2 + 0.2 * sin(uGfxTime * 1.3 + vGfxDepth * 20.0)) * mix(0.55, 1.0, min(gSpd, 1.0));
                    gFoam += gSpd * smoothstep(0.66, 0.84, gH * 0.6 + gH2 * 0.5) * 0.55 * (1.0 - gK * 0.6);
                    gFoam = clamp(gFoam, 0.0, 1.0);
                    gfxWFoam = gFoam;
                    diffuseColor.rgb = mix(gCol, vec3(0.9, 0.93, 0.92), gFoam);
                    gfxWAlpha = mix(smoothstep(0.0, 0.12, vGfxDepth) * mix(0.3, 0.97, gK), 1.0, gFoam * 0.85) * step(-0.02, vGfxDepth);
                }`)
            .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(roughness, 0.75, gfxWFoam);')
            .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
                {
                    // reflexo falso das margens: raios refletidos rasantes veem mata, não céu
                    vec3 gRw = (vec4(reflect(-geometryViewDir, normal), 0.0) * viewMatrix).xyz;
                    float gTree = smoothstep(uGfxBank.a, uGfxBank.a * 0.15, gRw.y);
                    vec3 gSky = reflectedLight.indirectSpecular;
                    gSky = mix(gSky, uGfxBank.rgb * dot(gSky, vec3(0.3333)) * 3.0, gTree * 0.85);
                    reflectedLight.indirectSpecular = gSky * mix(0.3, 1.0, smoothstep(0.15, 2.2, vGfxDepth)) * (1.0 - gfxWFoam);
                    // o "difuso" da água é a cor do volume: pouco sensível ao sol direto
                    reflectedLight.directDiffuse *= mix(0.45, 1.0, gfxWFoam);
                }`)
            .replace('#include <normal_fragment_maps>', /* glsl */ `
                {
                    float gSpd = length(vGfxFlow);
                    vec2 gAlong = gSpd > 0.01 ? vGfxFlow / gSpd : vec2(0.0, 1.0);
                    vec2 gAcross = gSpd > 0.01 ? vec2(gAlong.y, -gAlong.x) : vec2(1.0, 0.0);
                    vec2 gXZ = gAcross * gfxWN.x + gAlong * gfxWN.y;
                    normal = normalize((viewMatrix * vec4(gXZ.x, 1.0, gXZ.y, 0.0)).xyz);
                    float gFr = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 4.0);
                    diffuseColor.a = mix(gfxWAlpha, max(gfxWAlpha, step(-0.02, vGfxDepth)), gFr * 0.9);
                }`);
    };
    material.customProgramCacheKey = () => 'gfxWater';

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'gfxWater';
    mesh.receiveShadow = true;
    mesh.renderOrder = 2;

    if (paint && terrain.paint) {
        terrain.paint(region, (x, z, h, slope, w) => {
            if (!inside(x, z)) return w;
            const d = levelAt(x, z) - h;
            // úmido a partir de 45 cm acima da linha d'água; lama/seixos na faixa da margem e no fundo
            w[3] = Math.max(w[3], smoothstep(-0.45, 0.02, d));
            const shore = smoothstep(-0.3, 0.12, d) * 0.92;
            if (shoreLayer >= 1 && shoreLayer <= 3 && shore > 0) {
                for (let i = 0; i < 3; i++) w[i] *= 1 - shore;
                w[shoreLayer - 1] += shore;
            }
            return w;
        });
    }

    return {
        object: mesh,
        material,
        uniforms,
        levelAt,
        update(dt = 0.016) { uniforms.uGfxTime.value += dt; },
        dispose() {
            geometry.dispose();
            material.dispose();
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// Caminhos, cercas e muros
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Caminho/estrada de terra pintado na máscara de splat (sem malha extra: não
 * há z-fighting e o height-blend quebra a borda no relevo da textura).
 *   d' = d + (fbm − ½)·2·noise                    borda irregular
 *   k  = (1 − smoothstep(½w − 0,4·edge, ½w + 0,6·edge, d'))·strength
 *   trilhos (ruts): o miolo perde até 55 % — fica a faixa de grama entre as rodas
 *
 * @param {object} o
 * @param {object} o.terrain
 * @param {object} [o.course] ou [o.points]  traçado (createCourse) ou pontos [x, z]
 * @param {number} [o.width]  [o.layer] camada pintada (1–3; padrão 1 = terra)  [o.edge] [o.noise] [o.strength]
 * @param {boolean} [o.ruts]
 * @returns {{ course, mask(x, z) → 0..1 }}
 */
export function createPath({ terrain, course, points, width, layer = 1, edge = 0.7, noise = 0.55, strength = 1, ruts = false } = {}) {
    const c = course || createCourse(points, { width: width ?? 2.6 });
    const w = width ?? c.width;
    const reach = w * 0.5 + edge + noise + 0.5;
    const k = (x, z) => {
        const d = c.dist(x, z, reach);
        if (d === Infinity) return 0;
        const dn = d + (fbm2(x * 0.31 + 7, z * 0.31 + 3, 2) - 0.5) * 2 * noise;
        let v = (1 - smoothstep(w * 0.5 - edge * 0.4, w * 0.5 + edge * 0.6, dn)) * strength;
        if (ruts) v *= 1 - 0.55 * Math.exp(-((d / (w * 0.17)) ** 2)) * (0.4 + 0.6 * fbm2(x * 0.17, z * 0.17, 2));
        return v;
    };
    terrain.paint(c.bounds(reach), (x, z, h, slope, wt) => {
        const v = k(x, z);
        if (v <= 0) return wt;
        for (let i = 0; i < 3; i++) wt[i] *= 1 - v;
        wt[layer - 1] += v;
        return wt;
    });
    return { course: c, mask: k };
}

/**
 * Cerca de madeira ('cerca') ou muro de pedra seca ('muro') ao longo de um traçado.
 *   cerca: mourões tortos instanciados a cada `spacing` m + 2 varas por vão, com flecha e folga
 *   muro:  pedras irregulares instanciadas em `rows` fiadas desencontradas, com capeamento
 *
 * @param {object} o
 * @param {object} o.terrain
 * @param {object} [o.course] ou [o.points]
 * @param {'cerca'|'muro'} [o.type]  [o.height] m  [o.spacing] m  [o.seed]
 * @returns {THREE.Group}
 */
export function createFence({ terrain, course, points, type = 'cerca', height, spacing, seed = 1 } = {}) {
    const c = course || createCourse(points);
    const rnd = seeded(seed * 733 + 5);
    const group = new THREE.Group();
    group.name = `gfxFence:${type}`;
    const p = V3();
    const t = V3();
    if (type === 'muro') {
        const H = height ?? 0.95;
        const rows = Math.max(2, Math.round(H / 0.22));
        const rowH = H / rows;
        const stoneGeo = (s) => cached(`stone:${s}`, () => {
            const r = seeded(s * 31 + 7);
            const g = mergeVerticesSafe(new THREE.IcosahedronGeometry(1, 1));
            const pa = g.attributes.position;
            const ox = r() * 20;
            for (let i = 0; i < pa.count; i++) {
                _v.fromBufferAttribute(pa, i);
                const k = 0.72 + 0.5 * fbm2(_v.x * 1.3 + ox, _v.y * 1.3 + _v.z * 1.7 + ox, 2);
                _v.multiplyScalar(k);
                _v.y = Math.sign(_v.y) * Math.pow(Math.abs(_v.y), 0.8) * 0.82;
                pa.setXYZ(i, _v.x, _v.y, _v.z);
            }
            g.computeVertexNormals();
            return g;
        });
        const mat = cached('stoneMat', () => pbrMaterial('mossy_rock', { repeat: [2, 1], normalScale: 1.2 }));
        const lists = [[], [], []];
        const stoneL = spacing ?? 0.42;
        for (let r = 0; r < rows; r++) {
            const cap = r === rows - 1;
            const off = (r % 2) * 0.5 + rnd() * 0.2;
            const count = Math.ceil(c.length / stoneL);
            for (let i = 0; i < count; i++) {
                for (let side = -1; side <= 1; side += 2) {
                    if (cap && side > 0) continue;
                    const u = clamp((i + off + rnd() * 0.25) / count, 0, 1);
                    c.pointAt(u, p);
                    c.tangentAt(u, t);
                    const lat = cap ? (rnd() - 0.5) * 0.04 : side * (0.1 + rnd() * 0.03);
                    const x = p.x - t.z * lat;
                    const z = p.z + t.x * lat;
                    lists[Math.floor(rnd() * 3)].push({
                        x, y: terrain.heightAt(x, z) + (r + 0.5) * rowH - 0.03, z,
                        ry: Math.atan2(-t.z, t.x) + (rnd() - 0.5) * 0.5,
                        sx: stoneL * (cap ? 0.62 : 0.56) * (0.85 + rnd() * 0.35), sy: rowH * (cap ? 0.5 : 0.62) * (0.85 + rnd() * 0.3),
                        sz: (cap ? 0.24 : 0.15) * (0.85 + rnd() * 0.35), tilt: (rnd() - 0.5) * 0.3
                    });
                }
            }
        }
        const e = new THREE.Euler();
        lists.forEach((list, vi) => {
            if (!list.length) return;
            const inst = new THREE.InstancedMesh(stoneGeo(vi + 1), mat, list.length);
            list.forEach((s, i) => {
                e.set(s.tilt, s.ry, s.tilt * 0.6);
                _m4.compose(_v.set(s.x, s.y, s.z), _q.setFromEuler(e), _s.set(s.sx, s.sy, s.sz));
                inst.setMatrixAt(i, _m4);
            });
            inst.castShadow = inst.receiveShadow = true;
            inst.computeBoundingSphere();
            group.add(inst);
        });
        return group;
    }

    const H = height ?? 1.15;
    const gap = spacing ?? 2.3;
    const n = Math.max(2, Math.round(c.length / gap) + 1);
    const posts = [];
    for (let i = 0; i < n; i++) {
        c.pointAt(i / (n - 1), p);
        posts.push({ x: p.x, z: p.z, y: terrain.heightAt(p.x, p.z), h: H * (0.94 + rnd() * 0.14), ry: rnd() * TAU, tx: (rnd() - 0.5) * 0.09, tz: (rnd() - 0.5) * 0.09 });
    }
    const postBuf = new GeoBuf();
    addTube(postBuf, [V3(0, -0.3, 0), V3(0.012, 0.3, 0.008), V3(-0.01, 0.75, -0.006), V3(0.004, 1, 0), V3(0.004, 1.02, 0)], [0.085, 0.078, 0.07, 0.066, 0.012], { segs: 7, vTile: 0.6 });
    const mat = cached('fenceMat', () => {
        const m = pbrMaterial('bark_brown_02', { color: 0xb9ab98, normalScale: 1.2 });
        m.color.multiplyScalar(1.9);
        return m;
    });
    const inst = new THREE.InstancedMesh(postBuf.build(false), mat, n);
    const e = new THREE.Euler();
    posts.forEach((q, i) => {
        e.set(q.tx, q.ry, q.tz);
        _m4.compose(_v.set(q.x, q.y, q.z), _q.setFromEuler(e), _s.set(1, q.h, 1));
        inst.setMatrixAt(i, _m4);
    });
    inst.castShadow = inst.receiveShadow = true;
    inst.computeBoundingSphere();
    group.add(inst);
    const rails = new GeoBuf();
    for (let i = 0; i < n - 1; i++) {
        const a = posts[i];
        const b = posts[i + 1];
        for (const f of [0.42, 0.84]) {
            const ya = a.y + a.h * f + (rnd() - 0.5) * 0.06;
            const yb = b.y + b.h * f + (rnd() - 0.5) * 0.06;
            const off = (rnd() < 0.5 ? -1 : 1) * 0.06;
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const l = Math.hypot(dx, dz) || 1;
            const ox = (-dz / l) * off;
            const oz = (dx / l) * off;
            const pts = [];
            for (let s = 0; s <= 4; s++) {
                const u = lerp(-0.07, 1.07, s / 4);
                pts.push(V3(a.x + dx * u + ox, lerp(ya, yb, u) - Math.sin(clamp(u, 0, 1) * Math.PI) * 0.035, a.z + dz * u + oz));
            }
            const r0 = 0.036 + rnd() * 0.012;
            addTube(rails, pts, [r0 * 0.7, r0, r0 * 1.05, r0, r0 * 0.75], { segs: 5, vTile: 0.6 });
        }
    }
    const railMesh = new THREE.Mesh(rails.build(false), mat);
    railMesh.castShadow = railMesh.receiveShadow = true;
    group.add(railMesh);
    return group;
}

function mergeVerticesSafe(geo) {
    // IcosahedronGeometry não é indexada: solda os vértices para a normal sair lisa
    const pos = geo.attributes.position;
    const map = new Map();
    const P = [];
    const U = [];
    const idx = [];
    for (let i = 0; i < pos.count; i++) {
        const key = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getY(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`;
        let id = map.get(key);
        if (id === undefined) {
            id = P.length / 3;
            map.set(key, id);
            P.push(pos.getX(i), pos.getY(i), pos.getZ(i));
            U.push(geo.attributes.uv.getX(i), geo.attributes.uv.getY(i));
        }
        idx.push(id);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(idx);
    return g;
}
