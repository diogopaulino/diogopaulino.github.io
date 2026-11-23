/**
 * Água: ondas de Gerstner na GPU + reflexo do céu do palco (IBL).
 *
 * As mesmas ondas são avaliadas na CPU (`waterHeight`) para que o barco, os
 * destroços e a espuma acompanhem exatamente a superfície desenhada.
 */

import * as THREE from 'three';
import { buildRadialGrid } from './utils.js?v=60';
import { RIVER_GLSL } from './river.js?v=60';
import { GLSL_NOISE } from '../../shared/gfx/core.js';

/**
 * Conjunto de ondas: direção (normalizada), amplitude, comprimento, velocidade.
 * Amplitudes pequenas — é um rio, não mar aberto.
 */
export const WAVES = [
    { dx: 0.86, dz: 0.51, amp: 0.22, len: 31, speed: 4.6, steep: 0.45 },
    { dx: -0.42, dz: 0.91, amp: 0.135, len: 17, speed: 3.7, steep: 0.4 },
    { dx: 0.24, dz: -0.97, amp: 0.075, len: 9.5, speed: 3.0, steep: 0.32 },
    { dx: -0.93, dz: -0.37, amp: 0.042, len: 5.4, speed: 2.4, steep: 0.26 }
];

const TWO_PI = Math.PI * 2;

/** Altura da superfície em (x, z) no instante `t`. */
export function waterHeight(x, z, t) {
    let y = 0;
    for (let i = 0; i < WAVES.length; i++) {
        const w = WAVES[i];
        const k = TWO_PI / w.len;
        const phase = k * (w.dx * x + w.dz * z) - w.speed * k * t;
        y += w.amp * Math.sin(phase);
    }
    return y;
}

/** Inclinação aproximada da superfície — usada para balançar os barcos. */
export function waterSlope(x, z, t, out = { dx: 0, dz: 0 }) {
    let sx = 0;
    let sz = 0;
    for (let i = 0; i < WAVES.length; i++) {
        const w = WAVES[i];
        const k = TWO_PI / w.len;
        const phase = k * (w.dx * x + w.dz * z) - w.speed * k * t;
        const c = Math.cos(phase) * w.amp * k;
        sx += c * w.dx;
        sz += c * w.dz;
    }
    out.dx = sx;
    out.dz = sz;
    return out;
}

const num = (v) => {
    const s = Number(v).toFixed(6);
    return s.includes('.') ? s : `${s}.0`;
};

/** Gera o trecho GLSL das ondas já desenrolado (evita índices dinâmicos). */
function gerstnerGLSL() {
    let body = '';
    for (const w of WAVES) {
        const k = TWO_PI / w.len;
        const q = w.steep / (k * w.amp * WAVES.length);
        body += `
    {
        vec2 dir = vec2(${num(w.dx)}, ${num(w.dz)});
        float k = ${num(k)};
        float a = ${num(w.amp)};
        float q = ${num(q)};
        float f = k * dot(dir, p) - ${num(w.speed * k)} * t;
        float c = cos(f);
        float s = sin(f);
        disp.x += q * a * dir.x * c;
        disp.z += q * a * dir.y * c;
        disp.y += a * s;
        nrm.x -= dir.x * k * a * c;
        nrm.z -= dir.y * k * a * c;
        nrm.y -= q * k * a * s;
        phase += s;
    }`;
    }

    return /* glsl */ `
void rkGerstner(vec2 p, float t, out vec3 disp, out vec3 nrm, out float phase) {
    disp = vec3(0.0);
    nrm = vec3(0.0, 1.0, 0.0);
    phase = 0.0;
    ${body}
    nrm = normalize(nrm);
}
`;
}

/**
 * Superfície do rio: `MeshStandardMaterial` estendido — reflete o céu do palco
 * (IBL), recebe o sol com especular e as sombras das margens e dos navios, e
 * entra na névoa/pós como qualquer objeto.
 *
 *   malha      radial que segue a câmera; deslocamento Gerstner em coordenadas de mundo
 *   normal     Gerstner + três oitavas de marola que escorrem rio abaixo (−Z)
 *   cor        mix(raso, fundo, (profundidade/5)²) — profundidade vem de `rkHeight`
 *   margens    perto da margem o reflexo do céu dá lugar ao "reflexo" escuro da
 *              mata/falésia:  envMap ×= mix(0,35; 1; smoothstep(−16 m → −2 m da borda))
 *              (aproximação: não há reflexo planar de verdade)
 *   espuma     faixa junto à linha d'água + línguas de correnteza + cristas,
 *              recortadas por fbm que escorre com o fluxo
 */
