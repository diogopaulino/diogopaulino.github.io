/**
 * Terreno do vale.
 *
 * O percurso tem 4,2 km: em vez de um heightmap (o `createTerrain` do kit cobre
 * ~300 m), uma malha radial segue a câmera e é deslocada na GPU pelas funções
 * analíticas de `river.js` — as mesmas que a CPU usa para plantar árvores,
 * assentar torres e limitar a navegação.
 *
 * O material é um `MeshStandardMaterial` estendido (sombras, IBL e névoa do
 * palco continuam valendo) com quatro camadas PBR reais do kit:
 *
 *   seixos/areia  coast_sand_rocks_02   praia e leito raso
 *   grama         leafy_grass           encostas suaves
 *   folhiço       forest_leaves_02      manchas de mata (ruído) e chão alto
 *   rocha         cliff_side            encostas íngremes (projeção triplanar)
 *
 * Pesos (h = altura, n.y = componente vertical da normal, r = ruído fbm):
 *   praia  = 1 − smoothstep(1,6; 3,4; h + 0,8·(r − ½))
 *   rocha  = 1 − smoothstep(0,60; 0,80; n.y + 0,10·(r₂ − ½))
 *   mata   = smoothstep(0,45; 0,70; r) · (1 − praia)
 *   cor    = mix(mix(mix(grama, folhiço, mata), seixos, praia), rocha, rocha)
 * Anti-repetição: cada camada é lida em duas escalas (s e 0,23·s, rotacionada)
 * e misturada por ruído e distância — de longe só a escala grande aparece.
 * Faixa molhada: abaixo de h = 0,7 m o albedo escurece (×0,55) e a rugosidade cai.
 */

import * as THREE from 'three';
import { pbrSet } from '../../shared/gfx/assets.js';
import { GLSL_NOISE } from '../../shared/gfx/core.js';
import { buildRadialGrid } from './utils.js?v=50';
import { RIVER_GLSL } from './river.js?v=50';

function repeating(tex) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
}

