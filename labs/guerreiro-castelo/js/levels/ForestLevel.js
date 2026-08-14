import * as THREE from 'three';
import { Level } from './Level.js';
import { makeTree, makeBush, makeRock, makeGrassInstanced } from '../world/Environment.js';
import { grassTexture } from '../world/Textures.js';
import { seeded } from '../utils/math.js';

export class ForestLevel extends Level {
    get id() {
        return 'forest';
    }

    async build() {
        this.group = new THREE.Group();
        this.group.position.set(0, 0, -36);
        const rng = seeded(42);
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(48, 50),
            new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.92 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.group.add(ground);

        this.trees = [];
        for (let i = 0; i < 28 * this.game.quality.vegetation; i++) {
            const t = makeTree(rng);
            let x = (rng() - 0.5) * 36;
            let z = (rng() - 0.5) * 42;
            if (Math.abs(x) < 2.4) x += x < 0 ? -3 : 3;
            t.position.set(x, 0, z);
            this.group.add(t);
            this.trees.push(t);
            this.game.collision.addWall(x, z - 36, 0.8, 0.8, 4);
        }
        for (let i = 0; i < 12; i++) {
            const b = makeBush();
            b.position.set((rng() - 0.5) * 20, 0.2, (rng() - 0.5) * 30);
            this.group.add(b);
        }
        const rocks = makeRock(1.2);
        rocks.position.set(3, 0.2, 8);
        this.group.add(rocks);
        this.group.add(makeGrassInstanced(220, 40, this.game.quality.vegetation));

        this.game.scene.add(this.group);
        this.obstacles = [];
        this.group.traverse((c) => { if (c.isMesh) this.obstacles.push(c); });
    }

    update() {
        for (const t of this.trees) {
            const c = t.children[1];
            if (c) c.rotation.y = Math.sin(this.game.clockTime * 0.4) * 0.04;
        }
    }
}
