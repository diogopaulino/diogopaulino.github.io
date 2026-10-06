/**
 * Mar aberto: ondas de Gerstner + reflexo do céu procedural.
 * Amplitude maior que o rio — é Atlântico, não canal.
 */

import * as THREE from 'three';
import { ORLA_LENGTH, ZONES } from './config.js';
import { SKY_GLSL, NOISE_GLSL } from './sky.js';

export const WAVES = [
    { dx: 0.15, dz: 0.99, amp: 0.55, len: 42, speed: 3.8, steep: 0.32 },
    { dx: -0.35, dz: 0.94, amp: 0.28, len: 22, speed: 4.4, steep: 0.28 },
    { dx: 0.55, dz: 0.83, amp: 0.14, len: 11, speed: 5.1, steep: 0.22 },
    { dx: -0.72, dz: 0.69, amp: 0.07, len: 6.2, speed: 3.2, steep: 0.18 }
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
    const width = ORLA_LENGTH + 80;
    const depth = ZONES.oceanFar - ZONES.sandOuter + 40;
    const segX = quality.waterSeg;
    const segZ = Math.max(24, (quality.waterSeg / 2) | 0);
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            ...skyUniforms,
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color(0x0a3a55) },
            uShallow: { value: new THREE.Color(0x2a8fb8) },
            uFoam: { value: new THREE.Color(0xe8f4fa) },
            uSandLine: { value: ZONES.sandOuter }
        },
        vertexShader: /* glsl */ `
            ${gerstnerGLSL()}
            uniform float uTime;
            varying vec3 vWorld;
            varying vec3 vNrm;
            varying float vFoam;
            void main() {
                vec3 disp; vec3 nrm;
                soGerstner(position.xz, uTime, disp, nrm);
                vec3 pos = position + disp;
                vWorld = (modelMatrix * vec4(pos, 1.0)).xyz;
                vNrm = normalize(mat3(modelMatrix) * nrm);
                vFoam = clamp(disp.y * 1.8 + 0.35, 0.0, 1.0);
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
                vec3 N = normalize(vNrm);
                vec3 V = normalize(cameraPosition - vWorld);
                vec3 R = reflect(-V, N);
                vec3 sky = soSky(normalize(R));
                float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
                float depthFade = smoothstep(uSandLine - 2.0, uSandLine + 35.0, vWorld.z);
                vec3 water = mix(uShallow, uDeep, depthFade);
                float sparkle = soFbm(vWorld.xz * 0.08 + uTime * 0.05);
                water += sparkle * 0.04;
                vec3 col = mix(water, sky, 0.28 + fres * 0.55);
                float shore = 1.0 - smoothstep(uSandLine - 1.5, uSandLine + 6.0, vWorld.z);
                col = mix(col, uFoam, shore * 0.55 * (0.5 + 0.5 * vFoam));
                col = mix(col, uFoam, vFoam * 0.12 * (1.0 - shore));
                float alpha = mix(0.92, 0.78, fres);
                gl_FragColor = vec4(col, alpha);
            }
        `
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.05, (ZONES.oceanFar + ZONES.sandOuter) * 0.5);
    mesh.renderOrder = 1;

    return {
        mesh,
        update(t) {
            mat.uniforms.uTime.value = t;
        }
    };
}
