/**
 * Dinossauros construídos por código — nenhum GLB externo.
 *
 * Corpo: elipses varridas ao longo de uma spline Catmull-Rom (silhueta orgânica).
 * Pele: albedo + normal de escamas + wrap-lighting. Animação por hierarquia
 * de ossos (coxas, canelas, mandíbula, pescoço).
 */

import * as THREE from 'three';
import { dinoSkin } from './textures.js';
import { patchSkin } from './shaders.js';
import { clamp, damp, wrapPi, hash2 } from './utils.js';
import { SPECIES } from './config.js';

const ivory = () => new THREE.MeshStandardMaterial({
    color: 0xe8d8b8, roughness: 0.35, metalness: 0.08
});
const keratin = () => new THREE.MeshStandardMaterial({
    color: 0xc4a070, roughness: 0.55, metalness: 0.04
});
const eyeWhite = () => new THREE.MeshStandardMaterial({
    color: 0xe8dcc0, roughness: 0.25, metalness: 0.1, emissive: 0x221800, emissiveIntensity: 0.12
});
const pupilMat = () => new THREE.MeshStandardMaterial({
    color: 0x0a0806, roughness: 0.2, metalness: 0.15
});

function skinMat(key, colors, quality) {
    const maps = dinoSkin({
        key,
        ...colors,
        size: quality.dinoSegs > 1.2 ? 1024 : (quality.dinoSegs > 0.75 ? 512 : 256)
    });
    const mat = new THREE.MeshStandardMaterial({
        map: maps.map,
        normalMap: maps.normalMap,
        normalScale: new THREE.Vector2(1.4, 1.4),
        roughnessMap: maps.roughnessMap,
        roughness: 0.6,
        metalness: 0.12
    });
    patchSkin(mat, { belly: new THREE.Color(colors.ventral) });
    return mat;
}

function shadows(root) {
    root.traverse((c) => {
        if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
        }
    });
}

/**
 * Varre seções elípticas ao longo dos nós.
 * Cada nó: { x, y, z, rx, ry } — rx lateral, ry dorso-ventral.
 * Frames por transporte paralelo (up × tangent) para evitar torção do Frenet.
 */
export function sweepBody(knots, tubular = 28, radial = 12) {
    const pts = knots.map((k) => new THREE.Vector3(k.x, k.y, k.z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.28);
    const positions = [];
    const uvs = [];
    const indices = [];
    const tangent = new THREE.Vector3();
    const side = new THREE.Vector3();
    const binormal = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    let lastSide = new THREE.Vector3(1, 0, 0);

    const radiiAt = (t) => {
        const f = t * (knots.length - 1);
        const i = Math.min(knots.length - 2, Math.floor(f));
        const u = f - i;
        const a = knots[i];
        const b = knots[i + 1];
        return { rx: a.rx + (b.rx - a.rx) * u, ry: a.ry + (b.ry - a.ry) * u };
    };

    for (let i = 0; i <= tubular; i++) {
        const t = i / tubular;
        const p = curve.getPointAt(Math.min(0.999, t));
        curve.getTangentAt(Math.min(0.999, t), tangent).normalize();
        side.crossVectors(up, tangent);
        if (side.lengthSq() < 1e-6) side.copy(lastSide);
        else side.normalize();
        lastSide.copy(side);
        binormal.crossVectors(tangent, side).normalize();
        const { rx, ry } = radiiAt(t);
        for (let j = 0; j <= radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            const ca = Math.cos(a);
            const sa = Math.sin(a);
            const ox = side.x * ca * rx + binormal.x * sa * ry;
            const oy = side.y * ca * rx + binormal.y * sa * ry;
            const oz = side.z * ca * rx + binormal.z * sa * ry;
            positions.push(p.x + ox, p.y + oy, p.z + oz);
            uvs.push(t * 3.4, j / radial);
        }
    }

    const cols = radial + 1;
    for (let i = 0; i < tubular; i++) {
        for (let j = 0; j < radial; j++) {
            const a = i * cols + j;
            const b = a + cols;
            indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
}

function segs(quality, n) {
    return Math.max(8, Math.round(n * (quality.dinoSegs ?? 1)));
}

function addEyes(parent, { x, y, z, s = 0.12, spread = 0.28 }) {
    for (const sx of [-1, 1]) {
        const g = new THREE.Group();
        g.position.set(sx * spread, y, z);
        const ball = new THREE.Mesh(new THREE.SphereGeometry(s, 10, 8), eyeWhite());
        g.add(ball);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(s * 0.48, 8, 6), pupilMat());
        pupil.position.z = s * 0.62;
        pupil.scale.set(0.7, 1, 0.55);
        g.add(pupil);
        parent.add(g);
    }
}

function addTeeth(jaw, { count, z0, z1, y, side = 0.16, up = false, len = 0.12 }) {
    const mat = ivory();
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.028, len, 5), mat);
        tooth.rotation.x = up ? Math.PI : 0;
        tooth.position.set(side, y, z0 + (z1 - z0) * t);
        jaw.add(tooth);
        if (side !== 0) {
            const t2 = tooth.clone();
            t2.position.x = -side;
            jaw.add(t2);
        }
    }
}

