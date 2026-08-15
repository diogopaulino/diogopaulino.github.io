/**
 * Elementos do cenário: árvores, rochas, arbustos, tochas e fogo em Babylon.js.
 */

import { barkTexture, leafTexture, stoneTexture, woodTexture } from './Textures.js';

export function makeTree(rng = Math.random, scene) {
    const root = new BABYLON.TransformNode('treeRoot', scene);

    const trunkH = 4 + rng() * 2;
    const trunk = BABYLON.MeshBuilder.CreateCylinder('treeTrunk', {
        diameterTop: 0.35,
        diameterBottom: 0.55,
        height: trunkH,
        tessellation: 7
    }, scene);
    trunk.position.y = trunkH / 2;
    trunk.parent = root;

    const trunkMat = new BABYLON.StandardMaterial('trunkMat', scene);
    trunkMat.diffuseTexture = barkTexture(scene, 1, 2);
    trunkMat.specularColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    trunk.material = trunkMat;

    const foliage = new BABYLON.TransformNode('treeFoliage', scene);
    foliage.parent = root;
    foliage.position.y = trunkH * 0.75;

    const leafMat = new BABYLON.StandardMaterial('leafMat', scene);
    leafMat.diffuseTexture = leafTexture(scene, 2, 2);
    leafMat.specularColor = new BABYLON.Color3(0.02, 0.02, 0.02);

    const layers = 3;
    for (let i = 0; i < layers; i++) {
        const cone = BABYLON.MeshBuilder.CreateCylinder(`treeCone_${i}`, {
            diameterTop: 0,
            diameterBottom: 3.2 - i * 0.7 + rng() * 0.4,
            height: 2.2,
            tessellation: 7
        }, scene);
        cone.position.y = i * 1.3;
        cone.material = leafMat;
        cone.parent = foliage;
    }

    return root;
}

export function makeRock(scale = 1, scene) {
    const mesh = BABYLON.MeshBuilder.CreateSphere('rockMesh', {
        diameter: scale * 2,
        segments: 6
    }, scene);
    mesh.scaling = new BABYLON.Vector3(1 + Math.random() * 0.3, 0.7 + Math.random() * 0.4, 1 + Math.random() * 0.3);
    mesh.rotation.y = Math.random() * Math.PI * 2;
    mesh.rotation.x = (Math.random() - 0.5) * 0.4;

    const rockMat = new BABYLON.StandardMaterial('rockMat', scene);
    rockMat.diffuseTexture = stoneTexture(scene, 2, 2);
    rockMat.specularColor = new BABYLON.Color3(0.08, 0.08, 0.08);
    mesh.material = rockMat;

    return mesh;
}

export function makeBush(scene) {
    const root = new BABYLON.TransformNode('bushRoot', scene);
    const leafMat = new BABYLON.StandardMaterial('bushLeafMat', scene);
    leafMat.diffuseTexture = leafTexture(scene, 1, 1);

    for (let i = 0; i < 4; i++) {
        const b = BABYLON.MeshBuilder.CreateSphere(`bushPart_${i}`, {
            diameter: 0.9 + Math.random() * 0.5,
            segments: 6
        }, scene);
        b.position.set((Math.random() - 0.5) * 0.6, 0.35 + Math.random() * 0.3, (Math.random() - 0.5) * 0.6);
        b.material = leafMat;
        b.parent = root;
    }
    return root;
}

export function makeGrassInstanced(count, radius, quality = 1, scene) {
    const root = new BABYLON.TransformNode('grassGroup', scene);
    const actualCount = Math.floor(count * quality);
    if (actualCount <= 0) return root;

    const blade = BABYLON.MeshBuilder.CreatePlane('grassBlade', {
        width: 0.35,
        height: 0.7
    }, scene);
    const gMat = new BABYLON.StandardMaterial('grassBladeMat', scene);
    gMat.diffuseColor = new BABYLON.Color3(0.24, 0.46, 0.16);
    gMat.backFaceCulling = false;
    blade.material = gMat;
    blade.parent = root;
    blade.isVisible = false;

    for (let i = 0; i < actualCount; i++) {
        const inst = blade.createInstance(`grass_${i}`);
        const r = Math.sqrt(Math.random()) * radius;
        const theta = Math.random() * Math.PI * 2;
        inst.position.set(Math.cos(theta) * r, 0.35, Math.sin(theta) * r);
        inst.rotation.y = Math.random() * Math.PI * 2;
        inst.scaling.setScalar(0.7 + Math.random() * 0.6);
        inst.parent = root;
    }

    return root;
}

