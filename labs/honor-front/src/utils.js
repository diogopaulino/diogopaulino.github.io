/** Utilitários numéricos, ruído e detecção de dispositivo. */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

export const randRange = (min, max) => min + Math.random() * (max - min);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function pad2(n) {
    return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

/** Hash 2D determinístico em [0, 1). */
export function hash2(x, y, seed = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

export function valueNoise(x, y, seed = 0) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(x0, y0, seed);
    const b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed);
    const d = hash2(x0 + 1, y0 + 1, seed);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

export function fbm(x, y, seed = 0) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < 4; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 19) * amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum;
}

export function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

export function detectMobile() {
    if (typeof navigator === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
    return Boolean(coarse && narrow) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

const SOFTWARE_GL = /swiftshader|llvmpipe|softpipe|microsoft basic render|\bcpu\b|software/i;

export function isSoftwareGLName(name) {
    return SOFTWARE_GL.test(String(name || ''));
}

export function detectSoftwareGL() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return true;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
        return isSoftwareGLName(name);
    } catch (err) {
        return true;
    }
}

export function rendererIsSoftware(renderer) {
    try {
        const gl = renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
        return isSoftwareGLName(name);
    } catch (err) {
        return false;
    }
}

export function disposeObject(obj) {
    obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
    });
    obj.parent?.remove(obj);
}

/** Crateras fixas da praia — mesma fórmula no heightmap e no mesh. */
const CRATERS = [
    [6, 22, 5.5, 1.15],
    [-12, 38, 6.2, 1.35],
    [18, 48, 4.8, 0.95],
    [-4, 61, 7.2, 1.55],
    [14, 72, 5.1, 1.1],
    [-20, 54, 4.4, 0.85]
];

export function craterDip(x, z) {
    let dip = 0;
    for (let i = 0; i < CRATERS.length; i++) {
        const [cx, cz, r, d] = CRATERS[i];
        const dist = Math.hypot(x - cx, z - cz);
        if (dist < r) {
            const t = 1 - dist / r;
            dip += d * t * t;
        }
    }
    return dip;
}

/**
 * Altura do terreno. +Z aponta para o interior (muralha, vila, penhasco).
 * Y = 0 é o nível médio da água.
 */
export function heightAt(x, z) {
    const shore = smoothstep(-10, 16, z);
    let h = -1.05 + shore * 1.55;
    h += smoothstep(10, 82, z) * 2.55;
    h += smoothstep(76, 98, z) * 4.15;
    h += smoothstep(96, 128, z) * 1.35;
    h += (fbm(x * 0.038, z * 0.032, 4) - 0.48) * (0.35 + 1.7 * smoothstep(110, 170, z));
    h += smoothstep(214, 258, z) * (5.8 + Math.abs(x) * 0.02);
    h -= craterDip(x, z) * smoothstep(8, 20, z) * (1 - smoothstep(80, 92, z));
    return h;
}

export function headingDeg(yaw) {
    let d = ((-yaw * 180) / Math.PI) % 360;
    if (d < 0) d += 360;
    return d;
}
