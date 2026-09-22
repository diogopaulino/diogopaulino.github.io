/**
 * Modelos 3D construídos por código — nenhum GLB externo.
 * Silhuetas em lathe, deslocamento de vértices e PBR com normal map.
 * Geometria primitiva crua (cone/esfera isolados) só entra como volume interno.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { limbGeometry, headGeometry, torsoGeometry, canineTorsoGeometry, canineHeadGeometry, tailGeometry, earBladeGeometry } from '../../shared/realism.js';
import {
    grassTexture, barkTexture, leafTexture, stoneTexture, marbleTexture,
    woodTexture, goldTexture, doorTexture, brickTexture, skinTexture,
    clothTexture, leatherTexture, grassBladeTexture, faceTexture, waterTexture, applyMaps
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

/**
 * Fivela do hobbit: armação arredondada com um vão no meio.
 */
function hobBuckleGeometry() {
    const s = new THREE.Shape();
    const ring = [
        [-0.032, -0.034],
        [0.032, -0.034],
        [0.040, -0.028],
        [0.044, -0.020],
        [0.044, 0.020],
        [0.040, 0.028],
        [0.032, 0.034],
        [-0.032, 0.034],
        [-0.040, 0.028],
        [-0.044, 0.020],
        [-0.044, -0.020],
        [-0.040, -0.028]
    ];
    s.moveTo(ring[0][0], ring[0][1]);
    for (let i = 1; i < ring.length; i++) s.lineTo(ring[i][0], ring[i][1]);
    s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-0.022, -0.014);
    hole.lineTo(-0.022, 0.014);
    hole.lineTo(0.022, 0.014);
    hole.lineTo(0.022, -0.014);
    hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.0015,
        bevelSize: 0.0015,
        bevelSegments: 1,
        curveSegments: 2
    });
    g.translate(0, 0, -0.01);
    return g;
}

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
        const thigh = new THREE.Mesh(limbGeometry({
            length: 0.28, r0: 0.08, r1: 0.06, bulge: 0.018, bulgeAt: 0.32, seg: 12
        }), clothP);
        leg.add(thigh);
        const shin = new THREE.Group();
        shin.position.y = -0.28;
        leg.add(shin);
        const shinM = new THREE.Mesh(limbGeometry({
            length: 0.2, r0: 0.065, r1: 0.045, bulge: 0.012, bulgeAt: 0.4, pinch: 0.2, seg: 10
        }), clothP);
        shin.add(shinM);
        const footG = new THREE.Group();
        footG.position.set(0, -0.22, 0.04);
        shin.add(footG);
        const footM = new THREE.Mesh(limbGeometry({
            length: 0.16, r0: 0.07, r1: 0.04, bulge: 0.02, pinch: 0, seg: 8, rings: 5
        }), foot);
        footM.rotation.x = -Math.PI / 2;
        footM.position.set(0, -0.02, 0.02);
        footG.add(footM);
        for (let i = 0; i < 4; i++) {
            const tuft = new THREE.Mesh(limbGeometry({
                length: 0.045, r0: 0.012, r1: 0.004, bulge: 0.004, pinch: 0, seg: 5, rings: 3
            }), hair);
            tuft.position.set((i - 1.5) * 0.02, 0.02, 0.1);
            tuft.rotation.x = -0.6;
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
        geo('hob-belly', () => torsoGeometry({ height: 0.5, girth: 0.26, style: 'child', seg: 16 })),
        clothV
    );
    belly.position.y = 0.02;
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
    const buckle = new THREE.Mesh(geo('hob-buckle', hobBuckleGeometry), mapped(goldTexture(), 0xffe08a, 0.28, 0.9, 0.4));
    buckle.name = 'hobBuckle';
    buckle.position.set(0, 0.12, 0.22);
    torso.add(buckle);

    const head = new THREE.Group();
    head.position.y = 0.6;
    torso.add(head);
    const skull = new THREE.Mesh(headGeometry(0.155, 'child'), skin);
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
        const ear = new THREE.Mesh(earBladeGeometry({ height: 0.09, width: 0.045, thickness: 0.02 }), skin);
        ear.position.set(sx * 0.14, -0.01, 0);
        ear.rotation.y = sx > 0 ? 0.4 : -0.4;
        head.add(ear);
    }

    const mop = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.04, -0.02),
        new THREE.Vector2(0.15, 0.02),
        new THREE.Vector2(0.16, 0.1),
        new THREE.Vector2(0.05, 0.17)
    ], 14), hair);
    mop.position.y = 0.02;
    head.add(mop);
    for (let i = 0; i < 7; i++) {
        const lock = new THREE.Mesh(limbGeometry({
            length: 0.1, r0: 0.028, r1: 0.01, bulge: 0.008, pinch: 0, seg: 6, rings: 4
        }), hair);
        const a = (i / 7) * Math.PI * 2;
        lock.position.set(Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.1);
        lock.rotation.z = Math.cos(a) * 0.7;
        head.add(lock);
    }

    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.26, 0.44, 0);
        torso.add(arm);
        const upper = new THREE.Mesh(limbGeometry({
            length: 0.2, r0: 0.055, r1: 0.04, bulge: 0.012, bulgeAt: 0.3, seg: 10
        }), skin);
        arm.add(upper);
        const forearm = new THREE.Group();
        forearm.position.y = -0.2;
        arm.add(forearm);
        const foreM = new THREE.Mesh(limbGeometry({
            length: 0.16, r0: 0.045, r1: 0.034, bulge: 0.008, bulgeAt: 0.4, pinch: 0.15, seg: 8
        }), skin);
        forearm.add(foreM);
        const hand = new THREE.Mesh(geo('hob-hand', () => limbGeometry({
            length: 0.07, r0: 0.028, r1: 0.02, bulge: 0.006, pinch: 0, seg: 8, rings: 4
        })), skin);
        hand.position.y = -0.16;
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
    const skull = new THREE.Mesh(geo('wiz-skull', () => headGeometry(0.15, 'human')), skin);
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
    const skull = new THREE.Mesh(geo('elf-skull', () => headGeometry(0.125, 'human')), skin);
    skull.scale.set(0.92, 1.08, 0.95);
    head.add(skull);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(earBladeGeometry({ height: 0.16, width: 0.04, thickness: 0.015 }), skin);
        ear.position.set(sx * 0.11, 0.0, -0.02);
        ear.rotation.z = sx * -0.7;
        ear.rotation.x = -0.2;
        head.add(ear);
        const eye = new THREE.Mesh(geo('elf-eye', () => new THREE.SphereGeometry(0.018, 6, 5)), std(0x88a0c8, 0.25, 0.2));
        eye.position.set(sx * 0.04, 0.01, 0.11);
        head.add(eye);
    }
    const hairM = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.02, 0),
        new THREE.Vector2(0.13, 0.02),
        new THREE.Vector2(0.135, 0.1),
        new THREE.Vector2(0.04, 0.16)
    ], 12), hair);
    hairM.position.y = 0.02;
    head.add(hairM);
    const fall = new THREE.Mesh(limbGeometry({
        length: 0.55, r0: 0.04, r1: 0.012, bulge: 0.008, pinch: 0, seg: 8, rings: 5
    }), hair);
    fall.position.set(0.06, 0.02, -0.05);
    fall.rotation.z = -0.12;
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
        geo('gob-body', () => torsoGeometry({ height: 0.46, girth: 0.2, style: 'child', seg: 14 })),
        dark
    );
    body.position.y = 0.28;
    group.add(body);

    const head = new THREE.Group();
    head.position.y = 0.92;
    group.add(head);
    const skull = new THREE.Mesh(geo('gob-skull', () => headGeometry(0.19, 'child')), skin);
    skull.scale.set(1.05, 0.9, 1.1);
    head.add(skull);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(earBladeGeometry({ height: 0.2, width: 0.07, thickness: 0.025 }), skin);
        ear.position.set(sx * 0.15, 0.04, -0.02);
        ear.rotation.z = sx * -0.55;
        head.add(ear);
        const eye = new THREE.Mesh(
            geo('gob-eye', () => new THREE.SphereGeometry(0.038, 8, 6)),
            mat('gob-eye', () => new THREE.MeshStandardMaterial({
                color: 0xffee88, emissive: 0xffcc33, emissiveIntensity: 2.2, roughness: 0.3
            }))
        );
        eye.position.set(sx * 0.06, 0.04, 0.16);
        head.add(eye);
        const arm = new THREE.Mesh(geo('gob-arm', () => limbGeometry({
            length: 0.34, r0: 0.05, r1: 0.03, bulge: 0.01, seg: 10, rings: 6
        })), skin);
        arm.position.set(sx * 0.24, 0.72, 0.04);
        arm.rotation.z = sx * 0.45;
        arm.rotation.x = -0.35;
        group.add(arm);
    }
    const jaw = new THREE.Mesh(limbGeometry({
        length: 0.14, r0: 0.08, r1: 0.035, bulge: 0.015, pinch: 0, seg: 8, rings: 4
    }), skin);
    jaw.rotation.x = -Math.PI / 2 + 0.45;
    jaw.position.set(0, -0.04, 0.06);
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

