/**
 * América infinita: céu em shader, pista que segue o corredor,
 * e quarteirões reciclados para a frente quando ficam atrás da câmera.
 *
 * Recycle: se chunk.z > player.z + behind, chunk.z −= count · length e re-popula.
 */

import * as THREE from 'three';
import { CHUNK, ROAD, BIOMES } from './config.js';
import { mulberry32, pick } from './utils.js';
import {
    createTree, createHouse, createBarn, createBillboard,
    createRock, createFence, createMesa, disposeGroup
} from './models.js';
import { dirtTexture, asphaltTexture, grassTexture, cloudTexture } from './textures.js';

export function createSky() {
    const uniforms = {
        uHorizon: { value: new THREE.Color(BIOMES[0].horizon) },
        uZenith: { value: new THREE.Color(BIOMES[0].zenith) },
        uGround: { value: new THREE.Color(BIOMES[0].ground) },
        uSun: { value: new THREE.Color(BIOMES[0].sun) }
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
            uniform vec3 uSun;
            void main() {
                vec3 n = normalize(vPos);
                float h = n.y;
                vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.62, h));
                col = mix(uGround, col, smoothstep(-0.18, 0.06, h));
                float band = exp(-pow((h - 0.02) * 8.0, 2.0));
                col += uHorizon * band * 0.35;
                vec3 sunDir = normalize(vec3(-0.35, 0.42, -0.55));
                float sun = pow(max(dot(n, sunDir), 0.0), 220.0);
                float glow = pow(max(dot(n, sunDir), 0.0), 8.0);
                col += uSun * sun * 1.6 + uSun * glow * 0.28;
                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 16), mat);
    mesh.frustumCulled = false;
    return { mesh, uniforms };
}

export function createClouds() {
    const group = new THREE.Group();
    const tex = cloudTexture(THREE);
    const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        fog: false,
        opacity: 0.7,
        side: THREE.DoubleSide
    });
    const clouds = [];
    for (let i = 0; i < 10; i++) {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(48, 22), mat);
        m.position.set((i % 5 - 2) * 40, 28 + (i % 3) * 6, -40 - i * 28);
        m.rotation.y = 0.15;
        group.add(m);
        clouds.push(m);
    }
    return { group, clouds };
}

