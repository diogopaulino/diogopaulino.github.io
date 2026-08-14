/**
 * Céu noturno, água com reflexo da lua e pano de bandeira.
 * Fórmulas documentadas no próprio GLSL.
 */

import * as THREE from 'three';

export const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uNadir;
uniform vec3 uMoonDir;
uniform vec3 uMoonColor;
uniform float uTime;

void main() {
    vec3 n = normalize(vDir);
    float h = n.y;
    vec3 col = mix(uNadir, uHorizon, smoothstep(-0.15, 0.08, h));
    col = mix(col, uZenith, smoothstep(0.05, 0.72, h));

    // Halo da lua: disc + corona. disc = 1 quando o ângulo é ~0.
    float mu = max(0.0, dot(n, normalize(uMoonDir)));
    float disc = smoothstep(0.9974, 0.9994, mu);
    float corona = pow(mu, 80.0) * 0.55 + pow(mu, 12.0) * 0.12;
    col += uMoonColor * (disc * 1.35 + corona);

    // Via Láctea: banda gaussiana no equador celeste, levemente inclinada.
    float band = exp(-pow(n.x * 0.35 + n.y * 0.55, 2.0) * 8.0);
    col += vec3(0.18, 0.20, 0.32) * band * 0.22;

    // Bruma no horizonte
    float haze = pow(1.0 - max(h, 0.0), 4.0);
    col = mix(col, uHorizon, haze * 0.45);

    gl_FragColor = vec4(col, 1.0);
}
`;

export const FLAG_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
void main() {
    vUv = uv;
    vec3 p = position;
    // Onda na bandeira: amplitude cresce com uv.x (longe do mastro).
    float w = sin(uTime * 3.4 + uv.x * 6.0 + uv.y * 2.2) * uv.x;
    p.z += w * 0.18;
    p.y += sin(uTime * 2.6 + uv.x * 4.0) * uv.x * 0.04;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

export const FLAG_FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
void main() {
    vec4 c = texture2D(uMap, vUv);
    if (c.a < 0.1) discard;
    gl_FragColor = c;
}
`;

export const SPARK_VERT = /* glsl */ `
attribute float aSize;
attribute vec3 aColor;
varying vec3 vColor;
varying float vLife;
uniform float uPixel;
void main() {
    vColor = aColor;
    vLife = aSize;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uPixel / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
}
`;

export const SPARK_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
    vec2 p = gl_PointCoord * 2.0 - 1.0;
    float d = dot(p, p);
    if (d > 1.0) discard;
    float glow = exp(-d * 3.2);
    gl_FragColor = vec4(vColor * glow, glow);
}
`;

export function makeSkyMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uZenith: { value: new THREE.Color(0x050816) },
            uHorizon: { value: new THREE.Color(0x1a2748) },
            uNadir: { value: new THREE.Color(0x02040a) },
            uMoonDir: { value: new THREE.Vector3(-0.35, 0.62, 0.55).normalize() },
            uMoonColor: { value: new THREE.Color(0xdce7ff) },
            uTime: { value: 0 }
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false
    });
}

export function makeFlagMaterial(map) {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uMap: { value: map }
        },
        vertexShader: FLAG_VERT,
        fragmentShader: FLAG_FRAG,
        side: THREE.DoubleSide,
        transparent: true
    });
}

export function makeSparkMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: { uPixel: { value: 180 } },
        vertexShader: SPARK_VERT,
        fragmentShader: SPARK_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
}
