/**
 * Modelos da savana: acácia, baobá, kopje, grama, jeep.
 * Tudo construído com primitivas — nenhum GLB externo.
 */

import * as THREE from 'three';
import {
    barkTexture, canopyTexture, rockTexture, jeepCanvasTexture, grassTexture
} from './textures.js';

const matCache = new Map();

function mat(key, factory) {
    if (!matCache.has(key)) matCache.set(key, factory());
    return matCache.get(key);
}

export function std(color, roughness = 0.82, metalness = 0.04, extra = {}) {
    return mat(`std:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`, () =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
}

function enableShadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

/** Acácia de copa achatada — silhueta clássica da savana. */
export function buildAcacia(rng = Math.random) {
    const group = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({
        map: barkTexture(),
        color: 0x6a4a30,
        roughness: 0.92
    });
    const leaf = new THREE.MeshStandardMaterial({
        map: canopyTexture(),
        color: 0x8aaa44,
        roughness: 0.78
    });

    const h = 5.2 + rng() * 3.4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, h, 8), bark);
    trunk.position.y = h * 0.5;
    group.add(trunk);

    const lean = (rng() - 0.5) * 0.18;
    trunk.rotation.z = lean;

    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h * 0.45, 6), bark);
    fork.position.set(0.35, h * 0.78, 0);
    fork.rotation.z = -0.55;
    group.add(fork);

    const layers = 3 + (rng() > 0.5 ? 1 : 0);
    for (let i = 0; i < layers; i++) {
        const r = 3.2 + rng() * 2.4 - i * 0.35;
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 7), leaf);
        canopy.scale.set(r, 0.38 + rng() * 0.18, r * (0.85 + rng() * 0.2));
        canopy.position.set((rng() - 0.5) * 0.8, h + 0.2 - i * 0.35, (rng() - 0.5) * 0.8);
        group.add(canopy);
    }

    enableShadows(group);
    return group;
}

/** Baobá — tronco enorme, copa pequena. Marco no horizonte. */
export function buildBaobab() {
    const group = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({
        map: barkTexture(),
        color: 0x8a6a48,
        roughness: 0.95
    });
    const leaf = new THREE.MeshStandardMaterial({
        map: canopyTexture(),
        color: 0x6a8030,
        roughness: 0.8
    });

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.1, 9.5, 12), bark);
    trunk.position.y = 4.75;
    group.add(trunk);

    const bulge = new THREE.Mesh(new THREE.SphereGeometry(2.8, 10, 8), bark);
    bulge.scale.set(1, 0.7, 1);
    bulge.position.y = 3.2;
    group.add(bulge);

    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 4.2, 6), bark);
        arm.position.set(Math.cos(a) * 1.6, 9.4, Math.sin(a) * 1.6);
        arm.rotation.z = Math.cos(a) * 0.55;
        arm.rotation.x = Math.sin(a) * 0.55;
        group.add(arm);
        const puff = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), leaf);
        puff.scale.set(1.4, 0.55, 1.4);
        puff.position.set(Math.cos(a) * 3.2, 11.2, Math.sin(a) * 3.2);
        group.add(puff);
    }

    enableShadows(group);
    return group;
}

export function buildKopje(rng = Math.random) {
    const group = new THREE.Group();
    const rock = new THREE.MeshStandardMaterial({
        map: rockTexture(),
        color: 0xb8a890,
        roughness: 0.9
    });
    const n = 4 + Math.floor(rng() * 4);
    for (let i = 0; i < n; i++) {
        const s = 1.4 + rng() * 2.8;
        const mesh = new THREE.Mesh(new THREE.DodecahedronGeometry(s * 0.55, 0), rock);
        mesh.position.set((rng() - 0.5) * 4.5, s * 0.35, (rng() - 0.5) * 4.5);
        mesh.rotation.set(rng() * 1, rng() * 2, rng() * 1);
        mesh.scale.set(1 + rng() * 0.4, 0.7 + rng() * 0.5, 1 + rng() * 0.3);
        group.add(mesh);
    }
    enableShadows(group);
    return group;
}

