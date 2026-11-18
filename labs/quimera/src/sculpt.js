/**
 * Quimera — bancada de escultura: geradores de malha lisa e biblioteca de materiais PBR.
 *
 * Nenhuma peça do ateliê usa primitiva crua. Tudo sai de quatro geradores, todos com
 * vértices compartilhados (normais suaves), UV em metros e cantos vivos só onde pedidos:
 *
 *   revolve(perfil)     torno: perfil [r, y] suavizado por Catmull-Rom e girado; `deform`
 *                       entorta o resultado (aba de tricórnio, copa amassada, bojo oval)
 *   tube(caminho, r)    tubo de raio variável ao longo de uma curva, com tampas abauladas
 *   surface(nu, nv, f)  grade paramétrica livre (asas, lâminas, placas curvas)
 *   extrude(forma)      contorno 2D extrudado com chanfro e normais por vinco
 *
 * Unidades: metros do "adulto canônico" do hero.js (1,78 m). As peças são presas com
 * worldScale:false, então acompanham a escala de cada corpo.
 *
 * Materiais: `createBank()` devolve uma biblioteca com cache. Existem dois bancos (A/B)
 * porque a troca de peça mostra o boneco antigo e o novo ao mesmo tempo, cada um com o
 * seu plano de varredura (ver SWEEP abaixo).
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { pbrSet, tiledTexture } from '../../shared/gfx/assets.js';

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
    const t = clamp((x - a) / (b - a));
    return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------------------
// Grade com normais soldadas por linha
// ---------------------------------------------------------------------------

/**
 * Grade (nu+1)×(nv+1). fn(u, v, p, i, j) escreve a posição em p (Vector3).
 * Normais: computeVertexNormals + solda dos vértices coincidentes DENTRO da mesma linha
 * (costura do giro e polos). Linhas duplicadas (canto vivo) não se soldam entre si.
 * UV: u = comprimento ao longo da linha (m), v = comprimento acumulado entre linhas (m).
 */
