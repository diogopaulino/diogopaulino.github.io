/**
 * Mundo procedimental infinito em Babylon.js:
 * - Céu atmosférico com cúpula celeste e sol dinâmico
 * - Nuvens volumétricas em camadas
 * - Estrada e acostamento PBR com blend de asfalto/terra/chuva
 * - Gerador e reciclador determinístico de cenários dos EUA (America)
 */

import { CHUNK, ROAD, BIOMES } from './config.js';
import { mulberry32, pick, hexToColor3, mixHexColor3, lerp } from './utils.js';
import {
    createTree, createHouse, createBarn, createBillboard,
    createRock, createFence, createMesa, disposeTransformNode
} from './models.js';
import {
    createDirtTexture, createAsphaltTexture, createAsphaltBumpTexture,
    createGrassTexture, createCloudTexture
} from './textures.js';

export function createSky(scene) {
    const skyDome = BABYLON.MeshBuilder.CreateSphere('skyDome', {
        diameter: 800,
        segments: 16,
        sideOrientation: BABYLON.Mesh.BACKSIDE
    }, scene);

    const skyMat = new BABYLON.PBRMaterial('skyMat', scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;
    skyMat.emissiveColor = hexToColor3(BIOMES[0].zenith);
    skyMat.roughness = 1.0;
    skyMat.metallic = 0.0;
    skyDome.material = skyMat;
    skyDome.infiniteDistance = true;

    return { mesh: skyDome, material: skyMat };
}

export function createClouds(scene) {
    const cloudRoot = new BABYLON.TransformNode('cloudRoot', scene);
    const cloudMat = new BABYLON.StandardMaterial('cloudMat', scene);
    cloudMat.diffuseTexture = createCloudTexture(scene);
    cloudMat.diffuseTexture.hasAlpha = true;
    cloudMat.useAlphaFromDiffuseTexture = true;
    cloudMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
    cloudMat.disableLighting = true;
    cloudMat.alpha = 0.72;
    cloudMat.backFaceCulling = false;

    const clouds = [];
    for (let i = 0; i < 12; i++) {
        const m = BABYLON.MeshBuilder.CreatePlane(`cloud_${i}`, { width: 65, height: 32 }, scene);
        m.material = cloudMat;
        m.rotation.x = Math.PI / 2;
        m.position.set((i % 5 - 2) * 55, 34 + (i % 3) * 8, -i * 38);
        m.parent = cloudRoot;
        clouds.push(m);
    }

    return { root: cloudRoot, clouds, material: cloudMat };
}

export function createRoad(scene, shadowGenerator) {
    const roadRoot = new BABYLON.TransformNode('roadRoot', scene);

    // 1. Pista Central (Asfalto / Terra PBR)
    const roadMesh = BABYLON.MeshBuilder.CreateGround('roadMesh', {
        width: 14.5,
        height: 520,
        subdivisions: 2
    }, scene);
    roadMesh.position.y = 0;
    roadMesh.parent = roadRoot;
    roadMesh.receiveShadows = true;

    const roadMat = new BABYLON.PBRMaterial('roadMat', scene);
    const asphaltTex = createAsphaltTexture(scene);
    asphaltTex.uScale = 2;
    asphaltTex.vScale = 40;
    roadMat.albedoTexture = asphaltTex;

    const bumpTex = createAsphaltBumpTexture(scene);
    bumpTex.uScale = 2;
    bumpTex.vScale = 40;
    roadMat.bumpTexture = bumpTex;
    roadMat.bumpCustomStrength = 0.65;

    roadMat.roughness = 0.75;
    roadMat.metallic = 0.05;
    roadMesh.material = roadMat;

    // 2. Terrenos Laterais (Grama / Vegetação)
    const grassTex = createGrassTexture(scene);
    grassTex.uScale = 14;
    grassTex.vScale = 50;

    const grassMat = new BABYLON.PBRMaterial('grassMat', scene);
    grassMat.albedoTexture = grassTex;
    grassMat.roughness = 0.95;
    grassMat.metallic = 0.02;
    grassMat.albedoColor = hexToColor3(BIOMES[0].ground);

    const leftField = BABYLON.MeshBuilder.CreateGround('leftField', {
        width: 90,
        height: 520,
        subdivisions: 1
    }, scene);
    leftField.position.set(-52, -0.02, 0);
    leftField.parent = roadRoot;
    leftField.material = grassMat;
    leftField.receiveShadows = true;

    const rightField = BABYLON.MeshBuilder.CreateGround('rightField', {
        width: 90,
        height: 520,
        subdivisions: 1
    }, scene);
    rightField.position.set(52, -0.02, 0);
    rightField.parent = roadRoot;
    rightField.material = grassMat;
    rightField.receiveShadows = true;

    // 3. Faixas da Estrada (Pintura Amarela e Branca)
    const lineMat = new BABYLON.PBRMaterial('lineMat', scene);
    lineMat.albedoColor = new BABYLON.Color3(0.96, 0.88, 0.45); // Amarelo clássico
    lineMat.emissiveColor = new BABYLON.Color3(0.12, 0.1, 0.03);
    lineMat.roughness = 0.6;
    lineMat.metallic = 0.05;

    const centerLine = BABYLON.MeshBuilder.CreateGround('centerLine', {
        width: 0.22,
        height: 520,
        subdivisions: 1
    }, scene);
    centerLine.position.set(0, 0.01, 0);
    centerLine.parent = roadRoot;
    centerLine.material = lineMat;

    const whiteLineMat = new BABYLON.PBRMaterial('whiteLineMat', scene);
    whiteLineMat.albedoColor = new BABYLON.Color3(0.94, 0.94, 0.9);
    whiteLineMat.roughness = 0.6;
    whiteLineMat.metallic = 0.05;

    for (const sx of [-1, 1]) {
        const shoulderLine = BABYLON.MeshBuilder.CreateGround(`shoulderLine_${sx}`, {
            width: 0.2,
            height: 520,
            subdivisions: 1
        }, scene);
        shoulderLine.position.set(sx * 4.2, 0.01, 0);
        shoulderLine.parent = roadRoot;
        shoulderLine.material = whiteLineMat;
    }

    return {
        root: roadRoot,
        roadMesh,
        roadMat,
        grassMat,
        lineMat,
        whiteLineMat,
        centerLine
    };
}

const SIGNS = [
    ['BUBBA GUMP', 'SHRIMP CO.'],
    ['GREENBOW', 'ALABAMA'],
    ['RUN', 'FORREST RUN'],
    ['U.S. 61', 'SOUTH'],
    ['PEACE ON EARTH', 'FORREST GUMP'],
    ['JENNY', 'WAS HERE']
];

export class America {
    constructor(scene, shadowGenerator, quality) {
        this.scene = scene;
        this.shadowGenerator = shadowGenerator;
        this.quality = quality;
        this.chunks = [];
        this.seed = 1;
        this.biomeId = 'greenbow';

        for (let i = 0; i < CHUNK.count; i++) {
            const chunk = this.buildChunk(i);
            chunk.position.z = -i * CHUNK.length;
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
        const root = new BABYLON.TransformNode(`chunk_${index}`, this.scene);
        root.metadata = { index };
        this.populateChunk(root, index, 'greenbow');
        return root;
    }

    populateChunk(group, index, biomeId) {
        // Limpar filhos anteriores
        const children = group.getChildren().slice();
        for (const child of children) {
            child.dispose(false, true);
        }

        const rng = mulberry32((this.seed * 104729 + index * 7919) | 0);
        const density = this.quality.chunkProps;
        const biome = BIOMES.find((b) => b.id === biomeId) || BIOMES[0];

        const addSide = (side) => {
            const x0 = side * (ROAD.shoulder + 1.6);
            const count = Math.floor(2 + density * 4);
            for (let n = 0; n < count; n++) {
                const z = (rng() - 0.5) * CHUNK.length * 0.88;
                const x = x0 + side * (2.0 + rng() * 22);
                let prop;

                if (biome.id === 'desert') {
                    prop = rng() < 0.35
                        ? createMesa(this.scene, this.shadowGenerator)
                        : createTree(this.scene, this.shadowGenerator, 'cactus');
                } else if (biome.id === 'rockies') {
                    prop = rng() < 0.72
                        ? createTree(this.scene, this.shadowGenerator, 'pine')
                        : createRock(this.scene, this.shadowGenerator);
                } else if (biome.id === 'highway') {
                    const roll = rng();
                    if (roll < 0.22) {
                        const [t1, t2] = pick(SIGNS);
                        prop = createBillboard(this.scene, this.shadowGenerator, t1, t2);
                    } else if (roll < 0.35) {
                        prop = createBarn(this.scene, this.shadowGenerator);
                    } else {
                        prop = createTree(this.scene, this.shadowGenerator, rng() < 0.4 ? 'pine' : 'oak');
                    }
                } else if (biome.id === 'rain') {
                    prop = rng() < 0.25
                        ? createHouse(this.scene, this.shadowGenerator)
                        : createTree(this.scene, this.shadowGenerator, 'oak');
                } else {
                    // Alabama Greenbow
                    const roll = rng();
                    if (roll < 0.15) prop = createHouse(this.scene, this.shadowGenerator);
                    else if (roll < 0.22) prop = createBarn(this.scene, this.shadowGenerator);
                    else if (roll < 0.35) prop = createFence(this.scene, this.shadowGenerator);
                    else prop = createTree(this.scene, this.shadowGenerator, 'oak');
                }

                const s = 0.8 + rng() * 0.6;
                prop.scaling.setAll(s);
                prop.position.set(x, 0, z);
                prop.rotation.y = rng() * Math.PI * 2;
                prop.parent = group;
            }
        };

        addSide(-1);
        addSide(1);

        if (rng() < 0.35 * density) {
            const rock = createRock(this.scene, this.shadowGenerator);
            rock.position.set((rng() - 0.5) * 12, 0, (rng() - 0.5) * 22);
            rock.scaling.setAll(0.7 + rng() * 0.8);
            rock.parent = group;
        }

        group.metadata = group.metadata || {};
        group.metadata.biomeId = biomeId;
    }

    recycle(playerZ, biomeId) {
        const behind = 32;
        const span = CHUNK.count * CHUNK.length;
        for (const chunk of this.chunks) {
            if (chunk.position.z > playerZ + behind) {
                chunk.position.z -= span;
                const idx = ((chunk.metadata?.index || 0) + CHUNK.count) | 0;
                if (!chunk.metadata) chunk.metadata = {};
                chunk.metadata.index = idx;
                this.populateChunk(chunk, Math.abs(Math.floor(-chunk.position.z / CHUNK.length)), biomeId);
            }
        }
        this.biomeId = biomeId;
    }
}
