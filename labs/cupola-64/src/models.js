/**
 * Modelos PBR hiper-realistas — MeshPhysical/Standard, clearcoat em
 * superfícies molhadas/metálicas, geometria suave. Nico, castelo, árvores,
 * estrelas, moedas, fungos e a bomba-rei.
 */

import * as THREE from 'three';
import { peachStone, leafCanopy, fabricTeal, goldMetal } from './textures.js';
import {
    attachHumanHead, limbGeometry, torsoGeometry, shoeMesh, handGroup, leatherMaterial, createOrganicTree
} from '../../shared/realism.js?v=2';

const geoCache = new Map();
function geo(key, factory) {
    if (!geoCache.has(key)) geoCache.set(key, factory());
    return geoCache.get(key);
}

export const pbrMaterials = [];
/** @deprecated alias — prefer pbrMaterials */
export const n64Materials = pbrMaterials;

/**
 * Material PBR padrão. Sem flatShading, sem vertex-snap.
 */
export function pbrMat(color, {
    roughness = 0.52,
    metalness = 0.08,
    clearcoat = 0,
    clearcoatRoughness = 0.28,
    emissive = 0x000000,
    emissiveIntensity = 1,
    opacity = 1,
    map = null,
    normalMap = null,
    roughnessMap = null,
    normalScale = 1,
    transmission = 0,
    ior = 1.5,
    snap: _snap,
    flatShading: _flat,
    ...props
} = {}) {
    const usePhysical = clearcoat > 0 || transmission > 0;
    const opts = {
        color,
        roughness,
        metalness,
        emissive,
        emissiveIntensity,
        transparent: opacity < 1 || transmission > 0,
        opacity,
        ...props
    };
    if (map) opts.map = map;
    if (normalMap) {
        opts.normalMap = normalMap;
        opts.normalScale = new THREE.Vector2(normalScale, normalScale);
    }
    if (roughnessMap) opts.roughnessMap = roughnessMap;

    let mat;
    if (usePhysical) {
        mat = new THREE.MeshPhysicalMaterial({
            ...opts,
            clearcoat,
            clearcoatRoughness,
            transmission,
            ior
        });
    } else {
        mat = new THREE.MeshStandardMaterial(opts);
    }
    mat.userData.pbr = true;
    pbrMaterials.push(mat);
    return mat;
}

/** @deprecated alias */
export const n64Mat = pbrMat;