export function createWater(quality) {
    const low = quality.id === 'low';
    const geometry = buildRadialGrid(low ? 96 : 160, quality.waterSegments, 2300, 1.0);
    const uniforms = { uTime: { value: 0 } };

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.06,
        metalness: 0.0,
        envMapIntensity: 1.15
    });

    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = uniforms.uTime;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', /* glsl */ `
                #include <common>
                uniform float uTime;
                varying vec3 vRkWorld;
                varying vec3 vRkNormal;
                varying float vRkPhase;
                ${gerstnerGLSL()}
            `)
            .replace('#include <beginnormal_vertex>', /* glsl */ `
                vec3 rkW = (modelMatrix * vec4(position, 1.0)).xyz;
                vec3 rkDisp;
                vec3 rkNrm;
                float rkPhase;
                rkGerstner(rkW.xz, uTime, rkDisp, rkNrm, rkPhase);
                // Ondas encolhem à distância para evitar aliasing na malha esparsa.
                float rkFade = 1.0 - smoothstep(120.0, 620.0, length(rkW.xz - cameraPosition.xz));
                rkW += rkDisp * mix(0.25, 1.0, rkFade);
                vec3 objectNormal = normalize(mix(vec3(0.0, 1.0, 0.0), rkNrm, mix(0.2, 1.0, rkFade)));
                vRkNormal = objectNormal;
                vRkWorld = rkW;
                vRkPhase = rkPhase;
            `)
            .replace('#include <begin_vertex>', /* glsl */ `
                vec3 transformed = rkW - vec3(modelMatrix[3].x, 0.0, modelMatrix[3].z);
            `);

        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', /* glsl */ `
                #include <common>
                uniform float uTime;
                varying vec3 vRkWorld;
                varying vec3 vRkNormal;
                varying float vRkPhase;
                ${RIVER_GLSL}
                ${GLSL_NOISE}
                vec3 rkWaterN = vec3(0.0, 1.0, 0.0);
                float rkFoam = 0.0;
                float rkBankRefl = 1.0;
            `)
            .replace('#include <color_fragment>', /* glsl */ `
                #include <color_fragment>
                {
                    vec2 rp = vRkWorld.xz;
                    float dist = length(vRkWorld - cameraPosition);
                    // marolas: escorrem em −Z (rio abaixo) com velocidades diferentes
                    vec2 flow = vec2(0.0, uTime);
                    float e = 0.18;
                    #define RK_RIP(q) (gfxNoise((q) * 0.9 + flow * 0.55) * 0.5 + gfxNoise((q) * 2.3 + flow * vec2(0.3, 0.95) + 3.1) * 0.3 + gfxNoise((q) * 5.1 + flow * 1.4) * 0.2)
                    float r0 = RK_RIP(rp);
                    float rx = RK_RIP(rp + vec2(e, 0.0));
                    float rz = RK_RIP(rp + vec2(0.0, e));
                    float detail = 1.0 - smoothstep(40.0, 260.0, dist);
                    rkWaterN = normalize(normalize(vRkNormal) + vec3(r0 - rx, 0.0, r0 - rz) * (0.55 * detail + 0.1));

                    float bed = rkHeight(rp.x, rp.y);
                    float depth = clamp(-bed / 5.0, 0.0, 1.0);
                    vec3 shallow = vec3(0.085, 0.16, 0.12);
                    vec3 deep = vec3(0.012, 0.035, 0.042);
                    vec3 body = mix(shallow, deep, depth * depth);
                    // luz atravessando a crista (subsuperfície falsa)
                    body += vec3(0.03, 0.07, 0.05) * smoothstep(0.6, 1.9, vRkPhase) * (1.0 - depth * 0.6);

                    float shore = rkShoreDist(rp.x, rp.y);
                    rkBankRefl = mix(0.35, 1.0, smoothstep(-2.0, -16.0, shore));

                    float ftex = gfxFbm(rp * vec2(0.55, 0.3) + flow * vec2(0.02, 0.5));
                    float band = smoothstep(-3.2, -0.2, shore);
                    float tongue = smoothstep(0.55, 0.85, gfxNoise(vec2(rp.x * 0.09, rp.y * 0.022 + uTime * 0.16)));
                    float crest = smoothstep(1.2, 2.2, vRkPhase);
                    rkFoam = clamp(band * 1.25 + tongue * 0.3 * (1.0 - depth * 0.5) + crest * 0.2, 0.0, 1.0)
                        * smoothstep(0.46, 0.68, ftex + band * 0.14);
                    rkFoam *= 1.0 - smoothstep(300.0, 700.0, dist);
                    diffuseColor.rgb = mix(body, vec3(0.86, 0.9, 0.9), rkFoam);
                }
            `)
            .replace('#include <roughnessmap_fragment>', /* glsl */ `
                #include <roughnessmap_fragment>
                roughnessFactor = mix(0.07, 0.7, rkFoam);
            `)
            .replace('#include <normal_fragment_maps>', /* glsl */ `
                #include <normal_fragment_maps>
                normal = normalize((viewMatrix * vec4(rkWaterN, 0.0)).xyz);
            `)
            .replace('#include <lights_fragment_end>', /* glsl */ `
                #include <lights_fragment_end>
                // "reflexo" das margens: perto da borda o céu refletido escurece
                reflectedLight.indirectSpecular *= rkBankRefl;
            `);
    };
    material.customProgramCacheKey = () => 'river-knight-water';

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.name = 'water';
    mesh.receiveShadow = true;

    return {
        mesh,
        material,
        uniforms,
        update(time, camera) {
            uniforms.uTime.value = time;
            mesh.position.set(camera.position.x, 0, camera.position.z);
        }
    };
}