export function surface(nu, nv, fn, { flip = false } = {}) {
    const row = nu + 1;
    const pos = new Float32Array(row * (nv + 1) * 3);
    const uv = new Float32Array(row * (nv + 1) * 2);
    const p = new THREE.Vector3();
    for (let j = 0; j <= nv; j++) {
        for (let i = 0; i <= nu; i++) {
            p.set(0, 0, 0);
            fn(i / nu, j / nv, p, i, j);
            const k = (j * row + i) * 3;
            pos[k] = p.x;
            pos[k + 1] = p.y;
            pos[k + 2] = p.z;
        }
    }
    // UV métrico: distância acumulada na coluna do meio e ao longo de cada linha
    const mid = nu >> 1;
    let vAcc = 0;
    for (let j = 0; j <= nv; j++) {
        if (j > 0) {
            const a = (j * row + mid) * 3;
            const b = ((j - 1) * row + mid) * 3;
            vAcc += Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]);
        }
        let uAcc = 0;
        for (let i = 0; i <= nu; i++) {
            if (i > 0) {
                const a = (j * row + i) * 3;
                const b = a - 3;
                uAcc += Math.hypot(pos[a] - pos[b], pos[a + 1] - pos[b + 1], pos[a + 2] - pos[b + 2]);
            }
            const k = (j * row + i) * 2;
            uv[k] = uAcc;
            uv[k + 1] = vAcc;
        }
    }
    const idx = [];
    for (let j = 0; j < nv; j++) {
        for (let i = 0; i < nu; i++) {
            const a = j * row + i;
            const b = a + 1;
            const c = a + row;
            const d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
    }
    // orientação: faces para fora do centroide (peças fechadas e cascas convexas); `flip` inverte
    let cx = 0, cy = 0, cz = 0;
    const nvx = pos.length / 3;
    for (let k = 0; k < pos.length; k += 3) {
        cx += pos[k];
        cy += pos[k + 1];
        cz += pos[k + 2];
    }
    cx /= nvx;
    cy /= nvx;
    cz /= nvx;
    let acc = 0;
    for (let k = 0; k < idx.length; k += 3) {
        const a = idx[k] * 3, b = idx[k + 1] * 3, c = idx[k + 2] * 3;
        const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
        const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
        acc += (uy * vz - uz * vy) * ((pos[a] + pos[b] + pos[c]) / 3 - cx)
            + (uz * vx - ux * vz) * ((pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - cy)
            + (ux * vy - uy * vx) * ((pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - cz);
    }
    if ((acc < 0) !== flip) {
        for (let k = 0; k < idx.length; k += 3) {
            const t = idx[k + 1];
            idx[k + 1] = idx[k + 2];
            idx[k + 2] = t;
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    weldRows(geo, row, nv + 1);
    return geo;
}

function weldRows(geo, row, rows) {
    const P = geo.attributes.position.array;
    const N = geo.attributes.normal.array;
    const map = new Map();
    for (let j = 0; j < rows; j++) {
        map.clear();
        for (let i = 0; i < row; i++) {
            const k = (j * row + i) * 3;
            const key = `${Math.round(P[k] * 2e4)},${Math.round(P[k + 1] * 2e4)},${Math.round(P[k + 2] * 2e4)}`;
            let list = map.get(key);
            if (!list) map.set(key, (list = []));
            list.push(k);
        }
        for (const list of map.values()) {
            if (list.length < 2) continue;
            let x = 0, y = 0, z = 0;
            for (const k of list) {
                x += N[k];
                y += N[k + 1];
                z += N[k + 2];
            }
            const l = Math.hypot(x, y, z) || 1;
            for (const k of list) {
                N[k] = x / l;
                N[k + 1] = y / l;
                N[k + 2] = z / l;
            }
        }
    }
}

/**
 * Perfil suave. pts: [[r, y], …]; um terceiro elemento 1 marca canto vivo (a curva é
 * quebrada ali e a linha é duplicada). `sub` = subdivisões por trecho.
 */
export function profile(pts, sub = 5) {
    const out = [];
    let seg = [];
    const flush = () => {
        if (seg.length === 1) out.push([seg[0].x, seg[0].y]);
        else if (seg.length > 1) {
            const curve = new THREE.SplineCurve(seg);
            const n = (seg.length - 1) * sub;
            for (let i = 0; i <= n; i++) {
                const q = curve.getPoint(i / n);
                out.push([Math.max(0, q.x), q.y]);
            }
        }
    };
    for (const pt of pts) {
        seg.push(new THREE.Vector2(pt[0], pt[1]));
        if (pt[2]) {
            flush();
            seg = [new THREE.Vector2(pt[0], pt[1])];
        }
    }
    flush();
    return out;
}

/**
 * Torno. `pts` como em profile(). Opções:
 *   segs    divisões do giro (48)      sub     subdivisões do perfil (5)
 *   arc     ângulo coberto (2π)        start   ângulo inicial (0 = +Z)
 *   sx, sz  achatamento elíptico       deform  (p, ângulo, k 0..1 ao longo do perfil, r) entorta
 */
export function revolve(pts, { segs = 48, sub = 5, arc = TAU, start = 0, sx = 1, sz = 1, deform = null, flip = false } = {}) {
    const rows = profile(pts, sub);
    const nv = rows.length - 1;
    return surface(segs, nv, (u, v, p, i, j) => {
        const a = start + arc * u;
        const r = rows[j][0];
        p.set(Math.sin(a) * r * sx, rows[j][1], Math.cos(a) * r * sz);
        if (deform) deform(p, a, v, r);
    }, { flip });
}

/**
 * Caixa de cantos boleados: seção em superelipse (expoente n; 2 = oval, 4+ = quase retângulo)
 * de w × d e perfil vertical de altura h com raio de canto `round` (fração da meia-largura).
 */
export function pill(w, h, d, { n = 4, round = 0.35, segs = 36, deform = null } = {}) {
    const c = round;
    const k = Math.min(c * Math.min(w, d) * 0.5, h * 0.5);
    const e = 2 / n;
    return revolve([
        [0, -h / 2], [1 - c, -h / 2], [1 - c * 0.3, -h / 2 + k * 0.3], [1, -h / 2 + k], [1, h / 2 - k], [1 - c * 0.3, h / 2 - k * 0.3], [1 - c, h / 2], [0, h / 2]
    ], { segs, sub: 3, deform: (p, a, v, r) => {
        const sn = Math.sin(a);
        const cs = Math.cos(a);
        p.x = (w / 2) * r * Math.sign(sn) * Math.pow(Math.abs(sn), e);
        p.z = (d / 2) * r * Math.sign(cs) * Math.pow(Math.abs(cs), e);
        if (deform) deform(p, a, v);
    } });
}

/** Elipsoide esculpível (torno de meia-circunferência + deform). */
export function blob(rx, ry, rz, { segs = 32, rings = 18, deform = null } = {}) {
    return surface(segs, rings, (u, v, p) => {
        const a = u * TAU;
        const ph = v * Math.PI;
        const s = Math.sin(ph);
        p.set(Math.sin(a) * s * rx, Math.cos(ph) * ry, Math.cos(a) * s * rz);
        if (deform) deform(p, a, v);
    });
}

/**
 * Tubo ao longo de pontos (Catmull-Rom). radius: número ou (t 0..1) => raio.
 *   segs lados (12) · steps amostras do caminho · cap 0..1 (abaulamento das tampas; 0 = aberto)
 *   sx estica a seção no eixo "para cima" do caminho, sz no eixo lateral · closed fecha o caminho (anel)
 * O referencial acompanha o caminho por transporte paralelo (sem torção brusca).
 */
export function tube(points, radius = 0.01, { segs = 12, steps = 0, cap = 0.6, sx = 1, sz = 1, closed = false, tension = 0.5 } = {}) {
    const pts = points.map((q) => (q.isVector3 ? q : new THREE.Vector3(q[0], q[1], q[2])));
    const curve = pts.length > 2 ? new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', tension) : new THREE.LineCurve3(pts[0], pts[1]);
    const n = steps || Math.max(2, (pts.length - 1) * 8);
    const rf = typeof radius === 'function' ? radius : () => radius;
    const P = [];
    const T = [];
    for (let i = 0; i <= n; i++) {
        P.push(curve.getPoint(i / n));
        T.push(curve.getTangent(i / n).normalize());
    }
    // transporte paralelo
    const N = [];
    const B = [];
    let nrm = new THREE.Vector3(0, 1, 0);
    if (Math.abs(T[0].y) > 0.9) nrm.set(1, 0, 0);
    nrm.sub(T[0].clone().multiplyScalar(nrm.dot(T[0]))).normalize();
    for (let i = 0; i <= n; i++) {
        nrm = nrm.clone().sub(T[i].clone().multiplyScalar(nrm.dot(T[i]))).normalize();
        N.push(nrm);
        B.push(new THREE.Vector3().crossVectors(T[i], nrm).normalize());
    }
    // linhas: tampa inicial (3) + corpo (n+1) + tampa final (3)
    const rows = [];
    const capRows = cap > 0 && !closed ? [Math.PI / 2, Math.PI / 3, Math.PI / 6] : [];
    for (const ph of capRows) rows.push({ i: 0, off: -Math.sin(ph) * cap, k: Math.cos(ph) });
    for (let i = 0; i <= n; i++) rows.push({ i, off: 0, k: 1 });
    for (const ph of [...capRows].reverse()) rows.push({ i: n, off: Math.sin(ph) * cap, k: Math.cos(ph) });
    const geo = surface(segs, rows.length - 1, (u, v, p, ii, j) => {
        const rw = rows[j];
        const r = rf(rw.i / n);
        const a = u * TAU;
        const c = Math.cos(a) * r * rw.k * sx;
        const s = Math.sin(a) * r * rw.k * sz;
        p.copy(P[rw.i]).addScaledVector(T[rw.i], rw.off * r).addScaledVector(N[rw.i], c).addScaledVector(B[rw.i], s);
    });
    if (closed) {
        // anel: a primeira e a última linha coincidem (a menos da torção do transporte) — iguala as normais
        const nrmA = geo.attributes.normal;
        const last = (rows.length - 1) * (segs + 1);
        for (let i = 0; i <= segs; i++) {
            const x = nrmA.getX(i) + nrmA.getX(last + i);
            const y = nrmA.getY(i) + nrmA.getY(last + i);
            const z = nrmA.getZ(i) + nrmA.getZ(last + i);
            const l = Math.hypot(x, y, z) || 1;
            nrmA.setXYZ(i, x / l, y / l, z / l);
            nrmA.setXYZ(last + i, x / l, y / l, z / l);
        }
    }
    return geo;
}

/** Anel (tubo fechado) a partir de fn(ângulo 0..2π) → [x, y, z]. Passe closed:false para um arco. */
export function loop(fn, r, n = 40, opts = {}) {
    const pts = [];
    const closed = opts.closed !== false;
    const m = closed ? n : n + 1;
    for (let i = 0; i < m; i++) pts.push(fn((i / n) * TAU));
    return tube(pts, r, { closed: true, steps: n * 2, segs: 8, ...opts });
}

/** Forma 2D fechada passando por pontos [x, y] (spline) — para extrude(). */
export function shapeOf(points, { curved = true } = {}) {
    const sh = new THREE.Shape();
    const v = points.map((q) => new THREE.Vector2(q[0], q[1]));
    sh.moveTo(v[0].x, v[0].y);
    if (curved) sh.splineThru([...v.slice(1), v[0]]);
    else {
        for (let i = 1; i < v.length; i++) sh.lineTo(v[i].x, v[i].y);
        sh.closePath();
    }
    return sh;
}

/**
 * Extrusão com chanfro arredondado, centrada em z. As normais são recalculadas por vinco:
 * faces a menos de `crease` graus entre si viram superfície lisa; o resto fica aresta.
 */
export function extrude(shape, { depth = 0.01, bevel = 0.003, bevelSegs = 3, curveSegs = 20, crease = 38 } = {}) {
    const b = Math.min(bevel, depth * 0.49);
    let g = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(1e-4, depth - b * 2), bevelEnabled: b > 0, bevelThickness: b, bevelSize: b, bevelOffset: -b,
        bevelSegments: bevelSegs, curveSegments: curveSegs
    });
    g.translate(0, 0, -(depth - b * 2) / 2);
    g.deleteAttribute('normal');
    g = toCreasedNormals(mergeVertices(g, 1e-5), (crease * Math.PI) / 180);
    return g;
}

/** Aplica posição/rotação/escala a uma geometria (devolve a mesma). */
export function xf(geo, { p = null, r = null, s = null } = {}) {
    if (s) {
        if (typeof s === 'number') geo.scale(s, s, s);
        else geo.scale(s[0], s[1], s[2]);
    }
    if (r) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r[0], r[1], r[2], r[3] || 'XYZ')));
    if (p) geo.translate(p[0], p[1], p[2]);
    return geo;
}

