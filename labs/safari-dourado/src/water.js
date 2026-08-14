/**
 * Poço d’água da savana: superfície escura, um pouco especular, com
 * ondulação no vértice. Sem reflexo do disco solar (bloom estourava).
 */

import * as THREE from 'three';
import { WATER } from './config.js';

export function createWater(skyUniforms, quality) {
    const segs = quality.id === 'low' ? 40 : 72;
    const geo = new THREE.CircleGeometry(WATER.radius + 1.2, segs);
    geo.rotateX(-Math.PI / 2);

    const material = new THREE.MeshStandardMaterial({
        color: 0x1c241c,
        roughness: 0.68,
        metalness: 0.04,
        transparent: true,
        opacity: 0.94
    });

    material.userData.uTime = { value: 0 };
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = material.userData.uTime;
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                /* glsl */ `#include <common>
                uniform float uTime;`
            )
            .replace(
                '#include <begin_vertex>',
                /* glsl */ `#include <begin_vertex>
                transformed.y += sin(position.x * 0.28 + uTime * 0.55) * 0.045
                               + cos(position.z * 0.34 + uTime * 0.4) * 0.035;`
            );
    };

    const mesh = new THREE.Mesh(geo, material);
    mesh.position.y = WATER.surfaceY;
    mesh.receiveShadow = true;
    mesh.name = 'water';
    mesh.userData.skyUniforms = skyUniforms;
    return mesh;
}
