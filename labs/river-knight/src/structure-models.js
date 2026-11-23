/**
 * Modelagem das estruturas de pedra e madeira do River Knight: caixa de
 * ferramentas de geometria (usada também por castle.js), chama e tecido
 * animados, destroços com física simples e os modelos de torre de vigia,
 * catapulta e barricada.
 *
 * Convenções
 *   · UV sempre em METROS (materials.js cuida do `repeat`).
 *   · `Kit` junta as peças por material e funde tudo em 1 malha por material.
 *   · Nenhuma PointLight: o fogo pede luz a `lights.js` a cada quadro.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { applyWorldUV } from '../../shared/gfx/core.js';
import { pbrMaterial } from '../../shared/gfx/assets.js';
import { blockStone, darkWood, oakWood, barkWood, thatchRoof, iron, mossRock } from './materials.js?v=60';
import { terrainHeight } from './river.js?v=60';
import { waterHeight } from './water.js?v=60';

const TAU = Math.PI * 2;

/* ================================================================== */
/* Caixa de ferramentas                                                */
/* ================================================================== */

/** Matriz de transformação (tempo de construção; aloca à vontade). */
export function xf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    return new THREE.Matrix4().compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
        new THREE.Vector3(sx, sy, sz)
    );
}

/** Ruído determinístico barato (hash de seno) em [0, 1). */
export function hash(n) {
    const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return s - Math.floor(s);
}

/** Bloco com arestas chanfradas (pedra aparelhada, viga, tábua). */
export function block(w, h, d, r = 0.05) {
    return new RoundedBoxGeometry(w, h, d, 1, Math.min(r, w * 0.49, h * 0.49, d * 0.49));
}

/**
 * Sólido de revolução a partir de um perfil [[raio, y], …] listado de baixo para
 * cima pelo lado de fora (sólido à esquerda do percurso).
 *   normal do trecho i:  n = normalize(dy, −dr)   (radial, vertical)
 *   UV em metros:        u = θ · R_ref (R_ref = maior raio),  v = comprimento acumulado do perfil
 * `smooth: false` → cada trecho do perfil tem normal própria (molduras e fiadas com
 * aresta viva); `smooth: true` → normais médias (peças torneadas).
 * `flat: true` → normais por face também em volta (pirâmides de 4 águas, estacas facetadas).
 */
export function lathe(profile, segs = 24, { smooth = false, flat = false, start = 0, length = TAU, jitter = 0, seed = 1 } = {}) {
    const n = profile.length;
    let rRef = 0;
    for (const p of profile) rRef = Math.max(rRef, p[0]);
    const pos = [];
    const nor = [];
    const uv = [];
    const idx = [];
    const segN = [];
    for (let i = 0; i < n - 1; i++) {
        const dr = profile[i + 1][0] - profile[i][0];
        const dy = profile[i + 1][1] - profile[i][1];
        const l = Math.hypot(dr, dy) || 1;
        segN.push([dy / l, -dr / l, l]);
    }
    const cum = [0];
    for (let i = 0; i < n - 1; i++) cum.push(cum[i] + segN[i][2]);
    const closed = Math.abs(length - TAU) < 1e-6;
    const rad = (i, j) => {
        if (!jitter) return profile[i][0];
        const jj = closed ? j % segs : j;
        return profile[i][0] * (1 + (hash(seed * 13.7 + i * 7.31 + jj * 3.17) - 0.5) * jitter);
    };
    const push = (i, j, nr, ny) => {
        const th = start + (j / segs) * length;
        const c = Math.cos(th);
        const s = Math.sin(th);
        const r = rad(i, j);
        pos.push(r * c, profile[i][1], -r * s);
        nor.push(nr * c, ny, -nr * s);
        uv.push(th * rRef, cum[i]);
    };
    if (smooth) {
        for (let i = 0; i < n; i++) {
            const a = segN[Math.max(0, i - 1)];
            const b = segN[Math.min(n - 2, i)];
            let nr = a[0] + b[0];
            let ny = a[1] + b[1];
            const l = Math.hypot(nr, ny) || 1;
            nr /= l;
            ny /= l;
            for (let j = 0; j <= segs; j++) push(i, j, nr, ny);
        }
        const row = segs + 1;
        for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < segs; j++) {
                const a = i * row + j;
                idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
            }
        }
    } else {
        const row = segs + 1;
        for (let i = 0; i < n - 1; i++) {
            const base = i * 2 * row;
            for (let j = 0; j <= segs; j++) push(i, j, segN[i][0], segN[i][1]);
            for (let j = 0; j <= segs; j++) push(i + 1, j, segN[i][0], segN[i][1]);
            for (let j = 0; j < segs; j++) {
                const a = base + j;
                idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
            }
        }
    }
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    if (flat || jitter) {
        if (g.index) g = g.toNonIndexed();
        g.computeVertexNormals();
        if (!flat) {
            // com ruído no raio as normais analíticas não valem: recalcula suave
            const merged = mergeVerticesSoft(g);
            g.dispose();
            g = merged;
        }
    }
    return g;
}

/**
 * Solda vértices com mesma posição E mesma UV; as normais são médias por POSIÇÃO
 * (ponderadas pela área), então a costura de UV não aparece no sombreamento.
 */
function mergeVerticesSoft(g) {
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const map = new Map();
    const nmap = new Map();
    const p = [];
    const u = [];
    const idx = [];
    const pk = [];
    const key3 = (i) => `${Math.round(pos.getX(i) * 1e3)}|${Math.round(pos.getY(i) * 1e3)}|${Math.round(pos.getZ(i) * 1e3)}`;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let t = 0; t < pos.count; t += 3) {
        a.fromBufferAttribute(pos, t);
        b.fromBufferAttribute(pos, t + 1);
        c.fromBufferAttribute(pos, t + 2);
        b.sub(a);
        c.sub(a);
        b.cross(c);
        for (let i = t; i < t + 3; i++) {
            const k3 = key3(i);
            let acc = nmap.get(k3);
            if (!acc) {
                acc = new THREE.Vector3();
                nmap.set(k3, acc);
            }
            acc.add(b);
            const key = `${k3}|${Math.round(uv.getX(i) * 1e3)}|${Math.round(uv.getY(i) * 1e3)}`;
            let k = map.get(key);
            if (k === undefined) {
                k = p.length / 3;
                map.set(key, k);
                p.push(pos.getX(i), pos.getY(i), pos.getZ(i));
                u.push(uv.getX(i), uv.getY(i));
                pk.push(acc);
            }
            idx.push(k);
        }
    }
    const n = new Float32Array(p.length);
    for (let i = 0; i < pk.length; i++) {
        a.copy(pk[i]).normalize();
        n[i * 3] = a.x;
        n[i * 3 + 1] = a.y;
        n[i * 3 + 2] = a.z;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(n, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    out.setIndex(idx);
    return out;
}

/**
 * Pontos de um arco entre (x0, spring) e (x0 + w, spring), flecha `rise`.
 *   u = |2t − 1|   (0 no fecho, 1 nas impostas)
 *   abatido:  y = spring + rise · (1 − u^1,7)
 *   ogival:   y = spring + rise · (1 − u)^0,72      (fecho em ponta, nascença vertical)
 */
export function archPoints(x0, w, spring, rise, n = 18, pointed = false) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const u = Math.abs(2 * t - 1);
        const y = pointed ? spring + rise * Math.pow(1 - u, 0.72) : spring + rise * (1 - Math.pow(u, 1.7));
        pts.push(new THREE.Vector2(x0 + w * t, y));
    }
    return pts;
}

