/**
 * Poeira dos cascos e spray quando o cavalo cruza o rio.
 */

import * as THREE from 'three';
import { WATER_Y } from './config.js';
import { puffTexture } from './textures.js';

export class Dust {
    constructor(scene, quality) {
        const n = quality.id === 'low' ? 80 : quality.id === 'high' ? 220 : 140;
        this.count = n;
        const geo = new THREE.BufferGeometry();
        const pos = new Float32Array(n * 3);
        const vel = new Float32Array(n * 3);
        const life = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            pos[i * 3 + 1] = -20;
            life[i] = 0;
        }
        geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.pos = pos;
        this.vel = vel;
        this.life = life;
        this.cursor = 0;

        const mat = new THREE.PointsMaterial({
            color: 0xc4a070,
            map: puffTexture(),
            size: 0.42,
            transparent: true,
            opacity: 0.4,
            depthWrite: false,
            sizeAttenuation: true
        });
        this.points = new THREE.Points(geo, mat);
        this.points.frustumCulled = false;
        scene.add(this.points);
        this.geo = geo;
    }

    burst(x, y, z, speed, inWater) {
        const n = inWater ? 6 : speed > 14 ? 4 : 2;
        for (let k = 0; k < n; k++) {
            const i = this.cursor % this.count;
            this.cursor++;
            this.pos[i * 3] = x + (Math.random() - 0.5) * 0.6;
            this.pos[i * 3 + 1] = y + 0.15;
            this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
            this.vel[i * 3] = (Math.random() - 0.5) * 1.4;
            this.vel[i * 3 + 1] = 1.2 + Math.random() * 2.2;
            this.vel[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
            this.life[i] = inWater ? 0.55 : 0.7 + Math.random() * 0.4;
        }
        this.points.material.color.set(inWater ? 0xb8d0d0 : 0xc4a070);
    }

    update(dt) {
        const pos = this.pos;
        const vel = this.vel;
        const life = this.life;
        for (let i = 0; i < this.count; i++) {
            if (life[i] <= 0) continue;
            life[i] -= dt;
            pos[i * 3] += vel[i * 3] * dt;
            pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
            pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
            vel[i * 3 + 1] -= 6 * dt;
            if (pos[i * 3 + 1] < WATER_Y - 2) life[i] = 0;
            if (life[i] <= 0) pos[i * 3 + 1] = -40;
        }
        this.geo.attributes.position.needsUpdate = true;
    }
}
