/**
 * Planetas procedurais. Cada tipo (terra, oceano, deserto, rochoso, lava,
 * gás, gelo) tem um fragment shader próprio, com iluminação a partir da
 * estrela no origem. Nuvens e atmosfera são esferas concêntricas.
 */

import * as THREE from 'three';
import { VERT, NOISE, LIGHT } from './glsl.js';

const FRAG = {
    terra: /* glsl */ `
${NOISE}
${LIGHT}
uniform vec3 uOcean;
uniform vec3 uLand;
uniform vec3 uCoast;
uniform vec3 uIce;
uniform vec3 uCity;
varying vec3 vObjectPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 p = normalize(vObjectPos);
    vec3 l = sunDirFrom(vWorldPos);
    float ndl = wrapLight(n, l, 0.12);
    float night = smoothstep(0.12, -0.08, dot(n, l));

    float h = fbm(p * 4.4);
    float continent = smoothstep(0.46, 0.56, h);
    float mountain = smoothstep(0.62, 0.78, h);
    vec3 col = mix(uOcean, uCoast, smoothstep(0.44, 0.5, h));
    col = mix(col, uLand, continent);
    col = mix(col, vec3(0.38, 0.36, 0.32), mountain * continent);
    float poles = smoothstep(0.62, 0.82, abs(p.y));
    col = mix(col, uIce, poles);

    vec3 lit = col * (0.04 + ndl * 1.15);
    float spec = pow(max(dot(reflect(-l, n), normalize(cameraPosition - vWorldPos)), 0.0), 48.0);
    lit += vec3(0.45, 0.65, 0.9) * spec * (1.0 - continent) * ndl;

    float cities = smoothstep(0.52, 0.7, noise3(p * 40.0)) * continent * (1.0 - poles);
    lit += uCity * cities * night * 1.8;

    gl_FragColor = vec4(lit, 1.0);
}
`,
    ocean: /* glsl */ `
${NOISE}
${LIGHT}
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
varying vec3 vObjectPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 p = normalize(vObjectPos);
    vec3 l = sunDirFrom(vWorldPos);
    float ndl = wrapLight(n, l, 0.18);
    float h = fbm(p * 5.0);
    vec3 col = mix(uDeep, uShallow, smoothstep(0.35, 0.7, h));
    col = mix(col, uFoam, smoothstep(0.72, 0.88, h) * 0.4);
    float poles = smoothstep(0.78, 0.92, abs(p.y));
    col = mix(col, vec3(0.82, 0.9, 0.95), poles);
    vec3 view = normalize(cameraPosition - vWorldPos);
    float spec = pow(max(dot(reflect(-l, n), view), 0.0), 60.0);
    vec3 lit = col * (0.05 + ndl) + vec3(0.7, 0.85, 1.0) * spec * ndl;
    gl_FragColor = vec4(lit, 1.0);
}
`,
    desert: /* glsl */ `
${NOISE}
${LIGHT}
uniform vec3 uDune;
uniform vec3 uRock;
uniform vec3 uDark;
varying vec3 vObjectPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 p = normalize(vObjectPos);
    vec3 l = sunDirFrom(vWorldPos);
    float ndl = wrapLight(n, l, 0.1);
    float h = fbm(p * 6.2 + vec3(0.0, p.x * 2.0, 0.0));
    vec3 col = mix(uDark, uDune, smoothstep(0.3, 0.7, h));
    col = mix(col, uRock, smoothstep(0.68, 0.85, h));
    float poles = smoothstep(0.86, 0.96, abs(p.y));
    col = mix(col, vec3(0.78, 0.74, 0.68), poles);
    vec3 lit = col * (0.05 + ndl * 1.2);
    gl_FragColor = vec4(lit, 1.0);
}
`,
    rocky: /* glsl */ `
${NOISE}
${LIGHT}
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uCrater;
varying vec3 vObjectPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 p = normalize(vObjectPos);
    vec3 l = sunDirFrom(vWorldPos);
    float ndl = wrapLight(n, l, 0.08);
    float h = fbm(p * 7.0);
    float crater = 1.0 - smoothstep(0.35, 0.55, noise3(p * 18.0));
    vec3 col = mix(uA, uB, h);
    col = mix(col, uCrater, crater * 0.35);
    vec3 lit = col * (0.04 + ndl * 1.1);
    gl_FragColor = vec4(lit, 1.0);
}
`,
    lava: /* glsl */ `
${NOISE}
${LIGHT}
uniform vec3 uCrust;
uniform vec3 uGlow;
uniform float uTime;
varying vec3 vObjectPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 p = normalize(vObjectPos);
    vec3 l = sunDirFrom(vWorldPos);
    float ndl = wrapLight(n, l, 0.1);
    float crust = fbm(p * 5.5);
    float veins = 1.0 - smoothstep(0.38, 0.52, fbm(p * 8.0 + uTime * 0.05));
    float pulse = 0.75 + 0.25 * sin(uTime * 1.6 + crust * 10.0);
    vec3 col = mix(uCrust, uGlow, veins * 0.85);
    vec3 lit = col * (0.06 + ndl * 0.7) + uGlow * veins * pulse * 1.8;
    gl_FragColor = vec4(lit, 1.0);
}
`,
    gas: /* glsl */ `
${NOISE}
${LIGHT}
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uStorm;
uniform float uTime;
varying vec3 vObjectPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 p = normalize(vObjectPos);
    vec3 l = sunDirFrom(vWorldPos);
    float ndl = wrapLight(n, l, 0.22);
    float bands = sin(p.y * 14.0 + fbm(p * 3.0 + vec3(uTime * 0.04, 0.0, 0.0)) * 3.0);
    float nse = fbm(vec3(p.x * 3.0, p.y * 8.0, p.z * 3.0 + uTime * 0.03));
    vec3 col = mix(uA, uB, bands * 0.5 + 0.5);
    col = mix(col, uStorm, smoothstep(0.62, 0.82, nse) * (1.0 - abs(p.y)));
    vec3 lit = col * (0.08 + ndl * 0.95);
    gl_FragColor = vec4(lit, 1.0);
}
`,
    ice: /* glsl */ `
${NOISE}
${LIGHT}
uniform vec3 uIce;
uniform vec3 uDeep;
uniform vec3 uCrack;
varying vec3 vObjectPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 p = normalize(vObjectPos);
    vec3 l = sunDirFrom(vWorldPos);
    float ndl = wrapLight(n, l, 0.14);
    float h = fbm(p * 6.0);
    float cracks = 1.0 - smoothstep(0.42, 0.5, fbm(p * 14.0));
    vec3 col = mix(uDeep, uIce, smoothstep(0.3, 0.7, h));
    col = mix(col, uCrack, cracks * 0.35);
    vec3 view = normalize(cameraPosition - vWorldPos);
    float spec = pow(max(dot(reflect(-l, n), view), 0.0), 32.0);
    vec3 lit = col * (0.07 + ndl) + vec3(0.75, 0.88, 1.0) * spec * 0.45 * ndl;
    gl_FragColor = vec4(lit, 1.0);
}
`
};

