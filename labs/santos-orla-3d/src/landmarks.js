/**
 * Landmarks reconhecíveis da orla — formas estilizadas, não modelos CAD.
 */

import * as THREE from 'three';
import { LANDMARKS, ZONES } from './config.js';

function makeFountain() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(
        new THREE.CylinderGeometry(3.2, 3.6, 0.5, 24),
        new THREE.MeshStandardMaterial({ color: 0xb0ada6, roughness: 0.85 })
    );
    base.position.y = 0.25;
    const ring = new THREE.Mesh(
        new THREE.TorusGeometry(2.2, 0.22, 8, 32),
        new THREE.MeshStandardMaterial({ color: 0x8c8982, roughness: 0.7 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.55;
    const jet = new THREE.Mesh(
        new THREE.CylinderGeometry(0.15, 0.25, 2.2, 8),
        new THREE.MeshStandardMaterial({
            color: 0x9fd7ea,
            transparent: true,
            opacity: 0.55,
            roughness: 0.2
        })
    );
    jet.position.y = 1.6;
    // Sapo estilizado (bloco + olhos)
    const toad = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0x3d8f4a, roughness: 0.7 })
    );
    toad.position.set(1.4, 0.9, 0.8);
    toad.scale.set(1, 0.75, 1.1);
    g.add(base, ring, jet, toad);
    return g;
}

function makeAquarium() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
        new THREE.BoxGeometry(14, 7, 10),
        new THREE.MeshStandardMaterial({ color: 0xdfe8ec, roughness: 0.55, metalness: 0.1 })
    );
    body.position.y = 3.5;
    const glass = new THREE.Mesh(
        new THREE.BoxGeometry(10, 4.5, 0.3),
        new THREE.MeshStandardMaterial({
            color: 0x4ab8d4,
            transparent: true,
            opacity: 0.45,
            roughness: 0.15,
            metalness: 0.2,
            emissive: 0x1a6080,
            emissiveIntensity: 0.2
        })
    );
    glass.position.set(0, 3.5, 5.2);
    const roof = new THREE.Mesh(
        new THREE.BoxGeometry(15, 0.5, 11),
        new THREE.MeshStandardMaterial({ color: 0x2f5f72, roughness: 0.6 })
    );
    roof.position.y = 7.2;
    g.add(body, glass, roof);
    return g;
}

function makeDeck() {
    const g = new THREE.Group();
    const planks = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.35, 18),
        new THREE.MeshStandardMaterial({ color: 0x8b6914, roughness: 0.85 })
    );
    planks.position.set(0, 0.4, 8);
    const pileGeo = new THREE.CylinderGeometry(0.25, 0.3, 2.2, 6);
    const pileMat = new THREE.MeshStandardMaterial({ color: 0x5a4010, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
        const pile = new THREE.Mesh(pileGeo, pileMat);
        pile.position.set((i % 2) * 5 - 2.5, -0.4, 2 + i * 2.5);
        g.add(pile);
    }
    const rail = new THREE.Mesh(
        new THREE.BoxGeometry(8.2, 0.15, 0.15),
        new THREE.MeshStandardMaterial({ color: 0xd0d0d4, metalness: 0.5, roughness: 0.4 })
    );
    rail.position.set(0, 1.2, 16.5);
    g.add(planks, rail);
    return g;
}

function makePark() {
    const g = new THREE.Group();
    const platform = new THREE.Mesh(
        new THREE.CylinderGeometry(9, 9.5, 1.2, 24),
        new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.8 })
    );
    platform.position.y = 0.4;
    const ramp = new THREE.Mesh(
        new THREE.BoxGeometry(4, 0.4, 10),
        new THREE.MeshStandardMaterial({ color: 0x5a5e64, roughness: 0.7 })
    );
    ramp.position.set(0, 0.8, -2);
    ramp.rotation.x = -0.12;
    // Bowl de skate simplificado
    const bowl = new THREE.Mesh(
        new THREE.TorusGeometry(3.2, 0.55, 8, 24, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x6a7078, roughness: 0.65 })
    );
    bowl.rotation.x = Math.PI / 2;
    bowl.position.set(0, 1.1, 1);
    g.add(platform, ramp, bowl);
    return g;
}

function makeRock() {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x6a655c, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 5; i++) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(1.4 + i * 0.35, 0), mat);
        rock.position.set((i - 2) * 1.8, 0.8 + (i % 2) * 0.6, (i % 3) * 1.2);
        rock.rotation.set(i * 0.4, i * 0.7, 0.2);
        rock.scale.set(1 + (i % 2) * 0.4, 0.7 + i * 0.15, 1);
        g.add(rock);
    }
    return g;
}

function makeDistrictMarker() {
    const g = new THREE.Group();
    const plaza = new THREE.Mesh(
        new THREE.CircleGeometry(5, 24),
        new THREE.MeshStandardMaterial({ color: 0xc2b8a4, roughness: 0.85 })
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.y = 0.08;
    const statue = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.6, 3.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x8a8680, metalness: 0.35, roughness: 0.45 })
    );
    statue.position.y = 1.7;
    g.add(plaza, statue);
    return g;
}

const BUILDERS = {
    park: makePark,
    rock: makeRock,
    district: makeDistrictMarker,
    fountain: makeFountain,
    building: makeAquarium,
    deck: makeDeck
};

export function createLandmarks() {
    const root = new THREE.Group();
    root.name = 'landmarks';
    const nodes = [];

    for (const lm of LANDMARKS) {
        const builder = BUILDERS[lm.kind] || makeDistrictMarker;
        const mesh = builder();
        mesh.position.set(lm.x, 0, lm.z);
        mesh.userData.landmark = lm;
        root.add(mesh);
        nodes.push({ ...lm, object: mesh });
    }

    // Placa da Av. Bartolomeu de Gusmão (nome da avenida da orla)
    const signMat = new THREE.MeshStandardMaterial({ color: 0x1f4d2e, roughness: 0.6 });
    for (const x of [-200, 0, 200]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.8, 0.15), signMat);
        const board = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.7, 0.1), signMat.clone());
        board.material.color.set(0xf2efe8);
        post.position.set(x, 1.4, ZONES.sidewalk - 0.5);
        board.position.set(x, 2.5, ZONES.sidewalk - 0.5);
        root.add(post, board);
    }

    return { root, nodes };
}
