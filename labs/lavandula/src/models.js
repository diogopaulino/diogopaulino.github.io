/**
 * Modelos construídos com primitivas — nenhum GLB externo.
 * Viajante, ciprestes, oliveiras, casa de pedra, banco, poço e pés de lavanda.
 */

import * as THREE from 'three';
import {
    lavenderTexture, wheatTexture, barkTexture, leafTexture,
    oliveLeafTexture, stoneTexture, terracottaTexture, linenTexture
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

function applyWind(material, amount = 0.22) {
    material.userData.uTime = { value: 0 };
    material.userData.uWind = { value: amount };
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = material.userData.uTime;
        shader.uniforms.uWind = material.userData.uWind;
        shader.vertexShader = shader.vertexShader
            .replace(
                '#include <common>',
                /* glsl */ `#include <common>
                uniform float uTime;
                uniform float uWind;`
            )
            .replace(
                '#include <begin_vertex>',
                /* glsl */ `#include <begin_vertex>
                float h = uv.y;
                transformed.x += sin(uTime * 1.15 + position.x * 0.28 + position.z * 0.12) * uWind * h;
                transformed.z += cos(uTime * 0.92 + position.z * 0.22) * uWind * 0.55 * h;`
            );
    };
}

/** Dois planos cruzados com textura de lavanda. */
export function lavenderGeometry() {
    const geo = new THREE.BufferGeometry();
    const w = 0.32;
    const h = 1.18;
    const positions = [];
    const uvs = [];
    const normals = [];
    const addPlane = (ax, az) => {
        const nx = -az;
        const nz = ax;
        positions.push(
            -w * ax, 0, -w * az,
            w * ax, 0, w * az,
            w * ax, h, w * az,
            -w * ax, 0, -w * az,
            w * ax, h, w * az,
            -w * ax, h, -w * az
        );
        uvs.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1);
        for (let i = 0; i < 6; i++) normals.push(nx, 0, nz);
    };
    addPlane(1, 0);
    addPlane(0, 1);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geo;
}

export function lavenderMaterial() {
    const m = new THREE.MeshStandardMaterial({
        map: lavenderTexture(),
        color: 0xffffff,
        roughness: 0.78,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.22,
        depthWrite: false
    });
    applyWind(m, 0.18);
    return m;
}

export function wheatMaterial() {
    const m = new THREE.MeshStandardMaterial({
        map: wheatTexture(),
        color: 0xffffff,
        roughness: 0.86,
        metalness: 0,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.22,
        depthWrite: false
    });
    applyWind(m, 0.28);
    return m;
}

/**
 * Viajante de túnica de linho — um homem voltando para casa, não um soldado.
 */
export function buildTraveler() {
    const group = new THREE.Group();
    const skin = std(0xc49a72, 0.68);
    const hair = std(0x2a2218, 0.9);
    const linen = new THREE.MeshStandardMaterial({
        map: linenTexture(),
        color: 0xe8dcc0,
        roughness: 0.9
    });
    const leather = std(0x5a3a22, 0.78, 0.08);
    const sandal = std(0x4a3220, 0.86);

    const hips = new THREE.Group();
    group.add(hips);

    const parts = { legs: [], arms: [], feet: [] };

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.13, 0.92, 0);
        hips.add(leg);
        const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.48, 8), skin);
        thigh.position.y = -0.24;
        leg.add(thigh);
        const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.42, 8), skin);
        calf.position.y = -0.66;
        leg.add(calf);
        const footM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.22), sandal);
        footM.position.set(0, -0.9, 0.04);
        leg.add(footM);
        parts.legs.push(leg);
        parts.feet.push(footM);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.94;
    hips.add(torso);

    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.95, 10), linen);
    robe.position.y = 0.22;
    torso.add(robe);

    const chest = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.42, 10), linen);
    chest.position.y = 0.62;
    torso.add(chest);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.035, 6, 16), leather);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.38;
    torso.add(belt);

    const cloak = new THREE.Mesh(
        new THREE.PlaneGeometry(0.62, 0.95),
        std(0x6a4a38, 0.92, 0.02, { side: THREE.DoubleSide })
    );
    cloak.position.set(0, 0.42, -0.2);
    cloak.rotation.x = 0.12;
    torso.add(cloak);

    const head = new THREE.Group();
    head.position.y = 0.95;
    torso.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 10), skin);
    head.add(skull);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), std(0xb48a64, 0.7));
    jaw.scale.set(0.9, 0.7, 0.85);
    jaw.position.set(0, -0.1, 0.02);
    head.add(jaw);

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), hair);
    hairCap.scale.set(1.02, 0.72, 1.05);
    hairCap.position.y = 0.06;
    head.add(hairCap);

    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), std(0xf4efe6, 0.35));
        eye.position.set(sx * 0.048, 0.02, 0.138);
        head.add(eye);
        const iris = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 5), std(0x3a4a28, 0.4));
        iris.position.set(sx * 0.048, 0.02, 0.154);
        head.add(iris);
    }

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.04), hair);
    brow.position.set(0, 0.06, 0.12);
    head.add(brow);

    const armGeo = new THREE.CylinderGeometry(0.055, 0.045, 0.52, 8);
    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.28, 0.72, 0);
        torso.add(arm);
        const mesh = new THREE.Mesh(armGeo, skin);
        mesh.position.y = -0.24;
        arm.add(mesh);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
        hand.position.y = -0.52;
        arm.add(hand);
        parts.arms.push(arm);
    }

    enableShadows(group);
    group.userData.parts = { ...parts, torso, head, hips, cloak };
    return { group, parts: group.userData.parts };
}

