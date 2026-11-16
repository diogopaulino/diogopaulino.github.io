/**
 * gfx/flora — vegetação procedural instanciada: palmeiras, árvores latifoliadas
 * (amendoeira/chapéu-de-sol, copa redonda, ipê florido) e arbustos.
 *
 * Tronco e galhos: tubos lofteados ao longo de curvas (raio decrescente).
 * Folhagem: cartões com textura alfa desenhada em canvas (folíolos/folhas reais),
 *   normais "esféricas" (apontam para fora da copa) para um sombreamento macio,
 *   alpha-to-coverage com MSAA para bordas limpas sem ordenação.
 * Vento: deslocamento no vertex shader, proporcional ao atributo `aWind`
 *   (0 no tronco → 1 na ponta da folha), com fase por instância:
 *   Δx = sin(t·1.3 + φ + y·0.25)·0.22·w + sin(t·3.1 + 2φ + z)·0.05·w
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seeded, lerp, clamp } from './core.js';
import { pbr } from './textures.js';

export const wind = {
    uWindTime: { value: 0 },
    uWindStrength: { value: 1 }
};

function applyWind(material, softNormals = false) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uWindTime = wind.uWindTime;
        shader.uniforms.uWindStrength = wind.uWindStrength;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', `#include <common>
                attribute float aWind;
                uniform float uWindTime;
                uniform float uWindStrength;`)
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                #ifdef USE_INSTANCING
                    vec3 gfxIP = instanceMatrix[3].xyz;
                #else
                    vec3 gfxIP = modelMatrix[3].xyz;
                #endif
                float gfxPh = gfxIP.x * 0.37 + gfxIP.z * 0.23;
                float gfxW = aWind * uWindStrength;
                transformed.x += (sin(uWindTime * 1.3 + gfxPh + transformed.y * 0.25) * 0.22
                    + sin(uWindTime * 3.1 + gfxPh * 2.0 + transformed.z * 1.7) * 0.05) * gfxW;
                transformed.z += cos(uWindTime * 1.1 + gfxPh * 1.3 + transformed.x * 0.3) * 0.16 * gfxW;
                transformed.y -= abs(sin(uWindTime * 1.3 + gfxPh)) * 0.06 * gfxW;`);
        if (softNormals) {
            shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_begin>', `
                float faceDirection = 1.0;
                vec3 normal = normalize(vNormal);
                vec3 nonPerturbedNormal = normal;`);
        }
    };
    material.customProgramCacheKey = () => `gfxWind:${softNormals}`;
    return material;
}

function canvasTex(c) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
}

/** Folha de palmeira: ráquis central + dezenas de folíolos. u = comprimento, v = largura. */
function frondTexture(hue = 0) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 192;
    const g = c.getContext('2d');
    const rnd = seeded(31 + hue);
    const mid = c.height / 2;
    const n = 54;
    for (let i = 0; i < n; i++) {
        const t = i / (n - 1);
        const x = 14 + t * 486;
        const len = (0.35 + 0.65 * Math.sin(Math.PI * Math.pow(t, 0.75))) * (mid - 6) * (0.85 + rnd() * 0.25);
        for (const s of [1, -1]) {
            const tipX = x + len * 0.55 + rnd() * 6;
            const tipY = mid + s * len;
            const w = 5.5 + rnd() * 2.5;
            const l = 30 + rnd() * 16;
            g.fillStyle = `hsl(${92 + hue + rnd() * 16}, ${46 + rnd() * 18}%, ${l}%)`;
            g.beginPath();
            g.moveTo(x - w * 0.5, mid);
            g.quadraticCurveTo(x + len * 0.2, mid + s * len * 0.55, tipX, tipY);
            g.quadraticCurveTo(x + len * 0.34 + w, mid + s * len * 0.45, x + w, mid);
            g.closePath();
            g.fill();
            g.strokeStyle = `hsla(${96 + hue}, 40%, ${l + 16}%, 0.55)`;
            g.lineWidth = 0.8;
            g.beginPath();
            g.moveTo(x, mid);
            g.quadraticCurveTo(x + len * 0.26, mid + s * len * 0.52, tipX, tipY);
            g.stroke();
        }
    }
    g.strokeStyle = '#8a8a4a';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(0, mid);
    g.lineTo(500, mid);
    g.stroke();
    return canvasTex(c);
}

