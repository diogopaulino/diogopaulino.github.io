/**
 * Modelos 3D construídos por código — nenhum GLB externo.
 * Silhuetas em lathe, deslocamento de vértices e PBR com normal map.
 * Geometria primitiva crua (cone/esfera isolados) só entra como volume interno.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
    grassTexture, barkTexture, leafTexture, stoneTexture, marbleTexture,
    woodTexture, goldTexture, doorTexture, brickTexture, skinTexture,
    clothTexture, leatherTexture, grassBladeTexture, faceTexture, applyMaps
} from './textures.js?v=3';
import { hash2 } from './utils.js?v=3';

const matCache = new Map();
const geoCache = new Map();
const animatedMats = [];

function mat(key, factory) {
    if (!matCache.has(key)) {
        const m = factory();
        m.userData.shared = true;
        matCache.set(key, m);
    }
    return matCache.get(key);
}

function geo(key, factory) {
    if (!geoCache.has(key)) {
        const g = factory();
        g.userData.shared = true;
        geoCache.set(key, g);
    }
    return geoCache.get(key);
}

export function std(color, roughness = 0.78, metalness = 0.04, extra = {}) {
    return mat(`std:${color}:${roughness}:${metalness}:${JSON.stringify(extra)}`, () =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }));
}

function mapped(maps, color = 0xffffff, roughness = 0.86, metalness = 0.02, normalScale = 0.9) {
    const key = `map:${maps?.map?.uuid}:${color}:${roughness}:${metalness}:${normalScale}`;
    return mat(key, () => {
        const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
        applyMaps(m, maps, { color, roughness, metalness, normalScale });
        return m;
    });
}

function enableShadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

/** Empurra vértices com ruído determinístico — quebra a silhueta de primitiva. */
function warp(geometry, seed = 1, amount = 0.1, yBias = 0.55) {
    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const n = hash2(x * 13.7 + seed, z * 8.3 + y * 4.1);
        const k = 1 + (n - 0.5) * amount;
        pos.setXYZ(i, x * k, y * (1 + (n - yBias) * amount * 0.55), z * k);
    }
    geometry.computeVertexNormals();
    return geometry;
}

function lathe(pts, segs = 16, key) {
    const factory = () => {
        const g = new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), segs);
        g.computeVertexNormals();
        return g;
    };
    return key ? geo(key, factory) : factory();
}

function clothMat({ color = 0x9aa3ad, maps = null, wind = 0.18, key = 'cloth' } = {}) {
    return mat(`${key}:${color}:${wind}`, () => {
        const m = new THREE.MeshStandardMaterial({
            color,
            roughness: 0.88,
            metalness: 0,
            side: THREE.DoubleSide
        });
        if (maps) applyMaps(m, maps, { color, roughness: 0.88, metalness: 0, normalScale: 0.6 });
        m.userData.uTime = { value: 0 };
        m.userData.uWind = { value: wind };
        m.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = m.userData.uTime;
            shader.uniforms.uWind = m.userData.uWind;
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
                    float free = uv.y;
                    float flap = sin(uv.x * 6.1 + uTime * 1.7) * 0.45
                               + sin(uv.y * 4.2 - uTime * 1.3) * 0.28;
                    transformed.x += flap * free * free * uWind;
                    transformed.z += flap * free * 0.55 * uWind;`
                );
        };
        m.customProgramCacheKey = () => `anel-cloth:${wind}`;
        animatedMats.push(m);
        return m;
    });
}

export function tickMaterials(t) {
    for (const m of animatedMats) {
        if (m.userData.uTime) m.userData.uTime.value = t;
    }
}

function vegWind(material, amount = 0.11) {
    if (material.userData.uTime) return material;
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
                float h = max(transformed.y, 0.0);
                #ifdef USE_INSTANCING
                vec3 orig = instanceMatrix[3].xyz;
                #else
                vec3 orig = vec3(0.0);
                #endif
                float b = sin(uTime * 1.25 + orig.x * 0.14 + orig.z * 0.11) * uWind * h;
                transformed.x += b;
                transformed.z += b * 0.55;`
            );
    };
    material.customProgramCacheKey = () => `anel-veg:${amount}`;
    animatedMats.push(material);
    return material;
}

/* ------------------------------------------------------------------ */
/* Personagens                                                         */
/* ------------------------------------------------------------------ */