/** Lâmina 0.85 centrada em Y. Ponta em +Y; guarda na base; fio em ±Z. */
function nazgulBladeGeometry() {
    const H = 0.85;
    const half = H / 2;
    const g = new THREE.BoxGeometry(0.028, H, 0.09, 4, 22, 8);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        const y = pos.getY(i);
        let z = pos.getZ(i);
        const t = (y + half) / H;
        const widthK = t < 0.12 ? 1 : Math.max(0.035, 1 - (t - 0.12) / 0.88);
        z *= widthK;
        if (t < 0.1) {
            const u = 1 - t / 0.1;
            z *= 1 + u * 1.45;
            x *= 1 + u * 0.9;
        } else {
            const edge = Math.min(1, Math.abs(z) / Math.max(0.004, 0.045 * widthK));
            x *= 0.32 + 0.68 * (1 - edge * edge);
            if (t < 0.9) {
                const lim = 0.011 * widthK + 0.003;
                if (Math.abs(z) < lim) {
                    const groove = 1 - Math.abs(z) / lim;
                    x *= 1 - groove * 0.62;
                }
            }
        }
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

const NAZGUL_BLADE = nazgulBladeGeometry();

export function buildNazgul() {
    const group = new THREE.Group();
    const black = mapped(clothTexture('#0a0a0c'), 0x0c0c10, 0.94, 0.06, 0.4);
    black.emissive = new THREE.Color(0x050508);
    black.emissiveIntensity = 0.15;
    const hide = mapped(leatherTexture(), 0x121014, 0.9, 0.08, 0.7);

    const horse = new THREE.Group();
    group.add(horse);

    const body = new THREE.Mesh(
        geo('naz-body', () => canineTorsoGeometry({ length: 1.45, girth: 0.38, chest: 0.1 })),
        hide
    );
    body.position.set(0, 0.82, 0.05);
    horse.add(body);

    const neck = new THREE.Mesh(geo('naz-neck', () => limbGeometry({
        length: 0.48, r0: 0.14, r1: 0.08, bulge: 0.02, seg: 10, rings: 6
    })), hide);
    neck.position.set(0, 1.35, 0.62);
    neck.rotation.x = 0.85;
    horse.add(neck);

    const head = new THREE.Mesh(geo('naz-head', () => canineHeadGeometry({ radius: 0.18, style: 'dog' })), hide);
    head.position.set(0, 1.5, 1.02);
    horse.add(head);
    for (const sx of [-1, 1]) {
        const ear = new THREE.Mesh(geo('naz-ear', () => earBladeGeometry({ height: 0.14, width: 0.05, thickness: 0.016 })), hide);
        ear.position.set(sx * 0.07, 1.62, 0.98);
        ear.rotation.z = sx * 0.25;
        horse.add(ear);
    }
    const tail = new THREE.Mesh(geo('naz-tail', () => tailGeometry({ length: 0.7, r0: 0.07, r1: 0.02, fluff: 0.04 })), black);
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
            const upper = new THREE.Mesh(geo('naz-legu', () => limbGeometry({
                length: 0.34, r0: 0.07, r1: 0.045, bulge: 0.012, seg: 8, rings: 5
            })), hide);
            upper.position.y = 0;
            leg.add(upper);
            const lower = new THREE.Group();
            lower.position.y = -0.36;
            leg.add(lower);
            const lowM = new THREE.Mesh(geo('naz-legl', () => limbGeometry({
                length: 0.28, r0: 0.048, r1: 0.032, bulge: 0.006, seg: 8, rings: 5
            })), hide);
            lowM.position.y = 0;
            lower.add(lowM);
            const hoof = new THREE.Mesh(geo('naz-hoof', () => limbGeometry({
                length: 0.09, r0: 0.05, r1: 0.034, bulge: 0.008, pinch: 0.05, seg: 8, rings: 5
            })), std(0x080808, 0.5, 0.15));
            hoof.position.y = -0.28;
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

    const blade = new THREE.Mesh(NAZGUL_BLADE, std(0xc8d0d8, 0.22, 0.92));
    blade.name = 'nazgulBlade';
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

/**
 * Copa em sino. t=0 é a saia (pescoço), a barriga fica larga e o topo
 * fecha em calota — sqrt(1 - u²), não um fuso. Cada lobo:
 * raio *= 0.82 + 0.22 * max(0, cos(θ·lobes + seed))².
 */
function crownGeometry({ radius, height, y0, lobes, seed, seg = 28, steps = 14 }) {
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = y0 + t * height;
        let profile;
        if (t < 0.22) {
            profile = 0.38 + (t / 0.22) * 0.62;
        } else {
            const u = (t - 0.22) / 0.78;
            profile = Math.sqrt(Math.max(0, 1 - (u * 0.9) ** 2));
        }
        pts.push(new THREE.Vector2(Math.max(0.06, radius * profile), y));
    }
    const g = new THREE.LatheGeometry(pts, seg);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const rad = Math.hypot(x, z);
        if (rad < 1e-4) continue;
        const lobe = 0.82 + 0.22 * Math.max(0, Math.cos(Math.atan2(z, x) * lobes + seed)) ** 2;
        pos.setXYZ(i, x * lobe, y, z * lobe);
    }
    g.computeVertexNormals();
    return g;
}

