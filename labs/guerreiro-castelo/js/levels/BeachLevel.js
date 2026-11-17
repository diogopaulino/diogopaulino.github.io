/**
 * Capítulos 4 e 5: Desembarque na praia e travessia da mata.
 * Este nível é o dono do terreno da ilha (world/Island.js): monta-o uma única vez, registra a
 * colisão e o atualiza a cada quadro. Castelo e entrada secreta são níveis vizinhos no mesmo chão.
 */

import * as THREE from 'three';
import { Level } from './Level.js?v=40';
import { getIsland, ISLAND_MARKS } from '../world/Island.js?v=40';
import { createCreature } from '../characters/cast.js?v=40';

const _p = new THREE.Vector3();

export class BeachLevel extends Level {
    get id() {
        return 'beach';
    }

    async build() {
        const g = this.game;
        this.island = await getIsland(g);
        g.island = this.island;
        this.group = this.island.group;
        this.island.addColliders(g.collision);
        g.stage.follow(this.island.terrain);

        /* Gaivotas sobre a praia (criaturas com esqueleto, em voo planado). */
        this.gulls = [];
        for (let i = 0; i < 3; i++) {
            const c = createCreature('goose', { detail: 0, scale: 0.55, seed: i + 2, colors: { base: 0xf2f2ee, back: 0xc8ccd2 } });
            this.group.add(c.object);
            this.gulls.push({ c, p: i * 2.1, anim: { mode: 'glide', speed: 8 } });
        }
    }

    enter() {
        const g = this.game;
        const M = ISLAND_MARKS;
        const h = this.island.heightAt;
        g.player.attachTo(this.group);
        g.teco.attachTo(this.group);
        g.camila.attachTo(this.group);
        g.player.spawn(M.spawn.x, h(M.spawn.x, M.spawn.z), M.spawn.z, Math.PI);
        g.teco.spawn(M.spawn.x + 0.9, h(M.spawn.x + 0.9, M.spawn.z + 1), M.spawn.z + 1);
        g.weather.apply('island');
        g.audio.setTheme('land');
        g.storm.setIntensity(0);
        g.ocean.setMode('island');
        g.ocean.visible = true;
        g.quests.set('reach_castle');
        g.hud.showObjective('Chegue até o castelo');
        g.input.enabled = true;
        g.player.controller.setMode('walk');
        g.cameraRig.setWorld(g.collision, null, true);
        g.cameraRig.yaw = 0;
        g.cameraRig.pitch = 0.2;
        g.checkpoints.save('castle_beach', g.story._saveBlob());
        g.hud.showToast('Siga a trilha pela mata. Shift corre.', 5);
    }

    update(dt) {
        this.time += dt;
        const g = this.game;
        const p = g.player.position;
        this.island.update(dt, this.time, g.camera, p.x, p.y, p.z);
        for (const gull of this.gulls) {
            const a = this.time * 0.22 + gull.p;
            _p.set(Math.sin(a) * 26, 14 + Math.sin(a * 2.3) * 2, 70 + Math.cos(a) * 16);
            gull.c.object.position.copy(_p);
            gull.c.object.rotation.y = a + Math.PI / 2;
            gull.c.update(dt, gull.anim);
        }
    }

    exit() {
        for (const gull of this.gulls) {
            gull.c.object.removeFromParent();
            gull.c.dispose?.();
        }
        super.exit();
    }
}