function extrudeZ(shape, depth, zc = 0) {
    const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, zc - depth / 2);
    return g;
}

/** Pano de muralha acima de um vão em arco (do nível das impostas até `top`). */
export function archLintel(x0, w, spring, rise, top, depth, zc = 0, pointed = false) {
    const shape = new THREE.Shape();
    const pts = archPoints(x0, w, spring, rise, 18, pointed);
    shape.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
    shape.lineTo(x0 + w, top);
    shape.lineTo(x0, top);
    shape.closePath();
    return extrudeZ(shape, depth, zc);
}

/** Aduelas: anel de pedra aparelhada contornando o arco (espessura `t`). */
export function archRing(x0, w, spring, rise, t, depth, zc = 0, pointed = false, foot = 0) {
    const inner = archPoints(x0, w, spring, rise, 18, pointed);
    const outer = archPoints(x0 - t, w + 2 * t, spring, rise + t, 18, pointed);
    const shape = new THREE.Shape();
    shape.moveTo(x0 - t, spring - foot);
    for (const p of outer) shape.lineTo(p.x, p.y);
    shape.lineTo(x0 + w + t, spring - foot);
    shape.lineTo(x0 + w, spring - foot);
    for (let i = inner.length - 1; i >= 0; i--) shape.lineTo(inner[i].x, inner[i].y);
    shape.lineTo(x0, spring - foot);
    shape.closePath();
    return extrudeZ(shape, depth, zc);
}

/** Painel plano com o contorno de um arco (vidro aceso, fundo de porta). */
export function archPanel(w, spring, rise, pointed = true) {
    const pts = archPoints(-w / 2, w, spring, rise, 14, pointed);
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(-w / 2, spring);
    for (const p of pts) shape.lineTo(p.x, p.y);
    shape.lineTo(w / 2, 0);
    shape.closePath();
    return new THREE.ShapeGeometry(shape, 1);
}

/** Pedra irregular: icosfera deformada por ruído de senos (normais suaves). */
export function boulder(seed = 1, detail = 2, sx = 1, sy = 0.75, sz = 0.9) {
    const g = new THREE.IcosahedronGeometry(1, detail);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 1 + 0.2 * Math.sin(x * 2.3 + seed * 1.7) * Math.cos(z * 2.9 + seed)
            + 0.14 * Math.sin(y * 4.1 + x * 1.3 + seed * 2.3) + 0.08 * Math.sin((x + y + z) * 6.3 + seed * 5.1);
        p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
    }
    const out = mergeVerticesSoft(g.index ? g.toNonIndexed() : g);
    g.dispose();
    return out;
}

/**
 * Tronco ao longo de Y (y de 0 a `len`), raio variável com nós; `tip` > 0 afia a ponta.
 * Devolve só o corpo; os topos cortados vêm de `logCap`.
 */
export function log(len, r, { segs = 10, seed = 1, taper = 0.12, tip = 0, rings = 5 } = {}) {
    const profile = [];
    for (let i = 0; i <= rings; i++) {
        const t = i / rings;
        profile.push([r * (1 - taper * t) * (1 + (hash(seed + i * 3.3) - 0.5) * 0.1), t * (len - tip)]);
    }
    if (tip > 0) profile.push([r * 0.04, len]);
    return lathe(profile, segs, { smooth: true, jitter: 0.07, seed });
}

/** Topo cortado de tronco (disco voltado para ±Y). */
export function logCap(r, y, up = true) {
    const g = new THREE.CircleGeometry(r, 10);
    g.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
    g.translate(0, y, 0);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 2, uv.getY(i) * r * 2);
    return g;
}

/**
 * Junta peças por material e funde: 1 draw call por material.
 * `uv: 'world'` projeta UV em metros pela face dominante (depois da transformação);
 * `uv: 'keep'` preserva a UV da peça (que já deve estar em metros).
 */
export class Kit {
    constructor() {
        this.bins = new Map();
    }

    add(material, geometry, matrix = null, uv = 'world') {
        const g = geometry.clone();
        if (matrix) g.applyMatrix4(matrix);
        if (!g.attributes.normal) g.computeVertexNormals();
        if (uv === 'world' || !g.attributes.uv) applyWorldUV(g, 1);
        for (const k of Object.keys(g.attributes)) {
            if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
        }
        if (!g.index) {
            const count = g.attributes.position.count;
            const index = new (count > 65535 ? Uint32Array : Uint16Array)(count);
            for (let i = 0; i < count; i++) index[i] = i;
            g.setIndex(new THREE.BufferAttribute(index, 1));
        }
        g.clearGroups();
        if (!this.bins.has(material)) this.bins.set(material, []);
        this.bins.get(material).push(g);
        return this;
    }

    /** Geometria fundida de um material (para InstancedMesh). */
    geometryFor(material) {
        const list = this.bins.get(material);
        if (!list || !list.length) return null;
        const merged = mergeGeometries(list, false);
        for (const g of list) g.dispose();
        this.bins.delete(material);
        merged.computeBoundingSphere();
        merged.computeBoundingBox();
        return merged;
    }

    /** Funde tudo e adiciona as malhas a `parent`. Devolve as malhas criadas. */
    build(parent, { cast = true, receive = true, name = '' } = {}) {
        const meshes = [];
        for (const material of [...this.bins.keys()]) {
            const geometry = this.geometryFor(material);
            if (!geometry) continue;
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = cast && !material.transparent;
            mesh.receiveShadow = receive;
            mesh.name = `${name}:${material.name || 'mat'}`;
            parent.add(mesh);
            meshes.push(mesh);
        }
        return meshes;
    }
}

