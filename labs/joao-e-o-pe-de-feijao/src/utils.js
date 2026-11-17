/** Utilitários numéricos e de tempo do jogo (o ruído e a detecção de GPU vêm de gfx/core.js). */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const lerpAngle = (current, target, smoothing, dt) => {
    const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    return current + diff * (1 - Math.exp(-smoothing * dt));
};

export const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

export const randRange = (min, max) => min + Math.random() * (max - min);

export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}
