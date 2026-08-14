/**
 * Céu de alvorada, névoa e oceano com ondas de Gerstner.
 * O shader do céu é reaproveitado no reflexo da água.
 */

import * as THREE from 'three';

export const SKY_GLSL = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uGround;
uniform vec3 uSunColor;
uniform vec3 uSunDir;

vec3 hfSky(vec3 dir) {
    float h = dir.y;
    float t = clamp(h * 1.15 + 0.08, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(t, 0.72));
    col = mix(uGround, col, smoothstep(-0.12, 0.04, h));

    float sd = max(dot(normalize(dir), uSunDir), 0.0);
    col += uSunColor * pow(sd, 3.0) * 0.22;
    col += uSunColor * pow(sd, 28.0) * 0.45;
    col += uSunColor * pow(sd, 420.0) * 1.1;
    col += uSunColor * smoothstep(0.9992, 0.9998, sd) * 18.0;
    return col;
}
`;

const CLOUD_GLSL = /* glsl */ `
float hfHash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}
float hfNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hfHash(i);
    float b = hfHash(i + vec2(1.0, 0.0));
    float c = hfHash(i + vec2(1.0, 1.0));
    float d = hfHash(i + vec2(0.0, 1.0));
    return mix(mix(a, b, f.x), mix(d, c, f.x), f.y);
}
float hfFbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * hfNoise(p);
        p = p * 2.07 + 13.1;
        a *= 0.5;
    }
    return v;
}
`;

export function createSkyUniforms() {
    return {
        uZenith: { value: new THREE.Color(0x4a6a9a) },
        uHorizon: { value: new THREE.Color(0xe8a060) },
        uGround: { value: new THREE.Color(0xc48a58) },
        uSunColor: { value: new THREE.Color(0xffc070) },
        uSunDir: { value: new THREE.Vector3(0.72, 0.18, -0.38).normalize() },
        uTime: { value: 0 }
    };
}

export function createSky(uniforms) {
    const geo = new THREE.SphereGeometry(520, 32, 20);
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
            uniform float uTime;
            ${SKY_GLSL}
            ${CLOUD_GLSL}
            void main() {
                vec3 dir = normalize(vPos);
                vec3 col = hfSky(dir);
                float h = dir.y;
                if (h > 0.02) {
                    vec2 uv = dir.xz / max(0.08, h + 0.15);
                    float n = hfFbm(uv * 1.6 + vec2(uTime * 0.012, 0.0));
                    float cloud = smoothstep(0.52, 0.78, n) * smoothstep(0.05, 0.35, h);
                    col = mix(col, vec3(0.92, 0.82, 0.72), cloud * 0.55);
                }
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    return mesh;
}

export function createOcean(uniforms, quality) {
    const segs = quality.id === 'low' ? 48 : quality.id === 'high' ? 96 : 72;
    const geo = new THREE.PlaneGeometry(420, 280, segs, Math.floor(segs * 0.55));
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            ...uniforms,
            uWater: { value: new THREE.Color(0x1a3a48) },
            uFoam: { value: new THREE.Color(0xd8c8a8) }
        },
        transparent: true,
        vertexShader: /* glsl */ `
            uniform float uTime;
            varying vec3 vWorld;
            varying float vFoam;
            vec3 gerstner(vec3 p, vec2 dir, float steep, float wl, float speed) {
                float k = 6.28318 / wl;
                float a = steep / k;
                float f = k * (dot(dir, p.xz) - sqrt(9.8 / k) * uTime * speed);
                p.x += dir.x * a * cos(f);
                p.z += dir.y * a * cos(f);
                p.y += a * sin(f);
                return p;
            }
            void main() {
                vec3 p = position;
                p = gerstner(p, normalize(vec2(1.0, 0.35)), 0.22, 18.0, 1.0);
                p = gerstner(p, normalize(vec2(0.4, -1.0)), 0.14, 9.5, 1.15);
                p = gerstner(p, normalize(vec2(-0.7, 0.6)), 0.08, 4.2, 1.4);
                vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
                vFoam = p.y;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying float vFoam;
            uniform vec3 uWater;
            uniform vec3 uFoam;
            ${SKY_GLSL}
            void main() {
                vec3 n = normalize(vec3(
                    sin(vWorld.x * 0.18 + vFoam) * 0.15,
                    1.0,
                    cos(vWorld.z * 0.14) * 0.12
                ));
                vec3 view = normalize(cameraPosition - vWorld);
                vec3 refl = reflect(-view, n);
                vec3 sky = hfSky(refl);
                float fres = pow(1.0 - max(dot(view, n), 0.0), 4.0);
                vec3 col = mix(uWater, sky, 0.28 + fres * 0.55);
                float shore = 1.0 - smoothstep(-8.0, 14.0, vWorld.z);
                float foam = smoothstep(0.12, 0.42, vFoam) * shore;
                col = mix(col, uFoam, foam * 0.65);
                float alpha = mix(0.92, 0.72, shore);
                gl_FragColor = vec4(col, alpha);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0.02, -40);
    mesh.receiveShadow = true;
    return mesh;
}

export function createLights(scene, quality) {
    const group = new THREE.Group();
    scene.add(group);

    const amb = new THREE.AmbientLight(0x6a5848, 0.28);
    group.add(amb);

    const hemi = new THREE.HemisphereLight(0xc8a070, 0x3a3428, 0.55);
    group.add(hemi);

    const sun = new THREE.DirectionalLight(0xffc080, 2.15);
    sun.position.set(90, 28, -55);
    sun.castShadow = quality.shadows;
    if (quality.shadows) {
        sun.shadow.mapSize.set(quality.shadowSize, quality.shadowSize);
        const s = 70;
        sun.shadow.camera.left = -s;
        sun.shadow.camera.right = s;
        sun.shadow.camera.top = s;
        sun.shadow.camera.bottom = -s;
        sun.shadow.camera.near = 10;
        sun.shadow.camera.far = 240;
        sun.shadow.bias = -0.0007;
        sun.shadow.normalBias = 0.04;
    }
    group.add(sun);
    group.add(sun.target);
    sun.target.position.set(0, 4, 80);

    const fill = new THREE.DirectionalLight(0x6a88aa, 0.22);
    fill.position.set(-40, 20, 30);
    group.add(fill);

    return { group, sun, hemi, amb };
}