/* ================================================================== */
/* Fogo e tecido                                                       */
/* ================================================================== */

/** Relógio compartilhado dos shaders de fogo e tecido (avançado por quem atualiza a cena). */
export const fxTime = { value: 0 };

/** Lágrima de chama: base em y = 0, ponta em y = 1, raio máx. ~0,32. */
export const FLAME_GEOMETRY = (() => {
    const profile = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        // r(t) = 0,34 · sen(π·t^0,62)^0,9 · (1 − 0,55·t): bojo baixo, ponta fina
        profile.push([0.001 + 0.34 * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.62)), 0.9) * (1 - 0.55 * t), t]);
    }
    return lathe(profile, 10, { smooth: true });
})();

let flameMat = null;
/**
 * Chama volumétrica barata: malha em lágrima, aditiva, ondulada no vértice.
 *   deslocamento lateral = h² · (0,12·sen(9t + φ + 5y) + 0,06·sen(14,3t + 1,3φ + 8y))
 *   cor = mistura laranja → amarelo → branco pelo "miolo" (N·V)^1,5; alfa cai na ponta
 * φ vem da posição de mundo da instância, então cada tocha tremula fora de fase.
 */
export function flameMaterial() {
    if (flameMat) return flameMat;
    flameMat = new THREE.ShaderMaterial({
        uniforms: { uTime: fxTime, uGain: { value: 3.2 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        vertexShader: /* glsl */ `
            uniform float uTime;
            varying float vH;
            varying vec3 vN;
            varying vec3 vV;
            void main() {
                #ifdef USE_INSTANCING
                    mat4 im = modelMatrix * instanceMatrix;
                #else
                    mat4 im = modelMatrix;
                #endif
                vec3 origin = im[3].xyz;
                float ph = origin.x * 1.7 + origin.z * 2.3 + origin.y * 0.9;
                vec3 p = position;
                float h = clamp(p.y, 0.0, 1.0);
                float sway = h * h;
                p.x += (sin(uTime * 9.0 + ph + p.y * 5.0) * 0.12 + sin(uTime * 14.3 + ph * 1.3 + p.y * 8.0) * 0.06) * sway;
                p.z += (cos(uTime * 8.1 + ph * 0.7 + p.y * 4.3) * 0.12 + sin(uTime * 12.7 + ph + p.y * 9.0) * 0.05) * sway;
                p.y *= 1.0 + 0.16 * sin(uTime * 11.0 + ph) + 0.08 * sin(uTime * 23.0 + ph * 2.0);
                vH = h;
                vec4 wp = im * vec4(p, 1.0);
                vN = normalize(mat3(im) * normal);
                vV = cameraPosition - wp.xyz;
                gl_Position = projectionMatrix * viewMatrix * wp;
            }`,
        fragmentShader: /* glsl */ `
            uniform float uGain;
            varying float vH;
            varying vec3 vN;
            varying vec3 vV;
            void main() {
                float core = pow(max(dot(normalize(vN), normalize(vV)), 0.0), 1.5);
                vec3 col = mix(vec3(1.0, 0.22, 0.02), vec3(1.0, 0.66, 0.2), core);
                col = mix(col, vec3(1.0, 0.92, 0.66), core * core * (1.0 - vH));
                float a = core * smoothstep(1.0, 0.3, vH) * (0.55 + 0.45 * smoothstep(0.0, 0.15, vH));
                gl_FragColor = vec4(col * uGain * a, a);
            }`
    });
    flameMat.name = 'flame';
    return flameMat;
}

/** Malha de uma chama (largura/altura em metros). */
export function buildFlame(width = 0.5, height = 0.9) {
    const mesh = new THREE.Mesh(FLAME_GEOMETRY, flameMaterial());
    mesh.scale.set(width / 0.64, height, width / 0.64);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    mesh.name = 'flame';
    return mesh;
}

const clothMats = new Map();
/**
 * Tecido de estandarte com cor por vértice e ondulação no vértice.
 * Atributo `wave` (0 na tralha/haste → 1 na ponta solta):
 *   z += wave · (0,22·sen(2,6t + 1,1x + 0,8y) + 0,09·sen(4,3t + 2,3y))
 *   x += wave · 0,05·sen(3,1t + 1,7y)
 */
export function bannerMaterial(color = 0xffffff) {
    if (clothMats.has(color)) return clothMats.get(color);
    const m = pbrMaterial('fabric_pattern_07', {
        repeat: 1 / 0.9, color, normalScale: 0.6, side: THREE.DoubleSide, vertexColors: true
    });
    m.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = fxTime;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nattribute float wave;\nuniform float uTime;')
            .replace('#include <begin_vertex>', /* glsl */ `
                #include <begin_vertex>
                transformed.z += wave * (0.22 * sin(uTime * 2.6 + position.x * 1.1 + position.y * 0.8) + 0.09 * sin(uTime * 4.3 + position.y * 2.3));
                transformed.x += wave * 0.05 * sin(uTime * 3.1 + position.y * 1.7);
            `);
    };
    m.customProgramCacheKey = () => 'rk-banner';
    m.name = 'banner';
    clothMats.set(color, m);
    return m;
}

/**
 * Geometria de um estandarte: `hang: true` pende de uma verga (onda cresce para
 * baixo, barra em ponta); `hang: false` é bandeira presa à haste (onda cresce em +X).
 * Faixas e brasão em cor de vértice.
 */
export function bannerGeometry(w, h, { hang = true, base = 0x7a1422, trim = 0xd9a441, emblem = 0xe8d9b0 } = {}) {
    const nx = hang ? 6 : 12;
    const ny = hang ? 14 : 6;
    const g = new THREE.PlaneGeometry(w, h, nx, ny);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const cBase = new THREE.Color(base);
    const cTrim = new THREE.Color(trim);
    const cEmb = new THREE.Color(emblem);
    const col = new Float32Array(pos.count * 3);
    const wave = new Float32Array(pos.count);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
        const u = uv.getX(i);
        const v = uv.getY(i);
        if (hang) {
            wave[i] = Math.pow(1 - v, 1.4);
            // barra em ponta ("rabo de andorinha" invertido)
            if (v < 0.001) pos.setY(i, pos.getY(i) - (0.5 - Math.abs(u - 0.5)) * w * 0.7);
            pos.setY(i, pos.getY(i) - h / 2);
        } else {
            wave[i] = Math.pow(u, 1.2);
            pos.setX(i, pos.getX(i) + w / 2);
        }
        c.copy(cBase);
        const edge = hang ? Math.min(u, 1 - u) : Math.min(v, 1 - v);
        if (edge < 0.12) c.copy(cTrim);
        const dx = (u - 0.5) * (hang ? w : h);
        const dy = (v - (hang ? 0.62 : 0.5)) * (hang ? h : w);
        const d = Math.abs(dx) + Math.abs(dy) * (hang ? 0.6 : 1);
        if (d < (hang ? w : h) * 0.24) c.copy(cEmb);
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
        uv.setXY(i, u * w, v * h);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('wave', new THREE.BufferAttribute(wave, 1));
    g.computeVertexNormals();
    return g;
}

/* ================================================================== */
/* Destroços com física simples                                        */
/* ================================================================== */

const _dm = new THREE.Matrix4();
const _dq = new THREE.Quaternion();
const _de = new THREE.Euler();
const _dp = new THREE.Vector3();
const _ds = new THREE.Vector3();

/**
 * Pedaços pré-fraturados (InstancedMesh) com integração de Euler semi-implícita.
 * Tudo em coordenadas LOCAIS do grupo pai, que só pode estar girado em Y (yaw);
 * a consulta de chão/água converte para o mundo:
 *   mundo.xz = pai.xz + R_y(yaw) · local.xz
 *
 * Por pedaço i (depois do atraso `delay_i`, que faz o topo ceder primeiro):
 *   v.y ← v.y − g·dt                      g = 17 m/s² (queda "pesada" de jogo)
 *   p   ← p + v·dt;   rot ← rot + ω·dt
 *   chão seco (terreno acima da água):  se p.y < chão + ½ altura
 *       v.y ← −0,28·v.y;  v.xz ← 0,6·v.xz;  ω ← 0,5·ω;  repousa quando |v.y| < 1,2
 *   água:  ao cruzar a superfície → respingo (uma vez), v ← 0,3·v
 *       pedra  (float = 0): afunda com v.y → −1,6 m/s (arrasto), ω amortecido
 *       tronco (float = 1): mola para a superfície  v.y += (nível − p.y)·14·dt − v.y·3·dt
 *                           e deriva com o arrasto v.xz ← v.xz·(1 − 0,8·dt)
 *   escala → 0 nos últimos `fade` s (some sem "pop").
 */
export class Debris {
    constructor(geometry, material, count, { float = 0, half = 0.4 } = {}) {
        this.mesh = new THREE.InstancedMesh(geometry, material, count);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.mesh.frustumCulled = false;
        this.mesh.visible = false;
        this.mesh.name = 'debris';
        this.count = count;
        this.float = float;
        this.half = half;
        // p(3) v(3) rot(3) w(3) scale(3) delay state  = 17 floats por pedaço
        this.data = new Float32Array(count * 17);
        this.used = 0;
        this.time = 0;
        this.life = 3;
        this.fade = 0.5;
        /** Profundidade extra (m) do nível de flutuação — quem usa aumenta para afundar os troncos. */
        this.sink = 0;
        for (let i = 0; i < count; i++) this.mesh.setMatrixAt(i, _dm.makeScale(0, 0, 0));
    }

    /** Zera a fila de pedaços; chame `add` em seguida para cada um. */
    begin(life = 3) {
        this.used = 0;
        this.time = 0;
        this.life = life;
        this.sink = 0;
        this.mesh.visible = true;
    }

    add(x, y, z, vx, vy, vz, sx = 1, sy = sx, sz = sx, delay = 0, ry = 0, rz = 0) {
        if (this.used >= this.count) return;
        const o = this.used++ * 17;
        const d = this.data;
        d[o] = x; d[o + 1] = y; d[o + 2] = z;
        d[o + 3] = vx; d[o + 4] = vy; d[o + 5] = vz;
        d[o + 6] = 0; d[o + 7] = ry; d[o + 8] = rz;
        d[o + 9] = (hash(x * 3.1 + y) - 0.5) * 5;
        d[o + 10] = (hash(z * 2.7 + y) - 0.5) * 3;
        d[o + 11] = (hash(x + z * 1.9) - 0.5) * 5;
        d[o + 12] = sx; d[o + 13] = sy; d[o + 14] = sz;
        d[o + 15] = delay;
        d[o + 16] = 0; // 0 no ar · 1 em repouso · 2 na água
    }

    /** @returns {boolean} true enquanto ainda há o que mostrar. */
    update(dt, time, parent, effects) {
        if (!this.mesh.visible) return false;
        this.time += dt;
        const d = this.data;
        const yaw = parent.rotation.y;
        const cy = Math.cos(yaw);
        const sy = Math.sin(yaw);
        const px = parent.position.x;
        const py = parent.position.y;
        const pz = parent.position.z;
        const k = Math.min(1, Math.max(0, (this.life - this.time) / this.fade));
        for (let i = 0; i < this.used; i++) {
            const o = i * 17;
            if (this.time >= d[o + 15] && d[o + 16] !== 1) {
                const inWater = d[o + 16] === 2;
                if (!inWater) d[o + 4] -= 17 * dt;
                d[o] += d[o + 3] * dt;
                d[o + 1] += d[o + 4] * dt;
                d[o + 2] += d[o + 5] * dt;
                d[o + 6] += d[o + 9] * dt;
                d[o + 7] += d[o + 10] * dt;
                d[o + 8] += d[o + 11] * dt;
                const wx = px + cy * d[o] + sy * d[o + 2];
                const wz = pz - sy * d[o] + cy * d[o + 2];
                const ground = terrainHeight(wx, wz) - py;
                const level = waterHeight(wx, wz, time) - py;
                if (ground > level - 0.15) {
                    if (d[o + 1] < ground + this.half && d[o + 4] < 0) {
                        d[o + 1] = ground + this.half;
                        d[o + 4] *= -0.28;
                        d[o + 3] *= 0.6;
                        d[o + 5] *= 0.6;
                        d[o + 9] *= 0.5;
                        d[o + 10] *= 0.5;
                        d[o + 11] *= 0.5;
                        if (Math.abs(d[o + 4]) < 1.2) d[o + 16] = 1;
                    }
                } else if (!inWater) {
                    if (d[o + 1] < level) {
                        d[o + 16] = 2;
                        d[o + 3] *= 0.3;
                        d[o + 4] *= 0.3;
                        d[o + 5] *= 0.3;
                        if (effects && (i & 1) === 0) effects.splash(wx, level + py + 0.1, wz, 7, 0.9);
                    }
                } else if (this.float) {
                    d[o + 4] += ((level - this.sink - d[o + 1]) * 14 - d[o + 4] * 3) * dt;
                    const drag = 1 - 0.8 * dt;
                    d[o + 3] *= drag;
                    d[o + 5] *= drag;
                    d[o + 9] *= 1 - 2.5 * dt;
                    d[o + 11] *= 1 - 2.5 * dt;
                    d[o + 10] *= 1 - 0.6 * dt;
                    // troncos se deitam na água: amortece a inclinação
                    d[o + 6] *= 1 - 2 * dt;
                    d[o + 8] *= 1 - 2 * dt;
                } else {
                    d[o + 4] += (-1.6 - d[o + 4]) * Math.min(1, 4 * dt);
                    d[o + 9] *= 1 - 2 * dt;
                    d[o + 10] *= 1 - 2 * dt;
                    d[o + 11] *= 1 - 2 * dt;
                }
            }
            _de.set(d[o + 6], d[o + 7], d[o + 8]);
            _dq.setFromEuler(_de);
            _dp.set(d[o], d[o + 1], d[o + 2]);
            _ds.set(d[o + 12] * k, d[o + 13] * k, d[o + 14] * k);
            this.mesh.setMatrixAt(i, _dm.compose(_dp, _dq, _ds));
        }
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.time >= this.life) {
            this.mesh.visible = false;
            return false;
        }
        return true;
    }

    hide() {
        this.mesh.visible = false;
    }
}

