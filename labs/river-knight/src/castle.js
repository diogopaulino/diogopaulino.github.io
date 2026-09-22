/**
 * O castelo de Morvain, a princesa na torre e a barcaça negra que bloqueia
 * o portão — todo o desfecho da jornada.
 */

import * as THREE from 'three';
import { headGeometry, limbGeometry } from '../../shared/realism.js';
import {
    buildLongship,
    buildBanner,
    stoneMaterial,
    metalMaterial,
    plainMaterial,
    woodMaterial
} from './models.js?v=22';
import { centerX, halfWidth, terrainHeight } from './river.js';
import { waterHeight, waterSlope } from './water.js?v=15';
import { COLORS, CASTLE_Z, SCORE } from './config.js?v=14';
import { clamp, damp, randRange } from './utils.js';

const tmpSlope = { dx: 0, dz: 0 };

/** Telhado de torre: beiral aberto e ponta mais íngreme que um cone liso. Altura e raio batem com o cone antigo. */
const towerRoofs = new Map();
function towerRoofGeometry(radius) {
    const key = radius.toFixed(2);
    if (towerRoofs.has(key)) return towerRoofs.get(key);
    const h = radius * 2.1;
    const base = radius * 1.3;
    const g = new THREE.LatheGeometry([
        new THREE.Vector2(base * 0.06, h * 0.5),
        new THREE.Vector2(base * 0.2, h * 0.34),
        new THREE.Vector2(base * 0.48, h * 0.08),
        new THREE.Vector2(base * 0.78, -h * 0.18),
        new THREE.Vector2(base * 1.12, -h * 0.46),
        new THREE.Vector2(base * 0.9, -h * 0.5)
    ], 16);
    g.computeVertexNormals();
    towerRoofs.set(key, g);
    return g;
}

/**
 * Fuste centrado, como o cilindro antigo: topo no raio pedido, base 12% mais larga.
 * Fiadas e pilastras nas diagonais, para não engolir janela nem estandarte.
 */
const towerShafts = new Map();
function towerShaftGeometry(radius, height) {
    const key = `${radius.toFixed(2)}x${height.toFixed(1)}`;
    if (towerShafts.has(key)) return towerShafts.get(key);
    const steps = 24;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = -height / 2 + t * height;
        const batter = radius * (1.12 - t * 0.12);
        const course = Math.sin(t * Math.PI * 10) > 0.7 ? radius * 0.035 : 0;
        pts.push(new THREE.Vector2(batter + course, y));
    }
    const g = new THREE.LatheGeometry(pts, 20);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const ang = Math.atan2(z, x);
        const r = Math.hypot(x, z) || 1;
        const t = (y + height / 2) / height;
        const q = -Math.cos(ang * 4);
        const butt = q > 0.45 ? radius * 0.07 * (1.2 - t * 0.35) : 0;
        const nr = r + butt;
        pos.setXYZ(i, (x / r) * nr, y, (z / r) * nr);
    }
    g.computeVertexNormals();
    towerShafts.set(key, g);
    return g;
}

/** Cornija moldada, centrada, no lugar do anel cilíndrico de altura 0.9. */
const towerLedges = new Map();
function towerLedgeGeometry(radius) {
    const key = radius.toFixed(2);
    if (towerLedges.has(key)) return towerLedges.get(key);
    const g = new THREE.LatheGeometry([
        new THREE.Vector2(radius * 1.02, -0.45),
        new THREE.Vector2(radius * 1.16, -0.22),
        new THREE.Vector2(radius * 1.32, 0.02),
        new THREE.Vector2(radius * 1.18, 0.22),
        new THREE.Vector2(radius * 1.06, 0.45)
    ], 18);
    g.computeVertexNormals();
    towerLedges.set(key, g);
    return g;
}

