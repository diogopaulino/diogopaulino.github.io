/**
 * Modelos low-poly no espírito N64 — caixas, esferas e Lambert com
 * snapping de vértice (o “jitter” de cartucho). Nico, castelo, árvores,
 * estrelas, moedas, fungos e a bomba-rei.
 */

import * as THREE from 'three';

const geoCache = new Map();
function geo(key, factory) {
    if (!geoCache.has(key)) geoCache.set(key, factory());
    return geoCache.get(key);
}

export const n64Materials = [];

export function n64Mat(color, { snap = 88, emissive = 0x000000, opacity = 1 } = {}) {
    const mat = new THREE.MeshLambertMaterial({
        color,
        emissive,
        flatShading: true,
        transparent: opacity < 1,
        opacity
    });
    mat.userData.n64 = true;
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uSnap = { value: snap };
        shader.vertexShader = `uniform float uSnap;\n${shader.vertexShader}`.replace(
            '#include <project_vertex>',
            /* glsl */ `
            vec4 mvPosition = vec4( transformed, 1.0 );
            #ifdef USE_INSTANCING
                mvPosition = instanceMatrix * mvPosition;
            #endif
            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;
            // Só faz o snap com w positivo e seguro: perto do plano near (ou atrás da
            // câmera) w ~0 ou negativo, e dividir por ele explode gl_Position.xy —
            // o triângulo vira uma faixa gigante que o hardware não consegue recortar
            // direito (tela inteira em "chuva" verde no SwiftShader assim que a
            // câmera se move). Sem o snap nesses vértices, o clipping padrão cuida
            // deles normalmente.
            if (gl_Position.w > 1e-4) {
                gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap) / uSnap * gl_Position.w;
            }
            `
        );
    };
    mat.customProgramCacheKey = () => `cupola64-${snap}`;
    n64Materials.push(mat);
    return mat;
}

