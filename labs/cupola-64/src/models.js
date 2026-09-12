/**
 * Modelos PBR hiper-realistas — MeshPhysical/Standard, clearcoat em
 * superfícies molhadas/metálicas, geometria suave. Nico, castelo, árvores,
 * estrelas, moedas, fungos e a bomba-rei.
 */

import * as THREE from 'three';
import { peachStone, barkTexture, leafCanopy, fabricTeal, goldMetal } from './textures.js';

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

    const torso = mesh(geo('n-torso', () => new THREE.SphereGeometry(0.38, 32, 24)), 0x2a9a8c, {
        map: fabric.map,
        roughness: 0.55,
        metalness: 0.04
    });
    torso.scale.set(0.92, 1.05, 0.78);
    torso.position.y = 0.42;
    hips.add(torso);

    const shirt = mesh(geo('n-shirt', () => new THREE.SphereGeometry(0.28, 32, 24)), 0xffe6c8, {
        roughness: 0.62
    });
    shirt.scale.set(1.05, 0.7, 0.9);
    shirt.position.y = 0.62;
    hips.add(shirt);

    const strapL = mesh(geo('n-strap', () => new THREE.BoxGeometry(0.1, 0.42, 0.08, 2, 2, 2)), 0x1f7a70, {
        roughness: 0.58
    });
    strapL.position.set(-0.16, 0.58, 0.22);
    const strapR = strapL.clone();
    strapR.position.x = 0.16;
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

    const skull = mesh(geo('n-head', () => new THREE.SphereGeometry(0.34, 40, 32)), 0xffd4a8, {
        roughness: 0.55
    });
    head.add(skull);

    const cap = mesh(
        geo('n-cap', () => new THREE.SphereGeometry(0.36, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        0xff6b4a,
        { roughness: 0.48, clearcoat: 0.2 }
    );
    cap.position.y = 0.08;
    cap.rotation.x = -0.12;
    head.add(cap);

    const visor = mesh(geo('n-visor', () => new THREE.BoxGeometry(0.42, 0.06, 0.28, 2, 2, 2)), 0xff6b4a, {
        roughness: 0.45
    });
    visor.position.set(0, 0.08, 0.28);
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

    const eyeGeo = geo('n-eye', () => new THREE.SphereGeometry(0.07, 20, 16));
    const eyeL = new THREE.Mesh(eyeGeo, pbrMat(0x1a1420, { roughness: 0.25, clearcoat: 0.8 }));
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.11, 0.02, 0.28);
    eyeR.position.set(0.11, 0.02, 0.28);
    const shineL = mesh(geo('n-shine', () => new THREE.SphereGeometry(0.025, 12, 10)), 0xffffff, {
        roughness: 0.1,
        metalness: 0.05
    });
    shineL.position.set(-0.09, 0.05, 0.33);
    const shineR = shineL.clone();
    shineR.position.x = 0.13;
    head.add(eyeL, eyeR, shineL, shineR);

    const nose = mesh(geo('n-nose', () => new THREE.SphereGeometry(0.08, 20, 16)), 0xf0b090, {
        roughness: 0.58
    });
    nose.scale.set(0.8, 0.7, 1.15);
    nose.position.set(0, -0.04, 0.32);
    head.add(nose);

    const armL = new THREE.Group();
    armL.name = 'armL';
    armL.position.set(-0.4, 0.55, 0);
    const armR = new THREE.Group();
    armR.name = 'armR';
    armR.position.set(0.4, 0.55, 0);
    const limb = geo('n-arm', () => new THREE.CapsuleGeometry(0.09, 0.28, 8, 16));
    const aL = new THREE.Mesh(limb, pbrMat(0xffe6c8, { roughness: 0.6 }));
    aL.rotation.z = 0.35;
    aL.position.y = -0.18;
    aL.castShadow = true;
    const aR = aL.clone();
    aR.rotation.z = -0.35;
    const glove = mesh(geo('n-glove', () => new THREE.SphereGeometry(0.12, 20, 16)), 0xf4efe2, {
        roughness: 0.65
    });
    glove.position.set(-0.12, -0.38, 0.02);
    const gloveR = glove.clone();
    gloveR.position.x = 0.12;
    armL.add(aL, glove);
    armR.add(aR, gloveR);
    hips.add(armL, armR);

    const legL = new THREE.Group();
    legL.name = 'legL';
    legL.position.set(-0.14, 0.08, 0);
    const legR = new THREE.Group();
    legR.name = 'legR';
    legR.position.set(0.14, 0.08, 0);
    const thigh = new THREE.Mesh(
        geo('n-leg', () => new THREE.CapsuleGeometry(0.11, 0.22, 8, 16)),
        pbrMat(0x2a9a8c, { map: fabric.map, roughness: 0.55 })
    );
    thigh.position.y = -0.18;
    thigh.castShadow = true;
    const thighR = thigh.clone();
    const shoe = mesh(geo('n-shoe', () => new THREE.BoxGeometry(0.22, 0.12, 0.34, 2, 2, 2)), 0x3a2418, {
        roughness: 0.75
    });
    shoe.position.set(0, -0.38, 0.06);
    const shoeR = shoe.clone();
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

export function createCastle() {
    const g = new THREE.Group();
    g.name = 'castle';
    const stone = peachStone();
    const gold = goldMetal();

    const keep = mesh(geo('c-keep', () => new THREE.BoxGeometry(10, 7.2, 8.4, 4, 4, 4)), 0xf3c4b4, {
        map: stone.map,
        normalMap: stone.normalMap,
        roughnessMap: stone.roughnessMap,
        roughness: 0.68,
        metalness: 0.05
    });
    keep.position.y = 3.6;
    g.add(keep);

    const trim = mesh(geo('c-trim', () => new THREE.BoxGeometry(10.4, 0.45, 8.8, 2, 1, 2)), 0xe8a898, {
        normalMap: stone.normalMap,
        roughness: 0.55
    });
    trim.position.y = 7.15;
    g.add(trim);

    for (const sx of [-4.6, 4.6]) {
        const tower = mesh(geo('c-tow', () => new THREE.CylinderGeometry(1.55, 1.7, 9.2, 48)), 0xf7d0c2, {
            map: stone.map,
            normalMap: stone.normalMap,
            roughnessMap: stone.roughnessMap,
            roughness: 0.65
        });
        tower.position.set(sx, 4.6, -2.2);
        const roof = mesh(geo('c-roof', () => new THREE.ConeGeometry(2.15, 2.6, 32)), 0xc45c6a, {
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

    const gate = mesh(geo('c-gate', () => new THREE.BoxGeometry(2.6, 3.4, 0.4, 2, 2, 1)), 0x4a2a38, {
        roughness: 0.78
    });
    gate.position.set(0, 1.7, 4.25);
    const arch = mesh(geo('c-arch', () => new THREE.BoxGeometry(3.4, 0.55, 0.5)), 0xffe14a, {
        map: gold.map,
        roughness: 0.3,
        metalness: 0.7,
        emissive: 0x332200,
        emissiveIntensity: 0.2
    });
    arch.position.set(0, 3.55, 4.3);
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
    const spire = mesh(geo('c-spire', () => new THREE.ConeGeometry(0.45, 2.2, 24)), 0xc45c6a, {
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

    const steps = mesh(geo('c-steps', () => new THREE.BoxGeometry(4.4, 0.7, 3.2, 2, 1, 2)), 0xe8d4c4, {
        normalMap: stone.normalMap,
        roughness: 0.7
    });
    steps.position.set(0, 0.35, 6.2);
    g.add(steps);

    const bridge = mesh(geo('c-br', () => new THREE.BoxGeometry(3.2, 0.28, 6.5, 2, 1, 2)), 0xd2b48c, {
        roughness: 0.78
    });
    bridge.position.set(0, 1.42, 10.4);
    g.add(bridge);

    return g;
}

export function createTree(scale = 1) {
    const g = new THREE.Group();
    const bark = barkTexture();
    const leaf = leafCanopy();
    const trunk = mesh(geo('t-tr', () => new THREE.CylinderGeometry(0.22, 0.32, 1.6, 24)), 0x7a4a28, {
        map: bark.map,
        normalMap: bark.normalMap,
        roughness: 0.9
    });
    trunk.position.y = 0.8;
    const canopy = mesh(geo('t-lf', () => new THREE.SphereGeometry(1.05, 32, 24)), 0x2faf3d, {
        map: leaf.map,
        normalMap: leaf.normalMap,
        roughness: 0.62
    });
    canopy.position.y = 2.15;
    canopy.scale.set(1, 0.85, 1);
    const leaf2 = canopy.clone();
    leaf2.scale.setScalar(0.7);
    leaf2.position.set(0.55, 1.7, 0.2);
    g.add(trunk, canopy, leaf2);
    g.scale.setScalar(scale);
    return g;
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
    const a = new THREE.Mesh(geo('cl', () => new THREE.SphereGeometry(1.4, 32, 24)), mat);
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
    const smile = mesh(geo('st-s', () => new THREE.BoxGeometry(0.16, 0.04, 0.04)), 0x1a1420, {
        roughness: 0.4
    });
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
    const body = mesh(geo('f-b', () => new THREE.SphereGeometry(0.38, 32, 24)), 0x5a3a22, {
        roughness: 0.7
    });
    body.scale.set(1, 0.85, 1);
    body.position.y = 0.34;
    const cap = mesh(
        geo('f-c', () => new THREE.SphereGeometry(0.48, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.55)),
        0xc45c2a,
        { roughness: 0.48, clearcoat: 0.2 }
    );
    cap.position.y = 0.62;
    const spot = mesh(geo('f-s', () => new THREE.SphereGeometry(0.1, 16, 12)), 0xf4efe2, {
        roughness: 0.55
    });
    spot.position.set(0.18, 0.78, 0.28);
    const spot2 = spot.clone();
    spot2.position.set(-0.2, 0.72, 0.22);
    const eye = mesh(geo('f-e', () => new THREE.SphereGeometry(0.07, 16, 12)), 0x1a1420, {
        roughness: 0.3,
        clearcoat: 0.6
    });
    eye.position.set(-0.12, 0.38, 0.3);
    const eyeR = eye.clone();
    eyeR.position.x = 0.12;
    const foot = mesh(geo('f-f', () => new THREE.SphereGeometry(0.14, 20, 14)), 0x4a2e18, {
        roughness: 0.75
    });
    foot.position.set(-0.16, 0.1, 0.08);
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
    const crown = mesh(geo('k-c', () => new THREE.ConeGeometry(0.55, 0.55, 24)), 0xffe14a, {
        map: gold.map,
        roughness: 0.25,
        metalness: 0.75,
        emissive: 0x442200,
        emissiveIntensity: 0.35
    });
    crown.position.set(0, 2.7, 0);
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
    const arm = mesh(geo('k-a', () => new THREE.SphereGeometry(0.32, 24, 18)), 0x2a2a32, {
        roughness: 0.4,
        clearcoat: 0.4
    });
    arm.position.set(-1.4, 1.4, 0.2);
    const armR = arm.clone();
    armR.position.x = 1.4;
    const foot = mesh(geo('k-ft', () => new THREE.SphereGeometry(0.38, 24, 18)), 0x1a1a22, {
        roughness: 0.55
    });
    foot.position.set(-0.55, 0.32, 0.35);
    const footR = foot.clone();
    footR.position.x = 0.55;
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
    const cloth = mesh(geo('fl-c', () => new THREE.BoxGeometry(1.15, 0.7, 0.06, 4, 4, 1)), 0xff6b4a, {
        roughness: 0.72
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
    const a = mesh(geo('bush', () => new THREE.SphereGeometry(0.7, 28, 22)), 0x2a9a3a, {
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