export function buildHobbit({ vest = 0xc45a2a, pants = 0x3d4a28 } = {}) {
    const group = new THREE.Group();
    const skinMaps = skinTexture();
    const skin = mapped(skinMaps, 0xf0c49a, 0.62, 0.02, 0.45);
    const hair = std(0x6b3a18, 0.92);
    const clothV = mapped(clothTexture('#c45a2a'), vest, 0.86);
    const clothP = mapped(clothTexture('#3d4a28'), pants, 0.88);
    const leather = mapped(leatherTexture(), 0x5a3a18, 0.72);
    const foot = mapped(skinMaps, 0xd4a07a, 0.78, 0.02, 0.5);

    const hips = new THREE.Group();
    group.add(hips);
    const parts = { legs: [], arms: [], feet: [] };

    for (const sx of [-1, 1]) {
        const leg = new THREE.Group();
        leg.position.set(sx * 0.11, 0.4, 0);
        hips.add(leg);
        const thigh = new THREE.Mesh(geo('hob-thigh', () => new THREE.CapsuleGeometry(0.075, 0.2, 5, 10)), clothP);
        thigh.position.y = -0.14;
        leg.add(thigh);
        const shin = new THREE.Group();
        shin.position.y = -0.28;
        leg.add(shin);
        const shinM = new THREE.Mesh(geo('hob-shin', () => new THREE.CapsuleGeometry(0.065, 0.16, 4, 8)), clothP);
        shinM.position.y = -0.1;
        shin.add(shinM);
        const footG = new THREE.Group();
        footG.position.set(0, -0.22, 0.04);
        shin.add(footG);
        const footM = new THREE.Mesh(geo('hob-foot', () => warp(new THREE.SphereGeometry(0.09, 10, 8), 4, 0.12, 0.4)), foot);
        footM.scale.set(1.2, 0.52, 1.7);
        footG.add(footM);
        for (let i = 0; i < 5; i++) {
            const tuft = new THREE.Mesh(geo('hob-tuft', () => new THREE.SphereGeometry(0.028, 6, 5)), hair);
            tuft.position.set((i - 2) * 0.022, 0.03, 0.08 + (i % 2) * 0.02);
            tuft.scale.set(1.1, 0.55, 0.9);
            footG.add(tuft);
        }
        leg.userData.shin = shin;
        parts.legs.push(leg);
        parts.feet.push(footM);
    }

    const torso = new THREE.Group();
    torso.position.y = 0.4;
    hips.add(torso);

    const belly = new THREE.Mesh(
        geo('hob-belly', () => warp(new THREE.SphereGeometry(0.27, 14, 12), 2, 0.08, 0.45)),
        clothV
    );
    belly.scale.set(1.08, 0.88, 0.92);
    belly.position.y = 0.22;
    torso.add(belly);

    const shirt = new THREE.Mesh(
        geo('hob-shirt', () => new THREE.CylinderGeometry(0.18, 0.23, 0.2, 12)),
        mapped(clothTexture('#f2e4c4'), 0xf2e4c4, 0.9)
    );
    shirt.position.y = 0.4;
    torso.add(shirt);

    const collar = new THREE.Mesh(
        geo('hob-collar', () => new THREE.TorusGeometry(0.16, 0.025, 6, 14)),
        mapped(clothTexture('#f2e4c4'), 0xeee0c0, 0.88)
    );
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.5;
    torso.add(collar);

    const belt = new THREE.Mesh(geo('hob-belt', () => new THREE.TorusGeometry(0.21, 0.028, 6, 16)), leather);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.12;
    torso.add(belt);
    const buckle = new THREE.Mesh(geo('hob-buckle', () => new THREE.BoxGeometry(0.08, 0.06, 0.03)), mapped(goldTexture(), 0xffe08a, 0.28, 0.9, 0.4));
    buckle.position.set(0, 0.12, 0.22);
    torso.add(buckle);

    const head = new THREE.Group();
    head.position.y = 0.6;
    torso.add(head);
    const skull = new THREE.Mesh(geo('hob-skull', () => warp(new THREE.SphereGeometry(0.155, 14, 12), 7, 0.06, 0.5)), skin);
    head.add(skull);
    const face = new THREE.Mesh(
        geo('hob-face', () => new THREE.SphereGeometry(0.152, 14, 12, 0, Math.PI * 2, 0.35, 1.4)),
        new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.58, metalness: 0.02 })
    );
    face.material.userData.shared = true;
    head.add(face);
    const nose = new THREE.Mesh(geo('hob-nose', () => new THREE.SphereGeometry(0.035, 8, 6)), skin);
    nose.scale.set(0.85, 0.9, 1.25);
    nose.position.set(0, -0.01, 0.15);
    head.add(nose);

    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(geo('hob-ear', () => warp(new THREE.SphereGeometry(0.05, 8, 6), 9, 0.15)), skin);
        ear.scale.set(0.65, 1.15, 0.45);
        ear.position.set(sx * 0.155, 0.02, -0.01);
        head.add(ear);
    }

    for (let i = 0; i < 22; i++) {
        const curl = new THREE.Mesh(geo('hob-curl', () => new THREE.SphereGeometry(0.05, 8, 6)), hair);
        const a = (i / 22) * Math.PI * 2;
        curl.position.set(Math.cos(a) * 0.135, 0.09 + Math.sin(i * 1.7) * 0.045, Math.sin(a) * 0.12);
        curl.scale.setScalar(0.85 + (i % 3) * 0.12);
        head.add(curl);
    }
    const bang = new THREE.Mesh(geo('hob-bang', () => new THREE.SphereGeometry(0.075, 8, 6)), hair);
    bang.position.set(0, 0.1, 0.1);
    bang.scale.set(1.15, 0.7, 0.9);
    head.add(bang);

    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.26, 0.44, 0);
        torso.add(arm);
        const upper = new THREE.Mesh(geo('hob-upper', () => new THREE.CapsuleGeometry(0.05, 0.14, 4, 8)), skin);
        upper.position.y = -0.1;
        arm.add(upper);
        const forearm = new THREE.Group();
        forearm.position.y = -0.2;
        arm.add(forearm);
        const foreM = new THREE.Mesh(geo('hob-fore', () => new THREE.CapsuleGeometry(0.045, 0.13, 4, 8)), skin);
        foreM.position.y = -0.08;
        forearm.add(foreM);
        const hand = new THREE.Mesh(geo('hob-hand', () => new THREE.SphereGeometry(0.045, 8, 6)), skin);
        hand.scale.set(1.05, 0.7, 1.15);
        hand.position.y = -0.18;
        forearm.add(hand);
        arm.userData.forearm = forearm;
        parts.arms.push(arm);
    }

    const ringGlow = new THREE.Mesh(
        geo('hob-ring', () => new THREE.TorusGeometry(0.065, 0.016, 10, 28)),
        mat('ring-glow', () => {
            const m = new THREE.MeshStandardMaterial({
                color: 0xffe08a,
                emissive: 0xffaa22,
                emissiveIntensity: 0.85,
                metalness: 1,
                roughness: 0.18
            });
            applyMaps(m, goldTexture(), { color: 0xffe08a, roughness: 0.18, metalness: 1, normalScale: 0.4 });
            m.emissive.set(0xffaa22);
            m.emissiveIntensity = 0.85;
            return m;
        })
    );
    ringGlow.rotation.x = Math.PI / 2;
    ringGlow.position.set(0.08, 0.28, 0.22);
    ringGlow.visible = false;
    torso.add(ringGlow);

    enableShadows(group);
    group.userData.parts = { ...parts, torso, head, hips, ring: ringGlow };
    return { group, parts: group.userData.parts };
}