/** Cipreste toscano — coluna verde-escura. */
export function buildCypress(rng = Math.random) {
    const group = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({
        map: barkTexture(),
        color: 0x4a3828,
        roughness: 0.94
    });
    const leaf = new THREE.MeshStandardMaterial({
        map: leafTexture(),
        color: 0x2a4a28,
        roughness: 0.82
    });
    const h = 9.5 + rng() * 4.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.28, h * 0.35, 7), bark);
    trunk.position.y = h * 0.175;
    group.add(trunk);
    const layers = 5;
    for (let i = 0; i < layers; i++) {
        const t = i / (layers - 1);
        const cone = new THREE.Mesh(
            new THREE.ConeGeometry(1.15 - t * 0.85, h * 0.38, 8),
            leaf
        );
        cone.position.y = h * (0.28 + t * 0.55);
        group.add(cone);
    }
    enableShadows(group);
    return group;
}

/** Oliveira de tronco torcido e copa prateada. */
export function buildOlive(rng = Math.random) {
    const group = new THREE.Group();
    const bark = new THREE.MeshStandardMaterial({
        map: barkTexture(),
        color: 0x6a5a40,
        roughness: 0.95
    });
    const leaf = new THREE.MeshStandardMaterial({
        map: oliveLeafTexture(),
        color: 0xa8b878,
        roughness: 0.8
    });
    const h = 3.6 + rng() * 1.8;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, h, 7), bark);
    trunk.position.y = h * 0.5;
    trunk.rotation.z = (rng() - 0.5) * 0.25;
    group.add(trunk);
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, h * 0.5, 6), bark);
    fork.position.set(0.35, h * 0.72, 0);
    fork.rotation.z = -0.7;
    group.add(fork);
    for (let i = 0; i < 4; i++) {
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(1, 9, 7), leaf);
        canopy.scale.set(1.35 + rng() * 0.4, 0.7, 1.2 + rng() * 0.3);
        canopy.position.set((rng() - 0.5) * 1.1, h + 0.15 - i * 0.18, (rng() - 0.5) * 1.1);
        group.add(canopy);
    }
    enableShadows(group);
    return group;
}

/** Casa de pedra com telhado de telha — o fim do caminho. */
export function buildFarmhouse() {
    const group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({
        map: stoneTexture(),
        color: 0xc8b8a4,
        roughness: 0.92
    });
    const roof = new THREE.MeshStandardMaterial({
        map: terracottaTexture(),
        color: 0xc45a32,
        roughness: 0.78
    });
    const wood = std(0x5a3a22, 0.86);
    const glow = new THREE.MeshStandardMaterial({
        color: 0xffd080,
        emissive: 0xffb040,
        emissiveIntensity: 0.85,
        roughness: 0.4
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(8.4, 4.2, 6.2), stone);
    body.position.y = 2.1;
    group.add(body);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.2, 4.4), stone);
    wing.position.set(5.4, 1.6, 0.4);
    group.add(wing);

    const roofMain = new THREE.Mesh(new THREE.ConeGeometry(6.4, 2.8, 4), roof);
    roofMain.position.y = 5.5;
    roofMain.rotation.y = Math.PI / 4;
    group.add(roofMain);

    const roofWing = new THREE.Mesh(new THREE.ConeGeometry(3.4, 1.8, 4), roof);
    roofWing.position.set(5.4, 4.05, 0.4);
    roofWing.rotation.y = Math.PI / 4;
    group.add(roofWing);

    const door = new THREE.Mesh(new THREE.BoxGeometry(1.15, 2.15, 0.12), wood);
    door.position.set(0, 1.1, 3.16);
    group.add(door);

    for (const sx of [-2.4, 2.4]) {
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.08), glow);
        win.position.set(sx, 2.55, 3.16);
        group.add(win);
    }
    const winSide = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.7), glow);
    winSide.position.set(7.52, 2.1, 0.4);
    group.add(winSide);

    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.7), stone);
    chimney.position.set(-2.4, 6.2, -1.1);
    group.add(chimney);

    enableShadows(group);
    return group;
}

export function buildBench() {
    const group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({
        map: stoneTexture(),
        color: 0xb0a090,
        roughness: 0.9
    });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.48), stone);
    slab.position.y = 0.42;
    group.add(slab);
    for (const sx of [-0.7, 0.7]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.42, 0.4), stone);
        leg.position.set(sx, 0.21, 0);
        group.add(leg);
    }
    enableShadows(group);
    return group;
}

export function buildWell() {
    const group = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({
        map: stoneTexture(),
        color: 0xa89880,
        roughness: 0.92
    });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.7, 12, 1, true), stone);
    ring.position.y = 0.35;
    group.add(ring);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.08, 6, 16), stone);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.7;
    group.add(lip);
    const post = std(0x5a3a22, 0.86);
    for (const sx of [-0.7, 0.7]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), post);
        p.position.set(sx, 1.45, 0);
        group.add(p);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), post);
    beam.rotation.z = Math.PI / 2;
    beam.position.y = 2.2;
    group.add(beam);
    enableShadows(group);
    return group;
}

/** Colina distante — silhueta no horizonte. */
export function buildDistantHill() {
    const geo = new THREE.SphereGeometry(18, 10, 7);
    geo.scale(2.4, 0.55, 1.6);
    const matHill = new THREE.MeshStandardMaterial({
        color: 0x6a4868,
        roughness: 0.95,
        flatShading: true
    });
    const mesh = new THREE.Mesh(geo, matHill);
    mesh.receiveShadow = true;
    return mesh;
}
