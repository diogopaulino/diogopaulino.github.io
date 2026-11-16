/**
 * world — céu de inverno, relevo (ilha, Serra do Mar, margem oposta) e estuário.
 *
 * Relevo (G01): morros arredondados = soma de gaussianas + fBm, nunca picos alpinos.
 *   ilha de Santos:   terra onde x > max(0, (−470 − z)·1.3)   (a ponta SE recua)
 *   margem oposta:    terra onde x < −430 − max(0, (−560 − z)·0.8)
 *   Serra do Mar:     h = 780 · smoothstep(−1000, −2300, x) · (0.7 + 0.5·fBm)
 * A mesma linha de costa alimenta a profundidade do mar em GLSL (gfxSeaDepth),
 * que atenua as ondas no canal (estuário calmo) e libera a vaga no mar aberto.
 */
import * as THREE from 'three';
import { createSky } from '../../shared/gfx/sky.js';
import { createOcean } from '../../shared/gfx/ocean.js';
import { pbr } from '../../shared/gfx/textures.js';
import { createShrubKit, createTreeKit, instanceKit } from '../../shared/gfx/flora.js';
import { fbm2, ridged2, smoothstep, clamp, seeded } from '../../shared/gfx/core.js';
import { LAYOUT } from './config.js';

const HILLS = [
    // x, z, altura, raio — morros da ilha (Monte Serrat e vizinhos) e da margem oposta
    [520, 60, 150, 185],
    [660, 330, 175, 240],
    [720, -210, 125, 210],
    [1050, 90, 210, 420],
    [430, 520, 90, 170],
    [-760, -520, 150, 230],
    [-930, -120, 190, 280],
    [-820, 420, 130, 240],
    [-1250, 900, 260, 420]
];

const coastA = (z) => Math.max(0, (-470 - z) * 1.3);
const coastB = (z) => -430 - Math.max(0, (-560 - z) * 0.8);

/** Altura do terreno (m). Negativo = fundo do mar. */
export function landHeight(x, z) {
    const dA = x - coastA(z);
    const dB = coastB(z) - x;
    const dC = z - 1300; // fundo do estuário: o canal fecha em mangue a NW
    const d = Math.max(dA, dB, dC);
    if (d < -70) return -7;
    let h = clamp(d * 0.06, -7, dA > 0 ? 1.9 : 0.9);
    if (d > 0) {
        for (const [hx, hz, hh, hr] of HILLS) {
            const q = ((x - hx) ** 2 + (z - hz) ** 2) / (hr * hr);
            if (q < 6) h += hh * Math.exp(-q * 1.6) * (0.82 + 0.36 * fbm2(x / 160, z / 160, 3, 0, 5));
        }
        if (x < -900) {
            const s = smoothstep(-1000, -2300, x);
            h += 780 * s * (0.7 + 0.5 * fbm2(x / 900, z / 900, 4, 0, 9)) + 60 * s * fbm2(x / 180, z / 180, 3, 0, 21);
        }
        if (z > 1500) h += 520 * smoothstep(1500, 2600, z) * smoothstep(0, 500, d) * (0.7 + 0.5 * fbm2(x / 800, z / 800, 3, 0, 14));
        if (d > 30) h += (fbm2(x / 90, z / 90, 3, 0, 3) - 0.5) * Math.min(6, d * 0.03);
        // grotas e espigões proporcionais à altura: a silhueta deixa de ser uma "bolha" lisa
        if (h > 12) h += (ridged2(x / 260, z / 260, 3, 0, 31) - 0.42) * Math.min(80, h * 0.55);
    }
    return h;
}

export const DEPTH_GLSL = /* glsl */ `
float gfxSeaDepth(vec2 p) {
    float cA = max(0.0, (-470.0 - p.y) * 1.3);
    float cB = -430.0 - max(0.0, (-560.0 - p.y) * 0.8);
    float d = min(min(cA - p.x, p.x - cB), 1300.0 - p.y);
    float sea = smoothstep(-430.0, -780.0, p.y);
    return clamp(d * 0.1 + 0.5, -2.0, mix(1.35, 30.0, sea));
}
`;

