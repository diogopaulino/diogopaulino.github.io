/**
 * Canais 1–7: água animada, muros de pedra, pontes e guarda-corpo dourado.
 */

import * as THREE from 'three';
import { CANALS, ZONES, ORLA_HALF } from './config.js';
import { stoneMaterial, plasterMaterial, metalMaterial } from '../../shared/realism.js';

export function createCanals() {
    const root = new THREE.Group();
    root.name = 'canals';

    const waterMat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: {
            uTime: { value: 0 },
            uDeep: { value: new THREE.Color(0x0d4a5c) },
            uShallow: { value: new THREE.Color(0x2a8a9a) },
            uFoam: { value: new THREE.Color(0xd8eef4) }
        },
        vertexShader: /* glsl */ `
            uniform float uTime;
            varying vec3 vWorld;
            varying float vWave;
            void main() {
                vec3 p = position;
                float w = sin(p.z * 0.35 + uTime * 1.4) * 0.04
                        + sin(p.x * 2.2 + uTime * 1.1) * 0.02;
                p.y += w;
                vWave = w;
                vec4 world = modelMatrix * vec4(p, 1.0);
                vWorld = world.xyz;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            uniform vec3 uDeep;
            uniform vec3 uShallow;
            uniform vec3 uFoam;
            uniform float uTime;
            varying vec3 vWorld;
            varying float vWave;
            void main() {
                float fres = pow(1.0 - abs(normalize(cameraPosition - vWorld).y), 2.2);
                vec3 col = mix(uShallow, uDeep, 0.45 + fres * 0.35);
                col += uFoam * (0.15 + vWave * 4.0) * 0.25;
                float sparkle = sin(vWorld.z * 3.0 + uTime * 2.0) * 0.5 + 0.5;
                col += sparkle * 0.04;
                gl_FragColor = vec4(col, 0.88);
            }
        `
    });

    const wallMat = stoneMaterial(0x8a8680, { roughness: 0.88, repeat: 3 });
    const bridgeMat = plasterMaterial(0x626268, { roughness: 0.72, repeat: 2 });
    const railMat = metalMaterial(0xd4ac2b, { roughness: 0.32, metalness: 0.78 });
    const labels = [];

    for (const canal of CANALS) {
        const g = new THREE.Group();
        g.position.x = canal.x;

        const len = Math.abs(ZONES.inland) + ZONES.gardenOuter + 8;
        const water = new THREE.Mesh(
            new THREE.BoxGeometry(canal.width, 0.35, len, 1, 1, 24),
            waterMat
        );
        water.position.set(0, 0.1, (ZONES.inland + ZONES.gardenOuter) * 0.5);
        g.add(water);

        const wallH = 1.1;
        const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.35, wallH, len), wallMat);
        const wallR = wallL.clone();
        wallL.position.set(-canal.width * 0.5 - 0.2, wallH * 0.5, water.position.z);
        wallR.position.set(canal.width * 0.5 + 0.2, wallH * 0.5, water.position.z);
        wallL.castShadow = wallR.castShadow = true;
        g.add(wallL, wallR);

        // Ponte em arco suave (extrusão) na avenida
        const archShape = new THREE.Shape();
        const half = canal.width * 0.5 + 3;
        archShape.moveTo(-half, 0);
        archShape.lineTo(half, 0);
        archShape.lineTo(half, 0.45);
        archShape.quadraticCurveTo(0, 0.85, -half, 0.45);
        archShape.closePath();
        const bridgeGeo = new THREE.ExtrudeGeometry(archShape, {
            depth: 8,
            bevelEnabled: false
        });
        bridgeGeo.rotateX(-Math.PI / 2);
        bridgeGeo.translate(0, 0, -4);
        const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
        bridge.position.set(0, 0.05, ZONES.avenue - 1.5);
        bridge.castShadow = true;
        bridge.receiveShadow = true;
        g.add(bridge);

        for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(canal.width + 5.5, 0.12, 0.12),
                railMat
            );
            rail.position.set(0, 1.05, ZONES.avenue - 1.5 + side * 3.6);
            g.add(rail);
            // Balaústres
            for (let i = -3; i <= 3; i++) {
                const bal = new THREE.Mesh(
                    new THREE.CylinderGeometry(0.04, 0.05, 0.7, 6),
                    railMat
                );
                bal.position.set(i * (canal.width + 5.5) / 7, 0.7, ZONES.avenue - 1.5 + side * 3.6);
                g.add(bal);
            }
        }

        const road = new THREE.Mesh(
            new THREE.BoxGeometry(canal.width + 5, 0.08, Math.abs(ZONES.inland) - 10),
            new THREE.MeshStandardMaterial({ color: 0x3e3e44, roughness: 0.75 })
        );
        road.position.set(0, 0.06, ZONES.buildings - 20);
        g.add(road);

        root.add(g);
        labels.push({
            id: canal.id,
            name: canal.name,
            avenue: canal.avenue,
            x: canal.x,
            z: ZONES.gardenInner + 4
        });
    }

    const portWater = new THREE.Mesh(
        new THREE.BoxGeometry(40, 0.4, 70, 1, 1, 16),
        waterMat
    );
    portWater.position.set(ORLA_HALF + 8, 0.05, 10);
    root.add(portWater);

    return {
        root,
        labels,
        waterMat,
        update(t) {
            waterMat.uniforms.uTime.value = t;
        }
    };
}
