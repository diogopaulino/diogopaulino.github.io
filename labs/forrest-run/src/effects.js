/**
 * Efeitos de partículas e atmosfera em Babylon.js:
 * - Poeira de passos na terra/asfalto
 * - Faíscas brilhantes ao coletar penas
 * - Impacto e poeira ao tropeçar
 * - Chuva torrencial volumétrica no bioma de tempestade
 */

import { createParticleTexture } from './textures.js';
import { hexToColor4 } from './utils.js';

export class Effects {
    constructor(scene, quality) {
        this.scene = scene;
        this.quality = quality;

        const particleTex = createParticleTexture(scene);

        // 1. Sistema de Partículas para Faíscas e Poeira
        const sparkSys = new BABYLON.ParticleSystem('sparkSys', quality.particles * 2, scene);
        sparkSys.particleTexture = particleTex;
        sparkSys.emitter = new BABYLON.Vector3(0, 0, 0);
        sparkSys.minSize = 0.15;
        sparkSys.maxSize = 0.45;
        sparkSys.minLifeTime = 0.3;
        sparkSys.maxLifeTime = 0.65;
        sparkSys.manualEmitCount = 0;
        sparkSys.disposeOnStop = false;
        sparkSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
        sparkSys.gravity = new BABYLON.Vector3(0, -9.8, 0);
        sparkSys.start();
        this.sparkSys = sparkSys;

        // 2. Sistema de Chuva
        const rainSys = new BABYLON.ParticleSystem('rainSys', quality.rain, scene);
        rainSys.particleTexture = particleTex;
        rainSys.emitter = new BABYLON.Vector3(0, 16, 0);
        rainSys.minEmitBox = new BABYLON.Vector3(-24, 0, -45);
        rainSys.maxEmitBox = new BABYLON.Vector3(24, 0, 15);
        rainSys.color1 = new BABYLON.Color4(0.7, 0.8, 0.9, 0.45);
        rainSys.color2 = new BABYLON.Color4(0.8, 0.9, 1.0, 0.6);
        rainSys.colorDead = new BABYLON.Color4(0.5, 0.6, 0.7, 0.0);
        rainSys.minSize = 0.08;
        rainSys.maxSize = 0.14;
        rainSys.minLifeTime = 0.6;
        rainSys.maxLifeTime = 1.0;
        rainSys.emitRate = quality.rain * 1.5;
        rainSys.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
        rainSys.direction1 = new BABYLON.Vector3(-2, -32, -6);
        rainSys.direction2 = new BABYLON.Vector3(2, -38, -10);
        rainSys.minAngularSpeed = 0;
        rainSys.maxAngularSpeed = 0;
        rainSys.disposeOnStop = false;
        this.rainSys = rainSys;
        this.raining = false;
    }

    spawn(x, y, z, { count = 16, color = [1, 0.95, 0.8, 1], speed = 5, size = 0.4, life = 0.5 } = {}) {
        const sys = this.sparkSys;
        sys.emitter = new BABYLON.Vector3(x, y, z);
        sys.minSize = size * 0.7;
        sys.maxSize = size * 1.3;
        sys.minLifeTime = life * 0.6;
        sys.maxLifeTime = life * 1.2;
        sys.color1 = new BABYLON.Color4(color[0], color[1], color[2], color[3] || 1);
        sys.color2 = new BABYLON.Color4(color[0] * 0.9, color[1] * 0.9, color[2] * 0.9, 0.8);
        sys.minEmitPower = speed * 0.5;
        sys.maxEmitPower = speed * 1.2;
        sys.manualEmitCount = count;
    }

    dust(x, y, z, isDirt = true) {
        this.spawn(x, y, z, {
            count: 5,
            color: isDirt ? [0.75, 0.58, 0.38, 0.8] : [0.55, 0.55, 0.58, 0.6],
            speed: 2.2,
            size: 0.35,
            life: 0.4
        });
    }

    setRain(on) {
        if (this.raining === on) return;
        this.raining = on;
        if (on) {
            this.rainSys.start();
        } else {
            this.rainSys.stop();
        }
    }

    update(dt, player) {
        if (this.raining) {
            this.rainSys.emitter.x = player.x;
            this.rainSys.emitter.y = 14;
            this.rainSys.emitter.z = player.z - 12;
        }
    }
}
