/**
 * Modelos low-poly no espírito PS1 / N64 — tudo feito de caixas, esferas e
 * tubos. Nenhum asset externo: a piada visual vive na silhueta.
 */

import * as THREE from 'three';

const geoCache = new Map();
function geo(key, factory) {
    if (!geoCache.has(key)) geoCache.set(key, factory());
    return geoCache.get(key);
}

export const retroMaterials = [];

export function retroMat(color, { snap = 84, ...props } = {}) {
    const mat = new THREE.MeshLambertMaterial({
        color,
        flatShading: true,
        ...props
    });
    mat.userData.retro = true;
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.uSnap = { value: snap };
        shader.vertexShader = `uniform float uSnap;\n${shader.vertexShader}`.replace(
            '#include <project_vertex>',
            /* glsl */ `
            vec4 mvPosition = vec4( transformed, 1.0 );
            #ifdef USE_BATCHING
                mvPosition = batchingMatrix * mvPosition;
            #endif
            #ifdef USE_INSTANCING
                mvPosition = instanceMatrix * mvPosition;
            #endif
            mvPosition = modelViewMatrix * mvPosition;
            gl_Position = projectionMatrix * mvPosition;
            gl_Position.xy = floor(gl_Position.xy / max(gl_Position.w, 0.0001) * uSnap) / uSnap * gl_Position.w;
            `
        );
    };
    mat.customProgramCacheKey = () => 'toaster64-ps1';
    retroMaterials.push(mat);
    return mat;
}

function mesh(geometry, color, extras) {
    const m = new THREE.Mesh(geometry, retroMat(color, extras));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
}

export function createToaster() {
    const root = new THREE.Group();
    root.name = 'toaster';

    const body = mesh(geo('t-body', () => new THREE.BoxGeometry(1.7, 1.05, 1.15)), 0xe8d5b5);
    body.position.y = 0.72;
    root.add(body);

    const chrome = mesh(geo('t-chrome', () => new THREE.BoxGeometry(1.78, 0.18, 1.22)), 0xc9c4b8);
    chrome.position.y = 0.28;
    root.add(chrome);

    const lever = mesh(geo('t-lever', () => new THREE.BoxGeometry(0.12, 0.38, 0.12)), 0xc45c26);
    lever.position.set(0.95, 0.78, 0);
    root.add(lever);

    const slotMat = retroMat(0x1a1410);
    const slotGeo = geo('t-slot', () => new THREE.BoxGeometry(1.15, 0.12, 0.18));
    const slotA = new THREE.Mesh(slotGeo, slotMat);
    const slotB = slotA.clone();
    slotA.position.set(0, 1.22, -0.22);
    slotB.position.set(0, 1.22, 0.22);
    root.add(slotA, slotB);

    const toastGroup = new THREE.Group();
    toastGroup.name = 'toasts';
    const toastGeo = geo('t-toast', () => new THREE.BoxGeometry(1.0, 0.72, 0.12));
    const t1 = new THREE.Mesh(toastGeo, retroMat(0xe2b15a));
    const t2 = t1.clone();
    t1.position.set(0, 1.35, -0.22);
    t2.position.set(0, 1.35, 0.22);
    const crust = retroMat(0xb8752c);
    for (const t of [t1, t2]) {
        const cap = new THREE.Mesh(geo('t-crust', () => new THREE.BoxGeometry(1.04, 0.1, 0.14)), crust);
        cap.position.y = 0.38;
        t.add(cap);
        toastGroup.add(t);
    }
    root.add(toastGroup);

    const eyeWhite = geo('t-eye', () => new THREE.SphereGeometry(0.18, 6, 5));
    const eyeL = new THREE.Mesh(eyeWhite, retroMat(0xfff7e8));
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.32, 0.82, 0.58);
    eyeR.position.set(0.32, 0.82, 0.58);
    const pupilGeo = geo('t-pupil', () => new THREE.SphereGeometry(0.08, 5, 4));
    const pupilL = new THREE.Mesh(pupilGeo, retroMat(0x1a1020));
    const pupilR = pupilL.clone();
    pupilL.position.z = 0.12;
    pupilR.position.z = 0.12;
    eyeL.add(pupilL);
    eyeR.add(pupilR);
    eyeL.name = 'eyeL';
    eyeR.name = 'eyeR';
    root.add(eyeL, eyeR);

    const smile = mesh(geo('t-smile', () => new THREE.BoxGeometry(0.42, 0.06, 0.08)), 0x5a2a18);
    smile.position.set(0, 0.55, 0.6);
    root.add(smile);

    const wheelGeo = geo('t-wheel', () => new THREE.CylinderGeometry(0.28, 0.28, 0.22, 8));
    const wheels = new THREE.Group();
    wheels.name = 'wheels';
    const spots = [
        [-0.7, 0.28, 0.55],
        [0.7, 0.28, 0.55],
        [-0.7, 0.28, -0.55],
        [0.7, 0.28, -0.55]
    ];
    for (const [x, y, z] of spots) {
        const w = new THREE.Mesh(wheelGeo, retroMat(0x2a2428));
        w.rotation.z = Math.PI / 2;
        w.position.set(x, y, z);
        const hub = new THREE.Mesh(geo('t-hub', () => new THREE.CylinderGeometry(0.1, 0.1, 0.24, 6)), retroMat(0xd0a03a));
        hub.rotation.z = Math.PI / 2;
        w.add(hub);
        wheels.add(w);
    }
    root.add(wheels);

    const antenna = mesh(geo('t-ant', () => new THREE.CylinderGeometry(0.03, 0.03, 0.7, 5)), 0x888078);
    antenna.position.set(-0.55, 1.55, -0.15);
    antenna.rotation.z = 0.35;
    const star = mesh(geo('t-star', () => new THREE.OctahedronGeometry(0.14, 0)), 0xffe14a);
    star.position.set(-0.78, 1.92, -0.15);
    star.name = 'star';
    root.add(antenna, star);

    const bumper = mesh(geo('t-bump', () => new THREE.BoxGeometry(1.5, 0.16, 0.18)), 0x3a7bd4);
    bumper.position.set(0, 0.42, 0.68);
    root.add(bumper);

    return root;
}

