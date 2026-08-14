/**
 * Cidade infinita: o chão e o céu seguem a moto; quarteirões são reciclados
 * para a frente quando ficam para trás da câmera.
 */

import * as THREE from 'three';
import { CHUNK, ROAD } from './config.js';
import { hash, mulberry32 } from './utils.js';
import {
    createBuilding, createLamp, createPalm, createBillboard, tintMaterials
} from './models.js';

export function createSky() {
    const uniforms = {
        uHorizon: { value: new THREE.Color(0xff3eb5) },
        uZenith: { value: new THREE.Color(0x06010c) },
        uGround: { value: new THREE.Color(0x04020a) }
    };
    const mat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms,
        vertexShader: /* glsl */ `
            varying vec3 vPos;
            void main() {
                vPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vPos;
            uniform vec3 uHorizon;
            uniform vec3 uZenith;
            uniform vec3 uGround;
            void main() {
                float h = normalize(vPos).y;
                vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
                col = mix(uGround, col, smoothstep(-0.22, 0.04, h));
                float band = exp(-pow((h - 0.015) * 9.0, 2.0));
                col += uHorizon * band * 0.5;
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(480, 24, 16), mat);
    mesh.frustumCulled = false;
    return { mesh, uniforms };
}

export function createRoad(station, fogDensity = 0.008) {
    const uniforms = {
        uZ: { value: 0 },
        uNeonA: { value: new THREE.Color(station.neonA) },
        uNeonB: { value: new THREE.Color(station.neonB) },
        uAsphalt: { value: new THREE.Color(station.asphalt) },
        uFogColor: { value: new THREE.Color(station.fog) },
        uFogDensity: { value: fogDensity }
    };

    const mat = new THREE.ShaderMaterial({
        uniforms,
        lights: false,
        fog: false,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vView;
            varying vec3 vNormal;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                vNormal = normalize(mat3(modelMatrix) * normal);
                vec4 mv = viewMatrix * world;
                vView = -mv.xyz;
                gl_Position = projectionMatrix * mv;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec3 vView;
            varying vec3 vNormal;
            uniform float uZ;
            uniform vec3 uNeonA;
            uniform vec3 uNeonB;
            uniform vec3 uAsphalt;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            void main() {
                float x = vWorld.x;
                float z = vWorld.z + uZ;
                vec3 col = uAsphalt;

                float n = fract(sin(dot(floor(vWorld.xz * 2.4), vec2(12.9898, 78.233))) * 43758.5453);
                col += (n - 0.5) * 0.035;

                float curb = smoothstep(7.55, 7.85, abs(x)) * (1.0 - smoothstep(8.7, 9.1, abs(x)));
                col = mix(col, vec3(0.18, 0.16, 0.22), curb);

                float edge = 1.0 - smoothstep(0.08, 0.16, abs(abs(x) - 7.35));
                col = mix(col, uNeonB, edge * 0.85);

                float center = 1.0 - smoothstep(0.05, 0.12, abs(abs(x) - 0.14));
                col = mix(col, uNeonA, center * step(0.45, fract(z * 0.12)));

                float lane = min(abs(x - 3.6), abs(x + 3.6));
                float dash = step(0.5, fract(z * 0.09));
                float mark = (1.0 - smoothstep(0.04, 0.1, lane)) * dash;
                col = mix(col, vec3(0.85, 0.9, 1.0), mark * 0.75);

                float block = mod(-z, 104.0);
                float xwalk = step(block, 7.5) * step(abs(x), 7.4);
                float stripe = step(0.45, fract(x * 0.55));
                col = mix(col, vec3(0.92, 0.92, 1.0), xwalk * stripe * 0.7);

                vec3 N = normalize(vNormal);
                vec3 V = normalize(vView);
                float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
                col = mix(col, mix(uNeonA, uNeonB, 0.45), fres * 0.55);

                float dist = length(vView);
                float fogAmt = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
                col = mix(col, uFogColor, clamp(fogAmt, 0.0, 1.0));

                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(22, 420, 1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;

    const sidewalkMat = new THREE.MeshStandardMaterial({
        color: 0x16141f,
        roughness: 0.9,
        metalness: 0.05
    });
    const left = new THREE.Mesh(new THREE.BoxGeometry(9, 0.28, 420), sidewalkMat);
    left.position.set(-13.2, 0.12, 0);
    left.receiveShadow = true;
    const right = left.clone();
    right.position.x = 13.2;

    const group = new THREE.Group();
    group.add(mesh, left, right);
    return { group, uniforms, sidewalkMat };
}

export class City {
    constructor(scene, quality, mats) {
        this.scene = scene;
        this.quality = quality;
        this.mats = mats;
        this.chunks = [];
        this.lampLights = [];
        this.seed = 1;

        for (let i = 0; i < CHUNK.count; i++) {
            const chunk = this.buildChunk(i);
            chunk.position.z = -i * CHUNK.length;
            scene.add(chunk);
            this.chunks.push(chunk);
        }

        const lampCount = quality.lamps;
        for (let i = 0; i < lampCount; i++) {
            const light = new THREE.PointLight(0xffe7b0, 2.4, 22, 1.8);
            light.castShadow = false;
            scene.add(light);
            this.lampLights.push(light);
        }
    }

    buildChunk(index) {
        const group = new THREE.Group();
        group.userData.index = index;
        this.populateChunk(group, index);
        return group;
    }

    populateChunk(group, index) {
        while (group.children.length) {
            const child = group.children[0];
            child.traverse((obj) => {
                if (obj.userData?.signMat) {
                    obj.userData.signMat.map?.dispose();
                    obj.userData.signMat.dispose();
                }
            });
            group.remove(child);
        }

        const rng = mulberry32((this.seed * 104729 + index * 7919) | 0);
        const density = this.quality.chunkProps;

        const addSide = (side) => {
            const count = 1 + Math.floor(rng() * 2 * density + 0.4);
            for (let i = 0; i < count; i++) {
                const b = createBuilding(this.mats, rng, density, side);
                const z = (i - (count - 1) / 2) * (CHUNK.length / Math.max(count, 1)) * 0.7;
                b.position.set(side * (ROAD.buildingGap + 4 + rng() * 3.5), 0, z);
                group.add(b);
            }

            if (rng() < 0.7 * density) {
                const palm = createPalm(this.mats);
                palm.position.set(side * 9.6, 0, (rng() - 0.5) * CHUNK.length * 0.6);
                palm.scale.setScalar(0.75 + rng() * 0.45);
                group.add(palm);
            }

            if (rng() < 0.85) {
                const lamp = createLamp(this.mats);
                lamp.position.set(side * 8.9, 0, (rng() - 0.5) * CHUNK.length * 0.5);
                lamp.rotation.y = side > 0 ? Math.PI : 0;
                lamp.userData.isLamp = true;
                group.add(lamp);
            }
        };

        addSide(-1);
        addSide(1);

        if (hash(index + this.seed * 13) > 0.72) {
            const board = createBillboard(this.mats, pickBillboard(index));
            board.position.set((hash(index) > 0.5 ? 1 : -1) * 9.8, 0, 0);
            group.add(board);
        }
    }

    recycle(playerZ) {
        const span = CHUNK.count * CHUNK.length;
        for (const chunk of this.chunks) {
            if (chunk.position.z > playerZ + CHUNK.length * 1.2) {
                chunk.position.z -= span;
                chunk.userData.index += CHUNK.count;
                this.populateChunk(chunk, chunk.userData.index);
            }
        }
    }

    updateLights(playerZ) {
        if (!this.lampLights.length) return;
        const lamps = [];
        for (const chunk of this.chunks) {
            for (const child of chunk.children) {
                if (child.userData.isLamp) lamps.push(child);
            }
        }
        lamps.sort((a, b) => {
            const da = Math.abs(a.parent.position.z + a.position.z - playerZ);
            const db = Math.abs(b.parent.position.z + b.position.z - playerZ);
            return da - db;
        });
        for (let i = 0; i < this.lampLights.length; i++) {
            const lamp = lamps[i];
            const light = this.lampLights[i];
            if (!lamp) {
                light.intensity = 0;
                continue;
            }
            const world = lamp.getWorldPosition(light.position);
            light.position.copy(world);
            light.position.y = 5.05;
            const towardRoad = lamp.position.x > 0 ? -1.05 : 1.05;
            light.position.x += towardRoad;
            light.intensity = 2.2;
        }
    }

    setStation(station) {
        tintMaterials(this.mats, station);
        for (const light of this.lampLights) {
            light.color.setHex(station.lamp);
        }
        for (const chunk of this.chunks) {
            for (const child of chunk.children) {
                const sign = child.userData.signMat;
                if (!sign) continue;
                const next = hash(child.id) > 0.5 ? station.neonA : station.neonB;
                child.userData.signColor = next;
            }
        }
    }

    reset(seed = 1) {
        this.seed = seed;
        for (let i = 0; i < this.chunks.length; i++) {
            const chunk = this.chunks[i];
            chunk.position.z = -i * CHUNK.length;
            chunk.userData.index = i;
            this.populateChunk(chunk, i);
        }
    }
}

function pickBillboard(index) {
    const words = ['NEON RIDER', 'WAVE 84', 'ARCADE', 'VHS NIGHT', 'INSERT COIN', 'WALKMAN'];
    return words[index % words.length];
}
