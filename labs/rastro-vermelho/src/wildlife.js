/**
 * Vida selvagem em Babylon.js: águias circulando alto e animais do deserto.
 */

import { heightAt } from './world.js';
import { hash2 } from './utils.js';

export class Wildlife {
    constructor(BABYLON, scene, quality) {
        this.BABYLON = BABYLON;
        this.scene = scene;
        this.birds = [];

        const birdMat = new BABYLON.StandardMaterial('mat_eagle', scene);
        birdMat.diffuseColor = new BABYLON.Color3(0.18, 0.14, 0.1);
        birdMat.emissiveColor = new BABYLON.Color3(0.08, 0.06, 0.04);

        const count = quality.birds || 6;
        for (let i = 0; i < count; i++) {
            const mesh = BABYLON.MeshBuilder.CreateCylinder(`eagle_${i}`, {
                height: 0.8,
                diameterTop: 0,
                diameterBottom: 0.3,
                tessellation: 4
            }, scene);
            mesh.rotation.x = Math.PI / 2;
            mesh.material = birdMat;

            this.birds.push({
                mesh,
                radius: 22 + hash2(i, 3, 11) * 35,
                height: 25 + hash2(i, 6, 12) * 18,
                speed: 0.25 + hash2(i, 8, 13) * 0.15,
                offset: hash2(i, 4, 14) * Math.PI * 2
            });
        }
    }

    update(dt, playerPos, time) {
        for (const b of this.birds) {
            const t = time * b.speed + b.offset;
            const x = playerPos.x + Math.cos(t) * b.radius;
            const z = playerPos.z + Math.sin(t) * b.radius;
            const y = heightAt(playerPos.x, playerPos.z) + b.height + Math.sin(t * 2) * 1.5;
            b.mesh.position.set(x, y, z);
            b.mesh.rotation.y = -t + Math.PI / 2;
        }
    }
}
