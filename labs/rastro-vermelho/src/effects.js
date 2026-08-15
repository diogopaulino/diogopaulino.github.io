/**
 * Efeitos de partículas em Babylon.js — poeira do galope no deserto.
 */

export class DustEffects {
    constructor(BABYLON, scene) {
        this.BABYLON = BABYLON;
        this.scene = scene;

        this.emitter = BABYLON.MeshBuilder.CreateSphere('dust_emitter', { diameter: 0.1 }, scene);
        this.emitter.isVisible = false;

        this.ps = new BABYLON.ParticleSystem('horse_dust', 600, scene);
        this.ps.emitter = this.emitter;
        this.ps.minEmitBox = new BABYLON.Vector3(-0.4, 0, -0.4);
        this.ps.maxEmitBox = new BABYLON.Vector3(0.4, 0.1, 0.4);

        this.ps.color1 = new BABYLON.Color4(0.85, 0.65, 0.45, 0.45);
        this.ps.color2 = new BABYLON.Color4(0.75, 0.55, 0.35, 0.35);
        this.ps.colorDead = new BABYLON.Color4(0.7, 0.5, 0.3, 0.0);

        this.ps.minSize = 0.4;
        this.ps.maxSize = 1.4;
        this.ps.minLifeTime = 0.5;
        this.ps.maxLifeTime = 1.2;
        this.ps.emitRate = 120;
        this.ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.ps.gravity = new BABYLON.Vector3(0, 0.4, 0); // poeira sobe levemente
        this.ps.direction1 = new BABYLON.Vector3(-0.5, 0.2, -1.0);
        this.ps.direction2 = new BABYLON.Vector3(0.5, 0.6, -2.0);
        this.ps.minEmitPower = 1.0;
        this.ps.maxEmitPower = 3.0;

        this.ps.start();
    }

    update(horsePos, speed) {
        this.emitter.position.set(horsePos.x, horsePos.y + 0.1, horsePos.z - 0.6);
        this.ps.emitRate = Math.max(0, speed * 8);
    }
}
