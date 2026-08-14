/**
 * Poço d’água: superfície com ondas leves e reflexo do céu procedural.
 */

import * as THREE from 'three';
import { WATER } from './config.js';
import { SKY_GLSL, NOISE_GLSL } from './sky.js';

export function createWater(skyUniforms, quality) {
    const segs = quality.id === 'low' ? 48 : 96;
    const geo = new THREE.CircleGeometry(WATER.radius + 1.4, segs);
    geo.rotateX(-Math.PI / 2);

    const uniforms = {
        ...skyUniforms,
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color(0.78, 0.62, 0.42) },
        uFogDensity: { value: quality.fogDensity },
        uShallow: { value: new THREE.Color(0.22, 0.42, 0.36) },
        uDeep: { value: new THREE.Color(0.04, 0.12, 0.14) }
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        fog: false,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vN;
            uniform float uTime;
            void main() {
                vec3 p = position;
                float w = sin(p.x * 0.38 + uTime * 0.7) * 0.06
                        + cos(p.z * 0.46 + uTime * 0.55) * 0.05;
                p.y += w;
                vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
                vN = normalize(mat3(modelMatrix) * vec3(-cos(p.x * 0.38 + uTime * 0.7) * 0.04, 1.0,
                    sin(p.z * 0.46 + uTime * 0.55) * 0.03));
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vN;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            uniform vec3 uShallow;
            uniform vec3 uDeep;
            ${SKY_GLSL}
            ${NOISE_GLSL}
            void main() {
                vec3 n = normalize(vN);
                vec3 view = normalize(cameraPosition - vWorld);
                vec3 reflDir = reflect(-view, n);
                reflDir.y = abs(reflDir.y);
                vec3 sky = sfSky(normalize(reflDir));
                float fres = pow(1.0 - max(dot(view, n), 0.0), 4.0);
                float dist = length(vWorld.xz);
                float depth = smoothstep(8.0, 26.0, dist);
                vec3 water = mix(uShallow, uDeep, 1.0 - depth);
                vec3 col = mix(water, sky, 0.28 + fres * 0.55);
                float spark = pow(max(dot(normalize(uSunDir + view), n), 0.0), 80.0);
                col += uSunColor * spark * 0.65;
                float fog = 1.0 - exp(-uFogDensity * length(vWorld - cameraPosition));
                col = mix(col, uFogColor, clamp(fog, 0.0, 0.85));
                gl_FragColor = vec4(col, 0.92);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = WATER.surfaceY;
    mesh.receiveShadow = true;
    mesh.name = 'water';
    return mesh;
}
