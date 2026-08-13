/**
 * Água: ondas de Gerstner na GPU + reflexo do céu procedural.
 *
 * As mesmas ondas são avaliadas na CPU (`waterHeight`) para que o barco, os
 * destroços e a espuma acompanhem exatamente a superfície desenhada.
 */

import * as THREE from 'three';
import { buildRadialGrid } from './utils.js';
import { RIVER_GLSL } from './river.js';
import { SKY_GLSL, NOISE_GLSL } from './sky.js?v=14';
import { foamTexture } from './textures.js?v=14';

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

export function createWater(skyUniforms, quality) {
    const geometry = buildRadialGrid(
        quality.id === 'low' ? 96 : 152,
        quality.waterSegments,
        2300,
        1.1
    );

    const uniforms = {
        ...skyUniforms,
        uTime: { value: 0 },
        uFoam: { value: foamTexture() },
        uFogColor: { value: new THREE.Color(0.7, 0.7, 0.75) },
        uFogDensity: { value: quality.fogDensity },
        uShallow: { value: new THREE.Color(0.18, 0.42, 0.34) },
        uDeep: { value: new THREE.Color(0.02, 0.07, 0.10) }
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        fog: false,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vWaveNormal;
            varying float vPhase;
            uniform float uTime;
            ${gerstnerGLSL()}

            void main() {
                vec3 world = (modelMatrix * vec4(position, 1.0)).xyz;
                vec3 disp;
                vec3 nrm;
                float phase;
                rkGerstner(world.xz, uTime, disp, nrm, phase);

                // Ondas encolhem à distância para evitar aliasing na malha esparsa.
                float fade = 1.0 - smoothstep(120.0, 620.0, length(world.xz - cameraPosition.xz));
                world += disp * mix(0.25, 1.0, fade);

                vWorld = world;
                vWaveNormal = normalize(mix(vec3(0.0, 1.0, 0.0), nrm, mix(0.2, 1.0, fade)));
                vPhase = phase;

                gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vWaveNormal;
            varying float vPhase;

            uniform float uTime;
            uniform sampler2D uFoam;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            uniform vec3 uShallow;
            uniform vec3 uDeep;

            ${SKY_GLSL}
            ${RIVER_GLSL}
            ${NOISE_GLSL}

            void main() {
                vec3 N = normalize(vWaveNormal);

                // Marolas de alta frequência (detalhe que a malha não resolve).
                vec2 rp = vWorld.xz;
                float r1 = rkValueNoise(rp * 1.15 + vec2(uTime * 0.30, -uTime * 0.22)) - 0.5;
                float r2 = rkValueNoise(rp * 2.60 + vec2(-uTime * 0.42, uTime * 0.36)) - 0.5;
                float r3 = rkValueNoise(rp * 5.30 + vec2(uTime * 0.55, uTime * 0.48)) - 0.5;
                float detailFade = 1.0 - smoothstep(30.0, 180.0, length(vWorld.xz - cameraPosition.xz));
                N = normalize(N + vec3(
                    (r1 * 0.085 + r2 * 0.05 + r3 * 0.03) * detailFade,
                    0.0,
                    (r1 * 0.075 - r2 * 0.055 + r3 * 0.03) * detailFade
                ));

                vec3 V = normalize(cameraPosition - vWorld);
                float ndv = clamp(dot(N, V), 0.0, 1.0);
                float fres = 0.022 + 0.978 * pow(1.0 - ndv, 5.0);

                vec3 R = reflect(-V, N);
                R.y = abs(R.y) + 0.008;
                // Água não é espelho perfeito: o reflexo perde energia e ganha
                // difusão conforme a distância (microrrugosidade da superfície).
                vec3 refl = rkSky(R) * 0.82;
                float blur = smoothstep(60.0, 500.0, length(vWorld.xz - cameraPosition.xz));
                refl = mix(refl, rkSky(normalize(vec3(R.x, R.y + 0.35, R.z))) * 0.78, blur * 0.6);

                // Corpo d'água: quanto mais fundo, mais escuro e frio.
                float bed = rkHeight(vWorld.x, vWorld.z);
                float depth = clamp(-bed / 5.0, 0.0, 1.0);
                vec3 body = mix(uShallow, uDeep, depth * depth);
                float sunLit = clamp(dot(N, uSunDir) * 0.5 + 0.6, 0.0, 1.2);
                body *= sunLit;
                body += uSunColor * 0.06 * (1.0 - depth);
                // Luz atravessando a crista da onda (subsurface fake).
                body += uSunColor * uShallow * smoothstep(0.6, 1.9, vPhase) * 0.10 * (1.0 - depth * 0.65);

                // Cáusticos baratos no raso — o leito do rio "pisca" com o sol.
                float caust = rkValueNoise(rp * 1.85 + vec2(uTime * 0.18, -uTime * 0.14));
                caust *= rkValueNoise(rp * 3.4 + vec2(-uTime * 0.11, uTime * 0.16));
                body += uSunColor * caust * (1.0 - depth) * 0.16;

                vec3 col = mix(body, refl, fres * 0.88);

                // Brilho especular do sol (rio, não oceano).
                vec3 H = normalize(V + uSunDir);
                float spec = pow(max(dot(N, H), 0.0), 96.0);
                float sparkle = pow(max(dot(N, H), 0.0), 48.0) *
                    smoothstep(0.62, 1.0, rkValueNoise(rp * 2.4 + uTime * 0.45));
                col += uSunColor * (spec * 0.85 + sparkle * 0.14);

                // Espuma junto às margens e nas cristas mais altas.
                float shore = rkShoreDist(vWorld.x, vWorld.z);
                // smoothstep exige edge0 < edge1 (fora disso o resultado é indefinido em GLSL).
                float band = smoothstep(-12.5, -2.8, shore) * (1.0 - smoothstep(-2.0, 1.4, shore));
                float crest = smoothstep(1.15, 2.15, vPhase);
                vec2 fuv = vWorld.xz * 0.038 + vec2(uTime * 0.004, uTime * 0.07);
                float ftex = texture2D(uFoam, fuv).a;
                float current = smoothstep(0.35, 0.85, rkValueNoise(vec2(vWorld.x * 0.08, vWorld.z * 0.025 + uTime * 0.12)));
                float foam = clamp(band * 1.15 + crest * 0.18 + current * 0.12 * (1.0 - depth), 0.0, 1.0)
                    * smoothstep(0.08, 0.55, ftex);
                col = mix(col, vec3(0.88, 0.94, 0.96), clamp(foam, 0.0, 1.0) * 0.72);

                // Névoa exponencial casada com o céu.
                float dist = length(cameraPosition - vWorld);
                float fogAmt = 1.0 - exp(-pow(dist * uFogDensity, 2.0));
                col = mix(col, uFogColor, clamp(fogAmt, 0.0, 1.0));

                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    mesh.name = 'water';
    mesh.receiveShadow = false;

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
