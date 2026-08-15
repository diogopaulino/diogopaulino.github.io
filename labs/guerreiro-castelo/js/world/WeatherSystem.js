/**
 * Sistema de iluminação, sol, sombras, clima e nevoeiro em Babylon.js.
 */

export class WeatherSystem {
    constructor(scene, engine) {
        this.scene = scene;
        this.engine = engine;

        // Luz hemisférica (ambiente)
        this.hemi = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), scene);
        this.hemi.intensity = 0.6;
        this.hemi.groundColor = new BABYLON.Color3(0.2, 0.16, 0.12);

        // Luz direcional (sol/lua)
        this.dir = new BABYLON.DirectionalLight('sunLight', new BABYLON.Vector3(-0.4, -0.8, -0.4), scene);
        this.dir.position = new BABYLON.Vector3(40, 80, 40);
        this.dir.intensity = 1.6;

        // Gerador de sombras
        this.shadowGenerator = new BABYLON.ShadowGenerator(1024, this.dir);
        this.shadowGenerator.usePoissonSampling = true;
        this.shadowGenerator.bias = 0.002;
        this.shadowGenerator.darkness = 0.45;

        this.preset = 'day';
        this.exposure = 1.0;
        this.apply('day');
    }

    apply(preset) {
        this.preset = preset;
        const scene = this.scene;
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;

        if (preset === 'night') {
            this.hemi.diffuse = new BABYLON.Color3(0.15, 0.2, 0.35);
            this.hemi.groundColor = new BABYLON.Color3(0.08, 0.08, 0.12);
            this.hemi.intensity = 0.35;

            this.dir.direction = new BABYLON.Vector3(-0.3, -0.6, 0.5).normalize();
            this.dir.diffuse = new BABYLON.Color3(0.35, 0.45, 0.7);
            this.dir.intensity = 0.4;

            scene.clearColor = new BABYLON.Color4(0.04, 0.06, 0.12, 1);
            scene.fogColor = new BABYLON.Color3(0.04, 0.06, 0.12);
            scene.fogDensity = 0.015;
            this.exposure = 0.6;
        } else if (preset === 'storm') {
            this.hemi.diffuse = new BABYLON.Color3(0.3, 0.35, 0.4);
            this.hemi.groundColor = new BABYLON.Color3(0.15, 0.16, 0.18);
            this.hemi.intensity = 0.4;

            this.dir.direction = new BABYLON.Vector3(0.2, -0.8, -0.3).normalize();
            this.dir.diffuse = new BABYLON.Color3(0.5, 0.55, 0.6);
            this.dir.intensity = 0.6;

            scene.clearColor = new BABYLON.Color4(0.18, 0.22, 0.26, 1);
            scene.fogColor = new BABYLON.Color3(0.18, 0.22, 0.26);
            scene.fogDensity = 0.022;
            this.exposure = 0.7;
        } else if (preset === 'dawn') {
            this.hemi.diffuse = new BABYLON.Color3(0.9, 0.65, 0.5);
            this.hemi.groundColor = new BABYLON.Color3(0.3, 0.2, 0.15);
            this.hemi.intensity = 0.65;

            this.dir.direction = new BABYLON.Vector3(-0.8, -0.3, -0.2).normalize();
            this.dir.diffuse = new BABYLON.Color3(1.0, 0.75, 0.5);
            this.dir.intensity = 1.8;

            scene.clearColor = new BABYLON.Color4(0.7, 0.5, 0.4, 1);
            scene.fogColor = new BABYLON.Color3(0.7, 0.5, 0.4);
            scene.fogDensity = 0.008;
            this.exposure = 1.0;
        } else if (preset === 'interior') {
            this.hemi.diffuse = new BABYLON.Color3(0.25, 0.22, 0.2);
            this.hemi.groundColor = new BABYLON.Color3(0.1, 0.08, 0.06);
            this.hemi.intensity = 0.25;

            this.dir.direction = new BABYLON.Vector3(0, -1, 0);
            this.dir.diffuse = new BABYLON.Color3(0.8, 0.6, 0.4);
            this.dir.intensity = 0.2;

            scene.clearColor = new BABYLON.Color4(0.04, 0.03, 0.03, 1);
            scene.fogColor = new BABYLON.Color3(0.04, 0.03, 0.03);
            scene.fogDensity = 0.035;
            this.exposure = 0.5;
        } else {
            // Day default
            this.hemi.diffuse = new BABYLON.Color3(0.75, 0.85, 0.95);
            this.hemi.groundColor = new BABYLON.Color3(0.35, 0.28, 0.2);
            this.hemi.intensity = 0.75;

            this.dir.direction = new BABYLON.Vector3(-0.4, -0.85, -0.35).normalize();
            this.dir.diffuse = new BABYLON.Color3(1.0, 0.96, 0.88);
            this.dir.intensity = 1.7;

            scene.clearColor = new BABYLON.Color4(0.55, 0.72, 0.85, 1);
            scene.fogColor = new BABYLON.Color3(0.55, 0.72, 0.85);
            scene.fogDensity = 0.005;
            this.exposure = 1.0;
        }

        return this.exposure;
    }

    setShadowQuality(quality) {
        let size = 1024;
        if (quality === 'low') {
            this.shadowGenerator.getShadowMap().renderList = [];
            return;
        } else if (quality === 'medium') {
            size = 1024;
            this.shadowGenerator.usePoissonSampling = true;
        } else if (quality === 'high' || quality === 'ultra') {
            size = 2048;
            this.shadowGenerator.useContactHardeningShadow = true;
            this.shadowGenerator.contactHardeningLightSizeUVRatio = 0.05;
        }
        this.shadowGenerator.mapSize = size;
    }

    addShadowCaster(mesh, includeChildren = true) {
        if (!this.shadowGenerator) return;
        this.shadowGenerator.addShadowCaster(mesh, includeChildren);
    }
}