/* ---- geometrias de destroço compartilhadas por todas as torres ---- */

let rubbleGeo = null;
/** Bloco de entulho ~1 m (pedra aparelhada lascada). */
export function rubbleGeometry() {
    if (rubbleGeo) return rubbleGeo;
    const g = new RoundedBoxGeometry(1, 0.62, 0.74, 2, 0.14);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const k = 1 + 0.1 * Math.sin(x * 5.3 + z * 3.1) + 0.08 * Math.sin(y * 7.7 + x * 2.1);
        p.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals();
    applyWorldUV(g, 1);
    rubbleGeo = g;
    return g;
}

let plankGeo = null;
/** Viga quebrada ~2 m (eixo Y), ponta lascada. */
export function timberGeometry() {
    if (plankGeo) return plankGeo;
    const body = log(2, 0.16, { segs: 8, seed: 4, taper: 0.05, tip: 0.35, rings: 4 });
    const cap = logCap(0.16, 0, false);
    const merged = mergeGeometries([stripForMerge(body), stripForMerge(cap)], false);
    merged.translate(0, -1, 0);
    plankGeo = merged;
    return merged;
}

function stripForMerge(g) {
    for (const k of Object.keys(g.attributes)) {
        if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    }
    if (!g.index) {
        const count = g.attributes.position.count;
        const index = new Uint16Array(count);
        for (let i = 0; i < count; i++) index[i] = i;
        g.setIndex(new THREE.BufferAttribute(index, 1));
    }
    return g;
}