/** Ameia unitária centrada. A base alarga e o topo ganha um capitel. */
const MERLON = (() => {
    const g = new THREE.BoxGeometry(1, 1, 1, 2, 4, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const t = y + 0.5;
        x *= 1 + (1 - t) * 0.14;
        z *= 1 + (1 - t) * 0.08;
        if (y > 0.15) y += (0.5 - Math.abs(x)) * 0.28;
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
})();

/**
 * Cais 12×3×26, centrado como a caixa antiga. Talude na base, fiadas,
 * pilastras na face longa e uma copeira na borda de cima.
 */
const DOCK_GEO = (() => {
    const g = new THREE.BoxGeometry(12, 3, 26, 8, 8, 14);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        let x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const ax = Math.abs(x);
        const az = Math.abs(z);
        const t = (y + 1.5) / 3;
        if (ax > 5.9) x = Math.sign(x) * (6 * (1 + (1 - t) * 0.045));
        if (az > 12.9) z = Math.sign(z) * (13 * (1 + (1 - t) * 0.02));
        if (y < 1.35 && ax > 5.9) {
            const rib = Math.max(0, Math.sin(z * 1.15)) ** 4;
            x += Math.sign(x) * rib * 0.32;
        }
        if (y < 1.35 && (ax > 5.9 || az > 12.9)) {
            const course = Math.sin((y + 1.5) * Math.PI * 4);
            const lip = course > 0.7 ? 0.11 : 0;
            if (ax > 5.9) x += Math.sign(x) * lip;
            if (az > 12.9) z += Math.sign(z) * lip;
        }
        if (y > 1.4 && (ax > 5.15 || az > 11.6)) {
            y += 0.1;
            if (ax > 5.9) x += Math.sign(x) * 0.08;
            if (az > 12.9) z += Math.sign(z) * 0.08;
        } else if (y > 1.4 && ax < 5.2 && az < 11.6) {
            y -= 0.05;
        }
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
})();

const BOLLARD_GEO = new THREE.LatheGeometry([
    new THREE.Vector2(0.16, -0.32),
    new THREE.Vector2(0.22, -0.08),
    new THREE.Vector2(0.18, 0.12),
    new THREE.Vector2(0.3, 0.26),
    new THREE.Vector2(0.2, 0.36)
], 10);

/** Duas águas sobre o salão 26×18. Perfil em X, extrusão no Z, rotateY deita a cumeeira no comprimento. */
/**
 * Pilar da muralha, centrado. Comprimento em X, espessura em Z, altura 22.
 * As pilastras saem na face do rio e na face de dentro; o vão do portão
 * permanece na largura original.
 */
function curtainPierGeometry(length) {
    const hl = length / 2;
    const hd = 3.6;
    const jut = 0.62;
    const pilW = 1.55;
    const pitch = 3.5;
    const spots = [];
    for (let x = -hl + 2.4; x + pilW < hl - 1.6; x += pitch) spots.push(x);
    const pts = [[-hl, -hd]];
    for (const x of spots) {
        pts.push([x, -hd], [x, -hd - jut], [x + pilW, -hd - jut], [x + pilW, -hd]);
    }
    pts.push([hl, -hd], [hl, hd]);
    for (let i = spots.length - 1; i >= 0; i--) {
        const x = spots[i];
        pts.push([x + pilW, hd], [x + pilW, hd + jut], [x, hd + jut], [x, hd]);
    }
    pts.push([-hl, hd]);
    const shape = new THREE.Shape();
    shape.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][0], pts[i][1]);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 22, bevelEnabled: false, curveSegments: 1 });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const batter = 1.035 - (z / 22) * 0.05;
        const course = Math.sin(z * 1.7) * 0.055;
        const len = Math.hypot(x, y) || 1;
        pos.setXY(i, x + (x / len) * course * 0.35, y * batter + (y / len) * course);
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    g.translate(0, -11, 0);
    return g;
}

/** Lintél com arco de volta perfeita. Y da Shape já é a altura no mundo. */
function curtainArchGeometry(span) {
    const half = span / 2;
    const springX = (span - 3) / 2;
    const springY = 14;
    const crownY = 18.4;
    const top = 22;
    const shape = new THREE.Shape();
    shape.moveTo(-half, top);
    shape.lineTo(half, top);
    shape.lineTo(half, springY);
    shape.lineTo(springX, springY);
    const seg = 18;
    for (let i = 1; i <= seg; i++) {
        const a = (Math.PI * i) / seg;
        shape.lineTo(Math.cos(a) * springX, springY + Math.sin(a) * (crownY - springY));
    }
    shape.lineTo(-half, springY);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 7.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 1 });
    g.translate(0, 0, -3.8);
    g.computeVertexNormals();
    return g;
}

/**
 * Salão 26×16×18. A planta entra na Shape com y = −z; depois de
 * rotateX(−π/2) a extrusão vira a altura e a malha fica centrada em Y.
 * Contrafortes e fiadas cabem debaixo do beiral (vão de 30×22).
 */
function hallBodyGeometry() {
    const world = [
        [-13, -9], [-8.2, -9], [-8.2, -9.75], [-6.7, -9.75], [-6.7, -9],
        [-2.2, -9], [-2.2, -9.75], [-0.7, -9.75], [-0.7, -9],
        [2.4, -9], [2.4, -9.75], [3.9, -9.75], [3.9, -9],
        [7.6, -9], [7.6, -9.75], [9.1, -9.75], [9.1, -9], [13, -9],
        [13, -4.2], [13.75, -4.2], [13.75, -2.5], [13, -2.5],
        [13, 1.6], [13.75, 1.6], [13.75, 3.3], [13, 3.3], [13, 9],
        [9.1, 9], [9.1, 9.75], [7.6, 9.75], [7.6, 9],
        [3.9, 9], [3.9, 9.75], [2.4, 9.75], [2.4, 9],
        [-0.7, 9], [-0.7, 9.75], [-2.2, 9.75], [-2.2, 9],
        [-6.7, 9], [-6.7, 9.75], [-8.2, 9.75], [-8.2, 9], [-13, 9],
        [-13, 3.3], [-13.75, 3.3], [-13.75, 1.6], [-13, 1.6],
        [-13, -2.5], [-13.75, -2.5], [-13.75, -4.2], [-13, -4.2]
    ];
    const shape = new THREE.Shape();
    const last = world.length - 1;
    shape.moveTo(world[last][0], -world[last][1]);
    for (let i = last - 1; i >= 0; i--) shape.lineTo(world[i][0], -world[i][1]);
    shape.closePath();
    const g = new THREE.ExtrudeGeometry(shape, { depth: 16, bevelEnabled: false, curveSegments: 1 });
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const t = z / 16;
        const batter = 1.045 - t * 0.07;
        const course = Math.sin(z * 2.2) * 0.07;
        const block = Math.sin(x * 1.4 + y * 0.8) * 0.03;
        const len = Math.hypot(x, y) || 1;
        pos.setXY(i, x * batter + (x / len) * (course + block), y * batter + (y / len) * (course + block));
    }
    g.computeVertexNormals();
    g.rotateX(-Math.PI / 2);
    g.translate(0, -8, 0);
    return g;
}

function hallRoofGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-11.2, 0);
    s.lineTo(0, 7.4);
    s.lineTo(11.2, 0);
    s.lineTo(10.4, -0.55);
    s.lineTo(-10.4, -0.55);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 30,
        bevelEnabled: true,
        bevelThickness: 0.12,
        bevelSize: 0.16,
        bevelSegments: 1,
        curveSegments: 2
    });
    g.translate(0, 0, -15);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

/* ================================================================== */
/* Castelo                                                             */
/* ================================================================== */

function buildTower(radius, height, { roof = true, tint = '#8a877f' } = {}) {
    const group = new THREE.Group();
    const stone = stoneMaterial(tint);

    const body = new THREE.Mesh(towerShaftGeometry(radius, height), stone);
    body.name = 'towerShaft';
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const ledge = new THREE.Mesh(towerLedgeGeometry(radius), stone);
    ledge.position.y = height + 0.3;
    ledge.castShadow = true;
    group.add(ledge);

    const merlonCount = Math.max(8, Math.round(radius * 5));
    for (let i = 0; i < merlonCount; i++) {
        const a = (i / merlonCount) * Math.PI * 2;
        const merlon = new THREE.Mesh(MERLON, stone);
        merlon.scale.set(radius * 0.42, 1.1, radius * 0.34);
        merlon.position.set(Math.cos(a) * radius * 1.06, height + 1.2, Math.sin(a) * radius * 1.06);
        merlon.rotation.y = -a;
        merlon.castShadow = true;
        group.add(merlon);
    }

    if (roof) {
        const cone = new THREE.Mesh(
            towerRoofGeometry(radius),
            plainMaterial(COLORS.roof, 0.75, 0.05)
        );
        cone.position.y = height + radius * 1.05 + 1.6;
        cone.castShadow = true;
        group.add(cone);

        const finial = new THREE.Mesh(
            new THREE.SphereGeometry(radius * 0.16, 8, 8),
            metalMaterial(0xd9b45c, 0.35)
        );
        finial.position.y = height + radius * 2.1 + 1.8;
        group.add(finial);

        const banner = buildBanner('#5a1220', '#f3c96b', radius * 0.9, radius * 1.6);
        banner.position.set(radius * 0.5, height + radius * 1.9, 0);
        group.add(banner);
    }

    return group;
}

function buildTorch(color = 0xff9a3c, intensity = 9) {
    const group = new THREE.Group();
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 6), metalMaterial(0x4a4139, 0.6));
    group.add(bracket);
    const flame = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 8, 8),
        plainMaterial(0xffc477, 0.4, 0, 0xff7a20, 3.2)
    );
    flame.position.y = 0.45;
    flame.scale.y = 1.5;
    group.add(flame);
    const light = new THREE.PointLight(color, intensity, 26, 2);
    light.position.y = 0.6;
    group.add(light);
    group.userData.flame = flame;
    group.userData.light = light;
    return group;
}

