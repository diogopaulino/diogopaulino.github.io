/**
 * Landmarks reconhecíveis da orla — formas estilizadas, não modelos CAD.
 */

import * as THREE from 'three';
import { LANDMARKS, ZONES } from './config.js';
import {
    stoneMaterial,
    woodMaterial,
    plasterMaterial,
    metalMaterial,
    sidewalkMosaicMaterial,
    torsoGeometry,
    headGeometry,
    limbGeometry
} from '../../shared/realism.js';

function makeFountain() {
    const g = new THREE.Group();
    const stoneMat = stoneMaterial(0xb0ada6, { roughness: 0.78, repeat: 2 });
    const rimMat = stoneMaterial(0x8c8982, { roughness: 0.68, repeat: 2 });
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4, 3.8, 0.52, 28),
        stoneMat
    );
    base.position.y = 0.26;
    const innerPool = new THREE.Mesh(
        new THREE.CylinderGeometry(3.0, 3.0, 0.14, 24),
        new THREE.MeshPhysicalMaterial({
            color: 0x3898b8,
            roughness: 0.12,
            transmission: 0.35,
            transparent: true,
            opacity: 0.82
        })
    );
    innerPool.position.y = 0.52;
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.35, 0.24, 10, 32),
        rimMat
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.58;
    const jet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.32, 2.3, 12),
        new THREE.MeshPhysicalMaterial({
            color: 0xbef0ff,
            transparent: true,
            opacity: 0.62,
            roughness: 0.1,
            clearcoat: 1.0
        })
    );
    jet.position.y = 1.65;

    // Fonte do Sapo esculpida (corpo + cabeça + olhos + patas + jato d'água da boca)
    const toadMat = new THREE.MeshPhysicalMaterial({
        color: 0x2f7d3c,
        roughness: 0.42,
        clearcoat: 0.65,
        clearcoatRoughness: 0.25
    });
    const toadGroup = new THREE.Group();
    toadGroup.position.set(1.45, 0.75, 0.85);
    toadGroup.rotation.y = -2.2;

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.52, 14, 12), toadMat);
    body.scale.set(1.05, 0.76, 1.18);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), toadMat);
    head.position.set(0, 0.22, 0.38);
    head.scale.set(1.12, 0.75, 0.95);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xf4e898, roughness: 0.25 });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.2 });
    for (const side of [-1, 1]) {
        const eyeBulge = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), toadMat);
        eyeBulge.position.set(side * 0.2, 0.46, 0.44);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), eyeMat);
        eye.position.set(side * 0.22, 0.48, 0.5);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), pupilMat);
        pupil.position.set(side * 0.23, 0.48, 0.55);
        const leg = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 8), toadMat);
        leg.scale.set(0.7, 0.85, 1.3);
        leg.position.set(side * 0.48, -0.1, -0.15);
        toadGroup.add(eyeBulge, eye, pupil, leg);
    }
    toadGroup.add(body, head);
    g.add(base, innerPool, ring, jet, toadGroup);
    return g;
}

function makeAquarium() {
    const g = new THREE.Group();
    const wallMat = plasterMaterial(0xdfe8ec, { roughness: 0.62, repeat: 2 });
    const trimMat = plasterMaterial(0x285c70, { roughness: 0.48, repeat: 1 });
    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x3eb4d4,
        transparent: true,
        opacity: 0.55,
        roughness: 0.1,
        metalness: 0.15,
        clearcoat: 0.9,
        emissive: 0x165572,
        emissiveIntensity: 0.28
    });

    const body = new THREE.Mesh(new THREE.BoxGeometry(14, 6.8, 10), wallMat);
    body.position.y = 3.4;

    // Cúpula central aquática + marquise curva
    const dome = new THREE.Mesh(
        new THREE.SphereGeometry(4.2, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
        glassMat
    );
    dome.position.set(0, 6.8, 0);

    const glass = new THREE.Mesh(new THREE.BoxGeometry(9.6, 4.4, 0.32), glassMat);
    glass.position.set(0, 3.3, 5.05);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(15.2, 0.55, 11.2), trimMat);
    roof.position.y = 7.05;

    // Escotilhas náuticas laterais
    const portholeGeo = new THREE.TorusGeometry(0.65, 0.1, 8, 18);
    const portholeGlassGeo = new THREE.CircleGeometry(0.6, 16);
    for (const x of [-4.5, 4.5]) {
        const ring = new THREE.Mesh(portholeGeo, trimMat);
        ring.position.set(x, 4.8, 5.06);
        const pane = new THREE.Mesh(portholeGlassGeo, glassMat);
        pane.position.set(x, 4.8, 5.08);
        g.add(ring, pane);
    }

    g.add(body, dome, glass, roof);
    return g;
}

