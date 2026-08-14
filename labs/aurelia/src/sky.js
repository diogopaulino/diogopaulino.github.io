/**
 * Céu procedural com disco solar, halo e nuvens fBm.
 * A função `afSky(dir)` é reaproveitada pela água para o reflexo bater certo.
 */

import * as THREE from 'three';
import { SKIES } from './config.js';

export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunPower;
uniform float uTime;

float afHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float afNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = afHash(i);
    float b = afHash(i + vec2(1.0, 0.0));
    float c = afHash(i + vec2(0.0, 1.0));
    float d = afHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float afFbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * afNoise(p);
        p = p * 2.07 + 13.1;
        amp *= 0.5;
    }
    return v;
}

vec3 afSky(vec3 dir) {
    float h = dir.y;
    float t = clamp(h * 1.15 + 0.06, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(t, 0.58));
    col = mix(uGround, col, smoothstep(-0.12, 0.04, h));

    float sd = max(dot(normalize(dir), uSunDir), 0.0);
    col += uSunColor * pow(sd, 3.5) * 0.12;
    col += uSunColor * pow(sd, 48.0) * 0.38;
    col += uSunColor * pow(sd, 700.0) * 1.1;
    col += uSunColor * smoothstep(0.9992, 0.9998, sd) * uSunPower * 0.08;

    float cloud = afFbm(dir.xz * 1.8 + vec2(uTime * 0.006, 0.0));
    float mask = smoothstep(0.08, 0.45, h) * (1.0 - smoothstep(0.62, 0.95, h));
    col = mix(col, col + uSunColor * 0.18, cloud * mask * 0.35);

    return col;
}
`;

export function createSkyUniforms(skyId = 'golden') {
    const stop = SKIES[skyId] || SKIES.golden;
    return {
        uZenith: { value: new THREE.Color().fromArray(stop.zenith) },
        uHorizon: { value: new THREE.Color().fromArray(stop.horizon) },
        uGround: { value: new THREE.Color().fromArray(stop.ground) },
        uSunColor: { value: new THREE.Color().fromArray(stop.sun) },
        uSunDir: { value: new THREE.Vector3().fromArray(stop.sunDir).normalize() },
        uSunPower: { value: stop.sunPower },
        uTime: { value: 0 }
    };
}

export function applySky(uniforms, skyId) {
    const stop = SKIES[skyId] || SKIES.golden;
    uniforms.uZenith.value.fromArray(stop.zenith);
    uniforms.uHorizon.value.fromArray(stop.horizon);
    uniforms.uGround.value.fromArray(stop.ground);
    uniforms.uSunColor.value.fromArray(stop.sun);
    uniforms.uSunDir.value.fromArray(stop.sunDir).normalize();
    uniforms.uSunPower.value = stop.sunPower;
}

export function createSkyDome(uniforms) {
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
            ${SKY_GLSL}
            void main() {
                vec3 col = afSky(normalize(vPos));
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1800, 32, 20), mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return mesh;
}

export function createWater(uniforms) {
    const mat = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            ...uniforms,
            uWaterDeep: { value: new THREE.Color(0x0a3a4a) },
            uWaterShallow: { value: new THREE.Color(0x1a7a88) }
        },
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vView;
            varying vec3 vNormal;
            uniform float uTime;
            void main() {
                vec3 p = position;
                float w1 = sin(p.x * 0.018 + uTime * 0.55) * 0.35;
                float w2 = cos(p.z * 0.014 - uTime * 0.4) * 0.28;
                p.y += w1 + w2;
                vec4 world = modelMatrix * vec4(p, 1.0);
                vWorld = world.xyz;
                vNormal = normalize(mat3(modelMatrix) * normal);
                vec4 mv = viewMatrix * world;
                vView = -mv.xyz;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vView;
            varying vec3 vNormal;
            uniform vec3 uWaterDeep;
            uniform vec3 uWaterShallow;
            ${SKY_GLSL}
            void main() {
                vec3 N = normalize(vNormal);
                vec3 V = normalize(vView);
                vec3 R = reflect(-V, N);
                R.y = abs(R.y);
                vec3 sky = afSky(R);
                float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.2);
                vec3 water = mix(uWaterDeep, uWaterShallow, 0.35 + N.y * 0.2);
                vec3 col = mix(water, sky, 0.28 + fres * 0.55);
                float glitter = pow(max(dot(normalize(R), uSunDir), 0.0), 80.0);
                col += uSunColor * glitter * 0.55;
                gl_FragColor = vec4(col, 0.92);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(1600, 64), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.4;
    mesh.renderOrder = -1;
    return mesh;
}
