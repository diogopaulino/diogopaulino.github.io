/**
 * birds — gaivotas esculpidas sobre o estuário (tipologia costeira).
 */

import * as THREE from 'three';
import { seeded } from '../utils.js';
import { createSculptedBird } from '../../../shared/realism.js';

export function create(ctx) {
    const { scene, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'birds';
    const rnd = seeded(99);

    const birds = [];
    for (let i = 0; i < quality.birds; i++) {
        const b = createSculptedBird({
            wingspan: 2.1,
            bodyColor: 0xeeeae0,
            tipColor: 0x343840
        });
        b.position.set(
            -40 + rnd() * 100,
            18 + rnd() * 35,
            -200 + rnd() * 400
        );
        b.userData = {
            left: b.userData.leftWing,
            right: b.userData.rightWing,
            phase: rnd() * Math.PI * 2,
            speed: 8 + rnd() * 10,
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
                b.rotation.y = -a + Math.PI;
                const flap = Math.sin(t * u.speed + u.phase) * 0.55;
                if (u.left) u.left.rotation.z = flap;
                if (u.right) u.right.rotation.z = -flap;
            }
        },
        dispose() {
            scene.remove(group);
        }
    };
}

