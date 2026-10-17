/**
 * workers + cargo — estivadores esculpidos, carroças com rodas raiadas e sacas de café (P03–P04, H01).
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { seeded } from '../utils.js';
import {
    createSculptedHuman,
    animateSculptedHuman,
    createCoffeeSack,
    createSpokedWheel
} from '../../../shared/realism.js';

const SHIRT_COLORS = [0xd8d0c0, 0xc9bfa8, 0x3a4550, 0x5c5346, 0x7a6e5d];
const PANTS_COLORS = [0x2c323b, 0x3d352e, 0x464a52, 0x2a2622];
const HAT_COLORS = [0x4a3b2c, 0x2e2a25, 0x8a795d, null];

function makeWorker(_mats, rnd) {
    const hasSack = rnd() > 0.35;
    const shirt = SHIRT_COLORS[(rnd() * SHIRT_COLORS.length) | 0];
    const pants = PANTS_COLORS[(rnd() * PANTS_COLORS.length) | 0];
    const hat = HAT_COLORS[(rnd() * HAT_COLORS.length) | 0];
    const g = createSculptedHuman({
        style: 'human',
        skin: rnd() > 0.35 ? 0xc49a72 : 0x8d6242,
        hair: 0x241810,
        shirt,
        pants,
        shoes: 0x221812,
        hat,
        carrySack: hasSack,
        detailedFace: false,
        scale: 1.05
    });
    g.userData.hasSack = hasSack;
    g.userData.phase = rnd() * Math.PI * 2;
    g.userData.speed = 0.45 + rnd() * 0.55;
    return g;
}

function makeCart(mats) {
    const g = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.24, 3.5), mats.wood);
    bed.position.y = 1.05;
    bed.castShadow = true;
    bed.receiveShadow = true;
    g.add(bed);

    // Fueiros e grades laterais de madeira
    for (const sx of [-1.04, 1.04]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 3.45), mats.wood);
        rail.position.set(sx, 1.52, 0);
        g.add(rail);
        for (const sz of [-1.4, -0.5, 0.5, 1.4]) {
            const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.58, 6), mats.wood);
            post.position.set(sx, 1.32, sz);
            g.add(post);
        }
    }

    const frontBoard = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.65, 0.12), mats.wood);
    frontBoard.position.set(0, 1.42, -1.68);
    g.add(frontBoard);

    // Varais dianteiros da carroça
    for (const sx of [-0.55, 0.55]) {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.7, 6), mats.wood);
        shaft.rotation.x = Math.PI / 2 - 0.15;
        shaft.position.set(sx, 0.96, -2.45);
        g.add(shaft);
    }

    // Rodas raiadas com aro de ferro
    for (const [x, z, r] of [[-1.14, 1.05, 0.52], [1.14, 1.05, 0.52], [-1.14, -1.05, 0.44], [1.14, -1.05, 0.44]]) {
        const wh = createSpokedWheel({
            radius: r,
            width: 0.12,
            spokes: 10,
            rimMaterial: mats.wood,
            hubMaterial: mats.steel
        });
        wh.rotation.y = Math.PI / 2;
        wh.position.set(x, r, z);
        g.add(wh);
    }

    // Pilha orgânica de sacas de café
    for (let i = 0; i < 8; i++) {
        const s = createCoffeeSack(mats.sack, { width: 0.58, height: 0.36, depth: 0.78 });
        const row = i % 3;
        const layer = Math.floor(i / 3);
        s.position.set(
            (row - 1) * 0.56 + (layer % 2) * 0.06,
            1.32 + layer * 0.31,
            -0.6 + (i % 2) * 0.72
        );
        s.rotation.y = ((i * 1.7) % 0.4) - 0.2;
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
                const phase = t * w.userData.speed * 5.2 + w.userData.phase;
                w.position.z += w.userData.dir * dt * 0.9 * w.userData.speed;
                w.position.y = 1.2;
                w.rotation.y = w.userData.dir > 0 ? 0 : Math.PI;
                animateSculptedHuman(w, phase, 0.55);
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

    // Pilhas de sacas de café esculpidas no cais
    for (let p = 0; p < 12; p++) {
        const pile = new THREE.Group();
        const n = 5 + Math.floor(rnd() * 8);
        for (let i = 0; i < n; i++) {
            const s = createCoffeeSack(mats.sack, { width: 0.56, height: 0.35, depth: 0.76 });
            const layer = Math.floor(i / 3);
            s.position.set(
                (i % 3) * 0.54 + (layer % 2) * 0.08,
                layer * 0.3 + 0.18,
                Math.floor(i / 6) * 0.68
            );
            s.rotation.y = (rnd() - 0.5) * 0.25;
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
                    c.position.x = LAYOUT.quayX + 2 + (i % 3) + Math.sin(t * 0.2 + c.userData.phase) * 0.15;
                }
            });
        },
        dispose() {
            scene.remove(group);
        }
    };
}

