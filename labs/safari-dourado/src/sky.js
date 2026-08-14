/**
 * Céu da hora dourada: gradiente, disco solar, halo e nuvens em fBm.
 * O mesmo `sfSky(dir)` é reusado pela água para o reflexo coincidir.
 */

import * as THREE from 'three';
import { SKY_STOPS } from './config.js';

export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uSunPower;

vec3 sfSky(vec3 dir) {
    float h = dir.y;
    float t = clamp(h * 1.15 + 0.08, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(t, 0.55));
    col = mix(uGround, col, smoothstep(-0.12, 0.04, h));

    float sd = max(dot(normalize(dir), uSunDir), 0.0);
    col += uSunColor * pow(sd, 3.0) * 0.18;
    col += uSunColor * pow(sd, 28.0) * 0.45;
    col += uSunColor * pow(sd, 220.0) * 0.85;
    col += uSunColor * smoothstep(0.9992, 0.99982, sd) * uSunPower;
    return col;
}
`;

export const NOISE_GLSL = /* glsl */ `
float sfHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float sfValueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = sfHash(i);
    float b = sfHash(i + vec2(1.0, 0.0));
    float c = sfHash(i + vec2(0.0, 1.0));
    float d = sfHash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float sfFbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 5; i++) {
        v += amp * sfValueNoise(p);
        p = p * 2.03 + 17.3;
        amp *= 0.5;
    }
    return v;
}
`;

export function createSkyUniforms() {
    const stop = SKY_STOPS[0];
    return {
        uZenith: { value: new THREE.Color().fromArray(stop.zenith) },
        uHorizon: { value: new THREE.Color().fromArray(stop.horizon) },
        uGround: { value: new THREE.Color().fromArray(stop.ground) },
        uSunColor: { value: new THREE.Color().fromArray(stop.sun) },
        uSunDir: { value: new THREE.Vector3().fromArray(stop.sunDir).normalize() },
        uSunPower: { value: 26 }
    };
}

const tmpA = new THREE.Color();
const tmpB = new THREE.Color();
const tmpVA = new THREE.Vector3();
const tmpVB = new THREE.Vector3();

const paletteOut = {
    zenith: new THREE.Color(),
    horizon: new THREE.Color(),
    ground: new THREE.Color(),
    sun: new THREE.Color(),
    fog: new THREE.Color(),
    light: new THREE.Color(),
    ambient: new THREE.Color(),
    sunDir: new THREE.Vector3(),
    lightIntensity: 2
};

export function sampleSkyPalette(progress) {
    const p = Math.max(0, Math.min(1, progress));
    let a = SKY_STOPS[0];
    let b = SKY_STOPS[SKY_STOPS.length - 1];
    for (let i = 0; i < SKY_STOPS.length - 1; i++) {
        if (p >= SKY_STOPS[i].at && p <= SKY_STOPS[i + 1].at) {
            a = SKY_STOPS[i];
            b = SKY_STOPS[i + 1];
            break;
        }
    }
    const t = Math.max(0, Math.min(1, (p - a.at) / Math.max(1e-5, b.at - a.at)));
    const lerpColor = (key, out) => {
        tmpA.fromArray(a[key]);
        tmpB.fromArray(b[key]);
        out.copy(tmpA).lerp(tmpB, t);
    };
    lerpColor('zenith', paletteOut.zenith);
    lerpColor('horizon', paletteOut.horizon);
    lerpColor('ground', paletteOut.ground);
    lerpColor('sun', paletteOut.sun);
    lerpColor('fog', paletteOut.fog);
    lerpColor('light', paletteOut.light);
    lerpColor('ambient', paletteOut.ambient);
    tmpVA.fromArray(a.sunDir);
    tmpVB.fromArray(b.sunDir);
    paletteOut.sunDir.copy(tmpVA).lerp(tmpVB, t).normalize();
    paletteOut.lightIntensity = a.lightIntensity + (b.lightIntensity - a.lightIntensity) * t;
    return paletteOut;
}

export function applySkyPalette(uniforms, palette) {
    uniforms.uZenith.value.copy(palette.zenith);
    uniforms.uHorizon.value.copy(palette.horizon);
    uniforms.uGround.value.copy(palette.ground);
    uniforms.uSunColor.value.copy(palette.sun);
    uniforms.uSunDir.value.copy(palette.sunDir);
}

export function createSky(uniforms) {
    const material = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
            ...uniforms,
            uTime: { value: 0 },
            uCloud: { value: 0.48 }
        },
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = position;
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * mvPosition;
                gl_Position.z = gl_Position.w;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vDir;
            uniform float uTime;
            uniform float uCloud;
            ${SKY_GLSL}
            ${NOISE_GLSL}
            void main() {
                vec3 dir = normalize(vDir);
                vec3 col = sfSky(dir);

                float up = max(dir.y, 0.02);
                vec2 cp = dir.xz / up;
                vec2 drift = vec2(uTime * 0.0048, uTime * 0.0016);
                float clouds = sfFbm(cp * 0.42 + drift);
                float wisps = sfFbm(cp * 1.05 + drift * 1.3 + 9.1);
                clouds = smoothstep(0.42, 0.90, clouds) * uCloud;
                clouds += smoothstep(0.58, 0.96, wisps) * uCloud * 0.32;
                clouds *= smoothstep(0.0, 0.16, dir.y);
                clouds = clamp(clouds, 0.0, 1.0);

                float sunFacing = max(dot(dir, uSunDir), 0.0);
                vec3 cloudLit = mix(uHorizon * 0.9, uSunColor, pow(sunFacing, 1.6) * 0.85);
                vec3 cloudShadow = mix(uZenith * 0.65, uHorizon * 0.4, 0.45);
                vec3 cloudCol = mix(cloudShadow, cloudLit, clamp(clouds * 1.5, 0.0, 1.0));
                col = mix(col, cloudCol, clouds * 0.82);

                float night = clamp(1.0 - length(uHorizon) * 0.85, 0.0, 1.0);
                float stars = step(0.9978, sfHash(floor(dir.xz * 380.0 / max(dir.y, 0.22))));
                col += vec3(1.0, 0.92, 0.78) * stars * night * smoothstep(0.12, 0.55, dir.y);

                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), material);
    mesh.scale.setScalar(3800);
    mesh.frustumCulled = false;
    mesh.renderOrder = -1000;
    mesh.name = 'sky';
    return mesh;
}

export function createLights(scene, quality) {
    const group = new THREE.Group();
    scene.add(group);

    const amb = new THREE.AmbientLight(0xc8a070, 0.42);
    group.add(amb);

    const hemi = new THREE.HemisphereLight(0xffd8a0, 0x6a4428, 0.85);
    group.add(hemi);

    const dir = new THREE.DirectionalLight(0xffe0a0, 2.05);
    dir.position.set(80, 42, -64);
    dir.castShadow = quality.shadows;
    if (quality.shadows) {
        dir.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
        const s = 72;
        dir.shadow.camera.left = -s;
        dir.shadow.camera.right = s;
        dir.shadow.camera.top = s;
        dir.shadow.camera.bottom = -s;
        dir.shadow.camera.near = 8;
        dir.shadow.camera.far = 240;
        dir.shadow.bias = -0.0007;
        dir.shadow.normalBias = 0.04;
    }
    group.add(dir);
    group.add(dir.target);

    return { group, dir, hemi, amb };
}
