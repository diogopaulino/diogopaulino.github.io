/**
 * Modelos PBR hiper-realistas — MeshPhysical/Standard, clearcoat no casco,
 * texturas procedurais e silhuetas suaves. Sem glTF.
 */

import * as THREE from 'three';
import { shellArmor, barkTexture, leafTexture, templeStone } from './textures.js';

const geoCache = new Map();
function geo(key, factory) {
    if (!geoCache.has(key)) geoCache.set(key, factory());
    return geoCache.get(key);
}

export const pbrMaterials = [];
/** @deprecated alias — prefer pbrMat */
export const retroMaterials = pbrMaterials;

/**
 * Material PBR padrão do lab.
 * Organic: roughness 0.35–0.65, metalness baixo.
 * Shell/molhado: clearcoat via MeshPhysicalMaterial.
 */
export function pbrMat(color, {
    roughness = 0.52,
    metalness = 0.08,
    clearcoat = 0,
    clearcoatRoughness = 0.28,
    emissive = 0x000000,
    emissiveIntensity = 0,
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
export const retroMat = pbrMat;

export function setSnap() {}
export function setSnapAspect() {}

function mesh(geometry, color, extras) {
    const m = new THREE.Mesh(geometry, pbrMat(color, extras));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

/** Tatu-bola: casco com clearcoat, focinho e a bola do rolamento. */
export function createTatu() {
    const root = new THREE.Group();
    root.name = 'tatu';
    const shell = shellArmor();

    const body = new THREE.Group();
    body.name = 'body';
    const shellMesh = mesh(geo('tatu-shell', () => new THREE.SphereGeometry(0.55, 48, 36)), 0xf0b44a, {
        map: shell.map,
        normalMap: shell.normalMap,
        roughnessMap: shell.roughnessMap,
        roughness: 0.42,
        metalness: 0.12,
        clearcoat: 0.55,
        clearcoatRoughness: 0.22
    });
    shellMesh.scale.set(1.15, 0.85, 1.35);
    body.add(shellMesh);

    const bandGeo = geo('tatu-band', () => new THREE.TorusGeometry(0.52, 0.07, 20, 48));
    for (let i = -1; i <= 1; i++) {
        const band = new THREE.Mesh(bandGeo, pbrMat(0x8a5a28, { roughness: 0.58, metalness: 0.05 }));
        band.rotation.y = Math.PI / 2;
        band.position.z = i * 0.22;
        band.scale.set(1.05, 0.85, 1);
        band.castShadow = true;
        body.add(band);
    }

    const belly = mesh(geo('tatu-belly', () => new THREE.SphereGeometry(0.42, 40, 32)), 0xf3e2c0, {
        roughness: 0.62,
        metalness: 0.04
    });
    belly.position.y = -0.12;
    belly.scale.set(0.95, 0.55, 1.1);
    body.add(belly);
    body.position.y = 0.52;
    root.add(body);

    const head = new THREE.Group();
    head.name = 'head';
    head.position.set(0, 0.58, 0.58);
    const skull = mesh(geo('tatu-head', () => new THREE.SphereGeometry(0.28, 40, 32)), 0xe8c888, {
        roughness: 0.55
    });
    skull.scale.set(0.9, 0.85, 1.15);
    head.add(skull);
    const snout = mesh(geo('tatu-snout', () => new THREE.ConeGeometry(0.14, 0.32, 32)), 0xdcb070, {
        roughness: 0.58
    });
    snout.rotation.x = Math.PI / 2;
    snout.position.z = 0.28;
    head.add(snout);
    const nose = mesh(geo('tatu-nose', () => new THREE.SphereGeometry(0.07, 24, 20)), 0x2a1810, {
        roughness: 0.7
    });
    nose.position.z = 0.44;
    head.add(nose);

    const earGeo = geo('tatu-ear', () => new THREE.ConeGeometry(0.08, 0.18, 24));
    const earL = new THREE.Mesh(earGeo, pbrMat(0xc48a48, { roughness: 0.6 }));
    const earR = earL.clone();
    earL.position.set(-0.16, 0.22, -0.04);
    earR.position.set(0.16, 0.22, -0.04);
    earL.rotation.z = 0.45;
    earR.rotation.z = -0.45;
    head.add(earL, earR);

    const eyeGeo = geo('tatu-eye', () => new THREE.SphereGeometry(0.07, 24, 20));
    const eyeL = new THREE.Mesh(eyeGeo, pbrMat(0xfff6e8, {
        roughness: 0.18,
        metalness: 0.05,
        clearcoat: 0.85,
        clearcoatRoughness: 0.08
    }));
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.12, 0.08, 0.2);
    eyeR.position.set(0.12, 0.08, 0.2);
    const pupilGeo = geo('tatu-pupil', () => new THREE.SphereGeometry(0.035, 20, 16));
    const pL = new THREE.Mesh(pupilGeo, pbrMat(0x1a1018, { roughness: 0.35 }));
    const pR = pL.clone();
    pL.position.z = 0.045;
    pR.position.z = 0.045;
    eyeL.add(pL);
    eyeR.add(pR);
    eyeL.name = 'eyeL';
    eyeR.name = 'eyeR';
    head.add(eyeL, eyeR);
    root.add(head);

    const legs = new THREE.Group();
    legs.name = 'legs';
    const legGeo = geo('tatu-leg', () => new THREE.CylinderGeometry(0.08, 0.1, 0.28, 24));
    const footGeo = geo('tatu-foot', () => new THREE.BoxGeometry(0.16, 0.07, 0.2, 2, 2, 2));
    const spots = [
        [-0.28, 0.16, 0.28],
        [0.28, 0.16, 0.28],
        [-0.28, 0.16, -0.28],
        [0.28, 0.16, -0.28]
    ];
    spots.forEach(([x, y, z], i) => {
        const g = new THREE.Group();
        g.name = `leg${i}`;
        g.position.set(x, y, z);
        const limb = new THREE.Mesh(legGeo, pbrMat(0xc48a40, { roughness: 0.58 }));
        const foot = new THREE.Mesh(footGeo, pbrMat(0x3a2418, { roughness: 0.72 }));
        foot.position.y = -0.16;
        limb.castShadow = true;
        foot.castShadow = true;
        g.add(limb, foot);
        legs.add(g);
    });
    root.add(legs);

    const tail = mesh(geo('tatu-tail', () => new THREE.ConeGeometry(0.08, 0.42, 24)), 0xb07838, {
        roughness: 0.55
    });
    tail.position.set(0, 0.42, -0.72);
    tail.rotation.x = -1.15;
    tail.name = 'tail';
    root.add(tail);

    const ball = mesh(geo('tatu-ball', () => new THREE.SphereGeometry(0.58, 48, 36)), 0xf0b44a, {
        map: shell.map,
        normalMap: shell.normalMap,
        roughnessMap: shell.roughnessMap,
        roughness: 0.4,
        clearcoat: 0.6,
        clearcoatRoughness: 0.2
    });
    ball.name = 'ball';
    ball.visible = false;
    ball.position.y = 0.58;
    const stripe = mesh(geo('tatu-stripe', () => new THREE.TorusGeometry(0.5, 0.08, 20, 48)), 0x8a5a28, {
        roughness: 0.55
    });
    stripe.rotation.y = Math.PI / 2;
    ball.add(stripe);
    root.add(ball);

    const shadow = new THREE.Mesh(
        geo('blob', () => new THREE.CircleGeometry(0.55, 48)),
        pbrMat(0x1a1010, { transparent: true, opacity: 0.32, depthWrite: false, roughness: 1 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.03;
    shadow.name = 'blob';
    shadow.castShadow = false;
    root.add(shadow);

    return root;
}

export function createCrystal(color = 0x7af0ff) {
    const g = new THREE.Group();
    const core = mesh(geo('crystal', () => new THREE.OctahedronGeometry(0.42, 5)), color, {
        roughness: 0.12,
        metalness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        transmission: 0.35,
        ior: 1.55,
        emissive: color,
        emissiveIntensity: 0.45
    });
    g.add(core);
    const inner = mesh(geo('crystal-in', () => new THREE.OctahedronGeometry(0.22, 5)), 0xffffff, {
        roughness: 0.08,
        metalness: 0.05,
        clearcoat: 1,
        emissive: 0xffffff,
        emissiveIntensity: 0.3
    });
    g.add(inner);
    return g;
}

export function createCaju() {
    const g = new THREE.Group();
    const fruit = mesh(geo('caju', () => new THREE.SphereGeometry(0.18, 32, 28)), 0xff7a32, {
        roughness: 0.45,
        clearcoat: 0.35,
        clearcoatRoughness: 0.3
    });
    fruit.scale.set(0.85, 1.15, 0.85);
    g.add(fruit);
    const nut = mesh(geo('caju-nut', () => new THREE.SphereGeometry(0.08, 28, 24)), 0x8a4a18, {
        roughness: 0.7
    });
    nut.position.y = 0.2;
    g.add(nut);
    return g;
}

export function createCrate() {
    const wood = templeStone({ repeat: [1, 1] });
    const box = mesh(geo('crate', () => new THREE.BoxGeometry(0.95, 0.95, 0.95, 4, 4, 4)), 0xc48a3a, {
        map: wood.map,
        normalMap: wood.normalMap,
        roughnessMap: wood.roughnessMap,
        roughness: 0.72,
        metalness: 0.04
    });
    const mark = mesh(geo('crate-x', () => new THREE.BoxGeometry(0.7, 0.08, 0.08)), 0x5a3010, {
        roughness: 0.65
    });
    const mark2 = mark.clone();
    mark.position.z = 0.48;
    mark2.position.z = 0.48;
    mark2.rotation.z = Math.PI / 2;
    box.add(mark, mark2);
    return box;
}

export function createCrab() {
    const g = new THREE.Group();
    const body = mesh(geo('crab', () => new THREE.SphereGeometry(0.38, 40, 32)), 0xe24a3a, {
        roughness: 0.4,
        clearcoat: 0.45,
        clearcoatRoughness: 0.25
    });
    body.scale.set(1.3, 0.55, 1);
    body.position.y = 0.28;
    g.add(body);
    const eyeGeo = geo('crab-eye', () => new THREE.SphereGeometry(0.07, 20, 16));
    for (const x of [-0.16, 0.16]) {
        const stalk = mesh(geo('crab-stalk', () => new THREE.CylinderGeometry(0.03, 0.03, 0.22, 16)), 0xe24a3a, {
            roughness: 0.5
        });
        stalk.position.set(x, 0.48, 0.12);
        const eye = new THREE.Mesh(eyeGeo, pbrMat(0x1a1018, { roughness: 0.3, clearcoat: 0.7 }));
        eye.position.y = 0.14;
        stalk.add(eye);
        g.add(stalk);
    }
    const claw = geo('crab-claw', () => new THREE.BoxGeometry(0.22, 0.1, 0.28, 2, 2, 2));
    const cL = new THREE.Mesh(claw, pbrMat(0xc83a2a, { roughness: 0.42, clearcoat: 0.35 }));
    const cR = cL.clone();
    cL.position.set(-0.42, 0.28, 0.18);
    cR.position.set(0.42, 0.28, 0.18);
    g.add(cL, cR);
    return g;
}

export function createBat() {
    const g = new THREE.Group();
    const body = mesh(geo('bat', () => new THREE.SphereGeometry(0.22, 32, 28)), 0x3a2458, {
        roughness: 0.65
    });
    g.add(body);
    const wingGeo = geo('bat-wing', () => new THREE.ConeGeometry(0.42, 0.08, 24));
    const wL = new THREE.Mesh(wingGeo, pbrMat(0x5a3878, { roughness: 0.55, side: THREE.DoubleSide }));
    const wR = wL.clone();
    wL.name = 'wingL';
    wR.name = 'wingR';
    wL.rotation.set(0, 0, 1.2);
    wR.rotation.set(0, 0, -1.2);
    wL.position.set(-0.28, 0, 0);
    wR.position.set(0.28, 0, 0);
    g.add(wL, wR);
    const fang = mesh(geo('bat-fang', () => new THREE.ConeGeometry(0.05, 0.12, 16)), 0xf4e8d0, {
        roughness: 0.35
    });
    fang.position.set(0, -0.12, 0.14);
    fang.rotation.x = Math.PI;
    g.add(fang);
    return g;
}

export function createPlant() {
    const g = new THREE.Group();
    const stem = mesh(geo('plant-stem', () => new THREE.CylinderGeometry(0.08, 0.12, 0.7, 24)), 0x2e8a3a, {
        roughness: 0.7
    });
    stem.position.y = 0.35;
    g.add(stem);
    const head = new THREE.Group();
    head.name = 'jaw';
    head.position.y = 0.78;
    const jaw = mesh(
        geo('plant-jaw', () => new THREE.SphereGeometry(0.32, 40, 32, 0, Math.PI * 2, 0, Math.PI * 0.6)),
        0xc83a5a,
        { roughness: 0.48, clearcoat: 0.25 }
    );
    jaw.rotation.x = 0.4;
    const jaw2 = jaw.clone();
    jaw2.rotation.x = Math.PI + 0.4;
    head.add(jaw, jaw2);
    g.add(head);
    return g;
}

export function createPalm() {
    const g = new THREE.Group();
    const bark = barkTexture();
    const leaf = leafTexture();
    const trunk = mesh(geo('palm-trunk', () => new THREE.CylinderGeometry(0.18, 0.28, 3.4, 32)), 0x8a5a28, {
        map: bark.map,
        normalMap: bark.normalMap,
        roughness: 0.88,
        metalness: 0.02
    });
    trunk.position.y = 1.7;
    g.add(trunk);
    const leafGeo = geo('palm-leaf', () => new THREE.ConeGeometry(0.55, 1.6, 24));
    for (let i = 0; i < 5; i++) {
        const frond = new THREE.Mesh(leafGeo, pbrMat(0x2e9a48, {
            map: leaf.map,
            normalMap: leaf.normalMap,
            roughness: 0.55,
            metalness: 0.02,
            side: THREE.DoubleSide
        }));
        frond.position.set(0, 3.3, 0);
        frond.rotation.set(0.85, (i / 5) * Math.PI * 2, 0);
        frond.castShadow = true;
        g.add(frond);
    }
    const coco = mesh(geo('coco', () => new THREE.SphereGeometry(0.16, 28, 24)), 0x6a3a18, {
        roughness: 0.82
    });
    coco.position.set(0.2, 3.15, 0.1);
    g.add(coco);
    return g;
}

export function createIdol() {
    const g = new THREE.Group();
    const stone = templeStone();
    const base = mesh(geo('idol-base', () => new THREE.CylinderGeometry(0.7, 0.85, 0.28, 48)), 0xc9a24a, {
        map: stone.map,
        normalMap: stone.normalMap,
        roughnessMap: stone.roughnessMap,
        roughness: 0.55,
        metalness: 0.25
    });
    base.position.y = 0.14;
    g.add(base);
    const body = mesh(geo('idol-body', () => new THREE.CylinderGeometry(0.32, 0.48, 1.1, 48)), 0xe8c85a, {
        map: stone.map,
        normalMap: stone.normalMap,
        roughness: 0.48,
        metalness: 0.3
    });
    body.position.y = 0.85;
    g.add(body);
    const head = mesh(geo('idol-head', () => new THREE.BoxGeometry(0.7, 0.55, 0.55, 2, 2, 2)), 0xffe07a, {
        roughness: 0.42,
        metalness: 0.35
    });
    head.position.y = 1.55;
    g.add(head);
    const gem = mesh(geo('idol-gem', () => new THREE.OctahedronGeometry(0.18, 5)), 0xff3d8a, {
        roughness: 0.1,
        metalness: 0.2,
        clearcoat: 1,
        transmission: 0.25,
        emissive: 0xff3d8a,
        emissiveIntensity: 0.5
    });
    gem.position.set(0, 1.55, 0.3);
    gem.name = 'gem';
    g.add(gem);
    return g;
}

export function createCloud() {
    const g = new THREE.Group();
    const puffs = [
        [0, 0, 0, 1.4],
        [1.1, 0.15, 0.2, 1],
        [-1, 0.1, -0.15, 0.95],
        [0.3, 0.35, -0.4, 0.8]
    ];
    const sph = geo('cloud', () => new THREE.SphereGeometry(0.7, 40, 32));
    const mat = pbrMat(0xfff4e8, {
        roughness: 0.85,
        metalness: 0,
        transparent: true,
        opacity: 0.72,
        depthWrite: false
    });
    for (const [x, y, z, s] of puffs) {
        const m = new THREE.Mesh(sph, mat);
        m.position.set(x, y, z);
        m.scale.setScalar(s);
        m.castShadow = false;
        g.add(m);
    }
    return g;
}

export function createBoat() {
    const g = new THREE.Group();
    const hull = mesh(geo('boat', () => new THREE.BoxGeometry(1.8, 0.35, 0.7, 2, 2, 2)), 0x8a4a22, {
        roughness: 0.75
    });
    hull.position.y = 0.2;
    g.add(hull);
    const mast = mesh(geo('mast', () => new THREE.CylinderGeometry(0.04, 0.04, 1.4, 16)), 0xd8c8a0, {
        roughness: 0.6
    });
    mast.position.y = 1;
    g.add(mast);
    const sail = mesh(geo('sail', () => new THREE.PlaneGeometry(0.7, 0.9, 12, 12)), 0xf4e8c8, {
        roughness: 0.9,
        side: THREE.DoubleSide
    });
    sail.position.set(0.12, 0.95, 0);
    g.add(sail);
    return g;
}

export function createPopupSprite(text, color = '#7af0ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 28px Outfit, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1a1018';
    ctx.lineWidth = 6;
    ctx.strokeText(text, 128, 32);
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(2.4, 0.6, 1);
    return s;
}