export function buildDistantHill() {
    const group = new THREE.Group();
    const matHill = std(0xc4a070, 0.95);
    const a = new THREE.Mesh(new THREE.ConeGeometry(48, 22, 7), matHill);
    a.position.set(0, 8, 0);
    group.add(a);
    const b = new THREE.Mesh(new THREE.ConeGeometry(28, 16, 6), matHill);
    b.position.set(22, 6, 8);
    group.add(b);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), std(0xf2efe8, 0.7));
    cap.position.set(0, 18, 0);
    cap.scale.set(1.4, 0.45, 1.4);
    group.add(cap);
    return group;
}

export function grassBladeGeometry() {
    const geo = new THREE.PlaneGeometry(0.42, 0.95);
    geo.translate(0, 0.47, 0);
    return geo;
}

export function applyGrassWind(material) {
    material.userData.uTime = { value: 0 };
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = material.userData.uTime;
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                /* glsl */ `#include <common>
                uniform float uTime;`
            )
            .replace(
                '#include <begin_vertex>',
                /* glsl */ `#include <begin_vertex>
                float h = uv.y;
                transformed.x += sin(uTime * 1.35 + position.x * 0.22) * 0.16 * h;
                transformed.z += cos(uTime * 1.05 + position.z * 0.18) * 0.10 * h;`
            );
    };
}

export function grassMaterial() {
    const m = new THREE.MeshStandardMaterial({
        map: grassTexture(),
        color: 0xd2b45a,
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.28,
        depthWrite: false
    });
    applyGrassWind(m);
    return m;
}

/** Land Rover clássico de safari, teto de lona. */
export function buildJeep() {
    const group = new THREE.Group();
    const body = std(0x6a5a28, 0.62, 0.18);
    const dark = std(0x2a2418, 0.7, 0.2);
    const chrome = std(0xd8d0c4, 0.28, 0.85);
    const canvas = new THREE.MeshStandardMaterial({
        map: jeepCanvasTexture(),
        color: 0xe8d8b0,
        roughness: 0.88
    });
    const rubber = std(0x1a1612, 0.9, 0.05);

    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.15, 0.72, 4.35), body);
    chassis.position.y = 1.05;
    group.add(chassis);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.38, 1.45), body);
    hood.position.set(0, 1.38, 1.42);
    group.add(hood);

    const grill = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.42, 0.08), dark);
    grill.position.set(0, 1.18, 2.18);
    group.add(grill);

    for (const sx of [-1, 1]) {
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8),
            new THREE.MeshStandardMaterial({
                color: 0xfff2c8,
                emissive: 0xffe08a,
                emissiveIntensity: 0.55,
                roughness: 0.2
            }));
        light.position.set(sx * 0.72, 1.18, 2.2);
        group.add(light);

        const fender = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.28, 1.1), body);
        fender.position.set(sx * 1.12, 0.95, 1.5);
        group.add(fender);
    }

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.95, 1.7), canvas);
    cabin.position.set(0, 1.85, -0.35);
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.08, 1.85), canvas);
    roof.position.set(0, 2.36, -0.38);
    group.add(roof);

    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.04, 6, 16, Math.PI), chrome);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(0, 2.05, 0.55);
    group.add(bar);

    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.18, 16), rubber);
    spare.rotation.z = Math.PI / 2;
    spare.position.set(0, 1.35, -2.28);
    group.add(spare);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.2, 10), chrome);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(spare.position);
    group.add(hub);

    const wheels = [];
    const wheelGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.32, 14);
    for (const [sx, sz] of [[-1, 1.35], [1, 1.35], [-1, -1.45], [1, -1.45]]) {
        const w = new THREE.Mesh(wheelGeo, rubber);
        w.rotation.z = Math.PI / 2;
        w.position.set(sx * 1.12, 0.48, sz);
        group.add(w);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.34, 8), chrome);
        cap.rotation.z = Math.PI / 2;
        cap.position.copy(w.position);
        group.add(cap);
        wheels.push(w);
    }

    const bumper = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.14, 0.18), dark);
    bumper.position.set(0, 0.72, 2.22);
    group.add(bumper);

    enableShadows(group);
    group.userData.wheels = wheels;
    return group;
}