function makeLeg(skin, { thighLen, shinLen, thighR, shinR, toes = 3, claw = false }) {
    const hip = new THREE.Group();
    const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(thighR * 0.72, thighR, thighLen, 10),
        skin
    );
    thigh.position.y = -thighLen * 0.5;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -thighLen + 0.04;
    hip.add(knee);

    const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(shinR, shinR * 0.7, shinLen, 8),
        skin
    );
    shin.position.y = -shinLen * 0.5;
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.y = -shinLen + 0.02;
    knee.add(ankle);

    const foot = new THREE.Mesh(new THREE.SphereGeometry(shinR * 1.15, 8, 6), skin);
    foot.scale.set(1.1, 0.55, 1.6);
    foot.position.set(0, -0.08, 0.12);
    ankle.add(foot);

    for (let i = 0; i < toes; i++) {
        const t = (i / Math.max(1, toes - 1) - 0.5) * 0.22;
        const toe = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.03, 0.28, 5),
            keratin()
        );
        toe.rotation.x = Math.PI / 2;
        toe.position.set(t, -0.1, 0.32);
        ankle.add(toe);
        const nail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), keratin());
        nail.rotation.x = Math.PI / 2;
        nail.position.set(t, -0.1, 0.48);
        ankle.add(nail);
    }

    if (claw) {
        const sickle = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.28, 6), keratin());
        sickle.rotation.set(0.4, 0, 1.1);
        sickle.position.set(0.08, 0.02, 0.18);
        ankle.add(sickle);
    }

    return { hip, knee, ankle };
}

function makeArm(skin, { len = 0.45, r = 0.08, fingers = 2 }) {
    const sh = new THREE.Group();
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, len, 6), skin);
    upper.position.y = -len * 0.5;
    sh.add(upper);
    const hand = new THREE.Group();
    hand.position.y = -len;
    sh.add(hand);
    for (let i = 0; i < fingers; i++) {
        const f = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 4), keratin());
        f.position.set((i - (fingers - 1) * 0.5) * 0.07, -0.08, 0.02);
        f.rotation.x = 0.4;
        hand.add(f);
    }
    return { sh, hand };
}

/* ------------------------------------------------------------------ */
/* Espécies                                                            */
/* ------------------------------------------------------------------ */