export function createRoad() {
    const uniforms = {
        uZ: { value: 0 },
        uRoad: { value: new THREE.Color(BIOMES[0].road) },
        uShoulder: { value: new THREE.Color(BIOMES[0].shoulder) },
        uFogColor: { value: new THREE.Color(BIOMES[0].fog) },
        uFogDensity: { value: 0.007 },
        uDirt: { value: 1 }
    };
    const dirt = dirtTexture(THREE);
    dirt.repeat.set(4, 40);
    const asphalt = asphaltTexture(THREE);
    asphalt.repeat.set(3, 36);
    uniforms.uDirtMap = { value: dirt };
    uniforms.uAsphaltMap = { value: asphalt };

    const mat = new THREE.ShaderMaterial({
        uniforms,
        lights: false,
        fog: false,
        vertexShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec2 vUv;
            void main() {
                vec4 world = modelMatrix * vec4(position, 1.0);
                vWorld = world.xyz;
                vUv = uv;
                gl_Position = projectionMatrix * viewMatrix * world;
            }
        `,
        fragmentShader: /* glsl */ `
            varying vec3 vWorld;
            varying vec2 vUv;
            uniform float uZ;
            uniform vec3 uRoad;
            uniform vec3 uShoulder;
            uniform vec3 uFogColor;
            uniform float uFogDensity;
            uniform float uDirt;
            uniform sampler2D uDirtMap;
            uniform sampler2D uAsphaltMap;
            void main() {
                float x = vWorld.x;
                float z = vWorld.z + uZ;
                vec2 uv = vec2(x * 0.18, z * 0.08);
                vec3 dirt = texture2D(uDirtMap, uv).rgb * 1.15;
                vec3 asp = texture2D(uAsphaltMap, uv).rgb;
                vec3 col = mix(asp * 1.1, dirt, uDirt);
                col *= mix(vec3(1.0), uRoad / max(length(uRoad), 0.001) * 1.4, 0.55);

                float edge = 1.0 - smoothstep(4.05, 4.35, abs(x));
                col = mix(uShoulder * 0.85, col, edge);

                float dash = step(0.55, fract(-z * 0.09));
                float center = (1.0 - smoothstep(0.04, 0.1, abs(x))) * dash * (1.0 - uDirt);
                col = mix(col, vec3(0.92, 0.88, 0.55), center * 0.9);

                float laneL = 1.0 - smoothstep(0.04, 0.1, abs(x + 2.45));
                float laneR = 1.0 - smoothstep(0.04, 0.1, abs(x - 2.45));
                col = mix(col, vec3(0.95, 0.92, 0.7), (laneL + laneR) * dash * 0.45 * (1.0 - uDirt));

                float dist = length(vWorld - vec3(0.0, 0.0, -uZ));
                float fogAmt = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
                col = mix(col, uFogColor, clamp(fogAmt, 0.0, 1.0));

                gl_FragColor = vec4(col, 1.0);
                #include <tonemapping_fragment>
                #include <colorspace_fragment>
            }
        `
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(14, 480, 1, 1), mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;

    const grass = grassTexture(THREE);
    grass.repeat.set(18, 60);
    const grassMat = new THREE.MeshStandardMaterial({
        map: grass,
        color: 0x88aa55,
        roughness: 0.95
    });
    const left = new THREE.Mesh(new THREE.PlaneGeometry(70, 480), grassMat);
    left.rotation.x = -Math.PI / 2;
    left.position.set(-40, -0.02, 0);
    left.receiveShadow = true;
    const right = left.clone();
    right.position.x = 40;

    const group = new THREE.Group();
    group.add(mesh, left, right);
    return { group, uniforms, grassMat };
}

const SIGNS = [
    ['BUBBA GUMP', 'SHRIMP CO.'],
    ['GREENBOW', 'ALABAMA'],
    ['RUN', 'FORREST'],
    ['U.S. 61', 'SOUTH'],
    ['PEACE', '?'],
    ['JENNY', 'WAS HERE']
];

export class America {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.chunks = [];
        this.seed = 1;
        this.biomeId = 'greenbow';

        for (let i = 0; i < CHUNK.count; i++) {
            const chunk = this.buildChunk(i);
            chunk.position.z = -i * CHUNK.length;
            scene.add(chunk);
            this.chunks.push(chunk);
        }
    }

    reset(seed) {
        this.seed = seed || 1;
        this.biomeId = 'greenbow';
        this.chunks.forEach((chunk, i) => {
            chunk.position.z = -i * CHUNK.length;
            this.populateChunk(chunk, i, 'greenbow');
        });
    }

    buildChunk(index) {
        const group = new THREE.Group();
        group.userData.index = index;
        this.populateChunk(group, index, 'greenbow');
        return group;
    }

    populateChunk(group, index, biomeId) {
        disposeGroup(group);
        const rng = mulberry32((this.seed * 104729 + index * 7919) | 0);
        const density = this.quality.chunkProps;
        const biome = BIOMES.find((b) => b.id === biomeId) || BIOMES[0];

        const addSide = (side) => {
            const x0 = side * (ROAD.shoulder + 1.2);
            const count = Math.floor(3 + density * 5);
            for (let n = 0; n < count; n++) {
                const z = (rng() - 0.5) * CHUNK.length * 0.85;
                const x = x0 + side * (2 + rng() * 18);
                let prop;
                if (biome.id === 'desert') {
                    prop = rng() < 0.35 ? createMesa() : createTree('cactus');
                    if (prop.userData && rng() < 0.5 && prop.children.length > 3) {
                        /* mesa stays */
                    }
                    if (rng() < 0.5 && n > 1) prop = createTree('cactus');
                } else if (biome.id === 'rockies') {
                    prop = rng() < 0.7 ? createTree('pine') : createRock();
                } else if (biome.id === 'highway') {
                    const roll = rng();
                    if (roll < 0.18) prop = createBillboard(...pick(SIGNS));
                    else if (roll < 0.3) prop = createBarn();
                    else prop = createTree(rng() < 0.4 ? 'pine' : 'oak');
                } else if (biome.id === 'rain') {
                    prop = rng() < 0.2 ? createHouse() : createTree('oak');
                } else {
                    const roll = rng();
                    if (roll < 0.12) prop = createHouse();
                    else if (roll < 0.18) prop = createBarn();
                    else if (roll < 0.28) prop = createFence();
                    else prop = createTree('oak');
                }
                const s = 0.75 + rng() * 0.7;
                prop.scale.setScalar(s);
                prop.position.set(x, 0, z);
                prop.rotation.y = rng() * Math.PI * 2 * (prop.userData?.signMat ? 0 : 1);
                if (prop.userData?.signMat) prop.rotation.y = side > 0 ? -0.15 : 0.15;
                group.add(prop);
            }
        };

        addSide(-1);
        addSide(1);

        if (rng() < 0.35 * density) {
            const rock = createRock();
            rock.position.set((rng() - 0.5) * 10, 0, (rng() - 0.5) * 20);
            rock.scale.setScalar(0.6 + rng());
            group.add(rock);
        }
        group.userData.biomeId = biomeId;
    }

    recycle(playerZ, biomeId) {
        const behind = 28;
        const span = CHUNK.count * CHUNK.length;
        for (const chunk of this.chunks) {
            if (chunk.position.z > playerZ + behind) {
                chunk.position.z -= span;
                const idx = (chunk.userData.index + CHUNK.count) | 0;
                chunk.userData.index = idx;
                this.populateChunk(chunk, Math.abs(Math.floor(-chunk.position.z / CHUNK.length)), biomeId);
            }
        }
        this.biomeId = biomeId;
    }
}