/** Tufo de folhas largas (ou flores) visto de frente — usado em cartões cruzados. */
function leafClusterTexture({ hue = 105, sat = 45, light = 30, leaf = 34, count = 64, flowers = 0, flowerColor = '#f2c21e', seed = 5 } = {}) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    const rnd = seeded(seed);
    const drawLeaf = (x, y, a, len, wid, l) => {
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.fillStyle = `hsl(${hue + rnd() * 22 - 8}, ${sat + rnd() * 16}%, ${l}%)`;
        g.beginPath();
        g.moveTo(0, 0);
        g.bezierCurveTo(len * 0.3, -wid, len * 0.8, -wid * 0.7, len, 0);
        g.bezierCurveTo(len * 0.8, wid * 0.7, len * 0.3, wid, 0, 0);
        g.fill();
        g.strokeStyle = `hsla(${hue + 6}, 35%, ${l + 16}%, 0.6)`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(len, 0);
        g.stroke();
        g.restore();
    };
    // camadas: escuras atrás, claras na frente
    for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < count / 3; i++) {
            const a = rnd() * Math.PI * 2;
            const r = Math.pow(rnd(), 0.6) * 96;
            const x = 128 + Math.cos(a) * r;
            const y = 128 + Math.sin(a) * r;
            drawLeaf(x, y, a + (rnd() - 0.5) * 1.6, leaf * (0.75 + rnd() * 0.5), leaf * 0.3, light - 9 + pass * 9 + rnd() * 6);
        }
    }
    for (let i = 0; i < flowers; i++) {
        const a = rnd() * Math.PI * 2;
        const r = Math.pow(rnd(), 0.5) * 100;
        g.fillStyle = flowerColor;
        g.globalAlpha = 0.9;
        g.beginPath();
        g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 5 + rnd() * 6, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
    }
    return canvasTex(c);
}

function leafMaterial(map, { color = 0xffffff } = {}) {
    const m = new THREE.MeshStandardMaterial({
        map,
        color,
        alphaTest: 0.42,
        alphaToCoverage: true,
        side: THREE.DoubleSide,
        roughness: 0.62,
        metalness: 0,
        envMapIntensity: 0.9
    });
    return applyWind(m, true);
}

/** Tubo ao longo de pontos com raios; UV: u = volta, v = comprimento/escala. */
function tube(points, radii, segs = 8, vScale = 1.2, windFrom = 0, windTo = 0) {
    const pos = [];
    const nor = [];
    const uv = [];
    const wnd = [];
    const idx = [];
    const t = new THREE.Vector3();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const ref = new THREE.Vector3(1, 0, 0);
    let len = 0;
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (i > 0) len += p.distanceTo(points[i - 1]);
        t.subVectors(points[Math.min(i + 1, points.length - 1)], points[Math.max(i - 1, 0)]).normalize();
        a.crossVectors(t, Math.abs(t.x) > 0.9 ? new THREE.Vector3(0, 0, 1) : ref).normalize();
        b.crossVectors(t, a).normalize();
        const w = lerp(windFrom, windTo, i / (points.length - 1));
        for (let s = 0; s <= segs; s++) {
            const ang = (s / segs) * Math.PI * 2;
            const cx = Math.cos(ang);
            const sx = Math.sin(ang);
            const nx = a.x * cx + b.x * sx;
            const ny = a.y * cx + b.y * sx;
            const nz = a.z * cx + b.z * sx;
            pos.push(p.x + nx * radii[i], p.y + ny * radii[i], p.z + nz * radii[i]);
            nor.push(nx, ny, nz);
            uv.push((s / segs) * 2, len / vScale);
            wnd.push(w);
        }
    }
    const row = segs + 1;
    for (let i = 0; i < points.length - 1; i++) {
        for (let s = 0; s < segs; s++) {
            const p0 = i * row + s;
            const p1 = p0 + row;
            idx.push(p0, p0 + 1, p1, p0 + 1, p1 + 1, p1);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(wnd, 1));
    g.setIndex(idx);
    return g;
}

