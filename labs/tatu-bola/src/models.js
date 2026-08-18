/**
 * Modelos low-poly no espírito PS1 (1996–99): poucas faces, Lambert flat,
 * vertex snap no clip space. Nenhum glTF — a silhueta é o personagem.
 */

import * as THREE from 'three';

const geoCache = new Map();
function geo(key, factory) {
    if (!geoCache.has(key)) geoCache.set(key, factory());
    return geoCache.get(key);
}

export const retroMaterials = [];

export function retroMat(color, { snap, ...props } = {}) {
    const mat = new THREE.MeshLambertMaterial({
        color,
        flatShading: true,
        ...props
    });
    mat.userData.retro = true;
    retroMaterials.push(mat);
    return mat;
}

export function setSnap(value) {}
export function setSnapAspect(aspect) {}

function mesh(geometry, color, extras) {
    const m = new THREE.Mesh(geometry, retroMat(color, extras));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

/** Tatu-bola: três faixas, focinho e a bola que aparece no rolamento. */
export function createTatu() {
    const root = new THREE.Group();
    root.name = 'tatu';

    const body = new THREE.Group();
    body.name = 'body';
    const shell = mesh(geo('tatu-shell', () => new THREE.SphereGeometry(0.55, 7, 5)), 0xf0b44a);
    shell.scale.set(1.15, 0.85, 1.35);
    body.add(shell);

    const bandGeo = geo('tatu-band', () => new THREE.TorusGeometry(0.52, 0.07, 5, 10));
    for (let i = -1; i <= 1; i++) {
        const band = new THREE.Mesh(bandGeo, retroMat(0x8a5a28));
        band.rotation.y = Math.PI / 2;
        band.position.z = i * 0.22;
        band.scale.set(1.05, 0.85, 1);
        body.add(band);
    }

    const belly = mesh(geo('tatu-belly', () => new THREE.SphereGeometry(0.42, 6, 4)), 0xf3e2c0);
    belly.position.y = -0.12;
    belly.scale.set(0.95, 0.55, 1.1);
    body.add(belly);
    body.position.y = 0.52;
    root.add(body);

    const head = new THREE.Group();
    head.name = 'head';
    head.position.set(0, 0.58, 0.58);
    const skull = mesh(geo('tatu-head', () => new THREE.SphereGeometry(0.28, 6, 5)), 0xe8c888);
    skull.scale.set(0.9, 0.85, 1.15);
    head.add(skull);
    const snout = mesh(geo('tatu-snout', () => new THREE.ConeGeometry(0.14, 0.32, 5)), 0xdcb070);
    snout.rotation.x = Math.PI / 2;
    snout.position.z = 0.28;
    head.add(snout);
    const nose = mesh(geo('tatu-nose', () => new THREE.SphereGeometry(0.07, 5, 4)), 0x2a1810);
    nose.position.z = 0.44;
    head.add(nose);

    const earGeo = geo('tatu-ear', () => new THREE.ConeGeometry(0.08, 0.18, 4));
    const earL = new THREE.Mesh(earGeo, retroMat(0xc48a48));
    const earR = earL.clone();
    earL.position.set(-0.16, 0.22, -0.04);
    earR.position.set(0.16, 0.22, -0.04);
    earL.rotation.z = 0.45;
    earR.rotation.z = -0.45;
    head.add(earL, earR);

    const eyeGeo = geo('tatu-eye', () => new THREE.SphereGeometry(0.07, 5, 4));
    const eyeL = new THREE.Mesh(eyeGeo, retroMat(0xfff6e8));
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.12, 0.08, 0.2);
    eyeR.position.set(0.12, 0.08, 0.2);
    const pupilGeo = geo('tatu-pupil', () => new THREE.SphereGeometry(0.035, 4, 3));
    const pL = new THREE.Mesh(pupilGeo, retroMat(0x1a1018));
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
    const legGeo = geo('tatu-leg', () => new THREE.CylinderGeometry(0.08, 0.1, 0.28, 5));
    const footGeo = geo('tatu-foot', () => new THREE.BoxGeometry(0.16, 0.07, 0.2));
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
        const limb = new THREE.Mesh(legGeo, retroMat(0xc48a40));
        const foot = new THREE.Mesh(footGeo, retroMat(0x3a2418));
        foot.position.y = -0.16;
        g.add(limb, foot);
        legs.add(g);
    });
    root.add(legs);

    const tail = mesh(geo('tatu-tail', () => new THREE.ConeGeometry(0.08, 0.42, 5)), 0xb07838);
    tail.position.set(0, 0.42, -0.72);
    tail.rotation.x = -1.15;
    tail.name = 'tail';
    root.add(tail);

    const ball = mesh(geo('tatu-ball', () => new THREE.SphereGeometry(0.58, 8, 6)), 0xf0b44a);
    ball.name = 'ball';
    ball.visible = false;
    ball.position.y = 0.58;
    const stripe = mesh(geo('tatu-stripe', () => new THREE.TorusGeometry(0.5, 0.08, 5, 10)), 0x8a5a28);
    stripe.rotation.y = Math.PI / 2;
    ball.add(stripe);
    root.add(ball);

    const shadow = new THREE.Mesh(
        geo('blob', () => new THREE.CircleGeometry(0.55, 10)),
        retroMat(0x1a1010, { transparent: true, opacity: 0.32, depthWrite: false, snap: 60 })
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
    const core = mesh(geo('crystal', () => new THREE.OctahedronGeometry(0.42, 0)), color);
    core.material.emissive = new THREE.Color(color);
    core.material.emissiveIntensity = 0.45;
    g.add(core);
    const inner = mesh(geo('crystal-in', () => new THREE.OctahedronGeometry(0.22, 0)), 0xffffff);
    inner.material.emissive = new THREE.Color(0xffffff);
    inner.material.emissiveIntensity = 0.3;
    g.add(inner);
    return g;
}