export function buildWizard() {
    const group = new THREE.Group();
    const robeMaps = clothTexture('#9aa3ad');
    const robe = mapped(robeMaps, 0xa8b0ba, 0.9, 0, 0.55);
    const skin = mapped(skinTexture(), 0xe8d0b0, 0.64, 0.02, 0.4);
    const beard = std(0xece8dc, 0.94);

    const body = new THREE.Mesh(
        lathe([[0.08, 0], [0.48, 0.04], [0.42, 0.55], [0.3, 1.15], [0.22, 1.55], [0.16, 1.68]], 18, 'wiz-robe'),
        robe
    );
    group.add(body);

    const cloak = new THREE.Mesh(
        geo('wiz-cloak', () => {
            const g = new THREE.CylinderGeometry(0.52, 0.22, 1.35, 16, 8, true, Math.PI * 0.15, Math.PI * 1.7);
            g.translate(0, 0.7, -0.05);
            return g;
        }),
        clothMat({ color: 0x8e96a0, maps: robeMaps, wind: 0.22, key: 'wiz-cloak' })
    );
    group.add(cloak);

    const head = new THREE.Group();
    head.position.y = 1.72;
    group.add(head);
    const skull = new THREE.Mesh(geo('wiz-skull', () => warp(new THREE.SphereGeometry(0.15, 12, 10), 11, 0.05)), skin);
    head.add(skull);
    const nose = new THREE.Mesh(geo('wiz-nose', () => new THREE.SphereGeometry(0.03, 6, 5)), skin);
    nose.scale.set(0.7, 0.9, 1.4);
    nose.position.set(0, -0.01, 0.14);
    head.add(nose);
    for (const sx of [-1, 1]) {
        const brow = new THREE.Mesh(geo('wiz-brow', () => new THREE.SphereGeometry(0.04, 6, 4)), beard);
        brow.scale.set(1.2, 0.35, 0.5);
        brow.position.set(sx * 0.05, 0.04, 0.12);
        head.add(brow);
    }

    const hat = new THREE.Mesh(
        lathe([[0.02, 0.72], [0.08, 0.5], [0.16, 0.18], [0.22, 0.02], [0.4, 0], [0.4, -0.03], [0.02, -0.03]], 14, 'wiz-hat'),
        robe
    );
    hat.position.y = 1.84;
    hat.rotation.z = 0.1;
    group.add(hat);

    const beardG = new THREE.Mesh(
        lathe([[0.02, 0], [0.14, 0.02], [0.12, 0.22], [0.07, 0.48], [0.02, 0.62]], 10, 'wiz-beard'),
        beard
    );
    beardG.position.set(0, 1.68, 0.08);
    beardG.rotation.x = Math.PI;
    group.add(beardG);

    const staff = new THREE.Group();
    staff.position.set(0.4, 0, 0.08);
    group.add(staff);
    const shaft = new THREE.Mesh(
        geo('wiz-shaft', () => warp(new THREE.CylinderGeometry(0.028, 0.042, 2.18, 8), 13, 0.18, 0.5)),
        mapped(barkTexture(), 0x6a4a30, 0.86)
    );
    shaft.position.y = 1.08;
    staff.add(shaft);
    const crystal = new THREE.Mesh(
        geo('wiz-crystal', () => new THREE.OctahedronGeometry(0.1, 1)),
        mat('wiz-crystal', () => new THREE.MeshPhysicalMaterial({
            color: 0xa8d8ff,
            emissive: 0x4aa0ff,
            emissiveIntensity: 1.6,
            roughness: 0.12,
            metalness: 0.15,
            transmission: 0.35,
            thickness: 0.4,
            transparent: true,
            opacity: 0.92
        }))
    );
    crystal.position.y = 2.2;
    staff.add(crystal);

    enableShadows(group);
    group.userData.parts = { staff, crystal };
    return { group, parts: group.userData.parts };
}

export function buildElf({ robe = 0xc8d8c0 } = {}) {
    const group = new THREE.Group();
    const skin = mapped(skinTexture(), 0xf4dcc8, 0.55, 0.02, 0.35);
    const cloth = mapped(clothTexture('#c8d8c0'), robe, 0.78, 0, 0.5);
    const hair = std(0xe8d080, 0.48, 0.08);

    const body = new THREE.Mesh(
        lathe([[0.06, 0], [0.22, 0.04], [0.2, 0.55], [0.16, 1.05], [0.14, 1.38]], 14, `elf-body:${robe}`),
        cloth
    );
    group.add(body);

    const head = new THREE.Group();
    head.position.y = 1.5;
    group.add(head);
    const skull = new THREE.Mesh(geo('elf-skull', () => new THREE.SphereGeometry(0.125, 12, 10)), skin);
    skull.scale.set(0.92, 1.08, 0.95);
    head.add(skull);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(geo('elf-ear', () => new THREE.ConeGeometry(0.028, 0.16, 6)), skin);
        ear.position.set(sx * 0.12, 0.04, -0.02);
        ear.rotation.z = sx * -0.95;
        ear.rotation.x = -0.25;
        head.add(ear);
        const eye = new THREE.Mesh(geo('elf-eye', () => new THREE.SphereGeometry(0.018, 6, 5)), std(0x88a0c8, 0.25, 0.2));
        eye.position.set(sx * 0.04, 0.01, 0.11);
        head.add(eye);
    }
    const hairM = new THREE.Mesh(geo('elf-hair', () => warp(new THREE.SphereGeometry(0.14, 10, 8), 15, 0.08)), hair);
    hairM.position.y = 0.06;
    hairM.scale.set(1.05, 0.85, 1.2);
    head.add(hairM);
    const fall = new THREE.Mesh(geo('elf-fall', () => new THREE.CylinderGeometry(0.04, 0.03, 0.55, 6)), hair);
    fall.position.set(0.08, -0.18, -0.06);
    head.add(fall);

    const circlet = new THREE.Mesh(
        geo('elf-circlet', () => new THREE.TorusGeometry(0.12, 0.012, 6, 18)),
        mapped(goldTexture(), 0xe8d8a0, 0.3, 0.85, 0.3)
    );
    circlet.rotation.x = Math.PI / 2;
    circlet.position.y = 0.08;
    head.add(circlet);

    enableShadows(group);
    return { group };
}

export function buildCompanion() {
    return buildHobbit({ vest: 0x3a6a38, pants: 0x4a3a22 });
}

