import * as THREE from 'three';
import { Level } from './Level.js';
import { sandTexture, grassTexture } from '../world/Textures.js';
import { makeRock, makeGrassInstanced, makeBush } from '../world/Environment.js';

export class BeachLevel extends Level {
    get id() {
        return 'beach';
    }

    async build() {
        this.group = new THREE.Group();
        this.group.position.set(0, 0, 0);
        const sand = new THREE.Mesh(
            new THREE.CircleGeometry(42, 32),
            new THREE.MeshStandardMaterial({ map: sandTexture(), roughness: 0.95, color: 0xe8d2a8 })
        );
        sand.rotation.x = -Math.PI / 2;
        sand.position.y = 0.02;
        sand.receiveShadow = true;
        this.group.add(sand);

        const grass = new THREE.Mesh(
            new THREE.CircleGeometry(38, 24),
            new THREE.MeshStandardMaterial({ map: grassTexture(), roughness: 0.92 })
        );
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(0, 0.04, -22);
        grass.receiveShadow = true;
        this.group.add(grass);

        for (let i = 0; i < 10; i++) {
            const r = makeRock(0.8 + Math.random());
            r.position.set((Math.random() - 0.5) * 22, 0.2, 6 + Math.random() * 10);
            this.group.add(r);
        }
        const wood = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 0.18, 0.35),
            new THREE.MeshStandardMaterial({ color: 0x6a4a28, roughness: 0.9 })
        );
        wood.position.set(-4, 0.12, 8);
        wood.rotation.y = 0.4;
        this.group.add(wood);

        const grassI = makeGrassInstanced(180, 28, this.game.quality.vegetation);
        grassI.position.z = -8;
        this.group.add(grassI);
        for (let i = 0; i < 8; i++) {
            const b = makeBush();
            b.position.set((Math.random() - 0.5) * 18, 0.2, -8 + Math.random() * 8);
            this.group.add(b);
        }

        this.game.collision.addFloor(0, -4, 70, 70, 0);
        this.game.scene.add(this.group);
        this.obstacles = [];
        this.group.traverse((c) => { if (c.isMesh) this.obstacles.push(c); });

        this.gulls = [];
        for (let i = 0; i < 4; i++) {
            const gull = new THREE.Mesh(
                new THREE.ConeGeometry(0.15, 0.5, 4),
                new THREE.MeshStandardMaterial({ color: 0xf2f0ea })
            );
            gull.position.set(-8 + i * 5, 6 + i, 10);
            this.group.add(gull);
            this.gulls.push({ m: gull, p: i });
        }
    }

    enter() {
        const g = this.game;
        g.player.attachTo(g.scene);
        g.teco.attachTo(g.scene);
        g.camila.attachTo(g.scene);
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
        }
    }
}