function oakCanopyGeo(autumn) {
    return geo(`oak-canopy:${autumn}`, () => {
        const parts = [
            crownGeometry({ radius: 1.35, height: 1.85, y0: 0.45, lobes: 5, seed: 0.4 }),
            crownGeometry({ radius: 0.95, height: 1.35, y0: 0.7, lobes: 4, seed: 1.7 }),
            crownGeometry({ radius: 0.72, height: 1.15, y0: 1.45, lobes: 5, seed: 2.4 })
        ];
        parts[1].translate(0.72, 0.05, 0.28);
        parts[2].translate(-0.15, 0.15, -0.35);
        const merged = mergeGeometries(parts, false);
        parts.forEach((g) => g.dispose());
        if (!merged) return crownGeometry({ radius: 1.35, height: 1.85, y0: 0.45, lobes: 5, seed: 0.4 });
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

/**
 * Saia de pinheiro. A ponta fica no tronco e a bainha cai.
 * Sete lobos: raio *= 0.84 + 0.2 * max(0, cos(θ·7 + seed))²,
 * e a bainha desce nos vãos.
 */
function spruceSkirt(radius, hemY, rise, seed) {
    const apex = hemY + rise;
    const pts = [
        [0.05, apex],
        [radius * 0.28, apex - rise * 0.05],
        [radius * 0.62, hemY + rise * 0.24],
        [radius * 0.88, hemY + 0.1],
        [radius, hemY],
        [radius * 0.7, hemY + 0.12],
        [0.06, apex - rise * 0.16]
    ];
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 24);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        let y = pos.getY(i);
        const z = pos.getZ(i);
        const rad = Math.hypot(x, z);
        if (rad < radius * 0.4) continue;
        const lobe = 0.84 + 0.2 * Math.max(0, Math.cos(Math.atan2(z, x) * 7 + seed)) ** 2;
        const outer = Math.min(1, (rad - radius * 0.4) / (radius * 0.6));
        y -= (1 - lobe) * 0.28 * outer;
        pos.setXYZ(i, x * lobe, y, z * lobe);
    }
    g.computeVertexNormals();
    return g;
}

function pineTrunkGeo() {
    return geo('pine-trunk', () => {
        const H = 1.45;
        const pts = [];
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const flare = Math.exp(-t * 6) * 0.16;
            pts.push(new THREE.Vector2(0.2 - t * 0.1 + flare, t * H));
        }
        const g = new THREE.LatheGeometry(pts, 12);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const rad = Math.hypot(x, z);
            if (rad < 1e-4 || y < 0.12) continue;
            const rib = Math.max(0, Math.cos(Math.atan2(z, x) * 5)) ** 2 * 0.02;
            const k = 1 + rib / rad;
            pos.setXYZ(i, x * k, y, z * k);
        }
        g.computeVertexNormals();
        return g;
    });
}

