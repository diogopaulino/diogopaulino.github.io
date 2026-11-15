/**
 * estuary — água do canal + margem do Guarujá/Itapema (G01, G03).
 * Shader com micro-normais, reflexo Fresnel, brilho solar matinal e manguezal denso.
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { fbm, seeded } from '../utils.js';

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'estuary';

    const seg = quality.waterSeg;
    const waterGeo = new THREE.PlaneGeometry(540, 740, seg, Math.floor(seg * 1.2));
    waterGeo.rotateX(-Math.PI / 2);

    const waterMat = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color('#133c4d') },
            uShallow: { value: new THREE.Color('#2c5c4e') },
            uSkyHorizon: { value: new THREE.Color('#d9d2c2') },
            uSkyZenith: { value: new THREE.Color('#5a8cba') },
            uSunColor: { value: new THREE.Color('#ffe8be') },
            uSunDir: { value: new THREE.Vector3(0.55, 0.34, -0.42).normalize() },
            uFoam: { value: new THREE.Color('#e4ecea') },
            uQuayX: { value: LAYOUT.quayX }
        },
        vertexShader: /* glsl */ `
            uniform float uTime;
            varying vec3 vWorld;
            varying vec3 vNrm;
            varying float vWave;
            void main() {
                vec3 p = position;
                float w1 = sin(p.x * 0.08 + uTime * 0.65) * 0.11;
                float w2 = sin(p.z * 0.05 + uTime * 0.5) * 0.16;
                float w3 = sin((p.x + p.z) * 0.14 + uTime * 1.0) * 0.05;
                p.y += w1 + w2 + w3;
                float dx = cos(p.x * 0.08 + uTime * 0.65) * 0.08 * 0.11 + cos((p.x + p.z) * 0.14 + uTime * 1.0) * 0.14 * 0.05;
                float dz = cos(p.z * 0.05 + uTime * 0.5) * 0.05 * 0.16 + cos((p.x + p.z) * 0.14 + uTime * 1.0) * 0.14 * 0.05;
                vNrm = normalize(vec3(-dx, 1.0, -dz));
                vWave = w1 + w2 + w3;
                vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
                gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            uniform float uTime;
            uniform vec3 uDeep;
            uniform vec3 uShallow;
            uniform vec3 uSkyHorizon;
            uniform vec3 uSkyZenith;
            uniform vec3 uSunColor;
            uniform vec3 uSunDir;
            uniform vec3 uFoam;
            uniform float uQuayX;
            varying vec3 vWorld;
            varying vec3 vNrm;
            varying float vWave;

            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                    f.y
                );
            }

            void main() {
                vec2 uv1 = vWorld.xz * 0.25 + vec2(uTime * 0.05, -uTime * 0.08);
                vec2 uv2 = vWorld.xz * 0.55 + vec2(-uTime * 0.07, uTime * 0.04);
                float r1 = noise(uv1) - 0.5;
                float r2 = noise(uv2) - 0.5;
                vec3 N = normalize(vNrm + vec3(r1 * 0.14 + r2 * 0.09, 0.0, r2 * 0.14 - r1 * 0.09));
                vec3 V = normalize(cameraPosition - vWorld);
                vec3 R = reflect(-V, N);

                float skyT = clamp(R.y * 1.4, 0.0, 1.0);
                vec3 skyRef = mix(uSkyHorizon, uSkyZenith, pow(skyT, 0.7));

                float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 4.0);
                float nearQuay = smoothstep(uQuayX - 45.0, uQuayX + 2.0, vWorld.x);
                vec3 water = mix(uDeep, uShallow, nearQuay * 0.85);
                vec3 col = mix(water, skyRef, clamp(fres * 0.72 + 0.12, 0.0, 0.85));

                float spec = pow(max(dot(R, uSunDir), 0.0), 160.0);
                float glitter = pow(max(dot(R, uSunDir), 0.0), 28.0) * (0.4 + noise(vWorld.xz * 1.2 + uTime * 0.4) * 0.6);
                col += uSunColor * (spec * 1.35 + glitter * 0.2);

                // Espuma sutil junto à amurada do cais
                float quayEdge = smoothstep(uQuayX - 2.5, uQuayX + 0.5, vWorld.x);
                col = mix(col, uFoam, quayEdge * 0.35 * (0.5 + 0.5 * noise(vWorld.xz * 0.5 + uTime * 0.2)));

                gl_FragColor = vec4(col, 0.94);
            }
        `,
        transparent: true,
        depthWrite: true
    });

    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.set(0, 0, -50);
    water.receiveShadow = true;
    group.add(water);

    // Margem oposta (Guarujá / Itapema) com relevo costeiro verdejante
    const bankGeo = new THREE.PlaneGeometry(140, 740, 20, 48);
    bankGeo.rotateX(-Math.PI / 2);
    const pos = bankGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const x = pos.getX(i);
        const inland = THREE.MathUtils.clamp((-x + 20) / 110, 0, 1);
        const h = inland * (6 + fbm(x * 0.025, z * 0.015, 3) * 18) + 0.6;
        pos.setY(i, h);
    }
    bankGeo.computeVertexNormals();
    const bank = new THREE.Mesh(bankGeo, mats.mountain);
    bank.position.set(-115, -0.2, -50);
    bank.receiveShadow = true;
    group.add(bank);

    // Manguezal e mata atlântica densa na margem oposta
    const bushGeo = new THREE.IcosahedronGeometry(2.6, 2);
    const bPos = bushGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
        const bx = bPos.getX(i);
        const by = bPos.getY(i);
        const bz = bPos.getZ(i);
        const m = 0.82 + 0.24 * Math.sin(bx * 0.9 + bz * 0.8);
        bPos.setXYZ(i, bx * m, by * 0.75 * m, bz * m);
    }
    bushGeo.computeVertexNormals();

    const bushCount = Math.max(24, Math.floor(quality.trees * 1.4));
    const bushes = new THREE.InstancedMesh(bushGeo, mats.foliage, bushCount);
    bushes.castShadow = quality.shadows;
    const vegetationRandom = seeded(0x1908e57);
    const mat4 = new THREE.Matrix4();
    const posVec = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const sclVec = new THREE.Vector3();
    for (let i = 0; i < bushCount; i++) {
        const bx = -62 - vegetationRandom() * 75;
        const bz = -320 + vegetationRandom() * 540;
        const inland = THREE.MathUtils.clamp((-bx - 55) / 80, 0, 1);
        posVec.set(bx, 1.2 + inland * 12, bz);
        quat.setFromEuler(new THREE.Euler(0, vegetationRandom() * Math.PI * 2, 0));
        const sc = 0.8 + vegetationRandom() * 1.4;
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
