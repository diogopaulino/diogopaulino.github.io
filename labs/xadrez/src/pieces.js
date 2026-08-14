/**
 * Peças Staunton procedurais — torno (LatheGeometry) + ornamentos.
 *
 * Alturas relativas ao rei (1.78 u, casa = 1 u): peão 0.95, torre 1.15,
 * cavalo 1.22, bispo 1.38, dama 1.58. Materiais PBR: marfim / ébano / cristal.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function lathe(xy, seg) {
    const pts = xy.map(([x, y]) => new THREE.Vector2(x, y));
    const g = new THREE.LatheGeometry(pts, seg);
    g.computeVertexNormals();
    return g;
}

function box(w, h, d, x, y, z) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(x, y, z);
    return g;
}

function merge(list) {
    const geos = list.filter(Boolean);
    const g = mergeGeometries(geos, false);
    if (!g) return geos[0];
    geos.forEach((x) => x.dispose?.());
    g.computeVertexNormals();
    return g;
}

function collar(radius, y, tube, seg) {
    const t = new THREE.TorusGeometry(radius, tube, 8, Math.max(16, seg >> 1));
    t.rotateX(Math.PI / 2);
    t.translate(0, y, 0);
    return t;
}

export function buildPieceGeometries(seg = 48) {
    const pawn = merge([
        lathe([
            [0, 0], [0.33, 0], [0.35, 0.035], [0.30, 0.08],
            [0.27, 0.14], [0.16, 0.20], [0.135, 0.46],
            [0.13, 0.54], [0.20, 0.58], [0.13, 0.62],
            [0.12, 0.68], [0.185, 0.74], [0.20, 0.84],
            [0.16, 0.91], [0.08, 0.94], [0, 0.95]
        ], seg),
        collar(0.175, 0.58, 0.028, seg)
    ]);

    const merlons = [];
    const rookR = 0.20;
    const rookY = 1.04;
    for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        merlons.push(box(0.15, 0.15, 0.13, Math.cos(a) * rookR, rookY, Math.sin(a) * rookR));
    }
    const rook = merge([
        lathe([
            [0, 0], [0.36, 0], [0.38, 0.04], [0.32, 0.10],
            [0.28, 0.18], [0.20, 0.26], [0.175, 0.68],
            [0.24, 0.74], [0.26, 0.80], [0.28, 0.90],
            [0.28, 0.96], [0.16, 0.96], [0.16, 0.88],
            [0, 0.88]
        ], seg),
        collar(0.22, 0.74, 0.03, seg),
        ...merlons
    ]);

    const bishop = merge([
        lathe([
            [0, 0], [0.34, 0], [0.36, 0.04], [0.30, 0.09],
            [0.26, 0.16], [0.16, 0.24], [0.135, 0.52],
            [0.20, 0.60], [0.14, 0.66], [0.12, 0.78],
            [0.14, 0.94], [0.175, 1.10], [0.14, 1.24],
            [0.08, 1.33], [0.05, 1.35], [0.085, 1.37], [0, 1.38]
        ], seg),
        collar(0.175, 0.60, 0.028, seg)
    ]);

    const jewels = [];
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const c = new THREE.ConeGeometry(0.042, 0.13, 8);
        c.translate(Math.cos(a) * 0.155, 1.50, Math.sin(a) * 0.155);
        jewels.push(c);
    }
    const queen = merge([
        lathe([
            [0, 0], [0.36, 0], [0.38, 0.045], [0.32, 0.10],
            [0.28, 0.18], [0.175, 0.26], [0.145, 0.60],
            [0.22, 0.68], [0.15, 0.74], [0.125, 0.92],
            [0.12, 1.14], [0.16, 1.30], [0.185, 1.40],
            [0.15, 1.44], [0.07, 1.46], [0, 1.48]
        ], seg),
        collar(0.195, 0.68, 0.03, seg),
        ...jewels
    ]);

    const cross = merge([
        box(0.05, 0.26, 0.05, 0, 1.66, 0),
        box(0.17, 0.045, 0.045, 0, 1.70, 0)
    ]);
    const king = merge([
        lathe([
            [0, 0], [0.38, 0], [0.40, 0.045], [0.33, 0.11],
            [0.29, 0.20], [0.18, 0.28], [0.15, 0.64],
            [0.24, 0.74], [0.16, 0.80], [0.13, 0.96],
            [0.125, 1.22], [0.175, 1.40], [0.20, 1.50],
            [0.15, 1.54], [0.07, 1.52], [0, 1.52]
        ], seg),
        collar(0.21, 0.74, 0.032, seg),
        cross
    ]);

    return { p: pawn, r: rook, b: bishop, q: queen, k: king, n: null };
}

function knightHeadShape() {
    const s = new THREE.Shape();
    s.moveTo(0.00, 0.02);
    s.bezierCurveTo(0.10, 0.00, 0.18, 0.08, 0.20, 0.22);
    s.bezierCurveTo(0.22, 0.38, 0.18, 0.52, 0.16, 0.62);
    s.bezierCurveTo(0.14, 0.74, 0.10, 0.84, 0.12, 0.94);
    s.lineTo(0.22, 0.86);
    s.bezierCurveTo(0.28, 0.80, 0.36, 0.70, 0.46, 0.58);
    s.bezierCurveTo(0.54, 0.50, 0.58, 0.42, 0.56, 0.34);
    s.bezierCurveTo(0.54, 0.28, 0.48, 0.26, 0.42, 0.30);
    s.lineTo(0.34, 0.34);
    s.bezierCurveTo(0.30, 0.24, 0.24, 0.14, 0.14, 0.08);
    s.bezierCurveTo(0.08, 0.05, 0.03, 0.04, 0.00, 0.02);
    return s;
}

export function buildKnightTemplate(seg, material, accent) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(lathe([
        [0, 0], [0.36, 0], [0.38, 0.045], [0.31, 0.10],
        [0.28, 0.18], [0.22, 0.26], [0.20, 0.42],
        [0.22, 0.50], [0.18, 0.54]
    ], seg), material);
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.20, 0.03, 8, 24), material);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.50;
    ring.castShadow = true;
    g.add(ring);

    const neck = new THREE.Mesh(lathe([
        [0, 0], [0.16, 0], [0.15, 0.18], [0.13, 0.36], [0.11, 0.48], [0, 0.50]
    ], Math.max(12, seg >> 1)), material);
    neck.position.set(0.02, 0.48, 0);
    neck.rotation.z = -0.18;
    neck.castShadow = true;
    g.add(neck);

    const extrude = new THREE.ExtrudeGeometry(knightHeadShape(), {
        depth: 0.22,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.03,
        bevelSegments: Math.max(2, seg >> 3),
        steps: 1
    });
    extrude.translate(0, 0, -0.11);
    const head = new THREE.Mesh(extrude, material);
    head.position.set(-0.06, 0.58, 0);
    head.rotation.y = Math.PI / 2;
    head.scale.set(0.95, 0.95, 1);
    head.castShadow = true;
    g.add(head);

    const earG = new THREE.ConeGeometry(0.045, 0.16, 8);
    const earL = new THREE.Mesh(earG, material);
    earL.position.set(0.02, 1.16, 0.07);
    earL.rotation.z = -0.35;
    earL.rotation.x = 0.25;
    earL.castShadow = true;
    const earR = earL.clone();
    earR.position.z = -0.07;
    earR.rotation.x = -0.25;
    g.add(earL, earR);

    const eyeG = new THREE.SphereGeometry(0.025, 10, 8);
    const eyeL = new THREE.Mesh(eyeG, accent);
    eyeL.position.set(0.22, 1.02, 0.09);
    const eyeR = eyeL.clone();
    eyeR.position.z = -0.09;
    g.add(eyeL, eyeR);

    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), accent);
    nostril.position.set(0.42, 0.90, 0.04);
    const nostril2 = nostril.clone();
    nostril2.position.z = -0.04;
    g.add(nostril, nostril2);

    g.userData.kind = 'n';
    return g;
}

export function makeMaterials(tex, theme = 'classic') {
    const ivory = new THREE.MeshPhysicalMaterial({
        color: 0xe4d2b4,
        map: tex.ivory.map,
        normalMap: tex.ivory.normalMap,
        roughnessMap: tex.ivory.roughnessMap,
        roughness: 0.34,
        metalness: 0.02,
        clearcoat: 0.45,
        clearcoatRoughness: 0.32,
        sheen: 0.12,
        sheenColor: new THREE.Color(0xe8d7b8),
        sheenRoughness: 0.6,
        envMapIntensity: 0.55
    });
    const ebony = new THREE.MeshPhysicalMaterial({
        color: 0x16100c,
        map: tex.ebony.map,
        normalMap: tex.ebony.normalMap,
        roughnessMap: tex.ebony.roughnessMap,
        roughness: 0.22,
        metalness: 0.08,
        clearcoat: 0.7,
        clearcoatRoughness: 0.18,
        sheen: 0.12,
        sheenColor: new THREE.Color(0x3a1c10),
        envMapIntensity: 0.85
    });
    const accentDark = new THREE.MeshPhysicalMaterial({
        color: 0x0a0604, roughness: 0.4, metalness: 0.2
    });
    const accentLight = new THREE.MeshPhysicalMaterial({
        color: 0x3a2418, roughness: 0.35, metalness: 0.15
    });

    if (theme === 'crystal') {
        const glassW = new THREE.MeshPhysicalMaterial({
            color: 0xf2fbff,
            roughness: 0.04,
            metalness: 0.05,
            transmission: 0.72,
            thickness: 0.55,
            ior: 1.52,
            clearcoat: 1,
            clearcoatRoughness: 0.04,
            attenuationColor: new THREE.Color(0xd8f0ff),
            attenuationDistance: 0.8,
            envMapIntensity: 1.6
        });
        const glassB = new THREE.MeshPhysicalMaterial({
            color: 0x1a0c08,
            roughness: 0.06,
            metalness: 0.35,
            transmission: 0.35,
            thickness: 0.5,
            ior: 1.5,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            attenuationColor: new THREE.Color(0x4a1808),
            attenuationDistance: 0.6,
            envMapIntensity: 1.8
        });
        const gold = new THREE.MeshPhysicalMaterial({
            color: 0xd4a657, roughness: 0.18, metalness: 1, envMapIntensity: 1.5
        });
        return {
            w: glassW, b: glassB, accentW: gold, accentB: gold, theme: 'crystal'
        };
    }

    return {
        w: ivory, b: ebony, accentW: accentLight, accentB: accentDark, theme: 'classic'
    };
}

export class PieceFactory {
    constructor(tex, quality) {
        this.seg = quality.seg;
        this.geos = buildPieceGeometries(quality.seg);
        this.tex = tex;
        this.mats = makeMaterials(tex, 'classic');
        this.knightW = buildKnightTemplate(quality.seg, this.mats.w, this.mats.accentW);
        this.knightB = buildKnightTemplate(quality.seg, this.mats.b, this.mats.accentB);
        this.knightW.visible = false;
        this.knightB.visible = false;
    }

    setTheme(theme) {
        this.mats = makeMaterials(this.tex, theme);
        this.knightW.traverse((o) => {
            if (o.isMesh) o.material = o.geometry.type === 'SphereGeometry' ? this.mats.accentW : this.mats.w;
        });
        this.knightB.traverse((o) => {
            if (o.isMesh) o.material = o.geometry.type === 'SphereGeometry' ? this.mats.accentB : this.mats.b;
        });
    }

    spawn(type, color) {
        if (type === 'n') {
            const src = color === 'w' ? this.knightW : this.knightB;
            const g = src.clone(true);
            g.visible = true;
            g.traverse((o) => {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                }
            });
            g.userData.kind = 'n';
            g.userData.color = color;
            if (color === 'b') g.rotation.y = Math.PI;
            return g;
        }
        const mesh = new THREE.Mesh(this.geos[type], color === 'w' ? this.mats.w : this.mats.b);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.kind = type;
        mesh.userData.color = color;
        return mesh;
    }
}
