/**
 * Estilhaços de caixa, brilho de cristal e tremer a câmera.
 */

import * as THREE from 'three';
import { pbrMat } from './models.js';

export class Effects {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.shake = 0;
        this._offset = new THREE.Vector3();
        this.geo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
        this.mats = [
            pbrMat(0xd4a04a, { roughness: 0.55 }),
            pbrMat(0x7af0ff, { roughness: 0.25, clearcoat: 0.6 }),
            pbrMat(0xff7a32, { roughness: 0.5 }),
            pbrMat(0xffe07a, { roughness: 0.35, metalness: 0.4 }),
            pbrMat(0xff3d8a, { roughness: 0.4 }),
            pbrMat(0xf4e8d0, { roughness: 0.6 })
        ];
    }

    burst(pos, color, n = 12, speed = 6) {
        for (let i = 0; i < n; i++) this._spawn(pos, color, speed, 0.7);
    }

    dust(pos) {
        for (let i = 0; i < 8; i++) this._spawn(pos, 0xc8b070, 3.2, 0.45);
    }

    explode(pos, color = 0xffc14a) {
        for (let i = 0; i < 16; i++) this._spawn(pos, color, 7, 0.85);
        this.shake = Math.max(this.shake, 0.42);
    }

    hitCam() {
        this.shake = Math.max(this.shake, 0.5);
    }

    clear() {
        for (const p of this.particles) this.scene.remove(p.mesh);
        this.particles.length = 0;
        this.shake = 0;
    }

    _spawn(pos, color, speed, life) {
        const mat = this.mats[Math.floor(Math.random() * this.mats.length)];
        const m = new THREE.Mesh(this.geo, mat);
        m.position.copy(pos);
        m.position.y += 0.35;
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
            p.vy -= 18 * dt;
            p.mesh.position.x += p.vx * dt;
            p.mesh.position.y += p.vy * dt;
            p.mesh.position.z += p.vz * dt;
            p.mesh.rotation.x += dt * 8;
            p.life -= dt;
            p.mesh.scale.setScalar(Math.max(0.05, p.life / p.max));
            if (p.life <= 0) {
                this.scene.remove(p.mesh);
                this.particles.splice(i, 1);
            }
        }
        this.shake = Math.max(0, this.shake - dt * 1.8);
    }

    applyShake() {
        if (this.shake <= 0) {
            this._offset.set(0, 0, 0);
            return this._offset;
        }
        this._offset.set(
            (Math.random() - 0.5) * this.shake,
            (Math.random() - 0.5) * this.shake * 0.6,
            (Math.random() - 0.5) * this.shake
        );
        return this._offset;
    }
}