/** Funde geometrias que dividem o mesmo material (1 draw call). Normaliza índice/atributos. */
export function fuse(list) {
    const norm = list.filter(Boolean).map((g) => {
        const n = g.index ? g.toNonIndexed() : g;
        for (const name of Object.keys(n.attributes)) {
            if (name !== 'position' && name !== 'normal' && name !== 'uv') n.deleteAttribute(name);
        }
        if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
        return n;
    });
    return norm.length === 1 ? norm[0] : mergeGeometries(norm, false);
}

/** Mesh pronto (sombra ligada). `geo` pode ser uma lista (fundida). */
export function mesh(geo, material, { p = null, r = null, s = null, shadow = true } = {}) {
    const m = new THREE.Mesh(Array.isArray(geo) ? fuse(geo) : geo, material);
    if (p) m.position.fromArray(p);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    if (s) {
        if (typeof s === 'number') m.scale.setScalar(s);
        else m.scale.fromArray(s);
    }
    m.castShadow = shadow;
    m.receiveShadow = shadow;
    return m;
}

export function group(...children) {
    const g = new THREE.Group();
    for (const c of children) if (c) g.add(c);
    return g;
}

// ---------------------------------------------------------------------------
// SWEEP — plano de varredura da troca de peça
//
// Cada banco tem um uniform uSweep = (yLo, yCut, modo, _) em metros do mundo:
//   modo 0  tudo visível
//   modo 1  "entrando": só aparece o trecho yLo ≤ y ≤ yCut
//   modo 2  "saindo":   some o trecho yLo ≤ y ≤ yCut
// O plano yCut sobe com o tempo; a borda ganha um fio emissivo de 4 cm (cor uSweepColor)
// e um serrilhado de ±1,5 cm por ruído de tela, para não parecer um corte de régua.
// ---------------------------------------------------------------------------
const SWEEP_VERT = 'varying float vQy;\n';
const SWEEP_FRAG = /* glsl */ `varying float vQy;
uniform vec4 uSweep;
uniform vec3 uSweepColor;
float qHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

export function sweepable(material, bank, chain = null) {
    material.onBeforeCompile = (sh, renderer) => {
        if (chain) chain(sh, renderer);
        sh.uniforms.uSweep = bank.uniforms.uSweep;
        sh.uniforms.uSweepColor = bank.uniforms.uSweepColor;
        sh.vertexShader = SWEEP_VERT + sh.vertexShader.replace('#include <project_vertex>',
            '#include <project_vertex>\nvQy = (modelMatrix * vec4(transformed, 1.0)).y;');
        sh.fragmentShader = SWEEP_FRAG + sh.fragmentShader
            .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
    float qEdge = 0.0;
    if (uSweep.z > 0.5) {
        float qn = (qHash(floor(gl_FragCoord.xy * 0.5)) - 0.5) * 0.03;
        bool qIn = vQy >= uSweep.x && vQy + qn <= uSweep.y;
        if (uSweep.z < 1.5 ? !qIn : qIn) discard;
        qEdge = smoothstep(0.045, 0.0, abs(vQy - uSweep.y));
    }`)
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n    totalEmissiveRadiance += uSweepColor * qEdge * 5.0;');
    };
    return material;
}

