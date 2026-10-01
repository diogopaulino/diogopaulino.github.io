import * as THREE from 'three';

export function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function damp(current, target, lambda, dt) {
    return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

export function smoothstep(edge0, edge1, x) {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
}

export function detectMobile() {
    return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
        || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 900);
}

export function detectTouch() {
    return matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

export function detectSoftwareGL() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) return true;
        const info = gl.getExtension('WEBGL_debug_renderer_info');
        if (!info) return false;
        const renderer = gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || '';
        return /SwiftShader|llvmpipe|SoftGL|Microsoft Basic Render/i.test(renderer);
    } catch {
        return true;
    }
}

export function seeded(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

export function disposeObject(root) {
    root.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
                if (!m) continue;
                for (const key of Object.keys(m)) {
                    const v = m[key];
                    if (v && v.isTexture) v.dispose();
                }
                m.dispose();
            }
        }
    });
}

export function makeNoiseTexture(size = 128, scale = 1) {
    const data = new Uint8Array(size * size * 4);
    const rand = seeded(0x5a7);
    for (let i = 0; i < size * size; i++) {
        const n = Math.floor(rand() * 255 * scale);
        const o = i * 4;
        data[o] = n;
        data[o + 1] = Math.floor(rand() * 255 * scale);
        data[o + 2] = Math.floor(rand() * 255 * scale);
        data[o + 3] = 255;
    }
    const tex = new THREE.DataTexture(data, size, size);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
}

export function formatClock(date = new Date()) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function beachAt(x, beaches) {
    for (const b of beaches) {
        if (x >= b.x0 && x < b.x1) return b;
    }
    return beaches[beaches.length - 1];
}
