/**
 * steam — fumaça das chaminés e guindastes (P05, K03).
 * Partículas billboard leves.
 */

import * as THREE from 'three';
import { LAYOUT } from '../config.js';
import { kasatoPose } from './kasato.js';

export function create(ctx) {
    const { scene, mats, quality } = ctx;
    const group = new THREE.Group();
    group.name = 'steam';

    const n = quality.steam;
    const geo = new THREE.SphereGeometry(1, 6, 4);
    const particles = [];

    for (let i = 0; i < n; i++) {
        const p = new THREE.Mesh(geo, mats.smoke.clone());
        p.material.opacity = 0.15 + Math.random() * 0.25;
        p.userData = {
            life: Math.random(),
            speed: 0.8 + Math.random() * 1.5,
            spread: Math.random() * Math.PI * 2,
            source: i % 5 // 0 = kasato, 1-4 = outros
        };
        group.add(p);
        particles.push(p);
    }

    scene.add(group);

    return {
        update(t, dt) {
            const kp = kasatoPose(t);
            for (const p of particles) {
                const u = p.userData;
                u.life += dt * u.speed * 0.25;
                if (u.life > 1) u.life = 0;

                let sx;
                let sy;
                let sz;
                if (u.source === 0) {
                    sx = kp.x;
                    sy = 20;
                    sz = kp.z + 8;
                } else {
                    sx = LAYOUT.quayX - 2 + (u.source - 1) * 0.5;
                    sy = 16;
                    sz = LAYOUT.quayZ0 + 40 + (u.source - 1) * 50;
                }

                const rise = u.life * 18;
                const drift = u.life * 6;
                p.position.set(
                    sx + Math.cos(u.spread + t * 0.2) * drift,
                    sy + rise,
                    sz + Math.sin(u.spread) * drift * 0.5
                );
                const s = 0.8 + u.life * 4;
                p.scale.setScalar(s);
                p.material.opacity = (1 - u.life) * 0.35;
            }
        },
        dispose() {
            geo.dispose();
            for (const p of particles) p.material.dispose();
            scene.remove(group);
        }
    };
}
