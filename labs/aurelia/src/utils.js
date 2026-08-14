/** Utilitários numéricos, RNG e persistência. */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));
export const sign = (v) => (v < 0 ? -1 : 1);
export const wrapAngle = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
};
export const saturate = (v) => clamp(v, 0, 1);

export function smoothstep(edge0, edge1, x) {
    const t = saturate((x - edge0) / (edge1 - edge0));
    return t * t * (3 - 2 * t);
}

export function mulberry32(seed) {
    let a = seed | 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export function hash2(x, y) {
    let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

export function formatTime(seconds) {
    const ms = Math.max(0, seconds) * 1000;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const f = Math.floor(ms % 1000);
    return `${m}:${s.toString().padStart(2, '0')}.${f.toString().padStart(3, '0')}`;
}

export function formatSpeed(ms) {
    return Math.round(Math.max(0, ms) * 3.6);
}

export function detectMobile() {
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
    return Boolean(coarse && narrow) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function detectQuality() {
    const cores = navigator.hardwareConcurrency || 4;
    const mem = navigator.deviceMemory || 4;
    if (detectMobile() || cores <= 4 || mem <= 4) return 'medium';
    if (cores >= 8 && mem >= 8) return 'high';
    return 'medium';
}

const STORAGE_KEY = 'aurelia-festival-v1';

export function loadSettings() {
    const defaults = {
        car: 'veloce',
        sky: 'golden',
        quality: 'auto',
        volume: 0.72,
        audio: true,
        assists: true,
        camera: 'chase'
    };
    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch {
        return defaults;
    }
}

export function saveSettings(settings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch { /* private mode */ }
}

export function loadBest() {
    try {
        return JSON.parse(localStorage.getItem(`${STORAGE_KEY}-best`) || '{}');
    } catch {
        return {};
    }
}

export function saveBest(best) {
    try {
        localStorage.setItem(`${STORAGE_KEY}-best`, JSON.stringify(best));
    } catch { /* private mode */ }
}
