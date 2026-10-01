/**
 * port — cais, armazéns, guindastes a vapor (P01–P07).
 * Tipologia fotográfica: armazéns longos, amurada, guindastes esparsos.
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { seeded } from '../utils.js';

function makeWarehouse(mats, len, depth, h, rnd) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(depth, h, len),
        rnd() > 0.45 ? mats.brick : mats.plaster
    );
    body.position.y = h * 0.5;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(depth + 1.2, 0.6, len + 0.8),
        mats.roof
    );
    roof.position.y = h + 0.2;
    roof.castShadow = true;
    g.add(roof);

    // Portas / vãos tipológicos
    const doorMat = mats.wood;
    const nDoors = Math.max(2, Math.floor(len / 18));
    for (let i = 0; i < nDoors; i++) {
        const door = new THREE.Mesh(new THREE.BoxGeometry(0.4, h * 0.55, 4.5), doorMat);
        door.position.set(-depth * 0.5 - 0.1, h * 0.28, -len * 0.4 + (i / (nDoors - 1 || 1)) * len * 0.8);
        g.add(door);
    }

    // Número do armazém (placa)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 2.4), mats.white);
    plate.position.set(-depth * 0.5 - 0.2, h * 0.75, 0);
    g.add(plate);

    return g;
}

function makeCrane(mats) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.2, 8), mats.steel);
    base.position.y = 1.1;
    base.castShadow = true;
    g.add(base);

    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.7, 14, 0.7), mats.steel);
    mast.position.y = 8;
    mast.castShadow = true;
    g.add(mast);

    const boom = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 16), mats.steel);
    boom.position.set(0, 13.5, -6);
    boom.rotation.x = -0.35;
    boom.castShadow = true;
    g.add(boom);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 2.8), mats.funnelBand);
    cabin.position.set(0, 4.5, 0.5);
    g.add(cabin);

    // Caldeira / vapor base
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 2.5, 8), mats.funnel);
    boiler.position.set(1.8, 1.4, 1.2);
    g.add(boiler);

    g.userData.boom = boom;
    return g;
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'port';
    const rnd = seeded(1908);

    // Plataforma do cais
    const quayLen = LAYOUT.quayZ1 - LAYOUT.quayZ0;
    const quay = new THREE.Mesh(
        new THREE.BoxGeometry(22, 1.4, quayLen + 40),
        mats.quay
    );
    quay.position.set(LAYOUT.quayX + 5, 0.5, (LAYOUT.quayZ0 + LAYOUT.quayZ1) * 0.5);
    quay.receiveShadow = true;
    quay.castShadow = true;
    group.add(quay);

    // Amurada
    const wall = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 1.1, quayLen + 40),
        mats.quay
    );
    wall.position.set(LAYOUT.quayX - 5.5, 1.4, quay.position.z);
    group.add(wall);

    // Armazéns
    const n = quality.warehouses;
    let z = LAYOUT.quayZ0 + 10;
    for (let i = 0; i < n; i++) {
        const len = 28 + rnd() * 22;
        const h = 8 + rnd() * 4;
        const w = makeWarehouse(mats, len, LAYOUT.warehouseDepth, h, rnd);
        w.position.set(LAYOUT.quayX + 18, 0, z + len * 0.5);
        group.add(w);

        // Armazém 14 marcado perto do ponto de atracação
        if (Math.abs(z + len * 0.5 - LAYOUT.dockZ) < 35) {
            w.userData.is14 = true;
            const flag = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.5, 3.5), mats.funnelBand);
            flag.position.set(-LAYOUT.warehouseDepth * 0.5 - 0.3, h + 1.5, 0);
            w.add(flag);
        }

        z += len + 6 + rnd() * 4;
        if (z > LAYOUT.quayZ1) break;
    }

    // Guindastes a vapor (P05) — esparsos
    const craneCount = quality.id === 'low' ? 2 : 4;
    for (let i = 0; i < craneCount; i++) {
        const cr = makeCrane(mats);
        cr.position.set(
            LAYOUT.quayX - 2,
            0,
            LAYOUT.quayZ0 + 40 + i * ((LAYOUT.quayZ1 - LAYOUT.quayZ0 - 60) / Math.max(craneCount - 1, 1))
        );
        cr.rotation.y = Math.PI * 0.5 + (rnd() - 0.5) * 0.3;
        group.add(cr);
    }

    // Postes / luminárias a gás tipológicas
    for (let i = 0; i < 10; i++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 5.5, 6), mats.steel);
        pole.position.set(LAYOUT.quayX + 2, 2.75, LAYOUT.quayZ0 + 20 + i * 30);
        group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), mats.funnelBand);
        lamp.position.set(0, 2.9, 0);
        pole.add(lamp);
    }

    scene.add(group);

    return {
        update(t) {
            group.traverse((o) => {
                if (o.userData.boom) {
                    o.userData.boom.rotation.x = -0.35 + Math.sin(t * 0.15 + o.position.z * 0.01) * 0.08;
                }
            });
        },
        dispose() {
            scene.remove(group);
        }
    };
}
