/**
 * A Jornada do Anel — alvenaria e marcenaria: peças de arquitetura geradas por
 * código (perfis torneados, formas extrudadas com vãos recortados, caixas
 * chanfradas) e fundidas por material num `Batch`.
 *
 * Todo o cenário construído de um capítulo vira ~1 malha por material: as peças
 * entram no lote já na posição final, recebem UV em metros do mundo
 * (`applyWorldUV`) e uma cor de vértice (tinta de porta, pedra mais escura…).
 *
 * Desenho próprio: nenhum elemento copia arquitetura de livro ou filme.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applyWorldUV, fbm2 } from '../../shared/gfx/core.js';
import { pbrMaterial } from '../../shared/gfx/assets.js';

const TAU = Math.PI * 2;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

/** Matriz TRS (posição, giro em Y, escala) — açúcar para montar o lote. */
export function trs(x = 0, y = 0, z = 0, ry = 0, s = 1, rx = 0, rz = 0) {
    _e.set(rx, ry, rz, 'YXZ');
    _q.setFromEuler(_e);
    return new THREE.Matrix4().compose(_p.set(x, y, z), _q, typeof s === 'number' ? _s.set(s, s, s) : _s.set(s[0], s[1], s[2]));
}

/* ------------------------------------------------------------------ */
/* Materiais (compartilhados entre capítulos; nunca descartados)       */
/* ------------------------------------------------------------------ */

const matCache = new Map();
const MAT_DEFS = {
    // pedra clara dos elfos / ruínas
    stoneLight: () => pbrMaterial('plastered_wall_04', { color: 0xf3eee2, normalScale: 0.8 }),
    stoneBlock: () => pbrMaterial('medieval_blocks_02', { color: 0xd9d2c4 }),
    stoneWall: () => pbrMaterial('castle_wall_slates', { color: 0xcfc8ba }),
    stoneDark: () => pbrMaterial('medieval_blocks_02', { color: 0x7d838c, normalScale: 1.2 }),
    cobble: () => pbrMaterial('cobblestone_floor_08', { color: 0xd0c8b8 }),
    slate: () => pbrMaterial('slate_floor_02', { color: 0xcfcac0 }),
    slateDark: () => pbrMaterial('slate_floor_02', { color: 0x8a847c, normalScale: 1.2 }),
    mossStone: () => pbrMaterial('mossy_cobblestone', { color: 0xd4d0c2 }),
    rock: () => pbrMaterial('cliff_side', { color: 0xc9c2b6, normalScale: 1.3 }),
    rockDark: () => pbrMaterial('cliff_side', { color: 0x77706a, normalScale: 1.5 }),
    mossRock: () => pbrMaterial('mossy_rock', { color: 0xd8d8cc }),
    wood: () => pbrMaterial('oak_wood_planks', { color: 0xe8d8bc }),
    woodDark: () => pbrMaterial('dark_wooden_planks', { color: 0xd8c8b0 }),
    woodOld: () => pbrMaterial('weathered_brown_planks', { color: 0xe0d4c4 }),
    plaster: () => pbrMaterial('plastered_wall_04', { color: 0xf4ecd8 }),
    thatch: () => pbrMaterial('thatch_roof_angled', { color: 0xe6d8a8 }),
    cloth: () => pbrMaterial('fabric_pattern_07', { color: 0xffffff, normalScale: 0.6, side: THREE.DoubleSide }),
    iron: () => pbrMaterial('rusty_metal_02', { color: 0x8a8580, metal: true, roughness: 0.85 }),
    brass: () => new THREE.MeshStandardMaterial({ color: 0xd9a53a, metalness: 1, roughness: 0.28 }),
    // vidro de janela aceso por dentro (a cor de vértice dá o tom)
    glow: () => new THREE.MeshStandardMaterial({ color: 0x1a1208, emissive: 0xffb45a, emissiveIntensity: 2.2, roughness: 0.4 }),
    crystal: () => new THREE.MeshPhysicalMaterial({
        color: 0x9fe8ff, emissive: 0x2aa8d8, emissiveIntensity: 1.6, roughness: 0.12, metalness: 0, clearcoat: 1, flatShading: true
    })
};

