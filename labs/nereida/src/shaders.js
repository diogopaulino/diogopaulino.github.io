/**
 * GLSL do fundo do mar: cáusticas no areia, ondulação da superfície
 * vista de baixo, e o balanço das lâminas de kelp.
 */

export const CAUSTIC_CHUNK = /* glsl */ `
uniform float uTime;
uniform float uAwaken;

float nereidaCaustic(vec2 uv, float t) {
    vec2 p = uv * 0.11;
    float c = 0.0;
    c += pow(abs(sin(p.x * 3.1 + t) * sin(p.y * 2.7 - t * 0.72)), 10.0);
    vec2 q = vec2(p.x * 0.72 + p.y * 0.84, -p.x * 0.64 + p.y * 0.9) * 1.55;
    c += pow(abs(sin(q.x - t * 0.85) * sin(q.y + t * 0.55)), 12.0);
    vec2 r = vec2(p.x * 1.4 - p.y * 0.3, p.y * 1.6) * 0.85;
    c += pow(abs(sin(r.x + t * 0.4) * sin(r.y - t * 0.33)), 14.0) * 0.65;
    return c;
}
`;

export function patchFloor(shader, uniforms) {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uAwaken = uniforms.uAwaken;
    shader.vertexShader = shader.vertexShader
        .replace(
            '#include <common>',
            `#include <common>
varying vec3 vNereidaWorld;`
        )
        .replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
vNereidaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`
        );
    shader.fragmentShader = `
        ${CAUSTIC_CHUNK}
    ` + shader.fragmentShader
        .replace(
            '#include <common>',
            `#include <common>
varying vec3 vNereidaWorld;`
        )
        .replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
            float cau = nereidaCaustic(vNereidaWorld.xz, uTime * 0.38);
            totalEmissiveRadiance += vec3(0.35, 0.82, 1.0) * cau * (0.28 + uAwaken * 0.85);
            `
        );
}

export function patchKelp(shader, uniforms) {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = `
        uniform float uTime;
    ` + shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 transformed = vec3(position);
        float h = max(transformed.y, 0.0);
        float seed = modelMatrix[3].x * 0.31 + modelMatrix[3].z * 0.17;
        float sway = sin(uTime * 0.62 + seed) * h * 0.16;
        float swayz = cos(uTime * 0.48 + seed * 1.3) * h * 0.11;
        transformed.x += sway;
        transformed.z += swayz;
        `
    );
}

export const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
    vUv = uv;
    vec3 p = position;
    float w1 = sin(uv.x * 9.0 + uTime * 0.55) * 0.18;
    float w2 = cos(uv.y * 7.4 - uTime * 0.42) * 0.14;
    p.z += w1 + w2;
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorldPos = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const WATER_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAwaken;
uniform vec3 uMoonDir;
varying vec2 vUv;
varying vec3 vWorldPos;
varying vec3 vNormalW;

void main() {
    vec3 n = normalize(vNormalW);
    vec3 view = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(n, view), 0.0), 2.4);
    vec2 uv = vUv * 8.0;
    float c = pow(abs(sin(uv.x + uTime * 0.5) * sin(uv.y * 1.15 - uTime * 0.35)), 8.0);
    c += pow(abs(sin((uv.x + uv.y) * 0.8 - uTime * 0.28)), 10.0) * 0.5;
    float moon = pow(max(dot(n, normalize(uMoonDir)), 0.0), 24.0);
    vec3 deep = vec3(0.07, 0.22, 0.32);
    vec3 sky = vec3(0.55, 0.82, 0.95);
    vec3 col = mix(deep, sky, 0.35 + moon * 0.5 + uAwaken * 0.12);
    col += vec3(0.55, 0.9, 1.0) * c * 0.35;
    col += vec3(1.0, 0.96, 0.82) * moon * 0.85;
    float alpha = 0.42 + fres * 0.35 + moon * 0.2;
    float dist = length(cameraPosition - vWorldPos);
    float fog = 1.0 - exp(-0.012 * dist);
    col = mix(col, vec3(0.024, 0.125, 0.173), fog);
    gl_FragColor = vec4(col, alpha);
}
`;