/** Folha de palmeira arqueada com seção em V. */
function frondGeometry(length, width, lift, droop, yaw, origin, windBase = 0.25) {
    const segs = 7;
    const pos = [];
    const uv = [];
    const wnd = [];
    const nor = [];
    const idx = [];
    const dirH = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const p = new THREE.Vector3().copy(origin);
    let ang = lift;
    const step = length / segs;
    for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        if (i > 0) {
            ang -= droop * (0.4 + t * 1.6) / segs;
            p.addScaledVector(dirH, Math.cos(ang) * step).y += Math.sin(ang) * step;
        }
        const w = width * (0.25 + 0.75 * Math.sin(Math.PI * Math.pow(t, 0.7))) * 0.5;
        const fold = 0.32;
        // 3 vértices por seção: borda esq, ráquis, borda dir (V invertido suave)
        const up = new THREE.Vector3(-dirH.x * Math.sin(ang), Math.cos(ang), -dirH.z * Math.sin(ang));
        for (const s of [-1, 0, 1]) {
            pos.push(
                p.x + side.x * w * s - up.x * Math.abs(s) * w * fold,
                p.y - up.y * Math.abs(s) * w * fold,
                p.z + side.z * w * s - up.z * Math.abs(s) * w * fold
            );
            uv.push(t, s * 0.5 + 0.5);
            wnd.push(windBase + t * t * (1 - windBase));
            nor.push(up.x * 0.6 + side.x * s * 0.3, up.y * 0.6 + 0.4, up.z * 0.6 + side.z * s * 0.3);
        }
    }
    for (let i = 0; i < segs; i++) {
        const a = i * 3;
        idx.push(a, a + 1, a + 3, a + 1, a + 4, a + 3, a + 1, a + 2, a + 4, a + 2, a + 5, a + 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(wnd, 1));
    g.setIndex(idx);
    return g;
}

const texCache = new Map();
const cached = (key, make) => {
    if (!texCache.has(key)) texCache.set(key, make());
    return texCache.get(key);
};

/**
 * Palmeira. kind: 'imperial' (alta, estipe liso, palmito verde) | 'coco' (curva, copa aberta) | 'jeriva'.
 * Retorna kit { parts:[{geometry, material}], height }.
 */