/** Clona um material do hero.js para o banco, mantendo o patch original e somando a varredura. */
const heroClones = [new WeakMap(), new WeakMap()];
export function heroMaterial(orig, bank) {
    const cache = heroClones[bank.index];
    let c = cache.get(orig);
    if (!c) {
        c = orig.clone();
        const baseKey = orig.customProgramCacheKey ? orig.customProgramCacheKey() : '';
        sweepable(c, bank, orig.onBeforeCompile ? orig.onBeforeCompile.bind(orig) : null);
        c.customProgramCacheKey = () => `${baseKey}:quimera`;
        cache.set(orig, c);
    }
    return c;
}

// ---------------------------------------------------------------------------
// Biblioteca de materiais
// ---------------------------------------------------------------------------
let lowTier = false;
/** No tier low o vidro perde a transmissão (um passe extra da cena) e vira transparência simples. */
export function setSculptTier(tier) {
    lowTier = tier === 'low';
}

/**
 * Banco de materiais. Chaves (todas com cache por parâmetros):
 *   metal(cor, rugosidade)          aço/ouro/latão: metalness 1 + relevo e manchas de rusty_metal_02
 *   leather(cor, { albedo })        couro: normal/AO de brown_leather; albedo=true usa a foto do couro
 *   cloth(cor, { denim })           feltro/lona: normal de fabric_pattern_07 ou denim_fabric + sheen
 *   wood(cor, { dark })             madeira: albedo+normal de oak_wood_planks / dark_wooden_planks
 *   paint(cor, rugosidade, verniz)  plástico/esmalte/cerâmica (clearcoat)
 *   glass(cor, { ior, thickness })  vidro com transmissão (visor, lentes, frasco)
 *   glow(cor, intensidade)          emissivo (LED, orbe, chama) — estoura no bloom de propósito
 *   feather(cor)                    pena/pétala: tecido fino dupla face
 */