export function buildTRex(quality) {
    const skin = skinMat('trex', {
        dorsal: 0x4a5330, ventral: 0xc4b090, stripe: 0x2a2214, stripeAmt: 0.62, scale: 16
    }, quality);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const geo = sweepBody([
        { x: 0, y: 1.55, z: -7.6, rx: 0.07, ry: 0.07 },
        { x: 0, y: 1.65, z: -5.4, rx: 0.28, ry: 0.22 },
        { x: 0, y: 1.8, z: -3.2, rx: 0.52, ry: 0.45 },
        { x: 0, y: 2.15, z: -0.7, rx: 1.02, ry: 1.12 },
        { x: 0, y: 2.28, z: 0.9, rx: 1.12, ry: 1.22 },
        { x: 0, y: 2.5, z: 2.3, rx: 0.92, ry: 1.02 },
        { x: 0, y: 2.85, z: 3.5, rx: 0.62, ry: 0.7 },
        { x: 0, y: 3.2, z: 4.55, rx: 0.4, ry: 0.46 }
    ], segs(quality, 32), segs(quality, 12));
    body.add(new THREE.Mesh(geo, skin));

    const neck = new THREE.Group();
    neck.position.set(0, 3.15, 4.4);
    body.add(neck);

    const head = new THREE.Group();
    head.position.set(0, 0.15, 0.55);
    neck.add(head);

    const cranium = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.58, 0.95), skin);
    cranium.position.set(0, 0.08, 0.15);
    head.add(cranium);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.38, 1.15), skin);
    snout.position.set(0, -0.02, 0.95);
    head.add(snout);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.16, 0.35), skin);
    brow.position.set(0, 0.32, 0.05);
    head.add(brow);
    addEyes(head, { x: 0, y: 0.16, z: 0.22, s: 0.09, spread: 0.3 });

    const jaw = new THREE.Group();
    jaw.position.set(0, -0.18, 0.35);
    head.add(jaw);
    const jawMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 1.2), skin);
    jawMesh.position.set(0, -0.06, 0.55);
    jaw.add(jawMesh);
    addTeeth(head, { count: 8, z0: 0.45, z1: 1.42, y: -0.18, side: 0.16, up: false, len: 0.14 });
    addTeeth(jaw, { count: 8, z0: 0.2, z1: 1.05, y: 0.08, side: 0.14, up: true, len: 0.12 });

    const lLeg = makeLeg(skin, { thighLen: 1.15, shinLen: 0.82, thighR: 0.42, shinR: 0.2, toes: 3 });
    lLeg.hip.position.set(0.55, 2.15, -0.55);
    body.add(lLeg.hip);
    const rLeg = makeLeg(skin, { thighLen: 1.15, shinLen: 0.82, thighR: 0.42, shinR: 0.2, toes: 3 });
    rLeg.hip.position.set(-0.55, 2.15, -0.55);
    body.add(rLeg.hip);

    const lArm = makeArm(skin, { len: 0.42, r: 0.07, fingers: 2 });
    lArm.sh.position.set(0.58, 2.55, 2.85);
    lArm.sh.rotation.z = 0.45;
    body.add(lArm.sh);
    const rArm = makeArm(skin, { len: 0.42, r: 0.07, fingers: 2 });
    rArm.sh.position.set(-0.58, 2.55, 2.85);
    rArm.sh.rotation.z = -0.45;
    body.add(rArm.sh);

    shadows(root);
    return {
        root, body, neck, head, jaw,
        lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee,
        lArm: lArm.sh, rArm: rArm.sh,
        hipY: 2.15, gait: 1.55, stride: 0.72, kind: 'biped'
    };
}

export function buildBrachiosaurus(quality) {
    const skin = skinMat('brachio', {
        dorsal: 0x6a7a58, ventral: 0xd2c4a0, stripe: 0x3a4830, stripeAmt: 0.28, scale: 10
    }, quality);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const geo = sweepBody([
        { x: 0, y: 2.1, z: -9.2, rx: 0.12, ry: 0.1 },
        { x: 0, y: 2.3, z: -6.2, rx: 0.45, ry: 0.4 },
        { x: 0, y: 2.8, z: -3.0, rx: 1.15, ry: 1.2 },
        { x: 0, y: 3.5, z: -0.4, rx: 1.55, ry: 1.65 },
        { x: 0, y: 4.4, z: 2.4, rx: 1.45, ry: 1.55 },
        { x: 0, y: 5.3, z: 4.2, rx: 0.95, ry: 1.05 },
        { x: 0, y: 6.6, z: 5.1, rx: 0.55, ry: 0.58 },
        { x: 0, y: 8.2, z: 5.55, rx: 0.38, ry: 0.4 },
        { x: 0, y: 9.8, z: 5.85, rx: 0.28, ry: 0.3 },
        { x: 0, y: 11.1, z: 6.15, rx: 0.22, ry: 0.22 }
    ], segs(quality, 40), segs(quality, 12));
    body.add(new THREE.Mesh(geo, skin));

    const neck = new THREE.Group();
    neck.position.set(0, 8.4, 5.4);
    body.add(neck);
    const head = new THREE.Group();
    head.position.set(0, 2.7, 0.7);
    neck.add(head);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.7), skin);
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.55), skin);
    snout.position.z = 0.48;
    head.add(snout);
    addEyes(head, { y: 0.08, z: 0.05, s: 0.055, spread: 0.18 });

    const fl = makeLeg(skin, { thighLen: 2.15, shinLen: 1.7, thighR: 0.48, shinR: 0.28, toes: 4 });
    fl.hip.position.set(0.85, 4.05, 2.6);
    body.add(fl.hip);
    const fr = makeLeg(skin, { thighLen: 2.15, shinLen: 1.7, thighR: 0.48, shinR: 0.28, toes: 4 });
    fr.hip.position.set(-0.85, 4.05, 2.6);
    body.add(fr.hip);
    const hl = makeLeg(skin, { thighLen: 1.75, shinLen: 1.35, thighR: 0.5, shinR: 0.3, toes: 4 });
    hl.hip.position.set(0.9, 3.25, -1.4);
    body.add(hl.hip);
    const hr = makeLeg(skin, { thighLen: 1.75, shinLen: 1.35, thighR: 0.5, shinR: 0.3, toes: 4 });
    hr.hip.position.set(-0.9, 3.25, -1.4);
    body.add(hr.hip);

    shadows(root);
    return {
        root, body, neck, head, jaw: null,
        lHip: fl.hip, rHip: fr.hip, lKnee: fl.knee, rKnee: fr.knee,
        hLHip: hl.hip, hRHip: hr.hip, hLKnee: hl.knee, hRKnee: hr.knee,
        hipY: 3.15, gait: 0.85, stride: 0.38, kind: 'quad'
    };
}

