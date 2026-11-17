/**
 * Nuvens modeladas: mar de nuvens, ilhas caminháveis e cúmulos.
 *
 * Nada de cartões transparentes: as nuvens são malhas opacas (escrevem
 * profundidade → a névoa de altura e o AO do pós funcionam nelas) com um
 * material padrão estendido:
 *   emissivo += brilho·(0,25 + 0,75·(1 − n·v)^2,5)     borda acesa (luz atravessando)
 *            +  luzDeBaixo·(½ − ½·n_y)^2               barriga dourada/rosada
 *
 * Relevo:
 *   mar(x, z)   = (1 − |2·fbm(p·0,011) − 1|)^1,5 · 9 + fbm(p·0,05)·2,5      (corcovas com vincos)
 *   ilha(x, z)  = max_i (1 − |p − c_i| / r_i)                               (união de discos)
 *   topo(x, z)  = lerp(−1,2, 1,5·(fbm(p·0,075) − 0,35), smoothstep(0,02, 0,22, ilha))
 * `heightAt` do capítulo usa o mesmo `topo`, então o pé do João pisa onde a malha está.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { fbm2, seeded, smoothstep, lerp } from '../../shared/gfx/core.js';

/** Material de nuvem. `glow` = cor da borda acesa; `under` = luz que vem de baixo. */
export function cloudMaterial({ glow = 0xfff0d8, under = 0xffb070, color = 0xffffff } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, envMapIntensity: 0.9 });
    const uniforms = {
        uCloudGlow: { value: new THREE.Color(glow).multiplyScalar(0.2) },
        uCloudUnder: { value: new THREE.Color(under).multiplyScalar(0.3) }
    };
    m.userData.uniforms = uniforms;
    m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform vec3 uCloudGlow;\nuniform vec3 uCloudUnder;')
            .replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
            {
                float cRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.5);
                vec3 cWn = inverseTransformDirection(normal, viewMatrix);
                float cDown = 0.5 - 0.5 * cWn.y;
                totalEmissiveRadiance += uCloudGlow * (0.25 + 0.75 * cRim) + uCloudUnder * cDown * cDown;
            }`);
    };
    m.customProgramCacheKey = () => 'joaoCloud';
    /** Troca as cores de borda/barriga (por capítulo). */
    m.userData.setLight = (g, u, kg = 0.2, ku = 0.3) => {
        uniforms.uCloudGlow.value.set(g).multiplyScalar(kg);
        uniforms.uCloudUnder.value.set(u).multiplyScalar(ku);
    };
    return m;
}

const seaH = (x, z) => Math.pow(1 - Math.abs(2 * fbm2(x * 0.011 + 31, z * 0.011 + 17, 4) - 1), 1.5) * 9
    + fbm2(x * 0.05 + 3, z * 0.05 + 9, 3) * 2.5;

/** Máscara da ilha: união de discos { x, z, r }. > 0 dentro. */
export function islandMask(circles, x, z) {
    let m = -1;
    for (const c of circles) m = Math.max(m, 1 - Math.hypot(x - c.x, z - c.z) / c.r);
    return m;
}

/** Altura do topo da ilha de nuvem (ver fórmula no cabeçalho). Fora da ilha desce até sumir no mar. */
export function cloudTop(circles, x, z) {
    const m = islandMask(circles, x, z);
    if (m <= 0) return -1.2 - 5 * smoothstep(0, -0.3, m);
    return lerp(-1.2, 1.5 * (fbm2(x * 0.075 + 5, z * 0.075 + 2, 3) - 0.35), smoothstep(0.02, 0.22, m));
}

/** Bolha de cúmulo: esfera deformada por ruído (normais lisas), achatada em y. */
function blob(rnd, x, y, z, r, squash = 0.62) {
    const g = new THREE.SphereGeometry(1, 24, 16);
    const pos = g.attributes.position;
    const ox = rnd() * 40;
    for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        const pz = pos.getZ(i);
        const n = fbm2(px * 1.6 + pz * 0.9 + ox, py * 1.6 - pz * 0.7 + ox, 3);
        const n2 = fbm2(px * 4.2 - py * 1.1 + ox, pz * 4.2 + py * 2 + ox, 2);
        const k = 0.72 + n * 0.5 + n2 * 0.14;
        // base mais chata que o topo, como cúmulo de verdade
        pos.setXYZ(i, px * k, py * k * (py < 0 ? squash * 0.55 : squash), pz * k);
    }
    g.computeVertexNormals();
    g.deleteAttribute('uv');
    g.scale(r, r, r);
    g.rotateY(rnd() * 6.28);
    g.translate(x, y, z);
    return g;
}

/** Cúmulo = 5–9 bolhas agrupadas; `height` > 1 empilha em torre. */
function cumulus(rnd, list, cx, cy, cz, size, height = 1) {
    const n = 5 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
        const a = rnd() * 6.28;
        const d = rnd() * size * 0.9;
        const up = rnd() * rnd() * size * 0.7 * height;
        list.push(blob(rnd, cx + Math.cos(a) * d, cy + up, cz + Math.sin(a) * d, size * (0.55 + rnd() * 0.5) * (1 - up / (size * height * 1.4))));
    }
}

/**
 * Reino das nuvens: mar (grade polar que afina com a distância), topo caminhável
 * da ilha, cúmulos na borda e torres ao longe.
 * @param {object} o
 * @param {Array<{x,z,r}>} o.circles  discos da ilha
 * @param {number} o.count            cúmulos (por tier)
 * @param {object} [o.flat]           retângulo raso sob o castelo
 * @returns {{ object, material, heightAt(x, z), update(t) }}
 */
export function createCloudRealm({ circles, count = 100, seed = 4, flat = null } = {}) {
    // `flat` = { x0, x1, z0, z1, y, margin }: sob o castelo a nuvem fica rasa (não atravessa o piso)
    // e volta ao relevo normal em `margin` metros para fora do retângulo.
    const topAt = (x, z) => {
        const h = cloudTop(circles, x, z);
        if (!flat) return h;
        const d = Math.hypot(Math.max(flat.x0 - x, 0, x - flat.x1), Math.max(flat.z0 - z, 0, z - flat.z1));
        return lerp(Math.min(h, flat.y), h, smoothstep(0, flat.margin, d));
    };
    const rnd = seeded(seed * 53 + 1);
    const group = new THREE.Group();
    group.name = 'reinoDasNuvens';
    const material = cloudMaterial();

    // --- mar: anéis geométricos r_i = 6·q^i até ~1900 m, 144 setores
    const RINGS = 104;
    const SECT = 144;
    const q = Math.pow(1900 / 6, 1 / RINGS);
    const pos = new Float32Array((RINGS + 1) * SECT * 3);
    const idx = [];
    for (let i = 0; i <= RINGS; i++) {
        const r = i === 0 ? 0 : 6 * Math.pow(q, i);
        for (let j = 0; j < SECT; j++) {
            const a = (j / SECT) * Math.PI * 2 + (i % 2) * (Math.PI / SECT);
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r + 10;
            const m = islandMask(circles, x, z);
            // perto da ilha o mar baixa e alisa, para a ilha se destacar
            const far = smoothstep(-0.2, -1.6, m);
            const y = m > -0.05 ? -6 : -4.2 + seaH(x, z) * (0.25 + 0.75 * far) - 1.5 * (1 - far);
            const o = (i * SECT + j) * 3;
            pos[o] = x;
            pos[o + 1] = y;
            pos[o + 2] = z;
        }
    }
    for (let i = 0; i < RINGS; i++) {
        for (let j = 0; j < SECT; j++) {
            const a = i * SECT + j;
            const b = i * SECT + ((j + 1) % SECT);
            const c = a + SECT;
            const d = b + SECT;
            idx.push(a, c, b, b, c, d);
        }
    }
    const seaGeo = new THREE.BufferGeometry();
    seaGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    seaGeo.setIndex(idx);
    seaGeo.computeVertexNormals();
    const sea = new THREE.Mesh(seaGeo, material);
    sea.receiveShadow = true;
    group.add(sea);

    // --- topo caminhável: grade de 0,9 m sobre a caixa da ilha
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const c of circles) {
        minX = Math.min(minX, c.x - c.r - 4);
        maxX = Math.max(maxX, c.x + c.r + 4);
        minZ = Math.min(minZ, c.z - c.r - 4);
        maxZ = Math.max(maxZ, c.z + c.r + 4);
    }
    const nx = Math.ceil((maxX - minX) / 0.9);
    const nz = Math.ceil((maxZ - minZ) / 0.9);
    const top = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ, nx, nz);
    top.rotateX(-Math.PI / 2);
    top.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const tp = top.attributes.position;
    for (let i = 0; i < tp.count; i++) tp.setY(i, topAt(tp.getX(i), tp.getZ(i)));
    top.computeVertexNormals();
    top.deleteAttribute('uv');
    const topMesh = new THREE.Mesh(top, material);
    topMesh.receiveShadow = true;
    group.add(topMesh);

    // --- cúmulos: borda da ilha (rodapé fofo) + torres no mar
    const blobs = [];
    const rim = Math.round(count * 0.45);
    for (let i = 0; i < rim; i++) {
        const c = circles[Math.floor(rnd() * circles.length)];
        const a = rnd() * 6.28;
        const x = c.x + Math.cos(a) * c.r * 1.02;
        const z = c.z + Math.sin(a) * c.r * 1.02;
        const m = islandMask(circles, x, z);
        if (m > 0.05) continue; // caiu dentro de outro disco
        blobs.push(blob(rnd, x, -1.5 - rnd() * 1.2, z, 3 + rnd() * 3.5, 0.5));
    }
    const towers = Math.round(count * 0.22);
    for (let i = 0; i < towers; i++) {
        const a = rnd() * 6.28;
        const r = 70 + rnd() * rnd() * 420;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r + 10;
        if (islandMask(circles, x, z) > -0.6) continue;
        const size = 9 + rnd() * 16 + r * 0.03;
        cumulus(rnd, blobs, x, -2 + seaH(x, z) * 0.6, z, size, 1 + rnd() * 2.2);
    }
    if (blobs.length) {
        const cum = new THREE.Mesh(mergeGeometries(blobs, false), material);
        cum.receiveShadow = true;
        group.add(cum);
    }

    return {
        object: group,
        material,
        heightAt: topAt,
        mask: (x, z) => islandMask(circles, x, z),
        dispose() {
            group.traverse((o) => o.geometry?.dispose());
            material.dispose();
        }
    };
}

/**
 * Colar de nuvens em volta do topo do pé de feijão (capítulos de solo): anel
 * de cúmulos entre `inner` e `outer` metros do caule, na altura `y`.
 */
export function createCloudCollar({ x = 0, y = 70, z = 0, inner = 7, outer = 46, count = 26, seed = 2 } = {}) {
    const rnd = seeded(seed * 97 + 5);
    const blobs = [];
    for (let i = 0; i < count; i++) {
        const a = rnd() * 6.28;
        const r = inner + 4 + Math.pow(rnd(), 0.8) * (outer - inner);
        cumulus(rnd, blobs, x + Math.cos(a) * r, y + (rnd() - 0.3) * 4, z + Math.sin(a) * r, 5 + rnd() * 6 + r * 0.08, 1.2);
    }
    const material = cloudMaterial();
    const m = new THREE.Mesh(mergeGeometries(blobs, false), material);
    m.name = 'colarDeNuvens';
    return { object: m, material };
}