export function createToastSlice() {
    const g = new THREE.Group();
    const slice = mesh(geo('proj-toast', () => new THREE.BoxGeometry(0.7, 0.7, 0.1)), 0xe2b15a);
    const crust = mesh(geo('proj-crust', () => new THREE.BoxGeometry(0.76, 0.12, 0.12)), 0xb8752c);
    crust.position.y = 0.34;
    g.add(slice, crust);
    g.traverse((o) => {
        if (o.isMesh) o.castShadow = false;
    });
    return g;
}

export function createClippy(scale = 1) {
    const root = new THREE.Group();
    root.name = 'clippy';

    const pts = [
        new THREE.Vector3(0.05, -0.95, 0),
        new THREE.Vector3(0.55, -0.7, 0),
        new THREE.Vector3(0.55, 0.55, 0),
        new THREE.Vector3(-0.05, 0.95, 0),
        new THREE.Vector3(-0.55, 0.45, 0),
        new THREE.Vector3(-0.5, -0.35, 0),
        new THREE.Vector3(0.15, -0.45, 0),
        new THREE.Vector3(0.22, 0.35, 0)
    ];
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, 48, 0.11, 6, false),
        retroMat(0xd8dce2)
    );
    tube.castShadow = true;
    root.add(tube);

    const eyeGeo = geo('c-eye', () => new THREE.SphereGeometry(0.22, 7, 6));
    const eyeL = new THREE.Mesh(eyeGeo, retroMat(0xffffff));
    const eyeR = eyeL.clone();
    eyeL.position.set(-0.22, 0.55, 0.28);
    eyeR.position.set(0.28, 0.58, 0.28);
    const pupil = geo('c-pupil', () => new THREE.SphereGeometry(0.1, 5, 4));
    const pL = new THREE.Mesh(pupil, retroMat(0x1a1a28));
    const pR = pL.clone();
    pL.position.set(0, 0, 0.14);
    pR.position.set(0, 0, 0.14);
    eyeL.add(pL);
    eyeR.add(pR);
    root.add(eyeL, eyeR);

    const brow = mesh(geo('c-brow', () => new THREE.BoxGeometry(0.7, 0.07, 0.08)), 0x2a2a38);
    brow.position.set(0.04, 0.86, 0.22);
    brow.rotation.z = -0.15;
    root.add(brow);

    root.scale.setScalar(scale);
    return root;
}