export function buildRaptor(quality) {
    const skin = skinMat('raptor', {
        dorsal: 0x8a6a38, ventral: 0xe0d0b0, stripe: 0x2c2010, stripeAmt: 0.72, scale: 22
    }, quality);
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const geo = sweepBody([
        { x: 0, y: 0.55, z: -1.85, rx: 0.04, ry: 0.04 },
        { x: 0, y: 0.62, z: -1.1, rx: 0.12, ry: 0.1 },
        { x: 0, y: 0.72, z: -0.35, rx: 0.22, ry: 0.24 },
        { x: 0, y: 0.78, z: 0.25, rx: 0.26, ry: 0.28 },
        { x: 0, y: 0.82, z: 0.75, rx: 0.18, ry: 0.2 },
        { x: 0, y: 0.92, z: 1.15, rx: 0.12, ry: 0.13 }
    ], segs(quality, 22), segs(quality, 10));
    body.add(new THREE.Mesh(geo, skin));

    const neck = new THREE.Group();
    neck.position.set(0, 0.9, 1.05);
    body.add(neck);
    const head = new THREE.Group();
    head.position.set(0, 0.12, 0.28);
    neck.add(head);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.16, 0.32), skin);
    head.add(skull);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.28), skin);
    snout.position.z = 0.26;
    head.add(snout);
    addEyes(head, { y: 0.04, z: 0.02, s: 0.035, spread: 0.09 });
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.05, 0.08);
    head.add(jaw);
    const jm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.06, 0.28), skin);
    jm.position.z = 0.14;
    jaw.add(jm);

    const lLeg = makeLeg(skin, { thighLen: 0.48, shinLen: 0.42, thighR: 0.12, shinR: 0.07, toes: 3, claw: true });
    lLeg.hip.position.set(0.14, 0.7, -0.15);
    body.add(lLeg.hip);
    const rLeg = makeLeg(skin, { thighLen: 0.48, shinLen: 0.42, thighR: 0.12, shinR: 0.07, toes: 3, claw: true });
    rLeg.hip.position.set(-0.14, 0.7, -0.15);
    body.add(rLeg.hip);

    const lArm = makeArm(skin, { len: 0.28, r: 0.045, fingers: 3 });
    lArm.sh.position.set(0.16, 0.78, 0.55);
    lArm.sh.rotation.z = 0.5;
    body.add(lArm.sh);
    const rArm = makeArm(skin, { len: 0.28, r: 0.045, fingers: 3 });
    rArm.sh.position.set(-0.16, 0.78, 0.55);
    rArm.sh.rotation.z = -0.5;
    body.add(rArm.sh);

    shadows(root);
    root.scale.setScalar(1.15);
    return {
        root, body, neck, head, jaw,
        lHip: lLeg.hip, rHip: rLeg.hip, lKnee: lLeg.knee, rKnee: rLeg.knee,
        hipY: 0.7, gait: 2.4, stride: 0.85, kind: 'biped'
    };
}

