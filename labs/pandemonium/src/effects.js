/**
 * Faíscas de coleta e poeira de pouso — partículas em pool, sem alocação no loop.
 */

import * as THREE from 'three';

export class Effects {
    constructor(scene, enabled) {
        this.enabled = enabled;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.particles = [];
        if (!enabled) return;

        const geo = new THREE.SphereGeometry(0.08, 6, 6);
        for (let i = 0; i < 48; i++) {
            const mat = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            this.group.add(mesh);
            this.particles.push({
                mesh,
                vel: new THREE.Vector3(),
                life: 0,
                max: 1
            });
        }
        this.cursor = 0;
    }

    burst(origin, color, count = 10, speed = 4) {
        if (!this.enabled) return;
        for (let i = 0; i < count; i++) {
            const p = this.particles[this.cursor++ % this.particles.length];
            p.mesh.position.copy(origin);
            p.mesh.position.y += 0.4;
            p.vel.set(
                (Math.random() - 0.5) * speed,
                Math.random() * speed,
                (Math.random() - 0.5) * speed
            );
            p.life = p.max = 0.45 + Math.random() * 0.35;
            p.mesh.material.color.setHex(color);
            p.mesh.material.opacity = 1;
            p.mesh.visible = true;
            p.mesh.scale.setScalar(0.8 + Math.random() * 1.2);
        }
    }

    update(dt) {
        if (!this.enabled) return;
        for (const p of this.particles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            p.vel.y -= 9 * dt;
            p.mesh.position.addScaledVector(p.vel, dt);
            p.mesh.material.opacity = Math.max(0, p.life / p.max);
            if (p.life <= 0) p.mesh.visible = false;
        }
    }
}
