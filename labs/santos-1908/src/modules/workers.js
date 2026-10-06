/**
 * workers + cargo — estivadores, carroças, sacas de café (P03–P04, H01).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { seeded } from '../utils.js';

function makeWorker(mats, rnd) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.85, 3, 6),
        rnd() > 0.4 ? mats.cloth : mats.clothLight
    );
    body.position.y = 1.15;
    body.castShadow = true;
    g.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mats.skin);
    head.position.y = 1.95;
    g.add(head);

    // Saca às vezes
    if (rnd() > 0.35) {
        const sack = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.4), mats.sack);
        sack.position.set(0, 1.7, -0.35);
        sack.rotation.x = 0.4;
        g.add(sack);
        g.userData.hasSack = true;
    }

    g.userData.phase = rnd() * Math.PI * 2;
    g.userData.speed = 0.4 + rnd() * 0.6;
    return g;
}

function makeCart(mats) {
    const g = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.35, 3.5), mats.wood);
    bed.position.y = 1.1;
    bed.castShadow = true;
    g.add(bed);

    const side = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.15), mats.wood);
    side.position.set(0, 1.5, -1.7);
    g.add(side);

    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
        const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.2, 10), mats.wood);
        wh.rotation.z = Math.PI / 2;
        wh.position.set(x * 1.1, 0.55, z * 1.1);
        g.add(wh);
    }

    // Pilha de sacas
    for (let i = 0; i < 6; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.7), mats.sack);
        s.position.set((i % 3 - 1) * 0.55, 1.4 + Math.floor(i / 3) * 0.4, (i % 2) * 0.4);
        g.add(s);
    }

    return g;
}

export function createWorkers(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'workers';
    const rnd = seeded(781);
    const workers = [];

    for (let i = 0; i < quality.workers; i++) {
        const w = makeWorker(mats, rnd);
        const lane = rnd();
        w.position.set(
            LAYOUT.quayX - 4 + lane * 10,
            1.2,
            LAYOUT.quayZ0 + 30 + rnd() * (LAYOUT.quayZ1 - LAYOUT.quayZ0 - 60)
        );
        w.rotation.y = rnd() * Math.PI * 2;
        w.userData.homeZ = w.position.z;
        w.userData.dir = rnd() > 0.5 ? 1 : -1;
        group.add(w);
        workers.push(w);
    }

    scene.add(group);

    return {
        update(t, dt) {
            for (const w of workers) {
                const walk = Math.sin(t * w.userData.speed + w.userData.phase);
                w.position.z += w.userData.dir * dt * 0.9 * w.userData.speed;
                w.position.y = 1.2 + Math.abs(walk) * 0.04;
                w.rotation.y = w.userData.dir > 0 ? 0 : Math.PI;
                if (w.position.z > LAYOUT.quayZ1 - 10) w.userData.dir = -1;
                if (w.position.z < LAYOUT.quayZ0 + 20) w.userData.dir = 1;
            }
        },
        dispose() {
            scene.remove(group);
        }
    };
}

export function createCargo(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'cargo';
    const rnd = seeded(958);

    // Pilhas de sacas no cais
    for (let p = 0; p < 12; p++) {
        const pile = new THREE.Group();
        const n = 4 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) {
            const s = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.4, 0.75), mats.sack);
            s.position.set(
                (i % 3) * 0.55,
                Math.floor(i / 3) * 0.4 + 0.2,
                Math.floor(i / 6) * 0.7
            );
            s.castShadow = quality.shadows;
            pile.add(s);
        }
        pile.position.set(
            LAYOUT.quayX + rnd() * 8,
            1.2,
            LAYOUT.quayZ0 + 25 + rnd() * 200
        );
        group.add(pile);
    }

    // Carroças (P04)
    for (let i = 0; i < quality.carts; i++) {
        const cart = makeCart(mats);
        cart.position.set(
            LAYOUT.quayX + 2 + rnd() * 6,
            1.2,
            LAYOUT.dockZ - 40 + i * 18 + rnd() * 5
        );
        cart.rotation.y = (rnd() - 0.5) * 0.4;
        cart.userData.phase = rnd() * 10;
        group.add(cart);
    }

    scene.add(group);

    return {
        update(t) {
            group.children.forEach((c, i) => {
                if (c.userData.phase != null) {
                    // carroças quase paradas, leve oscilação
                    c.position.x = LAYOUT.quayX + 2 + (i % 3) + Math.sin(t * 0.2 + c.userData.phase) * 0.15;
                }
            });
        },
        dispose() {
            scene.remove(group);
        }
    };
}
