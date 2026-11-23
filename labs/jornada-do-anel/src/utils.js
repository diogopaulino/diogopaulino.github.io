/** Utilitários do lab (ruído, tiers e matemática vêm de `labs/shared/gfx/core.js`). */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Promessa com prazo: resolve com `fallback` se `p` não terminar em `ms`
 * (ou falhar). Usado no carregamento dos capítulos — a tela de viagem nunca
 * fica presa esperando uma textura/modelo que não chega.
 */
export function withTimeout(p, ms, fallback = null) {
    let id;
    const timer = new Promise((r) => { id = setTimeout(() => r(fallback), ms); });
    return Promise.race([Promise.resolve(p).catch(() => fallback), timer]).finally(() => clearTimeout(id));
}