export function createTerrain(quality) {
    const low = quality.id === 'low';
    const geometry = buildRadialGrid(low ? 110 : 176, quality.terrainSegments, 2600, 1.5);

    const sand = pbrSet('coast_sand_rocks_02');
    const grass = pbrSet('leafy_grass');
    const leaves = pbrSet('forest_leaves_02');
    const rock = pbrSet('cliff_side');
    const uniforms = {
        tSand: { value: repeating(sand.map) },
        tGrass: { value: repeating(grass.map) },
        tLeaves: { value: repeating(leaves.map) },
        tRock: { value: repeating(rock.map) },
        tSandN: { value: repeating(sand.normalMap) },
        tGrassN: { value: repeating(grass.normalMap) },
        tRockN: { value: repeating(rock.normalMap) }
    };

    const material = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.94,
        metalness: 0.0,
        envMapIntensity: 0.7
    });
    if (!low) material.defines = { RK_NORMALS: 1 };

    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);

        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                /* glsl */ `
                #include <common>
                varying vec3 vTerrainWorld;
                varying vec3 vTerrainNormal;
                ${RIVER_GLSL}
                `
            )
            .replace(
                '#include <beginnormal_vertex>',
                /* glsl */ `
                vec3 rkWorld = (modelMatrix * vec4(position, 1.0)).xyz;
                float rkDist = length(rkWorld.xz - cameraPosition.xz);
                float rkEps = 0.45 + rkDist * 0.01;
                float rkH = rkHeight(rkWorld.x, rkWorld.z);
                float rkHL = rkHeight(rkWorld.x - rkEps, rkWorld.z);
                float rkHR = rkHeight(rkWorld.x + rkEps, rkWorld.z);
                float rkHD = rkHeight(rkWorld.x, rkWorld.z - rkEps);
                float rkHU = rkHeight(rkWorld.x, rkWorld.z + rkEps);
                vec3 objectNormal = normalize(vec3(rkHL - rkHR, 2.0 * rkEps, rkHD - rkHU));
                vTerrainNormal = objectNormal;
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
                varying vec3 vTerrainNormal;
                uniform sampler2D tSand;
                uniform sampler2D tGrass;
                uniform sampler2D tLeaves;
                uniform sampler2D tRock;
                uniform sampler2D tSandN;
                uniform sampler2D tGrassN;
                uniform sampler2D tRockN;
                ${GLSL_NOISE}
                #ifdef RK_NORMALS
                ${RIVER_GLSL}
                #endif

                // duas escalas misturadas (anti-repetição): k = 0 perto, 1 longe
                vec4 rkTile(sampler2D t, vec2 p, float s, float k) {
                    vec4 a = texture2D(t, p * s);
                    vec4 b = texture2D(t, mat2(0.8, -0.6, 0.6, 0.8) * p * s * 0.23 + 0.37);
                    return mix(a, b, k);
                }
                vec3 rkWorldNormal = vec3(0.0, 1.0, 0.0);
                float rkRough = 0.9;
                `
            )
            .replace(
                '#include <color_fragment>',
                /* glsl */ `
                #include <color_fragment>
                {
                    vec3 p = vTerrainWorld;
                    vec3 n = normalize(vTerrainNormal);
                    float h = p.y;
                    float dist = length(p - cameraPosition);
                    #ifdef RK_NORMALS
                    // normal analítica por pixel (a malha radial é esparsa demais nas falésias:
                    // com a normal por vértice a rocha "serrilha" em dentes de grama)
                    float ne = 0.35 + dist * 0.004;
                    n = normalize(vec3(
                        rkHeight(p.x - ne, p.z) - rkHeight(p.x + ne, p.z), 2.0 * ne,
                        rkHeight(p.x, p.z - ne) - rkHeight(p.x, p.z + ne)));
                    h = rkHeight(p.x, p.z);
                    #endif
                    float r1 = gfxFbm(p.xz * 0.035);
                    float r2 = gfxNoise(p.xz * 0.21);
                    float far = smoothstep(16.0, 90.0, dist);
                    float k = mix(0.45 * smoothstep(0.4, 0.75, gfxNoise(p.xz * 0.043)), 0.94, far);

                    float wBeach = 1.0 - smoothstep(1.6, 3.4, h + 0.8 * (r1 - 0.5));
                    float wRock = 1.0 - smoothstep(0.60, 0.80, n.y + 0.10 * (r2 - 0.5));
                    float wWood = smoothstep(0.45, 0.70, r1) * (1.0 - wBeach);

                    vec3 cGrass = rkTile(tGrass, p.xz, 0.42, k).rgb * vec3(0.78, 1.12, 0.62) * 1.25;
                    vec3 cLeaves = rkTile(tLeaves, p.xz, 0.36, k).rgb * vec3(1.05, 0.98, 0.8) * 1.1;
                    vec3 cSand = rkTile(tSand, p.xz, 0.3, k).rgb * 1.08;
                    // rocha triplanar: projeção lateral pelo eixo dominante + topo
                    vec3 an = abs(n);
                    vec2 side = an.x > an.z ? p.zy : p.xy;
                    vec3 cRock = rkTile(tRock, side * vec2(1.0, 1.35), 0.11, k * 0.8).rgb;
                    cRock = mix(cRock, rkTile(tRock, p.xz, 0.11, k).rgb, smoothstep(0.55, 0.8, n.y));
                    cRock *= vec3(1.02, 0.98, 0.94) * (0.85 + 0.3 * r2);

                    vec3 col = mix(cGrass, cLeaves, wWood * 0.8);
                    col *= 0.82 + 0.36 * r1;
                    col = mix(col, cSand, wBeach);
                    col = mix(col, cRock, wRock);

                    // leito submerso: lodo escuro; faixa molhada junto à água
                    float wet = 1.0 - smoothstep(0.15, 0.75, h);
                    col *= mix(1.0, 0.55, wet);
                    col = mix(col, vec3(0.045, 0.05, 0.04), smoothstep(-0.6, -3.0, h));
                    // musgo escuro na base das falésias e verde nos topos
                    col = mix(col, col * vec3(0.7, 0.86, 0.55), wRock * smoothstep(0.62, 0.8, n.y));
                    diffuseColor.rgb = col;

                    rkRough = mix(mix(0.93, 0.86, wRock), 0.45, wet * (1.0 - wRock));
                    rkWorldNormal = n;
                    #ifdef RK_NORMALS
                    float nk = 1.0 - smoothstep(40.0, 150.0, dist);
                    vec2 dG = rkTile(tGrassN, p.xz, 0.42, k).xy * 2.0 - 1.0;
                    vec2 dS = rkTile(tSandN, p.xz, 0.3, k).xy * 2.0 - 1.0;
                    vec2 dR = rkTile(tRockN, side * vec2(1.0, 1.35), 0.11, k * 0.8).xy * 2.0 - 1.0;
                    vec2 dTop = mix(dG * 0.8, dS * 1.1, wBeach);
                    // topo: xy do mapa → eixos X/Z do mundo; lado: tangente horizontal + vertical
                    vec3 tSide = an.x > an.z ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
                    vec3 pert = mix(vec3(dTop.x, 0.0, -dTop.y), (tSide * dR.x + vec3(0.0, 1.0, 0.0) * dR.y) * 1.5, wRock);
                    rkWorldNormal = normalize(n + pert * nk);
                    #endif
                }
                `
            )
            .replace(
                '#include <roughnessmap_fragment>',
                /* glsl */ `
                #include <roughnessmap_fragment>
                roughnessFactor = rkRough;
                `
            )
            .replace(
                '#include <normal_fragment_maps>',
                /* glsl */ `
                #include <normal_fragment_maps>
                normal = normalize((viewMatrix * vec4(rkWorldNormal, 0.0)).xyz);
                `
            );
    };

    // Chave de cache: garante que o three não reaproveite um program de outro
    // material standard sem as injeções acima.
    material.customProgramCacheKey = () => `river-knight-terrain-${low ? 0 : 1}`;

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
