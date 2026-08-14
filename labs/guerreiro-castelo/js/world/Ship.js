/**
 * Navio medieval de madeira — convés, mastro, vela, leme, barris, cordas.
 */

import * as THREE from 'three';
import { woodTexture, clothTexture, darkWoodTexture } from './Textures.js';
import { std } from '../characters/builders.js';

export function buildShip() {
    const ship = new THREE.Group();
    ship.name = 'ship';
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.82, color: 0xc4a06a });
    const dark = new THREE.MeshStandardMaterial({ map: darkWoodTexture(), roughness: 0.85 });

    const hull = new THREE.Mesh(new THREE.BoxGeometry(7.2, 2.2, 18), wood);
    hull.position.y = 0.2;
    hull.castShadow = true;
    hull.receiveShadow = true;
    ship.add(hull);

    const bow = new THREE.Mesh(new THREE.ConeGeometry(2.2, 4.5, 4), wood);
    bow.rotation.x = -Math.PI / 2;
    bow.position.set(0, 0.4, -10.2);
    ship.add(bow);

    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.18, 16.5), dark);
    deck.position.y = 1.35;
    deck.receiveShadow = true;
    ship.add(deck);

    const railGeo = new THREE.BoxGeometry(0.12, 0.55, 16);
    const railL = new THREE.Mesh(railGeo, wood);
    railL.position.set(-3.2, 1.7, 0);
    const railR = railL.clone();
    railR.position.x = 3.2;
    ship.add(railL, railR);

    const qdeck = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 4.2), dark);
    qdeck.position.set(0, 2.15, 6.2);
    qdeck.receiveShadow = true;
    ship.add(qdeck);
    const qwall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.9, 0.2), wood);
    qwall.position.set(0, 1.8, 4.1);
    ship.add(qwall);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 11, 8), dark);
    mast.position.set(0, 6.8, -0.5);
    mast.castShadow = true;
    ship.add(mast);

    const yard = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 8, 6), dark);
    yard.rotation.z = Math.PI / 2;
    yard.position.set(0, 10.2, -0.5);
    ship.add(yard);

    const sail = new THREE.Mesh(
        new THREE.PlaneGeometry(7.2, 6.5, 8, 6),
        new THREE.MeshStandardMaterial({
            map: clothTexture(),
            color: 0xe8dcc4,
            side: THREE.DoubleSide,
            roughness: 0.9
        })
    );
    sail.position.set(0, 7.4, -0.7);
    sail.name = 'sail';
    ship.add(sail);

    const helm = new THREE.Group();
    helm.name = 'helm';
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 16), std(0x5a3a18, 0.6, 0.1));
    for (let i = 0; i < 8; i++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.8, 0.05), std(0x5a3a18, 0.7));
        spoke.rotation.z = (i / 8) * Math.PI;
        helm.add(spoke);
    }
    helm.add(wheel);
    helm.position.set(0, 2.7, 7.4);
    ship.add(helm);

    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.1, 6), dark);
    post.position.set(0, 2.2, 7.4);
    ship.add(post);

    for (const x of [-2.2, 2.2]) {
        for (const z of [-4, -1, 2]) {
            const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.7, 10), wood);
            barrel.position.set(x, 1.72, z);
            barrel.castShadow = true;
            barrel.name = 'barrel';
            ship.add(barrel);
        }
    }

    const crate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), wood);
    crate.position.set(1.8, 1.72, 5.2);
    crate.name = 'crate';
    ship.add(crate);

    const rope = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
            new THREE.Vector3(-2.4, 1.5, 3),
            new THREE.Vector3(-1.2, 2.4, 4.5),
            new THREE.Vector3(0.2, 2.2, 6.8),
            new THREE.Vector3(0.4, 2.6, 7.5)
        ]), 16, 0.03, 5, false),
        std(0x8a6a3a, 0.8)
    );
    rope.name = 'stormRope';
    rope.visible = false;
    ship.add(rope);

    const mooring = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), std(0x8a6a3a, 0.8));
    mooring.rotation.z = 0.7;
    mooring.position.set(2.6, 1.4, 8.2);
    mooring.name = 'mooring';
    ship.add(mooring);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.2, 1.6, 3.2), wood);
    cabin.position.set(0, 2.15, -5.4);
    ship.add(cabin);

    ship.userData.sail = sail;
    ship.userData.helm = helm;
    ship.userData.rope = rope;
    ship.userData.mooring = mooring;
    ship.userData.mast = mast;
    return ship;
}

export function addShipColliders(collision, ox = 0, oy = 0, oz = 0) {
    collision.addFloor(ox, oz, 6.4, 16, oy + 1.44);
    collision.addFloor(ox, oz + 6.2, 6.2, 4.2, oy + 2.23);
    collision.addWall(ox - 3.25, oz, 0.25, 16, 1.2, oy + 1.44);
    collision.addWall(ox + 3.25, oz, 0.25, 16, 1.2, oy + 1.44);
    collision.addWall(ox, oz + 4.1, 6.4, 0.25, 0.9, oy + 1.44);
    collision.addWall(ox, oz - 5.4, 4.2, 3.2, 1.6, oy + 1.44);
}
