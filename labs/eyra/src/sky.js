/**
 * Céu de Eyra: zênite teal, horizonte ouro-verde, duas luas e o sol
 * baixo — o “magic hour” permanente de um mundo de picos flutuantes.
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
uniform float uDusk;

void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y * 0.5 + 0.5;
    vec3 col = mix(uHorizon, uMid, smoothstep(0.22, 0.52, h));
    col = mix(col, uZenith, smoothstep(0.5, 0.95, h));

    float sun = pow(max(dot(dir, normalize(uSunDir)), 0.0), 48.0);
    float glow = pow(max(dot(dir, normalize(uSunDir)), 0.0), 5.0);
    col += uSunColor * sun * 1.35;
    col += uSunColor * glow * 0.28;

    float band = exp(-pow((h - 0.38) * 7.5, 2.0));
    col += vec3(1.0, 0.55, 0.28) * band * 0.22 * (1.0 - uDusk * 0.4);

    // véu magenta nas alturas — o céu “alienígena”
    float veil = smoothstep(0.62, 0.95, h);
    col = mix(col, vec3(0.42, 0.18, 0.48), veil * 0.18 * uDusk);

    gl_FragColor = vec4(col, 1.0);
}`;

export function createSky() {
    const geo = new THREE.SphereGeometry(780, 40, 24);
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uZenith: { value: new THREE.Color('#143a62') },
            uMid: { value: new THREE.Color('#3a8a9a') },
            uHorizon: { value: new THREE.Color('#e8c878') },
            uSunColor: { value: new THREE.Color('#fff1b8') },
            uSunDir: { value: new THREE.Vector3(0.62, 0.18, 0.55).normalize() },
            uDusk: { value: 0.22 }
        },
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false
    });
    const group = new THREE.Group();
    group.name = 'sky';
    const dome = new THREE.Mesh(geo, mat);
    dome.frustumCulled = false;
    group.add(dome);

    const sunDir = mat.uniforms.uSunDir.value;
    const sun = new THREE.Mesh(
        new THREE.SphereGeometry(18, 28, 18),
        new THREE.MeshBasicMaterial({ color: 0xfff4c4 })
    );
    sun.position.copy(sunDir).multiplyScalar(520);
    const corona = new THREE.Mesh(
        new THREE.SphereGeometry(32, 20, 14),
        new THREE.MeshBasicMaterial({
            color: 0xffc070,
            transparent: true,
            opacity: 0.22,
            depthWrite: false
        })
    );
    sun.add(corona);
    group.add(sun);

    const moonA = new THREE.Mesh(
        new THREE.SphereGeometry(22, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0xc8d8e8 })
    );
    moonA.position.set(-280, 210, -340);
    const moonB = new THREE.Mesh(
        new THREE.SphereGeometry(10, 18, 12),
        new THREE.MeshBasicMaterial({ color: 0xf0d8c0 })
    );
    moonB.position.set(-240, 180, -380);
    group.add(moonA, moonB);

    const n = 1400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const h = Math.random() * 0.55 + 0.35;
        const r = 620;
        pos[i * 3] = Math.cos(a) * Math.cos(h * Math.PI) * r;
        pos[i * 3 + 1] = Math.sin(h * Math.PI) * r * 0.55;
        pos[i * 3 + 2] = Math.sin(a) * Math.cos(h * Math.PI) * r;
    }
    const stars = new THREE.BufferGeometry();
    stars.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    group.add(new THREE.Points(
        stars,
        new THREE.PointsMaterial({
            color: 0xe8f4ff,
            size: 1.4,
            transparent: true,
            opacity: 0.55,
            depthWrite: false
        })
    ));

    group.userData.mat = mat;
    return group;
}

export function setSkyDusk(sky, t) {
    const mat = sky?.userData?.mat;
    if (mat) mat.uniforms.uDusk.value = t;
}
