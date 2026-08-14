/**
 * Shaders do mundo: água, queda, musgo no rochedo e o céu de Eyra.
 * Injetados em MeshStandardMaterial via onBeforeCompile quando preciso.
 */

const WATER_KEY = 'eyra-water-v1';
const ROCK_KEY = 'eyra-rock-v1';
const LEAF_KEY = 'eyra-leaf-v1';

export function applyWater(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>\nuniform float uTime;\nvarying vec3 vWorldPos;`
            )
            .replace(
                '#include <begin_vertex>',
                `#include <begin_vertex>
                transformed.z += sin(position.x * 0.18 + uTime * 1.1) * 0.12
                               + cos(position.y * 0.22 + uTime * 0.9) * 0.1;`
            )
            .replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>\nvWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
                uniform float uTime;
                varying vec3 vWorldPos;`
            )
            .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                float spark = step(0.97, fract(sin(dot(vWorldPos.xz * 0.35, vec2(12.9898, 78.233)) + uTime) * 43758.5453));
                float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 2.4);
                totalEmissiveRadiance += vec3(0.35, 0.85, 0.8) * spark * 0.65;
                totalEmissiveRadiance += vec3(0.2, 0.55, 0.5) * fres * 0.25;`
            );
        material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => WATER_KEY;
    return material;
}

export function applyRockMoss(material, strength = 0.55) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uMoss = { value: strength };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>\nvarying vec3 vWorldN;\nvarying vec3 vWorldP;`
        ).replace(
            '#include <worldpos_vertex>',
            `#include <worldpos_vertex>
            vWorldP = (modelMatrix * vec4(transformed, 1.0)).xyz;
            vWorldN = normalize(mat3(modelMatrix) * normal);`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform float uMoss;
            varying vec3 vWorldN;
            varying vec3 vWorldP;`
        ).replace(
            '#include <color_fragment>',
            `#include <color_fragment>
            float up = smoothstep(0.18, 0.72, vWorldN.y);
            vec3 moss = vec3(0.12, 0.42, 0.18);
            diffuseColor.rgb = mix(diffuseColor.rgb, moss, up * uMoss);
            float vein = sin(vWorldP.y * 0.35 + vWorldP.x * 0.12) * 0.5 + 0.5;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.08, 0.22, 0.16), vein * 0.12 * up);`
        );
        material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => ROCK_KEY;
    return material;
}

export function waterfallMaterial() {
    const mat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 }
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float uTime;
            varying vec2 vUv;
            void main() {
                float yv = vUv.y + uTime * 0.55;
                float band = abs(sin(yv * 28.0 + sin(vUv.x * 12.0 + uTime) * 1.4));
                float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
                float mist = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.75, vUv.y);
                vec3 col = mix(vec3(0.55, 0.85, 0.92), vec3(0.9, 0.98, 1.0), band);
                float alpha = edge * mist * (0.28 + band * 0.45);
                gl_FragColor = vec4(col, alpha);
            }
        `
    });
    mat.userData.shader = mat;
    return mat;
}

export function applyLeafSway(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>\nuniform float uTime;`
        ).replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            float sway = sin(uTime * 0.7 + position.x * 0.4 + position.z * 0.3) * 0.08;
            transformed.x += sway * position.y * 0.15;
            transformed.z += cos(uTime * 0.55 + position.y) * 0.05 * position.y * 0.1;`
        );
        material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => LEAF_KEY;
    return material;
}

export function tickShaders(root, time) {
    root.traverse((obj) => {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
            if (!m) continue;
            if (m.uniforms?.uTime) m.uniforms.uTime.value = time;
            if (m.userData?.shader?.uniforms?.uTime) {
                m.userData.shader.uniforms.uTime.value = time;
            }
        }
    });
}