export function createCaju() {
    const g = new THREE.Group();
    const fruit = mesh(geo('caju', () => new THREE.SphereGeometry(0.18, 6, 5)), 0xff7a32);
    fruit.scale.set(0.85, 1.15, 0.85);
    g.add(fruit);
    const nut = mesh(geo('caju-nut', () => new THREE.SphereGeometry(0.08, 5, 4)), 0x8a4a18);
    nut.position.y = 0.2;
    g.add(nut);
    return g;
}

export function createCrate() {
    const box = mesh(geo('crate', () => new THREE.BoxGeometry(0.95, 0.95, 0.95)), 0xc48a3a);
    const mark = mesh(geo('crate-x', () => new THREE.BoxGeometry(0.7, 0.08, 0.08)), 0x5a3010);
    const mark2 = mark.clone();
    mark.position.z = 0.48;
    mark2.position.z = 0.48;
    mark2.rotation.z = Math.PI / 2;
    box.add(mark, mark2);
    return box;
}

export function createCrab() {
    const g = new THREE.Group();
    const body = mesh(geo('crab', () => new THREE.SphereGeometry(0.38, 6, 4)), 0xe24a3a);
    body.scale.set(1.3, 0.55, 1);
    body.position.y = 0.28;
    g.add(body);
    const eyeGeo = geo('crab-eye', () => new THREE.SphereGeometry(0.07, 5, 4));
    for (const x of [-0.16, 0.16]) {
        const stalk = mesh(geo('crab-stalk', () => new THREE.CylinderGeometry(0.03, 0.03, 0.22, 4)), 0xe24a3a);
        stalk.position.set(x, 0.48, 0.12);
        const eye = new THREE.Mesh(eyeGeo, retroMat(0x1a1018));
        eye.position.y = 0.14;
        stalk.add(eye);
        g.add(stalk);
    }
    const claw = geo('crab-claw', () => new THREE.BoxGeometry(0.22, 0.1, 0.28));
    const cL = new THREE.Mesh(claw, retroMat(0xc83a2a));
    const cR = cL.clone();
    cL.position.set(-0.42, 0.28, 0.18);
    cR.position.set(0.42, 0.28, 0.18);
    g.add(cL, cR);
    return g;
}

export function createBat() {
    const g = new THREE.Group();
    const body = mesh(geo('bat', () => new THREE.SphereGeometry(0.22, 6, 4)), 0x3a2458);
    g.add(body);
    const wingGeo = geo('bat-wing', () => new THREE.ConeGeometry(0.42, 0.08, 3));
    const wL = new THREE.Mesh(wingGeo, retroMat(0x5a3878));
    const wR = wL.clone();
    wL.name = 'wingL';
    wR.name = 'wingR';
    wL.rotation.set(0, 0, 1.2);
    wR.rotation.set(0, 0, -1.2);
    wL.position.set(-0.28, 0, 0);
    wR.position.set(0.28, 0, 0);
    g.add(wL, wR);
    const fang = mesh(geo('bat-fang', () => new THREE.ConeGeometry(0.05, 0.12, 4)), 0xf4e8d0);
    fang.position.set(0, -0.12, 0.14);
    fang.rotation.x = Math.PI;
    g.add(fang);
    return g;
}

