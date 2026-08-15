/**
 * Controlador de tempestade: partículas de chuva, vento, trovões e relâmpagos em Babylon.js.
 */

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

        this.emitter = new BABYLON.TransformNode('stormEmitter', scene);

        // Sistema de partículas de chuva
        const count = Math.floor(1200 * (quality?.particles || 1));
        const rainSystem = new BABYLON.ParticleSystem('rain', count, scene);

        // Criar textura de gota procedural em canvas
        const c = document.createElement('canvas');
        c.width = 16;
        c.height = 64;
        const ctx = c.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 0, 64);
        grad.addColorStop(0, 'rgba(200, 225, 255, 0)');
        grad.addColorStop(0.5, 'rgba(200, 225, 255, 0.7)');
        grad.addColorStop(1, 'rgba(240, 250, 255, 0.9)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 64);

        const tex = new BABYLON.DynamicTexture('rainDrop', c, scene, false);
        rainSystem.particleTexture = tex;

        rainSystem.emitter = this.emitter;
        rainSystem.minEmitBox = new BABYLON.Vector3(-25, 18, -25);
        rainSystem.maxEmitBox = new BABYLON.Vector3(25, 22, 25);

        rainSystem.color1 = new BABYLON.Color4(0.8, 0.9, 1.0, 0.6);
        rainSystem.color2 = new BABYLON.Color4(0.7, 0.85, 0.95, 0.4);
        rainSystem.colorDead = new BABYLON.Color4(0.5, 0.7, 0.9, 0.0);

        rainSystem.minSize = 0.15;
        rainSystem.maxSize = 0.35;
        rainSystem.minScaleY = 2.5;
        rainSystem.maxScaleY = 5.0;

        rainSystem.minLifeTime = 0.8;
        rainSystem.maxLifeTime = 1.4;

        rainSystem.emitRate = 0;
        rainSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        rainSystem.gravity = new BABYLON.Vector3(0, -32, 0);
        rainSystem.direction1 = new BABYLON.Vector3(-2, -28, -1);
        rainSystem.direction2 = new BABYLON.Vector3(-4, -34, -2);
        rainSystem.start();

        this.rainSystem = rainSystem;
        this.maxEmitRate = count;

        // Luz de relâmpago
        this.flashLight = new BABYLON.DirectionalLight('lightningFlash', new BABYLON.Vector3(0.2, -1, 0.1), scene);
        this.flashLight.diffuse = new BABYLON.Color3(0.85, 0.92, 1.0);
        this.flashLight.intensity = 0;
    }

    setIntensity(v) {
        this.target = clamp(v, 0, 1);
    }

    follow(pos) {
        if (pos) {
            this.emitter.position.x = pos.x;
            this.emitter.position.y = pos.y;
            this.emitter.position.z = pos.z;
        }
    }

    update(dt, game) {
        this.time += dt;
        this.rainIntensity = damp(this.rainIntensity, this.target, 1.2, dt);
        this.windIntensity = this.rainIntensity;
        this.waveIntensity = this.rainIntensity;
        this.fogDensity = 0.008 + this.rainIntensity * 0.025;
        this.lightLevel = 1 - this.rainIntensity * 0.55;

        this.rainSystem.emitRate = Math.floor(this.maxEmitRate * this.rainIntensity);

        // Vento inclina a chuva
        this.rainSystem.direction1.x = -2 - this.windIntensity * 8;
        this.rainSystem.direction2.x = -4 - this.windIntensity * 12;

        // Relâmpagos aleatórios durante tempestade intensa
        if (this.rainIntensity > 0.45 && Math.random() < dt * 0.25) {
            this.lightning = 0.12 + Math.random() * 0.08;
            this.thunderDelay = 0.3 + Math.random() * 1.2;
        }

        if (this.lightning > 0) {
            this.lightning -= dt;
            this.flashLight.intensity = this.lightning > 0.04 ? 3.5 : 0.6;
        } else {
            this.flashLight.intensity = 0;
        }

        if (this.thunderDelay >= 0) {
            this.thunderDelay -= dt;
            if (this.thunderDelay < 0) {
                game.audio.play('thunder');
                game.cameraRig?.addShake(0.12, 0.4);
            }
        }

        if (this.scene.fogMode !== BABYLON.Scene.FOGMODE_NONE && game.stageId === 'ship') {
            this.scene.fogDensity = this.fogDensity;
        }

        game.ocean?.setStorm(this.waveIntensity);
    }
}
