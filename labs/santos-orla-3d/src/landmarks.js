/**
 * Marcos da orla, de oeste a leste:
 *   Emissário / Parque Roberto Mário Santini — plataforma sobre o mar, pista de skate e a
 *     escultura vermelha de Tomie Ohtake (fita de aço varrida ao longo de uma spline);
 *   Praça das Bandeiras (Gonzaga) — mastros com bandeiras tremulando (onda no vertex shader);
 *   Pinacoteca Benedito Calixto — casarão eclético branco de 1900;
 *   Basílica de Santo Antônio do Embaré — neogótica, torre central com agulha;
 *   Fonte do Sapo — espelho d'água com jatos (partículas balísticas);
 *   Aquário Municipal e Museu de Pesca — Ponta da Praia;
 *   Deck do Pescador — píer de madeira sobre o canal do porto;
 *   Balsa Santos–Guarujá cruzando o canal.
 *
 * Bandeira: z += sin(u·7 − t·5 + fase) · 0,18 · u  (u = 0 no mastro → 1 na ponta).
 * Jato d'água: p(τ) = p0 + v0·τ − ½·g·τ², g = 9,8 m/s² (kit gfx/particles).
 */
import * as THREE from 'three';
import { pbr } from '../../shared/gfx/textures.js';
import { applyWorldUV, seeded } from '../../shared/gfx/core.js';
import { wind } from '../../shared/gfx/flora.js';
import { createParticles } from '../../shared/gfx/particles.js';
import { ZONES, LAND_Y, PLATFORMS } from './config.js';
import { P, instances, propMaterial, signTexture } from './props.js';

const WHITE = 0xf3f0e8;
const DARK = 0x2a2e33;

function mesh(parts, material = propMaterial(), cast = true) {
    const m = new THREE.Mesh(P.merge(parts), material);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
}

function texturedBox(w, h, d, x, y, z, material, uvScale = 2) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    applyWorldUV(g, uvScale);
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

/** Telhado de quatro águas. */
function hipRoof(w, d, h, x, y, z, material, overhang = 0.6) {
    const g = new THREE.BufferGeometry();
    const a = w / 2 + overhang;
    const b = d / 2 + overhang;
    const r = Math.max(0, a - b); // cumeeira
    const v = [
        [-a, 0, -b], [a, 0, -b], [a, 0, b], [-a, 0, b], [-r, h, 0], [r, h, 0]
    ];
    const tris = [[0, 4, 5], [0, 5, 1], [2, 5, 4], [2, 4, 3], [1, 5, 2], [3, 4, 0]];
    const pos = [];
    for (const t of tris) for (const i of t) pos.push(v[i][0] + x, v[i][1] + y, v[i][2] + z);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    applyWorldUV(g, 3);
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    return m;
}

/** Fita de aço: retângulo (largura × espessura) varrido ao longo de uma curva. */
function ribbonSculpture(points, width, thick) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
    const n = 120;
    const frames = curve.computeFrenetFrames(n, false);
    const pos = [];
    const idx = [];
    const v = new THREE.Vector3();
    for (let i = 0; i <= n; i++) {
        const p = curve.getPointAt(i / n);
        const N = frames.normals[i];
        const Bn = frames.binormals[i];
        const w = width * (0.75 + 0.25 * Math.sin((i / n) * Math.PI));
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            v.copy(p).addScaledVector(Bn, a * w * 0.5).addScaledVector(N, b * thick * 0.5);
            pos.push(v.x, v.y, v.z);
        }
        if (i < n) {
            const o = i * 4;
            for (let k = 0; k < 4; k++) {
                const k2 = (k + 1) % 4;
                idx.push(o + k, o + k2, o + 4 + k, o + k2, o + 4 + k2, o + 4 + k);
            }
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    const flat = g.toNonIndexed();
    flat.computeVertexNormals();
    return flat;
}