function pineFoliageGeo() {
    return geo('pine-foliage', () => {
        const tiers = [
            [1.12, 1.02, 1.12, 0.4],
            [0.92, 1.7, 1.02, 1.2],
            [0.72, 2.36, 0.95, 2.1],
            [0.52, 2.98, 0.86, 0.8],
            [0.34, 3.55, 0.74, 1.7]
        ];
        const parts = tiers.map(([radius, hemY, rise, seed]) => spruceSkirt(radius, hemY, rise, seed));
        const leader = new THREE.LatheGeometry([
            new THREE.Vector2(0.06, 4.05),
            new THREE.Vector2(0.035, 4.4),
            new THREE.Vector2(0.012, 4.72)
        ], 8);
        parts.push(leader);
        const merged = mergeGeometries(parts, false);
        parts.forEach((g) => g.dispose());
        if (!merged) return spruceSkirt(1.12, 1.02, 1.12, 0.4);
        merged.computeVertexNormals();
        return merged;
    });
}

export function getPineAssets() {
    const leaf = mapped(leafTexture('#1e4a28'), 0x2a5a30, 0.84, 0.02, 0.8);
    vegWind(leaf, 0.05);
    return {
        trunkGeo: pineTrunkGeo(),
        foliageGeo: pineFoliageGeo(),
        trunkMat: mapped(barkTexture(), 0x6a4a30, 0.92, 0.02, 1.1),
        foliageMat: leaf
    };
}