export function createPalmKit({ kind = 'imperial', seed = 1, fronds } = {}) {
    const rnd = seeded(seed * 97 + 3);
    const H = kind === 'imperial' ? 11 + rnd() * 2.5 : kind === 'coco' ? 7 + rnd() * 2 : 6 + rnd() * 1.5;
    const lean = kind === 'coco' ? 0.9 + rnd() * 0.8 : 0.15;
    const leanA = rnd() * Math.PI * 2;
    const pts = [];
    const radii = [];
    const n = 11;
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const off = lean * t * t;
        pts.push(new THREE.Vector3(Math.cos(leanA) * off, t * H, Math.sin(leanA) * off));
        const base = kind === 'imperial' ? 0.3 : 0.19;
        const belly = kind === 'imperial' ? Math.sin(t * Math.PI) * 0.05 : 0;
        radii.push(base * (1 - t * 0.38) + belly + Math.exp(-t * 14) * 0.14);
    }
    const trunk = tube(pts, radii, 9, 1.4, 0, 0.1);
    const top = pts[pts.length - 1].clone();
    const woodParts = [trunk];
    const crownParts = [];
    if (kind === 'imperial') {
        // palmito (bainha verde lisa)
        const cs = tube(
            [top.clone(), top.clone().add(new THREE.Vector3(0, 0.9, 0)), top.clone().add(new THREE.Vector3(0, 1.7, 0))],
            [0.2, 0.22, 0.1], 9, 1, 0.1, 0.15
        );
        cs.userData.green = true;
        crownParts.push(cs);
        top.y += 1.55;
    }
    const count = fronds || (kind === 'imperial' ? 15 : 17);
    const L = kind === 'imperial' ? 4.3 : kind === 'coco' ? 4.4 : 3.3;
    for (let i = 0; i < count; i++) {
        const t = i / count;
        const yaw = t * Math.PI * 2 * 2.618 + rnd() * 0.4;
        const tier = (i % 3) / 2; // 0 = jovens (eretas) … 1 = velhas (pendentes)
        const lift = lerp(1.15, -0.05, tier) + (rnd() - 0.5) * 0.25;
        const droop = lerp(1.1, 1.9, tier) + rnd() * 0.3;
        crownParts.push(frondGeometry(L * (0.82 + rnd() * 0.3), 1.25, lift, droop, yaw, top));
    }
    if (kind === 'coco') {
        for (let i = 0; i < 5; i++) {
            const a = rnd() * Math.PI * 2;
            const g = new THREE.SphereGeometry(0.15, 7, 6);
            g.translate(top.x + Math.cos(a) * 0.24, top.y - 0.22 - rnd() * 0.1, top.z + Math.sin(a) * 0.24);
            g.setAttribute('aWind', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(0.12), 1));
            g.userData.green = true;
            crownParts.push(g);
        }
    }
    const frondTex = cached('frond', () => frondTexture(0));
    const leafGeos = crownParts.filter((g) => !g.userData.green);
    const greenGeos = crownParts.filter((g) => g.userData.green);
    const parts = [
        { geometry: mergeGeometries(woodParts), material: cached('palmBark', () => applyWind(pbr('barkPalm', { color: 0xd8d0c4 }))), shadow: true },
        { geometry: mergeGeometries(leafGeos), material: cached('frondMat', () => leafMaterial(frondTex)), shadow: true }
    ];
    if (greenGeos.length) {
        parts.push({
            geometry: mergeGeometries(greenGeos),
            material: cached('palmGreen', () => applyWind(new THREE.MeshStandardMaterial({ color: kind === 'coco' ? 0x6a7a34 : 0x6f9a48, roughness: 0.55 }))),
            shadow: false
        });
    }
    return { parts, height: H + L * 0.4 };
}

/**
 * Árvore latifoliada. kind:
 *   'amendoeira' — chapéu-de-sol: galhos em andares horizontais, copa larga (típica da orla de Santos)
 *   'round'      — oiti/ficus: copa densa arredondada
 *   'ipe'        — copa rala com floração amarela/rosa
 */
