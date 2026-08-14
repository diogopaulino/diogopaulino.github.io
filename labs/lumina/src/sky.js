/**
 * Céu de conto: gradiente pêssego → rosa → índigo, sol dourado e um tapete
 * de estrelas que acende conforme a noite cai no reino.
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
uniform float uNight;

void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y * 0.5 + 0.5;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.28, 0.58, h));
    col = mix(col, uZenith, smoothstep(0.55, 0.95, h));

    float sun = pow(max(dot(dir, normalize(uSunDir)), 0.0), 32.0);
    float glow = pow(max(dot(dir, normalize(uSunDir)), 0.0), 4.0);
    col += uSunColor * sun * 1.15;
    col += uSunColor * glow * 0.22;

    // faixa quente no horizonte, o “magic hour” Disney
    float band = exp(-pow((h - 0.42) * 8.0, 2.0));
    col += vec3(1.0, 0.55, 0.35) * band * 0.18 * (1.0 - uNight);

    col = mix(col, vec3(0.08, 0.06, 0.22), uNight * 0.55);
    gl_FragColor = vec4(col, 1.0);
}`;

export function createSky() {
    const geo = new THREE.SphereGeometry(420, 32, 20);
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uZenith: { value: new THREE.Color('#3a2a72') },
            uMid: { value: new THREE.Color('#c46aa8') },
            uHorizon: { value: new THREE.Color('#ffb07a') },
            uSunColor: { value: new THREE.Color('#fff1b0') },
            uSunDir: { value: new THREE.Vector3(0.55, 0.28, 0.78).normalize() },
            uNight: { value: 0 }
        },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    const sun = new THREE.Mesh(
        new THREE.SphereGeometry(10, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0xfff4c0 })
    );
    sun.position.copy(mat.uniforms.uSunDir.value).multiplyScalar(280);

    const corona = new THREE.Mesh(
        new THREE.SphereGeometry(16, 16, 12),
        new THREE.MeshBasicMaterial({
            color: 0xffc07a,
            transparent: true,
            opacity: 0.28,
            depthWrite: false
        })
    );
    sun.add(corona);

    const starsGeo = new THREE.BufferGeometry();
    const n = 900;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(0.15 + Math.random() * 0.85);
        const r = 380;
        pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i * 3 + 1] = r * Math.cos(phi);
        pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
        const c = 0.75 + Math.random() * 0.25;
        col[i * 3] = c;
        col[i * 3 + 1] = c * 0.95;
        col[i * 3 + 2] = c * 0.8;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const stars = new THREE.Points(
        starsGeo,
        new THREE.PointsMaterial({
            size: 2.2,
            vertexColors: true,
            transparent: true,
            opacity: 0.15,
            depthWrite: false,
            sizeAttenuation: false
        })
    );

    const group = new THREE.Group();
    group.add(mesh, sun, stars);
    group.userData = { mat, stars, sun };
    return group;
}

export function setSkyNight(sky, night) {
    sky.userData.mat.uniforms.uNight.value = night;
    sky.userData.stars.material.opacity = 0.12 + night * 0.72;
}
