/**
 * Oficina de alvenaria e carpintaria: geometrias de construção com espessura,
 * vãos recortados, abóbadas, colunas torneadas e rochedos, todas fundidas por
 * material (1 draw call por material) e com UV em metros.
 *
 * Convenção de UV: `applyWorldUV(geo, escala)` projeta por face dominante com
 * 1 repetição a cada `escala` metros — o valor de cada material está em MATS.
 */
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applyWorldUV, fbm2, seeded } from '../../../shared/gfx/core.js';
import { pbrMaterial } from '../../../shared/gfx/assets.js';

/** nome → [conjunto PBR, metros por repetição, opções do material] */
const MATS = {
    stone: ['castle_wall_slates', 2.6, { color: 0xd8d2c8 }],
    blocks: ['medieval_blocks_02', 2.4, { color: 0xcfc8bc }],
    brick: ['castle_brick_02_white', 2.2, { color: 0xb8ae9e }],
    slate: ['slate_floor_02', 2.2, { color: 0xbdb6ac }],
    cobble: ['cobblestone_floor_08', 2.4, { color: 0xb4ada2 }],
    plaster: ['rough_plaster_03', 2.4, { color: 0xe6d8bc }],
    oak: ['oak_wood_planks', 1.8, { color: 0xc9a87c }],
    darkwood: ['dark_wooden_planks', 1.6, { color: 0xb09880 }],
    planks: ['weathered_brown_planks', 1.8, { color: 0xc0aa90 }],
    iron: ['rusty_metal_02', 0.9, { color: 0x6a6660, metal: true, roughness: 0.75 }],
    cliff: ['cliff_side', 5.5, { color: 0xb8b2a8 }],
    mossy: ['mossy_rock', 3.2, { color: 0xb6b8a8 }],
    roof: ['roof_slates_02', 2.2, { color: 0x8a8f9c }],
    leather: ['brown_leather', 0.6, { color: 0xa88868 }],
    cloth: ['fabric_pattern_07', 1.2, { color: 0xa8483a }]
};
const matCache = new Map();

/** Material PBR compartilhado do lab (um por nome; `variant` cria cópias com cor/opções próprias). */
export function mat(name, variant = null, extra = null) {
    const key = variant ? `${name}:${variant}` : name;
    if (!matCache.has(key)) {
        const [set, , opts] = MATS[name];
        const m = pbrMaterial(set, { ...opts, ...(extra || {}) });
        m.userData.shared = true;
        matCache.set(key, m);
    }
    return matCache.get(key);
}
export const uvScale = (name) => MATS[name][1];

/**
 * Coletor de geometrias por material. `add` recebe a geometria já posicionada (ou uma
 * matriz); `build` funde tudo, projeta o UV em metros e devolve as malhas no grupo.
 */
export class Kit {
    constructor() {
        this.bins = new Map();
    }

    add(name, geo, matrix = null) {
        if (matrix) geo.applyMatrix4(matrix);
        if (!this.bins.has(name)) this.bins.set(name, []);
        this.bins.get(name).push(geo);
        return geo;
    }

    /** Atalho: geometria + posição/rotação. */
    put(name, geo, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
        _e.set(rx, ry, rz);
        _m.makeRotationFromEuler(_e).setPosition(x, y, z);
        return this.add(name, geo, _m);
    }

    build(group, { castShadow = true, receiveShadow = true } = {}) {
        const out = [];
        for (const [name, list] of this.bins) {
            const clean = list.map((g) => {
                const n = g.index ? g.toNonIndexed() : g;
                for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
                if (!n.attributes.normal) n.computeVertexNormals();
                return n;
            });
            const merged = mergeGeometries(clean, false);
            applyWorldUV(merged, uvScale(name));
            const mesh = new THREE.Mesh(merged, mat(name));
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            mesh.name = `kit:${name}`;
            mesh.userData.ownGeo = true;
            group.add(mesh);
            out.push(mesh);
        }
        this.bins.clear();
        return out;
    }
}
const _m = new THREE.Matrix4();
const _e = new THREE.Euler();

/** Bloco com quinas chanfradas (vigas, degraus, soleiras). */
export function block(w, h, d, r = 0.03) {
    return new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3));
}

/**
 * Parede com espessura e vãos recortados. O pano vai de (0,0) a (length,height) em XY e
 * é extrudado em Z (centrado). Vãos: { at (centro em x), w, h, sill (peitoril), arch }.
 * Arco: semicírculo de raio w/2 começando em `h − w/2` (vão total = h).
 */
