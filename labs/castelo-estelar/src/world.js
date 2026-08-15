/**
 * Castelo Estelar — Reino Noturno em Babylon.js:
 * Terreno insular, floresta de pinheiros, lago com reflexos em tempo real,
 * cúpula celeste com estrelas, lua com halo e iluminação PBR com sombras suaves.
 */

import { createCastle } from './castle.js';
import {
    getGrassTexture,
    getBarkTexture,
    getMoonTexture,
    getWaterBumpTexture
} from './textures.js';
import { fbm, seeded } from './utils.js';

export function heightAt(x, z) {
    const r = Math.hypot(x, z);
    const island = Math.max(0, 1 - r / 28);
    const hill = Math.pow(island, 1.45) * 5.8;
    const noise = fbm(x * 0.045, z * 0.045, 5, 4) * 1.25 * island;
    const rim = r < 16 ? 0 : -Math.max(0, (r - 16) * 0.52);
    return hill + noise + rim;
}

function createTerrain(scene, quality) {
    const B = window.BABYLON;
    const segs = quality.id === 'low' ? 64 : quality.id === 'high' ? 128 : 96;
    const size = 95;

    const ground = B.MeshBuilder.CreateGround('terrain_mesh', {
        width: size,
        height: size,
        subdivisions: segs,
        updatable: true
    }, scene);

    const positions = ground.getVerticesData(B.VertexBuffer.PositionKind);
    const normals = ground.getVerticesData(B.VertexBuffer.NormalKind);
    const indices = ground.getIndices();

    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const z = positions[i + 2];
        const y = Math.max(0.06, heightAt(x, z));
        positions[i + 1] = y;
    }

    B.VertexData.ComputeNormals(positions, indices, normals);
    ground.setVerticesData(B.VertexBuffer.PositionKind, positions);
    ground.setVerticesData(B.VertexBuffer.NormalKind, normals);

    const terrainMat = new B.PBRMaterial('mat_terrain', scene);
    terrainMat.albedoTexture = getGrassTexture(scene);
    terrainMat.roughness = 0.92;
    terrainMat.metallic = 0.02;
    terrainMat.ambientColor = new B.Color3(0.08, 0.12, 0.16);

    ground.material = terrainMat;
    ground.receiveShadows = true;

    return ground;
}

