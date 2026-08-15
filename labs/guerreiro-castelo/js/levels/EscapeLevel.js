/**
 * Capítulo 10: Fuga do Castelo sob Saraivada de Flechas em Babylon.js.
 */

import { Level } from './Level.js';
import { makeTree, makeGrassInstanced } from '../world/Environment.js';
import { grassTexture, sandTexture } from '../world/Textures.js';
import { buildGuard, CharacterAnimator } from '../characters/builders.js';
import { seeded } from '../utils/math.js';

export class EscapeLevel extends Level {
    get id() {
        return 'escape';
    }

    async build() {
        const scene = this.game.scene;
        this.group = new BABYLON.TransformNode('escapeGroup', scene);

        const grass = BABYLON.MeshBuilder.CreateGround('escapeGrass', { width: 50, height: 90 }, scene);
        grass.position.y = 0.02;
        const gMat = new BABYLON.StandardMaterial('eGrassMat', scene);
        gMat.diffuseTexture = grassTexture(scene, 10, 15);
        grass.material = gMat;
        grass.parent = this.group;
        grass.receiveShadows = true;

        const sand = BABYLON.MeshBuilder.CreateDisc('escapeSand', { radius: 22, tessellation: 24 }, scene);
        sand.rotation.x = Math.PI / 2;
        sand.position.set(0, 0.04, 38);
        const sMat = new BABYLON.StandardMaterial('eSandMat', scene);
        sMat.diffuseTexture = sandTexture(scene, 5, 5);
        sand.material = sMat;
        sand.parent = this.group;
        sand.receiveShadows = true;

        const rng = seeded(9);
        this.trees = [];
        for (let i = 0; i < 22; i++) {
            const t = makeTree(rng, scene);
            t.position.set((rng() - 0.5) * 28, 0, -20 + rng() * 50);
            t.parent = this.group;
            this.trees.push(t);
        }

        const grassI = makeGrassInstanced(160, 40, this.game.quality?.vegetation || 1, scene);
        grassI.parent = this.group;

        this.archers = [];
        for (let i = 0; i < 3; i++) {
            const a = buildGuard(scene, { archer: true });
            a.root.position.set(-8 + i * 8, 10, -28);
            a.root.parent = this.group;
            this.archers.push({ root: a.root, anim: new CharacterAnimator(a.root, a.clips), t: i * 0.4 });
        }

        const shipHint = BABYLON.MeshBuilder.CreateBox('shipEscapeHint', { width: 6, height: 3, depth: 14 }, scene);
        shipHint.position.set(0, 1.6, 46);
        const shipMat = new BABYLON.StandardMaterial('sHintMat', scene);
        shipMat.diffuseColor = new BABYLON.Color3(0.5, 0.35, 0.2);
        shipHint.material = shipMat;
        shipHint.parent = this.group;

        this.game.collision.addFloor(0, 10, 60, 100, 0);
        this.obstacles = this.group.getChildMeshes ? this.group.getChildMeshes() : [];
        this.game.arrows.setColliders(this.obstacles);
        this.fireT = 0;
        this.called = false;
    }

    enter() {
        const g = this.game;
        g.player.attachTo(this.group);
        g.teco.attachTo(this.group);
        g.camila.attachTo(this.group);
        g.player.spawn(0, 0, -24, 0);
        g.teco.spawn(0.5, 0, -23);
        g.camila.spawn(-0.8, 0, -25);
        g.camila.active = true;
        g.camila.root.setEnabled(true);
        g.camila.ai.run();
        g.weather.apply('day');
        g.audio.setTheme('chase');
        g.quests.set('reach_ship');
        g.hud.showObjective('Chegue ao navio', true);
        g.dialogue.say('ARQUEIRO', 'Ali estão eles! Não os deixem escapar!');
        g.input.enabled = true;
        g.player.controller.setMode('walk');
        g.cameraRig.setObstacles(this.obstacles);

        g.arrows.onHitPlayer = () => {
            if (g.player.hurt(1)) {
                g.audio.play('hit');
                g.cameraRig.addShake(0.16, 0.25);
                if (!g.player.alive) g.failCheckpoint('Uma flecha…');
            }
        };

        g.input.requestLock();
    }

    update(dt) {
        this.time += dt;
        this.fireT += dt;

        for (const a of this.archers) {
            a.anim.update(dt);
            a.t += dt;
            if (a.t > 1.15) {
                a.t = 0;
                const archerPos = a.root.position;
                const origin = new BABYLON.Vector3(archerPos.x, archerPos.y + 1.4, archerPos.z);
                const p = this.game.player.position;
                const target = new BABYLON.Vector3(
                    p.x + (Math.random() - 0.5) * 4,
                    p.y + 1,
                    p.z + (Math.random() - 0.5) * 3
                );
                const dir = target.subtract(origin).normalize();
                this.game.arrows.fire(origin, dir, 26 + Math.random() * 8);
                this.game.audio.play('arrow');
            }
        }

        const p = this.game.player.position;
        if (p.z > 8 && !this.called) {
            this.called = true;
            this.game.dialogue.say('DICO', 'Não parem! O navio está logo à frente!');
            this.game.teco.ai.state = 'SCARED';
            this.game.teco.ai.timer = 0;
        }

        if (p.z > 40) {
            this.game.story.notify('reach_ship');
        }
    }

    exit() {
        super.exit();
        this.game.arrows.clear();
        this.game.arrows.onHitPlayer = null;
    }
}
