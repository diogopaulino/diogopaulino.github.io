/** Utilitários numéricos e de geometria compartilhados pelo jogo. */

import * as THREE from 'three';

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (edge0, edge1, x) => {
    const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
};

/**
 * Interpolação exponencial independente do frame rate.
 * `damp(atual, alvo, 6, dt)` converge de forma estável em 30 ou 144 fps.
 */
export const damp = (current, target, lambda, dt) =>
    lerp(current, target, 1 - Math.exp(-lambda * dt));

export const snap = (value, step) => Math.round(value / step) * step;

export const randRange = (min, max) => min + Math.random() * (max - min);
export const randInt = (min, max) => Math.floor(randRange(min, max + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * Malha radial no plano XZ: densa no centro (onde está o barco) e cada vez
 * mais esparsa em direção ao horizonte.
 *
 * É o truque que permite terreno e água "infinitos" sem costuras: a malha só
 * é transladada para acompanhar a câmera, e a altura de cada vértice vem de
 * uma função analítica avaliada em coordenadas de mundo dentro do shader.
 * Assim os vértices atravessam o campo de ondas sem "nadar" com a câmera.
 */
export function buildRadialGrid(spokes, rings, maxRadius, firstRing = 1.2) {
    // Progressão geométrica dos raios: resolve o fator `k` por bisseção.
    const total = (k) => (k === 1 ? firstRing * rings : (firstRing * (k ** rings - 1)) / (k - 1));
    let lo = 1.0001;
    let hi = 1.4;
    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (total(mid) < maxRadius) lo = mid;
        else hi = mid;
    }
    const k = (lo + hi) / 2;

    const radii = new Float32Array(rings + 1);
    let acc = 0;
    let step = firstRing;
    for (let i = 1; i <= rings; i++) {
        acc += step;
        step *= k;
        radii[i] = acc;
    }

    const vertCount = 1 + rings * spokes;
    const positions = new Float32Array(vertCount * 3);
    const uvs = new Float32Array(vertCount * 2);
    const indices = [];

    // Vértice central.
    uvs[0] = 0.5;
    uvs[1] = 0.5;

    for (let r = 1; r <= rings; r++) {
        const radius = radii[r];
        for (let s = 0; s < spokes; s++) {
            const idx = 1 + (r - 1) * spokes + s;
            const a = (s / spokes) * Math.PI * 2;
            positions[idx * 3] = Math.cos(a) * radius;
            positions[idx * 3 + 2] = Math.sin(a) * radius;
            uvs[idx * 2] = r / rings;
            uvs[idx * 2 + 1] = s / spokes;
        }
    }

    // Leque central. A ordem dos índices deixa a normal apontando para +Y
    // (faces frontais vistas de cima) — invertê-la some com o terreno.
    for (let s = 0; s < spokes; s++) {
        indices.push(0, 1 + ((s + 1) % spokes), 1 + s);
    }

    // Anéis subsequentes.
    for (let r = 1; r < rings; r++) {
        const inner = 1 + (r - 1) * spokes;
        const outer = 1 + r * spokes;
        for (let s = 0; s < spokes; s++) {
            const sn = (s + 1) % spokes;
            indices.push(inner + s, inner + sn, outer + s);
            indices.push(inner + sn, outer + sn, outer + s);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3));
    geo.setIndex(vertCount > 65535
        ? new THREE.BufferAttribute(new Uint32Array(indices), 1)
        : new THREE.BufferAttribute(new Uint16Array(indices), 1));
    geo.computeBoundingSphere();
    geo.boundingSphere.radius = maxRadius * 1.4;
    return geo;
}

/** Remove um objeto da cena liberando geometrias e materiais. */
export function disposeObject(obj) {
    obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        const mat = child.material;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
    });
    obj.parent?.remove(obj);
}

/** Detecta dispositivos com pouca folga de GPU/tela pequena. */
export function detectMobile() {
    if (typeof navigator === 'undefined') return false;
    const coarse = window.matchMedia?.('(pointer: coarse)')?.matches;
    const narrow = Math.min(window.innerWidth, window.innerHeight) < 760;
    return Boolean(coarse && narrow) || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Formata segundos como m:ss. */
export function formatTime(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Pool genérico de objetos reaproveitáveis. */
export class Pool {
    constructor(factory, reset) {
        this.factory = factory;
        this.reset = reset;
        this.free = [];
        this.active = [];
    }

    spawn(...args) {
        const item = this.free.pop() || this.factory();
        this.reset?.(item, ...args);
        this.active.push(item);
        return item;
    }

    release(item) {
        const idx = this.active.indexOf(item);
        if (idx >= 0) this.active.splice(idx, 1);
        this.free.push(item);
    }

    releaseAll() {
        while (this.active.length) this.free.push(this.active.pop());
    }
}
