/**
 * Efeitos de corrida para F1 Grand Prix em Babylon.js:
 * Fumaça de pneu (bloqueio de roda / derrapagem) e faíscas de assoalho.
 */

export class RaceEffects {
    constructor(BABYLON, scene) {
        this.BABYLON = BABYLON;
        this.scene = scene;

        // Fumaça de pneu
        this.smokeEmitter = BABYLON.MeshBuilder.CreateSphere('smoke_emitter', { diameter: 0.1 }, scene);
        this.smokeEmitter.isVisible = false;

        this.smokePs = new BABYLON.ParticleSystem('tire_smoke', 300, scene);
        this.smokePs.emitter = this.smokeEmitter;
        this.smokePs.minSize = 0.3;
        this.smokePs.maxSize = 1.6;
        this.smokePs.minLifeTime = 0.3;
        this.smokePs.maxLifeTime = 0.8;
        this.smokePs.color1 = new BABYLON.Color4(0.9, 0.9, 0.9, 0.4);
        this.smokePs.color2 = new BABYLON.Color4(0.8, 0.8, 0.8, 0.2);
        this.smokePs.colorDead = new BABYLON.Color4(0.7, 0.7, 0.7, 0.0);
        this.smokePs.emitRate = 0;
        this.smokePs.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        this.smokePs.gravity = new BABYLON.Vector3(0, 0.5, 0);
        this.smokePs.start();

        // Faíscas de assoalho (Titanium skid block sparks)
        this.sparkEmitter = BABYLON.MeshBuilder.CreateSphere('spark_emitter', { diameter: 0.1 }, scene);
        this.sparkEmitter.isVisible = false;

        this.sparkPs = new BABYLON.ParticleSystem('car_sparks', 200, scene);
        this.sparkPs.emitter = this.sparkEmitter;
        this.sparkPs.minSize = 0.06;
        this.sparkPs.maxSize = 0.16;
        this.sparkPs.minLifeTime = 0.1;
        this.sparkPs.maxLifeTime = 0.35;
        this.sparkPs.color1 = new BABYLON.Color4(1.0, 0.9, 0.4, 1.0);
        this.sparkPs.color2 = new BABYLON.Color4(1.0, 0.5, 0.1, 1.0);
        this.sparkPs.colorDead = new BABYLON.Color4(0.5, 0.1, 0, 0.0);
        this.sparkPs.emitRate = 0;
        this.sparkPs.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        this.sparkPs.gravity = new BABYLON.Vector3(0, -9.8, 0);
        this.sparkPs.direction1 = new BABYLON.Vector3(-1.0, 0.5, -4.0);
        this.sparkPs.direction2 = new BABYLON.Vector3(1.0, 1.0, -8.0);
        this.sparkPs.minEmitPower = 4;
        this.sparkPs.maxEmitPower = 10;
        this.sparkPs.start();
    }

    update(carPos, speed, slip, isBottoming) {
        this.smokeEmitter.position.set(carPos.x, carPos.y + 0.1, carPos.z);
        this.smokePs.emitRate = slip > 0.35 && speed > 5 ? 140 : 0;

        this.sparkEmitter.position.set(carPos.x, carPos.y + 0.05, carPos.z - 1.2);
        this.sparkPs.emitRate = isBottoming && speed > 50 ? 220 : 0;
    }
}
