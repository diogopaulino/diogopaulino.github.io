/**
 * kasato — Kasato Maru (K01–K03).
 * ~123,4 × 15,4 m; 1 chaminé; ponte separada; casco preto com faixa de bojo.
 * Posição animada: mar aberto → atracação no armazém 14 (D06).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { smoothstep, lerp, seeded } from '../utils.js';

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

function buildKasato(mats, quality) {
    const g = new THREE.Group();
    g.name = 'kasato-maru';
    const L = LAYOUT.kasatoLength;
    const B = LAYOUT.kasatoBeam;

    // Casco loftado por seções: proa realmente afilada, fundo arredondado e popa estreita.
    // Continua procedural, mas evita a leitura imediata de "caixa" do primeiro protótipo.
    const hull = new THREE.Mesh(
        buildHullGeometry(L, B),
        [mats.hull, mats.hullBoot]
    );
    hull.castShadow = quality.shadows;
    hull.receiveShadow = true;
    g.add(hull);

    // Convés
    const deck = new THREE.Mesh(new THREE.BoxGeometry(B - 0.6, 0.4, L * 0.88), mats.deck);
    deck.position.y = 6.2;
    deck.receiveShadow = true;
    g.add(deck);

    // Superestrutura central
    const superstructure = new THREE.Mesh(
        new THREE.BoxGeometry(B * 0.72, 5.5, L * 0.28),
        mats.white
    );
    superstructure.position.set(0, 9, 5);
    superstructure.castShadow = true;
    g.add(superstructure);

    // Ponte de comando separada (K03)
    const bridge = new THREE.Mesh(
        new THREE.BoxGeometry(B * 0.85, 3.2, 8),
        mats.white
    );
    bridge.position.set(0, 11.5, -18);
    bridge.castShadow = true;
    g.add(bridge);
    const bridgeRoof = new THREE.Mesh(new THREE.BoxGeometry(B * 0.9, 0.35, 8.5), mats.steel);
    bridgeRoof.position.set(0, 13.2, -18);
    g.add(bridgeRoof);

    // Chaminé única
    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, 12, 12), mats.funnel);
    funnel.position.set(0, 14, 8);
    funnel.castShadow = true;
    g.add(funnel);
    // A fotografia de época mostra duas faixas claras na chaminé preta.
    for (const y of [15.2, 16.8]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(2.34, 2.34, 0.72, 16), mats.white);
        band.position.set(0, y, 8);
        g.add(band);
    }

    // Mastros
    for (const z of [-45, 35]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 22, 8), mats.wood);
        mast.position.set(0, 17, z);
        g.add(mast);
    }

    // Estais simples para quebrar a leitura de maquete e aproximar a silhueta da foto de 1908.
    const riggingMat = new THREE.LineBasicMaterial({ color: 0x302c26, transparent: true, opacity: 0.7 });
    const addRigging = (from, to) => {
        const geo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(...from),
            new THREE.Vector3(...to)
        ]);
        g.add(new THREE.Line(geo, riggingMat));
    };
    addRigging([0, 28, -45], [-B * 0.46, 6.7, -57]);
    addRigging([0, 28, -45], [ B * 0.46, 6.7, -57]);
    addRigging([0, 28, -45], [0, 7.0, -18]);
    addRigging([0, 28,  35], [-B * 0.46, 6.7,  52]);
    addRigging([0, 28,  35], [ B * 0.46, 6.7,  52]);
    addRigging([0, 28,  35], [0, 7.0, 8]);

    // Amuradas
    for (const side of [-1, 1]) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.9, L * 0.85), mats.steel);
        r.position.set(side * B * 0.48, 6.7, 0);
        g.add(r);
    }

    // Vigias em lote: detalhe barato em draw calls e importante na escala do navio.
    const portholeGeo = new THREE.CircleGeometry(0.17, 10);
    const portholes = new THREE.InstancedMesh(portholeGeo, mats.steel, 40);
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);
    let pi = 0;
    for (const side of [-1, 1]) {
        quaternion.setFromEuler(new THREE.Euler(0, side * Math.PI / 2, 0));
        for (let i = 0; i < 10; i++) {
            matrix.compose(
                new THREE.Vector3(side * B * 0.365, 9.6, -7 + i * 2.6),
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

    // Passageiros no deck (silhuetas — H02). Seed fixo para screenshots A/B reproduzíveis.
    const nPax = quality.id === 'low' ? 12 : 28;
    const paxGeo = new THREE.CapsuleGeometry(0.28, 0.9, 3, 6);
    const paxRandom = seeded(0x19080618);
    for (let i = 0; i < nPax; i++) {
        const p = new THREE.Mesh(paxGeo, i % 3 === 0 ? mats.cloth : mats.clothLight);
        p.position.set(
            (paxRandom() - 0.5) * B * 0.55,
            7.2,
            -30 + paxRandom() * 55
        );
        p.rotation.y = (paxRandom() - 0.5) * 0.7;
        p.castShadow = quality.shadows;
        g.add(p);
    }

    // Âncoras / detalhes de proa
    const anchor = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.4), mats.steel);
    anchor.position.set(-B * 0.35, 4, -L * 0.45);
    g.add(anchor);

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