export function buildTriceratops(quality) {
    const skin = skinMat('tri', {
        dorsal: 0x6a5a38, ventral: 0xd0c09a, stripe: 0x3a3020, stripeAmt: 0.22, scale: 14
    }, quality);
    const horn = keratin();
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const geo = sweepBody([
        { x: 0, y: 1.15, z: -4.4, rx: 0.12, ry: 0.1 },
        { x: 0, y: 1.3, z: -2.6, rx: 0.55, ry: 0.5 },
        { x: 0, y: 1.55, z: -0.6, rx: 1.15, ry: 1.2 },
        { x: 0, y: 1.65, z: 1.3, rx: 1.22, ry: 1.28 },
        { x: 0, y: 1.7, z: 2.8, rx: 0.85, ry: 0.9 },
        { x: 0, y: 1.75, z: 3.7, rx: 0.55, ry: 0.58 }
    ], segs(quality, 28), segs(quality, 12));
    body.add(new THREE.Mesh(geo, skin));

    const neck = new THREE.Group();
    neck.position.set(0, 1.75, 3.55);
    body.add(neck);
    const head = new THREE.Group();
    head.position.set(0, 0.15, 0.45);
    neck.add(head);

    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.85), skin);
    head.add(skull);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.55, 6), skin);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.05, 0.7);
    head.add(beak);
    const frill = new THREE.Mesh(new THREE.CircleGeometry(1.05, 16), skin);
    frill.position.set(0, 0.25, -0.35);
    head.add(frill);
    const frillB = frill.clone();
    frillB.rotation.y = Math.PI;
    head.add(frillB);

    const nHorn = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 7), horn);
    nHorn.rotation.x = 0.9;
    nHorn.position.set(0, 0.05, 0.55);
    head.add(nHorn);
    for (const sx of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.95, 8), horn);
        h.rotation.x = 0.55;
        h.position.set(sx * 0.28, 0.35, 0.15);
        head.add(h);
    }
    addEyes(head, { y: 0.12, z: 0.2, s: 0.06, spread: 0.28 });

    const fl = makeLeg(skin, { thighLen: 1.05, shinLen: 0.85, thighR: 0.32, shinR: 0.2, toes: 4 });
    fl.hip.position.set(0.7, 1.45, 1.8);
    body.add(fl.hip);
    const fr = makeLeg(skin, { thighLen: 1.05, shinLen: 0.85, thighR: 0.32, shinR: 0.2, toes: 4 });
    fr.hip.position.set(-0.7, 1.45, 1.8);
    body.add(fr.hip);
    const hl = makeLeg(skin, { thighLen: 1.15, shinLen: 0.9, thighR: 0.36, shinR: 0.22, toes: 4 });
    hl.hip.position.set(0.75, 1.4, -0.7);
    body.add(hl.hip);
    const hr = makeLeg(skin, { thighLen: 1.15, shinLen: 0.9, thighR: 0.36, shinR: 0.22, toes: 4 });
    hr.hip.position.set(-0.75, 1.4, -0.7);
    body.add(hr.hip);

    shadows(root);
    return {
        root, body, neck, head, jaw: null,
        lHip: fl.hip, rHip: fr.hip, lKnee: fl.knee, rKnee: fr.knee,
        hLHip: hl.hip, hRHip: hr.hip, hLKnee: hl.knee, hRKnee: hr.knee,
        hipY: 1.4, gait: 1.15, stride: 0.42, kind: 'quad'
    };
}

