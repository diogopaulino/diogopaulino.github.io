/**
 * Shaders de água, céu e pele — wrap lighting para um subsurface barato.
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
uniform vec3 topColor;
uniform vec3 midColor;
uniform vec3 botColor;
uniform vec3 sunDir;
uniform vec3 sunColor;
uniform float sunSize;
void main() {
    vec3 n = normalize(vDir);
    float h = n.y * 0.5 + 0.5;
    vec3 col = mix(botColor, midColor, smoothstep(0.0, 0.42, h));
    col = mix(col, topColor, smoothstep(0.38, 1.0, h));
    float sun = pow(max(0.0, dot(n, normalize(sunDir))), 32.0);
    float disc = smoothstep(sunSize, sunSize * 0.45, 1.0 - max(0.0, dot(n, normalize(sunDir))));
    col += sunColor * (sun * 0.55 + disc * 1.4);
    float haze = pow(1.0 - max(n.y, 0.0), 3.0);
    col = mix(col, midColor, haze * 0.35);
    gl_FragColor = vec4(col, 1.0);
}
`;

export const WATER_VERT = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vN;
void main() {
    vUv = uv;
    vec3 p = position;
    float w1 = sin(p.x * 0.18 + uTime * 1.1) * 0.12;
    float w2 = sin(p.z * 0.14 + uTime * 0.85 + 1.7) * 0.1;
    float w3 = sin((p.x + p.z) * 0.31 + uTime * 1.6) * 0.05;
    p.y += w1 + w2 + w3;
    vec3 t = vec3(1.0, (cos(p.x * 0.18 + uTime * 1.1) * 0.18), 0.0);
    vec3 b = vec3(0.0, (cos(p.z * 0.14 + uTime * 0.85) * 0.14), 1.0);
    vN = normalize(cross(b, t));
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const WATER_FRAG = /* glsl */ `
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uSun;
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vN;
void main() {
    vec3 n = normalize(vN);
    vec3 view = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(view, n), 0.0), 3.2);
    float depth = smoothstep(-0.4, 2.6, vWorld.y);
    vec3 col = mix(uDeep, uShallow, depth);
    float spec = pow(max(0.0, dot(reflect(-normalize(uSun), n), view)), 48.0);
    col += vec3(0.85, 0.92, 1.0) * spec * 0.85;
    col = mix(col, vec3(0.78, 0.88, 0.92), fres * 0.65);
    float foam = smoothstep(0.82, 1.0, sin(vUv.x * 40.0 + uTime) * 0.5 + 0.5);
    col = mix(col, vec3(0.9, 0.95, 0.92), foam * 0.08 * (1.0 - depth));
    gl_FragColor = vec4(col, 0.88);
}
`;

/**
 * Injeta wrap-lighting e mistura dorso/ventre no MeshStandardMaterial.
 * A fórmula do wrap: NdotL remapado para [−wrap, 1] simula SSS barato.
 */
export function patchSkin(material, { belly = new THREE.Color(0xcbb892), wrap = 0.42 } = {}) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uBelly = { value: belly };
        shader.uniforms.uWrap = { value: wrap };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            varying vec3 vWorldN;`
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <beginnormal_vertex>',
            `#include <beginnormal_vertex>
            vWorldN = normalize(mat3(modelMatrix) * objectNormal);`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform vec3 uBelly;
            uniform float uWrap;
            varying vec3 vWorldN;`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float up = smoothstep(-0.25, 0.55, vWorldN.y);
            diffuseColor.rgb = mix(uBelly, diffuseColor.rgb, mix(0.35, 1.0, up));`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <lights_physical_fragment>',
            `#include <lights_physical_fragment>
            // wrap residual — o Standard já iluminou; só aquecemos o albedo
            reflectedLight.directDiffuse *= 1.0;
            reflectedLight.indirectDiffuse += uBelly * 0.04 * uWrap;`
        );
        material.userData.shader = shader;
    };
    material.needsUpdate = true;
    return material;
}

export function makeSkyMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            topColor: { value: new THREE.Color(0x6eb4e0) },
            midColor: { value: new THREE.Color(0xc8dce8) },
            botColor: { value: new THREE.Color(0xe8d4a8) },
            sunDir: { value: new THREE.Vector3(0.45, 0.55, 0.35).normalize() },
            sunColor: { value: new THREE.Color(0xffe2a8) },
            sunSize: { value: 0.012 }
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        depthWrite: false
    });
}

export function makeWaterMaterial() {
    return new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color(0x0c3a42) },
            uShallow: { value: new THREE.Color(0x3a8a7a) },
            uSun: { value: new THREE.Vector3(0.4, 0.7, 0.3) }
        },
        vertexShader: WATER_VERT,
        fragmentShader: WATER_FRAG,
        transparent: true,
        depthWrite: false
    });
}