/** A princesa acenando na janela da torre. */
function buildPrincess() {
    const group = new THREE.Group();
    const skin = plainMaterial(0xf0c9a4, 0.75, 0);
    const hairMat = plainMaterial(0x6b3b1c, 0.8, 0);
    const gold = metalMaterial(0xf0cf7a, 0.3);

    const dress = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.08, 0),
        new THREE.Vector2(0.46, 0.08),
        new THREE.Vector2(0.38, 0.55),
        new THREE.Vector2(0.2, 1.02)
    ], 16), plainMaterial(COLORS.princess, 0.7, 0.03));
    dress.position.y = 0.02;
    group.add(dress);

    const hem = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 14), metalMaterial(0xf3c96b, 0.45));
    hem.rotation.x = Math.PI / 2;
    hem.position.y = 0.08;
    group.add(hem);

    const bodice = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.16, 0),
        new THREE.Vector2(0.2, 0.08),
        new THREE.Vector2(0.18, 0.28),
        new THREE.Vector2(0.14, 0.4)
    ], 14), plainMaterial(0xb85a8a, 0.7, 0.03));
    bodice.position.y = 1.02;
    group.add(bodice);

    const head = new THREE.Mesh(headGeometry(0.16, 'human'), skin);
    head.position.y = 1.58;
    group.add(head);

    for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), plainMaterial(0x2a1c12, 0.5, 0));
        eye.position.set(sx * 0.05, 1.6, 0.15);
        group.add(eye);
    }

    const hair = new THREE.Mesh(new THREE.LatheGeometry([
        new THREE.Vector2(0.03, 0),
        new THREE.Vector2(0.17, 0.03),
        new THREE.Vector2(0.18, 0.12),
        new THREE.Vector2(0.06, 0.2)
    ], 14), hairMat);
    hair.position.set(0, 1.5, -0.02);
    group.add(hair);

    const braid = new THREE.Mesh(limbGeometry({
        length: 0.85, r0: 0.055, r1: 0.02, bulge: 0.012, bulgeAt: 0.2, pinch: 0, seg: 8, rings: 6
    }), hairMat);
    braid.position.set(0.04, 1.55, -0.08);
    braid.rotation.x = 0.15;
    group.add(braid);

    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 10), gold);
    crown.position.y = 1.74;
    group.add(crown);
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.14, 5), gold);
        spike.position.set(Math.cos(a) * 0.12, 1.84, Math.sin(a) * 0.12);
        group.add(spike);
    }

    const arm = new THREE.Group();
    arm.position.set(0.24, 1.38, 0.06);
    const armMesh = new THREE.Mesh(limbGeometry({
        length: 0.48, r0: 0.055, r1: 0.04, bulge: 0.01, bulgeAt: 0.35, pinch: 0.1, seg: 8, rings: 5
    }), skin);
    armMesh.position.y = 0;
    arm.add(armMesh);
    group.add(arm);

    const scarf = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.28), new THREE.MeshStandardMaterial({
        color: 0xffe9f2,
        side: THREE.DoubleSide,
        roughness: 0.9,
        emissive: new THREE.Color(0xffc8d8),
        emissiveIntensity: 0.25
    }));
    scarf.position.set(0.32, -0.44, 0.04);
    arm.add(scarf);

    group.traverse((c) => {
        c.castShadow = true;
    });

    group.userData.arm = arm;
    group.userData.scarf = scarf;
    return group;
}

/**
 * Monta o castelo sobre o rio: duas alas nas margens, muralha com portão
 * levadiço sobre a água e a torre da princesa.
 */
/** Laje 6.4×0.7×3.4, centrada. Bico na face +Z, que aponta para o rio. */
function balconySlabGeometry() {
    const s = new THREE.Shape();
    s.moveTo(1.7, 0.35);
    s.lineTo(-1.5, 0.35);
    s.lineTo(-1.88, 0.2);
    s.lineTo(-1.72, 0.02);
    s.lineTo(-1.48, -0.12);
    s.lineTo(-1.48, -0.35);
    s.lineTo(1.55, -0.35);
    s.lineTo(1.7, 0.02);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, {
        depth: 6.4,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.04,
        bevelSegments: 1
    });
    g.translate(0, 0, -3.2);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

/** Balaústre de 1.5, centrado. Base, barriga e capitel. */
function balusterGeometry() {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        const y = (t - 0.5) * 1.5;
        let r = 0.1;
        r += 0.11 * Math.exp(-((t - 0.12) ** 2) / 0.006);
        r += 0.07 * Math.exp(-((t - 0.48) ** 2) / 0.014);
        r += 0.1 * Math.exp(-((t - 0.86) ** 2) / 0.005);
        if (t < 0.05 || t > 0.95) r = 0.2;
        pts.push(new THREE.Vector2(r, y));
    }
    const g = new THREE.LatheGeometry(pts, 10);
    g.computeVertexNormals();
    return g;
}

/** Corrimão ao longo de X, seção abaulada. */
function balconyRailGeometry() {
    const s = new THREE.Shape();
    s.moveTo(-0.16, -0.08);
    s.lineTo(-0.1, 0.06);
    s.quadraticCurveTo(0, 0.14, 0.1, 0.06);
    s.lineTo(0.16, -0.08);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 6.5, bevelEnabled: false });
    g.translate(0, 0, -3.25);
    g.rotateY(Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

/** Mísula sob o bico. +X local vira +Z depois de rotateY(−π/2). */
function corbelGeometry() {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.62, 0);
    s.quadraticCurveTo(0.48, -0.16, 0.12, -0.46);
    s.lineTo(0, -0.46);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: false });
    g.translate(0, 0, -0.19);
    g.rotateY(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
}

const BALCONY_SLAB = balconySlabGeometry();
const BALUSTER = balusterGeometry();
const BALCONY_RAIL = balconyRailGeometry();
const CORBEL = corbelGeometry();