const CLOUD_FRAG = /* glsl */ `
${NOISE}
${LIGHT}
uniform float uTime;
uniform float uCover;
uniform vec3 uColor;
varying vec3 vObjectPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 p = normalize(vObjectPos);
    vec3 l = sunDirFrom(vWorldPos);
    float ndl = wrapLight(n, l, 0.2);
    vec3 wp = p * 3.4 + vec3(uTime * 0.018, 0.0, 0.0);
    float c = fbm(wp);
    float a = smoothstep(uCover, uCover + 0.22, c) * 0.82;
    a *= 0.35 + ndl * 0.75;
    gl_FragColor = vec4(uColor * (0.4 + ndl), a);
}
`;

const ATMO_FRAG = /* glsl */ `
${LIGHT}
uniform vec3 uColor;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 view = normalize(cameraPosition - vWorldPos);
    vec3 l = sunDirFrom(vWorldPos);
    float f = pow(1.0 - abs(dot(n, view)), 3.4);
    float day = wrapLight(n, l, 0.4);
    float alpha = f * (0.25 + 0.85 * day);
    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 1.0));
}
`;

const RING_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uA;
uniform vec3 uB;
varying vec3 vObjectPos;
varying vec2 vUv;

void main() {
    float r = vUv.y;
    float gaps = smoothstep(0.02, 0.0, abs(r - 0.42)) + smoothstep(0.015, 0.0, abs(r - 0.7));
    float n = fbm4(vec3(vUv.x * 40.0, r * 18.0, 2.4));
    float dens = (0.45 + 0.55 * n) * (1.0 - gaps * 8.0);
    dens *= smoothstep(0.0, 0.08, r) * (1.0 - smoothstep(0.9, 1.0, r));
    vec3 col = mix(uA, uB, r);
    gl_FragColor = vec4(col, clamp(dens, 0.0, 0.85));
}
`;

const RING_VERT = /* glsl */ `
varying vec3 vObjectPos;
varying vec2 vUv;
void main() {
    vObjectPos = position;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

function colorUniforms(map) {
    const u = {};
    for (const [k, v] of Object.entries(map)) {
        u[k] = { value: v.isColor ? v : new THREE.Color(v) };
    }
    return u;
}

function surfaceMaterial(type, uniforms) {
    return new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, ...uniforms },
        vertexShader: VERT,
        fragmentShader: FRAG[type]
    });
}