export function buildPine() {
    const group = new THREE.Group();
    group.name = 'pineTree';
    const a = getPineAssets();
    const trunk = new THREE.Mesh(a.trunkGeo, a.trunkMat);
    const crown = new THREE.Mesh(a.foliageGeo, a.foliageMat);
    crown.name = 'pineCrown';
    group.add(trunk, crown);
    enableShadows(group);
    return group;
}

export function buildPartyTree() {
    const group = new THREE.Group();
    group.name = 'partyTree';
    const trunk = new THREE.Mesh(
        geo('party-trunk', () => {
            const H = 4.35;
            const pts = [];
            for (let i = 0; i <= 16; i++) {
                const t = i / 16;
                const flare = Math.exp(-t * 5.5) * 0.55;
                const collar = t > 0.86 ? (t - 0.86) * 0.9 : 0;
                pts.push(new THREE.Vector2(0.42 - t * 0.1 + flare + collar, t * H));
            }
            const g = new THREE.LatheGeometry(pts, 16);
            const pos = g.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                const rad = Math.hypot(x, z);
                if (rad < 1e-4 || y < 0.25 || y > H - 0.15) continue;
                const rib = Math.max(0, Math.cos(Math.atan2(z, x) * 7)) ** 2 * 0.045;
                const k = 1 + rib / rad;
                pos.setXYZ(i, x * k, y, z * k);
            }
            g.computeVertexNormals();
            return g;
        }),
        mapped(barkTexture(), 0x8a6a48, 0.9, 0.02, 1.15)
    );
    group.add(trunk);

    const leaf = mapped(leafTexture('#2f6a24'), 0x4a8a32, 0.8);
    vegWind(leaf, 0.07);
    const clumps = [
        [0, 4.55, 0, 1.7, 2.15, 5, 0.2, 1],
        [1.25, 4.35, 0.55, 1.35, 1.7, 4, 1.1, 0.92],
        [-1.05, 4.4, 0.7, 1.28, 1.65, 5, 2.2, 0.9],
        [0.35, 4.5, -1.3, 1.32, 1.7, 4, 0.6, 0.94],
        [-0.4, 5.55, 0.15, 1.15, 1.45, 5, 1.8, 0.82]
    ];
    clumps.forEach(([x, y, z, radius, height, lobes, seed, scale], i) => {
        const blob = new THREE.Mesh(
            geo(`party-crown:${i}`, () => crownGeometry({
                radius, height, y0: -height * 0.42, lobes, seed
            })),
            leaf
        );
        blob.position.set(x, y, z);
        blob.scale.setScalar(scale);
        if (i === 0) blob.name = 'partyCrown';
        group.add(blob);
    });

    const card = mat('party-leaf-card', () => {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, 64, 64);
        ctx.fillStyle = '#3f7a2c';
        ctx.beginPath();
        ctx.ellipse(32, 36, 13, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#214816';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(32, 12);
        ctx.lineTo(32, 60);
        ctx.stroke();
        const tex = new THREE.CanvasTexture(canvas);
        tex.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.MeshStandardMaterial({
            map: tex, color: 0x4a8a32, alphaTest: 0.45, roughness: 0.72, side: THREE.DoubleSide
        });
        vegWind(m, 0.16);
        return m;
    });
    const cardGeo = geo('party-leaf-card', () => new THREE.PlaneGeometry(0.72, 1.05));
    for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const leafCard = new THREE.Mesh(cardGeo, card);
        leafCard.position.set(Math.cos(a) * 2.25, 4.15 + (i % 4) * 0.48, Math.sin(a) * 2.25);
        leafCard.rotation.set(0.15, a, i % 2 ? 0.4 : -0.4);
        group.add(leafCard);
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

/**
 * Coluna dórica do salão. y=0 no chão.
 * Base em degraus (raio 1.04 → 0.72), fuste com ênfase no terço inferior
 * e 12 caneluras (cos(θ·12) empurra o sulco para dentro), capitel com
 * equino e ábaco até y = height + 0.4.
 */