export function createCastle(scene) {
    const group = new THREE.Group();
    const z = CASTLE_Z;
    const cx = centerX(z);
    const hw = halfWidth(z);
    const stone = stoneMaterial('#8a877f');

    group.position.set(cx, 0, z);
    scene.add(group);

    // ---- Muralha atravessando o rio ----
    // A muralha é feita de dois blocos laterais e um arco: o vão central é o
    // portão de água por onde o drakkar passa.
    const wallWidth = hw * 2 + 44;
    const gateWidth = hw * 1.5;
    const pierLength = (wallWidth - gateWidth) / 2;
    const gapLeft = new THREE.Mesh(curtainPierGeometry(pierLength), stone);
    gapLeft.name = 'curtainPier';
    gapLeft.position.set(-(gateWidth + pierLength) / 2, 11, 0);
    gapLeft.castShadow = true;
    group.add(gapLeft);
    const gapRight = gapLeft.clone();
    gapRight.position.x *= -1;
    group.add(gapRight);

    const arch = new THREE.Mesh(curtainArchGeometry(gateWidth + 3), stone);
    arch.name = 'curtainArch';
    arch.position.set(0, 0, 0);
    arch.castShadow = true;
    group.add(arch);

    // Ameias no topo da muralha.
    const merlons = Math.round(wallWidth / 3.2);
    for (let i = 0; i < merlons; i++) {
        const m = new THREE.Mesh(MERLON, stone);
        m.scale.set(1.7, 1.8, 6.6);
        m.position.set(-wallWidth / 2 + 1.6 + i * 3.2, 23, 0);
        m.castShadow = true;
        group.add(m);
    }

    // ---- Portão / grade levadiça ----
    const gate = new THREE.Group();
    const gateMat = woodMaterial(true, 0x4a3016);
    for (let i = 0; i < 9; i++) {
        const bar = new THREE.Mesh(GATE_BAR, gateMat);
        bar.name = 'gateBar';
        bar.position.set(-gateWidth / 2 + 1 + i * (gateWidth - 2) / 8, 8, 0);
        bar.castShadow = true;
        gate.add(bar);
    }
    for (let i = 0; i < 4; i++) {
        const rail = new THREE.Mesh(GATE_RAIL, metalMaterial(0x50483d, 0.55));
        rail.name = 'gateRail';
        rail.rotation.z = Math.PI / 2;
        rail.scale.y = gateWidth - 1;
        rail.position.set(0, 1.6 + i * 4.6, 0);
        gate.add(rail);
    }
    for (let i = 0; i < 9; i++) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.7, 6), metalMaterial(0x8b8579, 0.4));
        spike.position.set(-gateWidth / 2 + 1 + i * (gateWidth - 2) / 8, 0, 0);
        spike.rotation.x = Math.PI;
        gate.add(spike);
    }
    group.add(gate);

    // ---- Torres ----
    const towers = [];
    const towerSpots = [
        { x: -gateWidth / 2 - 7, r: 4.4, h: 26, roof: true },
        { x: gateWidth / 2 + 7, r: 4.4, h: 26, roof: true },
        { x: -wallWidth / 2 + 5, r: 3.4, h: 19, roof: true },
        { x: wallWidth / 2 - 5, r: 3.4, h: 19, roof: true }
    ];
    for (const spot of towerSpots) {
        const tower = buildTower(spot.r, spot.h, { roof: spot.roof });
        tower.position.set(spot.x, 0, 0);
        group.add(tower);
        towers.push(tower);
    }

    // A margem interna do castelo: tudo fica ao lado do canal, para que o
    // drakkar consiga atravessar o portão e chegar às docas.
    const sideOffset = gateWidth / 2 + 13;

    // ---- Torre da princesa (mais alta, atrás da muralha) ----
    const keepX = sideOffset;
    const keepZ = -34;
    const keepRadius = 6.2;
    const keep = buildTower(keepRadius, 40, { tint: '#948f85' });
    keep.position.set(keepX, 0, keepZ);
    group.add(keep);

    // Sacada voltada para o rio, onde a princesa aparece.
    const balconyZ = keepZ + keepRadius + 1.1;
    const balcony = new THREE.Mesh(BALCONY_SLAB, stone);
    balcony.name = 'balconySlab';
    balcony.position.set(keepX, 32.9, balconyZ);
    balcony.castShadow = true;
    group.add(balcony);

    for (let i = -2; i <= 2; i++) {
        const baluster = new THREE.Mesh(BALUSTER, stone);
        baluster.name = 'balconyBaluster';
        baluster.position.set(keepX + i * 1.5, 34, balconyZ + 1.4);
        group.add(baluster);
    }
    const rail = new THREE.Mesh(BALCONY_RAIL, stone);
    rail.name = 'balconyRail';
    rail.position.set(keepX, 34.82, balconyZ + 1.4);
    group.add(rail);
    for (const dx of [-1.8, 0, 1.8]) {
        const corbel = new THREE.Mesh(CORBEL, stone);
        corbel.name = 'balconyCorbel';
        corbel.position.set(keepX + dx, 32.55, balconyZ + 1.15);
        group.add(corbel);
    }

    const window_ = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 3.8, 0.4),
        plainMaterial(0xffdca8, 0.5, 0, 0xffb45c, 1.8)
    );
    window_.position.set(keepX, 35.6, keepZ + keepRadius - 0.2);
    group.add(window_);

    const windowLight = new THREE.PointLight(0xffb45c, 30, 52, 2);
    windowLight.position.set(keepX, 35.6, keepZ + keepRadius + 0.8);
    group.add(windowLight);

    // Luz quente só para a princesa: sem ela a torre vira silhueta no crepúsculo.
    const princessLight = new THREE.PointLight(0xffd9a8, 22, 32, 2);
    princessLight.position.set(keepX, 36.5, balconyZ + 3.5);
    group.add(princessLight);

    const princess = buildPrincess();
    princess.position.set(keepX, 33.3, balconyZ + 0.2);
    princess.scale.setScalar(1.8);
    group.add(princess);

    // ---- Corpo do castelo (blocos atrás da muralha) ----
    const hall = new THREE.Mesh(hallBodyGeometry(), stone);
    hall.position.set(-sideOffset - 6, 8, -26);
    hall.castShadow = true;
    hall.receiveShadow = true;
    group.add(hall);

    const roof = new THREE.Mesh(
        hallRoofGeometry(),
        plainMaterial(COLORS.roof, 0.78, 0.04)
    );
    roof.position.set(-sideOffset - 6, 16, -26);
    roof.castShadow = true;
    group.add(roof);

    // ---- Tochas ----
    const torches = [];
    const torchSpots = [
        [-gateWidth / 2 - 1.4, 12, 3.6],
        [gateWidth / 2 + 1.4, 12, 3.6],
        [-gateWidth / 2 - 7, 27, 0],
        [gateWidth / 2 + 7, 27, 0]
    ];
    for (const [tx, ty, tz] of torchSpots) {
        const torch = buildTorch();
        torch.position.set(tx, ty, tz);
        group.add(torch);
        torches.push(torch);
    }

    // ---- Docas de pedra junto às margens ----
    for (const side of [-1, 1]) {
        const dockX = side * (hw + 6);
        const dock = new THREE.Group();
        dock.name = 'dock';
        const body = new THREE.Mesh(DOCK_GEO, stone);
        body.castShadow = true;
        body.receiveShadow = true;
        dock.add(body);
        for (const dz of [-8, -2.5, 3.5, 9]) {
            const post = new THREE.Mesh(BOLLARD_GEO, stone);
            post.position.set(-side * 4.7, 1.82, dz);
            post.castShadow = true;
            dock.add(post);
        }
        const groundY = terrainHeight(cx + dockX, z + 16);
        dock.position.set(dockX, Math.max(0.5, groundY * 0.4), 16);
        group.add(dock);
    }

    let gateOpen = 0;
    let gateTarget = 0;

    return {
        group,
        princess,
        z,
        centerX: cx,
        gateWidth,
        princessWorld: new THREE.Vector3(cx + keepX, 35.6, z + balconyZ + 0.2),
        openGate() {
            gateTarget = 1;
        },
        get gateProgress() {
            return gateOpen;
        },
        update(dt, time) {
            gateOpen = damp(gateOpen, gateTarget, 1.1, dt);
            gate.position.y = gateOpen * 15.5;

            for (const torch of torches) {
                const flame = torch.userData.flame;
                const light = torch.userData.light;
                const flicker = 0.82 + Math.sin(time * 11 + torch.position.x) * 0.12 + Math.random() * 0.06;
                flame.scale.set(flicker, flicker * 1.5, flicker);
                light.intensity = 9 * flicker;
            }

            windowLight.intensity = 22 + Math.sin(time * 3.1) * 3;

            const arm = princess.userData.arm;
            arm.rotation.z = -0.6 + Math.sin(time * 4.2) * 0.75;
            princess.rotation.y = Math.sin(time * 0.8) * 0.2;
        },
        emitTorchSparks(effects) {
            for (const torch of torches) {
                if (Math.random() < 0.25) {
                    const p = new THREE.Vector3();
                    torch.getWorldPosition(p);
                    effects.fire(p.x, p.y + 0.4, p.z, 1, 0.7);
                }
            }
        }
    };
}

