/**
 * Estrela central: superfície em fbm com domain-warping, coroa em fresnel
 * e uma luz pontual que ilumina o sistema.
 */

import * as THREE from 'three';
import { VERT, NOISE } from './glsl.js';

const SURFACE = /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCool;
uniform float uIntensity;
varying vec3 vObjectPos;
varying vec3 vWorldNormal;

void main() {
    vec3 p = normalize(vObjectPos);
    float t = uTime * 0.12;
    vec3 q = vec3(
        fbm(p * 3.0 + vec3(t, 0.0, 0.0)),
        fbm(p * 3.0 + vec3(4.1, t, 1.3)),
        fbm(p * 3.0 + vec3(1.7, 2.8, t))
    );
    float n = fbm(p * 4.2 + q * 1.8 + vec3(0.0, t * 0.6, 0.0));
    float spots = smoothstep(0.62, 0.78, fbm(p * 6.5 + 8.0));
    vec3 col = mix(uCool, uMid, smoothstep(0.28, 0.55, n));
    col = mix(col, uHot, smoothstep(0.55, 0.82, n));
    col *= 1.0 - spots * 0.55;
    float rim = pow(1.0 - abs(dot(normalize(vWorldNormal), vec3(0.0, 0.0, 1.0))), 2.0);
    col += uHot * rim * 0.25;
    gl_FragColor = vec4(col * uIntensity, 1.0);
}
`;

const CORONA = /* glsl */ `
${NOISE}
uniform float uTime;
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vObjectPos;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;

void main() {
    vec3 n = normalize(vWorldNormal);
    vec3 view = normalize(cameraPosition - vWorldPos);
    float f = pow(1.0 - abs(dot(n, view)), 3.2);
    vec3 p = normalize(vObjectPos);
    float filaments = fbm(p * 5.0 + vec3(0.0, 0.0, uTime * 0.08));
    float burst = smoothstep(0.55, 0.9, filaments);
    float alpha = (f * 0.85 + burst * 0.35 * f) * uAlpha;
    vec3 col = mix(uColor, vec3(1.0, 0.95, 0.8), burst * 0.45);
    gl_FragColor = vec4(col, alpha);
}
`;

export function createStar({ radius, palette, segs = 80 }) {
    const group = new THREE.Group();
    group.name = 'star';

    const uniforms = {
        uTime: { value: 0 },
        uHot: { value: new THREE.Color(palette.hot) },
        uMid: { value: new THREE.Color(palette.mid) },
        uCool: { value: new THREE.Color(palette.cool) },
        uIntensity: { value: palette.intensity }
    };

    const surface = new THREE.Mesh(
        new THREE.SphereGeometry(radius, segs, segs),
        new THREE.ShaderMaterial({
            uniforms,
            vertexShader: VERT,
            fragmentShader: SURFACE
        })
    );
    surface.userData.pick = true;
    group.add(surface);

    const coronaMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: uniforms.uTime,
            uColor: { value: new THREE.Color(palette.corona) },
            uAlpha: { value: 0.7 }
        },
        vertexShader: VERT,
        fragmentShader: CORONA,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide
    });

    const corona = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.18, Math.max(24, segs / 2), Math.max(16, segs / 2)),
        coronaMat
    );
    group.add(corona);

    const halo = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.55, 24, 16),
        coronaMat.clone()
    );
    halo.material.uniforms.uAlpha.value = 0.28;
    halo.material.uniforms.uTime = uniforms.uTime;
    group.add(halo);

    const light = new THREE.PointLight(palette.light, palette.lightIntensity, 0, 0.4);
    light.position.set(0, 0, 0);
    group.add(light);

    const ambient = new THREE.AmbientLight(palette.ambient, 0.12);
    group.add(ambient);

    return {
        group,
        pickMesh: surface,
        uniforms,
        light,
        update(time) {
            uniforms.uTime.value = time;
            surface.rotation.y = time * 0.03;
        }
    };
}
