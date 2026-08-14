/**
 * Céu (Sky addon), sol/lua, fog e PMREM para PBR.
 */

import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

export class WeatherSystem {
    constructor(scene, renderer) {
        this.scene = scene;
        this.sky = new Sky();
        this.sky.scale.setScalar(4500);
        scene.add(this.sky);
        this.sun = new THREE.Vector3();
        this.hemi = new THREE.HemisphereLight(0xb8d0e8, 0x3a2a18, 0.55);
        scene.add(this.hemi);
        this.dir = new THREE.DirectionalLight(0xfff2d0, 1.6);
        this.dir.castShadow = true;
        this.dir.shadow.mapSize.set(2048, 2048);
        this.dir.shadow.camera.near = 1;
        this.dir.shadow.camera.far = 180;
        this.dir.shadow.camera.left = -40;
        this.dir.shadow.camera.right = 40;
        this.dir.shadow.camera.top = 40;
        this.dir.shadow.camera.bottom = -40;
        this.dir.shadow.bias = -0.0003;
        scene.add(this.dir);
        this.pmrem = new THREE.PMREMGenerator(renderer);
        this.preset = 'day';
        this.apply('day');
    }

    apply(preset) {
        this.preset = preset;
        const u = this.sky.material.uniforms;
        let elevation = 18;
        let azimuth = 160;
        let turbidity = 4;
        let rayleigh = 1.2;
        let exposure = 1;
        let hemi = 0.55;
        let dirI = 1.6;
        let fogCol = 0x9ec4d4;
        let fogDen = 0.006;

        if (preset === 'night') {
            elevation = -4;
            azimuth = 200;
            turbidity = 2;
            rayleigh = 0.4;
            exposure = 0.45;
            hemi = 0.18;
            dirI = 0.15;
            fogCol = 0x0a1020;
            fogDen = 0.02;
            this.dir.color.set(0x8899cc);
            this.hemi.color.set(0x334466);
            this.hemi.groundColor.set(0x1a1210);
        } else if (preset === 'storm') {
            elevation = 8;
            azimuth = 140;
            turbidity = 12;
            rayleigh = 0.6;
            exposure = 0.55;
            hemi = 0.22;
            dirI = 0.35;
            fogCol = 0x4a5560;
            fogDen = 0.018;
            this.dir.color.set(0xc0c8d0);
            this.hemi.color.set(0x6a7380);
            this.hemi.groundColor.set(0x2a2420);
        } else if (preset === 'dawn') {
            elevation = 6;
            azimuth = 110;
            turbidity = 6;
            rayleigh = 2.2;
            exposure = 0.9;
            hemi = 0.5;
            dirI = 1.3;
            fogCol = 0xf0c8a0;
            fogDen = 0.008;
            this.dir.color.set(0xffd0a0);
            this.hemi.color.set(0xffe0c0);
            this.hemi.groundColor.set(0x4a3020);
        } else if (preset === 'interior') {
            elevation = 12;
            turbidity = 8;
            rayleigh = 0.3;
            exposure = 0.35;
            hemi = 0.08;
            dirI = 0.05;
            fogCol = 0x0c0a08;
            fogDen = 0.045;
            this.dir.color.set(0xffcc88);
        } else {
            this.dir.color.set(0xfff2d0);
            this.hemi.color.set(0xb8d0e8);
            this.hemi.groundColor.set(0x3a2a18);
        }

        u.turbidity.value = turbidity;
        u.rayleigh.value = rayleigh;
        u.mieCoefficient.value = 0.005;
        u.mieDirectionalG.value = 0.8;
        const phi = THREE.MathUtils.degToRad(90 - elevation);
        const theta = THREE.MathUtils.degToRad(azimuth);
        this.sun.setFromSphericalCoords(1, phi, theta);
        u.sunPosition.value.copy(this.sun);
        this.dir.position.copy(this.sun).multiplyScalar(40);
        this.dir.intensity = dirI;
        this.hemi.intensity = hemi;
        this.scene.fog = new THREE.FogExp2(fogCol, fogDen);
        this.scene.background = new THREE.Color(fogCol);
        this.exposure = exposure;
        try {
            const env = this.pmrem.fromScene(this.sky);
            this.scene.environment = env.texture;
        } catch {
            /* Sky PMREM pode falhar em software GL */
        }
        return exposure;
    }

    setShadowSize(size) {
        this.dir.shadow.mapSize.set(size, size);
        this.dir.shadow.map?.dispose();
        this.dir.shadow.map = null;
    }
}
