/**
 * gfx/core — utilitários matemáticos, ruído e detecção de capacidade.
 * Kit gráfico compartilhado pelos labs Santos Orla 3D e Santos, 1908.
 * Tudo aqui é determinístico (seeded) para o mundo nascer igual a cada visita.
 */
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const saturate = (v) => clamp(v, 0, 1);
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export function smoothstep(e0, e1, x) {
    const t = clamp((x - e0) / (e1 - e0), 0, 1);
    return t * t * (3 - 2 * t);
}
export const remap = (v, a, b, c, d) => c + (d - c) * clamp((v - a) / (b - a), 0, 1);

/** PRNG mulberry32 — rápido e bem distribuído. */
export function seeded(seed = 1) {
    let s = seed >>> 0;
    const rnd = () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    rnd.range = (a, b) => a + (b - a) * rnd();
    rnd.int = (a, b) => Math.floor(a + (b - a + 1) * rnd());
    rnd.pick = (arr) => arr[Math.floor(rnd() * arr.length) % arr.length];
    rnd.sign = () => (rnd() < 0.5 ? -1 : 1);
    return rnd;
}

function hash2i(x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/**
 * Value noise 2D com período opcional (tileável quando period > 0).
 * x, y em unidades de célula.
 */
export function noise2(x, y, period = 0, seed = 0, periodY = period) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const w = (i, p) => (p > 0 ? ((i % p) + p) % p : i);
    const x0 = w(xi, period);
    const x1 = w(xi + 1, period);
    const y0 = w(yi, periodY);
    const y1 = w(yi + 1, periodY);
    const a = hash2i(x0, y0, seed);
    const b = hash2i(x1, y0, seed);
    const c = hash2i(x0, y1, seed);
    const d = hash2i(x1, y1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** fBm tileável: `period` é o número de células da oitava base. */
export function fbm2(x, y, octaves = 4, period = 0, seed = 0, gain = 0.5) {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
        sum += amp * noise2(x * f, y * f, period * f, seed + o * 17);
        norm += amp;
        amp *= gain;
        f *= 2;
    }
    return sum / norm;
}

/** fBm tileável anisotrópico: u,v ∈ [0,1), px/py = células por eixo na oitava base. */
export function fbm2a(u, v, px, py, octaves = 4, seed = 0) {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
        sum += amp * noise2(u * px * f, v * py * f, px * f, seed + o * 17, py * f);
        norm += amp;
        amp *= 0.5;
        f *= 2;
    }
    return sum / norm;
}

/** Ruído de cristas (ridged) — bom para ondulações de areia e serras. */
export function ridged2(x, y, octaves = 4, period = 0, seed = 0) {
    let amp = 0.5;
    let sum = 0;
    let norm = 0;
    let f = 1;
    for (let o = 0; o < octaves; o++) {
        const n = 1 - Math.abs(noise2(x * f, y * f, period * f, seed + o * 31) * 2 - 1);
        sum += amp * n * n;
        norm += amp;
        amp *= 0.5;
        f *= 2;
    }
    return sum / norm;
}

/** Worley F1 tileável (distância à célula mais próxima), retorna [dist, idCelula]. */
export function worley2(x, y, period = 0, seed = 0) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let best = 9;
    let id = 0;
    for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
            let cx = xi + i;
            let cy = yi + j;
            const wx = period > 0 ? ((cx % period) + period) % period : cx;
            const wy = period > 0 ? ((cy % period) + period) % period : cy;
            const px = cx + hash2i(wx, wy, seed);
            const py = cy + hash2i(wx, wy, seed + 7);
            const d = (px - x) * (px - x) + (py - y) * (py - y);
            if (d < best) {
                best = d;
                id = hash2i(wx, wy, seed + 13);
            }
        }
    }
    return [Math.sqrt(best), id];
}

/** GLSL: hash + value noise + fbm (prefixo gfx para não colidir com chunks do three). */
export const GLSL_NOISE = /* glsl */ `
float gfxHash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}
float gfxNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(gfxHash(i), gfxHash(i + vec2(1.0, 0.0)), u.x),
               mix(gfxHash(i + vec2(0.0, 1.0)), gfxHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gfxFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
    for (int i = 0; i < 5; i++) {
        v += a * gfxNoise(p);
        p = r * p * 2.03 + 11.7;
        a *= 0.5;
    }
    return v;
}
`;

