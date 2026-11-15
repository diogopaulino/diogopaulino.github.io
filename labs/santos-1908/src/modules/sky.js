/**
 * sky — céu matinal de inverno austral (18 de junho de 1908, ~9h30, G02).
 * Gradiente atmosférico com nuvens FBM procedurais, disco solar e neblina costeira.
 */

import * as THREE from 'three';

export function create(ctx) {
    const { scene, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'sky';

    const skyGeo = new THREE.SphereGeometry(950, 36, 24);
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            topColor: { value: new THREE.Color('#4d80b0') },
            midColor: { value: new THREE.Color('#b9c6cc') },
            bottomColor: { value: new THREE.Color('#eadcc4') },
            sunDir: { value: new THREE.Vector3(0.55, 0.34, -0.42).normalize() },
            sunColor: { value: new THREE.Color('#fff0cf') }
        },
        vertexShader: /* glsl */ `
            varying vec3 vDir;
            void main() {
                vDir = normalize(position);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform vec3 topColor;
            uniform vec3 midColor;
            uniform vec3 bottomColor;
            uniform vec3 sunDir;
            uniform vec3 sunColor;
            varying vec3 vDir;

            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                    f.y
                );
            }
            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i = 0; i < 4; i++) {
                    v += a * noise(p);
                    p = p * 2.04 + 11.3;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec3 n = normalize(vDir);
                float h = clamp(n.y, -0.1, 1.0);
                vec3 col = mix(bottomColor, midColor, smoothstep(-0.02, 0.22, h));
                col = mix(col, topColor, smoothstep(0.18, 0.78, h));

                // Nuvens suaves de manhã de inverno
                if (n.y > 0.02) {
                    vec2 cuv = n.xz / (n.y + 0.18) * 1.1 + vec2(uTime * 0.004, uTime * 0.002);
                    float cl = fbm(cuv);
                    float cmask = smoothstep(0.46, 0.78, cl) * smoothstep(0.02, 0.22, n.y);
                    vec3 cloudCol = mix(vec3(0.95, 0.94, 0.91), sunColor, 0.22);
                    col = mix(col, cloudCol, cmask * 0.58);
                }

                // Sol baixo de junho (9h30) com corona e disco
                float sd = max(dot(n, sunDir), 0.0);
                col += sunColor * pow(sd, 6.0) * 0.16;
                col += sunColor * pow(sd, 42.0) * 0.35;
                col += sunColor * smoothstep(0.9985, 0.9996, sd) * 2.2;

                // Bruma costeira no horizonte
                float haze = pow(1.0 - max(n.y, 0.0), 3.2) * 0.38;
                col = mix(col, bottomColor, haze);
                gl_FragColor = vec4(col, 1.0);
            }
        `
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    group.add(sky);

    const sun = new THREE.DirectionalLight(0xffe9c8, 2.35);
    sun.position.set(130, 82, -98);
    sun.castShadow = quality.shadows;
    if (quality.shadows) {
        sun.shadow.mapSize.set(quality.shadowMap, quality.shadowMap);
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 440;
        sun.shadow.camera.left = -160;
        sun.shadow.camera.right = 160;
        sun.shadow.camera.top = 160;
        sun.shadow.camera.bottom = -160;
        sun.shadow.bias = -0.0002;
        sun.shadow.normalBias = 0.04;
    }
    group.add(sun);

    const hemi = new THREE.HemisphereLight(0x9fc2e6, 0x524634, 0.68);
    group.add(hemi);

    const fill = new THREE.DirectionalLight(0xaac6e4, 0.42);
    fill.position.set(-70, 45, 85);
    group.add(fill);

    scene.add(group);
    scene.fog = new THREE.FogExp2(0xd2cab8, 0.00095);

    return {
        update(t) {
            skyMat.uniforms.uTime.value = t;
            const pulse = 0.98 + Math.sin(t * 0.05) * 0.02;
            sun.intensity = 2.35 * pulse;
            sky.position.copy(ctx.camera.position);
        },
        sun,
        dispose() {
            skyGeo.dispose();
            skyMat.dispose();
            scene.remove(group);
        }
    };
}
