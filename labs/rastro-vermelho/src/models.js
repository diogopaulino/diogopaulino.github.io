/**
 * Modelos do faroeste: pinheiro, algodoeiro, cacto, rocha, cabana, saloon,
 * carroça, fogueira, arco de pedra, veado. Tudo em primitivas — nenhum GLB.
 */

import * as THREE from 'three';
import { barkTexture, canopyTexture, rockTexture, woodTexture, hideTexture } from './textures.js';

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

export function buildPine(rng = Math.random) {
    const group = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({
        map: barkTexture(), color: 0x4a3828, roughness: 0.94
    });
    const needle = new THREE.MeshStandardMaterial({
        map: canopyTexture(), color: 0x2a4a28, roughness: 0.82
    });
    const h = 7.5 + rng() * 5.5;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.32, h, 7), bark);
    trunk.position.y = h * 0.5;
    group.add(trunk);
    const layers = 4 + Math.floor(rng() * 2);
    for (let i = 0; i < layers; i++) {
        const t = i / layers;
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(1.8 - t * 1.15, 2.4 - t * 0.4, 7),
            needle
        );
        cone.position.y = h * 0.38 + t * h * 0.55;
        group.add(cone);
    }
    enableShadows(group);
    return group;
}

export function buildCottonwood(rng = Math.random) {
    const group = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({
        map: barkTexture(), color: 0x6a5840, roughness: 0.92
    });
    const leaf = new THREE.MeshStandardMaterial({
        map: canopyTexture(), color: 0x6a8a38, roughness: 0.78
    });
    const h = 6.2 + rng() * 3.8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, h, 8), bark);
    trunk.position.y = h * 0.5;
    group.add(trunk);
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(2.1 + rng() * 0.7, 8, 6), leaf);
    canopy.position.y = h * 0.88;
    canopy.scale.set(1.35, 0.85, 1.2);
    group.add(canopy);
    const canopy2 = canopy.clone();
    canopy2.position.set(0.7, h * 0.78, -0.4);
    canopy2.scale.setScalar(0.7);
    group.add(canopy2);
    enableShadows(group);
    return group;
}

export function buildCactus(rng = Math.random) {
    const group = new THREE.Group();
    const green = std(0x3a6a38, 0.7);
    const h = 2.4 + rng() * 2.2;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, h, 8), green);
    stem.position.y = h * 0.5;
    group.add(stem);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), green);
    cap.position.y = h;
    group.add(cap);
    if (rng() > 0.25) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 6), green);
        arm.rotation.z = Math.PI / 2;
        arm.position.set(0.45, h * 0.55, 0);
        group.add(arm);
        const up = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.7, 6), green);
        up.position.set(0.85, h * 0.55 + 0.28, 0);
        group.add(up);
    }
    if (rng() > 0.55) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.7, 6), green);
        arm.rotation.z = -Math.PI / 2;
        arm.position.set(-0.35, h * 0.42, 0);
        group.add(arm);
        const up = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 6), green);
        up.position.set(-0.7, h * 0.42 + 0.2, 0);
        group.add(up);
    }
    enableShadows(group);
    return group;
}

export function buildRock(rng = Math.random) {
    const group = new THREE.Group();
    const matRock = new THREE.MeshStandardMaterial({
        map: rockTexture(), color: 0xb07048, roughness: 0.92, flatShading: true
    });
    const n = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
        const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55 + rng() * 0.9, 0), matRock);
        m.position.set((rng() - 0.5) * 1.4, 0.25 + rng() * 0.2, (rng() - 0.5) * 1.4);
        m.rotation.set(rng() * 1, rng() * 2, rng() * 1);
        m.scale.set(0.8 + rng() * 0.8, 0.45 + rng() * 0.55, 0.8 + rng() * 0.7);
        group.add(m);
    }
    enableShadows(group);
    return group;
}

export function buildCabin() {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({
        map: woodTexture(), color: 0x8a5a32, roughness: 0.88
    });
    const dark = std(0x2a1a10, 0.9);
    const body = new THREE.Mesh(new THREE.BoxGeometry(4.2, 2.4, 3.4), wood);
    body.position.y = 1.2;
    group.add(body);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.6, 4), dark);
    roof.position.y = 3.15;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.08), dark);
    door.position.set(0, 0.7, 1.72);
    group.add(door);
    const porch = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.12, 1.1), wood);
    porch.position.set(0, 0.12, 2.1);
    group.add(porch);
    enableShadows(group);
    return group;
}

