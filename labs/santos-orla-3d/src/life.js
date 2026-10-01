/**
 * Vida na orla: pedestres, ciclistas e gaivotas (instâncias leves).
 */

import * as THREE from 'three';
import { ORLA_LENGTH, ZONES, CANALS, WALK } from './config.js';
import { seeded } from './utils.js';

export function createLife(quality) {
    const root = new THREE.Group();
    root.name = 'life';
    const rand = seeded(0x11fe);
    const people = [];
    const bikes = [];
    const birds = [];

    const bodyGeo = new THREE.CapsuleGeometry(0.22, 0.7, 3, 6);
    const colors = [0x2a5f8f, 0xc45c2a, 0x3d7a45, 0x6b4a8a, 0xd4a574, 0x2c2c30, 0xe8e4dc];

    for (let i = 0; i < quality.peopleCount; i++) {
        const mat = new THREE.MeshStandardMaterial({
            color: colors[(rand() * colors.length) | 0],
            roughness: 0.8
        });
        const mesh = new THREE.Mesh(bodyGeo, mat);
        const onBike = rand() > 0.72;
        const x = (rand() - 0.5) * (ORLA_LENGTH - 40);
        const z = onBike
            ? ZONES.bikePath + (rand() - 0.5) * 0.8
            : WALK.pathZ + (rand() - 0.5) * WALK.pathHalfWidth * 1.4;
        mesh.position.set(x, onBike ? 1.15 : 0.95, z);
        mesh.userData = {
            speed: (onBike ? 14 : 4) * (0.7 + rand() * 0.6),
            dir: rand() > 0.5 ? 1 : -1,
            onBike,
            phase: rand() * Math.PI * 2
        };
        root.add(mesh);
        (onBike ? bikes : people).push(mesh);
    }

    // Gaivotas
    const birdGeo = new THREE.ConeGeometry(0.35, 0.9, 3);
    const birdMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f0, roughness: 0.7 });
    const birdCount = quality.id === 'low' ? 6 : 14;
    for (let i = 0; i < birdCount; i++) {
        const mesh = new THREE.Mesh(birdGeo, birdMat);
        mesh.rotation.x = Math.PI / 2;
        mesh.position.set(
            (rand() - 0.5) * ORLA_LENGTH,
            8 + rand() * 18,
            ZONES.sandOuter + rand() * 40
        );
        mesh.userData = {
            speed: 8 + rand() * 10,
            radius: 20 + rand() * 40,
            baseX: mesh.position.x,
            baseZ: mesh.position.z,
            phase: rand() * Math.PI * 2,
            height: mesh.position.y
        };
        root.add(mesh);
        birds.push(mesh);
    }

    function update(t, dt) {
        for (const p of people) {
            const u = p.userData;
            p.position.x += u.dir * u.speed * dt;
            if (p.position.x > ORLA_LENGTH * 0.48) u.dir = -1;
            if (p.position.x < -ORLA_LENGTH * 0.48) u.dir = 1;
            // Desvia de canais
            for (const c of CANALS) {
                if (Math.abs(p.position.x - c.x) < c.width + 1.5) {
                    p.position.x += u.dir * 0.4;
                }
            }
            p.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
            p.position.y = 0.95 + Math.sin(t * 6 + u.phase) * 0.04;
        }
        for (const b of bikes) {
            const u = b.userData;
            b.position.x += u.dir * u.speed * dt;
            if (b.position.x > ORLA_LENGTH * 0.48) u.dir = -1;
            if (b.position.x < -ORLA_LENGTH * 0.48) u.dir = 1;
            b.rotation.y = u.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        for (const bird of birds) {
            const u = bird.userData;
            const a = t * 0.35 + u.phase;
            bird.position.x = u.baseX + Math.cos(a) * u.radius;
            bird.position.z = u.baseZ + Math.sin(a) * u.radius * 0.4;
            bird.position.y = u.height + Math.sin(a * 2) * 1.5;
            bird.rotation.z = Math.sin(t * 8 + u.phase) * 0.4;
        }
    }

    return { root, update };
}
