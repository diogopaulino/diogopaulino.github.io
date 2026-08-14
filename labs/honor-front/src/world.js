/**
 * O setor Charlie: praia, muralha, vila de Sainte-Claire e o penhasco.
 * Colisores AABB e pontos de interação nascem junto da geometria.
 */

import * as THREE from 'three';
import { WORLD } from './config.js';
import { heightAt, hash2, seeded, randRange, clamp } from './utils.js';
import { sandTexture } from './textures.js';
import {
    buildHiggins, buildHedgehog, buildSandbags, buildBunker, buildHouse,
    buildChurch, buildCoastalGun, buildFlag, buildPine, buildCrate,
    buildMedkit, buildWirePost, buildFlareGunStand, buildShip, buildSoldier
} from './models.js';

function boxCollider(x, z, hx, hz) {
    return { minX: x - hx, maxX: x + hx, minZ: z - hz, maxZ: z + hz };
}

function blocked(x, z, colliders, radius) {
    for (let i = 0; i < colliders.length; i++) {
        const c = colliders[i];
        if (x + radius > c.minX && x - radius < c.maxX && z + radius > c.minZ && z - radius < c.maxZ) {
            return true;
        }
    }
    return false;
}

function placeOnGround(obj, x, z, yaw = 0) {
    obj.position.set(x, heightAt(x, z), z);
    obj.rotation.y = yaw;
}

export function buildWorld(scene, quality) {
    const root = new THREE.Group();
    scene.add(root);

    const colliders = [];
    const interactables = [];
    const pickups = [];
    const allies = [];
    const flags = [];

    const terrain = buildTerrain(quality);
    root.add(terrain);

    const boat = buildHiggins();
    boat.position.set(0, 0.05, WORLD.boatStartZ);
    root.add(boat);

    scatterBeach(root, colliders, quality);
    buildSeawall(root, colliders, interactables);
    buildVillage(root, colliders, pickups);
    buildCliff(root, colliders, interactables);
    scatterTrees(root, quality);
    scatterAllies(root, allies);
    addAtmosphere(root, flags);

    return {
        root,
        boat,
        colliders,
        interactables,
        pickups,
        allies,
        flags,
        bounds: {
            minX: WORLD.minX,
            maxX: WORLD.maxX,
            minZ: WORLD.minZ,
            maxZ: WORLD.maxZ
        },
        heightAt,
        blocked(x, z, radius = 0.42) {
            return blocked(x, z, colliders, radius);
        },
        update(t) {
            const cloth = Math.sin(t * 1.6) * 0.12;
            for (const f of flags) {
                if (f.userData.cloth) f.userData.cloth.rotation.y = cloth;
            }
            for (const a of allies) {
                const p = a.userData.parts;
                if (!p || a.userData.dead) continue;
                const ph = t * 2.2 + a.userData.phase;
                p.legs[0].rotation.x = Math.sin(ph) * 0.35;
                p.legs[1].rotation.x = Math.cos(ph) * 0.35;
            }
            const ramp = boat.userData.ramp;
            if (ramp) {
                const open = clamp((boat.position.z - 2.5) / 4, 0, 1);
                ramp.rotation.x = open * 1.15;
            }
        }
    };
}

function buildTerrain(quality) {
    const segsX = quality.terrain;
    const segsZ = Math.floor(quality.terrain * 1.6);
    const width = WORLD.maxX - WORLD.minX + 40;
    const depth = WORLD.maxZ - WORLD.minZ + 30;
    const geo = new THREE.PlaneGeometry(width, depth, segsX, segsZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const sand = new THREE.Color(0xc4a06a);
    const wet = new THREE.Color(0x8a7048);
    const grass = new THREE.Color(0x4a6a32);
    const dirt = new THREE.Color(0x6a5a38);
    const rock = new THREE.Color(0x7a7468);
    const c = new THREE.Color();

    const ox = (WORLD.minX + WORLD.maxX) * 0.5;
    const oz = (WORLD.minZ + WORLD.maxZ) * 0.5;

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + ox;
        const z = pos.getZ(i) + oz;
        const y = heightAt(x, z);
        pos.setY(i, y);
        const tGrass = smooth01((z - 90) / 40);
        const tRock = smooth01((z - 210) / 40);
        const tWet = 1 - smooth01((z + 2) / 14);
        c.copy(sand).lerp(wet, tWet * 0.7);
        c.lerp(grass, tGrass);
        c.lerp(dirt, tGrass * 0.25);
        c.lerp(rock, tRock);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
            vertexColors: true,
            map: sandTexture(),
            roughness: 0.92,
            metalness: 0.02
        });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(ox, 0, oz);
    mesh.receiveShadow = true;
    return mesh;
}