function makeDeck() {
    const g = new THREE.Group();
    const deckWood = woodMaterial(0x8b6220, { roughness: 0.78, repeatX: 2, repeatY: 6 });
    const pileWood = woodMaterial(0x523814, { roughness: 0.88, repeatX: 1, repeatY: 2 });
    const railMetal = metalMaterial(0xd6dce2, { roughness: 0.3, metalness: 0.8 });

    const planks = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.36, 18.5), deckWood);
    planks.position.set(0, 0.42, 8.2);
    const pileGeo = new THREE.CylinderGeometry(0.26, 0.32, 2.4, 10);
    for (let i = 0; i < 8; i++) {
        const pile = new THREE.Mesh(pileGeo, pileWood);
        pile.position.set((i % 2) * 5.8 - 2.9, -0.45, 1.5 + Math.floor(i / 2) * 4.8);
        g.add(pile);
    }

    // Guarda-corpo perimetral + pérgola de madeira do Deck do Pescador
    const frontRail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 8.4, 8), railMetal);
    frontRail.rotation.z = Math.PI / 2;
    frontRail.position.set(0, 1.25, 17.2);
    g.add(planks, frontRail);

    for (const side of [-1, 1]) {
        const sideRail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 18.2, 8), railMetal);
        sideRail.rotation.x = Math.PI / 2;
        sideRail.position.set(side * 4.05, 1.25, 8.2);
        g.add(sideRail);
    }

    // Pérgola sombreada no mirante do deck
    for (const x of [-2.8, 2.8]) {
        for (const z of [11, 15.5]) {
            const col = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.6, 8), pileWood);
            col.position.set(x, 1.7, z);
            g.add(col);
        }
    }
    for (let b = 0; b < 6; b++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.12, 0.2), deckWood);
        slat.position.set(0, 3.0, 10.6 + b * 1.05);
        g.add(slat);
    }
    return g;
}

function makePark() {
    const g = new THREE.Group();
    const concreteMat = stoneMaterial(0x9ea4ab, { roughness: 0.78, repeat: 3 });
    const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(9.5, 10.2, 1.2, 32),
        concreteMat
    );
    platform.position.y = 0.4;

    // Píer avançando em direção ao mar no Parque Roberto Mário Santini (Emissário)
    const pier = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 0.9, 18),
        concreteMat
    );
    pier.position.set(0, 0.45, 11);

    const bowl = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.55, 10, 28, Math.PI),
        stoneMaterial(0x6e747c, { roughness: 0.62, repeat: 2 })
    );
    bowl.rotation.x = Math.PI / 2;
    bowl.position.set(-3.2, 1.05, -1.5);

    // Escultura icônica vermelha de Tomie Ohtake (fita ondulante monumental voltada ao mar)
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(1.2, 0.8, 4.0),
        new THREE.Vector3(1.8, 3.6, 7.2),
        new THREE.Vector3(0.4, 7.8, 10.5),
        new THREE.Vector3(-1.4, 11.5, 13.8),
        new THREE.Vector3(0.8, 14.2, 16.5),
        new THREE.Vector3(2.4, 11.8, 18.4)
    ]);
    const ribbonGeo = new THREE.TubeGeometry(curve, 48, 0.68, 12, false);
    ribbonGeo.scale(1.45, 1.0, 0.58);
    const ribbonMat = new THREE.MeshPhysicalMaterial({
        color: 0xd61f1f,
        roughness: 0.26,
        metalness: 0.18,
        clearcoat: 0.85,
        clearcoatRoughness: 0.18
    });
    const tomieSculpture = new THREE.Mesh(ribbonGeo, ribbonMat);
    tomieSculpture.castShadow = true;

    g.add(platform, pier, bowl, tomieSculpture);
    return g;
}