function mesh(geometry, color, extras) {
    const m = new THREE.Mesh(geometry, pbrMat(color, extras));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

/** Nico — herói redondo de macacão teal e boina coral. */
export function createNico() {
    const root = new THREE.Group();
    root.name = 'nico';
    const fabric = fabricTeal();

    const hips = new THREE.Group();
    hips.name = 'hips';
    hips.position.y = 0.38;
    root.add(hips);

    const torso = new THREE.Mesh(
        torsoGeometry({ height: 0.78, girth: 0.36, style: 'chibi' }),
        pbrMat(0x2a9a8c, { map: fabric.map, roughness: 0.55, metalness: 0.04 })
    );
    torso.castShadow = true;
    torso.receiveShadow = true;
    hips.add(torso);

    const shirt = mesh(geo('n-shirt', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.08, 0),
        new THREE.Vector2(0.26, 0.05),
        new THREE.Vector2(0.3, 0.16),
        new THREE.Vector2(0.2, 0.28),
        new THREE.Vector2(0.08, 0.34)
    ], 22)), 0xffe6c8, { roughness: 0.62 });
    shirt.position.y = 0.42;
    hips.add(shirt);

    const strapGeo = limbGeometry({ length: 0.42, r0: 0.045, r1: 0.038, bulge: 0.008, pinch: 0.1, seg: 8 });
    const strapL = mesh(geo('n-strap', () => strapGeo), 0x1f7a70, { roughness: 0.58 });
    strapL.position.set(-0.16, 0.78, 0.2);
    strapL.rotation.z = 0.18;
    const strapR = strapL.clone();
    strapR.position.x = 0.16;
    strapR.rotation.z = -0.18;
    hips.add(strapL, strapR);

    const gold = goldMetal();
    const button = mesh(geo('n-btn', () => new THREE.SphereGeometry(0.055, 16, 12)), 0xffe14a, {
        map: gold.map,
        roughness: 0.28,
        metalness: 0.75,
        emissive: 0x442200,
        emissiveIntensity: 0.25
    });
    button.position.set(-0.14, 0.38, 0.3);
    const button2 = button.clone();
    button2.position.x = 0.14;
    hips.add(button, button2);

    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 0.95;
    hips.add(head);

    attachHumanHead(head, {
        radius: 0.32,
        style: 'chibi',
        skin: 0xffd4a8,
        hair: 0x6a3a1c,
        hairStyle: 'short',
        iris: 0x2a4a28,
        lips: 0xd47868
    });

    const cap = mesh(
        geo('n-cap', () => new THREE.LatheGeometry([
            new THREE.Vector2(0.02, 0.2),
            new THREE.Vector2(0.18, 0.18),
            new THREE.Vector2(0.3, 0.08),
            new THREE.Vector2(0.34, 0.0),
            new THREE.Vector2(0.12, -0.02)
        ], 28)),
        0xff6b4a,
        { roughness: 0.48, clearcoat: 0.2 }
    );
    cap.position.y = 0.06;
    head.add(cap);

    const visor = mesh(geo('n-visor', () => {
        const s = new THREE.Shape();
        s.moveTo(-0.2, 0);
        s.quadraticCurveTo(-0.16, 0.07, 0, 0.09);
        s.quadraticCurveTo(0.16, 0.07, 0.2, 0);
        s.quadraticCurveTo(0, -0.015, -0.2, 0);
        const g = new THREE.ExtrudeGeometry(s, {
            depth: 0.2,
            bevelEnabled: true,
            bevelThickness: 0.012,
            bevelSize: 0.01,
            bevelSegments: 1,
            curveSegments: 8
        });
        g.translate(0, -0.02, 0);
        return g;
    }), 0xff6b4a, { roughness: 0.45 });
    visor.position.set(0, 0.12, 0.22);
    visor.rotation.x = -0.35;
    head.add(visor);

    const emblem = mesh(geo('n-star', () => new THREE.OctahedronGeometry(0.09, 1)), 0xffe14a, {
        map: gold.map,
        roughness: 0.25,
        metalness: 0.7,
        emissive: 0x553300,
        emissiveIntensity: 0.4,
        clearcoat: 0.5
    });
    emblem.position.set(0, 0.22, 0.3);
    emblem.rotation.z = Math.PI / 4;
    head.add(emblem);

    const armL = new THREE.Group();
    armL.name = 'armL';
    armL.position.set(-0.4, 0.55, 0);
    const armR = new THREE.Group();
    armR.name = 'armR';
    armR.position.set(0.4, 0.55, 0);
    const armGeo = limbGeometry({ length: 0.38, r0: 0.09, r1: 0.065, bulge: 0.02, bulgeAt: 0.32, pinch: 0.2 });
    const skinArm = pbrMat(0xffe6c8, { roughness: 0.5 });
    const aL = new THREE.Mesh(armGeo, skinArm);
    aL.rotation.z = 0.22;
    aL.castShadow = true;
    const aR = new THREE.Mesh(armGeo, skinArm);
    aR.rotation.z = -0.22;
    aR.castShadow = true;
    const gloveMat = pbrMat(0xf4efe2, { roughness: 0.55, side: THREE.DoubleSide });
    const glove = handGroup(gloveMat, { scale: 1.35 });
    glove.position.set(-0.08, -0.38, 0.02);
    const gloveR = handGroup(gloveMat, { scale: 1.35 });
    gloveR.position.set(0.08, -0.38, 0.02);
    gloveR.scale.x = -1;
    armL.add(aL, glove);
    armR.add(aR, gloveR);
    hips.add(armL, armR);

    const legL = new THREE.Group();
    legL.name = 'legL';
    legL.position.set(-0.14, 0.08, 0);
    const legR = new THREE.Group();
    legR.name = 'legR';
    legR.position.set(0.14, 0.08, 0);
    const legGeo = limbGeometry({ length: 0.36, r0: 0.12, r1: 0.085, bulge: 0.028, bulgeAt: 0.3 });
    const legMat = pbrMat(0x2a9a8c, { map: fabric.map, roughness: 0.55 });
    const thigh = new THREE.Mesh(legGeo, legMat);
    thigh.castShadow = true;
    const thighR = new THREE.Mesh(legGeo, legMat);
    thighR.castShadow = true;
    const shoeMat = leatherMaterial(0x3a2418);
    const shoe = shoeMesh(shoeMat, { length: 0.3, width: 0.13, height: 0.1 });
    shoe.position.set(0, -0.36, 0.04);
    const shoeR = shoeMesh(shoeMat, { length: 0.3, width: 0.13, height: 0.1 });
    shoeR.position.set(0, -0.36, 0.04);
    legL.add(thigh, shoe);
    legR.add(thighR, shoeR);
    hips.add(legL, legR);

    const shadow = new THREE.Mesh(
        geo('n-sh', () => new THREE.CircleGeometry(0.42, 48)),
        new THREE.MeshBasicMaterial({ color: 0x102010, transparent: true, opacity: 0.32, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.02;
    root.add(shadow);

    return {
        root,
        parts: { hips, head, cap, emblem, armL, armR, legL, legR, torso, shadow }
    };
}

/**
 * Planta do corpo do castelo em XZ (frente em +Z). Contrafortes saem
 * da face sem cobrir o vão do portão (x ±1.3) nem as janelas (x ±3.2).
 * A Shape usa y = −z para, depois de rotateX(−π/2), o eixo da extrusão
 * cair em +Y com a frente ainda em +Z.
 */
function keepPlanShape() {
    const world = [
        [-5, -4.2], [-2.2, -4.2], [-2.2, -4.68], [-1.15, -4.68], [-1.15, -4.2],
        [1.15, -4.2], [1.15, -4.68], [2.2, -4.68], [2.2, -4.2], [5, -4.2],
        [5, -2.45], [5.48, -2.45], [5.48, -1.35], [5, -1.35],
        [5, 0.35], [5.48, 0.35], [5.48, 1.5], [5, 1.5], [5, 4.2],
        [4.15, 4.2], [4.15, 4.78], [3.6, 4.78], [3.6, 4.2],
        [2.5, 4.2], [2.5, 4.78], [1.5, 4.78], [1.5, 4.2],
        [-1.5, 4.2], [-1.5, 4.78], [-2.5, 4.78], [-2.5, 4.2],
        [-3.6, 4.2], [-3.6, 4.78], [-4.15, 4.78], [-4.15, 4.2], [-5, 4.2],
        [-5, 1.5], [-5.48, 1.5], [-5.48, 0.35], [-5, 0.35],
        [-5, -1.35], [-5.48, -1.35], [-5.48, -2.45], [-5, -2.45]
    ];
    const shape = new THREE.Shape();
    const last = world.length - 1;
    shape.moveTo(world[last][0], -world[last][1]);
    for (let i = last - 1; i >= 0; i--) shape.lineTo(world[i][0], -world[i][1]);
    shape.closePath();
    return shape;
}

/** Corpo em silhar: prumo mais largo na base, cornija chanfrada, fiadas na face. */
function keepBodyGeometry() {
    const bevel = 0.26;
    const depth = 7.2 - bevel;
    const g = new THREE.ExtrudeGeometry(keepPlanShape(), {
        depth,
        bevelEnabled: true,
        bevelThickness: bevel,
        bevelSize: 0.2,
        bevelSegments: 2,
        curveSegments: 1
    });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const course = Math.sin(z * 9.2) * 0.035;
        const block = Math.sin(x * 2.4) * Math.cos(y * 1.8 + z * 2.6) * 0.02;
        const len = Math.hypot(x, y) || 1;
        pos.setXY(i, x + (x / len) * (course + block), y + (y / len) * (course + block));
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);
    return g;
}

/** Fiada de ameias. O dente aponta para −Y da Shape, que vira +Z depois da rotação. */
function merlonRunGeometry(length) {
    const tooth = 0.7;
    const gap = 0.46;
    const thick = 0.58;
    const n = Math.max(3, Math.floor((length + gap) / (tooth + gap)));
    const pitch = tooth + gap;
    const x0 = -((n - 1) * pitch + tooth) / 2;
    const shape = new THREE.Shape();
    shape.moveTo(x0, 0);
    for (let i = 0; i < n; i++) {
        const x = x0 + i * pitch;
        shape.lineTo(x, 0);
        shape.lineTo(x, -thick);
        shape.lineTo(x + tooth, -thick);
        shape.lineTo(x + tooth, 0);
    }
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: 0.78,
        bevelEnabled: true,
        bevelThickness: 0.045,
        bevelSize: 0.04,
        bevelSegments: 1
    });
    g.rotateX(-Math.PI / 2);
    g.computeBoundingBox();
    g.translate(0, -g.boundingBox.min.y, 0);
    return g;
}

