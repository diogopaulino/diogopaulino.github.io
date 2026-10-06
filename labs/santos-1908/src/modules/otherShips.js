/**
 * other-ships — vapores de café atracados / no canal (P03, tipológico).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { seeded } from '../utils.js';

function makeFreighter(mats, scale = 1) {
    const g = new THREE.Group();
    const L = 70 * scale;
    const B = 11 * scale;

    const hull = new THREE.Mesh(new THREE.BoxGeometry(B, 6, L), mats.hull);
    hull.position.y = 1.5;
    hull.castShadow = true;
    g.add(hull);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(B - 0.4, 0.3, L * 0.9), mats.deck);
    deck.position.y = 4.6;
    g.add(deck);

    const mid = new THREE.Mesh(new THREE.BoxGeometry(B * 0.6, 4, L * 0.25), mats.white);
    mid.position.set(0, 6.8, 0);
    g.add(mid);

    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.4 * scale, 1.6 * scale, 8 * scale, 8), mats.funnel);
    funnel.position.set(0, 10, 4);
    g.add(funnel);

    g.userData.funnel = funnel;
    g.userData.L = L;
    return g;
}

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'other-ships';
    const rnd = seeded(42);
    const ships = [];

    const specs = [
        { z: -120, x: LAYOUT.quayX - 11, scale: 0.85, yaw: 0 },
        { z: 20, x: LAYOUT.quayX - 11, scale: 1.0, yaw: 0 },
        { z: 90, x: LAYOUT.quayX - 12, scale: 0.7, yaw: 0.02 },
        { z: -200, x: -25, scale: 0.9, yaw: 0.4 }
    ].slice(0, quality.ships);

    for (const s of specs) {
        const ship = makeFreighter(mats, s.scale);
        ship.position.set(s.x, 0, s.z);
        ship.rotation.y = s.yaw;
        group.add(ship);
        ships.push(ship);
    }

    // Barcaça / lancha
    const launch = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 12), mats.wood);
    launch.position.set(LAYOUT.quayX - 20, 0.4, LAYOUT.dockZ + 35);
    group.add(launch);

    scene.add(group);

    return {
        update(t) {
            for (const s of ships) {
                s.position.y = Math.sin(t * 0.5 + s.position.z * 0.02) * 0.12;
            }
            // vapor no canal se aproxima lentamente
            if (ships[3]) {
                ships[3].position.z += 0.8 * (1 / 60);
                if (ships[3].position.z > 150) ships[3].position.z = -250;
            }
            void rnd;
        },
        dispose() {
            scene.remove(group);
        }
    };
}