export function createBank(index) {
    const bank = {
        index,
        uniforms: {
            uSweep: { value: new THREE.Vector4(0, 0, 0, 0) },
            uSweepColor: { value: new THREE.Color(1.0, 0.72, 0.36) }
        },
        cache: new Map()
    };
    const make = (key, factory) => {
        let m = bank.cache.get(key);
        if (!m) {
            m = sweepable(factory(), bank);
            m.customProgramCacheKey = () => 'quimeraGear';
            m.name = `quimera:${key}`;
            bank.cache.set(key, m);
        }
        return m;
    };
    const hex = (c) => (typeof c === 'number' ? c.toString(16) : c);

    bank.metal = (color = 0xc8ccd4, roughness = 0.32, { clean = false } = {}) => make(`metal:${hex(color)}:${roughness}:${clean}`, () => {
        const set = pbrSet('rusty_metal_02');
        const m = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness, envMapIntensity: 1.25 });
        if (!clean) {
            m.normalMap = tiledTexture(set.normalMap, 5);
            m.normalScale.set(0.22, 0.22);
            m.roughnessMap = tiledTexture(set.roughnessMap, 5);
            m.roughness = Math.min(1, roughness * 1.9);
        }
        return m;
    });
    bank.leather = (color = 0x6b4226, { albedo = false, roughness = 0.82 } = {}) => make(`leather:${hex(color)}:${albedo}:${roughness}`, () => {
        const set = pbrSet('brown_leather');
        const m = new THREE.MeshStandardMaterial({
            color, roughness, metalness: 0, normalMap: tiledTexture(set.normalMap, 6), aoMap: tiledTexture(set.aoMap, 6),
            roughnessMap: tiledTexture(set.roughnessMap, 6), side: THREE.DoubleSide
        });
        if (albedo) {
            m.map = tiledTexture(set.map, 6);
            m.color.multiplyScalar(2.2);
        }
        m.normalScale.set(0.9, 0.9);
        return m;
    });
    bank.cloth = (color = 0x8a6a4a, { denim = false, roughness = 0.94, sheen = 0.5 } = {}) => make(`cloth:${hex(color)}:${denim}:${roughness}:${sheen}`, () => {
        const set = pbrSet(denim ? 'denim_fabric' : 'fabric_pattern_07');
        const m = new THREE.MeshPhysicalMaterial({
            color, roughness, metalness: 0, normalMap: tiledTexture(set.normalMap, denim ? 7 : 5), side: THREE.DoubleSide,
            sheen, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.35)
        });
        m.normalScale.set(denim ? 0.9 : 0.6, denim ? 0.9 : 0.6);
        return m;
    });
    bank.wood = (color = 0xffffff, { dark = false, roughness = 0.7, rep = 3 } = {}) => make(`wood:${hex(color)}:${dark}:${roughness}:${rep}`, () => {
        const set = pbrSet(dark ? 'dark_wooden_planks' : 'oak_wood_planks');
        const m = new THREE.MeshStandardMaterial({
            color, roughness, metalness: 0, map: tiledTexture(set.map, rep), normalMap: tiledTexture(set.normalMap, rep),
            roughnessMap: tiledTexture(set.roughnessMap, rep), aoMap: tiledTexture(set.aoMap, rep)
        });
        m.color.multiplyScalar(dark ? 1.9 : 1.25);
        return m;
    });
    bank.paint = (color = 0xffffff, roughness = 0.45, clearcoat = 0.4, { side = THREE.FrontSide } = {}) => make(`paint:${hex(color)}:${roughness}:${clearcoat}:${side}`, () => new THREE.MeshPhysicalMaterial({
        color, roughness, metalness: 0, clearcoat, clearcoatRoughness: 0.18, side
    }));
    bank.glass = (color = 0xffffff, { ior = 1.45, thickness = 0.02, roughness = 0.02, opacity = 0.28, tint = 0.35 } = {}) => make(`glass:${hex(color)}:${ior}:${thickness}:${roughness}:${opacity}:${lowTier}`, () => {
        if (lowTier) {
            return new THREE.MeshPhysicalMaterial({
                color, roughness: 0.05, metalness: 0, transparent: true, opacity, envMapIntensity: 1.6, depthWrite: false,
                side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.03
            });
        }
        return new THREE.MeshPhysicalMaterial({
            color: 0xffffff, roughness, metalness: 0, transmission: 1, ior, thickness, attenuationColor: new THREE.Color(color),
            attenuationDistance: thickness / Math.max(0.05, tint), envMapIntensity: 1.5, side: THREE.DoubleSide,
            specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.02
        });
    });
    bank.glow = (color = 0xffc070, intensity = 2.5, base = 0x111111) => make(`glow:${hex(color)}:${intensity}:${hex(base)}`, () => new THREE.MeshStandardMaterial({
        color: base, emissive: color, emissiveIntensity: intensity, roughness: 0.4, metalness: 0
    }));
    bank.feather = (color = 0xffffff, { roughness = 0.6, opacity = 1, emissive = 0x000000, glow = 0 } = {}) => make(`feather:${hex(color)}:${roughness}:${opacity}:${hex(emissive)}:${glow}`, () => new THREE.MeshPhysicalMaterial({
        color, roughness, metalness: 0, side: THREE.DoubleSide, sheen: 0.6, sheenRoughness: 0.4,
        sheenColor: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.5), transparent: opacity < 1, opacity,
        emissive, emissiveIntensity: glow, depthWrite: opacity >= 1
    }));
    return bank;
}