export function wallGeo(length, height, thick, openings = []) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(length, 0);
    shape.lineTo(length, height);
    shape.lineTo(0, height);
    shape.closePath();
    for (const o of openings) {
        const x0 = o.at - o.w / 2;
        const x1 = o.at + o.w / 2;
        const y0 = o.sill || 0;
        const hole = new THREE.Path();
        if (o.arch !== false) {
            const spring = y0 + o.h - o.w / 2;
            hole.moveTo(x0, y0 + 1e-3);
            hole.lineTo(x0, spring);
            hole.absarc(o.at, spring, o.w / 2, Math.PI, 0, true);
            hole.lineTo(x1, y0 + 1e-3);
            hole.closePath();
        } else {
            hole.moveTo(x0, y0 + 1e-3);
            hole.lineTo(x0, y0 + o.h);
            hole.lineTo(x1, y0 + o.h);
            hole.lineTo(x1, y0 + 1e-3);
            hole.closePath();
        }
        shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 10 });
    geo.translate(0, 0, -thick / 2);
    return geo;
}

/**
 * Abóbada de berço (superfície interna), eixo ao longo de Z, centrada em x = 0:
 *   x = halfW·cos u,  y = rise·sin u,  u ∈ [0, π]   (perfil elíptico: rise < halfW = arco abatido)
 */
export function vaultGeo(halfW, rise, length, seg = 20) {
    const pos = [];
    const idx = [];
    const rows = Math.max(2, Math.round(length / 1.5));
    for (let j = 0; j <= rows; j++) {
        for (let i = 0; i <= seg; i++) {
            const u = (i / seg) * Math.PI;
            pos.push(halfW * Math.cos(u), rise * Math.sin(u), (j / rows - 0.5) * length);
        }
    }
    const row = seg + 1;
    for (let j = 0; j < rows; j++) {
        for (let i = 0; i < seg; i++) {
            const a = j * row + i;
            idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row); // face para dentro (para baixo)
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
}

/** Nervura de arco (meio toro achatado para o perfil elíptico da abóbada). */
export function ribGeo(halfW, rise, tube = 0.14) {
    const geo = new THREE.TorusGeometry(halfW, tube, 8, 28, Math.PI);
    geo.scale(1, rise / halfW, 1);
    return geo;
}

/** Coluna torneada: plinto, toro, fuste com êntase leve, colarinho e capitel. */
export function columnGeo(h, r = 0.32) {
    const p = [
        [0, 0], [r * 1.5, 0], [r * 1.5, 0.2], [r * 1.28, 0.24], [r * 1.34, 0.32], [r * 1.12, 0.4], [r * 1.02, 0.46],
        [r * 1.04, h * 0.4], [r * 0.94, h - 0.52], [r * 1.1, h - 0.46], [r * 1.0, h - 0.4], [r * 1.24, h - 0.28],
        [r * 1.5, h - 0.2], [r * 1.56, h - 0.02], [r * 1.56, h], [0, h]
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(p, 20);
}

/**
 * Rochedo: icosfera deslocada por ruído em duas escalas e achatada na base.
 *   p' = p·(1 + 0,42·(fbm(a) − ½) + 0,2·(fbm(b) − ½)),  a/b = projeções inclinadas de p
 * Vértices soldados (mergeVertices) para a normal sair suave — nada de facetado.
 */
export function cragGeo(seed = 1, { rx = 1, ry = 1, rz = 1, detail = 5, rough = 1 } = {}) {
    let geo = new THREE.IcosahedronGeometry(1, detail);
    geo.deleteAttribute('uv');
    geo.deleteAttribute('normal');
    geo = mergeVertices(geo, 1e-4);
    const pos = geo.attributes.position;
    const o = seed * 17.31;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const n1 = fbm2(x * 1.3 + y * 0.9 + o, z * 1.3 - y * 0.7 + o, 4) - 0.5;
        const n2 = fbm2(x * 3.7 - y * 2.1 + o * 2, z * 3.7 + y * 2.6, 3) - 0.5;
        let k = 1 + rough * (0.42 * n1 + 0.2 * n2);
        const yy = y < -0.25 ? -0.25 + (y + 0.25) * 0.3 : y;
        k *= 1 - 0.12 * Math.max(0, y); // topo mais estreito
        pos.setXYZ(i, x * k * rx, yy * k * ry, z * k * rz);
    }
    geo.computeVertexNormals();
    return geo;
}

/** Malha de rochedo pronta (UV em metros, material de falésia). */
export function makeCrag(seed, opts = {}) {
    const geo = cragGeo(seed, opts);
    /* UV cilíndrico em metros (u = ângulo·raio médio, v = altura): sem as emendas da projeção por face */
    const s = uvScale(opts.mat || 'cliff');
    const rad = ((opts.rx || 1) + (opts.rz || 1)) / 2;
    const pos = geo.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        uv[i * 2] = (Math.atan2(pos.getX(i), pos.getZ(i)) * rad) / s;
        uv[i * 2 + 1] = pos.getY(i) / s;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const mesh = new THREE.Mesh(geo, mat(opts.mat || 'cliff'));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.ownGeo = true;
    return mesh;
}

/** Corda/cabo: tubo sobre uma curva suave passando pelos pontos. */
export function ropeGeo(points, radius = 0.025, seg = 40) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2]))));
    return new THREE.TubeGeometry(curve, seg, radius, 6, false);
}

