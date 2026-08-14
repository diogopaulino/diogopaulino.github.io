/**
 * Vida do santuário: baleia em órbita elíptica, medusas que pulsam e
 * dois cardumes em instancing. Aproximam-se conforme o despertar α.
 *
 *   whaleRadius = lerp(WHALE_R0, WHALE_R1, α)
 *   θ' = 0.07 + α · 0.05
 *   x = cos(θ) · r,  z = sin(θ) · r · 0.72
 *   y = 9 + sin(2θ) · 2.1
 */

import * as THREE from 'three';
import { WHALE_R0, WHALE_R1, lerp } from './config.js';
import { createWhale, createJelly } from './models.js';

export class Life {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;
        this.awaken = 0;
        this.theta = 0.4;
        this.dummy = new THREE.Object3D();
        this._whale();
        this._jellies(quality.jellies);
        this._schools(quality.fish);
        this._plankton(quality.plankton);
    }

    _whale() {
        this.whale = createWhale();
        this.scene.add(this.whale);
        this.whalePos = new THREE.Vector3();
        this.whaleNext = new THREE.Vector3();
    }

    _jellies(n) {
        this.jellies = [];
        for (let i = 0; i < n; i++) {
            const tint = i % 2 === 0 ? 0x88f0ff : 0xe8b8ff;
            const j = createJelly(tint);
            const a = (i / n) * Math.PI * 2;
            j.userData.origin = new THREE.Vector3(
                Math.cos(a) * (10 + (i % 4) * 3.5),
                8 + (i % 5) * 2.2,
                Math.sin(a) * (10 + (i % 3) * 4)
            );
            j.position.copy(j.userData.origin);
            j.scale.setScalar(0.7 + (i % 3) * 0.25);
            this.scene.add(j);
            this.jellies.push(j);
        }
    }

    _schools(count) {
        const geo = new THREE.ConeGeometry(0.12, 0.42, 5);
        geo.rotateZ(-Math.PI / 2);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x8ee7ff,
            emissive: 0x3cb4d4,
            emissiveIntensity: 0.55,
            roughness: 0.35
        });
        this.school = new THREE.InstancedMesh(geo, mat, count);
        this.school.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(this.school);
        this.fishCount = count;
        this.fish = [];
        for (let i = 0; i < count; i++) {
            this.fish.push({
                school: i < count * 0.55 ? 0 : 1,
                offset: Math.random() * Math.PI * 2,
                radius: 1.6 + Math.random() * 2.4,
                height: (Math.random() - 0.5) * 1.6,
                speed: 0.7 + Math.random() * 0.55
            });
        }
        this.schoolA = new THREE.Vector3(9.4, 11.8, 15.6);
        this.schoolB = new THREE.Vector3(-8, 7.5, -6);
    }

    _plankton(count) {
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        this.planktonPhase = new Float32Array(count);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = Math.random() * 42;
            pos[i * 3] = Math.cos(a) * r;
            pos[i * 3 + 1] = 1 + Math.random() * 22;
            pos[i * 3 + 2] = Math.sin(a) * r;
            this.planktonPhase[i] = Math.random() * Math.PI * 2;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.plankton = new THREE.Points(
            geo,
            new THREE.PointsMaterial({
                color: 0xb8fff0,
                size: 0.11,
                transparent: true,
                opacity: 0.75,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            })
        );
        this.scene.add(this.plankton);
        this.planktonHome = pos.slice();
    }

    setAwaken(a) {
        this.awaken = a;
        this.whale.userData.glow.emissiveIntensity = 0.7 + a * 1.1;
        this.school.material.emissiveIntensity = 0.4 + a * 0.7;
    }

    whalePosition() {
        return this.whalePos;
    }

    update(dt, t, playerPos, won) {
        this._updateWhale(dt, t, playerPos, won);
        this._updateJellies(t, playerPos);
        this._updateFish(t, playerPos);
        this._updatePlankton(dt, t, playerPos);
    }

    _updateWhale(dt, t, playerPos, won) {
        this.theta += dt * (0.07 + this.awaken * 0.05);
        const r = won
            ? lerp(lerp(WHALE_R0, WHALE_R1, this.awaken), 7.5, 0.65)
            : lerp(WHALE_R0, WHALE_R1, this.awaken);
        const th = this.theta;
        this.whalePos.set(
            Math.cos(th) * r,
            9.2 + Math.sin(th * 2) * 2.1,
            Math.sin(th) * r * 0.72
        );
        this.whaleNext.set(
            Math.cos(th + 0.08) * r,
            9.2 + Math.sin((th + 0.08) * 2) * 2.1,
            Math.sin(th + 0.08) * r * 0.72
        );
        if (won && playerPos) {
            const orbit = new THREE.Vector3(
                playerPos.x + Math.cos(th) * 7.2,
                playerPos.y + Math.sin(th) * 1.2,
                playerPos.z + Math.sin(th) * 7.2
            );
            this.whalePos.lerp(orbit, 0.35);
            this.whaleNext.copy(playerPos);
        }
        this.whale.position.lerp(this.whalePos, 1 - Math.pow(0.08, dt));
        this.whale.lookAt(this.whaleNext);
        this.whale.rotateY(-Math.PI / 2);
        const flap = Math.sin(t * 1.6) * 0.18;
        this.whale.userData.tail.rotation.y = flap;
        this.whale.userData.pecL.rotation.z = 0.2 + Math.sin(t * 1.1) * 0.12;
        this.whale.userData.pecR.rotation.z = -0.2 - Math.sin(t * 1.1) * 0.12;
    }

    _updateJellies(t, playerPos) {
        for (const j of this.jellies) {
            const ph = j.userData.phase;
            const pulse = 1 + Math.sin(t * (1.1 + this.awaken * 0.4) + ph) * 0.14;
            j.userData.bell.scale.set(pulse, 0.5 + pulse * 0.12, pulse);
            const o = j.userData.origin;
            j.position.x = o.x + Math.sin(t * 0.22 + ph) * 1.6;
            j.position.y = o.y + Math.sin(t * 0.35 + ph) * 1.1;
            j.position.z = o.z + Math.cos(t * 0.2 + ph) * 1.6;
            for (let i = 0; i < j.userData.tentacles.length; i++) {
                const tent = j.userData.tentacles[i];
                tent.rotation.x = 0.15 + Math.sin(t * 1.4 + ph + i) * 0.28;
                tent.rotation.z = Math.cos(t * 1.1 + i) * 0.18;
            }
            if (playerPos && j.position.distanceTo(playerPos) < 3.5) {
                j.userData.bell.material.emissiveIntensity = 1.4;
            } else {
                j.userData.bell.material.emissiveIntensity = 0.7 + this.awaken * 0.5;
            }
        }
    }

    _updateFish(t, playerPos) {
        const dummy = this.dummy;
        this.schoolA.set(
            9.4 + Math.cos(t * 0.13) * 4,
            11.2 + Math.sin(t * 0.21) * 1.6,
            14.2 + Math.sin(t * 0.13) * 4
        );
        this.schoolB.set(
            -8 + Math.sin(t * 0.11) * 5,
            7.2 + Math.cos(t * 0.17) * 1.8,
            -6 + Math.cos(t * 0.11) * 5
        );
        for (let i = 0; i < this.fishCount; i++) {
            const f = this.fish[i];
            const center = f.school === 0 ? this.schoolA : this.schoolB;
            const a = f.offset + t * f.speed * (0.85 + this.awaken * 0.35);
            let x = center.x + Math.cos(a) * f.radius;
            let y = center.y + f.height + Math.sin(a * 2.2) * 0.35;
            let z = center.z + Math.sin(a) * f.radius;
            if (playerPos) {
                const dx = x - playerPos.x;
                const dy = y - playerPos.y;
                const dz = z - playerPos.z;
                const d = Math.hypot(dx, dy, dz) || 1;
                if (d < 4.5) {
                    const k = (4.5 - d) / d * 0.85;
                    x += dx * k;
                    y += dy * k * 0.5;
                    z += dz * k;
                }
            }
            dummy.position.set(x, y, z);
            dummy.lookAt(x - Math.sin(a), y, z + Math.cos(a));
            dummy.updateMatrix();
            this.school.setMatrixAt(i, dummy.matrix);
        }
        this.school.instanceMatrix.needsUpdate = true;
    }

    _updatePlankton(dt, t, playerPos) {
        const pos = this.plankton.geometry.attributes.position;
        const home = this.planktonHome;
        const gather = playerPos ? 1 : 0;
        for (let i = 0; i < pos.count; i++) {
            const ph = this.planktonPhase[i];
            let x = home[i * 3] + Math.sin(t * 0.15 + ph) * 0.8;
            let y = home[i * 3 + 1] + Math.sin(t * 0.22 + ph * 1.3) * 0.6;
            let z = home[i * 3 + 2] + Math.cos(t * 0.14 + ph) * 0.8;
            y += dt * 0.35;
            if (y > 24) {
                y = 1.2;
                home[i * 3 + 1] = 1.2;
            }
            home[i * 3 + 1] = y;
            if (gather && playerPos) {
                const dx = playerPos.x - x;
                const dy = playerPos.y - y;
                const dz = playerPos.z - z;
                const d = Math.hypot(dx, dy, dz);
                if (d < 5 && d > 1.1) {
                    const k = 0.015 * (5 - d);
                    x += dx * k;
                    y += dy * k;
                    z += dz * k;
                }
            }
            pos.setXYZ(i, x, y, z);
        }
        pos.needsUpdate = true;
        this.plankton.material.opacity = 0.55 + this.awaken * 0.35;
    }
}
