/** Utilitários numéricos, ruído e detecção de GPU. */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

/** Hermite cúbico — interpolação de câmera entre keyframes. */
export function hermite(p0, p1, m0, m1, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p0
        + (t3 - 2 * t2 + t) * m0
        + (-2 * t3 + 3 * t2) * p1
        + (t3 - t2) * m1;
}

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

export function fbm(x, y, seed = 0, octaves = 5) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 19) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
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

export function detectSoftwareGL(renderer) {
    try {
        const gl = renderer.getContext();
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        if (!info) return false;
        const name = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '';
        return SOFTWARE_GL.test(name);
    } catch {
        return false;
    }
}
