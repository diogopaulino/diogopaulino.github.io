/**
 * gfx/creature — animais e dinossauros procedurais com esqueleto (three.js r185).
 *
 * Tudo é gerado em código: nenhuma malha externa. Cada criatura é UMA SkinnedMesh
 * (corpo, membros, dentes, garras, chifres, asas) + UMA Mesh de olhos = 2 draw calls.
 *
 * ── Técnica ────────────────────────────────────────────────────────────────────
 * • Eixo axial único (ponta da cauda → pelve → tórax → pescoço → crânio → focinho):
 *   estações [z, y, meia-largura, raio dorsal, raio ventral, n] interpoladas por
 *   Hermite não uniforme e "torneadas" em anéis superelípticos
 *   |x/a|^n + |y/b|^n = 1 perpendiculares à curva. Pesos de skin de 2 ossos por
 *   comprimento de arco: 50/50 em cada junta, suavizado ±40 % do segmento.
 * • Boca de verdade: do canto da boca para a frente o anel do crânio é cortado na
 *   linha da boca (palato) e a mandíbula é um loft próprio em "D" preso ao osso
 *   `jaw`; dentes, língua e narinas são geometria.
 * • Membros: polilinha de 5 juntas (ombro/quadril, cotovelo/joelho, punho/jarrete,
 *   boleto/metatarso-falângica, ponta do dedo) → 4 ossos. Pés: pata com dedos e
 *   garras, casco (inteiro ou fendido), pé de terópode/ave (3 dedos + hálux),
 *   pé colunar com unhas, mão.
 * • Textura: albedo de padrão (listras, malhas, pintas, manchas) em UV0 (u ao redor,
 *   v ao longo), e detalhe ladrilhado em UV1 (normal + AO/rugosidade/albedo fino):
 *   pelo, pelo curto, lã, escamas (Voronoi F2−F1), couro enrugado, penas, pele.
 *   Cor por vértice faz contra-sombreamento, meias, focinho, ponta da cauda, sujeira.
 * • Animação procedural sem clipes e sem alocação por quadro: o tronco é FK e as
 *   pernas são IK analítico de 2 ossos + metatarso, então o pé pisa onde o ciclo
 *   manda (e em `groundFn`, se houver). Troca de modo = crossfade de 0,35 s a partir
 *   da pose congelada.
 *
 * ── Convenções ─────────────────────────────────────────────────────────────────
 * Frente = +Z, cima = +Y, esquerda = +X. Pés em y = 0. Medidas em metros (adulto).
 * A origem fica no chão, no meio dos apoios.
 *
 * ── Andaduras (fase φ ∈ [0, 2π) = 1 passada; D = fração de apoio) ──────────────
 *   passo de quadrúpede (sequência lateral): TE 0 · DE ¼ · TD ½ · DD ¾, D = 0,64
 *   trote (diagonais): DE+TD 0 · DD+TE ½, D = 0,46
 *   galope transverso (ungulados): TE 0 · TD 0,12 · DE 0,45 · DD 0,57, D = 0,3
 *   galope rotatório (carnívoros): TE 0 · TD 0,1 · DD 0,5 · DE 0,6
 *   salto (coelho/esquilo): traseiras juntas, dianteiras juntas, ½ ciclo depois
 *   bípede: E 0 · D ½ (D = 0,62 andando, 0,36 correndo); cauda contrabalança
 *   Apoio: pé recua S·(½ − s); balanço: avança com easing e sobe h·sin(πs).
 *   Período natural T = k·√(L/g) (L = altura do quadril; k = 2,95 passo, 1,85 trote,
 *   1,2 galope) → velocidade natural v = S/(D·T), exposta em `gaits[modo].speed`.
 *
 * ── API ────────────────────────────────────────────────────────────────────────
 *   createCreature(preset | spec, opts) → Creature
 *     preset: nome em CREATURES (ver CREATURE_NAMES) ou um spec completo
 *     opts: {
 *       scale = 1,        multiplicador de tamanho
 *       age = 1,          0 filhote … 1 adulto (cabeça/olhos maiores, focinho e membros curtos)
 *       seed = 1,         variação individual (tom, tamanho ±3 %, padrão, ritmo)
 *       detail = 2,       0 multidão/longe · 1 médio · 2 herói
 *       colors = {},      sobrescreve chaves do `coat` (base, belly, back, socks, mane…)
 *       pattern = {},     sobrescreve `skin.pattern`
 *       saddle = false,   sela (presets com dorso de montaria)
 *       feathers = true,  velociraptor emplumado
 *       mods = {}         multiplicadores de proporção: leg, girth, neck, head, snout, tail, eye, ear
 *     }
 *   Creature = {
 *     object,            THREE.Group — posicione/gire este
 *     mesh, eyes,        SkinnedMesh do corpo e Mesh dos olhos
 *     bones,             { hips, spine, chest, neck1.., head, jaw, tail1.., earL/R, lidL/R,
 *                          thighL/R, shinL/R, footL/R, toeL/R, armL/R, foreL/R, handL/R, fingL/R,
 *                          wingL1..3, wingR1..3 }
 *     sockets,           Object3D presos a ossos: back (= saddle), head, mouth, tailTip
 *     length, height,    metros, já com escala (focinho–cauda; ponto mais alto em repouso)
 *     hipHeight, shoulderHeight, wingspan,
 *     gaits,             { walk|trot|run: { speed (m/s natural), stride, duty } }
 *     modes,             modos aceitos por esta criatura
 *     triangles,
 *     update(dt, { mode, speed, lookAt: Vector3 (mundo), groundFn(x, z) → y (mundo),
 *                  turn (−1…1, curva o corpo), jaw (0…1 força a boca), blink (0…1) }),
 *     dispose()
 *   }
 *   poseCreature(creature, mode, phase, { amount = 1, time, jaw, blink, lookYaw, lookPitch })
 *     pose determinística, sem mistura: `phase` em rad para andaduras/voo, em segundos
 *     para os demais modos.
 *   CREATURE_MODES: idle walk trot run eat drink sit sleep roar attack alert fly glide flap swim
 *
 * Culling: `mesh.boundingSphere` é fixada com folga (cobre qualquer pose) e o centro
 * acompanha o osso do quadril a cada update; sombras usam a mesma malha.
 */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};
const fract = (x) => x - Math.floor(x);
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const AX = v3(1, 0, 0);
const AY = v3(0, 1, 0);
const AZ = v3(0, 0, 1);

/** PRNG mulberry32. */
function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// ───────────────────────── ruído periódico (texturas) ─────────────────────────
function hash(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}
const wrap = (i, p) => ((i % p) + p) % p;
function vnoise(x, y, px, py, s) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const x0 = wrap(xi, px);
    const x1 = wrap(xi + 1, px);
    const y0 = wrap(yi, py);
    const y1 = wrap(yi + 1, py);
    const a = hash(x0, y0, s);
    const b = hash(x1, y0, s);
    const c = hash(x0, y1, s);
    const d = hash(x1, y1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** fBm tileável: u, v ∈ [0,1); px, py = células da oitava base. */
function fbm(u, v, px, py, oct, s) {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < oct; o++) {
        sum += amp * vnoise(u * px * f, v * py * f, px * f, py * f, s + o * 17);
        norm += amp;
        amp *= 0.5;
        f *= 2;
    }
    return sum / norm;
}
const _w = [0, 0, 0];
/** Worley tileável: devolve em _w [F1, F2, id da célula]. */
function worley(x, y, px, py, s) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let f1 = 9;
    let f2 = 9;
    let id = 0;
    for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
            const cx = xi + i;
            const cy = yi + j;
            const wx = wrap(cx, px);
            const wy = wrap(cy, py);
            const dx = cx + hash(wx, wy, s) - x;
            const dy = cy + hash(wx, wy, s + 7) - y;
            const d = dx * dx + dy * dy;
            if (d < f1) {
                f2 = f1;
                f1 = d;
                id = hash(wx, wy, s + 13);
            } else if (d < f2) f2 = d;
        }
    }
    _w[0] = Math.sqrt(f1);
    _w[1] = Math.sqrt(f2);
    _w[2] = id;
    return _w;
}

// ───────────────────────────── texturas (cache) ──────────────────────────────
const texCache = new Map();
function makeCanvasTexture(n, m, fill, srgb) {
    const cv = document.createElement('canvas');
    cv.width = n;
    cv.height = m;
    const ctx = cv.getContext('2d');
    const img = ctx.createImageData(n, m);
    fill(img.data, n, m);
    ctx.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 4;
    return t;
}

/**
 * Altura h(u,v) ∈ [0,1], modulação de albedo e rugosidade por tipo de pele.
 * u = ao redor do corpo, v = ao longo (pelos e penas correm ao longo de v).
 */
const DETAIL = {
    fur: { n: 256, strength: 1.7, f(u, v, o) {
        const a = fbm(u, v, 56, 5, 3, 11);
        const b = fbm(u, v, 110, 9, 2, 23);
        const cl = fbm(u, v, 7, 4, 3, 5);
        o.h = a * 0.6 + b * 0.4;
        o.alb = 0.5 + (o.h - 0.5) * 0.55 + (cl - 0.5) * 0.22;
        o.rough = 0.72 + o.h * 0.2;
    } },
    short: { n: 256, strength: 0.55, f(u, v, o) {
        const a = fbm(u, v, 120, 10, 3, 31);
        const cl = fbm(u, v, 5, 5, 3, 7);
        o.h = a;
        o.alb = 0.5 + (a - 0.5) * 0.16 + (cl - 0.5) * 0.14;
        o.rough = 0.5 + a * 0.2;
    } },
    wool: { n: 256, strength: 3.2, f(u, v, o) {
        const a = worley(u * 9, v * 9, 9, 9, 3)[0];
        const b = worley(u * 22, v * 22, 22, 22, 9)[0];
        o.h = clamp(1 - a * a * 1.3) * 0.65 + clamp(1 - b * 1.2) * 0.35;
        o.alb = 0.3 + o.h * 0.42;
        o.rough = 0.92;
    } },
    scales: { n: 512, strength: 3.0, f(u, v, o) {
        const w = worley(u * 26, v * 26, 26, 26, 4);
        const e = w[1] - w[0];
        const id = w[2];
        const big = fbm(u, v, 5, 5, 3, 8);
        o.h = sstep(0.02, 0.32, e) * (0.7 + 0.3 * id) + (big - 0.5) * 0.25;
        o.alb = 0.33 + 0.2 * sstep(0.03, 0.25, e) + (id - 0.5) * 0.16 + (big - 0.5) * 0.2;
        o.rough = 0.5 + 0.3 * (1 - sstep(0.02, 0.3, e));
    } },
    hide: { n: 512, strength: 2.6, f(u, v, o) {
        // rugas correm ao redor do corpo (longas em u) + seixos finos
        const r = 1 - Math.abs(fbm(u, v, 4, 18, 4, 6) * 2 - 1);
        const r2 = 1 - Math.abs(fbm(u, v, 9, 7, 3, 16) * 2 - 1);
        const w = worley(u * 46, v * 46, 46, 46, 2);
        const peb = sstep(0.02, 0.3, w[1] - w[0]);
        o.h = clamp(1 - r * r * 0.9 - r2 * r2 * 0.4) * 0.65 + peb * 0.35;
        o.alb = 0.32 + o.h * 0.36 + (w[2] - 0.5) * 0.08;
        o.rough = 0.62 + 0.25 * (1 - peb);
    } },
    feather: { n: 256, strength: 2.4, f(u, v, o) {
        // telhas de pena: fileiras deslocadas; cada pena cobre 1,6 fileira
        const NX = 10;
        const NY = 12;
        let best = 0;
        let shade = 0.5;
        for (let k = 0; k < 2; k++) {
            const row = Math.floor(v * NY) + k;
            const fy = v * NY - row + 1; // 0 (raiz) … 2
            const off = (wrap(row, 2) ? 0.5 : 0) + hash(wrap(row, NY), 3, 9) * 0.2;
            const xx = u * NX + off;
            const fx = xx - Math.floor(xx) - 0.5;
            const t = fy / 1.6;
            if (t < 0 || t > 1) continue;
            const half = 0.5 * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, t * 1.5 - 0.5), 2)));
            if (Math.abs(fx) > half) continue;
            const h = 0.25 + 0.75 * t - 0.25 * Math.abs(fx) / 0.5 + 0.18 * Math.exp(-(fx * fx) / 0.003);
            if (h > best) {
                best = h;
                shade = 0.42 + 0.2 * t + 0.1 * Math.sin((fx * 60) + t * 30) * 0.4 + hash(Math.floor(xx), wrap(row, NY), 5) * 0.12;
            }
        }
        o.h = best;
        o.alb = shade;
        o.rough = 0.62 + 0.2 * (1 - best);
    } },
    skin: { n: 256, strength: 0.9, f(u, v, o) {
        const a = fbm(u, v, 70, 70, 2, 3);
        const r = 1 - Math.abs(fbm(u, v, 5, 14, 3, 12) * 2 - 1);
        o.h = a * 0.5 + (1 - r * r) * 0.5;
        o.alb = 0.44 + o.h * 0.14;
        o.rough = 0.5 + a * 0.15;
    } }
};

/** Texturas de detalhe ladrilhadas: { normal, orm } (orm: R = AO, G = rugosidade, B = albedo fino). */
function detailTextures(type) {
    const key = `d:${type}`;
    if (texCache.has(key)) return texCache.get(key);
    const def = DETAIL[type] || DETAIL.short;
    const N = def.n;
    const H = new Float32Array(N * N);
    const A = new Float32Array(N * N);
    const R = new Float32Array(N * N);
    const o = { h: 0, alb: 0.5, rough: 0.7 };
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            def.f(i / N, 1 - j / N, o);
            const k = j * N + i;
            H[k] = o.h;
            A[k] = o.alb;
            R[k] = o.rough;
        }
    }
    const normal = makeCanvasTexture(N, N, (d) => {
        const s = def.strength * (N / 256);
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const hx = H[j * N + ((i + 1) % N)] - H[j * N + ((i + N - 1) % N)];
                const hj = H[((j + 1) % N) * N + i] - H[((j + N - 1) % N) * N + i];
                // n = (−∂h/∂u, −∂h/∂v, 1); v cresce para cima no canvas ⇒ ∂h/∂v = −∂h/∂j
                let nx = -hx * s;
                let ny = hj * s;
                const l = 1 / Math.hypot(nx, ny, 1);
                nx *= l;
                ny *= l;
                const k = (j * N + i) * 4;
                d[k] = (nx * 0.5 + 0.5) * 255;
                d[k + 1] = (ny * 0.5 + 0.5) * 255;
                d[k + 2] = (l * 0.5 + 0.5) * 255;
                d[k + 3] = 255;
            }
        }
    }, false);
    const orm = makeCanvasTexture(N, N, (d) => {
        for (let k = 0; k < N * N; k++) {
            d[k * 4] = clamp(0.55 + H[k] * 0.6) * 255;
            d[k * 4 + 1] = clamp(R[k]) * 255;
            d[k * 4 + 2] = clamp(A[k]) * 255;
            d[k * 4 + 3] = 255;
        }
    }, false);
    normal.channel = 1;
    orm.channel = 1;
    const out = { normal, orm };
    texCache.set(key, out);
    return out;
}

/**
 * Albedo de padrão (multiplica a cor por vértice). u = 0 no ventre, 0,5 no dorso.
 * kind: plain | stripes | patches | spots | mottle | bands
 */
function patternTexture(p, seed) {
    const key = `p:${JSON.stringify(p)}:${seed}`;
    if (texCache.has(key)) return texCache.get(key);
    const kind = p.kind || 'plain';
    const N = kind === 'plain' ? 128 : 512;
    const c0 = new THREE.Color(p.c0 ?? 0xffffff);
    const c1 = new THREE.Color(p.c1 ?? 0x0d0b0a);
    const lin = (c) => Math.pow(clamp(c), 1 / 2.2) * 255; // linear → sRGB aproximado
    const mot = p.mottle ?? 0.14;
    const tex = makeCanvasTexture(N, N, (d) => {
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const u = i / N;
                const v = j / N;
                const top = Math.sin(Math.PI * u);
                let k = 0;
                if (kind === 'stripes') {
                    // listras ≈ linhas de v constante, deformadas por fBm, afinando para o ventre e com falhas
                    const n = p.n ?? 9;
                    const warp = (fbm(u, v, 3, 3, 3, seed) - 0.5) * (p.warp ?? 3) + (fbm(u, v, 9, 9, 2, seed + 4) - 0.5) * 0.9;
                    const s = v * n + warp + Math.abs(u - 0.5) * (p.slant ?? 0.8);
                    const band = Math.abs(fract(s) - 0.5) * 2;
                    const w = (p.width ?? 0.42) * (0.25 + 0.75 * top) * (0.35 + 1.3 * fbm(u, v, 4, 7, 2, seed + 9));
                    k = 1 - sstep(w - 0.12, w, band);
                    k *= sstep(0.36, 0.48, fbm(u, v, 5, 11, 2, seed + 5) + top * 0.12);
                } else if (kind === 'patches') {
                    const n = p.n ?? 3;
                    const f = fbm(u, v, n, n, 4, seed) + (fbm(u, v, 24, 24, 2, seed + 3) - 0.5) * 0.03;
                    const th = p.th ?? 0.5;
                    k = sstep(th - 0.008, th + 0.008, f);
                } else if (kind === 'spots') {
                    const n = p.n ?? 14;
                    const w = worley(u * n, v * n, n, n, seed);
                    const r = (p.r ?? 0.3) * (0.6 + 0.6 * w[2]);
                    k = (1 - sstep(r - 0.06, r, w[0])) * sstep(p.belly ?? 0.15, (p.belly ?? 0.15) + 0.25, top);
                } else if (kind === 'mottle' || kind === 'bands') {
                    const n = p.n ?? 4;
                    k = sstep(0.48, 0.74, fbm(u, v, n, n, 3, seed)) * 0.8;
                    if (kind === 'bands') {
                        const s = v * (p.bands ?? 7) + (fbm(u, v, 3, 3, 2, seed + 2) - 0.5) * 1.2;
                        const band = Math.abs(fract(s) - 0.5) * 2;
                        k = Math.max(k * 0.6, (1 - sstep(0.25, 0.6, band)) * sstep(0.35, 0.85, top));
                    }
                }
                k *= p.alpha ?? 1;
                const m = 1 + (fbm(u, v, 6, 6, 3, seed + 31) - 0.5) * mot * 2;
                const o = (j * N + i) * 4;
                d[o] = lin(lerp(c0.r, c1.r, k) * m);
                d[o + 1] = lin(lerp(c0.g, c1.g, k) * m);
                d[o + 2] = lin(lerp(c0.b, c1.b, k) * m);
                d[o + 3] = 255;
            }
        }
    }, true);
    texCache.set(key, tex);
    return tex;
}

/** Íris + pupila num mapa equirretangular (polo = centro da íris). pupil: round | slit | bar */
function eyeTexture(iris, pupil, sclera) {
    const key = `e:${iris}:${pupil}:${sclera}`;
    if (texCache.has(key)) return texCache.get(key);
    const W = 128;
    const Hh = 64;
    const ci = new THREE.Color(iris);
    const cs = new THREE.Color(sclera);
    const lin = (c) => Math.pow(clamp(c), 1 / 2.2) * 255;
    const tex = makeCanvasTexture(W, Hh, (d) => {
        for (let j = 0; j < Hh; j++) {
            for (let i = 0; i < W; i++) {
                const th = (j / (Hh - 1)) * Math.PI; // ângulo a partir do polo
                const ph = (i / W) * TAU;
                const r = th / 0.7; // 1 = borda da íris (40°)
                const x = r * Math.cos(ph);
                const y = r * Math.sin(ph);
                let pr;
                if (pupil === 'slit') pr = Math.hypot(x / 0.16, y / 0.82);
                else if (pupil === 'bar') pr = Math.hypot(x / 0.72, y / 0.3);
                else pr = Math.hypot(x, y) / 0.5;
                const inPupil = 1 - sstep(0.9, 1.05, pr);
                const inIris = 1 - sstep(0.94, 1.04, r);
                const streak = 0.75 + 0.25 * Math.sin(ph * 23 + r * 5) * Math.sin(ph * 7);
                const rim = 1 - 0.55 * sstep(0.7, 1, r);
                let cr = lerp(cs.r, ci.r * streak * rim, inIris);
                let cg = lerp(cs.g, ci.g * streak * rim, inIris);
                let cb = lerp(cs.b, ci.b * streak * rim, inIris);
                cr *= 1 - inPupil * 0.97;
                cg *= 1 - inPupil * 0.97;
                cb *= 1 - inPupil * 0.97;
                const o = (j * W + i) * 4;
                d[o] = lin(cr);
                d[o + 1] = lin(cg);
                d[o + 2] = lin(cb);
                d[o + 3] = 255;
            }
        }
    }, true);
    tex.wrapT = THREE.ClampToEdgeWrapping;
    texCache.set(key, tex);
    return tex;
}

