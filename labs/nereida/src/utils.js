/** Utilitários numéricos, spline do recife e detecção de dispositivo. */

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

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
}

export function formatScore(n) {
    return Math.floor(n).toLocaleString('pt-BR');
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
    } catch {
        return true;
    }
}

/**
 * Spline da corrente. s em metros ao longo de z, com meandros em x/y.
 * x = 34 sin(2.15π t) + 11 sin(5.4π t)
 * y = 16 + 9 sin(1.7π t) + 4 cos(3.6π t)
 */
export function pathAt(s, length) {
    const t = clamp(s / length, 0, 1);
    const x = Math.sin(t * Math.PI * 2.15) * 34 + Math.sin(t * Math.PI * 5.4) * 11;
    const y = 16 + Math.sin(t * Math.PI * 1.7) * 9 + Math.cos(t * Math.PI * 3.6) * 4;
    return { x, y, z: s, t };
}

export function pathTangent(s, length) {
    const a = pathAt(s, length);
    const b = pathAt(s + 0.9, length);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    return { x: dx / len, y: dy / len, z: dz / len };
}

export function pathFrame(s, length) {
    const p = pathAt(s, length);
    const f = pathTangent(s, length);
    const upx = 0;
    const upy = 1;
    const upz = 0;
    let rx = f.y * upz - f.z * upy;
    let ry = f.z * upx - f.x * upz;
    let rz = f.x * upy - f.y * upx;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const ux = ry * f.z - rz * f.y;
    const uy = rz * f.x - rx * f.z;
    const uz = rx * f.y - ry * f.x;
    return { p, f, r: { x: rx, y: ry, z: rz }, u: { x: ux, y: uy, z: uz } };
}

export function zoneAt(t, zones) {
    let z = zones[0];
    for (let i = 0; i < zones.length; i++) {
        if (t >= zones[i].t) z = zones[i];
    }
    return z;
}