export function buildGoblin() {
    const group = new THREE.Group();
    const skin = mapped(skinTexture(), 0x6a8a42, 0.82, 0.02, 0.7);
    const dark = mapped(clothTexture('#2a2218'), 0x2a2218, 0.92);

    const body = new THREE.Mesh(
        geo('gob-body', () => warp(new THREE.SphereGeometry(0.26, 10, 8), 17, 0.14, 0.4)),
        dark
    );
    body.position.y = 0.52;
    body.scale.set(1.05, 1.25, 0.82);
    group.add(body);

    const head = new THREE.Group();
    head.position.y = 0.92;
    group.add(head);
    const skull = new THREE.Mesh(geo('gob-skull', () => warp(new THREE.SphereGeometry(0.19, 10, 8), 18, 0.12)), skin);
    skull.scale.set(1.05, 0.9, 1.1);
    head.add(skull);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(geo('gob-ear', () => warp(new THREE.ConeGeometry(0.055, 0.2, 6), 19, 0.2)), skin);
        ear.position.set(sx * 0.17, 0.12, -0.02);
        ear.rotation.z = sx * -0.75;
        head.add(ear);
        const eye = new THREE.Mesh(
            geo('gob-eye', () => new THREE.SphereGeometry(0.038, 8, 6)),
            mat('gob-eye', () => new THREE.MeshStandardMaterial({
                color: 0xffee88, emissive: 0xffcc33, emissiveIntensity: 2.2, roughness: 0.3
            }))
        );
        eye.position.set(sx * 0.06, 0.04, 0.16);
        head.add(eye);
        const arm = new THREE.Mesh(geo('gob-arm', () => new THREE.CapsuleGeometry(0.045, 0.32, 4, 8)), skin);
        arm.position.set(sx * 0.28, 0.55, 0.04);
        arm.rotation.z = sx * 0.45;
        arm.rotation.x = -0.35;
        group.add(arm);
    }
    const jaw = new THREE.Mesh(geo('gob-jaw', () => new THREE.SphereGeometry(0.1, 8, 6)), skin);
    jaw.scale.set(1, 0.45, 0.9);
    jaw.position.set(0, -0.08, 0.08);
    head.add(jaw);

    const blade = new THREE.Mesh(
        geo('gob-blade', () => {
            const g = new THREE.ConeGeometry(0.035, 0.48, 6);
            warp(g, 20, 0.12);
            return g;
        }),
        std(0xb0b8c0, 0.28, 0.88)
    );
    blade.position.set(0.38, 0.42, 0.12);
    blade.rotation.x = 0.55;
    group.add(blade);

    enableShadows(group);
    group.userData.hp = 2;
    return { group };
}

export function buildNazgul() {
    const group = new THREE.Group();
    const black = mapped(clothTexture('#0a0a0c'), 0x0c0c10, 0.94, 0.06, 0.4);
    black.emissive = new THREE.Color(0x050508);
    black.emissiveIntensity = 0.15;
    const hide = mapped(leatherTexture(), 0x121014, 0.9, 0.08, 0.7);

    const horse = new THREE.Group();
    group.add(horse);

    const body = new THREE.Mesh(
        geo('naz-body', () => warp(new THREE.SphereGeometry(0.52, 14, 10), 21, 0.1, 0.5)),
        hide
    );
    body.scale.set(0.72, 0.82, 1.7);
    body.position.set(0, 0.88, 0);
    horse.add(body);

    const chest = new THREE.Mesh(geo('naz-chest', () => warp(new THREE.SphereGeometry(0.32, 10, 8), 22, 0.1)), hide);
    chest.scale.set(0.85, 0.95, 1.1);
    chest.position.set(0, 0.92, 0.55);
    horse.add(chest);

    const neck = new THREE.Mesh(geo('naz-neck', () => new THREE.CapsuleGeometry(0.13, 0.55, 5, 8)), hide);
    neck.position.set(0, 1.22, 0.72);
    neck.rotation.x = 0.7;
    horse.add(neck);

    const head = new THREE.Mesh(geo('naz-head', () => warp(new THREE.SphereGeometry(0.16, 10, 8), 23, 0.12)), hide);
    head.scale.set(0.7, 0.72, 1.55);
    head.position.set(0, 1.52, 1.08);
    horse.add(head);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(geo('naz-ear', () => new THREE.ConeGeometry(0.04, 0.14, 5)), hide);
        ear.position.set(sx * 0.07, 1.68, 1.0);
        ear.rotation.x = -0.4;
        horse.add(ear);
    }
    const snout = new THREE.Mesh(geo('naz-snout', () => new THREE.CylinderGeometry(0.05, 0.09, 0.22, 8)), hide);
    snout.rotation.x = Math.PI / 2;
    snout.position.set(0, 1.46, 1.28);
    horse.add(snout);

    const tail = new THREE.Mesh(geo('naz-tail', () => new THREE.ConeGeometry(0.07, 0.7, 6)), black);
    tail.position.set(0, 0.85, -0.95);
    tail.rotation.x = 2.4;
    horse.add(tail);

    const horseLegs = [];
    const gaitSign = [1, -1, -1, 1];
    let li = 0;
    for (const sx of [-1, 1]) {
        for (const z of [0.42, -0.42]) {
            const leg = new THREE.Group();
            leg.position.set(sx * 0.22, 0.72, z);
            horse.add(leg);
            const upper = new THREE.Mesh(geo('naz-legu', () => new THREE.CapsuleGeometry(0.055, 0.32, 4, 6)), hide);
            upper.position.y = -0.18;
            leg.add(upper);
            const lower = new THREE.Group();
            lower.position.y = -0.36;
            leg.add(lower);
            const lowM = new THREE.Mesh(geo('naz-legl', () => new THREE.CapsuleGeometry(0.042, 0.28, 3, 6)), hide);
            lowM.position.y = -0.14;
            lower.add(lowM);
            const hoof = new THREE.Mesh(geo('naz-hoof', () => new THREE.SphereGeometry(0.055, 6, 5)), std(0x080808, 0.5, 0.15));
            hoof.scale.set(1.1, 0.55, 1.2);
            hoof.position.y = -0.32;
            lower.add(hoof);
            leg.userData.lower = lower;
            leg.userData.sign = gaitSign[li++];
            horseLegs.push(leg);
        }
    }

    const rider = new THREE.Group();
    rider.position.set(0, 1.12, -0.08);
    group.add(rider);

    const cloak = new THREE.Mesh(
        lathe([[0.08, 0], [0.48, 0.04], [0.4, 0.55], [0.22, 1.05], [0.14, 1.18]], 16, 'naz-cloak'),
        clothMat({ color: 0x0a0a0c, maps: clothTexture('#0a0a0c'), wind: 0.28, key: 'naz-cloak' })
    );
    rider.add(cloak);

    const hood = new THREE.Mesh(
        lathe([[0.02, 0.22], [0.18, 0.18], [0.2, 0.04], [0.12, 0]], 12, 'naz-hood'),
        black
    );
    hood.position.y = 1.12;
    rider.add(hood);

    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(
            geo('naz-eye', () => new THREE.SphereGeometry(0.032, 8, 6)),
            mat('naz-eye', () => new THREE.MeshStandardMaterial({
                color: 0xffe8a0, emissive: 0xffcc66, emissiveIntensity: 3.6, roughness: 0.25
            }))
        );
        eye.position.set(sx * 0.055, 1.16, 0.12);
        rider.add(eye);
    }

    const blade = new THREE.Mesh(geo('naz-blade', () => new THREE.BoxGeometry(0.04, 0.85, 0.08)), std(0xc8d0d8, 0.22, 0.92));
    blade.position.set(0.32, 0.7, 0.15);
    blade.rotation.z = -0.35;
    rider.add(blade);

    enableShadows(group);
    group.userData.parts = { horse, rider, horseLegs };
    return { group, parts: group.userData.parts };
}

