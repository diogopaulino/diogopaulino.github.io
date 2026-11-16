/** Números, detecção de GPU, ruído PBR e helpers de ângulo. */

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export function hash2(x, y, seed = 0) {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
    return n - Math.floor(n);
}

export function valueNoise(x, y, seed = 0) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = hash2(x0, y0, seed);
    const b = hash2(x0 + 1, y0, seed);
    const c = hash2(x0, y0 + 1, seed);
    const d = hash2(x0 + 1, y0 + 1, seed);
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
}

export function fbm(x, y, seed = 0, octaves = 5) {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let i = 0; i < octaves; i++) {
        sum += valueNoise(x * freq, y * freq, seed + i * 19) * amp;
        norm += amp;
        amp *= 0.5;
        freq *= 2;
    }
    return sum / norm;
}

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
 * Altura do terreno da Ilha da Cúpola (m).
 * Colinas senoidais + montanha ao norte + platô do castelo ao sul + praia.
 *
 *   base     = 0.22 + Σ senos (três frequências)
 *   montanha = t²·(1.15 − 0.12·t)·17.4,  t = 1 − d/20   (d = distância ao cume em (3, −26))
 *   cume     = mistura suave até 16.85 m entre d = 7 e d = 3 (platô sem degrau vertical;
 *              inclinação máxima ≈ 3,4:1, abaixo do limite de parede de 5,5:1 do Player)
 *   castelo  = platô 1.28 + 0.55·t em volta de (0, 25), também com borda suavizada
 *   praia    = h → −0.2 entre r = 38 e 52; o leito desce até −3.2 em r = 58
 *
 * A mesma fórmula existe em GLSL (HEIGHT_GLSL) para o mar saber a profundidade.
 */
export function heightAt(x, z) {
    const r = Math.hypot(x, z);
    if (r > 58) return -3.2;

    const island = smoothstep(52, 36, r);
    let h = 0.22;
    h += Math.sin(x * 0.11) * Math.cos(z * 0.09) * 1.2;
    h += Math.sin(x * 0.047 + z * 0.061) * 0.72;
    h += Math.cos((x - z) * 0.075) * 0.38;

    const md = Math.hypot(x - 3, z + 26);
    if (md < 20) {
        const t = 1 - md / 20;
        h += t * t * (1.15 - t * 0.12) * 17.4;
        h = lerp(h, Math.max(h, 16.85), smoothstep(7.0, 3.0, md));
    }

    const cd = Math.hypot(x, z - 25);
    if (cd < 13.5) {
        const t = 1 - cd / 13.5;
        h = lerp(h, Math.max(h, 1.28 + t * 0.55), smoothstep(13.5, 11.4, cd));
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
    if (r > 50) h = lerp(h, -3.2, smoothstep(50, 58, r));
    return h;
}

/** heightAt em GLSL — usado pelo oceano (profundidade = nível da água − altura). */
export const HEIGHT_GLSL = /* glsl */ `
float cupolaHeight(vec2 p) {
    float x = p.x;
    float z = p.y;
    float r = length(p);
    if (r > 58.0) return -3.2;
    float island = 1.0 - smoothstep(36.0, 52.0, r);
    float h = 0.22;
    h += sin(x * 0.11) * cos(z * 0.09) * 1.2;
    h += sin(x * 0.047 + z * 0.061) * 0.72;
    h += cos((x - z) * 0.075) * 0.38;
    float md = length(p - vec2(3.0, -26.0));
    if (md < 20.0) {
        float t = 1.0 - md / 20.0;
        h += t * t * (1.15 - t * 0.12) * 17.4;
        h = mix(h, max(h, 16.85), 1.0 - smoothstep(3.0, 7.0, md));
    }
    float cd = length(p - vec2(0.0, 25.0));
    if (cd < 13.5) {
        float t = 1.0 - cd / 13.5;
        h = mix(h, max(h, 1.28 + t * 0.55), 1.0 - smoothstep(11.4, 13.5, cd));
    }
    float k1 = length(p - vec2(-18.0, 4.0));
    if (k1 < 8.0) { float q = 1.0 - k1 / 8.0; h += q * q * 2.4; }
    float k2 = length(p - vec2(16.0, -8.0));
    if (k2 < 7.0) { float q = 1.0 - k2 / 7.0; h += q * q * 1.8; }
    h *= island;
    if (r > 38.0) {
        float beach = 1.0 - smoothstep(38.0, 52.0, r);
        h = mix(-0.2, max(h, 0.04), beach);
    }
    if (r > 50.0) h = mix(h, -3.2, smoothstep(50.0, 58.0, r));
    return h;
}`;

/**
 * Gruta do farol: uma garganta a céu aberto escavada na encosta da montanha.
 * Dentro do retângulo GORGE o piso é min(terreno, linha da gruta); a linha desce
 * de 6.25 m na boca (z = −11.2) até 4.15 m no fundo (z = −22.5). A transição de
 * 0.35 m nas bordas vira parede de rocha (o jogador não escala: ver Player._move).
 */
export const GORGE = { x0: 0.4, x1: 4.8, z0: -22.4 };

export function gorgeFloor(z) {
    const t = clamp((z + 22.5) / 11.3, 0, 1);
    return 4.15 + t * 2.1;
}

/** Superfície caminhável/visível: terreno com a garganta escavada. */
export function surfaceAt(x, z) {
    const h = heightAt(x, z);
    const d = Math.min(x - GORGE.x0, GORGE.x1 - x, z - GORGE.z0);
    if (d <= 0) return h;
    const floor = gorgeFloor(z);
    if (h <= floor) return h;
    return lerp(h, floor, smoothstep(0, 0.35, d));
}

function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}