export function buildSaloon() {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({
        map: woodTexture(), color: 0x9a6840, roughness: 0.86
    });
    const paint = std(0x6a2a1a, 0.7);
    const dark = std(0x1a120c, 0.9);
    const body = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.4, 4.2), wood);
    body.position.y = 1.7;
    group.add(body);
    const falseFront = new THREE.Mesh(new THREE.BoxGeometry(6.8, 2.2, 0.18), paint);
    falseFront.position.set(0, 4.2, 2.15);
    group.add(falseFront);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.16, 4.4), dark);
    roof.position.set(0, 3.5, 0);
    roof.rotation.x = -0.08;
    group.add(roof);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 0.1), dark);
    door.position.set(0, 0.9, 2.16);
    group.add(door);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.08, 0.08), std(0xc4a060, 0.4, 0.4));
    rail.position.set(0, 1.15, 2.55);
    group.add(rail);
    enableShadows(group);
    return group;
}

export function buildWagon() {
    const group = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({
        map: woodTexture(), color: 0x7a4a28, roughness: 0.88
    });
    const iron = std(0x2a2420, 0.5, 0.4);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.7, 3.2), wood);
    bed.position.y = 0.95;
    group.add(bed);
    const canvas = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 2.6, 8, 1, true, 0, Math.PI),
        std(0xe8d8b8, 0.92)
    );
    canvas.rotation.z = Math.PI / 2;
    canvas.position.y = 1.7;
    group.add(canvas);
    for (const z of [-1.05, 1.05]) {
        for (const x of [-0.85, 0.85]) {
            const w = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.08, 6, 12), iron);
            w.position.set(x, 0.42, z);
            w.rotation.y = Math.PI / 2;
            group.add(w);
        }
    }
    enableShadows(group);
    return group;
}

export function buildCampfire() {
    const group = new THREE.Group();
    const logMat = new THREE.MeshStandardMaterial({
        map: woodTexture(), color: 0x4a3020, roughness: 0.9
    });
    for (let i = 0; i < 5; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 6), logMat);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = (i / 5) * Math.PI;
        log.position.y = 0.08;
        group.add(log);
    }
    const flame = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.7, 5),
        new THREE.MeshStandardMaterial({
            color: 0xff6a20, emissive: 0xff4010, emissiveIntensity: 1.4, roughness: 0.4
        })
    );
    flame.position.y = 0.45;
    flame.name = 'flame';
    group.add(flame);
    const light = new THREE.PointLight(0xff6a28, 1.6, 14, 1.6);
    light.position.y = 0.7;
    group.add(light);
    enableShadows(group);
    return group;
}

export function buildArch() {
    const group = new THREE.Group();
    const matRock = new THREE.MeshStandardMaterial({
        map: rockTexture(), color: 0xc45a32, roughness: 0.9, flatShading: true
    });
    const left = new THREE.Mesh(new THREE.BoxGeometry(2.2, 9, 2.4), matRock);
    left.position.set(-3.2, 4.5, 0);
    const right = left.clone();
    right.position.x = 3.2;
    const top = new THREE.Mesh(new THREE.BoxGeometry(8.6, 2.4, 2.8), matRock);
    top.position.set(0, 10.2, 0);
    top.rotation.z = 0.08;
    group.add(left, right, top);
    enableShadows(group);
    return group;
}

export function buildDeer() {
    const group = new THREE.Group();
    const hide = new THREE.MeshStandardMaterial({
        map: hideTexture(), color: 0x8a5a32, roughness: 0.78
    });
    const dark = std(0x2a1a10, 0.8);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.38, 8, 6), hide);
    body.scale.set(0.85, 0.7, 1.55);
    body.position.y = 0.85;
    group.add(body);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.45, 6), hide);
    neck.position.set(0, 1.15, 0.42);
    neck.rotation.x = 0.5;
    group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 6), hide);
    head.scale.set(0.7, 0.7, 1.2);
    head.position.set(0, 1.38, 0.62);
    group.add(head);
    for (const sx of [-1, 1]) {
        const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 4), dark);
        ant.position.set(sx * 0.08, 1.58, 0.55);
        ant.rotation.z = sx * 0.35;
        group.add(ant);
    }
    const legs = [];
    const spots = [[-0.12, 0.28], [0.12, 0.28], [-0.12, -0.28], [0.12, -0.28]];
    for (const [x, z] of spots) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.7, 5), hide);
        leg.position.set(x, 0.35, z);
        group.add(leg);
        legs.push(leg);
    }
    enableShadows(group);
    group.userData.legs = legs;
    return group;
}

export function grassBladeGeometry() {
    const geo = new THREE.PlaneGeometry(0.12, 0.55, 1, 2);
    geo.translate(0, 0.275, 0);
    return geo;
}

export function grassMaterial() {
    const matGrass = new THREE.MeshStandardMaterial({
        color: 0xc4a04a,
        roughness: 0.92,
        side: THREE.DoubleSide,
        vertexColors: false
    });
    matGrass.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`;
        shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             transformed.x += sin(uTime * 1.35 + transformed.y * 4.0 + position.z) * 0.14 * transformed.y;`
        );
        matGrass.userData.shader = shader;
    };
    return matGrass;
}

export function disposeUnique(root) {
    root.traverse((c) => {
        if (c.isMesh && c.geometry && c.geometry.userData?.unique) {
            c.geometry.dispose();
        }
    });
}
