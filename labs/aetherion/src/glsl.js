/**
 * Fragmentos GLSL compartilhados — ruído 3D e iluminação.
 * Value noise interpolado (hash senoidal) é barato o bastante para
 * rodar em esferas de 96 segmentos no fragment shader.
 */

export const VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec3 vObjectPos;

void main() {
    vObjectPos = position;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const NOISE = /* glsl */ `
float hash13(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
}

float noise3(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x),
            mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
        mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x),
            mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y),
        f.z);
}

float fbm(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 5; i++) {
        s += a * noise3(p);
        p = p * 2.03 + vec3(0.17, 0.31, 0.11);
        a *= 0.5;
    }
    return s;
}

float fbm4(vec3 p) {
    float a = 0.5;
    float s = 0.0;
    for (int i = 0; i < 4; i++) {
        s += a * noise3(p);
        p *= 2.11;
        a *= 0.5;
    }
    return s;
}
`;

export const LIGHT = /* glsl */ `
vec3 sunDirFrom(vec3 worldPos) {
    return normalize(-worldPos);
}

float lambert(vec3 n, vec3 l) {
    return max(dot(n, l), 0.0);
}

float wrapLight(vec3 n, vec3 l, float w) {
    return clamp((dot(n, l) + w) / (1.0 + w), 0.0, 1.0);
}

float fresnel(vec3 n, vec3 v, float p) {
    return pow(1.0 - max(dot(n, v), 0.0), p);
}
`;