/** Porta de tábuas com arco de meio ponto. Origem na base, face em +Z. */
function castleGateGeometry() {
    const w = 2.55;
    const h = 3.35;
    const r = w / 2;
    const spring = h - r;
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2, 0);
    shape.lineTo(w / 2, 0);
    shape.lineTo(w / 2, spring);
    shape.absarc(0, spring, r, 0, Math.PI, false);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: 0.34,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.045,
        bevelSegments: 1
    });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z < 0.2) continue;
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setZ(i, z + Math.abs(Math.sin(x * 7.5)) * 0.012 + Math.sin(y * 5) * 0.006);
    }
    g.computeVertexNormals();
    g.translate(0, 0, -0.16);
    return g;
}

/** Escada de três degraus. x=0 da Shape encosta no muro; a frente desce em +Z. */
function castleStepsGeometry() {
    const run = 3.2 / 3;
    const rise = 0.7 / 3;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(3.2, 0);
    shape.lineTo(3.2, rise);
    shape.lineTo(run * 2, rise);
    shape.lineTo(run * 2, rise * 2);
    shape.lineTo(run, rise * 2);
    shape.lineTo(run, 0.7);
    shape.lineTo(0, 0.7);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 4.4, bevelEnabled: false });
    g.translate(0, 0, -2.2);
    g.rotateY(-Math.PI / 2);
    return g;
}