/* ================================================================== */
/* Barcaça Negra (chefe)                                               */
/* ================================================================== */

/**
 * Rostro de bronze, centrado como o cone de altura 5. A ponta fica em +Y.
 * Flange de fixação, dois anéis e um bico rombo — não um cone liso.
 * Seis caneluras no haste.
 */
function bossRamGeometry() {
    const pts = [
        [1.35, -2.5],
        [1.72, -2.22],
        [0.92, -1.82],
        [0.58, -1.15],
        [0.78, -0.72],
        [0.48, 0.05],
        [0.74, 0.55],
        [0.44, 1.25],
        [0.66, 1.78],
        [0.82, 2.12],
        [0.36, 2.36],
        [0.18, 2.5]
    ];
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 20);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const rad = Math.hypot(x, z);
        if (rad < 0.22 || y < -2.05 || y > 2.05) continue;
        const flute = Math.cos(Math.atan2(z, x) * 6);
        const depth = flute > 0 ? 0.09 * flute * flute : -0.045 * flute * flute;
        const k = 1 + depth / rad;
        pos.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    return g;
}

/** Tambor da balista, centrado como o cilindro de altura 3.4. Barril com aros. */
function ballistaDrumGeometry() {
    const H = 3.4;
    const pts = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const y = (t - 0.5) * H;
        const belly = Math.sin(t * Math.PI);
        let r = 1.32 + belly * 0.48;
        if (t < 0.07 || t > 0.93) r += 0.16;
        if (Math.abs(Math.sin(t * Math.PI * 5)) > 0.86) r += 0.16;
        pts.push(new THREE.Vector2(r, y));
    }
    const g = new THREE.LatheGeometry(pts, 18);
    g.computeVertexNormals();
    return g;
}