function createPines(scene, quality, shadowGenerator) {
    const B = window.BABYLON;
    const rng = seeded(20260814);
    const count = quality.trees;

    // Protótipo do Pinheiro
    const trunkProto = B.MeshBuilder.CreateCylinder('pine_trunk_proto', {
        diameterBottom: 0.55,
        diameterTop: 0.35,
        height: 2.4,
        tessellation: 8
    }, scene);
    const trunkMat = new B.PBRMaterial('mat_pine_trunk', scene);
    trunkMat.albedoTexture = getBarkTexture(scene);
    trunkMat.roughness = 0.95;
    trunkProto.material = trunkMat;
    trunkProto.isVisible = false;

    const leafProtoA = B.MeshBuilder.CreateCylinder('pine_leaf_proto_a', {
        diameterBottom: 2.6,
        diameterTop: 0,
        height: 2.8,
        tessellation: 8
    }, scene);
    const leafMat = new B.PBRMaterial('mat_pine_leaf', scene);
    leafMat.albedoColor = new B.Color3(0.08, 0.22, 0.14);
    leafMat.roughness = 0.82;
    leafMat.metallic = 0.02;
    leafProtoA.material = leafMat;
    leafProtoA.isVisible = false;

    const leafProtoB = B.MeshBuilder.CreateCylinder('pine_leaf_proto_b', {
        diameterBottom: 2.0,
        diameterTop: 0,
        height: 2.2,
        tessellation: 8
    }, scene);
    leafProtoB.material = leafMat;
    leafProtoB.isVisible = false;

    const spots = [];
    let placed = 0;
    let guard = 0;
    while (placed < count && guard < count * 20) {
        guard++;
        const a = rng() * Math.PI * 2;
        const ring = rng();
        const r = ring < 0.45
            ? 18 + rng() * 16
            : 32 + rng() * 24;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        if (z > 6 && Math.abs(x) < 14) continue;
        if (Math.hypot(x, z) < 15) continue;
        spots.push([x, z, 0.85 + rng() * 1.5, rng() * Math.PI]);
        placed++;
    }

    // Pinheiros de primeiro plano nas laterais
    const fg = [
        [-22, 34, 2.4], [-26, 24, 2.0], [24, 32, 2.3], [28, 22, 2.5],
        [-30, 18, 1.8], [32, 16, 1.9]
    ];
    fg.forEach(([x, z, sc], k) => {
        spots.push([x, z, sc, k * 0.8]);
    });

    const pineMeshes = [];

    spots.forEach(([x, z, sc, rot], i) => {
        const y = Math.max(0.18, heightAt(x, z));

        const trunk = trunkProto.createInstance(`trunk_${i}`);
        trunk.position.set(x, y + 1.2 * sc, z);
        trunk.rotation.y = rot;
        trunk.scaling.set(sc, sc * 1.15, sc);
        trunk.receiveShadows = true;
        if (shadowGenerator && quality.id !== 'low') shadowGenerator.addShadowCaster(trunk);
        pineMeshes.push(trunk);

        const leafA = leafProtoA.createInstance(`leafA_${i}`);
        leafA.position.set(x, y + 2.5 * sc, z);
        leafA.rotation.y = rot + 0.3;
        leafA.scaling.set(sc * 1.5, sc * 1.4, sc * 1.5);
        leafA.receiveShadows = true;
        if (shadowGenerator && quality.id !== 'low') shadowGenerator.addShadowCaster(leafA);
        pineMeshes.push(leafA);

        const leafB = leafProtoB.createInstance(`leafB_${i}`);
        leafB.position.set(x, y + 3.8 * sc, z);
        leafB.rotation.y = rot + 0.7;
        leafB.scaling.set(sc * 1.15, sc * 1.25, sc * 1.15);
        leafB.receiveShadows = true;
        if (shadowGenerator && quality.id !== 'low') shadowGenerator.addShadowCaster(leafB);
        pineMeshes.push(leafB);
    });

    return { trunkProto, leafProtoA, leafProtoB, pineMeshes };
}

function createMoon(scene) {
    const B = window.BABYLON;
    const group = new B.TransformNode('moon_group', scene);

    // Globo Lunar
    const moonMesh = B.MeshBuilder.CreateSphere('moon_mesh', {
        diameter: 15,
        segments: 48
    }, scene);
    moonMesh.position.set(-42, 58, -38);
    moonMesh.parent = group;

    const moonMat = new B.PBRMaterial('mat_moon', scene);
    moonMat.albedoTexture = getMoonTexture(scene);
    moonMat.emissiveTexture = getMoonTexture(scene);
    moonMat.emissiveColor = new B.Color3(0.85, 0.9, 1.0);
    moonMat.roughness = 0.95;
    moonMat.metallic = 0.0;
    moonMesh.material = moonMat;

    // Halo Lunar suave (Corona)
    const haloMesh = B.MeshBuilder.CreateSphere('moon_halo', {
        diameter: 24,
        segments: 24,
        sideOrientation: B.Mesh.DOUBLESIDE
    }, scene);
    haloMesh.position.copyFrom(moonMesh.position);
    haloMesh.parent = group;

    const haloMat = new B.StandardMaterial('mat_moon_halo', scene);
    haloMat.diffuseColor = new B.Color3(0.65, 0.78, 1.0);
    haloMat.emissiveColor = new B.Color3(0.45, 0.6, 0.95);
    haloMat.alpha = 0.18;
    haloMat.alphaMode = B.Engine.ALPHA_ADD;
    haloMat.backFaceCulling = false;
    haloMat.disableDepthWrite = true;
    haloMesh.material = haloMat;

    return { group, moonMesh, haloMesh };
}