/* ------------------------------------------------------------------ */
/* Cenário                                                             */
/* ------------------------------------------------------------------ */

export function buildHobbitHole({ doorColor = '#2d6b38', scale = 1 } = {}) {
    const group = new THREE.Group();
    const grass = mapped(grassTexture(), 0x7aab48, 0.94, 0.02, 1.1);
    const wood = mapped(woodTexture(), 0xc4a06a, 0.78);
    const doorMaps = doorTexture(doorColor);

    const hill = new THREE.Mesh(
        geo(`hill:${scale.toFixed(2)}`, () => warp(new THREE.SphereGeometry(2.4, 22, 16), 30 + scale * 10, 0.16, 0.35)),
        grass
    );
    hill.scale.set(1.4, 0.78, 1.18);
    hill.position.y = 0.45;
    group.add(hill);

    const facade = new THREE.Mesh(
        geo('hole-facade', () => new THREE.CylinderGeometry(1.08, 1.08, 0.22, 28)),
        wood
    );
    facade.rotation.x = Math.PI / 2;
    facade.position.set(0, 0.88, 1.52);
    group.add(facade);

    const frame = new THREE.Mesh(
        geo('hole-frame', () => new THREE.TorusGeometry(0.78, 0.07, 8, 28)),
        mapped(woodTexture(), 0x8a6238, 0.8)
    );
    frame.position.set(0, 0.88, 1.64);
    group.add(frame);

    const door = new THREE.Mesh(
        geo('hole-door', () => new THREE.CylinderGeometry(0.72, 0.72, 0.08, 28)),
        mat(`door-mat:${doorColor}`, () => {
            const m = new THREE.MeshStandardMaterial({ roughness: 0.68, metalness: 0.04 });
            applyMaps(m, doorMaps, { roughness: 0.68, metalness: 0.04, normalScale: 1.1 });
            return m;
        })
    );
    door.rotation.x = Math.PI / 2;
    door.position.set(0, 0.88, 1.66);
    group.add(door);

    const window = new THREE.Mesh(
        geo('hole-win', () => new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16)),
        mat('hole-win', () => new THREE.MeshStandardMaterial({
            color: 0xffe8a8, emissive: 0xffcc66, emissiveIntensity: 0.85, roughness: 0.22, metalness: 0.1
        }))
    );
    window.rotation.x = Math.PI / 2;
    window.position.set(1.18, 1.18, 0.88);
    group.add(window);
    const winFrame = new THREE.Mesh(geo('hole-winf', () => new THREE.TorusGeometry(0.22, 0.03, 6, 16)), wood);
    winFrame.position.copy(window.position);
    group.add(winFrame);

    const chimney = new THREE.Mesh(
        geo('hole-chim', () => new THREE.CylinderGeometry(0.12, 0.15, 0.78, 10)),
        mapped(brickTexture(), 0xffffff, 0.9)
    );
    chimney.position.set(-0.62, 2.05, -0.18);
    group.add(chimney);
    const pot = new THREE.Mesh(geo('hole-pot', () => new THREE.TorusGeometry(0.14, 0.03, 6, 10)), mapped(brickTexture()));
    pot.position.set(-0.62, 2.44, -0.18);
    pot.rotation.x = Math.PI / 2;
    group.add(pot);

    const smoke = new THREE.Mesh(
        geo('hole-smoke', () => new THREE.SphereGeometry(0.22, 8, 6)),
        mat('smoke', () => new THREE.MeshStandardMaterial({
            color: 0xccc8c0, transparent: true, opacity: 0.32, depthWrite: false, roughness: 1
        }))
    );
    smoke.position.set(-0.62, 2.58, -0.18);
    group.add(smoke);

    for (let i = 0; i < 5; i++) {
        const flower = new THREE.Mesh(
            geo('hole-flw', () => new THREE.SphereGeometry(0.05, 6, 5)),
            std([0xe07080, 0xf0d060, 0xd060a0, 0xf2e8c8, 0x88c060][i], 0.55)
        );
        flower.position.set(-1.1 + i * 0.22, 0.72, 1.55);
        group.add(flower);
    }

    group.scale.setScalar(scale);
    enableShadows(group);
    group.userData.parts = { door, smoke };
    return { group, parts: group.userData.parts };
}

function oakCanopyGeo(autumn) {
    return geo(`oak-canopy:${autumn}`, () => {
        const blobs = [];
        const specs = [
            [0, 1.55, 0, 1.45, 1.05, 1.35],
            [0.7, 1.15, 0.35, 1.05, 0.9, 1.0],
            [-0.55, 1.25, -0.25, 0.95, 0.85, 0.95],
            [0.15, 1.85, -0.5, 0.85, 0.75, 0.9]
        ];
        for (let i = 0; i < specs.length; i++) {
            const [x, y, z, sx, sy, sz] = specs[i];
            const g = warp(new THREE.IcosahedronGeometry(1, 1), 40 + i, 0.18, 0.45);
            g.scale(sx, sy, sz);
            g.translate(x, y, z);
            blobs.push(g);
        }
        const merged = mergeGeometries(blobs, false);
        blobs.forEach((g) => g.dispose());
        if (!merged) return new THREE.IcosahedronGeometry(1.4, 1);
        merged.computeVertexNormals();
        return merged;
    });
}

function oakTrunkGeo() {
    return geo('oak-trunk', () => {
        const trunk = warp(new THREE.CylinderGeometry(0.22, 0.42, 2.5, 10), 41, 0.14, 0.5);
        trunk.translate(0, 1.25, 0);
        const roots = [];
        for (let i = 0; i < 4; i++) {
            const a = (i / 4) * Math.PI * 2;
            const r = new THREE.CylinderGeometry(0.06, 0.14, 0.7, 6);
            r.rotateZ(0.9);
            r.translate(Math.cos(a) * 0.45, 0.18, Math.sin(a) * 0.45);
            roots.push(r);
        }
        const merged = mergeGeometries([trunk, ...roots], false);
        [trunk, ...roots].forEach((g) => g.dispose());
        if (!merged) return new THREE.CylinderGeometry(0.22, 0.42, 2.5, 10);
        merged.computeVertexNormals();
        return merged;
    });
}