/** Arco da balista: prod curvo no lugar da viga reta. Corda no plano y=0. */
function ballistaBowGeometry() {
    const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-2.15, 0, 0),
        new THREE.Vector3(0, 0.55, 0.42),
        new THREE.Vector3(2.15, 0, 0)
    );
    return new THREE.TubeGeometry(curve, 18, 0.15, 8, false);
}

const BOSS_RAM = bossRamGeometry();
const BALLISTA_DRUM = ballistaDrumGeometry();
const BALLISTA_BOW = ballistaBowGeometry();

/**
 * Trave da grade, centrada como a caixa 0.42×16×0.42.
 * Seção quadrada com chanfro; a base afina para o espigão.
 */
function gateBarGeometry() {
    const H = 16;
    const pts = [];
    for (let i = 0; i <= 18; i++) {
        const t = i / 18;
        const y = (t - 0.5) * H;
        let r = 0.18;
        if (t < 0.08) r = 0.07 + (t / 0.08) * 0.11;
        const band = Math.cos((t - 0.22) * Math.PI * 6);
        if (band > 0.72) r += 0.045;
        pts.push(new THREE.Vector2(r, y));
    }
    const g = new THREE.LatheGeometry(pts, 8);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const rad = Math.hypot(x, z);
        if (rad < 1e-4) continue;
        const ang = Math.atan2(z, x);
        const corner = Math.max(Math.abs(Math.cos(ang)), Math.abs(Math.sin(ang)));
        const k = 0.28 + 0.72 / corner;
        pos.setXYZ(i, x * k, y, z * k);
    }
    g.computeVertexNormals();
    return g;
}

/** Cinta de ferro de comprimento 1, ao longo de Y. O portão escala Y e gira para X. */
function gateRailGeometry() {
    const pts = [
        [0.16, -0.5],
        [0.28, -0.38],
        [0.2, -0.22],
        [0.24, 0],
        [0.2, 0.22],
        [0.28, 0.38],
        [0.16, 0.5]
    ];
    const g = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 10);
    g.computeVertexNormals();
    return g;
}

const GATE_BAR = gateBarGeometry();
const GATE_RAIL = gateRailGeometry();

export class BossBarge {
    constructor(scene) {
        const group = new THREE.Group();
        this.group = group;
        this.scene = scene;

        const { group: hull, parts } = buildLongship({
            length: 30,
            beam: 8.5,
            hullColor: 0x241a16,
            sailBase: '#1a1420',
            sailStripe: '#7a1220',
            emblem: 'rune',
            shields: true,
            oars: true,
            dragon: true,
            lantern: false
        });
        hull.scale.set(1, 1.25, 1);
        group.add(hull);
        this.hullGroup = hull;
        this.parts = parts;

        // Rostro na proa (+Z), bico para a frente do rio.
        const ram = new THREE.Mesh(BOSS_RAM, metalMaterial(0x6a5a42, 0.42));
        ram.name = 'bossRam';
        ram.rotation.x = -Math.PI / 2;
        ram.position.set(0, 0.05, 16.6);
        ram.castShadow = true;
        group.add(ram);

        // Torres de balista.
        this.ballistae = [];
        for (const side of [-1, 1]) {
            const tower = new THREE.Group();
            const base = new THREE.Mesh(BALLISTA_DRUM, woodMaterial(true, 0x2b2018));
            base.name = 'ballistaDrum';
            base.position.y = 1.7;
            base.castShadow = true;
            tower.add(base);

            const bow = new THREE.Mesh(BALLISTA_BOW, woodMaterial(true, 0x3b2a1c));
            bow.name = 'ballistaBow';
            bow.position.y = 3.55;
            tower.add(bow);

            const brazier = new THREE.Mesh(
                new THREE.SphereGeometry(0.55, 10, 8),
                plainMaterial(0xff9a4a, 0.4, 0, 0xff5a10, 3)
            );
            brazier.position.y = 4.1;
            tower.add(brazier);
            tower.userData.brazier = brazier;

            const light = new THREE.PointLight(0xff6a2a, 14, 30, 2);
            light.position.y = 4.2;
            tower.add(light);
            tower.userData.light = light;

            tower.position.set(side * 3.4, 1.4, side * 3);
            group.add(tower);
            this.ballistae.push(tower);
        }

        // Estandarte do vilão.
        const banner = buildBanner('#12070c', '#c0303c', 2.4, 4.6);
        banner.position.set(0, 9.5, 6);
        group.add(banner);

        group.visible = false;
        scene.add(group);

        this.maxHp = 20;
        this.hp = this.maxHp;
        this.active = false;
        this.dying = 0;
        this.radius = 9;
        this.fireTimer = 0;
        this.lane = 0;
        this.laneTimer = 0;
        this.z = 0;
        this.enraged = false;
    }