function smooth01(t) {
    const x = t < 0 ? 0 : t > 1 ? 1 : t;
    return x * x * (3 - 2 * x);
}

function scatterBeach(root, colliders, quality) {
    const rng = seeded(1944);
    const count = quality.id === 'low' ? 14 : 22;
    for (let i = 0; i < count; i++) {
        const h = buildHedgehog();
        const x = (rng() - 0.5) * 38;
        const z = 14 + rng() * 62;
        placeOnGround(h, x, z, rng() * Math.PI);
        h.scale.setScalar(0.85 + rng() * 0.4);
        root.add(h);
        colliders.push(boxCollider(x, z, 0.7, 0.7));
    }

    for (let i = 0; i < 8; i++) {
        const w = buildWirePost();
        const x = -22 + i * 6.2;
        const z = 68 + (i % 2) * 3;
        placeOnGround(w, x, z, 0);
        root.add(w);
        if (Math.abs(x) > 4) colliders.push(boxCollider(x, z, 0.8, 0.25));
    }

    for (const [x, z, yaw] of [[-10, 79, 0.1], [12, 80, -0.15], [0, 86, 0]]) {
        const s = buildSandbags();
        placeOnGround(s, x, z, yaw);
        root.add(s);
        colliders.push(boxCollider(x, z, 1.1, 0.35));
    }
}

function buildSeawall(root, colliders, interactables) {
        const wallMat = new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.9 });
        const left = new THREE.Mesh(new THREE.BoxGeometry(32, 3.2, 2.4), wallMat);
        left.position.set(-20, heightAt(-20, 90) + 0.6, 90);
        left.castShadow = true;
        left.receiveShadow = true;
        root.add(left);
        const right = new THREE.Mesh(new THREE.BoxGeometry(32, 3.2, 2.4), wallMat);
        right.position.set(20, heightAt(20, 90) + 0.6, 90);
        right.castShadow = true;
        right.receiveShadow = true;
        root.add(right);
        colliders.push(boxCollider(-20, 90, 16, 1.3));
        colliders.push(boxCollider(20, 90, 16, 1.3));

    const bunker = buildBunker();
    placeOnGround(bunker, -16, 99, 0.12);
    root.add(bunker);
    colliders.push(boxCollider(-16, 99, 3.7, 2.8));

    interactables.push({
        id: 'mg',
        x: -16,
        z: 102.4,
        radius: 2.4,
        label: 'plantar carga no ninho de MG',
        done: false
    });

    const flag = buildFlag(['#2a2c28', '#c4b070', '#2a2c28']);
    placeOnGround(flag, -11.5, 96.2, 0.2);
    root.add(flag);

    const bags = buildSandbags();
    placeOnGround(bags, 6, 96, 0.4);
    root.add(bags);
    colliders.push(boxCollider(6, 96, 1.1, 0.4));
}

function buildVillage(root, colliders, pickups) {
    const houses = [
        [-16, 128, 0.05, 6.2, 5, 3.2],
        [14, 132, -0.1, 7, 5.4, 3.5],
        [-18, 152, 0.2, 5.8, 4.8, 3.1],
        [18, 158, -0.15, 6.6, 5.2, 3.4],
        [-12, 172, 0.08, 6, 5, 3.3],
        [15, 188, -0.05, 6.4, 5.1, 3.2]
    ];
    for (const [x, z, yaw, w, d, h] of houses) {
        const house = buildHouse({ w, d, h });
        placeOnGround(house, x, z, yaw);
        root.add(house);
        colliders.push(boxCollider(x, z, w * 0.48, d * 0.48));
    }

    const church = buildChurch();
    placeOnGround(church, 0, 182, 0);
    root.add(church);
    colliders.push(boxCollider(0, 182, 3.9, 6.2));

    const fountain = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.6, 0.55, 12),
        new THREE.MeshStandardMaterial({ color: 0x9a9488, roughness: 0.7 })
    );
    placeOnGround(fountain, 0, 166, 0);
    fountain.position.y += 0.28;
    fountain.castShadow = true;
    root.add(fountain);
    colliders.push(boxCollider(0, 166, 1.5, 1.5));

    const us = buildFlag(['#2a3a6a', '#d0d4d8', '#8a2830']);
    placeOnGround(us, 4.5, 168, 0.3);
    root.add(us);

    for (const [x, z] of [[-6, 140], [8, 148], [-4, 190]]) {
        const c = buildCrate();
        placeOnGround(c, x, z, hash2(x, z) * 6);
        root.add(c);
        colliders.push(boxCollider(x, z, 0.4, 0.35));
    }

    const kit = buildMedkit();
    placeOnGround(kit, 3.2, 167.5, 0);
    kit.position.y += 0.12;
    root.add(kit);
    pickups.push({ id: 'med', mesh: kit, x: 3.2, z: 167.5, radius: 1.2, used: false });

    const kit2 = buildMedkit();
    placeOnGround(kit2, -12.5, 102.5, 0);
    kit2.position.y += 0.12;
    root.add(kit2);
    pickups.push({ id: 'med', mesh: kit2, x: -12.5, z: 102.5, radius: 1.2, used: false });
}