export function createPlanet({
    type,
    radius,
    segs = 64,
    colors,
    clouds = false,
    atmosphere = null,
    rings = null,
    tilt = 0
}) {
    const group = new THREE.Group();
    const uniforms = colorUniforms(colors);
    const mat = surfaceMaterial(type, uniforms);
    const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segs, Math.max(24, segs * 0.7)),
        mat
    );
    mesh.userData.pick = true;
    group.add(mesh);

    let cloudMesh = null;
    let cloudUniforms = null;
    if (clouds) {
        cloudUniforms = {
            uTime: mat.uniforms.uTime,
            uCover: { value: colors.cloudCover ?? 0.52 },
            uColor: { value: new THREE.Color(colors.cloud ?? '#f2f5ff') }
        };
        cloudMesh = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.018, Math.max(32, segs * 0.6), Math.max(20, segs * 0.45)),
            new THREE.ShaderMaterial({
                uniforms: cloudUniforms,
                vertexShader: VERT,
                fragmentShader: CLOUD_FRAG,
                transparent: true,
                depthWrite: false
            })
        );
        group.add(cloudMesh);
    }

    if (atmosphere) {
        const atmo = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 1.08, 32, 24),
            new THREE.ShaderMaterial({
                uniforms: { uColor: { value: new THREE.Color(atmosphere) } },
                vertexShader: VERT,
                fragmentShader: ATMO_FRAG,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending,
                side: THREE.BackSide
            })
        );
        group.add(atmo);
    }

    if (rings) {
        const ring = new THREE.Mesh(
            new THREE.RingGeometry(radius * rings.inner, radius * rings.outer, 96, 12),
            new THREE.ShaderMaterial({
                uniforms: {
                    uA: { value: new THREE.Color(rings.a) },
                    uB: { value: new THREE.Color(rings.b) }
                },
                vertexShader: RING_VERT,
                fragmentShader: RING_FRAG,
                transparent: true,
                depthWrite: false,
                side: THREE.DoubleSide
            })
        );
        ring.rotation.x = Math.PI / 2;
        ring.rotation.z = rings.tilt ?? 0.18;
        group.add(ring);
    }

    group.rotation.z = tilt;

    return {
        group,
        mesh,
        pickMesh: mesh,
        update(time, dt) {
            mat.uniforms.uTime.value = time;
            mesh.rotation.y += dt * (colors.spin ?? 0.12);
            if (cloudMesh) cloudMesh.rotation.y += dt * 0.07;
        }
    };
}