export function createGhost(color = 0xff3b3b) {
    const root = new THREE.Group();
    const body = mesh(geo('g-body', () => new THREE.SphereGeometry(0.7, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)), color);
    body.position.y = 0.15;
    root.add(body);
    const skirt = mesh(geo('g-skirt', () => new THREE.CylinderGeometry(0.7, 0.55, 0.7, 8, 1, true)), color);
    skirt.position.y = -0.18;
    root.add(skirt);
    for (let i = 0; i < 4; i++) {
        const wave = mesh(geo('g-wave', () => new THREE.SphereGeometry(0.22, 6, 5)), color);
        const a = (i / 4) * Math.PI * 2 + 0.4;
        wave.position.set(Math.cos(a) * 0.48, -0.52, Math.sin(a) * 0.48);
        root.add(wave);
    }
    const eye = geo('g-eye', () => new THREE.SphereGeometry(0.16, 6, 5));
    const eL = new THREE.Mesh(eye, retroMat(0xffffff));
    const eR = eL.clone();
    eL.position.set(-0.22, 0.28, 0.52);
    eR.position.set(0.22, 0.28, 0.52);
    const pupil = geo('g-pupil', () => new THREE.SphereGeometry(0.08, 5, 4));
    const pL = new THREE.Mesh(pupil, retroMat(0x2030c8));
    const pR = pL.clone();
    pL.position.z = 0.1;
    pR.position.z = 0.1;
    eL.add(pL);
    eR.add(pR);
    root.add(eL, eR);
    return root;
}