export function createCastle() {
    const g = new THREE.Group();
    g.name = 'castle';
    const stone = peachStone();
    const gold = goldMetal();

    const keep = mesh(geo('c-keep', keepBodyGeometry), 0xf3c4b4, {
        map: stone.map,
        normalMap: stone.normalMap,
        roughnessMap: stone.roughnessMap,
        roughness: 0.68,
        metalness: 0.05
    });
    g.add(keep);

    const parapetMat = {
        map: stone.map,
        normalMap: stone.normalMap,
        roughness: 0.58
    };
    const front = mesh(geo('c-mer-f', () => merlonRunGeometry(9.6)), 0xe8a898, parapetMat);
    front.position.set(0, 7.22, 3.62);
    const back = mesh(geo('c-mer-b', () => merlonRunGeometry(5.2)), 0xe8a898, parapetMat);
    back.position.set(0, 7.22, -3.62);
    back.rotation.y = Math.PI;
    const sideR = mesh(geo('c-mer-s', () => merlonRunGeometry(3.1)), 0xe8a898, parapetMat);
    sideR.position.set(4.42, 7.22, 1.9);
    sideR.rotation.y = Math.PI / 2;
    const sideL = mesh(geo('c-mer-s', () => merlonRunGeometry(3.1)), 0xe8a898, parapetMat);
    sideL.position.set(-4.42, 7.22, 1.9);
    sideL.rotation.y = -Math.PI / 2;
    g.add(front, back, sideR, sideL);

    for (const sx of [-4.6, 4.6]) {
        const tower = mesh(geo('c-tow', () => new THREE.CylinderGeometry(1.55, 1.7, 9.2, 48)), 0xf7d0c2, {
            map: stone.map,
            normalMap: stone.normalMap,
            roughnessMap: stone.roughnessMap,
            roughness: 0.65
        });
        tower.position.set(sx, 4.6, -2.2);
        const roof = mesh(geo('c-roof', () => new THREE.LatheGeometry([
            new THREE.Vector2(0.06, 1.3),
            new THREE.Vector2(0.4, 0.8),
            new THREE.Vector2(1.2, 0.1),
            new THREE.Vector2(1.95, -0.75),
            new THREE.Vector2(2.2, -1.25)
        ], 18)), 0xc45c6a, {
            roughness: 0.42,
            metalness: 0.08,
            clearcoat: 0.15
        });
        roof.position.set(sx, 10.4, -2.2);
        const ball = mesh(geo('c-ball', () => new THREE.SphereGeometry(0.28, 24, 20)), 0xffe14a, {
            map: gold.map,
            roughness: 0.25,
            metalness: 0.8,
            emissive: 0x442200,
            emissiveIntensity: 0.35,
            clearcoat: 0.6
        });
        ball.position.set(sx, 11.85, -2.2);
        g.add(tower, roof, ball);
    }

    const gate = mesh(geo('c-gate', castleGateGeometry), 0x4a2a38, {
        roughness: 0.72,
        normalMap: stone.normalMap
    });
    gate.position.set(0, 0.02, 4.4);
    const arch = mesh(geo('c-arch', () => new THREE.TorusGeometry(1.38, 0.13, 8, 20, Math.PI)), 0xffe14a, {
        map: gold.map,
        roughness: 0.3,
        metalness: 0.7,
        emissive: 0x332200,
        emissiveIntensity: 0.2
    });
    arch.position.set(0, 2.08, 4.66);
    g.add(gate, arch);

    const dome = mesh(
        geo('c-dome', () => new THREE.SphereGeometry(2.6, 48, 32, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        0xffe27a,
        {
            map: gold.map,
            roughness: 0.28,
            metalness: 0.65,
            emissive: 0x332200,
            emissiveIntensity: 0.3,
            clearcoat: 0.45
        }
    );
    dome.position.set(0, 8.4, 0);
    const spire = mesh(geo('c-spire', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.02, 1.1),
        new THREE.Vector2(0.14, 0.5),
        new THREE.Vector2(0.32, -0.1),
        new THREE.Vector2(0.42, -0.85),
        new THREE.Vector2(0.16, -1.1)
    ], 12)), 0xc45c6a, {
        roughness: 0.4
    });
    spire.position.set(0, 11.2, 0);
    const star = mesh(geo('c-star', () => new THREE.OctahedronGeometry(0.42, 1)), 0xfff1a0, {
        map: gold.map,
        roughness: 0.2,
        metalness: 0.75,
        emissive: 0x665500,
        emissiveIntensity: 0.5,
        clearcoat: 0.7
    });
    star.position.set(0, 12.5, 0);
    star.name = 'cupolaStar';
    g.add(dome, spire, star);

    const glass = mesh(geo('c-glass', () => new THREE.CircleGeometry(1.15, 48)), 0x7ec8ff, {
        roughness: 0.08,
        metalness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        transmission: 0.55,
        ior: 1.5,
        opacity: 0.85,
        emissive: 0x113355,
        emissiveIntensity: 0.4,
        side: THREE.DoubleSide
    });
    glass.position.set(0, 5.4, 4.22);
    g.add(glass);

    for (const [x, y] of [[-3.2, 4.6], [3.2, 4.6], [-3.2, 2.4], [3.2, 2.4]]) {
        const w = mesh(geo('c-win', () => new THREE.BoxGeometry(0.7, 1.1, 0.12)), 0x7ec8ff, {
            roughness: 0.12,
            metalness: 0.1,
            clearcoat: 0.9,
            transmission: 0.4,
            emissive: 0x102040,
            emissiveIntensity: 0.35
        });
        w.position.set(x, y, 4.22);
        g.add(w);
    }

    const steps = mesh(geo('c-steps', castleStepsGeometry), 0xe8d4c4, {
        normalMap: stone.normalMap,
        roughness: 0.7
    });
    steps.position.set(0, 0, 5.08);
    g.add(steps);

    const bridge = mesh(geo('c-br', () => {
        const deck = new THREE.BoxGeometry(3.2, 0.22, 6.5, 2, 1, 18);
        const pos = deck.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            if (pos.getY(i) < 0.04) continue;
            pos.setY(i, pos.getY(i) - Math.abs(Math.sin(pos.getZ(i) * 4.4)) * 0.018);
        }
        deck.computeVertexNormals();
        return deck;
    }), 0xd2b48c, { roughness: 0.72 });
    bridge.position.set(0, 1.45, 10.4);
    const stringerGeo = geo('c-br-s', () => {
        const shape = new THREE.Shape();
        shape.moveTo(-3.2, 0);
        shape.lineTo(3.2, 0);
        shape.lineTo(3.2, -0.1);
        shape.quadraticCurveTo(0, -1.34, -3.2, -0.1);
        shape.closePath();
        const s = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false });
        s.translate(0, 0, -0.07);
        s.rotateY(-Math.PI / 2);
        return s;
    });
    const sL = mesh(stringerGeo, 0xc4a070, { roughness: 0.66 });
    sL.position.set(-1.46, 1.32, 10.4);
    const sR = mesh(stringerGeo, 0xc4a070, { roughness: 0.66 });
    sR.position.set(1.46, 1.32, 10.4);
    const postGeo = geo('c-post', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.055, 0),
        new THREE.Vector2(0.07, 0.06),
        new THREE.Vector2(0.04, 0.46),
        new THREE.Vector2(0.065, 0.56),
        new THREE.Vector2(0.028, 0.66)
    ], 7));
    const railGeo = geo('c-rail', () => {
        const pts = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            pts.push(new THREE.Vector3(0, Math.sin(t * Math.PI) * -0.05, (t - 0.5) * 6.1));
        }
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.035, 5, false);
    });
    for (const sx of [-1.42, 1.42]) {
        const rail = mesh(railGeo, 0xe8c898, { roughness: 0.5 });
        rail.position.set(sx, 1.95, 10.4);
        rail.castShadow = false;
        g.add(rail);
        for (let i = 0; i < 5; i++) {
            const post = mesh(postGeo, 0xc4a070, { roughness: 0.64 });
            post.position.set(sx, 1.52, 10.4 + (i - 2) * 1.35);
            g.add(post);
        }
    }
    g.add(bridge, sL, sR);

    return g;
}

