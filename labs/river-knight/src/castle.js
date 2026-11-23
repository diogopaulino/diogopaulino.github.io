/**
 * O castelo de Morvain, a princesa na torre e a barcaça negra que bloqueia
 * o portão — todo o desfecho da jornada.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createHero } from '../../shared/gfx/hero.js';
import { applyWorldUV } from '../../shared/gfx/core.js';
import { instanceModel } from '../../shared/gfx/assets.js';
import { castleStone, slateRoof, darkWood, iron, steel, plain, glow } from './materials.js?v=50';
import { buildFlame, bannerGeometry, bannerMaterial } from './structure-models.js?v=51';
import { tickStructures } from './structures.js?v=51';
import { fireLights } from './lights.js?v=50';
import { centerX, halfWidth, terrainHeight } from './river.js?v=51';
import { CASTLE_Z } from './config.js?v=51';
import { damp } from './utils.js?v=50';

// Materiais: tudo PBR real (materials.js). As funções abaixo só adaptam as
// chamadas antigas do arquivo aos conjuntos de textura do kit.
const stoneMaterial = () => castleStone();
const woodMaterial = () => darkWood(0xb09a84);
const metalMaterial = (color, roughness = 0.5) => (color > 0xc00000 ? steel(color, roughness) : iron(color));
const plainMaterial = (color, roughness = 0.7, metalness = 0, emissive = 0, intensity = 1) =>
    (emissive ? glow(emissive, intensity) : plain(color, roughness, metalness));
const ROOF = () => slateRoof(0xb9a6a0);

function buildBanner(colorA, colorB, width, height) {
    const mesh = new THREE.Mesh(
        bannerGeometry(width, height, { hang: true, base: new THREE.Color(colorA).getHex(), trim: new THREE.Color(colorB).getHex() }),
        bannerMaterial()
    );
    mesh.userData.dynamic = true;
    return mesh;
}

/**
 * Funde as malhas estáticas de `root` por material (1 draw call por material)
 * e projeta UV em metros do mundo — a textura de alvenaria fica na escala certa
 * em qualquer peça, sem depender da UV de cada geometria.
 * Malhas marcadas com `userData.dynamic` (ou dentro de um grupo marcado) ficam de fora.
 */
function bakeStatic(root) {
    root.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const byMat = new Map();
    const remove = [];
    root.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
        for (let p = o; p && p !== root; p = p.parent) if (p.userData.dynamic) return;
        let g = o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        if (g.index) g = g.toNonIndexed();
        for (const name of Object.keys(g.attributes)) {
            if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
        }
        if (!g.attributes.normal) g.computeVertexNormals();
        applyWorldUV(g, 1);
        if (!byMat.has(o.material)) byMat.set(o.material, []);
        byMat.get(o.material).push(g);
        remove.push(o);
    });
    for (const o of remove) o.parent.remove(o);
    for (const [material, list] of byMat) {
        const mesh = new THREE.Mesh(mergeGeometries(list, false), material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.name = `castle:${material.name}`;
        root.add(mesh);
    }
}


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
            ROOF()
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

function buildTorch() {
    const group = new THREE.Group();
    const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.7, 8), metalMaterial(0x4a4139, 0.6));
    group.add(bracket);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.12, 0.2, 10), metalMaterial(0x4a4139, 0.6));
    cup.position.y = 0.4;
    group.add(cup);
    const flame = buildFlame(0.7, 1.3);
    flame.position.y = 0.5;
    flame.userData.dynamic = true;
    group.add(flame);
    group.userData.flame = flame;
    return group;
}