/** Space Invader clássico, voxel a voxel. */
export function createInvader(color = 0x5dff6a) {
    const root = new THREE.Group();
    const pixels = [
        [0, 3], [1, 3], [-1, 3],
        [-2, 2], [-1, 2], [0, 2], [1, 2], [2, 2],
        [-3, 1], [-1, 1], [0, 1], [1, 1], [3, 1],
        [-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [3, 0],
        [-2, -1], [2, -1],
        [-3, -1], [3, -1],
        [-1, -2], [1, -2]
    ];
    const box = geo('inv-px', () => new THREE.BoxGeometry(0.22, 0.22, 0.22));
    const mat = retroMat(color);
    for (const [x, y] of pixels) {
        const p = new THREE.Mesh(box, mat);
        p.position.set(x * 0.22, y * 0.22, 0);
        p.castShadow = true;
        root.add(p);
    }
    root.scale.setScalar(1.15);
    return root;
}

export function createDog() {
    const root = new THREE.Group();
    const body = mesh(geo('d-body', () => new THREE.BoxGeometry(0.9, 0.55, 0.5)), 0xc48a3a);
    body.position.y = 0.55;
    const head = mesh(geo('d-head', () => new THREE.BoxGeometry(0.5, 0.45, 0.48)), 0xe8d0a8);
    head.position.set(0.55, 0.85, 0);
    const snout = mesh(geo('d-snout', () => new THREE.BoxGeometry(0.28, 0.2, 0.28)), 0xf2e2c0);
    snout.position.set(0.78, 0.72, 0);
    const nose = mesh(geo('d-nose', () => new THREE.BoxGeometry(0.1, 0.08, 0.14)), 0x1a1210);
    nose.position.set(0.94, 0.76, 0);
    const earL = mesh(geo('d-ear', () => new THREE.BoxGeometry(0.16, 0.32, 0.12)), 0x8a4a22);
    const earR = earL.clone();
    earL.position.set(0.42, 1.12, 0.18);
    earR.position.set(0.42, 1.12, -0.18);
    const tail = mesh(geo('d-tail', () => new THREE.BoxGeometry(0.12, 0.12, 0.45)), 0xc48a3a);
    tail.position.set(-0.5, 0.7, 0);
    tail.rotation.y = 0.4;
    tail.name = 'tail';
    const spot = mesh(geo('d-spot', () => new THREE.BoxGeometry(0.35, 0.3, 0.52)), 0x5a3318);
    spot.position.set(-0.15, 0.62, 0);
    root.add(body, head, snout, nose, earL, earR, tail, spot);
    return root;
}

export function createFloppy() {
    const root = new THREE.Group();
    const body = mesh(geo('f-body', () => new THREE.BoxGeometry(0.9, 0.08, 0.92)), 0x1a1a28);
    const label = mesh(geo('f-label', () => new THREE.BoxGeometry(0.62, 0.02, 0.42)), 0xf4efe2);
    label.position.set(0, 0.055, -0.12);
    const stripe = mesh(geo('f-stripe', () => new THREE.BoxGeometry(0.62, 0.025, 0.1)), 0xe23b4a);
    stripe.position.set(0, 0.06, -0.28);
    const shutter = mesh(geo('f-shut', () => new THREE.BoxGeometry(0.42, 0.09, 0.28)), 0xc0c4cc);
    shutter.position.set(0, 0.01, 0.28);
    const hub = mesh(geo('f-hub', () => new THREE.CylinderGeometry(0.12, 0.12, 0.1, 8)), 0x2a2a38);
    hub.rotation.x = Math.PI / 2;
    hub.position.set(0, 0, -0.05);
    root.add(body, label, stripe, shutter, hub);
    root.rotation.x = 0.4;
    return root;
}

export function createMushroom() {
    const root = new THREE.Group();
    const stem = mesh(geo('m-stem', () => new THREE.CylinderGeometry(0.22, 0.28, 0.45, 8)), 0xf4efe2);
    stem.position.y = 0.22;
    const cap = mesh(geo('m-cap', () => new THREE.SphereGeometry(0.48, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2)), 0xe23b4a);
    cap.position.y = 0.42;
    const spotGeo = geo('m-spot', () => new THREE.SphereGeometry(0.1, 5, 4));
    for (const [x, z] of [[0.22, 0.1], [-0.18, 0.18], [0.05, -0.22]]) {
        const s = new THREE.Mesh(spotGeo, retroMat(0xfff7e8));
        s.position.set(x, 0.72, z);
        root.add(s);
    }
    root.add(stem, cap);
    return root;
}

export function createTetrisBlock(kind = 0) {
    const colors = [0x2ee6e0, 0xf0c01a, 0xa14cff, 0x3ad15a, 0xe23b4a, 0x3a7bd4, 0xf28a2e];
    const shapes = [
        [[0, 0], [1, 0], [2, 0], [3, 0]],
        [[0, 0], [1, 0], [0, 1], [1, 1]],
        [[0, 0], [1, 0], [2, 0], [2, 1]],
        [[1, 0], [0, 1], [1, 1], [2, 1]]
    ];
    const root = new THREE.Group();
    const cells = shapes[kind % shapes.length];
    const color = colors[kind % colors.length];
    const box = geo('tet-cell', () => new THREE.BoxGeometry(0.95, 0.95, 0.95));
    const mat = retroMat(color);
    for (const [x, z] of cells) {
        const c = new THREE.Mesh(box, mat);
        c.position.set(x, 0.48, z);
        c.castShadow = true;
        c.receiveShadow = true;
        root.add(c);
    }
    return root;
}

export function createErrorDialog() {
    const root = new THREE.Group();
    const frame = mesh(geo('err-f', () => new THREE.BoxGeometry(1.6, 1.05, 0.12)), 0xc0c0c0);
    const bar = mesh(geo('err-b', () => new THREE.BoxGeometry(1.58, 0.22, 0.13)), 0x000080);
    bar.position.y = 0.42;
    const xBox = mesh(geo('err-x', () => new THREE.BoxGeometry(0.2, 0.18, 0.14)), 0xc0c0c0);
    xBox.position.set(0.64, 0.42, 0.02);
    const icon = mesh(geo('err-i', () => new THREE.BoxGeometry(0.28, 0.28, 0.14)), 0xe23b4a);
    icon.position.set(-0.5, -0.05, 0.02);
    root.add(frame, bar, xBox, icon);
    return root;
}

export function createRecycleBin() {
    const root = new THREE.Group();
    const can = mesh(geo('bin-c', () => new THREE.CylinderGeometry(1.1, 0.95, 2.2, 8, 1, true)), 0x6a7a88);
    can.position.y = 1.1;
    const bottom = mesh(geo('bin-b', () => new THREE.CircleGeometry(0.95, 8)), 0x3a444c);
    bottom.rotation.x = -Math.PI / 2;
    const lid = mesh(geo('bin-l', () => new THREE.CylinderGeometry(1.2, 1.2, 0.12, 8)), 0x8aa0b0);
    lid.position.y = 2.25;
    lid.name = 'lid';
    const logo = mesh(geo('bin-logo', () => new THREE.TorusGeometry(0.28, 0.06, 5, 8)), 0xb8e0c8);
    logo.position.set(0, 1.3, 1.05);
    root.add(can, bottom, lid, logo);
    return root;
}

export function createCastle() {
    const root = new THREE.Group();
    const keep = mesh(new THREE.BoxGeometry(10, 8, 8), 0xe8a0b4);
    keep.position.set(0, 4, 0);
    const roof = mesh(new THREE.ConeGeometry(6.2, 4.2, 4), 0x3aa0e8);
    roof.position.y = 10.1;
    roof.rotation.y = Math.PI / 4;
    const door = mesh(new THREE.BoxGeometry(2.2, 3.4, 0.4), 0x4a2018);
    door.position.set(0, 1.7, 4.15);
    const windowM = retroMat(0xfff2a0);
    const winGeo = new THREE.BoxGeometry(1.1, 1.4, 0.3);
    for (const x of [-2.6, 2.6]) {
        const w = new THREE.Mesh(winGeo, windowM);
        w.position.set(x, 5.2, 4.1);
        root.add(w);
    }
    for (const x of [-6.2, 6.2]) {
        const tower = mesh(new THREE.CylinderGeometry(1.6, 1.8, 11, 8), 0xf0b0c0);
        tower.position.set(x, 5.5, 0);
        const top = mesh(new THREE.ConeGeometry(2.1, 2.6, 8), 0x3aa0e8);
        top.position.set(x, 12.4, 0);
        const flag = mesh(new THREE.BoxGeometry(1.4, 0.8, 0.08), 0xe23b4a);
        flag.position.set(x + 0.7, 14.2, 0);
        root.add(tower, top, flag);
    }
    const emblem = mesh(new THREE.BoxGeometry(1.6, 1.6, 0.2), 0xffe14a);
    emblem.position.set(0, 6.6, 4.15);
    root.add(keep, roof, door, emblem);
    return root;
}

export function createArcadeCabinet() {
    const root = new THREE.Group();
    const body = mesh(new THREE.BoxGeometry(1.6, 3.2, 1.4), 0x1a1a28);
    body.position.y = 1.6;
    const screen = mesh(new THREE.BoxGeometry(1.2, 1.0, 0.12), 0x3dff8a);
    screen.position.set(0, 2.15, 0.72);
    const marquee = mesh(new THREE.BoxGeometry(1.7, 0.4, 0.5), 0xe23b4a);
    marquee.position.set(0, 3.35, 0.2);
    const stick = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.4, 6), 0x222222);
    stick.position.set(-0.3, 1.15, 0.55);
    const ball = mesh(new THREE.SphereGeometry(0.12, 6, 5), 0xe23b4a);
    ball.position.set(-0.3, 1.38, 0.55);
    root.add(body, screen, marquee, stick, ball);
    return root;
}