function pillarColumn(height) {
    const H = height;
    const pts = [
        [1.04, 0],
        [1.04, 0.14],
        [0.9, 0.16],
        [0.9, 0.32],
        [0.76, 0.34],
        [0.72, 0.5],
        [0.76, 0.62],
        [0.74, H * 0.18],
        [0.68, H * 0.45],
        [0.62, H * 0.78],
        [0.58, H - 0.55],
        [0.64, H - 0.32],
        [0.82, H - 0.12],
        [0.98, H],
        [0.98, H + 0.14],
        [0.62, H + 0.16],
        [0.36, H + 0.3],
        [0.08, H + 0.4]
    ];
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 40);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        if (y < 0.62 || y > H - 0.55) continue;
        const r = Math.hypot(x, z);
        if (r < 0.2) continue;
        const flute = Math.max(0, Math.cos(Math.atan2(z, x) * 12));
        const k = 1 - 0.055 * flute * flute;
        pos.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    return g;
}

export function getPillarAssets(height = 14) {
    const stone = mapped(stoneTexture('#6a5a48'), 0x7a6a58, 0.9, 0.03, 1.1);
    const g = geo(`pillar:${height}`, () => pillarColumn(height));
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
        const cap = new THREE.Mesh(geo('pav-cap', () => new THREE.LatheGeometry([
            new THREE.Vector2(0.04, 0),
            new THREE.Vector2(0.2, 0.03),
            new THREE.Vector2(0.16, 0.12),
            new THREE.Vector2(0.06, 0.24),
            new THREE.Vector2(0.015, 0.32)
        ], 12)), gold);
        cap.position.set(Math.cos(a) * 5.2, 4.12, Math.sin(a) * 5.2);
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

/** Encosto 0.55×0.7×0.12, centrado. Crista no meio e painel recuado na face interna (−Z). */
function councilBackGeometry() {
    const g = new THREE.BoxGeometry(0.55, 0.7, 0.12, 8, 10, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        if (y > 0.06) {
            const u = Math.min(1, (y - 0.06) / 0.29);
            const crest = Math.max(0, 0.32 - Math.abs(x) * 1.2);
            y += u * crest;
            x *= 1 - u * 0.18 * Math.min(1, Math.abs(x) / 0.27);
        }
        if (z < -0.03 && Math.abs(x) < 0.15 && y > -0.2 && y < 0.18) z += 0.055;
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

const COUNCIL_BACK = councilBackGeometry();

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
        const back = new THREE.Mesh(COUNCIL_BACK, stone);
        back.name = 'councilBack';
        back.position.set(Math.cos(a) * 3.72, 0.5, Math.sin(a) * 3.72);
        back.lookAt(0, 0.5, 0);
        group.add(back);
    }
    enableShadows(group);
    return group;
}

/** Laje 2.35×0.26×1.55, centrada. Chanfro, prato gasto no topo e cinta na face. */
function bridgeSlabGeometry() {
    const g = new THREE.BoxGeometry(2.35, 0.26, 1.55, 10, 3, 8);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const edgeX = Math.abs(x) > 0.95;
        const edgeZ = Math.abs(z) > 0.58;
        if (y > 0.06 && (edgeX || edgeZ)) {
            y -= 0.045;
            if (edgeX) x *= 0.94;
            if (edgeZ) z *= 0.93;
        }
        if (y > 0.04) {
            const dish = Math.max(0, 1 - (x / 1.15) ** 2) * Math.max(0, 1 - (z / 0.75) ** 2);
            y += dish * 0.035;
        }
        if (Math.abs(y) < 0.05 && (Math.abs(x) > 1.05 || Math.abs(z) > 0.68)) {
            if (Math.abs(x) > 1.05) x = Math.sign(x) * (Math.abs(x) + 0.04);
            if (Math.abs(z) > 0.68) z = Math.sign(z) * (Math.abs(z) + 0.035);
        }
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

/** Pilar de 1.15, centrado. Base, fuste e capitel. */
function bridgePostGeometry() {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const y = (t - 0.5) * 1.15;
        let r = 0.05;
        r += 0.045 * Math.exp(-((t - 0.08) ** 2) / 0.003);
        r += 0.02 * Math.exp(-((t - 0.48) ** 2) / 0.012);
        r += 0.04 * Math.exp(-((t - 0.88) ** 2) / 0.004);
        if (t < 0.05 || t > 0.95) r = 0.095;
        pts.push(new THREE.Vector2(r, y));
    }
    const g = new THREE.LatheGeometry(pts, 8);
    g.computeVertexNormals();
    return g;
}

/** Travessa de 2.4 ao longo de X, seção redonda com ponteiras. */
function bridgeRailGeometry() {
    const pts = [];
    for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const y = (t - 0.5) * 2.4;
        const r = t < 0.07 || t > 0.93 ? 0.075 : 0.042;
        pts.push(new THREE.Vector2(r, y));
    }
    const g = new THREE.LatheGeometry(pts, 8);
    g.rotateZ(Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

const BRIDGE_SLAB = bridgeSlabGeometry();
const BRIDGE_POST = bridgePostGeometry();
const BRIDGE_RAIL = bridgeRailGeometry();

export function buildBridge() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#5a5048'), 0x6a6058, 0.88, 0.04, 1.05);
    for (let i = 0; i < 10; i++) {
        const slab = new THREE.Mesh(BRIDGE_SLAB, stone);
        slab.name = 'bridgeSlab';
        slab.position.set((i % 2) * 0.06, 0.13, -7.2 + i * 1.6);
        group.add(slab);
    }
    for (const z of [-7.2, 7.2]) {
        for (const x of [-1.12, 1.12]) {
            const post = new THREE.Mesh(BRIDGE_POST, stone);
            post.name = 'bridgePost';
            post.position.set(x, 0.7, z);
            group.add(post);
        }
        const rail = new THREE.Mesh(BRIDGE_RAIL, stone);
        rail.name = 'bridgeRail';
        rail.position.set(0, 1.15, z);
        group.add(rail);
    }
    enableShadows(group);
    return group;
}

/** Encosto centrado. Crista no meio e um painel recuado na face +Z. */
function throneBackGeometry() {
    const hw = 0.72;
    const hh = 1.125;
    const s = new THREE.Shape();
    s.moveTo(-hw, -hh);
    s.lineTo(-hw, 0.2);
    s.quadraticCurveTo(-0.15, hh + 0.22, 0, hh + 0.48);
    s.quadraticCurveTo(0.15, hh + 0.22, hw, 0.2);
    s.lineTo(hw, -hh);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.34,
        bevelEnabled: true,
        bevelThickness: 0.028,
        bevelSize: 0.03,
        bevelSegments: 1,
        curveSegments: 10
    });
    g.translate(0, 0, -0.17);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        let z = pos.getZ(i);
        if (z > 0.04 && Math.abs(x) < 0.36 && y > -0.62 && y < 0.48) z -= 0.07;
        if (z > 0.02) z -= Math.max(0, 1 - (x / 0.85) ** 2) * 0.03;
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

