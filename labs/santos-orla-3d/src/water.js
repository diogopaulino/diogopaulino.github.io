/**
 * Mar aberto: ondas de Gerstner + micro-normais procedurais + brilho solar + espuma na arrebentação.
 */

import * as THREE from 'three';
import { ORLA_LENGTH, ZONES } from './config.js';
import { SKY_GLSL, NOISE_GLSL } from './sky.js';

export const WAVES = [
    { dx: 0.15, dz: 0.99, amp: 0.52, len: 44, speed: 3.6, steep: 0.34 },
    { dx: -0.32, dz: 0.95, amp: 0.26, len: 22, speed: 4.3, steep: 0.28 },
    { dx: 0.52, dz: 0.85, amp: 0.13, len: 11, speed: 5.0, steep: 0.22 },
    { dx: -0.70, dz: 0.71, amp: 0.06, len: 5.8, speed: 3.1, steep: 0.18 }
];

const TWO_PI = Math.PI * 2;

export function waterHeight(x, z, t) {
    let y = 0;
    for (const w of WAVES) {
        const k = TWO_PI / w.len;
        y += w.amp * Math.sin(k * (w.dx * x + w.dz * z) - w.speed * k * t);
    }
    return y;
}

function gerstnerGLSL() {
    let body = '';
    for (const w of WAVES) {
        const k = TWO_PI / w.len;
        const q = w.steep / (k * w.amp * WAVES.length);
        const num = (v) => {
            const s = Number(v).toFixed(6);
            return s.includes('.') ? s : `${s}.0`;
        };
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
    }`;
    }
    return /* glsl */ `
void soGerstner(vec2 p, float t, out vec3 disp, out vec3 nrm) {
    disp = vec3(0.0);
    nrm = vec3(0.0, 1.0, 0.0);
    ${body}
    nrm = normalize(nrm);
}
`;
}

export function createWater(skyUniforms, quality) {
    const width = ORLA_LENGTH + 520;
    const depth = ZONES.oceanFar - ZONES.sandOuter + 240;
    const segX = quality.waterSeg;
    const segZ = Math.max(36, (quality.waterSeg * 0.65) | 0);
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            ...skyUniforms,
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color(0x072c44) },
            uShallow: { value: new THREE.Color(0x1f8fa8) },
            uFoam: { value: new THREE.Color(0xf0f7fc) },
            uSandLine: { value: ZONES.sandOuter }
        },
        vertexShader: /* glsl */ `
            ${gerstnerGLSL()}
            uniform float uTime;
            uniform float uSandLine;
            varying vec3 vWorld;
            varying vec3 vNrm;
            varying float vFoam;
            void main() {
                vec3 disp; vec3 nrm;
                vec4 worldBase = modelMatrix * vec4(position, 1.0);
                // Amortece amplitude perto da areia para não atravessar o terreno
                float shoreDamp = smoothstep(uSandLine - 1.5, uSandLine + 14.0, worldBase.z);
                soGerstner(worldBase.xz, uTime, disp, nrm);
                disp *= mix(0.18, 1.0, shoreDamp);
                nrm = normalize(mix(vec3(0.0, 1.0, 0.0), nrm, mix(0.25, 1.0, shoreDamp)));
                vec3 pos = position + disp;
                vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
                vNrm = normalize(mat3(modelMatrix) * nrm);
                vFoam = clamp(disp.y * 1.9 + 0.35, 0.0, 1.0);
                gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            ${SKY_GLSL}
            ${NOISE_GLSL}
            uniform float uTime;
            uniform vec3 uDeep;
            uniform vec3 uShallow;
            uniform vec3 uFoam;
            uniform float uSandLine;
            varying vec3 vWorld;
            varying vec3 vNrm;
            varying float vFoam;

            void main() {
                // Micro-ondulações de alta frequência para brilho solar realista
                vec2 uv1 = vWorld.xz * 0.28 + vec2(uTime * 0.08, -uTime * 0.12);
                vec2 uv2 = vWorld.xz * 0.55 + vec2(-uTime * 0.11, uTime * 0.06);
                float r1 = soNoise(uv1) - 0.5;
                float r2 = soNoise(uv2) - 0.5;
                vec3 N = normalize(vNrm + vec3(r1 * 0.16 + r2 * 0.1, 0.0, r2 * 0.16 - r1 * 0.1));

                vec3 V = normalize(cameraPosition - vWorld);
                vec3 R = reflect(-V, N);
                vec3 sky = soSky(normalize(R));

                float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 4.2);
                float depthFade = smoothstep(uSandLine - 1.0, uSandLine + 42.0, vWorld.z);
                vec3 water = mix(uShallow, uDeep, depthFade);

                // Subsurface scatter esverdeado nas cristas de onda com o sol
                float sss = pow(max(dot(V, -uSunDir), 0.0), 3.0) * vFoam * 0.25;
                water += vec3(0.08, 0.32, 0.35) * sss * (1.0 - uNight * 0.9);

                vec3 col = mix(water, sky, clamp(fres * 0.85 + 0.14, 0.0, 0.92));

                // Brilho especular do sol/lua na água
                float spec = pow(max(dot(R, uSunDir), 0.0), 260.0);
                float glitter = pow(max(dot(R, uSunDir), 0.0), 42.0) * (0.3 + soNoise(vWorld.xz * 0.9 + uTime * 0.45) * 0.45);
                col += uSunColor * (spec * 1.1 + glitter * 0.09) * (1.0 - uNight * 0.72);

                // Linhas de arrebentação animadas na praia
                float shoreDist = vWorld.z - uSandLine;
                float surfWave = sin(shoreDist * 0.75 - uTime * 2.1 + soNoise(vWorld.xz * 0.12) * 3.0);
                float surfMask = (1.0 - smoothstep(-1.0, 11.0, shoreDist)) * smoothstep(0.25, 0.88, surfWave);
                float shoreEdge = 1.0 - smoothstep(-0.8, 2.2, shoreDist);
                float foamNoise = soFbm(vWorld.xz * 0.45 + uTime * 0.15);
                float foamTotal = clamp(shoreEdge * 0.75 + surfMask * (0.42 + foamNoise * 0.5), 0.0, 1.0);
                col = mix(col, uFoam * (1.0 - uNight * 0.55), foamTotal * 0.78);

                // Espuma sutil nas cristas em mar aberto
                col = mix(col, uFoam * (1.0 - uNight * 0.5), smoothstep(0.72, 0.98, vFoam) * foamNoise * 0.25);

                float alpha = mix(0.95, 0.68, shoreEdge);
                gl_FragColor = vec4(col, alpha);
            }
        `
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.06, ZONES.sandOuter + depth * 0.5 - 10);
    mesh.renderOrder = 1;

    return {
        mesh,
        update(t) {
            mat.uniforms.uTime.value = t;
        }
    };
}