function makeRock() {
    const g = new THREE.Group();
    const mat = stoneMaterial(0x6e685e, { roughness: 0.92, repeat: 2 });
    for (let i = 0; i < 6; i++) {
        const rockGeo = new THREE.DodecahedronGeometry(1.4 + i * 0.35, 1);
        const pos = rockGeo.attributes.position;
        for (let k = 0; k < pos.count; k++) {
            const vx = pos.getX(k);
            const vy = pos.getY(k);
            const vz = pos.getZ(k);
            const n = 0.88 + 0.22 * Math.sin(vx * 1.9 + i) * Math.cos(vz * 1.7 - vy);
            pos.setXYZ(k, vx * n, vy * n, vz * n);
        }
        rockGeo.computeVertexNormals();
        const rock = new THREE.Mesh(rockGeo, mat);
        rock.position.set((i - 2.5) * 1.7, 0.75 + (i % 2) * 0.65, (i % 3) * 1.2);
        rock.rotation.set(i * 0.4, i * 0.7, 0.2);
        rock.scale.set(1 + (i % 2) * 0.38, 0.68 + i * 0.14, 1);
        g.add(rock);
    }
    return g;
}

function makeDistrictMarker() {
    const g = new THREE.Group();
    const plaza = new THREE.Mesh(
        new THREE.CylinderGeometry(5, 5.2, 0.16, 28),
        sidewalkMosaicMaterial({ repeatX: 3, repeatY: 3 })
    );
    plaza.position.y = 0.08;

    const pedestal = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 1.8, 1.3),
        stoneMaterial(0x8e887f, { roughness: 0.72, repeat: 1 })
    );
    pedestal.position.y = 0.98;

    const bronzeMat = metalMaterial(0x5d6b58, { roughness: 0.36, metalness: 0.78 });
    const figure = new THREE.Group();
    figure.position.y = 2.45;
    const torso = new THREE.Mesh(torsoGeometry({ height: 0.95, waist: 0.2, chest: 0.28, shoulder: 0.32 }), bronzeMat);
    const head = new THREE.Mesh(headGeometry(0.22), bronzeMat);
    head.position.y = 0.68;
    const armL = new THREE.Mesh(limbGeometry({ length: 0.65, topR: 0.09, midR: 0.08, botR: 0.07 }), bronzeMat);
    armL.position.set(-0.34, 0.36, 0);
    armL.rotation.z = 0.25;
    const armR = new THREE.Mesh(limbGeometry({ length: 0.65, topR: 0.09, midR: 0.08, botR: 0.07 }), bronzeMat);
    armR.position.set(0.34, 0.42, 0.12);
    armR.rotation.x = -0.8;
    figure.add(torso, head, armL, armR);

    g.add(plaza, pedestal, figure);
    return g;
}

const BUILDERS = {
    park: makePark,
    rock: makeRock,
    district: makeDistrictMarker,
    fountain: makeFountain,
    building: makeAquarium,
    deck: makeDeck
};

export function createLandmarks() {
    const root = new THREE.Group();
    root.name = 'landmarks';
    const nodes = [];

    for (const lm of LANDMARKS) {
        const builder = BUILDERS[lm.kind] || makeDistrictMarker;
        const mesh = builder();
        mesh.position.set(lm.x, 0, lm.z);
        mesh.userData.landmark = lm;
        root.add(mesh);
        nodes.push({ ...lm, object: mesh });
    }

    // Placa da Av. Bartolomeu de Gusmão (nome da avenida da orla)
    const signMat = metalMaterial(0x1f4d2e, { roughness: 0.45, metalness: 0.35 });
    const postMat = metalMaterial(0x3a4046, { roughness: 0.4, metalness: 0.75 });
    for (const x of [-200, 0, 200]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.8, 10), postMat);
        const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.1), signMat);
        post.position.set(x, 1.4, ZONES.sidewalk - 0.5);
        board.position.set(x, 2.5, ZONES.sidewalk - 0.5);
        root.add(post, board);
    }

    return { root, nodes };
}