/* ================================================================== */
/* Braseiro                                                            */
/* ================================================================== */

/** Cesto de ferro com brasas sobre haste; a chama é separada (buildFlame). */
function addBrazier(kit, x, y, z, { pole = 1.3, r = 0.34 } = {}) {
    const fe = iron();
    kit.add(fe, lathe([[0.05, 0], [0.05, pole], [0.1, pole + 0.04]], 6, { smooth: true }), xf(x, y, z), 'keep');
    kit.add(fe, lathe([
        [0.1, pole], [r * 0.7, pole + 0.08], [r, pole + 0.34], [r * 1.06, pole + 0.4],
        [r * 0.92, pole + 0.4], [r * 0.6, pole + 0.14], [0.02, pole + 0.1]
    ], 10), xf(x, y, z), 'keep');
    for (let i = 0; i < 3; i++) {
        const a = (i / 3) * TAU;
        kit.add(fe, block(0.05, 0.5, 0.05, 0.015), xf(x + Math.cos(a) * 0.2, y + 0.22, z + Math.sin(a) * 0.2, 0, -a, 0.42));
    }
    return y + pole + 0.3;
}

/* ================================================================== */
/* Torre de pedra                                                      */
/* ================================================================== */

/**
 * Torre de vigia de pedra, ~11 m: base em talude, fuste, mísulas, parapeito
 * ameado, hurdício (galeria de madeira) no lado do rio (+Z local) e braseiro.
 * Origem = cota da fundação; a sapata desce 4,5 m para aguentar água rasa.
 */
export function buildStoneTower() {
    const group = new THREE.Group();
    group.name = 'stoneTower';
    const kit = new Kit();
    const stone = blockStone();
    const wood = darkWood();

    kit.add(stone, lathe([
        [3.5, -4.5], [3.25, 0.6], [2.95, 1.9], [2.95, 2.15], [2.62, 2.35],
        [2.56, 5.2], [2.66, 5.26], [2.66, 5.46], [2.56, 5.52],
        [2.52, 7.9], [3.12, 8.85], [3.16, 9.2], [3.16, 10.05], [2.74, 10.05], [2.74, 9.2], [0, 9.2]
    ], 26), null, 'keep');

    // mísulas do machicólis
    const corbels = 18;
    for (let i = 0; i < corbels; i++) {
        const a = (i / corbels) * TAU;
        kit.add(stone, block(0.34, 0.8, 0.62, 0.06), xf(Math.sin(a) * 2.78, 8.32, Math.cos(a) * 2.78, 0, a, 0));
    }
    // ameias (as do lado do rio ficam atrás do hurdício)
    const merlons = 9;
    for (let i = 0; i < merlons; i++) {
        const a = ((i + 0.5) / merlons) * TAU;
        kit.add(stone, block(1.12, 0.95, 0.44, 0.07), xf(Math.sin(a) * 2.95, 10.5, Math.cos(a) * 2.95, 0, a, 0));
    }
    // pedras de fundação com musgo
    const moss = mossRock();
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * TAU + 0.4;
        const s = 1.1 + hash(i * 3.3) * 0.9;
        kit.add(moss, boulder(i + 2, 2), xf(Math.sin(a) * 3.5, -0.4 - hash(i) * 0.6, Math.cos(a) * 3.5, 0, a * 2, 0, s, s * 0.9, s));
    }

    // hurdício: postes, piso, parapeito de tábuas e água de telhado sobre o rio
    const span = 1.9;
    const posts = 6;
    for (let i = 0; i < posts; i++) {
        const a = -span / 2 * 1.6 + (i / (posts - 1)) * span * 1.6;
        const sx = Math.sin(a);
        const cz = Math.cos(a);
        kit.add(wood, block(0.18, 3.1, 0.18, 0.03), xf(sx * 3.95, 9.15, cz * 3.95, 0, a, 0));
        kit.add(wood, block(0.2, 0.2, 1.9, 0.03), xf(sx * 3.2, 7.72, cz * 3.2, 0, a, 0));
        kit.add(wood, block(0.14, 0.14, 1.5, 0.03), xf(sx * 3.5, 7.2, cz * 3.5, -0.75, a, 0));
        if (i < posts - 1) {
            const am = a + (span * 1.6) / (posts - 1) / 2;
            const w = 2 * 3.95 * Math.sin((span * 1.6) / (posts - 1) / 2) + 0.1;
            kit.add(wood, block(w, 0.1, 1.1, 0.02), xf(Math.sin(am) * 3.42, 7.86, Math.cos(am) * 3.42, 0, am, 0));
            kit.add(wood, block(w, 1.05, 0.07, 0.02), xf(Math.sin(am) * 3.9, 8.5, Math.cos(am) * 3.9, 0, am, 0));
            kit.add(wood, block(w + 0.25, 0.08, 1.7, 0.02), xf(Math.sin(am) * 3.5, 10.86, Math.cos(am) * 3.5, 0.42, am, 0));
        }
    }

    // braseiro no centro do topo
    const flameY = addBrazier(kit, -0.9, 9.2, -0.7, { pole: 1.9, r: 0.4 });
    kit.build(group, { name: 'stoneTower' });

    const windows = new Kit();
    const glowMat = windowGlow();
    for (const [a, y] of [[0.5, 4.3], [-0.9, 6.6], [2.4, 6.2]]) {
        windows.add(glowMat, archPanel(0.34, 0.9, 0.3), xf(Math.sin(a) * 2.585, y, Math.cos(a) * 2.585, 0, a, 0), 'keep');
    }
    windows.build(group, { cast: false, receive: false, name: 'stoneTowerWindows' });

    const flame = buildFlame(0.85, 1.35);
    flame.position.set(-0.9, flameY, -0.7);
    group.add(flame);

    group.userData = {
        flame,
        firePoint: new THREE.Vector3(-0.9, flameY + 0.5, -0.7),
        guard: new THREE.Vector3(0.7, 9.2, 0.9),
        muzzle: new THREE.Vector3(0.5, 10.6, 2.6),
        height: 11
    };
    return group;
}