/** Material nomeado do lab (com cor de vértice ligada, para o lote tingir). */
export function mat(key) {
    if (!matCache.has(key)) {
        const m = MAT_DEFS[key]();
        m.vertexColors = true;
        m.userData.shared = true;
        matCache.set(key, m);
    }
    return matCache.get(key);
}

/* ------------------------------------------------------------------ */
/* Lote                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Junta geometrias por material. `add(material, geometria, matriz, cor, uv)`:
 *   uv > 0  → UV reprojetado em metros do mundo, 1 repetição a cada `uv` m
 *   uv = 0  → mantém o UV da própria geometria
 */
export class Batch {
    constructor() {
        this.lists = new Map();
    }

    add(material, geometry, matrix = null, color = 0xffffff, uv = 2) {
        const m = typeof material === 'string' ? mat(material) : material;
        let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
        if (matrix) g.applyMatrix4(matrix);
        if (!g.attributes.normal) g.computeVertexNormals();
        if (uv > 0) applyWorldUV(g, uv);
        else if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
        for (const name of Object.keys(g.attributes)) {
            if (name !== 'position' && name !== 'normal' && name !== 'uv') g.deleteAttribute(name);
        }
        _c.set(color);
        const n = g.attributes.position.count;
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            col[i * 3] = _c.r;
            col[i * 3 + 1] = _c.g;
            col[i * 3 + 2] = _c.b;
        }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
        if (!this.lists.has(m)) this.lists.set(m, []);
        this.lists.get(m).push(g);
        if (g !== geometry) geometry.dispose?.();
        return this;
    }

    /** Devolve um Group com uma Mesh por material. */
    build({ castShadow = true, receiveShadow = true, name = 'alvenaria' } = {}) {
        const group = new THREE.Group();
        group.name = name;
        for (const [material, list] of this.lists) {
            const merged = mergeGeometries(list, false);
            list.forEach((g) => g.dispose());
            if (!merged) continue;
            merged.computeBoundingSphere();
            const mesh = new THREE.Mesh(merged, material);
            mesh.castShadow = castShadow && !material.emissiveIntensity;
            mesh.receiveShadow = receiveShadow;
            group.add(mesh);
        }
        this.lists.clear();
        return group;
    }
}

/* ------------------------------------------------------------------ */
/* Peças básicas                                                        */
/* ------------------------------------------------------------------ */

/** Bloco chanfrado (nunca uma caixa de quina viva). Origem no centro da base. */
export function block(w, h, d, bevel = 0.04) {
    const g = new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w * 0.45, h * 0.45, d * 0.45));
    g.translate(0, h / 2, 0);
    return g;
}

/** Sólido de revolução a partir de um perfil [[raio, y], …] (de baixo para cima). */
export function turned(profile, segments = 24) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
    const g = new THREE.LatheGeometry(pts, segments);
    g.computeVertexNormals();
    return g;
}

/** Forma 2D extrudada ao longo de Z (centrada em Z), com chanfro. */
export function slab(shape, depth, bevel = 0.03, curveSegments = 18) {
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: Math.max(0.01, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel,
        bevelSegments: 2, curveSegments, steps: 1
    });
    g.translate(0, 0, -(depth - bevel * 2) / 2);
    return g;
}

/**
 * Coluna torneada com caneluras: o fuste tem o raio modulado em volta,
 *   r(θ) = r · (1 − prof · max(0, cos(n·θ))²)        (n = número de caneluras)
 * e êntase leve (mais grossa a 1/3 da altura). Base e capitel são molduras.
 * `broken` (0..1) corta o topo em bisel irregular (ruína).
 */
