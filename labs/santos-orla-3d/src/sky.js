/**
 * Céu procedural + sol/lua. Uniforms compartilhados com a água para reflexo coerente.
 */

import * as THREE from 'three';
import { DAY_STOPS } from './config.js';
import { clamp, lerp } from './utils.js';

export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunPower;
uniform float uNight;

vec3 soSky(vec3 dir) {
    float h = dir.y;
    float t = clamp(h * 1.2 + 0.08, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(t, 0.65));
    col = mix(uGround, col, smoothstep(-0.08, 0.04, h));

    float sd = max(dot(normalize(dir), uSunDir), 0.0);
    col += uSunColor * pow(sd, 4.0) * 0.1;
    col += uSunColor * pow(sd, 48.0) * 0.28;
    col += uSunColor * pow(sd, 700.0) * 0.85;
    col += uSunColor * smoothstep(0.9992, 0.9998, sd) * uSunPower;

    // Estrelas sutis à noite
    if (uNight > 0.4) {
        float star = step(0.997, fract(sin(dot(dir.xz * 40.0, vec2(12.9898, 78.233))) * 43758.5453));
        col += vec3(0.85, 0.9, 1.0) * star * (uNight - 0.4) * 1.4;
    }
    return col;
}
`;

const NOISE_GLSL = /* glsl */ `
float soHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float soNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = soHash(i);
    float b = soHash(i + vec2(1.0, 0.0));
    float c = soHash(i + vec2(0.0, 1.0));
    float d = soHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float soFbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 4; i++) {
        v += amp * soNoise(p);
        p = p * 2.05 + 13.7;
        amp *= 0.5;
    }
    return v;
}
`;

export { NOISE_GLSL };

export function createSkyUniforms() {
    const stop = DAY_STOPS[1];
    return {
        uZenith: { value: new THREE.Color().fromArray(stop.zenith) },
        uHorizon: { value: new THREE.Color().fromArray(stop.horizon) },
        uGround: { value: new THREE.Color().fromArray(stop.ground) },
        uSunColor: { value: new THREE.Color().fromArray(stop.sun) },
        uSunDir: { value: new THREE.Vector3().fromArray(stop.sunDir).normalize() },
        uSunPower: { value: 18 },
        uNight: { value: 0 }
    };
}

export function createSky(skyUniforms) {
    const geo = new THREE.SphereGeometry(480, 32, 20);
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            ...skyUniforms,
            uTime: { value: 0 }
        },
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = normalize(position);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            ${SKY_GLSL}
            ${NOISE_GLSL}
            varying vec3 vDir;
            uniform float uTime;
            void main() {
                vec3 dir = normalize(vDir);
                vec3 col = soSky(dir);
                float cloud = soFbm(dir.xz * 2.4 + vec2(uTime * 0.012, 0.0));
                float mask = smoothstep(0.12, 0.55, dir.y) * (1.0 - uNight * 0.85);
                col = mix(col, col * 0.92 + vec3(0.9, 0.92, 0.95) * 0.08, cloud * mask * 0.55);
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10;
    return {
        mesh,
        update(t) {
            mat.uniforms.uTime.value = t;
        }
    };
}

export function applyDayStop(uniforms, lights, fog, stop, renderer) {
    uniforms.uZenith.value.fromArray(stop.zenith);
    uniforms.uHorizon.value.fromArray(stop.horizon);
    uniforms.uGround.value.fromArray(stop.ground);
    uniforms.uSunColor.value.fromArray(stop.sun);
    uniforms.uSunDir.value.fromArray(stop.sunDir).normalize();
    uniforms.uNight.value = stop.id === 'night' ? 1 : stop.id === 'dawn' || stop.id === 'golden' ? 0.15 : 0;
    uniforms.uSunPower.value = stop.id === 'night' ? 6 : 18;

    if (lights?.sun) {
        lights.sun.position.copy(uniforms.uSunDir.value).multiplyScalar(120);
        lights.sun.color.fromArray(stop.sun);
        lights.sun.intensity = stop.id === 'night' ? 0.35 : stop.id === 'day' ? 2.2 : 1.6;
    }
    if (lights?.hemi) {
        lights.hemi.color.fromArray(stop.zenith);
        lights.hemi.groundColor.fromArray(stop.ground);
        lights.hemi.intensity = stop.id === 'night' ? 0.25 : 0.55;
    }
    if (fog) fog.color.fromArray(stop.fog);
    if (renderer) renderer.toneMappingExposure = stop.exposure;
}

export function blendStops(a, b, t) {
    const out = {
        id: t < 0.5 ? a.id : b.id,
        label: t < 0.5 ? a.label : b.label,
        zenith: a.zenith.map((v, i) => lerp(v, b.zenith[i], t)),
        horizon: a.horizon.map((v, i) => lerp(v, b.horizon[i], t)),
        ground: a.ground.map((v, i) => lerp(v, b.ground[i], t)),
        sun: a.sun.map((v, i) => lerp(v, b.sun[i], t)),
        sunDir: a.sunDir.map((v, i) => lerp(v, b.sunDir[i], t)),
        fog: a.fog.map((v, i) => lerp(v, b.fog[i], t)),
        exposure: lerp(a.exposure, b.exposure, t)
    };
    return out;
}

export function stopIndexForHour(hour) {
    if (hour < 7) return 0;
    if (hour < 16) return 1;
    if (hour < 19) return 2;
    return 3;
}

export function pickStop(index) {
    return DAY_STOPS[clamp(index | 0, 0, DAY_STOPS.length - 1)];
}