export function buildStegosaurus(quality) {
    const skin = skinMat('stego', {
        dorsal: 0x7a6238, ventral: 0xd8c8a0, stripe: 0x4a3818, stripeAmt: 0.35, scale: 12
    }, quality);
    const plate = new THREE.MeshStandardMaterial({
        color: 0xa85838, roughness: 0.7, metalness: 0.04, side: THREE.DoubleSide
    });
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const geo = sweepBody([
        { x: 0, y: 1.05, z: -4.8, rx: 0.08, ry: 0.08 },
        { x: 0, y: 1.15, z: -3.2, rx: 0.28, ry: 0.25 },
        { x: 0, y: 1.45, z: -1.2, rx: 0.85, ry: 0.95 },
        { x: 0, y: 1.7, z: 0.6, rx: 1.05, ry: 1.2 },
        { x: 0, y: 1.55, z: 2.4, rx: 0.75, ry: 0.8 },
        { x: 0, y: 1.25, z: 3.6, rx: 0.32, ry: 0.34 }
    ], segs(quality, 28), segs(quality, 12));
    body.add(new THREE.Mesh(geo, skin));

    const zs = [-3.4, -2.4, -1.4, -0.4, 0.6, 1.5, 2.3, 3.0];
    zs.forEach((z, i) => {
        const h = 0.55 + (i % 2) * 0.45 + Math.sin(i) * 0.15;
        const p = new THREE.Mesh(new THREE.CircleGeometry(h * 0.55, 6), plate);
        p.scale.set(0.55, 1.15, 1);
        p.position.set((i % 2 === 0 ? 0.08 : -0.08), 2.05 + (i > 2 && i < 6 ? 0.35 : 0), z);
        p.rotation.y = Math.PI / 2;
        body.add(p);
    });
    for (const sx of [-1, 1]) {
        for (const z of [-4.55, -4.15]) {
            const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.7, 6), keratin());
            spike.position.set(sx * 0.12, 1.25, z);
            spike.rotation.x = 2.3;
            body.add(spike);
        }
    }

    const neck = new THREE.Group();
    neck.position.set(0, 1.3, 3.4);
    body.add(neck);
    const head = new THREE.Group();
    head.position.set(0, -0.05, 0.35);
    neck.add(head);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.45), skin);
    head.add(skull);
    addEyes(head, { y: 0.04, z: 0.05, s: 0.035, spread: 0.12 });

    const fl = makeLeg(skin, { thighLen: 0.85, shinLen: 0.65, thighR: 0.22, shinR: 0.14, toes: 3 });
    fl.hip.position.set(0.55, 1.2, 1.9);
    body.add(fl.hip);
    const fr = makeLeg(skin, { thighLen: 0.85, shinLen: 0.65, thighR: 0.22, shinR: 0.14, toes: 3 });
    fr.hip.position.set(-0.55, 1.2, 1.9);
    body.add(fr.hip);
    const hl = makeLeg(skin, { thighLen: 1.05, shinLen: 0.8, thighR: 0.3, shinR: 0.18, toes: 3 });
    hl.hip.position.set(0.62, 1.25, -0.9);
    body.add(hl.hip);
    const hr = makeLeg(skin, { thighLen: 1.05, shinLen: 0.8, thighR: 0.3, shinR: 0.18, toes: 3 });
    hr.hip.position.set(-0.62, 1.25, -0.9);
    body.add(hr.hip);

    shadows(root);
    return {
        root, body, neck, head, jaw: null,
        lHip: fl.hip, rHip: fr.hip, lKnee: fl.knee, rKnee: fr.knee,
        hLHip: hl.hip, hRHip: hr.hip, hLKnee: hl.knee, hRKnee: hr.knee,
        hipY: 1.25, gait: 1.05, stride: 0.4, kind: 'quad'
    };
}

export function buildPteranodon(quality) {
    const skin = skinMat('ptera', {
        dorsal: 0x8a6a48, ventral: 0xe8d4b0, stripe: 0x5a3820, stripeAmt: 0.2, scale: 20
    }, quality);
    const membrane = new THREE.MeshStandardMaterial({
        color: 0x6a5040, roughness: 0.82, metalness: 0.02, side: THREE.DoubleSide,
        transparent: true, opacity: 0.92
    });
    const root = new THREE.Group();
    const body = new THREE.Group();
    root.add(body);

    const geo = sweepBody([
        { x: 0, y: 0, z: -1.1, rx: 0.04, ry: 0.04 },
        { x: 0, y: 0, z: -0.3, rx: 0.16, ry: 0.14 },
        { x: 0, y: 0.02, z: 0.35, rx: 0.18, ry: 0.16 },
        { x: 0, y: 0.04, z: 0.85, rx: 0.1, ry: 0.1 }
    ], segs(quality, 16), segs(quality, 8));
    body.add(new THREE.Mesh(geo, skin));

    const neck = new THREE.Group();
    neck.position.set(0, 0.05, 0.8);
    body.add(neck);
    const head = new THREE.Group();
    head.position.set(0, 0.05, 0.35);
    neck.add(head);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.4), skin);
    head.add(skull);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.7, 5), keratin());
    beak.rotation.x = Math.PI / 2;
    beak.position.z = 0.5;
    head.add(beak);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.7, 5), new THREE.MeshStandardMaterial({
        color: 0xc45a28, roughness: 0.55, side: THREE.DoubleSide
    }));
    crest.rotation.x = -0.9;
    crest.position.set(0, 0.28, -0.05);
    head.add(crest);
    addEyes(head, { y: 0.02, z: 0.05, s: 0.03, spread: 0.07 });

    const wings = [];
    for (const sx of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(sx * 0.12, 0.06, 0.15);
        body.add(arm);
        const bone = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.025, 2.4, 5), skin);
        bone.rotation.z = Math.PI / 2;
        bone.position.x = sx * 1.2;
        arm.add(bone);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.15, 4, 2), membrane);
        sail.position.set(sx * 1.2, -0.35, -0.15);
        sail.rotation.x = 0.15;
        arm.add(sail);
        wings.push(arm);
    }

    shadows(root);
    return {
        root, body, neck, head, jaw: null,
        wings, hipY: 0, gait: 0, stride: 0, kind: 'flyer'
    };
}

