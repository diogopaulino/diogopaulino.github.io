/**
 * estuary — água do canal + margens (G01, G03).
 * Ondulação suave no vertex shader; tom mais turvo perto do cais.
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { fbm } from '../utils.js';

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'estuary';

    const seg = quality.waterSeg;
    const waterGeo = new THREE.PlaneGeometry(520, 700, seg, Math.floor(seg * 1.2));
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color('#163848') },
            uShallow: { value: new THREE.Color('#2a5548') },
            uFoam: { value: new THREE.Color('#c8d4d0') },
            uQuayX: { value: LAYOUT.quayX }
        },
        vertexShader: /* glsl */ `
            uniform float uTime;
            varying vec3 vPos;
            varying float vWave;
            void main() {
                vec3 p = position;
                float w = sin(p.x * 0.08 + uTime * 0.6) * 0.12
                        + sin(p.z * 0.05 + uTime * 0.45) * 0.18
                        + sin((p.x + p.z) * 0.12 + uTime * 0.9) * 0.06;
                p.y += w;
                vWave = w;
                vPos = p;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uDeep;
            uniform vec3 uShallow;
            uniform vec3 uFoam;
            uniform float uQuayX;
            varying vec3 vPos;
            varying float vWave;
            void main() {
                float nearQuay = smoothstep(uQuayX - 40.0, uQuayX + 5.0, vPos.x);
                vec3 col = mix(uDeep, uShallow, nearQuay * 0.85);
                float sparkle = pow(max(vWave * 2.0 + 0.3, 0.0), 2.0) * 0.15;
                col += uFoam * sparkle * (1.0 - nearQuay * 0.5);
                float fres = pow(1.0 - abs(normalize(cameraPosition - vPos).y), 2.5);
                col = mix(col, uDeep * 1.2, fres * 0.35);
                gl_FragColor = vec4(col, 0.92);
            }
        `,
        transparent: true,
        depthWrite: true
    });

    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(0, 0, -50);
    water.receiveShadow = true;
    group.add(water);

    // Margem oposta (Guarujá / Itapema tipológico)
    const bankGeo = new THREE.PlaneGeometry(80, 700, 8, 24);
    bankGeo.rotateX(-Math.PI / 2);
    const pos = bankGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const x = pos.getX(i);
        const h = fbm(x * 0.02, z * 0.01, 3) * 4 + 1.2;
        pos.setY(i, h);
    }
    bankGeo.computeVertexNormals();
    const bank = new THREE.Mesh(bankGeo, mats.sand);
    bank.position.set(-90, 0.2, -50);
    bank.receiveShadow = true;
    group.add(bank);

    // Vegetação baixa na margem
    const bushGeo = new THREE.ConeGeometry(2.2, 4, 5);
    for (let i = 0; i < quality.trees * 0.4; i++) {
        const b = new THREE.Mesh(bushGeo, mats.foliage);
        b.position.set(-70 - Math.random() * 30, 2, -280 + Math.random() * 500);
        b.scale.setScalar(0.6 + Math.random() * 1.2);
        b.castShadow = quality.shadows;
        group.add(b);
    }

    scene.add(group);

    return {
        update(t) {
            waterMat.uniforms.uTime.value = t;
        },
        dispose() {
            waterGeo.dispose();
            waterMat.dispose();
            bankGeo.dispose();
            bushGeo.dispose();
            scene.remove(group);
        }
    };
}