function createStars(scene, count) {
    const B = window.BABYLON;
    const pcs = new B.PointsCloudSystem('star_system', 1, scene);

    pcs.addPoints(count, (particle, i) => {
        const u = Math.random();
        const v = Math.random();
        const theta = u * Math.PI * 2;
        const phi = Math.acos(2 * v - 1);
        const r = 420 + Math.random() * 80;

        particle.position.x = r * Math.sin(phi) * Math.cos(theta);
        particle.position.y = Math.abs(r * Math.cos(phi)) + 15;
        particle.position.z = r * Math.sin(phi) * Math.sin(theta);

        const t = Math.random();
        let cr = 0.95, cg = 0.96, cb = 1.0;
        if (t < 0.18) { cr = 0.72; cg = 0.85; cb = 1.0; } // Estrela azul
        else if (t < 0.32) { cr = 1.0; cg = 0.84; cb = 0.58; } // Estrela dourada

        const mag = 0.5 + Math.random() * 0.7;
        particle.color = new B.Color4(cr * mag, cg * mag, cb * mag, 0.92);
    });

    pcs.buildMeshAsync();
    return pcs;
}

function createSkyDome(scene) {
    const B = window.BABYLON;
    const sky = B.MeshBuilder.CreateSphere('celestial_sky', {
        diameter: 650,
        segments: 24,
        sideOrientation: B.Mesh.BACKSIDE
    }, scene);

    const skyMat = new B.StandardMaterial('mat_sky', scene);
    skyMat.backFaceCulling = false;
    skyMat.disableLighting = true;

    // Gradiente dinâmico no céu noturno com Via Láctea
    const size = 512;
    const dt = new B.DynamicTexture('sky_texture', size, scene, true);
    const ctx = dt.getContext();

    const grad = ctx.createLinearGradient(0, 0, 0, size);
    grad.addColorStop(0, '#03050c'); // Zênite
    grad.addColorStop(0.45, '#070f22');
    grad.addColorStop(0.78, '#101d3a'); // Horizonte
    grad.addColorStop(1.0, '#040711'); // Nadir
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // Bruma e nebulosa da Via Láctea
    ctx.fillStyle = 'rgba(120, 150, 220, 0.08)';
    ctx.beginPath();
    ctx.ellipse(size * 0.45, size * 0.4, size * 0.35, size * 0.15, -0.4, 0, Math.PI * 2);
    ctx.fill();

    dt.update();
    skyMat.diffuseTexture = dt;
    skyMat.emissiveTexture = dt;
    sky.material = skyMat;

    return sky;
}

export class Kingdom {
    constructor(scene, engine, quality) {
        this.scene = scene;
        this.engine = engine;
        this.quality = quality;
        const B = window.BABYLON;

        // Configuração de Neblina Atmosférica
        scene.fogMode = B.Scene.FOGMODE_EXP2;
        scene.fogColor = new B.Color3(0.04, 0.08, 0.16);
        scene.fogDensity = 0.0034;

        // Luzes e Sombras
        this._setupLights(quality);

        // Elementos do Reino
        this.sky = createSkyDome(scene);
        this.stars = createStars(scene, quality.stars);
        this.moon = createMoon(scene);
        this.terrain = createTerrain(scene, quality);
        this.pines = createPines(scene, quality, this.shadowGenerator);
        this.castle = createCastle(scene, this.shadowGenerator);

        // Lago com Água Refletora
        this._setupWater(quality);
    }

