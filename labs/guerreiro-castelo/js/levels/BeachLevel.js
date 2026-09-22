/**
 * Capítulo 4: Desembarque na praia em Babylon.js.
 */

import { Level } from './Level.js';
import { sandTexture, grassTexture } from '../world/Textures.js';
import { makeRock, makeGrassInstanced, makeBush } from '../world/Environment.js?v=6';
import { createMuscle } from '../../../shared/realism-bjs.js';

export class BeachLevel extends Level {
    get id() {
        return 'beach';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('beachGroup', scene);

        // Disco de areia
        const sand = BABYLON.MeshBuilder.CreateDisc('beachSand', { radius: 42, tessellation: 32 }, scene);
        sand.rotation.x = Math.PI / 2;
        sand.position.y = 0.02;
        const sandMat = new BABYLON.StandardMaterial('sandMat', scene);
        sandMat.diffuseTexture = sandTexture(scene, 8, 8);
        sandMat.diffuseColor = new BABYLON.Color3(0.95, 0.88, 0.72);
        sand.material = sandMat;
        sand.parent = this.group;
        sand.receiveShadows = true;

        // Disco de grama interior
        const grass = BABYLON.MeshBuilder.CreateDisc('beachGrass', { radius: 38, tessellation: 24 }, scene);
        grass.rotation.x = Math.PI / 2;
        grass.position.set(0, 0.04, -22);
        const grassMat = new BABYLON.StandardMaterial('bGrassMat', scene);
        grassMat.diffuseTexture = grassTexture(scene, 8, 8);
        grass.material = grassMat;
        grass.parent = this.group;
        grass.receiveShadows = true;

        for (let i = 0; i < 10; i++) {
            const r = makeRock(0.8 + Math.random(), scene);
            r.position.set((Math.random() - 0.5) * 22, 0.2, 6 + Math.random() * 10);
            r.parent = this.group;
        }

        const wood = BABYLON.MeshBuilder.CreateBox('driftWood', { width: 1.6, height: 0.18, depth: 0.35 }, scene);
        wood.position.set(-4, 0.12, 8);
        wood.rotation.y = 0.4;
        const woodMat = new BABYLON.StandardMaterial('driftWoodMat', scene);
        woodMat.diffuseColor = new BABYLON.Color3(0.4, 0.28, 0.16);
        wood.material = woodMat;
        wood.parent = this.group;

        const grassI = makeGrassInstanced(180, 28, this.game.quality?.vegetation || 1, scene);
        grassI.position.z = -8;
        grassI.parent = this.group;

        for (let i = 0; i < 8; i++) {
            const b = makeBush(scene);
            b.position.set((Math.random() - 0.5) * 18, 0.2, -8 + Math.random() * 8);
            b.parent = this.group;
        }

        this.game.collision.addFloor(0, -4, 70, 70, 0);
        this.obstacles = this.group.getChildMeshes ? this.group.getChildMeshes() : [];

        this.gulls = [];
        const gullMat = new BABYLON.StandardMaterial('gullMat', scene);
        gullMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.92);

        for (let i = 0; i < 4; i++) {
            const gull = new BABYLON.TransformNode(`gull_${i}`, scene);
            const body = createMuscle(scene, `gullBody_${i}`, {
                length: 0.42, r0: 0.03, r1: 0.055, bulge: 0.02, bulgeAt: 0.42, pinch: 0.15, tessellation: 8, rings: 5
            });
            body.rotation.x = Math.PI / 2;
            body.material = gullMat;
            body.parent = gull;
            const wings = [];
            for (const sx of [-1, 1]) {
                const wing = BABYLON.MeshBuilder.CreateDisc(`gullWing_${i}_${sx}`, {
                    radius: 0.26, tessellation: 7, arc: 0.42
                }, scene);
                wing.material = gullMat;
                wing.position.set(sx * 0.04, 0.02, 0);
                wing.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
                wing.parent = gull;
                wings.push(wing);
            }
            gull.position.set(-8 + i * 5, 6 + i, 10);
            gull.parent = this.group;
            this.gulls.push({ m: gull, p: i, wings });
        }
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.group);
        g.teco.attachTo(this.group);
        g.camila.attachTo(this.group);
        g.player.spawn(0, 0, 10, Math.PI);
        g.teco.spawn(0.7, 0, 9);
        g.weather.apply('dawn');
        g.audio.setTheme('land');
        g.storm.setIntensity(0);
        g.quests.set('reach_castle');
        g.hud.showObjective('Chegue até o castelo');
        g.input.enabled = true;
        g.player.controller.setMode('walk');
        g.input.requestLock();
    }

    update(dt) {
        this.time += dt;
        for (const g of this.gulls) {
            g.m.position.x = Math.sin(this.time * 0.4 + g.p) * 12;
            g.m.position.z = 8 + Math.cos(this.time * 0.3 + g.p) * 6;
            g.m.position.y = 5 + Math.sin(this.time * 2 + g.p) * 0.6;
            const flap = Math.sin(this.time * 6 + g.p) * 0.45;
            if (g.wings) {
                g.wings[0].rotation.z = flap;
                g.wings[1].rotation.z = -flap;
            }
        }
    }
}
