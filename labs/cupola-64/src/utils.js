/** Números, detecção de GPU e helpers de ângulo. */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const wrapPi = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
};

export const lerpAngle = (a, b, t) => a + wrapPi(b - a) * t;

export const randRange = (min, max) => min + Math.random() * (max - min);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${r.toString().padStart(2, '0')}`;
}

export function detectMobile() {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const ua = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    return touch && (coarse || ua);
}

export function detectSoftwareGL() {
    try {
        const c = document.createElement('canvas');
        const gl = c.getContext('webgl2') || c.getContext('webgl');
        if (!gl) return true;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        const renderer = info
            ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL)
            : gl.getParameter(gl.RENDERER);
        return /swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(String(renderer));
    } catch {
        return true;
    }
}

/**
 * Altura do terreno da Ilha da Cúpola.
 * Colinas senoidais + montanha ao norte + platô do castelo ao sul + praia.
 */
export function heightAt(x, z) {
    const r = Math.hypot(x, z);
    if (r > 54) return -2.4;

    const island = smoothstep(52, 36, r);
    let h = 0.22;
    h += Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.2;
    h += Math.sin(x * 0.047 + z * 0.061) * 0.72;
    h += Math.cos((x - z) * 0.075) * 0.38;

    const md = Math.hypot(x - 3, z + 26);
    if (md < 20) {
        const t = 1 - md / 20;
        h += t * t * (1.15 - t * 0.12) * 17.4;
        if (md < 3.4) h = Math.max(h, 16.85);
    }

    const cd = Math.hypot(x, z - 25);
    if (cd < 13.5) {
        const t = 1 - cd / 13.5;
        h = Math.max(h, 1.28 + t * 0.55);
    }

    const knoll = Math.hypot(x + 18, z - 4);
    if (knoll < 8) h += (1 - knoll / 8) ** 2 * 2.4;

    const knoll2 = Math.hypot(x - 16, z + 8);
    if (knoll2 < 7) h += (1 - knoll2 / 7) ** 2 * 1.8;

    h *= island;
    if (r > 38) {
        const beach = smoothstep(52, 38, r);
        h = lerp(-0.2, Math.max(h, 0.04), beach);
    }
    return h;
}

export function inCave(x, z, y) {
    return x > -2.8 && x < 8.4 && z > -22.5 && z < -11.2 && y < 9.4 && y > 3.2;
}

export function caveFloor(x, z) {
    const t = clamp((z + 22.5) / 11.3, 0, 1);
    return 4.15 + t * 2.1 + Math.sin(x * 0.4) * 0.12;
}

function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

export function terrainColor(x, z, y) {
    const r = Math.hypot(x, z);
    const md = Math.hypot(x - 3, z + 26);
    if (y < 0.12 || r > 44) return 0xe8d39a;
    if (md < 14 && y > 8) return 0xc4b49a;
    if (md < 8 && y > 13) return 0xefe6d8;
    if (Math.abs(x) < 2.4 && z > 2 && z < 22 && y < 2.4) return 0xd2b48c;
    return ((Math.floor(x * 0.35) + Math.floor(z * 0.35)) & 1) === 0 ? 0x3ecf4a : 0x2faf3d;
}