function flagMaterial() {
    const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.85 });
    m.onBeforeCompile = (sh) => {
        sh.uniforms.uWindTime = wind.uWindTime;
        sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
            .replace('#include <begin_vertex>', `#include <begin_vertex>
                float fPh = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 0.9;
                float fW = uv.x;
                transformed.z += sin(uv.x * 7.0 - uWindTime * 5.0 + fPh) * 0.18 * fW
                    + sin(uv.x * 13.0 - uWindTime * 8.0 + fPh * 2.0) * 0.05 * fW;
                transformed.y += sin(uv.x * 5.0 - uWindTime * 4.0 + fPh) * 0.06 * fW - fW * fW * 0.12;`);
    };
    m.customProgramCacheKey = () => 'orlaFlag';
    return m;
}

export function createLandmarks(quality) {
    const root = new THREE.Group();
    root.name = 'landmarks';
    const rnd = seeded(0x1a4d);
    const mat = propMaterial();
    const blockers = [];
    const fountains = [];
    const Y = LAND_Y;

    // =========================================================
    // Emissário / Parque Santini
    // =========================================================
    {
        const pl = PLATFORMS[0];
        const cx = (pl.x0 + pl.x1) / 2;
        const w = pl.x1 - pl.x0;
        const len = pl.z1 - ZONES.wall;
        const deckMat = pbr('concrete', { color: 0xd8d4cb });
        root.add(texturedBox(w, 0.6, len, cx, Y - 0.3, ZONES.wall + len / 2, deckMat, 3));
        const parts = [];
        // pilares
        for (let z = ZONES.wall + 6; z < pl.z1; z += 12) {
            for (const s of [-0.38, 0.38]) parts.push(P.cyl(0.55, 0.6, 7, cx + s * w, Y - 4, z, 0xa9a9a2, 8));
        }
        // guarda-corpo
        for (const s of [-1, 1]) {
            const x = cx + s * (w / 2 - 0.15);
            parts.push(P.box(0.06, 0.06, len, x, Y + 1.05, ZONES.wall + len / 2, 0xc8ccd0));
            parts.push(P.box(0.06, 0.06, len, x, Y + 0.55, ZONES.wall + len / 2, 0xc8ccd0));
            for (let z = ZONES.wall + 1; z < pl.z1; z += 2.4) parts.push(P.cyl(0.035, 0.035, 1.05, x, Y + 0.52, z, 0xc8ccd0, 5));
        }
        parts.push(P.box(w, 0.06, 0.06, cx, Y + 1.05, pl.z1 - 0.15, 0xc8ccd0), P.box(w, 0.06, 0.06, cx, Y + 0.55, pl.z1 - 0.15, 0xc8ccd0));
        // pista de skate: bowl raso (meio-tubo) + corrimão
        const bowl = new THREE.CylinderGeometry(4.2, 4.2, 14, 16, 1, true, Math.PI * 0.5, Math.PI);
        bowl.rotateZ(Math.PI / 2);
        bowl.rotateY(Math.PI / 2);
        bowl.scale(1, 0.42, 1);
        bowl.translate(cx - 6, Y + 1.78, 92);
        parts.push(P.geo(bowl, 0xb9b6ae));
        parts.push(P.box(14, 0.5, 0.4, cx - 6, Y + 0.25, 87.9, 0xc9c6be), P.box(14, 0.5, 0.4, cx - 6, Y + 0.25, 96.1, 0xc9c6be));
        parts.push(P.box(6, 0.08, 0.08, cx + 8, Y + 0.5, 100, DARK), P.cyl(0.04, 0.04, 0.5, cx + 5.4, Y + 0.25, 100, DARK, 5), P.cyl(0.04, 0.04, 0.5, cx + 10.6, Y + 0.25, 100, DARK, 5));
        // mirante final: bancos de concreto
        for (let k = -1; k <= 1; k++) parts.push(P.box(3.4, 0.45, 0.6, cx + k * 9, Y + 0.22, pl.z1 - 3, 0xcfcbc2));
        const m = mesh(parts);
        m.material.side = THREE.DoubleSide;
        root.add(m);

        // escultura de Tomie Ohtake (2008, centenário da imigração japonesa)
        const sculpt = new THREE.Mesh(
            ribbonSculpture([
                [-11, 0.2, 2], [-10, 7, 1], [-6, 13.5, -1], [0.5, 15.2, 0], [6.5, 11, 2], [8.5, 4.5, 1],
                [5, 1.2, -2.5], [-1, 3.6, -3], [-4.5, 8.2, -0.5], [-2, 11.2, 2.4], [2.5, 8.6, 3]
            ], 2.6, 0.16),
            new THREE.MeshPhysicalMaterial({ color: 0xc41712, roughness: 0.32, metalness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.25 })
        );
        sculpt.position.set(cx, Y, 138);
        sculpt.castShadow = true;
        root.add(sculpt);
        root.add(texturedBox(16, 0.35, 9, cx, Y + 0.17, 138, pbr('concrete', { color: 0xe9e6de }), 3));
        blockers.push({ x: cx, z: 138, r: 3.2 });
    }

    // =========================================================
    // Deck do Pescador
    // =========================================================
    {
        const pl = PLATFORMS[1];
        const cx = (pl.x0 + pl.x1) / 2;
        const w = pl.x1 - pl.x0;
        const len = pl.z1 - ZONES.wall;
        root.add(texturedBox(w, 0.22, len, cx, Y - 0.11, ZONES.wall + len / 2, pbr('woodPlanks', { color: 0xc9b89a }), 2.2));
        const parts = [];
        for (let z = ZONES.wall + 3; z < pl.z1; z += 5) {
            for (const s of [-0.42, 0.42]) parts.push(P.cyl(0.2, 0.22, 6, cx + s * w, Y - 3.2, z, 0x4a3a2c, 7));
            parts.push(P.box(w, 0.3, 0.3, cx, Y - 0.4, z, 0x5a4634));
        }
        for (const s of [-1, 1]) {
            const x = cx + s * (w / 2 - 0.1);
            parts.push(P.box(0.1, 0.08, len, x, Y + 1.0, ZONES.wall + len / 2, 0x6e5a44));
            parts.push(P.box(0.06, 0.06, len, x, Y + 0.5, ZONES.wall + len / 2, 0x6e5a44));
            for (let z = ZONES.wall + 0.6; z < pl.z1; z += 2) parts.push(P.box(0.1, 1.0, 0.1, x, Y + 0.5, z, 0x6e5a44));
        }
        parts.push(P.box(w, 0.08, 0.1, cx, Y + 1.0, pl.z1 - 0.1, 0x6e5a44), P.box(w, 0.06, 0.06, cx, Y + 0.5, pl.z1 - 0.1, 0x6e5a44));
        // quiosque de iscas no meio do deck
        parts.push(P.box(3, 2.3, 2.4, cx - 2.6, Y + 1.15, 62, 0xe8e2d2), P.box(3.6, 0.14, 3.0, cx - 2.6, Y + 2.4, 62, 0x7a2e24));
        root.add(mesh(parts));
        blockers.push({ x0: cx - 4.2, x1: cx - 1.0, z0: 60.6, z1: 63.4 });
    }

    // =========================================================
    // Praça das Bandeiras (Gonzaga)
    // =========================================================
    {
        const cx = -104;
        const cz = 24;
        const plaza = new THREE.Mesh(new THREE.CircleGeometry(12.5, 40), pbr('mosaic'));
        plaza.rotation.x = -Math.PI / 2;
        plaza.position.set(cx, Y + 0.06, cz);
        plaza.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * 7; });
        plaza.receiveShadow = true;
        plaza.material = plaza.material.clone();
        plaza.material.polygonOffset = true;
        plaza.material.polygonOffsetFactor = -3;
        plaza.material.polygonOffsetUnits = -3;
        root.add(plaza);
        const parts = [];
        const flags = [];
        const FL = [0x1f9a4a, 0xf2d230, 0x1f4fa8, 0xd8281e, 0xffffff, 0x1f9a4a, 0x0f3f8a, 0xf2f2f2, 0xd8281e, 0xf2d230, 0x2a2a2a, 0x1f9a4a, 0xffffff, 0x1f4fa8];
        const n = 14;
        for (let k = 0; k < n; k++) {
            const a = Math.PI * 0.08 + (k / (n - 1)) * Math.PI * 0.84 + Math.PI; // arco voltado para o mar
            const x = cx + Math.cos(a) * 10.2;
            const z = cz - Math.sin(a) * 10.2;
            parts.push(P.cyl(0.05, 0.085, 10.5, x, Y + 5.25, z, 0xe6e6e6, 8), P.sphere(0.11, x, Y + 10.55, z, 0xd8b84a));
            flags.push({ x, y: Y + 9.6, z, ry: Math.PI * 0.5, color: FL[k % FL.length] });
        }
        // fonte central
        parts.push(P.cyl(3.6, 3.8, 0.36, cx, Y + 0.18, cz, 0xe2ded4, 28), P.cyl(0.5, 0.7, 1.2, cx, Y + 0.6, cz, 0xcfcbc0, 12), P.cyl(1.1, 0.4, 0.2, cx, Y + 1.3, cz, 0xcfcbc0, 16));
        {
            const rim = new THREE.TorusGeometry(3.55, 0.2, 8, 36);
            rim.rotateX(Math.PI / 2);
            rim.translate(cx, Y + 0.42, cz);
            parts.push(P.geo(rim, 0xe2ded4));
            const w = new THREE.Mesh(
                new THREE.CircleGeometry(3.45, 30),
                new THREE.MeshPhysicalMaterial({ color: 0x3a6a70, roughness: 0.06, metalness: 0, envMapIntensity: 1.2 })
            );
            w.rotation.x = -Math.PI / 2;
            w.position.set(cx, Y + 0.4, cz);
            root.add(w);
        }
        root.add(mesh(parts));
        const flagGeo = new THREE.PlaneGeometry(2.6, 1.7, 14, 5);
        flagGeo.translate(1.3, 0, 0);
        const fm = instances(flagGeo, flagMaterial(), flags, { colors: true });
        fm.frustumCulled = false;
        root.add(fm);
        fountains.push({ x: cx, y: Y + 1.4, z: cz, r: 3.4, h: 5.2, jets: 90 });
        blockers.push({ x: cx, z: cz, r: 4.2, h: 1.2 }); // h: a câmera passa por cima da borda
    }

    // =========================================================
    // Fonte do Sapo (Aparecida)
    // =========================================================
    {
        const cx = 175;
        const cz = 26;
        const parts = [];
        parts.push(P.cyl(6.4, 6.6, 0.4, cx, Y + 0.2, cz, 0xe6e2d8, 36));
        {
            const rim = new THREE.TorusGeometry(6.35, 0.24, 8, 48);
            rim.rotateX(Math.PI / 2);
            rim.translate(cx, Y + 0.46, cz);
            parts.push(P.geo(rim, 0xe6e2d8));
        }
        parts.push(P.cyl(8.6, 8.6, 0.06, cx, Y + 0.05, cz, 0xd6d0c2, 36));
        parts.push(P.cyl(1.0, 1.4, 1.1, cx, Y + 0.85, cz, 0xbdb8ac, 14));
        // o sapo: corpo, cabeça, olhos e patas
        const G = 0x4f8a3a;
        parts.push(P.sphere(0.7, cx, Y + 1.85, cz - 0.1, G, 1.05, 0.72, 1.2, 12, 9));
        parts.push(P.sphere(0.46, cx, Y + 2.12, cz + 0.62, G, 1.15, 0.7, 1.0, 12, 8));
        for (const s of [-1, 1]) {
            parts.push(P.sphere(0.15, cx + s * 0.3, Y + 2.42, cz + 0.72, 0xe8e0a0), P.sphere(0.07, cx + s * 0.32, Y + 2.45, cz + 0.84, 0x15150f));
            parts.push(P.sphere(0.34, cx + s * 0.7, Y + 1.6, cz - 0.45, G, 0.8, 0.6, 1.3), P.sphere(0.22, cx + s * 0.6, Y + 1.5, cz + 0.7, G, 0.7, 0.5, 1.2));
        }
        root.add(mesh(parts));
        const water = new THREE.Mesh(
            new THREE.CircleGeometry(6.1, 36),
            new THREE.MeshPhysicalMaterial({ color: 0x3a6a70, roughness: 0.06, metalness: 0, envMapIntensity: 1.2 })
        );
        water.rotation.x = -Math.PI / 2;
        water.position.set(cx, Y + 0.44, cz);
        root.add(water);
        fountains.push({ x: cx, y: Y + 2.2, z: cz + 0.9, r: 0.1, h: 3.4, jets: 60, forward: 2.4 });
        fountains.push({ x: cx, y: Y + 0.55, z: cz, r: 4.6, h: 2.6, jets: 120 });
        blockers.push({ x: cx, z: cz, r: 6.9, h: 1.4 });
    }

    // =========================================================
    // Pinacoteca Benedito Calixto (casarão de 1900)
    // =========================================================
    {
        const cx = -20;
        const z0 = ZONES.buildFront - 9; // fachada recuada, com jardim na frente
        const wall = pbr('plaster', { color: 0xf5f2ea });
        const tile = pbr('roofTile', { color: 0xe8d8cc });
        const g = new THREE.Group();
        g.add(texturedBox(24, 9.4, 14, 0, 4.7, -7, wall, 3));
        g.add(texturedBox(8.4, 10.6, 3, 0, 5.3, 1.0, wall, 3)); // corpo central avançado
        g.add(hipRoof(24, 14, 4.2, 0, 9.4, -7, tile));
        g.add(hipRoof(8.4, 3.6, 2.6, 0, 10.6, 1.0, tile, 0.4));
        const parts = [];
        const GREEN = 0x2f4a3a;
        // janelas altas com venezianas, 2 pavimentos
        for (const fy of [2.4, 6.6]) {
            for (const fx of [-9.6, -6.4, 6.4, 9.6]) {
                parts.push(P.box(1.3, 2.6, 0.12, fx, fy, 0.05, 0x1c2a33), P.box(1.6, 0.22, 0.3, fx, fy + 1.45, 0.1, WHITE), P.box(1.6, 0.18, 0.34, fx, fy - 1.4, 0.1, WHITE));
                parts.push(P.box(0.55, 2.6, 0.06, fx - 0.98, fy, 0.12, GREEN), P.box(0.55, 2.6, 0.06, fx + 0.98, fy, 0.12, GREEN));
            }
            for (const fx of [-2.4, 2.4]) parts.push(P.box(1.3, 2.6, 0.12, fx, fy, 2.55, 0x1c2a33), P.box(1.6, 0.22, 0.3, fx, fy + 1.45, 2.6, WHITE));
        }
        parts.push(P.box(1.9, 3.4, 0.14, 0, 1.7, 2.56, 0x4a2f20)); // porta
        // varanda com colunas e balaustrada
        for (const fx of [-3.6, -1.2, 1.2, 3.6]) parts.push(P.cyl(0.2, 0.24, 4.2, fx, 2.1, 4.4, WHITE, 12));
        parts.push(P.box(9.4, 0.4, 2.6, 0, 4.4, 3.6, WHITE), P.box(9.6, 0.5, 2.9, 0, 0.25, 3.5, 0xdcd6c8));
        for (let k = -4; k <= 4; k++) parts.push(P.cyl(0.07, 0.09, 0.8, k * 1.0, 5.0, 4.75, WHITE, 6));
        parts.push(P.box(9.4, 0.14, 0.24, 0, 5.45, 4.75, WHITE));
        // cornija e frontão
        parts.push(P.box(24.6, 0.45, 14.6, 0, 9.3, -7, WHITE), P.box(8.9, 0.45, 3.5, 0, 10.5, 1.0, WHITE));
        // muro baixo com gradil e portão
        for (const s of [-1, 1]) {
            parts.push(P.box(11, 0.7, 0.35, s * 8.6, 0.35, 8.2, WHITE));
            for (let k = 0; k < 10; k++) parts.push(P.box(0.05, 1.1, 0.05, s * (3.6 + k * 1.1), 1.25, 8.2, DARK));
            parts.push(P.box(11, 0.06, 0.06, s * 8.6, 1.75, 8.2, DARK), P.cyl(0.26, 0.26, 2.1, s * 2.9, 1.05, 8.2, WHITE, 8));
        }
        const d = mesh(parts);
        g.add(d);
        g.position.set(cx, Y, z0);
        root.add(g);
    }

    // =========================================================
    // Basílica de Santo Antônio do Embaré (neogótico)
    // =========================================================
    {
        const cx = 86;
        const z0 = ZONES.buildFront - 4;
        const stone = pbr('plaster', { color: 0xdccfb4 });
        const slate = pbr('roofTile', { color: 0x8a8480 });
        const g = new THREE.Group();
        const TRIM = 0xb9a888;
        g.add(texturedBox(17, 15, 40, 0, 7.5, -22, stone, 3));       // nave
        g.add(texturedBox(27, 9, 34, 0, 4.5, -22, stone, 3));        // naves laterais
        g.add(texturedBox(7.4, 27, 7.4, 0, 13.5, -1.2, stone, 3));   // torre
        // telhado da nave (duas águas)
        const roofG = new THREE.CylinderGeometry(0.01, 10.2, 7.2, 4, 1);
        roofG.rotateY(Math.PI / 4);
        roofG.scale(1, 1, 2.85);
        roofG.translate(0, 18.6, -22);
        applyWorldUV(roofG, 3);
        const roof = new THREE.Mesh(roofG, slate);
        roof.castShadow = true;
        g.add(roof);
        // agulha octogonal
        const spire = new THREE.Mesh(applyWorldUV(new THREE.ConeGeometry(3.9, 15, 8), 3), slate);
        spire.position.set(0, 34.5, -1.2);
        spire.castShadow = true;
        g.add(spire);
        const parts = [];
        // pináculos da torre + cruz
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(P.cyl(0.02, 0.5, 4.2, sx * 3.2, 29.1, -1.2 + sz * 3.2, TRIM, 6));
        parts.push(P.box(0.18, 2.6, 0.18, 0, 43.2, -1.2, 0xd8c36a), P.box(1.3, 0.18, 0.18, 0, 43.7, -1.2, 0xd8c36a));
        // portal em arco ogival, rosácea, janelas da torre
        const arch = (w, h, x, y, z, color) => {
            const out = [P.box(w, h * 0.6, 0.2, x, y + h * 0.3, z, color)];
            const top = new THREE.CylinderGeometry(w * 0.5, w * 0.5, 0.2, 3, 1);
            top.rotateX(Math.PI / 2);
            top.rotateZ(Math.PI / 2 - Math.PI / 6);
            top.scale(1, 1.5, 1);
            top.translate(x, y + h * 0.6 + w * 0.36, z);
            out.push(P.geo(top, color));
            return out;
        };
        parts.push(...arch(3.0, 5.6, 0, 0, 2.6, 0x3a2a1c));
        parts.push(...arch(1.1, 3.6, 0, 16.5, 2.6, 0x1c2a33), ...arch(1.1, 3.2, 0, 22.4, 2.6, 0x1c2a33));
        const rose = new THREE.CylinderGeometry(1.7, 1.7, 0.2, 20);
        rose.rotateX(Math.PI / 2);
        rose.translate(0, 10.6, 2.56);
        parts.push(P.geo(rose, 0x2a3f6a));
        const ring = new THREE.TorusGeometry(1.75, 0.16, 6, 22);
        ring.translate(0, 10.6, 2.62);
        parts.push(P.geo(ring, TRIM));
        for (const s of [-1, 1]) {
            parts.push(...arch(1.3, 4.2, s * 9.4, 1.6, -4.9, 0x1c2a33));
            // contrafortes e vitrais laterais
            for (let k = 0; k < 6; k++) {
                const z = -8 - k * 5.4;
                parts.push(P.box(0.9, 10.5, 1.3, s * 13.9, 5.25, z, TRIM), P.box(0.7, 3.4, 0.9, s * 9.0, 12.8, z, TRIM));
                parts.push(P.box(0.12, 4.0, 1.5, s * 13.56, 4.4, z + 2.7, 0x2a3f6a), P.box(0.12, 2.6, 1.3, s * 8.56, 12.2, z + 2.7, 0x2a3f6a));
            }
        }
        // escadaria
        for (let k = 0; k < 4; k++) parts.push(P.box(11 - k * 1.2, 0.2, 1.2, 0, 0.1 + k * 0.2, 5.6 - k * 0.6, 0xcfc6b2));
        g.add(mesh(parts));
        g.position.set(cx, Y, z0);
        root.add(g);
    }

    // =========================================================
    // Aquário Municipal + Museu de Pesca (Ponta da Praia)
    // =========================================================
    {
        const cx = 306;
        const cz = 22;
        const g = new THREE.Group();
        const wall = pbr('plaster', { color: 0xf6f4ee });
        g.add(texturedBox(34, 7.2, 15, 0, 3.6, 0, wall, 3));
        g.add(texturedBox(12, 9.6, 9, 0, 4.8, 3.2, wall, 3));
        const parts = [];
        parts.push(P.box(34.4, 1.3, 15.4, 0, 6.2, 0, 0x1f7fb8), P.box(34.6, 0.3, 15.6, 0, 7.3, 0, WHITE));
        parts.push(P.box(12.4, 0.3, 9.4, 0, 9.7, 3.2, WHITE));
        parts.push(P.box(8, 3.2, 0.2, 0, 1.6, 7.76, 0x16303c));   // entrada envidraçada
        parts.push(P.box(11, 0.25, 4, 0, 3.6, 9.6, WHITE), P.cyl(0.14, 0.14, 3.5, -4.8, 1.75, 11.2, 0xd8d8d8, 8), P.cyl(0.14, 0.14, 3.5, 4.8, 1.75, 11.2, 0xd8d8d8, 8));
        for (const s of [-1, 1]) for (let k = 0; k < 4; k++) parts.push(P.box(2.2, 1.7, 0.14, s * (8 + k * 2.9), 3.3, 7.52, 0x16303c));
        g.add(mesh(parts));
        const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(10.5, 1.9),
            new THREE.MeshStandardMaterial({ map: signTexture(['AQUÁRIO MUNICIPAL'], { w: 768, h: 128, bg: '#f6f4ee', fg: '#1f6fa8', font: 'bold 64px Arial' }), roughness: 0.7 })
        );
        sign.position.set(0, 8.0, 7.72);
        g.add(sign);
        g.position.set(cx, Y, cz);
        root.add(g);
        blockers.push({ x0: cx - 17.6, x1: cx + 17.6, z0: cz - 8, z1: cz + 9.6 });

        // Museu de Pesca: casarão amarelo com torreão
        const m = new THREE.Group();
        const yellow = pbr('plaster', { color: 0xe9c468 });
        m.add(texturedBox(26, 11, 15, 0, 5.5, -7.5, yellow, 3));
        m.add(texturedBox(6, 16, 6, 0, 8, -1.5, yellow, 3));
        m.add(hipRoof(26, 15, 4, 0, 11, -7.5, pbr('roofTile')));
        m.add(hipRoof(6, 6, 3.4, 0, 16, -1.5, pbr('roofTile'), 0.4));
        const mp = [];
        for (const fy of [2.6, 7.2]) for (let k = 0; k < 7; k++) {
            const fx = -10.8 + k * 3.6;
            if (Math.abs(fx) < 3.4) continue;
            mp.push(P.box(1.4, 2.6, 0.12, fx, fy, 0.05, 0x1c2a33), P.box(1.8, 0.24, 0.3, fx, fy + 1.5, 0.1, WHITE), P.box(1.8, 0.2, 0.3, fx, fy - 1.42, 0.1, WHITE));
        }
        mp.push(P.box(2.0, 3.6, 0.14, 0, 1.8, 1.55, 0x4a2f20), P.box(1.3, 2.4, 0.12, 0, 7.4, 1.55, 0x1c2a33), P.box(1.3, 2.0, 0.12, 0, 12.6, 1.55, 0x1c2a33));
        mp.push(P.box(26.5, 0.45, 15.5, 0, 10.9, -7.5, WHITE), P.box(26.4, 0.3, 0.3, 0, 5.0, 0.1, WHITE));
        m.add(mesh(mp));
        m.position.set(322, Y, ZONES.buildFront - 3);
        root.add(m);
    }

    // =========================================================
    // Fontes (partículas) e balsa
    // =========================================================
    const emitters = [];
    for (const f of fountains) {
        const count = quality.id === 'low' ? Math.round(f.jets * 0.45) : f.jets;
        const e = createParticles({
            count,
            life: 1.35,
            origin: new THREE.Vector3(f.x, f.y, f.z),
            spread: new THREE.Vector3(f.r, 0.02, f.r),
            velocity: new THREE.Vector3(0, Math.sqrt(2 * 9.8 * f.h), f.forward || 0),
            velocitySpread: new THREE.Vector3(0.35, 0.5, 0.35),
            accel: new THREE.Vector3(0, -9.8, 0),
            turbulence: 0.04,
            size: [0.16, 0.42],
            color: 0xffffff,
            opacity: 0.6
        });
        root.add(e.mesh);
        emitters.push(e);
    }

    // balsa Santos–Guarujá
    const ferry = new THREE.Group();
    {
        const parts = [
            P.box(13, 2.2, 44, 0, 0.4, 0, 0xf1eee6), P.box(13.4, 0.5, 44.4, 0, -0.5, 0, 0x1f4f8a),
            P.box(13, 0.25, 36, 0, 5.2, 0, 0xf1eee6), P.box(4, 2.6, 6, 0, 6.6, 0, 0xf1eee6), P.box(4.2, 0.9, 0.2, 0, 7.0, 3.05, 0x1c2a33),
            P.box(4.2, 0.9, 0.2, 0, 7.0, -3.05, 0x1c2a33), P.box(2.2, 2.4, 2.2, 0, 9.1, -1, 0xd8281e)
        ];
        for (const s of [-1, 1]) for (let k = -3; k <= 3; k++) parts.push(P.cyl(0.14, 0.14, 3.8, s * 6.1, 3.3, k * 5.4, 0xd8d8d8, 6));
        const CAR = [0xb23a2e, 0xdadada, 0x2c3e50, 0x8a8f96, 0x1f6a78, 0xf2f2f2];
        for (let r = 0; r < 2; r++) for (let k = -4; k <= 4; k++) {
            if (rnd() < 0.2) continue;
            parts.push(P.box(1.8, 1.25, 4.1, -2.6 + r * 5.2, 2.1, k * 4.7, rnd.pick(CAR)));
        }
        ferry.add(mesh(parts));
    }
    root.add(ferry);

    const waterTint = new THREE.Color();
    return {
        root,
        blockers,
        update(t, dt, ctx) {
            for (const e of emitters) e.update(t);
            // travessia de ~95 s: vai e volta com paradas nos atracadouros
            const cyc = (t / 95) % 1;
            const k = cyc < 0.4 ? cyc / 0.4 : cyc < 0.5 ? 1 : cyc < 0.9 ? 1 - (cyc - 0.5) / 0.4 : 0;
            const e = k * k * (3 - 2 * k);
            ferry.position.set(366 + e * 92, 0.9 + Math.sin(t * 0.8) * 0.06, -70 - e * 30);
            ferry.rotation.y = Math.PI / 2 + 0.28;
            if (ctx?.sky) {
                waterTint.copy(ctx.sky.lightColor).multiplyScalar(ctx.sky.lightIntensity * 0.22).add(ctx.sky.zenithColor);
                for (const em of emitters) em.uniforms.uColor.value.copy(waterTint).multiplyScalar(1.3).addScalar(0.05);
            }
        },
        setNight() {}
    };
}
