/**
 * other-ships — vapores de café atracados / no canal (P03, tipológico).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { seeded } from '../utils.js';
import { profileTube } from '../../../shared/realism.js';

function makeShipHull(L, B, H) {
    const geo = profileTube({
        axis: 'z',
        length: L,
        rings: 14,
        seg: 16,
        squashY: 0.55,
        radius: (t) => {
            const bow = Math.pow(Math.sin(t * Math.PI), 0.58);
            return Math.max(0.4, bow * (B * 0.52));
        }
    });
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        if (y > 0.35) pos.setY(i, 0.35 + (y - 0.35) * 0.25);
        pos.setY(i, pos.getY(i) * (H / (B * 0.55)));
    }
    geo.computeVertexNormals();
    return geo;
}

function makeFreighter(mats, scale = 1) {
    const g = new THREE.Group();
    const L = 70 * scale;
    const B = 11 * scale;

    const hull = new THREE.Mesh(makeShipHull(L, B, 5.8 * scale), mats.hull);
    hull.position.y = 2.6 * scale;
    hull.castShadow = true;
    hull.receiveShadow = true;
    g.add(hull);

    const boot = new THREE.Mesh(makeShipHull(L * 0.97, B * 0.96, 2.2 * scale), mats.hullBoot);
    boot.position.y = 0.7 * scale;
    g.add(boot);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(B * 0.78, 0.3 * scale, L * 0.78), mats.deck);
    deck.position.y = 4.55 * scale;
    g.add(deck);

    const mid = new THREE.Mesh(new THREE.BoxGeometry(B * 0.58, 3.6 * scale, L * 0.24), mats.white);
    mid.position.set(0, 6.4 * scale, 0);
    mid.castShadow = true;
    g.add(mid);

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(B * 0.66, 2.1 * scale, 4.5 * scale), mats.white);
    bridge.position.set(0, 8.6 * scale, -L * 0.06);
    g.add(bridge);

    const funnel = new THREE.Mesh(new THREE.CylinderGeometry(1.35 * scale, 1.55 * scale, 7.8 * scale, 14), mats.funnel);
    funnel.position.set(0, 10 * scale, 3.5 * scale);
    funnel.castShadow = true;
    g.add(funnel);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(1.42 * scale, 1.44 * scale, 0.9 * scale, 14), mats.funnelBand);
    band.position.set(0, 11.4 * scale, 3.5 * scale);
    g.add(band);

    for (const mz of [-L * 0.28, L * 0.26]) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.24 * scale, 14 * scale, 8), mats.wood);
        mast.position.set(0, 11 * scale, mz);
        g.add(mast);
    }

    g.userData.funnel = funnel;
    g.userData.L = L;
    return g;
}

function makeSteamLaunch(mats) {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(makeShipHull(12.5, 3.6, 1.6), mats.wood);
    hull.position.y = 0.65;
    hull.castShadow = true;
    g.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.1, 5.2), mats.white);
    cabin.position.set(0, 1.4, 0.4);
    g.add(cabin);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.6, 10), mats.funnelBand);
    stack.position.set(0, 2.1, -1.2);
    g.add(stack);
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

    // Lancha a vapor portuária esculpida
    const launch = makeSteamLaunch(mats);
    launch.position.set(LAYOUT.quayX - 20, 0.1, LAYOUT.dockZ + 35);
    group.add(launch);

    scene.add(group);

    return {
        update(t) {
            for (const s of ships) {
                s.position.y = Math.sin(t * 0.5 + s.position.z * 0.02) * 0.12;
            }
            launch.position.y = 0.1 + Math.sin(t * 1.1) * 0.08;
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

