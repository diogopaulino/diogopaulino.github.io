/**
 * birds — gaivotas sobre o estuário (tipologia costeira).
 */

import * as THREE from 'three';
import { seeded } from '../utils.js';

export function create(ctx) {
    const { scene, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'birds';
    const rnd = seeded(99);

    const wingGeo = new THREE.PlaneGeometry(1.8, 0.35);
    const mat = new THREE.MeshBasicMaterial({
        color: '#e8e4dc',
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false
    });

    const birds = [];
    for (let i = 0; i < quality.birds; i++) {
        const b = new THREE.Group();
        const left = new THREE.Mesh(wingGeo, mat);
        const right = new THREE.Mesh(wingGeo, mat);
        left.position.x = -0.7;
        right.position.x = 0.7;
        b.add(left, right);
        b.position.set(
            -40 + rnd() * 100,
            18 + rnd() * 35,
            -200 + rnd() * 400
        );
        b.userData = {
            left,
            right,
            phase: rnd() * Math.PI * 2,
            speed: 8 + rnd() * 12,
            radius: 40 + rnd() * 80,
            centerX: b.position.x,
            centerZ: b.position.z,
            baseY: b.position.y
        };
        group.add(b);
        birds.push(b);
    }

    scene.add(group);

    return {
        update(t) {
            for (const b of birds) {
                const u = b.userData;
                const a = t * 0.15 + u.phase;
                b.position.x = u.centerX + Math.cos(a) * u.radius * 0.4;
                b.position.z = u.centerZ + Math.sin(a) * u.radius;
                b.position.y = u.baseY + Math.sin(t * 2 + u.phase) * 2;
                b.rotation.y = -a + Math.PI * 0.5;
                const flap = Math.sin(t * u.speed + u.phase) * 0.6;
                u.left.rotation.z = flap;
                u.right.rotation.z = -flap;
            }
        },
        dispose() {
            wingGeo.dispose();
            mat.dispose();
            scene.remove(group);
        }
    };
}