// ─────────────────────────────── materiais ───────────────────────────────────
const matCache = new Map();
const SKIN_LOOK = {
    fur: { sheen: 0.55, env: 0.7, ns: 1 },
    short: { sheen: 0.35, env: 0.85, ns: 0.8 },
    wool: { sheen: 0.7, env: 0.6, ns: 1.2 },
    scales: { sheen: 0, env: 0.9, ns: 1.1 },
    hide: { sheen: 0, env: 0.8, ns: 1.2 },
    feather: { sheen: 0.4, env: 0.8, ns: 1 },
    skin: { sheen: 0.15, env: 0.9, ns: 0.7 }
};
function bodyMaterial(skin, pattern, seed) {
    const key = `${skin.type}|${JSON.stringify(pattern)}|${seed}|${skin.rough ?? 1}`;
    if (matCache.has(key)) return matCache.get(key);
    const det = detailTextures(skin.type);
    const look = SKIN_LOOK[skin.type] || SKIN_LOOK.short;
    const params = {
        vertexColors: true,
        map: patternTexture(pattern, seed),
        normalMap: det.normal,
        roughnessMap: det.orm,
        aoMap: det.orm,
        aoMapIntensity: 0.9,
        roughness: skin.rough ?? 1,
        metalness: 0,
        envMapIntensity: look.env
    };
    let m;
    if (look.sheen > 0) {
        m = new THREE.MeshPhysicalMaterial(params);
        m.sheen = skin.sheen ?? look.sheen;
        m.sheenRoughness = 0.55;
        m.sheenColor = new THREE.Color(skin.sheenColor ?? 0xfff2e0);
    } else {
        m = new THREE.MeshStandardMaterial(params);
    }
    m.normalScale.setScalar((skin.bump ?? 1) * look.ns);
    // UV0.y < −5 marca peças lisas (dente, garra, chifre, casco): ignoram o padrão.
    // O canal B do mapa de rugosidade leva o albedo fino (fios, escamas), em UV1.
    m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', /* glsl */ `
            #ifdef USE_MAP
                vec4 sampledDiffuseColor = texture2D( map, vMapUv );
                if ( vMapUv.y < -5.0 ) sampledDiffuseColor = vec4( 1.0 );
                diffuseColor *= sampledDiffuseColor;
            #endif
            #ifdef USE_ROUGHNESSMAP
                diffuseColor.rgb *= 0.5 + texture2D( roughnessMap, vRoughnessMapUv ).b;
            #endif
        `);
    };
    m.customProgramCacheKey = () => 'gfxCreature1';
    m.name = `gfxCreature:${skin.type}`;
    matCache.set(key, m);
    return m;
}
function eyeMaterial(iris, pupil, sclera) {
    const key = `eye|${iris}|${pupil}|${sclera}`;
    if (matCache.has(key)) return matCache.get(key);
    const m = new THREE.MeshPhysicalMaterial({
        map: eyeTexture(iris, pupil, sclera),
        roughness: 0.08,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: 1.6
    });
    m.name = 'gfxCreatureEye';
    matCache.set(key, m);
    return m;
}

// ─────────────────────────── construtor de malha ─────────────────────────────
const _c = new THREE.Color();
class MeshBuilder {
    constructor() {
        this.pos = [];
        this.col = [];
        this.uv = [];
        this.uv1 = [];
        this.si = [];
        this.sw = [];
        this.idx = [];
        this.seams = [];
    }

    get count() {
        return this.pos.length / 3;
    }

    vert(x, y, z, r, g, b, u, v, u1, v1, w) {
        this.pos.push(x, y, z);
        this.col.push(r, g, b);
        this.uv.push(u, v);
        this.uv1.push(u1, v1);
        const two = w.length > 2;
        this.si.push(w[0], two ? w[2] : w[0], 0, 0);
        this.sw.push(two ? w[1] : 1, two ? 1 - w[1] : 0, 0, 0);
        return this.pos.length / 3 - 1;
    }

    /**
     * Loft de anéis superelípticos. Anel:
     *  c centro · a, b eixos (b = "cima" do anel) · ra, rb (lado +b), rd (lado −b)
     *  n expoente · pear alarga o lado −b · lo/hi corte ao longo de b (cc = cor do corte)
     *  ct/cb cores dorsal/ventral, ce borda (−1…1), cw suavidade, cd faixa dorsal a partir de de
     *  cm cor do lado medial (side) com força cmk · w pesos [osso, peso, osso2] · v, v1 · plain
     *  minY chão · u0, uS janela de UV0.u
     */
    loft(rings, segs, { capStart = false, capEnd = false, nu = 1, swap = false, flip = null } = {}) {
        const starts = [];
        for (const r of rings) {
            starts.push(this.count);
            const e = 2 / (r.n || 2);
            const rd = r.rd ?? r.rb;
            const cw = r.cw ?? 0.3;
            const ce = r.ce ?? 0;
            for (let i = 0; i <= segs; i++) {
                const th = -HALF_PI + ((i % segs) / segs) * TAU; // começa no ventre (costura escondida)
                const cx = Math.cos(th);
                const sy = Math.sin(th);
                const px = Math.sign(cx) * Math.pow(Math.abs(cx), e);
                const py = Math.sign(sy) * Math.pow(Math.abs(sy), e);
                let lx = px * r.ra * (1 - (r.pear || 0) * py);
                let ly = py * (py < 0 ? rd : r.rb);
                let cut = false;
                if (r.lo !== undefined && ly < r.lo) {
                    ly = r.lo;
                    cut = true;
                }
                if (r.hi !== undefined && ly > r.hi) {
                    ly = r.hi;
                    cut = true;
                }
                const x = r.c.x + r.a.x * lx + r.b.x * ly;
                let y = r.c.y + r.a.y * lx + r.b.y * ly;
                const z = r.c.z + r.a.z * lx + r.b.z * ly;
                if (r.minY !== undefined && y < r.minY) y = r.minY;
                if (cut && r.cc) _c.copy(r.cc);
                else {
                    _c.copy(r.cb).lerp(r.ct, sstep(ce - cw, ce + cw, py));
                    if (r.cd) _c.lerp(r.cd, sstep(r.de ?? 0.55, 1, py) * (r.dk ?? 1));
                    if (r.cm) _c.lerp(r.cm, sstep(0, 0.9, -px * r.side) * (r.cmk ?? 0.5));
                    if (r.dirt) _c.multiplyScalar(1 - r.dirt);
                }
                const uu = (r.u0 || 0) + (i / segs) * (r.uS || 1);
                const u1 = (i / segs) * nu;
                this.vert(x, y, z, _c.r, _c.g, _c.b, uu, r.plain ? -10 : r.v || 0,
                    swap ? r.v1 || 0 : u1, swap ? u1 : r.v1 || 0, r.w);
            }
            this.seams.push(starts[starts.length - 1], this.count - 1);
        }
        let fl = flip;
        if (fl === null) {
            const d = v3().subVectors(rings[1].c, rings[0].c);
            if (d.lengthSq() < 1e-12) d.subVectors(rings[rings.length - 1].c, rings[0].c);
            fl = d.dot(v3().crossVectors(rings[0].a, rings[0].b)) > 0;
        }
        const tri = (a, b, c) => (fl ? this.idx.push(a, c, b) : this.idx.push(a, b, c));
        for (let r = 0; r < rings.length - 1; r++) {
            const s0 = starts[r];
            const s1 = starts[r + 1];
            for (let i = 0; i < segs; i++) {
                tri(s0 + i, s1 + i, s0 + i + 1);
                tri(s0 + i + 1, s1 + i, s1 + i + 1);
            }
        }
        const cap = (ri, start) => {
            const r = rings[ri];
            const s = starts[ri];
            // centro = média do anel (respeita cortes e chão)
            let x = 0;
            let y = 0;
            let z = 0;
            for (let i = 0; i < segs; i++) {
                x += this.pos[(s + i) * 3];
                y += this.pos[(s + i) * 3 + 1];
                z += this.pos[(s + i) * 3 + 2];
            }
            _c.copy(r.cb).lerp(r.ct, 0.5);
            if (r.dirt) _c.multiplyScalar(1 - r.dirt);
            const c = this.vert(x / segs, y / segs, z / segs, _c.r, _c.g, _c.b, (r.u0 || 0) + 0.5 * (r.uS || 1),
                r.plain ? -10 : r.v || 0, 0.5 * nu, r.v1 || 0, r.w);
            for (let i = 0; i < segs; i++) {
                if (start) tri(c, s + i, s + i + 1);
                else tri(c, s + i + 1, s + i);
            }
        };
        if (capStart) cap(0, true);
        if (capEnd) cap(rings.length - 1, false);
    }

    /**
     * Tubo ao longo de uma polilinha 3D. radii[i] = [ra, rb] ou número.
     * `up` orienta o eixo b dos anéis (face "de cima" recebe ct).
     */
    tube(pts, radii, up, o = {}) {
        const n = pts.length;
        const rings = [];
        const t = v3();
        let len = 0;
        for (let i = 0; i < n; i++) {
            const p0 = pts[Math.max(0, i - 1)];
            const p1 = pts[Math.min(n - 1, i + 1)];
            t.subVectors(p1, p0).normalize();
            const a = v3().crossVectors(up, t);
            if (o.aAxis) a.copy(o.aAxis);
            else if (a.lengthSq() < 1e-8) a.crossVectors(AX, t);
            a.normalize();
            const b = v3().crossVectors(t, a).normalize();
            if (i > 0) len += pts[i].distanceTo(pts[i - 1]);
            const r = radii[i];
            const ra = Array.isArray(r) ? r[0] : r;
            const rb = Array.isArray(r) ? r[1] : r;
            const rd = Array.isArray(r) && r.length > 2 ? r[2] : rb;
            const ct = Array.isArray(o.ct) ? o.ct[i] : o.ct;
            const cb = o.cb ? (Array.isArray(o.cb) ? o.cb[i] : o.cb) : ct;
            rings.push({
                c: pts[i], a, b, ra, rb, rd, n: o.n || 2, ct, cb, ce: o.ce ?? 0, cw: o.cw ?? 0.3,
                w: typeof o.w === 'function' ? o.w(i, n) : o.w, plain: o.plain !== false,
                v: (o.v0 || 0) + len * (o.vS || 1), v1: len * (o.dens || 4), minY: o.minY, dirt: o.dirt
            });
        }
        this.loft(rings, o.segs || 6, { capStart: o.capStart !== false, capEnd: o.capEnd !== false, nu: o.nu || 1 });
    }

    /** Elipsoide (loft de 5 anéis) com semi-eixos A, B (seção) e C (comprimento). */
    blob(c, A, B, C, color, w, o = {}) {
        const rings = [];
        const la = A.length();
        const lb = B.length();
        const a = A.clone().normalize();
        const b = B.clone().normalize();
        const ts = o.ts || [-0.94, -0.6, 0, 0.6, 0.94];
        for (const t of ts) {
            const k = Math.sqrt(1 - t * t);
            rings.push({
                c: c.clone().addScaledVector(C, t), a, b, ra: la * k, rb: lb * k, n: o.n || 2,
                ct: color, cb: o.cb || color, ce: o.ce ?? 0, w, plain: o.plain !== false, v: o.v || 0, v1: t * 0.5,
                minY: o.minY, lo: o.lo === undefined ? undefined : o.lo * k
            });
        }
        this.loft(rings, o.segs || 6, { capStart: true, capEnd: true, flip: o.flip ?? null });
    }

    /** Cone curvo (dente, garra, espinho): base → ponta, curvando para `bend`. */
    spike(base, dir, len, r, color, w, { bend = null, segs = 5, rb = null, up = AY } = {}) {
        const pts = [];
        const rad = [];
        const d = dir.clone().normalize();
        const p = base.clone();
        const N = bend ? 3 : 2;
        for (let i = 0; i <= N; i++) {
            const t = i / N;
            pts.push(p.clone());
            const k = Math.pow(1 - t, 0.85) * 0.96 + 0.04;
            rad.push(rb ? [r * k, rb * k] : r * k);
            if (bend) d.addScaledVector(bend, 0.55 / N).normalize();
            p.addScaledVector(d, len / N);
        }
        this.tube(pts, rad, up, { ct: color, w, segs, capStart: false });
    }

    build() {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
        geo.setAttribute('uv1', new THREE.Float32BufferAttribute(this.uv1, 2));
        geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.si, 4));
        geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.sw, 4));
        geo.setIndex(this.idx);
        geo.computeVertexNormals();
        // solda as normais na costura do ventre (vértices duplicados por causa do UV)
        const nrm = geo.attributes.normal;
        for (let k = 0; k < this.seams.length; k += 2) {
            const a = this.seams[k];
            const b = this.seams[k + 1];
            const x = nrm.getX(a) + nrm.getX(b);
            const y = nrm.getY(a) + nrm.getY(b);
            const z = nrm.getZ(a) + nrm.getZ(b);
            const l = 1 / (Math.hypot(x, y, z) || 1);
            nrm.setXYZ(a, x * l, y * l, z * l);
            nrm.setXYZ(b, x * l, y * l, z * l);
        }
        return geo;
    }
}

// ───────────────────── resolução do spec (idade, proporções) ─────────────────
const DETAIL_CFG = [
    { segT: 10, segL: 6, sub: 1, small: false, teeth: 0, toes: false },
    { segT: 16, segL: 8, sub: 2, small: true, teeth: 0.5, toes: true },
    { segT: 32, segL: 14, sub: 4, small: true, teeth: 1, toes: true }
];
const JUV_DEFAULT = { size: 0.5, leg: 0.84, girth: 1.06, neck: 0.82, head: 1.42, snout: 0.72, tail: 0.8, eye: 1.35, ear: 1.1, body: 0.8 };

function resolveSpec(spec, o) {
    const age = clamp(o.age ?? 1);
    const juv = { ...JUV_DEFAULT, ...(spec.juv || {}) };
    const k = 1 - age;
    const um = o.mods || {};
    const m = {};
    const sm = spec.mods || {};
    for (const key of ['leg', 'girth', 'neck', 'head', 'snout', 'tail', 'eye', 'ear', 'limb', 'body']) {
        m[key] = lerp(1, juv[key] ?? 1, k) * (um[key] ?? 1) * (sm[key] ?? 1);
    }
    const sizeK = lerp(1, juv.size, k) * (spec.size ?? 1);
    const R = JSON.parse(JSON.stringify(spec, (key, val) => (typeof val === 'function' ? undefined : val)));
    R.coat = { ...spec.coat };
    R.mods = m;
    R.sizeK = sizeK;

    R.age = age;
    // tronco mais curto (filhotes): comprime z em torno do quadril
    if (m.body !== 1) {
        const z0 = R.legs.hind.J[0][0];
        const sz = (z) => z0 + (z - z0) * m.body;
        for (const t of R.torso) t[0] = sz(t[0]);
        for (const n of R.neck) n[0] = sz(n[0]);
        R.head.at[0] = sz(R.head.at[0]);
        for (const L of [R.legs.front, R.arms]) {
            if (!L) continue;
            const d = sz(L.J[0][0]) - L.J[0][0];
            for (const j of L.J) j[0] += d;
        }
        if (R.wings) R.wings.root[0] = sz(R.wings.root[0]);
        if (R.extras) {
            if (R.extras.udder) R.extras.udder.z = sz(R.extras.udder.z);
            if (R.extras.saddleZ !== undefined) R.extras.saddleZ = sz(R.extras.saddleZ);
        }
    }
    // pernas: altura das juntas × leg; o tronco sobe/desce junto
    const legs = R.legs;
    const refF = legs.front ? legs.front.J[0][1] : null;
    const refH = legs.hind.J[0][1];
    const dH = refH * (m.leg - 1);
    const dF = refF !== null ? refF * (m.leg - 1) : dH;
    const zH = legs.hind.J[0][0];
    const zF = legs.front ? legs.front.J[0][0] : zH + 1;
    const lift = (z) => lerp(dH, dF, clamp((z - zH) / (zF - zH || 1)));
    for (const L of [legs.front, legs.hind]) {
        if (!L) continue;
        const j0 = L.J[0];
        const f = (j0[1] + lift(j0[0])) / j0[1];
        const z0 = j0[0];
        for (const j of L.J) {
            j[1] *= f;
            j[0] = z0 + (j[0] - z0) * lerp(1, f, 0.6);
        }
        if (m.girth !== 1) L.x *= lerp(1, m.girth, 0.7);
        if (m.limb !== 1) L.r = L.r.map((r) => (Array.isArray(r) ? r.map((v) => v * m.limb) : r * m.limb));
    }
    // tronco
    for (const s of R.torso) {
        const d = lift(s[0]);
        if (R.torsoC) {
            s[1] += d;
            s[2] *= m.girth;
            s[3] *= m.girth;
            if (s[6] !== undefined) s[6] *= m.girth;
            continue;
        }
        const cy = (s[1] + s[2]) / 2 + d;
        const h = ((s[1] - s[2]) / 2) * m.girth;
        s[1] = cy + h;
        s[2] = cy - h;
        s[3] *= m.girth;
    }
    const tEnd = R.torso[R.torso.length - 1];
    const nb = [tEnd[0], (R.torsoC ? tEnd[1] : (tEnd[1] + tEnd[2]) / 2) - lift(tEnd[0])]; // base do pescoço (antes do lift)
    const dN = lift(tEnd[0]);
    // pescoço e cabeça: escala em torno da base do pescoço
    const nk = (p) => {
        p[0] = nb[0] + (p[0] - nb[0]) * m.neck;
        p[1] = nb[1] + (p[1] - nb[1]) * m.neck + dN;
    };
    for (const s of R.neck) nk(s);
    nk(R.head.at);
    const H = R.head;
    H.len *= m.head * lerp(1, m.snout, 0.45);
    const te = H.eye ? H.eye.t : 0.35;
    for (const p of H.prof) {
        p[1] *= m.head;
        p[2] *= m.head;
        p[3] *= m.head;
    }
    // focinho curto: comprime t depois do olho (e renormaliza)
    if (m.snout !== 1) {
        const tmax = te + (1 - te) * m.snout;
        const map = (t) => (t <= te ? t : te + (t - te) * m.snout) / tmax;
        for (const p of H.prof) p[0] = map(p[0]);
        if (H.mouth) {
            H.mouth.t0 = map(H.mouth.t0);
            if (H.mouth.tip) H.mouth.tip = map(H.mouth.tip);
        }
        for (const key of ['eye', 'ears', 'nostril']) if (H[key]) H[key].t = map(H[key].t);
        for (const h of H.horns || []) h.t = map(h.t);
        if (R.coat.muzzleT) R.coat.muzzleT = map(R.coat.muzzleT);
        if (R.coat.beakT) R.coat.beakT = map(R.coat.beakT);
    }
    if (H.mouth) {
        H.mouth.y *= m.head;
        if (H.mouth.y1 !== undefined) H.mouth.y1 *= m.head;
    }
    if (H.eye) {
        H.eye.up *= m.head;
        H.eye.r *= m.eye * lerp(1, m.head, 0.5);
    }
    if (H.ears) {
        H.ears.up *= m.head;
        H.ears.x *= m.head;
        H.ears.len *= m.ear * lerp(1, m.head, 0.6);
        H.ears.w *= m.ear * lerp(1, m.head, 0.6);
    }
    if (H.nostril) {
        H.nostril.up *= m.head;
        if (H.nostril.x !== undefined) H.nostril.x *= m.head;
        H.nostril.r *= m.head;
    }
    for (const h of H.horns || []) {
        h.up *= m.head;
        h.x *= m.head;
        h.len *= m.head * (0.25 + 0.75 * age * age);
        h.r *= m.head * (0.5 + 0.5 * age);
    }
    if (R.tail) R.tail.len *= m.tail;
    return R;
}

// ───────────────────────────── construção ────────────────────────────────────
function hermite(p0, p1, m0, m1, h, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p0 + (t3 - 2 * t2 + t) * h * m0 + (-2 * t3 + 3 * t2) * p1 + (t3 - t2) * h * m1;
}

/** Amostra o eixo axial em anéis (ver cabeçalho). */
function sampleAxis(keys, sub) {
    const n = keys.length;
    const s = [0];
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(keys[i].z - keys[i - 1].z, keys[i].y - keys[i - 1].y);
    const F = ['z', 'y', 'hw', 'hu', 'hd'];
    const tan = keys.map((k, i) => {
        const a = keys[Math.max(0, i - 1)];
        const b = keys[Math.min(n - 1, i + 1)];
        const ds = s[Math.min(n - 1, i + 1)] - s[Math.max(0, i - 1)] || 1;
        const o = {};
        for (const f of F) o[f] = (b[f] - a[f]) / ds;
        return o;
    });
    const out = [];
    for (let i = 0; i < n - 1; i++) {
        const a = keys[i];
        const b = keys[i + 1];
        const h = s[i + 1] - s[i];
        const avgR = (a.hw + a.hu + b.hw + b.hu) / 4;
        const cnt = clamp(Math.round(sub * Math.max(1, h / (1.5 * avgR))), 1, sub * 3);
        for (let j = 0; j < cnt; j++) {
            const t = j / cnt;
            const o = { part: t < 0.5 ? a.part : b.part };
            for (const f of F) {
                o[f] = hermite(a[f], b[f], tan[i][f], tan[i + 1][f], h, t);
                if (f !== 'z' && f !== 'y') o[f] = clamp(o[f], Math.min(a[f], b[f]) * 0.92, Math.max(a[f], b[f]) * 1.06);
            }
            o.n = lerp(a.n, b.n, t);
            o.pear = lerp(a.pear, b.pear, t);
            o.ht = lerp(a.ht, b.ht, t);
            o.pt = a.part === b.part ? lerp(a.pt, b.pt, t) : (t < 0.5 ? a.pt : b.pt);
            out.push(o);
        }
    }
    out.push({ ...keys[n - 1] });
    let S = 0;
    for (let i = 0; i < out.length; i++) {
        if (i > 0) S += Math.hypot(out[i].z - out[i - 1].z, out[i].y - out[i - 1].y);
        out[i].S = S;
    }
    for (let i = 0; i < out.length; i++) {
        const a = out[Math.max(0, i - 1)];
        const b = out[Math.min(out.length - 1, i + 1)];
        const l = Math.hypot(b.z - a.z, b.y - a.y) || 1;
        out[i].tz = (b.z - a.z) / l;
        out[i].ty = (b.y - a.y) / l;
    }
    // suaviza a orientação dos anéis (3 passadas) para não cruzarem no lado interno das curvas
    for (let pass = 0; pass < 3; pass++) {
        const tz = out.map((o) => o.tz);
        const ty = out.map((o) => o.ty);
        for (let i = 1; i < out.length - 1; i++) {
            const z = tz[i - 1] + 2 * tz[i] + tz[i + 1];
            const y = ty[i - 1] + 2 * ty[i] + ty[i + 1];
            const l = Math.hypot(z, y) || 1;
            out[i].tz = z / l;
            out[i].ty = y / l;
        }
    }
    return out;
}

const DEF_COAT = {
    base: 0x8a6a4a, mouth: 0x4a1c20, tongue: 0xc66a72, horn: 0xd8ccb0, hoof: 0x262019, claw: 0x1a1613,
    beak: 0xd9a23a, nose: 0x15110e, teeth: 0xefe8d6, iris: 0x6a4a22, sclera: 0x120d0a, pupil: 'round'
};

function makePalette(coat, rnd, jitter) {
    const C = {};
    const all = { ...DEF_COAT, ...coat };
    for (const k in all) {
        if (typeof all[k] === 'number' && k !== 'edge' && !/[TH]$/.test(k) && k !== 'soft' && k !== 'dirt' && k !== 'backK') {
            C[k] = new THREE.Color(all[k]);
        }
    }
    const dh = (rnd() - 0.5) * 0.024 * jitter;
    const ds = (rnd() - 0.5) * 0.08 * jitter;
    const dl = (rnd() - 0.5) * 0.07 * jitter;
    for (const k of ['base', 'back', 'belly', 'leg', 'face', 'tail', 'mane']) if (C[k]) C[k].offsetHSL(dh, ds, dl);
    if (!C.belly) C.belly = C.base.clone().lerp(new THREE.Color(0xffffff), 0.3);
    return C;
}

/**
 * Cria uma criatura. Ver cabeçalho do arquivo para a API completa.
 * @param {string|object} preset nome em CREATURES ou spec
 * @param {object} [opts]
 */
export function createCreature(preset = 'fox', opts = {}) {
    let spec = typeof preset === 'string' ? CREATURES[preset] : preset;
    if (!spec) {
        console.warn(`gfx/creature: preset desconhecido "${preset}", usando fox`);
        spec = CREATURES.fox;
    }
    if (typeof spec === 'function') spec = spec(opts);
    const o = { scale: 1, age: spec.defaultAge ?? 1, seed: 1, detail: 2, colors: null, pattern: null, saddle: false, ...opts };
    if (spec.variant) spec = spec.variant(spec, o) || spec;
    const D = DETAIL_CFG[clamp(Math.round(o.detail), 0, 2)];
    const rnd = rng((o.seed | 0) * 7919 + 13);
    const R = resolveSpec(spec, o);
    if (o.colors) Object.assign(R.coat, o.colors);
    const coat = R.coat;
    const C = makePalette(coat, rnd, o.seed === 1 ? 0 : 1);
    const coatFn = spec.coat && spec.coat.fn;
    const mb = new MeshBuilder();
    const X = R.extras || {};
    const G = { ...(R.gait || {}) };

    // ---------- cabeça: referencial ----------
    const Hd = R.head;
    const hp = Hd.pitch || 0;
    const hf = v3(0, Math.sin(hp), Math.cos(hp)); // eixo do crânio (para o focinho)
    const hu = v3(0, Math.cos(hp), -Math.sin(hp)); // "cima" do crânio
    const hO = v3(0, Hd.at[1], Hd.at[0]);
    const headPt = (t, up = 0, x = 0) => hO.clone().addScaledVector(hf, t * Hd.len).addScaledVector(hu, up).addScaledVector(AX, x);
    const headDir = (d, side = 1) => v3(d[0] * side, 0, 0).addScaledVector(hu, d[1]).addScaledVector(hf, d[2]).normalize();
    const profAt = (t) => {
        const P = Hd.prof;
        let i = 0;
        while (i < P.length - 2 && P[i + 1][0] < t) i++;
        const a = P[i];
        const b = P[i + 1];
        const k = clamp((t - a[0]) / (b[0] - a[0] || 1));
        return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k), lerp(a[4] || 2.2, b[4] || 2.2, k)];
    };
    /** meia-largura da seção do crânio na altura `up` (relativa ao eixo) */
    const headHalfW = (t, up) => {
        const [pu, pd, hw, n] = profAt(t);
        const r = up >= 0 ? pu : pd;
        const q = clamp(Math.abs(up) / r, 0, 0.999);
        return hw * Math.pow(1 - Math.pow(q, n), 1 / n);
    };
    const mouth = Hd.mouth || null;
    const lineAt = (t) => (mouth ? lerp(mouth.y, mouth.y1 ?? mouth.y, clamp((t - mouth.t0) / (1 - mouth.t0))) : -1e9);

    // ---------- chaves do eixo ----------
    const keys = [];
    const T0 = R.torso[0];
    const tailSpec = R.tail;
    let tailBones = 0;
    if (tailSpec) {
        tailBones = D.small ? tailSpec.bones || 5 : Math.max(2, Math.ceil((tailSpec.bones || 5) / 2));
        const NK = tailSpec.keys || 7;
        const pr = (t) => {
            const P = tailSpec.prof;
            let i = 0;
            while (i < P.length - 2 && P[i + 1][0] < t) i++;
            const k = clamp((t - P[i][0]) / (P[i + 1][0] - P[i][0] || 1));
            return [lerp(P[i][1], P[i + 1][1], k), lerp(P[i][2], P[i + 1][2], k)];
        };
        // posição: integra a direção (−cos a, sin a), a(t) = a0 + curve·t
        const pts = [];
        let z = T0[0];
        let y = (R.torsoC ? T0[1] : (T0[1] + T0[2]) / 2) + (tailSpec.dy || 0);
        const STEPS = 24;
        for (let i = 0; i <= STEPS; i++) {
            const t = i / STEPS;
            pts.push([z, y]);
            const a = tailSpec.a0 + (tailSpec.curve || 0) * (t + 0.5 / STEPS);
            z -= Math.cos(a) * tailSpec.len / STEPS;
            y += Math.sin(a) * tailSpec.len / STEPS;
        }
        for (let i = NK; i >= 1; i--) {
            const t = Math.pow(i / NK, 0.85);
            const p = pts[Math.round(t * STEPS)];
            const r = pr(t);
            keys.push({ z: p[0], y: Math.max(p[1], r[1] * 0.9), hw: r[0], hu: r[1], hd: r[1], n: 2, pear: 0, ht: -1, part: 'tail', pt: t });
        }
    }
    const tz0 = R.torso[0][0];
    const tz1 = R.torso[R.torso.length - 1][0];
    for (const s of R.torso) {
        const pt = (s[0] - tz0) / (tz1 - tz0 || 1);
        if (R.torsoC) {
            // formato por centro: [z, y, meia-largura, raio dorsal, n, pera, raio ventral]
            keys.push({ z: s[0], y: s[1], hw: s[2], hu: s[3], hd: s[6] ?? s[3], n: s[4] || 2.2, pear: s[5] || 0, ht: -1, part: 'torso', pt: R.torso.indexOf(s) / (R.torso.length - 1) });
            continue;
        }
        const h = (s[1] - s[2]) / 2;
        keys.push({ z: s[0], y: (s[1] + s[2]) / 2, hw: s[3], hu: h, hd: h, n: s[4] || 2.2, pear: s[5] || 0, ht: -1, part: 'torso', pt });
    }
    R.neck.forEach((s, i) => {
        keys.push({ z: s[0], y: s[1], hw: s[2], hu: s[3], hd: s[5] ?? s[3], n: s[4] || 2.1, pear: 0, ht: -1, part: 'neck', pt: (i + 1) / (R.neck.length + 1) });
    });
    for (const p of Hd.prof) {
        const c = headPt(p[0]);
        keys.push({ z: c.z, y: c.y, hw: p[3], hu: p[1], hd: p[2], n: p[4] || 2.2, pear: 0, ht: p[0], part: 'head', pt: p[0] });
    }
    const rings = sampleAxis(keys, D.sub);
    const Send = rings[rings.length - 1].S;
    const ringAtZ = (z, part) => {
        let best = null;
        let bd = 1e9;
        for (const r of rings) {
            if (r.part !== part) continue;
            const d = Math.abs(r.z - z);
            if (d < bd) {
                bd = d;
                best = r;
            }
        }
        return best;
    };
    const firstOf = (part) => rings.find((r) => r.part === part);
    const lastOf = (part) => {
        for (let i = rings.length - 1; i >= 0; i--) if (rings[i].part === part) return rings[i];
        return null;
    };
    const ringAtS = (S) => {
        let i = 0;
        while (i < rings.length - 2 && rings[i + 1].S < S) i++;
        const a = rings[i];
        const b = rings[i + 1];
        const k = clamp((S - a.S) / (b.S - a.S || 1));
        const out = {};
        for (const f of ['z', 'y', 'hw', 'hu', 'hd', 'tz', 'ty', 'S', 'n']) out[f] = lerp(a[f], b[f], k);
        out.part = k < 0.5 ? a.part : b.part;
        out.pt = k < 0.5 ? a.pt : b.pt;
        return out;
    };

    // ---------- ossos ----------
    const legsSpec = R.legs;
    const quad = !!legsSpec.front && !legsSpec.front.arm;
    const hipZ = legsSpec.hind.J[0][0];
    const shZ = legsSpec.front ? legsSpec.front.J[0][0] : lerp(tz0, tz1, 0.8);
    const rHip = ringAtZ(hipZ, 'torso');
    const rChest = ringAtZ(lerp(hipZ, shZ, quad ? 0.8 : 0.75), 'torso');
    const rTorso0 = firstOf('torso');
    const rNeck0 = lastOf('torso');
    const rHead0 = rings.find((r) => r.ht >= 0);
    const S_h = rHip.S;
    const S_c = Math.max(rChest.S, S_h + 0.02);
    const S_s = lerp(S_h, S_c, 0.45);
    const S_tb = rTorso0.S;
    const S_nb = rNeck0.S;
    const S_hd = rHead0.S;
    const neckBones = D.small ? R.neckBones || 2 : Math.max(1, Math.ceil((R.neckBones || 2) / 2));
    const BN = []; // [nome, pai, x, y, z]
    const bi = {};
    const addBone = (name, parent, p) => {
        bi[name] = BN.length;
        BN.push([name, parent === null ? -1 : bi[parent], p.x, p.y, p.z]);
        return bi[name];
    };
    const axisPt = (S) => {
        const r = ringAtS(S);
        return v3(0, r.y, r.z);
    };
    addBone('hips', null, axisPt(S_h));
    addBone('spine', 'hips', axisPt(S_s));
    addBone('chest', 'spine', axisPt(S_c));
    const neckS = [];
    for (let i = 0; i < neckBones; i++) {
        neckS.push(lerp(S_nb, S_hd, i / neckBones));
        addBone(`neck${i + 1}`, i === 0 ? 'chest' : `neck${i}`, axisPt(neckS[i]));
    }
    addBone('head', `neck${neckBones}`, axisPt(S_hd));
    const tHinge = mouth ? Math.max(0.02, mouth.t0 - (mouth.hinge ?? 0.1)) : 0.3;
    addBone('jaw', 'head', mouth ? headPt(tHinge, lineAt(mouth.t0) * 0.5) : headPt(0.3));
    const tailS = [];
    for (let i = 0; i < tailBones; i++) {
        tailS.push(S_tb * (1 - i / tailBones));
        addBone(`tail${i + 1}`, i === 0 ? 'hips' : `tail${i}`, axisPt(tailS[i]));
    }
    // fronteiras de peso ao longo de S (crescente): [S, osso abaixo, osso acima]
    const bounds = [];
    for (let i = tailBones - 1; i >= 1; i--) bounds.push([tailS[i], bi[`tail${i + 1}`], bi[`tail${i}`]]);
    if (tailBones) bounds.push([S_tb, bi.tail1, bi.hips]);
    bounds.push([S_s, bi.hips, bi.spine], [S_c, bi.spine, bi.chest], [S_nb, bi.chest, bi.neck1]);
    for (let i = 1; i < neckBones; i++) bounds.push([neckS[i], bi[`neck${i}`], bi[`neck${i + 1}`]]);
    bounds.push([S_hd, bi[`neck${neckBones}`], bi.head]);
    const half = bounds.map((b, i) => {
        const prev = i > 0 ? b[0] - bounds[i - 1][0] : b[0];
        const next = i < bounds.length - 1 ? bounds[i + 1][0] - b[0] : Send - b[0];
        return 0.42 * Math.min(prev, next);
    });
    const axisW = (S) => {
        let j = -1;
        while (j < bounds.length - 1 && bounds[j + 1][0] <= S) j++;
        if (j >= 0 && S - bounds[j][0] < half[j]) {
            const k = 0.5 + 0.5 * sstep(0, 1, (S - bounds[j][0]) / half[j]);
            return [bounds[j][2], k, bounds[j][1]];
        }
        if (j < bounds.length - 1 && bounds[j + 1][0] - S < half[j + 1]) {
            const k = 0.5 + 0.5 * sstep(0, 1, (bounds[j + 1][0] - S) / half[j + 1]);
            return [bounds[j + 1][1], k, bounds[j + 1][2]];
        }
        return [j < 0 ? bounds[0][1] : bounds[j][2]];
    };

    // ---------- pintura ----------
    const height0 = Math.max(...R.torso.map((s) => s[1] + (R.torsoC ? s[3] : 0)), Hd.at[1]);
    const dirtH = (coat.dirtH ?? 0.16) * height0;
    const dirtK = coat.dirt ?? 0.22;
    const P = {};
    const paint = (part, t, y) => {
        P.cd = null;
        P.plain = false;
        P.ce = coat.edge ?? -0.3;
        P.cw = coat.soft ?? 0.3;
        P.de = coat.backT ?? 0.5;
        P.dk = coat.backK ?? 1;
        P.cm = null;
        if (part === 'torso' || part === 'neck') {
            P.ct = C.base;
            P.cb = C.belly;
            P.cd = C.back || null;
            if (part === 'neck' && C.neck) P.ct = C.neck;
        } else if (part === 'tail') {
            P.ct = C.tail || C.base;
            P.cb = C.tailUnder || C.tail || (coat.tailBelly ? C.belly : C.base);
            P.cd = C.tail ? null : C.back || null;
            if (C.tailTip) {
                const tt = coat.tailTipT ?? 0.8;
                const k = sstep(tt - 0.1, tt + 0.04, t);
                P.ct = P.ct.clone().lerp(C.tailTip, k);
                P.cb = P.cb.clone().lerp(C.tailTip, k);
                if (k > 0.5) P.cd = null;
            }
        } else if (part === 'head') {
            P.ct = C.face || C.base;
            P.cb = C.chin || C.belly;
            P.cd = C.back || null;
            P.dk = (coat.backK ?? 1) * (1 - sstep(0.3, 0.7, t));
            if (C.muzzle) {
                const k = sstep((coat.muzzleT ?? 0.6) - 0.12, (coat.muzzleT ?? 0.6) + 0.1, t);
                P.ct = P.ct.clone().lerp(C.muzzle, k);
                P.cb = P.cb.clone().lerp(C.muzzle, k * 0.7);
            }
            if (coat.beakT !== undefined && t >= coat.beakT) {
                P.ct = P.cb = C.beak;
                P.cd = null;
                P.plain = true;
            }
        } else {
            // pernas: t = 0 no topo, 1 no chão
            let c = C.leg || C.base;
            if (C.socks) c = c.clone().lerp(C.socks, sstep(1 - (coat.sockH ?? 0.5) - 0.1, 1 - (coat.sockH ?? 0.5) + 0.08, t));
            P.ct = P.cb = c;
            P.cm = C.belly;
            P.cmk = (coat.legIn ?? 0.55) * (1 - sstep(0.35, 0.75, t));
        }
        if (coatFn) coatFn(part, t, y, P, C);
        P.dirt = part === 'head' ? 0 : dirtK * (1 - sstep(0, dirtH, y));
        return P;
    };

    // ---------- loft do eixo ----------
    const circ = rings.filter((r) => r.part === 'torso').reduce((a, r) => a + TAU * Math.sqrt((r.hw * r.hw + r.hu * r.hu) / 2), 0)
        / rings.filter((r) => r.part === 'torso').length;
    const Lv = circ; // 1 ladrilho de padrão = 1 circunferência média
    const tile = R.skin.tile ?? clamp(0.2 * (tz1 - tz0), 0.05, 1.5);
    const dens = 1 / tile;
    const nuBody = Math.max(1, Math.round(circ * dens));
    const axisRings = rings.map((r) => {
        const p = paint(r.part, r.pt, r.y - r.hd);
        const ring = {
            c: v3(0, r.y, r.z), a: AX, b: v3(0, r.tz, -r.ty), ra: r.hw, rb: r.hu, rd: r.hd, n: r.n, pear: r.pear,
            ct: p.ct, cb: p.cb, ce: p.ce, cw: p.cw, cd: p.cd, de: p.de, dk: p.dk, dirt: p.dirt, plain: p.plain,
            w: axisW(r.S), v: r.S / Lv, v1: r.S * dens
        };
        if (mouth && r.ht > mouth.t0 - 0.1) {
            const k = sstep(mouth.t0 - 0.1, mouth.t0, r.ht);
            ring.lo = lerp(-r.hd * 1.01, lineAt(Math.max(r.ht, mouth.t0)), k);
            ring.cc = C.mouth;
        }
        r.ring = ring;
        return ring;
    });
    mb.loft(axisRings, D.segT, { capStart: true, capEnd: true, nu: nuBody });
    // Massas de ombro e garupa: em vez de "placas" coladas, o próprio tronco incha onde o membro
    // nasce — deslocamento lateral gaussiano Δx = A·exp(−(Δz/σz)² − (Δy/σy)²) em torno da junta.
    {
        const bumps = [];
        for (const [L, front] of [[legsSpec.front, true], [legsSpec.hind, false]]) {
            if (!L || L.arm || L.noBump) continue;
            const r0 = Array.isArray(L.r[0]) ? L.r[0] : [L.r[0], L.r[0]];
            const j0 = L.J[0];
            const j1 = L.J[1];
            const rg = ringAtZ(j0[0], 'torso');
            const hh = j0[1] >= rg.y ? rg.hu : rg.hd;
            const thw = rg.hw * Math.pow(1 - Math.pow(clamp(Math.abs(j0[1] - rg.y) / hh, 0, 0.98), rg.n), 1 / rg.n);
            const lx = Math.min(L.x, thw - r0[0] * (L.embed ?? 0.45));
            const amp = clamp(lx + r0[0] - thw, r0[0] * 0.25, r0[0] * 1.3) * (L.bump ?? 1);
            // centro da massa: escápula sobe para a cernelha; coxa fica entre quadril e joelho
            const cz = front ? j0[0] - r0[1] * 0.35 : lerp(j0[0], j1[0], 0.3);
            const cy = front ? j0[1] + r0[1] * 0.5 : lerp(j0[1], j1[1], 0.2);
            bumps.push({ cz, cy, sz: r0[1] * (front ? 1.0 : 1.15), sy: r0[1] * (front ? 1.5 : 1.3), amp });
        }
        if (bumps.length) {
            for (let i = 0; i < mb.count; i++) {
                const x = mb.pos[i * 3];
                const y = mb.pos[i * 3 + 1];
                const z = mb.pos[i * 3 + 2];
                let d = 0;
                for (const b of bumps) {
                    const dz = (z - b.cz) / b.sz;
                    const dy = (y - b.cy) / b.sy;
                    const q = dz * dz + dy * dy;
                    if (q < 6) d += b.amp * Math.exp(-q);
                }
                // some perto da linha média para não abrir o dorso/ventre
                if (d > 0) mb.pos[i * 3] = x + Math.sign(x) * d * sstep(0.02, 0.4, Math.abs(x) / (Math.abs(x) + d + 1e-6));
            }
        }
    }

    const headW = [bi.head];
    const jawW = [bi.jaw];
    const eyes = [];
    const sockets = {};
    const sockDefs = [];

    // ---------- mandíbula, dentes, língua ----------
    if (mouth) {
        const tip = mouth.tip ?? 0.96;
        const N = D.sub * 3 + 2;
        const jr = [];
        for (let i = 0; i <= N; i++) {
            const t = lerp(tHinge, tip, Math.pow(i / N, 0.9));
            const ln = lineAt(Math.max(t, mouth.t0));
            const [, pd, , n] = profAt(t);
            const endK = i === N ? 0.55 : 1;
            const depth = Math.max(0.001, (pd + ln) * (mouth.jawK ?? 0.98)) * endK;
            const p = paint('head', t, 1);
            const wj = sstep(tHinge, mouth.t0 + 0.02, t);
            jr.push({
                c: headPt(t, ln), a: AX, b: hu, ra: headHalfW(t, ln) * (mouth.inset ?? 0.94) * endK, rb: depth * 0.25, rd: depth, n,
                hi: 0, cc: C.mouth, ct: p.cb, cb: p.cb, ce: 0, w: wj >= 0.999 ? jawW : [bi.jaw, wj, bi.head],
                v: (S_hd + t * Hd.len) / Lv, v1: (S_hd + t * Hd.len) * dens, plain: p.plain
            });
        }
        mb.loft(jr, D.segT, { capStart: true, capEnd: true, nu: nuBody });
        if (D.small) {
            // língua
            const tl0 = mouth.t0 + 0.04;
            const tl1 = lerp(mouth.t0, tip, 0.86);
            const mid = (tl0 + tl1) / 2;
            const lw = headHalfW(tl1, lineAt(tl1)) * 0.62;
            mb.blob(headPt(mid, lineAt(mid) + lw * 0.02), v3(lw, 0, 0), hu.clone().multiplyScalar(lw * 0.3),
                hf.clone().multiplyScalar((tl1 - tl0) * Hd.len * 0.5), C.tongue, jawW, { segs: 6 });
        }
        const teeth = Hd.teeth;
        if (teeth && D.teeth > 0) {
            const cnt = Math.max(3, Math.round(teeth.n * D.teeth));
            const t0 = mouth.t0 + 0.04;
            const t1 = tip - 0.015;
            const down = hu.clone().negate();
            for (let i = 0; i < cnt; i++) {
                const f = (i + 0.5) / cnt;
                const t = lerp(t0, t1, f);
                const isFang = teeth.fang && i === Math.round(cnt * 0.72);
                const sz = (0.65 + 0.5 * Math.sin(f * Math.PI) + (hash(i, 3, o.seed) - 0.5) * 0.3) * (isFang ? teeth.fang : 1);
                const len = teeth.len * sz;
                const rr = len * (teeth.thick ?? 0.26);
                const ln = lineAt(t);
                for (const s of [1, -1]) {
                    // dentes à mostra (répteis) ficam na borda do lábio; os demais nascem dentro da gengiva
                    const xo = headHalfW(t, ln) * (teeth.show ? 0.985 : 0.76);
                    const root = teeth.show ? 0.15 : 0.5;
                    mb.spike(headPt(t, ln + len * root, s * xo), down, len * (1 + root), rr, C.teeth, headW, { segs: 4, bend: teeth.show ? hf.clone().multiplyScalar(-0.4) : null });
                    if (i < cnt - 1) {
                        const t2 = lerp(t0, t1, (i + 1) / cnt);
                        const xi = headHalfW(t2, lineAt(t2)) * (mouth.inset ?? 0.94) * 0.86;
                        mb.spike(headPt(t2, lineAt(t2) - len * 0.5, s * xi), hu, len * 1.25, rr * 0.85, C.teeth, jawW, { segs: 4 });
                    }
                }
            }
        }
        sockDefs.push(['mouth', 'jaw', headPt(lerp(mouth.t0, tip, 0.8), lineAt(1) - 0.2 * profAt(0.9)[1])]);
    }
    sockDefs.push(['head', 'head', headPt(0.25, profAt(0.25)[0])]);

    // ---------- olhos e pálpebras ----------
    if (Hd.eye) {
        const E = Hd.eye;
        const fwd = E.fwd ?? 0.3;
        for (const s of [1, -1]) {
            const side = s > 0 ? 'L' : 'R';
            // normal aproximada da superfície do crânio no ponto do olho (seção superelíptica + afunilamento)
            const xs = headHalfW(E.t, E.up);
            const [pu_, , hw_, n_] = profAt(E.t);
            const nx = Math.pow(clamp(xs / hw_, 0.05, 1), n_ - 1) / hw_;
            const ny = Math.pow(clamp(E.up / pu_, 0, 1), n_ - 1) / pu_;
            const nf = -(headHalfW(E.t + 0.04, E.up) - headHalfW(E.t - 0.04, E.up)) / (0.08 * Hd.len) * nx;
            const nS = v3(s * nx, 0, 0).addScaledVector(hu, ny).addScaledVector(hf, nf).normalize();
            const pos = headPt(E.t, E.up, s * xs).addScaledVector(nS, -E.r * (E.inset ?? 0.68));
            const dir = nS.clone().addScaledVector(hf, fwd * 0.6).addScaledVector(hu, E.lift ?? 0.05).normalize();
            const up = hu.clone().addScaledVector(dir, -hu.dot(dir)).normalize();
            const x = xs;
            eyes.push({ pos, dir, up, r: E.r });
            addBone(`lid${side}`, 'head', pos);
            if (D.small) {
                const pc = paint('head', E.t, 1);
                const lidCol = (C.lid || pc.ct.clone().multiplyScalar(0.62));
                const q = new THREE.Quaternion();
                const mk = (pole, ang, bone, scale) => {
                    const g = new THREE.SphereGeometry(E.r * scale, 10, 5, 0, TAU, 0, ang);
                    q.setFromUnitVectors(AY, pole);
                    g.applyQuaternion(q);
                    g.translate(pos.x, pos.y, pos.z);
                    addGeo(g, lidCol, [bone]);
                };
                // calotas de 70°: o polo fica a θp do eixo do olhar; fechar = girar o polo até ~0,3 rad do olhar
                const open = E.open ?? 0.5;
                const thp = 1.22 + 0.2 + open * 0.36;
                const pole = dir.clone().multiplyScalar(Math.cos(thp)).addScaledVector(up, Math.sin(thp)).normalize();
                mk(pole, 1.22, bi[`lid${side}`], 1.13);
                const thl = 1.2 + (E.lower ?? 0.42);
                mk(dir.clone().multiplyScalar(Math.cos(thl)).addScaledVector(up, -Math.sin(thl)).normalize(), 1.2, bi.head, 1.11);
                E.axis = E.axis || {};
                E.axis[side] = v3().crossVectors(pole, dir).normalize();
                E.close = thp - 0.3;
            }
            // arco superciliar
            if (E.brow && D.small) {
                const bp = pos.clone().addScaledVector(up, E.r * 1.15).addScaledVector(nS, E.r * 0.25);
                mb.blob(bp, nS.clone().multiplyScalar(E.r * 0.8), up.clone().multiplyScalar(E.r * E.brow), hf.clone().multiplyScalar(E.r * 2.2),
                    paint('head', E.t, 1).ct, headW, { segs: 6, plain: false, v: (S_hd + E.t * Hd.len) / Lv });
            }
        }
    }
    function addGeo(g, color, w) {
        const p = g.attributes.position;
        const uvA = g.attributes.uv;
        const base = mb.count;
        for (let i = 0; i < p.count; i++) {
            mb.vert(p.getX(i), p.getY(i), p.getZ(i), color.r, color.g, color.b, 0, -10,
                uvA ? uvA.getX(i) * 2 : 0, uvA ? uvA.getY(i) * 2 : 0, w);
        }
        if (g.index) for (let i = 0; i < g.index.count; i++) mb.idx.push(base + g.index.getX(i));
        else for (let i = 0; i < p.count; i++) mb.idx.push(base + i);
        g.dispose();
    }

    // ---------- focinho, narinas ----------
    if (Hd.nose && D.small) {
        const r = Hd.nose.r;
        const [pu] = profAt(0.985);
        mb.blob(headPt(1 - (Hd.nose.back ?? 0.01), pu * (Hd.nose.up ?? 0.35)), v3(r * 1.15, 0, 0), hu.clone().multiplyScalar(r * 0.85),
            hf.clone().multiplyScalar(r * 0.9), C.nose, headW, { segs: 8 });
    }
    if (Hd.nostril && D.small) {
        const Nn = Hd.nostril;
        for (const s of [1, -1]) {
            const x = Nn.x ?? headHalfW(Nn.t, Nn.up) * 0.92;
            const c = headPt(Nn.t, Nn.up, s * x);
            const out = v3(s, 0, 0).addScaledVector(hf, 0.6).normalize();
            const side = v3().crossVectors(hu, out).normalize();
            mb.blob(c, side.multiplyScalar(Nn.r), hu.clone().multiplyScalar(Nn.r * 0.6), out.multiplyScalar(Nn.r * 0.5),
                C.nostril || C.mouth.clone().multiplyScalar(0.35), headW, { segs: 6 });
        }
    }

    // ---------- orelhas ----------
    if (Hd.ears) {
        const E = Hd.ears;
        for (const s of [1, -1]) {
            const side = s > 0 ? 'L' : 'R';
            const base = headPt(E.t, E.up, s * E.x);
            addBone(`ear${side}`, 'head', base);
            const d = v3(s * Math.sin(E.out ?? 0.3), 0, 0).addScaledVector(hu, Math.cos(E.out ?? 0.3) * Math.cos(E.back ?? 0.1))
                .addScaledVector(hf, -Math.sin(E.back ?? 0.1)).normalize();
            const facing = v3(s * (E.face ?? 0.5), 0, 0).addScaledVector(hf, 1).addScaledVector(d, 0).normalize();
            const shape = E.shape || 'point';
            const prof = shape === 'round' ? [[0, 0.75], [0.35, 1], [0.75, 0.9], [1, 0.45]]
                : shape === 'leaf' ? [[0, 0.5], [0.3, 0.95], [0.65, 1], [0.9, 0.6], [1, 0.12]]
                    : shape === 'long' ? [[0, 0.7], [0.25, 0.95], [0.6, 1], [0.88, 0.7], [1, 0.25]]
                        : [[0, 0.95], [0.3, 1], [0.65, 0.62], [0.9, 0.22], [1, 0.04]];
            const pts = [];
            const rad = [];
            const cts = [];
            const cbs = [];
            const earIn = C.earIn || C.belly;
            const earOut = C.ear || paint('head', 0.1, 1).ct;
            for (const [t, wk] of prof) {
                pts.push(base.clone().addScaledVector(d, (t - 0.12) * E.len).addScaledVector(facing, (E.cup ?? 0) * E.len * Math.sin(t * Math.PI)));
                rad.push([E.w * 0.5 * wk, E.w * 0.06 * (1 - t * 0.5), E.w * (E.thick ?? 0.36) * wk * (1 - t * 0.35)]);
                const tipK = C.earTip ? sstep(0.45, 0.8, t) : 0;
                cts.push(tipK ? earIn.clone().lerp(C.earTip, tipK) : earIn);
                cbs.push(tipK ? earOut.clone().lerp(C.earTip, tipK) : earOut);
            }
            mb.tube(pts, rad, facing, {
                ct: cts, cb: cbs, ce: 0.1, cw: 0.5, segs: D.segL, capStart: false, plain: false, n: 2.4,
                v0: 0.3, dens, w: (i) => (i === 0 ? [bi[`ear${side}`], 0.5, bi.head] : [bi[`ear${side}`]])
            });
        }
    }

    // ---------- chifres ----------
    const hornSeg = D.small ? 6 : 3;
    for (const h of Hd.horns || []) {
        for (const s of h.x === 0 ? [1] : [1, -1]) {
            const d0 = headDir(h.d0, s);
            const d1 = headDir(h.d1 || h.d0, s);
            const pts = [];
            const rad = [];
            const p = headPt(h.t, h.up, s * h.x).addScaledVector(d0, -h.r * 0.6);
            const d = v3();
            for (let i = 0; i <= hornSeg; i++) {
                const t = i / hornSeg;
                pts.push(p.clone());
                rad.push(h.r * (Math.pow(1 - t, h.taper ?? 0.8) * 0.97 + 0.03) * (h.flat ? 1 : 1));
                d.copy(d0).lerp(d1, t).normalize();
                p.addScaledVector(d, (h.len + h.r * 0.6) / hornSeg);
            }
            const col = h.color !== undefined ? new THREE.Color(h.color) : C.horn;
            const baseCol = h.skinBase ? paint('head', h.t, 1).ct : col.clone().multiplyScalar(0.7);
            mb.tube(pts, h.flat ? rad.map((r) => [r * h.flat, r]) : rad, hf, {
                ct: pts.map((_, i) => (i <= 1 ? baseCol : col)), segs: D.small ? 8 : 5, capStart: false, w: headW, dens: dens * 2
            });
            for (const tn of (D.small && h.tines) || []) {
                // galhada: pontas saindo do ramo principal
                const i0 = Math.round(tn[0] * hornSeg);
                const td = headDir(tn[2], s);
                mb.spike(pts[i0], td, h.len * tn[1], rad[i0] * 0.85, col, headW, { segs: 5, bend: hu.clone().multiplyScalar(0.5) });
            }
        }
    }

    // ---------- gola (Triceratops) ----------
    if (Hd.frill) {
        const F = Hd.frill;
        const fr = [];
        const colF = C.frill || C.base;
        const colR = C.frillRim || colF;
        const tilt = F.tilt ?? 0.9;
        const fb = hu.clone().multiplyScalar(Math.cos(tilt)).addScaledVector(hf, -Math.sin(tilt)).normalize(); // radial "para cima/trás"
        const fn_ = v3().crossVectors(AX, fb).normalize(); // normal do escudo
        const [pu0, pd0, hw0] = profAt(F.t);
        const base = headPt(F.t, 0);
        const st = [
            [0, hw0 * 0.9, pu0 * 0.9, 0], [0.25, F.w * 0.7, F.h * 0.62, 0.22], [0.6, F.w, F.h, 0.6], [0.8, F.w * 0.96, F.h * 0.97, 0.82],
            [0.92, F.w * 0.7, F.h * 0.72, 0.8], [1, hw0 * 0.6, pu0 * 0.7, 0.45]
        ];
        for (const [k, w, h, back] of st) {
            fr.push({
                c: base.clone().addScaledVector(fn_, -back * F.depth), a: AX, b: fb, ra: w, rb: h, rd: pd0 * 0.6, n: F.n ?? 2.6,
                ct: k > 0.5 && k < 0.85 ? colR : colF, cb: colF, ce: -0.2, lo: -pd0 * 0.35, w: headW,
                v: (S_hd + back) / Lv, v1: (S_hd + back * F.depth) * dens
            });
        }
        mb.loft(fr, D.segT, { capEnd: true, nu: nuBody });
        if (D.small && F.studs) {
            for (let i = 0; i < F.studs; i++) {
                const a = lerp(-1.25, 1.25, i / (F.studs - 1));
                const e = 2 / (F.n ?? 2.6);
                const sx = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), e) * F.w * 0.98;
                const sy = Math.pow(Math.abs(Math.cos(a)), e) * F.h * 0.98;
                const p = base.clone().addScaledVector(fn_, -0.7 * F.depth).addScaledVector(AX, sx).addScaledVector(fb, sy);
                const out = v3(sx, 0, 0).addScaledVector(fb, sy).normalize();
                mb.spike(p.addScaledVector(out, -F.stud * 0.3), out, F.stud, F.stud * 0.45, C.horn, headW, { segs: 5 });
            }
        }
    }

    // ---------- crista / barbela / crista de pterossauro ----------
    for (const cr of Hd.crests || []) {
        const pts = cr.pts.map((p) => headPt(p[0], p[1], 0));
        mb.tube(pts, cr.pts.map((p) => [cr.thick, p[2]]), hf, {
            ct: new THREE.Color(cr.color), segs: D.segL, w: headW, n: 2.2, plain: cr.plain !== false, dens: 0.01, nu: 0.02, aAxis: AX
        });
    }

    // ---------- membros ----------
    /** meia-largura do tronco em (z, y) — usada para embutir o topo dos membros */
    function torsoHalfW(z, y) {
        const r = ringAtZ(z, 'torso');
        const hh = y >= r.y ? r.hu : r.hd;
        const qn = clamp(Math.abs(y - r.y) / hh, 0, 0.98);
        return r.hw * Math.pow(1 - Math.pow(qn, r.n), 1 / r.n);
    }
    const legRecs = [];
    const armRecs = [];
    const buildLimb = (L, front, side) => {
        const sd = side > 0 ? 'L' : 'R';
        const names = front ? ['arm', 'fore', 'hand', 'fing'] : ['thigh', 'shin', 'foot', 'toe'];
        const parent = front ? 'chest' : 'hips';
        const r00 = Array.isArray(L.r[0]) ? L.r[0][0] : L.r[0];
        // o topo do membro fica embutido no tronco: só ~metade do raio lateral aparece
        const lx = L.arm ? L.x : Math.min(L.x, torsoHalfW(L.J[0][0], L.J[0][1]) - r00 * (L.embed ?? 0.45));
        const J = L.J.map((j) => v3(side * lx, j[1], j[0]));
        const nJ = J.length; // 5 (perna) ou 4 (braço curto)
        const b = [];
        for (let k = 0; k < nJ - 1; k++) b.push(addBone(names[k] + sd, k === 0 ? parent : names[k - 1] + sd, J[k]));
        const pIdx = bi[parent];
        const part = front ? 'legF' : 'legH';
        const yTop = J[0].y;
        const segN = nJ - 2; // segmentos torneados (o último é o pé)
        const rr = L.r.map((r) => (Array.isArray(r) ? r : [r, r]));
        const ringsL = [];
        const dirs = [];
        for (let k = 0; k < nJ - 1; k++) dirs.push(v3().subVectors(J[k + 1], J[k]).normalize());
        const uOff = (front ? 0.07 : 0.57) + (side > 0 ? 0 : 0.21);
        const limbCirc = TAU * (rr[1][0] + rr[1][1]) / 2;
        const nuL = Math.max(1, Math.round(limbCirc * dens));
        let len = 0;
        const mk = (c, t, ra, rf, rbk, w, tt) => {
            const a = AX;
            const bb = v3().crossVectors(t, a).normalize();
            const p = paint(part, tt, c.y);
            ringsL.push({
                c, a, b: bb, ra, rb: rf, rd: rbk, n: 2.15, ct: p.ct, cb: p.cb, ce: 0, cm: p.cm, cmk: p.cmk, side,
                dirt: p.dirt, w, v: 0.37 + len / Lv, v1: len * dens, u0: uOff, uS: clamp(limbCirc / circ, 0.12, 0.5), minY: 0.001
            });
        };
        // domo do topo (massa do ombro/garupa embutida no tronco)
        // calota elipsoidal: sobe pela escápula (dianteira) ou pela garupa (traseira). O topo é um
        // elipsoide gordo quase todo embutido no tronco — só ~28 % do raio lateral aflora, como músculo.
        const top = L.top ?? (front ? 0.7 : 0.6);
        const td = L.topDir ? v3(0, L.topDir[1], L.topDir[0]).normalize() : front ? v3(0, 0.9, -0.42).normalize() : dirs[0].clone().negate();
        const tdn = td.clone().negate();
        const raTop = rr[0][0];
        const xTop = L.arm ? lx : lx - rr[0][0] * 0.25;
        // a calota nunca passa da linha do dorso (fica 25 % do raio abaixo dela)
        let ext = rr[0][1] * top * 1.6;
        if (!L.arm && td.y > 0.05) {
            const rg = ringAtZ(L.J[0][0], 'torso');
            ext = Math.min(ext, Math.max(0, (rg.y + rg.hu * 0.6 - J[0].y) / td.y));
        }
        for (const [sK, k] of [[1.0, 0.2], [0.88, 0.5], [0.62, 0.8], [0.3, 0.96]]) {
            len = -ext * sK;
            mk(J[0].clone().addScaledVector(td, ext * sK).setX(side * xTop), tdn.clone().lerp(dirs[0], 1 - sK).normalize(),
                raTop * k, rr[0][1] * k, rr[0][1] * k, [pIdx, 0.55 + 0.3 * sK, b[0]], 0);
        }
        const tmp = v3();
        len = 0;
        for (let k = 0; k < segN; k++) {
            const bulge = (L.bulge && L.bulge[k]) || 1;
            const back = (L.back && L.back[k]) || 1; // músculo atrás (panturrilha, coxa)
            const steps = D.segL >= 12 ? 5 : D.segL >= 8 ? 3 : 2;
            for (let j = 0; j < steps; j++) {
                const t = j / steps;
                const c = J[k].clone().lerp(J[k + 1], t);
                const tg = tmp.copy(dirs[k]);
                let miter = 1;
                if (j === 0 && k > 0) {
                    tg.add(dirs[k - 1]).normalize();
                    miter = Math.min(1.35, 1 / Math.max(0.5, tg.dot(dirs[k])));
                }
                const bk = 1 + (bulge - 1) * Math.sin(Math.PI * Math.min(1, t * 1.25));
                let ra = lerp(rr[k][0], rr[k + 1][0], t) * bk;
                if (k === 0) {
                    const e = sstep(0, 1, t);
                    ra = lerp(raTop, rr[1][0], e) * bk;
                    c.x = side * lerp(xTop, lx, e);
                }
                const rb = lerp(rr[k][1], rr[k + 1][1], t) * bk * miter;
                let w;
                if (j === 0) w = k === 0 ? [b[0], 0.6, pIdx] : [b[k], 0.5, b[k - 1]];
                else if (t < 0.3 && k > 0) w = [b[k], 0.85, b[k - 1]];
                else if (t > 0.7 && k < nJ - 2) w = [b[k], 0.85, b[k + 1]];
                else w = [b[k]];
                mk(c, tg.clone(), ra, rb, rb * (1 + (back - 1) * Math.sin(Math.PI * Math.min(1, t * 1.3))), w, 1 - c.y / yTop);
                len += J[k].distanceTo(J[k + 1]) / steps;
            }
        }
        // anel final na última junta torneada
        {
            const k = segN;
            const tg = dirs[k - 1].clone().add(dirs[Math.min(k, dirs.length - 1)]).normalize();
            mk(J[k].clone(), tg, rr[k][0], rr[k][1], rr[k][1], [b[k], 0.5, b[k - 1]], 1 - J[k].y / yTop);
        }
        mb.loft(ringsL, D.segL, { capStart: true, capEnd: true, nu: nuL });
        // pé
        const footCol = paint(part, 1, 0).ct;
        buildFoot(L.foot || { type: 'paw' }, J[nJ - 2], J[nJ - 1], rr[nJ - 2], side, [b[nJ - 2]], footCol, front);
        const rec = { side, front, b, J, parent };
        if (L.arm) armRecs.push(rec);
        else legRecs.push(rec);
    };

    function buildFoot(F, j3, j4, r3, side, w, skinCol, front) {
        const type = F.type || 'paw';
        const L = Math.hypot(j4.z - j3.z, j4.x - j3.x) || 0.001;
        const fwd = v3(j4.x - j3.x, 0, j4.z - j3.z).normalize();
        const lat = v3().crossVectors(AY, fwd).normalize();
        const dirt = dirtK;
        const col = skinCol.clone().multiplyScalar(1 - dirt * 0.6);
        if (type === 'hoof') {
            const hc = C.hoof;
            const d = v3().subVectors(j4, j3);
            const dl = d.length();
            d.normalize();
            const bb = v3().crossVectors(d, AX).normalize();
            const mkR = (t, kx, kz, c, plain, x = 0, kx2 = 1) => ({
                c: j3.clone().addScaledVector(d, t * dl).addScaledVector(AX, x), a: AX, b: bb, ra: r3[0] * kx * kx2, rb: r3[1] * kz, n: 2.3,
                ct: c, cb: c, ce: 0, w, plain, minY: 0.001, v: 0.9, v1: t * dl * dens
            });
            mb.loft([mkR(0, 1, 1, col, false), mkR(0.35, 0.92, 0.92, col, false), mkR(0.62, 1.12, 1.12, col, false)], D.segL, { capStart: true, capEnd: true });
            const sp = F.cloven ? [-0.55, 0.55] : [0];
            const kx2 = F.cloven ? 0.56 : 1;
            for (const sx of sp) {
                const x = sx * r3[0];
                mb.loft([
                    mkR(0.56, 1.08, 1.1, hc, true, x, kx2), mkR(0.78, 1.16, 1.2, hc, true, x * 1.1, kx2),
                    mkR(1.0, 1.3, 1.36, hc, true, x * 1.2, kx2), mkR(1.14, 1.32, 1.38, hc, true, x * 1.2, kx2)
                ], D.segL, { capStart: true, capEnd: true });
            }
            return;
        }
        if (type === 'column') {
            // pé colunar (saurópode, ceratopsídeo, estegossauro): almofada + unhas
            const k = F.flare ?? 1.18;
            const c0 = j3.clone();
            const mkR = (y, kk, cc) => ({
                c: v3(c0.x + fwd.x * (1 - y / c0.y) * L * 0.25, y, c0.z + fwd.z * (1 - y / c0.y) * L * 0.25), a: AX, b: AZ,
                ra: r3[0] * kk, rb: r3[1] * kk * 1.1, rd: r3[1] * kk, n: 2.4, ct: cc, cb: cc, ce: 0, w, v: 0.9, v1: (c0.y - y) * dens, dirt: 0
            });
            mb.loft([mkR(c0.y, 1, col), mkR(c0.y * 0.45, k * 0.98, col), mkR(0.001, k, col.clone().multiplyScalar(0.8))], D.segL, { capEnd: true });
            if (D.toes) {
                const n = F.nails ?? 3;
                const nr = r3[0] * (F.nail ?? 0.3);
                for (let i = 0; i < n; i++) {
                    const a = lerp(-0.9, 0.9, n === 1 ? 0.5 : i / (n - 1)) + (side < 0 ? 0 : 0);
                    const out = fwd.clone().multiplyScalar(Math.cos(a)).addScaledVector(lat, Math.sin(a));
                    const p = v3(c0.x + fwd.x * L * 0.25, nr * 0.75, c0.z + fwd.z * L * 0.25).addScaledVector(out, r3[0] * k * 0.98);
                    mb.blob(p, v3().crossVectors(AY, out).multiplyScalar(nr * 0.8), v3(0, nr, 0), out.clone().multiplyScalar(nr * 1.1), C.claw, w, { segs: 6, minY: 0.001 });
                }
            }
            return;
        }
        if (type === 'claws') {
            // mão livre (braço de terópode): dedos em leque na direção do antebraço, com garras
            const d0 = v3().subVectors(j4, j3);
            const ll = d0.length();
            d0.normalize();
            const sideV = v3().crossVectors(d0, AY).normalize();
            const n = F.n ?? 2;
            const tr = r3[0] * 0.5;
            for (let i = 0; i < n; i++) {
                const a = (n === 1 ? 0 : i / (n - 1) - 0.5) * 0.8;
                const d = d0.clone().addScaledVector(sideV, a).normalize();
                const p1 = j3.clone().addScaledVector(d, ll * 0.6);
                mb.tube([j3.clone(), p1], [tr, tr * 0.7], AY, { ct: col, segs: 5, w, plain: false, capStart: false, dens });
                if (D.toes) mb.spike(p1, d, F.claw ?? ll * 0.6, tr * 0.6, C.claw, w, { segs: 4, bend: v3(0, -1, 0) });
            }
            return;
        }
        if (type === 'claw3') {
            // terópode/ave: 3 dedos para a frente + hálux
            const toes = F.toes || [-0.42, 0, 0.42];
            const tr = r3[0] * (F.toeR ?? 0.55);
            const cl = F.claw ?? L * 0.3;
            toes.forEach((a, i) => {
                const ang = a * side;
                const d = fwd.clone().multiplyScalar(Math.cos(ang)).addScaledVector(lat, Math.sin(ang));
                const ll = L * (i === 1 || toes.length === 1 ? 1 : 0.82);
                const p0 = j3.clone();
                const p1 = j3.clone().addScaledVector(d, ll * 0.45).setY(Math.max(tr * 1.15, j3.y * 0.45));
                const p2 = j3.clone().addScaledVector(d, ll * 0.8).setY(tr * 0.95);
                const p3 = j3.clone().addScaledVector(d, ll).setY(tr * 0.7);
                mb.tube([p0, p1, p2, p3], [[tr * 1.05, tr * 1.1], [tr, tr * 0.95], [tr * 0.92, tr * 0.85], [tr * 0.6, tr * 0.55]], AY, {
                    ct: col, segs: D.small ? 6 : 4, w, plain: false, minY: 0.001, v0: 0.95, dens, capStart: false
                });
                if (D.toes) mb.spike(p3.clone().setY(tr * 0.75), d.clone().setY(0.25).normalize(), cl, tr * 0.5, C.claw, w, { segs: 4, bend: v3(0, -1, 0) });
            });
            if (F.hallux !== false) {
                const d = fwd.clone().multiplyScalar(-0.8).addScaledVector(lat, -0.6 * side).normalize();
                const p0 = j3.clone().setY(Math.max(tr, j3.y * 0.7));
                const p1 = p0.clone().addScaledVector(d, L * 0.3).setY(tr * 0.7);
                mb.tube([p0, p1], [tr * 0.7, tr * 0.45], AY, { ct: col, segs: 4, w, plain: false, minY: 0.001, capStart: false });
                if (D.toes) mb.spike(p1, d.clone().setY(0.1).normalize(), cl * 0.6, tr * 0.35, C.claw, w, { segs: 4, bend: v3(0, -1, 0) });
            }
            if (F.web) {
                // membrana natatória (pato/ganso): leque fino entre os dedos
                const wc = C.beak || col;
                mb.blob(j3.clone().addScaledVector(fwd, L * 0.52).setY(tr * 0.35), lat.clone().multiplyScalar(L * 0.46), v3(0, tr * 0.3, 0),
                    fwd.clone().multiplyScalar(L * 0.5), wc, w, { segs: 8, minY: 0.001 });
            }
            return;
        }
        // pata / mão: almofada + dedos + garras
        const W = r3[0] * (F.w ?? 1.3);
        const Hh = Math.max(j3.y * 1.25, r3[1] * 0.9);
        const z0 = -r3[1] * (F.heel ?? 0.95);
        const ringsF = [];
        const ts = [0, 0.12, 0.35, 0.65, 0.88, 1];
        for (const t of ts) {
            const k = Math.pow(Math.sin(Math.PI * clamp(0.08 + t * 0.84)), 0.55);
            const hk = t < 0.5 ? 1 : lerp(1, 0.55, (t - 0.5) * 2);
            ringsF.push({
                c: j3.clone().addScaledVector(fwd, lerp(z0, L * (D.toes ? 0.82 : 1), t)).setY(Hh * 0.5 * hk), a: lat, b: AY,
                ra: W * k, rb: Hh * 0.55 * hk * k, n: 2.3, ct: col, cb: col, ce: 0, w, minY: 0.001, v: 0.92, v1: t * 0.5
            });
        }
        mb.loft(ringsF, D.segL, { capStart: true, capEnd: true });
        if (D.toes) {
            const n = F.toes ?? 4;
            const tw = (W * 2) / n;
            const fl = F.finger ?? 0;
            for (let i = 0; i < n; i++) {
                const xo = ((i + 0.5) / n - 0.5) * W * 1.75;
                const zk = 1 - Math.pow(Math.abs((i + 0.5) / n - 0.5) * 2, 2) * 0.3;
                const c = j3.clone().addScaledVector(fwd, L * (0.72 + fl * 0.3) * zk).addScaledVector(lat, xo).setY(tw * 0.42);
                mb.blob(c, lat.clone().multiplyScalar(tw * 0.5), v3(0, tw * 0.48, 0), fwd.clone().multiplyScalar(tw * (0.75 + fl * 2)), col, w, { segs: 6, minY: 0.001, plain: false, v: 0.95 });
                if (F.claws) {
                    mb.spike(c.clone().addScaledVector(fwd, tw * (0.6 + fl * 1.8)).setY(tw * 0.5), fwd.clone().setY(0.1).normalize(), F.claws, tw * 0.22, C.claw, w, { segs: 4, bend: v3(0, -1, 0) });
                }
            }
        }
    }

    if (legsSpec.front) for (const s of [1, -1]) buildLimb(legsSpec.front, true, s);
    for (const s of [1, -1]) buildLimb(legsSpec.hind, false, s);
    if (R.arms) for (const s of [1, -1]) buildLimb({ ...R.arms, arm: true }, true, s);

    // ---------- asas ----------
    const wingRecs = [];
    if (R.wings) {
        const Wg = R.wings;
        const featherCol = C.wing || C.base;
        const tipCol = C.wingTip || featherCol;
        const under = C.wingUnder || C.belly;
        for (const s of [1, -1]) {
            const sd = s > 0 ? 'L' : 'R';
            const root = v3(s * Wg.x, Wg.root[1], Wg.root[0]);
            const fr = Wg.seg || [0.3, 0.33, 0.37];
            const xs = [0, fr[0], fr[0] + fr[1], 1].map((f) => f * Wg.span);
            const b = [];
            for (let k = 0; k < 3; k++) {
                b.push(addBone(`wing${sd}${k + 1}`, k === 0 ? 'chest' : `wing${sd}${k}`, v3(root.x + s * xs[k], root.y, root.z + (Wg.sweep ? Wg.sweep[k] : 0))));
            }
            const N = D.small ? 14 : 7;
            const wr = [];
            const at = (arr, f) => {
                // interpola perfil [raiz, cotovelo, punho, ponta] por fração de envergadura
                const q = f * Wg.span;
                let k = 0;
                while (k < 2 && xs[k + 1] < q) k++;
                const t = clamp((q - xs[k]) / (xs[k + 1] - xs[k]));
                return lerp(arr[k], arr[k + 1], t);
            };
            const wOf = (q) => {
                let k = 0;
                while (k < 2 && xs[k + 1] <= q) k++;
                const t = (q - xs[k]) / (xs[k + 1] - xs[k]);
                if (k === 0 && t < 0.25) return [b[0], 0.5 + 2 * t, bi.chest];
                if (t < 0.2 && k > 0) return [b[k], 0.5 + 2.5 * t, b[k - 1]];
                if (t > 0.8 && k < 2) return [b[k], 0.5 + 2.5 * (1 - t), b[k + 1]];
                return [b[k]];
            };
            const sweep = Wg.sweep || [0, 0, 0, 0];
            for (let i = 0; i <= N; i++) {
                const f = i / N;
                let chord = at(Wg.chord, f);
                if (Wg.type === 'feather') chord *= 1 + 0.06 * Math.sin(f * 40) * (f > 0.4 ? 1 : 0.3);
                if (i === N) chord *= 0.5;
                const le = at(sweep, f);
                const th = Math.max(chord * (Wg.thick ?? 0.05), 0.002);
                const k = sstep(0.55, 1, f);
                wr.push({
                    c: v3(root.x + s * f * Wg.span, root.y + (Wg.droop || 0) * f * f, root.z + le - chord / 2), a: AZ, b: AY,
                    ra: chord / 2, rb: th, n: 2, ct: featherCol.clone().lerp(tipCol, k), cb: under.clone().lerp(tipCol, k * 0.6), ce: 0, cw: 0.15,
                    w: wOf(f * Wg.span), v: f * Wg.span / Lv, v1: f * Wg.span * dens, u0: 0.2, uS: 0.6, plain: !!Wg.plain
                });
            }
            mb.loft(wr, D.small ? 10 : 6, { capStart: true, capEnd: true, nu: Math.max(1, Math.round(2 * Wg.chord[1] * dens)), swap: true });
            if (Wg.arm) {
                // braço na borda de ataque (asas de membrana)
                const pts = [];
                const rad = [];
                for (let i = 0; i <= 8; i++) {
                    const f = i / 8;
                    pts.push(v3(root.x + s * f * Wg.span, root.y + (Wg.droop || 0) * f * f, root.z + at(sweep, f) - Wg.arm * 0.4));
                    rad.push(Wg.arm * lerp(1, 0.25, Math.pow(f, 0.7)));
                }
                mb.tube(pts, rad, AY, { ct: C.base, cb: C.belly, segs: 6, plain: false, w: (i) => wOf((i / 8) * Wg.span), dens, v0: 0.3 });
                if (Wg.fingers && D.small) {
                    const p = v3(root.x + s * xs[2], root.y, root.z + sweep[2]);
                    for (let i = 0; i < 3; i++) {
                        mb.spike(p, v3(s * (0.3 + i * 0.25), -0.1, 0.9 - i * 0.2).normalize(), Wg.arm * 2.6, Wg.arm * 0.35, C.claw, [b[2]], { segs: 4, bend: v3(0, -1, 0) });
                    }
                }
            }
            wingRecs.push({ side: s, b });
        }
    }

    // ---------- extras ao longo do dorso ----------
    const dorsal = (part, t0, t1, cnt, fn) => {
        const rs = rings.filter((r) => r.part === part && r.pt >= t0 - 1e-6 && r.pt <= t1 + 1e-6);
        if (!rs.length) return;
        const S0 = rs[0].S;
        const S1 = rs[rs.length - 1].S;
        for (let i = 0; i < cnt; i++) {
            const f = cnt === 1 ? 0.5 : i / (cnt - 1);
            const r = ringAtS(lerp(S0, S1, f));
            const up = v3(0, r.tz, -r.ty);
            const tg = v3(0, r.ty, r.tz);
            fn(v3(0, r.y, r.z).addScaledVector(up, r.hu), up, tg, r, f, i, axisW(r.S));
        }
    };
    if (X.mane) {
        // crina: mechas achatadas caindo para um lado do pescoço
        const M = X.mane;
        const mc = C.mane || C.back || C.base;
        const cnt = D.small ? M.n ?? 14 : Math.ceil((M.n ?? 14) / 2);
        dorsal('neck', M.t0 ?? 0, M.t1 ?? 1, cnt, (p, up, tg, r, f, i, w) => {
            const side = M.side ?? 1;
            const len = M.len * (0.8 + 0.4 * Math.sin(f * Math.PI)) * (0.85 + 0.3 * hash(i, 1, o.seed));
            const wd = M.w ?? len * 0.42;
            // a mecha nasce na crista e escorre pela lateral, colada à superfície do anel
            const at = (dk, lift) => {
                const dd = Math.min(dk * len, r.hu * 1.6);
                const yy = r.hu - dd;
                const hwv = r.hw * Math.pow(Math.max(0, 1 - Math.pow(clamp(Math.abs(yy) / r.hu, 0, 1), r.n)), 1 / r.n);
                return p.clone().addScaledVector(up, -dd).addScaledVector(AX, side * (hwv + lift)).addScaledVector(tg, -dk * len * 0.3);
            };
            mb.tube([at(-0.06, 0), at(0.12, wd * 0.2), at(0.5, wd * 0.16), at(0.85, wd * 0.1), at(1, wd * 0.04)],
                [[wd, wd * 0.2], [wd * 1.05, wd * 0.2], [wd * 0.95, wd * 0.16], [wd * 0.6, wd * 0.1], [wd * 0.15, wd * 0.03]], AX, {
                    ct: mc, segs: D.small ? 6 : 4, w, plain: false, v0: f, dens, n: 2.2, capStart: true
                });
        });
        if (M.forelock) {
            const p = headPt(0.02, profAt(0.02)[0]);
            mb.tube([p, headPt(0.1, profAt(0.1)[0] + M.len * 0.06), headPt(0.24, profAt(0.24)[0] + 0.004)], [[M.len * 0.22, M.len * 0.1], [M.len * 0.2, M.len * 0.07], [M.len * 0.05, M.len * 0.02]], hu, {
                ct: mc, segs: 6, w: headW, plain: false, dens, capStart: false
            });
        }
    }
    if (X.plates) {
        // placas dorsais (Stegosaurus): losangos alternados em duas fileiras
        const Pl = X.plates;
        const pc = C.plate || C.back || C.base;
        const pt = C.plateTip || pc;
        const run = (part, t0, t1, n, s0, s1, i0) => dorsal(part, t0, t1, n, (p, up, tg, r, f, i, w) => {
            const sz = lerp(s0, s1, Math.sin(f * Math.PI)) * Pl.size;
            const sd = (i + i0) % 2 ? 1 : -1;
            const d = up.clone().addScaledVector(AX, sd * 0.28).normalize();
            const base = p.clone().addScaledVector(AX, sd * r.hw * 0.22).addScaledVector(up, -sz * 0.12);
            mb.tube([base, base.clone().addScaledVector(d, sz * 0.4), base.clone().addScaledVector(d, sz * 0.8), base.clone().addScaledVector(d, sz)],
                [[sz * 0.07, sz * 0.3], [sz * 0.06, sz * 0.46], [sz * 0.035, sz * 0.26], [sz * 0.012, sz * 0.03]], tg, {
                    ct: [pc, pc, pt, pt], segs: D.small ? 8 : 4, w, plain: false, n: 2, v0: f, dens, capStart: false
                });
        });
        run('neck', 0.2, 1, Pl.neck ?? 3, 0.3, 0.45, 0);
        run('torso', 0.02, 1, Pl.torso ?? 7, 0.7, 1, 1);
        run('tail', 0.42, 0.98, Pl.tail ?? 5, 0.25, 0.75, 0);
    }
    if (X.spikes) {
        // espigões da cauda (thagomizer)
        const Sp = X.spikes;
        dorsal('tail', Sp.t0, Sp.t1, Sp.n ?? 2, (p, up, tg, r, f, i, w) => {
            for (const s of [1, -1]) {
                const d = v3(s * 0.85, 0, 0).addScaledVector(up, 0.45).addScaledVector(tg, -0.25).normalize();
                mb.spike(p.clone().addScaledVector(up, -r.hu * 0.5).addScaledVector(AX, s * r.hw * 0.5), d, Sp.len, Sp.len * 0.075, C.horn, w, { segs: 6 });
            }
        });
    }
    if (X.ridge) {
        // fileira de escudos/espinhos baixos ao longo do dorso (terópodes, dragão)
        const Rg = X.ridge;
        for (const [part, t0, t1, n] of Rg.runs) {
            dorsal(part, t0, t1, D.small ? n : Math.ceil(n / 2), (p, up, tg, r, f, i, w) => {
                const sz = Rg.size * (0.6 + 0.4 * Math.sin(f * Math.PI)) * clamp(r.hu / Rg.ref, 0.25, 1.2);
                mb.spike(p.clone().addScaledVector(up, -sz * 0.25), up.clone().addScaledVector(tg, -(Rg.rake ?? 0.5)).normalize(), sz, sz * 0.14, C.ridge || C.back || C.base, w,
                    { segs: 4, rb: sz * 0.34, up: tg });
            });
        }
    }
    if (X.spines && D.small) {
        // espinhos (ouriço): cones sobre o arco dorsal dos anéis do tronco
        const Sp = X.spines;
        const rs = rings.filter((r) => (r.part === 'torso' || (r.part === 'neck' && Sp.neck)) && r.pt >= (Sp.t0 ?? 0));
        const per = D.segT >= 24 ? Sp.per ?? 13 : Math.ceil((Sp.per ?? 13) * 0.6);
        const step = D.segT >= 24 ? 2 : 2;
        const cA = C.spine || C.back || C.base;
        const cB = C.spineTip || cA;
        for (let ri = 0; ri < rs.length; ri += step) {
            const r = rs[ri];
            const up = v3(0, r.tz, -r.ty);
            const tg = v3(0, r.ty, r.tz);
            const w = axisW(r.S);
            const e = 2 / r.n;
            for (let k = 0; k < per; k++) {
                const a = lerp(-Sp.arc, Sp.arc, (k + (ri % 2) * 0.5) / per) + (hash(ri, k, 5) - 0.5) * 0.12;
                const sx = Math.sign(Math.sin(a)) * Math.pow(Math.abs(Math.sin(a)), e);
                const sy = Math.sign(Math.cos(a)) * Math.pow(Math.abs(Math.cos(a)), e);
                const p = v3(sx * r.hw, r.y, r.z).addScaledVector(up, sy * (sy > 0 ? r.hu : r.hd));
                const out = v3(Math.sin(a), 0, 0).addScaledVector(up, Math.cos(a)).addScaledVector(tg, -0.55 + (hash(k, ri, 9) - 0.5) * 0.3).normalize();
                const len = Sp.len * (0.8 + 0.4 * hash(ri, k, 2));
                const q = p.clone().addScaledVector(out, len);
                const b0 = mb.count;
                const side = v3().crossVectors(out, tg).normalize().multiplyScalar(len * 0.07);
                const tgs = tg.clone().multiplyScalar(len * 0.07);
                mb.vert(p.x + side.x, p.y + side.y, p.z + side.z, cA.r, cA.g, cA.b, 0, -10, 0, 0, w);
                mb.vert(p.x - side.x * 0.5 + tgs.x, p.y - side.y * 0.5 + tgs.y, p.z - side.z * 0.5 + tgs.z, cA.r, cA.g, cA.b, 0, -10, 0.3, 0, w);
                mb.vert(p.x - side.x * 0.5 - tgs.x, p.y - side.y * 0.5 - tgs.y, p.z - side.z * 0.5 - tgs.z, cA.r, cA.g, cA.b, 0, -10, 0.6, 0, w);
                mb.vert(q.x, q.y, q.z, cB.r, cB.g, cB.b, 0, -10, 0.3, 1, w);
                mb.idx.push(b0, b0 + 1, b0 + 3, b0 + 1, b0 + 2, b0 + 3, b0 + 2, b0, b0 + 3);
            }
        }
    }
    if (X.udder && D.small && R.age > 0.6) {
        const U = X.udder;
        const r = ringAtZ(U.z, 'torso');
        const c = v3(0, r.y - r.hd - U.r * 0.25, r.z);
        const uc = C.udder || C.muzzle || C.belly;
        mb.blob(c, v3(U.r * 0.95, 0, 0), v3(0, U.r * 0.85, 0), v3(0, 0, U.r * 1.25), uc, [bi.hips], { segs: 10 });
        for (const sx of [1, -1]) for (const sz of [1, -1]) {
            mb.spike(c.clone().add(v3(sx * U.r * 0.42, -U.r * 0.6, sz * U.r * 0.55)), v3(0, -1, 0), U.r * 0.55, U.r * 0.13, uc, [bi.hips], { segs: 5 });
        }
    }
    {
        // sela (opcional) e soquete do dorso
        const zs = X.saddleZ ?? lerp(hipZ, shZ, quad ? 0.6 : 0.3);
        const r = ringAtZ(zs, 'torso');
        sockDefs.push(['back', 'spine', v3(0, r.y + r.hu, r.z)]);
        if (o.saddle && quad) {
            const lc = new THREE.Color(X.saddleColor ?? 0x4a2c18);
            const span = (shZ - hipZ) * 0.38;
            const sr = [];
            const NS = 6;
            for (let i = 0; i <= NS; i++) {
                const f = i / NS;
                const q = ringAtZ(zs - span / 2 + span * f, 'torso');
                const lip = 0.012 + 0.03 * Math.pow(Math.abs(f - 0.5) * 2, 3) * (f > 0.5 ? 1.3 : 1.8);
                const k = i === 0 || i === NS ? 0.9 : 1;
                sr.push({
                    c: v3(0, q.y + lip * (r.hu / 0.3), q.z), a: AX, b: AY, ra: (q.hw + 0.012 * (r.hu / 0.3)) * k, rb: q.hu + 0.008 * (r.hu / 0.3), n: q.n,
                    lo: -q.hd * 0.15, ct: lc, cb: lc.clone().multiplyScalar(0.7), ce: -0.4, w: axisW(q.S), plain: true, v1: f * span * dens * 2
                });
            }
            mb.loft(sr, D.segT, { capStart: true, capEnd: true, nu: nuBody });
            // cilha
            const q = ringAtZ(zs + span * 0.1, 'torso');
            const strap = (dz) => ({
                c: v3(0, q.y, q.z + dz), a: AX, b: AY, ra: q.hw + 0.006 * (r.hu / 0.3), rb: q.hu + 0.004, rd: q.hd + 0.006 * (r.hu / 0.3), n: q.n, pear: q.pear,
                ct: lc, cb: lc, ce: 0, w: axisW(q.S), plain: true, v1: 0
            });
            mb.loft([strap(-span * 0.07), strap(span * 0.07)], D.segT, { nu: 1 });
        }
    }
    if (tailBones) sockDefs.push(['tailTip', `tail${tailBones}`, axisPt(0)]);

    // ---------- geometria + esqueleto ----------
    // recentraliza em z: meio dos apoios
    const feet = legRecs.map((l) => l.J[l.J.length - 2].z);
    const zc = feet.reduce((a, b) => a + b, 0) / feet.length;
    for (let i = 2; i < mb.pos.length; i += 3) mb.pos[i] -= zc;
    for (const b of BN) b[4] -= zc;
    for (const l of [...legRecs, ...armRecs]) for (const j of l.J) j.z -= zc;
    for (const e of eyes) e.pos.z -= zc;
    for (const s of sockDefs) s[2].z -= zc;
    const geometry = mb.build();
    geometry.computeBoundingBox();
    const bb = geometry.boundingBox;

    const bones = BN.map(([name]) => {
        const b = new THREE.Bone();
        b.name = name;
        return b;
    });
    BN.forEach(([, parent, x, y, z], i) => {
        if (parent < 0) bones[i].position.set(x, y, z);
        else {
            const p = BN[parent];
            bones[i].position.set(x - p[2], y - p[3], z - p[4]);
            bones[parent].add(bones[i]);
        }
    });
    const named = Object.fromEntries(bones.map((b) => [b.name, b]));
    const pat = { ...(R.skin.pattern || { kind: 'plain' }), ...(o.pattern || {}) };
    const material = bodyMaterial(R.skin, pat, pat.kind && pat.kind !== 'plain' ? (o.seed | 0) % 6 : 0);
    const mesh = new THREE.SkinnedMesh(geometry, material);
    mesh.add(bones[0]);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = `gfxCreature:${spec.label || 'custom'}`;
    const sizeJ = 1 + (o.seed === 1 ? 0 : (rnd() - 0.5) * 0.06);
    const S = o.scale * R.sizeK * sizeJ;
    mesh.scale.setScalar(S);
    const wingspan = R.wings ? (R.wings.span + R.wings.x) * 2 : 0;
    const ctr = bb.getCenter(v3());
    const radius = Math.max(bb.max.z - bb.min.z, bb.max.y - bb.min.y, wingspan) * 0.62 + (bb.max.y - bb.min.y) * 0.3;
    mesh.boundingSphere = new THREE.Sphere(ctr.clone(), radius);
    geometry.boundingSphere = mesh.boundingSphere.clone();
    mesh.boundingBox = new THREE.Box3(v3(ctr.x - radius, ctr.y - radius, ctr.z - radius), v3(ctr.x + radius, ctr.y + radius, ctr.z + radius));

    // olhos: malha rígida presa ao osso da cabeça
    let eyeMesh = null;
    if (eyes.length) {
        const parts = [];
        const hr = v3(BN[bi.head][2], BN[bi.head][3], BN[bi.head][4]);
        const m4 = new THREE.Matrix4();
        const xa = v3();
        for (const e of eyes) {
            const g = new THREE.SphereGeometry(e.r, D.small ? 16 : 8, D.small ? 10 : 6);
            g.rotateX(HALF_PI); // polo (centro da íris) → +Z
            xa.crossVectors(e.up, e.dir).normalize();
            m4.makeBasis(xa, e.up, e.dir).setPosition(e.pos.x - hr.x, e.pos.y - hr.y, e.pos.z - hr.z);
            g.applyMatrix4(m4);
            parts.push(g);
        }
        const eg = mergeSimple(parts);
        eyeMesh = new THREE.Mesh(eg, eyeMaterial(coat.iris ?? DEF_COAT.iris, coat.pupil ?? 'round', coat.sclera ?? DEF_COAT.sclera));
        eyeMesh.name = 'gfxCreatureEyes';
        eyeMesh.castShadow = false;
        named.head.add(eyeMesh);
    }
    for (const [name, bone, p] of sockDefs) {
        const s = new THREE.Object3D();
        s.name = `socket:${name}`;
        const bp = BN[bi[bone]];
        s.position.set(p.x - bp[2], p.y - bp[3], p.z - bp[4]);
        named[bone].add(s);
        sockets[name] = s;
    }
    sockets.saddle = sockets.back;

    const object = new THREE.Group();
    object.name = `creature:${spec.label || 'custom'}`;
    object.add(mesh);

    // ---------- dados de rig para a animação ----------
    const rest = (name) => v3(BN[bi[name]][2], BN[bi[name]][3], BN[bi[name]][4]);
    const ang = (a, b) => Math.atan2(b.z - a.z, -(b.y - a.y)); // ângulo a partir de "para baixo", + para a frente
    const legs = legRecs.map((l) => {
        const J = l.J;
        const b = l.b.map((i) => bones[i]);
        b[0].rotation.order = 'ZXY';
        const a1r = ang(J[0], J[1]);
        const a2r = ang(J[1], J[2]);
        const a3r = ang(J[2], J[3]);
        const a4r = ang(J[3], J[4]);
        const bH = ang(J[0], J[2]);
        let bend = Math.sign(a1r - bH);
        if (Math.abs(a1r - bH) < 0.04) bend = l.front ? -1 : 1;
        const L3 = Math.hypot(J[3].z - J[2].z, J[3].y - J[2].y);
        const planti = a3r > 1.0; // metatarso deitado no chão
        return {
            side: l.side, front: l.front, b, parent: named[l.parent], J0: J[0].clone(), P0: J[3].clone(),
            L1: Math.hypot(J[1].z - J[0].z, J[1].y - J[0].y), L2: Math.hypot(J[2].z - J[1].z, J[2].y - J[1].y), L3,
            a1r, a2r, a3r, a4r, bend, bPr: ang(J[0], J[3]), planti, len: J[0].y,
            kf: l.front ? (G.kfF ?? 0.35) : (G.kfH ?? 0.5), foldK: l.front ? (G.foldF ?? 0.95) : (G.foldH ?? 0.35),
            g: 0, x: 0, y: 0, z: 0, fold: 0, a3: NaN, rel: false, air: false, toeFollow: 0
        };
    });
    const hind = legs.filter((l) => !l.front);
    const fore = legs.filter((l) => l.front);
    const legLen = hind[0].len;
    const hipsR = rest('hips');
    const chestR = rest('chest');
    const neckR = rest('neck1');
    const snout = headPt(1).setZ(headPt(1).z - zc);
    const headR0 = rest('head');
    const bellyMin = R.torsoC ? Math.min(...R.torso.map((s) => s[1] - (s[6] ?? s[3]))) : Math.min(...R.torso.map((s) => s[2]));
    const rig = {
        quad, legs, hind, fore, legLen,
        hips: named.hips, spine: named.spine, chest: named.chest, head: named.head, jaw: named.jaw,
        neck: Array.from({ length: neckBones }, (_, i) => named[`neck${i + 1}`]),
        tail: Array.from({ length: tailBones }, (_, i) => named[`tail${i + 1}`]),
        ears: [named.earL, named.earR].filter(Boolean),
        lids: Hd.eye && Hd.eye.axis ? [[named.lidL, Hd.eye.axis.L], [named.lidR, Hd.eye.axis.R]] : [], lidClose: Hd.eye ? Hd.eye.close || 1 : 1,
        arms: armRecs.map((l) => ({ side: l.side, b: l.b.map((i) => bones[i]) })),
        wings: wingRecs.map((w) => ({ side: w.side, b: w.b.map((i) => bones[i]) })),
        hipsR, bodyLen: Math.hypot(chestR.z - hipsR.z, chestR.y - hipsR.y) || 0.1,
        // alcance do focinho a partir da base do pescoço (para comer/beber)
        nR: Math.hypot(snout.z - neckR.z, snout.y - neckR.y), nA: Math.atan2(snout.y - neckR.y, snout.z - neckR.z),
        nL: Math.hypot(neckR.z - hipsR.z, neckR.y - hipsR.y), nG: Math.atan2(neckR.y - hipsR.y, neckR.z - hipsR.z), nY: neckR.y,
        nLn: Math.hypot(headR0.z - neckR.z, headR0.y - neckR.y), nA1: Math.atan2(headR0.y - neckR.y, headR0.z - neckR.z),
        nLh: Math.hypot(snout.z - headR0.z, snout.y - headR0.y), nA2: Math.atan2(snout.y - headR0.y, snout.z - headR0.z),
        headR: rest('head'), belly: bellyMin, G, gape: (mouth && mouth.gape) ?? 0.6,
        wing: R.wings ? { cosmetic: !!R.wings.cosmetic, foldC: R.wings.foldC ?? 0.72, foldK: R.wings.foldK ?? 0.42, sweep: R.wings.foldSweep ?? 1.45, roll: R.wings.foldRoll ?? 1.45, amp: R.wings.amp ?? 0.9 } : null,
        flapHz: R.wings ? clamp(2.2 * Math.pow(wingspan * S, -0.6), 0.7, 9) : 0,
        tailRest: tailSpec ? tailSpec.a0 : 0, tailWag: (tailSpec && tailSpec.wag) ?? 0.5,
        seedPh: rnd() * 10, blinkAt: 1 + rnd() * 3, rnd
    };
    // andaduras: S = alcance do apoio, D = fração de apoio, T = k·√(L/g)
    const Tn = Math.sqrt(legLen / 9.81);
    const gk = G.strideK ?? 1;
    const mkGait = (S_, D_, k, off, lift) => ({ stride: S_ * legLen * gk, duty: D_, period: k * Tn, off, lift: lift * legLen, speed: 0 });
    let gaits;
    if (quad) {
        const gal = G.gallop === 'rotary' ? [0.6, 0.5, 0, 0.1] : G.gallop === 'bound' ? [0.5, 0.56, 0, 0.05] : [0.45, 0.57, 0, 0.12];
        // ordem das pernas no rig: DE, DD, TE, TD
        gaits = {
            walk: G.hopWalk ? mkGait(0.7, 0.5, 2.2, [0.5, 0.56, 0, 0.05], 0.16) : mkGait(0.82, 0.64, 2.95, [0.25, 0.75, 0, 0.5], 0.1),
            trot: mkGait(1.05, 0.46, 1.85, [0, 0.5, 0.5, 0], 0.16),
            // animais muito pesados não galopam: "corrida" = passo acelerado (amble), sem fase aérea
            run: G.amble ? mkGait(G.runStride ?? 1.0, 0.52, 2.1, [0.25, 0.75, 0, 0.5], 0.12) : mkGait(G.runStride ?? 1.45, 0.3, 1.25, gal, 0.24)
        };
    } else {
        const hop = G.hop ? [0, 0.06] : [0, 0.5];
        gaits = {
            walk: mkGait(0.85, G.hop ? 0.4 : 0.62, G.hop ? 1.6 : 2.95, hop, G.hop ? 0.25 : 0.14),
            trot: mkGait(1.1, 0.5, 2.1, hop, 0.2),
            run: mkGait(G.runStride ?? 1.5, G.runDuty ?? 0.36, G.runK ?? 1.5, [0, 0.5], 0.28)
        };
    }
    for (const g of Object.values(gaits)) g.speed = (g.stride / (g.duty * g.period)) * S;

    const modes = ['idle', 'walk', 'trot', 'run', 'eat', 'drink', 'sit', 'sleep', 'roar', 'attack', 'alert', 'swim'];
    if (R.wings && !R.wings.cosmetic) modes.push('fly', 'glide', 'flap');
    const nb = bones.length;
    const creature = {
        object, mesh, eyes: eyeMesh, bones: named, sockets,
        length: (bb.max.z - bb.min.z) * S, height: bb.max.y * S,
        hipHeight: legLen * S, shoulderHeight: (fore[0] ? fore[0].len : legLen) * S, wingspan: wingspan * S,
        withersHeight: (() => { const q = ringAtZ(shZ, 'torso'); return (q.y + q.hu) * S; })(),
        gaits, modes, triangles: mb.idx.length / 3 + (eyeMesh ? eyeMesh.geometry.index.count / 3 : 0),
        label: spec.label || 'custom', scale: S, rig,
        state: {
            mode: 'idle', phase: rnd() * TAU, time: rnd() * 20, blend: 1, blink: 0, lookYaw: 0, lookPitch: 0, lookW: 0, amount: 1,
            snap: new Float32Array(nb * 4), snapP: new Float32Array(6), snapS: new Float32Array(2)
        },
        update(dt, s = EMPTY) {
            updateCreature(creature, dt, s);
        },
        dispose() {
            geometry.dispose();
            if (eyeMesh) eyeMesh.geometry.dispose();
            mesh.skeleton.dispose();
        }
    };
    poseCreature(creature, 'idle', 0);
    return creature;
}

function mergeSimple(geos) {
    const pos = [];
    const nrm = [];
    const uv = [];
    const idx = [];
    let base = 0;
    for (const g of geos) {
        pos.push(...g.attributes.position.array);
        g.computeVertexNormals();
        nrm.push(...g.attributes.normal.array);
        uv.push(...g.attributes.uv.array);
        for (let i = 0; i < g.index.count; i++) idx.push(base + g.index.getX(i));
        base += g.attributes.position.count;
        g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setIndex(idx);
    return out;
}

// ─────────────────────────────── animação ────────────────────────────────────
const EMPTY = Object.freeze({});
export const CREATURE_MODES = ['idle', 'walk', 'trot', 'run', 'eat', 'drink', 'sit', 'sleep', 'roar', 'attack', 'alert', 'fly', 'glide', 'flap', 'swim'];
const ALIAS = { gallop: 'run', graze: 'eat', pastar: 'eat', bite: 'attack', lie: 'sleep', stand: 'idle', hover: 'flap', soar: 'glide' };

const _mH = new THREE.Matrix4();
const _mS = new THREE.Matrix4();
const _mC = new THREE.Matrix4();
const _inv = new THREE.Matrix4();
const _p = v3();
const _d = v3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
// canais da pose (reutilizados)
const ch = {
    hx: 0, hy: 0, hz: 0, pitch: 0, roll: 0, yaw: 0, spineP: 0, chestP: 0, spineY: 0,
    neckP: 0, neckY: 0, headP: 0, headY: 0, headR: 0, jaw: 0, tailP: 0, tailCurl: 0, tailYaw: 0, tailWave: 0, tailLag: 0.6,
    ear: 0, earFlick: 0, lid: 0, wingFold: 1, flap: 0, flap2: 0, flap3: 0, breath: 0, arm: 0, reach: 0, look: 1
};

/**
 * IK analítico da perna no plano sagital do osso-pai.
 * Ângulos medidos a partir de "para baixo", positivos para a frente.
 *   H (jarrete/punho) = P − L3·(sin a3, −cos a3)
 *   cos A = (L1² + d² − L2²) / (2·L1·d),  a1 = β ± A  (+ joelho p/ frente, − cotovelo p/ trás)
 */
function solveLeg(leg, M, tx, ty, tz, a3w, a4w) {
    _inv.copy(M).invert();
    _p.set(tx, ty, tz).applyMatrix4(_inv);
    const ub = leg.b[0];
    const dx = _p.x - ub.position.x;
    const dy = _p.y - ub.position.y;
    const dz = _p.z - ub.position.z;
    _d.set(0, -Math.cos(a3w), Math.sin(a3w)).transformDirection(_inv);
    let a3 = Math.atan2(_d.z, -_d.y);
    _d.set(0, -Math.cos(a4w), Math.sin(a4w)).transformDirection(_inv);
    const a4 = Math.atan2(_d.z, -_d.y);
    const rho = clamp(Math.atan2(dx, Math.max(1e-4, -dy)), -0.7, 0.7);
    const py = dy > 0 ? Math.hypot(dx, dy) : -Math.hypot(dx, dy);
    const bP = Math.atan2(dz, -py);
    if (!leg.relNow) {
        const dB = bP - leg.bPr;
        a3 += leg.kf * (leg.planti ? Math.min(0, dB) * 1.6 : dB);
    }
    let hz = dz - leg.L3 * Math.sin(a3);
    let hy = py + leg.L3 * Math.cos(a3);
    let d = Math.hypot(hz, hy);
    const dmax = (leg.L1 + leg.L2) * 0.9985;
    const dmin = Math.abs(leg.L1 - leg.L2) + 1e-3;
    if (d > dmax || d < dmin) {
        const k = clamp(d, dmin, dmax) / (d || 1);
        hz *= k;
        hy *= k;
        d *= k;
    }
    const beta = Math.atan2(hz, -hy);
    const A = Math.acos(clamp((leg.L1 * leg.L1 + d * d - leg.L2 * leg.L2) / (2 * leg.L1 * d), -1, 1));
    const a1 = beta + leg.bend * A;
    const kz = leg.L1 * Math.sin(a1);
    const ky = -leg.L1 * Math.cos(a1);
    const a2 = Math.atan2(hz - kz, -(hy - ky));
    ub.rotation.set(-(a1 - leg.a1r), 0, rho);
    leg.b[1].rotation.x = -((a2 - leg.a2r) - (a1 - leg.a1r));
    leg.b[2].rotation.x = -((a3 - leg.a3r) - (a2 - leg.a2r));
    leg.b[3].rotation.x = -((a4 - leg.a4r) - (a3 - leg.a3r));
}

const pulse = (x, a, b, c, d) => sstep(a, b, x) * (1 - sstep(c, d, x));

/**
 * Posa a criatura (baixo nível, determinístico, sem mistura).
 * @param {object} c       retorno de createCreature
 * @param {string} mode    ver CREATURE_MODES
 * @param {number} phase   rad para walk/trot/run/fly/flap/swim; segundos para os demais
 * @param {object} [o]     { amount (0…1 amplitude da passada), time (s, movimento secundário),
 *                           jaw, blink, lookYaw, lookPitch, turn, ground: [g por perna] }
 */
export function poseCreature(c, mode = 'idle', phase = 0, o = EMPTY) {
    const r = c.rig;
    const G = r.G;
    mode = ALIAS[mode] || mode;
    if ((mode === 'fly' || mode === 'glide' || mode === 'flap') && (!r.wing || r.wing.cosmetic)) mode = 'idle';
    const t = o.time ?? phase;
    const amt = o.amount ?? 1;
    const L = r.legLen;
    const quad = r.quad;
    const ph = phase;
    const sp = r.seedPh;
    // zera canais
    for (const k in ch) ch[k] = 0;
    ch.wingFold = 1;
    ch.look = 1;
    ch.tailLag = 0.6;
    for (const l of r.legs) {
        l.x = l.y = l.z = l.fold = 0;
        l.a3 = NaN;
        l.rel = l.air = false;
        l.toeFollow = 0;
    }
    const breathe = Math.sin(t * (G.breath ?? 1.6) + sp);
    const gait = c.gaits[mode];
    const tailBase = G.tailWave ?? 0.12;

    if (gait) {
        // ── andaduras ──
        const cyc = ph / TAU;
        const run = mode === 'run';
        const trot = mode === 'trot';
        r.legs.forEach((l, i) => {
            const p = fract(cyc + gait.off[i]);
            const S_ = gait.stride * amt;
            if (p < gait.duty) {
                const s = p / gait.duty;
                l.z = S_ * (0.5 - s);
                // desprende o calcanhar no fim do apoio (metatarso gira, dedo fica no chão)
                l.fold = -0.0;
            } else {
                const s = (p - gait.duty) / (1 - gait.duty);
                const e = s * s * (3 - 2 * s);
                l.z = S_ * (-0.5 + e);
                l.y = gait.lift * amt * Math.pow(Math.sin(Math.PI * Math.pow(s, 0.85)), 1.1) * (l.front ? 1 : 0.85);
                l.fold = Math.sin(Math.PI * Math.pow(s, 0.8));
            }
            if (!quad) l.x = -l.side * L * 0.06 * amt; // bípedes pisam perto da linha média
        });
        const s1 = Math.sin(ph);
        const c2 = Math.cos(2 * ph);
        if (quad) {
            if (run && !G.amble) {
                // galope: 1 oscilação por passada. p≈0,15 apoio traseiro (frente sobe); p≈0,6 apoio dianteiro
                const flex = (G.flex ?? 0.08) * amt;
                ch.pitch = (G.galPitch ?? 0.07) * amt * Math.cos(ph - TAU * 0.15);
                ch.hy = L * (-0.05 + 0.05 * amt * Math.cos(ph - TAU * 0.9));
                const f = flex * Math.cos(ph - TAU * 0.9); // + = coluna arqueada (suspensão recolhida)
                ch.pitch += f * 0.6;
                ch.spineP = -f * 0.9;
                ch.chestP = -f * 0.7;
                ch.neckP = -ch.pitch * 0.7 - (G.runNeck ?? 0.18) * amt;
                ch.headP = (G.runNeck ?? 0.18) * amt * 0.6 - ch.chestP * 0.3;
                ch.tailP = (G.runTail ?? 0.5) * amt + 0.1 * Math.sin(ph - 1);
                ch.ear = -0.5 * amt;
                ch.tailWave = tailBase * 0.6;
            } else {
                const bob = (trot ? 0.03 : 0.012) * L * amt;
                ch.hy = -L * (trot ? 0.035 : 0.022) * amt + bob * c2;
                ch.pitch = (trot ? 0.006 : 0.014) * amt * Math.sin(2 * ph + 0.8);
                ch.roll = (trot ? 0.012 : 0.022) * amt * s1;
                ch.yaw = 0.022 * amt * Math.sin(ph + 0.5);
                ch.spineY = -(G.sway ?? 0.035) * amt * Math.sin(ph + 0.5);
                const nod = (G.nod ?? 0.5) * (trot ? 0.5 : 1);
                ch.neckP = 0.07 * nod * amt * Math.sin(2 * ph + 1.2) - (trot ? 0.04 : 0);
                ch.headP = -0.05 * nod * amt * Math.sin(2 * ph + 1.2);
                ch.tailP = trot ? 0.2 * amt * (G.runTail ?? 0.5) : 0;
                ch.tailWave = tailBase * (trot ? 1.2 : 1);
            }
        } else {
            // bípede: pelve gira com a perna, cauda contrabalança com atraso
            const lean = run ? 0.1 : trot ? 0.05 : 0.01;
            ch.hy = -L * (run ? 0.06 : 0.03) * amt + L * (run ? 0.035 : 0.016) * amt * c2;
            ch.pitch = -lean * amt + 0.012 * amt * Math.sin(2 * ph + 0.6);
            ch.yaw = (run ? 0.07 : 0.05) * amt * s1;
            ch.roll = -0.025 * amt * s1;
            ch.spineY = -ch.yaw * 0.6;
            ch.neckY = -ch.yaw * 0.4;
            ch.neckP = lean * amt * 0.8 + (G.nod ?? 0.3) * 0.06 * amt * Math.sin(2 * ph + 1);
            ch.headP = -(G.nod ?? 0.3) * 0.05 * amt * Math.sin(2 * ph + 1);
            ch.tailYaw = -ch.yaw * 1.2;
            ch.tailWave = (G.tailWave ?? 0.1) * (run ? 1.6 : 1);
            ch.tailP = run ? 0.12 * amt : 0.02;
            ch.arm = 0.25 * amt * s1;
            if (G.hop) {
                ch.hy += L * 0.12 * amt * Math.max(0, Math.sin(ph + 2.2));
                ch.yaw = ch.roll = ch.spineY = ch.tailYaw = 0;
            }
        }
        ch.breath = breathe * 0.4;
    } else if (mode === 'fly' || mode === 'flap' || mode === 'glide') {
        // ── voo: pernas recolhidas, asas abertas ──
        const A = r.wing.amp * (mode === 'glide' ? 0 : 1);
        const s = Math.sin(ph);
        ch.wingFold = 0;
        ch.flap = mode === 'glide' ? 0.1 + 0.03 * Math.sin(t * 0.9) : A * (0.1 + 0.9 * s);
        ch.flap2 = mode === 'glide' ? -0.04 : A * 0.55 * Math.sin(ph - 0.9);
        ch.flap3 = mode === 'glide' ? -0.03 : A * 0.5 * Math.sin(ph - 1.5);
        ch.hy = -L * 0.1 * A * Math.sin(ph - 0.4);
        ch.pitch = mode === 'flap' ? 0.35 : 0.03 + 0.03 * A * Math.sin(ph - 0.8);
        ch.neckP = mode === 'flap' ? -0.2 : (G.flyNeck ?? 0);
        ch.tailP = (G.flyTail ?? 0.3) - r.tailRest * 0.8;
        ch.tailWave = 0.04;
        for (const l of r.legs) {
            l.rel = l.air = true;
            l.z = -l.len * (G.flyLegZ ?? 0.35);
            l.y = -l.len * (G.flyLegY ?? 0.45);
            l.a3 = l.a3r - 0.9;
            l.toeFollow = 1;
        }
    } else if (mode === 'swim') {
        const cyc = ph / TAU;
        r.legs.forEach((l, i) => {
            const p = fract(cyc + (quad ? [0, 0.5, 0.5, 0][i] : [0, 0.5][i]));
            l.air = true;
            l.z = l.len * 0.28 * Math.cos(p * TAU);
            l.y = l.len * (0.3 + 0.12 * Math.sin(p * TAU));
            l.fold = 0.5 + 0.5 * Math.sin(p * TAU);
        });
        ch.pitch = 0.05 + 0.015 * Math.sin(ph);
        ch.neckP = G.swimNeck ?? 0.25;
        ch.headP = -(G.swimNeck ?? 0.25) * 0.8;
        ch.roll = 0.02 * Math.sin(ph);
        ch.tailWave = tailBase * 1.5;
        ch.tailP = 0.2;
    } else {
        // ── poses estáticas ──
        const lookA = Math.sin(t * 0.31 + sp) * 0.5 + Math.sin(t * 0.83 + sp * 2) * 0.2;
        const lookB = Math.sin(t * 0.47 + sp * 3) * 0.1;
        ch.breath = breathe;
        ch.tailWave = tailBase * 0.5 * r.tailWag;
        ch.earFlick = Math.pow(Math.max(0, Math.sin(t * 1.3 + sp * 5)), 24);
        const lie = (k) => {
            // deitar: ventre no chão, pernas dobradas
            const drop = Math.max(0, r.belly - 0.02 * L) * k;
            ch.hy -= drop;
            for (const l of r.legs) {
                l.rel = true;
                if (l.front) {
                    if (G.fold === 'ungulate') {
                        l.z = l.L2 * 0.72;
                        l.a3 = -1.75;
                        l.toeFollow = 1;
                        l.y = l.P0.y + l.L3 * 0.12;
                    } else {
                        l.z = (l.L2 + l.L3) * 0.86;
                        l.a3 = 1.5;
                        l.y = l.P0.y;
                    }
                } else {
                    l.z = l.L3 * 0.9 - l.L2 * 0.12;
                    l.a3 = 1.45;
                    l.y = l.P0.y;
                    l.x = l.side * l.len * 0.06;
                }
            }
        };
        const reachDown = (yT, k) => {
            // Leva o focinho até a altura yT com IK de 2 elos (pescoço Ln, cabeça Lh), nuca alta e
            // focinho para baixo. Se nem esticado alcança, o corpo se inclina sobre o quadril.
            const reach = (r.nLn + r.nLh) * 0.97;
            const need = r.nY + ch.hy - yT - reach * 0.94;
            let pu = 0;
            if (need > 0) pu = clamp(Math.asin(clamp((r.nY - need - r.hipsR.y) / r.nL, -1, 1)) - r.nG, -(G.bow ?? 0.6), 0);
            const ny = r.hipsR.y + ch.hy + r.nL * Math.sin(r.nG + pu);
            const dy = yT - ny;
            const dzMax = Math.sqrt(Math.max(0, reach * reach - dy * dy));
            const dz = Math.min(dzMax, reach * (G.reachK ?? 0.5));
            const d = clamp(Math.hypot(dz, dy), Math.abs(r.nLn - r.nLh) + 1e-3, reach);
            const base = Math.atan2(dy, dz);
            const th1 = base + Math.acos(clamp((r.nLn * r.nLn + d * d - r.nLh * r.nLh) / (2 * r.nLn * d), -1, 1));
            const hx = r.nLn * Math.cos(th1);
            const hy_ = r.nLn * Math.sin(th1);
            const th2 = Math.atan2(d * Math.sin(base) - hy_, d * Math.cos(base) - hx);
            const d1 = th1 - r.nA1 - pu; // pescoço (pitch para cima)
            const d2 = th2 - r.nA2 - pu - d1; // cabeça em relação ao pescoço
            ch.pitch += pu * k;
            ch.neckP += clamp(d1, -(G.neckMax ?? 2.6), 0.6) * k;
            ch.headP += clamp(d2, -1.5, 1.5) * k;
            ch.tailP -= pu * 0.5 * k;
        };
        if (mode === 'idle') {
            ch.neckY = lookA * (G.lookAmp ?? 0.7);
            ch.headY = lookA * 0.3;
            ch.headP = lookB;
            ch.neckP = Math.sin(t * 0.23 + sp) * 0.04;
            ch.roll = Math.sin(t * 0.37 + sp) * 0.012;
            ch.hx = Math.sin(t * 0.37 + sp) * L * 0.012;
            ch.tailWave = tailBase * r.tailWag;
            ch.jaw = (G.pant ?? 0) * (0.5 + 0.5 * Math.sin(t * 9));
            if (G.peck) {
                // aves de quintal ciscando: bicada ocasional
                const k = pulse(fract(t * 0.21 + sp), 0.0, 0.08, 0.14, 0.24);
                if (k > 0) {
                    reachDown(0.02, k);
                    ch.neckY *= 1 - k;
                    ch.headY *= 1 - k;
                }
            }
        } else if (mode === 'alert') {
            ch.neckP = G.alertNeck ?? 0.25;
            ch.headP = -(G.alertNeck ?? 0.25) * 0.6;
            ch.hy = L * 0.012;
            ch.neckY = Math.sin(t * 0.9 + sp) * 0.12;
            ch.ear = 0.35;
            ch.tailP = G.alertTail ?? 0.35;
            ch.tailWave = 0.02;
            ch.breath = breathe * 0.5;
        } else if (mode === 'eat' || mode === 'drink') {
            const chew = mode === 'eat';
            if (G.browse) {
                // saurópode: pasta no alto, cabeça varre a copa
                ch.neckP = 0.12 + Math.sin(t * 0.4) * 0.05;
                ch.neckY = Math.sin(t * 0.27 + sp) * 0.5;
                ch.headP = -0.25;
            } else {
                reachDown(L * 0.03 + (chew ? Math.max(0, Math.sin(t * 2.1)) * L * 0.02 : 0), 1);
                ch.neckY = chew ? Math.sin(t * 0.5 + sp) * 0.12 : 0;
            }
            ch.jaw = chew ? 0.12 + 0.14 * Math.sin(t * (G.chew ?? 6.5)) * (0.6 + 0.4 * Math.sin(t * 0.7)) : 0.1 + 0.06 * Math.sin(t * 10);
            ch.headR = chew ? Math.sin(t * (G.chew ?? 6.5) * 0.5) * 0.04 : 0;
            ch.look = 0.15;
            ch.tailWave = tailBase * 0.8 * r.tailWag;
        } else if (mode === 'sit') {
            if (quad && (G.sit ?? 'lie') === 'haunch') {
                // senta sobre a garupa: quadril desce, tronco inclina, dianteiras retas
                const hy = L * (G.sitH ?? 0.36);
                ch.hy = hy - L;
                const cy = (r.fore[0] ? r.fore[0].len : L) * 0.96;
                const hipY = r.hipsR.y + ch.hy;
                const j0 = r.fore[0].J0;
                const lc = Math.hypot(j0.z - r.hipsR.z, j0.y - r.hipsR.y);
                const g0 = Math.atan2(j0.y - r.hipsR.y, j0.z - r.hipsR.z);
                ch.pitch = clamp(Math.asin(clamp((cy - hipY) / lc, -1, 1)) - g0, 0, 1.1);
                ch.neckP = -ch.pitch * 0.72;
                ch.headP = -ch.pitch * 0.2 + lookB;
                ch.tailP = -ch.pitch * 0.9 - r.tailRest * 0.6;
                ch.neckY = lookA * 0.6;
                ch.headY = lookA * 0.3;
                for (const l of r.legs) {
                    l.rel = true;
                    if (l.front) {
                        l.z = (l.P0.z - l.J0.z) + l.len * 0.04;
                        l.y = l.P0.y;
                    } else {
                        l.z = l.L3 * 0.95 + l.L2 * 0.1;
                        l.a3 = 1.4;
                        l.y = l.P0.y;
                        l.x = l.side * l.len * 0.1;
                    }
                }
            } else {
                lie(1);
                ch.neckY = lookA * 0.5;
                ch.headY = lookA * 0.3;
                ch.neckP = G.lieNeck ?? 0;
            }
        } else if (mode === 'sleep') {
            lie(1);
            ch.lid = 1;
            ch.look = 0;
            ch.breath = Math.sin(t * 0.9 + sp) * 1.6;
            ch.earFlick = 0;
            ch.ear = -0.3;
            reachDown(L * 0.04 + r.belly * 0.0, 1);
            ch.neckY = (G.sleepCurl ?? 0.5);
            ch.headY = (G.sleepCurl ?? 0.5) * 0.5;
            ch.tailYaw = (G.sleepCurl ?? 0.5) * 1.6;
            ch.tailWave = 0;
            ch.headR = 0.15;
        } else if (mode === 'roar') {
            const x = fract(t / 3.2);
            const e = pulse(x, 0.08, 0.28, 0.72, 0.92);
            const wind = pulse(x, 0, 0.1, 0.12, 0.3);
            const shake = e * Math.sin(t * 31) * 0.012;
            ch.hz = L * (0.1 * e - 0.05 * wind);
            ch.hy = -L * 0.04 * e;
            ch.pitch = quad ? -0.04 * e + 0.05 * wind : -0.12 * e + 0.08 * wind;
            ch.neckP = (quad ? 0.3 : 0.38) * e - 0.15 * wind;
            ch.headP = 0.22 * e;
            ch.jaw = e * (1 - 0.06 * Math.sin(t * 23));
            ch.roll = shake;
            ch.neckY = e * Math.sin(t * 2.2) * 0.18;
            ch.headR = shake * 3;
            ch.tailP = 0.25 * e;
            ch.tailWave = 0.1 + 0.2 * e;
            ch.ear = -0.6 * e;
            ch.reach = 0.5 * e;
            ch.look = 1 - e;
            if (r.wing) ch.wingFold = 1 - 0.75 * e;
            if (r.wing) ch.flap = 0.5 * e;
        } else if (mode === 'attack') {
            const x = fract(t / 1.15);
            const wind = pulse(x, 0, 0.22, 0.3, 0.38);
            const strike = pulse(x, 0.3, 0.42, 0.56, 0.85);
            ch.hz = L * (-0.12 * wind + 0.3 * strike);
            ch.hy = -L * (0.07 * wind + 0.06 * strike);
            ch.pitch = 0.07 * wind - (quad ? 0.1 : 0.2) * strike;
            ch.neckP = 0.18 * wind - 0.22 * strike;
            ch.headP = 0.12 * wind + 0.1 * strike;
            ch.jaw = Math.max(wind * 0.8, pulse(x, 0.24, 0.36, 0.44, 0.5));
            ch.tailP = 0.3 * strike;
            ch.ear = -0.7;
            ch.reach = 0.8 * strike;
            ch.tailWave = 0.15;
            if (quad) {
                // patada: dianteira esquerda sobe e avança no bote
                const l = r.fore[0];
                l.y = l.len * 0.35 * pulse(x, 0.26, 0.4, 0.46, 0.6);
                l.z = l.len * 0.45 * pulse(x, 0.3, 0.44, 0.5, 0.7);
                l.fold = pulse(x, 0.22, 0.34, 0.4, 0.5) * 0.7;
            }
        }
    }
    if (o.jaw !== undefined) ch.jaw = o.jaw;
    if (o.blink !== undefined) ch.lid = Math.max(ch.lid, o.blink);
    const turn = o.turn || 0;

    // ── adaptação ao terreno ──
    let gH = 0;
    let gF = 0;
    const gr = o.ground;
    if (gr) {
        let nH = 0;
        let nF = 0;
        r.legs.forEach((l, i) => {
            l.g = gr[i];
            if (l.front) {
                gF += gr[i];
                nF++;
            } else {
                gH += gr[i];
                nH++;
            }
        });
        gH /= nH || 1;
        gF = nF ? gF / nF : gH;
        ch.hy += quad ? gH : (gH + gF) / 2;
        if (quad) ch.pitch += Math.atan2(gF - gH, r.fore[0].J0.z - r.hind[0].J0.z);
    } else for (const l of r.legs) l.g = 0;

    // ── tronco (FK) ──
    r.hips.position.set(r.hipsR.x + ch.hx, r.hipsR.y + ch.hy, r.hipsR.z + ch.hz);
    r.hips.rotation.set(-ch.pitch, ch.yaw + turn * 0.1, ch.roll);
    r.spine.rotation.set(-ch.spineP, ch.spineY + turn * 0.12, 0);
    r.chest.rotation.set(-ch.chestP, ch.spineY * 0.6 + turn * 0.12, -ch.roll * 0.5);
    const bs = 1 + ch.breath * (G.breathAmp ?? 0.012);
    r.spine.scale.set(bs, bs, 1);
    r.hips.updateMatrix();
    r.spine.updateMatrix();
    r.chest.updateMatrix();
    _mH.copy(r.hips.matrix);
    _mS.multiplyMatrices(_mH, r.spine.matrix);
    _mC.multiplyMatrices(_mS, r.chest.matrix);

    // ── pernas (IK) ──
    for (const l of r.legs) {
        const M = l.front ? _mC : _mH;
        let tx = l.P0.x + l.x;
        let ty = l.P0.y + l.y;
        let tz = l.P0.z + l.z;
        if (l.rel) {
            _p.copy(l.b[0].position).applyMatrix4(M);
            tz = _p.z + l.z;
            tx = _p.x + (l.P0.x - l.J0.x) + l.x;
            ty = l.air ? _p.y + l.y : l.y;
        }
        if (!l.air) ty += l.g;
        const a3 = Number.isNaN(l.a3) ? l.a3r - l.fold * l.foldK : l.a3;
        const a4 = l.a4r + (a3 - l.a3r) * l.toeFollow - l.fold * (l.planti ? 0.3 : l.front ? 0.3 : 0.5);
        l.relNow = !Number.isNaN(l.a3);
        solveLeg(l, M, tx, ty, tz, a3, a4);
    }

    // ── pescoço, cabeça, mandíbula ──
    const nn = r.neck.length;
    const ly = (o.lookYaw || 0) * ch.look;
    const lp = (o.lookPitch || 0) * ch.look;
    for (let i = 0; i < nn; i++) {
        r.neck[i].rotation.set(-(ch.neckP + lp * 0.55) / nn, (ch.neckY + ly * 0.6 + turn * 0.25) / nn, 0);
    }
    r.head.rotation.set(-(ch.headP + lp * 0.45), ch.headY + ly * 0.4, ch.headR);
    r.jaw.rotation.x = clamp(ch.jaw) * r.gape;

    // ── cauda: onda viajante com atraso por osso ──
    const nt = r.tail.length;
    for (let i = 0; i < nt; i++) {
        const k = (i + 1) / nt;
        const wave = ch.tailWave * Math.sin((gait ? ph : t * 2.1) - i * ch.tailLag + sp) * (0.5 + k);
        r.tail[i].rotation.set(ch.tailP / nt + ch.tailCurl * k, (ch.tailYaw - turn * 0.5) / nt * (0.6 + k) - wave, 0);
    }
    // ── orelhas ──
    for (let i = 0; i < r.ears.length; i++) {
        const fl = i === 0 ? ch.earFlick : Math.pow(Math.max(0, Math.sin(t * 1.1 + sp * 3)), 24);
        r.ears[i].rotation.set(ch.ear * 0.6 + fl * 0.25, 0, (i === 0 ? -1 : 1) * (Math.min(0, ch.ear) * 0.5 - fl * 0.2));
    }
    // ── pálpebras ──
    for (const [b, ax] of r.lids) b.quaternion.setFromAxisAngle(ax, clamp(ch.lid) * r.lidClose);
    // ── braços curtos (terópodes) ──
    for (const a of r.arms) {
        a.b[0].rotation.set(-ch.reach - ch.arm * a.side + Math.sin(t * 0.7 + sp) * 0.04, 0, 0);
        a.b[1].rotation.x = -ch.reach * 0.6;
    }
    // ── asas: dobra = rolar para baixo + varrer para trás + encolher a envergadura ──
    if (r.wing) {
        const f = clamp(ch.wingFold);
        const w = r.wing;
        for (const wg of r.wings) {
            const s = wg.side;
            wg.b[0].rotation.set(w.sweep * f, 0, s * (ch.flap * (1 - f) - w.roll * f));
            wg.b[0].scale.set(lerp(1, w.foldK, f), 1, lerp(1, w.foldC, f));
            wg.b[1].rotation.set(0, -s * 0.25 * f, s * ch.flap2 * (1 - f));
            wg.b[2].rotation.set(0, -s * 0.35 * f, s * ch.flap3 * (1 - f));
        }
    }
}

function snapshot(c) {
    const st = c.state;
    const bones = c.mesh.skeleton.bones;
    for (let i = 0; i < bones.length; i++) bones[i].quaternion.toArray(st.snap, i * 4);
    c.rig.hips.position.toArray(st.snapP, 0);
    st.snapS[0] = c.rig.wings.length ? c.rig.wings[0].b[0].scale.x : 1;
    st.snapS[1] = c.rig.wings.length ? c.rig.wings[0].b[0].scale.z : 1;
}

const _ground = [0, 0, 0, 0];
const _opt = { amount: 1, time: 0, jaw: undefined, blink: 0, lookYaw: 0, lookPitch: 0, turn: 0, ground: null };

function updateCreature(c, dt, s) {
    const st = c.state;
    const r = c.rig;
    let mode = ALIAS[s.mode] || s.mode || 'idle';
    if ((mode === 'fly' || mode === 'glide' || mode === 'flap') && (!r.wing || r.wing.cosmetic)) mode = 'idle';
    if (mode !== st.mode) {
        snapshot(c);
        st.mode = mode;
        st.blend = 0;
    }
    dt = Math.min(dt, 0.1);
    st.time += dt;
    // fase da andadura: ω = 2π·v / (S/D); a passada estica com √(v/v_nat)
    const g = c.gaits[mode];
    if (g) {
        const v = s.speed ?? g.speed;
        const k = clamp(Math.sqrt(Math.abs(v) / g.speed), 0.45, 1.3);
        st.amount += (k - st.amount) * (1 - Math.exp(-8 * dt));
        st.phase += dt * TAU * (v / c.scale) / ((g.stride * st.amount) / g.duty);
    } else if (mode === 'fly' || mode === 'flap') st.phase += dt * TAU * r.flapHz * (mode === 'flap' ? 1.25 : 1);
    else if (mode === 'swim') st.phase += dt * TAU * 1.4 / Math.sqrt(Math.max(0.05, r.legLen * c.scale) / 0.3);
    // piscar
    r.blinkAt -= dt;
    if (r.blinkAt < 0) r.blinkAt = 2 + r.rnd() * 4.5;
    st.blink = r.blinkAt < 0.14 ? Math.sin((r.blinkAt / 0.14) * Math.PI) : 0;
    // olhar para um alvo (mundo → espaço da malha)
    let ty = 0;
    let tp = 0;
    if (s.lookAt) {
        _inv.copy(c.mesh.matrixWorld).invert();
        _p.copy(s.lookAt).applyMatrix4(_inv);
        const dx = _p.x - r.headR.x;
        const dy = _p.y - (r.headR.y + (r.hips.position.y - r.hipsR.y));
        const dz = _p.z - r.headR.z;
        ty = clamp(Math.atan2(dx, dz), -1.25, 1.25);
        tp = clamp(Math.atan2(dy, Math.hypot(dx, dz)), -0.6, 0.7);
    }
    const kL = 1 - Math.exp(-5 * dt);
    st.lookYaw += (ty - st.lookYaw) * kL;
    st.lookPitch += (tp - st.lookPitch) * kL;
    // chão sob cada pé (mundo → altura local)
    let ground = null;
    if (s.groundFn && mode !== 'fly' && mode !== 'glide' && mode !== 'flap' && mode !== 'swim') {
        const py = c.object.position.y;
        for (let i = 0; i < r.legs.length; i++) {
            const l = r.legs[i];
            _p.set(l.P0.x, 0, l.P0.z).applyMatrix4(c.mesh.matrixWorld);
            _ground[i] = (s.groundFn(_p.x, _p.z) - py) / c.scale;
        }
        ground = _ground;
    }
    _opt.amount = st.amount;
    _opt.time = st.time;
    _opt.jaw = s.jaw;
    _opt.blink = Math.max(st.blink, s.blink || 0);
    _opt.lookYaw = st.lookYaw;
    _opt.lookPitch = st.lookPitch;
    _opt.turn = s.turn || 0;
    _opt.ground = ground;
    poseCreature(c, mode, g || mode === 'fly' || mode === 'flap' || mode === 'swim' ? st.phase : st.time, _opt);
    // crossfade a partir da pose congelada na troca de modo
    if (st.blend < 1) {
        st.blend = Math.min(1, st.blend + dt / (s.blendTime ?? 0.35));
        const k = st.blend * st.blend * (3 - 2 * st.blend);
        const bones = c.mesh.skeleton.bones;
        for (let i = 0; i < bones.length; i++) {
            _q.fromArray(st.snap, i * 4);
            _q2.copy(bones[i].quaternion);
            bones[i].quaternion.copy(_q.slerp(_q2, k));
        }
        const hp = r.hips.position;
        hp.set(lerp(st.snapP[0], hp.x, k), lerp(st.snapP[1], hp.y, k), lerp(st.snapP[2], hp.z, k));
        for (const w of r.wings) {
            w.b[0].scale.x = lerp(st.snapS[0], w.b[0].scale.x, k);
            w.b[0].scale.z = lerp(st.snapS[1], w.b[0].scale.z, k);
        }
    }
    // esfera de culling acompanha o quadril
    const bsph = c.mesh.boundingSphere;
    bsph.center.x = r.hips.position.x;
    bsph.center.z = r.hips.position.z + (c.mesh.geometry.boundingSphere.center.z - r.hipsR.z);
    bsph.center.y = c.mesh.geometry.boundingSphere.center.y + (r.hips.position.y - r.hipsR.y);
}

// ───────────────────────────────── presets ───────────────────────────────────
/**
 * Medidas-alvo (adulto, metros) estão no comentário de cada preset:
 * comprimento focinho–cauda · altura na cernelha/quadril.
 * Pernas: J = [ombro|quadril, cotovelo|joelho, punho|jarrete, boleto, ponta do dedo] como [z, y];
 * r = raios [lateral, sagital] nas 4 primeiras juntas.
 */
export const CREATURES = {};

// Raposa-vermelha (Vulpes vulpes): corpo 0,68 + cauda 0,40 · cernelha 0,38 · ~6 kg
CREATURES.fox = {
    label: 'fox',
    torso: [
        [-0.1, 0.345, 0.27, 0.03, 2.1], [-0.045, 0.372, 0.222, 0.06, 2.2], [0.03, 0.38, 0.2, 0.068, 2.2],
        [0.13, 0.378, 0.19, 0.07, 2.2], [0.24, 0.382, 0.168, 0.076, 2.2], [0.33, 0.388, 0.168, 0.074, 2.2], [0.395, 0.376, 0.2, 0.056, 2.1]
    ],
    neck: [[0.43, 0.335, 0.048, 0.06], [0.475, 0.385, 0.04, 0.047]],
    neckBones: 2,
    head: {
        at: [0.505, 0.418], pitch: -0.26, len: 0.155,
        prof: [
            [0, 0.036, 0.042, 0.04], [0.17, 0.046, 0.046, 0.057], [0.34, 0.043, 0.042, 0.05], [0.5, 0.028, 0.035, 0.029],
            [0.74, 0.0185, 0.029, 0.0185], [0.93, 0.0145, 0.024, 0.0145], [1, 0.008, 0.014, 0.009]
        ],
        mouth: { t0: 0.52, y: -0.014, y1: -0.011, tip: 0.955, gape: 0.75, inset: 0.985 },
        teeth: { n: 8, len: 0.009, fang: 1.5 },
        eye: { t: 0.37, up: 0.023, r: 0.0095, fwd: 0.5 },
        ears: { t: 0.1, up: 0.034, x: 0.031, len: 0.085, w: 0.05, out: 0.3, back: 0.12, face: 0.55 },
        nose: { r: 0.0085 }
    },
    tail: { len: 0.42, a0: -0.62, curve: 0.5, bones: 5, wag: 0.6, prof: [[0, 0.024, 0.024], [0.2, 0.038, 0.038], [0.55, 0.052, 0.052], [0.85, 0.04, 0.04], [1, 0.008, 0.008]] },
    legs: {
        front: { x: 0.05, J: [[0.37, 0.27], [0.305, 0.188], [0.322, 0.078], [0.328, 0.022], [0.372, 0]], r: [[0.03, 0.05], [0.02, 0.028], [0.0125, 0.015], [0.0125, 0.014]], bulge: [1.05, 1], foot: { type: 'paw', claws: 0.008, w: 1.35 } },
        hind: { x: 0.052, J: [[0, 0.305], [0.052, 0.2], [-0.048, 0.125], [-0.032, 0.022], [0.016, 0]], r: [[0.034, 0.07], [0.024, 0.04], [0.0125, 0.017], [0.012, 0.014]], bulge: [1.08, 1], back: [1, 1.15], foot: { type: 'paw', claws: 0.008, w: 1.3 } }
    },
    skin: { type: 'fur', tile: 0.09, pattern: { kind: 'plain', mottle: 0.16 } },
    coat: {
        base: 0xc65a1e, belly: 0xf1ece2, back: 0x8f3c12, backT: 0.62, backK: 0.6, edge: -0.42, soft: 0.22, socks: 0x15100d, sockH: 0.52,
        tailTip: 0xf7f3ea, tailTipT: 0.82, chin: 0xf4efe6, muzzle: 0xd9773a, muzzleT: 0.8, earIn: 0xe8d9c4, earTip: 0x15100d, iris: 0xb8761a, pupil: 'slit',
        legIn: 0.25,
        fn(part, t, y, P, C) {
            // bochechas e focinho inferior brancos sobem pela lateral da cabeça
            if (part === 'head') P.ce = lerp(0.05, -0.2, clamp(t * 1.5));
            if (part === 'neck') P.ce = -0.25;
        }
    },
    gait: { gallop: 'rotary', flex: 0.2, sit: 'haunch', nod: 0.25, runTail: 0.7, tailWave: 0.1, kfF: 0.3 },
    juv: { size: 0.45, leg: 0.9, head: 1.5, snout: 0.66, tail: 0.72, ear: 0.9, girth: 1.12, neck: 0.8, body: 0.74, eye: 1.4 }
};

// Vaca holandesa (Bos taurus): corpo 2,4 · cernelha 1,45 · ~650 kg; tronco em caixa, linha do dorso reta
CREATURES.cow = {
    label: 'cow',
    torso: [
        [-0.34, 1.37, 1.04, 0.11, 2.5], [-0.2, 1.44, 0.9, 0.24, 2.8], [0, 1.465, 0.8, 0.3, 2.9], [0.3, 1.43, 0.68, 0.36, 2.6, 0.1],
        [0.6, 1.42, 0.66, 0.37, 2.6, 0.12], [0.88, 1.435, 0.7, 0.32, 2.5], [1.08, 1.47, 0.74, 0.25, 2.4], [1.24, 1.39, 0.8, 0.175, 2.3]
    ],
    neck: [[1.37, 1.27, 0.115, 0.2, 2.2], [1.53, 1.34, 0.098, 0.16, 2.2]],
    neckBones: 2,
    head: {
        at: [1.67, 1.42], pitch: -0.78, len: 0.5,
        prof: [
            [0, 0.1, 0.11, 0.11, 2.3], [0.15, 0.112, 0.135, 0.132, 2.6], [0.34, 0.105, 0.13, 0.126, 2.6], [0.6, 0.085, 0.105, 0.1, 2.6],
            [0.82, 0.076, 0.09, 0.096, 2.7], [0.95, 0.068, 0.08, 0.1, 2.8], [1, 0.04, 0.05, 0.078, 2.7]
        ],
        mouth: { t0: 0.78, y: -0.03, y1: -0.026, tip: 0.975, gape: 0.4 },
        eye: { t: 0.33, up: 0.052, r: 0.027, fwd: 0.12 },
        ears: { t: 0.09, up: 0.045, x: 0.1, len: 0.2, w: 0.115, out: 1.35, back: 0.25, face: 0.2, shape: 'leaf', cup: 0.06 },
        nostril: { t: 0.965, up: 0.012, x: 0.04, r: 0.02 },
        horns: [{ t: 0.03, up: 0.1, x: 0.085, len: 0.2, r: 0.03, d0: [1, 0.25, 0.1], d1: [0.3, 1, 0.6] }]
    },
    tail: { len: 0.98, a0: -1.38, curve: -0.12, bones: 5, wag: 1.4, dy: 0.1, prof: [[0, 0.04, 0.04], [0.15, 0.024, 0.024], [0.68, 0.018, 0.018], [0.86, 0.046, 0.04], [1, 0.012, 0.012]] },
    legs: {
        front: { x: 0.185, J: [[1.2, 1.0], [1.07, 0.79], [1.09, 0.44], [1.09, 0.17], [1.165, 0]], r: [[0.115, 0.2], [0.08, 0.1], [0.055, 0.066], [0.045, 0.052]], bulge: [1.04, 0.98], foot: { type: 'hoof', cloven: true } },
        hind: { x: 0.2, J: [[0, 1.12], [0.2, 0.86], [-0.14, 0.52], [-0.11, 0.17], [-0.03, 0]], r: [[0.14, 0.27], [0.1, 0.15], [0.055, 0.082], [0.045, 0.055]], bulge: [1.06, 1], back: [1, 1.1], foot: { type: 'hoof', cloven: true } }
    },
    skin: { type: 'short', tile: 0.4, pattern: { kind: 'patches', n: 3, th: 0.5, c1: 0x0d0c0c, mottle: 0.05 } },
    coat: {
        base: 0xf2efe8, belly: 0xf2efe8, muzzle: 0xd9a39a, muzzleT: 0.93, earIn: 0xd8b0a4, udder: 0xe2aaa4, tailTip: 0xf2efe8, tailTipT: 0.7,
        iris: 0x2a1a10, pupil: 'bar', horn: 0xd8cfb8, dirt: 0.3, legIn: 0
    },
    extras: { udder: { z: 0.1, r: 0.16 } },
    gait: { gallop: 'transverse', flex: 0.04, sit: 'lie', fold: 'ungulate', nod: 0.9, runTail: 0.9, tailWave: 0.2, chew: 5, galPitch: 0.05, runNeck: 0.1 },
    juv: { size: 0.42, leg: 1.12, head: 1.25, snout: 0.8, neck: 0.9, girth: 0.82, tail: 0.8 }
};

// Cavalo (Equus caballus): corpo 2,4 · cernelha 1,55 · ~500 kg
CREATURES.horse = {
    label: 'horse',
    variant(spec, o) {
        // pelagens: bay (baio, padrão) · chestnut (alazão) · black · grey (tordilho) · palomino · pinto
        const coats = {
            bay: { base: 0x6a3a1a, belly: 0x7a4824, mane: 0x120e0c, socks: 0x15100d, sockH: 0.42, muzzle: 0x241812 },
            chestnut: { base: 0x8a4a22, belly: 0x9a5a2e, mane: 0x7a4020, socks: null, muzzle: 0x5a3220 },
            black: { base: 0x191614, belly: 0x1e1a18, mane: 0x0c0b0a, socks: null, muzzle: 0x0e0d0c },
            grey: { base: 0xb8b6b0, belly: 0xcfcdc8, mane: 0x6a6866, socks: 0x4a4846, sockH: 0.35, muzzle: 0x4a4644 },
            palomino: { base: 0xc79a52, belly: 0xd4ac6a, mane: 0xf0e6d0, socks: 0xf0e8dc, sockH: 0.3, muzzle: 0x8a6a4a },
            pinto: { base: 0xf2eee6, belly: 0xf2eee6, mane: 0x2a1a10, socks: null, muzzle: 0xc49a8e }
        };
        const names = Object.keys(coats);
        const name = o.coat || (o.seed > 1 ? names[(o.seed | 0) % names.length] : 'bay');
        const c = coats[name] || coats.bay;
        const s = { ...spec, coat: { ...spec.coat, ...c }, skin: { ...spec.skin } };
        if (name === 'pinto') s.skin.pattern = { kind: 'patches', n: 2, th: 0.47, c1: 0x5a3018, mottle: 0.05 };
        if (name === 'grey') s.skin.pattern = { kind: 'spots', n: 16, r: 0.34, c1: 0xe6e4e0, belly: 0.05, alpha: 0.5, mottle: 0.1 };
        return s;
    },
    torso: [
        [-0.3, 1.41, 1.1, 0.1, 2.2], [-0.18, 1.52, 0.98, 0.215, 2.3], [-0.02, 1.565, 0.93, 0.265, 2.3], [0.22, 1.545, 0.9, 0.28, 2.25],
        [0.52, 1.505, 0.83, 0.295, 2.2, 0.06], [0.82, 1.52, 0.79, 0.285, 2.2], [1.05, 1.565, 0.8, 0.26, 2.2], [1.26, 1.5, 0.86, 0.215, 2.15]
    ],
    neck: [[1.38, 1.44, 0.14, 0.25, 2.1], [1.51, 1.63, 0.095, 0.19, 2.1], [1.635, 1.79, 0.074, 0.14, 2.1]],
    neckBones: 3,
    head: {
        at: [1.745, 1.9], pitch: -0.98, len: 0.62,
        prof: [
            [0, 0.088, 0.105, 0.082, 2.2], [0.15, 0.1, 0.15, 0.1, 2.3], [0.32, 0.096, 0.148, 0.105, 2.3], [0.5, 0.076, 0.112, 0.08, 2.3],
            [0.7, 0.06, 0.08, 0.058, 2.3], [0.87, 0.056, 0.07, 0.056, 2.4], [0.965, 0.05, 0.06, 0.054, 2.5], [1, 0.028, 0.034, 0.038, 2.4]
        ],
        mouth: { t0: 0.8, y: -0.022, y1: -0.02, tip: 0.975, gape: 0.38 },
        eye: { t: 0.3, up: 0.04, r: 0.027, fwd: 0.14, inset: 0.66 },
        ears: { t: 0.035, up: 0.08, x: 0.058, len: 0.17, w: 0.085, out: 0.22, back: 0.05, face: 0.7, shape: 'leaf' },
        nostril: { t: 0.955, up: 0.02, x: 0.036, r: 0.019 }
    },
    tail: { len: 0.98, a0: -1.12, curve: -0.3, bones: 5, wag: 1.2, dy: 0.06, keys: 8, prof: [[0, 0.05, 0.05], [0.14, 0.062, 0.06], [0.5, 0.088, 0.075], [0.85, 0.062, 0.05], [1, 0.014, 0.012]] },
    legs: {
        front: { x: 0.165, J: [[1.26, 1.1], [1.1, 0.86], [1.13, 0.5], [1.13, 0.2], [1.2, 0]], r: [[0.11, 0.21], [0.085, 0.135], [0.052, 0.064], [0.04, 0.05]], bulge: [1.05, 1.02, 0.8], foot: { type: 'hoof' } },
        hind: { x: 0.185, J: [[0, 1.22], [0.17, 0.94], [-0.1, 0.56], [-0.09, 0.2], [-0.02, 0]], r: [[0.14, 0.27], [0.105, 0.16], [0.054, 0.082], [0.04, 0.052]], bulge: [1.08, 1.04, 0.8], back: [1, 1.15], foot: { type: 'hoof' } }
    },
    skin: { type: 'short', tile: 0.42, pattern: { kind: 'plain', mottle: 0.12 } },
    coat: {
        base: 0x6a3a1a, belly: 0x7a4824, mane: 0x120e0c, socks: 0x15100d, sockH: 0.42, muzzle: 0x241812, muzzleT: 0.86, tail: 0x120e0c,
        earIn: 0x6a4a36, iris: 0x3a2412, pupil: 'bar', edge: -0.5, legIn: 0.1, hoof: 0x1e1a16
    },
    extras: { mane: { n: 16, len: 0.2, t0: 0, t1: 1, forelock: true }, saddleZ: 0.72 },
    gait: { gallop: 'transverse', flex: 0.05, sit: 'lie', fold: 'ungulate', nod: 1, runTail: 1.0, tailWave: 0.14, galPitch: 0.06, runNeck: 0.2 },
    juv: { size: 0.5, leg: 1.18, head: 1.15, snout: 0.82, neck: 0.85, girth: 0.78, tail: 0.6 }
};

// Tyrannosaurus rex: 12,3 m · quadril 3,7 m · crânio 1,5 m · ~8 t; corpo horizontal, cauda de contrapeso
CREATURES.trex = {
    label: 'trex',
    torso: [
        [-0.9, 3.8, 2.7, 0.5, 2.2], [-0.3, 4.0, 2.35, 0.78, 2.3], [0.3, 4.05, 2.05, 0.95, 2.3], [1.0, 4.0, 1.85, 1.02, 2.3, 0.1],
        [1.8, 3.95, 1.9, 0.98, 2.3, 0.06], [2.5, 3.9, 2.2, 0.8, 2.3], [3.0, 3.86, 2.6, 0.6, 2.2]
    ],
    neck: [[3.4, 3.5, 0.4, 0.47, 2.2], [3.78, 3.8, 0.36, 0.41, 2.2]],
    neckBones: 3,
    head: {
        at: [4.1, 4.02], pitch: -0.16, len: 1.55,
        prof: [
            [0, 0.36, 0.46, 0.36, 2.3], [0.12, 0.48, 0.58, 0.52, 2.9], [0.28, 0.5, 0.57, 0.5, 2.9], [0.42, 0.4, 0.52, 0.35, 2.8],
            [0.65, 0.35, 0.45, 0.28, 2.8], [0.86, 0.31, 0.39, 0.25, 2.8], [0.965, 0.26, 0.33, 0.22, 2.6], [1, 0.13, 0.2, 0.15, 2.3]
        ],
        mouth: { t0: 0.2, y: -0.12, y1: -0.1, tip: 0.965, gape: 0.8, inset: 0.9, hinge: 0.08 },
        teeth: { n: 13, len: 0.15, show: true, thick: 0.24 },
        eye: { t: 0.3, up: 0.25, r: 0.058, fwd: 0.35, brow: 1.3 },
        nostril: { t: 0.93, up: 0.2, r: 0.045 },
        horns: [{ t: 0.24, up: 0.46, x: 0.3, len: 0.07, r: 0.13, d0: [0.5, 1, 0.3], taper: 0.4, skinBase: true, color: 0x5a5038, flat: 0.6 }]
    },
    tail: { len: 5.8, a0: -0.06, curve: 0.12, bones: 8, wag: 0.3, prof: [[0, 0.52, 0.66], [0.3, 0.34, 0.42], [0.7, 0.15, 0.18], [1, 0.03, 0.03]] },
    legs: {
        hind: { x: 0.6, J: [[0, 3.2], [0.72, 2.32], [-0.1, 1.2], [0.2, 0.4], [1.05, 0]], r: [[0.5, 0.86], [0.4, 0.58], [0.19, 0.27], [0.19, 0.21]], bulge: [1.08, 1.15], back: [1.05, 1.35], top: 0.6, foot: { type: 'claw3', toeR: 0.62, claw: 0.3 } }
    },
    arms: { x: 0.55, J: [[2.55, 2.5], [2.42, 2.12], [2.7, 1.92], [2.88, 1.78]], r: [0.12, 0.09, 0.065], foot: { type: 'claws', n: 2, claw: 0.16 } },
    skin: { type: 'scales', tile: 0.55, pattern: { kind: 'bands', n: 4, bands: 6, c1: 0x4a4434, alpha: 0.5, mottle: 0.22 } },
    coat: {
        base: 0x7a6e4c, belly: 0xc9b88e, back: 0x4a4230, backT: 0.35, edge: -0.35, soft: 0.3, iris: 0xd89a22, pupil: 'round', sclera: 0x2a1408,
        claw: 0x1a1612, teeth: 0xe8dfc6, legIn: 0.4, dirt: 0.25
    },
    extras: { ridge: { size: 0.22, ref: 0.8, runs: [['neck', 0, 1, 5], ['torso', 0, 1, 14], ['tail', 0.15, 1, 16]] } },
    gait: { nod: 0.5, tailWave: 0.09, bow: 0.55, breath: 0.9, lookAmp: 0.5, kfH: 0.45, foldH: 0.5, runStride: 1.2, runDuty: 0.45, runK: 1.9 },
    juv: { size: 0.3, leg: 1.12, head: 0.95, snout: 0.9, girth: 0.72, eye: 1.5, tail: 1 }
};

// Triceratops horridus: 9 m · quadril 3 m · crânio com gola 2,6 m · ~8 t
CREATURES.triceratops = {
    label: 'triceratops',
    torso: [
        [-0.7, 2.62, 1.7, 0.4, 2.3], [-0.2, 2.95, 1.3, 0.8, 2.4], [0.5, 3.05, 1.0, 1.05, 2.4, 0.06], [1.4, 3.0, 0.86, 1.15, 2.4, 0.1],
        [2.3, 2.8, 0.9, 1.05, 2.4, 0.08], [3.0, 2.52, 1.05, 0.8, 2.3], [3.5, 2.32, 1.3, 0.56, 2.2]
    ],
    neck: [[3.82, 1.96, 0.42, 0.42, 2.2]],
    neckBones: 2,
    head: {
        at: [4.1, 1.96], pitch: -0.32, len: 1.9,
        prof: [
            [0, 0.42, 0.42, 0.4, 2.3], [0.15, 0.5, 0.5, 0.5, 2.5], [0.35, 0.42, 0.48, 0.42, 2.5], [0.6, 0.3, 0.4, 0.27, 2.4],
            [0.8, 0.24, 0.33, 0.18, 2.3], [0.93, 0.17, 0.25, 0.11, 2.2], [1, 0.05, 0.14, 0.045, 2.1]
        ],
        mouth: { t0: 0.45, y: -0.11, y1: -0.07, tip: 0.94, gape: 0.45, inset: 0.92 },
        eye: { t: 0.36, up: 0.2, r: 0.06, fwd: 0.15, brow: 0.5 },
        nostril: { t: 0.8, up: 0.1, r: 0.04 },
        horns: [
            { t: 0.33, up: 0.38, x: 0.24, len: 1.0, r: 0.115, d0: [0.25, 0.75, 0.6], d1: [0.1, 0.35, 1], taper: 0.9 },
            { t: 0.76, up: 0.24, x: 0, len: 0.32, r: 0.095, d0: [0, 1, 0.35], d1: [0, 0.8, 0.7] }
        ],
        frill: { t: 0.14, w: 1.08, h: 1.3, depth: 0.45, tilt: 0.5, n: 2.5, studs: 15, stud: 0.12 }
    },
    tail: { len: 2.6, a0: -0.46, curve: 0.36, bones: 5, wag: 0.3, prof: [[0, 0.4, 0.5], [0.5, 0.2, 0.22], [1, 0.04, 0.04]] },
    legs: {
        front: { x: 0.82, J: [[3.0, 1.75], [2.75, 1.15], [2.9, 0.5], [2.92, 0.22], [3.1, 0]], r: [[0.34, 0.46], [0.25, 0.3], [0.18, 0.2], [0.19, 0.2]], bulge: [1.05, 1], foot: { type: 'column', nails: 3 } },
        hind: { x: 0.72, J: [[0, 2.2], [0.5, 1.4], [0, 0.66], [0.14, 0.24], [0.4, 0]], r: [[0.44, 0.62], [0.3, 0.38], [0.2, 0.23], [0.2, 0.22]], bulge: [1.06, 1.05], back: [1, 1.15], foot: { type: 'column', nails: 4 } }
    },
    skin: { type: 'scales', tile: 0.6, pattern: { kind: 'mottle', n: 4, c1: 0x5a4a36, alpha: 0.6, mottle: 0.2 } },
    coat: {
        base: 0x8a7654, belly: 0xc8b48c, back: 0x5c4c36, backT: 0.3, edge: -0.3, beak: 0x4a3c2a, beakT: 0.84, frill: 0x8a6a48, frillRim: 0xa8553a,
        horn: 0xd6c8a8, iris: 0xc8922a, sclera: 0x1a0e08, claw: 0x3a3228, dirt: 0.3, legIn: 0.35
    },
    gait: { gallop: 'transverse', flex: 0.03, sit: 'lie', nod: 0.6, tailWave: 0.06, breath: 0.9, lookAmp: 0.35, amble: true, runStride: 1.05, bow: 0.25 },
    juv: { size: 0.3, leg: 1.0, head: 0.9, snout: 0.85, girth: 0.85 }
};

// Brachiosaurus altithorax: ~22 m · cabeça a 12–13 m · ombro 6 m; dianteiras mais longas, pescoço a ~55°
CREATURES.brachiosaurus = {
    label: 'brachiosaurus',
    torso: [
        [-1.2, 4.9, 3.6, 0.6, 2.2], [-0.4, 5.3, 3.0, 1.2, 2.3], [0.8, 5.7, 2.6, 1.5, 2.3, 0.06], [2.2, 6.2, 2.6, 1.6, 2.3, 0.08],
        [3.6, 6.7, 3.0, 1.5, 2.3, 0.05], [4.6, 7.0, 3.8, 1.15, 2.2], [5.3, 7.3, 4.9, 0.8, 2.2]
    ],
    neck: [[6.0, 6.95, 0.62, 0.74, 2.2], [6.9, 8.2, 0.48, 0.56, 2.2], [7.8, 9.6, 0.4, 0.45, 2.1], [8.6, 10.9, 0.34, 0.37, 2.1], [9.3, 12.0, 0.3, 0.31, 2.1]],
    neckBones: 6,
    head: {
        at: [9.62, 12.42], pitch: -0.38, len: 0.98,
        prof: [
            [0, 0.26, 0.28, 0.24, 2.2], [0.25, 0.34, 0.3, 0.28, 2.3], [0.45, 0.44, 0.28, 0.23, 2.2], [0.62, 0.3, 0.26, 0.23, 2.3],
            [0.82, 0.2, 0.22, 0.26, 2.5], [0.95, 0.16, 0.18, 0.25, 2.6], [1, 0.08, 0.1, 0.17, 2.5]
        ],
        mouth: { t0: 0.55, y: -0.06, y1: -0.05, tip: 0.97, gape: 0.4 },
        teeth: { n: 9, len: 0.05, thick: 0.3 },
        eye: { t: 0.3, up: 0.12, r: 0.045, fwd: 0.15, open: 0.45, brow: 0.5 },
        nostril: { t: 0.47, up: 0.34, x: 0.09, r: 0.04 }
    },
    tail: { len: 8, a0: -0.36, curve: 0.3, bones: 8, wag: 0.25, prof: [[0, 0.6, 0.7], [0.4, 0.3, 0.34], [1, 0.04, 0.04]] },
    legs: {
        front: { x: 1.02, J: [[4.6, 5.0], [4.45, 3.0], [4.5, 0.78], [4.5, 0.36], [4.72, 0]], r: [[0.6, 0.82], [0.42, 0.48], [0.34, 0.36], [0.36, 0.38]], bulge: [1.03, 1], top: 0.7, foot: { type: 'column', nails: 1, nail: 0.34, flare: 1.12 } },
        hind: { x: 0.98, J: [[0, 4.1], [0.45, 2.5], [0.1, 0.72], [0.2, 0.32], [0.6, 0]], r: [[0.75, 1.0], [0.5, 0.6], [0.38, 0.42], [0.42, 0.45]], bulge: [1.05, 1.03], back: [1, 1.1], top: 0.6, foot: { type: 'column', nails: 3, flare: 1.2 } }
    },
    skin: { type: 'hide', tile: 1.1, pattern: { kind: 'mottle', n: 5, c1: 0x5c5a48, alpha: 0.5, mottle: 0.2 } },
    coat: {
        base: 0x86826a, belly: 0xbfb89c, back: 0x5a5846, backT: 0.3, edge: -0.3, iris: 0x8a6a22, sclera: 0x140e08, claw: 0x2e2a22, dirt: 0.32, legIn: 0.3,
        teeth: 0xd8d0b8
    },
    gait: { gallop: 'transverse', flex: 0.01, sit: 'lie', nod: 0.4, tailWave: 0.07, breath: 0.6, lookAmp: 0.5, browse: true, amble: true, runStride: 0.95, sway: 0.02 },
    juv: { size: 0.25, leg: 0.95, head: 1.2, neck: 0.8, girth: 0.9 }
};


// ── utilitários de derivação de presets ──
/** Cópia profunda preservando funções. */
function cloneSpec(v) {
    if (Array.isArray(v)) return v.map(cloneSpec);
    if (v && typeof v === 'object') {
        const o = {};
        for (const k in v) o[k] = cloneSpec(v[k]);
        return o;
    }
    return v;
}
/** Mescla profunda (arrays e null substituem). */
function merge(a, b) {
    for (const k in b) {
        const v = b[k];
        if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k])) merge(a[k], v);
        else if (v === null) delete a[k];
        else a[k] = v;
    }
    return a;
}
/** Escala todas as medidas lineares de um spec por k. */
function scaled(spec, k) {
    const s = cloneSpec(spec);
    for (const t of s.torso) for (let i = 0; i < 4; i++) t[i] *= k;
    if (s.torsoC) for (const t of s.torso) if (t[6] !== undefined) t[6] *= k;
    for (const n of s.neck) {
        for (let i = 0; i < 4; i++) n[i] *= k;
        if (n[5] !== undefined) n[5] *= k;
    }
    const H = s.head;
    H.at = H.at.map((v) => v * k);
    H.len *= k;
    for (const p of H.prof) for (let i = 1; i < 4; i++) p[i] *= k;
    const mul = (o, keys) => {
        if (o) for (const key of keys) if (typeof o[key] === 'number') o[key] *= k;
    };
    mul(H.mouth, ['y', 'y1']);
    mul(H.teeth, ['len']);
    mul(H.eye, ['up', 'r']);
    mul(H.ears, ['up', 'x', 'len', 'w']);
    mul(H.nose, ['r']);
    mul(H.nostril, ['up', 'x', 'r']);
    mul(H.frill, ['w', 'h', 'depth', 'stud']);
    for (const h of H.horns || []) mul(h, ['up', 'x', 'len', 'r']);
    for (const c of H.crests || []) {
        c.thick *= k;
        for (const pt of c.pts) {
            pt[1] *= k;
            pt[2] *= k;
        }
    }
    if (s.tail) {
        mul(s.tail, ['len', 'dy']);
        for (const p of s.tail.prof) {
            p[1] *= k;
            p[2] *= k;
        }
    }
    for (const L of [s.legs.front, s.legs.hind, s.arms]) {
        if (!L) continue;
        L.x *= k;
        L.J = L.J.map((j) => j.map((v) => v * k));
        L.r = L.r.map((r) => (Array.isArray(r) ? r.map((v) => v * k) : r * k));
        mul(L.foot, ['claws', 'claw']);
    }
    if (s.wings) {
        mul(s.wings, ['x', 'span', 'arm']);
        s.wings.root = s.wings.root.map((v) => v * k);
        s.wings.chord = s.wings.chord.map((v) => v * k);
        if (s.wings.sweep) s.wings.sweep = s.wings.sweep.map((v) => v * k);
    }
    mul(s.skin, ['tile']);
    const X = s.extras || {};
    mul(X.mane, ['len', 'w']);
    mul(X.plates, ['size']);
    mul(X.spikes, ['len']);
    mul(X.ridge, ['size', 'ref']);
    mul(X.spines, ['len']);
    mul(X.udder, ['z', 'r']);
    mul(X, ['saddleZ']);
    return s;
}
const derive = (base, k, patch) => merge(scaled(base, k), patch);

// Filhote de raposa: mesma espécie, age = 0 por padrão
CREATURES.foxCub = { ...CREATURES.fox, label: 'foxCub', defaultAge: 0 };

// Lobo-cinzento (Canis lupus): corpo 1,3 + cauda 0,45 · cernelha 0,8 · ~40 kg
CREATURES.wolf = derive(CREATURES.fox, 2.05, {
    label: 'wolf', mods: { head: 1.25, girth: 1.18, ear: 0.6, limb: 1.3, tail: 0.62, snout: 1.0, neck: 0.9 },
    tail: { a0: -0.9, curve: 0.3, prof: [[0, 0.05, 0.05], [0.25, 0.065, 0.065], [0.6, 0.075, 0.075], [0.9, 0.055, 0.055], [1, 0.012, 0.012]] },
    skin: { tile: 0.2 },
    coat: {
        base: 0x6e685e, belly: 0xcfc8ba, back: 0x2c2a27, backT: 0.3, backK: 0.8, edge: -0.3, socks: null, leg: 0xb4ac9c, tailTip: 0x1c1a18, tailTipT: 0.85,
        chin: 0xe2ddd2, muzzle: 0xb9b2a4, muzzleT: 0.7, earIn: 0xc8beac, earTip: 0x2a2826, iris: 0xc89a2a, pupil: 'round', legIn: 0.3
    },
    gait: { runTail: 0.5 }
});

// Cachorro (porte de labrador): corpo 0,95 · cernelha 0,58 · ~30 kg; orelhas caídas, cauda erguida
CREATURES.dog = derive(CREATURES.fox, 1.5, {
    label: 'dog', mods: { head: 1.3, girth: 1.25, limb: 1.4, snout: 0.9, tail: 0.75, neck: 0.9 },
    head: { ears: { t: 0.14, up: 0.035, x: 0.062, out: 2.75, back: -0.15, face: 8, shape: 'leaf', len: 0.125, w: 0.085, thick: 0.12 } },
    tail: { a0: -0.15, curve: 0.75, wag: 2.2, prof: [[0, 0.04, 0.04], [0.4, 0.034, 0.034], [0.8, 0.024, 0.024], [1, 0.01, 0.01]] },
    skin: { type: 'short', tile: 0.16 },
    coat: {
        base: 0xc9984f, belly: 0xdcb878, back: 0xb98742, backK: 0.5, edge: -0.4, socks: null, tailTip: null, chin: 0xdcbb80, muzzle: 0xc09050, muzzleT: 0.8,
        earIn: 0xb8843e, earTip: null, ear: 0xb8843e, iris: 0x4a2e14, pupil: 'round', legIn: 0.25, fn: null
    },
    gait: { pant: 0.1, runTail: 0.3, tailWave: 0.3 }
});

// Gato doméstico (Felis catus): corpo 0,46 + cauda 0,30 · cernelha 0,25 · ~4 kg
CREATURES.cat = {
    label: 'cat',
    torso: [
        [-0.06, 0.24, 0.185, 0.025, 2.1], [-0.02, 0.262, 0.15, 0.05, 2.2], [0.05, 0.268, 0.125, 0.058, 2.2], [0.13, 0.262, 0.118, 0.06, 2.2],
        [0.2, 0.262, 0.115, 0.058, 2.2], [0.26, 0.268, 0.125, 0.05, 2.2], [0.3, 0.26, 0.15, 0.04, 2.1]
    ],
    neck: [[0.335, 0.245, 0.036, 0.045]],
    neckBones: 2,
    head: {
        at: [0.37, 0.278], pitch: -0.2, len: 0.092,
        prof: [[0, 0.036, 0.036, 0.034], [0.25, 0.047, 0.042, 0.048, 2.3], [0.52, 0.046, 0.04, 0.047, 2.3], [0.7, 0.033, 0.034, 0.034], [0.86, 0.024, 0.029, 0.026], [1, 0.012, 0.016, 0.014]],
        mouth: { t0: 0.76, y: -0.012, y1: -0.011, tip: 0.965, gape: 0.8, inset: 0.98 },
        teeth: { n: 5, len: 0.006, fang: 1.5 },
        eye: { t: 0.6, up: 0.016, r: 0.012, fwd: 0.7 },
        ears: { t: 0.2, up: 0.038, x: 0.028, len: 0.046, w: 0.042, out: 0.4, back: 0.1, face: 0.6 },
        nose: { r: 0.0055 }
    },
    tail: { len: 0.3, a0: -0.55, curve: 1.3, bones: 6, wag: 0.8, prof: [[0, 0.015, 0.015], [0.5, 0.012, 0.012], [1, 0.008, 0.008]] },
    legs: {
        front: { x: 0.035, J: [[0.27, 0.19], [0.235, 0.135], [0.245, 0.055], [0.25, 0.016], [0.28, 0]], r: [[0.022, 0.038], [0.016, 0.021], [0.011, 0.012], [0.011, 0.011]], foot: { type: 'paw', w: 1.3 } },
        hind: { x: 0.038, J: [[0, 0.2], [0.05, 0.135], [-0.035, 0.085], [-0.02, 0.016], [0.015, 0]], r: [[0.026, 0.052], [0.02, 0.03], [0.011, 0.014], [0.01, 0.011]], back: [1, 1.15], foot: { type: 'paw', w: 1.25 } }
    },
    skin: { type: 'fur', tile: 0.07, pattern: { kind: 'stripes', n: 12, width: 0.3, c1: 0x2a231c, alpha: 0.7, mottle: 0.12 } },
    coat: {
        base: 0x94836c, belly: 0xd8cdb8, back: 0x6a5c48, backK: 0.6, edge: -0.4, chin: 0xe6ddcc, muzzle: 0xd6cab6, muzzleT: 0.82, earIn: 0xd6b8a8,
        nose: 0xb8706a, iris: 0x9aa63a, pupil: 'slit', legIn: 0.3
    },
    gait: { gallop: 'rotary', flex: 0.24, sit: 'haunch', nod: 0.15, runTail: 0.4, tailWave: 0.14, sleepCurl: 0.8 },
    juv: { size: 0.42, leg: 0.8, head: 1.35, snout: 0.75, tail: 0.7, ear: 1.0, girth: 1.1, eye: 1.3 }
};

// Tigre (Panthera tigris): corpo 1,9 + cauda 1,0 · cernelha 0,95 · ~200 kg
CREATURES.tiger = derive(CREATURES.cat, 3.9, {
    label: 'tiger', mods: { head: 1.0, girth: 1.1, limb: 1.3, ear: 0.6, snout: 1.1, tail: 0.85, eye: 0.7 },
    head: { ears: { shape: 'round', out: 0.5 }, teeth: { n: 6, len: 0.028, fang: 1.6 }, nose: { r: 0.028 } },
    tail: { a0: -0.75, curve: 0.9, prof: [[0, 0.07, 0.07], [0.5, 0.055, 0.055], [1, 0.04, 0.04]] },
    skin: { tile: 0.22, pattern: { kind: 'stripes', n: 15, width: 0.4, c1: 0x0f0c0a, alpha: 1, mottle: 0.1, warp: 1.5 } },
    coat: {
        base: 0xd98428, belly: 0xf3ede0, back: 0xc06a1c, backK: 0.5, edge: -0.35, chin: 0xf5efe4, muzzle: 0xf1e8d8, muzzleT: 0.78, earIn: 0xf0e6d4, ear: 0x15110e,
        nose: 0xc8787a, iris: 0xd8a83a, pupil: 'round', legIn: 0.5, tailBelly: true
    },
    gait: { tailWave: 0.1, breath: 1.2 }
});

// Coelho (Oryctolagus cuniculus): corpo 0,42 · orelhas 0,11 · ~2 kg; traseiras plantígradas longas
CREATURES.rabbit = {
    label: 'rabbit',
    torso: [
        [-0.03, 0.125, 0.06, 0.03, 2.1], [0, 0.172, 0.035, 0.06, 2.2], [0.06, 0.2, 0.025, 0.075, 2.2, 0.1], [0.14, 0.195, 0.025, 0.072, 2.2, 0.06],
        [0.21, 0.172, 0.035, 0.058, 2.2], [0.26, 0.158, 0.06, 0.042, 2.1]
    ],
    neck: [[0.287, 0.138, 0.035, 0.04]],
    neckBones: 2,
    head: {
        at: [0.31, 0.158], pitch: -0.25, len: 0.09,
        prof: [[0, 0.03, 0.03, 0.03], [0.25, 0.037, 0.034, 0.036], [0.5, 0.035, 0.032, 0.033], [0.75, 0.025, 0.027, 0.025], [1, 0.012, 0.015, 0.015]],
        mouth: { t0: 0.82, y: -0.012, tip: 0.97, gape: 0.4 },
        eye: { t: 0.42, up: 0.012, r: 0.0095, fwd: 0.05 },
        ears: { t: 0.08, up: 0.03, x: 0.015, len: 0.115, w: 0.036, out: 0.14, back: 0.3, face: 0.9, shape: 'long' },
        nose: { r: 0.0045 }
    },
    tail: { len: 0.05, a0: 0.5, curve: 0.5, bones: 2, wag: 0.2, prof: [[0, 0.026, 0.026], [0.6, 0.03, 0.03], [1, 0.016, 0.016]] },
    legs: {
        front: { x: 0.03, J: [[0.23, 0.1], [0.215, 0.065], [0.225, 0.03], [0.23, 0.012], [0.255, 0]], r: [[0.016, 0.026], [0.012, 0.015], [0.009, 0.01], [0.009, 0.009]], foot: { type: 'paw' } },
        hind: { x: 0.046, J: [[0.03, 0.11], [0.1, 0.072], [0, 0.022], [0.085, 0.012], [0.125, 0]], r: [[0.03, 0.052], [0.022, 0.03], [0.013, 0.014], [0.013, 0.011]], embed2: 0.9, foot: { type: 'paw', w: 1.1 } }
    },
    skin: { type: 'fur', tile: 0.06, pattern: { kind: 'plain', mottle: 0.16 } },
    coat: { base: 0x9a8468, belly: 0xe8e0d0, back: 0x7a6850, backK: 0.5, edge: -0.45, tailTip: 0xf4f0e8, tailTipT: 0.3, chin: 0xe8e0d0, earIn: 0xd8b0a4, nose: 0xc88a84, iris: 0x2a1a10, legIn: 0.4 },
    gait: { gallop: 'bound', hopWalk: true, flex: 0.3, sit: 'lie', nod: 0.1, tailWave: 0.02, breath: 3, runStride: 1.6 },
    juv: { size: 0.45, head: 1.3, ear: 0.7, leg: 0.9 }
};

// Esquilo-vermelho (Sciurus vulgaris): corpo 0,22 + cauda 0,2 · ~0,3 kg
CREATURES.squirrel = derive(CREATURES.rabbit, 0.55, {
    label: 'squirrel', mods: { head: 1.05, girth: 0.9 },
    head: { ears: { shape: 'point', out: 0.3, back: 0.1, face: 0.6, w: 0.016, len: 0.024 } },
    tail: { len: 0.2, a0: 1.25, curve: 1.5, bones: 6, wag: 1.2, keys: 8, prof: [[0, 0.01, 0.01], [0.25, 0.021, 0.021], [0.7, 0.026, 0.026], [0.92, 0.02, 0.02], [1, 0.006, 0.006]] },
    coat: { base: 0xa4501e, belly: 0xf0e6d4, back: 0x8a3c14, tailTip: null, tail: 0xb05a22, chin: 0xf0e6d4, earIn: 0xc88a5a, iris: 0x1a120c, nose: 0x3a2a22 },
    gait: { sit: 'haunch', tailWave: 0.1, breath: 4 }
});

// Ouriço (Erinaceus europaeus): corpo 0,24 · altura 0,13 · ~0,8 kg
CREATURES.hedgehog = {
    label: 'hedgehog',
    torso: [
        [-0.04, 0.08, 0.03, 0.03, 2.1], [0, 0.115, 0.015, 0.055, 2.3], [0.06, 0.13, 0.012, 0.065, 2.3, 0.1], [0.12, 0.125, 0.012, 0.062, 2.3, 0.08],
        [0.17, 0.105, 0.018, 0.05, 2.2], [0.2, 0.09, 0.03, 0.035, 2.1]
    ],
    neck: [[0.215, 0.062, 0.028, 0.03]],
    neckBones: 1,
    head: {
        at: [0.23, 0.06], pitch: -0.12, len: 0.065,
        prof: [[0, 0.027, 0.024, 0.026], [0.3, 0.026, 0.022, 0.026], [0.6, 0.016, 0.016, 0.016], [0.85, 0.009, 0.01, 0.009], [1, 0.005, 0.006, 0.005]],
        mouth: { t0: 0.62, y: -0.006, tip: 0.96, gape: 0.5 },
        eye: { t: 0.4, up: 0.011, r: 0.0045, fwd: 0.3 },
        ears: { t: 0.12, up: 0.02, x: 0.018, len: 0.017, w: 0.017, out: 0.6, shape: 'round' },
        nose: { r: 0.0045 }
    },
    tail: { len: 0.02, a0: -0.3, bones: 1, wag: 0, prof: [[0, 0.012, 0.012], [1, 0.005, 0.005]] },
    legs: {
        front: { x: 0.03, J: [[0.16, 0.045], [0.15, 0.03], [0.155, 0.015], [0.158, 0.007], [0.172, 0]], r: [0.011, 0.008, 0.006, 0.006], foot: { type: 'paw' } },
        hind: { x: 0.032, J: [[0.01, 0.045], [0.03, 0.03], [0, 0.016], [0.012, 0.007], [0.03, 0]], r: [0.013, 0.009, 0.006, 0.006], foot: { type: 'paw' } }
    },
    skin: { type: 'fur', tile: 0.05, pattern: { kind: 'plain', mottle: 0.15 } },
    coat: { base: 0x54442f, belly: 0xcfbf9f, face: 0xb09a78, chin: 0xcfbf9f, leg: 0x8a7458, spine: 0x3e3226, spineTip: 0xe6dcc2, earIn: 0x9a7a66, iris: 0x120c08, edge: -0.2 },
    extras: { spines: { len: 0.026, arc: 1.95, per: 21, t0: 0.12 } },
    gait: { sit: 'lie', nod: 0.1, tailWave: 0, breath: 3, lookAmp: 0.4 }
};

// Veado-vermelho macho (Cervus elaphus): corpo 1,9 · cernelha 1,2 · galhada; cauda curta
CREATURES.deer = derive(CREATURES.horse, 0.76, {
    label: 'deer', variant: null, mods: { girth: 0.86, head: 0.78, ear: 1.5, limb: 0.82, neck: 0.9 },
    head: {
        ears: { out: 0.9, back: 0.3, face: 0.6, shape: 'leaf' },
        horns: [{
            t: 0.06, up: 0.085, x: 0.04, len: 0.6, r: 0.02, d0: [0.5, 0.9, -0.5], d1: [0.35, 1, 0.5], taper: 0.5, color: 0x8a6a48,
            tines: [[0.15, 0.3, [0.2, 0.3, 1]], [0.4, 0.3, [0.2, 0.4, 1]], [0.65, 0.28, [0.1, 0.8, 0.8]], [0.85, 0.2, [-0.3, 1, 0.2]]]
        }]
    },
    tail: { len: 0.15, a0: -1.0, curve: 0, bones: 2, wag: 2, dy: 0.08, prof: [[0, 0.035, 0.035], [0.6, 0.035, 0.03], [1, 0.012, 0.01]] },
    legs: { front: { foot: { type: 'hoof', cloven: true } }, hind: { foot: { type: 'hoof', cloven: true } } },
    skin: { type: 'fur', tile: 0.2 },
    coat: {
        base: 0x94602e, belly: 0xe2d2b4, back: 0x6e4420, backK: 0.6, edge: -0.4, mane: null, socks: null, tail: 0xe8dcc4, muzzle: 0x2a1e16, muzzleT: 0.9,
        chin: 0xe6d8bc, earIn: 0xe0d0b4, neck: 0x7e5228, iris: 0x2a1a0e, legIn: 0.45
    },
    extras: { mane: null },
    gait: { nod: 0.5, runTail: 0.2, alertNeck: 0.3 },
    juv: { size: 0.45, leg: 1.1, head: 1.2, snout: 0.8, girth: 0.85 }
});

// Ovelha (Ovis aries): corpo 1,1 · cernelha 0,7 · ~70 kg; lã
CREATURES.sheep = derive(CREATURES.cow, 0.5, {
    label: 'sheep', mods: { girth: 1.22, head: 0.9, limb: 0.8, neck: 0.85, snout: 0.9 },
    head: { horns: null, ears: { len: 0.1, w: 0.055, out: 1.45 }, nostril: null, nose: { r: 0.012, up: 0.1 } },
    tail: { len: 0.2, a0: -1.4, curve: 0, bones: 2, wag: 1.5, prof: [[0, 0.03, 0.03], [0.6, 0.03, 0.03], [1, 0.015, 0.015]] },
    skin: { type: 'wool', tile: 0.22, pattern: { kind: 'plain', mottle: 0.2 } },
    coat: {
        base: 0xe6dfcc, belly: 0xd8d0bc, face: 0x2a2623, chin: 0x2a2623, muzzle: 0x2a2623, muzzleT: 0.5, socks: 0x2a2623, sockH: 0.56, earIn: 0x3a322c, ear: 0x2a2623,
        udder: null, tailTip: null, nose: 0x1a1614, iris: 0xa88a3a, pupil: 'bar', dirt: 0.2, legIn: 0
    },
    extras: { udder: null },
    gait: { nod: 0.6, tailWave: 0.1 },
    juv: { size: 0.4, leg: 1.1, head: 1.2, girth: 0.9 }
});

// Porco (Sus domesticus): corpo 1,4 · cernelha 0,75 · ~120 kg; focinho em disco, cauda enrolada
CREATURES.pig = {
    label: 'pig',
    torso: [
        [-0.2, 0.72, 0.42, 0.1, 2.3], [-0.1, 0.8, 0.3, 0.2, 2.4], [0.05, 0.84, 0.24, 0.25, 2.4], [0.3, 0.85, 0.2, 0.27, 2.4, 0.08],
        [0.55, 0.84, 0.2, 0.27, 2.4, 0.08], [0.75, 0.82, 0.24, 0.24, 2.4], [0.9, 0.78, 0.3, 0.2, 2.3]
    ],
    neck: [[1.0, 0.57, 0.17, 0.2, 2.3]],
    neckBones: 2,
    head: {
        at: [1.1, 0.6], pitch: -0.35, len: 0.36,
        prof: [[0, 0.14, 0.14, 0.14, 2.3], [0.25, 0.14, 0.14, 0.14, 2.4], [0.5, 0.11, 0.12, 0.11, 2.4], [0.75, 0.075, 0.09, 0.075, 2.5], [0.94, 0.06, 0.07, 0.062, 2.6], [1, 0.052, 0.058, 0.056, 3]],
        mouth: { t0: 0.6, y: -0.035, y1: -0.03, tip: 0.94, gape: 0.5 },
        eye: { t: 0.36, up: 0.075, r: 0.014, fwd: 0.25 },
        ears: { t: 0.1, up: 0.11, x: 0.09, len: 0.14, w: 0.12, out: 0.75, back: -0.7, face: 0.4, shape: 'leaf' },
        nostril: { t: 1.0, up: 0.004, x: 0.02, r: 0.013 }
    },
    tail: { len: 0.22, a0: 0.2, curve: 7, bones: 3, wag: 1.5, prof: [[0, 0.02, 0.02], [1, 0.008, 0.008]] },
    legs: {
        front: { x: 0.14, J: [[0.8, 0.46], [0.72, 0.32], [0.74, 0.16], [0.74, 0.07], [0.78, 0]], r: [[0.08, 0.125], [0.055, 0.07], [0.035, 0.04], [0.032, 0.034]], foot: { type: 'hoof', cloven: true } },
        hind: { x: 0.15, J: [[0, 0.5], [0.1, 0.36], [-0.06, 0.2], [-0.05, 0.07], [-0.01, 0]], r: [[0.1, 0.17], [0.07, 0.09], [0.035, 0.045], [0.032, 0.035]], foot: { type: 'hoof', cloven: true } }
    },
    skin: { type: 'skin', tile: 0.3, pattern: { kind: 'plain', mottle: 0.1 } },
    coat: { base: 0xe2a79c, belly: 0xe6b0a6, muzzle: 0xd88a84, muzzleT: 0.95, earIn: 0xd89088, hoof: 0x5a4a40, iris: 0x2a1a12, dirt: 0.35, dirtH: 0.3, legIn: 0 },
    gait: { gallop: 'transverse', flex: 0.04, sit: 'lie', nod: 0.5, tailWave: 0.05, chew: 8, runStride: 1.2 },
    juv: { size: 0.4, leg: 0.95, head: 1.25, snout: 0.8 }
};

// Urso-pardo (Ursus arctos): corpo 2,0 · cernelha 1,1 · ~300 kg; plantígrado, giba nos ombros
CREATURES.bear = {
    label: 'bear',
    torso: [
        [-0.25, 0.95, 0.6, 0.15, 2.2], [-0.1, 1.05, 0.5, 0.3, 2.3], [0.15, 1.1, 0.42, 0.36, 2.3], [0.5, 1.12, 0.4, 0.38, 2.3, 0.08],
        [0.85, 1.2, 0.42, 0.36, 2.3], [1.08, 1.19, 0.48, 0.32, 2.3], [1.28, 1.1, 0.56, 0.25, 2.2]
    ],
    neck: [[1.4, 0.87, 0.2, 0.24, 2.2]],
    neckBones: 2,
    head: {
        at: [1.5, 0.9], pitch: -0.3, len: 0.42,
        prof: [[0, 0.16, 0.16, 0.16], [0.2, 0.18, 0.17, 0.19, 2.4], [0.4, 0.16, 0.15, 0.17, 2.4], [0.58, 0.1, 0.12, 0.1], [0.8, 0.075, 0.1, 0.075], [0.95, 0.06, 0.085, 0.06], [1, 0.035, 0.05, 0.04]],
        mouth: { t0: 0.56, y: -0.045, y1: -0.04, tip: 0.96, gape: 0.75, inset: 0.97 },
        teeth: { n: 7, len: 0.028, fang: 1.7 },
        eye: { t: 0.43, up: 0.075, r: 0.017, fwd: 0.5 },
        ears: { t: 0.12, up: 0.15, x: 0.13, len: 0.095, w: 0.1, out: 0.5, shape: 'round' },
        nose: { r: 0.034 }
    },
    tail: { len: 0.12, a0: -0.9, bones: 1, wag: 0, prof: [[0, 0.06, 0.06], [1, 0.03, 0.03]] },
    legs: {
        front: { x: 0.25, J: [[1.02, 0.74], [0.93, 0.5], [0.98, 0.16], [1.04, 0.05], [1.18, 0]], r: [[0.15, 0.21], [0.12, 0.14], [0.09, 0.1], [0.09, 0.07]], foot: { type: 'paw', w: 1.25, toes: 5, claws: 0.06 } },
        hind: { x: 0.25, J: [[0, 0.75], [0.14, 0.5], [-0.1, 0.1], [0.06, 0.05], [0.2, 0]], r: [[0.18, 0.3], [0.14, 0.18], [0.09, 0.1], [0.1, 0.07]], foot: { type: 'paw', w: 1.2, toes: 5, claws: 0.05 } }
    },
    skin: { type: 'fur', tile: 0.22, pattern: { kind: 'plain', mottle: 0.2 } },
    coat: { base: 0x5c3c22, belly: 0x4a301c, back: 0x6e4a2a, backK: 0.4, muzzle: 0xa07e54, muzzleT: 0.72, chin: 0x6a4a2c, earIn: 0x3a281a, iris: 0x2a1a0e, legIn: 0, leg: 0x3e2a1a },
    gait: { gallop: 'transverse', flex: 0.12, sit: 'haunch', nod: 0.5, tailWave: 0, sitH: 0.3, breath: 1.1 },
    juv: { size: 0.4, head: 1.3, leg: 0.85, snout: 0.75, ear: 1.3 }
};

// Macaco (porte de macaco-prego/macaque): corpo 0,5 + cauda 0,55 · ~4 kg; anda nas quatro
CREATURES.monkey = {
    label: 'monkey',
    torso: [
        [-0.05, 0.36, 0.26, 0.04, 2.1], [0, 0.4, 0.22, 0.07, 2.2], [0.1, 0.41, 0.2, 0.08, 2.2], [0.22, 0.42, 0.2, 0.085, 2.2],
        [0.32, 0.42, 0.22, 0.08, 2.2], [0.38, 0.4, 0.27, 0.06, 2.1]
    ],
    neck: [[0.41, 0.4, 0.045, 0.05]],
    neckBones: 2,
    head: {
        at: [0.435, 0.44], pitch: -0.15, len: 0.11,
        prof: [[0, 0.05, 0.045, 0.045], [0.3, 0.062, 0.05, 0.058, 2.3], [0.6, 0.056, 0.05, 0.053, 2.3], [0.8, 0.034, 0.046, 0.038, 2.4], [0.94, 0.022, 0.04, 0.032, 2.4], [1, 0.012, 0.028, 0.022]],
        mouth: { t0: 0.8, y: -0.022, y1: -0.02, tip: 0.985, gape: 0.6, inset: 0.97 },
        teeth: { n: 4, len: 0.005, fang: 1.6 },
        eye: { t: 0.74, up: 0.02, r: 0.0105, fwd: 0.9 },
        ears: { t: 0.38, up: 0.005, x: 0.054, len: 0.032, w: 0.036, out: 1.25, shape: 'round', face: 0.8 },
        nostril: { t: 0.985, up: 0.004, x: 0.007, r: 0.004 }
    },
    tail: { len: 0.55, a0: -0.5, curve: 2.0, bones: 7, wag: 0.5, keys: 9, prof: [[0, 0.02, 0.02], [0.5, 0.014, 0.014], [1, 0.009, 0.009]] },
    legs: {
        front: { x: 0.06, J: [[0.34, 0.3], [0.32, 0.17], [0.35, 0.03], [0.375, 0.012], [0.425, 0]], r: [[0.03, 0.046], [0.022, 0.026], [0.016, 0.016], [0.018, 0.012]], foot: { type: 'paw', finger: 0.45, toes: 4, w: 1.1 } },
        hind: { x: 0.06, J: [[0, 0.3], [0.07, 0.17], [-0.03, 0.03], [0.035, 0.012], [0.095, 0]], r: [[0.04, 0.062], [0.028, 0.035], [0.016, 0.018], [0.018, 0.012]], foot: { type: 'paw', finger: 0.4, toes: 4, w: 1.1 } }
    },
    skin: { type: 'fur', tile: 0.08, pattern: { kind: 'plain', mottle: 0.16 } },
    coat: { base: 0x6c4a2a, belly: 0xc6a678, back: 0x4a3018, backK: 0.6, face: 0x7a5632, muzzle: 0xd4a888, muzzleT: 0.66, chin: 0xd4a888, earIn: 0xc89878, ear: 0xc89878, leg: 0x4a3018, iris: 0x6a3e16, legIn: 0.2 },
    gait: { gallop: 'bound', flex: 0.2, sit: 'haunch', nod: 0.2, tailWave: 0.15, sitH: 0.25 },
    juv: { size: 0.5, head: 1.3, leg: 0.9 }
};

// Galinha (Gallus gallus): altura 0,42 · corpo 0,35 · ~2 kg
CREATURES.chicken = {
    label: 'chicken',
    torso: [
        [-0.14, 0.36, 0.27, 0.04, 2.1], [-0.08, 0.385, 0.22, 0.08, 2.2], [0, 0.395, 0.18, 0.1, 2.2, 0.1], [0.08, 0.39, 0.17, 0.1, 2.2, 0.1],
        [0.14, 0.375, 0.2, 0.08, 2.2], [0.18, 0.365, 0.26, 0.05, 2.1]
    ],
    neck: [[0.2, 0.37, 0.04, 0.045], [0.215, 0.425, 0.03, 0.032]],
    neckBones: 3,
    head: {
        at: [0.225, 0.458], pitch: -0.12, len: 0.075,
        prof: [[0, 0.024, 0.024, 0.022], [0.3, 0.027, 0.024, 0.024], [0.55, 0.02, 0.02, 0.018], [0.75, 0.011, 0.012, 0.01], [1, 0.003, 0.004, 0.003]],
        mouth: { t0: 0.6, y: -0.003, tip: 0.95, gape: 0.45 },
        eye: { t: 0.36, up: 0.006, r: 0.0058, fwd: 0.05, inset: 0.5 },
        crests: [
            { pts: [[0.02, 0.024, 0.006], [0.12, 0.04, 0.016], [0.2, 0.036, 0.011], [0.3, 0.046, 0.019], [0.4, 0.038, 0.012], [0.5, 0.04, 0.016], [0.62, 0.024, 0.006]], thick: 0.004, color: 0xc0202a },
            { pts: [[0.5, -0.022, 0.01], [0.55, -0.04, 0.014], [0.56, -0.052, 0.008]], thick: 0.006, color: 0xc0202a }
        ]
    },
    tail: { len: 0.17, a0: 0.85, curve: -0.5, bones: 2, wag: 0.3, prof: [[0, 0.045, 0.06], [0.5, 0.018, 0.075], [1, 0.005, 0.035]] },
    legs: {
        hind: { x: 0.05, J: [[0, 0.24], [0.045, 0.19], [-0.01, 0.1], [0.005, 0.02], [0.06, 0]], r: [[0.04, 0.056], [0.028, 0.03], [0.007, 0.008], [0.008, 0.008]], top: 0.5, foot: { type: 'claw3', toeR: 0.55, claw: 0.012 } }
    },
    wings: { type: 'feather', x: 0.088, root: [0.1, 0.275], span: 0.22, chord: [0.13, 0.14, 0.12, 0.04], sweep: [0, 0, -0.01, -0.04], thick: 0.09, foldK: 0.8, foldC: 0.8 },
    skin: { type: 'feather', tile: 0.08, pattern: { kind: 'plain', mottle: 0.2 } },
    coat: {
        base: 0xb0602a, belly: 0xc48848, back: 0x8a4218, backK: 0.6, tail: 0x2a1e18, beak: 0xd9a23a, beakT: 0.58, leg: 0xd6b23c, claw: 0x4a4030, wing: 0x9a4e20, wingTip: 0x3a261a,
        iris: 0xc8621a, legIn: 0, dirt: 0.1,
        fn(part, t, y, P, C) {
            if (part === 'legH' && t < 0.55) P.ct = P.cb = C.belly;
        }
    },
    gait: { peck: true, nod: 1.6, tailWave: 0.02, breath: 3, lookAmp: 0.5, flyLegZ: 0.3, kfH: 0.4 },
    juv: { size: 0.3, head: 1.4, leg: 0.9, tail: 0.3 }
};

// Pato-real (Anas platyrhynchos): corpo 0,55 · envergadura 0,9 · ~1,1 kg; bico chato, pés palmados
CREATURES.duck = {
    label: 'duck',
    torso: [
        [-0.2, 0.3, 0.2, 0.04, 2.1], [-0.12, 0.33, 0.16, 0.09, 2.3], [0, 0.345, 0.12, 0.115, 2.3, 0.12], [0.1, 0.34, 0.12, 0.11, 2.3, 0.1],
        [0.18, 0.32, 0.15, 0.09, 2.2], [0.23, 0.31, 0.2, 0.06, 2.1]
    ],
    neck: [[0.26, 0.335, 0.04, 0.045], [0.275, 0.4, 0.03, 0.033]],
    neckBones: 3,
    head: {
        at: [0.285, 0.44], pitch: -0.08, len: 0.11,
        prof: [[0, 0.027, 0.027, 0.025], [0.22, 0.03, 0.027, 0.027], [0.42, 0.022, 0.022, 0.022], [0.55, 0.012, 0.014, 0.02, 2.6], [0.8, 0.007, 0.01, 0.022, 3], [1, 0.004, 0.005, 0.016, 3]],
        mouth: { t0: 0.5, y: -0.004, tip: 0.97, gape: 0.35 },
        eye: { t: 0.28, up: 0.009, r: 0.005, fwd: 0.05, inset: 0.5 }
    },
    tail: { len: 0.09, a0: 0.25, curve: 0.3, bones: 2, wag: 2, prof: [[0, 0.05, 0.03], [1, 0.012, 0.008]] },
    legs: {
        hind: { x: 0.06, J: [[-0.02, 0.17], [0.03, 0.13], [-0.01, 0.07], [0, 0.015], [0.06, 0]], r: [[0.035, 0.05], [0.022, 0.025], [0.007, 0.008], [0.008, 0.008]], top: 0.5, foot: { type: 'claw3', toeR: 0.5, claw: 0.006, web: true, hallux: false } }
    },
    wings: { type: 'feather', x: 0.105, root: [0.12, 0.245], span: 0.36, chord: [0.14, 0.15, 0.13, 0.04], sweep: [0, 0, -0.02, -0.08], thick: 0.08, foldK: 0.72, foldC: 0.7 },
    skin: { type: 'feather', tile: 0.09, pattern: { kind: 'plain', mottle: 0.16 } },
    coat: {
        base: 0x9c968a, belly: 0xcfc9bc, back: 0x6a6258, backK: 0.6, face: 0x1c5632, chin: 0x1c5632, neck: 0x5c3220, tail: 0x1e1c1a, beak: 0xd8b02a, beakT: 0.47,
        leg: 0xe07a22, claw: 0x8a4a1a, wing: 0x7a7468, wingTip: 0x2a3a6a, iris: 0x3a2412, legIn: 0, dirt: 0.05
    },
    gait: { nod: 1.2, tailWave: 0.04, breath: 3, swimNeck: 0, kfH: 0.4, flyNeck: 0.1 },
    juv: { size: 0.3, head: 1.4, tail: 0.5 }
};

// Ganso doméstico (Anser anser): corpo 0,85 · envergadura 1,6 · ~4 kg; pescoço longo
CREATURES.goose = derive(CREATURES.duck, 1.55, {
    label: 'goose',
    neck: [[0.42, 0.56, 0.058, 0.066], [0.47, 0.68, 0.04, 0.045], [0.49, 0.8, 0.036, 0.04]],
    neckBones: 4,
    head: { at: [0.515, 0.89], pitch: -0.12 },
    coat: {
        base: 0xf0eee8, belly: 0xf4f2ec, back: 0xdedad0, face: 0xf0eee8, chin: 0xf0eee8, neck: 0xf0eee8, tail: 0xf0eee8, beak: 0xe07a1a, leg: 0xe07a1a,
        wing: 0xe6e2da, wingTip: 0xc8c4bc, iris: 0x3a5a8a
    },
    gait: { nod: 1, alertNeck: 0.15 }
});

// Passarinho (porte de pisco/pardal): 0,14 · ~20 g; anda aos saltos
CREATURES.bird = derive(CREATURES.chicken, 0.33, {
    label: 'bird', mods: { leg: 0.7, head: 1.25, neck: 0.6, eye: 1.3 },
    head: { crests: null },
    tail: { len: 0.05, a0: -0.15, curve: 0.2, prof: [[0, 0.011, 0.01], [0.5, 0.012, 0.005], [1, 0.012, 0.003]] },
    wings: { span: 0.085, foldK: 0.8 },
    skin: { tile: 0.03 },
    coat: {
        base: 0x7a6248, belly: 0xe6dccb, back: 0x5c4834, tail: 0x4a3a2a, face: 0xd8682a, chin: 0xd8682a, neck: 0xc86a30, beak: 0x2a2420, leg: 0x6a4a3a, wing: 0x66523c, wingTip: 0x3a2c20,
        iris: 0x120c08, fn: null
    },
    gait: { hop: true, peck: false, nod: 0.5, breath: 5 }
});

// Coruja (porte de coruja-do-mato): altura 0,38 · envergadura 0,95; corpo ereto, disco facial, olhos frontais
CREATURES.owl = {
    label: 'owl',
    torsoC: true,
    torso: [[-0.075, 0.07, 0.03, 0.03, 2.1], [-0.05, 0.13, 0.07, 0.065, 2.2], [-0.02, 0.2, 0.09, 0.085, 2.2], [0.005, 0.27, 0.085, 0.08, 2.2]],
    neck: [[0.02, 0.31, 0.07, 0.068]],
    neckBones: 2,
    head: {
        at: [0.01, 0.345], pitch: 0.05, len: 0.105,
        prof: [[0, 0.05, 0.052, 0.058, 2.2], [0.3, 0.058, 0.058, 0.066, 2.3], [0.62, 0.056, 0.056, 0.064, 2.4], [0.86, 0.045, 0.046, 0.054, 2.8], [1, 0.02, 0.022, 0.028, 2.6]],
        eye: { t: 0.84, up: 0.012, r: 0.0145, fwd: 1.0, inset: 0.55 },
        crests: [{ pts: [[0.97, -0.006, 0.008], [1.04, -0.018, 0.006], [1.06, -0.03, 0.002]], thick: 0.005, color: 0xc8b070 }]
    },
    tail: { len: 0.1, a0: -1.25, curve: 0, bones: 2, wag: 0, prof: [[0, 0.04, 0.02], [1, 0.035, 0.006]] },
    legs: {
        hind: { x: 0.04, J: [[-0.02, 0.1], [0.012, 0.07], [-0.012, 0.035], [-0.005, 0.012], [0.03, 0]], r: [[0.03, 0.036], [0.022, 0.024], [0.011, 0.012], [0.009, 0.009]], top: 0.4, foot: { type: 'claw3', toeR: 0.6, claw: 0.014 } }
    },
    wings: { type: 'feather', x: 0.075, root: [0.045, 0.27], span: 0.4, chord: [0.2, 0.2, 0.18, 0.07], sweep: [0, 0, -0.01, -0.06], thick: 0.06, foldK: 0.5, foldC: 0.55, foldSweep: 0.35, foldRoll: 1.5 },
    skin: { type: 'feather', tile: 0.08, pattern: { kind: 'spots', n: 12, r: 0.28, c1: 0x3a2a1c, alpha: 0.6, belly: 0, mottle: 0.2 } },
    coat: {
        base: 0x8a6a48, belly: 0xd8c8a8, back: 0x6a4e34, face: 0xd8c8a8, muzzle: 0xe2d6bc, muzzleT: 0.8, chin: 0xd8c8a8, tail: 0x6a4e34, leg: 0xcfc0a0, claw: 0x1a1612,
        wing: 0x7a5c3e, wingTip: 0x4a3626, iris: 0xe0a21a, sclera: 0x0e0a08, legIn: 0, dirt: 0, edge: -0.1
    },
    gait: { hop: true, nod: 0.2, tailWave: 0, lookAmp: 1.4, breath: 2 }
};

// Velociraptor mongoliensis: 2,0 m · quadril 0,5 m · ~15 kg; garra-foice, braços longos, emplumado opcional
CREATURES.velociraptor = derive(CREATURES.trex, 0.158, {
    label: 'velociraptor',
    variant(spec, o) {
        if (o.feathers === false) return { ...spec, skin: { ...spec.skin, type: 'scales' }, wings: undefined, coat: { ...spec.coat, tailTip: null } };
        return spec;
    },
    mods: { girth: 0.78, limb: 0.72 },
    neck: [[0.55, 0.585, 0.04, 0.05], [0.6, 0.66, 0.034, 0.042], [0.64, 0.73, 0.03, 0.036]],
    head: {
        at: [0.67, 0.77], pitch: -0.12, len: 0.25,
        prof: [[0, 0.036, 0.04, 0.034, 2.2], [0.15, 0.044, 0.046, 0.044, 2.4], [0.32, 0.042, 0.044, 0.04, 2.4], [0.5, 0.03, 0.038, 0.026, 2.3], [0.75, 0.024, 0.032, 0.02, 2.3], [0.94, 0.018, 0.026, 0.016, 2.3], [1, 0.008, 0.014, 0.009]],
        mouth: { t0: 0.3, y: -0.01, y1: -0.012, tip: 0.965, gape: 0.8, inset: 0.92, hinge: 0.08 },
        teeth: { n: 12, len: 0.012, show: true, thick: 0.22 },
        eye: { t: 0.34, up: 0.02, r: 0.011, fwd: 0.4, brow: 0.6 },
        nostril: { t: 0.92, up: 0.01, r: 0.004 },
        horns: null
    },
    tail: { len: 1.05, a0: 0.02, curve: 0.05, bones: 7, wag: 0.3, prof: [[0, 0.07, 0.085], [0.25, 0.04, 0.045], [0.7, 0.018, 0.02], [0.86, 0.03, 0.012], [1, 0.012, 0.004]] },
    arms: { x: 0.07, J: [[0.4, 0.4], [0.37, 0.3], [0.45, 0.25], [0.51, 0.2]], r: [0.022, 0.017, 0.014], foot: { type: 'claws', n: 3, claw: 0.045 } },
    legs: { hind: { foot: { type: 'claw3', toeR: 0.55, claw: 0.05 } } },
    wings: { type: 'feather', x: 0.07, root: [0.41, 0.4], span: 0.3, chord: [0.1, 0.12, 0.11, 0.04], sweep: [0, 0, -0.01, -0.03], thick: 0.06, foldK: 0.75, foldC: 0.7, foldSweep: 1.3, foldRoll: 1.5, cosmetic: true },
    skin: { type: 'feather', tile: 0.11, pattern: { kind: 'bands', n: 5, bands: 9, c1: 0x2e2218, alpha: 0.6, mottle: 0.2 } },
    coat: {
        base: 0x8a5e34, belly: 0xdccdb0, back: 0x4e3620, backT: 0.35, tailTip: 0xe8e0d0, tailTipT: 0.9, iris: 0xd8b02a, pupil: 'slit', sclera: 0x1a0e08,
        wing: 0x5e4024, wingTip: 0xe0d6c2, claw: 0x15110e, leg: 0x6a5a48, legIn: 0.2
    },
    extras: { ridge: null },
    gait: { nod: 0.8, tailWave: 0.06, breath: 1.8, lookAmp: 0.7, bow: 0.7, runStride: 1.5, runDuty: 0.36, runK: 1.5 },
    juv: { size: 0.4, head: 1.2, snout: 0.8, eye: 1.4 }
});

// Stegosaurus stenops: 9 m · quadril 2,75 m (dorso arqueado a 3,3 m) · cabeça baixa; 17 placas, 4 espigões
CREATURES.stegosaurus = {
    label: 'stegosaurus',
    torso: [
        [-0.8, 2.75, 1.9, 0.4, 2.2], [-0.3, 3.1, 1.5, 0.75, 2.3], [0.4, 3.25, 1.2, 0.95, 2.3, 0.06], [1.2, 3.1, 1.0, 1.0, 2.3, 0.1],
        [2.0, 2.7, 0.95, 0.9, 2.3, 0.08], [2.6, 2.25, 1.0, 0.7, 2.3], [3.0, 1.95, 1.15, 0.45, 2.2]
    ],
    neck: [[3.4, 1.46, 0.27, 0.3, 2.2], [3.8, 1.22, 0.2, 0.22, 2.2]],
    neckBones: 3,
    head: {
        at: [4.1, 1.1], pitch: -0.18, len: 0.5,
        prof: [[0, 0.14, 0.14, 0.13], [0.25, 0.15, 0.14, 0.14, 2.4], [0.5, 0.12, 0.12, 0.11, 2.4], [0.75, 0.09, 0.1, 0.08, 2.3], [0.92, 0.07, 0.08, 0.06], [1, 0.03, 0.04, 0.03]],
        mouth: { t0: 0.48, y: -0.035, y1: -0.03, tip: 0.96, gape: 0.4 },
        eye: { t: 0.36, up: 0.07, r: 0.024, fwd: 0.15, brow: 0.5 },
        nostril: { t: 0.88, up: 0.035, r: 0.014 }
    },
    tail: { len: 4.2, a0: -0.25, curve: 0.3, bones: 7, wag: 0.5, prof: [[0, 0.4, 0.5], [0.5, 0.2, 0.22], [1, 0.05, 0.05]] },
    legs: {
        front: { x: 0.62, J: [[2.6, 1.45], [2.45, 0.95], [2.55, 0.42], [2.57, 0.18], [2.72, 0]], r: [[0.3, 0.4], [0.22, 0.26], [0.16, 0.18], [0.17, 0.18]], foot: { type: 'column', nails: 3 } },
        hind: { x: 0.6, J: [[0, 2.3], [0.45, 1.45], [0.05, 0.6], [0.15, 0.2], [0.4, 0]], r: [[0.42, 0.6], [0.3, 0.36], [0.19, 0.22], [0.2, 0.21]], back: [1, 1.12], foot: { type: 'column', nails: 3 } }
    },
    skin: { type: 'scales', tile: 0.6, pattern: { kind: 'mottle', n: 4, c1: 0x4a5232, alpha: 0.55, mottle: 0.2 } },
    coat: {
        base: 0x74804e, belly: 0xbdb68c, back: 0x525a36, backT: 0.3, beak: 0x4a4230, beakT: 0.82, plate: 0x7a5a3a, plateTip: 0xc8742a, horn: 0xd6c8a8,
        iris: 0xb8862a, sclera: 0x140e08, claw: 0x34302a, dirt: 0.3, legIn: 0.35
    },
    extras: { plates: { size: 1.05, neck: 3, torso: 7, tail: 6 }, spikes: { t0: 0.8, t1: 0.94, n: 2, len: 0.75 } },
    gait: { gallop: 'transverse', flex: 0.02, sit: 'lie', nod: 0.5, tailWave: 0.1, breath: 0.8, lookAmp: 0.4, amble: true, runStride: 1.0, bow: 0.2 },
    juv: { size: 0.3, head: 1.3, leg: 0.95 }
};

// Pteranodon longiceps: envergadura 6 m · crânio com crista 1,6 m · ~25 kg; voa (no chão é o preset mais fraco)
CREATURES.pteranodon = {
    label: 'pteranodon',
    torso: [
        [-0.25, 0.9, 0.7, 0.06, 2.1], [-0.15, 0.98, 0.62, 0.13, 2.2], [0, 1.02, 0.58, 0.17, 2.2], [0.2, 1.04, 0.58, 0.19, 2.2],
        [0.35, 1.02, 0.64, 0.16, 2.2], [0.45, 0.98, 0.72, 0.1, 2.1]
    ],
    neck: [[0.56, 0.96, 0.07, 0.08], [0.7, 1.12, 0.06, 0.066], [0.82, 1.28, 0.055, 0.06]],
    neckBones: 4,
    head: {
        at: [0.9, 1.38], pitch: -0.35, len: 1.0,
        prof: [[0, 0.07, 0.07, 0.06], [0.12, 0.085, 0.075, 0.07, 2.3], [0.3, 0.07, 0.065, 0.055, 2.3], [0.6, 0.04, 0.045, 0.03], [0.85, 0.02, 0.025, 0.015], [1, 0.005, 0.006, 0.004]],
        mouth: { t0: 0.25, y: -0.014, y1: -0.004, tip: 0.985, gape: 0.5, inset: 0.95 },
        eye: { t: 0.17, up: 0.035, r: 0.022, fwd: 0.2 },
        crests: [{ pts: [[0.16, 0.06, 0.06], [-0.15, 0.2, 0.085], [-0.5, 0.36, 0.06], [-0.78, 0.47, 0.015]], thick: 0.014, color: 0xc85a2a }]
    },
    tail: { len: 0.2, a0: -0.2, bones: 2, wag: 0, prof: [[0, 0.05, 0.05], [1, 0.012, 0.012]] },
    legs: {
        hind: { x: 0.12, J: [[0, 0.75], [0.12, 0.5], [-0.04, 0.22], [0, 0.03], [0.1, 0]], r: [[0.07, 0.1], [0.05, 0.055], [0.02, 0.022], [0.02, 0.02]], top: 0.4, foot: { type: 'claw3', toes: [-0.5, -0.17, 0.17, 0.5], hallux: false, toeR: 0.4, claw: 0.03 } }
    },
    wings: { type: 'membrane', x: 0.16, root: [0.28, 0.98], span: 2.85, chord: [0.75, 0.62, 0.44, 0.03], seg: [0.22, 0.3, 0.48], sweep: [0, 0.12, 0.08, -0.5], thick: 0.012, arm: 0.045, fingers: true, foldK: 0.38, foldSweep: 1.1, foldRoll: 1.35, amp: 0.6 },
    skin: { type: 'skin', tile: 0.25, pattern: { kind: 'mottle', n: 5, c1: 0x5a4a3c, alpha: 0.35, mottle: 0.15 } },
    coat: {
        base: 0x7c6a58, belly: 0xdcd0bc, back: 0x5a4a3c, beak: 0xd8b872, beakT: 0.26, wing: 0x8a705c, wingUnder: 0xcdb89e, wingTip: 0x5a4638, leg: 0x6a5a4c,
        iris: 0xd8a02a, sclera: 0x120c08, claw: 0x1a1612, legIn: 0, dirt: 0.1
    },
    gait: { nod: 0.6, tailWave: 0, flyLegZ: 0.75, flyLegY: 0.12, flyTail: 0, flyNeck: -0.15, breath: 1.5, lookAmp: 0.5 },
    juv: { size: 0.3, head: 0.8 }
};

// Dragão (fantasia): 9,5 m · cernelha 2,3 m · envergadura 11 m; quadrúpede alado, chifres, crista dorsal
CREATURES.dragon = {
    label: 'dragon',
    torso: [
        [-0.5, 2.3, 1.75, 0.22, 2.2], [-0.2, 2.5, 1.5, 0.42, 2.3], [0.3, 2.6, 1.35, 0.52, 2.3], [1.0, 2.6, 1.3, 0.55, 2.3, 0.06],
        [1.7, 2.65, 1.3, 0.56, 2.3], [2.2, 2.66, 1.45, 0.5, 2.3], [2.6, 2.62, 1.75, 0.36, 2.2]
    ],
    neck: [[3.0, 2.6, 0.26, 0.32, 2.2], [3.4, 3.1, 0.22, 0.26, 2.2], [3.75, 3.6, 0.19, 0.22, 2.2], [4.05, 3.95, 0.17, 0.19, 2.2]],
    neckBones: 5,
    head: {
        at: [4.25, 4.1], pitch: -0.3, len: 1.0,
        prof: [[0, 0.2, 0.2, 0.19, 2.3], [0.15, 0.24, 0.24, 0.26, 2.6], [0.32, 0.22, 0.22, 0.23, 2.6], [0.5, 0.16, 0.19, 0.16, 2.5], [0.75, 0.13, 0.16, 0.13, 2.5], [0.94, 0.11, 0.13, 0.12, 2.5], [1, 0.05, 0.07, 0.07, 2.3]],
        mouth: { t0: 0.3, y: -0.05, y1: -0.05, tip: 0.965, gape: 0.85, inset: 0.9, hinge: 0.08 },
        teeth: { n: 11, len: 0.075, show: true, thick: 0.24 },
        eye: { t: 0.3, up: 0.11, r: 0.04, fwd: 0.4, brow: 0.9 },
        nostril: { t: 0.93, up: 0.07, r: 0.025 },
        horns: [
            { t: 0.05, up: 0.2, x: 0.14, len: 0.75, r: 0.07, d0: [0.3, 0.5, -0.8], d1: [0.2, 0.95, -0.3] },
            { t: 0.14, up: 0.04, x: 0.24, len: 0.3, r: 0.04, d0: [0.8, 0.1, -0.6], d1: [0.6, 0.3, -0.7] }
        ]
    },
    tail: { len: 4.6, a0: -0.3, curve: 0.36, bones: 8, wag: 0.5, prof: [[0, 0.3, 0.36], [0.5, 0.14, 0.16], [1, 0.03, 0.03]] },
    legs: {
        front: { x: 0.42, J: [[2.3, 1.85], [2.05, 1.25], [2.15, 0.6], [2.18, 0.2], [2.55, 0]], r: [[0.24, 0.38], [0.17, 0.22], [0.1, 0.12], [0.11, 0.12]], bulge: [1.06, 1.05], foot: { type: 'claw3', toeR: 0.6, claw: 0.18 } },
        hind: { x: 0.4, J: [[0, 2.0], [0.5, 1.3], [-0.25, 0.75], [-0.1, 0.2], [0.35, 0]], r: [[0.3, 0.5], [0.22, 0.28], [0.11, 0.14], [0.12, 0.13]], bulge: [1.08, 1.08], back: [1, 1.25], foot: { type: 'claw3', toeR: 0.6, claw: 0.2 } }
    },
    wings: { type: 'membrane', x: 0.36, root: [1.9, 2.5], span: 5.1, chord: [2.2, 1.9, 1.5, 0.1], seg: [0.25, 0.3, 0.45], sweep: [0, 0.35, 0.15, -1.2], thick: 0.01, arm: 0.1, fingers: true, foldK: 0.36, foldSweep: 1.05, foldRoll: 1.3, amp: 0.7 },
    skin: { type: 'scales', tile: 0.45, pattern: { kind: 'mottle', n: 4, c1: 0x3a1210, alpha: 0.6, mottle: 0.22 } },
    coat: {
        base: 0x8a2a22, belly: 0xc89a5c, back: 0x4a1414, backT: 0.35, edge: -0.35, wing: 0x6e2a22, wingUnder: 0xb8704a, wingTip: 0x3a1414, horn: 0xd8ccae,
        iris: 0xe8b21a, pupil: 'slit', sclera: 0x1a0a06, claw: 0x15110e, legIn: 0.4, dirt: 0.2
    },
    extras: { ridge: { size: 0.3, ref: 0.4, rake: 0.6, runs: [['neck', 0, 1, 10], ['torso', 0, 1, 12], ['tail', 0.1, 1, 18]] } },
    gait: { gallop: 'rotary', flex: 0.1, sit: 'haunch', nod: 0.4, tailWave: 0.1, breath: 0.9, lookAmp: 0.5, flyLegZ: 0.4, flyLegY: 0.5, flyTail: 0.25, sitH: 0.45 }
};

export const CREATURE_NAMES = () => Object.keys(CREATURES);

