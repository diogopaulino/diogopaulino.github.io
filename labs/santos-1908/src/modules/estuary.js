/**
 * estuary — água do canal + margens (G01, G03).
 * Ondulação suave no vertex shader; tom mais turvo perto do cais.
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { fbm, seeded } from '../utils.js';

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

    // Vegetação de mangue na margem oposta (InstancedMesh orgânico)
    const bushGeo = new THREE.IcosahedronGeometry(2.1, 2);
    const bPos = bushGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
        const bx = bPos.getX(i);
        const by = bPos.getY(i);
        const bz = bPos.getZ(i);
        const m = 0.8 + 0.25 * Math.sin(bx * 0.9 + bz * 0.8);
        bPos.setXYZ(i, bx * m, by * 0.72 * m, bz * m);
    }
    bushGeo.computeVertexNormals();

    const bushCount = Math.max(8, Math.floor(quality.trees * 0.4));
    const bushes = new THREE.InstancedMesh(bushGeo, mats.foliage, bushCount);
    bushes.castShadow = quality.shadows;
    const vegetationRandom = seeded(0x1908e57);
    const mat4 = new THREE.Matrix4();
    const posVec = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const sclVec = new THREE.Vector3();
    for (let i = 0; i < bushCount; i++) {
        posVec.set(-70 - vegetationRandom() * 30, 1.8, -280 + vegetationRandom() * 500);
        quat.setFromEuler(new THREE.Euler(0, vegetationRandom() * Math.PI * 2, 0));
        const sc = 0.65 + vegetationRandom() * 1.15;
        sclVec.set(sc, sc * 0.85, sc);
        mat4.compose(posVec, quat, sclVec);
        bushes.setMatrixAt(i, mat4);
    }
    bushes.instanceMatrix.needsUpdate = true;
    group.add(bushes);

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