export function column({ height = 4, radius = 0.32, flutes = 12, depth = 0.09, capital = 1, base = 1, broken = 0, seed = 1 } = {}) {
    const r = radius;
    const hb = 0.34 * base * r * 2;
    const hc = broken ? 0 : 0.5 * capital * r * 2;
    const prof = [];
    // base: plinto + toro + escócia
    prof.push([r * 1.55, 0], [r * 1.55, hb * 0.34], [r * 1.42, hb * 0.38], [r * 1.48, hb * 0.6], [r * 1.3, hb * 0.82], [r * 1.12, hb]);
    const y0 = hb;
    const y1 = height - hc;
    const rows = Math.max(6, Math.round((y1 - y0) / 0.5));
    for (let i = 0; i <= rows; i++) {
        const t = i / rows;
        const ent = 1 + 0.05 * Math.sin(Math.min(1, t * 1.5) * Math.PI) - 0.1 * t;
        prof.push([r * ent, y0 + (y1 - y0) * t]);
    }
    if (!broken) {
        prof.push([r * 0.98, y1 + hc * 0.08], [r * 1.18, y1 + hc * 0.3], [r * 1.12, y1 + hc * 0.42], [r * 1.5, y1 + hc * 0.72],
            [r * 1.62, y1 + hc * 0.8], [r * 1.62, height]);
    }
    const seg = flutes * 4;
    const g = turned(prof, seg);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        let y = pos.getY(i);
        const z = pos.getZ(i);
        const rad = Math.hypot(x, z);
        const th = Math.atan2(z, x);
        let k = 1;
        if (y > y0 + 0.02 && y < y1 - 0.02) {
            const c = Math.max(0, Math.cos(th * flutes));
            k = 1 - depth * c * c;
        }
        if (broken && y > height * (1 - 0.5 * broken)) {
            // quebra: plano inclinado + ruído, só rebaixa
            const cut = height - broken * height * 0.5 * (0.5 + 0.5 * Math.cos(th + seed)) - 0.25 * fbm2(x * 3 + seed, z * 3, 2);
            y = Math.min(y, cut);
        }
        pos.setXYZ(i, (x / (rad || 1)) * rad * k, y, (z / (rad || 1)) * rad * k);
    }
    g.computeVertexNormals();
    return g;
}

/**
 * Parede com vãos recortados. Contorno: retângulo, ou arco se `arch` (flecha em m).
 * holes: [{ x, y, r }] círculos · [{ x, y, w, h, arch }] portas/janelas (y = soleira).
 */
export function wall({ width, height, thick = 0.4, arch = 0, holes = [], bevel = 0.03 }) {
    const hw = width / 2;
    const s = new THREE.Shape();
    s.moveTo(-hw, 0);
    s.lineTo(hw, 0);
    if (arch > 0) {
        s.lineTo(hw, height - arch);
        // meia elipse
        s.absellipse(0, height - arch, hw, arch, 0, Math.PI, false, 0);
    } else {
        s.lineTo(hw, height);
        s.lineTo(-hw, height);
    }
    s.closePath();
    for (const h of holes) {
        const p = new THREE.Path();
        if (h.r) p.absarc(h.x, h.y, h.r, 0, TAU, true);
        else {
            const w2 = h.w / 2;
            const a = h.arch ?? 0;
            p.moveTo(h.x - w2, h.y);
            p.lineTo(h.x - w2, h.y + h.h - a);
            if (a > 0) p.absellipse(h.x, h.y + h.h - a, w2, a, Math.PI, 0, true, 0);
            else {
                p.lineTo(h.x - w2, h.y + h.h);
                p.lineTo(h.x + w2, h.y + h.h);
            }
            p.lineTo(h.x + w2, h.y);
            p.closePath();
        }
        s.holes.push(p);
    }
    return slab(s, thick, bevel, 28);
}

/** Aro de seção retangular (moldura de porta/janela redonda): anel extrudado. */
export function ring(rOut, rIn, depth, bevel = 0.02) {
    const s = new THREE.Shape();
    s.absarc(0, 0, rOut, 0, TAU, false);
    const h = new THREE.Path();
    h.absarc(0, 0, rIn, 0, TAU, true);
    s.holes.push(h);
    return slab(s, depth, bevel, 32);
}

/** Disco (tampo de porta redonda, tampa de barril). */
export function disc(r, depth, bevel = 0.02) {
    const s = new THREE.Shape();
    s.absarc(0, 0, r, 0, TAU, false);
    return slab(s, depth, bevel, 32);
}