export function createTree(scale = 1) {
    return createOrganicTree({ tint: 0x2faf3d, scale });
}

export function createCloud() {
    const g = new THREE.Group();
    const mat = pbrMat(0xf4fbff, {
        roughness: 0.92,
        metalness: 0,
        transparent: true,
        opacity: 0.78,
        depthWrite: false
    });
    const a = new THREE.Mesh(geo('cl', () => {
        const s = new THREE.SphereGeometry(1.4, 24, 18);
        const pos = s.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const n = 0.82 + Math.abs(Math.sin(x * 2.2 + y) * Math.cos(z * 2.4)) * 0.28;
            pos.setXYZ(i, x * n, y * (0.74 + n * 0.2), z * n);
        }
        s.computeVertexNormals();
        return s;
    }), mat);
    const b = a.clone();
    b.position.set(1.3, -0.1, 0.2);
    b.scale.setScalar(0.78);
    const c = a.clone();
    c.position.set(-1.1, -0.15, -0.15);
    c.scale.setScalar(0.7);
    g.add(a, b, c);
    g.traverse((o) => {
        if (o.isMesh) {
            o.castShadow = false;
            o.receiveShadow = false;
        }
    });
    return g;
}

/**
 * Sorriso da estrela: os cantos sobem cerca de 11 cm acima do meio.
 */
