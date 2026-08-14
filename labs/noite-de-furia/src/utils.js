/** Utilitários numéricos do beat 'em up. */

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);
export const TAU = Math.PI * 2;

export function rand(a = 0, b = 1) {
    return a + Math.random() * (b - a);
}

export function irand(a, b) {
    return (Math.random() * (b - a + 1) + a) | 0;
}

export function pick(list) {
    return list[(Math.random() * list.length) | 0];
}

export function dist2(ax, az, bx, bz) {
    const dx = ax - bx;
    const dz = az - bz;
    return dx * dx + dz * dz;
}

export function approach(current, target, maxDelta) {
    if (current < target) return Math.min(current + maxDelta, target);
    return Math.max(current - maxDelta, target);
}

export function now() {
    return performance.now();
}