/** Detecta GPU por software (SwiftShader etc.) — força a qualidade baixa. */
export function detectSoftwareGL(renderer) {
    try {
        const gl = renderer ? renderer.getContext() : document.createElement('canvas').getContext('webgl2');
        if (!gl) return true;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        if (!info) return false;
        const name = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '';
        return /SwiftShader|llvmpipe|SoftGL|Software|Microsoft Basic Render/i.test(name);
    } catch {
        return true;
    }
}

export function detectMobile() {
    // iPadOS 13+ manda UA de Macintosh; maxTouchPoints distingue do Mac real.
    const appleTouch = /iP(hone|ad|od)/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return appleTouch
        || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
}

export function detectTouch() {
    return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

/**
 * Escolhe o tier de qualidade.
 * Regra: mobile / pouca memória / poucos núcleos → low; desktop forte → high.
 */
export function pickTier(choice = 'auto') {
    if (choice === 'low' || choice === 'medium' || choice === 'high') return choice;
    const memory = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    const shortSide = Math.min(window.innerWidth, window.innerHeight);
    if (detectMobile() || memory <= 4 || cores <= 4) return 'low';
    if (memory >= 8 && cores >= 8 && shortSide >= 700) return 'high';
    return 'medium';
}

/** Projeta UVs em espaço de mundo (triplanar por face dominante), em metros / `scale`. */
export function applyWorldUV(geometry, scale = 1, offset = 0) {
    const pos = geometry.attributes.position;
    let nor = geometry.attributes.normal;
    if (!nor) {
        geometry.computeVertexNormals();
        nor = geometry.attributes.normal;
    }
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
        const ax = Math.abs(nor.getX(i));
        const ay = Math.abs(nor.getY(i));
        const az = Math.abs(nor.getZ(i));
        let u;
        let v;
        if (ay >= ax && ay >= az) {
            u = pos.getX(i);
            v = pos.getZ(i);
        } else if (ax >= az) {
            u = pos.getZ(i);
            v = pos.getY(i);
        } else {
            u = pos.getX(i);
            v = pos.getY(i);
        }
        uv[i * 2] = u / scale + offset;
        uv[i * 2 + 1] = v / scale + offset;
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return geometry;
}

/** Pinta a geometria inteira com uma cor de vértice (para merge com vertexColors). */
export function paint(geometry, color) {
    const c = color.isColor ? color : new THREE.Color(color);
    const n = geometry.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geometry;
}

/** Aplica transformação TRS e devolve a própria geometria (encadeável). */
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
export function place(geometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
    _e.set(rx, ry, rz);
    _q.setFromEuler(_e);
    _m.compose(new THREE.Vector3(x, y, z), _q, new THREE.Vector3(sx, sy, sz));
    geometry.applyMatrix4(_m);
    return geometry;
}

/** Remove atributos que impedem merge (uv2, etc.) e garante não-indexado/indexado consistente. */
export function normalizeForMerge(geometries, { keepUV = true, keepColor = true } = {}) {
    return geometries.map((g) => {
        const out = g.index ? g.toNonIndexed() : g;
        for (const name of Object.keys(out.attributes)) {
            if (name === 'position' || name === 'normal') continue;
            if (name === 'uv' && keepUV) continue;
            if (name === 'color' && keepColor) continue;
            out.deleteAttribute(name);
        }
        if (keepUV && !out.attributes.uv) {
            out.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(out.attributes.position.count * 2), 2));
        }
        if (keepColor && !out.attributes.color) paint(out, 0xffffff);
        return out;
    });
}

export function disposeObject(root) {
    root.traverse((obj) => {
        obj.geometry?.dispose?.();
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        for (const m of mats) {
            for (const key of Object.keys(m)) {
                if (m[key]?.isTexture) m[key].dispose();
            }
            m.dispose?.();
        }
    });
}
