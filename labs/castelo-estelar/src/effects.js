/**
 * Efeitos mágicos em Babylon.js — fada de faíscas desenhando o arco
 * sobre o castelo e fogos de artifício multicoloridos.
 */

export class Magic {
    constructor(BABYLON, scene, quality) {
        this.BABYLON = BABYLON;
        this.scene = scene;
        this.quality = quality;
        this.fireworks = [];

        // Fada mágica (emissor)
        this.fairy = BABYLON.MeshBuilder.CreateSphere('fairy_emitter', { diameter: 0.6, segments: 12 }, scene);
        const fairyMat = new BABYLON.StandardMaterial('mat_fairy', scene);
        fairyMat.emissiveColor = new BABYLON.Color3(1.0, 0.95, 0.7);
        this.fairy.material = fairyMat;
        this.fairy.isVisible = false;

        // Luz da Fada
        this.fairyLight = new BABYLON.PointLight('fairy_light', new BABYLON.Vector3(0, 0, 0), scene);
        this.fairyLight.diffuse = new BABYLON.Color3(1.0, 0.9, 0.6);
        this.fairyLight.intensity = 0;
        this.fairyLight.range = 16;
        this.fairyLight.parent = this.fairy;

        // Sistema de partículas de rastro da fada
        this.fairyParticles = new BABYLON.ParticleSystem('fairy_sparks', quality.sparks || 900, scene);
        this.fairyParticles.emitter = this.fairy;
        this.fairyParticles.minEmitBox = new BABYLON.Vector3(-0.1, -0.1, -0.1);
        this.fairyParticles.maxEmitBox = new BABYLON.Vector3(0.1, 0.1, 0.1);

        this.fairyParticles.color1 = new BABYLON.Color4(1.0, 0.9, 0.5, 1.0);
        this.fairyParticles.color2 = new BABYLON.Color4(1.0, 0.6, 0.2, 1.0);
        this.fairyParticles.colorDead = new BABYLON.Color4(0.8, 0.3, 0.1, 0.0);

        this.fairyParticles.minSize = 0.2;
        this.fairyParticles.maxSize = 0.6;
        this.fairyParticles.minLifeTime = 0.8;
        this.fairyParticles.maxLifeTime = 1.6;
        this.fairyParticles.emitRate = 350;
        this.fairyParticles.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        this.fairyParticles.gravity = new BABYLON.Vector3(0, -3.5, 0);
        this.fairyParticles.direction1 = new BABYLON.Vector3(-0.8, 0.5, -0.8);
        this.fairyParticles.direction2 = new BABYLON.Vector3(0.8, 1.2, 0.8);
        this.fairyParticles.minEmitPower = 0.5;
        this.fairyParticles.maxEmitPower = 2.0;
        this.fairyParticles.updateSpeed = 0.015;

        this.fairyActive = false;
    }

    startFairy() {
        this.fairyActive = true;
        this.fairy.isVisible = true;
        this.fairyLight.intensity = 1.5;
        this.fairyParticles.start();
    }

    stopFairy() {
        this.fairyActive = false;
        this.fairy.isVisible = false;
        this.fairyLight.intensity = 0;
        this.fairyParticles.stop();
    }

    updateFairy(t) {
        if (!this.fairyActive) return;
        // t vai de 0 a 1 no arco
        const x = -18 + t * 36;
        const y = 8 + Math.sin(t * Math.PI) * 26;
        const z = 4 - Math.sin(t * Math.PI) * 8;
        this.fairy.position.set(x, y, z);
    }

    burst(x, y, z, colorHex = '#ffd700') {
        const BABYLON = this.BABYLON;
        const emitter = BABYLON.MeshBuilder.CreateSphere('fw_emitter', { diameter: 0.1 }, this.scene);
        emitter.position.set(x, y, z);
        emitter.isVisible = false;

        const count = this.quality.burst || 70;
        const ps = new BABYLON.ParticleSystem('fw_burst', count * 2, this.scene);
        ps.emitter = emitter;
        ps.targetStopDuration = 1.2;
        ps.disposeOnStop = true;

        const c = BABYLON.Color3.FromHexString(colorHex);
        ps.color1 = new BABYLON.Color4(c.r, c.g, c.b, 1.0);
        ps.color2 = new BABYLON.Color4(c.r * 0.8, c.g * 0.8, c.b * 0.8, 1.0);
        ps.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);

        ps.minSize = 0.3;
        ps.maxSize = 0.8;
        ps.minLifeTime = 0.6;
        ps.maxLifeTime = 1.4;
        ps.emitRate = count * 4;
        ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        ps.gravity = new BABYLON.Vector3(0, -6, 0);

        ps.createSphereEmitter(0.5);
        ps.minEmitPower = 5;
        ps.maxEmitPower = 12;

        ps.start();

        // Flash de luz momentâneo
        const light = new BABYLON.PointLight('fw_light', new BABYLON.Vector3(x, y, z), this.scene);
        light.diffuse = c;
        light.intensity = 2.5;
        light.range = 50;

        setTimeout(() => {
            light.dispose();
            emitter.dispose();
        }, 1200);
    }

    reset() {
        this.stopFairy();
    }
}