export function makeTorch(scene) {
    const root = new BABYLON.TransformNode('torchRoot', scene);

    const stick = BABYLON.MeshBuilder.CreateCylinder('torchStick', {
        diameterTop: 0.06,
        diameterBottom: 0.04,
        height: 0.5,
        tessellation: 6
    }, scene);
    stick.position.y = 0.25;
    stick.parent = root;

    const stickMat = new BABYLON.StandardMaterial('torchWoodMat', scene);
    stickMat.diffuseTexture = woodTexture(scene, 1, 1);
    stick.material = stickMat;

    const head = BABYLON.MeshBuilder.CreateCylinder('torchHead', {
        diameterTop: 0.12,
        diameterBottom: 0.08,
        height: 0.14,
        tessellation: 6
    }, scene);
    head.position.y = 0.5;
    head.parent = root;

    const headMat = new BABYLON.StandardMaterial('torchHeadMat', scene);
    headMat.diffuseColor = new BABYLON.Color3(0.2, 0.15, 0.1);
    head.material = headMat;

    const light = new BABYLON.PointLight('torchLight', new BABYLON.Vector3(0, 0.6, 0), scene);
    light.diffuse = new BABYLON.Color3(1.0, 0.6, 0.2);
    light.intensity = 1.2;
    light.range = 8;
    light.parent = root;

    root.userData = { light };
    return root;
}

export function makeFire(scale = 1, scene) {
    const root = new BABYLON.TransformNode('fireRoot', scene);

    const fireSystem = new BABYLON.ParticleSystem('fireParticles', Math.floor(100 * scale), scene);

    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 32;
    const ctx = c.getContext('2d');
    const rad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    rad.addColorStop(0, 'rgba(255, 220, 120, 1)');
    rad.addColorStop(0.4, 'rgba(255, 120, 30, 0.8)');
    rad.addColorStop(1, 'rgba(200, 40, 10, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, 32, 32);

    fireSystem.particleTexture = new BABYLON.DynamicTexture('fireTex', c, scene, false);
    fireSystem.emitter = root;
    fireSystem.minEmitBox = new BABYLON.Vector3(-0.15 * scale, 0, -0.15 * scale);
    fireSystem.maxEmitBox = new BABYLON.Vector3(0.15 * scale, 0.1 * scale, 0.15 * scale);

    fireSystem.color1 = new BABYLON.Color4(1.0, 0.7, 0.2, 1.0);
    fireSystem.color2 = new BABYLON.Color4(1.0, 0.3, 0.1, 0.8);
    fireSystem.colorDead = new BABYLON.Color4(0.3, 0.05, 0.0, 0.0);

    fireSystem.minSize = 0.25 * scale;
    fireSystem.maxSize = 0.55 * scale;
    fireSystem.minLifeTime = 0.35;
    fireSystem.maxLifeTime = 0.7;

    fireSystem.emitRate = Math.floor(45 * scale);
    fireSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;
    fireSystem.gravity = new BABYLON.Vector3(0, 4.5, 0);
    fireSystem.direction1 = new BABYLON.Vector3(-0.3, 1.8, -0.3);
    fireSystem.direction2 = new BABYLON.Vector3(0.3, 2.4, 0.3);
    fireSystem.start();

    root.userData = { fireSystem };
    return root;
}

export class EnvironmentFX {
    constructor() {
        this.fires = [];
    }

    addFire(fireNode) {
        if (fireNode) this.fires.push(fireNode);
    }

    update(time) {
        // Jitter luzes das tochas/lareira
        for (const f of this.fires) {
            const light = f.userData?.light;
            if (light) {
                light.intensity = 1.0 + Math.sin(time * 12 + light.uniqueId) * 0.25;
            }
        }
    }
}