let _windowGlow = null;
/** Vidro aceso (emissivo quente): janelas e seteiras iluminadas por dentro. */
export function windowGlow() {
    if (!_windowGlow) {
        _windowGlow = new THREE.MeshStandardMaterial({
            color: 0x2a1708, emissive: 0xffa040, emissiveIntensity: 2.6, roughness: 0.5, side: THREE.DoubleSide, name: 'windowGlow'
        });
    }
    return _windowGlow;
}

/* ================================================================== */
/* Torre de madeira                                                    */
/* ================================================================== */

/**
 * Torre de vigia de madeira sobre estacas, ~12 m: quatro estacas inclinadas,
 * contraventamento em X, plataforma com guarda-corpo, telhado de palha em
 * quatro águas, escada de mão e braseiro pendurado no canto do rio.
 */
export function buildWoodTower() {
    const group = new THREE.Group();
    group.name = 'woodTower';
    const kit = new Kit();
    const bark = barkWood();
    const wood = darkWood();
    const oak = oakWood();
    const thatch = thatchRoof();

    const footR = 2.05;
    const topR = 1.6;
    const deckY = 8;
    const corners = [[1, 1], [1, -1], [-1, -1], [-1, 1]];
    const at = (c, y) => {
        const t = (y + 5) / (deckY + 5);
        const r = footR + (topR - footR) * t;
        return [c[0] * r, c[1] * r];
    };
    corners.forEach((c, i) => {
        const lean = Math.atan2((footR - topR) * Math.SQRT2, deckY + 5);
        const g = log(deckY + 5 + 2.4, 0.2, { seed: i + 1, taper: 0.18, rings: 7 });
        // estaca inclinada para dentro: gira em torno da diagonal
        const m = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(c[1], 0, -c[0]).normalize(), -lean);
        m.setPosition(c[0] * footR, -5, c[1] * footR);
        kit.add(bark, g, m, 'keep');
    });
    // travessas e contraventamento por face
    for (let f = 0; f < 4; f++) {
        const a = corners[f];
        const b = corners[(f + 1) % 4];
        for (const y of [2.5, 5.2, 7.7]) {
            const pa = at(a, y);
            const pb = at(b, y);
            const len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) + 0.5;
            const ang = Math.atan2(pb[0] - pa[0], pb[1] - pa[1]);
            kit.add(wood, block(0.16, 0.2, len, 0.03), xf((pa[0] + pb[0]) / 2, y, (pa[1] + pb[1]) / 2, 0, ang, 0));
        }
        for (const [y0, y1, flip] of [[2.5, 5.2, 0], [5.2, 7.7, 1]]) {
            const p0 = at(flip ? b : a, y0);
            const p1 = at(flip ? a : b, y1);
            const dx = p1[0] - p0[0];
            const dz = p1[1] - p0[1];
            const run = Math.hypot(dx, dz);
            const len = Math.hypot(run, y1 - y0);
            kit.add(wood, block(0.1, 0.16, len, 0.03),
                xf((p0[0] + p1[0]) / 2, (y0 + y1) / 2, (p0[1] + p1[1]) / 2, -Math.atan2(y1 - y0, run), Math.atan2(dx, dz), 0));
        }
    }
    // plataforma: tábuas com frestas
    for (let i = 0; i < 9; i++) {
        kit.add(oak, block(0.44, 0.09, 4.3, 0.02), xf(-1.92 + i * 0.48, deckY + 0.05, 0, 0, 0, (hash(i) - 0.5) * 0.02));
    }
    // guarda-corpo: montantes, corrimão e tábuas
    for (let f = 0; f < 4; f++) {
        const ang = (f * Math.PI) / 2;
        const nx = Math.sin(ang);
        const nz = Math.cos(ang);
        kit.add(wood, block(4.2, 0.1, 0.1, 0.02), xf(nx * 2.05, deckY + 1.05, nz * 2.05, 0, ang, 0));
        if (f !== 2) kit.add(oak, block(4.1, 0.5, 0.05, 0.015), xf(nx * 2.07, deckY + 0.55, nz * 2.07, 0, ang, 0));
    }
    // telhado de palha: três camadas sobrepostas em quatro águas
    const roof = lathe([
        [3.5, 10.2], [3.44, 10.42], [2.5, 11.05], [2.56, 11.2], [1.5, 11.9], [1.56, 12.05], [0.12, 13.0], [0.02, 13.0]
    ], 4, { flat: true, start: Math.PI / 4 });
    kit.add(thatch, roof, null, 'world');
    kit.add(thatch, lathe([[0.02, 10.5], [3.44, 10.24]], 4, { flat: true, start: Math.PI / 4 }), null, 'world');
    // escada de mão (lado de trás, −Z)
    const lean = 0.14;
    for (const sx of [-0.32, 0.32]) {
        kit.add(wood, block(0.09, 8.4, 0.09, 0.02), xf(sx, 4, -2.25 - 0.55, lean, 0, 0));
    }
    for (let i = 0; i < 16; i++) {
        const y = 0.4 + i * 0.5;
        kit.add(oak, block(0.72, 0.06, 0.07, 0.02), xf(0, y, -2.25 - 0.55 + (y - 4) * Math.tan(lean), lean, 0, 0));
    }
    // braseiro pendurado num braço, canto voltado ao rio
    kit.add(wood, block(0.12, 0.12, 1.5, 0.02), xf(1.95, deckY + 1.9, 2.55, -0.2, 0, 0));
    const flameY = addBrazier(kit, 1.95, deckY + 0.9, 3.2, { pole: 0.9, r: 0.36 });
    kit.build(group, { name: 'woodTower' });

    const flame = buildFlame(0.8, 1.25);
    flame.position.set(1.95, flameY, 3.2);
    group.add(flame);

    group.userData = {
        flame,
        firePoint: new THREE.Vector3(1.95, flameY + 0.5, 3.2),
        guard: new THREE.Vector3(-0.4, deckY + 0.1, 0.9),
        muzzle: new THREE.Vector3(0, deckY + 1.9, 2.2),
        height: 13
    };
    return group;
}