/**
 * Arco de pedra em pé no plano XY: dois pés-direitos e arco pleno (ou ogival),
 * de espessura `thick`. `span` = vão livre, `pier` = largura do pé, `rise` = altura do nascimento.
 * ogival > 0 desloca os centros dos dois arcos (arco quebrado).
 */
export function arch({ span = 2.4, pier = 0.5, rise = 2.2, thick = 0.5, crown = 0.45, ogival = 0, flat = true }) {
    const hw = span / 2;
    const R = hw + ogival;
    const s = new THREE.Shape();
    const aTop = Math.acos(ogival / R);
    const top = rise + Math.sin(aTop) * R + crown;
    s.moveTo(-hw - pier, 0);
    s.lineTo(-hw, 0);
    s.lineTo(-hw, rise);
    // intradorso: arco esquerdo centrado em (+ogival, rise), direito em (−ogival, rise), raio R
    const n = 14;
    for (let i = 1; i <= n; i++) {
        const a = Math.PI - (i / n) * aTop;
        s.lineTo(ogival + Math.cos(a) * R, rise + Math.sin(a) * R);
    }
    for (let i = 1; i <= n; i++) {
        const a = aTop * (1 - i / n);
        s.lineTo(-ogival + Math.cos(a) * R, rise + Math.sin(a) * R);
    }
    s.lineTo(hw, 0);
    s.lineTo(hw + pier, 0);
    if (flat) {
        s.lineTo(hw + pier, top);
        s.lineTo(-hw - pier, top);
    } else {
        // extradorso acompanhando o arco
        const Ro = R + crown;
        s.lineTo(hw + pier, rise);
        for (let i = 1; i < n; i++) {
            const a = (i / n) * Math.PI;
            s.lineTo(Math.cos(a) * (hw + pier), rise + Math.sin(a) * Ro);
        }
        s.lineTo(-hw - pier, rise);
    }
    s.closePath();
    return slab(s, thick, 0.035, 12);
}

/**
 * Ponte de pedra em arco. Eixo ao longo de Z local, centrada na origem; y = 0 é o
 * nível das cabeceiras. Perfil do tabuleiro (lombada):
 *   y(z) = rise · (1 − (2z/L)²)
 * @returns {{ parts: Array<[string, THREE.BufferGeometry]>, deck(z) → y, half: number }}
 */
export function stoneBridge({ length = 12, width = 3, rise = 0.9, arches = 1, depth = 2.4, parapet = 0.75, rail = true }) {
    const L = length;
    const hl = L / 2;
    const deck = (z) => rise * (1 - (2 * z / L) ** 2);
    const side = new THREE.Shape();
    const N = 20;
    side.moveTo(-hl, deck(-hl));
    for (let i = 1; i <= N; i++) {
        const z = -hl + (i / N) * L;
        side.lineTo(z, deck(z));
    }
    side.lineTo(hl, -depth);
    // arcos por baixo (da direita para a esquerda)
    const pierW = arches > 1 ? 0.9 : 0;
    const spanW = (L - 1.6 - pierW * (arches - 1)) / arches;
    for (let a = arches - 1; a >= 0; a--) {
        const c = -hl + 0.8 + spanW / 2 + a * (spanW + pierW);
        const r = spanW / 2;
        const spring = -depth * 0.55;
        side.lineTo(c + r, -depth);
        side.lineTo(c + r, spring);
        const hArc = Math.min(r, deck(c) - 0.45 - spring);
        for (let i = 1; i < 16; i++) {
            const t = (i / 16) * Math.PI;
            side.lineTo(c + Math.cos(t) * r, spring + Math.sin(t) * hArc);
        }
        side.lineTo(c - r, spring);
        side.lineTo(c - r, -depth);
    }
    side.lineTo(-hl, -depth);
    side.closePath();
    const body = slab(side, width, 0.04, 8);
    body.rotateY(-Math.PI / 2); // extrusão passa a correr em X; perfil em Z
    const parts = [['stoneBlock', body]];
    if (rail) {
        const strip = new THREE.Shape();
        strip.moveTo(-hl, deck(-hl));
        for (let i = 1; i <= N; i++) {
            const z = -hl + (i / N) * L;
            strip.lineTo(z, deck(z));
        }
        for (let i = N; i >= 0; i--) {
            const z = -hl + (i / N) * L;
            strip.lineTo(z, deck(z) + parapet);
        }
        strip.closePath();
        for (const sx of [-1, 1]) {
            const p = slab(strip, 0.32, 0.03, 8);
            p.rotateY(-Math.PI / 2);
            p.translate(sx * (width / 2 - 0.16), 0, 0);
            parts.push(['stoneWall', p]);
            // pilaretes nas cabeceiras
            for (const sz of [-1, 1]) {
                const post = turned([[0.26, 0], [0.26, parapet + 0.1], [0.3, parapet + 0.16], [0.3, parapet + 0.3], [0.16, parapet + 0.46], [0.001, parapet + 0.52]], 12);
                post.translate(sx * (width / 2 - 0.16), deck(sz * hl), sz * hl);
                parts.push(['stoneBlock', post]);
            }
        }
    }
    return { parts, deck, half: hl };
}