export function getOakAssets(autumn = false) {
    const leaf = mapped(leafTexture(autumn ? '#c45a22' : '#2f6a24'), autumn ? 0xd47830 : 0x4a8a32, 0.8, 0.02, 0.7);
    vegWind(leaf, 0.09);
    return {
        trunkGeo: oakTrunkGeo(),
        canopyGeo: oakCanopyGeo(autumn),
        trunkMat: mapped(barkTexture(), 0x8a6a48, 0.9, 0.02, 1.2),
        canopyMat: leaf
    };
}

export function buildOak({ autumn = false } = {}) {
    const group = new THREE.Group();
    const a = getOakAssets(autumn);
    const trunk = new THREE.Mesh(a.trunkGeo, a.trunkMat);
    group.add(trunk);
    const canopy = new THREE.Mesh(a.canopyGeo, a.canopyMat);
    canopy.position.y = 1.35;
    group.add(canopy);
    enableShadows(group);
    return group;
}

function pineGeo() {
    return geo('pine-full', () => {
        const parts = [];
        const trunk = warp(new THREE.CylinderGeometry(0.14, 0.22, 2.15, 8), 50, 0.12);
        trunk.translate(0, 1.07, 0);
        parts.push(trunk);
        for (let i = 0; i < 5; i++) {
            const cone = warp(new THREE.ConeGeometry(1.2 - i * 0.18, 1.2, 10), 51 + i, 0.12, 0.4);
            cone.translate(0, 1.55 + i * 0.62, 0);
            parts.push(cone);
        }
        const merged = mergeGeometries(parts, false);
        parts.forEach((g) => g.dispose());
        if (!merged) return new THREE.ConeGeometry(1.0, 4.2, 8);
        merged.computeVertexNormals();
        return merged;
    });
}

export function getPineAssets() {
    return {
        geo: pineGeo(),
        mat: mapped(leafTexture('#1e4a28'), 0x2a5a30, 0.84, 0.02, 0.8)
    };
}

export function buildPine() {
    const group = new THREE.Group();
    const a = getPineAssets();
    const mesh = new THREE.Mesh(a.geo, a.mat);
    group.add(mesh);
    enableShadows(group);
    return group;
}

export function buildPartyTree() {
    const group = new THREE.Group();
    const trunk = new THREE.Mesh(
        geo('party-trunk', () => warp(new THREE.CylinderGeometry(0.5, 0.82, 4.3, 14), 60, 0.12)),
        mapped(barkTexture(), 0x8a6a48, 0.9, 0.02, 1.15)
    );
    trunk.position.y = 2.15;
    group.add(trunk);

    const leaf = mapped(leafTexture('#2f6a24'), 0x4a8a32, 0.8);
    vegWind(leaf, 0.07);
    for (let i = 0; i < 6; i++) {
        const blob = new THREE.Mesh(
            geo(`party-blob:${i}`, () => warp(new THREE.IcosahedronGeometry(1.75, 1), 61 + i, 0.16)),
            leaf
        );
        const a = (i / 6) * Math.PI * 2;
        blob.position.set(Math.cos(a) * 1.35, 4.35 + (i % 2) * 0.55, Math.sin(a) * 1.35);
        blob.scale.setScalar(0.88 + (i % 3) * 0.1);
        group.add(blob);
    }

    const lanterns = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const lantern = new THREE.Mesh(
            geo('party-lan', () => new THREE.SphereGeometry(0.11, 10, 8)),
            mat('party-lan', () => new THREE.MeshStandardMaterial({
                color: 0xffe8a0, emissive: 0xffaa44, emissiveIntensity: 2, roughness: 0.28
            }))
        );
        lantern.position.set(Math.cos(a) * 2.15, 3.15, Math.sin(a) * 2.15);
        group.add(lantern);
        lanterns.push(lantern);
    }
    enableShadows(group);
    group.userData.lanterns = lanterns;
    return group;
}

export function buildRing(scale = 1) {
    const group = new THREE.Group();
    const gold = goldTexture();
    const torus = new THREE.Mesh(
        geo('ring-torus', () => new THREE.TorusGeometry(0.28, 0.065, 16, 48)),
        mat('ring-gold', () => {
            const m = new THREE.MeshStandardMaterial({
                color: 0xffe08a, metalness: 1, roughness: 0.14,
                emissive: 0xffaa22, emissiveIntensity: 0.55
            });
            applyMaps(m, gold, { color: 0xffe08a, roughness: 0.14, metalness: 1, normalScale: 0.35 });
            m.emissive.set(0xffaa22);
            m.emissiveIntensity = 0.55;
            return m;
        })
    );
    torus.rotation.x = Math.PI / 2;
    group.add(torus);
    const glow = new THREE.Mesh(
        geo('ring-glow-t', () => new THREE.TorusGeometry(0.32, 0.12, 10, 28)),
        mat('ring-glow-m', () => new THREE.MeshBasicMaterial({
            color: 0xffcc55, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide
        }))
    );
    glow.rotation.x = Math.PI / 2;
    group.add(glow);
    group.scale.setScalar(scale);
    group.userData.glow = glow;
    return group;
}

export function buildRock(seed = 1) {
    const geoR = warp(new THREE.IcosahedronGeometry(1, 2), seed * 17, 0.38, 0.55);
    const mesh = new THREE.Mesh(geoR, mapped(stoneTexture(), 0x8a8680, 0.9, 0.04, 1.15));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
}

export function getPillarAssets(height = 14) {
    const stone = mapped(stoneTexture('#6a5a48'), 0x7a6a58, 0.9, 0.03, 1.1);
    const g = geo(`pillar:${height}`, () => {
        const col = new THREE.CylinderGeometry(0.62, 0.78, height, 12);
        col.translate(0, height / 2, 0);
        const base = new THREE.BoxGeometry(2.05, 0.48, 2.05);
        base.translate(0, 0.24, 0);
        const cap = new THREE.BoxGeometry(1.85, 0.38, 1.85);
        cap.translate(0, height, 0);
        const ring = new THREE.TorusGeometry(0.72, 0.08, 6, 16);
        ring.rotateX(Math.PI / 2);
        ring.translate(0, height - 0.35, 0);
        [col, base, cap, ring].forEach((g) => g.clearGroups());
        const merged = mergeGeometries([col, base, cap, ring], false);
        [col, base, cap, ring].forEach((g) => g.dispose());
        if (!merged) return new THREE.CylinderGeometry(0.62, 0.78, height, 12);
        return merged;
    });
    return { geo: g, mat: stone };
}

