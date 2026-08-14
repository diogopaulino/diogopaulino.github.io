/**
 * Pool de flechas: trajetória, gravidade, colisão, impacto, reciclagem.
 */

import * as THREE from 'three';
import { Pool } from '../utils/pool.js';

export class ArrowSystem {
    constructor(scene) {
        this.scene = scene;
        this.pool = new Pool(() => this._make(), 16);
        this.active = [];
        this.gravity = 18;
        this.colliders = [];
        this.onHitPlayer = null;
        this.geo = new THREE.CylinderGeometry(0.015, 0.015, 0.55, 5);
        this.mat = new THREE.MeshStandardMaterial({ color: 0x5a3a18, roughness: 0.6 });
        this.tipMat = new THREE.MeshStandardMaterial({ color: 0xb0b8c0, metalness: 0.8, roughness: 0.3 });
        this._n = new THREE.Vector3();
    }

    _make() {
        const g = new THREE.Group();
        const shaft = new THREE.Mesh(this.geo, this.mat);
        shaft.rotation.x = Math.PI / 2;
        g.add(shaft);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), this.tipMat);
        tip.rotation.x = Math.PI / 2;
        tip.position.z = 0.3;
        g.add(tip);
        g.visible = false;
        this.scene.add(g);
        return {
            mesh: g,
            vel: new THREE.Vector3(),
            alive: false,
            stuck: 0,
            from: 'world'
        };
    }

    setColliders(meshes) {
        this.colliders = meshes;
    }

    fire(origin, direction, speed = 28) {
        const a = this.pool.obtain();
        a.mesh.position.copy(origin);
        a.mesh.visible = true;
        a.vel.copy(direction).normalize().multiplyScalar(speed);
        a.alive = true;
        a.stuck = 0;
        a.mesh.lookAt(origin.clone().add(a.vel));
        this.active.push(a);
        return a;
    }

    update(dt, game) {
        const ray = game._arrowRay || (game._arrowRay = new THREE.Raycaster());
        for (let i = this.active.length - 1; i >= 0; i--) {
            const a = this.active[i];
            if (a.stuck > 0) {
                a.stuck -= dt;
                if (a.stuck <= 0) {
                    a.mesh.visible = false;
                    this.active.splice(i, 1);
                    this.pool.release(a);
                }
                continue;
            }
            a.vel.y -= this.gravity * dt;
            const next = a.mesh.position.clone().addScaledVector(a.vel, dt);
            const dist = a.mesh.position.distanceTo(next);
            ray.set(a.mesh.position, this._n.copy(a.vel).normalize());
            ray.far = dist + 0.1;
            let hit = null;
            if (this.colliders.length) {
                const hits = ray.intersectObjects(this.colliders, true);
                if (hits.length) hit = hits[0];
            }
            const p = game.player.position;
            const toP = Math.hypot(next.x - p.x, next.y - (p.y + 1), next.z - p.z);
            if (toP < 0.45) {
                this.onHitPlayer?.(1);
                a.stuck = 0.01;
                a.mesh.visible = false;
                continue;
            }
            if (hit || next.y < 0.02) {
                a.mesh.position.copy(hit ? hit.point : next);
                a.stuck = 2.4;
                game.audio.play('impact');
                continue;
            }
            a.mesh.position.copy(next);
            a.mesh.lookAt(next.clone().add(a.vel));
            if (a.mesh.position.length() > 400) {
                a.mesh.visible = false;
                this.active.splice(i, 1);
                this.pool.release(a);
            }
        }
    }

    clear() {
        for (const a of this.active) {
            a.mesh.visible = false;
            this.pool.release(a);
        }
        this.active.length = 0;
    }
}
