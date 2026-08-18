/**
 * Modelos construídos com primitivas — nenhum GLB externo.
 * Viajante, ciprestes, oliveiras, casa de pedra, banco, poço e pés de lavanda.
 */

import * as THREE from 'three';
import { loadGreenScreenTexture, 
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
    const w = 0.38;
    const h = 1.32;
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

export function lavenderMaterial(wind = true) {
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
    if (wind) applyWind(m, 0.18);
    return m;
}

export function wheatMaterial(wind = true) {
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
    if (wind) applyWind(m, 0.28);
    return m;
}

/**
 * Viajante de túnica de linho — um homem voltando para casa, não um soldado.
 */

export function buildTraveler() {
    const group = new THREE.Group();
    const dummy = new THREE.Group();
    const parts = { legs: [dummy, dummy], arms: [dummy, dummy], feet: [dummy, dummy], torso: dummy, head: dummy, hips: dummy, cloak: dummy };

    
    const mat = new THREE.MeshStandardMaterial({
        map: loadGreenScreenTexture('assets/gladiator.jpg'),
        transparent: true,
        alphaTest: 0.1,
        side: THREE.DoubleSide,
        roughness: 0.8
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.7), mat);
    mesh.position.y = 1.35;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.onBeforeRender = function(renderer, scene, camera) {
        const dx = camera.position.x - group.position.x;
        const dz = camera.position.z - group.position.z;
        mesh.rotation.y = Math.atan2(dx, dz) - group.rotation.y;
    };
    group.add(mesh);
    parts.hips = mesh; group.userData.parts = parts;
    return { group, parts };
}

/** Cipreste toscano — coluna verde-escura. */
export function buildCypress(rng = Math.random) {
    const group = new THREE.Group();
    const h = 9.5 + rng() * 4.2;
    const w = h * 0.4;
    const mat = new THREE.MeshStandardMaterial({
        map: loadGreenScreenTexture('assets/cypress.jpg'),
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        roughness: 0.9
    });
    const geo = new THREE.PlaneGeometry(w, h);
    const m1 = new THREE.Mesh(geo, mat);
    const m2 = new THREE.Mesh(geo, mat);
    m2.rotation.y = Math.PI / 2;
    m1.position.y = h / 2;
    m2.position.y = h / 2;
    m1.castShadow = true; m1.receiveShadow = true;
    m2.castShadow = true; m2.receiveShadow = true;
    group.add(m1); group.add(m2);
    return group;
}

/** Oliveira de tronco torcido e copa prateada. */
export function buildOlive(rng = Math.random) {
    const group = new THREE.Group();
    const h = 4.6 + rng() * 1.8;
    const w = h * 1.1;
    const mat = new THREE.MeshStandardMaterial({
        map: loadGreenScreenTexture('assets/olive.jpg'),
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        roughness: 0.9
    });
    const geo = new THREE.PlaneGeometry(w, h);
    const m1 = new THREE.Mesh(geo, mat);
    const m2 = new THREE.Mesh(geo, mat);
    m2.rotation.y = Math.PI / 2;
    m1.position.y = h / 2;
    m2.position.y = h / 2;
    m1.castShadow = true; m1.receiveShadow = true;
    m2.castShadow = true; m2.receiveShadow = true;
    group.add(m1); group.add(m2);
    return group;
}

/** Casa de pedra com telhado de telha — o fim do caminho. */
export function buildFarmhouse() {
    const group = new THREE.Group();
    const w = 12;
    const h = 12;
    const mat = new THREE.MeshStandardMaterial({
        map: loadGreenScreenTexture('assets/farmhouse.jpg'),
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        roughness: 0.9
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.y = h / 2;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return group;
}

export function buildBench() {
    const group = new THREE.Group();
    const w = 2.4;
    const h = 2.4;
    const mat = new THREE.MeshStandardMaterial({
        map: loadGreenScreenTexture('assets/bench.jpg'),
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        roughness: 0.9
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.y = h / 2;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    return group;
}

export function buildWell() {
    const group = new THREE.Group();
    const w = 3.6;
    const h = 3.6;
    const mat = new THREE.MeshStandardMaterial({
        map: loadGreenScreenTexture('assets/well.jpg'),
        transparent: true,
        alphaTest: 0.3,
        side: THREE.DoubleSide,
        roughness: 0.9
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.y = h / 2;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
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
