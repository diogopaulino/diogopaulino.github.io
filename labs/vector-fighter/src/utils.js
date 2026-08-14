/** Utilitários numéricos, easing e detecção de dispositivo. */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const randRange = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(min + Math.random() * (max - min + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const TAU = Math.PI * 2;

export function easeOutCubic(t) {
    const x = 1 - t;
    return 1 - x * x * x;
}

export function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

export function saturate(t) {
    return clamp(t, 0, 1);
}

/**
 * Octógono regular centrado na origem, com *inradius* `r`
 * (distância do centro até o meio de uma face).
 * Faces alinhadas aos eixos e às diagonais — o ring clássico da AM2.
 */
export function insideOctagon(x, z, r) {
    const ax = Math.abs(x);
    const az = Math.abs(z);
    return ax <= r && az <= r && ax + az <= r * Math.SQRT2;
}

export function detectMobile() {
    if (typeof navigator === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
    return Boolean(coarse && narrow) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function detectSoftwareGL() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return true;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '') : '';
        return /swiftshader|llvmpipe|softpipe|microsoft basic render|\bcpu\b/i.test(name);
    } catch (err) {
        return true;
    }
}
