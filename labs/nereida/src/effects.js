/**
 * Bolhas, rastro da arraia e explosões de lúmen ao coletar.
 */

import * as THREE from 'three';

export class Effects {
    constructor(scene, quality) {
        this.scene = scene;
        this.bubbles = this._bubbles(quality.bubbles);
        this.trail = [];
        this.bursts = [];
        this._trailPool(28);
        this._burstPool(12);
        this.time = 0;
    }

    _bubbles(count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        const phase = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 80;
            pos[i * 3 + 1] = Math.random() * 40;
            pos[i * 3 + 2] = Math.random() * 520;
            phase[i] = Math.random() * Math.PI * 2;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.bubblePhase = phase;
        const pts = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                color: 0xc8fff8,
                size: 0.16,
                transparent: true,
                opacity: 0.45,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.scene.add(pts);
        return pts;
    }

    _trailPool(n) {
        const geo = new THREE.SphereGeometry(0.12, 8, 6);
        const mat = new THREE.MeshBasicMaterial({
            color: 0x5ef0d8,
            transparent: true,
            opacity: 0.7,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(geo, mat.clone());
            m.visible = false;
            this.scene.add(m);
            this.trail.push({ mesh: m, life: 0 });
        }
        this.trailIndex = 0;
    }

    _burstPool(n) {
        const geo = new THREE.SphereGeometry(0.4, 10, 8);
        const mat = new THREE.MeshBasicMaterial({
            color: 0xf4d9a6,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        for (let i = 0; i < n; i++) {
            const m = new THREE.Mesh(geo, mat.clone());
            m.visible = false;
            this.scene.add(m);
            this.bursts.push({ mesh: m, life: 0 });
        }
        this.burstIndex = 0;
    }

    spark(pos, color = 0x5ef0d8) {
        const p = this.trail[this.trailIndex % this.trail.length];
        this.trailIndex++;
        p.mesh.position.copy(pos);
        p.mesh.position.x += (Math.random() - 0.5) * 0.4;
        p.mesh.position.y += (Math.random() - 0.5) * 0.3;
        p.mesh.visible = true;
        p.mesh.material.color.setHex(color);
        p.mesh.material.opacity = 0.8;
        p.mesh.scale.setScalar(0.7 + Math.random() * 0.8);
        p.life = 0.55;
    }

    burst(pos, color = 0xf4d9a6) {
        const p = this.bursts[this.burstIndex % this.bursts.length];
        this.burstIndex++;
        p.mesh.position.copy(pos);
        p.mesh.visible = true;
        p.mesh.material.color.setHex(color);
        p.mesh.material.opacity = 0.9;
        p.mesh.scale.setScalar(0.4);
        p.life = 0.45;
    }

    update(dt, playerPos, boosting) {
        this.time += dt;
        const pos = this.bubbles.geometry.attributes.position;
        for (let i = 0; i < this.bubblePhase.length; i++) {
            let y = pos.getY(i) + dt * (0.4 + (i % 5) * 0.08);
            if (y > 42) y = -4;
            pos.setY(i, y);
            pos.setX(i, pos.getX(i) + Math.sin(this.time + this.bubblePhase[i]) * 0.01);
        }
        pos.needsUpdate = true;

        if (playerPos) {
            this.spark(playerPos, boosting ? 0xf4d9a6 : 0x5ef0d8);
        }

        for (const p of this.trail) {
            if (p.life <= 0) {
                p.mesh.visible = false;
                continue;
            }
            p.life -= dt;
            p.mesh.material.opacity = p.life * 1.4;
            p.mesh.scale.multiplyScalar(0.96);
        }
        for (const p of this.bursts) {
            if (p.life <= 0) {
                p.mesh.visible = false;
                continue;
            }
            p.life -= dt;
            p.mesh.scale.setScalar(0.4 + (0.45 - p.life) * 8);
            p.mesh.material.opacity = p.life * 2;
        }
    }
}