export function createTreeKit({ kind = 'amendoeira', seed = 1, flowerColor = '#f2c21e' } = {}) {
    const rnd = seeded(seed * 131 + 7);
    const wood = [];
    const cards = [];
    const trunkH = kind === 'amendoeira' ? 3.2 + rnd() * 0.8 : 2.6 + rnd() * 0.8;
    const totalH = kind === 'amendoeira' ? 7.5 + rnd() * 2 : kind === 'ipe' ? 7 + rnd() * 2 : 6.5 + rnd() * 2;
    const crownR = kind === 'amendoeira' ? 5.2 + rnd() : 3.4 + rnd() * 0.8;
    const center = new THREE.Vector3(0, trunkH + (totalH - trunkH) * 0.55, 0);

    const tp = [];
    const tr = [];
    for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        tp.push(new THREE.Vector3(Math.sin(t * 2 + seed) * 0.18, t * totalH * 0.82, Math.cos(t * 1.7 + seed) * 0.18));
        tr.push(0.3 * (1 - t * 0.72) + Math.exp(-t * 12) * 0.16);
    }
    wood.push(tube(tp, tr, 8, 1.4, 0, 0.12));

    const addCards = (p, size, flat) => {
        const k = 3;
        for (let i = 0; i < k; i++) {
            const g = new THREE.PlaneGeometry(size, size);
            const rx = flat ? -Math.PI / 2 + (rnd() - 0.5) * 0.7 : (rnd() - 0.5) * 1.2;
            g.rotateX(rx);
            g.rotateY((i / k) * Math.PI + rnd() * 0.6);
            g.translate(p.x + (rnd() - 0.5) * size * 0.3, p.y + (rnd() - 0.5) * size * 0.25, p.z + (rnd() - 0.5) * size * 0.3);
            const pos = g.attributes.position;
            const nor = g.attributes.normal;
            const w = new Float32Array(pos.count);
            const v = new THREE.Vector3();
            for (let j = 0; j < pos.count; j++) {
                v.fromBufferAttribute(pos, j).sub(center).normalize();
                v.y = v.y * 0.6 + 0.55;
                v.normalize();
                nor.setXYZ(j, v.x, v.y, v.z);
                w[j] = clamp(0.35 + (pos.getY(j) / totalH) * 0.5, 0, 1);
            }
            g.setAttribute('aWind', new THREE.BufferAttribute(w, 1));
            cards.push(g);
        }
    };

    const tiers = kind === 'amendoeira' ? 3 : 2;
    const perTier = kind === 'amendoeira' ? 6 : 5;
    for (let t = 0; t < tiers; t++) {
        const y0 = lerp(trunkH, totalH * 0.8, t / Math.max(1, tiers - 1));
        const reach = crownR * (kind === 'amendoeira' ? lerp(1, 0.6, t / (tiers - 1)) : lerp(0.95, 0.7, t));
        for (let b = 0; b < perTier; b++) {
            const a = (b / perTier) * Math.PI * 2 + t * 0.5 + rnd() * 0.5;
            const rise = kind === 'amendoeira' ? 0.12 + rnd() * 0.15 : 0.55 + rnd() * 0.4;
            const pts = [];
            const rad = [];
            const steps = 5;
            const start = new THREE.Vector3(tp[3].x, y0, tp[3].z);
            for (let i = 0; i <= steps; i++) {
                const s = i / steps;
                const r = reach * s * (0.85 + rnd() * 0.1);
                pts.push(new THREE.Vector3(
                    start.x + Math.cos(a) * r + (rnd() - 0.5) * 0.15,
                    y0 + r * rise + Math.sin(s * Math.PI) * 0.25 - s * s * (kind === 'amendoeira' ? 0.5 : 0),
                    start.z + Math.sin(a) * r + (rnd() - 0.5) * 0.15
                ));
                rad.push(0.13 * (1 - s * 0.82) * (1 - t * 0.25));
            }
            wood.push(tube(pts, rad, 5, 1, 0.1, 0.5));
            const flat = kind === 'amendoeira';
            const size = kind === 'ipe' ? 1.7 : kind === 'amendoeira' ? 2.5 : 2.3;
            for (let i = 2; i <= steps; i++) {
                if (kind === 'ipe' && rnd() < 0.25) continue;
                addCards(pts[i], size * (0.8 + rnd() * 0.45), flat);
            }
        }
    }
    // miolo da copa (fecha buracos vistos de baixo)
    const fill = kind === 'round' ? 9 : kind === 'ipe' ? 3 : 5;
    for (let i = 0; i < fill; i++) {
        const a = rnd() * Math.PI * 2;
        const r = rnd() * crownR * 0.45;
        addCards(new THREE.Vector3(Math.cos(a) * r, center.y + (rnd() - 0.3) * (totalH - trunkH) * 0.5, Math.sin(a) * r), 2.6, false);
    }

    const tex = cached(`leaf:${kind}:${flowerColor}`, () => leafClusterTexture(
        kind === 'ipe' ? { hue: 96, light: 30, leaf: 26, count: 40, flowers: 46, flowerColor, seed: 9 }
            : kind === 'amendoeira' ? { hue: 108, sat: 48, light: 29, leaf: 44, count: 46, seed: 4 }
                : { hue: 112, sat: 44, light: 25, leaf: 24, count: 110, seed: 6 }
    ));
    return {
        parts: [
            { geometry: mergeGeometries(wood), material: cached('treeBark', () => applyWind(pbr('barkTree'))), shadow: true },
            { geometry: mergeGeometries(cards), material: cached(`leafMat:${kind}:${flowerColor}`, () => leafMaterial(tex)), shadow: true }
        ],
        height: totalH,
        radius: crownR
    };
}