/** Degraus retos: `n` degraus de `run` × `riser`, largura `width`; sobe em +Z. Origem no pé do 1º degrau. */
export function stairs({ n = 8, run = 0.6, riser = 0.25, width = 4 }) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    for (let i = 0; i < n; i++) {
        s.lineTo(i * run, (i + 1) * riser);
        s.lineTo((i + 1) * run, (i + 1) * riser);
    }
    s.lineTo(n * run, -0.6);
    s.lineTo(0, -0.6);
    s.closePath();
    const g = slab(s, width, 0.02, 4);
    g.rotateY(-Math.PI / 2);
    return g;
}

/** Cristal: prisma hexagonal com ponta (facetado de propósito). */
export function crystal(h = 1, r = 0.16) {
    const g = turned([[r * 0.75, 0], [r, h * 0.2], [r * 0.9, h * 0.72], [0.001, h]], 6);
    return g.toNonIndexed();
}

/* ------------------------------------------------------------------ */
/* Toca de colina                                                       */
/* ------------------------------------------------------------------ */

/**
 * Fachada de uma toca escavada na colina, pronta para entrar no lote.
 * Local: a fachada fica no plano z = 0 olhando para +Z; o morro cresce para −Z.
 * Peças: muro de arrimo em arco com porta e janelas redondas RECORTADAS, aro de
 * pedra, porta de tábuas com ferragens, caixilhos, vidro aceso, soleira e degrau,
 * chaminé torneada saindo do morro, floreiras.
 * @param {Batch} batch  @param {THREE.Matrix4} M  matriz local → mundo
 */
