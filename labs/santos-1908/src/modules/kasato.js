/**
 * kasato — Kasato Maru (K01–K03).
 * ~123,4 × 15,4 m; 1 chaminé; ponte separada; casco preto com faixa de bojo.
 * Posição animada: mar aberto → atracação no armazém 14 (D06).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { smoothstep, lerp, seeded } from '../utils.js';
import { createSculptedHuman, profileTube } from '../../../shared/realism.js';

function buildHullGeometry(length, beam) {
    const sections = [
        { z: -length * 0.50, w: beam * 0.08, deck: 5.2, keel: -2.1 },
        { z: -length * 0.44, w: beam * 0.78, deck: 5.7, keel: -2.9 },
        { z: -length * 0.28, w: beam * 0.98, deck: 6.0, keel: -3.2 },
        { z:  length * 0.22, w: beam,        deck: 6.0, keel: -3.2 },
        { z:  length * 0.43, w: beam * 0.92, deck: 5.7, keel: -2.8 },
        { z:  length * 0.50, w: beam * 0.58, deck: 5.25, keel: -2.2 }
    ];

    const positions = [];
    const rings = [];

    for (const section of sections) {
        const half = section.w * 0.5;
        const ring = [
            [-half * 0.96, section.deck],
            [-half, 2.4],
            [-half * 0.78, -0.5],
            [-half * 0.42, section.keel + 0.35],
            [0, section.keel],
            [half * 0.42, section.keel + 0.35],
            [half * 0.78, -0.5],
            [half, 2.4],
            [half * 0.96, section.deck]
        ];
        rings.push(ring);
        for (const [x, y] of ring) positions.push(x, y, section.z);
    }

    const ringSize = rings[0].length;
    const upper = [];
    const boot = [];

    for (let section = 0; section < sections.length - 1; section++) {
        for (let p = 0; p < ringSize - 1; p++) {
            const a = section * ringSize + p;
            const b = a + 1;
            const c = (section + 1) * ringSize + p;
            const d = c + 1;
            const avgY = (
                rings[section][p][1]
                + rings[section][p + 1][1]
                + rings[section + 1][p][1]
                + rings[section + 1][p + 1][1]
            ) * 0.25;
            const target = avgY < 0.5 ? boot : upper;
            target.push(a, c, b, b, c, d);
        }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex([...upper, ...boot]);
    geometry.addGroup(0, upper.length, 0);
    geometry.addGroup(upper.length, boot.length, 1);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
}

function makeLifeboat(mats) {
    const boat = new THREE.Group();
    const hullGeo = profileTube({
        axis: 'z',
        length: 6.4,
        rings: 10,
        seg: 12,
        squashY: 0.58,
        radius: (t) => Math.sin(t * Math.PI) * 0.95
    });
    const hull = new THREE.Mesh(hullGeo, mats.white);
    hull.castShadow = true;
    boat.add(hull);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 4.8), mats.deck);
    cover.position.y = 0.32;
    boat.add(cover);
    return boat;
}

function makeAnchor(mats) {
    const g = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.9, 8), mats.steel);
    g.add(shank);
    const crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.12, 8, 16, Math.PI),
        mats.steel
    );
    crown.rotation.z = Math.PI;
    crown.position.y = -0.35;
    g.add(crown);
    const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 8), mats.steel);
    stock.rotation.z = Math.PI / 2;
    stock.position.y = 0.65;
    g.add(stock);
    return g;
}

function buildKasato(mats, quality) {
    const g = new THREE.Group();
    g.name = 'kasato-maru';
    const L = LAYOUT.kasatoLength;
    const B = LAYOUT.kasatoBeam;

    const hull = new THREE.Mesh(
        buildHullGeometry(L, B),
        [mats.hull, mats.hullBoot]
    );
    hull.castShadow = quality.shadows;
    hull.receiveShadow = true;
    g.add(hull);

    // Convés de madeira pranchada
    const deck = new THREE.Mesh(new THREE.BoxGeometry(B - 0.6, 0.4, L * 0.88), mats.deck);
    deck.position.y = 6.2;
    deck.receiveShadow = true;
    g.add(deck);

    // Castelo de proa e popa elevados
    const forecastle = new THREE.Mesh(new THREE.BoxGeometry(B * 0.68, 1.5, 16), mats.hull);
    forecastle.position.set(0, 6.9, -L * 0.36);
    g.add(forecastle);
    const foreDeck = new THREE.Mesh(new THREE.BoxGeometry(B * 0.66, 0.22, 15.6), mats.deck);
    foreDeck.position.set(0, 7.7, -L * 0.36);
    g.add(foreDeck);

    // Superestrutura central em 2 pavimentos com passadiço
    const superstructure = new THREE.Mesh(
        new THREE.BoxGeometry(B * 0.72, 3.2, L * 0.28),
        mats.white
    );
    superstructure.position.set(0, 7.9, 5);
    superstructure.castShadow = true;
    g.add(superstructure);

    const upperDeckHouse = new THREE.Mesh(
        new THREE.BoxGeometry(B * 0.62, 2.4, L * 0.22),
        mats.white
    );
    upperDeckHouse.position.set(0, 10.6, 5);
    upperDeckHouse.castShadow = true;
    g.add(upperDeckHouse);

    // Botes salva-vidas em turcos laterais
    const boatTemplate = makeLifeboat(mats);
    for (const side of [-1, 1]) {
        for (const z of [-4, 6, 16]) {
            const b = boatTemplate.clone();
            b.position.set(side * (B * 0.41), 11.4, z);
            g.add(b);
        }
    }

    // Ventiladores de convés (cowl ventilators clássicos de 1908)
    for (const [vx, vz] of [[-2.4, 0], [2.4, 0], [-2.2, 13], [2.2, 13]]) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.1, 10), mats.white);
        stem.position.set(vx, 12.6, vz);
        const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), mats.funnelBand);
        cowl.scale.set(1, 0.9, 1.35);
        cowl.position.set(vx, 13.7, vz - 0.15);
        g.add(stem, cowl);
    }

    // Ponte de comando separada (K03) com janelas do passadiço
    const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(B * 0.85, 3.2, 8),
        mats.white
    );
    bridge.position.set(0, 11.5, -18);
    bridge.castShadow = true;
    g.add(bridge);
    const bridgeGlass = new THREE.Mesh(
        new THREE.BoxGeometry(B * 0.78, 0.95, 0.25),
        mats.glass
    );
    bridgeGlass.position.set(0, 12.1, -22.05);
    g.add(bridgeGlass);
    const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(B * 0.9, 0.35, 8.5), mats.deck);
    bridgeRoof.position.set(0, 13.2, -18);
    g.add(bridgeRoof);

    // Chaminé única com colar e apito a vapor
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.55, 12, 18), mats.funnel);
    funnel.position.set(0, 14, 8);
    funnel.castShadow = true;
    g.add(funnel);
    for (const y of [15.2, 16.8]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(2.36, 2.38, 0.72, 18), mats.white);
        band.position.set(0, y, 8);
        g.add(band);
    }
    const whistle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), mats.funnelBand);
    whistle.position.set(0, 16.2, 5.55);
    g.add(whistle);

    // Mastros + paus de carga (derricks)
    for (const [z, boomDir] of [[-42, 1], [35, -1]]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.42, 23, 10), mats.wood);
        mast.position.set(0, 17.5, z);
        mast.castShadow = true;
        g.add(mast);
        const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.55, 0.9, 10), mats.wood);
        nest.position.set(0, 23, z);
        g.add(nest);
        for (const sx of [-0.6, 0.6]) {
            const derrick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 11, 8), mats.wood);
            derrick.position.set(sx, 11.2, z + boomDir * 4.2);
            derrick.rotation.x = boomDir * 0.92;
            derrick.rotation.z = -sx * 0.18;
            g.add(derrick);
        }
    }

    // Estais e cabos dos mastros
    const riggingMat = new THREE.LineBasicMaterial({ color: 0x302c26, transparent: true, opacity: 0.72 });
    const addRigging = (from, to) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...from),
            new THREE.Vector3(...to)
        ]);
        g.add(new THREE.Line(geo, riggingMat));
    };
    addRigging([0, 28, -42], [-B * 0.46, 6.7, -57]);
    addRigging([0, 28, -42], [ B * 0.46, 6.7, -57]);
    addRigging([0, 28, -42], [0, 13.2, -18]);
    addRigging([0, 28,  35], [-B * 0.46, 6.7,  52]);
    addRigging([0, 28,  35], [ B * 0.46, 6.7,  52]);
    addRigging([0, 28,  35], [0, 11.8, 8]);

    // Amuradas laterais
    for (const side of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.95, L * 0.85), mats.steel);
        r.position.set(side * B * 0.48, 6.7, 0);
        g.add(r);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.1, L * 0.85), mats.wood);
        cap.position.set(side * B * 0.48, 7.2, 0);
        g.add(cap);
    }

    // Vigias em lote
    const portholeGeo = new THREE.CircleGeometry(0.19, 12);
    const portholes = new THREE.InstancedMesh(portholeGeo, mats.funnelBand, 40);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let pi = 0;
    for (const side of [-1, 1]) {
        quaternion.setFromEuler(new THREE.Euler(0, side * Math.PI / 2, 0));
        for (let i = 0; i < 10; i++) {
            matrix.compose(
                new THREE.Vector3(side * B * 0.365, 8.6, -7 + i * 2.6),
                quaternion,
                scale
            );
            portholes.setMatrixAt(pi++, matrix);
        }
        for (let i = 0; i < 10; i++) {
            matrix.compose(
                new THREE.Vector3(side * B * 0.49, 4.2, -28 + i * 6.0),
                quaternion,
                scale
            );
            portholes.setMatrixAt(pi++, matrix);
        }
    }
    portholes.instanceMatrix.needsUpdate = true;
    g.add(portholes);

    // Imigrantes esculpidos no convés olhando para o cais (H02)
    const nPax = quality.id === 'low' ? 12 : 26;
    const paxRandom = seeded(0x19080618);
    const paxShirts = [0xd8d0c0, 0x2c3440, 0x4a525d, 0xc8bfb0, 0x6b3a32];
    for (let i = 0; i < nPax; i++) {
        const p = createSculptedHuman({
            style: i % 5 === 0 ? 'child' : 'human',
            skin: 0xd8b490,
            hair: 0x1c1612,
            shirt: paxShirts[i % paxShirts.length],
            pants: 0x242830,
            hat: i % 2 === 0 ? 0x2c2824 : null,
            detailedFace: false,
            scale: i % 5 === 0 ? 0.78 : 1.0
        });
        const atRail = i % 3 !== 0;
        const px = atRail ? (B * 0.41) : (paxRandom() - 0.5) * B * 0.52;
        p.position.set(
            px,
            6.4,
            -32 + paxRandom() * 62
        );
        p.rotation.y = Math.PI * 0.5 + (paxRandom() - 0.5) * 0.45;
        g.add(p);
    }

    // Âncoras esculpidas de proa
    for (const sx of [-1, 1]) {
        const anchor = makeAnchor(mats);
        anchor.position.set(sx * B * 0.34, 4.2, -L * 0.44);
        anchor.rotation.y = sx * 0.35;
        g.add(anchor);
    }

    g.userData.funnel = funnel;
    g.userData.length = L;
    return g;
}

/** Posição do navio ao longo do filme. */
export function kasatoPose(t) {
    const dockZ = LAYOUT.dockZ;
    const startZ = 280;
    // Aproxima até ~t=110, depois para
    const u = smoothstep(0, 110, t);
    const z = lerp(startZ, dockZ, u);
    const x = lerp(-8, LAYOUT.quayX - 12, smoothstep(40, 105, t));
    const yaw = lerp(0, -0.08, smoothstep(50, 100, t));
    const bob = Math.sin(t * 0.7) * 0.15 * (1 - smoothstep(100, 120, t));
    return { x, y: bob, z, yaw };
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const ship = buildKasato(mats, quality);
    scene.add(ship);

    const wake = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 40),
        new THREE.MeshBasicMaterial({
            color: '#d0ddd8',
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    );
    wake.rotation.x = -Math.PI / 2;
    wake.position.y = 0.15;
    scene.add(wake);

    return {
        ship,
        update(t) {
            const p = kasatoPose(t);
            ship.position.set(p.x, p.y, p.z);
            ship.rotation.y = p.yaw;
            const moving = t < 115;
            wake.visible = moving;
            wake.position.set(p.x, 0.15, p.z + 30);
            wake.material.opacity = moving ? 0.22 * (1 - smoothstep(90, 115, t)) : 0;
        },
        dispose() {
            scene.remove(ship);
            scene.remove(wake);
            wake.geometry.dispose();
            wake.material.dispose();
        }
    };
}
