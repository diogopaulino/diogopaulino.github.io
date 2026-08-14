/**
 * Amoras que explodem em brilho, corações ao fazer amigo e confete da festa.
 */

import * as THREE from 'three';
import { toon, createHeart } from './models.js';

export class Effects {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.sparks = [];
        this.hearts = [];
        this.confetti = [];
        this._pool(quality.sparks ?? 28);
        this._hearts(10);
        this._confetti(quality.confetti ?? 40);
    }

    _pool(n) {
        const g = new THREE.SphereGeometry(0.07, 8, 6);
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(g, toon(0xffe9a0, {
                emissive: 0xff6eb4,
                em: 0.9,
                transparent: true,
                opacity: 0.9
            }));
            m.visible = false;
            m.castShadow = false;
            this.scene.add(m);
            this.sparks.push({ mesh: m, life: 0, vel: new THREE.Vector3() });
        }
        this.sparkIndex = 0;
    }

    _hearts(n) {
        for (let i = 0; i < n; i++) {
            const h = createHeart();
            h.visible = false;
            this.scene.add(h);
            this.hearts.push({ mesh: h, life: 0 });
        }
        this.heartIndex = 0;
    }

    _confetti(n) {
        const colors = [0xff6eb4, 0xffe066, 0x7ad0ff, 0x6fd15a, 0xff9f43, 0xc9a0ff];
        const g = new THREE.BoxGeometry(0.12, 0.04, 0.08);
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(g, toon(colors[i % colors.length], { emissive: colors[i % colors.length], em: 0.25 }));
            m.visible = false;
            m.castShadow = false;
            this.scene.add(m);
            this.confetti.push({
                mesh: m,
                life: 0,
                vel: new THREE.Vector3()
            });
        }
    }

    burst(position, color = 0xff6eb4) {
        for (let i = 0; i < 8; i++) {
            const p = this.sparks[this.sparkIndex % this.sparks.length];
            this.sparkIndex++;
            p.mesh.position.copy(position);
            p.mesh.position.y += 0.3;
            p.mesh.material.color.set(color);
            p.mesh.material.emissive.set(color);
            p.mesh.material.opacity = 0.95;
            p.mesh.visible = true;
            p.vel.set((Math.random() - 0.5) * 3.2, 1.6 + Math.random() * 2.4, (Math.random() - 0.5) * 3.2);
            p.life = 0.55 + Math.random() * 0.25;
        }
    }

    heart(position) {
        const h = this.hearts[this.heartIndex % this.hearts.length];
        this.heartIndex++;
        h.mesh.position.copy(position);
        h.mesh.position.y += 0.8;
        h.mesh.visible = true;
        h.mesh.scale.setScalar(0.7);
        h.life = 1.1;
    }

    party(origin) {
        for (const c of this.confetti) {
            c.mesh.position.copy(origin);
            c.mesh.position.y += 1.2;
            c.mesh.visible = true;
            c.vel.set((Math.random() - 0.5) * 6, 4 + Math.random() * 5, (Math.random() - 0.5) * 6);
            c.life = 2.2 + Math.random();
        }
    }

    update(dt) {
        for (const p of this.sparks) {
            if (p.life <= 0) {
                p.mesh.visible = false;
                continue;
            }
            p.life -= dt;
            p.vel.y -= 6 * dt;
            p.mesh.position.addScaledVector(p.vel, dt);
            p.mesh.material.opacity = Math.max(0, p.life * 1.6);
            p.mesh.scale.setScalar(0.6 + p.life);
        }
        for (const h of this.hearts) {
            if (h.life <= 0) {
                h.mesh.visible = false;
                continue;
            }
            h.life -= dt;
            h.mesh.position.y += dt * 1.4;
            h.mesh.rotation.y += dt * 2.5;
            h.mesh.scale.setScalar(0.6 + (1.1 - h.life) * 0.5);
        }
        for (const c of this.confetti) {
            if (c.life <= 0) {
                c.mesh.visible = false;
                continue;
            }
            c.life -= dt;
            c.vel.y -= 9 * dt;
            c.mesh.position.addScaledVector(c.vel, dt);
            c.mesh.rotation.x += dt * 6;
            c.mesh.rotation.z += dt * 4;
        }
    }
}
