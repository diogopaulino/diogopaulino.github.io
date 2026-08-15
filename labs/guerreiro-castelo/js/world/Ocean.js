/**
 * Oceano reativo ao clima com simulação de ondas para o navio em Babylon.js.
 */

import { waterNormalTexture } from './Textures.js';

export class Ocean {
    constructor(scene, quality) {
        this.scene = scene;
        this.intensity = 0.25;
        this.foam = 0;
        this.time = 0;

        const subs = quality.id === 'ultra' ? 64 : quality.id === 'high' ? 48 : 32;
        this.mesh = BABYLON.MeshBuilder.CreateGround('oceanMesh', {
            width: 1600,
            height: 1600,
            subdivisions: subs,
            updatable: true
        }, scene);
        this.mesh.position.y = 0;
        this.mesh.receiveShadows = true;

        this.positions = this.mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
        this.baseY = new Float32Array(this.positions.length / 3);
        this.origX = new Float32Array(this.positions.length / 3);
        this.origZ = new Float32Array(this.positions.length / 3);

        for (let i = 0; i < this.positions.length / 3; i++) {
            this.origX[i] = this.positions[i * 3];
            this.baseY[i] = this.positions[i * 3 + 1];
            this.origZ[i] = this.positions[i * 3 + 2];
        }

        // Material PBR / Standard estilizado
        const mat = new BABYLON.StandardMaterial('oceanMat', scene);
        mat.diffuseColor = new BABYLON.Color3(0.06, 0.28, 0.42);
        mat.specularColor = new BABYLON.Color3(0.8, 0.9, 1.0);
        mat.specularPower = 64;
        mat.alpha = 0.92;
        mat.bumpTexture = waterNormalTexture(scene, 16, 16);

        this.mesh.material = mat;
        this.mat = mat;
        this.visible = true;
    }

    set visible(v) {
        if (this.mesh) this.mesh.setEnabled(v);
    }

    get visible() {
        return this.mesh ? this.mesh.isEnabled() : false;
    }

    setStorm(amount) {
        this.intensity = 0.25 + amount * 2.4;
        this.foam = amount;
        if (this.mat) {
            if (amount > 0.4) {
                this.mat.diffuseColor = new BABYLON.Color3(0.04, 0.12, 0.18);
                this.mat.specularColor = new BABYLON.Color3(0.5, 0.6, 0.7);
            } else {
                this.mat.diffuseColor = new BABYLON.Color3(0.06, 0.28, 0.42);
                this.mat.specularColor = new BABYLON.Color3(0.8, 0.9, 1.0);
            }
        }
    }

    sample(x, z, time) {
        const k = this.intensity;
        const y =
            Math.sin(x * 0.08 + time * 1.4) * 0.35 * k +
            Math.sin(z * 0.05 + time * 1.1) * 0.45 * k +
            Math.sin((x + z) * 0.03 + time * 0.7) * 0.25 * k;
        const pitch = Math.cos(z * 0.05 + time * 1.1) * 0.06 * k;
        const roll = Math.cos(x * 0.08 + time * 1.4) * 0.07 * k;
        const yaw = Math.sin(time * 0.3) * 0.01 * k;
        return { y, pitch, roll, yaw };
    }

    update(dt, time) {
        this.time = time;
        if (!this.visible) return;

        // Atualização da malha para deformação visual fluida próxima à câmera
        const k = this.intensity;
        const len = this.positions.length / 3;
        for (let i = 0; i < len; i++) {
            const x = this.origX[i];
            const z = this.origZ[i];
            this.positions[i * 3 + 1] =
                Math.sin(x * 0.08 + time * 1.4) * 0.35 * k +
                Math.sin(z * 0.05 + time * 1.1) * 0.45 * k +
                Math.sin((x + z) * 0.03 + time * 0.7) * 0.25 * k;
        }
        this.mesh.updateVerticesData(BABYLON.VertexBuffer.PositionKind, this.positions);

        if (this.mat.bumpTexture) {
            this.mat.bumpTexture.uOffset = time * 0.03;
            this.mat.bumpTexture.vOffset = time * 0.02;
        }
    }
}