/* ------------------------------------------------------------------ */
/* Animação e IA                                                       */
/* ------------------------------------------------------------------ */

function animateBiped(p, t, speed, roar = 0) {
    const s = Math.sin(t * p.gait * 6.2) * p.stride * Math.min(1.4, 0.35 + speed);
    const c = Math.cos(t * p.gait * 6.2) * p.stride * Math.min(1.4, 0.35 + speed);
    if (p.lHip) p.lHip.rotation.x = s;
    if (p.rHip) p.rHip.rotation.x = -s;
    if (p.lKnee) p.lKnee.rotation.x = Math.max(0, -s) * 0.85;
    if (p.rKnee) p.rKnee.rotation.x = Math.max(0, s) * 0.85;
    if (p.lArm) p.lArm.rotation.x = -s * 0.4;
    if (p.rArm) p.rArm.rotation.x = s * 0.4;
    if (p.body) p.body.rotation.z = -s * 0.06;
    if (p.neck) p.neck.rotation.x = Math.sin(t * 1.3) * 0.06 + roar * 0.35;
    if (p.head) p.head.rotation.y = Math.sin(t * 0.7) * 0.08;
    if (p.jaw) p.jaw.rotation.x = roar * 0.55 + Math.max(0, Math.sin(t * 2.2)) * 0.04;
}

function animateQuad(p, t, speed) {
    const s = Math.sin(t * p.gait * 5.4) * p.stride * (0.4 + speed);
    if (p.lHip) p.lHip.rotation.x = s;
    if (p.rHip) p.rHip.rotation.x = -s;
    if (p.hLHip) p.hLHip.rotation.x = -s;
    if (p.hRHip) p.hRHip.rotation.x = s;
    if (p.lKnee) p.lKnee.rotation.x = Math.max(0, -s) * 0.5;
    if (p.rKnee) p.rKnee.rotation.x = Math.max(0, s) * 0.5;
    if (p.neck) p.neck.rotation.x = Math.sin(t * 0.6) * 0.08;
    if (p.head) p.head.rotation.y = Math.sin(t * 0.45) * 0.12;
}

function animateFlyer(p, t) {
    const flap = Math.sin(t * 3.4) * 0.42;
    p.wings?.forEach((w, i) => {
        w.rotation.z = flap * (i === 0 ? 1 : -1);
        w.rotation.x = Math.sin(t * 3.4 + 0.4) * 0.08;
    });
    if (p.head) p.head.rotation.x = Math.sin(t * 1.1) * 0.08;
}

export class Dino {
    constructor({ id, parts, home, roam, cruise, chase = 0, flyer = false, heightAt }) {
        this.id = id;
        this.parts = parts;
        this.root = parts.root;
        this.home = home;
        this.roam = roam;
        this.cruise = cruise;
        this.chase = chase;
        this.flyer = flyer;
        this.heightAt = heightAt;
        this.yaw = Math.random() * Math.PI * 2;
        this.phase = Math.random() * 20;
        this.speed = 0;
        this.roar = 0;
        this.target = { x: home.x + (Math.random() - 0.5) * roam, z: home.z + (Math.random() - 0.5) * roam };
        this.caught = false;
        this.flyR = 18 + Math.random() * 10;
        this.flyA = Math.random() * Math.PI * 2;
        this.flyY = 16 + Math.random() * 8;
    }

    get position() {
        return this.root.position;
    }

