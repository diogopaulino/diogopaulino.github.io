/**
 * Efeitos de combate para Honor Front em Babylon.js:
 * Muzzle flash, faíscas de impacto, poeira de projéteis e explosões.
 */

export class CombatEffects {
    constructor(BABYLON, scene) {
        this.BABYLON = BABYLON;
        this.scene = scene;

        // Flash do cano
        this.flashLight = new BABYLON.PointLight('muzzle_light', new BABYLON.Vector3(0, 0, 0), scene);
        this.flashLight.diffuse = new BABYLON.Color3(1.0, 0.8, 0.4);
        this.flashLight.intensity = 0;
        this.flashLight.range = 14;
    }

    muzzleFlash(pos) {
        this.flashLight.position.copyFrom(pos);
        this.flashLight.intensity = 3.5;
        setTimeout(() => {
            this.flashLight.intensity = 0;
        }, 45);
    }

    impactSparks(pos) {
        const BABYLON = this.BABYLON;
        const emitter = BABYLON.MeshBuilder.CreateSphere('spark_emit', { diameter: 0.05 }, this.scene);
        emitter.position.copyFrom(pos);
        emitter.isVisible = false;

        const ps = new BABYLON.ParticleSystem('sparks', 24, this.scene);
        ps.emitter = emitter;
        ps.targetStopDuration = 0.2;
        ps.disposeOnStop = true;

        ps.color1 = new BABYLON.Color4(1.0, 0.85, 0.4, 1.0);
        ps.color2 = new BABYLON.Color4(1.0, 0.4, 0.1, 1.0);
        ps.colorDead = new BABYLON.Color4(0.5, 0.1, 0, 0.0);

        ps.minSize = 0.05;
        ps.maxSize = 0.15;
        ps.minLifeTime = 0.15;
        ps.maxLifeTime = 0.35;
        ps.emitRate = 120;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        ps.gravity = new BABYLON.Vector3(0, -9.8, 0);

        ps.createSphereEmitter(0.2);
        ps.minEmitPower = 3;
        ps.maxEmitPower = 7;

        ps.start();
        setTimeout(() => emitter.dispose(), 400);
    }
}