function buildCliff(root, colliders, interactables) {
    const gun = buildCoastalGun();
    placeOnGround(gun, 0, 248, Math.PI);
    root.add(gun);
    colliders.push(boxCollider(0, 248, 1.6, 2.2));

    interactables.push({
        id: 'gun',
        x: 0,
        z: 245.2,
        radius: 2.6,
        label: 'plantar carga na culatra',
        done: false
    });

    const bags = buildSandbags();
    placeOnGround(bags, -4.5, 242, 0.4);
    root.add(bags);
    colliders.push(boxCollider(-4.5, 242, 1.1, 0.4));

    const stand = buildFlareGunStand();
    placeOnGround(stand, 6.5, 262, -0.4);
    root.add(stand);

    interactables.push({
        id: 'flare',
        x: 6.5,
        z: 262,
        radius: 2.2,
        label: 'disparar o sinalizador',
        done: false
    });

    const bunker = buildBunker();
    bunker.scale.set(0.7, 0.7, 0.7);
    placeOnGround(bunker, -12, 236, 0.5);
    root.add(bunker);
    colliders.push(boxCollider(-12, 236, 2.6, 2));
}

function scatterTrees(root, quality) {
    const rng = seeded(88);
    const n = Math.floor(28 * quality.trees);
    for (let i = 0; i < n; i++) {
        const pine = buildPine();
        const side = rng() < 0.5 ? -1 : 1;
        const x = side * (18 + rng() * 26);
        const z = 118 + rng() * 150;
        const s = 0.85 + rng() * 0.7;
        pine.scale.setScalar(s);
        placeOnGround(pine, x, z, rng() * 6);
        root.add(pine);
    }
}

function scatterAllies(root, allies) {
    const spots = [
        [-2.2, -31.2], [1.8, -30.4], [-1.1, 18], [4.4, 26], [-8, 44]
    ];
    for (const [x, z] of spots) {
        const s = buildSoldier({ team: 'allied' });
        placeOnGround(s, x, z, 0);
        s.userData.phase = randRange(0, 6);
        s.userData.dead = false;
        root.add(s);
        allies.push(s);
    }
}

function addAtmosphere(root, flags) {
    const axis = buildFlag(['#2a2c28', '#c4b070', '#2a2c28']);
    placeOnGround(axis, 10, 100, 0);
    root.add(axis);
    flags.push(axis);

    const us = buildFlag(['#2a3a6a', '#d0d4d8', '#8a2830']);
    placeOnGround(us, 8, 262, 0);
    root.add(us);
    flags.push(us);

    for (let i = 0; i < 3; i++) {
        const ship = buildShip();
        ship.position.set(-40 + i * 38, 0.4, -92 - (i % 2) * 18);
        ship.scale.setScalar(1.4 + i * 0.2);
        ship.rotation.y = 0.08 * (i - 1);
        root.add(ship);
    }

    const smokeGeo = new THREE.PlaneGeometry(4, 8);
    const smokeMat = new THREE.MeshBasicMaterial({
        color: 0x6a645c,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    for (const [x, z] of [[-12, 38], [16, 55], [-6, 72]]) {
        const p = new THREE.Mesh(smokeGeo, smokeMat);
        p.position.set(x, heightAt(x, z) + 5, z);
        root.add(p);
    }
}