function starSmileGeometry() {
    const p = [
        [-0.09, 0.035],
        [-0.04, -0.015],
        [0, -0.055],
        [0.04, -0.015],
        [0.09, 0.035],
        [0.09, 0.09],
        [0.04, 0.018],
        [0, -0.022],
        [-0.04, 0.018],
        [-0.09, 0.09]
    ];
    const s = new THREE.Shape();
    s.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length; i++) s.lineTo(p[i][0], p[i][1]);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 0.028,
        bevelEnabled: true,
        bevelThickness: 0.002,
        bevelSize: 0.002,
        bevelSegments: 1,
        curveSegments: 2
    });
    g.translate(0, 0, -0.014);
    return g;
}

export function createStar(color = 0xffe14a) {
    const g = new THREE.Group();
    g.name = 'star';
    const gold = goldMetal();
    const body = mesh(geo('st', () => new THREE.OctahedronGeometry(0.42, 1)), color, {
        map: gold.map,
        roughness: 0.22,
        metalness: 0.7,
        emissive: 0x553300,
        emissiveIntensity: 0.45,
        clearcoat: 0.65
    });
    body.scale.set(1, 1.15, 0.45);
    const arm = body.clone();
    arm.rotation.z = Math.PI / 2;
    arm.scale.set(0.7, 1.4, 0.4);
    const eye = mesh(geo('st-e', () => new THREE.SphereGeometry(0.07, 16, 12)), 0x1a1420, {
        roughness: 0.3
    });
    eye.position.set(-0.1, 0.08, 0.2);
    const eyeR = eye.clone();
    eyeR.position.x = 0.1;
    const smile = mesh(geo('st-s', starSmileGeometry), 0x1a1420, {
        roughness: 0.4
    });
    smile.name = 'starSmile';
    smile.position.set(0, -0.06, 0.22);
    g.add(body, arm, eye, eyeR, smile);
    return g;
}

export function createCoin(red = false) {
    const g = new THREE.Group();
    const color = red ? 0xe23a3a : 0xffe14a;
    const gold = goldMetal();
    const coin = mesh(geo(red ? 'rc' : 'yc', () => new THREE.CylinderGeometry(0.38, 0.38, 0.08, 48)), color, {
        map: red ? null : gold.map,
        roughness: 0.28,
        metalness: red ? 0.55 : 0.8,
        emissive: red ? 0x330000 : 0x442200,
        emissiveIntensity: 0.35,
        clearcoat: 0.55
    });
    coin.rotation.z = Math.PI / 2;
    const rim = mesh(
        geo(red ? 'rr' : 'yr', () => new THREE.TorusGeometry(0.38, 0.04, 12, 48)),
        red ? 0xff8080 : 0xfff3a0,
        { roughness: 0.3, metalness: 0.65, clearcoat: 0.4 }
    );
    rim.rotation.y = Math.PI / 2;
    g.add(coin, rim);
    return g;
}

