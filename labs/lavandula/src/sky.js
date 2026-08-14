/**
 * Céu de hora dourada: gradiente quente, sol baixo e névoa lavanda.
 */

import * as THREE from 'three';
import { LIGHT } from './config.js';

export function createSky() {
    const geo = new THREE.SphereGeometry(480, 28, 18);
    const uniforms = {
        top: { value: new THREE.Color(0x6a88b8) },
        mid: { value: new THREE.Color(0xf0b878) },
        bot: { value: new THREE.Color(0xe8a8c0) },
        sunDir: { value: new THREE.Vector3(0.62, 0.28, 0.42).normalize() },
        sunColor: { value: new THREE.Color(0xffe0a0) }
    };
    const mat = new THREE.ShaderMaterial({
        uniforms,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
            varying vec3 vPos;
            void main() {
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vPos;
            uniform vec3 top;
            uniform vec3 mid;
            uniform vec3 bot;
            uniform vec3 sunDir;
            uniform vec3 sunColor;
            void main() {
                vec3 n = normalize(vPos);
                float h = n.y * 0.5 + 0.5;
                vec3 col = mix(bot, mid, smoothstep(0.0, 0.42, h));
                col = mix(col, top, smoothstep(0.38, 0.95, h));
                float sun = pow(max(0.0, dot(n, normalize(sunDir))), 48.0);
                float glow = pow(max(0.0, dot(n, normalize(sunDir))), 6.0);
                col += sunColor * sun * 1.4;
                col += sunColor * glow * 0.28;
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;

    const sun = new THREE.Mesh(
        new THREE.SphereGeometry(14, 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xffe8b0, fog: false })
    );
    const d = LIGHT.sunDir;
    sun.position.set(d[0] * 220, d[1] * 220, d[2] * 220);
    mesh.add(sun);

    return { mesh, uniforms };
}

export function createLights(scene, quality) {
    const group = new THREE.Group();
    scene.add(group);

    const amb = new THREE.AmbientLight(LIGHT.ambient, LIGHT.ambientIntensity);
    group.add(amb);

    const hemi = new THREE.HemisphereLight(LIGHT.hemiSky, LIGHT.hemiGround, LIGHT.hemiIntensity);
    group.add(hemi);

    const dir = new THREE.DirectionalLight(LIGHT.sun, LIGHT.sunIntensity);
    const d = LIGHT.sunDir;
    dir.position.set(d[0] * 90, d[1] * 90, d[2] * 90);
    dir.castShadow = quality.shadows;
    if (quality.shadows) {
        dir.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
        const s = 55;
        dir.shadow.camera.left = -s;
        dir.shadow.camera.right = s;
        dir.shadow.camera.top = s;
        dir.shadow.camera.bottom = -s;
        dir.shadow.camera.near = 8;
        dir.shadow.camera.far = 200;
        dir.shadow.bias = -0.0007;
        dir.shadow.normalBias = 0.04;
    }
    group.add(dir);
    group.add(dir.target);

    const fill = new THREE.DirectionalLight(0xc8a0e0, 0.28);
    fill.position.set(-40, 18, -20);
    group.add(fill);

    return { group, dir, hemi, amb };
}