export function buildPillar(height = 14) {
    const a = getPillarAssets(height);
    const mesh = new THREE.Mesh(a.geo, a.mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const group = new THREE.Group();
    group.add(mesh);
    return group;
}

export function buildPavilion() {
    const group = new THREE.Group();
    const marble = mapped(marbleTexture(), 0xf2eee4, 0.38, 0.08, 0.55);
    const gold = mapped(goldTexture(), 0xffe8a8, 0.28, 0.85, 0.4);

    const floor = new THREE.Mesh(geo('pav-floor', () => new THREE.CylinderGeometry(6.5, 6.5, 0.22, 24)), marble);
    floor.position.y = 0.11;
    group.add(floor);
    const inlay = new THREE.Mesh(geo('pav-inlay', () => new THREE.TorusGeometry(4.2, 0.08, 6, 32)), gold);
    inlay.rotation.x = Math.PI / 2;
    inlay.position.y = 0.23;
    group.add(inlay);

    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const col = new THREE.Mesh(
            lathe([[0.16, 0], [0.22, 0.08], [0.16, 0.2], [0.15, 3.7], [0.22, 3.9], [0.05, 4.15]], 12, 'pav-col'),
            marble
        );
        col.position.set(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2);
        group.add(col);
        const cap = new THREE.Mesh(geo('pav-cap', () => new THREE.SphereGeometry(0.22, 10, 8)), gold);
        cap.position.set(Math.cos(a) * 5.2, 4.28, Math.sin(a) * 5.2);
        group.add(cap);
    }

    const roof = new THREE.Mesh(
        lathe([[0.05, 2.35], [1.4, 1.7], [4.2, 0.55], [6.9, 0.08], [6.9, 0]], 16, 'pav-roof'),
        gold
    );
    roof.position.y = 4.15;
    group.add(roof);

    const arch = new THREE.Mesh(geo('pav-arch', () => new THREE.TorusGeometry(1.55, 0.1, 8, 20, Math.PI)), marble);
    arch.position.set(0, 2.15, 6.25);
    arch.rotation.x = Math.PI;
    group.add(arch);

    enableShadows(group);
    return group;
}

export function buildCouncilRing() {
    const group = new THREE.Group();
    const stone = mapped(marbleTexture(), 0xe8e0d0, 0.55, 0.06, 0.5);
    const ring = new THREE.Mesh(geo('council-ring', () => new THREE.TorusGeometry(4.2, 0.2, 10, 40)), stone);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.18;
    group.add(ring);
    for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const seat = new THREE.Mesh(
            lathe([[0.08, 0], [0.38, 0.02], [0.36, 0.28], [0.22, 0.32]], 10, 'council-seat'),
            stone
        );
        seat.position.set(Math.cos(a) * 3.4, 0.02, Math.sin(a) * 3.4);
        group.add(seat);
        const back = new THREE.Mesh(geo('council-back', () => new THREE.BoxGeometry(0.55, 0.7, 0.12)), stone);
        back.position.set(Math.cos(a) * 3.72, 0.5, Math.sin(a) * 3.72);
        back.lookAt(0, 0.5, 0);
        group.add(back);
    }
    enableShadows(group);
    return group;
}

export function buildBridge() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#5a5048'), 0x6a6058, 0.88, 0.04, 1.05);
    for (let i = 0; i < 10; i++) {
        const slab = new THREE.Mesh(geo('br-slab', () => new THREE.BoxGeometry(2.35, 0.26, 1.55)), stone);
        slab.position.set((i % 2) * 0.06, 0.13, -7.2 + i * 1.6);
        group.add(slab);
    }
    for (const z of [-7.2, 7.2]) {
        for (const x of [-1.12, 1.12]) {
            const post = new THREE.Mesh(geo('br-post', () => new THREE.BoxGeometry(0.16, 1.15, 0.16)), stone);
            post.position.set(x, 0.7, z);
            group.add(post);
        }
        const rail = new THREE.Mesh(geo('br-rail', () => new THREE.BoxGeometry(2.4, 0.08, 0.1)), stone);
        rail.position.set(0, 1.15, z);
        group.add(rail);
    }
    enableShadows(group);
    return group;
}

export function buildSeat() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#9a8a78'), 0xb0a090, 0.86, 0.04, 1.0);
    const base = new THREE.Mesh(
        lathe([[0.2, 0], [1.75, 0.02], [1.55, 0.42], [1.4, 0.5]], 16, 'seat-base'),
        stone
    );
    group.add(base);
    const back = new THREE.Mesh(
        geo('seat-back', () => warp(new THREE.BoxGeometry(1.45, 2.25, 0.32), 70, 0.08, 0.5)),
        stone
    );
    back.position.set(0, 1.45, -0.52);
    group.add(back);
    const sit = new THREE.Mesh(geo('seat-sit', () => new THREE.BoxGeometry(1.35, 0.22, 1.05)), stone);
    sit.position.set(0, 0.62, 0.12);
    group.add(sit);
    const arms = mapped(stoneTexture('#9a8a78'), 0xb0a090);
    for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(geo('seat-arm', () => new THREE.BoxGeometry(0.18, 0.55, 0.9)), arms);
        arm.position.set(sx * 0.72, 0.85, 0.05);
        group.add(arm);
    }
    enableShadows(group);
    return group;
}

