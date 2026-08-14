/**
 * Poço d’água: superfície escura da savana, ondulação leve e spec do sol.
 * Sem reflexo do disco solar — isso estourava para branco com bloom.
 */

import * as THREE from 'three';
import { WATER } from './config.js';

export function createWater(skyUniforms, quality) {
    const segs = quality.id === 'low' ? 48 : 80;
    const geo = new THREE.CircleGeometry(WATER.radius + 1.4, segs);
    geo.rotateX(-Math.PI / 2);

    const uniforms = {
        uSunDir: skyUniforms.uSunDir,
        uSunColor: skyUniforms.uSunColor,
        uHorizon: skyUniforms.uHorizon,
        uTime: { value: 0 },
        uFogColor: { value: new THREE.Color(0.55, 0.38, 0.22) },
        uFogDensity: { value: quality.fogDensity }
    };

    const material = new THREE.ShaderMaterial({
        uniforms,
        transparent: true,
        fog: false,
        toneMapped: true,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vN;
            uniform float uTime;
            void main() {
                vec3 p = position;
                float w = sin(p.x * 0.32 + uTime * 0.55) * 0.05
                        + cos(p.z * 0.41 + uTime * 0.42) * 0.04;
                p.y += w;
                vec4 world = modelMatrix * vec4(p, 1.0);
                vWorld = world.xyz;
                vN = normalize(mat3(modelMatrix) * vec3(
                    -cos(p.x * 0.32 + uTime * 0.55) * 0.03,
                    1.0,
                    sin(p.z * 0.41 + uTime * 0.42) * 0.025
                ));
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vN;
            uniform vec3 uSunDir;
            uniform vec3 uSunColor;
            uniform vec3 uHorizon;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            void main() {
                vec3 n = normalize(vN);
                vec3 view = normalize(cameraPosition - vWorld);
                float fres = pow(1.0 - max(dot(view, n), 0.0), 4.0);
                float dist = length(vWorld.xz);
                float shore = smoothstep(18.0, 4.0, dist);
                vec3 deep = vec3(0.08, 0.10, 0.08);
                vec3 mud = vec3(0.22, 0.16, 0.09);
                vec3 col = mix(deep, mud, shore);
                col = mix(col, uHorizon * 0.22, fres * 0.18);
                float spec = pow(max(dot(normalize(uSunDir + view), n), 0.0), 480.0);
                col += uSunColor * spec * 0.06;
                float fog = 1.0 - exp(-uFogDensity * 0.65 * length(vWorld - cameraPosition));
                col = mix(col, uFogColor, clamp(fog, 0.0, 0.55));
                gl_FragColor = vec4(col, 0.9);
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