/** Assento 1.35×0.22×1.05, centrado. Prato no meio e lábio na frente (+Z). */
function throneSeatGeometry() {
    const g = new THREE.BoxGeometry(1.35, 0.22, 1.05, 8, 2, 6);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        let y = pos.getY(i);
        const z = pos.getZ(i);
        if (y > 0.04) {
            const dish = Math.max(0, 1 - (x / 0.72) ** 2) * Math.max(0, 1 - (z / 0.55) ** 2);
            y -= dish * 0.055;
            if (z > 0.38) y += 0.028;
        }
        if (y > 0.05 && (Math.abs(x) > 0.52 || Math.abs(z) > 0.4)) y -= 0.03;
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

/** Braço ao longo de Z, com a voluta na frente. Largura extrudada vira X. */
function throneArmGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.45, -0.2);
    s.lineTo(-0.45, 0.06);
    s.lineTo(0.05, 0.16);
    s.quadraticCurveTo(0.42, 0.2, 0.5, 0.02);
    s.quadraticCurveTo(0.46, -0.12, 0.28, -0.16);
    s.lineTo(0.05, -0.2);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.18,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.016,
        bevelSegments: 1,
        curveSegments: 8
    });
    g.translate(0, 0, -0.09);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

const THRONE_BACK = throneBackGeometry();
const THRONE_SEAT = throneSeatGeometry();
const THRONE_ARM = throneArmGeometry();

export function buildSeat() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#9a8a78'), 0xb0a090, 0.86, 0.04, 1.0);
    const base = new THREE.Mesh(
        lathe([[0.2, 0], [1.75, 0.02], [1.55, 0.42], [1.4, 0.5]], 16, 'seat-base'),
        stone
    );
    group.add(base);
    const back = new THREE.Mesh(THRONE_BACK, stone);
    back.name = 'throneBack';
    back.position.set(0, 1.45, -0.52);
    group.add(back);
    const sit = new THREE.Mesh(THRONE_SEAT, stone);
    sit.name = 'throneSeat';
    sit.position.set(0, 0.62, 0.12);
    group.add(sit);
    const arms = mapped(stoneTexture('#9a8a78'), 0xb0a090);
    for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(THRONE_ARM, arms);
        arm.name = 'throneArm';
        arm.position.set(sx * 0.72, 0.85, 0.05);
        group.add(arm);
    }
    enableShadows(group);
    return group;
}

