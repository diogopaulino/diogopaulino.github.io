/**
 * Sala rústica da casa — lareira, sofá, tapete, estante, brinquedos.
 */

import * as THREE from 'three';
import {
    woodTexture, darkWoodTexture, plasterTexture, rugTexture, clothTexture
} from './Textures.js';
import { std } from '../characters/builders.js';
import { makeFire } from './Environment.js';

export function buildHomeInterior() {
    const g = new THREE.Group();
    const plaster = new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 0.9, color: 0xe8d8c0 });
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ map: darkWoodTexture(), roughness: 0.85 });

    const floor = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 8), dark);
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    g.add(floor);

    const ceil = new THREE.Mesh(new THREE.BoxGeometry(10, 0.2, 8), wood);
    ceil.position.y = 3.4;
    g.add(ceil);

    const wall = (w, h, d, x, y, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plaster);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        g.add(m);
        return m;
    };
    wall(10, 3.6, 0.25, 0, 1.7, -4);
    wall(10, 3.6, 0.25, 0, 1.7, 4);
    wall(0.25, 3.6, 8, -5, 1.7, 0);
    wall(0.25, 3.6, 8, 5, 1.7, 0);

    const fireplace = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.2, 0.7), dark);
    fireplace.position.set(0, 1.1, -3.55);
    g.add(fireplace);
    const opening = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 0.4), std(0x1a1008, 1));
    opening.position.set(0, 0.75, -3.2);
    g.add(opening);
    const fire = makeFire(0.85);
    fire.position.set(0, 0.15, -3.15);
    fire.name = 'hearth';
    g.add(fire);

    const mantel = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.5), wood);
    mantel.position.set(0, 2.15, -3.45);
    g.add(mantel);

    const rug = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.04, 2.4),
        new THREE.MeshStandardMaterial({ map: rugTexture(), roughness: 0.9 })
    );
    rug.position.set(0, 0.03, 0.3);
    rug.receiveShadow = true;
    g.add(rug);

    const sofa = new THREE.Group();
    const seat = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 0.4, 0.9),
        new THREE.MeshStandardMaterial({ map: clothTexture(), color: 0x6a3a28, roughness: 0.88 })
    );
    seat.position.y = 0.4;
    sofa.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.2), std(0x5a3222, 0.88));
    back.position.set(0, 0.85, -0.4);
    sofa.add(back);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.18, 1), wood);
    frame.position.y = 0.18;
    sofa.add(frame);
    sofa.position.set(0, 0, 1.4);
    sofa.name = 'sofa';
    g.add(sofa);

    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.35), wood);
    shelf.position.set(-4.2, 1.2, -2.4);
    g.add(shelf);
    for (let i = 0; i < 12; i++) {
        const book = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.28, 0.22),
            std([0x6b1c1c, 0x1c3a6b, 0x3a5a1c, 0x5a3a1c][i % 4], 0.8)
        );
        book.position.set(-4.2 + (i % 6) * 0.16 - 0.4, 0.55 + Math.floor(i / 6) * 0.7, -2.4);
        g.add(book);
    }

    const table = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.8), wood);
    table.position.set(3.2, 0.28, 1.2);
    table.name = 'sideTable';
    g.add(table);
    const shiny = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xd4b45a, metalness: 0.9, roughness: 0.25, emissive: 0x332200, emissiveIntensity: 0.4 })
    );
    shiny.position.set(3.2, 0.62, 1.2);
    shiny.name = 'shinyToy';
    g.add(shiny);

    const horse = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.22, 0.12), std(0x8a5a2a, 0.8));
    horse.position.set(-3.4, 0.14, 2.2);
    g.add(horse);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), std(0x8a1c1c, 0.6));
    ball.position.set(-3.1, 0.12, 2.5);
    g.add(ball);

    for (const x of [-2.6, 2.6]) {
        const frameW = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.2, 0.08), wood);
        frameW.position.set(x, 1.8, -3.88);
        g.add(frameW);
        const glass = new THREE.Mesh(
            new THREE.PlaneGeometry(0.9, 1),
            new THREE.MeshStandardMaterial({ color: 0x0a1228, emissive: 0x081018, emissiveIntensity: 0.2 })
        );
        glass.position.set(x, 1.8, -3.82);
        g.add(glass);
        const stars = new THREE.Points(
            new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(-0.2, 0.2, 0),
                new THREE.Vector3(0.15, 0.35, 0),
                new THREE.Vector3(0.3, -0.1, 0)
            ]),
            new THREE.PointsMaterial({ color: 0xfff4cc, size: 0.04 })
        );
        stars.position.set(x, 1.9, -3.8);
        g.add(stars);
    }

    const lamp = new THREE.PointLight(0xffb070, 0.55, 9);
    lamp.position.set(-2.4, 2.4, 1.5);
    g.add(lamp);

    g.userData.fire = fire;
    g.userData.shiny = shiny;
    return g;
}

export function addHomeColliders(collision) {
    collision.addFloor(0, 0, 10, 8, 0);
    collision.addWall(0, -4, 10, 0.3, 3.6);
    collision.addWall(0, 4, 10, 0.3, 3.6);
    collision.addWall(-5, 0, 0.3, 8, 3.6);
    collision.addWall(5, 0, 0.3, 8, 3.6);
    collision.addWall(0, -3.55, 2.4, 0.7, 2.2);
}
