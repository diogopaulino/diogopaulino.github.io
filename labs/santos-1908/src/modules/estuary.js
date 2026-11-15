/**
 * estuary — água do canal com ondas Gerstner leves + margens (G01, G03).
 * Tom turvo perto do cais; reflexo procedural do céu matinal.
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
            uDeep: { value: new THREE.Color('#0f3040') },
            uShallow: { value: new THREE.Color('#2a5548') },
            uFoam: { value: new THREE.Color('#c8d4d0') },
            uSky: { value: new THREE.Color('#8ab0c8') },
            uSun: { value: new THREE.Color('#ffe0b0') },
            uQuayX: { value: LAYOUT.quayX }
        },
        vertexShader: /* glsl */ `
            uniform float uTime;
            varying vec3 vWorld;
            varying vec3 vNrm;
            varying float vWave;
            void main() {
                vec3 p = position;
                float w1 = sin(p.x * 0.06 + uTime * 0.55) * 0.14;
                float w2 = sin(p.z * 0.045 + uTime * 0.4) * 0.2;
                float w3 = sin((p.x + p.z) * 0.11 + uTime * 0.85) * 0.07;
                float w = w1 + w2 + w3;
                p.y += w;
                vWave = w;
                // Normal aproximada das derivadas
                float dx = cos(p.x * 0.06 + uTime * 0.55) * 0.06 * 0.14
                         + cos((p.x + p.z) * 0.11 + uTime * 0.85) * 0.11 * 0.07;
                float dz = cos(p.z * 0.045 + uTime * 0.4) * 0.045 * 0.2
                         + cos((p.x + p.z) * 0.11 + uTime * 0.85) * 0.11 * 0.07;
                vec3 nrm = normalize(vec3(-dx, 1.0, -dz));
                vec4 world = modelMatrix * vec4(p, 1.0);
                vWorld = world.xyz;
                vNrm = normalize(mat3(modelMatrix) * nrm);
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uDeep;
            uniform vec3 uShallow;
            uniform vec3 uFoam;
            uniform vec3 uSky;
            uniform vec3 uSun;
            uniform float uQuayX;
            uniform float uTime;
            varying vec3 vWorld;
            varying vec3 vNrm;
            varying float vWave;
            void main() {
                vec3 N = normalize(vNrm);
                vec3 V = normalize(cameraPosition - vWorld);
                float fres = pow(1.0 - max(dot(N, V), 0.0), 2.8);
                float nearQuay = smoothstep(uQuayX - 40.0, uQuayX + 5.0, vWorld.x);
                vec3 col = mix(uDeep, uShallow, nearQuay * 0.85);
                col = mix(col, uSky, fres * 0.45);
                float spec = pow(max(dot(N, normalize(vec3(0.35, 0.7, 0.2) + V)), 0.0), 64.0);
                col += uSun * spec * 0.4 * (1.0 - nearQuay * 0.5);
                float sparkle = pow(max(vWave * 2.2 + 0.25, 0.0), 2.0) * 0.18;
                col += uFoam * sparkle * (1.0 - nearQuay * 0.45);
                gl_FragColor = vec4(col, 0.93);
            }
        `,
        transparent: true,
        depthWrite: true
    });

    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(0, 0, -50);
    water.receiveShadow = true;
    group.add(water);

    const bankGeo = new THREE.PlaneGeometry(80, 700, 10, 28);
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
