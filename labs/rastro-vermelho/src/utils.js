/** Utilitários numéricos, ruído e detecção de dispositivo. */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

export const wrapPi = (a) => {
    let v = a;
    while (v > Math.PI) v -= Math.PI * 2;
    while (v < -Math.PI) v += Math.PI * 2;
    return v;
};

export const wrap01 = (t) => {
    let v = t % 1;
    if (v < 0) v += 1;
    return v;
};

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Relógio de 24h a partir de progresso do dia ∈ [0, 1]. */
export function formatClock(dayT) {
    const totalMin = Math.floor(((dayT % 1) + 1) % 1 * 24 * 60);
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
}

export function formatKm(meters) {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(meters < 10000 ? 2 : 1)} km`;
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

export function fbm(x, y, seed = 0, octaves = 4) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 19) * amp;
        amp *= 0.5;
        freq *= 2.03;
    }
    return sum;
}

/** Ruído de crista: 1 − |2n − 1|, bom para serras e cânions. */
export function ridged(x, y, seed = 0, octaves = 4) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    for (let i = 0; i < octaves; i++) {
        const n = 1 - Math.abs(valueNoise(x * freq, y * freq, seed + i * 19) * 2 - 1);
        sum += n * amp;
        amp *= 0.5;
        freq *= 2.07;
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

export function hourLabel(t) {
    if (t < 0.08) return 'madrugada';
    if (t < 0.16) return 'alvorada';
    if (t < 0.32) return 'manhã';
    if (t < 0.55) return 'meio-dia';
    if (t < 0.70) return 'tarde';
    if (t < 0.84) return 'hora dourada';
    if (t < 0.93) return 'crepúsculo';
    return 'noite';
}
