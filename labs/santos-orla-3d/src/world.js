/**
 * Montagem do digital twin: céu, mar, orla, cidade, canais, landmarks, vida.
 */

import * as THREE from 'three';
import { QUALITY, DAY_STOPS } from './config.js';
import { createSky, createSkyUniforms, applyDayStop, pickStop } from './sky.js';
import { createWater } from './water.js';
import { createOrla } from './orla.js';
import { createCity } from './city.js';
import { createCanals } from './canals.js';
import { createLandmarks } from './landmarks.js';
import { createLife } from './life.js';

export class World {
    constructor(scene, renderer, quality) {
        this.scene = scene;
        this.renderer = renderer;
        this.quality = quality;
        this.skyUniforms = createSkyUniforms();
        this.parts = {};
        this.dayIndex = 1;
        this.lights = {};
    }

    build(onProgress) {
        onProgress?.(0.15, 'Abrindo o céu de Santos…');
        this.parts.sky = createSky(this.skyUniforms);
        this.scene.add(this.parts.sky.mesh);

        this.lights.hemi = new THREE.HemisphereLight(0x9ec8ff, 0x6a5a40, 0.62);
        this.lights.sun = new THREE.DirectionalLight(0xfff2d6, 2.15);
        this.lights.sun.position.set(40, 80, 30);
        if (this.quality.shadows) {
            const mapSize = this.quality.id === 'high' ? 2048 : 1024;
            this.lights.sun.castShadow = true;
            this.lights.sun.shadow.mapSize.set(mapSize, mapSize);
            this.lights.sun.shadow.camera.left = -90;
            this.lights.sun.shadow.camera.right = 90;
            this.lights.sun.shadow.camera.top = 90;
            this.lights.sun.shadow.camera.bottom = -90;
            this.lights.sun.shadow.camera.near = 8;
            this.lights.sun.shadow.camera.far = 280;
            this.lights.sun.shadow.bias = -0.00015;
            this.lights.sun.shadow.normalBias = 0.035;
            this.lights.sun.shadow.radius = this.quality.id === 'high' ? 2.5 : 1.5;
        }
        this.lights.amb = new THREE.AmbientLight(0xffffff, 0.2);
        this.lights.fill = new THREE.DirectionalLight(0xa8c8e8, 0.35);
        this.lights.fill.position.set(-30, 25, -40);
        this.scene.add(this.lights.hemi, this.lights.sun, this.lights.amb, this.lights.fill);

        this.scene.fog = new THREE.Fog(0xaec8e0, 40, this.quality.fogFar);

        onProgress?.(0.35, 'Ondas na enseada…');
        this.parts.water = createWater(this.skyUniforms, this.quality);
        this.scene.add(this.parts.water.mesh);

        onProgress?.(0.5, 'Jardins e ciclovia…');
        this.parts.orla = createOrla(this.quality);
        this.scene.add(this.parts.orla.root);

        onProgress?.(0.65, 'Canais 1 ao 7…');
        this.parts.canals = createCanals();
        this.scene.add(this.parts.canals.root);

        onProgress?.(0.78, 'Skyline da orla…');
        this.parts.city = createCity(this.quality);
        this.scene.add(this.parts.city.root);

        onProgress?.(0.88, 'Pontos da cidade…');
        this.parts.landmarks = createLandmarks();
        this.scene.add(this.parts.landmarks.root);

        onProgress?.(0.94, 'Gente na orla…');
        this.parts.life = createLife(this.quality);
        this.scene.add(this.parts.life.root);

        this.setDay(this.dayIndex);
        onProgress?.(1, 'Pronto.');
    }

    setDay(index) {
        this.dayIndex = index;
        const stop = pickStop(index);
        applyDayStop(this.skyUniforms, this.lights, this.scene.fog, stop, this.renderer);
        const night = stop.id === 'night';
        this.parts.orla?.setNight(night);
        this.parts.city?.setNight(night);
        return stop;
    }

    cycleDay() {
        return this.setDay((this.dayIndex + 1) % DAY_STOPS.length);
    }

    update(t, dt) {
        this.parts.sky?.update(t);
        this.parts.water?.update(t);
        this.parts.canals?.update?.(t);
        this.parts.life?.update(t, dt);
    }

    followShadow(x) {
        if (!this.lights.sun || !this.quality.shadows) return;
        this.lights.sun.target.position.set(x, 0, 10);
        this.lights.sun.target.updateMatrixWorld();
        this.lights.sun.position.x = x + this.skyUniforms.uSunDir.value.x * 80;
        this.lights.sun.position.z = 10 + this.skyUniforms.uSunDir.value.z * 80;
    }
}

export function resolveQuality(choice) {
    if (choice && choice !== 'auto' && QUALITY[choice]) return QUALITY[choice];
    return null;
}
