/**
 * kasato — Kasato Maru (K01–K03).
 * Casco com seções densas, deckhouses chanfrados, chaminé, mastros e passageiros
 * com kimono Meiji no convés (H02).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { smoothstep, lerp, seeded } from '../utils.js';
import {
    createSculptedHuman,
    attachKimono,
    profileTube,
    createDeckHouse
} from '../../../shared/realism.js';

function buildHullGeometry(length, beam) {
    // Mais estações = silhueta de vapor britânico mais fiel (K02–K03)
    const sections = [
        { z: -length * 0.50, w: beam * 0.06, deck: 5.1, keel: -1.9 },
        { z: -length * 0.47, w: beam * 0.42, deck: 5.4, keel: -2.5 },
        { z: -length * 0.42, w: beam * 0.78, deck: 5.7, keel: -2.95 },
        { z: -length * 0.32, w: beam * 0.95, deck: 5.95, keel: -3.15 },
        { z: -length * 0.18, w: beam * 0.99, deck: 6.05, keel: -3.25 },
        { z: 0.0,            w: beam,        deck: 6.1, keel: -3.3 },
        { z:  length * 0.18, w: beam * 0.99, deck: 6.05, keel: -3.25 },
        { z:  length * 0.32, w: beam * 0.94, deck: 5.9, keel: -3.05 },
        { z:  length * 0.42, w: beam * 0.82, deck: 5.65, keel: -2.7 },
        { z:  length * 0.48, w: beam * 0.55, deck: 5.3, keel: -2.2 },
        { z:  length * 0.50, w: beam * 0.22, deck: 5.15, keel: -1.85 }
    ];

    const positions = [];
    const rings = [];

    for (const section of sections) {
        const half = section.w * 0.5;
        // Perfil com flare e bilge suave (mais pontos no anel)
        const ring = [
            [-half * 0.94, section.deck],
            [-half * 0.99, section.deck * 0.72],
            [-half, 2.55],
            [-half * 0.92, 0.85],
            [-half * 0.72, -0.55],
            [-half * 0.42, section.keel + 0.4],
            [-half * 0.18, section.keel + 0.12],
            [0, section.keel],
            [half * 0.18, section.keel + 0.12],
            [half * 0.42, section.keel + 0.4],
            [half * 0.72, -0.55],
            [half * 0.92, 0.85],
            [half, 2.55],
            [half * 0.99, section.deck * 0.72],
            [half * 0.94, section.deck]
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
            const target = avgY < 0.55 ? boot : upper;
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
        rings: 12,
        seg: 14,
        squashY: 0.55,
        radius: (t) => Math.sin(t * Math.PI) * 0.95
    });
    const hull = new THREE.Mesh(hullGeo, mats.white);
    hull.castShadow = true;
    boat.add(hull);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.14, 4.8), mats.deck);
    cover.position.y = 0.32;
    boat.add(cover);
    // Bancos internos
    for (const z of [-1.2, 0, 1.2]) {
        const seat = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.28), mats.wood);
        seat.position.set(0, 0.12, z);
        boat.add(seat);
    }
    return boat;
}

function makeAnchor(mats) {
    const g = new THREE.Group();
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 1.9, 10), mats.steel);
    g.add(shank);
    const crown = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.12, 8, 18, Math.PI),
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

    // Convés de madeira — leve camber
    const deckGeo = new THREE.BoxGeometry(B - 0.5, 0.35, L * 0.88, 1, 1, 8);
    const dPos = deckGeo.attributes.position;
    for (let i = 0; i < dPos.count; i++) {
        const x = dPos.getX(i);
        const y = dPos.getY(i);
        const camber = (1 - (x / (B * 0.5)) ** 2) * 0.12;
        dPos.setY(i, y + camber);
    }
    deckGeo.computeVertexNormals();
    const deck = new THREE.Mesh(deckGeo, mats.deck);
    deck.position.y = 6.25;
    deck.receiveShadow = true;
    g.add(deck);

    const forecastle = new THREE.Mesh(new THREE.BoxGeometry(B * 0.68, 1.5, 16), mats.hull);
    forecastle.position.set(0, 6.95, -L * 0.36);
    forecastle.castShadow = true;
    g.add(forecastle);
    const foreDeck = new THREE.Mesh(new THREE.BoxGeometry(B * 0.66, 0.22, 15.6), mats.deck);
    foreDeck.position.set(0, 7.75, -L * 0.36);
    g.add(foreDeck);

    // Superestrutura central com deckhouses chanfrados
    const mid = createDeckHouse({
        width: B * 0.72,
        height: 3.2,
        length: L * 0.28,
        material: mats.white,
        glassMaterial: mats.glass
    });
    mid.position.set(0, 7.95, 5);
    g.add(mid);

    const upper = createDeckHouse({
        width: B * 0.62,
        height: 2.4,
        length: L * 0.22,
        material: mats.white,
        glassMaterial: mats.glass
    });
    upper.position.set(0, 10.7, 5);
    g.add(upper);

    const boatTemplate = makeLifeboat(mats);
    for (const side of [-1, 1]) {
        for (const z of [-8, -1, 6, 14]) {
            const b = boatTemplate.clone();
            b.position.set(side * (B * 0.42), 11.5, z);
            // Turcos
            const davit = new THREE.Mesh(
                new THREE.CylinderGeometry(0.06, 0.08, 2.4, 8),
                mats.steel
            );
            davit.position.set(side * (B * 0.46), 12.4, z);
            davit.rotation.z = side * 0.35;
            g.add(b, davit);
        }
    }

    for (const [vx, vz] of [[-2.4, -2], [2.4, -2], [-2.2, 12], [2.2, 12], [0, 18]]) {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 2.1, 12), mats.white);
        stem.position.set(vx, 12.7, vz);
        const cowl = new THREE.Mesh(new THREE.SphereGeometry(0.55, 14, 12), mats.funnelBand);
        cowl.scale.set(1, 0.9, 1.4);
        cowl.position.set(vx, 13.8, vz - 0.18);
        g.add(stem, cowl);
    }

    const bridge = createDeckHouse({
        width: B * 0.88,
        height: 3.1,
        length: 8.2,
        material: mats.white,
        glassMaterial: mats.glass
    });
    bridge.position.set(0, 11.55, -18);
    g.add(bridge);

    const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(B * 0.92, 0.32, 8.6), mats.deck);
    bridgeRoof.position.set(0, 13.25, -18);
    g.add(bridgeRoof);

    // Asas do passadiço
    for (const sx of [-1, 1]) {
        const wing = new THREE.Mesh(
            new THREE.BoxGeometry(1.8, 0.18, 3.2),
            mats.deck
        );
        wing.position.set(sx * B * 0.52, 12.4, -18);
        g.add(wing);
        const wingRail = new THREE.Mesh(
            new THREE.BoxGeometry(0.08, 0.7, 3.0),
            mats.steel
        );
        wingRail.position.set(sx * B * 0.58, 12.8, -18);
        g.add(wingRail);
    }

    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.55, 12.5, 24), mats.funnel);
    funnel.position.set(0, 14.2, 8);
    funnel.castShadow = true;
    g.add(funnel);
    for (const y of [15.3, 16.9]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(2.32, 2.38, 0.7, 24), mats.white);
        band.position.set(0, y, 8);
        g.add(band);
    }
    const whistle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8), mats.funnelBand);
    whistle.position.set(0, 16.4, 5.5);
    g.add(whistle);

    // Topo da chaminé (coroa)
    const funnelCap = new THREE.Mesh(
        new THREE.TorusGeometry(2.15, 0.12, 8, 24),
        mats.steel
    );
    funnelCap.rotation.x = Math.PI / 2;
    funnelCap.position.set(0, 20.4, 8);
    g.add(funnelCap);

    for (const [z, boomDir] of [[-42, 1], [35, -1]]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.42, 24, 12), mats.wood);
        mast.position.set(0, 18, z);
        mast.castShadow = true;
        g.add(mast);
        const nest = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.55, 0.95, 12), mats.wood);
        nest.position.set(0, 24, z);
        g.add(nest);
        for (const sx of [-0.65, 0.65]) {
            const derrick = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 12, 8), mats.wood);
            derrick.position.set(sx, 11.4, z + boomDir * 4.4);
            derrick.rotation.x = boomDir * 0.95;
            derrick.rotation.z = -sx * 0.18;
            g.add(derrick);
        }
    }

    const riggingMat = new THREE.LineBasicMaterial({ color: 0x302c26, transparent: true, opacity: 0.75 });
    const addRigging = (from, to) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...from),
            new THREE.Vector3(...to)
        ]);
        g.add(new THREE.Line(geo, riggingMat));
    };
    addRigging([0, 29, -42], [-B * 0.46, 6.7, -57]);
    addRigging([0, 29, -42], [B * 0.46, 6.7, -57]);
    addRigging([0, 29, -42], [0, 13.2, -18]);
    addRigging([0, 29, 35], [-B * 0.46, 6.7, 52]);
    addRigging([0, 29, 35], [B * 0.46, 6.7, 52]);
    addRigging([0, 29, 35], [0, 12.0, 8]);

    for (const side of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, L * 0.85), mats.steel);
        r.position.set(side * B * 0.48, 6.75, 0);
        g.add(r);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, L * 0.85), mats.wood);
        cap.position.set(side * B * 0.48, 7.25, 0);
        g.add(cap);
        // Stanchions
        for (let i = 0; i < 18; i++) {
            const st = new THREE.Mesh(
                new THREE.CylinderGeometry(0.03, 0.035, 0.85, 6),
                mats.steel
            );
            st.position.set(side * B * 0.48, 6.7, -L * 0.4 + i * (L * 0.8 / 17));
            g.add(st);
        }
    }

    const portholeGeo = new THREE.CircleGeometry(0.2, 14);
    const portholes = new THREE.InstancedMesh(portholeGeo, mats.funnelBand, 48);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let pi = 0;
    for (const side of [-1, 1]) {
        quaternion.setFromEuler(new THREE.Euler(0, side * Math.PI / 2, 0));
        for (let i = 0; i < 12; i++) {
            matrix.compose(
                new THREE.Vector3(side * B * 0.36, 8.7, -10 + i * 2.5),
                quaternion,
                scale
            );
            portholes.setMatrixAt(pi++, matrix);
        }
        for (let i = 0; i < 12; i++) {
            matrix.compose(
                new THREE.Vector3(side * B * 0.495, 4.15, -32 + i * 5.5),
                quaternion,
                scale
            );
            portholes.setMatrixAt(pi++, matrix);
        }
    }
    portholes.count = pi;
    portholes.instanceMatrix.needsUpdate = true;
    g.add(portholes);

    // Imigrantes no convés — kimono / viagem Meiji (H02)
    const nPax = quality.id === 'low' ? 14 : quality.id === 'medium' ? 28 : 40;
    const paxRandom = seeded(0x19080618);
    const kimonoColors = [0x2c3d5c, 0x4a2c28, 0x3a4a3c, 0x5c4a32, 0x2a2e38, 0x6b3a32];
    const sashColors = [0xc45c3a, 0xd8c8a0, 0x8a3030, 0x2c4058];
    for (let i = 0; i < nPax; i++) {
        const isChild = i % 6 === 0;
        const p = createSculptedHuman({
            style: isChild ? 'child' : 'human',
            skin: 0xd8b490,
            hair: 0x1c1612,
            shirt: kimonoColors[i % kimonoColors.length],
            pants: 0x242830,
            hat: null,
            detailedFace: false,
            scale: isChild ? 0.72 : 1.0
        });
        if (i % 3 !== 2) {
            attachKimono(p, kimonoColors[i % kimonoColors.length], sashColors[i % sashColors.length]);
        }
        const atRail = i % 3 !== 0;
        const px = atRail
            ? (i % 2 === 0 ? 1 : -1) * (B * 0.4)
            : (paxRandom() - 0.5) * B * 0.45;
        p.position.set(px, 6.45, -36 + paxRandom() * 68);
        p.rotation.y = (px > 0 ? Math.PI * 0.5 : -Math.PI * 0.5) + (paxRandom() - 0.5) * 0.35;
        g.add(p);
    }

    for (const sx of [-1, 1]) {
        const anchor = makeAnchor(mats);
        anchor.position.set(sx * B * 0.34, 4.2, -L * 0.44);
        anchor.rotation.y = sx * 0.35;
        g.add(anchor);
    }

    // Nome no casco (placa tipográfica)
    const nameCanvas = document.createElement('canvas');
    nameCanvas.width = 512;
    nameCanvas.height = 64;
    const nctx = nameCanvas.getContext('2d');
    nctx.fillStyle = 'rgba(0,0,0,0)';
    nctx.clearRect(0, 0, 512, 64);
    nctx.fillStyle = '#e8e0d0';
    nctx.font = 'bold 36px Georgia, serif';
    nctx.textAlign = 'center';
    nctx.textBaseline = 'middle';
    nctx.fillText('KASATO MARU', 256, 32);
    const nameTex = new THREE.CanvasTexture(nameCanvas);
    nameTex.colorSpace = THREE.SRGBColorSpace;
    const namePlate = new THREE.Mesh(
        new THREE.PlaneGeometry(14, 1.6),
        new THREE.MeshStandardMaterial({
            map: nameTex,
            transparent: true,
            roughness: 0.55,
            metalness: 0.1
        })
    );
    namePlate.position.set(B * 0.505, 3.6, -8);
    namePlate.rotation.y = Math.PI / 2;
    g.add(namePlate);

    g.userData.funnel = funnel;
    g.userData.length = L;
    return g;
}

export function kasatoPose(t) {
    const dockZ = LAYOUT.dockZ;
    const startZ = 280;
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
        new THREE.PlaneGeometry(10, 48),
        new THREE.MeshBasicMaterial({
            color: '#d0ddd8',
            transparent: true,
            opacity: 0.28,
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
            wake.position.set(p.x, 0.15, p.z + 32);
            wake.material.opacity = moving ? 0.26 * (1 - smoothstep(90, 115, t)) : 0;
        },
        dispose() {
            scene.remove(ship);
            scene.remove(wake);
            wake.geometry.dispose();
            wake.material.dispose();
        }
    };
}
