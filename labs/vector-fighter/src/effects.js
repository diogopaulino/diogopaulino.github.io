/**
 * Estilhaços poligonais no impacto e no K.O. — cubos do pool, sem alloc no loop.
 */

import * as THREE from 'three';

export class Effects {
    constructor(scene, count) {
        this.group = new THREE.Group();
        scene.add(this.group);
        this.particles = [];
        const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        for (let i = 0; i < count; i++) {
            const mat = new THREE.MeshLambertMaterial({
                color: 0xffffff,
                flatShading: true,
                transparent: true,
                opacity: 0
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            mesh.castShadow = false;
            this.group.add(mesh);
            this.particles.push({
                mesh,
                vel: new THREE.Vector3(),
                spin: new THREE.Vector3(),
                life: 0,
                max: 1
            });
        }
        this.cursor = 0;
    }

    burst(origin, color, n = 12, speed = 5, life = 0.55) {
        for (let i = 0; i < n; i++) {
            const p = this.particles[this.cursor++ % this.particles.length];
            p.mesh.position.copy(origin);
            p.vel.set(
                (Math.random() - 0.5) * speed,
                Math.random() * speed,
                (Math.random() - 0.5) * speed
            );
            p.spin.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
            p.life = p.max = life * (0.7 + Math.random() * 0.5);
            p.mesh.material.color.setHex(color);
            p.mesh.material.opacity = 1;
            p.mesh.visible = true;
            p.mesh.scale.setScalar(0.7 + Math.random() * 1.4);
        }
    }

    shatter(fighter) {
        const color = fighter.def.palette.primary;
        const origin = new THREE.Vector3(fighter.x, 1.1 + fighter.y, fighter.z);
        this.burst(origin, color, 28, 7.5, 1.1);
        this.burst(origin, fighter.def.palette.skin, 14, 5.5, 0.9);
    }

    update(dt) {
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            p.vel.y -= 14 * dt;
            p.mesh.position.addScaledVector(p.vel, dt);
            p.mesh.rotation.x += p.spin.x * dt;
            p.mesh.rotation.y += p.spin.y * dt;
            p.mesh.material.opacity = Math.max(0, p.life / p.max);
            if (p.life <= 0) p.mesh.visible = false;
        }
    }
}
