/** Utilitários do lab (ruído, tiers e matemática vêm de `labs/shared/gfx/core.js`). */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