function mesh(geometry, color, extras) {
    const m = new THREE.Mesh(geometry, n64Mat(color, extras));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

/** Nico — herói redondo de macacão teal e boina coral. */
export function createNico() {
    const root = new THREE.Group();
    root.name = 'nico';

    const hips = new THREE.Group();
    hips.name = 'hips';
    hips.position.y = 0.38;
    root.add(hips);

    const torso = mesh(geo('n-torso', () => new THREE.SphereGeometry(0.38, 8, 6)), 0x2a9a8c);
    torso.scale.set(0.92, 1.05, 0.78);
    torso.position.y = 0.42;
    hips.add(torso);

    const shirt = mesh(geo('n-shirt', () => new THREE.SphereGeometry(0.28, 8, 6)), 0xffe6c8);
    shirt.scale.set(1.05, 0.7, 0.9);
    shirt.position.y = 0.62;
    hips.add(shirt);

    const strapL = mesh(geo('n-strap', () => new THREE.BoxGeometry(0.1, 0.42, 0.08)), 0x1f7a70);
    strapL.position.set(-0.16, 0.58, 0.22);
    const strapR = strapL.clone();
    strapR.position.x = 0.16;
    hips.add(strapL, strapR);

    const button = mesh(geo('n-btn', () => new THREE.SphereGeometry(0.055, 6, 5)), 0xffe14a);
    button.position.set(-0.14, 0.38, 0.3);
    const button2 = button.clone();
    button2.position.x = 0.14;
    hips.add(button, button2);

    const head = new THREE.Group();
    head.name = 'head';
    head.position.y = 0.95;
    hips.add(head);

    const skull = mesh(geo('n-head', () => new THREE.SphereGeometry(0.34, 10, 8)), 0xffd4a8);
    head.add(skull);

    const cap = mesh(geo('n-cap', () => new THREE.SphereGeometry(0.36, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55)), 0xff6b4a);
    cap.position.y = 0.08;
    cap.rotation.x = -0.12;
    head.add(cap);

    const visor = mesh(geo('n-visor', () => new THREE.BoxGeometry(0.42, 0.06, 0.28)), 0xff6b4a);
    visor.position.set(0, 0.08, 0.28);
    head.add(visor);

    const emblem = mesh(geo('n-star', () => new THREE.OctahedronGeometry(0.09, 0)), 0xffe14a, { emissive: 0x553300 });
    emblem.position.set(0, 0.22, 0.3);
    emblem.rotation.z = Math.PI / 4;
    head.add(emblem);

    const eyeGeo = geo('n-eye', () => new THREE.SphereGeometry(0.07, 6, 5));
    const eyeL = new THREE.Mesh(eyeGeo, n64Mat(0x1a1420));
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.11, 0.02, 0.28);
    eyeR.position.set(0.11, 0.02, 0.28);
    const shineL = mesh(geo('n-shine', () => new THREE.SphereGeometry(0.025, 5, 4)), 0xffffff);
    shineL.position.set(-0.09, 0.05, 0.33);
    const shineR = shineL.clone();
    shineR.position.x = 0.13;
    head.add(eyeL, eyeR, shineL, shineR);

    const nose = mesh(geo('n-nose', () => new THREE.SphereGeometry(0.08, 6, 5)), 0xf0b090);
    nose.scale.set(0.8, 0.7, 1.15);
    nose.position.set(0, -0.04, 0.32);
    head.add(nose);

    const armL = new THREE.Group();
    armL.name = 'armL';
    armL.position.set(-0.4, 0.55, 0);
    const armR = new THREE.Group();
    armR.name = 'armR';
    armR.position.set(0.4, 0.55, 0);
    const limb = geo('n-arm', () => new THREE.CapsuleGeometry(0.09, 0.28, 3, 6));
    const aL = new THREE.Mesh(limb, n64Mat(0xffe6c8));
    aL.rotation.z = 0.35;
    aL.position.y = -0.18;
    const aR = aL.clone();
    aR.rotation.z = -0.35;
    const glove = mesh(geo('n-glove', () => new THREE.SphereGeometry(0.12, 6, 5)), 0xf4efe2);
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
    const thigh = new THREE.Mesh(geo('n-leg', () => new THREE.CapsuleGeometry(0.11, 0.22, 3, 6)), n64Mat(0x2a9a8c));
    thigh.position.y = -0.18;
    const thighR = thigh.clone();
    const shoe = mesh(geo('n-shoe', () => new THREE.BoxGeometry(0.22, 0.12, 0.34)), 0x3a2418);
    shoe.position.set(0, -0.38, 0.06);
    const shoeR = shoe.clone();
    legL.add(thigh, shoe);
    legR.add(thighR, shoeR);
    hips.add(legL, legR);

    const shadow = new THREE.Mesh(
        geo('n-sh', () => new THREE.CircleGeometry(0.42, 12)),
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

    const keep = mesh(geo('c-keep', () => new THREE.BoxGeometry(10, 7.2, 8.4)), 0xf3c4b4);
    keep.position.y = 3.6;
    g.add(keep);

    const trim = mesh(geo('c-trim', () => new THREE.BoxGeometry(10.4, 0.45, 8.8)), 0xe8a898);
    trim.position.y = 7.15;
    g.add(trim);

    for (const sx of [-4.6, 4.6]) {
        const tower = mesh(geo('c-tow', () => new THREE.CylinderGeometry(1.55, 1.7, 9.2, 8)), 0xf7d0c2);
        tower.position.set(sx, 4.6, -2.2);
        const roof = mesh(geo('c-roof', () => new THREE.ConeGeometry(2.15, 2.6, 8)), 0xc45c6a);
        roof.position.set(sx, 10.4, -2.2);
        const ball = mesh(geo('c-ball', () => new THREE.SphereGeometry(0.28, 6, 5)), 0xffe14a, { emissive: 0x442200 });
        ball.position.set(sx, 11.85, -2.2);
        g.add(tower, roof, ball);
    }

    const gate = mesh(geo('c-gate', () => new THREE.BoxGeometry(2.6, 3.4, 0.4)), 0x4a2a38);
    gate.position.set(0, 1.7, 4.25);
    const arch = mesh(geo('c-arch', () => new THREE.BoxGeometry(3.4, 0.55, 0.5)), 0xffe14a);
    arch.position.set(0, 3.55, 4.3);
    g.add(gate, arch);

    const dome = mesh(geo('c-dome', () => new THREE.SphereGeometry(2.6, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55)), 0xffe27a, { emissive: 0x332200 });
    dome.position.set(0, 8.4, 0);
    const spire = mesh(geo('c-spire', () => new THREE.ConeGeometry(0.45, 2.2, 6)), 0xc45c6a);
    spire.position.set(0, 11.2, 0);
    const star = mesh(geo('c-star', () => new THREE.OctahedronGeometry(0.42, 0)), 0xfff1a0, { emissive: 0x665500 });
    star.position.set(0, 12.5, 0);
    star.name = 'cupolaStar';
    g.add(dome, spire, star);

    const glass = mesh(geo('c-glass', () => new THREE.CircleGeometry(1.15, 8)), 0x7ec8ff, { emissive: 0x113355, opacity: 0.85 });
    glass.position.set(0, 5.4, 4.22);
    g.add(glass);

    for (const [x, y] of [[-3.2, 4.6], [3.2, 4.6], [-3.2, 2.4], [3.2, 2.4]]) {
        const w = mesh(geo('c-win', () => new THREE.BoxGeometry(0.7, 1.1, 0.12)), 0x7ec8ff, { emissive: 0x102040 });
        w.position.set(x, y, 4.22);
        g.add(w);
    }

    const steps = mesh(geo('c-steps', () => new THREE.BoxGeometry(4.4, 0.7, 3.2)), 0xe8d4c4);
    steps.position.set(0, 0.35, 6.2);
    g.add(steps);

    const bridge = mesh(geo('c-br', () => new THREE.BoxGeometry(3.2, 0.28, 6.5)), 0xd2b48c);
    bridge.position.set(0, 1.42, 10.4);
    g.add(bridge);

    return g;
}

export function createTree(scale = 1) {
    const g = new THREE.Group();
    const trunk = mesh(geo('t-tr', () => new THREE.CylinderGeometry(0.22, 0.32, 1.6, 6)), 0x7a4a28);
    trunk.position.y = 0.8;
    const leaf = mesh(geo('t-lf', () => new THREE.SphereGeometry(1.05, 7, 5)), 0x2faf3d);
    leaf.position.y = 2.15;
    leaf.scale.set(1, 0.85, 1);
    const leaf2 = leaf.clone();
    leaf2.scale.setScalar(0.7);
    leaf2.position.set(0.55, 1.7, 0.2);
    g.add(trunk, leaf, leaf2);
    g.scale.setScalar(scale);
    return g;
}

export function createCloud() {
    const g = new THREE.Group();
    const mat = n64Mat(0xf4fbff, { snap: 56 });
    const a = new THREE.Mesh(geo('cl', () => new THREE.SphereGeometry(1.4, 7, 5)), mat);
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
    const body = mesh(geo('st', () => new THREE.OctahedronGeometry(0.42, 0)), color, { emissive: 0x553300 });
    body.scale.set(1, 1.15, 0.45);
    const arm = body.clone();
    arm.rotation.z = Math.PI / 2;
    arm.scale.set(0.7, 1.4, 0.4);
    const eye = mesh(geo('st-e', () => new THREE.SphereGeometry(0.07, 5, 4)), 0x1a1420);
    eye.position.set(-0.1, 0.08, 0.2);
    const eyeR = eye.clone();
    eyeR.position.x = 0.1;
    const smile = mesh(geo('st-s', () => new THREE.BoxGeometry(0.16, 0.04, 0.04)), 0x1a1420);
    smile.position.set(0, -0.06, 0.22);
    g.add(body, arm, eye, eyeR, smile);
    return g;
}

export function createCoin(red = false) {
    const g = new THREE.Group();
    const color = red ? 0xe23a3a : 0xffe14a;
    const coin = mesh(geo(red ? 'rc' : 'yc', () => new THREE.CylinderGeometry(0.38, 0.38, 0.08, 12)), color, {
        emissive: red ? 0x330000 : 0x442200
    });
    coin.rotation.z = Math.PI / 2;
    const rim = mesh(geo(red ? 'rr' : 'yr', () => new THREE.TorusGeometry(0.38, 0.04, 5, 12)), red ? 0xff8080 : 0xfff3a0);
    rim.rotation.y = Math.PI / 2;
    g.add(coin, rim);
    return g;
}

export function createFungus() {
    const g = new THREE.Group();
    g.name = 'fungus';
    const body = mesh(geo('f-b', () => new THREE.SphereGeometry(0.38, 8, 6)), 0x5a3a22);
    body.scale.set(1, 0.85, 1);
    body.position.y = 0.34;
    const cap = mesh(geo('f-c', () => new THREE.SphereGeometry(0.48, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55)), 0xc45c2a);
    cap.position.y = 0.62;
    const spot = mesh(geo('f-s', () => new THREE.SphereGeometry(0.1, 5, 4)), 0xf4efe2);
    spot.position.set(0.18, 0.78, 0.28);
    const spot2 = spot.clone();
    spot2.position.set(-0.2, 0.72, 0.22);
    const eye = mesh(geo('f-e', () => new THREE.SphereGeometry(0.07, 5, 4)), 0x1a1420);
    eye.position.set(-0.12, 0.38, 0.3);
    const eyeR = eye.clone();
    eyeR.position.x = 0.12;
    const foot = mesh(geo('f-f', () => new THREE.SphereGeometry(0.14, 6, 4)), 0x4a2e18);
    foot.position.set(-0.16, 0.1, 0.08);
    const footR = foot.clone();
    footR.position.x = 0.16;
    g.add(body, cap, spot, spot2, eye, eyeR, foot, footR);
    return g;
}

export function createKingBomb() {
    const g = new THREE.Group();
    g.name = 'king';
    const body = mesh(geo('k-b', () => new THREE.SphereGeometry(1.35, 10, 8)), 0x2a2a32);
    body.position.y = 1.45;
    const fuse = mesh(geo('k-f', () => new THREE.CylinderGeometry(0.08, 0.08, 0.7, 6)), 0xf4efe2);
    fuse.position.set(0, 2.95, 0);
    const spark = mesh(geo('k-s', () => new THREE.SphereGeometry(0.16, 6, 5)), 0xff6b4a, { emissive: 0x661100 });
    spark.position.set(0, 3.35, 0);
    spark.name = 'spark';
    const crown = mesh(geo('k-c', () => new THREE.ConeGeometry(0.55, 0.55, 5)), 0xffe14a, { emissive: 0x442200 });
    crown.position.set(0, 2.7, 0);
    const eye = mesh(geo('k-e', () => new THREE.SphereGeometry(0.18, 6, 5)), 0xf4efe2);
    eye.position.set(-0.38, 1.7, 1.1);
    const eyeR = eye.clone();
    eyeR.position.x = 0.38;
    const pupil = mesh(geo('k-p', () => new THREE.SphereGeometry(0.08, 5, 4)), 0x1a1420);
    pupil.position.set(-0.38, 1.68, 1.24);
    const pupilR = pupil.clone();
    pupilR.position.x = 0.38;
    const arm = mesh(geo('k-a', () => new THREE.SphereGeometry(0.32, 6, 5)), 0x2a2a32);
    arm.position.set(-1.4, 1.4, 0.2);
    const armR = arm.clone();
    armR.position.x = 1.4;
    const foot = mesh(geo('k-ft', () => new THREE.SphereGeometry(0.38, 6, 5)), 0x1a1a22);
    foot.position.set(-0.55, 0.32, 0.35);
    const footR = foot.clone();
    footR.position.x = 0.55;
    g.add(body, fuse, spark, crown, eye, eyeR, pupil, pupilR, arm, armR, foot, footR);
    return g;
}

export function createCannon() {
    const g = new THREE.Group();
    const base = mesh(geo('cn-b', () => new THREE.CylinderGeometry(0.7, 0.9, 0.55, 8)), 0x3a3a44);
    base.position.y = 0.28;
    const barrel = mesh(geo('cn-r', () => new THREE.CylinderGeometry(0.42, 0.5, 2.4, 8)), 0x2a2a32);
    barrel.rotation.x = -Math.PI / 2.6;
    barrel.position.set(0, 1.15, 0.55);
    barrel.name = 'barrel';
    const rim = mesh(geo('cn-m', () => new THREE.TorusGeometry(0.44, 0.08, 6, 10)), 0xffe14a);
    rim.rotation.x = Math.PI / 2.6;
    rim.position.set(0, 1.72, 1.55);
    g.add(base, barrel, rim);
    return g;
}

export function createFlag() {
    const g = new THREE.Group();
    const pole = mesh(geo('fl-p', () => new THREE.CylinderGeometry(0.05, 0.06, 3.2, 5)), 0xf4efe2);
    pole.position.y = 1.6;
    const cloth = mesh(geo('fl-c', () => new THREE.BoxGeometry(1.15, 0.7, 0.06)), 0xff6b4a);
    cloth.position.set(0.55, 2.7, 0);
    cloth.name = 'cloth';
    const emblem = mesh(geo('fl-s', () => new THREE.OctahedronGeometry(0.16, 0)), 0xffe14a);
    emblem.position.set(0.55, 2.7, 0.06);
    g.add(pole, cloth, emblem);
    return g;
}

export function createPlatform(w, h, d, color = 0xc4783a) {
    const m = mesh(new THREE.BoxGeometry(w, h, d), color);
    m.receiveShadow = true;
    return m;
}

export function createBush() {
    const g = new THREE.Group();
    const a = mesh(geo('bush', () => new THREE.SphereGeometry(0.7, 7, 5)), 0x2a9a3a);
    a.scale.set(1.2, 0.75, 1);
    a.position.y = 0.45;
    const b = a.clone();
    b.position.set(0.45, 0.35, 0.1);
    b.scale.setScalar(0.7);
    g.add(a, b);
    return g;
}
