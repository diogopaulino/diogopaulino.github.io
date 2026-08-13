/**
 * Terreno do vale.
 *
 * Usa `MeshStandardMaterial` com `onBeforeCompile`: o deslocamento e as cores
 * vêm das funções analíticas do rio (GPU), mas o material continua sendo PBR
 * de verdade — recebe sombras, névoa e a mesma iluminação dos outros objetos.
 */

import * as THREE from 'three';
import { buildRadialGrid } from './utils.js';
import { RIVER_GLSL } from './river.js';
import { NOISE_GLSL } from './sky.js';

export function createTerrain(quality) {
    const geometry = buildRadialGrid(
        quality.id === 'low' ? 110 : 168,
        quality.terrainSegments,
        2600,
        1.6
    );

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.94,
        metalness: 0.0,
        dithering: true
    });

    material.onBeforeCompile = (shader) => {
        material.userData.shader = shader;

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                /* glsl */ `
                #include <common>
                varying vec3 vTerrainWorld;
                varying float vTerrainSlope;
                ${RIVER_GLSL}
                `
            )
            .replace(
                '#include <beginnormal_vertex>',
                /* glsl */ `
                vec3 rkWorld = (modelMatrix * vec4(position, 1.0)).xyz;
                float rkDist = length(rkWorld.xz - cameraPosition.xz);
                float rkEps = 0.55 + rkDist * 0.012;
                float rkH = rkHeight(rkWorld.x, rkWorld.z);
                float rkHL = rkHeight(rkWorld.x - rkEps, rkWorld.z);
                float rkHR = rkHeight(rkWorld.x + rkEps, rkWorld.z);
                float rkHD = rkHeight(rkWorld.x, rkWorld.z - rkEps);
                float rkHU = rkHeight(rkWorld.x, rkWorld.z + rkEps);
                vec3 objectNormal = normalize(vec3(rkHL - rkHR, 2.0 * rkEps, rkHD - rkHU));
                vTerrainSlope = objectNormal.y;
                vTerrainWorld = vec3(rkWorld.x, rkH, rkWorld.z);
                `
            )
            .replace(
                '#include <begin_vertex>',
                /* glsl */ `
                // Saia da borda: os anéis mais externos afundam para que o
                // limite do disco de terreno nunca apareça contra o céu.
                float rkSkirt = smoothstep(0.88, 1.0, uv.x) * 900.0;
                vec3 transformed = vec3(position.x, rkH - rkSkirt, position.z);
                `
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                /* glsl */ `
                #include <common>
                varying vec3 vTerrainWorld;
                varying float vTerrainSlope;
                ${NOISE_GLSL}

                vec3 rkTerrainColor(vec3 p, float slope) {
                    float h = p.y;

                    vec3 silt = vec3(0.11, 0.10, 0.08);
                    vec3 sand = vec3(0.46, 0.40, 0.29);
                    vec3 grass = vec3(0.13, 0.21, 0.09);
                    vec3 grassDry = vec3(0.25, 0.24, 0.11);
                    vec3 rock = vec3(0.22, 0.21, 0.20);
                    vec3 snow = vec3(0.82, 0.84, 0.88);

                    float n1 = rkFbm(p.xz * 0.045);
                    float n2 = rkValueNoise(p.xz * 0.35);

                    // Leito submerso → areia da praia → grama.
                    vec3 col = mix(silt, sand, smoothstep(-3.4, -0.4, h));
                    col = mix(col, mix(grass, grassDry, n1), smoothstep(0.15, 2.4, h));

                    // Faixas de rocha nas encostas íngremes.
                    float rocky = 1.0 - smoothstep(0.52, 0.82, slope);
                    col = mix(col, rock * (0.75 + n2 * 0.5), rocky);

                    // Cumes distantes recebem neve.
                    col = mix(col, snow, smoothstep(52.0, 88.0, h) * smoothstep(0.55, 0.85, slope));

                    // Variação orgânica de tom.
                    col *= 0.78 + n1 * 0.38;
                    col *= 0.94 + n2 * 0.12;

                    // Faixa úmida / areia molhada junto à água.
                    float wet = (1.0 - smoothstep(0.0, 1.55, h)) * smoothstep(-1.4, 0.35, h);
                    col = mix(col, sand * vec3(0.52, 0.48, 0.40), wet * 0.55);
                    col *= mix(0.42, 1.0, smoothstep(-0.35, 1.55, h));
                    return col;
                }
                `
            )
            .replace(
                '#include <color_fragment>',
                /* glsl */ `
                #include <color_fragment>
                diffuseColor.rgb = rkTerrainColor(vTerrainWorld, vTerrainSlope);
                `
            )
            .replace(
                '#include <roughnessmap_fragment>',
                /* glsl */ `
                #include <roughnessmap_fragment>
                roughnessFactor *= 0.86 + 0.2 * rkValueNoise(vTerrainWorld.xz * 0.6);
                `
            )
            .replace(
                '#include <normal_fragment_maps>',
                /* glsl */ `
                #include <normal_fragment_maps>
                float rkBumpE = 0.9;
                float rkB0 = rkFbm(vTerrainWorld.xz * 0.55);
                float rkBx = rkFbm((vTerrainWorld.xz + vec2(rkBumpE, 0.0)) * 0.55);
                float rkBz = rkFbm((vTerrainWorld.xz + vec2(0.0, rkBumpE)) * 0.55);
                float rkBumpFade = 1.0 - smoothstep(60.0, 220.0, length(vTerrainWorld.xz - cameraPosition.xz));
                normal = normalize(normal + vec3(rkB0 - rkBx, 0.0, rkB0 - rkBz) * 0.85 * rkBumpFade);
                `
            );
    };

    // Chave de cache: garante que o three não reaproveite um program de outro
    // material standard sem as injeções acima.
    material.customProgramCacheKey = () => 'river-knight-terrain';

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.name = 'terrain';

    return {
        mesh,
        material,
        update(camera) {
            mesh.position.set(camera.position.x, 0, camera.position.z);
        }
    };
}
