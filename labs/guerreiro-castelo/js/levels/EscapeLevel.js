import * as THREE from 'three';
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
        this.group = new THREE.Group();
        const grass = new THREE.Mesh(
            new THREE.PlaneGeometry(50, 90),
            new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.92 })
        );
        grass.rotation.x = -Math.PI / 2;
        grass.receiveShadow = true;
        this.group.add(grass);
        const sand = new THREE.Mesh(
            new THREE.CircleGeometry(22, 24),
            new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 0.95 })
        );
        sand.rotation.x = -Math.PI / 2;
        sand.position.set(0, 0.03, 38);
        this.group.add(sand);

        const rng = seeded(9);
        this.trees = [];
        for (let i = 0; i < 22; i++) {
            const t = makeTree(rng);
            t.position.set((rng() - 0.5) * 28, 0, -20 + rng() * 50);
            this.group.add(t);
            this.trees.push(t);
        }
        this.group.add(makeGrassInstanced(160, 40, this.game.quality.vegetation));

        this.archers = [];
        for (let i = 0; i < 3; i++) {
            const a = buildGuard({ archer: true });
            a.group.position.set(-8 + i * 8, 10, -28);
            this.group.add(a.group);
            this.archers.push({ root: a.group, anim: new CharacterAnimator(a.group, a.clips), t: i * 0.4 });
        }

        const shipHint = new THREE.Mesh(
            new THREE.BoxGeometry(6, 3, 14),
            new THREE.MeshStandardMaterial({ color: 0x8a6238, roughness: 0.85 })
        );
        shipHint.position.set(0, 1.6, 46);
        this.group.add(shipHint);
        this.shipHint = shipHint;

        this.game.collision.addFloor(0, 10, 60, 100, 0);
        this.game.scene.add(this.group);
        this.obstacles = [];
        this.group.traverse((c) => { if (c.isMesh) this.obstacles.push(c); });
        this.game.arrows.setColliders(this.obstacles);
        this.fireT = 0;
        this.called = false;
    }

    enter() {
        const g = this.game;
        g.player.attachTo(g.scene);
        g.teco.attachTo(g.scene);
        g.camila.attachTo(g.scene);
        g.player.spawn(0, 0, -24, 0);
        g.teco.spawn(0.5, 0, -23);
        g.camila.spawn(-0.8, 0, -25);
        g.camila.active = true;
        g.camila.root.visible = true;
        g.camila.ai.run();
        g.weather.apply('day');
        g.audio.setTheme('chase');
        g.quests.set('reach_ship');
        g.hud.showObjective('Chegue ao navio', true);
        g.dialogue.say('ARQUEIRO', 'Ali estão eles!');
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
                const origin = a.root.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 1.4, 0));
                const target = this.game.player.worldPosition().clone();
                target.x += (Math.random() - 0.5) * 4;
                target.z += (Math.random() - 0.5) * 3;
                target.y += 1;
                const dir = target.sub(origin).normalize();
                this.game.arrows.fire(origin, dir, 26 + Math.random() * 8);
                this.game.audio.play('arrow');
            }
        }
        const p = this.game.player.position;
        if (p.z > 8 && !this.called) {
            this.called = true;
            this.game.dialogue.say('DICO', 'Não parem!');
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
