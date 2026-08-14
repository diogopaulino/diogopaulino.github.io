/**
 * Caústicas projetadas no fundo e pele iridescente da arraia.
 * Injetadas em MeshStandardMaterial via onBeforeCompile.
 */

const CAUSTIC_KEY = 'nereida-caustics-v1';
const SKIN_KEY = 'nereida-skin-v1';

export function applyCaustics(material, strength = 0.42) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.uniforms.uCaustic = { value: strength };
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                `#include <common>\nvarying vec3 vWorldPos;`
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
                uniform float uCaustic;
                varying vec3 vWorldPos;
                float caustic(vec2 p, float t) {
                    vec2 q = p;
                    float c = 0.0;
                    c += sin(q.x * 3.1 + t * 1.25) * sin(q.y * 2.7 - t * 0.9);
                    c += sin(q.x * 5.4 - t * 0.7) * sin(q.y * 4.2 + t * 1.05);
                    c += sin((q.x + q.y) * 2.15 + t * 0.6);
                    return pow(max(c * 0.28 + 0.18, 0.0), 2.15);
                }`
            )
            .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                float cau = caustic(vWorldPos.xz * 0.11, uTime);
                float depthFade = smoothstep(2.0, 28.0, vWorldPos.y);
                totalEmissiveRadiance += vec3(0.22, 0.85, 0.92) * cau * uCaustic * depthFade;`
            );
        material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => CAUSTIC_KEY;
    return material;
}

export function applyMantaSkin(material) {
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
                uniform float uTime;`
            )
            .replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
                float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewPosition)), 0.0), 2.4);
                vec3 irid = vec3(0.25, 0.95, 0.85) * fres + vec3(0.55, 0.35, 1.0) * fres * fres;
                totalEmissiveRadiance += irid * (0.35 + 0.15 * sin(uTime * 2.2));`
            );
        material.userData.shader = shader;
    };
    material.customProgramCacheKey = () => SKIN_KEY;
    return material;
}

export function tickShaders(root, time) {
    root.traverse((obj) => {
        const sh = obj.material?.userData?.shader;
        if (sh?.uniforms?.uTime) sh.uniforms.uTime.value = time;
        if (Array.isArray(obj.material)) {
            for (const m of obj.material) {
                if (m.userData?.shader?.uniforms?.uTime) {
                    m.userData.shader.uniforms.uTime.value = time;
                }
            }
        }
    });
}