/* ================================================================== */
/* Catapulta                                                           */
/* ================================================================== */

/**
 * Ângulos do braço (rad, em torno de X). Com a ponta longa em +Z no repouso, a ponta fica em
 *   (0, −sen θ · L, cos θ · L)  →  2,5 rad = armado (atrás, embaixo) · 5,0 rad = solto (no alto, à frente).
 * O braço gira de 2,5 a 5,0 passando por π (horizontal atrás) e 3π/2 (a prumo).
 */
export const CATAPULT_COCKED = 2.5;
export const CATAPULT_RELEASED = 5.0;

/**
 * Trabuco de contrapeso sobre platô de troncos em estacas, ~9 m com o braço no
 * alto. O braço (`userData.arm`) gira em torno do eixo X no topo do cavalete;
 * `userData.boulder` é o projétil em brasa na colher. Frente = +Z local.
 */
export function buildCatapult() {
    const group = new THREE.Group();
    group.name = 'catapult';
    const kit = new Kit();
    const bark = barkWood();
    const wood = darkWood();
    const oak = oakWood();
    const fe = iron();
    const deckY = 3.1;

    // estacas e travessas do platô
    let s = 1;
    for (const x of [-2.9, 0, 2.9]) {
        for (const z of [-2.6, 2.6]) {
            kit.add(bark, log(deckY + 5.2, 0.24, { seed: s++, taper: 0.1 }), xf(x, -5, z, 0, s, 0), 'keep');
        }
    }
    for (const z of [-2.6, 2.6]) {
        kit.add(bark, log(6.8, 0.2, { seed: s++, taper: 0.04 }), xf(-3.4, deckY - 0.42, z, 0, 0, -Math.PI / 2), 'keep');
    }
    // deque de troncos lado a lado
    for (let i = 0; i < 13; i++) {
        const z = -2.9 + i * 0.485;
        kit.add(bark, log(6.9 + hash(i) * 0.5, 0.23, { seed: 20 + i, taper: 0.06 }),
            xf(-3.45 - hash(i + 5) * 0.25, deckY - 0.2, z, 0, 0, -Math.PI / 2), 'keep');
        kit.add(oak, logCap(0.22, 0, false), xf(-3.45 - hash(i + 5) * 0.25, deckY - 0.2, z, 0, 0, -Math.PI / 2), 'keep');
    }
    // paliçada de estacas afiadas na frente
    for (let i = 0; i < 7; i++) {
        const x = -3 + i;
        kit.add(bark, log(2.3 + hash(i * 2.2) * 0.6, 0.15, { seed: 40 + i, tip: 0.6, segs: 8 }),
            xf(x, deckY - 0.9, 3.25, 0.5, 0, (hash(i) - 0.5) * 0.2), 'keep');
    }

    // máquina: soleiras, cavaletes em A e eixo
    const axleY = deckY + 3.7;
    for (const x of [-1.05, 1.05]) {
        kit.add(wood, block(0.3, 0.3, 4.6, 0.04), xf(x, deckY + 0.18, 0));
        for (const dir of [-1, 1]) {
            const run = 1.75;
            const len = Math.hypot(run, 3.55);
            kit.add(wood, block(0.24, len, 0.24, 0.04), xf(x, deckY + 0.3 + 3.55 / 2, dir * run / 2, -dir * Math.atan2(run, 3.55), 0, 0));
        }
        kit.add(wood, block(0.2, 0.2, 2.2, 0.03), xf(x, deckY + 1.6, 0));
        kit.add(fe, block(0.34, 0.5, 0.5, 0.05), xf(x, axleY, 0));
    }
    kit.add(wood, block(2.4, 0.26, 0.26, 0.04), xf(0, deckY + 0.2, -2.1));
    kit.add(wood, block(2.4, 0.26, 0.26, 0.04), xf(0, deckY + 0.2, 2.1));
    kit.add(fe, lathe([[0.09, -1.3], [0.09, 1.3]], 8, { smooth: true }), xf(0, axleY, 0, 0, 0, Math.PI / 2), 'keep');
    // guincho de armar, atrás
    kit.add(oak, lathe([[0.2, -0.8], [0.24, -0.7], [0.2, -0.6], [0.2, 0.6], [0.24, 0.7], [0.2, 0.8]], 10), xf(0, deckY + 0.75, -1.9, 0, 0, Math.PI / 2), 'keep');
    // pilha de pedras de munição
    const moss = mossRock(0xb8b0a4);
    for (let i = 0; i < 5; i++) {
        kit.add(moss, boulder(30 + i, 1), xf(2.3 + (i % 2) * 0.55, deckY + 0.3 + (i > 2 ? 0.45 : 0), -1.6 + (i % 3) * 0.55, 0, i, 0, 0.36));
    }
    kit.build(group, { name: 'catapult' });

    // braço (malha própria: gira)
    const armKit = new Kit();
    const long = 4.6;
    const short = 1.5;
    armKit.add(wood, lathe([[0.2, -short], [0.17, 0], [0.1, long]], 8, { smooth: true }), xf(0, 0, 0, Math.PI / 2, 0, 0), 'keep');
    // (lathe ao longo de Y → girado para Z: ponta longa em +Z)
    armKit.add(wood, block(1.25, 1.15, 1.05, 0.06), xf(0, 0.75, -short + 0.1));
    for (const x of [-0.45, 0.45]) armKit.add(wood, block(0.1, 1.3, 0.12, 0.02), xf(x, 0.2, -short + 0.1));
    armKit.add(wood, lathe([[0.02, -0.12], [0.3, -0.06], [0.42, 0.1], [0.46, 0.16], [0.38, 0.16], [0.26, 0.02], [0.02, -0.02]], 10), xf(0, -0.12, long - 0.1, 0, 0, Math.PI), 'keep');
    const arm = new THREE.Group();
    arm.name = 'catapultArm';
    arm.position.set(0, axleY, 0);
    armKit.build(arm, { name: 'arm' });
    group.add(arm);

    const boulderMesh = new THREE.Mesh(boulder(77, 1, 1, 0.9, 1), emberRock());
    boulderMesh.scale.setScalar(0.4);
    boulderMesh.position.set(0, -0.5, long - 0.1);
    boulderMesh.castShadow = false;
    arm.add(boulderMesh);
    // a chama fica no grupo (sempre a prumo); structures.js a reposiciona sobre a pedra
    const flame = buildFlame(0.75, 1.1);
    group.add(flame);
    arm.rotation.x = CATAPULT_COCKED;

    group.userData = {
        flame,
        arm,
        boulder: boulderMesh,
        armLength: long,
        axleY,
        firePoint: new THREE.Vector3(0, deckY + 1.4, -1.2),
        guard: new THREE.Vector3(-2.2, deckY + 0.03, -0.6),
        muzzle: new THREE.Vector3(0, axleY + long * 0.9, 1.3),
        height: 9
    };
    return group;
}

