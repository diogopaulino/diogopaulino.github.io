/** Utilitários numéricos, AABB, raios e detecção de dispositivo. */

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
    } catch (err) {
        return true;
    }
}

export function hexToArr(hex) {
    return [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
}

/**
 * Interseção raio–AABB (método das slabs).
 * @returns {number|null} t ao longo do raio, ou null.
 */
export function rayAABB(ox, oy, oz, dx, dy, dz, b, maxT) {
    let tmin = 0;
    let tmax = maxT;
    const o = [ox, oy, oz];
    const d = [dx, dy, dz];
    const mn = [b.minX, b.minY, b.minZ];
    const mx = [b.maxX, b.maxY, b.maxZ];
    for (let i = 0; i < 3; i++) {
        if (Math.abs(d[i]) < 1e-8) {
            if (o[i] < mn[i] || o[i] > mx[i]) return null;
        } else {
            const inv = 1 / d[i];
            let t1 = (mn[i] - o[i]) * inv;
            let t2 = (mx[i] - o[i]) * inv;
            if (t1 > t2) {
                const tmp = t1;
                t1 = t2;
                t2 = tmp;
            }
            tmin = t1 > tmin ? t1 : tmin;
            tmax = t2 < tmax ? t2 : tmax;
            if (tmin > tmax) return null;
        }
    }
    return tmin;
}

export function aabbNormal(b, px, py, pz) {
    const dx = Math.min(Math.abs(px - b.minX), Math.abs(b.maxX - px));
    const dy = Math.min(Math.abs(py - b.minY), Math.abs(b.maxY - py));
    const dz = Math.min(Math.abs(pz - b.minZ), Math.abs(b.maxZ - pz));
    if (dx <= dy && dx <= dz) return { x: px < (b.minX + b.maxX) * 0.5 ? -1 : 1, y: 0, z: 0 };
    if (dy <= dx && dy <= dz) return { x: 0, y: py < (b.minY + b.maxY) * 0.5 ? -1 : 1, z: 0 };
    return { x: 0, y: 0, z: pz < (b.minZ + b.maxZ) * 0.5 ? -1 : 1 };
}

export function sphereAABB(px, py, pz, r, b) {
    const cx = clamp(px, b.minX, b.maxX);
    const cy = clamp(py, b.minY, b.maxY);
    const cz = clamp(pz, b.minZ, b.maxZ);
    const dx = px - cx;
    const dy = py - cy;
    const dz = pz - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r * r) return null;
    const d = Math.sqrt(d2) || r;
    return { x: dx / d, y: dy / d, z: dz / d, depth: r - d, cx, cy, cz };
}
