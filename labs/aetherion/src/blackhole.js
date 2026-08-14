/**
 * Buraco negro: horizonte negro, anel de fótons, disco de acreção com
 * rotação kepleriana / Doppler e jatos relativísticos nos polos.
 */

import * as THREE from 'three';
import { NOISE, VERT } from './glsl.js';

const DISK_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPos;
void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const DISK_FRAG = /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uHot;
uniform vec3 uCool;
varying vec2 vUv;

void main() {
    float r = vUv.y;
    float angle = vUv.x * 6.28318530718;
    float kepler = 1.0 / pow(max(r, 0.18), 1.45);
    float a = angle + uTime * kepler * 0.55;
    float n = fbm(vec3(cos(a) * r * 4.0, sin(a) * r * 4.0, r * 6.0 + uTime * 0.08));
    float spiral = 0.5 + 0.5 * sin(a * 4.0 + r * 22.0 - uTime * 1.8);
    float dens = smoothstep(0.0, 0.12, r) * (1.0 - smoothstep(0.72, 1.0, r));
    dens *= 0.4 + 0.6 * n * mix(0.7, 1.2, spiral);
    vec3 col = mix(uHot, uCool, smoothstep(0.08, 0.85, r));
    col *= 0.8 + (1.0 - r) * 2.4;
    float doppler = 0.62 + 0.5 * sin(angle);
    col *= doppler;
    gl_FragColor = vec4(col, clamp(dens, 0.0, 1.0));
}
`;

const JET_FRAG = /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uColor;
varying vec3 vObjectPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
    vec3 p = vObjectPos;
    float along = clamp(p.y * 0.5 + 0.5, 0.0, 1.0);
    float n = fbm(vec3(p.x * 6.0, p.y * 2.0 - uTime * 0.6, p.z * 6.0));
    vec3 view = normalize(cameraPosition - vWorldPos);
    float f = pow(1.0 - abs(dot(normalize(vWorldNormal), view)), 2.2);
    float alpha = (0.15 + n * 0.55) * (1.0 - along) * (0.4 + f);
    gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.7));
}
`;

export function createBlackHole({ radius = 3.2, segs = 48 }) {
    const group = new THREE.Group();

    const horizon = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segs, segs),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    horizon.userData.pick = true;
    group.add(horizon);

    const photon = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.52, radius * 0.045, 12, 80),
        new THREE.MeshBasicMaterial({
            color: 0xffe6c2,
            transparent: true,
            opacity: 0.85,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    photon.rotation.x = Math.PI / 2;
    group.add(photon);

    const glow = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.12, 24, 16),
        new THREE.MeshBasicMaterial({
            color: 0x3a1028,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.BackSide
        })
    );
    group.add(glow);

    const diskUniforms = {
        uTime: { value: 0 },
        uHot: { value: new THREE.Color('#fff4d2') },
        uCool: { value: new THREE.Color('#ff4b2a') }
    };

    const disk = new THREE.Mesh(
        new THREE.RingGeometry(radius * 1.7, radius * 9.5, 128, 24),
        new THREE.ShaderMaterial({
            uniforms: diskUniforms,
            vertexShader: DISK_VERT,
            fragmentShader: DISK_FRAG,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        })
    );
    disk.rotation.x = Math.PI / 2;
    disk.rotation.z = 0.18;
    group.add(disk);

    const jetMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: diskUniforms.uTime,
            uColor: { value: new THREE.Color('#9ad8ff') }
        },
        vertexShader: VERT,
        fragmentShader: JET_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });

    const jetGeo = new THREE.CylinderGeometry(radius * 0.12, radius * 0.55, radius * 18, 16, 1, true);
    const jetA = new THREE.Mesh(jetGeo, jetMat);
    jetA.position.y = radius * 9;
    const jetB = new THREE.Mesh(jetGeo, jetMat);
    jetB.position.y = -radius * 9;
    jetB.rotation.z = Math.PI;
    group.add(jetA, jetB);

    group.rotation.z = 0.22;
    group.rotation.x = 0.12;

    return {
        group,
        pickMesh: horizon,
        update(time) {
            diskUniforms.uTime.value = time;
            disk.rotation.z = 0.18 + time * 0.02;
        }
    };
}
