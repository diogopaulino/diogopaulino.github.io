/**
 * Castelo em escala — muralhas, torres, ameias, portão, bandeiras, musgo.
 */

import * as THREE from 'three';
import { castleStoneTexture, mossTexture, flagTexture, woodTexture } from './Textures.js';
import { std } from '../characters/builders.js';
import { makeTorch } from './Environment.js';

export function buildCastle() {
    const root = new THREE.Group();
    root.name = 'castle';
    const stone = new THREE.MeshStandardMaterial({
        map: castleStoneTexture(),
        roughness: 0.88,
        color: 0xc8c0b0
    });
    const moss = new THREE.MeshStandardMaterial({ map: mossTexture(), roughness: 0.92, color: 0x5a7a40 });
    const wood = new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.84 });

    const wallH = 18;
    const wallT = 2.4;
    const court = 28;

    const mkWall = (w, d, x, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), stone);
        m.position.set(x, wallH / 2, z);
        m.castShadow = true;
        m.receiveShadow = true;
        root.add(m);
        const mossBand = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 2.2, d * 1.02), moss);
        mossBand.position.set(x, 1.1, z);
        root.add(mossBand);
        addCrenels(root, stone, x, z, w, d, wallH);
    };

    mkWall(court + wallT, wallT, 0, -court / 2);
    mkWall(court + wallT, wallT, 0, court / 2);
    mkWall(wallT, court, -court / 2, 0);
    mkWall(wallT, court, court / 2, 0);

    for (const [x, z] of [
        [-court / 2, -court / 2],
        [court / 2, -court / 2],
        [-court / 2, court / 2],
        [court / 2, court / 2]
    ]) {
        const tower = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.6, 26, 10), stone);
        tower.position.set(x, 13, z);
        tower.castShadow = true;
        root.add(tower);
        const roof = new THREE.Mesh(new THREE.ConeGeometry(3.8, 4.5, 10), std(0x5a1c1c, 0.75));
        roof.position.set(x, 28, z);
        root.add(roof);
        const flag = makeFlag();
        flag.position.set(x, 31, z);
        root.add(flag);
    }

    const keep = new THREE.Mesh(new THREE.BoxGeometry(12, 22, 12), stone);
    keep.position.set(0, 11, -2);
    keep.castShadow = true;
    root.add(keep);
    const keepRoof = new THREE.Mesh(new THREE.BoxGeometry(13, 1.2, 13), std(0x4a1818, 0.7));
    keepRoof.position.set(0, 22.4, -2);
    root.add(keepRoof);

    const gate = new THREE.Mesh(new THREE.BoxGeometry(7, 10, 1.2), wood);
    gate.position.set(0, 5, court / 2 + 0.4);
    gate.name = 'mainGate';
    root.add(gate);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.7, 8, 16, Math.PI), stone);
    arch.position.set(0, 9.5, court / 2 + 0.5);
    arch.rotation.y = Math.PI;
    root.add(arch);

    const walk = new THREE.Mesh(new THREE.BoxGeometry(court, 0.4, 2), stone);
    walk.position.set(0, wallH - 0.5, court / 2 - 0.2);
    walk.name = 'archerWalk';
    root.add(walk);

    for (let i = -3; i <= 3; i++) {
        const torch = makeTorch();
        torch.position.set(i * 3.2, 6, court / 2 + 1.3);
        root.add(torch);
    }

    const secret = new THREE.Group();
    secret.name = 'secretDoor';
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.2, 0.18), wood);
    secret.add(door);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.1), std(0x6a3a12, 0.5, 0.6));
    lock.position.set(0.4, 0, 0.12);
    secret.add(lock);
    secret.position.set(-court / 2 - 1.3, 1.15, -6);
    root.add(secret);

    const vine = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.2), moss);
    vine.position.set(-court / 2 - 1.35, 2.2, -6);
    vine.rotation.y = Math.PI / 2;
    root.add(vine);

    root.userData.secretDoor = secret;
    root.userData.gate = gate;
    root.userData.court = court;
    return root;
}

function addCrenels(root, mat, x, z, w, d, h) {
    const alongX = w > d;
    const len = alongX ? w : d;
    const n = Math.floor(len / 2.2);
    for (let i = 0; i < n; i++) {
        const t = (i / n - 0.5) * len;
        const c = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 1.1 : d + 0.4, 1.4, alongX ? d + 0.4 : 1.1), mat);
        c.position.set(alongX ? x + t : x, h + 0.7, alongX ? z : z + t);
        root.add(c);
    }
}

function makeFlag() {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.2, 5), std(0x3a2a18, 0.8));
    pole.position.y = 1.6;
    g.add(pole);
    const cloth = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.9, 4, 2),
        new THREE.MeshStandardMaterial({ map: flagTexture('#6b1c1c'), side: THREE.DoubleSide, roughness: 0.8 })
    );
    cloth.position.set(0.8, 2.7, 0);
    cloth.name = 'flag';
    g.add(cloth);
    return g;
}

export function addCastleColliders(collision, ox, oz) {
    const court = 28;
    const t = 2.4;
    const h = 18;
    collision.addWall(ox, oz - court / 2, court + t, t, h);
    collision.addWall(ox, oz + court / 2, court + t, t, h);
    collision.addWall(ox - court / 2, oz, t, court, h);
    collision.addWall(ox + court / 2, oz, t, court, h);
    collision.addWall(ox, oz + court / 2 + 0.4, 7, 1.2, 10);
}
