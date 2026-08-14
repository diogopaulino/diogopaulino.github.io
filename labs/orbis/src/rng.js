/**
 * Gerador determinístico (Mulberry32) e utilitários de sorteio.
 * O mesmo seed sempre reconstrói o mesmo sistema estelar.
 */
export function mulberry32(seed) {
    let t = seed >>> 0;
    return function rng() {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

export function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

export function randRange(rng, a, b) {
    return a + rng() * (b - a);
}

export function randInt(rng, a, b) {
    return a + Math.floor(rng() * (b - a + 1));
}

export function pick(rng, list) {
    return list[Math.floor(rng() * list.length) % list.length];
}

export function pickWeighted(rng, items) {
    const total = items.reduce((s, it) => s + it.w, 0);
    let r = rng() * total;
    for (const it of items) {
        r -= it.w;
        if (r <= 0) return it;
    }
    return items[items.length - 1];
}

export function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function lerpArr(a, b, t) {
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

export function damp(current, target, lambda, dt) {
    return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