    spawn(z, difficulty) {
        this.z = z;
        this.hp = this.maxHp;
        this.active = true;
        this.dying = 0;
        this.enraged = false;
        this.fireTimer = 2.2;
        this.lane = 0;
        this.laneTimer = 0;
        this.difficulty = difficulty;
        this.group.visible = true;
        this.group.position.set(centerX(z), 0, z);
        this.group.rotation.set(0, 0, 0);
        this.group.scale.setScalar(1);
    }

    get healthRatio() {
        return clamp(this.hp / this.maxHp, 0, 1);
    }

    update(dt, ctx) {
        if (!this.active) return;
        const pos = this.group.position;

        if (this.dying > 0) {
            this.dying += dt;
            pos.y -= dt * 1.1;
            this.group.rotation.z += dt * 0.35;
            this.group.rotation.x += dt * 0.12;
            if (Math.random() < 0.9) {
                ctx.effects.fire(
                    pos.x + randRange(-7, 7),
                    pos.y + randRange(0, 5),
                    pos.z + randRange(-12, 12),
                    2,
                    1.4
                );
                ctx.effects.smokePuff(pos.x + randRange(-6, 6), pos.y + 3, pos.z + randRange(-10, 10), 2, 2.4);
            }
            if (this.dying > 4.5) {
                this.active = false;
                this.group.visible = false;
            }
            return;
        }

        // Recua devagar em direção ao castelo conforme perde vida.
        const retreat = (1 - this.healthRatio) * 26;
        const targetZ = this.z - retreat;

        // Persegue lateralmente o jogador para bloquear a passagem.
        this.laneTimer -= dt;
        if (this.laneTimer <= 0) {
            this.laneTimer = randRange(1.1, 2.2);
            const playerLane = (ctx.player.x - centerX(ctx.player.z)) / Math.max(1, halfWidth(ctx.player.z));
            this.lane = clamp(playerLane * 0.85 + randRange(-0.2, 0.2), -0.55, 0.55);
        }
        const targetX = centerX(pos.z) + this.lane * halfWidth(pos.z) * 0.8;

        pos.x = damp(pos.x, targetX, this.enraged ? 1.5 : 0.9, dt);
        pos.z = damp(pos.z, targetZ, 0.7, dt);
        pos.y = waterHeight(pos.x, pos.z, ctx.time) + 1.1;

        waterSlope(pos.x, pos.z, ctx.time, tmpSlope);
        this.group.rotation.z = -tmpSlope.dx * 1.2;
        this.group.rotation.x = tmpSlope.dz * 0.9;

        for (const oar of this.parts.oars) {
            oar.rotation.x = Math.sin(ctx.time * 2.1 + oar.userData.phase) * 0.5;
            oar.rotation.z = oar.userData.baseRoll - oar.userData.side * Math.sin(ctx.time * 2.1 + oar.userData.phase + 1.2) * 0.18;
        }

        for (const tower of this.ballistae) {
            const b = tower.userData.brazier;
            const s = 0.85 + Math.sin(ctx.time * 8 + tower.position.x) * 0.18;
            b.scale.set(s, s * 1.3, s);
            tower.userData.light.intensity = 12 * s;
            if (Math.random() < 0.3) {
                const p = new THREE.Vector3();
                b.getWorldPosition(p);
                ctx.effects.fire(p.x, p.y, p.z, 1, 0.9);
            }
        }

        // Salvas de flechas.
        this.fireTimer -= dt;
        if (this.fireTimer <= 0) {
            const rate = this.enraged ? 1.35 : 2.1;
            this.fireTimer = rate / (this.difficulty?.enemyFireScale || 1);
            const shots = this.enraged ? 5 : 3;
            for (let i = 0; i < shots; i++) {
                const spread = (i - (shots - 1) / 2) * 3.2;
                ctx.fireArrow(pos.x + spread, pos.y + 4.5, pos.z - 12, 1.15);
            }
            ctx.audio.sfx('arrow');
        }
    }

    hit(damage, ctx) {
        if (!this.active || this.dying > 0) return false;
        this.hp -= damage;
        const pos = this.group.position;
        ctx.effects.impact(pos.x + randRange(-4, 4), pos.y + randRange(1, 4), pos.z + randRange(-8, 8), 0xffb066);
        ctx.audio.sfx('hitWood');

        if (!this.enraged && this.healthRatio < 0.45) {
            this.enraged = true;
            ctx.onEnrage?.();
        }

        if (this.hp <= 0) {
            this.dying = 0.001;
            ctx.effects.explosion(pos.x, pos.y + 2, pos.z, 3.4, 0.06);
            ctx.effects.explosion(pos.x + 5, pos.y + 3, pos.z - 6, 2.4, 0.09);
            ctx.effects.explosion(pos.x - 5, pos.y + 1, pos.z + 6, 2.4, 0.05);
            ctx.audio.sfx('explosion', 1.4);
            ctx.onKill?.(SCORE.bossKill, pos);
            return true;
        }
        return false;
    }

    reset() {
        this.active = false;
        this.dying = 0;
        this.group.visible = false;
    }
}
