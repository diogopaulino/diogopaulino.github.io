/**
 * Migalhas, explosões tostadas e tremer a câmera — feedback cômico.
 */

import * as THREE from 'three';
import { retroMat } from './models.js';

export class Effects {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.particles = [];
        this.shake = 0;
        this._offset = new THREE.Vector3();
        this.geo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
        this.mats = [
            retroMat(0xe2b15a),
            retroMat(0xb8752c),
            retroMat(0xffe14a),
            retroMat(0xff6b6b),
            retroMat(0xffffff)
        ];
    }

    crumbs(pos, n = 10) {
        for (let i = 0; i < n; i++) this._spawn(pos, 0xe2b15a, 4.5, 0.7);
    }

    dust(pos) {
        for (let i = 0; i < 12; i++) this._spawn(pos, 0xc8b898, 3.2, 0.55);
        this.shake = Math.max(this.shake, 0.22);
    }

    explode(pos, color = 0xffc14a) {
        for (let i = 0; i < 18; i++) this._spawn(pos, color, 7, 0.9);
        this.shake = Math.max(this.shake, 0.45);
    }

    hitCam() {
        this.shake = Math.max(this.shake, 0.55);
    }

    _spawn(pos, color, speed, life) {
        const mat = this.mats[Math.floor(Math.random() * this.mats.length)];
        const m = new THREE.Mesh(this.geo, mat);
        m.position.copy(pos);
        m.position.y += 0.4;
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
            if (p.life <= 0 || p.mesh.position.y < 0) {
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
            (Math.random() - 0.5) * this.shake * 1.4,
            (Math.random() - 0.5) * this.shake * 0.8,
            (Math.random() - 0.5) * this.shake * 1.4
        );
        return this._offset;
    }

    clear() {
        for (const p of this.particles) this.scene.remove(p.mesh);
        this.particles.length = 0;
        this.shake = 0;
    }
}
