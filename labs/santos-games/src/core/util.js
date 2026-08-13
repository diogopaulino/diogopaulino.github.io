// core/util.js — helpers puros: matemática, easing, RNG determinístico, AABB, formatação.
// Teto: ~90 linhas.

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (v, target, maxDelta) => {
    if (v < target) return Math.min(v + maxDelta, target);
    if (v > target) return Math.max(v - maxDelta, target);
    return v;
};
export const wrap = (v, min, max) => {
    const range = max - min;
    return range <= 0 ? min : min + (((v - min) % range) + range) % range;
};

export const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);
export const easeInQuad = (t) => t * t;
export const easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeOutElastic = (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

export function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function circleHit(ax, ay, ar, bx, by, br) {
    const dx = ax - bx, dy = ay - by, r = ar + br;
    return dx * dx + dy * dy <= r * r;
}

export function dist(ax, ay, bx, by) {
    return Math.hypot(ax - bx, ay - by);
}

export function angleTo(ax, ay, bx, by) {
    return Math.atan2(by - ay, bx - ax);
}

/** xorshift32 — RNG rápido e determinístico por seed, para runs reproduzíveis. */
export function makeRng(seed) {
    let s = (seed >>> 0) || 0x9e3779b9;
    return {
        next() {
            s ^= s << 13; s >>>= 0;
            s ^= s >>> 17;
            s ^= s << 5; s >>>= 0;
            return s / 0xffffffff;
        },
        range(min, max) { return min + this.next() * (max - min); },
        int(min, max) { return Math.floor(this.range(min, max + 1)); },
        pick(arr) { return arr[this.int(0, arr.length - 1)]; },
        chance(p) { return this.next() < p; }
    };
}

export function formatTime(seconds) {
    const s = Math.max(0, seconds);
    const m = Math.floor(s / 60);
    const rest = (s % 60).toFixed(1).padStart(4, '0');
    return `${m}:${rest}`;
}

export function formatScore(n) {
    return Math.floor(n).toString().padStart(6, '0');
}

export function once(fn) {
    let called = false, result;
    return (...args) => { if (!called) { called = true; result = fn(...args); } return result; };
}

/** addEventListener seguro: no-op se el for nulo. */
export function on(el, ev, fn, opts) {
    if (!el) return () => {};
    el.addEventListener(ev, fn, opts);
    return () => el.removeEventListener(ev, fn, opts);
}
