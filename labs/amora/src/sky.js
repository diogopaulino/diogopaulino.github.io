/**
 * Céu de manhã de livro infantil: pêssego no horizonte, azul-doce no zênite,
 * sol grande e nuvens de algodão (as nuvens ficam no world).
 */

import * as THREE from 'three';

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const skyFrag = /* glsl */ `
varying vec3 vDir;
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uParty;

void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y * 0.5 + 0.5;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.26, 0.55, h));
    col = mix(col, uZenith, smoothstep(0.52, 0.96, h));

    float sun = pow(max(dot(dir, normalize(uSunDir)), 0.0), 28.0);
    float glow = pow(max(dot(dir, normalize(uSunDir)), 0.0), 3.4);
    col += uSunColor * sun * 1.25;
    col += uSunColor * glow * 0.28;

    float band = exp(-pow((h - 0.38) * 7.5, 2.0));
    col += vec3(1.0, 0.62, 0.42) * band * 0.22;

    // festa: o céu ganha um pouco de rosa e ouro
    col = mix(col, col * vec3(1.08, 0.92, 1.12) + vec3(0.08, 0.02, 0.06), uParty);

    gl_FragColor = vec4(col, 1.0);
}`;

export function createSky() {
    const geo = new THREE.SphereGeometry(420, 32, 20);
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uZenith: { value: new THREE.Color('#6eb8ff') },
            uMid: { value: new THREE.Color('#ffc4d8') },
            uHorizon: { value: new THREE.Color('#ffe2a0') },
            uSunColor: { value: new THREE.Color('#fff4c0') },
            uSunDir: { value: new THREE.Vector3(0.42, 0.38, 0.82).normalize() },
            uParty: { value: 0 }
        },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    const sun = new THREE.Mesh(
        new THREE.SphereGeometry(14, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff3b0 })
    );
    sun.position.copy(mat.uniforms.uSunDir.value).multiplyScalar(260);

    const corona = new THREE.Mesh(
        new THREE.SphereGeometry(22, 16, 12),
        new THREE.MeshBasicMaterial({
            color: 0xffc878,
            transparent: true,
            opacity: 0.32,
            depthWrite: false
        })
    );
    sun.add(corona);

    const group = new THREE.Group();
    group.add(mesh, sun);
    group.userData = { mat, sun };
    return group;
}

export function setSkyParty(sky, t) {
    sky.userData.mat.uniforms.uParty.value = t;
}
