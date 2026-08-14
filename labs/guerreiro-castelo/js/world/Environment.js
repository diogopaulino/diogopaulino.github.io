/**
 * Fogo, fumaça, tochas e instâncias de vegetação.
 */

import * as THREE from 'three';
import { barkTexture, leafTexture, grassTexture, mossTexture } from './Textures.js';
import { std } from '../characters/builders.js';

export function makeTorch() {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.5, 6), std(0x4a3218, 0.9));
    stick.position.y = 0.25;
    g.add(stick);
    const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.07, 0.22, 6),
        new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xff6611, emissiveIntensity: 2.4 })
    );
    flame.position.y = 0.58;
    g.add(flame);
    g.userData.flame = flame;
    return g;
}

export function makeFire(size = 1) {
    const g = new THREE.Group();
    const logs = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * size, 0.08 * size, 0.7 * size, 6), std(0x3a2414, 0.9));
    logs.rotation.z = Math.PI / 2;
    g.add(logs);
    const logs2 = logs.clone();
    logs2.rotation.y = 1.1;
    g.add(logs2);
    const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.22 * size, 0.7 * size, 7),
        new THREE.MeshStandardMaterial({
            color: 0xff8020,
            emissive: 0xff5500,
            emissiveIntensity: 2.8,
            transparent: true,
            opacity: 0.92
        })
    );
    flame.position.y = 0.35 * size;
    g.add(flame);
    const glow = new THREE.PointLight(0xff6a22, 1.6 * size, 8 * size);
    glow.position.y = 0.4 * size;
    glow.castShadow = false;
    g.add(glow);
    g.userData.flame = flame;
    g.userData.glow = glow;
    return g;
}

export function updateFire(group, t) {
    if (!group?.userData.flame) return;
    const s = 0.85 + Math.sin(t * 11) * 0.12 + Math.sin(t * 17) * 0.06;
    group.userData.flame.scale.set(s, 0.9 + Math.sin(t * 9) * 0.15, s);
    if (group.userData.glow) group.userData.glow.intensity = 1.3 + Math.sin(t * 13) * 0.35;
}

export function makeTree(rng = Math.random) {
    const g = new THREE.Group();
    const h = 3.2 + rng() * 2.4;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.16, 0.22, h, 7),
        new THREE.MeshStandardMaterial({ map: barkTexture(), roughness: 0.92 })
    );
    trunk.position.y = h / 2;
    trunk.castShadow = true;
    g.add(trunk);
    const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(1.3 + rng() * 0.6, 10, 8),
        new THREE.MeshStandardMaterial({ map: leafTexture(), color: 0x3a7a28, roughness: 0.85 })
    );
    canopy.position.y = h + 0.4;
    canopy.castShadow = true;
    g.add(canopy);
    const c2 = canopy.clone();
    c2.scale.setScalar(0.7);
    c2.position.set((rng() - 0.5) * 0.8, h + 0.8, (rng() - 0.5) * 0.8);
    g.add(c2);
    return g;
}

export function makeBush() {
    const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshStandardMaterial({ map: mossTexture(), color: 0x3a6a28, roughness: 0.9 })
    );
    m.scale.set(1.2, 0.7, 1);
    m.castShadow = true;
    return m;
}

export function makeRock(s = 1) {
    const m = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5 * s, 0),
        new THREE.MeshStandardMaterial({ color: 0x6a665c, roughness: 0.95 })
    );
    m.scale.set(1 + Math.random() * 0.4, 0.6 + Math.random() * 0.5, 1 + Math.random() * 0.3);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function grassBladeGeo() {
    return new THREE.PlaneGeometry(0.12, 0.45);
}

export function makeGrassInstanced(count, spread, qualityScale = 1) {
    const n = Math.floor(count * qualityScale);
    const mesh = new THREE.InstancedMesh(
        grassBladeGeo(),
        new THREE.MeshStandardMaterial({
            map: grassTexture(),
            color: 0x4a8a30,
            side: THREE.DoubleSide,
            roughness: 0.9
        }),
        n
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < n; i++) {
        dummy.position.set((Math.random() - 0.5) * spread, 0.2, (Math.random() - 0.5) * spread);
        dummy.rotation.y = Math.random() * Math.PI;
        dummy.scale.setScalar(0.7 + Math.random() * 0.8);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
}

export class EnvironmentFX {
    constructor() {
        this.fires = [];
    }

    addFire(f) {
        this.fires.push(f);
    }

    update(t) {
        for (const f of this.fires) updateFire(f, t);
    }

    clear() {
        this.fires.length = 0;
    }
}
