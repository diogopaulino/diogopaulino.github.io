/**
 * Esporos bioluminescentes, rastro da ira e explosões de semente.
 */

import * as THREE from 'three';
import { glowSprite } from './textures.js';
import { WORLD } from './config.js';
import { hash } from './utils.js';

export class Effects {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.bursts = [];
        this.trail = [];
        this._spores(quality.spores);
        this._trail(28);
        this._godrays();
    }

    _spores(count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const phase = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const a = hash(i * 3.1) * Math.PI * 2;
            const r = hash(i * 7.7) * WORLD.radius * 0.9;
            pos[i * 3] = Math.cos(a) * r;
            pos[i * 3 + 1] = 6 + hash(i * 2.2) * 140;
            pos[i * 3 + 2] = Math.sin(a) * r;
            phase[i] = hash(i) * Math.PI * 2;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.sporePhase = phase;
        this.spores = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                map: glowSprite('#7af0d8'),
                color: 0xaef8e8,
                size: 1.15,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.scene.add(this.spores);
    }

    _trail(n) {
        const mat = new THREE.SpriteMaterial({
            map: glowSprite('#5ef0d8'),
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        for (let i = 0; i < n; i++) {
            const s = new THREE.Sprite(mat.clone());
            s.visible = false;
            s.scale.setScalar(0.8);
            this.scene.add(s);
            this.trail.push({ mesh: s, life: 0 });
        }
        this.trailIndex = 0;
    }

    _godrays() {
        const mat = new THREE.MeshBasicMaterial({
            color: 0xffe8b0,
            transparent: true,
            opacity: 0.045,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        this.rays = [];
        for (let i = 0; i < 5; i++) {
            const cone = new THREE.Mesh(new THREE.ConeGeometry(18, 90, 8, 1, true), mat.clone());
            cone.position.set((i - 2) * 28, 80, -40 + i * 12);
            cone.rotation.x = Math.PI;
            cone.rotation.z = 0.18;
            this.scene.add(cone);
            this.rays.push(cone);
        }
    }

    sparkle(position) {
        const p = this.trail[this.trailIndex % this.trail.length];
        this.trailIndex++;
        p.mesh.position.copy(position);
        p.mesh.position.x += (Math.random() - 0.5) * 0.6;
        p.mesh.position.y += (Math.random() - 0.5) * 0.4;
        p.mesh.visible = true;
        p.mesh.material.opacity = 0.9;
        p.mesh.scale.setScalar(0.6 + Math.random() * 0.8);
        p.life = 0.55;
    }

    burst(position, color = 0x7af0d8) {
        const geo = new THREE.BufferGeometry();
        const n = 28;
        const pos = new Float32Array(n * 3);
        const vel = [];
        for (let i = 0; i < n; i++) {
            pos[i * 3] = position.x;
            pos[i * 3 + 1] = position.y;
            pos[i * 3 + 2] = position.z;
            const dir = new THREE.Vector3().randomDirection().multiplyScalar(8 + Math.random() * 10);
            vel.push(dir);
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                color,
                size: 0.55,
                transparent: true,
                opacity: 1,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.scene.add(pts);
        this.bursts.push({ pts, vel, life: 0.7 });
    }

    update(dt, follow) {
        const t = performance.now() * 0.001;
        const attr = this.spores.geometry.getAttribute('position');
        for (let i = 0; i < this.sporePhase.length; i++) {
            attr.array[i * 3 + 1] += Math.sin(t * 0.6 + this.sporePhase[i]) * 0.015;
        }
        attr.needsUpdate = true;

        if (follow) {
            this.sparkle(follow);
        }
        for (const p of this.trail) {
            if (p.life <= 0) {
                p.mesh.visible = false;
                continue;
            }
            p.life -= dt;
            p.mesh.material.opacity = Math.max(0, p.life * 1.5);
            p.mesh.scale.multiplyScalar(0.96);
        }
        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const b = this.bursts[i];
            b.life -= dt;
            const a = b.pts.geometry.getAttribute('position');
            for (let k = 0; k < b.vel.length; k++) {
                a.array[k * 3] += b.vel[k].x * dt;
                a.array[k * 3 + 1] += b.vel[k].y * dt;
                a.array[k * 3 + 2] += b.vel[k].z * dt;
                b.vel[k].y -= 4 * dt;
            }
            a.needsUpdate = true;
            b.pts.material.opacity = Math.max(0, b.life * 1.4);
            if (b.life <= 0) {
                this.scene.remove(b.pts);
                b.pts.geometry.dispose();
                this.bursts.splice(i, 1);
            }
        }
        for (const ray of this.rays) {
            ray.rotation.y += dt * 0.02;
            ray.material.opacity = 0.035 + Math.sin(t * 0.4 + ray.position.x) * 0.015;
        }
    }
}