export function createJoystickTree() {
    const root = new THREE.Group();
    const base = mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.35, 8), 0x2a2a38);
    base.position.y = 0.18;
    const shaft = mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6), 0x44404a);
    shaft.position.y = 1.4;
    const ball = mesh(new THREE.SphereGeometry(0.55, 8, 6), 0xe23b4a);
    ball.position.y = 2.7;
    root.add(base, shaft, ball);
    return root;
}

export function createCloud() {
    const root = new THREE.Group();
    const mat = retroMat(0xfff7e8);
    const s = geo('cloud', () => new THREE.SphereGeometry(1, 6, 5));
    for (const [x, y, z, r] of [[0, 0, 0, 1.2], [1.1, 0.1, 0.2, 0.9], [-1, 0.05, -0.1, 0.85], [0.2, 0.5, 0, 0.7]]) {
        const m = new THREE.Mesh(s, mat);
        m.position.set(x, y, z);
        m.scale.setScalar(r);
        m.castShadow = false;
        root.add(m);
    }
    return root;
}

export function createSpeechSprite(text, tint = '#fff4c2') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = tint;
    roundRect(ctx, 12, 12, 488, 110, 18);
    ctx.fill();
    ctx.fillStyle = '#1a1020';
    ctx.font = '700 28px "Outfit", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrapText(ctx, text, 256, 68, 440, 32);
    ctx.fillStyle = tint;
    ctx.beginPath();
    ctx.moveTo(210, 122);
    ctx.lineTo(256, 152);
    ctx.lineTo(302, 122);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false
    }));
    sprite.scale.set(4.2, 1.32, 1);
    sprite.position.y = 2.4;
    return sprite;
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (ctx.measureText(test).width > maxW && line) {
            lines.push(line);
            line = w;
        } else line = test;
    }
    if (line) lines.push(line);
    const start = y - ((lines.length - 1) * lineH) / 2;
    lines.forEach((l, i) => ctx.fillText(l, x, start + i * lineH));
}

export function createPopupSprite(text, color = '#ffe14a') {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.font = '800 42px "Outfit", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = '#1a1020';
    ctx.lineWidth = 10;
    ctx.strokeText(text, 256, 64);
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthTest: false
    }));
    sprite.scale.set(3.6, 0.9, 1);
    return sprite;
}

export function disposeGroup(group) {
    group.traverse((o) => {
        if (o.geometry && !geoCache.has(findGeoKey(o.geometry))) {
            /* shared geos live in cache; skip */
        }
        if (o.material?.map) o.material.map.dispose();
        if (o.isSprite && o.material) o.material.dispose();
    });
}

function findGeoKey() {
    return null;
}
