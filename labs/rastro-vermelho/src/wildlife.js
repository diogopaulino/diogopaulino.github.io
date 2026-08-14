/**
 * Vida selvagem: veados que pastam e fogem, águias em círculos altos.
 */

import * as THREE from 'three';
import { buildDeer } from './models.js';
import { heightAt, biomeAt } from './world.js';
import { WATER_Y } from './config.js';
import { hash2, wrapPi } from './utils.js';

export class Wildlife {
    constructor(scene, world, quality) {
        this.scene = scene;
        this.world = world;
        this.group = new THREE.Group();
        scene.add(this.group);
        this.deer = [];
        this.birds = [];
        this.herdAnnounced = false;

        const n = quality.wildlife;
        for (let i = 0; i < n; i++) {
            const mesh = buildDeer();
            const a = hash2(i, 2, 8) * Math.PI * 2;
            const r = 30 + hash2(i, 5, 9) * 90;
            mesh.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
            this.group.add(mesh);
            this.deer.push({
                mesh,
                x: mesh.position.x,
                z: mesh.position.z,
                yaw: a,
                speed: 1.4 + hash2(i, 7, 3) * 1.2,
                phase: hash2(i, 1, 4) * 10,
                flee: 0
            });
        }

        const birdGeo = new THREE.ConeGeometry(0.14, 0.7, 4);
        const birdMat = new THREE.MeshStandardMaterial({
            color: 0x2a2218, roughness: 0.7, flatShading: true
        });
        for (let i = 0; i < quality.birds; i++) {
            const m = new THREE.Mesh(birdGeo, birdMat);
            m.rotation.x = Math.PI;
            const g = new THREE.Group();
            g.add(m);
            this.group.add(g);
            this.birds.push({
                mesh: g,
                radius: 18 + hash2(i, 3, 11) * 28,
                height: 16 + hash2(i, 6, 12) * 14,
                speed: 0.22 + hash2(i, 8, 13) * 0.18,
                offset: hash2(i, 4, 14) * Math.PI * 2
            });
        }
    }

    update(dt, player, time) {
        let nearHerd = false;
        for (const d of this.deer) {
            const dist = Math.hypot(d.x - player.x, d.z - player.z);
            if (dist < 22) nearHerd = true;
            if (dist > 220) {
                const a = Math.atan2(player.x - d.x, player.z - d.z) + Math.PI;
                d.x = player.x + Math.sin(a) * 90;
                d.z = player.z + Math.cos(a) * 90;
            }
            if (dist < 16) d.flee = 2.8;
            d.flee = Math.max(0, d.flee - dt);

            const targetSpeed = d.flee > 0 ? 9.5 : d.speed;
            const turn = d.flee > 0
                ? Math.atan2(d.x - player.x, d.z - player.z)
                : d.yaw + Math.sin(time * 0.3 + d.phase) * 0.4;
            d.yaw = wrapPi(d.yaw + wrapPi(turn - d.yaw) * dt * (d.flee > 0 ? 3.2 : 0.8));
            d.x += Math.sin(d.yaw) * targetSpeed * dt;
            d.z += Math.cos(d.yaw) * targetSpeed * dt;
            let y = heightAt(d.x, d.z);
            if (y < WATER_Y + 0.4) {
                d.yaw += 0.8;
                y = WATER_Y + 0.4;
            }
            d.phase += targetSpeed * dt * 4;
            const gait = Math.sin(d.phase);
            const legs = d.mesh.userData.legs || [];
            if (legs[0]) legs[0].rotation.x = gait * 0.55;
            if (legs[1]) legs[1].rotation.x = -gait * 0.55;
            if (legs[2]) legs[2].rotation.x = -gait * 0.55;
            if (legs[3]) legs[3].rotation.x = gait * 0.55;
            d.mesh.position.set(d.x, y, d.z);
            d.mesh.rotation.y = d.yaw;
        }

        for (const b of this.birds) {
            const t = time * b.speed + b.offset;
            const x = player.x + Math.cos(t) * b.radius;
            const z = player.z + Math.sin(t) * b.radius;
            const y = heightAt(player.x, player.z) + b.height + Math.sin(t * 2) * 1.4;
            b.mesh.position.set(x, y, z);
            b.mesh.rotation.y = -t + Math.PI / 2;
            b.mesh.children[0].rotation.z = Math.sin(time * 8 + b.offset) * 0.35;
        }

        return nearHerd && biomeAt(player.x, player.z) === 'prairie';
    }
}