/** Coluna de 3.45, centrada. Base, caneluras e um capitel lascado. */
function ruinPillarGeometry() {
    const H = 3.45;
    const pts = [];
    for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const y = (t - 0.5) * H;
        let r = 0.24 - t * 0.05;
        if (t < 0.1) r += 0.12 * (1 - t / 0.1);
        if (t > 0.88) r += 0.07 * ((t - 0.88) / 0.12);
        pts.push(new THREE.Vector2(Math.max(0.08, r), y));
    }
    const g = new THREE.LatheGeometry(pts, 21);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const ang = Math.atan2(z, x);
        const flute = 0.74 + 0.26 * Math.max(0, Math.cos(ang * 7)) ** 2;
        const chip = y > 1.35 && Math.cos(ang * 2 + 0.6) > 0.35 ? 0.72 : 1;
        pos.setXYZ(i, x * flute * chip, y, z * flute * chip);
    }
    g.computeVertexNormals();
    return g;
}

/** Arquitrave de 3.45 ao longo de X. Cornija e uma ponta caída. */
function ruinLintelGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.31, -0.24);
    s.lineTo(-0.31, 0.02);
    s.lineTo(-0.24, 0.1);
    s.lineTo(-0.16, 0.22);
    s.lineTo(0.16, 0.22);
    s.lineTo(0.24, 0.1);
    s.lineTo(0.31, 0.02);
    s.lineTo(0.31, -0.24);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 3.45,
        steps: 14,
        bevelEnabled: true,
        bevelThickness: 0.018,
        bevelSize: 0.02,
        bevelSegments: 1
    });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        const z = pos.getZ(i);
        if (z > 3.05) {
            const u = Math.min(1, (z - 3.05) / 0.45);
            y -= u * u * 0.22;
            x *= 1 - u * 0.25;
        }
        pos.setXYZ(i, x, y, z);
    }
    g.translate(0, 0, -1.725);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

const RUIN_PILLAR = ruinPillarGeometry();
const RUIN_LINTEL = ruinLintelGeometry();

export function buildRuinArch() {
    const group = new THREE.Group();
    const stone = mapped(stoneTexture('#8a7a68'), 0x9a8a78, 0.9, 0.04, 1.15);
    for (const sx of [-1, 1]) {
        const p = new THREE.Mesh(RUIN_PILLAR, stone);
        p.name = 'ruinPillar';
        p.position.set(sx * 1.4, 1.72, 0);
        group.add(p);
    }
    const lintel = new THREE.Mesh(RUIN_LINTEL, stone);
    lintel.name = 'ruinLintel';
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
            const H = 0.72;
            const half = H / 2;
            const g = new THREE.BoxGeometry(0.03, H, 0.1, 4, 18, 8);
            const pos = g.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                let x = pos.getX(i);
                const y = pos.getY(i);
                let z = pos.getZ(i);
                const t = (y + half) / H;
                const widthK = t < 0.1 ? 1 : Math.max(0.04, 1 - (t - 0.1) / 0.9);
                z *= widthK;
                const edge = Math.min(1, Math.abs(z) / Math.max(0.004, 0.05 * widthK));
                x *= 0.34 + 0.66 * (1 - edge * edge);
                if (t > 0.12 && t < 0.88) {
                    const lim = 0.012 * widthK + 0.003;
                    if (Math.abs(z) < lim) x *= 1 - (1 - Math.abs(z) / lim) * 0.55;
                }
                pos.setXYZ(i, x, y, z);
            }
            g.computeVertexNormals();
            return g;
        }),
        std(0xd8dee8, 0.22, 0.92)
    );
    blade.name = 'playerBlade';
    blade.position.y = 0.4;
    group.add(blade);
    const guard = new THREE.Mesh(geo('sw-guard', () => {
        const g = new THREE.BoxGeometry(0.32, 0.05, 0.08, 14, 2, 2);
        const pos = g.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            let y = pos.getY(i);
            let z = pos.getZ(i);
            const nx = Math.min(1, Math.abs(x) / 0.16);
            if (nx > 0.28) {
                const u = (nx - 0.28) / 0.72;
                y -= u * u * 0.07;
                z *= 1 - u * 0.42;
            }
            pos.setXYZ(i, x, y, z);
        }
        g.computeVertexNormals();
        return g;
    }), mapped(goldTexture(), 0xc9a227, 0.32, 0.82, 0.3));
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
