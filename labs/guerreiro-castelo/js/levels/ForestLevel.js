/**
 * Capítulo 5: Travessia pela Floresta em Babylon.js.
 */

import { Level } from './Level.js';
import { makeTree, makeBush, makeRock, makeGrassInstanced } from '../world/Environment.js';
import { grassTexture } from '../world/Textures.js';
import { seeded } from '../utils/math.js';

export class ForestLevel extends Level {
    get id() {
        return 'forest';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('forestGroup', scene);
        this.group.position.set(0, 0, -36);

        const rng = seeded(42);
        const ground = BABYLON.MeshBuilder.CreateGround('forestGround', { width: 48, height: 50 }, scene);
        ground.position.y = 0.02;
        const gMat = new BABYLON.StandardMaterial('forestGroundMat', scene);
        gMat.diffuseTexture = grassTexture(scene, 10, 10);
        ground.material = gMat;
        ground.parent = this.group;
        ground.receiveShadows = true;

        this.trees = [];
        const treeCount = Math.floor(28 * (this.game.quality?.vegetation || 1));
        for (let i = 0; i < treeCount; i++) {
            const t = makeTree(rng, scene);
            let x = (rng() - 0.5) * 36;
            let z = (rng() - 0.5) * 42;
            if (Math.abs(x) < 2.4) x += x < 0 ? -3 : 3;
            t.position.set(x, 0, z);
            t.parent = this.group;
            this.trees.push(t);
            this.game.collision.addWall(x, z - 36, 0.8, 0.8, 4);
        }

        for (let i = 0; i < 12; i++) {
            const b = makeBush(scene);
            b.position.set((rng() - 0.5) * 20, 0.2, (rng() - 0.5) * 30);
            b.parent = this.group;
        }

        const rocks = makeRock(1.2, scene);
        rocks.position.set(3, 0.2, 8);
        rocks.parent = this.group;

        const grassI = makeGrassInstanced(220, 40, this.game.quality?.vegetation || 1, scene);
        grassI.parent = this.group;

        this.obstacles = this.group.getChildMeshes ? this.group.getChildMeshes() : [];
    }

    update(dt) {
        this.time += dt;
        for (const t of this.trees) {
            const foliage = t.getChildren ? t.getChildren()[1] : null;
            if (foliage) {
                foliage.rotation.y = Math.sin(this.time * 0.4) * 0.04;
            }
        }
    }
}
