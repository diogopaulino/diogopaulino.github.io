/**
 * Partículas mágicas: vaga-lumes, rastro da Luma, lanternas soltas e
 * fogos de artifício quando o reino acende.
 */

import * as THREE from 'three';
import { createLantern, toon } from './models.js';

export class Effects {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.lanterns = [];
        this.trail = [];
        this.bursts = [];
        this._fireflies(quality.fireflies);
        this._trailPool(quality.trail);
    }

    _fireflies(count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const phase = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 32;
            pos[i * 3] = Math.cos(a) * r;
            pos[i * 3 + 1] = 0.8 + Math.random() * 8;
            pos[i * 3 + 2] = Math.sin(a) * r;
            phase[i] = Math.random() * Math.PI * 2;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.fireflyPhase = phase;
        this.fireflies = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                color: 0xffe9a0,
                size: 0.18,
                transparent: true,
                opacity: 0.9,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.scene.add(this.fireflies);
    }

    _trailPool(count) {
        const mat = toon(0xfff4c0, { emissive: 0xffe08a, em: 0.8, transparent: true, opacity: 0.7 });
        const geo = new THREE.SphereGeometry(0.08, 8, 6);
        for (let i = 0; i < count; i++) {
            const m = new THREE.Mesh(geo, mat.clone());
            m.visible = false;
            m.castShadow = false;
            this.scene.add(m);
            this.trail.push({ mesh: m, life: 0 });
        }
        this.trailIndex = 0;
    }

    sparkle(position) {
        const p = this.trail[this.trailIndex % this.trail.length];
        this.trailIndex++;
        p.mesh.position.copy(position);
        p.mesh.position.x += (Math.random() - 0.5) * 0.3;
        p.mesh.position.y += (Math.random() - 0.5) * 0.3;
        p.mesh.visible = true;
        p.mesh.material.opacity = 0.85;
        p.mesh.scale.setScalar(0.7 + Math.random() * 0.6);
        p.life = 0.7;
    }

    releaseLantern(origin, color) {
        const lantern = createLantern(color, { light: this.lanterns.length < 6 });
        lantern.position.copy(origin);
        lantern.userData.vx = (Math.random() - 0.5) * 0.6;
        lantern.userData.vz = (Math.random() - 0.5) * 0.6;
        lantern.userData.vy = 1.4 + Math.random() * 0.6;
        lantern.userData.spin = (Math.random() - 0.5) * 0.6;
        this.scene.add(lantern);
        this.lanterns.push(lantern);
        if (this.lanterns.length > 48) {
            const old = this.lanterns.shift();
            this.scene.remove(old);
        }
        return lantern;
    }

    fireworks(origin) {
        const colors = [0xff6fae, 0xffe066, 0x5b7cfa, 0x3ecfc0, 0xff9f43];
        for (let k = 0; k < 5; k++) {
            const geo = new THREE.BufferGeometry();
            const n = 40;
            const pos = new Float32Array(n * 3);
            const vel = [];
            for (let i = 0; i < n; i++) {
                pos[i * 3] = origin.x;
                pos[i * 3 + 1] = origin.y + k * 0.2;
                pos[i * 3 + 2] = origin.z;
                const dir = new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 5);
                vel.push(dir);
            }
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            const pts = new THREE.Points(
                geo,
                new THREE.PointsMaterial({
                    color: colors[k % colors.length],
                    size: 0.28,
                    transparent: true,
                    opacity: 1,
                    depthWrite: false,
                    blending: THREE.AdditiveBlending
                })
            );
            this.scene.add(pts);
            this.bursts.push({ pts, vel, life: 1.8 });
        }
    }

    collectBurst(origin) {
        const geo = new THREE.BufferGeometry();
        const n = 24;
        const pos = new Float32Array(n * 3);
        const vel = [];
        for (let i = 0; i < n; i++) {
            pos[i * 3] = origin.x;
            pos[i * 3 + 1] = origin.y;
            pos[i * 3 + 2] = origin.z;
            vel.push(new THREE.Vector3().randomDirection().multiplyScalar(2.5));
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        const pts = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                color: 0xffe08a,
                size: 0.22,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            })
        );
        this.scene.add(pts);
        this.bursts.push({ pts, vel, life: 0.7 });
    }

    update(dt, lumaPos) {
        const pos = this.fireflies.geometry.attributes.position;
        for (let i = 0; i < this.fireflyPhase.length; i++) {
            const ph = this.fireflyPhase[i];
            pos.array[i * 3] += Math.sin(ph + performance.now() * 0.001) * 0.01;
            pos.array[i * 3 + 1] += Math.cos(ph * 1.3 + performance.now() * 0.0012) * 0.008;
        }
        pos.needsUpdate = true;
        this.fireflies.material.opacity = 0.45 + Math.sin(performance.now() * 0.004) * 0.25;

        if (lumaPos && Math.random() < 0.55) this.sparkle(lumaPos);

        for (const p of this.trail) {
            if (!p.mesh.visible) continue;
            p.life -= dt;
            p.mesh.material.opacity = Math.max(0, p.life);
            p.mesh.position.y += dt * 0.4;
            if (p.life <= 0) p.mesh.visible = false;
        }

        for (let i = this.lanterns.length - 1; i >= 0; i--) {
            const l = this.lanterns[i];
            l.position.x += l.userData.vx * dt;
            l.position.z += l.userData.vz * dt;
            l.position.y += l.userData.vy * dt;
            l.rotation.y += l.userData.spin * dt;
            l.userData.vy += dt * 0.12;
            if (l.position.y > 42) {
                this.scene.remove(l);
                this.lanterns.splice(i, 1);
            }
        }

        for (let i = this.bursts.length - 1; i >= 0; i--) {
            const b = this.bursts[i];
            b.life -= dt;
            const arr = b.pts.geometry.attributes.position.array;
            for (let k = 0; k < b.vel.length; k++) {
                arr[k * 3] += b.vel[k].x * dt;
                arr[k * 3 + 1] += b.vel[k].y * dt;
                arr[k * 3 + 2] += b.vel[k].z * dt;
                b.vel[k].y -= 3.2 * dt;
            }
            b.pts.geometry.attributes.position.needsUpdate = true;
            b.pts.material.opacity = Math.max(0, b.life);
            if (b.life <= 0) {
                this.scene.remove(b.pts);
                this.bursts.splice(i, 1);
            }
        }
    }
}
