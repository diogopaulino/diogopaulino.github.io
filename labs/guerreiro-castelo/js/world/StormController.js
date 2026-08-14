/**
 * Tempestade: chuva, vento, ondas, fog, relâmpago (luz real, não flash de tela).
 */

import * as THREE from 'three';
import { clamp, damp } from '../utils/math.js';

export class StormController {
    constructor(scene, quality) {
        this.scene = scene;
        this.rainIntensity = 0;
        this.windIntensity = 0;
        this.waveIntensity = 0;
        this.fogDensity = 0.012;
        this.lightLevel = 1;
        this.lightning = 0;
        this.thunderDelay = -1;
        this.target = 0;
        this.time = 0;

        const count = Math.floor(900 * quality.particles);
        this._rainGeo = new THREE.BufferGeometry();
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 40;
            pos[i * 3 + 1] = Math.random() * 18;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 40;
        }
        this._rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.rain = new THREE.Points(
            this._rainGeo,
            new THREE.PointsMaterial({
                color: 0xa8c4d8,
                size: 0.08,
                transparent: true,
                opacity: 0,
                depthWrite: false
            })
        );
        this.rain.visible = false;
        scene.add(this.rain);

        this.flashLight = new THREE.DirectionalLight(0xc8d8ff, 0);
        this.flashLight.position.set(-4, 18, 6);
        scene.add(this.flashLight);
        this._count = count;
        this.origin = new THREE.Vector3();
    }

    setIntensity(v) {
        this.target = clamp(v, 0, 1);
    }

    follow(origin) {
        this.origin.copy(origin);
        this.rain.position.copy(origin);
    }

    update(dt, game) {
        this.time += dt;
        this.rainIntensity = damp(this.rainIntensity, this.target, 1.2, dt);
        this.windIntensity = this.rainIntensity;
        this.waveIntensity = this.rainIntensity;
        this.fogDensity = 0.008 + this.rainIntensity * 0.028;
        this.lightLevel = 1 - this.rainIntensity * 0.55;

        if (this.rainIntensity > 0.05) {
            this.rain.visible = true;
            this.rain.material.opacity = this.rainIntensity * 0.65;
            const arr = this._rainGeo.attributes.position.array;
            const vy = (18 + this.rainIntensity * 22) * dt;
            const wind = this.windIntensity * 8 * dt;
            for (let i = 0; i < this._count; i++) {
                arr[i * 3] += wind;
                arr[i * 3 + 1] -= vy;
                if (arr[i * 3 + 1] < 0) {
                    arr[i * 3] = (Math.random() - 0.5) * 40;
                    arr[i * 3 + 1] = 16 + Math.random() * 6;
                    arr[i * 3 + 2] = (Math.random() - 0.5) * 40;
                }
            }
            this._rainGeo.attributes.position.needsUpdate = true;
        } else {
            this.rain.visible = false;
        }

        if (this.rainIntensity > 0.45 && Math.random() < dt * 0.22) {
            this.lightning = 0.12 + Math.random() * 0.08;
            this.thunderDelay = 0.4 + Math.random() * 1.4;
        }
        if (this.lightning > 0) {
            this.lightning -= dt;
            this.flashLight.intensity = this.lightning > 0.04 ? 3.2 : 0.4;
        } else {
            this.flashLight.intensity = 0;
        }
        if (this.thunderDelay >= 0) {
            this.thunderDelay -= dt;
            if (this.thunderDelay < 0) game.audio.play('thunder');
        }

        if (game.scene.fog) {
            game.scene.fog.density = this.fogDensity;
        }
        game.ocean?.setStorm(this.waveIntensity);
    }
}
