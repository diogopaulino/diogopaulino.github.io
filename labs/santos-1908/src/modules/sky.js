/**
 * sky — céu matinal de inverno + sol baixo (G02).
 * Gradiente procedural em esfera; luz direcional + hemisfério.
 */

import * as THREE from 'three';

export function create(ctx) {
    const { scene, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'sky';

    const skyGeo = new THREE.SphereGeometry(900, 32, 16);
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            topColor: { value: new THREE.Color('#6a9ec4') },
            midColor: { value: new THREE.Color('#c4b8a0') },
            bottomColor: { value: new THREE.Color('#e8d4b0') },
            sunDir: { value: new THREE.Vector3(0.55, 0.35, -0.4).normalize() },
            sunColor: { value: new THREE.Color('#ffe8c0') }
        },
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            void main() {
                vec4 w = modelMatrix * vec4(position, 1.0);
                vWorld = w.xyz;
                gl_Position = projectionMatrix * viewMatrix * w;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 topColor;
            uniform vec3 midColor;
            uniform vec3 bottomColor;
            uniform vec3 sunDir;
            uniform vec3 sunColor;
            varying vec3 vWorld;
            void main() {
                vec3 n = normalize(vWorld);
                float h = n.y * 0.5 + 0.5;
                vec3 col = mix(bottomColor, midColor, smoothstep(0.0, 0.45, h));
                col = mix(col, topColor, smoothstep(0.4, 0.95, h));
                float sun = pow(max(dot(n, sunDir), 0.0), 32.0);
                col += sunColor * sun * 0.85;
                float haze = pow(1.0 - max(n.y, 0.0), 2.2) * 0.25;
                col = mix(col, midColor, haze);
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    group.add(sky);

    // Nuvens suaves (planos billboard simples)
    const cloudMat = new THREE.MeshBasicMaterial({
        color: '#f0ebe2',
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const nClouds = quality.id === 'low' ? 4 : 8;
    for (let i = 0; i < nClouds; i++) {
        const c = new THREE.Mesh(new THREE.PlaneGeometry(40 + i * 8, 10 + (i % 3) * 4), cloudMat);
        c.position.set(-120 + i * 55, 55 + (i % 4) * 8, -200 + (i % 5) * 60);
        c.rotation.y = Math.PI * 0.1 * i;
        c.rotation.x = -0.15;
        group.add(c);
    }

    const sun = new THREE.DirectionalLight(0xffe4c0, 2.1);
    sun.position.set(120, 90, -80);
    sun.castShadow = quality.shadows;
    if (quality.shadows) {
        sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 420;
        sun.shadow.camera.left = -160;
        sun.shadow.camera.right = 160;
        sun.shadow.camera.top = 160;
        sun.shadow.camera.bottom = -160;
        sun.shadow.bias = -0.0002;
        sun.shadow.normalBias = 0.04;
    }
    group.add(sun);

    const hemi = new THREE.HemisphereLight(0xa8c4e0, 0x4a4030, 0.55);
    group.add(hemi);

    const fill = new THREE.DirectionalLight(0xb0c8e0, 0.35);
    fill.position.set(-60, 40, 80);
    group.add(fill);

    scene.add(group);
    scene.fog = new THREE.FogExp2(0xc4b8a0, 0.00115);

    return {
        update(t) {
            const pulse = 0.97 + Math.sin(t * 0.05) * 0.03;
            sun.intensity = 2.1 * pulse;
            sky.position.copy(ctx.camera.position);
        },
        sun,
        dispose() {
            skyGeo.dispose();
            skyMat.dispose();
            cloudMat.dispose();
            scene.remove(group);
        }
    };
}