/** A princesa acenando na janela da torre. */
function buildPrincess(detail) {
    // Heroína de corpo inteiro (gfx/hero.js): acena da sacada e comemora na vitória.
    const hero = createHero({ preset: 'princess', detail });
    hero.object.userData.dynamic = true;
    return hero;
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

/** Ogiva da janela da princesa. t=0 na lateral, t=1 no cume. */
function lancetY(u, spring, crown) {
    const t = 1 - Math.abs(u);
    return spring + (crown - spring) * Math.pow(Math.max(t, 0), 0.62);
}

function lancetOutline(shape, halfW, bottom, spring, crown, steps, clockwise) {
    const sign = clockwise ? 1 : -1;
    shape.moveTo(sign * halfW, bottom);
    shape.lineTo(sign * halfW, spring);
    for (let i = 1; i <= steps; i++) {
        const u = sign * (1 - (i / steps) * 2);
        shape.lineTo(u * halfW, lancetY(u, spring, crown));
    }
    shape.lineTo(-sign * halfW, bottom);
    shape.closePath();
}

/** Moldura 2.6×3.8, centrada como a caixa antiga, com vão ogival. */
function princessFrameGeometry() {
    const shape = new THREE.Shape();
    lancetOutline(shape, 1.3, -1.9, 0.22, 1.9, 18, false);
    const hole = new THREE.Path();
    lancetOutline(hole, 1.02, -1.52, 0.22, 1.46, 16, true);
    shape.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(shape, {
        depth: 0.42,
        bevelEnabled: true,
        bevelThickness: 0.035,
        bevelSize: 0.03,
        bevelSegments: 1,
        curveSegments: 1
    });
    g.translate(0, 0, -0.21);
    g.computeVertexNormals();
    return g;
}

/** Vidro do vão, um pouco atrás da face externa. */
function princessGlassGeometry() {
    const shape = new THREE.Shape();
    lancetOutline(shape, 0.98, -1.48, 0.26, 1.4, 16, false);
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false, curveSegments: 1 });
    g.translate(0, 0, -0.08);
    g.computeVertexNormals();
    return g;
}

/** Mainel do vão de baixo, centrado em Y. Base e capitel mais largos. */
function princessMullionGeometry() {
    const H = 1.7;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
        const t = i / 10;
        const y = (t - 0.5) * H;
        let r = 0.055;
        if (t < 0.1) r += (1 - t / 0.1) * 0.04;
        if (t > 0.86) r += ((t - 0.86) / 0.14) * 0.035;
        pts.push(new THREE.Vector2(r, y));
    }
    const g = new THREE.LatheGeometry(pts, 8);
    g.computeVertexNormals();
    return g;
}

