/**
 * Faíscas de moeda, poeira do pound e tremer a câmera orbital.
 */

import * as THREE from 'three';
import { pbrMat } from './models.js';

export class Effects {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.particles = [];
        this.shake = 0;
        this.geo = new THREE.OctahedronGeometry(0.12, 1);
        this.mats = [
            pbrMat(0xffe14a, { emissive: 0x442200, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.6 }),
            pbrMat(0xffffff, { roughness: 0.35 }),
            pbrMat(0xff6b4a, { roughness: 0.45 }),
            pbrMat(0x7ec8ff, { roughness: 0.25, clearcoat: 0.5 }),
            pbrMat(0x3ecf4a, { roughness: 0.5 })
        ];
        this._offset = new THREE.Vector3();
    }

    sparkle(pos, n = 10) {
        for (let i = 0; i < n; i++) this._spawn(pos, 5.5, 0.7);
    }

    dust(pos) {
        for (let i = 0; i < 14; i++) this._spawn(pos, 3.4, 0.5);
        this.shake = Math.max(this.shake, 0.28);
    }

    burst(pos, n = 20) {
        for (let i = 0; i < n; i++) this._spawn(pos, 8, 1.1);
        this.shake = Math.max(this.shake, 0.5);
    }

    splash(pos) {
        for (let i = 0; i < 12; i++) this._spawn(pos, 4.2, 0.55);
    }

    _spawn(pos, speed, life) {
        const mat = this.mats[Math.floor(Math.random() * this.mats.length)];
        const m = new THREE.Mesh(this.geo, mat);
        m.position.copy(pos);
        m.position.y += 0.3;
        this.scene.add(m);
        const a = Math.random() * Math.PI * 2;
        const e = Math.random() * speed;
        this.particles.push({
            mesh: m,
            vx: Math.cos(a) * e,
            vy: 2 + Math.random() * speed,
            vz: Math.sin(a) * e,
            life,
            max: life
        });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.vy -= 16 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.mesh.rotation.y += dt * 8;
            p.life -= dt;
            p.mesh.scale.setScalar(Math.max(0.05, p.life / p.max));
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }
        this.shake = Math.max(0, this.shake - dt * 1.7);
    }

    applyShake() {
        if (this.shake <= 0) return;
        this._offset.set(
            (Math.random() - 0.5) * this.shake,
            (Math.random() - 0.5) * this.shake * 0.6,
            (Math.random() - 0.5) * this.shake
        );
        this.camera.position.add(this._offset);
    }
}
