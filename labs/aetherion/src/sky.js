/**
 * Céu: campo de estrelas (via láctea concentrada no equador celeste)
 * e uma esfera de nebulosa em fbm aditivo.
 */

import * as THREE from 'three';
import { NOISE } from './glsl.js';

const NEBULA_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const NEBULA_FRAG = /* glsl */ `
${NOISE}
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
varying vec3 vDir;

void main() {
    vec3 p = normalize(vDir);
    float n = fbm(p * 2.2);
    float n2 = fbm(p * 4.0 + 9.0);
    float band = exp(-pow(p.y * 2.8, 2.0));
    float dens = smoothstep(0.42, 0.78, n) * (0.25 + band * 0.85);
    dens *= 0.55 + 0.45 * n2;
    vec3 col = mix(uA, uB, n);
    col = mix(col, uC, n2 * band);
    gl_FragColor = vec4(col, dens * 0.55);
}
`;

export function createSky(rng, quality) {
    const group = new THREE.Group();

    const starCount = quality.stars;
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const color = new THREE.Color();

    for (let i = 0; i < starCount; i++) {
        const milky = rng() < 0.55;
        const u = rng();
        const v = milky ? (rng() - 0.5) * 0.42 + (rng() - 0.5) * 0.08 : rng();
        const theta = 2 * Math.PI * u;
        const phi = milky ? (0.5 * Math.PI + v) : Math.acos(2 * v - 1);
        const r = 1400 + rng() * 500;
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.cos(phi);
        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

        const temp = rng();
        if (temp < 0.15) color.setRGB(0.65, 0.78, 1.0);
        else if (temp < 0.3) color.setRGB(1.0, 0.72, 0.45);
        else if (temp < 0.4) color.setRGB(1.0, 0.45, 0.4);
        else color.setRGB(0.92, 0.95, 1.0);
        const mag = 0.45 + rng() * 0.7;
        colors[i * 3] = color.r * mag;
        colors[i * 3 + 1] = color.g * mag;
        colors[i * 3 + 2] = color.b * mag;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const stars = new THREE.Points(
        geo,
        new THREE.PointsMaterial({
            size: 1.7,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.92,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    );
    group.add(stars);

    const nebula = new THREE.Mesh(
        new THREE.SphereGeometry(1800, 32, 24),
        new THREE.ShaderMaterial({
            uniforms: {
                uA: { value: new THREE.Color().setHSL(rng() * 0.2 + 0.7, 0.55, 0.28) },
                uB: { value: new THREE.Color().setHSL(rng() * 0.15 + 0.55, 0.5, 0.22) },
                uC: { value: new THREE.Color().setHSL(rng() * 0.1 + 0.05, 0.45, 0.3) }
            },
            vertexShader: NEBULA_VERT,
            fragmentShader: NEBULA_FRAG,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
    );
    group.add(nebula);

    return {
        group,
        update(dt) {
            stars.rotation.y += dt * 0.0025;
        }
    };
}