    _setupLights(quality) {
        const B = window.BABYLON;

        // Luz Ambiente Noturna
        this.hemi = new B.HemisphericLight('hemiLight', new B.Vector3(0, 1, 0), this.scene);
        this.hemi.diffuse = new B.Color3(0.24, 0.32, 0.48);
        this.hemi.groundColor = new B.Color3(0.04, 0.05, 0.08);
        this.hemi.intensity = 0.65;

        // Luz Direcional Principal da Lua
        this.moonLight = new B.DirectionalLight('moonLight', new B.Vector3(0.35, -0.65, -0.55), this.scene);
        this.moonLight.position = new B.Vector3(-35, 65, 80);
        this.moonLight.intensity = 2.2;
        this.moonLight.diffuse = new B.Color3(0.88, 0.94, 1.0);
        this.moonLight.specular = new B.Color3(0.9, 0.95, 1.0);

        // Luz de Preenchimento Quente (Fill Light)
        this.fillLight = new B.DirectionalLight('fillLight', new B.Vector3(-0.3, -0.4, 0.6), this.scene);
        this.fillLight.position = new B.Vector3(25, 30, -40);
        this.fillLight.intensity = 0.45;
        this.fillLight.diffuse = new B.Color3(0.95, 0.75, 0.45);

        // Luz Pontual Quente na Entrada do Castelo
        this.warmGate = new B.PointLight('warmGate', new B.Vector3(0, 7.8, 9.6), this.scene);
        this.warmGate.diffuse = new B.Color3(1.0, 0.72, 0.32);
        this.warmGate.intensity = 24;
        this.warmGate.range = 38;

        // Farol no Coruchéu Central
        this.spireBeacon = new B.PointLight('spireBeacon', new B.Vector3(0, 42, -1.4), this.scene);
        this.spireBeacon.diffuse = new B.Color3(1.0, 0.82, 0.45);
        this.spireBeacon.intensity = 16;
        this.spireBeacon.range = 45;

        // Gerador de Sombras Suaves (Cascaded / PCF)
        if (quality.shadows) {
            this.shadowGenerator = new B.ShadowGenerator(quality.shadowMap, this.moonLight);
            this.shadowGenerator.usePercentageCloserFiltering = true;
            this.shadowGenerator.filteringQuality = B.ShadowGenerator.QUALITY_HIGH;
            this.shadowGenerator.bias = 0.0004;
            this.shadowGenerator.normalBias = 0.02;
        }
    }

    _setupWater(quality) {
        const B = window.BABYLON;
        const waterMesh = B.MeshBuilder.CreateGround('water_plane', {
            width: 240,
            height: 240,
            subdivisions: 32
        }, this.scene);
        waterMesh.position.y = 0.12;

        if (B.WaterMaterial && quality.waterSize >= 256) {
            const water = new B.WaterMaterial('lake_water_mat', this.scene, new B.Vector2(quality.waterSize, quality.waterSize));
            water.bumpTexture = getWaterBumpTexture(this.scene);
            water.windForce = -6;
            water.waveHeight = 0.22;
            water.bumpHeight = 0.6;
            water.waveLength = 0.18;
            water.waterColor = new B.Color3(0.04, 0.14, 0.26);
            water.colorBlendFactor = 0.38;

            water.addToRenderList(this.terrain);
            water.addToRenderList(this.moon.moonMesh);

            waterMesh.material = water;
            this.waterMat = water;
        } else {
            // Material PBR para água leve
            const pbrWater = new B.PBRMaterial('pbr_water_mat', this.scene);
            pbrWater.albedoColor = new B.Color3(0.03, 0.1, 0.18);
            pbrWater.bumpTexture = getWaterBumpTexture(this.scene);
            pbrWater.roughness = 0.12;
            pbrWater.metallic = 0.85;
            pbrWater.emissiveColor = new B.Color3(0.01, 0.04, 0.08);
            waterMesh.material = pbrWater;
            this.waterMat = pbrWater;
        }
    }

    setGlow(intensity) {
        this.castle.setGlow(intensity);
        this.warmGate.intensity = 14 + intensity * 26;
        this.spireBeacon.intensity = 10 + intensity * 20;
        this.fillLight.intensity = 0.45 + intensity * 0.3;
    }

    tick(time) {
        this.castle.tick(time);
        if (this.moon?.moonMesh) {
            this.moon.moonMesh.rotation.y = time * 0.012;
        }
    }
}

