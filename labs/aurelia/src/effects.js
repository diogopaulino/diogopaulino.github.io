/**
 * Efeitos de drift e nitro em Babylon.js para Aurelia Festival.
 */

export class DriftEffects {
    constructor(BABYLON, scene) {
        this.BABYLON = BABYLON;
        this.scene = scene;

        // Fumaça de drift
        this.smokeEmitter = BABYLON.MeshBuilder.CreateSphere('drift_emitter', { diameter: 0.1 }, scene);
        this.smokeEmitter.isVisible = false;

        this.smokePs = new BABYLON.ParticleSystem('drift_smoke', 300, scene);
        this.smokePs.emitter = this.smokeEmitter;
        this.smokePs.minSize = 0.4;
        this.smokePs.maxSize = 1.8;
        this.smokePs.minLifeTime = 0.4;
        this.smokePs.maxLifeTime = 1.0;
        this.smokePs.color1 = new BABYLON.Color4(0.95, 0.95, 0.95, 0.5);
        this.smokePs.color2 = new BABYLON.Color4(0.85, 0.85, 0.85, 0.2);
        this.smokePs.colorDead = new BABYLON.Color4(0.7, 0.7, 0.7, 0.0);
        this.smokePs.emitRate = 0;
        this.smokePs.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.smokePs.gravity = new BABYLON.Vector3(0, 0.8, 0);
        this.smokePs.start();

        // Chamas de escape (Backfire)
        this.flameEmitter = BABYLON.MeshBuilder.CreateSphere('flame_emitter', { diameter: 0.1 }, scene);
        this.flameEmitter.isVisible = false;

        this.flamePs = new BABYLON.ParticleSystem('exhaust_flames', 100, scene);
        this.flamePs.emitter = this.flameEmitter;
        this.flamePs.minSize = 0.1;
        this.flamePs.maxSize = 0.35;
        this.flamePs.minLifeTime = 0.08;
        this.flamePs.maxLifeTime = 0.2;
        this.flamePs.color1 = new BABYLON.Color4(0.2, 0.6, 1.0, 1.0); // Nitro azul
        this.flamePs.color2 = new BABYLON.Color4(1.0, 0.4, 0.1, 1.0); // Chama laranja
        this.flamePs.colorDead = new BABYLON.Color4(0.5, 0.1, 0, 0.0);
        this.flamePs.emitRate = 0;
        this.flamePs.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        this.flamePs.start();
    }

    update(carPos, speed, isDrifting, isBoost) {
        this.smokeEmitter.position.set(carPos.x, carPos.y + 0.15, carPos.z - 1.2);
        this.smokePs.emitRate = isDrifting && speed > 8 ? 160 : 0;

        this.flameEmitter.position.set(carPos.x, carPos.y + 0.25, carPos.z - 2.2);
        this.flamePs.emitRate = isBoost ? 120 : 0;
    }
}