    update(dt, time, jeep) {
        const t = time + this.phase;
        if (this.flyer) {
            this.flyA += dt * 0.22;
            const x = this.home.x + Math.cos(this.flyA) * this.flyR;
            const z = this.home.z + Math.sin(this.flyA) * this.flyR * 0.7;
            const y = this.flyY + Math.sin(t * 0.8) * 1.4;
            this.root.position.set(x, y, z);
            this.yaw = this.flyA + Math.PI / 2;
            this.root.rotation.set(0.12, this.yaw, Math.sin(t * 3.4) * 0.08);
            animateFlyer(this.parts, t);
            return;
        }

        const jx = jeep.x;
        const jz = jeep.z;
        const dist = Math.hypot(this.root.position.x - jx, this.root.position.z - jz);

        if (this.chase && dist < this.chase && !this.caught) {
            this.target.x = jx;
            this.target.z = jz;
            this.roar = damp(this.roar, 1, 3, dt);
            if (dist < 5.4 && jeep.speed > -99) this.caught = true;
        } else {
            this.roar = damp(this.roar, 0, 2.2, dt);
            if (Math.hypot(this.root.position.x - this.target.x, this.root.position.z - this.target.z) < 2.4) {
                const a = hash2(Math.floor(t * 0.15), this.phase, 9) * Math.PI * 2;
                const r = 4 + hash2(Math.floor(t * 0.15), this.phase, 3) * this.roam;
                this.target.x = this.home.x + Math.cos(a) * r;
                this.target.z = this.home.z + Math.sin(a) * r;
            }
        }

        const dx = this.target.x - this.root.position.x;
        const dz = this.target.z - this.root.position.z;
        const want = Math.atan2(dx, dz);
        this.yaw = wrapPi(this.yaw + wrapPi(want - this.yaw) * Math.min(1, dt * 1.8));
        const moving = Math.hypot(dx, dz) > 1.2;
        const maxV = this.chase && dist < this.chase ? this.cruise * 2.4 : this.cruise;
        this.speed = damp(this.speed, moving ? maxV : 0.15, 2.5, dt);
        this.root.position.x += Math.sin(this.yaw) * this.speed * dt;
        this.root.position.z += Math.cos(this.yaw) * this.speed * dt;
        const gy = Math.max(this.heightAt(this.root.position.x, this.root.position.z), 0.95);
        this.root.position.y = gy;
        this.root.rotation.y = this.yaw;

        const gaitSpeed = this.speed / Math.max(0.4, this.cruise);
        if (this.parts.kind === 'biped') animateBiped(this.parts, t, gaitSpeed, this.roar);
        else animateQuad(this.parts, t, gaitSpeed);

        if (this.parts.body) {
            this.parts.body.position.y = Math.abs(Math.sin(t * this.parts.gait * 6)) * 0.04 * gaitSpeed;
        }
    }
}

export function spawnDinosaurs(scene, world, quality) {
    const list = [];

    const brachio = new Dino({
        id: 'brachio',
        parts: buildBrachiosaurus(quality),
        home: { x: 6, z: 36 },
        roam: 7,
        cruise: 0.7,
        heightAt: world.heightAt
    });
    const brachio2 = new Dino({
        id: 'brachio',
        parts: buildBrachiosaurus(quality),
        home: { x: -16, z: -8 },
        roam: 8,
        cruise: 0.75,
        heightAt: world.heightAt
    });
    brachio.root.scale.setScalar(1.08);
    brachio2.root.scale.setScalar(0.86);

    const trexParts = buildTRex(quality);
    trexParts.root.scale.setScalar(1.12);
    const trex = new Dino({
        id: 'trex',
        parts: trexParts,
        home: { x: 42, z: 12 },
        roam: 14,
        cruise: 2.4,
        chase: 14,
        heightAt: world.heightAt
    });

    const triA = new Dino({
        id: 'triceratops',
        parts: buildTriceratops(quality),
        home: { x: -48, z: 38 },
        roam: 12,
        cruise: 1.15,
        heightAt: world.heightAt
    });
    const triB = new Dino({
        id: 'triceratops',
        parts: buildTriceratops(quality),
        home: { x: -40, z: 46 },
        roam: 10,
        cruise: 1.05,
        heightAt: world.heightAt
    });
    triB.root.scale.setScalar(0.88);

    const stego = new Dino({
        id: 'stego',
        parts: buildStegosaurus(quality),
        home: { x: -38, z: -48 },
        roam: 11,
        cruise: 0.95,
        heightAt: world.heightAt
    });

    const raptorHomes = [
        { x: 18, z: -52 },
        { x: 24, z: -46 },
        { x: 12, z: -48 }
    ];
    const raptors = raptorHomes.map((h, i) => new Dino({
        id: 'raptor',
        parts: buildRaptor(quality),
        home: h,
        roam: 9,
        cruise: 2.8 + i * 0.15,
        heightAt: world.heightAt
    }));

    const ptera = new Dino({
        id: 'ptera',
        parts: buildPteranodon(quality),
        home: { x: 62, z: -28 },
        roam: 20,
        cruise: 8,
        flyer: true,
        heightAt: world.heightAt
    });
    const ptera2 = new Dino({
        id: 'ptera',
        parts: buildPteranodon(quality),
        home: { x: 70, z: -18 },
        roam: 16,
        cruise: 8,
        flyer: true,
        heightAt: world.heightAt
    });
    ptera2.flyY = 20;
    ptera2.flyR = 14;

    list.push(brachio, brachio2, trex, triA, triB, stego, ...raptors, ptera, ptera2);
    for (const d of list) scene.add(d.root);
    return { list, species: SPECIES, trex };
}