let ropeMat = null;
export function ropeMaterial() {
    if (!ropeMat) {
        ropeMat = pbrMaterial('thatch_roof_angled', { color: 0xb89a6a, repeat: [1, 14], roughness: 1 });
        ropeMat.userData.shared = true;
    }
    return ropeMat;
}

/**
 * Pano com vento (velas, estandartes): desloca ao longo da normal e recalcula a normal
 * por diferenças finitas, tudo no vertex shader (sem custo de CPU).
 *   d(u,v,t) = A·pin(u,v)·[ sin(6u + 2,2t)·0,5 + sin(9v − 3,1t + 2u)·0,3 + sin(17u + 13v + 5t)·0,2 ]
 *   pin = sin(πu)^0,6 · (0,25 + 0,75·v')     v' = v (bainha solta) — a borda de cima fica presa
 * `uniforms.uWind.value` (0…2) escala a amplitude; `uniforms.uTime.value` é o relógio.
 */
export function clothMaterial(base, { amp = 0.18, pinTop = true } = {}) {
    const uniforms = { uTime: { value: 0 }, uWind: { value: 1 }, uAmp: { value: amp } };
    base.side = THREE.DoubleSide;
    base.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', /* glsl */ `#include <common>
                uniform float uTime, uWind, uAmp;
                float gcCloth(vec2 q) {
                    float pin = pow(max(sin(3.14159 * q.x), 0.0), 0.6) * ${pinTop ? '(0.2 + 0.8 * (1.0 - q.y))' : '1.0'};
                    float w = sin(q.x * 6.0 + uTime * 2.2) * 0.5 + sin(q.y * 9.0 - uTime * 3.1 + q.x * 2.0) * 0.3
                        + sin(q.x * 17.0 + q.y * 13.0 + uTime * 5.0) * 0.2;
                    return uAmp * uWind * pin * w;
                }`)
            .replace('#include <beginnormal_vertex>', /* glsl */ `#include <beginnormal_vertex>
                {
                    float e = 0.02;
                    float d0 = gcCloth(uv);
                    float du = (gcCloth(uv + vec2(e, 0.0)) - d0) / e;
                    float dv = (gcCloth(uv + vec2(0.0, e)) - d0) / e;
                    objectNormal = normalize(objectNormal - 0.12 * (du * vec3(1.0, 0.0, 0.0) + dv * vec3(0.0, 1.0, 0.0)));
                }`)
            .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
                transformed += normal * gcCloth(uv);`);
    };
    base.customProgramCacheKey = () => `gcCloth:${pinTop}`;
    base.userData.cloth = uniforms;
    return base;
}

/**
 * Vela/estandarte: grade com barriga assada na geometria (normais corretas) em +Z:
 *   z = belly·sin(πu)·(0,35 + 0,65·sin(π·v^0,8))
 * Origem no meio da borda de cima; o pano cai para −Y. UV: u ao longo da largura, v = 0 no topo.
 */
export function sailGeo(width, drop, belly = 0.8, taper = 1) {
    const sx = 18;
    const sy = 14;
    const geo = new THREE.PlaneGeometry(1, 1, sx, sy);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i) + 0.5;
        const v = 0.5 - pos.getY(i);
        const w = width * (1 + (taper - 1) * v);
        pos.setXYZ(i, (u - 0.5) * w, -v * drop, belly * Math.sin(Math.PI * u) * (0.35 + 0.65 * Math.sin(Math.PI * Math.pow(v, 0.8))));
        uv.setXY(i, u, v);
    }
    geo.computeVertexNormals();
    return geo;
}

/** Desliga a sombra/descarte por frustum corretamente em grupos de modelo glTF. */
export function shadowAll(obj, cast = true, receive = true) {
    obj.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = cast;
            o.receiveShadow = receive;
        }
    });
    return obj;
}

/** Libera só o que pertence ao nível: geometrias próprias e materiais não compartilhados. */
export function disposeLevel(root) {
    root.traverse((o) => {
        if (o.userData?.keep) return;
        if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
        if (!o.isMesh && !o.isLine && !o.isPoints) return;
        if (o.userData?.ownGeo) o.geometry?.dispose();
    });
}

export { seeded };