/** Travessa na linha de imposta, com nervura na face externa. */
function princessTransomGeometry() {
    const g = new THREE.BoxGeometry(2.0, 0.16, 0.36, 10, 2, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const nx = Math.abs(x) / 1.0;
        if (z > 0.04) z += 0.04 * (1 - nx * 0.35);
        if (Math.abs(y) > 0.04) z *= 0.72;
        y -= nx * nx * 0.02;
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

/** Peitoril que avança na face externa e cai nas pontas. */
function princessSillGeometry() {
    const g = new THREE.BoxGeometry(2.95, 0.18, 0.78, 12, 2, 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        let y = pos.getY(i);
        let z = pos.getZ(i);
        const nx = Math.abs(x) / 1.475;
        if (y > 0 && z > 0) z += 0.08 * (1 - nx * 0.4);
        if (y > 0) y -= nx * nx * 0.05;
        pos.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals();
    return g;
}

const PRINCESS_FRAME = princessFrameGeometry();
const PRINCESS_GLASS = princessGlassGeometry();
const PRINCESS_MULLION = princessMullionGeometry();
const PRINCESS_TRANSOM = princessTransomGeometry();
const PRINCESS_SILL = princessSillGeometry();

export function createCastle(scene, quality = null) {
    const low = quality?.id === 'low';
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
    gate.userData.dynamic = true;
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

    const window_ = new THREE.Group();
    window_.name = 'princessWindow';
    const frame = new THREE.Mesh(PRINCESS_FRAME, stone);
    frame.name = 'princessFrame';
    const glass = new THREE.Mesh(
        PRINCESS_GLASS,
        plainMaterial(0xffdca8, 0.45, 0, 0xffb45c, 1.8)
    );
    glass.name = 'princessGlass';
    glass.userData.dynamic = true;
    const mullion = new THREE.Mesh(PRINCESS_MULLION, stone);
    mullion.name = 'princessMullion';
    mullion.position.y = -0.66;
    const transom = new THREE.Mesh(PRINCESS_TRANSOM, stone);
    transom.name = 'princessTransom';
    transom.position.set(0, 0.22, 0.04);
    const sill = new THREE.Mesh(PRINCESS_SILL, stone);
    sill.name = 'princessSill';
    sill.position.set(0, -1.86, 0.12);
    window_.add(frame, glass, mullion, transom, sill);
    window_.position.set(keepX, 35.6, keepZ + keepRadius - 0.2);
    group.add(window_);

    const princessHero = buildPrincess(low ? 1 : 2);
    const princess = princessHero.object;
    princess.position.set(keepX, 33.25, balconyZ + 0.5);
    princess.scale.setScalar(1.25);
    group.add(princess);
    const princessState = { mode: 'wave' };

    // ---- Corpo do castelo (blocos atrás da muralha) ----
    const hall = new THREE.Mesh(hallBodyGeometry(), stone);
    hall.position.set(-sideOffset - 6, 8, -26);
    hall.castShadow = true;
    hall.receiveShadow = true;
    group.add(hall);

    const roof = new THREE.Mesh(
        hallRoofGeometry(),
        ROOF()
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

    // Carga no cais (modelos fotogramétricos instanciados; chegam depois).
    const cargoY = Math.max(0.5, terrainHeight(cx + hw + 6, z + 16) * 0.4) + 1.3;
    const cargo = [];
    for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
            cargo.push({ x: side * (hw + 6.5 + (i % 2) * 1.1), y: cargoY, z: 16 - 6 + i * 3.4, ry: i * 1.3, s: 1 });
        }
    }
    instanceModel('wine_barrel_01', cargo.filter((_, i) => i % 2 === 0), { height: 1.1 }).then((g) => g && group.add(g));
    instanceModel('wooden_crate_01', cargo.filter((_, i) => i % 2 === 1), { height: 0.9 }).then((g) => g && group.add(g));

    bakeStatic(group);

    let gateOpen = 0;
    let gateTarget = 0;
    const tmp = new THREE.Vector3();
    const torchWorld = torches.map((t) => t.getWorldPosition(new THREE.Vector3()));
    const windowWorld = new THREE.Vector3(cx + keepX, 35.6, z + keepZ + keepRadius + 1.2);
    const princessWorld = new THREE.Vector3(cx + keepX, 35.2, z + balconyZ + 0.5);
    let shipLook = null;

    return {
        group,
        princess,
        princessHero,
        z,
        centerX: cx,
        gateWidth,
        princessWorld,
        openGate() {
            gateTarget = 1;
            princessState.mode = 'cheer';
        },
        /** Nova partida: grade fechada de novo. */
        reset() {
            gateTarget = 0;
            gateOpen = 0;
            gate.position.y = 0;
            princessState.mode = 'wave';
        },
        get gateProgress() {
            return gateOpen;
        },
        /** Liga/desliga o castelo conforme a distância do jogador (4 km de rio antes dele). */
        setVisibleFor(playerZ) {
            group.visible = playerZ < z + 1500;
        },
        /** Ponto que a princesa acompanha com o olhar (posição do drakkar). */
        lookAt(target) {
            shipLook = target;
        },
        update(dt, time) {
            if (gateTarget === 0) princessState.mode = 'wave';
            if (!group.visible) return;
            tickStructures(time);
            gateOpen = damp(gateOpen, gateTarget, 1.1, dt);
            gate.position.y = gateOpen * 15.5;

            // Tochas e janela pedem luz ao pool (lights.js); tremor = soma de senos.
            for (let i = 0; i < torchWorld.length; i++) {
                const p = torchWorld[i];
                const flicker = 0.85 + Math.sin(time * 11 + i * 2.1) * 0.1 + Math.sin(time * 23 + i) * 0.05;
                fireLights.request(p.x, p.y + 0.8, p.z + 0.6, 0xff8a3a, 70 * flicker, 30);
            }
            fireLights.request(windowWorld.x, windowWorld.y + 1.5, windowWorld.z + 4, 0xffc27a, 22 + Math.sin(time * 3.1) * 3, 18);

            if (shipLook) princessHero.lookAt?.(shipLook);
            princessHero.update(dt, princessState);
        },
        emitTorchSparks(effects) {
            if (!group.visible) return;
            for (const p of torchWorld) {
                if (Math.random() < 0.25) {
                    tmp.copy(p);
                    effects.fire(tmp.x, tmp.y + 0.9, tmp.z, 1, 0.7);
                }
            }
        }
    };
}

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
