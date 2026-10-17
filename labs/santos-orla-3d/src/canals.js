/**
 * Canais 1–7: água, muros e pontes/avenidas perpendiculares à orla.
 */

import * as THREE from 'three';
import { CANALS, ZONES, ORLA_HALF } from './config.js';
import { stoneMaterial, plasterMaterial, metalMaterial } from '../../shared/realism.js';

export function createCanals() {
    const root = new THREE.Group();
    root.name = 'canals';

    const waterMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a6a7a,
        roughness: 0.18,
        metalness: 0.12,
        clearcoat: 0.85,
        transparent: true,
        opacity: 0.9
    });
    const wallMat = stoneMaterial(0x8a8680, { roughness: 0.88, repeat: 3 });
    const bridgeMat = plasterMaterial(0x626268, { roughness: 0.72, repeat: 2 });
    const railMat = metalMaterial(0xd4ac2b, { roughness: 0.32, metalness: 0.78 });

    const labels = [];

    for (const canal of CANALS) {
        const g = new THREE.Group();
        g.position.x = canal.x;

        const len = Math.abs(ZONES.inland) + ZONES.gardenOuter + 8;
        const water = new THREE.Mesh(
            new THREE.BoxGeometry(canal.width, 0.35, len),
            waterMat
        );
        water.position.set(0, 0.1, (ZONES.inland + ZONES.gardenOuter) * 0.5);
        g.add(water);

        // Muros laterais
        const wallH = 1.1;
        const wallL = new THREE.Mesh(new THREE.BoxGeometry(0.35, wallH, len), wallMat);
        const wallR = wallL.clone();
        wallL.position.set(-canal.width * 0.5 - 0.2, wallH * 0.5, water.position.z);
        wallR.position.set(canal.width * 0.5 + 0.2, wallH * 0.5, water.position.z);
        g.add(wallL, wallR);

        // Ponte na avenida da orla
        const bridge = new THREE.Mesh(
            new THREE.BoxGeometry(canal.width + 6, 0.4, 8),
            bridgeMat
        );
        bridge.position.set(0, 0.35, ZONES.avenue - 1.5);
        g.add(bridge);

        // Guarda-corpo dourado típico
        for (const side of [-1, 1]) {
            const rail = new THREE.Mesh(
                new THREE.BoxGeometry(canal.width + 5.5, 0.12, 0.12),
                railMat
            );
            rail.position.set(0, 1.05, ZONES.avenue - 1.5 + side * 3.6);
            g.add(rail);
        }

        // Continuação da avenida do canal para o interior
        const road = new THREE.Mesh(
            new THREE.BoxGeometry(canal.width + 5, 0.08, Math.abs(ZONES.inland) - 10),
            new THREE.MeshStandardMaterial({ color: 0x3e3e44, roughness: 0.75 })
        );
        road.position.set(0, 0.06, ZONES.buildings - 20);
        g.add(road);

        root.add(g);
        labels.push({
            id: canal.id,
            name: canal.name,
            avenue: canal.avenue,
            x: canal.x,
            z: ZONES.gardenInner + 4
        });
    }

    // Extremos: mar aberto a oeste (São Vicente) e canal do porto a leste
    const portWater = new THREE.Mesh(
        new THREE.BoxGeometry(40, 0.4, 70),
        waterMat.clone()
    );
    portWater.material.color.set(0x0d4a5c);
    portWater.position.set(ORLA_HALF + 8, 0.05, 10);
    root.add(portWater);

    return { root, labels, waterMat };
}
