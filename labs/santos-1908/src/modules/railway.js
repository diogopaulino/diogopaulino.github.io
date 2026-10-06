/**
 * railway — trilhos do cais + Estação do Valongo (V01–V02, P08).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';

function makeRails(mats, length) {
    const g = new THREE.Group();
    const sleeperGeo = new THREE.BoxGeometry(2.4, 0.15, 0.25);
    const n = Math.floor(length / 1.2);
    for (let i = 0; i < n; i++) {
        const s = new THREE.Mesh(sleeperGeo, mats.wood);
        s.position.set(0, 0.08, -length * 0.5 + i * 1.2);
        g.add(s);
    }
    for (const x of [-0.75, 0.75]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, length), mats.rail);
        rail.position.set(x, 0.2, 0);
        g.add(rail);
    }
    return g;
}

function makeLocomotive(mats) {
    const g = new THREE.Group();
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 7, 10), mats.steel);
    boiler.rotation.z = Math.PI / 2;
    boiler.position.set(0, 2.2, 0);
    boiler.castShadow = true;
    g.add(boiler);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.8, 2.8, 2.6), mats.funnelBand);
    cab.position.set(0, 2.6, 4.2);
    g.add(cab);

    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 2.2, 8), mats.funnel);
    funnel.position.set(0, 4.2, -2.5);
    g.add(funnel);

    for (const z of [-2, 0, 2]) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 12), mats.steel);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(1.4, 0.9, z);
        g.add(wheel);
        const wheel2 = wheel.clone();
        wheel2.position.x = -1.4;
        g.add(wheel2);
    }

    g.userData.funnel = funnel;
    return g;
}

function makeValongo(mats) {
    // Tipologia: estação alongada com cobertura e platabanda (V01)
    const g = new THREE.Group();
    const hall = new THREE.Mesh(new THREE.BoxGeometry(28, 9, 14), mats.plaster);
    hall.position.y = 4.5;
    hall.castShadow = true;
    g.add(hall);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(32, 0.5, 18), mats.roof);
    roof.position.y = 9.4;
    g.add(roof);

    // Arcadas tipológicas
    for (let i = 0; i < 5; i++) {
        const arch = new THREE.Mesh(new THREE.BoxGeometry(3.5, 5, 0.4), mats.brick);
        arch.position.set(-10 + i * 5, 3, -7.2);
        g.add(arch);
    }

    const platform = new THREE.Mesh(new THREE.BoxGeometry(36, 0.5, 6), mats.quay);
    platform.position.set(0, 0.6, -10);
    g.add(platform);

    const sign = new THREE.Mesh(new THREE.BoxGeometry(8, 1.2, 0.3), mats.white);
    sign.position.set(0, 8, -7.3);
    g.add(sign);

    return g;
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'railway';

    const rails = makeRails(mats, 280);
    rails.position.set(LAYOUT.quayX + 8, 1.2, (LAYOUT.quayZ0 + LAYOUT.quayZ1) * 0.5);
    group.add(rails);

    const rails2 = makeRails(mats, 280);
    rails2.position.set(LAYOUT.quayX + 12, 1.2, rails.position.z);
    group.add(rails2);

    const loco = makeLocomotive(mats);
    loco.position.set(LAYOUT.quayX + 8, 1.2, LAYOUT.valongoZ - 20);
    loco.rotation.y = Math.PI;
    group.add(loco);

    // Vagões
    const wagonCount = quality.id === 'low' ? 2 : 4;
    for (let i = 0; i < wagonCount; i++) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.4, 7), mats.wood);
        w.position.set(LAYOUT.quayX + 8, 2.4, LAYOUT.valongoZ - 35 - i * 9);
        w.castShadow = true;
        group.add(w);
    }

    const station = makeValongo(mats);
    station.position.set(LAYOUT.quayX + 32, 0, LAYOUT.valongoZ);
    group.add(station);

    scene.add(group);

    return {
        update(t) {
            // Locomotiva idle com leve tremor
            loco.position.y = 1.2 + Math.sin(t * 8) * 0.02;
        },
        dispose() {
            scene.remove(group);
        }
    };
}
