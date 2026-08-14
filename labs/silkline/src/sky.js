/**
 * Céu noturno de Manhattan: poluição luminosa no horizonte, estrelas e lua.
 */

import * as THREE from 'three';
import { PALETTE } from './config.js';

export function createSky() {
    const uniforms = {
        uHorizon: { value: new THREE.Color(PALETTE.horizon) },
        uZenith: { value: new THREE.Color(PALETTE.zenith) },
        uGround: { value: new THREE.Color(PALETTE.ground) }
    };
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms,
        vertexShader: /* glsl */ `
            varying vec3 vPos;
            void main() {
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vPos;
            uniform vec3 uHorizon;
            uniform vec3 uZenith;
            uniform vec3 uGround;
            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
            }
            void main() {
                vec3 n = normalize(vPos);
                float h = n.y;
                vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
                col = mix(uGround, col, smoothstep(-0.18, 0.06, h));
                float glow = exp(-pow((h - 0.02) * 7.5, 2.0));
                col += uHorizon * glow * 0.55;
                col += vec3(0.55, 0.22, 0.08) * exp(-pow((h - 0.08) * 4.0, 2.0)) * 0.22;

                float stars = step(0.992, hash(floor(n.xz * 80.0))) * smoothstep(0.15, 0.45, h);
                col += vec3(0.85, 0.9, 1.0) * stars * 0.65;

                float moon = exp(-pow(length(n - normalize(vec3(-0.35, 0.62, 0.4))) * 28.0, 2.0));
                col += vec3(0.85, 0.9, 1.0) * moon * 1.4;
                col += vec3(0.55, 0.65, 0.95) * exp(-pow(length(n - normalize(vec3(-0.35, 0.62, 0.4))) * 8.0, 2.0)) * 0.25;

                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1400, 28, 18), mat);
    mesh.frustumCulled = false;
    return { mesh, uniforms };
}

/**
 * Fachada com UV em espaço-mundo: janelas do tamanho certo em qualquer
 * arranha-céu instanciado. Telhado sem janela; néon nas arestas.
 */
export function createFacadeMaterial(windowTex, fogColor, fogDensity) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uWindows: { value: windowTex },
            uFog: { value: new THREE.Color(fogColor) },
            uFogDensity: { value: fogDensity },
            uTint: { value: new THREE.Color(0x141820) },
            uWarm: { value: new THREE.Color(0xffc48a) }
        },
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vNormal;
            varying vec3 vView;
            varying vec3 vColor;
            void main() {
                #ifdef USE_INSTANCING
                    mat4 local = instanceMatrix;
                #else
                    mat4 local = mat4(1.0);
                #endif
                vec4 world = modelMatrix * local * vec4(position, 1.0);
                vWorld = world.xyz;
                vNormal = normalize(mat3(modelMatrix * local) * normal);
                vec4 mv = viewMatrix * world;
                vView = -mv.xyz;
                #ifdef USE_INSTANCING_COLOR
                    vColor = instanceColor;
                #else
                    vColor = vec3(1.0);
                #endif
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vNormal;
            varying vec3 vView;
            varying vec3 vColor;
            uniform sampler2D uWindows;
            uniform vec3 uFog;
            uniform float uFogDensity;
            uniform vec3 uTint;
            uniform vec3 uWarm;
            void main() {
                vec3 n = normalize(vNormal);
                vec2 uv;
                if (abs(n.x) > abs(n.z)) uv = vec2(vWorld.z, vWorld.y);
                else uv = vec2(vWorld.x, vWorld.y);
                uv *= vec2(0.085, 0.095);
                vec3 win = texture2D(uWindows, uv).rgb;
                float roof = smoothstep(0.42, 0.78, abs(n.y));
                vec3 col = mix(uTint * vColor, win * 1.35, 0.85);
                col = mix(col, vec3(0.07, 0.08, 0.1), roof);
                float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 2.6);
                col += uWarm * rim * 0.12 * (1.0 - roof);
                float lit = 0.45 + 0.7 * max(dot(n, normalize(vec3(-0.35, 0.7, 0.25))), 0.0);
                col *= mix(lit, 1.0, 0.55);
                float dist = length(vView);
                float fogAmt = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
                col = mix(col, uFog, clamp(fogAmt, 0.0, 1.0));
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
}

export function createGroundShader(asphaltMap, fogColor, fogDensity) {
    const uniforms = {
        uMap: { value: asphaltMap },
        uFog: { value: new THREE.Color(fogColor) },
        uFogDensity: { value: fogDensity },
        uWet: { value: 0.78 },
        uTime: { value: 0 }
    };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        lights: false,
        fog: false,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vView;
            varying vec2 vUv;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                vUv = uv;
                vec4 mv = viewMatrix * world;
                vView = -mv.xyz;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vView;
            varying vec2 vUv;
            uniform sampler2D uMap;
            uniform vec3 uFog;
            uniform float uFogDensity;
            uniform float uWet;
            uniform float uTime;
            void main() {
                vec3 col = texture2D(uMap, vUv * vec2(1.0, 1.6)).rgb;
                float x = vWorld.x;
                float z = vWorld.z;
                float curb = smoothstep(8.2, 9.1, abs(mod(x + 22.0, 44.0) - 22.0));
                col = mix(col, vec3(0.18, 0.17, 0.16), curb * 0.45);

                vec3 V = normalize(vView);
                float fres = pow(1.0 - max(V.y, 0.0), 3.4);
                vec3 spec = mix(vec3(0.55, 0.28, 0.12), vec3(0.35, 0.45, 0.7), 0.45);
                col = mix(col, spec, fres * uWet * 0.55);

                float streak = fract(z * 0.08 + uTime * 0.15);
                col += vec3(1.0, 0.85, 0.4) * step(0.97, streak) * 0.08 * uWet;

                float dist = length(vView);
                float fogAmt = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
                col = mix(col, uFog, clamp(fogAmt, 0.0, 1.0));
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    return mat;
}