export function createFungus() {
    const g = new THREE.Group();
    g.name = 'fungus';
    const body = mesh(geo('f-b', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.08, 0),
        new THREE.Vector2(0.28, 0.08),
        new THREE.Vector2(0.38, 0.26),
        new THREE.Vector2(0.26, 0.46),
        new THREE.Vector2(0.12, 0.56)
    ], 22)), 0x5a3a22, { roughness: 0.7 });
    body.position.y = 0.04;
    const cap = mesh(geo('f-c', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.05, 0),
        new THREE.Vector2(0.42, 0.04),
        new THREE.Vector2(0.5, 0.16),
        new THREE.Vector2(0.26, 0.3),
        new THREE.Vector2(0.05, 0.36)
    ], 22)), 0xc45c2a, { roughness: 0.48, clearcoat: 0.2 });
    cap.position.y = 0.5;
    const spot = mesh(geo('f-s', () => new THREE.SphereGeometry(0.08, 12, 10)), 0xf4efe2, {
        roughness: 0.55
    });
    spot.position.set(0.16, 0.74, 0.28);
    const spot2 = spot.clone();
    spot2.position.set(-0.18, 0.7, 0.22);
    const eye = mesh(geo('f-e', () => new THREE.SphereGeometry(0.07, 16, 12)), 0x1a1420, {
        roughness: 0.3,
        clearcoat: 0.6
    });
    eye.position.set(-0.12, 0.36, 0.3);
    const eyeR = eye.clone();
    eyeR.position.x = 0.12;
    const footGeo = limbGeometry({ length: 0.12, r0: 0.07, r1: 0.04, bulge: 0.015, pinch: 0.1, seg: 8 });
    const foot = mesh(geo('f-f', () => footGeo), 0x4a2e18, { roughness: 0.75 });
    foot.position.set(-0.16, 0.12, 0.06);
    foot.rotation.x = 0.4;
    const footR = foot.clone();
    footR.position.x = 0.16;
    g.add(body, cap, spot, spot2, eye, eyeR, foot, footR);
    return g;
}

export function createKingBomb() {
    const g = new THREE.Group();
    g.name = 'king';
    const body = mesh(geo('k-b', () => new THREE.SphereGeometry(1.35, 48, 36)), 0x2a2a32, {
        roughness: 0.35,
        metalness: 0.25,
        clearcoat: 0.55,
        clearcoatRoughness: 0.2
    });
    body.position.y = 1.45;
    const fuse = mesh(geo('k-f', () => new THREE.CylinderGeometry(0.08, 0.08, 0.7, 16)), 0xf4efe2, {
        roughness: 0.8
    });
    fuse.position.set(0, 2.95, 0);
    const spark = mesh(geo('k-s', () => new THREE.SphereGeometry(0.16, 20, 16)), 0xff6b4a, {
        roughness: 0.2,
        emissive: 0x661100,
        emissiveIntensity: 0.8,
        clearcoat: 0.4
    });
    spark.position.set(0, 3.35, 0);
    spark.name = 'spark';
    const gold = goldMetal();
    const crown = mesh(geo('k-c', () => new THREE.LatheGeometry([
        new THREE.Vector2(0.12, 0),
        new THREE.Vector2(0.5, 0.06),
        new THREE.Vector2(0.42, 0.16),
        new THREE.Vector2(0.22, 0.34),
        new THREE.Vector2(0.08, 0.5)
    ], 6)), 0xffe14a, {
        map: gold.map,
        roughness: 0.25,
        metalness: 0.75,
        emissive: 0x442200,
        emissiveIntensity: 0.35
    });
    crown.position.set(0, 2.55, 0);
    const eye = mesh(geo('k-e', () => new THREE.SphereGeometry(0.18, 20, 16)), 0xf4efe2, {
        roughness: 0.2,
        clearcoat: 0.9
    });
    eye.position.set(-0.38, 1.7, 1.1);
    const eyeR = eye.clone();
    eyeR.position.x = 0.38;
    const pupil = mesh(geo('k-p', () => new THREE.SphereGeometry(0.08, 16, 12)), 0x1a1420, {
        roughness: 0.35
    });
    pupil.position.set(-0.38, 1.68, 1.24);
    const pupilR = pupil.clone();
    pupilR.position.x = 0.38;
    const armGeo = limbGeometry({ length: 0.85, r0: 0.22, r1: 0.14, bulge: 0.06, bulgeAt: 0.32, seg: 12 });
    const arm = mesh(geo('k-a', () => armGeo), 0x2a2a32, {
        roughness: 0.4,
        clearcoat: 0.4
    });
    arm.position.set(-1.05, 1.85, 0.15);
    arm.rotation.z = -0.85;
    const armR = arm.clone();
    armR.position.x = 1.05;
    armR.rotation.z = 0.85;
    const footGeo = limbGeometry({ length: 0.55, r0: 0.24, r1: 0.14, bulge: 0.05, pinch: 0.12, seg: 10 });
    const foot = mesh(geo('k-ft', () => footGeo), 0x1a1a22, { roughness: 0.55 });
    foot.position.set(-0.5, 0.28, 0.05);
    foot.rotation.x = -Math.PI / 2;
    const footR = foot.clone();
    footR.position.x = 0.5;
    g.add(body, fuse, spark, crown, eye, eyeR, pupil, pupilR, arm, armR, foot, footR);
    return g;
}