let _ember = null;
/** Pedra em brasa do trabuco. */
export function emberRock() {
    if (!_ember) {
        _ember = new THREE.MeshStandardMaterial({
            color: 0x241208, emissive: 0xff5a14, emissiveIntensity: 2.4, roughness: 0.8, name: 'ember'
        });
    }
    return _ember;
}

/* ================================================================== */
/* Barricada                                                           */
/* ================================================================== */

const BOOM_LENGTH = 8.4;

/** Tronco da barricada com topos cortados; 2 grupos de material: [casca, lenho]. */
let boomLogGeo = null;
export function boomLogGeometry() {
    if (boomLogGeo) return boomLogGeo;
    const body = stripForMerge(log(BOOM_LENGTH, 0.36, { seed: 9, taper: 0.1, segs: 12, rings: 8 }));
    const capA = stripForMerge(logCap(0.36, 0, false));
    const capB = stripForMerge(logCap(0.325, BOOM_LENGTH, true));
    const caps = mergeGeometries([capA, capB], false);
    const merged = mergeGeometries([body, caps], true);
    merged.rotateZ(-Math.PI / 2);
    merged.translate(-BOOM_LENGTH / 2, 0, 0);
    boomLogGeo = merged;
    return merged;
}

/**
 * Barreira flutuante: três troncos amarrados, travessas, estacas afiadas
 * apontando rio acima (+Z) e corrente de ferro. Origem na linha d'água.
 */
export function buildBarricade() {
    const group = new THREE.Group();
    group.name = 'barricade';
    const kit = new Kit();
    const bark = barkWood();
    const oak = oakWood(0xd9c9a8);
    const fe = iron();

    const logZ = [-0.66, 0, 0.66];
    logZ.forEach((z, i) => {
        const len = BOOM_LENGTH - 0.3 + hash(i * 4.1) * 0.6;
        const x0 = -len / 2 + (hash(i) - 0.5) * 0.5;
        kit.add(bark, log(len, 0.36, { seed: 9 + i, taper: 0.1, segs: 12, rings: 8 }), xf(x0, -0.12, z, 0, 0, -Math.PI / 2), 'keep');
        kit.add(oak, logCap(0.36, 0, false), xf(x0, -0.12, z, 0, 0, -Math.PI / 2), 'keep');
        kit.add(oak, logCap(0.325, 0, true), xf(x0 + len, -0.12, z, 0, 0, -Math.PI / 2), 'keep');
    });
    // travessas por cima
    for (const x of [-3.1, -1, 1.1, 3.2]) {
        kit.add(bark, log(2.3, 0.17, { seed: 30 + x, taper: 0.06, segs: 8 }), xf(x, 0.3, -1.15, Math.PI / 2, 0, 0), 'keep');
        kit.add(oak, logCap(0.17, 0, false), xf(x, 0.3, -1.15, Math.PI / 2, 0, 0), 'keep');
        // amarração de corda (voltas de toro)
        for (const z of [-0.66, 0, 0.66]) {
            const coil = new THREE.TorusGeometry(0.4, 0.035, 5, 14);
            kit.add(oak, coil, xf(x + 0.2, -0.05, z, 0, Math.PI / 2, 0, 1, 1.05, 1), 'world');
            kit.add(oak, coil, xf(x - 0.2, -0.05, z, 0, Math.PI / 2, 0, 1, 1.05, 1), 'world');
        }
    }
    // estacas afiadas (cavalo de frisa) apontando rio acima
    for (let i = 0; i < 9; i++) {
        const x = -3.7 + i * 0.93;
        const up = i % 2 === 0;
        kit.add(oak, log(2.7 + hash(i) * 0.5, 0.13, { seed: 50 + i, tip: 0.75, segs: 8, taper: 0.1 }),
            xf(x, -0.2, up ? -0.5 : -0.3, up ? 0.62 : 1.05, 0, (hash(i * 1.7) - 0.5) * 0.25), 'keep');
    }
    // corrente: elos alternados ao longo da frente
    const link = new THREE.TorusGeometry(0.12, 0.035, 5, 10);
    for (let i = 0; i < 32; i++) {
        const t = i / 31;
        const x = -3.9 + t * 7.8;
        const sag = Math.sin(t * Math.PI * 4) * 0.08;
        kit.add(fe, link, xf(x, 0.3 + sag, 1.02, i % 2 ? Math.PI / 2 : 0, Math.PI / 2, 0, 1.25, 1, 1), 'world');
    }
    for (const x of [-3.95, 3.95]) {
        kit.add(fe, lathe([[0.06, 0], [0.06, 0.5], [0.16, 0.55], [0.16, 0.62], [0.02, 0.66]], 8), xf(x, 0.05, 0.9), 'keep');
    }
    kit.build(group, { name: 'barricade' });
    return group;
}

export { BOOM_LENGTH };