export function buildRuinArch() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#8a7a68'), 0x9a8a78, 0.9, 0.04, 1.15);
    for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(
            geo('ruin-p', () => warp(new THREE.BoxGeometry(0.58, 3.45, 0.58), 71, 0.1)),
            stone
        );
        p.position.set(sx * 1.4, 1.72, 0);
        group.add(p);
    }
    const lintel = new THREE.Mesh(
        geo('ruin-lintel', () => warp(new THREE.BoxGeometry(3.45, 0.48, 0.62), 72, 0.08)),
        stone
    );
    lintel.position.y = 3.52;
    lintel.rotation.z = 0.04;
    group.add(lintel);
    const ivy = mapped(leafTexture('#2f6a24'), 0x3a6a32, 0.85);
    for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(geo('ruin-ivy', () => new THREE.SphereGeometry(0.12, 6, 5)), ivy);
        leaf.position.set((i % 2 ? 1.4 : -1.4) + (hash2(i, 1) - 0.5) * 0.2, 0.4 + i * 0.45, 0.28);
        leaf.scale.set(1.2, 0.5, 0.8);
        group.add(leaf);
    }
    enableShadows(group);
    return group;
}

export function buildSword() {
    const group = new THREE.Group();
    const blade = new THREE.Mesh(
        geo('sw-blade', () => {
            const g = new THREE.BoxGeometry(0.045, 0.72, 0.11);
            const pos = g.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                if (pos.getY(i) > 0.25) pos.setX(i, pos.getX(i) * 0.45);
            }
            g.computeVertexNormals();
            return g;
        }),
        std(0xd8dee8, 0.22, 0.92)
    );
    blade.position.y = 0.4;
    group.add(blade);
    const guard = new THREE.Mesh(geo('sw-guard', () => new THREE.BoxGeometry(0.3, 0.045, 0.07)), mapped(goldTexture(), 0xc9a227, 0.32, 0.82, 0.3));
    group.add(guard);
    const hilt = new THREE.Mesh(geo('sw-hilt', () => new THREE.CylinderGeometry(0.028, 0.034, 0.22, 10)), mapped(leatherTexture(), 0x4a3020, 0.8));
    hilt.position.y = -0.12;
    group.add(hilt);
    const pommel = new THREE.Mesh(geo('sw-pommel', () => new THREE.SphereGeometry(0.04, 8, 6)), mapped(goldTexture(), 0xc9a227, 0.3, 0.85));
    pommel.position.y = -0.24;
    group.add(pommel);
    return group;
}

export function buildBalrog() {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
        lathe([[0.2, 0], [2.2, 0.2], [1.8, 2.4], [1.1, 5.2], [0.7, 7.2], [0.2, 8]], 10, 'balrog-body'),
        mat('balrog', () => new THREE.MeshStandardMaterial({
            color: 0x1a0804, emissive: 0xff3300, emissiveIntensity: 0.55, roughness: 0.72, metalness: 0.08
        }))
    );
    group.add(body);
    for (const sx of [-1, 1]) {
        const horn = new THREE.Mesh(
            geo('bal-horn', () => warp(new THREE.ConeGeometry(0.32, 2.4, 7), 80, 0.15)),
            std(0x2a1008, 0.78)
        );
        horn.position.set(sx * 1.05, 8.1, 0.1);
        horn.rotation.z = sx * 0.55;
        horn.rotation.x = -0.25;
        group.add(horn);
        const wing = new THREE.Mesh(
            geo('bal-wing', () => new THREE.PlaneGeometry(3.2, 4.4, 4, 4)),
            mat('bal-wing', () => new THREE.MeshStandardMaterial({
                color: 0x120804, emissive: 0x881100, emissiveIntensity: 0.35,
                side: THREE.DoubleSide, transparent: true, opacity: 0.72, roughness: 0.9
            }))
        );
        wing.position.set(sx * 2.1, 5.2, -0.4);
        wing.rotation.y = sx * 0.7;
        group.add(wing);
    }
    const eye = new THREE.Mesh(
        geo('bal-eye', () => new THREE.SphereGeometry(0.32, 10, 8)),
        mat('bal-eye', () => new THREE.MeshStandardMaterial({
            color: 0xffee88, emissive: 0xffaa00, emissiveIntensity: 4.2, roughness: 0.2
        }))
    );
    eye.position.set(0, 6.15, 1.35);
    group.add(eye);
    const whip = new THREE.Mesh(
        geo('bal-whip', () => new THREE.CylinderGeometry(0.04, 0.09, 6.5, 6)),
        mat('bal-whip', () => new THREE.MeshStandardMaterial({
            color: 0xff6611, emissive: 0xff3300, emissiveIntensity: 2.2, roughness: 0.4
        }))
    );
    whip.position.set(2.2, 3.2, 0.8);
    whip.rotation.z = -0.9;
    whip.rotation.x = 0.4;
    group.add(whip);
    group.userData.eye = eye;
    group.userData.whip = whip;
    enableShadows(group);
    return group;
}

export function grassBladeGeometry() {
    return geo('grass-cross', () => {
        const a = new THREE.PlaneGeometry(0.38, 0.72);
        a.translate(0, 0.36, 0);
        const b = a.clone();
        b.rotateY(Math.PI / 2);
        const merged = mergeGeometries([a, b], false);
        a.dispose();
        b.dispose();
        return merged;
    });
}

export function grassBladeMaterial() {
    return mat('grass-blade', () => {
        const m = new THREE.MeshStandardMaterial({
            map: grassBladeTexture(),
            color: 0xb8d878,
            side: THREE.DoubleSide,
            transparent: true,
            alphaTest: 0.28,
            roughness: 0.92,
            metalness: 0
        });
        vegWind(m, 0.16);
        return m;
    });
}

export function applyGrassWind(material, strength = 1) {
    vegWind(material, 0.12 * strength);
}

export function waterMaterial(color = 0x3a8aaa) {
    const maps = waterTexture();
    return mat(`water:${color}`, () => {
        const m = new THREE.MeshStandardMaterial({
            color,
            transparent: true,
            opacity: 0.78,
            roughness: 0.12,
            metalness: 0.45,
            side: THREE.DoubleSide
        });
        applyMaps(m, maps, { color, roughness: 0.12, metalness: 0.45, normalScale: 1.4 });
        m.userData.uTime = { value: 0 };
        m.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = m.userData.uTime;
            shader.vertexShader = shader.vertexShader
                .replace(
                    '#include <common>',
                    /* glsl */ `#include <common>
                    uniform float uTime;`
                )
                .replace(
                    '#include <begin_vertex>',
                    /* glsl */ `#include <begin_vertex>
                    transformed.y += sin(uTime * 1.4 + position.x * 0.18 + position.z * 0.14) * 0.08
                                   + sin(uTime * 0.9 + position.z * 0.22) * 0.05;`
                );
        };
        m.customProgramCacheKey = () => 'anel-water';
        animatedMats.push(m);
        return m;
    });
}