export function createCannon() {
    const g = new THREE.Group();
    const base = mesh(geo('cn-b', () => new THREE.CylinderGeometry(0.7, 0.9, 0.55, 32)), 0x3a3a44, {
        roughness: 0.45,
        metalness: 0.55
    });
    base.position.y = 0.28;
    const barrel = mesh(geo('cn-r', () => new THREE.CylinderGeometry(0.42, 0.5, 2.4, 32)), 0x2a2a32, {
        roughness: 0.38,
        metalness: 0.6,
        clearcoat: 0.25
    });
    barrel.rotation.x = -Math.PI / 2.6;
    barrel.position.set(0, 1.15, 0.55);
    barrel.name = 'barrel';
    const gold = goldMetal();
    const rim = mesh(geo('cn-m', () => new THREE.TorusGeometry(0.44, 0.08, 16, 40)), 0xffe14a, {
        map: gold.map,
        roughness: 0.3,
        metalness: 0.75
    });
    rim.rotation.x = Math.PI / 2.6;
    rim.position.set(0, 1.72, 1.55);
    g.add(base, barrel, rim);
    return g;
}

export function createFlag() {
    const g = new THREE.Group();
    const pole = mesh(geo('fl-p', () => new THREE.CylinderGeometry(0.05, 0.06, 3.2, 16)), 0xf4efe2, {
        roughness: 0.4,
        metalness: 0.35
    });
    pole.position.y = 1.6;
    const cloth = mesh(geo('fl-c', () => {
        const clothGeo = new THREE.PlaneGeometry(1.15, 0.7, 12, 6);
        const cp = clothGeo.attributes.position;
        for (let i = 0; i < cp.count; i++) {
            const x = cp.getX(i);
            const y = cp.getY(i);
            const along = (x + 0.575) / 1.15;
            const wave = Math.sin(along * Math.PI * 2.4) * 0.07 * along;
            const droop = along * along * 0.06;
            cp.setXYZ(i, x, y - droop, wave);
        }
        clothGeo.computeVertexNormals();
        return clothGeo;
    }), 0xff6b4a, {
        roughness: 0.72,
        side: THREE.DoubleSide
    });
    cloth.position.set(0.55, 2.7, 0);
    cloth.name = 'cloth';
    const gold = goldMetal();
    const emblem = mesh(geo('fl-s', () => new THREE.OctahedronGeometry(0.16, 1)), 0xffe14a, {
        map: gold.map,
        roughness: 0.25,
        metalness: 0.7
    });
    emblem.position.set(0.55, 2.7, 0.06);
    g.add(pole, cloth, emblem);
    return g;
}

export function createPlatform(w, h, d, color = 0xc4783a) {
    const m = mesh(new THREE.BoxGeometry(w, h, d, 2, 1, 2), color, {
        roughness: 0.68,
        metalness: 0.05
    });
    m.receiveShadow = true;
    return m;
}

export function createBush() {
    const g = new THREE.Group();
    const leaf = leafCanopy();
    const a = mesh(geo('bush', () => {
        const s = new THREE.SphereGeometry(0.7, 20, 16);
        const pos = s.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const y = pos.getY(i);
            const z = pos.getZ(i);
            const n = 0.78 + Math.abs(Math.sin(x * 4.2 + y * 2.1) * Math.cos(z * 3.6)) * 0.36;
            pos.setXYZ(i, x * n, y * n * 0.9, z * n);
        }
        s.computeVertexNormals();
        return s;
    }), 0x2a9a3a, {
        map: leaf.map,
        normalMap: leaf.normalMap,
        roughness: 0.65
    });
    a.scale.set(1.2, 0.75, 1);
    a.position.y = 0.45;
    const b = a.clone();
    b.position.set(0.45, 0.35, 0.1);
    b.scale.setScalar(0.7);
    g.add(a, b);
    return g;
}