export function addBurrow(batch, M, { door = 0x3f7a3a, width = 6.4, height = 2.9, chimneyY = 3.2, lit = true } = {}) {
    const at = (g, x = 0, y = 0, z = 0, ry = 0, rx = 0) => {
        g.applyMatrix4(trs(x, y, z, ry, 1, rx));
        g.applyMatrix4(M);
        return g;
    };
    const R = 0.78; // raio da porta
    const cy = 0.98; // centro da porta
    const wx = width * 0.3;
    const wy = 1.25;
    const wr = 0.36;
    // muro de arrimo com os três vãos
    batch.add('plaster', at(wall({
        width, height, thick: 0.5, arch: height * 0.62,
        holes: [{ x: 0, y: cy, r: R + 0.02 }, { x: -wx, y: wy, r: wr }, { x: wx, y: wy, r: wr }]
    })), null, 0xfff4dc, 1.6);
    // coroamento de pedras sobre o arco
    // faixa em arco: contorno externo (meia elipse maior) menos o interno (o próprio muro)
    const band = new THREE.Shape();
    const sp = height * 0.38; // nascimento do arco
    const ro = width * 0.5 + 0.26;
    const ri = width * 0.5 - 0.02;
    band.moveTo(ro, 0);
    band.lineTo(ro, sp);
    for (let i = 1; i <= 24; i++) band.lineTo(Math.cos((i / 24) * Math.PI) * ro, sp + Math.sin((i / 24) * Math.PI) * (height * 0.62 + 0.24));
    band.lineTo(-ro, 0);
    band.lineTo(-ri, 0);
    band.lineTo(-ri, sp);
    for (let i = 23; i >= 0; i--) band.lineTo(Math.cos((i / 24) * Math.PI) * ri, sp + Math.sin((i / 24) * Math.PI) * (height * 0.62 - 0.02));
    band.lineTo(ri, 0);
    band.closePath();
    const cap = slab(band, 0.72, 0.04, 4);
    batch.add('mossStone', at(cap, 0, 0, -0.02), null, 0xe6e2d2, 1.2);
    // aro e porta
    batch.add('stoneBlock', at(ring(R + 0.24, R, 0.62), 0, cy, 0.06), null, 0xfff6e4, 1.1);
    batch.add('woodOld', at(disc(R, 0.12), 0, cy, -0.08), null, door, 0.9);
    // travessas e ferragens
    for (const dy of [-0.38, 0.38]) batch.add('iron', at(block(R * 1.7, 0.07, 0.04, 0.015), 0, cy + dy - 0.035, 0), null, 0x5a5550, 0.5);
    batch.add('brass', at(turned([[0.02, 0], [0.075, 0.02], [0.085, 0.06], [0.05, 0.1], [0.001, 0.115]], 16), 0, cy, -0.01, 0, Math.PI / 2));
    batch.add('brass', at(new THREE.TorusGeometry(0.11, 0.016, 8, 20), 0, cy - 0.12, 0.05));
    // janelas: aro, vidro e cruzeta
    for (const sx of [-1, 1]) {
        batch.add('woodOld', at(ring(wr + 0.1, wr - 0.03, 0.3), sx * wx, wy, 0.1), null, door, 0.6);
        batch.add(lit ? 'glow' : 'slateDark', at(disc(wr, 0.04, 0.005), sx * wx, wy, -0.05), null, lit ? 0xffffff : 0x30363a, 1);
        batch.add('woodOld', at(block(wr * 2, 0.045, 0.05, 0.01), sx * wx, wy - 0.022, 0), null, door, 0.6);
        batch.add('woodOld', at(block(0.045, wr * 2, 0.05, 0.01), sx * wx, wy - wr, 0), null, door, 0.6);
        // floreira
        batch.add('woodDark', at(block(wr * 2.4, 0.2, 0.26, 0.03), sx * wx, wy - wr - 0.34, 0.36), null, 0xc8b89c, 0.7);
    }
    // soleira, degraus e lajes de entrada
    batch.add('slate', at(block(2.2, 0.16, 1.1, 0.04), 0, 0.02, 0.62), null, 0xe8e2d6, 1.2);
    batch.add('slate', at(block(2.9, 0.12, 0.9, 0.04), 0, -0.1, 1.5), null, 0xd8d2c6, 1.2);
    // chaminé: fuste de pedra com cinta e chapéu, um pouco torta
    const ch = turned([[0.34, 0], [0.31, 0.9], [0.3, 1.25], [0.37, 1.3], [0.37, 1.42], [0.26, 1.46], [0.24, 1.7], [0.3, 1.74], [0.3, 1.8], [0.2, 1.84]], 14);
    batch.add('stoneBlock', at(ch, width * 0.2, chimneyY - 0.5, -3.1, 0, 0.05), null, 0xe2d8c8, 0.9);
    // banco junto à parede
    batch.add('wood', at(block(1.3, 0.07, 0.36, 0.02), -wx - 0.1, 0.42, 0.55), null, 0xd8c4a0, 0.8);
    for (const bx of [-0.5, 0.5]) batch.add('wood', at(block(0.08, 0.42, 0.3, 0.02), -wx - 0.1 + bx, 0, 0.55), null, 0xc8b490, 0.8);
}

/**
 * Tenda de festa: mastro, lona cônica com barra recortada e cordas.
 * Perfil da lona (revolução): caimento de corda entre o mastro e a borda,
 *   r(t) = R · t^0,8,   y(t) = H − (H − h)·t^1,35      (t: 0 no topo → 1 na borda)
 */
