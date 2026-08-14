/** Utilitários numéricos, detecção de dispositivo e RNG determinístico. */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const randRange = (min, max) => min + Math.random() * (max - min);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function hash(n) {
    n = (n | 0) * 374761393 + 668265263;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function mulberry32(seed) {
    let a = seed | 0;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 1 milha = 1609.34 m. Abaixo de 0.1 mi mostra jardas. */
export function formatMiles(meters) {
    const mi = meters / 1609.34;
    if (mi < 0.1) return `${Math.max(0, Math.floor(meters * 1.09361))} yd`;
    if (mi < 10) return `${mi.toFixed(2)} mi`;
    return `${mi.toFixed(1)} mi`;
}

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
}

/** Sabor de calendário da corrida: ~80 m de cena ≈ 1 dia de travessia. */
export function formatDays(meters) {
    const days = Math.floor(meters / 80);
    const years = Math.floor(days / 365);
    const rem = days - years * 365;
    const months = Math.floor(rem / 30);
    const d = rem - months * 30;
    if (years <= 0 && months <= 0) return `${Math.max(0, d)} d`;
    if (years <= 0) return `${months} mês · ${d} d`;
    return `${years} a · ${months} mês`;
}

export function hexToArr(hex) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
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