export function createWorld(ctx) {
    const { scene, renderer, tier, quality } = ctx;

    // 18 de junho, 9h30: declinação +23,4° (solstício de inverno austral)
    const sky = createSky({
        renderer,
        scene,
        north: new THREE.Vector3(-0.7071, 0, 0.7071),
        east: new THREE.Vector3(-0.7071, 0, -0.7071),
        declination: 23.4,
        turbidity: 4.6,
        rayleigh: 2.0,
        mie: 0.0062,
        mieG: 0.84,
        cloudCover: 0.4,
        ground: 0x4a5246,
        envIntensity: 1.25
    });
    sky.setHour(9.5);

    // ---------- relevo ----------
    const X0 = -3400;
    const X1 = 1500;
    const Z0 = -2600;
    const Z1 = 2900;
    const nx = tier === 'low' ? 110 : 170;
    const nz = tier === 'low' ? 124 : 190;
    const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, nx, nz);
    geo.rotateX(-Math.PI / 2);
    geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const h = landHeight(x, z);
        pos.setY(i, h);
        uv.setXY(i, x / 240, z / 240);
        // baixada/mangue mais escura e oliva; encostas no verde do dossel
        const low = 1 - smoothstep(2, 14, h);
        const n = fbm2(x / 300, z / 300, 3, 0, 8);
        col[i * 3] = 0.62 - low * 0.16 + n * 0.2;
        col[i * 3 + 1] = 0.8 - low * 0.14 + n * 0.12;
        col[i * 3 + 2] = 0.56 - low * 0.2 + n * 0.08;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, pbr('canopy', { vertexColors: true, normalScale: 0.16, envMapIntensity: 0.4 }));
    terrain.receiveShadow = true;
    terrain.name = 'terrain';
    scene.add(terrain);

    // orla de mangue na margem oposta e nas pontas (cartões instanciados)
    const rnd = seeded(77);
    const mangrove = [];
    for (let z = -620; z < 1300; z += 9) {
        const x = coastB(z) - 4 - rnd() * 14;
        mangrove.push({ x, y: Math.max(0.2, landHeight(x, z)) - 0.3, z: z + rnd() * 6, scale: 5 + rnd() * 4, rot: rnd() * 6 });
        if (z < -470) {
            const xa = coastA(z) + 6 + rnd() * 20;
            mangrove.push({ x: xa, y: Math.max(0.3, landHeight(xa, z)) - 0.3, z, scale: 4 + rnd() * 4, rot: rnd() * 6 });
        }
    }
    scene.add(instanceKit(createShrubKit({ hue: 104, seed: 9, size: 1 }), mangrove, { castShadow: false }));

    // mata de encosta em primeiro plano (Monte Serrat e ponta da ilha)
    const trees = [];
    const kit = createTreeKit({ kind: 'round', seed: 5 });
    let guard = 0;
    while (trees.length < quality.trees * 3 && guard++ < 4000) {
        const x = 330 + rnd() * 420;
        const z = -260 + rnd() * 760;
        const h = landHeight(x, z);
        if (h < 6 || h > 150) continue;
        trees.push({ x, y: h - 0.4, z, scale: 1.5 + rnd() * 1.4, rot: rnd() * 6 });
    }
    scene.add(instanceKit(kit, trees, { castShadow: false }));

    // ---------- estuário ----------
    const ocean = createOcean({
        tier,
        wakes: 2,
        depthGLSL: DEPTH_GLSL,
        deep: 0x0e3640,       // mar aberto: azul-petróleo
        shallow: 0x55684c,    // G03: esverdeado/amarronzado junto ao cais
        scatter: 0x4a8a70,
        deepDepth: 12,
        swash: 0,
        surf: false,
        waveScale: 0.9
    });
    scene.add(ocean.mesh);

    return {
        sky,
        ocean,
        terrain,
        update(t, dt, camera) {
            sky.update(t, dt);
            ocean.update(t, camera, sky.daylight);
        }
    };
}