export function addTent(batch, M, { radius = 2.6, height = 3.6, eave = 2.0, color = 0xe8d9b0, stripe = 0xb8473a } = {}) {
    const prof = [];
    for (let i = 12; i >= 0; i--) {
        const t = i / 12;
        prof.push([radius * Math.pow(t, 0.8), height - (height - eave) * Math.pow(t, 1.35)]);
    }
    const lona = turned(prof, 20);
    // faixas alternadas por gomo
    const g = lona.toNonIndexed();
    g.applyMatrix4(M);
    batch.add('cloth', g, null, color, 0.9);
    const skirt = turned([[radius, eave - 0.32], [radius, eave]], 20);
    batch.add('cloth', skirt, M, stripe, 0.9);
    batch.add('wood', turned([[0.07, 0], [0.06, height + 0.25], [0.1, height + 0.3], [0.001, height + 0.42]], 10), M, 0xcbb590, 0.6);
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const post = turned([[0.045, 0], [0.04, eave]], 8);
        post.translate(Math.cos(a) * radius * 0.97, 0, Math.sin(a) * radius * 0.97);
        batch.add('wood', post, M, 0xcbb590, 0.6);
    }
}

/**
 * Assento de pedra do conselho: bloco com encosto curvo e braços, entalhado.
 * Local: senta-se olhando para +Z; assento a 0,46 m.
 */
export function addStoneSeat(batch, M, { tint = 0xffffff, back = 1.25, scale = 1 } = {}) {
    const S = trs(0, 0, 0, 0, scale);
    const put = (key, g, x, y, z, ry = 0) => {
        g.applyMatrix4(trs(x, y, z, ry));
        g.applyMatrix4(S);
        batch.add(key, g, M, tint, 1.3);
    };
    put('stoneLight', block(0.86, 0.46, 0.7, 0.05), 0, 0, 0);
    // encosto: arco ogival maciço com rebaixo
    const b = new THREE.Shape();
    b.moveTo(-0.43, 0);
    b.lineTo(0.43, 0);
    b.lineTo(0.43, back * 0.55);
    b.quadraticCurveTo(0.4, back * 0.9, 0, back);
    b.quadraticCurveTo(-0.4, back * 0.9, -0.43, back * 0.55);
    b.closePath();
    const inner = new THREE.Path();
    inner.moveTo(-0.26, 0.6);
    inner.lineTo(-0.26, back * 0.56);
    inner.quadraticCurveTo(-0.22, back * 0.8, 0, back * 0.88);
    inner.quadraticCurveTo(0.22, back * 0.8, 0.26, back * 0.56);
    inner.lineTo(0.26, 0.6);
    inner.closePath();
    b.holes.push(inner);
    put('stoneLight', slab(b, 0.16, 0.03, 10), 0, 0.4, -0.3);
    put('stoneBlock', block(0.52, back * 0.5, 0.06, 0.02), 0, 0.98, -0.34);
    for (const sx of [-1, 1]) {
        put('stoneLight', block(0.13, 0.68, 0.62, 0.04), sx * 0.44, 0, 0.0);
        put('stoneLight', turned([[0.09, 0], [0.11, 0.05], [0.07, 0.1], [0.001, 0.13]], 12), sx * 0.44, 0.68, 0.26);
    }
    put('stoneBlock', block(1.06, 0.1, 0.9, 0.03), 0, -0.06, 0.02);
}

/** Braseiro de ferro sobre pedestal torneado (o fogo é do capítulo). Topo da cuba em y = h. */
export function addBrazier(batch, M, { h = 1.25, tint = 0xffffff } = {}) {
    batch.add('stoneDark', turned([[0.42, 0], [0.42, 0.14], [0.3, 0.2], [0.2, 0.34], [0.17, h * 0.62], [0.24, h * 0.7], [0.2, h * 0.76]], 10), M, tint, 0.9);
    batch.add('iron', turned([[0.16, h * 0.74], [0.4, h * 0.86], [0.5, h], [0.46, h], [0.36, h * 0.9], [0.001, h * 0.84]], 16), M, 0x6a6058, 0.6);
}

export { TAU };