export function createPlant() {
    const g = new THREE.Group();
    const stem = mesh(geo('plant-stem', () => new THREE.CylinderGeometry(0.08, 0.12, 0.7, 5)), 0x2e8a3a);
    stem.position.y = 0.35;
    g.add(stem);
    const head = new THREE.Group();
    head.name = 'jaw';
    head.position.y = 0.78;
    const jaw = mesh(geo('plant-jaw', () => new THREE.SphereGeometry(0.32, 6, 4, 0, Math.PI * 2, 0, Math.PI * 0.6)), 0xc83a5a);
    jaw.rotation.x = 0.4;
    const jaw2 = jaw.clone();
    jaw2.rotation.x = Math.PI + 0.4;
    head.add(jaw, jaw2);
    g.add(head);
    return g;
}

export function createPalm() {
    const g = new THREE.Group();
    const trunk = mesh(geo('palm-trunk', () => new THREE.CylinderGeometry(0.18, 0.28, 3.4, 6)), 0x8a5a28);
    trunk.position.y = 1.7;
    g.add(trunk);
    const leafGeo = geo('palm-leaf', () => new THREE.ConeGeometry(0.55, 1.6, 4));
    for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(leafGeo, retroMat(0x2e9a48));
        leaf.position.set(0, 3.3, 0);
        leaf.rotation.set(0.85, (i / 5) * Math.PI * 2, 0);
        g.add(leaf);
    }
    const coco = mesh(geo('coco', () => new THREE.SphereGeometry(0.16, 5, 4)), 0x6a3a18);
    coco.position.set(0.2, 3.15, 0.1);
    g.add(coco);
    return g;
}

export function createIdol() {
    const g = new THREE.Group();
    const base = mesh(geo('idol-base', () => new THREE.CylinderGeometry(0.7, 0.85, 0.28, 6)), 0xc9a24a);
    base.position.y = 0.14;
    g.add(base);
    const body = mesh(geo('idol-body', () => new THREE.CylinderGeometry(0.32, 0.48, 1.1, 6)), 0xe8c85a);
    body.position.y = 0.85;
    g.add(body);
    const head = mesh(geo('idol-head', () => new THREE.BoxGeometry(0.7, 0.55, 0.55)), 0xffe07a);
    head.position.y = 1.55;
    g.add(head);
    const gem = mesh(geo('idol-gem', () => new THREE.OctahedronGeometry(0.18, 0)), 0xff3d8a);
    gem.position.set(0, 1.55, 0.3);
    gem.material.emissive = new THREE.Color(0xff3d8a);
    gem.material.emissiveIntensity = 0.5;
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
    const sph = geo('cloud', () => new THREE.SphereGeometry(0.7, 6, 5));
    for (const [x, y, z, s] of puffs) {
        const m = new THREE.Mesh(sph, retroMat(0xfff4e8, { snap: 48 }));
        m.position.set(x, y, z);
        m.scale.setScalar(s);
        m.castShadow = false;
        g.add(m);
    }
    return g;
}

export function createBoat() {
    const g = new THREE.Group();
    const hull = mesh(geo('boat', () => new THREE.BoxGeometry(1.8, 0.35, 0.7)), 0x8a4a22);
    hull.position.y = 0.2;
    g.add(hull);
    const mast = mesh(geo('mast', () => new THREE.CylinderGeometry(0.04, 0.04, 1.4, 4)), 0xd8c8a0);
    mast.position.y = 1;
    g.add(mast);
    const sail = mesh(geo('sail', () => new THREE.PlaneGeometry(0.7, 0.9)), 0xf4e8c8);
    sail.position.set(0.12, 0.95, 0);
    sail.material.side = THREE.DoubleSide;
    g.add(sail);
    return g;
}

export function createPopupSprite(text, color = '#7af0ff') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1a1018';
    ctx.lineWidth = 6;
    ctx.strokeText(text, 128, 32);
    ctx.fillText(text, 128, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
    const s = new THREE.Sprite(mat);
    s.scale.set(2.4, 0.6, 1);
    return s;
}