/** Arbusto / canteiro: tufos de cartões baixos. */
export function createShrubKit({ flowers = 0, flowerColor = '#e23a6a', hue = 110, seed = 3, size = 1 } = {}) {
    const rnd = seeded(seed * 53);
    const cards = [];
    const center = new THREE.Vector3(0, 0.2 * size, 0);
    for (let i = 0; i < 6; i++) {
        const s = (0.9 + rnd() * 0.5) * size;
        const g = new THREE.PlaneGeometry(s * 1.25, s);
        g.translate(0, s * 0.45, 0);
        g.rotateX((rnd() - 0.5) * 0.5);
        g.rotateY((i / 6) * Math.PI * 2 + rnd());
        g.translate((rnd() - 0.5) * 0.4 * size, 0, (rnd() - 0.5) * 0.4 * size);
        const pos = g.attributes.position;
        const nor = g.attributes.normal;
        const w = new Float32Array(pos.count);
        const v = new THREE.Vector3();
        for (let j = 0; j < pos.count; j++) {
            v.fromBufferAttribute(pos, j).sub(center).normalize();
            v.y = Math.abs(v.y) * 0.5 + 0.6;
            v.normalize();
            nor.setXYZ(j, v.x, v.y, v.z);
            w[j] = clamp(pos.getY(j) * 0.25, 0, 0.4);
        }
        g.setAttribute('aWind', new THREE.BufferAttribute(w, 1));
        cards.push(g);
    }
    const tex = cached(`shrub:${hue}:${flowers}:${flowerColor}`, () => leafClusterTexture({
        hue, sat: 46, light: 27, leaf: 22, count: 120, flowers, flowerColor, seed: 12 + flowers
    }));
    return {
        parts: [{ geometry: mergeGeometries(cards), material: cached(`shrubMat:${hue}:${flowers}:${flowerColor}`, () => leafMaterial(tex)), shadow: false }],
        height: size
    };
}

const _m = new THREE.Matrix4();
const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _e = new THREE.Euler();

/**
 * Instancia um kit. placements: [{ x, y, z, scale = 1, rot = 0, tiltX = 0, tiltZ = 0 }]
 */
export function instanceKit(kit, placements, { castShadow = true, receiveShadow = false } = {}) {
    const group = new THREE.Group();
    for (const part of kit.parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
        placements.forEach((pl, i) => {
            _p.set(pl.x, pl.y || 0, pl.z);
            _e.set(pl.tiltX || 0, pl.rot || 0, pl.tiltZ || 0);
            _q.setFromEuler(_e);
            const sc = pl.scale ?? 1;
            _s.set(sc, sc * (pl.scaleY ?? 1), sc);
            _m.compose(_p, _q, _s);
            mesh.setMatrixAt(i, _m);
        });
        mesh.instanceMatrix.needsUpdate = true;
        mesh.castShadow = castShadow && part.shadow !== false;
        mesh.receiveShadow = receiveShadow;
        mesh.computeBoundingSphere();
        group.add(mesh);
    }
    return group;
}

export function updateWind(t, strength = 1) {
    wind.uWindTime.value = t;
    wind.uWindStrength.value = strength;
}
